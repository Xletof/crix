// EVIDENCE — THE IMPERIAL SHOCK CAPTAIN, PHASE B.2, AT GAMEPLAY SCALE.
//
//   node tests/shot-captain.mjs [tag]
//
// THE ENLARGED SHEET IS NOT THE REVIEW. `HANDOVER.md` §10af: 1x on a real arena
// floor under the real HUD inset is the acceptance authority, and an animation
// approved off a zoomed sprite strip is an animation nobody has actually seen.
// Every frame here is the live game at 720x1280 with nothing scaled.
//
// A PAUSED SCENE STILL RENDERS, and a paused camera cannot be overwritten by
// the director — so the scroll is placed by hand and stays placed. The camera
// flash, the room banner and the sector tint are all killed at the shutter for
// the reasons `§10y` records.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 'b2';
const OUT = `docs/evidence/champion-reset/${TAG}`;
const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
const errs = [];
page.on('pageerror', (e) => { errs.push(String(e)); console.error('PAGE ERROR', e); });

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
  gs.loadRoom(ROOMS.find((r) => r.id === 'hangar'));
  await new Promise((r) => setTimeout(r, 2200));
  gs.player.hp = gs.player.hpMax; gs.lives = 9999;
});
await page.waitForTimeout(4200);

const hush = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs._sectorTint?.setAlpha(0);
  gs.cameras.main.resetFX();
  const hud = window.game.scene.getScene('HUD');
  hud?.hud?.banner?.setAlpha(0);
  gs.player.hp = gs.player.hpMax;
});
const pause = (on) => page.evaluate((f) => {
  const gs = window.game.scene.getScene('Game');
  if (f) gs.scene.pause(); else gs.scene.resume();
}, on);
const shot = async (n) => { writeFileSync(`${OUT}/${n}.png`, await page.screenshot()); console.log('  ', n); };

// ── THE ACTOR, IN THE REAL PIPELINE ───────────────────────────────────────
// `spawnChampion` is the production-shaped path: same group, same wall
// collider, same RoomManager registration, same nav grid. Only the class
// differs from an ordinary enemy.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.player.setPosition(700, 900); gs.player.setVelocity(0, 0);
  window.__cap = gs.spawnChampion(1050, 640, 'captain');
});
await page.waitForTimeout(400);

// ── 1. THE LOOP, RUNNING ──────────────────────────────────────────────────
// Sampled from inside the page on `postupdate`: a `page.evaluate` poll costs
// 200-400ms a round trip and would miss most of a 380ms brace.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  window.__log = { states: {}, transitions: [], shots: 0, anims: {}, moved: 0, frames: 0 };
  let last = null, lx = null, ly = null;
  window.__hook = () => {
    const c = window.__cap;
    if (!c?.alive || !c.anims || !c.scene) return;
    const L = window.__log;
    L.frames++;
    L.states[c._cap] = (L.states[c._cap] || 0) + 1;
    const key = c.anims.currentAnim?.key;
    if (key) L.anims[key] = (L.anims[key] || 0) + 1;
    if (c._cap !== last) { L.transitions.push(c._cap); last = c._cap; }
    if (lx !== null) L.moved += Math.hypot(c.x - lx, c.y - ly);
    lx = c.x; ly = c.y;
  };
  gs.events.on('postupdate', window.__hook);
  gs.events.on('champion-armour-broken', () => { window.__log.armourBroken = true; });
  const fire = gs.fireCaptainBolt.bind(gs);
  gs.fireCaptainBolt = (...a) => { window.__log.shots++; return fire(...a); };
});
await page.waitForTimeout(14000);
const log = await page.evaluate(() => window.__log);
console.log('  loop  states:', JSON.stringify(log.states));
console.log('  loop  transitions:', log.transitions.slice(0, 18).join(' -> '));
console.log('  loop  shots:', log.shots, ' travelled:', Math.round(log.moved), 'px over', log.frames, 'frames');
console.log('  loop  anims:', JSON.stringify(log.anims));

// ── 2. STATIONS ───────────────────────────────────────────────────────────
// The state machine picks these in play; here each one is held so the shutter
// can land inside it. Nothing about the BODY is staged — the pose, the facing
// and the weapon all come from the same code the live loop runs.
const station = async (name, setup, settleMs = 260) => {
  await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
  await page.evaluate(setup);
  await page.waitForTimeout(settleMs);
  await hush();
  await pause(true);
  await page.waitForTimeout(200);
  await shot(name);
};

