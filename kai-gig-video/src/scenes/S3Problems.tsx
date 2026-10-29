import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp, lerp, map, noise, pop, shake, sp, tw} from '../anim';
import {DullCover, FlatBook, GenericCover} from '../components/Covers';
import {Cursor} from '../components/Icons';
import {Dust, Set} from '../components/Overlays';
import {useT} from '../components/Scene';
import {Sfx} from '../components/Sfx';
import {PageText, Stamp, Window} from '../components/UI';
import {at, P, S, w} from '../timeline';
import {C, EASE, F} from '../theme';

const Warn: React.FC<{k: number; size?: number}> = ({k, size = 44}) => (
  <svg viewBox="0 0 48 44" width={size} height={size} style={{transform: `scale(${k})`, opacity: clamp(k * 2), overflow: 'visible'}}>
    <path d="M24 3 L46 41 H2 Z" fill={C.red} stroke="#fff" strokeWidth={3} strokeLinejoin="round" />
    <path d="M24 16 V28" stroke="#fff" strokeWidth={4.5} strokeLinecap="round" />
    <circle cx={24} cy={34.5} r={2.6} fill="#fff" />
  </svg>
);

const Eyebrow: React.FC<{t: number; t0: number; text: string; n: string}> = ({t, t0, text, n}) => {
  const k = sp(t, t0, {damping: 15, stiffness: 200});
  return (
    <div
      style={{
        position: 'absolute',
        left: 110,
        top: 96,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        opacity: clamp(k * 1.5),
        transform: `translateX(${(1 - k) * -40}px)`,
      }}
    >
      <div style={{fontFamily: F.slab, fontSize: 30, color: C.red}}>{n}</div>
      <div style={{width: 46, height: 3, background: C.red, borderRadius: 2}} />
      <div style={{fontFamily: F.inter, fontWeight: 800, fontSize: 30, letterSpacing: '0.16em', color: C.cream}}>{text}</div>
    </div>
  );
};

