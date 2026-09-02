// EVIDENCE — THE REACTOR CORE'S EMISSIVE STATE, matched stations.
//
//   node tests/shot-junction-reactor.mjs junction-reactor-before
//   node tests/shot-junction-reactor.mjs junction-reactor-after
//
// THE QUESTION. `prop-core` paints a vertical stack of amber slats behind a
// grille — art that claims the machine is powered — and under LIGHTS OUT that
// claim used to fail: the slats are inside `roomLayer`, so the blackout tint
// multiplies them toward black like any other painted pixel, and the room's
// only reactor light source was a radial `core` seated at the prop's BASE,
// under a 304x344 opaque sprite, at a depth below it. This rig photographs the
// machine in both power states from the stations the human will actually be
// standing in.
//
// THE ASSET, IN WORLD PIXELS. `prop-core` is 76x86 logical at scale 4 = 304x344,
// placed at (260, 400) with origin (0.5, 1) — so it occupies x 108..412,
// y 56..400. Its lit slot is logical x 32..44, y 28..53, which lands at world
// x 236..288, y 168..272.
//
// THE CAMERA CLAMPS, AND IT MATTERS MORE HERE THAN ANYWHERE. 720x1196 of
// viewport inside a 1400x1400 room pins the camera centre inside x [360, 1040]
// and y [598, 802]. The reactor sits at the room's north-west, so every station
// north or west of the clamp photographs the SAME frame — the stations below
// differ by moving the camera south and east, never north and west.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 'junction-reactor-after';
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
  // ENDLESS ROLLS A NEW ROOM MODIFIER ON EVERY ROOM LOAD, and one of them is
  // DARKNESS. A matched pair must differ only in the thing under test.
  gs._roomModifier = null;
  gs.events.emit('modifier-active', null, null);
  await new Promise((r) => setTimeout(r, 2200));
  gs.player.hp = gs.player.hpMax; gs.lives = 9999;
  gs._sectorTint?.setAlpha(0);
});
await page.waitForTimeout(4200);

