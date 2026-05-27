import Phaser from 'phaser';
import { VIEW } from '../config.js';
import { SFX } from '../systems/FX.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a0e06');

    const cx = VIEW.width / 2;

    // Background: dusty horizon — sky band + ground band
    const g = this.add.graphics();
    // Sky / sun gradient bands
    g.fillStyle(0x6a3a20, 1);
    g.fillRect(0, 0, VIEW.width, VIEW.height * 0.5);
    g.fillStyle(0x8a5828, 1);
    g.fillRect(0, VIEW.height * 0.20, VIEW.width, VIEW.height * 0.18);
    g.fillStyle(0xb07820, 1);
    g.fillRect(0, VIEW.height * 0.30, VIEW.width, VIEW.height * 0.10);
    // Sun
    g.fillStyle(0xffd040, 1);
    g.fillCircle(cx, VIEW.height * 0.34, 80);
    g.fillStyle(0xff7020, 0.5);
    g.fillCircle(cx, VIEW.height * 0.34, 110);
    // Ground band (dirt)
    g.fillStyle(0xd4a96a, 1);
    g.fillRect(0, VIEW.height * 0.4, VIEW.width, VIEW.height * 0.6);
    // Dirt darker band
    g.fillStyle(0xa87848, 1);
    g.fillRect(0, VIEW.height * 0.4, VIEW.width, 12);

    // Scatter dust pebbles on ground
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * VIEW.width;
      const y = VIEW.height * 0.42 + Math.random() * VIEW.height * 0.58;
      const s = Math.random() < 0.7 ? 3 : 5;
      g.fillStyle(Math.random() < 0.5 ? 0x6a3a20 : 0x4a2818, 0.7);
      g.fillRect(x, y, s, s);
    }

    // Title text — chunky wood-burned western look
    const titleShadow = this.add
      .text(cx + 8, 230 + 8, 'CRIX', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '180px',
        fontStyle: '900',
        color: '#1a0a04',
      })
      .setOrigin(0.5);
    titleShadow.setAlpha(0.7);
    const title = this.add
      .text(cx, 230, 'CRIX', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '180px',
        fontStyle: '900',
        color: '#ffd040',
        stroke: '#5a3018',
        strokeThickness: 12,
      })
      .setOrigin(0.5);
    title.setAngle(-3);

    const sub = this.add
      .text(cx, 360, 'WANTED · DEAD OR ALIVE', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#f0e0b8',
        stroke: '#1a0a04',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    sub.setAlpha(0.95);

    // Sheriff portrait
    const portrait = this.add.image(cx, VIEW.height * 0.60, 'player').setScale(3);
    portrait.setRotation(0);
    this.tweens.add({
      targets: portrait,
      y: portrait.y - 18,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // PLAY button — brass plate look
    const btnY = VIEW.height * 0.83;
    const btnW = 380;
    const btnH = 110;
    const btnBg = this.add.graphics();
    const drawBtn = (hover) => {
      btnBg.clear();
      // Dark drop shadow
      btnBg.fillStyle(0x1a0a04, 0.55);
      btnBg.fillRoundedRect(cx - btnW / 2 + 5, btnY - btnH / 2 + 7, btnW, btnH, 14);
      // Wood backplate
      btnBg.fillStyle(hover ? 0x6a3a20 : 0x4a2818, 1);
      btnBg.fillRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 14);
      // Brass plate inset
      btnBg.fillStyle(hover ? 0xffd040 : 0xb07820, 1);
      btnBg.fillRoundedRect(cx - btnW / 2 + 8, btnY - btnH / 2 + 8, btnW - 16, btnH - 16, 10);
      // Inner highlight
      btnBg.fillStyle(0xfff4b8, 0.35);
      btnBg.fillRoundedRect(cx - btnW / 2 + 12, btnY - btnH / 2 + 12, btnW - 24, 18, 8);
      // Rivets at corners
      [
        [cx - btnW / 2 + 18, btnY - btnH / 2 + 18],
        [cx + btnW / 2 - 18, btnY - btnH / 2 + 18],
        [cx - btnW / 2 + 18, btnY + btnH / 2 - 18],
        [cx + btnW / 2 - 18, btnY + btnH / 2 - 18],
      ].forEach(([x, y]) => {
        btnBg.fillStyle(0x3a1a08, 1);
        btnBg.fillCircle(x, y, 5);
        btnBg.fillStyle(0xc0c0c0, 0.9);
        btnBg.fillCircle(x - 1, y - 1, 2);
      });
    };
    drawBtn(false);
    const btnText = this.add
      .text(cx, btnY, 'DRAW!', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '56px',
        fontStyle: '900',
        color: '#1a0a04',
        stroke: '#5a3018',
        strokeThickness: 4,
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
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
    });

    // Pulse the button text
    this.tweens.add({
      targets: btnText,
      scale: 1.06,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Tip line
    this.add
      .text(cx, VIEW.height - 60, 'Left stick: move    Right stick: aim & fire    Drag star: SUPER', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '18px',
        color: '#e8c898',
        stroke: '#1a0a04',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Stats line
    const stats = loadStats();
    if (stats.wins > 0 || stats.runs > 0) {
      this.add
        .text(cx, 420, `Bounties: ${stats.wins}   Showdowns: ${stats.runs}`, {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '22px',
          color: '#ffd040',
          stroke: '#1a0a04',
          strokeThickness: 4,
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
