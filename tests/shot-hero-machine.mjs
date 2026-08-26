// EVIDENCE — THE HERO MACHINE. The Vader chamber's one large prop, the
// meditation pod, photographed as the room's landmark in both power states.
//
// Run TWICE against identical camera stations so the comparison is the same
// object at the same coordinates rather than two flattering angles:
//
//   node tests/shot-hero-machine.mjs hero-before
//   node tests/shot-hero-machine.mjs hero-after
//
// Every frame is taken on a PAUSED scene. Freezing `tweens.timeScale` does not
// stop `scene.update`, and a telegraph destroys itself before the shutter.
//
// The pod's world footprint is fixed and the stations are derived from it:
// origin is bottom-centre at (340, 740) and the texture is 352x328, so it
// occupies x 164..516, y 412..740. If the prop ever moves, these numbers are
// the thing to re-derive — not the framing.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 'hero-after';
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

// The endless sector wash is a separate system (ADD rect, depth 9000, screen
// locked). Off for the station shots, restored for one honest frame at the end.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  if (gs._sectorTint?.active) { gs._sectorTintSaved = gs._sectorTint.fillAlpha; gs._sectorTint.setAlpha(0); }
});

const hush = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss, F = 1e9;
  // The survival round keeps spawning under the boss fight. A frame of the
  // ENVIRONMENT should not have six troopers standing in it, so the wave is
  // swept before every shutter rather than once at the top of the run.
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
const freeCam = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.cameras.main.centerOn(gs.player.x, gs.player.y);
});
const pause = (on) => page.evaluate((f) => {
  const gs = window.game.scene.getScene('Game');
  if (f) gs.scene.pause(); else gs.scene.resume();
}, on);
const shot = async (n) => { writeFileSync(`${OUT}/${n}.png`, await page.screenshot()); console.log('  ', n); };

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

// player x/y, boss x/y — the boss is parked out of frame unless the station
// wants him in it.
const STATIONS = [
  ['hero-close',   340,  820, 1200, 1200],   // the machine, filling the frame
  ['hero-mid',     560,  800, 1200, 1200],   // machine in its aisle
  ['room-wide',    800,  800, 1200, 1200],   // the whole chamber
  ['hero-pan-a',   200,  900, 1200, 1200],   // three frames of a camera moving
  ['hero-pan-b',   420,  900, 1200, 1200],   // past the prop — the read in
  ['hero-pan-c',   700,  900, 1200, 1200],   // motion, not in one still
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

// ── COMBAT BESIDE THE MACHINE. The readability gate: the prop and its light
//    must sit UNDER live combat information, so photograph them together.
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

  // Vader fighting right beside the prop.
  await place(400, 900, 380, 700);
  await freeCam(); await page.waitForTimeout(120);
  await cast('saberCombo');
  await page.waitForTimeout(320);
  await pause(true); await shot(`${state}-hero-vader-saber`); await pause(false);
  await hush(); await page.waitForTimeout(320);

  // SABER THROW across the machine — a crimson lane over the environment.
  await place(400, 1000, 380, 620);
  await freeCam(); await page.waitForTimeout(120);
  await cast('saberThrow');
  await page.waitForTimeout(420);
  await pause(true); await shot(`${state}-hero-saber-throw`); await pause(false);
  await hush(); await page.waitForTimeout(400);

  // Projectiles in front of it.
  await place(400, 980, 380, 640);
  await freeCam(); await page.waitForTimeout(120);
  await shoot(9);
  await page.waitForTimeout(220);
  await pause(true); await shot(`${state}-hero-bolts`); await pause(false);
  await hush(); await page.waitForTimeout(300);

  // A telegraph on the deck beside it — the colour the environment may not
  // imitate, photographed next to everything the environment does emit.
  await place(430, 900, 400, 660);
  await freeCam(); await page.waitForTimeout(120);
  await cast('forcePush');
  await page.waitForTimeout(260);
  await pause(true); await shot(`${state}-hero-telegraph`); await pause(false);
  await hush(); await page.waitForTimeout(400);
}

// One honest frame with the endless sector wash back on, normal power, so the
// sheet is not silently photographing a room the player never sees at sector 30.
await setDark(false);
await hush();
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  if (gs._sectorTint && gs._sectorTintSaved != null) gs._sectorTint.setAlpha(gs._sectorTintSaved);
});
await place(400, 880, 1200, 1200);
await freeCam(); await page.waitForTimeout(150);
await pause(true); await shot('normal-hero-sector-wash'); await pause(false);

// And the same frame in the dark, which is where the wash and the emergency
// palette actually collide.
await setDark(true);
await hush();
await place(400, 880, 1200, 1200);
await freeCam(); await page.waitForTimeout(150);
await pause(true); await shot('lightsout-hero-sector-wash'); await pause(false);

console.log(`\nwrote ${OUT}`);
await browser.close();
