// ── THE IMPERIAL SHOCK CAPTAIN ──────────────────────────────────────────────
//
// PHASE B.2 — the third Champion candidate, and the first whose VISUAL/FANTASY
// gate a human has approved (`HANDOVER.md` §10ag). The two before it were
// rejected on CATEGORY rather than on numbers: both began from a mechanic and
// found a body for it afterwards, so both produced a delivery device whose
// content was on the floor and whose actor was merely its emitter.
//
// THIS GATE ASKS ONE QUESTION: is the Shock Captain already a good combatant
// with just MOVEMENT, a RIFLE and a DEFENSIVE LAYER? There is no signature
// ability here on purpose. If the ordinary combatant is not worth fighting, a
// signature move would only hide it — which is precisely what Phase B.1 proved
// from the other direction, by shipping four verbs and no attacks at all.
//
// ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
//   - not an elite. `_makeElite` is hp x2.5, scale x1.4 and a gold tint: the
//     same enemy, larger. This has its own sheet, its own states and its own
//     durability model, and takes none of that path.
//   - not a Nemesis. No generated name, no traits, no regalia, no grudge, no
//     ledger, no duel bar, no dialogue and none of the fourteen Nemesis moves.
//   - not a mini-boss. No room lockout, no phases, no banner.
//   - not a hazard with hp. Nothing it does lives on the floor.
//
// ── THE THREE RULES THE PREVIOUS TWO BROKE ──────────────────────────────────
//   1. MOVEMENT MUST READ AS DECISION. Every state below corresponds to an
//      understandable combat reason — too far, too close, wrong angle, firing,
//      recovering — and the body ANIMATES through all of them. A sprite
//      translating through world space at constant speed is a vehicle, however
//      fast it goes.
//   2. IT IS A COMBATANT FROM THE FIRST BUILD. The rifle is here in the first
//      version, not deferred behind a signature kit.
//   3. NO MOVEMENT-PERCENTAGE KPI. "81% of the fight in motion" cleared every
//      bar the Harrower was given and the actor was rejected anyway. Nothing
//      here optimises for that number and no test asserts it.
import Phaser from 'phaser';
import { Enemy, ST } from './Enemy.js';
import { CHAMPION } from '../config.js';
import { CAPTAIN_MUZZLE_PX } from '../systems/pixelArt.js';

// The combat loop, as five named reasons. Every one of them is something a
// player could say out loud about what the Captain is doing.
export const CAP = {
  ADVANCE: 'advance',       // too far to shoot, closing
  GIVE_GROUND: 'giveground',// crowded, backing off without turning away
  STRAFE: 'strafe',         // in the band, changing the firing angle
  BRACE: 'brace',           // planted, weapon up, about to fire
  BURST: 'burst',           // firing
  RECOVER: 'recover',       // settling after the burst
  STAGGER: 'stagger',       // a real blow landed
};

