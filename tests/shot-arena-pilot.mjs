// EVIDENCE — THE ARENA PILOT. The Vader chamber photographed in both of its
// authored lighting states, at every camera position the room can actually be
// seen from.
//
// This rig exists to be run TWICE against the same positions — once on the
// baseline build and once on the pilot — so the comparison is the same room at
// the same coordinates and not two prettiest-camera screenshots.
//
//   node tests/shot-arena-pilot.mjs before
//   node tests/shot-arena-pilot.mjs after
//
// Everything is photographed on a PAUSED scene (`scene.pause()`), because
// freezing `tweens.timeScale` does not stop `scene.update` and a telegraph
// destroys itself before the shutter.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 'after';
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
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 777 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

// Rung 6 Vader in his own chamber, everything else swept out.
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
});
await page.waitForTimeout(600);

// THE ENDLESS SECTOR WASH IS NOT THE ARENA. `_sectorTint` is an ADD-blended
// screen-locked rectangle at depth 9000, up to 0.20 alpha, and at sector 30 it
// puts a solid olive film over every pixel of these photographs. It is a
// separate system from the room art, so it is off for the station shots and
// restored for one dedicated frame at the end.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  if (gs._sectorTint?.active) { gs._sectorTintSaved = gs._sectorTint.fillAlpha; gs._sectorTint.setAlpha(0); }
});

const FAR = 1e9;
// Silence every free-running clock. A stray SUNDER photographs a different
// mechanic than the one the frame is captioned with.
const hush = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss, F = 1e9;
  if (!b) return;
  b._blackoutT = F; b._afterimageT = F; b._disarmT = F; b._sunderT = F;
  b._reflectT = F; b.cooldown = F; b._moveT = F; b._attackT = F;
  b.hp = b.hpMax; gs.player.hp = gs.player.hpMax;
});
const place = (px, py, bx, by) => page.evaluate(([x, y, ox, oy]) => {
  const gs = window.game.scene.getScene('Game');
  gs.player.setPosition(x, y); gs.player.setVelocity(0, 0);
  if (gs.boss?.alive && ox != null) { gs.boss.setPosition(ox, oy); gs.boss.setVelocity(0, 0); }
  gs.cameras.main.centerOn(x, y);   // no lerp — a photograph must not chase
}, [px, py, bx, by]);
// The camera CLAMPS at the arena bounds, so a corner shot is not the same
// framing as the centre one. Let the real follow logic settle it.
const freeCam = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.cameras.main.centerOn(gs.player.x, gs.player.y);
});
const pause = (on) => page.evaluate((f) => {
  const gs = window.game.scene.getScene('Game');
  if (f) gs.scene.pause(); else gs.scene.resume();
}, on);
const shot = async (n) => { writeFileSync(`${OUT}/${n}.png`, await page.screenshot()); console.log('  ', n); };

// Hard-set the arena state with no tween: a photograph of a transition is a
// photograph of a random moment in it.
const setDark = (on) => page.evaluate((d) => {
  const gs = window.game.scene.getScene('Game');
  const hud = window.game.scene.getScene('HUD');
  if (d) {
    gs._enterDarkArena();
    gs._darkChain?.stop?.();
    gs._darkMix.v = 1; gs._applyDarkMix();
    hud.setDarkness(true, 'blackout');
    hud._darkTweens.blackout?.stop?.();
    hud._overlays.blackout.setAlpha(1);
  } else {
    gs._darkChain?.stop?.();
    if (gs._darkMix) gs._darkMix.v = 0;
    gs._applyDarkMix(); gs._restoreArenaTints();
    hud.setDarkness(false, 'blackout');
  }
}, on);

// A named camera station. Every one of these is photographed in both states.
const STATIONS = [
  ['centre',      800,  800,  800, 500],
  ['dais-north',  800,  460,  800, 300],   // the boss's own ground
  ['south-gate',  800, 1360,  800, 1100],
  ['corner-nw',   200,  200,  520, 400],   // camera clamps hard here
  ['corner-se',  1400, 1400, 1100, 1150],
  ['edge-west',   180,  800,  520, 760],
  ['console-ne', 1200,  400,  980, 520],   // close on a cover console
];

