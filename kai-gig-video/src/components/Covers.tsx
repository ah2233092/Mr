import React from 'react';
import {C, F, GOLD_FOIL} from '../theme';

type CoverProps = {w: number; h: number; style?: React.CSSProperties};

const foilText = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  backgroundImage: GOLD_FOIL,
  backgroundSize: '200% 100%',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  ...extra,
});

const Tree: React.FC<{color: string; stroke?: number}> = ({color, stroke = 2.2}) => (
  <svg viewBox="0 0 100 100" style={{width: '100%', height: '100%'}}>
    <g fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d="M50 92 V52" />
      <path d="M50 70 L36 58 M50 64 L64 52 M50 58 L42 46" />
      <circle cx="50" cy="38" r="22" />
      <path d="M36 38 q6 -10 14 -2 q8 -10 14 2" />
      <circle cx="42" cy="30" r="2.2" fill={color} />
      <circle cx="58" cy="44" r="2.2" fill={color} />
      <circle cx="56" cy="27" r="2.2" fill={color} />
      <path d="M28 92 H72" />
    </g>
  </svg>
);

/** The author's book as a classic cloth hardcover with gold foil stamping (hook / proof). */
export const ClothCover: React.FC<CoverProps> = ({w, h, style}) => (
  <div
    style={{
      position: 'relative',
      width: w,
      height: h,
      fontSize: w / 10,
      background: `radial-gradient(ellipse at 40% 30%, #2D4475 0%, #20325A 55%, #15223D 100%)`,
      ...style,
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.22,
        background:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 1px, rgba(0,0,0,0) 1px 3px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.18) 0 1px, rgba(0,0,0,0) 1px 3px)',
      }}
    />
    <div style={{position: 'absolute', inset: '0.55em', border: `0.06em solid ${C.gold}`, opacity: 0.85}} />
    <div style={{position: 'absolute', inset: '0.75em', border: `0.025em solid ${C.gold}`, opacity: 0.6}} />
    <div style={{position: 'absolute', left: 0, right: 0, top: '1.7em', textAlign: 'center'}}>
      <div style={foilText({fontFamily: F.inter, fontWeight: 600, fontSize: '0.36em', letterSpacing: '0.42em'})}>A NOVEL</div>
    </div>
    <div style={{position: 'absolute', left: '2.6em', right: '2.6em', top: '3.1em', height: '3.6em', opacity: 0.95}}>
      <Tree color={C.gold} stroke={2.4} />
    </div>
    <div style={{position: 'absolute', left: 0, right: 0, top: '7.4em', textAlign: 'center', lineHeight: 0.95}}>
      <div style={foilText({fontFamily: F.serif, fontWeight: 800, fontSize: '1.08em', letterSpacing: '0.14em'})}>THE LAST</div>
      <div style={foilText({fontFamily: F.serif, fontWeight: 800, fontSize: '1.32em', letterSpacing: '0.08em', marginTop: '0.12em'})}>
        ORCHARD
      </div>
    </div>
    <div style={{position: 'absolute', left: 0, right: 0, bottom: '1.45em', textAlign: 'center'}}>
      <div style={foilText({fontFamily: F.inter, fontWeight: 600, fontSize: '0.4em', letterSpacing: '0.38em'})}>ELENA MARSH</div>
    </div>
  </div>
);

