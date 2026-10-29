import {Config} from '@remotion/cli/config';

// Use the Chromium that ships with this environment instead of downloading one.
Config.setBrowserExecutable(
  process.env.REMOTION_BROWSER ??
    '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
);
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
// 'swangle' mis-composites some 3D-tilted layers (stale bands); 'angle' renders them correctly.
Config.setChromiumOpenGlRenderer('angle');
Config.setConcurrency(4);
