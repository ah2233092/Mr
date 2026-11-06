// ChatGPT (personal) — client app (vanilla JS, no build step).
/* global marked, DOMPurify, hljs */

// ---------------- utilities ----------------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (id, cls = 'i') => `<svg class="${cls}"><use href="#${id}"/></svg>`;
const isTouch = () => matchMedia('(hover: none) and (pointer: coarse)').matches;
const isMobile = () => matchMedia('(max-width: 768px)').matches;
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

function toast(msg, isErr = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, isErr ? 4000 : 2200);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}

// ---------------- state ----------------
const S = {
  config: { appName: 'ChatGPT' }, me: null, usage: null, limits: null,
  models: [], imagesEnabled: false, openaiConfigured: false, chats: [], chatId: null, messages: [],
  model: store.get('model', null), tool: null, attachments: [], streaming: null,
  sendOnEnter: store.get('sendOnEnter', '1') === '1',
};

// ---------------- API ----------------
async function api(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(path, {
    method, signal, credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status === 401 && !path.startsWith('/api/auth') && path !== '/api/me') { showAuth('login'); }
  if (!res.ok) { const e = new Error(data?.error || `Request failed (${res.status})`); e.status = res.status; throw e; }
  return data;
}

// ---------------- theme ----------------
function themePref() { return store.get('theme', 'system'); }
function applyTheme(pref = themePref()) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());

// ---------------- markdown ----------------
let streamingRender = false;
marked.use({
  gfm: true, breaks: true,
  renderer: {
    code({ text, lang }) {
      const language = String(lang || '').trim().split(/\s+/)[0].toLowerCase();
      let html;
      try {
        if (language && hljs.getLanguage(language)) html = hljs.highlight(text, { language, ignoreIllegals: true }).value;
        else if (!streamingRender && text.length < 8000) html = hljs.highlightAuto(text).value;
        else html = esc(text);
      } catch { html = esc(text); }
      return `<div class="code-block"><div class="code-head"><span>${esc(language || 'code')}</span><button type="button" class="copy-code">${icon('i-copy')}<span>Copy code</span></button></div><pre><code class="hljs">${html}</code></pre></div>`;
    },
  },
});
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('href')) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
});

let katexState = 'idle';
function ensureKatex() {
  if (katexState !== 'idle') return;
  katexState = 'loading';
  const base = 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/';
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = base + 'katex.min.css'; document.head.appendChild(link);
  const s = document.createElement('script'); s.src = base + 'katex.min.js';
  s.onload = () => { katexState = 'ready'; if (!S.streaming) renderThread(); };
  s.onerror = () => { katexState = 'failed'; };
  document.head.appendChild(s);
}

function extractMath(src) {
  const maths = [];
  const ph = (tex, display, raw) => { maths.push({ tex, display, raw }); return `MATHPH${maths.length - 1}X`; };
  const parts = src.split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i]
      .replace(/\$\$([\s\S]+?)\$\$/g, (m, a) => ph(a, true, m))
      .replace(/\\\[([\s\S]+?)\\\]/g, (m, a) => ph(a, true, m))
      .replace(/\\\(([\s\S]+?)\\\)/g, (m, a) => ph(a, false, m))
      .replace(/(^|[^\\$\w])\$(?=\S)([^$\n]+?)(?<=\S)\$(?![\w$])/g, (m, pre, a) => (/^\d+([.,]\d+)?$/.test(a) ? m : pre + ph(a, false, m.slice(pre.length))));
  }
  return { text: parts.join(''), maths };
}

function renderMarkdown(src, streaming = false) {
  streamingRender = streaming;
  const { text, maths } = extractMath(src || '');
  let html = DOMPurify.sanitize(marked.parse(text));
  if (maths.length) {
    if (katexState === 'ready') {
      html = html.replace(/MATHPH(\d+)X/g, (_, i) => {
        const m = maths[+i];
        try { return window.katex.renderToString(m.tex, { displayMode: m.display, throwOnError: false }); } catch { return esc(m.raw); }
      });
    } else {
      if (katexState === 'idle') ensureKatex();
      html = html.replace(/MATHPH(\d+)X/g, (_, i) => esc(maths[+i].raw));
    }
  }
  streamingRender = false;
  return html;
}

function plainText(md) {
  return String(md || '').replace(/```[\s\S]*?```/g, ' code block. ').replace(/[#*_`>|~-]+/g, ' ').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/\s+/g, ' ').trim();
}

// ---------------- boot ----------------
async function boot() {
  applyTheme();
  registerSW();
  try { S.config = await api('/api/config'); } catch {}
  setAppName(S.config.appName || 'ChatGPT');
  const params = new URLSearchParams(location.search);
  const resetToken = params.get('reset');
  const authErr = params.get('auth_error');
  if (resetToken || authErr) history.replaceState({}, '', location.pathname);
  if (resetToken) { hideSplash(); showAuth('reset', resetToken); return; }
  try {
    const me = await api('/api/me');
    await enterApp(me);
  } catch {
    showAuth('login');
    if (authErr) {
      $('#authError').textContent = { google: 'Google sign-in failed. Please try again.', closed: 'Sign-ups are closed.', disabled: 'This account is disabled.', private: 'This is a private app. That Google account is not allowed.' }[authErr] || 'Sign-in failed.';
    }
  }
  hideSplash();
}
function hideSplash() { $('#splash').hidden = true; }
function setAppName(name) {
  S.config.appName = name;
  $$('.app-name').forEach((el) => { el.textContent = name; });
  document.title = name;
}

function registerSW() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ---------------- auth ----------------
let authMode = 'login';
let resetTokenValue = null;

function showAuth(mode = 'login', token = null) {
  if (S.streaming) S.streaming.ctrl.abort();
  S.me = null;
  $('#app').hidden = true;
  $('#auth').hidden = false;
  resetTokenValue = token;
  setAuthMode(mode);
}

function setAuthMode(mode) {
  authMode = mode;
  const app = S.config.appName;
  const cfg = S.config;
  $('#authError').textContent = '';
  $('#authError').className = 'auth-error';
  const show = (sel, on) => { $(sel).hidden = !on; };
  const titles = {
    login: ['Welcome back', `Log in to continue to ${app}`, 'Continue'],
    signup: ['Create an account', `Free to use — every model in one place`, 'Continue'],
    forgot: ['Reset your password', 'Enter your email and we’ll send you a reset link.', 'Send reset link'],
    reset: ['Set a new password', 'Choose a password with at least 8 characters.', 'Save password'],
  }[mode];
  $('#authTitle').textContent = titles[0];
  $('#authSub').textContent = titles[1];
  $('#authSubmit').textContent = titles[2];
  show('#nameField', mode === 'signup');
  show('#emailField', mode !== 'reset');
  show('#passField', mode !== 'forgot');
  $('#authPass').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('#authPass').placeholder = mode === 'reset' ? 'New password' : 'Password';
  const google = cfg.googleEnabled && (mode === 'login' || mode === 'signup');
  show('#googleBtn', google);
  show('#authDivider', google);
  show('#forgotWrap', mode === 'login' && cfg.resetEnabled);
  const sw = $('#authSwitch');
  if (mode === 'login') sw.innerHTML = cfg.signupEnabled === false ? '' : `Don’t have an account? <a data-mode="signup">Sign up</a>`;
  else if (mode === 'signup') sw.innerHTML = `Already have an account? <a data-mode="login">Log in</a>`;
  else sw.innerHTML = `<a data-mode="login">Back to log in</a>`;
  setTimeout(() => (mode === 'signup' ? $('#authName') : mode === 'reset' ? $('#authPass') : $('#authEmail')).focus(), 50);
}

$('#authSwitch').addEventListener('click', (e) => { const a = e.target.closest('[data-mode]'); if (a) setAuthMode(a.dataset.mode); });
$('#forgotLink').addEventListener('click', () => setAuthMode('forgot'));
$('#googleBtn').addEventListener('click', () => { location.href = '/api/auth/google'; });

$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#authSubmit');
  const errEl = $('#authError');
  errEl.textContent = ''; errEl.className = 'auth-error';
  const email = $('#authEmail').value.trim();
  const password = $('#authPass').value;
  const name = $('#authName').value.trim();
  if (authMode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { errEl.textContent = 'Please enter a valid email address.'; return; }
  if (authMode !== 'forgot' && password.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; return; }
  btn.disabled = true;
  try {
    if (authMode === 'forgot') {
      await api('/api/auth/forgot', { method: 'POST', body: { email } });
      errEl.className = 'auth-note';
      errEl.textContent = 'If an account exists for that email, a reset link is on its way.';
      return;
    }
    const path = { login: '/api/auth/login', signup: '/api/auth/signup', reset: '/api/auth/reset' }[authMode];
    const body = authMode === 'reset' ? { token: resetTokenValue, password } : { email, password, name };
    await api(path, { method: 'POST', body });
    $('#authPass').value = '';
    const me = await api('/api/me');
    await enterApp(me);
  } catch (err) {
    errEl.textContent = err.message;
  } finally { btn.disabled = false; }
});

async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
  S.chats = []; S.messages = []; S.chatId = null;
  history.replaceState({}, '', '/');
  showAuth('login');
}

