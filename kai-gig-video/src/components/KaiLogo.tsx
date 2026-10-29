import React from 'react';
import {C, F} from '../theme';

/**
 * KAI brand mark rebuilt as a component: navy disc, cream "KAI" in Alfa Slab One
 * with a gold offset (extruded) shadow. `glint` sweeps a light band across (0→1),
 * `ring` draws the gold rim on (0→1).
 */
export const KaiLogo: React.FC<{size: number; glint?: number; ring?: number; glow?: number; style?: React.CSSProperties}> = ({
  size,
  glint = -1,
  ring = 1,
  glow = 0.6,
  style,
}) => {
  const fs = size * 0.37;
  const off = Math.max(2, size * 0.022);
  const steps = Math.ceil(off);
  const shadow = Array.from({length: steps})
    .map((_, i) => {
      const o = ((i + 1) / steps) * off;
      return `${o.toFixed(2)}px ${o.toFixed(2)}px 0 ${C.gold}`;
    })
    .join(', ');
  const r = size / 2;
  const circ = 2 * Math.PI * (r - size * 0.035);
  return (
    <div style={{position: 'relative', width: size, height: size, ...style}}>
      {/* halo */}
      <div
        style={{
          position: 'absolute',
          inset: -size * 0.45,
          borderRadius: '50%',
          opacity: glow,
          background: 'radial-gradient(circle, rgba(224,163,59,0.30) 0%, rgba(224,163,59,0.08) 40%, rgba(224,163,59,0) 66%)',
        }}
      />
      {/* disc */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          overflow: 'hidden',
          background: `radial-gradient(circle at 34% 28%, #33497A 0%, ${C.navy} 52%, #131F37 100%)`,
          boxShadow: `0 ${size * 0.06}px ${size * 0.16}px rgba(5,9,18,0.55), inset 0 ${size * 0.012}px 0 rgba(255,255,255,0.08)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: F.slab,
            fontSize: fs,
            color: C.cream,
            letterSpacing: '-0.01em',
            textShadow: shadow,
            transform: `translate(${-off / 2}px, ${-off / 2 + size * 0.01}px)`,
          }}
        >
          KAI
        </div>
        {glint > -0.5 && glint < 1.5 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              mixBlendMode: 'screen',
              background: `linear-gradient(115deg, rgba(255,255,255,0) ${glint * 140 - 30}%, rgba(255,236,190,0.75) ${glint * 140 - 18}%, rgba(255,255,255,0) ${glint * 140 - 6}%)`,
            }}
          />
        )}
      </div>
      {/* gold rim */}
      <svg width={size} height={size} style={{position: 'absolute', inset: 0, transform: 'rotate(-90deg)'}}>
        <circle
          cx={r}
          cy={r}
          r={r - size * 0.035}
          fill="none"
          stroke={C.gold}
          strokeWidth={Math.max(1.5, size * 0.012)}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - ring)}
          strokeLinecap="round"
          opacity={0.9}
        />
      </svg>
    </div>
  );
};
