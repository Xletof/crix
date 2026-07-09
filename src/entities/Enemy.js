import Phaser from 'phaser';
import { ENEMY } from '../config.js';
import { SFX } from '../systems/FX.js';

// ── AI state constants ────────────────────────────────────────────────────────
export const ST = {
  PATROL:     'patrol',     // walking assigned waypoints, unalerted
  ALERT:      'alert',      // just spotted player — brief freeze before combat
  CHASE:      'chase',      // (Grunt) running toward player for melee
  COVER_MOVE: 'cover_move', // (Shooter) moving toward claimed cover spot
  SUPPRESS:   'suppress',   // (Shooter) at cover, peek-firing at player
  REPOSITION: 'reposition', // (Shooter) moving to new cover (player too close)
  FLANK:      'flank',      // (Shooter) moving to a perpendicular flanking pos
  ADVANCE:    'advance',    // (Shooter) no cover with LOS — push forward until LOS
  SEARCH:     'search',     // moving to last known player position to search
};

// Detection constants (exported so GameScene can render vision cones)
export const VISION_RANGE = 380;   // px — unalerted patrol sight
export const VISION_HALF_ANGLE = Math.PI * 0.28; // ~50° each side = 100° total cone
const ALERT_VISION_RANGE = 720;    // px — max sight range once alerted (was infinite)
const ALARM_RANGE     = 72;        // px — player too close always triggers alarm
const SUPPRESS_FIRE_MIN = 1400;    // ms between peeks
const SUPPRESS_FIRE_MAX = 2200;
const REPOSITION_DIST   = 110;     // px — retreat from cover when player this close
const ARRIVE_THRESH     = 40;      // px — "close enough" to a target or stand position
const FLANK_DIST        = 260;     // px — how far off the LOS axis to flank
const ALERT_PAUSE_MS    = 500;     // ms surprised freeze before switching to combat
const STAND_DIST        = 92;      // px from cover centre to stand-and-fire position
const TAKEDOWN_RANGE    = 80;      // px — how close the player must be to take down
const TAKEDOWN_REAR_ARC = 1.62;    // rad — player must be within the enemy's rear arc (~174°)
const LOS_LOST_RECLAIM  = 900;     // ms of no-LOS in SUPPRESS before re-picking cover
const LOS_LOST_ADVANCE  = 1500;    // ms of no-LOS in COVER_MOVE before going ADVANCE

