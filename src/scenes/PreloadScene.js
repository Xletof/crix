import Phaser from 'phaser';
import { initAudio } from '../systems/FX.js';
import {
  PAL,
  paintPlayer,
  paintGrunt,
  paintShooter,
  paintInterdictor,
  paintHarrower,
  paintShockCaptain,
  paintCaptainRifle,
  paintGrawlix,
  CAPTAIN_FRAMES,
  paintBoss,
  paintConsole,
  paintConsolePedestal,
  paintConsoleWall,
  paintConsoleHeavy,
  paintCoverCrate,
  paintServiceCabinet,
  paintTerminal,
  paintBlastDoor,
  paintShuttle,
  paintShuttleGlow,
  paintShuttleEmergency,
  paintCraneGantry,
  paintFuelDrum,
  paintReactorCore,
  paintReactorCoreGlow,
  paintCatwalkStrut,
  paintSecurityPost,
  paintCellLock,
  paintDetentionConsoleFace,
  paintTransferBench,
  paintBunk,
  paintMeditationPod,
  paintPodGlow,
  paintPodEmergency,
  paintBolt,
  paintSuperSlug,
  paintMissile,
  paintForceOrb,
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
  paintScattergun,
  paintFlakLauncher,
  paintBeamLance,
  paintTwinRepeaters,
  paintRegaliaArmored,
  paintRegaliaSwift,
  paintRegaliaColossal,
  paintRegaliaRegenerator,
  paintRegaliaSummoner,
  paintRegaliaVolatile,
  paintCasing,
  paintDashButton,
  paintMeleeButton,
  paintBustGrunt,
  paintBustShooter,
  paintBustBomber,
  paintBustShielded,
  paintBustSniper,
  paintBustVader,
  paintNemesisBrute, paintNemesisDemolisher, paintNemesisMarksman,
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
    // PHASE B CANDIDATE — the first Champion. See CHAMPION in config.js.
    paintInterdictor(this);
    // PHASE B.1 CANDIDATE — the Harrower. Driven frame-by-frame by its actor
    // rather than through `anims`, so it registers no animation keys.
    paintHarrower(this);
    // THE SHOCK CAPTAIN — TWO SHEETS, NOT ONE TINT. `champ-captain-broken` is
    // the same 51 frames with the command pauldron sheared to a stub and the
    // visor dead, because armour breaking has to change the SILHOUETTE: a
    // recolour says "the same thing, dimmer", which is the read this layer
    // exists to avoid. Same contract as the hero prop's second texture.
    paintShockCaptain(this, 'champ-captain');
    paintShockCaptain(this, 'champ-captain-broken', { broken: true });
    paintCaptainRifle(this, 'wpn-captain');
    // COMBAT PUNCTUATION. Four glyphs, each a different EVENT — see
    // `paintGrawlix`. They are transition markers with a lifetime measured in
    // hundreds of milliseconds, never status icons.
    paintGrawlix(this);
    paintBoss(this);
    // Nemesis bodies — 32x32, purpose-drawn for the size they actually render
    // at. See the note above paintNemesisSheet for why the trooper art could
    // not simply be scaled up.
    paintNemesisBrute(this);
    paintNemesisDemolisher(this);
    paintNemesisMarksman(this);

    // ── Environment ──────────────────────────────────────────────────
    // No shared backdrop here any more: GameScene paints one per room, at the
    // room's own size and with the room's palette. Painting a 1600x1600 canvas
    // (~10MB) on every cold start for a texture nothing reads was pure cost on
    // a load screen that already shows no progress.
    paintConsole(this, 'bush');       // Imperial console replaces tumbleweed
    // THE COVER KIT. Reusable cover archetypes in the shared hard-surface
    // vocabulary — see the block comments in pixelArt.js. Painted for every
    // room because textures are global and cheap; USED only by a room that
    // asks for one by name, which is still two arenas out of four.
    //
    // The `ch-` prefix is historical: the kit was born in the chamber. It is
    // now the shared vocabulary's namespace and the hangar stands on it too.
    paintConsolePedestal(this, 'ch-con-ped-a', 'a');
    paintConsolePedestal(this, 'ch-con-ped-b', 'b');
    paintConsolePedestal(this, 'ch-con-ped-c', 'c');
    paintConsoleHeavy(this, 'ch-con-heavy');
    paintConsoleWall(this, 'ch-con-wall');
    paintCoverCrate(this, 'ch-crate-a', 'a');
    paintCoverCrate(this, 'ch-crate-b', 'b');
    // The junction's contribution to the shared kit: UNPOWERED cover. It
    // declares nothing in `CONSOLE_KIT`, so a room that stands on it gets
    // cover that goes out with the machinery instead of eight lit screens.
    paintServiceCabinet(this, 'rj-cab-a', 'a');
    paintServiceCabinet(this, 'rj-cab-b', 'b');
    paintBlastDoor(this, 'wall');     // Blast door replaces wooden crate
    paintTerminal(this, 'terminal');  // hackable objective terminal

    // ── Room props ───────────────────────────────────────────────────
    // Large single objects that give a room its identity. Two drum
    // colourways because it is the only prop that appears more than once.
    paintShuttle(this, 'prop-shuttle');
    // The shuttle's two ADD faces, painted here with the craft for the same
    // reason the hero machine's are: registration with the object they are
    // bolted to is structural rather than arithmetic. Used only by the hangar.
    paintShuttleGlow(this, 'prop-shuttle-glow');
    paintShuttleEmergency(this, 'prop-shuttle-emer');
    paintCraneGantry(this, 'prop-crane');
    paintFuelDrum(this, 'prop-drum');
    paintFuelDrum(this, 'prop-drum-b', PAL.hangStrip);
    paintReactorCore(this, 'prop-core');
    // The reactor's single ADD face, painted here with the housing for the
    // same registration reason as the two pairs above. Junction only.
    paintReactorCoreGlow(this, 'prop-core-glow');
    paintCatwalkStrut(this, 'prop-strut');
    paintSecurityPost(this, 'prop-post');
    // THE DETENTION KIT. Painted for every room, like every other texture, and
    // handed out only to a room that names it — the same opt-in that keeps the
    // console kit from leaking into the arenas it was never authored for.
    paintCellLock(this, 'dt-con-lock');
    // THE POWERED CONSOLE FACES. Painted on the console's own 28x28 canvas at
    // the same scale, so registration with the object is structural — the same
    // contract the hero machine's and the reactor's faces are built on. Named
    // `dt-` and referenced only by the detention spec's cover list: a face on a
    // cover console is opt-in per PLACEMENT, so the two shared archetypes here
    // (`ch-con-ped-a`, `ch-con-heavy`) stand unchanged in the three approved
    // arenas. The `-emer` pair is dead at normal power.
    paintDetentionConsoleFace(this, 'dt-face-ped-a', 'ped-a');
    paintDetentionConsoleFace(this, 'dt-face-lock', 'lock');
    paintDetentionConsoleFace(this, 'dt-face-lock-emer', 'lock-emer');
    paintDetentionConsoleFace(this, 'dt-face-heavy', 'heavy');
    paintDetentionConsoleFace(this, 'dt-face-heavy-emer', 'heavy-emer');
    paintTransferBench(this, 'dt-bench', 'a');
    paintTransferBench(this, 'dt-bench-b', 'b');
    paintBunk(this, 'prop-bunk');
    // The second colourway. NOT `detStrip` — that is a saturated cyan, and a
    // 136x104 object painted in it was the brightest thing on the deck.
    paintBunk(this, 'prop-bunk-b', PAL.dtWall2);
    paintMeditationPod(this, 'prop-pod');
    // The hero machine's two ADD faces. Painted here with the prop so they can
    // never drift out of registration with it, and used only by the Vader
    // chamber's emissive list — no other room references them.
    paintPodGlow(this, 'prop-pod-glow');
    paintPodEmergency(this, 'prop-pod-emer');

    // ── Projectiles ──────────────────────────────────────────────────
    paintBolt(this, 'bullet',        PAL.boltRed,        PAL.boltRedGlow,   14);
    paintSuperSlug(this, 'bullet-super');
    paintBolt(this, 'bullet-enemy',  PAL.boltGreen,      PAL.boltGreenGlow, 14);
    // THE SHOCK CAPTAIN'S ROUND — longer and electric blue, so it is legible as
    // "the heavy one" in a frame that also has green trooper fire in it. Its
    // own texture because its own POOL: a blue bolt recycled through the green
    // group is re-textured on the next fire, which silently resizes its hitbox.
    paintBolt(this, 'bullet-captain', PAL.bactaLight,     PAL.bactaMid,      18);
    paintMissile(this, 'frag-missile');
    paintForceOrb(this, 'boss-force-orb');

    // ── FX ───────────────────────────────────────────────────────────
    paintMuzzle(this, 'muzzle');
    paintExplosion(this, 'explosion');
    paintSpark(this, 'spark',        PAL.sparkWhite, 3);
    paintSpark(this, 'spark-red',    PAL.boltRed,    3);
    paintSpark(this, 'spark-yellow', PAL.expBright,  3);
    paintSpark(this, 'spark-blue',   PAL.sparkBlue,  3);
    paintSpark(this, 'spark-violet', PAL.sparkViolet, 3);
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

    // Nemesis kit: a weapon per nemesis and a mark per trait, so a named elite
    // reads as a different enemy rather than as a tinted one.
    paintScattergun(this, 'wpn-nem-scatter');
    paintFlakLauncher(this, 'wpn-nem-flak');
    paintBeamLance(this, 'wpn-nem-lance');
    paintTwinRepeaters(this, 'wpn-nem-repeater');
    paintRegaliaArmored(this, 'reg-armored');
    paintRegaliaSwift(this, 'reg-swift');
    paintRegaliaColossal(this, 'reg-colossal');
    paintRegaliaRegenerator(this, 'reg-regenerator');
    paintRegaliaSummoner(this, 'reg-summoner');
    paintRegaliaVolatile(this, 'reg-volatile');

    // Dialogue portraits — one per base archetype, plus Vader. Keyed
    // `bust-<base>` so DialogueScene can look one up straight from `nem.base`.
    paintBustGrunt(this, 'bust-grunt');
    paintBustShooter(this, 'bust-shooter');
    paintBustBomber(this, 'bust-bomber');
    paintBustShielded(this, 'bust-shielded');
    paintBustSniper(this, 'bust-sniper');
    paintBustVader(this, 'bust-vader');

    // ── Animations ───────────────────────────────────────────────────
    const chars = [
      { key: 'mando', tex: 'player' },
      { key: 'grunt', tex: 'grunt' },
      { key: 'shooter', tex: 'shooter' },
      { key: 'vader', tex: 'boss' },
      { key: 'nembrute', tex: 'nem-brute' },
      { key: 'nemdemo',  tex: 'nem-demo' },
      { key: 'nemmarks', tex: 'nem-marks' },
      { key: 'interdictor', tex: 'champ-interdictor' },
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

    // ── Attack poses ─────────────────────────────────────────────────
    //
    // Frames 24-32 of each sheet, laid out three-per-facing in beat order.
    // These exist because an attacking actor used to play its WALK cycle: the
    // body performed none of the move, which is a large part of why Vader's
    // first version read as broken. Selected by `Boss.playVaderAnim` and, for
    // the rest, by `Enemy.preUpdate` off `_moveAnim`.
    //
    // Built for GRUNT and SHOOTER too, not just the boss. Every nemesis base
    // collapses to one of those two sheets — grunt/bomber/swarmling and
    // shooter/shielded/sniper — so nine frames each covers all five.
    const POSE_BASE = 24;
    const poseDirs = ['front', 'back', 'side'];
    const poses = ['raise', 'thrust', 'recoil'];
    const posed = [
      { key: 'vader', tex: 'boss' },
      { key: 'grunt', tex: 'grunt' },
      { key: 'shooter', tex: 'shooter' },
      { key: 'nembrute', tex: 'nem-brute' },
      { key: 'nemdemo',  tex: 'nem-demo' },
      { key: 'nemmarks', tex: 'nem-marks' },
      { key: 'interdictor', tex: 'champ-interdictor' },
    ];
    for (const c of posed) {
      poseDirs.forEach((dirName, di) => {
        poses.forEach((poseName, pi) => {
          this.anims.create({
            key: `${c.key}-${poseName}-${dirName}`,
            frames: [{ key: c.tex, frame: POSE_BASE + di * 3 + pi }],
            frameRate: 10,
            repeat: 0,
          });
        });
      });
    }
    // ── THE SHOCK CAPTAIN'S OWN ANIMATION SET ────────────────────────
    //
    // NOT THE STOCK 33-FRAME CONTRACT, and the differences are the Phase B.2
    // brief rather than decoration. Its sheet is 14 frames per facing:
    //
    //   IDLE is TWO frames. Every other actor here idles on a single frame, so
    //   it is a frozen body between actions; an elite that stands perfectly
    //   still between bursts reads as a prop. Two frames at 3fps is breathing,
    //   not bobbing.
    //
    //   STRAFE is its own two-frame cycle. Playing the forward walk while the
    //   body travels sideways swings the feet fore-and-aft against the
    //   direction of travel, which is the SLIDING read both rejected Champion
    //   candidates died of. A lateral step widens and narrows the stance.
    //
    //   BRACE / FIRE / RECOIL are three separate frames driven by the combat
    //   states, so a shot is an arc the shoulder performs rather than a muzzle
    //   flash over an idle pose.
    //
    // Registered TWICE, once per durability state: `captain` reads the intact
    // sheet and `captainbrk` the broken one, so `_breakArmour` swaps a texture
    // and a prefix and every key it already plays keeps working.
    for (const c of [
      { key: 'captain', tex: 'champ-captain' },
      { key: 'captainbrk', tex: 'champ-captain-broken' },
    ]) {
      ['front', 'back', 'side'].forEach((dirName, di) => {
        const o = di * CAPTAIN_FRAMES.perDir;
        this.anims.create({
          key: `${c.key}-idle-${dirName}`,
          frames: [{ key: c.tex, frame: o + CAPTAIN_FRAMES.idleA },
            { key: c.tex, frame: o + CAPTAIN_FRAMES.idleB }],
          frameRate: 3, repeat: -1,
        });
        this.anims.create({
          key: `${c.key}-walk-${dirName}`,
          frames: [0, 1, 2, 3, 4, 5].map((i) => ({ key: c.tex, frame: o + CAPTAIN_FRAMES.walk + i })),
          frameRate: 12, repeat: -1,
        });
        this.anims.create({
          key: `${c.key}-strafe-${dirName}`,
          frames: [{ key: c.tex, frame: o + CAPTAIN_FRAMES.strafeA },
            { key: c.tex, frame: o + CAPTAIN_FRAMES.strafeB }],
          frameRate: 7, repeat: -1,
        });
        for (const [name, idx] of [
          ['brace', CAPTAIN_FRAMES.brace], ['fire', CAPTAIN_FRAMES.fire],
          ['recoil', CAPTAIN_FRAMES.recoil], ['stagger', CAPTAIN_FRAMES.stagger],
          // CORE FEEL PASS. `settle` is the between-rounds correction that
          // keeps a 3-6 round burst from being one pose looped; `land` is the
          // tactical step's catch, where he receives his own mass.
          ['settle', CAPTAIN_FRAMES.settle], ['land', CAPTAIN_FRAMES.land],
        ]) {
          this.anims.create({
            key: `${c.key}-${name}-${dirName}`,
            frames: [{ key: c.tex, frame: o + idx }],
            frameRate: 12, repeat: -1,
          });
        }
        // Hooks for a future signature action, on the house pose contract so
        // `setMovePose` works the day one is authored. The assets are allowed
        // by §13 of the brief; the ability is not, and there is none.
        ['raise', 'thrust', 'recover'].forEach((poseName, pi) => {
          this.anims.create({
            key: `${c.key}-${poseName}-${dirName}`,
            frames: [{ key: c.tex, frame: CAPTAIN_FRAMES.poseBase + di * 3 + pi }],
            frameRate: 10, repeat: 0,
          });
        });
      });
    }

    // Enraged strike, frames 33-35. Vader only — nothing else has phases.
    poseDirs.forEach((dirName, di) => {
      this.anims.create({
        key: `vader-thrusthot-${dirName}`,
        frames: [{ key: 'boss', frame: 33 + di }],
        frameRate: 10,
        repeat: 0,
      });
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
