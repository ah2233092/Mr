import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {noise, rand} from '../anim';
import {C} from '../theme';

/** Animated film grain from pre-rendered plates, re-offset every frame. */
export const Grain: React.FC<{opacity?: number}> = ({opacity = 0.075}) => {
  const frame = useCurrentFrame();
  const i = frame % 6;
  const ox = Math.floor(rand(frame) * 120);
  const oy = Math.floor(rand(frame + 77) * 190);
  return (
    <AbsoluteFill style={{overflow: 'hidden', mixBlendMode: 'overlay', opacity, pointerEvents: 'none'}}>
      <Img
        src={staticFile(`tex/grain_full${i}.jpg`)}
        style={{position: 'absolute', left: -ox, top: -oy, width: 2048, height: 1280}}
      />
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{strength?: number}> = ({strength = 0.7}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(ellipse 75% 70% at 50% 48%, rgba(14,22,38,0) 52%, rgba(14,22,38,${strength * 0.55}) 82%, rgba(9,14,25,${strength}) 100%)`,
    }}
  />
);

/** Soft warm light leak drifting across frame (screen blended, no blur filters). */
export const LightLeak: React.FC<{t: number; intensity?: number; seed?: number}> = ({t, intensity = 1, seed = 0}) => {
  if (intensity <= 0.001) return null;
  const x1 = 18 + noise(t * 0.35, seed) * 22;
  const y1 = 22 + noise(t * 0.3, seed + 3) * 18;
  const x2 = 82 + noise(t * 0.28, seed + 5) * 16;
  const y2 = 74 + noise(t * 0.33, seed + 9) * 16;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        opacity: intensity,
        background: `radial-gradient(ellipse 48% 60% at ${x1}% ${y1}%, rgba(255,170,80,0.42), rgba(255,140,60,0.12) 45%, rgba(0,0,0,0) 70%),
          radial-gradient(ellipse 40% 50% at ${x2}% ${y2}%, rgba(255,205,130,0.30), rgba(224,163,59,0.08) 50%, rgba(0,0,0,0) 72%)`,
      }}
    />
  );
};

/** Floating gold dust / bokeh with three depth layers. */
export const Dust: React.FC<{t: number; count?: number; opacity?: number; seed?: number; rise?: number}> = ({
  t,
  count = 46,
  opacity = 1,
  seed = 1,
  rise = 18,
}) => {
  if (opacity <= 0.001) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      {Array.from({length: count}).map((_, i) => {
        const r0 = rand(i * 3 + seed * 101);
        const r1 = rand(i * 7 + seed * 13);
        const r2 = rand(i * 11 + seed * 29);
        const depth = r2; // 0 far .. 1 near
        const size = depth > 0.85 ? 40 + r0 * 70 : 3 + depth * 9;
        const speed = (0.3 + depth) * rise;
        const x = ((r0 * 2100 + noise(t * 0.4, i) * 30 * (0.3 + depth)) % 2100) - 90;
        const y = ((r1 * 1300 - t * speed) % 1300 + 1300) % 1300 - 110;
        const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + r0 * 2) + i);
        const a = depth > 0.85 ? 0.08 : (0.25 + depth * 0.55) * tw;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              opacity: a,
              background: `radial-gradient(circle, ${depth > 0.85 ? 'rgba(245,201,120,0.9)' : '#FFE2A8'} 0%, rgba(224,163,59,0.5) 35%, rgba(224,163,59,0) 70%)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Navy studio set: deep gradient, overhead pool of light, soft floor and horizon glow. */
export const Set: React.FC<{light?: number; spotX?: number; spotY?: number; warm?: number; floor?: boolean}> = ({
  light = 1,
  spotX = 50,
  spotY = 36,
  warm = 0,
  floor = true,
}) => (
  <AbsoluteFill style={{background: C.ink}}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 85% 75% at ${spotX}% ${spotY}%, ${C.navyHi} 0%, ${C.navy} 42%, #142038 70%, ${C.ink} 100%)`,
        opacity: 0.35 + 0.65 * light,
      }}
    />
    {floor && (
      <AbsoluteFill
        style={{
          top: '62%',
          background: `linear-gradient(180deg, rgba(14,22,38,0) 0%, rgba(14,22,38,0.55) 60%, rgba(8,12,22,0.85) 100%)`,
        }}
      />
    )}
    <AbsoluteFill
      style={{
        mixBlendMode: 'screen',
        opacity: light * (0.55 + warm * 0.3),
        background: `radial-gradient(ellipse 34% 46% at ${spotX}% ${spotY - 6}%, rgba(255,214,150,${0.16 + warm * 0.12}) 0%, rgba(224,163,59,0.05) 55%, rgba(0,0,0,0) 75%)`,
      }}
    />
  </AbsoluteFill>
);
