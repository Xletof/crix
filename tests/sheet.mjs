// COMPARISON SHEETS. Lays N screenshots side by side with a caption under each
// and photographs the result, so a matched pair is one file a human can look at
// rather than two they have to alt-tab between.
//
//   node tests/sheet.mjs docs/evidence/.../compare-x.png  BEFORE:a.png  AFTER:b.png
//
// Playwright is the renderer because it is already a dependency and because the
// alternative is adding an image library to a project that has none.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';

const [out, ...pairs] = process.argv.slice(2);
if (!out || !pairs.length) { console.error('usage: node tests/sheet.mjs OUT.png LABEL:PATH ...'); process.exit(1); }

const cells = pairs.map((p) => {
  const i = p.indexOf(':');
  const label = i > 0 ? p.slice(0, i) : basename(p, extname(p));
  const path = i > 0 ? p.slice(i + 1) : p;
  return { label, src: `data:image/png;base64,${readFileSync(path).toString('base64')}` };
});

const W = 400;
const html = `<!doctype html><style>
  body{margin:0;background:#101014;font:600 15px/1.4 ui-monospace,monospace;color:#cfd6e2;display:flex;align-items:flex-start;gap:14px;padding:14px}
  figure{margin:0}
  img{width:${W}px;display:block;border:1px solid #2a2f3a}
  figcaption{padding:8px 2px 0;letter-spacing:.06em}
</style>` + cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.label}</figcaption></figure>`).join('');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage({ viewport: { width: cells.length * (W + 14) + 14, height: 1280 } });
await page.setContent(html);
await page.waitForTimeout(300);
// Size the shot to the content rather than to the viewport: `fullPage` on a
// fixed 1280 viewport pads every sheet with half a screen of empty background.
//
// Two things had to be true before the measurement was worth taking. The page
// needs a DOCTYPE — `setContent` without one is quirks mode, where body's
// height is the viewport's — and the flex row needs `align-items: flex-start`,
// or every figure STRETCHES to the container's cross size and reports the
// viewport height back as its own.
const h = await page.evaluate(() => Math.ceil(Math.max(
  ...[...document.querySelectorAll('figure')].map((f) => f.getBoundingClientRect().bottom))) + 14);
await page.setViewportSize({ width: cells.length * (W + 14) + 14, height: h });
await page.waitForTimeout(150);
await page.screenshot({ path: out });
await browser.close();
console.log(out);
