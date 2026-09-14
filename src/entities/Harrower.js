// ── THE HARROWER — PHASE B.1 CONCEPT GATE ───────────────────────────────────
//
// The second Champion candidate. `HANDOVER.md` §10ae is the record and
// `HARROWER` in `config.js` carries every number.
//
// WHAT THE FIRST CANDIDATE GOT WRONG, AND WHAT THIS INVERTS. The Interdictor
// held at `holdRange` and then `setVelocity(0, 0)`, so it was motionless for
// most of every fight and the seam it placed became the content while the
// machine became its emitter. **There is no hold state anywhere in this file.**
// The loop always has somewhere to be: it is either walking to an entry point,
// accelerating, committed to a pass, shedding speed, or banking. The only beat
// that is close to still is the bank, which is the deliberate vulnerability
// window and is bounded at `bankMs`.
//
// THE WAKE IS A CONSEQUENCE, NOT A PLACEMENT. It is emitted from the travelled
// path above `wakeMinSpeed`, so setup movement carves nothing and only a
// committed pass does. No movement, no wake — by construction, not by promise.
//
// PHASE B.1 IS FOUR VERBS: MOVE, PASS, WAKE, BANK. No signature attacks, no
// projectile, no melee, no shield, no armour phase. If those four are not
// compelling alone, attacks would only hide it.
import Phaser from 'phaser';
import { Enemy, ST } from './Enemy.js';
import { HARROWER } from '../config.js';
import { HARROWER_FRAMES } from '../systems/pixelArt.js';

/** The states, in the order they run. Exposed for the diagnostics. */
export const HRW = {
  ALIGN: 'align',
  ACCEL: 'accel',
  PASS: 'pass',
  DECEL: 'decel',
  BANK: 'bank',
};

export class Harrower extends Enemy {
  constructor(scene, x, y, spec = {}) {
    const def = HARROWER;
    super(scene, x, y, def.tex, {
      hp: def.hp,
      speed: def.cruise,
      radius: def.radius,
      desiredRange: 0,
      fireCooldownMs: 1e9,        // it does not shoot. Nothing reads this.
    }, { ...spec, behavior: 'swarm', alerted: true });

    this.def = def;
    this.isChampion = true;
    this._championId = def.id;
    this.state = ST.ALERT;

    // No weapon overlay: there is no weapon, and the vanes on the sheet carry
    // the aim read instead.
    this.weaponSprite = null;

    // THE ROTATION EXEMPTION. Body sprites never rotate in this project because
    // rotating a humanoid produces the upside-down-sprite bug; a top-down craft
    // rotated to its heading is correct, and is how every vehicle in the genre
    // works. The sheet is painted east-facing for exactly this. See the header
    // of `paintHarrower`.
    this._heading = Math.random() * Math.PI * 2;
    this.setRotation(this._heading);

    // A bigger, lower ground shadow than the stock one: the air gap under the
    // hull is the hover cue, and a tight shadow tucked under the sprite closes
    // it. This is the only actor in the game that reads as off the deck.
    this.shadow?.setScale(1.45, 0.8).setAlpha(0.42);

    this.threatRing?.clear();
    this.threatRing?.fillStyle(def.color, 0.12);
    this.threatRing?.fillCircle(0, 0, def.radius + 20);
    this.threatRing?.lineStyle(2.5, def.color, 0.5);
    this.threatRing?.strokeCircle(0, 0, def.radius + 12);

    this.wake = null;
    this._hrw = HRW.ALIGN;
    this._stateMs = 0;
    this._speed = def.cruise;
    this._bob = 0;
    this._passCount = 0;
    this._lastBearing = null;
    this._plan = null;
    this._planPass();
  }

