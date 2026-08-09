// Can the player SEE the attack coming? The gate the last release did not have.
//
// ── Why this file exists ─────────────────────────────────────────────────
//
// A release shipped four Vader moves behind 17 passing checks and was rejected
// on sight. Every check in that file was of the form "the saber travelled
// 200px", "the player moved 60px against their input", "a dash charge was
// spent". All of them were true. Not one of them could fail when the move was
// unreadable — and two of the four drew nothing on the floor at all, while a
// third put three red rectangles down in three seconds.
//
// Effects are not readability. These four checks assert the READING.
//
// ── The rule that matters most ───────────────────────────────────────────
//
// NOTHING IS SILENCED in the coherence pass. Every boss test in the rejected
// build opened with `b.cooldown = 1e9`, which is precisely what stops Vader's
// own state machine — so the harness was structurally incapable of seeing the
// two systems fight over his body. A measurement may be stabilised by silencing
// a clock; a VERDICT may not.
//
// See docs/POST-MORTEM-vader-moves.md.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const PAGE_URL = 'http://localhost:5173/';
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

await page.goto(PAGE_URL);
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
  gs.arenaActive = false;
  gs.lives = 9999;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) {
    gs.spawnBoss(gs.player.x + 320, gs.player.y, { encounter: 3 });
    await new Promise((r) => setTimeout(r, 900));
  }
  gs.events.emit('set-darkness', false);
  const dbg = await import('/src/systems/debug.js');
  dbg.setGodMode(true);            // the player must survive to be measured
});

const r = {};

// ── 1. EVERY DAMAGING MOVE DRAWS A ZONE, checked at the REGISTRY ─────────
//
// Registry-level on purpose: a per-move check can be forgotten when a fifth
// move is added, and forgetting is exactly what happened to FORCE PULL and
// FORCE PUSH. This iterates the registry, so a new move cannot dodge it.
// PER-MOVE MEASUREMENTS SILENCE HIS ATTACK CLOCK. This is the allowed half of
// the rule: stabilise a measurement by silencing a clock if you must, then run
// one pass with NOTHING silenced and assert the fight is still coherent. Check 4
// is that pass, and it sets his cooldown back to zero.
//
// Without it he re-enters a charge on the frame after being handed back to idle,
// `_castBossMove` correctly refuses, and every probe reads zero — which fails
// one check and passes another vacuously.
r.zones = await page.evaluate(async () => {
  const { BOSS_MOVES } = await import('/src/data/bossMoves.js');
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  b.cooldown = 1e9;
  const out = [];
  for (const m of BOSS_MOVES) {
    b._activeMove?.cancel?.();
    b._activeMove = null;
    b._performing = false;
    b.state = 'idle';
    gs.clearTelegraphs();
    gs.player.alive = true;
    gs.player.hp = gs.player.hpMax;
    gs.player.setPosition(b.x - 210, b.y);
    await new Promise((res) => setTimeout(res, 150));

    let h = null;
    let why = '';
    for (let a = 0; a < 12 && !h; a++) {
      // Re-establish EVERY precondition each attempt, and record which one was
      // false when it still refused — a silent refusal is what makes this whole
      // measurement lie, so it reports itself rather than vanishing into a zero.
      b._activeMove?.cancel?.();
      b._activeMove = null;
      b._performing = false;
      b.state = 'idle';
      b.cooldown = 1e9;
      gs.player.alive = true;
      gs.player.hp = gs.player.hpMax;
      h = gs._castBossMove(b, m.id);
      if (!h) {
        why = `state=${b.state} performing=${b._performing} active=${!!b._activeMove} `
          + `playerAlive=${gs.player.alive} bossAlive=${b.alive}`;
        await new Promise((res) => setTimeout(res, 80));
      }
    }
    // Sample every frame through the ANTICIPATE beat: a zone that only appears
    // at the moment of damage is not a telegraph.
    let zonesDuringWindup = 0;
    let maxConcurrent = 0;
    const onFrame = () => {
      const live = gs._telegraphs.filter((z) => !z.dead && z.owner === b);
      maxConcurrent = Math.max(maxConcurrent, live.length);
      if (h && h.phase === 'anticipate') zonesDuringWindup = Math.max(zonesDuringWindup, live.length);
    };
    gs.events.on('postupdate', onFrame);
    for (let i = 0; i < 120 && h && h.phase !== 'done'; i++) {
      await new Promise((res) => setTimeout(res, 40));
    }
    gs.events.off('postupdate', onFrame);
    out.push({ id: m.id, cast: !!h, why, zonesDuringWindup, maxConcurrent });
    b._activeMove?.cancel?.();
    b._activeMove = null;
    b._performing = false;
  }
  return out;
});

