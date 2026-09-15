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
//
// ── PHASE B.2.1 — COMBAT PERSONALITY ────────────────────────────────────────
// The combatant foundation above is HUMAN-APPROVED AND FROZEN. What this file
// gained afterwards is a STATE LANGUAGE, on one rule:
//
//   SYMBOL = TRANSITION.  BODY / FX = SUSTAINED STATE.
//
// A glyph lives for a few hundred milliseconds to announce that something
// CHANGED and is then gone; everything that has to stay true about him is
// carried by the actor — a sheared pauldron, a dead visor, smoke, sparks. A
// glyph that lingers is a status icon, and a status icon is UI standing in the
// world. It is NOT a phase system: nothing below touches fire rate, speed,
// damage or the state machine, and a low-health Captain fights exactly the
// same as a fresh one.
//
// EVERY REACTION READS AUTHORITATIVE GAMEPLAY STATE. The armour event comes
// from the armour actually crossing zero, the low-health event from the body
// pool crossing its fraction, the major-hit event from the SAME threshold the
// stagger already uses, and the reacquire from real line of sight. There is no
// parallel state kept only for effects.
import Phaser from 'phaser';
import { Enemy, ST } from './Enemy.js';
import { CHAMPION } from '../config.js';
import { CAPTAIN_MUZZLE_PX } from '../systems/pixelArt.js';
import { SFX } from '../systems/FX.js';

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
    this._wSet = 0;                // weapon carry offset: pulled IN on a brace

    // ── REACTION STATE ────────────────────────────────────────────────────
    // Owned here, cleaned up here. No global status-effect framework, no timers
    // that can outlive the actor: the punctuation queue is data ticked in
    // `preUpdate`, so there is nothing to cancel on death.
    this._reactFx = [];            // display objects this actor owns
    this._punctQueue = [];         // { key, at } — sequenced, never simultaneous
    this._punctFreeAt = 0;
    this._lowHealthFired = false;
    this._impactGlyphCd = 0;
    this._clock = 0;               // local ms, so nothing reads wall time
    this._wearSmokeT = 0;
    this._wearSparkT = 0;
    this._embers = null;           // the one PERSISTENT mark; see `_drawEmbers`
    this._wearFlickerT = 0;
    this._flickerHold = 0;
    // Reacquire: LOS is sampled every frame, and a loss shorter than
    // `acquireLostMs` is a doorway rather than a break.
    this._hadLos = true;
    this._losLostMs = 0;
    this._acquireCd = def.acquireCooldownMs;

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
    //
    // THE MAJOR-HIT REACTION RIDES THIS EXACT THRESHOLD. There is no second
    // definition of "a big hit" anywhere — one semantic, two consequences.
    if (amount >= this.def.staggerMinDamage && this._staggerCd <= 0 && this.alive) {
      this._enter(CAP.STAGGER, this.def.staggerMs);
      this._staggerCd = this.def.staggerCooldownMs;
      this._majorHit(amount, knockbackVec);
    }
    // `toBody` can be 0 while the armour holds. The parent still runs alarms,
    // the hit event and the recoil, which is what keeps the hit FEELING landed.
    const hpBefore = this.hp;
    super.damage(toBody, knockbackVec);
    // ── LOW HEALTH — a DOWNWARD crossing of the body pool, once ────────────
    // Tested against the real pool either side of the parent's subtraction, so
    // it cannot retrigger by hovering at the line and cannot fire on a heal, on
    // a spawn, or after death. Independent of the armour by construction: this
    // reads `hp`, that reads `armour`.
    const line = this.hpMax * this.def.lowHealthFrac;
    if (!this._lowHealthFired && this.alive && hpBefore > line && this.hp <= line) {
      this._lowHealthFired = true;
      this._punctuate('glyph-rage');
      this.scene.fx?.burstDir?.(this.x, this.y - 12, 'white', 5, -Math.PI / 2, 90);
      this.scene.events.emit('champion-low-health', this);
    }
  }

  /**
   * A BLOW BIG ENOUGH TO MOVE HIM.
   *
   * The stagger pose is already the read; this is what makes it LAND — sparks
   * thrown back along the bearing the hit came from, a short body squash, and a
   * dull thump. The GLYPH has its own longer floor (`impactGlyphMs`): the
   * stagger may fire every 1.6s under sustained heavy fire and a mark that
   * often stops being punctuation and becomes weather.
   */
  _majorHit(amount, knockbackVec) {
    const fx = this.scene.fx;
    const ang = knockbackVec
      ? Math.atan2(knockbackVec.y, knockbackVec.x) : this._aim + Math.PI;
    fx?.burstDir?.(this.x, this.y, 'white', 7, ang, 80);
    fx?.impactRing?.(this.x, this.y, 0xffffff, this.y + 3);
    SFX.captainHeavyHit?.();
    this.recoilT = 120;
    if (this._impactGlyphCd <= 0) {
      this._impactGlyphCd = this.def.impactGlyphMs;
      this._punctuate('glyph-impact', { scale: 0.85, rise: 0.75 });
    }
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

    // ── THE MOMENT, NOT JUST THE STATE CHANGE ─────────────────────────────
    // The mechanic was already right; what it lacked was weight. Five things,
    // stacked in the order they physically happen — and all of them ACTOR
    // SCALE. This is a plate failing, not a boss phase: no screen flash, no
    // white-out, nothing that stops the player reading the fight around him.
    const fx = this.scene.fx;
    // 1. the crack: a hard white ring at his own depth, tight.
    fx?.impactRing?.(this.x, this.y, 0xffffff, this.y + 3);
    // 2. the shards, thrown FROM the shoulder that lost its plate and AWAY from
    //    it, so the debris says which piece went.
    const away = this._aim + Math.PI * (this._facingSuffix().flipX ? 0.35 : -0.35);
    fx?.burstDir?.(this.x, this.y - 8, 'white', 14, away, 70);
    fx?.burstDir?.(this.x, this.y - 8, 'yellow', 8, away, 130);
    // 3. the discharge — his own electric blue, briefly, over the break.
    this._discharge(220);
    // 4. the flinch. A real body reaction: the stagger pose and its cooldown,
    //    taken deliberately rather than waiting for the damage threshold.
    this._enter(CAP.STAGGER, this.def.staggerMs);
    this._staggerCd = this.def.staggerCooldownMs;
    this.recoilT = 140;
    // 5. and the punctuation, last, on the sequencing queue so it cannot land
    //    on top of a low-health mark in the same frame.
    this._punctuate('glyph-break');
    SFX.captainArmourBreak?.();
    fx?.shake?.(0.006, 140);
    this.scene.events.emit('champion-armour-broken', this);
  }

  // ── THE REACTION LAYER ────────────────────────────────────────────────────
  //
  // Everything below is owned by this actor and dies with it. No Phaser timers:
  // the punctuation queue is DATA ticked in `preUpdate`, so there is nothing to
  // cancel on death and nothing that can fire into a destroyed scene. Tweens
  // are attached to objects held in `_reactFx`, and `_clearReactions` kills
  // both halves.

  /**
   * Queue one glyph. SEQUENCED, NEVER SIMULTANEOUS.
   *
   * Two marks in the same frame is effect soup and neither reads, and the
   * armour breaking at the same instant as the health line is crossed is not a
   * hypothetical — a Super does both. `punctSpacingMs` is the floor between
   * them; the second simply waits.
   */
  _punctuate(key, opts = {}) {
    if (!this.alive || !this.scene) return;
    const at = Math.max(this._clock, this._punctFreeAt);
    this._punctFreeAt = at + this.def.punctSpacingMs;
    this._punctQueue.push({ key, at, opts });
  }

  _tickPunctuation() {
    while (this._punctQueue.length && this._punctQueue[0].at <= this._clock) {
      const { key, opts } = this._punctQueue.shift();
      this._spawnGlyph(key, opts);
    }
  }

  /**
   * ABOVE THE HELMET, NEVER OVER THE VISOR.
   *
   * The visor is the fastest identification on the body and the one thing a
   * reaction may not cover. The glyph sits clear of the head, rises a little
   * and goes; it is depth-sorted just above the actor so it cannot be hidden by
   * him and cannot draw over the enemy standing in front.
   */
  _spawnGlyph(key, opts = {}) {
    if (!this.alive || !this.scene?.add) return;
    if (!this.scene.textures.exists(key)) return;
    // OFF THE CENTRELINE, DELIBERATELY. `fx.damageNumber` spawns at
    // `(x, y - 40)` and rises straight up, so a glyph directly over the helmet
    // shares a column with every hit label — and the frame that caused a
    // reaction is exactly the frame that also printed a number. Pushed to the
    // side and held lower than the label's arc, the two read as two things.
    const g = this.scene.add.image(
      this.x + (opts.dx ?? 24), this.y - this._headroom() - 18, key,
    ).setDepth(this.y + 24).setScale((opts.scale ?? 1) * 0.7).setAlpha(0);
    this._reactFx.push(g);
    const rise = (opts.rise ?? 1) * this.def.punctRiseMs;
    this.scene.tweens.add({
      targets: g, scale: opts.scale ?? 1, alpha: 1,
      duration: 90, ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: g, y: g.y - 22, alpha: 0,
      delay: rise * 0.42, duration: rise * 0.58, ease: 'Quad.easeIn',
      onComplete: () => { this._dropFx(g); g.destroy(); },
    });
  }

  /**
   * A short electrical arc over the body — the armour's own power letting go.
   *
   * ONE Graphics, redrawn each frame of its life from the actor's live
   * position, so it cannot be stranded where he used to be. His own blue,
   * because that is already what his systems are painted in.
   */
  _discharge(ms) {
    if (!this.scene?.add) return;
    const g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    g.setDepth(this.y + 4);
    this._reactFx.push(g);
    const started = this._clock;
    g._tick = () => {
      const u = (this._clock - started) / ms;
      if (u >= 1 || !this.alive) { this._dropFx(g); g.destroy(); return; }
      g.clear();
      g.setDepth(this.y + 4);
      const a = (1 - u) * 0.9;
      for (let i = 0; i < 3; i++) {
        let x = this.x + Phaser.Math.Between(-18, 18);
        let y = this.y + Phaser.Math.Between(-22, 6);
        g.lineStyle(2, i === 0 ? 0xffffff : this.def.color, a);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 3; k++) {
          x += Phaser.Math.Between(-11, 11);
          y += Phaser.Math.Between(-9, 9);
          g.lineTo(x, y);
        }
        g.strokePath();
      }
    };
  }

  /**
   * SUSTAINED DAMAGE — small, intermittent, and never a particle blanket.
   *
   * He fights inside CROSSFIRE and SWARM TIDE, with player FX and damage
   * numbers over the same square metre, so the sustained half has to be almost
   * nothing per event and merely PRESENT over time. Three independent slow
   * clocks rather than one: a single emitter at any rate reads as a machine
   * ticking, three unrelated ones read as a body failing.
   *
   * ARMOUR BROKEN gets the sparks. LOW HEALTH adds smoke and a visor that
   * cannot hold. Both together is still three small things.
   */
  _tickWear(delta) {
    if (!this.alive) return;
    const fx = this.scene.fx;
    const d = this.def;
    const roll = (lo, hi) => Phaser.Math.Between(lo, hi);
    if (this.armourBroken) {
      this._wearSparkT -= delta;
      if (this._wearSparkT <= 0) {
        this._wearSparkT = roll(d.wearSparkMs[0], d.wearSparkMs[1]);
        // At the shear, not at his centre: the sparks have to come from the
        // piece that is missing or they are just decoration on a sprite.
        const side = this._facingSuffix().flipX ? 1 : -1;
        fx?.burstDir?.(this.x + side * 16, this.y - 10, 'yellow', 2,
          this._aim + Math.PI * 0.5 * side, 60);
      }
    }
    if (this._lowHealthFired) {
      this._wearSmokeT -= delta;
      if (this._wearSmokeT <= 0) {
        this._wearSmokeT = roll(d.wearSmokeMs[0], d.wearSmokeMs[1]);
        // `ventSmoke`, not `smokeTrail`. The missile trail's particle is darker
        // than the deck and lives 420ms, and one of them on a body photographs
        // as nothing — measured. This one is lighter than the floor, rises, and
        // is drawn above the actor band instead of behind the actor.
        fx?.ventSmoke?.(this.x + roll(-8, 8), this.y - roll(6, 18), 2);
      }
      this._wearFlickerT -= delta;
      if (this._wearFlickerT <= 0) {
        this._wearFlickerT = roll(d.wearFlickerMs[0], d.wearFlickerMs[1]);
        this._flickerHold = d.wearFlickerHoldMs;
      }
    }
    if (this._flickerHold > 0) this._flickerHold -= delta;
    this._drawEmbers();
  }

  /**
   * THE ONE THING THAT IS ALWAYS TRUE.
   *
   * Everything else in the sustained half is an EVENT — a puff, a spark, a
   * flicker — and an event is only visible for the fraction of the time it is
   * running. A player glancing at him, or a still frame, catches none of them:
   * the first build's low-health state photographed as an undamaged Captain,
   * which is the whole failure this layer exists against ("if the glyph is the
   * only thing that ever said damaged, the damage was UI").
   *
   * So one small persistent mark, breathing rather than blinking: an ember at
   * the shear where the pauldron went, and a second on the chest once the body
   * itself is failing. Six pixels of dull heat — restrained enough that a
   * damaged Captain still reads as a Captain, present enough that he never
   * reads as a fresh one.
   *
   * It is NOT arena amber and it is not Vader's crimson: a low, desaturated
   * ember with a white core, which is what hot damaged metal looks like and is
   * not a colour any system in this game has claimed.
   */
  _drawEmbers() {
    const want = this.armourBroken || this._lowHealthFired;
    if (!want) {
      if (this._embers) { this._dropFx(this._embers); this._embers.destroy(); this._embers = null; }
      return;
    }
    if (!this._embers) {
      if (!this.scene?.add) return;
      this._embers = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      this._reactFx.push(this._embers);
    }
    const g = this._embers;
    g.clear();
    g.setDepth(this.y + 5);
    const side = this._facingSuffix().flipX ? 1 : -1;
    const pulse = (phase) => 0.44 + 0.32 * (0.5 + 0.5 * Math.sin(this._clock / 260 + phase));
    const ember = (x, y, r, a) => {
      g.fillStyle(0xff8a3a, a * 0.30); g.fillCircle(x, y, r + 3);
      g.fillStyle(0xff8a3a, a * 0.75); g.fillCircle(x, y, r);
      g.fillStyle(0xffd9a0, a);        g.fillCircle(x, y, r * 0.45);
    };
    if (this.armourBroken) ember(this.x + side * 17, this.y - 10, 5, pulse(0));
    // TWO MARKS, NOT THREE, AND BOTH BELOW THE HELMET. A third at `y - 20` sat
    // against the visor, which is the fastest identification on the body and
    // the one thing a reaction may not crowd.
    if (this._lowHealthFired) ember(this.x - side * 7, this.y + 2, 4.5, pulse(2.1));
  }

  /**
   * THE VISOR CANNOT HOLD.
   *
   * Applied after `super.preUpdate` for the same reason the weapon kick is:
   * `Enemy.preUpdate` writes `setAlpha` every frame, so anything that touches
   * it upstream is a second author that loses. A dip rather than a tint —
   * tinting reaches the whole body and reads as a status effect, where a
   * momentary loss of alpha reads as power failing.
   */
  _applyFlicker() {
    if (this._flickerHold > 0 && !this._performing) this.setAlpha(0.62);
  }

  _dropFx(o) {
    const i = this._reactFx.indexOf(o);
    if (i >= 0) this._reactFx.splice(i, 1);
  }

  /** Nothing this actor started may outlive it. */
  _clearReactions() {
    this._punctQueue.length = 0;
    this._embers = null;
    this._reactFx.slice().forEach((o) => {
      this.scene?.tweens?.killTweensOf(o);
      o.destroy?.();
    });
    this._reactFx.length = 0;
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
    if (!this.alive) {
      if (this._armourBar) this._armourBar.visible = false;
      if (this._reactFx.length || this._punctQueue.length) this._clearReactions();
      return;
    }

    // ONE LOCAL CLOCK. Everything the reaction layer schedules is measured on
    // it, so nothing reads wall time and a paused scene cannot advance a queue.
    this._clock += delta;
    if (this._staggerCd > 0) this._staggerCd -= delta;
    if (this._impactGlyphCd > 0) this._impactGlyphCd -= delta;
    if (this._acquireCd > 0) this._acquireCd -= delta;
    if (this._shotFlashMs > 0) this._shotFlashMs -= delta;
    if (this._wKick > 0) this._wKick = Math.max(0, this._wKick - delta * 0.09);
    this._tickPunctuation();
    this._tickWear(delta);
    this._reactFx.slice().forEach((o) => o._tick?.());

    // ONE SYSTEM DRIVES AN ACTOR AT A TIME. `Enemy.preUpdate` already yields on
    // `_performing`; this must too, so a future signature move's wind-up is not
    // overwritten by the combat loop on the very next frame.
    if (this._performing) {
      this._applyFlicker();
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
    this._tickAcquire(p, delta);

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
    this._applyFlicker();
    this._drawArmourBar();
  }

  /**
   * HE HAS THE LINE AGAIN.
   *
   * MEASURED BEFORE IT WAS BUILT, because §14's own instruction is not to
   * manufacture AI state for a flourish. In a real CROSSFIRE and a real
   * VANGUARD the Captain holds line of sight ~85% of frames and loses it about
   * twice per 22 seconds, for 0.5-3.4s at a time — and in 21-34 of those frames
   * he was READY TO FIRE AND COULD NOT. That is a genuine engagement
   * relationship being lost and regained, not an aim angle wobbling, so the
   * transition is real and worth a mark.
   *
   * Two gates keep it from becoming noise: a break shorter than
   * `acquireLostMs` is a doorway rather than a loss, and `acquireCooldownMs`
   * bounds the rate whatever the geometry does.
   */
  _tickAcquire(p, delta) {
    const los = this._hasLOS(this.x, this.y, p.x, p.y);
    if (!los) {
      this._losLostMs += delta;
      this._hadLos = false;
      return;
    }
    if (!this._hadLos) {
      const lost = this._losLostMs;
      this._hadLos = true;
      this._losLostMs = 0;
      if (lost >= this.def.acquireLostMs && this._acquireCd <= 0) {
        this._acquireCd = this.def.acquireCooldownMs;
        this._punctuate('glyph-alert', { scale: 0.8, rise: 0.6, dx: 14 });
        // The visor comes up with it — the glyph says he noticed, the body says
        // he is looking at you.
        this._flickerHold = 0;
        this._shotFlashMs = Math.max(this._shotFlashMs, 0);
        this.scene.events.emit('champion-reacquire', this);
      }
      return;
    }
    this._losLostMs = 0;
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
    // A HEAVIER KICK THAN THE FIRST BUILD, and it is the kick that reads at 1x
    // inside a crowded wave — the muzzle flash is over in 95ms and competes
    // with everything else on screen, where the weapon travelling backwards
    // lasts through the whole gap to the next round.
    this._wKick = 19;
    this.recoilT = 105;
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
    if (!w) return;
    // THE BRACE IS A CARRY, NOT A POSE. The weapon is pulled IN toward the body
    // while he sets himself and rides back out as the burst runs, so the
    // preparation is visible on the WEAPON as well as on the shoulder — at 1x
    // the rifle is a bigger shape than the arm holding it.
    const want = this._cap === CAP.BRACE ? -5 : 0;
    this._wSet += (want - this._wSet) * 0.35;
    const off = this._wKick - this._wSet;
    if (Math.abs(off) < 0.01) return;
    w.x -= Math.cos(this._aim) * off;
    w.y -= Math.sin(this._aim) * off;
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
    this._clearReactions();
    return super.die(...args);
  }

  destroy(...args) {
    this._armourBar?.destroy();
    this._armourBar = null;
    this._clearReactions();
    return super.destroy(...args);
  }
}
