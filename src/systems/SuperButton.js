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
    // Peak-drag tap threshold: the finger must travel at least this far from
    // its touch-down point *at some point during the hold* for the gesture to
    // count as a deliberate aim-drag. Below it, we treat the release as a tap
    // and auto-aim the nearest enemy — this immunises taps against the ~20–30px
    // of incidental finger roll that used to read as a manual drag and fire the
    // super in a random direction.
    this.tapMax = (opts.tapMax ?? 0.42) * this.dragRadius;
    this.onAim = opts.onAim || (() => {});
    this.onRelease = opts.onRelease || (() => {});
    this.isReady = opts.isReady || (() => true);

    this.image = scene.add.image(this.x, this.y, 'super-btn-off').setDepth(40);
    this.gauge = scene.add.graphics().setDepth(41);
    // Optional drag knob — only visible while dragging.
    this.knob = scene.add.image(this.x, this.y, 'joystick-knob').setDepth(42).setAlpha(0).setScale(0.7);

    this.pointerId = null;
    this.vec = { x: 0, y: 0, force: 0, angle: 0 };
    // Gesture tracking for the tap/drag classifier.
    this._downX = 0;
    this._downY = 0;
    this._peakDist = 0;

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
    // Anchor the gesture at the touch-down point and reset drag travel.
    this._downX = pointer.x;
    this._downY = pointer.y;
    this._peakDist = 0;
    this.knob.setAlpha(0.9);
    this.image.setScale(1.08);
    this.updateVec(pointer.x, pointer.y);
    this.onAim(this._emitVec()); // initial fire of aim event (cone appears immediately)
  }

  handleMove(pointer) {
    if (this.pointerId !== pointer.id) return;
    this.updateVec(pointer.x, pointer.y);
    this.onAim(this._emitVec());
  }

  handleUp(pointer) {
    if (this.pointerId !== pointer.id) return;
    this.pointerId = null;
    const final = this._emitVec();
    this.vec.x = 0;
    this.vec.y = 0;
    this.vec.force = 0;
    this.knob.setPosition(this.x, this.y);
    this.knob.setAlpha(0);
    this.image.setScale(1);
    this.onRelease(final);
  }

  // The vec handed to the aim/release callbacks. Until the finger has moved a
  // deliberate distance from the touch-down point (peak drag ≥ tapMax), force
  // is reported as 0 so both the preview cone and the fire path take the
  // auto-aim branch — a tap can't be misread as a manual drag. Once it's a real
  // drag, the true force and center-relative direction pass through unchanged.
  _emitVec() {
    if (this._peakDist < this.tapMax) {
      return { x: this.vec.x, y: this.vec.y, force: 0, angle: this.vec.angle };
    }
    return { ...this.vec };
  }

  updateVec(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Track how far the finger has drifted from where it landed (peak over the
    // whole hold) — this drives the tap/drag classification, independent of the
    // center-relative aim direction below.
    const mdx = px - this._downX;
    const mdy = py - this._downY;
    this._peakDist = Math.max(this._peakDist, Math.sqrt(mdx * mdx + mdy * mdy));
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
