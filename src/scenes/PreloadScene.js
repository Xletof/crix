import Phaser from 'phaser';
import { PLAYER } from '../config.js';
import { initAudio } from '../systems/FX.js';
import {
  PAL,
  paintPlayer,
  paintGrunt,
  paintShooter,
  paintBoss,
  paintBackdrop,
  paintTumbleweed,
  paintCrate,
  paintBullet,
  paintMuzzle,
  paintSpark,
  paintShadow,
  paintJoystick,
  paintSuperButton,
} from '../systems/pixelArt.js';
import { WORLD } from '../config.js';

// All textures are programmatically painted at preload time. No external assets.
// Everything shares the cohesive Wild-West palette defined in pixelArt.js.

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create() {
    // Characters
    paintPlayer(this);
    paintGrunt(this);
    paintShooter(this);
    paintBoss(this);

    // Environment
    paintBackdrop(this, 'backdrop', WORLD.width, WORLD.height);
    paintTumbleweed(this, 'bush');
    paintCrate(this, 'wall');

    // Bullets (tracers, oriented UP — Phaser rotates them in flight)
    paintBullet(this, 'bullet', PAL.fireBright, PAL.fire, 5);
    paintBullet(this, 'bullet-super', '#fff8d0', PAL.fire, 8);
    paintBullet(this, 'bullet-enemy', PAL.red, PAL.redDark, 5);

    // FX
    paintMuzzle(this, 'muzzle');
    paintSpark(this, 'spark', PAL.dirtCream, 3);
    paintSpark(this, 'spark-red', PAL.red, 3);
    paintSpark(this, 'spark-yellow', PAL.gold, 3);
    paintShadow(this, 'shadow', 36);
    paintShadow(this, 'shadow-boss', 84);

    // HUD
    paintJoystick(this);
    paintSuperButton(this);

    initAudio();

    this.scene.start('Title');
  }
}
