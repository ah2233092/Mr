// Model registry: discovers the models every configured provider offers,
// names them truthfully, ranks them and tracks provider health.
import { config } from '../config.js';
import { enabledProviders, discoverModels, isChatModel, prettyName, supportsVision, rankModel, describeModel } from './providers.js';
import { Semaphore, Cooldowns } from './limiter.js';

const MAX_PER_PROVIDER = parseInt(process.env.MAX_MODELS_PER_PROVIDER || '14', 10);
const MAX_OPENAI = parseInt(process.env.MAX_OPENAI_MODELS || '40', 10);

// Menu groups: real ChatGPT (OpenAI API) models first, then OpenAI's free
// open-weight GPT-OSS models, then everything else.
function groupOf(m) {
  if (m.provider === 'openai') return { order: 0, label: 'ChatGPT models' };
  if (/gpt-oss/i.test(m.id)) return { order: 1, label: 'OpenAI open models · Free' };
  return { order: 2, label: `${m.providerLabel} · ${m.tier === 'paid' ? 'Premium' : 'Free'}` };
}

const state = { models: [], byKey: new Map(), providers: new Map(), refreshedAt: 0, refreshing: null };
export const cooldowns = new Cooldowns();
const sems = new Map();
export const stats = { requests: 0, fallbacks: 0, errors: 0, byProvider: {} };

export function semFor(providerId) {
  let s = sems.get(providerId);
  if (!s) {
    const per = parseInt(process.env[`${providerId.toUpperCase()}_CONCURRENCY`] || '', 10);
    s = new Semaphore(per > 0 ? per : config.limits.providerConcurrency);
    sems.set(providerId, s);
  }
  return s;
}

export async function refreshModels() {
  if (state.refreshing) return state.refreshing;
  state.refreshing = (async () => {
    const providers = enabledProviders();
    const results = await Promise.all(providers.map(async (p) => ({ p, list: await discoverModels(p) })));
    const models = [];
    state.providers.clear();
    for (const { p, list } of results) {
      state.providers.set(p.id, p);
      const seen = new Set();
      const entries = [];
      for (const m of list) {
        if (seen.has(m.id) || !isChatModel(p, m)) continue;
        seen.add(m.id);
        const key = `${p.id}:${m.id}`;
        if (config.models.allow && !config.models.allow.test(key)) continue;
        if (config.models.block && config.models.block.test(key)) continue;
        const score = rankModel(m.id);
        entries.push({
          key, id: m.id, provider: p.id, providerLabel: p.label, tier: p.tier, speed: p.speed,
          name: prettyName(m.id), vision: supportsVision(p, m.id, m.inputModalities),
          score, description: describeModel(p, score, m.id),
        });
      }
      entries.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
      models.push(...entries.slice(0, p.id === 'openai' ? MAX_OPENAI : MAX_PER_PROVIDER));
    }
    for (const m of models) { const g = groupOf(m); m.group = g.label; m.groupOrder = g.order; }
    // Stable sort keeps provider order inside each group.
    models.sort((a, b) => a.groupOrder - b.groupOrder || (a.groupOrder < 2 ? b.score - a.score : 0));
    state.models = models;
    state.byKey = new Map(models.map((m) => [m.key, m]));
    state.refreshedAt = Date.now();
    console.log(`[models] ${models.length} models from ${providers.map((p) => p.id).join(', ') || 'no providers'}`);
    return models;
  })().finally(() => { state.refreshing = null; });
  return state.refreshing;
}

export function startModelRefresh() {
  const ms = Math.max(1, config.models.refreshHours) * 3600 * 1000;
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
    list = state.models
      .filter((m) => m.tier === 'free' && m.score >= 60)
      .sort((a, b) => (b.speed * 6 + b.score) - (a.speed * 6 + a.score));
    // add the weaker free models at the end as last-resort fallbacks
    list = list.concat(state.models.filter((m) => m.tier === 'free' && m.score < 60));
  }
  if (vision) list = list.filter((m) => m.vision);
  return list;
}

// Candidate chain for one request: chosen model first, then healthy
// fallbacks. Providers with free capacity are preferred so load spreads out.
export function candidatesFor(modelKey, { vision = false } = {}) {
  const chosen = modelKey && modelKey !== 'auto' ? getModel(modelKey) : null;
  let chain = autoOrder({ vision });
  if (chosen && (!vision || chosen.vision)) {
    // A chosen ChatGPT/paid model falls back to the next-best model of the
    // same provider first, then to the free fast models.
    const siblings = chosen.tier === 'paid'
      ? state.models.filter((m) => m.provider === chosen.provider && m.key !== chosen.key && m.score <= chosen.score && (!vision || m.vision))
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
  if (config.models.default && state.byKey.has(config.models.default)) return config.models.default;
  const best = state.models.filter((m) => m.provider === 'openai').sort((a, b) => b.score - a.score)[0];
  return best ? best.key : 'auto';
}

export function publicModels() {
  const featured = new Set(config.models.featured);
  return state.models.map((m) => ({
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
      models: state.models.filter((m) => m.provider === p.id).length };
  });
  return { refreshedAt: state.refreshedAt, providers, cooldowns: cooldowns.snapshot(), stats };
}
