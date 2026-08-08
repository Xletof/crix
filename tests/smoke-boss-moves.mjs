// Vader's own moves, and whether his afterimages are a threat.
//
// ── Why this is a separate file ───────────────────────────────────────────
//
// These checks were first bolted onto the end of `smoke-vader.mjs`, which by
// then ran a dozen stateful blocks in one page: wound him three times, drive
// room transitions, break his mechanics. The new checks failed intermittently
// on leftovers from all of that — a boss mid-move, clones chasing him instead
// of the player, a health orb healing the subject to -440 damage taken. I
// patched three symptoms before admitting the structure was the problem.
//
// So: one fresh page, one boss, nothing else running.
//
// ── What it is guarding ───────────────────────────────────────────────────
//
// The bug this release fixes is that VADER HAD NO MOVES. Everything built in
// the previous release was wired to `_spawnMiniBoss`, and the boss is not in
// `this.enemies`, so he never received any of it — he ran his original charge/
// fan/spawn state machine while being described as having five new attacks.
// The first check here is simply that he HAS a kit, because that is what was
// silently false.
//
// Everything is asserted by EFFECT — a saber that leaves his hand, a player
// dragged against their input, a dash charge spent — never by reading a flag.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail = '') => { checks.push({ ok, label, detail }); };

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => fail(`page error: ${e}`));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

// One boss, an empty room, and nothing else ticking.
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
    await new Promise((r) => setTimeout(r, 700));
  }
  // Silence his automatic clocks so nothing fires mid-measurement.
  const b = gs.boss;
  b._reflectEvery = 0; b._blackoutEvery = 0; b._afterimageEvery = 0;
  b._disarmEvery = 0; b._sunderMs = 0; b.cooldown = 1e9;
  gs.player.hp = gs.player.hpMax;
});

const r = {};

r.kit = await page.evaluate(() => {
  const b = window.game.scene.getScene('Game').boss;
  return { ids: (b._moveIds || []).slice(), every: b._moveEvery || 0 };
});

// Each move run on its own, from a known start, with the previous one drained.
const runMove = async (id) => page.evaluate(async (moveId) => {
  const { BOSS_MOVES } = await import('/src/data/bossMoves.js');
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  const m = BOSS_MOVES.find((x) => x.id === moveId);

  // Drain any live move. `_castBossMove` refuses while one is running, and a
  // refused cast reads identically to a move that did nothing.
  for (let i = 0; i < 40 && b._activeMove && b._activeMove.phase !== 'done'; i++) {
    await new Promise((res) => setTimeout(res, 50));
  }
  b._activeMove = null;
  b._performing = false;
  // `_castBossMove` now refuses while his OWN state machine is mid-attack —
  // one attack at a time from either system, which is the fix for the two
  // zones on the floor. A test that wants a specific move has to hand him back
  // to idle first, or it is asking him to interrupt himself.
  b.state = 'idle';

  gs.player.alive = true;
  gs.player.hp = gs.player.hpMax;
  gs.player.setPosition(b.x + 190, b.y);
  gs.player.dashCharges = 2;
  await new Promise((res) => setTimeout(res, 120));

  const start = { px: gs.player.x, py: gs.player.y, bx: b.x, by: b.y, dash: gs.player.dashCharges };

  // Sample on the game's OWN frame, not on an async poll. tests/README.md says
  // this outright and I ignored it: polling at 40ms in a ~50ms/frame harness
  // misses short-lived state, and a dash charge spent then refunded by the 2.8s
  // recharge is exactly that. The hook sees every frame.
  const probe = { dashLow: start.dash, stagger: 0, saber: 0, unarmed: false };
  const onFrame = () => {
    probe.dashLow = Math.min(probe.dashLow, gs.player.dashCharges);
    probe.stagger = Math.max(probe.stagger, b._staggerMs || 0);
    const w = b.weaponSprite;
    if (w?.active) probe.saber = Math.max(probe.saber, Math.hypot(w.x - b.x, w.y - b.y));
    if (b._saberAway) probe.unarmed = true;
  };
  gs.events.on('postupdate', onFrame);
  gs._castBossMove(b, moveId);

  let playerShift = 0, bossShift = 0;
  const total = m.anticipateMs + m.actMs + m.recoverMs;
  for (let t = 0; t < total; t += 40) {
    await new Promise((res) => setTimeout(res, 40));
    playerShift = Math.max(playerShift, Math.hypot(gs.player.x - start.px, gs.player.y - start.py));
    bossShift = Math.max(bossShift, Math.hypot(b.x - start.bx, b.y - start.by));
  }
  gs.events.off('postupdate', onFrame);
  return {
    id: moveId,
    saberAway: Math.round(probe.saber), playerShift: Math.round(playerShift),
    bossShift: Math.round(bossShift), stagger: Math.round(probe.stagger),
    unarmed: probe.unarmed, dashSpent: start.dash - probe.dashLow,
  };
}, id);