// ── Base Enemy class ──────────────────────────────────────────────────────────
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture, cfg, spec = {}) {
    super(scene, x, y, texture, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.cfg          = cfg;
    this.spec         = spec;          // original room spec entry
    this.coverRegistry = null;         // injected by GameScene after construction

    this.setDepth(28);
    this.body.setCircle(cfg.radius, this.width / 2 - cfg.radius, this.height / 2 - cfg.radius);
    this.body.setCollideWorldBounds(true);

    this.hp     = cfg.hp;
    this.hpMax  = cfg.hp;
    this.alive  = true;
    this.hiddenInBush = false;

    // Aim angle stored as data — body sprite NEVER rotates; the weapon
    // overlay (see _setupWeapon) rotates to this angle instead.
    this._aim = -Math.PI / 2;
    // Stagger window: how many ms the AI is suspended after a knockback hit,
    // so the body actually slides instead of being immediately re-glued by
    // setVelocity in the next AI tick.
    this._staggerMs = 0;

    // Animation
    this._animPrefix   = texture;
    this._fireAnimTimer = 0;
    this.recoilT        = 0;

    // AI shared state — idle enemies (no patrol) still start PATROL (stand & scan).
    // Only enemies explicitly flagged spec.alerted:true boot straight into combat.
    this.state         = spec.alerted ? ST.ALERT : ST.PATROL;
    this.patrolPath    = spec.patrol || [];
    this.patrolIdx     = 0;
    this.patrolWait    = 0;          // ms
    const _p = spec.alerted && scene.player?.alive ? scene.player : null;
    this.lastKnownX    = _p ? _p.x : x;
    this.lastKnownY    = _p ? _p.y : y;
    this.hasSeenPlayer = false;
    this.lostTrackMs   = 0;

    this.shadow = scene.add.image(x, y + 14, 'shadow').setDepth(this.depth - 1).setAlpha(0.35);
    this.hpBar  = scene.add.graphics().setDepth(this.depth + 1);
    this.hpBar.visible = false;

    // Threat ring — red halo under the enemy so it pops on a dark floor.
    // Shadows the player's cyan "you are here" ring.
    const ringColor = spec.alerted ? 0xff3030 : 0xff5040;
    this.threatRing = scene.add.graphics().setDepth(this.depth - 2);
    this.threatRing.fillStyle(ringColor, 0.16);
    this.threatRing.fillCircle(0, 0, cfg.radius + 12);
    this.threatRing.lineStyle(2, ringColor, 0.65);
    this.threatRing.strokeCircle(0, 0, cfg.radius + 6);
    this.threatRing.setPosition(x, y);
    this._ringPulse = Math.random() * Math.PI * 2;

    // Baseline scale (1.0)
    this.setScale(1.0);

    // "!" alert indicator (shown briefly when spotting player)
    this.alertMark = scene.add.text(x, y - cfg.radius - 24, '!', {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffff20',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(this.depth + 2).setAlpha(0);

    if (scene.anims.exists(`${texture}-idle-front`)) this.play(`${texture}-idle-front`);
  }

  // ── External API ─────────────────────────────────────────────────────────

  damage(amount, knockbackVec = null) {
    if (!this.alive) return;
    const wasPatrolling = this.state === ST.PATROL;
    this.hp = Math.max(0, this.hp - amount);
    if (knockbackVec) {
      this.body.setVelocity(
        this.body.velocity.x + knockbackVec.x,
        this.body.velocity.y + knockbackVec.y,
      );
      // Pause AI for a few frames so the slide is actually visible.
      // 90ms ≈ ~5 frames at 60fps, long enough for a satisfying shove.
      this._staggerMs = 90;
    }
    this.recoilT = 80;

    // Stealth-kill logic: if a patrolling enemy is killed AND the player
    // is hidden in cover/bush, the room never goes loud.
    const player = this.scene.player;
    const killed = this.hp <= 0;
    const playerHidden = !!player?.hiddenInBush;

    if (wasPatrolling) {
      if (killed && playerHidden) {
        // Silent kill — count it for the HUD
        this.scene.events.emit('stealth-kill');
      } else {
        // Loud — broadcast alarm
        this._triggerAlarm();
      }
    }

    this.scene.events.emit('enemy-hit', this, amount);
    if (killed) this.die();
  }

  die() {
    this.alive = false;
    this.coverRegistry?.release(this);
    SFX.enemyDie();
    this.scene.events.emit('enemy-died', this);
    // Combat UI off immediately.
    this.hpBar.destroy();
    this.alertMark.destroy();
    this.threatRing?.destroy();
    this.weaponSprite?.destroy();
    // Corpse slide: keep the body sprite around for ~350ms, carrying its
    // current knockback velocity (drag bleeds it down), then fade and clean.
    this.body.setDrag(900, 900);
    // Stop colliding with bullets — alive=false already gates the loop,
    // but disabling the body avoids any residual physics surprises.
    this.body.checkCollision.none = true;
    // Dead bodies drop below the live Y-sort layer entirely so live actors
    // always draw above them (corpse depth = world.y - 2000).
    this.setDepth(this.y - 2000);
    if (this.shadow?.active) this.shadow.setDepth(this.y - 2001);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 380,
      delay: 60,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.shadow?.destroy();
        this.destroy();
      },
    });
  }

  // True if this enemy can be silently taken down right now: it must still be
  // unalerted (PATROL) and the player must be close and within its rear arc.
  isBackstabbable(player) {
    if (!this.alive || this.state !== ST.PATROL) return false;
    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > TAKEDOWN_RANGE) return false;
    const angleToPlayer = Math.atan2(dy, dx);
    const facing = this._aim;
    const diff = Math.abs(Phaser.Math.Angle.Wrap(angleToPlayer - facing));
    return diff > TAKEDOWN_REAR_ARC; // player is behind the enemy
  }

  // Instant, silent elimination from a stealth takedown — never raises the alarm.
  stealthKill() {
    if (!this.alive) return;
    this.hp = 0;
    this.scene.events.emit('stealth-kill');
    if (this.scene && typeof this.scene.alertEnemiesNear === 'function') {
      this.scene.alertEnemiesNear(this.x, this.y, 80);
    }
    this.die();
  }

  canSee(player) {
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    const isCloseEnoughInBush = player.hiddenInBush && dist < 38;
    const isRevealedInBush = player.hiddenInBush && player.revealTimer > 0;

    if (player.hiddenInBush && !isCloseEnoughInBush && !isRevealedInBush) return false;

    if (this.state === ST.PATROL) {
      if (dist > VISION_RANGE) return false;
      const angleTo = Math.atan2(player.y - this.y, player.x - this.x);
      const facing  = this._aim;
      const diff    = Phaser.Math.Angle.Wrap(angleTo - facing);
      if (Math.abs(diff) >= VISION_HALF_ANGLE) return false;
      return this._hasLOS(this.x, this.y, player.x, player.y);
    }
    // Alerted: 360° vision but still capped at ALERT_VISION_RANGE and gated by walls.
    if (dist > ALERT_VISION_RANGE) return false;
    return this._hasLOS(this.x, this.y, player.x, player.y);
  }

  // True if a straight line from (x1,y1) to (x2,y2) is unobstructed by any
  // static body in the scene's walls group (which holds both blast doors and
  // solid cover sprites). We exclude bodies the line *starts* or *ends*
  // inside so an enemy isn't blinded by its own cover.
  _hasLOS(x1, y1, x2, y2) {
    const walls = this.scene.walls?.getChildren?.() ?? [];
    if (!walls.length) return true;
    const line = new Phaser.Geom.Line(x1, y1, x2, y2);
    for (const w of walls) {
      if (!w.active || !w.body) continue;
      const b = w.body;
      // Skip if endpoint is inside this body
      if (x1 >= b.x && x1 <= b.x + b.width && y1 >= b.y && y1 <= b.y + b.height) continue;
      if (x2 >= b.x && x2 <= b.x + b.width && y2 >= b.y && y2 <= b.y + b.height) continue;
      const rect = new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
      if (Phaser.Geom.Intersects.LineToRectangle(line, rect)) return false;
    }
    return true;
  }

  // Compute the best stand-and-fire position around `spot` for shooting at
  // (px, py). Tries 8 directions around the cover; picks the closest one
  // with clear LOS to the target. Returns null if none have LOS.
  _computeStandPos(spot, px, py) {
    if (!spot) return null;
    const { w, h } = this.scene.roomSpec?.bounds ?? { w: 1600, h: 1600 };
    // Base axis from the spot toward the player; the candidate placed on the
    // *player side* (angle = base) is closest to the player and has the best
    // LOS odds, while the opposite side is the most "behind cover".
    const base = Math.atan2(py - spot.y, px - spot.x);
    // 8 candidates around the cover: perpendicular sides first (good cover
    // AND LOS), then player-side leans, then behind-cover positions.
    const offsets = [
      Math.PI / 2, -Math.PI / 2,           // perpendicular L / R
      Math.PI / 4, -Math.PI / 4,           // player-side leans (45°)
      3 * Math.PI / 4, -3 * Math.PI / 4,   // cover-side corners
      0,                                    // directly between cover and player (worst cover, best LOS)
      Math.PI,                              // directly behind cover (worst LOS, best cover)
    ];
    for (const offset of offsets) {
      const angle = base + offset;
      const cx = Phaser.Math.Clamp(spot.x + Math.cos(angle) * STAND_DIST, 60, w - 60);
      const cy = Phaser.Math.Clamp(spot.y + Math.sin(angle) * STAND_DIST, 60, h - 60);
      if (this._hasLOS(cx, cy, px, py)) return { x: cx, y: cy };
    }
    return null;
  }

  // ── Alarm system ─────────────────────────────────────────────────────────

  _triggerAlarm(noisy = false) {
    if (this.state !== ST.PATROL) return;
    const player = this.scene.player;
    if (player?.alive) { this.lastKnownX = player.x; this.lastKnownY = player.y; }
    this.state      = ST.ALERT;
    this.alertTimer = ALERT_PAUSE_MS;
    this._flashAlertMark(noisy ? '?' : '!');
    
    // Local alert propagation within 250px
    if (this.scene && typeof this.scene.alertEnemiesNear === 'function') {
      this.scene.alertEnemiesNear(this.x, this.y, 250);
    }
    
    // Trigger global sirens / reinforcement timers
    this.scene.events.emit('room-alarm-klaxon');
    SFX.uiClick();
  }

  calmDown() {
    if (this.state === ST.PATROL) return;
    this.state = ST.PATROL;
    this.lostTrackMs = 0;
    this.hasSeenPlayer = false;
    this.setVelocity(0, 0);
    this._flashAlertMark('?'); // Show confusion marker
    if (this.coverSpot) {
      this.coverRegistry?.release(this);
      this.coverSpot = null;
      this.standPos = null;
    }
  }

  _flashAlertMark(glyph = '!') {
    this.alertMark.setText(glyph);
    this.alertMark.setAlpha(1).setScale(0.4);
    this.scene.tweens.add({
      targets: this.alertMark,
      scale: 1.2,
      alpha: { from: 1, to: 0 },
      duration: 700,
      ease: 'Back.easeOut',
    });
  }

  // ── Shared movement helper ────────────────────────────────────────────────

  _moveToward(tx, ty, speed) {
    const dx = tx - this.x, dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) { this.setVelocity(0, 0); return dist; }
    // Stuck recovery: if a perpendicular sidestep is active, apply it instead
    if (this._stuckSidestepMs > 0) {
      const perp = Math.atan2(dy, dx) + (this._stuckSideDir || 1) * Math.PI / 2;
      this.setVelocity(Math.cos(perp) * speed * 1.1, Math.sin(perp) * speed * 1.1);
      return dist;
    }
    this.setVelocity((dx / dist) * speed, (dy / dist) * speed);
    this._aim = Math.atan2(dy, dx);
    return dist;
  }

  _navigatePath(tx, ty, speed, delta) {
    this._pathTimer = (this._pathTimer || 0) + delta;
    const lastTarget = this._pathLastTarget || { x: 0, y: 0 };
    const targetMoved = Math.hypot(tx - lastTarget.x, ty - lastTarget.y) > 40;

    if (!this._currentPath || this._currentPath.length === 0 || targetMoved || this._pathTimer > 300) {
      this._currentPath = this.scene.navGrid.findPath(this.x, this.y, tx, ty);
      this._pathNodeIdx = 0;
      this._pathTimer = 0;
      this._pathLastTarget = { x: tx, y: ty };
    }

    if (this._currentPath && this._currentPath.length > 0) {
      let node = this._currentPath[this._pathNodeIdx];
      while (node && Math.hypot(node.x - this.x, node.y - this.y) < 30) {
        this._pathNodeIdx++;
        node = this._currentPath[this._pathNodeIdx];
      }
      if (node) {
        return this._moveToward(node.x, node.y, speed);
      }
    }
    return this._moveToward(tx, ty, speed);
  }

  _facePoint(tx, ty) {
    this._aim = Math.atan2(ty - this.y, tx - this.x);
  }

  _stopAndFace(tx, ty) {
    this.setVelocity(0, 0);
    this._facePoint(tx, ty);
  }

  // ── Patrol walking ────────────────────────────────────────────────────────

  _tickPatrol(delta, player) {
    // Proximity alarm: player sneaking behind (within TAKEDOWN_REAR_ARC) is NOT
    // sensed. Anyone else is sensed within ALARM_RANGE (90px) if not in a bush,
    // or touch range (38px) if they are in a bush.
    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const facing = this._aim;
    const rearDiff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - facing));
    const sneakingBehind = rearDiff > TAKEDOWN_REAR_ARC;
    
    const isProximityAlert = player.hiddenInBush
      ? (dist < 38) // Touch range when player is in bush
      : (dist < ALARM_RANGE && !sneakingBehind); // Standard range/angle when visible

    if (isProximityAlert) {
      this.lastKnownX = player.x;
      this.lastKnownY = player.y;
      this._triggerAlarm(true); // heard/sensed → "?"
      return;
    }
    if (this.canSee(player)) {
      this.lastKnownX = player.x;
      this.lastKnownY = player.y;
      this._triggerAlarm(false); // spotted → "!"
      return;
    }

    if (!this.patrolPath.length) {
      // No patrol path — stand idle and scan back and forth
      this.setVelocity(0, 0);
      this._scanTimer = (this._scanTimer || 0) + delta;
      const baseFacing = this.spec.facing !== undefined ? this.spec.facing : -Math.PI / 2;
      this._aim = baseFacing + Math.sin(this._scanTimer * 0.0015) * (Math.PI / 3);
      return;
    }

    if (this.patrolWait > 0) {
      this.patrolWait -= delta;
      this.setVelocity(0, 0);
      return;
    }

    const wp = this.patrolPath[this.patrolIdx];
    const d  = this._navigatePath(wp.x, wp.y, this.cfg.speed * 0.55, delta);
    if (d < ARRIVE_THRESH) {
      this.patrolIdx  = (this.patrolIdx + 1) % this.patrolPath.length;
      this.patrolWait = Phaser.Math.Between(400, 900);
    }
  }

  // ── Shared alert tick ─────────────────────────────────────────────────────

  _tickAlert(delta) {
    this.alertTimer -= delta;
    this._stopAndFace(this.lastKnownX, this.lastKnownY);
    return this.alertTimer <= 0; // returns true when ready to transition
  }

  // ── Shared search tick ────────────────────────────────────────────────────

  _tickSearch(delta, player) {
    const sees = this.canSee(player);
    if (sees) {
      this.lastKnownX = player.x;
      this.lastKnownY = player.y;
      this.state = (this instanceof EnemyGrunt) ? ST.CHASE : ST.COVER_MOVE;
      if (this instanceof EnemyShooter) {
        this._claimCover(player);
      }
      return;
    }

    const dist = this._navigatePath(this.lastKnownX, this.lastKnownY, this.cfg.speed * 0.75, delta);

    if (dist < ARRIVE_THRESH) {
      this.setVelocity(0, 0);
      this._scanTimer = (this._scanTimer || 0) + delta;
      const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
      this._aim = baseAngle + Math.sin(this._scanTimer * 0.0025) * (Math.PI / 3);
    }
  }

  // ── Common preUpdate bookkeeping ──────────────────────────────────────────

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta);
    // Dead bodies just slide+fade via tween — the UI is gone, skip updates.
    if (!this.alive) {
      if (this.shadow?.active) this.shadow.setPosition(this.x, this.y + 18);
      return;
    }
    // Stagger decay — bleed velocity off so the knockback slide ends smoothly.
    if (this._staggerMs > 0) {
      this._staggerMs -= delta;
      this.body.velocity.x *= 0.85;
      this.body.velocity.y *= 0.85;
    }
    // Y-sort: depth tracks world Y so this entity occludes / is occluded by
    // others based on its position. Related sprites ride small offsets.
    this.setDepth(this.y);
    this.hpBar.setDepth(this.y + 1);
    this.alertMark.setDepth(this.y + 2);
    if (this.threatRing) this.threatRing.setDepth(this.y - 2);

    // Reactive shadow — drifts in the velocity direction (motion cue) and
    // squashes during stagger (weight cue).
    const sVx = this.body.velocity.x;
    const sVy = this.body.velocity.y;
    const sDx = Phaser.Math.Clamp(sVx * 0.012, -3, 3);
    const sDy = Phaser.Math.Clamp(sVy * 0.008, -2, 2);
    const sSq = this._staggerMs > 0 ? 0.85 : 1;
    this.shadow.setPosition(this.x + sDx, this.y + 18 + sDy);
    this.shadow.setScale(sSq, sSq);
    this.shadow.setDepth(this.y - 1);
    this.alertMark.setPosition(this.x, this.y - this.cfg.radius - 24);
    this.updateHpBar();
    this.setAlpha(this.hiddenInBush ? 0.55 : 1);

    // Weapon overlay (rotates to the aim angle — body never rotates)
    if (this.weaponSprite) {
      const offset = this.cfg.radius - 4;
      this.weaponSprite.x = this.x + Math.cos(this._aim) * offset;
      this.weaponSprite.y = this.y + Math.sin(this._aim) * offset;
      this.weaponSprite.rotation = this._aim;
      this.weaponSprite.setFlipY(Math.abs(this._aim) > Math.PI / 2);
      this.weaponSprite.setAlpha(this.alive ? (this.hiddenInBush ? 0.55 : 1) : 0);
      
      const degEnemy = Phaser.Math.RadToDeg(this._aim);
      const isFacingNorth = (degEnemy < -45 && degEnemy > -135);
      this.weaponSprite.setDepth(isFacingNorth ? this.y - 1 : this.y + 1);
    }

    // Threat ring tracks position + soft pulse; dims when enemy is hidden.
    if (this.threatRing) {
      this._ringPulse += delta * 0.006;
      const pulse = 0.92 + 0.08 * Math.sin(this._ringPulse);
      this.threatRing.setPosition(this.x, this.y).setScale(pulse);
      this.threatRing.setAlpha(this.hiddenInBush ? 0.25 : 1);
    }

    // Combat state tracking & Calm Down transition
    const player = this.scene.player;
    if (this.state !== ST.PATROL && this.state !== ST.ALERT) {
      if (player && player.alive && this.canSee(player)) {
        this.lostTrackMs = 0;
      } else {
        this.lostTrackMs = (this.lostTrackMs || 0) + delta;
        if (this.lostTrackMs > 6000) {
          this.calmDown();
        }
      }
    } else {
      this.lostTrackMs = 0;
    }

    // Animation frame selection
    const speedSq   = this.body.velocity.x ** 2 + this.body.velocity.y ** 2;
    const isMoving  = speedSq > 200;
    const prefix    = this._animPrefix;

    let dirSuffix = 'front';
    let flipX = false;
    const deg = Phaser.Math.RadToDeg(this._aim);
    if (deg >= -45 && deg <= 45) {
      dirSuffix = 'side';
      flipX = false; // facing East
    } else if (deg > 45 && deg < 135) {
      dirSuffix = 'front';
      flipX = false; // facing South
    } else if (deg >= 135 || deg <= -135) {
      dirSuffix = 'side';
      flipX = true;  // facing West
    } else {
      dirSuffix = 'back';
      flipX = false; // facing North
    }

    this.setFlipX(flipX);

    let animKey = `${prefix}-idle-${dirSuffix}`;
    if (this._fireAnimTimer > 0) {
      this._fireAnimTimer -= delta;
      animKey = `${prefix}-fire-${dirSuffix}`;
    } else if (isMoving) {
      animKey = `${prefix}-walk-${dirSuffix}`;
    }

    if (this.anims.currentAnim?.key !== animKey) {
      this.play(animKey);
    }

    // Recoil scale + lean animations
    if (this._staggerMs > 0) {
      const phase = (90 - this._staggerMs) * 0.22;
      const w = Math.sin(phase) * 0.10;
      this.setScale(1.0 * (1 + w), 1.0 * (1 - w));
      this.angle = 0;
    } else if (this.recoilT > 0) {
      this.recoilT -= delta;
      this.setScale(1.0 * (1 - Math.max(0, this.recoilT / 80) * 0.12));
      this.angle = 0;
    } else if (this.alive && isMoving) {
      this.angle = 0;
      this.setScale(1.0);
    } else {
      this.angle = 0;
      this.setScale(1.0);
    }

    // ── Stuck-state recovery ────────────────────────────────────────────────
    // If we're in a movement state but physics keeps stopping us (wall/cover),
    // fire a brief perpendicular sidestep burst to escape the geometry.
    const _inMoveState = (
      this.state === ST.CHASE || this.state === ST.COVER_MOVE ||
      this.state === ST.REPOSITION || this.state === ST.FLANK
    );
    if (_inMoveState) {
      this._stuckSidestepMs = (this._stuckSidestepMs || 0) - delta;
      this._stuckTimer      = (this._stuckTimer || 0) + delta;
      if (this._stuckTimer >= 600) {
        const moved = Math.hypot(
          this.x - (this._stuckRefX ?? this.x),
          this.y - (this._stuckRefY ?? this.y)
        );
        if (moved < 12) {
          this._stuckSidestepMs = 600;
          this._stuckSideDir   = Math.random() < 0.5 ? 1 : -1;
        }
        this._stuckTimer = 0;
        this._stuckRefX  = this.x;
        this._stuckRefY  = this.y;
      }
    } else {
      this._stuckSidestepMs = 0;
      this._stuckTimer      = 0;
      this._stuckRefX       = this.x;
      this._stuckRefY       = this.y;
    }
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
    const col = this._animPrefix === 'shooter'
      ? 0x00bbff
      : (ratio > 0.4 ? 0x20ee20 : 0xee2020);
    this.hpBar.fillStyle(col, 1);
    this.hpBar.fillRect(bx, by, w * ratio, h);
  }
}

