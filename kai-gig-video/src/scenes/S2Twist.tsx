import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp, lerp, map, noise, pop, sp, tw} from '../anim';
import {Book3D, FloorShadow} from '../components/Book3D';
import {ClothCover, ClothSpine, DullCover} from '../components/Covers';
import {Check} from '../components/Icons';
import {VOLine} from '../components/Kinetic';
import {Dust, LightLeak, Set} from '../components/Overlays';
import {useT} from '../components/Scene';
import {Sfx} from '../components/Sfx';
import {at, lineStart, S, w} from '../timeline';
import {C, EASE, F} from '../theme';

const MANUSCRIPT = [
  'The orchard had been quiet for eleven',
  'winters. Mara walked the rows at dusk,',
  'counting the trees her grandfather had',
  'planted, as if the numbers might change.',
  '',
  'They never did. But tonight, beneath the',
  'oldest tree, the ground was freshly turned.',
];
const TOTAL_CHARS = MANUSCRIPT.join('').length;

const Manuscript: React.FC<{t: number; t0: number; t1: number; checkAt: number}> = ({t, t0, t1, checkAt}) => {
  const n = Math.floor(map(t, [t0, t1], [0, TOTAL_CHARS]));
  let left = n;
  const caretOn = Math.floor(t * 2.2) % 2 === 0;
  const ck = sp(t, checkAt, {damping: 12, stiffness: 170});
  return (
    <div
      style={{
        position: 'relative',
        width: 1000,
        height: 640,
        borderRadius: 6,
        background: `radial-gradient(ellipse at 30% 20%, #FFFDF6, ${C.paper} 60%, #EFE4CC)`,
        boxShadow: '0 50px 100px rgba(3,6,12,0.6), 0 10px 30px rgba(3,6,12,0.35)',
        padding: '70px 90px',
        fontFamily: F.mono,
        fontSize: 31,
        lineHeight: 1.62,
        color: '#2A2E38',
      }}
    >
      <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 24, letterSpacing: '0.24em', color: 'rgba(27,42,74,0.55)', marginBottom: 22}}>CHAPTER ONE</div>
      {MANUSCRIPT.map((line, i) => {
        const show = Math.max(0, Math.min(line.length, left));
        left -= line.length;
        const typing = show > 0 && show < line.length;
        return (
          <div key={i} style={{height: '1.62em', whiteSpace: 'pre'}}>
            {line.slice(0, show)}
            {(typing || (show === line.length && left <= 0 && left > -40 && i === MANUSCRIPT.length - 1)) && caretOn && (
              <span style={{display: 'inline-block', width: 3, height: '1.05em', background: C.gold, verticalAlign: '-0.15em', marginLeft: 2}} />
            )}
          </div>
        );
      })}
      {/* gold approval mark in the margin */}
      <div
        style={{
          position: 'absolute',
          right: -70,
          top: -70,
          width: 190,
          height: 190,
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, #2D4475, ${C.navy})`,
          boxShadow: `0 20px 50px rgba(3,6,12,0.5), 0 0 0 6px ${C.gold}, 0 0 70px rgba(224,163,59,${0.45 * clamp(ck)})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${ck}) rotate(${(1 - ck) * -40}deg)`,
          opacity: clamp(ck * 2),
        }}
      >
        <Check size={120} draw={tw(t, checkAt + 0.05, 0.35)} color={C.gold} stroke={8} />
      </div>
    </div>
  );
};

type OrbitItem = {kind: 'margin' | 'cover' | 'search' | 'upload' | 'keywords' | 'isbn' | 'price' | 'formats'; phase: number; y: number; r: number};
const ORBIT: OrbitItem[] = [
  {kind: 'margin', phase: 0.0, y: -40, r: 1},
  {kind: 'search', phase: 0.78, y: 120, r: 1.05},
  {kind: 'cover', phase: 1.57, y: -90, r: 0.95},
  {kind: 'keywords', phase: 2.36, y: 90, r: 1.1},
  {kind: 'upload', phase: 3.14, y: -60, r: 1},
  {kind: 'isbn', phase: 3.93, y: 130, r: 0.95},
  {kind: 'price', phase: 4.71, y: -130, r: 1.08},
  {kind: 'formats', phase: 5.5, y: 60, r: 1},
];

const card = (w: number, h: number, children: React.ReactNode, extra: React.CSSProperties = {}) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: 18,
      background: 'linear-gradient(160deg, rgba(48,68,112,0.95), rgba(24,37,64,0.95))',
      boxShadow: '0 24px 50px rgba(3,6,12,0.5), inset 0 0 0 1.5px rgba(246,236,218,0.12)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      ...extra,
    }}
  >
    {children}
  </div>
);