  // ── THE PASS PLANNER ──────────────────────────────────────────────────────
  //
  // A pass is a CHORD OF THE ARENA, not a lunge at the player. Short hops read
  // as pathing; a traversal reads as a decision, which is the whole difference
  // between "it is chasing me" and "it is crossing the fight".
  //
  // The chord is aimed to pass NEAR the player, never through them: a line that
  // always bisects the player is a homing attack drawn as a road. `focusNear`
  // and `focusFar` are the band its closest approach is scored against.
  //
  // Candidates are rejected outright if they clip a solid body, so a committed
  // pass never has to path around anything — the commitment is only honest if
  // the lane was checked before it was promised.
  _planPass() {
    const d = this.def;
    const b = this.scene.physics.world.bounds;
    const m = d.passMargin + d.radius;
    const rect = { x0: b.x + m, y0: b.y + m, x1: b.right - m, y1: b.bottom - m };
    const p = this.scene.player;
    const px = p?.x ?? (rect.x0 + rect.x1) / 2;
    const py = p?.y ?? (rect.y0 + rect.y1) / 2;

    let best = null;
    const TRIES = 16;
    for (let i = 0; i < TRIES; i++) {
      const bearing = (Math.PI * 2 * i) / TRIES + (Math.random() - 0.5) * 0.18;
      // Offset the line sideways off the player by a distance inside the band,
      // so it threatens their space without being aimed at their body.
      const off = d.focusNear + Math.random() * (d.focusFar - d.focusNear);
      const sgn = Math.random() < 0.5 ? 1 : -1;
      const fx = px + Math.cos(bearing + Math.PI / 2) * off * sgn;
      const fy = py + Math.sin(bearing + Math.PI / 2) * off * sgn;
      const full = this._clipToRect(fx, fy, bearing, rect);
      if (!full) continue;
      // TRIM TO A WINDOW AROUND THE PLAYER. A chord clipped to the whole arena
      // measured 1172px against a ~720px viewport, so only 35% of a pass was
      // ever on screen. Centre the run on its closest approach to the player
      // and cap it, so the crossing happens in the picture the fight is in.
      const seg = this._trimToWindow(full, px, py, d.maxPassLen);
      const len = Math.hypot(seg.x1 - seg.x0, seg.y1 - seg.y0);
      if (len < d.minPassLen) continue;
      if (!this._laneClear(seg.x0, seg.y0, seg.x1, seg.y1)) continue;

      // Enter from whichever end is nearer, so ALIGN is a reposition and not a
      // march across the whole arena.
      const dA = Math.hypot(seg.x0 - this.x, seg.y0 - this.y);
      const dB = Math.hypot(seg.x1 - this.x, seg.y1 - this.y);
      const entry = dA <= dB ? { x: seg.x0, y: seg.y0 } : { x: seg.x1, y: seg.y1 };
      const exit = dA <= dB ? { x: seg.x1, y: seg.y1 } : { x: seg.x0, y: seg.y0 };
      const head = Math.atan2(exit.y - entry.y, exit.x - entry.x);

      // Score: long, close to the player's space, cheap to set up, and a
      // different bearing from the last one so the pattern does not metronome.
      const approach = this._distToSeg(px, py, entry, exit);
      // ENTRY PROXIMITY IS WEIGHTED HEAVILY, and the first measurement is why.
      // With chords trimmed to a viewport-sized window, ALIGN grew to 37% of
      // the fight — more time repositioning than crossing, which inverts what
      // the concept is about. A pass that starts near where the last one ended
      // spends its budget on the run rather than on the walk to the start line.
      let score = len * 0.6
        - Math.abs(approach - (d.focusNear + d.focusFar) / 2) * 1.1
        - Math.hypot(entry.x - this.x, entry.y - this.y) * 0.95;
      if (this._lastBearing !== null) {
        const turn = Math.abs(Phaser.Math.Angle.Wrap(head - this._lastBearing));
        if (turn < d.bearingChange) score -= 420;
      }
      if (!best || score > best.score) best = { entry, exit, head, len, score };
    }

    // Fallback: a shorter chord straight through the arena centre. A Harrower
    // with no plan would stand still, which is the one failure this concept
    // exists to avoid, so there is always a plan even in a bad room.
    if (!best) {
      const head = Math.atan2((rect.y0 + rect.y1) / 2 - this.y, (rect.x0 + rect.x1) / 2 - this.x);
      const seg = this._clipToRect(px, py, head, rect);
      if (seg) {
        best = {
          entry: { x: seg.x0, y: seg.y0 }, entryFallback: true,
          exit: { x: seg.x1, y: seg.y1 },
          head: Math.atan2(seg.y1 - seg.y0, seg.x1 - seg.x0),
          len: Math.hypot(seg.x1 - seg.x0, seg.y1 - seg.y0), score: 0,
        };
      }
    }
    this._plan = best;
    this._planFellBack = !!best?.entryFallback;
    return best;
  }

