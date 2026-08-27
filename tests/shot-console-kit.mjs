// EVIDENCE — THE CONSOLE KIT. Three reusable console archetypes, photographed
// as objects and then as furniture in a live Vader fight.
//
//   node tests/shot-console-kit.mjs console-before     (on the old `bush` art)
//   node tests/shot-console-kit.mjs console-after
//
// The four cover consoles in the chamber stand at frozen coordinates, so the
// archetype stations below are those coordinates and the comparison is the
// same spot photographed twice.
//
// ARCHETYPE B IS NOT PLACED IN THE ARENA. The chamber's wall bays are painted
// by the perimeter pass, its composition is frozen this round, and adding wall
// panel sprites would be adding environment decoration. So the rig drops one
// in FOR THE PHOTOGRAPH ONLY, on the deck, at the same scale a real one would
// be — enough to judge the vocabulary, and gone when the page closes.
//
// Every frame is taken on a PAUSED scene: freezing `tweens.timeScale` does not
// stop `scene.update`.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 'console-after';
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
  gs._sectorTintSaved = gs._sectorTint?.fillAlpha ?? 0;
  gs._sectorTint?.setAlpha(0);
  // The wall archetype, for the photograph only — see the header.
  if (window.game.textures.exists('ch-con-wall')) {
    const im = gs.add.image(700, 620, 'ch-con-wall').setDepth(676);
    im._loClass = 'console'; gs.roomLayer.add(im);
  }
});
await page.waitForTimeout(500);

const hush = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss, F = 1e9;
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!b) return;
  b._blackoutT = F; b._afterimageT = F; b._disarmT = F; b._sunderT = F;
  b._reflectT = F; b.cooldown = F; b._moveT = F; b._attackT = F;
  b.hp = b.hpMax; gs.player.hp = gs.player.hpMax;
});
// THE CAMERA FOLLOWS THE PLAYER AND CLAMPS AT THE ARENA BOUNDS, so a station
// is a PLAYER position and nothing else: a `centerOn` here is overwritten by
// the follow on the very next update, which is a way to spend a whole run
// photographing a camera that never moved. Framing is therefore chosen by
// solving for the player — and in the south-west corner the clamp wins outright
// (anything at y=1240 lands at screen y 920, under the touch controls), so that
// station is offset in x instead to put the console clear of them.
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

// The four frozen cover coordinates, plus the borrowed wall panel.
const STATIONS = [
  ['heavy',   620, 1330],   // SW pillar — the archetype with authority
  ['ped-a',   440,  530],   // NW pillar
  ['ped-b',  1240,  530],   // NE pillar
  ['wall',    700,  700],   // the borrowed wall panel, photograph only
  ['pair',   1060, 1300],   // a console and the room around it
];

for (const state of ['normal', 'lightsout']) {
  await pause(false); await hush(); await setDark(state === 'lightsout');
  await page.waitForTimeout(250);
  console.log(`— ${state} —`);
  for (const [name, px, py] of STATIONS) {
    await place(px, py, 900, 900);
    await page.waitForTimeout(180);
    await pause(true); await shot(`${state}-${name}`); await pause(false);
    await hush();
  }
  // A console in the middle of live combat: is it still furniture?
  await place(620, 1330, 640, 1180);
  await page.waitForTimeout(140);
  await cast('saberCombo');
  await page.waitForTimeout(320);
  await pause(true); await shot(`${state}-combat-vader`); await pause(false);
  await hush(); await page.waitForTimeout(320);

  await place(620, 1330, 900, 900);
  await page.waitForTimeout(120);
  await shoot(10);
  await page.waitForTimeout(200);
  await pause(true); await shot(`${state}-combat-bolts`); await pause(false);
  await hush(); await page.waitForTimeout(300);
}

console.log(`\n${OUT}`);
await browser.close();
