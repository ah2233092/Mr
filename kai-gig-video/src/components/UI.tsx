import React from 'react';
import {clamp} from '../anim';
import {C, F} from '../theme';
import {Check} from './Icons';

/** Light, generic app window used for every mockup. */
export const Window: React.FC<{
  w: number;
  h: number;
  title?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  dark?: boolean;
}> = ({w, h, title, children, style, dark}) => (
  <div
    style={{
      position: 'relative',
      width: w,
      height: h,
      borderRadius: 22,
      overflow: 'hidden',
      background: dark ? '#13203A' : C.paper,
      boxShadow: '0 40px 90px rgba(3,6,14,0.55), 0 12px 30px rgba(3,6,14,0.35), inset 0 0 0 1px rgba(255,255,255,0.35)',
      ...style,
    }}
  >
    <div
      style={{
        height: 54,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 22px',
        background: dark ? '#0F1A30' : '#F1E8D6',
        borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(27,42,74,0.08)',
      }}
    >
      {['#E9B4A4', '#EBD39B', '#AFCFAE'].map((c) => (
        <div key={c} style={{width: 14, height: 14, borderRadius: 7, background: c}} />
      ))}
      {title && (
        <div style={{marginLeft: 18, fontFamily: F.inter, fontWeight: 600, fontSize: 20, color: dark ? C.muted : 'rgba(27,42,74,0.6)'}}>{title}</div>
      )}
    </div>
    <div style={{position: 'absolute', top: 54, left: 0, right: 0, bottom: 0}}>{children}</div>
  </div>
);

export const Badge: React.FC<{text: string; color: string; k: number; size?: number; icon?: 'check' | 'dot'; style?: React.CSSProperties}> = ({
  text,
  color,
  k,
  size = 30,
  icon = 'check',
  style,
}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: size * 0.35,
      padding: `${size * 0.32}px ${size * 0.7}px ${size * 0.32}px ${size * 0.5}px`,
      borderRadius: 999,
      background: color,
      color: '#fff',
      fontFamily: F.inter,
      fontWeight: 800,
      fontSize: size,
      letterSpacing: '0.08em',
      boxShadow: `0 ${size * 0.3}px ${size * 0.9}px ${color}66, inset 0 1px 0 rgba(255,255,255,0.3)`,
      transform: `scale(${k})`,
      opacity: clamp(k * 2),
      ...style,
    }}
  >
    {icon === 'check' ? (
      <Check size={size * 1.05} color="#fff" stroke={8} draw={clamp(k * 1.2)} />
    ) : (
      <div style={{width: size * 0.42, height: size * 0.42, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 4px rgba(255,255,255,0.35)'}} />
    )}
    {text}
  </div>
);

/** Rubber stamp: thick border, rough ink edges via SVG turbulence displacement. */
export const Stamp: React.FC<{text: string; color: string; k: number; rot?: number; size?: number; id: string; icon?: boolean}> = ({
  text,
  color,
  k,
  rot = -12,
  size = 96,
  id,
  icon,
}) => {
  const scale = 2.4 - 1.4 * clamp(k, 0, 1.2);
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.25,
        padding: `${size * 0.12}px ${size * 0.34}px`,
        border: `${size * 0.09}px solid ${color}`,
        borderRadius: size * 0.16,
        color,
        fontFamily: F.slab,
        fontSize: size,
        letterSpacing: '0.04em',
        transform: `rotate(${rot}deg) scale(${scale})`,
        opacity: clamp(k * 3) * 0.92,
        filter: `url(#rough-${id})`,
        whiteSpace: 'nowrap',
        background: 'rgba(251,246,236,0.9)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
      }}
    >
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id={`rough-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={4} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={6} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feComponentTransfer in="n" result="speck">
            <feFuncA type="discrete" tableValues="1 1 1 1 1 1 0 1 1 1" />
          </feComponentTransfer>
          <feComposite in="d" in2="speck" operator="in" />
        </filter>
      </svg>
      {icon && <Check size={size * 0.9} color={color} stroke={9} />}
      {text}
    </div>
  );
};

export const Chip: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 20px',
      borderRadius: 999,
      fontFamily: F.inter,
      fontWeight: 700,
      fontSize: 24,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Text lines of a typeset page; `snap` 0 = messy (crossing margins), 1 = aligned. */
export const PageText: React.FC<{lines: number; width: number; snap: number; seed?: number; red?: number; lineH?: number; heading?: boolean}> = ({
  lines,
  width,
  snap,
  seed = 1,
  red = 0,
  lineH = 30,
  heading = true,
}) => {
  const r = (i: number) => {
    const x = Math.sin(i * 91.7 + seed * 13.1) * 43758.5;
    return x - Math.floor(x);
  };
  return (
    <div style={{position: 'relative', width, height: lines * lineH + (heading ? 70 : 0)}}>
      {heading && (
        <div style={{height: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
          <div style={{fontFamily: F.serif, fontWeight: 700, fontSize: 18, letterSpacing: '0.3em', color: 'rgba(27,42,74,0.55)'}}>CHAPTER ONE</div>
          <div style={{width: 40, height: 2, background: 'rgba(224,163,59,0.8)'}} />
        </div>
      )}
      {Array.from({length: lines}).map((_, i) => {
        const last = i === lines - 1 || i % 7 === 6;
        // most lines are only slightly off; a few run well past the margins
        const wild = r(i + 77) > 0.62;
        const messyX = wild ? (r(i) > 0.5 ? -46 - r(i) * 30 : (r(i) - 0.5) * 20) : (r(i) - 0.5) * 14;
        const messyW = wild ? width * (1.08 + r(i + 50) * 0.16) : width * (0.9 + r(i + 50) * 0.08);
        const goodW = last ? width * (0.4 + r(i + 9) * 0.3) : width;
        const indent = i % 7 === 0 ? 28 : 0;
        const x = messyX * (1 - snap) + indent * snap;
        const wdt = messyW * (1 - snap) + (goodW - indent) * snap;
        const over = Math.max(0, x + wdt - width) + Math.max(0, -x);
        const isBad = over > 6 && red > 0;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: (heading ? 70 : 0) + i * lineH + lineH * 0.32,
              left: x,
              width: wdt,
              height: lineH * 0.34,
              borderRadius: 3,
              background: isBad ? `rgba(229,72,77,${0.35 + 0.55 * red})` : 'rgba(27,42,74,0.62)',
              transform: `rotate(${(r(i + 3) - 0.5) * 1.6 * (1 - snap)}deg)`,
            }}
          />
        );
      })}
    </div>
  );
};
