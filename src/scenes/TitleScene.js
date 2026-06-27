import Phaser from 'phaser';
import { VIEW } from '../config.js';
import { SFX } from '../systems/FX.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setBackgroundColor('#06060c');
    const cx = VIEW.width / 2;

    // ── Starfield background ──────────────────────────────────────────────
    const g = this.add.graphics();

    // Deep space base gradient (very subtle)
    g.fillStyle(0x06060c, 1);
    g.fillRect(0, 0, VIEW.width, VIEW.height);

    // Stars — small bright dots at random positions
    const rng = new Phaser.Math.RandomDataGenerator(['sw-title-seed']);
    for (let i = 0; i < 220; i++) {
      const sx = rng.between(0, VIEW.width);
      const sy = rng.between(0, VIEW.height);
      const bright = rng.frac();
      const size = bright > 0.92 ? 3 : bright > 0.75 ? 2 : 1;
      const alpha = 0.4 + bright * 0.6;
      g.fillStyle(0xffffff, alpha);
      g.fillRect(sx, sy, size, size);
    }

    // Nebula haze (subtle color washes)
    g.fillStyle(0x000030, 0.25);
    g.fillEllipse(cx * 0.4, VIEW.height * 0.3, 500, 300);
    g.fillStyle(0x200010, 0.2);
    g.fillEllipse(cx * 1.6, VIEW.height * 0.7, 400, 280);

    // ── Death Star silhouette (enormous sphere, partially visible) ────────
    // Outer glow
    g.fillStyle(0x181828, 0.6);
    g.fillCircle(cx + 180, VIEW.height * 0.22, 320);
    // Sphere body
    g.fillStyle(0x1a1a22, 1);
    g.fillCircle(cx + 180, VIEW.height * 0.22, 295);
    // Surface panel lines (simplified)
    g.lineStyle(1, 0x2a2a38, 0.5);
    g.strokeCircle(cx + 180, VIEW.height * 0.22, 295);
    // Superlaser dish
    g.fillStyle(0x282838, 1);
    g.fillCircle(cx + 100, VIEW.height * 0.28, 60);
    g.fillStyle(0x0a0a1a, 1);
    g.fillCircle(cx + 100, VIEW.height * 0.28, 45);
    g.fillStyle(0x101030, 0.8);
    g.fillCircle(cx + 100, VIEW.height * 0.28, 28);
    // Dish glow hint
    g.fillStyle(0x0030aa, 0.2);
    g.fillCircle(cx + 100, VIEW.height * 0.28, 65);
    // Equatorial trench line
    g.lineStyle(2, 0x2e2e3e, 0.7);
    g.strokeEllipse(cx + 180, VIEW.height * 0.22, 590, 50);

    // ── CRIX Title ─────────────────────────────────────────────────────────
    // Shadow
    this.add
      .text(cx + 6, VIEW.height * 0.52 + 6, 'CRIX', {
        fontFamily: 'Courier New, monospace',
        fontSize: '160px',
        fontStyle: 'bold',
        color: '#000000',
      })
      .setOrigin(0.5)
      .setAlpha(0.5);

    const title = this.add
      .text(cx, VIEW.height * 0.52, 'CRIX', {
        fontFamily: 'Courier New, monospace',
        fontSize: '160px',
        fontStyle: 'bold',
        color: '#ff2020',
        stroke: '#660000',
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    // Saber glow tween on title
    this.tweens.add({
      targets: title,
      alpha: 0.85,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Subtitle
    this.add
      .text(cx, VIEW.height * 0.60, 'A BOUNTY HUNTER\'S TALE', {
        fontFamily: 'Courier New, monospace',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#90d8ff',
        stroke: '#000000',
        strokeThickness: 4,
        letterSpacing: 4,
      })
      .setOrigin(0.5);

    // ── Mandalorian portrait ──────────────────────────────────────────────
    // Use player sprite frame 0 at large scale
    const portrait = this.add.sprite(cx, VIEW.height * 0.74, 'player', 0).setScale(3.5);
    portrait.play('mando-idle');
    // Subtle float tween
    this.tweens.add({
      targets: portrait,
      y: portrait.y - 16,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── ENGAGE button — Imperial console style ────────────────────────────
    const btnY = VIEW.height * 0.88;
    const btnW = 380, btnH = 100;
    const btnBg = this.add.graphics();

    const drawBtn = (hover) => {
      btnBg.clear();
      // Drop shadow
      btnBg.fillStyle(0x000000, 0.6);
      btnBg.fillRoundedRect(cx - btnW / 2 + 4, btnY - btnH / 2 + 6, btnW, btnH, 6);
      // Imperial console plate
      btnBg.fillStyle(hover ? 0x2e3038 : 0x14161c, 1);
      btnBg.fillRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 6);
      // Red LED border
      btnBg.lineStyle(3, hover ? 0xff2020 : 0x880000, 1);
      btnBg.strokeRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 6);
      // Inner highlight
      btnBg.fillStyle(hover ? 0xff2020 : 0x440000, 0.25);
      btnBg.fillRoundedRect(cx - btnW / 2 + 6, btnY - btnH / 2 + 6, btnW - 12, 16, 4);
      // Corner pips (Imperial 4-dot corners)
      const pips = [
        [cx - btnW / 2 + 12, btnY - btnH / 2 + 12],
        [cx + btnW / 2 - 12, btnY - btnH / 2 + 12],
        [cx - btnW / 2 + 12, btnY + btnH / 2 - 12],
        [cx + btnW / 2 - 12, btnY + btnH / 2 - 12],
      ];
      pips.forEach(([px, py]) => {
        btnBg.fillStyle(hover ? 0xff2020 : 0x880000, 1);
        btnBg.fillRect(px - 3, py - 3, 6, 6);
      });
    };

    drawBtn(false);

    const btnText = this.add
      .text(cx, btnY, 'ENGAGE', {
        fontFamily: 'Courier New, monospace',
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#ff2828',
        stroke: '#000000',
        strokeThickness: 4,
        letterSpacing: 6,
      })
      .setOrigin(0.5);

    const zone = this.add
      .zone(cx, btnY, btnW, btnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => drawBtn(true));
    zone.on('pointerout', () => drawBtn(false));
    zone.on('pointerdown', () => drawBtn(true));
    zone.on('pointerup', () => {
      SFX.uiClick();
      this.cameras.main.fadeOut(220, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Intro'));
    });

    // Pulse button text
    this.tweens.add({
      targets: btnText,
      scale: 1.05,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Tip line
    this.add
      .text(cx, VIEW.height - 50, 'Left stick: move    Right stick: aim & fire    Star: MISSILES', {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#4a5a80',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Stats
    const stats = loadStats();
    if (stats.wins > 0 || stats.runs > 0) {
      this.add
        .text(cx, VIEW.height * 0.62, `BOUNTIES: ${stats.wins || 0}   MISSIONS: ${stats.runs}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '20px',
          color: '#40b8ff',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5);
    }

    this.cameras.main.fadeIn(220, 0, 0, 0);
  }
}

export function loadStats() {
  try {
    return JSON.parse(localStorage.getItem('crix.stats') || '{}');
  } catch (_) {
    return {};
  }
}

export function saveStats(s) {
  try {
    localStorage.setItem('crix.stats', JSON.stringify(s));
  } catch (_) { /* noop */ }
}
