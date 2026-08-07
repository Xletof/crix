// Screenshots of Vader's four moves, one frame per BEAT.
//
// Not a gate — a look. `tests/README.md` is blunt about why this exists: this
// project is heavily visual, several "passing" tests here were wrong assertions
// rather than working code, and short FX simply cannot be caught at ~20 FPS
// without stopping the clock first. So each beat freezes tweens and physics,
// captures, and resumes.
//
// Writes to tests/out/boss-<move>-<beat>.png (gitignored).
//
// LIMIT, stated so nobody trusts these further than they go: the framing is
// approximate. The camera follows the player and its viewport is inset below
// the HUD, so a teleported pair does not sit centred even after stopFollow and
// centerOn. These shots prove a beat HAPPENED and catch things a check cannot
// see — a cancelled move's telegraph left painted on the floor was found here.
// Whether a move READS at arm's length on a handset is still a phone question.

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
page.on('pageerror', (e) => { console.error(`page error: ${e}`); process.exit(1); });

await page.goto(PAGE_URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}build-stamp.png` });     // the build id, bottom right
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
  const b = gs.boss;
  b._reflectEvery = 0; b._blackoutEvery = 0; b._afterimageEvery = 0;
  b._disarmEvery = 0; b._sunderMs = 0; b.cooldown = 1e9; b._moveIds = [];
  // The encounter-3 ladder includes LIGHTS OUT, and a blacked-out room makes
  // every one of these shots a black rectangle. Zeroing the clock does not undo
  // a blackout already raised.
  gs.events.emit('set-darkness', false);
});

// Freeze the world the INSTANT a beat is reached, from inside the page.
//
// Two things make an out-of-process wait wrong here. The scene clock runs well
// behind the wall at ~20 FPS, so a fixed sleep lands in the wrong beat; and
// `runMove` nulls `actor._activeMove` when the move is done, so a poll that
// arrives late finds nothing to read and waits forever. A postupdate hook sees
// every frame and stops the clock on the frame the beat begins, which is also
// the only way to catch a sub-150ms effect at this frame rate (tests/README.md).
const castAndFreezeAt = async (moveId, beat) => {
  await page.evaluate(([id, want]) => {
    const gs = window.game.scene.getScene('Game');
    const b = gs.boss;
    const order = ['anticipate', 'act', 'impact', 'recover', 'done'];
    window.__shot = { frozen: false };
    b._activeMove = null;
    gs.tweens.timeScale = 1;
    gs.physics.world.resume();
    gs.player.alive = true;
    gs.player.hp = gs.player.hpMax;
    // Keep BOTH in frame: the camera follows the player, so a teleported
    // player with the boss 360px away puts the whole move off-screen — which
    // is how the first pass produced shots of an empty floor.
    gs.player.setPosition(b.x - 200, b.y);
    gs.cameras.main.stopFollow();
    gs.cameras.main.centerOn((b.x + gs.player.x) / 2, (b.y + gs.player.y) / 2);
    const handle = gs._castBossMove(b, id);
    if (!handle) throw new Error(`cast refused for ${id}`);
    const onFrame = () => {
      if (window.__shot.frozen) return;
      if (order.indexOf(handle.phase) < order.indexOf(want)) return;
      window.__shot.frozen = true;
      gs.tweens.timeScale = 0;
      gs.physics.world.pause();
      gs.events.off('postupdate', onFrame);
    };
    gs.events.on('postupdate', onFrame);
  }, [moveId, beat]);
  await page.waitForFunction(() => window.__shot?.frozen === true, null, { timeout: 20000 });
  // Frame AFTER freezing. Re-centring at cast time does not survive: the camera
  // re-follows the player on the very next frame, so every shot came back with
  // the fight jammed against the bottom edge behind the joysticks. And the
  // viewport is inset by HUDCFG.topBarHeight (84px), so centring on the pair
  // without allowing for it still pushes them low.
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    const b = gs.boss;
    const cam = gs.cameras.main;
    cam.stopFollow();
    cam.setZoom(0.75);
    cam.centerOn((b.x + gs.player.x) / 2, (b.y + gs.player.y) / 2);
    cam.preRender();
  });
  await page.screenshot({ path: `${OUT}boss-${moveId}-${beat}.png` });
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('Game');
    gs.tweens.timeScale = 1;
    gs.physics.world.resume();
    gs.boss._activeMove?.cancel?.();
    gs.boss._activeMove = null;
  });
  await page.waitForTimeout(400);
};

for (const id of ['saberthrow', 'forcepull', 'vanishslash', 'forcepush']) {
  for (const beat of ['anticipate', 'act', 'recover']) await castAndFreezeAt(id, beat);
  console.log(`  shot ${id}`);
}

// And the copies, which the report said "don't do shit".
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.player.setPosition(gs.boss.x + 100, gs.boss.y);
  gs.events.emit('boss-afterimages', gs.boss, 3);
});
await page.waitForTimeout(700);
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.tweens.timeScale = 0;
  gs.physics.world.pause();
});
await page.screenshot({ path: `${OUT}boss-afterimages.png` });
console.log('  shot afterimages');

await browser.close();
console.log(`shots written to ${OUT}`);
