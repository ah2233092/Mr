import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp, lerp, map, pop, rand, shake, sp, tw} from '../anim';
import {Reveal, VOLine} from '../components/Kinetic';
import {Dust, LightLeak, Set} from '../components/Overlays';
import {useT} from '../components/Scene';
import {Sfx} from '../components/Sfx';
import {BUY_BTN} from '../layout';
import {at, S, w} from '../timeline';
import {C, EASE, F, GOLD_FOIL} from '../theme';

const SPINE_COLORS = ['#2A3F6B', '#E0A33B', '#F6ECDA', '#1F4E5A', '#6B2E3A', '#8FA58A', '#C77B3A', '#3B3561', '#D9C29A', '#24365C'];

/** One endless shelf of book spines scrolling left. `pop` makes new books drop in. */
const ShelfRow: React.FC<{t: number; y: number; scale: number; speed: number; seed: number; blur: number; dim: number; dropFrom?: number}> = ({
  t,
  y,
  scale,
  speed,
  seed,
  blur,
  dim,
  dropFrom,
}) => {
  const spines: React.ReactNode[] = [];
  const shift = (t * speed) % 4000;
  let x = 0;
  let i = 0;
  while (x < 4000 + 1920) {
    const r = rand(i * 13 + seed * 97);
    const wd = (26 + r * 30) * scale;
    const ht = (170 + rand(i * 7 + seed) * 70) * scale;
    const col = SPINE_COLORS[Math.floor(rand(i * 3 + seed * 5) * SPINE_COLORS.length)];
    const sx = x - shift;
    if (sx > -100 && sx < 2020) {
      // new books drop onto the front shelf as the counter rolls
      const appear = dropFrom !== undefined ? sp(t, dropFrom + ((sx + 100) / 2120) * 1.2, {damping: 12, stiffness: 200}) : 1;
      const tilt = rand(i * 5 + seed) > 0.93 ? -8 : 0;
      spines.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            left: sx,
            top: y - ht,
            width: wd - 3 * scale,
            height: ht,
            borderRadius: 3 * scale,
            background: `linear-gradient(90deg, rgba(0,0,0,0.28), rgba(255,255,255,0.12) 30%, rgba(0,0,0,0.05) 60%, rgba(0,0,0,0.3)), ${col}`,
            transform: `translateY(${(1 - clamp(appear)) * -500}px) rotate(${tilt}deg)`,
            transformOrigin: '50% 100%',
            opacity: clamp(appear * 3),
          }}
        >
          <div style={{position: 'absolute', left: '18%', right: '18%', top: '14%', height: 3 * scale, background: 'rgba(224,163,59,0.8)'}} />
          <div style={{position: 'absolute', left: '18%', right: '18%', bottom: '14%', height: 3 * scale, background: 'rgba(224,163,59,0.8)'}} />
        </div>,
      );
    }
    x += wd;
    i++;
  }
  return (
    <div style={{position: 'absolute', inset: 0, filter: blur > 0.3 ? `blur(${blur}px)` : undefined}}>
      {spines}
      <div style={{position: 'absolute', left: 0, right: 0, top: y, height: 18 * scale, background: 'linear-gradient(180deg, #3A4F7E, #1B2A4A)', boxShadow: '0 16px 30px rgba(0,0,0,0.45)'}} />
      <div style={{position: 'absolute', inset: 0, background: '#0E1626', opacity: dim}} />
    </div>
  );
};

const DIGIT_H = 300;
const Odometer: React.FC<{v: number; t: number}> = ({v, t}) => {
  // columns: thousands, hundreds, tens, ones
  const cols = [3, 2, 1, 0].map((k) => (v / Math.pow(10, k)) % 10);
  const thousandsVis = clamp((v - 940) / 60);
  const digit = (p: number, key: number, vis = 1) => (
    <div key={key} style={{position: 'relative', height: DIGIT_H, width: 0.74 * DIGIT_H, overflow: 'hidden', opacity: vis}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: -p * DIGIT_H, filter: key === 3 && v < 995 ? 'blur(2px)' : undefined}}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => (
          <div key={i} style={{height: DIGIT_H, lineHeight: `${DIGIT_H}px`, textAlign: 'center', ...foil}}>
            {d}
          </div>
        ))}
      </div>
    </div>
  );
  const foil: React.CSSProperties = {
    fontFamily: F.slab,
    fontSize: DIGIT_H * 0.92,
    backgroundImage: GOLD_FOIL,
    backgroundSize: '200% 100%',
    backgroundPosition: `${map(t, [41, 44], [0, 100])}% 0`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  };
  return (
    <div style={{display: 'flex', alignItems: 'flex-end', filter: 'drop-shadow(0 18px 40px rgba(0,0,0,0.5)) drop-shadow(0 0 40px rgba(224,163,59,0.25))'}}>
      {digit(Math.min(cols[0], 1), 0, thousandsVis)}
      <div style={{...foil, height: DIGIT_H, lineHeight: `${DIGIT_H}px`, width: 0.3 * DIGIT_H, textAlign: 'center', opacity: thousandsVis}}>,</div>
      {digit(cols[1], 1)}
      {digit(cols[2], 2)}
      {digit(cols[3], 3)}
    </div>
  );
};

