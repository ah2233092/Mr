import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp, lerp, map, noise, pop, shake, sp, tw} from '../anim';
import {Book3D} from '../components/Book3D';
import {DullCover, FlatBook, GenericCover, PremiumCover, PremiumSpine} from '../components/Covers';
import {Check, Cursor, IconMedallion, SERVICES, ServiceKey} from '../components/Icons';
import {Dust, Set} from '../components/Overlays';
import {useT} from '../components/Scene';
import {Sfx} from '../components/Sfx';
import {Badge, PageText, Stamp, Window} from '../components/UI';
import {BUY_BTN, PANEL, ROW, rowX} from '../layout';
import {at, S} from '../timeline';
import {C, EASE, F} from '../theme';

const ORDER: ServiceKey[] = ['publish', 'format', 'cover', 'keywords', 'aplus'];
const RANGE = (k: ServiceKey) => S[k] as readonly [number, number];

// ------------------------------------------------------------------ left panel
const Panel: React.FC<{t: number}> = ({t}) => {
  const idx = Math.max(0, ORDER.findIndex((k) => t < RANGE(k)[1] - 0.05));
  const cur = idx < 0 ? 4 : idx;
  const start = RANGE(ORDER[cur])[0];
  const swapIn = sp(t, start + 0.02, {damping: 16, stiffness: 160});
  const end = RANGE(ORDER[cur])[1];
  const swapOut = cur < 4 ? tw(t, end - 0.2, 0.18, EASE.in) : tw(t, end - 0.15, 0.3, EASE.in);
  const s = SERVICES[cur];
  // first service: medallion flies in from the Scene 4 row
  const fly = tw(t, S.publish[0] - 0.12, 0.6, EASE.inOut);
  const firstFly = cur === 0 && t < S.publish[0] + 0.5;
  const mx = firstFly ? lerp(rowX(0) - ROW.size / 2, PANEL.x, fly) : PANEL.x;
  const my = firstFly ? lerp(ROW.y - ROW.size / 2, PANEL.iconY, fly) : PANEL.iconY;
  const flip = cur === 0 && firstFly ? 0 : (1 - clamp(swapIn)) * 90 + swapOut * -90;
  const titleSize = s.key === 'aplus' ? 90 : 104;
  const leaveAll = tw(t, S.aplus[1] - 0.15, 0.35, EASE.in);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: 1 - leaveAll}}>
      {/* progress */}
      <div style={{position: 'absolute', left: PANEL.x, top: PANEL.progY, display: 'flex', alignItems: 'center', gap: 18, opacity: tw(t, S.publish[0] + 0.2, 0.4)}}>
        <div style={{fontFamily: F.slab, fontSize: 34, color: C.gold, width: 112}}>
          0{cur + 1}
          <span style={{color: C.muted, fontSize: 24}}> / 05</span>
        </div>
        <div style={{display: 'flex', gap: 10}}>
          {ORDER.map((k, i) => {
            const fill = i < cur ? 1 : i === cur ? tw(t, RANGE(k)[0], 0.5) : 0;
            return (
              <div key={k} style={{width: 54, height: 7, borderRadius: 4, background: 'rgba(246,236,218,0.16)', overflow: 'hidden'}}>
                <div style={{width: `${fill * 100}%`, height: '100%', background: C.gold, borderRadius: 4}} />
              </div>
            );
          })}
        </div>
      </div>
      {/* medallion */}
      <div style={{position: 'absolute', left: mx, top: my, perspective: 800}}>
        <div style={{transform: `rotateY(${flip}deg) scale(${firstFly ? lerp(1, PANEL.iconSize / ROW.size, fly) : 1})`, opacity: Math.abs(flip) > 88 ? 0 : 1}}>
          <IconMedallion k={s.key} size={PANEL.iconSize} draw={cur === 0 ? 1 : tw(t, start + 0.05, 0.6)} glow={0.5} />
        </div>
      </div>
      {/* title */}
      <div style={{position: 'absolute', left: PANEL.x - 4, top: PANEL.titleY, overflow: 'hidden', paddingBottom: 12}}>
        <div
          style={{
            fontFamily: F.slab,
            fontSize: titleSize,
            lineHeight: 1.08,
            color: C.cream,
            letterSpacing: '-0.01em',
            transform: `translateY(${(1 - clamp(sp(t, start + 0.1, {damping: 16, stiffness: 150}))) * 110 + swapOut * -110}%)`,
            whiteSpace: 'nowrap',
          }}
        >
          {s.label}
        </div>
      </div>
      <div style={{position: 'absolute', left: PANEL.x, top: PANEL.subY, width: 46, height: 4, borderRadius: 2, background: C.gold, transform: `scaleX(${tw(t, start + 0.25, 0.4) * (1 - swapOut)})`, transformOrigin: '0 50%'}} />
      <div style={{position: 'absolute', left: PANEL.x, top: PANEL.subY + 24, overflow: 'hidden', width: 600}}>
        <div style={{fontFamily: F.inter, fontWeight: 600, fontSize: 32, color: C.muted, transform: `translateY(${(1 - clamp(sp(t, start + 0.22, {damping: 18, stiffness: 150}))) * 110 + swapOut * -110}%)`}}>
          {s.sub}
        </div>
      </div>
    </div>
  );
};