// ── Stormtrooper Grunt ────────────────────────────────────────────────────────
// States: PATROL → ALERT → CHASE
// Chases and melees. Last-known-position tracking when player hides.
export class EnemyGrunt extends Enemy {
  constructor(scene, x, y, spec = {}) {
    super(scene, x, y, 'grunt', ENEMY.grunt, spec);
    this.lastMeleeAt = 0;
    // Grunts are melee chasers — no weapon overlay. The body silhouette
    // alone reads as a charging trooper.
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.alive) return;
    // Suspend AI while staggered so the knockback slide reads on screen.
    if (this._staggerMs > 0) return;
    const player = this.scene.player;
    if (!player?.alive) { this.setVelocity(0, 0); return; }

    switch (this.state) {
      case ST.PATROL:
        this._tickPatrol(delta, player);
        break;

      case ST.ALERT:
        if (this._tickAlert(delta)) this.state = ST.CHASE;
        break;

      case ST.CHASE:
        this._tickChase(time, player, delta);
        break;

      case ST.SEARCH:
        this._tickSearch(delta, player);
        break;
    }
  }

  _tickChase(time, player, delta) {
    const sees = this.canSee(player);
    if (sees) {
      this.lastKnownX = player.x;
      this.lastKnownY = player.y;
      this.hasSeenPlayer = true;
    } else {
      this.state = ST.SEARCH;
      this._scanTimer = 0;
      return;
    }

    this._navigatePath(player.x, player.y, this.cfg.speed, delta);
    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);

    if (sees && distToPlayer < this.cfg.meleeRange) {
      this.setVelocity(0, 0);
      if (time - this.lastMeleeAt > this.cfg.meleeCooldownMs) {
        this.lastMeleeAt     = time;
        this._fireAnimTimer  = 200;
        // Knock the player away from the grunt on each melee swing.
        const dirAwayFromGrunt = Math.atan2(player.y - this.y, player.x - this.x);
        player.damage(this.cfg.meleeDamage, dirAwayFromGrunt);
        this.scene.events.emit('grunt-melee', this);
      }
    }
  }
}

