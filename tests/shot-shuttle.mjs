// EVIDENCE — THE HANGAR SHUTTLE. Matched stations, before and after.
//
//   node tests/shot-shuttle.mjs shuttle-before
//   node tests/shot-shuttle.mjs shuttle-after
//
// Three jobs, and only the third is new:
//
//   1. STATIONS. The same player positions in both power states, so the craft
//      can be compared at rest.
//   2. A PAN. The human complaint is TEMPORAL: the long diagonals crawl as the
//      camera moves. A still cannot show that, so the rig walks the player past
//      the shuttle in fixed steps and photographs every step. Consecutive
//      frames are the evidence.
//   3. THE EDGE CADENCE, MEASURED. `edge-cadence.json` is the outer silhouette
//      x of every row of `prop-shuttle`, straight out of the texture, plus the
//      per-row deltas. An edge whose delta sequence has no period is exactly
//      the thing that crawls; this is that claim as a number rather than as a
//      screenshot.
//
// As in `shot-hangar`: a station is a PLAYER position (the camera follows and
// clamps), and every frame is taken on a PAUSED scene.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

// MEAN LUMINANCE OF THE PLAYFIELD, decoded from the PNG the shutter produced.
//
// This exists because the shutter lies. Across the baseline run and three
// rebuilds, roughly one station frame in twenty came back with a correct HUD
// over a black or half-faded playfield — a room that blacks out on its own
// clock (sector 30 carries the DARKNESS modifier), a HUD overlay mid-fade, and
// a paused scene whose first paused frame the screenshot can beat. Every one of
// those reads exactly like a rendering bug in whatever is being photographed,
// and one of them cost a round of chasing a bug that was not there. The rig
// checks its own frame now and re-takes it.
function meanLuma(buf, y0, y1) {
  let i = 8, w = 0, h = 0, bpp = 4, idat = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i), typ = buf.toString('ascii', i + 4, i + 8);
    if (typ === 'IHDR') {
      w = buf.readUInt32BE(i + 8); h = buf.readUInt32BE(i + 12);
      bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[buf[i + 17]];
    } else if (typ === 'IDAT') idat.push(buf.subarray(i + 8, i + 8 + len));
    else if (typ === 'IEND') break;
    i += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * bpp;
  let prev = Buffer.alloc(stride), p = 0, sum = 0, n = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++], line = Buffer.from(raw.subarray(p, p + stride)); p += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255;
      else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    if (y >= y0 && y < y1) {
      for (let x = 0; x < w; x++) {
        const o = x * bpp;
        sum += 0.299 * line[o] + 0.587 * line[o + 1] + 0.114 * line[o + 2]; n++;
      }
    }
    prev = line;
  }
  return n ? sum / n : 0;
}

const TAG = process.argv[2] || 'shuttle-after';
const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = `docs/evidence/arena-pilot/${TAG}`;
mkdirSync(OUT, { recursive: true });

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

await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { ENDLESS } = await import('/src/config.js');
  gs.sector = 6 * ENDLESS.bossEvery;
  gs.loadRoom(ROOMS.find((r) => r.id === 'hangar'));
  await new Promise((r) => setTimeout(r, 2200));
  gs.player.hp = gs.player.hpMax; gs.lives = 9999;
  gs._sectorTint?.setAlpha(0);
});
await page.waitForTimeout(4200);

