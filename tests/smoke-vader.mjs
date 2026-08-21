// Vader's mechanic ladder — asserted by EFFECT, not by flag.
//
// The escalation used to be two speed multipliers wearing mechanic names, and a
// test that checked `boss._mechanics.includes('hunt')` would have passed on
// them happily. So nothing here reads a flag. Each check does the thing a
// player would do and looks at what happened:
//
//   deflection   fire at him with the saber up -> he takes nothing AND the shot
//                comes back
//   disarm       the secondary is gone, the pickup is on the floor OUT of
//                magnet range, and collecting it restores the ammo you had
//   lights out   the darkness overlay is actually raised, and comes back down
//   afterimages  the copies die to one hit and the real one does not
//
// The wound->return state machine is checked across three encounters, because
// "wounded rather than killed" is the premise of endless and the bug it guards
// against — a Vader who actually dies — ends the ladder for the rest of the run.
//
// THREE HARNESS TRAPS, all of which produced wrong results here first:
//
//  1. Vader kills the test player. `defeat()` then tears the scene down, and it
//     surfaces as Phaser groups with no entries several blocks later, nowhere
//     near the cause. Hence `keepAlive()` between blocks.
//  2. Counting "hostile bullets exist" to detect a deflection is intermittent —
//     his fan and his guards make them too. Counted via the `boss-reflected`
//     event instead.
//  3. Driving him to zero starts a real room transition, and a second loadRoom
//     on top of one in flight kills the scene. The wound block suppresses the
//     transition and re-acquires the scene per encounter.
//
// Nothing here waits for a mechanic's own clock. They are measured in seconds
// and this harness runs at ~20 FPS; each mechanic is driven through the event
// the boss fires anyway — see Boss._tickMechanics.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

// `?nodlg=1&nofreeze=1` mutes the dialogue cards. They pause Game and HUD and wait for a
// tap, which hangs a bot for the whole measurement cap — see systems/debug.js.
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
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 777 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

// Drop into the boss room at a chosen encounter.
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
  gs.lives = 9999;   // trap 1
  const b = gs.boss;
  const snap = {
    mechanics: (b._mechanics || []).slice(),
    hpMax: b.hpMax,
    // The CLOCKS, not just the flags. A mechanic listed in `_mechanics` whose
    // interval was never written is a mechanic that never fires, and the flag
    // check alone passes on exactly that bug.
    clocks: {
      sunder: b._sunderMs || 0,
      reflect: b._reflectEvery || 0,
      blackout: b._blackoutEvery || 0,
      afterimage: b._afterimageEvery || 0,
      disarm: b._disarmEvery || 0,
    },
    eclipse: !!b._eclipse,
    legion: !!b._legion,
    // The scripted rotation he will actually cycle, at his opening phase.
    moveIds: (b._moveIds || []).slice(),
    moveEvery: b._moveEvery,
    // ── WHAT HE HITS FOR ──────────────────────────────────────────────
    // Vader's damage is FLAT across the whole ladder — a later Vader is
    // harder because he asks more and harder questions, never because the
    // same question costs more. That is a contract, not an accident, and
    // the only way to keep it is to assert it: anything that later scales
    // damage per encounter has to do it by writing one of these.
    dmg: {
      contact: b.cfg.contactDamage,
      slam: b.cfg.slamDamage,
      charge: b.cfg.chargeSpeed,
      mult: b._dmgMult ?? null,
      punish: b._punishMult ?? null,
    },
    // Phase thresholds are RATIOS, so scaling hp must leave both reachable
    // and in order. `hp` is sampled too: scaling hpMax alone would spawn him
    // already past a threshold.
    phase: b.phase,
    hp: b.hp,
    phaseHp: { p2: Math.round(b.hpMax * 0.66), p3: Math.round(b.hpMax * 0.33) },
  };

  // ── PIN THE FREE-RUNNING CLOCKS, AFTER READING THEM ────────────────────
  //
  // Every mechanic in this file is driven through its EVENT, deliberately (see
  // the header): they are measured in seconds and this harness runs at ~20fps,
  // so waiting on a real clock measures the machine. What that never had to
  // handle before is a boss carrying mechanics it is not currently testing —
  // encounter 3 used to stop at DEFLECTION, and now reaches AFTERIMAGES. An
  // afterimage clock coming due inside the 500ms window of the afterimage test
  // would add three clones to a count that has just been staged exactly, and it
  // would do it on some runs and not others.
  //
  // The intervals above are read from the live boss FIRST, so the ladder
  // assertions still test the real configuration; only the countdowns are
  // pushed out of the way of the measurements.
  const FAR = 1e9;
  b._blackoutT = FAR; b._afterimageT = FAR; b._disarmT = FAR;
  b._sunderT = FAR; b._reflectT = FAR;
  return snap;
}, encounter);

const keepAlive = () => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  gs.lives = 9999;
  if (gs.player) { gs.player.alive = true; gs.player.hp = gs.player.hpMax; }
});

const r = {};

// ── The ladder has shed its stat-only entries ─────────────────────────────
r.ladder = await page.evaluate(async () => {
  const { ENDLESS, bossMechanicsFor, bossMechanicById } = await import('/src/config.js');
  const { bossMovesFor } = await import('/src/data/bossMoves.js');
  return {
    ids: ENDLESS.bossMechanics.map((m) => m.id),
    hasSpeedOnly: ENDLESS.bossMechanics.some((m) => m.id === 'hunt' || m.id === 'unbound'),
    // The whole ladder, resolved through the game's own producer.
    rungs: [1, 2, 3, 4, 5, 6].map((n) => bossMechanicsFor(n).map((m) => m.id)),
    // Every id the table introduces must exist in the registry, or a rung
    // silently gains nothing and the medal for it prints as `undefined`.
    unknown: ENDLESS.bossLadder.flat().filter((id) => !bossMechanicById(id)),
    scaleLen: ENDLESS.bossMechScale.length,
    ladderLen: ENDLESS.bossLadder.length,
    // Encounter must NOT widen the scripted rotation. It never did — the
    // `encounter >= 3` clause was dead — and the ladder now says so out loud.
    poolEnc1: bossMovesFor(1, 1),
    poolEnc6: bossMovesFor(1, 6),
  };
});

