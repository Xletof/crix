// MoveScript — the four beats, enforced.
//
// The last pass at nemesis moves failed for a structural reason worth writing
// down so it cannot happen twice. A move was a telegraph plus a damage callback:
//
//     draw a circle -> wait 800ms -> deal damage
//
// Nothing about that involves the enemy. It stands still through all of it, so
// there is no anticipation to read on the body, no motion connecting the enemy
// to the damage, and — critically — no recovery afterwards, so dodging earns
// the player nothing. Four "different" moves built that way are four different
// circles, which is exactly how it played.
//
// Every attack that reads in an action game has the same four beats:
//
//   ANTICIPATE  the body winds up. You react to the ENEMY, not to the floor.
//   ACT         the body does the thing — travels, spins, strikes. MANDATORY.
//   IMPACT      contact resolves where you can see it happen.
//   RECOVER     it is left open, and beating it pays.
//
// A move written against this cannot skip ACT: `run()` throws if a script has
// no act phase, and `tests/smoke-moves.mjs` asserts the actor's position or
// scale actually changed while it ran. That check is the whole reason this file
// exists rather than a convention in a comment.
//
// RECOVER is the beat that turns a dodge into a decision. Dodge, then punish —
// the enemy is staggered and takes bonus damage. Without it the correct play is
// to ignore the move and keep shooting, which is what "they didn't make me move
// differently" means in mechanical terms.

/**
 * Run a scripted move.
 *
 * @param {Phaser.Scene} scene
 * @param {object} actor  the enemy performing it
 * @param {object} script {anticipate, act, impact, recover} — `act` required
 * @returns {object} a handle with `cancel()`
 */
export function runMove(scene, actor, script) {
  if (typeof script.act !== 'function') {
    // Loud on purpose. A move with no ACT is a decal, and shipping one is the
    // mistake this whole file exists to prevent.
    throw new Error(`MoveScript "${script.id || '?'}" has no act phase — that is a telegraph, not a move`);
  }

  const handle = { cancelled: false, phase: 'anticipate', timers: [] };
  const alive = () => !handle.cancelled
    && actor?.active && actor?.alive
    && scene?.scene?.isActive?.();

  const later = (ms, fn) => {
    const t = scene.time.delayedCall(ms, () => { if (alive()) fn(); });
    handle.timers.push(t);
    return t;
  };

  handle.cancel = () => {
    handle.cancelled = true;
    handle.timers.forEach((t) => t?.remove?.(false));
    handle.timers.length = 0;
    // Sweep anything the move parked on its own handle — telegraphs, rings,
    // graphics. Cancelling used to stop only the TIMERS, so an interrupted move
    // left its zone painted on the floor, still filling and still flashing on
    // its original schedule. A telegraph that outlives the attack it belongs to
    // is worse than no telegraph: it marks danger where there is none, and the
    // whole point of the shape is that what is drawn and what hurts you cannot
    // drift apart. Caught by a screenshot, not by a check.
    for (const v of Object.values(handle)) {
      if (v && v !== handle && typeof v.destroy === 'function') v.destroy();
    }
    if (actor._activeMove === handle) {
      actor._performing = false;
      actor._movePlanted = false;
      actor._moveAnim = null;        // never strand an attack pose on the body
    }
    script.onCancel?.(scene, actor, handle);
  };
  // A move must not outlive its performer: killing a nemesis mid-charge should
  // stop the charge, not have a corpse finish it.
  actor._activeMove?.cancel?.();
  actor._activeMove = handle;

  // THE MOVE OWNS THE ACTOR until it is done.
  //
  // Both `Boss.preUpdate` and `Enemy.preUpdate` write velocity and pick
  // animations every single frame from their own AI. Without this flag a move
  // and the actor's own state machine fight over the same body: the move's
  // "plant and rear back" is overwritten before it can draw, and the AI can
  // start a charge in the middle of a scripted teleport. Both were measured on
  // the build that got rejected — see docs/POST-MORTEM-vader-moves.md.
  //
  // The AI reads this and yields. It is cleared on `done` and on `cancel`, and
  // `die()` must never leave it set — hence the guard in the cancel path above.
  actor._performing = true;
  // Planted by default. Almost every beat of almost every move wants the body
  // rooted — winding up, channelling, recovering — and the two primitives that
  // DO travel (`charge`, `leapArc`) clear the flag for exactly as long as they
  // are moving. Defaulting the other way meant every move had to remember to
  // plant itself, and a single setVelocity(0,0) in `anticipate` could not hold
  // anyway: bodies have no drag, so one bullet's knockback coasted for the
  // whole beat and carried the actor out of its own telegraph.
  actor._movePlanted = true;

  const anticipateMs = script.anticipateMs ?? 700;
  const actMs = script.actMs ?? 500;
  const recoverMs = script.recoverMs ?? 800;

  script.anticipate?.(scene, actor, handle);

  later(anticipateMs, () => {
    handle.phase = 'act';
    script.act(scene, actor, handle);

    later(actMs, () => {
      handle.phase = 'impact';
      script.impact?.(scene, actor, handle);

      handle.phase = 'recover';
      script.recover?.(scene, actor, handle);

      later(recoverMs, () => {
        handle.phase = 'done';
        if (actor._activeMove === handle) actor._activeMove = null;
        actor._performing = false;
        actor._movePlanted = false;
        actor._moveAnim = null;
        actor._punishMult = 1;
      });
    });
  });

  return handle;
}

/**
 * The bonus a staggered enemy takes.
 *
 * Read by `Enemy.damage`. Defaults to 1 so nothing changes for an enemy that is
 * not recovering from anything.
 */
export const punishMultiplier = (e) => (e?._punishMs > 0 ? (e._punishMult || 1) : 1);
