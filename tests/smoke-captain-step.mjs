// SHOCK CAPTAIN S1 — DURABILITY, TACTICAL STEP, REACTIVE ARMOUR. STRUCTURAL.
//
// IT ASSERTS NO BALANCE, AND THAT IS A RULE THIS PASS EARNED THE HARD WAY.
// Four human handset runs proved the bot plays materially slower and uses the
// Super far less aggressively than a person: the harness called the Captain
// comfortable while a human erased him in 4.7 seconds. So there is no TTK
// threshold here, no "survives N supers", no step-frequency opinion. HUMAN
// HANDSET COMBAT IS THE BALANCE AUTHORITY; this file only protects the things
// a human cannot see from the outside.
//
//   - the pools are exactly the authored values and the arithmetic around them
//     is UNCHANGED — no Super multiplier, no pellet reduction, no cap
//   - THE STEP NEVER READS THE PLAYER'S SUPER, proved twice: statically, by
//     grepping the actor for every identifier that could express it, and
//     dynamically, by firing one at him and watching what he does
//   - it respects arena geometry and leaves no stuck movement state
//   - absorption FX exist only while the armour does, and the break fires once
//   - the step is counted honestly by the telemetry
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok, label, detail }); };

// ── 0. THE STATIC HALF OF THE FAIRNESS PROOF ───────────────────────────────
// A runtime probe can only show that he did not step on the casts it happened
// to fire. Reading the source shows he CANNOT: if the actor never names the
// player's Super state, no code path in it can branch on one.
const src = readFileSync('src/entities/ShockCaptain.js', 'utf8');
const forbidden = ['superAiming', 'superAim', 'superCharge', 'player-fire-super',
  'playerSuperBullets', 'tryFireSuper', 'superReady', 'isSuper'];
const found = forbidden.filter((k) => {
  // Ignore prose: only a real reference counts. Strip line comments first.
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')
    && !l.trim().startsWith('*')).join('\n');
  return code.includes(k);
});
check(found.length === 0,
  'the Captain names NO player Super state anywhere in its code — it cannot branch on one',
  found.join(', '));

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function run(query, fn) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`page error (${query}): ${e}`));
  await page.goto(BASE + query);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 2468 }));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForTimeout(2200);
  const out = await fn(page);
  await page.close();
  return out;
}

// ── 1. THE POOLS, AND THE ARITHMETIC AROUND THEM ───────────────────────────
const pools = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { CHAMPION } = await import('/src/config.js');
  const d = CHAMPION.captain;
  const c = gs.spawnChampion(gs.player.x + 400, gs.player.y, 'captain');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  c.die = () => { c.hp = Math.max(c.hp, 900); };

  // Drive the real path and read the pools either side, so the ratios are
  // MEASURED rather than read back out of the config that set them.
  const before = { a: c.armour, h: c.hp };
  c.damage(100, null);
  await wait(40);
  const armourPerRaw = (before.a - c.armour) / 100;

  // Exactly strip the layer, then over-commit, and measure the spill.
  c.armour = 200;
  const hp0 = c.hp;
  c.damage(200 / d.armourTake + 1000, null);
  await wait(60);
  const spillPerRaw = (hp0 - c.hp) / 1000;

  // A SUPER MUST BE AN ORDINARY HIT. Same raw number through the same path on
  // a fresh actor, once tagged as a Super and once not: any difference is a
  // resistance, wherever it might be hiding.
  const mk = () => {
    const x = gs.spawnChampion(gs.player.x + 300, gs.player.y + 180, 'captain');
    x.die = () => { x.hp = Math.max(x.hp, 900); };
    return x;
  };
  const a = mk(); const b = mk();
  const aBefore = a.armour + a.hp; const bBefore = b.armour + b.hp;
  gs._dmgSrc = 'super'; a.damage(1500, null); gs._dmgSrc = null;
  gs._dmgSrc = 'primary'; b.damage(1500, null); gs._dmgSrc = null;
  await wait(60);
  return {
    armour: c.armourMax, hp: c.hpMax, total: c.armourMax + c.hpMax,
    cfgArmour: d.armour, cfgHp: d.hp,
    armourTake: d.armourTake, armourSpill: d.armourSpill,
    armourPerRaw: Math.round(armourPerRaw * 1000) / 1000,
    spillPerRaw: Math.round(spillPerRaw * 1000) / 1000,
    superRemoved: Math.round(aBefore - (a.armour + a.hp)),
    primaryRemoved: Math.round(bBefore - (b.armour + b.hp)),
    lowLine: Math.round(c.hpMax * d.lowHealthFrac),
  };
}));
check(pools.armour === pools.cfgArmour && pools.hp === pools.cfgHp,
  'the live actor carries exactly the authored pools',
  `${pools.armour}/${pools.hp} vs ${pools.cfgArmour}/${pools.cfgHp}`);
