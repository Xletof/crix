// THE ORDINARY MARKSMAN'S FIRING-ANGLE RECOVERY — PHASE 3C-T1 CANDIDATE, OPT-IN.
//
// `?marksmanAngle=1`. Absent, nothing here is installed and the Marksman is
// the frozen game. Installed per bearer from `GameScene.spawnEnemyAt` for the
// ordinary `sniper` only — Regular and Elite — never a nemesis (`legacyArt`).
// `src/entities/Enemy.js` is NOT touched: this shadows the bearer's own
// `_tickSwarm`, calls it FIRST and unchanged, and only then — in one narrowly
// defined state — overrides the velocity it wrote. Independent of
// `?marksmanStuck=`: that module reviews the base stuck check from the
// velocity the frozen tick writes, which is read before anything here runs.
//
// THE DEFECT (Phase 3C-B, `docs/evidence/tactical-engagement-audit/`): the
// frozen HOLD (300..640px) is a pure distance rule. It never asks whether a
// shot exists from where it stands, so a Marksman behind a console with the
// line cut stood READY (its cooldown counts down blind) for as long as the
// player stayed hidden — 42.6% of its life in a reconstructed MIXED, 34s
// waits — while a firing spot was a median 40px step along its own arc.
//
// THE RULE: perceive -> decide -> move -> acquire -> fight, as ONE action.
//   PERCEIVE  every AI tick: is the geometric line to the player cut
//             (`_hasLOS`, the fire gate's own test)? Concealment and range are
//             not geometry and moving does not solve them, so they are not
//             this module's business.
//   DECIDE    on the FIRST blind tick, search (`findFiringSpot`: its own band,
//             about its own range, a line from there, a body-wide straight walk
//             or a NavGrid route — and, against a MOVING player, a line to where
//             their current velocity puts them by the time it arrives, so it
//             does not walk two steps toward the side they are leaving and turn
//             round). No idle wait first. The commitment then
//             follows a SHORT confirmation that depends on the situation, not
//             on a clock: 140ms for a one-step fix up to 260ms for a long walk,
//             and held while the player's own motion is about to carry them
//             back into the line (projected 350ms ahead) — someone crossing
//             behind a console reappears; someone hiding behind it does not.
//   MOVE      commit and walk at once — eased in over ~60ms, arriving with a
//             slow-in — facing the player the whole way (the frozen tick sets
//             the aim). A commitment is only abandoned for a REASON: the line
//             opened, the branch changed (retreat always wins), the spot lost
//             its line after a 450ms minimum commitment, or the walk failed
//             (no progress, a deadline) — and a failed spot is remembered for
//             3s so it is not chosen again. None of those leaves it standing:
//             the next spot is searched in the same tick.
//   OVERWATCH a player who keeps stepping out of every angle it walks to (a
//             line lost to the TARGET's movement three times inside 3s — not a
//             clock, the evidence that chasing is not working) is not chased
//             round the console for ever: it holds the angle it has for 1.4s,
//             watching, then looks again at once. If the dance goes on with no
//             shot in between it settles longer each time (2.2s, then 3.0s);
//             the first line it gets resets that. Someone 2.5x faster can
//             always keep a small console between them and a walker; covering
//             the ground they must cross is what a marksman does about that.
//   FIGHT     a line opens -> the frozen weapon takes over unchanged. While
//             charging, nothing here runs: the 800ms windup, 260ms lock, laser,
//             locked angle, LOS cancel and its 500ms re-arm are the frozen
//             code's, and the body stands to shoot.
// No `Math.random`, no scene listeners, no timers: state lives on the actor
// and dies with it.

import { findFiringSpot } from './firingSpot.js';

