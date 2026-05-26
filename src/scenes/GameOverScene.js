import Phaser from 'phaser';
import { VIEW } from '../config.js';
import { SFX, stopMusic } from '../systems/FX.js';
import { loadStats, saveStats } from './TitleScene.js';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create({ win }) {
    stopMusic();
    if (win) SFX.victory();
    else SFX.defeat();

    // Update stats
    const stats = loadStats();
    stats.runs = (stats.runs || 0) + 1;
    if (win) stats.wins = (stats.wins || 0) + 1;
    saveStats(stats);

    const cx = VIEW.width / 2;
    const cy = VIEW.height / 2;

    this.cameras.main.setBackgroundColor('#0b0d12');

    const g = this.add.graphics();
    g.fillStyle(win ? 0x1b5e20 : 0x4a0e0e, 1);
    g.fillRect(0, 0, VIEW.width, VIEW.height);
    g.fillStyle(0x000000, 0.4);
    g.fillRect(0, 0, VIEW.width, VIEW.height);

    const title = this.add
      .text(cx, cy - 160, win ? 'VICTORY!' : 'DEFEAT', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '108px',
        fontStyle: '900',
        color: win ? '#ffe066' : '#ff4d6d',
        stroke: '#000000',
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    title.setScale(0.4);
    this.tweens.add({
      targets: title,
      scale: 1.0,
      duration: 400,
      ease: 'Back.easeOut',
    });

    this.add
      .text(cx, cy - 30, win ? 'You cleared the arena.' : 'You were brawled.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 30, `Wins: ${stats.wins || 0}   Runs: ${stats.runs}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#ffd166',
      })
      .setOrigin(0.5);

    // Buttons
    this.button(cx, cy + 140, 'PLAY AGAIN', 0x4cd964, () => {
      this.cameras.main.fadeOut(220, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
    });
    this.button(cx, cy + 270, 'MAIN MENU', 0x3a8bff, () => {
      this.cameras.main.fadeOut(220, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
    });

    this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  button(cx, cy, label, color, onClick) {
    const w = 360;
    const h = 90;
    const bg = this.add.graphics();
    const draw = (c) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.4);
      bg.fillRoundedRect(cx - w / 2 + 4, cy - h / 2 + 6, w, h, 18);
      bg.fillStyle(c, 1);
      bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 18);
      bg.lineStyle(4, 0xffffff, 0.4);
      bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 18);
    };
    draw(color);
    const text = this.add
      .text(cx, cy, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '40px',
        fontStyle: '900',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    const zone = this.add
      .zone(cx, cy, w, h)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(Phaser.Display.Color.IntegerToColor(color).brighten(15).color));
    zone.on('pointerout', () => draw(color));
    zone.on('pointerup', () => {
      SFX.uiClick();
      onClick();
    });
  }
}
