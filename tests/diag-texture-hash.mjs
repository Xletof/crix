// TEXTURE HASHES — the pixel proof that a visual pass changed only what it said.
//
//   node tests/diag-texture-hash.mjs > tests/out/tex-after.txt
//   git stash push -- src/  &&  node tests/diag-texture-hash.mjs > tests/out/tex-before.txt
//   git stash pop  &&  diff tests/out/tex-before.txt tests/out/tex-after.txt
//
// Every generated texture, hashed, plus one backdrop per room painted on
// demand. Reading a diff and believing it is not the same thing as hashing the
// pixels: this rig is what proved the arena passes did not leak into rooms they
// had never touched.
//
// RESEED BEFORE EVERY BACKDROP. `paintBackdrop` consumes `Math.random` for its
// panel and scorch scatter, so changing ONE room's counts shifts the stream for
// every backdrop painted after it — which photographs as three innocent rooms
// changing. The stub below replaces `Math.random` with an LCG that is reset for
// each paint, so each room's hash depends on that room's numbers and nothing
// else.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));
await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 909 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const rows = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { paintBackdrop } = await import('/src/systems/pixelArt.js');

  const hash = (key) => {
    const t = window.game.textures.get(key);
    const src = t.getSourceImage();
    if (!src || !src.width) return 'n/a';
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    cv.getContext('2d').drawImage(src, 0, 0);
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let h1 = 0x811c9dc5, h2 = 0x1000193;
    for (let i = 0; i < d.length; i++) {
      h1 = ((h1 ^ d[i]) * 16777619) >>> 0;
      h2 = ((h2 + d[i] * (i % 251 + 1)) * 2654435761) >>> 0;
    }
    return `${cv.width}x${cv.height} ${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
  };

  const out = [];
  for (const k of Object.keys(window.game.textures.list).sort()) {
    if (k === '__DEFAULT' || k === '__MISSING' || k === '__WHITE') continue;
    // Skip the noise: Phaser mints a UUID-keyed texture for every BitmapText
    // and Graphics object alive at the moment of the dump, and the live
    // `backdrop-*` textures were painted with an unseeded `Math.random` when
    // the room loaded. Neither is stable between runs and neither is authored.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(k)) continue;
    if (k.startsWith('bg-') || k.startsWith('backdrop-')) continue;
    out.push(`tex ${k} ${hash(k)}`);
  }

  // Backdrops, each on a fresh LCG.
  const real = Math.random;
  for (const r of ROOMS) {
    let s = 0x2f6e2b1;
    Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const key = `hashbg-${r.id}`;
    if (window.game.textures.exists(key)) window.game.textures.remove(key);
    paintBackdrop(gs, key, r.bounds.w, r.bounds.h, {
      base: r.floor?.base, line: r.floor?.line, panel: r.floor?.panel,
      ...r.floor,
    });
    out.push(`backdrop ${r.id} ${hash(key)}`);
  }
  Math.random = real;
  return out;
});

console.log(rows.join('\n'));
await browser.close();
