import Phaser from 'phaser';
import { FONTS } from '../config.js';
import { SFX } from '../systems/FX.js';

// A hackable objective terminal. The actual slicing happens through a HUD
// timing mini-game (HackMinigame) — this class just tracks state and visual
// feedback for the terminal sprite itself.
//
// Emits on the scene:
//   'terminal-hacked'   (terminal)   — when the mini-game completes
const HACK_RADIUS = 70;   // px — how close the player must be to start a hack

export class Terminal {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.hacked = false;
    this.isHacking = false;
    this.hologramTime = 0;

    this.sprite = scene.add.image(x, y, 'terminal').setDepth(19).setScale(1.1);
    scene.roomLayer.add(this.sprite);

    this.gfx = scene.add.graphics().setDepth(20);
    this.label = scene.add.text(x, y - 34, 'SLICE', {
      fontFamily: FONTS.body,
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffaa30',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(21);

    this._pulse = Math.random() * Math.PI * 2;

    // Slicing event listeners
    this._onHackStart = (t) => { if (t === this) this.isHacking = true; };
    this._onHackSuccess = (t) => { if (t === this) this.isHacking = false; };
    this._onHackCancel = () => { this.isHacking = false; };
    this._onHackFail = () => { this.isHacking = false; };

    scene.events.on('hack-start', this._onHackStart);
    scene.events.on('hack-success', this._onHackSuccess);
    scene.events.on('hack-cancel', this._onHackCancel);
    scene.events.on('hack-fail', this._onHackFail);
  }

  // Returns true if the player is currently in range to hack.
  inRange(player) {
    return Phaser.Math.Distance.Between(player.x, player.y, this.x, this.y) <= HACK_RADIUS;
  }

  // Update visuals only — the mini-game owns the progress logic.
  update(delta, player) {
    this._pulse += delta * 0.006;
    if (this.hacked) { this._drawHacked(); return; }

    if (this.isHacking) {
      this.hologramTime += delta;
    } else {
      this.hologramTime = 0;
    }

    const inRange = !!player?.alive && this.inRange(player);
    this._draw(inRange, player);
  }

  // Called by GameScene when the mini-game finishes successfully.
  complete() {
    if (this.hacked) return;
    this.hacked = true;
    this.isHacking = false;
    this.sprite.setTint(0x40ff80);
    this.label.setText('SLICED').setColor('#40ff80');
    SFX.hackComplete();
    this.scene.events.emit('terminal-hacked', this);
  }

  _draw(inRange, player) {
    const g = this.gfx;
    g.clear();
    const r = 30;
    
    // Draw expanding holographic waves when actively being hacked
    if (this.isHacking) {
      const maxR = 92;
      
      // Ring 1 (fast expansion)
      const t1 = (this.hologramTime * 0.0016) % 1.0;
      const r1 = t1 * maxR;
      const alpha1 = (1.0 - t1) * 0.7;
      g.lineStyle(2.5, 0x00d0ff, alpha1);
      g.strokeCircle(this.x, this.y, r1);
      
      // Ring 2 (slow expansion offset)
      const t2 = ((this.hologramTime + 300) * 0.0012) % 1.0;
      const r2 = t2 * maxR;
      const alpha2 = (1.0 - t2) * 0.45;
      g.lineStyle(1.5, 0x0080ff, alpha2);
      g.strokeCircle(this.x, this.y, r2);

      // Rotating holographic radar sweep arc
      const sweepAngle = (this.hologramTime * 0.0028) % (Math.PI * 2);
      g.lineStyle(3, 0x00a0ff, 0.35);
      g.beginPath();
      g.arc(this.x, this.y, 42, sweepAngle - 0.4, sweepAngle + 0.4, false);
      g.strokePath();
      
      // Draw light cyan connection beam to the player
      if (player && player.alive) {
        g.lineStyle(1, 0x00ffff, 0.25 + 0.1 * Math.sin(this._pulse));
        g.beginPath();
        g.moveTo(this.x, this.y);
        g.lineTo(player.x, player.y);
        g.strokePath();
      }
    }

    g.lineStyle(4, 0x000000, 0.5);
    g.strokeCircle(this.x, this.y, r);
    // "Ready to hack" prompt ring pulses brighter when player is on it
    const pulse = 0.4 + 0.4 * Math.sin(this._pulse);
    const color = inRange ? 0xffd040 : 0xffaa30;
    g.lineStyle(inRange ? 3 : 2, color, inRange ? 0.6 + pulse * 0.4 : pulse);
    g.strokeCircle(this.x, this.y, r + 6);
    this.label.setAlpha(0.6 + pulse * 0.4);
  }

  _drawHacked() {
    const g = this.gfx;
    g.clear();
    g.lineStyle(3, 0x40ff80, 0.85);
    g.strokeCircle(this.x, this.y, 30);
    const pulse = 0.3 + 0.3 * Math.sin(this._pulse);
    g.lineStyle(2, 0x80ffaa, pulse);
    g.strokeCircle(this.x, this.y, 36);
  }

  destroy() {
    this.scene.events.off('hack-start', this._onHackStart);
    this.scene.events.off('hack-success', this._onHackSuccess);
    this.scene.events.off('hack-cancel', this._onHackCancel);
    this.scene.events.off('hack-fail', this._onHackFail);
    this.sprite?.destroy();
    this.gfx?.destroy();
    this.label?.destroy();
  }
}
