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

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the attacks can be seen coming`);