// ── Death Trooper Shooter ─────────────────────────────────────────────────────
// States: PATROL → ALERT → COVER_MOVE → SUPPRESS → (REPOSITION | FLANK)
//
// Suppress: stands at cover, fires every 1.4–2.2 s.
// Reposition: if player walks within REPOSITION_DIST, flee to new cover.
// Flank: if spec.role === 'flanker', after ALERT it computes a perpendicular
//        position and moves there instead of the nearest cover.
export class EnemyShooter extends Enemy {
  constructor(scene, x, y, spec = {}) {
    super(scene, x, y, 'shooter', ENEMY.shooter, spec);
    this.fireCd       = Phaser.Math.Between(800, this.cfg.fireCooldownMs);
    this.coverSpot    = null;
    this.flankTarget  = null;
    this.flankHoldMs  = 0;
    this.role         = spec.role || 'suppress'; // 'suppress' | 'flanker'
    // Heavy DT-29 blaster overlay
    this.weaponSprite = scene.add.image(x, y, 'wpn-enemy-rifle')
      .setDepth(this.depth + 1).setOrigin(0.15, 0.5).setScale(1.0);
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.alive) return;
    // Suspend AI while staggered so the knockback slide reads on screen.
    if (this._staggerMs > 0) return;
    const player = this.scene.player;
    if (!player?.alive) { this.setVelocity(0, 0); return; }

