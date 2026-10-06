// usage: node render.js [out.png]  -> renders thumbnail.html at 3000x2250
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
let html = fs.readFileSync('thumbnail.html', 'utf8').replace(/\{\{([a-z-]+)\}\}/g, (_, n) => {
  let s = fs.readFileSync(`node_modules/lucide-static/icons/${n}.svg`, 'utf8');
  s = s.slice(s.indexOf('<svg')).replace(/<svg[^>]*>/, m => m.replace(/\s(class|width|height)="[^"]*"/g, ''));
  return s.replace(/\s+/g, ' ').replace(/`/g, '');
});
fs.writeFileSync('build.html', html);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1125 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
  await p.goto('file://' + path.resolve('build.html'));
  await p.evaluate(() => window.ready);
  await p.screenshot({ path: process.argv[2] || 'out.png' });
  await b.close();
})();
