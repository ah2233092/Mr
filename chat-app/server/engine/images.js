// Image generation with several back-ends and automatic fallback.
// Prompts are first rewritten by a fast LLM (like ChatGPT does internally),
// which makes a big difference to image quality.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { q, now, newId } from '../db.js';
import { cooldowns } from './registry.js';
import { quickComplete } from './engine.js';
import { mockImage } from './providers.js';

const env = process.env;

const SIZES = {
  openai: { '1:1': '1024x1024', '16:9': '1536x1024', '9:16': '1024x1536' },
  wh: { '1:1': [1024, 1024], '16:9': [1344, 768], '9:16': [768, 1344] },
};

async function fetchJson(url, opts, ms = 90000) {
  const r = await fetch(url, { ...opts, signal: opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms) });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch {}
  if (!r.ok) {
    let msg = j?.error?.message || j?.errors?.[0]?.message || j?.message || text.slice(0, 300) || `HTTP ${r.status}`;
    if (typeof msg !== 'string') msg = JSON.stringify(msg);
    const err = new Error(msg); err.status = r.status; throw err;
  }
  return j;
}

export const IMAGE_BACKENDS = {
  // OmniRoute's OpenAI-compatible images endpoint. Pick the image model in OMNIROUTE_IMAGE_MODEL
  // (any image model connected in the OmniRoute dashboard, e.g. a FLUX model).
  omniroute: {
    label: 'OmniRoute', tier: 'free', model: () => env.OMNIROUTE_IMAGE_MODEL || '',
    enabled: () => !!(env.OMNIROUTE_BASE_URL && env.OMNIROUTE_IMAGE_MODEL),
    async run(prompt, aspect, signal) {
      const base = env.OMNIROUTE_BASE_URL.replace(/\/+$/, '');
      const model = this.model();
      const headers = { 'Content-Type': 'application/json' };
      if (env.OMNIROUTE_API_KEY) headers.Authorization = `Bearer ${env.OMNIROUTE_API_KEY}`;
      const j = await fetchJson(`${base}/images/generations`, {
        method: 'POST', signal, headers,
        body: JSON.stringify({ model, prompt, n: 1, size: SIZES.openai[aspect] || '1024x1024', response_format: 'b64_json' }),
      }, 180000);
      const d = j?.data?.[0];
      if (d?.b64_json) return { buf: Buffer.from(d.b64_json, 'base64'), mime: 'image/png', model: model.slice(model.lastIndexOf('/') + 1) };
      if (d?.url) {
        const url = /^https?:/i.test(d.url) ? d.url : new URL(d.url, base).href;
        const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
        const type = r.headers.get('content-type') || 'image/png';
        if (!r.ok || !type.startsWith('image/')) throw new Error(`image download failed: HTTP ${r.status}`);
        return { buf: Buffer.from(await r.arrayBuffer()), mime: type.split(';')[0], model: model.slice(model.lastIndexOf('/') + 1) };
      }
      throw new Error('no image in response');
    },
  },
  openai: {
    label: 'OpenAI', tier: 'paid', model: () => env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    enabled: () => !!env.OPENAI_API_KEY && env.OPENAI_IMAGES !== 'false',
    async run(prompt, aspect, signal) {
      const model = this.model();
      const body = { model, prompt, n: 1, size: SIZES.openai[aspect] || '1024x1024' };
      if (model.startsWith('dall-e')) { body.response_format = 'b64_json'; if (model === 'dall-e-3') body.size = { '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792' }[aspect]; }
      else body.quality = env.OPENAI_IMAGE_QUALITY || 'medium';
      const j = await fetchJson('https://api.openai.com/v1/images/generations', {
        method: 'POST', signal, headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }, 180000);
      const b64 = j?.data?.[0]?.b64_json;
      if (!b64) throw new Error('no image in response');
      return { buf: Buffer.from(b64, 'base64'), mime: 'image/png', model };
    },
  },
  gemini: {
    label: 'Google', tier: 'paid', model: () => env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',
    enabled: () => !!env.GEMINI_API_KEY && env.GEMINI_IMAGES !== 'false',
    async run(prompt, aspect, signal) {
      const model = this.model();
      const j = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', signal, headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: aspect } },
        }),
      }, 120000);
      const part = (j?.candidates?.[0]?.content?.parts || []).find((x) => x.inlineData?.data);
      if (!part) throw new Error('no image in response');
      return { buf: Buffer.from(part.inlineData.data, 'base64'), mime: part.inlineData.mimeType || 'image/png', model };
    },
  },
  cloudflare: {
    label: 'Cloudflare', tier: 'free', model: () => env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell',
    enabled: () => !!(env.CF_ACCOUNT_ID && env.CF_API_TOKEN),
    async run(prompt, aspect, signal) {
      const model = this.model();
      const j = await fetchJson(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/${model}`, {
        method: 'POST', signal, headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, steps: 8 }),
      }, 90000);
      const b64 = j?.result?.image;
      if (!b64) throw new Error('no image in response');
      return { buf: Buffer.from(b64, 'base64'), mime: 'image/jpeg', model };
    },
  },
  together: {
    label: 'Together', tier: 'free', model: () => env.TOGETHER_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell-Free',
    enabled: () => !!env.TOGETHER_API_KEY,
    async run(prompt, aspect, signal) {
      const model = this.model();
      const [width, height] = SIZES.wh[aspect] || SIZES.wh['1:1'];
      const j = await fetchJson('https://api.together.xyz/v1/images/generations', {
        method: 'POST', signal, headers: { Authorization: `Bearer ${env.TOGETHER_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, width, height, steps: 4, n: 1, response_format: 'b64_json' }),
      }, 90000);
      const b64 = j?.data?.[0]?.b64_json;
      if (!b64) throw new Error('no image in response');
      return { buf: Buffer.from(b64, 'base64'), mime: 'image/jpeg', model };
    },
  },
  pollinations: {
    label: 'Pollinations', tier: 'free', model: () => env.POLLINATIONS_MODEL || 'flux',
    enabled: () => config.images.pollinations,
    async run(prompt, aspect, signal) {
      const model = this.model();
      const [width, height] = SIZES.wh[aspect] || SIZES.wh['1:1'];
      const seed = Math.floor(Math.random() * 1e9);
      const key = env.POLLINATIONS_API_KEY;
      const base = key ? 'https://gen.pollinations.ai/image/' : 'https://image.pollinations.ai/prompt/';
      const url = `${base}${encodeURIComponent(prompt.slice(0, 1500))}?width=${width}&height=${height}&seed=${seed}&model=${encodeURIComponent(model)}&nologo=true&private=true`;
      const r = await fetch(url, {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
        signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(90000)]),
      });
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !type.startsWith('image/')) { const err = new Error(`HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`); err.status = r.status; throw err; }
      return { buf: Buffer.from(await r.arrayBuffer()), mime: type.split(';')[0], model };
    },
  },
  mock: {
    label: 'Mock', tier: 'free', model: () => 'mock-image', enabled: () => config.enableMock,
    async run() { await new Promise((r) => setTimeout(r, 50)); return { buf: mockImage(), mime: 'image/png', model: 'mock-image' }; },
  },
};

