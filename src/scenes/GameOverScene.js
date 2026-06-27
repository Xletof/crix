import Phaser from 'phaser';
import { VIEW } from '../config.js';
import { SFX, stopMusic } from '../systems/FX.js';
import { loadStats, saveStats } from './TitleScene.js';
import { NARRATIVE } from '../data/narrative.js';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create({ win }) {
    stopMusic();
    if (win) SFX.victory();
    else SFX.defeat();

    const stats = loadStats();
    stats.runs = (stats.runs || 0) + 1;
    if (win) stats.wins = (stats.wins || 0) + 1;
    saveStats(stats);

    const cx = VIEW.width / 2;
    this.cameras.main.setBackgroundColor('#06060c');

    const g = this.add.graphics();

    // ── Background ─────────────────────────────────────────────────────────
    g.fillStyle(0x06060c, 1);
    g.fillRect(0, 0, VIEW.width, VIEW.height);

    // Stars
    const rng = new Phaser.Math.RandomDataGenerator(['sw-gameover-seed']);
    for (let i = 0; i < 160; i++) {
      const sx = rng.between(0, VIEW.width);
      const sy = rng.between(0, VIEW.height);
      const b = rng.frac();
      g.fillStyle(0xffffff, 0.3 + b * 0.5);
      g.fillRect(sx, sy, b > 0.88 ? 2 : 1, b > 0.88 ? 2 : 1);
    }

    if (win) {
      // ── WIN: Hologram transmission panel ────────────────────────────────
      // Blue hologram glow backdrop
      g.fillStyle(0x0038bb, 0.08);
      g.fillRect(0, 0, VIEW.width, VIEW.height);

      // Scan line effect
      for (let y = 0; y < VIEW.height; y += 6) {
        g.fillStyle(0x0050ff, 0.04);
        g.fillRect(0, y, VIEW.width, 2);
      }

      // Panel border
      const pw = VIEW.width - 60, ph = 700;
      const px = 30, py = 60;
      g.lineStyle(3, 0x0060ff, 0.9);
      g.strokeRoundedRect(px, py, pw, ph, 6);
      g.fillStyle(0x001830, 0.6);
      g.fillRoundedRect(px, py, pw, ph, 6);
      // Corner brackets
      this._brackets(g, px, py, pw, ph, 0x0080ff, 20);

      // "TRANSMISSION RECEIVED" header
      this.add.text(cx, py + 40, '[ TRANSMISSION RECEIVED ]', {
        fontFamily: 'Courier New, monospace',
        fontSize: '22px',
        color: '#4080ff',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);

      // Main outcome
      const outcomeY = py + 200;
      const outcomeShadow = this.add.text(cx + 4, outcomeY + 4, 'BOUNTY\nDELIVERED', {
        fontFamily: 'Courier New, monospace',
        fontSize: '82px',
        fontStyle: 'bold',
        color: '#000000',
        align: 'center',
      }).setOrigin(0.5).setAlpha(0.5);

      const outcome = this.add.text(cx, outcomeY, 'BOUNTY\nDELIVERED', {
        fontFamily: 'Courier New, monospace',
        fontSize: '82px',
        fontStyle: 'bold',
        color: '#4080ff',
        stroke: '#001060',
        strokeThickness: 6,
        align: 'center',
      }).setOrigin(0.5);

      // Pop-in
      outcome.setScale(0.3);
      outcomeShadow.setScale(0.3);
      this.tweens.add({
        targets: [outcome, outcomeShadow],
        scale: 1,
        duration: 380,
        delay: 80,
        ease: 'Back.easeOut',
      });

      // Hologram flicker
      this.tweens.add({
        targets: outcome,
        alpha: { from: 1, to: 0.75 },
        duration: 120,
        yoyo: true,
        repeat: -1,
        repeatDelay: 1800,
        ease: 'Linear',
      });

      // Subtitle — questline closing line.
      this.add.text(cx, py + 370, NARRATIVE.victoryLine, {
        fontFamily: 'Courier New, monospace',
        fontSize: '20px',
        fontStyle: 'italic',
        color: '#8ab8ff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);

      // Stats
      g.fillStyle(0x0038bb, 0.2);
      g.fillRoundedRect(px + 30, py + 405, pw - 60, 44, 4);
      g.lineStyle(1, 0x0060ff, 0.5);
      g.strokeRoundedRect(px + 30, py + 405, pw - 60, 44, 4);
      this.add.text(cx, py + 427, `BOUNTIES: ${stats.wins || 0}   MISSIONS: ${stats.runs}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '22px',
        color: '#60a0ff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);

      // Buttons
      this.impButton(cx, py + ph - 160, 'NEW MISSION', true, () => {
        SFX.uiClick();
        this.cameras.main.fadeOut(220, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
      }, win);
      this.impButton(cx, py + ph - 60, 'MAIN MENU', false, () => {
        SFX.uiClick();
        this.cameras.main.fadeOut(220, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
      }, win);

    } else {
      // ── LOSE: Imperial Alert Screen ──────────────────────────────────────
      // Red alert overlay
      g.fillStyle(0x200000, 0.7);
      g.fillRect(0, 0, VIEW.width, VIEW.height);

      // Red scan lines
      for (let y = 0; y < VIEW.height; y += 6) {
        g.fillStyle(0xff0000, 0.04);
        g.fillRect(0, y, VIEW.width, 2);
      }

      // Panel border
      const pw = VIEW.width - 60, ph = 700;
      const px = 30, py = 60;
      g.lineStyle(3, 0xff0000, 0.9);
      g.strokeRoundedRect(px, py, pw, ph, 6);
      g.fillStyle(0x1a0000, 0.75);
      g.fillRoundedRect(px, py, pw, ph, 6);
      this._brackets(g, px, py, pw, ph, 0xff2020, 20);

      // "IMPERIAL ALERT" header
      this.add.text(cx, py + 40, '[ IMPERIAL ALERT ]', {
        fontFamily: 'Courier New, monospace',
        fontSize: '24px',
        color: '#ff2020',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);

      // Imperial logo hint (cog outline)
      g.lineStyle(2, 0x440000, 0.8);
      g.strokeCircle(cx, py + 120, 36);
      g.strokeCircle(cx, py + 120, 20);
      // 8 cog teeth
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const r1 = 38, r2 = 46;
        g.lineStyle(3, 0x550000, 0.8);
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r1, py + 120 + Math.sin(a) * r1);
        g.lineTo(cx + Math.cos(a) * r2, py + 120 + Math.sin(a) * r2);
        g.strokePath();
      }

      // Main outcome
      const outcomeY = py + 230;
      const outcomeShadow = this.add.text(cx + 4, outcomeY + 4, 'TARGET\nNEUTRALIZED', {
        fontFamily: 'Courier New, monospace',
        fontSize: '78px',
        fontStyle: 'bold',
        color: '#000000',
        align: 'center',
      }).setOrigin(0.5).setAlpha(0.5);

      const outcome = this.add.text(cx, outcomeY, 'TARGET\nNEUTRALIZED', {
        fontFamily: 'Courier New, monospace',
        fontSize: '78px',
        fontStyle: 'bold',
        color: '#ff2020',
        stroke: '#440000',
        strokeThickness: 6,
        align: 'center',
      }).setOrigin(0.5);

      outcome.setScale(0.3);
      outcomeShadow.setScale(0.3);
      this.tweens.add({
        targets: [outcome, outcomeShadow],
        scale: 1,
        duration: 380,
        delay: 80,
        ease: 'Back.easeOut',
      });

      // Flicker
      this.tweens.add({
        targets: outcome,
        alpha: { from: 1, to: 0.6 },
        duration: 80,
        yoyo: true,
        repeat: -1,
        repeatDelay: 1200,
      });

      this.add.text(cx, py + 405, 'The bounty hunter has been eliminated.', {
        fontFamily: 'Courier New, monospace',
        fontSize: '20px',
        fontStyle: 'italic',
        color: '#aa4040',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);

      g.fillStyle(0xff0000, 0.1);
      g.fillRoundedRect(px + 30, py + 440, pw - 60, 44, 4);
      g.lineStyle(1, 0xff0000, 0.4);
      g.strokeRoundedRect(px + 30, py + 440, pw - 60, 44, 4);
      this.add.text(cx, py + 462, `CAPTURES: ${stats.wins || 0}   MISSIONS: ${stats.runs}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '22px',
        color: '#cc4040',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);

      this.impButton(cx, py + ph - 160, 'RETRY MISSION', true, () => {
        SFX.uiClick();
        this.cameras.main.fadeOut(220, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
      }, win);
      this.impButton(cx, py + ph - 60, 'MAIN MENU', false, () => {
        SFX.uiClick();
        this.cameras.main.fadeOut(220, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
      }, win);
    }

    this.cameras.main.fadeIn(280, 0, 0, 0);
  }

  // Corner bracket decoration helper
  _brackets(g, x, y, w, h, color, size) {
    g.lineStyle(3, color, 1);
    // TL
    g.beginPath(); g.moveTo(x + size, y); g.lineTo(x, y); g.lineTo(x, y + size); g.strokePath();
    // TR
    g.beginPath(); g.moveTo(x + w - size, y); g.lineTo(x + w, y); g.lineTo(x + w, y + size); g.strokePath();
    // BL
    g.beginPath(); g.moveTo(x + size, y + h); g.lineTo(x, y + h); g.lineTo(x, y + h - size); g.strokePath();
    // BR
    g.beginPath(); g.moveTo(x + w - size, y + h); g.lineTo(x + w, y + h); g.lineTo(x + w, y + h - size); g.strokePath();
  }

  // Imperial-style button
  impButton(cx, cy, label, isPrimary, onClick, win) {
    const btnW = 380, btnH = 78;
    const bg = this.add.graphics();
    const mainColor = win
      ? (isPrimary ? 0x0040cc : 0x002080)
      : (isPrimary ? 0xcc0000 : 0x660000);
    const hoverColor = win
      ? (isPrimary ? 0x0060ff : 0x003acc)
      : (isPrimary ? 0xff2020 : 0xaa0000);
    const borderColor = win ? 0x0080ff : 0xff2020;
    const textColor = win ? '#40b8ff' : '#ff4444';

    const draw = (hover) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.5);
      bg.fillRoundedRect(cx - btnW / 2 + 3, cy - btnH / 2 + 5, btnW, btnH, 4);
      bg.fillStyle(hover ? hoverColor : mainColor, 1);
      bg.fillRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 4);
      bg.lineStyle(2, borderColor, hover ? 1 : 0.6);
      bg.strokeRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 4);
      // Top shimmer
      bg.fillStyle(0xffffff, hover ? 0.12 : 0.06);
      bg.fillRoundedRect(cx - btnW / 2 + 6, cy - btnH / 2 + 6, btnW - 12, 12, 3);
    };

    draw(false);

    const text = this.add.text(cx, cy, label, {
      fontFamily: 'Courier New, monospace',
      fontSize: '36px',
      fontStyle: 'bold',
      color: textColor,
      stroke: '#000000',
      strokeThickness: 3,
      letterSpacing: 4,
    }).setOrigin(0.5);

    if (isPrimary) {
      this.tweens.add({
        targets: text,
        scale: 1.04,
        duration: 750,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    const zone = this.add.zone(cx, cy, btnW, btnH).setOrigin(0.5).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', () => draw(true));
    zone.on('pointerup', () => onClick());
  }
}
