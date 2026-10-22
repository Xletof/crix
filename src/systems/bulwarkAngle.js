// THE FREE BULWARK'S TACTICAL ENGAGEMENT — PHASE T2 CANDIDATE, OPT-IN.
//
// `?bulwarkAngle=1`. Absent, nothing here is installed and the Bulwark is the
// frozen game. Installed per bearer from `GameScene.spawnEnemyAt` for the
// ordinary FREE `shielded` only — Regular and Elite — and never a VANGUARD
// screen (`vanguardScreen`, which every opener also carries), never a nemesis
// (`legacyArt`). `src/entities/Enemy.js` is NOT touched: this shadows the
// bearer's own `_tickSwarm`, calls it FIRST and unchanged, and only then — in
// one narrowly defined state — overrides the velocity it wrote. Independent of
// `?bulwarkStuck=`: that module reviews the base stuck check from the frozen
// tick's own `_moveToward` calls, which this never makes.
//
// THE DEFECT (Phase 3C-B, `docs/evidence/tactical-engagement-audit/`): the
// free Bulwark walks straight at the player until 290px (`desiredRange` + 30)
// and then stands, whether or not it can shoot from there — 20.1% of its life
// standing blind in a reconstructed MIXED, holds of 30s+, with a straight-line
// firing spot ~50px along its arc. Its shield and gun were never the problem.
//
// THE BULWARK IS NOT A MARKSMAN. A Marksman fixes a cut line by changing ANGLE
// at range; a Bulwark fixes it by PRESSING ROUND THE OBSTACLE with its shield
// still toward the player. So the search here (its own, below — the approved
// T1 search is frozen) looks for a spot at its CURRENT range or CLOSER, on the
// band [140, 280] (inside the frozen 290 hold, so arriving never flips the
// branch), within 60 degrees of its current bearing round the player, and
// pays for every radian it swings and every pixel it would give up. Only when
// nothing at its range or closer has a line and a walk does it look farther
// out, still inside the band — close behind a console the shadow can swallow
// its whole sweep, and a little farther out the same console casts a narrower
// one. The shield
// itself is the frozen class's: this never writes `_shieldFacing`, `_aim` or
// the turn rate, so walking round cover leaves the shield exactly as slow to
// follow as it ever was — a flank is still a flank.
//
// THE RULE: perceive -> decide -> move -> fight, as ONE action.
//   PERCEIVE  every AI tick: is the geometric line to the player cut
//             (`_hasLOS`, the fire gate's own test)? Concealment and range are
//             not geometry and walking does not solve them.
//   DECIDE    on the FIRST blind tick, search. No idle wait first. Commit after
//             a short confirmation that depends on the walk (150-250ms), held
//             while the player's own motion is about to bring them back into
//             the line (someone crossing behind a console reappears). One
//             exception, and it is a decision rather than a wait: a spot it has
//             been FIGHTING FROM (the line held >= 600ms without it moving) is
//             not given up the instant a MOVING target slips behind something —
//             it keeps the shield on them for up to 600ms and decides the
//             moment they stop or that runs out. A target circling a console
//             is out of sight for well under a second from a spot like that,
//             and chasing them round it trades a working line for a walk.
//   MOVE      one committed destination at the frozen speed, eased in, slowed
//             into the arrival, re-chosen only for a reason: the line opened,
//             the spot lost its line after a 450ms minimum (unless the target
//             is mid-crossing — then stop and watch), the walk failed (no
//             progress, a deadline; remembered 3s), or it arrived still blind.
//   BRACE     a player who keeps stepping out of every angle it walks to (three
//             target-caused re-plans inside 3s) is not chased round the
//             console: it holds its shield on them for 1.2s (1.8, then 2.4 if
//             the dance goes on with no shot between) and then looks again.
//   FIGHT     a line opens -> it stops (or finishes a short step to a spot that
//             still has the line) and the frozen gun takes over. A Bulwark with
//             a line is content to hold. Two things keep that from becoming
//             stop-go: a SLIVER of a line opening mid-walk (one a one-step
//             player shuffle would close) is not a place to stop — it finishes
//             the walk, firing on the way if it can — a line that closes
//             again within 400ms resumes the same walk with no new
//             confirmation, and a body that has only just stopped walking
//             decides on its first blind tick instead of confirming from a
//             standstill. KEEP and BRACE hold their ground.
// The firing pipeline is untouched — including the cooldown that does not run
// while the line is cut, which is MEASURED by the T2 rigs and not changed here.
// No `Math.random`, no scene listeners, no timers: state lives on the actor.

