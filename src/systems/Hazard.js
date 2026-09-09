// ── PERSISTENT HAZARDS ──────────────────────────────────────────────────────
//
// THE THING THE ROSTER COULD NOT DO. Every threat the six ordinary enemies own
// is a body or a projectile: kill it or dodge it and the floor is yours again.
// Nothing takes ground and KEEPS it, so no encounter composition can ask "where
// are you allowed to stand for the next five seconds" — which is the finding
// Phase A's own A/B ended on (`HANDOVER.md` §10ac).
//
// A `Barrier` is that missing verb, and it is deliberately ONE bespoke class
// rather than a general effect framework. It is a LANE — a line the Champion
// draws across the deck — not an area, because these arenas are about lanes,
// crossings and an escort floor, and a line DIVIDES space where a disc merely
// occupies it. A disc you walk around. A line you have to choose a side of.
//
// THE ONE RULE IT INHERITS FROM `Telegraph`: THE SHAPE IS THE HIT TEST.
// `contains()` runs the same lane arithmetic the renderer draws, so what is
// painted and what hurts cannot drift apart. Never draw one shape and resolve
// another — that trap has already cost this project a 90-degree cone that
// dragged the player in from every bearing.
//
// FOUR THINGS THE PLAYER MUST BE ABLE TO READ, and each is a construction
// rather than a hope:
//   WHERE IT CAME FROM  the seam grows OUT of the Champion's own pylon, from
//                       its end, over `growMs`. It is never simply present.
//   WHEN IT BEGAN       the growth plus a hard flash at the near anchor.
//   WHAT IT COVERS      two bright ANCHOR POSTS mark the ends. A painted mark
//                       has no ends; a placed object does, and that is the
//                       difference between "the floor is red here" and "a
//                       machine has put something down".
//   WHEN IT ENDS        the last `warnMs` visibly fails — the core thins, the
//                       shimmer runs faster and the whole seam strobes, then
//                       collapses back into the anchors. An effect that simply
//                       stops has told the player nothing.
import Phaser from 'phaser';

export const HAZARD_DEPTH = 11;   // under TELEGRAPH_DEPTH (12): a live seam must
                                  // never draw over the warning for the NEXT attack.

