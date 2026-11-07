// POST /api/chat — the main conversation endpoint. Streams the reply back as
// Server-Sent Events: start → model → delta... → done (or error).
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { q, now, newId, nextSeq, rowToMessage, bumpUsage, getUsage, tx } from '../db.js';
import { HttpError, readJson, startSse } from '../http.js';
import { requireUser } from '../auth.js';
import { WindowLimiter } from '../engine/limiter.js';
import { candidatesFor, getModel, semFor } from '../engine/registry.js';
import { generate, quickComplete } from '../engine/engine.js';
import { looksLikeImageRequest, planImage, generateImage, imageBackends } from '../engine/images.js';
import { prettyName } from '../engine/providers.js';
import { findAlias } from '../engine/aliases.js';

// The name to show for the model that answered. For a gateway "Auto" route,
// use the model the gateway says it actually ran.
function answeredName(m, served) {
  if (!m) return null;
  if (m.autoRoute) return served && !/^auto(\/|$)/i.test(served) ? prettyName(served) : 'Auto';
  return m.name;
}

// Limits are off when set to 0 (default for a personal app).
const perMinute = config.limits.userPerMinute > 0 ? new WindowLimiter(config.limits.userPerMinute, 60_000) : null;
if (perMinute) setInterval(() => perMinute.sweep(), 5 * 60_000).unref();
const inFlight = new Map();

const MAX_IMAGES_PER_MSG = 4;
const MAX_FILE_CHARS = 120_000;
const IMAGE_MIME = /^image\/(png|jpe?g|webp|gif)$/;

function systemPrompt(user, model) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  let s = config.systemPrompt || `You are ${config.appName}, a helpful, friendly and highly capable AI assistant.`;
  s += `\nYou are currently running on the model "${model.name}" (provided by ${model.providerLabel}). If asked which model you are, say exactly that and never claim to be a different model.`;
  s += `\nCurrent date: ${date}.`;
  s += `\n\nHow to answer:
- Reply in the same language and script the user writes in (for example, reply in Roman Urdu when they write Roman Urdu).
- Lead with the answer, then the useful detail. Match length to the question: short questions get short answers.
- Use Markdown when it helps: headings, bullet lists, tables, **bold** key points, and fenced code blocks with a language tag. Use LaTeX ($...$ or $$...$$) for math.
- Be accurate. If you are unsure or the information may be out of date, say so rather than guessing.
- This app can generate images: if the user wants a picture, they can ask "create an image of ..." or use the Create image tool.`;
  if (user.custom_instructions) s += `\n\nThe user's custom instructions (follow them unless unsafe):\n${user.custom_instructions}`;
  return s;
}

function messageText(m) {
  let text = m.content || '';
  for (const a of m.attachments) {
    if (a.type === 'file' && a.text) text += `\n\n[Attached file: ${a.name}]\n\`\`\`\n${a.text}\n\`\`\``;
  }
  return text;
}

// Turn stored history into provider messages, newest first until the budget is used.
function buildHistory(rows, model, budgetChars) {
  const out = [];
  let used = 0;
  let imagesLeft = model.vision ? 4 : 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const m = rows[i];
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    if (m.role === 'assistant' && m.status === 'error') continue;
    let text = m.role === 'assistant' && m.attachments.some((a) => a.type === 'image')
      ? `[I generated an image for this request${m.note ? `: ${m.note}` : ''}]` : messageText(m);
    if (!text && m.role === 'assistant') continue;
    const isLast = out.length === 0;
    if (!isLast && used + text.length > budgetChars) break;
    if (isLast && text.length > budgetChars) text = text.slice(0, budgetChars) + '\n…[truncated]';
    used += text.length;
    if (out.length >= config.context.maxMessages) break;

    const imgs = m.role === 'user' ? m.attachments.filter((a) => a.type === 'image') : [];
    if (imgs.length && imagesLeft > 0) {
      const parts = [];
      for (const a of imgs.slice(0, imagesLeft)) {
        try {
          const buf = fs.readFileSync(path.join(config.dataDir, 'files', a.fileId));
          parts.push({ type: 'image_url', image_url: { url: `data:${a.mime};base64,${buf.toString('base64')}` } });
          imagesLeft--;
        } catch {}
      }
      parts.push({ type: 'text', text: text || 'Describe this image.' });
      out.push({ role: 'user', content: parts });
    } else {
      if (imgs.length) text = `[The user attached ${imgs.length} image(s) that this model cannot see]\n${text}`;
      out.push({ role: m.role, content: text });
    }
  }
  out.reverse();
  // Providers expect the conversation to start with a user turn.
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