import { bodyPath, clearOf, route } from './firingSpot.js';

export const BULWARK_ANGLE = {
  confirmMinMs: 150,       // a one-step fix
  confirmMaxMs: 250,       // a long walk
  confirmPerPx: 0.25,      // ms of confirmation per px of planned travel
  transientLeadMs: 350,    // where the player's own motion puts them...
  transientCapMs: 520,     // ...trusted for at most this long
  bandLo: 140,             // never closer than the VANGUARD screen's own hold
  bandHiUnder: 10,         // band top = desiredRange + 30 - 10 = 280: inside the frozen hold
  radialSteps: [0, -40, -80],   // its current range, or closer, first...
  outSteps: [50, 100],     // ...and farther out (to the band top) ONLY when nothing closer has a line
  stepPx: 30,              // candidate spacing along each arc
  maxSweep: 1.05,          // rad (60 deg) round the player from its current bearing
  sweepCost: 80,           // px of cost per radian swung — the shield has to come round too
  outCost: 1.0,            // px of cost per px given up (backing off is not pressure)
  inCost: 0.15,            // px of cost per px closed
  robustPx: 45,            // a line that a one-step player shuffle breaks
  reversePx: 70,           // turning round on the side it just walked
  floorPx: 110,            // a walk never passes closer than this to the player
  navTop: 6,
  easeMs: 80,
  arriveSlowPx: 30, arrivePx: 8, waypointPx: 14,
  progressWindowMs: 180, progressMinFrac: 0.35,
  deadlineSlackMs: 600,
  failMemoryMs: 3000, failRadius: 50,
  leftRadius: 60, leftMemoryMs: 2500, selfRadius: 25,
  minCommitMs: 450, recheckMs: 120, retryMs: 250,
  sideMemoryMs: 2000,
  continueOpenPx: 60,      // a line opened en route: finish a step this short
  resumeMs: 400,           // a line that closes again this soon: resume the same walk
  keepRunMs: 600,          // a spot it has fought from: the line held this long...
  keepPx: 40,              // ...from within this distance of where it stands
  keepMaxMs: 600,          // keep it for a MOVING target for at most this long
  chaseWindowMs: 3000, chaseLimit: 3, braceMs: 1200, braceStepMs: 600, braceSteps: 2,
  braceHoldPx: 40,         // braced or keeping its spot just outside its hold: hold ground, not the frozen step-stop at 290
  takenPx: 70, crowdPx: 150, crowdPen: 60,
  leadMinSpeed: 60, leadMaxMs: 700, leadPen: 110,
  motionWindowMs: 250, motionMinMs: 100,
};
const C = BULWARK_ANGLE;

