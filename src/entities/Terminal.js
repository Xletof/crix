import Phaser from 'phaser';
import { SFX } from '../systems/FX.js';

// A hackable objective terminal. The player hacks it by standing within
// HACK_RADIUS; progress fills over HACK_MS of cumulative contact. Standing
// still to hack exposes the player to fire — that's the intended risk.
//
// Emits on the scene:
//   'terminal-hacked'   (terminal)   — when a terminal completes
//   'terminal-progress' (done,total,activeRatio) — for the HUD bar
const HACK_RADIUS = 70;   // px — how close the player must be
const HACK_MS     = 2500; // ms of cumulative contact to fully slice
const DECAY_MS    = 5000; // ms to bleed a partial hack back down when away

export class Terminal {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.progress = 0;     // 0..1
    this.hacked = false;
    this._tickAcc = 0;

    this.sprite = scene.add.image(x, y, 'terminal').setDepth(19).setScale(1.1);
    scene.roomLayer.add(this.sprite);

    // Progress ring + label
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

  update(delta, player) {
    this._pulse += delta * 0.006;
    if (this.hacked) { this._drawHacked(); return false; }

    const active = player?.alive && this.inRange(player);
    let justCompleted = false;

    if (active) {
      this.progress = Math.min(1, this.progress + delta / HACK_MS);
      // Soft data blip a few times per second while hacking
      this._tickAcc += delta;
      if (this._tickAcc >= 320) { this._tickAcc = 0; SFX.hackTick(); }
      if (this.progress >= 1) {
        this.hacked = true;
        justCompleted = true;
        this.sprite.setTint(0x40ff80);     // turns green when sliced
        this.label.setText('SLICED').setColor('#40ff80');
        SFX.hackComplete();
        this.scene.events.emit('terminal-hacked', this);
      }
    } else if (this.progress > 0) {
      this.progress = Math.max(0, this.progress - delta / DECAY_MS);
    }

    this._draw(active);
    return justCompleted;
  }

  _draw(active) {
    const g = this.gfx;
    g.clear();
    const r = 30;
    // Backing ring
    g.lineStyle(4, 0x000000, 0.5);
    g.strokeCircle(this.x, this.y, r);
    // Progress arc
    if (this.progress > 0) {
      const col = active ? 0xffd040 : 0xff8020;
      g.lineStyle(4, col, 0.95);
      g.beginPath();
      g.arc(this.x, this.y, r, -Math.PI / 2, -Math.PI / 2 + this.progress * Math.PI * 2);
      g.strokePath();
    }
    // Idle prompt ring pulse when the player isn't on it yet
    if (!active && this.progress === 0) {
      const pulse = 0.4 + 0.4 * Math.sin(this._pulse);
      g.lineStyle(2, 0xffaa30, pulse);
      g.strokeCircle(this.x, this.y, r + 6);
    }
    this.label.setAlpha(active || this.progress === 0 ? 1 : 0.6);
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
