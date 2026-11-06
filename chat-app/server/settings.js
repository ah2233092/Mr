// Backend-only settings stored in the database (never shown in the chat UI).
// Used for values the app sets up by itself, such as the OmniRoute API key it
// creates automatically. Saved values override .env.
import { q, now } from './db.js';

const ALLOWED = new Set([
  'OMNIROUTE_BASE_URL', 'OMNIROUTE_API_KEY', 'OMNIROUTE_API_KEY_AUTO', 'OMNIROUTE_IMAGE_MODEL',
]);

export function applySavedKeys() {
  for (const row of q('SELECT key, value FROM app_settings').all()) {
    if (ALLOWED.has(row.key)) process.env[row.key] = row.value;
  }
}

export function saveSetting(key, value) {
  if (!ALLOWED.has(key)) throw new Error(`unknown setting ${key}`);
  if (value) {
    q(`INSERT INTO app_settings(key, value, updated_at) VALUES(?,?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).run(key, String(value), now());
    process.env[key] = String(value);
  } else {
    q('DELETE FROM app_settings WHERE key=?').run(key);
    delete process.env[key];
  }
}