/** Per ordinary free Bulwark, once, from `spawnEnemyAt`. */
export function installBulwarkAngle(e) {
  if (e._bulwarkAngle) return;
  const M = e._bulwarkAngle = {
    clock: 0, state: 'idle', branch: 'hold', blindAt: null, plan: null, confirmMs: 0,
    commit: null, failed: [], lastSide: 0, lastEndAt: -1e9, lastFrom: null, lastFromAt: -1e9,
    vx: 0, vy: 0, retryAt: 0, steered: false, chase: [], braceUntil: -1, braceLevel: 0,
    trail: [], pv: { x: 0, y: 0 }, prevFireCd: null, run: null, lastRun: null, keepUntil: -1, resume: null, v0x: 0, v0y: 0,
    log: { episodes: 0, evals: 0, commits: 0, routed: 0, arrivals: 0, reacquired: 0, settled: 0,
      failedProgress: 0, failedDeadline: 0, replans: 0, reversals: 0, noSpot: 0, transientHeld: 0,
      branchKept: 0, branchReplan: 0, invalidReplan: 0, brace: 0, watched: 0, shots: 0, kept: 0, keptOut: 0,
      thinContinued: 0, resumed: 0 },
  };
  const tick = e._tickSwarm;     // the class's own method (or the stuck candidate's shadow of it)
  e._tickSwarm = function (delta, player) {
    // the motion the body really has, before the frozen tick writes its command
    M.v0x = this.body.velocity.x; M.v0y = this.body.velocity.y;
    const r = tick.call(this, delta, player);
    review(this, M, delta, player);
    return r;
  };
}

const speedOf = (e) => e.cfg.speed;   // the frozen approach speed, Regular or Elite, FRENZY and sector ramp included