// ---------------- app shell ----------------
async function enterApp(me) {
  S.me = me.user; S.usage = me.usage; S.limits = me.limits;
  $('#auth').hidden = true;
  $('#app').hidden = false;
  if (store.get('sidebarCollapsed') === '1' && !isMobile()) $('#app').classList.add('collapsed');
  renderProfile();
  const [models, chats] = await Promise.all([api('/api/models'), api('/api/chats')]);
  S.models = models.models;
  S.imagesEnabled = models.images;
  S.openaiConfigured = models.openaiConfigured;
  if (!S.model || (S.model !== 'auto' && !S.models.some((m) => m.key === S.model))) S.model = models.default || 'auto';
  $('#plusImage').hidden = !S.imagesEnabled;
  renderModelBtn();
  S.chats = chats.chats;
  renderChatList();
  renderSuggestions();
  setupSpeech();
  route();
}

function renderProfile() {
  const u = S.me;
  const initials = (u.name || u.email).trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  $('#avatar').innerHTML = u.avatar ? `<img src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : esc(initials);
  $('#profileName').textContent = u.name || u.email;
  $('#profileEmail').textContent = u.email;
  $('#adminItem').hidden = !u.isAdmin;
}

function route() {
  const m = location.pathname.match(/^\/c\/([\w-]+)/);
  if (m) openChat(m[1], { push: false }); else newChat({ push: false });
}
window.addEventListener('popstate', () => { if (S.me) route(); });

const GREETINGS = ['What can I help with?', 'What’s on your mind today?', 'Where should we begin?', 'Ready when you are.', 'How can I help, {name}?'];
function setEmpty(empty) {
  $('#main').classList.toggle('is-empty', empty);
  if (empty) {
    const first = (S.me?.name || '').split(' ')[0];
    let g = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    if (g.includes('{name}')) g = first ? g.replace('{name}', first) : GREETINGS[0];
    $('#greeting').textContent = g;
  }
}

function newChat({ push = true } = {}) {
  if (S.streaming) S.streaming.ctrl.abort();
  S.chatId = null; S.messages = [];
  if (push && location.pathname !== '/') history.pushState({}, '', '/');
  $('#thread').innerHTML = '';
  setEmpty(true);
  renderChatList();
  closeSidebarMobile();
  document.title = S.config.appName;
  if (!isTouch()) $('#input').focus();
}

async function openChat(id, { push = true } = {}) {
  if (S.streaming) S.streaming.ctrl.abort();
  S.chatId = id;
  if (push) history.pushState({}, '', `/c/${id}`);
  setEmpty(false);
  $('#thread').innerHTML = '';
  renderChatList();
  closeSidebarMobile();
  try {
    const d = await api(`/api/chats/${encodeURIComponent(id)}`);
    if (S.chatId !== id) return;
    S.messages = d.messages;
    document.title = `${d.chat.title} · ${S.config.appName}`;
    renderThread();
    scrollToBottom(true);
  } catch (e) {
    toast(e.status === 404 ? 'That chat no longer exists.' : e.message, true);
    newChat();
  }
}

// ---------------- sidebar ----------------
function groupLabel(ts) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const t0 = d.getTime(), day = 86400000;
  if (ts >= t0) return 'Today';
  if (ts >= t0 - day) return 'Yesterday';
  if (ts >= t0 - 7 * day) return 'Previous 7 days';
  if (ts >= t0 - 30 * day) return 'Previous 30 days';
  return new Date(ts).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function renderChatList() {
  const el = $('#chatList');
  if (!S.chats.length) { el.innerHTML = '<div class="sb-empty">Your chats will show up here.</div>'; return; }
  let html = '', last = null;
  for (const c of S.chats) {
    const g = c.pinned ? 'Pinned' : groupLabel(c.updatedAt);
    if (g !== last) { html += `<div class="sb-group">${esc(g)}</div>`; last = g; }
    html += `<div class="chat-item${c.id === S.chatId ? ' active' : ''}" data-id="${esc(c.id)}">${c.pinned ? icon('i-pin', 'i sm pin') : ''}<span class="t">${esc(c.title)}</span><button class="more" data-more title="Options">${icon('i-more', 'i sm')}</button></div>`;
  }
  el.innerHTML = html;
}

$('#chatList').addEventListener('click', (e) => {
  const item = e.target.closest('.chat-item');
  if (!item || item.querySelector('input')) return;
  if (e.target.closest('[data-more]')) { e.stopPropagation(); openChatMenu(item); return; }
  if (item.dataset.id !== S.chatId) openChat(item.dataset.id); else closeSidebarMobile();
});

let menuChatId = null;
function openChatMenu(item) {
  menuChatId = item.dataset.id;
  const chat = S.chats.find((c) => c.id === menuChatId);
  $('#chatMenu [data-act="pin"] span').textContent = chat?.pinned ? 'Unpin' : 'Pin';
  item.classList.add('menu-open');
  openMenu($('#chatMenu'), item.querySelector('[data-more]'), { onClose: () => item.classList.remove('menu-open') });
}

$('#chatMenu').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = menuChatId; closeMenus();
  const chat = S.chats.find((c) => c.id === id); if (!chat) return;
  if (b.dataset.act === 'rename') startRename(id);
  if (b.dataset.act === 'pin') {
    chat.pinned = !chat.pinned;
    sortChats(); renderChatList();
    api(`/api/chats/${id}`, { method: 'PATCH', body: { pinned: chat.pinned } }).catch((err) => toast(err.message, true));
  }
  if (b.dataset.act === 'delete') {
    const ok = await confirmDialog({ title: 'Delete chat?', text: `This will delete “${chat.title}”.`, ok: 'Delete' });
    if (!ok) return;
    try {
      await api(`/api/chats/${id}`, { method: 'DELETE' });
      S.chats = S.chats.filter((c) => c.id !== id);
      if (S.chatId === id) newChat(); else renderChatList();
    } catch (err) { toast(err.message, true); }
  }
});

function startRename(id) {
  const item = $(`.chat-item[data-id="${CSS.escape(id)}"]`);
  const chat = S.chats.find((c) => c.id === id);
  if (!item || !chat) return;
  const t = item.querySelector('.t');
  const input = document.createElement('input');
  input.value = chat.title; input.maxLength = 120;
  t.replaceWith(input); input.focus(); input.select();
  let done = false;
  const finish = async (save) => {
    if (done) return; done = true;
    const v = input.value.trim();
    if (save && v && v !== chat.title) {
      chat.title = v;
      api(`/api/chats/${id}`, { method: 'PATCH', body: { title: v } }).catch((err) => toast(err.message, true));
      if (S.chatId === id) document.title = `${v} · ${S.config.appName}`;
    }
    renderChatList();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
  input.addEventListener('blur', () => finish(true));
}

function sortChats() { S.chats.sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt)); }
function touchChat(id, title) {
  let c = S.chats.find((x) => x.id === id);
  if (!c) { c = { id, title: title || 'New chat', pinned: false, updatedAt: Date.now() }; S.chats.unshift(c); }
  c.updatedAt = Date.now();
  if (title) c.title = title;
  sortChats(); renderChatList();
}

function closeSidebarMobile() { $('#app').classList.remove('sidebar-open'); }
$('#menuBtn').addEventListener('click', () => $('#app').classList.add('sidebar-open'));
$('#scrim').addEventListener('click', closeSidebarMobile);
$('#collapseBtn').addEventListener('click', () => {
  if (isMobile()) { closeSidebarMobile(); return; }
  $('#app').classList.add('collapsed'); store.set('sidebarCollapsed', '1');
});
$('#expandBtn').addEventListener('click', () => { $('#app').classList.remove('collapsed'); store.set('sidebarCollapsed', '0'); });
for (const id of ['#newChatBtn', '#newChatTop', '#newChatTop2', '#logoBtn']) $(id).addEventListener('click', () => newChat());
$('#searchBtn').addEventListener('click', openSearch);
$('#libraryBtn').addEventListener('click', openLibrary);
$('#profileBtn').addEventListener('click', (e) => { e.stopPropagation(); openMenu($('#profileMenu'), $('#profileBtn'), { placement: 'above' }); });
$('#profileMenu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  closeMenus();
  const act = b.dataset.act;
  if (act === 'settings') openSettings('general');
  if (act === 'personalize') openSettings('personal');
  if (act === 'admin') openSettings('admin');
  if (act === 'install') promptInstall();
  if (act === 'logout') logout();
});

// ---------------- menus ----------------
let openMenuState = null;
function openMenu(menu, anchor, { placement = 'below', align = 'start', onClose } = {}) {
  closeMenus();
  menu.hidden = false;
  const r = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let left = align === 'end' ? r.right - mw : r.left;
  left = Math.max(8, Math.min(left, innerWidth - mw - 8));
  let top = placement === 'above' ? r.top - mh - 6 : r.bottom + 6;
  if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  if (top < 8) top = 8;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  openMenuState = { menu, onClose };
}
function closeMenus() {
  if (!openMenuState) return;
  openMenuState.menu.hidden = true;
  openMenuState.onClose?.();
  openMenuState = null;
}
document.addEventListener('mousedown', (e) => { if (openMenuState && !openMenuState.menu.contains(e.target)) closeMenus(); });
document.addEventListener('touchstart', (e) => { if (openMenuState && !openMenuState.menu.contains(e.target)) closeMenus(); }, { passive: true });
window.addEventListener('resize', closeMenus);

// ---------------- model picker ----------------
function currentModel() { return S.models.find((m) => m.key === S.model) || null; }
function renderModelBtn() {
  const m = currentModel();
  $('#modelName').textContent = m ? m.name : 'Auto';
  $('#input').placeholder = S.tool === 'image' ? 'Describe an image' : 'Ask anything';
}

function modelRow(m, selected) {
  const badge = '';
  return `<button class="model-row${m.available === false ? ' off' : ''}" data-key="${esc(m.key)}" data-search="${esc((m.name + ' ' + (m.providerLabel || '') + ' ' + m.key).toLowerCase())}">
    <span class="mt"><span class="mn">${esc(m.name)} ${badge}${m.vision ? `<span title="Can see images">${icon('i-eye', 'i sm')}</span>` : ''}</span>
    <span class="md2">${esc(m.description)}${m.available === false ? ' · busy right now' : ''}</span></span>
    ${selected ? icon('i-check', 'i sm') : ''}</button>`;
}

function renderModelMenu() {
  const menu = $('#modelMenu');
  let html = '';
  if (S.models.length > 8) html += '<div class="search"><input id="modelSearch" placeholder="Search models" autocomplete="off"></div>';
  // Groups arrive from the server already ordered: ChatGPT models first.
  const groups = new Map();
  for (const m of S.models) {
    const g = m.group || m.providerLabel;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(m);
  }
  const chatgpt = groups.get('ChatGPT models');
  if (chatgpt) {
    html += '<div class="menu-label" data-group>ChatGPT models</div>';
    for (const m of chatgpt) html += modelRow(m, S.model === m.key);
    groups.delete('ChatGPT models');
  } else if (!S.openaiConfigured) {
    html += `<div class="menu-label" data-group>ChatGPT models</div><div class="model-row off" data-group style="cursor:default"><span class="mt"><span class="mn">GPT-6 · GPT-5 · o-series</span><span class="md2">Appear here once OPENAI_API_KEY is added on the server</span></span></div>`;
  }
  html += '<div class="menu-label" data-group>Free & fast</div>';
  html += modelRow({ key: 'auto', name: 'Auto', description: 'Picks the fastest free model that’s available right now', tier: 'free' }, S.model === 'auto');
  const featured = S.models.filter((m) => m.featured);
  if (featured.length) {
    html += '<div class="menu-label" data-group>Recommended</div>';
    for (const m of featured) html += modelRow(m, S.model === m.key);
  }
  for (const [g, list] of groups) {
    html += `<div class="menu-label" data-group>${esc(g)}</div>`;
    for (const m of list) html += modelRow(m, S.model === m.key);
  }
  if (!S.models.length) html += '<div class="menu-label">No models are configured on the server yet.</div>';
  menu.innerHTML = html;
  const search = $('#modelSearch');
  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      $$('.model-row', menu).forEach((r) => { r.hidden = q && !r.dataset.search.includes(q) && !(r.dataset.key === 'auto' && 'auto'.includes(q)); });
      $$('[data-group]', menu).forEach((l) => { l.hidden = !!q; });
    });
  }
}

$('#modelBtn').addEventListener('click', async (e) => {
  e.stopPropagation();
  if (openMenuState?.menu === $('#modelMenu')) { closeMenus(); return; }
  renderModelMenu();
  openMenu($('#modelMenu'), $('#modelBtn'));
  if (!isTouch()) $('#modelSearch')?.focus();
  // refresh availability in the background
  api('/api/models').then((d) => { S.models = d.models; }).catch(() => {});
});
$('#modelMenu').addEventListener('click', (e) => {
  const r = e.target.closest('.model-row'); if (!r) return;
  S.model = r.dataset.key;
  store.set('model', S.model);
  closeMenus();
  renderModelBtn();
  const m = currentModel();
  if (m?.tier === 'paid' && S.limits?.premium > 0) toast(`${m.name} is a premium model: ${S.limits.premium} messages per day.`);
});

// ---------------- thread rendering ----------------
function renderThread() {
  const t = $('#thread');
  t.innerHTML = '';
  const lastAssistant = [...S.messages].reverse().find((m) => m.role === 'assistant');
  for (const m of S.messages) {
    if (m.role === 'assistant' && !m.content && !m.attachments?.length && m.status === 'stopped') continue;
    t.appendChild(messageEl(m, m === lastAssistant));
  }
  setEmpty(S.messages.length === 0 && !S.chatId);
}

function userMessageEl(m) {
  const el = document.createElement('div');
  el.className = 'msg user';
  el.dataset.id = m.id;
  let atts = '';
  for (const a of m.attachments || []) {
    if (a.type === 'image') atts += `<img src="${esc(a.url)}" alt="${esc(a.name || 'image')}" data-zoom loading="lazy">`;
    else atts += `<div class="att"><span class="fic">${icon('i-file')}</span><span style="min-width:0"><div class="fname">${esc(a.name)}</div><div class="fsub">${a.chars ? `${Math.max(1, Math.round(a.chars / 1000))}k chars` : 'File'}</div></span></div>`;
  }
  el.innerHTML = `${atts ? `<div class="u-atts">${atts}</div>` : ''}${m.content ? `<div class="bubble">${esc(m.content)}</div>` : ''}
    <div class="msg-actions"><button class="act" data-act="copy" title="Copy">${icon('i-copy')}</button>${String(m.id).startsWith('tmp-') ? '' : `<button class="act" data-act="edit" title="Edit message">${icon('i-edit')}</button>`}</div>`;
  return el;
}

function assistantActions(m, isLast) {
  const isImage = m.attachments?.some((a) => a.type === 'image');
  let h = '<div class="msg-actions">';
  if (isImage) {
    const a = m.attachments.find((x) => x.type === 'image');
    h += `<a class="act" href="${esc(a.url)}" download title="Download">${icon('i-download')}</a>`;
  } else if (m.content) {
    h += `<button class="act" data-act="copy" title="Copy">${icon('i-copy')}</button>`;
    h += `<button class="act${m.rating === 1 ? ' on' : ''}" data-act="up" title="Good response">${icon('i-up-thumb')}</button>`;
    h += `<button class="act${m.rating === -1 ? ' on' : ''}" data-act="down" title="Bad response">${icon('i-down-thumb')}</button>`;
    if ('speechSynthesis' in window) h += `<button class="act" data-act="speak" title="Read aloud">${icon('i-speaker')}</button>`;
  }
  if (isLast) h += `<button class="act" data-act="regen" title="Try again">${icon('i-regen')}</button>`;
  if (m.modelName) h += `<span class="model-tag" title="${esc(`Answered by ${m.modelName}${m.provider ? ` (${m.provider})` : ''}`)}">${esc(m.modelName)}</span>`;
  return h + '</div>';
}

function imageBlock(a) {
  return `<div class="gen-img" data-aspect="${esc(a.aspect || '1:1')}"><img src="${esc(a.url)}" alt="${esc(a.prompt || 'Generated image')}" data-zoom loading="lazy">
    <div class="img-tools"><a href="${esc(a.url)}" download title="Download"><button type="button" tabindex="-1">${icon('i-download', 'i sm')}</button></a></div></div>`;
}

function assistantMessageEl(m, isLast) {
  const el = document.createElement('div');
  el.className = 'msg assistant';
  el.dataset.id = m.id;
  let h = '';
  const img = m.attachments?.find((a) => a.type === 'image');
  if (m.note && m.status !== 'error' && !img) h += `<div class="note">${icon('i-info')}<span>${esc(m.note)}</span></div>`;
  if (m.reasoning) h += `<details class="reasoning"><summary>Thought process ${icon('i-chev-r')}</summary><div class="rbody">${esc(m.reasoning)}</div></details>`;
  if (img) h += imageBlock(img);
  else if (m.content) h += `<div class="md">${renderMarkdown(m.content)}</div>`;
  if (m.status === 'partial' || m.status === 'stopped') h += `<div class="note" style="margin-top:10px">${icon('i-info')}<span>${m.status === 'stopped' ? 'You stopped this response.' : esc(m.note || 'The response was cut short.')}</span></div>`;
  if (m.status === 'error') h += `<div class="err-box"><span>${esc(m.note || 'Something went wrong.')}</span>${isLast ? '<button class="btn" data-act="regen">Try again</button>' : ''}</div>`;
  h += assistantActions(m, isLast);
  el.innerHTML = h;
  return el;
}

function messageEl(m, isLast) { return m.role === 'user' ? userMessageEl(m) : assistantMessageEl(m, isLast); }

// ---------------- scrolling ----------------
const scroller = $('#scroller');
function nearBottom() { return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140; }
function scrollToBottom(force = false) { if (force || nearBottom()) scroller.scrollTop = scroller.scrollHeight; }
scroller.addEventListener('scroll', () => { $('#toBottom').hidden = nearBottom() || $('#main').classList.contains('is-empty'); }, { passive: true });
$('#toBottom').addEventListener('click', () => { scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' }); });

// ---------------- thread interactions ----------------
$('#thread').addEventListener('click', async (e) => {
  const codeBtn = e.target.closest('.copy-code');
  if (codeBtn) {
    const code = codeBtn.closest('.code-block').querySelector('code').textContent;
    if (await copyText(code)) { const s = codeBtn.querySelector('span'); s.textContent = 'Copied!'; setTimeout(() => { s.textContent = 'Copy code'; }, 1800); }
    return;
  }
  const zoom = e.target.closest('[data-zoom]');
  if (zoom) { openLightbox(zoom.getAttribute('src')); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const msgEl = b.closest('.msg');
  const m = S.messages.find((x) => x.id === msgEl?.dataset.id);
  const act = b.dataset.act;
  if (act === 'copy' && m) {
    if (await copyText(m.content)) { b.innerHTML = icon('i-check'); setTimeout(() => { b.innerHTML = icon('i-copy'); }, 1600); }
  } else if ((act === 'up' || act === 'down') && m) {
    const val = act === 'up' ? 1 : -1;
    m.rating = m.rating === val ? null : val;
    msgEl.querySelector('[data-act="up"]').classList.toggle('on', m.rating === 1);
    msgEl.querySelector('[data-act="down"]').classList.toggle('on', m.rating === -1);
    api(`/api/messages/${m.id}/rating`, { method: 'POST', body: { rating: m.rating } }).catch(() => {});
    if (m.rating) toast('Thanks for your feedback!');
  } else if (act === 'speak' && m) {
    speak(m.content, b);
  } else if (act === 'regen') {
    regenerate();
  } else if (act === 'edit' && m) {
    startEdit(msgEl, m);
  }
});

let speaking = null;
function speak(text, btn) {
  const synth = window.speechSynthesis;
  if (speaking) { synth.cancel(); speaking.classList.remove('on'); const was = speaking; speaking = null; if (was === btn) return; }
  const u = new SpeechSynthesisUtterance(plainText(text).slice(0, 8000));
  u.lang = /[؀-ۿ]/.test(text) ? 'ur-PK' : (navigator.language || 'en-US');
  u.onend = u.onerror = () => { btn.classList.remove('on'); if (speaking === btn) speaking = null; };
  speaking = btn; btn.classList.add('on');
  synth.speak(u);
}

function startEdit(msgEl, m) {
  if (S.streaming) return;
  const box = document.createElement('div');
  box.className = 'edit-box';
  box.innerHTML = `<textarea rows="2"></textarea><div class="row"><button class="btn" data-x="cancel">Cancel</button><button class="btn primary" data-x="send">Send</button></div>`;
  const ta = box.querySelector('textarea');
  ta.value = m.content;
  msgEl.replaceChildren(box);
  const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, innerHeight * 0.5)}px`; };
  ta.addEventListener('input', grow); grow(); ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  box.addEventListener('click', (e) => {
    const x = e.target.closest('[data-x]'); if (!x) return;
    if (x.dataset.x === 'cancel') { renderThread(); return; }
    const content = ta.value.trim();
    if (!content) return;
    const idx = S.messages.indexOf(m);
    m.content = content;
    S.messages = S.messages.slice(0, idx + 1);
    renderThread();
    runStream({ action: 'edit', chatId: S.chatId, messageId: m.id, content, model: S.model });
  });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !isTouch()) { e.preventDefault(); box.querySelector('[data-x="send"]').click(); } if (e.key === 'Escape') renderThread(); });
}

