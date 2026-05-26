import Phaser from 'phaser';

// Bullet is a physics sprite with a max travel distance.
// Owners spawn bullets via group.fire(...); the bullet handles its own
// lifetime and collisions are wired up in GameScene.

export class Bullet extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y, texture) {
    super(scene, x, y, texture);
    this.damage = 0;
    this.range = 0;
    this.traveled = 0;
    this.lastX = x;
    this.lastY = y;
    this.piercing = false;
    this.hitSet = new Set();
    this.owner = null; // 'player' | 'enemy' | 'boss'
    this.knockback = 0;
  }

  fire(x, y, angle, speed, damage, range, opts = {}) {
    this.scene.physics.world.enable(this);
    this.enableBody(true, x, y, true, true);
    this.setActive(true);
    this.setVisible(true);
    this.setDepth(26);
    this.setRotation(angle);
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.damage = damage;
    this.range = range;
    this.traveled = 0;
    this.lastX = x;
    this.lastY = y;
    this.piercing = opts.piercing || false;
    this.knockback = opts.knockback || 0;
    this.owner = opts.owner || 'player';
    this.hitSet.clear();
    this.body.setCircle(this.width / 2);
    this.body.setOffset(0, 0);
  }

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta);
    if (!this.active) return;
    const dx = this.x - this.lastX;
    const dy = this.y - this.lastY;
    this.traveled += Math.sqrt(dx * dx + dy * dy);
    this.lastX = this.x;
    this.lastY = this.y;
    if (this.traveled >= this.range) {
      this.kill();
    }
  }

  kill() {
    this.setActive(false);
    this.setVisible(false);
    if (this.body) this.body.stop();
    this.disableBody(true, true);
  }
}

export class BulletGroup extends Phaser.Physics.Arcade.Group {
  constructor(scene, texture) {
    super(scene.physics.world, scene, {
      classType: Bullet,
      defaultKey: texture,
      maxSize: 200,
      runChildUpdate: true,
    });
    this.texture = texture;
  }

  fire(x, y, angle, speed, damage, range, opts = {}) {
    /** @type {Bullet} */
    const b = this.get(x, y, this.texture);
    if (!b) return null;
    b.fire(x, y, angle, speed, damage, range, opts);
    return b;
  }
}