const DEFAULT_ORDER = ['omniroute', 'cloudflare', 'together', 'gemini', 'pollinations', 'openai', 'mock'];

export function imageBackends() {
  const order = config.images.order.length ? config.images.order : DEFAULT_ORDER;
  return order.filter((id) => IMAGE_BACKENDS[id]?.enabled());
}

// ---------- intent detection ----------
const IMG_EN = /^\s*(?:please\s+|can you\s+|could you\s+|pls\s+)?(?:generate|create|make|draw|design|paint|render|sketch|imagine|produce)\b[^?\n]{0,60}?\b(?:image|picture|photo|pic|logo|poster|wallpaper|illustration|drawing|painting|art(?:work)?|portrait|sketch|icon|banner|thumbnail|avatar|sticker|cartoon|render)s?\b/i;
const IMG_UR = /\b(?:tasveer|tasvir|tasweer|image|photo|pic|picture|logo|poster|wallpaper|thumbnail)\b[^?\n]{0,50}?\b(?:bana(?:o|do|dein|den|na|ein|yein|ye)?|bna(?:o|do|dein|den|na)?|banaiye|generate\s+kar(?:o|do|ein)?|create\s+kar(?:o|do|ein)?)\b/i;
export function looksLikeImageRequest(text) {
  const t = String(text || '');
  if (/^\s*\/(image|img|imagine)\b/i.test(t)) return true;
  return IMG_EN.test(t) || IMG_UR.test(t);
}