export class ShockCaptain extends Enemy {
  constructor(scene, x, y, spec = {}, def = CHAMPION.captain) {
    super(scene, x, y, def.tex, {
      hp: def.hp,
      speed: def.speed,
      radius: def.radius,
      desiredRange: (def.holdMin + def.holdMax) / 2,
      // Nothing reads this: the Captain's cadence is its own state machine and
      // it never calls `_maybeFireAt`. It is here so a stray inherited path
      // could not fire on the stock clock.
      fireCooldownMs: 1e9,
      bulletSpeed: def.bulletSpeed,
      bulletDamage: def.bulletDamage,
      bulletRange: def.bulletRange,
    }, { ...spec, behavior: 'swarm', alerted: true });

    this.def = def;
    this.isChampion = true;
    this._championId = def.id;
    this._animPrefix = def.anim;
    // IT OWNS ITS OWN ANIMATION. Its sheet is 51 frames, not the stock 33: a
    // two-frame breathing idle, a lateral strafe cycle and a brace/fire/recoil
    // arc that the states below drive directly. See `Enemy.preUpdate`.
    this._ownsAnim = true;
    this.state = ST.ALERT;

    // ── DURABILITY: TWO LAYERS ─────────────────────────────────────────────
    // The reactive armour is not a second health bar. It exists so the player's
    // biggest commitment BREAKS something visibly instead of deleting the
    // encounter before its behaviour can be read — the Interdictor's whole
    // problem — while chip fire against it still feels productive.
    this.armour = def.armour;
    this.armourMax = def.armour;
    this.armourBroken = false;
    this._armourBar = scene.add.graphics().setDepth(this.depth + 1);
    this._armourBar.visible = false;

    // Combat state. `_stateMs` counts DOWN; a state ends when it hits zero or
    // when its own condition says so, never on a frame count.
    this._cap = CAP.ADVANCE;
    this._stateMs = 0;
    this._fireCd = Phaser.Math.Between(500, 1100);   // not all at once on spawn
    this._round = 0;
    this._roundGap = 0;
    this._shotFlashMs = 0;
    this._side = Math.random() < 0.5 ? 1 : -1;
    this._target = null;
    this._staggerCd = 0;
    this._wKick = 0;               // weapon recoil, in px along -aim

    // THE HEAVY REPEATER, on the standard overlay contract: painted east-facing
    // at origin (0.15, 0.5) so `Enemy.preUpdate`'s orbit maths applies
    // unchanged, and a separate object so the body sheet never has to draw it.
    this.weaponSprite = scene.add.image(x, y, 'wpn-captain')
      .setDepth(this.depth + 1).setOrigin(0.15, 0.5).setScale(1.0);

    // An electric-blue ground ring instead of the stock red threat halo. The
    // identity colour is on the model, the weapon core, the bolt and here, so
    // all four say the same thing; red would have made it one more of the crowd
    // it is standing in.
    this.threatRing?.clear();
    this.threatRing?.fillStyle(def.color, 0.13);
    this.threatRing?.fillCircle(0, 0, def.radius + 20);
    this.threatRing?.lineStyle(2.5, def.color, 0.5);
    this.threatRing?.strokeCircle(0, 0, def.radius + 12);
  }

  // ── DAMAGE: THE ARMOUR EATS FIRST, AND OVERKILL CARRIES THROUGH ──────────
  //
  // `armourSpill` is what stops the layer being a damage wall. A Super that
  // over-commits past the armour still lands meaningful body damage in the same
  // instant it breaks it, which is the qualitative result the brief asks for:
  // the player hits it hard and SEES progress, twice.
  //
  // The punish multiplier is applied by `Enemy.damage`, so this intercept has
  // to reason about the RAW number and hand the parent whatever should reach
  // the body — the same trap `Boss.damage` fell into when it tested a raw
  // amount the parent was about to multiply.
  damage(amount, knockbackVec = null) {
    if (!this.alive) return;
    let toBody = amount;
    if (!this.armourBroken && this.armour > 0) {
      const taken = amount * this.def.armourTake;
      if (taken < this.armour) {
        this.armour -= taken;
        toBody = 0;
        this.scene.fx?.burstDir?.(
          this.x, this.y, 'white', 3,
          knockbackVec ? Math.atan2(knockbackVec.y, knockbackVec.x) : this._aim, 40,
        );
      } else {
        const over = (taken - this.armour) / this.def.armourTake;
        this.armour = 0;
        toBody = over * this.def.armourSpill;
        this._breakArmour();
      }
    }
    // A REAL BLOW STAGGERS; CHIP FIRE DOES NOT. `Enemy.damage` sets
    // `_staggerMs = 90` on every hit, and an actor that yields on that field is
    // stun-locked by ordinary fire — 4305ms motionless, measured on the
    // Harrower. This is the same fact reached deliberately: one visible stagger
    // per cooldown, above a threshold, and the loop resumes when it ends.
    if (amount >= this.def.staggerMinDamage && this._staggerCd <= 0 && this.alive) {
      this._enter(CAP.STAGGER, this.def.staggerMs);
      this._staggerCd = this.def.staggerCooldownMs;
    }
    // `toBody` can be 0 while the armour holds. The parent still runs alarms,
    // the hit event and the recoil, which is what keeps the hit FEELING landed.
    super.damage(toBody, knockbackVec);
  }