export class Barrier {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} spec {x, y, angle, len, width, lifeMs, growMs, warnMs,
   *                       damage, tickMs, color, owner}
   */
  constructor(scene, spec) {
    this.scene = scene;
    this.x = spec.x; this.y = spec.y;
    this.angle = spec.angle;
    this.len = spec.len;
    this.width = spec.width;
    this.lifeMs = spec.lifeMs ?? 5500;
    this.growMs = spec.growMs ?? 260;
    this.warnMs = spec.warnMs ?? 1100;
    this.damage = spec.damage ?? 90;
    this.tickMs = spec.tickMs ?? 460;
    this.color = spec.color ?? 0xb060ff;
    // The owner is remembered ONLY so the Champion can take its own seam down
    // with it. Nothing here reads the owner's position: a placed barrier is
    // PLACED, and a seam that followed its caster would be a tether, not a
    // claim on a piece of floor.
    this.owner = spec.owner ?? null;

    this.age = 0;
    this.dead = false;
    this._cool = 0;

    this.shadowGfx = scene.add.graphics().setDepth(HAZARD_DEPTH - 1);
    this.fillGfx = scene.add.graphics().setDepth(HAZARD_DEPTH);
    this.glowGfx = scene.add.graphics().setDepth(HAZARD_DEPTH + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  /** How much of the seam is laid down right now, 0..1. */
  get _extent() {
    return Math.min(1, this.age / Math.max(1, this.growMs));
  }

  /** 1 while healthy, ramping to 0 across the final `warnMs`. */
  get _integrity() {
    const left = this.lifeMs - this.age;
    if (left >= this.warnMs) return 1;
    return Math.max(0, left / this.warnMs);
  }

  /**
   * THE HIT TEST, and the renderer's only source of geometry.
   *
   * A point is inside when it is within `width/2` of the segment AND within the
   * part of the segment that has actually been laid down. The growth is real:
   * during `growMs` the far end genuinely does not hurt yet, which is what
   * makes "it grew out of the machine" a true statement rather than an
   * animation played over an already-live hazard.
   */
  contains(px, py) {
    if (this.dead) return false;
    const dx = px - this.x, dy = py - this.y;
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    const along = dx * c + dy * s;
    const across = Math.abs(-dx * s + dy * c);
    return along >= -this.width / 2
      && along <= this.len * this._extent
      && across <= this.width / 2;
  }

  update(delta) {
    if (this.dead) return false;
    this.age += delta;
    if (this.age >= this.lifeMs) { this.destroy(); return false; }

    this._draw();

    // ── Contact ────────────────────────────────────────────────────────────
    // A per-barrier cooldown rather than per-frame damage: at ~60fps a walk
    // through a 52px seam is a handful of frames, and per-frame ticks would
    // make the cost depend on the machine's frame rate rather than on the
    // player's decision. `Player.damage` owns the i-frames and god mode.
    this._cool -= delta;
    const p = this.scene.player;
    if (p?.alive && this._cool <= 0 && this.contains(p.x, p.y)) {
      this._cool = this.tickMs;
      p.damage(this.damage, this.angle + Math.PI / 2);
      this.scene.fx?.burst?.(p.x, p.y, 'white', 5);
    }
    return true;
  }

  _draw() {
    const t = this.age / 1000;
    const ext = this._extent;
    const integ = this._integrity;
    const L = this.len * ext;
    const hw = this.width / 2;
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    const ex = this.x + c * L, ey = this.y + s * L;

    // A quad in world space, so the seam can lie at any bearing without the
    // renderer needing a rotated container to keep in step with `contains()`.
    const quad = (halfW, x0, y0, x1, y1) => ([
      { x: x0 - s * halfW, y: y0 + c * halfW },
      { x: x1 - s * halfW, y: y1 + c * halfW },
      { x: x1 + s * halfW, y: y1 - c * halfW },
      { x: x0 + s * halfW, y: y0 - c * halfW },
    ]);

    // ── SCORCH: a near-black trough, drawn once the seam exists ────────────
    // The deck is dark (#161620 and below) and a mid-dark stroke on it is
    // invisible — the same lesson the telegraph's shadow layer and FX's ground
    // fractures both had to learn. This is what gives the seam an EDGE.
    const sh = this.shadowGfx.clear();
    sh.fillStyle(0x05040a, 0.72);
    sh.fillPoints(quad(hw + 5, this.x, this.y, ex, ey), true);

    // ── BODY: a hard core, not a gradient ─────────────────────────────────
    const f = this.fillGfx.clear();
    // Failing seams flicker. Sampled off the age so it is frame-rate
    // independent — a per-frame random would strobe at whatever speed the
    // machine happens to run at.
    const fail = integ < 1 ? (0.55 + 0.45 * Math.sin(t * (26 + (1 - integ) * 40))) : 1;
    const bodyA = (0.30 + 0.22 * Math.sin(t * 5)) * (0.35 + 0.65 * integ) * (integ < 1 ? fail : 1);
    f.fillStyle(this._shade(this.color, 0.45), bodyA);
    f.fillPoints(quad(hw, this.x, this.y, ex, ey), true);
    f.fillStyle(this.color, bodyA * 0.85);
    f.fillPoints(quad(hw * 0.42 * (0.45 + 0.55 * integ), this.x, this.y, ex, ey), true);

    // ── SPILL: five bands, WIDEST FAINTEST ────────────────────────────────
    // An even alpha across a stack of glow shapes puts a legible EDGE on
    // screen — measured on the saber halo, where the outermost rim
    // photographed as a crimson ellipse around the blade instead of light off
    // it. Ramped, so the outside of the spill dies into the floor.
    const g = this.glowGfx.clear();
    for (let i = 0; i < 5; i++) {
      const u = i / 4;                                  // 0 tight .. 1 widest
      const w = hw * (0.5 + u * 1.55);
      const a = (0.16 + 0.84 * Math.pow(1 - u, 1.6)) * 0.20 * integ * fail;
      g.fillStyle(this.color, a);
      g.fillPoints(quad(w, this.x, this.y, ex, ey), true);
    }

    // ── SHIMMER: which way the seam was fired ─────────────────────────────
    // Runs from the near anchor outward, so the motion says where it came
    // from — the same claim a telegraph's kinetic layer makes, for the same
    // reason. It runs FASTER as the seam fails, which is the expiry tell.
    const period = 900 * (0.35 + 0.65 * integ);
    const step = 74;
    const phase = ((this.age % period) / period) * step;
    for (let d = phase; d < L; d += step) {
      const px0 = this.x + c * d, py0 = this.y + s * d;
      const px1 = this.x + c * Math.min(L, d + 26), py1 = this.y + s * Math.min(L, d + 26);
      g.fillStyle(0xffffff, 0.20 * integ * fail);
      g.fillPoints(quad(hw * 0.30, px0, py0, px1, py1), true);
    }

    // ── ANCHORS: the seam has ENDS, and they are objects ───────────────────
    // Two bright posts, the near one always present and the far one arriving
    // only when the growth reaches it. This is what separates a placed barrier
    // from a mark painted on the floor, and it is how the player reads the
    // extent without having to test it with their body.
    const post = (x, y, k) => {
      f.fillStyle(0x120a1e, 0.9); f.fillCircle(x, y, hw * 0.85);
      g.fillStyle(this.color, 0.30 * k * integ);  g.fillCircle(x, y, hw * 1.25);
      g.fillStyle(this.color, 0.55 * k * integ);  g.fillCircle(x, y, hw * 0.72);
      g.fillStyle(0xffffff, 0.75 * k * integ * fail); g.fillCircle(x, y, hw * 0.30);
    };
    post(this.x, this.y, 1);
    if (ext >= 1) post(ex, ey, 1);
  }

  _shade(color, k) {
    const r = Math.round(((color >> 16) & 255) * k);
    const g = Math.round(((color >> 8) & 255) * k);
    const b = Math.round((color & 255) * k);
    return (r << 16) | (g << 8) | b;
  }

  /** Idempotent. Called by expiry, by the owner's death and by the room sweep. */
  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.shadowGfx?.destroy();
    this.fillGfx?.destroy();
    this.glowGfx?.destroy();
    this.shadowGfx = this.fillGfx = this.glowGfx = null;
  }
}

/**
 * Install the hazard list on a scene, mirroring `attachTelegraphs`.
 *
 * The sweep matters as much as the spawn: a hazard that survives its room is a
 * damaging region on a floor nothing drew, which is the worst failure this
 * class can have. `GameScene._clearRoomEntities` calls `clearHazards`, the
 * Champion's death calls `destroy` on its own, and both are idempotent.
 */
export function attachHazards(scene) {
  const live = [];
  scene._hazards = live;

  scene.spawnBarrier = (spec) => {
    const b = new Barrier(scene, spec);
    live.push(b);
    return b;
  };

  scene.tickHazards = (delta) => {
    for (let i = live.length - 1; i >= 0; i--) {
      if (!live[i].update(delta)) live.splice(i, 1);
    }
  };

  scene.clearHazards = () => {
    live.splice(0).forEach((h) => h.destroy());
  };

  return live;
}
