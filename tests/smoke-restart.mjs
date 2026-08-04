// Restarting the scene must not leave the previous run behind.
//
// Phaser REUSES the scene instance across `scene.start()`, and neither the
// scene's event emitter nor its plain instance fields are cleared on shutdown.
// Both bit, and the symptoms looked like three unrelated bugs:
//
//   - Damage and FX multiplied. bindEvents() re-ran on an emitter that still
//     held the previous run's handlers, so after N restarts one bolt ran the
//     enemy-hit handler N times, the melee finisher played N cracks, and every
//     kill scored N times.
//   - The game crashed. `arenaActive`/`arenaCfg`/`_wave` survived the restart,
//     so update() ticked the OLD wave during the 200ms before loadRoom rebuilt
//     the room — against a decal RenderTexture destroyed with the old one.
//     "Cannot read properties of null (reading 'gl')".
//   - The screen went black. That crash is thrown inside the Phaser step, which
//     stops the game loop: the canvas freezes on whatever it last drew (black,
//     after the retry fade-out) while DOM buttons and Web Audio keep working.
//
// Counting listeners is the honest measurement here — asserting only that
// damage "looks right" would pass on a build where the handlers stack but the
// arithmetic happens to survive.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok, label, detail }); };

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game'));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(2000);

const countListeners = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const names = ['enemy-hit', 'enemy-died', 'player-fire', 'player-melee-land', 'boss-died', 'terminal-hacked'];
  const out = {};
  for (const n of names) out[n] = gs.events.listenerCount(n);
  out.tracked = (gs._ownEvents || []).length;
  return out;
});

const before = await countListeners();

// Restart four times, the way hammering RETRY does.
for (let i = 0; i < 4; i++) {
  await page.evaluate(() => window.game.scene.getScene('Game').scene.start('Game'));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForTimeout(1400);
}
const after = await countListeners();

// One kill must pay exactly one kill's worth of score and fire one death event.
const r = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.loadRoom(ROOMS[0]);
  await new Promise((res) => setTimeout(res, 1400));

  let deaths = 0;
  const onDeath = () => deaths++;
  gs.events.on('enemy-died', onDeath);

  gs.runScore = 0;
  gs._comboCount = 0;
  gs._lastKillTime = -99999;
  const victim = gs.enemies.getChildren().find((e) => e.alive);
  const type = victim?.enemyType;
  victim.damage(999999);
  await new Promise((res) => setTimeout(res, 400));
  gs.events.off('enemy-died', onDeath);

  const { SCORE } = await import('/src/config.js');
  return {
    type, deaths, scored: gs.runScore,
    expected: SCORE.points[type] ?? SCORE.points.grunt,
    arenaActiveAfterCreate: gs._arenaActiveAtCreate ?? null,
  };
});

// And the scene must actually be rendering, not frozen on a dead loop.
const alive = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const start = gs.game.loop.frame;
  await new Promise((res) => setTimeout(res, 600));
  return { advanced: gs.game.loop.frame - start, contextLost: gs.game.renderer.contextLost };
});

await browser.close();

check(before.tracked > 20, 'listeners are tracked for removal',
  `${before.tracked} tracked on the first run`);
for (const name of ['enemy-hit', 'enemy-died', 'player-fire', 'player-melee-land', 'boss-died', 'terminal-hacked']) {
  check(after[name] === before[name], `${name} has no duplicate handler after 4 restarts`,
    `${before[name]} -> ${after[name]}`);
}
check(after.tracked === before.tracked, 'the tracked-handler list does not grow either',
  `${before.tracked} -> ${after.tracked}`);

check(r.deaths === 1, 'a kill fires exactly one enemy-died', `${r.deaths} events`);
check(r.scored === r.expected, 'a kill scores exactly once',
  `${r.type} scored ${r.scored}, expected ${r.expected} (a stacked handler multiplies this)`);

check(alive.advanced > 5, 'the game loop is still running after the restarts',
  `${alive.advanced} frames in 600ms — 0 means an exception killed the step (the black screen)`);
check(alive.contextLost === false, 'the WebGL context is intact', `contextLost=${alive.contextLost}`);
check(pageErrors.length === 0, 'no exception is thrown across the restarts',
  pageErrors.slice(0, 3).join(' | '));

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — restarts leave no duplicate handlers and no stale arena`);
