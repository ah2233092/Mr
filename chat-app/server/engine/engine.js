// The generation engine: picks a model, queues fairly per provider, streams
// tokens, and transparently falls back to the next healthy model when a
// provider is rate-limited, slow or down. The model that actually answered
// is always reported back, so labels in the UI are never fake.
import { config } from '../config.js';
import { streamChat, ProviderError } from './providers.js';
import { getProvider, semFor, noteFailure, noteSuccess, stats, autoOrder, isAvailable } from './registry.js';

const IDLE_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 10;

export async function generate({ candidates, buildMessages, signal, hadImages = false, onModel, onText, onReasoning, onReset }) {
  const tried = [];
  let lastErr = null;
  const deadProviders = new Set(); // bad key / unreachable: skip that provider's other models too
  let attempts = 0;

  for (const m of candidates) {
    if (signal.aborted || attempts >= MAX_ATTEMPTS) break;
    const p = getProvider(m.provider);
    if (!p || deadProviders.has(p.id)) continue;
    attempts++;

    let release;
    try {
      // First choice may wait in the queue; fallbacks only wait briefly.
      release = await semFor(p.id).acquire({ timeoutMs: tried.length ? 4000 : config.limits.queueWaitMs, signal });
    } catch (e) {
      if (e.code === 'ABORTED') break;
      lastErr = new ProviderError(503, `${p.label} is busy`, { kind: 'server' });
      tried.push(m);
      continue;
    }

    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    let timedOut = false;
    let timer = null;
    const arm = (ms) => { clearTimeout(timer); timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, ms); };
    arm(config.limits.firstTokenTimeoutMs);

    let started = false, text = '', reasoning = '';
    const t0 = Date.now();
    try {
      for await (const ev of streamChat(p, m.id, buildMessages(m), { signal: ctrl.signal })) {
        if (ev.type !== 'text' && ev.type !== 'reasoning') continue;
        arm(IDLE_TIMEOUT_MS);
        if (!started) { started = true; onModel?.(m, tried); }
        if (ev.type === 'text') { text += ev.text; onText?.(ev.text); }
        else { reasoning += ev.text; onReasoning?.(ev.text); }
      }
      clearTimeout(timer);
      if (!text && !signal.aborted) throw new ProviderError(502, 'empty response', { kind: 'server' });
      if (signal.aborted) return { model: started ? m : null, text, reasoning, aborted: true, tried, latencyMs: Date.now() - t0 };
      noteSuccess(m);
      return { model: m, text, reasoning, tried, latencyMs: Date.now() - t0 };
    } catch (e) {
      clearTimeout(timer);
      if (signal.aborted) return { model: started ? m : null, text, reasoning, aborted: true, tried, latencyMs: Date.now() - t0 };
      const err = e instanceof ProviderError ? e
        : new ProviderError(0, timedOut ? 'timed out' : (e.message || 'stream error'), { kind: timedOut ? 'timeout' : 'network' });
      noteFailure(m, err, { hadImages });
      if (err.kind === 'auth' || err.kind === 'network') deadProviders.add(p.id);
      if (text) {
        // The answer was already partly shown; keep it instead of restarting.
        return { model: m, text, reasoning, error: err, partial: true, tried, latencyMs: Date.now() - t0 };
      }
      if (started) onReset?.();
      lastErr = err;
      tried.push(m);
      stats.fallbacks++;
    } finally {
      signal.removeEventListener('abort', onAbort);
      release();
    }
  }
  return { model: null, error: lastErr || new ProviderError(503, 'No AI model is configured or available.'), tried, aborted: signal.aborted };
}

// Small, quick, non-streamed completion used for chat titles and for
// rewriting image prompts. Never blocks the main answer for long.
export async function quickComplete(system, user, { timeoutMs = 8000 } = {}) {
  const chain = autoOrder().filter(isAvailable).slice(0, 3);
  if (!chain.length) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await generate({
      candidates: chain, signal: ctrl.signal,
      buildMessages: () => [{ role: 'system', content: system }, { role: 'user', content: user }],
    });
    return r.text ? r.text.trim() : null;
  } catch { return null; }
  finally { clearTimeout(timer); }
}
