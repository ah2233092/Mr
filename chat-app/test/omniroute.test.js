// OmniRoute integration: a fake OmniRoute gateway stands in for the real one.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const seen = { auth: [], models: [], images: [] };

// ---- fake OmniRoute ----
const gateway = http.createServer((req, res) => {
  seen.auth.push(req.headers.authorization);
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      // Shape of a real OmniRoute /v1/models: owned_by = upstream provider id.
      res.end(JSON.stringify({ data: [
        { id: 'openai/gpt-6.1-sol', owned_by: 'openai' }, { id: 'openai/gpt-5.1', owned_by: 'openai' },
        { id: 'groq/llama-3.3-70b-versatile', owned_by: 'groq' }, { id: 'cerebras/gpt-oss-120b', owned_by: 'cerebras' },
        { id: 'gemini/gemini-2.5-flash', owned_by: 'gemini', input_modalities: ['text', 'image'] },
        { id: 'auto/fast', owned_by: 'combo' },
        { id: 'pollinations/flux', owned_by: 'pollinations', output_modalities: ['image'] },
        // unofficial keyless routes that must never show up
        { id: 'ddgw/gpt-5.6-luna', owned_by: 'duckduckgo-web' }, { id: 'cxa/gpt-6-astra', owned_by: 'codex-app-server' },
        { id: 'dva/claude-fable-5-1-max', owned_by: 'devin-cli-agentic' }, { id: 'cfp/zai-org/glm-5.2', owned_by: 'cloudflare-playground' },
      ] }));
      return;
    }
    if (req.url === '/v1/chat/completions') {
      const j = JSON.parse(body);
      seen.models.push(j.model);
      const served = j.model;
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      for (const t of ['Hello ', 'from ', served]) {
        res.write(`data: ${JSON.stringify({ model: served, choices: [{ delta: { content: t } }] })}\n\n`);
      }
      res.end('data: [DONE]\n\n');
      return;
    }
    if (req.url === '/v1/images/generations') {
      seen.images.push(JSON.parse(body).model);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ b64_json: PNG }] }));
      return;
    }
    res.writeHead(404); res.end('{}');
  });
});
await new Promise((r) => gateway.listen(0, '127.0.0.1', r));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omniroute-test-'));
Object.assign(process.env, {
  SKIP_DOTENV: '1', DATA_DIR: dir, HOST: '127.0.0.1', ENABLE_POLLINATIONS: 'false',
  OMNIROUTE_BASE_URL: `http://127.0.0.1:${gateway.address().port}/v1`, OMNIROUTE_API_KEY: 'omni-test-key',
  OMNIROUTE_IMAGE_MODEL: 'pollinations/flux', IMAGE_PROMPT_ENHANCE: 'false',
  // backup engine for when the gateway is down
  ENABLE_MOCK: '1', MOCK_TOKEN_DELAY_MS: '1',
});
const { start, server } = await import('../server/index.js');
let base, cookie = '';

