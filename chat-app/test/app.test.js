// Integration tests: boots the real server with the mock AI provider.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sukhan-test-'));
Object.assign(process.env, {
  SKIP_DOTENV: '1', DATA_DIR: dir, ENABLE_MOCK: '1', ENABLE_POLLINATIONS: 'false', MOCK_TOKEN_DELAY_MS: '1',
  ADMIN_EMAILS: 'admin@test.dev', HOST: '127.0.0.1', IMAGE_PROMPT_ENHANCE: 'true',
  // Fixed ChatGPT model list (no network discovery) to check menu order + default.
  OPENAI_API_KEY: 'sk-test-dummy', OPENAI_MODELS: 'gpt-5-mini,gpt-6-sol,gpt-5.1,gpt-6.1-sol', OPENAI_IMAGES: 'false',
});
const { start, server } = await import('../server/index.js');
let base;

before(async () => { await start(0); base = `http://127.0.0.1:${server.address().port}`; });
after(() => { server.close(); server.closeAllConnections?.(); fs.rmSync(dir, { recursive: true, force: true }); });

function client() {
  let cookie = '';
  return async function call(p, { method = 'GET', body, headers = {} } = {}) {
    const r = await fetch(base + p, {
      method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined, redirect: 'manual',
    });
    const sc = r.headers.getSetCookie?.() || [];
    for (const c of sc) { const kv = c.split(';')[0]; if (kv.startsWith('sid=')) cookie = kv.endsWith('=') ? '' : kv; }
    const type = r.headers.get('content-type') || '';
    if (type.includes('event-stream')) return { status: r.status, events: parseSse(await r.text()) };
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text };
  };
}
function parseSse(text) {
  return text.split('\n\n').filter(Boolean).map((b) => {
    const ev = /event: (.*)/.exec(b)?.[1]; const data = /data: (.*)/.exec(b)?.[1];
    return ev ? { ev, data: data ? JSON.parse(data) : null } : null;
  }).filter(Boolean);
}

test('auth: signup, duplicate, wrong password, login, logout', async () => {
  const a = client();
  let r = await a('/api/auth/signup', { method: 'POST', body: { email: 'Sara@Test.dev', password: 'password123', name: 'Sara' } });
  assert.equal(r.status, 201);
  assert.equal(r.json.user.email, 'sara@test.dev');
  r = await a('/api/me'); assert.equal(r.status, 200); assert.equal(r.json.user.name, 'Sara');
  r = await client()('/api/auth/signup', { method: 'POST', body: { email: 'sara@test.dev', password: 'password123' } });
  assert.equal(r.status, 409);
  r = await client()('/api/auth/signup', { method: 'POST', body: { email: 'x@test.dev', password: 'short' } });
  assert.equal(r.status, 400);
  const b = client();
  r = await b('/api/auth/login', { method: 'POST', body: { email: 'sara@test.dev', password: 'wrongpass1' } });
  assert.equal(r.status, 401);
  r = await b('/api/auth/login', { method: 'POST', body: { email: 'sara@test.dev', password: 'password123' } });
  assert.equal(r.status, 200);
  r = await b('/api/auth/logout', { method: 'POST' });
  r = await b('/api/me'); assert.equal(r.status, 401);
});

