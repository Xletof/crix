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
import { SFX } from './FX.js';

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
 * ── THE ARC GRENADE ─────────────────────────────────────────────────────────
 *
 * THE SHOCK CAPTAIN'S FIRST SIGNATURE, and it is ONE object with four phases
 * rather than a projectile plus a hazard. That is a lifecycle decision before
 * it is a design one: a thrown thing that spawns a separate field on landing is
 * two objects with two owners and two ways to be orphaned, and "a damaging
 * region that outlives the machine that drew it is worse than no hazard". One
 * object is reachable by the three sweeps that already exist — the Champion's
 * own death, `clearHazards` on room change, and expiry — and each of them is
 * idempotent because none can know about the others.
 *
 *   FLIGHT  a real travelling object with real altitude, drawn above the actor
 *           band with its shadow on the deck below it. `contains` is FALSE.
 *   ARM     landed, casing on the floor, a charge tell that accelerates.
 *           Still FALSE: the ground does not hurt before it is live.
 *   FIELD   the electrical patch. `contains` is true inside `radius`.
 *   WARN    the last `warnMs` of FIELD, visibly failing so the player can spend
 *           it. An effect that simply stops has told them nothing.
 *
 * THE SHAPE IS THE HIT TEST, as everywhere else in this file. The boundary is
 * drawn as jagged arcs whose jitter runs INWARD ONLY from the true radius, and
 * a thin honest ring is drawn at that radius underneath them — so the painted
 * edge can never claim ground the hit test does not own. A player who reads the
 * bright edge and stands one pixel outside it is safe, which is the entire
 * contract.
 *
 * WHY IT IS NOT A RED DISC. Red is Vader, the saber lane and every telegraph;
 * this is Shock Captain technology and is painted in his own electric blue with
 * white cores. It is told apart from the arenas' cyan screens by being ANIMATED
 * and on the FLOOR — a screen is a still rectangle on a wall — and from his own
 * body damage by scale and anchoring: his failures are small, actor-attached
 * and intermittent, this is large, world-attached and deliberate. Same
 * technological family, different semantic scale.
 */