const clearAll = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.player.hp = gs.player.hpMax;
});
const hush = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss, F = 1e9;
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!b) return;
  b._blackoutT = F; b._afterimageT = F; b._disarmT = F; b._sunderT = F;
  b._reflectT = F; b.cooldown = F; b._moveT = F; b._attackT = F;
  b.hp = b.hpMax; gs.player.hp = gs.player.hpMax;
});
let lastStage = null;
const place = (px, py, bx, by) => {
  lastStage = [px, py, bx, by];
  return _place(px, py, bx, by);
};
const _place = (px, py, bx, by) => page.evaluate(([x, y, ox, oy]) => {
  const gs = window.game.scene.getScene('Game');
  gs.player.setPosition(x, y); gs.player.setVelocity(0, 0);
  if (gs.boss?.alive && ox != null) { gs.boss.setPosition(ox, oy); gs.boss.setVelocity(0, 0); }
  gs.cameras.main.centerOn(x, y);
}, [px, py, bx, by]);
const pause = (on) => page.evaluate((f) => {
  const gs = window.game.scene.getScene('Game');
  if (f) gs.scene.pause(); else gs.scene.resume();
}, on);
// A PAUSED SCENE STILL RENDERS, but the shutter can beat the first paused
// frame to the canvas — two frames across the baseline run came back with a
// correct HUD over a black playfield. Give it a beat before the screenshot.
// A lit hangar measures ~28 and a LIGHTS OUT one ~5. A frame that comes back
// under the floor for its state is one of the artefacts above, not the room.
const shot = async (n, floor = 0) => {
  let buf, lum = 0;
  for (let tries = 0; tries < 4; tries++) {
    await page.waitForTimeout(180);
    buf = await page.screenshot();
    lum = meanLuma(buf, 90, 900);
    if (lum >= floor) break;
    // RE-STAGE, don't just resume. The scene has to run for the room to leave
    // whatever state produced the bad frame, and a running scene lets the
    // camera drift off the station — which turns a matched pair into two
    // frames of the same room from slightly different places.
    await pause(false);
    await page.waitForTimeout(240);
    if (lastStage) await _place(...lastStage);
    await page.waitForTimeout(120);
    await pause(true);
  }
  writeFileSync(`${OUT}/${n}.png`, buf);
  console.log('  ', n, lum < floor ? `STILL DARK ${lum.toFixed(1)}` : '');
};
const FLOOR = (state) => (state === 'lightsout' ? 2.5 : 18);
const setDark = (on) => page.evaluate((d) => {
  const gs = window.game.scene.getScene('Game');
  const hud = window.game.scene.getScene('HUD');
  if (d) {
    gs._enterDarkArena(); gs._darkChain?.stop?.();
    gs._darkMix.v = 1; gs._applyDarkMix();
    hud.setDarkness(true, 'blackout');
    hud._darkTweens.blackout?.stop?.(); hud._overlays.blackout.setAlpha(1);
  } else {
    gs._darkChain?.stop?.();
    if (gs._darkMix) gs._darkMix.v = 0;
    gs._applyDarkMix(); gs._restoreArenaTints();
    hud.setDarkness(false, 'blackout');
    // AND FORCE THE OVERLAY TO ZERO. `setDarkness(false)` starts a FADE, and
    // the shutter beats it: this room carries the DARKNESS modifier at sector
    // 30 and blacks out on its own clock, so a run that only asks politely
    // comes back with frames caught mid-fade — a correct HUD over a playfield
    // that is uniformly dark including its own emissive layer, which reads
    // exactly like a bug in whatever was being photographed.
    hud._darkTweens.blackout?.stop?.();
    hud._overlays.blackout?.setAlpha(0);
  }
}, on);
const cast = (id) => page.evaluate((f) => {
  const gs = window.game.scene.getScene('Game');
  return !!gs._castBossMove?.(gs.boss, f);
}, id);

// ── 3. THE EDGE CADENCE, straight out of the texture.
const cadence = await page.evaluate(() => {
  const src = window.game.textures.get('prop-shuttle').getSourceImage();
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  cv.getContext('2d').drawImage(src, 0, 0);
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const rows = [];
  for (let y = 0; y < cv.height; y++) {
    let lo = -1, hi = -1;
    for (let x = 0; x < cv.width; x++) {
      if (d[(y * cv.width + x) * 4 + 3] > 8) { if (lo < 0) lo = x; hi = x; }
    }
    rows.push({ y, lo, hi });
  }
  const solid = rows.filter((r) => r.hi >= 0);
  const dR = [], dL = [];
  for (let i = 1; i < solid.length; i++) {
    dR.push(solid[i].hi - solid[i - 1].hi);
    dL.push(solid[i - 1].lo - solid[i].lo);
  }
  // A cadence is REGULAR when its delta sequence is made of long runs of one
  // value. Count the transitions: every place the delta changes is a place the
  // staircase changes rhythm, and it is the density of those that crawls.
  const breaks = (a) => a.reduce((n, v, i) => n + (i && v !== a[i - 1] ? 1 : 0), 0);
  return {
    size: { w: cv.width, h: cv.height },
    rows: solid.length,
    right: { deltas: dR, breaks: breaks(dR), distinct: [...new Set(dR)].sort((a, b) => a - b) },
    left: { deltas: dL, breaks: breaks(dL), distinct: [...new Set(dL)].sort((a, b) => a - b) },
    widths: solid.map((r) => r.hi - r.lo + 1),
  };
});
writeFileSync(`${OUT}/edge-cadence.json`, JSON.stringify(cadence, null, 1));
console.log(`edge cadence: ${cadence.rows} solid rows, right breaks ${cadence.right.breaks}` +
            ` / left ${cadence.left.breaks}, deltas ${JSON.stringify(cadence.right.distinct)}`);

