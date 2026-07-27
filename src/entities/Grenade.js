import Phaser from 'phaser';
import { WEAPONS } from '../config.js';

const CFG = WEAPONS.cluster;

// Cluster canister — thrown in arc direction, splits after fuseMs.
// GameScene listens to 'grenade-cluster' and spawns the homing micro-missiles.
export class Grenade extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y, vx, vy) {
    super(scene, x, y, 'grenade');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setVisible(false); // Base physics body is invisible
    this.setDepth(22);
    this.body.setCircle(6, -6, -6);
    this.body.setCollideWorldBounds(true);
    this.body.setBounce(0.35);
    this.body.setDrag(180);
    this.body.setVelocity(vx, vy);

    this.fuse = CFG.fuseMs;
    this._blinking = false;

    // Projected shadow and visual representations
    this.shadow = scene.add.image(x, y + 4, 'shadow').setDepth(21).setAlpha(0.35);
    this.visual = scene.add.image(x, y, 'grenade').setDepth(22);

    // Fuse blink tween (speeds up near detonation)
    this._blinkTimer = scene.time.addEvent({
      delay: 220,
      callback: this._blink,
      callbackScope: this,
      loop: true,
    });

    // Safety: always detonate even if stuck
    scene.time.delayedCall(CFG.fuseMs + 200, () => {
      if (this.active) this._detonate();
    });
  }

  _blink() {
    if (!this.active) return;
    const t = this.fuse;
    // Speed up blink as fuse runs low
    const interval = t > 600 ? 220 : t > 300 ? 110 : 60;
    this._blinkTimer.delay = interval;
    if (this.visual) {
      this.visual.setTint(this._blinking ? 0xff2020 : 0xffffff);
    }
    this._blinking = !this._blinking;
  }

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta);
    if (!this.active) return;
    this.fuse -= delta;
    if (this.fuse <= 0) this._detonate();
    
    // Spin visual representation
    this.visual.rotation += delta * 0.005;

    // Calculate height along a parabolic arc
    const progress = Math.max(0, Math.min(1, (CFG.fuseMs - this.fuse) / CFG.fuseMs));
    const maxH = 64; // max peak height in px
    const z = Math.sin(Math.PI * progress) * maxH;
    
    // Scale visual sprite based on height to give a 3D feel
    const scale = 1.0 + (z / maxH) * 0.5; // grows up to 1.5x at peak
    this.visual.setScale(scale);
    
    // Position visual sprite offset by -z
    this.visual.setPosition(this.x, this.y - z);

    // Shadow stays on the floor (at physics position)
    this.shadow.setPosition(this.x, this.y + 4);
    // Shadow scales down slightly (diffuses) as grenade goes higher
    const shadowScale = 0.8 - (z / maxH) * 0.3; // shrinks at peak
    this.shadow.setScale(shadowScale);
    this.shadow.setAlpha(0.35 * (1 - (z / maxH) * 0.4)); // fades at peak
  }

  _detonate() {
    if (!this.active) return;
    this._blinkTimer?.remove();
    // The blink is now a split timer rather than a detonation fuse — same tell,
    // different payoff.
    this.scene.events.emit('grenade-cluster', this.x, this.y);
    this.destroy();
  }

  destroy(fromScene) {
    this._blinkTimer?.remove();
    this.shadow?.destroy();
    this.visual?.destroy();
    super.destroy(fromScene);
  }
}