function review(e, M, delta, P) {
  M.clock += delta;
  M.steered = false;
  track(e, M, P);
  // a shot just left (the frozen pipeline re-rolled its cooldown upward): the
  // dance is not winning, so the next brace starts short again
  if (M.prevFireCd != null && e.fireCd > M.prevFireCd + 50) { M.braceLevel = 0; M.log.shots++; }
  M.prevFireCd = e.fireCd;
  const dist = Math.hypot(P.x - e.x, P.y - e.y);
  // the frozen tick's own branch, from the same position (physics has not run)
  const branch = dist > e.cfg.desiredRange + 30 ? 'approach' : 'hold';
  M.branch = branch;
  const los = e._hasLOS(e.x, e.y, P.x, P.y);
  // the current run of line, and where it was held from
  if (los) { if (!M.run) M.run = { at: M.clock, x: e.x, y: e.y }; }
  else if (M.run) { M.lastRun = { ms: M.clock - M.run.at, x: M.run.x, y: M.run.y }; M.run = null; }
  if (los) {
    M.blindAt = null; M.keepUntil = -1;
    const K = M.commit;
    if (K && M.clock <= K.deadline && lineFrom(e, K, P)) {
      const short = remaining(e, K) <= C.continueOpenPx;
      if (short || !robustLine(e, P)) {
        // the line opened a step short of a spot that keeps it, or only as a
        // sliver a one-step shuffle would close: finish the walk (the gun
        // fires on the move; the pipeline is the frozen one)
        if (M.state !== 'settle' && !short) M.log.thinContinued++;
        M.state = 'settle';
        if (steer(e, M, delta)) { end(e, M); M.log.settled++; }
        return done(M);
      }
    }
    if (K) {
      // stopped for a real line; if it closes again at once, the same walk resumes
      M.resume = { K, until: M.clock + C.resumeMs };
      end(e, M); M.log.reacquired++;
    }
    M.state = 'line';
    return done(M);
  }
  // ── BLIND ──
  if (branch === 'approach' && e._stuckSidestepMs > 0) {
    // the approach's stuck recovery owns this step (frozen, or `?bulwarkStuck=`)
    if (M.commit) end(e, M);
    M.keepUntil = -1;
    M.state = 'sidestep';
    return done(M);
  }
  if (M.clock < M.braceUntil) {
    // holding the shield on them on purpose; the gun still fires the moment a
    // line opens. Just outside the frozen 290 hold the frozen tick would step
    // one tick and stand ten as the target shifts — braced, it holds its ground
    M.state = 'brace';
    holdGround(e, M, branch, dist);
    return done(M);
  }
  if (M.braceUntil > 0) { M.braceUntil = -1; M.blindAt = null; }
  if (M.blindAt == null && !M.commit && M.resume) {
    // the line it stopped for closed again at once: carry on with the same walk
    const Rs = M.resume; M.resume = null;
    if (M.clock <= Rs.until && lineFrom(e, Rs.K, P) && !taken(e, Rs.K.x, Rs.K.y) && remaining(e, Rs.K) > C.arrivePx) {
      const K = Rs.K, left = remaining(e, K);
      Object.assign(K, { at: M.clock, from: { x: e.x, y: e.y }, deadline: M.clock + left / speedOf(e) * 1000 + C.deadlineSlackMs,
        chkAt: M.clock, chkRem: left, recheckAt: M.clock + C.recheckMs });
      M.commit = K; e._angDest = { x: K.x, y: K.y }; M.plan = null;
      M.blindAt = M.clock; M.log.episodes++; M.log.resumed++;
      steer(e, M, delta); M.state = 'move';
      return done(M);
    }
  }
  if (M.blindAt == null) {
    // PERCEIVE + DECIDE on the first blind tick — no idle wait first
    M.blindAt = M.clock; M.log.episodes++;
    M.plan = search(e, M, P); M.log.evals++;
    M.confirmMs = M.plan ? Math.min(C.confirmMaxMs, C.confirmMinMs + M.plan.travel * C.confirmPerPx) : C.confirmMinMs;
    // a body that has only just stopped walking does not confirm from a standstill
    if (M.clock - M.lastEndAt <= C.resumeMs) M.confirmMs = 0;
    M.retryAt = M.clock;
    if (!M.commit) M.state = M.plan ? 'confirm' : 'noSpot';
    const R = M.lastRun;
    if (!M.commit && R && R.ms >= C.keepRunMs && Math.hypot(e.x - R.x, e.y - R.y) <= C.keepPx && moving(M)) {
      // a spot it has been fighting from, and the target is on the move
      M.keepUntil = M.clock + C.keepMaxMs; M.log.kept++;
    }
  }
  if (M.commit) {
    const K = M.commit;
    if (K.mode !== branch) {
      // hold <-> approach changes nothing about the plan: a destination that
      // still has its line stays the destination
      if (!lineFrom(e, K, P)) { M.log.branchReplan++; return replan(e, M, P, branch, delta); }
      K.mode = branch; M.log.branchKept++;
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
      const want = speedOf(e) * (M.clock - K.chkAt) / 1000;
      if (K.chkRem - rem < C.progressMinFrac * want) { M.log.failedProgress++; return fail(e, M, P, branch, delta); }
      K.chkAt = M.clock; K.chkRem = rem;
    }
    if (M.clock > K.deadline) { M.log.failedDeadline++; return fail(e, M, P, branch, delta); }
    if (steer(e, M, delta)) {
      // ARRIVED, still blind: the player has moved since the choice — go on,
      // the same way round if it still works, unless the target is crossing
      // back into the line from here (then stop and watch)
      M.log.arrivals++;
      end(e, M);
      if (chased(e, M)) return done(M);
      if (watch(e, M, P)) return done(M);
      return replan(e, M, P, branch, delta, K.side);
    }
    M.state = 'move';
    return done(M);
  }
  if (M.keepUntil > 0) {
    if (M.clock < M.keepUntil && moving(M)) { M.state = 'keep'; holdGround(e, M, branch, dist); return done(M); }
    // the target stopped, or did not come back out: the confirmation is spent — decide now
    M.keepUntil = -1; M.log.keptOut++;
    return replan(e, M, P, branch, delta);
  }
  // no commitment: confirm, then commit
  const blindFor = M.clock - M.blindAt;
  if (M.plan && blindFor >= M.confirmMs) {
    if (blindFor < C.transientCapMs && transient(e, M, P)) { M.log.transientHeld++; M.state = 'confirm'; return done(M); }
    const p = search(e, M, P);
    if (p) { commit(e, M, p, branch); steer(e, M, delta); M.state = 'move'; return done(M); }
    M.plan = null;
  }
  if (!M.plan && M.clock >= M.retryAt) {
    M.retryAt = M.clock + C.retryMs;
    const p = search(e, M, P); M.log.evals++;
    if (p && blindFor >= C.confirmMinMs) { commit(e, M, p, branch); steer(e, M, delta); M.state = 'move'; return done(M); }
    if (p) { M.plan = p; M.confirmMs = C.confirmMinMs; M.state = 'confirm'; return done(M); }
    M.log.noSpot++;
  }
  // STABLE FALLBACK: no spot gives a line. The frozen tick's own command stands
  // (the hold's zero velocity, or the approach's walk) and it looks again every
  // `retryMs` — never a thrash, never an unbounded search.
  if (!M.plan) M.state = 'noSpot';
  return done(M);
}

