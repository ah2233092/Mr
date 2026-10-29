import vo from './data/vo.json';
import {FPS} from './theme';

export type Word = {w: string; line: number; start: number; end: number};
export const WORDS = vo.words as Word[];
export const LINES = vo.lines as {i: number; scene: string | null; text: string; start: number; end: number}[];
export const DURATION_S = vo.duration;

/** Start time (s) of word `idx` (0-based) in line `line`. */
export const w = (line: number, idx: number): number => {
  const ws = WORDS.filter((x) => x.line === line);
  if (!ws[idx]) throw new Error(`no word ${line}:${idx}`);
  return ws[idx].start;
};
/** Start of the first word in `line` whose text starts with `prefix` (case-insensitive). */
export const at = (line: number, prefix: string, nth = 0): number => {
  const ws = WORDS.filter((x) => x.line === line && x.w.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!ws[nth]) throw new Error(`no word "${prefix}" in line ${line}`);
  return ws[nth].start;
};
export const lineStart = (i: number) => LINES[i].start;
export const lineEnd = (i: number) => LINES[i].end;

export const f = (s: number) => Math.round(s * FPS);

// Scene cuts land in the pauses between lines.
const mid = (a: number, b: number, bias = 0.5) => lineEnd(a) + (lineStart(b) - lineEnd(a)) * bias;
export const S = {
  hook: [0, mid(1, 2, 0.5)],
  twist: [mid(1, 2, 0.5), mid(3, 4, 0.55)],
  problems: [mid(3, 4, 0.55), mid(6, 7, 0.52)],
  turn: [mid(6, 7, 0.52), mid(7, 8, 0.6)],
  publish: [mid(7, 8, 0.6), mid(8, 9, 0.85)],
  format: [mid(8, 9, 0.85), mid(9, 10, 0.6)],
  cover: [mid(9, 10, 0.6), mid(10, 11, 0.6)],
  keywords: [mid(10, 11, 0.6), mid(11, 12, 0.6)],
  aplus: [mid(11, 12, 0.6), mid(12, 13, 0.55)],
  proof: [mid(12, 13, 0.55), mid(13, 14, 0.5)],
  close: [mid(13, 14, 0.5), mid(15, 16, 0.55)],
  cta: [mid(15, 16, 0.55), DURATION_S],
} as const;

// Problem sub-scenes
export const P = {
  margin: [S.problems[0], mid(4, 5, 0.55)],
  cover: [mid(4, 5, 0.55), mid(5, 6, 0.6)],
  keywords: [mid(5, 6, 0.6), S.problems[1]],
} as const;

// Music grid: the score (audio/music.py) uses the same numbers.
export const BPM = 104;
export const BEAT = 60 / BPM;
export const MUSIC_DROP = lineStart(7) - 0.04; // beat drop lands with "So"
export const MUSIC_HIT = MUSIC_DROP + 72 * BEAT; // bar 19 downbeat: final hit on the logo
export const END_CARD = MUSIC_HIT - 0.4; // logo finishes growing exactly on the hit
