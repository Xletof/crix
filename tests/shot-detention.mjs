// EVIDENCE — THE DETENTION BLOCK, matched stations, before and after.
//
//   node tests/shot-detention.mjs detention-before
//   node tests/shot-detention.mjs detention-after
//
// THE ROOM, IN WORLD PIXELS. 1600x1400 — the WIDEST arena in the game, and the
// only one whose long axis is EAST-WEST. Spawn (150,700) on the west edge,
// exit (1450,700) on the east: a straight traverse across the room's width.
// Two objectives, diagonally opposed at (500,450) and (1100,950). Eight cover
// bodies, five props. `walls` is EMPTY — the deck is completely open.
//
// THE CAMERA CLAMPS, AND THEY ARE ASYMMETRIC HERE. 720x1196 of viewport inside
// 1600x1400 pins the camera centre inside x [360, 1240] and y [598, 802]. So
// the room's full WIDTH is reachable — the only arena where that is true — and
// its height is not: with the touch controls over the bottom of the screen,
// world y beyond about 1100 is behind the joysticks from every position the
// player can reach. Every station below is a place the player can actually be.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAG = process.argv[2] || 'detention-after';
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
  gs.loadRoom(ROOMS.find((r) => r.id === 'detention'));
  // ENDLESS ROLLS A NEW ROOM MODIFIER ON EVERY ROOM LOAD, and one of them is
  // DARKNESS. A matched pair must differ only in the thing under test.
  gs._roomModifier = null;
  gs.events.emit('modifier-active', null, null);
  await new Promise((r) => setTimeout(r, 2200));
  gs.player.hp = gs.player.hpMax; gs.lives = 9999;
  gs._sectorTint?.setAlpha(0);
});
await page.waitForTimeout(4200);

// Prove the room that got loaded is the room being photographed. A debug tool
// that silently fails leaves you with a beautiful set of Hangar screenshots.
const where = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  return { id: gs.roomSpec?.id, w: gs.physics.world.bounds.width, h: gs.physics.world.bounds.height };
});
console.log('  room:', JSON.stringify(where));
if (where.id !== 'detention') { console.error('  !! WRONG ROOM — aborting'); await browser.close(); process.exit(1); }

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
  const p = gs.player;
  if (p && !p.alive) { p.alive = true; p.setActive(true).setVisible(true).setAlpha(1); }
  if (p) p.hp = p.hpMax;
  if (!b) return;
  b._blackoutT = F; b._afterimageT = F; b._disarmT = F; b._sunderT = F;
  b._reflectT = F; b.cooldown = F; b._moveT = F; b._attackT = F;
  b.state = 'idle';
  b.hp = b.hpMax;
});
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
  // re-raised after the room banner — both re-asserted at the shutter.
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
// A REFUSED CAST READS EXACTLY LIKE A FAILED ONE. `_castBossMove` matches the
// registry's own id, which is LOWERCASE, and it refuses outright once the
// player is dead — and staging Vader beside the player is what kills them.
const cast = async (id) => {
  const r = await page.evaluate((f) => {
    const gs = window.game.scene.getScene('Game');
    if (gs.boss) gs.boss.state = 'idle';
    const b = gs.boss;
    const why = !gs.player?.alive ? 'player dead'
      : !b?.alive ? 'no boss'
      : b._activeMove && b._activeMove.phase !== 'done' ? `busy:${b._activeMove.id}/${b._activeMove.phase}`
      : b.isGuarding?.() ? 'guarding'
      : b.state && b.state !== 'idle' ? `state:${b.state}` : '';
    return { ok: !!gs._castBossMove?.(gs.boss, f), why };
  }, id);
  if (!r.ok) { console.error(`  !! CAST REFUSED: ${id} (${r.why || 'unknown'}) — the frame that follows is not that move`); return false; }
  // ASSERT THE MOVE ACTUALLY ENTERED. A cast that returns truthy and then gets
  // overwritten is the same lie one step later.
  const ran = await page.evaluate((f) => {
    const b = window.game.scene.getScene('Game').boss;
    // The handle carries the registry entry as `move`, not a bare `id` —
    // asking for `_activeMove.id` is undefined for every move ever cast.
    return b?._activeMove?.move?.id === f ? b._activeMove.phase : null;
  }, id);
  if (!ran) console.error(`  !! ${id} did not enter — no active move with that id`);
  else console.log(`     ${id} -> ${ran}`);
  return !!ran;
};
const wave = (n) => page.evaluate((k) => {
  const gs = window.game.scene.getScene('Game');
  const types = ['grunt', 'shooter', 'grunt', 'shielded', 'sniper', 'grunt', 'bomber', 'shooter'];
  for (let i = 0; i < k; i++) gs.spawnEnemyRandom(types[i % types.length]);
}, n);