// ── 1. STATIONS.
const STATIONS = [
  ['close',   420,  560],   // the craft, centred
  ['mid',     560,  820],   // the craft in its half of the room
  ['north',   420,  300],   // the approach, blast door above it
  ['apron',   700,  620],   // from the combat floor, three-quarter
  ['wide',    900,  900],   // the whole room, shuttle as a landmark
];

for (const state of ['normal', 'lightsout']) {
  console.log(`— ${state} —`);
  await clearAll(); await setDark(state === 'lightsout'); await page.waitForTimeout(300);
  for (const [name, px, py] of STATIONS) {
    await place(px, py);
    await page.waitForTimeout(200);
    // RE-ASSERT THE POWER STATE ON EVERY SHUTTER. Sector 30 carries the
    // DARKNESS modifier and the room blacks out on its own clock, so a run
    // that sets the state once comes back with two or three frames caught
    // mid-transition — which reads exactly like a rendering bug in whatever
    // was being photographed.
    await setDark(state === 'lightsout');
    await pause(true); await shot(`${state}-${name}`, FLOOR(state)); await pause(false);
    await clearAll();
  }

  // ── 2. THE PAN. Fixed steps past the craft: consecutive frames ARE the
  //     temporal evidence, so the step is small and the count is high.
  console.log(`— ${state} pan —`);
  for (let i = 0; i < 10; i++) {
    await place(380 + i * 14, 560);
    await page.waitForTimeout(140);
    await setDark(state === 'lightsout');
    await pause(true); await shot(`${state}-pan-${String(i).padStart(2, '0')}`, FLOOR(state)); await pause(false);
  }
}

// ── VADER, AS AN INSTRUMENT.
await setDark(false); await page.waitForTimeout(200);
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  if (!gs.boss?.alive) { gs.spawnBoss(700, 700); await new Promise((r) => setTimeout(r, 800)); }
});
await hush(); await page.waitForTimeout(300);

for (const state of ['normal', 'lightsout']) {
  await pause(false); await hush(); await setDark(state === 'lightsout');
  await page.waitForTimeout(250);
  console.log(`— vader / ${state} —`);

  await place(420, 660, 420, 420);
  await page.waitForTimeout(180);
  await pause(true); await shot(`${state}-vader-shuttle`, FLOOR(state)); await pause(false); await hush();

  await place(420, 760, 420, 480);
  await page.waitForTimeout(120);
  await cast('saberThrow');
  await page.waitForTimeout(340);
  await pause(true); await shot(`${state}-saber-throw-shuttle`); await pause(false);
  await hush(); await page.waitForTimeout(500);
}

// THE DARK COMPOSITION: door and shuttle in one frame, and the same room with
// the door off screen — the question §17 asks is whether the hangar still has
// an identity in the dark once its landmark wall is behind you.
await setDark(true); await hush(); await page.waitForTimeout(250);
await place(420, 420, 900, 900);
await page.waitForTimeout(200);
await pause(true); await shot('lightsout-door-and-shuttle', 2.5); await pause(false); await hush();
await place(300, 1100, 900, 900);
await page.waitForTimeout(200);
await pause(true); await shot('lightsout-door-offscreen', 2.5); await pause(false);

console.log(`\nwrote ${OUT}`);
await browser.close();
