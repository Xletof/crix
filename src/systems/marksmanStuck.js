// THE ORDINARY MARKSMAN'S STUCK RECOVERY — PHASE 3C CANDIDATE, OPT-IN.
//
// `?marksmanStuck=prog` (Candidate A) or `?marksmanStuck=early` (Candidate
// B, below). Absent, nothing here is installed and the frozen base block runs
// exactly as it ships. Installed per bearer from `GameScene.spawnEnemyAt` for
// the ordinary `sniper` only — Regular and Elite — never a nemesis
// (`legacyArt`). `src/entities/Enemy.js` is NOT touched:
// this shadows two of the bearer's own methods, the shape of the approved
// Bulwark correction (`bulwarkStuck.js`, Phase 3B), which is a REFERENCE for
// lifecycle and RNG and not a template for the rule.
//
// THE BLOCK IT REVIEWS (`Enemy.preUpdate`, frozen): every 600ms,
// `moved = hypot(x - (_stuckRefX ?? x))`, and under 12px it arms a 600ms
// perpendicular sidestep (one random draw). Its ONE consumer is `_moveToward`,
// and the Marksman's tick (`EnemySniper._tickSwarm`) has three branches:
//   APPROACH  beyond desiredRange + 80 — `_moveToward` at 0.7x speed: the only
//             branch that can TAKE a sidestep;
//   HOLD      300..640 — `setVelocity(0, 0)`, on purpose, to aim and fire;
//   RETREAT   inside retreatRange — `setVelocity` straight away from the
//             player: a commanded move that never consumes a sidestep.
// Phase 3A measured 82% of its lateral motion and 125 of its 126 sharp turns
// as stuck sidesteps. Part A of Phase 3C pinned where they come from:
//   F1        the first check reads 0px (the reference starts undefined) after
//             ~60px of open approach — a 600ms, 62-69px skate at 0.6s;
//   HOLD      every check in the band arms; the next APPROACH (the player
//             stepped out past 640) takes it — the sideways skate on resume;
//   RETREAT   a retreat blocked by a wall arms too; if the player then breaks
//             out past 640, the APPROACH — the opposite direction to the
//             obstruction that earned it — takes it.
//
// THE RULE: commanded to APPROACH + genuinely unable to progress -> recover.
// It never arms and never draws a random number. The base block still runs,
// still decides and still makes its draw; this reviews each check at the top
// of the bearer's next AI tick (before `_moveToward` can read it) and STANDS
// THE ARM DOWN when:
//   F1        first check, and the body really moved >= 12px from its spawn
//             point (the Demolisher's approved re-measurement);
//   HOLD /    the window's decision time was under half APPROACH. Intent is
//   RETREAT   read from what the tick COMMANDED — a `_moveToward` call is an
//             approach; otherwise the velocity the tick just wrote (before any
//             physics step) is a retreat when non-zero and a hold when zero —
//             never from measured motion. A retreat is NOT called stationary:
//             it is a move the recovery cannot serve, because its consumer is
//             the approach, which runs the other way. Reported separately.
// Every other arm — an approach that made no progress — is kept, and the
// recovery (direction, 600ms, 1.1x the approach speed) is the base's own.
//
// CANDIDATE B ('early') — added on two failed tests, not to match the Bulwark.
// Candidate A's rule is about the WINDOW; two genuine-cover cases are decided
// by what the body is doing AT the check, and A loses both (measured,
// `docs/evidence/marksman-stuck-v3c/`):
//   KEEP      cover met INSIDE the first window (a console 90px ahead of the
//             spawn, contact at ~300ms): the F1 arm is the right call there,
//             and standing it down delayed real recovery by a whole window
//             (activation 283 -> 883ms Regular, 450 -> 1050ms Elite).
//   ARM       cover met head-on after a window that moved: the base reads
//             >= 12px and declines, and recovery waits another window while
//             it grinds (post-contact activation ~800-1067ms). The frozen
//             game hid this behind its false F1 skate, which happened to
//             offset the approach before it reached the cover; without it A
//             reached the band later on every head-on case and the Elite
//             cleared a 320px wall 1 time in 6 against the frozen 4.
// So B never stands an arm down while the body is APPROACH-PINNED at the
// check, and arms a check the base declined when it is — at the base's own
// instant, for the base's own 600ms, in the direction the base last drew
// (`_stuckSideDir`): NO new random draw, and the recovery is unchanged.
// "Approach-pinned" is physics evidence (`body.blocked`) plus the AI's own
// command, and BOTH halves are the approach's:
//   pressing  the last step was an approach into a face the body is blocked
//             on, head-on enough to keep under 30% of its progress;
//   pinned    an unbroken run of >= 50ms of approach steps in contact that
//             made under 30% of their commanded progress.
// Two Marksman-specific limits. A RETREAT is never evidence — it is commanded
// with `setVelocity`, not `_moveToward`, and the recovery runs on the approach,
// the other way — so a blocked retreat is stood down exactly as in A. And a
// step that CONSUMED a sidestep is not an approach either: it is the recovery
// itself, travelling across the target, so it breaks the run rather than
// re-arming the same direction into whatever stopped it.
//
// The sniper's weapon (charge, LOS, laser, lock, shot, cooldown) is not read
// or written here, in either candidate.

export const MARKSMAN_STUCK = {
  minMovePx: 12,       // the base block's own threshold (read-only mirror)
  approachFrac: 0.5,   // under this share of approach-commanded decision time = not an approach window
  minDecideMs: 100,    // a window with less AI decision time than this is left to the base
  pinMs: 200,          // B: the step history kept for "pinned right now"
  pinRunMs: 50,        // B: an approach-pinned run must be at least this long
  pinProgFrac: 0.3,    // B: and have made under this share of its commanded progress
};

