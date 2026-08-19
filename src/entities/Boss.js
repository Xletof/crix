import Phaser from 'phaser';
import { BOSS, ENDLESS, parryArcFor } from '../config.js';

const BOSS_MECH = ENDLESS.bossMech;

/**
 * Where the blade is, `u` of the way through a parry.
 *
 * PURE, EXPORTED, AND CALLED BY `preUpdate` — one implementation, drawn by the
 * game and read by the test. The alternative is a smoke test that reimplements
 * the curve, which then agrees with itself forever no matter what ships.
 *
 * It is also the only honest way to check this at all. A parry is 300ms and the
 * headless harness runs at ~20fps with 50-200ms frames, so which point of the
 * curve any single sample lands on is luck — the previous instrument read 49deg,
 * then 2deg, then 49deg on three identical runs of correct code. Sampling the
 * SHAPE here, and separately asserting that the live blade matches this function
 * at whatever `u` the frame happens to be at, splits that into two claims
 * neither of which can be outrun by a slow frame.
 *
 * `u` is clamped: 0 is the contact frame — blade on the intercept bearing,
 * thrust to full reach — so a forced `_parryT` larger than `parryMs` pins the
 * contact pose rather than running the curve backwards.
 */
export function parryPose(arc, u) {
  const t0 = Math.min(1, Math.max(0, u));
  const sweepEnd = BOSS_MECH.parrySweepEnd;
  const holdEnd  = BOSS_MECH.parryHoldEnd;
  let k, reachK;
  if (t0 < sweepEnd) {
    // FOLLOW-THROUGH. Fast out of contact, decelerating into the finish — the
    // shape of a real cut, and the half of the gesture the player actually
    // reads. There is no wind-up beat because there was no warning: the bolt
    // was killed and the reply fired on the frame `parry()` was called.
    const t = t0 / sweepEnd;
    k = 1 - (1 - t) * (1 - t);
    reachK = 1 - 0.45 * t;
  } else if (t0 < holdEnd) {
    k = 1; reachK = 0.55;              // the finish pose, held to be seen
  } else {
    const t = (t0 - holdEnd) / (1 - holdEnd);
    k = (1 - t) * (1 - t);             // recover to guard
    reachK = 0.55 * (1 - t);
  }
  return { offsetRad: Phaser.Math.DegToRad(arc.arcDeg) * k, reach: arc.reach * reachK };
}

/**
 * THE POWER SWEEP — the pure curve of Vader throwing the captured super back.
 *
 * `dir` is the handedness (+1 / -1); `u` is one continuous phase across the
 * WHOLE gesture, and the number that matters is 1: that is the power frame,
 * the blade on the throw line travelling at its fastest, and it is the tick
 * the orb departs on.
 *
 *   u < 0.34   SETTLE. He takes the blade up and off the line, away from the
 *              mass he is about to hit. This is the beat that says a throw is
 *              coming rather than another parry.
 *   0.34..1    DRIVE, accelerating. `1 - k^2` is deliberately slow to leave
 *              the wind-up and fastest as it arrives: the biggest blade
 *              displacement per frame is the frame of the launch, which is
 *              what makes the swing look like the CAUSE of it. A linear drive
 *              reads as the blade drifting to a stop next to a ball that then
 *              leaves on its own.
 *   1..2       FOLLOW-THROUGH, past the line and back to rest. Nothing is
 *              being decided here; it exists so the throw has a finish, and
 *              it is the last of his saber ownership.
 *
 * Returned as an offset from the throw bearing and a thrust past the resting
 * hold, exactly like `parryPose`, because the block in `preUpdate` that draws
 * the saber is the one writer for both. Exported so the smoke test measures
 * THIS curve rather than a copy of it.
 */
