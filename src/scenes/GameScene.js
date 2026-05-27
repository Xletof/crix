import Phaser from 'phaser';
import {
  VIEW,
  WORLD,
  PLAYER,
  ENEMY,
  BOSS,
  HEALTH_ORB,
} from '../config.js';
import { Player } from '../entities/Player.js';
import { EnemyGrunt, EnemyShooter } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { BulletGroup } from '../entities/Bullet.js';
import { BushSystem } from '../systems/BushSystem.js';
import { WaveManager } from '../systems/WaveManager.js';
import { attachFX, SFX, startMusic, duckMusic, stopMusic } from '../systems/FX.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);

    // Backdrop
    this.add.image(WORLD.width / 2, WORLD.height / 2, 'backdrop').setDepth(-10);

    // Bushes & walls — placed for the "Brawl Stars feel"
    this.bushes = this.add.group();
    this.bushSystem = new BushSystem(this);
    this.walls = this.physics.add.staticGroup();
    this.buildArena();

    // FX
    this.fx = attachFX(this);

    // Bullets
    this.playerBullets = new BulletGroup(this, 'bullet');
    this.playerSuperBullets = new BulletGroup(this, 'bullet-super');
    this.enemyBullets = new BulletGroup(this, 'bullet-enemy');

    // Player
    this.player = new Player(this, WORLD.width / 2, WORLD.height / 2);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1);

    // Aim cone overlay (drawn in world space, beneath the player)
    this.aimGraphics = this.add.graphics().setDepth(25);

    // Enemy group
    this.enemies = this.add.group({ runChildUpdate: false });
    this.boss = null;

    // Wave manager
    this.waveManager = new WaveManager(this, (type) => this.spawnEnemy(type));

    // Health orbs (dropped by enemies)
    this.healthOrbs = [];

    // Wire all events from entities
    this.bindEvents();

    // Launch HUD
    this.scene.launch('HUD', { game: this });

    // Start
    this.time.delayedCall(300, () => this.waveManager.start());

    // Background music — starts on first input gesture (audio ctx requires it)
    this.input.once('pointerdown', () => startMusic());
    this.input.keyboard?.once('keydown', () => startMusic());

    // Keyboard fallback for desktop
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys('W,A,S,D');
    this.input.keyboard?.on('keydown-SPACE', () => this.player?.tryFireSuper());

    // Cleanup on shutdown
    this.events.once('shutdown', () => {
      this.scene.stop('HUD');
      this.healthOrbs.forEach((o) => { this.tweens.killTweensOf(o.gfx); o.gfx.destroy(); });
      this.healthOrbs = [];
    });
  }

  // --- Arena construction ---

  buildArena() {
    // Outer walls — keep player inside the world bounds
    // (relying on collideWorldBounds for the actual constraint; we just decorate)

    // Inner walls (a few obstacles)
    const wallPositions = [
      { x: WORLD.width * 0.25, y: WORLD.height * 0.25 },
      { x: WORLD.width * 0.75, y: WORLD.height * 0.25 },
      { x: WORLD.width * 0.25, y: WORLD.height * 0.75 },
      { x: WORLD.width * 0.75, y: WORLD.height * 0.75 },
      { x: WORLD.width * 0.5, y: WORLD.height * 0.18 },
      { x: WORLD.width * 0.5, y: WORLD.height * 0.82 },
    ];
    for (const w of wallPositions) {
      const wall = this.walls.create(w.x, w.y, 'wall');
      wall.setScale(1).refreshBody();
    }

    // Bushes — a 6x6 patch around the player + scattered clusters
    const bushSpec = [
      // central diamond
      [0.5, 0.5, 4, 4],
      // corners
      [0.18, 0.18, 3, 3],
      [0.82, 0.18, 3, 3],
      [0.18, 0.82, 3, 3],
      [0.82, 0.82, 3, 3],
      // edges
      [0.5, 0.15, 5, 2],
      [0.5, 0.85, 5, 2],
      [0.15, 0.5, 2, 5],
      [0.85, 0.5, 2, 5],
    ];
    const spacing = 90;
    for (const [cx, cy, cols, rows] of bushSpec) {
      const ox = WORLD.width * cx;
      const oy = WORLD.height * cy;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const px = ox + (c - (cols - 1) / 2) * spacing + (Math.random() * 12 - 6);
          const py = oy + (r - (rows - 1) / 2) * spacing + (Math.random() * 12 - 6);
          // Skip if too close to a wall
          let blocked = false;
          this.walls.children.iterate((w) => {
            if (!w) return;
            if (Math.hypot(w.x - px, w.y - py) < 110) blocked = true;
          });
          if (blocked) continue;
          const bush = this.add.image(px, py, 'bush');
          bush.setDepth(20);
          bush.setScale(0.95 + Math.random() * 0.2);
          this.bushes.add(bush);
          this.bushSystem.add(bush, 55);
        }
      }
    }
  }

  // --- Spawning ---

  spawnEnemy(type) {
    // Pick a position on a random arena edge, away from player
    const edges = [
      { x: 80, y: Math.random() * WORLD.height },
      { x: WORLD.width - 80, y: Math.random() * WORLD.height },
      { x: Math.random() * WORLD.width, y: 80 },
      { x: Math.random() * WORLD.width, y: WORLD.height - 80 },
    ];
    let best = edges[0];
    let bestDist = -1;
    for (const e of edges) {
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d > bestDist) {
        bestDist = d;
        best = e;
      }
    }
    let enemy;
    if (type === 'shooter') enemy = new EnemyShooter(this, best.x, best.y);
    else enemy = new EnemyGrunt(this, best.x, best.y);
    this.enemies.add(enemy);
    this.physics.add.collider(enemy, this.walls);
    return enemy;
  }

  spawnHealthOrb(x, y) {
    const g = this.add.graphics().setDepth(22);
    const r = HEALTH_ORB.radius;
    // Bacta vial — cylindrical blue medical container
    // Outer blue glow aura
    g.fillStyle(0x1060cc, 0.22);
    g.fillCircle(0, 0, r + 10);
    // Shadow disc
    g.fillStyle(0x000010, 0.4);
    g.fillEllipse(2, r * 0.7, r * 1.8, r * 0.5);
    // Vial body (dark border)
    g.fillStyle(0x004488, 1);
    g.fillRoundedRect(-r * 0.55 + 1, -r + 1, r * 1.1, r * 1.9, r * 0.3);
    // Vial body (bacta blue)
    g.fillStyle(HEALTH_ORB.color, 1);
    g.fillRoundedRect(-r * 0.55, -r, r * 1.1, r * 1.9, r * 0.3);
    // Inner bacta liquid (brighter blue)
    g.fillStyle(0x40b8ff, 0.6);
    g.fillRoundedRect(-r * 0.42, -r * 0.85, r * 0.84, r * 1.5, r * 0.25);
    // Vial neck
    g.fillStyle(0x003366, 1);
    g.fillRect(-r * 0.22 + 1, -r * 1.15 + 1, r * 0.44, r * 0.22);
    g.fillStyle(0x1898e8, 1);
    g.fillRect(-r * 0.22, -r * 1.15, r * 0.44, r * 0.22);
    // Cap/stopper (white medical)
    g.fillStyle(0xccccdd, 1);
    g.fillRect(-r * 0.28, -r * 1.28, r * 0.56, r * 0.16);
    // Left edge glint (glass highlight)
    g.fillStyle(0x90d8ff, 0.65);
    g.fillRoundedRect(-r * 0.46, -r * 0.88, r * 0.16, r * 1.45, r * 0.08);
    // Bubble detail (bacta suspension)
    g.fillStyle(0x90d8ff, 0.5);
    g.fillCircle(-r * 0.1, r * 0.1, r * 0.12);
    g.fillCircle(r * 0.1, -r * 0.2, r * 0.09);
    // Rebel symbol (simplified — two vertical lines)
    g.fillStyle(0x006aaa, 0.7);
    g.fillRect(-r * 0.08, -r * 0.5, r * 0.06, r * 0.9);
    g.fillRect(r * 0.02, -r * 0.5, r * 0.06, r * 0.9);
    g.setPosition(x, y);

    const orb = {
      gfx: g,
      x, y,
      life: HEALTH_ORB.lifeMs,
      pulse: 0,
    };
    this.healthOrbs.push(orb);

    // Pulse tween
    this.tweens.add({
      targets: g,
      scaleX: 1.18,
      scaleY: 1.18,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  spawnBoss() {
    this.boss = new Boss(this, WORLD.width / 2, WORLD.height * 0.18);
    this.physics.add.collider(this.boss, this.walls);
    this.fx.shake(0.012, 400);
    duckMusic(0.4, 800);
  }

  // --- Event wiring ---

  bindEvents() {
    this.events.on('player-fire', (angle) => this.firePlayerPrimary(angle));
    this.events.on('player-fire-super', (angle) => this.firePlayerSuper(angle));
    this.events.on('shooter-fire', (shooter, angle) => this.fireShooter(shooter, angle));
    this.events.on('boss-fan', (boss, angle) => this.fireBossFan(boss, angle));
    this.events.on('boss-spawn', () => this.bossSpawnMinions());
    this.events.on('boss-charge', () => {
      this.fx.shake(0.015, 200);
    });
    this.events.on('boss-hit', (boss, amount) => {
      this.fx.hitFlash(boss);
      this.fx.damageNumber(boss.x + (Math.random() * 30 - 15), boss.y - boss.cfg.radius, Math.round(amount), '#ffd166', true);
      this.fx.burst(boss.x, boss.y, 'red', 6);
      this.fx.shake(0.005, 60);
      SFX.bossHit();
    });
    this.events.on('boss-died', (boss) => {
      this.fx.burst(boss.x, boss.y, 'yellow', 40);
      this.fx.burst(boss.x, boss.y, 'red', 40);
      this.fx.shake(0.025, 500);
      this.time.delayedCall(800, () => this.victory());
    });
    this.events.on('enemy-hit', (enemy, amount) => {
      this.fx.hitFlash(enemy);
      this.fx.damageNumber(enemy.x, enemy.y - enemy.cfg.radius, Math.round(amount));
      this.fx.burst(enemy.x, enemy.y, 'red', 4);
      SFX.hit();
    });
    this.events.on('enemy-died', (enemy) => {
      this.fx.burst(enemy.x, enemy.y, 'red', 18);
      this.fx.shake(0.003, 50);
      this.waveManager.onEnemyDied();
      // Random health orb drop
      if (Math.random() < HEALTH_ORB.dropChance) {
        this.spawnHealthOrb(enemy.x, enemy.y);
      }
    });
    this.events.on('player-hurt', () => {
      this.fx.shake(0.008, 110);
      this.cameras.main.flash(120, 255, 80, 80, true);
    });
    this.events.on('player-dead', () => {
      this.fx.burst(this.player.x, this.player.y, 'red', 30);
      this.fx.shake(0.02, 500);
      this.time.delayedCall(900, () => this.defeat());
    });
    this.events.on('grunt-melee', (g) => {
      this.fx.burst(g.x, g.y, 'red', 6);
    });
    this.events.on('boss-start', () => {
      this.spawnBoss();
    });
  }

  // --- Firing helpers ---

  firePlayerPrimary(angle) {
    const baseX = this.player.x + Math.cos(angle) * (PLAYER.radius + 4);
    const baseY = this.player.y + Math.sin(angle) * (PLAYER.radius + 4);
    const spread = Phaser.Math.DegToRad(PLAYER.pelletSpreadDeg);
    const half = (PLAYER.pelletCount - 1) / 2;
    for (let i = 0; i < PLAYER.pelletCount; i++) {
      const a = angle + (i - half) * (spread / Math.max(1, PLAYER.pelletCount - 1));
      this.playerBullets.fire(baseX, baseY, a, PLAYER.pelletSpeed, PLAYER.pelletDamage, PLAYER.pelletRange, {
        owner: 'player',
      });
    }
    this.fx.muzzleFlash(baseX, baseY, angle);
  }

  firePlayerSuper(angle) {
    const baseX = this.player.x + Math.cos(angle) * (PLAYER.radius + 6);
    const baseY = this.player.y + Math.sin(angle) * (PLAYER.radius + 6);
    const spread = Phaser.Math.DegToRad(PLAYER.superSpreadDeg);
    const half = (PLAYER.superPellets - 1) / 2;
    for (let i = 0; i < PLAYER.superPellets; i++) {
      const a = angle + (i - half) * (spread / Math.max(1, PLAYER.superPellets - 1));
      this.playerSuperBullets.fire(baseX, baseY, a, PLAYER.superSpeed, PLAYER.superDamage, PLAYER.superRange, {
        owner: 'player',
        piercing: true,
        knockback: PLAYER.superKnockback,
      });
    }
    this.fx.muzzleFlash(baseX, baseY, angle);
    this.fx.shake(0.012, 180);
    duckMusic(0.4, 400);
  }

  fireShooter(shooter, angle) {
    const baseX = shooter.x + Math.cos(angle) * (shooter.cfg.radius + 4);
    const baseY = shooter.y + Math.sin(angle) * (shooter.cfg.radius + 4);
    this.enemyBullets.fire(baseX, baseY, angle, ENEMY.shooter.bulletSpeed, ENEMY.shooter.bulletDamage, ENEMY.shooter.bulletRange, {
      owner: 'enemy',
    });
    SFX.enemyShoot();
  }

  fireBossFan(boss, angle) {
    const spread = Phaser.Math.DegToRad(BOSS.fanSpreadDeg);
    const half = (BOSS.fanPellets - 1) / 2;
    for (let i = 0; i < BOSS.fanPellets; i++) {
      const a = angle + (i - half) * (spread / Math.max(1, BOSS.fanPellets - 1));
      const baseX = boss.x + Math.cos(a) * (boss.cfg.radius + 6);
      const baseY = boss.y + Math.sin(a) * (boss.cfg.radius + 6);
      this.enemyBullets.fire(baseX, baseY, a, BOSS.fanBulletSpeed, BOSS.fanBulletDamage, BOSS.fanBulletRange, {
        owner: 'boss',
      });
    }
    SFX.enemyShoot();
    SFX.bossRoar();
  }

  bossSpawnMinions() {
    for (let i = 0; i < BOSS.spawnCount; i++) {
      this.time.delayedCall(i * 120, () => this.spawnEnemy('grunt'));
    }
  }

  // --- Per-frame collision dispatch ---

  update(time, delta) {
    // Bush hiding
    const actors = [this.player, ...this.enemies.getChildren()];
    if (this.boss) actors.push(this.boss);
    this.bushSystem.update(actors);

    // Aim cone (Brawl-Stars-style shadow aimer)
    this.drawAimCone();

    // Health orb pickups
    this.updateHealthOrbs(delta);

    // Wave manager
    this.waveManager.update(delta);

    // Player bullets vs enemies (and boss)
    this.handleBulletEnemyHits(this.playerBullets, false);
    this.handleBulletEnemyHits(this.playerSuperBullets, true);

    // Enemy bullets vs player
    this.handleEnemyBulletsVsPlayer();

    // Bullets vs walls
    this.handleBulletWallHits(this.playerBullets, false);
    this.handleBulletWallHits(this.playerSuperBullets, true);
    this.handleBulletWallHits(this.enemyBullets, false);

    // Desktop keyboard movement (mirror joystick).
    // Only override the player's movement vector when a key is held *or*
    // when we just transitioned from keys-held to keys-released — otherwise
    // we'd stomp on the touch joystick every frame.
    if (this.cursors || this.keys) {
      const k = this.keys || {};
      const left = this.cursors?.left.isDown || k.A?.isDown;
      const right = this.cursors?.right.isDown || k.D?.isDown;
      const up = this.cursors?.up.isDown || k.W?.isDown;
      const down = this.cursors?.down.isDown || k.S?.isDown;
      const vx = (right ? 1 : 0) - (left ? 1 : 0);
      const vy = (down ? 1 : 0) - (up ? 1 : 0);
      const anyKey = left || right || up || down;
      if (anyKey) {
        const m = Math.hypot(vx, vy) || 1;
        this.player.setMoveInput({ x: vx / m, y: vy / m, force: 1 });
        this._kbdActive = true;
      } else if (this._kbdActive) {
        // Just released all keys — stop moving (but only this frame).
        this.player.setMoveInput({ x: 0, y: 0, force: 0 });
        this._kbdActive = false;
      }
    }
  }

  handleBulletEnemyHits(group, isSuper) {
    const bullets = group.getChildren();
    const enemies = this.enemies.getChildren();
    for (const b of bullets) {
      if (!b.active) continue;
      // Boss
      if (this.boss && this.boss.alive && !b.hitSet.has(this.boss)) {
        if (this.circleOverlap(b, this.boss)) {
          b.hitSet.add(this.boss);
          const kbVec = isSuper && b.knockback
            ? { x: b.body.velocity.x * 0.15, y: b.body.velocity.y * 0.15 }
            : null;
          this.boss.damage(b.damage, kbVec);
          this.player.addSuperHit();
          if (!b.piercing) {
            if (isSuper) this.fx.explosion(b.x, b.y, 1.8);
            b.kill();
          }
        }
      }
      if (!b.active) continue;
      for (const e of enemies) {
        if (!e.active || !e.alive) continue;
        if (b.hitSet.has(e)) continue;
        if (this.circleOverlap(b, e)) {
          b.hitSet.add(e);
          let kbVec = null;
          if (isSuper && b.knockback) {
            kbVec = { x: b.body.velocity.x * 0.15, y: b.body.velocity.y * 0.15 };
          }
          e.damage(b.damage, kbVec);
          this.player.addSuperHit();
          if (!b.piercing) {
            if (isSuper) this.fx.explosion(b.x, b.y, 1.4);
            b.kill();
            break;
          }
        }
      }
    }
  }

  handleEnemyBulletsVsPlayer() {
    const bullets = this.enemyBullets.getChildren();
    for (const b of bullets) {
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
        if (
          b.x > w.x - 56 &&
          b.x < w.x + 56 &&
          b.y > w.y - 56 &&
          b.y < w.y + 56
        ) {
          if (isSuper) {
            this.fx.explosion(b.x, b.y, 1.2);
            this.fx.shake(0.005, 60);
          } else {
            this.fx.burst(b.x, b.y, 'red', 4);
          }
          b.kill();
          break;
        }
      }
    }
  }

  updateHealthOrbs(delta) {
    const p = this.player;
    const pickupRadius = HEALTH_ORB.radius + PLAYER.radius;
    let i = this.healthOrbs.length;
    while (i--) {
      const orb = this.healthOrbs[i];
      orb.life -= delta;
      if (orb.life <= 0) {
        // Fade out and remove
        this.tweens.killTweensOf(orb.gfx);
        orb.gfx.destroy();
        this.healthOrbs.splice(i, 1);
        continue;
      }
      // Fade near end of life
      if (orb.life < 1500) {
        orb.gfx.setAlpha(orb.life / 1500);
      }
      // Attract to player when close
      const dx = p.x - orb.x;
      const dy = p.y - orb.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 80 && p.alive) {
        // Magnetic pull
        const pullSpeed = 320 * delta / 1000;
        const move = Math.min(dist, pullSpeed);
        orb.x += (dx / dist) * move;
        orb.y += (dy / dist) * move;
        orb.gfx.setPosition(orb.x, orb.y);
      }
      // Pickup
      if (dist < pickupRadius && p.alive && p.hp < p.hpMax) {
        const healed = Math.min(HEALTH_ORB.healAmount, p.hpMax - p.hp);
        p.hp = Math.min(p.hpMax, p.hp + HEALTH_ORB.healAmount);
        p.scene.events.emit('player-hp-changed');
        this.fx.damageNumber(orb.x, orb.y - 20, `+${Math.round(healed)} HP`, '#40b8ff', false);
        this.fx.burst(orb.x, orb.y, 'yellow', 8);
        this.tweens.killTweensOf(orb.gfx);
        orb.gfx.destroy();
        this.healthOrbs.splice(i, 1);
        SFX.heal();
      }
    }
  }

  circleOverlap(a, b) {
    const ra = (a.body?.width || 14) / 2;
    const rb = b.cfg?.radius ?? (b === this.player ? PLAYER.radius : 22);
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    return dist < ra + rb - 2;
  }

  drawAimCone() {
    const g = this.aimGraphics;
    g.clear();
    const p = this.player;
    if (!p || !p.alive) return;

    const startGap = PLAYER.radius + 6;

    // Only one cone shows at a time. Super beats normal if both are flagged.
    if (p.superAiming && p.superCharge >= PLAYER.superHitsToCharge) {
      this.drawCone(
        g,
        p.x,
        p.y,
        p.superAim,
        Phaser.Math.DegToRad(PLAYER.superSpreadDeg),
        PLAYER.superRange,
        startGap,
        0xff2020, // deep red (missile barrage)
        0xff8080,
        0.30
      );
    } else if (p.aiming) {
      this.drawCone(
        g,
        p.x,
        p.y,
        p.aim,
        Phaser.Math.DegToRad(PLAYER.pelletSpreadDeg),
        PLAYER.pelletRange,
        startGap,
        0xff2828, // red blaster cone
        0xff9090,
        0.18
      );
    }
  }

  // Brawl-Stars-style soft cone: 2 stacked, fading triangular bands
  // (fakes a gradient) + a glowing tip dot. No dotted rays, no edge lines.
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
      g.moveTo(x + Math.cos(angle - half) * startGap * 0.6, y + Math.sin(angle - half) * startGap * 0.6);
      for (let i = 0; i <= steps; i++) {
        const a = angle - half + (spread * i) / steps;
        g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      g.lineTo(x + Math.cos(angle + half) * startGap * 0.6, y + Math.sin(angle + half) * startGap * 0.6);
      g.closePath();
      g.fillPath();
    }
    // Soft glow at the tip
    const tipX = x + Math.cos(angle) * range;
    const tipY = y + Math.sin(angle) * range;
    g.fillStyle(tipColor, 0.22);
    g.fillCircle(tipX, tipY, 20);
    g.fillStyle(tipColor, 0.55);
    g.fillCircle(tipX, tipY, 10);
  }

  victory() {
    this.scene.start('GameOver', { win: true });
  }

  defeat() {
    this.scene.start('GameOver', { win: false });
  }
}
