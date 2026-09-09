// DIAGNOSTIC — ONE SABER, ONE OWNER: the throw/DEFLECTION race, measured.
//
// `evidence-saber-ownership.mjs` photographs the two orderings that were fixed
// when the DUE-vs-ACTIVE scheduler was built. This rig measures the one that
// was NOT: the DEFLECTION clock coming due while a SABER THROW is COMMITTED
// but has not yet detached the blade.
//
// The throw is four beats. `_saberAway` — the flag every possession check in
// the game reads — is set in ACT, 700ms after the cast. So for the whole
// ANTICIPATE beat the blade is still in his hand and `hasSaber()` is true,
// while the move that is going to take it is already running and cannot be
// stopped. `canOpenGuard()` asks an INSTANTANEOUS question ("is it in his hand
// right now") about an interval it is about to occupy for 2400ms.
//
// If the clock comes due early enough in that beat, the 500ms tell resolves
// BEFORE act fires: the guard opens with the blade in hand, act then throws it,
// and Vader spends the rest of the window deflecting bolts with a weapon that
// is several hundred pixels away. That is the handset report.
//
// Nothing here is faked past the clock: the throw is a real cast through
// `_castBossMove`, and the DEFLECTION is armed by writing its own countdown to
// nearly-due and letting `_tickMechanics` fire it exactly as it does in play.
//
//   node tests/diag-saber-ownership.mjs
//
// Exit 0 = the invariant held on every sample. Exit 1 = it was violated, and
// the sample that broke it is printed.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/?nodlg=1&nofreeze=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };

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

await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { ENDLESS } = await import('/src/config.js');
  gs.sector = 3 * ENDLESS.bossEvery;
  gs.loadRoom(ROOMS.find((r) => r.boss));
  await new Promise((r) => setTimeout(r, 2200));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
  if (!gs.boss?.alive) { gs.spawnBoss(gs.player.x + 380, gs.player.y); await new Promise((r) => setTimeout(r, 700)); }
  gs.lives = 9999;
  gs.player.hp = gs.player.hpMax;
  // Pin every mechanic this rig is not measuring. LIGHTS OUT and AFTERIMAGES
  // free-running through a frame-by-frame lifecycle measurement is the noise
  // `smoke-deflect` documents; DEFLECTION's own clock is written per trial.
  const FAR = 1e9, b = gs.boss;
  b._blackoutT = FAR; b._afterimageT = FAR; b._disarmT = FAR; b._sunderT = FAR;
});

// ── THE SAMPLER LIVES INSIDE THE PAGE ────────────────────────────────────
// A `page.evaluate` round trip costs 200-400ms and the beat under test is one
// frame wide, so every sample is taken on `postupdate`, after the boss has
// drawn and after the flight timer has moved the blade.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  window.__SO = { on: false, rows: [] };
  gs.events.on('postupdate', () => {
    const S = window.__SO;
    if (!S.on) return;
    const b = gs.boss;
    if (!b?.alive) return;
    const w = b.weaponSprite;
    S.rows.push({
      t: Math.round(gs.time.now - S.t0),
      move: b._activeMove?.move?.id ?? null,
      phase: b._activeMove?.phase ?? null,
      away: !!b._saberAway,
      dist: w?.active ? +Math.hypot(w.x - b.x, w.y - b.y).toFixed(0) : -1,
      hasSaber: b.hasSaber(),
      owner: b._saberOwner ?? '(none)',
      pending: !!b._reflectPending,
      claimed: !!b._reflectClaimed,
      reflecting: b.isReflecting(),
      guarding: b.isGuarding(),
      canOpen: b.canOpenGuard(),
    });
  });
});

