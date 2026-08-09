// Do the nemeses have effects and bodies of their own?
//
// ── Why this is asserted at the REGISTRY ─────────────────────────────────
//
// `smoke-readability` exists because four Vader moves shipped behind 17 passing
// per-move checks, two of which drew nothing at all — the checks had simply not
// been written for those two. The fix was to stop writing per-move checks and
// iterate the registry instead, so a move CANNOT be added without satisfying
// them. Same rule here: every loop below walks NEMESIS_MOVES.
//
// What it protects, in order of how badly it would hurt to lose:
//
//   1. the telegraph's SHAPE IS ITS HIT TEST. baitslam froze its impact point
//      at cast while its drawn circle followed the caster, so the zone you
//      could see and the zone that hurt you were different zones.
//   2. every move drives the BODY through its beats. `_moveAnim` was read by
//      Enemy.preUpdate and written by nothing, so scripted enemy moves played
//      out with the body standing in its idle frame.
//   3. every move makes at least one BESPOKE effect call, so no move can go
//      back to being five generic ones shared between the lot.
//   4. an interrupted move leaves no timer running.
//
// A/B: every check here was run against the pre-change build and fails there.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

// `?nodlg=1` mutes the dialogue cards. They pause Game and HUD and wait for a
// tap, which hangs a bot for the whole measurement cap — see systems/debug.js.
const URL = 'http://localhost:5173/?nodlg=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail = '') => { checks.push({ ok, label, detail }); };

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
await page.evaluate(() => window.game.scene.getScene('Title')
  .scene.start('Game', { mode: 'endless', seed: 20260808 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

// ── Set up an isolated arena with one nemesis in it ───────────────────────
await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);              // damage is not what is being measured here
  gs.loadRoom(ROOMS[0]);
  await new Promise((r) => setTimeout(r, 1500));
  gs.arenaActive = false;
  gs.lives = 9999;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
});

// ── Walk the registry ─────────────────────────────────────────────────────
//
// Each move is cast on a freshly spawned nemesis with the FX layer instrumented
// so every call is recorded. Sampling is done on the game's own postupdate,
// never by polling from Node — at ~10fps a round trip out here misses most of a
// beat, which is documented in tests/README.md and has produced a false pass
// before.
const r = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { NEMESIS_MOVES } = await import('/src/data/nemesisMoves.js');
  const { rollNemesis } = await import('/src/data/nemesis.js');
  const { makeRng } = await import('/src/systems/rng.js');

  // Effects considered BESPOKE — the families written for these moves. The
  // generic five (burst / shake / explosion / groundFractures / slashSwipe) are
  // deliberately excluded: having only those is the state being fixed.
  const BESPOKE = ['chargeWake', 'blinkOut', 'crossCut', 'crushRing',
    'whirlArms', 'summonRune', 'riteShatter', 'inhale', 'burstDir'];

  const calls = [];
  const wrapped = new Set();
  for (const name of BESPOKE) {
    if (typeof gs.fx[name] !== 'function' || wrapped.has(name)) continue;
    wrapped.add(name);
    const orig = gs.fx[name].bind(gs.fx);
    gs.fx[name] = (...a) => { calls.push(name); return orig(...a); };
  }

  const out = [];
  for (const move of NEMESIS_MOVES) {
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    await new Promise((res) => setTimeout(res, 200));

    const nem = rollNemesis(10, { traits: ['colossal'], base: 'grunt', rng: makeRng(4242) });
    const e = gs._spawnMiniBoss(nem);
    e.setPosition(gs.player.x, gs.player.y - 260);
    e.body?.setVelocity(0, 0);
    await new Promise((res) => setTimeout(res, 350));

    calls.length = 0;
    const before = gs._telegraphs?.length ?? 0;
    const h = gs._castNemesisMove(e, move.id);
    if (!h) { out.push({ id: move.id, cast: false }); continue; }

    // Sample on the game's frame, not on a Node timer.
    //
    // The zone's position is recorded WHILE IT IS ALIVE. First version read it
    // after the move finished, by which point the telegraph has committed and
    // been spliced out of `_telegraphs` — so the check reported "n/a" and would
    // have passed for the wrong reason had it been written the other way round.
    const seen = { poses: new Set(), zones: 0, zoneColors: new Set(), zFirst: null, zLast: null };
    const sample = () => {
      if (e._moveAnim) seen.poses.add(e._moveAnim);
      const zs = gs._telegraphs || [];
      seen.zones = Math.max(seen.zones, zs.length - before);
      for (const z of zs) if (z.color != null) seen.zoneColors.add(z.color);
      const z0 = zs[0];
      if (z0 && z0.shape?.x != null) {
        if (!seen.zFirst) seen.zFirst = [z0.shape.x, z0.shape.y];
        seen.zLast = [z0.shape.x, z0.shape.y];
      }
    };
    gs.events.on('postupdate', sample);

    // baitslam's zone is anchored to the world while its caster keeps moving —
    // walk him, so a zone that WOULD follow him has somewhere to go.
    const walk = setInterval(() => { e.setPosition(e.x + 9, e.y); }, 60);

    const deadline = performance.now() + 14000;
    while (h.phase !== 'done' && performance.now() < deadline) {
      await new Promise((res) => setTimeout(res, 25));
    }
    clearInterval(walk);
    gs.events.off('postupdate', sample);

    out.push({
      id: move.id,
      cast: true,
      poses: [...seen.poses],
      zones: seen.zones,
      colored: [...seen.zoneColors].some((c) => c !== 0xff3020),
      bespoke: [...new Set(calls)],
      // How far the DRAWN zone travelled over its life, against a caster that
      // was walking the whole time.
      zoneMoved: seen.zFirst && seen.zLast
        ? Math.hypot(seen.zLast[0] - seen.zFirst[0], seen.zLast[1] - seen.zFirst[1]) : null,
      casterMoved: true,
    });
  }

  // ── Cancel mid-act must leave nothing running ──────────────────────────
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  await new Promise((res) => setTimeout(res, 200));
  const nem = rollNemesis(10, { traits: ['summoner'], base: 'grunt', rng: makeRng(99) });
  const e2 = gs._spawnMiniBoss(nem);
  e2.setPosition(gs.player.x, gs.player.y - 240);
  await new Promise((res) => setTimeout(res, 300));
  const spiral = gs._castNemesisMove(e2, 'spiral');
  const dl = performance.now() + 8000;
  while (spiral && spiral.phase !== 'act' && performance.now() < dl) {
    await new Promise((res) => setTimeout(res, 20));
  }
  const activeBefore = gs.time.getActiveEvents ? gs.time.getActiveEvents() : -1;
  spiral?.cancel();
  await new Promise((res) => setTimeout(res, 500));
  const cancelled = {
    poseCleared: !e2._moveAnim,
    timerStopped: !!(spiral && !spiral.timer?.getProgress),
    stillFiring: (spiral?.timer && !spiral.timer.paused && spiral.timer.getOverallProgress?.() < 1) || false,
    activeBefore,
  };

  return { moves: out, cancelled };
});