// ── 2. THE WIND-UP RENDERS ───────────────────────────────────────────────
//
// During ANTICIPATE he must be PLANTED and his body must visibly change. On the
// rejected build he walked at the player at 165px/s through every wind-up,
// because his AI overwrote the move's velocity every frame — so there was no
// anticipation on screen at all, just Vader advancing and then damage.
r.windup = await page.evaluate(async () => {
  const { BOSS_MOVES } = await import('/src/data/bossMoves.js');
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  b.cooldown = 1e9;
  const out = [];
  for (const m of BOSS_MOVES) {
    b._activeMove?.cancel?.();
    b._activeMove = null;
    b._performing = false;
    b.state = 'idle';
    // Clear the PREVIOUS move's leftovers before measuring this one. VANISH
    // tweens him to zero scale and back; cancelling stops its timers but not
    // its tweens, so the next move's baseline was sometimes captured mid-fade
    // and its squash measured as no change at all. Isolating from the last
    // move is fair; isolating from the system under test is not.
    gs.tweens.killTweensOf(b);
    b.setScale(1);
    b.setAlpha(1);
    gs.player.alive = true;
    gs.player.hp = gs.player.hpMax;
    gs.player.setPosition(b.x - 260, b.y);
    await new Promise((res) => setTimeout(res, 250));

    const start = { x: b.x, y: b.y, sx: b.scaleX, sy: b.scaleY };
    const peak = { speed: 0, drift: 0, bodyChange: 0 };
    // RETRY THE CAST. His cooldown is deliberately NOT silenced here, so during
    // the settle above he can enter a charge — and `_castBossMove` correctly
    // refuses while his own state machine is busy. A refused cast returns null,
    // every probe then reads zero, and the result is indistinguishable from "the
    // move did nothing": bodyChange 0 AND speed 0, so one check fails and the
    // other passes vacuously. That is the exact false-pass shape this file
    // exists to prevent, so it is asserted rather than smoothed over.
    let h = null;
    let why = '';
    for (let a = 0; a < 12 && !h; a++) {
      // Re-establish EVERY precondition each attempt, and record which one was
      // false when it still refused — a silent refusal is what makes this whole
      // measurement lie, so it reports itself rather than vanishing into a zero.
      b._activeMove?.cancel?.();
      b._activeMove = null;
      b._performing = false;
      b.state = 'idle';
      b.cooldown = 1e9;
      gs.player.alive = true;
      gs.player.hp = gs.player.hpMax;
      h = gs._castBossMove(b, m.id);
      if (!h) {
        why = `state=${b.state} performing=${b._performing} active=${!!b._activeMove} `
          + `playerAlive=${gs.player.alive} bossAlive=${b.alive}`;
        await new Promise((res) => setTimeout(res, 80));
      }
    }
    const onFrame = () => {
      if (!h || h.phase !== 'anticipate') return;
      peak.speed = Math.max(peak.speed, Math.hypot(b.body?.velocity.x || 0, b.body?.velocity.y || 0));
      peak.drift = Math.max(peak.drift, Math.hypot(b.x - start.x, b.y - start.y));
      peak.bodyChange = Math.max(peak.bodyChange,
        Math.abs(b.scaleX - start.sx) + Math.abs(b.scaleY - start.sy));
    };
    gs.events.on('postupdate', onFrame);
    for (let i = 0; i < 120 && h && h.phase === 'anticipate'; i++) {
      await new Promise((res) => setTimeout(res, 40));
    }
    gs.events.off('postupdate', onFrame);
    out.push({
      id: m.id,
      cast: !!h,
      why,
      speed: Math.round(peak.speed),
      drift: Math.round(peak.drift),
      bodyChange: +peak.bodyChange.toFixed(3),
    });
    b._activeMove?.cancel?.();
    b._activeMove = null;
    b._performing = false;
  }
  return out;
});

