import Phaser from 'phaser';
import { PLAYER, ENEMY, BOSS, HEALTH_ORB, WEAPONS, ARENA, MODIFIERS, ALLY } from '../config.js';
import { Player } from '../entities/Player.js';
import { EnemyGrunt, EnemyShooter, EnemyBomber, EnemyShielded, EnemySniper, EnemySwarmling, ST, VISION_RANGE, VISION_HALF_ANGLE } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { BulletGroup } from '../entities/Bullet.js';
import { BushSystem } from '../systems/BushSystem.js';
import { RoomManager } from '../systems/RoomManager.js';
import { CoverRegistry } from '../systems/CoverRegistry.js';
import { WeaponPickup } from '../entities/WeaponPickup.js';
import { Terminal } from '../entities/Terminal.js';
import { attachFX, SFX, startMusic, duckMusic, stopMusic } from '../systems/FX.js';
import { ROOMS } from '../data/rooms.js';
import { NARRATIVE } from '../data/narrative.js';
import { NavGrid } from '../systems/NavGrid.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create(data) {
    // ── Run mode ─────────────────────────────────────────────────────────
    // 'campaign' plays the authored ROOMS sequence once to Vader. 'endless'
    // loops the non-boss arena rooms forever with rising difficulty (see
    // _applySectorScaling / _transitionToNext) until the player dies.
    this.mode   = data?.mode || 'campaign';
    this.sector = 1;
    // Endless-only per-enemy multipliers, read by spawnEnemyAt; _applySectorScaling
    // raises these as `sector` climbs. Campaign never touches them past 1.
    this.enemyHpMult    = 1;
    this.enemySpeedMult = 1;

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
    // Looser follow lerp so the camera trails the player by a couple of
    // frames. With the acceleration ramp on Player movement, a tight lerp
    // (0.5) was eating the weight curve by chasing the player instantly;
    // 0.22 lets the ramp register on screen as actual physical motion.
    // The aim-lookahead `_camOX/_camOY` smoothing still carries the snap.
    this.cameras.main.startFollow(this.player, true, 0.22, 0.22);

    // ── Bush / cover system ────────────────────────────────────────────────
    this.bushSystem = new BushSystem(this);

    // ── NavGrid pathfinding ────────────────────────────────────────────────
    this.navGrid = new NavGrid(this, 80);

    // ── Aim cone + flame cone overlays ────────────────────────────────────
    this.aimGraphics   = this.add.graphics().setDepth(25);
    this.flameGraphics = this.add.graphics().setDepth(24);

    // ── Patrol vision cones (drawn under enemies) ─────────────────────────
    this.visionGraphics = this.add.graphics().setDepth(2);

    // ── Stealth takedown hint ring ─────────────────────────────────────────
    this.takedownGfx = this.add.graphics().setDepth(27);
    this._takedownTarget = null;
    this.lockGfx = this.add.graphics().setDepth(15);
    this.reloadGfx = this.add.graphics().setDepth(28);
    this.reloadAlpha = 0;

    // ── Persistent Run Stats (accumulates over entire run) ───────────────
    this.runStartTime      = this.time.now;
    this.runStealthKills   = 0;
    this.runDamageTaken    = 0;
    this.runKills          = 0;

    // ── Weapon pickups (cleared per room) ──────────────────────────────────
    this.weaponPickups = [];

    // ── Objective terminals (cleared per room) ──────────────────────────────
    this.terminals = [];

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

    // ── AI debug overlay (press U or Backtick to toggle) ──────────────────
    this.debugGraphics = this.add.graphics().setDepth(120);
    this.debugTexts = [];
    this.debugAI = false;
    const toggleDebug = () => {
      this.debugAI = !this.debugAI;
      if (!this.debugAI) {
        this.debugGraphics.clear();
        this.debugTexts.forEach(t => t.setVisible(false));
      }
    };
    this.input.keyboard?.on('keydown-U', toggleDebug);
    this.input.keyboard?.on('keydown-BACKTICK', toggleDebug);

    // ── Event wiring ───────────────────────────────────────────────────────
    this.bindEvents();

    // ── Launch HUD ─────────────────────────────────────────────────────────
    this.scene.launch('HUD', { game: this });

    // ── Start music on first gesture ───────────────────────────────────────
    this.input.once('pointerdown', () => startMusic());
    this.input.keyboard?.once('keydown', () => startMusic());

    // ── Desktop keyboard fallback ──────────────────────────────────────────
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys    = this.input.keyboard?.addKeys('W,A,S,D,SHIFT,F,ENTER,E');
    // SPACE = super: tap → auto-aim + fire; hold ≥250ms → manual aim (cone
    // tracks facing), fires on release. If the super isn't charged, tap falls
    // back to a primary auto-aim shot so Space always does something.
    this._spaceDownAt = 0;
    this.input.keyboard?.on('keydown-SPACE', (ev) => {
      if (ev.repeat) return;
      const p = this.player;
      if (!p?.alive) return;
      if ((p.superCharge ?? 0) >= PLAYER.superHitsToCharge) {
        this._spaceDownAt = this.time.now;
        p.beginKeyboardSuperAim();
      } else {
        this._spaceDownAt = 0;
        p.keyboardFire();
      }
    });
    this.input.keyboard?.on('keyup-SPACE', () => {
      const p = this.player;
      if (!p?.alive || !this._spaceDownAt) return;
      const held = this.time.now - this._spaceDownAt;
      this._spaceDownAt = 0;
      p.endKeyboardSuperAim(held >= 250);
    });
    this.input.keyboard?.on('keydown-ENTER', () => this.player?.tryFireSuper());
    this.input.keyboard?.on('keydown-F', () => this.player?.tryFireSuper());
    this.input.keyboard?.on('keydown-SHIFT', () => this.player?.tryDash());
    this.input.keyboard?.on('keydown-E', () => {
      if (this._takedownTarget) {
        this.performTakedown();
      } else if (this._hackPromptTarget) {
        this.requestHack();
      }
    });

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

    // Floor-decal RenderTexture — blood/scorch/craters are baked into this
    // single canvas instead of staying live Graphics nodes. A 60-75s survival
    // round can rack up hundreds of decals; individually they re-batch every
    // frame and cause progressive FPS decay, baked they're one draw call at
    // constant cost regardless of count. Destroyed with the room via the
    // generic roomLayer sweep in _clearRoomEntities.
    this.decalRT = this.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(2);
    this.roomLayer.add(this.decalRT);

    // Walls — Y-sorted by bottom edge of the 112-px tile so entities standing
    // south of a wall draw IN FRONT and entities north draw behind. This is
    // what gives the arena its top-down 3D-ish space.
    for (const wp of spec.walls) {
      const wall = this.walls.create(wp.x, wp.y, 'wall');
      wall.setDepth(wp.y + 56).refreshBody();
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
      con.setDepth(cp.y + 56);
      con.body.setSize(70, 70).setOffset((con.width - 70) / 2, (con.height - 70) / 2);
      con.refreshBody();
      this.roomLayer.add(con);
      this.bushSystem.add(con, 55);
    }

    // Rebuild pathfinding navigation grid
    this.navGrid.build(w, h, this.walls.getChildren());

    // Cache static wall/cover body rects for LOS checks — walls only change
    // on room load, so enemies shouldn't rebuild Geom objects per raycast.
    this.losRects = this.walls.getChildren()
      .filter((w2) => w2.active && w2.body)
      .map((w2) => new Phaser.Geom.Rectangle(w2.body.x, w2.body.y, w2.body.width, w2.body.height));

    // Remove any stale room-alarm / stealth listeners from previous rooms
    this.events.off('room-alarm-klaxon');
    this.events.off('stealth-kill');

    // Reset stealth tracking for the new room
    this.stealthKills      = 0;
    this._takedownTarget   = null;
    this.takedownGfx.clear();
    this.events.emit('takedown-available', false);

    // First room-alarm of the room fires the klaxon banner
    this.events.on('room-alarm-klaxon', () => this._onFirstAlarm());
    this.events.on('stealth-kill', () => {
      this.stealthKills += 1;
      this.runStealthKills += 1;
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
    this._comboCount       = 0;
    this._lastKillTime     = -99999;
    this.events.emit('hack-cancel');   // close any leftover mini-game
    this.events.emit('hack-prompt', false);
    this.events.emit('objective-update', this._terminalsHacked, this._terminalsTotal);

    // Spawn enemies listed in the spec (each gets the cover registry injected)
    spec.enemies.forEach((enemySpec) => this.spawnEnemyAt(enemySpec.type, enemySpec.x, enemySpec.y, enemySpec));

    // Boss room
    if (spec.boss) {
      // Dual climax: a full survival round first, then Vader spawns.
      this._startArena(ARENA[spec.id] ?? ARENA.vader);
      this.time.delayedCall(1700, () => {
        this.events.emit('show-banner', 'SURVIVE THE SWARM', '#ff2020');
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

    // Arena wave survival announcement (non-boss). _startWave(0) fires the
    // "WAVE 1" banner itself, so we just kick it off + the terminal hint.
    if (!spec.boss) {
      const arenaCfg = ARENA[spec.id];
      if (arenaCfg) {
        this._startArena(arenaCfg);
        if (this._terminalsTotal > 0) {
          // Sequence behind the modifier banner (~1550ms) when one is present
          // so the single banner object isn't clobbered mid-announce.
          const hintAt = this._roomModifier ? 3100 : 1750;
          this.time.delayedCall(hintAt, () => this.events.emit('show-banner', 'SLICE TERMINALS FOR SUPPORT', '#ffd040'));
        }
      }
    }
  }

  // Initialize a wave-clear round from an ARENA config entry. The room-level
  // cfg is kept as the per-wave default set (_roomArenaCfg); _startWave then
  // merges each wave's overrides over it into this.arenaCfg (the object the
  // drip/roll/spawn code already reads). Waves drive the round now — the old
  // survival clock is gone.
  _startArena(cfg) {
    this._roomArenaCfg    = cfg;
    this.arenaActive      = true;
    this.survivalTimeLeft = 0;   // legacy field kept 0 so old guards fall through
    this._waveIdx         = -1;  // _startWave(0) advances to 0
    this._lastLiving      = -1;
    // Resolve this room's modifier: campaign uses the authored cfg.modifier;
    // endless rolls one at random every room for variety across the climb.
    if (this.mode === 'endless') {
      const pool = Object.values(MODIFIERS);
      this._roomModifier = pool[Math.floor(Math.random() * pool.length)];
    } else {
      this._roomModifier = MODIFIERS[cfg.modifier] || null;
    }
    this._startWave(0);

    // Announce after WAVE 1's banner so the modifier reads as the second beat,
    // and drive the persistent HUD label + darkness overlay.
    const m = this._roomModifier;
    this.events.emit('modifier-active', m?.name ?? null, m?.color ?? null);
    this.events.emit('set-darkness', !!m?.darkness);
    if (m) this.time.delayedCall(1550, () => this.events.emit('show-banner', m.name, m.color));
  }

  // Apply this room's modifier on top of the merged wave cfg. Effects: ELITE
  // GUARD raises the elite floor (wins over a wave's own eliteChance), FRENZY
  // speeds up spawns and carries a speedMult the spawn hook reads per-enemy.
  _applyModifier(cfg) {
    const m = this._roomModifier;
    if (!m) return cfg;
    const out = { ...cfg };
    if (m.eliteChance   != null) out.eliteChance = Math.max(out.eliteChance ?? 0, m.eliteChance);
    if (m.spawnRateMult)         out.spawnRate   = Math.round(out.spawnRate * m.spawnRateMult);
    if (m.speedMult)             out.speedMult   = m.speedMult;
    return out;
  }

  // Endless-only difficulty ramp, composed after the room modifier. `sector`
  // rises by 1 every room loop (_transitionToNext); scaling is deliberately
  // gentle per step since it compounds indefinitely across a long run.
  // Campaign never enters here (mode check), so it's a pure no-op there.
  _applySectorScaling(cfg) {
    if (this.mode !== 'endless') return cfg;
    const s = Math.max(0, this.sector - 1); // 0 at the first endless room
    const out = { ...cfg };
    out.count       = Math.round(out.count * (1 + s * 0.12));
    out.maxAlive    = out.maxAlive + Math.min(10, Math.floor(s * 1.2));
    out.spawnRate   = Math.round(out.spawnRate * Math.max(0.55, 1 - s * 0.035));
    out.eliteChance = Math.min(0.6, Math.max(out.eliteChance ?? 0, 0.05 + s * 0.025));
    this.enemyHpMult    = 1 + s * 0.08;
    this.enemySpeedMult = Math.min(1.6, 1 + s * 0.02);
    return out;
  }

  // Begin wave `idx`: merge its overrides over the room defaults, reset the
  // spawn budget, announce it, and (if a mini-boss wave) spawn the capstone.
  _startWave(idx) {
    const waves = this._roomArenaCfg?.waves;
    if (!waves || idx >= waves.length) return;
    const wave = waves[idx];
    this._waveIdx    = idx;
    this._wave       = wave;
    // drip/roll/elite all read this merged object
    this.arenaCfg    = this._applySectorScaling(this._applyModifier({ ...this._roomArenaCfg, ...wave }));
    this._wavePhase  = 'spawning';
    this._waveSpawned = 0;
    this._waveDripMs  = 0;
    this.events.emit('wave-update', idx + 1, waves.length);

    if (wave.miniBoss) {
      this.events.emit('show-banner', 'MINI-BOSS', '#ff8020');
      SFX.bossRoar?.();
      this.cameras.main.flash(300, 255, 90, 20, false);
      this.fx.shake(0.02, 300);
      this._spawnMiniBoss();
    } else {
      this.events.emit('show-banner', `WAVE ${idx + 1}`, '#40c0ff');
    }
  }

  // Full teardown of an enemy plus every attached scene object. Bulk-destroy
  // paths MUST use this — partial cleanup orphans weaponSprite/threatRing/
  // alertMark as unkillable visual ghosts.
  _destroyEnemyFully(e) {
    try {
      this.enemies.remove(e);
      e.shadow?.destroy(); e.hpBar?.destroy();
      e.alertMark?.destroy(); e.threatRing?.destroy(); e.weaponSprite?.destroy();
      e._attachments?.forEach((a) => a?.destroy?.()); // shield arcs etc.
      if (e.scene) e.destroy();
    } catch (_) {}
  }

  _clearRoomEntities() {
    // Destroy all enemies still alive (dead ones already cleaned themselves up)
    this.enemies.getChildren().slice().forEach((e) => this._destroyEnemyFully(e));
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

    // ── Sliding-panel unseal animation ─────────────────────────────────
    // Two green panels slide outward from the centre of the door, briefly
    // showing the opening before fading. A bright flash punctuates the
    // unlock; sparkles fly out for emphasis.
    this._playDoorOpenAnim(spec);

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

  // Sliding-panel unseal animation that plays once when an exit unlocks.
  // Reads as the blast door retracting. Lives in roomLayer so it gets
  // cleaned up at room change.
  _playDoorOpenAnim(spec) {
    const { w, h } = spec.bounds;
    const { x, y, side } = spec.exit;
    const horiz = side === 'right' || side === 'left';
    const cx = side === 'right' ? w : side === 'left' ? 0 : x;
    const cy = side === 'bottom' ? h : side === 'top' ? 0 : y;
    const panelLen = 90;
    const panelW = 16;
    // Spawn 2 panels meeting at (cx, cy) and slide them apart
    const mk = (sign) => {
      const g = this.add.graphics().setDepth(60);
      g.fillStyle(0x20ff60, 0.9);
      if (horiz) g.fillRect(-panelW / 2, -panelLen / 2, panelW, panelLen / 2);
      else       g.fillRect(-panelLen / 2, -panelW / 2, panelLen / 2, panelW);
      g.lineStyle(2, 0x80ffaa, 0.95);
      if (horiz) g.strokeRect(-panelW / 2, -panelLen / 2, panelW, panelLen / 2);
      else       g.strokeRect(-panelLen / 2, -panelW / 2, panelLen / 2, panelW);
      g.setPosition(cx, cy);
      // slide direction:
      // - top: panels slide up/down → vary y
      // - bottom: same
      const dy = sign * panelLen * 0.55;
      const dx = 0;
      this.tweens.add({
        targets: g,
        y: cy + dy, x: cx + dx,
        alpha: 0,
        duration: 380,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          g.destroy();
          // Trigger the radial unseal bloom graphic once (using sign === 1 as a gate)
          if (sign === 1) {
            const bloom = this.add.graphics().setDepth(59);
            bloom.fillStyle(0xc0f0ff, 0.55); // soft cyan-blue bloom
            bloom.fillCircle(0, 0, 80);
            bloom.setPosition(cx, cy);
            bloom.setScale(0.1);
            this.tweens.add({
              targets: bloom,
              scale: 3.5,
              alpha: 0,
              duration: 600,
              ease: 'Quad.easeOut',
              onComplete: () => bloom.destroy(),
            });
            this.roomLayer.add(bloom);
          }
        },
      });
      this.roomLayer.add(g);
    };
    mk(1); mk(-1);
    // Flash + sparkle for emphasis
    this.fx.pickupSparkle(cx, cy, 18);
    this.cameras.main.flash(180, 50, 220, 100, true);
    this.fx.shake(0.005, 100);
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
    // Endless: loop the non-boss arena rooms (hangar/corridor/detention)
    // forever instead of ending at the last room; each loop raises `sector`,
    // the difficulty knob _applySectorScaling reads.
    if (this.mode === 'endless') {
      const nextIdx = (this.roomManager.index + 1) % 3;
      this.sector++;
      this.cameras.main.flash(200, 255, 255, 255);
      this.cameras.main.fadeOut(350, 255, 255, 255);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        if (this._doorLabel) { this._doorLabel.destroy(); this._doorLabel = null; }
        this.loadRoom(ROOMS[nextIdx]);
        this.cameras.main.fadeIn(350, 255, 255, 255);
      });
      return;
    }

    if (this.roomManager.isLast) return;
    const nextIdx = this.roomManager.index + 1;

    // White exposure bloom fade out and fade in
    this.cameras.main.flash(200, 255, 255, 255);
    this.cameras.main.fadeOut(350, 255, 255, 255);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (this._doorLabel) { this._doorLabel.destroy(); this._doorLabel = null; }
      this.loadRoom(ROOMS[nextIdx]);
      this.cameras.main.fadeIn(350, 255, 255, 255);
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

    // Face the enemy
    const angle = Math.atan2(e.y - this.player.y, e.x - this.player.x);
    this.player.facing = angle;
    this.player.aim = angle;

    // Curved slash swipe effect on the enemy
    this.fx.slashSwipe(e.x, e.y, angle, 45, 0x40ff80);

    // Player jump-dash visual tween toward enemy
    this.tweens.add({
      targets: this.player,
      x: e.x - Math.cos(angle) * 20,
      y: e.y - Math.sin(angle) * 20,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut'
    });

    this.fx.burst(e.x, e.y, 'red', 18);
    this.fx.shake(0.008, 110);
    this.cameras.main.flash(80, 60, 255, 120, true);
    // Cinematic slow-mo for stealth kills — deeper than a regular slow-mo
    this._slowMo(0.3, 380);
    this._cameraPunch(1.08, 420);
    SFX.takedown();
    e.stealthKill();
    this._takedownTarget = null;
    this.takedownGfx.clear();
    this.events.emit('takedown-available', false);
  }

  // ── Hotline-style kill juice helpers ──────────────────────────────────────

  // Stamp a one-off decal Graphics into the room's decalRT, then free it. Bakes
  // hundreds of individual live nodes down to a single GPU-resident texture, so
  // decal count no longer costs per-frame render time (see decalRT comment in
  // loadRoom). The decal draws itself at absolute world coords already, and the
  // RT maps world (0,0)->(0,0) 1:1, so no offset math is needed.
  _bakeDecal(g) {
    if (this.decalRT) { this.decalRT.draw(g, 0, 0); g.destroy(); }
    else this.roomLayer.add(g); // defensive fallback if called pre-room-load
  }

  // Persistent blood splatter pool — irregular dark-red circles, baked into
  // decalRT so it survives for the room without costing a live node per kill.
  // Builds a "trail of bodies" visual that lingers as the player advances.
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
    this._bakeDecal(g);
  }

  // Radial death glow — bright orange ring that expands and fades quickly
  // over the kill site. Drawn as a Graphics object animated via tween.
  _spawnDeathGlow(x, y, baseR = 22) {
    const g = this.add.graphics().setDepth(26);
    g.fillStyle(0xff6020, 0.55);
    g.fillCircle(0, 0, baseR);
    g.lineStyle(2.5, 0xffd060, 0.95);
    g.strokeCircle(0, 0, baseR);
    g.setPosition(x, y);
    this.tweens.add({
      targets: g, scale: 3.4, alpha: 0,
      duration: 280, ease: 'Cubic.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  // Chain-kill combo: any death within 2s of the previous one bumps the
  // counter. Past x2 we emit 'show-combo' which the HUD renders as a
  // splashy "x2!", "x3!" etc. Resets when the streak times out.
  _tickKillCombo() {
    const now = this.time.now;
    if (now - (this._lastKillTime ?? -99999) < 2000) {
      this._comboCount = (this._comboCount || 0) + 1;
    } else {
      this._comboCount = 1;
    }
    this._lastKillTime = now;
    if (this._comboCount >= 2) {
      this.events.emit('show-combo', this._comboCount);
    }
  }

  // Bright white pop at a wall hit — decays fast over ~80ms. Pure flash, no
  // persistence; the scorch/crater handles the lasting mark.
  _impactMicroFlash(x, y, r = 8) {
    const g = this.add.graphics().setDepth(27);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(0, 0, r);
    g.fillStyle(0xfff0c0, 0.55);
    g.fillCircle(0, 0, r * 1.7);
    g.setPosition(x, y);
    this.tweens.add({
      targets: g, scale: 1.8, alpha: 0,
      duration: 90, ease: 'Cubic.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  // Super-impact crater — larger persistent floor mark for missile hits.
  // Composed of overlapping dark blobs + a charred ring for depth.
  spawnCrater(x, y) {
    const g = this.add.graphics().setDepth(2);
    // Outer charred ring
    g.lineStyle(2, 0x000000, 0.5);
    g.strokeCircle(x, y, 18);
    // Dark crater body
    g.fillStyle(0x000000, 0.7);
    g.fillCircle(x, y, 14);
    g.fillStyle(0x0a0a14, 0.85);
    g.fillCircle(x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4, 10);
    // Ejecta dots scattered around
    for (let i = 0; i < 9; i++) {
      g.fillStyle(0x1a1a22, 0.6);
      const a = Math.random() * Math.PI * 2;
      const d = 14 + Math.random() * 14;
      g.fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + Math.random() * 2.5);
    }
    this._bakeDecal(g);
  }

  // Small persistent scorch mark on the floor where a bullet hit a wall.
  // Builds up over a firefight so the room visually records the chaos.
  spawnScorch(x, y) {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x000000, 0.55);
    g.fillCircle(x, y, 7);
    g.fillStyle(0x0a0a14, 0.65);
    g.fillCircle(x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4, 5);
    // A few stray soot dots
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0x1a1a22, 0.45);
      const a = Math.random() * Math.PI * 2;
      const d = 4 + Math.random() * 8;
      g.fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.7 + Math.random() * 1.8);
    }
    this._bakeDecal(g);
  }

  // Persistent radial floor crack pattern when Vader enrages. More cracks and
  // longer lines on phase 3. Stays in roomLayer for the duration of the fight.
  _spawnVaderGroundCrack(cx, cy, phase) {
    const g = this.add.graphics().setDepth(2);
    const crackCount = phase >= 3 ? 10 : 7;
    const maxLen     = phase >= 3 ? 110 : 75;
    const alpha      = phase >= 3 ? 0.72 : 0.55;
    for (let i = 0; i < crackCount; i++) {
      const baseAng = (i / crackCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      // Each crack: a jagged polyline radiating outward
      let x = cx, y = cy;
      const segments = 3 + Math.floor(Math.random() * 3);
      const segLen   = (maxLen * (0.6 + Math.random() * 0.4)) / segments;
      g.lineStyle(1.5 + Math.random(), 0x1a1a22, alpha);
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < segments; s++) {
        const jitter = (Math.random() - 0.5) * 0.45;
        x += Math.cos(baseAng + jitter) * segLen * (0.7 + Math.random() * 0.6);
        y += Math.sin(baseAng + jitter) * segLen * (0.7 + Math.random() * 0.6);
        g.lineTo(x, y);
      }
      g.strokePath();
      // Sub-crack: short branch near the tip
      const branchAng = baseAng + (Math.random() - 0.5) * 1.1;
      const branchLen = segLen * (0.3 + Math.random() * 0.45);
      g.lineStyle(1, 0x1a1a22, alpha * 0.7);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(branchAng) * branchLen, y + Math.sin(branchAng) * branchLen);
      g.strokePath();
    }
    // Dark epicenter ring
    g.lineStyle(2, 0x000000, 0.6);
    g.strokeCircle(cx, cy, phase >= 3 ? 22 : 14);
    g.fillStyle(0x000000, 0.35);
    g.fillCircle(cx, cy, phase >= 3 ? 16 : 10);
    this._bakeDecal(g);
  }

  // Smooth slow-mo ramp on physics + scene time. Falls to `floor` (e.g. 0.3)
  // and tweens back to 1 over `durMs`. Both clocks slow together so tweens,
  // animations, and physics all read consistently. Safe to overlap calls —
  // the latest scale wins.
  _slowMo(floor = 0.3, durMs = 380) {
    const pw = this.physics.world;
    const t  = this.time;
    if (this._slowMoPwTween) this._slowMoPwTween.stop();
    if (this._slowMoTTween) this._slowMoTTween.stop();
    pw.timeScale = floor;
    t.timeScale  = floor;
    this._slowMoPwTween = this.tweens.add({
      targets: pw, timeScale: 1, duration: durMs, ease: 'Quad.easeOut',
    });
    this._slowMoTTween = this.tweens.add({
      targets: t, timeScale: 1, duration: durMs, ease: 'Quad.easeOut',
      onComplete: () => { 
        pw.timeScale = 1; 
        t.timeScale = 1; 
        this._slowMoPwTween = null;
        this._slowMoTTween = null;
      },
    });
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

  // Ambient light-flicker effect for the boss room: rapid dim flashes that
  // repeat every 2-4 s while the boss is alive, evoking a damaged power grid.
  _startBossFlicker() {
    const runFlicker = () => {
      if (!this.boss?.alive) return;
      const cam = this.cameras.main;
      if (!cam) return;
      const count = Phaser.Math.Between(2, 4);
      for (let i = 0; i < count; i++) {
        this.time.delayedCall(i * Phaser.Math.Between(55, 100), () => {
          if (cam && this.boss?.alive) cam.flash(45, 15, 8, 25, true);
        });
      }
      const next = Phaser.Math.Between(1800, 4500) + count * 100;
      this.time.delayedCall(next, runFlicker);
    };
    this.time.delayedCall(Phaser.Math.Between(400, 1000), runFlicker);
  }

  // ── Sound-radius alarm ────────────────────────────────────────────────────
  // Only enemies within `radius` px of the shot hear it and switch to ALERT.
  // Enemies farther away keep patrolling until they SEE the player themselves.
  alertEnemiesNear(x, y, radius) {
    if (this.debugAI) {
      this._soundEvents = this._soundEvents || [];
      this._soundEvents.push({ x, y, r: radius, t: this.time.now, duration: 1000 });
    }
    const r2 = radius * radius;
    let anyAlerted = false;
    for (const e of this.enemies.getChildren()) {
      if (!e.active || !e.alive) continue;
      if (e.state !== ST.PATROL && e.state !== ST.SUSPICIOUS) continue; // already alerted
      if ((e.x - x) ** 2 + (e.y - y) ** 2 < r2) {
        e._triggerAlarm(true); // heard a shot → "?"
        anyAlerted = true;
      }
    }
    // Fire the room-loud klaxon if any enemy was alerted
    if (anyAlerted) this.events.emit('room-alarm-klaxon');
  }

  propagateSound(x, y, radius) {
    if (this.debugAI) {
      this._soundEvents = this._soundEvents || [];
      this._soundEvents.push({ x, y, r: radius, t: this.time.now, duration: 1000 });
    }
    const r2 = radius * radius;
    for (const e of this.enemies.getChildren()) {
      if (!e.active || !e.alive) continue;
      if (e.state === ST.PATROL || e.state === ST.SUSPICIOUS) {
        if ((e.x - x) ** 2 + (e.y - y) ** 2 < r2) {
          e.onHearSound(x, y);
        }
      }
    }
  }

  // Find the closest alive enemy within range (used for auto-aim)
  findNearestEnemy(x, y, maxRange = 600) {
    let nearest = null;
    let minDist = maxRange;
    const list = [...this.enemies.getChildren()];
    if (this.boss && this.boss.alive) {
      list.push(this.boss);
    }
    for (const e of list) {
      if (!e.active || !e.alive) continue;
      const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    }
    return nearest;
  }

  // ── Room-loud klaxon ─────────────────────────────────────────────────────
  // (The legacy per-room reinforcement spawner was replaced by the arena
  //  wave-clear spawner in _tickArena.)

  _onFirstAlarm() {
    if (!this._roomLoud) {
      this._roomLoud = true;
      SFX.alarm();
      this.cameras.main.flash(160, 120, 0, 0, true);
      this.events.emit('show-banner', '⚠ DETECTED', '#ff2828');
    }
  }

  // ── Spawning ─────────────────────────────────────────────────────────────

  spawnEnemyAt(type, x, y, spec = {}) {
    // Horde mode: every enemy — room-initial, wave, surge, boss minion —
    // uses the aggressive swarm behavior. The stealth FSM stays dormant.
    spec.behavior = 'swarm';
    let enemy;
    if      (type === 'shooter')   enemy = new EnemyShooter(this, x, y, spec);
    else if (type === 'bomber')    enemy = new EnemyBomber(this, x, y, spec);
    else if (type === 'shielded')  enemy = new EnemyShielded(this, x, y, spec);
    else if (type === 'sniper')    enemy = new EnemySniper(this, x, y, spec);
    else if (type === 'swarmling') enemy = new EnemySwarmling(this, x, y, spec);
    else                           enemy = new EnemyGrunt(this, x, y, spec);
    if (spec.elite) this._makeElite(enemy);
    // Room modifier speed (FRENZY): stacks on top of the elite's adjusted speed.
    const sm = this.arenaCfg?.speedMult;
    if (sm) enemy.cfg = { ...enemy.cfg, speed: enemy.cfg.speed * sm };
    // Endless sector ramp: stacks on top of everything above (campaign leaves
    // both multipliers at 1, so this is a no-op there).
    if (this.enemyHpMult !== 1 || this.enemySpeedMult !== 1) {
      enemy.hp    = Math.round(enemy.hp * this.enemyHpMult);
      enemy.hpMax = enemy.hp;
      enemy.cfg   = { ...enemy.cfg, speed: enemy.cfg.speed * this.enemySpeedMult };
    }
    enemy.coverRegistry = this.coverRegistry;
    this.enemies.add(enemy);
    this.physics.add.collider(enemy, this.walls);
    this.roomManager.registerEnemy();
    return enemy;
  }

  // Upgrade a spawned enemy to an "elite": bigger, much tankier, tinted, and it
  // always drops a health orb (handled in the enemy-died listener). Defaults
  // reproduce the standard gold elite; the mini-boss passes heavier opts.
  _makeElite(enemy, opts = {}) {
    const { hpMult = 2.5, scale = 1.4, tint = 0xffd040, speedMult = 0.9 } = opts;
    enemy._elite = true;
    enemy.hp = Math.round(enemy.hp * hpMult);
    enemy.hpMax = enemy.hp;
    enemy._baseScale = scale;
    enemy.setScale(scale);
    enemy.setTint(tint);
    // Grow the physics body proportionally + slow it to match the heftier look.
    const r = Math.round(enemy.cfg.radius * (0.6 + scale * 0.55));
    enemy.cfg = { ...enemy.cfg, radius: r, speed: enemy.cfg.speed * speedMult };
    enemy.body.setCircle(r, enemy.width / 2 - r, enemy.height / 2 - r);
  }

  // Spawn a cluster of swarmlings around a point (the fodder pack).
  _spawnSwarmlingPack(cx, cy) {
    const cfg = ENEMY.swarmling;
    const n = Phaser.Math.Between(cfg.packMin, cfg.packMax);
    for (let i = 0; i < n; i++) {
      const ox = cx + Phaser.Math.Between(-40, 40);
      const oy = cy + Phaser.Math.Between(-40, 40);
      this.spawnEnemyAt('swarmling', ox, oy, {});
    }
    return n;
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
    // NOTE: boss is deliberately NOT registered with roomManager — it isn't
    // in this.enemies, and registering it skewed the alive count that
    // room-cleared relies on. The boss room ends via boss-died → victory().
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
    // Landing bounce: spring in from oversized, then settle into idle pulse.
    g.setScale(1.8);
    this.tweens.add({
      targets: g, scaleX: 1, scaleY: 1, duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: g, scaleX: 1.18, scaleY: 1.18, duration: 400,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      },
    });
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  bindEvents() {
    this.events.on('player-fire', (angle) => {
      this.firePlayerPrimary(angle);
      this.propagateSound(this.player.x, this.player.y, 420);
      this._cameraPunch(1.008, 90);
    });
    this.events.on('player-dash-sound', (x, y) => {
      this.propagateSound(x, y, 160);
    });
    this.events.on('player-shot-missed', () => {
      this.player?.onShotMissed();
    });
    this.events.on('player-fire-super', (angle) => {
      this.firePlayerSuper(angle);
      this.events.emit('room-alarm-klaxon');
      // Punchier than before: harder zoom kick + a brief slow-mo so the
      // super release lands with real weight (this is the loop's payoff beat).
      this._cameraPunch(1.05, 220);
      this._slowMo(0.6, 200);
    });
    this.events.on('player-fire-rifle', (angle) => {
      this.firePlayerRifle(angle);
      this.propagateSound(this.player.x, this.player.y, 560);
      this._cameraPunch(1.012, 100);
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
      // Big-damage spike → slow-mo ramp instead of a binary freeze. Shorter
      // and shallower than the takedown's slow-mo so heavy combos still flow.
      if (amount >= 400) this._slowMo(0.5, 240);
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
    this.events.on('boss-phase-crack', (bx, by, phase) => {
      this._spawnVaderGroundCrack(bx, by, phase);
      this.fx.shake(phase >= 3 ? 0.022 : 0.015, 300);
      this.cameras.main.flash(180, 255, 60, 60, true); // flash red
    });
    this.events.on('enemy-hit', (enemy, amount) => {
      this.fx.hitFlash(enemy);
      // Hurt-frame swap: jump to the "hurt" texture frame (frame 3 in the
      // 4-frame sheet) for ~140ms, then let the AI's anim system reclaim it.
      // This adds visual variety beyond the white tint flash.
      if (enemy.anims) enemy.anims.stop();
      enemy.setFrame(3);
      this.time.delayedCall(140, () => {
        if (enemy.active && enemy.alive) {
          const prefix = enemy._animPrefix;
          if (this.anims.exists(`${prefix}-idle-front`)) enemy.play(`${prefix}-idle-front`);
        }
      });
      // CRIT callout on big hits — one-shot territory for most enemies.
      const crit = amount >= 400;
      if (crit) {
        this.fx.damageNumber(enemy.x, enemy.y - enemy.cfg.radius - 30,
          'CRIT!', '#ffe040', true);
        this.fx.damageNumber(enemy.x + 18, enemy.y - enemy.cfg.radius,
          Math.round(amount), '#ff8020', false);
        this.fx.shake(0.005, 70);
      } else {
        this.fx.damageNumber(enemy.x, enemy.y - enemy.cfg.radius, Math.round(amount));
      }
      this.fx.burst(enemy.x, enemy.y, 'red', crit ? 8 : 4);
      SFX.hit();
    });
    this.events.on('enemy-died', (enemy) => {
      // ── HOTLINE-MIAMI KILL JUICE ──────────────────────────────────────
      // Big blood burst + persistent splatter pool that stays for the room.
      this.fx.burst(enemy.x, enemy.y, 'red', 26);
      this.spawnBloodSplatter(enemy.x, enemy.y);
      // Radial death glow — bright orange ring expands and fades.
      this._spawnDeathGlow(enemy.x, enemy.y, enemy.cfg.radius);
      // Beefier shake than before for kill weight.
      this.fx.shake(0.009, 110);
      // Universal hit-pause on every kill — 45ms freeze for crisp impact.
      this.physics.world.pause();
      this.time.delayedCall(45, () => this.physics.world.resume());
      // Camera punch-zoom — brief 1.04x snap that decays.
      this._cameraPunch(1.04, 220);
      // Combo counter — chain kills within 2s show on screen
      this._tickKillCombo();
      // Run-wide kill counter (drives the HUD readout + records)
      this.runKills = (this.runKills || 0) + 1;
      this.events.emit('kills-update', this.runKills);
      this.roomManager.onEnemyDied();
      // Elites always drop sustain; everyone else rolls the standard chance.
      if (enemy._elite || Math.random() < HEALTH_ORB.dropChance) this.spawnHealthOrb(enemy.x, enemy.y);
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

    // Room cleared logic: in wave mode, exits open only once all waves are done
    // (arenaActive flips false in _onArenaCompleted).
    this.events.on('room-cleared', (spec) => {
      if (this.arenaActive) return;
      if (spec.boss) return;
      this._enemiesCleared = true;
      this.time.delayedCall(400, () => this._maybeCompleteRoom());
    });

    // A terminal finished hacking → trigger support drop and escalate wave!
    this.events.on('terminal-hacked', (terminal) => {
      this._terminalsHacked += 1;
      this.events.emit('objective-update', this._terminalsHacked, this._terminalsTotal);
      this.fx.shake(0.004, 80);
      
      // Spawn support drop
      if (terminal) {
        this.spawnTerminalSupportDrop(terminal);
      }
      
      // Risk/reward: slicing a terminal escalates the horde immediately.
      this.triggerSurge();
    });

    // Mini-game completion bridges to the terminal.
    this.events.on('hack-success', (terminal) => {
      terminal?.complete();
      this._activeHackTarget = null;
    });
    // Mini-game failure → trip the room alarm just like blowing your cover.
    this.events.on('hack-fail', () => {
      // Alert every enemy in the room
      for (const e of this.enemies.getChildren()) {
        if (e.active && e.alive && (e.state === ST.PATROL || e.state === ST.SUSPICIOUS)) {
          e._triggerAlarm(true);
        }
      }
    });

    // Boss start event forwarded from loadRoom
    this.events.on('boss-start', () => {
      this.events.emit('show-banner', 'VADER APPROACHES', '#ff2828');
      this._startBossFlicker();
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
        // Revive player — restore to the player's current hpMax (an ARMOR
        // PLATING upgrade raises hpMax, and a revive shouldn't undo that).
        this.player.hp       = this.player.hpMax;
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
        this.player.play('mando-idle-front');
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
      this.playerBullets.fire(bx, by, a, PLAYER.pelletSpeed, PLAYER.pelletDamage * this.player.dmgMult, PLAYER.pelletRange, { owner: 'player' });
    }
    this.fx.muzzleFlash(bx, by, angle);
    this.fx.ejectCasing(bx, by, angle);

    // Recoil pushback
    if (this.player.body) {
      this.player.body.velocity.x -= Math.cos(angle) * 75;
      this.player.body.velocity.y -= Math.sin(angle) * 75;
    }

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
      this.playerSuperBullets.fire(bx, by, a, PLAYER.superSpeed, PLAYER.superDamage * this.player.dmgMult, PLAYER.superRange,
        { owner: 'player', piercing: true, knockback: PLAYER.superKnockback });
    }
    this.fx.muzzleFlash(bx, by, angle);
    
    // Eject multiple casings for super rocket barrage
    this.fx.ejectCasing(bx, by, angle);
    this.time.delayedCall(40, () => this.fx.ejectCasing(bx, by, angle));
    this.time.delayedCall(80, () => this.fx.ejectCasing(bx, by, angle));

    // Heavy physics recoil force + slide stagger
    if (this.player.body) {
      this.player.body.velocity.x -= Math.cos(angle) * 350;
      this.player.body.velocity.y -= Math.sin(angle) * 350;
      this.player._hurtStaggerMs = 80; // short — keep the super snappy
    }

    this.fx.shake(0.02, 240);
    // Warm screen flash punctuates the super shot — orange/red wash.
    this.cameras.main.flash(220, 255, 150, 60, true);
    duckMusic(0.4, 400);
  }

  firePlayerRifle(angle) {
    const cfg = WEAPONS.rifle;
    const bx  = this.player.x + Math.cos(angle) * (PLAYER.radius + 4);
    const by  = this.player.y + Math.sin(angle) * (PLAYER.radius + 4);
    // Single tight bolt per burst shot
    this.playerRifleBullets.fire(bx, by, angle, cfg.speed, cfg.damage, cfg.range, { owner: 'player' });
    this.fx.muzzleFlash(bx, by, angle);
    this.fx.ejectCasing(bx, by, angle);

    // Mild physics recoil
    if (this.player.body) {
      this.player.body.velocity.x -= Math.cos(angle) * 45;
      this.player.body.velocity.y -= Math.sin(angle) * 45;
    }
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
      shooter.cfg.bulletSpeed, shooter.cfg.bulletDamage, shooter.cfg.bulletRange,
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

    // Draw auto-aim targeting circle
    if (this.lockGfx) {
      this.lockGfx.clear();
      if (this.player.alive && (this.player.aiming || this.player.superAiming)) {
        const target = this.findNearestEnemy(this.player.x, this.player.y, 600);
        if (target && target.alive) {
          const r = target.cfg.radius + 8;
          const pulse = 1.0 + Math.sin(time * 0.01) * 0.08;
          const angle = time * 0.002;
          this.lockGfx.lineStyle(3, 0xff3333, 0.85);
          for (let i = 0; i < 4; i++) {
            const a = angle + i * (Math.PI / 2);
            this.lockGfx.beginPath();
            this.lockGfx.arc(target.x, target.y, r * pulse, a - 0.25, a + 0.25);
            this.lockGfx.strokePath();
          }
          this.lockGfx.fillStyle(0xff3333, 0.4);
          this.lockGfx.fillCircle(target.x, target.y, 4);
        }
      }
    }

    // Reload progress indicator (circular HUD overlay under feet)
    if (this.reloadGfx) {
      this.reloadGfx.clear();
      const p = this.player;
      if (p && p.alive) {
        const isReloading = p.ammoTimers.length > 0;
        
        // Fade alpha in when reloading, fade out when done
        if (isReloading) {
          this.reloadAlpha = Math.min(1.0, this.reloadAlpha + delta * 0.008);
        } else {
          this.reloadAlpha = Math.max(0.0, this.reloadAlpha - delta * 0.006);
        }

        if (this.reloadAlpha > 0) {
          const rx = p.x;
          const ry = p.y + 14; // hover under player feet
          const radius = 18;
          
          // Draw thin back circle track
          this.reloadGfx.lineStyle(3, 0x2e3038, this.reloadAlpha * 0.45);
          this.reloadGfx.strokeCircle(rx, ry, radius);

          // Draw progress arc
          if (isReloading) {
            const reloadProgress = 1.0 - (p.ammoTimers[0] / PLAYER.ammoReloadMs);
            const startAngle = -Math.PI / 2; // top of circle
            const endAngle = startAngle + reloadProgress * (Math.PI * 2);
            
            // Choose color: yellow when reloading, cyan when close/completed
            const color = reloadProgress > 0.85 ? 0x90d8ff : 0xffdd40;
            
            this.reloadGfx.lineStyle(3.5, color, this.reloadAlpha * 0.85);
            this.reloadGfx.beginPath();
            this.reloadGfx.arc(rx, ry, radius, startAngle, endAngle, false);
            this.reloadGfx.strokePath();
          } else {
            // Full cyan circle fading out when reload completes
            this.reloadGfx.lineStyle(3.5, 0x90d8ff, this.reloadAlpha * 0.85);
            this.reloadGfx.strokeCircle(rx, ry, radius);
          }
        }
      } else {
        this.reloadAlpha = 0;
      }
    }

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

    // Timed wave survival tick
    this._tickArena(delta);

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

    // Bullet trails — every OTHER frame (frame parity), halving particle
    // churn at horde bullet counts; the motion-blur tail still reads at 30Hz.
    this._trailParity = !this._trailParity;
    if (this._trailParity) {
      for (const b of this.playerBullets.getChildren())
        if (b.active) this.fx.trail(b.x, b.y);
      for (const b of this.playerRifleBullets.getChildren())
        if (b.active) this.fx.trail(b.x, b.y);
      for (const b of this.playerSuperBullets.getChildren()) {
        if (b.active) {
          this.fx.trail(b.x, b.y);
          this.fx.smokeTrail(b.x, b.y); // missiles get extra smoke puff
        }
      }
    }

    // Camera aim-lookahead — shift the follow target ~70px toward the
    // current aim/facing direction so you can see further down the barrel.
    // Smoothly interpolated to avoid camera snap.
    if (this.player.alive) {
      const aim = this.player.aiming ? this.player.aim
                : this.player.superAiming ? this.player.superAim
                : this.player.facing;
      const tx = Math.cos(aim) * 50;
      const ty = Math.sin(aim) * 50;
      this._camOX = (this._camOX ?? 0) * 0.92 + tx * 0.08;
      this._camOY = (this._camOY ?? 0) * 0.92 + ty * 0.08;
      this.cameras.main.setFollowOffset(-this._camOX, -this._camOY);
    }

    // ── Ambient floor motes — slow airborne drift across the viewport.
    // Spawns one mote every ~220 ms at a random point in the camera's
    // worldView so they appear scattered and drift offscreen naturally.
    this._moteTimer = (this._moteTimer || 0) + delta;
    if (this._moteTimer >= 220) {
      this._moteTimer = 0;
      const wv = this.cameras.main.worldView;
      const mx = wv.x + Math.random() * wv.width;
      const my = wv.y + Math.random() * wv.height;
      this.fx?.ambientMote?.(mx, my);
    }

    // ── Speed-tied camera zoom-breathe — subtle zoom-out when sprinting,
    // zoom-in tighter when idle/aiming. Stacks with _cameraPunch (zoom
    // punches are multiplicative through the tween's main.zoom write).
    const ps      = this.player.alive ? Math.hypot(this.player.body.velocity.x, this.player.body.velocity.y) : 0;
    const speedN  = Math.min(1, ps / PLAYER.speed);
    const targetZ = 1.0 - speedN * 0.04;
    // 200 ms exponential smoothing toward target. Skip while a punch tween
    // is actively writing to main.zoom so the two effects don't fight.
    if (!this._cameraPunchTween || !this._cameraPunchTween.isPlaying()) {
      const k = 1 - Math.exp(-delta / 200);
      const z = this.cameras.main.zoom;
      this.cameras.main.setZoom(z + (targetZ - z) * k);
    }

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
          b.hasHit = true;
          if (!isSuper && b.owner === 'player') this.player.onHitLanded();
          // Boss ignores knockback in its damage override — pass it anyway.
          const kbVec = { x: b.body.velocity.x * 0.15, y: b.body.velocity.y * 0.15 };
          this.boss.damage(b.damage, kbVec);
          this.fx.impactRing(b.x, b.y, 0xffd040); // gold shockwave for boss
          // Heavier directional spark — boss armor deflects more
          const flightAng = Math.atan2(b.body.velocity.y, b.body.velocity.x);
          this.fx.burstDir(b.x, b.y, 'yellow', isSuper ? 18 : 10, flightAng, 100);
          if (b.owner === 'player') this.player.addSuperHit();
          if (!b.piercing) { if (isSuper) this.fx.explosion(b.x, b.y, 2.6); b.kill(); }
        }
      }
      if (!b.active) continue;
      for (const e of enemies) {
        if (!e.active || !e.alive || b.hitSet.has(e)) continue;
        if (this.circleOverlap(b, e)) {
          b.hitSet.add(e);
          const flightAng = Math.atan2(b.body.velocity.y, b.body.velocity.x);
          // Shielded troopers deflect non-piercing frontal hits. The super is
          // piercing, so it punches straight through the shield.
          if (e._blocksFrontal && !b.piercing && e.isFrontalHit?.(flightAng)) {
            e.onBlock?.();
            this.fx.impactRing(b.x, b.y, 0x50b0ff);  // blue shield clang
            this.fx.healingSparkle(b.x, b.y, 6);       // blue deflection sparks
            b.kill();
            break; // bullet stopped by the shield — no damage, no super credit
          }
          b.hasHit = true;
          if (!isSuper && b.owner === 'player') this.player.onHitLanded();
          // Every bullet knocks: super pellets shove hard, normal shots
          // give a punchy stagger in flight direction. Hotline-feel.
          const kbScale = isSuper ? 0.32 : 0.18;
          const kbVec = { x: b.body.velocity.x * kbScale, y: b.body.velocity.y * kbScale };
          e.damage(b.damage, kbVec);
          this.fx.impactRing(b.x, b.y, 0xee3030); // red shockwave for troopers
          // Directional impact spray — sparks fly forward along the bullet
          // path with a wide cone, like a deflection ricochet.
          this.fx.burstDir(b.x, b.y, 'red', isSuper ? 14 : 7, flightAng, 80);
          if (b.owner === 'player') this.player.addSuperHit();
          if (!b.piercing) { if (isSuper) this.fx.explosion(b.x, b.y, 1.4); b.kill(); break; }
        }
      }
    }
  }

  handleEnemyBulletsVsPlayer() {
    if (this.player?.isDashing) return;
    for (const b of this.enemyBullets.getChildren()) {
      if (!b.active) continue;
      if (this.circleOverlap(b, this.player)) {
        // Pass the bullet's flight angle so the player gets shoved in the
        // direction the bullet was travelling (same pattern as enemy stagger).
        const dir = Math.atan2(b.body.velocity.y, b.body.velocity.x);
        this.player.damage(b.damage, dir);
        this.fx.impactRing(b.x, b.y, 0x40c8ff); // cyan shockwave for player
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
          
          this.fx.impactRing(b.x, b.y, 0xb0b0b0); // grey shockwave for walls
          
          // Micro-flash — bright white pop at the moment of impact, decays
          // over 80ms. Sells the hit before the persistent scorch settles.
          this._impactMicroFlash(b.x, b.y, isSuper ? 14 : 8);
          // Persistent scorch (super → big crater, regular → small mark)
          if (isSuper) this.spawnCrater(b.x, b.y);
          else         this.spawnScorch(b.x, b.y);
          if (isSuper) { this.fx.explosion(b.x, b.y, 1.2); this.fx.shake(0.005, 60); }
          
          // Propagate sound if it is player's bullet hitting the wall
          if (group === this.playerBullets || group === this.playerRifleBullets) {
            this.propagateSound(b.x, b.y, 250);
          }
          
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
        // Healing juice: sparkle + soft cyan camera flash
        this.fx.pickupSparkle(orb.x, orb.y, 14);
        this.cameras.main.flash(110, 60, 200, 255, true);
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
    if (!this.debugAI) return;
    const p = this.player;
    if (!p?.alive) return;

    const steps    = 14;
    const range    = VISION_RANGE;
    const halfAng  = VISION_HALF_ANGLE;

    for (const e of this.enemies.getChildren()) {
      if (!e.active || !e.alive) continue;
      if (e.state !== ST.PATROL && e.state !== ST.SUSPICIOUS) continue;
      const facing = e._aim;
      // Is the player inside the cone (and visible)?
      let seen = false;
      if (!p.hiddenInBush) {
        const dx = p.x - e.x, dy = p.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist < range) {
          const angTo = Math.atan2(dy, dx);
          const diff  = Phaser.Math.Angle.Wrap(angTo - facing);
          if (Math.abs(diff) < halfAng) {
            seen = e._hasLOS(e.x, e.y, p.x, p.y);
          }
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
    if (!this.debugAI) {
      this.debugGraphics?.clear();
      this.debugTexts.forEach(t => t.setVisible(false));
      return;
    }
    const g = this.debugGraphics;
    g.clear();

    const STATE_COL = {
      [ST.PATROL]:     0x00ff00, // green
      [ST.SUSPICIOUS]: 0xffaa00, // amber
      [ST.ALERT]:      0xffff00, // yellow
      [ST.CHASE]:      0xff2020, // red
      [ST.COVER_MOVE]: 0xff8800, // orange
      [ST.SUPPRESS]:   0x2080ff, // blue
      [ST.REPOSITION]: 0xff00ff, // pink
      [ST.FLANK]:      0x00ffff, // cyan
      [ST.ADVANCE]:    0xffffff, // white
      [ST.SEARCH]:     0x8800ff, // purple
    };

    // Draw active sound events
    const now = this.time.now;
    this._soundEvents = (this._soundEvents || []).filter(se => now - se.t < se.duration);
    for (const se of this._soundEvents) {
      const elapsed = now - se.t;
      const alpha = 0.45 * (1 - elapsed / se.duration);
      g.lineStyle(2, 0xffaa00, alpha);
      g.strokeCircle(se.x, se.y, se.r);
      g.fillStyle(0xffaa00, alpha * 0.12);
      g.fillCircle(se.x, se.y, se.r);
    }

    let idx = 0;
    const player = this.player;

    for (const e of this.enemies.getChildren()) {
      if (!e.active || !e.alive) continue;
      const col = STATE_COL[e.state] ?? 0xffffff;

      // State indicator — coloured dot above enemy
      g.fillStyle(col, 0.95);
      g.fillCircle(e.x, e.y - e.cfg.radius - 30, 8);

      // Facing direction vector line
      const aimLen = 42;
      const ax = e.x + Math.cos(e._aim) * aimLen;
      const ay = e.y + Math.sin(e._aim) * aimLen;
      g.lineStyle(2, 0x00ffff, 0.85);
      g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(ax, ay); g.strokePath();
      g.fillStyle(0x00ffff, 0.85); g.fillCircle(ax, ay, 3);

      // FOV cone and ranges
      const curRange = (e.state === ST.PATROL || e.state === ST.SUSPICIOUS) ? VISION_RANGE : 720; // ALERT_VISION_RANGE
      g.lineStyle(1, curRange === VISION_RANGE ? 0xffdd40 : 0xff4040, 0.2);
      g.strokeCircle(e.x, e.y, curRange);

      if (e.state === ST.PATROL || e.state === ST.SUSPICIOUS) {
        g.fillStyle(0xffdd40, 0.04);
        g.beginPath();
        g.moveTo(e.x, e.y);
        const steps = 14;
        for (let i = 0; i <= steps; i++) {
          const a = e._aim - VISION_HALF_ANGLE + (VISION_HALF_ANGLE * 2 * i) / steps;
          g.lineTo(e.x + Math.cos(a) * VISION_RANGE, e.y + Math.sin(a) * VISION_RANGE);
        }
        g.closePath();
        g.fillPath();
      } else {
        g.fillStyle(0xff4040, 0.025);
        g.fillCircle(e.x, e.y, 720);
      }

      // Line of Sight Ray (from enemy to player)
      if (player?.alive) {
        const hasLOS = e._hasLOS(e.x, e.y, player.x, player.y);
        const dist = Math.hypot(player.x - e.x, player.y - e.y);
        
        let inCone = true;
        if (e.state === ST.PATROL || e.state === ST.SUSPICIOUS) {
          const angleTo = Math.atan2(player.y - e.y, player.x - e.x);
          const diff = Phaser.Math.Angle.Wrap(angleTo - e._aim);
          inCone = Math.abs(diff) < VISION_HALF_ANGLE;
        }

        let rayCol = 0xff3333; // red
        let rayAlpha = 0.45;
        if (player.hiddenInBush && dist >= 38 && !(player.revealTimer > 0)) {
          rayCol = 0x888888; // grey (player hidden in bush)
          rayAlpha = 0.35;
        } else if (inCone && dist < curRange && hasLOS) {
          rayCol = 0x33ff33; // green
          rayAlpha = 0.75;
        }

        g.lineStyle(1.5, rayCol, rayAlpha);
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(player.x, player.y); g.strokePath();
      }

      // Last known player position crosshair
      if (e.state !== ST.PATROL && e.lastKnownX != null) {
        g.lineStyle(1.5, 0xff2828, 0.8);
        g.beginPath();
        g.moveTo(e.lastKnownX - 10, e.lastKnownY);
        g.lineTo(e.lastKnownX + 10, e.lastKnownY);
        g.moveTo(e.lastKnownX, e.lastKnownY - 10);
        g.lineTo(e.lastKnownX, e.lastKnownY + 10);
        g.strokePath();
        g.lineStyle(1, 0xff2828, 0.35);
        g.strokeCircle(e.lastKnownX, e.lastKnownY, 8);
      }

      // Target path line
      let tx = null, ty = null;
      switch (e.state) {
        case ST.SUSPICIOUS:
          tx = e.suspiciousTargetX; ty = e.suspiciousTargetY; break;
        case ST.CHASE:
        case ST.ADVANCE:
        case ST.SEARCH:
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
        g.lineStyle(2, col, 0.75);
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(tx, ty); g.strokePath();
        g.fillStyle(col, 0.45); g.fillCircle(tx, ty, 8);
      }

      // Debug Text Label
      let debugText = this.debugTexts[idx];
      if (!debugText) {
        debugText = this.add.text(0, 0, '', {
          fontFamily: 'Outfit, Arial, sans-serif',
          fontSize: '11px',
          fontWeight: 'bold',
          color: '#ffffff',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: { x: 5, y: 3 },
        }).setOrigin(0.5, 1).setDepth(130);
        this.debugTexts.push(debugText);
      }

      // Map internally tracked states to human-readable state categories
      let mappedState = e.state;
      if (e.state === ST.PATROL) {
        mappedState = (e.patrolWait > 0 || !e.patrolPath.length) ? 'idle' : 'patrol';
      } else if (e.state === ST.SUSPICIOUS) {
        mappedState = 'suspicious';
      } else if (e.state === ST.ALERT) {
        mappedState = (e.alertMark?.text === '?') ? 'suspicious' : 'alerted';
      } else if (e.state === ST.CHASE || e.state === ST.SUPPRESS || e.state === ST.COVER_MOVE || e.state === ST.FLANK || e.state === ST.ADVANCE) {
        mappedState = 'attacking';
      } else if (e.state === ST.SEARCH) {
        mappedState = 'searching';
      }

      // Reason for detection/non-detection
      let reason = 'Spotted';
      if (player?.alive) {
        const dist = Math.hypot(player.x - e.x, player.y - e.y);
        const hasLOS = e._hasLOS(e.x, e.y, player.x, player.y);
        
        if (player.hiddenInBush) {
          if (dist < 38) {
            reason = 'Touch in Bush';
          } else if (player.revealTimer > 0) {
            reason = 'Revealed (Firing in Bush)';
          } else {
            reason = 'Hidden in Bush';
          }
        } else if (dist > curRange) {
          reason = `Outside Range (${Math.round(dist)}px / ${curRange}px)`;
        } else if (e.state === ST.PATROL) {
          const angleTo = Math.atan2(player.y - e.y, player.x - e.x);
          const diff = Phaser.Math.Angle.Wrap(angleTo - e._aim);
          if (Math.abs(diff) >= VISION_HALF_ANGLE) {
            reason = 'Behind/Outside Cone';
          } else if (!hasLOS) {
            reason = 'LOS Blocked (Wall)';
          }
        } else if (!hasLOS) {
          reason = 'LOS Blocked (Wall)';
        }
      } else {
        reason = 'Player Dead';
      }

      debugText.setText(`State: ${mappedState.toUpperCase()}\nReason: ${reason}`);
      debugText.setPosition(e.x, e.y - e.cfg.radius - 50);
      debugText.setVisible(true);
      idx++;
    }

    // Hide unused debug labels
    for (let i = idx; i < this.debugTexts.length; i++) {
      this.debugTexts[i].setVisible(false);
    }
  }

  drawAimCone() {
    const g = this.aimGraphics;
    g.clear();
    const p = this.player;
    if (!p?.alive) return;
    const gap = PLAYER.radius + 6;
    let activeAim = null, activeRange = 0, activeSpread = 0;
    if (p.superAiming && p.superCharge >= PLAYER.superHitsToCharge) {
      this.drawCone(g, p.x, p.y, p.superAim,
        Phaser.Math.DegToRad(PLAYER.superSpreadDeg), PLAYER.superRange, gap,
        0xff2020, 0xff8080, 0.30);
      activeAim = p.superAim;
      activeRange = PLAYER.superRange;
    } else if (p.aiming) {
      this.drawCone(g, p.x, p.y, p.aim,
        Phaser.Math.DegToRad(PLAYER.pelletSpreadDeg), PLAYER.pelletRange, gap,
        0xff2828, 0xff9090, 0.18);
      activeAim = p.aim;
      activeRange = PLAYER.pelletRange;
    }
    // Aim laser — thin red line + dot to first wall hit. Only when actively
    // aiming (right stick held). Sits on top of the cone for clarity.
    if (activeAim != null) this._drawAimLaser(g, p.x, p.y, activeAim, activeRange, gap);
  }

  // Thin red laser line from the gun tip out to the first wall hit (or full
  // range if clear). Draws on the existing aimGraphics so it lives in the
  // world layer behind the player but above the floor.
  _drawAimLaser(g, px, py, angle, range, startGap) {
    const sx = px + Math.cos(angle) * startGap;
    const sy = py + Math.sin(angle) * startGap;
    let ex = sx + Math.cos(angle) * range;
    let ey = sy + Math.sin(angle) * range;
    let nearest = range;
    const ray = new Phaser.Geom.Line(sx, sy, ex, ey);
    for (const w of this.walls.getChildren()) {
      const b = w.body;
      if (!b) continue;
      const rect = new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
      const pts = Phaser.Geom.Intersects.GetLineToRectangle(ray, rect);
      for (const p of pts) {
        const d = Math.hypot(p.x - sx, p.y - sy);
        if (d < nearest) { nearest = d; ex = p.x; ey = p.y; }
      }
    }
    // Low-ammo flicker: laser strobes redder/faster when down to 0-1 rounds
    // so you can feel reloads coming.
    const lowAmmo = this.player.ammo <= 1;
    const lineAlpha = lowAmmo
      ? 0.30 + 0.45 * Math.abs(Math.sin(this.time.now * 0.022))
      : 0.55;
    const dotAlpha  = lowAmmo
      ? 0.55 + 0.40 * Math.abs(Math.sin(this.time.now * 0.022))
      : 0.9;
    g.lineStyle(1.4, 0xff2828, lineAlpha);
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.strokePath();
    g.fillStyle(0xff8080, dotAlpha);
    g.fillCircle(ex, ey, 2.5);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(ex, ey, 1.2);
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

  victory() {
    this.scene.start('GameOver', {
      win: true,
      stats: {
        clearTime: this.time.now - this.runStartTime,
        stealthKills: this.runStealthKills,
        kills: this.runKills || 0,
        damageTaken: Math.ceil(this.runDamageTaken),
        maxCombo: this.player ? this.player.runMaxCombo || 1.0 : 1.0,
      }
    });
  }
  defeat()  {
    this.scene.start('GameOver', {
      win: false,
      mode: this.mode,
      stats: {
        clearTime: this.time.now - this.runStartTime,
        stealthKills: this.runStealthKills,
        kills: this.runKills || 0,
        damageTaken: Math.ceil(this.runDamageTaken),
        maxCombo: this.player ? this.player.runMaxCombo || 1.0 : 1.0,
        sector: this.sector,
      }
    });
  }

  // ── Arena wave-clear logic ─────────────────────────────────────────────────
  // A room is a sequence of waves. Each wave drips its `count` spawn events
  // (capped at maxAlive), then the player must clear every enemy to advance;
  // a WAVE CLEAR reward + brief breather sits between waves.

  _tickArena(delta) {
    if (!this.arenaActive || !this.player?.alive) return;
    const cfg = this.arenaCfg;
    const wave = this._wave;
    if (!cfg || !wave) return;

    // Live "N left" feedback whenever the count changes.
    const living = this._livingEnemyCount();
    if (living !== this._lastLiving) {
      this._lastLiving = living;
      this.events.emit('wave-remaining', this._wavePhase === 'breather' ? 0 : living);
    }

    if (this._wavePhase === 'spawning') {
      // Drip this wave's budget, capped at the concurrent maxAlive.
      this._waveDripMs += delta;
      if (this._waveSpawned < wave.count &&
          this._waveDripMs >= cfg.spawnRate &&
          living < cfg.maxAlive) {
        this._waveDripMs = 0;
        this.spawnAtGate(this._rollEnemyType());
        this._waveSpawned++;
      }
      if (this._waveSpawned >= wave.count) this._wavePhase = 'clearing';
    } else if (this._wavePhase === 'clearing') {
      // Budget spent — wait for the arena to be swept clean.
      if (living === 0) {
        this._onWaveCleared(wave);
        const waves = this._roomArenaCfg.waves;
        if (this._waveIdx >= waves.length - 1) {
          this._onArenaCompleted();
        } else {
          this._wavePhase = 'breather';
          this._breatherMs = 2500;
        }
      }
    } else if (this._wavePhase === 'breather') {
      this._breatherMs -= delta;
      if (this._breatherMs <= 0) this._startWave(this._waveIdx + 1);
    }
  }

  // WAVE CLEAR: celebratory punctuation + a reward drop near the player.
  _onWaveCleared(wave) {
    this.events.emit('show-banner', 'WAVE CLEAR!', '#20ff60');
    this.cameras.main.flash(200, 64, 255, 128, true);
    this.fx.shake(0.005, 150);
    SFX.superReady?.();
    this._spawnWaveReward(wave);
  }

  // Reward template extracted from spawnTerminalSupportDrop: milestone/mini-boss
  // waves grant a weapon; ordinary waves grant sustain (bacta + shield).
  _spawnWaveReward(wave) {
    const rx = this.player.x, ry = this.player.y - 40;
    if (wave.reward === 'weapon') {
      const weapons = ['rifle', 'flamethrower', 'detonator'];
      const choice = weapons[Phaser.Math.Between(0, weapons.length - 1)];
      const wp = new WeaponPickup(this, rx, ry, choice);
      this.weaponPickups.push(wp);
      this.fx.pickupSparkle(rx, ry, 14);
      this.events.emit('show-banner', `REWARD: ${choice.toUpperCase()}`, '#ffd040');
    } else {
      this.spawnHealthOrb(rx, ry);
      this.player.addShield(300);
      this.fx.pickupSparkle(rx, ry, 10);
    }
  }

  // Mini-boss: a super-elite spawned at wave start. Counts toward the clear.
  _spawnMiniBoss() {
    const spec = this.roomSpec;
    const gates = spec?.gates;
    let gx = spec?.bounds ? spec.bounds.w / 2 : this.player.x;
    let gy = spec?.bounds ? spec.bounds.h / 2 : this.player.y;
    if (gates?.length) {
      // Farthest gate from the player so it makes an entrance.
      const g = gates.reduce((a, b) =>
        Math.hypot(a.x - this.player.x, a.y - this.player.y) >=
        Math.hypot(b.x - this.player.x, b.y - this.player.y) ? a : b);
      gx = g.x; gy = g.y;
    }
    const type = Math.random() < 0.5 ? 'shielded' : 'shooter';
    const e = this.spawnEnemyAt(type, gx, gy, {});
    this._makeElite(e, { hpMult: 6, scale: 1.8, tint: 0xff4020, speedMult: 0.8 });
    e._miniBoss = true;
    this.fx.burst(gx, gy, 'red', 24);
    return e;
  }

  _livingEnemyCount() {
    // die() keeps corpses "active" for the fade-out; count only live ones.
    return this.enemies.getChildren().reduce((n, e) => n + (e.alive ? 1 : 0), 0);
  }

  _rollEnemyType() {
    const c = this.arenaCfg || {};
    const r = Math.random();
    let acc = 0;
    if (r < (acc += c.bomberMix    ?? 0)) return 'bomber';
    if (r < (acc += c.shieldedMix  ?? 0)) return 'shielded';
    if (r < (acc += c.sniperMix    ?? 0)) return 'sniper';
    if (r < (acc += c.swarmlingMix ?? 0)) return 'swarmling';
    if (r < (acc += c.shooterMix   ?? 0.3)) return 'shooter';
    return 'grunt';
  }

  // Surge: a burst of spawns staggered over ~1.5s with a warning banner.
  // Fired when a terminal is hacked (risk/reward) — extra enemies you must
  // also clear before the wave ends. Never fires during a breather.
  triggerSurge() {
    const cfg = this.arenaCfg;
    if (!cfg || !this.arenaActive || this._wavePhase === 'breather') return;

    this.events.emit('show-banner', 'SURGE INCOMING', '#ff4040');
    SFX.enemyShoot();
    this.cameras.main.flash(150, 255, 60, 60, false);

    const count = cfg.surgeCount ?? 4;
    const step = 1500 / count;
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * step, () => {
        if (!this.arenaActive) return;
        // Surges may briefly exceed the drip cap, but never runaway.
        if (this._livingEnemyCount() >= cfg.maxAlive + 4) return;
        this.spawnAtGate(this._rollEnemyType());
      });
    }
  }

  // Spawn one enemy at a room gate: pick a random gate ≥400px from the
  // player (else the farthest), telegraph it with a pulsing red ring for
  // 600ms, then spawn with a burst. Falls back to the legacy random-edge
  // picker for rooms without gates.
  spawnAtGate(type) {
    const spec = this.roomSpec;
    if (!spec) return;
    const gates = spec.gates;
    if (!gates?.length) { this.spawnEnemyRandom(type); return; }

    const px = this.player.x, py = this.player.y;
    const farEnough = gates.filter((g) => Math.hypot(g.x - px, g.y - py) >= 400);
    const pool = farEnough.length
      ? farEnough
      : [gates.reduce((a, b) =>
          Math.hypot(a.x - px, a.y - py) >= Math.hypot(b.x - px, b.y - py) ? a : b)];
    const gate = pool[Phaser.Math.Between(0, pool.length - 1)];
    const gx = gate.x + Phaser.Math.Between(-24, 24);
    const gy = gate.y + Phaser.Math.Between(-24, 24);

    // Telegraph: pulsing red ring, then the enemy materializes.
    const tg = this.add.graphics().setDepth(6);
    tg.lineStyle(3, 0xff3030, 0.9);
    tg.strokeCircle(0, 0, 30);
    tg.fillStyle(0xff2020, 0.25);
    tg.fillCircle(0, 0, 22);
    tg.setPosition(gx, gy).setScale(0.4);
    this.tweens.add({
      targets: tg, scale: 1.25, alpha: { from: 1, to: 0.15 },
      duration: 600, ease: 'Cubic.easeOut',
      onComplete: () => {
        tg.destroy();
        if (!this.arenaActive) return;
        if (type === 'swarmling') {
          this._spawnSwarmlingPack(gx, gy);
        } else {
          // Elite upgrade roll (not for fodder). eliteChance is per-room.
          const elite = Math.random() < (this.arenaCfg?.eliteChance ?? 0);
          this.spawnEnemyAt(type, gx, gy, elite ? { elite: true } : {});
        }
        this.fx.burst(gx, gy, 'red', 10);
      },
    });
  }

  // Terminal support drop — allies (turret/soldier) are cut for now: their
  // borrowed enemy/cover art read as unkillable enemies in playtests. 50/50
  // between a heavy weapon and shield+bacta.
  spawnTerminalSupportDrop(t) {
    if (Math.random() < 0.5) {
      // Drop heavy weapon pickup
      const weapons = ['rifle', 'flamethrower', 'detonator'];
      const choice = weapons[Phaser.Math.Between(0, weapons.length - 1)];
      const wp = new WeaponPickup(this, t.x, t.y + 35, choice);
      this.weaponPickups.push(wp);
      this.fx.pickupSparkle(t.x, t.y + 35, 12);
      this.events.emit('show-banner', `SUPPORT: ${choice.toUpperCase()} DROPPED`, '#ffd040');
    } else {
      // Spawn health pack + temporary shield
      this.spawnHealthOrb(t.x, t.y + 30);
      this.player.addShield(400);
      this.events.emit('show-banner', 'SUPPORT: SHIELD CHARGED & BACTA VIAL', '#40ff80');
    }
  }

  _onArenaCompleted() {
    this.arenaActive = false;
    this.events.emit('wave-update', null, null); // clear the wave HUD
    this.events.emit('wave-remaining', 0);

    const spec = this.roomSpec;
    if (spec.boss) {
      // Dual climax: survive the swarm first, then Vader. Up to 4 swarm
      // survivors stay in the fight so the climax doesn't reset to a sterile
      // 1v1 — the rest are culled (farthest from the player go first).
      const living = this.enemies.getChildren()
        .filter((e) => e.alive)
        .sort((a, b) =>
          Math.hypot(a.x - this.player.x, a.y - this.player.y) -
          Math.hypot(b.x - this.player.x, b.y - this.player.y));
      living.slice(4).forEach((e) => this._destroyEnemyFully(e));

      this.events.emit('set-darkness', false); // hand a dim room cleanly to the boss
      this.events.emit('show-banner', 'VADER APPROACHES!', '#ff2020');
      SFX.bossRoar();
      this.cameras.main.flash(400, 255, 0, 0, true);
      
      // Spawn Vader
      this.time.delayedCall(800, () => {
        this.spawnBoss(spec.bossSpawn.x, spec.bossSpawn.y);
        this.events.emit('boss-start');
      });
    } else {
      // Survivors stay alive and killable — spawning already stopped
      // (arenaActive=false), so they're a finite mop-up. Full cleanup of any
      // stragglers happens in _clearRoomEntities on the next room load.
      // The door stays SEALED until an upgrade is picked (UpgradeScene calls
      // _openDoor() itself on pick) — _roomDoorOpened still latches now so
      // _maybeCompleteRoom's terminal-completion path can't race it open.
      this._roomDoorOpened = true;

      this.cameras.main.flash(220, 64, 255, 128, true);
      this.fx.shake(0.004, 120);
      const stragglers = this._livingEnemyCount();
      this.events.emit('show-banner',
        stragglers > 0 ? 'ARENA SURVIVED — FINISH THEM!' : 'ARENA SURVIVED!',
        '#20ff60');

      this.time.delayedCall(900, () => {
        this.scene.launch('Upgrade', { game: this });
        this.scene.pause('Game');
        this.scene.pause('HUD');
      });
    }
  }
}
