// EVIDENCE — THE TACTICAL STEP AT A REAL 60fps, FRAME BY FRAME.
//
//   node tests/shot-captain-step-seq.mjs <outDir>
//
// WHY THIS RIG EXISTS. The whole step is 425ms and this harness renders near
// 12fps, so a rig that polls for a beat sees ~5 frames of it and misses the
// 90ms plant outright. Worse, the older rig armed its pause hook in a SECOND
// page.evaluate, 200-400ms after starting the step — by which time the step
// was over, and it photographed whatever step his AI took next, somewhere
// else in the room. So this one takes the game loop off the RAF and ADVANCES
// IT BY HAND at 1000/60ms per step: every beat is sampled exactly as a phone
// at 60fps would draw it, through the real update and render paths, and the
// same script can be run against any older build of `ShockCaptain.js` for a
// matched A/B. The only things the rig decides are where, which way, and the
// camera; every value the step reads is production config.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = process.argv[2] || 'docs/evidence/champion-reset/v6';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(`${OUT}/seq`, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', String(e).slice(0, 300)));

await page.goto('http://localhost:5173/?nodlg=1&nofreeze=1&champdbg=1');
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 707 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.loadRoom(ROOMS.find((r) => r.id === 'hangar'));
  gs._roomMod = null;
  await new Promise((r) => setTimeout(r, 2200));
  gs.lives = 9999;
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.player.setPosition(700, 1040); gs.player.setVelocity(0, 0);
  const c = gs.spawnChampion(700, 720, 'captain');
  c.die = () => { c.hp = Math.max(c.hp, 900); };
  window.__cap = c;
  // ── THE LOOP, BY HAND ────────────────────────────────────────────────
  const g = window.game;
  g.loop.sleep();
  window.__t = performance.now();
  window.__adv = (n = 1) => {
    for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); }
  };
  window.__quiet = () => {
    c._nadeCd = 1e9;
    gs.hostileBullets.forEach((grp) => grp.getChildren().forEach((b) => b.disableBody?.(true, true)));
    const cam = gs.cameras.main;
    cam.stopFollow(); cam.resetFX();
    gs._sectorTint?.setAlpha(0);
    window.game.scene.getScene('HUD')?.hud?.banner?.setAlpha(0);
  };
});
await page.evaluate(() => window.__adv(90));   // settle the room at 60fps

const cropAt = async (file, w = 420) => {
  const at = await page.evaluate(() => {
    const cam = window.game.scene.getScene('Game').cameras.main;
    const f = window.__focus;
    return { x: f.x - cam.scrollX, y: f.y - cam.scrollY + cam.y };
  });
  const x = Math.max(0, Math.min(720 - w, Math.round(at.x - w / 2)));
  const y = Math.max(0, Math.min(1280 - w, Math.round(at.y - w / 2)));
  writeFileSync(file, await page.screenshot({ clip: { x, y, width: w, height: w } }));
};

// ── THE STEP: begin, then one frame at a time ────────────────────────────
const begun = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const c = window.__cap;
  window.__quiet();
  c.setPosition(700, 720); c.setVelocity(0, 0);
  c._cap = 'hold'; c._stateMs = 0; c._stepCd = 0;
  const d = c.def.step;
  window.__focus = { x: 700 - d.distance / 2, y: 740 };
  gs.cameras.main.centerOn(window.__focus.x, window.__focus.y);
  window.__adv(1);                 // one quiet frame with the camera placed
  c._stepCd = 0;
  c._beginStep(gs.player, 'close', { x: c.x - d.distance, y: c.y, reach: d.distance });
  c._stepCd = 1e9;                 // his AI may not start a second one inside this
  return c._cap;
});
if (begun !== 'step') { console.log('!! step refused', begun); process.exit(1); }