  /**
   * Shorten a clipped chord to `want` px, centred on its closest approach to
   * (px, py) and kept inside the original segment.
   */
  _trimToWindow(seg, px, py, want) {
    const vx = seg.x1 - seg.x0, vy = seg.y1 - seg.y0;
    const len = Math.hypot(vx, vy);
    if (len <= want) return seg;
    const ux = vx / len, uy = vy / len;
    let t = (px - seg.x0) * ux + (py - seg.y0) * uy;     // closest approach, in px along
    t = Math.max(want / 2, Math.min(len - want / 2, t));
    return {
      x0: seg.x0 + ux * (t - want / 2), y0: seg.y0 + uy * (t - want / 2),
      x1: seg.x0 + ux * (t + want / 2), y1: seg.y0 + uy * (t + want / 2),
    };
  }

  /** Clip the infinite line through (cx,cy) at `bearing` to an axis-aligned rect. */
  _clipToRect(cx, cy, bearing, r) {
    const dx = Math.cos(bearing), dy = Math.sin(bearing);
    let tMin = -Infinity, tMax = Infinity;
    for (const [p, q0, q1] of [[dx, r.x0 - cx, r.x1 - cx], [dy, r.y0 - cy, r.y1 - cy]]) {
      if (Math.abs(p) < 1e-6) { if (q0 > 0 || q1 < 0) return null; continue; }
      let a = q0 / p, b = q1 / p;
      if (a > b) { const t = a; a = b; b = t; }
      tMin = Math.max(tMin, a);
      tMax = Math.min(tMax, b);
    }
    if (tMax <= tMin) return null;
    return { x0: cx + dx * tMin, y0: cy + dy * tMin, x1: cx + dx * tMax, y1: cy + dy * tMax };
  }

