import Phaser from 'phaser';
import { PLAYER, WEAPONS, FONTS } from '../config.js';

// Vertices for the ground outline plate, per weapon-identity shape. Unit
// points scaled by the plate radius at draw time.
const OUTLINE_SHAPES = {
  hex:     [[1, 0], [0.5, 0.866], [-0.5, 0.866], [-1, 0], [-0.5, -0.866], [0.5, -0.866]],
  diamond: [[0, -1], [1, 0], [0, 1], [-1, 0]],
};

const hexColor = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');

// Sits in the world. When the player overlaps it, they pick it up.
// Destroyed after pickup. A shaped, colored outline plate marks the drop and
// the weapon silhouette floats above it (mystery-box style) so each weapon is
// identifiable at a glance across a crowded arena.
export class WeaponPickup {
  constructor(scene, x, y, weaponId) {
    this.scene    = scene;
    this.weaponId = weaponId;
    this.active   = true;

    const wep     = WEAPONS[weaponId] || WEAPONS.rifle;
    const tex     = wep.tex ?? 'pickup-rifle';
    const color   = wep.color ?? 0xffb020;
    const shape   = OUTLINE_SHAPES[wep.outline] || OUTLINE_SHAPES.hex;

    // Ground outline plate — distinct polygon + hue per weapon. Anchored at
    // 0,0 then positioned so the magnet can slide the whole pickup.
    const R = 34;
    this.glowGfx = scene.add.graphics().setDepth(18);
    const pts = shape.map(([sx, sy]) => new Phaser.Geom.Point(sx * R, sy * R));
    this.glowGfx.fillStyle(color, 0.14);
    this.glowGfx.fillPoints(pts, true);
    this.glowGfx.lineStyle(2.5, color, 0.75);
    this.glowGfx.strokePoints(pts, true);
    // Inner accent ring so the plate reads even when the silhouette floats high.
    this.glowGfx.lineStyle(1.5, color, 0.35);
    this.glowGfx.strokeCircle(0, 0, R * 0.55);
    this.glowGfx.setPosition(x, y);

    // Floating weapon silhouette — the recognizable weapon art, lifted above
    // the plate and gently rocking so it reads as "what's inside the box".
    this._floatBase = -26; // rest height above the plate
    this.sprite = scene.add.image(x, y + this._floatBase, tex).setDepth(19).setScale(1.55);
    // Landing bounce: oversized → correct scale with a spring back.
    scene.tweens.add({
      targets: this.sprite, scaleX: 0.9, scaleY: 0.9,
      duration: 300, ease: 'Back.easeOut',
    });
    // Slow rocking so the silhouette feels like it's on display.
    this._rock = 0;
    scene.tweens.add({
      targets: this, _rock: 1, duration: 1600, repeat: -1, yoyo: true, ease: 'Sine.easeInOut',
    });

    const name = wep.name ?? weaponId;
    this.label = scene.add.text(x, y + 34, name, {
      fontFamily: FONTS.body,
      fontSize: '14px',
      color: hexColor(color),
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);

    // Idle float tween — affects only the sprite hover so the magnet can still
    // re-position the whole pickup without fighting the tween.
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
    this.glowGfx.setPosition(this.x, this.y);
    this.sprite.setPosition(this.x, this.y + this._floatBase + this._floatOffset);
    this.sprite.setAngle((this._rock - 0.5) * 24); // gentle ±12° display rock
    this.label.setPosition(this.x, this.y + 34);
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
