import Phaser from 'phaser';
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

    this.sprite = scene.add.image(x, y, 'terminal').setDepth(19).setScale(1.1);
    scene.roomLayer.add(this.sprite);

    this.gfx = scene.add.graphics().setDepth(20);
    this.label = scene.add.text(x, y - 34, 'HACK', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffaa30',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(21);

    this._pulse = Math.random() * Math.PI * 2;
  }

  // Returns true if the player is currently in range to hack.
  inRange(player) {
    return Phaser.Math.Distance.Between(player.x, player.y, this.x, this.y) <= HACK_RADIUS;
  }

  // Update visuals only — the mini-game owns the progress logic.
  update(delta, player) {
    this._pulse += delta * 0.006;
    if (this.hacked) { this._drawHacked(); return; }
    const inRange = !!player?.alive && this.inRange(player);
    this._draw(inRange);
  }

  // Called by GameScene when the mini-game finishes successfully.
  complete() {
    if (this.hacked) return;
    this.hacked = true;
    this.sprite.setTint(0x40ff80);
    this.label.setText('SLICED').setColor('#40ff80');
    SFX.hackComplete();
    this.scene.events.emit('terminal-hacked', this);
  }

  _draw(inRange) {
    const g = this.gfx;
    g.clear();
    const r = 30;
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
    this.sprite?.destroy();
    this.gfx?.destroy();
    this.label?.destroy();
  }
}
