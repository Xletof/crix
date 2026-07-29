// Virtual joystick that lives on a HUD scene. Left = movement, right = aim/fire.
// Each joystick claims any pointer that touches its half of the screen, so
// thumbs can independently drag both at once.

import Phaser from 'phaser';
import { HUDCFG, VIEW } from '../config.js';

export class Joystick {
  constructor(scene, side, opts = {}) {
    this.scene = scene;
    this.side = side; // 'left' | 'right'
    this.baseRadius = opts.radius || HUDCFG.joystickRadius;
    this.baseKnobRadius = opts.knobRadius || HUDCFG.joystickKnobRadius;
    this.scale = opts.scale || 1;
    this.radius = this.baseRadius * this.scale;
    this.knobRadius = this.baseKnobRadius * this.scale;
    this.deadzone = opts.deadzone ?? 0.18;
    this.onMove = opts.onMove || (() => {});
    this.onEnd = opts.onEnd || (() => {});
    this.onStart = opts.onStart || (() => {});
    this.shouldClaim = opts.shouldClaim || (() => true);
    this.holdAutoFire = opts.holdAutoFire || false;

    // Resting spot. Defaults to the bottom-left / bottom-right corner; the
    // control-layout editor overrides it via opts.x / opts.y.
    const margin = HUDCFG.joystickMargin;
    const bottom = HUDCFG.joystickBottom;
    this.homeX = opts.x ?? (side === 'left'
      ? margin + this.radius
      : VIEW.width - margin - this.radius);
    this.homeY = opts.y ?? VIEW.height - bottom - this.radius;

    this.base = scene.add.image(this.homeX, this.homeY, 'joystick-base').setDepth(50).setAlpha(0.6);
    this.knob = scene.add.image(this.homeX, this.homeY, 'joystick-knob').setDepth(51).setAlpha(0.85);
    this.base.setScale(this.radius / 110);
    this.knob.setScale(this.knobRadius / 50);

    this.pointerId = null;
    this.vec = { x: 0, y: 0, force: 0, angle: 0 };
    this.active = false;

    this.bindInput();
  }

  bindInput() {
    const scene = this.scene;
    scene.input.on('pointerdown', this.handleDown, this);
    scene.input.on('pointermove', this.handleMove, this);
    scene.input.on('pointerup', this.handleUp, this);
    scene.input.on('pointerupoutside', this.handleUp, this);
  }

  shutdown() {
    const scene = this.scene;
    scene.input.off('pointerdown', this.handleDown, this);
    scene.input.off('pointermove', this.handleMove, this);
    scene.input.off('pointerup', this.handleUp, this);
    scene.input.off('pointerupoutside', this.handleUp, this);
    this.base.destroy();
    this.knob.destroy();
  }

  // The scene runs at logical VIEW resolution but pointers come in at actual screen pixels.
  // Phaser's pointer.x / pointer.y are already converted to scene coords for the camera.
  isOnMySide(x) {
    if (this.side === 'left') return x < VIEW.width / 2;
    return x >= VIEW.width / 2;
  }

  handleDown(pointer) {
    if (this.pointerId !== null) return;
    if (!this.isOnMySide(pointer.x)) return;
    if (!this.shouldClaim(pointer)) return;
    this.pointerId = pointer.id;
    this.active = true;
    this.base.setPosition(pointer.x, pointer.y);
    this.knob.setPosition(pointer.x, pointer.y);
    this.base.setAlpha(0.85);
    this.knob.setAlpha(1);
    this.onStart();
    this.updateVec(pointer.x, pointer.y);
    if (this.holdAutoFire) this.onMove(this.vec);
  }

  handleMove(pointer) {
    if (this.pointerId !== pointer.id || !this.active) return;
    this.updateVec(pointer.x, pointer.y);
    this.onMove(this.vec);
  }

  handleUp(pointer) {
    if (this.pointerId !== pointer.id) return;
    this.pointerId = null;
    this.active = false;
    const final = { ...this.vec };
    this.vec.x = 0;
    this.vec.y = 0;
    this.vec.force = 0;
    this.base.setPosition(this.homeX, this.homeY);
    this.knob.setPosition(this.homeX, this.homeY);
    this.base.setAlpha(0.6);
    this.knob.setAlpha(0.85);
    this.onEnd(final);
  }

  // Hard reset of stick state + visuals without firing callbacks. Used when
  // resuming from pause: a pointer held across the pause would otherwise never
  // get its pointerup (the scene was paused) and leave the stick stuck.
  forceRelease() {
    this.pointerId = null;
    this.active = false;
    this.vec.x = 0;
    this.vec.y = 0;
    this.vec.force = 0;
    this.base.setPosition(this.homeX, this.homeY);
    this.knob.setPosition(this.homeX, this.homeY);
    this.base.setAlpha(0.6);
    this.knob.setAlpha(0.85);
  }

  // Apply a layout from controlLayout.js. Scale changes the throw distance as
  // well as the drawn size, so it is applied to `radius` (the force
  // normaliser), not just to the sprites. Snaps the stick home: a live drag
  // measured against the old anchor would jump.
  setLayout({ x, y, scale }) {
    this.scale = scale ?? this.scale;
    this.homeX = x ?? this.homeX;
    this.homeY = y ?? this.homeY;
    this.radius = this.baseRadius * this.scale;
    this.knobRadius = this.baseKnobRadius * this.scale;
    this.base.setScale(this.radius / 110);
    this.knob.setScale(this.knobRadius / 50);
    this.forceRelease();
  }

  updateVec(px, py) {
    const dx = px - this.base.x;
    const dy = py - this.base.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const max = this.radius;
    const clamped = Math.min(dist, max);
    const nx = dist > 0 ? (dx / dist) * clamped : 0;
    const ny = dist > 0 ? (dy / dist) * clamped : 0;
    this.knob.setPosition(this.base.x + nx, this.base.y + ny);
    const rawForce = clamped / max;
    const force = rawForce < this.deadzone ? 0 : (rawForce - this.deadzone) / (1 - this.deadzone);
    this.vec.x = dist > 0 ? dx / dist : 0;
    this.vec.y = dist > 0 ? dy / dist : 0;
    this.vec.force = force;
    this.vec.angle = Math.atan2(dy, dx);
  }
}
