// DEFLECTION as a defensive STANCE — the parry vocabulary and the caught super.
//
// smoke-vader already protects the ordinary reflection contract (same red bolt,
// same speed, same reach, nothing in the green pool, a parry is requested and
// the blade honours it). This file protects the two things that pass added:
//
//   1. THE GESTURE. The first parry rotated the blade onto the incoming bearing
//      and pushed it out 30px. Vader's saber already points at the player and
//      the player is where the bolt came from, so that was a few degrees of
//      nothing — on a handset the flash carried the entire read. There is now a
//      registry of eight directional families and a follow-through the blade
//      whips through AFTER contact.
//   2. THE CAUGHT SUPER. Five pellets used to come back individually at
//      `superDamage * player.dmgMult * 0.5` each, and `dmgMult` is four figures
//      by the sixth Vader. He absorbs them and returns ONE slow orb carrying a
//      bounded number instead.
//
// ── HOW THIS FILE AVOIDS THE HARNESS'S FAVOURITE LIE ─────────────────────────
//
// A parry is 300ms and this harness runs at ~20fps with 50-200ms frames, so
// WHERE on the curve any single sample lands is luck. The previous instrument
// measured the same correct code at 49deg, then 2deg, then 49deg. Widening the
// threshold until that passes is measuring the machine, not the game.
//
// So the gesture is split into two claims, neither of which a slow frame can
// outrun:
//   - the SHAPE is asserted against `parryPose`, the pure function preUpdate
//     itself calls. Deterministic, no clock involved.
//   - the LIVE BLADE is asserted to agree with `parryPose` at whatever `u` the
//     frame happens to be at. `preUpdate` decrements `_parryT` and then draws,
//     and `postupdate` fires after both, so the probe reads exactly the value
//     the frame was drawn from — however long that frame was.
//
// Everything about the super is a state transition (pellets in -> one orb out),
// which is stable by construction and needs no timing luck at all.
//
// Vacuity is gated everywhere: each block asserts the event under test actually
// happened before anything reads its properties.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
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

// Same staging as smoke-vader: the real boss room, the real spawn, at an
// encounter that has actually earned DEFLECTION. Hand-staging past the
// production hand-off is what left the arena->boss branch untested for a year.
const enterBossRoom = async (encounter) => page.evaluate(async (n) => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { ENDLESS } = await import('/src/config.js');
  gs.sector = n * ENDLESS.bossEvery;
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((r) => setTimeout(r, 2200));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) {
    gs.spawnBoss(gs.player.x + 380, gs.player.y);
    await new Promise((r) => setTimeout(r, 700));
  }
  gs.player.hp = gs.player.hpMax;
  gs.lives = 9999;
  // Asserted, not assumed: `spawnBoss(bx, by, opts)` takes coordinates first,
  // and a rig that passed `{encounter: 3}` as `bx` once produced NaN positions
  // for a whole session, reading exactly like the feature not existing.
  return {
    mechanics: (gs.boss._mechanics || []).slice(),
    finite: Number.isFinite(gs.boss?.x) && Number.isFinite(gs.boss?.y),
  };
}, encounter);

const keepAlive = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.lives = 9999;
  if (gs.player) { gs.player.alive = true; gs.player.hp = gs.player.hpMax; }
});

const r = {};
r.staged = await enterBossRoom(3);

// ── 1. THE VOCABULARY IS A REGISTRY, AND ITS FAMILIES ARE DIFFERENT ───────
//
// Iterated from the registry rather than spot-checking four bearings — the
// post-mortem's rule, from the pass where a per-move check was forgotten the
// moment a fifth move was added.
r.arcs = await page.evaluate(async () => {
  const { PARRY_ARCS, parryArcFor } = await import('/src/config.js');
  const { parryPose } = await import('/src/entities/Boss.js');
  const D = 180 / Math.PI;
  // TOLERATE THE FEATURE BEING ABSENT, rather than throwing inside the
  // evaluate. On the pre-stance build there is no registry and no pure pose
  // function, and a TypeError here killed the whole file with a Playwright
  // stack and printed NO checks — so the A/B that is supposed to prove these
  // checks discriminate showed nothing either way. Same lesson as the missing
  // `deflectedBullets` in smoke-vader. Report the absence as failures.
  if (!PARRY_ARCS || !parryArcFor || !parryPose) {
    return { count: 0, fams: [], sectorIds: [], distinctSectors: 0,
             distinctPeaks: 0, signs: 0, minPeak: 0, endsAtRest: false,
             absent: true };
  }

  // The peak of each family's follow-through, and the reach at contact.
  const fams = PARRY_ARCS.map((arc) => {
    let peak = 0;
    for (let u = 0; u <= 1.0001; u += 0.02) {
      const pose = parryPose(arc, u);
      if (Math.abs(pose.offsetRad) > Math.abs(peak)) peak = pose.offsetRad;
    }
    return {
      id: arc.id,
      peakDeg: Math.round(peak * D),
      contactReach: Math.round(parryPose(arc, 0).reach),
      endReach: Math.round(parryPose(arc, 1).reach),
    };
  });

  // Every 45-degree sector must resolve to its own family, or "eight families"
  // is eight table rows and one gesture.
  const sectorIds = [];
  for (let d = 0; d < 360; d += 45) sectorIds.push(parryArcFor((d * Math.PI) / 180).id);

  return {
    count: PARRY_ARCS.length,
    fams,
    sectorIds,
    distinctSectors: new Set(sectorIds).size,
    distinctPeaks: new Set(fams.map((f) => f.peakDeg)).size,
    signs: new Set(fams.map((f) => Math.sign(f.peakDeg))).size,
    minPeak: Math.min(...fams.map((f) => Math.abs(f.peakDeg))),
    // The pose must return to rest, or a parry leaves the blade parked off-aim.
    endsAtRest: fams.every((f) => f.endReach === 0)
      && PARRY_ARCS.every((a) => Math.abs(parryPose(a, 1).offsetRad) < 1e-9),
  };
});