// Rung 3 LAST on purpose: every section below this one runs against whichever
// boss is left standing in the room, and that was encounter 3 before this block
// grew. Probing 1 and 6 in between and returning to 3 keeps the rest of the file
// measuring exactly the Vader it always measured.
r.enc1 = await enterBossRoom(1);
r.enc6 = await enterBossRoom(6);
r.enc3 = await enterBossRoom(3);

// ── DEFLECTION ────────────────────────────────────────────────────────────
r.reflect = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;

  let reflections = 0;                       // trap 2
  const onRefl = () => reflections++;
  gs.events.on('boss-reflected', onRefl);

  // Control: with the saber DOWN the same shot must land, or the next check
  // proves nothing except that the boss is hard to hit.
  b._reflectUntil = 0;
  const hpBefore = b.hp;
  const ang = Math.atan2(b.y - gs.player.y, b.x - gs.player.x);
  const shoot = () => gs.playerBullets.fire(
    b.x - Math.cos(ang) * 70, b.y - Math.sin(ang) * 70, ang, 900, 400, 900, { owner: 'player' });
  shoot();
  await new Promise((res) => setTimeout(res, 350));
  const normalDamage = hpBefore - b.hp;
  const reflWhileDown = reflections;

  // Now with the saber UP.
  b._reflectUntil = gs.time.now + 4000;
  const hpGuarded = b.hp;
  shoot();
  await new Promise((res) => setTimeout(res, 350));
  const guardedDamage = hpGuarded - b.hp;
  const reflWhileUp = reflections - reflWhileDown;

  const whileUp = b.isReflecting();
  b._reflectUntil = 0;
  const whileDown = b.isReflecting();
  gs.events.off('boss-reflected', onRefl);

  return { normalDamage, guardedDamage, reflWhileDown, reflWhileUp, whileUp, whileDown };
});

// ── THE DEFLECTION IS A PARRY, AND WHAT COMES BACK IS THE SHOT ────────────
//
// Three claims, and each is asserted against the thing that used to be true:
// the returned bolt was a GREEN enemy bolt at a flat 437px/s spawned 50px from
// Vader on the boss->player line, and his blade never moved.
//
// The bolt is fired from a FLANK on purpose. Vader's saber rests on the bearing
// to the player every frame, so a shot arriving down that same line would give
// a parry pose identical to the resting pose — the check would pass on a build
// with no parry in it at all.
r.deflect = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss, p = gs.player;
  // The DEFLECTION block above already turned one shot, and its returned bolt
  // flies at the player — who is standing still. Put them back on their feet and
  // out of the way, or this block stages its shot from a corpse's coordinates.
  gs.lives = 9999;
  p.alive = true; p.hp = p.hpMax;

  // CAPTURE THE BOLT THIS BLOCK MAKES, by wrapping the pool's fire().
  //
  // Reading `deflectedBullets.getChildren()[0]` looked exact and was a race:
  // the block above leaves its own deflection in that pool, so whether index 0
  // was MY bolt depended on whether the earlier one had died and been recycled
  // by the time I fired. It passed twice and then reported `returned 900` —
  // which is the other block's muzzle speed, not a wrong deflection.
  //
  // Tolerate the pool being ABSENT rather than reaching into it. On the
  // pre-Deflection build `gs.deflectedBullets` is undefined and this threw
  // inside the evaluate, which killed the whole file with a Playwright stack and
  // printed no checks at all — so the A/B meant to prove these checks
  // discriminate showed nothing either way. Everything below still runs: the
  // shot is still fired, the green pool is still counted, and the old build
  // reports what it actually does, which is a green bolt and no parry.
  let mine = null;
  const pool = gs.deflectedBullets;
  const realFire = pool ? pool.fire.bind(pool) : null;
  if (pool) pool.fire = (...args) => { const bul = realFire(...args); mine = bul; return bul; };

  // Count green bolts the DEFLECTION makes, rather than green bolts that exist.
  // Counting bolts in flight failed intermittently for an honest reason: his
  // guards and spawned minions fire the same green bolt, so one trooper taking a
  // shot during the 500ms window read as the deflection having made it. Clear
  // the room and count CALLS — then zero means zero, whatever else is happening.
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  let greenFired = 0;
  const realGreen = gs.enemyBullets.fire.bind(gs.enemyBullets);
  gs.enemyBullets.fire = (...args) => { greenFired++; return realGreen(...args); };

  // Sample from INSIDE the frame loop. The parry is 190ms; a page.evaluate
  // round trip is 200-400ms, so polling from outside would miss all of it.
  const seen = { parryTicks: 0, maxDevDeg: 0 };
  const probe = () => {
    if (b._parryT > 0) seen.parryTicks++;
    const ws = b.weaponSprite;
    if (!ws) return;
    const toPlayer = Math.atan2(p.y - b.y, p.x - b.x);
    // Wrapped by hand — `Phaser` is bundled, not a page global.
    let dev = (ws.rotation - toPlayer) % (Math.PI * 2);
    if (dev > Math.PI) dev -= Math.PI * 2;
    if (dev < -Math.PI) dev += Math.PI * 2;
    seen.maxDevDeg = Math.max(seen.maxDevDeg, Math.abs(dev) * 180 / Math.PI);
  };
  gs.events.on('postupdate', probe);

  b._reflectUntil = gs.time.now + 4000;
  // Perpendicular to the boss->player line, so the intercept bearing is ~90deg
  // off where the blade is resting.
  const toPlayer = Math.atan2(p.y - b.y, p.x - b.x);
  const flank = toPlayer + Math.PI / 2;
  const SPEED = 880;
  const RANGE = 900;
  const shot = gs.playerBullets.fire(
    b.x + Math.cos(flank) * 90, b.y + Math.sin(flank) * 90,
    flank + Math.PI, SPEED, 400, RANGE, { owner: 'player' });
  const shotTex = shot?.texture?.key ?? null;

  await new Promise((res) => setTimeout(res, 500));
  gs.events.off('postupdate', probe);

  // ── DOES A PARRY ACTUALLY MOVE THE BLADE? ─────────────────────────────
  //
  // Measured separately, because racing the organic one is measuring the frame
  // rate. The pose decays as (1-u)^2 across `parryMs` (190ms); at this harness's
  // 50-200ms frames the single sample can land anywhere on that curve, or after
  // the whole window has closed inside one slow frame — which is why the organic
  // deviation read 49deg, then 2deg, then 49deg on three identical runs.
  //
  // Calling `parry()` once per frame is NOT enough to hold it: `preUpdate`
  // subtracts a whole frame's delta, and when a frame is longer than `parryMs`
  // the window is already spent before the weapon block reads it — the branch
  // never runs and the deviation is exactly 0. Measured: 0deg across 4 frames.
  // So write the flag directly with a duration no frame can swallow. What is
  // under test is the DRAWING — that `preUpdate` honours the flag and aims the
  // blade at the bearing it was handed — not how long 190ms lasts.
  //
  // He is also held still. `reach` is a distance between two things that both
  // move, and a charging Vader covers ~95px in one of this harness's frames, so
  // an unpinned measurement reports his velocity rather than his blade's.
  const held = { maxDevDeg: 0, reach: 0, frames: 0 };
  const want = Math.atan2(p.y - b.y, p.x - b.x) + Math.PI / 2;   // 90deg off guard
  const hold = () => {
    b.setVelocity(0, 0);
    b._parryAngle = want;
    // FIVE SECONDS, not 400ms, and the margin is the point. `parryPose` clamps
    // `u` to [0, 1], so any `_parryT` above `parryMs` pins the CONTACT pose —
    // blade exactly on the bearing it was handed. At 400 against a 300ms
    // `parryMs` there was only 100ms of headroom, so a single slow frame's
    // delta subtraction dropped it into the follow-through, where the blade has
    // swung up to 166deg further round and can land back NEAR the aim line. The
    // check then read a small deviation and failed on correct code — twice in
    // eight suite runs. What is under test is that `preUpdate` honours the flag
    // and aims the blade where it was told, not how long 300ms lasts.
    b._parryT = 5000;
    const ws = b.weaponSprite;
    if (!ws) return;
    const toPlayer = Math.atan2(p.y - b.y, p.x - b.x);
    let dev = (ws.rotation - toPlayer) % (Math.PI * 2);
    if (dev > Math.PI) dev -= Math.PI * 2;
    if (dev < -Math.PI) dev += Math.PI * 2;
    held.maxDevDeg = Math.max(held.maxDevDeg, Math.abs(dev) * 180 / Math.PI);
    held.reach = Math.max(held.reach, Math.hypot(ws.x - b.x, ws.y - b.y));
    held.frames++;
  };
  gs.events.on('postupdate', hold);
  await new Promise((res) => setTimeout(res, 400));
  gs.events.off('postupdate', hold);

  if (pool) pool.fire = realFire;
  gs.enemyBullets.fire = realGreen;
  b._reflectUntil = 0;

  // A pooled bullet keeps its texture, speed and range after it is killed, so
  // reading `mine` once it has landed is fine — but it must be MINE.
  const d = mine;

  return {
    shotTex,
    made: d ? 1 : 0,
    tex: d?.texture?.key ?? null,
    speed: d ? Math.round(d._speed) : 0,
    range: d?.range ?? 0,
    firedSpeed: SPEED,
    firedRange: RANGE,
    greenFired,
    parryTicks: seen.parryTicks,
    maxDevDeg: Math.round(seen.maxDevDeg),
    heldDevDeg: Math.round(held.maxDevDeg),
    heldReach: Math.round(held.reach),
    heldFrames: held.frames,
    restReach: (await import('/src/config.js')).BOSS.radius - 6,
    hasParry: typeof b.parry === 'function',
    hasFx: typeof gs.fx?.saberParry === 'function',
  };
});

