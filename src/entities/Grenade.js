import Phaser from 'phaser';
import { WEAPONS } from '../config.js';

const CFG = WEAPONS.detonator;

// Thermal detonator — thrown in arc direction, detonates after fuseMs.
// GameScene listens to 'grenade-detonate' and handles AoE.
export class Grenade extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y, vx, vy) {
    super(scene, x, y, 'grenade');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(22);
    this.body.setCircle(6, -6, -6);
    this.body.setCollideWorldBounds(true);
    this.body.setBounce(0.35);
    this.body.setDrag(180);
    this.body.setVelocity(vx, vy);

    this.fuse = CFG.fuseMs;
    this._blinking = false;

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
    this.setTint(this._blinking ? 0xff2020 : 0xffffff);
    this._blinking = !this._blinking;
  }

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta);
    if (!this.active) return;
    this.fuse -= delta;
    if (this.fuse <= 0) this._detonate();
    // Spin
    this.rotation += delta * 0.005;
  }

  _detonate() {
    if (!this.active) return;
    this._blinkTimer?.remove();
    this.scene.events.emit('grenade-detonate', this.x, this.y, CFG.damage, CFG.blastRadius);
    this.destroy();
  }

  destroy(fromScene) {
    this._blinkTimer?.remove();
    super.destroy(fromScene);
  }
}
