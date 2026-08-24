// EVIDENCE — LIGHTS OUT as a DARK ARENA, not a vignette.
//
// Photographs the production sequence at encounter 6 and measures the
// transformation on a FROZEN frame, so the before and after shots are the same
// room rather than two moments of a live fight.
//
// Three things this rig exists to prove and one it exists to disprove:
//   - the ENVIRONMENT darkens (backdrop, walls, props)
//   - the CONSOLES stay comparatively lit — the islands of remaining power
//   - COMBAT presentation (saber, bolts, telegraphs) is untouched
//   - and no circular vignette geometry is legible in a still frame
//
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'docs/evidence/dark-arena';

// Chromium screenshots are colour type 2 (RGB, 3 bytes/px), not RGBA.
function decodePNG(buf) {
  let p = 8, w = 0, h = 0, ct = 6; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); ct = buf[p + 17]; }
    if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
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
  await new Promise((r) => setTimeout(r, 2200));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) { gs.spawnBoss(900, 900); await new Promise((r) => setTimeout(r, 700)); }
  gs.player.hp = gs.player.hpMax; gs.lives = 9999;
  const b = gs.boss, FAR = 1e9;
  // Silence every free-running clock: this rig photographs ONE mechanic and a
  // stray SUNDER or a hurt flash would photograph a different frame.
  b._blackoutT = FAR; b._afterimageT = FAR; b._disarmT = FAR; b._sunderT = FAR; b._reflectT = FAR;
  b.cooldown = FAR; b._moveT = FAR;
});
await page.waitForTimeout(600);

const R = {};
const place = (x, y) => page.evaluate(([px, py]) => {
  const gs = window.game.scene.getScene('Game');
  gs.player.setPosition(px, py); gs.player.setVelocity(0, 0);
  if (gs.boss?.alive) gs.boss.setPosition(px + 300, py - 120);
  gs.cameras.main.centerOn(px, py);   // no lerp — a photograph must not chase
}, [x, y]);
const freeze = (on) => page.evaluate((f) => {
  const gs = window.game.scene.getScene('Game');
  if (f) { gs.scene.pause(); } else { gs.scene.resume(); }
}, on);
const hush = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss, FAR = 1e9;
  if (!b) return;
  b._blackoutT = FAR; b._afterimageT = FAR; b._disarmT = FAR; b._sunderT = FAR;
  b._reflectT = FAR; b.cooldown = FAR; b._moveT = FAR; b._attackT = FAR;
  b.hp = b.hpMax; gs.player.hp = gs.player.hpMax;
});
const shot = async (name) => { writeFileSync(`${OUT}/${name}.png`, await page.screenshot()); return name; };

// ══ 1. THE MATCHED A/B, on one frozen frame ═════════════════════════════
await place(800, 800);
await page.waitForTimeout(500);
await freeze(true);
const lit = decodePNG(await page.screenshot());
writeFileSync(`${OUT}/ab-1-lights-on.png`, await page.screenshot());
// Force the arena state to full darkness with no tween — same frame, one change.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs._enterDarkArena();
  gs._darkChain?.stop?.();
  gs._darkMix.v = 1; gs._applyDarkMix();
  const hud = window.game.scene.getScene('HUD');
  hud.setDarkness(true, 'blackout');
  hud._darkTweens.blackout?.stop?.();
  hud._overlays.blackout.setAlpha(1);
});
await page.waitForTimeout(120);
const dark = decodePNG(await page.screenshot());
writeFileSync(`${OUT}/ab-2-lights-out.png`, await page.screenshot());

const REG = {
  'centre (player)':     [260, 580, 460, 780],
  'ring 200px':          [160, 480, 560, 560],
  'ring 300px':          [ 60, 380, 660, 460],
  'edge mid-left':       [  0, 580, 160, 780],
  'edge mid-right':      [560, 580, 720, 780],
  'top strip':           [260, 100, 460, 260],
  'bottom strip':        [260,1100, 460,1260],
  'corner top-left':     [  0,  84, 180, 264],
  'corner bottom-right': [540,1100, 720,1280],
  'game viewport (all)': [  0,  84, 720,1280],
};
R.ab = {};
for (const [k, r] of Object.entries(REG)) {
  const a = lum(lit, ...r), b = lum(dark, ...r);
  R.ab[k] = { lit: +a.toFixed(2), dark: +b.toFixed(2), darker: +((1 - b / a) * 100).toFixed(1) };
}
// Restore, unfrozen.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs._darkMix.v = 0; gs._applyDarkMix(); gs._restoreArenaTints();
  window.game.scene.getScene('HUD').setDarkness(false, 'blackout');
});
await freeze(false);
await page.waitForTimeout(400);

// ══ 2. THE VIGNETTE'S OWN PROFILE — is a circle legible? ════════════════
R.vignette = await page.evaluate(async () => {
  const { DARKNESS } = await import('/src/config.js');
  const hud = window.game.scene.getScene('HUD');
  hud._ensureOverlay('blackout');
  const img = window.game.textures.get('darkness-blackout').getSourceImage();
  const ctx = img.getContext('2d');
  const cx = img.width / 2, cy = img.height / 2;
  // SAMPLE ALONG THE DIAGONAL. The overlay is exactly VIEW-sized, so a
  // horizontal walk from centre runs out of canvas at 360px and every radius
  // past it silently reads 0 — which looks exactly like a gradient that was
  // never painted. Cost a round.
  const k = 1 / Math.hypot(720, 1280);
  const at = (r) => {
    const x = Math.round(cx + r * 720 * k), y = Math.round(cy + r * 1280 * k);
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return null;
    return +(ctx.getImageData(x, y, 1, 1).data[3] / 255).toFixed(3);
  };
  return {
    size: [img.width, img.height],
    cfg: DARKNESS.blackout,
    samples: Object.fromEntries([0, 100, 200, 300, 360, 450, 550, 640, 730].map((r) => [r, at(r)])),
    tracked: typeof hud._trackBlackout === 'function',   // must be false now
    padded: img.width !== 720 || img.height !== 1280,     // must be false now
  };
});

