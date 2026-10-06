// Render build/index.html frame-by-frame. usage: node render.js <outdir> [fps] [workers] [only "t1,t2,..."]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const [,, out, fpsArg, wArg, only] = process.argv;
const fps = +(fpsArg || 30), workers = +(wArg || 4);
fs.mkdirSync(out, { recursive: true });
const url = 'file://' + path.resolve('build/index.html');

async function page(browser) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
  await p.goto(url); await p.evaluate(() => window.ready);
  return p;
}
(async () => {
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--font-render-hinting=none'] });
  const probe = await page(browser);
  const info = await probe.evaluate(() => ({ dur: TL.duration, cues: CUES }));
  fs.writeFileSync(path.join(out, 'cues.json'), JSON.stringify(info.cues));
  let jobs;
  if (only) jobs = only.split(',').map((t, i) => ({ t: +t, file: `t_${t}.png` }));
  else {
    const n = Math.ceil(info.dur * fps), a = +(process.env.START || 0), b = +(process.env.END || n);
    jobs = [...Array(n).keys()].slice(a, b).map(i => ({ t: i / fps, file: `f_${String(i).padStart(6, '0')}.jpg` }));
  }
  const pages = [probe, ...await Promise.all([...Array(Math.min(workers, jobs.length) - 1)].map(() => page(browser)))];
  let next = 0, done = 0; const t0 = Date.now();
  await Promise.all(pages.map(async p => {
    while (next < jobs.length) {
      const j = jobs[next++];
      await p.evaluate(t => renderAt(t), j.t);
      const opts = { path: path.join(out, j.file) };
      if (j.file.endsWith('.jpg')) opts.quality = 94;
      await p.screenshot(opts);
      if (++done % 300 === 0) console.log(`${done}/${jobs.length} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }));
  await browser.close();
  console.log('frames', jobs.length, 'in', ((Date.now() - t0) / 1000).toFixed(0) + 's');
})();