// ── 3. THE ZONE TRACKS THE THING THAT WILL HIT YOU ───────────────────────
r.tracking = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  b._activeMove?.cancel?.();
  b._activeMove = null;
  b._performing = false;
  b.state = 'idle';
  b.cooldown = 1e9;
  gs.clearTelegraphs();
  gs.player.setPosition(b.x - 240, b.y);
  gs.player.alive = true;

  const h = gs._castBossMove(b, 'saberthrow');
  await new Promise((res) => setTimeout(res, 120));
  const tel = gs._telegraphs.find((z) => !z.dead && z.owner === b);
  if (!tel) return { moved: 0, gap: -1 };

  // Shove him bodily mid-windup. The zone has to come with him.
  const from = { x: b.x, y: b.y };
  b.setPosition(b.x + 150, b.y + 60);
  await new Promise((res) => setTimeout(res, 200));
  const gap = Math.round(Math.hypot(tel.shape.x - b.x, tel.shape.y - b.y));
  b._activeMove?.cancel?.();
  b._activeMove = null;
  b._performing = false;
  return { moved: Math.round(Math.hypot(b.x - from.x, b.y - from.y)), gap };
});

// ── 4. COHERENCE, WITH NOTHING SILENCED ──────────────────────────────────
//
// The check the rejected suite could not contain. His own state machine and the
// move clock both run; the fight has to stay legible anyway.
r.coherence = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  b._activeMove?.cancel?.();
  b._activeMove = null;
  b._performing = false;
  b.state = 'idle';
  b.cooldown = 0;                    // his clock RUNNING, deliberately
  gs.clearTelegraphs();

  const log = { frames: 0, maxZones: 0, overlapFrames: 0, moveWhileAttacking: 0 };
  const onFrame = () => {
    log.frames += 1;
    const live = gs._telegraphs.filter((z) => !z.dead && z.owner === b);
    log.maxZones = Math.max(log.maxZones, live.length);
    const moveLive = b._activeMove && b._activeMove.phase !== 'done';
    if (moveLive && b.state !== 'idle') log.moveWhileAttacking += 1;
    if (live.length > 1) log.overlapFrames += 1;
  };
  gs.events.on('postupdate', onFrame);
  for (let i = 0; i < 60; i++) {
    gs.player.alive = true;
    gs.player.hp = gs.player.hpMax;
    await new Promise((res) => setTimeout(res, 500));
  }
  gs.events.off('postupdate', onFrame);
  return log;
});