const clearAll = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.arenaActive = false;
  gs._roomModifier = null;
  gs.events.emit('modifier-active', null, null);
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  const p = gs.player;
  if (p && !p.alive) { p.alive = true; p.setActive(true).setVisible(true).setAlpha(1); }
  if (p) p.hp = p.hpMax;
});
const hush = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss, F = 1e9;
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!b) return;
  b._blackoutT = F; b._afterimageT = F; b._disarmT = F; b._sunderT = F;
  b._reflectT = F; b.cooldown = F; b._moveT = F; b._attackT = F;
  // `_castBossMove` refuses unless his own state machine is idle, so a boss
  // left mid-charge by the previous frame silently swallows the next cast.
  // Silencing the clocks is not enough — the state has to be released too.
  b.state = 'idle';
  b.hp = b.hpMax;
  // STAGING VADER NEXT TO THE PLAYER KILLS THE PLAYER, and `_castBossMove`
  // refuses outright once `player.alive` is false — which is how three frames
  // came back filed under moves that never ran while every guard this rig
  // knew about reported clear. Restoring hp is not reviving.
  const p = gs.player;
  if (p && !p.alive) { p.alive = true; p.setActive(true).setVisible(true).setAlpha(1); }
  if (p) p.hp = p.hpMax;
});
// WAIT FOR HIM TO BE CASTABLE, rather than guessing at a delay. The three
// refusal conditions are a move still running, the DEFLECTION stance, and a
// non-idle state machine; this polls all three.
const settle = async () => {
  for (let i = 0; i < 40; i++) {
    const ok = await page.evaluate(() => {
      const b = window.game.scene.getScene('Game').boss;
      if (!b?.alive) return false;
      return (!b._activeMove || b._activeMove.phase === 'done') && !b.isGuarding?.() && (!b.state || b.state === 'idle');
    });
    if (ok) return true;
    await page.waitForTimeout(150);
  }
  console.error('  !! boss never became castable');
  return false;
};
const place = (px, py, bx, by) => page.evaluate(([x, y, ox, oy]) => {
  const gs = window.game.scene.getScene('Game');
  gs.player.setPosition(x, y); gs.player.setVelocity(0, 0);
  if (gs.boss?.alive && ox != null) { gs.boss.setPosition(ox, oy); gs.boss.setVelocity(0, 0); }
  gs.cameras.main.centerOn(x, y);
}, [px, py, bx, by]);
const pause = (on) => page.evaluate((f) => {
  const gs = window.game.scene.getScene('Game');
  // A PAUSED SCENE FREEZES A CAMERA FLASH FOREVER, and `_sectorTint` is
  // re-raised after the room banner — both have to be re-asserted at the
  // shutter rather than once at load.
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
// A REFUSED CAST READS EXACTLY LIKE A FAILED ONE, and this rig's ancestor
// proved it: `_castBossMove` matches on the registry's own id, which is
// lowercase (`saberthrow`, `forcepull`, `forcepush`), so a camelCase argument
// returns null, the boss's own state machine attacks instead, and the frame is
// filed under the name of a move that never ran. Every cast here is asserted.
const cast = async (id) => {
  const ok = await page.evaluate((f) => {
    const gs = window.game.scene.getScene('Game');
    // HIS STATE MACHINE RE-ARMS BETWEEN THE POLL AND THE CALL. `place` puts him
    // beside the player, so he leaves `idle` for `chase` within a frame or two
    // and the cast is refused however patiently it was waited for. Releasing
    // the state on the same tick as the cast is a STAGING step for a
    // photograph — the thing under test here is a light, not his AI.
    if (gs.boss) gs.boss.state = 'idle';
    const b = gs.boss;
    const why = !gs.player?.alive ? 'player dead'
      : !b?.alive ? 'no boss'
      : b._activeMove && b._activeMove.phase !== 'done' ? `busy:${b._activeMove.id}/${b._activeMove.phase}`
      : b.isGuarding?.() ? 'guarding'
      : b.state && b.state !== 'idle' ? `state:${b.state}` : '';
    return { ok: !!gs._castBossMove?.(gs.boss, f), why };
  }, id);
  if (!ok.ok) console.error(`  !! CAST REFUSED: ${id} (${ok.why || 'unknown'}) — the frame that follows is not that move`);
  return ok.ok;
};

// ── THE STATIONS. Every one of them is a place the reactor is meant to be
//    read from, and the last three are the room's own answer to "is it still
//    only environment?".
const STATIONS = [
  ['reactor-close',  300,  520],  // camera at its north-west clamp: the machine large
  ['reactor-mid',    470,  660],  // one step back, still whole
  ['reactor-room',   560,  740],  // the machine as part of a room rather than a subject
  ['reactor-south',  300,  820],  // looking north up the west band at it
  ['appr-w',         260,  700],  // the west approach — its guidance and the reactor together
  ['centre',         700,  700],  // the exact middle: the reactor at the frame's edge
  ['crossing-nw',    520,  520],  // the corner of the crossing nearest to it
];

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

// ── MOTION. The machine has to hold together as the camera slides past it,
//    which is the frame rate at which a stack of hard-edged shapes betrays
//    itself.
console.log('— motion, south past the reactor —');
for (let i = 0; i < 6; i++) {
  await place(300, 600 + i * 66);
  await page.waitForTimeout(110);
  await setDark(true);
  await pause(true); await shot(`pan-s-${String(i).padStart(2, '0')}`); await pause(false);
}
await clearAll();

// ── COMBAT HIERARCHY. The reactor must lose to every one of these, and the
//    saber has to stay unmistakably a different colour from it.
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  if (!gs.boss?.alive) { gs.spawnBoss(560, 560); await new Promise((r) => setTimeout(r, 800)); }
});
await hush(); await page.waitForTimeout(300);

console.log('— vader, lights out —');
await setDark(true); await page.waitForTimeout(250);

// The saber DIRECTLY beside the machine: the one frame where amber and crimson
// are adjacent and the separation claim is either true or it is not.
await place(420, 620, 360, 480);
await page.waitForTimeout(180); await setDark(true);
await pause(true); await shot('dark-vader-at-reactor'); await pause(false); await hush();

await place(560, 760, 420, 560);
await settle(); await cast('saberthrow'); await page.waitForTimeout(340);
await setDark(true);
await pause(true); await shot('dark-saber-throw'); await pause(false);
await hush(); await page.waitForTimeout(500);

await place(520, 700, 420, 560);
await settle(); await cast('forcepull'); await page.waitForTimeout(260);
await setDark(true);
await pause(true); await shot('dark-force-pull'); await pause(false);
await hush(); await page.waitForTimeout(400);

await place(520, 700, 420, 560);
await settle(); await cast('forcepush'); await page.waitForTimeout(260);
await setDark(true);
await pause(true); await shot('dark-force-push'); await pause(false);
await hush(); await page.waitForTimeout(400);

await place(520, 700, 420, 520);
await page.waitForTimeout(120);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.events.emit('boss-afterimages', gs.boss);
});
await page.waitForTimeout(420); await setDark(true);
await pause(true); await shot('dark-afterimages'); await pause(false);
await hush();

await browser.close();
console.log(`\nwrote ${OUT}`);