async function saveAttachments(userId, attachments) {
  const out = [];
  if (!Array.isArray(attachments)) return out;
  let images = 0;
  for (const a of attachments.slice(0, 10)) {
    if (a?.type === 'image' && typeof a.dataUrl === 'string') {
      if (++images > MAX_IMAGES_PER_MSG) continue;
      const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(a.dataUrl);
      if (!m || !IMAGE_MIME.test(m[1])) throw new HttpError(400, 'Unsupported image type.');
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 8 * 1024 * 1024) throw new HttpError(413, 'Image is too large (max 8 MB).');
      const ext = m[1].split('/')[1].replace('jpeg', 'jpg');
      const fileId = `${newId(16)}.${ext}`;
      await fs.promises.writeFile(path.join(config.dataDir, 'files', fileId), buf);
      q('INSERT INTO files(id, user_id, mime, kind, bytes, created_at) VALUES(?,?,?,?,?,?)').run(fileId, userId, m[1], 'upload', buf.length, now());
      out.push({ type: 'image', fileId, url: `/files/${fileId}`, mime: m[1], name: String(a.name || 'image').slice(0, 120) });
    } else if (a?.type === 'file' && typeof a.text === 'string') {
      out.push({ type: 'file', name: String(a.name || 'file').slice(0, 120), text: a.text.slice(0, MAX_FILE_CHARS), chars: a.text.length });
    }
  }
  return out;
}

function fallbackTitle(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > 48 ? t.slice(0, 46).trimEnd() + '…' : (t || 'New chat');
}

