import Phaser from 'phaser';
import { ALLY } from '../config.js';
import { SFX } from '../systems/FX.js';

export class Ally extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture, cfg) {
    super(scene, x, y, texture);
    this.cfg = cfg;
    this.hp = cfg.hp;
    this.hpMax = cfg.hp;
    this.alive = true;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setCircle(cfg.radius);
    this.body.setCollideWorldBounds(true);

    this.hpBar = scene.add.graphics().setDepth(this.depth + 2);
    this.hpBar.visible = false;
    this.recoilT = 0;
  }

  damage(amount) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.recoilT = 80;
    this.flashRed();
    this.updateHpBar();
    if (this.hp <= 0) {
      this.die();
    }
  }

  flashRed() {
    this.setTint(0xff3333);
    this.scene.time.delayedCall(100, () => {
      if (this.active && this.alive) {
        this.clearTint();
        // Restore blue/cyan tint if mobile soldier or turret
        if (this._animPrefix) {
          this.setTint(0x00c0ff);
        } else {
          this.setTint(0x00a0ff);
        }
      }
    });
  }

  updateHpBar() {
    if (!this.alive) return;
    const ratio = this.hp / this.hpMax;
    if (ratio >= 0.999) { this.hpBar.visible = false; return; }
    this.hpBar.visible = true;
    this.hpBar.clear();
    const w = 48, h = 6;
    const bx = this.x - w / 2, by = this.y - this.cfg.radius - 14;
    this.hpBar.fillStyle(0x000000, 0.7);
    this.hpBar.fillRect(bx - 1, by - 1, w + 2, h + 2);
    this.hpBar.fillStyle(0x1a2028, 1);
    this.hpBar.fillRect(bx, by, w, h);
    // Friendly HP bar is bright cyan!
    this.hpBar.fillStyle(0x00d0ff, 1);
    this.hpBar.fillRect(bx, by, w * ratio, h);
  }

  die() {
    this.alive = false;
    this.hpBar.destroy();
    this.weaponSprite?.destroy();
    SFX.enemyDie();
    this.destroy();
  }

  findNearestEnemy() {
    const enemies = this.scene.enemies.getChildren().filter(e => e.active && e.alive);
    if (this.scene.boss?.active && this.scene.boss?.alive) {
      enemies.push(this.scene.boss);
    }
    let nearest = null;
    let minDist = Infinity;
    for (const e of enemies) {
      const dist = Math.hypot(e.x - this.x, e.y - this.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = e;
      }
    }
    return nearest;
  }
}

export class AllyTurret extends Ally {
  constructor(scene, x, y) {
    // Slices console/bush texture for base
    super(scene, x, y, 'bush', ALLY.turret);
    this.setScale(0.85);
    this.setTint(0x00a0ff); // nice cyan tint for base
    
    // Orbiting weapon overlay (using Mandalorian rifle or standard rifle, tinted cyan)
    this.weaponSprite = scene.add.image(x, y, 'wpn-rifle')
      .setDepth(this.depth + 1).setOrigin(0.15, 0.5).setScale(1.1).setTint(0x00d0ff);
    
    this.fireCd = 0;
    this._aim = 0;
  }

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta);
    if (!this.alive) return;

    this.hpBar.setDepth(this.y + 2);

    const target = this.findNearestEnemy();
    if (target) {
      this._aim = Math.atan2(target.y - this.y, target.x - this.x);
      
      // Update weapon overlay
      const offset = 8;
      this.weaponSprite.x = this.x + Math.cos(this._aim) * offset;
      this.weaponSprite.y = this.y + Math.sin(this._aim) * offset;
      this.weaponSprite.rotation = this._aim;
      this.weaponSprite.setFlipY(Math.abs(this._aim) > Math.PI / 2);

      this.fireCd -= delta;
      if (this.fireCd <= 0) {
        this.fireCd = ALLY.turret.fireCooldownMs;
        
        // Flash muzzle color on weapon
        this.weaponSprite.setTint(0xffffff);
        this.scene.time.delayedCall(60, () => {
          if (this.weaponSprite?.active) this.weaponSprite.setTint(0x00d0ff);
        });

        // Fire red laser owned by ally
        const bx = this.x + Math.cos(this._aim) * (this.cfg.radius + 6);
        const by = this.y + Math.sin(this._aim) * (this.cfg.radius + 6);
        this.scene.playerBullets.fire(bx, by, this._aim,
          this.cfg.bulletSpeed, this.cfg.damage, this.cfg.range,
          { owner: 'ally' });
        
        SFX.shoot();
      }
    }
  }
}

