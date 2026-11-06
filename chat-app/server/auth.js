// Authentication: scrypt password hashes, server-side sessions in httpOnly
// cookies, brute-force protection, Google sign-in and password reset.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';
import { q, now, newId, publicUser } from './db.js';
import { HttpError, parseCookies, setCookie } from './http.js';

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const SESSION_COOKIE = 'sid';

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, saltB64, keyB64] = stored.split('$');
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, SCRYPT);
  return crypto.timingSafeEqual(key, expected);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('base64url');

// ---------- validation ----------
export function normalizeEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw new HttpError(400, 'Please enter a valid email address.');
  return e;
}
// Private mode: when ALLOWED_EMAILS is set, nobody else can sign up or log in.
export function isEmailAllowed(email) {
  return !config.allowedEmails.length || config.allowedEmails.includes(String(email).toLowerCase());
}
export function assertEmailAllowed(email) {
  if (!isEmailAllowed(email)) throw new HttpError(403, 'This is a private app. This email is not allowed.');
}

export function validatePassword(pw) {
  pw = String(pw || '');
  if (pw.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
  if (pw.length > 200) throw new HttpError(400, 'Password is too long.');
  return pw;
}
export function cleanName(name, fallback = '') {
  const n = String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);
  return n || fallback;
}

// ---------- brute-force limiter (in memory, per key) ----------
const attempts = new Map();
export function checkAttempts(key, max = 10, windowMs = 15 * 60 * 1000) {
  const t = now();
  const a = attempts.get(key);
  if (a && t - a.start < windowMs && a.count >= max) {
    const mins = Math.ceil((windowMs - (t - a.start)) / 60000);
    throw new HttpError(429, `Too many attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`);
  }
}
export function recordAttempt(key, windowMs = 15 * 60 * 1000) {
  const t = now();
  const a = attempts.get(key);
  if (!a || t - a.start >= windowMs) attempts.set(key, { start: t, count: 1 });
  else a.count++;
}
export function clearAttempts(key) { attempts.delete(key); }
setInterval(() => {
  const t = now();
  for (const [k, a] of attempts) if (t - a.start > 60 * 60 * 1000) attempts.delete(k);
}, 10 * 60 * 1000).unref();

// ---------- sessions ----------
export function createSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const maxAge = config.sessionDays * 86400;
  q('INSERT INTO sessions(token_hash, user_id, created_at, expires_at, user_agent) VALUES(?,?,?,?,?)')
    .run(sha256(token), userId, now(), now() + maxAge * 1000, String(req.headers['user-agent'] || '').slice(0, 200));
  setCookie(req, res, SESSION_COOKIE, token, { maxAge });
}

// Hot path: called on every API request, so keep a short in-memory cache.
const sessionCache = new Map();
export function getSessionUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token || token.length > 100) return null;
  const h = sha256(token);
  const cached = sessionCache.get(h);
  if (cached && cached.until > now()) return cached.user;
  const row = q(`SELECT u.*, s.expires_at AS s_exp FROM sessions s JOIN users u ON u.id = s.user_id
                 WHERE s.token_hash = ?`).get(h);
  if (!row || row.s_exp < now() || row.disabled || !isEmailAllowed(row.email)) { sessionCache.delete(h); return null; }
  // Sliding expiry: extend sessions that are used.
  if (row.s_exp - now() < (config.sessionDays * 86400 * 1000) / 2) {
    q('UPDATE sessions SET expires_at=? WHERE token_hash=?').run(now() + config.sessionDays * 86400 * 1000, h);
  }
  q('UPDATE users SET last_seen_at=? WHERE id=?').run(now(), row.id);
  sessionCache.set(h, { user: row, until: now() + 30_000 });
  if (sessionCache.size > 5000) sessionCache.delete(sessionCache.keys().next().value);
  return row;
}
export function invalidateUserCache(userId) {
  for (const [k, v] of sessionCache) if (v.user.id === userId) sessionCache.delete(k);
}
export function destroySession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) { const h = sha256(token); q('DELETE FROM sessions WHERE token_hash=?').run(h); sessionCache.delete(h); }
  setCookie(req, res, SESSION_COOKIE, '', { maxAge: 0 });
}
export function destroyAllSessions(userId) {
  q('DELETE FROM sessions WHERE user_id=?').run(userId);
  invalidateUserCache(userId);
}

export function requireUser(req) {
  const u = req.user;
  if (!u) throw new HttpError(401, 'Please log in.');
  return u;
}
export function requireAdmin(req) {
  const u = requireUser(req);
  if (!publicUser(u).isAdmin) throw new HttpError(403, 'Admins only.');
  return u;
}

// ---------- user creation ----------
export function createUser({ email, name, passHash = null, googleSub = null, avatar = null }) {
  const id = newId();
  q(`INSERT INTO users(id, email, name, pass_hash, google_sub, avatar, created_at, last_seen_at)
     VALUES(?,?,?,?,?,?,?,?)`).run(id, email, name, passHash, googleSub, avatar, now(), now());
  return q('SELECT * FROM users WHERE id=?').get(id);
}

// ---------- password reset tokens ----------
export function createResetToken(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  q('DELETE FROM reset_tokens WHERE user_id=?').run(userId);
  q('INSERT INTO reset_tokens(token_hash, user_id, expires_at) VALUES(?,?,?)').run(sha256(token), userId, now() + 60 * 60 * 1000);
  return token;
}
export function consumeResetToken(token) {
  const h = sha256(String(token || ''));
  const row = q('SELECT * FROM reset_tokens WHERE token_hash=?').get(h);
  q('DELETE FROM reset_tokens WHERE token_hash=?').run(h);
  if (!row || row.expires_at < now()) return null;
  return row.user_id;
}

export async function sendMail(to, subject, html) {
  if (!config.resend.apiKey || !config.resend.from) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.resend.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.resend.from, to, subject, html }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`mail failed: ${r.status} ${await r.text().catch(() => '')}`);
  return true;
}

// ---------- Google OAuth (authorization-code flow) ----------
export const googleEnabled = () => !!(config.google.clientId && config.google.clientSecret);

export function googleAuthUrl(redirectUri, state) {
  const p = new URLSearchParams({
    client_id: config.google.clientId, redirect_uri: redirectUri, response_type: 'code',
    scope: 'openid email profile', state, prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function googleExchange(code, redirectUri) {
  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: config.google.clientId, client_secret: config.google.clientSecret,
      redirect_uri: redirectUri, grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(10000),
  });
  const tok = await tr.json().catch(() => ({}));
  if (!tr.ok || !tok.access_token) throw new Error('Google token exchange failed');
  const ur = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tok.access_token}` }, signal: AbortSignal.timeout(10000),
  });
  const info = await ur.json().catch(() => ({}));
  if (!ur.ok || !info.sub || !info.email) throw new Error('Google profile fetch failed');
  if (info.email_verified === false) throw new Error('Google email is not verified');
  return info;
}
