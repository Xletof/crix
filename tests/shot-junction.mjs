// EVIDENCE — THE REACTOR JUNCTION, the third arena. Matched stations, before
// and after.
//
//   node tests/shot-junction.mjs junction-before
//   node tests/shot-junction.mjs junction-after
//
// THE ROOM IS SQUARE. 1400x1400 against the hangar's 1600x1400 and the
// chamber's 1600x1600, and that squareness is the whole spatial problem: there
// is no long axis to compose along, the objective is dead centre, and threats
// arrive from three bearings. Both approved arenas are AXIAL rooms; this one
// is a hub.
//
// THE CAMERA FOLLOWS THE PLAYER AND CLAMPS AT THE ARENA BOUNDS, so a station is
// a PLAYER position and nothing else — a `centerOn` here is overwritten by the
// follow on the very next update. At 720x1196 of viewport inside 1400x1400 the
// camera's centre is pinned inside x [360, 1040] and y [598, 802], so the
// room's full width never fits and its height nearly always does.
//
// Every frame is taken on a PAUSED scene: freezing `tweens.timeScale` does not
// stop `scene.update`.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 'junction-after';
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
  gs.loadRoom(ROOMS.find((r) => r.id === 'corridor'));
  await new Promise((r) => setTimeout(r, 2200));
  gs.player.hp = gs.player.hpMax; gs.lives = 9999;
  gs._sectorTint?.setAlpha(0);
});
// Long enough for the room-start banner to clear — it is a HUD overlay across
// the middle of the screen and it will print itself over the deck otherwise.
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
  // THE SECTOR WASH COMES BACK. `_sectorTint` is an ADD-blended screen-locked
  // rectangle at depth 9000 and zeroing it once after `loadRoom` does not hold
  // past the room banner — the combat stations of one run came back as six
  // frames of flat red over the whole viewport. Re-assert it at the shutter,
  // for the same reason `setDark` re-asserts the darkness.
  // AND THE CAMERA FLASH: `player-hurt` fires `flash(120, 255, 80, 80)`, and
  // `scene.pause()` stops the effect updating — a shutter inside one freezes a
  // full-screen red wash that never decays. It lives on the camera, not in any
  // display list, so walking the children for it finds nothing.
  if (f) { gs._sectorTint?.setAlpha(0); gs.cameras.main.resetFX?.(); gs.scene.pause(); }
  else gs.scene.resume();
}, on);
const shot = async (n) => { writeFileSync(`${OUT}/${n}.png`, await page.screenshot()); console.log('  ', n); };

// A SCREENSHOT OF A CORRECT GAME CAN COME BACK BLACK. Sector 30 carries the
// DARKNESS room modifier and the room can black out on its own clock; the HUD
// blackout overlay also FADES, and the shutter beats the fade. Both are
// re-asserted before every frame, exactly as `shot-shuttle.mjs` learned to.
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
// A WAVE ARRIVING FROM THE THREE GATES, because that is what this room does.
const wave = (n) => page.evaluate((k) => {
  const gs = window.game.scene.getScene('Game');
  const ring = [[700, 260], [260, 700], [1140, 700], [520, 480], [900, 500], [900, 920], [520, 920]];
  for (let i = 0; i < k; i++) {
    const [x, y] = ring[i % ring.length];
    gs.spawnEnemyAt(i % 3 === 0 ? 'shooter' : 'grunt', x + (i * 37) % 90, y + (i * 53) % 90);
  }
}, n);

// ── STATIONS. Player positions, named for what they are supposed to show.
const STATIONS = [
  ['spawn',     240, 1200],   // where the player actually arrives
  ['centre',    700,  700],   // the objective, and how calm the middle is
  ['exit',     1180,  260],   // the threshold the room is asking for
  ['gate-n',    700,  240],   // the north feeder
  ['gate-w',    240,  700],   // the west feeder
  ['gate-e',   1160,  700],   // the east feeder
  ['landmark',  330,  400],   // the interchange on the west wall, and the core
  ['supply',    300,  900],   // the west supply wall and the spine
  ['traverse',  470,  940],   // mid-diagonal, spawn to exit
  ['clamp',     700, 1340],   // the south edge, where the camera clamp bites
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
await place(700, 700); await wave(7); await page.waitForTimeout(1200);
await pause(true); await shot('normal-wave'); await pause(false);
await page.waitForTimeout(200);
await shoot(10); await page.waitForTimeout(200);
await pause(true); await shot('normal-wave-bolts'); await pause(false);
await clearAll(); await page.waitForTimeout(300);

// ── MOTION. Ten frames along the spawn-to-exit diagonal. Repeated wall bays
//    are the thing this room is most at risk of crawling on, so the pan runs
//    PAST a wall rather than across the open middle.
console.log('— motion, north wall pan —');
for (let i = 0; i < 10; i++) {
  await place(380 + i * 34, 260);
  await page.waitForTimeout(110);
  await pause(true); await shot(`pan-${String(i).padStart(2, '0')}`); await pause(false);
}
await clearAll();

// ── VADER, AS AN INSTRUMENT. He never changes the room.
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  if (!gs.boss?.alive) { gs.spawnBoss(700, 500); await new Promise((r) => setTimeout(r, 800)); }
});
await hush(); await page.waitForTimeout(300);

