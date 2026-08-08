// Telegraphs — the grammar that turns damage into a decision.
//
// ── Why this exists ───────────────────────────────────────────────────────
//
// The first pass at giving nemeses variety shipped four weapons: a 5-pellet
// cone, a 3-shell spread, a heavy single shot, a staggered burst. All four are
// the same VERB — bolts leave a gun — and the player answers all four the same
// way, by strafing. The verdict was correct: "it was just multiple shots."
//
// Variety in a projectile's numbers is not variety in play. What makes a fight
// worth dodging is a shape every action game shares:
//
//     TELEGRAPH  ->  COMMIT  ->  PUNISH WINDOW
//
// The game already contained exactly one instance of it. The sniper draws a
// laser that tracks you, freezes for its final 260ms, then fires — so a dash
// across the beam beats it, and standing still does not. That is the thing this
// file generalises so every move can be built from it.
//
// ── The fairness contract, as arithmetic ──────────────────────────────────
//
// "Readable and fair" is a feeling until it is a number, so it is a number
// here. Read from PLAYER config, not invented:
//
//     dash = 950px/s x 240ms = 228px of travel, 2 charges, 2.8s recharge
//
// A telegraphed zone is FAIR when one dash from the worst position inside it
// lands outside it. That makes a 150px slam fair and a 400px one a trap, and it
// is asserted directly in tests/smoke-moves.mjs rather than eyeballed.
//
// Windups sit around 800ms against the ~250ms a human needs to react. The extra
// is not padding: on a phone the thumb has to travel, and the player is usually
// mid-decision about something else.
//
// ── Three traps this had to respect ───────────────────────────────────────
//
// 1. DEPTH. These are ground decals and must sit UNDER the actors standing on
//    them. Actors Y-sort and walls sort at `y + 56`, a band spanning ~150-1656
//    in a 1600px arena; a telegraph drawn on the usual flat constants would sit
//    under the floor art, and one drawn in the band would cover the enemy
//    casting it. See the DEPTH note in config.js — this is its third victim.
// 2. OWNERSHIP. A telegraph belongs to whoever cast it and dies with them. An
//    orphan is a permanent red circle on an empty floor, and orphaned
//    attachments have shipped here before.
// 3. TEARDOWN. Resolve fires on a delayedCall. If the scene died in between —
//    room change, player death, restart — it must no-op rather than reach into
//    a destroyed world.

// Under the Y-sorted actor band (~150+) and above the floor decals, so a
// telegraph always reads as painted ON the floor with actors standing on top.
export const TELEGRAPH_DEPTH = 12;

// The player's dash, in pixels. Every zone is sized against this.
export const DASH_REACH = 228;

const DANGER = 0xff3020;
// Tuned FOR the ADD blend, not independently of it. ADD adds this colour to the
// floor, so a dark fill on a dark floor is very nearly a no-op: the first
// version of this used 0x882010 and the zone was so faint that a screenshot of
// a live SABER THROW showed only the saber sprite, with the 620x150 lane
// underneath it effectively invisible. The fill has to be a BRIGHT colour at a
// modest alpha, not a dark one at a high alpha.
const DANGER_FILL = 0xc42a14;

// A zone the player should stand IN, for moves that fill everywhere else
// (SHOCKWAVE RING). Drawn green because red means "leave" everywhere else in
// the game, and a safe wedge drawn in the danger colour tells the player to run
// out of the only survivable spot. The logic can be perfect and the telegraph
// still lie — that combination is what a screenshot catches and a test does not.
export const SAFE_COLOR = 0x40ff90;
const SAFE_FILL = 0x108040;

/**
 * A single telegraphed zone.
 *
 * Construct it, and it draws itself filling over `windupMs`; at commit it
 * flashes and calls `onCommit`. The shape is described once and reused for both
 * the drawing and the hit test, so what is drawn and what hurts you cannot
 * drift apart — which is the single most important property here. A telegraph
 * that lies is worse than no telegraph.
 */
