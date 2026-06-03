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

    // Override shadow to bigger one
    this.shadow.destroy();
    this.shadow = scene.add.image(x, y + 30, 'shadow-boss').setDepth(this.depth - 1).setAlpha(0.45);

    // Boss is already 40×40 — reset scale + recolor threat ring to danger-orange.
    this.setScale(1);
    // Saber overlay (replaces the generic enemy rifle the base class added)
    this.weaponSprite?.destroy();
    this.weaponSprite = scene.add.image(x, y, 'wpn-saber')
      .setDepth(this.depth + 1).setOrigin(0.1, 0.5).setScale(1.4);
    this.threatRing?.destroy();
    this.threatRing = scene.add.graphics().setDepth(this.depth - 2);
    this.threatRing.fillStyle(0xff8020, 0.18);
    this.threatRing.fillCircle(0, 0, BOSS.radius + 18);
    this.threatRing.lineStyle(3, 0xff5020, 0.75);
    this.threatRing.strokeCircle(0, 0, BOSS.radius + 10);
    this.threatRing.setPosition(x, y);

    this.state = STATE.IDLE;
    this.stateTimer = 0;
    this.cooldown = 1400;
    this.phase = 1;
    this.contactDmgCd = 0;

    // Per-volley damage cap: no more than 2200 dmg in any 120 ms window so a
    // point-blank super (7 pellets × 520 = 3640) can't one-shot the boss.
    this._dmgWindow    = 0;   // damage absorbed in current window
    this._dmgWindowMs  = 0;   // ms since window opened

    // Vader-specific: saber glow pulse
    this._glowT = 0;
    this._enraged = false;

    SFX.bossRoar();

    // Start Vader idle anim
    this.play('vader-idle');
  }

  // Override damage() to apply a per-volley cap so a point-blank super volley
  // (7 simultaneous pellets) can't one-shot the boss. Any individual hit that
  // would push total intake above 2200 in a 120 ms window is partially absorbed.
  damage(amount, knockbackVec = null) {
    const CAP = 2200, WIN = 120;
    if (this._dmgWindowMs <= 0) { this._dmgWindow = 0; }
    const headroom = Math.max(0, CAP - this._dmgWindow);
    const effective = Math.min(amount, headroom);
    if (effective <= 0) return; // fully absorbed
    this._dmgWindow   += effective;
    this._dmgWindowMs  = WIN;
    this.scene.events.emit('boss-hit', this, effective);
    super.damage(effective, knockbackVec);
  }

  enterPhase(p) {
    if (p === this.phase) return;
    this.phase = p;
    this.cfg = { ...this.cfg, attackCooldownMs: Math.max(900, BOSS.attackCooldownMs - 400 * (p - 1)) };
    if (p >= 2) this._enraged = true;
    SFX.bossRoar();
    this.scene.events.emit('boss-phase', p);
    this.scene.events.emit('boss-phase-crack', this.x, this.y, p);
  }

  pickAttack() {
    const r = Math.random();
    if (this.phase >= 2 && r < 0.33) return STATE.SPAWNING;
    if (r < 0.5) return STATE.CHARGE_WINDUP;
    return STATE.FAN;
  }

  preUpdate(time, delta) {
    // Skip base Enemy AI — Vader has its own state machine
    Phaser.Physics.Arcade.Sprite.prototype.preUpdate?.call(this, time, delta);
    this.shadow.setPosition(this.x, this.y + 30);
    this.updateHpBar();
    this.setAlpha(this.hiddenInBush ? 0.55 : 1);
    if (this.threatRing) {
      this._ringPulse += delta * 0.005;
      const pulse = 0.94 + 0.06 * Math.sin(this._ringPulse);
      this.threatRing.setPosition(this.x, this.y).setScale(pulse);
      this.threatRing.setAlpha(this.hiddenInBush ? 0.25 : 1);
    }
    if (!this.alive) return;

    // Per-volley damage window
    if (this._dmgWindowMs > 0) this._dmgWindowMs -= delta;

    // Saber glow pulse (subtle scale)
    this._glowT += delta;
    const glowSpd = this._enraged ? 0.008 : 0.004;
    const glowAmp = this._enraged ? 0.05 : 0.03;
    const glowScale = 1 + Math.sin(this._glowT * glowSpd) * glowAmp;

    // Phase transitions
    const ratio = this.hp / this.hpMax;
    if (this.phase < 3 && ratio <= BOSS.phase3) this.enterPhase(3);
    else if (this.phase < 2 && ratio <= BOSS.phase2) this.enterPhase(2);

    const player = this.scene.player;
    if (!player || !player.alive) { this.setVelocity(0, 0); return; }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const angToPlayer = Math.atan2(dy, dx);
    this._aim = angToPlayer;
    if (this.weaponSprite) {
      const offset = BOSS.radius - 6;
      this.weaponSprite.x = this.x + Math.cos(angToPlayer) * offset;
      this.weaponSprite.y = this.y + Math.sin(angToPlayer) * offset;
      this.weaponSprite.rotation = angToPlayer;
      this.weaponSprite.setAlpha(this.alive ? (this.hiddenInBush ? 0.55 : 1) : 0);
    }

    if (this.contactDmgCd > 0) this.contactDmgCd -= delta;

    switch (this.state) {
      case STATE.IDLE: {
        const speed = this.cfg.speed * (this.phase === 3 ? 1.35 : 1);
        this.setVelocity(Math.cos(angToPlayer) * speed, Math.sin(angToPlayer) * speed);

        // Vader animation during advance
        const spd2 = speed * speed;
        if (this.body.velocity.x ** 2 + this.body.velocity.y ** 2 > 200) {
          if (this.anims.currentAnim?.key !== 'vader-walk') this.play('vader-walk');
        } else {
          if (this.anims.currentAnim?.key !== 'vader-idle') this.play('vader-idle');
        }
        this.setScale(glowScale);

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
        // Vader windup: enraged frame + scale pulse
        if (this.anims.currentAnim?.key !== 'vader-attack') this.play('vader-attack');
        const pulse = 1 + Math.sin(this.stateTimer / 55) * 0.07;
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
          if (this.anims.currentAnim?.key !== 'vader-walk') this.play('vader-walk');
        }
        break;
      }
      case STATE.CHARGING: {
        this.stateTimer += delta;
        this.setScale(1 + Math.sin(this.stateTimer / 40) * 0.04); // vibrate
        // Spawn saber afterimage ghost every ~50ms — fades over 300ms.
        this._saberGhostT = (this._saberGhostT || 0) + delta;
        if (this._saberGhostT >= 50 && this.weaponSprite?.active) {
          this._saberGhostT = 0;
          const ws = this.weaponSprite;
          const ghost = this.scene.add.image(ws.x, ws.y, ws.texture.key)
            .setOrigin(ws.originX, ws.originY)
            .setRotation(ws.rotation)
            .setScale(ws.scaleX, ws.scaleY)
            .setDepth(ws.depth - 1)
            .setTint(0xff4040)
            .setAlpha(0.55);
          this.scene.tweens.add({
            targets: ghost, alpha: 0, scale: ws.scaleX * 1.2,
            duration: 320, ease: 'Cubic.easeOut',
            onComplete: () => ghost.destroy(),
          });
        }
        if (this.stateTimer >= BOSS.chargeDurationMs) {
          this.state = STATE.IDLE;
          this.cooldown = this.cfg.attackCooldownMs;
          this.setScale(1);
        }
        break;
      }
    }

    // Contact damage — shove the player away from us as they get hit.
    if (this.contactDmgCd <= 0 && Math.hypot(dx, dy) < BOSS.radius + 24) {
      const dirFromBoss = Math.atan2(dy, dx);
      player.damage(BOSS.contactDamage, dirFromBoss);
      this.contactDmgCd = 600;
    }
  }

  die() {
    this.alive = false;
    SFX.bossDie();
    this.scene.events.emit('boss-died', this);
    this.hpBar.destroy();
    this.shadow.destroy();
    this.weaponSprite?.destroy();
    this.threatRing?.destroy();
    this.destroy();
  }
}
