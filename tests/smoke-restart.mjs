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

// Raise a medal BEFORE the restarts, and it has to be here rather than after.
// The lazy text only becomes a stale handle if it was ever CREATED in the run
// that gets torn down — the first version of this check awarded medals only
// afterwards, so `_medalText` was still null, the lazy branch built a fresh one
// and the check passed happily against the crashing build. A/B is not a
// formality: a check that passes on the bug is decoration.
await page.evaluate(async () => {
  window.game.scene.getScene('Game').events.emit('score-medal', 'ARENA CLEAR', 400, '#ffd040');
  await new Promise((res) => setTimeout(res, 300));
});

// Restart four times, the way hammering RETRY does.
for (let i = 0; i < 4; i++) {
  await page.evaluate(() => window.game.scene.getScene('Game').scene.start('Game'));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForTimeout(1400);
}
const after = await countListeners();

// ── A LAZY HUD TEXT MUST NOT SURVIVE THE RESTART ──────────────────────────
//
// Phaser reuses the scene INSTANCE across `scene.start()`, so anything cached
// on `this` and created lazily comes back as a destroyed object with a null
// canvas. `HUD._medalText` did, and the next medal after a restart threw
// `Cannot read properties of null (reading 'drawImage')` out of setText, which
// killed the HUD scene and took the run with it.
//
// The generic "no exception across the restarts" check below could not catch
// it, because nothing in this file had ever awarded a medal AFTER a restart —
// the crash needs the restart and the medal, in that order. `comboText` is
// nulled on shutdown for exactly this reason and the medal lane, added later,
// did not inherit it; so this raises every lane that caches a text object
// rather than naming the one that broke.
const medals = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  gs.events.emit('score-medal', 'FLAWLESS', 500, '#ffd040');
  gs.events.emit('score-medal', 'FAST CLEAR', 250, '#40ff90');
  gs.events.emit('show-combo', 7);
  await new Promise((res) => setTimeout(res, 600));
  const hud = window.game.scene.getScene('HUD');
  return {
    medalAlive: !!hud._medalText?.active,
    medalText: hud._medalText?.text ?? null,
    // A `_medalShowing` stranded true from the previous run means every future
    // medal is queued against a drain that will never come — silent, and worse
    // than the crash because nothing reports it.
    queueDraining: hud._medalShowing === true,
  };
});

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
  // Poll until the loop advances, rather than counting frames in a fixed window
  // of wall clock. The claim being tested is LIVENESS — that an exception has
  // not killed the Phaser step — and a dead loop never advances however long you
  // wait, while a merely slow one does. Counting frames per millisecond instead
  // measured the container's spare capacity: this passed 3/3 standalone and
  // failed inside the full suite, where Chromium throttles requestAnimationFrame
  // under load while setTimeout keeps firing on schedule.
  let advanced = 0;
  for (let i = 0; i < 60 && advanced < 3; i++) {
    await new Promise((res) => setTimeout(res, 100));
    advanced = gs.game.loop.frame - start;
  }
  return { advanced, running: gs.game.loop.running, contextLost: gs.game.renderer.contextLost };
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

check(alive.advanced >= 3 && alive.running, 'the game loop is still running after the restarts',
  `${alive.advanced} frames advanced, loop.running=${alive.running} — a stalled loop means an exception killed the step (the black screen)`);
check(alive.contextLost === false, 'the WebGL context is intact', `contextLost=${alive.contextLost}`);

check(medals.medalAlive, 'a medal after a restart draws onto a LIVE text object',
  `_medalText active=${medals.medalAlive} — a destroyed one is truthy and throws on setText`);
check(!!medals.medalText && medals.medalText.includes('FLAWLESS'),
  'and the medal actually rendered its name', `text=${JSON.stringify(medals.medalText)}`);
check(medals.queueDraining, 'and the medal queue is still draining, not stranded',
  '_medalShowing left true from a previous run silently swallows every future medal');
check(pageErrors.length === 0, 'no exception is thrown across the restarts',
  pageErrors.slice(0, 3).join(' | '));

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — restarts leave no duplicate handlers and no stale arena`);
