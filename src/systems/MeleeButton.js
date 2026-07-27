import Phaser from 'phaser';

// Melee "Broken Wings" button. A drag-aim widget: tap-release lunges along the
// auto-aim direction, press-and-drag points the cast anywhere and shows the
// telegraph while held. Plus a 0..1 charge gauge and combo pips showing how far
// through the 3-cast chain you are.
//
// The gesture rig below is a port of SuperButton's, with one deliberate
// difference: this one does NOT fire onAim at touch-down. The super's cone
// appears the instant you touch it; a melee tap has to fire with no telegraph
// at all, so the aim state arms only once the drag passes `tapMax` or the hold
// outlives PLAYER.meleeAimArmMs (that timer lives on Player, which is the only
// place that sees frames).
//
// NOTE: anything placed in the right-thumb zone must also be added to the fire
// joystick's `shouldClaim` exclusion list in HUD.js, or the stick will claim
// the same pointer and tapping this will also discharge the primary weapon.
export class MeleeButton {
  constructor(scene, opts) {
    this.scene = scene;
    this.x = opts.x;
    this.y = opts.y;
    this.radius = opts.radius || 46;
    this.dragRadius = opts.dragRadius || 78;
    this.deadzone = opts.deadzone ?? 0.18;
    // Peak-drag tap threshold — see SuperButton.js:17. Below it the release is
    // treated as a tap and reports force 0, immunising taps against the ~20-30px
    // of incidental finger roll that would otherwise read as a deliberate aim.
    this.tapMax = (opts.tapMax ?? 0.42) * this.dragRadius;
    this.onAim = opts.onAim || (() => {});
    this.onRelease = opts.onRelease || (() => {});
    this.isReady = opts.isReady || (() => true);

    this.image = scene.add.image(this.x, this.y, 'melee-btn-off').setDepth(40);
    this.gauge = scene.add.graphics().setDepth(41);

    // Ready halo — built once and driven by a looping tween, never redrawn per
    // frame (the HUD refresh that feeds this is event-driven).
    this.readyGlow = scene.add.graphics().setDepth(39);
    this.readyGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.readyGlow.fillStyle(0x90d8ff, 0.14);
    this.readyGlow.fillCircle(0, 0, this.radius + 18);
    this.readyGlow.lineStyle(3, 0x90d8ff, 0.5);
    this.readyGlow.strokeCircle(0, 0, this.radius + 5);
    this.readyGlow.setPosition(this.x, this.y).setVisible(false).setAlpha(0);
    this._glowTween = null;
    this._wasReady = false;

    // Drag knob — only visible once the gesture becomes a real aim-drag.
    this.knob = scene.add.image(this.x, this.y, 'joystick-knob')
      .setDepth(42).setAlpha(0).setScale(0.6);

    this.pointerId = null;
    this.vec = { x: 0, y: 0, force: 0, angle: 0 };
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
    this._downX = pointer.x;
    this._downY = pointer.y;
    this._peakDist = 0;
    this.image.setScale(1.12);
    this.updateVec(pointer.x, pointer.y);
    // Note: no onAim() here, unlike SuperButton. Firing it now would flash the
    // telegraph on every tap, which is exactly what this must not do.
    this.onAim(this._emitVec());
  }

  handleMove(pointer) {
    if (this.pointerId !== pointer.id) return;
    this.updateVec(pointer.x, pointer.y);
    // The knob only appears once the drag is unambiguous, so a tap shows no
    // aiming affordance at all.
    this.knob.setAlpha(this._peakDist >= this.tapMax ? 0.9 : 0);
    this.onAim(this._emitVec());
  }

  handleUp(pointer) {
    if (this.pointerId !== pointer.id) return;
    this.pointerId = null;
    const final = this._emitVec();
    this.vec.x = 0;
    this.vec.y = 0;
    this.vec.force = 0;
    this.knob.setPosition(this.x, this.y).setAlpha(0);
    this.image.setScale(1);
    this.onRelease(final);
  }