  /**
   * Is the chord free of every solid body, with room for this hull?
   *
   * `this.walls` is the static group and it holds the room's walls, its cover
   * consoles AND its solid props, so one test covers all three. Sampling along
   * the chord rather than doing a rect/segment intersection is deliberate: it
   * is a handful of cheap checks run once per pass, not per frame.
   */
  _laneClear(x0, y0, x1, y1) {
    const bodies = this.scene.walls?.getChildren?.() || [];
    if (!bodies.length) return true;
    const pad = this.def.radius + this.def.clearance;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(2, Math.ceil(len / 40));
    for (const w of bodies) {
      const bx = w.body?.center?.x ?? w.x, by = w.body?.center?.y ?? w.y;
      const hw = (w.body?.width ?? w.displayWidth) / 2 + pad;
      const hh = (w.body?.height ?? w.displayHeight) / 2 + pad;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const sx = x0 + (x1 - x0) * t, sy = y0 + (y1 - y0) * t;
        if (Math.abs(sx - bx) <= hw && Math.abs(sy - by) <= hh) return false;
      }
    }
    return true;
  }

  _distToSeg(px, py, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    const l2 = vx * vx + vy * vy;
    let t = l2 > 0 ? ((px - a.x) * vx + (py - a.y) * vy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t));
  }

  // ── THE LOOP ──────────────────────────────────────────────────────────────

  _enter(next) { this._hrw = next; this._stateMs = 0; }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.alive) { this.wake?.lift(); return; }

    // ── A COMMITTED CRAFT IS NOT STUN-LOCKED, AND THIS LINE USED TO SAY IT
    // WAS. Every other actor opens with `if (this._staggerMs > 0) return;` —
    // correct for infantry, where a knockback slide is the hit reaction. Copied
    // here it halted the whole loop while ordinary player fire kept refreshing
    // the timer, and `Enemy.preUpdate` damped the velocity 0.85 a frame
    // underneath: measured at up to **4305ms motionless inside a "pass"**, with
    // the grind watchdog never firing because the watchdog is inside the loop
    // that was not running. That is the rejected candidate's exact failure
    // arriving through a different door — a Champion whose identity is movement
    // being stood still by a pistol.
    //
    // The loop now runs regardless and re-asserts velocity every frame, so a
    // pass cannot be interrupted by chip damage. The hit still lands, still
    // flashes and still counts; what it no longer does is delete the identity.
    // The craft IS interruptible — in the bank, where it is stopped anyway and
    // takes `bankPunish` extra damage. That is the whole bargain of the loop:
    // you cannot stop the run, you punish the turn.

    this._stateMs += delta;
    this._bob += delta;
    const d = this.def;
    if (!this._plan) this._planPass();
    const plan = this._plan;

    switch (this._hrw) {
      // Reposition to the pass's entry point at cruise. Pathed, because a Ø56
      // hull that walked into a console and stuck would be a controller that
      // controls nothing.
      case HRW.ALIGN: {
        if (!plan) { this._planPass(); break; }
        const dist = this._navigatePath(plan.entry.x, plan.entry.y, d.cruise, delta);
        this._speed = d.cruise;
        this._heading = this._towardHeading(plan.entry.x, plan.entry.y, delta, 5.0);
        if (dist <= d.alignTol) {
          // ── SNAP THE LANE TO WHERE IT ACTUALLY IS ──────────────────────
          // The chord was validated as clear, but the craft flies it from
          // wherever ALIGN stopped — up to `alignTol` off the planned line. A
          // 60px parallel offset against 34px of clearance is enough to clip
          // cover the true lane cleared, and detention measured a 3040ms
          // grind inside PASS because of exactly that. Re-lay the line through
          // the real position on the planned bearing, so the promise and the
          // flight are the same line.
          const b = this.scene.physics.world.bounds;
          const m = d.passMargin + d.radius;
          const seg = this._clipToRect(this.x, this.y, plan.head,
            { x0: b.x + m, y0: b.y + m, x1: b.right - m, y1: b.bottom - m });
          if (seg) {
            const fwd = ((seg.x1 - this.x) * Math.cos(plan.head)
              + (seg.y1 - this.y) * Math.sin(plan.head)) > 0;
            plan.exit = fwd ? { x: seg.x1, y: seg.y1 } : { x: seg.x0, y: seg.y0 };
          }
          this._heading = plan.head;
          this._enter(HRW.ACCEL);
        }
        // ── THE STALL WATCHDOG ────────────────────────────────────────────
        // STANDING STILL IS THE REJECTED CANDIDATE'S WHOLE FAILURE, so it gets
        // an explicit guard rather than being assumed impossible. The first
        // measured run showed a 1037ms motionless stretch inside ALIGN — a
        // nav path that could not make progress — which is the Interdictor in
        // miniature. If the craft is barely moving while it is supposed to be
        // repositioning, the plan is wrong: throw it away and pick another.
        const v = Math.hypot(this.body.velocity.x, this.body.velocity.y);
        this._stallMs = v < 40 ? (this._stallMs || 0) + delta : 0;
        if (this._stallMs > 420 || this._stateMs > 5200) {
          this._stallMs = 0;
          this._currentPath = null;
          this._planPass();
          this._enter(HRW.ALIGN);
        }
        break;
      }

      // The wind-up IS the acceleration, and it is visible: the craft is
      // already on its final bearing and building speed down it.
      case HRW.ACCEL: {
        const u = Math.min(1, this._stateMs / d.accelMs);
        this._speed = d.cruise + (d.pass - d.cruise) * u;
        this._drive(plan.head);
        this._heading = plan.head;
        if (u >= 1) { this._lastPassX = null; this._lastPassY = null; this._enter(HRW.PASS); }
        break;
      }

      // Committed. The bearing is frozen: a pass that re-aimed at the player
      // would be a homing attack wearing a telegraph.
      case HRW.PASS: {
        this._speed = d.pass;
        this._drive(plan.head);
        this._heading = plan.head;
        const togo = Math.hypot(plan.exit.x - this.x, plan.exit.y - this.y);
        const past = ((this.x - plan.exit.x) * Math.cos(plan.head)
          + (this.y - plan.exit.y) * Math.sin(plan.head)) > 0;
        // ── THE GRIND WATCHDOG ────────────────────────────────────────────
        // A committed pass that is being held up by geometry is the rejected
        // candidate's failure wearing a new costume: the craft is nominally
        // "passing" and is actually a stationary object. Velocity is asserted
        // every frame, so if the achieved speed stays far below the commanded
        // one something is in the way — break off into the bank rather than
        // grinding to the 4200ms timeout. Detention measured 3040ms of exactly
        // this before the lane snap above; this is the belt to that braces.
        // MEASURED FROM DISPLACEMENT, NOT FROM `body.velocity`. `_drive()` two
        // lines above has just WRITTEN that velocity, so reading it back here
        // measured the command rather than the motion and the watchdog could
        // never fire — detention still ground for 2603ms with the guard
        // nominally in place. Real travel per frame, divided by dt, is the only
        // honest answer to "is it actually moving", and it is frame-rate
        // independent the way a per-frame pixel threshold would not be.
        const moved = this._lastPassX == null ? Infinity
          : Math.hypot(this.x - this._lastPassX, this.y - this._lastPassY) / (delta / 1000);
        this._lastPassX = this.x; this._lastPassY = this.y;
        this._grindMs = moved < d.pass * 0.55 ? (this._grindMs || 0) + delta : 0;
        if (togo <= 90 || past || this._grindMs > 260 || this._stateMs > 4200) {
          if (this._grindMs > 260) this._blockedPasses = (this._blockedPasses || 0) + 1;
          this._grindMs = 0;
          this._lastPassX = null; this._lastPassY = null;
          this._passCount++;
          this._enter(HRW.DECEL);
        }
        break;
      }

      // Shedding speed, still moving, wake still live for the first part of it
      // — the trail should die behind the craft rather than stop dead with it.
      case HRW.DECEL: {
        const u = Math.min(1, this._stateMs / d.decelMs);
        this._speed = d.pass * (1 - u);
        this._drive(plan.head);
        if (u >= 1) {
          // THE PRICE OF COMMITTING. Slow, side-on, and taking extra damage,
          // at the end of every pass — which is what makes the loop teach
          // itself rather than needing to be explained.
          this._punishMs = d.bankMs;
          this._punishMult = d.bankPunish;
          this._lastBearing = plan.head;
          this._planPass();
          this._enter(HRW.BANK);
        }
        break;
      }

      // The only near-still beat, and it is bounded. The craft yaws visibly
      // toward its next entry so the bank reads as a turn rather than a pause.
      case HRW.BANK: {
        this._speed = 0;
        this.setVelocity(0, 0);
        const tgt = this._plan?.entry;
        if (tgt) this._heading = this._towardHeading(tgt.x, tgt.y, delta, d.bankYawRate);
        if (this._stateMs >= d.bankMs) this._enter(HRW.ALIGN);
        break;
      }
    }

    this._aim = this._heading;
    this._tickWake();
    this._drawBody();
  }

  /** Set velocity along `head` at the current speed. */
  _drive(head) {
    this.setVelocity(Math.cos(head) * this._speed, Math.sin(head) * this._speed);
  }

  /** Ease the visual heading toward a point, capped at `rate` rad/s. */
  _towardHeading(tx, ty, delta, rate) {
    const want = Math.atan2(ty - this.y, tx - this.x);
    const diff = Phaser.Math.Angle.Wrap(want - this._heading);
    const step = rate * (delta / 1000);
    return this._heading + Phaser.Math.Clamp(diff, -step, step);
  }

  /**
   * Lay trail, but only while COMMITTED.
   *
   * The gate lives here rather than inside `Wake` because "is this movement a
   * commitment" is the actor's question. Setup movement carves nothing, which
   * is what keeps the wake meaning something.
   */
  _tickWake() {
    const speed = Math.hypot(this.body.velocity.x, this.body.velocity.y);
    if (speed < this.def.wakeMinSpeed) { this.wake?.lift(); return; }
    if (!this.wake || this.wake.dead) {
      this.wake = this.scene.spawnWake?.({
        width: this.def.wakeWidth,
        lifeMs: this.def.wakeLifeMs,
        stepPx: this.def.wakeStepPx,
        damage: this.def.wakeDamage,
        tickMs: this.def.wakeTickMs,
        maxPoints: this.def.wakeMaxPoints,
        color: this.def.color,
        owner: this,
      }) || null;
    }
    // Emitted from BEHIND the hull, at the vanes, not from the centre — the
    // trail has to leave the object at the place the art says it does.
    const bx = this.x - Math.cos(this._heading) * (this.def.radius * 0.7);
    const by = this.y - Math.sin(this._heading) * (this.def.radius * 0.7);
    this.wake?.emit(bx, by);
  }

  /** Rotation and frame. No `anims` keys exist for this sheet on purpose. */
  _drawBody() {
    this.setRotation(this._heading);
    const F = HARROWER_FRAMES;
    const flick = Math.floor(this._bob / 120) % 2 === 0;
    let frame = F.cruise;
    if (this._hrw === HRW.PASS || this._hrw === HRW.ACCEL) frame = flick ? F.pass : F.passB;
    else if (this._hrw === HRW.DECEL) frame = F.decel;
    else if (this._hrw === HRW.BANK) frame = flick ? F.bank : F.bankB;
    else frame = flick ? F.cruise : F.cruiseB;
    this.setFrame(frame);
    // A shallow roll through the bank. Scale rather than a second rotation:
    // the rotation channel already carries the heading and one channel has one
    // author, which is the rule the saber's glow follows for the same reason.
    const rolling = this._hrw === HRW.BANK;
    this.setScale(1, rolling ? 0.86 : 1);

    // RE-ASSERT THE HOVER SHADOW. `Enemy.preUpdate` rewrites the shadow's scale
    // and position every frame from its own velocity-drift rules, so the wide
    // low shadow set in the constructor lasted exactly one frame. It is thrown
    // further below the hull than any walker's, which is what opens the air gap
    // the sprite's empty lower rows exist to show.
    if (this.shadow?.active) {
      const drift = Math.min(1, this._speed / this.def.pass);
      this.shadow.setScale(1.45 + drift * 0.35, 0.78);
      this.shadow.setPosition(
        this.x - Math.cos(this._heading) * 6,
        this.y + 26 - Math.sin(this._heading) * 3);
      this.shadow.setAlpha(0.30 + 0.16 * (1 - drift));
    }
  }

  /** Idempotent, and called from three places that must not know about each other. */
  retireWake() {
    if (this.wake) { this.wake.destroy(); this.wake = null; }
  }

  die(...args) {
    // The trail goes with the craft. A damaging region whose author is no
    // longer on screen is worse than no hazard at all.
    this.retireWake();
    return super.die(...args);
  }

  destroy(...args) {
    this.retireWake();
    return super.destroy(...args);
  }
}
