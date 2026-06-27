import Phaser from 'phaser';
import { VIEW } from '../config.js';
import { SFX, stopMusic, setMuted, isMuted } from '../systems/FX.js';

// Overlay scene launched on top of a paused Game + HUD. Its own input is live
// (the scenes beneath are paused, so their joysticks never fire), which keeps
// pause/resume clean with no stuck sticks. Receives the GameScene instance so
// it can resume/restart/quit precisely.
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(data) {
    this.gs = data?.game || null;
    const cx = VIEW.width / 2;

    // Dim backdrop
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.66);
    g.fillRect(0, 0, VIEW.width, VIEW.height);
    // Subtle scan lines for the Imperial console feel
    for (let y = 0; y < VIEW.height; y += 6) {
      g.fillStyle(0x0040aa, 0.03);
      g.fillRect(0, y, VIEW.width, 2);
    }

    this.add.text(cx, VIEW.height * 0.24, 'PAUSED', {
      fontFamily: 'Courier New, monospace',
      fontSize: '72px', fontStyle: 'bold',
      color: '#90d8ff', stroke: '#000000', strokeThickness: 8, letterSpacing: 6,
    }).setOrigin(0.5);

    const baseY = VIEW.height * 0.40;
    const gap = 110;
    this._button(cx, baseY + gap * 0, 'RESUME', () => this._resume());
    this._button(cx, baseY + gap * 1, 'RESTART MISSION', () => this._restart());
    this._button(cx, baseY + gap * 2, 'QUIT TO TITLE', () => this._quit());
    this.muteBtn = this._button(cx, baseY + gap * 3, this._muteLabel(), () => this._toggleMute());

    // Hardware/keyboard: Esc or P resumes too.
    this.input.keyboard?.on('keydown-ESC', () => this._resume());
    this.input.keyboard?.on('keydown-P', () => this._resume());

    this.cameras.main.fadeIn(120, 0, 0, 0);
  }

  _muteLabel() { return isMuted() ? 'AUDIO: OFF' : 'AUDIO: ON'; }

  _resume() {
    if (this._closing) return;
    this._closing = true;
    SFX.uiClick();
    this.scene.resume('Game');
    this.scene.resume('HUD');
    this.scene.stop(); // stop self
  }

  _restart() {
    if (this._closing) return;
    this._closing = true;
    SFX.uiClick();
    stopMusic();
    // Explicitly tear down the paused HUD + Game, then reboot Game. Game's
    // create() relaunches a fresh HUD. scene.start also stops THIS (Pause)
    // scene (ScenePlugin.start stops the caller).
    this.scene.stop('HUD');
    this.scene.stop('Game');
    this.scene.start('Game');
  }

  _quit() {
    if (this._closing) return;
    this._closing = true;
    SFX.uiClick();
    stopMusic();
    this.scene.stop('Game');
    this.scene.stop('HUD');
    this.scene.start('Title'); // stops self (Pause) and runs Title
  }

  _toggleMute() {
    setMuted(!isMuted());
    SFX.uiClick();
    this.muteBtn?.label.setText(this._muteLabel());
  }

  // Imperial-console button; returns { bg, label, zone } for later mutation.
  _button(cx, cy, text, onClick) {
    const btnW = 420, btnH = 84;
    const bg = this.add.graphics();
    const draw = (hover) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.55);
      bg.fillRoundedRect(cx - btnW / 2 + 4, cy - btnH / 2 + 5, btnW, btnH, 6);
      bg.fillStyle(hover ? 0x2e3038 : 0x14161c, 1);
      bg.fillRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 6);
      bg.lineStyle(3, hover ? 0x40b8ff : 0x0050cc, 1);
      bg.strokeRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 6);
      bg.fillStyle(hover ? 0x40b8ff : 0x0050cc, 0.22);
      bg.fillRoundedRect(cx - btnW / 2 + 6, cy - btnH / 2 + 6, btnW - 12, 12, 4);
    };
    draw(false);

    const label = this.add.text(cx, cy, text, {
      fontFamily: 'Courier New, monospace',
      fontSize: '34px', fontStyle: 'bold',
      color: '#90d8ff', stroke: '#000000', strokeThickness: 4, letterSpacing: 3,
    }).setOrigin(0.5);

    const zone = this.add.zone(cx, cy, btnW, btnH).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', () => draw(true));
    zone.on('pointerup', onClick);

    return { bg, label, zone };
  }
}
