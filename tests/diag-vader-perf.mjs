// Is the new visual language costing anything?
//
// Deliberately small. The question is only "did a material regression land",
// not "how fast is this game", and a big benchmark would be a worse instrument
// as well as a bigger one — the headless loop runs at ~20 FPS whatever the
// build, so an ABSOLUTE frame time here means nothing at all. What is
// comparable is the same fight, on the same machine, minutes apart, against
// two commits: `node tests/diag-vader-perf.mjs --label before` on the baseline
// and `--label after` on the branch.
//
// Three numbers, and the third is the one that matters:
//
//   frame delta        mean and p95, sampled inside the page on `postupdate`.
//                      Noisy, and it is the number people reach for first.
//   display objects    peak and mean count of the scene's display list. This
//                      is what a lazy effect pass actually costs — Graphics
//                      that accumulate, tweens that never destroy their target.
//   live tweens        peak. A tween that outlives its object is how this
//                      project has leaked before.
//
// A single end-of-run sample of a fluctuating counter can be zero (the same
// build measured 0 and then 60 on consecutive runs, per tests/README.md), so
// everything here is sampled throughout and reported as peak AND mean.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const argv = process.argv.slice(2);
const LABEL = (() => { const i = argv.indexOf('--label'); return i >= 0 ? argv[i + 1] : 'run'; })();
const SECONDS = 30;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => { console.error(`PAGE ERROR: ${e}`); process.exit(1); });

await page.goto('http://localhost:5173/?nodlg=1&nofreeze=1');
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
  gs.lives = 9999;
  if (!gs.boss?.alive) {
    gs.spawnBoss(gs.player.x + 300, gs.player.y, { encounter: 3 });
    await new Promise((r) => setTimeout(r, 900));
  }
  gs.events.emit('set-darkness', false);
  gs.boss._blackoutEvery = 0;
  const dbg = await import('/src/systems/debug.js');
  dbg.setGodMode(true);
});

const bossOk = await page.evaluate(() => !!window.game.scene.getScene('Game').boss?.alive);
if (!bossOk) { console.error('FAIL: no boss — nothing was measured'); process.exit(1); }

// ── The stress fight ──────────────────────────────────────────────────────
//
// Every attack he has, cycled as fast as the ownership gate allows, with his
// own state machine left running underneath so the CHARGE and the SLAM are in
// the sample too. That is heavier than play, on purpose: a regression that only
// shows under load is still a regression, and the comparison is like-for-like.
const stats = await page.evaluate(async (secs) => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  const deltas = [];
  const objs = [];
  const tweens = [];
  const ids = ['sabercombo', 'saberthrow', 'forcepull', 'forcepush', 'vanishslash'];
  let i = 0;
  let casts = 0;

  const sample = (t, d) => {
    deltas.push(d);
    objs.push(gs.children.list.length);
    tweens.push(gs.tweens.getTweens().length);
  };
  gs.events.on('postupdate', sample);

  const drive = gs.time.addEvent({
    delay: 900,
    loop: true,
    callback: () => {
      if (!b.active || !b.alive) return;
      gs.player.hp = gs.player.hpMax;
      if (gs._castBossMove(b, ids[i++ % ids.length])) casts += 1;
    },
  });

  await new Promise((r) => setTimeout(r, secs * 1000));
  drive.remove(false);
  gs.events.off('postupdate', sample);

  const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  const p95 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)] ?? 0;
  return {
    frames: deltas.length,
    casts,
    dMean: +mean(deltas).toFixed(2),
    dP95: +p95(deltas).toFixed(2),
    objMean: Math.round(mean(objs)),
    objPeak: Math.max(...objs),
    twMean: Math.round(mean(tweens)),
    twPeak: Math.max(...tweens),
  };
}, SECONDS);

console.log(`\n[${LABEL}]  ${SECONDS}s boss stress, ${stats.casts} scripted casts, ${stats.frames} frames`);
console.log(`  frame delta   mean ${stats.dMean}ms   p95 ${stats.dP95}ms`);
console.log(`  display list  mean ${stats.objMean}   peak ${stats.objPeak}`);
console.log(`  live tweens   mean ${stats.twMean}   peak ${stats.twPeak}`);

// A cast count near zero means the gate refused everything and the numbers
// below are a picture of an idle arena — the "a refused call reads exactly
// like a failed one" trap, applied to a benchmark.
if (stats.casts < 5) { console.error('\nFAIL: almost nothing was cast — this measured an idle fight'); process.exit(1); }

await browser.close();
