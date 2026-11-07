// Builds the single-file website: website/index.html (everything inlined, no server needed).
//   node scripts/build-static.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
// Inline scripts must never contain a literal "</script".
const js = (code) => code.replace(/<\/script/gi, '<\\/script');

let html = read('public', 'index.html');
const swap = (from, to) => {
  if (!html.includes(from)) throw new Error(`build-static: not found in index.html: ${from}`);
  html = html.replace(from, () => to);
};

const favicon = 'data:image/svg+xml;base64,' + Buffer.from(read('public', 'favicon.svg')).toString('base64');
swap('<link rel="manifest" href="/manifest.webmanifest">\n', '');
swap('<link rel="icon" href="/favicon.svg" type="image/svg+xml">', `<link rel="icon" href="${favicon}" type="image/svg+xml">`);
swap('<link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png">\n', '');
swap('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">\n', '');
swap('<link rel="stylesheet" href="/styles.css">', `<style>\n${read('public', 'styles.css')}\n</style>`);
swap('<script src="/boot.js"></script>', `<script>\n${js(read('public', 'boot.js'))}\n</script>`);
swap('<script src="/vendor/marked.umd.js"></script>', `<script>\n${js(read('public', 'vendor', 'marked.umd.js'))}\n</script>`);
swap('<script src="/vendor/purify.min.js"></script>', `<script>\n${js(read('public', 'vendor', 'purify.min.js'))}\n</script>`);
swap('<script src="/vendor/highlight.min.js"></script>', `<script>\n${js(read('public', 'vendor', 'highlight.min.js'))}\n</script>`);
swap('<script type="module" src="/app.js"></script>',
  `<script>\n${js(read('static', 'config.js'))}\n</script>\n` +
  `<script>\n${js(read('static', 'backend.js'))}\n</script>\n` +
  `<script type="module">\n${js(read('public', 'app.js'))}\n</script>`);

// Settings block at the very top of the file, easy to find.
html = html.replace('<!doctype html>', '<!doctype html>\n<!-- ChatGPT — single-file website. Upload this file anywhere (Netlify Drop, GitHub Pages, any host). Optional AI keys: search for CHATGPT_CONFIG below. -->');

const out = path.join(ROOT, 'website', 'index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`built ${path.relative(ROOT, out)} (${Math.round(html.length / 1024)} KB)`);
