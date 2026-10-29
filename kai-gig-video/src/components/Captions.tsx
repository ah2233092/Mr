import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp, sp, tw} from '../anim';
import {WORDS, Word} from '../timeline';
import {C, EASE, F} from '../theme';

type Chunk = {words: (Word & {gi: number})[]; start: number; end: number};

// Group words into 2–5 word chunks, breaking at punctuation and line ends.
const buildChunks = (): Chunk[] => {
  const out: Chunk[] = [];
  let cur: (Word & {gi: number})[] = [];
  const flush = () => {
    if (cur.length) out.push({words: cur, start: cur[0].start, end: cur[cur.length - 1].end});
    cur = [];
  };
  WORDS.forEach((wd, gi) => {
    if (cur.length && cur[0].line !== wd.line) flush();
    cur.push({...wd, gi});
    const chars = cur.map((x) => x.w).join(' ').length;
    const punct = /[,.…]$/.test(wd.w);
    const next = WORDS[gi + 1];
    const nextIsShortTail = next && next.line === wd.line && /[.…]$/.test(next.w) && cur.length < 4;
    if (cur.length >= 5 || (punct && cur.length >= 2) || (chars > 20 && !nextIsShortTail && cur.length >= 2)) flush();
  });
  flush();
  // a lone word gets merged back into its neighbour on the same line
  for (let i = out.length - 1; i > 0; i--) {
    if (out[i].words.length === 1 && out[i - 1].words[0].line === out[i].words[0].line && out[i - 1].words.length < 5) {
      out[i - 1].words.push(...out[i].words);
      out[i - 1].end = out[i].end;
      out.splice(i, 1);
    }
  }
  return out;
};
export const CHUNKS = buildChunks();

export type CaptionOpts = {
  hide?: [number, number][]; // absolute time ranges where captions are replaced by kinetic type
  raise?: [number, number, number][]; // [t0, t1, bottomPx]
};

/** Burned-in, word-timed captions: navy pill, cream text, current word in gold. */
export const Captions: React.FC<{t: number; opts: CaptionOpts}> = ({t, opts}) => {
  const idx = CHUNKS.findIndex((c, i) => {
    const nextStart = CHUNKS[i + 1]?.start ?? c.end + 1;
    return t >= c.start - 0.08 && t < Math.min(nextStart - 0.04, c.end + 0.6);
  });
  if (idx < 0) return null;
  const c = CHUNKS[idx];
  if (opts.hide?.some(([a, b]) => c.start >= a - 0.01 && c.start < b)) return null;
  const nextStart = CHUNKS[idx + 1]?.start ?? c.end + 1;
  const outT = Math.min(nextStart - 0.04, c.end + 0.6);
  const inK = sp(t, c.start - 0.08, {damping: 18, stiffness: 220});
  const outK = 1 - tw(t, outT - 0.1, 0.1, EASE.in);
  const bottom = opts.raise?.find(([a, b]) => t >= a && t < b)?.[2] ?? 92;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, right: 0, bottom, display: 'flex', justifyContent: 'center'}}>
        <div
          style={{
            display: 'flex',
            gap: '0.28em',
            alignItems: 'baseline',
            padding: '14px 30px 16px',
            borderRadius: 20,
            background: 'rgba(12,19,34,0.78)',
            boxShadow: '0 10px 30px rgba(3,6,12,0.35), inset 0 0 0 1px rgba(246,236,218,0.07)',
            fontFamily: F.inter,
            fontWeight: 700,
            fontSize: 50,
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
            color: C.cream,
            opacity: clamp(inK * 1.4) * outK,
            transform: `translateY(${(1 - inK) * 18}px) scale(${0.96 + 0.04 * inK})`,
          }}
        >
          {c.words.map((wd, i) => {
            const nextW = c.words[i + 1]?.start ?? Math.max(wd.end, wd.start + 0.25);
            const active = t >= wd.start - 0.03 && t < nextW - 0.03;
            const spoken = t >= wd.start - 0.03;
            const k = sp(t, wd.start - 0.03, {damping: 16, stiffness: 260});
            return (
              <span
                key={wd.gi}
                style={{
                  display: 'inline-block',
                  color: active ? C.gold : C.cream,
                  opacity: spoken ? 1 : 0.5,
                  transform: `translateY(${active ? -2 * k : 0}px) scale(${active ? 1 + 0.05 * k : 1})`,
                }}
              >
                {wd.w}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
