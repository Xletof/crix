// DOES THE EMERGENCY GUIDANCE COST THE APPROVED NORMAL-POWER ROOM ANYTHING?
//
//   node tests/diag-junction-normal-delta.mjs
//
// The handset froze the junction's normal-power composition, so the honest bar
// for this pass is a ZERO-PIXEL delta at normal power — not "close enough".
//
// A NAIVE BEFORE/AFTER SCREENSHOT DIFF CANNOT ANSWER THIS, and finding that out
// cost a round. `paintBackdrop` consumes `Math.random` for its panel and scorch
// scatter, and nothing seeds it in a live run — so two page loads of the SAME
// build return backdrops that differ over the whole frame. Diffing a before-run
// against an after-run measured 62,000-94,000 changed pixels on a change that
// is invisible by construction, and every one of them was floor grime.
//
// So the comparison is made INSIDE ONE PAGE LOAD, against one backdrop: shoot
// the room at normal power, destroy only the guide parts, shoot it again. Any
// pixel that moves is a pixel the guidance was contributing while the room's
// main power was up.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'docs/evidence/arena-pilot/junction-lanes-after';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto('http://localhost:5173/?nodlg=1&nofreeze=1');
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
  gs._roomModifier = null;
  gs.events.emit('modifier-active', null, null);
  await new Promise((r) => setTimeout(r, 2200));
  gs.lives = 9999;
});
await page.waitForTimeout(4200);

const quiet = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.player.hp = gs.player.hpMax;
  gs._sectorTint?.setAlpha(0);
  gs.cameras.main.resetFX?.();
});

// ── AND THE SECOND TRAP: TIME. The first version of this shot the room, then
//    destroyed the guides, then shot it again — and measured up to 5,126
//    changed pixels on parts that `setPower(0)` had already made INVISIBLE.
//    None of it was the guidance. The player's idle animation, the objective's
//    SLICE prompt and the HUD's own tweens all advanced between the two
//    shutters, and a diff cannot tell those from a light.
//
//    So the whole comparison happens inside ONE PAUSED FRAME. `scene.pause()`
//    stops `update` but the renderer keeps drawing, so the camera can still be
//    scrolled between shots while every animated object stays frozen on the
//    same frame it was on. Nothing but the guide parts can differ.
const STATIONS = [
  ['centre', 700, 700], ['appr-w', 260, 700], ['appr-n', 740, 300],
  ['appr-e', 1160, 700], ['appr-x', 1180, 300],
];

await page.evaluate(([px, py]) => {
  const gs = window.game.scene.getScene('Game');
  gs.player.setPosition(px, py); gs.player.setVelocity(0, 0);
}, [700, 700]);
await page.waitForTimeout(300);
await quiet();
// BOTH SCENES. The HUD is a separate scene with its own tweens — the objective
// prompt, the ability rings, the reload pips — and pausing only Game leaves all
// of them advancing between the two shutters.
await page.evaluate(() => {
  window.game.scene.getScene('Game').scene.pause();
  window.game.scene.getScene('HUD').scene.pause();
});

// Scroll the camera by hand — `centerOn` plus the follow would need `update`.
// AND THE SHUTTER HAS TO WAIT FOR THE FRAME. A paused scene still renders, but
// the screenshot captures whatever the canvas last painted — without a wait
// after the scroll it photographs the PREVIOUS station. That produced two
// stations reporting hundreds of thousands of changed pixels while the three
// between them reported exactly zero, which is the signature of a timing race
// rather than of a light.
const look = async (x, y) => {
  await page.evaluate(([px, py]) => {
    const cam = window.game.scene.getScene('Game').cameras.main;
    cam.setScroll(px - cam.width / 2, py - cam.height / 2);
  }, [x, y]);
  await page.waitForTimeout(160);
};

// WAIT FOR THE CANVAS TO SETTLE, don't guess at it. A paused scene still paints,
// but not on the timetable a fixed `waitForTimeout` assumes — a 160ms wait left
// two of five stations photographing the PREVIOUS camera position while the
// three between them were exact. Shoot until two consecutive frames are byte
// -identical and take that one; a frame that has stopped changing is the frame
// the renderer has finished with.
const stable = async () => {
  let prev = await page.screenshot();
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(90);
    const next = await page.screenshot();
    if (next.equals(prev)) return next;
    prev = next;
  }
  throw new Error('the canvas never settled — something is still animating');
};