  // Reports force 0 until the finger has travelled a deliberate distance from
  // its touch-down point, so both the telegraph and the fire path take the
  // auto-aim branch for a tap.
  _emitVec() {
    if (this._peakDist < this.tapMax) {
      return { x: this.vec.x, y: this.vec.y, force: 0, angle: this.vec.angle };
    }
    return { ...this.vec };
  }

  updateVec(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy);
    const mdx = px - this._downX;
    const mdy = py - this._downY;
    this._peakDist = Math.max(this._peakDist, Math.hypot(mdx, mdy));
    const clamped = Math.min(dist, this.dragRadius);
    const nx = dist > 0 ? (dx / dist) * clamped : 0;
    const ny = dist > 0 ? (dy / dist) * clamped : 0;
    this.knob.setPosition(this.x + nx, this.y + ny);
    const raw = clamped / this.dragRadius;
    const force = raw < this.deadzone ? 0 : (raw - this.deadzone) / (1 - this.deadzone);
    this.vec.x = dist > 0 ? dx / dist : 0;
    this.vec.y = dist > 0 ? dy / dist : 0;
    this.vec.force = force;
    this.vec.angle = Math.atan2(dy, dx);
  }

  // Hard reset without casting (used on resume from pause).
  forceRelease() {
    this.pointerId = null;
    this.vec = { x: 0, y: 0, force: 0, angle: 0 };
    this._peakDist = 0;
    this.knob.setPosition(this.x, this.y).setAlpha(0);
    this.image.setScale(1);
  }

  setReady(ready) {
    this.image.setTexture(ready ? 'melee-btn' : 'melee-btn-off');
  }

  // charge 0..max; stage 0..2 = how many casts of the chain are already spent.
  drawGauge(charge, max, stage = 0) {
    const g = this.gauge;
    g.clear();
    const R = this.radius - 4;
    const TOP = -Math.PI / 2;
    const ready = charge >= max;
    const COL = 0x50b0e0, HOT = 0x90d8ff;

    if (!ready) {
      g.lineStyle(5, COL, 0.20);
      g.strokeCircle(this.x, this.y, R);
      const GAP = 0.10;
      const step = (Math.PI * 2) / max;
      for (let i = 0; i < Math.floor(charge); i++) {
        const a0 = TOP + i * step;
        g.lineStyle(5, COL, 0.95);
        g.beginPath();
        g.arc(this.x, this.y, R, a0 + GAP / 2, a0 + step - GAP / 2, false);
        g.strokePath();
      }
      const frac = charge - Math.floor(charge);
      if (frac > 0.01) {
        const a0 = TOP + Math.floor(charge) * step;
        g.lineStyle(5, COL, 0.7);
        g.beginPath();
        g.arc(this.x, this.y, R, a0 + GAP / 2, a0 + (step - GAP) * frac, false);
        g.strokePath();
      }
    } else {
      g.lineStyle(4, HOT, 1);
      g.strokeCircle(this.x, this.y, this.radius - 2);
    }

    // Combo pips — which cast of the 3-hit chain comes next. Placed ABOVE the
    // button: below would butt against the dash button's top edge (its circle
    // starts ~4px under where these would sit).
    if (stage > 0) {
      const pipY = this.y - this.radius - 12;
      for (let i = 0; i < 3; i++) {
        const px = this.x - 14 + i * 14;
        g.fillStyle(i < stage ? HOT : 0x2a3a48, i < stage ? 1 : 0.8);
        g.fillCircle(px, pipY, 4);
      }
    }

    if (ready && !this._wasReady) this.setReadyGlow(true);
    else if (!ready && this._wasReady) this.setReadyGlow(false);
    this._wasReady = ready;
  }

  setReadyGlow(on) {
    if (on) {
      if (this._glowTween) return;
      this.readyGlow.setVisible(true).setAlpha(0.3).setScale(1);
      this._glowTween = this.scene.tweens.add({
        targets: this.readyGlow,
        alpha: { from: 0.28, to: 0.75 },
        scale: { from: 0.97, to: 1.08 },
        duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else {
      this._glowTween?.remove();
      this._glowTween = null;
      this.readyGlow.setVisible(false).setAlpha(0);
    }
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