export const MARKSMAN_ANGLE = {
  confirmMinMs: 140,       // a one-step fix
  confirmMaxMs: 260,       // a long walk
  confirmPerPx: 0.25,      // ms of confirmation per px of planned travel
  transientLeadMs: 350,    // where the player's own motion puts them...
  transientCapMs: 520,     // ...trusted for at most this long
  bandLoOver: 40,          // band = [retreatRange + 40, desiredRange + 50]: inside the
  bandHiOver: 50,          //   frozen thresholds, so arriving never flips the branch
  approachROver: 20,       // a blind approach heads for a spot at desiredRange + 20
  holdSpeed: 1.0,          // x cfg.speed — the frozen retreat speed
  approachSpeed: 0.7,      // x cfg.speed — the frozen approach speed
  easeMs: 60,
  arriveSlowPx: 30, arrivePx: 8, waypointPx: 14,
  progressWindowMs: 180, progressMinFrac: 0.35,
  deadlineSlackMs: 600,
  failMemoryMs: 3000, failRadius: 50,
  leftRadius: 60, leftMemoryMs: 2500, selfRadius: 25,
  minCommitMs: 450, recheckMs: 120, retryMs: 250,
  sideMemoryMs: 2000,
  continueOpenPx: 90,      // a line opened en route: finish a walk this short
  chaseWindowMs: 3000, chaseLimit: 3, overwatchMs: 1400, overwatchStepMs: 800, overwatchSteps: 2,
  takenPx: 60, crowdPx: 140, crowdPen: 60,
  leadMinSpeed: 60, leadMaxMs: 700, leadPen: 110,   // a spot that loses the line before the body arrives
  motionWindowMs: 250, motionMinMs: 100,           // the player's motion: real displacement over this window
  stepPx: 36, maxLateralPx: 504, robustPx: 45, radialCost: 0.25, reversePx: 70, floorOver: 15, navTop: 6,
};

/** Per ordinary Marksman, once, from `spawnEnemyAt`. */
export function installMarksmanAngle(e) {
  if (e._marksmanAngle) return;
  const M = e._marksmanAngle = {
    clock: 0, state: 'idle', branch: 'hold', blindAt: null, plan: null, confirmMs: 0,
    commit: null, failed: [], lastSide: 0, lastEndAt: -1e9, lastFrom: null, lastFromAt: -1e9,
    vx: 0, vy: 0, retryAt: 0, steered: false, chase: [], overwatchUntil: -1, owLevel: 0, trail: [], pv: { x: 0, y: 0 },
    log: { episodes: 0, evals: 0, commits: 0, routed: 0, arrivals: 0, reacquired: 0, settled: 0,
      failedProgress: 0, failedDeadline: 0, replans: 0, reversals: 0, noSpot: 0, transientHeld: 0,
      retreatPreempt: 0, chargePreempt: 0, branchReplan: 0, invalidReplan: 0, overwatch: 0, arrivedNoSpot: 0, watched: 0, branchKept: 0 },
  };
  const tick = e._tickSwarm;     // the class's own method (or the stuck candidate's shadow of it)
  e._tickSwarm = function (delta, player) {
    const r = tick.call(this, delta, player);
    review(this, M, delta, player);
    return r;
  };
}

const C = MARKSMAN_ANGLE;
const speedOf = (e, mode) => e.cfg.speed * (mode === 'approach' ? C.approachSpeed : C.holdSpeed);

