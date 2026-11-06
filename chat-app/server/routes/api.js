// REST routes: auth, account, chats, files, models, admin.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { q, publicUser, getUsage, rowToMessage, tx } from '../db.js';
import { HttpError, readJson, sendJson, redirect, setCookie, parseCookies, clientIp, originOf, mimeOf } from '../http.js';
import {
  hashPassword, verifyPassword, normalizeEmail, validatePassword, cleanName, checkAttempts, recordAttempt, clearAttempts,
  createSession, destroySession, destroyAllSessions, requireUser, requireAdmin, createUser, invalidateUserCache,
  createResetToken, consumeResetToken, sendMail, googleEnabled, googleAuthUrl, googleExchange,
  assertEmailAllowed, isEmailAllowed,
} from '../auth.js';
import { publicModels, defaultModelKey, engineSnapshot, refreshModels } from '../engine/registry.js';
import { imageBackends } from '../engine/images.js';

export function registerApi(r) {
  // ---------- public config ----------
  r.get('/api/config', (req, res) => sendJson(res, 200, {
    appName: config.appName,
    signupEnabled: config.allowSignup,
    googleEnabled: googleEnabled(),
    resetEnabled: !!(config.resend.apiKey && config.resend.from),
    imagesEnabled: imageBackends().length > 0,
  }));

  r.get('/healthz', (req, res) => sendJson(res, 200, { ok: true, uptime: Math.round(process.uptime()) }));

  // ---------- auth ----------
  r.post('/api/auth/signup', async (req, res) => {
    if (!config.allowSignup) throw new HttpError(403, 'Sign-ups are closed.');
    const b = await readJson(req, 10_000);
    const email = normalizeEmail(b.email);
    assertEmailAllowed(email);
    const password = validatePassword(b.password);
    const ip = clientIp(req);
    checkAttempts(`signup:${ip}`, config.signupsPerIpPerHour, 60 * 60 * 1000);
    recordAttempt(`signup:${ip}`, 60 * 60 * 1000);
    if (q('SELECT 1 FROM users WHERE email=?').get(email)) throw new HttpError(409, 'An account with this email already exists. Try logging in.');
    const user = createUser({ email, name: cleanName(b.name, email.split('@')[0]), passHash: await hashPassword(password) });
    createSession(req, res, user.id);
    sendJson(res, 201, { user: publicUser(user) });
  });

  r.post('/api/auth/login', async (req, res) => {
    const b = await readJson(req, 10_000);
    const email = normalizeEmail(b.email);
    assertEmailAllowed(email);
    const key = `login:${clientIp(req)}:${email}`;
    checkAttempts(key, 8);
    const user = q('SELECT * FROM users WHERE email=?').get(email);
    const ok = user?.pass_hash ? await verifyPassword(String(b.password || ''), user.pass_hash) : false;
    if (!ok) {
      recordAttempt(key);
      if (user && !user.pass_hash && user.google_sub) throw new HttpError(401, 'This account uses Google sign-in. Click "Continue with Google".');
      throw new HttpError(401, 'Incorrect email or password.');
    }
    if (user.disabled) throw new HttpError(403, 'This account is disabled.');
    clearAttempts(key);
    createSession(req, res, user.id);
    sendJson(res, 200, { user: publicUser(user) });
  });

  r.post('/api/auth/logout', async (req, res) => { destroySession(req, res); sendJson(res, 200, { ok: true }); });

  r.post('/api/auth/forgot', async (req, res) => {
    const b = await readJson(req, 10_000);
    const email = normalizeEmail(b.email);
    checkAttempts(`forgot:${clientIp(req)}`, 5, 60 * 60 * 1000);
    recordAttempt(`forgot:${clientIp(req)}`, 60 * 60 * 1000);
    const user = q('SELECT * FROM users WHERE email=?').get(email);
    if (user) {
      const token = createResetToken(user.id);
      const link = `${originOf(req)}/?reset=${token}`;
      const html = `<p>Hi ${cleanName(user.name)},</p><p>Click below to set a new password for ${config.appName}. The link works for 1 hour.</p><p><a href="${link}">Reset password</a></p><p>If you did not ask for this, ignore this email.</p>`;
      const sent = await sendMail(email, `Reset your ${config.appName} password`, html).catch((e) => { console.error('[mail]', e.message); return false; });
      if (!sent) console.log(`[auth] password reset link for ${email}: ${link}`);
    }
    // Same answer either way so nobody can probe which emails exist.
    sendJson(res, 200, { ok: true });
  });

  r.post('/api/auth/reset', async (req, res) => {
    const b = await readJson(req, 10_000);
    const password = validatePassword(b.password);
    const userId = consumeResetToken(b.token);
    if (!userId) throw new HttpError(400, 'This reset link is invalid or has expired.');
    q('UPDATE users SET pass_hash=? WHERE id=?').run(await hashPassword(password), userId);
    destroyAllSessions(userId);
    createSession(req, res, userId);
    sendJson(res, 200, { user: publicUser(q('SELECT * FROM users WHERE id=?').get(userId)) });
  });

  // Google sign-in
  r.get('/api/auth/google', (req, res) => {
    if (!googleEnabled()) throw new HttpError(404, 'Google sign-in is not configured.');
    const state = crypto.randomBytes(16).toString('base64url');
    setCookie(req, res, 'g_state', state, { maxAge: 600 });
    redirect(res, googleAuthUrl(`${originOf(req)}/api/auth/google/callback`, state));
  });

  r.get('/api/auth/google/callback', async (req, res, { url }) => {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const expected = parseCookies(req).g_state;
    setCookie(req, res, 'g_state', '', { maxAge: 0 });
    if (!code || !state || !expected || state !== expected) return redirect(res, '/?auth_error=google');
    try {
      const info = await googleExchange(code, `${originOf(req)}/api/auth/google/callback`);
      const email = info.email.toLowerCase();
      if (!isEmailAllowed(email)) return redirect(res, '/?auth_error=private');
      let user = q('SELECT * FROM users WHERE google_sub=?').get(info.sub) || q('SELECT * FROM users WHERE email=?').get(email);
      if (user) {
        if (user.disabled) return redirect(res, '/?auth_error=disabled');
        q('UPDATE users SET google_sub=?, avatar=COALESCE(avatar, ?) WHERE id=?').run(info.sub, info.picture || null, user.id);
      } else {
        if (!config.allowSignup) return redirect(res, '/?auth_error=closed');
        user = createUser({ email, name: cleanName(info.name, email.split('@')[0]), googleSub: info.sub, avatar: info.picture || null });
      }
      createSession(req, res, user.id);
      redirect(res, '/');
    } catch (e) {
      console.error('[auth] google', e.message);
      redirect(res, '/?auth_error=google');
    }
  });

  // ---------- account ----------
  r.get('/api/me', (req, res) => {
    const u = requireUser(req);
    const usage = getUsage(u.id);
    sendJson(res, 200, {
      user: publicUser(u),
      usage: { messages: usage.msgs, premium: usage.paid_msgs, images: usage.images },
      limits: { messages: config.limits.userPerDay, premium: config.limits.paidPerDay, images: config.limits.imagesPerDay },
    });
  });

  r.patch('/api/me', async (req, res) => {
    const u = requireUser(req);
    const b = await readJson(req, 50_000);
    if (b.name !== undefined) q('UPDATE users SET name=? WHERE id=?').run(cleanName(b.name, u.name), u.id);
    if (b.customInstructions !== undefined) q('UPDATE users SET custom_instructions=? WHERE id=?').run(String(b.customInstructions).slice(0, 3000), u.id);
    if (b.settings && typeof b.settings === 'object') {
      let cur = {}; try { cur = JSON.parse(u.settings || '{}'); } catch {}
      const next = { ...cur };
      for (const k of ['theme', 'model', 'sendOnEnter', 'voice']) if (b.settings[k] !== undefined) next[k] = b.settings[k];
      q('UPDATE users SET settings=? WHERE id=?').run(JSON.stringify(next).slice(0, 4000), u.id);
    }
    invalidateUserCache(u.id);
    sendJson(res, 200, { user: publicUser(q('SELECT * FROM users WHERE id=?').get(u.id)) });
  });

  r.post('/api/me/password', async (req, res) => {
    const u = requireUser(req);
    const b = await readJson(req, 10_000);
    const next = validatePassword(b.newPassword);
    if (u.pass_hash && !(await verifyPassword(String(b.currentPassword || ''), u.pass_hash))) throw new HttpError(400, 'Current password is incorrect.');
    q('UPDATE users SET pass_hash=? WHERE id=?').run(await hashPassword(next), u.id);
    destroyAllSessions(u.id);
    createSession(req, res, u.id);
    sendJson(res, 200, { ok: true });
  });

  r.delete('/api/me', async (req, res) => {
    const u = requireUser(req);
    const b = await readJson(req, 10_000);
    if (u.pass_hash && !(await verifyPassword(String(b.password || ''), u.pass_hash))) throw new HttpError(400, 'Password is incorrect.');
    const files = q('SELECT id FROM files WHERE user_id=?').all(u.id);
    q('DELETE FROM users WHERE id=?').run(u.id);
    invalidateUserCache(u.id);
    for (const f of files) fs.promises.unlink(path.join(config.dataDir, 'files', f.id)).catch(() => {});
    destroySession(req, res);
    sendJson(res, 200, { ok: true });
  });

  // ---------- models ----------
  r.get('/api/models', (req, res) => {
    requireUser(req);
    sendJson(res, 200, {
      default: defaultModelKey(), models: publicModels(), images: imageBackends().length > 0,
      openaiConfigured: !!process.env.OPENAI_API_KEY,
    });
  });

  // ---------- chats ----------
  r.get('/api/chats', (req, res) => {
    const u = requireUser(req);
    const rows = q('SELECT id, title, pinned, updated_at FROM chats WHERE user_id=? ORDER BY pinned DESC, updated_at DESC LIMIT 1000').all(u.id);
    sendJson(res, 200, { chats: rows.map((c) => ({ id: c.id, title: c.title, pinned: !!c.pinned, updatedAt: c.updated_at })) });
  });

  r.get('/api/chats/:id', (req, res, { params }) => {
    const u = requireUser(req);
    const chat = q('SELECT * FROM chats WHERE id=? AND user_id=?').get(params.id, u.id);
    if (!chat) throw new HttpError(404, 'Chat not found.');
    const messages = q('SELECT * FROM messages WHERE chat_id=? ORDER BY seq').all(chat.id).map(rowToMessage);
    sendJson(res, 200, { chat: { id: chat.id, title: chat.title, pinned: !!chat.pinned, updatedAt: chat.updated_at }, messages });
  });

  r.patch('/api/chats/:id', async (req, res, { params }) => {
    const u = requireUser(req);
    const b = await readJson(req, 10_000);
    const chat = q('SELECT id FROM chats WHERE id=? AND user_id=?').get(params.id, u.id);
    if (!chat) throw new HttpError(404, 'Chat not found.');
    if (typeof b.title === 'string' && b.title.trim()) q('UPDATE chats SET title=? WHERE id=?').run(b.title.trim().slice(0, 120), chat.id);
    if (typeof b.pinned === 'boolean') q('UPDATE chats SET pinned=? WHERE id=?').run(b.pinned ? 1 : 0, chat.id);
    sendJson(res, 200, { ok: true });
  });

  r.delete('/api/chats/:id', (req, res, { params }) => {
    const u = requireUser(req);
    deleteChats(u.id, q('SELECT id FROM chats WHERE id=? AND user_id=?').all(params.id, u.id));
    sendJson(res, 200, { ok: true });
  });

  r.delete('/api/chats', (req, res) => {
    const u = requireUser(req);
    deleteChats(u.id, q('SELECT id FROM chats WHERE user_id=?').all(u.id));
    sendJson(res, 200, { ok: true });
  });

  r.get('/api/search', (req, res, { url }) => {
    const u = requireUser(req);
    const term = String(url.searchParams.get('q') || '').trim().slice(0, 100);
    if (!term) return sendJson(res, 200, { results: [] });
    const like = `%${term.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
    const rows = q(`SELECT c.id, c.title, c.updated_at,
        (SELECT substr(m.content, 1, 400) FROM messages m WHERE m.chat_id=c.id AND m.content LIKE ? ESCAPE '\\' ORDER BY m.seq LIMIT 1) AS snippet
      FROM chats c WHERE c.user_id=? AND (c.title LIKE ? ESCAPE '\\' OR EXISTS
        (SELECT 1 FROM messages m WHERE m.chat_id=c.id AND m.content LIKE ? ESCAPE '\\'))
      ORDER BY c.updated_at DESC LIMIT 40`).all(like, u.id, like, like);
    sendJson(res, 200, { results: rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at, snippet: r.snippet || '' })) });
  });

  r.post('/api/messages/:id/rating', async (req, res, { params }) => {
    const u = requireUser(req);
    const b = await readJson(req, 1000);
    const rating = b.rating === 1 ? 1 : b.rating === -1 ? -1 : null;
    const m = q('SELECT m.id FROM messages m JOIN chats c ON c.id=m.chat_id WHERE m.id=? AND c.user_id=?').get(params.id, u.id);
    if (!m) throw new HttpError(404, 'Message not found.');
    q('UPDATE messages SET rating=? WHERE id=?').run(rating, m.id);
    sendJson(res, 200, { ok: true });
  });

  // Library of generated images (like ChatGPT's "Images" page)
  r.get('/api/images', (req, res) => {
    const u = requireUser(req);
    const rows = q(`SELECT id, created_at FROM files WHERE user_id=? AND kind='generated' ORDER BY created_at DESC LIMIT 200`).all(u.id);
    sendJson(res, 200, { images: rows.map((f) => ({ url: `/files/${f.id}`, createdAt: f.created_at })) });
  });

  // ---------- private files ----------
  r.get('/files/:id', async (req, res, { params }) => {
    const u = requireUser(req);
    const f = q('SELECT * FROM files WHERE id=? AND user_id=?').get(params.id, u.id);
    if (!f || !/^[\w-]+\.\w+$/.test(f.id)) throw new HttpError(404, 'Not found.');
    const abs = path.join(config.dataDir, 'files', f.id);
    const st = await fs.promises.stat(abs).catch(() => null);
    if (!st) throw new HttpError(404, 'Not found.');
    res.writeHead(200, {
      'Content-Type': f.mime || mimeOf(abs), 'Content-Length': st.size,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Disposition': `inline; filename="${f.id}"`,
    });
    fs.createReadStream(abs).pipe(res);
  });

  // ---------- admin ----------
  r.get('/api/admin/stats', (req, res) => {
    requireAdmin(req);
    const day = new Date().toISOString().slice(0, 10);
    const dayStart = new Date(day).getTime();
    sendJson(res, 200, {
      users: q('SELECT COUNT(*) n FROM users').get().n,
      activeToday: q('SELECT COUNT(*) n FROM users WHERE last_seen_at >= ?').get(dayStart).n,
      chats: q('SELECT COUNT(*) n FROM chats').get().n,
      messagesToday: q('SELECT COALESCE(SUM(msgs),0) n FROM usage WHERE day=?').get(day).n,
      premiumToday: q('SELECT COALESCE(SUM(paid_msgs),0) n FROM usage WHERE day=?').get(day).n,
      imagesToday: q('SELECT COALESCE(SUM(images),0) n FROM usage WHERE day=?').get(day).n,
      imageProviders: imageBackends(),
      engine: engineSnapshot(),
      memoryMb: Math.round(process.memoryUsage().rss / 1048576),
      uptimeSec: Math.round(process.uptime()),
    });
  });

  r.post('/api/admin/models/refresh', async (req, res) => {
    requireAdmin(req);
    const models = await refreshModels();
    sendJson(res, 200, { count: models.length });
  });
}

function deleteChats(userId, chats) {
  if (!chats.length) return;
  const fileIds = [];
  tx(() => {
    for (const c of chats) {
      for (const m of q('SELECT attachments FROM messages WHERE chat_id=? AND attachments IS NOT NULL').all(c.id)) {
        try { for (const a of JSON.parse(m.attachments)) if (a.fileId) fileIds.push(a.fileId); } catch {}
      }
      q('DELETE FROM chats WHERE id=? AND user_id=?').run(c.id, userId);
    }
    for (const id of fileIds) q('DELETE FROM files WHERE id=? AND user_id=?').run(id, userId);
  });
  for (const id of fileIds) fs.promises.unlink(path.join(config.dataDir, 'files', id)).catch(() => {});
}
