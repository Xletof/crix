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
  paintTerminal,
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
  paintWeaponPickups,
  paintGrenade,
  paintPistolOverlay,
  paintRifleOverlay,
  paintEnemyRifleOverlay,
  paintSaberOverlay,
  paintCasing,
  paintDashButton,
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
    paintTerminal(this, 'terminal');  // hackable objective terminal

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
    paintCasing(this);
    paintDashButton(this);

    // ── HUD ──────────────────────────────────────────────────────────
    paintJoystick(this);
    paintSuperButton(this);
    paintWeaponPickups(this);
    paintGrenade(this);

    // ── Weapon overlays (rotate around the character — body never rotates) ─
    paintPistolOverlay(this, 'wpn-pistol');
    paintRifleOverlay(this, 'wpn-rifle');
    paintEnemyRifleOverlay(this, 'wpn-enemy-rifle');
    paintSaberOverlay(this, 'wpn-saber');

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
        { key: 'player', frame: 3 },
        { key: 'player', frame: 4 },
        { key: 'player', frame: 5 },
        { key: 'player', frame: 6 },
      ],
      frameRate: 14,
      repeat: -1,
    });
    this.anims.create({
      key: 'mando-fire',
      frames: [{ key: 'player', frame: 7 }],
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
        { key: 'grunt', frame: 3 },
        { key: 'grunt', frame: 4 },
        { key: 'grunt', frame: 5 },
        { key: 'grunt', frame: 6 },
      ],
      frameRate: 14,
      repeat: -1,
    });
    this.anims.create({
      key: 'grunt-fire',
      frames: [{ key: 'grunt', frame: 7 }],
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
        { key: 'shooter', frame: 3 },
        { key: 'shooter', frame: 4 },
        { key: 'shooter', frame: 5 },
        { key: 'shooter', frame: 6 },
      ],
      frameRate: 14,
      repeat: -1,
    });
    this.anims.create({
      key: 'shooter-fire',
      frames: [{ key: 'shooter', frame: 7 }],
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
        { key: 'boss', frame: 3 },
        { key: 'boss', frame: 4 },
        { key: 'boss', frame: 5 },
        { key: 'boss', frame: 6 },
      ],
      frameRate: 14,
      repeat: -1,
    });
    this.anims.create({
      key: 'vader-attack',
      frames: [{ key: 'boss', frame: 7 }],
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