  /**
   * THE ARMOUR GOES, AND THE SILHOUETTE CHANGES WITH IT.
   *
   * Two textures, not one tint — the same contract the hero prop's dark state
   * holds, and for the same reason: a recolour says "the same thing, dimmer",
   * and what has to read here is that a piece of him is GONE. The broken sheet
   * shears the command pauldron to a stub and dims the visor, so the change is
   * in the outline and survives being 112px on a phone.
   *
   * Idempotent, and there is no second layer and no regeneration in this gate.
   */
  _breakArmour() {
    if (this.armourBroken) return;
    this.armourBroken = true;
    this.armour = 0;
    this._animPrefix = this.def.animBroken;
    this.setTexture(this.def.texBroken);
    if (this._armourBar) this._armourBar.visible = false;
    const fx = this.scene.fx;
    fx?.impactRing?.(this.x, this.y, this.def.color, this.depth + 2);
    fx?.burst?.(this.x, this.y, 'white', 18);
    fx?.burstDir?.(this.x, this.y, 'yellow', 10, this._aim + Math.PI, 120);
    fx?.shake?.(0.009, 180);
    this.scene.events.emit('champion-armour-broken', this);
  }

  _enter(state, ms = 0) {
    this._cap = state;
    this._stateMs = ms;
  }

  /** A point the Captain can actually stand on, clamped inside the arena. */
  _clampPoint(x, y) {
    const b = this.scene.physics.world.bounds;
    const r = this.def.radius + 6;
    return {
      x: Phaser.Math.Clamp(x, b.x + r, b.right - r),
      y: Phaser.Math.Clamp(y, b.y + r, b.bottom - r),
    };
  }

  /**
   * PICK THE NEXT MOVEMENT, AND ITS REASON.
   *
   * A small combat-position solver, not a planner. Three questions in order:
   * am I too far to shoot, am I crowded, and otherwise where is a better angle.
   * Deliberately NOT a pass planner, a path validator or a chord solver —
   * `HANDOVER.md` §10af records what building one of those first cost.
   */
  _solvePosition(p) {
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const toPlayer = Math.atan2(dy, dx);

    if (dist > this.def.holdMax) {
      // ADVANCE — close to the near edge of the band rather than to the player.
      const want = this.def.holdMax - 80;
      this._target = this._clampPoint(
        p.x - Math.cos(toPlayer) * want, p.y - Math.sin(toPlayer) * want);
      this._enter(CAP.ADVANCE, this.def.advanceMs);
      return;
    }
    if (dist < this.def.holdMin) {
      // GIVE GROUND — straight back down the bearing, still facing the player.
      // A Captain that turned and ran would stop being an opponent.
      const want = this.def.holdMin + 130;
      this._target = this._clampPoint(
        p.x - Math.cos(toPlayer) * want, p.y - Math.sin(toPlayer) * want);
      this._enter(CAP.GIVE_GROUND, this.def.giveGroundMs);
      return;
    }
    // STRAFE — perpendicular, at the distance he already has. Occasionally he
    // changes side, so a player cannot learn one lead and hold it for a fight.
    if (Math.random() < this.def.sideSwapChance) this._side *= -1;
    const perp = toPlayer + Math.PI / 2 * this._side;
    const step = 190;
    this._target = this._clampPoint(this.x + Math.cos(perp) * step, this.y + Math.sin(perp) * step);
    this._enter(CAP.STRAFE, Phaser.Math.Between(this.def.strafeMs[0], this.def.strafeMs[1]));
  }

  /** May he open a burst from here, right now? */
  _canFire(p, dist) {
    return this._fireCd <= 0
      && dist <= this.def.fireRange
      && this._hasLOS(this.x, this.y, p.x, p.y);
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.alive) { if (this._armourBar) this._armourBar.visible = false; return; }

    if (this._staggerCd > 0) this._staggerCd -= delta;
    if (this._shotFlashMs > 0) this._shotFlashMs -= delta;
    if (this._wKick > 0) this._wKick = Math.max(0, this._wKick - delta * 0.09);

