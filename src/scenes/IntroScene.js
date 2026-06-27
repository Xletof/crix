import Phaser from 'phaser';
import { VIEW } from '../config.js';
import { SFX } from '../systems/FX.js';
import { NARRATIVE } from '../data/narrative.js';

// Mission-briefing scene shown between the title and gameplay. Types in the
// NARRATIVE.intro lines over a Death-Star backdrop, then continues to the Game.
// Fully skippable: first tap fast-forwards the text, the next tap (or the
// CONTINUE button) launches the mission.
export class IntroScene extends Phaser.Scene {
  constructor() {
    super('Intro');
  }

  create() {
    this.cameras.main.setBackgroundColor('#06060c');
    const cx = VIEW.width / 2;

    // ── Backdrop: starfield + Death Star (mirrors the title's vocabulary) ──
    const g = this.add.graphics();
    g.fillStyle(0x06060c, 1);
    g.fillRect(0, 0, VIEW.width, VIEW.height);
    const rng = new Phaser.Math.RandomDataGenerator(['sw-intro-seed']);
    for (let i = 0; i < 200; i++) {
      const sx = rng.between(0, VIEW.width);
      const sy = rng.between(0, VIEW.height);
      const bright = rng.frac();
      const size = bright > 0.92 ? 3 : bright > 0.75 ? 2 : 1;
      g.fillStyle(0xffffff, 0.4 + bright * 0.6);
      g.fillRect(sx, sy, size, size);
    }
    // Death Star, smaller and pushed to the top-right corner to leave a clear
    // central column for the briefing text.
    const dsx = cx + 230, dsy = VIEW.height * 0.13;
    g.fillStyle(0x181828, 0.6); g.fillCircle(dsx, dsy, 230);
    g.fillStyle(0x1a1a22, 1);   g.fillCircle(dsx, dsy, 210);
    g.lineStyle(1, 0x2a2a38, 0.5); g.strokeCircle(dsx, dsy, 210);
    g.fillStyle(0x282838, 1);   g.fillCircle(dsx - 60, dsy + 40, 44);
    g.fillStyle(0x0a0a1a, 1);   g.fillCircle(dsx - 60, dsy + 40, 33);
    g.fillStyle(0x0030aa, 0.2); g.fillCircle(dsx - 60, dsy + 40, 48);
    g.lineStyle(2, 0x2e2e3e, 0.7); g.strokeEllipse(dsx, dsy, 420, 36);

    // ── Mando portrait at the bottom, listening to the transmission ──
    const portrait = this.add.sprite(cx, VIEW.height * 0.86, 'player', 0).setScale(3.2);
    portrait.play('mando-idle');
    this.tweens.add({
      targets: portrait, y: portrait.y - 14,
      duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // ── Full-screen skip/advance zone (created FIRST so it sits beneath the
    // CONTINUE button; taps anywhere fast-forward or begin the mission) ──
    const skipZone = this.add.zone(cx, VIEW.height / 2, VIEW.width, VIEW.height)
      .setOrigin(0.5).setInteractive();
    skipZone.on('pointerdown', () => this._advance());
    this.input.keyboard?.on('keydown', () => this._advance());

    // ── Header ──
    this.add.text(cx, VIEW.height * 0.27, '[ MISSION BRIEFING ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px', fontStyle: 'bold',
      color: '#40b8ff', stroke: '#000000', strokeThickness: 4,
      letterSpacing: 3,
    }).setOrigin(0.5);

    // ── Typed briefing body ──
    this._fullText = NARRATIVE.intro.join('\n');
    this._charIndex = 0;
    this._done = false;
    this.bodyText = this.add.text(cx, VIEW.height * 0.32, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '23px', fontStyle: 'bold',
      color: '#cfe6ff', stroke: '#000000', strokeThickness: 3,
      align: 'center', lineSpacing: 9,
      wordWrap: { width: VIEW.width - 80 },
    }).setOrigin(0.5, 0);

    this._typeTimer = this.time.addEvent({
      delay: 26, loop: true,
      callback: () => {
        this._charIndex += 1;
        this.bodyText.setText(this._fullText.slice(0, this._charIndex));
        // Soft typing tick every couple chars (skip spaces/newlines).
        const ch = this._fullText[this._charIndex - 1];
        if (ch && ch !== ' ' && ch !== '\n' && this._charIndex % 2 === 0) SFX.hackTick?.();
        if (this._charIndex >= this._fullText.length) this._finishTyping();
      },
    });

    // ── CONTINUE button (Imperial console style), on TOP, input gated ──
    this._buildContinueButton(cx);

    // A subtle prompt at the very bottom.
    this.skipHint = this.add.text(cx, VIEW.height - 30, 'TAP TO SKIP', {
      fontFamily: 'Courier New, monospace',
      fontSize: '15px', color: '#4a5a80', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  _finishTyping() {
    this._typeTimer?.remove();
    this._typeTimer = null;
    this._done = true;
    this.bodyText.setText(this._fullText);
    // Reveal the continue button + enable its input now that the brief is shown.
    this._contBg?.setVisible(true);
    this._contTxt?.setVisible(true);
    this._contZone?.setVisible(true).setInteractive({ useHandCursor: true });
    this.skipHint?.setText('TAP TO BEGIN');
  }

  // First tap fast-forwards the typing; once fully shown, a tap begins the game.
  _advance() {
    if (!this._done) {
      this._finishTyping();
      SFX.uiClick();
      return;
    }
    this._startGame();
  }

  _startGame() {
    if (this._launching) return;
    this._launching = true;
    SFX.uiClick();
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
  }

  _buildContinueButton(cx) {
    const btnY = VIEW.height - 92;
    const btnW = 300, btnH = 70;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(cx - btnW / 2 + 4, btnY - btnH / 2 + 5, btnW, btnH, 6);
    bg.fillStyle(0x14161c, 1);
    bg.fillRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 6);
    bg.lineStyle(3, 0x0060ff, 1);
    bg.strokeRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 6);
    bg.fillStyle(0x0060ff, 0.22);
    bg.fillRoundedRect(cx - btnW / 2 + 6, btnY - btnH / 2 + 6, btnW - 12, 12, 4);
    bg.setVisible(false);

    const txt = this.add.text(cx, btnY, 'CONTINUE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '34px', fontStyle: 'bold',
      color: '#90d8ff', stroke: '#000000', strokeThickness: 4, letterSpacing: 4,
    }).setOrigin(0.5).setVisible(false);
    this.tweens.add({
      targets: txt, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Zone starts hidden + non-interactive so it never swallows skip taps
    // during typing; enabled in _finishTyping().
    const zone = this.add.zone(cx, btnY, btnW, btnH).setOrigin(0.5).setVisible(false);
    zone.on('pointerdown', () => this._startGame());

    this._contBg = bg;
    this._contTxt = txt;
    this._contZone = zone;
  }
}