// THE ARENA IS QUIETED AT EVERY STATION, AND ONLY THE ARENA. The Captain's own
// body, pose, facing, weapon and FX are whatever the live code produces — what
// is switched off is the drip and OTHER enemies' fire, because a trooper bolt
// crossing the frame and a damage number over the subject are not evidence
// about the subject.
const place = `
  const gs = window.game.scene.getScene('Game');
  const c = window.__cap;
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => { if (e !== c) gs._destroyEnemyFully(e); });
  gs.hostileBullets.forEach((g) => g.getChildren().forEach((b) => b.active && b.kill()));
  gs.player.hp = gs.player.hpMax;
  gs.cameras.main.stopFollow?.();
`;

await station('01-idle-in-crowd', new Function(`
  ${place}
  gs.arenaActive = false;
  gs.player.setPosition(620, 980);
  c.setPosition(700, 620); c.setVelocity(0, 0);
  c._cap = 'recover'; c._stateMs = 10;
  [[420,560],[560,480],[880,520],[980,680],[520,760],[900,820]].forEach(([x,y],i) => {
    const e = gs.spawnEnemyAt(i % 2 ? 'shooter' : 'grunt', x, y);
    if (e) { e.fireCd = 1e9; e.state = 1; }
  });
  gs.cameras.main.setScroll(700 - gs.cameras.main.width / 2, 800 - gs.cameras.main.height / 2);
`), 700);

await station('02-walk', new Function(`
  ${place}
  gs.player.setPosition(360, 980);
  c.setPosition(1080, 620);
  c._cap = 'advance'; c._stateMs = 4000;
  c._target = { x: 500, y: 900 };
  gs.cameras.main.setScroll(760 - gs.cameras.main.width / 2, 790 - gs.cameras.main.height / 2);
`), 900);

await station('03-strafe', new Function(`
  ${place}
  gs.player.setPosition(700, 980);
  c.setPosition(700, 620);
  c._cap = 'strafe'; c._stateMs = 4000; c._side = 1;
  c._target = { x: 1150, y: 620 };
  gs.cameras.main.setScroll(760 - gs.cameras.main.width / 2, 790 - gs.cameras.main.height / 2);
`), 700);

await station('04-brace', new Function(`
  ${place}
  gs.player.setPosition(700, 980);
  c.setPosition(700, 620); c.setVelocity(0,0);
  c._cap = 'brace'; c._stateMs = 4000;
  gs.cameras.main.setScroll(700 - gs.cameras.main.width / 2, 800 - gs.cameras.main.height / 2);
`), 240);

await station('05-fire', new Function(`
  ${place}
  gs.player.setPosition(700, 980);
  c.setPosition(700, 620); c.setVelocity(0,0);
  c._cap = 'burst'; c._stateMs = 4000; c._round = 3; c._roundGap = 0; c._fireCd = 0;
  gs.cameras.main.setScroll(700 - gs.cameras.main.width / 2, 800 - gs.cameras.main.height / 2);
`), 90);

await station('06-recoil', new Function(`
  ${place}
  const c2 = window.__cap;
  c2._cap = 'burst'; c2._shotFlashMs = 30; c2._wKick = 12; c2._round = 2; c2._roundGap = 160;
`), 0);

await station('07-heavy-hit', new Function(`
  ${place}
  gs.player.setPosition(700, 980);
  c.setPosition(700, 620); c.setVelocity(0,0);
  c._staggerCd = 0;
  c.damage(900, { x: 0, y: -260 });
`), 120);

await station('08-armour-break', new Function(`
  ${place}
  gs.player.setPosition(700, 980);
  c.setPosition(700, 620); c.setVelocity(0,0);
  c.armour = 120; c._staggerCd = 9999;
  c.damage(3000, { x: 0, y: -120 });
`), 100);

await station('09-damaged-state', new Function(`
  ${place}
  gs.player.setPosition(700, 980);
  c.setPosition(700, 620); c.setVelocity(0,0);
  c._cap = 'brace'; c._stateMs = 4000;
`), 320);