// KEEP and BRACE stand where they are: within `braceHoldPx` outside the frozen
// 290 hold the frozen approach would step one tick and stand ten as the target
// shifts; farther out it is a real approach and the frozen walk stands
function holdGround(e, M, branch, dist) {
  if (branch === 'approach' && dist <= e.cfg.desiredRange + 30 + C.braceHoldPx) { e.setVelocity(0, 0); M.vx = 0; M.vy = 0; M.steered = true; }
}

// the target walked out of another angle: is chasing still working?
function chased(e, M) {
  M.chase = M.chase.filter((t) => M.clock - t < C.chaseWindowMs);
  M.chase.push(M.clock);
  if (M.chase.length < C.chaseLimit) return false;
  end(e, M);
  M.chase = []; M.plan = null;
  M.braceUntil = M.clock + C.braceMs + C.braceStepMs * Math.min(M.braceLevel, C.braceSteps);
  M.braceLevel++;
  M.state = 'brace'; M.log.brace++;
  return true;
}

// the spot went stale because the TARGET is crossing, and their own motion is
// about to carry them into the line from right here: stop and watch rather than
// turn round after them (the confirmation's transient hold, capped, then a
// fresh search)
function watch(e, M, P) {
  if (!transient(e, M, P)) return false;
  end(e, M);
  M.blindAt = M.clock; M.plan = { watch: true, travel: 0 }; M.confirmMs = 0;
  M.log.watched++; M.state = 'confirm';
  return true;
}

// a velocity override happened this tick or the ease restarts from rest
function done(M) { if (!M.steered) { M.vx = 0; M.vy = 0; } }

function search(e, M, P) {
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
  const lead = Math.hypot(v.x, v.y) >= C.leadMinSpeed ? { vx: v.x, vy: v.y } : null;
  return findBulwarkSpot(e, P, {
    avoid, crowd: crowdL, lead,
    prefSide: M.clock - M.lastEndAt < C.sideMemoryMs ? M.lastSide : 0,
  });
}

// THE BULWARK'S OWN SEARCH. Candidates on arcs AROUND THE PLAYER at its current
// range or closer, within `maxSweep` of its current bearing, built only from
// what the game already trusts — `_standable`, `_hasLOS` (the fire gate's own
// test) and the body-wide straight walk / reachability-checked NavGrid route
// the approved T1 search uses (`bodyPath`, `route`, `clearOf`, shared and
// unchanged). Pure: reads the actor, the player, the room and the other
// bodies, writes nothing, and ties break on a fixed order.
export function findBulwarkSpot(e, P, o) {
  const d0 = Math.hypot(e.x - P.x, e.y - P.y) || 1;
  const lo = C.bandLo, hi = e.cfg.desiredRange + 30 - C.bandHiUnder;
  const anchor = Math.min(d0, hi);
  const ring = (steps, seen) => {
    const radii = [];
    for (const dr of steps) {
      const r = Math.max(lo, Math.min(hi, anchor + dr));
      if (![...seen, ...radii].some((q) => Math.abs(q - r) < 15)) radii.push(r);
    }
    return radii;
  };
  const near = ring(C.radialSteps, []);
  // CURRENT RANGE OR CLOSER FIRST. Only when none of that has a line and a walk
  // does it give ground — close behind a console the shadow can swallow its
  // whole sweep, and from a little farther out the same console casts a
  // narrower one (each pixel given up is still priced at `outCost`)
  return scanRing(e, P, o, near, d0) || scanRing(e, P, o, ring(C.outSteps, near), d0);
}