function review(e, M, delta, P) {
  M.clock += delta;
  M.steered = false;
  track(e, M, P);
  const cfg = e.cfg;
  const dist = Math.hypot(P.x - e.x, P.y - e.y);
  // the frozen tick's own branch, from the same position (physics has not run)
  const branch = dist < cfg.retreatRange ? 'retreat' : dist > cfg.desiredRange + 80 ? 'approach' : 'hold';
  M.branch = branch;
  if (branch === 'retreat') {
    // RETREAT ALWAYS WINS: the frozen retreat runs untouched
    if (M.commit) { end(e, M); M.log.retreatPreempt++; }
    M.state = 'retreat';
    return done(M);
  }
  if (e._charging) {
    // THE WEAPON OWNS THE BODY: it only charges with a line, and stands to do it
    if (M.commit) { end(e, M); M.log.chargePreempt++; }
    M.owLevel = 0;
    M.blindAt = null; M.state = 'charge';
    return done(M);
  }
  const los = e._hasLOS(e.x, e.y, P.x, P.y);
  if (los) {
    M.blindAt = null;
    if (M.commit && M.commit.mode === 'hold' && remaining(e, M.commit) <= C.continueOpenPx && lineFrom(e, M.commit, P)) {
      // the line opened a step short of a better spot: finish the step while
      // the weapon cycles (a ready weapon would already be charging)
      M.state = 'settle';
      if (steer(e, M, delta)) { end(e, M); M.log.settled++; }
      return done(M);
    }
    if (M.commit) { end(e, M); M.log.reacquired++; }
    M.state = 'line';
    return done(M);
  }
  // ── BLIND ──
  if (branch === 'approach' && e._stuckSidestepMs > 0) {
    // the approach's stuck recovery owns this step (frozen, or `?marksmanStuck=`)
    if (M.commit) end(e, M);
    M.state = 'sidestep';
    return done(M);
  }
  if (M.clock < M.overwatchUntil) {
    // holding an angle on purpose; the weapon still fires the moment a line opens
    M.state = 'overwatch';
    return done(M);
  }
  if (M.overwatchUntil > 0) { M.overwatchUntil = -1; M.blindAt = null; }
  if (M.blindAt == null) {
    // PERCEIVE + DECIDE on the first blind tick — no idle wait first
    M.blindAt = M.clock; M.log.episodes++;
    M.plan = search(e, M, P, branch); M.log.evals++;
    M.confirmMs = M.plan ? Math.min(C.confirmMaxMs, C.confirmMinMs + M.plan.travel * C.confirmPerPx) : C.confirmMinMs;
    M.retryAt = M.clock;
    if (!M.commit) M.state = M.plan ? 'confirm' : 'noSpot';
  }
  if (M.commit) {
    const K = M.commit;
    if (K.mode !== branch) {
      // hold <-> approach only changes the frozen walking speed: a destination
      // that still has its line is still the plan (a player hovering on the
      // 720px boundary must not re-aim the walk every few frames)
      if (!lineFrom(e, K, P)) { M.log.branchReplan++; return replan(e, M, P, branch, delta); }
      K.mode = branch; M.log.branchKept++;
      K.deadline = M.clock + remaining(e, K) / speedOf(e, branch) * 1000 + C.deadlineSlackMs;
      K.chkAt = M.clock; K.chkRem = remaining(e, K);
    }
    if (M.clock >= K.recheckAt) {
      K.recheckAt = M.clock + C.recheckMs;
      const stale = !lineFrom(e, K, P) || taken(e, K.x, K.y);
      if (stale && M.clock - K.at >= C.minCommitMs) {
        M.log.invalidReplan++;
        if (chased(e, M)) return done(M);
        if (watch(e, M, P)) return done(M);
        return replan(e, M, P, branch, delta, K.side);
      }
    }
    if (M.clock >= K.chkAt + C.progressWindowMs) {
      const rem = remaining(e, K);
      const want = speedOf(e, K.mode) * (M.clock - K.chkAt) / 1000;
      if (K.chkRem - rem < C.progressMinFrac * want) { M.log.failedProgress++; return fail(e, M, P, branch, delta); }
      K.chkAt = M.clock; K.chkRem = rem;
    }
    if (M.clock > K.deadline) { M.log.failedDeadline++; return fail(e, M, P, branch, delta); }
    if (steer(e, M, delta)) {
      // ARRIVED, still blind: the player has moved since the choice — go on,
      // the same way round if it still works, without stopping to think
      M.log.arrivals++;
      end(e, M);
      if (chased(e, M)) return done(M);
      if (watch(e, M, P)) return done(M);
      return replan(e, M, P, branch, delta, K.side, true);
    }
    M.state = 'move';
    return done(M);
  }
  // no commitment: confirm, then commit
  const blindFor = M.clock - M.blindAt;
  if (M.plan && blindFor >= M.confirmMs) {
    // someone crossing behind cover is about to come out: their own motion says so
    if (blindFor < C.transientCapMs && transient(e, M, P)) { M.log.transientHeld++; M.state = 'confirm'; return done(M); }
    const p = search(e, M, P, branch);
    if (p) { commit(e, M, p, branch); steer(e, M, delta); M.state = 'move'; return done(M); }
    M.plan = null;
  }
  if (!M.plan && M.clock >= M.retryAt) {
    M.retryAt = M.clock + C.retryMs;
    const p = search(e, M, P, branch); M.log.evals++;
    if (p && blindFor >= C.confirmMinMs) { commit(e, M, p, branch); steer(e, M, delta); M.state = 'move'; return done(M); }
    if (p) { M.plan = p; M.confirmMs = C.confirmMinMs; M.state = 'confirm'; return done(M); }
    M.log.noSpot++;
  }
  // STABLE FALLBACK: no spot gives a line. HOLD as the frozen game does (or,
  // in the approach band, the frozen approach keeps walking) and look again
  // every `retryMs` — never a thrash, never an unbounded search.
  if (!M.plan) M.state = 'noSpot';
  return done(M);
}