const OrbitCard: React.FC<{kind: OrbitItem['kind']}> = ({kind}) => {
  const label = (s: string) => <div style={{fontFamily: F.inter, fontWeight: 700, fontSize: 20, color: C.muted, letterSpacing: '0.08em'}}>{s}</div>;
  switch (kind) {
    case 'margin':
      return card(
        170,
        220,
        <div style={{position: 'relative', width: 120, height: 170, background: C.paper, borderRadius: 4}}>
          {Array.from({length: 9}).map((_, i) => (
            <div key={i} style={{position: 'absolute', left: 18, right: i % 4 === 3 ? 50 : 18, top: 22 + i * 15, height: 6, borderRadius: 2, background: 'rgba(27,42,74,0.5)'}} />
          ))}
          <div style={{position: 'absolute', top: 6, bottom: 6, left: 12, borderLeft: `2px dashed ${C.gold}`}} />
          <div style={{position: 'absolute', top: 6, bottom: 6, right: 12, borderLeft: `2px dashed ${C.gold}`}} />
        </div>,
      );
    case 'cover':
      return card(170, 230, <div style={{borderRadius: 4, overflow: 'hidden'}}><DullCover w={124} h={186} /></div>);
    case 'search':
      return card(
        330,
        84,
        <div style={{display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '0 24px'}}>
          <svg width={30} height={30} viewBox="0 0 24 24"><circle cx={10} cy={10} r={7} stroke={C.gold} strokeWidth={2.6} fill="none" /><path d="M15 15 L21 21" stroke={C.gold} strokeWidth={2.6} strokeLinecap="round" /></svg>
          <div style={{fontFamily: F.inter, fontWeight: 600, fontSize: 24, color: C.cream}}>mystery novel</div>
        </div>,
        {borderRadius: 42},
      );
    case 'upload':
      return card(
        260,
        130,
        <div style={{width: '100%', padding: '0 24px'}}>
          {label('UPLOAD')}
          <div style={{marginTop: 14, height: 12, borderRadius: 6, background: 'rgba(246,236,218,0.15)'}}>
            <div style={{width: '62%', height: '100%', borderRadius: 6, background: C.gold}} />
          </div>
          <div style={{marginTop: 10, fontFamily: F.inter, fontSize: 18, color: C.muted}}>manuscript.docx</div>
        </div>,
      );
    case 'keywords':
      return card(
        300,
        96,
        <div style={{display: 'flex', gap: 10}}>
          {['thriller', 'small town', 'secrets'].map((k) => (
            <div key={k} style={{padding: '8px 14px', borderRadius: 999, background: 'rgba(224,163,59,0.16)', border: `1.5px solid ${C.gold}`, fontFamily: F.inter, fontWeight: 600, fontSize: 18, color: C.cream}}>
              {k}
            </div>
          ))}
        </div>,
      );
    case 'isbn':
      return card(
        200,
        120,
        <div style={{background: '#fff', padding: '10px 14px', borderRadius: 6}}>
          <div style={{display: 'flex', gap: 2, height: 54}}>
            {Array.from({length: 30}).map((_, i) => (
              <div key={i} style={{width: [1, 3, 2, 1, 2][i % 5], background: '#111'}} />
            ))}
          </div>
          <div style={{fontFamily: F.mono, fontSize: 13, color: '#111', textAlign: 'center', marginTop: 4}}>ISBN 978-0-00-000000-0</div>
        </div>,
      );
    case 'price':
      return card(150, 90, <div style={{fontFamily: F.slab, fontSize: 40, color: C.gold}}>$14.99</div>, {borderRadius: 45});
    case 'formats':
      return card(
        250,
        110,
        <div style={{display: 'flex', gap: 14}}>
          {['eBook', 'Print'].map((k) => (
            <div key={k} style={{padding: '10px 16px', borderRadius: 10, border: '1.5px solid rgba(246,236,218,0.35)', fontFamily: F.inter, fontWeight: 700, fontSize: 20, color: C.cream}}>
              {k}
            </div>
          ))}
        </div>,
      );
  }
};