// ── Registry-level checks ─────────────────────────────────────────────────
const cast = r.moves.filter((m) => m.cast);
check(cast.length === r.moves.length,
  'every move in the registry actually RAN',
  `${cast.length} of ${r.moves.length} cast — a refused cast reads exactly like a move that did nothing, which has produced a false pass in this project before`);

const noPose = cast.filter((m) => m.poses.length === 0);
check(noPose.length === 0,
  'every move drives the BODY through a pose',
  `no pose set by: ${noPose.map((m) => m.id).join(', ')} — Enemy.preUpdate reads _moveAnim and nothing used to write it, so moves played out with the body idle`);

const oneBeat = cast.filter((m) => m.poses.length < 2);
check(oneBeat.length === 0,
  'and through MORE THAN ONE of them, so the body reads as performing',
  `only one pose from: ${oneBeat.map((m) => `${m.id}(${m.poses.join('/')})`).join(', ')}`);

const noFx = cast.filter((m) => m.bespoke.length === 0);
check(noFx.length === 0,
  'every move makes at least one BESPOKE effect call',
  `generic-only: ${noFx.map((m) => m.id).join(', ')} — the whole point is that these five stop sharing burst/shake/explosion between them`);

const zoned = cast.filter((m) => m.zones > 0);
check(zoned.every((m) => m.colored),
  'a move that draws a zone TINTS it',
  `stock red from: ${zoned.filter((m) => !m.colored).map((m) => m.id).join(', ')} — every move already emits a coloured banner and the zone disagreed with it`);

// ── The fairness bug ──────────────────────────────────────────────────────
const slam = r.moves.find((m) => m.id === 'baitslam');
check(slam && slam.zoneMoved != null && slam.zoneMoved < 12,
  'OVERHEAD’s zone stays where it was cast while the caster walks off',
  `zone drifted ${slam?.zoneMoved == null ? 'n/a' : Math.round(slam.zoneMoved)}px — the impact point is frozen at cast, so a zone that follows the caster is drawing a different shape from the one that hurts you`);

// ── Interrupt ─────────────────────────────────────────────────────────────
check(r.cancelled.poseCleared,
  'cancelling a move clears the attack pose',
  'a stranded pose leaves the body locked in a strike frame for the rest of its life');
check(!r.cancelled.stillFiring,
  'and stops the timer it parked on its handle',
  'MoveScript.cancel destroys anything with .destroy(); a TimerEvent has none, which is why _castNemesisMove had to start forwarding the handle');

if (pageErrors.length) check(false, 'no page errors', pageErrors.slice(0, 3).join(' | '));

await browser.close();

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
console.log(`  (moves: ${r.moves.map((m) => `${m.id}[${m.poses?.join('/') || '-'}|${m.bespoke?.join(',') || '-'}]`).join('  ')})`);
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the nemeses perform their moves, in their own colours`);
