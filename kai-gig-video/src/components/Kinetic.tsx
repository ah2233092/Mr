import React from 'react';
import {clamp, sp, tw} from '../anim';
import {WORDS} from '../timeline';
import {C, EASE} from '../theme';

export type RevealMode = 'rise' | 'blur' | 'letters' | 'slam' | 'mask';

/** One word/phrase that animates on at t0. */
export const Reveal: React.FC<{
  t: number;
  t0: number;
  mode?: RevealMode;
  children: string;
  style?: React.CSSProperties;
  out?: number; // time to animate out
  hiColor?: string; // colour it turns when spoken
  hiAt?: number;
}> = ({t, t0, mode = 'rise', children, style, out, hiColor, hiAt}) => {
  const outK = out !== undefined ? tw(t, out, 0.22, EASE.in) : 0;
  const color = hiColor && t >= (hiAt ?? t0) ? hiColor : undefined;
  const hiK = hiColor ? sp(t, hiAt ?? t0, {damping: 14, stiffness: 200}) : 0;
  if (mode === 'letters') {
    // background-clip:text does not reach transformed children, so foil styles go on each letter
    const {backgroundImage, backgroundSize, backgroundPosition, WebkitBackgroundClip, backgroundClip, color: c0, filter: f0, ...rest} = style ?? {};
    const letterStyle: React.CSSProperties = {backgroundImage, backgroundSize, backgroundPosition, WebkitBackgroundClip, backgroundClip, color: c0};
    return (
      <span style={{display: 'inline-block', whiteSpace: 'pre', ...rest, opacity: 1 - outK, filter: f0}}>
        {children.split('').map((ch, i) => {
          const k = sp(t, t0 + i * 0.032, {damping: 13, stiffness: 190});
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                opacity: clamp(k * 1.5),
                transform: `translateY(${(1 - k) * 0.5}em) scale(${0.6 + 0.4 * k})`,
                filter: k < 0.98 ? `blur(${(1 - clamp(k)) * 10}px)` : undefined,
                ...letterStyle,
                ...(color ? {color} : {}),
              }}
            >
              {ch}
            </span>
          );
        })}
      </span>
    );
  }
  const k = mode === 'slam' ? sp(t, t0, {damping: 13, stiffness: 420, mass: 0.7}) : sp(t, t0, {damping: 16, stiffness: 170});
  let transform = '';
  let filter: string | undefined;
  let opacity = clamp(k * 1.6);
  if (mode === 'rise') transform = `translateY(${(1 - k) * 0.6}em)`;
  if (mode === 'blur') {
    transform = `scale(${1.25 - 0.25 * k})`;
    if (k < 0.98) filter = `blur(${(1 - clamp(k)) * 16}px)`;
  }
  if (mode === 'slam') {
    transform = `scale(${1.7 - 0.7 * k})`;
    opacity = clamp(k * 3);
    if (k < 0.9) filter = `blur(${(1 - clamp(k)) * 6}px)`;
  }
  if (mode === 'mask') {
    return (
      <span style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', paddingBottom: '0.08em', marginBottom: '-0.08em'}}>
        <span
          style={{
            display: 'inline-block',
            transform: `translateY(${(1 - k) * 105 + outK * -105}%)`,
            ...style,
            color: color ?? style?.color,
          }}
        >
          {children}
        </span>
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-block',
        whiteSpace: 'pre',
        ...style,
        color: color ?? style?.color,
        opacity: opacity * (1 - outK),
        transform: `${transform} translateY(${outK * -0.3}em) scale(${1 + hiK * 0.0})`,
        filter,
      }}
    >
      {children}
    </span>
  );
};

/** A voiceover line as kinetic type: each word appears exactly when it is spoken. */
export const VOLine: React.FC<{
  t: number;
  line: number;
  from?: number; // word index range
  to?: number;
  mode?: RevealMode;
  style?: React.CSSProperties;
  wordStyle?: (i: number, word: string) => React.CSSProperties | undefined;
  gold?: number[]; // word indices that turn gold when spoken
  lead?: number;
  out?: number;
  strip?: boolean; // strip trailing punctuation
}> = ({t, line, from = 0, to, mode = 'rise', style, wordStyle, gold = [], lead = 0.06, out, strip}) => {
  const ws = WORDS.filter((x) => x.line === line).slice(from, to);
  return (
    <span style={style}>
      {ws.map((wd, i) => {
        const idx = i + from;
        const text = strip ? wd.w.replace(/[,.]$/, '') : wd.w;
        return (
          <React.Fragment key={idx}>
            <Reveal t={t} t0={wd.start - lead} mode={mode} style={wordStyle?.(idx, wd.w)} hiColor={gold.includes(idx) ? C.gold : undefined} out={out}>
              {text}
            </Reveal>
            {i < ws.length - 1 ? ' ' : ''}
          </React.Fragment>
        );
      })}
    </span>
  );
};
