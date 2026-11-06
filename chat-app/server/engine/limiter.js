// Concurrency + rate limiting primitives used by the engine.

// FIFO semaphore with a wait timeout and abort support. Each AI provider gets
// one, so a burst of 100 users is queued fairly instead of tripping the
// provider's rate limits all at once.
export class Semaphore {
  constructor(max) { this.max = max; this.active = 0; this.queue = []; }
  get waiting() { return this.queue.length; }
  get free() { return this.max - this.active; }

  acquire({ timeoutMs = 20000, signal } = {}) {
    if (this.active < this.max) { this.active++; return Promise.resolve(this.#releaser()); }
    return new Promise((resolve, reject) => {
      const entry = { resolve, reject, timer: null, onAbort: null };
      const remove = () => { const i = this.queue.indexOf(entry); if (i >= 0) this.queue.splice(i, 1); };
      entry.timer = setTimeout(() => { remove(); reject(Object.assign(new Error('queue timeout'), { code: 'QUEUE_TIMEOUT' })); }, timeoutMs);
      if (signal) {
        entry.onAbort = () => { clearTimeout(entry.timer); remove(); reject(Object.assign(new Error('aborted'), { code: 'ABORTED' })); };
        signal.addEventListener('abort', entry.onAbort, { once: true });
      }
      this.queue.push(entry);
    }).then(() => this.#releaser());
  }

  #releaser() {
    let done = false;
    return () => {
      if (done) return; done = true;
      const next = this.queue.shift();
      if (next) {
        clearTimeout(next.timer);
        // active count stays the same: the slot passes straight to the next waiter
        next.resolve();
      } else {
        this.active--;
      }
    };
  }
}

// Sliding-window counter, e.g. "20 messages per minute per user".
export class WindowLimiter {
  constructor(limit, windowMs) { this.limit = limit; this.windowMs = windowMs; this.hits = new Map(); }
  check(key) {
    const t = Date.now();
    const arr = (this.hits.get(key) || []).filter((x) => t - x < this.windowMs);
    this.hits.set(key, arr);
    if (arr.length >= this.limit) return { ok: false, retryInMs: this.windowMs - (t - arr[0]) };
    arr.push(t);
    return { ok: true };
  }
  sweep() {
    const t = Date.now();
    for (const [k, arr] of this.hits) if (!arr.length || t - arr[arr.length - 1] > this.windowMs) this.hits.delete(k);
  }
}

// Remembers which providers/models recently failed so the next request skips
// them instantly instead of waiting for another error (circuit breaker).
export class Cooldowns {
  constructor() { this.map = new Map(); }
  set(key, ms, reason) { this.map.set(key, { until: Date.now() + ms, reason }); }
  active(key) {
    const c = this.map.get(key);
    if (!c) return null;
    if (c.until < Date.now()) { this.map.delete(key); return null; }
    return c;
  }
  clear(key) { this.map.delete(key); }
  clearAll() { this.map.clear(); }
  snapshot() {
    const out = {}; const t = Date.now();
    for (const [k, v] of this.map) if (v.until > t) out[k] = { secondsLeft: Math.ceil((v.until - t) / 1000), reason: v.reason };
    return out;
  }
}