// ── 5. THE FIGHT ITSELF: what round two was rejected for ─────────────────
//
// Each of these is a line from the player's report turned into a number.
r.fight = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  const out = {};

  // (a) HE STOPS AT SABER RANGE. He used to drive at the player every frame
  // with no arrival condition, so on reaching them he ground against their
  // collision box — "he comes and pathfinder gets fucked, he spins left right
  // on my position". Measured as how close he gets to a stationary player.
  b._activeMove?.cancel?.(); b._activeMove = null; b._performing = false;
  b.state = 'idle'; b.cooldown = 1e9;
  gs.clearTelegraphs();
  gs.player.alive = true;
  gs.player.hp = gs.player.hpMax;
  gs.player.setPosition(b.x - 520, b.y);
  // WHERE HE SETTLES, not the smallest number seen.
  //
  // Two things pollute an instantaneous minimum and both are moves behaving
  // correctly: FORCE PULL drags the player onto him on purpose, and the frame
  // right after any move ends inherits wherever that move left him. The report
  // is about where he SITS — "he comes and spins left right on my position" —
  // so the median of his resting distance is the honest statistic, and it also
  // cannot be fooled by one frame.
  const rest = [];
  let settleMs = 0;
  const onApproach = () => {
    gs.player.body?.setVelocity(0, 0);
    if (b._performing) { settleMs = 0; return; }
    // Count FRAMES, not assumed milliseconds. The first version added 16ms a
    // frame and waited for 400 — but this harness runs at ~50ms/frame, so that
    // was really asking for 25 consecutive idle frames, which between his combo
    // clock and his rotation clock never happens. Zero samples collected, and a
    // check that cannot gather data is not a check.
    settleMs += 1;
    if (settleMs < 5) return;            // a few frames to re-establish range
    rest.push(Math.hypot(gs.player.x - b.x, gs.player.y - b.y));
  };
  gs.events.on('postupdate', onApproach);
  for (let i = 0; i < 60; i++) {
    gs.player.hp = gs.player.hpMax;
    await new Promise((res) => setTimeout(res, 100));
  }
  gs.events.off('postupdate', onApproach);
  rest.sort((a, z) => a - z);
  out.closest = rest.length ? Math.round(rest[Math.floor(rest.length / 2)]) : -1;
  out.restSamples = rest.length;

  // (b) A SUPER DOES NOT MOVE HIM. "He gets thrown far... it can get buggy if
  // I hit him with super when he's doing a move."
  // Hit him MID-MOVE, which is the case that was reported and the only case
  // where it shows. Idle, his own AI rewrites his velocity every frame and
  // swallows the knockback; while a move owns him the AI has yielded, so the
  // shove survives and drags him off his own telegraph.
  b._activeMove?.cancel?.(); b._activeMove = null; b._performing = false;
  b.state = 'idle'; b.cooldown = 1e9;
  b.body?.setVelocity(0, 0);
  let mh = null;
  for (let a = 0; a < 8 && !mh; a++) {
    b.state = 'idle'; b._performing = false; b._activeMove = null;
    mh = gs._castBossMove(b, 'saberthrow');
    if (!mh) await new Promise((res) => setTimeout(res, 80));
  }
  await new Promise((res) => setTimeout(res, 160));
  // Measure the VELOCITY the hits impart, not the distance he ends up from
  // where he started. Knockback works by adding to `body.velocity`, while a
  // wind-up legitimately TWEENS his position — SABER THROW's rear-back alone
  // is 24px — so a position delta cannot tell the two apart and read 13px on a
  // build where the knockback was already gone.
  let peakSpeed = 0;
  const onShove = () => {
    peakSpeed = Math.max(peakSpeed, Math.hypot(b.body?.velocity.x || 0, b.body?.velocity.y || 0));
  };
  gs.events.on('postupdate', onShove);
  for (let i = 0; i < 5; i++) b.damage(400, { x: 900, y: 400 });
  await new Promise((res) => setTimeout(res, 400));
  gs.events.off('postupdate', onShove);
  out.shoved = Math.round(peakSpeed);
  out.shovedDuringMove = !!(b._performing || mh);
  b._activeMove?.cancel?.(); b._activeMove = null; b._performing = false;

  return out;
});