    // ONE SYSTEM DRIVES AN ACTOR AT A TIME. `Enemy.preUpdate` already yields on
    // `_performing`; this must too, so a future signature move's wind-up is not
    // overwritten by the combat loop on the very next frame.
    if (this._performing) {
      this._drawArmourBar();
      return;
    }

    const p = this.scene.player;
    if (!p?.alive) { this.setVelocity(0, 0); this._drawArmourBar(); return; }

    const dist = Math.hypot(p.x - this.x, p.y - this.y);
    // HE ALWAYS FACES THE FIGHT. Facing is aim here, and aim is what the
    // animation selector reads — so a lateral step keeps the body square to the
    // player instead of turning into the direction of travel. That difference
    // is exactly "moving sideways while staying combat-ready" versus skating.
    this._aim = Math.atan2(p.y - this.y, p.x - this.x);
    if (this._fireCd > 0) this._fireCd -= delta;
    this._stateMs -= delta;

    switch (this._cap) {
      case CAP.STAGGER:
        // Bounded, and it does not bleed. The body is allowed to slide on the
        // knockback it already has; the loop resumes the frame it expires.
        if (this._stateMs <= 0) this._solvePosition(p);
        break;

      case CAP.BRACE:
        this.setVelocity(0, 0);
        if (this._stateMs <= 0) {
          this._enter(CAP.BURST, 0);
          this._round = this.def.burstRounds;
          this._roundGap = 0;
        }
        break;

      case CAP.BURST:
        this.setVelocity(0, 0);
        this._roundGap -= delta;
        if (this._roundGap <= 0 && this._round > 0) {
          this._fireRound(p);
          this._round--;
          this._roundGap = this.def.burstGapMs;
        }
        if (this._round <= 0 && this._roundGap <= 0) {
          this._enter(CAP.RECOVER, this.def.recoverMs);
          this._fireCd = this.def.fireEveryMs;
        }
        break;

      case CAP.RECOVER:
        this.setVelocity(0, 0);
        if (this._stateMs <= 0) this._solvePosition(p);
        break;

      default: {
        // MOVING. The reason is already chosen; this is only the execution.
        // `_navigatePath` rather than a straight line, so a Ø56 body that meets
        // cover walks round it instead of grinding on it.
        const speed = this._cap === CAP.GIVE_GROUND ? this.cfg.speed * 0.86 : this.cfg.speed;
        const t = this._target;
        const left = t ? this._navigatePath(t.x, t.y, speed, delta) : 0;
        // A burst may interrupt a reposition the moment the shot is available —
        // that is what keeps him dangerous while moving rather than a unit that
        // walks, stops, shoots, walks.
        if (this._canFire(p, dist)) {
          this._enter(CAP.BRACE, this.def.braceMs);
          this.setVelocity(0, 0);
        } else if (this._stateMs <= 0 || !t || left < 40) {
          this._solvePosition(p);
        }
        break;
      }
    }