check(pools.total >= 5200 && pools.total <= 5500,
  'total durability is inside the S1 band',
  `${pools.total}`);
check(pools.hp - 2600 > (pools.armour - 1800) * 4,
  'and most of the increase went into the BODY, so the break stays reachable',
  `body +${pools.hp - 2600}, armour +${pools.armour - 1800}`);
check(Math.abs(pools.armourPerRaw - pools.armourTake) < 0.02,
  'armour still absorbs at exactly `armourTake` — the ratio is unchanged',
  `${pools.armourPerRaw} vs ${pools.armourTake}`);
check(Math.abs(pools.spillPerRaw - pools.armourSpill) < 0.03,
  'and overkill still spills at exactly `armourSpill`',
  `${pools.spillPerRaw} vs ${pools.armourSpill}`);
check(pools.superRemoved === pools.primaryRemoved,
  'NO SUPER RESISTANCE — the same raw damage removes the same durability whatever fired it',
  `super ${pools.superRemoved} vs primary ${pools.primaryRemoved}`);
check(pools.lowLine === Math.round(pools.hp * 0.30),
  'the critical threshold moved with the pool and is still 30%',
  `${pools.lowLine}`);

// ── 2. THE STEP: GEOMETRY, CLEANUP, AND THE LIVE FAIRNESS PROBE ────────────
const step = await run('?nodlg=1&champdbg=1&captel=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  gs.lives = 9999;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => e.destroy());

  const c = gs.spawnChampion(gs.player.x + 340, gs.player.y, 'captain');
  c.die = () => { c.hp = Math.max(c.hp, c.hpMax * 0.4); };
  const L = { steps: [], reasons: {}, inWall: 0, outOfBounds: 0, maxSpeed: 0,
    stepFrames: 0, stuckAfter: 0, superCasts: 0, stepsNearSuper: 0 };
  let lastSuperAt = -1e9;
  gs.events.on('champion-step', (a, reason, reach) => {
    if (a !== c) return;
    L.steps.push({ reason, reach: Math.round(reach), at: gs.time.now });
    L.reasons[reason] = (L.reasons[reason] || 0) + 1;
    // A step within 400ms AFTER a cast is the shape a Super-dodge would have.
    if (gs.time.now - lastSuperAt < 400) L.stepsNearSuper++;
  });
  gs.events.on('player-fire-super', () => { L.superCasts++; lastSuperAt = gs.time.now; });

  const b = gs.physics.world.bounds;
  const walls = gs.walls.getChildren();
  const hook = () => {
    if (!c.alive) return;
    if (c._cap === 'step') {
      L.stepFrames++;
      L.maxSpeed = Math.max(L.maxSpeed, Math.hypot(c.body.velocity.x, c.body.velocity.y));
    }
    if (c.x < b.x || c.x > b.right || c.y < b.y || c.y > b.bottom) L.outOfBounds++;
    for (const w of walls) {
      if (!w.body) continue;
      const r = w.body;
      if (c.x > r.x - 8 && c.x < r.right + 8 && c.y > r.y - 8 && c.y < r.bottom + 8) {
        L.inWall++; break;
      }
    }
  };
  gs.events.on('postupdate', hook);

  // ── THE LIVE FAIRNESS PROBE ──────────────────────────────────────────────
  // Fire real Supers at him from a distance he is comfortable at — nothing
  // about the geometry asks him to move — and watch whether the PRESS makes
  // him step. A Captain reading the button would show a step clustered right
  // after each cast; an honest one steps on his own clock or not at all.
  gs.player.setPosition(c.x - 420, c.y);
  for (let i = 0; i < 6; i++) {
    gs.player.superCharge = 999;
    gs.player._suppressedMs = 0;
    gs.player.tryFireSuper(Math.atan2(c.y - gs.player.y, c.x - gs.player.x));
    await wait(700);
  }
  const fairness = { casts: L.superCasts, stepsNearSuper: L.stepsNearSuper,
    stepsTotal: L.steps.length };

  // Now CROWD him, which is a reason he is allowed to have. THE COOLDOWN IS
  // NOT ZEROED: an earlier build forced it to make the step happen sooner, and
  // then the spacing check was measuring the rig's own impatience — it read a
  // 200ms gap against a 2800ms cooldown and called a correct build a skater.
  for (let i = 0; i < 60; i++) {
    gs.player.setPosition(c.x + 60, c.y + 40);
    await wait(150);
    if (L.reasons.close) break;
  }
  await wait(1200);

  // And let him fight for a while so the other reasons get a chance.
  gs.player.setPosition(c.x - 380, c.y);
  await wait(9000);
  gs.events.off('postupdate', hook);
  // Everything after this point is FORCED by the rig, so the spacing check
  // must not see it.
  const naturalSteps = L.steps.length;

  // CLEAN DEATH: a step must not outlive the actor as a standing velocity.
  c._stepCd = 0;
  c._beginStep(gs.player, 'close', { x: c.x + 120, y: c.y, reach: 120 });
  await wait(60);
  const midStep = c._cap === 'step';
  // `delete`, NOT `= undefined`. The immortality stub is an OWN property
  // shadowing the prototype method; assigning undefined leaves the shadow in
  // place and `damage()` calls it — "this.die is not a function", which reads
  // like a game bug and is entirely the rig's.
  delete c.die;
  c.hp = 1; c.damage(99999, null);
  await wait(200);
  const afterDeath = {
    cap: c._cap, vx: Math.round(c.body?.velocity?.x ?? 0),
    vy: Math.round(c.body?.velocity?.y ?? 0),
    plant: c._stepPlantMs, stepVx: c._stepVx,
  };
  const tel = gs._captel.last() || gs._captel.session();
  return { ...L, fairness, midStep, afterDeath, naturalSteps,
    telSteps: tel?.steps?.done ?? -1,
    cfg: c.def.step };
}));