function regenerate() {
  if (S.streaming || !S.chatId) return;
  let lastUser = -1;
  for (let i = S.messages.length - 1; i >= 0; i--) if (S.messages[i].role === 'user') { lastUser = i; break; }
  if (lastUser < 0) return;
  const prevReply = S.messages[lastUser + 1];
  const wasImage = !!prevReply?.attachments?.some((a) => a.type === 'image');
  S.messages = S.messages.slice(0, lastUser + 1);
  renderThread();
  runStream({ action: 'regenerate', chatId: S.chatId, model: S.model, tool: wasImage ? 'image' : undefined });
}

// ---------------- composer ----------------
const input = $('#input');
function autosize() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, innerHeight * 0.4)}px`; }
function syncSend() {
  const btn = $('#sendBtn');
  const streaming = !!S.streaming;
  btn.classList.toggle('streaming', streaming);
  btn.title = streaming ? 'Stop' : 'Send';
  btn.disabled = !streaming && !input.value.trim() && !S.attachments.length;
}
input.addEventListener('input', () => { autosize(); syncSend(); });
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    const ctrl = e.ctrlKey || e.metaKey;
    if ((S.sendOnEnter && !isTouch()) || ctrl) { e.preventDefault(); if (!S.streaming) send(); }
  }
});
$('#composer').addEventListener('submit', (e) => { e.preventDefault(); if (S.streaming) stopStreaming(); else send(); });
$('#composer').addEventListener('click', (e) => { if (e.target === $('#composer') || e.target.classList.contains('composer-bar') || e.target.classList.contains('spacer')) input.focus(); });

$('#plusBtn').addEventListener('click', (e) => { e.stopPropagation(); openMenu($('#plusMenu'), $('#plusBtn'), { placement: 'above' }); });
$('#plusMenu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  closeMenus();
  if (b.dataset.act === 'attach') $('#fileInput').click();
  if (b.dataset.act === 'image') setTool('image');
});
function setTool(tool) {
  S.tool = tool;
  $('#toolChip').hidden = tool !== 'image';
  renderModelBtn();
  input.focus();
}
$('#toolChip').addEventListener('click', () => setTool(null));

function renderSuggestions() {
  const items = [
    S.imagesEnabled && { ic: 'i-palette', label: 'Create an image', act: () => setTool('image') },
    { ic: 'i-edit', label: 'Help me write', act: () => fill('Help me write ') },
    { ic: 'i-bulb', label: 'Explain a topic', act: () => fill('Explain in simple words: ') },
    { ic: 'i-code', label: 'Code', act: () => fill('Write code that ') },
  ].filter(Boolean);
  const box = $('#suggestions');
  box.innerHTML = items.map((s, i) => `<button class="suggestion" data-i="${i}">${icon(s.ic)}${esc(s.label)}</button>`).join('');
  box.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) items[+b.dataset.i].act(); };
  function fill(t) { input.value = t; autosize(); syncSend(); input.focus(); }
}

// ---- attachments ----
const TEXT_EXT = /\.(txt|md|csv|json|js|ts|jsx|tsx|py|java|c|cpp|h|cs|go|rs|php|rb|sh|sql|html|css|xml|ya?ml|log|ini|toml|kt|swift|dart|r|m|tex)$/i;
$('#fileInput').addEventListener('change', (e) => { addFiles([...e.target.files]); e.target.value = ''; });
input.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) { e.preventDefault(); addFiles(files); }
});
const main = $('#main');
main.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); $('#composer').classList.add('drag'); } });
main.addEventListener('dragleave', (e) => { if (!main.contains(e.relatedTarget)) $('#composer').classList.remove('drag'); });
main.addEventListener('drop', (e) => {
  $('#composer').classList.remove('drag');
  if (e.dataTransfer?.files?.length) { e.preventDefault(); addFiles([...e.dataTransfer.files]); }
});

function readAsDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}
async function imageToDataUrl(file) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return readAsDataURL(file);
  const max = 2048;
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (s === 1 && file.size < 3.5e6 && /image\/(png|jpeg|webp)/.test(file.type)) return readAsDataURL(file);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.88);
}
async function pdfText(file) {
  const v = '4.10.38';
  const pdfjs = await import(`https://cdn.jsdelivr.net/npm/pdfjs-dist@${v}/build/pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${v}/build/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let out = '';
  for (let i = 1; i <= Math.min(doc.numPages, 300) && out.length < 400000; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    out += tc.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('') + '\n\n';
  }
  return out.trim();
}

