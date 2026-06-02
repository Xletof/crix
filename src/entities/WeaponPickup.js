import Phaser from 'phaser';
import { PLAYER, WEAPONS } from '../config.js';

const TEXTURE = {
  rifle:        'pickup-rifle',
  flamethrower: 'pickup-flamer',
  detonator:    'pickup-det',
};

const GLOW_COLOR = {
  rifle:        0xff8010,
  flamethrower: 0xff4010,
  detonator:    0xff2020,
};

// Sits in the world. When the player overlaps it, they pick it up.
// Destroyed after pickup. Pulses + glows so it reads on the dark floor.
export class WeaponPickup {
  constructor(scene, x, y, weaponId) {
    this.scene    = scene;
    this.weaponId = weaponId;
    this.active   = true;

    const tex   = TEXTURE[weaponId] ?? 'pickup-rifle';
    const glow  = GLOW_COLOR[weaponId] ?? 0xff8010;

    // Glow ring (graphics anchored at 0,0 + setPosition so we can move it
    // when the magnet pulls the pickup toward the player).
    this.glowGfx = scene.add.graphics().setDepth(18);
    this.glowGfx.fillStyle(glow, 0.18);
    this.glowGfx.fillCircle(0, 0, 38);
    this.glowGfx.lineStyle(2, glow, 0.6);
    this.glowGfx.strokeCircle(0, 0, 38);
    this.glowGfx.setPosition(x, y);

    // Weapon sprite + label — all anchored on this.x/this.y now.
    this.sprite = scene.add.image(x, y, tex).setDepth(19).setScale(0.85);

    const name = WEAPONS[weaponId]?.name ?? weaponId;
    this.label = scene.add.text(x, y + 46, name, {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#ffaa40',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);

    // Idle float tween — affects only the sprite y so the magnet can still
    // re-position the whole pickup without fighting the tween.
    this._floatOffset = 0;
    this._tween = scene.tweens.add({
      targets: this, _floatOffset: -10,
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.x = x;
    this.y = y;
  }

  // Call each frame from GameScene.update()
  checkPickup(player) {
    if (!this.active) return false;
    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    // Magnet pull: when in the outer ring, slide toward the player at a
    // speed that ramps up as we get closer. Player magnet feeling.
    const MAGNET = 90;
    if (dist > PLAYER.radius + 30 && dist < MAGNET) {
      const closeness = 1 - (dist - (PLAYER.radius + 30)) / (MAGNET - (PLAYER.radius + 30));
      const dt = this.scene.game.loop.delta / 1000;
      const pull = 320 * closeness;
      this.x += (dx / dist) * pull * dt;
      this.y += (dy / dist) * pull * dt;
    }
    // Apply position + idle float offset to children every frame.
    this.glowGfx.setPosition(this.x, this.y);
    this.sprite.setPosition(this.x, this.y + this._floatOffset);
    this.label.setPosition(this.x, this.y + 46);
    if (dist < PLAYER.radius + 36) {
      this._collect(player);
      return true;
    }
    return false;
  }

  _collect(player) {
    this.active = false;
    // Grab juice: sparkle burst + bright camera flash + shake.
    const sc = this.scene;
    sc.fx?.pickupSparkle?.(this.x, this.y, 16);
    sc.fx?.shake?.(0.004, 90);
    sc.cameras?.main?.flash(120, 220, 160, 60, true);
    player.equipSecondary(this.weaponId);
    this._tween?.remove();
    this.sprite.destroy();
    this.glowGfx.destroy();
    this.label.destroy();
  }

  destroy() {
    this.active = false;
    this._tween?.remove();
    this.sprite?.destroy();
    this.glowGfx?.destroy();
    this.label?.destroy();
  }
}