// ------------------------------------------------------------------ 1. margin
const Margin: React.FC<{t: number}> = ({t}) => {
  const tWrong = at(4, 'wrong');
  const tMargin = at(4, 'margin');
  const tSent = at(4, 'sent');
  const enter = tw(t, P.margin[0] - 0.18, 0.4, EASE.out);
  const guides = tw(t, tWrong, 0.4, EASE.out);
  const blink = t > tMargin && t < tMargin + 0.5 ? (Math.floor((t - tMargin) * 10) % 2 === 0 ? 1 : 0.35) : 1;
  const red = tw(t, tMargin - 0.05, 0.3);
  const stampK = sp(t, tSent - 0.02, {damping: 13, stiffness: 320, mass: 0.8});
  const sh = shake(t, tSent + 0.04, 0.35, 12);
  const push = lerp(1, 1.05, tw(t, P.margin[0], 2.4, EASE.outSoft));
  const reject = tw(t, at(4, 'back') + 0.05, 0.5, EASE.inOut);
  return (
    <AbsoluteFill style={{transform: `translate(${(1 - enter) * 900 + sh.x}px, ${sh.y}px)`, filter: enter < 0.9 ? `blur(${(1 - enter) * 24}px)` : undefined}}>
      <Set light={0.8} spotX={50} spotY={30} />
      <Dust t={t} opacity={0.35} seed={7} />
      <Eyebrow t={t} t0={P.margin[0] + 0.1} n="01" text="MARGINS" />
      <div style={{position: 'absolute', left: 960 - 330, top: 96, perspective: 1800, transform: `scale(${push * 0.92}) translateY(${reject * -30}px)`, transformOrigin: '50% 0%'}}>
        <div
          style={{
            position: 'relative',
            width: 660,
            height: 820,
            transform: `rotateX(${8 + reject * 6}deg) rotateY(${-10 + noise(t * 0.5, 1) * 2 + reject * 14}deg) rotateZ(${-2 + reject * -3}deg)`,
            background: `radial-gradient(ellipse at 30% 20%, #FFFDF6, ${C.paper} 60%, #EADFC6)`,
            borderRadius: 6,
            boxShadow: '0 50px 100px rgba(3,6,12,0.6), 0 12px 30px rgba(3,6,12,0.35)',
          }}
        >
          <div style={{position: 'absolute', top: 40, left: 0, right: 0, textAlign: 'center', fontFamily: F.serif, fontSize: 16, letterSpacing: '0.3em', color: 'rgba(27,42,74,0.45)'}}>THE LAST ORCHARD</div>
          <div style={{position: 'absolute', left: 80, top: 110}}>
            <PageText lines={17} width={500} snap={0} seed={3} red={red} lineH={36} />
          </div>
          <div style={{position: 'absolute', bottom: 34, left: 0, right: 0, textAlign: 'center', fontFamily: F.serif, fontSize: 18, color: 'rgba(27,42,74,0.5)'}}>47</div>
          {/* red margin guides */}
          {[80, 580].map((x) => (
            <div key={x} style={{position: 'absolute', left: x, top: 20, height: 780 * guides, borderLeft: `3px dashed ${C.red}`, opacity: blink}} />
          ))}
          {[100, 720].map((y) => (
            <div key={y} style={{position: 'absolute', top: y, left: 20, width: 620 * guides, borderTop: `3px dashed ${C.red}`, opacity: blink * 0.8}} />
          ))}
          {[[592, 236], [600, 380], [590, 560], [36, 452]].map(([x, y], i) => (
            <div key={i} style={{position: 'absolute', left: x, top: y}}>
              <Warn k={pop(t, tMargin + 0.08 + i * 0.09)} />
            </div>
          ))}
        </div>
      </div>
      <div style={{position: 'absolute', left: 960 + 10, top: 430, transform: 'translate(-50%, -50%)'}}>
        {stampK > 0 && (
          <div style={{transform: `scale(${1 + reject * 0.03})`}}>
            <Stamp id="sent2" text="SENT BACK" color={C.red} k={stampK} rot={-14} size={92} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 2. cover shelf
const SHELF = [0, 4, 1, 'dull', 5, 3, 7] as const;
const Shelf: React.FC<{t: number}> = ({t}) => {
  const t0 = P.cover[0];
  const tCover = at(5, 'cover');
  const tSkip = at(5, 'skipped');
  const tMeme = tSkip + 0.38;
  const BW = 210, BH = 315, GAP = 46;
  const rowW = SHELF.length * BW + (SHELF.length - 1) * GAP;
  const x0 = 960 - rowW / 2;
  const truck = lerp(30, -30, tw(t, t0, 2.2, EASE.inOut));
  const dullX = x0 + 3 * (BW + GAP) + BW / 2;
  // cursor path: glide in, hover the dull cover, then skip past it
  const cx = map(t, [t0 + 0.05, tCover, tSkip - 0.05, tSkip + 0.12], [x0 + BW * 0.6, dullX - 10, dullX - 4, dullX + BW + GAP + 30], EASE.inOut);
  const cy = map(t, [t0 + 0.05, tCover, tSkip + 0.12], [880, 600, 590], EASE.inOut);
  const hoverIdx = Math.round((cx - x0 - BW / 2) / (BW + GAP));
  // meme beat: zoom punch onto the sad cover
  const punch = sp(t, tMeme, {damping: 12, stiffness: 300, mass: 0.6});
  const unpunch = tw(t, tMeme + 0.55, 0.2, EASE.in);
  const zoom = 1 + 1.15 * clamp(punch) * (1 - unpunch);
  const face = tw(t, tMeme + 0.05, 0.45, EASE.outSoft);
  const whipOut = tw(t, P.cover[1] - 0.1, 0.25, EASE.in);
  return (
    <AbsoluteFill style={{transform: `translateY(${-whipOut * 1200}px)`, filter: whipOut > 0.05 ? `blur(${whipOut * 30}px)` : undefined}}>
      <Set light={0.75} spotY={26} />
      <Eyebrow t={t} t0={t0 + 0.08} n="02" text="COVERS" />
      <AbsoluteFill style={{transform: `scale(${zoom})`, transformOrigin: `${dullX + truck}px 560px`}}>
        {/* store spotlights */}
        {SHELF.map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x0 + truck + i * (BW + GAP) + BW / 2 - 180,
              top: 230,
              width: 360,
              height: 560,
              background: 'radial-gradient(ellipse 50% 50% at 50% 40%, rgba(255,220,160,0.10), rgba(0,0,0,0) 70%)',
            }}
          />
        ))}
        {/* ledge */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 560 + BH / 2 + 4, height: 26, background: 'linear-gradient(180deg, #3A4F7E, #22345A 40%, #142039)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 560 + BH / 2 + 30, height: 120, background: 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0))'}} />
        {SHELF.map((b, i) => {
          const isDull = b === 'dull';
          const hovered = !isDull && hoverIdx === i && t > t0 + 0.1 && t < P.cover[1];
          const lift = hovered ? 1 : 0;
          const glow = !isDull && i === 4 ? tw(t, tSkip + 0.06, 0.25) : 0;
          return (
            <div key={i} style={{position: 'absolute', left: x0 + truck + i * (BW + GAP), top: 560 - BH / 2 - lift * 14 - glow * 18, filter: isDull ? 'saturate(0.7)' : undefined}}>
              <FlatBook w={BW} h={BH} lift={lift + glow}>
                {isDull ? <DullCover w={BW} h={BH} face={face} /> : <GenericCover w={BW} h={BH} i={b as number} />}
              </FlatBook>
              {glow > 0 && <div style={{position: 'absolute', inset: -6, borderRadius: 8, boxShadow: `0 0 0 4px ${C.gold}, 0 0 40px rgba(224,163,59,0.5)`, opacity: glow}} />}
            </div>
          );
        })}
        {/* skip motion trail */}
        {t > tSkip - 0.05 && t < tSkip + 0.3 && (
          <div
            style={{
              position: 'absolute',
              left: dullX - 40,
              top: cy - 6,
              width: BW + GAP + 80,
              height: 10,
              borderRadius: 5,
              opacity: 1 - tw(t, tSkip + 0.05, 0.25),
              background: 'linear-gradient(90deg, rgba(246,236,218,0), rgba(246,236,218,0.5))',
            }}
          />
        )}
        {face > 0 && (
          <div
            style={{
              position: 'absolute',
              left: dullX + truck + 70,
              top: 340,
              fontFamily: F.inter,
              fontWeight: 700,
              fontStyle: 'italic',
              fontSize: 26,
              color: C.cream,
              opacity: face * (1 - unpunch),
              transform: `translateY(${(1 - face) * 10}px) rotate(8deg)`,
            }}
          >
            *sigh*
          </div>
        )}
      </AbsoluteFill>
      <div style={{position: 'absolute', left: cx + truck, top: cy, opacity: 1 - punch * (1 - unpunch)}}>
        <Cursor size={54} />
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 3. keywords / page fifty
const RESULT_ROWS = 40;
const Search: React.FC<{t: number}> = ({t}) => {
  const t0 = P.keywords[0];
  const tKey = at(6, 'keywords');
  const tFifty = at(6, 'fifty');
  const enter = tw(t, t0 - 0.12, 0.35, EASE.out);
  // pages accelerate from 1 to 50, landing on "fifty"
  const pk = map(t, [tKey - 0.05, tFifty], [0, 1]);
  const page = Math.max(1, Math.round(1 + 49 * Math.pow(pk, 2.2)));
  const prevPk = map(t - 1 / 30, [tKey - 0.05, tFifty], [0, 1]);
  const speed = (Math.pow(pk, 2.2) - Math.pow(prevPk, 2.2)) * 49;
  const scroll = Math.pow(pk, 2.2) * 49 * 300;
  const landed = t >= tFifty;
  const landK = sp(t, tFifty, {damping: 11, stiffness: 300});
  const sh = shake(t, tFifty + 0.02, 0.35, 10);
  const COLS = 5, CW = 150, CH = 225, GX = 34, GY = 70;
  const ghosts = speed > 0.25 ? [0, 1, 2] : [0];
  const grid = (offset: number, alpha: number, key: number) => (
    <div key={key} style={{position: 'absolute', left: 40, top: 30 - ((scroll + offset) % ((CH + GY) * 8)), opacity: alpha}}>
      {Array.from({length: 12}).map((_, r) => (
        <div key={r} style={{display: 'flex', gap: GX, marginBottom: GY}}>
          {Array.from({length: COLS}).map((_, c) => (
            <div key={c}>
              <FlatBook w={CW} h={CH}>
                <GenericCover w={CW} h={CH} i={(r * COLS + c + Math.floor(r / 2)) % 8} />
              </FlatBook>
              <div style={{marginTop: 10, width: CW * 0.8, height: 10, borderRadius: 5, background: 'rgba(27,42,74,0.25)'}} />
              <div style={{marginTop: 6, width: CW * 0.45, height: 10, borderRadius: 5, background: 'rgba(27,42,74,0.15)'}} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
  return (
    <AbsoluteFill style={{transform: `translate(${sh.x}px, ${(1 - enter) * 1100 + sh.y}px)`, filter: enter < 0.9 ? `blur(${(1 - enter) * 26}px)` : undefined}}>
      <Set light={0.7} spotX={40} />
      <Eyebrow t={t} t0={t0 + 0.08} n="03" text="KEYWORDS" />
      <div style={{position: 'absolute', left: 110, top: 170, perspective: 2000}}>
        <div style={{transform: 'rotateY(10deg) rotateX(4deg)', transformOrigin: '0% 50%'}}>
          <Window w={1000} h={780} title="Book Store · Search">
            {/* search bar */}
            <div style={{position: 'absolute', left: 30, right: 30, top: 22, height: 64, borderRadius: 32, background: '#fff', boxShadow: 'inset 0 0 0 2px rgba(27,42,74,0.12)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 26px'}}>
              <svg width={28} height={28} viewBox="0 0 24 24"><circle cx={10} cy={10} r={7} stroke={C.navy} strokeWidth={2.6} fill="none" /><path d="M15 15 L21 21" stroke={C.navy} strokeWidth={2.6} strokeLinecap="round" /></svg>
              <div style={{fontFamily: F.inter, fontWeight: 600, fontSize: 26, color: C.navy}}>mystery novel</div>
              <div style={{marginLeft: 'auto', fontFamily: F.inter, fontWeight: 600, fontSize: 20, color: 'rgba(27,42,74,0.5)'}}>12,408 results</div>
            </div>
            <div style={{position: 'absolute', left: 0, right: 0, top: 110, bottom: 0, overflow: 'hidden'}}>
              {!landed && ghosts.map((g) => grid(-g * Math.min(90, speed * 40), g === 0 ? 1 : 0.28, g))}
              {landed && (
                <div style={{position: 'absolute', left: 40, top: 30}}>
                  <div style={{display: 'flex', gap: GX}}>
                    {[2, 6, 0, 3].map((i) => (
                      <FlatBook key={i} w={CW} h={CH}>
                        <GenericCover w={CW} h={CH} i={i} />
                      </FlatBook>
                    ))}
                    <div style={{position: 'relative', opacity: 0.85}}>
                      <FlatBook w={CW} h={CH}>
                        <DullCover w={CW} h={CH} />
                      </FlatBook>
                      <div style={{position: 'absolute', inset: -8, borderRadius: 8, border: `4px solid ${C.red}`, opacity: clamp(landK * 2)}} />
                    </div>
                  </div>
                  {/* pile of other titles falling on top */}
                  {[0, 1, 2, 3, 4].map((i) => {
                    const k = tw(t, tFifty + 0.05 + i * 0.05, 0.25, EASE.in);
                    return (
                      <div key={i} style={{position: 'absolute', left: 4 * (CW + GX) + (i % 2 ? -18 : 14), top: lerp(-400, 30 - i * 6, k), transform: `rotate(${(i - 2) * 9}deg)`, opacity: k > 0 ? 1 : 0}}>
                        <FlatBook w={CW} h={CH}>
                          <GenericCover w={CW} h={CH} i={i + 3} />
                        </FlatBook>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Window>
        </div>
      </div>
      {/* page counter */}
      <div style={{position: 'absolute', left: 1240, top: 300, width: 600, textAlign: 'center'}}>
        <div style={{fontFamily: F.inter, fontWeight: 800, fontSize: 40, letterSpacing: '0.3em', color: landed ? C.red : C.muted}}>PAGE</div>
        <div
          style={{
            fontFamily: F.slab,
            fontSize: 300,
            lineHeight: 1,
            color: landed ? C.red : C.cream,
            textShadow: landed ? '0 0 60px rgba(229,72,77,0.55)' : '0 20px 50px rgba(0,0,0,0.4)',
            transform: `scale(${landed ? 1.35 - 0.35 * landK : 1})`,
            filter: speed > 0.6 ? 'blur(2px)' : undefined,
          }}
        >
          {page}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const S3Problems: React.FC = () => {
  const tReal = useT();
  // freeze on the last frame when "the turn" begins
  const freezeAt = S.problems[1];
  const t = Math.min(tReal, freezeAt);
  const frozen = tw(tReal, freezeAt, 0.25);
  // page-turn wipe from the margin page into the shelf
  const turn = tw(t, P.cover[0] - 0.18, 0.42, EASE.inOut);
  const edge = lerp(2150, -500, turn);
  return (
    <AbsoluteFill style={{overflow: 'hidden', filter: frozen > 0 ? `saturate(${1 - 0.6 * frozen}) brightness(${1 - 0.25 * frozen})` : undefined}}>
      {t < P.cover[0] + 0.3 && <Margin t={t} />}
      {t >= P.cover[0] - 0.2 && t < P.cover[1] + 0.2 && (
        <AbsoluteFill style={{clipPath: turn < 1 ? `polygon(${edge}px 0, 1920px 0, 1920px 1080px, ${edge + 420}px 1080px)` : undefined}}>
          <Shelf t={t} />
        </AbsoluteFill>
      )}
      {turn > 0 && turn < 1 && (
        <div
          style={{
            position: 'absolute',
            top: -200,
            left: edge - 140,
            width: 220,
            height: 1500,
            transform: `rotate(${Math.atan2(420, 1080) * (-180 / Math.PI)}deg)`,
            transformOrigin: '50% 13%',
            background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 55%, rgba(255,248,230,0.55) 82%, rgba(255,248,230,0) 100%)',
          }}
        />
      )}
      {t >= P.keywords[0] - 0.15 && <Search t={t} />}

      <Sfx at={P.margin[0] + 0.15} name="paper_slide" volume={0.5} />
      <Sfx at={at(4, 'margin') - 0.03} name="error_blip" volume={0.35} />
      <Sfx at={at(4, 'sent') - 0.02} name="stamp" volume={0.85} />
      <Sfx at={P.cover[0] - 0.18} name="page_turn" volume={0.6} />
      <Sfx at={at(5, 'skipped') - 0.04} name="skip" volume={0.5} />
      <Sfx at={at(5, 'skipped') + 0.38} name="bonk" volume={0.55} />
      <Sfx at={P.cover[1] - 0.12} name="whip_down" volume={0.5} />
      <Sfx at={at(6, 'keywords') - 0.05} name="scroll_fast" volume={0.45} />
      <Sfx at={at(6, 'fifty') - 0.01} name="thud_muffled" volume={0.8} />
    </AbsoluteFill>
  );
};
