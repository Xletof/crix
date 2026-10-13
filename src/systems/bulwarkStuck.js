// THE ORDINARY BULWARK'S STUCK RECOVERY — PHASE 3B CANDIDATE, OPT-IN.
//
// `?bulwarkStuck=prog` (Candidate A) or `?bulwarkStuck=early` (Candidate B).
// Absent, nothing here is installed and the frozen base block runs exactly as
// it ships. Installed per bearer from `GameScene.spawnEnemyAt`, for the
// ordinary `shielded` only — free, VANGUARD screen and opening pair, Regular
// and Elite — and never a nemesis (`legacyArt`). `src/entities/Enemy.js` is
// NOT touched: this shadows two of the bearer's own methods, the same way
// `bulwarkFacing.js` shadows its facing.
//
// THE BLOCK IT CORRECTS (`Enemy.preUpdate`, frozen): every 600ms,
// `moved = hypot(x - (_stuckRefX ?? x))`, and under 12px it arms a 600ms
// perpendicular sidestep (one random draw) that `_moveToward` takes. The
// Phase 3A audit (`docs/evidence/shared-stuck-audit/`) found two FALSE
// classes on the Bulwark:
//   F1   — the reference starts undefined, so the FIRST check reads 0px even
//          after ~80px of open travel, and the body slides ~94px sideways;
//   HOLD — every enemy is `behavior: 'swarm'`, so a Bulwark holding its
//          ground on purpose (desired range, the VANGUARD 140px hold) is
//          armed on every check, and the first tick it walks again is a
//          sidestep.
// The rule here is the brief's: COMMANDED TO MOVE + GENUINELY UNABLE TO
// PROGRESS -> recover. Standing still is not stuck; neither is moving.
//
// HOW IT WORKS. It never arms anything and never draws a random number. The
// base block still runs, still decides, and still makes its draw; this only
// reviews each check's arm at the top of the bearer's next AI tick (before
// `_moveToward` can read it) and STANDS IT DOWN when it is false:
//   F1   — first check, and the body really moved >= 12px from its spawn
//          point (the Demolisher's approved veto, re-measured the same way);
//   HOLD — the AI COMMANDED movement on fewer than half of the window's
//          decision ticks. Intent is read from the AI's own call to
//          `_moveToward`, never from velocity: a body pinned against a wall
//          has zero velocity while it is very much trying to move.
// Every other arm — commanded movement that made no progress — is kept, and
// the recovery itself (direction, length, speed) is the base's own.
//
// CANDIDATE B ('early') adds ONE exception. An arm is never stood down while
// the body is demonstrably PINNED at the moment of the check: its most recent
// unbroken run of ticks that were BOTH commanded to move AND in wall / bounds
// contact lasts at least 50ms, and over that run it made under 30% of its
// commanded progress toward its own target. A run, not a share of a fixed
// window: a 140px/s Bulwark that meets a console 517ms after spawning has
// only ~80ms of contact when the first check comes, and that is the case.
// That is the case Candidate A gets wrong — cover met INSIDE the first window
// (or straight out of a hold), where the "false" arm happens to be the right
// call and standing it down delays real recovery by a whole 600ms window.
// And B recognises the mirror case the base's own test misses: a body that
// walked 40px and THEN hit cover inside the same window has "moved" >= 12px,
// so the base does not arm and recovery waits another full window while it
// grinds. If it is pinned at a check the base declined, B arms that check —
// at the base's own instant (never between checks), for the base's own 600ms,
// in the direction the base last drew (`_stuckSideDir`): NO new random draw,
// and the recovery itself is unchanged. It is physics evidence
// (`body.blocked`) plus the AI's own target, read only at a check.