export const S6Proof: React.FC = () => {
  const t = useT();
  const t0 = S.proof[0];
  const tLand = at(13, '1,000') + 0.3;
  const reveal = tw(t, t0 - 0.35, 0.55, EASE.inOut);
  const r = lerp(0, 2300, reveal);
  const roll = map(t, [w(13, 0) + 0.1, tLand], [0, 1], (x) => 1 - Math.pow(1 - x, 3));
  const v = roll * 1000;
  const plus = pop(t, tLand + 0.02);
  const landK = sp(t, tLand, {damping: 10, stiffness: 260});
  const sh = shake(t, tLand + 0.02, 0.4, 12);
  const push = lerp(1, 1.07, tw(t, t0, 6, EASE.outSoft));
  const exit = tw(t, S.proof[1] - 0.2, 0.5, EASE.in);
  return (
    <AbsoluteFill style={{clipPath: reveal < 1 ? `circle(${r}px at ${BUY_BTN.x}px ${BUY_BTN.y}px)` : undefined}}>
      <AbsoluteFill style={{transform: `translate(${sh.x}px, ${sh.y}px) scale(${push})`}}>
        <Set light={0.8} spotY={46} />
        <ShelfRow t={t} y={330} scale={0.6} speed={60} seed={1} blur={3} dim={0.55} />
        <ShelfRow t={t} y={560} scale={0.85} speed={130} seed={2} blur={1.2} dim={0.42} />
        <ShelfRow t={t} y={1130} scale={1.6} speed={320} seed={3} blur={4} dim={0.25} dropFrom={w(13, 0)} />
        <AbsoluteFill style={{background: 'radial-gradient(ellipse 46% 42% at 50% 48%, rgba(14,22,38,0.88) 0%, rgba(14,22,38,0.55) 55%, rgba(14,22,38,0) 85%)'}} />
        <Dust t={t} opacity={0.7} seed={21} />
        <LightLeak t={t} intensity={0.35 + 0.4 * tw(t, tLand, 0.5) * (1 - tw(t, tLand + 0.6, 1.5))} seed={6} />
      </AbsoluteFill>
      {/* "I've published over" */}
      <div style={{position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', fontFamily: F.inter, fontWeight: 700, fontSize: 50, color: C.muted, opacity: 1 - exit}}>
        <VOLine t={t} line={13} from={0} to={3} mode="rise" />
      </div>
      <div style={{position: 'absolute', top: 236, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: 1 - exit, transform: `scale(${(1 + (landK > 0 ? (1 - clamp(landK)) * 0.12 : 0)) * (1 + exit * 0.2)})`}}>
        <Odometer v={v} t={t} />
        <div
          style={{
            fontFamily: F.slab,
            fontSize: DIGIT_H * 0.92,
            lineHeight: `${DIGIT_H}px`,
            height: DIGIT_H,
            color: C.gold,
            transform: `scale(${plus})`,
            opacity: clamp(plus * 2),
            textShadow: '0 0 40px rgba(224,163,59,0.45)',
            marginLeft: 6,
          }}
        >
          +
        </div>
      </div>
      <div style={{position: 'absolute', top: 586, left: 0, right: 0, textAlign: 'center', fontFamily: F.inter, fontWeight: 800, fontSize: 56, letterSpacing: '0.04em', color: C.cream, opacity: 1 - exit}}>
        <Reveal t={t} t0={at(13, 'books') - 0.05}>books</Reveal> <Reveal t={t} t0={at(13, 'on') - 0.05}>on</Reveal>{' '}
        <Reveal t={t} t0={at(13, 'amazon') - 0.05} style={{color: C.gold}}>Amazon</Reveal> <Reveal t={t} t0={at(13, 'kdp') - 0.05} style={{color: C.gold}}>KDP</Reveal>
      </div>
      <div style={{position: 'absolute', top: 730, left: 0, right: 0, textAlign: 'center', fontFamily: F.slab, fontSize: 76, color: C.cream, opacity: 1 - exit, textShadow: '0 10px 30px rgba(0,0,0,0.5)'}}>
        <VOLine t={t} line={13} from={8} mode="blur" gold={[12]} />
      </div>

      {reveal > 0 && reveal < 1 && (
        <div
          style={{
            position: 'absolute',
            left: BUY_BTN.x - r,
            top: BUY_BTN.y - r,
            width: r * 2,
            height: r * 2,
            borderRadius: '50%',
            boxShadow: `0 0 0 6px ${C.gold}, 0 0 60px 20px rgba(224,163,59,0.45), inset 0 0 60px 10px rgba(224,163,59,0.35)`,
          }}
        />
      )}
      <Sfx at={t0 - 0.35} name="ripple" volume={0.5} />
      <Sfx at={w(13, 0) + 0.1} name="ticks_roll" volume={0.5} />
      <Sfx at={tLand - 0.01} name="impact_deep" volume={0.75} />
      <Sfx at={tLand + 0.02} name="shimmer" volume={0.35} />
      <Sfx at={at(13, 'and') - 0.05} name="whoosh_soft" volume={0.25} />
    </AbsoluteFill>
  );
};
