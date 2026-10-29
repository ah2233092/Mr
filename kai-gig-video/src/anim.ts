import {interpolate, spring, SpringConfig} from 'remotion';
import {EASE, FPS} from './theme';

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 0→1 progress of an eased tween starting at t0 (s) lasting dur (s). */
export const tw = (t: number, t0: number, dur: number, ease: (x: number) => number = EASE.out) =>
  ease(clamp((t - t0) / dur));

/** Spring 0→1 (may overshoot) starting at t0. */
export const sp = (t: number, t0: number, cfg: Partial<SpringConfig> = {}) =>
  t < t0 ? 0 : spring({frame: (t - t0) * FPS, fps: FPS, config: {damping: 14, stiffness: 140, mass: 0.8, ...cfg}});

/** Spring that pops with visible overshoot. */
export const pop = (t: number, t0: number) => sp(t, t0, {damping: 10, stiffness: 180, mass: 0.7});

/** In → hold → out envelope. */
export const env = (t: number, t0: number, t1: number, fadeIn = 0.25, fadeOut = 0.25) =>
  Math.min(tw(t, t0, fadeIn, EASE.outSoft), 1 - tw(t, t1 - fadeOut, fadeOut, EASE.inOut));

export const map = (x: number, inR: number[], outR: number[], ease?: (x: number) => number) =>
  interpolate(x, inR, outR, {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});

// Smooth deterministic noise (sum of incommensurate sines) for drift / handheld feel.
export const noise = (t: number, seed = 0) =>
  (Math.sin(t * 1.13 + seed * 12.9) * 0.5 +
    Math.sin(t * 2.71 + seed * 4.1) * 0.3 +
    Math.sin(t * 5.37 + seed * 7.7) * 0.2);

/** Camera shake that decays after t0. */
export const shake = (t: number, t0: number, dur = 0.45, amp = 14) => {
  if (t < t0 || t > t0 + dur) return {x: 0, y: 0, r: 0};
  const k = 1 - (t - t0) / dur;
  const e = k * k;
  return {
    x: Math.sin((t - t0) * 83) * amp * e,
    y: Math.cos((t - t0) * 67) * amp * 0.7 * e,
    r: Math.sin((t - t0) * 51) * 0.6 * e,
  };
};

export const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