// ── 2. THE LIVE BLADE PERFORMS THE FAMILY IT WAS GIVEN ────────────────────
//
// Not "the blade moved a lot" — that is a threshold hunt. The claim is that the
// drawn rotation EQUALS what `parryPose` says for the `_parryT` the frame was
// drawn from, on every sampled frame. Frame length cannot make it wrong.
r.live = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss, p = gs.player;
  const { parryPose } = await import('/src/entities/Boss.js');
  const { ENDLESS } = await import('/src/config.js');
  const MECH = ENDLESS.bossMech;
  const D = 180 / Math.PI;
  // As above — the old build has neither the pure function nor `_parryArc`, so
  // the agreement check has nothing to compare and must fail loudly, not throw.
  const havePose = typeof parryPose === 'function';
  const wrap = (a) => { let x = a % (Math.PI * 2); if (x > Math.PI) x -= Math.PI * 2; if (x < -Math.PI) x += Math.PI * 2; return x; };

  gs.lives = 9999; p.alive = true; p.hp = p.hpMax;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));

  const seen = { frames: 0, worstErrDeg: 0, maxOffAimDeg: 0, guardFrames: 0,
                 guardMinDeg: 999, families: [], skipped: 0 };

  // ── THE CONTACT FRAME CANNOT BE COMPARED, AND THAT IS NOT A BUG ────────
  // Phaser's order is PRE_UPDATE (Boss.preUpdate ticks `_parryT` and DRAWS the
  // blade) -> UPDATE (scene collisions run, a bolt meets him, `parry()` writes a
  // NEW angle, arc and timer) -> `postupdate` (this probe). So on the frame a
  // parry is requested, the sprite still shows the previous pose while the
  // fields already describe the next one, and comparing them reports a
  // guaranteed mismatch — measured at 135deg, which is the arc, not an error.
  // This is the "a collision-time pose lands one frame after its effect" trap
  // in CLAUDE.md, seen from the instrument side for the first time.
  //
  // So skip exactly the frames where that happened, by watching for the call
  // rather than guessing at timing. A 300ms parry is ~6 frames at this harness's
  // rate, so five clean ones per parry still get compared.
  let dirty = false;
  const realParry = b.parry.bind(b);
  b.parry = (...args) => { dirty = true; return realParry(...args); };

  const probe = () => {
    const ws = b.weaponSprite;
    if (!ws) return;
    // The saber is not in his hand — the throw owns it, and the weapon block
    // that draws all of this is skipped entirely while it is away.
    if (b._saberAway) return;
    if (dirty) { dirty = false; seen.skipped++; return; }
    const aim = Math.atan2(p.y - b.y, p.x - b.x);
    if (b._parryT > 0 && b._parryArc && havePose) {
      const pose = parryPose(b._parryArc, 1 - b._parryT / MECH.parryMs);
      const wantRot = b._parryAngle + pose.offsetRad;
      seen.worstErrDeg = Math.max(seen.worstErrDeg, Math.abs(wrap(ws.rotation - wantRot)) * D);
      seen.maxOffAimDeg = Math.max(seen.maxOffAimDeg, Math.abs(wrap(ws.rotation - aim)) * D);
      seen.frames++;
      if (!seen.families.includes(b._parryArc.id)) seen.families.push(b._parryArc.id);
    } else if (b._parryT > 0) {
      // A parry is running but the build has no vocabulary for it. Counted as
      // a drawn frame with an unmeasurable pose, so `worstErrDeg` stays 0 and
      // the SEPARATE off-aim check below is what catches the old behaviour.
      seen.frames++;
      seen.maxOffAimDeg = Math.max(seen.maxOffAimDeg, Math.abs(wrap(ws.rotation - aim)) * D);
    } else if (b.isReflecting()) {
      // The stance itself, with nothing in the air. It has to be off his aim
      // line or it announces nothing at all.
      seen.guardFrames++;
      seen.guardMinDeg = Math.min(seen.guardMinDeg, Math.abs(wrap(ws.rotation - aim)) * D);
    }
  };
  gs.events.on('postupdate', probe);

  // Four bearings, from four different families. Fired from a FLANK each time,
  // never down the boss->player line: a bolt arriving along the resting bearing
  // would give a parry pose indistinguishable from the rest pose, and the check
  // would pass on a build with no gesture in it.
  const toPlayer = Math.atan2(p.y - b.y, p.x - b.x);
  const fired = [];
  for (const off of [Math.PI / 2, -Math.PI / 2, Math.PI * 0.75, -Math.PI * 0.25]) {
    b._reflectUntil = gs.time.now + 3000;
    const a = toPlayer + off;
    gs.playerBullets.fire(b.x + Math.cos(a) * 80, b.y + Math.sin(a) * 80,
      a + Math.PI, 880, 300, 900, { owner: 'player' });
    fired.push(Math.round(off * D));
    await new Promise((res) => setTimeout(res, 420));
  }

  // ...and a stretch of pure stance, no bolts, to sample the guard pose.
  b._reflectUntil = gs.time.now + 900;
  await new Promise((res) => setTimeout(res, 800));

  gs.events.off('postupdate', probe);
  b.parry = realParry;
  b._reflectUntil = 0;
  return { ...seen, fired, guardOffsetDeg: MECH.guardOffsetDeg };
});

await keepAlive();

// ── 3. THE STANCE OWNS HIS SABER ──────────────────────────────────────────
r.stance = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  const { ENDLESS } = await import('/src/config.js');
  gs.lives = 9999; gs.player.alive = true; gs.player.hp = gs.player.hpMax;

  b._reflectUntil = gs.time.now + 4000;
  b.state = 'idle'; b._activeMove = null; b._performing = false;
  const castDuringGuard = gs._castBossMove(b) ? 1 : 0;
  const pickDuringGuard = b.pickAttack();
  // `isGuarding` does not exist on the pre-stance build; `false` is the honest
  // answer there — it had no stance to be in.
  const guardingWhileUp  = b.isGuarding ? b.isGuarding() : false;

  // MELEE MUST STILL LAND. The stance is projectile defence, not invulnerability
  // — the intended answer to it is to stop shooting and close.
  const before = b.hp;
  b.damage(500, { x: 0, y: 0 });
  const meleeDealt = before - b.hp;

  b._reflectUntil = 0;
  const guardingWhileDown = b.isGuarding ? b.isGuarding() : false;
  // ...and offense resumes at once, with no dead recovery bolted on the end.
  b.state = 'idle'; b._activeMove = null;
  const castAfterGuard = gs._castBossMove(b) ? 1 : 0;
  if (b._activeMove) b._activeMove.phase = 'done';
  b._performing = false; b.state = 'idle';

  return { castDuringGuard, castAfterGuard, pickDuringGuard,
           guardingWhileUp, guardingWhileDown, meleeDealt,
           reflectMs: ENDLESS.bossMech.reflectMs };
});

await keepAlive();