for (const state of ['normal', 'lightsout']) {
  await pause(false);
  await hush();
  await setDark(state === 'lightsout');
  await page.waitForTimeout(250);
  console.log(`— ${state} —`);
  for (const [name, px, py, bx, by] of STATIONS) {
    await place(px, py, bx, by);
    await page.waitForTimeout(160);
    await freeCam();
    await page.waitForTimeout(60);
    await pause(true);
    await shot(`${state}-${name}`);
    await pause(false);
    await hush();
  }
}

// ── COMBAT FRAMES. The readability gate: the environment has to sit under
//    live combat information, so photograph them together.
const cast = (id) => page.evaluate((f) => {
  const gs = window.game.scene.getScene('Game');
  return !!gs._castBossMove?.(gs.boss, f);
}, id);
const shoot = (n) => page.evaluate((k) => {
  const gs = window.game.scene.getScene('Game');
  for (let i = 0; i < k; i++) {
    gs.player._aim = -Math.PI / 2 + (i - k / 2) * 0.10;
    gs.player.fireCooldown = 0;
    gs.player.tryFire?.(gs.time.now + i * 40);
  }
}, n);

for (const state of ['normal', 'lightsout']) {
  await pause(false);
  await hush();
  await setDark(state === 'lightsout');
  await page.waitForTimeout(200);

  // 1. saber combat at close range
  await place(800, 900, 800, 700);
  await freeCam(); await page.waitForTimeout(120);
  await cast('saberCombo');
  await page.waitForTimeout(320);
  await pause(true); await shot(`${state}-combat-saber`); await pause(false);
  await hush(); await page.waitForTimeout(300);

  // 2. projectile-heavy
  await place(800, 1000, 800, 640);
  await freeCam(); await page.waitForTimeout(120);
  await shoot(9);
  await page.waitForTimeout(220);
  await pause(true); await shot(`${state}-combat-bolts`); await pause(false);
  await hush(); await page.waitForTimeout(300);

  // 3. a telegraph on the floor — the colour the environment must not imitate
  await place(800, 900, 800, 620);
  await freeCam(); await page.waitForTimeout(120);
  await cast('forcePush');
  await page.waitForTimeout(260);
  await pause(true); await shot(`${state}-combat-telegraph`); await pause(false);
  await hush(); await page.waitForTimeout(400);
}

// ── The two frames that only exist in the dark.
await setDark(false);
await page.waitForTimeout(200);
await place(800, 900, 800, 620);
await freeCam(); await page.waitForTimeout(150);
// Power-failure transition, caught mid-onset.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs._enterDarkArena();
  gs._darkChain?.stop?.();
  gs._darkMix.v = 0.55; gs._applyDarkMix();
  const hud = window.game.scene.getScene('HUD');
  hud.setDarkness(true, 'blackout');
  hud._darkTweens.blackout?.stop?.();
  hud._overlays.blackout.setAlpha(0.55);
});
await page.waitForTimeout(100);
await pause(true); await shot('lightsout-transition'); await pause(false);

// ECLIPSE / afterimages in the dark.
await setDark(true);
await hush();
await place(800, 900, 800, 620);
await freeCam(); await page.waitForTimeout(120);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs._spawnAfterimages(gs.boss, 3);
});
await page.waitForTimeout(500);
await pause(true); await shot('lightsout-eclipse'); await pause(false);

// One honest frame WITH the endless wash, so the sheet is not silently
// photographing a room the player never sees at this sector.
await setDark(false);
await hush();
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  if (gs._sectorTint?.active && gs._sectorTintSaved != null) gs._sectorTint.setAlpha(gs._sectorTintSaved);
});
await place(800, 900, 800, 620);
await freeCam(); await page.waitForTimeout(150);
await pause(true); await shot('normal-sector-wash'); await pause(false);

await setDark(false);
await browser.close();
console.log(`\nevidence -> ${OUT}`);