export const BULWARK_STUCK = {
  minMovePx: 12,       // the base block's own threshold (read-only mirror)
  holdFrac: 0.5,       // under this share of commanded decision time = a hold
  minDecideMs: 100,    // a window with less AI decision time than this is left to the base
  pinMs: 200,          // B: the history kept for "pinned right now"
  pinRunMs: 50,        // B: the commanded + in-contact run must be at least this long
  pinProgFrac: 0.3,    // B: and made under this share of its commanded progress
};

/** Per ordinary Bulwark, once, from `spawnEnemyAt`. `x0/y0` is the spawn point. */
export function installBulwarkStuck(e, mode, x0, y0) {
  if (e._bulwarkStuck || (mode !== 'prog' && mode !== 'early')) return;
  const S = e._bulwarkStuck = {
    mode, ox: x0, oy: y0, first: true, lastTimer: undefined,
    winDecide: 0, winMove: 0,
    cmd: false, ux: 0, uy: 0,                 // this tick's AI decision
    pcmd: false, pux: 0, puy: 0, pdt: 0,      // the previous tick's, and the step it produced
    px: null, py: null, recent: [],
    log: { checks: 0, armed: 0, stoodF1: 0, stoodHold: 0, keptPinned: 0, kept: 0, armedPinned: 0 },
  };
  const tick = e._tickSwarm;     // the class's own methods, unchanged
  const move = e._moveToward;
  e._moveToward = function (tx, ty, speed) {
    S.cmd = true;
    const d = Math.hypot(tx - this.x, ty - this.y) || 1;
    S.ux = (tx - this.x) / d; S.uy = (ty - this.y) / d;
    return move.call(this, tx, ty, speed);
  };
  e._tickSwarm = function (delta, player) {
    review(this, S);
    S.cmd = false;
    const r = tick.call(this, delta, player);
    S.winDecide += delta;
    if (S.cmd) S.winMove += delta;
    S.pcmd = S.cmd; S.pux = S.ux; S.puy = S.uy; S.pdt = delta;
    return r;
  };
}

// The top of the bearer's AI tick: the base block has already run this frame.
function review(e, S) {
  // what the last physics step did with the previous tick's command
  if (S.px != null) {
    const dx = e.x - S.px, dy = e.y - S.py;
    S.recent.push({ dt: S.pdt, cmd: S.pcmd, hit: !e.body.blocked.none, prog: S.pcmd ? dx * S.pux + dy * S.puy : 0 });
    let t = 0;
    for (let i = S.recent.length - 1; i >= 0; i--) { t += S.recent[i].dt; if (t > BULWARK_STUCK.pinMs) { S.recent.splice(0, i); break; } }
  }
  S.px = e.x; S.py = e.y;

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
    if (S.first && Math.hypot(e._stuckRefX - S.ox, e._stuckRefY - S.oy) >= BULWARK_STUCK.minMovePx) stand = 'F1';
    else if (S.winDecide >= BULWARK_STUCK.minDecideMs && S.winMove < BULWARK_STUCK.holdFrac * S.winDecide) stand = 'Hold';
    if (stand && S.mode === 'early' && pinned(e, S)) { stand = null; S.log.keptPinned++; }
    if (stand) { e._stuckSidestepMs = 0; S.log['stood' + stand]++; } else S.log.kept++;
  } else if (S.mode === 'early' && e._stuckSideDir !== undefined && pinned(e, S)) {
    e._stuckSidestepMs = 600;   // the base's own length; its last drawn direction
    S.log.armedPinned++;
  }
  S.first = false;
  S.winDecide = 0; S.winMove = 0;
}

// B: commanded, in contact, and not getting anywhere — right now.
function pinned(e, S) {
  let t = 0, prog = 0;
  for (let i = S.recent.length - 1; i >= 0; i--) {
    const s = S.recent[i];
    if (!s.cmd || !s.hit) break;
    t += s.dt; prog += s.prog;
  }
  return t >= BULWARK_STUCK.pinRunMs && prog < BULWARK_STUCK.pinProgFrac * e.cfg.speed * t / 1000;
}
