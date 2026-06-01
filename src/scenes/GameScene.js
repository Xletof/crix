import Phaser from 'phaser';
import { PLAYER, ENEMY, BOSS, HEALTH_ORB, WEAPONS } from '../config.js';
import { Player } from '../entities/Player.js';
import { EnemyGrunt, EnemyShooter, ST, VISION_RANGE, VISION_HALF_ANGLE } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { BulletGroup } from '../entities/Bullet.js';
import { BushSystem } from '../systems/BushSystem.js';
import { RoomManager } from '../systems/RoomManager.js';
import { CoverRegistry } from '../systems/CoverRegistry.js';
import { WeaponPickup } from '../entities/WeaponPickup.js';
import { Terminal } from '../entities/Terminal.js';
import { attachFX, SFX, startMusic, duckMusic, stopMusic } from '../systems/FX.js';
import { ROOMS } from '../data/rooms.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    // ── Persistent bullet groups (survive room transitions) ────────────────
    this.playerBullets      = new BulletGroup(this, 'bullet');
    this.playerRifleBullets = new BulletGroup(this, 'bullet');   // rifle uses same bolt tex
    this.playerSuperBullets = new BulletGroup(this, 'bullet-super');
    this.enemyBullets       = new BulletGroup(this, 'bullet-enemy');

    // ── Grenades group ─────────────────────────────────────────────────────
    this.grenades = this.physics.add.group();

    // ── FX ─────────────────────────────────────────────────────────────────
    this.fx = attachFX(this);

    // ── Player ─────────────────────────────────────────────────────────────
    this.player = new Player(this, 200, 200);
    // Tighter lerp (was 0.10) so the player stays anchored near screen
    // center on mobile rather than sliding around the viewport.
    this.cameras.main.startFollow(this.player, true, 0.5, 0.5);

    // ── Bush / cover system ────────────────────────────────────────────────
    this.bushSystem = new BushSystem(this);

    // ── Aim cone + flame cone overlays ────────────────────────────────────
    this.aimGraphics   = this.add.graphics().setDepth(25);
    this.flameGraphics = this.add.graphics().setDepth(24);

    // ── Patrol vision cones (drawn under enemies) ─────────────────────────
    this.visionGraphics = this.add.graphics().setDepth(2);

    // ── Reinforcement door visual ─────────────────────────────────────────
    this.reinforceGraphics = this.add.graphics().setDepth(14);

    // ── Stealth takedown hint ring ─────────────────────────────────────────
    this.takedownGfx = this.add.graphics().setDepth(27);
    this._takedownTarget = null;

    // ── Weapon pickups (cleared per room) ──────────────────────────────────
    this.weaponPickups = [];

    // ── Objective terminals (cleared per room) ──────────────────────────────
    this.terminals = [];

    // ── Reinforcement state (reset per room) ──────────────────────────────
    this.reinforceTimer    = 0;
    this.reinforceArmed    = false;  // true once first alarm fires
    this.reinforceSpawned  = false;
    this.stealthKills      = 0;

    // ── Enemy group ────────────────────────────────────────────────────────
    this.enemies = this.add.group({ runChildUpdate: false });
    this.boss    = null;

    // ── Health orbs ────────────────────────────────────────────────────────
    this.healthOrbs = [];

    // ── Room-specific containers (destroyed per-room) ──────────────────────
    this.roomLayer = this.add.group(); // backdrop + walls + cover sprites for current room

    // ── Lives system ───────────────────────────────────────────────────────
    this.lives = 3;

    // ── Room manager ───────────────────────────────────────────────────────
    this.roomManager = new RoomManager(this);

    // ── Shared static group for walls (refreshed per room) ─────────────────
    // Holds both blast-door walls AND solid cover sprites (consoles/crates).
    // Both player and enemies collide with this group.
    this.walls = this.physics.add.staticGroup();
    this.physics.add.collider(this.player, this.walls);

    // ── Door visuals (open/sealed indicator at exit) ───────────────────────
    this.doorGfx = this.add.graphics().setDepth(60);
    this.doorZone = null; // set per room

    // ── AI debug overlay (press D to toggle) ──────────────────────────────
    this.debugGraphics = this.add.graphics().setDepth(120);
    this.debugAI = false;
    this.input.keyboard?.on('keydown-D', () => {
      this.debugAI = !this.debugAI;
      if (!this.debugAI) this.debugGraphics.clear();
    });

    // ── Event wiring ───────────────────────────────────────────────────────
    this.bindEvents();

    // ── Launch HUD ─────────────────────────────────────────────────────────
    this.scene.launch('HUD', { game: this });

    // ── Start music on first gesture ───────────────────────────────────────
    this.input.once('pointerdown', () => startMusic());
    this.input.keyboard?.once('keydown', () => startMusic());

    // ── Desktop keyboard fallback ──────────────────────────────────────────
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys    = this.input.keyboard?.addKeys('W,A,S,D');
    this.input.keyboard?.on('keydown-SPACE', () => this.player?.tryFireSuper());

    // ── Start the run ──────────────────────────────────────────────────────
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.time.delayedCall(200, () => this.loadRoom(ROOMS[0]));

    // ── Cleanup on shutdown ────────────────────────────────────────────────
    this.events.once('shutdown', () => {
      stopMusic();
      this.scene.stop('HUD');
      this.healthOrbs.forEach((o) => { this.tweens.killTweensOf(o.gfx); o.gfx.destroy(); });
      this.healthOrbs = [];
    });
  }

  // ── Room loading ─────────────────────────────────────────────────────────

  loadRoom(spec) {
    this._clearRoomEntities();
    this.roomSpec = spec;

    const { w, h } = spec.bounds;

    // Physics + camera bounds
    this.physics.world.setBounds(0, 0, w, h);
    this.cameras.main.setBounds(0, 0, w, h);

    // Backdrop — tile the pre-painted texture to fill room
    const bgImg = this.add.image(0, 0, 'backdrop')
      .setOrigin(0, 0)
      .setDisplaySize(w, h)
      .setDepth(-10);
    this.roomLayer.add(bgImg);

    // Walls
    for (const wp of spec.walls) {
      const wall = this.walls.create(wp.x, wp.y, 'wall');
      wall.setDepth(15).refreshBody();
      this.roomLayer.add(wall);
    }

    // Cover / consoles — solid obstacles that also hide actors (bush system).
    // Created as static physics bodies so both player and enemies bump into
    // them. We shrink the physics body (70×70) below the 112×112 sprite so
    // AI can still close to within firing distance of the cover spot.
    this.bushSystem.clear();
    this.coverRegistry = new CoverRegistry(spec.cover);
    for (const cp of spec.cover) {
      const con = this.walls.create(cp.x, cp.y, 'bush');
      con.setDepth(20);
      con.body.setSize(70, 70).setOffset((con.width - 70) / 2, (con.height - 70) / 2);
      con.refreshBody();
      this.roomLayer.add(con);
      this.bushSystem.add(con, 55);
    }

    // Remove any stale room-alarm / stealth listeners from previous rooms
    this.events.off('room-alarm');
    this.events.off('stealth-kill');

    // Reset reinforcement + stealth tracking for the new room
    this.reinforceTimer    = 0;
    this.reinforceArmed    = false;
    this.reinforceSpawned  = false;
    this.stealthKills      = 0;
    this.reinforceGraphics.clear();
    this._takedownTarget   = null;
    this.takedownGfx.clear();
    this.events.emit('takedown-available', false);

    // First room-alarm of the room arms the reinforcement timer
    this.events.on('room-alarm', () => this._onFirstAlarm());
    this.events.on('stealth-kill', () => {
      this.stealthKills += 1;
      this.fx.damageNumber(this.player.x, this.player.y - 40, 'SILENT', '#80ff80', false);
    });

    // Weapon pickups
    this.weaponPickups.forEach((p) => p.destroy());
    this.weaponPickups = [];
    (spec.pickups ?? []).forEach(({ x, y, weapon }) => {
      this.weaponPickups.push(new WeaponPickup(this, x, y, weapon));
    });

    // Objective terminals — the exit stays sealed until every one is hacked.
    this.terminals.forEach((t) => t.destroy());
    this.terminals = [];
    (spec.terminals ?? []).forEach(({ x, y }) => this.terminals.push(new Terminal(this, x, y)));
    this._terminalsTotal  = this.terminals.length;
    this._terminalsHacked = 0;
    this._enemiesCleared  = false;
    this._roomDoorOpened  = false;
    this._activeHackTarget = null;
    this._hackPromptTarget = null;
    this.events.emit('hack-cancel');   // close any leftover mini-game
    this.events.emit('hack-prompt', false);
    this.events.emit('objective-update', this._terminalsHacked, this._terminalsTotal);

    // Spawn enemies listed in the spec (each gets the cover registry injected)
    spec.enemies.forEach((enemySpec) => this.spawnEnemyAt(enemySpec.type, enemySpec.x, enemySpec.y, enemySpec));

    // Boss room
    if (spec.boss) {
      this.time.delayedCall(600, () => {
        this.spawnBoss(spec.bossSpawn.x, spec.bossSpawn.y);
        this.events.emit('boss-start');
      });
    }

    // Place player at spawn
    this.player.setPosition(spec.spawn.x, spec.spawn.y);
    this.player.setVelocity(0, 0);

    // Draw sealed exit door
    this.drawDoor(spec, true);

    // Announce room
    this.roomManager.setRoom(spec);
    const idx = this.roomManager.index;
    this.events.emit('room-start', idx + 1, ROOMS.length, spec);
    this._roomLoud = false;

    // Objective briefing banner (skip boss room — it has its own intro).
    if (!spec.boss) {
      const n = this._terminalsTotal;
      const objMsg = n > 0
        ? `SLICE ${n} TERMINAL${n > 1 ? 'S' : ''}`
        : 'ELIMINATE ALL HOSTILES';
      this.time.delayedCall(650, () => this.events.emit('show-banner', objMsg, '#ffd040'));

      // One-time tips on the very first room of a run.
      if (idx === 0 && !this._shownStealthTip) {
        this._shownStealthTip = true;
        this.time.delayedCall(2400, () =>
          this.events.emit('show-banner', 'SNEAK BEHIND FOES\nFOR SILENT TAKEDOWNS', '#80ffaa'));
        this.time.delayedCall(4400, () =>
          this.events.emit('show-banner', 'STAND ON TERMINALS\nTO SLICE THEM', '#ffd040'));
      }
    }

    // Empty room with no objectives → open immediately. Otherwise the door is
    // gated by _maybeCompleteRoom() (enemies cleared AND all terminals hacked).
    if (spec.enemies.length === 0 && !spec.boss && this._terminalsTotal === 0) {
      this.time.delayedCall(200, () => { this._enemiesCleared = true; this._maybeCompleteRoom(); });
    }
  }

  _clearRoomEntities() {
    // Destroy all enemies still alive (dead ones already cleaned themselves up)
    this.enemies.getChildren().forEach((e) => {
      try { e.shadow?.destroy(); e.hpBar?.destroy(); if (e.scene) e.destroy(); } catch (_) {}
    });
    this.enemies.clear(false, false);

    // Boss
    if (this.boss) {
      try { this.boss.shadow?.destroy(); this.boss.hpBar?.destroy(); this.boss.destroy(); } catch (_) {}
      this.boss = null;
    }

    // Room-layer objects (backdrop, walls, cover)
    this.roomLayer.getChildren().forEach((o) => o.destroy());
    this.roomLayer.clear(false, false);

    // Static wall group
    this.walls.clear(true, true);

    // Weapon pickups
    this.weaponPickups?.forEach((p) => p.destroy());
    this.weaponPickups = [];

    // Objective terminals
    this.terminals?.forEach((t) => t.destroy());
    this.terminals = [];

    // Grenades
    this.grenades?.getChildren().forEach((g) => { try { g.destroy(); } catch (_) {} });
    this.grenades?.clear(false, false);

    // Kill in-flight bullets
    [...this.playerBullets.getChildren(),
     ...this.playerSuperBullets.getChildren(),
     ...this.enemyBullets.getChildren()].forEach((b) => { if (b.active) b.kill(); });

    // Health orbs
    this.healthOrbs.forEach((o) => { this.tweens.killTweensOf(o.gfx); o.gfx.destroy(); });
    this.healthOrbs = [];

    // Door zone
    if (this.doorZone) { this.doorZone.destroy(); this.doorZone = null; }
    this.doorGfx.clear();
  }

  // ── Door visuals + trigger ────────────────────────────────────────────────

  drawDoor(spec, sealed) {
    if (!spec.exit) return; // boss room has no exit
    const { w, h } = spec.bounds;
    const { x, y, side } = spec.exit;
    const g = this.doorGfx;
    g.clear();

    const color  = sealed ? 0xff2020 : 0x20ff60;
    const glow   = sealed ? 0xff6060 : 0x80ffaa;
    const alpha  = sealed ? 0.9     : 0.7;
    const len    = 80;

    g.lineStyle(6, color, alpha);
    g.fillStyle(glow, 0.15);

    if (side === 'right') {
      // vertical bar on right edge
      g.fillRect(w - 14, y - len, 14, len * 2);
      g.beginPath(); g.moveTo(w, y - len); g.lineTo(w, y + len); g.strokePath();
      g.lineStyle(2, glow, 0.7);
      g.beginPath(); g.moveTo(w - 10, y - len); g.lineTo(w - 10, y + len); g.strokePath();
    } else if (side === 'bottom') {
      g.fillRect(x - len, h - 14, len * 2, 14);
      g.beginPath(); g.moveTo(x - len, h); g.lineTo(x + len, h); g.strokePath();
      g.lineStyle(2, glow, 0.7);
      g.beginPath(); g.moveTo(x - len, h - 10); g.lineTo(x + len, h - 10); g.strokePath();
    } else if (side === 'left') {
      g.fillRect(0, y - len, 14, len * 2);
      g.beginPath(); g.moveTo(0, y - len); g.lineTo(0, y + len); g.strokePath();
    } else if (side === 'top') {
      g.fillRect(x - len, 0, len * 2, 14);
      g.beginPath(); g.moveTo(x - len, 0); g.lineTo(x + len, 0); g.strokePath();
    }

    // Label
    const label = sealed ? '[ SEALED ]' : '[ EXIT ]';
    const lx = side === 'right' ? w - 80 : side === 'left' ? 80 : x;
    const ly = side === 'bottom' ? h - 80 : side === 'top' ? 80 : y - 24;
    if (!this._doorLabel || !this._doorLabel.active) {
      this._doorLabel = this.add.text(lx, ly, label, {
        fontFamily: 'Courier New, monospace',
        fontSize: '18px',
        color: sealed ? '#ff4040' : '#40ff80',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(61);
    } else {
      this._doorLabel.setText(label)
        .setColor(sealed ? '#ff4040' : '#40ff80')
        .setPosition(lx, ly);
    }
  }

  // Open the exit only once BOTH win conditions hold: every enemy is down and
  // every objective terminal is hacked. Called from both completion paths.
  _maybeCompleteRoom() {
    if (this._roomDoorOpened) return;
    if (!this._enemiesCleared) return;
    if (this._terminalsHacked < this._terminalsTotal) {
      // Enemies down but terminals remain — nudge the player toward them.
      if (this._terminalsTotal > 0) {
        this.events.emit('show-banner', 'SLICE THE TERMINALS', '#ffd040');
      }
      return;
    }
    this._roomDoorOpened = true;
    const spec = this.roomSpec;
    if (!spec?.exit) return;
    this._openDoor();
    // Celebration: green flash + banner, and a reward for a fully-silent room.
    this.cameras.main.flash(220, 40, 255, 120, true);
    this.fx.shake(0.004, 120);
    const silent = !this._roomLoud && this._enemiesCleared;
    this.events.emit('show-banner', silent ? 'GHOST — UNDETECTED' : 'CHAMBER CLEAR',
      silent ? '#80ffaa' : '#20ff60');
  }

  _openDoor() {
    const spec = this.roomSpec;
    if (!spec?.exit) return;

    SFX.uiClick();
    this.drawDoor(spec, false);

    const { w, h } = spec.bounds;
    const { x, y, side } = spec.exit;

    // Trigger zone at the exit edge
    const zoneW = side === 'right' || side === 'left' ? 30 : 200;
    const zoneH = side === 'top'   || side === 'bottom' ? 30 : 200;
    const zx = side === 'right'  ? w - 15 : side === 'left' ? 15 : x;
    const zy = side === 'bottom' ? h - 15 : side === 'top'  ? 15 : y;

    this.doorZone = this.add.zone(zx, zy, zoneW, zoneH)
      .setOrigin(0.5)
      .setDepth(62);

    this._doorTriggered = false;
  }

  _checkDoorTrigger() {
    if (!this.doorZone || this._doorTriggered) return;
    const p = this.player;
    const z = this.doorZone;
    if (!p.alive) return;
    if (Phaser.Geom.Intersects.RectangleToRectangle(
      new Phaser.Geom.Rectangle(p.x - PLAYER.radius, p.y - PLAYER.radius, PLAYER.radius * 2, PLAYER.radius * 2),
      new Phaser.Geom.Rectangle(z.x - z.width / 2, z.y - z.height / 2, z.width, z.height)
    )) {
      this._doorTriggered = true;
      this._transitionToNext();
    }
  }

  _transitionToNext() {
    if (this.roomManager.isLast) return;
    const nextIdx = this.roomManager.index + 1;

    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (this._doorLabel) { this._doorLabel.destroy(); this._doorLabel = null; }
      this.loadRoom(ROOMS[nextIdx]);
      this.cameras.main.fadeIn(350, 0, 0, 0);
    });
  }

  // ── Stealth takedowns ──────────────────────────────────────────────────────
  // Each frame, find the nearest unalerted enemy the player is standing behind.
  // When one exists, the HUD shows a contextual TAKEDOWN button.
  _updateTakedownTarget() {
    let best = null, bestD = Infinity;
    if (this.player?.alive) {
      for (const e of this.enemies.getChildren()) {
        if (!e.alive || typeof e.isBackstabbable !== 'function') continue;
        if (!e.isBackstabbable(this.player)) continue;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
        if (d < bestD) { bestD = d; best = e; }
      }
    }
    if (best !== this._takedownTarget) {
      this._takedownTarget = best;
      this.events.emit('takedown-available', !!best);
    }
    this._drawTakedownHint(best);
  }

  _drawTakedownHint(enemy) {
    const g = this.takedownGfx;
    g.clear();
    if (!enemy) return;
    const t = (this.time.now * 0.012) % (Math.PI * 2);
    const pulse = 0.5 + 0.5 * Math.sin(t);
    const r = enemy.cfg.radius + 10;
    // Green "silent" reticle around the target
    g.lineStyle(3, 0x40ff80, 0.6 + pulse * 0.4);
    g.strokeCircle(enemy.x, enemy.y, r);
    // Crosshair ticks
    g.lineStyle(2, 0x80ffaa, 0.7 + pulse * 0.3);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      const x1 = enemy.x + Math.cos(a) * (r - 4);
      const y1 = enemy.y + Math.sin(a) * (r - 4);
      const x2 = enemy.x + Math.cos(a) * (r + 5);
      const y2 = enemy.y + Math.sin(a) * (r + 5);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
    }
  }

  // Called by the HUD HACK button. Opens the slicing mini-game on whatever
  // terminal the player is currently standing on (no-op if none).
  requestHack() {
    const t = this._hackPromptTarget;
    if (!t || t.hacked) return;
    this._activeHackTarget = t;
    this.events.emit('hack-start', t);
  }

  // Called by the HUD takedown button.
  performTakedown() {
    const e = this._takedownTarget;
    if (!e || !e.alive) return;
    // Snap the player just behind the target for a clean "grab" read.
    this.fx.burst(e.x, e.y, 'red', 16);
    this.fx.shake(0.006, 90);
    this.cameras.main.flash(70, 60, 255, 120, true);
    // Brief hit-stop for weight
    this.physics.world.pause();
    this.time.delayedCall(60, () => this.physics.world.resume());
    SFX.takedown();
    e.stealthKill();
    this._takedownTarget = null;
    this.takedownGfx.clear();
    this.events.emit('takedown-available', false);
  }

  // ── Hotline-style kill juice helpers ──────────────────────────────────────

  // Persistent blood splatter pool — irregular dark-red circles, lives in
  // roomLayer so it gets purged on room change. Builds a "trail of bodies"
  // visual that lingers as the player advances.
  spawnBloodSplatter(x, y) {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x4a0000, 0.55);
    g.fillCircle(x, y, 16);
    g.fillStyle(0x6a0000, 0.6);
    g.fillCircle(x, y, 11);
    // 6-8 splotch dots flung outward
    const dots = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < dots; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 6 + Math.random() * 28;
      const r = 2 + Math.random() * 5;
      g.fillStyle(Math.random() < 0.5 ? 0x4a0000 : 0x6a0010, 0.45 + Math.random() * 0.25);
      g.fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d, r);
    }
    this.roomLayer.add(g);
  }

  // Brief camera punch-zoom: pulse the zoom up to `to` over half the
  // duration, then back to 1.0. Decay handled by a tween so it's safe
  // through scene transitions.
  _cameraPunch(to = 1.04, durMs = 220) {
    const cam = this.cameras.main;
    if (this._cameraPunchTween) this._cameraPunchTween.stop();
    cam.setZoom(1);
    this._cameraPunchTween = this.tweens.add({
      targets: cam,
      zoom: to,
      duration: durMs * 0.35,
      yoyo: true,
      ease: 'Cubic.easeOut',
      onComplete: () => { cam.setZoom(1); this._cameraPunchTween = null; },
    });
  }

  // ── Sound-radius alarm ────────────────────────────────────────────────────
  // Only enemies within `radius` px of the shot hear it and switch to ALERT.
  // Enemies farther away keep patrolling until they SEE the player themselves.
  _alertEnemiesNear(x, y, radius) {
    const r2 = radius * radius;
    let anyAlerted = false;
    for (const e of this.enemies.getChildren()) {
      if (!e.active || !e.alive) continue;
      if (e.state !== ST.PATROL) continue; // already alerted
      if ((e.x - x) ** 2 + (e.y - y) ** 2 < r2) {
        e._triggerAlarm();
        anyAlerted = true;
      }
    }
    // Arm the reinforcement timer if any enemy was alerted
    if (anyAlerted) this._onFirstAlarm();
  }

  // ── Reinforcements ───────────────────────────────────────────────────────

  _onFirstAlarm() {
    // Room just went loud — klaxon + banner, once per room (independent of
    // whether this room actually has reinforcements configured).
    if (!this._roomLoud) {
      this._roomLoud = true;
      SFX.alarm();
      this.cameras.main.flash(160, 120, 0, 0, true);
      this.events.emit('show-banner', '⚠ DETECTED', '#ff2828');
    }
    if (this.reinforceArmed) return;
    const cfg = this.roomSpec?.reinforce;
    if (!cfg) return;
    this.reinforceArmed = true;
    this.reinforceTimer = cfg.afterMs;
  }

  _tickReinforcements(delta) {
    if (!this.reinforceArmed || this.reinforceSpawned) return;
    const cfg = this.roomSpec?.reinforce;
    if (!cfg) return;
    this.reinforceTimer -= delta;

    // Visual: pulsing red highlight on the reinforce door
    this._drawReinforceDoor(cfg.door);

    // HUD countdown update
    const secs = Math.max(0, Math.ceil(this.reinforceTimer / 1000));
    this.events.emit('reinforce-tick', secs);

    if (this.reinforceTimer <= 0) {
      this._spawnReinforcements();
    }
  }

  _drawReinforceDoor({ x, y }) {
    const g = this.reinforceGraphics;
    g.clear();
    // Pulse opacity based on time remaining
    const r = 60;
    const t = (this.time.now * 0.005) % (Math.PI * 2);
    const pulse = 0.5 + 0.5 * Math.sin(t);
    g.fillStyle(0xff2020, 0.18 + pulse * 0.2);
    g.fillCircle(x, y, r);
    g.lineStyle(3, 0xff4040, 0.7 + pulse * 0.3);
    g.strokeCircle(x, y, r);
    g.lineStyle(2, 0xff8080, 0.5);
    g.strokeCircle(x, y, r * 1.4);
  }

  _spawnReinforcements() {
    const cfg = this.roomSpec.reinforce;
    this.reinforceSpawned = true;
    this.reinforceGraphics.clear();
    this.events.emit('reinforce-spawn');

    // Big visual at the door
    this.fx.explosion(cfg.door.x, cfg.door.y, 1.4);
    this.fx.shake(0.012, 200);
    SFX.bossRoar();

    // Spawn enemies in a small spread around the door
    for (let i = 0; i < cfg.count; i++) {
      this.time.delayedCall(i * 220, () => {
        const ox = Phaser.Math.Between(-30, 30);
        const oy = Phaser.Math.Between(-10, 30);
        const e  = this.spawnEnemyAt(cfg.type, cfg.door.x + ox, cfg.door.y + oy, {});
        // Spawn in ALERT so they immediately engage
        if (e) {
          e.state = ST.ALERT;
          e.alertTimer = 200;
        }
        this.fx.burst(cfg.door.x + ox, cfg.door.y + oy, 'red', 8);
      });
    }
  }

  // ── Spawning ─────────────────────────────────────────────────────────────

  spawnEnemyAt(type, x, y, spec = {}) {
    let enemy;
    if (type === 'shooter') enemy = new EnemyShooter(this, x, y, spec);
    else                    enemy = new EnemyGrunt(this, x, y, spec);
    enemy.coverRegistry = this.coverRegistry;
    this.enemies.add(enemy);
    this.physics.add.collider(enemy, this.walls);
    this.roomManager.registerEnemy();
    return enemy;
  }

  // Spawn at random room edge — used for boss minions (always alerted)
  spawnEnemyRandom(type) {
    const spec = this.roomSpec;
    if (!spec) return;
    const { w, h } = spec.bounds;
    const edges = [
      { x: 80,     y: Phaser.Math.Between(80, h - 80) },
      { x: w - 80, y: Phaser.Math.Between(80, h - 80) },
      { x: Phaser.Math.Between(80, w - 80), y: 80 },
      { x: Phaser.Math.Between(80, w - 80), y: h - 80 },
    ];
    let best = edges[0], bestDist = -1;
    for (const e of edges) {
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d > bestDist) { bestDist = d; best = e; }
    }
    // No patrol (spawn alerted) — empty spec means state starts as ALERT
    return this.spawnEnemyAt(type, best.x, best.y, {});
  }

  spawnBoss(bx, by) {
    this.boss = new Boss(this, bx, by);
    this.physics.add.collider(this.boss, this.walls);
    this.roomManager.registerEnemy(); // so boss death also triggers room-cleared (unused but consistent)
    this.fx.shake(0.012, 400);
    duckMusic(0.4, 800);
  }

  spawnHealthOrb(x, y) {
    const g = this.add.graphics().setDepth(22);
    const r = HEALTH_ORB.radius;
    g.fillStyle(0x1060cc, 0.22); g.fillCircle(0, 0, r + 10);
    g.fillStyle(0x000010, 0.4);  g.fillEllipse(2, r * 0.7, r * 1.8, r * 0.5);
    g.fillStyle(0x004488, 1);    g.fillRoundedRect(-r * 0.55 + 1, -r + 1, r * 1.1, r * 1.9, r * 0.3);
    g.fillStyle(HEALTH_ORB.color, 1); g.fillRoundedRect(-r * 0.55, -r, r * 1.1, r * 1.9, r * 0.3);
    g.fillStyle(0x40b8ff, 0.6);  g.fillRoundedRect(-r * 0.42, -r * 0.85, r * 0.84, r * 1.5, r * 0.25);
    g.fillStyle(0x003366, 1);    g.fillRect(-r * 0.22 + 1, -r * 1.15 + 1, r * 0.44, r * 0.22);
    g.fillStyle(0x1898e8, 1);    g.fillRect(-r * 0.22, -r * 1.15, r * 0.44, r * 0.22);
    g.fillStyle(0xccccdd, 1);    g.fillRect(-r * 0.28, -r * 1.28, r * 0.56, r * 0.16);
    g.fillStyle(0x90d8ff, 0.65); g.fillRoundedRect(-r * 0.46, -r * 0.88, r * 0.16, r * 1.45, r * 0.08);
    g.fillStyle(0x90d8ff, 0.5);  g.fillCircle(-r * 0.1, r * 0.1, r * 0.12);
    g.fillCircle(r * 0.1, -r * 0.2, r * 0.09);
    g.fillStyle(0x006aaa, 0.7);  g.fillRect(-r * 0.08, -r * 0.5, r * 0.06, r * 0.9);
    g.fillRect(r * 0.02, -r * 0.5, r * 0.06, r * 0.9);
    g.setPosition(x, y);

    const orb = { gfx: g, x, y, life: HEALTH_ORB.lifeMs, pulse: 0 };
    this.healthOrbs.push(orb);
    this.tweens.add({
      targets: g, scaleX: 1.18, scaleY: 1.18, duration: 400,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  bindEvents() {
    this.events.on('player-fire', (angle) => {
      this.firePlayerPrimary(angle);
      // Pistol — only enemies within hearing radius react to the shot
      this._alertEnemiesNear(this.player.x, this.player.y, 420);
    });
    this.events.on('player-fire-super', (angle) => {
      this.firePlayerSuper(angle);
      // Super shot — loud enough to alert the entire room
      this.events.emit('room-alarm');
    });
    this.events.on('player-fire-rifle', (angle) => {
      this.firePlayerRifle(angle);
      // Rifle — louder than pistol, alerts a wider radius
      this._alertEnemiesNear(this.player.x, this.player.y, 560);
    });
    this.events.on('grenade-detonate',  (x, y, dmg, r) => this.detonateGrenade(x, y, dmg, r));
    this.events.on('shooter-fire',      (s, a)  => this.fireShooter(s, a));
    this.events.on('boss-fan',          (b, a)  => this.fireBossFan(b, a));
    this.events.on('boss-spawn',        ()      => this.bossSpawnMinions());
    this.events.on('boss-charge',       ()      => this.fx.shake(0.015, 200));
    this.events.on('boss-hit', (boss, amount) => {
      this.fx.hitFlash(boss);
      this.fx.damageNumber(boss.x + (Math.random() * 30 - 15), boss.y - boss.cfg.radius,
        Math.round(amount), '#ffd166', true);
      this.fx.burst(boss.x, boss.y, 'red', 6);
      this.fx.shake(0.005, 60);
      // Hit-pause: brief freeze on big damage spikes for crunchy impact
      if (amount >= 400) {
        this.physics.world.pause();
        this.time.delayedCall(45, () => this.physics.world.resume());
      }
      SFX.bossHit();
    });
    this.events.on('boss-died', (boss) => {
      this.boss = null;
      this.roomManager.onEnemyDied(); // consistent tracking
      this.fx.burst(boss.x, boss.y, 'yellow', 40);
      this.fx.burst(boss.x, boss.y, 'red', 40);
      this.fx.shake(0.025, 500);
      SFX.bossDie();
      this.time.delayedCall(800, () => this.victory());
    });
    this.events.on('enemy-hit', (enemy, amount) => {
      this.fx.hitFlash(enemy);
      this.fx.damageNumber(enemy.x, enemy.y - enemy.cfg.radius, Math.round(amount));
      this.fx.burst(enemy.x, enemy.y, 'red', 4);
      SFX.hit();
    });
    this.events.on('enemy-died', (enemy) => {
      // ── HOTLINE-MIAMI KILL JUICE ──────────────────────────────────────
      // Big blood burst + persistent splatter pool that stays for the room.
      this.fx.burst(enemy.x, enemy.y, 'red', 26);
      this.spawnBloodSplatter(enemy.x, enemy.y);
      // Beefier shake than before for kill weight.
      this.fx.shake(0.009, 110);
      // Universal hit-pause on every kill — 45ms freeze for crisp impact.
      this.physics.world.pause();
      this.time.delayedCall(45, () => this.physics.world.resume());
      // Camera punch-zoom — brief 1.04x snap that decays.
      this._cameraPunch(1.04, 220);
      this.roomManager.onEnemyDied();
      if (Math.random() < HEALTH_ORB.dropChance) this.spawnHealthOrb(enemy.x, enemy.y);
    });
    this.events.on('player-hurt', (amount) => {
      this.fx.shake(0.008, 110);
      this.cameras.main.flash(120, 255, 80, 80, true);
      this.fx.hitFlash(this.player);
      this.fx.damageNumber(this.player.x, this.player.y - 40, Math.round(amount || 0), '#ff4040');
      this.fx.burst(this.player.x, this.player.y, 'red', 6);
    });
    this.events.on('player-dead', () => {
      this.fx.burst(this.player.x, this.player.y, 'red', 30);
      this.fx.shake(0.02, 500);
      this.time.delayedCall(900, () => this._handlePlayerDeath());
    });
    this.events.on('grunt-melee', (g) => this.fx.burst(g.x, g.y, 'red', 6));

    // Enemies cleared → mark it; the door only opens once terminals are also done.
    this.events.on('room-cleared', (spec) => {
      if (spec.boss) return; // boss room ends via boss-died
      this._enemiesCleared = true;
      this.time.delayedCall(400, () => this._maybeCompleteRoom());
    });

    // A terminal finished hacking → tally it and re-check room completion.
    this.events.on('terminal-hacked', () => {
      this._terminalsHacked += 1;
      this.events.emit('objective-update', this._terminalsHacked, this._terminalsTotal);
      this.fx.shake(0.004, 80);
      const remaining = this._terminalsTotal - this._terminalsHacked;
      this.events.emit('show-banner',
        remaining > 0 ? `TERMINAL SLICED  ${this._terminalsHacked}/${this._terminalsTotal}` : 'ALL TERMINALS SLICED',
        '#ffd040');
      this._maybeCompleteRoom();
    });

    // Mini-game completion bridges to the terminal.
    this.events.on('hack-success', (terminal) => {
      terminal?.complete();
      this._activeHackTarget = null;
    });
    // Mini-game failure → trip the room alarm just like blowing your cover.
    this.events.on('hack-fail', () => {
      // Alert every patrolling enemy in the room and arm reinforcements.
      this.events.emit('room-alarm');
      this._onFirstAlarm();
    });

    // Boss start event forwarded from loadRoom
    this.events.on('boss-start', () => {
      this.events.emit('show-banner', 'VADER APPROACHES', '#ff2828');
    });
  }

  // ── Lives / death ─────────────────────────────────────────────────────────

  _handlePlayerDeath() {
    this.lives -= 1;
    this.events.emit('lives-changed', this.lives);

    if (this.lives <= 0) {
      this.defeat();
      return;
    }

    // Respawn at room entrance after short pause
    this.time.delayedCall(400, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        // Revive player
        this.player.hp       = PLAYER.hp;
        this.player.alive    = true;
        this.player.ammo     = PLAYER.ammoMax;
        this.player.ammoTimers = [];
        this.player.superCharge = 0;
        this.player.setAlpha(1);
        this.player.setScale(1);
        this.player.setActive(true).setVisible(true);
        const spawn = this.roomSpec?.spawn ?? { x: 200, y: 200 };
        this.player.setPosition(spawn.x, spawn.y);
        this.player.setVelocity(0, 0);
        this.player.play('mando-idle');
        this.events.emit('player-hp-changed');
        this.events.emit('player-ammo-changed');
        this.events.emit('player-super-changed');
        this.cameras.main.fadeIn(300, 0, 0, 0);
      });
    });
  }

  // ── Firing helpers ────────────────────────────────────────────────────────

  firePlayerPrimary(angle) {
    const bx = this.player.x + Math.cos(angle) * (PLAYER.radius + 4);
    const by = this.player.y + Math.sin(angle) * (PLAYER.radius + 4);
    const spread = Phaser.Math.DegToRad(PLAYER.pelletSpreadDeg);
    const half   = (PLAYER.pelletCount - 1) / 2;
    for (let i = 0; i < PLAYER.pelletCount; i++) {
      const a = angle + (i - half) * (spread / Math.max(1, PLAYER.pelletCount - 1));
      this.playerBullets.fire(bx, by, a, PLAYER.pelletSpeed, PLAYER.pelletDamage, PLAYER.pelletRange, { owner: 'player' });
    }
    this.fx.muzzleFlash(bx, by, angle);
    // Tiny shake on every shot — gives the pistol some weight without
    // overwhelming the bigger super/explosion shakes.
    this.fx.shake(0.0035, 55);
  }

  firePlayerSuper(angle) {
    const bx = this.player.x + Math.cos(angle) * (PLAYER.radius + 6);
    const by = this.player.y + Math.sin(angle) * (PLAYER.radius + 6);
    const spread = Phaser.Math.DegToRad(PLAYER.superSpreadDeg);
    const half   = (PLAYER.superPellets - 1) / 2;
    for (let i = 0; i < PLAYER.superPellets; i++) {
      const a = angle + (i - half) * (spread / Math.max(1, PLAYER.superPellets - 1));
      this.playerSuperBullets.fire(bx, by, a, PLAYER.superSpeed, PLAYER.superDamage, PLAYER.superRange,
        { owner: 'player', piercing: true, knockback: PLAYER.superKnockback });
    }
    this.fx.muzzleFlash(bx, by, angle);
    this.fx.shake(0.012, 180);
    duckMusic(0.4, 400);
  }

  firePlayerRifle(angle) {
    const cfg = WEAPONS.rifle;
    const bx  = this.player.x + Math.cos(angle) * (PLAYER.radius + 4);
    const by  = this.player.y + Math.sin(angle) * (PLAYER.radius + 4);
    // Single tight bolt per burst shot
    this.playerRifleBullets.fire(bx, by, angle, cfg.speed, cfg.damage, cfg.range, { owner: 'player' });
    this.fx.muzzleFlash(bx, by, angle);
  }

  detonateGrenade(x, y, damage, radius) {
    this.fx.explosion(x, y, 2.5);
    this.fx.burst(x, y, 'yellow', 20);
    this.fx.burst(x, y, 'red', 20);
    this.fx.shake(0.018, 280);
    duckMusic(0.5, 500);
    SFX.bossDie(); // big boom reuse
    // AoE enemies
    const r2 = radius * radius;
    const targets = [...this.enemies.getChildren()];
    if (this.boss?.alive) targets.push(this.boss);
    for (const t of targets) {
      if (!t.active || !t.alive) continue;
      if ((t.x - x) ** 2 + (t.y - y) ** 2 < r2) {
        t.damage(damage);
        this.player.addSuperHit();
      }
    }
    // Damage number
    this.fx.damageNumber(x, y - 40, damage, '#ffdd20', true);
  }

  fireShooter(shooter, angle) {
    const bx = shooter.x + Math.cos(angle) * (shooter.cfg.radius + 4);
    const by = shooter.y + Math.sin(angle) * (shooter.cfg.radius + 4);
    this.enemyBullets.fire(bx, by, angle,
      ENEMY.shooter.bulletSpeed, ENEMY.shooter.bulletDamage, ENEMY.shooter.bulletRange,
      { owner: 'enemy' });
    SFX.enemyShoot();
  }

  fireBossFan(boss, angle) {
    const spread = Phaser.Math.DegToRad(BOSS.fanSpreadDeg);
    const half   = (BOSS.fanPellets - 1) / 2;
    for (let i = 0; i < BOSS.fanPellets; i++) {
      const a  = angle + (i - half) * (spread / Math.max(1, BOSS.fanPellets - 1));
      const bx = boss.x + Math.cos(a) * (boss.cfg.radius + 6);
      const by = boss.y + Math.sin(a) * (boss.cfg.radius + 6);
      this.enemyBullets.fire(bx, by, a,
        BOSS.fanBulletSpeed, BOSS.fanBulletDamage, BOSS.fanBulletRange, { owner: 'boss' });
    }
    SFX.enemyShoot();
    SFX.bossRoar();
  }

  bossSpawnMinions() {
    for (let i = 0; i < BOSS.spawnCount; i++) {
      this.time.delayedCall(i * 120, () => this.spawnEnemyRandom('grunt'));
    }
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  update(time, delta) {
    if (!this.player) return;

    // Bush hiding
    const actors = [this.player, ...this.enemies.getChildren()];
    if (this.boss) actors.push(this.boss);
    this.bushSystem.update(actors);

    // Aim cone
    this.drawAimCone();

    // Patrol enemy vision cones
    this._drawPatrolVision();

    // AI debug overlay (D key)
    this._drawAIDebug();

    // Reinforcement timer + door
    this._tickReinforcements(delta);

    // Health orbs
    this.updateHealthOrbs(delta);

    // Weapon pickup checks
    for (const p of this.weaponPickups) p.checkPickup(this.player);

    // Objective terminals — update visuals + show the contextual HACK
    // button when the player is on a slicable terminal. The puzzle itself
    // is NEVER auto-opened; the player taps HACK (or presses E) to start.
    if (this.terminals.length) {
      let nearest = null;
      for (const t of this.terminals) {
        t.update(delta, this.player);
        if (!nearest && !t.hacked && t.inRange(this.player)) nearest = t;
      }
      // The button shows whenever in range; selection persists until you
      // leave that terminal's radius.
      if (nearest !== this._hackPromptTarget) {
        this._hackPromptTarget = nearest;
        this.events.emit('hack-prompt', !!nearest);
      }
      // If a mini-game is in flight on a terminal we walked away from, cancel.
      if (this._activeHackTarget && !this._activeHackTarget.inRange(this.player)) {
        this._activeHackTarget = null;
        this.events.emit('hack-cancel');
      }
    }

    // Door trigger check
    this._checkDoorTrigger();

    // Stealth takedown target
    this._updateTakedownTarget();

    // Flamethrower continuous damage cone
    this.handleFlamethrower(delta);

    // Bullets
    this.handleBulletEnemyHits(this.playerBullets, false);
    this.handleBulletEnemyHits(this.playerRifleBullets, false);
    this.handleBulletEnemyHits(this.playerSuperBullets, true);
    this.handleEnemyBulletsVsPlayer();
    this.handleBulletWallHits(this.playerBullets, false);
    this.handleBulletWallHits(this.playerRifleBullets, false);
    this.handleBulletWallHits(this.playerSuperBullets, true);
    this.handleBulletWallHits(this.enemyBullets, false);

    // Desktop keyboard movement
    if (this.cursors || this.keys) {
      const k    = this.keys || {};
      const left  = this.cursors?.left.isDown  || k.A?.isDown;
      const right = this.cursors?.right.isDown || k.D?.isDown;
      const up    = this.cursors?.up.isDown    || k.W?.isDown;
      const down  = this.cursors?.down.isDown  || k.S?.isDown;
      const vx   = (right ? 1 : 0) - (left ? 1 : 0);
      const vy   = (down  ? 1 : 0) - (up   ? 1 : 0);
      const any  = left || right || up || down;
      if (any) {
        const m = Math.hypot(vx, vy) || 1;
        this.player.setMoveInput({ x: vx / m, y: vy / m, force: 1 });
        this._kbdActive = true;
      } else if (this._kbdActive) {
        this.player.setMoveInput({ x: 0, y: 0, force: 0 });
        this._kbdActive = false;
      }
    }
  }

  // ── Flamethrower ──────────────────────────────────────────────────────────

  handleFlamethrower(delta) {
    const p = this.player;
    const g = this.flameGraphics;
    g.clear();
    if (!p?.alive || !p.flameActive || p.secondary !== 'flamethrower') return;

    const cfg     = WEAPONS.flamethrower;
    const angle   = p.flameAngle;
    const range   = cfg.range;
    const halfRad = Phaser.Math.DegToRad(cfg.halfAngleDeg);

    // Draw flame cone (orange-yellow gradient bands)
    const bands = [
      { reach: 1.0, color: 0xff4400, alpha: 0.30 },
      { reach: 0.65, color: 0xff8800, alpha: 0.42 },
      { reach: 0.35, color: 0xffcc00, alpha: 0.55 },
    ];
    const steps = 14;
    for (const band of bands) {
      const r = range * band.reach;
      g.fillStyle(band.color, band.alpha);
      g.beginPath();
      g.moveTo(p.x, p.y);
      for (let i = 0; i <= steps; i++) {
        const a = angle - halfRad + (halfRad * 2 * i) / steps;
        g.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      }
      g.closePath();
      g.fillPath();
    }

    // Damage tick
    this._flameTick = (this._flameTick || 0) + delta;
    const tickMs = 120;
    if (this._flameTick >= tickMs) {
      this._flameTick -= tickMs;
      const dmgPerTick = (cfg.damagePerSec * tickMs) / 1000;
      const targets = [...this.enemies.getChildren()];
      if (this.boss?.alive) targets.push(this.boss);
      for (const t of targets) {
        if (!t.active || !t.alive) continue;
        const dx = t.x - p.x, dy = t.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist > range + t.cfg.radius) continue;
        const angleTo = Math.atan2(dy, dx);
        const diff    = Math.abs(Phaser.Math.Angle.Wrap(angleTo - angle));
        if (diff < halfRad) {
          t.damage(dmgPerTick);
          p.addSuperHit();
          this.fx.burst(t.x, t.y, 'yellow', 2);
        }
      }
    }

    // Drain fuel
    p.consumeFlame(delta);
  }

  // ── Collision helpers ─────────────────────────────────────────────────────

  handleBulletEnemyHits(group, isSuper) {
    const bullets  = group.getChildren();
    const enemies  = this.enemies.getChildren();
    for (const b of bullets) {
      if (!b.active) continue;
      // Boss
      if (this.boss?.alive && !b.hitSet.has(this.boss)) {
        if (this.circleOverlap(b, this.boss)) {
          b.hitSet.add(this.boss);
          // Boss ignores knockback in its damage override — pass it anyway.
          const kbVec = { x: b.body.velocity.x * 0.15, y: b.body.velocity.y * 0.15 };
          this.boss.damage(b.damage, kbVec);
          // Heavier directional spark — boss armor deflects more
          const flightAng = Math.atan2(b.body.velocity.y, b.body.velocity.x);
          this.fx.burstDir(b.x, b.y, 'yellow', isSuper ? 18 : 10, flightAng, 100);
          this.player.addSuperHit();
          if (!b.piercing) { if (isSuper) this.fx.explosion(b.x, b.y, 1.8); b.kill(); }
        }
      }
      if (!b.active) continue;
      for (const e of enemies) {
        if (!e.active || !e.alive || b.hitSet.has(e)) continue;
        if (this.circleOverlap(b, e)) {
          b.hitSet.add(e);
          // Every bullet knocks: super pellets shove hard, normal shots
          // give a punchy stagger in flight direction. Hotline-feel.
          const kbScale = isSuper ? 0.32 : 0.18;
          const kbVec = { x: b.body.velocity.x * kbScale, y: b.body.velocity.y * kbScale };
          e.damage(b.damage, kbVec);
          // Directional impact spray — sparks fly forward along the bullet
          // path with a wide cone, like a deflection ricochet.
          const flightAng = Math.atan2(b.body.velocity.y, b.body.velocity.x);
          this.fx.burstDir(b.x, b.y, 'red', isSuper ? 14 : 7, flightAng, 80);
          this.player.addSuperHit();
          if (!b.piercing) { if (isSuper) this.fx.explosion(b.x, b.y, 1.4); b.kill(); break; }
        }
      }
    }
  }

  handleEnemyBulletsVsPlayer() {
    for (const b of this.enemyBullets.getChildren()) {
      if (!b.active) continue;
      if (this.circleOverlap(b, this.player)) {
        this.player.damage(b.damage);
        b.kill();
      }
    }
  }

  handleBulletWallHits(group, isSuper = false) {
    const bullets = group.getChildren();
    if (!bullets.length) return;
    const walls = this.walls.getChildren();
    for (const b of bullets) {
      if (!b.active) continue;
      for (const w of walls) {
        if (!w.active) continue;
        if (b.x > w.x - 56 && b.x < w.x + 56 && b.y > w.y - 56 && b.y < w.y + 56) {
          // Directional ricochet sparks: bullet hit a wall, sparks deflect
          // along the reverse flight direction (i.e. bounce back at us).
          const flightAng = Math.atan2(b.body.velocity.y, b.body.velocity.x);
          const ricochetAng = flightAng + Math.PI;
          this.fx.burstDir(b.x, b.y, 'yellow', isSuper ? 14 : 6, ricochetAng, 70);
          if (isSuper) { this.fx.explosion(b.x, b.y, 1.2); this.fx.shake(0.005, 60); }
          b.kill();
          break;
        }
      }
    }
  }

  updateHealthOrbs(delta) {
    const p = this.player;
    const pickupR = HEALTH_ORB.radius + PLAYER.radius;
    let i = this.healthOrbs.length;
    while (i--) {
      const orb = this.healthOrbs[i];
      orb.life -= delta;
      if (orb.life <= 0) {
        this.tweens.killTweensOf(orb.gfx); orb.gfx.destroy();
        this.healthOrbs.splice(i, 1); continue;
      }
      if (orb.life < 1500) orb.gfx.setAlpha(orb.life / 1500);
      const dx = p.x - orb.x, dy = p.y - orb.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 80 && p.alive) {
        const move = Math.min(dist, 320 * delta / 1000);
        orb.x += (dx / dist) * move; orb.y += (dy / dist) * move;
        orb.gfx.setPosition(orb.x, orb.y);
      }
      if (dist < pickupR && p.alive && p.hp < p.hpMax) {
        const healed = Math.min(HEALTH_ORB.healAmount, p.hpMax - p.hp);
        p.hp = Math.min(p.hpMax, p.hp + HEALTH_ORB.healAmount);
        p.scene.events.emit('player-hp-changed');
        this.fx.damageNumber(orb.x, orb.y - 20, `+${Math.round(healed)} HP`, '#40b8ff', false);
        this.fx.burst(orb.x, orb.y, 'yellow', 8);
        this.tweens.killTweensOf(orb.gfx); orb.gfx.destroy();
        this.healthOrbs.splice(i, 1); SFX.heal();
      }
    }
  }

  circleOverlap(a, b) {
    const ra   = (a.body?.width || 14) / 2;
    const rb   = b.cfg?.radius ?? (b === this.player ? PLAYER.radius : 22);
    return Math.hypot(a.x - b.x, a.y - b.y) < ra + rb - 2;
  }

  // ── Aim cone ─────────────────────────────────────────────────────────────

  // Render a soft vision cone on each patrolling enemy. Yellow when they
  // can't see the player, red when the player is inside the cone.
  _drawPatrolVision() {
    const g = this.visionGraphics;
    g.clear();
    const p = this.player;
    if (!p?.alive) return;

    const steps    = 14;
    const range    = VISION_RANGE;
    const halfAng  = VISION_HALF_ANGLE;

    for (const e of this.enemies.getChildren()) {
      if (!e.active || !e.alive) continue;
      if (e.state !== ST.PATROL) continue;
      const facing = e.rotation - Math.PI / 2;
      // Is the player inside the cone (and visible)?
      let seen = false;
      if (!p.hiddenInBush) {
        const dx = p.x - e.x, dy = p.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist < range) {
          const angTo = Math.atan2(dy, dx);
          const diff  = Phaser.Math.Angle.Wrap(angTo - facing);
          if (Math.abs(diff) < halfAng) seen = true;
        }
      }
      const color = seen ? 0xff4040 : 0xffdd40;
      const alpha = seen ? 0.20    : 0.10;
      g.fillStyle(color, alpha);
      g.beginPath();
      g.moveTo(e.x, e.y);
      for (let i = 0; i <= steps; i++) {
        const a = facing - halfAng + (halfAng * 2 * i) / steps;
        g.lineTo(e.x + Math.cos(a) * range, e.y + Math.sin(a) * range);
      }
      g.closePath();
      g.fillPath();
      // Subtle outline
      g.lineStyle(1, color, alpha * 2);
      g.strokePath();
    }
  }

  // ── AI debug overlay ─────────────────────────────────────────────────────
  // Press D in-game to toggle. Draws a state-coloured dot above each enemy
  // and a line to its current movement target so stuck states are obvious.

  _drawAIDebug() {
    if (!this.debugAI) { this.debugGraphics?.clear(); return; }
    const g = this.debugGraphics;
    g.clear();

    const STATE_COL = {
      [ST.PATROL]:     0x00ff00,
      [ST.ALERT]:      0xffff00,
      [ST.CHASE]:      0xff2020,
      [ST.COVER_MOVE]: 0xff8800,
      [ST.SUPPRESS]:   0x2080ff,
      [ST.REPOSITION]: 0xff00ff,
      [ST.FLANK]:      0x00ffff,
      [ST.ADVANCE]:    0xffffff,
    };

    for (const e of this.enemies.getChildren()) {
      if (!e.active || !e.alive) continue;
      const col = STATE_COL[e.state] ?? 0xffffff;

      // State indicator — coloured dot above enemy
      g.fillStyle(col, 0.95);
      g.fillCircle(e.x, e.y - e.cfg.radius - 30, 8);

      // Target line
      let tx = null, ty = null;
      switch (e.state) {
        case ST.CHASE:
        case ST.ADVANCE:
          tx = e.lastKnownX; ty = e.lastKnownY; break;
        case ST.COVER_MOVE:
        case ST.SUPPRESS:
        case ST.REPOSITION:
          tx = e.standPos?.x ?? e.coverSpot?.x;
          ty = e.standPos?.y ?? e.coverSpot?.y; break;
        case ST.FLANK:
          if (e.flankTarget) { tx = e.flankTarget.x; ty = e.flankTarget.y; } break;
        default: break;
      }
      if (tx != null) {
        g.lineStyle(2, col, 0.7);
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(tx, ty); g.strokePath();
        g.fillStyle(col, 0.45); g.fillCircle(tx, ty, 10);
      }
    }
  }

  drawAimCone() {
    const g = this.aimGraphics;
    g.clear();
    const p = this.player;
    if (!p?.alive) return;
    const gap = PLAYER.radius + 6;
    if (p.superAiming && p.superCharge >= PLAYER.superHitsToCharge) {
      this.drawCone(g, p.x, p.y, p.superAim,
        Phaser.Math.DegToRad(PLAYER.superSpreadDeg), PLAYER.superRange, gap,
        0xff2020, 0xff8080, 0.30);
    } else if (p.aiming) {
      this.drawCone(g, p.x, p.y, p.aim,
        Phaser.Math.DegToRad(PLAYER.pelletSpreadDeg), PLAYER.pelletRange, gap,
        0xff2828, 0xff9090, 0.18);
    }
  }

  drawCone(g, x, y, angle, spread, range, startGap, color, tipColor, baseAlpha) {
    const half = spread / 2;
    const steps = 16;
    const bands = [
      { reach: 1.0, alpha: baseAlpha * 0.75 },
      { reach: 0.55, alpha: baseAlpha },
    ];
    for (const band of bands) {
      const r = startGap + (range - startGap) * band.reach;
      g.fillStyle(color, band.alpha);
      g.beginPath();
      g.moveTo(x + Math.cos(angle - half) * startGap * 0.6,
               y + Math.sin(angle - half) * startGap * 0.6);
      for (let i = 0; i <= steps; i++) {
        const a = angle - half + (spread * i) / steps;
        g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      g.lineTo(x + Math.cos(angle + half) * startGap * 0.6,
               y + Math.sin(angle + half) * startGap * 0.6);
      g.closePath();
      g.fillPath();
    }
    const tipX = x + Math.cos(angle) * range;
    const tipY = y + Math.sin(angle) * range;
    g.fillStyle(tipColor, 0.22); g.fillCircle(tipX, tipY, 20);
    g.fillStyle(tipColor, 0.55); g.fillCircle(tipX, tipY, 10);
  }

  // ── End states ────────────────────────────────────────────────────────────

  victory() { this.scene.start('GameOver', { win: true }); }
  defeat()  { this.scene.start('GameOver', { win: false }); }
}