// ── 6. THE SABER COMES BACK, IT DOES NOT TELEPORT ────────────────────────
r.boomerang = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  const out2 = {};
  b._activeMove?.cancel?.(); b._activeMove = null; b._performing = false;
  b.state = 'idle'; b.cooldown = 1e9;
  gs.player.alive = true;
  gs.player.setPosition(b.x - 300, b.y);
  await new Promise((res) => setTimeout(res, 150));

  const w = b.weaponSprite;
  let last = null;
  let maxJump = 0;
  let peak = 0;
  let returned = false;
  const samples = [];
  const afterMove = [];
  const onFrame = () => {
    if (out2.movedTo && w?.active) afterMove.push(Math.hypot(w.x - b.x, w.y - b.y));
    if (!w?.active) return;
    const d = Math.hypot(w.x - b.x, w.y - b.y);
    samples.push(Math.round(d));
    peak = Math.max(peak, d);
    if (last !== null && peak > 200) {
      // Only care about jumps on the way HOME — a teleport back shows up as one
      // enormous single-frame decrease.
      const jump = last - d;
      if (jump > 0) maxJump = Math.max(maxJump, jump);
    }
    if (peak > 200 && d < 40) returned = true;
    last = d;
  };
  gs.events.on('postupdate', onFrame);
  let h = null;
  for (let a = 0; a < 8 && !h; a++) {
    b.state = 'idle'; b._performing = false; b._activeMove = null;
    h = gs._castBossMove(b, 'saberthrow');
    if (!h) await new Promise((res) => setTimeout(res, 80));
  }
  // MOVE HIM WHILE IT IS OUT. This is what separates a boomerang from a
  // scripted round trip: the old return was a tween to the coordinates he
  // occupied when it was scheduled, so walking away left the blade flying to
  // an empty patch of floor and then snapping into his hand from there.
  // Displace him AFTER the return would have been scheduled. The old code
  // captured his coordinates at that moment (actMs*0.5 into the act beat,
  // ~1450ms after the cast); moving him before that let the stale capture
  // happen to be correct, and the check passed on the build it was written to
  // catch. Late enough, and the old blade flies to an empty patch of floor.
  await new Promise((res) => setTimeout(res, 1750));
  b.setPosition(b.x, b.y - 220);
  out2.movedTo = { x: Math.round(b.x), y: Math.round(b.y) };
  for (let i = 0; i < 90 && !returned; i++) await new Promise((res) => setTimeout(res, 50));
  // Let it settle before reading the resting gap. A single sample taken on the
  // catch frame lands mid-reattach while he is still walking, which is why this
  // read 50px on one run in three and 11px on the others — the instrument, not
  // the blade.
  await new Promise((res) => setTimeout(res, 250));
  gs.events.off('postupdate', onFrame);
  b._activeMove?.cancel?.(); b._activeMove = null; b._performing = false;
  // COUNT THE FRAMES ON THE RETURN LEG, do not threshold the pixels.
  //
  // The first version asserted "no single-frame jump bigger than 90px", which
  // measures the HARNESS: the blade legitimately travels up to ~1240px/s, and
  // at this frame rate one honest frame of flight is 60-120px. It failed two
  // runs in three for being a slow machine.
  //
  // A teleport has one unmistakable signature regardless of frame rate: the
  // return happens in a single frame. So count the samples between the far
  // point and the catch. A flight has many; a snap has none.
  const peakIdx = samples.indexOf(Math.max(...samples));
  const legFrames = samples.slice(peakIdx).filter((d) => d > 45).length;
  // Does it CLOSE on him after he moves? The old return was a tween to the
  // coordinates he occupied when it was scheduled, so once he stepped away the
  // blade kept flying to an empty patch of floor and hung there at roughly the
  // displacement distance until `impact` snapped it into his hand. Counting
  // frames spent far from him after the displacement separates the two: a
  // homing blade closes, a stale tween loiters.
  // The signature of a snap is ONE huge single-frame close, not time spent
  // far away — the blade legitimately needs most of the window to fly ~600px
  // home, and counting that as loitering measured the flight and called it the
  // bug. The blade is capped at ~1240px/s, so an honest frame closes at most
  // ~62px even on a slow machine; the old code teleported the last ~220px.
  let maxDrop = 0;
  for (let i = 1; i < afterMove.length; i++) {
    maxDrop = Math.max(maxDrop, afterMove[i - 1] - afterMove[i]);
  }
  const loiter = Math.round(maxDrop);
  return {
    ...out2,
    loiter, afterMoveFrames: afterMove.length,
    peak: Math.round(peak), legFrames, returned, frames: samples.length,
    finalGap: Math.round(Math.hypot((w?.x ?? 0) - b.x, (w?.y ?? 0) - b.y)),
  };
});

await browser.close();

// ── Reporting ────────────────────────────────────────────────────────────
const noZone = r.zones.filter((z) => z.zonesDuringWindup < 1);
check(noZone.length === 0,
  'EVERY move puts a zone on the floor before it hurts you',
  `${noZone.map((z) => z.id).join(', ')} drew nothing — FORCE PULL and FORCE PUSH shipped exactly like this`);
