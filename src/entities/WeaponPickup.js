import Phaser from 'phaser';
import { PLAYER, WEAPONS, FONTS } from '../config.js';

const hexColor = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');

// Sits in the world. When the player overlaps it, they pick it up. Destroyed
// after pickup. No crate — the weapon icon itself hovers over a soft colored
// glow with a ground shadow, gently bobbing + rocking, so each weapon reads at
// a glance across a crowded arena. Identity color/tex comes from WEAPONS config.
export class WeaponPickup {
  constructor(scene, x, y, weaponId) {
    this.scene    = scene;
    this.weaponId = weaponId;
    this.active   = true;

    const wep   = WEAPONS[weaponId] || WEAPONS.rifle;
    const tex   = wep.tex ?? 'pickup-rifle';
    const color = wep.color ?? 0xffb020;

    this._floatBase = -22; // rest height of the icon above the ground point

    // Ground shadow (static) so the icon reads as hovering, not sitting.
    this.shadowGfx = scene.add.graphics().setDepth(17);
    this.shadowGfx.fillStyle(0x000000, 0.3);
    this.shadowGfx.fillEllipse(0, 0, 40, 13);
    this.shadowGfx.setPosition(x, y + 10);

    // Soft radial glow halo behind the icon = the "outline". Drawn at origin,
    // then moved to follow the floating icon each frame.
    this.glowGfx = scene.add.graphics().setDepth(18);
    this.glowGfx.fillStyle(color, 0.10); this.glowGfx.fillCircle(0, 0, 40);
    this.glowGfx.fillStyle(color, 0.16); this.glowGfx.fillCircle(0, 0, 30);
    this.glowGfx.lineStyle(2, color, 0.85); this.glowGfx.strokeCircle(0, 0, 36);

    // Floating weapon icon — the recognizable weapon art on display.
    this.sprite = scene.add.image(x, y + this._floatBase, tex).setDepth(19).setScale(0.72);
    // Landing bounce: drop in oversized and settle to rest scale.
    this.sprite.setScale(1.05);
    scene.tweens.add({
      targets: this.sprite, scaleX: 0.72, scaleY: 0.72,
      duration: 320, ease: 'Back.easeOut',
    });
    // Slow rocking so it feels like it's on display.
    this._rock = 0;
    scene.tweens.add({
      targets: this, _rock: 1, duration: 1600, repeat: -1, yoyo: true, ease: 'Sine.easeInOut',
    });

    const name = wep.name ?? weaponId;
    this.label = scene.add.text(x, y + 30, name, {
      fontFamily: FONTS.body,
      fontSize: '14px',
      color: hexColor(color),
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);

    // Idle hover bob — affects only the icon so the magnet can still move the
    // whole pickup without fighting the tween.
    this._floatOffset = 0;
    this._tween = scene.tweens.add({
      targets: this, _floatOffset: -8,
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
    // Apply position + hover + rock to children every frame.
    const iconY = this.y + this._floatBase + this._floatOffset;
    this.shadowGfx.setPosition(this.x, this.y + 10);
    this.glowGfx.setPosition(this.x, iconY);
    this.sprite.setPosition(this.x, iconY);
    this.sprite.setAngle((this._rock - 0.5) * 18); // gentle ±9° display rock
    this.label.setPosition(this.x, this.y + 30);
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
    this.shadowGfx.destroy();
    this.label.destroy();
  }

  destroy() {
    this.active = false;
    this._tween?.remove();
    this.sprite?.destroy();
    this.glowGfx?.destroy();
    this.shadowGfx?.destroy();
    this.label?.destroy();
  }
}
