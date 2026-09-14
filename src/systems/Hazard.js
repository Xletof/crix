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

// ── THE WAKE ────────────────────────────────────────────────────────────────
//
// THE INVERSION THAT THE REJECTED INTERDICTOR FAILED. A `Barrier` is placed: an
// actor stops, points, and puts a line on the floor, and the handset verdict
// was that the line became the content while the actor became its emitter. A
// `Wake` cannot be placed. It is emitted from a travelled path, so it exists
// only because something moved — no movement, no wake — and that is a property
// of the construction rather than a promise in a comment.
//
// IT IS ONE OBJECT, NOT N BARRIERS. A trail built out of separately-spawned
// segments photographs as disconnected floor rectangles appearing underneath a
// sprite, which is the exact failure this concept has to avoid. One polyline,
// drawn as a continuous tapering ribbon, brightest at the head.
//
// SAMPLED BY DISTANCE, NEVER BY FRAME. The returned super's remnants were once
// drawn at every other stored POSITION, which is tight at 60fps on a phone and
// 250px apart in the ~20fps harness — the same code reading as one object with
// momentum on one machine and three separate objects on the other. Points here
// are laid every `stepPx` of real travel, so the trail has the same length and
// the same density whatever the frame rate.
export class Wake {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} spec {width, lifeMs, stepPx, damage, tickMs, color, maxPoints, owner}
   */
  constructor(scene, spec) {
    this.scene = scene;
    this.width = spec.width ?? 40;
    this.lifeMs = spec.lifeMs ?? 1600;
    this.stepPx = spec.stepPx ?? 22;
    this.damage = spec.damage ?? 70;
    this.tickMs = spec.tickMs ?? 420;
    this.color = spec.color ?? 0xb060ff;
    this.maxPoints = spec.maxPoints ?? 64;
    this.owner = spec.owner ?? null;

    /** @type {{x:number,y:number,age:number}[]} oldest first. */
    this.points = [];
    this.dead = false;
    this._cool = 0;
    this._lastX = null;
    this._lastY = null;

    this.shadowGfx = scene.add.graphics().setDepth(HAZARD_DEPTH - 1);
    this.fillGfx = scene.add.graphics().setDepth(HAZARD_DEPTH);
    this.glowGfx = scene.add.graphics().setDepth(HAZARD_DEPTH + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  /**
   * Lay trail up to (x, y). Called by the owner ONLY while it is committed —
   * the speed gate lives with the actor, because "is this movement a commitment"
   * is the actor's question and not the hazard's.
   */
  emit(x, y) {
    if (this.dead) return;
    if (this._lastX === null) { this._lastX = x; this._lastY = y; this._push(x, y); return; }
    let dx = x - this._lastX, dy = y - this._lastY;
    let d = Math.hypot(dx, dy);
    // Walk the gap in fixed steps rather than dropping one point per call, so a
    // slow frame lays the same trail a fast one does instead of a dotted line.
    while (d >= this.stepPx) {
      const k = this.stepPx / d;
      this._lastX += dx * k; this._lastY += dy * k;
      this._push(this._lastX, this._lastY);
      dx = x - this._lastX; dy = y - this._lastY;
      d = Math.hypot(dx, dy);
    }
  }

  /** Stop laying; the trail keeps ageing out on its own. */
  lift() { this._lastX = null; this._lastY = null; }

  _push(x, y) {
    this.points.push({ x, y, age: 0 });
    if (this.points.length > this.maxPoints) this.points.shift();
  }

  /**
   * THE WIDTH OF A SEGMENT AT A GIVEN AGE — used by the renderer AND by
   * `contains()`, so the drawing and the hit test cannot drift apart. It is the
   * same discipline `Telegraph.contains` and `Barrier.contains` hold.
   *
   * Constant for most of the life so crossing has a stable cost, then thinning
   * over the last fifth so the tail visibly dies rather than blinking out.
   */
  _segW(age) {
    const u = age / this.lifeMs;
    if (u >= 1) return 0;
    return (this.width / 2) * (u < 0.8 ? 1 : (1 - u) / 0.2);
  }

  /** True when (px, py) is inside the drawn ribbon. */
  contains(px, py) {
    if (this.dead) return false;
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1], b = this.points[i];
      const w = this._segW(Math.min(a.age, b.age));
      if (w <= 0) continue;
      if (this._distToSeg(px, py, a, b) <= w) return true;
    }
    return false;
  }

  _distToSeg(px, py, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    const len2 = vx * vx + vy * vy;
    let t = len2 > 0 ? ((px - a.x) * vx + (py - a.y) * vy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t));
  }

  /** Total drawn length, for the diagnostics — a cage is a length problem. */
  get length() {
    let n = 0;
    for (let i = 1; i < this.points.length; i++) {
      n += Math.hypot(this.points[i].x - this.points[i - 1].x,
        this.points[i].y - this.points[i - 1].y);
    }
    return n;
  }

  update(delta) {
    if (this.dead) return false;
    for (const p of this.points) p.age += delta;
    // Retire from the TAIL, which is the oldest end, so the trail dies from
    // behind — an effect that vanishes all at once has told the player nothing.
    while (this.points.length && this.points[0].age >= this.lifeMs) this.points.shift();

    this._draw();

    this._cool -= delta;
    const pl = this.scene.player;
    if (pl?.alive && this._cool <= 0 && this.contains(pl.x, pl.y)) {
      this._cool = this.tickMs;
      pl.damage(this.damage);
      this.scene.fx?.burst?.(pl.x, pl.y, 'white', 5);
    }
    // A wake with nothing left to draw is not dead — its owner may still be
    // mid-pass and about to lay more. Only `destroy()` ends it.
    return true;
  }

  _draw() {
    const sh = this.shadowGfx.clear();
    const f = this.fillGfx.clear();
    const g = this.glowGfx.clear();
    const n = this.points.length;
    if (n < 2) return;

    const quad = (a, b, wa, wb) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d, ny = dx / d;
      return [
        { x: a.x + nx * wa, y: a.y + ny * wa },
        { x: b.x + nx * wb, y: b.y + ny * wb },
        { x: b.x - nx * wb, y: b.y - ny * wb },
        { x: a.x - nx * wa, y: a.y - ny * wa },
      ];
    };

    for (let i = 1; i < n; i++) {
      const a = this.points[i - 1], b = this.points[i];
      const wa = this._segW(a.age), wb = this._segW(b.age);
      if (wa <= 0 && wb <= 0) continue;
      // HEAD-BRIGHT. `head` is 1 at the newest segment and falls off behind it,
      // so the trail reads as coming OUT of the vehicle rather than as a strip
      // lying on the floor at uniform brightness.
      const head = i / (n - 1);
      const fade = 1 - Math.min(1, b.age / this.lifeMs);
      const k = fade * (0.35 + 0.65 * head);

      // Scorch: a near-black surround. The deck is dark and a mid-dark stroke
      // on it is invisible; this is what gives the ribbon an edge at all.
      sh.fillStyle(0x05040a, 0.55 * fade);
      sh.fillPoints(quad(a, b, wa + 4, wb + 4), true);

      f.fillStyle(this._shade(this.color, 0.42), 0.42 * k);
      f.fillPoints(quad(a, b, wa, wb), true);
      f.fillStyle(this.color, 0.38 * k);
      f.fillPoints(quad(a, b, wa * 0.45, wb * 0.45), true);

      // Spill in three bands, WIDEST FAINTEST. An even alpha across a stack of
      // glow shapes puts a legible edge on screen — measured on the saber halo,
      // where the outer rim photographed as an ellipse around the blade rather
      // than as light off it.
      for (let bnd = 0; bnd < 3; bnd++) {
        const u = bnd / 2;
        const mul = 0.6 + u * 1.5;
        g.fillStyle(this.color, (0.16 + 0.84 * Math.pow(1 - u, 1.6)) * 0.16 * k);
        g.fillPoints(quad(a, b, wa * mul, wb * mul), true);
      }
      // The freshest two segments carry a white core: the point where the
      // energy is still leaving the vanes.
      if (i >= n - 2) {
        g.fillStyle(0xffffff, 0.30 * fade);
        g.fillPoints(quad(a, b, wa * 0.3, wb * 0.3), true);
      }
    }
  }

  _shade(color, k) {
    const r = Math.round(((color >> 16) & 255) * k);
    const g = Math.round(((color >> 8) & 255) * k);
    const b = Math.round((color & 255) * k);
    return (r << 16) | (g << 8) | b;
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.points.length = 0;
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

  // Same list, same tick, same sweep. A wake is a hazard and must be reachable
  // by `clearHazards` for exactly the reason a barrier is: a damaging region
  // that survives its room is the worst failure this file can have.
  scene.spawnWake = (spec) => {
    const w = new Wake(scene, spec);
    live.push(w);
    return w;
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
