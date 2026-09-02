// EVIDENCE — THE REACTOR JUNCTION'S EMERGENCY LANE GUIDANCE, matched stations.
//
//   node tests/shot-junction-lanes.mjs junction-lanes-before
//   node tests/shot-junction-lanes.mjs junction-lanes-after
//   node tests/shot-junction-lanes.mjs junction-lanes-candB
//
// WHY A SECOND RIG. `shot-junction.mjs` is the approved art pass's evidence and
// its stations are the ones that verdict was given against; this pass asks a
// different question — does the room still read as a four-way junction with the
// power out — and it needs stations ON the four approaches, terminations at
// both ends of them, and a dark motion pan THROUGH them. Bolting those onto the
// approved rig would change the frames that were already reviewed.
//
// THE FOUR APPROACHES, from the room's own floor architecture:
//   WEST   region x  96..400, y 570..830   the artery, into the interchange
//   NORTH  region x 596..804, y  96..400   the service way, under the gate
//   EAST   region x1000..1304, y 620..780   the narrow control way
//   SPUR   region x1120..1280, y  96..430   the departure way, under the exit
// The crossing they meet on is x[400,1000] y[400,1000] and nothing this pass
// adds may stand in it.
//
// A STATION IS A PLAYER POSITION. The camera follows the player and clamps at
// the arena bounds; at 720x1196 of viewport inside 1400x1400 its centre is
// pinned inside x [360, 1040] and y [598, 802]. Every frame is taken on a
// PAUSED scene, with `_sectorTint` re-zeroed and the camera's flash reset at
// the shutter.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 'junction-lanes-after';
const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = `docs/evidence/arena-pilot/${TAG}`;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.addInitScript((c) => { window.__CAND = c; }, TAG.includes('candB') ? 'B' : 'A');
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
  // ── CANDIDATE B, WITHOUT A SOURCE EDIT. `loadRoom` takes a SPEC OBJECT, so
  //    a lighting candidate is a cloned spec with a different guide list — the
  //    same trick the topology pass used for its cover candidates. Both
  //    candidates are therefore measured and photographed by the same code on
  //    the same machine within minutes of each other, and the rejected one
  //    never enters `src/`.
  //
  //    B is DENSER AND SMALLER: three fixtures per approach instead of two,
  //    each shorter and dimmer. Same architecture, same edges, same colours,
  //    same crossing containment — only the density and the intensity move.
  let spec = ROOMS.find((r) => r.id === 'corridor');
  if (window.__CAND === 'B') {
    const B = [
      { kind: 'strip', guide: true, dir: 'h', x: 208, y: 596, len: 36, t: 4, color: 0x1c4653, hot: 0xa6e0ec, normal: 0, emergency: 0.28, reach: 15 },
      { kind: 'strip', guide: true, dir: 'h', x: 300, y: 596, len: 28, t: 4, color: 0x1c4653, hot: 0xa6e0ec, normal: 0, emergency: 0.22, reach: 14 },
      { kind: 'strip', guide: true, dir: 'h', x: 366, y: 596, len: 24, t: 4, color: 0x1c4653, hot: 0xa6e0ec, normal: 0, emergency: 0.18, reach: 13 },
      { kind: 'strip', guide: true, dir: 'v', x: 778, y: 172, len: 32, t: 4, color: 0x24405c, hot: 0xbcd2ea, normal: 0, emergency: 0.25, reach: 15 },
      { kind: 'strip', guide: true, dir: 'v', x: 778, y: 262, len: 26, t: 4, color: 0x24405c, hot: 0xbcd2ea, normal: 0, emergency: 0.20, reach: 14 },
      { kind: 'strip', guide: true, dir: 'v', x: 778, y: 340, len: 22, t: 4, color: 0x24405c, hot: 0xbcd2ea, normal: 0, emergency: 0.17, reach: 13 },
      { kind: 'strip', guide: true, dir: 'h', x: 1252, y: 754, len: 32, t: 4, color: 0x24405c, hot: 0xc6dcf2, normal: 0, emergency: 0.25, reach: 15 },
      { kind: 'strip', guide: true, dir: 'h', x: 1156, y: 754, len: 26, t: 4, color: 0x24405c, hot: 0xc6dcf2, normal: 0, emergency: 0.20, reach: 14 },
      { kind: 'strip', guide: true, dir: 'h', x: 1062, y: 754, len: 22, t: 4, color: 0x24405c, hot: 0xc6dcf2, normal: 0, emergency: 0.17, reach: 13 },
      { kind: 'strip', guide: true, dir: 'v', x: 1148, y: 190, len: 44, t: 4, color: 0x4a4436, hot: 0xf0e6cc, normal: 0, emergency: 0.30, reach: 15 },
      { kind: 'strip', guide: true, dir: 'v', x: 1148, y: 282, len: 28, t: 4, color: 0x4a4436, hot: 0xf0e6cc, normal: 0, emergency: 0.23, reach: 14 },
      { kind: 'strip', guide: true, dir: 'v', x: 1148, y: 356, len: 24, t: 4, color: 0x4a4436, hot: 0xf0e6cc, normal: 0, emergency: 0.20, reach: 13 },
    ];
    spec = { ...spec, emissives: [...spec.emissives.filter((e) => !e.guide), ...B] };
  }
  gs.loadRoom(spec);
  // ENDLESS ROLLS A NEW ROOM MODIFIER ON EVERY ROOM LOAD, and one of them is
  // DARKNESS. A matched pair must differ only in the thing under test.
  gs._roomModifier = null;
  gs.events.emit('modifier-active', null, null);
  await new Promise((r) => setTimeout(r, 2200));
  gs.player.hp = gs.player.hpMax; gs.lives = 9999;
  gs._sectorTint?.setAlpha(0);
});
await page.waitForTimeout(4200);   // let the room banner clear

