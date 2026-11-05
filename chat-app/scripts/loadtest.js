// Load test: N users sign up and all send messages at the same moment.
//   node scripts/loadtest.js                    -> boots a local server with the mock AI
//   node scripts/loadtest.js https://your.site   -> tests a running deployment (uses real AI, costs quota!)
// Options: USERS=100 ROUNDS=2
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const USERS = parseInt(process.env.USERS || '100', 10);
const ROUNDS = parseInt(process.env.ROUNDS || '2', 10);
let base = process.argv[2];
let stop = () => {};

if (!base) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sukhan-load-'));
  Object.assign(process.env, {
    SKIP_DOTENV: '1', DATA_DIR: dir, ENABLE_MOCK: '1', ENABLE_POLLINATIONS: 'false', HOST: '127.0.0.1',
    MOCK_TOKEN_DELAY_MS: process.env.MOCK_TOKEN_DELAY_MS || '20', // ~50 tokens/sec per stream, like a real model
    SIGNUPS_PER_IP_PER_HOUR: '100000', PROVIDER_CONCURRENCY: process.env.PROVIDER_CONCURRENCY || '32',
  });
  const { start, server } = await import('../server/index.js');
  await start(0);
  base = `http://127.0.0.1:${server.address().port}`;
  stop = () => { server.close(); server.closeAllConnections?.(); fs.rmSync(dir, { recursive: true, force: true }); };
}

async function signup(i) {
  const email = `load${Date.now()}_${i}@test.dev`;
  const r = await fetch(`${base}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'password123', name: `User ${i}` }) });
  if (!r.ok) throw new Error(`signup ${r.status} ${await r.text()}`);
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith('sid='));
}

async function ask(cookie, chatId, i) {
  const t0 = performance.now();
  let ttft = null, ok = false, newChat = chatId;
  const r = await fetch(`${base}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ chatId, content: `Question ${i}: explain photosynthesis in two lines.`, model: 'auto' }),
  });
  if (!r.ok) return { ok: false, status: r.status, ms: performance.now() - t0 };
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    if (ttft === null && buf.includes('event: delta')) ttft = performance.now() - t0;
    const m = /"chatId":"([\w-]+)"/.exec(buf); if (m) newChat = m[1];
    if (buf.includes('event: done') && /"status":"done"/.test(buf)) ok = true;
  }
  return { ok, ttft, ms: performance.now() - t0, chatId: newChat };
}

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] || 0; };

console.log(`Load test → ${base} · ${USERS} users × ${ROUNDS} rounds, all at once`);
const cookies = await Promise.all(Array.from({ length: USERS }, (_, i) => signup(i)));
const chats = new Array(USERS).fill(null);
let allOk = true;
for (let round = 1; round <= ROUNDS; round++) {
  const t0 = performance.now();
  const res = await Promise.all(cookies.map((c, i) => ask(c, chats[i], i)));
  res.forEach((r, i) => { chats[i] = r.chatId || chats[i]; });
  const ok = res.filter((r) => r.ok);
  const ttfts = ok.map((r) => r.ttft).filter((x) => x != null);
  const totals = ok.map((r) => r.ms);
  console.log(`Round ${round}: ${ok.length}/${USERS} replies OK in ${((performance.now() - t0) / 1000).toFixed(2)}s wall time`);
  console.log(`  first token  p50 ${pct(ttfts, 50).toFixed(0)}ms  p95 ${pct(ttfts, 95).toFixed(0)}ms`);
  console.log(`  full reply   p50 ${pct(totals, 50).toFixed(0)}ms  p95 ${pct(totals, 95).toFixed(0)}ms`);
  const failed = res.filter((r) => !r.ok);
  if (failed.length) { allOk = false; console.log('  failures:', failed.slice(0, 5)); }
}
console.log(`Memory: ${Math.round(process.memoryUsage().rss / 1048576)} MB (server + load generator in one process)`);
stop();
process.exit(allOk ? 0 : 1);
