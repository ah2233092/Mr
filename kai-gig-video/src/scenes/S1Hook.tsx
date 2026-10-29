import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp, lerp, map, noise, pop, shake, sp, tw} from '../anim';
import {Book3D, FloorShadow} from '../components/Book3D';
import {ClothCover, ClothSpine} from '../components/Covers';
import {Reveal} from '../components/Kinetic';
import {Dust, Set} from '../components/Overlays';
import {useT} from '../components/Scene';
import {Sfx} from '../components/Sfx';
import {at, lineEnd, S, w} from '../timeline';
import {C, EASE, F, GOLD_FOIL} from '../theme';

const BW = 330;
const BH = 486;
const BD = 64;

const Sparkle: React.FC<{x: number; y: number; t: number; t0: number; size: number; rot?: number}> = ({x, y, t, t0, size, rot = 0}) => {
  const k = sp(t, t0, {damping: 9, stiffness: 160});
  const fade = 1 - tw(t, t0 + 0.35, 0.6);
  if (t < t0 || fade <= 0) return null;
  const s = size * k;
  return (
    <svg
      viewBox="-50 -50 100 100"
      width={s}
      height={s}
      style={{position: 'absolute', left: x - s / 2, top: y - s / 2, opacity: fade, transform: `rotate(${rot + (t - t0) * 60}deg)`, overflow: 'visible'}}
    >
      <circle r={18} fill="rgba(255,226,168,0.35)" />
      <path d="M0 -50 C4 -8 8 -4 50 0 C8 4 4 8 0 50 C-4 8 -8 4 -50 0 C-8 -4 -4 -8 0 -50Z" fill="#FFF4D8" />
      <circle r={6} fill="#fff" />
    </svg>
  );
};

