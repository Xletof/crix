import Phaser from 'phaser';
import { VIEW, COLORS } from '../config.js';
import { SFX } from '../systems/FX.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b0d12');

    // Title artwork: layered text + a "brawler" portrait (player sprite)
    const cx = VIEW.width / 2;

    // Background flourish
    const g = this.add.graphics();
    g.fillStyle(0x1c2436, 1);
    g.fillRect(0, VIEW.height * 0.35, VIEW.width, VIEW.height * 0.5);
    g.fillStyle(0x2a3856, 1);
    g.fillTriangle(0, VIEW.height * 0.35, VIEW.width, VIEW.height * 0.35, VIEW.width, VIEW.height * 0.45);

    // Title text
    const titleShadow = this.add
      .text(cx + 6, 240 + 6, 'CRIX', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '160px',
        fontStyle: '900',
        color: '#000000',
      })
      .setOrigin(0.5);
    titleShadow.setAlpha(0.5);
    const title = this.add
      .text(cx, 240, 'CRIX', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '160px',
        fontStyle: '900',
        color: '#ffe066',
        stroke: '#7a4b00',
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    title.setAngle(-2);

    const sub = this.add
      .text(cx, 360, 'ARENA SHOWDOWN', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    sub.setAlpha(0.85);

    // Brawler portrait
    const portrait = this.add.image(cx, VIEW.height * 0.58, 'player').setScale(3);
    portrait.setRotation(0);
    this.tweens.add({
      targets: portrait,
      y: portrait.y - 18,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // PLAY button
    const btnY = VIEW.height * 0.82;
    const btnW = 360;
    const btnH = 110;
    const btnBg = this.add.graphics();
    const drawBtn = (color) => {
      btnBg.clear();
      btnBg.fillStyle(0x000000, 0.4);
      btnBg.fillRoundedRect(cx - btnW / 2 + 4, btnY - btnH / 2 + 6, btnW, btnH, 22);
      btnBg.fillStyle(color, 1);
      btnBg.fillRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 22);
      btnBg.lineStyle(4, 0xffffff, 0.4);
      btnBg.strokeRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 22);
    };
    drawBtn(0x4cd964);
    const btnText = this.add
      .text(cx, btnY, 'PLAY', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '54px',
        fontStyle: '900',
        color: '#ffffff',
        stroke: '#0b3a14',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const zone = this.add
      .zone(cx, btnY, btnW, btnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => drawBtn(0x66e078));
    zone.on('pointerout', () => drawBtn(0x4cd964));
    zone.on('pointerdown', () => drawBtn(0x3aab50));
    zone.on('pointerup', () => {
      SFX.uiClick();
      this.cameras.main.fadeOut(220, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
    });

    // Pulse the button
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
      .text(cx, VIEW.height - 60, 'Left stick: move    Right stick: aim & fire    SUPER: tap star', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#9ab',
      })
      .setOrigin(0.5);

    // Stats line
    const stats = loadStats();
    if (stats.wins > 0 || stats.runs > 0) {
      this.add
        .text(cx, 420, `Wins: ${stats.wins}   Runs: ${stats.runs}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '20px',
          color: '#ffd166',
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
  } catch (_) {
    /* noop */
  }
}
