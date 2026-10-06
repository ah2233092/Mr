// Render transparent graphics layers.  node render_gfx.js <outdir> <a> <b> [dpr] [frames,comma,list]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const [,, out, a, b, dpr = '2', list] = process.argv;
const FPS = 30;
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync('pipeline/graphics.html', 'utf8').replace('__EDL__', fs.readFileSync('build/edl.json', 'utf8'));
fs.writeFileSync('pipeline/_graphics_built.html', html);
(async () => {
  const br = await chromium.launch();
  const p = await br.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: +dpr });
  p.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
  await p.goto('file://' + path.resolve('pipeline/_graphics_built.html'));
  await p.evaluate(() => window.ready);
  fs.writeFileSync(path.join(out, 'cues.json'), JSON.stringify(await p.evaluate(() => window.CUES)));
  const frames = list ? list.split(',').map(Number) : [...Array(+b - +a).keys()].map(i => i + +a);
  const t0 = Date.now();
  for (const n of frames) {
    for (const layer of ['back', 'front']) {
      const f = path.join(out, `${layer}_${String(n).padStart(5, '0')}.png`);
      if (fs.existsSync(f) && !list) continue;
      await p.evaluate(([t, l]) => renderLayer(t, l), [n / FPS, layer]);
      await p.screenshot({ path: f, omitBackground: true });
    }
    if (n % 100 === 0) console.log(n, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await br.close();
  console.log('done', frames.length);
})();