test('security: unauthenticated and cross-site requests are refused', async () => {
  const c = client();
  assert.equal((await c('/api/chats')).status, 401);
  await c('/api/auth/signup', { method: 'POST', body: { email: 'csrf@test.dev', password: 'password123' } });
  const r = await c('/api/chats', { method: 'DELETE', headers: { Origin: 'https://evil.example' } });
  assert.equal(r.status, 403);
  const h = await fetch(base + '/');
  assert.match(h.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});

test('chat: streams a reply, saves history, titles the chat', async () => {
  const c = client();
  await c('/api/auth/signup', { method: 'POST', body: { email: 'chat@test.dev', password: 'password123' } });
  const models = await c('/api/models');
  assert.ok(models.json.models.length >= 1);
  const r = await c('/api/chat', { method: 'POST', body: { content: 'Hello there', model: 'auto' } });
  assert.equal(r.status, 200);
  const evs = r.events.map((e) => e.ev);
  assert.deepEqual([evs[0], evs[1]], ['start', 'model']);
  assert.ok(evs.includes('delta'));
  assert.ok(evs.includes('done'));
  const start = r.events[0].data;
  const done = r.events.find((e) => e.ev === 'done').data.message;
  assert.equal(done.status, 'done');
  assert.match(done.content, /Hello there/);
  const text = r.events.filter((e) => e.ev === 'delta').map((e) => e.data.t).join('');
  assert.equal(text, done.content);
  const chat = await c(`/api/chats/${start.chatId}`);
  assert.equal(chat.json.messages.length, 2);
  assert.equal(chat.json.chat.title, 'Mock chat title');

  // regenerate replaces the last answer
  const rg = await c('/api/chat', { method: 'POST', body: { action: 'regenerate', chatId: start.chatId } });
  assert.ok(rg.events.some((e) => e.ev === 'done'));
  assert.equal((await c(`/api/chats/${start.chatId}`)).json.messages.length, 2);

  // edit rewrites the user message and drops later messages
  const ed = await c('/api/chat', { method: 'POST', body: { action: 'edit', chatId: start.chatId, messageId: start.userMessage.id, content: 'Edited question' } });
  assert.match(ed.events.find((e) => e.ev === 'done').data.message.content, /Edited question/);
  const after = (await c(`/api/chats/${start.chatId}`)).json.messages;
  assert.equal(after.length, 2);
  assert.equal(after[0].content, 'Edited question');

  // search, rename, pin, delete
  const s = await c('/api/search?q=Edited');
  assert.equal(s.json.results[0].id, start.chatId);
  assert.equal((await c(`/api/chats/${start.chatId}`, { method: 'PATCH', body: { title: 'Renamed', pinned: true } })).status, 200);
  const list = await c('/api/chats');
  assert.equal(list.json.chats[0].title, 'Renamed');
  assert.equal(list.json.chats[0].pinned, true);
  assert.equal((await c(`/api/chats/${start.chatId}`, { method: 'DELETE' })).status, 200);
  assert.equal((await c(`/api/chats/${start.chatId}`)).status, 404);
});

test('chat: other users cannot read my chats or files', async () => {
  const a = client(), b = client();
  await a('/api/auth/signup', { method: 'POST', body: { email: 'owner@test.dev', password: 'password123' } });
  await b('/api/auth/signup', { method: 'POST', body: { email: 'thief@test.dev', password: 'password123' } });
  const r = await a('/api/chat', { method: 'POST', body: { content: 'draw an image of a cat' } });
  const done = r.events.find((e) => e.ev === 'done').data.message;
  const chatId = r.events[0].data.chatId;
  assert.equal(r.events[0].data.kind, 'image');
  const url = done.attachments[0].url;
  assert.equal((await a(url)).status, 200);
  assert.equal((await b(url)).status, 404);
  assert.equal((await b(`/api/chats/${chatId}`)).status, 404);
});

test('chat: images attached go to a vision model', async () => {
  const c = client();
  await c('/api/auth/signup', { method: 'POST', body: { email: 'vision@test.dev', password: 'password123' } });
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const r = await c('/api/chat', { method: 'POST', body: { content: 'What is this?', model: 'mock:mock-fast', attachments: [{ type: 'image', dataUrl: png, name: 'a.png' }] } });
  const model = r.events.find((e) => e.ev === 'model').data;
  assert.equal(model.key, 'mock:mock-vision');
  assert.ok(r.events.some((e) => e.ev === 'notice'));
});

test('engine: falls back to another model when one fails, and reports it', async () => {
  const c = client();
  await c('/api/auth/signup', { method: 'POST', body: { email: 'fallback@test.dev', password: 'password123' } });
  const r = await c('/api/chat', { method: 'POST', body: { content: '__fail__ please', model: 'mock:mock-fast' } });
  const done = r.events.find((e) => e.ev === 'done').data.message;
  // mock fails on "__fail__" for every model -> clean error, no crash
  assert.equal(done.status, 'error');
  assert.ok(r.events.some((e) => e.ev === 'error'));
});

test('admin: stats are admin-only', async () => {
  const u = client(), a = client();
  await u('/api/auth/signup', { method: 'POST', body: { email: 'user@test.dev', password: 'password123' } });
  await a('/api/auth/signup', { method: 'POST', body: { email: 'admin@test.dev', password: 'password123' } });
  assert.equal((await u('/api/admin/stats')).status, 403);
  const s = await a('/api/admin/stats');
  assert.equal(s.status, 200);
  assert.ok(s.json.users >= 2);
});

test('units: model naming, ranking, image intent, semaphore', async () => {
  const { prettyName, rankModel } = await import('../server/engine/providers.js');
  const { looksLikeImageRequest } = await import('../server/engine/images.js');
  const { Semaphore } = await import('../server/engine/limiter.js');
  assert.equal(prettyName('gpt-6-astra'), 'GPT-6 Astra');
  assert.equal(prettyName('openai/gpt-oss-120b'), 'GPT-OSS 120B');
  assert.equal(prettyName('llama-3.3-70b-versatile'), 'Llama 3.3 70B Versatile');
  assert.equal(prettyName('meta-llama/llama-3.3-70b-instruct:free'), 'Llama 3.3 70B');
  assert.ok(rankModel('gpt-6-sol') > rankModel('gpt-5.1') && rankModel('gpt-5.1') > rankModel('gpt-oss-20b'));
  assert.ok(looksLikeImageRequest('Create an image of a lion'));
  assert.ok(looksLikeImageRequest('ek sher ki tasveer banao'));
  assert.ok(looksLikeImageRequest('/image sunset'));
  assert.ok(!looksLikeImageRequest('How do I create an API in Node?'));
  assert.ok(!looksLikeImageRequest('what is an image sensor'));
  const sem = new Semaphore(2);
  const r1 = await sem.acquire(); const r2 = await sem.acquire();
  let got = false; const p = sem.acquire().then((r) => { got = true; return r; });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(got, false); r1(); const r3 = await p; assert.equal(got, true);
  await assert.rejects(sem.acquire({ timeoutMs: 20 }), /queue timeout/);
  r2(); r3();
  assert.equal(sem.active, 0);
});

test('models: ChatGPT models come first, newest is the default', async () => {
  const c = client();
  await c('/api/auth/signup', { method: 'POST', body: { email: 'models@test.dev', password: 'password123' } });
  const r = await c('/api/models');
  assert.equal(r.json.default, 'openai:gpt-6.1-sol');
  const names = r.json.models.filter((m) => m.group === 'ChatGPT models').map((m) => m.name);
  assert.deepEqual(names, ['GPT-6.1 Sol', 'GPT-6 Sol', 'GPT-5.1', 'GPT-5 Mini']);
  assert.equal(r.json.models[0].group, 'ChatGPT models');
});

test('limits: none by default (25 quick messages all go through)', async () => {
  const c = client();
  await c('/api/auth/signup', { method: 'POST', body: { email: 'unlimited@test.dev', password: 'password123' } });
  const me = await c('/api/me');
  assert.deepEqual(me.json.limits, { messages: 0, premium: 0, images: 0 });
  let chatId;
  for (let i = 0; i < 25; i++) {
    const r = await c('/api/chat', { method: 'POST', body: { chatId, content: `msg ${i}`, model: 'mock:mock-fast' } });
    assert.equal(r.status, 200, `message ${i} was refused`);
    chatId = r.events[0].data.chatId;
  }
});