export const S1Hook: React.FC = () => {
  const t = useT();
  const tPerfect = w(0, 4);
  const tNever = at(1, 'never');
  const tEnd = S.hook[1];

  // light dies on "never"
  const dark = tw(t, tNever - 0.05, 0.35, EASE.inOut);
  const light = lerp(1, 0.22, dark);
  // camera: slow push-in, snap on the hit, zoom-through at the end
  const push = lerp(1, 1.06, tw(t, 0, 3.0, EASE.outSoft));
  const snap = 0.05 * pop(t, tNever) * (1 - tw(t, tNever + 0.3, 0.6));
  const zoomOut = tw(t, tEnd - 0.28, 0.36, EASE.in);
  const camScale = (push + snap) * (1 + zoomOut * 5.5);
  const sh = shake(t, tNever, 0.5, 16);

  const rotY = lerp(34, 14, tw(t, 0, 3.6, EASE.outSoft)) + noise(t * 0.5, 2) * 1.5;
  const rotX = 6 + noise(t * 0.4, 5) * 1.2;
  const bob = Math.sin(t * 1.4) * 6;
  const sheen = map(t, [0, 2.2], [0.12, 1.3], EASE.inOut);
  const bookScale = lerp(1, 0.8, tw(t, lineEnd(0) + 0.2, 1.0, EASE.inOut));
  const flare = Math.exp(-Math.pow((sheen - 0.55) / 0.22, 2)) * light;

  const soldK = sp(t, tNever + 0.02, {damping: 11, stiffness: 240, mass: 0.9});
  const partA = 1 - tw(t, at(1, 'and') - 0.12, 0.25, EASE.in);
  const blurOut = zoomOut * 18;

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Set light={light} spotY={34} />
      {/* cold wash when the light dies */}
      <AbsoluteFill style={{background: 'rgba(14,22,38,0.55)', opacity: dark * 0.7}} />
      <AbsoluteFill
        style={{
          transform: `translate(${sh.x}px, ${sh.y}px) rotate(${sh.r}deg) scale(${camScale})`,
          transformOrigin: '50% 47%',
          filter: blurOut > 0.3 ? `blur(${blurOut}px)` : undefined,
        }}
      >
        {/* backlight halo + volumetric beam */}
        <div
          style={{
            position: 'absolute',
            left: 960 - 700,
            top: 500 - 560,
            width: 1400,
            height: 1120,
            opacity: 1.0 * light,
            background: 'radial-gradient(ellipse 34% 40% at 50% 50%, rgba(232,170,80,0.42) 0%, rgba(224,163,59,0.12) 38%, rgba(27,42,74,0) 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 960 - 460,
            top: -120,
            width: 920,
            height: 1000,
            opacity: 0.9 * light,
            mixBlendMode: 'screen',
            clipPath: 'polygon(40% 0, 60% 0, 88% 100%, 12% 100%)',
            background: 'linear-gradient(180deg, rgba(255,226,170,0.20) 0%, rgba(255,214,150,0.07) 60%, rgba(0,0,0,0) 100%)',
          }}
        />
        <Dust t={t} opacity={0.35 + 0.65 * light} />
        <FloorShadow w={BW} opacity={0.8} glow={0.9 * light} style={{left: 960 - BW * 1.1, top: 500 + BH * 0.5 * bookScale - BW * 0.2}} />
        {/* floor reflection */}
        <div
          style={{
            position: 'absolute',
            left: 960 - BW / 2,
            top: 500 + BH / 2 + 18 - bob,
            width: BW,
            height: BH,
            perspective: 1800,
            transform: `scale(${bookScale}) scaleY(-1)`,
            transformOrigin: '50% 0%',
            opacity: 0.16 * light,
            WebkitMaskImage: 'linear-gradient(0deg, rgba(0,0,0,0) 45%, rgba(0,0,0,1) 100%)',
            maskImage: 'linear-gradient(0deg, rgba(0,0,0,0) 45%, rgba(0,0,0,1) 100%)',
          }}
        >
          <Book3D w={BW} h={BH} d={BD} rotX={-rotX} rotY={rotY} front={<ClothCover w={BW} h={BH} />} spine={<ClothSpine d={BD} h={BH} />} light={light} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 960 - BW / 2,
            top: 500 - BH / 2 + bob,
            width: BW,
            height: BH,
            perspective: 1800,
            transform: `scale(${bookScale})`,
          }}
        >
          <Book3D
            w={BW}
            h={BH}
            d={BD}
            rotX={rotX}
            rotY={rotY}
            front={<ClothCover w={BW} h={BH} />}
            spine={<ClothSpine d={BD} h={BH} />}
            light={light}
            sheen={sheen}
            sheenStrength={0.8}
            rim={0.5 * light}
          />
        </div>
        {/* anamorphic flare riding the light sweep */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 500 - 120 + bob,
            height: 6,
            opacity: flare * 0.9,
            mixBlendMode: 'screen',
            background: 'linear-gradient(90deg, rgba(255,200,120,0) 10%, rgba(255,214,150,0.55) 40%, rgba(255,250,235,1) 50%, rgba(255,214,150,0.55) 60%, rgba(255,200,120,0) 90%)',
            boxShadow: '0 0 30px 8px rgba(255,200,120,0.25)',
            transform: `translateX(${(sheen - 0.55) * 300}px)`,
          }}
        />
        <Sparkle x={1128} y={268} t={t} t0={tPerfect + 0.05} size={150} />
        <Sparkle x={830} y={420} t={t} t0={tPerfect + 0.16} size={80} rot={20} />
        <Sparkle x={1060} y={660} t={t} t0={tPerfect + 0.26} size={56} rot={45} />

        {/* 0 SOLD tag slams onto the cover */}
        {t >= tNever && (
          <div
            style={{
              position: 'absolute',
              left: 960,
              top: 580,
              transform: `translate(-50%, -50%) rotate(-8deg) scale(${2.3 - 1.3 * soldK})`,
              opacity: clamp(soldK * 3),
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 16,
                padding: '10px 34px 16px',
                borderRadius: 18,
                background: 'rgba(20,8,12,0.88)',
                border: `5px solid ${C.red}`,
                boxShadow: `0 0 60px rgba(229,72,77,0.55), 0 20px 50px rgba(0,0,0,0.6), inset 0 0 24px rgba(229,72,77,0.35)`,
                fontFamily: F.slab,
                color: C.red,
                textShadow: '0 0 24px rgba(229,72,77,0.8)',
              }}
            >
              <span style={{fontSize: 118, lineHeight: 1}}>0</span>
              <span style={{fontSize: 64, letterSpacing: '0.06em'}}>SOLD</span>
            </div>
          </div>
        )}

        {/* Part A: "Your book could be / perfect…" */}
        {partA > 0 && (
          <>
            <div style={{position: 'absolute', top: 92, left: 0, right: 0, textAlign: 'center', opacity: partA}}>
              <span style={{fontFamily: F.inter, fontWeight: 700, fontSize: 62, color: C.cream, letterSpacing: '-0.01em'}}>
                {[0, 1, 2, 3].map((i) => (
                  <React.Fragment key={i}>
                    <Reveal t={t} t0={w(0, i) - 0.05} mode="rise">
                      {['Your', 'book', 'could', 'be'][i]}
                    </Reveal>{' '}
                  </React.Fragment>
                ))}
              </span>
            </div>
            <div style={{position: 'absolute', top: 776, left: 0, right: 0, textAlign: 'center', opacity: partA}}>
              <Reveal
                t={t}
                t0={tPerfect - 0.04}
                mode="letters"
                style={{
                  fontFamily: F.slab,
                  fontSize: 168,
                  lineHeight: 1.1,
                  backgroundImage: GOLD_FOIL,
                  backgroundSize: '220% 100%',
                  backgroundPosition: `${map(t, [tPerfect, tPerfect + 2], [100, 0])}% 0`,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  filter: 'drop-shadow(0 10px 30px rgba(224,163,59,0.35))',
                }}
              >
                perfect…
              </Reveal>
            </div>
          </>
        )}

        {/* Part B: "and still / NEVER SELL / A SINGLE COPY." */}
        {t > at(1, 'and') - 0.15 && (
          <>
            <div style={{position: 'absolute', top: 70, left: 0, right: 0, textAlign: 'center', fontFamily: F.inter, fontWeight: 600, fontSize: 46, color: C.muted}}>
              <Reveal t={t} t0={at(1, 'and') - 0.05}>and</Reveal> <Reveal t={t} t0={at(1, 'still') - 0.05}>still</Reveal>
            </div>
            <div style={{position: 'absolute', top: 128, left: 0, right: 0, textAlign: 'center', fontFamily: F.slab, fontSize: 124, color: C.cream, lineHeight: 1.1, letterSpacing: '-0.005em', textShadow: '0 12px 40px rgba(0,0,0,0.6)'}}>
              <Reveal t={t} t0={tNever - 0.03} mode="slam">NEVER</Reveal> <Reveal t={t} t0={at(1, 'sell') - 0.03} mode="slam">SELL</Reveal>
            </div>
            <div style={{position: 'absolute', top: 806, left: 0, right: 0, textAlign: 'center', fontFamily: F.slab, fontSize: 112, color: C.cream, lineHeight: 1.1, textShadow: '0 12px 40px rgba(0,0,0,0.6)'}}>
              <Reveal t={t} t0={w(1, 4) - 0.03} mode="slam">A</Reveal> <Reveal t={t} t0={at(1, 'single') - 0.03} mode="slam">SINGLE</Reveal>{' '}
              <Reveal t={t} t0={at(1, 'copy') - 0.03} mode="slam">COPY.</Reveal>
            </div>
          </>
        )}
      </AbsoluteFill>

      {/* sound */}
      <Sfx at={0} name="air_open" volume={0.5} />
      <Sfx at={tPerfect + 0.02} name="sparkle" volume={0.55} />
      <Sfx at={tNever - 0.01} name="impact_deep" volume={0.95} />
      <Sfx at={tNever + 0.03} name="light_off" volume={0.4} />
      <Sfx at={at(1, 'single') - 0.02} name="tick_low" volume={0.25} />
      <Sfx at={tEnd - 0.3} name="whoosh_in" volume={0.55} />
    </AbsoluteFill>
  );
};