const clearAll = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.arenaActive = false;
  // The modifier is announced on a delay after the wave banner, so nulling it
  // once at load does not hold — re-assert it, same reason `setDark` does.
  gs._roomModifier = null;
  gs.events.emit('modifier-active', null, null);
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
const place = (px, py, bx, by) => page.evaluate(([x, y, ox, oy]) => {
  const gs = window.game.scene.getScene('Game');
  gs.player.setPosition(x, y); gs.player.setVelocity(0, 0);
  if (gs.boss?.alive && ox != null) { gs.boss.setPosition(ox, oy); gs.boss.setVelocity(0, 0); }
  gs.cameras.main.centerOn(x, y);
}, [px, py, bx, by]);
const pause = (on) => page.evaluate((f) => {
  const gs = window.game.scene.getScene('Game');
  if (f) { gs._sectorTint?.setAlpha(0); gs.cameras.main.resetFX?.(); gs.scene.pause(); }
  else gs.scene.resume();
}, on);
const shot = async (n) => { writeFileSync(`${OUT}/${n}.png`, await page.screenshot()); console.log('  ', n); };
const setDark = (on) => page.evaluate((d) => {
  const gs = window.game.scene.getScene('Game');
  const hud = window.game.scene.getScene('HUD');
  if (d) {
    gs._enterDarkArena(); gs._darkChain?.stop?.();
    gs._darkMix.v = 1; gs._applyDarkMix();
    hud.setDarkness(true, 'blackout');
    hud._darkTweens?.blackout?.stop?.(); hud._overlays?.blackout?.setAlpha(1);
  } else {
    gs._darkChain?.stop?.();
    if (gs._darkMix) gs._darkMix.v = 0;
    gs._applyDarkMix(); gs._restoreArenaTints();
    hud.setDarkness(false, 'blackout');
    hud._darkTweens?.blackout?.stop?.(); hud._overlays?.blackout?.setAlpha(0);
  }
}, on);
// LOWERCASE, AND ASSERTED. `_castBossMove` matches the registry id exactly —
// `saberthrow`, not `saberThrow` — so the camelCase spelling this rig shipped
// with was refused every time and the boss's own state machine supplied the
// frame instead. The move name in the filename was not the move in the picture.
const cast = async (id) => {
  const ok = await page.evaluate((f) => {
    const gs = window.game.scene.getScene('Game');
    return !!gs._castBossMove?.(gs.boss, f);
  }, id);
  if (!ok) console.error(`  !! CAST REFUSED: ${id} — the frame that follows is not that move`);
  return ok;
};
const shoot = (n) => page.evaluate((k) => {
  const gs = window.game.scene.getScene('Game');
  for (let i = 0; i < k; i++) {
    gs.player._aim = -Math.PI / 2 + (i - k / 2) * 0.10;
    gs.player.fireCooldown = 0;
    gs.player.tryFire?.(gs.time.now + i * 40);
  }
}, n);
const wave = (n) => page.evaluate((k) => {
  const gs = window.game.scene.getScene('Game');
  const ring = [[700, 260], [260, 700], [1140, 700], [520, 480], [900, 500], [900, 920], [520, 920]];
  for (let i = 0; i < k; i++) {
    const [x, y] = ring[i % ring.length];
    gs.spawnEnemyAt(i % 3 === 0 ? 'shooter' : 'grunt', x + (i * 37) % 90, y + (i * 53) % 90);
  }
}, n);

