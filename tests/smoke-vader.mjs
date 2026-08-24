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
  // WAIT ON THE CONDITION, NOT THE CLOCK. `_suppressedMs` is decremented by
  // Phaser's `delta`, which is CLAMPED — so at this harness's ~190ms frames a
  // 4500ms wall-clock sleep delivers well under 4000ms of accumulated delta and
  // the lock is still up when the probe reads it. Marginal for as long as this
  // block has existed; it started tripping when the suite got longer, which is
  // the load-sensitivity tests/README.md warns about, not a game bug.
  for (let i = 0; i < 200 && p._suppressedMs > 0; i++) await wait(60);
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

// ── LIGHTS OUT — the ARENA loses power ────────────────────────────────────
//
// The previous version of this block measured a radial gradient, because the
// previous version of the mechanic WAS a radial gradient. It was mechanically
// successful and aesthetically rejected on handset: an obvious flashlight
// bubble following the player. The transformation now lives on the arena's own
// sprites, so this measures the arena.
r.blackout = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const hud = window.game.scene.getScene('HUD');
  const cfgMod = await import('/src/config.js');
  const { DARKNESS } = cfgMod;
  const LIGHTSOUT = cfgMod.LIGHTSOUT ?? null;
  const ov = () => hud._overlays?.blackout;
  const alpha = () => ov()?.alpha ?? 0;
  // A snapshot of what the room layer looks like right now, by material class.
  const layer = () => gs.roomLayer.getChildren().map((o) => ({
    cls: o._loClass ?? null,
    tint: o.isTinted ? o.tintTopLeft : null,
    // Perceived multiplier of this tint, 1 = untouched.
    lum: o.isTinted
      ? (0.2126 * ((o.tintTopLeft >> 16) & 255) + 0.7152 * ((o.tintTopLeft >> 8) & 255)
         + 0.0722 * (o.tintTopLeft & 255)) / 255
      : 1,
  }));
  // COMBAT PRESENTATION IS EXEMPT BY CONSTRUCTION, and this is the check that
  // says so: nothing the player has to read in a fight may be in the group the
  // darkness tints. An exemption list can drift; a layer cannot.
  const inLayer = (o) => !!o && gs.roomLayer.getChildren().includes(o);

  gs._clearLightsOut?.();
  gs.events.emit('set-darkness', false);
  gs.events.emit('set-darkness', false, 'blackout');
  await new Promise((res) => setTimeout(res, 500));
  const before = { alpha: alpha(), layer: layer(), sectorTint: gs._sectorTint?.fillAlpha ?? null };

  // SAMPLED FROM A postupdate HOOK, NOT A POLL, and asserted in FRAMES rather
  // than milliseconds: this harness renders one frame every ~190ms under load,
  // longer than the whole 140ms onset, so no wall-clock threshold can tell a
  // power cut from a soft ease. What survives any frame rate is whether the
  // FIRST frame showing any change is already most of the way there.
  const tape = [];
  const t0 = performance.now();
  const sample = () => tape.push([Math.round(performance.now() - t0),
                                  +(gs._darkMix?.v ?? 0).toFixed(3), alpha()]);
  hud.events.on('postupdate', sample);
  gs.events.emit('boss-blackout', gs.boss, 1400);
  sample();
  await new Promise((res) => setTimeout(res, 400));
  hud.events.off('postupdate', sample);
  const firstMoved = tape.find(([, v]) => v > 0.01);
  const firstStep = firstMoved ? firstMoved[1] : -1;

  await new Promise((res) => setTimeout(res, 400));
  const during = {
    alpha: alpha(), layer: layer(), mix: gs._darkMix?.v ?? 0,
    sectorTint: gs._sectorTint?.fillAlpha ?? null,
    // Every one of these is a thing the player must read while the lights are
    // out, and none of them may be in the tinted layer.
    combatExempt: {
      saber:     inLayer(gs.boss?.weaponSprite),
      boss:      inLayer(gs.boss),
      player:    inLayer(gs.player),
      bullets:   gs.playerBullets.getChildren().some(inLayer),
      telegraph: (gs.telegraphs ?? []).some((t) => inLayer(t.gfx ?? t)),
    },
  };
  await new Promise((res) => setTimeout(res, 3200));
  const after = { alpha: alpha(), layer: layer(), sectorTint: gs._sectorTint?.fillAlpha ?? null };

  return {
    before, during, after, tape, firstStep,
    cfg: LIGHTSOUT,
    // THE VIGNETTE IS SECONDARY NOW, and this is where that is enforced. It
    // must be flat nothing across the whole area the fight happens in, and it
    // must never reach the wall of black the rejected version put at 300px.
    // SAMPLED ALONG THE DIAGONAL: the overlay is exactly VIEW-sized, so a
    // horizontal walk runs out of canvas at 360px and every radius past it
    // silently reads 0 — indistinguishable from a gradient never painted.
    vignette: (() => {
      hud._ensureOverlay('blackout');
      const tex = window.game.textures.get('darkness-blackout');
      if (!tex.getContext) return null;
      const img = tex.getSourceImage(), ctx = tex.getContext();
      const cx = img.width / 2, cy = img.height / 2, k = 1 / Math.hypot(img.width, img.height);
      const a = (r) => {
        const x = Math.round(cx + r * img.width * k), y = Math.round(cy + r * img.height * k);
        if (x < 0 || y < 0 || x >= img.width || y >= img.height) return null;
        return +(ctx.getImageData(x, y, 1, 1).data[3] / 255).toFixed(3);
      };
      return { size: [img.width, img.height], inner: DARKNESS.blackout.inner,
               r0: a(0), r150: a(150), r250: a(250), r300: a(300),
               r450: a(450), r640: a(640), corner: a(Math.round(Math.hypot(cx, cy))),
               tracked: typeof hud._trackBlackout === 'function',
               padded: img.width !== 720 || img.height !== 1280 };
    })(),
    ambientUntouched: {
      inner: DARKNESS.ambient.inner, outer: DARKNESS.ambient.outer,
      stops: JSON.stringify(DARKNESS.ambient.stops),
      fadeInMs: DARKNESS.ambient.fadeInMs,
    },
  };
});

