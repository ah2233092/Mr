// Connects the app to OmniRoute automatically — no keys or settings in the UI.
// 1. Uses OMNIROUTE_BASE_URL, or the OmniRoute running on this computer (localhost:20128).
// 2. If OmniRoute accepts requests without a key, nothing else is needed.
// 3. If it asks for a key, the app logs into the OmniRoute dashboard (OMNIROUTE_PASSWORD,
//    else OmniRoute's default password) and creates its own API key, saved in the database.
import { saveSetting } from '../settings.js';

const env = process.env;
const DEFAULT_PASSWORD = 'CHANGEME'; // OmniRoute's documented first-run password
let lastLog = '';

function log(msg) { if (msg !== lastLog) { lastLog = msg; console.log(`[omniroute] ${msg}`); } }

export function omniBase() {
  const v = env.OMNIROUTE_BASE_URL;
  if (v === 'off') return '';
  return (v || 'http://127.0.0.1:20128/v1').replace(/\/+$/, '');
}

async function probe(base, key) {
  try {
    const r = await fetch(`${base}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(4000),
    });
    return r.status;
  } catch { return 0; }
}

async function createKey(origin) {
  const passwords = [env.OMNIROUTE_PASSWORD, DEFAULT_PASSWORD].filter(Boolean);
  for (const password of [...new Set(passwords)]) {
    try {
      const login = await fetch(`${origin}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }), signal: AbortSignal.timeout(8000),
      });
      if (!login.ok) continue;
      const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
      const r = await fetch(`${origin}/api/keys`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ name: 'chatgpt-app' }), signal: AbortSignal.timeout(8000),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && typeof j.key === 'string' && j.key) return j.key;
    } catch {}
  }
  return null;
}

// Returns 'off' | 'down' | 'ready' | 'needs-password'
export async function ensureOmniRoute() {
  const base = omniBase();
  if (!base) return 'off';
  const key = env.OMNIROUTE_API_KEY || '';
  const status = await probe(base, key);
  if (status === 0) { log(`not reachable at ${base} (start OmniRoute, the app keeps checking)`); return 'down'; }
  if (status !== 401 && status !== 403) { log(`connected at ${base}`); return 'ready'; }

  // A key is needed (or ours stopped working): make one.
  if (key && env.OMNIROUTE_API_KEY_AUTO === '1') saveSetting('OMNIROUTE_API_KEY', '');
  const created = await createKey(new URL(base).origin);
  if (created) {
    saveSetting('OMNIROUTE_API_KEY', created);
    saveSetting('OMNIROUTE_API_KEY_AUTO', '1');
    log(`connected at ${base} (created its own API key)`);
    return 'ready';
  }
  log('OmniRoute asks for an API key and its dashboard password is not the default. ' +
      'Set OMNIROUTE_PASSWORD (dashboard password) or OMNIROUTE_API_KEY in the server settings.');
  return 'needs-password';
}