async function addFiles(files) {
  for (const f of files.slice(0, 10)) {
    const att = { id: Math.random().toString(36).slice(2), name: f.name || 'pasted-image.png', loading: true };
    if (f.type.startsWith('image/')) {
      if (S.attachments.filter((a) => a.type === 'image').length >= 4) { toast('You can attach up to 4 images per message.', true); continue; }
      att.type = 'image';
    } else if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) att.type = 'file';
    else if (f.type.startsWith('text/') || TEXT_EXT.test(f.name) || f.type === 'application/json') att.type = 'file';
    else { toast(`“${f.name}” isn’t supported yet. Try images, PDFs or text/code files.`, true); continue; }
    if (f.size > 25 * 1024 * 1024) { toast(`“${f.name}” is too large (max 25 MB).`, true); continue; }
    S.attachments.push(att);
    renderAttachments();
    try {
      if (att.type === 'image') att.dataUrl = await imageToDataUrl(f);
      else if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
        att.text = await pdfText(f);
        if (!att.text) throw new Error('This PDF has no selectable text (it may be a scan).');
      } else att.text = (await f.text()).slice(0, 400000);
      att.loading = false;
    } catch (err) {
      S.attachments = S.attachments.filter((a) => a !== att);
      toast(err.message || `Could not read “${f.name}”.`, true);
    }
    renderAttachments();
  }
}