// ── THE STATIONS. Named for the question each one answers.
//    The four approaches, both ends of each, and the framings that look ALONG
//    an approach toward the crossing — which is the reading this pass is for.
const STATIONS = [
  ['centre',        700,  700],  // 27.2 / 27.16 — identity from the exact middle
  ['wide',          700,  760],  // as much of the room as the clamp allows
  ['appr-n',        740,  300],  // north service way, mid-run
  ['appr-n-wall',   740,  170],  // its wall end, under the gate
  ['appr-n-in',     740,  470],  // looking from the way INTO the crossing
  ['appr-w',        260,  700],  // west artery, mid-run
  ['appr-w-term',   250,  600],  // its termination, under the interchange
  ['appr-w-in',     460,  700],  // west way into the crossing
  ['appr-e',       1160,  700],  // east control way, mid-run
  ['appr-e-wall',  1250,  740],  // its wall end, by the east gate
  ['appr-e-in',     960,  740],  // east way into the crossing
  ['appr-x',       1180,  300],  // the departure spur
  ['appr-x-term',  1180,  180],  // its termination, under the exit threshold
  ['appr-x-in',    1160,  430],  // the spur into the crossing
  ['spawn',         240, 1200],  // where the player arrives
  ['clamp-s',       700, 1340],  // the four camera clamps
  ['clamp-n',       700,   60],
  ['clamp-w',        60,  700],
  ['clamp-e',      1340,  700],
];

// ── NORMAL POWER FIRST, and it is a CONTROL: the approved normal composition
//    must be pixel-identical across this pass. Every guidance source is dead at
//    normal power, so these frames are the proof rather than a claim.
console.log('— normal power —');
await clearAll(); await setDark(false); await page.waitForTimeout(250);
for (const [name, px, py] of STATIONS) {
  await place(px, py);
  await page.waitForTimeout(200);
  await pause(true); await shot(`normal-${name}`); await pause(false);
}
await clearAll();

console.log('— lights out, quiet room —');
await setDark(true); await page.waitForTimeout(250);
for (const [name, px, py] of STATIONS) {
  await place(px, py);
  await page.waitForTimeout(200);
  await setDark(true);
  await pause(true); await shot(`dark-${name}`); await pause(false);
}
await clearAll();

