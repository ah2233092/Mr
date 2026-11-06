// SQLite storage (built into Node 22+, no native modules to compile).
// WAL mode lets many readers run alongside one writer, which is plenty for
// hundreds of simultaneous chat users on a single server.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

// node:sqlite prints an "experimental" warning once; silence just that one.
const origEmit = process.emitWarning;
process.emitWarning = function (w, ...rest) {
  const msg = typeof w === 'string' ? w : w?.message;
  if (msg && msg.includes('SQLite is an experimental feature')) return;
  return origEmit.call(this, w, ...rest);
};
const { DatabaseSync } = await import('node:sqlite');

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(path.join(config.dataDir, 'files'), { recursive: true });

export const db = new DatabaseSync(process.env.DB_PATH || path.join(config.dataDir, 'app.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  pass_hash TEXT,
  google_sub TEXT UNIQUE,
  avatar TEXT,
  custom_instructions TEXT NOT NULL DEFAULT '',
  settings TEXT NOT NULL DEFAULT '{}',
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chats_user ON chats(user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  reasoning TEXT,
  attachments TEXT,
  model TEXT,
  model_name TEXT,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'done',
  note TEXT,
  rating INTEGER,
  latency_ms INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_chat ON messages(chat_id, seq);
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  kind TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS files_user ON files(user_id);
CREATE TABLE IF NOT EXISTS usage (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  msgs INTEGER NOT NULL DEFAULT 0,
  paid_msgs INTEGER NOT NULL DEFAULT 0,
  images INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
`);

export const now = () => Date.now();
export const newId = (bytes = 12) => crypto.randomBytes(bytes).toString('base64url');
export const today = () => new Date().toISOString().slice(0, 10);

// Small statement cache so every query is prepared exactly once.
const cache = new Map();
export function q(sql) {
  let st = cache.get(sql);
  if (!st) { st = db.prepare(sql); cache.set(sql, st); }
  return st;
}

export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; }
}

// ---------- users ----------
export function publicUser(u) {
  if (!u) return null;
  let settings = {};
  try { settings = JSON.parse(u.settings || '{}'); } catch {}
  return {
    id: u.id, email: u.email, name: u.name, avatar: u.avatar || null,
    customInstructions: u.custom_instructions || '', settings,
    isAdmin: config.adminEmails.includes(u.email.toLowerCase()),
    hasPassword: !!u.pass_hash, createdAt: u.created_at,
  };
}

// ---------- usage counters ----------
export function getUsage(userId) {
  return q('SELECT msgs, paid_msgs, images FROM usage WHERE user_id=? AND day=?').get(userId, today())
    || { msgs: 0, paid_msgs: 0, images: 0 };
}
export function bumpUsage(userId, field) {
  if (!['msgs', 'paid_msgs', 'images'].includes(field)) throw new Error('bad usage field');
  q(`INSERT INTO usage(user_id, day, ${field}) VALUES(?,?,1)
     ON CONFLICT(user_id, day) DO UPDATE SET ${field} = ${field} + 1`).run(userId, today());
}

// ---------- chats & messages ----------
export function nextSeq(chatId) {
  const r = q('SELECT COALESCE(MAX(seq), 0) AS s FROM messages WHERE chat_id=?').get(chatId);
  return r.s + 1;
}

export function rowToMessage(m) {
  let attachments = [];
  try { attachments = m.attachments ? JSON.parse(m.attachments) : []; } catch {}
  return {
    id: m.id, role: m.role, content: m.content, reasoning: m.reasoning || '',
    attachments, model: m.model, modelName: m.model_name, provider: m.provider,
    status: m.status, note: m.note || '', rating: m.rating, latencyMs: m.latency_ms, createdAt: m.created_at,
  };
}

// Daily snapshot of the database into data/backups (keeps the newest 7).
export function backupDatabase() {
  const dir = path.join(config.dataDir, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `app-${new Date().toISOString().slice(0, 10)}.db`);
  if (fs.existsSync(file)) return file;
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const old = fs.readdirSync(dir).filter((f) => /^app-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().reverse().slice(7);
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
  return file;
}

// Periodic cleanup of expired sessions / reset tokens.
export function cleanup() {
  const t = now();
  q('DELETE FROM sessions WHERE expires_at < ?').run(t);
  q('DELETE FROM reset_tokens WHERE expires_at < ?').run(t);
}
