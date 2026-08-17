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
    // One scroll cycle of the kinetic layer, in ms. Lower reads as faster, so a
    // move can hand its own speed in and have the chevrons match what is about
    // to happen rather than every zone pulsing at one generic rate.
    this.kineticMs = opts.kineticMs ?? 620;
    // ── WHICH WAY THE MOVE POINTS ────────────────────────────────────────
    //
    // A circle zone's kinetic ring used to ALWAYS converge inward, because the
    // first circle move that needed one was a slam and inward is what a slam
    // means. FORCE PUSH then inherited it, so a 420px shove that throws you
    // away from him was announced by a ring travelling toward him — the one
    // reading it most needed to give, given exactly backwards. FORCE PULL had
    // the same ring and the same meaning, so the pair were indistinguishable.
    //
    // Cosmetic only: `contains()` never consults this and the geometry is
    // untouched. It changes what the motion SAYS, not what it does.
    this.kinetic = opts.kinetic === 'out' ? 'out' : 'in';
    // ── A ZONE THAT LOADS ────────────────────────────────────────────────
    //
    // For a charged attack (the overhead smash), the wind-up is part of the
    // attack rather than warning UI. `stress` accumulates fractures out of the
    // centre as `t` climbs, so the floor visibly takes the strain before the
    // blade lands and the last quarter is unmistakably a commitment. Seeded
    // once, for the same reason the rim jitter is: rebuilt per frame it crawls
    // like static.
    this.stress = !!opts.stress;
    // ── WHAT THE COMMIT LOOKS LIKE ───────────────────────────────────────
    //
    // The commit bloom throws streaks across the FULL WIDTH of the zone, which
    // is right when the whole width is the hazard — a body ploughing down a
    // lane, a cone of blade. It is wrong for a single object travelling: SABER
    // THROW promises a 150px lane and the blade's actual hit test is a 52px
    // radius that follows it, so a full-width fan overstates the shape of what
    // is coming and, measured off the first review sheet, made the throw's
    // release frame and the CHARGE's release frame the same photograph.
    //
    // 'spear' concentrates the same streaks on the axis. Strictly narrower than
    // the zone, so it can only under-claim, never over-claim — the one
    // direction a telegraph is allowed to be wrong in.
    this.bloom = opts.bloom === 'spear' ? 'spear' : 'fan';
    this.committed = false;
    this.dead = false;
    this.onCommit = opts.onCommit || null;
    // `safe` inverts the read: stand HERE rather than leave.
    this.safe = !!opts.safe;
    // A DANGER zone may never wear the SAFE hue.
    //
    // `safe` inverts the read to "stand here" and paints it SAFE_COLOR
    // (#40ff90). The SWIFT trait's tint is #40ff90 — the same value — so a
    // swift nemesis drew its lethal lanes in the exact colour this system uses
    // to mean the opposite. Seen in a PLANT & SNIPE screenshot: a piercing
    // 900px lane rendered in "stand here" green.
    //
    // Trait colour still comes through for everything else; a hostile zone just
    // gets pulled off that hue far enough to never be confused with it.
    this.color = opts.color ?? (this.safe ? SAFE_COLOR : DANGER);
    if (!this.safe && opts.color != null && this._nearSafeHue(this.color)) {
      this.color = this._mix(this.color, DANGER, 0.55);
    }
    // The fill follows the outline's hue. A move that passes its own colour —
    // FORCE PUSH is pale blue, FORCE PULL violet — used to get that colour on
    // the outline and the stock RED inside it, which reads as two different
    // warnings stacked on each other. Derived, so a new move only ever has to
    // name one colour.
    //
    // ...but the fill is dragged back toward DANGER regardless of the hue it
    // was given. Trait tints are not all threatening: ARMORED is #90a8c0, a
    // pale blue-grey, and a zone filled with it on the brown deck read as a
    // washed-out grey smear rather than as something about to hurt. The outline
    // and the kinetic layer keep the trait's colour so the nemesis still owns
    // its attack; the fill only borrows it.
    this.fillColor = opts.fillColor
      ?? (this.safe
        ? SAFE_FILL
        : (opts.color
          ? this._mix(this._shade(opts.color, 0.35), DANGER_FILL, 0.62)
          : DANGER_FILL));

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

    // ── THE CHARRED RIM ──────────────────────────────────────────────────
    //
    // A plain stroked circle and a plain quad read as debug geometry, which is
    // what "the circles and rectangles shouldn't be too generic, they should
    // all fit theme" is about. The zone is now the saber's heat scoring itself
    // into the deck ahead of the strike: the outline is ragged and uneven,
    // embers sit along it, and it glows harder as it fills.
    //
    // The jitter is SEEDED ONCE here rather than generated per frame. Rebuilt
    // every frame it crawls like static, which reads as a rendering fault; held
    // still, it reads as a burn that is already there.
    this._rim = [];
    for (let i = 0; i < 72; i++) this._rim.push(0.965 + Math.random() * 0.075);
    this._embers = [];
    for (let i = 0; i < 14; i++) {
      this._embers.push({ u: Math.random(), off: (Math.random() - 0.5) * 9, ph: Math.random() * 6.3 });
    }
    // The fracture skeleton for `stress`. Each arm is a fixed jointed path out
    // of the centre; the draw only decides HOW FAR along it has opened, so the
    // crack grows rather than being redrawn somewhere else every frame.
    this._fractures = [];
    if (this.stress) {
      const arms = 11;
      for (let i = 0; i < arms; i++) {
        let a = (i / arms) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
        const pts = [{ x: 0, y: 0 }];
        let px = 0, py = 0;
        for (let seg = 0; seg < 5; seg++) {
          a += (Math.random() - 0.5) * 0.55;
          const step = (0.16 + Math.random() * 0.09);
          px += Math.cos(a) * step;
          py += Math.sin(a) * step;
          pts.push({ x: px, y: py });
        }
        // `at` staggers when each arm starts opening, so the floor splits in
        // stages instead of all at once — that is what makes it read as load
        // building rather than as a decal fading in.
        this._fractures.push({ pts, at: 0.08 + (i / arms) * 0.55 });
      }
    }

    this._draw(0);
  }

  /**
   * Ragged offset for the point `u` (0..1) around a zone's rim.
   *
   * Sampled from the seeded table, so the same point on the outline is always
   * displaced by the same amount.
   */
  _ragged(u) {
    const n = this._rim.length;
    const i = Math.floor(((u % 1) + 1) % 1 * n) % n;
    return this._rim[i];
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
    const fillA = 0.50 + 0.32 * heat;
    const fillC = this._mix(this.fillColor, 0xff9060, heat * 0.6);
    const edgeC = this.safe ? this.color : this._mix(this.color, 0xffffff, heat * 0.7);

    // The pulse in the last quarter. Frequency climbs, so it reads as a
    // countdown accelerating rather than a steady blink.
    const late = Math.max(0, (t - 0.75) / 0.25);
    const pulse = late > 0 ? 1 + 0.55 * Math.abs(Math.sin(late * late * 22)) : 1;
    const lineW = (3.5 + 2.5 * heat) * pulse;

    if (s.kind === 'circle') {
      // The burn line: the same circle, walked with a seeded ragged radius.
      const rimPath = (gfx, rad) => {
        const N = 48;
        gfx.beginPath();
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const a = u * Math.PI * 2;
          const rr = rad * this._ragged(u);
          const px = s.x + Math.cos(a) * rr, py = s.y + Math.sin(a) * rr;
          if (i === 0) gfx.moveTo(px, py); else gfx.lineTo(px, py);
        }
        gfx.closePath();
        gfx.strokePath();
      };
      if (sh) { sh.lineStyle(lineW + 5, 0x05050a, 0.9); rimPath(sh, s.r); }
      fg?.fillStyle(fillC, fillA);
      if (t > 0) fg?.fillCircle(s.x, s.y, s.r * t);
      if (fg) { fg.lineStyle(lineW, edgeC, 1); rimPath(fg, s.r); }
      this._drawStress(g, s, t, heat);
      this._drawEmbers(g, s, t, heat);
      this._drawKinetic(g, s, t, heat);
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
      this._drawKinetic(g, s, t, heat);
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

      // The long edges are burnt, not ruled: walk them with the seeded jitter
      // so the lane reads as scorched into the deck rather than drawn on it.
      // ONE CLOSED burn, not two loose lines. Drawn as a single path down one
      // edge, across the far end, back up the other and closed at his feet —
      // two open squiggles with nothing joining them read as a rendering
      // glitch rather than a scorched patch of deck.
      const burntEdges = (gfx) => {
        const N = 26;
        const edge = (u, side) => {
          const along = s.len * u;
          const wob = hw * this._ragged(u * 0.5 + (side > 0 ? 0 : 0.5));
          return {
            x: s.x + ca * along - sa * wob * side,
            y: s.y + sa * along + ca * wob * side,
          };
        };
        gfx.beginPath();
        for (let i = 0; i <= N; i++) {
          const p0 = edge(i / N, 1);
          if (i === 0) gfx.moveTo(p0.x, p0.y); else gfx.lineTo(p0.x, p0.y);
        }
        for (let i = N; i >= 0; i--) {
          const p1 = edge(i / N, -1);
          gfx.lineTo(p1.x, p1.y);
        }
        gfx.closePath();
        gfx.strokePath();
      };
      if (sh) { sh.lineStyle(lineW + 5, 0x05050a, 0.9); burntEdges(sh); }
      fg?.fillStyle(fillC, fillA);
      if (t > 0 && fg) path(fg, quad(0, s.len * t), true);
      if (fg) { fg.lineStyle(lineW, edgeC, 1); burntEdges(fg); }
      this._drawEmbers(g, s, t, heat);
      this._drawKinetic(g, s, t, heat);

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

  /**
   * Embers along the rim, brightening as the strike approaches.
   *
   * Drawn on the ADD layer so they bloom, and positioned from the same seeded
   * table as the ragged outline so they sit ON the burn rather than floating
   * near it. This is the detail that makes the zone read as heat rather than
   * as a shape someone drew.
   */
  _drawEmbers(g, s, t, heat) {
    if (!g?.active || this.safe) return;
    const now = (this.elapsed || 0) / 260;
    for (const e of this._embers) {
      let px, py;
      if (s.kind === 'circle') {
        const a = e.u * Math.PI * 2;
        const rr = s.r * this._ragged(e.u) + e.off;
        px = s.x + Math.cos(a) * rr;
        py = s.y + Math.sin(a) * rr;
      } else if (s.kind === 'lane') {
        const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
        const along = s.len * e.u;
        const side = e.off >= 0 ? 1 : -1;
        const wob = (s.width / 2) * this._ragged(e.u) + Math.abs(e.off) * 0.5;
        px = s.x + ca * along - sa * wob * side;
        py = s.y + sa * along + ca * wob * side;
      } else {
        const half = (s.spreadDeg * Math.PI) / 180 / 2;
        const a = s.angle - half + 2 * half * e.u;
        const rr = s.len * this._ragged(e.u) + e.off;
        px = s.x + Math.cos(a) * rr;
        py = s.y + Math.sin(a) * rr;
      }
      // Each ember breathes on its own phase, so the rim shimmers unevenly.
      const flick = 0.45 + 0.55 * Math.abs(Math.sin(now * 3 + e.ph));
      const r = (1.6 + 2.2 * heat) * flick;
      g.fillStyle(0xffd0a0, (0.35 + 0.6 * heat) * flick);
      g.fillCircle(px, py, r);
    }
  }

  /** Blend two packed RGB colours. Used to heat the outline toward white. */
  /**
   * Is this colour close enough to SAFE_COLOR to be misread as "stand here"?
   * Compared per channel rather than by hue distance — cheap, and the only
   * case that matters is a tint sitting right on top of the safe green.
   */
  _nearSafeHue(c) {
    const dr = ((c >> 16) & 0xff) - ((SAFE_COLOR >> 16) & 0xff);
    const dg = ((c >> 8) & 0xff) - ((SAFE_COLOR >> 8) & 0xff);
    const db = (c & 0xff) - (SAFE_COLOR & 0xff);
    return Math.abs(dr) < 70 && Math.abs(dg) < 70 && Math.abs(db) < 70;
  }

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
  /**
   * The KINETIC layer — direction and speed, drawn on top of the zone.
   *
   * ── What was missing ────────────────────────────────────────────────────
   *
   * The zone already said WHERE (the outline) and WHEN (the fill sweeping to a
   * leading edge). What it never said was WHICH WAY and HOW FAST, and those are
   * the two things a player actually needs from an incoming attack — the note
   * was "stuff that will show velocity direction impact".
   *
   * Everything here scrolls on `elapsed` rather than on `t`. That is the whole
   * trick: `t` is a countdown and always crawls at the same rate whatever the
   * move is, while a scroll rate can be tied to how fast the thing will
   * actually travel, so a 1150px/s slide reads visibly more urgent than a
   * 640px/s retreat. It is drawn on the ADD layer so it reads as light over the
   * zone rather than as more paint in it.
   *
   * Purely cosmetic — `contains` never consults any of it.
   */
  /**
   * The STRESS layer — a floor that is being loaded, not a floor being warned.
   *
   * Only drawn for zones that asked for it (the overhead smash). Three things
   * accumulate with `t` and none of them reset: fractures open outward from the
   * centre one after another, the core brightens, and a compression ring pulls
   * the eye to the point the blade will land. By the last quarter the zone is
   * visibly under more load than it was at the start, which is the difference
   * between "this will hurt in a moment" and "he is committing to this".
   */
  _drawStress(g, s, t, heat) {
    if (!this.stress || !g?.active || s.kind !== 'circle') return;
    const R = s.r;
    for (const f of this._fractures) {
      // How far this arm has opened: 0 until its stagger point, then out.
      const k = Math.max(0, Math.min(1, (t - f.at) / (1 - f.at)));
      if (k <= 0) continue;
      const span = (f.pts.length - 1) * k;
      const last = Math.floor(span);
      g.lineStyle(1.5 + 2.6 * k, 0xff5424, 0.30 + 0.6 * k);
      g.beginPath();
      g.moveTo(s.x, s.y);
      for (let i = 1; i <= last; i++) {
        g.lineTo(s.x + f.pts[i].x * R, s.y + f.pts[i].y * R);
      }
      // Partial final segment, so the crack creeps rather than snapping a
      // joint at a time.
      const frac = span - last;
      if (last + 1 < f.pts.length && frac > 0) {
        const a = f.pts[last], b2 = f.pts[last + 1];
        g.lineTo(s.x + (a.x + (b2.x - a.x) * frac) * R,
                 s.y + (a.y + (b2.y - a.y) * frac) * R);
      }
      g.strokePath();
    }
    // The molten core, growing with the load.
    g.fillStyle(0xffcf9a, 0.16 + 0.55 * heat);
    g.fillCircle(s.x, s.y, (7 + 26 * t) * (0.9 + 0.1 * Math.sin(this.elapsed / 40)));
  }

  _drawKinetic(g, s, t, heat) {
    const scroll = (this.elapsed || 0) / Math.max(60, this.kineticMs);
    const bright = 0.35 + 0.5 * heat;
    const tint = this.safe ? SAFE_COLOR : 0xffe0b0;

    if (s.kind === 'lane') {
      // Chevrons racing toward the target. The eye tracks the motion, so the
      // lane reads as a thing rushing down it rather than a rectangle on the
      // floor.
      const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
      const hw = s.width / 2;
      const N = Math.max(3, Math.round(s.len / 110));
      const barb = Math.min(hw * 0.8, 26);
      for (let i = 0; i < N; i++) {
        const u = ((i / N) + scroll) % 1;
        // Fade in at the caster and out at the far end so chevrons appear to
        // travel through the lane instead of popping at its edges.
        const fade = Math.sin(u * Math.PI);
        const along = s.len * u;
        const cx = s.x + ca * along, cy = s.y + sa * along;
        g.lineStyle(3 + 2 * heat, tint, bright * fade);
        g.beginPath();
        g.moveTo(cx - sa * hw - ca * barb, cy + ca * hw - sa * barb);
        g.lineTo(cx, cy);
        g.lineTo(cx + sa * hw - ca * barb, cy - ca * hw - sa * barb);
        g.strokePath();
      }
    } else if (s.kind === 'circle') {
      // ── WHICH WAY ────────────────────────────────────────────────────────
      //
      // The fill grows outward to show the CLOCK, so the kinetic ring is free
      // to carry the move's DIRECTION. Inward converges on the middle, which is
      // what a slam and a pull both mean; outward propagates away from him,
      // which is what a push means. Two rings and two barb sets, so the read
      // survives at a glance on a phone: barbs point the way you are going.
      const u = scroll % 1;
      const inward = this.kinetic === 'in';
      const rr = s.r * (inward ? 1 - u : u);
      const fade = Math.sin(u * Math.PI);
      g.lineStyle(2 + 3 * heat, tint, bright * fade);
      g.strokeCircle(s.x, s.y, Math.max(2, rr));
      // Arrowheads riding the ring. A ring alone is ambiguous the moment you
      // catch it mid-cycle — it is only travelling if you watched it start.
      const BARBS = 8;
      const barb = 13 + 5 * heat;
      for (let i = 0; i < BARBS; i++) {
        const a = (i / BARBS) * Math.PI * 2 + u * 0.5;
        const cx = s.x + Math.cos(a) * rr, cy = s.y + Math.sin(a) * rr;
        // Tip leads the travel; the two tails trail it.
        const tipR = rr + (inward ? -barb : barb);
        const tx = s.x + Math.cos(a) * tipR, ty = s.y + Math.sin(a) * tipR;
        const wing = barb * 0.62;
        g.lineStyle(2 + 1.6 * heat, tint, bright * fade);
        g.beginPath();
        g.moveTo(cx - Math.sin(a) * wing, cy + Math.cos(a) * wing);
        g.lineTo(tx, ty);
        g.lineTo(cx + Math.sin(a) * wing, cy - Math.cos(a) * wing);
        g.strokePath();
      }
      // Gauge ticks around the rim, filling clockwise with the countdown, so
      // the remaining time is readable without watching the fill.
      const TICKS = 24;
      for (let i = 0; i < TICKS; i++) {
        const lit = (i / TICKS) < t;
        const a = -Math.PI / 2 + (i / TICKS) * Math.PI * 2;
        const r0 = s.r * 1.02, r1 = s.r * (lit ? 1.14 : 1.07);
        g.lineStyle(3, tint, lit ? 0.35 + 0.55 * heat : 0.12);
        g.beginPath();
        g.moveTo(s.x + Math.cos(a) * r0, s.y + Math.sin(a) * r0);
        g.lineTo(s.x + Math.cos(a) * r1, s.y + Math.sin(a) * r1);
        g.strokePath();
      }
    } else if (s.kind === 'cone') {
      // Sweep lines fanning from the apex and running outward.
      const half = (s.spreadDeg * Math.PI) / 180 / 2;
      const N = 7;
      for (let i = 0; i <= N; i++) {
        const a = s.angle - half + (i / N) * half * 2;
        const u = ((i / N) * 0.5 + scroll) % 1;
        const r0 = s.len * u * 0.75;
        const r1 = Math.min(s.len, r0 + s.len * 0.22);
        g.lineStyle(2 + 2 * heat, tint, bright * Math.sin(u * Math.PI));
        g.beginPath();
        g.moveTo(s.x + Math.cos(a) * r0, s.y + Math.sin(a) * r0);
        g.lineTo(s.x + Math.cos(a) * r1, s.y + Math.sin(a) * r1);
        g.strokePath();
      }
    }
  }

  _flash() {
    const g = this.gfx;
    if (!g?.active) return;
    const s = this.shape;
    this.shadowGfx?.clear();
    this.fillGfx?.clear();
    g.clear();
    // A DIRECTIONAL bloom on commit for anything with an axis. A flat white
    // flash says "now" and nothing else; streaks thrown along the attack line
    // say which way the thing went, which is the difference between knowing you
    // were hit and knowing what hit you.
    if (!this.safe && (s.kind === 'lane' || s.kind === 'cone')) {
      const bloom = this.scene.add.graphics()
        .setDepth(TELEGRAPH_DEPTH + 2)
        .setBlendMode(Phaser.BlendModes.ADD);
      const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
      const reach = s.kind === 'lane' ? s.len : s.len * 0.9;
      const spread = (s.kind === 'lane' ? s.width / 2 : reach * 0.35)
        * (this.bloom === 'spear' ? 0.22 : 1);
      for (let i = 0; i < 9; i++) {
        const off = (i / 8 - 0.5) * 2 * spread;
        const jitter = 0.55 + 0.45 * this._ragged(i / 9);
        bloom.lineStyle(2 + (i % 3), 0xfff0d0, 0.55);
        bloom.beginPath();
        bloom.moveTo(s.x - sa * off, s.y + ca * off);
        bloom.lineTo(s.x - sa * off + ca * reach * jitter,
          s.y + ca * off + sa * reach * jitter);
        bloom.strokePath();
      }
      this.scene.tweens.add({
        targets: bloom, alpha: 0, duration: 190, ease: 'Quart.easeOut',
        onComplete: () => bloom.destroy(),
      });
      // Deliberately NO camera punch here. The MOVE owns its impact feel and
      // already punches on the frame it deals damage; a zone punching as well
      // double-kicks the camera on every commit in the game, including zones
      // the player dodged clean. The bloom is the zone's contribution.
    }
    // ── THE FLASH MUST NOT DELETE THE MAN CASTING IT ─────────────────────
    //
    // This was one flat fill at 0.7 white across the whole zone. For anything
    // whose origin is the caster's own feet — a cone, a slam, a Force circle,
    // which is most of Vader's kit — that paints an opaque white mass directly
    // over his body on the frame the attack lands. Caught in a SABER COMBO
    // still: at the release beat he was a white blob, at the exact moment the
    // player needs to read which way the blade is going.
    //
    // The same claim, redistributed: the fill ramps from nearly clear at the
    // origin to full at the rim, so the flash still says "all of this fired"
    // while the thing at the origin stays legible. The hit test is untouched —
    // `contains` has never consulted the drawing, and that is the point.
    const BANDS = 7;
    const bandA = (i) => {
      const u = (i + 0.5) / BANDS;
      return (this.safe ? 0.32 : 0.7) * (0.14 + 0.86 * u * u);
    };
    if (s.kind === 'circle') {
      const bw = s.r / BANDS;
      for (let i = 0; i < BANDS; i++) {
        g.lineStyle(bw + 1, this.safe ? SAFE_COLOR : 0xffffff, bandA(i));
        g.strokeCircle(s.x, s.y, bw * (i + 0.5));
      }
    } else if (s.kind === 'cone') {
      const half = (s.spreadDeg * Math.PI) / 180 / 2;
      const bw = s.len / BANDS;
      for (let i = 0; i < BANDS; i++) {
        g.lineStyle(bw + 1, this.safe ? SAFE_COLOR : 0xffffff, bandA(i));
        g.beginPath();
        const r = bw * (i + 0.5);
        const N = 14;
        for (let k = 0; k <= N; k++) {
          const a = s.angle - half + (2 * half * k) / N;
          const px = s.x + Math.cos(a) * r, py = s.y + Math.sin(a) * r;
          if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.strokePath();
      }
    } else if (s.kind === 'lane') {
      const ca = Math.cos(s.angle), sa = Math.sin(s.angle), hw = s.width / 2;
      const bw = s.len / BANDS;
      for (let i = 0; i < BANDS; i++) {
        const f = bw * i, t2 = bw * (i + 1);
        g.fillStyle(this.safe ? SAFE_COLOR : 0xffffff, bandA(i));
        g.beginPath();
        g.moveTo(s.x + ca * f - sa * hw, s.y + sa * f + ca * hw);
        g.lineTo(s.x + ca * t2 - sa * hw, s.y + sa * t2 + ca * hw);
        g.lineTo(s.x + ca * t2 + sa * hw, s.y + sa * t2 - ca * hw);
        g.lineTo(s.x + ca * f + sa * hw, s.y + sa * f - ca * hw);
        g.closePath();
        g.fillPath();
      }
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
