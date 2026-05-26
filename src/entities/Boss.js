import Phaser from 'phaser';
import { BOSS } from '../config.js';
import { SFX } from '../systems/FX.js';
import { Enemy } from './Enemy.js';

const STATE = {
  IDLE: 'idle',
  CHARGE_WINDUP: 'charge_windup',
  CHARGING: 'charging',
  FAN: 'fan',
  SPAWNING: 'spawning',
};

export class Boss extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'boss', { ...BOSS });
    this.setDepth(29);
    this.body.setCircle(BOSS.radius, this.width / 2 - BOSS.radius, this.height / 2 - BOSS.radius);
    // Override shadow to bigger
    this.shadow.destroy();
    this.shadow = scene.add.image(x, y + 30, 'shadow-boss').setDepth(this.depth - 1).setAlpha(0.4);
    this.state = STATE.IDLE;
    this.stateTimer = 0;
    this.cooldown = 1200;
    this.phase = 1;
    this.contactDmgCd = 0;
    SFX.bossRoar();
  }

  enterPhase(p) {
    if (p === this.phase) return;
    this.phase = p;
    this.cfg = { ...this.cfg, attackCooldownMs: Math.max(900, BOSS.attackCooldownMs - 400 * (p - 1)) };
    SFX.bossRoar();
    this.scene.events.emit('boss-phase', p);
  }

  pickAttack() {
    const r = Math.random();
    if (this.phase >= 2 && r < 0.33) return STATE.SPAWNING;
    if (r < 0.5) return STATE.CHARGE_WINDUP;
    return STATE.FAN;
  }

  preUpdate(time, delta) {
    // Skip the base Grunt/Shooter AI by going straight to Phaser.Sprite preUpdate via shadow/hp update
    Phaser.Physics.Arcade.Sprite.prototype.preUpdate?.call(this, time, delta);
    this.shadow.setPosition(this.x, this.y + 30);
    this.updateHpBar();
    this.setAlpha(this.hiddenInBush ? 0.55 : 1);
    if (!this.alive) return;

    // Phase transitions
    const ratio = this.hp / this.hpMax;
    if (this.phase < 3 && ratio <= BOSS.phase3) this.enterPhase(3);
    else if (this.phase < 2 && ratio <= BOSS.phase2) this.enterPhase(2);

    const player = this.scene.player;
    if (!player || !player.alive) {
      this.setVelocity(0, 0);
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const angToPlayer = Math.atan2(dy, dx);
    this.setRotation(angToPlayer + Math.PI / 2);

    if (this.contactDmgCd > 0) this.contactDmgCd -= delta;

    switch (this.state) {
      case STATE.IDLE: {
        // Slow advance
        const speed = this.cfg.speed * (this.phase === 3 ? 1.3 : 1);
        this.setVelocity(Math.cos(angToPlayer) * speed, Math.sin(angToPlayer) * speed);
        this.cooldown -= delta;
        if (this.cooldown <= 0) {
          this.state = this.pickAttack();
          this.stateTimer = 0;
          if (this.state === STATE.CHARGE_WINDUP) {
            this.setVelocity(0, 0);
            SFX.bossRoar();
            this.chargeAngle = angToPlayer;
          } else if (this.state === STATE.FAN) {
            this.setVelocity(0, 0);
            this.scene.events.emit('boss-fan', this, angToPlayer);
            this.state = STATE.IDLE;
            this.cooldown = this.cfg.attackCooldownMs;
          } else if (this.state === STATE.SPAWNING) {
            this.setVelocity(0, 0);
            this.scene.events.emit('boss-spawn', this);
            this.state = STATE.IDLE;
            this.cooldown = this.cfg.attackCooldownMs + 500;
          }
        }
        break;
      }
      case STATE.CHARGE_WINDUP: {
        this.setVelocity(0, 0);
        this.stateTimer += delta;
        // Telegraph: scale pulse
        const pulse = 1 + Math.sin(this.stateTimer / 60) * 0.06;
        this.setScale(pulse);
        if (this.stateTimer >= BOSS.chargeWindupMs) {
          this.setScale(1);
          this.state = STATE.CHARGING;
          this.stateTimer = 0;
          this.setVelocity(
            Math.cos(this.chargeAngle) * BOSS.chargeSpeed,
            Math.sin(this.chargeAngle) * BOSS.chargeSpeed
          );
          this.scene.events.emit('boss-charge', this);
        }
        break;
      }
      case STATE.CHARGING: {
        this.stateTimer += delta;
        if (this.stateTimer >= BOSS.chargeDurationMs) {
          this.state = STATE.IDLE;
          this.cooldown = this.cfg.attackCooldownMs;
        }
        break;
      }
    }

    // Contact damage
    if (this.contactDmgCd <= 0 && Math.hypot(dx, dy) < BOSS.radius + 24) {
      player.damage(BOSS.contactDamage);
      this.contactDmgCd = 600;
    }
  }

  damage(amount, knockbackVec = null) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    // Boss doesn't get knocked back
    this.scene.events.emit('boss-hit', this, amount);
    if (this.hp <= 0) this.die();
  }

  die() {
    this.alive = false;
    SFX.bossDie();
    this.scene.events.emit('boss-died', this);
    this.hpBar.destroy();
    this.shadow.destroy();
    this.destroy();
  }
}