/** Per ordinary Marksman, once, from `spawnEnemyAt`. `x0/y0` is the spawn point. */
export function installMarksmanStuck(e, mode, x0, y0) {
  if (e._marksmanStuck || (mode !== 'prog' && mode !== 'early')) return;
  const S = e._marksmanStuck = {
    mode, ox: x0, oy: y0, first: true, lastTimer: undefined,
    winDecide: 0, winApproach: 0, winRetreat: 0, winHold: 0,
    approached: false,
    app: false, ux: 0, uy: 0, sp: 0,          // B: this tick's approach (not a sidestep), unit vector, speed
    papp: false, pux: 0, puy: 0, psp: 0, pdt: 0,
    px: null, py: null, recent: [],
    log: { checks: 0, armed: 0, stoodF1: 0, stoodHold: 0, stoodRetreat: 0, kept: 0, retreatBlocked: 0, keptPinned: 0, armedPinned: 0 },
  };
  const tick = e._tickSwarm;     // the class's own methods, unchanged
  const move = e._moveToward;
  e._moveToward = function (tx, ty, speed) {
    S.approached = true;
    if (!(this._stuckSidestepMs > 0)) {      // an approach step, not the recovery
      const d = Math.hypot(tx - this.x, ty - this.y) || 1;
      S.app = true; S.ux = (tx - this.x) / d; S.uy = (ty - this.y) / d; S.sp = speed;
    }
    return move.call(this, tx, ty, speed);
  };
  e._tickSwarm = function (delta, player) {
    review(this, S);
    S.approached = false; S.app = false;
    const r = tick.call(this, delta, player);
    S.winDecide += delta;
    if (S.approached) S.winApproach += delta;
    else {
      // the velocity this tick just wrote: the command, before physics runs
      const v = this.body.velocity;
      if (Math.hypot(v.x, v.y) > 1) S.winRetreat += delta; else S.winHold += delta;
    }
    S.papp = S.app; S.pux = S.ux; S.puy = S.uy; S.psp = S.sp; S.pdt = delta;
    return r;
  };
}

// The top of the bearer's AI tick: the base block has already run this frame.
function review(e, S) {
  if (S.mode === 'early') {
    // what the last physics step did with the previous tick's command
    if (S.px != null) {
      const dx = e.x - S.px, dy = e.y - S.py;
      S.recent.push({ dt: S.pdt, app: S.papp, hit: !e.body.blocked.none, prog: S.papp ? dx * S.pux + dy * S.puy : 0, sp: S.psp });
      let t = 0;
      for (let i = S.recent.length - 1; i >= 0; i--) { t += S.recent[i].dt; if (t > MARKSMAN_STUCK.pinMs) { S.recent.splice(0, i); break; } }
    }
    S.px = e.x; S.py = e.y;
  }
  // did the base block's 600ms check run since the last review? (its timer resets)
  const t = e._stuckTimer;
  const checked = S.lastTimer !== undefined && t !== undefined && t < S.lastTimer;
  S.lastTimer = t;
  if (!checked) return;
  S.log.checks++;
  // a fresh arm is ~600; anything left over from the previous window is ~0
  if (e._stuckSidestepMs > 500) {
    S.log.armed++;
    let stand = null;
    if (S.first && Math.hypot(e._stuckRefX - S.ox, e._stuckRefY - S.oy) >= MARKSMAN_STUCK.minMovePx) stand = 'F1';
    else if (S.winDecide >= MARKSMAN_STUCK.minDecideMs && S.winApproach < MARKSMAN_STUCK.approachFrac * S.winDecide) {
      stand = S.winRetreat > S.winHold ? 'Retreat' : 'Hold';
    }
    if (stand && S.mode === 'early' && (pressing(e, S) || pinned(S))) { stand = null; S.log.keptPinned++; }
    if (stand) {
      e._stuckSidestepMs = 0;
      S.log['stood' + stand]++;
      if (stand === 'Retreat') S.log.retreatBlocked++;   // a commanded retreat that did not move: the base has no recovery for it
    } else S.log.kept++;
  } else if (S.mode === 'early' && e._stuckSideDir !== undefined && pinned(S)) {
    e._stuckSidestepMs = 600;   // the base's own length; its last drawn direction
    S.log.armedPinned++;
  }
  S.first = false;
  S.winDecide = 0; S.winApproach = 0; S.winRetreat = 0; S.winHold = 0;
}

// B, to keep an arm: the step that just ran was an APPROACH into a face the
// body is blocked on (or the world bound), head-on enough to leave it under
// 30% of its commanded progress.
function pressing(e, S) {
  if (!S.papp) return false;
  const b = e.body.blocked;
  if (b.none) return false;
  const bx = (b.right && S.pux > 0) || (b.left && S.pux < 0) ? S.pux : 0;
  const by = (b.down && S.puy > 0) || (b.up && S.puy < 0) ? S.puy : 0;
  return 1 - bx * bx - by * by < MARKSMAN_STUCK.pinProgFrac;
}

// B: approach steps, in contact, not getting anywhere — an unbroken run of at
// least `pinRunMs`. A hold, a retreat or a sidestep step ends the run.
function pinned(S) {
  let t = 0, prog = 0, want = 0;
  for (let i = S.recent.length - 1; i >= 0; i--) {
    const s = S.recent[i];
    if (!s.app || !s.hit) break;
    t += s.dt; prog += s.prog; want += s.sp * s.dt / 1000;
  }
  return t >= MARKSMAN_STUCK.pinRunMs && prog < MARKSMAN_STUCK.pinProgFrac * want;
}
