// Actor motion — the beat that was missing.
//
// ── Why this exists ───────────────────────────────────────────────────────
//
// The first pass at nemesis moves shipped telegraphs and called them attacks.
// LEAP SLAM never leapt: the enemy stood still while a red circle appeared on
// the floor somewhere else and, 800ms later, dealt damage. SWEEP BEAM never
// swept. The player's verdict — "some new circle attacks which don't have
// animation or connection" — is exactly what that is.
//
// The cause was structural, not artistic. Every character sheet in this game has
// 24 frames: idle, six walk, and ONE fire frame. There is no attack animation to
// play, so a move built from spritesheet frames alone cannot exist.
//
// But an attack does not need drawn frames to READ. It needs:
//
//     ANTICIPATE   the body winds up, so you know something is coming
//     ACT          the body DOES the thing — travels, spins, strikes
//     IMPACT       contact lands somewhere you can see
//     RECOVER      it is left open, and you can make it pay
//
// All four can be driven by tweening the sprite that already exists. A leap is
// a sprite arcing upward while its shadow stays on the floor. A charge is a
// squash, then real velocity. That is what this file provides.
//
// ── The one trap ──────────────────────────────────────────────────────────
//
// A flying object's `y` is NOT where it is. Anything airborne renders at
// `groundY - altitude`, and depth must be sorted by the GROUND y — the point
// the shadow is on — or draw order drifts as the actor climbs and it slides
// under things it should be over. See the DEPTH note in config.js; this is the
// same trap `leapArc` would fall into if it sorted by rendered y.

/** Anticipation. Squash down and wide, then release — reads as "winding up". */
export function squash(scene, sprite, ms = 260, amount = 0.22) {
  if (!sprite?.active) return null;
  const bx = sprite._baseScale || sprite.scaleX || 1;
  const by = sprite._baseScale || sprite.scaleY || 1;
  return scene.tweens.add({
    targets: sprite,
    scaleX: bx * (1 + amount),
    scaleY: by * (1 - amount),
    duration: ms * 0.6,
    yoyo: true,
    ease: 'Quad.easeOut',
  });
}

/** Rear back AWAY from a target before lunging at it. The classic tell. */
export function rearBack(scene, sprite, angle, dist = 34, ms = 260) {
  if (!sprite?.active) return null;
  return scene.tweens.add({
    targets: sprite,
    x: sprite.x - Math.cos(angle) * dist,
    y: sprite.y - Math.sin(angle) * dist,
    duration: ms,
    ease: 'Quad.easeOut',
  });
}

/**
 * A real leap: the body rises and falls along an arc while the shadow tracks
 * the ground position underneath it.
 *
 * `onLand` fires at touchdown, which is where a slam's damage belongs — not at
 * the start, and not on a timer that has nothing to do with the animation.
 */
export function leapArc(scene, sprite, to, opts = {}) {
  if (!sprite?.active) return null;
  const ms = opts.ms ?? 480;
  const height = opts.height ?? 120;
  const from = { x: sprite.x, y: sprite.y };
  const shadow = sprite.shadow || null;
  const state = { t: 0 };

  // Physics must not fight the tween — an arcade body with velocity would drag
  // the sprite off the arc mid-flight.
  const hadBody = !!sprite.body;
  if (hadBody) { sprite.body.setVelocity(0, 0); sprite.body.enable = false; }

  return scene.tweens.add({
    targets: state,
    t: 1,
    duration: ms,
    ease: 'Linear',
    onUpdate: () => {
      if (!sprite.active) return;
      const gx = from.x + (to.x - from.x) * state.t;
      const gy = from.y + (to.y - from.y) * state.t;
      const alt = Math.sin(Math.PI * state.t) * height;
      sprite.x = gx;
      sprite.y = gy - alt;
      // Depth from the GROUND y, never the rendered y — otherwise the actor
      // changes draw order as it climbs.
      sprite.setDepth(gy);
      if (shadow?.active) {
        shadow.setPosition(gx, gy + 30);
        shadow.setDepth(gy - 1);
        // Shrinks with altitude, which is most of what sells the height.
        shadow.setScale(1 - (alt / height) * 0.35);
        shadow.setAlpha(0.45 - (alt / height) * 0.2);
      }
    },
    onComplete: () => {
      if (hadBody && sprite.body) sprite.body.enable = true;
      if (shadow?.active) { shadow.setScale(1); shadow.setAlpha(0.45); }
      if (sprite.active) { sprite.x = to.x; sprite.y = to.y; }
      opts.onLand?.();
    },
  });
}

/**
 * Travel fast in a straight line under real velocity, stopping on impact.
 *
 * Velocity rather than a position tween on purpose: a charge has to COLLIDE —
 * with walls, with the player — and a tweened position walks through solids.
 */
