import Phaser from 'phaser';
import { ENEMY } from '../config.js';
import { SFX } from '../systems/FX.js';

// ── AI state constants ────────────────────────────────────────────────────────
const ST = {
  PATROL:     'patrol',     // walking assigned waypoints, unalerted
  ALERT:      'alert',      // just spotted player — brief freeze before combat
  CHASE:      'chase',      // (Grunt) running toward player for melee
  COVER_MOVE: 'cover_move', // (Shooter) moving toward claimed cover spot
  SUPPRESS:   'suppress',   // (Shooter) at cover, peek-firing at player
  REPOSITION: 'reposition', // (Shooter) moving to new cover (player too close)
  FLANK:      'flank',      // (Shooter) moving to a perpendicular flanking pos
};

// Detection constants
const VISION_RANGE    = 420;       // px — unalerted patrol sight
const ALARM_RANGE     = 130;       // px — player too close always triggers alarm
const SUPPRESS_FIRE_MIN = 1400;    // ms between peeks
const SUPPRESS_FIRE_MAX = 2200;
const REPOSITION_DIST   = 110;     // px — retreat from cover when player this close
const ARRIVE_THRESH     = 40;      // px — "close enough" to a target position
const FLANK_DIST        = 260;     // px — how far off the LOS axis to flank
const ALERT_PAUSE_MS    = 500;     // ms surprised freeze before switching to combat

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

    // Animation
    this._animPrefix   = texture;
    this._fireAnimTimer = 0;
    this.recoilT        = 0;

    // AI shared state
    this.state         = (spec.patrol?.length > 0) ? ST.PATROL : ST.ALERT;
    this.patrolPath    = spec.patrol || [];
    this.patrolIdx     = 0;
    this.patrolWait    = 0;          // ms to pause at waypoint
    this.alertTimer    = 0;          // ms remaining in ALERT freeze
    this.lastKnownX    = x;
    this.lastKnownY    = y;
    this.hasSeenPlayer = false;

    this.shadow = scene.add.image(x, y + 14, 'shadow').setDepth(this.depth - 1).setAlpha(0.35);
    this.hpBar  = scene.add.graphics().setDepth(this.depth + 1);
    this.hpBar.visible = false;

    // Listen for the room-wide alarm so patrolling enemies switch to combat
    scene.events.on('room-alarm', this._onAlarm, this);

    if (scene.anims.exists(`${texture}-idle`)) this.play(`${texture}-idle`);
  }

  // ── External API ─────────────────────────────────────────────────────────

  damage(amount, knockbackVec = null) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (knockbackVec) {
      this.body.setVelocity(
        this.body.velocity.x + knockbackVec.x,
        this.body.velocity.y + knockbackVec.y,
      );
    }
    this.recoilT = 80;
    // Being shot always triggers alarm
    if (this.state === ST.PATROL) this._triggerAlarm();
    this.scene.events.emit('enemy-hit', this, amount);
    if (this.hp <= 0) this.die();
  }

  die() {
    this.alive = false;
    this.scene.events.off('room-alarm', this._onAlarm, this);
    this.coverRegistry?.release(this);
    SFX.enemyDie();
    this.scene.events.emit('enemy-died', this);
    this.hpBar.destroy();
    this.shadow.destroy();
    this.destroy();
  }

  canSee(player) {
    if (player.hiddenInBush) return false;
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (this.state !== ST.PATROL) return true;   // alerted: 360° vision
    // Patrolling: cone check
    if (dist > VISION_RANGE) return false;
    const angleTo  = Math.atan2(player.y - this.y, player.x - this.x);
    const facing   = this.rotation - Math.PI / 2;
    const diff     = Phaser.Math.Angle.Wrap(angleTo - facing);
    return Math.abs(diff) < Math.PI * 0.55; // ~100° each side = 200° total
  }

  // ── Alarm system ─────────────────────────────────────────────────────────

  _triggerAlarm() {
    if (this.state !== ST.PATROL) return;
    this.state      = ST.ALERT;
    this.alertTimer = ALERT_PAUSE_MS;
    // Broadcast to all other enemies in the room
    this.scene.events.emit('room-alarm');
    SFX.uiClick(); // small "alert!" blip
  }

  _onAlarm() {
    if (this.state === ST.PATROL) {
      this.state      = ST.ALERT;
      this.alertTimer = ALERT_PAUSE_MS;
    }
  }

  // ── Shared movement helper ────────────────────────────────────────────────

  _moveToward(tx, ty, speed) {
    const dx = tx - this.x, dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) { this.setVelocity(0, 0); return dist; }
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;
    this.setVelocity(vx, vy);
    this.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
    return dist;
  }

  _facePoint(tx, ty) {
    this.setRotation(Math.atan2(ty - this.y, tx - this.x) + Math.PI / 2);
  }

  _stopAndFace(tx, ty) {
    this.setVelocity(0, 0);
    this._facePoint(tx, ty);
  }

  // ── Patrol walking ────────────────────────────────────────────────────────

  _tickPatrol(delta, player) {
    // Proximity alarm (heard/sensed player even without seeing)
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (dist < ALARM_RANGE || this.canSee(player)) {
      this.lastKnownX = player.x;
      this.lastKnownY = player.y;
      this._triggerAlarm();
      return;
    }

    if (!this.patrolPath.length) {
      // No patrol path — stand idle and scan
      this.setVelocity(0, 0);
      return;
    }

    if (this.patrolWait > 0) {
      this.patrolWait -= delta;
      this.setVelocity(0, 0);
      return;
    }

    const wp = this.patrolPath[this.patrolIdx];
    const d  = this._moveToward(wp.x, wp.y, this.cfg.speed * 0.55);
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

  // ── Common preUpdate bookkeeping ──────────────────────────────────────────

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta);
    this.shadow.setPosition(this.x, this.y + 18);
    this.updateHpBar();
    this.setAlpha(this.hiddenInBush ? 0.55 : 1);

    // Animation frame selection
    const speedSq   = this.body.velocity.x ** 2 + this.body.velocity.y ** 2;
    const isMoving  = speedSq > 200;
    const prefix    = this._animPrefix;

    if (this._fireAnimTimer > 0) {
      this._fireAnimTimer -= delta;
      if (this.anims.currentAnim?.key !== `${prefix}-fire`) this.play(`${prefix}-fire`);
    } else if (isMoving) {
      if (this.anims.currentAnim?.key !== `${prefix}-walk`) this.play(`${prefix}-walk`);
    } else {
      if (this.anims.currentAnim?.key !== `${prefix}-idle`) this.play(`${prefix}-idle`);
    }

    // Recoil scale
    if (this.recoilT > 0) {
      this.recoilT -= delta;
      this.setScale(1 - Math.max(0, this.recoilT / 80) * 0.12);
    } else {
      this.setScale(1);
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
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.alive) return;
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
        this._tickChase(time, player);
        break;
    }
  }

  _tickChase(time, player) {
    const sees = this.canSee(player);
    if (sees) {
      this.lastKnownX = player.x;
      this.lastKnownY = player.y;
      this.hasSeenPlayer = true;
    }

    const tx   = sees ? player.x : this.lastKnownX;
    const ty   = sees ? player.y : this.lastKnownY;
    const dist = this._moveToward(tx, ty, this.cfg.speed);

    if (sees && dist < this.cfg.meleeRange) {
      this.setVelocity(0, 0);
      if (time - this.lastMeleeAt > this.cfg.meleeCooldownMs) {
        this.lastMeleeAt     = time;
        this._fireAnimTimer  = 200;
        player.damage(this.cfg.meleeDamage);
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
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.alive) return;
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
    }
  }

  // ── Cover claiming ──────────────────────────────────────────────────────

  _claimCover(player) {
    this.coverRegistry?.release(this);
    // Prefer cover farther from current position (run away a bit)
    this.coverSpot = this.coverRegistry?.claim(this) ?? null;
  }

  _claimFarCover(player) {
    this.coverRegistry?.release(this);
    // Claim the cover spot farthest from the player (for repositioning)
    this.coverSpot = this.coverRegistry
      ? this.coverRegistry.claimFarthestFrom(this, player.x, player.y)
      : null;
  }

  // ── COVER_MOVE: walk to the claimed spot ────────────────────────────────

  _tickCoverMove(delta, player) {
    if (!this.coverSpot) {
      // No cover available — fall back to suppression in place
      this.state = ST.SUPPRESS;
      return;
    }
    const dist = this._moveToward(this.coverSpot.x, this.coverSpot.y, this.cfg.speed);
    if (dist < ARRIVE_THRESH) {
      this.state = ST.SUPPRESS;
    }
    // Fire of opportunity while moving
    this._maybeFireAt(delta, player);
  }

  // ── SUPPRESS: hold position, peek-fire ─────────────────────────────────

  _tickSuppress(delta, player) {
    const sees = this.canSee(player);
    if (sees) {
      this.lastKnownX = player.x;
      this.lastKnownY = player.y;
    }

    // Hold at cover spot (or current pos if no spot)
    const holdX = this.coverSpot?.x ?? this.x;
    const holdY = this.coverSpot?.y ?? this.y;
    const dCover = Math.hypot(this.x - holdX, this.y - holdY);
    if (dCover > ARRIVE_THRESH * 1.5) {
      this._moveToward(holdX, holdY, this.cfg.speed * 0.8);
    } else {
      this._stopAndFace(this.lastKnownX, this.lastKnownY);
    }

    this._maybeFireAt(delta, player);

    // Reposition if player gets too close
    const dPlayer = Math.hypot(player.x - this.x, player.y - this.y);
    if (dPlayer < REPOSITION_DIST) {
      this.state = ST.REPOSITION;
    }
  }

  // ── REPOSITION: release current cover, find a new one ──────────────────

  _tickReposition(delta, player) {
    // First frame: claim new cover
    if (!this._repositioning) {
      this._repositioning = true;
      this._claimFarCover(player);
    }
    if (!this.coverSpot) {
      // Nowhere to go — just run away from player
      const dx = this.x - player.x, dy = this.y - player.y;
      const d  = Math.hypot(dx, dy) || 1;
      this.setVelocity((dx / d) * this.cfg.speed, (dy / d) * this.cfg.speed);
      const dSafe = Math.hypot(player.x - this.x, player.y - this.y);
      if (dSafe > REPOSITION_DIST * 2) {
        this._repositioning = false;
        this.state = ST.SUPPRESS;
      }
      return;
    }
    const dist = this._moveToward(this.coverSpot.x, this.coverSpot.y, this.cfg.speed);
    if (dist < ARRIVE_THRESH) {
      this._repositioning = false;
      this.state = ST.SUPPRESS;
    }
  }

  // ── FLANK: move to a perpendicular position and fire ───────────────────

  _computeFlankTarget(player) {
    // Compute a position 90° off the axis from this enemy to the player
    const dx  = player.x - this.x, dy = player.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    // Perpendicular unit vector (rotate 90°)
    const side = (Math.random() < 0.5 ? 1 : -1);
    const px   = (-dy / len) * side;
    const py   = (dx  / len) * side;
    this.flankTarget = {
      x: player.x + px * FLANK_DIST,
      y: player.y + py * FLANK_DIST,
    };
    // Clamp to room bounds
    const { w, h } = this.scene.roomSpec?.bounds ?? { w: 1600, h: 1600 };
    this.flankTarget.x = Phaser.Math.Clamp(this.flankTarget.x, 80, w - 80);
    this.flankTarget.y = Phaser.Math.Clamp(this.flankTarget.y, 80, h - 80);
    this.flankHoldMs   = 0;
  }

  _tickFlank(delta, player) {
    const sees = this.canSee(player);
    if (sees) { this.lastKnownX = player.x; this.lastKnownY = player.y; }

    if (!this.flankTarget) {
      this._computeFlankTarget(player);
    }

    const dist = this._moveToward(this.flankTarget.x, this.flankTarget.y, this.cfg.speed * 1.1);

    if (dist < ARRIVE_THRESH) {
      // In flank position — fire freely
      this._stopAndFace(this.lastKnownX, this.lastKnownY);
      this._maybeFireAt(delta, player);
      this.flankHoldMs += delta;
      // After 3 s in flank, transition to cover suppression
      if (this.flankHoldMs > 3000) {
        this.flankTarget = null;
        this.flankHoldMs = 0;
        this.state = ST.COVER_MOVE;
        this._claimCover(player);
      }
    } else {
      // Fire of opportunity while moving to flank position
      this._maybeFireAt(delta, player);
    }
  }

  // ── Fire helper ─────────────────────────────────────────────────────────

  _maybeFireAt(delta, player) {
    if (!this.canSee(player)) return;
    this.fireCd -= delta;
    if (this.fireCd <= 0) {
      this.fireCd         = Phaser.Math.Between(SUPPRESS_FIRE_MIN, SUPPRESS_FIRE_MAX);
      this.recoilT        = 100;
      this._fireAnimTimer = 180;
      const ang = Math.atan2(player.y - this.y, player.x - this.x);
      this.scene.events.emit('shooter-fire', this, ang);
    }
  }
}
