// Model registry: discovers the models every configured provider offers,
// names them truthfully, ranks them and tracks provider health.
import { config } from '../config.js';
import { enabledProviders, discoverModels, isChatModel, prettyName, supportsVision, rankModel, describeModel, modelPart } from './providers.js';
import { Semaphore, Cooldowns } from './limiter.js';
import { ensureOmniRoute } from './omniroute.js';
import { isOfficialGatewayModel } from './providers.js';
import { ALIASES, aliasKey, aliasMode, findAlias, resolveAlias } from './aliases.js';

const MAX_PER_PROVIDER = parseInt(process.env.MAX_MODELS_PER_PROVIDER || '14', 10);
const MAX_OPENAI = parseInt(process.env.MAX_OPENAI_MODELS || '40', 10);
const MAX_GATEWAY = parseInt(process.env.MAX_OMNIROUTE_MODELS || '60', 10);
const GPT_RE = /^(gpt-\d|o\d|chatgpt-)/i;

// Gateways (OmniRoute) name models "<route>/<model>". The route tells us who
// really serves it, so the menu can show the true upstream provider.
const UPSTREAM = {
  openai: 'OpenAI', anthropic: 'Anthropic', groq: 'Groq', cerebras: 'Cerebras', gemini: 'Google Gemini', google: 'Google Gemini',
  openrouter: 'OpenRouter', mistral: 'Mistral', deepseek: 'DeepSeek', xai: 'xAI', grok: 'xAI', qwen: 'Qwen', kimi: 'Kimi',
  moonshot: 'Kimi', glm: 'GLM', zai: 'Z.ai', pollinations: 'Pollinations', together: 'Together', nvidia: 'NVIDIA',
  cloudflare: 'Cloudflare', 'cloudflare-ai': 'Cloudflare', ollama: 'Ollama', 'ollama-cloud': 'Ollama', github: 'GitHub Models',
  huggingface: 'Hugging Face', sambanova: 'SambaNova', vertex: 'Google Vertex', 'azure-openai': 'Azure OpenAI', codestral: 'Mistral',
  fireworks: 'Fireworks', deepinfra: 'DeepInfra', novita: 'Novita', cohere: 'Cohere', perplexity: 'Perplexity',
};
const PAID_UPSTREAM = new Set(['openai', 'anthropic', 'xai', 'deepseek', 'perplexity']);

function routeInfo(p, id, ownedBy) {
  if (!p.gateway) return { label: p.label, tier: p.tier, speed: p.speed, prefix: p.id };
  const i = id.indexOf('/');
  // OmniRoute reports the real upstream provider in owned_by; fall back to the route prefix.
  const prefix = (ownedBy || (i > 0 ? id.slice(0, i) : '')).toLowerCase();
  const label = UPSTREAM[prefix] || (prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : p.label);
  const forced = process.env.OMNIROUTE_TIER;
  const tier = forced === 'paid' || forced === 'free' ? forced : (PAID_UPSTREAM.has(prefix) ? 'paid' : 'free');
  return { label, tier, speed: /^(groq|cerebras|sambanova)$/.test(prefix) ? 3 : 2, prefix };
}

// Menu groups: real ChatGPT models first, then OpenAI's free open-weight
// GPT-OSS models, then everything else.
function groupOf(m) {
  if (m.hidden) return { order: 9, label: '' };
  const part = modelPart(m.id);
  if (m.provider === 'openai' || (m.gateway && GPT_RE.test(part) && !/gpt-oss/i.test(part))) return { order: 0, label: 'ChatGPT models' };
  if (/gpt-oss/i.test(m.id)) return { order: 1, label: 'OpenAI open models · Free' };
  return { order: 2, label: `${m.providerLabel} · ${m.tier === 'paid' ? 'Premium' : 'Free'}` };
}