// ── ONE TRIAL ────────────────────────────────────────────────────────────
// `dueIn` is how long after the cast the DEFLECTION clock comes due. Sweeping
// it walks the tell across the throw's whole 700ms anticipate beat, which is
// exactly the window the handset hit by accident.
const trial = (dueIn) => page.evaluate(async (due) => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss;
  const p = gs.player;
  // A refused cast reads exactly like a failed one — restore the world the cast
  // needs before asking for it, and report the refusal reason if it still says no.
  p.alive = true; p.setActive(true).setVisible(true).setAlpha(1); p.hp = p.hpMax;
  // `MoveScript.cancel()` deliberately does NOT clear `_activeMove` (only the
  // `done` path does), and `_castBossMove` refuses while it holds a handle whose
  // phase is not 'done' — a stale handle from the previous trial reads exactly
  // like the cast failing.
  b._activeMove?.cancel?.();
  b._activeMove = null;
  b._performing = false; b.state = 'idle';
  // His own state machine is not silenced, only held off the two beats this
  // rig owns: `_castBossMove` refuses unless `state === 'idle'`, and a charge
  // wind-up picked during the settle below refuses the cast for a reason that
  // has nothing to do with the invariant. It re-arms the moment the cast lands.
  b.cooldown = 4000; b._staggerMs = 0;
  // Same for the scripted-move clock: `_moveT` casts on its own schedule and is
  // not gated by `cooldown`, so a free run would start SOMETHING during the
  // settle below and refuse the cast this rig is here to make. The trial owns
  // the throw; section FREE RUN at the end measures the invariant with nothing
  // held off at all.
  b._moveT = 1e9;
  b._reflectUntil = 0; b._reflectPending = false; b._reflectClaimed = false;
  b._absorbCount = 0; b._releaseT = 0; b._followT = 0;
  b._reflectEvery = 0; b._reflectT = 1e9;
  if (b.releaseSaber) b.releaseSaber(b._saberOwner); else b._saberAway = false;
  await new Promise((r) => setTimeout(r, 260));

  // Revive HERE, not before the settle: `_castBossMove` refuses outright once
  // `player.alive` is false, and Vader standing this close kills the player
  // inside 260ms of contact damage. Restoring hp is not reviving.
  p.alive = true; p.setActive(true).setVisible(true).setAlpha(1); p.hp = p.hpMax;
  b.state = 'idle'; b._performing = false; b._moveT = 1e9;
  const h = gs._castBossMove(b, 'saberthrow');
  if (!h) return { cast: false, why: { guarding: b.isGuarding(), state: b.state,
    performing: b._performing, playerAlive: p.alive,
    activeMove: b._activeMove ? `${b._activeMove.move?.id}:${b._activeMove.phase}` : null,
    moveT: Math.round(b._moveT), sameBoss: b === gs.boss } };

  window.__SO.t0 = gs.time.now;
  window.__SO.rows.length = 0;
  window.__SO.on = true;
  // The real path: arm his own clock so `_tickMechanics` fires DEFLECTION due
  // on its own, inside the beat. Nothing sets `_reflectPending` by hand.
  await new Promise((r) => setTimeout(r, due));
  b._reflectEvery = 9000;
  b._reflectT = 1;
  // Long enough for the whole throw (700 + 1500 + 700) plus the 2400ms window.
  // `_moveT` is re-armed by the cast itself, so it is held off in slices for the
  // observation window too — a second scripted move landing on top of the throw
  // is a different measurement, and the FREE RUN section covers that case
  // honestly instead.
  for (let i = 0; i < 10; i++) { b._moveT = 1e9; await new Promise((r) => setTimeout(r, 520)); }
  window.__SO.on = false;
  return { cast: true, rows: window.__SO.rows.slice() };
}, dueIn);