// ── 3b. ONE SABER, ONE OWNER ──────────────────────────────────────────────
//
// Handset footage, ~26-29s: SABER THROW sent the blade across the room, the
// reflect clock came due while it was in flight, the guard opened anyway, and
// Vader parried bolts with a weapon that was several hundred pixels away and
// still spinning. Two directions to protect, and this block drives both
// through the production paths — the real move runner, the real mechanic
// clock, real player bolts.
//
// Vacuity is the whole risk here: "no parry happened" passes trivially if the
// throw never started, if the blade never left, or if DEFLECTION was never due.
// Each of those is asserted as an event before anything is concluded from its
// absence.
r.owner = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss, p = gs.player;
  const { ENDLESS } = await import('/src/config.js');
  const MECH = ENDLESS.bossMech;
  gs.lives = 9999; p.alive = true; p.hp = p.hpMax;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));

  // Clean slate, and DEFLECTION armed on its real clock rather than by writing
  // `_reflectUntil` directly — the bug lived in the scheduler, so the scheduler
  // is what has to run.
  b._reflectUntil = 0; b._reflectPending = false; b._reflectClaimed = false;
  b._absorbCount = 0; b._releaseT = 0; b._releaseN = 0; b._absorbT = 0;
  b.state = 'idle'; b._activeMove = null; b._performing = false;
  b._reflectEvery = MECH.reflectEveryMs;
  b._reflectT = MECH.reflectEveryMs;

  const log = [];
  const onW = () => log.push({ ev: 'windup', t: Math.round(gs.time.now), away: !!b._saberAway });
  const onO = () => log.push({ ev: 'open',   t: Math.round(gs.time.now), away: !!b._saberAway });
  gs.events.on('boss-reflect-windup', onW);
  gs.events.on('boss-reflect-open', onO);

  let deflected = 0;
  const realFire = gs.deflectedBullets.fire.bind(gs.deflectedBullets);
  gs.deflectedBullets.fire = (...a) => { deflected++; return realFire(...a); };

  const seen = {
    awayFrames: 0, pendingWhileAway: 0, reflectingWhileAway: 0,
    guardingWhileAway: 0, saberFarPx: 0, weaponSprites: 0,
    awayWhileReflecting: 0, homeFrames: 0, sawAway: 0, caughtAt: -1,
  };
  const probe = () => {
    const ws = b.weaponSprite;
    if (b._saberAway) {
      seen.sawAway = 1;
      seen.awayFrames++;
      if (b._reflectPending) seen.pendingWhileAway++;
      if (b.isReflecting()) seen.reflectingWhileAway++;
      if (b.isGuarding?.()) seen.guardingWhileAway++;
      if (ws?.active) seen.saberFarPx = Math.max(seen.saberFarPx,
        Math.round(Math.hypot(ws.x - b.x, ws.y - b.y)));
    } else {
      // The frame the blade came back, read from inside the loop. A polling
      // `setTimeout` cannot time this: it notices the catch up to a frame late,
      // and the handoff being measured is faster than that — the first draft
      // reported a NEGATIVE handoff because the tell had already fired before
      // the poll looked.
      if (seen.sawAway && seen.caughtAt < 0) seen.caughtAt = Math.round(gs.time.now);
      seen.homeFrames++;
      if (b.isReflecting() && b._saberAway) seen.awayWhileReflecting++;
    }
    // ONE blade, ever. A "spawn a second saber" fix would show up here.
    const n = gs.children.list.filter((o) => o.texture?.key === 'wpn-saber'
                                             && o.visible && o.active).length;
    seen.weaponSprites = Math.max(seen.weaponSprites, n);
  };
  gs.events.on('postupdate', probe);

  // ── CASE A: THROW FIRST ───────────────────────────────────────────────
  const castThrow = gs._castBossMove(b, 'saberthrow') ? 1 : 0;
  for (let i = 0; i < 60 && !b._saberAway; i++) {
    await new Promise((res) => setTimeout(res, 60));
  }
  const leftHand = b._saberAway ? 1 : 0;
  // DEFLECTION comes due NOW, with the blade in the air. This is the exact
  // frame the handset footage caught.
  const dueAt = Math.round(gs.time.now);
  b._reflectT = 1;
  const tellsBeforeDue = log.length;

  // Real bolts into an unarmed Vader while the blade is away. If anything
  // parries them, `deflected` moves and his hp does not.
  const hpBeforeBolts = b.hp;
  for (let i = 0; i < 3 && b._saberAway; i++) {
    const a = Math.atan2(p.y - b.y, p.x - b.x) + Math.PI / 2;
    gs.playerBullets.fire(b.x + Math.cos(a) * 90, b.y + Math.sin(a) * 90,
      a + Math.PI, 880, 300, 900, { owner: 'player' });
    await new Promise((res) => setTimeout(res, 140));
  }
  const boltsWhileAway = hpBeforeBolts - b.hp;
  const deflectedWhileAway = deflected;
  const pendingAtEnd = !!b._reflectPending;
  const tellsWhileAway = log.filter((x) => x.away).length;

  // Wait for the blade to come home, then for the deferred DEFLECTION.
  for (let i = 0; i < 90 && b._saberAway; i++) {
    await new Promise((res) => setTimeout(res, 60));
  }
  const homeAt = seen.caughtAt;
  for (let i = 0; i < 60 && !log.some((x) => x.ev === 'open'); i++) {
    await new Promise((res) => setTimeout(res, 60));
  }
  const tell = log.find((x) => x.ev === 'windup');
  const open = log.find((x) => x.ev === 'open');
  const handoffMs = (tell && homeAt >= 0) ? tell.t - homeAt : -1;
  const deferredMs = tell ? tell.t - dueAt : -1;

  // ...and the recovered stance really does parry.
  const deflBeforeGuard = deflected;
  for (let i = 0; i < 3 && b.isReflecting(); i++) {
    const a = Math.atan2(p.y - b.y, p.x - b.x) + Math.PI / 2;
    gs.playerBullets.fire(b.x + Math.cos(a) * 90, b.y + Math.sin(a) * 90,
      a + Math.PI, 880, 300, 900, { owner: 'player' });
    await new Promise((res) => setTimeout(res, 140));
  }
  const parriedAfterReturn = deflected - deflBeforeGuard;

  // ── CASE B: DEFLECTION FIRST ──────────────────────────────────────────
  // Healed first. `_castBossMove` refuses outright if the player is dead, and
  // this block has been standing in front of a live Vader for several seconds
  // by now — a dead player makes both casts below read as "refused" and the
  // check fails on correct code. (It did, once, before this line.)
  p.alive = true; p.hp = p.hpMax; gs.lives = 9999;
  b._reflectUntil = gs.time.now + 2500;
  b.state = 'idle'; b._activeMove = null; b._performing = false;
  const throwDuringGuard = gs._castBossMove(b, 'saberthrow') ? 1 : 0;
  await new Promise((res) => setTimeout(res, 200));
  const awayDuringGuard = b._saberAway ? 1 : 0;
  // Guard ends — offense must be available again immediately, not after a
  // multi-second penalty for having been deferred.
  b._reflectUntil = 0; b._reflectClaimed = false;
  p.alive = true; p.hp = p.hpMax;
  b.state = 'idle'; b._activeMove = null; b._performing = false;
  const throwAfterGuard = gs._castBossMove(b, 'saberthrow') ? 1 : 0;

  // Teardown: hand the blade back and stop everything this block started.
  const h = b._activeMove;
  if (h?.move?.onCancel) h.move.onCancel(gs, b, h.h || h.state || {});
  if (b._activeMove) b._activeMove.phase = 'done';
  b._saberAway = false; b._noMelee = false; b._performing = false; b.state = 'idle';
  if (b.weaponSprite?.active) { b.weaponSprite.x = b.x; b.weaponSprite.y = b.y; }
  b._reflectUntil = 0; b._reflectPending = false; b._reflectClaimed = false;
  b._reflectEvery = 0;
  gs.events.off('postupdate', probe);
  gs.events.off('boss-reflect-windup', onW);
  gs.events.off('boss-reflect-open', onO);
  gs.deflectedBullets.fire = realFire;

  return {
    ...seen, castThrow, leftHand, tellsBeforeDue, tellsWhileAway,
    boltsWhileAway: Math.round(boltsWhileAway), deflectedWhileAway,
    pendingAtEnd, gotTell: !!tell, gotOpen: !!open,
    handoffMs, deferredMs, parriedAfterReturn,
    throwDuringGuard, awayDuringGuard, throwAfterGuard,
    windupMs: MECH.reflectWindupMs, everyMs: MECH.reflectEveryMs,
  };
});

await keepAlive();

