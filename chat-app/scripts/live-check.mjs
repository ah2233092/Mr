// Live check of the single-file website against the real internet (no mock):
// opens website/index.html in Chrome, signs up, asks a question and asks for an image,
// and prints which free AI endpoints answer without a key.
//   npm i --no-save playwright-core && node scripts/live-check.mjs
// Exits 1 when no text answer comes back.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const summary = [];
const log = (line) => { console.log(line); summary.push(line); };

async function probe(name, url, init = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(60000) });
    const buf = Buffer.from(await r.arrayBuffer());
    const type = r.headers.get('content-type') || '';
    const text = type.startsWith('image/') ? `<${buf.length} bytes image>` : buf.toString('utf8').replace(/\s+/g, ' ').slice(0, 160);
    log(`- ${name}: HTTP ${r.status} ${type.split(';')[0]} in ${Date.now() - t0} ms — ${text}`);
    return r.ok;
  } catch (e) {
    log(`- ${name}: FAILED ${e.message}`);
    return false;
  }
}

const chatBody = (model) => JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with one word: PONG' }] });
const json = { 'Content-Type': 'application/json' };

log('## Free AI endpoints without a key');
await probe('text.pollinations.ai/openai (used by the page)', 'https://text.pollinations.ai/openai', { method: 'POST', headers: json, body: chatBody('openai') });
await probe('text.pollinations.ai GET', 'https://text.pollinations.ai/' + encodeURIComponent('Reply with one word: PONG'));
await probe('image.pollinations.ai (used by the page)', 'https://image.pollinations.ai/prompt/' + encodeURIComponent('a red fox') + '?width=512&height=512&nologo=true&model=flux');
await probe('gen.pollinations.ai/v1/chat/completions', 'https://gen.pollinations.ai/v1/chat/completions', { method: 'POST', headers: json, body: chatBody('openai') });
await probe('gen.pollinations.ai/image', 'https://gen.pollinations.ai/image/' + encodeURIComponent('a red fox') + '?width=512&height=512');

// Which Pollinations text models answer without a key (used to back the menu levels).
try {
  const list = await (await fetch('https://text.pollinations.ai/models', { signal: AbortSignal.timeout(20000) })).json();
  log(`\n## Pollinations text models (${list.length})`);
  for (const m of list.slice(0, 25)) {
    const id = m.name || m.id;
    const t0 = Date.now();
    try {
      const r = await fetch('https://text.pollinations.ai/openai', { method: 'POST', headers: json, body: chatBody(id), signal: AbortSignal.timeout(45000) });
      const j = r.ok ? await r.json().catch(() => ({})) : {};
      const said = (j.choices?.[0]?.message?.content || '').replace(/\s+/g, ' ').slice(0, 30);
      log(`- ${id}: HTTP ${r.status} in ${Date.now() - t0} ms, served "${j.model || '-'}", said "${said}" — ${m.description || ''}${m.reasoning ? ' [reasoning]' : ''}${m.vision || (m.input_modalities || []).includes('image') ? ' [vision]' : ''}${m.tier ? ` tier=${m.tier}` : ''}`);
    } catch (e) { log(`- ${id}: FAILED ${e.message}`); }
    await new Promise((r) => setTimeout(r, 3000));
  }
} catch (e) { log(`- models list FAILED ${e.message}`); }

// ---- the real page in a real browser ----
const html = fs.readFileSync(path.join(ROOT, 'website', 'index.html'));
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const chromium = pw.chromium || pw.default.chromium;
const channel = process.env.CHROME_CHANNEL ?? 'chrome';
const browser = await chromium.launch(channel ? { channel } : {});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let textOk = false;
log('\n## The website in Chrome');
try {
  await page.goto(url);
  await page.waitForSelector('#auth:not([hidden])', { timeout: 20000 });
  await page.click('#authSwitch a');
  await page.fill('#authName', 'Live');
  await page.fill('#authEmail', 'live@check.dev');
  await page.fill('#authPass', 'password123');
  await page.click('#authSubmit');
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  log(`- sign up: OK (header "${(await page.$eval('#modelBtn', (e) => e.innerText)).replace(/\n/g, ' ')}")`);

  // Waits until the n-th assistant message is finished and returns its text and model tag.
  const answer = async (n) => {
    await page.waitForFunction((k) => document.querySelectorAll('.msg.assistant').length >= k
      && !document.querySelector('#sendBtn.streaming'), n, { timeout: 120000, polling: 500 });
    return page.evaluate(() => {
      const el = [...document.querySelectorAll('.msg.assistant')].pop();
      const tag = el.querySelector('.model-tag');
      return { text: el.innerText.replace(/\s+/g, ' ').trim(), tag: tag ? `${tag.textContent} (${tag.title})` : null };
    });
  };

  await page.fill('#input', 'Reply with one word: PONG');
  await page.click('#sendBtn');
  const a1 = await answer(1);
  textOk = !!a1.tag;
  log(`- text reply: ${textOk ? 'OK' : 'NO ANSWER'} — "${a1.text.slice(0, 200)}" — ${a1.tag || 'no model tag'}`);

  await page.fill('#input', 'create an image of a red fox in the snow');
  await page.click('#sendBtn');
  await page.waitForFunction(() => document.querySelectorAll('.msg.assistant').length >= 2, null, { timeout: 30000 });
  const img = await page.waitForFunction(() => {
    const el = [...document.querySelectorAll('.gen-img img')].pop();
    if (!el) return false;
    if (el.complete) return { w: el.naturalWidth, h: el.naturalHeight, src: el.src.slice(0, 120) };
    return false;
  }, null, { timeout: 120000, polling: 1000 }).then((h) => h.jsonValue()).catch((e) => ({ error: e.message.split('\n')[0] }));
  log(`- image: ${img.w ? `OK ${img.w}x${img.h}` : 'FAILED'} — ${JSON.stringify(img)}`);
  await page.screenshot({ path: path.join(ROOT, 'live-check.png') });
} catch (e) {
  log(`- FAILED: ${e.message.split('\n')[0]}`);
} finally {
  if (errors.length) log(`- page errors: ${JSON.stringify(errors)}`);
  await browser.close();
  server.close();
}

if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
process.exit(textOk ? 0 : 1);