// the target walked out of another angle: is chasing still working?
function chased(e, M) {
  M.chase = M.chase.filter((t) => M.clock - t < C.chaseWindowMs);
  M.chase.push(M.clock);
  if (M.chase.length < C.chaseLimit) return false;
  end(e, M);
  M.chase = []; M.plan = null;
  M.overwatchUntil = M.clock + C.overwatchMs + C.overwatchStepMs * Math.min(M.owLevel, C.overwatchSteps);
  M.owLevel++;
  M.state = 'overwatch'; M.log.overwatch++;
  return true;
}

// the spot went stale because the TARGET is crossing, and their own motion is
// about to carry them into the line from right here: stop and watch rather than
// turn round after them. It re-enters the episode's confirmation, so the
// transient hold is still capped and a fresh search follows it.
function watch(e, M, P) {
  if (!transient(e, M, P)) return false;
  end(e, M);
  M.blindAt = M.clock; M.plan = { watch: true, travel: 0 }; M.confirmMs = 0;
  M.log.watched++; M.state = 'confirm';
  return true;
}

// a velocity override happened this tick or the ease restarts from rest
function done(M) { if (!M.steered) { M.vx = 0; M.vy = 0; } }

function search(e, M, P, branch) {
  const cfg = e.cfg;
  const band = [cfg.retreatRange + C.bandLoOver, cfg.desiredRange + C.bandHiOver];
  const avoid = [], crowdL = [];
  for (const o of e.scene.enemies.getChildren()) {
    if (o === e || !o.active || !o.alive) continue;
    avoid.push({ x: o.x, y: o.y, r: C.takenPx });
    crowdL.push({ x: o.x, y: o.y, r: C.crowdPx, pen: C.crowdPen });
    const cl = o._angDest || o._dest;
    if (cl) { avoid.push({ x: cl.x, y: cl.y, r: C.takenPx }); crowdL.push({ x: cl.x, y: cl.y, r: C.crowdPx, pen: C.crowdPen }); }
  }
  M.failed = M.failed.filter((f) => f.until > M.clock);
  for (const f of M.failed) avoid.push({ x: f.x, y: f.y, r: C.failRadius });
  if (M.lastFrom && M.clock - M.lastFromAt < C.leftMemoryMs) avoid.push({ x: M.lastFrom.x, y: M.lastFrom.y, r: C.leftRadius });
  avoid.push({ x: e.x, y: e.y, r: C.selfRadius });
  const v = M.pv;
  const lead = Math.hypot(v.x, v.y) >= C.leadMinSpeed ? { vx: v.x, vy: v.y, speed: speedOf(e, branch), maxMs: C.leadMaxMs, pen: C.leadPen } : null;
  return findFiringSpot(e, P, {
    lead,
    band, anchorR: branch === 'approach' ? cfg.desiredRange + C.approachROver : undefined, prefR: cfg.desiredRange,
    radialSteps: branch === 'approach' ? [0, -60] : [0, -60, 60],
    stepPx: C.stepPx, maxLateralPx: C.maxLateralPx, robustPx: C.robustPx, radialCost: C.radialCost,
    reversePx: C.reversePx, prefSide: M.clock - M.lastEndAt < C.sideMemoryMs ? M.lastSide : 0,
    floorPx: cfg.retreatRange + C.floorOver, avoid, crowd: crowdL, navFallback: true, navTop: C.navTop,
  });
}

function commit(e, M, p, mode) {
  if (M.lastSide && p.side && p.side !== M.lastSide && M.clock - M.lastEndAt < C.sideMemoryMs) M.log.reversals++;
  if (p.side) M.lastSide = p.side;
  M.commit = { x: p.x, y: p.y, path: p.path, wi: 0, mode, side: p.side, at: M.clock, from: { x: e.x, y: e.y },
    deadline: M.clock + p.travel / speedOf(e, mode) * 1000 + C.deadlineSlackMs,
    chkAt: M.clock, chkRem: p.travel, recheckAt: M.clock + C.recheckMs, routed: !!p.routed };
  e._angDest = { x: p.x, y: p.y };
  M.plan = null;
  M.log.commits++; if (p.routed) M.log.routed++;
}

