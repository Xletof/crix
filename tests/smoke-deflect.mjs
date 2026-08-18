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
  const un3 = gs.bossSuperOrbs ? wrapPool(gs.bossSuperOrbs, (o) => {
    orbs++;
    if (o) orbSpec.push({ dmg: o.damage, speed: Math.round(o._speed),
                          radius: Math.round(o.body.radius),
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
  const LANE = 520;
  b.setPosition(800 - LANE / 2, 800);
  p.setPosition(800 + LANE / 2, 800);
  const pinGeometry = () => {
    b.setVelocity(0, 0);
    b.setPosition(800 - LANE / 2, 800);
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
  let orbSeen = 0, lastOrb = null;
  const probe = () => {
    heldPeak = Math.max(heldPeak, b.heldSuper ? b.heldSuper() : 0);
    if (b._absorbOrb) orbDrawn++;
    const o = gs.bossSuperOrbs?.getChildren().find((x) => x.active);
    if (!o) return;
    orbSeen++;
    headings.push(Math.atan2(o.body.velocity.y, o.body.velocity.x));
    lastOrb = { x: Math.round(o.x), y: Math.round(o.y), traveled: Math.round(o.traveled) };
  };
  gs.events.on('postupdate', probe);

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
  p.setPosition(800 + LANE / 2, 800 + 420);      // straight off the lane
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
    heldPeak, orbDrawn, orbSeen, lastOrb,
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
check(gotOrb && r.superDef.ordinarySpeed > 0
      && r.superDef.orb.speed < r.superDef.ordinarySpeed * 0.55,
  'it travels far slower than an ordinary deflected bolt',
  gotOrb ? `orb ${r.superDef.orb.speed}px/s vs deflected bolt ${r.superDef.ordinarySpeed}px/s`
         : 'NO ORB');
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

// 5. Teardown
check(r.cleanup.before.orbs > 0, 'a room teardown is staged with an orb actually in the air',
  `${r.cleanup.before.orbs} live orb(s) before the teardown`);
check(r.cleanup.before.orbs > 0 && r.cleanup.after.orbs === 0,
  'and the room teardown takes it with everything else',
  `${r.cleanup.after.orbs} left — a returned super outliving its room would arrive in the next one`);
check(r.cleanup.before.held > 0 && r.cleanup.orbGfxGone,
  'the held-energy graphic dies with the boss who was holding it',
  'it is parented to nothing; a withdrawal that left it behind leaves a glow in an empty arena');

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — he bats your fire back and keeps your power`);
