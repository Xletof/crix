// Screenshots of Vader's moves, one frame per BEAT — the check no assertion
// can replace.
//
// Not a gate, a LOOK. The first version of these moves passed 17 assertions and
// was rejected on sight; two of its four moves drew nothing on the floor and a
// third put three red rectangles down in three seconds. Every one of those is
// obvious in a still and invisible to a count. `tests/README.md` says this
// project is heavily visual and that assertion counts have produced false
// passes here before; it was right again.
//
// ── Two harness traps this had to solve ──────────────────────────────────
//
// 1. THE CAMERA LERPS. It follows the player smoothly, so teleporting the pair
//    and freezing the world immediately catches the camera still travelling —
//    which is why the previous pass produced shots with the fight jammed
//    against the bottom edge behind the joysticks, and why I wrote the framing
//    off as "approximate" instead of fixing it. Settle the camera BEFORE the
//    cast, then freeze.
// 2. FREEZING MUST HAPPEN ON THE BEAT. The scene clock runs well behind the
//    wall at ~20 FPS, so a fixed sleep lands in the wrong beat. A postupdate
//    hook stops the clock on the exact frame the beat begins.
// 3. FREEZING TWEENS AND PHYSICS IS NOT FREEZING THE GAME. `scene.update` keeps
//    running, and telegraphs tick on ITS delta — so a zone frozen at 60% of its
//    wind-up sailed on to commit and destroy itself in the ~300ms before the
//    shutter, and every still came back with no zone in it at all. I spent four
//    rounds blaming the drawing code for a telegraph that simply was not there
//    any more. `scene.pause()` stops update and keeps rendering, which is what
//    a photograph actually needs.
//
// Writes to tests/out/ (gitignored).

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const PAGE_URL = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => { console.error(`PAGE ERROR: ${e}`); process.exit(1); });

await page.goto(PAGE_URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.sector = 15;
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((r) => setTimeout(r, 2200));
  gs.arenaActive = false;
  gs.lives = 9999;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) {
    gs.spawnBoss(gs.player.x + 360, gs.player.y, { encounter: 3 });
    await new Promise((r) => setTimeout(r, 900));
  }
  // LIGHTS OUT is on the encounter-3 ladder and turns every shot into a black
  // rectangle. Zeroing the clock does not lower a blackout already raised.
  gs.events.emit('set-darkness', false);
  gs.boss._blackoutEvery = 0;
  // God mode for the PHOTOS only. Without it the move connects, the full-screen
  // hurt vignette goes up, and every still comes back as a flat red rectangle
  // with the game invisible underneath it — which is what the first attempt at
  // this produced.
  const dbg = await import('/src/systems/debug.js');
  dbg.setGodMode(true);
});

// Put the pair mid-room and let the camera actually arrive before anything is
// cast. This is the fix for the bottom-of-frame shots.
const stage = async (gapPx = 230) => {
  await page.evaluate((gap) => {
    const gs = window.game.scene.getScene('Game');
    if (gs.scene.isPaused()) gs.scene.resume();
    const b = gs.boss;
    const w = gs.physics.world.bounds;
    // A still of the move, not a still of a firefight. The first pass at this
    // shot came back with four stormtroopers, six damage numbers and the player
    // on 760hp — everything except the thing being photographed.
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    gs.enemyBullets?.getChildren().forEach((x) => x.kill?.());
    gs.bullets?.getChildren().forEach((x) => x.kill?.());
    gs.clearTelegraphs();
    b._afterimageEvery = 0; b._reflectEvery = 0; b._disarmEvery = 0;
    b.cooldown = 1e9;              // his own attack clock, silenced for the PHOTO only
    gs.lives = 9999;
    b.setPosition(w.width / 2 + gap / 2, w.height / 2);
    b.body?.setVelocity(0, 0);
    gs.player.alive = true;
    gs.player.hp = gs.player.hpMax;
    gs.player.setPosition(w.width / 2 - gap / 2, w.height / 2);
    gs.player.body?.setVelocity(0, 0);
  }, gapPx);
  await page.waitForTimeout(900);          // camera lerp settles
};