export class ArcGrenade {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} spec {x, y, tx, ty, ...CHAMPION.captain.grenade, owner}
   */
  constructor(scene, spec) {
    this.scene = scene;
    // The THROW point and the LANDING point. `x`/`y` are the landing point from
    // the first frame, because that is what the Captain's own avoidance and
    // every test need to reason about, and because the flight position is
    // derived rather than stored.
    this.x0 = spec.x; this.y0 = spec.y;
    this.x = spec.tx; this.y = spec.ty;
    this.radius = spec.radius ?? 132;
    this.flightMs = spec.flightMs ?? 620;
    this.arcPx = spec.arcPx ?? 96;
    this.armMs = spec.armMs ?? 520;
    this.fieldMs = spec.fieldMs ?? 1900;
    this.warnMs = spec.warnMs ?? 520;
    this.damage = spec.damage ?? 46;
    this.tickMs = spec.tickMs ?? 420;
    this.dragMult = spec.dragMult ?? 0.62;
    this.color = spec.color ?? 0x4fc3ff;
    this.owner = spec.owner ?? null;

    this.age = 0;
    this.dead = false;
    this._cool = 0;
    this._crawl = [];          // interior arcs, re-rolled on their own clock
    this._crawlT = 0;
    this._armed = false;       // one-shot: the activation beat has played
    this._landed = false;

    this.floorGfx = scene.add.graphics().setDepth(HAZARD_DEPTH);
    this.edgeGfx = scene.add.graphics().setDepth(HAZARD_DEPTH + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    // THE THROWN OBJECT FLIES OVER THE ROOM. A flying thing at the flat hazard
    // depth is drawn under every actor, which is the one thing a projectile the
    // player is supposed to watch may not be. Its SHADOW stays on the deck.
    this.shadowGfx = scene.add.graphics().setDepth(HAZARD_DEPTH - 1);
    this.airGfx = scene.add.graphics().setDepth(2001);
  }

  /** 'flight' | 'arm' | 'field' | 'dead'. */
  get phase() {
    if (this.dead) return 'dead';
    if (this.age < this.flightMs) return 'flight';
    if (this.age < this.flightMs + this.armMs) return 'arm';
    return 'field';
  }

  /** How long the field has been live, ms. Negative before it is. */
  get _fieldAge() { return this.age - this.flightMs - this.armMs; }

  /** 1 while healthy, ramping to 0 across the final `warnMs`. */
  get _integrity() {
    const left = this.fieldMs - this._fieldAge;
    if (left >= this.warnMs) return 1;
    return Math.max(0, left / this.warnMs);
  }

  /** Is it live and dangerous right now? Nothing else may ask 'phase'. */
  get live() { return !this.dead && this.phase === 'field'; }

  /**
   * THE HIT TEST. A disc, and only while the field is live — the thrown object
   * hurts nobody and the arming casing hurts nobody. The renderer's boundary is
   * drawn from this same radius with inward-only jitter, so painted and
   * resolved cannot drift.
   */
  contains(px, py) {
    if (!this.live) return false;
    return Math.hypot(px - this.x, py - this.y) <= this.radius;
  }

  update(delta) {
    if (this.dead) return false;
    this.age += delta;
    if (this._fieldAge >= this.fieldMs) { this.destroy(); return false; }

    const ph = this.phase;
    if (ph !== 'flight' && !this._landed) {
      this._landed = true;
      this.airGfx?.clear();
      this.shadowGfx?.clear();
      SFX.arcGrenadeLand?.();
    }
    if (ph === 'field' && !this._armed) {
      this._armed = true;
      SFX.arcFieldOpen?.();
      this.scene.fx?.impactRing?.(this.x, this.y, this.color, HAZARD_DEPTH + 2);
      this.scene.events?.emit?.('arc-field-live', this);
    }

    this._draw(delta);

    // ── Contact ───────────────────────────────────────────────────────────
    // A cooldown rather than a per-frame tick, for the reason `Barrier` states:
    // per-frame damage makes the cost of a decision depend on the machine's
    // frame rate. The DRAG is per-frame and that is correct — it is a condition
    // of the ground, not an event, and it is written fresh every frame and
    // consumed by `Player.preUpdate`, so it cannot accumulate or leak.
    const p = this.scene.player;
    this._cool -= delta;
    if (p?.alive && this.live && this.contains(p.x, p.y)) {
      p._envDrag = Math.min(p._envDrag ?? 1, this.dragMult);
      if (this._cool <= 0) {
        this._cool = this.tickMs;
        p.damage(this.damage, Math.atan2(p.y - this.y, p.x - this.x));
        this.scene.fx?.burst?.(p.x, p.y, 'white', 4);
        SFX.arcFieldTick?.();
      }
    }
    return true;
  }

  /** A jagged polyline between two points, drawn into `g`. */
  _bolt(g, ax, ay, bx, by, jitter, width, color, alpha) {
    const segs = 4;
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(ax, ay);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      g.lineTo(
        ax + (bx - ax) * t + (Math.random() - 0.5) * jitter,
        ay + (by - ay) * t + (Math.random() - 0.5) * jitter,
      );
    }
    g.lineTo(bx, by);
    g.strokePath();
  }

  _draw(delta) {
    const ph = this.phase;
    this.floorGfx.clear();
    this.edgeGfx.clear();

    if (ph === 'flight') {
      this.airGfx.clear();
      this.shadowGfx.clear();
      const u = this.age / this.flightMs;
      const gx = this.x0 + (this.x - this.x0) * u;
      const gy = this.y0 + (this.y - this.y0) * u;
      // A parabola, so the object rises and FALLS. A straight line with a
      // shadow under it is a slide; the fall is what says it is coming down
      // here rather than passing over.
      const alt = Math.sin(Math.PI * u) * this.arcPx;
      // The shadow is the landing promise: it is on the deck the whole time and
      // it arrives exactly where the field will open.
      this.shadowGfx.fillStyle(0x000000, 0.34 - 0.14 * (alt / this.arcPx));
      this.shadowGfx.fillEllipse(gx, gy, 20, 10);
      const ax = gx, ay = gy - alt;
      const spin = this.age * 0.02;
      this.airGfx.fillStyle(0x0d1116, 1);
      this.airGfx.fillCircle(ax, ay, 7);
      this.airGfx.lineStyle(2, this.color, 0.9);
      this.airGfx.strokeCircle(ax, ay, 7);
      this.airGfx.fillStyle(0xffffff, 0.85);
      this.airGfx.fillCircle(ax + Math.cos(spin) * 3, ay + Math.sin(spin) * 3, 2.4);
      // A short live spark off the casing: it is armed and it is obvious.
      if (Math.random() < 0.6) {
        this._bolt(this.airGfx, ax, ay,
          ax + (Math.random() - 0.5) * 22, ay + (Math.random() - 0.5) * 22,
          6, 1.5, this.color, 0.7);
      }
      // A FAINT LANDING MARK from the moment it is in the air. Not a telegraph
      // ring — it claims nothing and damages nothing — but the player is
      // entitled to know where the thing they can see flying is going to land.
      this.floorGfx.lineStyle(1.5, this.color, 0.16 + 0.12 * u);
      this.floorGfx.strokeCircle(this.x, this.y, this.radius * (0.55 + 0.45 * u));
      return;
    }

    // Grounded: the casing sits at the centre for the rest of its life.
    const t = this.age / 1000;
    if (ph === 'arm') {
      const u = (this.age - this.flightMs) / this.armMs;
      // THE TELL, AND IT ACCELERATES. A constant blink says "something is
      // here"; one that speeds up says "and it is about to happen".
      const rate = 3 + u * u * 16;
      const blink = 0.5 + 0.5 * Math.sin(t * rate * Math.PI * 2);
      this.floorGfx.fillStyle(this.color, 0.05 + 0.10 * u);
      this.floorGfx.fillCircle(this.x, this.y, this.radius * u * 0.9);
      // A charge ring that CONTRACTS onto the casing — the energy gathering in,
      // so the moment it arrives is the moment the field goes out.
      this.edgeGfx.lineStyle(2 + 2 * blink, this.color, 0.30 + 0.5 * blink);
      this.edgeGfx.strokeCircle(this.x, this.y, this.radius * (1 - u * 0.62));
      this.edgeGfx.lineStyle(1.5, this.color, 0.22);
      this.edgeGfx.strokeCircle(this.x, this.y, this.radius);
    } else {
      const integ = this._integrity;
      // ── THE FLOOR: ionised deck, not a painted danger disc ───────────────
      // MEASURED AGAINST THE ROOM, NOT PICKED. The first build was 0.40 of
      // `#0a1a26` with a 0.09 wash, and photographed on a hangar deck under the
      // DARKNESS modifier as a soft blue-grey blob — present, and not legibly
      // dangerous. On a deck that is already `#212328` and can be tinted toward
      // black by a room modifier, a hazard has to carry its own contrast.
      this.floorGfx.fillStyle(0x071620, 0.62 * integ);
      this.floorGfx.fillCircle(this.x, this.y, this.radius);
      this.floorGfx.fillStyle(this.color, 0.16 * integ);
      this.floorGfx.fillCircle(this.x, this.y, this.radius * 0.74);
      this.floorGfx.fillStyle(this.color, 0.10 * integ);
      this.floorGfx.fillCircle(this.x, this.y, this.radius * 0.42);

      // ── THE BOUNDARY: jagged, and it never reaches past the real radius ──
      // The honest ring first, so the true edge is legible even on the frames
      // the jitter happens to pull the arcs well inside it.
      const strobe = integ < 1 ? (0.45 + 0.55 * Math.sin(t * 34)) : 1;
      this.edgeGfx.lineStyle(2, this.color, 0.55 * integ * strobe);
      this.edgeGfx.strokeCircle(this.x, this.y, this.radius);
      const arcs = 16;
      for (let i = 0; i < arcs; i++) {
        const a0 = (i / arcs) * Math.PI * 2 + t * 0.6;
        const a1 = a0 + (Math.PI * 2 / arcs) * 0.82;
        // INWARD ONLY. `r0`/`r1` are never above `this.radius`, which is what
        // makes the painted edge a promise the hit test can keep.
        const r0 = this.radius - Math.random() * 12;
        const r1 = this.radius - Math.random() * 12;
        this._bolt(this.edgeGfx,
          this.x + Math.cos(a0) * r0, this.y + Math.sin(a0) * r0,
          this.x + Math.cos(a1) * r1, this.y + Math.sin(a1) * r1,
          9, 3, i % 3 === 0 ? 0xffffff : this.color,
          (0.7 + 0.3 * Math.random()) * integ * strobe);
        // A NODE where two arcs meet. A boundary drawn only as lines reads as a
        // sketch; the bright points are what make it read as a circuit closing
        // around a patch of floor — and they sit exactly ON the radius, which
        // is the edge the hit test uses.
        if (i % 2 === 0) {
          this.edgeGfx.fillStyle(0xffffff, 0.75 * integ * strobe);
          this.edgeGfx.fillCircle(this.x + Math.cos(a0) * this.radius,
            this.y + Math.sin(a0) * this.radius, 2.4);
        }
      }

      // ── THE INTERIOR: crawling current, re-rolled on its own clock ───────
      // Per-frame randomisation at 60fps is a strobe and at 15fps is a
      // different effect entirely; a fixed re-roll interval reads the same on
      // both, which is the frame-rate lesson this project keeps relearning.
      this._crawlT -= delta;
      if (this._crawlT <= 0) {
        this._crawlT = 70;
        this._crawl.length = 0;
        const n = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const b = a + (Math.random() - 0.5) * 2.4;
          const ra = Math.random() * this.radius * 0.8;
          const rb = Math.random() * this.radius * 0.8;
          this._crawl.push([Math.cos(a) * ra, Math.sin(a) * ra,
            Math.cos(b) * rb, Math.sin(b) * rb]);
        }
      }
      for (const c of this._crawl) {
        this._bolt(this.edgeGfx, this.x + c[0], this.y + c[1],
          this.x + c[2], this.y + c[3], 12, 2, 0xffffff, 0.52 * integ);
      }
    }

    // The casing, on the deck, for arm and field alike. THE SOURCE IS VISIBLE:
    // a field with nothing at its centre is a painted mark, and a placed object
    // is what makes it a thing a machine put there.
    this.floorGfx.fillStyle(0x0d1116, 1);
    this.floorGfx.fillCircle(this.x, this.y, 9);
    this.floorGfx.lineStyle(2.5, this.color, 1);
    this.floorGfx.strokeCircle(this.x, this.y, 9);
    this.edgeGfx.fillStyle(this.color, 0.5);
    this.edgeGfx.fillCircle(this.x, this.y, 7);
    this.edgeGfx.fillStyle(0xffffff, 0.9);
    this.edgeGfx.fillCircle(this.x, this.y, 3.4);
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    if (this._landed) {
      this.scene?.fx?.ventSmoke?.(this.x, this.y, 2);
      SFX.arcFieldClose?.();
    }
    this.floorGfx?.destroy();
    this.edgeGfx?.destroy();
    this.shadowGfx?.destroy();
    this.airGfx?.destroy();
    this.floorGfx = this.edgeGfx = this.shadowGfx = this.airGfx = null;
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

  // Same list, same tick, same sweep, and for the same reason the wake is here:
  // this is a damaging region on the floor, and every damaging region in this
  // game must be reachable by `clearHazards`.
  scene.spawnArcGrenade = (spec) => {
    const g = new ArcGrenade(scene, spec);
    live.push(g);
    return g;
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