    this._applyAnim();
    this._applyWeaponKick();
    this._drawArmourBar();
  }

  /**
   * THE BODY PERFORMS THE SHOT.
   *
   * The bolt leaves the MUZZLE, and so does the flash: both read
   * `CAPTAIN_MUZZLE_PX`, which is derived from the overlay's own dimensions, so
   * the effect and the projectile cannot leave from different places. That
   * disagreement is what made the returned super detach from a motionless
   * Vader, and it is the one thing an FX pass cannot paper over.
   */
  _fireRound(p) {
    // Aim is snapshotted per ROUND, not per burst: three rounds that all fly at
    // the player's position from 600ms ago is a burst that cannot hit a moving
    // target, and three that home is not a burst at all.
    const ang = Math.atan2(p.y - this.y, p.x - this.x);
    this._aim = ang;
    const w = this.weaponSprite;
    const mx = (w?.x ?? this.x) + Math.cos(ang) * CAPTAIN_MUZZLE_PX;
    const my = (w?.y ?? this.y) + Math.sin(ang) * CAPTAIN_MUZZLE_PX;
    this.scene.fireCaptainBolt?.(this, mx, my, ang);
    this._shotFlashMs = 110;
    this._wKick = 14;
    this.recoilT = 90;
  }

  /**
   * THE ANIMATION IS THE STATE, AND THE STATE IS A COMBAT REASON.
   *
   * Nothing here reads velocity to decide what to play, which is the difference
   * between a body that is walking and a body that is being moved: the key
   * comes from what the Captain has DECIDED to do, and the facing comes from
   * where the fight is.
   */
  _applyAnim() {
    const pre = this._animPrefix;
    const { dir } = this._facingSuffix();
    let key;
    switch (this._cap) {
      case CAP.STAGGER: key = `${pre}-stagger-${dir}`; break;
      case CAP.BRACE:   key = `${pre}-brace-${dir}`; break;
      case CAP.BURST:
        // BRACE -> FLASH -> RECOIL -> back to brace, per round. The muzzle
        // flash is not the animation; the shoulder is.
        key = this._shotFlashMs > 60 ? `${pre}-fire-${dir}`
          : this._shotFlashMs > 0 ? `${pre}-recoil-${dir}`
            : `${pre}-brace-${dir}`;
        break;
      case CAP.RECOVER:
        // Settle: the recoil pose bleeds back into the breathing idle rather
        // than snapping, so the end of a burst has a shape.
        key = this._stateMs > this.def.recoverMs * 0.45
          ? `${pre}-recoil-${dir}` : `${pre}-idle-${dir}`;
        break;
      case CAP.STRAFE: key = `${pre}-strafe-${dir}`; break;
      default:         key = `${pre}-walk-${dir}`; break;
    }
    // A state that has stopped moving must not keep playing a walk cycle —
    // feet stepping on the spot is the inverse of a body sliding without them.
    const still = this.body && (this.body.velocity.x ** 2 + this.body.velocity.y ** 2) < 260;
    if (still && (this._cap === CAP.STRAFE || this._cap === CAP.ADVANCE || this._cap === CAP.GIVE_GROUND)) {
      key = `${pre}-idle-${dir}`;
    }
    if (this.anims.currentAnim?.key !== key && this.scene.anims.exists(key)) this.play(key);
  }

  /**
   * WEAPON RECOIL, APPLIED AFTER THE OVERLAY HAS BEEN PLACED.
   *
   * `Enemy.preUpdate` rewrites the weapon's x/y from the aim every frame, so a
   * tween on those numbers is a second author that loses. The kick is a
   * displacement applied here instead, downstream of the placement, and it
   * decays on its own clock.
   */
  _applyWeaponKick() {
    const w = this.weaponSprite;
    if (!w || this._wKick <= 0) return;
    w.x -= Math.cos(this._aim) * this._wKick;
    w.y -= Math.sin(this._aim) * this._wKick;
  }

  /**
   * The armour layer's own bar, above the hp bar and in the identity colour.
   *
   * It is drawn only while the layer is intact: once it breaks, the read is the
   * BODY — the sheared pauldron and the dead visor — and a second empty bar
   * would say the armour is still a thing that exists.
   */
  _drawArmourBar() {
    const g = this._armourBar;
    if (!g) return;
    if (!this.alive || this.armourBroken || this.armour >= this.armourMax - 0.001) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.clear();
    const w = 48, h = 4;
    const bx = this.x - w / 2, by = this.y - this._headroom() - 16;
    g.setDepth(this.y + 1);
    g.fillStyle(0x000000, 0.7);
    g.fillRect(bx - 1, by - 1, w + 2, h + 2);
    g.fillStyle(0x10202c, 1);
    g.fillRect(bx, by, w, h);
    g.fillStyle(this.def.color, 1);
    g.fillRect(bx, by, w * (this.armour / this.armourMax), h);
  }

  die(...args) {
    this._armourBar?.destroy();
    this._armourBar = null;
    return super.die(...args);
  }

  destroy(...args) {
    this._armourBar?.destroy();
    this._armourBar = null;
    return super.destroy(...args);
  }
}
