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
    // ── CIRCULATION, AND IT IS DETERMINISTIC ──────────────────────────────
    // One phase in TURNS around the perimeter, advanced by delta. The packets
    // are derived from it at fixed offsets rather than stored, so they can
    // never drift apart, never need re-seeding and carry no randomness at all
    // — a machine's current going round a ring is the one thing in this effect
    // that must look CONTROLLED. Everything stochastic here is a snap.
    this._pktT = 0;
    this._armed = false;       // one-shot: the activation beat has played
    this._landed = false;

    // ── EIGHT PROJECTOR NODES, AND THEY ARE THE WHOLE GEOMETRY ────────────
    // The rejected build drew SIXTEEN boundary arcs between random endpoints
    // on an invisible circle plus three to five interior arcs with random ends
    // — a shape with no anchors, which is what "scribbled with a pen" means.
    // Every endpoint in this build is one of nine declared points: the core, or
    // one of eight nodes spaced exactly 45 degrees apart ON the real radius.
    // An arc that knows where it starts and where it ends is the whole of the
    // difference between engineered and procedural.
    this.nodes = 8;
    this._nodeA = -Math.PI / 2;      // the first node is due north, deliberately
    this.floorGfx = scene.add.graphics().setDepth(HAZARD_DEPTH);
    this.edgeGfx = scene.add.graphics().setDepth(HAZARD_DEPTH + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    // THE THROWN OBJECT FLIES OVER THE ROOM. A flying thing at the flat hazard
    // depth is drawn under every actor, which is the one thing a projectile the
    // player is supposed to watch may not be. Its SHADOW stays on the deck.
    this.shadowGfx = scene.add.graphics().setDepth(HAZARD_DEPTH - 1);
    this.airGfx = scene.add.graphics().setDepth(2001);
    // ── THE PHYSICAL DEVICE ───────────────────────────────────────────────
    // A painted object, not a Graphics circle with a dot in it. IF A THING
    // LOOKS LIKE AN EMITTER IT MUST EMIT, and its converse binds harder here:
    // a field with a placeholder at its centre is a painted mark on the floor
    // and the machine that made it has not been drawn. It flies as the
    // projectile and it stays as the source, so it is ONE object for the whole
    // lifecycle — the same claim `weaponSprite` makes about Vader's saber.
    this.body = scene.add.image(spec.x, spec.y, 'hz-arcnade', 0)
      .setDepth(2002);
  }

  /** World position of projector node `i`. ON the real radius, always. */
  _node(i) {
    const a = this._nodeA + (i / this.nodes) * Math.PI * 2;
    return { x: this.x + Math.cos(a) * this.radius,
      y: this.y + Math.sin(a) * this.radius, a };
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

  /**
   * ── AN ENGINEERED FIELD, NOT A PROCEDURAL ONE ───────────────────────────
   *
   * WHAT WAS REMOVED. Sixteen boundary arcs between RANDOM endpoints on an
   * invisible circle; three to five interior arcs with random endpoints; three
   * stacked translucent discs. Nothing in it had an anchor, which is exactly
   * the freehand look the handset rejected — and the stacked discs were loud
   * enough that the floor effect started competing with the Captain, which is
   * the Interdictor failure arriving on a different actor.
   *
   * WHAT REPLACED IT. NINE DECLARED POINTS: the device at the centre, and eight
   * projector nodes at exact 45-degree intervals ON the real radius. The
   * perimeter is eight true circular ARCS at that radius with clean gaps at the
   * nodes — `Graphics.arc` on `this.radius`, so the painted edge is the hit
   * test's own number rather than something jittered toward it. Every bolt runs
   * between two of the nine points. One restrained interior wash instead of
   * three discs.
   *
   * THE BOUNDARY IS THE RADIUS BY CONSTRUCTION. There is no jitter cap to get
   * wrong: an arc drawn at `r` is at `r`, and a chord between two nodes is
   * inside the circle by geometry. Nothing decorative is drawn outside it.
   */
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
      // THE DEVICE IS THE PROJECTILE. It tumbles — a thrown object that held
      // one attitude the whole way would read as a guided munition — and it
      // stays INERT in the air, because the thing that arms it is landing.
      this.body.setVisible(true).setPosition(gx, gy - alt)
        .setFrame(0).setRotation(this.age * 0.011).setScale(1);
      // A short charging spark off one prong. Restrained on purpose: §19 asks
      // for the projectile to remain the actor rather than the trail.
      if (Math.random() < 0.4) {
        const pa = this.age * 0.011 + Math.PI / 4;
        this._bolt(this.airGfx, gx + Math.cos(pa) * 16, gy - alt + Math.sin(pa) * 16,
          gx + Math.cos(pa) * 26, gy - alt + Math.sin(pa) * 26,
          5, 1.5, this.color, 0.65);
      } else {
        this.airGfx.clear();
      }
      // A FAINT LANDING MARK from the moment it is in the air. Not a telegraph
      // ring — it claims nothing and damages nothing — but the player is
      // entitled to know where the thing they can see flying is going to land.
      this.floorGfx.lineStyle(1.5, this.color, 0.16 + 0.12 * u);
      this.floorGfx.strokeCircle(this.x, this.y, this.radius * (0.55 + 0.45 * u));
      return;
    }

    // ── GROUNDED. The device settles at the centre for the rest of its life ──
    const t = this.age / 1000;
    this.body.setVisible(true).setPosition(this.x, this.y).setRotation(0);

    if (ph === 'arm') {
      // ── THE ACTIVATION SEQUENCE (§21) ────────────────────────────────────
      // Five beats inside `armMs`, and the ORDER is the claim: the device
      // powers up, then it establishes its nodes, then the perimeter closes
      // between them, then the connections form. The dangerous region is fully
      // legible before the hazard is live — the perimeter completes at 74% of
      // the arming time and `contains()` does not return true until 100%.
      const u = (this.age - this.flightMs) / this.armMs;
      // 1. THE CORE ENERGISES, THROUGH A MIDDLE. Inert while it settles,
      //    CHARGING as the nodes are placed, ARMED as the perimeter closes —
      //    so the device's own three-frame ladder runs in step with the five
      //    beats happening around it instead of flipping once at a third.
      this.body.setFrame(u > 0.55 ? 2 : u > 0.18 ? 1 : 0);
      // A small settle: it lands, is briefly squashed, and locks.
      this.body.setScale(1 + Math.max(0, 0.22 - u * 1.6), 1 - Math.max(0, 0.18 - u * 1.4));
      this.edgeGfx.fillStyle(this.color, 0.10 + 0.3 * u);
      this.edgeGfx.fillCircle(this.x, this.y, 9 + 7 * u);
      // 2. THE NODES ESTABLISH, one at a time, clockwise from north — so the
      //    player can watch the machine claim the ground rather than have a
      //    circle appear around them.
      const nodeT = Phaser.Math.Clamp((u - 0.18) / 0.42, 0, 1);
      const upTo = nodeT * this.nodes;
      for (let i = 0; i < this.nodes; i++) {
        const k = Phaser.Math.Clamp(upTo - i, 0, 1);
        if (k <= 0) continue;
        const n = this._node(i);
        // The projector beam that places it: centre to node, a straight line
        // rather than a bolt, because this is the machine working correctly.
        // The placing beam runs the whole way while the node is being PUT
        // there — that is a machine working, not a graduation — and it is gone
        // the moment the field is live.
        this.edgeGfx.lineStyle(1.5, this.color, 0.30 * k * (1 - k * 0.5));
        this.edgeGfx.lineBetween(this.x, this.y, n.x, n.y);
        this._drawNode(n, k, 1);
      }
      // 3. THE PERIMETER CLOSES between established nodes.
      const perim = Phaser.Math.Clamp((u - 0.34) / 0.40, 0, 1);
      if (perim > 0) this._drawPerimeter(perim, 0.5 + 0.5 * perim, 1);
      // 4. THE CONNECTIONS FORM — the last beat, and the only random one.
      if (u > 0.78 && Math.random() < 0.5) {
        const i = Math.floor(Math.random() * this.nodes);
        const n = this._node(i);
        this._bolt(this.edgeGfx, this.x, this.y, n.x, n.y, 8, 2, 0xffffff, 0.55);
      }
      return;
    }

    // ── THE ACTIVE FIELD ────────────────────────────────────────────────────
    const integ = this._integrity;
    // The core is the LAST thing to go out, and it goes out by STEPPING BACK
    // DOWN ITS OWN LADDER — armed, then charging, then inert — rather than by
    // fading. The device is still there afterwards, unpowered, which is the
    // whole difference between a machine shutting down and an effect ending.
    this.body.setFrame(integ > 0.45 ? 2 : integ > 0.14 ? 1 : 0).setScale(1);
    if (integ < 1) {
      this.edgeGfx.fillStyle(this.color, 0.30 * integ);
      this.edgeGfx.fillCircle(this.x, this.y, 10 + 6 * integ);
    }
    // ONE WASH, NOT THREE DISCS. The floor has to stay readable under it (§25):
    // the deck, its plating and a player standing on it all survive this, where
    // three stacked fills turned the whole circle into a solid object.
    this.floorGfx.fillStyle(0x071620, 0.34 * integ);
    this.floorGfx.fillCircle(this.x, this.y, this.radius);
    // ── CORE EMISSION, AND DELIBERATELY NOT EIGHT FULL SPOKES ─────────────
    // A BIG ROUND PROP DEFAULTS TO A DIAL, AND A DIAL IS A UI WIDGET — the
    // rule this project already carries for the hero machine, and a perfect
    // circle with eight radial spokes and eight tick marks on it is a RADAR.
    // Four of them, alternating, stopping well short of the rim: the centre is
    // visibly feeding the edge without the result reading as graduations.
    for (let i = 0; i < this.nodes; i += 2) {
      const n = this._node(i);
      this.floorGfx.lineStyle(2, this.color, 0.13 * integ);
      this.floorGfx.lineBetween(this.x, this.y,
        this.x + (n.x - this.x) * 0.52, this.y + (n.y - this.y) * 0.52);
    }
    // ── SHUTDOWN IS A SEQUENCE, NOT ONE TWEEN TO ZERO (§29) ────────────────
    // `_integrity` runs 1 -> 0 across `warnMs` and the beats are read off it in
    // the order the machine would actually fail: the connections stop first,
    // then the perimeter opens up segment by segment, then the nodes retract,
    // and the core is the last thing to go out. The field is dangerous for
    // every millisecond of it — `contains()` is true until `fieldMs` — so the
    // strobe keeps the edge legible the whole way down rather than fading it
    // out under a player who is still standing in it.
    const strobe = integ < 1 ? (0.45 + 0.55 * Math.sin(t * 34)) : 1;
    const arcsLive = integ > 0.55;                 // connections cease first
    const perimGrow = Phaser.Math.Clamp(integ / 0.45, 0.24, 1);
    this._drawPerimeter(perimGrow, strobe, Math.max(integ, 0.42));
    for (let i = 0; i < this.nodes; i++) {
      this._drawNode(this._node(i), Phaser.Math.Clamp(integ / 0.3, 0.3, 1),
        Math.max(integ, 0.42) * strobe);
    }

    // ── TRAVELLING PACKETS — THE FIELD'S CIRCULATION ──────────────────────
    // WHAT THIS ANSWERS: everything moving in the live field used to be a
    // SNAP — a bolt that appeared somewhere and was gone 90ms later. A machine
    // that only ever flickers is a machine with a fault; one with current
    // going round it is a machine that is running. These are three short
    // bright arcs travelling the perimeter at a constant rate, derived from a
    // single phase so they are evenly spaced by construction.
    //
    // THEY RIDE `this.radius`, the hit test's own number, so the one moving
    // thing on the boundary cannot misreport where the boundary is. And they
    // are ARCS, not dots: a dot running a circle is a loading spinner, which is
    // the UI read this field has already been pulled back from once.
    this._pktT = (this._pktT + delta / 2600) % 1;
    for (let k = 0; k < 3; k++) {
      const turn = (this._pktT + k / 3) % 1;
      const a1 = this._nodeA + turn * Math.PI * 2;
      this.edgeGfx.lineStyle(2.5, 0xffffff, 0.5 * integ * strobe);
      this.edgeGfx.beginPath();
      this.edgeGfx.arc(this.x, this.y, this.radius, a1 - 0.13, a1);
      this.edgeGfx.strokePath();
      this.edgeGfx.fillStyle(0xffffff, 0.85 * integ * strobe);
      this.edgeGfx.fillCircle(this.x + Math.cos(a1) * this.radius,
        this.y + Math.sin(a1) * this.radius, 2);
    }

    // ── THE CONNECTIONS. Re-rolled on their own clock, never per frame ──────
    // Per-frame randomisation at 60fps is a strobe and at 15fps is a different
    // effect entirely; a fixed re-roll interval reads the same on both, which
    // is the frame-rate lesson this project keeps relearning. Each entry is a
    // PAIR OF DECLARED POINTS — core-to-node or node-to-neighbour — so the
    // current always has somewhere it came from and somewhere it is going.
    if (!arcsLive) { this._crawl.length = 0; return; }
    this._crawlT -= delta;
    if (this._crawlT <= 0) {
      this._crawlT = 90;
      this._crawl.length = 0;
      const n = 2 + Math.floor(Math.random() * 2);
      for (let k = 0; k < n; k++) {
        const i = Math.floor(Math.random() * this.nodes);
        // Two thirds of them are the perimeter discharging between neighbours,
        // a third are the core feeding a node.
        this._crawl.push(Math.random() < 0.34
          ? { from: -1, to: i } : { from: i, to: (i + 1) % this.nodes });
      }
    }
    for (const c of this._crawl) {
      const a = c.from < 0 ? { x: this.x, y: this.y } : this._node(c.from);
      const b = this._node(c.to);
      // Jitter is bounded well under the node spacing and both ENDPOINTS are
      // exact, so a bolt can bow inward and can never claim ground outside the
      // radius — the endpoints are on it and the middle is inside it.
      this._bolt(this.edgeGfx, a.x, a.y, b.x, b.y, 10, 2,
        c.from < 0 ? 0xffffff : this.color, 0.55 * integ * strobe);
    }
  }

  /**
   * ONE PROJECTOR NODE — a small bracket sitting ON the boundary.
   *
   * Drawn as a short radial post with a bright cap rather than a dot: a dot is
   * a particle and a post is a fitting, and the difference is what makes eight
   * of them read as equipment the device put there. It extends INWARD from the
   * radius, never outward, so nothing about it implies danger past the edge.
   */
  _drawNode(n, k, alpha) {
    const ci = Math.cos(n.a), si = Math.sin(n.a);
    this.edgeGfx.lineStyle(3, this.color, 0.75 * k * alpha);
    this.edgeGfx.lineBetween(n.x - ci * 9 * k, n.y - si * 9 * k, n.x, n.y);
    this.edgeGfx.fillStyle(0xffffff, 0.9 * k * alpha);
    this.edgeGfx.fillCircle(n.x, n.y, 2.6 * k);
    this.edgeGfx.fillStyle(this.color, 0.35 * k * alpha);
    this.edgeGfx.fillCircle(n.x, n.y, 5.5 * k);
  }

  /**
   * THE PERIMETER — eight TRUE CIRCULAR ARCS at the real radius.
   *
   * `Graphics.arc` at `this.radius` is the hit test's own number, so the
   * painted edge cannot drift from the resolved one by any amount at all. The
   * gaps at the nodes are what make it read as segmented hardware rather than
   * as a drawn circle, and `grow` sweeps each segment out from its node during
   * the activation so the boundary is seen to be BUILT.
   */
  _drawPerimeter(grow, strobe, integ) {
    const step = (Math.PI * 2) / this.nodes;
    // WIDER GAPS THAN THE FIRST BUILD. At 0.085 the eight segments closed into
    // something the eye read as one drawn circle with tick marks on it; at 0.14
    // they are eight separate fences held between eight emitters, which is the
    // difference between a dial and a piece of equipment.
    const gap = 0.14;
    for (let i = 0; i < this.nodes; i++) {
      const a0 = this._nodeA + i * step + gap;
      const a1 = this._nodeA + (i + 1) * step - gap;
      const end = a0 + (a1 - a0) * grow;
      if (end <= a0) continue;
      this.edgeGfx.lineStyle(3, this.color, 0.7 * strobe * integ);
      this.edgeGfx.beginPath();
      this.edgeGfx.arc(this.x, this.y, this.radius, a0, end);
      this.edgeGfx.strokePath();
      // A white inner rail one pixel in: the edge reads at 1x on a dark deck
      // without the outer line ever being drawn at more than the true radius.
      this.edgeGfx.lineStyle(1, 0xffffff, 0.45 * strobe * integ);
      this.edgeGfx.beginPath();
      this.edgeGfx.arc(this.x, this.y, this.radius - 2.5, a0, end);
      this.edgeGfx.strokePath();
    }
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
    // THE DEVICE GOES WITH THE FIELD. It is an Image rather than a Graphics and
    // is therefore the one thing here that would survive a sweep that only
    // remembered the four Graphics — the same shape as a `postupdate` handler
    // closed over a dead boss.
    this.body?.destroy();
    this.floorGfx = this.edgeGfx = this.shadowGfx = this.airGfx = null;
    this.body = null;
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
