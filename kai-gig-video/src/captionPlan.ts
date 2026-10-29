import {CaptionOpts} from './components/Captions';
import {lineEnd, lineStart, S} from './timeline';

const line = (i: number): [number, number] => [lineStart(i) - 0.1, lineEnd(i) + 0.2];

// Where word-timed captions give way to full-screen kinetic type, or move up.
export const CAPTIONS: CaptionOpts = {
  hide: [[S.hook[0], S.hook[1]], line(3), line(7), line(13), line(14), line(15), line(17)],
  raise: [],
};
