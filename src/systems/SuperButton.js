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
    this.scale = opts.scale || 1;
    this.baseRadius = opts.radius || 60;
    this.baseDragRadius = opts.dragRadius || 90;
    this.radius = this.baseRadius * this.scale;
    this.dragRadius = this.baseDragRadius * this.scale;
    this.deadzone = opts.deadzone ?? 0.18;
    // Peak-drag tap threshold: the finger must travel at least this far from
    // its touch-down point *at some point during the hold* for the gesture to
    // count as a deliberate aim-drag. Below it, we treat the release as a tap
    // and auto-aim the nearest enemy — this immunises taps against the ~20–30px
    // of incidental finger roll that used to read as a manual drag and fire the
    // super in a random direction.
    this.tapFrac = opts.tapMax ?? 0.42;
    this.tapMax = this.tapFrac * this.dragRadius;
    this.onAim = opts.onAim || (() => {});
    this.onRelease = opts.onRelease || (() => {});
    this.isReady = opts.isReady || (() => true);

    // Ready-glow sits UNDER the button so it reads as a halo bleeding out from
    // behind it. Created once and driven by a looping tween rather than
    // redrawn per frame — HUD.refreshSuper() is event-driven (it only fires on
    // player-super-changed / -ready), so a redraw-based pulse would never
    // animate, and per-frame redrawing would churn graphics every tick.
    this.readyGlow = scene.add.graphics().setDepth(39);
    this.readyGlow.setBlendMode(Phaser.BlendModes.ADD);
    this._drawGlow();
    this.readyGlow.setPosition(this.x, this.y).setVisible(false).setAlpha(0);
    this._glowTween = null;
    this._wasReady = false;

    this.image = scene.add.image(this.x, this.y, 'super-btn-off').setDepth(40).setScale(this.scale);
    this.gauge = scene.add.graphics().setDepth(41);
    // Optional drag knob — only visible while dragging.
    this.knob = scene.add.image(this.x, this.y, 'joystick-knob').setDepth(42).setAlpha(0)
      .setScale(0.7 * this.scale);

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

  // The halo geometry is baked at the current radius, so it has to be repainted
  // whenever the button is resized. Drawn around the origin and positioned, so
  // the pulse tween can scale it without fighting the layout.
  _drawGlow() {
    const g = this.readyGlow;
    g.clear();
    g.fillStyle(COLORS.superReady, 0.16);
    g.fillCircle(0, 0, this.radius + 22);
    g.fillStyle(COLORS.superReady, 0.22);
    g.fillCircle(0, 0, this.radius + 11);
    g.lineStyle(3, COLORS.superReady, 0.55);
    g.strokeCircle(0, 0, this.radius + 6);
  }

  // Apply a layout from controlLayout.js. Scale drives the hit radius, the drag
  // throw and the tap/drag threshold together, so a resized button keeps the
  // same gesture proportions.
  setLayout({ x, y, scale }) {
    this.x = x ?? this.x;
    this.y = y ?? this.y;
    this.scale = scale ?? this.scale;
    this.radius = this.baseRadius * this.scale;
    this.dragRadius = this.baseDragRadius * this.scale;
    this.tapMax = this.tapFrac * this.dragRadius;
    this.image.setPosition(this.x, this.y).setScale(this.scale);
    this.knob.setPosition(this.x, this.y).setScale(0.7 * this.scale);
    this.readyGlow.setPosition(this.x, this.y);
    this._drawGlow();
    this.gauge.clear();   // repainted by HUD.refreshSuper()
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
    this.image.setScale(this.scale * 1.08);
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
    this.image.setScale(this.scale);
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
    this.image.setScale(this.scale);
  }

  // External setter so HUD can refresh the button texture when super ready/not-ready.
  setReady(ready) {
    this.image.setTexture(ready ? 'super-btn' : 'super-btn-off');
  }

  drawGauge(charge, max) {
    const g = this.gauge;
    g.clear();
    const ready = charge >= max;
    const R = this.radius - 4;
    const TOP = -Math.PI / 2;

    if (!ready) {
      const r = Phaser.Math.Clamp(charge / max, 0, 1);
      // Dim track so the remaining charge is legible, not just absent.
      g.lineStyle(6, COLORS.superGauge, 0.20);
      g.strokeCircle(this.x, this.y, R);
      // Segmented fill — one arc per charge step with a small gap, so the
      // player can count progress toward the super at a glance.
      const GAP = 0.10;
      const step = (Math.PI * 2) / max;
      for (let i = 0; i < Math.floor(charge); i++) {
        const a0 = TOP + i * step;
        g.lineStyle(6, COLORS.superGauge, 0.95);
        g.beginPath();
        g.arc(this.x, this.y, R, a0 + GAP / 2, a0 + step - GAP / 2, false);
        g.strokePath();
      }
      // Partial segment for the in-progress step.
      const frac = charge - Math.floor(charge);
      if (frac > 0.01) {
        const a0 = TOP + Math.floor(charge) * step;
        g.lineStyle(6, COLORS.superGauge, 0.75);
        g.beginPath();
        g.arc(this.x, this.y, R, a0 + GAP / 2, a0 + (step - GAP) * frac, false);
        g.strokePath();
      }
      // Bright leading edge marking where the fill has reached.
      if (r > 0) {
        const lead = TOP + Math.PI * 2 * r;
        g.fillStyle(0xffd0c0, 0.95);
        g.fillCircle(this.x + Math.cos(lead) * R, this.y + Math.sin(lead) * R, 3.5);
      }
    } else {
      // Fully charged: solid hot ring plus an inner accent.
      g.lineStyle(5, COLORS.superReady, 1);
      g.strokeCircle(this.x, this.y, this.radius - 2);
      g.lineStyle(2, 0xffe0d0, 0.8);
      g.strokeCircle(this.x, this.y, this.radius - 8);
    }

    // Ready-edge transitions drive the glow + one-shot snap.
    if (ready && !this._wasReady) this._onBecameReady();
    else if (!ready && this._wasReady) this.setReadyGlow(false);
    this._wasReady = ready;
  }

  // Start/stop the faint pulsing red halo. Idempotent and leak-free: it reuses
  // the single readyGlow graphics and one tween.
  setReadyGlow(on) {
    if (on) {
      if (this._glowTween) return;               // already pulsing
      this.readyGlow.setVisible(true).setAlpha(0.35).setScale(1);
      this._glowTween = this.scene.tweens.add({
        targets: this.readyGlow,
        alpha: { from: 0.30, to: 0.85 },
        scale: { from: 0.97, to: 1.09 },
        duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else {
      this._glowTween?.remove();
      this._glowTween = null;
      this.readyGlow.setVisible(false).setAlpha(0);
    }
  }

  // One-shot "charged!" snap on the ready edge — a bright ring that expands and
  // vanishes, then the persistent pulse takes over.
  _onBecameReady() {
    this.setReadyGlow(true);
    const snap = this.scene.add.graphics().setDepth(43);
    snap.setBlendMode(Phaser.BlendModes.ADD);
    snap.lineStyle(4, 0xffffff, 0.95);
    snap.strokeCircle(0, 0, this.radius);
    snap.setPosition(this.x, this.y);
    this.scene.tweens.add({
      targets: snap, scale: 1.8, alpha: 0,
      duration: 260, ease: 'Cubic.easeOut',
      onComplete: () => snap.destroy(),
    });
    this.scene.tweens.killTweensOf(this.image);
    this.image.setScale(this.scale * 1.3);
    this.scene.tweens.add({
      targets: this.image, scale: this.scale, duration: 260, ease: 'Back.easeOut',
    });
  }

  shutdown() {
    const scene = this.scene;
    scene.input.off('pointerdown', this.handleDown, this);
    scene.input.off('pointermove', this.handleMove, this);
    scene.input.off('pointerup', this.handleUp, this);
    scene.input.off('pointerupoutside', this.handleUp, this);
    this._glowTween?.remove();
    this._glowTween = null;
    this.image.destroy();
    this.gauge.destroy();
    this.readyGlow.destroy();
    this.knob.destroy();
  }
}