await keepAlive();

// ── SUPPRESSION (internal id `disarm`) ────────────────────────────────────
//
// WHAT THIS USED TO CHECK, AND WHY IT PROVED NOTHING. The old block asserted
// that `player.secondary` was removed, that a pickup landed outside the 90px
// magnet, and that walking onto it restored the ammo — every one of them a
// fact about THE ITEM. None asked whether the player could still do anything,
// so nobody noticed that primary fire, super, melee and dash all still worked
// and the mechanic was invisible in the hand. It also asserted that disarming
// an unarmed player "drops nothing", which certified the silent no-op —  the
// hole in the rung — as correct behaviour.
//
// The contract now is about the player's VERBS.
r.suppress = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const hud = window.game.scene.getScene('HUD');
  const { PLAYER } = await import('/src/config.js');
  const p = gs.player;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const nB = () => gs.playerBullets.getChildren().filter((b) => b.active).length;
  const arm = () => {
    p.superCharge = PLAYER.superHitsToCharge;
    p.meleeCharge = PLAYER.meleeHitsToCharge;
    p._comboStage = 0; p._comboWindowMs = 0;
    p.fireCooldown = 0; p.ammo = PLAYER.ammoMax;
    p.dashCharges = 3; p.isDashing = false; p._hurtStaggerMs = 0;
    gs.events.emit('player-super-changed'); gs.events.emit('player-melee-changed');
  };
  const probe = () => {
    arm();
    const o = {
      hudSuperTex: hud.superButton?.image?.texture?.key,
      hudMeleeTex: hud.meleeButton?.image?.texture?.key,
      hudTinted: !!hud.superButton?.image?.isTinted && !!hud.meleeButton?.image?.isTinted,
    };
    const b0 = nB();
    o.primary = p.tryFire(0);
    o.bolts = nB() - b0;
    p.fireCooldown = 0;
    o.super = p.tryFireSuper(0);
    o.superKept = p.superCharge === PLAYER.superHitsToCharge;
    o.wings = p.tryMeleeCombo(0);
    o.wingsKept = p.meleeCharge === PLAYER.meleeHitsToCharge;
    o.wingsLink2 = p.tryMeleeCombo(0);       // a live chain must not slip through
    p.isDashing = false; p.dashCharges = 3;
    const d0 = p.dashCharges; p.tryDash();
    o.dashSpent = d0 - p.dashCharges;
    return o;
  };

  // NO SECONDARY. The old mechanic did nothing at all in this state.
  p._equipNothing();
  const before = probe();
  const banners = [];
  const spy = (t) => banners.push(t);
  gs.events.on('show-banner', spy);
  gs.events.emit('boss-disarm', gs.boss);
  await wait(120);
  const armedMs = p._suppressedMs;
  const pickupsAfter = gs.weaponPickups.length;
  const during = probe();
  // Switching aim mode must not be a way round it.
  p.beginMeleeAim?.();
  const bypass = { wings: p.tryMeleeCombo(0), super: p.tryFireSuper(0) };
  // A second activation refreshes, it does not stack.
  await wait(500);
  const midMs = p._suppressedMs;
  gs.events.emit('boss-disarm', gs.boss);
  const repeatMs = p._suppressedMs;
  await wait(PLAYER.suppressMs + 500);
  gs.events.off('show-banner', spy);
  const after = probe();

  // A rifle in hand changes nothing, and is not taken.
  p.equipSecondary('rifle');
  p.secondaryAmmo = 7;
  await wait(120);
  const pk0 = gs.weaponPickups.length;
  gs.events.emit('boss-disarm', gs.boss);
  await wait(150);
  const withRifle = {
    held: p.secondary, ammo: p.secondaryAmmo,
    dropped: gs.weaponPickups.length - pk0, suppressed: !!p.suppressed,
  };
  // Death must not leave the lock on the next life.
  p.clearSuppression();
  const cleared = !!p.suppressed;
  return { before, during, after, banners, armedMs, pickupsAfter,
           bypass, midMs, repeatMs, withRifle, cleared, dur: PLAYER.suppressMs };
});

