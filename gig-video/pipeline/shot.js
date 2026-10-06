// node shot.js <html> <out.png> [dpr] [w] [h]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
const [,, html, out, dpr = '2', w = '1920', h = '1080'] = process.argv;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
  p.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
  await p.goto('file://' + path.resolve(html)); await p.evaluate(() => window.ready);
  await p.screenshot({ path: out }); await b.close();
})();