function end(e, M) {
  const K = M.commit;
  if (!K) return;
  M.lastFrom = K.from; M.lastFromAt = M.clock; M.lastEndAt = M.clock;
  M.commit = null; e._angDest = null;
}

function fail(e, M, P, branch, delta) {
  const K = M.commit;
  M.failed.push({ x: K.x, y: K.y, until: M.clock + C.failMemoryMs });
  end(e, M);
  return replan(e, M, P, branch, delta);
}

// the next spot, in the same tick — a failure or an arrival is not a pause
function replan(e, M, P, branch, delta, prefSide, arrived = false) {
  const K = M.commit;
  if (K) end(e, M);
  if (prefSide) M.lastSide = prefSide;
  const p = search(e, M, P, branch); M.log.evals++;
  if (p) { M.log.replans++; commit(e, M, p, branch); steer(e, M, delta); M.state = 'move'; return done(M); }
  M.plan = null; M.retryAt = M.clock + C.retryMs; M.state = 'noSpot';
  M.log.noSpot++;
  if (arrived) M.log.arrivedNoSpot = (M.log.arrivedNoSpot || 0) + 1;
  return done(M);
}

// walk the committed path; true on arrival at its last point
function steer(e, M, delta) {
  const K = M.commit;
  let wp = K.path[K.wi];
  while (K.wi < K.path.length - 1 && Math.hypot(wp.x - e.x, wp.y - e.y) < C.waypointPx) wp = K.path[++K.wi];
  const dx = wp.x - e.x, dy = wp.y - e.y, d = Math.hypot(dx, dy);
  const last = K.wi === K.path.length - 1;
  if (last && d <= C.arrivePx) return true;
  const spd = speedOf(e, K.mode) * (last ? Math.min(1, Math.max(0.3, d / C.arriveSlowPx)) : 1);
  const k = 1 - Math.exp(-delta / C.easeMs);
  M.vx += (dx / d * spd - M.vx) * k; M.vy += (dy / d * spd - M.vy) * k;
  e.setVelocity(M.vx, M.vy);
  M.steered = true;
  return false;
}

function remaining(e, K) {
  let L = 0, x = e.x, y = e.y;
  for (let i = K.wi; i < K.path.length; i++) { L += Math.hypot(K.path[i].x - x, K.path[i].y - y); x = K.path[i].x; y = K.path[i].y; }
  return L;
}

const lineFrom = (e, K, P) => e._hasLOS(K.x, K.y, P.x, P.y);

function taken(e, x, y) {
  for (const o of e.scene.enemies.getChildren()) {
    if (o === e || !o.active || !o.alive) continue;
    if (Math.hypot(o.x - x, o.y - y) < C.takenPx) return true;
    if (o._angDest && Math.hypot(o._angDest.x - x, o._angDest.y - y) < C.takenPx) return true;
  }
  return false;
}

// the player's own motion is about to carry them back into this line
function transient(e, M, P) {
  const v = M.pv;
  if (Math.hypot(v.x, v.y) < C.leadMinSpeed) return false;
  const t = C.transientLeadMs / 1000;
  return e._hasLOS(e.x, e.y, P.x + v.x * t, P.y + v.y * t);
}

// WHERE THE PLAYER IS GOING, as a person reads it: their real displacement over
// the last quarter second, not one frame's velocity — a stop-start walker's
// instantaneous velocity is 0 one frame and full speed the next. Displacement
// over SCENE time, so frames without an AI tick (a stagger) cannot fake a
// sprint; a gap longer than the window starts the estimate again.
function track(e, M, P) {
  const now = e.scene.time.now, T = M.trail;
  if (T.length && now - T[T.length - 1].t > C.motionWindowMs) T.length = 0;
  T.push({ t: now, x: P.x, y: P.y });
  while (T.length > 2 && now - T[1].t >= C.motionWindowMs) T.shift();
  const a = T[0], dt = (now - a.t) / 1000;
  if (now - a.t < C.motionMinMs) { M.pv.x = 0; M.pv.y = 0; return; }
  M.pv.x = (P.x - a.x) / dt; M.pv.y = (P.y - a.y) / dt;
}

