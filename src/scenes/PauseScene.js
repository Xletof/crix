import Phaser from 'phaser';
import { VIEW } from '../config.js';
import {
  SFX,
  stopMusic,
  setMuted,
  isMuted,
  setSFXVolume,
  setMusicVolume,
  getSFXVolume,
  getMusicVolume,
  setLowQuality,
  isLowQuality,
} from '../systems/FX.js';

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

    // Glassmorphism settings panel card
    const cardW = 540, cardH = 880;
    const cardX = cx - cardW / 2, cardY = VIEW.height * 0.06;
    g.fillStyle(0x0c101d, 0.88); // dark translucent glass background
    g.fillRoundedRect(cardX, cardY, cardW, cardH, 16);
    g.lineStyle(3.5, 0x00a0ff, 0.45); // glowing cyan neon border
    g.strokeRoundedRect(cardX, cardY, cardW, cardH, 16);

    // Title
    this.add.text(cx, cardY + 65, 'PAUSED', {
      fontFamily: 'Courier New, monospace',
      fontSize: '60px', fontStyle: 'bold',
      color: '#90d8ff', stroke: '#000000', strokeThickness: 8, letterSpacing: 6,
    }).setOrigin(0.5);

    // Audio Sliders
    this._slider(cx, cardY + 185, 'MUSIC VOLUME', getMusicVolume, setMusicVolume);
    this._slider(cx, cardY + 285, 'SFX VOLUME', getSFXVolume, setSFXVolume);

    // Action Buttons
    const baseY = cardY + 410;
    const gap = 92;
    this._button(cx, baseY + gap * 0, 'RESUME', () => this._resume());
    this._button(cx, baseY + gap * 1, 'RESTART MISSION', () => this._restart());
    this._button(cx, baseY + gap * 2, 'QUIT TO TITLE', () => this._quit());
    
    this.qualityBtn = this._button(cx, baseY + gap * 3, this._qualityLabel(), () => this._toggleQuality());
    this.muteBtn = this._button(cx, baseY + gap * 4, this._muteLabel(), () => this._toggleMute());

    // Hardware/keyboard: Esc or P resumes too.
    this.input.keyboard?.on('keydown-ESC', () => this._resume());
    this.input.keyboard?.on('keydown-P', () => this._resume());

    this.cameras.main.fadeIn(120, 0, 0, 0);
  }

  _qualityLabel() { return isLowQuality() ? 'GRAPHICS: LOW' : 'GRAPHICS: HIGH'; }
  _muteLabel() { return isMuted() ? 'AUDIO: MUTED' : 'AUDIO: ACTIVE'; }

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

  _toggleQuality() {
    setLowQuality(!isLowQuality());
    SFX.uiClick();
    this.qualityBtn?.label.setText(this._qualityLabel());
  }

  _toggleMute() {
    setMuted(!isMuted());
    SFX.uiClick();
    this.muteBtn?.label.setText(this._muteLabel());
  }

  // Interactive volume slider component
  _slider(cx, cy, labelText, getVal, setVal) {
    const trackW = 360, trackH = 12;
    const handleR = 14;

    // Label text
    const label = this.add.text(cx - trackW / 2, cy - 26, labelText, {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px', fontStyle: 'bold',
      color: '#90d8ff', stroke: '#000000', strokeThickness: 3, letterSpacing: 2,
    });

    const g = this.add.graphics();

    const draw = (val, active) => {
      g.clear();
      // Track bg shadow
      g.fillStyle(0x000000, 0.55);
      g.fillRoundedRect(cx - trackW / 2 + 3, cy - trackH / 2 + 3, trackW, trackH, 4);
      // Track fill
      g.fillStyle(active ? 0x2e3038 : 0x14161c, 1);
      g.fillRoundedRect(cx - trackW / 2, cy - trackH / 2, trackW, trackH, 4);
      g.lineStyle(2.5, active ? 0x40b8ff : 0x0050cc, 1);
      g.strokeRoundedRect(cx - trackW / 2, cy - trackH / 2, trackW, trackH, 4);

      // Active progress fill (from left to handle position)
      const hx = cx - trackW / 2 + val * trackW;
      g.fillStyle(active ? 0x40b8ff : 0x0050cc, 0.75);
      g.fillRoundedRect(cx - trackW / 2 + 2, cy - trackH / 2 + 2, Math.max(4, val * trackW - 4), trackH - 4, 2);

      // Handle knob shadow
      g.fillStyle(0x000000, 0.45);
      g.fillCircle(hx + 2, cy + 3, handleR);
      // Handle knob fill
      g.fillStyle(active ? 0x90d8ff : 0x0080ff, 1);
      g.fillCircle(hx, cy, handleR);
      g.lineStyle(2.5, active ? '#ffffff' : '#c0f0ff', 1);
      g.strokeCircle(hx, cy, handleR);
    };

    let curVal = getVal();
    draw(curVal, false);

    // Draggable zone overlay
    const zone = this.add.zone(cx, cy, trackW + handleR * 2, 48)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const updateVal = (pointer) => {
      const localX = Phaser.Math.Clamp(pointer.x - (cx - trackW / 2), 0, trackW);
      curVal = localX / trackW;
      setVal(curVal);
      draw(curVal, true);
    };

    let dragging = false;
    zone.on('pointerdown', (pointer) => {
      dragging = true;
      updateVal(pointer);
      SFX.uiClick();
    });
    this.input.on('pointermove', (pointer) => {
      if (dragging) {
        updateVal(pointer);
      }
    });
    this.input.on('pointerup', () => {
      if (dragging) {
        dragging = false;
        draw(curVal, false);
      }
    });

    return { g, label, zone };
  }

  // Imperial-console button; returns { bg, label, zone } for later mutation.
  _button(cx, cy, text, onClick) {
    const btnW = 420, btnH = 68;
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
      bg.fillRoundedRect(cx - btnW / 2 + 6, cy - btnH / 2 + 6, btnW - 12, 10, 4);
    };
    draw(false);

    const label = this.add.text(cx, cy, text, {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px', fontStyle: 'bold',
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
