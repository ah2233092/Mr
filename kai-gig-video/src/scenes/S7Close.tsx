import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp, lerp, map, noise, rand, sp, tw} from '../anim';
import {Book3D} from '../components/Book3D';
import {PremiumCover, PremiumSpine} from '../components/Covers';
import {Reveal, VOLine} from '../components/Kinetic';
import {Dust, LightLeak} from '../components/Overlays';
import {useT} from '../components/Scene';
import {Sfx} from '../components/Sfx';
import {at, S, w} from '../timeline';
import {C, EASE, F} from '../theme';

// "The End" as a single handwritten stroke path (drawn on with dash offset)
const THE_END =
  'M10 30 L60 30 M35 30 L33 78 M72 22 L66 80 M66 56 C74 44 92 44 92 58 L90 80 M110 64 C122 64 132 58 128 50 C122 42 104 50 106 66 C108 80 124 82 136 74 ' +
  'M190 32 C178 26 160 30 160 44 C160 56 176 54 182 52 M182 52 C166 54 156 62 158 72 C160 82 182 84 196 74 M214 52 L210 80 M211 64 C218 52 236 50 236 62 L234 80 ' +
  'M286 56 C276 48 256 52 256 68 C256 82 276 84 286 70 M290 20 L286 80';

const Manuscript: React.FC<{t: number; draw: number}> = ({t, draw}) => (
  <div style={{position: 'relative', width: 560, height: 700}}>
    {/* stack of pages */}
    {[4, 3, 2, 1].map((k) => (
      <div
        key={k}
        style={{
          position: 'absolute',
          left: k * 5,
          top: k * 6,
          width: 540,
          height: 680,
          borderRadius: 4,
          background: k % 2 ? '#F1E6CF' : '#EBDDC2',
          boxShadow: '0 30px 60px rgba(20,10,5,0.45)',
          transform: `rotate(${(k - 2) * 1.2}deg)`,
        }}
      />
    ))}
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 540,
        height: 680,
        borderRadius: 4,
        background: 'radial-gradient(ellipse at 40% 30%, #FFF9EC, #F6ECDA 60%, #E9D9BB)',
        boxShadow: '0 40px 80px rgba(20,10,5,0.5)',
        padding: '70px 64px',
      }}
    >
      {Array.from({length: 9}).map((_, i) => (
        <div key={i} style={{height: 12, borderRadius: 6, margin: '0 0 24px', width: `${i === 8 ? 52 : 92 - rand(i + 3) * 10}%`, background: 'rgba(60,40,25,0.22)'}} />
      ))}
      <svg viewBox="0 0 300 100" width={420} height={140} style={{position: 'absolute', left: 60, top: 420, overflow: 'visible'}}>
        <path d={THE_END} fill="none" stroke="#1B2A4A" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      </svg>
      <div style={{position: 'absolute', left: 70, top: 590, width: 380 * clamp(draw * 1.4 - 0.4), height: 4, borderRadius: 2, background: C.gold}} />
    </div>
  </div>
);