export const ClothSpine: React.FC<{d: number; h: number}> = ({d, h}) => (
  <div
    style={{
      width: d,
      height: h,
      background: `linear-gradient(90deg, #101A2E, ${C.navy} 40%, #16243F)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div
      style={{
        transform: 'rotate(90deg)',
        whiteSpace: 'nowrap',
        fontFamily: F.serif,
        fontWeight: 800,
        fontSize: d * 0.36,
        letterSpacing: '0.18em',
        ...foilText(),
      }}
    >
      THE LAST ORCHARD
    </div>
  </div>
);

/** The same book with a weak, amateur cover (problem scene). */
export const DullCover: React.FC<CoverProps & {face?: number}> = ({w, h, style, face = 0}) => (
  <div
    style={{
      position: 'relative',
      width: w,
      height: h,
      fontSize: w / 10,
      background: 'linear-gradient(180deg, #C9CBBE, #B7B9AB)',
      overflow: 'hidden',
      ...style,
    }}
  >
    <div style={{position: 'absolute', left: '3em', right: '3em', top: '3.6em', height: '3.4em', opacity: 0.55}}>
      <Tree color="#8F927F" stroke={3} />
    </div>
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '1.6em',
        textAlign: 'center',
        fontFamily: F.serif,
        fontWeight: 400,
        fontSize: '0.62em',
        color: '#9A9C8D',
        letterSpacing: '0.02em',
      }}
    >
      The Last Orchard
    </div>
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: '1.1em',
        textAlign: 'center',
        fontFamily: F.inter,
        fontSize: '0.3em',
        color: '#A3A596',
      }}
    >
      by Elena Marsh
    </div>
    {face > 0 && <SadFace k={face} />}
  </div>
);

/** Original tiny cartoon face for the meme beat: eyes droop, sweat drop. */
const SadFace: React.FC<{k: number}> = ({k}) => (
  <svg viewBox="0 0 100 60" style={{position: 'absolute', left: '12%', width: '76%', top: '50%', opacity: Math.min(1, k * 2)}}>
    <g stroke="#3B3F33" strokeWidth={3.2} strokeLinecap="round" fill="none">
      <path d={`M24 ${18 + k * 4} q8 ${-6 + k * 10} 16 0`} />
      <path d={`M60 ${18 + k * 4} q8 ${-6 + k * 10} 16 0`} />
      <path d={`M38 46 q12 ${-10 * k} 24 0`} />
    </g>
    <path d="M86 6 q6 10 0 14 q-6 -4 0 -14z" fill="#7FB7E6" opacity={k} transform={`translate(0 ${k * 8})`} />
  </svg>
);

/** The premium illustrated jacket KAI designs (services scene). */
export const PremiumCover: React.FC<CoverProps> = ({w, h, style}) => (
  <div
    style={{
      position: 'relative',
      width: w,
      height: h,
      fontSize: w / 10,
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #0F1A31 0%, #1B2A4A 34%, #6B4A3A 62%, #D9893A 78%, #F2B45A 86%, #2A1E1E 87%)',
      ...style,
    }}
  >
    {/* sun */}
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '68%',
        width: '5.6em',
        height: '5.6em',
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: 'radial-gradient(circle, #FFE9B8 0%, #F5C978 30%, rgba(245,170,80,0.35) 55%, rgba(245,170,80,0) 72%)',
      }}
    />
    {/* stars */}
    {[
      [12, 10], [26, 18], [70, 8], [84, 20], [58, 16], [40, 7], [90, 34], [8, 30],
    ].map(([x, y], i) => (
      <div key={i} style={{position: 'absolute', left: `${x}%`, top: `${y}%`, width: '0.08em', height: '0.08em', borderRadius: '50%', background: '#FFF3D6', opacity: 0.8}} />
    ))}
    {/* orchard rows */}
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" style={{position: 'absolute', left: 0, bottom: 0, width: '100%', height: '42%'}}>
      <path d="M0 22 Q25 16 50 20 T100 18 V60 H0Z" fill="#3A2A2A" opacity={0.9} />
      {Array.from({length: 9}).map((_, i) => (
        <g key={i} transform={`translate(${i * 12 + 2} ${18 + (i % 2) * 2})`} fill="#24191B">
          <rect x={3.4} y={4} width={1.2} height={6} />
          <circle cx={4} cy={3} r={4} />
        </g>
      ))}
      <path d="M0 34 Q30 28 55 33 T100 31 V60 H0Z" fill="#1E1517" />
      {Array.from({length: 7}).map((_, i) => (
        <g key={i} transform={`translate(${i * 16 - 2} ${28 + (i % 2) * 2})`} fill="#140E10">
          <rect x={5.2} y={6} width={1.6} height={9} />
          <circle cx={6} cy={4.5} r={6} />
        </g>
      ))}
      <path d="M44 60 L50 34 L56 60Z" fill="#E0A33B" opacity={0.22} />
    </svg>
    <div style={{position: 'absolute', left: 0, right: 0, top: '1.1em', textAlign: 'center'}}>
      <div style={{fontFamily: F.inter, fontWeight: 600, fontSize: '0.34em', letterSpacing: '0.5em', color: C.goldHi}}>A NOVEL</div>
    </div>
    <div style={{position: 'absolute', left: 0, right: 0, top: '2.2em', textAlign: 'center', lineHeight: 0.92}}>
      <div style={{fontFamily: F.serif, fontWeight: 900, fontSize: '1.25em', letterSpacing: '0.12em', color: C.cream, textShadow: '0 0.06em 0.2em rgba(0,0,0,0.5)'}}>
        THE LAST
      </div>
      <div style={{fontFamily: F.serif, fontWeight: 900, fontSize: '1.7em', letterSpacing: '0.04em', color: C.cream, textShadow: '0 0.06em 0.2em rgba(0,0,0,0.5)'}}>
        ORCHARD
      </div>
      <div style={{width: '2.2em', height: '0.05em', background: C.gold, margin: '0.35em auto 0'}} />
    </div>
    <div style={{position: 'absolute', left: 0, right: 0, bottom: '0.9em', textAlign: 'center'}}>
      <div style={{fontFamily: F.inter, fontWeight: 700, fontSize: '0.44em', letterSpacing: '0.34em', color: C.cream}}>ELENA MARSH</div>
    </div>
  </div>
);

export const PremiumSpine: React.FC<{d: number; h: number}> = ({d, h}) => (
  <div
    style={{
      width: d,
      height: h,
      background: 'linear-gradient(180deg, #0F1A31 0%, #1B2A4A 40%, #6B4A3A 70%, #2A1E1E 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div style={{transform: 'rotate(90deg)', whiteSpace: 'nowrap', fontFamily: F.serif, fontWeight: 900, fontSize: d * 0.34, letterSpacing: '0.14em', color: C.cream}}>
      THE LAST ORCHARD
    </div>
  </div>
);

// ---------------------------------------------------------------- generic store covers
type Generic = {title: string[]; author: string; bg: string; ink: string; accent: string; motif: 'waves' | 'hearts' | 'clock' | 'flower' | 'city' | 'peaks' | 'ember' | 'letter'; font?: 'serif' | 'slab' | 'sans'};

export const GENERIC: Generic[] = [
  {title: ['MIDNIGHT', 'TIDE'], author: 'R. OKAFOR', bg: 'linear-gradient(180deg,#0E3B45,#08222B)', ink: '#E8F4F1', accent: '#5FC2BA', motif: 'waves', font: 'serif'},
  {title: ['Paper', 'Hearts'], author: 'JUNE ALDER', bg: 'linear-gradient(180deg,#F4D9D2,#E9B9B0)', ink: '#6E2B35', accent: '#C9566A', motif: 'hearts', font: 'serif'},
  {title: ['THE NINTH', 'HOUR'], author: 'D. VOSS', bg: 'linear-gradient(180deg,#2A1D45,#150F26)', ink: '#EDE3FF', accent: '#B49CFF', motif: 'clock', font: 'sans'},
  {title: ['WILD', 'FLOWER'], author: 'MAYA CRUZ', bg: 'linear-gradient(180deg,#DCE5CF,#B9C9A6)', ink: '#2F4527', accent: '#E07A5F', motif: 'flower', font: 'slab'},
  {title: ['GLASS', 'CITY'], author: 'T. HAYES', bg: 'linear-gradient(180deg,#1F4E8C,#0F2747)', ink: '#F2F7FF', accent: '#7FB2FF', motif: 'city', font: 'sans'},
  {title: ['NORTH', 'BOUND'], author: 'ARI LINDQVIST', bg: 'linear-gradient(180deg,#F0A35E,#C9622F)', ink: '#2B1A12', accent: '#2B1A12', motif: 'peaks', font: 'slab'},
  {title: ['IRON', '& ASH'], author: 'K. MERCER', bg: 'linear-gradient(180deg,#3A3A3F,#1C1C20)', ink: '#F5E6D3', accent: '#F08A3C', motif: 'ember', font: 'serif'},
  {title: ['Summer', 'Letters'], author: 'NORA WELLS', bg: 'linear-gradient(180deg,#FBE7A6,#F2CB63)', ink: '#5A3E10', accent: '#B5651D', motif: 'letter', font: 'serif'},
];

const Motif: React.FC<{m: Generic['motif']; c: string}> = ({m, c}) => {
  const g = {fill: 'none', stroke: c, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  switch (m) {
    case 'waves':
      return (
        <g {...g}>
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M5 ${40 + i * 12} q11 -8 22 0 t22 0 t22 0 t22 0`} opacity={1 - i * 0.18} />
          ))}
          <circle cx={70} cy={20} r={8} fill={c} stroke="none" opacity={0.8} />
        </g>
      );
    case 'hearts':
      return (
        <g fill={c} opacity={0.85}>
          <path d="M50 78 C20 56 26 34 42 36 C47 37 50 42 50 42 C50 42 53 37 58 36 C74 34 80 56 50 78Z" />
          <path d="M24 40 C14 32 17 24 23 25 C25 25 26 27 26 27 C26 27 27 25 29 25 C35 24 38 32 24 40Z" opacity={0.6} />
        </g>
      );
    case 'clock':
      return (
        <g {...g}>
          <circle cx={50} cy={50} r={28} />
          <path d="M50 30 V50 L64 58" />
          {Array.from({length: 12}).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <path key={i} d={`M${50 + Math.sin(a) * 23} ${50 - Math.cos(a) * 23} L${50 + Math.sin(a) * 26} ${50 - Math.cos(a) * 26}`} />;
          })}
        </g>
      );
    case 'flower':
      return (
        <g>
          {Array.from({length: 6}).map((_, i) => (
            <ellipse key={i} cx={50} cy={36} rx={8} ry={16} fill={c} opacity={0.85} transform={`rotate(${i * 60} 50 50)`} />
          ))}
          <circle cx={50} cy={50} r={8} fill="#F2C14E" />
        </g>
      );
    case 'city':
      return (
        <g fill={c} opacity={0.75}>
          {[[10, 40], [24, 26], [38, 46], [52, 18], [66, 36], [80, 30]].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width={12} height={90 - y} />
          ))}
        </g>
      );
    case 'peaks':
      return (
        <g fill={c} opacity={0.85}>
          <path d="M0 80 L30 38 L46 58 L64 26 L100 80Z" />
          <circle cx={74} cy={22} r={7} />
        </g>
      );
    case 'ember':
      return (
        <g>
          <path d="M50 20 C62 40 70 48 64 64 C60 76 40 76 36 64 C32 52 44 46 50 20Z" fill={c} opacity={0.9} />
          <path d="M50 46 C56 56 58 60 54 68 C50 72 46 70 46 64 C46 58 50 56 50 46Z" fill="#FFD27A" />
        </g>
      );
    case 'letter':
      return (
        <g {...g}>
          <rect x={20} y={32} width={60} height={40} rx={3} />
          <path d="M20 34 L50 56 L80 34" />
        </g>
      );
  }
};