await keepAlive();

// ── LIGHTS OUT ────────────────────────────────────────────────────────────
r.blackout = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const hud = window.game.scene.getScene('HUD');
  const { DARKNESS } = await import('/src/config.js');
  const ov = () => hud._overlays?.blackout;
  const alpha = () => ov()?.alpha ?? 0;
  // Force the lights ON first. The room can roll the DARKNESS modifier, which
  // leaves the AMBIENT overlay already up — a different object now, but the
  // starting state still has to be known rather than inherited.
  gs.events.emit('set-darkness', false);
  gs.events.emit('set-darkness', false, 'blackout');
  await new Promise((res) => setTimeout(res, 500));
  const before = alpha();
  // SAMPLED FROM A postupdate HOOK, NOT A POLL. The onset is a power-failure
  // flicker (dark, stutter, dark), so it is deliberately NOT monotonic and a
  // single probe can land in the stutter and read lower than the gentle ease
  // it replaced — the peak inside the first 150ms is the claim. An in-page
  // `await setTimeout(16)` loop is not good enough either: measured, it
  // returned ONE sample for a 260ms window, because a sleep resolves on the
  // next frame and this harness runs at ~20fps. The hook fires every frame the
  // engine actually renders, which is the only clock that can see this.
  const tape = [];
  const t0 = performance.now();
  const sample = () => tape.push([Math.round(performance.now() - t0), alpha()]);
  hud.events.on('postupdate', sample);
  gs.events.emit('boss-blackout', gs.boss, 1400);
  sample();
  await new Promise((res) => setTimeout(res, 400));
  hud.events.off('postupdate', sample);
  // ASSERTED IN FRAMES, NOT MILLISECONDS. Measured, this harness renders one
  // frame every ~190ms under load — longer than the whole onset — so no
  // wall-clock threshold can tell a hard cut from a soft ease here. What CAN
  // be read at any frame rate is whether there is a visible RAMP: the first
  // frame that shows any darkening at all is already near full for a cut, and
  // is still climbing for an ease. The 420ms Sine this replaced scores 0.06 on
  // the next frame at 60fps and 0.59 on the next frame at this harness's rate.
  const firstLit = tape.find(([, a]) => a > 0.01);
  const firstStep = firstLit ? firstLit[1] : -1;
  await new Promise((res) => setTimeout(res, 300));
  const during = alpha();
  const pocket = { x: Math.round(ov().x), y: Math.round(ov().y) };
  const playerScreen = (() => {
    const cam = gs.cameras.main;
    return { x: Math.round((gs.player.x - cam.scrollX) * cam.zoom + cam.x),
             y: Math.round((gs.player.y - cam.scrollY) * cam.zoom + cam.y) };
  })();
  await new Promise((res) => setTimeout(res, 2000));
  return {
    before, tape, firstStep, during, after: alpha(), pocket, playerScreen,
    pad: DARKNESS.blackout.pad,
    // THE THING THE OLD TEST COULD NOT SEE. An alpha of 1 on the ambient
    // gradient darkens the middle of the screen by 0%, so "alpha rose" passed
    // on a mechanic nobody could perceive. These are read off the gradient
    // that actually draws, at radii the fight happens at.
    profile: (() => {
      const tex = window.game.textures.get('darkness-blackout');
      const img = tex.getSourceImage();
      const ctx = tex.getContext();
      const cx = img.width / 2, cy = img.height / 2;
      const a = (r) => ctx.getImageData(Math.round(cx + r), Math.round(cy), 1, 1).data[3] / 255;
      return { r0: a(0), r80: a(80), r150: a(150), r200: a(200), r300: a(300), r420: a(420) };
    })(),
    ambientUntouched: {
      inner: DARKNESS.ambient.inner, outer: DARKNESS.ambient.outer,
      stops: JSON.stringify(DARKNESS.ambient.stops),
      fadeInMs: DARKNESS.ambient.fadeInMs,
    },
    separateTextures: window.game.textures.exists('darkness-ambient')
                   || window.game.textures.exists('darkness-blackout'),
  };
});

await keepAlive();

// ── AFTERIMAGES ───────────────────────────────────────────────────────────
r.afterimages = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.events.emit('boss-afterimages', b, 3);
  await new Promise((res) => setTimeout(res, 500));

  const clones = gs.enemies.getChildren().filter((e) => e.alive && e._afterimage);
  const spawned = clones.length;
  // They have to wear HIS sprite — a tinted grunt answers "which one is he?"
  // before the question lands.
  const wearingHisSprite = clones.filter((c) => c.texture?.key === 'boss').length;

  const bossHpBefore = b.hp;
  clones.forEach((c) => c.damage(1));
  await new Promise((res) => setTimeout(res, 300));
  const cloneSurvivors = gs.enemies.getChildren().filter((e) => e.alive && e._afterimage).length;

  b.damage(1);
  await new Promise((res) => setTimeout(res, 200));

  return { spawned, wearingHisSprite, cloneSurvivors, bossStillAlive: b.alive,
           bossHpFrac: b.hp / b.hpMax, bossHpBefore };
});