async function makeTitle(text) {
  // Under heavy load, skip the extra AI call: the main answers matter more.
  const first = candidatesFor('auto')[0];
  if (!first || semFor(first.provider).free < 2) return null;
  const out = await quickComplete(
    'Write a short title (2-6 words) for a chat that starts with the user message below. Use the same language as the message. Reply with the title only — no quotes, no punctuation at the end.',
    String(text).slice(0, 1500), { timeoutMs: 6000 });
  if (!out) return null;
  const t = out.split('\n')[0].replace(/^["'#*\s]+|["'*.\s]+$/g, '').trim();
  return t && t.length <= 80 ? t : null;
}

export function registerChat(r) {
  r.post('/api/chat', async (req, res) => {
    const user = requireUser(req);
    const b = await readJson(req);
    const action = ['send', 'regenerate', 'edit'].includes(b.action) ? b.action : 'send';
    const content = String(b.content ?? '').slice(0, 100_000);
    const modelKey = typeof b.model === 'string' ? b.model : 'auto';

    // ---- per-user limits ----
    const usage = getUsage(user.id);
    if (config.limits.userPerDay > 0 && usage.msgs >= config.limits.userPerDay) throw new HttpError(429, `You reached today's limit of ${config.limits.userPerDay} messages. It resets at midnight (UTC).`);
    if (config.limits.userConcurrent > 0 && (inFlight.get(user.id) || 0) >= config.limits.userConcurrent) throw new HttpError(429, 'Please wait for the current reply to finish.');
    const rl = perMinute ? perMinute.check(user.id) : { ok: true };
    if (!rl.ok) throw new HttpError(429, `You're sending messages too fast. Try again in ${Math.ceil(rl.retryInMs / 1000)}s.`);

    // ---- chat + user message bookkeeping ----
    let chat = b.chatId ? q('SELECT * FROM chats WHERE id=? AND user_id=?').get(b.chatId, user.id) : null;
    if (b.chatId && !chat) throw new HttpError(404, 'Chat not found.');
    let isNew = false;
    let userMsg = null;

    if (action === 'send') {
      if (!content.trim() && !(b.attachments || []).length) throw new HttpError(400, 'Message is empty.');
      const atts = await saveAttachments(user.id, b.attachments);
      tx(() => {
        if (!chat) {
          isNew = true;
          chat = { id: newId(), title: fallbackTitle(content || atts[0]?.name) };
          q('INSERT INTO chats(id, user_id, title, created_at, updated_at) VALUES(?,?,?,?,?)').run(chat.id, user.id, chat.title, now(), now());
        }
        const id = newId();
        q('INSERT INTO messages(id, chat_id, seq, role, content, attachments, created_at) VALUES(?,?,?,?,?,?,?)')
          .run(id, chat.id, nextSeq(chat.id), 'user', content, atts.length ? JSON.stringify(atts) : null, now());
        userMsg = rowToMessage(q('SELECT * FROM messages WHERE id=?').get(id));
      });
    } else {
      if (!chat) throw new HttpError(400, 'chatId is required.');
      tx(() => {
        let target;
        if (action === 'edit') {
          target = q(`SELECT * FROM messages WHERE id=? AND chat_id=? AND role='user'`).get(String(b.messageId || ''), chat.id);
          if (!target) throw new HttpError(404, 'Message not found.');
          if (!content.trim()) throw new HttpError(400, 'Message is empty.');
          q('UPDATE messages SET content=? WHERE id=?').run(content, target.id);
        } else {
          target = q(`SELECT * FROM messages WHERE chat_id=? AND role='user' ORDER BY seq DESC LIMIT 1`).get(chat.id);
          if (!target) throw new HttpError(400, 'Nothing to regenerate.');
        }
        q('DELETE FROM messages WHERE chat_id=? AND seq > ?').run(chat.id, target.seq);
        userMsg = rowToMessage(q('SELECT * FROM messages WHERE id=?').get(target.id));
      });
    }
    q('UPDATE chats SET updated_at=? WHERE id=?').run(now(), chat.id);

    // ---- decide: image generation or chat ----
    const hasImages = userMsg.attachments.some((a) => a.type === 'image');
    const wantsImage = !hasImages && (b.tool === 'image' || (b.tool !== 'chat' && looksLikeImageRequest(userMsg.content)));

    inFlight.set(user.id, (inFlight.get(user.id) || 0) + 1);
    const ctrl = new AbortController();
    res.on('close', () => { if (!res.writableFinished) ctrl.abort(); });
    const sse = startSse(res);
    const assistantId = newId();
    sse.send('start', { chatId: chat.id, isNew, title: chat.title, userMessage: userMsg, assistantId, kind: wantsImage ? 'image' : 'chat' });

    // The title is made once the answer has started, so it never delays the first word.
    let titlePromise = null;
    const startTitle = () => { if (isNew && !titlePromise) titlePromise = makeTitle(userMsg.content || 'Image'); };
    const finishTitle = async () => {
      if (!isNew) return;
      startTitle();
      const t = await Promise.race([titlePromise, new Promise((r) => setTimeout(() => r(null), 2500))]);
      if (t) { q('UPDATE chats SET title=? WHERE id=?').run(t, chat.id); sse.send('title', { chatId: chat.id, title: t }); }
    };

    try {
      if (wantsImage) await runImage({ user, chat, userMsg, assistantId, sse, signal: ctrl.signal });
      else await runText({ user, chat, userMsg, assistantId, modelKey, hasImages, sse, signal: ctrl.signal, onStarted: startTitle });
      await finishTitle();
    } catch (e) {
      console.error('[chat]', e);
      sse.send('error', { message: e.expose ? e.message : 'Something went wrong. Please try again.' });
    } finally {
      const n = (inFlight.get(user.id) || 1) - 1;
      if (n <= 0) inFlight.delete(user.id); else inFlight.set(user.id, n);
      sse.end();
    }
  });
}

async function runText({ user, chat, userMsg, assistantId, modelKey, hasImages, sse, signal, onStarted }) {
  let notice = '';
  // ChatGPT-style menu name (see engine/aliases.js): shown everywhere, real model on hover.
  const alias = findAlias(modelKey);
  let chosen = !alias && modelKey !== 'auto' ? getModel(modelKey) : null;
  if (!alias && modelKey !== 'auto' && !chosen) notice = 'The selected model is no longer available, so Auto was used.';
  if (chosen?.tier === 'paid' && config.limits.paidPerDay > 0 && getUsage(user.id).paid_msgs >= config.limits.paidPerDay) {
    notice = `You used today's ${config.limits.paidPerDay} premium messages, so a free model answered. Premium resets at midnight (UTC).`;
    chosen = null;
  }
  if (hasImages && chosen && !chosen.vision) notice = `${chosen.name} can't see images, so a vision model answered.`;
  if (notice) sse.send('notice', { message: notice });

  const rows = q('SELECT * FROM messages WHERE chat_id=? ORDER BY seq').all(chat.id).map(rowToMessage);
  const candidates = candidatesFor(alias ? modelKey : chosen ? chosen.key : 'auto', { vision: hasImages });
  if (!candidates.length) {
    const err = new Error(hasImages ? 'No vision-capable model is configured, so images can’t be read yet.' : 'No AI is connected yet. Add a free key (Groq, Gemini or Cerebras) in the hosting settings, or connect a provider in OmniRoute — see DEPLOY.md. It shows up here within a few minutes.');
    err.expose = true; throw err;
  }

  // Batch tiny token events (every ~30ms) to keep the stream light.
  let pending = '', pendingR = '', flushTimer = null;
  const flush = () => {
    flushTimer = null;
    if (pendingR) { sse.send('reasoning', { t: pendingR }); pendingR = ''; }
    if (pending) { sse.send('delta', { t: pending }); pending = ''; }
  };
  const schedule = () => { if (!flushTimer) flushTimer = setTimeout(flush, 30); };

  const result = await generate({
    candidates, signal, hadImages: hasImages,
    buildMessages: (m) => [{ role: 'system', content: systemPrompt(user, m) }, ...buildHistory(rows, m, config.context.maxChars)],
    onModel: (m, tried, served) => {
      sse.send('model', {
        key: alias ? modelKey : m.key, name: alias ? alias.name : answeredName(m, served), provider: m.provider, providerLabel: m.providerLabel, tier: m.tier,
        // Only mention a fallback when the user picked a specific model.
        fallbackFrom: chosen && tried[0]?.key === chosen.key ? [chosen.name] : [],
      });
      onStarted?.();
    },
    onText: (t) => { pending += t; schedule(); },
    onReasoning: (t) => { pendingR += t; schedule(); },
    onReset: () => { clearTimeout(flushTimer); flushTimer = null; pending = ''; pendingR = ''; sse.send('reset', {}); },
  });
  clearTimeout(flushTimer); flush();

  const m = result.model;
  let status = 'done', note = '';
  if (result.aborted) status = 'stopped';
  else if (result.partial) { status = 'partial'; note = 'The model stopped early because of a connection problem.'; }
  else if (!m || result.error) {
    status = 'error';
    note = result.error?.kind === 'rate_limit' || /busy/.test(result.error?.message || '')
      ? 'All AI models are busy right now. Please try again in a few seconds.'
      : 'Could not get a reply from any AI model right now. Please try again.';
  }

  if (m && chosen && result.tried?.[0]?.key === chosen.key && status !== 'error' && !notice) {
    note = `${result.tried[0].name} wasn't available right now, so ${answeredName(m, result.served)} answered.`;
  }
  if (m && result.text) {
    bumpUsage(user.id, 'msgs');
    if (m.tier === 'paid') bumpUsage(user.id, 'paid_msgs');
  }
  q(`INSERT INTO messages(id, chat_id, seq, role, content, reasoning, model, model_name, provider, status, note, latency_ms, created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(assistantId, chat.id, nextSeq(chat.id), 'assistant', result.text || '', result.reasoning || null,
    m?.key || null, alias && m ? alias.name : answeredName(m, result.served),
    alias && m ? `${answeredName(m, result.served)} · ${m.providerLabel}` : (m?.providerLabel || null),
    status, note || (notice || null), result.latencyMs || null, now());
  q('UPDATE chats SET updated_at=? WHERE id=?').run(now(), chat.id);
  const saved = rowToMessage(q('SELECT * FROM messages WHERE id=?').get(assistantId));
  if (status === 'error') sse.send('error', { message: note, message_id: assistantId });
  sse.send('done', { message: saved });
}

async function runImage({ user, chat, userMsg, assistantId, sse, signal }) {
  const usage = getUsage(user.id);
  const fail = (msg) => {
    q(`INSERT INTO messages(id, chat_id, seq, role, content, status, note, created_at) VALUES(?,?,?,?,?,?,?,?)`)
      .run(assistantId, chat.id, nextSeq(chat.id), 'assistant', '', 'error', msg, now());
    sse.send('error', { message: msg });
    sse.send('done', { message: rowToMessage(q('SELECT * FROM messages WHERE id=?').get(assistantId)) });
  };
  if (!imageBackends().length) return fail('Image generation is not configured on this server yet.');
  if (config.limits.imagesPerDay > 0 && usage.images >= config.limits.imagesPerDay) return fail(`You reached today's limit of ${config.limits.imagesPerDay} images. It resets at midnight (UTC).`);

  sse.send('image_status', { stage: 'planning' });
  const plan = await planImage(userMsg.content);
  if (signal.aborted) return;
  sse.send('image_status', { stage: 'generating', aspect: plan.aspect });
  const t0 = Date.now();
  let img;
  try {
    img = await generateImage({ userId: user.id, prompt: plan.prompt, aspect: plan.aspect, signal });
  } catch (e) {
    if (signal.aborted) return;
    return fail('Could not create the image right now — the image engines are busy. Please try again.');
  }
  bumpUsage(user.id, 'images');
  const att = [{ type: 'image', fileId: img.fileId, url: img.url, mime: img.mime, aspect: img.aspect, prompt: plan.prompt }];
  q(`INSERT INTO messages(id, chat_id, seq, role, content, attachments, model, model_name, provider, status, note, latency_ms, created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(assistantId, chat.id, nextSeq(chat.id), 'assistant', '', JSON.stringify(att),
    `${img.provider}:${img.model}`, img.model, img.providerLabel, 'done', plan.prompt.slice(0, 300), Date.now() - t0, now());
  q('UPDATE chats SET updated_at=? WHERE id=?').run(now(), chat.id);
  sse.send('done', { message: rowToMessage(q('SELECT * FROM messages WHERE id=?').get(assistantId)) });
}