    switch (this.state) {
      case ST.PATROL:
        this._tickPatrol(delta, player);
        break;

      case ST.ALERT:
        if (this._tickAlert(delta)) {
          if (this.role === 'flanker') {
            this.state = ST.FLANK;
            this._computeFlankTarget(player);
          } else {
            this.state = ST.COVER_MOVE;
            this._claimCover(player);
          }
        }
        break;

      case ST.COVER_MOVE:
        this._tickCoverMove(delta, player);
        break;

      case ST.SUPPRESS:
        this._tickSuppress(delta, player);
        break;

      case ST.REPOSITION:
        this._tickReposition(delta, player);
        break;

      case ST.FLANK:
        this._tickFlank(delta, player);
        break;

      case ST.ADVANCE:
        this._tickAdvance(delta, player);
        break;

      case ST.SEARCH:
        this._tickSearch(delta, player);
        break;
    }
  }

  // ── Cover claiming ──────────────────────────────────────────────────────

  // Claim a cover spot whose computed stand position has LOS to the player.
  // Iterates nearest-first; if no cover yields LOS, sets coverSpot to null
  // and the caller should drop to ADVANCE.
  _claimCover(player) {
    this.coverRegistry?.release(this);
    this.standPos = null;
    if (!this.coverRegistry) { this.coverSpot = null; return; }

    let pickedStand = null;
    const spot = this.coverRegistry.claimFirstValid(this, (s) => {
      const stand = this._computeStandPos(s, player.x, player.y);
      if (stand) { pickedStand = stand; return true; }
      return false;
    });
    this.coverSpot = spot;
    this.standPos  = pickedStand;
  }

  // For repositioning: find the cover farthest from the player that also has
  // a LOS-clear stand position. Falls back to whatever is farthest.
  _claimFarCover(player) {
    this.coverRegistry?.release(this);
    this.standPos = null;
    if (!this.coverRegistry) { this.coverSpot = null; return; }

    // Rank by distance from player (farthest first)
    const ranked = this.coverRegistry.spots
      .filter((s) => s.owner === null || s.owner === this)
      .map((s) => ({ s, d: Math.hypot(s.x - player.x, s.y - player.y) }))
      .sort((a, b) => b.d - a.d);
    for (const { s } of ranked) {
      const stand = this._computeStandPos(s, player.x, player.y);
      if (stand) { s.owner = this; this.coverSpot = s; this.standPos = stand; return; }
    }
    // No LOS-clear option — take the farthest spot anyway
    if (ranked.length) {
      const s = ranked[0].s;
      s.owner = this;
      this.coverSpot = s;
      this.standPos  = { x: s.x, y: s.y };
    }
  }

  // ── COVER_MOVE: walk to the stand position beside the claimed spot ──────

  _tickCoverMove(delta, player) {
    // No cover with LOS — go ADVANCE so we push forward instead of standing
    // pressed against a useless wall.
    if (!this.coverSpot || !this.standPos) {
      this.state             = ST.ADVANCE;
      this._advanceTimer     = 0;
      this._advWallFollowMs  = 0;
      this._advWallFollowDir = 0;
      this._advStuckTimer    = 0;
      this._advRefX          = undefined;
      this._advRefY          = undefined;
      return;
    }
    const dist = this._navigatePath(this.standPos.x, this.standPos.y, this.cfg.speed, delta);
    if (dist < ARRIVE_THRESH) {
      this.state = ST.SUPPRESS;
      this._losLostMs = 0;
    }
    // Fire-of-opportunity (only if we actually have LOS now)
    this._maybeFireAt(delta, player);

    // Safety net: if we can't reach the stand position for too long, ADVANCE.
    this._coverMoveStuckMs = (this._coverMoveStuckMs || 0) + delta;
    if (this._coverMoveStuckMs > LOS_LOST_ADVANCE) {
      this._coverMoveStuckMs = 0;
      this.state             = ST.ADVANCE;
      this._advanceTimer     = 0;
      this._advWallFollowMs  = 0;
      this._advWallFollowDir = 0;
      this._advStuckTimer    = 0;
      this._advRefX          = undefined;
      this._advRefY          = undefined;
    }
  }

  // ── SUPPRESS: hold stand position, peek-fire at player ─────────────────

  _tickSuppress(delta, player) {
    const sees = this.canSee(player);
    if (sees) {
      this.lastKnownX = player.x;
      this.lastKnownY = player.y;
      this._losLostMs = 0;
    } else {
      this._losLostMs = (this._losLostMs || 0) + delta;
    }

    const holdX  = this.standPos?.x ?? this.coverSpot?.x ?? this.x;
    const holdY  = this.standPos?.y ?? this.coverSpot?.y ?? this.y;
    const dHold  = Math.hypot(this.x - holdX, this.y - holdY);
    if (dHold > ARRIVE_THRESH * 1.5) {
      this._navigatePath(holdX, holdY, this.cfg.speed * 0.8, delta);
    } else {
      this._stopAndFace(this.lastKnownX, this.lastKnownY);
    }

    this._maybeFireAt(delta, player);

    // LOST LOS for too long — try a fresh cover with LOS (which may also pick
    // a brand new stand position around the same cover spot). If even that
    // fails, drop to ADVANCE.
    if (this._losLostMs > LOS_LOST_RECLAIM) {
      this._losLostMs = 0;
      this._claimCover(player);
      if (!this.standPos) {
        this.state = ST.SEARCH;
        this._scanTimer = 0;
      } else {
        this.state = ST.COVER_MOVE;
        this._coverMoveStuckMs = 0;
      }
    }

    if (Math.hypot(player.x - this.x, player.y - this.y) < REPOSITION_DIST) {
      this.state = ST.REPOSITION;
    }
  }

  // ── REPOSITION: release current cover, find a new one ──────────────────

  _tickReposition(delta, player) {
    if (!this._repositioning) {
      this._repositioning = true;
      this._claimFarCover(player);
    }
    if (!this.coverSpot || !this.standPos) {
      const dx = this.x - player.x, dy = this.y - player.y;
      const d  = Math.hypot(dx, dy) || 1;
      this.setVelocity((dx / d) * this.cfg.speed, (dy / d) * this.cfg.speed);
      if (Math.hypot(player.x - this.x, player.y - this.y) > REPOSITION_DIST * 2) {
        this._repositioning = false;
        this.state = ST.SUPPRESS;
      }
      return;
    }
    const dist = this._navigatePath(this.standPos.x, this.standPos.y, this.cfg.speed, delta);
    if (dist < ARRIVE_THRESH) {
      this._repositioning = false;
      this.state = ST.SUPPRESS;
      this._losLostMs = 0;
    }
  }

  // ── ADVANCE: no cover with LOS — push toward the player until we regain LOS,
  // then try to claim cover again.
  //
  // Navigation strategy: straight-line toward target, but track progress every
  // 500 ms. If we moved <10 px (wall in the way), commit to skirting the wall
  // in a consistent perpendicular direction for 1 s — long enough to clear a
  // corner. Direction flips on each new stuck episode so we don't stay trapped.
  _tickAdvance(delta, player) {
    this._advanceTimer = (this._advanceTimer || 0) + delta;
    const sees = this.canSee(player);
    if (sees) {
      this.lastKnownX = player.x;
      this.lastKnownY = player.y;
      this._claimCover(player);
      if (this.coverSpot && this.standPos) {
        this.state             = ST.COVER_MOVE;
        this._coverMoveStuckMs = 0;
        return;
      }
    }
    this._maybeFireAt(delta, player);

    const tx = sees ? player.x : this.lastKnownX;
    const ty = sees ? player.y : this.lastKnownY;

    const dist = this._navigatePath(tx, ty, this.cfg.speed * 0.78, delta);
    if (!sees && dist < ARRIVE_THRESH) {
      this.state = ST.SEARCH;
      this._scanTimer = 0;
    }
  }

  // ── FLANK: move to a perpendicular position and fire ───────────────────

  _computeFlankTarget(player) {
    // Compute a position 90° off the axis from this enemy to the player.
    // Pick whichever side is farther from any wall (rough heuristic).
    const dx  = player.x - this.x, dy = player.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const candidates = [];
    for (const side of [1, -1]) {
      const px = (-dy / len) * side;
      const py = (dx  / len) * side;
      candidates.push({
        x: player.x + px * FLANK_DIST,
        y: player.y + py * FLANK_DIST,
        side,
      });
    }
    // Clamp + score by distance from current pos (prefer the closer one)
    const { w, h } = this.scene.roomSpec?.bounds ?? { w: 1600, h: 1600 };
    let best = null, bestScore = Infinity;
    for (const c of candidates) {
      c.x = Phaser.Math.Clamp(c.x, 80, w - 80);
      c.y = Phaser.Math.Clamp(c.y, 80, h - 80);
      const score = Math.hypot(c.x - this.x, c.y - this.y);
      if (score < bestScore) { bestScore = score; best = c; }
    }
    this.flankTarget = best || { x: player.x || this.x, y: player.y || this.y };
    if (!this.flankTarget || isNaN(this.flankTarget.x) || isNaN(this.flankTarget.y)) {
      this.flankTarget = { x: this.x, y: this.y };
    }
    this._flankRefX  = player.x || this.x;
    this._flankRefY  = player.y || this.y;
    this._flankRecomputeCd = 1200; // ms
  }

  _tickFlank(delta, player) {
    const sees = this.canSee(player);
    if (sees) { this.lastKnownX = player.x; this.lastKnownY = player.y; }

    if (!this.flankTarget) {
      this._computeFlankTarget(player);
    }
    if (!this.flankTarget) {
      this.flankTarget = { x: player.x || this.x, y: player.y || this.y };
    }

    // Recompute target if player has moved >180px since last computation
    this._flankRecomputeCd -= delta;
    if (this._flankRecomputeCd <= 0) {
      const pdx = (player.x || this.x) - this._flankRefX;
      const pdy = (player.y || this.y) - this._flankRefY;
      if (Math.hypot(pdx, pdy) > 180) {
        this._computeFlankTarget(player);
      } else {
        this._flankRecomputeCd = 1200;
      }
    }

    const tx = (this.flankTarget && typeof this.flankTarget.x === 'number' && !isNaN(this.flankTarget.x)) ? this.flankTarget.x : (player.x || this.x);
    const ty = (this.flankTarget && typeof this.flankTarget.y === 'number' && !isNaN(this.flankTarget.y)) ? this.flankTarget.y : (player.y || this.y);
    const dist = this._navigatePath(tx, ty, this.cfg.speed * 1.1, delta);

    if (dist < ARRIVE_THRESH) {
      this._stopAndFace(this.lastKnownX, this.lastKnownY);
      this._maybeFireAt(delta, player);
      this.flankHoldMs += delta;
      if (this.flankHoldMs > 2500) {
        this.flankTarget = null;
        this.flankHoldMs = 0;
        if (sees) {
          this.state = ST.COVER_MOVE;
          this._claimCover(player);
        } else {
          this.state = ST.SEARCH;
          this._scanTimer = 0;
        }
      }
    } else {
      this._maybeFireAt(delta, player);
    }
  }

  // ── Fire helper ─────────────────────────────────────────────────────────

  _maybeFireAt(delta, player) {
    // canSee() already does LOS — only fire if a bullet from THIS exact
    // position would actually reach the player without hitting a wall.
    if (!this.canSee(player)) return;
    if (!this._hasLOS(this.x, this.y, player.x, player.y)) return;
    this.fireCd -= delta;
    // Pre-fire warning: orange weapon glow ~300 ms before the shot lands.
    // Gives the player a readable dodge window.
    const WARN = 300;
    if (this.fireCd > 0 && this.fireCd <= WARN && !this._warnFlashed) {
      this._warnFlashed = true;
      if (this.weaponSprite) {
        this.weaponSprite.setTint(0xff6010);
        this.scene.time.delayedCall(WARN + 60, () => {
          if (this.weaponSprite?.active) this.weaponSprite.clearTint();
        });
      }
    }
    if (this.fireCd <= 0) {
      this.fireCd         = Phaser.Math.Between(SUPPRESS_FIRE_MIN, SUPPRESS_FIRE_MAX);
      this._warnFlashed   = false;
      this.recoilT        = 100;
      this._fireAnimTimer = 180;
      const ang = Math.atan2(player.y - this.y, player.x - this.x);
      this.scene.events.emit('shooter-fire', this, ang);
    }
  }
}