const state = { models: [], byKey: new Map(), providers: new Map(), refreshedAt: 0, refreshing: null, retryTimer: null, retries: 0, gatewayImageModel: '' };
export const gatewayImageModel = () => state.gatewayImageModel;
export const cooldowns = new Cooldowns();
const sems = new Map();
export const stats = { requests: 0, fallbacks: 0, errors: 0, byProvider: {} };

export function semFor(providerId) {
  let s = sems.get(providerId);
  if (!s) {
    const per = parseInt(process.env[`${providerId.toUpperCase()}_CONCURRENCY`] || '', 10);
    const own = state.providers.get(providerId)?.concurrency;
    s = new Semaphore(per > 0 ? per : own || config.limits.providerConcurrency);
    sems.set(providerId, s);
  }
  return s;
}

export async function refreshModels() {
  if (state.refreshing) return state.refreshing;
  state.refreshing = (async () => {
    await ensureOmniRoute();
    const providers = enabledProviders();
    const results = await Promise.all(providers.map(async (p) => ({ p, ...(await discoverModels(p)) })));
    let models = [];
    state.providers.clear();
    state.gatewayImageModel = '';
    for (const { p, list } of results) {
      state.providers.set(p.id, p);
      if (p.gateway) {
        // Pick an official image model automatically (prefer FLUX).
        const imgs = list.filter((m) => Array.isArray(m.outputModalities) && m.outputModalities.includes('image') && isOfficialGatewayModel(m));
        state.gatewayImageModel = (imgs.find((m) => /flux/i.test(m.id)) || imgs[0])?.id || '';
      }
      const seen = new Set();
      const entries = [];
      for (const m of list) {
        if (seen.has(m.id) || !isChatModel(p, m)) continue;
        seen.add(m.id);
        const key = `${p.id}:${m.id}`;
        if (config.models.allow && !config.models.allow.test(key)) continue;
        if (config.models.block && config.models.block.test(key)) continue;
        const score = rankModel(m.id);
        const r = routeInfo(p, m.id, m.ownedBy);
        const part = p.gateway ? modelPart(m.id) : m.id;
        const isGpt = p.gateway && GPT_RE.test(part) && !/gpt-oss/i.test(part);
        let description = describeModel({ id: isGpt ? 'openai' : r.prefix, label: r.label, tier: r.tier, speed: r.speed }, score, part);
        if (isGpt && r.label !== 'OpenAI') description += ` · via ${r.label}`;
        entries.push({
          key, id: m.id, provider: p.id, providerLabel: r.label, tier: r.tier, speed: r.speed, gateway: !!p.gateway,
          name: prettyName(m.id), vision: supportsVision({ id: r.prefix }, part, m.inputModalities),
          score, description,
        });
      }
      entries.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
      models.push(...entries.slice(0, p.id === 'openai' ? MAX_OPENAI : p.gateway ? MAX_GATEWAY : MAX_PER_PROVIDER));
      if (p.gateway) {
        // The gateway's own smart routes power "Auto"; they are not shown in the menu.
        // Off by default: OmniRoute's built-in auto/* combos may route through unofficial keyless
        // providers. Point this at your own combo of official providers if you want it.
        for (const id of (process.env.OMNIROUTE_AUTO_MODELS || '').split(',').map((s) => s.trim()).filter(Boolean)) {
          models.push({ key: `${p.id}:${id}`, id, provider: p.id, providerLabel: p.label, tier: 'free', speed: 3, gateway: true,
            name: 'Auto', vision: false, score: 90, description: '', hidden: true, autoRoute: true });
        }
      }
    }
    for (const m of models) { const g = groupOf(m); m.group = g.label; m.groupOrder = g.order; }
    // Same model reachable two ways (direct key and via the gateway): keep the direct one.
    const byName = new Map();
    for (const m of models) {
      if (m.hidden) continue;
      const k = `${m.group}|${m.name}|${m.providerLabel}`;
      const prev = byName.get(k);
      if (!prev) byName.set(k, m);
      else if (prev.gateway && !m.gateway) byName.set(k, m);
    }
    const keep = new Set(byName.values());
    models = models.filter((m) => m.hidden || keep.has(m));
    // Stable sort keeps provider order inside each group.
    models.sort((a, b) => a.groupOrder - b.groupOrder || (a.groupOrder < 2 ? b.score - a.score : 0));
    state.models = models;
    state.byKey = new Map(models.map((m) => [m.key, m]));
    state.refreshedAt = Date.now();
    console.log(`[models] ${models.filter((m) => !m.hidden).length} models from ${providers.map((p) => p.id).join(', ') || 'no providers'}`);
    // A provider that was not reachable yet (e.g. OmniRoute still starting): try again soon.
    if (results.some((r) => !r.ok) && !state.retryTimer) {
      const delay = Math.min(10 * 60e3, 60e3 * 2 ** Math.min(state.retries, 4));
      state.retries++;
      state.retryTimer = setTimeout(() => { state.retryTimer = null; refreshModels().catch(() => {}); }, delay);
      state.retryTimer.unref?.();
    } else if (results.every((r) => r.ok)) state.retries = 0;
    return models;
  })().finally(() => { state.refreshing = null; });
  return state.refreshing;
}