check(step.steps.length > 0, 'he steps in a real fight', `${step.steps.length} steps`);
check(step.fairness.stepsNearSuper === 0,
  'SIX REAL SUPERS FIRED AT HIM AND NOT ONE STEP FOLLOWED A CAST — he is not dodging the button',
  `${step.fairness.casts} casts, ${step.fairness.stepsNearSuper} steps within 400ms`);
check(!!step.reasons.close,
  'crowding him is a reason he acts on',
  JSON.stringify(step.reasons));
check(step.outOfBounds === 0 && step.inWall === 0,
  'no step leaves the arena or ends inside a wall',
  `${step.outOfBounds} out of bounds, ${step.inWall} frames in geometry`);
const reaches = step.steps.map((s) => s.reach);
check(reaches.every((r) => r >= step.cfg.distance * 0.5 && r <= step.cfg.distance * 1.2),
  'every completed step travels a real, bounded distance',
  `${Math.min(...reaches)}..${Math.max(...reaches)}px against ${step.cfg.distance}`);
const nat = step.steps.slice(0, step.naturalSteps);
const gaps = nat.slice(1).map((s, i) => s.at - nat[i].at);
check(gaps.every((g) => g >= step.cfg.cooldownMs * 0.9),
  'the cooldown is respected — this is footwork, not skating',
  gaps.length ? `min gap ${Math.round(Math.min(...gaps))}ms vs ${step.cfg.cooldownMs}` : 'one step');
check(step.midStep && step.afterDeath.cap !== 'step'
  && step.afterDeath.vx === 0 && step.afterDeath.vy === 0,
  'dying mid-step leaves no stuck state and no standing velocity',
  JSON.stringify(step.afterDeath));
check(step.telSteps === step.steps.length,
  'the telemetry counts exactly the steps that happened',
  `${step.telSteps} vs ${step.steps.length}`);

