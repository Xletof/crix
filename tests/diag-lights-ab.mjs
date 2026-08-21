// LIGHTS OUT, A/B on ONE FROZEN FRAME.
// Same camera, same content, overlay down vs overlay fully up. The only
// difference between the two images is the mechanic.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'docs/evidence/mech-truth';

function decodePNG(buf) {
  let p = 8, w = 0, h = 0, ct = 6; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); ct = buf[p + 17]; }
    if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  // Chromium screenshots are colour type 2 (RGB, 3 bytes/px), not RGBA.
  // Assuming 4 here silently shears every row and the luminance numbers come
  // back inverted — the darkened frame measured BRIGHTER than the lit one.
  const bpp = ct === 2 ? 3 : 4, stride = w * bpp; const out = Buffer.alloc(h * stride); let o = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[o++]; const line = raw.subarray(o, o + stride); o += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
  }
  return { w, h, bpp, px: out };
}
const lum = ({ w, bpp, px }, x0, y0, x1, y1) => {
  let s = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * w + x) * bpp; s += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; n++;
  }
  return s / n;
};
// Regions inside the GAME viewport only (y >= 84).
const R = {
  'centre (player/Vader)': [260, 580, 460, 780],
  'inner ring 300px':      [110, 430, 310, 630],
  'edge mid-left':         [0, 580, 160, 780],
  'edge mid-right':        [560, 580, 720, 780],
  'top strip':             [260, 100, 460, 260],
  'bottom strip':          [260, 1100, 460, 1260],
  'corner top-left':       [0, 84, 180, 264],
  'corner bottom-right':   [540, 1100, 720, 1280],
  'game viewport (all)':   [0, 84, 720, 1280],
};

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));
await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 777 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { ENDLESS } = await import('/src/config.js');
  gs.sector = 6 * ENDLESS.bossEvery;
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((r) => setTimeout(r, 2600));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) { gs.spawnBoss(gs.player.x, gs.player.y - 300); await new Promise((r) => setTimeout(r, 900)); }
  gs.player.hp = gs.player.hpMax; gs.lives = 9999;
  const b = gs.boss, FAR = 1e9;
  b._blackoutT = FAR; b._afterimageT = FAR; b._disarmT = FAR; b._sunderT = FAR; b._reflectT = FAR;
  b.cooldown = FAR; b._moveT = FAR;
});
await page.waitForTimeout(1400);

// FULL PROFILE of the vignette, sampled along +x, +y and the diagonal.
const profile = await page.evaluate(() => {
  const hud = window.game.scene.getScene('HUD');
  hud.setDarkness(true);
  const img = window.game.textures.get('darknessVignette').getSourceImage();
  const ctx = img.getContext('2d'); const w = img.width, h = img.height;
  const cx = w / 2, cy = h / 2;
  const a = (x, y) => ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data[3] / 255;
  const along = (dx, dy, max) => [];
  const line = (dx, dy, max, label) => {
    const rows = [];
    for (let r = 0; r <= max; r += 40) rows.push([r, +a(cx + dx * r, cy + dy * r).toFixed(3)]);
    return { label, rows };
  };
  const s = Math.SQRT1_2;
  return {
    horizontal: line(1, 0, 355, '+x, edge at 360'),
    vertical:   line(0, 1, 635, '+y, edge at 640'),
    diagonal:   line(s, s, 730, 'diagonal, corner at 734'),
  };
});

// Freeze the world, then A/B.
await page.evaluate(() => {
  const g = window.game;
  g.scene.getScene('Game').scene.pause();
  const hud = g.scene.getScene('HUD');
  hud.tweens.killTweensOf(hud.darknessOverlay);
  hud.darknessOverlay.setAlpha(0).setVisible(false);
});
await page.waitForTimeout(500);
const shotA = await page.screenshot(); writeFileSync(`${OUT}/ab-1-lights-on.png`, shotA);
await page.evaluate(() => {
  const hud = window.game.scene.getScene('HUD');
  hud.darknessOverlay.setVisible(true).setAlpha(1);   // the maximum the mechanic ever reaches
});
await page.waitForTimeout(500);
const shotB = await page.screenshot(); writeFileSync(`${OUT}/ab-2-lights-out.png`, shotB);

const A = decodePNG(shotA), B = decodePNG(shotB);
const rows = [];
for (const [name, r] of Object.entries(R)) {
  const a = lum(A, ...r), b = lum(B, ...r);
  rows.push({ region: name, lit: +a.toFixed(1), dark: +b.toFixed(1),
              drop: +(100 * (1 - b / (a || 1))).toFixed(1) });
}
console.log('\n=== vignette alpha profile (alpha 1.0 = the mechanic at full strength) ===');
for (const k of ['horizontal', 'vertical', 'diagonal']) {
  console.log(` ${profile[k].label.padEnd(24)} ${profile[k].rows.map(([r, v]) => `${r}:${v}`).join('  ')}`);
}
console.log('\n=== matched frame, same content, overlay 0 -> 1 ===');
console.log(' region                    lit    dark   darkened');
for (const r of rows) console.log(` ${r.region.padEnd(24)} ${String(r.lit).padStart(6)} ${String(r.dark).padStart(6)}   ${r.drop}%`);
writeFileSync(`${OUT}/ab.json`, JSON.stringify({ profile, rows }, null, 2));
await browser.close();
