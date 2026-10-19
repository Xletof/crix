// THE ORDINARY MARKSMAN'S STUCK RECOVERY — PHASE 3C CANDIDATE, OPT-IN.
//
// `?marksmanStuck=prog` (Candidate A). Absent, nothing here is installed and
// the frozen base block runs exactly as it ships. Installed per bearer from
// `GameScene.spawnEnemyAt` for the ordinary `sniper` only — Regular and Elite
// — never a nemesis (`legacyArt`). `src/entities/Enemy.js` is NOT touched:
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
// The sniper's weapon (charge, LOS, laser, lock, shot, cooldown) is not read
// or written here.

export const MARKSMAN_STUCK = {
  minMovePx: 12,       // the base block's own threshold (read-only mirror)
  approachFrac: 0.5,   // under this share of approach-commanded decision time = not an approach window
  minDecideMs: 100,    // a window with less AI decision time than this is left to the base
};

/** Per ordinary Marksman, once, from `spawnEnemyAt`. `x0/y0` is the spawn point. */
export function installMarksmanStuck(e, mode, x0, y0) {
  if (e._marksmanStuck || mode !== 'prog') return;
  const S = e._marksmanStuck = {
    mode, ox: x0, oy: y0, first: true, lastTimer: undefined,
    winDecide: 0, winApproach: 0, winRetreat: 0, winHold: 0,
    approached: false,
    log: { checks: 0, armed: 0, stoodF1: 0, stoodHold: 0, stoodRetreat: 0, kept: 0, retreatBlocked: 0 },
  };
  const tick = e._tickSwarm;     // the class's own methods, unchanged
  const move = e._moveToward;
  e._moveToward = function (tx, ty, speed) {
    S.approached = true;
    return move.call(this, tx, ty, speed);
  };
  e._tickSwarm = function (delta, player) {
    review(this, S);
    S.approached = false;
    const r = tick.call(this, delta, player);
    S.winDecide += delta;
    if (S.approached) S.winApproach += delta;
    else {
      // the velocity this tick just wrote: the command, before physics runs
      const v = this.body.velocity;
      if (Math.hypot(v.x, v.y) > 1) S.winRetreat += delta; else S.winHold += delta;
    }
    return r;
  };
}

// The top of the bearer's AI tick: the base block has already run this frame.
function review(e, S) {
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
    if (stand) {
      e._stuckSidestepMs = 0;
      S.log['stood' + stand]++;
      if (stand === 'Retreat') S.log.retreatBlocked++;   // a commanded retreat that did not move: the base has no recovery for it
    } else S.log.kept++;
  }
  S.first = false;
  S.winDecide = 0; S.winApproach = 0; S.winRetreat = 0; S.winHold = 0;
}