function guessAspect(text) {
  const t = text.toLowerCase();
  if (/9:16|portrait|vertical|phone wallpaper|mobile wallpaper|story|reel|tiktok|poster/.test(t)) return '9:16';
  if (/16:9|landscape|wide|widescreen|banner|youtube|thumbnail|desktop wallpaper|cinematic/.test(t)) return '16:9';
  return '1:1';
}

const ENHANCE_SYSTEM = `You turn a user's request into one excellent prompt for an AI image generator (image prompt writer).
Return ONLY compact JSON: {"prompt":"...","aspect":"1:1|16:9|9:16"}.
Rules: write the prompt in English (translate from any language, including Roman Urdu/Hindi). Keep exactly the subject, people, objects and style the user asked for, never change their intent.
Add concrete visual detail: composition, setting, lighting, colour palette, mood, lens/medium or art style, and quality cues. If the user wants text in the image, put the exact words in double quotes.
Choose aspect: 9:16 for phone wallpapers/posters/stories, 16:9 for banners/thumbnails/landscapes/desktop, else 1:1. Max 110 words.`;

export async function planImage(userText) {
  const raw = userText.replace(/^\s*\/(image|img|imagine)\b/i, '').trim();
  let prompt = raw, aspect = guessAspect(raw);
  if (config.images.enhancePrompts) {
    const out = await quickComplete(ENHANCE_SYSTEM, raw, { timeoutMs: 7000 });
    if (out) {
      try {
        const j = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
        if (j.prompt && j.prompt.length > 5) prompt = String(j.prompt).slice(0, 1500);
        if (['1:1', '16:9', '9:16'].includes(j.aspect)) aspect = j.aspect;
      } catch {}
    }
  }
  return { prompt, aspect, original: raw };
}

export async function generateImage({ userId, prompt, aspect, signal }) {
  const backends = imageBackends();
  if (!backends.length) throw new Error('No image generator is configured. Add an image provider key (see README).');
  const errors = [];
  const healthy = backends.filter((id) => !cooldowns.active(`img:${id}`));
  const order = healthy.length ? [...healthy, ...backends.filter((id) => !healthy.includes(id))] : backends;
  for (const id of order) {
    if (signal?.aborted) throw new Error('cancelled');
    const b = IMAGE_BACKENDS[id];
    try {
      const out = await b.run(prompt, aspect, signal);
      if (!out.buf || out.buf.length < 60) throw new Error('empty image');
      const ext = out.mime.includes('jpeg') ? 'jpg' : out.mime.includes('webp') ? 'webp' : 'png';
      const fileId = `${newId(16)}.${ext}`;
      await fs.promises.writeFile(path.join(config.dataDir, 'files', fileId), out.buf);
      q('INSERT INTO files(id, user_id, mime, kind, bytes, created_at) VALUES(?,?,?,?,?,?)').run(fileId, userId, out.mime, 'generated', out.buf.length, now());
      return { fileId, url: `/files/${fileId}`, mime: out.mime, provider: id, providerLabel: b.label, model: out.model, tier: b.tier, aspect };
    } catch (e) {
      if (signal?.aborted) throw new Error('cancelled');
      const st = e.status || 0;
      const msg = String(e.message || e).slice(0, 200);
      errors.push(`${b.label}: ${msg}`);
      const long = st === 401 || st === 403 || /limit:\s*0|billing|not available in your|quota/i.test(msg);
      cooldowns.set(`img:${id}`, long ? 3 * 3600e3 : st === 429 ? 60e3 : 20e3, long ? 'unavailable' : 'failed');
      console.warn(`[images] ${id} failed: ${msg}`);
    }
  }
  const err = new Error('Image generation failed on every provider. ' + errors.join(' | '));
  err.details = errors;
  throw err;
}