const trials = [];
for (const due of [0, 40, 80, 120, 160, 200, 260, 340, 440, 560, 680]) {
  // A REFUSED CALL READS EXACTLY LIKE A FAILED ONE. His own systems are not
  // silenced, so a cast can legitimately collide with a state-machine attack;
  // retry, and only then call it a failure — with the refusal reason printed.
  let r = await trial(due);
  for (let k = 0; k < 3 && !r.cast; k++) r = await trial(due);
  if (!r.cast) fail(`SABER THROW refused at dueIn=${due}: ${JSON.stringify(r.why)}`);
  const flying = r.rows.filter((s) => s.away);
  // ── THE GATE, MEASURED WITHOUT TIMING LUCK ────────────────────────────
  // The end-to-end violation above needs the tell to resolve inside a ~200ms
  // slice of the throw's wind-up, which at ~20fps this harness only sometimes
  // hits. The invariant itself does not need luck: from the frame the throw is
  // committed to the frame the blade is physically back in his hand, the blade
  // is not Vader's, so `hasSaber()` and `canOpenGuard()` must both be false on
  // every sample in between. Pre-fix they are TRUE for the whole 700ms
  // anticipate, which is precisely the interval the guard slips through.
  const lastAway = r.rows.reduce((k, s, i) => (s.away ? i : k), -1);
  const owned = lastAway < 0 ? [] : r.rows.slice(0, lastAway + 1);
  const gate = owned.filter((s) => s.hasSaber || s.canOpen);
  // DISTANCE IS A CROSS-CHECK, NOT THE AUTHORITY. `_saberAway` and the owner
  // are the truth; the blade legitimately reaches ~150px out of his hand on a
  // parry follow-through and on the super power sweep while being entirely his,
  // and a 120px threshold flagged one such frame in a 60s free run. Only a
  // thrown blade clears 300 (the throw's reach is 620).
  // Deliberately NOT a test of the owner field: this claim has to mean the same
  // thing on the build being replaced, or the A/B fails because a new field is
  // absent rather than because the game was wrong. `_saberAway` and the blade's
  // real position exist on both.
  const bad = r.rows.filter((s) => s.reflecting && (s.away || s.dist > 300));
  const opened = r.rows.some((s) => s.reflecting);
  const claimedWithMoveLive = r.rows.filter((s) => s.claimed && s.move === 'saberthrow'
    && (s.phase === 'anticipate' || s.phase === 'act'));
  trials.push({ due, samples: r.rows.length, flying: flying.length, opened, gate: gate.length,
    claimedInThrow: claimedWithMoveLive.length, violations: bad.length,
    worstDist: bad.length ? Math.max(...bad.map((s) => s.dist)) : 0,
    first: bad[0] || null });
  console.log(`dueIn=${String(due).padStart(3)}  samples=${String(r.rows.length).padStart(3)}`
    + `  bladeAway=${String(flying.length).padStart(3)}`
    + `  guardOpened=${opened ? 'Y' : 'n'}`
    + `  claimedInsideThrow=${claimedWithMoveLive.length}`
    + `  claimableWhileThrowOwnsIt=${gate.length}`
    + `  VIOLATIONS=${bad.length}`
    + (bad.length ? `  worst blade ${Math.max(...bad.map((s) => s.dist))}px away` : ''));
  if (bad.length) console.log('    first violating sample:', JSON.stringify(bad[0]));
  if (process.env.SO_VERBOSE) r.rows.forEach((s) => console.log('   ', JSON.stringify(s)));
}

// ── REGRESSION CASES ─────────────────────────────────────────────────────
// Everything below asks the gate directly rather than racing a clock, and
// every one of them is vacuity-gated: a case that never got the blade into the
// air proves nothing about what may happen while it is there.
const reset = () => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const b = gs.boss, p = gs.player;
  b._activeMove?.cancel?.(); b._activeMove = null;
  b._performing = false; b.state = 'idle'; b.cooldown = 4000; b._staggerMs = 0;
  b._moveT = 1e9; b._reflectEvery = 0; b._reflectT = 1e9;
  b._reflectUntil = 0; b._reflectPending = false; b._reflectClaimed = false;
  b._absorbCount = 0; b._releaseT = 0; b._followT = 0;
  b.releaseSaber ? b.releaseSaber(b._saberOwner) : (b._saberAway = false);
  await new Promise((r) => setTimeout(r, 260));
  p.alive = true; p.setActive(true).setVisible(true).setAlpha(1); p.hp = p.hpMax;
  b.state = 'idle'; b._performing = false; b._moveT = 1e9;
});

const cases = {};
// Each case reports `ran: false` when the cast was refused and is retried,
// rather than passing vacuously on a throw that never happened.
const run = async (fn) => {
  let out = await page.evaluate(fn);
  for (let k = 0; k < 3 && out?.ran === false; k++) { await reset(); out = await page.evaluate(fn); }
  return out;
};

// F — CANCELLATION leaves no stuck ownership.
cases.cancel = await run(async () => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss;
  // A refused call reads exactly like a failed one. Revive the player
  // (`_castBossMove` refuses outright once `player.alive` is false, and Vader
  // this close kills them inside a settle) and drop any handle left over.
  const p = gs.player;
  p.alive = true; p.setActive(true).setVisible(true).setAlpha(1); p.hp = p.hpMax;
  b._activeMove?.cancel?.(); b._activeMove = null;
  b._performing = false; b.state = 'idle'; b._moveT = 1e9;
  const h = gs._castBossMove(b, 'saberthrow');
  if (!h) return { ran: false };
  await new Promise((r) => setTimeout(r, 900));          // mid-flight
  const w = b.weaponSprite;
  const during = { owner: b._saberOwner, away: !!b._saberAway,
                   dist: +Math.hypot(w.x - b.x, w.y - b.y).toFixed(0), has: b.hasSaber() };
  h.cancel();
  await new Promise((r) => setTimeout(r, 260));
  return { ran: true, during, after: { owner: b._saberOwner, away: !!b._saberAway,
    dist: +Math.hypot(b.weaponSprite.x - b.x, b.weaponSprite.y - b.y).toFixed(0),
    has: b.hasSaber(), canOpen: b.canOpenGuard() } };
});
await reset();

