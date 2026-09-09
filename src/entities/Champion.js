// ── THE CHAMPION ────────────────────────────────────────────────────────────
//
// PHASE B CANDIDATE — the intended replacement for the Nemesis as the
// player-facing special enemy, proven as one vertical slice before anything is
// replaced. `HANDOVER.md` carries the record; `CHAMPION` in `config.js` carries
// every number.
//
// WHAT IT IS NOT, and each of these is a decision rather than an omission:
//   - not an elite. `_makeElite` is hp x2.5, scale x1.4 and a gold tint: the
//     same enemy, larger. The Champion has its own sheet, its own body, its own
//     scheduler and two authored moves, and it takes NONE of that path.
//   - not a Nemesis. No generated name, no traits, no regalia, no grudge, no
//     cross-run ledger, no duel bar, no dialogue and none of the fourteen
//     Nemesis moves. The human's verdict on that content was that it reads as
//     an enlarged normal enemy; inheriting it inherits the verdict. The
//     ENGINEERING is reused — MoveScript, Telegraph, actorMotion — and that is
//     the whole of the overlap.
//   - not a mini-boss. Two moves, no ordinary attack, and no room lockout.
//
// IT HAS NO ORDINARY ATTACK AT ALL, and that is the strongest statement of the
// design. Every one of the six archetypes pressures with bodies or bullets; a
// seventh that also shot would be a seventh trooper. This one advances slowly,
// holds at range, and its entire threat is where it will and will not let the
// player stand. The mechanic creates the priority; the hp only supports it.
import Phaser from 'phaser';
import { Enemy, ST } from './Enemy.js';
import { CHAMPION } from '../config.js';

export class Champion extends Enemy {
  constructor(scene, x, y, def = CHAMPION.interdictor, spec = {}) {
    super(scene, x, y, def.tex, {
      hp: def.hp,
      speed: def.speed,
      radius: def.radius,
      desiredRange: def.holdRange,
      fireCooldownMs: 1e9,     // it does not shoot. Nothing reads this; it is
                               // here so a stray _maybeFireAt could never fire.
    }, { ...spec, behavior: 'swarm', alerted: true });

    this.def = def;
    this.isChampion = true;
    this._championId = def.id;
    this._animPrefix = def.anim;
    this.state = ST.ALERT;

    // Its own move clocks. Deliberately NOT the nemesis rotation: that cycles a
    // list on one timer, and these two moves are not interchangeable — one is
    // scheduled and one is CONDITIONAL on the player having closed. Separate
    // clocks are what let PURGE stay silent for a whole fight against a player
    // who never comes inside, which is the correct behaviour for a punish.
    this._interdictCd = def.interdict.everyMs * 0.55;   // the first one arrives early
    this._purgeCd = def.purge.everyMs;
    this._champCharge = 0;
    this._barrier = null;

    // A quiet violet ground ring, replacing the stock red threat halo. The
    // Champion's identity colour is used on the model, the telegraph, the seam
    // and here, so all four say the same thing; red would have made it read as
    // one more of the crowd it is standing in.
    this.threatRing?.clear();
    this.threatRing?.fillStyle(def.color, 0.14);
    this.threatRing?.fillCircle(0, 0, def.radius + 18);
    this.threatRing?.lineStyle(2.5, def.color, 0.55);
    this.threatRing?.strokeCircle(0, 0, def.radius + 10);

    // No weapon overlay: there is no weapon. `Enemy` never rotates a body
    // sprite and the mast on the sheet is what carries the aim read instead.
    this.weaponSprite = null;
  }

  /**
   * Take down this Champion's seam, if it has one.
   *
   * Idempotent, and called from three places that must not know about each
   * other: the next INTERDICT (one seam at a time), `die()`, and the scene's
   * room sweep. `Barrier.destroy` is itself idempotent, so a double call is a
   * no-op rather than a crash — the same contract `claimSaber`/`releaseSaber`
   * hold for the same reason.
   */
  retireBarrier() {
    if (this._barrier) {
      this._barrier.destroy();
      this._barrier = null;
    }
  }

  /**
   * WHICH MOVE IS ELIGIBLE RIGHT NOW, or null.
   *
   * Ticked by `GameScene`, which owns the actual cast so the Champion path
   * goes through the same `runMove` contract everything else does. PURGE is
   * tested FIRST and only inside its range: a player standing on the machine is
   * the situation that move exists for, and letting a scheduled INTERDICT win
   * that race would leave the near-space answer unpunished for a full cycle.
   */
  dueMove(delta) {
    this._interdictCd -= delta;
    this._purgeCd -= delta;
    if (this._performing) return null;
    const p = this.scene.player;
    if (!p?.alive) return null;

    if (this._purgeCd <= 0) {
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d <= this.def.purge.range) {
        this._purgeCd = this.def.purge.everyMs;
        return 'purge';
      }
    }
    if (this._interdictCd <= 0) {
      this._interdictCd = this.def.interdict.everyMs;
      return 'interdict';
    }
    return null;
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.alive) return;
    if (this._staggerMs > 0) return;

    // ONE SYSTEM DRIVES AN ACTOR AT A TIME. `Enemy.preUpdate` yields on
    // `_performing`, and this override must too — the same gate `EnemyShooter`
    // silently defeated for every archetype in the game once, which let a
    // nemesis creep out of its own telegraph during its wind-up.
    if (this._performing) {
      if (this._movePlanted) this.setVelocity(0, 0);
      return;
    }

    const p = this.scene.player;
    if (!p?.alive) { this.setVelocity(0, 0); return; }

    // ── THE ONLY ORDINARY BEHAVIOUR: WALK, THEN HOLD ──────────────────────
    // No strafe, no retreat, no fire. It closes to `holdRange` and stops, so it
    // is always in a position to draw a useful line and never in the player's
    // face by accident. `_navigatePath` rather than a straight line, because a
    // Ø60 body that walked into cover and stuck would be a controller that
    // controls nothing.
    const dist = Math.hypot(p.x - this.x, p.y - this.y);
    this._aim = Math.atan2(p.y - this.y, p.x - this.x);
    if (dist > this.def.holdRange) {
      this._navigatePath(p.x, p.y, this.cfg.speed, delta);
    } else {
      this.setVelocity(0, 0);
    }
  }

  die(...args) {
    // THE SEAM GOES WITH IT. A hazard that outlives the machine that drew it is
    // a damaging region with no author on screen, which is the single worst
    // failure this class can have — worse than no hazard, exactly as a
    // telegraph that outlives its attack is worse than no telegraph.
    this.retireBarrier();
    return super.die(...args);
  }

  destroy(...args) {
    this.retireBarrier();
    return super.destroy(...args);
  }
}
