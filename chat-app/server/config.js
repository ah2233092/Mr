// Central configuration. Everything is driven by environment variables
// (or a .env file next to package.json) so nothing secret lives in code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile) && !process.env.SKIP_DOTENV) {
  try { process.loadEnvFile(envFile); } catch (e) { console.warn('[config] could not read .env:', e.message); }
}

const env = process.env;
const int = (v, d) => (v === undefined || v === '' || isNaN(+v) ? d : parseInt(v, 10));
const bool = (v, d) => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(v));
const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const regex = (v) => { if (!v) return null; try { return new RegExp(v, 'i'); } catch { return null; } };

export const config = {
  port: int(env.PORT, 3000),
  host: env.HOST || '0.0.0.0',
  appName: env.APP_NAME || 'Sukhan AI Pro',
  publicUrl: (env.PUBLIC_URL || '').replace(/\/+$/, ''),
  dataDir: path.resolve(ROOT, env.DATA_DIR || 'data'),
  cookieSecure: (env.COOKIE_SECURE || 'auto').toLowerCase(), // auto | true | false
  trustProxy: bool(env.TRUST_PROXY, true),
  adminEmails: list(env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
  allowSignup: bool(env.ALLOW_SIGNUP, true),
  // Desktop app: new accounts only from the PC itself; other devices (your phone) just log in.
  localSignupOnly: bool(env.LOCAL_SIGNUP_ONLY, false),
  sessionDays: int(env.SESSION_DAYS, 30),
  signupsPerIpPerHour: int(env.SIGNUPS_PER_IP_PER_HOUR, 30),

  // Per-user limits. 0 = unlimited (the default for a personal app).
  limits: {
    userPerMinute: int(env.USER_MSGS_PER_MINUTE, 0),
    userPerDay: int(env.USER_MSGS_PER_DAY, 0),
    paidPerDay: int(env.USER_PAID_MSGS_PER_DAY, 0),
    imagesPerDay: int(env.USER_IMAGES_PER_DAY, 0),
    userConcurrent: int(env.USER_CONCURRENT, 0),
    providerConcurrency: int(env.PROVIDER_CONCURRENCY, 32),
    queueWaitMs: int(env.QUEUE_WAIT_MS, 20000),
    firstTokenTimeoutMs: int(env.FIRST_TOKEN_TIMEOUT_MS, 25000),
    maxBodyBytes: int(env.MAX_BODY_MB, 20) * 1024 * 1024,
  },

  context: {
    maxChars: int(env.CONTEXT_MAX_CHARS, 60000),
    maxMessages: int(env.CONTEXT_MAX_MESSAGES, 40),
  },

  models: {
    default: env.DEFAULT_MODEL || '',     // e.g. "openai:gpt-6-sol"; empty = best ChatGPT model, else Auto
    auto: list(env.AUTO_MODELS),            // e.g. "cerebras:gpt-oss-120b,groq:openai/gpt-oss-120b"
    featured: list(env.FEATURED_MODELS),
    allow: regex(env.MODEL_ALLOW_REGEX),
    block: regex(env.MODEL_BLOCK_REGEX),
    refreshMinutes: int(env.MODEL_REFRESH_MINUTES, 5),
    openrouterAll: bool(env.OPENROUTER_ALL_MODELS, false),
  },

  images: {
    order: list(env.IMAGE_PROVIDERS),      // e.g. "openai,gemini,cloudflare,together,pollinations"
    enhancePrompts: bool(env.IMAGE_PROMPT_ENHANCE, true),
    pollinations: bool(env.ENABLE_POLLINATIONS, true),
  },

  google: { clientId: env.GOOGLE_CLIENT_ID || '', clientSecret: env.GOOGLE_CLIENT_SECRET || '' },
  resend: { apiKey: env.RESEND_API_KEY || '', from: env.MAIL_FROM || '' },
  systemPrompt: env.SYSTEM_PROMPT || '',
  enableMock: bool(env.ENABLE_MOCK, false),
  mockDelayMs: int(env.MOCK_TOKEN_DELAY_MS, 15),
  logRequests: bool(env.LOG_REQUESTS, false),
};

export function isProd() { return env.NODE_ENV === 'production'; }
