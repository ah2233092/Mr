/* ChatGPT — in-browser backend for the single-file version (index.html).
 * Replaces the Node server so the page works on any static host or opened as a file:
 *  - accounts, chats and settings are stored in this browser (localStorage)
 *  - AI is called straight from the browser: OmniRoute (if reachable), free keys from
 *    CHATGPT_CONFIG, then Pollinations (no key). If one fails, the next one answers.
 * It answers the same /api/* requests the server does, so app.js runs unchanged.
 */
(function () {
  'use strict';
  window.STATIC_MODE = true;
  const CFG = window.CHATGPT_CONFIG || {};
  const KEYS = CFG.keys || {};
  const APP_NAME = CFG.appName || 'ChatGPT';
  const realFetch = window.fetch.bind(window);

  // ---------------- storage ----------------
  const mem = {};
  const ls = {
    get(k, d) { try { const v = localStorage.getItem('cgp:' + k); return v == null ? d : JSON.parse(v); } catch { return k in mem ? mem[k] : d; } },
    set(k, v) { try { localStorage.setItem('cgp:' + k, JSON.stringify(v)); return true; } catch { mem[k] = v; return false; } },
    del(k) { try { localStorage.removeItem('cgp:' + k); } catch { /* ignore */ } delete mem[k]; },
  };
  const now = () => Date.now();
  const uid = () => Math.random().toString(36).slice(2, 10) + now().toString(36);
  const today = () => new Date().toISOString().slice(0, 10);

  async function hashPw(pw, salt) {
    if (window.crypto && crypto.subtle) {
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
      return btoa(String.fromCharCode(...new Uint8Array(bits)));
    }
    let h = 7; for (const c of salt + pw) h = (h * 31 + c.charCodeAt(0)) | 0; // pages without WebCrypto (plain http)
    return 'h' + h;
  }

  const users = () => ls.get('users', {});
  const saveUsers = (u) => ls.set('users', u);
  function currentUser() {
    const id = ls.get('session', null);
    return id ? Object.values(users()).find((u) => u.id === id) || null : null;
  }
  const publicUser = (u) => ({
    id: u.id, email: u.email, name: u.name, avatar: null, customInstructions: u.customInstructions || '',
    settings: u.settings || {}, isAdmin: false, hasPassword: true, createdAt: u.createdAt,
  });
  const chatsOf = (userId) => ls.get('chats:' + userId, []);
  const saveChats = (userId, list) => ls.set('chats:' + userId, list);
  const msgsOf = (chatId) => ls.get('msgs:' + chatId, []);
  function saveMsgs(chatId, list) {
    if (ls.set('msgs:' + chatId, list)) return;
    // Browser storage full: keep the text, drop big pasted photos from history.
    ls.set('msgs:' + chatId, list.map((m) => ({ ...m, attachments: (m.attachments || []).map((a) => (a.type === 'image' && a.url && a.url.startsWith('data:') ? { ...a, url: '' } : a)) })));
  }
  function bumpUsage(userId, field) {
    const k = `usage:${userId}:${today()}`;
    const u = ls.get(k, { msgs: 0, images: 0 });
    u[field] = (u[field] || 0) + 1;
    ls.set(k, u);
  }

  // ---------------- responses ----------------
  const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const fail = (status, message) => json(status, { error: message });
  const body = (init) => { try { return init && init.body ? JSON.parse(init.body) : {}; } catch { return {}; } };

  // ---------------- AI providers (browser) ----------------
  const OFFICIAL = new Set(['openai', 'anthropic', 'gemini', 'vertex', 'groq', 'cerebras', 'openrouter', 'mistral', 'codestral', 'deepseek',
    'xai', 'together', 'fireworks', 'deepinfra', 'nvidia', 'huggingface', 'sambanova', 'novita', 'cohere', 'perplexity', 'cloudflare-ai',
    'ollama-cloud', 'ollama', 'moonshot', 'kimi', 'zai', 'glm', 'minimax', 'alibaba', 'qwen-cloud', 'nebius', 'hyperbolic', 'pollinations']);

  const providers = [];
  const omni = CFG.omniroute || {};
  if (omni.url) {
    providers.push({ id: 'omniroute', label: 'OmniRoute', url: omni.url.replace(/\/+$/, '') + '/chat/completions', key: omni.key || '', models: [], discover: true });
  }
  if (KEYS.groq) {
    providers.push({ id: 'groq', label: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: KEYS.groq, models: [
      { id: 'openai/gpt-oss-120b' }, { id: 'llama-3.3-70b-versatile' }, { id: 'meta-llama/llama-4-scout-17b-16e-instruct', vision: true }, { id: 'llama-3.1-8b-instant' }] });
  }
  if (KEYS.gemini) {
    providers.push({ id: 'gemini', label: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: KEYS.gemini, models: [
      { id: 'gemini-2.5-flash', vision: true }, { id: 'gemini-2.5-flash-lite', vision: true }] });
  }
  if (KEYS.openrouter) {
    providers.push({ id: 'openrouter', label: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions', key: KEYS.openrouter, models: [
      { id: 'openai/gpt-oss-120b:free' }, { id: 'meta-llama/llama-3.3-70b-instruct:free' }, { id: 'deepseek/deepseek-chat-v3.1:free' }], discover: true });
  }
  if (CFG.pollinations !== false) {
    // Without a key Pollinations serves GPT-OSS 20B ("openai-fast"); "openai" is its backup and gets photos.
    providers.push({ id: 'pollinations', label: 'Pollinations', url: 'https://text.pollinations.ai/openai', key: '', models: [
      { id: 'openai-fast', real: 'GPT-OSS 20B', effort: true }, { id: 'openai', real: 'GPT-OSS', vision: true, effort: true }] });
  }
  if (CFG.mock) {
    providers.unshift({ id: 'mock', label: 'Mock', mock: true, models: [{ id: 'mock-fast', vision: true }] });
  }

  async function discover(p) {
    try {
      if (p.id === 'omniroute') {
        const r = await realFetch(omni.url.replace(/\/+$/, '') + '/models', { headers: p.key ? { Authorization: 'Bearer ' + p.key } : {}, signal: AbortSignal.timeout(4000) });
        const j = await r.json();
        p.models = (j.data || []).filter((m) => OFFICIAL.has(String(m.owned_by || '').toLowerCase())
          && !/^(auto|combo)\//.test(m.id) && !(m.output_modalities && !m.output_modalities.includes('text')))
          .map((m) => ({ id: m.id, vision: (m.input_modalities || []).includes('image') }));
      } else if (p.id === 'openrouter') {
        const r = await realFetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(5000) });
        const j = await r.json();
        const free = (j.data || []).filter((m) => m.id.endsWith(':free'))
          .map((m) => ({ id: m.id, vision: (m.architecture?.input_modalities || []).includes('image') }));
        if (free.length) p.models = free.slice(0, 20);
      }
    } catch { /* keep the built-in list */ }
  }
  const ready = Promise.race([Promise.all(providers.filter((p) => p.discover).map(discover)), new Promise((r) => setTimeout(r, 5000))]);

  const allModels = () => providers.flatMap((p) => p.models.map((m) => ({ ...m, key: `${p.id}:${m.id}`, provider: p })));
  const cool = new Map();
  const isCool = (k) => (cool.get(k) || 0) > now();

  function prettyName(id) {
    let s = id.slice(id.lastIndexOf('/') + 1).replace(/:free$/, '');
    s = s.replace(/^gpt-oss/i, 'GPT-OSS').replace(/^gpt-/i, 'GPT-').replace(/-/g, ' ').replace(/\b(\d+(\.\d+)?)b\b/gi, (x) => x.toUpperCase());
    return s.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bInstruct\b|\bVersatile\b/g, '').trim() || id;
  }

  // Same menu as ChatGPT: GPT-6 with its thinking levels, then the older models.
  // Each name is backed by free models (first available answers, then the rest).
  const ALIASES = [
    { id: 'gpt-6-instant', name: 'GPT-6 Instant', short: 'Instant', group: 'GPT-6', description: 'Answers right away', effort: 'low',
      prefer: [/gemini-2\.5-flash(?!-lite)/, /groq:openai\/gpt-oss-120b/, /gpt-oss-120b/, /llama-3\.3-70b/, /pollinations:openai-fast/] },
    { id: 'gpt-6-medium', name: 'GPT-6 Medium', short: 'Medium', group: 'GPT-6', description: 'Thinks a little for better answers', effort: 'medium',
      prefer: [/gpt-oss-120b/, /gemini-2\.5-flash(?!-lite)/, /deepseek/, /llama-3\.3-70b/, /pollinations:openai-fast/] },
    { id: 'gpt-6-high', name: 'GPT-6 High', short: 'High', group: 'GPT-6', description: 'Thinks longer for harder problems', effort: 'high',
      prefer: [/gemini-[2-9][\d.]*-pro/, /deepseek-(r1|reasoner)/, /gpt-oss-120b/, /qwen/, /gemini-2\.5-flash(?!-lite)/, /pollinations:openai-fast/] },
    { id: 'gpt-6-extra-high', name: 'GPT-6 Extra High', short: 'Extra High', group: 'GPT-6', description: 'Thinks the longest for the hardest problems', effort: 'high',
      prefer: [/claude-(opus|sonnet|fable)/, /gemini-[2-9][\d.]*-pro/, /deepseek-(r1|reasoner)/, /gpt-oss-120b/, /gemini-2\.5-flash(?!-lite)/, /pollinations:openai-fast/] },
    { id: 'gpt-6-pro', name: 'GPT-6 Pro', short: 'Pro', group: 'GPT-6', description: 'Research-grade intelligence', effort: 'high',
      prefer: [/claude-(opus|fable)/, /claude-sonnet/, /gemini-[2-9][\d.]*-pro/, /deepseek-(r1|reasoner)/, /gpt-oss-120b/, /gemini-2\.5-flash(?!-lite)/, /pollinations:openai-fast/] },
    { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', group: 'Other models', description: 'Previous flagship', effort: 'medium',
      prefer: [/llama-4-maverick/, /llama-3\.3-70b/, /gemini-2\.5-flash(?!-lite)/, /gpt-oss-120b/, /pollinations:openai-fast/] },
    { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', group: 'Other models', description: 'Balanced and dependable', effort: 'low',
      prefer: [/mistral/, /llama-4-scout/, /llama-3\.3-70b/, /flash-lite/, /pollinations:openai-fast/] },
    { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', group: 'Other models', description: 'Fast for everyday tasks', effort: 'low',
      prefer: [/llama-3\.1-8b/, /flash-lite/, /groq:openai\/gpt-oss-120b/, /pollinations:openai-fast/] },
  ];
  function chainFor(aliasKey, vision) {
    const alias = ALIASES.find((a) => 'alias:' + a.id === aliasKey) || ALIASES[0];
    const pool = allModels().filter((m) => !vision || m.vision);
    const out = [];
    for (const re of alias.prefer) for (const m of pool) if (re.test(m.key) && !out.includes(m)) out.push(m);
    for (const m of pool) if (!out.includes(m)) out.push(m);
    return { alias, chain: [...out.filter((m) => !isCool(m.key) && !isCool(m.provider.id)), ...out.filter((m) => isCool(m.key) || isCool(m.provider.id))] };
  }

  async function* streamModel(m, messages, signal, effort) {
    const p = m.provider;
    if (p.mock) {
      const last = messages[messages.length - 1];
      const asked = typeof last.content === 'string' ? last.content : (last.content.find((c) => c.type === 'text') || {}).text;
      for (const w of `Mock reply: "${String(asked).slice(0, 80)}"`.split(/(?<=\s)/)) {
        await new Promise((r) => setTimeout(r, 15)); if (signal.aborted) return; yield w;
      }
      return;
    }
    const headers = { 'Content-Type': 'application/json' };
    if (p.key) headers.Authorization = 'Bearer ' + p.key;
    const payload = { model: m.id, messages, stream: true };
    // Thinking level from the menu (Instant / Medium / High …) for models that take it.
    if (effort && (m.effort || /gpt-oss/i.test(m.id))) payload.reasoning_effort = effort;
    let r = await realFetch(p.url, { method: 'POST', headers, signal, body: JSON.stringify(payload) });
    if (r.status === 400 && payload.reasoning_effort) {
      delete payload.reasoning_effort;
      r = await realFetch(p.url, { method: 'POST', headers, signal, body: JSON.stringify(payload) });
    }
    if (!r.ok) {
      const e = new Error('HTTP ' + r.status); e.status = r.status; throw e;
    }
    const type = r.headers.get('content-type') || '';
    if (!type.includes('event-stream') || !r.body) {
      const t = await r.text();
      try { const j = JSON.parse(t); const c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content; if (c) { yield c; return; } } catch { /* plain text */ }
      if (t.trim() && !/^\s*[{<]/.test(t)) { yield t; return; }
      throw new Error('empty');
    }
    const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const d = line.slice(5).trim();
        if (d === '[DONE]') return;
        try {
          const j = JSON.parse(d);
          const c = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
          if (c) yield c;
        } catch { /* keep-alive */ }
      }
    }
  }

  function systemPrompt(user, m) {
    let s = `You are ${APP_NAME}, a helpful, friendly and highly capable AI assistant. You are running on the model "${m.real || prettyName(m.id)}". If asked which model you are, say that truthfully. Current date: ${new Date().toDateString()}.
Reply in the user's language and script (Roman Urdu if they write Roman Urdu). Answer first, then details. Use Markdown (headings, lists, tables, fenced code with language). Be accurate; say so when unsure.`;
    if (user.customInstructions) s += `\n\nThe user's custom instructions:\n${user.customInstructions}`;
    return s;
  }

  function history(msgs, m) {
    const out = []; let used = 0;
    for (let i = msgs.length - 1; i >= 0 && out.length < 30; i--) {
      const x = msgs[i];
      if (x.role !== 'user' && x.role !== 'assistant') continue;
      if (x.role === 'assistant' && (x.status === 'error' || !x.content)) continue;
      let text = x.content || '';
      for (const a of x.attachments || []) if (a.type === 'file' && a.text) text += `\n\n[Attached file: ${a.name}]\n\`\`\`\n${a.text}\n\`\`\``;
      if (out.length && used + text.length > 40000) break;
      used += text.length;
      const imgs = x.role === 'user' ? (x.attachments || []).filter((a) => a.type === 'image' && a.url) : [];
      if (imgs.length && m.vision && out.length === 0) {
        out.push({ role: 'user', content: [...imgs.slice(0, 3).map((a) => ({ type: 'image_url', image_url: { url: a.url } })), { type: 'text', text: text || 'Describe this image.' }] });
      } else out.push({ role: x.role, content: text });
    }
    out.reverse();
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }

  // ---------------- images ----------------
  const IMG_EN = /^\s*(?:please\s+|can you\s+|could you\s+)?(?:generate|create|make|draw|design|paint|render|sketch|imagine)\b[^?\n]{0,60}?\b(?:image|picture|photo|pic|logo|poster|wallpaper|illustration|drawing|painting|art(?:work)?|portrait|sketch|icon|banner|thumbnail|avatar|cartoon)s?\b/i;
  const IMG_UR = /\b(?:tasveer|tasvir|tasweer|image|photo|pic|picture|logo|poster|wallpaper|thumbnail)\b[^?\n]{0,50}?\b(?:bana(?:o|do|dein|den|na|ein)?|bna(?:o|do|dein|den)?|banaiye)\b/i;
  const wantsImage = (t) => /^\s*\/(image|img|imagine)\b/i.test(t) || IMG_EN.test(t) || IMG_UR.test(t);
  function imageUrl(prompt) {
    const t = prompt.toLowerCase();
    const aspect = /9:16|portrait|vertical|phone wallpaper|story|poster/.test(t) ? '9:16' : /16:9|landscape|wide|banner|youtube|thumbnail|desktop/.test(t) ? '16:9' : '1:1';
    const [w, h] = { '1:1': [1024, 1024], '16:9': [1344, 768], '9:16': [768, 1344] }[aspect];
    const clean = prompt.replace(/^\s*\/(image|img|imagine)\b/i, '').trim();
    if (CFG.mock) return { url: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" fill="#10a37f"/></svg>'), aspect };
    return { url: `https://image.pollinations.ai/prompt/${encodeURIComponent(clean + ', highly detailed, high quality')}?width=${w}&height=${h}&seed=${Math.floor(Math.random() * 1e9)}&nologo=true&model=flux`, aspect };
  }

  // ---------------- /api/chat (streamed like the server) ----------------
  function chatStream(user, b, init) {
    const action = ['send', 'regenerate', 'edit'].includes(b.action) ? b.action : 'send';
    const content = String(b.content || '').slice(0, 100000);
    let chats = chatsOf(user.id);
    let chat = b.chatId ? chats.find((c) => c.id === b.chatId) : null;
    if (b.chatId && !chat) return fail(404, 'Chat not found.');
    let msgs = chat ? msgsOf(chat.id) : [];
    let isNew = false, userMsg;
    if (action === 'send') {
      if (!content.trim() && !(b.attachments || []).length) return fail(400, 'Message is empty.');
      const atts = (b.attachments || []).slice(0, 10).map((a) => (a.type === 'image'
        ? { type: 'image', url: a.dataUrl, mime: (a.dataUrl.match(/^data:([^;]+)/) || [])[1] || 'image/jpeg', name: a.name || 'image' }
        : { type: 'file', name: a.name || 'file', text: String(a.text || '').slice(0, 120000), chars: String(a.text || '').length }));
      if (!chat) {
        isNew = true;
        const t = (content || (atts[0] && atts[0].name) || 'New chat').replace(/\s+/g, ' ').trim();
        chat = { id: uid(), title: t.length > 48 ? t.slice(0, 46) + '…' : t, pinned: false, updatedAt: now() };
        chats.unshift(chat);
      }
      userMsg = { id: uid(), role: 'user', content, attachments: atts, reasoning: '', status: 'done', note: '', rating: null, createdAt: now() };
      msgs.push(userMsg);
    } else {
      if (!chat) return fail(400, 'chatId is required.');
      let idx;
      if (action === 'edit') {
        idx = msgs.findIndex((m) => m.id === b.messageId && m.role === 'user');
        if (idx < 0) return fail(404, 'Message not found.');
        msgs[idx].content = content;
      } else {
        idx = msgs.map((m) => m.role).lastIndexOf('user');
        if (idx < 0) return fail(400, 'Nothing to regenerate.');
      }
      msgs = msgs.slice(0, idx + 1);
      userMsg = msgs[idx];
    }
    chat.updatedAt = now();
    saveChats(user.id, chats);
    saveMsgs(chat.id, msgs);

    const hasImages = (userMsg.attachments || []).some((a) => a.type === 'image');
    const image = !hasImages && (b.tool === 'image' || (b.tool !== 'chat' && wantsImage(userMsg.content)));
    const ac = new AbortController();
    if (init && init.signal) init.signal.addEventListener('abort', () => ac.abort(), { once: true });
    const enc = new TextEncoder();
    let ctl;
    const stream = new ReadableStream({ start(c) { ctl = c; }, cancel() { ac.abort(); } });
    const send = (ev, data) => { try { ctl.enqueue(enc.encode(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { /* closed */ } };
    const assistantId = uid();
    const finish = (msg) => {
      const list = msgsOf(chat.id); list.push(msg); saveMsgs(chat.id, list);
      send('done', { message: msg });
      if (isNew) send('title', { chatId: chat.id, title: chat.title });
      try { ctl.close(); } catch { /* closed */ }
    };

    (async () => {
      send('start', { chatId: chat.id, isNew, title: chat.title, userMessage: userMsg, assistantId, kind: image ? 'image' : 'chat' });
      if (image) {
        send('image_status', { stage: 'generating' });
        const { url, aspect } = imageUrl(userMsg.content);
        send('image_status', { stage: 'generating', aspect });
        bumpUsage(user.id, 'images');
        finish({ id: assistantId, role: 'assistant', content: '', reasoning: '', attachments: [{ type: 'image', url, aspect, prompt: userMsg.content }],
          model: 'image', modelName: 'GPT Image', provider: 'FLUX · Pollinations', status: 'done', note: '', rating: null, createdAt: now() });
        return;
      }
      await ready;
      const { alias, chain } = chainFor(b.model, hasImages);
      if (!chain.length) {
        send('error', { message: 'No AI is available right now.' });
        finish({ id: assistantId, role: 'assistant', content: '', attachments: [], status: 'error', note: 'No AI is available right now.', createdAt: now() });
        return;
      }
      let text = '', used = null;
      const t0 = now();
      for (const m of chain.slice(0, 8)) {
        if (ac.signal.aborted) break;
        const one = new AbortController();
        const stop = () => one.abort();
        ac.signal.addEventListener('abort', stop, { once: true });
        let timer = setTimeout(stop, 25000);
        try {
          const messages = [{ role: 'system', content: systemPrompt(user, m) }, ...history(msgsOf(chat.id), m)];
          for await (const piece of streamModel(m, messages, one.signal, alias.effort)) {
            clearTimeout(timer); timer = setTimeout(stop, 90000);
            if (!used) { used = m; send('model', { key: b.model, name: alias.name, provider: m.provider.id, providerLabel: m.provider.label, tier: 'free', fallbackFrom: [] }); }
            text += piece; send('delta', { t: piece });
          }
          clearTimeout(timer);
          if (text) break;
          throw new Error('empty');
        } catch (e) {
          clearTimeout(timer);
          if (ac.signal.aborted) break;
          if (text) break; // keep what was already shown
          const st = e && e.status;
          if (st === 401 || st === 403) cool.set(m.provider.id, now() + 600000);
          else cool.set(m.key, now() + (st === 404 || st === 400 ? 600000 : 30000));
          used = null;
        } finally { ac.signal.removeEventListener('abort', stop); }
      }
      const status = ac.signal.aborted ? 'stopped' : text ? 'done' : 'error';
      if (status === 'done') bumpUsage(user.id, 'msgs');
      const note = status === 'error' ? 'Could not get a reply right now. Please try again.' : '';
      if (status === 'error') send('error', { message: note });
      finish({ id: assistantId, role: 'assistant', content: text, reasoning: '', attachments: [], model: b.model,
        modelName: used ? alias.name : null, provider: used ? `${used.real || prettyName(used.id)} · ${used.provider.label}` : null,
        status, note, rating: null, latencyMs: now() - t0, createdAt: now() });
    })();

    return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }

  // ---------------- router ----------------
  async function handle(url, init) {
    const [path, qs] = url.split('?');
    const method = ((init && init.method) || 'GET').toUpperCase();
    const params = new URLSearchParams(qs || '');
    const user = currentUser();
    const need = () => (user ? null : fail(401, 'Please log in.'));

    if (path === '/healthz') return json(200, { ok: true, app: 'chatgpt-personal', name: APP_NAME });
    if (path === '/api/config') return json(200, { appName: APP_NAME, signupEnabled: true, googleEnabled: false, resetEnabled: false, imagesEnabled: true });

    if (path === '/api/auth/signup' && method === 'POST') {
      const b = body(init);
      const email = String(b.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(400, 'Please enter a valid email address.');
      if (String(b.password || '').length < 8) return fail(400, 'Password must be at least 8 characters.');
      const all = users();
      if (all[email]) return fail(409, 'An account with this email already exists. Try logging in.');
      const salt = uid();
      all[email] = { id: uid(), email, name: String(b.name || '').trim() || email.split('@')[0], salt, hash: await hashPw(b.password, salt), createdAt: now(), customInstructions: '', settings: {} };
      saveUsers(all); ls.set('session', all[email].id);
      return json(201, { user: publicUser(all[email]) });
    }
    if (path === '/api/auth/login' && method === 'POST') {
      const b = body(init);
      const u = users()[String(b.email || '').trim().toLowerCase()];
      if (!u || (await hashPw(String(b.password || ''), u.salt)) !== u.hash) return fail(401, 'Incorrect email or password.');
      ls.set('session', u.id);
      return json(200, { user: publicUser(u) });
    }
    if (path === '/api/auth/logout') { ls.del('session'); return json(200, { ok: true }); }
    if (path === '/api/auth/forgot' || path === '/api/auth/reset') return fail(400, 'Password reset is not available in this version.');

    const denied = need(); if (denied) return denied;

    if (path === '/api/me' && method === 'GET') {
      const u = ls.get(`usage:${user.id}:${today()}`, { msgs: 0, images: 0 });
      return json(200, { user: publicUser(user), usage: { messages: u.msgs || 0, premium: 0, images: u.images || 0 }, limits: { messages: 0, premium: 0, images: 0 } });
    }
    if (path === '/api/me' && method === 'PATCH') {
      const b = body(init); const all = users(); const u = all[user.email];
      if (b.name !== undefined) u.name = String(b.name).trim().slice(0, 60) || u.name;
      if (b.customInstructions !== undefined) u.customInstructions = String(b.customInstructions).slice(0, 3000);
      if (b.settings) u.settings = { ...u.settings, ...b.settings };
      saveUsers(all);
      return json(200, { user: publicUser(u) });
    }
    if (path === '/api/me/password' && method === 'POST') {
      const b = body(init); const all = users(); const u = all[user.email];
      if ((await hashPw(String(b.currentPassword || ''), u.salt)) !== u.hash) return fail(400, 'Current password is incorrect.');
      if (String(b.newPassword || '').length < 8) return fail(400, 'Password must be at least 8 characters.');
      u.salt = uid(); u.hash = await hashPw(b.newPassword, u.salt); saveUsers(all);
      return json(200, { ok: true });
    }
    if (path === '/api/me' && method === 'DELETE') {
      const b = body(init); const all = users(); const u = all[user.email];
      if ((await hashPw(String(b.password || ''), u.salt)) !== u.hash) return fail(400, 'Password is incorrect.');
      for (const c of chatsOf(u.id)) ls.del('msgs:' + c.id);
      ls.del('chats:' + u.id); delete all[u.email]; saveUsers(all); ls.del('session');
      return json(200, { ok: true });
    }

    if (path === '/api/models') {
      await ready;
      const any = allModels().length > 0;
      return json(200, {
        default: 'alias:' + ALIASES[0].id, images: true, openaiConfigured: false, isAdmin: false, aliasMode: true,
        models: ALIASES.map((a) => ({ key: 'alias:' + a.id, name: a.name, short: a.short || a.name, provider: 'alias', providerLabel: '', tier: 'free', group: a.group, vision: false, description: a.description, featured: false, available: any })),
      });
    }

    if (path === '/api/chats' && method === 'GET') {
      const list = chatsOf(user.id).slice().sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
      return json(200, { chats: list });
    }
    if (path === '/api/chats' && method === 'DELETE') {
      for (const c of chatsOf(user.id)) ls.del('msgs:' + c.id);
      saveChats(user.id, []);
      return json(200, { ok: true });
    }
    let m = path.match(/^\/api\/chats\/([\w-]+)$/);
    if (m) {
      const chats = chatsOf(user.id); const chat = chats.find((c) => c.id === m[1]);
      if (!chat) return fail(404, 'Chat not found.');
      if (method === 'GET') return json(200, { chat, messages: msgsOf(chat.id) });
      if (method === 'PATCH') {
        const b = body(init);
        if (typeof b.title === 'string' && b.title.trim()) chat.title = b.title.trim().slice(0, 120);
        if (typeof b.pinned === 'boolean') chat.pinned = b.pinned;
        saveChats(user.id, chats); return json(200, { ok: true });
      }
      if (method === 'DELETE') { ls.del('msgs:' + chat.id); saveChats(user.id, chats.filter((c) => c !== chat)); return json(200, { ok: true }); }
    }
    if (path === '/api/search') {
      const q = (params.get('q') || '').toLowerCase().trim();
      const results = [];
      for (const c of chatsOf(user.id)) {
        const hit = msgsOf(c.id).find((x) => (x.content || '').toLowerCase().includes(q));
        if (c.title.toLowerCase().includes(q) || hit) results.push({ id: c.id, title: c.title, updatedAt: c.updatedAt, snippet: hit ? hit.content.slice(0, 300) : '' });
      }
      return json(200, { results: results.slice(0, 40) });
    }
    m = path.match(/^\/api\/messages\/([\w-]+)\/rating$/);
    if (m) {
      const b = body(init);
      for (const c of chatsOf(user.id)) {
        const list = msgsOf(c.id); const x = list.find((y) => y.id === m[1]);
        if (x) { x.rating = b.rating === 1 ? 1 : b.rating === -1 ? -1 : null; saveMsgs(c.id, list); return json(200, { ok: true }); }
      }
      return fail(404, 'Message not found.');
    }
    if (path === '/api/images') {
      const images = [];
      for (const c of chatsOf(user.id)) for (const x of msgsOf(c.id)) for (const a of x.attachments || []) if (x.role === 'assistant' && a.type === 'image') images.push({ url: a.url, createdAt: x.createdAt });
      return json(200, { images: images.sort((a, b) => b.createdAt - a.createdAt) });
    }
    if (path === '/api/lan') return json(200, { urls: [], publicUrl: /^https?:/.test(location.origin) ? location.href.split('#')[0] : null });
    if (path === '/api/chat' && method === 'POST') return chatStream(user, body(init), init);
    if (path.startsWith('/api/admin')) return fail(403, 'Admins only.');
    return fail(404, 'Not found.');
  }

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.startsWith('/api/') || url === '/healthz') return handle(url, init || {});
    return realFetch(input, init);
  };
})();
