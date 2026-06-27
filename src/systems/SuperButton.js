// Drag-aim widget for the super attack. Behaves like a small radial
// joystick anchored to a fixed button position: tap-release fires the
// super forward, press-and-drag aims it in any direction and shows the
// super cone on the player while held.

import Phaser from 'phaser';
import { PLAYER, COLORS } from '../config.js';

export class SuperButton {
  constructor(scene, opts) {
    this.scene = scene;
    this.x = opts.x;
    this.y = opts.y;
    this.radius = opts.radius || 60;
    this.dragRadius = opts.dragRadius || 90;
    this.deadzone = opts.deadzone ?? 0.18;
    this.onAim = opts.onAim || (() => {});
    this.onRelease = opts.onRelease || (() => {});
    this.isReady = opts.isReady || (() => true);

    this.image = scene.add.image(this.x, this.y, 'super-btn-off').setDepth(40);
    this.gauge = scene.add.graphics().setDepth(41);
    // Optional drag knob — only visible while dragging.
    this.knob = scene.add.image(this.x, this.y, 'joystick-knob').setDepth(42).setAlpha(0).setScale(0.7);

    this.pointerId = null;
    this.vec = { x: 0, y: 0, force: 0, angle: 0 };

    scene.input.on('pointerdown', this.handleDown, this);
    scene.input.on('pointermove', this.handleMove, this);
    scene.input.on('pointerup', this.handleUp, this);
    scene.input.on('pointerupoutside', this.handleUp, this);
  }

  containsPoint(x, y) {
    return Math.hypot(x - this.x, y - this.y) <= this.radius;
  }

  handleDown(pointer) {
    if (this.pointerId !== null) return;
    if (!this.containsPoint(pointer.x, pointer.y)) return;
    if (!this.isReady()) return;
    this.pointerId = pointer.id;
    this.knob.setAlpha(0.9);
    this.image.setScale(1.08);
    this.updateVec(pointer.x, pointer.y);
    this.onAim(this.vec); // initial fire of aim event (cone appears immediately)
  }

  handleMove(pointer) {
    if (this.pointerId !== pointer.id) return;
    this.updateVec(pointer.x, pointer.y);
    this.onAim(this.vec);
  }

  handleUp(pointer) {
    if (this.pointerId !== pointer.id) return;
    this.pointerId = null;
    const final = { ...this.vec };
    this.vec.x = 0;
    this.vec.y = 0;
    this.vec.force = 0;
    this.knob.setPosition(this.x, this.y);
    this.knob.setAlpha(0);
    this.image.setScale(1);
    this.onRelease(final);
  }

  updateVec(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const max = this.dragRadius;
    const clamped = Math.min(dist, max);
    const nx = dist > 0 ? (dx / dist) * clamped : 0;
    const ny = dist > 0 ? (dy / dist) * clamped : 0;
    this.knob.setPosition(this.x + nx, this.y + ny);
    const raw = clamped / max;
    const force = raw < this.deadzone ? 0 : (raw - this.deadzone) / (1 - this.deadzone);
    this.vec.x = dist > 0 ? dx / dist : 0;
    this.vec.y = dist > 0 ? dy / dist : 0;
    this.vec.force = force;
    this.vec.angle = Math.atan2(dy, dx);
  }

  // Hard reset without firing the super (used on resume from pause).
  forceRelease() {
    this.pointerId = null;
    this.vec = { x: 0, y: 0, force: 0, angle: 0 };
    this.knob.setPosition(this.x, this.y);
    this.knob.setAlpha(0);
    this.image.setScale(1);
  }

  // External setter so HUD can refresh the button texture when super ready/not-ready.
  setReady(ready) {
    this.image.setTexture(ready ? 'super-btn' : 'super-btn-off');
  }

  drawGauge(charge, max) {
    this.gauge.clear();
    const ready = charge >= max;
    if (!ready) {
      const r = charge / max;
      this.gauge.lineStyle(6, COLORS.superGauge, 0.95);
      this.gauge.beginPath();
      this.gauge.arc(this.x, this.y, this.radius - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * r, false);
      this.gauge.strokePath();
    } else {
      this.gauge.lineStyle(5, COLORS.superReady, 1);
      this.gauge.strokeCircle(this.x, this.y, this.radius - 2);
    }
  }

  shutdown() {
    const scene = this.scene;
    scene.input.off('pointerdown', this.handleDown, this);
    scene.input.off('pointermove', this.handleMove, this);
    scene.input.off('pointerup', this.handleUp, this);
    scene.input.off('pointerupoutside', this.handleUp, this);
    this.image.destroy();
    this.gauge.destroy();
    this.knob.destroy();
  }
}