// Stations are chosen from the actor's own state on each frame, never from
// a frame index guessed in advance.
const want = {
  '31-plant': (s, seen) => s.cap === 'step' && s.plant > 0 && s.plant < 50,
  '33-launch': (s, seen) => s.cap === 'step' && s.plant <= 0 && s.moved > 20,
  '34-early-travel': (s) => s.cap === 'step' && s.state > s.catchMs && s.moved > 80,
  '35-late-travel': (s) => s.cap === 'step' && s.state > s.catchMs && s.moved > 160,
  '36-FIRST-CATCH': (s) => s.cap === 'step' && s.state <= s.catchMs,
  '36b-HERO-FRAME': (s) => s.cap === 'step' && s.state <= s.catchMs - 30,
  '37-settle': (s) => s.cap !== 'step' && s.sinceEnd >= 5,
};
const taken = new Set();
const log = [];
let endFrame = null;
for (let f = 0; f < 48; f++) {
  await page.evaluate(() => window.__adv(1));
  const s = await page.evaluate(() => {
    const c = window.__cap;
    return { cap: c._cap, plant: c._stepPlantMs, state: c._stateMs, catchMs: c.def.step.catchMs,
      moved: Math.round(Math.abs(c.x - 700)),
      fx: c._reactFx.map((o) => o._role || o.type).join(',') };
  });
  if (s.cap !== 'step' && endFrame == null) endFrame = f;
  s.sinceEnd = endFrame == null ? -1 : f - endFrame;
  log.push(`${String(f).padStart(2)} ${s.cap.padEnd(6)} plant ${Math.round(s.plant).toString().padStart(4)} state ${Math.round(s.state).toString().padStart(4)} moved ${String(s.moved).padStart(3)}  ${s.fx}`);
  await cropAt(`${OUT}/seq/f${String(f).padStart(2, '0')}.png`);
  for (const [name, test] of Object.entries(want)) {
    if (!taken.has(name) && test(s)) {
      taken.add(name);
      writeFileSync(`${OUT}/${name}-1x.png`, await page.screenshot());
      await cropAt(`${OUT}/${name}-crop.png`);
      console.log('  ', name, `@f${f}`);
    }
  }
  if (s.sinceEnd >= 8) break;
}
writeFileSync(`${OUT}/seq/frames.txt`, log.join('\n') + '\n');
for (const n of Object.keys(want)) if (!taken.has(n)) console.log('!! station never reached', n);

// ── THE PLAYER DASH, SAME ROOM, SAME CAMERA RULE, SAME 60fps ─────────────
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const c = window.__cap;
  window.__quiet();
  c.setPosition(700, 470); c.setVelocity(0, 0); c._cap = 'hold'; c._stateMs = 1e9;
  const p = gs.player;
  p.setPosition(700, 740); p.setVelocity(0, 0); p.alive = true;
  p.dashCharges = 3; p.isDashing = false;
  p.facing = Math.PI; p._moveTargetX = -1; p._moveTargetY = 0;
  window.__dashFrom = { x: p.x, y: p.y };
  window.__focus = { x: 600, y: 740 };
  gs.cameras.main.centerOn(window.__focus.x, window.__focus.y);
  window.__adv(1);
  p.tryDash();
});
let dashShot = false;
for (let f = 0; f < 40 && !dashShot; f++) {
  await page.evaluate(() => window.__adv(1));
  const m = await page.evaluate(() => {
    const p = window.game.scene.getScene('Game').player;
    return { dashing: !!p.isDashing, moved: Math.round(Math.hypot(p.x - window.__dashFrom.x, p.y - window.__dashFrom.y)) };
  });
  if (m.dashing && m.moved > 90) {
    writeFileSync(`${OUT}/41-DASH-1x.png`, await page.screenshot());
    await cropAt(`${OUT}/41-DASH-crop.png`);
    console.log('   41-DASH', `@f${f}`, `moved ${m.moved}`);
    dashShot = true;
  }
}
if (!dashShot) console.log('!! dash frame never reached');

await browser.close();