// I — A SECOND SABER-DEPENDENT MOVE cannot claim the blade while THROW owns it,
//     and FORCE PULL — which competes for nothing — is untouched.
cases.consumers = await run(async () => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss;
  // A refused call reads exactly like a failed one. Revive the player
  // (`_castBossMove` refuses outright once `player.alive` is false, and Vader
  // this close kills them inside a settle) and drop any handle left over.
  const p = gs.player;
  p.alive = true; p.setActive(true).setVisible(true).setAlpha(1); p.hp = p.hpMax;
  b._activeMove?.cancel?.(); b._activeMove = null;
  b._performing = false; b.state = 'idle'; b._moveT = 1e9;
  const h = gs._castBossMove(b, 'saberthrow');
  if (!h) return { ran: false };

  // Ask the OWNERSHIP gate, not `_castBossMove`'s pre-existing one-move-at-a-
  // time rule — that would refuse everything here and make all three answers
  // meaningless. The handle is put straight back, so the throw plays out.
  const probe = () => {
    const w = b.weaponSprite;
    const live = b._activeMove;
    const one = (id) => {
      b._activeMove = null; b._performing = false; b.state = 'idle';
      const got = gs._castBossMove(b, id);
      if (got) got.cancel();
      return !!got;
    };
    const out = {
      away: !!b._saberAway, owner: b._saberOwner,
      dist: +Math.hypot(w.x - b.x, w.y - b.y).toFixed(0),
      combo: one('sabercombo'), vanish: one('vanishslash'), pull: one('forcepull'),
    };
    b._activeMove = live; b._performing = true;
    return out;
  };

  // A — COMMITTED, BLADE STILL IN HIS HAND. The exact interval the handset bug
  //     lived in: the throw is running, `_saberAway` is still false, and the
  //     old possession-only test said the blade was available.
  await new Promise((r) => setTimeout(r, 120));
  const committed = probe();

  // B — IN FLIGHT. Polled rather than timed: at ~20fps the 700ms anticipate
  //     resolves anywhere up to a second late, and a fixed sleep photographed
  //     the wind-up and called it the flight.
  // Wait for the blade to be away AND to have travelled: `_saberAway` flips on
  // the first frame of the flight, when the sprite is still at his hand, so a
  // poll on the flag alone photographs the frame of departure and reports the
  // blade as 50px away — which is where it rests anyway.
  const gone = () => b._saberAway
    && Math.hypot(b.weaponSprite.x - b.x, b.weaponSprite.y - b.y) > 150;
  let flew = false;
  for (let i = 0; i < 120 && !gone(); i++) await new Promise((r) => setTimeout(r, 25));
  flew = gone();
  const inFlight = flew ? probe() : null;
  return { ran: true, committed, inFlight, flew };
});
await reset();