await keepAlive();

// ── Wound -> return ───────────────────────────────────────────────────────
await page.evaluate(() => {
  window.__vaderTally = { wounds: 0, deaths: 0 };
  // Bound per-encounter below, not once: the scene emitter is cleared between
  // rooms, so a single binding here would quietly stop counting.
  window.__rebindVader = (scene) => {
    scene.events.on('boss-wounded', () => window.__vaderTally.wounds++);
    scene.events.on('boss-died', () => window.__vaderTally.deaths++);
  };
});

r.wound = { seen: [] };
for (let n = 1; n <= 3; n++) {
  const one = await page.evaluate(async (enc) => {
    const gs = window.game.scene.getScene('Game');
    const { ROOMS } = await import('/src/data/rooms.js');
    const { ENDLESS } = await import('/src/config.js');
    window.__rebindVader(gs);

    gs.sector = enc * ENDLESS.bossEvery;
    gs.loadRoom(ROOMS.find((r) => r.boss));
    await new Promise((res) => setTimeout(res, 2200));
    gs.arenaActive = false;
    gs.lives = 9999;
    if (!gs.boss?.alive) {
      gs.spawnBoss(gs.player.x + 380, gs.player.y);
      await new Promise((res) => setTimeout(res, 700));
    }
    const b = gs.boss;
    const rec = { n: enc, hpMax: b.hpMax, mech: (b._mechanics || []).length, cap: b._dmgCap };

    gs._maybeCompleteRoom = () => {};       // trap 3

    // Bounded by WALL CLOCK, not hit count: the intake cap absorbs everything
    // past 1600 per 120ms window, so hammering in a tight loop delivers one
    // window's worth however many calls it makes.
    const deadline = performance.now() + 30000;
    while (b.alive && performance.now() < deadline) {
      b.damage(5000);
      await new Promise((res) => setTimeout(res, 8));
    }
    await new Promise((res) => setTimeout(res, 500));
    rec.downed = !b.alive;
    return rec;
  }, n);
  r.wound.seen.push(one);
  await page.waitForTimeout(1200);
}
Object.assign(r.wound, await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  delete gs._maybeCompleteRoom;             // back to the prototype's
  return {
    woundEvents: window.__vaderTally.wounds,
    deathEvents: window.__vaderTally.deaths,
    restored: typeof gs._maybeCompleteRoom === 'function',
  };
}));

// ── The intake cap ────────────────────────────────────────────────────────
r.cap = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.sector = 5;
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((res) => setTimeout(res, 2200));
  gs.lives = 9999;
  if (!gs.boss?.alive) {
    gs.spawnBoss(gs.player.x + 380, gs.player.y);
    await new Promise((res) => setTimeout(res, 700));
  }
  const b = gs.boss;
  const before = b.hp;
  b.damage(999999);                          // one absurd hit, one window
  const taken = before - b.hp;
  return { cap: b._dmgCap, taken, hpMax: b.hpMax, capped: taken <= b._dmgCap + 1 };
});

// ── The punish window must not kill him ──────────────────────────────────
//
// `Enemy.damage` multiplies incoming damage by `_punishMult` while the enemy is
// in a punish window, and `Boss.damage`'s retreat intercept used to test the
// UNMULTIPLIED number. So a hit that was not lethal raw became lethal once the
// parent applied it: super.damage drove hp to zero, called die(), and Vader was
// KILLED in endless — the one thing the ladder promises cannot happen.
//
// It was latent for as long as the punish window and the retreat have coexisted,
// and it only surfaced when the hp pool moved, because that changed where hits
// land relative to punish windows. The checks above caught it by luck of the
// arithmetic. This one aims at it: set a punish window, leave him with LESS hp
// than the multiplied hit but MORE than the raw one, and hit him once. That is
// the exact band the old condition let through.

r.punish = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  gs.sector = 5;
  gs.loadRoom(ROOMS.find((rm) => rm.boss));
  await new Promise((res) => setTimeout(res, 2000));
  gs.arenaActive = false;
  gs.lives = 9999;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) {
    gs.spawnBoss(gs.player.x + 380, gs.player.y);
    await new Promise((res) => setTimeout(res, 700));
  }
  const b = gs.boss;
  gs._maybeCompleteRoom = () => {};

  let died = 0; let wounded = 0;
  const onD = () => died++; const onW = () => wounded++;
  gs.events.on('boss-died', onD);
  gs.events.on('boss-wounded', onW);

  // 1000 raw, x3 in the window = 3000 applied. Sit him at 2000: survives the
  // raw hit, dies to the applied one.
  b._punishMs = 5000;
  b._punishMult = 3;
  b.hp = 2000;
  const retreats = b._retreats;
  b.damage(1000);
  await new Promise((res) => setTimeout(res, 400));

  gs.events.off('boss-died', onD);
  gs.events.off('boss-wounded', onW);
  return { died, wounded, retreats, hp: b.hp };
});

await browser.close();

// ── Ladder ───────────────────────────────────────────────────────────────
check(!r.ladder.hasSpeedOnly, 'the ladder carries no stat-only entries',
  `still has ${r.ladder.ids.join(', ')} — a speed multiplier is the same fight with the numbers moved`);
check(r.ladder.ids.length >= 6, 'and has a mechanic for each of the early encounters', r.ladder.ids.join(', '));
check(r.ladder.unknown.length === 0,
  'every id the ladder table names exists in the registry',
  `unknown: ${r.ladder.unknown.join(', ')} — that rung gains nothing and its medal prints undefined`);
check(r.ladder.scaleLen === r.ladder.ladderLen,
  'the cadence table covers every rung of the ladder',
  `${r.ladder.scaleLen} scales for ${r.ladder.ladderLen} rungs`);

// ── ENCOUNTER 1 IS COMPLETE VADER ────────────────────────────────────────
// The gate this pass exists for. Asserted by NAME rather than by count: the
// old check was `enc1.mechanics.length === 1`, which passes on any single
// mechanic and passed on the build where that mechanic fired exactly once and
// then never again for the rest of the fight.
check(r.enc1.mechanics.includes('reflect'),
  'the FIRST Vader has DEFLECTION',
  `enc1 carries [${r.enc1.mechanics.join(', ')}] — it was a wound-2 reveal before`);