export function charge(scene, sprite, angle, opts = {}) {
  if (!sprite?.active || !sprite.body) return null;
  const speed = opts.speed ?? 900;
  const ms = opts.ms ?? 700;
  sprite.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  sprite._chargingMs = ms;
  return scene.time.delayedCall(ms, () => {
    if (!sprite.active) return;
    sprite.body?.setVelocity(0, 0);
    sprite._chargingMs = 0;
    opts.onEnd?.();
  });
}

/** Spin in place. Used by the spiral, and as a wind-up for anything circular. */
export function spin(scene, sprite, opts = {}) {
  if (!sprite?.active) return null;
  const ms = opts.ms ?? 900;
  const turns = opts.turns ?? 2;
  const target = sprite.weaponSprite?.active ? sprite.weaponSprite : sprite;
  return scene.tweens.add({
    targets: target,
    rotation: (target.rotation || 0) + Math.PI * 2 * turns,
    duration: ms,
    ease: 'Sine.easeInOut',
  });
}

/** Fade out and shrink — the first half of a teleport. */
export function vanish(scene, sprite, ms = 200) {
  if (!sprite?.active) return null;
  return scene.tweens.add({
    targets: sprite, alpha: 0, scaleX: 0.4, scaleY: 1.4,
    duration: ms, ease: 'Quad.easeIn',
  });
}

/** Snap back in at the new position. */
export function appear(scene, sprite, ms = 220) {
  if (!sprite?.active) return null;
  const b = sprite._baseScale || 1;
  sprite.setScale(b * 1.5, b * 0.6);
  return scene.tweens.add({
    targets: sprite, alpha: 1, scaleX: b, scaleY: b,
    duration: ms, ease: 'Back.easeOut',
  });
}

// The weapon's resting scale, remembered once.
//
// ── Why this exists, and why it is not `* 1.35` ──────────────────────────
//
// `raiseWeapon` used to multiply the CURRENT scale by 1.35 and `dropWeapon`
// divided it back. Relative like that, the pair only balances if every raise is
// matched by exactly one drop — and SABER THROW never called drop at all, while
// any cancelled or interrupted move skipped it too. So the scale COMPOUNDED:
// 1.89 -> 2.55 -> 3.44 -> 4.65 across successive casts, and by the fifth throw
// Vader's saber rendered as a ~1100px slab lying diagonally across the room.
// I found it in a screenshot while hunting something else entirely.
//
// This is the same family of bug CLAUDE.md already warns about for touch
// widgets: a relative scale mutation with no anchor drifts, permanently. The
// fix is to anchor it — remember the resting scale on first use and always set
// an ABSOLUTE multiple of it, so a missed drop costs one frame, not the run.
const restScale = (w) => {
  if (w._restScaleX == null) { w._restScaleX = w.scaleX || 1; w._restScaleY = w.scaleY || 1; }
  return { x: w._restScaleX, y: w._restScaleY };
};

const RAISE = 1.35;

/**
 * Raise the weapon overhead and HOLD it there.
 *
 * The hold is the whole point for a bait attack: the pause is longer than feels
 * natural, so an early dodge is punished and patience is rewarded. Returns the
 * tween so a caller can chain the strike onto it.
 */
export function raiseWeapon(scene, sprite, ms = 300) {
  const w = sprite?.weaponSprite;
  if (!w?.active) return null;
  const rest = restScale(w);
  w._raised = true;
  return scene.tweens.add({
    targets: w,
    scaleX: rest.x * RAISE,
    scaleY: rest.y * RAISE,
    duration: ms,
    ease: 'Quad.easeOut',
  });
}

/** Drop it again, on the strike. Always back to REST, never a relative divide. */
export function dropWeapon(scene, sprite, ms = 120) {
  const w = sprite?.weaponSprite;
  if (!w?.active) return null;
  const rest = restScale(w);
  w._raised = false;
  return scene.tweens.add({
    targets: w,
    scaleX: rest.x,
    scaleY: rest.y,
    duration: ms,
    ease: 'Quad.easeIn',
  });
}

/**
 * The punish window.
 *
 * `Enemy._staggerMs` already exists at 90ms with a squash visual for hit
 * reactions; this is the same thing held far longer and made to matter. Without
 * it a dodge earns nothing, and a move with no payoff for dodging is just
 * damage on a timer — which is what the last pass shipped.
 */
export function stagger(scene, sprite, ms = 900, dmgMult = 1.5) {
  if (!sprite?.active) return;
  sprite._staggerMs = Math.max(sprite._staggerMs || 0, ms);
  sprite._punishMult = dmgMult;
  sprite._punishMs = ms;
  sprite.body?.setVelocity(0, 0);
  scene.tweens.add({
    targets: sprite,
    alpha: 0.75,
    duration: 140,
    yoyo: true,
    repeat: Math.max(0, Math.floor(ms / 280) - 1),
  });
}
