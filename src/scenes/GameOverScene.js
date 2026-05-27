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

    // ── Background: same sunset sky as TitleScene (desaturated when defeated) ──
    this.cameras.main.setBackgroundColor('#1a0e06');
    const g = this.add.graphics();

    if (win) {
      // Golden hour — triumph
      g.fillStyle(0x5a2e14, 1);
      g.fillRect(0, 0, VIEW.width, VIEW.height * 0.5);
      g.fillStyle(0x7a4820, 1);
      g.fillRect(0, VIEW.height * 0.18, VIEW.width, VIEW.height * 0.18);
      g.fillStyle(0xa06818, 1);
      g.fillRect(0, VIEW.height * 0.28, VIEW.width, VIEW.height * 0.12);
      // Glowing sun
      g.fillStyle(0xffd040, 1);
      g.fillCircle(cx, VIEW.height * 0.3, 72);
      g.fillStyle(0xff8020, 0.45);
      g.fillCircle(cx, VIEW.height * 0.3, 100);
      // Ground
      g.fillStyle(0xc4995a, 1);
      g.fillRect(0, VIEW.height * 0.38, VIEW.width, VIEW.height * 0.62);
      g.fillStyle(0x9a6838, 1);
      g.fillRect(0, VIEW.height * 0.38, VIEW.width, 10);
    } else {
      // Blood-red dusk — defeat
      g.fillStyle(0x3a0e08, 1);
      g.fillRect(0, 0, VIEW.width, VIEW.height * 0.5);
      g.fillStyle(0x5a1a10, 1);
      g.fillRect(0, VIEW.height * 0.18, VIEW.width, VIEW.height * 0.18);
      g.fillStyle(0x7a2810, 1);
      g.fillRect(0, VIEW.height * 0.28, VIEW.width, VIEW.height * 0.12);
      // Dim red sun
      g.fillStyle(0xcc2010, 0.8);
      g.fillCircle(cx, VIEW.height * 0.3, 60);
      g.fillStyle(0x880808, 0.35);
      g.fillCircle(cx, VIEW.height * 0.3, 90);
      // Dark ground
      g.fillStyle(0x7a4828, 1);
      g.fillRect(0, VIEW.height * 0.38, VIEW.width, VIEW.height * 0.62);
      g.fillStyle(0x4a2818, 1);
      g.fillRect(0, VIEW.height * 0.38, VIEW.width, 10);
    }

    // Scatter dust pebbles on the ground
    for (let i = 0; i < 120; i++) {
      const px = Math.random() * VIEW.width;
      const py = VIEW.height * 0.42 + Math.random() * VIEW.height * 0.58;
      const s = Math.random() < 0.7 ? 3 : 5;
      g.fillStyle(Math.random() < 0.5 ? 0x6a3a20 : 0x3a1808, 0.6);
      g.fillRect(px, py, s, s);
    }

    // ── WANTED POSTER PANEL ──
    const panelW = VIEW.width - 60;
    const panelH = 680;
    const panelX = 30;
    const panelY = 60;

    // Outer dark wood frame
    g.fillStyle(0x2a1408, 1);
    g.fillRoundedRect(panelX - 8, panelY - 8, panelW + 16, panelH + 16, 10);
    // Brass border highlight (left+top edges)
    g.fillStyle(0xb07820, 0.7);
    g.fillRoundedRect(panelX - 4, panelY - 4, panelW + 8, panelH + 8, 8);
    // Aged parchment interior
    g.fillStyle(win ? 0xe8c878 : 0xc8a060, 1);
    g.fillRoundedRect(panelX, panelY, panelW, panelH, 6);
    // Subtle inner shadow (vignette feel)
    g.fillStyle(0x1a0a04, 0.12);
    g.fillRoundedRect(panelX + 4, panelY + 4, panelW - 8, panelH - 8, 4);
    // Inner margin line (like a real wanted poster)
    g.lineStyle(3, 0x5a3018, 0.5);
    g.strokeRoundedRect(panelX + 14, panelY + 14, panelW - 28, panelH - 28, 4);

    // Corner nail rivets on the poster
    const nails = [
      [panelX + 22, panelY + 22],
      [panelX + panelW - 22, panelY + 22],
      [panelX + 22, panelY + panelH - 22],
      [panelX + panelW - 22, panelY + panelH - 22],
    ];
    for (const [nx, ny] of nails) {
      g.fillStyle(0x2a1408, 1);
      g.fillCircle(nx, ny, 7);
      g.fillStyle(0xa08048, 1);
      g.fillCircle(nx - 1.5, ny - 1.5, 3.5);
    }

    // ── "WANTED" header (or "DISPATCH") ──
    const headerLabel = win ? 'SHERIFF DISPATCH' : 'WANTED';
    this.add
      .text(cx, panelY + 50, headerLabel, {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: win ? '30px' : '52px',
        fontStyle: 'bold',
        color: '#3a1808',
        stroke: '#1a0a04',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    // Decorative divider line
    const divLineY = panelY + 82;
    g.fillStyle(0x5a3018, 0.6);
    g.fillRect(panelX + 30, divLineY, panelW - 60, 2);

    // ── Main Outcome Title ──
    const outcomeText = win ? 'BOUNTY\nCLAIMED!' : 'GUNNED\nDOWN';
    const outcomeColor = win ? '#8a4a08' : '#8a0808';
    const outcomeShadow = this.add
      .text(cx + 5, panelY + 155, outcomeText, {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '88px',
        fontStyle: '900',
        color: '#1a0a04',
        align: 'center',
        lineSpacing: -10,
      })
      .setOrigin(0.5);
    outcomeShadow.setAlpha(0.4);

    const outcomeTitle = this.add
      .text(cx, panelY + 150, outcomeText, {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '88px',
        fontStyle: '900',
        color: outcomeColor,
        stroke: '#3a1808',
        strokeThickness: 6,
        align: 'center',
        lineSpacing: -10,
      })
      .setOrigin(0.5);

    // Pop-in scale tween
    outcomeTitle.setScale(0.3);
    outcomeShadow.setScale(0.3);
    this.tweens.add({
      targets: [outcomeTitle, outcomeShadow],
      scale: 1,
      duration: 380,
      delay: 80,
      ease: 'Back.easeOut',
    });

    // ── Flavour subtitle ──
    const sub = win
      ? 'Justice served — all outlaws accounted for.'
      : 'The outlaws rode off into the sunset.';
    this.add
      .text(cx, panelY + 320, sub, {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '22px',
        fontStyle: 'italic',
        color: '#3a1808',
        stroke: '#e8c878',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    // Divider under subtitle
    g.fillStyle(0x5a3018, 0.45);
    g.fillRect(panelX + 50, panelY + 350, panelW - 100, 2);

    // ── Stats line ──
    this.add
      .text(cx, panelY + 380, `Bounties: ${stats.wins || 0}   Showdowns: ${stats.runs}`, {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '24px',
        color: '#2a1408',
        stroke: '#e8c878',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    // ── Buttons ──
    const btn1Y = panelY + panelH - 160;
    const btn2Y = panelY + panelH - 60;
    this.westernButton(cx, btn1Y, 'RIDE AGAIN', true, () => {
      SFX.uiClick();
      this.cameras.main.fadeOut(220, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
    });
    this.westernButton(cx, btn2Y, 'MAIN MENU', false, () => {
      SFX.uiClick();
      this.cameras.main.fadeOut(220, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
    });

    this.cameras.main.fadeIn(280, 0, 0, 0);
  }

  /**
   * Brass-plate-on-wood button matching TitleScene's "DRAW!" button style.
   * @param {number} cx - center x
   * @param {number} cy - center y
   * @param {string} label
   * @param {boolean} isPrimary - primary (gold brass) vs secondary (silver brass)
   * @param {Function} onClick
   */
  westernButton(cx, cy, label, isPrimary, onClick) {
    const btnW = 380;
    const btnH = 80;
    const bg = this.add.graphics();

    const draw = (hover) => {
      bg.clear();
      // Drop shadow
      bg.fillStyle(0x1a0a04, 0.5);
      bg.fillRoundedRect(cx - btnW / 2 + 4, cy - btnH / 2 + 6, btnW, btnH, 12);
      // Wood backplate
      bg.fillStyle(hover ? 0x6a3a20 : 0x3a1a08, 1);
      bg.fillRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 12);
      // Brass plate inset
      const brassOn  = isPrimary ? 0xffd040 : 0x909878;
      const brassOff = isPrimary ? 0xa07818 : 0x606858;
      bg.fillStyle(hover ? brassOn : brassOff, 1);
      bg.fillRoundedRect(cx - btnW / 2 + 7, cy - btnH / 2 + 7, btnW - 14, btnH - 14, 8);
      // Inner highlight shimmer
      bg.fillStyle(0xfff4b8, hover ? 0.45 : 0.25);
      bg.fillRoundedRect(cx - btnW / 2 + 11, cy - btnH / 2 + 11, btnW - 22, 14, 6);
      // Corner rivets
      const rivets = [
        [cx - btnW / 2 + 16, cy - btnH / 2 + 16],
        [cx + btnW / 2 - 16, cy - btnH / 2 + 16],
        [cx - btnW / 2 + 16, cy + btnH / 2 - 16],
        [cx + btnW / 2 - 16, cy + btnH / 2 - 16],
      ];
      for (const [rx, ry] of rivets) {
        bg.fillStyle(0x2a1008, 1);
        bg.fillCircle(rx, ry, 4);
        bg.fillStyle(0xc0b890, 0.85);
        bg.fillCircle(rx - 1, ry - 1, 1.8);
      }
    };

    draw(false);

    const textColor = isPrimary ? '#1a0a04' : '#e8e0c8';
    const text = this.add
      .text(cx, cy, label, {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '38px',
        fontStyle: '900',
        color: textColor,
        stroke: isPrimary ? '#5a3018' : '#1a0a04',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Pulse on primary button
    if (isPrimary) {
      this.tweens.add({
        targets: text,
        scale: 1.05,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    const zone = this.add
      .zone(cx, cy, btnW, btnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', () => draw(true));
    zone.on('pointerup', () => onClick());
  }
}