check(r.enc1.clocks.reflect > 0,
  'and a live reflect clock, not just the flag',
  `reflectEvery ${r.enc1.clocks.reflect} — a mechanic with no interval never fires`);
check(r.enc1.mechanics.includes('sunder') && r.enc1.clocks.sunder > 0,
  'and SUNDERING SLAM on a running clock — the recurring event that fills the dead air',
  `[${r.enc1.mechanics.join(', ')}] sunder=${r.enc1.clocks.sunder}`);
check(r.enc1.moveIds.length >= 3,
  'and the full scripted rotation from the first fight',
  `enc1 pool [${r.enc1.moveIds.join(', ')}]`);
check(r.ladder.poolEnc1.join(',') === r.ladder.poolEnc6.join(','),
  'the rotation does NOT widen with the encounter — it never did',
  `enc1 [${r.ladder.poolEnc1.join(', ')}] vs enc6 [${r.ladder.poolEnc6.join(', ')}]`);

// ── AND LATER VADER IS STILL DIFFERENT ───────────────────────────────────
// The other half of the gate: pulling the brain forward must not have stolen
// the late reveals. This fails on a ladder that gave encounter 1 everything.
check(!r.enc1.mechanics.includes('blackout')
  && !r.enc1.mechanics.includes('afterimages')
  && !r.enc1.mechanics.includes('disarm')
  && !r.enc1.mechanics.includes('legion')
  && !r.enc1.eclipse,
  'the first Vader still has none of the late mechanics',
  `enc1 carries [${r.enc1.mechanics.join(', ')}]`);
check(r.enc6.mechanics.length > r.enc3.mechanics.length
  && r.enc3.mechanics.length > r.enc1.mechanics.length,
  'and each rung strictly gains on the one before it',
  `${r.enc1.mechanics.length} -> ${r.enc3.mechanics.length} -> ${r.enc6.mechanics.length}`);
check(r.enc1.mechanics.every((id) => r.enc6.mechanics.includes(id)),
  'the ladder is cumulative — nothing is taken back',
  `enc1 [${r.enc1.mechanics.join(', ')}] not a subset of enc6 [${r.enc6.mechanics.join(', ')}]`);
check(r.enc6.eclipse && r.enc6.legion,
  'the last rung carries THE DARK and LEGION',
  `eclipse ${r.enc6.eclipse} legion ${r.enc6.legion}`);

// ── CADENCE SEASONING, AND THE ONE EXEMPTION ─────────────────────────────
check(r.enc6.clocks.sunder < r.enc1.clocks.sunder,
  'mechanic clocks tighten down the ladder',
  `sunder ${r.enc1.clocks.sunder} -> ${r.enc6.clocks.sunder}`);
check(r.enc6.clocks.reflect === r.enc1.clocks.reflect && r.enc1.clocks.reflect === 9000,
  'but DEFLECTION keeps its frozen 9s cadence at every rung',
  `${r.enc1.clocks.reflect} -> ${r.enc6.clocks.reflect} — `
  + `scaling it turns a 2.4s stance into a third of the fight`);

check(r.enc3.hpMax > r.enc1.hpMax && r.enc6.hpMax > r.enc3.hpMax,
  'and a bigger pool each time', `${r.enc1.hpMax} -> ${r.enc3.hpMax} -> ${r.enc6.hpMax}`);
check(r.enc6.hpMax === Math.round(r.enc1.hpMax * (1 + 0.15 * 5)),
  'hp scaling is applied exactly once, linearly in the boss number',
  `${r.enc1.hpMax} -> ${r.enc6.hpMax}, expected ${Math.round(r.enc1.hpMax * 1.75)} — `
  + `a second multiplier anywhere shows up here`);
check(JSON.stringify(r.enc1.dmg) === JSON.stringify(r.enc6.dmg),
  'and DAMAGE does not scale with the encounter at all',
  `enc1 ${JSON.stringify(r.enc1.dmg)} vs enc6 ${JSON.stringify(r.enc6.dmg)} — `
  + `richer behaviour plus faster cadence plus bigger hits is unavoidable burst death`);
check([r.enc1, r.enc3, r.enc6].every((e) => e.phase === 1 && e.hp === e.hpMax
  && e.phaseHp.p3 < e.phaseHp.p2 && e.phaseHp.p2 < e.hpMax),
  'every rung spawns at full hp in phase 1 with both thresholds still ahead of him',
  [r.enc1, r.enc3, r.enc6].map((e) => `p${e.phase} ${e.hp}/${e.hpMax} `
    + `(${e.phaseHp.p2}/${e.phaseHp.p3})`).join('  '));

// ── Deflection ───────────────────────────────────────────────────────────
check(r.reflect.normalDamage > 0, 'a shot with the saber DOWN lands (the control)',
  `dealt ${r.reflect.normalDamage} — without this the next check proves nothing`);
check(r.reflect.guardedDamage === 0, 'and the same shot with the saber UP deals nothing',
  `dealt ${r.reflect.guardedDamage}`);
check(r.reflect.reflWhileUp === 1 && r.reflect.reflWhileDown === 0,
  'it is turned around — exactly one deflection, and only while guarding',
  `${r.reflect.reflWhileDown} while down, ${r.reflect.reflWhileUp} while up`);
check(r.reflect.whileUp && !r.reflect.whileDown, 'and the window closes on its own',
  `up=${r.reflect.whileUp} down=${r.reflect.whileDown}`);

// ── The deflection is a parry, and what comes back is the shot ───────────
// Assert the thing under test actually RAN. Without this the four checks below
// all read from a null bolt and half of them pass vacuously — the refused-cast
// failure mode the post-mortem names.
check(r.deflect.made === 1, 'this block\'s shot really was deflected',
  `${r.deflect.made} bolt(s) fired into deflectedBullets by this block — `
  + `0 means the staged shot never reached him and every check below is vacuous`);