r.saber = await runMove('saberthrow');
r.pull = await runMove('forcepull');
r.vanish = await runMove('vanishslash');
r.push = await runMove('forcepush');

// ── A cancelled move takes its telegraph with it ─────────────────────────
// Found in a screenshot, not by a check: interrupting a move stopped its
// TIMERS and left the zone painted on the floor, still filling and flashing.
// A telegraph that outlives its attack marks danger where there is none.
r.cancelSweep = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  gs.clearTelegraphs();
  b._activeMove = null;
  b._performing = false;
  b.state = 'idle';
  gs.player.alive = true;
  const h = gs._castBossMove(b, 'saberthrow');
  if (!h) return { during: -1, after: -1 };
  await new Promise((res) => setTimeout(res, 200));
  const live = () => gs._telegraphs.filter((t) => !t.dead && t.gfx?.active).length;
  const during = live();
  h.cancel();
  // Check on the NEXT frame, not after a wait: the zone would otherwise have
  // reached its own commit and cleaned itself up, and a leak would read as a
  // pass. The bug is that it survives the cancel at all.
  await new Promise((res) => gs.events.once('postupdate', res));
  return { during, after: live() };
});

r.gating = await page.evaluate(async () => {
  const { bossMovesFor } = await import('/src/data/bossMoves.js');
  return { p1: bossMovesFor(1, 1), p3: bossMovesFor(3, 1) };
});

// ── The charge finally has a floor telegraph ─────────────────────────────
r.chargeTel = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  gs.clearTelegraphs();
  const before = gs._telegraphs.length;
  gs.events.emit('boss-charge-windup', b, 0, 700);
  await new Promise((res) => setTimeout(res, 150));
  const t = gs._telegraphs[gs._telegraphs.length - 1];
  return { before, after: gs._telegraphs.length, kind: t?.shape?.kind ?? null };
});

// ── Afterimages: a threat, not scenery ───────────────────────────────────
r.clones = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  b._moveIds = [];                       // he stays put for this
  b._activeMove = null;
  b._performing = false;
  b.state = 'idle';
  b.cooldown = 1e9;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  await new Promise((res) => setTimeout(res, 250));

  gs.player.alive = true;
  gs.player.hp = gs.player.hpMax;
  gs.player.setPosition(b.x + 100, b.y);
  gs.events.emit('boss-afterimages', b, 3);
  await new Promise((res) => setTimeout(res, 500));
  // Put them ON the player rather than waiting for them to walk over. The
  // question is whether a clone's contact damage LANDS, not how fast it
  // pathfinds: under parallel suite load the frame rate drops far enough that
  // three clones could not cross 100px in the 5s window, and the check failed
  // for a reason that has nothing to do with what it is testing.
  gs.enemies.getChildren().filter((e) => e.alive && e._afterimage).forEach((e, i) => {
    e.setPosition(gs.player.x + (i - 1) * 18, gs.player.y + 12);
  });
  const spawned = gs.enemies.getChildren().filter((e) => e.alive && e._afterimage).length;

  // EFFECT, not geometry: can they be hit, and do they hurt?
  // (An earlier version asserted the body offset directly and was brittle —
  // what actually matters is that a shot connects and a clone can reach you.)
  const one = gs.enemies.getChildren().find((e) => e.alive && e._afterimage);
  const hpBefore = one ? one.hp : 0;
  one?.damage(1);
  await new Promise((res) => setTimeout(res, 200));
  const diesInOneHit = one ? !one.alive : false;

  const playerBefore = gs.player.hp;
  for (let t = 0; t < 6000; t += 100) {
    await new Promise((res) => setTimeout(res, 100));
    gs.player.body?.setVelocity(0, 0);
    gs.player.hp = Math.min(gs.player.hp, playerBefore);   // no orb can mask this
    // Hold them ON the player for the WHOLE window, not just at the start.
    // Repositioning once was not enough: they drift on their own AI, and under
    // parallel suite load the frame rate is low enough that they never get back
    // into contact. The question is whether a clone's touch hurts, so keep them
    // touching and let the answer be about damage.
    gs.enemies.getChildren().filter((e) => e.alive && e._afterimage).forEach((e, i) => {
      e.setPosition(gs.player.x + (i - 1) * 16, gs.player.y + 10);
    });
  }
  const damaged = Math.round(playerBefore - gs.player.hp);
  return { spawned, diesInOneHit, damaged, bossAlive: b.alive, bossHpFrac: b.hp / b.hpMax };
});