// ── MOTION, IN THE DARK. This pass changes DIRECTIONAL visual structure, so
//    the pan has to run along an approach and through the crossing rather than
//    past a wall. Flicker, crawl and strobing all live here.
console.log('— motion, north way into the crossing —');
for (let i = 0; i < 10; i++) {
  await place(740, 180 + i * 62);
  await page.waitForTimeout(110);
  await setDark(true);
  await pause(true); await shot(`pan-in-${String(i).padStart(2, '0')}`); await pause(false);
}
console.log('— motion, crossing out along the east way —');
for (let i = 0; i < 8; i++) {
  await place(760 + i * 62, 720);
  await page.waitForTimeout(110);
  await setDark(true);
  await pause(true); await shot(`pan-out-${String(i).padStart(2, '0')}`); await pause(false);
}
console.log('— motion, lateral across the west way —');
for (let i = 0; i < 6; i++) {
  await place(300, 560 + i * 60);
  await page.waitForTimeout(110);
  await setDark(true);
  await pause(true); await shot(`pan-lat-${String(i).padStart(2, '0')}`); await pause(false);
}
await clearAll();

// ── COMBAT HIERARCHY. The guidance must lose to every one of these.
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  if (!gs.boss?.alive) { gs.spawnBoss(700, 500); await new Promise((r) => setTimeout(r, 800)); }
});
await hush(); await page.waitForTimeout(300);

console.log('— vader, lights out —');
await setDark(true); await page.waitForTimeout(250);

await place(700, 900, 700, 560);
await page.waitForTimeout(180); await setDark(true);
await pause(true); await shot('dark-vader'); await pause(false); await hush();

// SABER THROW, twice: down the crossing, and ALONG an approach — the frame
// where the environment's directional fragments are closest to the move's own
// lane language is the one that has to be captured.
await place(700, 980, 700, 660);
await page.waitForTimeout(120); await cast('saberthrow'); await page.waitForTimeout(340);
await setDark(true);
await pause(true); await shot('dark-saber-throw'); await pause(false);
await hush(); await page.waitForTimeout(500);

await place(760, 760, 760, 300);
await page.waitForTimeout(120); await cast('saberthrow'); await page.waitForTimeout(340);
await setDark(true);
await pause(true); await shot('dark-saber-throw-lane'); await pause(false);
await hush(); await page.waitForTimeout(500);

await place(700, 980, 700, 660);
await page.waitForTimeout(120); await cast('forcepull'); await page.waitForTimeout(260);
await setDark(true);
await pause(true); await shot('dark-force-pull'); await pause(false);
await hush(); await page.waitForTimeout(400);

await place(700, 980, 700, 660);
await page.waitForTimeout(120); await cast('forcepush'); await page.waitForTimeout(260);
await setDark(true);
await pause(true); await shot('dark-force-push'); await pause(false);
await hush(); await page.waitForTimeout(400);

await place(1000, 700, 800, 640);
await page.waitForTimeout(120); await shoot(10); await page.waitForTimeout(200);
await setDark(true);
await pause(true); await shot('dark-bolts'); await pause(false);
await hush(); await page.waitForTimeout(300);

// AFTERIMAGES. If the guidance backlights the clones it has to come down.
await place(700, 900, 700, 560);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.events.emit('boss-afterimages', gs.boss);
});
await page.waitForTimeout(420); await setDark(true);
await pause(true); await shot('dark-afterimages'); await pause(false); await hush();

// The same, on an approach — clones standing ON a lit fragment is the worst case.
await place(740, 420, 740, 260);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.events.emit('boss-afterimages', gs.boss);
});
await page.waitForTimeout(420); await setDark(true);
await pause(true); await shot('dark-afterimages-lane'); await pause(false); await hush();

console.log('— dense dark combat —');
await place(700, 820, 700, 520);
await wave(7); await page.waitForTimeout(900); await setDark(true);
await pause(true); await shot('dark-dense'); await pause(false);
await hush(); await page.waitForTimeout(300);

await place(740, 400, 740, 240);
await wave(6); await page.waitForTimeout(900); await setDark(true);
await pause(true); await shot('dark-dense-lane'); await pause(false);
await hush();

console.log(`\n${OUT}`);
await browser.close();
