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
    // Seeking config, or null for a straight shot. Living on Bullet rather than
    // in a parallel Missile class is deliberate: every collision, damage,
    // knockback and impact-FX path downstream already handles bullets, so a
    // homing round needs no new wiring anywhere else.
    this.homing = null;
    // Bumped on every fire(). Anything that schedules work against a bullet —
    // a delayedCall, a repeating timer — captures this and bails if it no
    // longer matches, because these objects are pooled and `active`/`scene`
    // only tell you the bullet is ALIVE, not that it is still the same shot.
    // A cluster fragment that died mid-flight and got recycled into a primary
    // bolt was still being written to by its own 450ms descent callback.
    this._gen = 0;
  }

  fire(x, y, angle, speed, damage, range, opts = {}) {
    this._gen++;
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
    this.homing = opts.homing || null;
    this._speed = speed;   // steering re-applies this so a turn never accelerates
    this.hasHit = false;
    this.hitSet.clear();
    this.body.setCircle(this.width / 2);
    this.body.setOffset(0, 0);

    // TRACER STRETCH — scale only, never the texture.
    //
    // A round dot gives the eye nothing to read speed from, which is most of
    // why enemy fire felt like "dodging coming shapes". Stretching along the
    // flight axis reads as velocity for free, because the sprite is already
    // rotated to `angle`.
    //
    // It MUST be `setScale`. The hitbox above comes from `this.width` — the
    // TEXTURE width — so redrawing a longer projectile silently enlarges the
    // collision circle (see the bullet-hitbox trap in CLAUDE.md). Scale does
    // not touch `width`, so the body is identical whatever this does.
    const stretch = Phaser.Math.Clamp(speed / 620, 1, 2.2);
    this.setScale(stretch, 1);
  }

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta);
    if (!this.active) return;
    if (this.homing) this._steer(delta);
    const dx = this.x - this.lastX;
    const dy = this.y - this.lastY;
    this.traveled += Math.sqrt(dx * dx + dy * dy);
    this.lastX = this.x;
    this.lastY = this.y;
    if (this.traveled >= this.range) {
      this.kill();
    }
  }

  // Turn toward the nearest enemy at a bounded rate. Capping the turn (rather
  // than snapping the velocity at the target) is what makes it read as a
  // missile tracking rather than a magnet: it can overshoot a fast crosser and
  // has to swing back around.
  _steer(delta) {
    const { turnRate = 4, searchRadius = 520 } = this.homing;
    const t = this.scene?.findNearestEnemy?.(this.x, this.y);
    if (!t) return;
    if (Math.hypot(t.x - this.x, t.y - this.y) > searchRadius) return;

    const want = Math.atan2(t.y - this.y, t.x - this.x);
    const have = Math.atan2(this.body.velocity.y, this.body.velocity.x);
    const max  = turnRate * (delta / 1000);
    const a    = have + Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - have), -max, max);
    // Re-apply the ORIGINAL speed, so repeated steering can't compound into an
    // ever-faster round.
    this.setVelocity(Math.cos(a) * this._speed, Math.sin(a) * this._speed);
    this.setRotation(a);
  }

  kill() {
    const isMiss = this.owner === 'player' && !this.piercing && !this.hasHit && this.active;
    this.homing = null;
    this.setActive(false);
    this.setVisible(false);
    if (this.body) this.body.stop();
    this.disableBody(true, true);
    if (isMiss) {
      this.scene.events.emit('player-shot-missed');
    }
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
    // Phaser's Group.get only applies the `key` argument when it CREATES a
    // child; a recycled one keeps whatever texture it last had. Re-asserting it
    // here is what stops one group's look leaking into another's — and it is
    // not cosmetic: Bullet.fire() sizes the hitbox with setCircle(this.width/2),
    // so a stale texture silently resizes the body too.
    if (b.texture?.key !== this.texture) b.setTexture(this.texture);
    // Same reasoning one line up, for colour: nemesis weapons tint their bolts
    // to tell themselves apart, and a recycled bullet keeps whatever tint it
    // last had. Without this, one SCATTERGUN burst would leave every ordinary
    // trooper in the room shooting orange for the rest of the run. Callers that
    // want a tint apply it AFTER fire() returns.
    b.clearTint();
    b.fire(x, y, angle, speed, damage, range, opts);
    return b;
  }
}
