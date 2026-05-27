import Phaser from 'phaser';
import { initAudio } from '../systems/FX.js';
import {
  PAL,
  paintPlayer,
  paintGrunt,
  paintShooter,
  paintBoss,
  paintBackdrop,
  paintConsole,
  paintBlastDoor,
  paintBolt,
  paintMissile,
  paintExplosion,
  paintMuzzle,
  paintSpark,
  paintShadow,
  paintJetFlame,
  paintJoystick,
  paintSuperButton,
} from '../systems/pixelArt.js';
import { WORLD } from '../config.js';

// All textures are programmatically painted. No external assets needed.

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create() {
    // ── Characters (sprite sheets, 4 frames each) ────────────────────
    paintPlayer(this);
    paintGrunt(this);
    paintShooter(this);
    paintBoss(this);

    // ── Environment ──────────────────────────────────────────────────
    paintBackdrop(this, 'backdrop', WORLD.width, WORLD.height);
    paintConsole(this, 'bush');       // Imperial console replaces tumbleweed
    paintBlastDoor(this, 'wall');     // Blast door replaces wooden crate

    // ── Projectiles ──────────────────────────────────────────────────
    paintBolt(this, 'bullet',        PAL.boltRed,        PAL.boltRedGlow,   6);
    paintMissile(this, 'bullet-super');
    paintBolt(this, 'bullet-enemy',  PAL.boltGreen,      PAL.boltGreenGlow, 6);

    // ── FX ───────────────────────────────────────────────────────────
    paintMuzzle(this, 'muzzle');
    paintExplosion(this, 'explosion');
    paintSpark(this, 'spark',        PAL.sparkWhite, 3);
    paintSpark(this, 'spark-red',    PAL.boltRed,    3);
    paintSpark(this, 'spark-yellow', PAL.expBright,  3);
    paintSpark(this, 'spark-blue',   PAL.sparkBlue,  3);
    paintShadow(this, 'shadow',      34);
    paintShadow(this, 'shadow-boss', 80);
    paintJetFlame(this, 'jet-flame');

    // ── HUD ──────────────────────────────────────────────────────────
    paintJoystick(this);
    paintSuperButton(this);

    // ── Animations ───────────────────────────────────────────────────
    // Mandalorian (player) — frames: 0=idle, 1=walkA, 2=walkB, 3=fire
    this.anims.create({
      key: 'mando-idle',
      frames: [{ key: 'player', frame: 0 }],
      frameRate: 4,
      repeat: -1,
    });
    this.anims.create({
      key: 'mando-walk',
      frames: [
        { key: 'player', frame: 1 },
        { key: 'player', frame: 2 },
      ],
      frameRate: 7,
      repeat: -1,
    });
    this.anims.create({
      key: 'mando-fire',
      frames: [{ key: 'player', frame: 3 }],
      frameRate: 12,
      repeat: 0,
    });

    // Stormtrooper (grunt) — same layout
    this.anims.create({
      key: 'grunt-idle',
      frames: [{ key: 'grunt', frame: 0 }],
      frameRate: 4,
      repeat: -1,
    });
    this.anims.create({
      key: 'grunt-walk',
      frames: [
        { key: 'grunt', frame: 1 },
        { key: 'grunt', frame: 2 },
      ],
      frameRate: 7,
      repeat: -1,
    });
    this.anims.create({
      key: 'grunt-fire',
      frames: [{ key: 'grunt', frame: 3 }],
      frameRate: 12,
      repeat: 0,
    });

    // Death Trooper (shooter)
    this.anims.create({
      key: 'shooter-idle',
      frames: [{ key: 'shooter', frame: 0 }],
      frameRate: 4,
      repeat: -1,
    });
    this.anims.create({
      key: 'shooter-walk',
      frames: [
        { key: 'shooter', frame: 1 },
        { key: 'shooter', frame: 2 },
      ],
      frameRate: 7,
      repeat: -1,
    });
    this.anims.create({
      key: 'shooter-fire',
      frames: [{ key: 'shooter', frame: 3 }],
      frameRate: 12,
      repeat: 0,
    });

    // Darth Vader (boss)
    this.anims.create({
      key: 'vader-idle',
      frames: [{ key: 'boss', frame: 0 }],
      frameRate: 2,
      repeat: -1,
    });
    this.anims.create({
      key: 'vader-walk',
      frames: [
        { key: 'boss', frame: 1 },
        { key: 'boss', frame: 2 },
      ],
      frameRate: 5,
      repeat: -1,
    });
    this.anims.create({
      key: 'vader-attack',
      frames: [{ key: 'boss', frame: 3 }],
      frameRate: 6,
      repeat: -1,
    });

    // Explosion — 3-frame one-shot
    this.anims.create({
      key: 'explode',
      frames: [
        { key: 'explosion', frame: 0 },
        { key: 'explosion', frame: 1 },
        { key: 'explosion', frame: 2 },
      ],
      frameRate: 14,
      repeat: 0,
    });

    initAudio();
    this.scene.start('Title');
  }
}
