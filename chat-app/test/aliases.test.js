// ChatGPT-style model names backed by free models through (a fake) OmniRoute.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const asked = [];
let failGroq = false;
const gateway = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [
        { id: 'groq/llama-3.3-70b-versatile', owned_by: 'groq' },
        { id: 'cerebras/gpt-oss-120b', owned_by: 'cerebras' },
        { id: 'gemini/gemini-2.5-flash', owned_by: 'gemini', input_modalities: ['text', 'image'] },
        { id: 'dva/claude-fable-5-1-max', owned_by: 'devin-cli-agentic' },
      ] }));
      return;
    }
    if (req.url === '/v1/chat/completions') {
      const j = JSON.parse(body);
      asked.push(j.model);
      if (failGroq && j.model.startsWith('groq/')) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'rate limit' } }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ model: j.model, choices: [{ delta: { content: `answer from ${j.model}` } }] })}\n\n`);
      res.end('data: [DONE]\n\n');
      return;
    }
    res.writeHead(404); res.end('{}');
  });
});
await new Promise((r) => gateway.listen(0, '127.0.0.1', r));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aliases-test-'));
Object.assign(process.env, {
  SKIP_DOTENV: '1', DATA_DIR: dir, HOST: '127.0.0.1', ENABLE_POLLINATIONS: 'false', IMAGE_PROMPT_ENHANCE: 'false',
  OMNIROUTE_BASE_URL: `http://127.0.0.1:${gateway.address().port}/v1`,
});
const { start, server } = await import('../server/index.js');
let base, cookie;

before(async () => {
  await start(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const r = await fetch(`${base}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'me@test.dev', password: 'password123' }) });
  cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith('sid='));
});
after(() => { server.close(); server.closeAllConnections?.(); gateway.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function chat(body) {
  const r = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) });
  const text = await r.text();
  const evs = text.split('\n\n').map((b) => ({ ev: /event: (.*)/.exec(b)?.[1], data: /data: (.*)/.exec(b)?.[1] })).filter((e) => e.ev);
  return evs.map((e) => ({ ev: e.ev, data: JSON.parse(e.data) }));
}

test('the app is called ChatGPT Pro and the menu shows ChatGPT model names', async () => {
  const cfg = await (await fetch(`${base}/api/config`)).json();
  assert.equal(cfg.appName, 'ChatGPT Pro');
  const m = await (await fetch(`${base}/api/models`, { headers: { Cookie: cookie } })).json();
  assert.equal(m.aliasMode, true);
  assert.deepEqual(m.models.map((x) => x.name), ['GPT-6.1 Sol', 'GPT-6 Astra', 'GPT-6 Sol', 'GPT-6 Luna', 'GPT-5.1', 'GPT-4o']);
  assert.equal(m.default, 'alias:gpt-6.1-sol');
  assert.ok(m.models.every((x) => x.available));
});

test('a ChatGPT name answers with a free model; the real one is kept for hover', async () => {
  const ev = await chat({ content: 'hi', model: 'alias:gpt-6-luna' });
  const done = ev.find((e) => e.ev === 'done').data.message;
  assert.equal(done.modelName, 'GPT-6 Luna');
  assert.match(done.provider, /GPT-OSS 120B · Cerebras/);
  assert.equal(asked.at(-1), 'cerebras/gpt-oss-120b');
  assert.equal(ev.find((e) => e.ev === 'model').data.name, 'GPT-6 Luna');
});

test('if the first free model fails, the next one answers', async () => {
  failGroq = true;
  const before = asked.length;
  const ev = await chat({ content: 'hello again', model: 'alias:gpt-5.1' }); // GPT-5.1 prefers Llama (Groq)
  const done = ev.find((e) => e.ev === 'done').data.message;
  assert.equal(done.status, 'done');
  assert.equal(done.modelName, 'GPT-5.1');
  assert.ok(asked.slice(before).some((x) => x.startsWith('groq/')), 'tried Groq first');
  assert.ok(!/groq/i.test(done.provider), 'another provider answered');
  failGroq = false;
});

test('unofficial keyless routes are never used', async () => {
  assert.ok(!asked.some((x) => x.startsWith('dva/')));
});
