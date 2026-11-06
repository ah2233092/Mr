// AI keys managed from inside the app (Settings → AI keys), so nobody has to
// edit .env. Saved values live in the database and override .env.
import { q, now } from './db.js';

export const KEY_FIELDS = [
  { key: 'CEREBRAS_API_KEY', label: 'Cerebras', note: 'Free · fastest replies (GPT-OSS 120B, Llama, Qwen)', url: 'https://cloud.cerebras.ai', group: 'Free AI (recommended)' },
  { key: 'GROQ_API_KEY', label: 'Groq', note: 'Free · very fast (GPT-OSS, Llama 3.3 70B, Llama 4)', url: 'https://console.groq.com/keys', group: 'Free AI (recommended)' },
  { key: 'GEMINI_API_KEY', label: 'Google Gemini', note: 'Free · smart, understands photos', url: 'https://aistudio.google.com/apikey', group: 'Free AI (recommended)' },
  { key: 'OPENROUTER_API_KEY', label: 'OpenRouter', note: 'Free models (":free")', url: 'https://openrouter.ai/keys', group: 'More free AI' },
  { key: 'MISTRAL_API_KEY', label: 'Mistral', note: 'Free plan', url: 'https://console.mistral.ai/api-keys', group: 'More free AI' },
  { key: 'CF_ACCOUNT_ID', label: 'Cloudflare account ID', note: 'Free FLUX image generation (with the token below)', url: 'https://dash.cloudflare.com', group: 'Images', plain: true },
  { key: 'CF_API_TOKEN', label: 'Cloudflare API token', note: 'Token with "Workers AI" permission', url: 'https://dash.cloudflare.com/profile/api-tokens', group: 'Images' },
  { key: 'TOGETHER_API_KEY', label: 'Together AI', note: 'FLUX images', url: 'https://api.together.xyz/settings/api-keys', group: 'Images' },
  { key: 'OPENAI_API_KEY', label: 'OpenAI', note: 'Paid · ChatGPT models (GPT-6, GPT-5…) — set a budget in your OpenAI account', url: 'https://platform.openai.com/api-keys', group: 'ChatGPT models (paid)' },
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic', note: 'Paid', url: 'https://console.anthropic.com/settings/keys', group: 'Other paid AI' },
  { key: 'XAI_API_KEY', label: 'xAI (Grok)', note: 'Paid', url: 'https://console.x.ai', group: 'Other paid AI' },
  { key: 'DEEPSEEK_API_KEY', label: 'DeepSeek', note: 'Paid', url: 'https://platform.deepseek.com/api_keys', group: 'Other paid AI' },
  { key: 'OMNIROUTE_BASE_URL', label: 'OmniRoute address', note: 'Set automatically by the installer', group: 'OmniRoute', plain: true },
  { key: 'OMNIROUTE_API_KEY', label: 'OmniRoute API key', note: 'Set automatically by the installer', group: 'OmniRoute' },
  { key: 'OMNIROUTE_IMAGE_MODEL', label: 'OmniRoute image model', note: 'Exact model id from the OmniRoute dashboard', group: 'OmniRoute', plain: true },
];
const ALLOWED = new Set(KEY_FIELDS.map((f) => f.key));

// Called once at startup: saved values win over .env.
export function applySavedKeys() {
  for (const row of q('SELECT key, value FROM app_settings').all()) {
    if (ALLOWED.has(row.key)) process.env[row.key] = row.value;
  }
}

const mask = (v) => (v.length <= 8 ? '••••' : `••••${v.slice(-4)}`);

export function listKeys() {
  return KEY_FIELDS.map((f) => {
    const v = process.env[f.key] || '';
    return { ...f, set: !!v, value: f.plain ? v : (v ? mask(v) : '') };
  });
}

// values: { KEY: 'new value' }  ('' removes it). Masked values ("••••1234") are ignored.
export function saveKeys(values) {
  const changed = [];
  for (const [k, raw] of Object.entries(values || {})) {
    if (!ALLOWED.has(k) || typeof raw !== 'string') continue;
    const v = raw.trim();
    if (v.startsWith('••••')) continue;
    if (v.length > 2000 || /[\r\n]/.test(v)) continue;
    if (v) {
      q(`INSERT INTO app_settings(key, value, updated_at) VALUES(?,?,?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).run(k, v, now());
      process.env[k] = v;
    } else {
      q('DELETE FROM app_settings WHERE key=?').run(k);
      process.env[k] = '';
    }
    changed.push(k);
  }
  return changed;
}
