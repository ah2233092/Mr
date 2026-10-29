import React from 'react';
import {C} from '../theme';

export type ServiceKey = 'publish' | 'format' | 'cover' | 'keywords' | 'aplus';
export const SERVICES: {key: ServiceKey; label: string; sub: string}[] = [
  {key: 'publish', label: 'Publish', sub: 'Kindle · Paperback · Hardcover'},
  {key: 'format', label: 'Format', sub: 'Print-ready, approved first time'},
  {key: 'cover', label: 'Cover', sub: 'Designed to stop the scroll'},
  {key: 'keywords', label: 'Keywords', sub: 'Found by the right readers'},
  {key: 'aplus', label: 'A+ Content', sub: 'Turns visitors into buyers'},
];

// Hand-drawn line icons on a 64-unit grid; `draw` animates the strokes on (0→1).
const PATHS: Record<ServiceKey, {d: string; fill?: boolean}[]> = {
  publish: [
    {d: 'M14 20 C14 17 16 15 19 15 H30 C32 15 32 17 32 17 C32 17 32 15 34 15 H45 C48 15 50 17 50 20 V46 C50 48 48 49 46 49 H34 C33 49 32 50 32 52 C32 50 31 49 30 49 H18 C16 49 14 48 14 46 Z'},
    {d: 'M32 17 V52'},
    {d: 'M41 38 V25 M36 30 L41 25 L46 30'},
  ],
  format: [
    {d: 'M17 10 H40 L48 18 V54 H17 Z'},
    {d: 'M40 10 V18 H48'},
    {d: 'M23 26 H42 M23 32 H42 M23 38 H42 M23 44 H35'},
    {d: 'M11 22 V48 M54 22 V48'},
  ],
  cover: [
    {d: 'M16 10 H46 C48 10 49 11 49 13 V51 C49 53 48 54 46 54 H16 Z'},
    {d: 'M21 10 V54'},
    {d: 'M27 44 L34 34 L39 40 L42 36 L45 44 Z'},
    {d: 'M38 22 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0'},
  ],
  keywords: [
    {d: 'M28 12 a16 16 0 1 0 0.01 0 Z'},
    {d: 'M40 40 L53 53'},
    {d: 'M20 25 H36 M20 31 H33 M20 37 H30'},
  ],
  aplus: [
    {d: 'M10 14 H54 V50 H10 Z'},
    {d: 'M10 24 H54'},
    {d: 'M17 44 L24 30 L31 44 M19.5 39 H28.5'},
    {d: 'M42 32 V44 M36 38 H48'},
  ],
};

export const ServiceIcon: React.FC<{k: ServiceKey; size: number; draw?: number; color?: string; stroke?: number}> = ({
  k,
  size,
  draw = 1,
  color = C.gold,
  stroke = 3.2,
}) => (
  <svg viewBox="0 0 64 64" width={size} height={size} style={{overflow: 'visible'}}>
    {PATHS[k].map((p, i) => {
      const local = Math.min(1, Math.max(0, draw * 1.35 - i * 0.12));
      return (
        <path
          key={i}
          d={p.d}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - local}
        />
      );
    })}
  </svg>
);

/** Icon inside a glassy navy medallion with gold ring. */
export const IconMedallion: React.FC<{k: ServiceKey; size: number; draw?: number; glow?: number}> = ({k, size, draw = 1, glow = 0}) => (
  <div
    style={{
      position: 'relative',
      width: size,
      height: size,
      borderRadius: size * 0.3,
      background: `linear-gradient(160deg, #2C4170 0%, ${C.navy} 60%, #15213B 100%)`,
      boxShadow: `0 ${size * 0.12}px ${size * 0.3}px rgba(4,8,16,0.5), inset 0 1px 0 rgba(255,255,255,0.10), 0 0 0 ${Math.max(1.5, size * 0.018)}px rgba(224,163,59,0.55), 0 0 ${size * 0.5}px rgba(224,163,59,${glow * 0.45})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <ServiceIcon k={k} size={size * 0.6} draw={draw} />
  </div>
);

export const Check: React.FC<{size: number; color?: string; draw?: number; stroke?: number}> = ({size, color = C.gold, draw = 1, stroke = 6}) => (
  <svg viewBox="0 0 64 64" width={size} height={size} style={{overflow: 'visible'}}>
    <path d="M14 34 L27 47 L51 19" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
  </svg>
);

export const Cursor: React.FC<{size?: number; press?: number}> = ({size = 46, press = 0}) => (
  <svg viewBox="0 0 32 32" width={size} height={size} style={{overflow: 'visible', transform: `scale(${1 - press * 0.12})`, transformOrigin: '20% 10%', filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.35))'}}>
    <path d="M6 3 L6 26 L12 20.5 L16 29 L20 27.2 L16 18.8 L24 18.8 Z" fill="#fff" stroke="#0E1626" strokeWidth={1.8} strokeLinejoin="round" />
  </svg>
);
