import Phaser from 'phaser';
import { ENEMY } from '../config.js';
import { SFX } from '../systems/FX.js';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture, cfg) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.cfg = cfg;
    this.setDepth(28);
    this.body.setCircle(cfg.radius, this.width / 2 - cfg.radius, this.height / 2 - cfg.radius);
    this.body.setCollideWorldBounds(true);
    this.hp = cfg.hp;
    this.hpMax = cfg.hp;
    this.alive = true;
    this.hiddenInBush = false;
    this.shadow = scene.add.image(x, y + 14, 'shadow').setDepth(this.depth - 1).setAlpha(0.35);

    // HP bar (small, only shows when damaged)
    this.hpBar = scene.add.graphics().setDepth(this.depth + 1);
    this.hpBar.visible = false;
  }

  damage(amount, knockbackVec = null) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (knockbackVec) {
      this.body.setVelocity(
        this.body.velocity.x + knockbackVec.x,
        this.body.velocity.y + knockbackVec.y
      );
    }
    this.scene.events.emit('enemy-hit', this, amount);
    if (this.hp <= 0) this.die();
  }

  die() {
    this.alive = false;
    SFX.enemyDie();
    this.scene.events.emit('enemy-died', this);
    this.hpBar.destroy();
    this.shadow.destroy();
    this.destroy();
  }

  updateHpBar() {
    if (!this.alive) return;
    const ratio = this.hp / this.hpMax;
    if (ratio >= 0.999) {
      this.hpBar.visible = false;
      return;
    }
    this.hpBar.visible = true;
    this.hpBar.clear();
    const w = 48;
    const h = 6;
    const x = this.x - w / 2;
    const y = this.y - this.cfg.radius - 14;
    this.hpBar.fillStyle(0x000000, 0.6);
    this.hpBar.fillRect(x - 1, y - 1, w + 2, h + 2);
    this.hpBar.fillStyle(0x222933, 1);
    this.hpBar.fillRect(x, y, w, h);
    this.hpBar.fillStyle(ratio > 0.4 ? 0x4cd964 : 0xff3b30, 1);
    this.hpBar.fillRect(x, y, w * ratio, h);
  }

  // Distance check that respects bushes — enemies can't see through them.
  canSee(player) {
    return !player.hiddenInBush;
  }

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta);
    this.shadow.setPosition(this.x, this.y + 18);
    this.updateHpBar();
    this.setAlpha(this.hiddenInBush ? 0.55 : 1);
  }
}

export class EnemyGrunt extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'grunt', ENEMY.grunt);
    this.lastMeleeAt = 0;
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.alive) return;
    const player = this.scene.player;
    if (!player || !player.alive) {
      this.setVelocity(0, 0);
      return;
    }
    const seesPlayer = this.canSee(player);
    if (!seesPlayer) {
      // Wander vaguely toward last known position (player position approx)
      this.setVelocity(0, 0);
      return;
    }
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    this.setRotation(ang + Math.PI / 2);
    if (d > this.cfg.meleeRange) {
      this.setVelocity(Math.cos(ang) * this.cfg.speed, Math.sin(ang) * this.cfg.speed);
    } else {
      this.setVelocity(0, 0);
      if (time - this.lastMeleeAt > this.cfg.meleeCooldownMs) {
        this.lastMeleeAt = time;
        player.damage(this.cfg.meleeDamage);
        this.scene.events.emit('grunt-melee', this);
      }
    }
  }
}

export class EnemyShooter extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'shooter', ENEMY.shooter);
    this.fireCd = Phaser.Math.Between(600, this.cfg.fireCooldownMs);
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.alive) return;
    const player = this.scene.player;
    if (!player || !player.alive) {
      this.setVelocity(0, 0);
      return;
    }
    const seesPlayer = this.canSee(player);
    if (!seesPlayer) {
      this.setVelocity(0, 0);
      return;
    }
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    this.setRotation(ang + Math.PI / 2);
    const desired = this.cfg.desiredRange;
    if (d > desired + 40) {
      this.setVelocity(Math.cos(ang) * this.cfg.speed, Math.sin(ang) * this.cfg.speed);
    } else if (d < desired - 40) {
      this.setVelocity(-Math.cos(ang) * this.cfg.speed, -Math.sin(ang) * this.cfg.speed);
    } else {
      // strafe
      this.setVelocity(
        Math.cos(ang + Math.PI / 2) * this.cfg.speed * 0.6,
        Math.sin(ang + Math.PI / 2) * this.cfg.speed * 0.6
      );
    }
    this.fireCd -= delta;
    if (this.fireCd <= 0) {
      this.fireCd = this.cfg.fireCooldownMs;
      this.scene.events.emit('shooter-fire', this, ang);
    }
  }
}
