import Phaser from 'phaser';
import { BOSS, ENDLESS } from '../config.js';

const BOSS_MECH = ENDLESS.bossMech;
import { SFX } from '../systems/FX.js';
import { Enemy } from './Enemy.js';
// One definition of the punish bonus, shared with Enemy.damage — see the note
// in damage() for why this file has to know about it.
import { punishMultiplier } from '../systems/MoveScript.js';

const STATE = {
  IDLE: 'idle',
  CHARGE_WINDUP: 'charge_windup',
  CHARGING: 'charging',
  SLAM_WINDUP: 'slam_windup',
  SLAM: 'slam',
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

    // The parry pose. Not a mechanic clock — see `parry()`.
    this._parryT     = 0;
    this._parryAngle = 0;

    // ── Damage-burst window, for the reactive VANISH ─────────────────────
    // VANISH is no longer on his attack rotation. It fires when the player
    // hurts him HARD in a short window — an escape from pressure, which is
    // what it always looked like it should be — and then locks out so it
    // cannot chain. See `_recordBurst` and `shouldVanish`.
    this._burst = [];
    this._vanishLockMs = 0;

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

    // ── VADER IS NOT PUSHED. EVER. ───────────────────────────────────────
    //
    // `Enemy.damage` adds the knockback vector straight onto the body's
    // velocity, and nothing exempted the boss — so a super landing on him
    // during a wind-up threw him across the room and off his own telegraph,
    // leaving a zone marking a place he was no longer standing. Reported as
    // "he gets thrown far" and "it can get buggy if I hit him with super when
    // he's doing a move", and both are the same line of code.
    //
    // Dropped entirely rather than reduced: any displacement at all can move
    // him out of a lane he is the origin of. The hit flash and the damage
    // number still fire, so the hit reads as landing — it just does not move a
    // man in powered armour.
    knockbackVec = null;
    this._recordBurst?.(effective);

    // Vader is not killed in endless — he is WOUNDED and withdraws, and comes
    // back at the next boss sector harder and with one more trick. Intercepted
    // BEFORE super.damage, because Enemy.damage calls die() the moment hp hits
    // zero and there is no undoing that afterwards.
    //
    // It must test the SAME number the parent is about to subtract.
    // `Enemy.damage` multiplies by `_punishMult` inside a punish window
    // (Enemy.js: `if (this._punishMs > 0) amount *= this._punishMult`), so a
    // hit that is not lethal raw can be lethal applied — the intercept let it
    // through, `super.damage` drove hp to zero and called `die()`, and VADER
    // DIED IN ENDLESS. That is the one promise this whole ladder makes.
    //
    // Latent since the punish window and the retreat started coexisting; it
    // surfaced only when the hp pool moved, because that changed where hits
    // land relative to punish windows. `smoke-vader` caught it by luck of the
    // arithmetic, so there is now an explicit check for the punish case.
    const lethal = effective * punishMultiplier(this);
    if (this._retreats && this.hp - lethal <= 0) {
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
    // Explicit per-phase cooldowns, not a formula.
    //
    // This used to be `Math.max(900, attackCooldownMs - 400 * (p - 1))`. With
    // attackCooldownMs at 1100 that is max(900, 700) = 900 at phase 2 and
    // max(900, 300) = 900 at phase 3 — THE CLAMP ATE THE ENTIRE PHASE-3 TERM,
    // so his attack rate was identical in both and the only thing phase 3
    // actually gained was 1.35x move speed. It read as an escalation in the
    // source and was none in the game.
    //
    // 900 is a real floor, not a guess: a move occupies ~3.3s of
    // anticipate/act/recover and the two systems block each other, so shorter
    // gaps do not buy more attacks — they only starve the scripted moves (see
    // the cadence table above `attackCooldownMs`). Phase 3 takes its share out
    // of the state machine's own cooldown instead.
    const perPhase = { 1: BOSS.attackCooldownMs, 2: 950, 3: 820 };
    this.cfg = { ...this.cfg, attackCooldownMs: perPhase[p] ?? BOSS.attackCooldownMs };
    if (p >= 2) this._enraged = true;
    SFX.bossRoar();
    this.scene.events.emit('boss-phase', p);
    this.scene.events.emit('boss-phase-crack', this.x, this.y, p);
  }

  /** Log a hit into the rolling burst window. Called from `damage()`. */
  _recordBurst(amount) {
    const now = this.scene?.time?.now ?? 0;
    this._burst.push({ t: now, amount });
    // Keep only the window we care about; this list must not grow with the run.
    while (this._burst.length && now - this._burst[0].t > BOSS_MECH.vanishWindowMs) {
      this._burst.shift();
    }
  }

  /**
   * Has the player just hurt him badly enough to make him disappear?
   *
   * A share of his max hp inside a short window — so it scales with the ladder
   * rather than firing constantly on a late-encounter Vader with 5x the health.
   * The lockout is what stops it becoming the spam it was on rotation.
   */
  shouldVanish() {
    if (!this.alive || this._performing || this._vanishLockMs > 0) return false;
    const now = this.scene?.time?.now ?? 0;
    const recent = this._burst
      .filter((h) => now - h.t <= BOSS_MECH.vanishWindowMs)
      .reduce((sum, h) => sum + h.amount, 0);
    return recent >= this.hpMax * BOSS_MECH.vanishHpFrac;
  }

  pickAttack() {
    // Never start a state-machine attack while a scripted move owns him. The
    // gate in preUpdate already stops this being reached, but pickAttack is
    // called from elsewhere too and a second zone on the floor is exactly the
    // failure this release exists to fix.
    if (this._performing) return STATE.IDLE;
    // THE FAN IS GONE. It was the oldest thing he had — a spread of green
    // bolts fired from a planted stance — and it was cut by request: it read
    // as a generic shooter attack on a character whose whole identity is a
    // saber and the Force. Nothing replaces it in this state machine; his
    // variety now comes from the scripted move pool.
    const r = Math.random();
    if (this.phase >= 2 && r < 0.22) return STATE.SPAWNING;
    // The overhead smash is a STANDING attack and gets equal billing with the
    // rush, so the two read as different answers rather than one being the
    // tail of the other.
    if (r < 0.60) return STATE.SLAM_WINDUP;
    return STATE.CHARGE_WINDUP;
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
    // While the saber is in the air it belongs to the throw, not to his hand.
    // The flight happens on the scene clock, which runs after this, so it wins
    // either way — but reclaiming a sprite that is 500px away every frame is
    // the kind of thing that only stays harmless by accident.
    // Ticked out here rather than inside the branch below: the saber can be in
    // the AIR when a parry is asked for, and a timer that only counts down
    // while the sprite is in his hand would come back stuck at full the next
    // time he caught it — a parry pose held for the rest of the fight.
    if (this._parryT > 0) this._parryT -= delta;

    if (this.weaponSprite && !this._saberAway) {
      // A deflection is the one moment his blade answers something other than
      // the player's body, so it is the one moment it may point elsewhere. The
      // blade SNAPS to the intercept bearing on the frame of contact and eases
      // back to guard over `parryMs`, thrust out furthest at the moment it is
      // actually meeting the bolt.
      let aim = angToPlayer;
      let offset = BOSS.radius - 6;
      if (this._parryT > 0) {
        const u = 1 - this._parryT / BOSS_MECH.parryMs;          // 0 at contact
        const w = (1 - u) * (1 - u);                             // ease back
        // Shortest way round, so a bolt taken from behind swings the blade the
        // near way rather than sweeping it through his own body.
        aim = angToPlayer + Phaser.Math.Angle.Wrap(this._parryAngle - angToPlayer) * w;
        offset += 30 * w;
      }
      this.weaponSprite.x = this.x + Math.cos(aim) * offset;
      this.weaponSprite.y = this.y + Math.sin(aim) * offset;
      this.weaponSprite.rotation = aim;
      this.weaponSprite.setFlipY(Math.abs(aim) > Math.PI / 2);
      this.weaponSprite.setAlpha(this.alive ? (this.hiddenInBush ? 0.55 : 1) : 0);

      const degBoss = Phaser.Math.RadToDeg(aim);
      const isFacingNorth = (degBoss < -45 && degBoss > -135);
      this.weaponSprite.setDepth(isFacingNorth ? this.y - 1 : this.y + 1);
    }

    if (this.contactDmgCd > 0) this.contactDmgCd -= delta;
    if (this._vanishLockMs > 0) this._vanishLockMs -= delta;
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

        // ── HE STOPS AT SABER RANGE ──────────────────────────────────────
        //
        // This used to drive at the player unconditionally, every frame, with
        // no stop distance — so once he arrived he was trying to occupy the
        // same pixel they were, and arcade physics shoved him back and forth
        // across their body. That is the "he comes and pathfinder gets fucked,
        // he spins left right on my position" in the report: not pathfinding at
        // all, just a chase with no arrival condition and nothing to do on
        // arrival.
        //
        // Now he closes to `standoff` and holds, which is also the range his
        // SABER COMBO reaches from — so arriving means attacking instead of
        // jittering.
        const dist = Math.hypot(dx, dy);
        const standoff = BOSS.standoffPx;
        if (dist > standoff) {
          this.setVelocity(Math.cos(angToPlayer) * speed, Math.sin(angToPlayer) * speed);
          this.playVaderAnim('walk', angToPlayer);
        } else if (dist < standoff * 0.62) {
          // TOO close — back off to his working range rather than overlapping
          // them. Something else put him here (a combo step, a charge that ran
          // through, the player walking into him), and standing inside the
          // player is what the jitter looked like.
          this.setVelocity(-Math.cos(angToPlayer) * speed * 0.7,
                           -Math.sin(angToPlayer) * speed * 0.7);
          this.playVaderAnim('walk', angToPlayer);
        } else {
          // Inside his own reach: plant. A dead stop rather than a drift, so
          // there is no residual velocity to argue with the player's body.
          this.setVelocity(0, 0);
          this.playVaderAnim('idle', angToPlayer);
          // ...and SWING. This is what he does at this range now, instead of
          // grinding against the player's collision box waiting for a ranged
          // move's clock to come round.
          this._comboT = (this._comboT ?? 0) - delta;
          if (this._comboT <= 0) {
            this._comboT = BOSS.comboEveryMs;
            this.scene.events.emit('boss-wants-combo', this);
          }
        }
        this.setScale(glowScale);

        // The reactive VANISH pre-empts everything else: it is an escape from
        // pressure, so it has to be able to interrupt his ordinary cadence.
        if (this.shouldVanish()) {
          this._vanishLockMs = BOSS_MECH.vanishLockMs;
          this._burst.length = 0;
          this.scene.events.emit('boss-wants-vanish', this);
          break;
        }

        this.cooldown -= delta;
        if (this.cooldown <= 0) {
          this.state = this.pickAttack();
          this.stateTimer = 0;
          if (this.state === STATE.SLAM_WINDUP) {
            // OVERHEAD SMASH. He plants where he stands, brings the saber up
            // over his head and drives it into the deck. No travel — the zone
            // is around HIM, so the answer is to leave rather than to sidestep
            // a lane.
            this.setVelocity(0, 0);
            SFX.bossRoar();
            this.setMovePose?.('raise');
            this._slamAt = { x: this.x, y: this.y };
            this.scene.events.emit('boss-slam-windup', this, BOSS.slamWindupMs, BOSS.slamRadius);
          } else if (this.state === STATE.CHARGE_WINDUP) {
            this.setVelocity(0, 0);
            SFX.bossRoar();
            this.chargeAngle = angToPlayer;
            this._dragFrom = null;      // the furrow starts where the run does
            // The lane on the floor. His charge has always had a windup and a
            // scale pulse, and NOTHING on the ground — "he only charges but no
            // lane light or anything" was a precise description of that. The
            // nemesis charge has read correctly since it shipped; this is the
            // same telegraph, on the boss that needed it more.
            this.scene.events.emit('boss-charge-windup', this, angToPlayer, BOSS.chargeWindupMs);
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
        // THE RUSH IS JUST A RUSH NOW. It used to end in the overhead slam,
        // which made the slam something he travelled to rather than something
        // he did — "scrap the dash, I want that attack to become an overhead
        // hit on ground". The slam is its own standing attack; see SLAM below,
        // which nothing dashes into.
        //
        // It still ends early on contact rather than grinding along a wall for
        // the rest of its duration.
        const blocked = this.body && (this.body.blocked.left || this.body.blocked.right
          || this.body.blocked.up || this.body.blocked.down);
        // The saber SWEEPS through the run instead of being carried out front.
        this._chargeSwingT = (this._chargeSwingT || 0) + delta;
        if (this._chargeSwingT >= 190) {
          this._chargeSwingT = 0;
          this._chargeSwingDir = -(this._chargeSwingDir || 1);
          this.scene.fx?.saberSweep?.(this.x, this.y, this.chargeAngle, 84, this._chargeSwingDir);
        }
        // ── THE ONE THING ONLY THE RUSH DOES ──────────────────────────────
        //
        // The rush and the throw both put a crimson lane on the floor, and
        // once the lane was gone they were two crimson blurs travelling. This
        // is what separates them for good: he drags the point through the deck
        // as he goes, so the run leaves a continuous furrow BEHIND him — a
        // record of the path he has already taken, which a thrown blade never
        // produces. Also the reason it reads on a still: the furrow is the
        // difference between "something is moving" and "he came from there".
        // Segment-to-segment, from where he was to where he is, so the furrow
        // is continuous at any frame rate rather than a dashed line whose gaps
        // measure the machine.
        if (this._dragFrom) {
          this.scene.fx?.saberDrag?.(this._dragFrom.x, this._dragFrom.y, this.x, this.y);
        }
        this._dragFrom = { x: this.x, y: this.y };
        if (this.stateTimer >= BOSS.chargeDurationMs || blocked) {
          this.setVelocity(0, 0);
          this.state = STATE.IDLE;
          this.stateTimer = 0;
          this.setScale(1);
          this.cooldown = this.cfg.attackCooldownMs;
          if (blocked) {
            this.scene.fx?.saberSlam?.(this.x, this.y, BOSS.slamRadius * 0.7);
            this.scene.fx?.shake?.(0.026, 260);
            this._staggerMs = 420;      // a whiffed rush into a wall is punishable
          }
        }
        break;
      }
      // The second beat of the rush: he plants, the zone fills, and the saber
      // comes down. Kept in the state machine rather than made a separate move
      // so the charge stays ONE attack that escalates — a rush and a slam as
      // two pool entries would just read as two similar rushes.
      // He is raised and about to bring it down. The zone is already filling
      // on the floor around him; this beat is the hold that makes it readable.
      case STATE.SLAM_WINDUP: {
        this.setVelocity(0, 0);
        this.stateTimer += delta;
        this.playVaderAnim('idle', angToPlayer);
        // Rise onto the balls of his feet as it comes.
        const k = Math.min(1, this.stateTimer / BOSS.slamWindupMs);
        this.setScale(1 + k * 0.10, 1 + k * 0.16);
        if (this.stateTimer >= BOSS.slamWindupMs) {
          this.setScale(1);
          this.state = STATE.SLAM;
          this.stateTimer = 0;
        }
        break;
      }

      case STATE.SLAM: {
        // The strike itself. One frame of commitment, then a long recovery —
        // this is the biggest punish window he offers.
        this.setVelocity(0, 0);
        this.setMovePose?.('thrust');
        this.scene.events.emit('boss-slam', this, this._slamAt, BOSS.slamRadius);
        SFX.bossSlam?.();
        this.state = STATE.IDLE;
        this.stateTimer = 0;
        this.cooldown = this.cfg.attackCooldownMs;
        this._staggerMs = BOSS.slamRecoverMs;
        this._moveAnim = null;
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

  /**
   * Meet a bolt with the blade.
   *
   * `angle` is the bearing from HIM to the shot he is turning — the direction
   * the saber has to reach to be in its way.
   *
   * OWNED HERE, and that is the whole design note. `preUpdate` rewrites the
   * weapon sprite's position, rotation, flip and depth every single frame from
   * the angle to the player, so a parry tweened from the scene would be one
   * more system writing the same four properties — the exact fight that got
   * his moves rejected the first time. Instead the scene asks for a parry and
   * the block that already owns the saber draws it. One writer, no argument.
   *
   * It sets no `_performing` and takes no ownership of his body: a deflection
   * is a reflex, not an attack, and it must be able to happen in the middle of
   * a charge or a combo without interrupting either.
   */
  parry(angle) {
    this._parryAngle = angle;
    this._parryT = BOSS_MECH.parryMs;
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