// ── 4. THE SUPER IS CAUGHT, NOT BATTED ────────────────────────────────────
//
// The whole sequence, driven through the production collision path: real super
// pellets from the real pool, into a real guard, out as whatever comes out.
r.superDef = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss, p = gs.player;
  const { ENDLESS, PLAYER } = await import('/src/config.js');
  const MECH = ENDLESS.bossMech;
  gs.lives = 9999; p.alive = true; p.hp = p.hpMax;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));

  // LATE-RUN SCALING, which is the case the old behaviour broke on: five
  // pellets at 600 x 250 returned at half each is 375,000 damage against a
  // 1000hp player. If the return still tracks this number, the check below
  // cannot miss it.
  const dmgWas = p.dmgMult;
  p.dmgMult = 250;

  // Count what comes back, by pool, by wrapping fire().
  let deflected = 0, orbs = 0, green = 0;
  const orbSpec = [];
  const wrapPool = (pool, onFire) => {
    const real = pool.fire.bind(pool);
    pool.fire = (...args) => { const x = real(...args); onFire(x); return x; };
    return () => { pool.fire = real; };
  };
  const un1 = wrapPool(gs.deflectedBullets, () => deflected++);
  const un2 = wrapPool(gs.enemyBullets, () => green++);
  // No orb pool at all on the old build: it batted super pellets back into
  // `deflectedBullets` one by one, which is precisely what `deflected` counts.
  // WHY did the flight end? A 1-frame flight makes a dozen checks below vacuous
  // and reads identically to "the orb never launched", so the death is logged
  // with its position, its own clocks and the call site that asked for it.
  const killLog = [];
  const un3 = gs.bossSuperOrbs ? wrapPool(gs.bossSuperOrbs, (o) => {
    orbs++;
    if (o && !o.__killWrapped) {
      o.__killWrapped = true;
      const realKill = o.kill.bind(o);
      o.kill = (...a) => {
        killLog.push({ x: Math.round(o.x), y: Math.round(o.y),
                       t: Math.round(o._settleT ?? -1), age: Math.round(o._ageMs ?? -1),
                       trav: Math.round(o.traveled),
                       where: (new Error().stack || '').split('\n').slice(1, 4)
                         .map((l) => l.trim().replace(/^at\s+/, '')).join(' <- ') });
        return realKill(...a);
      };
    }
    if (o) orbSpec.push({ dmg: o.damage, speed: Math.round(o._speed),
                          radius: Math.round(o.body.radius),
                          scaleX: o.scaleX, texW: o.width,
                          vx: o.body.velocity.x, vy: o.body.velocity.y,
                          x: o.x, y: o.y, homing: !!o.homing });
  }) : (() => {});

  let absorbed = 0, charged = 0, returned = 0;
  const onA = () => absorbed++;
  const onC = () => charged++;
  const onR = () => returned++;
  gs.events.on('boss-absorbed', onA);
  gs.events.on('boss-super-charged', onC);
  gs.events.on('boss-super-returned', onR);

  // A real super volley — real pool, real damage, real production collision
  // path (`handleBulletEnemyHits(playerSuperBullets, true)`), which is the part
  // under test.
  //
  // The pellets are FANNED IN ORIGIN AND AIMED AT HIM, rather than fanned in
  // heading out of one muzzle the way `_superBlast` throws them. The real 30deg
  // spread from ~380px means the outer pellets miss a boss who is also walking,
  // so a first draft of this block absorbed 5 on one run and 3 on the next —
  // intermittent, and measuring his position rather than his guard. Whether a
  // wide pellet connects is `circleOverlap`'s business and nothing this file
  // claims anything about; how many that DO connect come back is.
  b._reflectUntil = gs.time.now + 4000;

  // ── PIN THE GEOMETRY, THEN MEASURE ────────────────────────────────────
  // The release happens ~1s after the volley lands, and Vader spends that
  // second walking to his standoff range. The orb then spawned into whatever
  // gap was left — sometimes 500px, sometimes 90 — and at 90px it reached the
  // player and died inside two frames, so the flight measurements below had
  // nothing to read. That is not a slow frame, it is the test not controlling
  // the one variable its subject depends on.
  //
  // He is held still and they are held apart, on a clear lane through the
  // middle of the arena. What is under test is what the orb DOES once released;
  // how far apart they happen to be when it is released is his pathing's
  // business and smoke-boss's problem.
  // TWO LANES, because the volley and the flight want different distances.
  //
  // The pellets have to REACH him, and `PLAYER.superRange` is what it is — 520px
  // is inside it. The orb then wants the longest clear runway in the room: at
  // 520px the flight is ~19 frames on a healthy harness and ONE on a stalled
  // one, where a 500ms step covers a third of the lane. That failed two runs in
  // four with "1 frames of it", which reads exactly like a projectile that never
  // launched — the measurement was right and the runway was too short to survive
  // a bad machine.
  //
  // So he is volleyed at 520 across, and then both of them are moved onto a
  // 900px north-south lane while he is still holding it — well before the
  // release, so nothing about the launch itself is staged. North-south is the
  // only bearing with 900 clear pixels here: the meditation pod sits at
  // (340,740) and an east-west lane that long would have him standing in it.
  const LANE = 520;
  const FLIGHT = 900;
  let pinX = 800 - LANE / 2, pinY = 800;
  b.setPosition(pinX, pinY);
  p.setPosition(800 + LANE / 2, 800);
  const pinGeometry = () => {
    b.setVelocity(0, 0);
    b.setPosition(pinX, pinY);
  };
  gs.events.on('postupdate', pinGeometry);

  const pelletDmg = PLAYER.superDamage * p.dmgMult;
  const half = (PLAYER.superPellets - 1) / 2;
  const front = Math.atan2(b.y - p.y, b.x - p.x) + Math.PI / 2;
  for (let i = 0; i < PLAYER.superPellets; i++) {
    const ox = p.x + Math.cos(front) * (i - half) * 22;
    const oy = p.y + Math.sin(front) * (i - half) * 22;
    const a = Math.atan2(b.y - oy, b.x - ox);
    gs.playerSuperBullets.fire(ox, oy, a, PLAYER.superSpeed, pelletDmg,
      PLAYER.superRange, { owner: 'player', piercing: true });
  }

  // Sample the held energy from inside the loop — it exists only between the
  // catch and the release, which is under a second.
  let heldPeak = 0, orbDrawn = 0;
  // Tracked across the WHOLE sequence, not from the moment the poll loop
  // notices the orb. A first draft attached this after the poll and read <3
  // frames on one run in four — and because it could not see the frames before
  // it attached, there was no way to tell a short flight from a late start.
  // Now every frame the orb exists is counted, whenever that is.
  const headings = [];
  const speeds = [];
  let orbSeen = 0, lastOrb = null;
  // ── THE WAKE, sampled from inside the frame loop ─────────────────────
  // Its whole claim is that it comes from the orb's ACTUAL velocity and not
  // from a guess at where the player is. The two are identical at release —
  // the orb is aimed at the player — so a check taken then cannot tell them
  // apart. The player is moved sideways mid-flight further down, and
  // `worstWakeErrDeg` is the disagreement between each ghost's rotation and
  // the live velocity heading across every frame, while `wakeVsPlayerDeg` is
  // how far that heading had diverged from the bearing to the player. A wake
  // pointed at the target passes the first and fails on the second.
  const wake = { worstErrDeg: 0, maxVsPlayerDeg: 0, maxGhosts: 0, frames: 0,
                 coronaFrames: 0, ghostPool: 0 };
  // The hitbox, sampled IN FLIGHT rather than from the fire() wrapper. `fire`
  // ends with a tracer stretch and the release handler cancels it on the next
  // line, so the wrapper photographs a value no physics step ever sees; what
  // the body actually collides with is this.
  const scaleFlight = { min: 99, max: 0, boundsW: 0 };
  const wrapDeg = (a) => { let x = a % 360; if (x > 180) x -= 360; if (x < -180) x += 360; return x; };
  const probe = () => {
    heldPeak = Math.max(heldPeak, b.heldSuper ? b.heldSuper() : 0);
    if (b._absorbOrb) orbDrawn++;
    const o = gs.bossSuperOrbs?.getChildren().find((x) => x.active);
    if (!o) return;
    orbSeen++;
    const vh = Math.atan2(o.body.velocity.y, o.body.velocity.x);
    headings.push(vh);
    // The velocity curve, sampled in the frame it is written, paired with the
    // orb's OWN settle clock rather than with wall time. A ~20fps harness
    // cannot promise to sample at 350ms, and `_settleT` is the number the
    // curve is actually computed from — so this reads the contract, not the
    // machine.
    scaleFlight.min = Math.min(scaleFlight.min, o.scaleX);
    scaleFlight.max = Math.max(scaleFlight.max, o.scaleX);
    scaleFlight.boundsW = Math.round(o.body.width);
    speeds.push({
      t: Math.round(o._settleT ?? -1),
      age: Math.round(o._ageMs ?? -1),
      v: Math.round(Math.hypot(o.body.velocity.x, o.body.velocity.y)),
    });
    lastOrb = { x: Math.round(o.x), y: Math.round(o.y), traveled: Math.round(o.traveled) };

    const f = gs._superOrbFx;
    if (!f) return;
    wake.frames++;
    wake.ghostPool = f.ghosts.length;
    const D = 180 / Math.PI;
    const shown = f.ghosts.filter((gh) => gh.visible);
    wake.maxGhosts = Math.max(wake.maxGhosts, shown.length);
    for (const gh of shown) {
      wake.worstErrDeg = Math.max(wake.worstErrDeg,
        Math.abs(wrapDeg((gh.rotation - vh) * D)));
    }
    if (f.corona.visible) wake.coronaFrames++;
    const toPlayer = Math.atan2(p.y - o.y, p.x - o.x);
    wake.maxVsPlayerDeg = Math.max(wake.maxVsPlayerDeg,
      Math.abs(wrapDeg((vh - toPlayer) * D)));
  };
  gs.events.on('postupdate', probe);

  // Onto the long lane, as soon as the pellets are in his hands and while the
  // release is still winding up. Polled rather than slept: if the volley never
  // lands there is nothing to re-stage and the absorb checks fail honestly.
  for (let i = 0; i < 30 && (b.heldSuper?.() ?? 0) === 0; i++) {
    await new Promise((res) => setTimeout(res, 60));
  }
  pinX = 800; pinY = 800 - FLIGHT / 2;
  b.setPosition(pinX, pinY);
  p.setPosition(800, 800 + FLIGHT / 2);

  // Generous: absorb grace + release windup is ~1s of game time, and this
  // harness stretches timers 2-3x. Polled rather than slept, so a LATE orb is
  // still caught and only a MISSING one fails.
  for (let i = 0; i < 60 && orbs === 0; i++) await new Promise((res) => setTimeout(res, 100));

  // hpMax, not hp. Reading live hp measured what Vader had already chewed off
  // the test player during the ~1s absorb-and-release wait (150 of 1000), which
  // turned "cannot delete a full-health player" into a check against a nearly
  // dead one.
  const hpBefore = p.hpMax;

  // ── DOES IT STEER, AND CAN IT BE WALKED AWAY FROM? ────────────────────
  //
  // One staging answers both. The aim is snapshotted at release, so STEPPING
  // ASIDE after that is exactly the dodge the mechanic promises — and it is
  // also the only conditions under which "does not home" means anything. A
  // first draft simply slept 300ms and read the orb's heading; the orb had
  // already reached the player and killed itself, so the measurement was null
  // and reported as a homing failure.
  //
  // Headings are sampled from INSIDE the frame loop, because whether the orb is
  // still alive at any wall-clock moment is not something this harness can
  // promise.
  // Normal movement, not a dash: 420px is a bit over a second of walking at
  // PLAYER.speed, and the orb takes ~1.7s to cross the lane.
  const hpAtRelease = p.hp;
  p.setPosition(800 + 420, 800 + FLIGHT / 2);    // straight off the lane
  await new Promise((res) => setTimeout(res, 1200));
  gs.events.off('postupdate', probe);
  gs.events.off('postupdate', pinGeometry);
  const dodgedHp = p.hp;

  // Peak-to-trough across every frame it was seen, so a steer at ANY point in
  // the flight shows up, not just one between two chosen samples.
  const drift = headings.length >= 2
    ? Math.max(...headings) - Math.min(...headings)
    : null;

  un1(); un2(); un3();
  gs.events.off('boss-absorbed', onA);
  gs.events.off('boss-super-charged', onC);
  gs.events.off('boss-super-returned', onR);
  b._reflectUntil = 0;
  p.dmgMult = dmgWas;

  // A deflected ordinary bolt, for the speed comparison — the orb has to be a
  // different, slower class of object, not just another returned shot.
  b._reflectUntil = gs.time.now + 1500;
  let ordinarySpeed = 0;
  const un4 = wrapPool(gs.deflectedBullets, (x) => { if (x) ordinarySpeed = Math.round(x._speed); });
  const flank = Math.atan2(p.y - b.y, p.x - b.x) + Math.PI / 2;
  gs.playerBullets.fire(b.x + Math.cos(flank) * 80, b.y + Math.sin(flank) * 80,
    flank + Math.PI, 900, 120, 900, { owner: 'player' });
  await new Promise((res) => setTimeout(res, 400));
  un4();
  b._reflectUntil = 0;

  return {
    absorbed, charged, returned, orbs, deflected, green,
    orb: orbSpec[0] ?? null,
    ordinarySpeed,
    heldPeak, orbDrawn, orbSeen, lastOrb, wake, speeds,
    configSpeed: MECH.superReturnSpeed,
    configCruise: MECH.superReturnCruise,
    configSettleMs: MECH.superReturnSettleMs,
    maxLifeMs: MECH.superReturnMaxLifeMs,
    launchMs: MECH.superLaunchMs,
    releaseMs: MECH.superReleaseMs,
    // Texture-derived, so it must be untouched by a speed change:
    // `Bullet.fire` sets the body from `this.width / 2` and then applies a
    // tracer stretch of `clamp(speed / 620, 1, 2.2)` to scaleX — and
    // `Body.updateBounds` recomputes width from `|scaleX|`. At the 600 launch
    // speed that clamp is STILL exactly 1 (600 < 620), which is the only
    // reason the hitbox survived the impulse.
    orbScaleX: orbSpec[0] ? orbSpec[0].scaleX : null,
    killLog,
    scaleFlight,
    dodged: dodgedHp >= hpAtRelease,
    pelletDmg,
    pelletSumHalved: Math.round(pelletDmg * PLAYER.superPellets * 0.5),
    playerHp: hpBefore,
    driftRad: drift,
    ceiling: MECH.superReturnDamageMax,
    expectDmg: Math.min(MECH.superReturnBase + MECH.superReturnPerPellet * PLAYER.superPellets,
                        MECH.superReturnDamageMax),
    inHostilePools: !!gs.bossSuperOrbs && gs.hostileBullets.includes(gs.bossSuperOrbs),
  };
});