function renderAttachments() {
  const row = $('#attachRow');
  row.innerHTML = S.attachments.map((a) => a.type === 'image'
    ? `<div class="att img${a.loading ? ' loading' : ''}" data-id="${a.id}">${a.dataUrl ? `<img src="${a.dataUrl}" alt="">` : ''}<button type="button" class="rm" title="Remove">${icon('i-x')}</button></div>`
    : `<div class="att${a.loading ? ' loading' : ''}" data-id="${a.id}"><span class="fic">${icon('i-file')}</span><span style="min-width:0"><div class="fname">${esc(a.name)}</div><div class="fsub">${a.loading ? 'Reading…' : /\.pdf$/i.test(a.name) ? 'PDF' : 'File'}</div></span><button type="button" class="rm" title="Remove">${icon('i-x')}</button></div>`).join('');
  syncSend();
}
$('#attachRow').addEventListener('click', (e) => {
  const rm = e.target.closest('.rm'); if (!rm) return;
  const id = rm.closest('.att').dataset.id;
  S.attachments = S.attachments.filter((a) => a.id !== id);
  renderAttachments();
});

// ---- voice input ----
let recognition = null;
function setupSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  const btn = $('#micBtn');
  btn.hidden = false;
  let base = '';
  btn.onclick = () => {
    if (recognition) { recognition.stop(); return; }
    recognition = new SR();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    base = input.value ? input.value.replace(/\s*$/, ' ') : '';
    recognition.onresult = (ev) => {
      let text = '';
      for (let i = 0; i < ev.results.length; i++) text += ev.results[i][0].transcript;
      input.value = base + text; autosize(); syncSend();
    };
    recognition.onerror = (ev) => { if (ev.error === 'not-allowed') toast('Microphone permission was denied.', true); };
    recognition.onend = () => { recognition = null; btn.classList.remove('listening'); input.focus(); };
    recognition.start();
    btn.classList.add('listening');
  };
}