// shared stage wrapper: subtle 3D tilt + drift + per-service enter/exit
const Stage: React.FC<{t: number; k: ServiceKey; enter: (e: number) => React.CSSProperties; exit: (x: number) => React.CSSProperties; children: React.ReactNode; tilt?: number}> = ({
  t,
  k,
  enter,
  exit,
  children,
  tilt = 1,
}) => {
  const [a, b] = RANGE(k);
  if (t < a - 0.35 || t > b + 0.45) return null;
  const e = tw(t, a - 0.12, 0.5, EASE.out);
  const x = tw(t, b - 0.12, 0.32, EASE.in);
  const ry = (-7 + noise(t * 0.35, ORDER.indexOf(k)) * 2.5) * tilt;
  const rx = (3 + noise(t * 0.3, ORDER.indexOf(k) + 4) * 1.5) * tilt;
  return (
    <AbsoluteFill style={{perspective: 2200, ...(x > 0 ? exit(x) : enter(e))}}>
      <AbsoluteFill style={{transform: `rotateY(${ry}deg) rotateX(${rx}deg)`, transformOrigin: '1270px 500px'}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 1. publish
const FormatGlyph: React.FC<{kind: number}> = ({kind}) => (
  <svg viewBox="0 0 64 64" width={70} height={70}>
    <g fill="none" stroke={C.navy} strokeWidth={3.2} strokeLinejoin="round" strokeLinecap="round">
      {kind === 0 && (
        <>
          <rect x={16} y={6} width={32} height={52} rx={5} />
          <path d="M22 16 H42 M22 24 H42 M22 32 H36" />
          <circle cx={32} cy={50} r={2} fill={C.navy} />
        </>
      )}
      {kind === 1 && (
        <>
          <path d="M14 10 H44 C46 10 48 12 48 14 V54 H18 C16 54 14 52 14 50 Z" />
          <path d="M20 10 V54" />
        </>
      )}
      {kind === 2 && (
        <>
          <path d="M12 8 H46 C49 8 52 11 52 14 V56 H18 C15 56 12 53 12 50 Z" strokeWidth={4.5} />
          <path d="M19 8 V56" strokeWidth={4.5} />
          <path d="M26 22 H44" />
        </>
      )}
    </g>
  </svg>
);

const Publish: React.FC<{t: number}> = ({t}) => {
  const [a] = RANGE('publish');
  const up = map(t, [a + 0.5, at(8, 'kdp') + 0.1], [0, 1], EASE.inOut);
  const cardsT = [at(8, 'kindle'), at(8, 'paperback'), at(8, 'hardcover')];
  const tLive = at(8, 'hardcover') + 0.36;
  const live = pop(t, tLive);
  const labels = ['Kindle eBook', 'Paperback', 'Hardcover'];
  return (
    <div style={{position: 'absolute', left: 750, top: 150}}>
      <Window w={1050} h={690} title="Publisher Studio">
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 200, background: C.navy, padding: '28px 24px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 34}}>
            <div style={{width: 26, height: 26, borderRadius: 8, background: C.gold}} />
            <div style={{fontFamily: F.inter, fontWeight: 800, fontSize: 20, color: C.cream}}>Studio</div>
          </div>
          {['Dashboard', 'My titles', 'Reports', 'Settings'].map((n, i) => (
            <div key={n} style={{fontFamily: F.inter, fontWeight: 600, fontSize: 19, color: i === 1 ? C.gold : C.muted, padding: '12px 0', borderLeft: i === 1 ? `3px solid ${C.gold}` : '3px solid transparent', paddingLeft: 12, marginLeft: -15}}>
              {n}
            </div>
          ))}
        </div>
        <div style={{position: 'absolute', left: 236, top: 28, right: 36}}>
          <div style={{display: 'flex', gap: 22, alignItems: 'center'}}>
            <FlatBook w={84} h={126}>
              <PremiumCover w={84} h={126} />
            </FlatBook>
            <div>
              <div style={{fontFamily: F.inter, fontWeight: 800, fontSize: 34, color: C.navy}}>The Last Orchard</div>
              <div style={{fontFamily: F.inter, fontWeight: 500, fontSize: 21, color: 'rgba(27,42,74,0.6)', marginTop: 6}}>Elena Marsh · Mystery · 312 pages</div>
            </div>
          </div>
          {/* upload */}
          <div style={{marginTop: 28, padding: '20px 24px', borderRadius: 16, background: '#fff', boxShadow: '0 4px 14px rgba(27,42,74,0.08)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: F.inter, fontWeight: 600, fontSize: 21, color: C.navy}}>
              <span>the-last-orchard.docx</span>
              <span style={{color: up >= 1 ? C.navy : 'rgba(27,42,74,0.55)'}}>{up >= 1 ? 'Uploaded ✓' : `${Math.round(up * 100)}%`}</span>
            </div>
            <div style={{marginTop: 14, height: 12, borderRadius: 6, background: 'rgba(27,42,74,0.1)', overflow: 'hidden'}}>
              <div style={{width: `${up * 100}%`, height: '100%', borderRadius: 6, background: `linear-gradient(90deg, ${C.gold}, ${C.goldHi})`}} />
            </div>
          </div>
          <div style={{marginTop: 26, fontFamily: F.inter, fontWeight: 700, fontSize: 20, letterSpacing: '0.12em', color: 'rgba(27,42,74,0.55)'}}>FORMATS</div>
          <div style={{marginTop: 14, display: 'flex', gap: 22, perspective: 900}}>
            {labels.map((l, i) => {
              const k = sp(t, cardsT[i] - 0.06, {damping: 13, stiffness: 150});
              return (
                <div
                  key={l}
                  style={{
                    width: 248,
                    height: 236,
                    borderRadius: 16,
                    background: '#fff',
                    boxShadow: '0 10px 26px rgba(27,42,74,0.12)',
                    transform: `rotateY(${(1 - k) * 95}deg)`,
                    opacity: k > 0.02 ? 1 : 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <FormatGlyph kind={i} />
                  <div style={{fontFamily: F.inter, fontWeight: 800, fontSize: 23, color: C.navy}}>{l}</div>
                  <div style={{display: 'flex', alignItems: 'center', gap: 8, fontFamily: F.inter, fontWeight: 700, fontSize: 17, color: live > 0.5 ? C.green : 'rgba(27,42,74,0.5)'}}>
                    <div style={{width: 10, height: 10, borderRadius: 5, background: live > 0.5 ? C.green : C.gold}} />
                    {live > 0.5 ? 'Live' : 'Ready'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Window>
      <div style={{position: 'absolute', right: -56, top: 40}}>
        {live > 0 && (
          <div style={{position: 'absolute', inset: -10 - tw(t, tLive, 0.8) * 40, borderRadius: 999, border: `3px solid ${C.green}`, opacity: 1 - tw(t, tLive, 0.8)}} />
        )}
        <Badge text="LIVE" color={C.green} k={live} size={54} icon="dot" />
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ 2. format (match-cut from the red page)
const Format: React.FC<{t: number}> = ({t}) => {
  const tFormat = at(9, 'format');
  const tApproves = at(9, 'approves');
  const snap = tw(t, tFormat + 0.05, 1.1, EASE.inOut);
  const lift = tw(t, tFormat + 0.15, 0.45, EASE.in);
  const appr = sp(t, tApproves - 0.03, {damping: 12, stiffness: 320, mass: 0.8});
  const sh = shake(t, tApproves + 0.02, 0.3, 7);
  const ok = sp(t, at(9, 'not') - 0.05, {damping: 16, stiffness: 180});
  return (
    <div style={{position: 'absolute', left: 1270 - 290 + sh.x, top: 104 + sh.y}}>
      <div
        style={{
          position: 'relative',
          width: 580,
          height: 740,
          background: `radial-gradient(ellipse at 30% 20%, #FFFDF6, ${C.paper} 60%, #EADFC6)`,
          borderRadius: 6,
          boxShadow: '0 50px 100px rgba(3,6,12,0.6), 0 12px 30px rgba(3,6,12,0.35)',
        }}
      >
        <div style={{position: 'absolute', top: 34, left: 0, right: 0, textAlign: 'center', fontFamily: F.serif, fontSize: 15, letterSpacing: '0.3em', color: 'rgba(27,42,74,0.45)'}}>THE LAST ORCHARD</div>
        <div style={{position: 'absolute', left: 72, top: 96}}>
          <PageText lines={16} width={436} snap={snap} seed={3} red={1 - snap} lineH={34} />
        </div>
        <div style={{position: 'absolute', bottom: 30, left: 0, right: 0, textAlign: 'center', fontFamily: F.serif, fontSize: 17, color: 'rgba(27,42,74,0.5)'}}>47</div>
        {/* guides: red dashed → fine gold */}
        {[72, 508].map((x) => (
          <React.Fragment key={x}>
            <div style={{position: 'absolute', left: x, top: 18, bottom: 18, borderLeft: `3px dashed ${C.red}`, opacity: 1 - snap}} />
            <div style={{position: 'absolute', left: x, top: 18, bottom: 18, borderLeft: `2px solid ${C.gold}`, opacity: snap * 0.75}} />
          </React.Fragment>
        ))}
        {[90, 650].map((y) => (
          <React.Fragment key={y}>
            <div style={{position: 'absolute', top: y, left: 18, right: 18, borderTop: `3px dashed ${C.red}`, opacity: (1 - snap) * 0.8}} />
            <div style={{position: 'absolute', top: y, left: 18, right: 18, borderTop: `2px solid ${C.gold}`, opacity: snap * 0.6}} />
          </React.Fragment>
        ))}
        {/* the old stamp lifts away */}
        {lift < 1 && (
          <div style={{position: 'absolute', left: 290, top: 300, transform: `translate(-50%, -50%) translateY(${lift * -120}px) scale(${1 + lift * 0.3})`, opacity: 1 - lift}}>
            <Stamp id="sent3" text="SENT BACK" color={C.red} k={1} rot={-14} size={80} />
          </div>
        )}
        {appr > 0 && (
          <div style={{position: 'absolute', left: 290, top: 330, transform: 'translate(-50%, -50%)'}}>
            <Stamp id="ok" text="APPROVED" color={C.green} k={appr} rot={-8} size={78} icon />
          </div>
        )}
      </div>
      <div style={{position: 'absolute', left: 290, top: 700, transform: `translate(-50%, 0) scale(${ok})`, opacity: clamp(ok * 2)}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '14px 26px', borderRadius: 999, background: '#fff', boxShadow: '0 16px 40px rgba(3,6,12,0.35)', fontFamily: F.inter, fontWeight: 700, fontSize: 24, color: C.navy, whiteSpace: 'nowrap'}}>
          <Check size={30} color={C.green} stroke={8} />
          Print preview · 0 issues
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ 3. cover
const FEED = [2, 5, 0, 7, 4, 1, -1, 6, 3];
const Cover: React.FC<{t: number}> = ({t}) => {
  const tDesign = at(10, 'design');
  const tStop = at(10, 'stop');
  const tScroll = at(10, 'scrolling');
  const reveal = tw(t, tDesign + 0.02, 0.55, EASE.inOut);
  const spin = sp(t, tDesign + 0.6, {damping: 14, stiffness: 60, mass: 1});
  const rotY = lerp(0, 30, clamp(spin, 0, 1.3)) + Math.sin(t * 0.9) * 3;
  const BW = 300, BH = 450, BD = 52;
  const phoneIn = sp(t, tStop - 0.6, {damping: 16, stiffness: 120});
  // feed decelerates and stops on our cover
  const itemH = 330;
  const target = 6 * itemH;
  const settle = sp(t, tStop - 0.45, {damping: 15, stiffness: 55, mass: 1});
  const offset = lerp(-900, target, settle);
  const stopped = t > tScroll;
  const ring = tw(t, tScroll + 0.05, 0.3);
  const edgeX = lerp(-0.3, 1.3, reveal);
  return (
    <>
      <div style={{position: 'absolute', left: 1080 - BW / 2, top: 470 - BH / 2, perspective: 1600, transform: `translateX(${-phoneIn * 90}px)`}}>
        <Book3D
          w={BW}
          h={BH}
          d={BD}
          rotY={rotY}
          rotX={4}
          front={
            <div style={{position: 'relative', width: BW, height: BH}}>
              <DullCover w={BW} h={BH} style={{position: 'absolute', inset: 0}} />
              <div style={{position: 'absolute', inset: 0, clipPath: `polygon(0 0, ${edgeX * 100 + 30}% 0, ${edgeX * 100 - 30}% 100%, 0 100%)`}}>
                <PremiumCover w={BW} h={BH} />
              </div>
              {reveal > 0 && reveal < 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: -40,
                    bottom: -40,
                    left: `${edgeX * 100 - 2}%`,
                    width: 26,
                    transform: 'skewX(-33deg)',
                    background: 'linear-gradient(90deg, rgba(255,226,170,0), rgba(255,240,210,1), rgba(255,226,170,0))',
                    boxShadow: '0 0 40px 14px rgba(224,163,59,0.6)',
                  }}
                />
              )}
            </div>
          }
          spine={<PremiumSpine d={BD} h={BH} />}
          sheen={map(t, [tDesign + 0.6, tDesign + 1.6], [0, 1.3])}
          rim={0.6}
        />
      </div>
      {/* phone feed */}
      <div style={{position: 'absolute', left: 1450, top: 140, transform: `translateX(${(1 - phoneIn) * 700}px) rotate(${(1 - phoneIn) * 8}deg)`, opacity: clamp(phoneIn * 2)}}>
        <div style={{position: 'relative', width: 340, height: 690, borderRadius: 48, background: '#0B1222', padding: 14, boxShadow: '0 40px 80px rgba(3,6,12,0.6), inset 0 0 0 2px rgba(255,255,255,0.12)'}}>
          <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: 36, overflow: 'hidden', background: C.paper}}>
            <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 64, background: '#F1E8D6', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.inter, fontWeight: 800, fontSize: 20, color: C.navy}}>
              New releases
            </div>
            <div style={{position: 'absolute', left: 0, right: 0, top: 64 + 280 / 2 - 165 + 60 - offset + 140}}>
              {FEED.map((g, i) => (
                <div key={i} style={{height: itemH, display: 'flex', alignItems: 'center', justifyContent: 'center', filter: !stopped && Math.abs(i * itemH - offset) > 10 ? 'blur(1.5px)' : undefined}}>
                  <div style={{position: 'relative'}}>
                    <FlatBook w={190} h={285}>
                      {g < 0 ? <PremiumCover w={190} h={285} /> : <GenericCover w={190} h={285} i={g} />}
                    </FlatBook>
                    {g < 0 && <div style={{position: 'absolute', inset: -10, borderRadius: 10, boxShadow: `0 0 0 5px ${C.gold}, 0 0 50px rgba(224,163,59,0.6)`, opacity: ring}} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ------------------------------------------------------------------ 4. keywords
const QUERY = 'cozy small town mystery';
const CHIPS = ['cozy mystery', 'small town', 'amateur sleuth', 'book club pick'];
const Keywords: React.FC<{t: number}> = ({t}) => {
  const [a] = RANGE('keywords');
  const typed = Math.floor(map(t, [a + 0.3, at(11, 'keywords') + 0.5], [0, QUERY.length]));
  const caret = Math.floor(t * 2.4) % 2 === 0;
  const tHelp = at(11, 'help');
  const fly = tw(t, tHelp + 0.15, 0.6, EASE.inOut);
  const land = sp(t, tHelp + 0.72, {damping: 11, stiffness: 220});
  const page = Math.max(1, Math.round(lerp(50, 1, map(t, [tHelp - 0.1, tHelp + 0.75], [0, 1], EASE.inOut))));
  const p1 = pop(t, at(11, 'find', 1) - 0.05);
  const CW = 150, CH = 225, GX = 30;
  const slot0 = {x: 40, y: 200};
  return (
    <div style={{position: 'absolute', left: 740, top: 140}}>
      <Window w={1010} h={700} title="Book Store · Search">
        <div style={{position: 'absolute', left: 30, right: 30, top: 22, height: 64, borderRadius: 32, background: '#fff', boxShadow: `inset 0 0 0 2px ${typed > 0 ? C.gold : 'rgba(27,42,74,0.12)'}`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 26px'}}>
          <svg width={28} height={28} viewBox="0 0 24 24"><circle cx={10} cy={10} r={7} stroke={C.navy} strokeWidth={2.6} fill="none" /><path d="M15 15 L21 21" stroke={C.navy} strokeWidth={2.6} strokeLinecap="round" /></svg>
          <div style={{fontFamily: F.inter, fontWeight: 600, fontSize: 26, color: C.navy, whiteSpace: 'pre'}}>
            {QUERY.slice(0, typed)}
            {caret && typed < QUERY.length + 1 && <span style={{display: 'inline-block', width: 2.5, height: 28, background: C.navy, verticalAlign: -5, marginLeft: 2}} />}
          </div>
        </div>
        <div style={{position: 'absolute', left: 30, top: 104, display: 'flex', gap: 12}}>
          {CHIPS.map((c, i) => {
            const k = pop(t, at(11, 'keywords') + 0.1 + i * 0.13);
            return (
              <div key={c} style={{transform: `scale(${k})`, opacity: clamp(k * 2), padding: '9px 18px', borderRadius: 999, background: 'rgba(224,163,59,0.14)', border: `2px solid ${C.gold}`, fontFamily: F.inter, fontWeight: 700, fontSize: 20, color: C.navy, whiteSpace: 'nowrap'}}>
                + {c}
              </div>
            );
          })}
        </div>
        {/* results */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0}}>
          <div style={{position: 'absolute', left: slot0.x, top: slot0.y, width: CW, height: CH, borderRadius: 6, border: `3px dashed ${C.gold}`, opacity: 1 - land}} />
          {[1, 2, 3, 4, 5].map((c) => (
            <div key={c} style={{position: 'absolute', left: slot0.x + c * (CW + GX), top: slot0.y}}>
              <FlatBook w={CW} h={CH}>
                <GenericCover w={CW} h={CH} i={[0, 4, 2, 7, 5][c - 1]} />
              </FlatBook>
            </div>
          ))}
          {[0, 1, 2, 3, 4, 5].map((c) => (
            <div key={c} style={{position: 'absolute', left: slot0.x + c * (CW + GX), top: slot0.y + CH + 50, opacity: 0.9}}>
              <FlatBook w={CW} h={CH}>
                <GenericCover w={CW} h={CH} i={[3, 6, 1, 5, 0, 7][c]} />
              </FlatBook>
            </div>
          ))}
        </div>
      </Window>
      {/* our book rockets up from page 50 */}
      {fly > 0 && (
        <div
          style={{
            position: 'absolute',
            left: slot0.x,
            top: lerp(900, slot0.y + 54, fly),
            transform: `scale(${1 + (1 - clamp(land)) * 0.12 + Math.max(0, land - 1) * 0.3})`,
          }}
        >
          {fly < 1 && <div style={{position: 'absolute', left: 20, right: 20, top: CH - 10, height: 420 * (1 - fly) + 60, background: 'linear-gradient(180deg, rgba(224,163,59,0.55), rgba(224,163,59,0))', borderRadius: 40}} />}
          <FlatBook w={CW} h={CH} lift={1}>
            <PremiumCover w={CW} h={CH} />
          </FlatBook>
          <div style={{position: 'absolute', inset: -9, borderRadius: 9, boxShadow: `0 0 0 4px ${C.gold}, 0 0 40px rgba(224,163,59,0.55)`, opacity: clamp(land)}} />
        </div>
      )}
      <div style={{position: 'absolute', left: slot0.x + CW / 2, top: slot0.y + 54 - 20, transform: `translate(-50%, -100%) scale(${p1})`, opacity: clamp(p1 * 2)}}>
        <div style={{padding: '8px 18px', borderRadius: 999, background: C.gold, fontFamily: F.inter, fontWeight: 800, fontSize: 22, color: C.ink, whiteSpace: 'nowrap', boxShadow: '0 10px 24px rgba(224,163,59,0.45)'}}>PAGE 1</div>
      </div>
      {/* page counter */}
      <div style={{position: 'absolute', right: -30, top: -40, padding: '14px 26px', borderRadius: 20, background: 'rgba(14,22,38,0.92)', boxShadow: '0 20px 40px rgba(3,6,12,0.5), inset 0 0 0 2px rgba(224,163,59,0.5)', display: 'flex', alignItems: 'baseline', gap: 12, opacity: tw(t, tHelp - 0.4, 0.3)}}>
        <span style={{fontFamily: F.inter, fontWeight: 800, fontSize: 22, letterSpacing: '0.2em', color: C.muted}}>PAGE</span>
        <span style={{fontFamily: F.slab, fontSize: 64, lineHeight: 1, color: page === 1 ? C.gold : C.cream, width: 84, textAlign: 'right'}}>{page}</span>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ 5. A+ content
const APlus: React.FC<{t: number}> = ({t}) => {
  const tA = at(12, 'a+');
  const tBuyers = at(12, 'buyers');
  const mods = [tA - 0.1, tA + 0.35, at(12, 'content') + 0.25];
  const cx = map(t, [at(12, 'turns') - 0.1, tBuyers - 0.12], [1980, BUY_BTN.x + 30], EASE.inOut);
  const cy = map(t, [at(12, 'turns') - 0.1, tBuyers - 0.12], [1000, BUY_BTN.y + 20], EASE.inOut);
  const press = t > tBuyers - 0.02 && t < tBuyers + 0.14 ? 1 : 0;
  const ripple = tw(t, tBuyers, 0.5);
  const toast = sp(t, tBuyers + 0.2, {damping: 14, stiffness: 180});
  const winL = 740, winT = 110;
  const btn = {x: BUY_BTN.x - winL, y: BUY_BTN.y - winT - 54};
  return (
    <div style={{position: 'absolute', left: winL, top: winT}}>
      <Window w={1070} h={760} title="Book Store · The Last Orchard">
        <div style={{position: 'absolute', left: 40, top: 28}}>
          <FlatBook w={150} h={225}>
            <PremiumCover w={150} h={225} />
          </FlatBook>
        </div>
        <div style={{position: 'absolute', left: 226, top: 34}}>
          <div style={{fontFamily: F.inter, fontWeight: 800, fontSize: 36, color: C.navy}}>The Last Orchard</div>
          <div style={{fontFamily: F.inter, fontWeight: 600, fontSize: 21, color: 'rgba(27,42,74,0.6)', marginTop: 6}}>Elena Marsh · Paperback</div>
          {[440, 400, 260].map((w, i) => (
            <div key={i} style={{width: w, height: 11, borderRadius: 6, background: 'rgba(27,42,74,0.14)', marginTop: i === 0 ? 24 : 12}} />
          ))}
          <div style={{fontFamily: F.inter, fontWeight: 800, fontSize: 36, color: C.navy, marginTop: 22}}>$14.99</div>
        </div>
        {/* buy button */}
        <div
          style={{
            position: 'absolute',
            left: btn.x - 120,
            top: btn.y - 34,
            width: 240,
            height: 68,
            borderRadius: 34,
            background: press ? C.goldDeep : `linear-gradient(180deg, ${C.goldHi}, ${C.gold})`,
            boxShadow: press ? 'inset 0 4px 10px rgba(0,0,0,0.25)' : '0 10px 24px rgba(224,163,59,0.45)',
            transform: `scale(${press ? 0.95 : 1})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: F.inter,
            fontWeight: 800,
            fontSize: 26,
            color: C.ink,
          }}
        >
          Buy now
        </div>
        {ripple > 0 && ripple < 1 && (
          <div style={{position: 'absolute', left: btn.x - 140 * (0.5 + ripple), top: btn.y - 140 * (0.5 + ripple), width: 280 * (0.5 + ripple), height: 280 * (0.5 + ripple), borderRadius: '50%', border: `4px solid ${C.gold}`, opacity: 1 - ripple}} />
        )}
        {/* A+ modules */}
        <div style={{position: 'absolute', left: 40, right: 40, top: 290, fontFamily: F.inter, fontWeight: 800, fontSize: 17, letterSpacing: '0.18em', color: 'rgba(27,42,74,0.45)', opacity: tw(t, mods[0], 0.3)}}>FROM THE PUBLISHER</div>
        <div style={{position: 'absolute', left: 40, right: 40, top: 324, bottom: 24, overflow: 'hidden'}}>
          {(() => {
            const k0 = sp(t, mods[0], {damping: 16, stiffness: 140});
            const k1 = sp(t, mods[1], {damping: 16, stiffness: 140});
            const k2 = sp(t, mods[2], {damping: 16, stiffness: 140});
            return (
              <>
                <div style={{position: 'relative', height: 190, borderRadius: 14, overflow: 'hidden', transform: `translateY(${(1 - k0) * 420}px)`, background: 'linear-gradient(100deg, #0F1A31 0%, #1B2A4A 35%, #6B4A3A 70%, #D9893A 100%)'}}>
                  <div style={{position: 'absolute', right: 70, top: 40, width: 110, height: 110, borderRadius: '50%', background: 'radial-gradient(circle, #FFE9B8, #F5C978 40%, rgba(245,170,80,0) 72%)'}} />
                  <svg viewBox="0 0 200 40" preserveAspectRatio="none" style={{position: 'absolute', left: 0, bottom: 0, width: '100%', height: 70}}>
                    <path d="M0 22 Q50 14 100 20 T200 18 V40 H0Z" fill="#1E1517" />
                    {Array.from({length: 14}).map((_, i) => (
                      <circle key={i} cx={i * 15 + 4} cy={18 + (i % 2) * 2} r={5} fill="#140E10" />
                    ))}
                  </svg>
                  <div style={{position: 'absolute', left: 40, top: 46, fontFamily: F.serif, fontStyle: 'italic', fontWeight: 700, fontSize: 46, color: C.cream}}>Some secrets grow deep.</div>
                  <div style={{position: 'absolute', left: 42, top: 118, width: 70, height: 4, background: C.gold}} />
                </div>
                <div style={{display: 'flex', gap: 18, marginTop: 18}}>
                  {[
                    ['Small-town secrets', k1],
                    ['A heroine to root for', k2],
                    ['Perfect for book clubs', k2],
                  ].map(([label, k], i) => (
                    <div
                      key={label as string}
                      style={{
                        flex: 1,
                        height: 150,
                        borderRadius: 14,
                        background: '#fff',
                        boxShadow: '0 6px 18px rgba(27,42,74,0.1)',
                        transform: `translateY(${(1 - (k as number)) * 300 + i * 0}px)`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                      }}
                    >
                      <div style={{width: 46, height: 46, borderRadius: 23, background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <Check size={28} color={C.gold} stroke={8} />
                      </div>
                      <div style={{fontFamily: F.inter, fontWeight: 700, fontSize: 21, color: C.navy}}>{label as string}</div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </Window>
      {/* order toast */}
      <div style={{position: 'absolute', right: -40, top: -36, transform: `translateY(${(1 - toast) * -40}px) scale(${0.8 + 0.2 * clamp(toast)})`, opacity: clamp(toast * 2)}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, padding: '14px 26px', borderRadius: 18, background: C.ink, boxShadow: '0 20px 40px rgba(3,6,12,0.5), inset 0 0 0 2px rgba(224,163,59,0.6)', fontFamily: F.inter, fontWeight: 800, fontSize: 24, color: C.cream}}>
          <div style={{width: 36, height: 36, borderRadius: 18, background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.slab, fontSize: 20, color: C.ink}}>$</div>
          New order
        </div>
      </div>
      {t > at(12, 'turns') - 0.15 && (
        <div style={{position: 'absolute', left: cx - winL, top: cy - winT}}>
          <Cursor size={54} press={press} />
        </div>
      )}
    </div>
  );
};

export const S5Services: React.FC = () => {
  const t = useT();
  const bgIn = tw(t, S.publish[0] - 0.1, 0.35);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{opacity: bgIn}}>
        <Set light={0.95} spotX={64} spotY={40} />
        <Dust t={t} opacity={0.45} seed={12} count={30} />
      </AbsoluteFill>

      <Stage t={t} k="publish" enter={(e) => ({transform: `translateX(${(1 - e) * 700}px)`, opacity: clamp(e * 1.5)})} exit={(x) => ({transform: `translateX(${-x * 500}px) scale(${1 - x * 0.1})`, opacity: 1 - x})}>
        <Publish t={t} />
      </Stage>
      <Stage
        t={t}
        k="format"
        enter={(e) => ({transform: `translateY(${(1 - e) * 900}px) rotate(${(1 - e) * 6}deg)`, filter: e < 0.9 ? `blur(${(1 - e) * 16}px)` : undefined})}
        exit={(x) => ({transform: `scale(${1 + x * 2.2})`, opacity: 1 - x, filter: `blur(${x * 18}px)`})}
      >
        <Format t={t} />
      </Stage>
      <Stage t={t} k="cover" enter={(e) => ({transform: `scale(${0.55 + 0.45 * e})`, opacity: clamp(e * 1.6), filter: e < 0.9 ? `blur(${(1 - e) * 14}px)` : undefined})} exit={(x) => ({transform: `translateY(${-x * 1100}px)`, filter: `blur(${x * 26}px)`})}>
        <Cover t={t} />
      </Stage>
      <Stage t={t} k="keywords" enter={(e) => ({transform: `translateY(${(1 - e) * 1100}px)`, filter: e < 0.9 ? `blur(${(1 - e) * 26}px)` : undefined})} exit={(x) => ({transform: `translateY(${-x * 900}px)`, opacity: 1 - x * 0.6})}>
        <Keywords t={t} />
      </Stage>
      <Stage t={t} k="aplus" tilt={0} enter={(e) => ({transform: `translateY(${(1 - e) * 900}px)`})} exit={() => ({})}>
        <APlus t={t} />
      </Stage>

      <Panel t={t} />

      {/* sound */}
      <Sfx at={S.publish[0] - 0.12} name="whoosh_soft" volume={0.45} />
      <Sfx at={S.publish[0] + 0.5} name="upload" volume={0.3} />
      <Sfx at={at(8, 'kindle') - 0.06} name="card_flip" volume={0.45} />
      <Sfx at={at(8, 'paperback') - 0.06} name="card_flip" volume={0.45} rate={1.06} />
      <Sfx at={at(8, 'hardcover') - 0.06} name="card_flip" volume={0.45} rate={0.94} />
      <Sfx at={at(8, 'hardcover') + 0.36} name="chime_success" volume={0.5} />
      <Sfx at={S.format[0] - 0.12} name="whoosh_up" volume={0.45} />
      <Sfx at={at(9, 'format') + 0.05} name="snap_lines" volume={0.45} />
      <Sfx at={at(9, 'approves') - 0.03} name="stamp_soft" volume={0.6} />
      <Sfx at={at(9, 'approves') + 0.02} name="chime_success" volume={0.4} />
      <Sfx at={S.cover[0] - 0.12} name="zoom_through" volume={0.45} />
      <Sfx at={at(10, 'design') + 0.02} name="shimmer" volume={0.45} />
      <Sfx at={at(10, 'stop') - 0.6} name="whoosh_soft" volume={0.35} />
      <Sfx at={at(10, 'scrolling') + 0.03} name="tick_soft" volume={0.45} />
      <Sfx at={S.keywords[0] - 0.12} name="whip" volume={0.45} />
      <Sfx at={S.keywords[0] + 0.3} name="typing" volume={0.3} />
      <Sfx at={at(11, 'help') + 0.15} name="rocket" volume={0.55} />
      <Sfx at={at(11, 'help') + 0.72} name="pop2" volume={0.5} />
      <Sfx at={S.aplus[0] - 0.12} name="whoosh_up" volume={0.4} />
      <Sfx at={at(12, 'a+') - 0.1} name="slide_up" volume={0.35} />
      <Sfx at={at(12, 'buyers') - 0.02} name="click" volume={0.5} />
      <Sfx at={at(12, 'buyers') + 0.04} name="cha_ching" volume={0.55} />
    </AbsoluteFill>
  );
};