export function startModelRefresh() {
  // Short interval so providers you connect in OmniRoute show up within minutes.
  const ms = Math.max(1, config.models.refreshMinutes) * 60 * 1000;
  setInterval(() => refreshModels().catch((e) => console.error('[models] refresh failed', e)), ms).unref();
  return refreshModels();
}

export const getModel = (key) => state.byKey.get(key) || null;
export const getProvider = (id) => state.providers.get(id) || null;
export const allModels = () => state.models;

export function isAvailable(m) {
  return !cooldowns.active(`p:${m.provider}`) && !cooldowns.active(`m:${m.key}`);
}

// The ordered list "Auto" tries. Free + fast + smart first; paid models are
// never used automatically so the owner is never charged by surprise.
export function autoOrder({ vision = false } = {}) {
  let list;
  if (config.models.auto.length) {
    list = config.models.auto.map(getModel).filter(Boolean);
  } else {
    const visible = state.models.filter((m) => !m.hidden && m.tier === 'free');
    list = visible.filter((m) => m.score >= 60).sort((a, b) => (b.speed * 6 + b.score) - (a.speed * 6 + a.score));
    // add the weaker free models at the end as last-resort fallbacks
    list = list.concat(visible.filter((m) => m.score < 60));
    // OmniRoute's own smart routing goes first when it is connected.
    list = [...state.models.filter((m) => m.autoRoute), ...list];
  }
  if (vision) list = list.filter((m) => m.vision);
  return list;
}

// Candidate chain for one request: chosen model first, then healthy
// fallbacks. Providers with free capacity are preferred so load spreads out.
export function candidatesFor(modelKey, { vision = false } = {}) {
  const alias = findAlias(modelKey);
  if (alias) {
    // ChatGPT-style menu name: its own model list first, then everything else as backup.
    const own = resolveAlias(vision ? { ...alias, vision: true } : alias, state.models);
    const chain = [...own, ...autoOrder({ vision }).filter((m) => !own.includes(m))];
    return [...chain.filter(isAvailable), ...chain.filter((m) => !isAvailable(m))];
  }
  const chosen = modelKey && modelKey !== 'auto' ? getModel(modelKey) : null;
  let chain = autoOrder({ vision });
  if (chosen && (!vision || chosen.vision)) {
    // A chosen ChatGPT/paid model falls back to the next-best model of the
    // same provider first, then to the free fast models.
    const siblings = chosen.tier === 'paid' || chosen.groupOrder === 0
      ? state.models.filter((m) => !m.hidden && m.group === chosen.group && m.key !== chosen.key && m.score <= chosen.score && (!vision || m.vision))
        .sort((a, b) => b.score - a.score).slice(0, 2)
      : [];
    const head = [chosen, ...siblings];
    chain = [...head, ...chain.filter((m) => !head.includes(m))];
  }
  const healthy = chain.filter(isAvailable);
  const cooling = chain.filter((m) => !isAvailable(m));
  if (!chosen) {
    // For Auto: among the top few, prefer providers that are not saturated.
    const top = healthy.slice(0, 4).sort((a, b) => {
      const fa = semFor(a.provider).free > 0 ? 1 : 0, fb = semFor(b.provider).free > 0 ? 1 : 0;
      return fb - fa;
    });
    return [...top, ...healthy.slice(4), ...cooling];
  }
  return [...healthy, ...cooling];
}

