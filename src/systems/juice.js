// Juice — the systems that make a hit feel like a hit.
//
// ── Why these are shared, and not written per move ────────────────────────
//
// The playtest note was "we need juice and enhanced effects on attacks, not
// just circle and shake, stuff that will show velocity direction impact". The
// operative word is SHOW. The game already had `shake`, which is undirected —
// it tells you something happened and nothing about what, where, or from which
// way. Every effect below exists to answer one of those.
//
// They live in one module and attach onto `scene.fx` so a move calls
// `scene.fx.camPunch(angle, 8)` exactly the way it already calls
// `scene.fx.burst(...)`. A move that has to hand-roll its own feel produces ten
// different feels; this is the same reasoning as `actorMotion.js`.
//
// ── The rule that keeps this from becoming lag ────────────────────────────
//
// Hitstop is the strongest tool here and the easiest to ruin a game with. It is
// for moments the PLAYER should feel — a slam landing, a super connecting, a
// nemesis's heavy — and never for chip damage. Freezing four frames on every
// bullet that touches an enemy is indistinguishable from a bad frame rate, and
// on a phone it reads as the game stuttering.

import Phaser from 'phaser';

// Hitstop is clamped hard. Past ~90ms it stops reading as impact and starts
// reading as a hitch, and on a 60fps handset 70ms is already four frames.
const HITSTOP_MAX_MS = 90;

// Camera punch travel, in px, per unit of `strength`.
const PUNCH_PER_STRENGTH = 2.6;
const PUNCH_MAX_PX = 26;

/**
 * Bolt the juice systems onto an existing `fx` object.
 *
 * Mutates rather than wraps: everything in the game already reaches for
 * `scene.fx.<thing>`, and a second namespace would mean remembering which
 * effects live where at every call site.
 */
