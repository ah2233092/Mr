import React from 'react';
import {C} from '../theme';

type V = [number, number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const norm = (v: V): V => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
// CSS "rotateX(ax) rotateY(ay) rotateZ(az)": the point is rotated by Z, then Y, then X.
const rotate = (v: V, ax: number, ay: number, az: number): V => {
  let [x, y, z] = v;
  const cz = Math.cos(rad(az)), sz = Math.sin(rad(az));
  [x, y] = [x * cz - y * sz, x * sz + y * cz];
  const cy = Math.cos(rad(ay)), sy = Math.sin(rad(ay));
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  const cx = Math.cos(rad(ax)), sx = Math.sin(rad(ax));
  [y, z] = [y * cx - z * sx, y * sx + z * cx];
  return [x, y, z];
};
const DEFAULT_LIGHT: V = [0.35, -0.5, 1];

export type BookProps = {
  w: number;
  h: number;
  d: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  front: React.ReactNode;
  back?: React.ReactNode;
  spine?: React.ReactNode;
  spineBg?: string;
  backBg?: string;
  light?: number; // global light 0..1
  ambient?: number;
  sheen?: number; // position of the moving specular band across the cover, 0..1 (outside = hidden)
  sheenStrength?: number;
  rim?: number; // gold rim light on the right edge
  lightDir?: V;
  style?: React.CSSProperties;
};

/** A real 3D hardcover/paperback built from CSS faces with computed Lambert shading. */
export const Book3D: React.FC<BookProps> = ({
  w,
  h,
  d,
  rotX = 0,
  rotY = 0,
  rotZ = 0,
  front,
  back,
  spine,
  spineBg = '#14213A',
  backBg = '#16233D',
  light = 1,
  ambient = 0.38,
  sheen = -1,
  sheenStrength = 0.6,
  rim = 0,
  lightDir = DEFAULT_LIGHT,
  style,
}) => {
  const LIGHT = norm(lightDir);
  const shade = (n: V) => {
    const r = rotate(n, rotX, rotY, rotZ);
    const lam = Math.max(0, r[0] * LIGHT[0] + r[1] * LIGHT[1] + r[2] * LIGHT[2]);
    const b = (ambient + (1 - ambient) * lam) * (0.25 + 0.75 * light);
    return Math.min(0.92, Math.max(0, 1 - b));
  };
  const frontN = rotate([0, 0, 1], rotX, rotY, rotZ);
  // specular: reflect light around the front normal and compare with the view axis
  const dot = frontN[0] * LIGHT[0] + frontN[1] * LIGHT[1] + frontN[2] * LIGHT[2];
  const refl: V = [2 * dot * frontN[0] - LIGHT[0], 2 * dot * frontN[1] - LIGHT[1], 2 * dot * frontN[2] - LIGHT[2]];
  const spec = Math.pow(Math.max(0, refl[2]), 18) * light;

  const face = (extra: React.CSSProperties, n: V, content: React.ReactNode, bg?: string) => (
    <div
      style={{
        position: 'absolute',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        overflow: 'hidden',
        background: bg,
        ...extra,
      }}
    >
      {content}
      <div style={{position: 'absolute', inset: 0, background: '#05080F', opacity: shade(n)}} />
    </div>
  );
  const pages = (horizontal: boolean) => ({
    background: horizontal
      ? 'repeating-linear-gradient(0deg, #F3EAD6 0px, #F3EAD6 1.4px, #DCCFB4 1.4px, #DCCFB4 2.2px)'
      : 'repeating-linear-gradient(90deg, #F3EAD6 0px, #F3EAD6 1.4px, #DCCFB4 1.4px, #DCCFB4 2.2px)',
  });

  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: h,
        transformStyle: 'preserve-3d',
        transform: `rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg)`,
        ...style,
      }}
    >
      {/* fore-edge (page block) */}
      {face({width: d, height: h - 6, left: w / 2 - d / 2, top: 3, transform: `rotateY(90deg) translateZ(${w / 2 - 2}px)`, ...pages(false)}, [1, 0, 0], null)}
      {/* top & bottom page edges */}
      {face({width: w - 4, height: d, left: 0, top: h / 2 - d / 2, transform: `rotateX(90deg) translateZ(${h / 2 - 2}px)`, ...pages(true)}, [0, -1, 0], null)}
      {face({width: w - 4, height: d, left: 0, top: h / 2 - d / 2, transform: `rotateX(-90deg) translateZ(${h / 2 - 2}px)`, ...pages(true)}, [0, 1, 0], null)}
      {/* spine */}
      {face({width: d, height: h, left: w / 2 - d / 2, top: 0, transform: `rotateY(-90deg) translateZ(${w / 2}px)`}, [-1, 0, 0], spine, spineBg)}
      {/* back */}
      {face({width: w, height: h, left: 0, top: 0, transform: `rotateY(180deg) translateZ(${d / 2}px)`}, [0, 0, -1], back, backBg)}
      {/* front */}
      <div
        style={{
          position: 'absolute',
          width: w,
          height: h,
          transform: `translateZ(${d / 2}px)`,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          overflow: 'hidden',
          borderRadius: '2px 4px 4px 2px',
        }}
      >
        {front}
        {/* hinge groove near the spine */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: w * 0.035,
            width: w * 0.03,
            background: 'linear-gradient(90deg, rgba(0,0,0,0.28), rgba(255,255,255,0.10) 45%, rgba(0,0,0,0.12))',
          }}
        />
        <div style={{position: 'absolute', inset: 0, background: '#05080F', opacity: shade([0, 0, 1])}} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            mixBlendMode: 'screen',
            opacity: 0.18 + spec * 0.6,
            background: 'linear-gradient(135deg, rgba(255,236,200,0.35) 0%, rgba(255,255,255,0) 45%)',
          }}
        />
        {sheen > -0.4 && sheen < 1.4 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              mixBlendMode: 'screen',
              opacity: sheenStrength,
              background: `linear-gradient(105deg, rgba(255,255,255,0) ${sheen * 160 - 40}%, rgba(255,226,170,0.55) ${sheen * 160 - 22}%, rgba(255,250,235,0.9) ${sheen * 160 - 18}%, rgba(255,226,170,0.45) ${sheen * 160 - 13}%, rgba(255,255,255,0) ${sheen * 160 + 2}%)`,
            }}
          />
        )}
        {rim > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: 10,
              opacity: rim,
              background: `linear-gradient(90deg, rgba(224,163,59,0), ${C.goldHi})`,
            }}
          />
        )}
      </div>
    </div>
  );
};

/** Soft contact shadow + optional floor glow under a book. */
export const FloorShadow: React.FC<{w: number; opacity?: number; glow?: number; style?: React.CSSProperties}> = ({
  w,
  opacity = 0.7,
  glow = 0,
  style,
}) => (
  <div style={{position: 'absolute', width: w * 2.2, height: w * 0.5, ...style}}>
    {glow > 0 && (
      <div
        style={{
          position: 'absolute',
          inset: '-40% -10%',
          opacity: glow,
          background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(224,163,59,0.35), rgba(224,163,59,0.08) 50%, rgba(0,0,0,0) 72%)',
        }}
      />
    )}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        background: 'radial-gradient(ellipse 42% 32% at 50% 50%, rgba(3,6,12,0.9), rgba(3,6,12,0.45) 45%, rgba(0,0,0,0) 72%)',
      }}
    />
  </div>
);
