import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp, lerp, map, noise, pop, sp, tw} from '../anim';
import {Cursor} from '../components/Icons';
import {KaiLogo} from '../components/KaiLogo';
import {Reveal} from '../components/Kinetic';
import {Dust, Set} from '../components/Overlays';
import {useT} from '../components/Scene';
import {Sfx} from '../components/Sfx';
import {Window} from '../components/UI';
import {at, END_CARD, S, w} from '../timeline';
import {C, EASE, F} from '../theme';

const MESSAGE = 'Hi! Here are my book details…';

const FileChip: React.FC<{label: string; kind: 'doc' | 'img'; k: number}> = ({label, kind, k}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 18px',
      borderRadius: 14,
      background: '#fff',
      boxShadow: '0 6px 16px rgba(27,42,74,0.12)',
      fontFamily: F.inter,
      fontWeight: 700,
      fontSize: 21,
      color: C.navy,
      transform: `translateY(${(1 - clamp(k)) * 30}px) scale(${0.9 + 0.1 * clamp(k)})`,
      opacity: clamp(k * 2),
    }}
  >
    <svg viewBox="0 0 24 24" width={28} height={28}>
      {kind === 'doc' ? (
        <path d="M6 2 H14 L19 7 V22 H6 Z M14 2 V7 H19 M9 12 H16 M9 16 H16" fill="none" stroke={C.gold} strokeWidth={2} strokeLinejoin="round" />
      ) : (
        <path d="M3 5 H21 V19 H3 Z M3 16 L9 11 L13 15 L16 12 L21 17" fill="none" stroke={C.gold} strokeWidth={2} strokeLinejoin="round" />
      )}
    </svg>
    {label}
  </div>
);

