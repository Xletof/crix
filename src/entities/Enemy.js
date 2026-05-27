import Phaser from 'phaser';
import { ENEMY } from '../config.js';
import { SFX } from '../systems/FX.js';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture, cfg) {
    super(scene, x, y, texture, 0);
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

    // Animation state
    this._animPrefix = texture;  // 'grunt' or 'shooter'
    this._fireAnimTimer = 0;

    // Recoil scale (kept as FX on top of sprite anim)
    this.recoilT = 0;

    this.shadow = scene.add.image(x, y + 14, 'shadow').setDepth(this.depth - 1).setAlpha(0.35);
    this.hpBar = scene.add.graphics().setDepth(this.depth + 1);
    this.hpBar.visible = false;

    // Start idle animation
    if (scene.anims.exists(`${texture}-idle`)) {
      this.play(`${texture}-idle`);
    }
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
    this.recoilT = 80;
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
    if (ratio >= 0.999) { this.hpBar.visible = false; return; }
    this.hpBar.visible = true;
    this.hpBar.clear();
    const w = 48, h = 6;
    const x = this.x - w / 2, y = this.y - this.cfg.radius - 14;
    this.hpBar.fillStyle(0x000000, 0.7);
    this.hpBar.fillRect(x - 1, y - 1, w + 2, h + 2);
    this.hpBar.fillStyle(0x1a2028, 1);
    this.hpBar.fillRect(x, y, w, h);
    // HP color: green for stormtrooper, blue for death trooper
    const col = this._animPrefix === 'shooter' ? 0x00bbff : (ratio > 0.4 ? 0x20ee20 : 0xee2020);
    this.hpBar.fillStyle(col, 1);
    this.hpBar.fillRect(x, y, w * ratio, h);
  }

  canSee(player) {
    return !player.hiddenInBush;
  }

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta);
    this.shadow.setPosition(this.x, this.y + 18);
    this.updateHpBar();
    this.setAlpha(this.hiddenInBush ? 0.55 : 1);

    // Animation selection
    const speedSq = this.body.velocity.x ** 2 + this.body.velocity.y ** 2;
    const isMoving = speedSq > 200;
    const prefix = this._animPrefix;

    if (this._fireAnimTimer > 0) {
      this._fireAnimTimer -= delta;
      if (this.anims.currentAnim?.key !== `${prefix}-fire`) {
        this.play(`${prefix}-fire`);
      }
    } else if (isMoving) {
      if (this.anims.currentAnim?.key !== `${prefix}-walk`) {
        this.play(`${prefix}-walk`);
      }
    } else {
      if (this.anims.currentAnim?.key !== `${prefix}-idle`) {
        this.play(`${prefix}-idle`);
      }
    }

    // Recoil scale
    if (this.recoilT > 0) {
      this.recoilT -= delta;
      const t = Math.max(0, this.recoilT / 80);
      this.setScale(1 - t * 0.12);
    } else {
      this.setScale(1);
    }
  }
}

// ── Stormtrooper Grunt ────────────────────────────────────────────────────
export class EnemyGrunt extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'grunt', ENEMY.grunt);
    this.lastMeleeAt = 0;
    this.lastKnownX = x;
    this.lastKnownY = y;
    this.hasSeenPlayer = false;
    this.wanderTimer = 0;
    this.wanderVx = 0;
    this.wanderVy = 0;
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.alive) return;
    const player = this.scene.player;
    if (!player || !player.alive) { this.setVelocity(0, 0); return; }

    const seesPlayer = this.canSee(player);
    if (seesPlayer) {
      this.lastKnownX = player.x;
      this.lastKnownY = player.y;
      this.hasSeenPlayer = true;
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
          this._fireAnimTimer = 200;
          player.damage(this.cfg.meleeDamage);
          this.scene.events.emit('grunt-melee', this);
        }
      }
      return;
    }
    const ldx = this.lastKnownX - this.x;
    const ldy = this.lastKnownY - this.y;
    const ld = Math.hypot(ldx, ldy);
    if (this.hasSeenPlayer && ld > 36) {
      const ang = Math.atan2(ldy, ldx);
      this.setRotation(ang + Math.PI / 2);
      this.setVelocity(Math.cos(ang) * this.cfg.speed * 0.7, Math.sin(ang) * this.cfg.speed * 0.7);
    } else {
      this.wanderTimer -= delta;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = Phaser.Math.Between(700, 1500);
        const a = Math.random() * Math.PI * 2;
        const spd = this.cfg.speed * 0.35;
        this.wanderVx = Math.cos(a) * spd;
        this.wanderVy = Math.sin(a) * spd;
        this.setRotation(a + Math.PI / 2);
      }
      this.setVelocity(this.wanderVx, this.wanderVy);
    }
  }
}

// ── Death Trooper Shooter ─────────────────────────────────────────────────
export class EnemyShooter extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'shooter', ENEMY.shooter);
    this.fireCd = Phaser.Math.Between(600, this.cfg.fireCooldownMs);
    this.lastKnownX = x;
    this.lastKnownY = y;
    this.hasSeenPlayer = false;
    this.wanderTimer = 0;
    this.wanderVx = 0;
    this.wanderVy = 0;
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.alive) return;
    const player = this.scene.player;
    if (!player || !player.alive) { this.setVelocity(0, 0); return; }

    const seesPlayer = this.canSee(player);
    if (seesPlayer) {
      this.lastKnownX = player.x;
      this.lastKnownY = player.y;
      this.hasSeenPlayer = true;
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
        this.setVelocity(
          Math.cos(ang + Math.PI / 2) * this.cfg.speed * 0.6,
          Math.sin(ang + Math.PI / 2) * this.cfg.speed * 0.6
        );
      }
      this.fireCd -= delta;
      if (this.fireCd <= 0) {
        this.fireCd = this.cfg.fireCooldownMs;
        this.recoilT = 100;
        this._fireAnimTimer = 180;
        this.scene.events.emit('shooter-fire', this, ang);
      }
      return;
    }
    const ldx = this.lastKnownX - this.x;
    const ldy = this.lastKnownY - this.y;
    const ld = Math.hypot(ldx, ldy);
    if (this.hasSeenPlayer && ld > 60) {
      const ang = Math.atan2(ldy, ldx);
      this.setRotation(ang + Math.PI / 2);
      this.setVelocity(Math.cos(ang) * this.cfg.speed * 0.6, Math.sin(ang) * this.cfg.speed * 0.6);
    } else {
      this.wanderTimer -= delta;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = Phaser.Math.Between(900, 1700);
        const a = Math.random() * Math.PI * 2;
        const spd = this.cfg.speed * 0.3;
        this.wanderVx = Math.cos(a) * spd;
        this.wanderVy = Math.sin(a) * spd;
        this.setRotation(a + Math.PI / 2);
      }
      this.setVelocity(this.wanderVx, this.wanderVy);
    }
  }
}