export function superSwingPose(dir, u) {
  const M = BOSS_MECH;
  const arc  = Phaser.Math.DegToRad(M.superSweepArcDeg);
  const back = Phaser.Math.DegToRad(M.superFollowArcDeg);
  const t = Math.max(0, Math.min(2, u));
  if (t < 1) {
    const settleEnd = 0.34;
    if (t < settleEnd) {
      const k = t / settleEnd;
      return { offsetRad: dir * arc * k, reach: M.superSweepReach * 0.30 * k };
    }
    const k = (t - settleEnd) / (1 - settleEnd);
    return {
      offsetRad: dir * arc * (1 - k * k),
      reach: M.superSweepReach * (0.30 + 0.70 * k * k),
    };
  }
  const t1 = t - 1;
  const swingEnd = 0.55;
  if (t1 < swingEnd) {
    const k = t1 / swingEnd;
    return {
      offsetRad: -dir * back * (1 - (1 - k) * (1 - k)),
      reach: M.superSweepReach * (1 - 0.55 * k),
    };
  }
  const k = (t1 - swingEnd) / (1 - swingEnd);
  const e = (1 - k) * (1 - k);
  return { offsetRad: -dir * back * e, reach: M.superSweepReach * 0.45 * e };
}
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
    // DEFLECTION is DUE vs DEFLECTION is HAPPENING. The clock firing only
    // makes it owed; it cannot start while something else physically owns the
    // saber. See `_tickMechanics` and `hasSaber`.
    this._reflectPending  = false;   // owed, waiting for the blade to come back
    this._reflectClaimed  = false;   // tell is up, blade reserved, guard not open
    this._blackoutEvery   = 0;
    this._blackoutT       = 0;
    this._afterimageEvery = 0;
    this._afterimageT     = 0;
    this._disarmEvery     = 0;
    this._disarmT         = 0;

    // The parry gesture. Not a mechanic clock — see `parry()`.
    this._parryT     = 0;
    this._parryAngle = 0;
    this._parryArc   = null;   // which of PARRY_ARCS is being performed

    // ── SUPER DEFLECTION ──────────────────────────────────────────────────
    // He catches a super instead of batting it back pellet by pellet, holds
    // it, and returns one slow orb. Three counters, all TICKED HERE rather
    // than scheduled: a `delayedCall` on a boss who withdraws mid-sequence
    // fires into the next sector, which is exactly the bug the reflect windup
    // already had to be guarded against.
    this._absorbCount = 0;   // pellets caught and not yet handed back
    this._absorbT     = 0;   // grace after the last pellet
    this._releaseN    = 0;   // pellets committed to the orb now winding up
    this._releaseT    = 0;   // anticipation before it leaves
    this._absorbOrb   = null;
    // The throw itself. `_sweepDir` is the handedness of the power sweep and
    // doubles as its "a sweep is running" flag (0 = none); `_followT` is the
    // follow-through that outlives the launch. Both are cleared here rather
    // than only at the end of a gesture, so a boss killed mid-throw — or a
    // restart, which builds a new one — cannot inherit saber ownership.
    this._sweepDir    = 0;
    this._followT     = 0;

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
    this._absorbOrb?.destroy(); this._absorbOrb = null;
    // The throw goes with him. `_sweepDir` doubles as "a throw is in progress"
    // and `isGuarding()` reads it, so a Vader wounded mid-sweep would hand the
    // next room's rebuild a saber that is permanently owned by a gesture
    // nobody is running.
    this._sweepDir = 0; this._followT = 0;
    this._releaseT = 0; this._releaseN = 0;
    this._absorbCount = 0; this._absorbT = 0;
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
    // Not out of the guard: he cannot vanish while holding the player's own
    // energy in his hands without the energy going with him, unexplained.
    if (this.isGuarding()) return false;
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
    // Nor while the guard owns him — see `isGuarding`. Returning IDLE rather
    // than resetting `cooldown` is deliberate: the cooldown keeps running down
    // past zero underneath, so the frame the stance drops he attacks, with no
    // dead recovery bolted onto the end of it.
    if (this.isGuarding()) return STATE.IDLE;
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
    // Before the block below, not after it — see `_tickSuperRelease`.
    this._tickSuperRelease(delta);

    if (this.weaponSprite && !this._saberAway) {
      // ── THE ONE WRITER ────────────────────────────────────────────────
      // Everything the saber does — rest, guard, parry — is decided here and
      // nowhere else. This block rewrites position, rotation, flip and depth
      // every frame from scratch, so a scene-side tween on any of them is not
      // an addition, it is a second author for the same four numbers. That
      // fight is what got his moves rejected the first time round.
      const rest = BOSS.radius - 6;
      let aim = angToPlayer;
      let offset = rest;

      const swing = this.superSwing();
      if (swing) {
        // ── THE THROW ────────────────────────────────────────────────────
        // First in the chain on purpose. An ordinary bolt reaching the guard
        // during these few hundred ms is still mechanically deflected — that
        // path is in the scene and knows nothing about poses — but its
        // gesture DEFERS rather than fighting this one for the same four
        // numbers. A blade already sweeping through the throw line is an
        // honest contact motion for a bolt arriving from the player, who is
        // on that line; two gestures at once, or a second saber, would not
        // be. This is the smallest truthful answer and it costs nothing:
        // `parry()` only sets flags, and `_parryT` keeps running underneath.
        const pose = superSwingPose(swing.dir, swing.u);
        aim = this._aim + pose.offsetRad;
        offset = rest + pose.reach;
      } else if (this._parryT > 0) {
        // ── A PARRY ──────────────────────────────────────────────────────
        // Read the beats in `parryMs` order. u = 0 is the CONTACT frame: the
        // bolt was killed and the return fired on the frame `parry()` was
        // called, so the blade starts ON the intercept bearing at full reach
        // and everything after it is follow-through. There is no wind-up to
        // animate, because there was none — he had no warning either.
        const arc  = this._parryArc || parryArcFor(this._parryAngle);
        const pose = parryPose(arc, 1 - this._parryT / BOSS_MECH.parryMs);
        aim = this._parryAngle + pose.offsetRad;
        offset = rest + pose.reach;
      } else if (this.isReflecting()) {
        // ── THE GUARD ────────────────────────────────────────────────────
        // The stance has to be readable with nothing in the air. Held off his
        // aim line, because the aim line is his ordinary pose and a stance that
        // looks like the ordinary pose announces nothing. The sway is small and
        // slow; it says "held", not "swinging".
        const sway = Math.sin(this._glowT * 0.006) * 0.12;
        aim = angToPlayer + Phaser.Math.DegToRad(BOSS_MECH.guardOffsetDeg) + sway;
        offset = rest + 14;
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

    // ── THE ENERGY HE IS HOLDING ────────────────────────────────────────
    // ONE Graphics, cleared and redrawn, never accumulating — and drawn here
    // rather than in FX for the saber's reason: it sits on his hand, his hand
    // moves every frame, and a scene-side object following him would be a
    // second author for the same position. It swells as pellets land and pulses
    // hard once he has committed; that pulse IS the anticipation before the orb
    // leaves, and it is the only warning a point-blank player gets.
    const held = this.heldSuper();
    if (held > 0) {
      if (!this._absorbOrb) {
        this._absorbOrb = this.scene.add.graphics()
          .setBlendMode(Phaser.BlendModes.ADD);
      }
      const commit = this._releaseT > 0
        ? 1 - this._releaseT / BOSS_MECH.superReleaseMs
        : 0;
      const pulse = 1 + Math.sin(this._glowT * (commit > 0 ? 0.05 : 0.018))
                      * (commit > 0 ? 0.16 : 0.07);
      // ── THE LAUNCH BEAT ─────────────────────────────────────────────
      // The last `superLaunchMs` of the release window, and it is carved OUT
      // of that window rather than added to it: the approved 620ms of
      // anticipation does not move. Handset review found the held state read
      // well and the flying state read poorly, with nothing joining them — the
      // orb simply stopped being at his hand and started being a bright circle
      // in the air. So the mass now gathers into itself and its core goes
      // white just before it goes, which is the frame the eye needs to accept
      // that the thing now crossing the room IS the thing he was holding.
      const lz = BOSS_MECH.superLaunchMs;
      const launch = (this._releaseT > 0 && this._releaseT < lz)
        ? 1 - this._releaseT / lz          // 0 -> 1 across the final beat
        : 0;
      const squeeze = 1 - 0.30 * launch;   // compress
      const r  = (9 + Math.min(held, 8) * 3.2 + commit * 16) * pulse * squeeze;
      const hx = this.x + Math.cos(this._aim) * (BOSS.radius + 4);
      const hy = this.y + Math.sin(this._aim) * (BOSS.radius + 4) - 6;
      const g  = this._absorbOrb;
      g.clear();
      g.setPosition(hx, hy).setDepth(this.y + 2);
      const t = this._glowT * 0.006;
      g.fillStyle(0x5a1e6e, 0.30); g.fillCircle(0, 0, r * 1.35);
      g.fillStyle(0xff2020, 0.55); g.fillCircle(0, 0, r);
      // Two lobes drifting inside the shell on rates that are not harmonics of
      // each other, so the held mass churns instead of sitting still. Restrained
      // on purpose: handset review liked this state, and the note was "do not
      // bury it". Six extra draw calls, no new objects.
      for (let i = 0; i < 2; i++) {
        const a = t * (0.8 + i * 0.6) + i * 2.1;
        const d = r * (0.20 + 0.08 * Math.sin(t * 1.7 + i));
        g.fillStyle(0xff5a5a, 0.22);
        g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, r * (0.62 + 0.08 * Math.sin(t * 2.1 + i)));
      }
      g.fillStyle(0xff8888, 0.75); g.fillCircle(0, 0, r * 0.62);
      // Two internal arcs orbiting at different rates and in opposite
      // directions — the same vocabulary the flying orb uses, so the thing that
      // leaves his hand is recognisably the thing he was holding.
      g.lineStyle(2, 0xffd0d0, 0.5);
      g.beginPath(); g.arc(0, 0, r * 0.72, t * 1.5, t * 1.5 + 2.2); g.strokePath();
      g.lineStyle(2, 0xffffff, 0.4);
      g.beginPath(); g.arc(0, 0, r * 0.44, -t * 2.3, -t * 2.3 + 1.6); g.strokePath();
      // Tongues collapsing inward and reforming: the containment is his, and it
      // is working, but only just.
      g.lineStyle(2, 0xff4040, 0.45);
      for (let i = 0; i < 5; i++) {
        const a = t * 0.5 + (i / 5) * Math.PI * 2;
        const len = r * (1.00 + 0.20 * Math.sin(t * 2.4 + i * 1.9));
        g.lineBetween(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86,
                      Math.cos(a) * len,      Math.sin(a) * len);
      }
      // The core swells as the shell compresses — the energy is not shrinking,
      // it is being packed. Without the opposed pair it reads as fizzling out.
      g.fillStyle(0xffffff, 0.95); g.fillCircle(0, 0, r * (0.30 + 0.42 * launch));
      if (launch > 0) {
        // THE FRONT FORMS BEFORE THE VELOCITY DOES. Over the last beat the
        // sphere grows the same leading edge it will wear in flight, on the aim
        // it is about to be thrown along, while the shell stretches backward —
        // so the launch is a transformation of this object rather than the
        // substitution of a different one.
        //
        // That edge used to include a clean stroked arc across the front. It
        // was the same `)` handset review rejected on the flying orb, and it
        // was here for continuity WITH that motif — so it goes for the same
        // reason, replaced by the tongue vocabulary the flight now uses.
        const lx = Math.cos(this._aim), ly = Math.sin(this._aim);
        g.fillStyle(0xffffff, 0.55 * launch);
        g.fillCircle(lx * r * 0.9, ly * r * 0.9, r * 0.45 * launch);
        g.fillStyle(0xff8888, 0.40 * launch);
        g.fillCircle(lx * r * 1.5, ly * r * 1.5, r * 0.28 * launch);
        for (let i = 0; i < 3; i++) {
          const wob = Math.sin(t * (2.0 + i * 0.7) + i * 1.9);
          const off = i === 0 ? 0.09 * wob : (i === 1 ? -0.58 : 0.52) + 0.12 * wob;
          const a = this._aim + off;
          const len = r * (i === 0 ? 1.30 : 1.00) * launch + r * 0.06 * wob;
          const w = (i === 0 ? 0.28 : 0.19);
          g.fillStyle(i === 0 ? 0xffffff : 0xff7a5a, (i === 0 ? 0.6 : 0.4) * launch);
          g.fillTriangle(
            Math.cos(a - w) * r * 0.4, Math.sin(a - w) * r * 0.4,
            Math.cos(a + w) * r * 0.4, Math.sin(a + w) * r * 0.4,
            Math.cos(a) * len,         Math.sin(a) * len,
          );
        }
        g.fillStyle(0xff3030, 0.30 * launch);
        g.fillCircle(-lx * r * (0.5 + 0.5 * launch), -ly * r * (0.5 + 0.5 * launch),
                     r * 0.5 * launch);
      }
    } else if (this._absorbOrb) {
      this._absorbOrb.destroy();
      this._absorbOrb = null;
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
          if (this._comboT <= 0 && !this.isGuarding()) {
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
      // ── DUE IS NOT ACTIVE ────────────────────────────────────────────
      // The clock keeps its own cadence whatever else he is doing — it is
      // reset HERE, at the due moment, so a deferred DEFLECTION does not push
      // the next one out and does not cost him the 9s over again. All the
      // clock does is mark it owed.
      //
      // Handset footage, ~26-29s: he threw the saber, the reflect clock came
      // due mid-flight, the guard opened, and he parried bolts with a weapon
      // that was 500px away and visibly still spinning. The stance is the
      // blade; he cannot take a stance with a blade he does not have.
      if (this._reflectT <= 0) {
        this._reflectT = this._reflectEvery;
        this._reflectPending = true;
      }
      // Retried every frame, so the handoff is immediate: the beat the blade
      // is back in his hand is the beat the tell goes up.
      if (this._reflectPending && this.canOpenGuard()) {
        this._reflectPending = false;
        // CLAIMED FROM THE TELL, not from the open. Otherwise a SABER THROW
        // could start inside the 500ms warning — nothing forbade it, because
        // `isGuarding()` was still false — and the guard would open into an
        // empty hand anyway, one move later. The announcement is the
        // commitment, so the blade is reserved from the announcement.
        this._reflectClaimed = true;
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
          this._reflectClaimed = false;
          // Defence in depth. The claim above should make this unreachable —
          // nothing can take the blade off him between the tell and the open —
          // but if some future state ever does, the guard must not open into an
          // empty hand. It goes back to owed and re-tells when the blade is
          // back, rather than being lost.
          if (!this.hasSaber()) { this._reflectPending = true; return; }
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
    this._parryArc   = parryArcFor(angle);
    this._parryT     = BOSS_MECH.parryMs;
  }


  /**
   * The caught super's clock — and the saber's, for as long as he is throwing.
   *
   * Deliberately NOT inside `_tickMechanics`. That runs after the weapon block
   * in `preUpdate`, so a phase ticked there is one frame stale by the time the
   * blade is drawn from it: measured at ~20fps that was 90 degrees of blade,
   * and on the launch frame it meant the orb left while the blade was still
   * short of the throw line. Ticked here, immediately before the block that
   * draws the saber, the pose and the launch come from the same frame's
   * numbers — which is the whole claim the throw is making.
   *
   * Release first, intake second, and the two are mutually exclusive: while an
   * orb is winding up nothing new can commit, so however hard the player leans
   * on the button there is exactly one orb in the world at a time.
   */
  _tickSuperRelease(delta) {
    // The follow-through first, so the frame that starts it below gets its
    // full length rather than one delta less of it.
    if (this._followT > 0) {
      this._followT -= delta;
      if (this._followT <= 0) {
        this._followT = 0;
        this._sweepDir = 0;          // saber ownership returns to the AI here
        this.scene.events.emit('boss-super-sweep-end', this);
      }
    }
    if (this._releaseT > 0) {
      this._releaseT -= delta;
      // ── HE THROWS IT ───────────────────────────────────────────────────
      // The sweep is carved out of the tail of the anticipation, so the orb
      // still leaves at exactly the moment it always did. ONE CLOCK owns both
      // halves: the blade's phase is derived from `_releaseT` (see
      // `superSwing`) and the launch is this same countdown reaching zero, so
      // there is no second timer that can drift and no frame where the orb is
      // already travelling and the arm has not moved yet.
      if (this._sweepDir === 0 && this._releaseT <= BOSS_MECH.superSweepMs) {
        // Two mirrored sweeps, and the mirror is horizontal: whichever way he
        // is throwing, the blade winds up ABOVE the throw line and drives
        // down through it. A chop reads as force at handset scale in a way an
        // uppercut does not, and the pair covers every bearing without a
        // second eight-family registry — the gesture is a heave at a large
        // object, not the precision fencing PARRY_ARCS describes.
        this._sweepDir = Math.cos(this._aim) >= 0 ? -1 : 1;
        this.scene.events.emit('boss-super-sweep', this, this._sweepDir);
      }
      if (this._releaseT <= 0) {
        this._releaseT = 0;
        const n = this._releaseN;
        this._releaseN = 0;
        // The power frame. The blade is at the throw line travelling fastest
        // and the orb departs on the same tick, in this order, from this one
        // place.
        this._followT = BOSS_MECH.superFollowMs;
        this.scene.events.emit('boss-super-return', this, n);
      }
    } else if (this._absorbT > 0) {
      this._absorbT -= delta;
      if (this._absorbT <= 0 && this._absorbCount > 0) {
        this._absorbT  = 0;
        this._releaseN = this._absorbCount;
        this._absorbCount = 0;
        this._releaseT = BOSS_MECH.superReleaseMs;
        this.scene.events.emit('boss-super-charged', this, this._releaseN);
      }
    }
  }

  /**
   * The throw's phase, or null when he is not throwing.
   *
   * Derived, never stored: `_releaseT` counts the anticipation down and
   * `_followT` counts the finish down, and neither can disagree with the
   * launch because the launch is the boundary between them. `u` runs 0 -> 2
   * with the power frame at exactly 1.
   */
  superSwing() {
    if (this._sweepDir === 0) return null;
    const M = BOSS_MECH;
    if (this._releaseT > 0) {
      return { dir: this._sweepDir, u: 1 - this._releaseT / M.superSweepMs };
    }
    if (this._followT > 0) {
      return { dir: this._sweepDir, u: 2 - this._followT / M.superFollowMs };
    }
    return null;
  }

  /**
   * Catch a super pellet.
   *
   * Counts it and restarts the grace clock, so a five-pellet volley arriving
   * over ~60ms produces ONE answer rather than five. Never refuses: a pellet he
   * declined would fall through to the ordinary bat-back path carrying
   * `superDamage * player.dmgMult`, which is the unbounded return this whole
   * mechanic exists to remove. If an orb is already winding up, the new pellets
   * simply accumulate behind it — `_tickMechanics` only starts a release when
   * the previous one has left, so there is never more than one on the way.
   */
  absorbSuper() {
    this._absorbCount++;
    this._absorbT = BOSS_MECH.superAbsorbGraceMs;
    if (this._absorbCount === 1 && this._releaseT <= 0) {
      this.scene?.events.emit('boss-super-absorb-begin', this);
    }
    this.scene?.events.emit('boss-super-absorb', this, this._absorbCount);
    return true;
  }

  /** Pellets visibly gathered at his hands right now — absorbed or committed. */
  heldSuper() {
    return this._absorbCount + this._releaseN;
  }

  /**
   * Is the guard in charge of him?
   *
   * DEFLECTION owns his saber, so nothing that would also want to draw the
   * blade may start while it is up — a CHARGE with a parry sweeping sideways
   * out of it, or a SABER THROW with the blade somehow still batting bolts, are
   * two systems narrating opposite things about the same weapon. Holding a
   * caught super counts for the same reason: the energy is in his hands.
   *
   * It suppresses the START of an attack only. Anything already running plays
   * out — cancelling a swing halfway is a worse lie than finishing it.
   */
  isGuarding() {
    return this.alive
      && (this.isReflecting() || this._reflectClaimed
          || this._absorbCount > 0 || this._releaseT > 0 || this._followT > 0);
  }

  /**
   * ONE SABER, ONE OWNER — the physical half.
   *
   * The single authoritative answer to "is the blade in his hand right now",
   * and deliberately a statement about the WORLD rather than a list of move
   * ids. `_saberAway` is set by whatever has physically taken the weapon off
   * him (today that is only SABER THROW, which detaches `weaponSprite` and
   * flies it across the room) and cleared when it is caught, when the flight
   * is cancelled, or by the flight's own safety cutoff. A future move that
   * takes the blade away has one thing to do — set that flag — and every
   * consumer of this contract is correct for free. `if (saberThrow) return`
   * would have been a lie about the general case.
   *
   * The audit behind that claim: of the five scripted moves, SABER THROW is
   * the only one where the weapon leaves him. SABER COMBO and VANISH swing it,
   * and CHARGE and OVERHEAD SLAM (his own state machine) carry it — they own
   * the blade's ANIMATION for their duration, which `isGuarding` and the
   * `_performing` gate already arbitrate at the START of a move. They do not
   * dispossess him, and a parry is explicitly allowed to happen inside them
   * (it is a reflex, not an attack — see `parry`). FORCE PULL and FORCE PUSH
   * do not touch it at all. Blocking those would be blocking compatible
   * behaviour, which costs him offence for nothing.
   */
  hasSaber() {
    return this.alive && !this._saberAway && !!this.weaponSprite?.active;
  }

  /**
   * May DEFLECTION begin its tell right now?
   *
   * The gate the scheduler asks. Requires the blade AND requires that nothing
   * else already has the stance — a second tell inside an open guard would
   * announce a window he is already in.
   */
  canOpenGuard() {
    return !!this.scene && this.hasSaber() && !this.isGuarding();
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
    this._absorbOrb?.destroy(); this._absorbOrb = null;
    this.destroy();
  }
}