export const S8CTA: React.FC = () => {
  const t = useT();
  const t0 = S.cta[0];
  const tUpload = at(16, 'upload');
  const tKdp = at(16, 'kdp');
  const tSend = at(16, 'send');
  const tOnly = at(17, 'only');
  const enter = tw(t, t0 - 0.35, 0.5, EASE.out);

  // part 1: upload screen, cursor hesitates over the button
  const zoomIn = tw(t, tKdp + 0.15, 0.55, EASE.in);
  const cx = map(t, [t0 + 0.1, tUpload - 0.05], [1500, 1000], EASE.inOut) + noise(t * 2, 3) * (t > tUpload ? 4 : 0);
  const cy = map(t, [t0 + 0.1, tUpload - 0.05], [900, 640], EASE.inOut);
  const hover = tw(t, tUpload - 0.1, 0.2);
  const bubbleK = pop(t, at(16, 'amazon') - 0.05);
  const partUpload = t < tKdp + 0.75;

  // part 2: chat
  const chatIn = tw(t, tKdp + 0.38, 0.55, EASE.out);
  const typed = Math.floor(map(t, [tKdp + 0.6, tSend - 0.12], [0, MESSAGE.length]));
  const sent = t >= tSend;
  const sendK = sp(t, tSend, {damping: 15, stiffness: 190});
  const chips = [sp(t, tSend + 0.45, {damping: 15, stiffness: 170}), sp(t, tSend + 0.62, {damping: 15, stiffness: 170})];
  const typingDots = t > at(16, 'details') + 0.3 && t < END_CARD - 0.3;
  const shrink = tw(t, tOnly - 0.25, 0.5, EASE.inOut);

  // part 3: end card. The chat avatar grows into the logo.
  const endK = tw(t, END_CARD - 0.25, 0.75, EASE.inOut);
  const chatOut = tw(t, END_CARD - 0.3, 0.4, EASE.in);
  const avatarFrom = {x: 960 - 470 + 70, y: 230 + 54 + 46, s: 64};
  const logoX = lerp(avatarFrom.x, 960, endK);
  const logoY = lerp(avatarFrom.y - shrink * 40, 430, endK);
  const logoS = lerp(avatarFrom.s * (1 - shrink * 0.12), 300, endK);
  const glint = (t - (END_CARD + 0.45)) / 0.8;
  const tag = tw(t, END_CARD + 0.35, 0.6, EASE.out);
  const line2 = tw(t, END_CARD + 0.7, 0.6, EASE.out);

  return (
    <AbsoluteFill style={{overflow: 'hidden', transform: `translateY(${(1 - enter) * -1100}px)`, filter: enter < 0.9 ? `blur(${(1 - enter) * 24}px)` : undefined}}>
      <Set light={0.95} spotY={38} />
      <Dust t={t} opacity={0.5} seed={41} count={32} />

      {/* ---- upload screen */}
      {partUpload && (
        <AbsoluteFill style={{transform: `scale(${1 + zoomIn * 2.6})`, transformOrigin: '1520px 246px', opacity: 1 - tw(t, tKdp + 0.45, 0.25), filter: zoomIn > 0.05 ? `blur(${zoomIn * 14}px)` : undefined}}>
          <div style={{position: 'absolute', left: 960 - 520, top: 170, perspective: 2000}}>
            <div style={{transform: `rotateX(${4 + noise(t * 0.4, 1)}deg) rotateY(${-4 + noise(t * 0.3, 2) * 2}deg)`}}>
              <Window w={1040} h={640} title="Publish your book">
                <div style={{position: 'absolute', left: 60, right: 60, top: 50, height: 300, borderRadius: 22, border: `3px dashed rgba(27,42,74,0.25)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16}}>
                  <svg viewBox="0 0 48 48" width={80} height={80}>
                    <path d="M24 32 V10 M15 19 L24 10 L33 19 M10 30 V38 H38 V30" fill="none" stroke={C.navy} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div style={{fontFamily: F.inter, fontWeight: 800, fontSize: 34, color: C.navy}}>the-last-orchard-final.pdf</div>
                  <div style={{fontFamily: F.inter, fontWeight: 600, fontSize: 22, color: 'rgba(27,42,74,0.55)'}}>Manuscript · Cover · Details</div>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    left: 520 - 210,
                    top: 400,
                    width: 420,
                    height: 84,
                    borderRadius: 42,
                    background: `linear-gradient(180deg, ${C.goldHi}, ${C.gold})`,
                    boxShadow: `0 ${12 + hover * 8}px ${26 + hover * 20}px rgba(224,163,59,${0.4 + hover * 0.2})`,
                    transform: `scale(${1 + hover * 0.04})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: F.inter,
                    fontWeight: 800,
                    fontSize: 30,
                    color: C.ink,
                  }}
                >
                  Upload to Amazon KDP
                </div>
              </Window>
            </div>
          </div>
          {/* "message me first" bubble */}
          <div style={{position: 'absolute', left: 1240, top: 196, transform: `scale(${bubbleK})`, transformOrigin: '20% 100%', opacity: clamp(bubbleK * 2)}}>
            <div style={{position: 'relative', padding: '22px 30px', borderRadius: 28, background: C.navy, boxShadow: `0 20px 50px rgba(3,6,12,0.55), 0 0 0 3px ${C.gold}`, display: 'flex', alignItems: 'center', gap: 16}}>
              <KaiLogo size={64} glow={0} />
              <div style={{fontFamily: F.inter, fontWeight: 800, fontSize: 30, color: C.cream, whiteSpace: 'nowrap'}}>Wait, message me first</div>
            </div>
          </div>
          <div style={{position: 'absolute', left: cx, top: cy}}>
            <Cursor size={56} />
          </div>
        </AbsoluteFill>
      )}

      {/* ---- chat */}
      {chatIn > 0 && chatOut < 1 && (
        <div
          style={{
            position: 'absolute',
            left: 960 - 470,
            top: 230,
            transform: `translateY(${-shrink * 120}px) scale(${(0.12 + 0.88 * chatIn) * (1 - shrink * 0.12)})`,
            transformOrigin: chatIn < 1 ? '1030px 16px' : '470px 0px',
            opacity: clamp(chatIn * 3) * (1 - chatOut),
          }}
        >
          <Window w={940} h={600}>
            {/* header */}
            <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 92, display: 'flex', alignItems: 'center', gap: 18, padding: '0 34px', borderBottom: '1px solid rgba(27,42,74,0.08)'}}>
              <div style={{width: 64, height: 64, opacity: endK > 0 ? 0 : 1}}>
                <KaiLogo size={64} glow={0} />
              </div>
              <div>
                <div style={{fontFamily: F.inter, fontWeight: 800, fontSize: 26, color: C.navy}}>KAI</div>
                <div style={{fontFamily: F.inter, fontWeight: 600, fontSize: 18, color: 'rgba(27,42,74,0.55)'}}>Amazon KDP Publishing</div>
              </div>
            </div>
            {/* messages */}
            <div style={{position: 'absolute', left: 34, right: 34, top: 120, bottom: 110}}>
              {sent && (
                <div style={{position: 'absolute', right: 0, top: lerp(260, 0, clamp(sendK)), display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12}}>
                  <div style={{padding: '18px 26px', borderRadius: '24px 24px 6px 24px', background: `linear-gradient(180deg, ${C.goldHi}, ${C.gold})`, fontFamily: F.inter, fontWeight: 700, fontSize: 30, color: C.ink, boxShadow: '0 10px 24px rgba(224,163,59,0.35)', transform: `scale(${0.8 + 0.2 * clamp(sendK)})`, transformOrigin: '100% 100%'}}>
                    {MESSAGE}
                  </div>
                  <div style={{display: 'flex', gap: 12}}>
                    <FileChip label="Manuscript.docx" kind="doc" k={chips[0]} />
                    <FileChip label="Cover ideas.jpg" kind="img" k={chips[1]} />
                  </div>
                  <div style={{fontFamily: F.inter, fontWeight: 600, fontSize: 17, color: 'rgba(27,42,74,0.5)', opacity: tw(t, tSend + 0.8, 0.3)}}>Sent</div>
                </div>
              )}
              {typingDots && (
                <div style={{position: 'absolute', left: 0, top: 250, padding: '16px 22px', borderRadius: '22px 22px 22px 6px', background: '#EFE5D2', display: 'flex', gap: 8, opacity: tw(t, at(16, 'details') + 0.3, 0.2)}}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{width: 12, height: 12, borderRadius: 6, background: C.navy, opacity: 0.35 + 0.65 * Math.max(0, Math.sin(t * 9 - i * 0.9)), transform: `translateY(${-Math.max(0, Math.sin(t * 9 - i * 0.9)) * 5}px)`}} />
                  ))}
                </div>
              )}
            </div>
            {/* composer */}
            <div style={{position: 'absolute', left: 30, right: 30, bottom: 26, height: 70, borderRadius: 35, background: '#fff', boxShadow: `inset 0 0 0 2px ${typed > 0 && !sent ? C.gold : 'rgba(27,42,74,0.12)'}`, display: 'flex', alignItems: 'center', padding: '0 12px 0 28px'}}>
              <div style={{flex: 1, fontFamily: F.inter, fontWeight: 600, fontSize: 26, color: sent ? 'rgba(27,42,74,0.4)' : C.navy, whiteSpace: 'pre'}}>
                {sent ? 'Write a message…' : MESSAGE.slice(0, typed)}
                {!sent && Math.floor(t * 2.4) % 2 === 0 && <span style={{display: 'inline-block', width: 2.5, height: 28, background: C.navy, verticalAlign: -5, marginLeft: 2}} />}
              </div>
              <div style={{width: 50, height: 50, borderRadius: 25, background: typed >= MESSAGE.length || sent ? C.gold : 'rgba(27,42,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${t > tSend - 0.08 && t < tSend + 0.1 ? 0.88 : 1})`}}>
                <svg viewBox="0 0 24 24" width={24} height={24}>
                  <path d="M4 12 L20 4 L14 20 L11 13 Z" fill={C.ink} />
                </svg>
              </div>
            </div>
          </Window>
        </div>
      )}

      {/* "Only here on Fiverr." */}
      {shrink > 0 && (
        <div style={{position: 'absolute', top: 868, left: 0, right: 0, textAlign: 'center', fontFamily: F.slab, fontSize: 92, color: C.cream, opacity: 1 - chatOut, textShadow: '0 10px 30px rgba(0,0,0,0.45)'}}>
          <Reveal t={t} t0={tOnly - 0.04}>Only</Reveal> <Reveal t={t} t0={at(17, 'here') - 0.04}>here</Reveal> <Reveal t={t} t0={w(17, 2) - 0.04}>on</Reveal>{' '}
          <Reveal t={t} t0={at(17, 'fiverr') - 0.04} mode="letters" style={{color: C.gold}}>
            Fiverr.
          </Reveal>
        </div>
      )}

      {/* ---- end card */}
      {endK > 0 && (
        <>
          <div style={{position: 'absolute', left: 960 - 900, top: 430 - 900, width: 1800, height: 1800, opacity: endK * 0.9, background: 'radial-gradient(circle, rgba(224,163,59,0.16) 0%, rgba(224,163,59,0.04) 30%, rgba(0,0,0,0) 55%)'}} />
          <div style={{position: 'absolute', left: logoX - logoS / 2, top: logoY - logoS / 2}}>
            <KaiLogo size={logoS} glint={glint} glow={endK} ring={1} />
          </div>
          <div style={{position: 'absolute', top: 644, left: 0, right: 0, textAlign: 'center', opacity: tag, transform: `translateY(${(1 - tag) * 24}px)`}}>
            <div style={{fontFamily: F.inter, fontWeight: 700, fontSize: 40, color: C.cream, letterSpacing: '0.01em'}}>
              Amazon KDP Publishing <span style={{color: C.gold}}>·</span> Formatting <span style={{color: C.gold}}>·</span> Covers <span style={{color: C.gold}}>·</span> Keywords{' '}
              <span style={{color: C.gold}}>·</span> A+ Content
            </div>
          </div>
          <div style={{position: 'absolute', top: 742, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: line2, transform: `translateY(${(1 - line2) * 20}px)`}}>
            <div style={{padding: '14px 34px', borderRadius: 999, border: `2px solid ${C.gold}`, fontFamily: F.inter, fontWeight: 700, fontSize: 33, color: C.gold}}>Message me before you upload.</div>
          </div>
        </>
      )}

      <Sfx at={t0 - 0.35} name="whoosh_in" volume={0.4} />
      <Sfx at={tUpload - 0.1} name="hover" volume={0.35} />
      <Sfx at={at(16, 'amazon') - 0.05} name="pop1" volume={0.45} />
      <Sfx at={tKdp + 0.15} name="zoom_through" volume={0.45} />
      <Sfx at={tKdp + 0.6} name="typing" volume={0.4} />
      <Sfx at={tSend - 0.02} name="send" volume={0.55} />
      <Sfx at={tSend + 0.45} name="pop2" volume={0.3} />
      <Sfx at={tSend + 0.62} name="pop3" volume={0.3} />
      <Sfx at={tOnly - 0.25} name="whoosh_soft" volume={0.3} />
      <Sfx at={END_CARD - 0.25} name="whoosh_logo" volume={0.4} />
      <Sfx at={END_CARD + 0.45} name="glint" volume={0.5} />
    </AbsoluteFill>
  );
};