// ---------------- sending & streaming ----------------
async function send() {
  const text = input.value.trim();
  if ((!text && !S.attachments.length) || S.streaming) return;
  if (S.attachments.some((a) => a.loading)) { toast('Please wait — still reading your files.'); return; }
  if (recognition) recognition.stop();
  const atts = S.attachments.map((a) => (a.type === 'image' ? { type: 'image', dataUrl: a.dataUrl, name: a.name } : { type: 'file', name: a.name, text: a.text }));
  const local = S.attachments.map((a) => (a.type === 'image' ? { type: 'image', url: a.dataUrl, name: a.name } : { type: 'file', name: a.name, chars: a.text.length }));
  const saved = { text, attachments: S.attachments };
  input.value = ''; autosize();
  S.attachments = []; renderAttachments();
  const tmp = { id: `tmp-${Date.now()}`, role: 'user', content: text, attachments: local };
  S.messages.push(tmp);
  setEmpty(false);
  $('#thread').appendChild(userMessageEl(tmp));
  scrollToBottom(true);
  await runStream({ action: 'send', chatId: S.chatId, content: text, attachments: atts, model: S.model, tool: S.tool || undefined }, { tmp, saved });
}

function stopStreaming() { S.streaming?.ctrl.abort(); }

function liveAssistant() {
  const el = document.createElement('div');
  el.className = 'msg assistant streaming';
  el.innerHTML = '<div class="live-note"></div><div class="live-reason"></div><div class="live-body"><div class="dot-wrap"><div class="pulse-dot"></div></div></div>';
  $('#thread').appendChild(el);
  scrollToBottom(true);
  return { el, text: '', reasoning: '', model: null, id: null, kind: 'chat', raf: 0, started: Date.now(), reasonStart: 0, reasonEnd: 0 };
}

function renderLive(live) {
  live.raf = 0;
  const stick = nearBottom();
  const body = live.el.querySelector('.live-body');
  if (live.kind === 'image') return;
  if (live.reasoning) {
    let det = live.el.querySelector('.live-reason details');
    if (!det) {
      live.el.querySelector('.live-reason').innerHTML = `<details class="reasoning"><summary><span class="lbl">Thinking</span> ${icon('i-chev-r')}</summary><div class="rbody"></div></details>`;
      det = live.el.querySelector('.live-reason details');
    }
    const lbl = det.querySelector('.lbl');
    if (!live.text) { lbl.textContent = 'Thinking'; lbl.classList.add('shimmer'); }
    else {
      lbl.classList.remove('shimmer');
      const secs = Math.max(1, Math.round(((live.reasonEnd || Date.now()) - live.reasonStart) / 1000));
      lbl.textContent = `Thought for ${secs}s`;
    }
    const rb = det.querySelector('.rbody');
    rb.textContent = live.reasoning;
    if (det.open) rb.scrollTop = rb.scrollHeight;
  }
  if (live.text) {
    let md = body.querySelector('.md');
    if (!md) { body.innerHTML = '<div class="md cursor"></div>'; md = body.querySelector('.md'); }
    md.innerHTML = renderMarkdown(live.text, true);
  }
  if (stick) scrollToBottom(true);
}
function scheduleLive(live) { if (!live.raf) live.raf = requestAnimationFrame(() => renderLive(live)); }

async function runStream(body, ctx = {}) {
  const ctrl = new AbortController();
  const live = liveAssistant();
  S.streaming = { ctrl, live };
  syncSend();
  let finished = false;
  let res;

  const finalize = (message) => {
    finished = true;
    cancelAnimationFrame(live.raf);
    if (!live.el.isConnected) return; // user switched chats meanwhile
    // remove previous "last" regenerate buttons
    S.messages.push(message);
    const lastAssistant = message;
    $$('#thread .msg.assistant [data-act="regen"]').forEach((b) => { if (!b.closest('.err-box')) b.remove(); });
    const el = messageEl(lastAssistant, true);
    live.el.replaceWith(el);
    scrollToBottom();
  };

  try {
    res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal, credentials: 'same-origin' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) { showAuth('login'); return; }
      throw Object.assign(new Error(j.error || `Request failed (${res.status})`), { httpStatus: res.status });
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        let ev = 'message', data = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) ev = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) continue;
        let d; try { d = JSON.parse(data); } catch { continue; }
        handleEvent(ev, d, live, ctx, finalize);
      }
    }
    if (!finished) {
      // stream ended without "done" (server restarted / network drop)
      finalize({ id: live.id || `tmp-${Date.now()}`, role: 'assistant', content: live.text, reasoning: live.reasoning, attachments: [], modelName: live.model?.name, status: live.text ? 'partial' : 'error', note: 'The connection was interrupted.' });
    }
  } catch (err) {
    if (ctrl.signal.aborted) {
      if (!finished) {
        if (live.text) finalize({ id: live.id || `tmp-${Date.now()}`, role: 'assistant', content: live.text, reasoning: live.reasoning, attachments: [], modelName: live.model?.name, status: 'stopped' });
        else live.el.remove();
      }
    } else if (err.httpStatus && ctx.tmp && body.action === 'send') {
      // Server rejected the message before saving it: restore the composer.
      live.el.remove();
      S.messages = S.messages.filter((m) => m !== ctx.tmp);
      $(`.msg[data-id="${CSS.escape(ctx.tmp.id)}"]`)?.remove();
      if (!input.value) { input.value = ctx.saved.text; autosize(); }
      if (!S.attachments.length) { S.attachments = ctx.saved.attachments; renderAttachments(); }
      if (!S.messages.length && !S.chatId) setEmpty(true);
      toast(err.message, true);
    } else if (!finished) {
      finalize({ id: live.id || `tmp-${Date.now()}`, role: 'assistant', content: live.text, attachments: [], status: live.text ? 'partial' : 'error', note: err.httpStatus ? err.message : 'Network error — check your connection and try again.' });
    }
  } finally {
    if (S.streaming?.ctrl === ctrl) S.streaming = null;
    syncSend();
  }
}

function handleEvent(ev, d, live, ctx, finalize) {
  switch (ev) {
    case 'start': {
      live.id = d.assistantId;
      live.kind = d.kind;
      live.el.dataset.id = d.assistantId;
      if (!S.chatId || d.isNew) {
        S.chatId = d.chatId;
        history.pushState({}, '', `/c/${d.chatId}`);
      }
      touchChat(d.chatId, d.isNew ? d.title : undefined);
      if (ctx.tmp) {
        const idx = S.messages.indexOf(ctx.tmp);
        if (idx >= 0) S.messages[idx] = d.userMessage;
        const old = $(`.msg[data-id="${CSS.escape(ctx.tmp.id)}"]`);
        if (old) old.replaceWith(userMessageEl(d.userMessage));
      } else {
        const idx = S.messages.findIndex((m) => m.id === d.userMessage.id);
        if (idx >= 0) S.messages[idx] = d.userMessage;
      }
      if (d.kind === 'image') {
        live.el.querySelector('.live-body').innerHTML = '<div class="img-skel"><span class="shimmer">Getting ready…</span></div>';
      }
      break;
    }
    case 'model':
      live.model = d;
      if (d.fallbackFrom?.length) live.el.querySelector('.live-note').innerHTML = `<div class="note">${icon('i-info')}<span>${esc(`${d.fallbackFrom[0]} wasn't available right now, so ${d.name} answered.`)}</span></div>`;
      break;
    case 'notice': live.el.querySelector('.live-note').innerHTML = `<div class="note">${icon('i-info')}<span>${esc(d.message)}</span></div>`; break;
    case 'reasoning':
      if (!live.reasonStart) live.reasonStart = Date.now();
      live.reasoning += d.t; scheduleLive(live); break;
    case 'delta':
      if (live.reasoning && !live.reasonEnd) live.reasonEnd = Date.now();
      live.text += d.t; scheduleLive(live); break;
    case 'reset':
      live.text = ''; live.reasoning = ''; live.reasonStart = 0; live.reasonEnd = 0;
      live.el.querySelector('.live-reason').innerHTML = '';
      live.el.querySelector('.live-body').innerHTML = '<div class="dot-wrap"><div class="pulse-dot"></div></div>';
      break;
    case 'image_status': {
      const sk = live.el.querySelector('.img-skel');
      if (sk) {
        if (d.aspect) sk.dataset.aspect = d.aspect;
        sk.querySelector('span').textContent = d.stage === 'planning' ? 'Getting ready…' : 'Creating image…';
      }
      scrollToBottom();
      break;
    }
    case 'error': live.error = d.message; break;
    case 'done': {
      const m = d.message;
      if (m.status === 'error' && !m.note) m.note = live.error;
      finalize(m);
      if (m.attachments?.some((a) => a.type === 'image') && S.usage) S.usage.images++;
      else if (m.content && S.usage) S.usage.messages++;
      break;
    }
    case 'title': {
      const c = S.chats.find((x) => x.id === d.chatId);
      if (c) { c.title = d.title; renderChatList(); }
      if (S.chatId === d.chatId) document.title = `${d.title} · ${S.config.appName}`;
      break;
    }
    default: break;
  }
}

