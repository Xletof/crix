import Phaser from 'phaser';
import { PLAYER, WEAPONS } from '../config.js';
import { SFX } from '../systems/FX.js';
import { isGodMode } from '../systems/debug.js';
import { Grenade } from './Grenade.js';

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(30);
    this.body.setCircle(PLAYER.radius, this.width / 2 - PLAYER.radius, this.height / 2 - PLAYER.radius);
    this.body.setCollideWorldBounds(true);

    // ── Core stats ─────────────────────────────────────────────────────────
    this.hp           = PLAYER.hp;
    this.hpMax        = PLAYER.hp;
    this.ammo         = PLAYER.ammoMax;
    this.ammoTimers   = [];
    this.fireCooldown = 0;
    this.lastHurtAt   = -99999;
    this.superCharge  = 0;
    // ── Melee "Broken Wings" skill — a SEPARATE meter from superCharge so both
    // skills can be ready at once. Nothing here may touch superCharge.
    this.meleeCharge  = 0;
    this._comboStage  = 0;   // 0 = not in a combo, 1..2 = casts already spent
    this._comboWindowMs = 0; // time left to chain the next cast
    this._meleeLungeMs  = 0; // remaining lunge drive time
    // The cast in flight. Damage resolves when the lunge LANDS, not when it is
    // fired, so a 260px dash hits what it arrives at rather than what it left.
    this._meleeCastDir      = 0;
    this._meleeCastStage    = 0;
    this._meleeCastFinisher = false;
    // Pose timers. Same convention as recoilT/recoilDur: each timer carries its
    // own duration, so no branch can normalise by another's constant.
    this._meleeAnimT     = 0;
    this._meleeAnimDur   = 0;
    this._meleeAnimStage = 0;
    this.alive        = true;
    this.hiddenInBush = false;
    this.isRegenerating = false;
    this._hurtStaggerMs = 0;
    this._wKickT        = 0;
    this._wKickDur      = 80;
    this._wKickMag      = 7;
    this.accuracyMult   = 1.0;
    this.hitStreak      = 0;
    this.runMaxCombo    = 1.0;

    // ── Per-run upgrade stat layer ──────────────────────────────────────────
    // Identity-valued multipliers applied at each stat's read site (never by
    // mutating the shared PLAYER config — that would leak across runs). Reset
    // for free every run since Player is only rebuilt on scene restart.
    this.dmgMult           = 1;
    this.reloadMult        = 1;
    this.moveMult          = 1;
    this.dashChargesBonus  = 0;
    this.dashRechargeMult  = 1;
    this.superGainMult     = 1;
    this.regenMult         = 1;
    this.killHeal          = 0;   // HP restored per kill (BLOOD PACT upgrade)
    this._upgrades         = [];

    // ── Aiming state ───────────────────────────────────────────────────────
    this.facing      = -Math.PI / 2;
    this.aim         = -Math.PI / 2;
    this.aiming      = false;
    this.superAim    = -Math.PI / 2;
    this.superAiming = false;
    // Melee aim hold — a deliberate mirror of superAim/superAiming on its own
    // fields, so the two abilities can never stomp each other's telegraph.
    this.meleeAim         = -Math.PI / 2;
    this.meleeAiming      = false;
    this._meleeHoldActive = false;  // a press is down (either input path)
    this._meleeHeldMs     = 0;      // how long, for the tap/hold split
    this._kbMeleeHold     = false;  // that press is the R key, so steer by mouse
    // Firing forces a facing snap toward the shot; this holds it against
    // continuous movement input (which otherwise overwrites `facing` every
    // frame you're still holding a direction) so the turn is actually visible
    // instead of being stomped on the very next tick.
    this._facingLockMs = 0;

    // ── Secondary weapon slot ──────────────────────────────────────────────
    // null means pistol only. Set by equipSecondary(weaponId).
    this.secondary      = null;  // weapon id string
    this.secondaryAmmo  = 0;     // rifle ammo / cluster charges

    // Burst fire state (rifle)
    this._burstRemaining = 0;
    this._burstTimer     = 0;
    this._burstAngle     = 0;

    // ── Animation helpers ──────────────────────────────────────────────────
    this._fireAnimTimer = 0;
    // Recoil is a timer + the duration it started from (so the 0..1 ratio is
    // normalized per weapon) + a signed magnitude: negative squashes the body
    // inward (light weapons), positive pops it outward (the super).
    this.recoilT        = 0;
    this.recoilDur      = 110;
    this.recoilMag      = -0.12;
    this.revealTimer    = 0; // timer to reveal player when firing in bush
    this.dashCharges    = (PLAYER.dashChargesMax || 3) + this.dashChargesBonus;
    this.dashRechargeTimer = 0;
    this.isDashing      = false;
    this.dashTimer      = 0;
    this.dashAngle      = 0;

    // ── Movement ramp ──────────────────────────────────────────────────────
    // Target velocity set by setMoveInput; preUpdate eases body.velocity
    // toward it instead of snapping. Kills the "dragging picture" feel.
    this._moveTargetX = 0;
    this._moveTargetY = 0;
    // Smoothed move-vs-still envelope (0..1) for anim crossfade + scale.
    this._moveEnv = 0;

    // ── Visual accessories ─────────────────────────────────────────────────
    this.shadow = scene.add.image(x, y + 12, 'shadow')
      .setDepth(this.depth - 1).setAlpha(0.35);

    // "You are here" glow ring — Mando-cyan, always visible so the player can
    // spot themselves at a glance on small screens.
    this.glowRing = scene.add.graphics().setDepth(this.depth - 2);
    this.glowRing.fillStyle(0x40c8ff, 0.18);
    this.glowRing.fillCircle(0, 0, PLAYER.radius + 14);
    this.glowRing.lineStyle(2, 0x80e8ff, 0.75);
    this.glowRing.strokeCircle(0, 0, PLAYER.radius + 8);
    this.glowRing.setPosition(x, y);
    this._glowPulse = 0;

    // Super-ready aura: extra wider red/orange ring that only shows when
    // the super meter is full. Pulses faster than the cyan you-are-here.
    this.superAura = scene.add.graphics().setDepth(this.depth - 3).setVisible(false);
    this._auraPulse = 0;

    // Damage shield generated by hacking slicing ports
    this.shieldRing = scene.add.graphics().setDepth(this.depth + 3).setVisible(false);
    this.shieldHp = 0;

    this.play('mando-idle-front');
    // Baseline scale (1.0)
    this.setScale(1.0);

    // ── Weapon overlay: held by the character, rotates to match aim. ─────
    // The body itself never rotates — the weapon does. This is how
    // shipping 2D top-down games (Brawl Stars etc.) handle aim direction.
    this.weaponSprite = scene.add.image(x, y, 'wpn-pistol')
      .setDepth(this.depth + 1)
      .setOrigin(0.15, 0.5)  // pivot near the grip so the barrel swings forward
      .setScale(1.0);
  }

  // ── Movement / aiming inputs (called by HUD joysticks) ────────────────────

  setMoveInput(vec) {
    if (!this.alive) { this._moveTargetX = 0; this._moveTargetY = 0; return; }
    // Hurt-stagger: ignore joystick input briefly so the knockback shove
    // is actually visible before the player resumes control.
    if (this._hurtStaggerMs > 0) return;
    if (vec?.force > 0) {
      const speed = PLAYER.speed * this.moveMult;
      this._moveTargetX = vec.x * speed * vec.force;
      this._moveTargetY = vec.y * speed * vec.force;
      // Don't let movement steal facing back while a fire-snap is holding —
      // otherwise firing while walking snaps for one frame then immediately
      // reverts to the move direction.
      if (this._facingLockMs <= 0) this.facing = Math.atan2(vec.y, vec.x);
      // Body NEVER rotates — only the weapon overlay does (handled in preUpdate).
      // When not aiming, the weapon follows the movement direction.
    } else {
      this._moveTargetX = 0;
      this._moveTargetY = 0;
    }
  }

  setAimInput(vec) {
    if (!this.alive) return;
    if (vec?.force > 0) {
      this.aiming = true;
      this.aim    = Math.atan2(vec.y, vec.x);
    } else {
      this.aiming = false;
    }
  }

  releaseAim(vec) {
    if (!this.alive) return;

    let dir;
    if (vec && vec.force > 0.05) {
      dir = Math.atan2(vec.y, vec.x);
    } else {
      // Auto-aim at closest enemy
      const target = this.scene.findNearestEnemy(this.x, this.y);
      if (target) {
        dir = Math.atan2(target.y - this.y, target.x - this.x);
        this.facing = dir;
        this.aim = dir;
        this._facingLockMs = 260;
      } else {
        dir = this.aim;
      }
    }

    this.tryFire(dir);
    this.aiming = false;
  }

  setSuperAimInput(vec) {
    if (!this.alive) return;
    if (vec?.force > 0) {
      this.superAiming = true;
      this.superAim    = Math.atan2(vec.y, vec.x);
    } else {
      // Auto mode: preview the nearest enemy so the cone points where the shot
      // will actually go (kept in sync each frame while held — see preUpdate).
      this.superAiming = true;
      this.superAim    = this._autoAimAngle();
    }
  }

  releaseSuperAim(vec) {
    if (!this.alive) return;
    let angle;
    if (vec && vec.force > 0.05) {
      angle = Math.atan2(vec.y, vec.x);
    } else {
      // Auto-aim super at closest enemy
      const target = this.scene.findNearestEnemy(this.x, this.y);
      if (target) {
        angle = Math.atan2(target.y - this.y, target.x - this.x);
        this.facing = angle;
        this.superAim = angle;
      } else {
        angle = this.facing;
      }
    }
    this.superAiming = false;
    this.tryFireSuper(angle);
  }

  // Keyboard super (Space): tap = auto-aim fire, hold = manual aim that
  // tracks facing (see preUpdate), fires on release.
  beginKeyboardSuperAim() {
    this._kbSuperHold = true;
    this.setSuperAimInput(null);
  }

  endKeyboardSuperAim() {
    this._kbSuperHold = false;
    // Keyboard super always auto-aims the nearest enemy — matches the previewed
    // cone. Manual precision aiming stays on the touch super stick.
    this.releaseSuperAim(null);
  }

  // ── Melee aim hold ────────────────────────────────────────────────────────
  // Same shape as the super's aim stick above, with one deliberate difference:
  // the super shows its cone the instant you touch down, this one must NOT. A
  // tap has to fire with no telegraph at all, so the aim state only arms once
  // the gesture has proved itself — either the finger dragged past the button's
  // tap threshold (force > 0) or the press outlived PLAYER.meleeAimArmMs.

  beginMeleeAim() {
    if (!this.alive) return;
    this._meleeHoldActive = true;
    this._meleeHeldMs     = 0;
    this.meleeAiming      = false;
    this.meleeAim         = this._autoAimAngle();
  }

  beginKeyboardMeleeAim() {
    this._kbMeleeHold = true;
    this.beginMeleeAim();
  }

  setMeleeAimInput(vec) {
    if (!this.alive) return;
    if (vec?.force > 0) {
      // An unambiguous drag arms the telegraph immediately — no point making
      // the player also wait out the hold timer once they've clearly aimed.
      this.meleeAiming = true;
      this.meleeAim    = Math.atan2(vec.y, vec.x);
    } else if (!this.meleeAiming) {
      // Still undecided: keep previewing where a tap would actually go.
      this.meleeAim = this._autoAimAngle();
    }
  }

  releaseMeleeAim(vec) {
    // Clear the hold BEFORE the alive check — dying mid-hold must not leave the
    // telegraph armed on the corpse.
    const wasAiming = this.meleeAiming;
    this._meleeHoldActive = false;
    this._kbMeleeHold     = false;
    this._meleeHeldMs     = 0;
    this.meleeAiming      = false;
    if (!this.alive) return false;
    if (vec && vec.force > 0.05) return this.tryMeleeCombo(Math.atan2(vec.y, vec.x));
    // Held long enough to see the telegraph: fire exactly where it pointed. A
    // tap passes no angle at all and tryMeleeCombo auto-aims as it always has.
    return wasAiming ? this.tryMeleeCombo(this.meleeAim) : this.tryMeleeCombo();
  }

  endKeyboardMeleeAim() {
    return this.releaseMeleeAim(null);
  }

  // ── Firing ────────────────────────────────────────────────────────────────

  // Angle to the nearest enemy (what an auto-aim shot will use), or the current
  // facing if the room is empty. Used to make the aim cone preview the actual
  // auto-target instead of the move direction.
  _autoAimAngle() {
    const t = this.scene.findNearestEnemy?.(this.x, this.y);
    return t ? Math.atan2(t.y - this.y, t.x - this.x) : this.facing;
  }

  keyboardFire() {
    if (!this.alive) return;
    this.tryFire(this._autoAimAngle());
  }

  tryFire(angleOverride) {
    if (!this.alive) return false;
    const dir = typeof angleOverride === 'number' ? angleOverride
      : this.aiming ? this.aim : this.facing;

    // Unify visual + shot direction: whatever we fire along, the body/weapon
    // face it too. Without this, an auto-aim shot flies at the target while the
    // gun still points along the move stick — bolts appear to leave the player's
    // back and the character never turns to the enemy. The facing lock makes
    // this snap hold even while a movement key is still held (mandatory turn
    // on fire, not just a same-frame flicker that movement immediately undoes).
    this.facing = dir;
    this.aim    = dir;
    this._facingLockMs = 260;

    this.revealTimer = 1500; // Reveal player when shooting

    // Route through active secondary weapon
    if (this.secondary === 'rifle' && this.secondaryAmmo > 0) {
      return this._startBurst(dir);
    }
    if (this.secondary === 'cluster' && this.secondaryAmmo > 0) {
      return this._throwCluster(dir);
    }
    // Default: pistol
    return this._firePistol(dir);
  }

  _firePistol(dir) {
    if (this.fireCooldown > 0) return false;
    if (this.ammo <= 0) return false;
    this.fireCooldown  = PLAYER.fireCooldownMs;
    this.ammo         -= 1;
    this.ammoTimers.push(PLAYER.ammoReloadMs * this.reloadMult);
    this.recoilT       = 110;
    this.recoilDur     = 110;
    this.recoilMag     = -0.12;  // light inward squash
    this._wKickT       = 80;
    this._wKickDur     = 80;
    this._wKickMag     = 7;
    this._fireAnimTimer = 140;
    this.scene.events.emit('player-fire', dir);
    SFX.shoot();
    return true;
  }

  _startBurst(dir) {
    if (this.fireCooldown > 0) return false;
    const cfg = WEAPONS.rifle;
    this.fireCooldown    = cfg.fireCooldownMs;
    this._burstRemaining = cfg.burstCount;
    this._burstTimer     = 0;
    this._burstAngle     = dir;
    this.recoilT         = 80;
    this.recoilDur       = 80;
    this.recoilMag       = -0.0873; // matches the rifle's previous peak (0.913)
    this._wKickT         = 60;
    this._wKickDur       = 60;
    this._wKickMag       = 5.25;
    this._fireAnimTimer  = 160;
    SFX.shoot();
    return true;
  }

  _fireBurstShot() {
    const cfg = WEAPONS.rifle;
    this.secondaryAmmo -= 1;
    this.scene.events.emit('player-fire-rifle', this._burstAngle);
    SFX.shoot();
    if (this.secondaryAmmo <= 0) {
      this._burstRemaining = 0;
      this._equipNothing();
    }
  }

  _throwCluster(dir) {
    if (this.fireCooldown > 0) return false;
    const cfg            = WEAPONS.cluster;
    this.secondaryAmmo  -= 1;
    this.fireCooldown    = 400;
    this._fireAnimTimer  = 200;
    this.recoilT         = 80;
    this.recoilDur       = 80;
    this.recoilMag       = -0.0873; // matches the throw's previous peak
    const spd = cfg.throwSpeed;
    const bx  = this.x + Math.cos(dir) * (PLAYER.radius + 10);
    const by  = this.y + Math.sin(dir) * (PLAYER.radius + 10);
    const grn = new Grenade(this.scene, bx, by, Math.cos(dir) * spd, Math.sin(dir) * spd);
    this.scene.grenades?.add(grn);
    SFX.shootSuper();
    this.scene.events.emit('secondary-ammo-changed');
    if (this.secondaryAmmo <= 0) this._equipNothing();
    return true;
  }

  // ── Super ─────────────────────────────────────────────────────────────────

  tryFireSuper(angleOverride) {
    if (!this.alive) return false;
    if (this.superCharge < PLAYER.superHitsToCharge) return false;
    this.superCharge = 0;
    // Tell the HUD the meter was spent. refreshSuper is event-driven ONLY, so
    // without this the button kept its lit texture and pulsing ready-glow until
    // the next hit happened to tick the meter — it read as still available.
    // tryMeleeCombo already emits its equivalent when it spends the melee meter.
    this.scene.events.emit('player-super-changed');
    this.revealTimer = 1500; // Reveal player
    const dir = typeof angleOverride === 'number' ? angleOverride
      : this.superAiming ? this.superAim : this.aiming ? this.aim : this.facing;
    // Face the super the same way — see tryFire.
    this.facing   = dir;
    this.superAim = dir;
    this.aim      = dir;
    this._facingLockMs = 260;
    this.recoilT        = 260;
    this.recoilDur      = 260;
    // The super POPS OUTWARD (positive) instead of squashing in — the heavy
    // blast shoves the body big for a beat and it settles back. Previously this
    // reused the pistol's 110ms divisor unclamped and shrank the player to ~73%,
    // which read as the shot imploding rather than punching.
    this.recoilMag      = 0.20;
    this._wKickT        = 180;   // bigger kick for the super
    this._wKickDur      = 180;
    this._wKickMag      = 16;
    this._fireAnimTimer = 240;
    this.scene.events.emit('player-fire-super', dir);
    SFX.shootSuper();
    return true;
  }

  tryDash() {
    if (!this.alive) return;
    if (isNaN(this.dashCharges) || !isFinite(this.dashCharges)) {
      this.dashCharges = (PLAYER.dashChargesMax || 3) + this.dashChargesBonus;
    }
    if (this.dashCharges <= 0) return;
    if (this.isDashing) return;
    if (this._hurtStaggerMs > 0) return;

    this.dashCharges--;
    this.isDashing = true;

    // Detect adjacent cover for Vault Dash
    let targetSpot = null;
    let minAngleDiff = Infinity;
    let desiredAngle = this.facing;
    if (this._moveTargetX !== 0 || this._moveTargetY !== 0) {
      desiredAngle = Math.atan2(this._moveTargetY, this._moveTargetX);
    }

    if (this.scene.coverRegistry && this.scene.coverRegistry.spots) {
      for (const spot of this.scene.coverRegistry.spots) {
        const dx = spot.x - this.x;
        const dy = spot.y - this.y;
        const dist = Math.hypot(dx, dy);

        // Only lock onto covers within 300px and not already hugging them (dist > 45px)
        if (dist > 45 && dist <= 300) {
          const angleToSpot = Math.atan2(dy, dx);
          const diff = Math.abs(Phaser.Math.Angle.ShortestBetween(desiredAngle * 180 / Math.PI, angleToSpot * 180 / Math.PI));
          if (diff <= 35 && diff < minAngleDiff) {
            minAngleDiff = diff;
            targetSpot = spot;
          }
        }
      }
    }

    if (targetSpot) {
      const dx = targetSpot.x - this.x;
      const dy = targetSpot.y - this.y;
      const dist = Math.hypot(dx, dy);
      
      this.dashAngle = Math.atan2(dy, dx);
      // Adaptive slide duration timer: scale time to match travel distance to cover edge
      const dashSpeed = PLAYER.dashSpeed || 950;
      const travelDist = Math.max(40, dist - 35); // offset cover radius
      this.dashTimer = Math.max(100, Math.min(400, (travelDist / dashSpeed) * 1000));
    } else {
      this.dashAngle = desiredAngle;
      this.dashTimer = PLAYER.dashDurationMs || 240;
    }

    if (isNaN(this.dashAngle) || !isFinite(this.dashAngle)) {
      this.dashAngle = 0;
    }

    this.scene.fx?.dustPuff?.(this.x, this.y + 14);
    SFX.dash();
    this.scene.events.emit('player-dash', this.dashCharges);
    this.scene.events.emit('player-dash-sound', this.x, this.y);
  }

  // ── Secondary weapon management ───────────────────────────────────────────

  equipSecondary(weaponId) {
    const cfg       = WEAPONS[weaponId];
    if (!cfg) return;
    this.secondary  = weaponId;
    // Set initial ammo/fuel/charges
    if (weaponId === 'rifle')          this.secondaryAmmo = cfg.totalAmmo;
    else if (weaponId === 'cluster')   this.secondaryAmmo = cfg.charges;
    this.scene.events.emit('secondary-equipped', weaponId);
    this.scene.events.emit('secondary-ammo-changed');
    SFX.waveStart(); // pickup chime
  }

  _equipNothing() {
    this.secondary     = null;
    this.secondaryAmmo = 0;
    this.scene.events.emit('secondary-equipped', null);
    this.scene.events.emit('secondary-ammo-changed');
  }

  // ── Damage / death ────────────────────────────────────────────────────────

  addShield(amount) {
    this.shieldHp = Math.min(PLAYER.shieldHpMax, this.shieldHp + amount);
    this.shieldRing.setVisible(true);
  }

  damage(amount, hitDirRad = null) {
    if (!this.alive) return;
    // Debug invincibility. Sits with the other i-frame guards rather than being
    // a heal-on-a-timer elsewhere, because this is the only entry point that
    // ever reduces hp — so one line here covers every damage source in the game.
    if (isGodMode()) return;
    if (this.isDashing) return; // i-frames (invincibility during dash)
    // Melee casts are i-framed for the WHOLE cast — lunge plus the swing and
    // recovery frames after it lands (_meleeAnimT spans exactly that, and is
    // zeroed by resetMeleeCombo and die()). Gating on _meleeLungeMs instead
    // dropped protection the instant the lunge stopped travelling, so the
    // committed, un-cancellable swing animation was the most dangerous part of
    // using the ability.
    //
    // Still per-cast, NOT per-chain: the ~2s combo window between casts stays
    // vulnerable, so the chain can't be paced out into a long invulnerability.
    if (PLAYER.meleeIframes !== false && this._meleeAnimT > 0) return;
    
    // Shield absorption logic
    if (this.shieldHp > 0) {
      const absorbed = Math.min(amount, this.shieldHp);
      this.shieldHp -= absorbed;
      amount -= absorbed;
      this.scene.fx.impactRing?.(this.x, this.y, 0x00ffff);
      if (this.shieldHp <= 0) {
        SFX.hit?.();
      }
    }
    
    if (amount <= 0) return;

    this.hp         = Math.max(0, this.hp - amount);
    this.scene.runDamageTaken = (this.scene.runDamageTaken || 0) + amount;
    this.lastHurtAt = this.scene.time.now;
    // Knockback shove if we know which direction we got hit from. Mirrors the
    // enemy stagger system: brief input-suspension window so the slide reads.
    if (typeof hitDirRad === 'number') {
      const kbStr = 220;
      this.body.velocity.x += Math.cos(hitDirRad) * kbStr;
      this.body.velocity.y += Math.sin(hitDirRad) * kbStr;
      this._hurtStaggerMs = 110;
    }
    this.scene.events.emit('player-hurt', amount, hitDirRad);
    SFX.hurt();
    if (this.hp <= 0) this.die();
  }

  onHitLanded() {
    this.hitStreak++;
    if (this.hitStreak >= 6) {
      this.accuracyMult = 2.0;
    } else if (this.hitStreak >= 4) {
      this.accuracyMult = 1.5;
    } else if (this.hitStreak >= 2) {
      this.accuracyMult = 1.2;
    } else {
      this.accuracyMult = 1.0;
    }
    this.runMaxCombo = Math.max(this.runMaxCombo || 1.0, this.accuracyMult);
    this.scene.events.emit('player-mult-changed', this.accuracyMult, this.hitStreak);
  }

  onShotMissed() {
    if (this.hitStreak > 0) {
      this.hitStreak = 0;
      this.accuracyMult = 1.0;
      this.scene.events.emit('player-mult-changed', this.accuracyMult, this.hitStreak);
    }
  }

  addSuperHit() {
    const max        = PLAYER.superHitsToCharge;
    const before     = this.superCharge;
    // Charge gains scaled by current combo multiplier
    this.superCharge = Math.min(max, this.superCharge + this.accuracyMult * this.superGainMult);
    if (before < max && this.superCharge >= max) {
      SFX.superReady();
      this.scene.events.emit('player-super-ready');
    } else {
      // Rising tick so each connecting pellet audibly feeds the meter.
      SFX.superTick(this.superCharge / max);
      // Halfway milestone chime on the crossing.
      if (before / max < 0.5 && this.superCharge / max >= 0.5) SFX.superHalf();
      this.scene.events.emit('player-super-changed');
    }
  }

  // Melee meter — deliberately a mirror of addSuperHit on its OWN field, so the
  // two skills charge independently and neither can drain the other.
  addMeleeHit() {
    const max    = PLAYER.meleeHitsToCharge;
    const before = this.meleeCharge;
    this.meleeCharge = Math.min(max, this.meleeCharge + this.accuracyMult * this.superGainMult);
    if (before < max && this.meleeCharge >= max) {
      this.scene.events.emit('player-melee-ready');
    } else {
      this.scene.events.emit('player-melee-changed');
    }
  }

  // True only while a cast's lunge is actually travelling. The afterimage rig
  // guards on this the way the dash's guards on isDashing, so the trail stops
  // exactly where the player does.
  get isMeleeLunging() {
    return this._meleeLungeMs > 0;
  }

  get meleeReady() {
    return this.meleeCharge >= PLAYER.meleeHitsToCharge;
  }

  // "Broken Wings": three chained casts. The meter is consumed on the FIRST
  // cast only — casts 2 and 3 are free while the combo window is live, so the
  // whole chain is one ability. Letting the window lapse resets to stage 0.
  tryMeleeCombo(angleOverride) {
    if (!this.alive) return false;
    if (this.isDashing) return false;
    if (this._hurtStaggerMs > 0) return false;

    const inCombo = this._comboStage > 0 && this._comboWindowMs > 0;
    if (!inCombo) {
      if (!this.meleeReady) return false;
      this.meleeCharge = 0;              // spend once, at the start of the chain
      this._comboStage = 0;
      this.scene.events.emit('player-melee-changed');
    }

    const stage = this._comboStage + 1;  // 1..3
    this._comboStage = stage;
    const finisher = stage >= 3;

    // Face the cast so the lunge and arc agree with what the player sees. An
    // explicit angle comes from a held aim (mouse or drag); without one this
    // auto-aims exactly as it always has, which is the tap path.
    const dir = typeof angleOverride === 'number' ? angleOverride : this._autoAimAngle();
    this.facing = dir;
    this.aim = dir;
    this._facingLockMs = 220;

    // Velocity-driven lunge (NOT a position tween) so walls still collide.
    const spd = finisher ? PLAYER.meleeFinisherLungeSpeed : PLAYER.meleeLungeSpeed;
    this._meleeLungeMs = this._gapCloseMs(dir, spd, finisher);
    this.setVelocity(Math.cos(dir) * spd, Math.sin(dir) * spd);

    // Remember the cast so the landing can resolve it (see preUpdate).
    this._meleeCastDir      = dir;
    this._meleeCastStage    = stage;
    this._meleeCastFinisher = finisher;

    // Pose driver for the swing / flip animation (Player pose chain).
    this._meleeAnimDur   = this._meleeLungeMs + (finisher ? 140 : 90);
    this._meleeAnimT     = this._meleeAnimDur;
    this._meleeAnimStage = stage;

    // Third cast ends the chain; otherwise open the window for the next one.
    this._comboWindowMs = finisher ? 0 : PLAYER.meleeComboWindowMs;
    if (finisher) this._comboStage = 0;

    // Blade hum holds across the whole chain so three casts read as one
    // ability rather than three unrelated swings. The finisher ends it — the
    // slam is the punctuation and shouldn't have a drone under its tail.
    if (finisher) SFX.meleeHumStop?.();
    else          SFX.meleeHumStart?.();

    this.scene.events.emit('player-melee-cast', dir, stage, finisher);
    return true;
  }

  // How long to drive the lunge for. With no target it is a flat directional
  // dash; with one, the duration is solved so the dash ENDS at contact range
  // instead of stopping short or sailing past. Capped by meleeGapCloseMax so a
  // distant enemy can't teleport the player across the room.
  _gapCloseMs(dir, spd, finisher) {
    const baseMs = finisher ? PLAYER.meleeFinisherLungeMs : PLAYER.meleeLungeMs;
    const cone   = Phaser.Math.DegToRad(PLAYER.meleeGapCloseConeDeg);
    const t = this.scene.findNearestEnemyInCone?.(
      this.x, this.y, dir, PLAYER.meleeGapCloseMax + PLAYER.meleeRange, cone,
    );
    if (!t) return baseMs;

    // Stop a little inside reach so the arc/slam definitely covers the target.
    const contact = (t.cfg?.radius ?? 22) + PLAYER.meleeRange * 0.5;
    const travel  = Phaser.Math.Clamp(
      Math.hypot(t.x - this.x, t.y - this.y) - contact,
      0, PLAYER.meleeGapCloseMax,
    );
    // Never shorter than a token hop — a zero-length lunge reads as a stutter.
    return Phaser.Math.Clamp((travel / spd) * 1000, 60, baseMs * 1.6);
  }

  // 0..1 through the current melee cast's animation. Normalised by THIS cast's
  // own duration (recoilT/recoilDur convention) — a shared divisor is what made
  // the super shrink the player instead of popping it.
  _meleeProgress() {
    if (this._meleeAnimT <= 0) return 1;
    return Phaser.Math.Clamp(1 - this._meleeAnimT / (this._meleeAnimDur || 1), 0, 1);
  }

  // Full 360 of the finisher's somersault, front-loaded so the spin reads fast
  // and the landing settles.
  _meleeFlipRad(mp) {
    return Phaser.Math.Easing.Cubic.Out(mp) * Math.PI * 2;
  }

  // Blade angle relative to the aim direction. Casts 1-2 sweep a wide arc in
  // mirrored directions; the finisher cartwheels in lockstep with the body so
  // player and sword somersault as one.
  _meleeBladeOffset() {
    const mp = this._meleeProgress();
    if (this._meleeAnimStage >= 3) return this._meleeFlipRad(mp);
    const SWEEP = 1.35;                                  // ~77 degrees each way
    const e = Phaser.Math.Easing.Cubic.Out(mp);
    const from = this._meleeAnimStage === 2 ? -SWEEP : SWEEP;
    return from - e * from * 2;
  }

  // Single place to drop a combo so no path can leave a stale stage behind.
  resetMeleeCombo() {
    // Catch-all for the remaining exits (death, scene teardown, external
    // cancels). meleeHumStop is idempotent, so the overlap with the other two
    // call sites is harmless.
    SFX.meleeHumStop?.();
    this._comboStage = 0;
    this._comboWindowMs = 0;
    this._meleeLungeMs = 0;
    this._meleeAnimT = 0;
    this._meleeAnimStage = 0;
    // Drop any live aim hold too, so nothing can leave a telegraph on screen
    // after the combo it belonged to is gone.
    this._meleeHoldActive = false;
    this._kbMeleeHold     = false;
    this._meleeHeldMs     = 0;
    this.meleeAiming      = false;
  }

  die() {
    this.alive       = false;
    this.resetMeleeCombo();
    this.setVelocity(0, 0);
    this.jetEmitter?.stop();
    this.scene.events.emit('player-dead');
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta);

    if (this._facingLockMs > 0) this._facingLockMs -= delta;
    // Combo window: let it lapse and the chain drops back to stage 0, so the
    // next cast has to pay for a fresh meter.
    if (this._comboWindowMs > 0) {
      this._comboWindowMs -= delta;
      if (this._comboWindowMs <= 0) {
        this._comboWindowMs = 0;
        this._comboStage = 0;
        // Chain timed out — the blade hum has to die with it. This path zeroes
        // the state inline rather than going through resetMeleeCombo, so it
        // needs its own stop or the hum outlives the combo it belonged to.
        SFX.meleeHumStop?.();
        this.scene.events.emit('player-melee-changed');
      }
    }
    // Pose timer for the swing / flip. Decays independently of the lunge so
    // the animation can run slightly past the end of the travel.
    if (this._meleeAnimT > 0) {
      this._meleeAnimT -= delta;
      if (this._meleeAnimT <= 0) { this._meleeAnimT = 0; this._meleeAnimStage = 0; }
    }

    // Keyboard super hold: the aim cone tracks the nearest enemy (the auto-aim
    // target) so it previews exactly where the shot will go on release.
    if (this._kbSuperHold && this.superAiming) {
      this.superAim = this._autoAimAngle();
    }

    // Melee aim hold. Ticked here rather than from input events because a still
    // finger emits no pointermove at all — the arm timer has to advance anyway.
    if (this._meleeHoldActive) {
      this._meleeHeldMs += delta;
      if (this._kbMeleeHold) {
        // Desktop steers with the mouse. positionToCamera is required rather
        // than raw pointer.x/y: the game camera is inset below the HUD top bar,
        // so screen and world coordinates do not share an origin.
        const ptr = this.scene.input?.activePointer;
        if (ptr) {
          const w = ptr.positionToCamera(this.scene.cameras.main);
          this.meleeAim = Math.atan2(w.y - this.y, w.x - this.x);
        }
      }
      if (!this.meleeAiming && this._meleeHeldMs >= (PLAYER.meleeAimArmMs ?? 130)) {
        this.meleeAiming = true;
      }
      // Face the telegraph, and hold it against move input so the body doesn't
      // swing back to the stick direction while you're lining the cast up.
      if (this.meleeAiming) {
        this.facing = this.meleeAim;
        this._facingLockMs = Math.max(this._facingLockMs, 60);
      }
    }

    // Recharge dash charges
    const dashMax = (PLAYER.dashChargesMax || 3) + this.dashChargesBonus;
    if (isNaN(this.dashCharges) || !isFinite(this.dashCharges)) {
      this.dashCharges = dashMax;
    }
    if (this.dashCharges < dashMax) {
      this.dashRechargeTimer += delta;
      if (this.dashRechargeTimer >= (PLAYER.dashRechargeMs || 2800) * this.dashRechargeMult) {
        this.dashCharges++;
        this.dashRechargeTimer = 0;
        this.scene.events.emit('player-dash-recharged', this.dashCharges);
      }
    } else {
      this.dashRechargeTimer = 0;
    }

    if (this.isDashing) {
      if (isNaN(this.dashTimer) || !isFinite(this.dashTimer)) {
        this.dashTimer = 0;
      }
      this.dashTimer -= delta;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.body.setVelocity(0, 0);
      } else {
        if (this.body) {
          const vx = Math.cos(this.dashAngle) * (PLAYER.dashSpeed || 950);
          const vy = Math.sin(this.dashAngle) * (PLAYER.dashSpeed || 950);
          if (!isNaN(vx) && !isNaN(vy) && isFinite(vx) && isFinite(vy)) {
            this.body.setVelocity(vx, vy);
          } else {
            this.body.setVelocity(0, 0);
          }
        }
        if (Math.random() < 0.45) {
          this.scene.fx?.dustPuff?.(this.x, this.y + 14);
        }
      }
    } else if (this._meleeLungeMs > 0) {
      // Melee lunge drive. Velocity is left as tryMeleeCombo set it so Arcade
      // collision still resolves against walls; movement input is ignored for
      // the duration, then we damp out rather than hard-stopping.
      this._meleeLungeMs -= delta;
      if (this._meleeLungeMs <= 0) {
        this._meleeLungeMs = 0;   // clamp; leaving it negative is just litter
        this.body.velocity.x *= 0.35;
        this.body.velocity.y *= 0.35;
        // Resolve the swing HERE, at the end of the travel. Firing it at cast
        // time would damage whatever was next to the launch point and then fly
        // past it. Frame-driven rather than a delayedCall so it stays in step
        // with the lunge even when the frame rate sags.
        this.scene.events.emit('player-melee-land',
          this._meleeCastDir, this._meleeCastStage, this._meleeCastFinisher);
      }
    } else if (this._hurtStaggerMs > 0) {
      this._hurtStaggerMs -= delta;
      this.body.velocity.x *= 0.88;
      this.body.velocity.y *= 0.88;
    } else if (this.alive) {
      // Acceleration / deceleration ramp toward the target velocity set by
      // the joystick. Snapping instantly to top speed reads as "dragging a
      // picture"; ramping over ~3 frames reads as weight.
      const dt    = delta / 1000;
      const tx    = this._moveTargetX || 0;
      const ty    = this._moveTargetY || 0;
      const vx    = this.body.velocity.x;
      const vy    = this.body.velocity.y;
      const dx    = tx - vx;
      const dy    = ty - vy;
      const dMag  = Math.hypot(dx, dy);
      const rate  = (tx === 0 && ty === 0) ? PLAYER.decelPerSec : PLAYER.accelPerSec;
      const step  = rate * dt;
      if (dMag <= step) {
        this.body.setVelocity(tx, ty);
      } else {
        this.body.setVelocity(vx + (dx / dMag) * step, vy + (dy / dMag) * step);
      }
    }

    // Footstep dust puffs — drop a small particle puff every ~140ms while
    // the player is moving fast enough for it to read as running.
    const movingSq = this.body.velocity.x ** 2 + this.body.velocity.y ** 2;
    this._stepTimer = (this._stepTimer || 0) + delta;
    if (this.alive && movingSq > 8000 && this._stepTimer >= 140) {
      this._stepTimer = 0;
      this.scene.fx?.dustPuff?.(this.x, this.y + 14);
    }

    if (this.fireCooldown > 0) this.fireCooldown -= delta;

    // Burst fire tick (rifle)
    if (this._burstRemaining > 0) {
      this._burstTimer -= delta;
      if (this._burstTimer <= 0) {
        this._burstTimer = WEAPONS.rifle.burstDelayMs;
        this._fireBurstShot();
        this._burstRemaining -= 1;
      }
    }

    // Pistol ammo reload
    if (this.ammoTimers.length > 0) {
      this.ammoTimers[0] -= delta;
      if (this.ammoTimers[0] <= 0) {
        this.ammoTimers.shift();
        this.ammo = Math.min(PLAYER.ammoMax, this.ammo + 1);
        this.scene.events.emit('player-ammo-changed');
      }
    }

    // HP regen
    const isHealing = this.alive && this.hp < this.hpMax && time - this.lastHurtAt > PLAYER.regenDelayMs;
    this.isRegenerating = isHealing;
    if (isHealing) {
      this.hp = Math.min(this.hpMax, this.hp + (PLAYER.regenPerSec * this.regenMult * delta) / 1000);
      this.scene.events.emit('player-hp-changed');
      
      // Spawn healing sparkles bubbling upward (cyan)
      if (Math.random() < 0.25) {
        this.scene.fx?.healingSparkle?.(this.x + Phaser.Math.Between(-16, 16), this.y + Phaser.Math.Between(-12, 12));
      }
    }

    // ── Weapon overlay: hovers next to the character, rotated to aim ─────
    // The aim angle drives weapon rotation. When not aiming, the weapon
    // follows the move-facing so the character looks "ready" in the direction
    // they're walking. The overlay sits a small radius out from the character
    // center so it visually reads as "held in front" of them.
    if (this.weaponSprite) {
      const baseAng = this.superAiming ? this.superAim
                    : this.aiming      ? this.aim
                    : this.facing;
      // Mid-combo the pistol is swapped for the energy blade — a melee ability
      // with no visible weapon has nothing to animate, which is why the first
      // pass read as a stray arc rather than a swing.
      const inCombo = this._meleeAnimT > 0;
      const wantTex = inCombo ? 'wpn-blade'
                    : this.secondary === 'rifle' ? 'wpn-rifle'
                    : 'wpn-pistol';
      if (this.weaponSprite.texture.key !== wantTex) this.weaponSprite.setTexture(wantTex);
      // Recoil kick — when firing, the weapon visually slides BACKWARDS
      // from the player for ~80ms then springs back. Pure visual, doesn't
      // affect bullet spawn positions.
      if (this._wKickT > 0) this._wKickT -= delta;
      // Normalized by this shot's own kick duration (was hardcoded to the
      // pistol's 80ms, which made the super's 180ms kick overshoot by accident).
      const kickBack = this._wKickT > 0
        ? Phaser.Math.Clamp(this._wKickT / (this._wKickDur || 80), 0, 1) * this._wKickMag
        : 0;

      // The overlay's transform is driven by the aim angle alone and is
      // completely independent of this.angle, so it does NOT follow the body.
      // During the finisher's 360 that would leave a sword hovering upright
      // beside a cartwheeling player — so the swing offset is applied here by
      // hand, and for the flip it is exactly the body's rotation.
      let ang = baseAng, offset = PLAYER.radius - 4 - kickBack;
      if (inCombo) {
        ang = baseAng + this._meleeBladeOffset();
        // Pivot at the GRIP, not the texture centre. With the default centre
        // origin a 96px sword is centred ~30px out, burying the hilt behind the
        // player and reading as a glowing stick floating nearby rather than a
        // held weapon. Guns keep the centre origin — it suits a hip-carry.
        if (this.weaponSprite.originX !== 0.14) this.weaponSprite.setOrigin(0.14, 0.5);
        offset = PLAYER.radius - 8;
      } else if (this.weaponSprite.originX !== 0.5) {
        this.weaponSprite.setOrigin(0.5, 0.5);
      }
      this.weaponSprite.x = this.x + Math.cos(ang) * offset;
      this.weaponSprite.y = this.y + Math.sin(ang) * offset;
      this.weaponSprite.rotation = ang;
      // Keyed off the AIM angle, not the swung one: using `ang` here would pop
      // the blade upside-down mid-sweep every time it crossed +/-90 degrees.
      this.weaponSprite.setFlipY(Math.abs(baseAng) > Math.PI / 2);
      this.weaponSprite.setAlpha(this.alive ? (this.hiddenInBush ? PLAYER.bushAlpha : 1) : 0);
    }

    // ── Y-sort: depth tracks world Y so entities occlude each other based
    // on their position rather than a fixed integer per type. Related
    // sprites (shadow, weapon, rings) ride small offsets around the body.
    this.setDepth(this.y);
    
    // Depth sort weapon based on facing direction (behind if facing North/back)
    const deg = Phaser.Math.RadToDeg(this.superAiming ? this.superAim : this.aiming ? this.aim : this.facing);
    const isFacingNorth = (deg < -45 && deg > -135);
    if (this.weaponSprite) {
      this.weaponSprite.setDepth(isFacingNorth ? this.y - 1 : this.y + 1);
    }
    this.glowRing.setDepth(this.y - 2);
    this.superAura.setDepth(this.y - 3);

    // Shadow + you-are-here glow ring (pulses softly).
    // Reactive shadow: drifts in the velocity direction (sells motion) and
    // squashes briefly during hurt-stagger or weapon kick (sells weight).
    const sVx     = this.body.velocity.x;
    const sVy     = this.body.velocity.y;
    const sDriftX = Phaser.Math.Clamp(sVx * 0.012, -3, 3);
    const sDriftY = Phaser.Math.Clamp(sVy * 0.008, -2, 2);
    const kickLift = this._wKickT > 0 ? -1 : 0;
    const staggerSquash = this._hurtStaggerMs > 0 ? 0.85 : 1;
    // Airborne read for the finisher: while the body rises and spins, the
    // shadow shrinks and drops away beneath it. Without this the flip looks
    // like the player is scaling up on the floor rather than leaving it.
    const airT = (this._meleeAnimT > 0 && this._meleeAnimStage >= 3)
      ? Math.sin(this._meleeProgress() * Math.PI) : 0;
    const airShrink = 1 - airT * 0.45;
    this.shadow.setPosition(this.x + sDriftX, this.y + 18 + sDriftY + kickLift + airT * 8);
    this.shadow.setScale(staggerSquash * airShrink, staggerSquash * airShrink);
    this.shadow.setDepth(this.y - 1);
    this._glowPulse += delta * 0.005;
    const pulse = 0.85 + 0.15 * Math.sin(this._glowPulse);
    this.glowRing.setPosition(this.x, this.y).setScale(pulse);
    this.glowRing.setAlpha(this.hiddenInBush ? 0.25 : 1);

    // Update shield indicator ring
    if (this.shieldHp > 0) {
      this.shieldRing.setVisible(true);
      this.shieldRing.clear();
      this.shieldRing.setPosition(this.x, this.y);
      this.shieldRing.setDepth(this.y + 3);
      const shieldPulse = 1.0 + 0.08 * Math.sin(time * 0.008);
      this.shieldRing.fillStyle(0x00d0ff, 0.12);
      this.shieldRing.fillCircle(0, 0, PLAYER.radius + 16);
      this.shieldRing.lineStyle(3, 0x00ffff, 0.85);
      this.shieldRing.strokeCircle(0, 0, (PLAYER.radius + 16) * shieldPulse);
    } else {
      this.shieldRing.setVisible(false);
    }

    // Super aura — now draws whenever the meter has ANY charge, brightening
    // as it fills (t = 0..1) so the player feels the super building toward
    // ready. At full charge it pulses; below full it's a steady dim-to-bright
    // glow scaled by t.
    const t = Math.min(1, this.superCharge / PLAYER.superHitsToCharge);
    if (t > 0) {
      const aGfx = this.superAura;
      aGfx.clear();
      let fillA, lineA, innerA, ringR;
      if (t >= 1) {
        // Full: the original pulsing ready-aura.
        this._auraPulse += delta * 0.012;
        const ap = 0.55 + 0.45 * Math.sin(this._auraPulse);
        fillA  = 0.10 + 0.10 * ap;
        lineA  = 0.7 + 0.3 * ap;
        innerA = 0.5 + 0.4 * ap;
        ringR  = PLAYER.radius + 18;
      } else {
        // Charging: steady glow that grows in intensity + radius with t.
        fillA  = 0.05 + 0.08 * t;
        lineA  = 0.25 + 0.45 * t;
        innerA = 0.15 + 0.35 * t;
        ringR  = PLAYER.radius + 10 + 8 * t;
      }
      aGfx.fillStyle(0xff4020, fillA);
      aGfx.fillCircle(0, 0, PLAYER.radius + 24);
      aGfx.lineStyle(3, 0xff6040, lineA);
      aGfx.strokeCircle(0, 0, ringR);
      aGfx.lineStyle(1.5, 0xffe080, innerA);
      aGfx.strokeCircle(0, 0, PLAYER.radius + 12);
      aGfx.setPosition(this.x, this.y).setVisible(true);
      aGfx.setAlpha(this.hiddenInBush ? 0.3 : 1);
    } else if (this.superAura.visible) {
      this.superAura.setVisible(false);
    }

    // Bush alpha
    this.setAlpha(this.hiddenInBush ? PLAYER.bushAlpha : 1);

    // ── Sprite animation ─────────────────────────────────────────────────
    // Use a smoothed move envelope (0..1) so the walk↔idle transition isn't
    // a binary snap. We still swap the anim key when the envelope crosses
    // the threshold, but the Y-scale stretch is continuous so the body
    // visually settles into / out of the gait.
    const speedSq  = this.body.velocity.x ** 2 + this.body.velocity.y ** 2;
    const moveT    = Math.min(1, speedSq / (PLAYER.speed * PLAYER.speed * 0.25));
    // Exponential smoothing toward target — ~140ms blend window.
    const blendK   = 1 - Math.exp(-delta / 140);
    this._moveEnv += (moveT - this._moveEnv) * blendK;
    const isMoving = this._moveEnv > 0.35;

    // Determine 4-directional anim suffix and flipX
    let dirSuffix = 'front';
    let flipX = false;

    let angAnim = this.facing;
    if (this.superAiming) {
      angAnim = this.superAim;
    } else if (this.aiming) {
      angAnim = this.aim;
    } else if (this._facingLockMs <= 0 && isMoving && this.body && (Math.abs(this.body.velocity.x) > 10 || Math.abs(this.body.velocity.y) > 10)) {
      // Second place facing gets derived from movement — same conflict as
      // setMoveInput (see there): gated on the fire-snap lock too, or a shot
      // fired while walking gets its facing overwritten back to the walk
      // direction on this very same frame's animation pass.
      angAnim = Math.atan2(this.body.velocity.y, this.body.velocity.x);
      this.facing = angAnim; // update facing to walk direction
    }

    const degAnim = Phaser.Math.RadToDeg(angAnim);
    if (degAnim >= -45 && degAnim <= 45) {
      dirSuffix = 'side';
      flipX = false; // facing East
    } else if (degAnim > 45 && degAnim < 135) {
      dirSuffix = 'front';
      flipX = false; // facing South
    } else if (degAnim >= 135 || degAnim <= -135) {
      dirSuffix = 'side';
      flipX = true;  // facing West
    } else {
      dirSuffix = 'back';
      flipX = false; // facing North
    }

    this.setFlipX(flipX);

    const baseKey = 'mando';
    let animKey = `${baseKey}-idle-${dirSuffix}`;
    if (this._fireAnimTimer > 0) {
      this._fireAnimTimer -= delta;
      animKey = `${baseKey}-fire-${dirSuffix}`;
    } else if (isMoving) {
      animKey = `${baseKey}-walk-${dirSuffix}`;
    }

    if (this.anims.currentAnim?.key !== animKey) {
      this.play(animKey);
    }

    // ── Recoil punch + idle breathing + move-envelope stretch ──────────
    // Recoil wins when active. Otherwise the body Y-scale eases between
    // idle (with subtle breathing) and walk (slight forward lean from the
    // move envelope), so transitions read as weight shifts not snaps.
    // Decay reveal timer
    if (this.revealTimer > 0) this.revealTimer -= delta;

    // ── Recoil punch + waddle / lean / bob walking animations ──────────
    if (this.isDashing) {
      this.angle = Math.sin(time * 0.05) * 15; // fast dodge roll spin
      this.setScale(1.0);
    } else if (this._meleeAnimT > 0) {
      // Melee combo pose. This branch is the whole reason the melee can animate
      // at all: without it the chain falls through to the `alive` branch below,
      // which zeroes angle and scale EVERY frame and erases any pose set
      // elsewhere. Sits above recoil so a leftover shot can't fight the swing.
      const mp   = this._meleeProgress();
      const bump = Math.sin(mp * Math.PI);        // 0 -> 1 -> 0
      if (this._meleeAnimStage >= 3) {
        // Cast 3: the horizontal flip. A full 360 with an airborne rise/fall,
        // deliberately breaking this project's "body never rotates" rule.
        this.angle = Phaser.Math.RadToDeg(this._meleeFlipRad(mp));
        this.setScale(1 + bump * 0.26);
      } else {
        // Casts 1-2: lean hard into the swing, mirrored between the two so the
        // pair reads as a combo rather than the same move played twice.
        const side = this._meleeAnimStage === 2 ? -1 : 1;
        this.angle = bump * 26 * side;
        this.setScale(1 + bump * 0.10, 1 - bump * 0.06);
      }
    } else if (this.recoilT > 0) {
      this.recoilT -= delta;
      // Ratio is normalized by the shot's OWN duration and clamped, so a long
      // recoil (the super) can't overshoot the way it used to. Sign of
      // recoilMag decides squash-in vs pop-out.
      const rt = Phaser.Math.Clamp(this.recoilT / (this.recoilDur || 110), 0, 1);
      this.setScale(1 + rt * this.recoilMag);
      this.angle = 0;
    } else if (this.alive && this._hurtStaggerMs <= 0) {
      if (isMoving) {
        this.angle = 0;
        this.setScale(1.0);
      } else {
        // Idle breathing Y-scale only (very subtle)
        this.angle = 0;
        const breath = Math.sin(time * 0.003) * 0.015;
        this.setScale(1.0, 1.0 + breath);
      }
    } else {
      this.angle = 0;
      this.setScale(1.0);
    }

  }

  destroy(fromScene) {
    this.shadow?.destroy();
    this.glowRing?.destroy();
    this.superAura?.destroy();
    this.shieldRing?.destroy();
    this.weaponSprite?.destroy();
    super.destroy(fromScene);
  }
}