before(async () => {
  await start(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const r = await fetch(`${base}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'omni@test.dev', password: 'password123' }) });
  cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith('sid='));
});
after(() => { server.close(); server.closeAllConnections?.(); gateway.close(); fs.rmSync(dir, { recursive: true, force: true }); });

const get = async (p) => (await fetch(base + p, { headers: { Cookie: cookie } })).json();
async function chat(body) {
  const r = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) });
  const text = await r.text();
  return text.split('\n\n').map((b) => ({ ev: /event: (.*)/.exec(b)?.[1], data: /data: (.*)/.exec(b)?.[1] })).filter((e) => e.ev).map((e) => ({ ev: e.ev, data: JSON.parse(e.data) }));
}

test('OmniRoute models show with their real names; unofficial routes are hidden', async () => {
  const m = await get('/api/models');
  const byName = Object.fromEntries(m.models.map((x) => [x.name, x]));
  assert.equal(m.default, 'omniroute:openai/gpt-6.1-sol');
  assert.equal(m.models[0].name, 'GPT-6.1 Sol');
  assert.equal(byName['GPT-6.1 Sol'].group, 'ChatGPT models');
  assert.equal(byName['GPT-OSS 120B'].group, 'OpenAI open models · Free');
  assert.equal(byName['Llama 3.3 70B Versatile'].group, 'Groq · Free');
  assert.ok(!m.models.some((x) => /^auto/.test(x.key.split(':')[1])), 'OmniRoute auto combos are not listed');
  for (const bad of ['ddgw/', 'cxa/', 'dva/', 'cfp/']) assert.ok(!m.models.some((x) => x.key.includes(bad)), `${bad} must be hidden`);
  assert.ok(!m.models.some((x) => x.name === 'GPT-6 Astra'), 'no GPT-6 Astra via the Codex app route');
  assert.equal(byName['Gemini 2.5 Flash'].vision, true);
  assert.equal(byName['Gemini 2.5 Flash'].group, 'Google Gemini · Free');
  assert.ok(!m.models.some((x) => /flux/i.test(x.key)), 'image models are not in the chat list');
  assert.ok(seen.auth.includes('Bearer omni-test-key'));
});

test('Auto picks the fastest official model through OmniRoute', async () => {
  const first = seen.models.length;
  const ev = await chat({ content: 'hello', model: 'auto' });
  const done = ev.find((e) => e.ev === 'done').data.message;
  assert.equal(seen.models[first], 'cerebras/gpt-oss-120b');
  assert.ok(!seen.models.some((x) => /^(ddgw|cxa|dva|cfp|auto)\//.test(x)), 'never routed to unofficial or combo routes');
  assert.equal(done.content, 'Hello from cerebras/gpt-oss-120b');
  assert.equal(done.modelName, 'GPT-OSS 120B');
  assert.equal(done.status, 'done');
});

test('A chosen ChatGPT model is sent to OmniRoute with its route id', async () => {
  const first = seen.models.length;
  const ev = await chat({ content: 'hi', model: 'omniroute:openai/gpt-6.1-sol' });
  const done = ev.find((e) => e.ev === 'done').data.message;
  assert.equal(seen.models[first], 'openai/gpt-6.1-sol');
  assert.equal(done.modelName, 'GPT-6.1 Sol');
});

test('Images are generated through OmniRoute', async () => {
  const ev = await chat({ content: 'create an image of a mountain lake' });
  const done = ev.find((e) => e.ev === 'done').data.message;
  assert.equal(done.attachments[0].type, 'image');
  assert.equal(seen.images.at(-1), 'pollinations/flux');
  assert.equal(done.provider, 'OmniRoute');
});

test('If OmniRoute goes down, the backup engine still answers', async () => {
  await new Promise((r) => { gateway.close(r); gateway.closeAllConnections?.(); });
  const ev = await chat({ content: 'are you there?', model: 'omniroute:openai/gpt-6.1-sol' });
  const done = ev.find((e) => e.ev === 'done').data.message;
  assert.equal(done.status, 'done');
  assert.match(done.modelName, /Mock/);
  assert.match(done.note, /GPT-6.1 Sol wasn't available/);
});

test('Zero-config: first account is admin and can save AI keys from the app', async () => {
  const keys = await get('/api/admin/keys');
  assert.ok(keys.keys.some((k) => k.key === 'GROQ_API_KEY'));
  const omni = keys.keys.find((k) => k.key === 'OMNIROUTE_API_KEY');
  assert.equal(omni.set, true);
  assert.equal(omni.value, '••••-key', 'secrets are masked');
  const r = await fetch(`${base}/api/admin/keys`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ values: { OMNIROUTE_IMAGE_MODEL: 'cloudflare-ai/flux-1-schnell', OMNIROUTE_API_KEY: '••••-key' } }) });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(j.changed, ['OMNIROUTE_IMAGE_MODEL'], 'masked values are ignored');
  assert.equal(process.env.OMNIROUTE_IMAGE_MODEL, 'cloudflare-ai/flux-1-schnell');
  // a second account is not an admin
  const r2 = await fetch(`${base}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'second@test.dev', password: 'password123' }) });
  const c2 = r2.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith('sid='));
  const denied = await fetch(`${base}/api/admin/keys`, { headers: { Cookie: c2 } });
  assert.equal(denied.status, 403);
});