// Default selection: DEFAULT_MODEL if set, else the best ChatGPT model, else Auto.
export function defaultModelKey() {
  if (config.models.default && (state.byKey.has(config.models.default) || findAlias(config.models.default))) return config.models.default;
  if (aliasMode()) return aliasKey(ALIASES[0]);
  const best = state.models.filter((m) => m.group === 'ChatGPT models').sort((a, b) => b.score - a.score)[0];
  return best ? best.key : 'auto';
}

export function publicModels() {
  if (aliasMode()) {
    return ALIASES.map((a) => {
      const real = resolveAlias(a, state.models);
      return {
        key: aliasKey(a), name: a.name, provider: 'alias', providerLabel: '', tier: 'free', group: 'Models',
        vision: a.vision, description: a.description, featured: false,
        available: real.some(isAvailable) || autoOrder().some(isAvailable),
      };
    });
  }
  const featured = new Set(config.models.featured);
  return state.models.filter((m) => !m.hidden).map((m) => ({
    key: m.key, name: m.name, provider: m.provider, providerLabel: m.providerLabel, tier: m.tier, group: m.group,
    vision: m.vision, description: m.description, featured: featured.has(m.key),
    available: isAvailable(m),
  }));
}

export function noteFailure(m, err, { hadImages = false } = {}) {
  stats.errors++;
  const kind = err.kind || 'server';
  const msg = String(err.message || '').slice(0, 160);
  if (kind === 'rate_limit') {
    const zeroQuota = /limit:\s*0\b|free tier.*not available|exceeded your current quota/i.test(msg);
    cooldowns.set(`m:${m.key}`, zeroQuota ? 6 * 3600e3 : (err.retryAfterMs || 30e3), 'rate limited');
  } else if (kind === 'auth') {
    cooldowns.set(`p:${m.provider}`, 10 * 60e3, 'API key rejected');
  } else if (kind === 'model') {
    cooldowns.set(`m:${m.key}`, 3 * 3600e3, 'model unavailable');
  } else if (kind === 'network') {
    // Unreachable (e.g. OmniRoute restarting): skip the whole provider briefly.
    cooldowns.set(`p:${m.provider}`, 20e3, 'unreachable');
  } else if (kind === 'bad_request') {
    if (!hadImages) cooldowns.set(`m:${m.key}`, 10 * 60e3, 'request rejected');
  } else {
    cooldowns.set(`m:${m.key}`, 15e3, kind);
  }
  console.warn(`[engine] ${m.key} failed (${kind} ${err.status || ''}): ${msg}`);
}

export function noteSuccess(m) {
  stats.requests++;
  stats.byProvider[m.provider] = (stats.byProvider[m.provider] || 0) + 1;
}

export function engineSnapshot() {
  const providers = [...state.providers.values()].map((p) => {
    const s = semFor(p.id);
    return { id: p.id, label: p.label, tier: p.tier, active: s.active, waiting: s.waiting, max: s.max,
      models: state.models.filter((m) => m.provider === p.id && !m.hidden).length };
  });
  return { refreshedAt: state.refreshedAt, providers, cooldowns: cooldowns.snapshot(), stats };
}