for (const state of ['normal', 'lightsout']) {
  await pause(false); await hush(); await setDark(state === 'lightsout');
  await page.waitForTimeout(250);
  console.log(`— vader / ${state} —`);

  await place(700, 900, 700, 560);
  await page.waitForTimeout(180);
  await setDark(state === 'lightsout');
  await pause(true); await shot(`${state}-vader`); await pause(false); await hush();

  await place(420, 620, 380, 400);
  await page.waitForTimeout(180);
  await setDark(state === 'lightsout');
  await pause(true); await shot(`${state}-vader-landmark`); await pause(false); await hush();

  await place(700, 980, 700, 640);
  await page.waitForTimeout(120);
  await cast('saberThrow');
  await page.waitForTimeout(340);
  await setDark(state === 'lightsout');
  await pause(true); await shot(`${state}-saber-throw`); await pause(false);
  await hush(); await page.waitForTimeout(500);

  await place(700, 980, 700, 660);
  await page.waitForTimeout(120);
  await cast('forcePull');
  await page.waitForTimeout(260);
  await setDark(state === 'lightsout');
  await pause(true); await shot(`${state}-force-pull`); await pause(false);
  await hush(); await page.waitForTimeout(400);

  await place(700, 980, 700, 660);
  await page.waitForTimeout(120);
  await cast('forcePush');
  await page.waitForTimeout(260);
  await setDark(state === 'lightsout');
  await pause(true); await shot(`${state}-telegraph`); await pause(false);
  await hush(); await page.waitForTimeout(400);

  await place(1000, 700, 800, 640);
  await page.waitForTimeout(120);
  await shoot(10); await page.waitForTimeout(200);
  await setDark(state === 'lightsout');
  await pause(true); await shot(`${state}-bolts`); await pause(false);
  await hush(); await page.waitForTimeout(300);

  // DENSE COMBAT. A wave plus the boss, which is the readability worst case.
  await place(700, 820, 700, 520);
  await wave(6); await page.waitForTimeout(900);
  await setDark(state === 'lightsout');
  await pause(true); await shot(`${state}-dense`); await pause(false);
  await hush(); await page.waitForTimeout(300);

  await place(700, 1340, 700, 1080);
  await page.waitForTimeout(180);
  await setDark(state === 'lightsout');
  await pause(true); await shot(`${state}-vader-clamp`); await pause(false);
  await hush();

  if (state === 'lightsout') {
    for (const [n, px, py, bx, by] of [
      ['lightsout-wide',     700,  700, 700, 460],
      ['lightsout-spawn',    240, 1200, 700, 700],
      ['lightsout-exit',    1180,  260, 700, 700],
      ['lightsout-gate-w',   240,  700, 700, 700],
      ['lightsout-gate-n',   700,  240, 700, 700],
      ['lightsout-landmark', 330,  400, 800, 800],
      ['lightsout-supply',   300,  900, 800, 700],
    ]) {
      await place(px, py, bx, by);
      await page.waitForTimeout(180);
      await setDark(true);
      await pause(true); await shot(n); await pause(false); await hush();
    }
    // ECLIPSE / afterimages, if this rung has them.
    await place(700, 900, 700, 560);
    await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      gs.events.emit('boss-afterimages', gs.boss);
    });
    await page.waitForTimeout(420);
    await setDark(true);
    await pause(true); await shot('lightsout-afterimages'); await pause(false); await hush();
  }
}

console.log(`\n${OUT}`);
await browser.close();