export class AllySoldier extends Ally {
  constructor(scene, x, y) {
    super(scene, x, y, 'grunt', ALLY.soldier);
    this.setTint(0x00c0ff); // friendly holographic trooper look!
    this._animPrefix = 'grunt';
    
    this.weaponSprite = scene.add.image(x, y, 'wpn-rifle')
      .setDepth(this.depth + 1).setOrigin(0.15, 0.5).setScale(1.0).setTint(0x00c0ff);

    this.fireCd = 0;
    this._aim = 0;
    
    // Pathfinding / behavior logic
    this._currentPath = null;
    this._pathNodeIdx = 0;
    this._pathTimer = 0;
    this._pathLastTarget = { x: 0, y: 0 };
  }

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta);
    if (!this.alive) return;

    this.hpBar.setDepth(this.y + 2);

    const player = this.scene.player;
    const target = this.findNearestEnemy();
    
    let isMoving = false;
    let speed = this.cfg.speed;

    // 1. Follow Player logic if player is far away
    const distToPlayer = player ? Math.hypot(player.x - this.x, player.y - this.y) : 0;
    if (distToPlayer > 180 && player) {
      const dist = this._navigatePath(player.x, player.y, speed, delta);
      isMoving = dist > 5;
      if (isMoving) {
        this._aim = Math.atan2(this.body.velocity.y, this.body.velocity.x);
      }
    } else {
      // Stand still and face the enemy, or face forward
      this.setVelocity(0, 0);
      if (target) {
        this._aim = Math.atan2(target.y - this.y, target.x - this.x);
      }
    }

    // 2. Aim and Fire logic
    if (target && Math.hypot(target.x - this.x, target.y - this.y) < this.cfg.bulletRange) {
      this._aim = Math.atan2(target.y - this.y, target.x - this.x);
      
      this.fireCd -= delta;
      if (this.fireCd <= 0) {
        this.fireCd = ALLY.soldier.fireCooldownMs;
        
        // Fire bullet
        const bx = this.x + Math.cos(this._aim) * (this.cfg.radius + 6);
        const by = this.y + Math.sin(this._aim) * (this.cfg.radius + 6);
        this.scene.playerBullets.fire(bx, by, this._aim,
          this.cfg.bulletSpeed, this.cfg.bulletDamage, this.cfg.bulletRange,
          { owner: 'ally' });
        
        SFX.shoot();
      }
    }

    // 3. Update weapon overlay
    const offset = 8;
    this.weaponSprite.x = this.x + Math.cos(this._aim) * offset;
    this.weaponSprite.y = this.y + Math.sin(this._aim) * offset;
    this.weaponSprite.rotation = this._aim;
    this.weaponSprite.setFlipY(Math.abs(this._aim) > Math.PI / 2);
    this.weaponSprite.setDepth(Math.sin(this._aim) < 0 ? this.y - 1 : this.y + 1);

    // 4. Handle animation frame selection
    let dirSuffix = 'front';
    let flipX = false;
    const deg = Phaser.Math.RadToDeg(this._aim);
    if (deg >= -45 && deg <= 45) {
      dirSuffix = 'side';
      flipX = false;
    } else if (deg > 45 && deg < 135) {
      dirSuffix = 'front';
      flipX = false;
    } else if (deg >= 135 || deg <= -135) {
      dirSuffix = 'side';
      flipX = true;
    } else {
      dirSuffix = 'back';
      flipX = false;
    }

    this.setFlipX(flipX);

    let animKey = `${this._animPrefix}-idle-${dirSuffix}`;
    if (isMoving) {
      animKey = `${this._animPrefix}-walk-${dirSuffix}`;
    }

    if (this.anims.currentAnim?.key !== animKey && this.anims.exists(animKey)) {
      this.play(animKey);
    }
  }

  _navigatePath(tx, ty, speed, delta) {
    this._pathTimer = (this._pathTimer || 0) + delta;
    const lastTarget = this._pathLastTarget || { x: 0, y: 0 };
    const targetMoved = Math.hypot(tx - lastTarget.x, ty - lastTarget.y) > 40;

    if (!this._currentPath || this._currentPath.length === 0 || targetMoved) {
      this._currentPath = this.scene.navGrid?.findPath(this.x, this.y, tx, ty);
      this._pathNodeIdx = 0;
      this._pathTimer = 0;
      this._pathLastTarget = { x: tx, y: ty };
    }

    if (this._currentPath && this._currentPath.length > 0) {
      let node = this._currentPath[this._pathNodeIdx];
      while (node && Math.hypot(node.x - this.x, node.y - this.y) < 35) {
        this._pathNodeIdx++;
        node = this._currentPath[this._pathNodeIdx];
      }
      if (node) {
        return this._moveToward(node.x, node.y, speed);
      }
    }
    return this._moveToward(tx, ty, speed);
  }

  _moveToward(tx, ty, speed) {
    const dx = tx - this.x, dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) { this.setVelocity(0, 0); return dist; }
    this.setVelocity((dx / dist) * speed, (dy / dist) * speed);
    return dist;
  }
}