// D + the eligibility half of §5 — after the PHYSICAL return the blade is his
//     again and DEFLECTION opens on its ordinary cadence, with nothing added.
cases.afterReturn = await run(async () => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss;
  // A refused call reads exactly like a failed one. Revive the player
  // (`_castBossMove` refuses outright once `player.alive` is false, and Vader
  // this close kills them inside a settle) and drop any handle left over.
  const p = gs.player;
  p.alive = true; p.setActive(true).setVisible(true).setAlpha(1); p.hp = p.hpMax;
  b._activeMove?.cancel?.(); b._activeMove = null;
  b._performing = false; b.state = 'idle'; b._moveT = 1e9;
  const h = gs._castBossMove(b, 'saberthrow');
  if (!h) return { ran: false };
  let flew = false, homeAt = -1, byCatch = null;
  const t0 = gs.time.now;
  for (let i = 0; i < 200; i++) {
    if (b._saberAway) flew = true;
    if (flew && !b._saberAway) {
      homeAt = Math.round(gs.time.now - t0);
      // WHICH RETURN WAS IT? The blade coming home is the physical truth the
      // whole invariant is anchored to; the flight's hard cutoff is a safety
      // net that snaps it back. Restoring ownership off the net would be
      // restoring it for a reason that is not physical, so the case checks it.
      byCatch = gs.time.now <= (b._activeMove?.flyDeadline ?? h.flyDeadline ?? Infinity);
      break;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  return { ran: true, flew, homeAt, byCatch,
    owner: b._saberOwner, has: b.hasSaber(), canOpen: b.canOpenGuard() };
});
await reset();

// A stale claim cannot survive its claimant. Not reachable through any move —
// the watchdog exists for a claimant torn down between COMMIT and RETURN.
cases.watchdog = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss;
  // Absent on the build this replaces. Skipped rather than thrown, so an A/B
  // run fails on the game being wrong and not on a field not existing yet.
  if (typeof b.claimSaber !== 'function') return { skipped: true };
  const claimed = b.claimSaber('ghost');
  const during = { owner: b._saberOwner, has: b.hasSaber() };
  await new Promise((r) => setTimeout(r, 300));
  return { claimed, during, after: { owner: b._saberOwner, has: b.hasSaber() } };
});
await reset();

// ── FREE RUN — NOTHING SILENCED ──────────────────────────────────────────
// The post-mortem's first rule: never verify a new behaviour with the system it
// shares an actor with switched off. Every clock is handed back, the fight runs
// itself, and the only thing measured is the invariant.
const free = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game'), b = gs.boss, p = gs.player;
  b._activeMove?.cancel?.(); b._activeMove = null;
  b._performing = false; b.state = 'idle'; b.cooldown = 0; b._moveT = 600;
  b._reflectEvery = 9000; b._reflectT = 1200;
  b._blackoutT = 1e9; b._afterimageT = 1e9; b._disarmT = 1e9;
  // Absent on the build this replaces — the free run must measure the same
  // thing on both halves of an A/B.
  if (b.releaseSaber) b.releaseSaber(b._saberOwner); else b._saberAway = false;
  const seen = { frames: 0, threw: 0, opened: 0, bad: 0, worst: 0, sample: null };
  let wasAway = false, wasOpen = false;
  const tick = () => {
    if (!b.alive) return;
    const w = b.weaponSprite;
    const d = w?.active ? Math.hypot(w.x - b.x, w.y - b.y) : 0;
    seen.frames++;
    if (b._saberAway && !wasAway) seen.threw++;
    if (b.isReflecting() && !wasOpen) seen.opened++;
    wasAway = b._saberAway; wasOpen = b.isReflecting();
    // Same cross-check as the sweep — see the note there.
    if (b.isReflecting() && (b._saberAway || d > 300)) {
      seen.bad++;
      seen.worst = Math.max(seen.worst, Math.round(d));
      seen.sample ??= { move: b._activeMove?.move?.id ?? null, phase: b._activeMove?.phase ?? null,
                        owner: b._saberOwner, dist: Math.round(d) };
    }
  };
  gs.events.on('postupdate', tick);
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    // The measuring bot never dies — a death must not cut the measurement short.
    gs.lives = 9999;
    if (!p.alive) { p.alive = true; p.setActive(true).setVisible(true).setAlpha(1); }
    p.hp = p.hpMax;
    if (b.alive) b.hp = b.hpMax;              // and neither may he
    await new Promise((r) => setTimeout(r, 200));
  }
  gs.events.off('postupdate', tick);
  return seen;
});
console.log('\nFREE RUN (60s, nothing silenced):', JSON.stringify(free));

await browser.close();

const total = trials.reduce((n, t) => n + t.violations, 0);
const gateTotal = trials.reduce((n, t) => n + t.gate, 0);
// Vacuity gate: a run where the blade never left his hand, or where the guard
// never opened in any trial, proves nothing at all.
const flew = trials.some((t) => t.flying > 0);
const everOpened = trials.some((t) => t.opened);
if (!flew) fail('vacuous: the blade never left his hand in any trial');
if (!everOpened) fail('vacuous: DEFLECTION never opened in any trial');

