import React, {createContext, useContext} from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {f} from '../timeline';
import {FPS} from '../theme';

export const FromCtx = createContext(0);

/**
 * A scene mounted between absolute times start..end (seconds), with optional
 * handles before/after for overlapping transitions. Children read absolute time
 * with useT(), so every animation can reference voiceover word times directly.
 */
export const Scene: React.FC<{
  start: number;
  end: number;
  pre?: number;
  post?: number;
  name?: string;
  children: React.ReactNode;
}> = ({start, end, pre = 0, post = 0, name, children}) => {
  const from = Math.max(0, f(start - pre));
  return (
    <Sequence from={from} durationInFrames={Math.max(1, f(end + post) - from)} name={name}>
      <FromCtx.Provider value={from}>
        <AbsoluteFill>{children}</AbsoluteFill>
      </FromCtx.Provider>
    </Sequence>
  );
};

/** Absolute time in seconds (works inside and outside <Scene>). */
export const useT = () => {
  const frame = useCurrentFrame();
  const from = useContext(FromCtx);
  return (frame + from) / FPS;
};