function scanRing(e, P, o, radii, d0) {
  if (!radii.length) return null;
  const px = P.x, py = P.y;
  const phi = Math.atan2(e.y - py, e.x - px);
  const bodyR = Math.max(e.body?.width || 0, e.body?.height || 0) / 2 || e.cfg.radius;
  const off = bodyR + 2;              // the WHOLE body clears
  const straight = [], other = [];
  for (const r of radii) {
    const kMax = Math.floor(C.maxSweep * r / C.stepPx);
    for (let k = 0; k <= kMax; k++) {
      for (const sg of k === 0 ? [0] : [1, -1]) {
        if (k === 0 && Math.abs(r - d0) < 15) continue;          // where it already stands
        const sweep = k * C.stepPx / r;
        const b = phi + sg * sweep;
        const cx = px + Math.cos(b) * r, cy = py + Math.sin(b) * r;
        if (!e._standable(cx, cy)) continue;
        if (o.avoid.some((a) => Math.hypot(a.x - cx, a.y - cy) < a.r)) continue;
        if (!e._hasLOS(cx, cy, px, py)) continue;
        // a line that survives the player taking one step either way
        const ux = px - cx, uy = py - cy, ul = Math.hypot(ux, uy) || 1;
        const lx = -uy / ul * 40, ly = ux / ul * 40;
        const robust = (e._hasLOS(cx, cy, px + lx, py + ly) ? 1 : 0) + (e._hasLOS(cx, cy, px - lx, py - ly) ? 1 : 0);
        const travel = Math.hypot(cx - e.x, cy - e.y);
        // where the player is going, from the motion they have NOW, by the time it arrives
        let lead = 0;
        if (o.lead) {
          const t = Math.min(C.leadMaxMs, travel / speedOf(e) * 1000) / 1000;
          if (!e._hasLOS(cx, cy, px + o.lead.vx * t, py + o.lead.vy * t)) lead = C.leadPen;
        }
        const radial = r > d0 ? (r - d0) * C.outCost : (d0 - r) * C.inCost;
        const pen = (2 - robust) * C.robustPx + radial + sweep * C.sweepCost
          + (o.prefSide && sg && sg !== o.prefSide ? C.reversePx : 0) + crowd(o.crowd, cx, cy) + lead;
        const c = { x: cx, y: cy, r, side: sg, sweep, robust, travel, pen };
        if (bodyPath(e, e.x, e.y, cx, cy, off) && clearOf(px, py, e.x, e.y, cx, cy, C.floorPx)) {
          c.cost = travel + pen; c.path = [{ x: cx, y: cy }];
          straight.push(c);
        } else other.push(c);
      }
    }
  }
  let best = null;
  for (const c of straight) if (!best || c.cost < best.cost) best = c;
  if (best || !e.scene.navGrid) return best;
  // NO STRAIGHT WALK: the nearest few by straight distance, routed on the grid
  other.sort((a, b) => a.travel - b.travel);
  for (const c of other.slice(0, C.navTop)) {
    const path = route(e, c, off);
    if (!path) continue;
    let L = 0, x = e.x, y = e.y, ok = true;
    for (const n of path) {
      if (!clearOf(px, py, x, y, n.x, n.y, C.floorPx)) { ok = false; break; }
      L += Math.hypot(n.x - x, n.y - y); x = n.x; y = n.y;
    }
    if (!ok) continue;
    c.cost = L + c.pen; c.path = path; c.travel = L; c.routed = true;
    if (!best || c.cost < best.cost) best = c;
  }
  return best;
}

function crowd(list, x, y) {
  let p = 0;
  for (const c of list) { const d = Math.hypot(c.x - x, c.y - y); if (d < c.r) p += c.pen * (1 - d / c.r); }
  return p;
}

