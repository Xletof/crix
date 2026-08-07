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
const DANGER_FILL = 0x882010;

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
    this.fillColor = this.safe ? SAFE_FILL : DANGER_FILL;

    this.gfx = scene.add.graphics().setDepth(TELEGRAPH_DEPTH);

    // Owned by the caster: `die()` and `_destroyEnemyFully` both sweep
    // `_attachments`, so registering here is the whole of the cleanup story.
    this.owner = opts.owner || null;
    if (this.owner?._attachments) this.owner._attachments.push(this);

    this._draw(0);
  }

  /** Driven from the scene's update. Returns false once it is finished. */
  update(delta) {
    if (this.dead) return false;
    this.elapsed += delta;
    const t = Math.min(1, this.elapsed / this.windupMs);
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

  // Outline at full size from the first frame (so the danger is legible
  // immediately) with a fill that grows to meet it (so the REMAINING TIME is
  // legible too). A telegraph that only appears at the end is a jump scare.
  _draw(t) {
    const g = this.gfx;
    if (!g?.active) return;
    g.clear();
    const s = this.shape;

    g.lineStyle(3, this.color, 0.9);
    g.fillStyle(this.fillColor, 0.28);

    if (s.kind === 'circle') {
      g.strokeCircle(s.x, s.y, s.r);
      if (t > 0) g.fillCircle(s.x, s.y, s.r * t);
    } else if (s.kind === 'cone') {
      const half = (s.spreadDeg * Math.PI) / 180 / 2;
      this._arcPath(g, s.x, s.y, s.len, s.angle - half, s.angle + half, false);
      if (t > 0) this._arcPath(g, s.x, s.y, s.len * t, s.angle - half, s.angle + half, true);
    } else if (s.kind === 'lane') {
      const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
      const hw = s.width / 2;
      const pts = (len) => [
        { x: s.x - sa * hw, y: s.y + ca * hw },
        { x: s.x + ca * len - sa * hw, y: s.y + sa * len + ca * hw },
        { x: s.x + ca * len + sa * hw, y: s.y + sa * len - ca * hw },
        { x: s.x + sa * hw, y: s.y - ca * hw },
      ];
      const outline = pts(s.len);
      g.beginPath();
      g.moveTo(outline[0].x, outline[0].y);
      outline.slice(1).forEach((p) => g.lineTo(p.x, p.y));
      g.closePath();
      g.strokePath();
      if (t > 0) {
        const fill = pts(s.len * t);
        g.beginPath();
        g.moveTo(fill[0].x, fill[0].y);
        fill.slice(1).forEach((p) => g.lineTo(p.x, p.y));
        g.closePath();
        g.fillPath();
      }
    }
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

  _flash() {
    const g = this.gfx;
    if (!g?.active) return;
    const s = this.shape;
    g.clear();
    g.fillStyle(this.safe ? SAFE_COLOR : 0xffffff, this.safe ? 0.3 : 0.55);
    if (s.kind === 'circle') g.fillCircle(s.x, s.y, s.r);
    else this._draw(1);
    this.scene.fx?.shake?.(0.008, 90);
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.gfx?.destroy();
    this.gfx = null;
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