export function attachJuice(scene, fx) {
  // ── Hitstop ─────────────────────────────────────────────────────────────
  //
  // One timer, not one per call. Two impacts landing together used to be able
  // to stack their restores and leave the world running at 0.05x — a freeze
  // that only ends when something else happens to restore it. This tracks the
  // single active stop and extends it rather than nesting.
  let stopTimer = null;
  let stopUntil = 0;

  const endHitstop = () => {
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = null;
    stopUntil = 0;
    // Defensive on every field: this can run after a scene has been torn down,
    // and a throw in here would leave the clock slowed — the exact failure it
    // exists to prevent.
    try {
      if (scene.time) scene.time.timeScale = 1;
      if (scene.physics?.world) scene.physics.world.timeScale = 1;
      // NOTE: `scene.anims` is the GAME-wide AnimationManager, not per scene.
      // Leaving this scaled slows animations everywhere, including menus.
      if (scene.anims) scene.anims.globalTimeScale = 1;
    } catch (_) { /* torn down mid-restore; nothing left to restore */ }
  };

  fx.hitstop = (ms = 50, scale = 0.06) => {
    if (!scene.scene?.isActive?.()) return;
    const dur = Phaser.Math.Clamp(ms, 0, HITSTOP_MAX_MS);
    if (dur <= 0) return;
    const now = scene.time.now;
    // Already stopped and the new request ends sooner? Ignore it — a small hit
    // landing during a big one must not cut the big one short.
    if (stopTimer && stopUntil >= now + dur) return;
    stopUntil = now + dur;
    scene.time.timeScale = scale;
    if (scene.physics?.world) scene.physics.world.timeScale = 1 / Math.max(0.01, scale);
    if (scene.anims) scene.anims.globalTimeScale = scale;
    if (stopTimer) clearTimeout(stopTimer);
    // REAL time, and UNCONDITIONAL. Both halves of that were learned the hard
    // way, one after the other.
    //
    // `scene.time` is the clock being slowed, so a delayedCall on it stretches
    // with the freeze: at scale 0.06 a 70ms stop takes ~1.2 SECONDS to lift.
    // A raw timeout is immune to the thing it is undoing.
    //
    // And the restore must not be gated on the scene being active. That sounds
    // defensive and is the opposite — pausing is exactly when a hitstop is most
    // likely to be in flight (pause menu, upgrade card, a test freezing a
    // frame), and skipping the restore then left the clock at 0.06 and physics
    // at 16x slow permanently. It surfaced as three unrelated suites failing
    // under load and passing alone.
    stopTimer = setTimeout(endHitstop, dur);
  };

  /**
   * Camera kick ALONG an axis.
   *
   * `shake` jitters randomly, which says "something happened". A punch says
   * "something hit you from over there" — the camera lurches with the blow and
   * eases back. Direction is the whole point, so `angle` is required.
   */
  fx.camPunch = (angle, strength = 6, returnMs = 220) => {
    const cam = scene.cameras?.main;
    if (!cam) return;
    const px = Math.min(PUNCH_MAX_PX, strength * PUNCH_PER_STRENGTH);
    const dx = Math.cos(angle) * px;
    const dy = Math.sin(angle) * px;
    // Ride on the follow offset rather than scrollX/Y: the camera is following
    // the player, so writing scroll directly fights the follower and snaps back
    // within a frame.
    const baseX = cam.followOffset.x;
    const baseY = cam.followOffset.y;
    cam.setFollowOffset(baseX - dx, baseY - dy);
    scene.tweens.add({
      targets: cam.followOffset,
      x: baseX,
      y: baseY,
      duration: returnMs,
      ease: 'Back.easeOut',
    });
  };

  /**
   * Debris thrown ALONG the direction of a hit, plus a directional arc.
   *
   * `burstDir` already sprays in a cone and is the base; what it lacks is the
   * shockwave that reads as the surface being struck. A full ring says "an
   * explosion happened here"; an arc facing the way the blow travelled says
   * "something hit this, from that side".
   */
  fx.impactSpray = (x, y, angle, color = 'yellow', count = 8, opts = {}) => {
    fx.burstDir?.(x, y, color, count, angle, opts.spreadDeg ?? 55);
    const tint = opts.tint ?? 0xffd8a0;
    const radius = opts.radius ?? 46;
    const g = scene.add.graphics().setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
    const half = (opts.arcDeg ?? 120) * Math.PI / 360;
    const draw = (r, w, a) => {
      g.lineStyle(w, tint, a);
      g.beginPath();
      g.arc(0, 0, r, angle - half, angle + half, false);
      g.strokePath();
    };
    draw(radius * 0.55, 5, 0.9);
    draw(radius * 0.75, 2, 0.5);
    g.setPosition(x, y).setScale(0.4);
    scene.tweens.add({
      targets: g,
      scale: 1.35,
      alpha: 0,
      duration: 240,
      ease: 'Quart.easeOut',
      onComplete: () => g.destroy(),
    });
  };

  /**
   * Ghosted afterimages behind a moving sprite.
   *
   * This is the one that literally draws velocity: the faster the body travels,
   * the further apart the ghosts land, so speed is visible in a single frame
   * rather than only across several.
   *
   * Returns a stop function. The caller MUST call it — a trail whose owner dies
   * mid-dash would otherwise keep sampling a recycled sprite.
   */
  fx.motionTrail = (sprite, opts = {}) => {
    if (!sprite?.active) return () => {};
    const everyMs = opts.everyMs ?? 45;
    const life = opts.lifeMs ?? 260;
    const tint = opts.tint ?? null;
    const alpha = opts.alpha ?? 0.5;
    const ev = scene.time.addEvent({
      delay: everyMs,
      loop: true,
      callback: () => {
        if (!sprite.active || !sprite.visible) return;
        const ghost = scene.add.sprite(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name)
          .setDepth(sprite.depth - 1)
          .setScale(sprite.scaleX, sprite.scaleY)
          .setFlipX(sprite.flipX)
          .setAlpha(alpha)
          .setBlendMode(Phaser.BlendModes.ADD);
        if (tint != null) ghost.setTint(tint);
        scene.tweens.add({
          targets: ghost,
          alpha: 0,
          scaleX: sprite.scaleX * 0.86,
          scaleY: sprite.scaleY * 0.86,
          duration: life,
          ease: 'Quad.easeOut',
          onComplete: () => ghost.destroy(),
        });
      },
    });
    return () => ev.remove(false);
  };

  /**
   * Stretch a body ALONG its motion axis, then snap back.
   *
   * `actorMotion.squash` is axis-aligned (wide and short), which reads as
   * "crouching". This leans the deformation into the direction of travel, which
   * reads as speed — the difference between a sprite that is moving and a
   * sprite that looks like it is moving.
   */
  fx.stretchAlong = (sprite, angle, amount = 0.24, ms = 180) => {
    if (!sprite?.active) return;
    const base = sprite._baseScale || sprite.scaleX || 1;
    // Deform on the axis nearer the travel direction. Bodies never rotate in
    // this game (see HANDOVER), so a true axial stretch would need a rotation
    // the art cannot take — this picks the dominant axis instead.
    const horizontal = Math.abs(Math.cos(angle)) > 0.707;
    const sx = base * (horizontal ? 1 + amount : 1 - amount * 0.6);
    const sy = base * (horizontal ? 1 - amount * 0.6 : 1 + amount);
    scene.tweens.add({
      targets: sprite,
      scaleX: sx,
      scaleY: sy,
      duration: ms * 0.35,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  };

  /** Dust kicked outward where a body lands or stops hard. */
  fx.landingDust = (x, y, count = 7, spread = 34) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      fx.dustPuff?.(x + Math.cos(a) * spread, y + Math.sin(a) * spread * 0.5);
    }
  };

  // Restoring the clock is not optional, and there are three ways to leave a
  // hitstop other than waiting it out. A scene torn down mid-freeze would hand
  // the next one a timeScale of 0.06; a scene PAUSED mid-freeze (pause menu,
  // upgrade card) would come back in slow motion. `once` is wrong for pause and
  // resume — they happen repeatedly over a run.
  scene.events.on('pause', endHitstop);
  scene.events.on('resume', endHitstop);
  scene.events.once('shutdown', endHitstop);
  scene.events.once('destroy', endHitstop);

  return fx;
}
