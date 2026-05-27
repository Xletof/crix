import Phaser from 'phaser';
import { PLAYER, COLORS } from '../config.js';
import { SFX } from '../systems/FX.js';

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(30);
    this.body.setCircle(PLAYER.radius, this.width / 2 - PLAYER.radius, this.height / 2 - PLAYER.radius);
    this.body.setCollideWorldBounds(true);

    this.hp = PLAYER.hp;
    this.hpMax = PLAYER.hp;
    this.ammo = PLAYER.ammoMax;
    this.ammoTimers = []; // ms remaining for each reloading slot
    this.fireCooldown = 0;
    this.lastHurtAt = -99999;
    this.superCharge = 0; // 0..superHitsToCharge
    this.facing = -Math.PI / 2; // up
    this.aim = -Math.PI / 2;
    this.aiming = false;
    this.superAim = -Math.PI / 2;
    this.superAiming = false;
    this.alive = true;
    this.hiddenInBush = false;

    this.shadow = scene.add.image(x, y + 12, 'shadow').setDepth(this.depth - 1).setAlpha(0.35);
  }

  setMoveInput(vec) {
    if (!this.alive) {
      this.setVelocity(0, 0);
      return;
    }
    if (vec && vec.force > 0) {
      this.setVelocity(vec.x * PLAYER.speed * vec.force, vec.y * PLAYER.speed * vec.force);
      this.facing = Math.atan2(vec.y, vec.x);
      if (!this.aiming) {
        // Rotate so the gun (drawn pointing up) faces movement direction.
        this.setRotation(this.facing + Math.PI / 2);
      }
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
      // Quick tap with no real drag → shoot forward.
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
      this.superAiming = true; // still considered aiming (cone visible) even with no drag
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
    this.scene.events.emit('player-fire', dir);
    SFX.shoot();
    return true;
  }

  tryFireSuper(angleOverride) {
    if (!this.alive) return false;
    if (this.superCharge < PLAYER.superHitsToCharge) return false;
    this.superCharge = 0;
    const dir =
      typeof angleOverride === 'number'
        ? angleOverride
        : this.aiming
        ? this.aim
        : this.facing;
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
    this.scene.events.emit('player-dead');
  }

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta);
    if (this.fireCooldown > 0) this.fireCooldown -= delta;
    // Reload one slot at a time (left-to-right)
    if (this.ammoTimers.length > 0) {
      this.ammoTimers[0] -= delta;
      if (this.ammoTimers[0] <= 0) {
        this.ammoTimers.shift();
        this.ammo = Math.min(PLAYER.ammoMax, this.ammo + 1);
        this.scene.events.emit('player-ammo-changed');
      }
    }
    // HP regen after grace period
    if (this.alive && this.hp < this.hpMax && time - this.lastHurtAt > PLAYER.regenDelayMs) {
      const inc = (PLAYER.regenPerSec * delta) / 1000;
      this.hp = Math.min(this.hpMax, this.hp + inc);
      this.scene.events.emit('player-hp-changed');
    }
    // Shadow follow
    this.shadow.setPosition(this.x, this.y + 18);
    // Bush alpha
    this.setAlpha(this.hiddenInBush ? PLAYER.bushAlpha : 1);
  }

  destroy(fromScene) {
    this.shadow?.destroy();
    super.destroy(fromScene);
  }
}