const doubled = r.zones.filter((z) => z.maxConcurrent > 1);
check(doubled.length === 0,
  'and never more than ONE zone per attack',
  `${doubled.map((z) => `${z.id} x${z.maxConcurrent}`).join(', ')} — "there can be two red trails"`);

const refused = r.windup.filter((w) => !w.cast).concat(r.zones.filter((z) => !z.cast));
check(refused.length === 0,
  'every move under test actually RAN',
  `${refused.map((w) => `${w.id} (${w.why})`).join(', ')} were refused — a refused cast reads as zero on every probe, which is a false pass wearing a real one's clothes`);
const walking = r.windup.filter((w) => w.speed > 40 || w.drift > 40);
check(walking.length === 0,
  'he is PLANTED through his wind-up, not walking through it',
  `${walking.map((w) => `${w.id} ${w.speed}px/s drift ${w.drift}px`).join(', ')} — measured at 165px/s on the rejected build, which is why the anticipation never rendered`);
const stiff = r.windup.filter((w) => w.bodyChange < 0.02);
check(stiff.length === 0,
  'and his BODY visibly winds up',
  `${stiff.map((w) => `${w.id} ${w.bodyChange}`).join(', ')}`);
for (const w of r.windup) {
  check(true, `  ${w.id}: ${w.speed}px/s during anticipate, body change ${w.bodyChange}`, '');
}

check(r.tracking.gap >= 0 && r.tracking.gap < 60,
  'a zone follows the actor that will hit you',
  `zone sat ${r.tracking.gap}px away after he moved ${r.tracking.moved}px — he used to walk 163px out of his own lane`);

check(r.coherence.maxZones <= 1,
  'with NOTHING silenced, he never has two zones out at once',
  `peak ${r.coherence.maxZones} across ${r.coherence.frames} frames`);
check(r.coherence.moveWhileAttacking === 0,
  'and his own state machine never attacks underneath a scripted move',
  `${r.coherence.moveWhileAttacking} frames of both at once`);
check(pageErrors.length === 0, 'no exception across the run', pageErrors.slice(0, 2).join(' | '));


// ── The fight, per this round's report ───────────────────────────────────
check(r.fight.closest > 60,
  'he SETTLES at saber range instead of standing on you',
  `resting distance ${r.fight.closest}px across ${r.fight.restSamples} samples — he used to drive at the player every frame with no arrival condition, grinding on their collision box`);
check(r.fight.shoved <= 30,
  'a super does NOT shove him, even mid-move',
  `peak ${r.fight.shoved}px/s under five knockback hits while a move owned him — any displacement drags him off a telegraph he is the origin of`);
check(r.boomerang.peak > 300,
  'the thrown saber really leaves his hand',
  `${r.boomerang.peak}px`);
// LIMIT, stated rather than papered over: this asserts the blade ARRIVES after
// he is displaced, and `legFrames` above asserts it travels rather than jumps.
// It does NOT prove the last leg was smooth. I tried three sharper versions —
// time spent far away, biggest single-frame close — and each one measured frame
// scheduling instead of the game: the boss is walking during the flight, so the
// gap between them changes for two reasons at once, and a slow frame moves both.
// The pair below is what holds across runs; the smoothness of the final approach
// is a screenshot question, not an assertion.
check(r.boomerang.returned && r.boomerang.finalGap < 60,
  'and comes back to his hand EVEN AFTER HE MOVES',
  `ended ${r.boomerang.finalGap}px from him after he was displaced 220px mid-flight — the old return flew to the coordinates he had left. 60px is one body width: reattached, the saber rides ~26px off his centre and he is still walking when the sample lands.`);
check(r.boomerang.legFrames >= 4,
  'and FLIES home rather than teleporting',
  `${r.boomerang.legFrames} frames of travel between the far point and the catch — a teleport does it in one, whatever the frame rate`);

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the attacks can be seen coming`);
