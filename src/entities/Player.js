import Phaser from 'phaser';
import { PLAYER, WEAPONS } from '../config.js';
import { SFX } from '../systems/FX.js';
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
    this.alive        = true;
    this.hiddenInBush = false;

    // ── Aiming state ───────────────────────────────────────────────────────
    this.facing      = -Math.PI / 2;
    this.aim         = -Math.PI / 2;
    this.aiming      = false;
    this.superAim    = -Math.PI / 2;
    this.superAiming = false;

    // ── Secondary weapon slot ──────────────────────────────────────────────
    // null means pistol only. Set by equipSecondary(weaponId).
    this.secondary      = null;  // weapon id string
    this.secondaryAmmo  = 0;     // rifle ammo / detonator charges / flame fuel %

    // Burst fire state (rifle)
    this._burstRemaining = 0;
    this._burstTimer     = 0;
    this._burstAngle     = 0;

    // Flamethrower held-fire state
    this.flameActive  = false;   // read by GameScene for damage cone
    this.flameAngle   = 0;
    this._flameDrain  = 0;       // accumulator for fuel drain

    // ── Animation helpers ──────────────────────────────────────────────────
    this._fireAnimTimer = 0;
    this.recoilT        = 0;

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

    this.play('mando-idle');
    // Bump display scale for readability (texture stays 24×24)
    this.setScale(1.15);

    // ── Weapon overlay: held by the character, rotates to match aim. ─────
    // The body itself never rotates — the weapon does. This is how
    // shipping 2D top-down games (Brawl Stars etc.) handle aim direction.
    this.weaponSprite = scene.add.image(x, y, 'wpn-pistol')
      .setDepth(this.depth + 1)
      .setOrigin(0.15, 0.5)  // pivot near the grip so the barrel swings forward
      .setScale(1.15);
  }

  // ── Movement / aiming inputs (called by HUD joysticks) ────────────────────

  setMoveInput(vec) {
    if (!this.alive) { this.setVelocity(0, 0); return; }
    // Hurt-stagger: ignore joystick input briefly so the knockback shove
    // is actually visible before the player resumes control.
    if (this._hurtStaggerMs > 0) return;
    if (vec?.force > 0) {
      this.setVelocity(vec.x * PLAYER.speed * vec.force, vec.y * PLAYER.speed * vec.force);
      this.facing = Math.atan2(vec.y, vec.x);
      // Body NEVER rotates — only the weapon overlay does (handled in preUpdate).
      // When not aiming, the weapon follows the movement direction.
    } else {
      this.setVelocity(0, 0);
    }
  }

  setAimInput(vec) {
    if (!this.alive) return;
    if (vec?.force > 0) {
      this.aiming = true;
      this.aim    = Math.atan2(vec.y, vec.x);
      // Flamethrower: fire while held
      if (this.secondary === 'flamethrower' && this.secondaryAmmo > 0) {
        this.flameActive = true;
        this.flameAngle  = this.aim;
      }
    } else {
      this.aiming      = false;
      this.flameActive = false;
    }
  }

  releaseAim(vec) {
    if (!this.alive) return;
    const dir = vec?.force > 0 ? Math.atan2(vec.y, vec.x) : this.aim;
    this.flameActive = false; // always stop flame on release
    if (this.secondary !== 'flamethrower') {
      this.tryFire(dir);
    }
    this.aiming = false;
  }

  setSuperAimInput(vec) {
    if (!this.alive) return;
    if (vec?.force > 0) {
      this.superAiming = true;
      this.superAim    = Math.atan2(vec.y, vec.x);
    } else {
      this.superAiming = true;
      this.superAim    = this.facing;
    }
  }

  releaseSuperAim(vec) {
    if (!this.alive) return;
    const angle = vec?.force > 0 ? Math.atan2(vec.y, vec.x) : this.facing;
    this.superAiming = false;
    this.tryFireSuper(angle);
  }

  // ── Firing ────────────────────────────────────────────────────────────────

  tryFire(angleOverride) {
    if (!this.alive) return false;
    const dir = typeof angleOverride === 'number' ? angleOverride
      : this.aiming ? this.aim : this.facing;

    // Route through active secondary weapon
    if (this.secondary === 'rifle' && this.secondaryAmmo > 0) {
      return this._startBurst(dir);
    }
    if (this.secondary === 'detonator' && this.secondaryAmmo > 0) {
      return this._throwDetonator(dir);
    }
    // Default: pistol
    return this._firePistol(dir);
  }

  _firePistol(dir) {
    if (this.fireCooldown > 0) return false;
    if (this.ammo <= 0) return false;
    this.fireCooldown  = PLAYER.fireCooldownMs;
    this.ammo         -= 1;
    this.ammoTimers.push(PLAYER.ammoReloadMs);
    this.recoilT       = 110;
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

  _throwDetonator(dir) {
    if (this.fireCooldown > 0) return false;
    const cfg            = WEAPONS.detonator;
    this.secondaryAmmo  -= 1;
    this.fireCooldown    = 400;
    this._fireAnimTimer  = 200;
    this.recoilT         = 80;
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

  // Flamethrower: drains each frame via GameScene; we just expose flameActive
  consumeFlame(delta) {
    const cfg = WEAPONS.flamethrower;
    this._flameDrain += cfg.drainPerSec * delta / 1000;
    if (this._flameDrain >= 1) {
      const drain        = Math.floor(this._flameDrain);
      this._flameDrain  -= drain;
      this.secondaryAmmo = Math.max(0, this.secondaryAmmo - drain);
      this.scene.events.emit('secondary-ammo-changed');
    }
    if (this.secondaryAmmo <= 0) {
      this.flameActive = false;
      this._equipNothing();
    }
  }

  // ── Super ─────────────────────────────────────────────────────────────────

  tryFireSuper(angleOverride) {
    if (!this.alive) return false;
    if (this.superCharge < PLAYER.superHitsToCharge) return false;
    this.superCharge = 0;
    const dir = typeof angleOverride === 'number' ? angleOverride
      : this.aiming ? this.aim : this.facing;
    this.recoilT        = 260;
    this._fireAnimTimer = 240;
    this.scene.events.emit('player-fire-super', dir);
    SFX.shootSuper();
    return true;
  }

  // ── Secondary weapon management ───────────────────────────────────────────

  equipSecondary(weaponId) {
    const cfg       = WEAPONS[weaponId];
    if (!cfg) return;
    this.secondary  = weaponId;
    // Set initial ammo/fuel/charges
    if (weaponId === 'rifle')        this.secondaryAmmo = cfg.totalAmmo;
    else if (weaponId === 'flamethrower') this.secondaryAmmo = cfg.fuel;
    else if (weaponId === 'detonator')    this.secondaryAmmo = cfg.charges;
    this.scene.events.emit('secondary-equipped', weaponId);
    this.scene.events.emit('secondary-ammo-changed');
    SFX.waveStart(); // pickup chime
  }

  _equipNothing() {
    this.secondary     = null;
    this.secondaryAmmo = 0;
    this.flameActive   = false;
    this.scene.events.emit('secondary-equipped', null);
    this.scene.events.emit('secondary-ammo-changed');
  }

  // ── Damage / death ────────────────────────────────────────────────────────

  damage(amount, hitDirRad = null) {
    if (!this.alive) return;
    this.hp         = Math.max(0, this.hp - amount);
    this.lastHurtAt = this.scene.time.now;
    // Knockback shove if we know which direction we got hit from. Mirrors the
    // enemy stagger system: brief input-suspension window so the slide reads.
    if (typeof hitDirRad === 'number') {
      const kbStr = 220;
      this.body.velocity.x += Math.cos(hitDirRad) * kbStr;
      this.body.velocity.y += Math.sin(hitDirRad) * kbStr;
      this._hurtStaggerMs = 110;
    }
    this.scene.events.emit('player-hurt', amount);
    SFX.hurt();
    if (this.hp <= 0) this.die();
  }

  addSuperHit() {
    const before     = this.superCharge;
    this.superCharge = Math.min(PLAYER.superHitsToCharge, this.superCharge + 1);
    if (before < PLAYER.superHitsToCharge && this.superCharge >= PLAYER.superHitsToCharge) {
      SFX.superReady();
      this.scene.events.emit('player-super-ready');
    } else {
      this.scene.events.emit('player-super-changed');
    }
  }

  die() {
    this.alive       = false;
    this.flameActive = false;
    this.setVelocity(0, 0);
    this.jetEmitter?.stop();
    this.scene.events.emit('player-dead');
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta);

    // Hurt-stagger window: bleed knockback velocity so the slide ends
    // smoothly and joystick input takes over again.
    if (this._hurtStaggerMs > 0) {
      this._hurtStaggerMs -= delta;
      this.body.velocity.x *= 0.88;
      this.body.velocity.y *= 0.88;
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
    if (this.alive && this.hp < this.hpMax && time - this.lastHurtAt > PLAYER.regenDelayMs) {
      this.hp = Math.min(this.hpMax, this.hp + (PLAYER.regenPerSec * delta) / 1000);
      this.scene.events.emit('player-hp-changed');
    }

    // ── Weapon overlay: hovers next to the character, rotated to aim ─────
    // The aim angle drives weapon rotation. When not aiming, the weapon
    // follows the move-facing so the character looks "ready" in the direction
    // they're walking. The overlay sits a small radius out from the character
    // center so it visually reads as "held in front" of them.
    if (this.weaponSprite) {
      const ang = this.superAiming ? this.superAim
                : this.aiming      ? this.aim
                : this.facing;
      // Pick the right weapon sprite for the equipped secondary.
      const wantTex = this.secondary === 'rifle' ? 'wpn-rifle'
                    : this.secondary === 'flamethrower' ? 'wpn-rifle'
                    : 'wpn-pistol';
      if (this.weaponSprite.texture.key !== wantTex) this.weaponSprite.setTexture(wantTex);
      const offset = PLAYER.radius - 4;
      this.weaponSprite.x = this.x + Math.cos(ang) * offset;
      this.weaponSprite.y = this.y + Math.sin(ang) * offset;
      this.weaponSprite.rotation = ang;
      this.weaponSprite.setAlpha(this.alive ? (this.hiddenInBush ? PLAYER.bushAlpha : 1) : 0);
    }

    // Shadow + you-are-here glow ring (pulses softly)
    this.shadow.setPosition(this.x, this.y + 18);
    this._glowPulse += delta * 0.005;
    const pulse = 0.85 + 0.15 * Math.sin(this._glowPulse);
    this.glowRing.setPosition(this.x, this.y).setScale(pulse);
    this.glowRing.setAlpha(this.hiddenInBush ? 0.25 : 1);

    // Bush alpha
    this.setAlpha(this.hiddenInBush ? PLAYER.bushAlpha : 1);

    // ── Sprite animation ─────────────────────────────────────────────────
    const speedSq  = this.body.velocity.x ** 2 + this.body.velocity.y ** 2;
    const isMoving = speedSq > 200;

    if (this._fireAnimTimer > 0) {
      this._fireAnimTimer -= delta;
      if (this.anims.currentAnim?.key !== 'mando-fire') this.play('mando-fire');
    } else if (isMoving) {
      if (this.anims.currentAnim?.key !== 'mando-walk') this.play('mando-walk');
    } else {
      if (this.anims.currentAnim?.key !== 'mando-idle') this.play('mando-idle');
    }

    // ── Recoil punch ─────────────────────────────────────────────────────
    if (this.recoilT > 0) {
      this.recoilT -= delta;
      this.setScale(1.15 * (1 - Math.max(0, this.recoilT / 110) * 0.12));
    } else {
      this.setScale(1.15);
    }

  }

  destroy(fromScene) {
    this.shadow?.destroy();
    this.glowRing?.destroy();
    this.weaponSprite?.destroy();
    super.destroy(fromScene);
  }
}
