import React, {useContext} from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import {f} from '../timeline';
import {FromCtx} from './Scene';

/**
 * A sound effect placed at an absolute time (seconds). Lives next to the visual
 * event it belongs to, so moving an animation moves its sound with it.
 */
export const Sfx: React.FC<{at: number; name: string; volume?: number; rate?: number}> = ({at, name, volume = 0.5, rate = 1}) => {
  const sceneFrom = useContext(FromCtx);
  const from = f(at) - sceneFrom;
  if (from < 0) return null;
  return (
    <Sequence from={from} layout="none" name={`sfx:${name}`}>
      <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} playbackRate={rate} />
    </Sequence>
  );
};
