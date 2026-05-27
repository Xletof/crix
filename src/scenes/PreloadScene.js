import Phaser from 'phaser';
import { WORLD, PLAYER, COLORS } from '../config.js';
import { initAudio } from '../systems/FX.js';

// All textures are generated at runtime via Phaser.Graphics so we don't depend
// on any external CDN-hosted art. The keys here are referenced from entities
// and scenes — keep names in sync.

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    // Hand-authored SVG characters — rasterized by Phaser at load time.
    this.load.svg('player', 'sprites/player.svg', { width: 96, height: 96 });
    this.load.svg('grunt', 'sprites/grunt.svg', { width: 96, height: 96 });
    this.load.svg('shooter', 'sprites/shooter.svg', { width: 96, height: 96 });
    this.load.svg('boss', 'sprites/boss.svg', { width: 200, height: 200 });
  }

  create() {
    this.makeBackdrop();
    this.makeBush();
    this.makeWall();

    this.makeBullet('bullet', COLORS.bullet, PLAYER.pelletRadius);
    this.makeBullet('bullet-super', COLORS.bulletSuper, PLAYER.superRadius);
    this.makeBullet('bullet-enemy', COLORS.enemyBullet, 8);

    this.makeMuzzle('muzzle', 0xfff3b0);
    this.makeSpark('spark', 0xffffff);
    this.makeSpark('spark-red', 0xff6b6b);
    this.makeSpark('spark-yellow', 0xffe066);
    this.makeShadow('shadow', 36);
    this.makeShadow('shadow-boss', 84);

    this.makeJoystickGfx();
    this.makeSuperButton();

    initAudio();

    this.scene.start('Title');
  }

  // -- factories ------------------------------------------------------

  makeBackdrop() {
    const w = WORLD.width;
    const h = WORLD.height;
    const tex = this.textures.createCanvas('backdrop', w, h);
    const ctx = tex.getContext();
    ctx.fillStyle = colorHex(WORLD.bg);
    ctx.fillRect(0, 0, w, h);
    // Subtle diagonal stripes for that "wheat field" feel
    ctx.strokeStyle = colorHex(WORLD.bgDark);
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 2;
    for (let i = -h; i < w; i += 26) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();
    }
    // Random tufts
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = colorHex(WORLD.bgDark);
    for (let i = 0; i < 600; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + Math.random() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    tex.refresh();
  }

  makeBush() {
    const size = 130;
    const g = this.add.graphics();
    g.fillStyle(WORLD.bushColorDark, 1);
    g.fillCircle(size / 2, size / 2, size / 2);
    g.fillStyle(WORLD.bushColor, 1);
    // Cluster of blobs
    const blobs = [
      [size * 0.32, size * 0.4, size * 0.28],
      [size * 0.65, size * 0.36, size * 0.3],
      [size * 0.5, size * 0.6, size * 0.34],
      [size * 0.28, size * 0.65, size * 0.22],
      [size * 0.72, size * 0.7, size * 0.24],
    ];
    blobs.forEach(([x, y, r]) => g.fillCircle(x, y, r));
    // Highlight
    g.fillStyle(0x6fcf78, 0.55);
    g.fillCircle(size * 0.42, size * 0.4, size * 0.1);
    g.generateTexture('bush', size, size);
    g.destroy();
  }

  makeWall() {
    const size = 100;
    const g = this.add.graphics();
    g.fillStyle(WORLD.wallColor, 1);
    g.fillRoundedRect(0, 0, size, size, 14);
    g.fillStyle(0xa3784f, 1);
    g.fillRoundedRect(8, 8, size - 16, size - 16, 10);
    g.lineStyle(4, WORLD.wallColor, 1);
    g.strokeRoundedRect(8, 8, size - 16, size - 16, 10);
    g.generateTexture('wall', size, size);
    g.destroy();
  }

  makeBullet(key, color, radius) {
    const pad = 4;
    const size = (radius + pad) * 2;
    const cx = size / 2;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3);
    g.fillCircle(cx, cx + 1, radius);
    g.fillStyle(color, 1);
    g.fillCircle(cx, cx, radius);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(cx - radius * 0.35, cx - radius * 0.35, radius * 0.5);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  makeMuzzle(key, color) {
    const size = 40;
    const cx = size / 2;
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(cx, cx, 14);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx, cx, 7);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  makeSpark(key, color) {
    const size = 14;
    const cx = size / 2;
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(cx, cx, 5);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  makeShadow(key, radius) {
    const size = radius * 2;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.32);
    g.fillEllipse(radius, radius, radius * 1.6, radius * 0.7);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  makeJoystickGfx() {
    // Base ring
    const r = 110;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.08);
    g.fillCircle(r, r, r);
    g.lineStyle(4, 0xffffff, 0.32);
    g.strokeCircle(r, r, r - 4);
    g.generateTexture('joystick-base', r * 2, r * 2);
    g.destroy();

    // Knob
    const kr = 50;
    const g2 = this.add.graphics();
    g2.fillStyle(0xffffff, 0.18);
    g2.fillCircle(kr, kr, kr);
    g2.fillStyle(0xffffff, 0.55);
    g2.fillCircle(kr, kr, kr - 6);
    g2.fillStyle(0xffffff, 0.85);
    g2.fillCircle(kr - 10, kr - 10, kr * 0.5);
    g2.generateTexture('joystick-knob', kr * 2, kr * 2);
    g2.destroy();
  }

  makeSuperButton() {
    const r = 60;
    const size = r * 2 + 8;
    const cx = size / 2;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.18);
    g.fillCircle(cx, cx, r);
    g.lineStyle(4, COLORS.superReady, 0.85);
    g.strokeCircle(cx, cx, r - 4);
    g.fillStyle(COLORS.superGauge, 1);
    g.fillCircle(cx, cx, r * 0.5);
    g.fillStyle(0xffffff, 1);
    // Star shape via overlapping triangles approximation
    drawStar(g, cx, cx, 5, r * 0.42, r * 0.18, 0xffffff);
    g.generateTexture('super-btn', size, size);
    g.destroy();

    const g2 = this.add.graphics();
    g2.fillStyle(0x000000, 0.35);
    g2.fillCircle(cx, cx, r);
    g2.lineStyle(4, 0x666666, 0.6);
    g2.strokeCircle(cx, cx, r - 4);
    g2.fillStyle(0x666666, 1);
    drawStar(g2, cx, cx, 5, r * 0.42, r * 0.18, 0x888888);
    g2.generateTexture('super-btn-off', size, size);
    g2.destroy();
  }
}

function drawStar(g, cx, cy, points, outer, inner) {
  const step = Math.PI / points;
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = i * step - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fillPath();
}

function colorHex(n) {
  return '#' + n.toString(16).padStart(6, '0');
}