const before = {};
for (const [n, x, y] of STATIONS) { await look(x, y); before[n] = await stable(); }

// Guide parts only. Everything else in the layer — the four thresholds, the
// interchange, the core, the wall lamps — is left exactly where it is.
const removed = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const g = (gs.envLight?.parts || []).filter((p) => p._guide);
  g.forEach((p) => p.destroy());
  gs.envLight.parts = (gs.envLight.parts || []).filter((p) => !p._guide);
  return g.length;
});
console.log(`removed ${removed} guide parts`);

const diffPx = async (a, b) => page.evaluate(async ([sa, sb]) => {
  const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = s; });
  const [ia, ib] = await Promise.all([load(sa), load(sb)]);
  const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data;
  x.clearRect(0, 0, c.width, c.height);
  x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
  let n = 0, maxd = 0;
  for (let p = 0; p < da.length; p += 4) {
    const d = Math.max(Math.abs(da[p] - db[p]), Math.abs(da[p + 1] - db[p + 1]), Math.abs(da[p + 2] - db[p + 2]));
    if (d > 0) { n++; maxd = Math.max(maxd, d); }
  }
  return { n, maxd };
}, [a, b]);

let worst = 0;
for (const [n, x, y] of STATIONS) {
  await look(x, y);
  const after = await stable();
  const d = await diffPx(
    `data:image/png;base64,${before[n].toString('base64')}`,
    `data:image/png;base64,${after.toString('base64')}`);
  worst = Math.max(worst, d.n);
  console.log(`  normal ${n.padEnd(8)} changed ${String(d.n).padStart(6)} px, max channel delta ${d.maxd}`);
  writeFileSync(`${OUT}/normal-delta-${n}.png`, before[n]);
}

// ── THE CONTROL. A probe that reports zero has to be shown capable of
//    reporting anything else, or "no delta" only means the camera never moved.
//    So the identical measurement runs again under EMERGENCY power — same
//    stations, same settle, same removal — and there the guidance is the entire
//    point of the pass. Zero there would mean the probe is blind.
await page.evaluate(() => {
  window.game.scene.getScene('Game').scene.resume();
  window.game.scene.getScene('HUD').scene.resume();
});
await page.waitForTimeout(200);
await page.reload();
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
  gs._roomModifier = null;
  gs.events.emit('modifier-active', null, null);
  await new Promise((r) => setTimeout(r, 2200));
  gs.lives = 9999;
  gs.player.setPosition(700, 700); gs.player.setVelocity(0, 0);
});
await page.waitForTimeout(4200);
await quiet();
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs._enterDarkArena(); gs._darkChain?.stop?.();
  gs._darkMix.v = 1; gs._applyDarkMix();
  const hud = window.game.scene.getScene('HUD');
  hud.setDarkness(true, 'blackout');
  hud._darkTweens?.blackout?.stop?.(); hud._overlays?.blackout?.setAlpha(1);
  gs.scene.pause(); hud.scene.pause();
});

const darkBefore = {};
for (const [n, x, y] of STATIONS) { await look(x, y); darkBefore[n] = await stable(); }
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const g = (gs.envLight?.parts || []).filter((p) => p._guide);
  g.forEach((p) => p.destroy());
  gs.envLight.parts = (gs.envLight.parts || []).filter((p) => !p._guide);
});
let lit = 0;
console.log('\n  control — the same removal under EMERGENCY power:');
for (const [n, x, y] of STATIONS) {
  await look(x, y);
  const after = await stable();
  const d = await diffPx(
    `data:image/png;base64,${darkBefore[n].toString('base64')}`,
    `data:image/png;base64,${after.toString('base64')}`);
  lit = Math.max(lit, d.n);
  console.log(`  dark   ${n.padEnd(8)} changed ${String(d.n).padStart(6)} px, max channel delta ${d.maxd}`);
}
if (lit === 0) {
  console.log('\nFAIL: the probe reports no change in the DARK either — it is blind, and its zero at normal power means nothing.');
  process.exit(1);
}

console.log(worst === 0
  ? '\nNORMAL POWER IS PIXEL-IDENTICAL WITH AND WITHOUT THE GUIDANCE.'
  : `\nFAIL: the guidance changes up to ${worst} pixels at normal power.`);
await browser.close();
process.exit(worst === 0 ? 0 : 1);