export const GenericCover: React.FC<CoverProps & {i: number}> = ({w, h, i, style}) => {
  const g = GENERIC[i % GENERIC.length];
  const family = g.font === 'slab' ? F.slab : g.font === 'sans' ? F.inter : F.serif;
  return (
    <div style={{position: 'relative', width: w, height: h, fontSize: w / 10, background: g.bg, overflow: 'hidden', ...style}}>
      <svg viewBox="0 0 100 100" style={{position: 'absolute', left: '10%', width: '80%', top: '34%'}}>
        <Motif m={g.motif} c={g.accent} />
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, top: '0.9em', textAlign: 'center', color: g.ink, lineHeight: 0.98}}>
        {g.title.map((t, k) => (
          <div key={k} style={{fontFamily: family, fontWeight: g.font === 'sans' ? 800 : 800, fontSize: '1.15em', letterSpacing: g.font === 'sans' ? '0.06em' : '0.03em'}}>
            {t}
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: '0.75em', textAlign: 'center', color: g.ink, fontFamily: F.inter, fontWeight: 600, fontSize: '0.36em', letterSpacing: '0.24em'}}>
        {g.author}
      </div>
    </div>
  );
};

/** Flat book used in grids (cover + subtle page thickness + shadow). */
export const FlatBook: React.FC<{w: number; h: number; children: React.ReactNode; style?: React.CSSProperties; lift?: number}> = ({
  w,
  h,
  children,
  style,
  lift = 0,
}) => (
  <div
    style={{
      position: 'relative',
      width: w,
      height: h,
      borderRadius: '2px 5px 5px 2px',
      overflow: 'hidden',
      boxShadow: `0 ${8 + lift * 18}px ${18 + lift * 30}px rgba(4,8,16,${0.35 + lift * 0.2}), 0 2px 4px rgba(0,0,0,0.25)`,
      ...style,
    }}
  >
    {children}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'linear-gradient(90deg, rgba(0,0,0,0.25) 0%, rgba(255,255,255,0.12) 4%, rgba(0,0,0,0.06) 7%, rgba(0,0,0,0) 12%), linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 40%)',
      }}
    />
  </div>
);