await keepAlive();

// ── 4b. THE LIFETIME CONTRACT ─────────────────────────────────────────────
// The orb's promise is now "until it hits something or leaves the world", so
// the thing that must be proved is the OUT-OF-BOUNDS sweep — it is the only
// backstop between that promise and an orb flying forever. Staged directly:
// launch one, confirm it is genuinely alive first (a dead orb passes this
// vacuously), then put it past the world edge and give the sweep a few frames.
r.bounds = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ENDLESS } = await import('/src/config.js');
  const M = ENDLESS.bossMech;
  const wb = gs.physics.world.bounds;
  const orb = gs.bossSuperOrbs.fire(800, 800, 0, M.superReturnSpeed, 400,
    M.superReturnRange, { owner: 'boss' });
  orb._hx = 1; orb._hy = 0; orb._settleT = 0; orb._ageMs = 0;
  await new Promise((res) => setTimeout(res, 150));
  const aliveInside = orb.active;
  // Far outside, on the axis it is already travelling, so nothing about this
  // is a special case the sweep would not see in a real flight.
  orb.setPosition(wb.right + 400, 800);
  await new Promise((res) => setTimeout(res, 250));
  const deadOutside = !orb.active;
  const wakeHidden = gs._superOrbFx
    ? !(gs._superOrbFx.corona.visible || gs._superOrbFx.ghosts.some((g) => g.visible))
    : true;
  gs.bossSuperOrbs.getChildren().forEach((o) => o.active && o.kill());
  return { aliveInside, deadOutside, wakeHidden,
           range: M.superReturnRange, maxLifeMs: M.superReturnMaxLifeMs,
           worldW: wb.width, worldH: wb.height };
});

// ── 5. NOTHING SURVIVES A ROOM TEARDOWN ───────────────────────────────────
r.cleanup = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  const { ENDLESS } = await import('/src/config.js');
  // Stage a boss mid-sequence: guard up, energy in hand, an orb in the air.
  b._reflectUntil = gs.time.now + 8000;
  b.absorbSuper?.(); b.absorbSuper?.();
  gs.bossSuperOrbs?.fire(b.x, b.y, 0, 300, 400, 1500, { owner: 'boss' });
  await new Promise((res) => setTimeout(res, 120));
  const before = {
    orbs: gs.bossSuperOrbs?.getChildren().filter((o) => o.active).length ?? 0,
    held: b.heldSuper ? b.heldSuper() : 0,
  };
  // His own state dies with HIM — checked first, because the room teardown
  // below destroys the boss and a retreat() called afterwards would throw on a
  // scene that is already gone rather than testing anything.
  b.retreat();
  await new Promise((res) => setTimeout(res, 200));
  const orbGfxGone = !b._absorbOrb;

  gs._clearRoomEntities();
  await new Promise((res) => setTimeout(res, 200));
  const after = {
    orbs: gs.bossSuperOrbs?.getChildren().filter((o) => o.active).length ?? 0,
    // Killing the orb has to hide the wake too: the remnants are ordinary
    // display-list images sitting at the spot the orb died, and a room teardown
    // that left them visible would open the NEXT room with three glowing
    // afterimages of a projectile nobody fired.
    wakeVisible: gs._superOrbFx
      ? (gs._superOrbFx.corona.visible || gs._superOrbFx.ghosts.some((g) => g.visible))
      : false,
  };
  return { before, after, orbGfxGone, reflectMs: ENDLESS.bossMech.reflectMs };
});