await browser.close();

// ── He has a kit at all ──────────────────────────────────────────────────
check(r.kit.ids.length > 0,
  'Vader HAS a move kit',
  'he had NONE for a full release — every move was wired to _spawnMiniBoss, and the boss is not in this.enemies, so none of it ever reached him');
check(r.kit.every > 0, 'and a clock to fire it on', `every ${r.kit.every}ms`);

// ── Saber throw ──────────────────────────────────────────────────────────
check(r.saber.saberAway > 200, 'SABER THROW sends the saber away from his hand',
  `reached ${r.saber.saberAway}px from him`);
check(r.saber.unarmed, 'and he is unarmed while it is gone', '');
check(r.saber.stagger > 400, 'and open when it comes back', `${r.saber.stagger}ms stagger`);

// ── Force pull ───────────────────────────────────────────────────────────
check(r.pull.playerShift > 60, 'FORCE PULL drags the player against their input',
  `moved ${r.pull.playerShift}px`);

// ── Vanish ───────────────────────────────────────────────────────────────
check(r.vanish.bossShift > 100, 'VANISH relocates him', `moved ${r.vanish.bossShift}px`);

// ── Force push ───────────────────────────────────────────────────────────
check(r.push.playerShift > 60, 'FORCE PUSH shoves the player', `moved ${r.push.playerShift}px`);
check(r.push.dashSpent >= 1, 'and costs them a dash charge',
  `spent ${r.push.dashSpent} — the move deals no damage, so taking position AND options is the whole threat`);

// ── Cancellation ─────────────────────────────────────────────────────────
check(r.cancelSweep.during > 0, 'a live move really does paint a zone (the control)',
  `${r.cancelSweep.during} telegraph(s)`);
check(r.cancelSweep.after === 0,
  'and cancelling the move wipes it off the floor',
  `${r.cancelSweep.after} left behind — cancel used to clear only the TIMERS, so the zone kept filling and flashing for an attack that was never coming`);

// ── Escalation ───────────────────────────────────────────────────────────
check(r.gating.p3.length > r.gating.p1.length,
  'his pool widens as he loses phases',
  `p1 [${r.gating.p1}] vs p3 [${r.gating.p3}]`);

// ── The charge telegraph ─────────────────────────────────────────────────
check(r.chargeTel.after > r.chargeTel.before && r.chargeTel.kind === 'lane',
  'his charge now draws a LANE on the floor',
  `${r.chargeTel.before} -> ${r.chargeTel.after}, kind ${r.chargeTel.kind}. "He only charges but no lane light or anything" was exactly this missing`);

// ── Afterimages ──────────────────────────────────────────────────────────
check(r.clones.spawned === 3, 'afterimages spawn', `${r.clones.spawned}`);
check(r.clones.diesInOneHit, 'and die to a single hit', '');
check(r.clones.bossAlive && r.clones.bossHpFrac > 0.5,
  'while the real one does not — that is how you tell them apart', '');
check(r.clones.damaged > 0,
  'standing among them HURTS — they are a threat, not scenery',
  `took ${r.clones.damaged} over 5s surrounded by three. "They don't do shit" was true, and nothing asserted otherwise`);

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — Vader performs his own moves, and his copies bite`);