export const S2Twist: React.FC = () => {
  const t = useT();
  const t0 = S.twist[0];
  const tWriting = at(2, 'writing');
  const tEvery = at(3, 'everything');
  const tOut = S.twist[1];

  // entrance: continuation of the zoom-through from the hook
  const enter = tw(t, t0 - 0.12, 0.42, EASE.out);
  const enterScale = lerp(1.6, 1, enter);
  const enterBlur = (1 - enter) * 14;

  // pull back on "everything"
  const pull = tw(t, tEvery - 0.22, 0.75, EASE.inOut);
  const pageScale = lerp(1, 0.2, pull);
  const pageOpacity = 1 - tw(t, tEvery + 0.18, 0.2);
  const bookIn = tw(t, tEvery + 0.1, 0.4, EASE.out);
  const orbitK = tw(t, tEvery - 0.05, 0.9, EASE.out);
  // whip pan out to the left
  const whip = tw(t, tOut - 0.12, 0.3, EASE.in);
  const whipBlur = whip * 40;

  const drift = noise(t * 0.4, 3);
  const orbitAngle = (t - tEvery) * 0.55;

  const items = ORBIT.map((it, i) => {
    const a = it.phase + orbitAngle;
    const z = Math.sin(a);
    const radius = lerp(80, 720, orbitK) * it.r;
    return {
      it,
      i,
      z,
      x: 960 + Math.cos(a) * radius,
      y: 540 + z * 110 * orbitK + it.y * 1.5 * orbitK,
      s: (0.78 + 0.5 * (z + 1) / 2) * lerp(0.2, 1, orbitK),
    };
  });
  const behind = items.filter((x) => x.z < 0).sort((a, b) => a.z - b.z);
  const front = items.filter((x) => x.z >= 0).sort((a, b) => a.z - b.z);
  const renderItem = (x: (typeof items)[number]) => (
    <div
      key={x.i}
      style={{
        position: 'absolute',
        left: x.x,
        top: x.y,
        transform: `translate(-50%, -50%) scale(${x.s}) rotate(${noise(t * 0.6, x.i) * 6}deg)`,
        opacity: clamp(orbitK * 1.6) * (x.z < 0 ? 0.55 + 0.45 * (1 + x.z) : 1),
        filter: x.z < -0.35 ? `blur(${(-x.z - 0.35) * 5}px)` : undefined,
      }}
    >
      <OrbitCard kind={x.it.kind} />
    </div>
  );

  const BW = 270, BH = 398, BD = 52;

  return (
    <AbsoluteFill style={{overflow: 'hidden', opacity: clamp(enter * 2)}}>
      <AbsoluteFill
        style={{
          transform: `translateX(${-whip * 1400}px) scale(${enterScale})`,
          filter: enterBlur + whipBlur > 0.5 ? `blur(${enterBlur + whipBlur}px)` : undefined,
        }}
      >
        <Set light={0.85} spotX={42} spotY={30} warm={1 - pull} />
        <LightLeak t={t} intensity={0.5 * (1 - pull)} seed={2} />
        <Dust t={t} opacity={0.6} seed={4} />

        {/* orbiting elements behind the book */}
        {pull > 0 && behind.map(renderItem)}

        {/* the book the page becomes */}
        {bookIn > 0 && (
          <>
            <FloorShadow w={BW} opacity={0.6 * bookIn} style={{left: 960 - BW * 1.1, top: 540 + BH / 2 - BW * 0.22}} />
            <div style={{position: 'absolute', left: 960 - BW / 2, top: 540 - BH / 2, perspective: 1600, opacity: bookIn, transform: `scale(${lerp(0.8, 1, bookIn)})`}}>
              <Book3D w={BW} h={BH} d={BD} rotY={-18 + Math.sin(t * 0.8) * 6} rotX={6} lightDir={[-0.3, -0.5, 1]} front={<ClothCover w={BW} h={BH} />} spine={<ClothSpine d={BD} h={BH} />} rim={0.6} />
            </div>
          </>
        )}

        {/* manuscript close-up (pulls back into the book) */}
        {pageOpacity > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 960 - 500 + 80 * (1 - pull),
              top: 540 - 320 - 10,
              perspective: 2200,
              opacity: pageOpacity,
              transform: `scale(${pageScale})`,
            }}
          >
            <div style={{transform: `rotateX(${lerp(14, 0, pull)}deg) rotateY(${lerp(-8 + drift * 2, 0, pull)}deg) rotateZ(${lerp(-1.5, 0, pull)}deg)`}}>
              <Manuscript t={t} t0={t0 - 0.1} t1={lineStart(3) + 0.2} checkAt={tWriting + 0.02} />
            </div>
          </div>
        )}

        {pull > 0 && front.map(renderItem)}

        {/* "everything around it." as kinetic type */}
        <div style={{position: 'absolute', top: 70, left: 0, right: 0, textAlign: 'center', fontFamily: F.slab, fontSize: 96, color: C.cream, textShadow: '0 10px 30px rgba(0,0,0,0.5)'}}>
          <VOLine t={t} line={3} mode="blur" gold={[2]} wordStyle={(i) => (i < 2 ? {fontFamily: F.inter, fontWeight: 700, fontSize: 60, color: C.muted} : undefined)} />
        </div>
      </AbsoluteFill>

      <Sfx at={w(2, 0) - 0.05} name="typing" volume={0.35} />
      <Sfx at={tWriting + 0.02} name="pop_soft" volume={0.5} />
      <Sfx at={tEvery - 0.22} name="whoosh_pull" volume={0.6} />
      <Sfx at={tEvery - 0.1} name="riser_short" volume={0.32} />
      <Sfx at={tOut - 0.14} name="whip" volume={0.6} />
    </AbsoluteFill>
  );
};
