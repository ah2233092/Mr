// Tiny HTTP toolkit: router, JSON bodies, cookies, errors, static files.
// Zero dependencies keeps the server small, fast to boot and easy to deploy.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { config } from './config.js';

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

// ---------- router ----------
export class Router {
  constructor() { this.routes = []; }
  add(method, pattern, handler) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
    this.routes.push({ method, re, keys, handler });
  }
  get(p, h) { this.add('GET', p, h); }
  post(p, h) { this.add('POST', p, h); }
  patch(p, h) { this.add('PATCH', p, h); }
  delete(p, h) { this.add('DELETE', p, h); }
  match(method, pathname) {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.re.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { handler: r.handler, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
}

// ---------- request helpers ----------
export function readBody(req, limit = config.limits.maxBodyBytes) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Request is too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJson(req, limit) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); }
  catch { throw new HttpError(400, 'Invalid JSON body.'); }
}

export function parseCookies(req) {
  const out = {};
  const h = req.headers.cookie;
  if (!h) return out;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { out[k] = part.slice(i + 1).trim(); }
  }
  return out;
}

export function isSecureRequest(req) {
  if (config.cookieSecure === 'true') return true;
  if (config.cookieSecure === 'false') return false;
  if (req.socket.encrypted) return true;
  if (config.trustProxy && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https') return true;
  return false;
}

export function setCookie(req, res, name, value, { maxAge, httpOnly = true, path: p = '/', sameSite = 'Lax' } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${p}; SameSite=${sameSite}`;
  if (httpOnly) c += '; HttpOnly';
  if (maxAge !== undefined) c += `; Max-Age=${Math.floor(maxAge)}`;
  if (isSecureRequest(req)) c += '; Secure';
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, c) : c);
}

export function clientIp(req) {
  if (config.trustProxy) {
    const xf = req.headers['x-forwarded-for'];
    if (xf) return String(xf).split(',')[0].trim();
    if (req.headers['x-real-ip']) return String(req.headers['x-real-ip']);
  }
  return req.socket.remoteAddress || '0.0.0.0';
}

export function originOf(req) {
  if (config.publicUrl) return config.publicUrl;
  const proto = isSecureRequest(req) ? 'https' : 'http';
  const host = (config.trustProxy && req.headers['x-forwarded-host']) || req.headers.host;
  return `${proto}://${host}`;
}

// ---------- responses ----------
export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

export function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

export function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "font-src 'self' data: https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    "connect-src 'self' https://cdn.jsdelivr.net",
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    "media-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
  ].join('; '));
}

// ---------- SSE ----------
export function startSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  res.socket?.setNoDelay?.(true);
  const ping = setInterval(() => { if (!res.writableEnded) res.write(': ping\n\n'); }, 15000);
  res.on('close', () => clearInterval(ping));
  return {
    send(event, data) {
      if (res.writableEnded || res.destroyed) return false;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      return true;
    },
    end() { clearInterval(ping); if (!res.writableEnded) res.end(); },
  };
}

// ---------- static files (pre-compressed in memory) ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};
export const mimeOf = (p) => MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';

export function createStatic(dir) {
  const files = new Map();
  const load = (rel) => {
    const abs = path.join(dir, rel);
    const buf = fs.readFileSync(abs);
    const type = mimeOf(abs);
    const compressible = /text|javascript|json|svg|manifest/.test(type);
    const etag = '"' + crypto.createHash('sha1').update(buf).digest('base64url').slice(0, 16) + '"';
    files.set('/' + rel.split(path.sep).join('/'), {
      buf, type, etag,
      br: compressible && buf.length > 512 ? zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 10 } }) : null,
      gz: compressible && buf.length > 512 ? zlib.gzipSync(buf, { level: 9 }) : null,
    });
  };
  const walk = (rel = '') => {
    for (const ent of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = path.join(rel, ent.name);
      if (ent.isDirectory()) walk(r); else load(r);
    }
  };
  walk();

  return function serve(req, res, pathname) {
    const f = files.get(pathname);
    if (!f) return false;
    const longCache = pathname.startsWith('/vendor/') || pathname.startsWith('/icons/');
    res.setHeader('Content-Type', f.type);
    res.setHeader('ETag', f.etag);
    res.setHeader('Cache-Control', longCache ? 'public, max-age=604800' : 'no-cache');
    res.setHeader('Vary', 'Accept-Encoding');
    if (pathname === '/sw.js') res.setHeader('Service-Worker-Allowed', '/');
    if (req.headers['if-none-match'] === f.etag) { res.writeHead(304); res.end(); return true; }
    const ae = String(req.headers['accept-encoding'] || '');
    let body = f.buf;
    if (f.br && /\bbr\b/.test(ae)) { body = f.br; res.setHeader('Content-Encoding', 'br'); }
    else if (f.gz && /\bgzip\b/.test(ae)) { body = f.gz; res.setHeader('Content-Encoding', 'gzip'); }
    res.setHeader('Content-Length', body.length);
    res.writeHead(200);
    res.end(req.method === 'HEAD' ? undefined : body);
    return true;
  };
}