// ══ 3. THE PRODUCTION SEQUENCE ══════════════════════════════════════════
const bossAct = (fn) => page.evaluate((f) => {
  const gs = window.game.scene.getScene('Game');
  gs._castBossMove?.(gs.boss, f);
}, fn);

// Re-silence: the A/B pause/resume above lets a cycle of his clocks land.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss, FAR = 1e9;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (b) { b._blackoutT = FAR; b._afterimageT = FAR; b._disarmT = FAR; b._sunderT = FAR;
           b._reflectT = FAR; b.cooldown = FAR; b._moveT = FAR; b.hp = b.hpMax; }
  gs.player.hp = gs.player.hpMax;
  gs.clearTelegraphs?.();
});
await place(800, 800); await page.waitForTimeout(400);
R.shots = [];
await hush();
R.shots.push(await shot('seq-01-normal-arena'));

R.verdicts = [];
R.verdicts.push(await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  return { v: gs.requestLightsOut('blackout'), state: gs._lightsState, bossAlive: !!gs.boss?.alive };
}));
await page.waitForTimeout(70);
R.shots.push(await shot('seq-02-power-failure'));
await page.waitForTimeout(500);
await hush();
R.shots.push(await shot('seq-03-dark-arena'));

// Saber throw through the dark — the crimson lane against a dead room.
await bossAct('SABER THROW');
await page.waitForTimeout(420);
R.shots.push(await shot('seq-04-saber-throw-in-the-dark'));

// Projectile combat: the player's own bolts as bright moving points.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  for (let i = 0; i < 4; i++) gs.player.tryFire(0.2 + i * 0.06);
});
await page.waitForTimeout(90);
await hush();
R.shots.push(await shot('seq-05-projectiles-in-the-dark'));

// ── POSITION COHERENCE. The 2.6s event is long since over by the time four
//    placements and their round trips have run, so the arena state is FORCED
//    here rather than requested: these shots are about overlay geometry at the
//    camera clamp, not about cadence, and a deferred request would photograph
//    a lit room. Forced through the same two entry points the owner uses.
const forceDark = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs._clearLightsOut();
  gs._enterDarkArena();
  gs._darkChain?.stop?.(); gs._darkMix.v = 1; gs._applyDarkMix();
  const hud = window.game.scene.getScene('HUD');
  hud.setDarkness(true, 'blackout');
  hud._darkTweens.blackout?.stop?.(); hud._overlays.blackout.setAlpha(1);
});
await forceDark();
// The consoles. Four cover pillars at the arena corners — park next to one.
await place(400, 400);   await page.waitForTimeout(350); await hush();
R.shots.push(await shot('seq-06-consoles-still-powered'));
// Where the old pocket stranded the player, and where a screen-space overlay
// would show its seams: the game camera CLAMPS at the arena bounds.
await place(140, 140);   await page.waitForTimeout(350); await hush();
R.shots.push(await shot('seq-06b-corner-top-left'));
await place(1460, 1460); await page.waitForTimeout(350); await hush();
R.shots.push(await shot('seq-06c-corner-bottom-right'));
await place(800, 150);   await page.waitForTimeout(350); await hush();
R.shots.push(await shot('seq-06d-top-edge'));

await page.evaluate(() => window.game.scene.getScene('Game')._clearLightsOut());
await page.waitForTimeout(500);

// ── ECLIPSE: the composition, through the owner's own path.
await place(800, 800);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs._clearLightsOut();          // clear the forced state, then ask for real
  gs.boss._eclipse = true;
  gs.requestLightsOut('eclipse');
});
await hush();
await page.waitForTimeout(700);
R.eclipseClones = await page.evaluate(() =>
  window.game.scene.getScene('Game').enemies.getChildren().filter((e) => e.alive && e._afterimage).length);
await hush();
R.shots.push(await shot('seq-07-eclipse'));
await page.waitForTimeout(300);
await hush();
R.shots.push(await shot('seq-08-eclipse-hold'));

// ── restoration
await page.evaluate(() => window.game.scene.getScene('Game')._endLightsOut());
await page.waitForTimeout(200);
await hush();
R.shots.push(await shot('seq-09-lights-returning'));
await page.waitForTimeout(700);
await hush();
R.shots.push(await shot('seq-10-normal-arena-again'));

// ── the tints came back exactly
R.restored = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  return {
    snapCleared: gs._darkSnap === null,
    tints: gs.roomLayer.getChildren().map((o) => ({
      cls: o._loClass || null, tinted: !!o.isTinted,
      tint: o.isTinted ? '#' + o.tintTopLeft.toString(16).padStart(6, '0') : null,
    })),
    sectorTintAlpha: gs._sectorTint?.fillAlpha ?? null,
    state: gs._lightsState, pending: gs._lightsPending,
  };
});

console.log(JSON.stringify(R, null, 2));
writeFileSync(`${OUT}/dark-arena.json`, JSON.stringify(R, null, 2));
await browser.close();
