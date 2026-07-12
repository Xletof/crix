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
    paintBolt(this, 'bullet',        PAL.boltRed,        PAL.boltRedGlow,   14);
    paintMissile(this, 'bullet-super');
    paintBolt(this, 'bullet-enemy',  PAL.boltGreen,      PAL.boltGreenGlow, 14);

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
    const chars = [
      { key: 'mando', tex: 'player' },
      { key: 'grunt', tex: 'grunt' },
      { key: 'shooter', tex: 'shooter' },
      { key: 'vader', tex: 'boss' }
    ];

    for (const c of chars) {
      const dirs = [
        { name: 'front', offset: 0 },
        { name: 'back', offset: 8 },
        { name: 'side', offset: 16 }
      ];

      for (const d of dirs) {
        // Idle
        this.anims.create({
          key: `${c.key}-idle-${d.name}`,
          frames: [{ key: c.tex, frame: d.offset }],
          frameRate: 4,
          repeat: -1,
        });

        // Walk
        this.anims.create({
          key: `${c.key}-walk-${d.name}`,
          frames: [
            { key: c.tex, frame: d.offset + 1 },
            { key: c.tex, frame: d.offset + 2 },
            { key: c.tex, frame: d.offset + 3 },
            { key: c.tex, frame: d.offset + 4 },
            { key: c.tex, frame: d.offset + 5 },
            { key: c.tex, frame: d.offset + 6 },
          ],
          frameRate: 14,
          repeat: -1,
        });

        // Fire / Action
        this.anims.create({
          key: `${c.key}-fire-${d.name}`,
          frames: [{ key: c.tex, frame: d.offset + 7 }],
          frameRate: 12,
          repeat: 0,
        });
      }
    }

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