await browser.close();

// ═════════════════════════════════════════════════════════════════════════
// 1. The vocabulary
check(r.staged.finite && r.staged.mechanics.includes('reflect'),
  'staged on a Vader who has actually earned DEFLECTION',
  `mechanics ${r.staged.mechanics.join('+')}, finite position ${r.staged.finite} — `
  + 'without both, every check below is measuring something else');
check(!r.arcs.absent && r.arcs.count === 8 && r.arcs.distinctSectors === 8,
  'eight bearing sectors resolve to eight distinct parry families',
  r.arcs.sectorIds.join(', '));
check(!r.arcs.absent && r.arcs.signs === 2 && r.arcs.distinctPeaks >= 5,
  'and the families are genuinely different gestures, not one arc rotated',
  `${r.arcs.distinctPeaks} distinct peak arcs across ${r.arcs.count} families, `
  + `both handednesses present: ${r.arcs.fams.map((f) => `${f.id} ${f.peakDeg}deg`).join(', ')}`);
check(!r.arcs.absent && r.arcs.minPeak >= 100,
  'every family sweeps the blade right through the bolt, not onto it',
  `smallest follow-through is ${r.arcs.minPeak}deg — the rejected build rotated `
  + 'the blade onto the incoming bearing, which is ~0deg off a saber already aimed at the player');
check(!r.arcs.absent && r.arcs.fams.every((f) => f.contactReach >= 40),
  'and thrusts it out at contact',
  r.arcs.fams.map((f) => `${f.id} ${f.contactReach}px`).join(', '));
check(!r.arcs.absent && r.arcs.endsAtRest, 'a finished parry leaves the blade back on guard, every family',
  'a gesture that does not close would park the saber off-aim for the rest of the fight');

// 2. The live blade
check(r.live.frames > 3, 'real player fire really does put him through parries',
  `${r.live.frames} drawn parry frames from bearings ${r.live.fired.join('/')}deg — `
  + '0 means nothing was deflected and every check below it is vacuous');
check(r.live.families.length >= 2,
  'and different incoming bearings select different families',
  `performed: ${r.live.families.join(', ')}`);
check(!r.arcs.absent && r.live.frames > 3 && r.live.worstErrDeg < 0.5,
  'the blade drawn on screen IS the pose parryPose describes, on every frame',
  `worst disagreement ${r.live.worstErrDeg.toFixed(3)}deg. This is the frame-rate-proof `
  + 'form of "the gesture happened": whatever u a 200ms frame lands on, the drawing must match');
check(r.live.frames > 3 && r.live.maxOffAimDeg > 60,
  'and it goes somewhere his ordinary aim pose never does',
  `peaked ${Math.round(r.live.maxOffAimDeg)}deg off the line to the player`);
check(r.live.guardFrames > 2 && r.live.guardMinDeg > 20,
  'the stance is readable with nothing in the air — the guard is not the aim pose',
  `blade held >=${Math.round(r.live.guardMinDeg)}deg off aim across ${r.live.guardFrames} `
  + `frames (configured ${r.live.guardOffsetDeg}deg)`);

// 3. The stance owns the saber
check(r.stance.guardingWhileUp && !r.stance.guardingWhileDown,
  'DEFLECTION is a state he is in, and it ends',
  `guarding up=${r.stance.guardingWhileUp} down=${r.stance.guardingWhileDown}`);
check(r.stance.castDuringGuard === 0 && r.stance.pickDuringGuard === 'idle',
  'no saber move and no stock attack may START while the guard owns the blade',
  `_castBossMove returned ${r.stance.castDuringGuard ? 'a move' : 'null'}, `
  + `pickAttack returned '${r.stance.pickDuringGuard}' — a CHARGE with a parry `
  + 'sweeping sideways out of it is two systems narrating one weapon');
check(r.stance.castAfterGuard === 1,
  'and offense resumes the moment it drops, with no dead recovery',
  `first cast after the stance ended: ${r.stance.castAfterGuard ? 'immediate' : 'REFUSED'}`);
check(r.stance.meleeDealt > 0,
  'melee still hurts him through the guard — it is projectile defence, not immunity',
  `500 melee damage took ${r.stance.meleeDealt} off him. This is the intended answer `
  + 'to the stance: stop shooting and close');
check(r.stance.reflectMs >= 2000,
  'the stance lasts long enough to see several parries',
  `${r.stance.reflectMs}ms against a ~760ms player fire cycle (3 rounds + 520ms reload)`);

// ── ONE SABER, ONE OWNER ─────────────────────────────────────────────────
// Every check below is preceded by the event that makes it non-vacuous. "No
// tell while the blade was away" means nothing unless a throw happened, the
// blade left, and DEFLECTION was genuinely due in between.
const o = r.owner;
check(o.castThrow === 1 && o.leftHand === 1 && o.awayFrames > 3
      && o.saberFarPx > 150,
  'SABER THROW ran and the blade really did leave his hand',
  `cast ${o.castThrow ? 'accepted' : 'REFUSED'}, ${o.awayFrames} frames with the `
  + `saber away, furthest ${o.saberFarPx}px from him. A zero here makes every `
  + 'ownership check below vacuous');
check(o.awayFrames > 3 && o.pendingWhileAway > 0,
  'DEFLECTION came DUE mid-flight and was marked pending rather than lost',
  `${o.pendingWhileAway} of ${o.awayFrames} unarmed frames with the deflection `
  + 'owed. Zero means the clock never came due and the rest proves nothing');
check(o.tellsBeforeDue === 0 && o.tellsWhileAway === 0,
  'and NOTHING was announced while he had no saber to announce it with',
  `${o.tellsWhileAway} windup/open events fired during the flight. On 98da03f `
  + 'the clock fired the tell regardless and the guard opened into an empty hand');
check(o.reflectingWhileAway === 0 && o.guardingWhileAway === 0,
  'the guard was never up while the blade was in the air',
  `${o.reflectingWhileAway} reflecting frames, ${o.guardingWhileAway} guarding `
  + 'frames with the saber gone');
check(o.deflectedWhileAway === 0 && o.boltsWhileAway > 0,
  'and real bolts fired at the unarmed Vader HIT him instead of being parried',
  `${o.boltsWhileAway} damage taken, ${o.deflectedWhileAway} bolts returned. `
  + 'Damage of 0 would mean the bolts never reached him and the check is vacuous');
check(o.weaponSprites <= 1,
  'no second saber was conjured to cover the gap',
  `${o.weaponSprites} live saber sprite(s) at peak — the fix must defer the `
  + 'stance, not duplicate the weapon');
check(o.gotTell && o.gotOpen && o.handoffMs >= 0 && o.handoffMs < 700,
  'the deferred DEFLECTION starts as soon as the blade is back in his hand',
  `tell ${o.handoffMs}ms after the catch (deferred ${o.deferredMs}ms in total), `
  + `guard opened ${o.gotOpen ? 'yes' : 'NO'}. A dropped occurrence never tells; a `
  + `restarted ${o.everyMs}ms cadence would show a handoff in the thousands`);
check(o.parriedAfterReturn > 0,
  'and the recovered stance parries for real',
  `${o.parriedAfterReturn} bolt(s) returned once the guard opened — 0 would mean `
  + 'the deferral cost him the deflection after all');
check(o.throwDuringGuard === 0 && o.awayDuringGuard === 0,
  'the inverse holds: SABER THROW cannot start while the guard owns the blade',
  `cast ${o.throwDuringGuard ? 'ACCEPTED' : 'refused'}, saber away during guard: `
  + `${o.awayDuringGuard ? 'YES' : 'no'}`);