// Each of the next three requires `made === 1` explicitly. Without it they read
// from a null bolt on a build that never deflected and compare null to null,
// 0 to 0 — three checks passing on the very bug they exist to catch. Measured:
// the pre-Deflection build failed 4 of these 8 and passed the other 4 vacuously.
const returned = r.deflect.made === 1;
check(returned && r.deflect.tex === r.deflect.shotTex,
  'the returned bolt wears the PLAYER bolt texture, not the green enemy one',
  `player fired '${r.deflect.shotTex}', got back '${r.deflect.tex}'`);
check(r.deflect.greenFired === 0, 'and it put nothing at all in the green enemy pool',
  `${r.deflect.greenFired} enemyBullets.fire calls during the deflection — `
  + `the old build's deflection fired its reply into exactly this pool`);
check(returned && Math.abs(r.deflect.speed - r.deflect.firedSpeed) <= 2,
  'it comes back at the speed it went out at',
  `fired ${r.deflect.firedSpeed}, returned ${r.deflect.speed} — the old one was a flat 437`);
check(returned && r.deflect.range === r.deflect.firedRange, 'and with the reach to get home',
  `fired ${r.deflect.firedRange}, returned ${r.deflect.range}`);
// Two claims, deliberately split: the deflection ASKS for a parry, and a parry
// MOVES THE BLADE. Asserting only the second would pass on a build where nothing
// requests it; asserting only the first would pass on a build where the flag is
// set and never read. Neither races the 190ms window — see the note in the block.
check(r.deflect.parryTicks > 0, 'turning a bolt puts Vader in a parry',
  `_parryT was positive on ${r.deflect.parryTicks} frames`);
check(r.deflect.heldFrames > 2 && r.deflect.heldDevDeg > 45,
  'and a parry swings his blade off its guard to the bearing it was given',
  `saber deviated ${r.deflect.heldDevDeg}deg over ${r.deflect.heldFrames} frames — `
  + `it holds the bearing it was handed while the guard bearing follows the player, `
  + `so a build that ignores the flag reads exactly 0`);
// A "the blade reaches further out" check lived here and was DELETED, not fixed.
// `reach` is a distance between two moving bodies — his AI re-writes his velocity
// in preUpdate after the hold loop pins it — so on the pre-Deflection build it
// measured 51px, then 98px, then 26px against a 50px rest, and passed on the bug
// as often as not. It claimed nothing the deviation check above does not already
// prove, so there was nothing to salvage by loosening it.

// ── Disarm ───────────────────────────────────────────────────────────────
// ── SUPPRESSION ───────────────────────────────────────────────────────────
// Every one of these is about a VERB. Not one reads a flag, and not one is
// satisfied by an item moving.
check(r.suppress.before.super === true && r.suppress.before.wings === true,
  'both Supers are available before he takes them',
  `super ${r.suppress.before.super}, wings ${r.suppress.before.wings} — a lockout test that starts locked proves nothing`);
check(r.suppress.banners.includes('SUPPRESSED'),
  'SUPPRESSED fires on a player carrying no secondary at all',
  `banners ${JSON.stringify(r.suppress.banners)} — the old mechanic returned silently here, which is the hole in the rung`);
check(r.suppress.pickupsAfter === 0, 'and it does not throw anything on the floor',
  `${r.suppress.pickupsAfter} pickups — SUPPRESSION takes the power, not the gun`);
check(r.suppress.during.primary === true && r.suppress.during.bolts === 1,
  'PRIMARY FIRE KEEPS WORKING while suppressed',
  `fire ${r.suppress.during.primary}, ${r.suppress.during.bolts} bolts — there is no baseline melee to fall back on, so taking the gun would leave nothing to do`);
check(r.suppress.during.dashSpent === 1, 'and dash keeps working',
  `spent ${r.suppress.during.dashSpent} charges`);
check(r.suppress.during.super === false, 'the ranged Super is blocked',
  `returned ${r.suppress.during.super}`);
check(r.suppress.during.wings === false, 'Broken Wings is blocked too',
  `returned ${r.suppress.during.wings} — suppressing one Super and not the other is the loophole`);
check(r.suppress.during.wingsLink2 === false,
  'and a live Broken Wings chain cannot be continued through it',
  'casts 2 and 3 skip the meter check, so a gate on `meleeReady` would let a started chain run free');
check(r.suppress.during.superKept === true && r.suppress.during.wingsKept === true,
  'a blocked attempt spends NOTHING',
  `super kept ${r.suppress.during.superKept}, melee kept ${r.suppress.during.wingsKept} — this is an activation lockout, not resource deletion`);
check(r.suppress.bypass.wings === false && r.suppress.bypass.super === false,
  'switching Super mode is not a way round it',
  JSON.stringify(r.suppress.bypass));
check(r.suppress.during.hudTinted === true
  && r.suppress.during.hudSuperTex === 'super-btn-off'
  && r.suppress.during.hudMeleeTex === 'melee-btn-off',
  'both Super controls read as unavailable on the HUD',
  `${r.suppress.during.hudSuperTex} / ${r.suppress.during.hudMeleeTex}, tinted ${r.suppress.during.hudTinted}`);
check(r.suppress.armedMs > r.suppress.dur * 0.9,
  `it lasts the configured ${r.suppress.dur}ms`, `armed at ${Math.round(r.suppress.armedMs)}ms`);
check(r.suppress.repeatMs === r.suppress.dur && r.suppress.midMs < r.suppress.dur,
  'a second activation REFRESHES rather than stacking or being ignored',
  `${Math.round(r.suppress.midMs)} -> ${r.suppress.repeatMs}, full duration is ${r.suppress.dur}`);
check(r.suppress.after.super === true && r.suppress.after.wings === true,
  'both Supers come back when it expires', JSON.stringify(r.suppress.after));
check(r.suppress.after.hudSuperTex === 'super-btn' && !r.suppress.after.hudTinted,
  'and the HUD controls relight', `${r.suppress.after.hudSuperTex}, tinted ${r.suppress.after.hudTinted}`);
check(r.suppress.withRifle.held === 'rifle' && r.suppress.withRifle.ammo === 7
  && r.suppress.withRifle.dropped === 0,
  'a secondary in hand is neither required nor taken',
  `held ${r.suppress.withRifle.held} with ${r.suppress.withRifle.ammo} ammo, ${r.suppress.withRifle.dropped} dropped`);
check(r.suppress.withRifle.suppressed === true,
  'and the mechanic behaves identically whatever is equipped');
