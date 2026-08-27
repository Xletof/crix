// EVIDENCE — THE HANGAR, the second arena. Matched stations, before and after.
//
//   node tests/shot-hangar.mjs hangar-before
//   node tests/shot-hangar.mjs hangar-after
//
// THE CAMERA FOLLOWS THE PLAYER AND CLAMPS AT THE ARENA BOUNDS, so a station is
// a PLAYER position and nothing else — a `centerOn` here is overwritten by the
// follow on the very next update. The hangar is 1600x1400 and the viewport is
// 720x1196, so the camera's y is pinned inside [598, 802]: almost the whole
// room's height is always in frame and only x really travels.
//
// Every frame is taken on a PAUSED scene: freezing `tweens.timeScale` does not
// stop `scene.update`.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 'hangar-after';
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

// A LATE SECTOR, IN THE HANGAR. `SPAWN VADER` deliberately keeps the current
// room; this is the same contract from the other side — set the sector so the
// boss ladder resolves late, then load the hangar and never touch the room
// again.
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
// Long enough for the room-start banner to clear. It is a HUD overlay across
// the middle of the screen, and the first sheet of station frames came back
// with "SLICE TERMINALS FOR SUPPORT" printed over the deck.
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
const place = (px, py, bx, by) => page.evaluate(([x, y, ox, oy]) => {
  const gs = window.game.scene.getScene('Game');
  gs.player.setPosition(x, y); gs.player.setVelocity(0, 0);
  if (gs.boss?.alive && ox != null) { gs.boss.setPosition(ox, oy); gs.boss.setVelocity(0, 0); }
  gs.cameras.main.centerOn(x, y);
}, [px, py, bx, by]);
const pause = (on) => page.evaluate((f) => {
  const gs = window.game.scene.getScene('Game');
  if (f) gs.scene.pause(); else gs.scene.resume();
}, on);
const shot = async (n) => { writeFileSync(`${OUT}/${n}.png`, await page.screenshot()); console.log('  ', n); };
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
  }
}, on);
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
const wave = (n) => page.evaluate((k) => {
  const gs = window.game.scene.getScene('Game');
  const ring = [[640, 420], [980, 430], [1180, 780], [900, 980], [560, 950], [760, 640], [1080, 560]];
  for (let i = 0; i < k; i++) {
    const [x, y] = ring[i % ring.length];
    gs.spawnEnemyAt(i % 3 === 0 ? 'shooter' : 'grunt', x + (i * 37) % 90, y + (i * 53) % 90);
  }
}, n);

// ── STATIONS. Player positions, named for what they are supposed to show.
const STATIONS = [
  ['opening',   240,  700],   // where the player actually arrives
  ['centre',    800,  700],   // the combat floor, and how calm it is
  ['landmark',  420,  300],   // the north wall and whatever the room is landmarked on
  ['service',   300,  960],   // the west/south technical side
  ['staging',  1220,  320],   // the east side
  ['exit',     1300,  700],   // the threshold
  ['cover',     660,  520],   // standing at a cover object
  ['clamp',     800, 1340],   // the south edge, where the camera clamp bites
];

console.log('— normal power, quiet room —');
await clearAll(); await setDark(false); await page.waitForTimeout(250);
for (const [name, px, py] of STATIONS) {
  await place(px, py);
  await page.waitForTimeout(200);
  await pause(true); await shot(`normal-${name}`); await pause(false);
  await clearAll();
}

console.log('— normal power, wave combat —');
await place(800, 700); await wave(7); await page.waitForTimeout(1200);
await pause(true); await shot('normal-wave'); await pause(false);
await page.waitForTimeout(200);
await shoot(10); await page.waitForTimeout(200);
await pause(true); await shot('normal-wave-bolts'); await pause(false);
await clearAll(); await page.waitForTimeout(300);

// ── VADER, AS AN INSTRUMENT. He never changes the room.
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  if (!gs.boss?.alive) { gs.spawnBoss(800, 500); await new Promise((r) => setTimeout(r, 800)); }
});
await hush(); await page.waitForTimeout(300);

for (const state of ['normal', 'lightsout']) {
  await pause(false); await hush(); await setDark(state === 'lightsout');
  await page.waitForTimeout(250);
  console.log(`— vader / ${state} —`);

  await place(800, 900, 800, 560);
  await page.waitForTimeout(180);
  await pause(true); await shot(`${state}-vader`); await pause(false); await hush();

  await place(420, 620, 420, 320);
  await page.waitForTimeout(180);
  await pause(true); await shot(`${state}-vader-landmark`); await pause(false); await hush();

  await place(800, 980, 800, 640);
  await page.waitForTimeout(120);
  await cast('saberThrow');
  await page.waitForTimeout(340);
  await pause(true); await shot(`${state}-saber-throw`); await pause(false);
  await hush(); await page.waitForTimeout(500);

  await place(700, 980, 700, 660);
  await page.waitForTimeout(120);
  await cast('forcePush');
  await page.waitForTimeout(260);
  await pause(true); await shot(`${state}-telegraph`); await pause(false);
  await hush(); await page.waitForTimeout(400);

  await place(1200, 700, 1000, 640);
  await page.waitForTimeout(120);
  await shoot(10); await page.waitForTimeout(200);
  await pause(true); await shot(`${state}-bolts`); await pause(false);
  await hush(); await page.waitForTimeout(300);

  await place(800, 1340, 800, 1080);
  await page.waitForTimeout(180);
  await pause(true); await shot(`${state}-vader-clamp`); await pause(false);
  await hush();

  if (state === 'lightsout') {
    await place(240, 700, 700, 700);
    await page.waitForTimeout(180);
    await pause(true); await shot('lightsout-wide'); await pause(false); await hush();
    await place(300, 960, 700, 700);
    await page.waitForTimeout(180);
    await pause(true); await shot('lightsout-service'); await pause(false); await hush();
    await place(1300, 700, 1000, 700);
    await page.waitForTimeout(180);
    await pause(true); await shot('lightsout-exit'); await pause(false); await hush();
  }
}

console.log(`\n${OUT}`);
await browser.close();
