// AI provider adapters. Almost every major provider now speaks the OpenAI
// "chat/completions" protocol, so one streaming adapter covers all of them.
// A provider is switched on simply by putting its API key in the environment.
import { config } from '../config.js';

const env = process.env;

export class ProviderError extends Error {
  constructor(status, message, { retryAfterMs, kind } = {}) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.kind = kind; // rate_limit | auth | model | bad_request | server | network | timeout
  }
}

// tier: "free"  -> provider offers a free tier (owner pays nothing within its limits)
//       "paid"  -> every request costs the owner money; users get a smaller daily cap
// speed: rough tokens/sec class, used to order the "Auto" model.
export const PROVIDERS = [
  { id: 'cerebras', label: 'Cerebras', base: 'https://api.cerebras.ai/v1', keyEnv: 'CEREBRAS_API_KEY', tier: 'free', speed: 3,
    fallbackModels: ['gpt-oss-120b', 'llama-3.3-70b', 'qwen-3-235b-a22b-instruct-2507', 'llama3.1-8b'] },
  { id: 'groq', label: 'Groq', base: 'https://api.groq.com/openai/v1', keyEnv: 'GROQ_API_KEY', tier: 'free', speed: 3,
    fallbackModels: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.1-8b-instant'] },
  { id: 'gemini', label: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', keyEnv: 'GEMINI_API_KEY', tier: 'free', speed: 2,
    fallbackModels: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] },
  { id: 'mistral', label: 'Mistral', base: 'https://api.mistral.ai/v1', keyEnv: 'MISTRAL_API_KEY', tier: 'free', speed: 2,
    fallbackModels: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'] },
  { id: 'openrouter', label: 'OpenRouter', base: 'https://openrouter.ai/api/v1', keyEnv: 'OPENROUTER_API_KEY', tier: 'free', speed: 1,
    fallbackModels: ['openai/gpt-oss-120b:free', 'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3.1:free'],
    headers: () => ({ 'HTTP-Referer': config.publicUrl || 'http://localhost', 'X-Title': config.appName }) },
  { id: 'openai', label: 'OpenAI', base: 'https://api.openai.com/v1', keyEnv: 'OPENAI_API_KEY', tier: 'paid', speed: 2,
    fallbackModels: ['gpt-5-mini', 'gpt-4.1-mini'], openaiStyle: true },
  { id: 'anthropic', label: 'Anthropic', base: 'https://api.anthropic.com/v1', keyEnv: 'ANTHROPIC_API_KEY', tier: 'paid', speed: 2,
    fallbackModels: [], needsMaxTokens: true,
    headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }) },
  { id: 'xai', label: 'xAI', base: 'https://api.x.ai/v1', keyEnv: 'XAI_API_KEY', tier: 'paid', speed: 2, fallbackModels: [] },
  { id: 'deepseek', label: 'DeepSeek', base: 'https://api.deepseek.com/v1', keyEnv: 'DEEPSEEK_API_KEY', tier: 'paid', speed: 1,
    fallbackModels: ['deepseek-chat', 'deepseek-reasoner'] },
  // Any other OpenAI-compatible server (Together, DeepInfra, Fireworks, Ollama, vLLM, LM Studio...)
  { id: 'custom', label: env.CUSTOM_LABEL || 'Custom', base: (env.CUSTOM_BASE_URL || '').replace(/\/+$/, ''), keyEnv: 'CUSTOM_API_KEY',
    tier: env.CUSTOM_TIER === 'paid' ? 'paid' : 'free', speed: 2, fallbackModels: [], keyOptional: true },
];

export function providerKey(p) { return env[p.keyEnv] || ''; }

export function enabledProviders() {
  const list = PROVIDERS.filter((p) => {
    if (p.id === 'custom') return !!p.base;
    return !!providerKey(p) && p.base;
  });
  if (config.enableMock) list.push(MOCK);
  return list;
}

function providerHeaders(p) {
  const key = providerKey(p);
  const h = { 'Content-Type': 'application/json' };
  if (key) h.Authorization = `Bearer ${key}`;
  return Object.assign(h, p.headers ? p.headers(key) : {});
}