// ---------------- search ----------------
let searchTimer = null, searchSeq = 0;
function openSearch() {
  closeSidebarMobile();
  const dlg = $('#searchDlg');
  $('#searchInput').value = '';
  renderSearchResults(S.chats.slice(0, 20).map((c) => ({ id: c.id, title: c.title, snippet: '' })), true);
  dlg.showModal();
  $('#searchInput').focus();
}
function renderSearchResults(list, recent = false) {
  const box = $('#searchResults');
  if (!list.length) { box.innerHTML = `<div class="sb-empty" style="padding:16px">${recent ? 'No chats yet.' : 'No results.'}</div>`; return; }
  box.innerHTML = (recent ? '<div class="menu-label">Recent</div>' : '') + list.map((r) => `<div class="sr-item" data-id="${esc(r.id)}">${icon('i-new')}<div style="min-width:0"><div class="sr-t">${esc(r.title)}</div>${r.snippet ? `<div class="sr-s">${esc(r.snippet)}</div>` : ''}</div></div>`).join('');
}
$('#searchInput').addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = $('#searchInput').value.trim();
  if (!q) { renderSearchResults(S.chats.slice(0, 20), true); return; }
  searchTimer = setTimeout(async () => {
    const seq = ++searchSeq;
    try { const d = await api(`/api/search?q=${encodeURIComponent(q)}`); if (seq === searchSeq) renderSearchResults(d.results); } catch {}
  }, 220);
});
$('#searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#searchResults .sr-item')?.click(); });
$('#searchResults').addEventListener('click', (e) => {
  const it = e.target.closest('.sr-item'); if (!it) return;
  $('#searchDlg').close();
  openChat(it.dataset.id);
});

// ---------------- library & lightbox ----------------
async function openLibrary() {
  closeSidebarMobile();
  const grid = $('#libGrid');
  grid.innerHTML = '<div class="sb-empty">Loading…</div>';
  $('#libraryDlg').showModal();
  try {
    const d = await api('/api/images');
    grid.innerHTML = d.images.length ? d.images.map((i) => `<img src="${esc(i.url)}" data-zoom loading="lazy" alt="">`).join('')
      : `<div class="sb-empty">Images you create will appear here. Try “Create an image of a sunset over Lahore”.</div>`;
  } catch (e) { grid.innerHTML = `<div class="sb-empty">${esc(e.message)}</div>`; }
}
$('#libGrid').addEventListener('click', (e) => { const z = e.target.closest('[data-zoom]'); if (z) openLightbox(z.getAttribute('src')); });
function openLightbox(src) {
  $('#lbImg').src = src;
  $('#lightbox').showModal();
}
$('#lbDownload').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = $('#lbImg').src; a.download = ''; document.body.appendChild(a); a.click(); a.remove();
});
$('#lightbox').addEventListener('click', (e) => { if (e.target === $('#lightbox')) $('#lightbox').close(); });

// generic dialog close buttons + backdrop click
$$('dialog').forEach((dlg) => {
  dlg.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) dlg.close();
    else if (e.target === dlg && dlg.id !== 'lightbox') {
      const r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
    }
  });
});

function confirmDialog({ title, text, ok = 'Delete', extraHtml = '' }) {
  return new Promise((resolve) => {
    const dlg = $('#confirmDlg');
    $('#confirmTitle').textContent = title;
    $('#confirmText').textContent = text;
    $('#confirmExtra').innerHTML = extraHtml;
    $('#confirmOk').textContent = ok;
    let result = false;
    const onOk = () => { result = $('#confirmExtra input') ? { value: $('#confirmExtra input').value } : true; dlg.close(); };
    $('#confirmOk').addEventListener('click', onOk, { once: true });
    dlg.addEventListener('close', () => { $('#confirmOk').removeEventListener('click', onOk); resolve(result); }, { once: true });
    dlg.showModal();
    $('#confirmExtra input')?.focus();
  });
}

