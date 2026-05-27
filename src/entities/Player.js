import Phaser from 'phaser';
import { PLAYER, COLORS } from '../config.js';
import { SFX } from '../systems/FX.js';

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(30);
    this.body.setCircle(PLAYER.radius, this.width / 2 - PLAYER.radius, this.height / 2 - PLAYER.radius);
    this.body.setCollideWorldBounds(true);

    this.hp = PLAYER.hp;
    this.hpMax = PLAYER.hp;
    this.ammo = PLAYER.ammoMax;
    this.ammoTimers = [];
    this.fireCooldown = 0;
    this.lastHurtAt = -99999;
    this.superCharge = 0;
    this.facing = -Math.PI / 2;
    this.aim = -Math.PI / 2;
    this.aiming = false;
    this.superAim = -Math.PI / 2;
    this.superAiming = false;
    this.alive = true;
    this.hiddenInBush = false;

    // Animation state tracking
    this._animState = 'idle';
    this._fireAnimTimer = 0;
    // Recoil scale punch (on top of sprite anim)
    this.recoilT = 0;

    this.shadow = scene.add.image(x, y + 12, 'shadow').setDepth(this.depth - 1).setAlpha(0.35);

    // Jetpack flame particle emitter
    this.jetEmitter = scene.add.particles(x, y, 'jet-flame', {
      lifespan: 180,
      speed: { min: 40, max: 120 },
      angle: { min: 80, max: 100 },   // downward by default; rotated per-frame
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      quantity: 0,
      emitting: false,
    }).setDepth(this.depth - 1);

    // Start idle animation
    this.play('mando-idle');
  }

  setMoveInput(vec) {
    if (!this.alive) { this.setVelocity(0, 0); return; }
    if (vec && vec.force > 0) {
      this.setVelocity(vec.x * PLAYER.speed * vec.force, vec.y * PLAYER.speed * vec.force);
      this.facing = Math.atan2(vec.y, vec.x);
      if (!this.aiming) this.setRotation(this.facing + Math.PI / 2);
    } else {
      this.setVelocity(0, 0);
    }
  }

  setAimInput(vec) {
    if (!this.alive) return;
    if (vec && vec.force > 0) {
      this.aiming = true;
      this.aim = Math.atan2(vec.y, vec.x);
      this.setRotation(this.aim + Math.PI / 2);
    } else {
      this.aiming = false;
    }
  }

  releaseAim(vec) {
    if (!this.alive) return;
    if (vec && vec.force > 0) {
      this.aim = Math.atan2(vec.y, vec.x);
      this.tryFire();
    } else {
      this.tryFire();
    }
    this.aiming = false;
  }

  setSuperAimInput(vec) {
    if (!this.alive) return;
    if (vec && vec.force > 0) {
      this.superAiming = true;
      this.superAim = Math.atan2(vec.y, vec.x);
      this.setRotation(this.superAim + Math.PI / 2);
    } else {
      this.superAiming = true;
      this.superAim = this.facing;
    }
  }

  releaseSuperAim(vec) {
    if (!this.alive) return;
    const angle = vec && vec.force > 0 ? Math.atan2(vec.y, vec.x) : this.facing;
    this.superAiming = false;
    this.tryFireSuper(angle);
  }

  tryFire() {
    if (!this.alive) return false;
    if (this.fireCooldown > 0) return false;
    if (this.ammo <= 0) return false;
    this.fireCooldown = PLAYER.fireCooldownMs;
    this.ammo -= 1;
    this.ammoTimers.push(PLAYER.ammoReloadMs);
    const dir = this.aiming ? this.aim : this.facing;
    this.recoilT = 110;
    this._fireAnimTimer = 140;
    this.scene.events.emit('player-fire', dir);
    SFX.shoot();
    return true;
  }

  tryFireSuper(angleOverride) {
    if (!this.alive) return false;
    if (this.superCharge < PLAYER.superHitsToCharge) return false;
    this.superCharge = 0;
    const dir = typeof angleOverride === 'number' ? angleOverride
      : this.aiming ? this.aim : this.facing;
    this.recoilT = 260;
    this._fireAnimTimer = 240;
    this.scene.events.emit('player-fire-super', dir);
    SFX.shootSuper();
    return true;
  }

  damage(amount) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.lastHurtAt = this.scene.time.now;
    this.scene.events.emit('player-hurt', amount);
    SFX.hurt();
    if (this.hp <= 0) this.die();
  }

  addSuperHit() {
    const before = this.superCharge;
    this.superCharge = Math.min(PLAYER.superHitsToCharge, this.superCharge + 1);
    if (before < PLAYER.superHitsToCharge && this.superCharge >= PLAYER.superHitsToCharge) {
      SFX.superReady();
      this.scene.events.emit('player-super-ready');
    } else {
      this.scene.events.emit('player-super-changed');
    }
  }

  die() {
    this.alive = false;
    this.setVelocity(0, 0);
    this.jetEmitter.stop();
    this.scene.events.emit('player-dead');
  }

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta);

    if (this.fireCooldown > 0) this.fireCooldown -= delta;

    // Reload
    if (this.ammoTimers.length > 0) {
      this.ammoTimers[0] -= delta;
      if (this.ammoTimers[0] <= 0) {
        this.ammoTimers.shift();
        this.ammo = Math.min(PLAYER.ammoMax, this.ammo + 1);
        this.scene.events.emit('player-ammo-changed');
      }
    }

    // HP regen
    if (this.alive && this.hp < this.hpMax && time - this.lastHurtAt > PLAYER.regenDelayMs) {
      this.hp = Math.min(this.hpMax, this.hp + (PLAYER.regenPerSec * delta) / 1000);
      this.scene.events.emit('player-hp-changed');
    }

    // Shadow
    this.shadow.setPosition(this.x, this.y + 18);

    // Bush alpha
    this.setAlpha(this.hiddenInBush ? PLAYER.bushAlpha : 1);

    // ── Sprite animation (frame selection) ─────────────────────────
    const speedSq = this.body.velocity.x ** 2 + this.body.velocity.y ** 2;
    const isMoving = speedSq > 200;

    if (this._fireAnimTimer > 0) {
      this._fireAnimTimer -= delta;
      if (this.anims.currentAnim?.key !== 'mando-fire') {
        this.play('mando-fire');
      }
    } else if (isMoving) {
      if (this.anims.currentAnim?.key !== 'mando-walk') {
        this.play('mando-walk');
      }
    } else {
      if (this.anims.currentAnim?.key !== 'mando-idle') {
        this.play('mando-idle');
      }
    }

    // ── Recoil scale punch ──────────────────────────────────────────
    if (this.recoilT > 0) {
      this.recoilT -= delta;
      const t = Math.max(0, this.recoilT / 110);
      this.setScale(1 - t * 0.12);
    } else {
      this.setScale(1);
    }

    // ── Jetpack flame (trail when moving) ──────────────────────────
    if (this.alive && isMoving) {
      // Position emitter behind the player (opposite of facing)
      const backAngle = this.rotation - Math.PI / 2 + Math.PI; // behind player
      const jx = this.x + Math.cos(backAngle) * 10;
      const jy = this.y + Math.sin(backAngle) * 10;
      this.jetEmitter.setPosition(jx, jy);
      if (!this.jetEmitter.emitting) this.jetEmitter.start();
      this.jetEmitter.emitParticleAt(jx, jy, 2);
    } else {
      this.jetEmitter.stop();
    }
  }

  destroy(fromScene) {
    this.shadow?.destroy();
    this.jetEmitter?.destroy();
    super.destroy(fromScene);
  }
}