// ── THE STATIONS. Player positions, not camera positions: the camera follows
//    the player and clamps, so a `centerOn` alone is overwritten next frame.
const STATIONS = [
  ['spawn',      150,  700],  // the west edge, looking into the room
  ['centre',     800,  700],  // the exact middle
  ['obj-nw',     500,  598],  // the first objective, north-west
  ['obj-se',    1100,  802],  // the second objective, south-east
  ['exit',      1450,  700],  // the east door
  ['corner-nw',  360,  598],  // north-west clamp
  ['corner-se', 1240,  802],  // south-east clamp
  ['post',       360,  802],  // the security post, such as it is
];

console.log('— normal power —');
await clearAll(); await setDark(false); await page.waitForTimeout(250);
for (const [name, px, py] of STATIONS) {
  await place(px, py);
  await page.waitForTimeout(220);
  await pause(true); await shot(`normal-${name}`); await pause(false);
}

console.log('— dense normal wave —');
await wave(12); await page.waitForTimeout(1600);
await place(800, 700); await page.waitForTimeout(400);
await pause(true); await shot('normal-wave'); await pause(false);
await clearAll();

console.log('— lights out, quiet room —');
await setDark(true); await page.waitForTimeout(250);
for (const [name, px, py] of STATIONS) {
  await place(px, py);
  await page.waitForTimeout(220);
  await setDark(true);
  await pause(true); await shot(`dark-${name}`); await pause(false);
}

console.log('— dense dark wave —');
await wave(12); await page.waitForTimeout(1600);
await place(800, 700); await setDark(true); await page.waitForTimeout(400);
await pause(true); await shot('dark-wave'); await pause(false);
await clearAll();

// ── MOTION along the room's long axis, which is the axis it is composed on.
//    Two runs, and the second is the one that matters: the cell bank is a
//    repeated module at a 176px period with five slats in every mouth, which
//    is precisely the construction that beats against the pixel grid and
//    crawls as the camera pans. Run at y 598 — the camera's northern clamp —
//    so the north band is actually in frame for the whole sweep. At y 700 it
//    is not: the camera centre sits at 700, its top edge at 102, and the band
//    ends at 96.
console.log('— motion, east along the walk —');
for (let i = 0; i < 7; i++) {
  await place(360 + i * 150, 700);
  await page.waitForTimeout(120);
  await setDark(false);
  await pause(true); await shot(`pan-e-${String(i).padStart(2, '0')}`); await pause(false);
}
console.log('— motion, east along the cell bank (shimmer check) —');
for (let i = 0; i < 8; i++) {
  await place(380 + i * 44, 598);
  await page.waitForTimeout(110);
  await setDark(false);
  await pause(true); await shot(`pan-cells-${String(i).padStart(2, '0')}`); await pause(false);
}
await clearAll();

// ── COMBAT HIERARCHY. Vader is the stress test, not the campaign logic.
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  if (!gs.boss?.alive) { gs.spawnBoss(900, 700); await new Promise((r) => setTimeout(r, 800)); }
});
await hush(); await page.waitForTimeout(300);

console.log('— vader, normal —');
await setDark(false); await clearAll(); await hush();
await place(800, 700, 980, 640); await page.waitForTimeout(300);
await pause(true); await shot('vader-normal'); await pause(false);

console.log('— vader, lights out —');
await setDark(true); await page.waitForTimeout(250);
await place(800, 700, 980, 640); await page.waitForTimeout(300);
await setDark(true);
await pause(true); await shot('dark-vader'); await pause(false);

const MOVES = [
  ['saberthrow', 800, 700, 620, 700, 420],
  ['forcepull',  800, 700, 980, 640, 380],
  ['forcepush',  800, 700, 900, 640, 380],
  ['sabercombo', 800, 700, 880, 680, 340],
];
for (const [id, px, py, bx, by, wait] of MOVES) {
  await hush(); await clearAll(); await settle();
  await place(px, py, bx, by);
  await page.waitForTimeout(200);
  const ok = await cast(id);
  await page.waitForTimeout(wait);
  await setDark(true);
  await pause(true); await shot(`dark-${id}${ok ? '' : '-REFUSED'}`); await pause(false);
}

console.log('— afterimages —');
await hush(); await clearAll();
await place(800, 700, 980, 640);
await page.evaluate(() => { const gs = window.game.scene.getScene('Game'); gs.boss?.emit?.('boss-afterimages'); gs.events.emit('boss-afterimages', gs.boss); });
await page.waitForTimeout(700);
await setDark(true);
await pause(true); await shot('dark-afterimages'); await pause(false);

await browser.close();
console.log(`\nwrote ${OUT}`);
