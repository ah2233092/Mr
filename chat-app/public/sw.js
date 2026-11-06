// Service worker: makes the app installable and lets it open offline.
// Always asks the server first, so an update shows up immediately;
// the cache is only a fallback when the network is down.
// API calls and private files are never cached.
const VERSION = 'v6';
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

  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req.mode === 'navigate' ? '/' : req, res.clone());
      return res;
    } catch {
      return (await cache.match(req.mode === 'navigate' ? '/' : req)) || Response.error();
    }
  })());
});
