import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp, lerp, pop, sp, tw} from '../anim';
import {IconMedallion, SERVICES} from '../components/Icons';
import {KaiLogo} from '../components/KaiLogo';
import {Reveal} from '../components/Kinetic';
import {Dust, Set} from '../components/Overlays';
import {useT} from '../components/Scene';
import {Sfx} from '../components/Sfx';
import {ROW, rowX} from '../layout';
import {at, MUSIC_DROP, S} from '../timeline';
import {C, EASE, F} from '../theme';

const Rays: React.FC<{k: number; t: number}> = ({k, t}) => (
  <div
    style={{
      position: 'absolute',
      left: 960 - 900,
      top: 430 - 900,
      width: 1800,
      height: 1800,
      opacity: k,
      transform: `rotate(${t * 6}deg) scale(${0.6 + 0.4 * k})`,
      background: `repeating-conic-gradient(from 0deg, rgba(224,163,59,0.10) 0deg 4deg, rgba(224,163,59,0) 4deg 15deg)`,
      WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0) 60%)',
      maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0) 60%)',
    }}
  />
);

export const S4Turn: React.FC = () => {
  const t = useT();
  const t0 = S.turn[0];
  const tSo = at(7, 'so');
  const tAll = at(7, 'all');
  const tIn = at(7, 'in');
  const tOut = S.turn[1];

  // gold sweep wipes the frozen chaos away (left → right)
  const sweep = tw(t, t0 + 0.02, 0.5, EASE.inOut);
  const edge = lerp(-300, 2300, sweep);

  const logoK = sp(t, tSo - 0.02, {damping: 11, stiffness: 150, mass: 0.9});
  const ring = tw(t, tSo + 0.05, 0.7, EASE.out);
  const glint = (t - (tSo + 0.45)) / 0.7;
  const up = tw(t, tIn - 0.12, 0.55, EASE.inOut);
  const logoY = lerp(400, 214, up);
  const logoSize = lerp(300, 190, up);
  const raysK = clamp(logoK) * (1 - up * 0.6);
  const allK = 1 - tw(t, tIn - 0.12, 0.25, EASE.in);
  // hand-off: other medallions drop away, logo lifts out, Publish flies on (drawn by Scene 5)
  const leave = tw(t, tOut - 0.12, 0.4, EASE.in);

  return (
    <AbsoluteFill style={{clipPath: sweep < 1 ? `polygon(0 0, ${edge}px 0, ${edge - 260}px 1080px, 0 1080px)` : undefined}}>
      <Set light={1} spotY={34} />
      <Dust t={t} opacity={0.8} seed={9} />
      <Rays k={raysK} t={t} />
      <div style={{position: 'absolute', left: 960 - logoSize / 2, top: logoY - logoSize / 2, opacity: clamp(logoK * 2) * (1 - leave), transform: `scale(${logoK}) translateY(${leave * -60}px)`}}>
        <KaiLogo size={logoSize} ring={ring} glint={glint} glow={0.9} />
      </div>

      {/* "All of it," */}
      {allK > 0 && (
        <div style={{position: 'absolute', top: 600, left: 0, right: 0, textAlign: 'center', opacity: allK}}>
          <div style={{fontFamily: F.inter, fontWeight: 700, fontSize: 50, color: C.muted, marginBottom: 4}}>
            <Reveal t={t} t0={tSo - 0.04}>So</Reveal> <Reveal t={t} t0={at(7, 'i') - 0.04}>I</Reveal> <Reveal t={t} t0={at(7, 'handle') - 0.04}>handle</Reveal>
          </div>
          <Reveal t={t} t0={tAll - 0.05} mode="letters" style={{fontFamily: F.slab, fontSize: 132, color: C.gold, textShadow: '0 14px 40px rgba(0,0,0,0.45)'}}>
            All of it,
          </Reveal>
        </div>
      )}

      {/* five services fly into a neat row */}
      {SERVICES.map((s, i) => {
        const k = sp(t, tIn - 0.05 + i * 0.09, {damping: 12, stiffness: 170});
        const fromX = [-300, 960, 2220, 400, 1500][i];
        const fromY = [300, 1300, 420, -200, 1300][i];
        const x = lerp(fromX, rowX(i), clamp(k, 0, 1.2));
        const y = lerp(fromY, ROW.y, clamp(k, 0, 1.2));
        if (i === 0 && t >= tOut - 0.12) return null; // Scene 5 takes over this one
        const drop = leave * (i === 0 ? 0 : 1);
        return (
          <div
            key={s.key}
            style={{
              position: 'absolute',
              left: x - ROW.size / 2,
              top: y - ROW.size / 2 + drop * 160,
              opacity: clamp(k * 2) * (1 - drop),
              transform: `rotate(${(1 - clamp(k)) * (i % 2 ? 30 : -30)}deg) scale(${0.6 + 0.4 * clamp(k, 0, 1.1)})`,
            }}
          >
            <IconMedallion k={s.key} size={ROW.size} draw={tw(t, tIn + i * 0.09, 0.6)} glow={pop(t, tIn + i * 0.09) * 0.6} />
            <div style={{position: 'absolute', top: ROW.size + 22, left: -60, right: -60, textAlign: 'center', fontFamily: F.inter, fontWeight: 700, fontSize: 28, color: C.cream, opacity: tw(t, tIn + 0.2 + i * 0.09, 0.3)}}>
              {s.label}
            </div>
          </div>
        );
      })}
      <div style={{position: 'absolute', top: 820, left: 0, right: 0, textAlign: 'center', fontFamily: F.slab, fontSize: 72, color: C.cream, opacity: 1 - leave}}>
        <Reveal t={t} t0={tIn - 0.03} mode="rise">in</Reveal> <Reveal t={t} t0={at(7, 'one') - 0.03} mode="rise">one</Reveal>{' '}
        <Reveal t={t} t0={at(7, 'place') - 0.03} mode="rise" style={{color: C.gold}}>place.</Reveal>
      </div>

      {/* glowing sweep edge */}
      {sweep > 0 && sweep < 1 && (
        <div
          style={{
            position: 'absolute',
            top: -100,
            left: edge - 200,
            width: 120,
            height: 1300,
            transform: `skewX(${-Math.atan2(260, 1080) * (180 / Math.PI)}deg)`,
            transformOrigin: '50% 0%',
            background: 'linear-gradient(90deg, rgba(224,163,59,0), rgba(255,226,170,0.95) 70%, rgba(255,255,255,1) 85%, rgba(224,163,59,0))',
            boxShadow: '0 0 80px 30px rgba(224,163,59,0.45)',
          }}
        />
      )}

      <Sfx at={t0 + 0.0} name="sweep" volume={0.6} />
      <Sfx at={MUSIC_DROP} name="impact_bright" volume={0.6} />
      <Sfx at={tSo + 0.45} name="glint" volume={0.45} />
      {SERVICES.map((s, i) => (
        <Sfx key={s.key} at={tIn - 0.02 + i * 0.09} name={`pop${(i % 3) + 1}`} volume={0.42} />
      ))}
    </AbsoluteFill>
  );
};