await keepAlive();

// ── LIGHTS OUT — ONE GLOBAL STATE, ONE OWNER ──────────────────────────────
//
// Two producers, one arena. Before the owner existed both emitted
// `boss-blackout` and both were obeyed unconditionally, so at encounter 6 the
// room lost power roughly every six seconds and a dramatic transformation read
// as a screen filter.
r.lights = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ENDLESS } = await import('/src/config.js');
  const st = () => ({ state: gs._lightsState, pending: gs._lightsPending });
  const out = { reentryMs: ENDLESS.bossMech.lightsReentryMs };

  // A build with no owner has no verbs to call. Every one of them is optional
  // here so the block reports 'missing' rather than throwing: a crashed probe
  // is indistinguishable from a failed contract, and this block exists to be
  // run against the build it replaces.
  const req = (src) => gs.requestLightsOut ? gs.requestLightsOut(src) : 'missing';
  gs._clearLightsOut?.();
  gs.boss._eclipse = false;
  out.cleared = st();

  out.v1 = req('blackout');                            // accepted
  out.afterV1 = st();
  // ONE EVENT, ONE BOUNDED LIFETIME. Pressure may not hold the room dark.
  const rem0 = gs._lightsEndEv?.getRemaining?.() ?? -1;
  out.v2 = req('blackout');            // deferred
  out.v3 = req('blackout');            // coalesced — never two
  const rem1 = gs._lightsEndEv?.getRemaining?.() ?? -1;
  out.extended = rem1 > rem0;                          // must be false
  out.afterRepeat = st();

  // ECLIPSE outranks a queued standalone BLACKOUT; BLACKOUT can never displace
  // a queued ECLIPSE, so it cannot starve it.
  out.v4 = req('eclipse');
  out.afterEclipse = st();
  out.v5 = req('blackout');
  out.blackoutCannotStarve = st();

  // Cooldown is measured from the END of darkness, not from its start.
  gs._endLightsOut?.();
  out.afterEnd = st();
  out.cooldownDelay = gs._lightsCdEv?.delay ?? -1;
  out.tintsRestored = gs.roomLayer.getChildren().every((o) => !o.isTinted);
  out.v6 = req('blackout');            // still cooling down
  out.duringCooldown = st();

  // ── THE PRODUCER GRAPH. Both go through the owner and nothing else.
  gs._clearLightsOut?.();
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.boss._eclipse = false;
  gs.events.emit('boss-blackout', gs.boss, 1400);
  out.blackoutProducer = { src: gs._lightsLog?.at(-1)?.source ?? null, ...st() };

  // ECLIPSE, deferred: its clones must NOT arrive without its darkness. On the
  // build this replaces, `boss-afterimages` spawned three clones into a lit
  // room and asked for a darkness the fight was already having.
  gs.boss._eclipse = true;
  gs.events.emit('boss-afterimages', gs.boss, 3);
  await new Promise((res) => setTimeout(res, 250));
  out.eclipseDeferred = {
    pending: gs._lightsPending,
    clones: gs.enemies.getChildren().filter((e) => e.alive && e._afterimage).length,
  };
  // …and arrive WITH it when the arena is eligible.
  gs._endLightsOut?.();
  gs._lightsCdEv?.remove?.(); gs._lightsCdEv = null;
  gs._lightsState = 'off';
  const p = gs._lightsPending; gs._lightsPending = null;
  gs._beginLightsOut?.(p);
  await new Promise((res) => setTimeout(res, 350));
  out.eclipseComposition = {
    state: gs._lightsState,
    clones: gs.enemies.getChildren().filter((e) => e.alive && e._afterimage).length,
  };

  // Below encounter 6 nothing about AFTERIMAGES changed: no eclipse flag, no
  // darkness, clones on their own clock.
  gs._clearLightsOut?.();
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  gs.boss._eclipse = false;
  gs.events.emit('boss-afterimages', gs.boss, 3);
  await new Promise((res) => setTimeout(res, 250));
  out.plainAfterimages = {
    clones: gs.enemies.getChildren().filter((e) => e.alive && e._afterimage).length,
    state: gs._lightsState,
  };

  // Lifecycle: nothing may survive to darken a later arena.
  req('blackout');
  req('eclipse');       // arm both an active state and a pending one
  gs._clearLightsOut?.();
  out.lifecycle = {
    ...st(),
    endEv: gs._lightsEndEv, cdEv: gs._lightsCdEv,
    tinted: gs.roomLayer.getChildren().filter((o) => o.isTinted).length,
    sectorTint: gs._sectorTint?.fillAlpha ?? null,
  };
  return out;
});

