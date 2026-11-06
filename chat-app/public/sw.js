// Service worker: makes the app installable and opens instantly.
// API calls and private files are never cached.
const VERSION = 'v3';
const SHELL = `shell-${VERSION}`;
const ASSETS = ['/', '/styles.css', '/app.js', '/boot.js', '/logo.svg', '/favicon.svg', '/manifest.webmanifest',
  '/vendor/marked.umd.js', '/vendor/purify.min.js', '/vendor/highlight.min.js', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/files/') || url.pathname === '/healthz') return;

  // Pages: network first so updates show immediately, cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }
  // Static assets: serve from cache, refresh in the background.
  e.respondWith(caches.open(SHELL).then(async (cache) => {
    const hit = await cache.match(req);
    const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || fresh;
  }));
});