if (gateTotal > 0) {
  console.error(`\nFAIL: the blade was claimable by a saber-dependent state on ${gateTotal} frames`);
  console.error('      in which a committed SABER THROW already owned it (hasSaber/canOpenGuard true).');
  console.error('      ONE SABER, ONE OWNER — ownership must transfer when the throw COMMITS,');
  console.error('      not when the sprite happens to detach 700ms later.');
  process.exit(1);
}
if (total > 0) {
  console.error(`\nFAIL: DEFLECTION was active while the blade was not Vader's on ${total} sampled frames.`);
  console.error('      ONE SABER, ONE OWNER — the guard claimed a blade a committed SABER THROW already owned.');
  process.exit(1);
}

// ── THE REGRESSION VERDICTS ──────────────────────────────────────────────
const bad = [];
const ok = (cond, label, detail) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
  if (!cond) bad.push(label);
};
console.log('');
ok(cases.cancel.ran, 'F  cancellation: the throw ran at all');
ok(cases.cancel.ran && cases.cancel.during.owner === 'saberthrow' && !cases.cancel.during.has,
   'F  cancellation: the throw owned the blade mid-flight', JSON.stringify(cases.cancel.during));
ok(cases.cancel.ran && cases.cancel.after.owner === 'vader' && cases.cancel.after.has
   && cases.cancel.after.canOpen && cases.cancel.after.dist < 80,
   'F  cancellation: ownership and the blade both came back', JSON.stringify(cases.cancel.after));

const cm = cases.consumers.committed || {}, fl = cases.consumers.inFlight || {};
ok(cases.consumers.ran && cm.owner === 'saberthrow' && cm.away === false,
   'I  committed but not yet detached: the throw owns a blade still in his hand',
   JSON.stringify(cm && { owner: cm.owner, away: cm.away, dist: cm.dist }));
ok(cases.consumers.ran && !cm.combo && !cm.vanish,
   'I  SABER COMBO and VANISH refused in that interval — the handset bug\'s window');
ok(cases.consumers.ran && cm.pull === true,
   'C  FORCE PULL still legal in that interval — it competes for nothing');
ok(cases.consumers.flew && fl.away === true && fl.dist > 120,
   'I  in flight: the blade really was away', JSON.stringify({ dist: fl.dist }));
ok(cases.consumers.flew && !fl.combo, 'I  SABER COMBO refused while the blade is in the air');
ok(cases.consumers.flew && !fl.vanish, 'I  VANISH SLASH refused while the blade is in the air');
ok(cases.consumers.flew && fl.pull === true, 'C  FORCE PULL still legal with the blade in the air');

ok(cases.afterReturn.ran && cases.afterReturn.flew && cases.afterReturn.homeAt > 0,
   'D  the blade physically returned', `at +${cases.afterReturn.homeAt}ms`);
// INFORMATIONAL, NOT A CHECK. Whether the blade is caught by the homing leg or
// snapped home by the flight's 4.5s safety cutoff is a reading of the machine's
// frame rate, not of the game: the timer integrates real elapsed time and this
// harness runs at ~20fps with several catch-up ticks resolving on one `now`.
// Both paths restore ownership and possession together, which is the claim.
console.log(`      (return path: ${cases.afterReturn.byCatch ? 'caught by the homing leg' : "the flight's safety cutoff — a frame-rate reading, see note"})`);
ok(cases.afterReturn.owner === 'vader' && cases.afterReturn.has && cases.afterReturn.canOpen,
   'D  DEFLECTION eligible again on the frame of the return — no extra cooldown',
   JSON.stringify(cases.afterReturn));

ok(!cases.watchdog.skipped && cases.watchdog.claimed && cases.watchdog.during.has === false,
   'G  a claim really takes the blade');
ok(!cases.watchdog.skipped && cases.watchdog.after.owner === 'vader' && cases.watchdog.after.has,
   'G  a claim whose claimant is gone is healed, not stranded', JSON.stringify(cases.watchdog.after));

ok(free.threw > 0, 'FREE RUN: he threw the saber', `${free.threw}x`);
ok(free.opened > 0, 'FREE RUN: DEFLECTION opened', `${free.opened}x`);
ok(free.bad === 0, 'FREE RUN: never deflecting with a blade that is not his',
   free.bad ? `${free.bad} frames, worst ${free.worst}px, ${JSON.stringify(free.sample)}` : '');

if (bad.length) { console.error(`\nFAIL: ${bad.length} regression case(s): ${bad.join(' | ')}`); process.exit(1); }
console.log('\nOK: no sampled frame had DEFLECTION active while the blade was away from Vader,');
console.log('    and every ownership transition held.');