await keepAlive();

// ── FORCE PULL + DEFLECTION — an APPROVED combination ────────────────────
//
// Handset-verified on Vader 6 and now part of the high-tier combat language:
// DEFLECTION punishes careless ranged aggression, FORCE PULL compromises
// repositioning, and lateral dash is the answer. The player's death inside it
// was judged fair. Nothing may quietly start excluding them.
//
// Deliberately NOT a choreography test. Waiting for the natural combination to
// occur is a timing race that would flake and then get "fixed" by loosening
// it. What is asserted is OWNERSHIP: this pass added an arena state, and the
// regression it could plausibly cause is that state gating his moves.
r.combo = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  const snap = () => ({
    cooldown: b.cooldown, moveT: b._moveT,
    reflectEvery: b._reflectEvery ?? null, reflectUntil: b._reflectUntil ?? 0,
    sunderEvery: b._sunderEvery ?? null, disarmEvery: b._disarmEvery ?? null,
    performing: !!b._performing, state: b.state,
  });
  gs._clearLightsOut?.();
  await new Promise((res) => setTimeout(res, 300));

  // FREEZE HIS CLOCKS FOR THE COMPARISON ONLY, and say so: this measures
  // whether the LIGHTS OUT owner WRITES to his scheduler, and a free-running
  // reflect clock would move `_reflectUntil` on its own and drown the signal.
  // The claim under test is a write that does not happen.
  const FAR = 1e9;
  b._reflectT = FAR; b._sunderT = FAR; b._blackoutT = FAR;
  b._afterimageT = FAR; b._disarmT = FAR;
  b.cooldown = 4321; b._moveT = 8765;
  const before = snap();

  gs.requestLightsOut?.('blackout');
  const during = snap();
  gs._endLightsOut?.();
  const cooling = snap();
  gs._clearLightsOut?.();
  const after = snap();

  return {
    before, during, cooling, after,
    // The frozen DEFLECTION cadence, read where it lives.
    reflectEvery: b._reflectEvery ?? null,
    reflectExists: typeof b.canOpenGuard === 'function',
    // And the registry itself: no move in the pool may have acquired a
    // condition naming another mechanic.
    moveGates: await (async () => {
      const { BOSS_MOVES } = await import('/src/data/bossMoves.js');
      const src = BOSS_MOVES.map((m) => JSON.stringify(Object.keys(m))).join(' ');
      return { count: BOSS_MOVES.length, hasExclusion: /exclude|notWith|blockedBy/i.test(src) };
    })(),
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


// The punish probe above leaves the arena without a Vader in it. Stage a fresh
// one: a probe that opens on `gs.boss` being null throws, and a thrown probe is
// indistinguishable from a failed contract.
await enterBossRoom(6);
await keepAlive();

// ══ THE SABER AS A LIGHT SOURCE, AND ONLY IN THE DARK ═══════════════════════
//
// Structural claims only. Whether it looks cinematic is a handset verdict and
// no assertion here pretends otherwise. What IS checkable: it exists only
// during LIGHTS OUT, it is derived from the pose the one writer produced rather
// than computed a second time, it adds nothing collidable, it travels with the
// real blade when SABER THROW takes it away, and it leaves no owner behind.
r.saber = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss;
  const { LIGHTSOUT } = await import('/src/config.js');
  const out = { cfg: LIGHTSOUT.saber ?? null, drawer: typeof b._drawSaberGlow };
  const layers = () => [b._saberHalo, b._saberBloom];
  const snap = () => {
    const w = b.weaponSprite, [h, g] = layers();
    return { mix: gs._darkMix?.v ?? 0,
      halo: h ? { x: h.x, y: h.y, rot: h.rotation, vis: h.visible, blend: h.blendMode } : null,
      bloom: g ? { x: g.x, y: g.y, rot: g.rotation, vis: g.visible, blend: g.blendMode } : null,
      w: { x: w.x, y: w.y, rot: w.rotation, depth: w.depth } };
  };
  // Sampled on postupdate so the blade and its light are read from ONE frame.
  // Two `evaluate` round trips compare poses 200-400ms apart, and on a walking
  // boss they can never agree — which reads as a glow that does not follow.
  const frame = () => new Promise((res) => {
    const t = () => { gs.events.off('postupdate', t); res(snap()); };
    gs.events.on('postupdate', t);
  });

  gs._clearLightsOut?.();
  await new Promise((r) => setTimeout(r, 260));
  out.lit = await frame();

  gs._enterDarkArena?.();
  gs._darkChain?.stop?.(); if (gs._darkMix) gs._darkMix.v = 1; gs._applyDarkMix?.();
  await new Promise((r) => setTimeout(r, 260));
  out.dark = await frame();
  // Again a beat later: the pose must still be the blade's, not one it was
  // parked at when the darkness started.
  await new Promise((r) => setTimeout(r, 320));
  out.dark2 = await frame();

  // NOTHING THIS PASS ADDED CAN BE COLLIDED WITH.
  out.bodies = { boss: b.body?.radius ?? null,
                 weapon: !!b.weaponSprite.body,
                 halo: !!b._saberHalo?.body, bloom: !!b._saberBloom?.body };
  // ONE SABER, ONE OWNER. The light is anchored to the sprite, so a blade
  // 500px away takes its glow with it and leaves no phantom at his hand.
  out.throw = await new Promise((res) => {
    let n = 0;
    const t = () => {
      const w = b.weaponSprite;
      const d = Math.hypot(w.x - b.x, w.y - b.y);
      if (b._saberAway && d > 200) {
        gs.events.off('postupdate', t);
        const [h, g] = layers();
        return res({ fired: true, hasSaber: b.hasSaber(), dist: +d.toFixed(1),
          haloOnBlade: !!h && h.x === w.x && h.y === w.y && h.rotation === w.rotation,
          bloomOnBlade: !!g && g.x === w.x && g.y === w.y && g.rotation === w.rotation,
          // there is exactly one glowing blade in the room
          layers: layers().filter(Boolean).length });
      }
      if (++n % 12 === 0) {
        b._activeMove = null; b._performing = null; b.state = 'idle'; b.cooldown = 0;
        b._reflectUntil = 0; b._reflectClaimed = false;
        gs._castBossMove?.(b, 'saberthrow');
      }
      if (n > 420) { gs.events.off('postupdate', t); res({ fired: false, n }); }
    };
    gs.events.on('postupdate', t);
  });

  // Restoration drops it, and a teardown removes the listener rather than
  // leaving a postupdate handler closed over a dead boss in the next room.
  gs._clearLightsOut?.();
  await new Promise((r) => setTimeout(r, 400));
  out.restored = await frame();
  out.hookBefore = typeof b._glowDraw;
  const before = gs.events.listenerCount('postupdate');
  b.destroy();
  out.hookAfter = typeof b._glowDraw;
  out.listenersFreed = gs.events.listenerCount('postupdate') < before;
  gs.boss = null;
  return out;
});