// ---------------- settings ----------------
const TABS = [
  { id: 'general', label: 'General', ic: 'i-gear' },
  { id: 'personal', label: 'Personalization', ic: 'i-sliders' },
  { id: 'data', label: 'Data controls', ic: 'i-db' },
  { id: 'account', label: 'Account', ic: 'i-user' },
  { id: 'admin', label: 'Admin', ic: 'i-shield', admin: true },
];
function openSettings(tab = 'general') {
  closeSidebarMobile();
  $('#settingsTabs').innerHTML = TABS.filter((t) => !t.admin || S.me?.isAdmin)
    .map((t) => `<button data-tab="${t.id}">${icon(t.ic)}${t.label}</button>`).join('');
  $('#settingsDlg').showModal();
  showTab(tab);
}
$('#settingsTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });

function usageRow(label, used, limit) {
  if (!limit) return `<div class="set-row"><span class="lbl">${label}</span><span style="color:var(--text-3)">${used} today · Unlimited</span></div>`;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return `<div class="set-row" style="display:block"><div style="display:flex;justify-content:space-between"><span>${label}</span><span style="color:var(--text-3)">${used} / ${limit}</span></div><div class="usage-bar"><i style="width:${pct}%"></i></div></div>`;
}

async function showTab(tab) {
  $$('#settingsTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  const pane = $('#settingsPane');
  const app = esc(S.config.appName);
  if (tab === 'general') {
    try { const me = await api('/api/me'); S.usage = me.usage; S.limits = me.limits; } catch {}
    const pref = themePref();
    pane.innerHTML = `
      <div class="set-row"><span class="lbl">Theme</span><select id="setTheme"><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select></div>
      <div class="set-row"><span class="lbl">Enter to send<small>Off: use Ctrl/⌘ + Enter to send</small></span><button class="toggle${S.sendOnEnter ? ' on' : ''}" id="setEnter" aria-label="Enter to send"></button></div>
      <div class="set-row" style="display:block;border:0;padding-bottom:0"><b style="font-size:14px">Today’s usage</b><div style="color:var(--text-3);font-size:12px;margin-top:2px">No limits are set in this app. AI providers still have their own rate limits.</div></div>
      ${S.usage ? usageRow('Messages', S.usage.messages, S.limits.messages) + usageRow('ChatGPT (paid API) messages', S.usage.premium, S.limits.premium) + usageRow('Images', S.usage.images, S.limits.images) : ''}`;
    $('#setTheme').value = pref;
    $('#setTheme').onchange = (e) => { store.set('theme', e.target.value); applyTheme(e.target.value); };
    $('#setEnter').onclick = (e) => { S.sendOnEnter = !S.sendOnEnter; store.set('sendOnEnter', S.sendOnEnter ? '1' : '0'); e.currentTarget.classList.toggle('on', S.sendOnEnter); };
  }
  if (tab === 'personal') {
    pane.innerHTML = `
      <div class="set-row" style="display:block"><div class="lbl" style="margin-bottom:8px">What should ${app} call you?</div><input class="text-input" id="setName" maxlength="60"></div>
      <div class="set-row" style="display:block"><div class="lbl" style="margin-bottom:8px">Custom instructions<small>What should ${app} know about you, and how should it respond? (e.g. “I’m a student in Karachi. Reply in Roman Urdu, keep it short.”)</small></div>
      <textarea class="text-input" id="setCI" maxlength="3000"></textarea></div>
      <div class="dlg-actions" style="margin-top:12px"><button class="btn primary" id="setSave">Save</button></div>`;
    $('#setName').value = S.me.name || '';
    $('#setCI').value = S.me.customInstructions || '';
    $('#setSave').onclick = async () => {
      try {
        const d = await api('/api/me', { method: 'PATCH', body: { name: $('#setName').value, customInstructions: $('#setCI').value } });
        S.me = d.user; renderProfile(); toast('Saved');
      } catch (e) { toast(e.message, true); }
    };
  }
  if (tab === 'data') {
    pane.innerHTML = `
      <div class="set-row"><span class="lbl">Export chats<small>Download all your conversations as a JSON file</small></span><button class="btn" id="setExport">Export</button></div>
      <div class="set-row"><span class="lbl">Delete all chats<small>This cannot be undone</small></span><button class="btn danger" id="setDelAll">Delete all</button></div>`;
    $('#setExport').onclick = exportChats;
    $('#setDelAll').onclick = async () => {
      const ok = await confirmDialog({ title: 'Delete all chats?', text: 'Every conversation and generated image will be permanently deleted.', ok: 'Delete all' });
      if (!ok) return;
      try { await api('/api/chats', { method: 'DELETE' }); S.chats = []; newChat(); toast('All chats deleted'); } catch (e) { toast(e.message, true); }
    };
  }
  if (tab === 'account') {
    const u = S.me;
    pane.innerHTML = `
      <div class="set-row"><span class="lbl">Email</span><span style="color:var(--text-2)">${esc(u.email)}</span></div>
      <div class="set-row" style="display:block"><div class="lbl" style="margin-bottom:8px">${u.hasPassword ? 'Change password' : 'Set a password'}</div>
        ${u.hasPassword ? '<input class="text-input" id="pwCur" type="password" placeholder="Current password" autocomplete="current-password" style="margin-bottom:8px">' : ''}
        <input class="text-input" id="pwNew" type="password" placeholder="New password (min 8 characters)" autocomplete="new-password" style="margin-bottom:8px">
        <button class="btn" id="pwSave">Update password</button></div>
      <div class="set-row"><span class="lbl">Log out on this device</span><button class="btn" id="setLogout">Log out</button></div>
      <div class="set-row"><span class="lbl">Delete account<small>Permanently deletes your account, chats and images</small></span><button class="btn danger" id="setDelAcc">Delete</button></div>`;
    $('#pwSave').onclick = async () => {
      try {
        await api('/api/me/password', { method: 'POST', body: { currentPassword: $('#pwCur')?.value || '', newPassword: $('#pwNew').value } });
        S.me.hasPassword = true; toast('Password updated'); showTab('account');
      } catch (e) { toast(e.message, true); }
    };
    $('#setLogout').onclick = () => { $('#settingsDlg').close(); logout(); };
    $('#setDelAcc').onclick = async () => {
      const res = await confirmDialog({
        title: 'Delete your account?', text: 'This permanently deletes your account, all chats and images.', ok: 'Delete account',
        extraHtml: u.hasPassword ? '<input class="text-input" type="password" placeholder="Enter your password to confirm" style="margin-bottom:16px">' : '',
      });
      if (!res) return;
      try { await api('/api/me', { method: 'DELETE', body: { password: res.value || '' } }); $('#settingsDlg').close(); toast('Account deleted'); showAuth('signup'); }
      catch (e) { toast(e.message, true); }
    };
  }
  if (tab === 'admin') {
    pane.innerHTML = '<div class="sb-empty">Loading…</div>';
    try {
      const s = await api('/api/admin/stats');
      const e = s.engine;
      const cds = Object.entries(e.cooldowns);
      pane.innerHTML = `
        <div class="stat-grid">
          <div class="stat"><b>${s.users}</b><span>Users</span></div>
          <div class="stat"><b>${s.activeToday}</b><span>Active today</span></div>
          <div class="stat"><b>${s.messagesToday}</b><span>Messages today</span></div>
          <div class="stat"><b>${s.premiumToday}</b><span>Premium today</span></div>
          <div class="stat"><b>${s.imagesToday}</b><span>Images today</span></div>
          <div class="stat"><b>${e.stats.fallbacks}</b><span>Fallbacks</span></div>
          <div class="stat"><b>${s.memoryMb} MB</b><span>Memory</span></div>
          <div class="stat"><b>${Math.round(s.uptimeSec / 3600)} h</b><span>Uptime</span></div>
        </div>
        <table class="admin-table"><tr><th>Provider</th><th>Tier</th><th>Models</th><th>Active</th><th>Queued</th></tr>
          ${e.providers.map((p) => `<tr><td>${esc(p.label)}</td><td>${p.tier}</td><td>${p.models}</td><td>${p.active}/${p.max}</td><td>${p.waiting}</td></tr>`).join('') || '<tr><td colspan="5">No providers configured — add API keys to .env</td></tr>'}
        </table>
        <div class="set-row"><span class="lbl">Image providers</span><span>${esc(s.imageProviders.join(', ') || 'none')}</span></div>
        <div class="set-row" style="display:block"><div class="lbl">Cooling down (auto-skipped)</div>
          <div style="font-size:13px;color:var(--text-2);margin-top:6px">${cds.length ? cds.map(([k, v]) => `${esc(k)} — ${esc(v.reason)} (${v.secondsLeft}s)`).join('<br>') : 'Everything healthy'}</div></div>
        <div class="dlg-actions" style="margin-top:12px"><button class="btn" id="admRefresh">Refresh model list</button></div>`;
      $('#admRefresh').onclick = async () => {
        try { const r = await api('/api/admin/models/refresh', { method: 'POST' }); toast(`${r.count} models loaded`); const d = await api('/api/models'); S.models = d.models; showTab('admin'); }
        catch (err) { toast(err.message, true); }
      };
    } catch (err) { pane.innerHTML = `<div class="sb-empty">${esc(err.message)}</div>`; }
  }
}

async function exportChats() {
  try {
    const out = [];
    for (const c of S.chats) {
      const d = await api(`/api/chats/${c.id}`);
      out.push({ title: d.chat.title, updatedAt: new Date(d.chat.updatedAt).toISOString(), messages: d.messages.map((m) => ({ role: m.role, content: m.content, model: m.modelName || undefined, createdAt: new Date(m.createdAt).toISOString() })) });
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${S.config.appName.replace(/\s+/g, '-')}-chats.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) { toast(e.message, true); }
}

// ---------------- install (PWA) ----------------
let deferredInstall = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function showInstall(on) { $('#installBtn').hidden = !on; $('#installItem').hidden = !on; }
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; showInstall(true); });
window.addEventListener('appinstalled', () => { deferredInstall = null; showInstall(false); toast('App installed!'); });
if (isIOS() && !isStandalone()) showInstall(true);
async function promptInstall() {
  if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice.catch(() => {}); deferredInstall = null; showInstall(false); }
  else if (isIOS()) toast('Tap the Share button, then “Add to Home Screen”.');
  else toast('Use your browser menu → “Install app” / “Add to Home screen”.');
}
$('#installBtn').addEventListener('click', promptInstall);

// ---------------- keyboard shortcuts ----------------
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); newChat(); }
  else if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); if (S.me) openSearch(); }
  else if (e.key === 'Escape') closeMenus();
});
window.addEventListener('beforeunload', () => { if (speaking) speechSynthesis.cancel(); });

boot();