function commit(e, M, p, mode) {
  if (M.lastSide && p.side && p.side !== M.lastSide && M.clock - M.lastEndAt < C.sideMemoryMs) M.log.reversals++;
  if (p.side) M.lastSide = p.side;
  M.commit = { x: p.x, y: p.y, path: p.path, wi: 0, mode, side: p.side, at: M.clock, from: { x: e.x, y: e.y },
    deadline: M.clock + p.travel / speedOf(e) * 1000 + C.deadlineSlackMs,
    chkAt: M.clock, chkRem: p.travel, recheckAt: M.clock + C.recheckMs, routed: !!p.routed };
  e._angDest = { x: p.x, y: p.y };
  M.plan = null;
  // the walk eases in from the speed the body already has ALONG it (its
  // previous walk, the frozen approach, or rest — read before the frozen tick
  // overwrote it) — never from a standstill it is not in, and never carrying
  // on in a direction it is leaving or into a face it is pressed on
  const wp = p.path[0], wx = wp.x - e.x, wy = wp.y - e.y, wl = Math.hypot(wx, wy) || 1;
  const along = e.body.blocked.none ? Math.max(0, (M.v0x * wx + M.v0y * wy) / wl) : 0;
  M.vx = wx / wl * along; M.vy = wy / wl * along;
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
function replan(e, M, P, branch, delta, prefSide) {
  if (M.commit) end(e, M);
  if (prefSide) M.lastSide = prefSide;
  const p = search(e, M, P); M.log.evals++;
  if (p) { M.log.replans++; commit(e, M, p, branch); steer(e, M, delta); M.state = 'move'; return done(M); }
  M.plan = null; M.retryAt = M.clock + C.retryMs; M.state = 'noSpot';
  M.log.noSpot++;
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
  const spd = speedOf(e) * (last ? Math.min(1, Math.max(0.3, d / C.arriveSlowPx)) : 1);
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

// a line from where it stands that survives the player taking one step either way
function robustLine(e, P) {
  const ux = P.x - e.x, uy = P.y - e.y, ul = Math.hypot(ux, uy) || 1;
  const lx = -uy / ul * 40, ly = ux / ul * 40;
  return e._hasLOS(e.x, e.y, P.x + lx, P.y + ly) && e._hasLOS(e.x, e.y, P.x - lx, P.y - ly);
}

function taken(e, x, y) {
  for (const o of e.scene.enemies.getChildren()) {
    if (o === e || !o.active || !o.alive) continue;
    if (Math.hypot(o.x - x, o.y - y) < C.takenPx) return true;
    if (o._angDest && Math.hypot(o._angDest.x - x, o._angDest.y - y) < C.takenPx) return true;
  }
  return false;
}

const moving = (M) => Math.hypot(M.pv.x, M.pv.y) >= C.leadMinSpeed;

// the player's own motion is about to carry them back into this line
function transient(e, M, P) {
  const v = M.pv;
  if (Math.hypot(v.x, v.y) < C.leadMinSpeed) return false;
  const t = C.transientLeadMs / 1000;
  return e._hasLOS(e.x, e.y, P.x + v.x * t, P.y + v.y * t);
}

// WHERE THE PLAYER IS GOING: their real displacement over the last quarter
// second on scene time, never one frame's velocity (a stop-start walker reads 0
// one frame and full speed the next — the T1 lesson). A gap longer than the
// window starts the estimate again.
function track(e, M, P) {
  const now = e.scene.time.now, T = M.trail;
  if (T.length && now - T[T.length - 1].t > C.motionWindowMs) T.length = 0;
  T.push({ t: now, x: P.x, y: P.y });
  while (T.length > 2 && now - T[1].t >= C.motionWindowMs) T.shift();
  const a = T[0], dt = (now - a.t) / 1000;
  if (now - a.t < C.motionMinMs) { M.pv.x = 0; M.pv.y = 0; return; }
  M.pv.x = (P.x - a.x) / dt; M.pv.y = (P.y - a.y) / dt;
}
