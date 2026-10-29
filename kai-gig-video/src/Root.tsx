import React from 'react';
import {AbsoluteFill, Audio, Composition, Img, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource/alfa-slab-one';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/800.css';
import '@fontsource/playfair-display/900.css';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/700.css';
import {Captions} from './components/Captions';
import {Grain, Vignette} from './components/Overlays';
import {Scene} from './components/Scene';
import {S1Hook} from './scenes/S1Hook';
import {S2Twist} from './scenes/S2Twist';
import {S3Problems} from './scenes/S3Problems';
import {S4Turn} from './scenes/S4Turn';
import {S5Services} from './scenes/S5Services';
import {S6Proof} from './scenes/S6Proof';
import {S7Close} from './scenes/S7Close';
import {S8CTA} from './scenes/S8CTA';
import {CAPTIONS} from './captionPlan';
import {DURATION_S, f, S} from './timeline';
import {FPS, H, W} from './theme';

const Main: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <AbsoluteFill style={{background: '#0E1626'}}>
      {/* keep textures referenced by CSS warm in every render tab */}
      <Img src={staticFile('tex/paper.png')} style={{position: 'absolute', width: 1, height: 1, opacity: 0}} />
      <Scene start={S.hook[0]} end={S.hook[1]} post={0.1} name="1 Hook">
        <S1Hook />
      </Scene>
      <Scene start={S.twist[0]} end={S.twist[1]} pre={0.12} post={0.25} name="2 Twist">
        <S2Twist />
      </Scene>
      <Scene start={S.problems[0]} end={S.problems[1]} pre={0.2} post={0.6} name="3 Problems">
        <S3Problems />
      </Scene>
      <Scene start={S.turn[0]} end={S.turn[1]} pre={0.05} post={0.7} name="4 Turn">
        <S4Turn />
      </Scene>
      <Scene start={S.publish[0]} end={S.aplus[1]} pre={0.1} post={0.5} name="5 Services">
        <S5Services />
      </Scene>
      <Scene start={S.proof[0]} end={S.proof[1]} pre={0.35} post={0.4} name="6 Proof">
        <S6Proof />
      </Scene>
      <Scene start={S.close[0]} end={S.close[1]} pre={0.4} post={0.35} name="7 Close">
        <S7Close />
      </Scene>
      <Scene start={S.cta[0]} end={S.cta[1]} pre={0.35} name="8 CTA">
        <S8CTA />
      </Scene>
      <Captions t={t} opts={CAPTIONS} />
      <Vignette strength={0.62} />
      <Grain opacity={0.07} />
      <Audio src={staticFile('audio/vo.wav')} />
      <Audio src={staticFile('audio/music.wav')} />
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="KAIGigVideo" component={Main} durationInFrames={f(DURATION_S)} fps={FPS} width={W} height={H} />
  </>
);
