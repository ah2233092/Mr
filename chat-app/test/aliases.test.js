// ChatGPT-style model names backed by free models through (a fake) OmniRoute.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const asked = [];
const reqs = []; // {model, effort, said}
// The chat request for a message (the title request comes after it).
const effortFor = (said) => reqs.find((r) => r.said === said)?.effort;
const modelFor = (said) => reqs.find((r) => r.said === said)?.model;
let failGroq = false;
let rejectEffort = false;
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
      reqs.push({ model: j.model, effort: j.reasoning_effort, said: j.messages.at(-1)?.content });
      if (rejectEffort && j.reasoning_effort) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'unsupported parameter: reasoning_effort' } }));
        return;
      }
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

test('the app is called ChatGPT and the menu shows ChatGPT model names', async () => {
  const cfg = await (await fetch(`${base}/api/config`)).json();
  assert.equal(cfg.appName, 'ChatGPT');
  const m = await (await fetch(`${base}/api/models`, { headers: { Cookie: cookie } })).json();
  assert.equal(m.aliasMode, true);
  const names = m.models.map((x) => x.name);
  assert.deepEqual(names.slice(0, 5), ['GPT-6 Instant', 'GPT-6 Medium', 'GPT-6 High', 'GPT-6 Extra High', 'GPT-6 Pro']);
  assert.deepEqual(m.models.slice(0, 5).map((x) => x.short), ['Instant', 'Medium', 'High', 'Extra High', 'Pro']);
  // Every ChatGPT model, A to Z.
  for (const n of ['GPT-6 Astra', 'GPT-6 Sol', 'GPT-6 Luna', 'GPT-6.1 Sol', 'GPT-6.1 Terra', 'GPT-5.6 Sol', 'GPT-5.5 Thinking', 'GPT-5.5 Pro',
    'GPT-5.4 Pro', 'GPT-5.3 Codex', 'GPT-5.2 Thinking', 'GPT-5.1 Instant', 'GPT-5 Pro', 'GPT-5 mini', 'o3-pro', 'o3', 'o4-mini-high', 'o4-mini',
    'o1', 'GPT-4.5', 'GPT-4.1', 'GPT-4o', 'GPT-4o mini', 'GPT-4', 'GPT-3.5']) assert.ok(names.includes(n), n);
  assert.equal(names.length, 44);
  assert.equal(new Set(m.models.map((x) => x.key)).size, 44, 'every entry has its own key');
  assert.deepEqual([...new Set(m.models.map((x) => x.group))], ['GPT-6', 'GPT-6.1', 'GPT-5.6', 'GPT-5.5', 'GPT-5.4', 'GPT-5.3', 'GPT-5.2',
    'GPT-5.1', 'GPT-5', 'o-series', 'GPT-4', 'GPT-3.5']);
  assert.equal(m.default, 'alias:gpt-6-instant');
  assert.ok(m.models.every((x) => x.available));
});

test('a ChatGPT name answers with a free model; the real one is kept for hover', async () => {
  const ev = await chat({ content: 'hi', model: 'alias:gpt-5.6-luna' });
  const done = ev.find((e) => e.ev === 'done').data.message;
  assert.equal(done.modelName, 'GPT-5.6 Luna');
  assert.match(done.provider, /GPT-OSS 120B · Cerebras/);
  assert.equal(asked.at(-1), 'cerebras/gpt-oss-120b');
  assert.equal(effortFor('hi'), 'low');
  assert.equal(ev.find((e) => e.ev === 'model').data.name, 'GPT-5.6 Luna');
});

test('thinking levels send the matching reasoning effort to models that take it', async () => {
  let done = (await chat({ content: 'think hard', model: 'alias:gpt-6-high' })).find((e) => e.ev === 'done').data.message;
  assert.equal(done.modelName, 'GPT-6 High');
  assert.equal(modelFor('think hard'), 'cerebras/gpt-oss-120b');
  assert.equal(effortFor('think hard'), 'high');
  done = (await chat({ content: 'quick one', model: 'alias:gpt-6-instant' })).find((e) => e.ev === 'done').data.message;
  assert.equal(done.modelName, 'GPT-6 Instant');
  assert.equal(modelFor('quick one'), 'gemini/gemini-2.5-flash');
  assert.equal(effortFor('quick one'), undefined, 'no effort for models that do not take it');
});

test('older models answer too (o3 thinks hard, GPT-4o answers fast)', async () => {
  let done = (await chat({ content: 'o3 here', model: 'alias:o3' })).find((e) => e.ev === 'done').data.message;
  assert.equal(done.modelName, 'o3');
  assert.equal(effortFor('o3 here'), 'high');
  done = (await chat({ content: 'four oh', model: 'alias:gpt-4o' })).find((e) => e.ev === 'done').data.message;
  assert.equal(done.modelName, 'GPT-4o');
  assert.equal(modelFor('four oh'), 'gemini/gemini-2.5-flash');
});

test('a provider that rejects the thinking level is asked again without it', async () => {
  rejectEffort = true;
  const done = (await chat({ content: 'retry me', model: 'alias:gpt-6-high' })).find((e) => e.ev === 'done').data.message;
  rejectEffort = false;
  assert.equal(done.status, 'done');
  const tries = reqs.filter((r) => r.said === 'retry me' && r.model === 'cerebras/gpt-oss-120b');
  assert.deepEqual(tries.slice(0, 2).map((r) => r.effort), ['high', undefined]);
  assert.match(done.provider, /Cerebras/);
});

test('if the first free model fails, the next one answers', async () => {
  failGroq = true;
  const before = asked.length;
  const ev = await chat({ content: 'hello again', model: 'alias:gpt-5.6-sol' }); // GPT-5.6 Sol prefers Llama (Groq)
  const done = ev.find((e) => e.ev === 'done').data.message;
  assert.equal(done.status, 'done');
  assert.equal(done.modelName, 'GPT-5.6 Sol');
  assert.ok(asked.slice(before).some((x) => x.startsWith('groq/')), 'tried Groq first');
  assert.ok(!/groq/i.test(done.provider), 'another provider answered');
  failGroq = false;
});

test('unofficial keyless routes are never used', async () => {
  assert.ok(!asked.some((x) => x.startsWith('dva/')));
});
