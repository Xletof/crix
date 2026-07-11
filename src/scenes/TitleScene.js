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
    const portrait = this.add.sprite(cx, VIEW.height * 0.70, 'player', 0).setScale(3.2);
    portrait.play('mando-idle-front');
    // Subtle float tween
    this.tweens.add({
      targets: portrait,
      y: portrait.y - 12,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── RECORDS OVERLAY CONTAINER (pre-declared so buttons can check status)
    const recordsContainer = this.add.container(0, 0).setDepth(100).setVisible(false);

    // ── ENGAGE button — Imperial console style ────────────────────────────
    const btnY = VIEW.height * 0.82;
    const btnW = 380, btnH = 65;
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
      btnBg.fillRoundedRect(cx - btnW / 2 + 6, btnY - btnH / 2 + 6, btnW - 12, 10, 4);
      // Corner pips (Imperial 4-dot corners)
      const pips = [
        [cx - btnW / 2 + 12, btnY - btnH / 2 + 10],
        [cx + btnW / 2 - 12, btnY - btnH / 2 + 10],
        [cx - btnW / 2 + 12, btnY + btnH / 2 - 10],
        [cx + btnW / 2 - 12, btnY + btnH / 2 - 10],
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
        fontSize: '38px',
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
      if (recordsContainer.visible) return;
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

    // ── RECORDS button — Imperial console style ───────────────────────────
    const recY = VIEW.height * 0.91;
    const recW = 380, recH = 55;
    const recBg = this.add.graphics();

    const drawRec = (hover) => {
      recBg.clear();
      // Drop shadow
      recBg.fillStyle(0x000000, 0.6);
      recBg.fillRoundedRect(cx - recW / 2 + 4, recY - recH / 2 + 5, recW, recH, 6);
      // Imperial plate
      recBg.fillStyle(hover ? 0x2e3038 : 0x14161c, 1);
      recBg.fillRoundedRect(cx - recW / 2, recY - recH / 2, recW, recH, 6);
      // Neon cyan border
      recBg.lineStyle(2.5, hover ? 0x40b8ff : 0x0050cc, 1);
      recBg.strokeRoundedRect(cx - recW / 2, recY - recH / 2, recW, recH, 6);
    };

    drawRec(false);

    const recText = this.add
      .text(cx, recY, 'RECORDS', {
        fontFamily: 'Courier New, monospace',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#90d8ff',
        stroke: '#000000',
        strokeThickness: 3,
        letterSpacing: 4,
      })
      .setOrigin(0.5);

    const recZone = this.add
      .zone(cx, recY, recW, recH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    recZone.on('pointerover', () => drawRec(true));
    recZone.on('pointerout', () => drawRec(false));
    recZone.on('pointerdown', () => drawRec(true));
    recZone.on('pointerup', () => {
      if (recordsContainer.visible) return;
      SFX.uiClick();
      
      // Update text with fresh values before opening overlay
      const currentStats = loadStats();
      runsText.setText(`TOTAL MISSIONS:   ${currentStats.runs || 0}`);
      winsText.setText(`BOUNTIES CLAIMED: ${currentStats.wins || 0}`);
      timeText.setText(`BEST CLEAR TIME:  ${formatTime(currentStats.bestTime)}`);
      stealthText.setText(`BEST KILLS (RUN): ${currentStats.bestKills || 0}`);
      comboText.setText(`MAX COMBO MULT:   x${(currentStats.bestMaxCombo || 1.0).toFixed(1)}`);
      dmgText.setText(`LAST DAMAGE RECD: ${currentStats.lastDamageTaken || 0} HP`);
      totalKillsText.setText(`TOTAL KILLS:      ${currentStats.totalKills || 0}`);

      recordsContainer.setVisible(true);
    });

    // Full screen blocking backdrop
    const overlayBg = this.add.graphics();
    overlayBg.fillStyle(0x000000, 0.75);
    overlayBg.fillRect(0, 0, VIEW.width, VIEW.height);
    overlayBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, VIEW.width, VIEW.height), Phaser.Geom.Rectangle.Contains);
    recordsContainer.add(overlayBg);

    const cW = 500, cH = 620;
    const cX = cx - cW / 2, cY = VIEW.height * 0.22;

    const cardBg = this.add.graphics();
    // Glassmorphic look
    cardBg.fillStyle(0x0c101d, 0.94);
    cardBg.fillRoundedRect(cX, cY, cW, cH, 12);
    cardBg.lineStyle(3.5, 0x00a0ff, 0.55);
    cardBg.strokeRoundedRect(cX, cY, cW, cH, 12);
    recordsContainer.add(cardBg);

    const recHeader = this.add.text(cx, cY + 45, '[ BOUNTY LOG RECORDS ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '26px', fontStyle: 'bold',
      color: '#40a0ff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    recordsContainer.add(recHeader);

    const formatTime = (ms) => {
      if (!ms) return 'N/A';
      const sec = Math.floor(ms / 1000) % 60;
      const min = Math.floor(ms / 60000);
      return `${min}m ${sec}s`;
    };

    const textStyle = {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px', fontStyle: 'bold',
      color: '#8ab8ff', stroke: '#000000', strokeThickness: 2,
    };

    const startTextY = cY + 140;
    const spacingY = 55;

    const runsText = this.add.text(cX + 50, startTextY + 0 * spacingY, '', textStyle);
    const winsText = this.add.text(cX + 50, startTextY + 1 * spacingY, '', textStyle);
    const timeText = this.add.text(cX + 50, startTextY + 2 * spacingY, '', textStyle);
    const stealthText = this.add.text(cX + 50, startTextY + 3 * spacingY, '', textStyle);
    const comboText = this.add.text(cX + 50, startTextY + 4 * spacingY, '', textStyle);
    const dmgText = this.add.text(cX + 50, startTextY + 5 * spacingY, '', textStyle);
    const totalKillsText = this.add.text(cX + 50, startTextY + 6 * spacingY, '', textStyle);

    recordsContainer.add([runsText, winsText, timeText, stealthText, comboText, dmgText, totalKillsText]);

    // Close button
    const closeY = cY + cH - 70;
    const closeW = 280, closeH = 55;
    const closeBg = this.add.graphics();
    
    const drawClose = (hover) => {
      closeBg.clear();
      closeBg.fillStyle(0x000000, 0.6);
      closeBg.fillRoundedRect(cx - closeW / 2 + 4, closeY - closeH / 2 + 5, closeW, closeH, 6);
      closeBg.fillStyle(hover ? 0x2e3038 : 0x14161c, 1);
      closeBg.fillRoundedRect(cx - closeW / 2, closeY - closeH / 2, closeW, closeH, 6);
      closeBg.lineStyle(2.5, hover ? 0xff4040 : 0xcc0000, 1);
      closeBg.strokeRoundedRect(cx - closeW / 2, closeY - closeH / 2, closeW, closeH, 6);
    };
    drawClose(false);
    recordsContainer.add(closeBg);

    const closeText = this.add.text(cx, closeY, 'CLOSE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px', fontStyle: 'bold',
      color: '#ff8080', stroke: '#000000', strokeThickness: 3, letterSpacing: 4,
    }).setOrigin(0.5);
    recordsContainer.add(closeText);

    const closeZone = this.add.zone(cx, closeY, closeW, closeH).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeZone.on('pointerover', () => drawClose(true));
    closeZone.on('pointerout', () => drawClose(false));
    closeZone.on('pointerdown', () => drawClose(true));
    closeZone.on('pointerup', () => {
      SFX.uiClick();
      recordsContainer.setVisible(false);
    });
    recordsContainer.add(closeZone);

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
