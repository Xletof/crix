// EVIDENCE — THE HERO MACHINE'S SILHOUETTE, candidate against candidate.
//
// Handset review rejected the hero prop's outer shell for reading chunkier and
// softer in motion than everything around it. The fix under test is SHAPE
// LANGUAGE: an armoured faceted housing whose every edge is a direction the
// pixel grid can state exactly, instead of one large mathematical circle.
//
// Two candidates were built and photographed at IDENTICAL camera stations:
//
//   node tests/shot-hero-shape.mjs shape-12     ~12 meaningful planes
//   node tests/shot-hero-shape.mjs shape-16     ~16 smaller planes
//
// The judgement is made at runtime scale on these frames, NOT on a zoomed
// source texture — the whole complaint was about motion and about how the
// object sits beside the rest of the room, and a 4x view of the canvas answers
// neither question. `hero-pan-*` is the closest a still sheet gets to motion:
// three frames of a camera travelling past the prop.
//
// Every frame is taken on a PAUSED scene. Freezing `tweens.timeScale` does not
// stop `scene.update`, and a telegraph destroys itself before the shutter.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 'shape-12';
const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = `docs/evidence/arena-pilot/hero-shape/${TAG}`;
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

// ── The six frames §24 asks for, at frozen coordinates.
const STATIONS = [['close', 340, 820], ['pan-a', 200, 900], ['pan-b', 420, 900], ['pan-c', 700, 900]];

for (const state of ['normal', 'lightsout']) {
  await pause(false); await hush(); await setDark(state === 'lightsout');
  await page.waitForTimeout(250);
  console.log(`— ${state} —`);
  for (const [name, px, py] of STATIONS) {
    await place(px, py, 1200, 1200);
    await page.waitForTimeout(180);
    await pause(true); await shot(`${state}-${name}`); await pause(false);
    await hush();
  }
  // Vader standing beside it, and his saber over it — the benchmark the
  // environment is not allowed to compete with.
  await place(400, 900, 380, 700);
  await page.waitForTimeout(150);
  await pause(true); await shot(`${state}-vader-beside`); await pause(false);
  await hush();
  await place(400, 900, 380, 700);
  await page.waitForTimeout(120);
  await cast('saberCombo');
  await page.waitForTimeout(320);
  await pause(true); await shot(`${state}-vader-saber`); await pause(false);
  await hush(); await page.waitForTimeout(300);
}

// One frame with the endless sector wash back on, so the sheet is not silently
// photographing a room the player never sees at sector 30.
await setDark(false); await hush();
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  if (gs._sectorTint && gs._sectorTintSaved != null) gs._sectorTint.setAlpha(gs._sectorTintSaved);
});
await place(400, 880, 1200, 1200);
await page.waitForTimeout(180);
await pause(true); await shot('normal-sector-wash'); await pause(false);

console.log(`\n${OUT}`);
await browser.close();