const castAndFreezeAt = async (moveId, beat) => {
  await stage();
  await page.evaluate(([id, want]) => {
    const gs = window.game.scene.getScene('Game');
    const b = gs.boss;
    const order = ['anticipate', 'act', 'impact', 'recover', 'done'];
    window.__shot = { frozen: false };
    b._activeMove = null;
    b._performing = false;
    b.state = 'idle';
    gs.tweens.timeScale = 1;
    gs.physics.world.resume();
    const handle = gs._castBossMove(b, id);
    if (!handle) throw new Error(`cast refused for ${id}`);
    const onFrame = () => {
      if (window.__shot.frozen) return;
      if (order.indexOf(handle.phase) < order.indexOf(want)) return;
      window.__shot.frozen = true;
      gs.tweens.timeScale = 0;
      gs.physics.world.pause();
      gs.events.off('postupdate', onFrame);
      gs.scene.pause();          // stops update; rendering continues
    };
    gs.events.on('postupdate', onFrame);
  }, [moveId, beat]);
  await page.waitForFunction(() => window.__shot?.frozen === true, null, { timeout: 20000 });
  await page.screenshot({ path: `${OUT}boss-${moveId}-${beat}.png` });
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.scene.resume();
    gs.tweens.timeScale = 1;
    gs.physics.world.resume();
    gs.boss._activeMove?.cancel?.();
    gs.boss._activeMove = null;
    gs.boss._performing = false;
  });
  await page.waitForTimeout(300);
};

// The wind-up sampled at three points, because the whole claim is that the
// zone communicates TIME. One still cannot show that; three can.
const sweepShots = async (moveId) => {
  for (const at of [0.25, 0.6, 0.95]) {
    await stage();
    await page.evaluate(([id, frac]) => {
      const gs = window.game.scene.getScene('Game');
      const b = gs.boss;
      window.__shot = { frozen: false };
      b._activeMove = null; b._performing = false; b.state = 'idle';
      gs.tweens.timeScale = 1;
      gs.physics.world.resume();
      const h = gs._castBossMove(b, id);
      if (!h) throw new Error(`cast refused for ${id}`);
      const onFrame = () => {
        if (window.__shot.frozen) return;
        const tel = gs._telegraphs.find((z) => !z.dead && z.owner === b);
        if (!tel || tel.elapsed / tel.windupMs < frac) return;
        window.__shot.frozen = true;
        gs.tweens.timeScale = 0;
        gs.physics.world.pause();
        gs.events.off('postupdate', onFrame);
        gs.scene.pause();
      };
      gs.events.on('postupdate', onFrame);
    }, [moveId, at]);
    await page.waitForFunction(() => window.__shot?.frozen === true, null, { timeout: 20000 })
      .catch(() => console.log(`  (no zone to sample for ${moveId} @ ${at})`));
    await page.screenshot({ path: `${OUT}sweep-${moveId}-${String(at).replace('.', '')}.png` });
    await page.evaluate(() => {
      const gs = window.game.scene.getScene('Game');
      gs.scene.resume();
      gs.tweens.timeScale = 1;
      gs.physics.world.resume();
      gs.boss._activeMove?.cancel?.();
      gs.boss._activeMove = null;
      gs.boss._performing = false;
    });
    await page.waitForTimeout(300);
  }
  console.log(`  sweep ${moveId}`);
};

const MOVES = process.argv[2] ? [process.argv[2]] : ['saberthrow', 'forcepull', 'vanishslash', 'forcepush'];
for (const id of MOVES) {
  for (const beat of ['anticipate', 'act', 'recover']) await castAndFreezeAt(id, beat);
  console.log(`  beats ${id}`);
  await sweepShots(id);
}

await browser.close();
console.log(`shots written to ${OUT}`);
