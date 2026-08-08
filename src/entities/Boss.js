import Phaser from 'phaser';
import { BOSS, ENDLESS } from '../config.js';

const BOSS_MECH = ENDLESS.bossMech;
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

    // Vader-specific: saber glow pulse
    this._glowT = 0;
    this._enraged = false;

    // Mechanic clocks. Held on him rather than as scene timers so they die when
    // he does: a `delayedCall` scheduled by a Vader who then withdraws would
    // fire into the NEXT sector and black out an arena he is not in. Set by
    // GameScene.spawnBoss from the mechanics he has earned; zero means he does
    // not have that trick yet.
    this._reflectEvery    = 0;
    this._reflectT        = 0;
    this._reflectUntil    = 0;   // scene time — the window the bullet code reads
    this._blackoutEvery   = 0;
    this._blackoutT       = 0;
    this._afterimageEvery = 0;
    this._afterimageT     = 0;
    this._disarmEvery     = 0;
    this._disarmT         = 0;

    SFX.bossRoar();

    // Start Vader idle anim
    this.play('vader-idle-front');
  }

  // Override damage() for the wound-instead-of-die behaviour. There is NO
  // intake cap any more.
  //
  // There was one: 1600 per 120ms, tapering to 960 by encounter 6. It existed so
  // a point-blank super could not skip a phase, and the cost of that was
  // enormous — a 5-pellet super arrives inside ONE window, so a 3000-damage
  // volley landed as 960 and encounter 6 took four minutes. It punished the
  // player's biggest commitment hardest, and punished super-spam specifically.
  //
  // Removed by request, and it is the right call: a cap does not lengthen a
  // fight in an interesting way, it makes your strongest move feel like it
  // missed. Fight length belongs to hp, which is honest about what it is.
  damage(amount, knockbackVec = null) {
    const effective = amount;
    this.scene.events.emit('boss-hit', this, effective);

    // Vader is not killed in endless — he is WOUNDED and withdraws, and comes
    // back at the next boss sector harder and with one more trick. Intercepted
    // BEFORE super.damage, because Enemy.damage calls die() the moment hp hits
    // zero and there is no undoing that afterwards.
    if (this._retreats && this.hp - effective <= 0) {
      this.hp = 0;
      this.retreat();
      return;
    }
    super.damage(effective, knockbackVec);
  }

  // Driven off rather than destroyed. Mirrors die()'s teardown exactly — the
  // same attachments have to go or they survive as unkillable ghosts — but
  // announces itself as a withdrawal and emits its own event, so GameScene can
  // continue the run instead of ending it.
  retreat() {
    if (!this.alive) return;
    this.alive = false;
    this.scene.events.emit('boss-wounded', this);
    this.hpBar.destroy();
    this.shadow.destroy();
    this.weaponSprite?.destroy();
    this.threatRing?.destroy();
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y - 60,
      duration: 900,
      ease: 'Sine.easeIn',
      onComplete: () => this.destroy(),
    });
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
    // Never start a state-machine attack while a scripted move owns him. The
    // gate in preUpdate already stops this being reached, but pickAttack is
    // called from elsewhere too and a second zone on the floor is exactly the
    // failure this release exists to fix.
    if (this._performing) return STATE.IDLE;
    const r = Math.random();
    if (this.phase >= 2 && r < 0.33) return STATE.SPAWNING;
    if (r < 0.5) return STATE.CHARGE_WINDUP;
    return STATE.FAN;
  }

  playVaderAnim(type, angle) {
    let dirSuffix = 'front';
    let flipX = false;
    const deg = Phaser.Math.RadToDeg(angle);
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
    // A scripted move owns the pose while it runs. The AI reselects walk/idle
    // every frame, so without this an attack frame cannot survive a single tick
    // — which is exactly why he used to walk through his own moves.
    let want = type;
    if (this._performing && this._moveAnim) {
      want = this._moveAnim === 'thrust' && this.phase >= 2 ? 'thrusthot' : this._moveAnim;
    }
    const key = `vader-${want}-${dirSuffix}`;
    if (!this.scene.anims.exists(key)) return;
    if (this.anims.currentAnim?.key !== key) this.play(key);
  }

  /**
   * Drive the body pose from a move beat.
   *
   * Called by the move scripts. Kept here rather than in the move data so the
   * pose survives the AI's per-frame animation selection above, and so a move
   * only has to name a beat rather than know about frame numbers.
   */
  setMovePose(pose) {
    this._moveAnim = pose;
    if (pose) this.playVaderAnim('idle', this._aim ?? 0);
  }

  preUpdate(time, delta) {
    // Skip base Enemy AI — Vader has its own state machine
    Phaser.Physics.Arcade.Sprite.prototype.preUpdate?.call(this, time, delta);
    // Y-sort: depth tracks world Y. Boss shadow is the bigger 'shadow-boss'
    // sprite so we offset it by 30 like before but drift X with motion.
    this.setDepth(this.y);
    const sVx = this.body.velocity.x;
    const sVy = this.body.velocity.y;
    const sDx = Phaser.Math.Clamp(sVx * 0.010, -4, 4);
    const sDy = Phaser.Math.Clamp(sVy * 0.006, -3, 3);
    this.shadow.setPosition(this.x + sDx, this.y + 30 + sDy);
    this.shadow.setDepth(this.y - 1);
    this.updateHpBar();
    this.setAlpha(this.hiddenInBush ? 0.55 : 1);
    if (this.threatRing) {
      this._ringPulse += delta * 0.005;
      const pulse = 0.94 + 0.06 * Math.sin(this._ringPulse);
      this.threatRing.setPosition(this.x, this.y).setScale(pulse);
      this.threatRing.setAlpha(this.hiddenInBush ? 0.25 : 1);
      this.threatRing.setDepth(this.y - 2);
    }
    if (!this.alive) return;

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
      this.weaponSprite.setFlipY(Math.abs(angToPlayer) > Math.PI / 2);
      this.weaponSprite.setAlpha(this.alive ? (this.hiddenInBush ? 0.55 : 1) : 0);
      
      const degBoss = Phaser.Math.RadToDeg(angToPlayer);
      const isFacingNorth = (degBoss < -45 && degBoss > -135);
      this.weaponSprite.setDepth(isFacingNorth ? this.y - 1 : this.y + 1);
    }

    if (this.contactDmgCd > 0) this.contactDmgCd -= delta;
    this._tickMechanics(delta);

    // ── ONE SYSTEM DRIVES HIM AT A TIME ──────────────────────────────────
    //
    // This is the bug that got the first version of his moves rejected on
    // sight. Everything above is housekeeping and must keep running; from here
    // down is an AI that writes his velocity and his animation EVERY FRAME,
    // and it had never heard of `_activeMove`.
    //
    // The exact mechanism is worth writing down, because I guessed it wrong
    // once already. This is `preUpdate`, which Phaser runs on PRE_UPDATE via
    // the scene's UpdateList — BEFORE the tween manager steps on UPDATE
    // (node_modules/phaser/src/scene/Systems.js:360). So:
    //
    //   - anything a move TWEENS (scale, the weapon sprite's position) is
    //     written after this and survives. The saber really does leave his
    //     hand; I assumed it could not and a one-frame probe proved me wrong.
    //   - anything a move SETS DIRECTLY — velocity above all — is overwritten
    //     on the very next frame by the line below.
    //
    // Measured on the rejected build: he walked at the player at 165px/s
    // through the ANTICIPATE beat of all four moves. His wind-up never
    // rendered, so from the player's chair there was no anticipation at all,
    // just Vader advancing and then an effect landing. That is precisely what
    // "Vader does pull suddenly" meant.
    // The pose has to be reasserted every frame, because the animation
    // selection below is what the gate skips — and a pose set once at the start
    // of a beat would be the only frame it survived.
    if (this._performing && this._moveAnim) this.playVaderAnim('idle', angToPlayer);

    // Yield, do not stop. This gate deliberately writes NOTHING: a travelling
    // move sets a velocity and expects it to persist, so zeroing here every
    // frame would turn any charge into a standing pose. A move that wants him
    // planted calls `setVelocity(0, 0)` in its own anticipate beat — and that
    // call now survives the frame, which is the entire point.
    if (this._performing) return;

    switch (this.state) {
      case STATE.IDLE: {
        const speed = this.cfg.speed * (this.phase === 3 ? 1.35 : 1);
        this.setVelocity(Math.cos(angToPlayer) * speed, Math.sin(angToPlayer) * speed);

        // Vader animation during advance
        const spd2 = speed * speed;
        if (this.body.velocity.x ** 2 + this.body.velocity.y ** 2 > 200) {
          this.playVaderAnim('walk', angToPlayer);
        } else {
          this.playVaderAnim('idle', angToPlayer);
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
            // The lane on the floor. His charge has always had a windup and a
            // scale pulse, and NOTHING on the ground — "he only charges but no
            // lane light or anything" was a precise description of that. The
            // nemesis charge has read correctly since it shipped; this is the
            // same telegraph, on the boss that needed it more.
            this.scene.events.emit('boss-charge-windup', this, angToPlayer, BOSS.chargeWindupMs);
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
        this.playVaderAnim('fire', this.chargeAngle);
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
          this.playVaderAnim('walk', this.chargeAngle);
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
          
          // Vader ground slam impact effects
          this.scene.events.emit('boss-phase-crack', this.x, this.y, 1);
          SFX.bossSlam?.();
          this.scene.fx?.burst?.(this.x, this.y, 'yellow', 15);
          this.scene.fx?.burst?.(this.x, this.y, 'white', 15);
          this.scene.fx?.shake?.(0.015, 200);
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

  /**
   * The earned mechanics, on their own clocks.
   *
   * Each one only ANNOUNCES itself — the scene owns the effect, exactly as
   * `boss-fan` and `boss-spawn` already work. Vader has no business knowing how
   * darkness is drawn or how a weapon pickup is spawned, and routing it through
   * events is also what lets the smoke test assert each effect from outside.
   */
  _tickMechanics(delta) {
    // Same reason as the reflect timer below: anything reaching for
    // `this.scene` has to survive being called on a boss whose scene has gone.
    if (!this.scene) return;
    if (this._reflectEvery > 0) {
      this._reflectT -= delta;
      if (this._reflectT <= 0) {
        this._reflectT = this._reflectEvery;
        // Telegraphed: the flare goes up first and the window opens after it, so
        // holding fire for a beat beats it outright. That is the difference
        // between a surprise and a tax.
        this.scene.events.emit('boss-reflect-windup', this);
        this.scene.time.delayedCall(BOSS_MECH.reflectWindupMs, () => {
          // `alive` is not enough. Phaser clears `this.scene` on destroy(), and
          // a Vader who withdrew or was torn down with the room leaves this
          // timer already scheduled — it then fires into a corpse and throws on
          // `this.scene.time`. Crashes the whole scene, so it takes the run with
          // it. Pre-existing; surfaced by a suite run, not by this release.
          if (!this.alive || !this.scene) return;
          this._reflectUntil = this.scene.time.now + BOSS_MECH.reflectMs;
          this.scene.events.emit('boss-reflect-open', this);
        });
      }
    }

    if (this._blackoutEvery > 0) {
      this._blackoutT -= delta;
      if (this._blackoutT <= 0) {
        this._blackoutT = this._blackoutEvery;
        this.scene.events.emit('boss-blackout', this, BOSS_MECH.blackoutMs);
      }
    }

    if (this._afterimageEvery > 0) {
      this._afterimageT -= delta;
      if (this._afterimageT <= 0) {
        this._afterimageT = this._afterimageEvery;
        this.scene.events.emit('boss-afterimages', this, BOSS_MECH.afterimageCount);
      }
    }

    if (this._disarmEvery > 0) {
      this._disarmT -= delta;
      if (this._disarmT <= 0) {
        this._disarmT = this._disarmEvery;
        this.scene.events.emit('boss-disarm', this);
      }
    }

    // Cleared here rather than on a timer that could outlive him.
    if (this._reflectUntil && this.scene.time.now > this._reflectUntil) this._reflectUntil = 0;
  }

  /** True while the saber is up. Read by the player-bullet collision. */
  isReflecting() {
    return this.alive && this._reflectUntil > this.scene.time.now;
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
