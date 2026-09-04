// EVIDENCE — DETENTION'S POWERED CONSOLE FACES, before and after.
//
//   node tests/shot-detention-face.mjs detention-cf-before
//   node tests/shot-detention-face.mjs detention-cf-after
//
// ONE QUESTION: does the console contain its own light, or is the light behind
// it? Two of the frames are taken at CAMERA ZOOM 2 for that reason and nothing
// else — a 112px console at gameplay distance is 112 screen pixels, and the
// difference between a lit display and a lit haze cannot be judged there. The
// zoomed pair is the diagnostic; every other frame is the composition, at the
// distance the game is actually played at.
//
// A SMALL, TARGETED SET. `shot-detention.mjs` photographs the whole room at
// forty stations; this one asks ONE question — what is on screen when the
// power is out — and the frames are chosen so a human can answer it on a
// phone. The pan exists because a floor reflection is the one thing that can
// look right in a still and crawl in motion.
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

const TAG = process.argv[2] || 'detention-cf-after';
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
// THE CAMERA LERPS AT 0.22 AND THE HARNESS RUNS AT ~20FPS, so 240ms after a
// 400px jump the camera is still ~29% of the way behind — which photographs as
// a station that is not the station asked for. The follow is snapped to lerp 1
// for the whole rig: in play the camera HAS caught up by the time the player is
// standing still, so the snapped frame is the honest one.
const place = (px, py, bx, by) => page.evaluate(([x, y, ox, oy]) => {
  const gs = window.game.scene.getScene('Game');
  gs.arenaActive = false;
  gs.player.setPosition(x, y); gs.player.setVelocity(0, 0);
  if (gs.boss?.alive && ox != null) { gs.boss.setPosition(ox, oy); gs.boss.setVelocity(0, 0); }
  // STOP THE FOLLOW AND SET THE SCROLL. The live follow lerps at 0.22 and
  // carries an offset that measured 50px in one direction on one run of this
  // rig and 50px the other way on the next — which is 100px of disagreement
  // between two halves of a matched pair. The camera is placed by hand here
  // and the world bounds still clamp it, so every frame in a pair is taken
  // from the same square metre.
  const c = gs.cameras.main;
  c.stopFollow();
  c.setScroll(x - c.width / 2, y - c.height / 2);
}, [px, py, bx, by]);
// LOOK AT SOMETHING THE PLAYER IS NOT STANDING ON. A console is a solid body,
// so the only way to put one in the middle of the frame is to place the player
// beside it and then move the camera off them by hand. `midPoint` is
// `scroll + size / 2` whatever the zoom is, so this composes with `look`.
const aim = (cx, cy) => page.evaluate(([x, y]) => {
  const c = window.game.scene.getScene('Game').cameras.main;
  c.stopFollow();
  c.setScroll(x - c.width / 2, y - c.height / 2);
}, [cx, cy]);
// ZOOM IS A DIAGNOSTIC, NOT A COMPOSITION. Reset to 1 for every frame that is
// being judged as a picture of the room.
const look = (z) => page.evaluate((k) => {
  window.game.scene.getScene('Game').cameras.main.setZoom(k);
}, z);
// SETTLE, THEN RE-PLACE. Physics can nudge the player off the spot in the
// frames after it is set, and 30px of camera drift is enough to make a matched
// pair stop being matched. Placing twice costs 80ms and removes the drift.
const station = async (px, py) => {
  for (let i = 0; i < 6; i++) {
    await place(px, py); await page.waitForTimeout(i ? 120 : 300);
    const at = await page.evaluate(([x, y]) => {
      const p = window.game.scene.getScene('Game').player;
      return Math.hypot(p.x - x, p.y - y);
    }, [px, py]);
    if (at < 3) { await page.waitForTimeout(60); await place(px, py); return true; }
  }
  console.error(`  !! player would not stay at ${px},${py}`);
  return false;
};
// Prove it. A station that photographs the wrong place is the whole class of
// failure this project has already paid for twice.
const atStation = (px, py) => page.evaluate(([x, y]) => {
  const gs = window.game.scene.getScene('Game'), c = gs.cameras.main;
  return { sx: Math.round(c.scrollX), sy: Math.round(c.scrollY),
           vh: c.height, vy: c.y,
           px: Math.round(gs.player.x), py: Math.round(gs.player.y),
           dx: Math.round(c.midPoint.x - x), dy: Math.round(c.midPoint.y - y) };
}, [px, py]);
const pause = (on) => page.evaluate((f) => {
  const gs = window.game.scene.getScene('Game');
  // A PAUSED SCENE FREEZES A CAMERA FLASH FOREVER, and `_sectorTint` is
  // re-raised after the room banner — both re-asserted at the shutter.
  // A ROOM BANNER IS HUD TEXT LYING OVER THE FRAME. `loadRoom` schedules an
  // objective hint on a delay, so it can arrive minutes into a rig run and
  // photograph as a headline across the arena. Killed at the shutter, with the
  // camera flash and the sector tint, for the same reason.
  if (f) {
    const hud = window.game.scene.getScene('HUD');
    if (hud?.banner) { hud.tweens?.killTweensOf?.(hud.banner); hud.banner.setAlpha(0).setVisible(false); }
    gs._sectorTint?.setAlpha(0); gs.cameras.main.resetFX?.(); gs.scene.pause();
  }
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


// ── THE STATIONS. Player positions, not camera positions.

// THE THREE POWERED CONSOLES. Five of detention's eight cover objects are
// benches and declare no light at all; these are the three that do.
const POWERED = [
  ['heavy', 1000, 700, 1000, 800],   // the checkpoint's east side, ch-con-heavy
  ['lock',   600, 700,  600, 800],   // the checkpoint's west side, dt-con-lock
  ['bank',  1200, 300, 1200, 420],   // the north bank's terminal, ch-con-ped-a
];

console.log('— lights out: the console itself, at zoom 2 —');
await clearAll(); await setDark(true); await page.waitForTimeout(300);
for (const [name, cx, cy, px, py] of POWERED) {
  await station(px, py); await look(2); await aim(cx, cy); await setDark(true);
  await page.waitForTimeout(160);
  await pause(true); await shot(`dark-near-${name}`); await pause(false);
  await look(1);
}

console.log('— lights out: at the distance the game is played —');
const OPEN = [
  ['centre',   800,  700],   // dead centre — both checkpoint consoles in frame
  ['gate',    1240,  700],   // the processing gate, with the east console
  ['bank',    1200,  420],   // the north bank terminal at gameplay distance
];
for (const [name, px, py] of OPEN) {
  await station(px, py); await setDark(true);
  console.log('     cam', JSON.stringify(await atStation(px, py)));
  await pause(true); await shot(`dark-${name}`); await pause(false);
}

// A SHORT PAN PAST ONE POWERED CONSOLE. Four frames at 120px steps across the
// checkpoint. What this is for is REGISTRATION: a face that is not bolted to
// its console slides against it as the camera moves, and a still cannot show
// that.
console.log('— pan past the checkpoint —');
for (let i = 0; i < 4; i++) {
  await station(760 + i * 120, 700); await setDark(true);
  await pause(true); await shot(`dark-pan-0${i}`); await pause(false);
}

console.log('— dense wave, lights out —');
await wave(12); await page.waitForTimeout(1700);
await place(880, 700); await page.waitForTimeout(400); await setDark(true);
await pause(true); await shot('dark-wave'); await pause(false);
await clearAll();

console.log('— normal power control —');
await setDark(false); await page.waitForTimeout(300);
await station(1000, 800); await look(2); await aim(1000, 700);
await page.waitForTimeout(160);
await pause(true); await shot('normal-near-heavy'); await pause(false);
await look(1);
for (const [name, px, py] of [['centre', 800, 700], ['gate', 1240, 700]]) {
  await station(px, py);
  console.log('     cam', JSON.stringify(await atStation(px, py)));
  await pause(true); await shot(`normal-${name}`); await pause(false);
}

// ── LATE VADER. The hierarchy question, and the one the brief is strictest
//    about: once combat starts the console must fall away. Forced moves use
//    the registry's own lowercase ids and every cast is asserted to have
//    ENTERED — a refused cast reads exactly like a failed one.
console.log('— late Vader, lights out —');
await page.evaluate(() => window.game.scene.getScene('Game').spawnBoss?.());
await page.waitForTimeout(2600);
await hush();
const haveBoss = await page.evaluate(() => !!window.game.scene.getScene('Game').boss?.alive);
if (!haveBoss) console.error('  !! no boss — the Vader frames below are missing');
else {
  await setDark(true);
  await place(880, 760, 880, 560);
  await page.waitForTimeout(300); await settle(); await setDark(true);
  await pause(true); await shot('dark-vader'); await pause(false);

  await hush(); await place(880, 820, 880, 540);
  await page.waitForTimeout(250); await settle();
  if (await cast('saberthrow')) {
    await page.waitForTimeout(360); await setDark(true);
    await pause(true); await shot('dark-saberthrow'); await pause(false);
  }

  await hush(); await place(880, 780, 880, 580);
  await page.waitForTimeout(250); await settle();
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.events.emit('boss-afterimages', gs.boss);
  });
  await page.waitForTimeout(700); await setDark(true);
  await pause(true); await shot('dark-afterimages'); await pause(false);
}

console.log(`\n  wrote ${OUT}`);
await browser.close();