await station('10-damaged-in-crowd', new Function(`
  ${place}
  [[420,560],[560,480],[880,520],[980,680],[520,760],[900,820]].forEach(([x,y],i) => {
    const e = gs.spawnEnemyAt(i % 2 ? 'shooter' : 'grunt', x, y);
    if (e) { e.fireCd = 1e9; e.state = 1; }
  });
  gs.player.setPosition(620, 980);
  c.setPosition(700, 620);
  c._cap = 'recover'; c._stateMs = 10;
  gs.cameras.main.setScroll(700 - gs.cameras.main.width / 2, 800 - gs.cameras.main.height / 2);
`), 320);

// ── 11. THE MUZZLE FLASH, CAUGHT ──────────────────────────────────────────
// SHORT-LIVED FX CANNOT BE SCREENSHOTTED AT ~20fps. The flash is a 95ms tween;
// by the time a `page.evaluate` round trip and a `scene.pause()` have landed it
// is gone. Freeze the tween clock FIRST, then fire, then shoot the frame.
await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
await page.waitForTimeout(200);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const c = window.__cap;
  gs.arenaActive = false;
  gs.player.setPosition(700, 980); gs.player.hp = gs.player.hpMax;
  c.setPosition(700, 620); c.setVelocity(0, 0);
  c._aim = Math.atan2(980 - 620, 0);
  gs.cameras.main.stopFollow?.();
  gs.cameras.main.setScroll(700 - gs.cameras.main.width / 2, 800 - gs.cameras.main.height / 2);
  gs.cameras.main.resetFX();
  window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
  gs.tweens.timeScale = 0;
  gs.physics.world.pause();
  c._cap = 'burst'; c._shotFlashMs = 110;
  c._fireRound(gs.player);
  gs.scene.pause();
});
await page.waitForTimeout(250);
await shot('11-muzzle-flash');

// ── 12. THE MATCHED PAIR ──────────────────────────────────────────────────
// Intact and broken, same station, same pose, same light. "The silhouette
// changes" is a claim about a DIFFERENCE, and a difference needs both halves in
// one frame or the reader is comparing against a memory. A FRESH ROOM first:
// sweeping a live arena leaves the drip, the wave and half a crowd behind, and
// an earlier build of this station photographed exactly that.
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  gs.scene.resume();
  gs.tweens.timeScale = 1;
  gs.physics.world.resume();
  gs.events.off('postupdate', window.__hook);
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.loadRoom(ROOMS.find((r) => r.id === 'hangar'));
});
await page.waitForTimeout(3200);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.player.setPosition(710, 1080); gs.player.hp = gs.player.hpMax; gs.lives = 9999;
  const a = gs.spawnChampion(580, 700, 'captain');
  const b = gs.spawnChampion(840, 700, 'captain');
  b.armour = 1; b._staggerCd = 9999; b.damage(600, null);
  window.__pair = [a, b];
});
await page.waitForTimeout(900);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  window.__pair.forEach((c, i) => {
    c.setPosition(i ? 840 : 580, 700);
    c.setVelocity(0, 0);
    c._aim = Math.PI / 2;
    c._cap = 'brace'; c._stateMs = 9999; c._fireCd = 9e9;
  });
});
await page.waitForTimeout(400);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.enemies.getChildren().slice().forEach((e) => { if (!e.isChampion) gs._destroyEnemyFully(e); });
  gs.hostileBullets.forEach((g) => g.getChildren().forEach((b) => b.active && b.kill()));
  gs.cameras.main.stopFollow?.();
  gs.cameras.main.setScroll(710 - gs.cameras.main.width / 2, 800 - gs.cameras.main.height / 2);
  gs.cameras.main.resetFX();
  gs._sectorTint?.setAlpha(0);
  window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
  gs.scene.pause();
});
await page.waitForTimeout(300);
await shot('12-intact-vs-broken');

const state = await page.evaluate(() => {
  const c = window.__pair ? window.__pair[1] : window.__cap;
  return { hp: Math.round(c.hp), hpMax: c.hpMax, armour: Math.round(c.armour),
    broken: c.armourBroken, prefix: c._animPrefix, tex: c.texture.key,
    anim: c.anims.currentAnim?.key };
});
console.log('  final:', JSON.stringify(state));
if (errs.length) console.log('  PAGE ERRORS:', errs.slice(0, 4));
await browser.close();