function extraBody(p) {
  const raw = env[`${p.id.toUpperCase()}_EXTRA_BODY`];
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// ---------- model discovery ----------
export async function discoverModels(p) {
  const fixed = env[`${p.id.toUpperCase()}_MODELS`];
  if (fixed) return fixed.split(',').map((s) => ({ id: s.trim() })).filter((m) => m.id);
  if (p.id === 'mock') return MOCK.fallbackModels.map((id) => ({ id }));
  try {
    const r = await fetch(`${p.base}/models`, { headers: providerHeaders(p), signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j.data || j.models || []);
    const out = arr.map((m) => ({
      id: String(m.id || m.name || '').replace(/^models\//, ''),
      name: m.display_name || m.displayName || null,
      inputModalities: m.architecture?.input_modalities || null,
    })).filter((m) => m.id);
    if (!out.length) throw new Error('empty model list');
    return out;
  } catch (e) {
    console.warn(`[models] ${p.id}: discovery failed (${e.message}); using built-in list`);
    return p.fallbackModels.map((id) => ({ id }));
  }
}

const NOT_CHAT = /(embed|whisper|tts|transcri|audio|realtime|moderation|guard|dall-e|image|imagen|veo|sora|search|davinci|babbage|computer-use|native-audio|-live|aqa|rerank|playai|speech|deep-research|codex|learnlm|robotics|ocr|-diarize|gpt-3\.5|gpt-4-|^gpt-4$|lyria|nano-banana)/i;

export function isChatModel(p, m) {
  const id = m.id;
  if (NOT_CHAT.test(id)) return false;
  if (p.id === 'openai') {
    if (!/^(gpt-|o\d|chatgpt-)/.test(id)) return false;
    if (/-\d{4}-\d{2}-\d{2}$/.test(id)) return false; // dated snapshots duplicate the alias
  }
  if (p.id === 'gemini' && !/^(gemini|gemma-3)/.test(id)) return false;
  if (p.id === 'gemini' && /(thinking-exp|-tuning|-001$|-002$|^gemini-1\.|^gemini-2\.0)/.test(id)) return false;
  if (p.id === 'anthropic' && !/^claude-/.test(id)) return false;
  if (p.id === 'groq' && /compound|allam|saba/.test(id)) return false;
  if (p.id === 'mistral' && /(ocr|embed|moderation|codestral-mamba|pixtral-12b)/.test(id)) return false;
  if (p.id === 'openrouter' && !config.models.openrouterAll && !id.endsWith(':free')) return false;
  return true;
}

// ---------- naming / capabilities / ranking ----------
const WORDS = { gpt: 'GPT', oss: 'OSS', llama: 'Llama', llama3: 'Llama 3', gemini: 'Gemini', gemma: 'Gemma', claude: 'Claude',
  qwen: 'Qwen', qwen3: 'Qwen3', deepseek: 'DeepSeek', mistral: 'Mistral', grok: 'Grok', kimi: 'Kimi', glm: 'GLM',
  chatgpt: 'ChatGPT', mixtral: 'Mixtral', ministral: 'Ministral', magistral: 'Magistral', pixtral: 'Pixtral', codestral: 'Codestral',
  phi: 'Phi', nemotron: 'Nemotron', hermes: 'Hermes', r1: 'R1', v3: 'V3', vl: 'VL' };

export function prettyName(id) {
  let s = id.replace(/^models\//, '').replace(/:free$/, '');
  s = s.slice(s.lastIndexOf('/') + 1);
  const t = s.split('-');
  const out = [];
  for (let i = 0; i < t.length; i++) {
    const w = t[i]; const lw = w.toLowerCase();
    if (lw === 'gpt' && t[i + 1] && /^\d/.test(t[i + 1])) { out.push('GPT-' + t[++i]); continue; }
    if (lw === 'gpt' && t[i + 1]?.toLowerCase() === 'oss') { out.push('GPT-OSS'); i++; continue; }
    if (/^\d{4,8}$/.test(w) || /^(instruct|it|latest|chat|hf)$/i.test(w)) continue;
    if (/^\d+(\.\d+)?[bmk]$/i.test(w) || /^a\d+b$/i.test(w) || /^\d+e$/i.test(w)) { out.push(w.toUpperCase()); continue; }
    if (WORDS[lw]) { out.push(WORDS[lw]); continue; }
    if (/^o\d/.test(lw)) { out.push(lw); continue; }
    out.push(w.charAt(0).toUpperCase() + w.slice(1));
  }
  return out.join(' ').replace(/\s+/g, ' ').trim() || id;
}

const VISION = /(gpt-4o|gpt-4\.1|gpt-5|gpt-6|^o3|^o4|gemini|claude|llama-4|vision|pixtral|grok-4|qwen.*vl|gemma-3|mistral-medium|mistral-small|mistral-large|kimi.*vl|mock-vision)/i;
export function supportsVision(p, id, inputModalities) {
  if (Array.isArray(inputModalities)) return inputModalities.includes('image');
  if (/gpt-oss|deepseek|llama-3|qwen-3-235b|llama3/i.test(id)) return false;
  if (p.id === 'cerebras') return false;
  return VISION.test(id);
}

const RANK = [
  [/gpt-6/, 100], [/claude.*opus/, 98], [/gemini-[3-9].*pro/, 96], [/gpt-5\.\d/, 95], [/claude.*sonnet/, 94], [/gpt-5/, 92],
  [/grok-[4-9]/, 90], [/gemini-[3-9].*flash(?!-lite)/, 88], [/gemini-2\.5-pro/, 88], [/^o[3-9]/, 87], [/deepseek.*(r1|reasoner)/, 85],
  [/kimi-k2/, 84], [/deepseek/, 83], [/claude.*haiku/, 82], [/qwen-?3.*235b|qwen3-235b/, 81], [/gpt-oss-120b/, 80],
  [/gemini-2\.5-flash(?!-lite)/, 79], [/glm-4/, 78], [/mistral-large|mistral-medium|magistral-medium/, 77], [/gpt-4\.1|gpt-4o/, 76],
  [/llama-4-maverick/, 75], [/flash-lite/, 72], [/llama-3\.3-70b|llama-3\.1-70b|llama3\.3-70b/, 71], [/llama-4-scout/, 69],
  [/qwen/, 68], [/gpt-oss-20b/, 67], [/mistral-small|magistral-small/, 66], [/gemma-3.*27b/, 62], [/(^|-)(8b|7b|9b|3b|1b)/, 45],
];
export function rankModel(id) {
  const s = id.toLowerCase();
  let score = 55;
  for (const [re, v] of RANK) if (re.test(s)) { score = v; break; }
  if (/mini/.test(s) && score > 80) score -= 10;
  if (/nano/.test(s) && score > 70) score -= 18;
  if (/preview|exp/.test(s)) score -= 1;
  return score;
}

export function describeModel(p, score) {
  if (p.tier === 'paid') return score >= 92 ? 'Flagship · uses paid credits' : 'Paid model';
  if (p.speed >= 3) return score >= 78 ? 'Ultra-fast · strong reasoning' : 'Ultra-fast';
  return score >= 85 ? 'Smart · great for hard questions' : score >= 70 ? 'Fast and capable' : 'Lightweight';
}

// ---------- streaming chat ----------
function classify(status, message) {
  const m = message.toLowerCase();
  if (status === 429 || /rate limit|quota|resource_exhausted|too many requests/.test(m)) return 'rate_limit';
  if (status === 401 || status === 403) return 'auth';
  if (status === 404 || /model.*(not found|does not exist|not supported|decommissioned|deprecated)|no endpoints found/.test(m)) return 'model';
  if (status === 400 || status === 422) return 'bad_request';
  if (status >= 500) return 'server';
  return 'server';
}

function retryAfterMs(res, message) {
  const ra = res?.headers?.get?.('retry-after');
  if (ra && !isNaN(+ra)) return Math.min(+ra * 1000, 10 * 60 * 1000);
  const m = /retry in ([\d.]+)\s*s/i.exec(message || '');
  if (m) return Math.min(parseFloat(m[1]) * 1000, 10 * 60 * 1000);
  return null;
}

async function errorFrom(res) {
  const text = await res.text().catch(() => '');
  let msg = text.slice(0, 500);
  try {
    let j = JSON.parse(text);
    if (Array.isArray(j)) j = j[0];
    msg = j?.error?.message || j?.message || j?.detail || msg;
    if (typeof msg !== 'string') msg = JSON.stringify(msg);
  } catch {}
  return new ProviderError(res.status, msg || `HTTP ${res.status}`, { kind: classify(res.status, msg), retryAfterMs: retryAfterMs(res, msg) });
}

async function* lines(body) {
  const dec = new TextDecoder();
  let buf = '';
  for await (const chunk of body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      yield buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
    }
  }
  buf += dec.decode();
  if (buf) yield buf;
}

// Yields {type:'text'|'reasoning', text} and finally {type:'usage', ...} if sent.
export async function* streamChat(p, modelId, messages, { signal } = {}) {
  if (p.id === 'mock') { yield* mockStream(modelId, messages, signal); return; }
  const body = { model: modelId, messages, stream: true, ...extraBody(p) };
  if (p.needsMaxTokens) body.max_tokens = 8192;

  let res;
  try {
    res = await fetch(`${p.base}/chat/completions`, { method: 'POST', headers: providerHeaders(p), body: JSON.stringify(body), signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ProviderError(0, `network error: ${e.cause?.code || e.message}`, { kind: 'network' });
  }
  if (!res.ok) throw await errorFrom(res);

  for await (const line of lines(res.body)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data) continue;
    if (data === '[DONE]') return;
    let j;
    try { j = JSON.parse(data); } catch { continue; }
    if (j.error) {
      const msg = j.error.message || JSON.stringify(j.error);
      throw new ProviderError(j.error.code && +j.error.code >= 400 ? +j.error.code : 500, msg, { kind: classify(+j.error.code || 500, msg) });
    }
    const ch = j.choices?.[0];
    const d = ch?.delta || ch?.message;
    if (d) {
      const r = d.reasoning ?? d.reasoning_content;
      if (typeof r === 'string' && r) yield { type: 'reasoning', text: r };
      let c = d.content;
      if (Array.isArray(c)) c = c.map((x) => (typeof x === 'string' ? x : x?.text || '')).join('');
      if (typeof c === 'string' && c) yield { type: 'text', text: c };
    }
    if (j.usage) yield { type: 'usage', usage: j.usage };
  }
}

// ---------- mock provider (for local testing & load tests, never on by default) ----------
const MOCK = { id: 'mock', label: 'Mock (testing)', base: 'mock://', tier: 'free', speed: 3, fallbackModels: ['mock-fast', 'mock-vision'] };

async function* mockStream(modelId, messages, signal) {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  const asked = typeof last?.content === 'string' ? last.content : (last?.content || []).map((c) => c.text || '').join(' ');
  if (/__fail__/.test(asked)) throw new ProviderError(500, 'mock failure', { kind: 'server' });
  const sys = messages.find((m) => m.role === 'system')?.content || '';
  if (/Write a short title/.test(sys)) { yield { type: 'text', text: 'Mock chat title' }; return; }
  if (/image prompt/i.test(sys)) { yield { type: 'text', text: JSON.stringify({ prompt: `${asked}, highly detailed`, aspect: '1:1' }) }; return; }
  const text = `**Mock reply** from \`${modelId}\`.\n\nYou said: "${asked.slice(0, 200)}"\n\n- point one\n- point two\n\n\`\`\`js\nconsole.log("hello");\n\`\`\`\n`;
  const words = text.split(/(?<=\s)/);
  for (const w of words) {
    if (signal?.aborted) return;
    await new Promise((r) => setTimeout(r, config.mockDelayMs));
    yield { type: 'text', text: w };
  }
}

export function mockImage() {
  // 1x1 PNG, enough to exercise the full pipeline in tests.
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
}