// ── 3. ABSORPTION BELONGS TO THE ARMOUR, AND ONLY TO IT ────────────────────
const fxr = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => e.destroy());
  const c = gs.spawnChampion(gs.player.x + 360, gs.player.y, 'captain');
  c.die = () => { c.hp = Math.max(c.hp, 900); };
  const liveAbsorb = () => c._reactFx.filter((o) => o._absorb).length;

  let breaks = 0;
  gs.events.on('champion-armour-broken', () => { breaks++; });

  // INTACT: a hit must produce an absorption, and it must be at the CONTACT
  // POINT rather than at his centre.
  c.damage(80, { x: 200, y: 0 });
  await wait(30);
  const intact = liveAbsorb();
  const g = c._reactFx.find((o) => o._absorb);
  g?._tick?.();
  await wait(40);

  // A SUPER IS FIVE PELLETS IN ONE FRAME. The cap is what stops five blooms.
  for (let i = 0; i < 5; i++) c.damage(600, { x: 200, y: 20 * i });
  await wait(30);
  const volley = liveAbsorb();

  // BREAK, and it must fire exactly once however hard it is hit afterwards.
  //
  // SAMPLED ON THE BREAK FRAME, NOT 300ms LATER. A big absorption lives 325ms
  // and this harness runs at ~14fps, so a check that waited first was racing
  // the thing it was asking about and reported zero on a working overload.
  c.armour = 300;
  c.damage(5000, { x: 200, y: 0 });
  const afterBreakStart = liveAbsorb();
  await wait(300);
  const brokeOnce = breaks;

  // ── DRAIN ON THE ACTOR'S OWN CLOCK, NEVER ON A SLEEP ────────────────────
  // This used to be `await wait(700)` and it was a FRAME-RATE METER. Every
  // absorption is scheduled on `_clock`, which advances by Phaser's `delta` —
  // and Phaser CLAMPS delta, so on a slow container a second of wall time is a
  // third of a second of game time. The break's three overload responses live
  // 325ms, which put the sample exactly on that boundary: the check passed on
  // a fast box and failed on a slow one, on this build and on the one before
  // it, having measured the machine rather than the Captain. Advancing his own
  // clock and ticking his own effects retires everything that is genuinely
  // expired, deterministically, at any frame rate.
  c._clock += 4000;
  c._reactFx.slice().forEach((o) => o._tick?.());

  // POST-BREAK: ordinary hits must NOT speak the intact-armour language.
  const before = liveAbsorb();
  for (let i = 0; i < 4; i++) { c.damage(300, { x: 200, y: 0 }); await wait(60); }
  await wait(120);
  const afterPost = liveAbsorb();
  // DELETE THE IMMORTALITY STUB FIRST. Leaving it meant this actor never died
  // and "nothing it owned outlives it" was checked against a Captain who was
  // still standing — it reported 2 survivors, which were simply his live
  // damage Graphics doing their job.
  delete c.die;
  c.hp = 1;
  c.damage(99999, null);
  await wait(200);
  return { intact, volley, brokeOnce, afterBreakStart, before, afterPost,
    broken: c.armourBroken, maxLive: c.def.absorb.maxLive,
    leftOnDeath: c._reactFx.length };
}));
check(fxr.intact >= 1, 'a hit on intact armour produces an absorption', `${fxr.intact}`);
check(fxr.volley <= fxr.maxLive,
  'a five-pellet volley is capped, so a Super is several paths and not soup',
  `${fxr.volley} live against a cap of ${fxr.maxLive}`);
check(fxr.brokeOnce === 1, 'the break fires exactly once', `${fxr.brokeOnce}`);
check(fxr.afterBreakStart > 0,
  'and it BEGINS as the absorption overloading, not as a separate event',
  `${fxr.afterBreakStart} absorptions on the break frame`);
check(fxr.broken === true && fxr.afterPost === 0 && fxr.before === 0,
  'POST-BREAK HITS SPEAK A DIFFERENT LANGUAGE — no intact-armour absorption survives the layer',
  `before ${fxr.before}, after four hits ${fxr.afterPost}`);
check(fxr.leftOnDeath === 0, 'and nothing it owned outlives it', `${fxr.leftOnDeath}`);

// ── 4. STILL DEBUG-ONLY ────────────────────────────────────────────────────
const off = await run('?nodlg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs._startWave(0);
  await wait(2600);
  const { ENCOUNTER_PLAN } = await import('/src/data/encounters.js');
  return {
    champions: gs.enemies.getChildren().filter((e) => e.alive && e.isChampion).length,
    planRooms: Object.keys(ENCOUNTER_PLAN).length,
  };
}));
check(off.champions === 0, 'normal Endless still has no Captain', `${off.champions}`);
check(off.planRooms === 3, 'Phase A is untouched', `${off.planRooms} rooms planned`);

await browser.close();
for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — pools authored, arithmetic unchanged, the step is honest, the armour speaks`);
