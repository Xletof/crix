import Phaser from 'phaser';
import { initAudio } from '../systems/FX.js';
import {
  PAL,
  paintPlayer,
  paintGrunt,
  paintShooter,
  paintBoss,
  paintConsole,
  paintTerminal,
  paintBlastDoor,
  paintShuttle,
  paintCraneGantry,
  paintFuelDrum,
  paintReactorCore,
  paintCatwalkStrut,
  paintSecurityPost,
  paintBunk,
  paintMeditationPod,
  paintBolt,
  paintSuperSlug,
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
  paintEnergyBlade,
  paintCasing,
  paintDashButton,
  paintMeleeButton,
} from '../systems/pixelArt.js';

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
    // No shared backdrop here any more: GameScene paints one per room, at the
    // room's own size and with the room's palette. Painting a 1600x1600 canvas
    // (~10MB) on every cold start for a texture nothing reads was pure cost on
    // a load screen that already shows no progress.
    paintConsole(this, 'bush');       // Imperial console replaces tumbleweed
    paintBlastDoor(this, 'wall');     // Blast door replaces wooden crate
    paintTerminal(this, 'terminal');  // hackable objective terminal

    // ── Room props ───────────────────────────────────────────────────
    // Large single objects that give a room its identity. Two drum
    // colourways because it is the only prop that appears more than once.
    paintShuttle(this, 'prop-shuttle');
    paintCraneGantry(this, 'prop-crane');
    paintFuelDrum(this, 'prop-drum');
    paintFuelDrum(this, 'prop-drum-b', PAL.hangStrip);
    paintReactorCore(this, 'prop-core');
    paintCatwalkStrut(this, 'prop-strut');
    paintSecurityPost(this, 'prop-post');
    paintBunk(this, 'prop-bunk');
    paintBunk(this, 'prop-bunk-b', PAL.detStrip);
    paintMeditationPod(this, 'prop-pod');

    // ── Projectiles ──────────────────────────────────────────────────
    paintBolt(this, 'bullet',        PAL.boltRed,        PAL.boltRedGlow,   14);
    paintSuperSlug(this, 'bullet-super');
    paintBolt(this, 'bullet-enemy',  PAL.boltGreen,      PAL.boltGreenGlow, 14);
    paintMissile(this, 'frag-missile');

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
    paintMeleeButton(this);

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
    paintEnergyBlade(this, 'wpn-blade');

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
