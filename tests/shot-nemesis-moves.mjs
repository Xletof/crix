// Look at each nemesis move, at wind-up and at impact.
//
// Post-mortem rule 6: screenshots caught three bugs no assertion did. And rule
// on freezing — `scene.pause()` is what a photograph needs. Freezing tweens and
// pausing physics does NOT stop `scene.update`, so telegraphs kept ticking and
// destroyed themselves before the shutter; four rounds were spent blaming the
// drawing code for a zone that was no longer in the frame.
//
//   npm run dev, then: node tests/shot-nemesis-moves.mjs

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = process.env.FRIX_URL || 'http://localhost:5173/?nodlg=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = process.env.SHOT_DIR || '/tmp/frix-shots';

// One trait per move, so the tint is visibly different move to move — that is
// half of what this pass is for.
const CASES = [
  { move: 'charge',   traits: ['armored'],     at: 'windup' },
  { move: 'charge',   traits: ['armored'],     at: 'impact' },
  { move: 'blink',    traits: ['swift'],       at: 'impact' },
  { move: 'baitslam', traits: ['colossal'],    at: 'windup' },
  { move: 'baitslam', traits: ['colossal'],    at: 'impact' },
  { move: 'spiral',   traits: ['volatile'],    at: 'windup' },
  { move: 'spiral',   traits: ['volatile'],    at: 'act' },
  { move: 'rite',     traits: ['summoner'],    at: 'act' },
];

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title')
  .scene.start('Game', { mode: 'endless', seed: 31337 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1600);

for (const c of CASES) {
  const landed = await page.evaluate(async ({ move, traits, at }) => {
    const gs = window.game.scene.getScene('Game');
    const { ROOMS } = await import('/src/data/rooms.js');
    const { rollNemesis } = await import('/src/data/nemesis.js');
    const { makeRng } = await import('/src/systems/rng.js');
    const { moveById } = await import('/src/data/nemesisMoves.js');
    const { setGodMode } = await import('/src/systems/debug.js');
    // God mode, as shot-boss-moves does. Not for survival — for the CAMERA. A
    // hit fires `cameras.main.flash(120, 255, 80, 80)`, and scene.pause()
    // freezes that mid-effect, which came back as a screenshot of a uniformly
    // red screen with the arena nowhere in it.
    setGodMode(true);

    if (gs.scene.isPaused()) gs.scene.resume();
    gs.loadRoom(ROOMS[0]);
    await new Promise((r) => setTimeout(r, 1300));
    gs.arenaActive = false;
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    gs.lives = 9999;
    gs.player.hp = gs.player.hpMax;
    gs.player.setPosition(360, 780);

    const nem = rollNemesis(10, { traits, base: 'grunt', rng: makeRng(7) });
    const e = gs._spawnMiniBoss(nem);
    e.setPosition(360, 480);
    e.body?.setVelocity(0, 0);
    await new Promise((r) => setTimeout(r, 500));

    const m = moveById(move);
    const h = gs._castNemesisMove(e, move);

    // Wait on the MOVE'S OWN PHASE, from inside the page — not on a wall-clock
    // offset computed out in Node. The headless loop runs at ~10fps, so a
    // "impact + 40ms" delay measured out here lands hundreds of game
    // milliseconds late and photographs an effect that has already expired.
    // That is the same round trip the harness README warns about.
    //
    // 'impact' is not observable: MoveScript sets the phase, calls impact() and
    // moves to 'recover' in one synchronous block. 'recover' is therefore the
    // first frame AFTER impact ran, which is exactly the frame wanted.
    const want = at === 'windup' ? 'anticipate' : at === 'act' ? 'act' : 'recover';
    const deadline = performance.now() + 15000;
    while (h && h.phase !== want && h.phase !== 'done' && performance.now() < deadline) {
      await new Promise((r) => setTimeout(r, 16));
    }
    // ...and then let the beat actually RUN before the shutter.
    //
    // `runMove` sets phase='anticipate' and calls anticipate() synchronously,
    // so polling for the phase alone fires before a single frame has drawn —
    // the first spiral windup shot came back with no rings at all, because
    // `whirlArms` had not ticked once. Measured on the GAME clock
    // (`scene.time.now`), which is the only clock that tracks the slow loop.
    // 'recover' is exempt: that frame is the payoff, and waiting loses it.
    const into = at === 'windup' ? m.anticipateMs * 0.55
      : at === 'act' ? m.actMs * 0.35 : 0;
    if (into > 0) {
      const t0 = gs.time.now;
      const dl2 = performance.now() + 15000;
      while (gs.time.now - t0 < into && performance.now() < dl2) {
        await new Promise((r) => setTimeout(r, 16));
      }
    }
    // Clear any camera effect still running before freezing, for the same
    // reason: a half-finished fade or flash photographs as a coloured sheet.
    gs.cameras.main.resetFX();
    // scene.pause() — the ONLY thing that actually stops scene.update.
    gs.scene.pause();
    return h?.phase || 'none';
  }, c);

  await page.waitForTimeout(300);
  const name = `nem-${c.move}-${c.at}`;
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`wrote ${OUT}/${name}.png  (paused at phase: ${landed})`);
  await page.evaluate(() => window.game.scene.getScene('Game').scene.resume());
  await page.waitForTimeout(300);
}

await browser.close();
