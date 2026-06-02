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

    // Glow ring (graphics, drawn under the sprite)
    this.glowGfx = scene.add.graphics().setDepth(18);
    this.glowGfx.fillStyle(glow, 0.18);
    this.glowGfx.fillCircle(x, y, 38);
    this.glowGfx.lineStyle(2, glow, 0.6);
    this.glowGfx.strokeCircle(x, y, 38);

    // Weapon sprite
    this.sprite = scene.add.image(x, y, tex).setDepth(19).setScale(0.85);

    // Label
    const name = WEAPONS[weaponId]?.name ?? weaponId;
    this.label = scene.add.text(x, y + 46, name, {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#ffaa40',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);

    // Idle float tween
    this._tween = scene.tweens.add({
      targets: this.sprite,
      y: y - 10,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.x = x;
    this.y = y;
  }

  // Call each frame from GameScene.update()
  checkPickup(player) {
    if (!this.active) return false;
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
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
