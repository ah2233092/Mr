// Render a list of frames (or seconds) to PNG for visual review, bundling once.
// usage: node scripts/stills.mjs <outDir> <t1> <t2> ...   (t in seconds, or "f123" for a frame)
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

const [outDir, ...times] = process.argv.slice(2);
fs.mkdirSync(outDir, {recursive: true});
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const composition = await selectComposition({serveUrl, id: process.env.COMP ?? 'KAIGigVideo', browserExecutable});
for (const tt of times) {
  const frame = tt.startsWith('f') ? parseInt(tt.slice(1), 10) : Math.round(parseFloat(tt) * 30);
  const output = path.join(outDir, `f${String(frame).padStart(5, '0')}.png`);
  await renderStill({serveUrl, composition, frame, output, browserExecutable, chromiumOptions: {gl: process.env.GL ?? 'angle'}});
  console.log(output);
}