export class Telegraph {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} shape  {kind:'circle'|'cone'|'lane', ...geometry}
   * @param {object} opts   {windupMs, owner, onCommit, color}
   */
  constructor(scene, shape, opts = {}) {
    this.scene = scene;
    this.shape = shape;
    this.windupMs = Math.max(1, opts.windupMs ?? 800);
    this.elapsed = 0;
    this.committed = false;
    this.dead = false;
    this.onCommit = opts.onCommit || null;
    // `safe` inverts the read: stand HERE rather than leave.
    this.safe = !!opts.safe;
    this.color = opts.color ?? (this.safe ? SAFE_COLOR : DANGER);
    // The fill follows the outline's hue. A move that passes its own colour —
    // FORCE PUSH is pale blue, FORCE PULL violet — used to get that colour on
    // the outline and the stock RED inside it, which reads as two different
    // warnings stacked on each other. Derived, so a new move only ever has to
    // name one colour.
    this.fillColor = opts.fillColor
      ?? (this.safe ? SAFE_FILL : (opts.color ? this._shade(opts.color, 0.3) : DANGER_FILL));

    // THREE layers, split by blend mode, because one mode cannot do both jobs.
    //
    //   shadowGfx  NORMAL, underneath — a near-black outline. The floor is dark
    //              (#161620) and a mid-dark stroke on it is invisible; this is
    //              the same lesson `groundFractures` in FX.js had to learn.
    //   fillGfx    NORMAL — the body of the zone. This one must NOT be ADD.
    //              Additive blending adds to every channel, so a red fill over
    //              the room's blue-grey floor came out a washed-out beige that
    //              read as "some UI panel", not "this will hurt". Measured off a
    //              screenshot: floor (25,52,64) + salmon*0.46 = (120,86,87).
    //   gfx        ADD, on top — outline and the leading edge only, where bloom
    //              is exactly what you want and there is no muddying to do.
    this.shadowGfx = scene.add.graphics().setDepth(TELEGRAPH_DEPTH - 1);
    this.fillGfx = scene.add.graphics().setDepth(TELEGRAPH_DEPTH);
    this.gfx = scene.add.graphics().setDepth(TELEGRAPH_DEPTH + 1)
      .setBlendMode(Phaser.BlendModes.ADD);

    // Owned by the caster: `die()` and `_destroyEnemyFully` both sweep
    // `_attachments`, so registering here is the whole of the cleanup story.
    this.owner = opts.owner || null;
    if (this.owner?._attachments) this.owner._attachments.push(this);

    // THE ZONE FOLLOWS ITS CASTER while it winds up, unless it is deliberately
    // pinned to a spot in the world (`anchor: 'world'` — a landing marker has
    // to stay where it will land, not trail the thing that is teleporting).
    //
    // Without this a zone freezes its origin at spawn while the caster walks
    // on: measured on the rejected build, Vader left his own lane by 163px
    // before it fired. A telegraph that does not come out of the thing that
    // will hit you is not a telegraph, it is a red rectangle.
    this.anchored = opts.anchor === 'world';
    if (!this.anchored && this.owner) {
      this._ownerOffX = shape.x - this.owner.x;
      this._ownerOffY = shape.y - this.owner.y;
    }

    this._draw(0);
  }

  /** Driven from the scene's update. Returns false once it is finished. */
  update(delta) {
    if (this.dead) return false;
    this.elapsed += delta;
    const t = Math.min(1, this.elapsed / this.windupMs);
    if (!this.committed) this._followOwner();
    this._draw(t);

    if (!this.committed && this.elapsed >= this.windupMs) {
      this.committed = true;
      this._flash();
      // Guarded: a move whose scene went away mid-windup must not reach into a
      // destroyed world. Room changes and player death both do this.
      if (this.scene?.scene?.isActive?.() && this.onCommit) this.onCommit(this);
      // Linger a beat so the commit is visible, then clean up.
      this._lingerMs = 120;
    }
    if (this.committed) {
      this._lingerMs -= delta;
      if (this._lingerMs <= 0) { this.destroy(); return false; }
    }
    return true;
  }

  /**
   * Is a point inside the danger zone?
   *
   * The SAME geometry the graphics use. Damage-at-commit calls this, so "what
   * was drawn" and "what hit me" are one description.
   */
  contains(px, py) {
    const s = this.shape;
    const dx = px - s.x, dy = py - s.y;
    const d = Math.hypot(dx, dy);

    if (s.kind === 'circle') return d <= s.r;

    if (s.kind === 'cone') {
      if (d > s.len) return false;
      const a = Math.atan2(dy, dx);
      let diff = Math.abs(this._wrap(a - s.angle));
      return diff <= (s.spreadDeg * Math.PI) / 180 / 2;
    }

    if (s.kind === 'lane') {
      // Project onto the lane axis; inside if within length and half-width.
      const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
      const along = dx * ca + dy * sa;
      const across = -dx * sa + dy * ca;
      return along >= 0 && along <= s.len && Math.abs(across) <= s.width / 2;
    }
    return false;
  }

  /**
   * The shortest distance from a point inside the zone to its edge.
   *
   * This is what makes the fairness contract checkable: if the worst case is
   * <= DASH_REACH, one dash escapes. Returns 0 for a point already outside.
   */
  escapeDistance(px, py) {
    if (!this.contains(px, py)) return 0;
    const s = this.shape;
    const dx = px - s.x, dy = py - s.y;
    const d = Math.hypot(dx, dy);

    if (s.kind === 'circle') return s.r - d;
    if (s.kind === 'cone') {
      // Out the side is usually nearer than out the front, so take the smaller.
      const half = (s.spreadDeg * Math.PI) / 180 / 2;
      const a = Math.atan2(dy, dx);
      const angOff = half - Math.abs(this._wrap(a - s.angle));
      return Math.min(s.len - d, Math.sin(Math.max(0, angOff)) * d);
    }
    if (s.kind === 'lane') {
      const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
      const across = Math.abs(-dx * sa + dy * ca);
      return s.width / 2 - across;    // sideways is always the short way out
    }
    return 0;
  }

  /** Worst case anywhere in the zone — the number the fairness test reads. */
  worstEscape() {
    const s = this.shape;
    if (s.kind === 'circle') return s.r;                 // dead centre
    if (s.kind === 'lane') return s.width / 2;           // the middle line
    if (s.kind === 'cone') {
      // Deep on the axis: the side wall is `sin(half) * len` away at the tip.
      const half = (s.spreadDeg * Math.PI) / 180 / 2;
      return Math.min(s.len, Math.sin(half) * s.len);
    }
    return 0;
  }

  _wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

  /** Keep the zone's origin on the caster while it is still winding up. */
  _followOwner() {
    const o = this.owner;
    if (this.anchored || !o?.active || !o.alive) return;
    this.shape.x = o.x + this._ownerOffX;
    this.shape.y = o.y + this._ownerOffY;
  }

  // ── The drawing, and the one job it has ─────────────────────────────────
  //
  // A zone has to answer two questions at a glance, on a phone, while the
  // player is doing something else: WHERE, and WHEN. The version this replaces
  // answered only the first — one 3px stroke and a 28%-alpha fill that crept
  // outward — and the verdict was "too simple blue circle or red rectangle".
  //
  // WHERE is the outline: full size from frame one, never a jump scare.
  // WHEN is a fill that sweeps out from the caster with a BRIGHT BAR RIDING ITS
  // FRONT. The bar is the whole trick: an edge travelling at a constant speed
  // is something the eye tracks and can extrapolate, so you know how long you
  // have without counting. A creeping fill with no front edge does not read as
  // time at all. This is the League-of-Legends charge-indicator grammar
  // (Sion's Q), and it is what was asked for.
  //
  // Everything ramps toward the moment of impact: the fill brightens, the
  // outline thickens, and the last 25% adds a pulse that gets faster. By the
  // time it fires you should have felt it coming for half a second.
  _draw(t) {
    const g = this.gfx;
    const sh = this.shadowGfx;
    const fg = this.fillGfx;
    if (!g?.active) return;
    g.clear();
    sh?.clear();
    fg?.clear();
    const s = this.shape;

    // Hot as it lands. The fill goes from a dim ember to near-white so the
    // final frames are unmistakably "now".
    const heat = t * t;                          // late-biased, so the ramp bites
    const fillA = 0.42 + 0.34 * heat;
    const fillC = this._mix(this.fillColor, 0xff9060, heat * 0.6);
    const edgeC = this.safe ? this.color : this._mix(this.color, 0xffffff, heat * 0.7);

    // The pulse in the last quarter. Frequency climbs, so it reads as a
    // countdown accelerating rather than a steady blink.
    const late = Math.max(0, (t - 0.75) / 0.25);
    const pulse = late > 0 ? 1 + 0.55 * Math.abs(Math.sin(late * late * 22)) : 1;
    const lineW = (3.5 + 2.5 * heat) * pulse;

    if (s.kind === 'circle') {
      sh?.lineStyle(lineW + 4, 0x05050a, 0.85);
      sh?.strokeCircle(s.x, s.y, s.r);
      fg?.fillStyle(fillC, fillA);
      if (t > 0) fg?.fillCircle(s.x, s.y, s.r * t);
      fg?.lineStyle(lineW, edgeC, 1);
      fg?.strokeCircle(s.x, s.y, s.r);
      // Leading edge: a bright ring expanding to meet the outline.
      if (t > 0.02 && t < 1) {
        g.lineStyle(3 + 3 * heat, 0xffc0a0, 0.55 + 0.45 * heat);
        g.strokeCircle(s.x, s.y, s.r * t);
      }
    } else if (s.kind === 'cone') {
      const half = (s.spreadDeg * Math.PI) / 180 / 2;
      sh?.lineStyle(lineW + 4, 0x05050a, 0.85);
      this._arcPath(sh, s.x, s.y, s.len, s.angle - half, s.angle + half, false);
      fg?.fillStyle(fillC, fillA);
      if (t > 0 && fg) this._arcPath(fg, s.x, s.y, s.len * t, s.angle - half, s.angle + half, true);
      fg?.lineStyle(lineW, edgeC, 1);
      if (fg) this._arcPath(fg, s.x, s.y, s.len, s.angle - half, s.angle + half, false);
      if (t > 0.02 && t < 1) {
        g.lineStyle(3 + 3 * heat, 0xffc0a0, 0.55 + 0.45 * heat);
        g.beginPath();
        const N = 14;
        for (let i = 0; i <= N; i++) {
          const a = s.angle - half + (2 * half * i) / N;
          const px = s.x + Math.cos(a) * s.len * t;
          const py = s.y + Math.sin(a) * s.len * t;
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.strokePath();
      }
    } else if (s.kind === 'lane') {
      const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
      const hw = s.width / 2;
      const quad = (from, to) => [
        { x: s.x + ca * from - sa * hw, y: s.y + sa * from + ca * hw },
        { x: s.x + ca * to - sa * hw, y: s.y + sa * to + ca * hw },
        { x: s.x + ca * to + sa * hw, y: s.y + sa * to - ca * hw },
        { x: s.x + ca * from + sa * hw, y: s.y + sa * from - ca * hw },
      ];
      const path = (gfx, pts, fill) => {
        gfx.beginPath();
        gfx.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach((p) => gfx.lineTo(p.x, p.y));
        gfx.closePath();
        if (fill) gfx.fillPath(); else gfx.strokePath();
      };

      sh?.lineStyle(lineW + 4, 0x05050a, 0.85);
      if (sh) path(sh, quad(0, s.len), false);
      fg?.fillStyle(fillC, fillA);
      if (t > 0 && fg) path(fg, quad(0, s.len * t), true);
      fg?.lineStyle(lineW, edgeC, 1);
      if (fg) path(fg, quad(0, s.len), false);

      // THE LEADING BAR. Perpendicular to the lane, riding the fill front.
      if (t > 0.02 && t < 1) {
        const fx = s.x + ca * s.len * t, fy = s.y + sa * s.len * t;
        g.lineStyle(5 + 5 * heat, 0xffd8b0, 0.6 + 0.4 * heat);
        g.beginPath();
        g.moveTo(fx - sa * hw, fy + ca * hw);
        g.lineTo(fx + sa * hw, fy - ca * hw);
        g.strokePath();
      }
    }
  }

  /**
   * Darken a packed RGB colour, keeping its hue.
   *
   * Uniform across channels on purpose: darkening the channels unevenly drags
   * every fill toward red, which defeats the point of a move naming its own
   * colour. Kept mild — the fill sits at ~0.42 alpha over a dark floor, and
   * anything heavily darkened lands as mud rather than as a coloured zone.
   */
  _shade(c, k) {
    const f = 1 - k;
    return (Math.round(((c >> 16) & 255) * f) << 16)
      | (Math.round(((c >> 8) & 255) * f) << 8)
      | Math.round((c & 255) * f);
  }

  /** Blend two packed RGB colours. Used to heat the outline toward white. */
  _mix(a, b, k) {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    const r = Math.round(ar + (br - ar) * k);
    const gg = Math.round(ag + (bg - ag) * k);
    const bl = Math.round(ab + (bb - ab) * k);
    return (r << 16) | (gg << 8) | bl;
  }

  _arcPath(g, cx, cy, r, a0, a1, fill) {
    g.beginPath();
    g.moveTo(cx, cy);
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath();
    if (fill) g.fillPath(); else g.strokePath();
  }

  // The snap. The sweep has been promising this for the whole wind-up, so it
  // has to arrive as an event: the zone goes white all at once, a ring punches
  // out of the origin, and dust lifts along the axis.
  _flash() {
    const g = this.gfx;
    if (!g?.active) return;
    const s = this.shape;
    this.shadowGfx?.clear();
    this.fillGfx?.clear();
    g.clear();
    g.fillStyle(this.safe ? SAFE_COLOR : 0xffffff, this.safe ? 0.32 : 0.7);
    if (s.kind === 'circle') {
      g.fillCircle(s.x, s.y, s.r);
    } else if (s.kind === 'cone') {
      const half = (s.spreadDeg * Math.PI) / 180 / 2;
      this._arcPath(g, s.x, s.y, s.len, s.angle - half, s.angle + half, true);
    } else if (s.kind === 'lane') {
      const ca = Math.cos(s.angle), sa = Math.sin(s.angle), hw = s.width / 2;
      g.beginPath();
      g.moveTo(s.x - sa * hw, s.y + ca * hw);
      g.lineTo(s.x + ca * s.len - sa * hw, s.y + sa * s.len + ca * hw);
      g.lineTo(s.x + ca * s.len + sa * hw, s.y + sa * s.len - ca * hw);
      g.lineTo(s.x + sa * hw, s.y - ca * hw);
      g.closePath();
      g.fillPath();
    }

    if (!this.safe) {
      const fx = this.scene.fx;
      fx?.impactRing?.(s.x, s.y, 0xffffff, TELEGRAPH_DEPTH + 1);
      // Dust lifted along the zone's own axis, so the commit reads as something
      // happening to the FLOOR rather than a light turning on.
      const along = s.kind === 'circle' ? 0 : (s.len || 0);
      const ca = Math.cos(s.angle || 0), sa = Math.sin(s.angle || 0);
      for (let i = 0; i < 5; i++) {
        const u = along ? (i / 4) * along : 0;
        fx?.dustPuff?.(s.x + ca * u + (Math.random() - 0.5) * 20,
                       s.y + sa * u + (Math.random() - 0.5) * 14);
      }
    }
    this.scene.fx?.shake?.(0.012, 110);
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.gfx?.destroy();
    this.gfx = null;
    this.shadowGfx?.destroy();
    this.shadowGfx = null;
    this.fillGfx?.destroy();
    this.fillGfx = null;
    const list = this.owner?._attachments;
    if (list) {
      const i = list.indexOf(this);
      if (i >= 0) list.splice(i, 1);
    }
  }
}

/**
 * Scene-side registry.
 *
 * The scene ticks these in one pass rather than each telegraph owning a timer,
 * so a paused or torn-down scene stops all of them at once — the same reason
 * Vader's mechanic clocks live on him rather than as `delayedCall`s.
 */
export function attachTelegraphs(scene) {
  const live = [];
  scene._telegraphs = live;

  scene.spawnTelegraph = (shape, opts) => {
    const t = new Telegraph(scene, shape, opts);
    live.push(t);
    return t;
  };

  scene.tickTelegraphs = (delta) => {
    for (let i = live.length - 1; i >= 0; i--) {
      if (!live[i].update(delta)) live.splice(i, 1);
    }
  };

  scene.clearTelegraphs = () => {
    live.splice(0).forEach((t) => t.destroy());
  };

  return live;
}