check(o.throwAfterGuard === 1,
  'and it is available again the moment the stance drops — no dead gap',
  `first throw after the guard ended: ${o.throwAfterGuard ? 'immediate' : 'REFUSED'}`);

// 4. The caught super
const gotOrb = r.superDef.orbs === 1 && !!r.superDef.orb;
check(r.superDef.absorbed === 5,
  'all five super pellets are absorbed',
  `${r.superDef.absorbed} caught — 0 means the volley never reached the guard `
  + 'and every check below is vacuous');
check(r.superDef.deflected === 0 && r.superDef.green === 0,
  'and NONE of them is batted back as a projectile',
  `${r.superDef.deflected} into deflectedBullets, ${r.superDef.green} into enemyBullets — `
  + 'the previous build put five red bolts in the first of those');
check(r.superDef.heldPeak >= 5 && r.superDef.orbDrawn > 2,
  'the energy visibly gathers on him before anything comes back',
  `held ${r.superDef.heldPeak} pellets, drawn on ${r.superDef.orbDrawn} frames`);
check(r.superDef.charged === 1,
  'he commits once, not once per pellet',
  `${r.superDef.charged} charge beats from one five-pellet volley`);
check(r.superDef.orbs === 1 && r.superDef.returned === 1,
  'and exactly ONE thing comes back',
  `${r.superDef.orbs} orb(s) fired, ${r.superDef.returned} return event(s)`);
check(gotOrb && r.superDef.orb.dmg === r.superDef.expectDmg,
  'the orb carries a bounded number, not the pellets it swallowed',
  gotOrb
    ? `orb deals ${r.superDef.orb.dmg} (ceiling ${r.superDef.ceiling}) against a `
      + `pellet sum of ${r.superDef.pelletSumHalved} at dmgMult 250 — the old rule `
      + `returned that sum against a ${r.superDef.playerHp}hp player`
    : 'NO ORB — nothing to measure');
check(gotOrb && r.superDef.orb.dmg < r.superDef.playerHp,
  'and cannot delete a full-health player from one accidental super',
  gotOrb ? `${r.superDef.orb.dmg} damage vs ${r.superDef.playerHp} hp` : 'NO ORB');
// The CRUISE speed is the comparison, not the launch impulse: the orb spends
// almost all of its flight at cruise, and that is the number a player is
// reading when they decide whether to walk or dash. It must still be a
// different, slower class of object than a bolt handed straight back.
check(gotOrb && r.superDef.ordinarySpeed > 0
      && r.superDef.configCruise < r.superDef.ordinarySpeed * 0.6
      && r.superDef.orb.speed < r.superDef.ordinarySpeed * 0.75,
  'it travels far slower than an ordinary deflected bolt',
  gotOrb ? `orb ${r.superDef.orb.speed}px/s launch, ${r.superDef.configCruise}px/s `
           + `cruise, vs a deflected bolt at ${r.superDef.ordinarySpeed}px/s`
         : 'NO ORB');
// ── The velocity curve: launch impulse → settle → cruise ─────────────────
// The `speeds` samples carry the orb's OWN settle clock, so every check below
// reads the contract rather than the harness's frame rate.
const sp = r.superDef.speeds ?? [];
const early = sp.filter((x) => x.t <= 40);
const late  = sp.filter((x) => x.t >= r.superDef.configSettleMs);
const peakV = sp.length ? Math.max(...sp.map((x) => x.v)) : 0;
const minAfterSettle = late.length ? Math.min(...late.map((x) => x.v)) : 0;
const maxAfterSettle = late.length ? Math.max(...late.map((x) => x.v)) : 0;

check(gotOrb && r.superDef.configSpeed === 650 && r.superDef.configCruise === 500
      && r.superDef.configSettleMs === 550,
  'the reviewed launch/settle/cruise numbers are what the game is running',
  gotOrb ? `${r.superDef.configSpeed} -> ${r.superDef.configCruise} over `
           + `${r.superDef.configSettleMs}ms` : 'NO ORB');
check(sp.length > 3,
  'the velocity curve was actually sampled in flight',
  `${sp.length} frames of it — fewer than four makes every curve check below `
  + 'vacuous, which is exactly how a projectile that never launched passes. '
  + `Deaths: ${JSON.stringify(r.superDef.killLog)}`);
check(sp.length > 3 && peakV >= 600,
  'it LAUNCHES — the early frames carry the impulse, not the cruise speed',
  `peak measured ${peakV}px/s. A flat 500 (or the old flat 405) cannot reach `
  + 'this. It is short of the 650 launch value because this harness runs at '
  + '~20fps and its first sample lands 50-90ms in — which the curve checks '
  + 'below read around rather than guessing at');
// The launch VALUE cannot be sampled directly here — the first frame the
// harness sees is already tens of milliseconds into the settle. So compare
// every sample against the curve evaluated at that sample's own `_settleT`:
// if the whole curve agrees, its value at t=0 is the 650 launch by
// construction, and the shape is proved at the same time.
const excessCfg = r.superDef.configSpeed - r.superDef.configCruise;
const uOf = (x) => Math.min(1, Math.max(0, x.t / r.superDef.configSettleMs));
const fracOf = (x) => (x.v - r.superDef.configCruise) / excessCfg;
const curveErr = sp.map((x) => {
  const u = uOf(x);
  const want = r.superDef.configCruise + excessCfg * (1 - u * u * (3 - 2 * u));
  return Math.abs(x.v - want);
});
const worstCurve = curveErr.length ? Math.max(...curveErr) : 999;
check(sp.some((x) => x.t < 200) && worstCurve <= 4,
  'and the whole flight follows the launch->settle->cruise curve, frame by frame',
  `worst disagreement ${worstCurve.toFixed(1)}px/s across ${sp.length} samples `
  + `(earliest at t=${sp.length ? Math.min(...sp.map((x) => x.t)) : -1}ms). A flat `
  + 'speed, a linear ramp or a continuing deceleration all fail this');

// ── THE TRANSITION HAS TO LAST LONG ENOUGH TO BE SEEN ────────────────────
// The previous implementation satisfied "launches at X, cruises at Y" and was
// still rejected on a handset: `(1-u)^3` over 350ms had shed two thirds of the
// excess within 120ms, so the launch frame and the cruise frame were the same
// frame. Start and end values therefore prove nothing on their own. These
// bands assert the SHAPE at several points in between, and every one of them
// fails against a front-loaded cubic run over the same 550ms window (which
// holds only 51% of the excess at u=0.2 and 22% at u=0.4).
const band = (lo, hi) => sp.filter((x) => uOf(x) >= lo && uOf(x) < hi);
const early3 = band(0, 0.3), mid3 = band(0.3, 0.65), late3 = band(0.65, 1);
check(early3.length > 0 && mid3.length > 0 && late3.length > 0,
  'the settle window was sampled across its whole length, not just at the ends',
  `${early3.length} early / ${mid3.length} middle / ${late3.length} late samples `
  + 'of the settle — a zero in any of these makes the band checks below vacuous');
check(early3.length > 0 && early3.every((x) => fracOf(x) >= 0.72),
  'the first third of the settle still carries most of the launch impulse',
  `worst ${(Math.min(...early3.map(fracOf)) * 100).toFixed(0)}% of the excess left `
  + 'at u<0.3 (smoothstep holds 78% at u=0.3; a cubic is down to 34%)');
check(mid3.length > 0 && mid3.every((x) => fracOf(x) >= 0.20)
      && mid3.some((x) => fracOf(x) <= 0.80),
  'the shedding is VISIBLE across the middle of the window, not over before it',
  `the middle band spans ${(Math.max(...mid3.map(fracOf)) * 100).toFixed(0)}% down to `
  + `${(Math.min(...mid3.map(fracOf)) * 100).toFixed(0)}% of the excess — a cubic has `
  + 'already dropped under 20% here');