// ══ FROZEN: everything this pass was told not to touch ══════════════════════
r.frozen = await page.evaluate(async () => {
  const { ENDLESS, LIGHTSOUT, DARKNESS, PLAYER, BOSS } = await import('/src/config.js');
  const M = ENDLESS.bossMech;
  return {
    lightsReentryMs: M.lightsReentryMs, blackoutMs: M.blackoutMs,
    lo: { floor: LIGHTSOUT.floor, wall: LIGHTSOUT.wall, prop: LIGHTSOUT.prop,
          console: LIGHTSOUT.console, sectorTintAlpha: LIGHTSOUT.sectorTintAlpha,
          onsetMs: LIGHTSOUT.onsetMs, restoreMs: LIGHTSOUT.restoreMs },
    vignette: { inner: DARKNESS.blackout.inner, outer: DARKNESS.blackout.outer,
                stops: JSON.stringify(DARKNESS.blackout.stops) },
    suppressMs: PLAYER.suppressMs, superSpeed: PLAYER.superSpeed,
    reflectMs: M.reflectMs, reflectEveryMs: M.reflectEveryMs, parryMs: M.parryMs,
    superReleaseMs: M.superReleaseMs, superSweepMs: M.superSweepMs,
    superReturnDamageMax: M.superReturnDamageMax,
    afterimageEveryMs: M.afterimageEveryMs, afterimageCount: M.afterimageCount,
    bossRadius: BOSS.radius, bossHp: BOSS.hp,
  };
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

// ── LIGHTS OUT — the arena, not a bubble ─────────────────────────────────
{
  const byCls = (snap, cls) => snap.filter((o) => o.cls === cls);
  // INFINITY, NOT -1, WHEN A CLASS IS EMPTY. A build with no material tags
  // has no 'floor' objects at all, and a sentinel below the threshold makes
  // every darkening check pass vacuously on the build they exist to fail —
  // which is exactly what happened on the first A/B against 577761e.
  const meanLum = (snap, cls) => {
    const g = byCls(snap, cls);
    return g.length ? g.reduce((a, o) => a + o.lum, 0) / g.length : Infinity;
  };
  check(r.blackout.before.layer.every((o) => o.tint === null),
    'the arena carries no darkness tint with the lights on',
    `${r.blackout.before.layer.filter((o) => o.tint !== null).length} objects already tinted`);
  // EVERY ROOM OBJECT IS CLASSIFIED. An untagged one falls to the generic prop
  // strength silently, which is how a new prop would quietly stop matching the
  // art direction with nothing failing.
  check(r.blackout.before.layer.length > 0
     && r.blackout.before.layer.every((o) => o.cls !== null),
    'every arena object declares which material it darkens as',
    `${r.blackout.before.layer.filter((o) => o.cls === null).length} of ${r.blackout.before.layer.length} untagged`);
  check(meanLum(r.blackout.during.layer, 'floor') < 0.20,
    'LIGHTS OUT darkens the ARENA ITSELF — the floor loses its ambient light',
    `floor at ${meanLum(r.blackout.during.layer, 'floor').toFixed(3)} of its lit value; ` +
    'the version this replaced left every arena sprite untouched and painted a bubble over them');
  // WALL STRENGTH COMES FROM THE REGISTRY, NOT THE ROOM. The Vader chamber has
  // `walls: []` — its structure is the baked perimeter band and its props — so
  // a measured wall assertion here would be asserting an empty set. Props are
  // measured because there IS one; walls are pinned where the value lives.
  const lumOf = (t) => t == null ? Infinity
    : (0.2126 * ((t >> 16) & 255) + 0.7152 * ((t >> 8) & 255) + 0.0722 * (t & 255)) / 255;
  check(lumOf(r.blackout.cfg?.wall) < 0.25
     && meanLum(r.blackout.during.layer, 'prop') < 0.40,
    'structure falls to silhouette without being erased',
    `wall strength ${lumOf(r.blackout.cfg?.wall).toFixed(3)}, prop measured ${meanLum(r.blackout.during.layer, 'prop').toFixed(3)}`);
  // THE ISLANDS OF REMAINING POWER. This is the check that separates an art
  // direction from a black rectangle: a uniform darkening would score the
  // console and the floor the same, and the emissive hierarchy the whole mode
  // depends on would be gone with no assertion noticing.
  check(meanLum(r.blackout.during.layer, 'console') > meanLum(r.blackout.during.layer, 'floor') * 2.5,
    'terminals stay powered while the room around them does not',
    `console ${meanLum(r.blackout.during.layer, 'console').toFixed(3)} vs floor ${meanLum(r.blackout.during.layer, 'floor').toFixed(3)}`);
  check(r.blackout.during.sectorTint !== null
     && r.blackout.during.sectorTint < (r.blackout.before.sectorTint ?? 1) * 0.5,
    'the endless ambient colour wash goes out with the room',
    `${r.blackout.before.sectorTint} -> ${r.blackout.during.sectorTint}; it is ADDITIVE and sits above every room ` +
    'object, so a dark arena that leaves it running is a dark arena with the lights still on');
  // RESTORATION MUST BE EXACT. Not "roughly back": a mode that leaks a tint
  // makes every subsequent activation weaker than the last.
  check(r.blackout.after.layer.every((o) => o.tint === null),
    'and the arena comes back exactly as it was',
    `${r.blackout.after.layer.filter((o) => o.tint !== null).length} objects still tinted — a leaked tint compounds across activations`);
  check(Math.abs((r.blackout.after.sectorTint ?? 0) - (r.blackout.before.sectorTint ?? 0)) < 0.001,
    'including the sector wash',
    `${r.blackout.before.sectorTint} -> ${r.blackout.after.sectorTint}`);
}
check(Object.values(r.blackout.during.combatExempt).every((v) => v === false),
  'combat presentation is exempt BY CONSTRUCTION, not by a list',
  `${JSON.stringify(r.blackout.during.combatExempt)} — anything true here is a saber, a bolt or a telegraph inside the tinted layer`);
check(r.blackout.firstStep > 0.6,
  'the power CUTS — it does not dim',
  `the first frame with any change is already at ${r.blackout.firstStep} (tape ${JSON.stringify(r.blackout.tape)}); an ease would still be climbing`);
check(r.blackout.during.alpha > r.blackout.before.alpha
   && r.blackout.after.alpha <= r.blackout.before.alpha + 0.01,
  'and the secondary vignette rides with it, then leaves',
  `alpha ${r.blackout.before.alpha} -> ${r.blackout.during.alpha} -> ${r.blackout.after.alpha}`);

// THE VIGNETTE IS SEASONING. These are the checks that stop it creeping back
// into being the mechanic: the rejected build scored 0.204 at 150px, 0.537 at
// 250px and 0.659 at 300px, so each of these fails against it.
check(r.blackout.vignette.r0 === 0 && r.blackout.vignette.r150 === 0
   && r.blackout.vignette.r250 === 0,
  'no circular geometry anywhere the fight happens',
  `${r.blackout.vignette.r0} / ${r.blackout.vignette.r150} / ${r.blackout.vignette.r250} at 0/150/250px — ` +
  'the version this replaced was already at 0.54 by 250px, which is what read as a flashlight radius');
check(r.blackout.vignette.inner >= 280 && r.blackout.vignette.r450 < 0.15,
  'and the falloff is broad and soft rather than a wall',
  `clear to ${r.blackout.vignette.inner}px, ${r.blackout.vignette.r450} at 450px`);
check(r.blackout.vignette.corner < 0.55,
  'the vignette never gets to own the frame',
  `${r.blackout.vignette.corner} at the corner — past ~0.6 the player perceives a mask again`);
check(!r.blackout.vignette.tracked && !r.blackout.vignette.padded,
  'the overlay is screen-locked and exactly VIEW-sized',
  `tracked ${r.blackout.vignette.tracked}, padded ${r.blackout.vignette.padded} — ` +
  'a broad vignette has nothing to track, and a stationary overlay cannot expose an undarkened strip');
check(r.blackout.ambientUntouched.inner === 158
  && r.blackout.ambientUntouched.outer === 910
  && r.blackout.ambientUntouched.fadeInMs === 420,
  'the persistent DARKNESS room modifier is untouched',
  `${JSON.stringify(r.blackout.ambientUntouched)}`);

// ── LIGHTS OUT — one global state ────────────────────────────────────────
check(r.lights.v1 === 'accepted' && r.lights.afterV1.state === 'active',
  'a request against an idle arena is accepted',
  `${r.lights.v1} / ${r.lights.afterV1.state}`);
check(r.lights.v2 === 'deferred' && r.lights.v3 === 'coalesced'
   && r.lights.afterRepeat.pending === 'blackout',
  'a request during darkness is deferred, and a second one coalesces — ONE pending maximum',
  `${r.lights.v2} / ${r.lights.v3} / pending ${r.lights.afterRepeat.pending}`);
check(r.lights.extended === false,
  'and nothing extends an active darkness',
  'a repeated request restarted the fade and armed a second turn-off on the build this replaces, ' +
  'so pressure could hold the room dark and then cut a later event short');
check(r.lights.v4 === 'coalesced' && r.lights.afterEclipse.pending === 'eclipse',
  'ECLIPSE displaces a pending standalone BLACKOUT',
  `pending ${r.lights.afterEclipse.pending}`);
check(r.lights.blackoutCannotStarve.pending === 'eclipse',
  'and a standalone BLACKOUT can never displace a pending ECLIPSE',
  `pending ${r.lights.blackoutCannotStarve.pending} — the high-tier authored composition owns the slot`);
check(r.lights.afterEnd.state === 'cooldown' && r.lights.cooldownDelay === r.lights.reentryMs,
  'the re-entry interval is measured from the END of darkness',
  `${r.lights.cooldownDelay}ms armed at the moment the lights came back, target ${r.lights.reentryMs}`);
check(r.lights.tintsRestored === true,
  'and the arena is already back when the cooldown starts');
check(r.lights.v6 === 'coalesced' && r.lights.duringCooldown.state === 'cooldown',
  'no activation before the minimum re-entry interval',
  `${r.lights.v6} / ${r.lights.duringCooldown.state} — this is the check that stops the 4-5 second reactivation the handset called spam`);
check(r.lights.blackoutProducer.src === 'blackout'
   && r.lights.blackoutProducer.state === 'active',
  'the standalone BLACKOUT mechanic goes through the owner',
  JSON.stringify(r.lights.blackoutProducer));
check(r.lights.eclipseDeferred.pending === 'eclipse'
   && r.lights.eclipseDeferred.clones === 0,
  'ECLIPSE does not fire its clones into a lit room',
  `pending ${r.lights.eclipseDeferred.pending}, ${r.lights.eclipseDeferred.clones} clones — ` +
  'the identity of the mechanic is darkness AND afterimages; half of it is just AFTERIMAGES wearing the wrong banner');
check(r.lights.eclipseComposition.state === 'active'
   && r.lights.eclipseComposition.clones === 3,
  'and the composition arrives whole when the arena is eligible',
  `${r.lights.eclipseComposition.clones} clones with the darkness`);
check(r.lights.plainAfterimages.clones === 3 && r.lights.plainAfterimages.state === 'off',
  'below encounter 6 AFTERIMAGES is exactly what it was — clones, no darkness',
  `${r.lights.plainAfterimages.clones} clones, arena ${r.lights.plainAfterimages.state}`);
check(r.lights.lifecycle.state === 'off' && r.lights.lifecycle.pending === null
   && !r.lights.lifecycle.endEv && !r.lights.lifecycle.cdEv
   && r.lights.lifecycle.tinted === 0,
  'a teardown clears state, pending, both timers and every tint',
  `${JSON.stringify({ ...r.lights.lifecycle, endEv: !!r.lights.lifecycle.endEv, cdEv: !!r.lights.lifecycle.cdEv })} — ` +
  'a stale callback would start darkness in a later arena, and a leaked tint would leave it permanently dark');

// ── FORCE PULL + DEFLECTION — an APPROVED combination ────────────────────
//
// Handset-verified on Vader 6 and now part of the high-tier combat language:
// DEFLECTION punishes careless ranged aggression, FORCE PULL compromises
// repositioning, and lateral dash is the answer. The player's death inside it
// was judged fair.
//
// DELIBERATELY NOT A CHOREOGRAPHY TEST. Waiting for the natural combination,
// or even casting FORCE PULL and checking it took, is a race: `_castBossMove`
// legitimately refuses while his own state machine is mid-attack and while
// DEFLECTION's stance is up, and a refused cast reads exactly like a gated one.
// A first draft of this check flipped between pass and fail on consecutive
// runs for precisely that reason. What is asserted instead is deterministic
// and is the regression this pass could actually cause: the arena state must
// not WRITE to his scheduler at all.
{
  const same = (a, c) => a.cooldown === c.cooldown && a.moveT === c.moveT
    && a.reflectEvery === c.reflectEvery && a.reflectUntil === c.reflectUntil
    && a.sunderEvery === c.sunderEvery && a.disarmEvery === c.disarmEvery
    && a.performing === c.performing && a.state === c.state;
  check(same(r.combo.before, r.combo.during)
     && same(r.combo.before, r.combo.cooling)
     && same(r.combo.before, r.combo.after),
    'LIGHTS OUT writes nothing to his attack scheduler',
    `before ${JSON.stringify(r.combo.before)} / during ${JSON.stringify(r.combo.during)} — ` +
    'the arena state is presentation; a mechanic that suppressed his moves would show here');
}
check(r.combo.reflectExists === true && r.combo.reflectEvery === 9000,
  'DEFLECTION keeps its own frozen cadence, unconditional on any of it',
  `${r.combo.reflectEvery}ms`);
check(r.combo.moveGates.count > 0 && r.combo.moveGates.hasExclusion === false,
  'and no move carries an exclusion rule against another mechanic',
  `${r.combo.moveGates.count} moves — FORCE PULL + DEFLECTION is an APPROVED handset-verified ` +
  'combination; do not add scheduler separation or soften either because they overlap');

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


check(!!r.saber.cfg && r.saber.drawer === 'function',
  'the LIGHTS OUT saber treatment exists and is config-driven',
  `drawer ${r.saber.drawer}, cfg ${r.saber.cfg ? 'present' : 'MISSING'}`);
check(r.saber.lit.mix === 0 && !r.saber.lit.halo?.vis && !r.saber.lit.bloom?.vis,
  'in normal light the approved saber is untouched — no glow layer is drawn',
  `mix ${r.saber.lit.mix}, halo ${r.saber.lit.halo?.vis}, bloom ${r.saber.lit.bloom?.vis}`);
check(!!r.saber.dark.halo?.vis && !!r.saber.dark.bloom?.vis,
  'and in the dark arena BOTH emissive layers come up',
  `halo ${r.saber.dark.halo?.vis}, bloom ${r.saber.dark.bloom?.vis}`);
check(r.saber.dark.halo?.blend === 1 && r.saber.dark.bloom?.blend === 1,
  'both are ADDITIVE — light added to darkness, not paint laid over it',
  `blend modes ${r.saber.dark.halo?.blend}/${r.saber.dark.bloom?.blend} (1 = ADD)`);
for (const [when, snap] of [['on the frame it appears', r.saber.dark],
                            ['and still a beat later', r.saber.dark2]]) {
  check(!!snap.halo && snap.halo.x === snap.w.x && snap.halo.y === snap.w.y
        && snap.halo.rot === snap.w.rot,
    `the glow IS the blade's pose ${when} — position and rotation, same frame`,
    `blade (${snap.w.x?.toFixed?.(1)}, ${snap.w.y?.toFixed?.(1)}) @${snap.w.rot?.toFixed?.(3)} vs `
    + `halo (${snap.halo?.x?.toFixed?.(1)}, ${snap.halo?.y?.toFixed?.(1)}) @${snap.halo?.rot?.toFixed?.(3)}`);
}
check(r.saber.dark.bloom.x === r.saber.dark.w.x && r.saber.dark.bloom.rot === r.saber.dark.w.rot,
  'and so is the tight bloom — one pose, three layers, no second author',
  `bloom @${r.saber.dark.bloom.rot} vs blade @${r.saber.dark.w.rot}`);
check(r.saber.bodies.boss === 56 && !r.saber.bodies.weapon
      && !r.saber.bodies.halo && !r.saber.bodies.bloom,
  'the glow is VISUAL — nothing it added can be collided with',
  JSON.stringify(r.saber.bodies));
check(r.saber.throw.fired === true,
  'the SABER THROW probe actually threw the blade',
  `a refused cast reads exactly like a failed one — ${JSON.stringify(r.saber.throw)}`);
check(r.saber.throw.fired && r.saber.throw.hasSaber === false && r.saber.throw.dist > 200,
  'while it is away he is genuinely unarmed',
  `hasSaber ${r.saber.throw.hasSaber}, blade ${r.saber.throw.dist}px from his hand`);
check(r.saber.throw.haloOnBlade === true && r.saber.throw.bloomOnBlade === true
      && r.saber.throw.layers === 2,
  'and the light goes WITH the blade — no phantom glowing saber at his hand',
  `${r.saber.throw.layers} layers, both on the thrown sprite`);
check(r.saber.restored.mix === 0 && !r.saber.restored.halo?.vis && !r.saber.restored.bloom?.vis,
  'restoration takes the LIGHTS OUT-only treatment away with the darkness',
  `mix ${r.saber.restored.mix}, halo ${r.saber.restored.halo?.vis}`);
check(r.saber.hookBefore === 'function' && r.saber.hookAfter !== 'function'
      && r.saber.listenersFreed,
  'and destroying him removes the postupdate reader — no handler outlives the room',
  `hook ${r.saber.hookBefore} -> ${r.saber.hookAfter}, listeners freed ${r.saber.listenersFreed}`);

const F = r.frozen;
check(F.lightsReentryMs === 14000 && F.blackoutMs === 2600,
  'FROZEN: the approved LIGHTS OUT cadence is untouched by this pass',
  `re-entry ${F.lightsReentryMs}ms, duration ${F.blackoutMs}ms`);
check(F.lo.floor === 0x12151f && F.lo.wall === 0x1a1f2b && F.lo.prop === 0x2e3446
      && F.lo.console === 0x8892ac && F.lo.sectorTintAlpha === 0.03
      && F.lo.onsetMs === 140 && F.lo.restoreMs === 420,
  'FROZEN: the arena material values and transition timings are untouched',
  JSON.stringify(F.lo));
check(F.vignette.inner === 300 && F.vignette.outer === 820
      && F.vignette.stops === '[[0,0],[0.45,0.1],[0.75,0.28],[1,0.46]]',
  'FROZEN: the vignette geometry is untouched', JSON.stringify(F.vignette));
check(F.suppressMs === 4000 && F.superSpeed === 1080,
  'FROZEN: SUPPRESSION and the returned super are untouched',
  `suppressMs ${F.suppressMs}, super speed ${F.superSpeed}`);
check(F.reflectMs === 2400 && F.reflectEveryMs === 9000 && F.parryMs === 300
      && F.superReleaseMs === 620 && F.superSweepMs === 260 && F.superReturnDamageMax === 620,
  'FROZEN: every DEFLECTION timing and the returned super\'s damage are untouched',
  `reflect ${F.reflectMs}/${F.reflectEveryMs}, parry ${F.parryMs}, release ${F.superReleaseMs}, `
  + `sweep ${F.superSweepMs}, return dmg ${F.superReturnDamageMax}`);
check(F.afterimageEveryMs === 13000 && F.afterimageCount === 3,
  'FROZEN: Afterimages scheduling and clone count are untouched',
  `every ${F.afterimageEveryMs}ms, ${F.afterimageCount} clones`);

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the ladder is mechanics, not multipliers`);
