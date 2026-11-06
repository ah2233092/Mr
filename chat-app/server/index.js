// Entry point: wires the router, static files, auth and the AI engine.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT } from './config.js';
import { cleanup, db, backupDatabase } from './db.js';
import { Router, HttpError, sendJson, createStatic, securityHeaders, originOf } from './http.js';
import { getSessionUser } from './auth.js';
import { registerApi } from './routes/api.js';
import { registerChat } from './routes/chat.js';
import { startModelRefresh } from './engine/registry.js';
import { applySavedKeys } from './settings.js';

const router = new Router();
registerApi(router);
registerChat(router);
const serveStatic = createStatic(path.join(ROOT, 'public'));
const baseManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'manifest.webmanifest'), 'utf8'));

// Same-origin check for state-changing requests (CSRF protection on top of SameSite cookies).
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try {
    const host = new URL(o).host;
    const ours = new URL(originOf(req)).host;
    return host === ours || host === req.headers.host;
  } catch { return false; }
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const pathname = decodeURIComponent(url.pathname);
  securityHeaders(res);
  if (config.logRequests) console.log(req.method, pathname);

  try {
    if (pathname.startsWith('/api/') || pathname.startsWith('/files/') || pathname === '/healthz') {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !sameOrigin(req)) throw new HttpError(403, 'Cross-site request blocked.');
      req.user = getSessionUser(req);
      const m = router.match(req.method === 'HEAD' ? 'GET' : req.method, pathname);
      if (!m) throw new HttpError(404, 'Not found.');
      if (m.methodNotAllowed) throw new HttpError(405, 'Method not allowed.');
      await m.handler(req, res, { params: m.params, url });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed.');
    if (pathname === '/manifest.webmanifest' && config.appName !== baseManifest.name) {
      // Installed-app name follows APP_NAME.
      res.writeHead(200, { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ ...baseManifest, name: config.appName, short_name: config.appName.split(' ')[0] }));
      return;
    }
    if (serveStatic(req, res, pathname)) return;
    // SPA routes such as /c/<chatId> get the app shell.
    if (!path.extname(pathname)) { serveStatic(req, res, '/index.html'); return; }
    throw new HttpError(404, 'Not found.');
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error('[http]', req.method, pathname, e);
    if (res.headersSent) { try { res.end(); } catch {} return; }
    sendJson(res, status, { error: status === 500 ? 'Internal server error.' : e.message });
  }
}

const server = http.createServer({ keepAliveTimeout: 65_000, requestTimeout: 0, headersTimeout: 30_000 }, handle);
server.maxConnections = 5000;

export async function start(port = config.port, host = config.host) {
  applySavedKeys();
  await startModelRefresh().catch((e) => console.error('[models] initial load failed', e));
  setInterval(cleanup, 60 * 60 * 1000).unref();
  const backup = () => { try { backupDatabase(); } catch (e) { console.error('[backup] failed:', e.message); } };
  setTimeout(backup, 30_000).unref();
  setInterval(backup, 6 * 60 * 60 * 1000).unref();
  await new Promise((resolve, reject) => {
    const onError = (e) => { server.off('listening', onListening); reject(e); };
    const onListening = () => { server.off('error', onError); resolve(); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
  const addr = server.address();
  console.log(`[server] ${config.appName} listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${addr.port}`);
  return server;
}

function shutdown(sig) {
  console.log(`[server] ${sig} received, shutting down…`);
  server.close(() => { try { db.close(); } catch {} process.exit(0); });
  setTimeout(() => process.exit(0), 10_000).unref();
}

// Never let one bad request take the whole app down: log and keep serving.
// (Docker's restart policy covers anything worse, such as running out of memory.)
process.on('unhandledRejection', (e) => console.error('[guard] unhandled rejection:', e));
process.on('uncaughtException', (e) => console.error('[guard] uncaught exception:', e));

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, 'server', 'index.js')) {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  start().catch((e) => { console.error('[server] failed to start:', e); process.exit(1); });
}

export { server };