check(r.suppress.cleared === false, 'a death clears the lock',
  'a suppression that outlives the life that earned it locks a player who has already been punished');

// ── LIGHTS OUT ────────────────────────────────────────────────────────────
check(r.blackout.during > r.blackout.before, 'lights out raises the blackout overlay',
  `alpha ${r.blackout.before} -> ${r.blackout.during}`);
check(r.blackout.firstStep > 0.8,
  'and it gets there FAST — the room loses power, it does not dim',
  `the first frame with any darkening is already at ${r.blackout.firstStep} (tape ${JSON.stringify(r.blackout.tape)}) — an ease would still be climbing`);
check(r.blackout.after <= r.blackout.before + 0.01, 'and the lights come back',
  `alpha still ${r.blackout.after} — a blackout that outlives the fight darkens the next sector`);
// THE CHECK THE OLD SUITE DID NOT HAVE. Alpha reaching 1 says nothing about
// whether anything got darker: the ambient gradient at alpha 1 darkens the
// centre of the screen by 0%, and that shipped.
check(r.blackout.profile.r0 === 0 && r.blackout.profile.r80 < 0.02,
  'the player keeps a readable pocket',
  `alpha ${r.blackout.profile.r0} at the player, ${r.blackout.profile.r80} at 80px`);
check(r.blackout.profile.r150 > 0.15 && r.blackout.profile.r200 > 0.30,
  'darkening is unmistakable by 150-200px',
  `${r.blackout.profile.r150} at 150px, ${r.blackout.profile.r200} at 200px — the gradient this replaced was 0.004 and 0.047 here`);
check(r.blackout.profile.r300 > 0.60 && r.blackout.profile.r420 > 0.80,
  'and the midfield is materially dark',
  `${r.blackout.profile.r300} at 300px, ${r.blackout.profile.r420} at 420px`);
// THE POCKET TRACKS THE PLAYER, WITHIN A CAP. Not "is exactly on them": the
// drift is clamped to `pad` so the sight radius can never slide off the screen
// it exists to light, and near an arena wall the game camera stops while the
// player keeps walking. What has to hold is that the player stays inside the
// readable part of their own pocket — the gradient is still under 0.05 at the
// clamp distance — and that the pocket is not pinned to the middle of the
// display, which is the bug this replaced.
{
  const d = Math.hypot(r.blackout.pocket.x - r.blackout.playerScreen.x,
                       r.blackout.pocket.y - r.blackout.playerScreen.y);
  const offCentre = Math.hypot(r.blackout.playerScreen.x - 360,
                               r.blackout.playerScreen.y - 640);
  check(d <= 200, 'the player stays inside their own pocket',
    `${Math.round(d)}px from the pocket centre, where the gradient is still near zero`);
  check(offCentre < 60 || d < offCentre - 20,
    'and the pocket is on the PLAYER, not pinned to the middle of the display',
    `player is ${Math.round(offCentre)}px off screen centre and ${Math.round(d)}px off the pocket — a screen-locked overlay would score those the same`);
}
check(r.blackout.ambientUntouched.inner === 158
  && r.blackout.ambientUntouched.outer === 910
  && r.blackout.ambientUntouched.fadeInMs === 420,
  'the persistent DARKNESS room modifier is untouched',
  `${JSON.stringify(r.blackout.ambientUntouched)} — the boss event got its own gradient rather than retuning a shared one`);

// ── Afterimages ──────────────────────────────────────────────────────────
check(r.afterimages.spawned === 3, 'afterimages spawn', `${r.afterimages.spawned} of 3`);
check(r.afterimages.wearingHisSprite === r.afterimages.spawned,
  'wearing HIS silhouette, not a tinted grunt',
  `${r.afterimages.wearingHisSprite} of ${r.afterimages.spawned} — a grunt-shaped copy answers "which one is he?" before the question lands`);
check(r.afterimages.cloneSurvivors === 0, 'and dying to a single hit',
  `${r.afterimages.cloneSurvivors} survived`);
check(r.afterimages.bossStillAlive && r.afterimages.bossHpFrac > 0.5,
  'while the real one shrugs off the same hit — that is how you tell them apart',
  `boss at ${(r.afterimages.bossHpFrac * 100).toFixed(0)}%`);

// ── Wound / return ───────────────────────────────────────────────────────
check(r.wound.seen.every((s) => s.downed), 'each encounter can be driven down',
  r.wound.seen.map((s) => `enc${s.n} ${s.hpMax}hp ${s.downed ? 'down' : 'STILL UP'}`).join(', '));
check(r.wound.deathEvents === 0, 'Vader is never KILLED in endless — he withdraws',
  `${r.wound.deathEvents} boss-died events; a dead Vader ends the ladder`);
check(r.wound.woundEvents >= 3, 'each time as a wound', `${r.wound.woundEvents} over 3 encounters`);
check(r.wound.seen[2].mech > r.wound.seen[0].mech && r.wound.seen[2].hpMax > r.wound.seen[0].hpMax,
  'and he returns harder AND weirder each time',
  `${r.wound.seen[0].hpMax}hp/${r.wound.seen[0].mech} -> ${r.wound.seen[2].hpMax}hp/${r.wound.seen[2].mech}`);
check(r.wound.restored, 'the test put the room transition back', '');

check(r.punish.retreats === true, 'the punish probe is aimed at a retreating Vader',
  `_retreats ${r.punish.retreats} — without this the check below proves nothing`);
check(r.punish.died === 0 && r.punish.wounded === 1,
  'a hit that is only lethal AFTER the punish bonus still WOUNDS him, never kills',
  `${r.punish.died} died / ${r.punish.wounded} wounded — Enemy.damage multiplies by _punishMult, so the retreat intercept has to test the multiplied number`);



// ── Intake cap ───────────────────────────────────────────────────────────
check(r.cap.taken >= 3999, 'a big hit lands in FULL — there is no intake cap',
  `4000 damage registered as ${r.cap.taken}. The cap used to clip a 3000-damage super to 960, `
  + `which is what made encounter 6 take four minutes and punished super-spam hardest`);
check(!r.cap.hasCapField, 'and no per-boss cap field survives to be re-enabled by accident',
  `_dmgCap = ${r.cap.hasCapField}`);

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the ladder is mechanics, not multipliers`);