check(late3.length > 0 && late3.every((x) => fracOf(x) <= 0.35)
      && late3.some((x) => fracOf(x) >= 0.02),
  'and it EASES into cruise rather than arriving at it early',
  `the last third spans ${(Math.max(...late3.map(fracOf)) * 100).toFixed(0)}% down to `
  + `${(Math.min(...late3.map(fracOf)) * 100).toFixed(0)}% of the excess`);
const halfIdx = sp.findIndex((x) => fracOf(x) <= 0.5);
const halfU = halfIdx >= 0 ? uOf(sp[halfIdx]) : -1;
check(halfIdx > 0 && halfU >= 0.40,
  'half the excess is still there past the middle of the window',
  `half-shed at u=${halfU.toFixed(2)} (${Math.round(halfU * r.superDef.configSettleMs)}ms `
  + 'of 550). Smoothstep crosses at 0.50; the rejected cubic crossed at 0.21');
check(late.length > 0 && Math.abs(maxAfterSettle - r.superDef.configCruise) <= 4
      && Math.abs(minAfterSettle - r.superDef.configCruise) <= 4,
  'and it SETTLES to the cruise speed by the end of the settle window',
  late.length ? `${late.length} sample(s) at/after ${r.superDef.configSettleMs}ms, `
                + `spanning ${minAfterSettle}-${maxAfterSettle}px/s`
              : 'the orb never survived to the end of the settle window');
check(sp.length > 3 && sp.every((x) => x.v >= r.superDef.configCruise - 2),
  'and NOTHING slows it below cruise — it sheds an impulse, it does not run down',
  `slowest sample ${sp.length ? Math.min(...sp.map((x) => x.v)) : 0}px/s against a `
  + `${r.superDef.configCruise} floor. A continuous deceleration fails here`);
check(late.length > 1,
  'it is still alive well past the settle window',
  `${late.length} frames after ${r.superDef.configSettleMs}ms — a range or `
  + 'lifetime that ended the flight early shows up as 0 or 1');
check(gotOrb && r.superDef.scaleFlight.min === 1 && r.superDef.scaleFlight.max === 1
      && r.superDef.orb.radius * 2 === r.superDef.orb.texW
      && r.superDef.scaleFlight.boundsW === r.superDef.orb.texW,
  'the speed change did NOT move the hitbox',
  gotOrb ? `scaleX ${r.superDef.scaleFlight.min}-${r.superDef.scaleFlight.max} across the `
           + `flight, ${r.superDef.scaleFlight.boundsW}px of body bounds, radius `
           + `${r.superDef.orb.radius} against a ${r.superDef.orb.texW}px texture. `
           + `\`Bullet.fire\` stretches scaleX by clamp(speed/620, 1, 2.2) and `
           + `\`Body.updateBounds\` recomputes width from |scaleX| — the 650 launch is `
           + `OVER that threshold for the first time, so the release handler cancels `
           + `the stretch and this is what proves it. Sampled in flight, not from the `
           + `fire() wrapper, which photographs a value no physics step ever sees`
         : 'NO ORB');
check(r.superDef.releaseMs === 620 && r.superDef.launchMs < r.superDef.releaseMs,
  'the launch beat is carved OUT of the approved anticipation, not added to it',
  `${r.superDef.launchMs}ms of compression inside an unchanged ${r.superDef.releaseMs}ms window`);

// ── The wake ─────────────────────────────────────────────────────────────
check(r.superDef.wake.frames > 2,
  'the flight effect is actually running while the orb is in the air',
  `drawn on ${r.superDef.wake.frames} frames — 0 means every wake check below `
  + 'is vacuous');
check(r.superDef.wake.frames > 2 && r.superDef.wake.worstErrDeg < 1,
  'every remnant lies along the orb\'s REAL velocity',
  `worst disagreement ${r.superDef.wake.worstErrDeg.toFixed(2)}deg across `
  + `${r.superDef.wake.frames} frames`);
check(r.superDef.wake.maxVsPlayerDeg > 20,
  '...and that is a different direction from "at the player", so the check above bites',
  `the heading diverged ${Math.round(r.superDef.wake.maxVsPlayerDeg)}deg from the `
  + 'bearing to the player once they side-stepped — a wake aimed at the target '
  + 'would have passed the previous check and failed here');
check(r.superDef.wake.maxGhosts <= 3 && r.superDef.wake.ghostPool === 3,
  'the wake is bounded — three reused remnants, not a growing tail',
  `${r.superDef.wake.maxGhosts} shown from a pool of ${r.superDef.wake.ghostPool}. `
  + 'A wake long enough to read as a lane would be claiming a hit region that '
  + 'does not exist; the orb is the hazard');
check(r.superDef.wake.coronaFrames > 2,
  'and the corona is alive around it in flight',
  `${r.superDef.wake.coronaFrames} frames`);
check(gotOrb && r.superDef.orb.radius > 30,
  'and it is a different, much bigger class of object',
  gotOrb ? `${r.superDef.orb.radius}px body radius vs an ordinary bolt's 9` : 'NO ORB');
check(r.superDef.orbSeen >= 3,
  'the orb is actually observed in flight',
  `tracked on ${r.superDef.orbSeen} frames, last seen at `
  + `${r.superDef.lastOrb ? `(${r.superDef.lastOrb.x},${r.superDef.lastOrb.y}) after `
      + `${r.superDef.lastOrb.traveled}px` : 'never'} — fewer than 3 frames and the `
  + 'heading check below has nothing to disagree with and passes on anything');
check(gotOrb && !r.superDef.orb.homing && r.superDef.driftRad !== null
      && r.superDef.driftRad < 0.01,
  'and it never steers, even after the player walks out of its way',
  gotOrb ? `homing=${r.superDef.orb.homing}, heading varied `
           + `${(r.superDef.driftRad ?? -1).toFixed(4)}rad across ${r.superDef.orbSeen} frames `
           + 'while the player side-stepped 420px' : 'NO ORB');
check(gotOrb && r.superDef.dodged,
  'so ordinary movement is enough to survive it',
  `player took no damage from the orb after a 420px sidestep at walking speed`);
check(r.superDef.inHostilePools,
  'and it is in hostileBullets, so every sweep of incoming fire sees it',
  'six places iterate incoming fire and half of them are not collision code');

// 4b. Lifetime
check(r.bounds.aliveInside,
  'an orb inside the world keeps flying',
  'staged and still alive after 150ms — without this the out-of-bounds check '
  + 'below would pass on an orb that was never airborne');
check(r.bounds.aliveInside && r.bounds.deadOutside,
  'and one that leaves the world is cleaned up',
  `world ${r.bounds.worldW}x${r.bounds.worldH}; the orb was put 400px past the `
  + 'right edge and did not survive it');
check(r.bounds.deadOutside && r.bounds.wakeHidden,
  'and its wake goes with it',
  'no ghost or corona left visible at the spot it was culled');
check(r.bounds.range > 2263 && r.bounds.maxLifeMs > 0,
  'its range is a backstop, not the thing that ends the flight',
  `range ${r.bounds.range}px against a ${Math.round(Math.hypot(r.bounds.worldW, r.bounds.worldH))}px `
  + `arena diagonal, with a ${r.bounds.maxLifeMs}ms defensive age cap behind it`);

// 5. Teardown
check(r.cleanup.before.orbs > 0, 'a room teardown is staged with an orb actually in the air',
  `${r.cleanup.before.orbs} live orb(s) before the teardown`);
check(r.cleanup.before.orbs > 0 && r.cleanup.after.orbs === 0
      && !r.cleanup.after.wakeVisible,
  'and the room teardown takes it, and its wake, with everything else',
  `${r.cleanup.after.orbs} orb(s) left and wake `
  + `${r.cleanup.after.wakeVisible ? 'STILL SHOWING' : 'hidden'} — a returned `
  + 'super outliving its room would arrive in the next one');
check(r.cleanup.before.held > 0 && r.cleanup.orbGfxGone,
  'the held-energy graphic dies with the boss who was holding it',
  'it is parented to nothing; a withdrawal that left it behind leaves a glow in an empty arena');

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — he bats your fire back and keeps your power`);