/** A kraft parcel seen from the front-top; flaps open, light spills out. */
const Parcel: React.FC<{open: number; glow: number; children?: React.ReactNode}> = ({open, glow, children}) => {
  const W = 560, H = 300, D = 120; // front width/height, visible top depth
  const kraft = 'linear-gradient(180deg, #D7A766, #C48D4E 60%, #A97540)';
  return (
    <div style={{position: 'relative', width: W, height: H + D}}>
      {/* back flap opening backwards */}
      <div style={{position: 'absolute', left: 30, top: D * 0.15, width: W - 60, height: D, perspective: 900}}>
        <div style={{width: '100%', height: '100%', background: 'linear-gradient(180deg, #B98447, #D3A262)', transformOrigin: '50% 100%', transform: `rotateX(${lerp(-90, 40, open)}deg)`, borderRadius: 4}} />
      </div>
      {/* inner opening */}
      <div style={{position: 'absolute', left: 30, top: D * 0.15 + D * 0.85, width: W - 60, height: 0}} />
      <div style={{position: 'absolute', left: 30, top: D, width: W - 60, height: 60, background: '#5A3B1E', clipPath: 'polygon(0 100%, 100% 100%, 100% 0, 0 0)', transform: 'translateY(-60px)', opacity: open}} />
      {/* light spilling out */}
      <div
        style={{
          position: 'absolute',
          left: W / 2 - 500,
          top: -700,
          width: 1000,
          height: 800,
          opacity: glow,
          mixBlendMode: 'screen',
          clipPath: 'polygon(38% 100%, 62% 100%, 100% 0, 0 0)',
          background: 'linear-gradient(0deg, rgba(255,214,150,0.65), rgba(255,200,120,0.12) 70%, rgba(0,0,0,0))',
        }}
      />
      {children}
      {/* front face */}
      <div style={{position: 'absolute', left: 0, top: D, width: W, height: H, background: kraft, borderRadius: 6, boxShadow: '0 40px 70px rgba(20,10,5,0.55), inset 0 2px 0 rgba(255,255,255,0.25)'}}>
        <div style={{position: 'absolute', left: W / 2 - 50, top: 0, width: 100, height: '100%', background: 'linear-gradient(90deg, rgba(255,240,210,0.25), rgba(255,240,210,0.4), rgba(255,240,210,0.25))'}} />
        <div style={{position: 'absolute', left: 40, bottom: 34, fontFamily: F.slab, fontSize: 30, color: 'rgba(60,35,15,0.55)', letterSpacing: '0.04em'}}>THIS SIDE UP</div>
        <div style={{position: 'absolute', right: 40, bottom: 30, width: 70, height: 70, borderRadius: '50%', border: '3px solid rgba(60,35,15,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.slab, fontSize: 22, color: 'rgba(60,35,15,0.55)'}}>
          KAI
        </div>
      </div>
      {/* front flap folding down towards the viewer */}
      <div style={{position: 'absolute', left: 30, top: D, width: W - 60, height: D, perspective: 900}}>
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(180deg, #E1B373, #C9935A)',
            transformOrigin: '50% 0%',
            transform: `rotateX(${lerp(90, -150, open)}deg)`,
            borderRadius: 4,
            boxShadow: '0 10px 20px rgba(0,0,0,0.25)',
            backfaceVisibility: 'visible',
          }}
        />
      </div>
    </div>
  );
};

export const S7Close: React.FC = () => {
  const t = useT();
  const t0 = S.close[0];
  const tLet = at(15, 'let');
  const tEvery = at(15, 'everything');
  // light-burn transition in
  const burn = 1 - Math.abs(map(t, [t0 - 0.4, t0, t0 + 0.4], [-1, 0, 1]));
  const vis = tw(t, t0 - 0.12, 0.2);
  const draw = tw(t, w(14, 0), 1.2, EASE.inOut);
  // camera dolly from manuscript to parcel
  const dolly = tw(t, tLet - 0.35, 0.95, EASE.inOut);
  const camX = lerp(0, -820, dolly);
  const open = tw(t, tLet + 0.2, 0.75, EASE.out);
  const rise = sp(t, tLet + 0.65, {damping: 18, stiffness: 40, mass: 1.2});
  const glow = tw(t, tLet + 0.4, 0.8);
  const slow = (t - t0) * 0.35; // slow-motion drift
  const partA = 1 - tw(t, tLet - 0.25, 0.25, EASE.in);
  const exit = tw(t, S.close[1] - 0.15, 0.35, EASE.in);
  const BW = 230, BH = 345, BD = 46;
  return (
    <AbsoluteFill style={{opacity: vis, overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `translateY(${exit * 1100}px)`, filter: exit > 0.05 ? `blur(${exit * 24}px)` : undefined}}>
        {/* warm interior */}
        <AbsoluteFill style={{background: 'radial-gradient(ellipse 80% 70% at 55% 40%, #4A3424 0%, #2B2230 45%, #161B2C 80%, #0E1626 100%)'}} />
        {/* bokeh */}
        {Array.from({length: 18}).map((_, i) => {
          const s = 60 + rand(i * 3) * 160;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: ((rand(i * 7) * 2400 + camX * 0.25 + slow * 20) % 2400) - 200,
                top: rand(i * 11) * 700 - 80,
                width: s,
                height: s,
                borderRadius: '50%',
                opacity: 0.12 + rand(i) * 0.14,
                background: 'radial-gradient(circle, rgba(255,196,120,0.9), rgba(255,170,90,0.3) 50%, rgba(255,170,90,0) 70%)',
              }}
            />
          );
        })}
        {/* table surface */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 760, bottom: 0, background: 'linear-gradient(180deg, #3A2618, #24170F)', boxShadow: '0 -2px 0 rgba(255,200,140,0.12)'}} />
        <AbsoluteFill style={{transform: `translateX(${camX}px)`}}>
          <div style={{position: 'absolute', left: 700 - 280, top: 250, transform: `rotate(${-4 + noise(slow, 2) * 1.5}deg) scale(${0.82 + slow * 0.03})`, transformOrigin: '50% 0%'}}>
            <Manuscript t={t} draw={draw} />
          </div>
          {/* fountain pen resting on the stack */}
          <div style={{position: 'absolute', left: 900, top: 720, width: 300, height: 22, borderRadius: 11, background: 'linear-gradient(180deg, #2C2C34, #101014)', transform: 'rotate(-28deg)', boxShadow: '0 10px 20px rgba(0,0,0,0.5)'}}>
            <div style={{position: 'absolute', right: -26, top: 3, width: 40, height: 16, background: C.gold, clipPath: 'polygon(0 0, 100% 50%, 0 100%)'}} />
            <div style={{position: 'absolute', left: 60, top: 0, width: 14, height: 22, background: C.gold}} />
          </div>
          {/* parcel with the finished book */}
          <div style={{position: 'absolute', left: 1640 + 140 - 280, top: 420}}>
            <Parcel open={open} glow={glow}>
              <div style={{position: 'absolute', left: -400, right: -400, top: -900, height: 900 + 120 + 300, overflow: 'hidden'}}>
              <div style={{position: 'absolute', left: 400 + 280 - BW / 2, top: 900 + lerp(140, -150, clamp(rise, 0, 1.05)), perspective: 1600}}>
                <Book3D w={BW} h={BH} d={BD} rotY={lerp(-10, 24, clamp(rise)) + Math.sin(slow * 3) * 3} rotX={6} front={<PremiumCover w={BW} h={BH} />} spine={<PremiumSpine d={BD} h={BH} />} rim={0.8} sheen={map(t, [tEvery - 0.2, tEvery + 0.9], [0, 1.3])} lightDir={[0.2, -0.8, 1]} />
              </div>
              </div>
            </Parcel>
          </div>
        </AbsoluteFill>
        <Dust t={t * 0.4} opacity={0.9} seed={31} count={50} rise={10} />
        <LightLeak t={t} intensity={0.55 + 0.45 * glow} seed={4} />
      </AbsoluteFill>

      {/* kinetic type */}
      <div style={{position: 'absolute', top: 96, left: 0, right: 0, textAlign: 'center', fontFamily: F.slab, fontSize: 92, color: C.cream, opacity: partA * (1 - exit), textShadow: '0 10px 30px rgba(0,0,0,0.5)'}}>
        <VOLine t={t} line={14} mode="blur" gold={[3]} />
      </div>
      {partA < 1 && (
        <div style={{position: 'absolute', top: 70, left: 0, right: 0, textAlign: 'center', opacity: 1 - exit}}>
          <div style={{fontFamily: F.inter, fontWeight: 700, fontSize: 54, color: C.cream, textShadow: '0 8px 24px rgba(0,0,0,0.5)'}}>
            <VOLine t={t} line={15} from={0} to={5} mode="rise" />
          </div>
          <div style={{marginTop: 4}}>
            <Reveal t={t} t0={tEvery - 0.05} mode="letters" style={{fontFamily: F.slab, fontSize: 118, color: C.gold, textShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 40px rgba(224,163,59,0.3)'}}>
              everything else.
            </Reveal>
          </div>
        </div>
      )}
      {/* light burn overlay */}
      {burn > 0 && <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(255,240,215,1), rgba(255,190,110,0.85) 50%, rgba(224,140,60,0.6))', opacity: Math.pow(burn, 1.6) * 0.9, mixBlendMode: 'screen'}} />}

      <Sfx at={t0 - 0.4} name="light_burn" volume={0.45} />
      <Sfx at={w(14, 0)} name="pen_write" volume={0.4} />
      <Sfx at={tLet - 0.35} name="whoosh_soft" volume={0.3} />
      <Sfx at={tLet + 0.2} name="box_open" volume={0.5} />
      <Sfx at={tEvery - 0.1} name="shimmer" volume={0.4} />
      <Sfx at={S.close[1] - 0.15} name="whip_down" volume={0.45} />
    </AbsoluteFill>
  );
};
