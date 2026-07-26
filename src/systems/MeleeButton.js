import Phaser from 'phaser';

// Melee "Broken Wings" button. A plain tap widget (no drag-aim — the combo
// lunges along the auto-aim direction), plus a 0..1 charge gauge and combo
// pips showing how far through the 3-cast chain you are.
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
    this.onPress = opts.onPress || (() => {});
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

    this.pointerId = null;
    scene.input.on('pointerdown', this.handleDown, this);
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
    this.image.setScale(1.12);
    this.onPress();
  }

  handleUp(pointer) {
    if (this.pointerId !== pointer.id) return;
    this.pointerId = null;
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
    scene.input.off('pointerup', this.handleUp, this);
    scene.input.off('pointerupoutside', this.handleUp, this);
    this._glowTween?.remove();
    this._glowTween = null;
    this.image.destroy();
    this.gauge.destroy();
    this.readyGlow.destroy();
  }
}
