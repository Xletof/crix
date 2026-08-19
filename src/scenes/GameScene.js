import Phaser from 'phaser';
import { PLAYER, ENEMY, BOSS, HEALTH_ORB, WEAPONS, ARENA, MODIFIERS, SCORE, ENDLESS, FONTS, HUDCFG, VIEW, DEPTH } from '../config.js';
import { Player } from '../entities/Player.js';
import { EnemyGrunt, EnemyShooter, EnemyBomber, EnemyShielded, EnemySniper, EnemySwarmling, ST, VISION_RANGE, VISION_HALF_ANGLE } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { BulletGroup } from '../entities/Bullet.js';
import { paintBackdrop } from '../systems/pixelArt.js';
import { BushSystem } from '../systems/BushSystem.js';
import { RoomManager } from '../systems/RoomManager.js';
import { CoverRegistry } from '../systems/CoverRegistry.js';
import { WeaponPickup } from '../entities/WeaponPickup.js';
import { Terminal } from '../entities/Terminal.js';
import { attachFX, SFX, startMusic, duckMusic, duckSfx, stopMusic, isLowQuality } from '../systems/FX.js';
import { setMusicPhase, setBossPhase, tickDirector, musicSampleDue, resetDirector } from '../systems/musicDirector.js';
import { ROOMS } from '../data/rooms.js';
import { perimeterOpenings } from '../data/mapUtils.js';
import { rollNemesis, traitLine } from '../data/nemesis.js';
import {
  createLedger, recordEscape, recordKill, dueAt, applyScar,
  nemesisFromEntry, promoteSuccessor, displayName, grudgeLine,
} from '../data/nemesisLedger.js';
import { pickLine, nemesisContext, vaderContext } from '../data/nemesisDialogue.js';
import {
  isDialogueMuted, getDuelRequest, setDuelRequest, areMoveNamesMuted,
} from '../systems/debug.js';
import { attachTelegraphs } from '../systems/Telegraph.js';
import { moveById } from '../data/nemesisMoves.js';

// First nemesis move lands 2s in, not a full `everyMs` later — see
// _equipNemesisKit. Cadence then tightens per phase (66% / 33% hp).
const NEMESIS_FIRST_MOVE_MS = 2000;
const NEMESIS_PHASE_CADENCE = { 1: 1, 2: 0.78, 3: 0.6 };

/**
 * How much hp a nemesis carries over its base archetype.
 *
 * Two separate problems, one function.
 *
 * SIZE. It was a flat x6, which put the weakest reachable nemesis at ~1,700 hp
 * against a 3,000-damage super: "killed in 1-2 supers, so it's seconds top".
 * A curated kit needs long enough to actually show itself — the whole point of
 * authoring moves is undone if the fight ends before the second one casts.
 *
 * NOTE ON THE FLOOR: the first nemesis a run can meet is at SECTOR 3, not
 * sector 1 — mini-bosses come only from the `detention` arena (ARENA.detention
 * in config.js is the one wave list carrying `miniBoss: true`), and that is the
 * third room in the cycle. Quoting sector-1 numbers describes a fight nobody
 * can have, and makes the low end look worse than it is.
 *
 * SPREAD. Trait multipliers ran 0.7 (swift) to 3.96 (armored+colossal), a 5.7x
 * range on top of everything else. Raising a flat multiplier scales that spread
 * up with it. Taking the trait product to a fractional power keeps the ORDERING
 * — armored is still tougher than swift — while compressing that component to
 * about 2.8x. Measured effect, in supers-to-kill:
 *
 *   swift grunt, sector 3          0.6 -> 1.3
 *   armored shielded, sector 3     3.1 -> 4.5
 *   3-trait shooter, sector 20    15.2 -> 15.8
 *
 * i.e. it lifts the floor, which is the reported problem, and barely touches
 * the ceiling. It does NOT flatten the whole curve: the remaining spread at
 * high sectors is the sector multiplier (1 + 0.12 per sector, 3.3x by sector
 * 20), not traits. Whether a sector-20 nemesis is too long is a separate
 * question and a separate playtest — changing endless progression to chase a
 * fight-length target is exactly the move that produced the 300,000-hp Vader.
 *
 * THE NUMBER ITSELF IS A PHONE JUDGEMENT. config.js records what it cost to
 * forget that: a harness measured six rungs, asked for 300,000 hp on Vader, and
 * the verdict from the handset was "literally cannot be killed". The bot never
 * dies, so hp/dps answers "how long to chew this pool while taking no
 * consequences", which is not how long a fight is. So this is deliberately a
 * modest step — roughly double, not seven times — put in front of a player
 * rather than derived from a table.
 */
// Which body each base wears, and the render scale that keeps a 32x32 sheet
// the same on-screen size the old 20x20-at-1.8x was.
const NEMESIS_BODIES = {
  grunt:     { tex: 'nem-brute', prefix: 'nembrute' },
  bomber:    { tex: 'nem-demo',  prefix: 'nemdemo' },
  swarmling: { tex: 'nem-brute', prefix: 'nembrute' },
  shooter:   { tex: 'nem-marks', prefix: 'nemmarks' },
  shielded:  { tex: 'nem-marks', prefix: 'nemmarks' },
  sniper:    { tex: 'nem-marks', prefix: 'nemmarks' },
};
// 20 logical px x 1.8 = 36; 32 logical px x 1.125 = 36. Same size, more art.
const NEMESIS_RENDER_SCALE = 1.125;

// ── Nemesis hp ──────────────────────────────────────────────────────────────
//
// Computed ONCE, explicitly, rather than by compounding multipliers. The old
// chain multiplied: archetype hp x endless enemyHpMult x 6 x trait product x a
// 0.12/sector term that had ALREADY been folded into the trait product. Two
// sector terms and two elite terms, and it reached 116,000hp by sector 10 while
// a sector-3 roll landed anywhere between 12,600 and 40,300 — a 3.2x spread
// inside one sector, which is why some nemeses melted and others dragged.
//
// `traitHpMult` is the loadout WITHOUT sector (recorded in nemesis.js), the
// exponent compresses the 0.63x-5.15x trait spread, and the floor stops swift
// and volatile — which both REDUCE hp — from making the early rolls the
// flimsiest ones a player meets.
const NEMESIS_HP_BASE = 26;
const NEMESIS_TRAIT_COMPRESSION = 0.4;
const NEMESIS_TRAIT_FLOOR = 1.2;
const NEMESIS_SECTOR_STEP = 0.05;
// Fraction of normal super-meter gain from a primary hit on a nemesis.
const NEMESIS_SUPER_GAIN = 0.34;

/**
 * @param {object} nem
 * @param {number} sector
 * @param {number} endlessMult  the generic per-enemy hp multiplier already
 *   applied by spawnEnemyAt — divided back out so it is not counted twice.
 */
function nemesisHpMult(nem, sector = 1, endlessMult = 1) {
  const trait = Math.max(0.05, nem?.traitHpMult ?? nem?.hpMult ?? 1);
  const traitFactor = Math.max(NEMESIS_TRAIT_FLOOR,
    Math.pow(trait, NEMESIS_TRAIT_COMPRESSION));
  const sectorFactor = 1 + Math.max(0, sector - 1) * NEMESIS_SECTOR_STEP;
  return (NEMESIS_HP_BASE * traitFactor * sectorFactor) / Math.max(0.01, endlessMult);
}
import { runMove } from '../systems/MoveScript.js';
import { bossMoveById, bossMovesFor } from '../data/bossMoves.js';
import { makeStreams, newSeed } from '../systems/rng.js';
import { NARRATIVE } from '../data/narrative.js';
import { NavGrid } from '../systems/NavGrid.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create(data) {
    // ── Run mode ─────────────────────────────────────────────────────────
    // 'campaign' plays the authored ROOMS sequence once to Vader. 'endless'
    // loops the non-boss arena rooms forever with rising difficulty (see
    // _applySectorScaling / _transitionToNext) until the player dies.
    this.mode   = data?.mode || 'campaign';
    this.sector = 1;
    // Endless-only per-enemy multipliers, read by spawnEnemyAt; _applySectorScaling
    // raises these as `sector` climbs. Campaign never touches them past 1.
    this.enemyHpMult    = 1;
    this.enemySpeedMult = 1;

    // ── Clear the previous run's arena state ─────────────────────────────
    // Phaser reuses the scene instance across scene.start(), so every field
    // set below survives a restart unless it is reset here. loadRoom does not
    // run until a 200ms delayedCall at the end of create(), and update() ticks
    // during that gap — so a restart used to spend those frames running
    // _tickArena against the PREVIOUS run's wave, against a decal
    // RenderTexture that had already been destroyed with the old room. That is
    // the "Cannot read properties of null (reading 'gl')" crash out of
    // _onWaveCleared: an exception inside the Phaser step, which stops the
    // game loop and leaves the canvas frozen black while the DOM buttons and
    // Web Audio keep responding.
    this.arenaActive   = false;
    this._duelActive   = false;
    this.arenaCfg      = null;
    this._roomArenaCfg = null;
    this._wave         = null;
    this._waveIdx      = 0;
    this._wavePhase    = null;
    this._lastLiving   = -1;
    this._comboCount   = 0;
    this._lastKillTime = -99999;
    this._pendingChoice = null;
    this.decalRT       = null;
    // Which arena the endless climb shows next. Starts at 1 because sector 1 is
    // already the hangar (index 0), so the first transition should be index 1.
    this._arenaCycle   = 1;
    this._bossesKilled = 0;

    // ── Run seed ─────────────────────────────────────────────────────────
    // One seed per run, split into independent streams so a change to one
    // system cannot shift another's sequence. Reset HERE with the rest of the
    // run state, because Phaser reuses the scene instance across scene.start()
    // — a seed left over from the previous run would make "restart" mean
    // "replay", which is the opposite of what a roguelite wants.
    this.runSeed = (data?.seed != null) ? (data.seed >>> 0) : newSeed();
    this.rng = makeStreams(this.runSeed, ['nemesis', 'waves', 'drops', 'boss']);
    // Who got away, and who is owed a grudge. Reset HERE for the same reason as
    // the seed: the scene instance is reused across scene.start(), and a ledger
    // that survived would have a fresh run open with a nemesis returning to
    // avenge something that happened in a run the player already lost.
    this.ledger = createLedger();
    // Snapshot the record to beat at run start, per mode. Read once so the
    // in-run "NEW RECORD" fires exactly as the run crosses it.
    this._recordBeaten = false;
    this._bestAtStart  = 0;
    try {
      const saved = JSON.parse(localStorage.getItem('crix.stats') || '{}');
      this._bestAtStart = (this.mode === 'endless' ? saved.bestScoreEndless : saved.bestScore) || 0;
    } catch (_) { this._bestAtStart = 0; }

    // ── Persistent bullet groups (survive room transitions) ────────────────
    this.playerBullets      = new BulletGroup(this, 'bullet');
    this.playerRifleBullets = new BulletGroup(this, 'bullet');   // rifle uses same bolt tex
    this.playerSuperBullets = new BulletGroup(this, 'bullet-super');
    // Cluster fragments get their OWN pool. They used to share playerBullets,
    // and because a fragment is a pooled Bullet that gets mutated after fire()
    // — different texture, deferred homing/velocity writes — a fragment that
    // died early handed a contaminated object straight back to primary fire.
    // That is what made pistol bolts turn into missiles. Primary and secondary
    // are isolated at the input layer already; this isolates them at the pool.
    this.playerFragBullets  = new BulletGroup(this, 'frag-missile');
    this.enemyBullets       = new BulletGroup(this, 'bullet-enemy');
    // Deflected player fire. Hostile, but it must LOOK like the player's own
    // bolt, and a pooled bullet's texture is re-asserted by its group on every
    // fire() — so a red bolt cannot live in the green pool without either
    // leaking red into the next trooper's shot or being re-textured after the
    // fact, which silently resizes its hitbox (`setCircle(this.width / 2)`).
    // Its own pool is the same answer `playerFragBullets` already needed, for
    // the same reason. `hostileBullets` below is what stops the split being
    // forgotten at one of the seven places that iterate incoming fire.
    this.deflectedBullets   = new BulletGroup(this, 'bullet');
    // The caught super, handed back as one slow mass. Its own pool for the
    // third time and the same reason: a 88px round texture in any existing
    // group would resize that group's hitboxes on the next recycle
    // (`setCircle(this.width / 2)`), and this one's radius is 44 against an
    // ordinary bolt's 9.
    this.bossSuperOrbs      = new BulletGroup(this, 'boss-force-orb');

    // ── Grenades group ─────────────────────────────────────────────────────
    this.grenades = this.physics.add.group();

    // ── FX ─────────────────────────────────────────────────────────────────
    this.fx = attachFX(this);
    // Telegraphed danger zones. Ticked by the scene in one pass rather than
    // each one owning a timer, so a paused or torn-down scene stops them all —
    // the same reason Vader's mechanic clocks live on him.
    attachTelegraphs(this);

    // ── Player ─────────────────────────────────────────────────────────────
    this.player = new Player(this, 200, 200);
    // Looser follow lerp so the camera trails the player by a couple of
    // frames. With the acceleration ramp on Player movement, a tight lerp
    // (0.5) was eating the weight curve by chasing the player instantly;
    // 0.22 lets the ramp register on screen as actual physical motion.
    // The aim-lookahead `_camOX/_camOY` smoothing still carries the snap.
    this.cameras.main.startFollow(this.player, true, 0.22, 0.22);
    // Inset the game viewport below the HUD top bar so the world never renders
    // behind it (the bar is a separate overlay scene drawn above everything).
    // This also un-hides the top room exit, which used to sit under the bar.
    this.cameras.main.setViewport(0, HUDCFG.topBarHeight, VIEW.width, VIEW.height - HUDCFG.topBarHeight);

    // ── Bush / cover system ────────────────────────────────────────────────
    this.bushSystem = new BushSystem(this);

    // ── NavGrid pathfinding ────────────────────────────────────────────────
    this.navGrid = new NavGrid(this, 80);

    // ── Aim cone overlay ──────────────────────────────────────────────────
    this.aimGraphics   = this.add.graphics().setDepth(25);

    // ── Patrol vision cones (drawn under enemies) ─────────────────────────
    this.visionGraphics = this.add.graphics().setDepth(2);

    // ── Stealth takedown hint ring ─────────────────────────────────────────
    this.takedownGfx = this.add.graphics().setDepth(27);
    this._takedownTarget = null;
    this.lockGfx = this.add.graphics().setDepth(15);
    this.reloadGfx = this.add.graphics().setDepth(28);
    this.reloadAlpha = 0;

    // ── Persistent Run Stats (accumulates over entire run) ───────────────
    this.runStartTime      = this.time.now;
    this.runStealthKills   = 0;
    this.runDamageTaken    = 0;
    this.runKills          = 0;
    this.runScore          = 0;
    // Per-wave accounting for the clear bonuses. Reset in _startWave.
    this._waveDamage       = 0;
    this._waveStartedAt    = this.time.now;

    // ── Weapon pickups (cleared per room) ──────────────────────────────────
    this.weaponPickups = [];

    // ── Objective terminals (cleared per room) ──────────────────────────────
    this.terminals = [];

    this.stealthKills      = 0;

    // ── Enemy group ────────────────────────────────────────────────────────
    this.enemies = this.add.group({ runChildUpdate: false });
    this.boss    = null;

    // ── Health orbs ────────────────────────────────────────────────────────
    this.healthOrbs = [];

    // ── Room-specific containers (destroyed per-room) ──────────────────────
    this.roomLayer = this.add.group(); // backdrop + walls + cover sprites for current room

    // ── Lives system ───────────────────────────────────────────────────────
    this.lives = 3;

    // ── Room manager ───────────────────────────────────────────────────────
    this.roomManager = new RoomManager(this);

    // ── Shared static group for walls (refreshed per room) ─────────────────
    // Holds both blast-door walls AND solid cover sprites (consoles/crates).
    // Both player and enemies collide with this group.
    this.walls = this.physics.add.staticGroup();
    this.physics.add.collider(this.player, this.walls);

    // ── Door visuals (open/sealed indicator at exit) ───────────────────────
    this.doorGfx = this.add.graphics().setDepth(60);
    this.doorZone = null; // set per room

    // ── AI debug overlay (press U or Backtick to toggle) ──────────────────
    this.debugGraphics = this.add.graphics().setDepth(120);
    this.debugTexts = [];
    this.debugAI = false;
    const toggleDebug = () => {
      this.debugAI = !this.debugAI;
      if (!this.debugAI) {
        this.debugGraphics.clear();
        this.debugTexts.forEach(t => t.setVisible(false));
      }
    };
    this.input.keyboard?.on('keydown-U', toggleDebug);
    this.input.keyboard?.on('keydown-BACKTICK', toggleDebug);

    // ── Event wiring ───────────────────────────────────────────────────────
    this.bindEvents();

    // ── Launch HUD ─────────────────────────────────────────────────────────
    this.scene.launch('HUD', { game: this });

    // ── Start music on first gesture ───────────────────────────────────────
    this.input.once('pointerdown', () => startMusic());
    this.input.keyboard?.once('keydown', () => startMusic());

    // ── Desktop keyboard fallback ──────────────────────────────────────────
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys    = this.input.keyboard?.addKeys('W,A,S,D,SHIFT,F,ENTER,E');
    // SPACE = super: auto-aims the nearest enemy (the cone previews the target
    // while held, and the shot fires along it on release). If the super isn't
    // charged, tap falls back to a primary auto-aim shot so Space always does
    // something.
    this._spaceDownAt = 0;
    this.input.keyboard?.on('keydown-SPACE', (ev) => {
      if (ev.repeat) return;
      const p = this.player;
      if (!p?.alive) return;
      if ((p.superCharge ?? 0) >= PLAYER.superHitsToCharge) {
        this._spaceDownAt = this.time.now;
        p.beginKeyboardSuperAim();
      } else {
        this._spaceDownAt = 0;
        p.keyboardFire();
      }
    });
    this.input.keyboard?.on('keyup-SPACE', () => {
      const p = this.player;
      if (!p?.alive || !this._spaceDownAt) return;
      const held = this.time.now - this._spaceDownAt;
      this._spaceDownAt = 0;
      p.endKeyboardSuperAim(held >= 250);
    });
    this.input.keyboard?.on('keydown-ENTER', () => this.player?.tryFireSuper());
    this.input.keyboard?.on('keydown-F', () => this.player?.tryFireSuper());
    this.input.keyboard?.on('keydown-SHIFT', () => this.player?.tryDash());
    // R = melee Broken Wings combo (tap three times to chain the finisher).
    // NOT Q: HUD.js already binds Q to the stealth takedown, and doubling up
    // would fire both a takedown and a combo cast from one press.
    // Tap fires instantly along the auto-aim; holding past PLAYER.meleeAimArmMs
    // raises the telegraph and steers it with the mouse, casting on release.
    // Same shape as the SPACE super hold above.
    this._rDownAt = 0;
    this.input.keyboard?.on('keydown-R', (ev) => {
      if (ev?.repeat) return;   // optional: the event is absent if emitted directly
      const p = this.player;
      if (!p?.alive) return;
      this._rDownAt = this.time.now;
      p.beginKeyboardMeleeAim();
    });
    this.input.keyboard?.on('keyup-R', () => {
      const p = this.player;
      if (!this._rDownAt) return;
      this._rDownAt = 0;
      p?.endKeyboardMeleeAim();
    });
    this.input.keyboard?.on('keydown-E', () => {
      if (this._takedownTarget) {
        this.performTakedown();
      } else if (this._hackPromptTarget) {
        this.requestHack();
      }
    });

    // ── Start the run ──────────────────────────────────────────────────────
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.time.delayedCall(200, () => this.loadRoom(ROOMS[0]));
    // `?duel=` — drop straight into a nemesis fight. Armed here rather than in
    // loadRoom so it polls for a live player instead of racing the room load;
    // see _armDebugDuel and systems/debug.js.
    this._armDebugDuel();

    // ── Cleanup on shutdown ────────────────────────────────────────────────
    this.events.once('shutdown', () => {
      stopMusic();
      this._offOwnEvents();
      // Heat and phase live at module scope so they survive a scene restart
      // the way the god-mode flag does — which means a restarted run would
      // otherwise start carrying the tension of the one that just ended.
      resetDirector();
      this.scene.stop('HUD');
      this.healthOrbs.forEach((o) => { this.tweens.killTweensOf(o.gfx); o.gfx.destroy(); });
      this.healthOrbs = [];
      // Drop the cached melee telegraph ghost: the scene instance is reused on
      // restart, so a stale handle to a destroyed image would survive with it.
      this._meleeGhost = null;
      // Same trap, same fix, for the returned super's flight effect. Its four
      // display objects are created once and reused, so the handle MUST go or
      // the next run would draw a wake through four destroyed objects.
      this._superOrbFx = null;
    });
  }

  // ── Room loading ─────────────────────────────────────────────────────────

  loadRoom(spec) {
    this._clearRoomEntities();
    this.roomSpec = spec;

    const { w, h } = spec.bounds;

    // Physics + camera bounds
    this.physics.world.setBounds(0, 0, w, h);
    this.cameras.main.setBounds(0, 0, w, h);

    // Backdrop — painted per room, at the room's own size.
    //
    // This used to draw one shared 1600x1600 'backdrop' texture and stretch it
    // with setDisplaySize, which distorted the two 1400-tall rooms: the hangar
    // and detention block rendered the hex grid squashed 12.5% vertically.
    // Painting at w x h fixes that for free, and lets each room carry its own
    // palette so they stop looking like the same place with a different label.
    //
    // Painted on demand rather than in PreloadScene: a 1600x1400 canvas is
    // ~9MB, so all four would be ~36MB of texture on a phone, added to a load
    // that already shows no progress UI. _clearRoomEntities releases the
    // previous room's key, so only one is ever resident.
    const bgKey = `backdrop-${spec.id}`;
    if (!this.textures.exists(bgKey)) {
      // The perimeter band is baked in here too — it is wall ART, not a wall.
      // The physics world bounds already stop everything at these edges, so
      // painting it adds no collision and, like the floor markings, cannot
      // reach `this.walls` and so cannot affect nav or LOS.
      paintBackdrop(this, bgKey, w, h, {
        ...(spec.floor || {}),
        perimeter: spec.perimeter || null,
        openings: perimeterOpenings(spec),
      });
    }
    const bgImg = this.add.image(0, 0, bgKey)
      .setOrigin(0, 0)
      .setDepth(-10);
    this.roomLayer.add(bgImg);
    this._bgKey = bgKey;

    // Floor-decal RenderTexture — blood/scorch/craters are baked into this
    // single canvas instead of staying live Graphics nodes. A 60-75s survival
    // round can rack up hundreds of decals; individually they re-batch every
    // frame and cause progressive FPS decay, baked they're one draw call at
    // constant cost regardless of count. Destroyed with the room via the
    // generic roomLayer sweep in _clearRoomEntities.
    this.decalRT = this.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(2);
    this.roomLayer.add(this.decalRT);

    // Walls — Y-sorted by bottom edge of the 112-px tile so entities standing
    // south of a wall draw IN FRONT and entities north draw behind. This is
    // what gives the arena its top-down 3D-ish space.
    for (const wp of spec.walls) {
      const wall = this.walls.create(wp.x, wp.y, 'wall');
      wall.setDepth(wp.y + 56).refreshBody();
      this.roomLayer.add(wall);
    }

    // Cover / consoles — solid obstacles that also hide actors (bush system).
    // Created as static physics bodies so both player and enemies bump into
    // them. We shrink the physics body (70×70) below the 112×112 sprite so
    // AI can still close to within firing distance of the cover spot.
    this.bushSystem.clear();
    this.coverRegistry = new CoverRegistry(spec.cover);
    for (const cp of spec.cover) {
      const con = this.walls.create(cp.x, cp.y, 'bush');
      con.setDepth(cp.y + 56);
      // ORDER MATTERS — refreshBody() recomputes a STATIC body from the
      // sprite's display size, so calling it AFTER setSize silently throws the
      // shrink away. Written the other way round, this line asked for 70x70
      // and got 112x112 for the entire life of the project.
      con.refreshBody();
      con.body.setSize(70, 70);
      con.body.position.set(cp.x - 35, cp.y - 35);
      con.body.updateCenter();
      this.roomLayer.add(con);
      this.bushSystem.add(con, 55);
    }

    // Room props — large single objects (shuttle, gantry, drums).
    //
    // Origin is bottom-centre and depth is plain `y`, so y IS the ground
    // contact point and props Y-sort with actors exactly as Player/Enemy do.
    // Deliberately NOT the walls' `y + 56`, which assumes a 104px tile and
    // would sort a 400px shuttle from its middle — the player would draw in
    // front of it while standing behind it.
    //
    // A solid prop joins `this.walls`, so it feeds the nav grid, the LOS rects
    // and bullet collision like any other obstacle — all three read the body
    // rect now. Its body is sized from the spec and is smaller than the
    // sprite: a shuttle's footprint is its hull, not its wingspan, so you can
    // walk under the wing and the nav grid only loses the hull.
    for (const pr of spec.props || []) {
      const img = pr.solid
        ? this.walls.create(pr.x, pr.y, pr.tex)
        : this.add.image(pr.x, pr.y, pr.tex);
      img.setOrigin(0.5, 1).setDepth(pr.y);
      if (pr.scale) img.setScale(pr.scale);
      if (pr.flip) img.setFlipX(true);
      if (pr.solid) {
        const bw = pr.bodyW ?? img.displayWidth;
        const bh = pr.bodyH ?? img.displayHeight;
        // ORDER MATTERS. refreshBody() recomputes a STATIC body from the
        // sprite's display size, so it silently discards any setSize() called
        // before it — resize AFTER, then place the body explicitly. The cover
        // consoles below get this wrong and have been colliding at their full
        // sprite size for their whole life; see the note there.
        img.refreshBody();
        img.body.setSize(bw, bh);
        // Origin is bottom-centre, so the body sits at the prop's FEET.
        img.body.position.set(pr.x - bw / 2, pr.y - bh);
        img.body.updateCenter();
      }
      this.roomLayer.add(img);
    }

    // Rebuild pathfinding navigation grid
    this.navGrid.build(w, h, this.walls.getChildren());

    // Cache static wall/cover body rects for LOS checks — walls only change
    // on room load, so enemies shouldn't rebuild Geom objects per raycast.
    this.losRects = this.walls.getChildren()
      .filter((w2) => w2.active && w2.body)
      .map((w2) => new Phaser.Geom.Rectangle(w2.body.x, w2.body.y, w2.body.width, w2.body.height));

    // Remove any stale room-alarm / stealth listeners from previous rooms
    this.events.off('room-alarm-klaxon');
    this.events.off('stealth-kill');

    // Reset stealth tracking for the new room
    this.stealthKills      = 0;
    this._takedownTarget   = null;
    this.takedownGfx.clear();
    this.events.emit('takedown-available', false);

    // First room-alarm of the room fires the klaxon banner
    this.events.on('room-alarm-klaxon', () => this._onFirstAlarm());
    this.events.on('stealth-kill', () => {
      this.stealthKills += 1;
      this.runStealthKills += 1;
      this.fx.damageNumber(this.player.x, this.player.y - 40, 'SILENT', '#80ff80', false);
    });

    // Weapon pickups
    this.weaponPickups.forEach((p) => p.destroy());
    this.weaponPickups = [];
    (spec.pickups ?? []).forEach(({ x, y, weapon }) => {
      this.weaponPickups.push(new WeaponPickup(this, x, y, weapon));
    });

    // Objective terminals — the exit stays sealed until every one is hacked.
    this.terminals.forEach((t) => t.destroy());
    this.terminals = [];
    (spec.terminals ?? []).forEach(({ x, y }) => this.terminals.push(new Terminal(this, x, y)));
    this._terminalsTotal  = this.terminals.length;
    this._terminalsHacked = 0;
    this._enemiesCleared  = false;
    this._roomDoorOpened  = false;
    this._activeHackTarget = null;
    this._hackPromptTarget = null;
    this._comboCount       = 0;
    this._lastKillTime     = -99999;
    this.events.emit('hack-cancel');   // close any leftover mini-game
    this.events.emit('hack-prompt', false);
    this.events.emit('objective-update', this._terminalsHacked, this._terminalsTotal);

    // Spawn enemies listed in the spec (each gets the cover registry injected)
    spec.enemies.forEach((enemySpec) => this.spawnEnemyAt(enemySpec.type, enemySpec.x, enemySpec.y, enemySpec));

    // Boss room
    if (spec.boss) {
      // Dual climax: a full survival round first, then Vader spawns.
      this._startArena(ARENA[spec.id] ?? ARENA.vader);
      this.time.delayedCall(1700, () => {
        this.events.emit('show-banner', 'SURVIVE THE SWARM', '#ff2020');
      });
    }

    // Place player at spawn
    this.player.setPosition(spec.spawn.x, spec.spawn.y);
    this.player.setVelocity(0, 0);

    // Draw sealed exit door
    this.drawDoor(spec, true);

    // Announce room
    this.roomManager.setRoom(spec);
    const idx = this.roomManager.index;
    this.events.emit('room-start', idx + 1, ROOMS.length, spec);
    this._roomLoud = false;
    // Never carry a mid-combo stage across a room boundary.
    this.player?.resetMeleeCombo?.();
    // Baseline for the sector sign's "N HOSTILES DOWN" line — kills made in
    // THIS room are runKills minus whatever the count was on entry.
    this._roomKillsAtStart = this.runKills || 0;

    // Arena wave survival announcement (non-boss). _startWave(0) fires the
    // "WAVE 1" banner itself, so we just kick it off + the terminal hint.
    if (!spec.boss) {
      const arenaCfg = ARENA[spec.id];
      if (arenaCfg) {
        this._startArena(arenaCfg);
        if (this._terminalsTotal > 0) {
          // Sequence behind the modifier banner (~1550ms) when one is present
          // so the single banner object isn't clobbered mid-announce.
          const hintAt = this._roomModifier ? 3100 : 1750;
          this.time.delayedCall(hintAt, () => this.events.emit('show-banner', 'SLICE TERMINALS FOR SUPPORT', '#ffd040'));
        }
      }
    }
  }

  // Initialize a wave-clear round from an ARENA config entry. The room-level
  // cfg is kept as the per-wave default set (_roomArenaCfg); _startWave then
  // merges each wave's overrides over it into this.arenaCfg (the object the
  // drip/roll/spawn code already reads). Waves drive the round now — the old
  // survival clock is gone.
  _startArena(cfg) {
    this._roomArenaCfg    = cfg;
    this.arenaActive      = true;
    this.survivalTimeLeft = 0;   // legacy field kept 0 so old guards fall through
    this._waveIdx         = -1;  // _startWave(0) advances to 0
    this._lastLiving      = -1;
    this._applySectorTint();     // endless: escalating per-sector colour wash
    // Resolve this room's modifier: campaign uses the authored cfg.modifier;
    // endless rolls one at random every room for variety across the climb.
    if (this.mode === 'endless') {
      const pool = Object.values(MODIFIERS);
      this._roomModifier = this.rng.waves.pick(pool);
    } else {
      this._roomModifier = MODIFIERS[cfg.modifier] || null;
    }
    this._startWave(0);

    // Announce after WAVE 1's banner so the modifier reads as the second beat,
    // and drive the persistent HUD label + darkness overlay.
    const m = this._roomModifier;
    this.events.emit('modifier-active', m?.name ?? null, m?.color ?? null);
    this.events.emit('set-darkness', !!m?.darkness);
    if (m) this.time.delayedCall(1550, () => this.events.emit('show-banner', m.name, m.color));
  }

  // Endless: a camera-locked colour wash that rotates hue and deepens each
  // sector, so the same looped rooms visibly escalate instead of looking
  // identical run after run. No-op in campaign.
  _applySectorTint() {
    if (this.mode !== 'endless') return;
    const hue   = ((this.sector - 1) * 0.11) % 1;               // rotate per sector
    const color = Phaser.Display.Color.HSVToRGB(hue, 0.7, 1).color;
    const alpha = Math.min(0.05 + (this.sector - 1) * 0.02, 0.20);
    // `.active` as well as existence, for the reason _meleeGhost documents: the
    // scene instance survives a restart, so this handle can outlive its object.
    // Here it fails silently rather than crashing — the tint would be applied to
    // a destroyed rectangle and simply never appear.
    if (!this._sectorTint || !this._sectorTint.active) {
      this._sectorTint = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, color, alpha)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(9000)
        .setBlendMode(Phaser.BlendModes.ADD);
    } else {
      this._sectorTint.setFillStyle(color, alpha);
    }
  }

  // Apply this room's modifier on top of the merged wave cfg. Effects: ELITE
  // GUARD raises the elite floor (wins over a wave's own eliteChance), FRENZY
  // speeds up spawns and carries a speedMult the spawn hook reads per-enemy.
  _applyModifier(cfg) {
    const m = this._roomModifier;
    if (!m) return cfg;
    const out = { ...cfg };
    if (m.eliteChance   != null) out.eliteChance = Math.max(out.eliteChance ?? 0, m.eliteChance);
    if (m.spawnRateMult)         out.spawnRate   = Math.round(out.spawnRate * m.spawnRateMult);
    if (m.speedMult)             out.speedMult   = m.speedMult;
    return out;
  }

  // Endless-only difficulty ramp, composed after the room modifier. `sector`
  // rises by 1 every room loop (_transitionToNext); scaling is deliberately
  // gentle per step since it compounds indefinitely across a long run.
  // Campaign never enters here (mode check), so it's a pure no-op there.
  _applySectorScaling(cfg) {
    if (this.mode !== 'endless') return cfg;
    const s = Math.max(0, this.sector - 1); // 0 at the first endless room
    const out = { ...cfg };
    out.count       = Math.round(out.count * (1 + s * 0.12));
    out.maxAlive    = out.maxAlive + Math.min(10, Math.floor(s * 1.2));
    out.spawnRate   = Math.round(out.spawnRate * Math.max(0.55, 1 - s * 0.035));
    out.eliteChance = Math.min(0.6, Math.max(out.eliteChance ?? 0, 0.05 + s * 0.025));
    this.enemyHpMult    = 1 + s * 0.08;
    this.enemySpeedMult = Math.min(1.6, 1 + s * 0.02);
    return out;
  }

  // Begin wave `idx`: merge its overrides over the room defaults, reset the
  // spawn budget, announce it, and (if a mini-boss wave) spawn the capstone.
  _startWave(idx) {
    const waves = this._roomArenaCfg?.waves;
    if (!waves || idx >= waves.length) return;
    const wave = waves[idx];
    this._waveIdx    = idx;
    this._wave       = wave;
    // drip/roll/elite all read this merged object
    this.arenaCfg    = this._applySectorScaling(this._applyModifier({ ...this._roomArenaCfg, ...wave }));
    // Wipe the baked blood/scorch from the previous wave — each wave (and each
    // new room/sector, since those start at wave 0) begins on a clean floor.
    this.decalRT?.clear();
    this._wavePhase  = 'spawning';
    this._waveSpawned = 0;
    this._waveDripMs  = 0;
    // Per-wave scoring accounting. FLAWLESS and the speed bonus are judged over
    // one wave, so both counters restart here rather than at room load.
    this._waveDamage    = 0;
    this._waveStartedAt = this.time.now;
    this.events.emit('wave-update', idx + 1, waves.length);
    setMusicPhase('wave'); // combat is live again (also covers the breather->next-wave swell)

    if (wave.miniBoss) {
      this._beginDuel(wave);
    } else if (this.mode === 'endless' && idx === 0) {
      // First wave of an endless room headlines the SECTOR — the run's main
      // progress unit — instead of a generic "WAVE 1", so endless reads as its
      // own escalating mode.
      // A boss sector announces itself as one. Arriving at Vader's chamber with
      // the same amber "SECTOR 10" as any other room throws away the one beat
      // in the climb that should feel different before the fight starts.
      const bossSector = this.roomSpec?.boss;
      this.events.emit('show-banner',
        bossSector ? `SECTOR ${this.sector} — DARK LORD` : `SECTOR ${this.sector}`,
        bossSector ? '#ff2828' : '#ffbb40');
    } else {
      this.events.emit('show-banner', `WAVE ${idx + 1}`, '#40c0ff');
    }
  }

  // Full teardown of an enemy plus every attached scene object. Bulk-destroy
  // paths MUST use this — partial cleanup orphans weaponSprite/threatRing/
  // alertMark as unkillable visual ghosts.
  _destroyEnemyFully(e) {
    try {
      this.enemies.remove(e);
      e.shadow?.destroy(); e.hpBar?.destroy();
      e.alertMark?.destroy(); e.threatRing?.destroy(); e.weaponSprite?.destroy();
      e._attachments?.forEach((a) => a?.destroy?.()); // shield arcs etc.
      if (e.scene) e.destroy();
    } catch (_) {}
  }

  _clearRoomEntities() {
    // Telegraphs first. They are owned by their caster, so destroying enemies
    // sweeps most of them — but a zone whose caster already died is held only
    // by the scene list, and one surviving a room change is a red circle
    // painted on the floor of the next arena.
    this.clearTelegraphs?.();
    // Destroy all enemies still alive (dead ones already cleaned themselves up)
    this.enemies.getChildren().slice().forEach((e) => this._destroyEnemyFully(e));
    this.enemies.clear(false, false);

    // Boss
    if (this.boss) {
      try { this.boss.shadow?.destroy(); this.boss.hpBar?.destroy(); this.boss.destroy(); } catch (_) {}
      this.boss = null;
    }

    // Room-layer objects (backdrop, walls, cover)
    this.roomLayer.getChildren().forEach((o) => o.destroy());
    this.roomLayer.clear(false, false);

    // Release the room's backdrop TEXTURE, not just the image above. Destroying
    // the image leaves the canvas in the texture manager, and at ~9MB each the
    // four rooms would accumulate ~36MB on a phone over a run. Rooms are
    // one-way, so nothing is ever repainted twice within a single run.
    if (this._bgKey && this.textures.exists(this._bgKey)) {
      this.textures.remove(this._bgKey);
      this._bgKey = null;
    }

    // Static wall group
    this.walls.clear(true, true);

    // Weapon pickups
    this.weaponPickups?.forEach((p) => p.destroy());
    this.weaponPickups = [];
    this._pendingChoice = null;   // the pair it referenced is gone with the room

    // Objective terminals
    this.terminals?.forEach((t) => t.destroy());
    this.terminals = [];

    // Grenades
    this.grenades?.getChildren().forEach((g) => { try { g.destroy(); } catch (_) {} });
    this.grenades?.clear(false, false);

    // Kill in-flight bullets
    [...this.playerBullets.getChildren(),
     ...this.playerRifleBullets.getChildren(),
     ...this.playerSuperBullets.getChildren(),
     ...this.playerFragBullets.getChildren(),
     ...this.enemyBullets.getChildren(),
     ...this.deflectedBullets.getChildren(),
     ...this.bossSuperOrbs.getChildren()].forEach((b) => { if (b.active) b.kill(); });
    // ...and park the returned super's wake. Killing the orb stops it being
    // drawn, but the sampled positions behind it are room coordinates, and a
    // surviving history would put three ghosts in the next room at the spot
    // this one died.
    this._hideSuperOrbFx();

    // Health orbs
    this.healthOrbs.forEach((o) => { this.tweens.killTweensOf(o.gfx); o.gfx.destroy(); });
    this.healthOrbs = [];

    // Door zone
    if (this.doorZone) { this.doorZone.destroy(); this.doorZone = null; }
    this.doorGfx.clear();
  }

  // ── Door visuals + trigger ────────────────────────────────────────────────

  drawDoor(spec, sealed) {
    if (!spec.exit) return; // boss room has no exit
    const { w, h } = spec.bounds;
    const { x, y, side } = spec.exit;
    const g = this.doorGfx;
    g.clear();

    const color  = sealed ? 0xff2020 : 0x20ff60;
    const glow   = sealed ? 0xff6060 : 0x80ffaa;
    const alpha  = sealed ? 0.9     : 0.7;
    const len    = 80;

    g.lineStyle(6, color, alpha);
    g.fillStyle(glow, 0.15);

    if (side === 'right') {
      // vertical bar on right edge
      g.fillRect(w - 14, y - len, 14, len * 2);
      g.beginPath(); g.moveTo(w, y - len); g.lineTo(w, y + len); g.strokePath();
      g.lineStyle(2, glow, 0.7);
      g.beginPath(); g.moveTo(w - 10, y - len); g.lineTo(w - 10, y + len); g.strokePath();
    } else if (side === 'bottom') {
      g.fillRect(x - len, h - 14, len * 2, 14);
      g.beginPath(); g.moveTo(x - len, h); g.lineTo(x + len, h); g.strokePath();
      g.lineStyle(2, glow, 0.7);
      g.beginPath(); g.moveTo(x - len, h - 10); g.lineTo(x + len, h - 10); g.strokePath();
    } else if (side === 'left') {
      g.fillRect(0, y - len, 14, len * 2);
      g.beginPath(); g.moveTo(0, y - len); g.lineTo(0, y + len); g.strokePath();
    } else if (side === 'top') {
      g.fillRect(x - len, 0, len * 2, 14);
      g.beginPath(); g.moveTo(x - len, 0); g.lineTo(x + len, 0); g.strokePath();
    }

    // Label
    const label = sealed ? '[ SEALED ]' : '[ EXIT ]';
    const lx = side === 'right' ? w - 80 : side === 'left' ? 80 : x;
    const ly = side === 'bottom' ? h - 80 : side === 'top' ? 80 : y - 24;
    if (!this._doorLabel || !this._doorLabel.active) {
      this._doorLabel = this.add.text(lx, ly, label, {
        fontFamily: FONTS.body,
        fontSize: '18px',
        color: sealed ? '#ff4040' : '#40ff80',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(61);
    } else {
      this._doorLabel.setText(label)
        .setColor(sealed ? '#ff4040' : '#40ff80')
        .setPosition(lx, ly);
    }
  }

  // Open the exit only once BOTH win conditions hold: every enemy is down and
  // every objective terminal is hacked. Called from both completion paths.
  _maybeCompleteRoom() {
    if (this._roomDoorOpened) return;
    if (!this._enemiesCleared) return;
    if (this._terminalsHacked < this._terminalsTotal) {
      // Enemies down but terminals remain — nudge the player toward them.
      if (this._terminalsTotal > 0) {
        this.events.emit('show-banner', 'SLICE THE TERMINALS', '#ffd040');
      }
      return;
    }
    this._roomDoorOpened = true;
    const spec = this.roomSpec;
    if (!spec?.exit) return;
    this._openDoor();
    // Celebration: green flash + banner, and a reward for a fully-silent room.
    this.cameras.main.flash(220, 40, 255, 120, true);
    this.fx.shake(0.004, 120);
    const silent = !this._roomLoud && this._enemiesCleared;
    this.events.emit('show-banner', silent ? 'GHOST — UNDETECTED' : 'CHAMBER CLEAR',
      silent ? '#80ffaa' : '#20ff60');
  }

  _openDoor() {
    const spec = this.roomSpec;
    if (!spec?.exit) return;

    SFX.uiClick();
    this.drawDoor(spec, false);

    const { w, h } = spec.bounds;
    const { x, y, side } = spec.exit;

    // ── Sliding-panel unseal animation ─────────────────────────────────
    // Two green panels slide outward from the centre of the door, briefly
    // showing the opening before fading. A bright flash punctuates the
    // unlock; sparkles fly out for emphasis.
    this._playDoorOpenAnim(spec);

    // Trigger zone at the exit edge
    const zoneW = side === 'right' || side === 'left' ? 30 : 200;
    const zoneH = side === 'top'   || side === 'bottom' ? 30 : 200;
    const zx = side === 'right'  ? w - 15 : side === 'left' ? 15 : x;
    const zy = side === 'bottom' ? h - 15 : side === 'top'  ? 15 : y;

    this.doorZone = this.add.zone(zx, zy, zoneW, zoneH)
      .setOrigin(0.5)
      .setDepth(62);

    this._doorTriggered = false;

    // Endless: the HUD's persistent sector sign and the edge arrow both key off
    // doorZone existing, so they light up together the moment the exit unlocks.
    // Deliberately NOT a show-banner emit — that path auto-fades in ~1.6s and
    // shrinks long text to 34px, which is what made the old prompt brief and
    // small. The sign holds until the player actually leaves.
    if (this.mode === 'endless') this.fx?.shake?.(0.006, 160);
  }

  // Sliding-panel unseal animation that plays once when an exit unlocks.
  // Reads as the blast door retracting. Lives in roomLayer so it gets
  // cleaned up at room change.
  _playDoorOpenAnim(spec) {
    const { w, h } = spec.bounds;
    const { x, y, side } = spec.exit;
    const horiz = side === 'right' || side === 'left';
    const cx = side === 'right' ? w : side === 'left' ? 0 : x;
    const cy = side === 'bottom' ? h : side === 'top' ? 0 : y;
    const panelLen = 90;
    const panelW = 16;
    // Spawn 2 panels meeting at (cx, cy) and slide them apart
    const mk = (sign) => {
      const g = this.add.graphics().setDepth(60);
      g.fillStyle(0x20ff60, 0.9);
      if (horiz) g.fillRect(-panelW / 2, -panelLen / 2, panelW, panelLen / 2);
      else       g.fillRect(-panelLen / 2, -panelW / 2, panelLen / 2, panelW);
      g.lineStyle(2, 0x80ffaa, 0.95);
      if (horiz) g.strokeRect(-panelW / 2, -panelLen / 2, panelW, panelLen / 2);
      else       g.strokeRect(-panelLen / 2, -panelW / 2, panelLen / 2, panelW);
      g.setPosition(cx, cy);
      // slide direction:
      // - top: panels slide up/down → vary y
      // - bottom: same
      const dy = sign * panelLen * 0.55;
      const dx = 0;
      this.tweens.add({
        targets: g,
        y: cy + dy, x: cx + dx,
        alpha: 0,
        duration: 380,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          g.destroy();
          // Trigger the radial unseal bloom graphic once (using sign === 1 as a gate)
          if (sign === 1) {
            const bloom = this.add.graphics().setDepth(59);
            bloom.fillStyle(0xc0f0ff, 0.55); // soft cyan-blue bloom
            bloom.fillCircle(0, 0, 80);
            bloom.setPosition(cx, cy);
            bloom.setScale(0.1);
            this.tweens.add({
              targets: bloom,
              scale: 3.5,
              alpha: 0,
              duration: 600,
              ease: 'Quad.easeOut',
              onComplete: () => bloom.destroy(),
            });
            this.roomLayer.add(bloom);
          }
        },
      });
      this.roomLayer.add(g);
    };
    mk(1); mk(-1);
    // Flash + sparkle for emphasis
    this.fx.pickupSparkle(cx, cy, 18);
    this.cameras.main.flash(180, 50, 220, 100, true);
    this.fx.shake(0.005, 100);
  }

  _checkDoorTrigger() {
    if (!this.doorZone || this._doorTriggered) return;
    const p = this.player;
    const z = this.doorZone;
    if (!p.alive) return;
    if (Phaser.Geom.Intersects.RectangleToRectangle(
      new Phaser.Geom.Rectangle(p.x - PLAYER.radius, p.y - PLAYER.radius, PLAYER.radius * 2, PLAYER.radius * 2),
      new Phaser.Geom.Rectangle(z.x - z.width / 2, z.y - z.height / 2, z.width, z.height)
    )) {
      this._doorTriggered = true;
      this._transitionToNext();
    }
  }

  _transitionToNext() {
    // Endless: loop the non-boss arena rooms (hangar/corridor/detention)
    // forever instead of ending at the last room; each loop raises `sector`,
    // the difficulty knob _applySectorScaling reads.
    if (this.mode === 'endless') {
      // Anything still standing when you leave GOT AWAY. Recorded before the
      // sector increments, so `returnAtSector` is measured from the sector it
      // escaped rather than the one you are walking into.
      this._recordEscapes();
      this.sector++;
      // Every Nth sector is a boss sector. The arena cycle is tracked on its
      // own counter rather than derived from the current room index: after a
      // boss room the index is 3, and `(index + 1) % 3` would send the climb
      // back to the hangar every single time, so the three arenas would never
      // rotate again once the first Vader was cleared.
      const isBoss = this.sector % ENDLESS.bossEvery === 0;
      const nextIdx = isBoss
        ? ROOMS.findIndex((r) => r.boss)
        : (this._arenaCycle++ % 3);
      this.cameras.main.flash(200, 255, 255, 255);
      this.cameras.main.fadeOut(350, 255, 255, 255);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        if (this._doorLabel) { this._doorLabel.destroy(); this._doorLabel = null; }
        this.loadRoom(ROOMS[nextIdx]);
        this.cameras.main.fadeIn(350, 255, 255, 255);
      });
      return;
    }

    if (this.roomManager.isLast) return;
    const nextIdx = this.roomManager.index + 1;

    // White exposure bloom fade out and fade in
    this.cameras.main.flash(200, 255, 255, 255);
    this.cameras.main.fadeOut(350, 255, 255, 255);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (this._doorLabel) { this._doorLabel.destroy(); this._doorLabel = null; }
      this.loadRoom(ROOMS[nextIdx]);
      this.cameras.main.fadeIn(350, 255, 255, 255);
    });
  }

  // ── Stealth takedowns ──────────────────────────────────────────────────────
  // Each frame, find the nearest unalerted enemy the player is standing behind.
  // When one exists, the HUD shows a contextual TAKEDOWN button.
  _updateTakedownTarget() {
    let best = null, bestD = Infinity;
    if (this.player?.alive) {
      for (const e of this.enemies.getChildren()) {
        if (!e.alive || typeof e.isBackstabbable !== 'function') continue;
        if (!e.isBackstabbable(this.player)) continue;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
        if (d < bestD) { bestD = d; best = e; }
      }
    }
    if (best !== this._takedownTarget) {
      this._takedownTarget = best;
      this.events.emit('takedown-available', !!best);
    }
    this._drawTakedownHint(best);
  }

  _drawTakedownHint(enemy) {
    const g = this.takedownGfx;
    g.clear();
    if (!enemy) return;
    const t = (this.time.now * 0.012) % (Math.PI * 2);
    const pulse = 0.5 + 0.5 * Math.sin(t);
    const r = enemy.cfg.radius + 10;
    // Green "silent" reticle around the target
    g.lineStyle(3, 0x40ff80, 0.6 + pulse * 0.4);
    g.strokeCircle(enemy.x, enemy.y, r);
    // Crosshair ticks
    g.lineStyle(2, 0x80ffaa, 0.7 + pulse * 0.3);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      const x1 = enemy.x + Math.cos(a) * (r - 4);
      const y1 = enemy.y + Math.sin(a) * (r - 4);
      const x2 = enemy.x + Math.cos(a) * (r + 5);
      const y2 = enemy.y + Math.sin(a) * (r + 5);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
    }
  }

  // Called by the HUD HACK button. Opens the slicing mini-game on whatever
  // terminal the player is currently standing on (no-op if none).
  requestHack() {
    const t = this._hackPromptTarget;
    if (!t || t.hacked) return;
    this._activeHackTarget = t;
    this.events.emit('hack-start', t);
  }

  // Called by the HUD takedown button.
  performTakedown() {
    const e = this._takedownTarget;
    if (!e || !e.alive) return;

    // Face the enemy
    const angle = Math.atan2(e.y - this.player.y, e.x - this.player.x);
    this.player.facing = angle;
    this.player.aim = angle;

    // Curved slash swipe effect on the enemy
    this.fx.slashSwipe(e.x, e.y, angle, 45, 0x40ff80);

    // Player jump-dash visual tween toward enemy
    this.tweens.add({
      targets: this.player,
      x: e.x - Math.cos(angle) * 20,
      y: e.y - Math.sin(angle) * 20,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut'
    });

    this.fx.burst(e.x, e.y, 'red', 18);
    this.fx.shake(0.008, 110);
    this.cameras.main.flash(80, 60, 255, 120, true);
    // Cinematic slow-mo for stealth kills — deeper than a regular slow-mo
    this._slowMo(0.3, 380);
    this._cameraPunch(1.08, 420);
    SFX.takedown();
    e.stealthKill();
    this._takedownTarget = null;
    this.takedownGfx.clear();
    this.events.emit('takedown-available', false);
  }

  // ── Hotline-style kill juice helpers ──────────────────────────────────────

  // Stamp a one-off decal Graphics into the room's decalRT, then free it. Bakes
  // hundreds of individual live nodes down to a single GPU-resident texture, so
  // decal count no longer costs per-frame render time (see decalRT comment in
  // loadRoom). The decal draws itself at absolute world coords already, and the
  // RT maps world (0,0)->(0,0) 1:1, so no offset math is needed.
  _bakeDecal(g) {
    if (this.decalRT) { this.decalRT.draw(g, 0, 0); g.destroy(); }
    else this.roomLayer.add(g); // defensive fallback if called pre-room-load
  }

  // Persistent blood splatter pool — irregular dark-red circles, baked into
  // decalRT so it survives for the room without costing a live node per kill.
  // Builds a "trail of bodies" visual that lingers as the player advances.
  spawnBloodSplatter(x, y) {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x4a0000, 0.55);
    g.fillCircle(x, y, 16);
    g.fillStyle(0x6a0000, 0.6);
    g.fillCircle(x, y, 11);
    // 6-8 splotch dots flung outward
    const dots = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < dots; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 6 + Math.random() * 28;
      const r = 2 + Math.random() * 5;
      g.fillStyle(Math.random() < 0.5 ? 0x4a0000 : 0x6a0010, 0.45 + Math.random() * 0.25);
      g.fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d, r);
    }
    this._bakeDecal(g);
  }

  // Radial death glow — bright orange ring that expands and fades quickly
  // over the kill site. Drawn as a Graphics object animated via tween.
  _spawnDeathGlow(x, y, baseR = 22) {
    const g = this.add.graphics().setDepth(26);
    g.fillStyle(0xff6020, 0.55);
    g.fillCircle(0, 0, baseR);
    g.lineStyle(2.5, 0xffd060, 0.95);
    g.strokeCircle(0, 0, baseR);
    g.setPosition(x, y);
    this.tweens.add({
      targets: g, scale: 3.4, alpha: 0,
      duration: 280, ease: 'Cubic.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  // ── Score ────────────────────────────────────────────────────────────────
  //
  // One entry point so every scoring event is countable and testable. Anything
  // that awards points goes through here; nothing writes `runScore` directly.

  // The live chain multiplier. Reads GameScene._comboCount (chain kills within
  // the 2s window), NOT Player.accuracyMult — see the note on SCORE in
  // config.js for why those are two different things.
  chainMult() {
    const n = Math.max(1, this._comboCount || 1);
    return Math.min(SCORE.chainMax, 1 + SCORE.chainStep * (n - 1));
  }

  scoreForEnemy(enemy) {
    // A nemesis is worth more the longer it has been hunting you. Scars are the
    // record of that, so the grudge pays out in the currency the run is scored
    // in — letting one get away is a deliberate bet rather than a pure loss.
    if (enemy?._miniBoss) {
      const scars = enemy._nemesis?.scars || 0;
      return Math.round(SCORE.miniBoss * (1 + 0.5 * scars));
    }
    const base = SCORE.points[enemy?.enemyType] ?? SCORE.points.grunt;
    const raw = base * (enemy?._elite ? SCORE.eliteMult : 1);
    return Math.round(raw * this.chainMult());
  }

  // `x`/`y` optional: when given, the points float off that spot. Bonuses
  // awarded with no position (a wave clear) are silent on the field and land in
  // the HUD readout, so the arena is not littered with numbers between waves.
  addScore(amount, x = null, y = null, label = null) {
    if (!(amount > 0)) return 0;
    const n = Math.round(amount);
    this.runScore = (this.runScore || 0) + n;
    this.events.emit('score-changed', this.runScore, n);

    // Beating your best is the most exciting thing that can happen in a run,
    // and burying it on the summary screen wastes it — by then the run is over
    // and you cannot enjoy it. Fire it the moment it happens, once. `_bestAtStart`
    // is captured at run start so it does not move under us as we pass it.
    if (this._bestAtStart > 0 && !this._recordBeaten && this.runScore > this._bestAtStart) {
      this._recordBeaten = true;
      this.events.emit('score-medal', 'NEW RECORD', this.runScore, '#40ff90');
      SFX.superReady?.();
    }
    if (x !== null && y !== null) {
      this.events.emit('score-popup', x, y, n, label, this.chainMult());
    }
    return n;
  }

  // Chain-kill combo: any death within 2s of the previous one bumps the
  // counter. Past x2 we emit 'show-combo' which the HUD renders as a
  // splashy "x2!", "x3!" etc. Resets when the streak times out.
  _tickKillCombo() {
    const now = this.time.now;
    if (now - (this._lastKillTime ?? -99999) < 2000) {
      this._comboCount = (this._comboCount || 0) + 1;
    } else {
      this._comboCount = 1;
    }
    this._lastKillTime = now;
    if (this._comboCount >= 2) {
      this.events.emit('show-combo', this._comboCount);
      // A finisher slam resolves its kills BEFORE it plays its own sound, so
      // without this the chime — and its ~800ms echo tail — started first and
      // buried the impact under a high-frequency ring. Inside a slam window the
      // visual "x3!" still pops immediately; only the audio waits, landing in
      // the slam's tail rather than on its transient, and dry.
      const n = this._comboCount;
      if (now < (this._slamChimeHoldUntil ?? 0)) {
        this.time.delayedCall(350, () => SFX.comboChime(n, true));
      } else {
        SFX.comboChime(n);
      }
    }
  }

  // Bright white pop at a wall hit — decays fast over ~80ms. Pure flash, no
  // persistence; the scorch/crater handles the lasting mark.
  _impactMicroFlash(x, y, r = 8) {
    const g = this.add.graphics().setDepth(27);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(0, 0, r);
    g.fillStyle(0xfff0c0, 0.55);
    g.fillCircle(0, 0, r * 1.7);
    g.setPosition(x, y);
    this.tweens.add({
      targets: g, scale: 1.8, alpha: 0,
      duration: 90, ease: 'Cubic.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  // Super-impact crater — larger persistent floor mark for missile hits.
  // Composed of overlapping dark blobs + a charred ring for depth.
  spawnCrater(x, y) {
    const g = this.add.graphics().setDepth(2);
    // Outer charred ring
    g.lineStyle(2, 0x000000, 0.5);
    g.strokeCircle(x, y, 18);
    // Dark crater body
    g.fillStyle(0x000000, 0.7);
    g.fillCircle(x, y, 14);
    g.fillStyle(0x0a0a14, 0.85);
    g.fillCircle(x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4, 10);
    // Ejecta dots scattered around
    for (let i = 0; i < 9; i++) {
      g.fillStyle(0x1a1a22, 0.6);
      const a = Math.random() * Math.PI * 2;
      const d = 14 + Math.random() * 14;
      g.fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + Math.random() * 2.5);
    }
    this._bakeDecal(g);
  }

  // Small persistent scorch mark on the floor where a bullet hit a wall.
  // Builds up over a firefight so the room visually records the chaos.
  spawnScorch(x, y) {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x000000, 0.55);
    g.fillCircle(x, y, 7);
    g.fillStyle(0x0a0a14, 0.65);
    g.fillCircle(x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4, 5);
    // A few stray soot dots
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0x1a1a22, 0.45);
      const a = Math.random() * Math.PI * 2;
      const d = 4 + Math.random() * 8;
      g.fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.7 + Math.random() * 1.8);
    }
    this._bakeDecal(g);
  }

  // Persistent radial floor crack pattern when Vader enrages. More cracks and
  // longer lines on phase 3. Stays in roomLayer for the duration of the fight.
  _spawnVaderGroundCrack(cx, cy, phase) {
    const g = this.add.graphics().setDepth(2);
    const crackCount = phase >= 3 ? 10 : 7;
    const maxLen     = phase >= 3 ? 110 : 75;
    const alpha      = phase >= 3 ? 0.72 : 0.55;
    for (let i = 0; i < crackCount; i++) {
      const baseAng = (i / crackCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      // Each crack: a jagged polyline radiating outward
      let x = cx, y = cy;
      const segments = 3 + Math.floor(Math.random() * 3);
      const segLen   = (maxLen * (0.6 + Math.random() * 0.4)) / segments;
      g.lineStyle(1.5 + Math.random(), 0x1a1a22, alpha);
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < segments; s++) {
        const jitter = (Math.random() - 0.5) * 0.45;
        x += Math.cos(baseAng + jitter) * segLen * (0.7 + Math.random() * 0.6);
        y += Math.sin(baseAng + jitter) * segLen * (0.7 + Math.random() * 0.6);
        g.lineTo(x, y);
      }
      g.strokePath();
      // Sub-crack: short branch near the tip
      const branchAng = baseAng + (Math.random() - 0.5) * 1.1;
      const branchLen = segLen * (0.3 + Math.random() * 0.45);
      g.lineStyle(1, 0x1a1a22, alpha * 0.7);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(branchAng) * branchLen, y + Math.sin(branchAng) * branchLen);
      g.strokePath();
    }
    // Dark epicenter ring
    g.lineStyle(2, 0x000000, 0.6);
    g.strokeCircle(cx, cy, phase >= 3 ? 22 : 14);
    g.fillStyle(0x000000, 0.35);
    g.fillCircle(cx, cy, phase >= 3 ? 16 : 10);
    this._bakeDecal(g);
  }

  // Smooth slow-mo ramp on physics + scene time. Falls to `floor` (e.g. 0.3)
  // and tweens back to 1 over `durMs`. Both clocks slow together so tweens,
  // animations, and physics all read consistently. Safe to overlap calls —
  // the latest scale wins.
  _slowMo(floor = 0.3, durMs = 380) {
    // Take the clocks back from hitstop before driving them. Both systems write
    // time.timeScale and physics.world.timeScale, and a hitstop restore landing
    // mid-ramp would snap this to 1 halfway through. See the precedence note in
    // systems/juice.js.
    this.fx?.cancelHitstop?.();
    const pw = this.physics.world;
    const t  = this.time;
    if (this._slowMoPwTween) this._slowMoPwTween.stop();
    if (this._slowMoTTween) this._slowMoTTween.stop();
    pw.timeScale = floor;
    t.timeScale  = floor;
    this._slowMoPwTween = this.tweens.add({
      targets: pw, timeScale: 1, duration: durMs, ease: 'Quad.easeOut',
    });
    this._slowMoTTween = this.tweens.add({
      targets: t, timeScale: 1, duration: durMs, ease: 'Quad.easeOut',
      onComplete: () => { 
        pw.timeScale = 1; 
        t.timeScale = 1; 
        this._slowMoPwTween = null;
        this._slowMoTTween = null;
      },
    });
  }

  // Brief camera punch-zoom: pulse the zoom up to `to` over half the
  // duration, then back to 1.0. Decay handled by a tween so it's safe
  // through scene transitions.
  // ── Melee "Broken Wings" cast ─────────────────────────────────────────
  // One arc swing in front of the player. Every enemy inside the cone is hit
  // exactly ONCE per swing (per-swing Set) — an arc that re-tests the same
  // enemy across frames is the classic multi-hit bug for this kind of attack.
  // Cast = the wind-up, fired the instant the button is pressed. Damage does
  // NOT happen here: the lunge travels up to ~280px first, so resolving hits
  // now would damage whatever stood at the launch point and then sail past it.
  // Player emits 'player-melee-land' when the travel ends (see performMeleeLand).
  performMeleeCast(dir, stage, finisher) {
    const p = this.player;
    if (!p?.alive) return;
    SFX.meleeSwing?.(stage);
    this._meleeLungeTrail(dir, finisher);
    if (finisher) this._cameraPunch(1.02, 140);
  }

  // Velocity for the lunge itself. The combo used to have no travel FX at all —
  // the player teleported 260px with only the arc at the far end to show for it.
  // This is the dash's afterimage rig (see the 'player-dash' handler): a tapered
  // ADD speed-streak plus a trail of solid silhouette stamps.
  //
  // setTintFill, NOT setTint — setTint multiplies onto an already-dark sprite and
  // barely shows; setTintFill replaces the pixel outright. Same trap the dash
  // afterimage documents.
  _meleeLungeTrail(dir, finisher) {
    const p = this.player;
    const low = isLowQuality();
    const cos = Math.cos(dir), sin = Math.sin(dir);
    const perpX = -sin, perpY = cos;
    const len = finisher ? 170 : 130;
    const wid = finisher ? 32 : 24;

    const g = this.add.graphics().setDepth(p.depth - 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    const tailX = p.x - cos * len, tailY = p.y - sin * len;
    const taper = (alpha, w) => {
      g.fillStyle(0x80f0ff, alpha);
      g.beginPath();
      g.moveTo(p.x + perpX * w, p.y + perpY * w);
      g.lineTo(p.x - perpX * w, p.y - perpY * w);
      g.lineTo(tailX, tailY);
      g.closePath();
      g.fillPath();
    };
    taper(0.42, wid);
    taper(0.7, wid * 0.5);
    this.tweens.add({
      targets: g, alpha: 0, duration: 240, ease: 'Cubic.easeOut',
      onComplete: () => g.destroy(),
    });

    // Ghost stamps run only while the lunge is actually travelling, so the trail
    // ends where the player stops rather than smearing past it.
    const stamp = () => {
      const pl = this.player;
      if (!pl?.active || !pl.isMeleeLunging) return;
      const ghost = this.add.image(pl.x, pl.y, pl.texture.key, pl.frame.name)
        .setOrigin(pl.originX, pl.originY)
        .setScale(pl.scaleX, pl.scaleY)
        .setFlipX(pl.flipX)
        .setAngle(pl.angle)
        .setDepth(pl.depth - 1)
        .setTintFill(0x60ecff)
        .setAlpha(low ? 0.5 : 0.8);
      this.tweens.add({
        targets: ghost, alpha: 0, scale: ghost.scaleX * 1.15,
        duration: 300, ease: 'Cubic.easeOut',
        onComplete: () => ghost.destroy(),
      });
    };
    stamp();
    this.time.addEvent({ delay: low ? 34 : 20, repeat: low ? 5 : 12, callback: stamp });
  }

  // Land = the swing connects. Casts 1-2 sweep a cone in front; the finisher is
  // a RADIAL ground slam centred on the landing point that launches everything
  // outward and stuns it.
  performMeleeLand(dir, stage, finisher) {
    const p = this.player;
    if (!p?.alive) return;

    const dmg    = (finisher ? PLAYER.meleeFinisherDamage : PLAYER.meleeDamage) * p.dmgMult;
    const hitSet = new Set();

    const arc   = Phaser.Math.DegToRad(PLAYER.meleeArcDeg);
    const range = PLAYER.meleeRange;

    // Open the slam window BEFORE any damage resolves. tryHit() below kills
    // enemies, which runs _tickKillCombo synchronously — so the flag has to be
    // up already or the chime it fires won't see it.
    if (finisher) this._slamChimeHoldUntil = this.time.now + 700;

    const tryHit = (e) => {
      if (!e || !e.active || !e.alive || hitSet.has(e)) return;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      const er = e.cfg?.radius ?? 22;

      let kbx, kby;
      if (finisher) {
        // Full circle — no cone test at all. An enemy directly BEHIND the
        // player is inside the slam and must be hit.
        if (d > PLAYER.meleeSlamRadius + er) return;
        // Launch outward from the epicentre, not along the swing direction.
        const out = d > 0.001 ? Math.atan2(e.y - p.y, e.x - p.x) : dir;
        kbx = Math.cos(out) * PLAYER.meleeSlamKnockback;
        kby = Math.sin(out) * PLAYER.meleeSlamKnockback;
      } else {
        if (d > range + er) return;
        const da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(e.y - p.y, e.x - p.x) - dir));
        if (da > arc / 2) return;
        kbx = Math.cos(dir) * PLAYER.meleeKnockback;
        kby = Math.sin(dir) * PLAYER.meleeKnockback;
      }

      hitSet.add(e);
      e.damage(dmg, { x: kbx, y: kby });
      // The slam's stun is the top-down stand-in for Riven's knockup. damage()
      // sets a 90ms stagger; widen it so the slam buys a real reset window.
      // Applied after, since damage() writes _staggerMs itself.
      if (finisher && e.alive) e._staggerMs = PLAYER.meleeSlamStunMs;
      this.fx.burstDir(e.x, e.y, 'yellow', finisher ? 14 : 8,
        finisher ? Math.atan2(kby, kbx) : dir, 70);
      this.fx.impactRing(e.x, e.y, 0x90d8ff);
    };
    this.enemies.getChildren().forEach(tryHit);
    if (this.boss) tryHit(this.boss);

    // Melee builds the RANGED meter (and vice versa via bullets), so the two
    // skills feed each other instead of competing for the same input.
    if (hitSet.size > 0) p.addSuperHit();

    this._meleeImpactFx(dir, stage, finisher, hitSet.size);
  }

  // Impact presentation, split out so C3 can rework the visuals without
  // touching hit resolution.
  _meleeImpactFx(dir, stage, finisher, hits) {
    const p = this.player;

    if (finisher) {
      // Radial slam: a wide blade arc carried round by the flip, plus a
      // shockwave sized to the actual AoE so what you see is what it hits.
      this.fx.bladeArc(p.x, p.y, dir, PLAYER.meleeSlamRadius * 0.55, 3);
      this.fx.slamShockwave(p.x, p.y, PLAYER.meleeSlamRadius);
      // Duck the music under the thomp: the master bus is a hard limiter
      // (threshold -10, ratio 12) and would squash the sub otherwise.
      SFX.meleeSlam?.();
      duckMusic(0.35, 520);
      // Clear the general SFX bus too — death beeps, hit crunches and gunfire
      // all sit in the band a phone speaker reproduces best, right where the
      // slam is weakest. meleeBus is a sibling of the ducked bus, so the slam
      // itself is untouched.
      duckSfx(0.6, 600);
      this.fx.shake(0.020, 260);
      this._cameraPunch(1.08, 260);
      this._slowMo(0.5, 240);
      this.cameras.main.flash(140, 150, 225, 255, true);
    } else {
      // Casts 1-2: the arc is centred on the player and sized to the reach, so
      // the sweep covers the ground the cone actually hits.
      this.fx.bladeArc(p.x, p.y, dir, PLAYER.meleeRange * 0.78, stage);
      // Landing kicks up floor dust, and a connect throws sparks along the
      // swing — the cast used to end with nothing but the arc.
      this.fx.dustPuff(p.x, p.y + 14);
      this.fx.dustPuff(p.x - Math.cos(dir) * 16, p.y + 12);
      if (hits > 0) {
        this.fx.burstDir(p.x + Math.cos(dir) * 30, p.y + Math.sin(dir) * 30,
          'white', 7, dir, 80);
        SFX.meleeHit?.();
      }
      this.fx.shake(hits > 0 ? 0.009 : 0.005, 100);
      if (hits > 0) this._cameraPunch(1.02, 110);
    }
  }

  // Distance falloff for super-hit shake: full punch on enemies near the
  // player, dropping to a floor of 0.15x by ~700px out. Keeps a super that
  // wipes a spread crowd from ringing the camera on every distant kill.
  _superShakeFalloff(enemy) {
    if (!this.player) return 1;
    const d = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
    return Phaser.Math.Clamp(1 - d / 700, 0.15, 1);
  }

  _cameraPunch(to = 1.04, durMs = 220) {
    const cam = this.cameras.main;
    if (this._cameraPunchTween) this._cameraPunchTween.stop();
    cam.setZoom(1);
    this._cameraPunchTween = this.tweens.add({
      targets: cam,
      zoom: to,
      duration: durMs * 0.35,
      yoyo: true,
      ease: 'Cubic.easeOut',
      onComplete: () => { cam.setZoom(1); this._cameraPunchTween = null; },
    });
  }

  // Ambient light-flicker effect for the boss room: rapid dim flashes that
  // repeat every 2-4 s while the boss is alive, evoking a damaged power grid.
  _startBossFlicker() {
    const runFlicker = () => {
      if (!this.boss?.alive) return;
      const cam = this.cameras.main;
      if (!cam) return;
      const count = Phaser.Math.Between(2, 4);
      for (let i = 0; i < count; i++) {
        this.time.delayedCall(i * Phaser.Math.Between(55, 100), () => {
          if (cam && this.boss?.alive) cam.flash(45, 15, 8, 25, true);
        });
      }
      const next = Phaser.Math.Between(1800, 4500) + count * 100;
      this.time.delayedCall(next, runFlicker);
    };
    this.time.delayedCall(Phaser.Math.Between(400, 1000), runFlicker);
  }

  // ── Sound-radius alarm ────────────────────────────────────────────────────
  // Only enemies within `radius` px of the shot hear it and switch to ALERT.
  // Enemies farther away keep patrolling until they SEE the player themselves.
  alertEnemiesNear(x, y, radius) {
    if (this.debugAI) {
      this._soundEvents = this._soundEvents || [];
      this._soundEvents.push({ x, y, r: radius, t: this.time.now, duration: 1000 });
    }
    const r2 = radius * radius;
    let anyAlerted = false;
    for (const e of this.enemies.getChildren()) {
      if (!e.active || !e.alive) continue;
      if (e.state !== ST.PATROL && e.state !== ST.SUSPICIOUS) continue; // already alerted
      if ((e.x - x) ** 2 + (e.y - y) ** 2 < r2) {
        e._triggerAlarm(true); // heard a shot → "?"
        anyAlerted = true;
      }
    }
    // Fire the room-loud klaxon if any enemy was alerted
    if (anyAlerted) this.events.emit('room-alarm-klaxon');
  }

  propagateSound(x, y, radius) {
    if (this.debugAI) {
      this._soundEvents = this._soundEvents || [];
      this._soundEvents.push({ x, y, r: radius, t: this.time.now, duration: 1000 });
    }
    const r2 = radius * radius;
    for (const e of this.enemies.getChildren()) {
      if (!e.active || !e.alive) continue;
      if (e.state === ST.PATROL || e.state === ST.SUSPICIOUS) {
        if ((e.x - x) ** 2 + (e.y - y) ** 2 < r2) {
          e.onHearSound(x, y);
        }
      }
    }
  }

  // Find the closest alive enemy within range (used for auto-aim)
  findNearestEnemy(x, y, maxRange = 600) {
    let nearest = null;
    let minDist = maxRange;
    const list = [...this.enemies.getChildren()];
    if (this.boss && this.boss.alive) {
      list.push(this.boss);
    }
    for (const e of list) {
      if (!e.active || !e.alive) continue;
      const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    }
    return nearest;
  }

  // Same as findNearestEnemy, but restricted to a cone around `dir`. Used by
  // the melee gap-close so the lunge only ever commits toward something the
  // player is actually facing.
  findNearestEnemyInCone(x, y, dir, maxRange, coneRad) {
    let nearest = null;
    let minDist = maxRange;
    const list = [...this.enemies.getChildren()];
    if (this.boss && this.boss.alive) list.push(this.boss);
    for (const e of list) {
      if (!e.active || !e.alive) continue;
      const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (d >= minDist) continue;
      const da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(e.y - y, e.x - x) - dir));
      if (da > coneRad / 2) continue;
      minDist = d;
      nearest = e;
    }
    return nearest;
  }

  // ── Room-loud klaxon ─────────────────────────────────────────────────────
  // (The legacy per-room reinforcement spawner was replaced by the arena
  //  wave-clear spawner in _tickArena.)

  _onFirstAlarm() {
    if (!this._roomLoud) {
      this._roomLoud = true;
      SFX.alarm();
      this.cameras.main.flash(160, 120, 0, 0, true);
      this.events.emit('show-banner', '⚠ DETECTED', '#ff2828');
    }
  }

  // ── Spawning ─────────────────────────────────────────────────────────────

  spawnEnemyAt(type, x, y, spec = {}) {
    // Horde mode: every enemy — room-initial, wave, surge, boss minion —
    // uses the aggressive swarm behavior. The stealth FSM stays dormant.
    spec.behavior = 'swarm';
    let enemy;
    if      (type === 'shooter')   enemy = new EnemyShooter(this, x, y, spec);
    else if (type === 'bomber')    enemy = new EnemyBomber(this, x, y, spec);
    else if (type === 'shielded')  enemy = new EnemyShielded(this, x, y, spec);
    else if (type === 'sniper')    enemy = new EnemySniper(this, x, y, spec);
    else if (type === 'swarmling') enemy = new EnemySwarmling(this, x, y, spec);
    else                           enemy = new EnemyGrunt(this, x, y, spec);
    // Tag the archetype. Nothing recorded which class an enemy was, so anything
    // wanting to treat types differently after the fact — scoring, and the
    // credits/achievements planned on top of it — had only `instanceof` to go
    // on. One assignment at the single construction site keeps it honest.
    enemy.enemyType = type;
    if (spec.elite) this._makeElite(enemy);
    // Room modifier speed (FRENZY): stacks on top of the elite's adjusted speed.
    const sm = this.arenaCfg?.speedMult;
    if (sm) enemy.cfg = { ...enemy.cfg, speed: enemy.cfg.speed * sm };
    // Endless sector ramp: stacks on top of everything above (campaign leaves
    // both multipliers at 1, so this is a no-op there).
    if (this.enemyHpMult !== 1 || this.enemySpeedMult !== 1) {
      enemy.hp    = Math.round(enemy.hp * this.enemyHpMult);
      enemy.hpMax = enemy.hp;
      enemy.cfg   = { ...enemy.cfg, speed: enemy.cfg.speed * this.enemySpeedMult };
    }
    // Swarmlings must stay escapable: cap their effective (post-modifier) speed
    // just under the player so FRENZY / endless scaling can't make the "dash
    // through the pack" fodder outrun you outright.
    if (type === 'swarmling') {
      const cap = PLAYER.speed * 0.95;
      if (enemy.cfg.speed > cap) enemy.cfg = { ...enemy.cfg, speed: cap };
    }
    enemy.coverRegistry = this.coverRegistry;
    this.enemies.add(enemy);
    this.physics.add.collider(enemy, this.walls);
    this.roomManager.registerEnemy();
    return enemy;
  }

  // Upgrade a spawned enemy to an "elite": bigger, much tankier, tinted, and it
  // always drops a health orb (handled in the enemy-died listener). Defaults
  // reproduce the standard gold elite; the mini-boss passes heavier opts.
  _makeElite(enemy, opts = {}) {
    const { hpMult = 2.5, scale = 1.4, tint = 0xffd040, speedMult = 0.9 } = opts;
    enemy._elite = true;
    enemy.hp = Math.round(enemy.hp * hpMult);
    enemy.hpMax = enemy.hp;
    enemy._baseScale = scale;
    enemy.setScale(scale);
    enemy.setTint(tint);
    // Grow the physics body proportionally + slow it to match the heftier look.
    const r = Math.round(enemy.cfg.radius * (0.6 + scale * 0.55));
    enemy.cfg = { ...enemy.cfg, radius: r, speed: enemy.cfg.speed * speedMult };
    enemy.body.setCircle(r, enemy.width / 2 - r, enemy.height / 2 - r);
  }

  // Spawn a cluster of swarmlings around a point (the fodder pack).
  _spawnSwarmlingPack(cx, cy) {
    const cfg = ENEMY.swarmling;
    const n = Phaser.Math.Between(cfg.packMin, cfg.packMax);
    for (let i = 0; i < n; i++) {
      const ox = cx + Phaser.Math.Between(-40, 40);
      const oy = cy + Phaser.Math.Between(-40, 40);
      this.spawnEnemyAt('swarmling', ox, oy, {});
    }
    return n;
  }

  // Spawn at random room edge — used for boss minions (always alerted)
  spawnEnemyRandom(type) {
    const spec = this.roomSpec;
    if (!spec) return;
    const { w, h } = spec.bounds;
    const edges = [
      { x: 80,     y: Phaser.Math.Between(80, h - 80) },
      { x: w - 80, y: Phaser.Math.Between(80, h - 80) },
      { x: Phaser.Math.Between(80, w - 80), y: 80 },
      { x: Phaser.Math.Between(80, w - 80), y: h - 80 },
    ];
    let best = edges[0], bestDist = -1;
    for (const e of edges) {
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d > bestDist) { bestDist = d; best = e; }
    }
    // No patrol (spawn alerted) — empty spec means state starts as ALERT
    return this.spawnEnemyAt(type, best.x, best.y, {});
  }

  /**
   * @param {object} [opts]  `encounter` forces which rung of the ladder this
   *   Vader is, instead of deriving it from `sector`. The debug proving ground
   *   passes it so a boss can be examined outside an endless run — without it,
   *   spawning him anywhere else produced an UNSCALED Vader with no mechanics
   *   at all, which is the opposite of what a boss-testing tool is for.
   */
  spawnBoss(bx, by, opts = {}) {
    this.boss = new Boss(this, bx, by);

    // Endless meets Vader repeatedly, so each one has to be harder than the
    // last or the fourth boss sector is a victory lap. Scaled AFTER
    // construction and on both hp and hpMax together: the phase thresholds are
    // ratios (BOSS.phase2/phase3), so raising both leaves the three-phase
    // structure and its music cues exactly as authored. Linear in the boss
    // number rather than compounding — compounding makes boss 2 trivial and
    // boss 5 impossible.
    if (this.mode === 'endless' || opts.encounter) {
      const n = opts.encounter ?? Math.max(1, Math.floor(this.sector / ENDLESS.bossEvery));
      const mult = 1 + ENDLESS.bossHpStep * (n - 1);
      this.boss.hpMax = Math.round(this.boss.hpMax * mult);
      this.boss.hp = this.boss.hpMax;

      // He withdraws instead of dying, and hardens each time.
      this.boss._retreats = true;
      this.boss._encounter = n;

      // One more mechanic per encounter, in a fixed order so a player learns
      // the ladder rather than being surprised at random. Every one of them is
      // built from behaviour the Boss or the scene already has — that is what
      // keeps "weirder every time" from meaning a new boss written from scratch.
      const gained = ENDLESS.bossMechanics.slice(0, n);
      this.boss._mechanics = gained.map((m) => m.id);

      const MECH = ENDLESS.bossMech;
      for (const m of gained) {
        if (m.id === 'guard')       this._bossGuard = 3;
        if (m.id === 'sunder')      this.boss._sunderMs = 5200;
        if (m.id === 'legion')      this.boss._legion = true;
        if (m.id === 'reflect')     this.boss._reflectEvery = MECH.reflectEveryMs;
        if (m.id === 'blackout')    this.boss._blackoutEvery = MECH.blackoutEveryMs;
        if (m.id === 'afterimages') this.boss._afterimageEvery = MECH.afterimageEveryMs;
        if (m.id === 'disarm')      this.boss._disarmEvery = MECH.disarmEveryMs;
      }
      // Each clock starts at a FULL interval rather than at zero, so nothing
      // fires on the first frame of the encounter. Being disarmed before the
      // fight has started is not a surprise, it is a bad spawn.
      this.boss._reflectT    = this.boss._reflectEvery;
      this.boss._blackoutT   = this.boss._blackoutEvery;
      this.boss._afterimageT = this.boss._afterimageEvery;
      this.boss._disarmT     = this.boss._disarmEvery;
      this.boss._sunderT = this.boss._sunderMs || 0;
      this._equipBossKit(this.boss, n);

      // Announce which Vader this is and what he brought. The newest mechanic
      // gets named on its own — being told exactly what changed is what makes
      // the escalation legible rather than just "he feels harder now".
      const newest = gained[gained.length - 1];
      this.events.emit('show-banner', n === 1 ? 'DARTH VADER' : `VADER — WOUND ${n - 1}`, '#ff2828');
      if (newest && n > 1) {
        this.time.delayedCall(1600, () =>
          this.events.emit('score-medal', `${newest.name} — ${newest.desc}`, 0, '#ff5050'));
      }
      if (this._bossGuard) {
        this.time.delayedCall(900, () => { this.bossSpawnMinions(); this._bossGuard = 0; });
      }

      // He speaks EVERY encounter, unlike a nemesis — six times in a run at
      // most, and he is the only character the player meets again by design.
      // The first line is fixed in the pool: it is the one meeting everyone
      // gets, and it should always be the same first impression.
      const card = this._vaderDialogue('vader-arrive');
      if (card) this.time.delayedCall(1100, () => this.queueDialogue(card));
    }

    this.physics.add.collider(this.boss, this.walls);
    // NOTE: boss is deliberately NOT registered with roomManager — it isn't
    // in this.enemies, and registering it skewed the alive count that
    // room-cleared relies on. The boss room ends via boss-died → victory().
    this.fx.shake(0.012, 400);
    duckMusic(0.4, 800);
  }

  /**
   * AFTERIMAGES: 1-hp copies of Vader that swing at you.
   *
   * Built from the enemy pool rather than from new AI — they are ordinary melee
   * grunts wearing his silhouette, which is enough, because the mechanic is
   * about TARGETING, not about a new fight. They cost nothing to kill; the cost
   * is the second spent working out which one to hit.
   *
   * They must wear HIS sprite. The first version tinted the grunt art and the
   * screenshot answered "which one is he?" instantly — a mechanic that reads
   * wrong is not a mechanic. The texture is re-asserted every frame in
   * `_tickNemesis` because the grunt AI animates over the top of it.
   */
  /**
   * Put an afterimage's collision circle back on its sprite.
   *
   * `setTexture` swaps a 20x20 grunt frame for a 40x40 boss frame, and the
   * arcade body keeps the offset computed for the old one. Needed at spawn AND
   * on every re-assert, because the grunt AI keeps animating its own texture
   * back and the swap happens again.
   */
  _fitAfterimageBody(e) {
    const r = e.cfg?.radius ?? 18;
    e.body?.setCircle(r, e.width / 2 - r, e.height / 2 - r);
  }

  _spawnAfterimages(boss, n = 3) {
    this.events.emit('show-banner', 'AFTERIMAGES', '#c0c0ff');
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rng.boss.float(0, Math.PI);
      const d = 150 + this.rng.boss.between(0, 90);
      const x = Phaser.Math.Clamp(boss.x + Math.cos(a) * d, 90, this.physics.world.bounds.width - 90);
      const y = Phaser.Math.Clamp(boss.y + Math.sin(a) * d, 90, this.physics.world.bounds.height - 90);
      const clone = this.spawnEnemyAt('grunt', x, y, {});
      if (!clone) continue;
      clone.hp = 1;
      clone.hpMax = 1;
      clone._afterimage = true;
      clone.setTint(0x30304a);
      clone.setAlpha(0.72);
      clone.hpBar?.setVisible(false);
      clone.threatRing?.setVisible(false);   // the REAL one keeps its ring
      clone.anims?.stop();
      clone.setTexture('boss');
      clone.setScale(1);
      clone.weaponSprite?.setVisible(false);

      // RE-FIT THE BODY. `setTexture` swaps a 20x20 grunt frame for a 40x40
      // boss frame, and the arcade circle keeps the offset computed for the old
      // one — so the hitbox ended up ~40px off the sprite. That is half of why
      // these "didn't do shit": they were colliding with the world somewhere
      // they were not drawn.
      this._fitAfterimageBody(clone);

      // And make them actually dangerous. They chase and swing on the grunt AI,
      // but a copy that cannot hurt you is scenery — the point of the mechanic
      // is that you must decide which one to deal with.
      clone.cfg = {
        ...clone.cfg,
        speed: (clone.cfg.speed || 150) * 1.15,
        meleeDamage: Math.round((clone.cfg.meleeDamage || 90) * 1.1),
      };
      this.fx.burst(x, y, 'purple', 8);
    }
  }

  /**
   * DISARM: the secondary is struck out of your hands and lands on the floor.
   *
   * Ammo is carried onto the pickup and restored on collection, so this costs
   * POSITION rather than resources. Refilling it would make being disarmed a
   * reward and leaving it empty would make it a punishment; neither is a
   * surprise.
   *
   * The drop is pushed clear of the player's own 90px pickup magnet. Dropped at
   * his feet it could land close enough to be re-collected on the spot, which
   * makes the whole mechanic a no-op for anyone fighting him at close range —
   * which is most people.
   */
  _disarmPlayer(boss) {
    const id = this.player.secondary;
    if (!id) return;                       // nothing to take
    const ammo = this.player.secondaryAmmo;
    this.player._equipNothing();

    const MIN_AWAY = 190;                  // > the 90px magnet, with room to spare
    let ang = Math.atan2(boss.y - this.player.y, boss.x - this.player.x);
    if (!Number.isFinite(ang)) ang = 0;
    const dist = Math.hypot(boss.x - this.player.x, boss.y - this.player.y);
    const reach = Math.max(MIN_AWAY, dist + 70);
    const b = this.physics.world.bounds;
    const x = Phaser.Math.Clamp(this.player.x + Math.cos(ang) * reach, 90, b.width - 90);
    const y = Phaser.Math.Clamp(this.player.y + Math.sin(ang) * reach, 90, b.height - 90);

    const wp = new WeaponPickup(this, x, y, id);
    wp._restoreAmmo = ammo;                // read by the pickup loop in update()
    this.weaponPickups.push(wp);

    this.events.emit('show-banner', 'DISARMED', '#ffd040');
    this.fx.burst(this.player.x, this.player.y, 'yellow', 14);
    this.fx.shake(0.014, 220);
  }

  spawnHealthOrb(x, y) {
    const g = this.add.graphics().setDepth(22);
    const r = HEALTH_ORB.radius;
    g.fillStyle(0x1060cc, 0.22); g.fillCircle(0, 0, r + 10);
    g.fillStyle(0x000010, 0.4);  g.fillEllipse(2, r * 0.7, r * 1.8, r * 0.5);
    g.fillStyle(0x004488, 1);    g.fillRoundedRect(-r * 0.55 + 1, -r + 1, r * 1.1, r * 1.9, r * 0.3);
    g.fillStyle(HEALTH_ORB.color, 1); g.fillRoundedRect(-r * 0.55, -r, r * 1.1, r * 1.9, r * 0.3);
    g.fillStyle(0x40b8ff, 0.6);  g.fillRoundedRect(-r * 0.42, -r * 0.85, r * 0.84, r * 1.5, r * 0.25);
    g.fillStyle(0x003366, 1);    g.fillRect(-r * 0.22 + 1, -r * 1.15 + 1, r * 0.44, r * 0.22);
    g.fillStyle(0x1898e8, 1);    g.fillRect(-r * 0.22, -r * 1.15, r * 0.44, r * 0.22);
    g.fillStyle(0xccccdd, 1);    g.fillRect(-r * 0.28, -r * 1.28, r * 0.56, r * 0.16);
    g.fillStyle(0x90d8ff, 0.65); g.fillRoundedRect(-r * 0.46, -r * 0.88, r * 0.16, r * 1.45, r * 0.08);
    g.fillStyle(0x90d8ff, 0.5);  g.fillCircle(-r * 0.1, r * 0.1, r * 0.12);
    g.fillCircle(r * 0.1, -r * 0.2, r * 0.09);
    g.fillStyle(0x006aaa, 0.7);  g.fillRect(-r * 0.08, -r * 0.5, r * 0.06, r * 0.9);
    g.fillRect(r * 0.02, -r * 0.5, r * 0.06, r * 0.9);
    g.setPosition(x, y);

    const orb = { gfx: g, x, y, life: HEALTH_ORB.lifeMs, pulse: 0 };
    this.healthOrbs.push(orb);
    // Landing bounce: spring in from oversized, then settle into idle pulse.
    g.setScale(1.8);
    this.tweens.add({
      targets: g, scaleX: 1, scaleY: 1, duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: g, scaleX: 1.18, scaleY: 1.18, duration: 400,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      },
    });
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  // ── Scene-owned event listeners ──────────────────────────────────────────
  //
  // Phaser REUSES the scene instance across `scene.start()`, and a scene's
  // `events` emitter is not cleared on shutdown. So every restart ran
  // bindEvents() again on an emitter that still held the previous run's
  // handlers, and they stacked: after three restarts one bolt ran the
  // enemy-hit handler three times for 3x120 damage, the melee finisher played
  // three impact cracks, and every kill scored three times.
  //
  // It also crashed. A stale handler kept a reference to the previous run's
  // destroyed decal RenderTexture, and clearing it threw
  // "Cannot read properties of null (reading 'gl')" from inside the Phaser
  // step — which kills the game loop, leaving the canvas frozen black while
  // DOM input and Web Audio carry on working.
  //
  // Removing by NAME would be wrong: HUDScene listens on this same emitter for
  // boss-start, boss-phase, boss-died and others, so `events.off('boss-phase')`
  // would silently take the HUD's handler with it. Each handler is tracked by
  // reference and removed individually.
  _on(event, fn) {
    (this._ownEvents = this._ownEvents || []).push([event, fn]);
    this.events.on(event, fn);
    return this;
  }

  _offOwnEvents() {
    for (const [event, fn] of this._ownEvents || []) this.events.off(event, fn);
    this._ownEvents = [];
  }

  bindEvents() {
    // Drop the previous run's handlers before adding this run's.
    this._offOwnEvents();

    this._on('player-fire', (angle) => {
      this.firePlayerPrimary(angle);
      this.propagateSound(this.player.x, this.player.y, 420);
      this._cameraPunch(1.008, 90);
    });
    this._on('player-dash-sound', (x, y) => {
      this.propagateSound(x, y, 160);
    });
    // Dash afterimage — a bright screen flash, a hand-drawn speed-streak
    // (a tiny texture scaled up reads as nothing, so this is drawn with
    // Graphics for a guaranteed-visible size), plus a trail of SOLID cyan
    // silhouette ghosts. setTintFill (not setTint) is critical here: setTint
    // multiplies onto the sprite's existing dark colors and barely shows;
    // setTintFill replaces the pixel colour outright for a real "was here"
    // afterimage. Doubles as the dash's i-frame tell.
    this._on('player-dash', () => {
      const p = this.player;
      const ang = p?.dashAngle ?? p?.facing ?? 0;
      const low = isLowQuality();
      this.cameras.main.flash(150, 130, 225, 255, true);
      this._cameraPunch(1.06, 160);

      // Big tapered speed-streak, drawn behind the player along the dash line.
      const streakLen = 150, streakW = 34;
      const g = this.add.graphics().setDepth(p.depth - 1).setBlendMode(Phaser.BlendModes.ADD);
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const perpX = -sin, perpY = cos;
      const tailX = p.x - cos * streakLen, tailY = p.y - sin * streakLen;
      const drawTaper = (alpha, w) => {
        g.fillStyle(0x80f0ff, alpha);
        g.beginPath();
        g.moveTo(p.x + perpX * w, p.y + perpY * w);
        g.lineTo(p.x - perpX * w, p.y - perpY * w);
        g.lineTo(tailX, tailY);
        g.closePath();
        g.fillPath();
      };
      drawTaper(0.55, streakW);
      drawTaper(0.8, streakW * 0.5);
      this.tweens.add({
        targets: g, alpha: 0,
        duration: 280, ease: 'Cubic.easeOut',
        onComplete: () => g.destroy(),
      });

      const stampGhost = () => {
        const pl = this.player;
        if (!pl?.active || !pl.isDashing) return;
        const ghost = this.add.image(pl.x, pl.y, pl.texture.key, pl.frame.name)
          .setOrigin(pl.originX, pl.originY)
          .setScale(pl.scaleX, pl.scaleY)
          .setFlipX(pl.flipX)
          .setDepth(pl.depth - 1)
          .setTintFill(0x60ecff)
          .setAlpha(low ? 0.55 : 0.85);
        this.tweens.add({
          targets: ghost, alpha: 0, scale: ghost.scaleX * 1.2,
          duration: 320, ease: 'Cubic.easeOut',
          onComplete: () => ghost.destroy(),
        });
      };
      stampGhost();
      // Dense stamps for a smooth continuous trail; kept on in low-quality
      // (fewer, lighter) instead of disabled entirely.
      this.time.addEvent({ delay: low ? 35 : 20, repeat: low ? 6 : 16, callback: stampGhost });
    });
    this._on('player-shot-missed', () => {
      this.player?.onShotMissed();
    });
    this._on('player-melee-cast', (dir, stage, finisher) => {
      this.performMeleeCast(dir, stage, finisher);
    });
    this._on('player-melee-land', (dir, stage, finisher) => {
      this.performMeleeLand(dir, stage, finisher);
    });
    this._on('player-fire-super', (angle) => {
      this.firePlayerSuper(angle);
      this.events.emit('room-alarm-klaxon');
      // Punchier than before: harder zoom kick + a brief slow-mo so the
      // super release lands with real weight (this is the loop's payoff beat).
      this._cameraPunch(1.05, 220);
      this._slowMo(0.6, 200);
    });
    this._on('player-fire-rifle', (angle) => {
      this.firePlayerRifle(angle);
      this.propagateSound(this.player.x, this.player.y, 560);
      this._cameraPunch(1.012, 100);
    });
    this._on('grenade-detonate',  (x, y, dmg, r) => this.detonateGrenade(x, y, dmg, r));
    this._on('grenade-cluster',   (x, y, z) => this.clusterSplit(x, y, z));
    this._on('shooter-fire',      (s, a)  => this.fireShooter(s, a));
    // His charge finally gets a floor telegraph. It had a windup and a scale
    // pulse and nothing you could read at a glance, which is what the player
    // meant by "he only charges but no lane light or anything".
    this._on('boss-charge-windup', (b, angle, ms) => {
      const len = BOSS.chargeSpeed * (BOSS.chargeDurationMs / 1000) * 0.8;
      this.spawnTelegraph({
        kind: 'lane', x: b.x, y: b.y, angle, len, width: 170,
        // ── THE RUSH AND THE THROW ARE THE CLOSEST PAIR HE HAS ────────────
        //
        // Both draw a crimson lane out of the same man with the same blade, and
        // both used the stock 620ms chevron cycle — so the only difference on
        // the floor was 20px of width. The chevrons here now run at the speed
        // HE will cross the lane (chargeDurationMs), and SABER THROW's run at
        // the speed the BLADE will; the rush is much the faster of the two, and
        // the difference is legible without reading either name. Geometry,
        // width and windup unchanged.
      }, { windupMs: ms, owner: b, kineticMs: BOSS.chargeDurationMs });
    });
    this._on('boss-spawn',        ()      => this.bossSpawnMinions());
    // VANISH is a REACTION now, not a rotation entry: Boss.preUpdate raises
    // this the moment the player has taken a big bite out of him inside a short
    // window. Cast directly rather than going through the rotation so it can
    // pre-empt whatever he was about to do — it is an escape.
    this._on('boss-wants-vanish', (b) => this._castBossMove(b, 'vanishslash'));
    // The close-range default. Same cast path, so it inherits the ownership
    // gate and cannot run on top of anything else.
    this._on('boss-wants-combo',  (b) => this._castBossMove(b, 'sabercombo'));

    // ── The charge's slam ────────────────────────────────────────────────
    // Windup paints the zone at the spot the rush actually stopped; the strike
    // resolves against that same zone a beat later. Two events rather than one
    // so the player gets a chance to leave.
    this._on('boss-slam-windup', (b, ms, radius) => {
      this.spawnTelegraph(
        { kind: 'circle', x: b.x, y: b.y, r: radius },
        // ── THE WIND-UP IS PART OF THE ATTACK ────────────────────────────
        //
        // His biggest commitment drew the same zone as everything else: an
        // outline, a fill that swept out, and then an explosion. It existed for
        // N milliseconds; it did not LOAD. `stress` opens fractures out of the
        // centre in staggered stages and brightens a core as the hold runs, so
        // the floor is visibly taking the strain and the last quarter is
        // unmistakably a man committing rather than a countdown expiring.
        // Radius, anchor, windup and the damage beat are all untouched.
        { windupMs: ms, owner: b, anchor: 'world', color: 0xff6030, stress: true },
      );
      // ...and the blade over his head is doing the same thing. A separate
      // additive layer that only reads his weapon's position — deliberately NOT
      // a scale mutation on the sprite, which is the trap that once grew his
      // saber into a 1100px slab.
      const glow = this.fx?.chargeGlow?.(b.weaponSprite, ms);
      this.time.delayedCall(ms + 90, () => glow?.stop?.());
      if (!areMoveNamesMuted()) this.events.emit('show-banner', 'SLAM', '#ff6030');
    });
    this._on('boss-slam', (b, at, radius) => {
      const p = this.player;
      const spot = at || { x: b.x, y: b.y };
      // 'overhead' — the heavy tier. This is the one attack in his kit whose
      // whole point is consequence, and it was resolving as the identical
      // 300ms ring the combo finisher and a whiffed rush into a wall both use.
      this.fx?.saberSlam?.(spot.x, spot.y, radius, 'overhead');
      this.fx?.shake?.(0.034, 380);
      if (p?.alive && Math.hypot(p.x - spot.x, p.y - spot.y) <= radius) {
        const a = Math.atan2(p.y - spot.y, p.x - spot.x);
        p.damage(BOSS.slamDamage, a);
        p.body?.setVelocity(Math.cos(a) * BOSS.slamKnockback, Math.sin(a) * BOSS.slamKnockback);
      }
    });

    // ── Vader's later mechanics ────────────────────────────────────────────
    // Each is a brief, readable event rather than a stat change, and each is
    // built from something already in the game. See ENDLESS.bossMechanics.

    // DEFLECTION. The flare is the tell; the window opens after it.
    this._on('boss-reflect-windup', (b) => {
      this.events.emit('show-banner', 'DEFLECTION', '#ff4040');
      this.fx.burst(b.x, b.y, 'red', 10);
      SFX.bossRoar?.();
      b.threatRing?.setAlpha(0.4);
    });
    this._on('boss-reflect-open', (b) => {
      this.fx.impactRing(b.x, b.y, 0xff3030);
      b.threatRing?.setAlpha(1);
    });

    // ── SUPER DEFLECTION ───────────────────────────────────────────────────
    // Three beats, and each one is a separate event so the sequence can be
    // read from outside — by the smoke test, and by anyone trying to work out
    // afterwards which half of it went wrong. The Boss owns the clocks (a
    // `delayedCall` on a boss who withdraws fires into the next sector); the
    // scene owns the effects, exactly as every other mechanic here works.

    // He has begun taking it. NO BANNER: 'DEFLECTION' is already on screen from
    // the stance and 'HE HAS YOUR POWER' follows about a second later, and three
    // banners inside three seconds is the boss getting busier rather than
    // clearer — the exact thing this pass is not supposed to do. Five pellets
    // visibly vanishing into a growing mass at his hand is a better sentence
    // than a word for it, so this beat is a shake and the FX per pellet.
    this._on('boss-super-absorb-begin', () => this.fx.shake(0.004, 120));

    // He has all of it and is about to hand it back. This beat exists purely as
    // anticipation: the orb spawns at his hands, so at point-blank range this
    // window IS the player's reaction time, and it is why the release is worth
    // a banner of its own.
    this._on('boss-super-charged', (b, n) => {
      this.events.emit('show-banner', 'HE HAS YOUR POWER', '#ff40ff');
      this.fx.superCharged?.(b.x, b.y, ENDLESS.bossMech.superReleaseMs);
      SFX.superCharged?.();
      this.fx.shake(0.006, 200);
    });

    // ...and it leaves.
    this._on('boss-super-return', (b, n) => {
      if (!this.player?.alive || !b.alive) return;
      const MECH = ENDLESS.bossMech;
      // A SNAPSHOT, taken now. Nothing about this round steers after release —
      // the entire promise of the mechanic is that moving works.
      const ang  = Math.atan2(this.player.y - b.y, this.player.x - b.x);
      const dist = Math.hypot(this.player.x - b.x, this.player.y - b.y);
      // Never spawned past the player. A fixed muzzle offset would put the orb
      // BEHIND someone standing on top of him, travelling away — which is
      // exactly the bug the old 50px green spawn had, where a close player
      // never got hit by their own deflected shot at all.
      const off = Math.min(BOSS.radius + 30,
                           Math.max(12, dist - PLAYER.radius - 50));
      const ox = b.x + Math.cos(ang) * off;
      const oy = b.y + Math.sin(ang) * off;
      // BOUNDED, and bounded on purpose. Not the sum of what it swallowed:
      // that number carries `player.dmgMult` and is unbounded by design. This
      // one is a flat schedule in pellets, so the punish is the same size on
      // encounter 1 and on a Vader six wounds deep.
      const dmg = Math.min(
        MECH.superReturnBase + MECH.superReturnPerPellet * n,
        MECH.superReturnDamageMax,
      );
      const orb = this.bossSuperOrbs.fire(ox, oy, ang, MECH.superReturnSpeed, dmg,
        MECH.superReturnRange, { owner: 'boss' });
      if (orb) {
        // The heading is stamped ONCE, here, and every later frame reads it
        // back rather than recomputing anything. `_tickSuperOrbs` rewrites the
        // velocity each frame from it, and the one thing that must not leak
        // into that rewrite is a fresh look at where the player now is. Storing the unit vector rather than re-deriving it
        // from the live velocity also means a frame that clips the speed to
        // zero cannot lose the direction.
        orb._hx = Math.cos(ang);
        orb._hy = Math.sin(ang);
        orb._ageMs = 0;           // ms since release: lifetime cap, and the
                                  // launch-freshness driver in `_tickSuperOrbs`
        // ── THE HITBOX MUST NOT FOLLOW THE SPEED ────────────────────────
        // `Bullet.fire` ends with `setScale(clamp(speed / 620, 1, 2.2), 1)`
        // and `Body.updateBounds` recomputes the body's width from |scaleX|.
        // At the old 600px/s flat speed the clamp was exactly 1 and this was
        // invisible; the canonical 1080 is well over the line and would
        // quietly stretch the approved 44px radius by 74%. The
        // tracer stretch is meaningless here anyway — the orb wears a whole
        // hand-drawn body — so it is cancelled on the frame it is applied.
        orb.setScale(1, 1);
      }
      // ── THE BLADE DID IT ───────────────────────────────────────────
      // His own saber crescent, on the throw line, with the handedness of the
      // sweep that is arriving at this exact frame — this handler IS the power
      // frame. Not a new effect and not part of the orb's (frozen) visual
      // system: it is the blade's own trail, and it exists so the eye is given
      // the CAUSE on the frame it is given the motion. Without it the launch
      // was a ball departing next to a man who happened to be moving.
      this.fx.saberSweep?.(b.x, b.y, ang, 104, b._sweepDir || 1);
      this.fx.burstDir(ox, oy, 'red', 14, ang, 90);
      // A hard white spray straight down the heading, so the very first frame
      // of flight already states a direction. The wake below takes two frames
      // to have any sampled history to draw, and without this the orb's first
      // moments were the one part of the flight with no motion language at all
      // — which is where the eye is, because it just changed state.
      this.fx.burstDir(ox, oy, 'white', 8, ang, 150);
      this.fx.impactRing(ox, oy, 0xff40ff);
      SFX.superRelease?.();
      this.fx.shake(0.010, 240);
      this.events.emit('boss-super-returned', b, n, dmg);
    });

    // LIGHTS OUT. Reuses the DARKNESS modifier's overlay wholesale.
    this._on('boss-blackout', (b, ms) => {
      this.events.emit('show-banner', 'LIGHTS OUT', '#8090ff');
      this.events.emit('set-darkness', true);
      this.fx.shake(0.012, 260);
      // Guarded on the scene still being live: a blackout that outlived the
      // fight would leave the next sector dark.
      this.time.delayedCall(ms, () => {
        if (this.scene.isActive()) this.events.emit('set-darkness', false);
      });
    });

    // AFTERIMAGES. Copies that swing and die in one hit; the real one is the
    // one with the health bar.
    this._on('boss-afterimages', (b, n) => this._spawnAfterimages(b, n));

    // DISARM. The secondary lands on the floor with its ammo intact. Taking
    // something away permanently would be a punishment; making you go and get
    // it back is a decision.
    this._on('boss-disarm', (b) => this._disarmPlayer(b));
    this._on('boss-charge',       ()      => this.fx.shake(0.015, 200));
    this._on('boss-hit', (boss, amount) => {
      this.fx.hitFlash(boss);
      // NO DAMAGE NUMBER HERE. The boss already gets one, from `enemy-hit`.
      //
      // `Boss.damage` emits `boss-hit` and then calls `super.damage`, which is
      // `Enemy.damage`, which emits `enemy-hit` — so every single hit on Vader
      // was printing the SAME figure twice: gold `#ffd166` at the 'major' tier
      // from here, and orange `#ff8020` at 'minor' from the enemy handler, plus
      // the CRIT label. Probed directly, one `boss.damage(690)` produced three
      // labels. That duplicate is what "ordinary numbers are too strong and
      // cluster on the boss body" actually was: not one number too large, but
      // two numbers for one hit, the louder of them on the crit-and-super tier
      // at 34px against 21, held 780ms against 420.
      //
      // Deleting this line is the whole fix. What survives is the enemy path,
      // which is already the tiered, pooled, telegraph-aware one — it draws the
      // ordinary figure at 'minor' and still raises a full-strength CRIT above
      // it, which is exactly the hierarchy the boss fight was missing.
      //
      // The lethal hit is the one exception: `Boss.damage` intercepts above and
      // returns before `super.damage`, so the wounding blow prints no number.
      // It arrives with the retreat animation and a HE WILL RETURN banner, and
      // does not need one.
      //
      // Everything else in this handler stays — the flash, the burst, the
      // shake, the slow-mo spike and the sound are how a boss hit feels.
      this.fx.burst(boss.x, boss.y, 'red', 6);
      this.fx.shake(0.005, 60);
      // Big-damage spike → slow-mo ramp instead of a binary freeze. Shorter
      // and shallower than the takedown's slow-mo so heavy combos still flow.
      if (amount >= 400) this._slowMo(0.5, 240);
      SFX.bossHit();
    });
    this._on('boss-phase', (p) => {
      setBossPhase(p);
      // LEGION: the room fills as he falls.
      if (this.boss?._legion) this.bossSpawnMinions();
    });
    this._on('boss-died', (boss) => {
      this.boss = null;
      this.roomManager.onEnemyDied(); // consistent tracking
      // Flat, and deliberately not chain-multiplied: Vader is one kill at the
      // end of a fight with nothing else alive to chain off, so a multiplier
      // here would only ever pay x1 and would read as a bug. It DOES scale with
      // which Vader this was, matching the HP he was given.
      this._bossesKilled = (this._bossesKilled || 0) + 1;
      const bossPay = Math.round(SCORE.boss * (1 + ENDLESS.bossScoreStep * (this._bossesKilled - 1)));
      this.addScore(bossPay, boss.x, boss.y - 60);
      this.events.emit('score-medal', 'VADER DOWN', bossPay, '#ff2828');
      this.fx.burst(boss.x, boss.y, 'yellow', 40);
      this.fx.burst(boss.x, boss.y, 'red', 40);
      this.fx.shake(0.025, 500);
      SFX.bossDie();

      this.ledger.vader.encounters = (this.ledger.vader.encounters || 0) + 1;
      this.ledger.vader.lastOutcome = 'killed';
      const last = this._vaderDialogue('vader-slain');
      if (last) this.time.delayedCall(1100, () => this.queueDialogue(last));

      if (this.mode === 'endless') {
        // The climb goes ON past Vader — he is a milestone, not the end. Open
        // the exit the boss room now carries and hand control back.
        this._enemiesCleared = true;
        this.time.delayedCall(1400, () => {
          this.events.emit('show-banner', 'THE WAY IS OPEN', '#40ff90');
          this._maybeCompleteRoom();
        });
      } else {
        this.time.delayedCall(800, () => this.victory());
      }
    });
    // Vader withdrawing. The endless counterpart to boss-died: he pays out, the
    // exit opens, and the run carries on with him still out there.
    this._on('boss-wounded', (boss) => {
      this.boss = null;
      this.roomManager.onEnemyDied();
      this._bossesKilled = (this._bossesKilled || 0) + 1;
      const pay = Math.round(SCORE.boss * (1 + ENDLESS.bossScoreStep * (this._bossesKilled - 1)));
      this.addScore(pay, boss.x, boss.y - 60);
      this.events.emit('score-medal', 'VADER DRIVEN OFF', pay, '#ff2828');
      this.fx.burst(boss.x, boss.y, 'red', 30);
      this.fx.shake(0.018, 400);
      SFX.bossDie?.();
      this._enemiesCleared = true;

      // Record BEFORE the line is chosen: "you made me withdraw" has to be able
      // to see the withdrawal it is about.
      this.ledger.vader.encounters = (this.ledger.vader.encounters || 0) + 1;
      this.ledger.vader.lastOutcome = 'wounded';
      const hurt = this._vaderDialogue('vader-wounded');

      this.time.delayedCall(1500, () => {
        this.events.emit('show-banner', 'HE WILL RETURN', '#ff8080');
        if (hurt) this.queueDialogue(hurt);
        this._maybeCompleteRoom();
      });
    });

    this._on('boss-phase-crack', (bx, by, phase) => {
      this._spawnVaderGroundCrack(bx, by, phase);
      this.fx.shake(phase >= 3 ? 0.022 : 0.015, 300);
      this.cameras.main.flash(180, 255, 60, 60, true); // flash red
    });
    this._on('enemy-hit', (enemy, amount) => {
      this.fx.hitFlash(enemy);
      // Hurt-frame swap: jump to the "hurt" texture frame (frame 3 in the
      // 4-frame sheet) for ~140ms, then let the AI's anim system reclaim it.
      // This adds visual variety beyond the white tint flash.
      if (enemy.anims) enemy.anims.stop();
      enemy.setFrame(3);
      this.time.delayedCall(140, () => {
        if (enemy.active && enemy.alive) {
          const prefix = enemy._animPrefix;
          if (this.anims.exists(`${prefix}-idle-front`)) enemy.play(`${prefix}-idle-front`);
        }
      });
      // Where the label goes is the DRAWN top of the sprite, not the collider.
      // `cfg.radius` is a physics constant that `_makeElite` grows on a
      // different curve than the art, so on a big nemesis a number anchored to
      // it lands inside the chest — the same defect the hp bar had, with the
      // same fix.
      const head = enemy._headroom?.() ?? enemy.cfg.radius;

      // CRIT callout on big hits — one-shot territory for most enemies.
      const crit = amount >= 400;
      if (crit) {
        // ONE "CRIT!" PER CONTACT AREA — area, not enemy.
        //
        // A melee finisher or a super lands several qualifying hits inside a
        // couple of frames, and identical labels superimposed smear into one
        // illegible glyph; three at once was measured on the pre-change build.
        // Re-punch the live one instead: the same information, louder, where
        // the eye already is.
        //
        // The key is a POSITION, not the enemy. Keying per-enemy left the
        // stacking in place whenever two enemies half a body apart both crit —
        // visible in a melee-crowd screenshot as "CRIT!" printed through
        // "CRIT!" on two different foes. The player reads a place on the
        // screen, not an entity id, so the coalescing has to agree with that.
        //
        // The DAMAGE NUMBERS below stay discrete. Merging those would erase the
        // per-impact feedback that makes a finisher feel like several hits.
        const now = this.time.now;
        const last = this._critLabel;
        const near = last && Math.hypot(enemy.x - last.x, enemy.y - last.y) < 96;
        if (!near || now - (last.at || 0) >= 380
            || !this.fx.repunchDamage(last.obj, last.tag)) {
          const obj = this.fx.damageNumber(enemy.x, enemy.y - head - 30,
            'CRIT!', '#ffe040', 'major');
          this._critLabel = { obj, tag: obj?._dmgTag, x: enemy.x, y: enemy.y, at: now };
        } else {
          this._critLabel.at = now;
        }
        this.fx.damageNumber(enemy.x + 18, enemy.y - head,
          Math.round(amount), '#ff8020', 'minor');
        // Super hits far from the player shake much less than close ones.
        this.fx.shake(0.005 * this._superShakeFalloff(enemy), 70);
      } else {
        this.fx.damageNumber(enemy.x, enemy.y - head, Math.round(amount));
        // Chipping a tank (elite or just high-HP): the old 0.002 shake was
        // invisible (and now scaled down further). Give it a real visible bite —
        // a bright impact ring — so hitting armor reads as landing, not whiffing.
        if (enemy._elite || (enemy.hpMax || 0) >= 500) this.fx.impactRing(enemy.x, enemy.y, 0xffd8a0);
      }
      this.fx.burst(enemy.x, enemy.y, 'red', crit ? 8 : 4);
      // A cluster munition plays its own explosion at the detonation site, so
      // the generic hit beep would only smear underneath it. _clusterImpact
      // raises this flag for the duration of its damage() call.
      if (!this._suppressHitSfx) SFX.hit();
    });
    this._on('enemy-died', (enemy) => {
      // ── HOTLINE-MIAMI KILL JUICE ──────────────────────────────────────
      // Combo counter first — chain kills within 2s show on screen — so the
      // rest of this beat can read the LIVE streak and scale with it.
      this._tickKillCombo();
      const comboMult = 1 + 0.06 * Math.min((this._comboCount || 1) - 1, 6); // up to ~1.36x

      // Threat scale: a kill pops bigger the bigger the thing was (swarmling
      // 0.7 through a 1.8-scale mini-boss), instead of every death being
      // identical regardless of size/danger.
      const threatScale = enemy._baseScale || 1;

      // Big blood burst + persistent splatter pool that stays for the room.
      this.fx.burst(enemy.x, enemy.y, 'red', Phaser.Math.Clamp(Math.round(26 * threatScale), 14, 46));
      this.spawnBloodSplatter(enemy.x, enemy.y);
      // Radial death glow — bright orange ring expands and fades.
      this._spawnDeathGlow(enemy.x, enemy.y, enemy.cfg.radius * threatScale);
      // Elites and the mini-boss get a real explosion on top of the particles
      // so a capstone kill reads bigger than fodder.
      if (enemy._elite || enemy._miniBoss) this.fx.explosion(enemy.x, enemy.y, 1.0 + 0.4 * threatScale);
      // Shake + camera punch scale with both threat and the current combo.
      // Base trimmed (0.009 -> 0.005) so ordinary grunt kills barely nudge the
      // camera; big/elite kills and long combos still ramp up.
      // For super kills, drop the combo ramp and fall off with distance instead
      // — a super wiping a spread crowd shouldn't ring the camera on far kills.
      const killShakeScale = this._superHitCtx
        ? this._superShakeFalloff(enemy)
        : threatScale * comboMult;
      this.fx.shake(0.005 * killShakeScale, Math.round(110 * Math.min(threatScale, 1.3)));
      this._cameraPunch(1.04 + 0.015 * (threatScale - 1) + 0.01 * (comboMult - 1), 220);

      // Same-frame multi-kill tracking (distinct from the 2s combo streak —
      // several kills can resolve in one tick during a super wipe). Coalesce
      // the hitstop to one pause/resume per frame instead of N redundant
      // ones, and fire a single bigger beat once 3+ land together.
      const now = this.time.now;
      if (this._lastKillFrameTime !== now) {
        this._lastKillFrameTime = now;
        this._killsThisFrame = 0;
        this._multiKillFired = false;
      }
      this._killsThisFrame++;
      if (this._killsThisFrame === 1) {
        // Universal hit-pause on every kill — 45ms freeze for crisp impact.
        this.physics.world.pause();
        this.time.delayedCall(45, () => this.physics.world.resume());
      }
      if (this._killsThisFrame >= 3 && !this._multiKillFired) {
        this._multiKillFired = true;
        this._slowMo(0.7, 160);
        this.events.emit('show-banner', 'MULTIKILL', '#ff8020');
      }

      // BLOOD PACT (upgrades.js): kills restore HP, scaled up the more hurt you
      // are, so it is a comeback tool rather than a top-up. Single consumption
      // point for player.killHeal.
      //
      // The first version of this read as completely broken in play, and
      // fairly. Regen is 100 HP/sec after a 4s lull (config.js), so between
      // engagements you are at full health — where the heal clamped to hpMax
      // and did precisely nothing. The floating number was also gated behind
      // being hurt, so there was no feedback either. You killed, and nothing
      // happened, over and over.
      //
      // So: overflow into shield when health is full, and ALWAYS show the
      // number. A card you cannot see working is a card that is not working.
      if (this.player?.alive && this.player.killHeal > 0) {
        const missing = 1 - this.player.hp / this.player.hpMax;
        const amount = this.player.killHeal * (0.5 + missing);
        const room = this.player.hpMax - this.player.hp;
        const healed = Math.min(room, amount);
        const overflow = amount - healed;

        if (healed > 0) this.player.hp += healed;
        // Overflow banks as shield so a kill at full health still pays out.
        if (overflow > 0) this.player.addShield(overflow);

        this.events.emit('player-hp-changed');   // what the HUD actually listens for
        this.fx.damageNumber(
          this.player.x, this.player.y - 52,
          `+${Math.round(amount)}`,
          overflow > healed ? '#90d8ff' : '#40ff90',   // blue when banking shield
        );
      }

      // VOLATILE nemesis: it detonates where it fell. This is the trait that
      // answers melee-spam — the finisher that killed it was delivered from
      // inside the blast radius, so the kill has to be followed by a dash out
      // rather than by standing still. Reuses the grenade blast, so it damages
      // the player and other enemies exactly as any explosion does.
      if (enemy._volatile) {
        const v = enemy._volatile;
        this._volatileBlast(enemy.x, enemy.y, v.damage, v.radius);
      }

      // Run-wide kill counter (drives the HUD readout + records)
      this.runKills = (this.runKills || 0) + 1;
      this.events.emit('kills-update', this.runKills);

      // Score. Read AFTER _tickKillCombo above, so the kill that extends a
      // chain is paid at the multiplier it just earned rather than the previous
      // one — the on-screen "x3!" and the points must agree or the chain reads
      // as arbitrary.
      this.addScore(this.scoreForEnemy(enemy), enemy.x, enemy.y - 30);
      this.roomManager.onEnemyDied();

      // Killing a nemesis settles the grudge: it leaves the ledger for good, and
      // the payout is GUARANTEED rather than rolled. A drop you might not get is
      // not a reward for finally cornering the thing that has been hunting you —
      // it is one more coin flip, and the run already has plenty.
      // Any nemesis, not only a remembered one — a stranger killed on sight
      // still leaves a hole in the roster for someone to fill. That is what
      // keeps succession the norm and a fresh stranger the exception.
      if (enemy._nemesis) {
        // `recordKill` RETURNS the entry it just removed, which is the only
        // moment the pre-death state still exists — read it for the last words
        // before it is gone. Only a remembered one gets them, same rule as the
        // arrival card.
        const gone = recordKill(this.ledger, enemy._nemesis, this.sector || 1);
        if (gone) {
          const line = pickLine('nemesis-kill', nemesisContext(gone),
            this.ledger.spoken, this.rng.nemesis);
          if (line) {
            this.time.delayedCall(900, () => this.queueDialogue({
              bust: `bust-${gone.base}`,
              name: displayName(gone),
              color: enemy._nemesis.tint,
              sub: 'DOWN',
              text: line.text,
              traits: gone.traits,
            }));
          }
        }
        const scars = enemy._nemesis.scars || 0;
        if (scars >= 2) {
          this.spawnWeaponChoice(enemy.x, enemy.y, 'TROPHY');
        } else if (scars >= 1) {
          this.spawnHealthOrb(enemy.x, enemy.y);
          this.player.addShield(300);
          this.fx.pickupSparkle(enemy.x, enemy.y, 10);
        }
      }

      // Elites always drop sustain; everyone else rolls the standard chance.
      if (enemy._elite || this.rng.drops.chance(HEALTH_ORB.dropChance)) this.spawnHealthOrb(enemy.x, enemy.y);
    });
    this._on('player-hurt', (amount) => {
      // Credit the living nemesis, if there is one. Threading a source argument
      // through every player.damage() call site — contact, melee, bullets, the
      // bomber blast, Vader — would be four files of plumbing and one missed
      // call site away from being wrong anyway. At most one nemesis is alive at
      // a time, so attributing to it is near-exact; the one imprecision is that
      // a SUMMONER gets credit for damage its swarmlings dealt, which is the
      // right answer regardless.
      for (const e of this.enemies.getChildren()) {
        if (e.alive && e._nemesis) { e._drewBlood = true; break; }
      }

      this.fx.shake(0.008, 110);
      this.cameras.main.flash(120, 255, 80, 80, true);
      this.fx.hitFlash(this.player);
      this.fx.damageNumber(this.player.x, this.player.y - 40, Math.round(amount || 0), '#ff4040');
      this.fx.burst(this.player.x, this.player.y, 'red', 6);
    });
    this._on('player-dead', () => {
      // The heaviest beat in the game short of the boss dying: a deep slow-mo
      // crawl, a sustained blood-red flash, a hard zoom kick, and a low death
      // thud — unmistakably different from an ordinary kill.
      this.fx.burst(this.player.x, this.player.y, 'red', 36);
      this.fx.shake(0.032, 520);              // pre-global-scale; nets ~0.019
      this.cameras.main.flash(420, 190, 16, 16, true);
      this._cameraPunch(1.11, 460);
      this._slowMo(0.2, 850);                 // deeper + longer crawl
      SFX.hurt();
      this.time.delayedCall(110, () => SFX.bossSlam?.()); // heavy death thud
      this.time.delayedCall(900, () => this._handlePlayerDeath());
    });
    this._on('grunt-melee', (g) => this.fx.burst(g.x, g.y, 'red', 6));

    // Room cleared logic: in wave mode, exits open only once all waves are done
    // (arenaActive flips false in _onArenaCompleted).
    this._on('room-cleared', (spec) => {
      if (this.arenaActive) return;
      if (spec.boss) return;
      this._enemiesCleared = true;
      this.time.delayedCall(400, () => this._maybeCompleteRoom());
    });

    // A terminal finished hacking → trigger support drop and escalate wave!
    this._on('terminal-hacked', (terminal) => {
      this._terminalsHacked += 1;
      // Terminals are the one wholly optional risk in the room — slicing one
      // buys you an immediate surge. Paying score for it is what makes taking
      // that risk a scoring decision rather than pure charity.
      this.addScore(SCORE.terminal, terminal.x, terminal.y - 40);
      this.events.emit('objective-update', this._terminalsHacked, this._terminalsTotal);
      this.fx.shake(0.004, 80);
      
      // Spawn support drop
      if (terminal) {
        this.spawnTerminalSupportDrop(terminal);
      }
      
      // Risk/reward: slicing a terminal escalates the horde immediately.
      this.triggerSurge();
    });

    // Mini-game completion bridges to the terminal.
    this._on('hack-success', (terminal) => {
      terminal?.complete();
      this._activeHackTarget = null;
    });
    // Mini-game failure → trip the room alarm just like blowing your cover.
    this._on('hack-fail', () => {
      // Alert every enemy in the room
      for (const e of this.enemies.getChildren()) {
        if (e.active && e.alive && (e.state === ST.PATROL || e.state === ST.SUSPICIOUS)) {
          e._triggerAlarm(true);
        }
      }
    });

    // Boss start event forwarded from loadRoom
    this._on('boss-start', () => {
      this.events.emit('show-banner', 'VADER APPROACHES', '#ff2828');
      this._startBossFlicker();
    });
  }

  // ── Lives / death ─────────────────────────────────────────────────────────

  _handlePlayerDeath() {
    this.lives -= 1;
    this.events.emit('lives-changed', this.lives);

    if (this.lives <= 0) {
      this.defeat();
      return;
    }

    // Who put you down. Captured HERE, before the respawn clears the arena
    // state — and only on the respawn path: `defeat()` ends the run and hands
    // off to GameOverScene, which is not a place to pause for a conversation.
    // Attribution is the same lookup `player-hurt` does; at most one nemesis is
    // alive at a time, so it is near-exact.
    let killer = null;
    if (this.boss?.alive) {
      // Vader gets NO card here — only the record. Dying to him mid-fight and
      // then being made to sit through a speech before you can get back up is
      // the pace cost with none of the payoff, and he has a line about it
      // waiting for the next time he walks in, which is where it lands better.
      this.ledger.vader.killedYou = (this.ledger.vader.killedYou || 0) + 1;
    } else {
      const nem = this.enemies.getChildren().find((e) => e.alive && e._nemesis);
      const entry = nem && this.ledger.entries.find((x) => x.id === nem._nemesis.ledgerId);
      if (entry) {
        const line = pickLine('nemesis-killed-you', nemesisContext(entry),
          this.ledger.spoken, this.rng.nemesis);
        if (line) {
          killer = {
            bust: `bust-${entry.base}`,
            name: displayName(entry),
            color: nem._nemesis.tint,
            sub: 'YOU DIED HERE',
            text: line.text,
            traits: entry.traits,
          };
        }
      }
    }

    // Respawn at room entrance after short pause
    this.time.delayedCall(400, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        // Revive player — restore to the player's current hpMax (an ARMOR
        // PLATING upgrade raises hpMax, and a revive shouldn't undo that).
        this.player.hp       = this.player.hpMax;
        this.player.alive    = true;
        this.player.ammo     = PLAYER.ammoMax;
        this.player.ammoTimers = [];
        this.player.superCharge = 0;
        this.player.setAlpha(1);
        this.player.setScale(1);
        this.player.setActive(true).setVisible(true);
        const spawn = this.roomSpec?.spawn ?? { x: 200, y: 200 };
        this.player.setPosition(spawn.x, spawn.y);
        this.player.setVelocity(0, 0);
        this.player.play('mando-idle-front');
        this.events.emit('player-hp-changed');
        this.events.emit('player-ammo-changed');
        this.events.emit('player-super-changed');
        this.cameras.main.fadeIn(300, 0, 0, 0);
        // After the respawn is on screen, not during the fade — a card that
        // opens mid-fade leaves the camera black behind it.
        if (killer) this.time.delayedCall(500, () => this.queueDialogue(killer));
      });
    });
  }

  // ── Firing helpers ────────────────────────────────────────────────────────

  firePlayerPrimary(angle) {
    // Spawn from the gun muzzle: player center + a barrel-length offset along the
    // (now unified) aim angle, so bolts leave the tip of the weapon.
    const bx = this.player.x + Math.cos(angle) * (PLAYER.radius + 12);
    const by = this.player.y + Math.sin(angle) * (PLAYER.radius + 12);
    const spread = Phaser.Math.DegToRad(PLAYER.pelletSpreadDeg);
    const half   = (PLAYER.pelletCount - 1) / 2;
    for (let i = 0; i < PLAYER.pelletCount; i++) {
      const a = angle + (i - half) * (spread / Math.max(1, PLAYER.pelletCount - 1));
      this.playerBullets.fire(bx, by, a, PLAYER.pelletSpeed, PLAYER.pelletDamage * this.player.dmgMult, PLAYER.pelletRange, { owner: 'player' });
    }
    this.fx.muzzleFlash(bx, by, angle);
    this.fx.ejectCasing(bx, by, angle);

    // Recoil pushback
    if (this.player.body) {
      this.player.body.velocity.x -= Math.cos(angle) * 75;
      this.player.body.velocity.y -= Math.sin(angle) * 75;
    }
    // No per-bolt camera shake — firing every frame made the whole screen
    // jitter constantly. The muzzle flash + casing + recoil carry the weight.
  }

  // Short wind-up before the super's blast. Tunable: set to 0 to fire instantly
  // (the aim-hold charge orb alone then carries the tell).
  static SUPER_WINDUP_MS = 70;

  firePlayerSuper(angle) {
    // ── Wind-up tell: a bright ring converges into the muzzle, then it blows.
    const wind = GameScene.SUPER_WINDUP_MS;
    if (wind > 0) {
      const wx = this.player.x + Math.cos(angle) * (PLAYER.radius + 14);
      const wy = this.player.y + Math.sin(angle) * (PLAYER.radius + 14);
      const g = this.add.graphics().setDepth(34);
      g.setBlendMode(Phaser.BlendModes.ADD);
      g.lineStyle(3, 0xffc0a0, 0.95);
      g.strokeCircle(0, 0, 34);
      g.setPosition(wx, wy);
      this.tweens.add({
        targets: g, scale: 0.15, alpha: 0.2,
        duration: wind, ease: 'Quad.easeIn',
        onComplete: () => g.destroy(),
      });
      // Fire the blast after the wind-up. The player can move or die in that
      // window, so recompute the muzzle then and bail if they're gone.
      this.time.delayedCall(wind, () => {
        if (!this.player?.alive || !this.scene.isActive()) return;
        this._superBlast(angle);
      });
      return;
    }
    this._superBlast(angle);
  }

  // The actual super discharge. Split out so the wind-up can defer it while
  // recomputing the muzzle from the player's live position.
  _superBlast(angle) {
    const bx = this.player.x + Math.cos(angle) * (PLAYER.radius + 14);
    const by = this.player.y + Math.sin(angle) * (PLAYER.radius + 14);
    const spread = Phaser.Math.DegToRad(PLAYER.superSpreadDeg);
    const half   = (PLAYER.superPellets - 1) / 2;
    for (let i = 0; i < PLAYER.superPellets; i++) {
      const a = angle + (i - half) * (spread / Math.max(1, PLAYER.superPellets - 1));
      const b = this.playerSuperBullets.fire(bx, by, a, PLAYER.superSpeed, PLAYER.superDamage * this.player.dmgMult, PLAYER.superRange,
        { owner: 'player', piercing: true, knockback: PLAYER.superKnockback });
      // Big, chunky pellets — scale THICKNESS ONLY (Y), never X.
      // circleOverlap() derives a bullet's hit radius from body.width / 2, and
      // Phaser's Body.updateBounds() recomputes width as sourceWidth * |scaleX|.
      // So scaling X would silently inflate the super's hit radius (27 -> ~46),
      // while scaling Y only touches body.height, which nothing reads. This
      // makes the pellets visibly fat with a provably identical hitbox.
      // Verified by asserting body.width / radius parity in the smoke test.
      b?.setScale(1, 1.9);
    }
    // Big blast bloom — the super no longer shares the pistol's little flash.
    this.fx.superMuzzleFlash(bx, by, angle);
    // Heavy spark spray in the blast direction — shotgun grit, not a laser puff.
    this.fx.burstDir(bx, by, 'yellow', 18, angle, 55);
    this.fx.burstDir(bx, by, 'red', 12, angle, 70);

    // Eject multiple casings for the super barrage
    this.fx.ejectCasing(bx, by, angle);
    this.time.delayedCall(40, () => this.fx.ejectCasing(bx, by, angle));
    this.time.delayedCall(80, () => this.fx.ejectCasing(bx, by, angle));

    // Re-arm the pop so its peak lands ON the blast. tryFireSuper arms it at
    // button-press; across the wind-up it would already be decaying, so the
    // pre-blast window reads as a small swell and this is the real punch.
    const p = this.player;
    p.recoilT = 260; p.recoilDur = 260; p.recoilMag = 0.20;
    p._wKickT = 180; p._wKickDur = 180; p._wKickMag = 16;

    // Heavy physics recoil force + slide stagger
    if (this.player.body) {
      this.player.body.velocity.x -= Math.cos(angle) * 350;
      this.player.body.velocity.y -= Math.sin(angle) * 350;
      this.player._hurtStaggerMs = 80; // short — keep the super snappy
    }

    this.fx.shake(0.02, 240);
    // Hard zoom punch + warm screen flash — the shotgun "blam" beat.
    this._cameraPunch(1.07, 200);
    this.cameras.main.flash(220, 255, 150, 60, true);
    duckMusic(0.4, 400);
  }

  firePlayerRifle(angle) {
    const cfg = WEAPONS.rifle;
    const bx  = this.player.x + Math.cos(angle) * (PLAYER.radius + 12);
    const by  = this.player.y + Math.sin(angle) * (PLAYER.radius + 12);
    // Single tight bolt per burst shot
    this.playerRifleBullets.fire(bx, by, angle, cfg.speed, cfg.damage, cfg.range, { owner: 'player' });
    this.fx.muzzleFlash(bx, by, angle);
    this.fx.ejectCasing(bx, by, angle);

    // Mild physics recoil
    if (this.player.body) {
      this.player.body.velocity.x -= Math.cos(angle) * 45;
      this.player.body.velocity.y -= Math.sin(angle) * 45;
    }
  }

  // Cluster canister split. Deliberately a small pop rather than the detonator's
  // full explosion — the payoff is the missiles, and a big blast here would both
  // steal that beat and hide the fan of contrails behind a fireball.
  clusterSplit(x, y, z = 0) {
    const cfg = WEAPONS.cluster;
    // The burst happens at ALTITUDE — draw it where the canister appeared, not
    // on the floor beneath it.
    const by = y - z;
    // Air-depth variants: this goes off ~300px above the floor, and the normal
    // burst emitter sits at depth 0 — under every wall and actor in the room.
    // Keyed to the canister's GROUND y, so it sorts against the room correctly.
    this.fx.airBurst(x, by, 16);
    this.fx.impactRing(x, by, 0xffd020, DEPTH.AIR + y);
    this.fx.shake(0.008, 140);
    SFX.shootSuper?.();

    // Assign targets HERE, where all five munitions are being created together
    // and the assignment can be coordinated. Bullet._steer resolves
    // findNearestEnemy independently every frame and stores nothing, which is
    // precisely why every munition used to converge on whichever enemy was
    // closest. Nearest-first, then round-robin: five munitions over three
    // enemies go 3 + 2, never 5 + 0.
    const targets = this.enemies.getChildren()
      .filter((e) => e.active && e.alive
                     && Math.hypot(e.x - x, e.y - y) <= cfg.fragSearchRadius)
      .sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y));
    if (this.boss?.alive) targets.push(this.boss);

    // Fanned evenly over a full circle so the spread reads as a burst opening
    // out. Offset by a random amount per throw so repeat throws don't stamp
    // the identical pattern.
    const step = (Math.PI * 2) / cfg.fragments;
    const base = Math.random() * step;
    for (let i = 0; i < cfg.fragments; i++) {
      const a = base + i * step;
      // How far this one flings outward during the pop. Randomised so they
      // don't climb in a perfect ring — an even circle reads as a mechanism
      // rather than debris.
      const reach = cfg.fanRadius * (0.45 + Math.random() * 0.75);
      const target = targets.length ? targets[i % targets.length] : null;
      this._clusterFragment(x, y, z, a, reach, target);
    }
  }

  // One micro-missile, in three phases.
  //
  // Altitude is a RENDER offset, exactly as Grenade.js does it: the ground
  // position is the real (x, y) the physics body and the shadow live at, and
  // the sprite is drawn at (gx, gy - z). Tweening a plain state object and
  // writing the sprite in onUpdate is what makes that separation possible —
  // tweening the sprite's own y directly, as this used to, conflates the two,
  // which is why the old version could only ever fall straight down.
  //
  // A: POP    — climbs above the burst and fans outward. No lock yet.
  // B: DIVE   — locks on, and falls onto its target tracking it live. The
  //             guidance line appearing IS the lock-on tell.
  // C: IMPACT — detonates. There is no ground phase; these never touch down and
  //             crawl after anything.
  //
  // The body is NEVER enabled. Damage is resolved by an explicit radius test at
  // detonation, which is also why the sprite can be freely scaled — the hitbox
  // trap in CLAUDE.md (Bullet.fire sizing the body off texture width) simply
  // does not apply to a munition that never collides.
  _clusterFragment(bx, by, bz, angle, reach, target = null) {
    const cfg = WEAPONS.cluster;
    const b = this.playerFragBullets.fire(
      bx, by, angle,
      0, cfg.fragDamage * (this.player?.dmgMult ?? 1), 1e9,
      { owner: 'player', knockback: 120 },
    );
    if (!b) return null;
    const gen = b._gen;   // identity, not liveness — see Bullet._gen

    b.body.enable = false;
    b.body.stop();
    b.homing = null;                    // never steers; the dive does the work
    b.setScale(cfg.fragScale);
    b.setPosition(bx, by - bz);

    // Ground position and altitude, tracked apart from the sprite.
    const st = { gx: bx, gy: by, z: bz, target, locked: false };
    const maxZ = bz + cfg.popHeight;
    const shadow = this.add.image(bx, by, 'shadow')
      .setAlpha(0.10).setScale(0.28);
    // Guidance line. Same idiom as the sniper's laser (Enemy._drawLaser): a
    // persistent graphics cleared and redrawn every frame, with its depth
    // re-stamped each time — a depth set once goes stale the moment the world
    // Y-sorts past it.
    const line = this.add.graphics();

    const draw = () => {
      b.setPosition(st.gx, st.gy - st.z);
      // Where the munition actually is on the floor. The sprite's y is the
      // RENDERED position (ground minus altitude), so it cannot answer "where
      // over the room is this thing" — and that is the only position that means
      // anything for draw order, blast placement or measuring the flight path.
      b.groundY = st.gy;
      // Draw order, every frame. The munition is flying OVER the room, so it
      // has to clear the Y-sorted ground layer entirely — at the flat 26 that
      // Bullet.fire() stamps on it, a console at y=700 (depth 756) drew on top
      // of a missile 300px above it. Keyed to the GROUND y (st.gy, where the
      // shadow is), never to the rendered y, or the sort order would drift as
      // it gains altitude. The shadow is on the floor and joins the ground
      // layer like every other shadow.
      b.setDepth(DEPTH.AIR + st.gy);
      shadow.setDepth(st.gy - 1);
      // Scale is FLAT. Altitude is read from the shadow instead, which grows
      // and darkens as the gap closes.
      // Clamped: under the powered run the altitude is integrated rather than
      // tweened, so it is free to overshoot maxZ or dip below zero for a frame.
      const h = Phaser.Math.Clamp(maxZ > 0 ? st.z / maxZ : 0, 0, 1);
      shadow.setPosition(st.gx, st.gy);
      shadow.setScale(0.28 + (1 - h) * 0.62);
      shadow.setAlpha(0.10 + (1 - h) * 0.30);

      // The trajectory the munition is about to follow, drawn ahead of it to
      // the enemy it has locked. Only once the lock is live — during the pop
      // there is nothing to point at yet.
      //
      // DOTTED and faint, deliberately. A solid stroke reads as a tether
      // physically connecting two objects; a broken one reads as a projected
      // path. Phaser's Graphics has no dash support, so the segments are walked
      // out along the vector by hand. The dash offset crawls toward the target
      // so the path has direction rather than sitting there like a rope.
      line.clear();
      const t = st.target;
      if (st.locked && t?.active && t.alive) {
        line.setDepth(DEPTH.AIR + st.gy - 1);
        const dx = t.x - b.x, dy = t.y - b.y;
        const len = Math.hypot(dx, dy);
        if (len > 1) {
          const ux = dx / len, uy = dy / len;
          const dash = 7, gap = 9, period = dash + gap;
          // Crawl. Negative so the dashes travel from the munition toward its
          // target, not backwards up the line.
          const off = -(this.time.now * 0.06) % period;
          line.lineStyle(1.1, 0xffa040, 0.22);
          line.beginPath();
          for (let d = off; d < len; d += period) {
            const s = Math.max(0, d);
            const e = Math.min(d + dash, len);
            if (e <= s) continue;
            line.moveTo(b.x + ux * s, b.y + uy * s);
            line.lineTo(b.x + ux * e, b.y + uy * e);
          }
          line.strokePath();
        }
      }
    };
    draw();

    // ── Phase A: the pop ────────────────────────────────────────────────────
    // Up and out. easeOut on both so it bursts away hard and decelerates into
    // the apex, which is what sells it as being thrown rather than falling.
    this.tweens.add({
      targets: st, z: maxZ, duration: cfg.popMs, ease: 'Quad.easeOut',
      onUpdate: draw,
    });
    this.tweens.add({
      targets: st,
      gx: bx + Math.cos(angle) * reach,
      gy: by + Math.sin(angle) * reach,
      duration: cfg.popMs, ease: 'Quad.easeOut',
      onUpdate: draw,
      onComplete: () => {
        if (!b.active || b._gen !== gen) { shadow.destroy(); line.destroy(); return; }
        this._clusterDive(b, gen, st, shadow, line, angle, draw);
      },
    });

    // No spin. This used to tumble 450 degrees across the pop, which read as the
    // munitions doing backflips out of the canister. A guided round points where
    // it is going: Bullet.fire() has already aimed it along `angle`, which is
    // exactly the outward heading it travels during the pop.
    return b;
  }

  // Phase B + C: lock on, dive, detonate.
  //
  // The lock goes live here rather than at spawn, so the guidance line snapping
  // on IS the tell that the munition has chosen its target. Which enemy that is
  // was decided back in clusterSplit, where all five could be assigned across
  // DISTINCT targets — resolving it here per-missile is what used to send every
  // one of them at whichever enemy happened to be nearest.
  _clusterDive(b, gen, st, shadow, line, angle, draw) {
    const cfg = WEAPONS.cluster;
    st.locked = true;
    st.z0 = st.z;

    // Where it flies if there is nothing to attack, or if the target dies
    // mid-run: carry on along the fan and detonate out there.
    const fallbackX = st.gx + Math.cos(angle) * 260;
    const fallbackY = st.gy + Math.sin(angle) * 260;

    // Velocity, in px/s. It leaves the apex still carrying the pop's outward
    // momentum — that is the whole reason the run curves. The motor cannot turn
    // this vector instantly, so a munition flung away from its target has to
    // swing wide and bank back onto it.
    st.vx = Math.cos(angle) * cfg.fragExitSpeed;
    st.vy = Math.sin(angle) * cfg.fragExitSpeed;
    st.vz = 0;
    st.prevH = Infinity;

    // Exhaust. Only exists while the motor is burning, which is what makes it a
    // cue rather than decoration — you can see which munitions are under power.
    // The muzzle texture is a forward-pointing flame (EAST in the texture), so
    // it is turned 180 degrees to blow backwards out of the tail.
    let flame = null;

    let elapsed = 0;
    let lit = false;

    const cleanup = () => {
      this.events.off('update', step);
      shadow.destroy();
      line.destroy();
      flame?.destroy();
    };

    const step = (_time, deltaMs) => {
      // Identity, not liveness: `active` alone cannot tell "still my missile"
      // from "recycled and re-fired as something else", which is how the old
      // deferred callback used to turn other people's bullets into missiles.
      if (!b.active || !b.scene || b._gen !== gen) { cleanup(); return; }

      // Clamped, so a frame hitch integrates a plausible step instead of
      // teleporting the munition across the room.
      const dt = Math.min(deltaMs, 50) / 1000;
      elapsed += deltaMs;

      const t = st.target;
      const live = t?.active && t.alive;
      const aimX = live ? t.x : fallbackX;
      const aimY = live ? t.y : fallbackY;

      // Ignition, after a short motor-off beat at apex. The munition drops and
      // its nose swings over during that beat, so the burn reads as a decision
      // rather than as something that was always falling.
      if (!lit && elapsed >= cfg.pitchOverMs) {
        lit = true;
        // Estimate the run from the range left to cover, so the burn lasts
        // roughly as long as the flight instead of a fixed length — the flight
        // time is now an outcome of the physics and varies with distance.
        const d = Math.hypot(aimX - st.gx, aimY - st.gy, st.z);
        const est = Phaser.Math.Clamp((d / 700) * 1000 * 1.25, 300, cfg.fragMaxFlightMs);
        SFX.fragBoost?.(est);
        flame = this.add.image(b.x, b.y, 'muzzle').setScale(0.30);
      }

      // ── Steering ────────────────────────────────────────────────────────
      // One 3D velocity, steered toward the target and speed-capped. Descent is
      // NOT a separate system — the aim vector points down at a target on the
      // floor, so thrust brings the munition down as a consequence of flying at
      // it. Two earlier attempts split the axes and solved the vertical on its
      // own; both failed, and both failed by fighting the horizontal:
      //
      //   sink = z / time-to-target  — back-loaded and singular. The munition
      //     held its height, then got yanked into the ground at ~3300px/s.
      //   sink = z proportional to range remaining — a munition circling at a
      //     constant range never closes, so it never descends either. Turned
      //     through 1049 degrees, orbiting until the flight timeout.
      // The two axes are solved by different means, and which means goes on
      // which axis is the whole design:
      //
      //   HORIZONTAL — real momentum-limited flight. Steering a velocity that
      //     cannot turn instantly is what produces the arc, and it is the thing
      //     that stopped this reading as a puppet.
      //   VERTICAL — solved from the horizontal CLOSING RATE, so altitude and
      //     range run out together no matter what path the horizontal takes.
      //
      // Aiming a single 3D vector at the target instead does not work, and
      // failed twice: the munition spends its altitude on whatever heading it
      // currently holds, so one still mid-bank flies itself into the floor, and
      // one that has closed to short range aims almost straight down and drops
      // 200px short of an enemy it was about to reach.
      const hdist = Math.max(1, Math.hypot(aimX - st.gx, aimY - st.gy));
      let dx = (aimX - st.gx) / hdist;
      let dy = (aimY - st.gy) / hdist;

      let sp = Math.hypot(st.vx, st.vy);
      let hx, hy;
      if (sp < 1) { hx = dx; hy = dy; sp = 1; }
      else { hx = st.vx / sp; hy = st.vy / sp; }

      // Anti-orbit. `sp / hdist` is the angular rate needed to circle the target
      // at this range, so turning faster than that guarantees the munition
      // curves INSIDE its own approach and converges instead of sling-shotting
      // past. Far out the term is negligible and fragTurnRate governs, which is
      // where the opening bank comes from. Measured horizontally: a munition
      // 400px up and 80px out has a 3D range of 408, which badly understates how
      // hard it must turn to stay over its target. The 3.0 margin is sized for
      // the worst case rather than the typical one: at 2.2 most munitions
      // converged fine but roughly one in three volleys had a straggler fly an
      // extra 600-degree lap before coming in.
      const omega = Math.max(cfg.fragTurnRate, (sp / hdist) * 3.0);

      const cross = hx * dy - hy * dx;
      const off = Math.atan2(Math.abs(cross), Phaser.Math.Clamp(hx * dx + hy * dy, -1, 1));
      // Steering stops once the munition is over its target — it is committed
      // and dropping, and there is nothing useful left to correct. Without this
      // the anti-orbit term (which scales as 1/hdist, so it is enormous at close
      // range) whipped the nose round and round through the last few frames.
      // Since rotation now follows velocity, that came out as the munitions
      // spinning on impact: 3.6 full turns a flight, which is the exact tumble
      // that was designed out of the pop.
      if (off > 1e-4 && hdist >= 40) {
        const turn = Math.min(off, omega * dt) * Math.sign(cross || 1);
        const c = Math.cos(turn), s = Math.sin(turn);
        const nx = hx * c - hy * s;
        hy = hx * s + hy * c; hx = nx;
      }

      // Thrust along the nose once the motor is lit.
      if (lit) sp = Math.min(cfg.fragMaxSpeed, sp + cfg.fragThrust * dt);
      st.vx = hx * sp; st.vy = hy * sp;

      // ── Descent ─────────────────────────────────────────────────────────
      // Sink in proportion to how fast the range is actually closing. Integrate
      // that and altitude stays proportional to range, so z reaches 0 exactly as
      // the munition arrives — a glide slope that follows whatever path the
      // horizontal flies rather than assuming a straight one.
      //
      // While banking outward the range is not closing at all, so the munition
      // holds height (bar the minimum sink) and spends that time turning. It
      // descends when, and only when, it is actually making progress.
      if (!lit) {
        st.vz -= cfg.fragGravity * dt;
      } else if (hdist < 40) {
        // Terminal. Directly over the target, so there is no range left for the
        // slope to work with — the closing rate has gone to zero and the law
        // above would leave it hovering down at the minimum sink. Drop.
        st.vz = -cfg.fragMaxSink;
      } else {
        const closing = (st.prevH - hdist) / dt;
        st.vz = -Phaser.Math.Clamp(
          closing > 0 ? st.z * (closing / hdist) : 0,
          cfg.fragMinSink, cfg.fragMaxSink,
        );
      }
      st.prevH = hdist;

      st.gx += st.vx * dt;
      st.gy += st.vy * dt;
      st.z  += st.vz * dt;

      // Nose along the velocity: rotation is now a CONSEQUENCE of where it is
      // going, not a decoration pointed at the target. A munition banking
      // through a turn is visibly not aimed at anything, which is exactly the
      // read we want.
      if (sp > 1) b.setRotation(Math.atan2(st.vy, st.vx));

      // Arriving on top of the target counts as impact even if the descent has
      // a few pixels left in it — otherwise a munition that got there early
      // would fly through and have to come back round.
      // Ground contact, not proximity. Detonating on horizontal range alone
      // let a munition that arrived overhead before it had spent its altitude
      // go off 300px in the air, which reads as a dud airburst rather than a
      // strike. It now always comes down and hits the floor.
      if (st.z <= 0 || elapsed >= cfg.fragMaxFlightMs) {
        st.z = 0;
        draw();
        cleanup();
        this._clusterImpact(b, st);
        return;
      }

      draw();

      if (flame) {
        // Out of the tail, blowing backwards, flickering. Sits just under its
        // own munition so the sprite always reads on top of its exhaust.
        const r = b.rotation;
        flame.setPosition(b.x - Math.cos(r) * 11, b.y - Math.sin(r) * 11);
        flame.setRotation(r + Math.PI);
        flame.setDepth(DEPTH.AIR + st.gy - 0.5);
        flame.setScale(0.26 + Math.random() * 0.10, 0.24 + Math.random() * 0.08);
        flame.setAlpha(0.75 + Math.random() * 0.25);
      }
    };

    this.events.on('update', step);
  }

  // Detonation. There is no ground phase — the munition never touches down and
  // hunts, so damage is resolved here by an explicit radius test rather than by
  // enabling the body and letting the collision handlers run. That is also what
  // frees the sprite to be scaled freely: a bullet that never collides cannot
  // have its hitbox broken by its texture size.
  _clusterImpact(b, st) {
    const cfg = WEAPONS.cluster;
    const x = st.gx, y = st.gy;
    const t = st.target;

    if (t?.active && t.alive && Math.hypot(t.x - x, t.y - y) <= cfg.impactRadius) {
      const kb = 120;
      const a  = Math.atan2(t.y - y, t.x - x);
      // A fragment hit plays its own explosion, so the generic hit beep that
      // e.damage() triggers through the 'enemy-hit' listener has to be muted or
      // it just layers underneath. The emit is synchronous, so a plain flag
      // around the call is exact — no timing window to get wrong.
      this._suppressHitSfx = true;
      t.damage(b.damage, { x: Math.cos(a) * kb, y: Math.sin(a) * kb });
      this._suppressHitSfx = false;
      this.player?.onHitLanded?.();
      this.player?.addSuperHit?.();
    }

    this.fx.explosion(x, y, 0.8);
    this.fx.impactRing(x, y, 0xff8020);
    this.fx.burst(x, y, 'yellow', 6);
    SFX.fragImpact?.();
    b.hasHit = true;      // a detonation is not a miss, whatever it landed on
    b.kill();
  }

  // _missileTrail lived here — a per-frame smoke-and-spark contrail stamped
  // behind a flying munition. Removed with its only caller: the trail was read
  // as a failed attempt at an aim indicator, and the guidance line drawn AHEAD
  // of each munition to its locked target replaces it. Two line-ish elements
  // competing was the whole problem, so this is not coming back alongside it.

  // A VOLATILE nemesis detonating where it fell.
  //
  // Deliberately NOT detonateGrenade. That one is the PLAYER's blast: it damages
  // only enemies, and it feeds `addSuperHit` for every target caught. Reusing it
  // meant a volatile corpse hurt nobody and handed the player super charge for
  // the privilege — an explosion that changed nothing except the light show,
  // which is the exact failure the trait exists to avoid.
  //
  // This hurts the player, chains into other enemies, and grants nothing.
  _volatileBlast(x, y, damage, radius) {
    this.fx.explosion(x, y, 2.2);
    this.fx.burst(x, y, 'red', 22);
    this.fx.shake(0.016, 240);
    SFX.bossDie?.();

    const r2 = radius * radius;
    for (const t of this.enemies.getChildren()) {
      if (!t.active || !t.alive) continue;
      if ((t.x - x) ** 2 + (t.y - y) ** 2 < r2) t.damage(Math.round(damage * 0.6));
    }

    const p = this.player;
    if (p?.alive) {
      const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d2 < r2) {
        // Falls off with distance, so backing out of the blast partly works and
        // dashing clear of it works entirely — the trait asks you to move, it
        // does not simply tax the kill.
        const falloff = 1 - Math.sqrt(d2) / radius;
        p.damage(Math.round(damage * (0.45 + 0.55 * falloff)), Math.atan2(p.y - y, p.x - x));
      }
    }
  }

  detonateGrenade(x, y, damage, radius) {
    this.fx.explosion(x, y, 2.5);
    this.fx.burst(x, y, 'yellow', 20);
    this.fx.burst(x, y, 'red', 20);
    this.fx.shake(0.018, 280);
    duckMusic(0.5, 500);
    SFX.bossDie(); // big boom reuse
    // AoE enemies
    const r2 = radius * radius;
    const targets = [...this.enemies.getChildren()];
    if (this.boss?.alive) targets.push(this.boss);
    for (const t of targets) {
      if (!t.active || !t.alive) continue;
      if ((t.x - x) ** 2 + (t.y - y) ** 2 < r2) {
        t.damage(damage);
        this.player.addSuperHit();
      }
    }
    // Damage number
    this.fx.damageNumber(x, y - 40, damage, '#ffdd20', true);
  }

  fireShooter(shooter, angle) {
    // Every enemy shot in the game funnels through here, which is why the
    // nemesis weapons hook in at this one point rather than by subclassing the
    // archetypes. An enemy without a weapon fires the stock bolt exactly as
    // before; the branch is the entire integration.
    const w = shooter._nemesisWeapon;
    if (w) {
      w.fire(this, shooter, angle);
      // Per-weapon, so a scattergun and a beam lance do not sound the same.
      // The muzzle flash is drawn by the weapon's own `fire`, at the barrel it
      // came out of — the repeater alternates barrels and needs both.
      SFX.enemyShoot(w.muzzleKind);
      return;
    }
    const bx = shooter.x + Math.cos(angle) * (shooter.cfg.radius + 4);
    const by = shooter.y + Math.sin(angle) * (shooter.cfg.radius + 4);
    this.enemyBullets.fire(bx, by, angle,
      shooter.cfg.bulletSpeed, shooter.cfg.bulletDamage, shooter.cfg.bulletRange,
      { owner: 'enemy' });
    SFX.enemyShoot();
  }

  bossSpawnMinions() {
    for (let i = 0; i < BOSS.spawnCount; i++) {
      this.time.delayedCall(i * 120, () => this.spawnEnemyRandom('grunt'));
    }
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  update(time, delta) {
    if (!this.player) return;

    // Draw auto-aim targeting circle
    if (this.lockGfx) {
      this.lockGfx.clear();
      if (this.player.alive && (this.player.aiming || this.player.superAiming)) {
        const target = this.findNearestEnemy(this.player.x, this.player.y, 600);
        if (target && target.alive) {
          const r = target.cfg.radius + 8;
          const pulse = 1.0 + Math.sin(time * 0.01) * 0.08;
          const angle = time * 0.002;
          this.lockGfx.lineStyle(3, 0xff3333, 0.85);
          for (let i = 0; i < 4; i++) {
            const a = angle + i * (Math.PI / 2);
            this.lockGfx.beginPath();
            this.lockGfx.arc(target.x, target.y, r * pulse, a - 0.25, a + 0.25);
            this.lockGfx.strokePath();
          }
          this.lockGfx.fillStyle(0xff3333, 0.4);
          this.lockGfx.fillCircle(target.x, target.y, 4);
        }
      }
    }

    // Reload progress indicator (circular HUD overlay under feet)
    if (this.reloadGfx) {
      this.reloadGfx.clear();
      const p = this.player;
      if (p && p.alive) {
        const isReloading = p.ammoTimers.length > 0;
        
        // Fade alpha in when reloading, fade out when done
        if (isReloading) {
          this.reloadAlpha = Math.min(1.0, this.reloadAlpha + delta * 0.008);
        } else {
          this.reloadAlpha = Math.max(0.0, this.reloadAlpha - delta * 0.006);
        }

        if (this.reloadAlpha > 0) {
          const rx = p.x;
          const ry = p.y + 14; // hover under player feet
          const radius = 18;
          
          // Draw thin back circle track
          this.reloadGfx.lineStyle(3, 0x2e3038, this.reloadAlpha * 0.45);
          this.reloadGfx.strokeCircle(rx, ry, radius);

          // Draw progress arc
          if (isReloading) {
            const reloadProgress = 1.0 - (p.ammoTimers[0] / PLAYER.ammoReloadMs);
            const startAngle = -Math.PI / 2; // top of circle
            const endAngle = startAngle + reloadProgress * (Math.PI * 2);
            
            // Choose color: yellow when reloading, cyan when close/completed
            const color = reloadProgress > 0.85 ? 0x90d8ff : 0xffdd40;
            
            this.reloadGfx.lineStyle(3.5, color, this.reloadAlpha * 0.85);
            this.reloadGfx.beginPath();
            this.reloadGfx.arc(rx, ry, radius, startAngle, endAngle, false);
            this.reloadGfx.strokePath();
          } else {
            // Full cyan circle fading out when reload completes
            this.reloadGfx.lineStyle(3.5, 0x90d8ff, this.reloadAlpha * 0.85);
            this.reloadGfx.strokeCircle(rx, ry, radius);
          }
        }
      } else {
        this.reloadAlpha = 0;
      }
    }

    // Bush hiding
    const actors = [this.player, ...this.enemies.getChildren()];
    if (this.boss) actors.push(this.boss);
    this.bushSystem.update(actors);

    // Aim cone
    this.drawAimCone();

    // Patrol enemy vision cones
    this._drawPatrolVision();

    // AI debug overlay (D key)
    this._drawAIDebug();

    // Timed wave survival tick
    this._tickArena(delta);
    this._tickNemesis(delta);
    this.tickTelegraphs(delta);
    this._tickNemesisMoves(delta);

    // Health orbs
    this.updateHealthOrbs(delta);

    // Weapon pickup checks
    for (const p of this.weaponPickups) {
      const taken = p.checkPickup(this.player);
      // A disarmed weapon comes back with the ammo it had. equipSecondary
      // refills to full, which would make being disarmed a free reload.
      if (taken && p._restoreAmmo != null) {
        this.player.secondaryAmmo = p._restoreAmmo;
        this.events.emit('secondary-ammo-changed');
      }
      // One of a paired offer was collected — retire its sibling.
      if (taken && this._pendingChoice?.offered.includes(p)) {
        this._pendingChoice.resolve(p);
      }
    }

    // Objective terminals — update visuals + show the contextual HACK
    // button when the player is on a slicable terminal. The puzzle itself
    // is NEVER auto-opened; the player taps HACK (or presses E) to start.
    if (this.terminals.length) {
      let nearest = null;
      for (const t of this.terminals) {
        t.update(delta, this.player);
        if (!nearest && !t.hacked && t.inRange(this.player)) nearest = t;
      }
      // The button shows whenever in range; selection persists until you
      // leave that terminal's radius.
      if (nearest !== this._hackPromptTarget) {
        this._hackPromptTarget = nearest;
        this.events.emit('hack-prompt', !!nearest);
      }
      // If a mini-game is in flight on a terminal we walked away from, cancel.
      if (this._activeHackTarget && !this._activeHackTarget.inRange(this.player)) {
        this._activeHackTarget = null;
        this.events.emit('hack-cancel');
      }
    }

    // Door trigger check
    this._checkDoorTrigger();

    // Stealth takedown target
    this._updateTakedownTarget();

    // Bullets
    this.handleBulletEnemyHits(this.playerBullets, false);
    this.handleBulletEnemyHits(this.playerRifleBullets, false);
    this.handleBulletEnemyHits(this.playerSuperBullets, true);
    this.handleBulletEnemyHits(this.playerFragBullets, false);
    this.handleEnemyBulletsVsPlayer();
    this.handleBulletWallHits(this.playerBullets, false);
    this.handleBulletWallHits(this.playerRifleBullets, false);
    this.handleBulletWallHits(this.playerSuperBullets, true);
    this.handleBulletWallHits(this.playerFragBullets, false);
    this.handleBulletWallHits(this.enemyBullets, false);
    this.handleBulletWallHits(this.deflectedBullets, false);
    this.handleBulletWallHits(this.bossSuperOrbs, true);
    this._tickSuperOrbs(delta);

    // Bullet trails — every OTHER frame (frame parity), halving particle
    // churn at horde bullet counts; the motion-blur tail still reads at 30Hz.
    this._trailParity = !this._trailParity;
    if (this._trailParity) {
      for (const b of this.playerBullets.getChildren())
        if (b.active) this.fx.trail(b.x, b.y);
      for (const b of this.playerRifleBullets.getChildren())
        if (b.active) this.fx.trail(b.x, b.y);
      for (const b of this.playerSuperBullets.getChildren()) {
        if (b.active) {
          this.fx.trail(b.x, b.y);
          this.fx.smokeTrail(b.x, b.y); // missiles get extra smoke puff
        }
      }
      // Enemy bolts had NO trail at all — this loop covered only the three
      // player groups. A bolt with no wake and no stretch is a shape sliding
      // across the floor, which is exactly how incoming fire read.
      for (const g of this.hostileBullets)
        for (const b of g.getChildren())
          // The returned super is excluded: it has its own wake (see
          // `_tickSuperOrbs`), and the generic dot trail underneath it was just
          // a second, weaker statement about the same motion.
          if (b.active && g !== this.bossSuperOrbs) this.fx.trail(b.x, b.y);
    }

    // Camera lookahead — shift the follow target toward where the player is
    // looking AND where they're moving, so you see further down the barrel and
    // get extra reaction room ahead of movement in the narrow portrait view.
    // Both leads feed one smoothed offset (no snap); the total is clamped.
    if (this.player.alive) {
      const aim = this.player.aiming ? this.player.aim
                : this.player.superAiming ? this.player.superAim
                : this.player.facing;
      // Aim lead (unchanged): look down the barrel.
      let tx = Math.cos(aim) * 50;
      let ty = Math.sin(aim) * 50;
      // Velocity lead: push ahead of travel, scaled by how fast we're moving.
      // A dash gets a bigger transient lead that eases back via the smoother.
      const vx = this.player.body.velocity.x;
      const vy = this.player.body.velocity.y;
      const sp = Math.hypot(vx, vy);
      if (sp > 1) {
        const speedN  = Math.min(1, sp / PLAYER.speed);
        const velLead = (this.player.isDashing ? 120 : 60) * speedN;
        tx += (vx / sp) * velLead;
        ty += (vy / sp) * velLead;
      }
      // Clamp the combined offset so aim + velocity can't stack too far.
      const mag = Math.hypot(tx, ty);
      const MAXO = 150;
      if (mag > MAXO) { tx = (tx / mag) * MAXO; ty = (ty / mag) * MAXO; }
      this._camOX = (this._camOX ?? 0) * 0.92 + tx * 0.08;
      this._camOY = (this._camOY ?? 0) * 0.92 + ty * 0.08;
      this.cameras.main.setFollowOffset(-this._camOX, -this._camOY);
    }

    // ── Ambient floor motes — slow airborne drift across the viewport.
    // Spawns one mote every ~220 ms at a random point in the camera's
    // worldView so they appear scattered and drift offscreen naturally.
    this._moteTimer = (this._moteTimer || 0) + delta;
    if (this._moteTimer >= 220) {
      this._moteTimer = 0;
      const wv = this.cameras.main.worldView;
      const mx = wv.x + Math.random() * wv.width;
      const my = wv.y + Math.random() * wv.height;
      this.fx?.ambientMote?.(mx, my);
    }

    // ── Speed-tied camera zoom-breathe — subtle zoom-out when sprinting,
    // zoom-in tighter when idle/aiming. Stacks with _cameraPunch (zoom
    // punches are multiplicative through the tween's main.zoom write).
    const ps      = this.player.alive ? Math.hypot(this.player.body.velocity.x, this.player.body.velocity.y) : 0;
    const speedN  = Math.min(1, ps / PLAYER.speed);
    const targetZ = 1.0 - speedN * 0.04;
    // 200 ms exponential smoothing toward target. Skip while a punch tween
    // is actively writing to main.zoom so the two effects don't fight.
    if (!this._cameraPunchTween || !this._cameraPunchTween.isPlaying()) {
      const k = 1 - Math.exp(-delta / 200);
      const z = this.cameras.main.zoom;
      this.cameras.main.setZoom(z + (targetZ - z) * k);
    }

    // Desktop keyboard movement
    if (this.cursors || this.keys) {
      const k    = this.keys || {};
      const left  = this.cursors?.left.isDown  || k.A?.isDown;
      const right = this.cursors?.right.isDown || k.D?.isDown;
      const up    = this.cursors?.up.isDown    || k.W?.isDown;
      const down  = this.cursors?.down.isDown  || k.S?.isDown;
      const vx   = (right ? 1 : 0) - (left ? 1 : 0);
      const vy   = (down  ? 1 : 0) - (up   ? 1 : 0);
      const any  = left || right || up || down;
      if (any) {
        const m = Math.hypot(vx, vy) || 1;
        this.player.setMoveInput({ x: vx / m, y: vy / m, force: 1 });
        this._kbdActive = true;
      } else if (this._kbdActive) {
        this.player.setMoveInput({ x: 0, y: 0, force: 0 });
        this._kbdActive = false;
      }
    }
  }


  // ── Collision helpers ─────────────────────────────────────────────────────

  handleBulletEnemyHits(group, isSuper) {
    const bullets  = group.getChildren();
    const enemies  = this.enemies.getChildren();
    for (const b of bullets) {
      if (!b.active) continue;
      // An airborne cluster munition disables its body for the whole flight.
      // These handlers only ever checked `active`, and circleOverlap reads
      // body.width — which a disabled body still has — so falling fragments
      // were hitting things mid-air and dying early. That is what made the
      // recycle window constant rather than rare.
      if (b.body && b.body.enable === false) continue;
      // Boss
      if (this.boss?.alive && !b.hitSet.has(this.boss)) {
        if (this.circleOverlap(b, this.boss)) {
          b.hitSet.add(this.boss);
          b.hasHit = true;

          // DEFLECTION: while the saber is up, a player shot is turned around
          // rather than landing. Intercepted HERE rather than inside
          // Boss.damage because the shot must not count as damage at all — no
          // hit flash, no meter charge, no intake window opened.
          if (b.owner === 'player' && this.boss.isReflecting?.()) {
            const inAngle = Math.atan2(b.y - this.boss.y, b.x - this.boss.x);

            // ── A SUPER IS CAUGHT, NOT BATTED ────────────────────────────
            //
            // Every other projectile in the game comes back off the blade. The
            // super does not, and that is a design decision rather than an
            // implementation detail: a super pellet carries
            // `superDamage * player.dmgMult`, `dmgMult` reaches four figures by
            // the sixth Vader, and five of those returned at once was five
            // simultaneous unreadable deletions from one careless button press.
            // He takes it instead. What comes back is ONE slow thing, on his
            // terms, carrying a number that has nothing to do with the player's
            // scaling — see `boss-super-return` below.
            if (isSuper) {
              this.boss.absorbSuper();
              // The blade still answers it: he is catching it ON the guard, so
              // the same directional parry gesture plays. What differs is where
              // the energy goes, and that is what `superCaught` draws.
              this.boss.parry?.(inAngle);
              const hx = this.boss.x + Math.cos(this.boss._aim ?? inAngle) * (BOSS.radius + 4);
              const hy = this.boss.y + Math.sin(this.boss._aim ?? inAngle) * (BOSS.radius + 4) - 6;
              this.fx.superCaught?.(b.x, b.y, hx, hy);
              SFX.superAbsorb?.();
              this.events.emit('boss-absorbed', this.boss, b.damage);
              b.kill();
              continue;
            }

            // ── A TRUE DEFLECTION ────────────────────────────────────────
            //
            // The shot that comes back is the shot that went out: same red
            // bolt, same speed, same reach, leaving from the point on the
            // blade where it was actually stopped. It used to be a slower
            // GREEN bolt spawned 50px from Vader on the boss->player line, which
            // read as him firing rather than as him blocking — and because the
            // spawn point was ahead of the contact, a player standing inside
            // that 50px never got hit by their own shot at all.
            const speed = Math.hypot(b.body.velocity.x, b.body.velocity.y)
              || BOSS.fanBulletSpeed;
            // In: the bearing the blade has to reach to be in the way.
            // Out: back at the player. Return-to-sender is the fantasy, and it
            // is also the only aim that stays fair — a mirrored bounce off a
            // moving boss would be unreadable.
            const inAng  = inAngle;
            const back   = Math.atan2(this.player.y - b.y, this.player.x - b.x);
            this.deflectedBullets.fire(
              b.x, b.y, back, speed, Math.round(b.damage * 0.5),
              // The ORIGINAL range, not what was left of it. The remaining
              // range is by definition the distance it has already come, and
              // the trip home is that distance again — so spending it down
              // would strand every deflection in mid-air a few pixels short of
              // the player, which looks like the mechanic being broken.
              b.range, { owner: 'boss' },
            );
            // He answers it with the blade. `parry` only asks — the weapon
            // sprite is drawn by the one system that owns it, in Boss.preUpdate.
            this.boss.parry?.(inAng);
            this.fx.saberParry?.(b.x, b.y, inAng, back);
            SFX.saberDeflect?.();
            // Announced so a deflection is countable. The arena is full of other
            // enemy bullets — his fan, his guards — so "a hostile bolt exists"
            // is not evidence that one was turned around.
            this.events.emit('boss-reflected', this.boss, b.damage);
            b.kill();
            continue;
          }

          if (!isSuper && b.owner === 'player') this.player.onHitLanded();
          // Boss ignores knockback in its damage override — pass it anyway.
          const kbVec = { x: b.body.velocity.x * 0.15, y: b.body.velocity.y * 0.15 };
          this.boss.damage(b.damage, kbVec);
          this.fx.impactRing(b.x, b.y, 0xffd040); // gold shockwave for boss
          // Heavier directional spark — boss armor deflects more
          const flightAng = Math.atan2(b.body.velocity.y, b.body.velocity.x);
          this.fx.burstDir(b.x, b.y, 'yellow', isSuper ? 18 : 10, flightAng, 100);
          // Super pellets don't recharge the meter off the boss — otherwise one
          // volley refills the next and supers chain-kill the boss. Primary hits
          // still build charge, so you earn each super by chipping the boss.
          if (b.owner === 'player' && !isSuper) this.player.addSuperHit();
          if (!b.piercing) { if (isSuper) this.fx.explosion(b.x, b.y, 2.6); b.kill(); }
        }
      }
      if (!b.active) continue;
      for (const e of enemies) {
        if (!e.active || !e.alive || b.hitSet.has(e)) continue;
        if (this.circleOverlap(b, e)) {
          b.hitSet.add(e);
          const flightAng = Math.atan2(b.body.velocity.y, b.body.velocity.x);
          // Shielded troopers deflect non-piercing frontal hits. The super is
          // piercing, so it punches straight through the shield.
          if (e._blocksFrontal && !b.piercing && e.isFrontalHit?.(flightAng)) {
            e.onBlock?.();
            this.fx.impactRing(b.x, b.y, 0x50b0ff);  // blue shield clang
            this.fx.healingSparkle(b.x, b.y, 6);       // blue deflection sparks
            b.kill();
            break; // bullet stopped by the shield — no damage, no super credit
          }
          b.hasHit = true;
          if (!isSuper && b.owner === 'player') this.player.onHitLanded();
          // Every bullet knocks: super pellets shove hard, normal shots
          // give a punchy stagger in flight direction. Hotline-feel.
          const kbScale = isSuper ? 0.32 : 0.18;
          const kbVec = { x: b.body.velocity.x * kbScale, y: b.body.velocity.y * kbScale };
          // Flag super-caused damage so the enemy-hit/enemy-died shake handlers
          // (which fire synchronously inside damage()) can fall the shake off
          // with the enemy's distance — a super wiping a spread-out crowd was
          // ringing the camera on every far kill.
          this._superHitCtx = isSuper && b.owner === 'player';
          e.damage(b.damage, kbVec);
          this._superHitCtx = false;
          // Super pellets are piercing, so the explosion below (gated on
          // !b.piercing) never fires for them — a super punching through a
          // crowd had no weight at the point of contact. Give super hits a
          // brighter, larger ring instead. Deliberately restrained: this
          // stacks per pellet per enemy.
          if (isSuper) this.fx.impactRing(b.x, b.y, 0xffd0a0);
          this.fx.impactRing(b.x, b.y, 0xee3030); // red shockwave for troopers
          // Directional impact spray — sparks fly forward along the bullet
          // path with a wide cone, like a deflection ricochet.
          this.fx.burstDir(b.x, b.y, 'red', isSuper ? 14 : 7, flightAng, 80);
          // Super pellets recharge off normal enemies (keeps horde supers
          // chaining — the fun part) but NOT off mini-bosses, so a mini-boss
          // can't be spam-supered the way a swarm can.
          if (b.owner === 'player' && !(isSuper && e._miniBoss)) {
            // On a NEMESIS the meter fills slowly. This is the actual spam
            // engine the playtest hit: `accuracyMult` reaches 2.0 on a hit
            // streak, so at full combo TWO primary bolts fill a super — and a
            // super is 3000 damage. That loop is ~3,100-5,400 effective dps,
            // which is why a mini-boss "can be killed so so fast if I just spam
            // normal hit and super". Slowing the gain makes a super a burst
            // window you earn during the fight rather than a rotation you hold.
            //
            // Deliberately NOT a damage cap: caps were removed here twice by
            // request because they lie about the number they just showed you.
            // This changes how often you get the big number, not what it is.
            this.player.addSuperHit(e._miniBoss ? NEMESIS_SUPER_GAIN : 1);
            // Melee has its OWN meter; feed it from the same hits so both
            // skills come online through normal play.
            this.player.addMeleeHit();
          }
          if (!b.piercing) { if (isSuper) this.fx.explosion(b.x, b.y, 1.4); b.kill(); break; }
        }
      }
    }
  }

  /**
   * Every pool that can hurt the PLAYER.
   *
   * One list, so the deflected-fire pool cannot be forgotten at one of the
   * places that sweep incoming fire — collision, walls, trails, off-screen
   * threat chevrons, room clear, the debug purge. Six sites is exactly the
   * count at which "remember to add it in both places" stops working.
   */
  get hostileBullets() {
    return [this.enemyBullets, this.deflectedBullets, this.bossSuperOrbs];
  }

  handleEnemyBulletsVsPlayer() {
    if (this.player?.isDashing) return;
    for (const g of this.hostileBullets) for (const b of g.getChildren()) {
      if (!b.active) continue;
      if (this.circleOverlap(b, this.player)) {
        // Pass the bullet's flight angle so the player gets shoved in the
        // direction the bullet was travelling (same pattern as enemy stagger).
        const dir = Math.atan2(b.body.velocity.y, b.body.velocity.x);
        this.player.damage(b.damage, dir);
        this.fx.impactRing(b.x, b.y, 0x40c8ff); // cyan shockwave for player
        b.kill();
      }
    }
  }

  /**
   * THE RETURNED SUPER, IN FLIGHT.
   *
   * Handset review of the release: the held state read as "he has my power"
   * and the flying state read as "a bright circle is at position A, and now it
   * is at position B". A round sprite translating across a floor gives the eye
   * nothing to read momentum from — the same problem enemy bolts had before
   * they were given a stretch and a wake, except this one must NOT be
   * stretched, because `Bullet.fire` sizes the body from the texture and
   * `Body.updateBounds` recomputes width from `|scaleX|`. Touching the
   * projectile's own scale would silently resize a 44px hitbox.
   *
   * So everything here is drawn AROUND the projectile and never on it. One
   * Graphics and three Images, created once and reused for the life of the
   * scene, and there is at most one orb in the world at a time by construction
   * (`Boss._tickMechanics` will not commit a release while one is winding up).
   * The allocation cost of the whole effect is four display objects, forever.
   *
   * OWNERSHIP: this is the only writer of these objects, and it writes nothing
   * on the bullet itself except `rotation`, which `Bullet.fire` sets once at
   * spawn and `_steer` would only touch on a homing round. This one never homes.
   */
  _tickSuperOrbs(delta) {
    const orb = this.bossSuperOrbs?.getChildren().find((o) => o.active);
    if (!orb) { this._hideSuperOrbFx(); return; }

    const fx = this._superOrbFx ?? (this._superOrbFx = {
      // Ghosts wear the orb's OWN texture, so the wake is unmistakably made of
      // the thing that is chasing you rather than of generic particles.
      ghosts: [0, 1, 2].map(() => this.add.image(0, 0, 'boss-force-orb')
        .setBlendMode(Phaser.BlendModes.ADD).setVisible(false)),
      corona: this.add.graphics().setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false),
      phase: 0,
    });

    // ── KINEMATICS: ONE SPEED ───────────────────────────────────────────
    // Rewritten here, every frame, from the heading stamped at release. This
    // is the ONLY writer of the orb's velocity — the same one-owner rule the
    // saber and the wake follow. It is rewritten rather than left to the
    // physics body so a wall graze or a stray impulse cannot bend the flight:
    // the heading and the speed are both promises.
    //
    // There was a launch->settle->cruise curve here and it is GONE, concept
    // and machinery both. The player's whole decision window is before
    // release; a projectile that sheds speed after launch is softening a
    // punish the player already had every chance to avoid.
    const MECH = ENDLESS.bossMech;
    if (orb._hx !== undefined) {
      orb._ageMs = (orb._ageMs ?? 0) + delta;
      orb.body.velocity.set(orb._hx * MECH.superReturnSpeed,
                            orb._hy * MECH.superReturnSpeed);

      // ── LIFETIME ──────────────────────────────────────────────────────
      // It flies until it hits the player, hits a wall, or leaves the world.
      // The out-of-bounds sweep is what makes that true: `Bullet.range` would
      // otherwise end the flight mid-arena on an inherited number, and the
      // orb's fantasy is a mass thrown across the room, not a bolt with a
      // fuse. The age cap below is defence against a stuck orb, not a design
      // constant — at this speed it is over four arena diagonals away.
      const wb = this.physics.world.bounds;
      const M = 120;
      if (orb.x < wb.x - M || orb.x > wb.right + M
          || orb.y < wb.y - M || orb.y > wb.bottom + M
          || orb._ageMs > MECH.superReturnMaxLifeMs) {
        orb.kill();
        this._hideSuperOrbFx();
        return;
      }
    }

    const vx = orb.body.velocity.x, vy = orb.body.velocity.y;
    const sp = Math.hypot(vx, vy) || 1;
    // FROM THE ACTUAL VELOCITY, never from the player's position. The orb is
    // aimed once and then ballistic, so a wake pointed at the player would
    // start lying the moment the player moved — which is the exact moment the
    // wake matters most.
    const ang = Math.atan2(vy, vx);
    const ux = vx / sp, uy = vy / sp;
    const px = -uy, py = ux;                 // unit vector across the heading
    // LAUNCH FRESHNESS — a VISUAL clock, and it has to stay one. It used to be
    // the kinematic impulse (1 at launch, 0 at cruise) and the head's amplitude
    // rode on it for free; with the speed now constant there is no such
    // quantity, so it is stated outright as time since release. The orb's body
    // churns identically at every point of the flight — only the first quarter
    // second of it is a little more violent, which is the transformation from
    // "in his hand" to "crossing the room".
    const imp = 1 - Math.min(1, (orb._ageMs ?? 0) / 260);

    // ── The wake ────────────────────────────────────────────────────────
    // Three remnants at FIXED DISTANCES behind the orb, each smaller and
    // fainter. Deliberately SHORT — the hazard is the orb, and a wake long
    // enough to look like a lane would be claiming a hit region that does not
    // exist. WAKE_LAG is the whole length of the claim: 78px behind a 44px
    // body, so the effect never extends much past two body widths.
    //
    // Distance, not sampled history. The first version kept the last few
    // positions and drew the remnants at every other one, which makes the
    // wake's LENGTH a function of the frame rate: tight at 60fps on a phone,
    // and — as the evidence rig photographed — strung out over 250px in a
    // ~20fps headless run, where it stops reading as a wake and starts reading
    // as three separate objects. Anchoring to distance makes the shape
    // identical on every device, and the orb travels a straight line (it is
    // aimed once and never steers), so nothing is lost by not curving.
    fx.ghosts.forEach((gh, i) => {
      const lag = 26 + i * 26;
      gh.setVisible(true)
        .setPosition(orb.x - ux * lag, orb.y - uy * lag)
        .setDepth(DEPTH.AIR - 2 - i)
        .setRotation(ang)
        .setScale(0.82 - i * 0.17)
        .setAlpha(0.40 - i * 0.13);
    });

    // ── THE BODY ITSELF ─────────────────────────────────────────────────
    // Handset finding: the wake said where the orb had BEEN, and the orb still
    // read as a round sprite whose coordinates changed. So the mass gets a
    // front, a back and genuine internal motion — all of it drawn here, on one
    // Graphics, around a LOCAL origin with the object positioned at the orb (a
    // Graphics scales and rotates about its own origin, so drawing at world
    // coordinates and then transforming throws it off the screen — the same
    // trap `FX.saberParry` documents).
    //
    // The sprite's SCALE is never touched. `Body.updateBounds` recomputes the
    // hitbox width from |scaleX|, so an envelope animated by scaling the sprite
    // would animate the collision circle with it. Rotation is free — a circular
    // body does not care — so the sprite gets the precession and the Graphics
    // gets everything else.
    fx.phase += delta * 0.006;
    const ph = fx.phase;
    const g = fx.corona;
    const R = orb.body.radius || 44;
    g.setVisible(true).setPosition(orb.x, orb.y).setDepth(DEPTH.AIR - 1);
    g.clear();

    // Precession: the texture rolls slowly about the heading rather than
    // spinning uniformly, which is what stops it reading as a spinning decal.
    orb.setRotation(ang + Math.sin(ph * 0.9) * 0.30);

    // ── THE SHELL ───────────────────────────────────────────────────────
    // Three overlapping lobes on their own rates and phases. Consecutive
    // frames genuinely differ because no two rates are harmonics of each
    // other; an even ring would read as a containment bubble, and this thing
    // is explicitly not contained.
    for (let i = 0; i < 3; i++) {
      const a = ph * (0.7 + i * 0.53) + i * 2.4;
      const off = R * (0.16 + 0.07 * Math.sin(ph * 1.9 + i));
      g.fillStyle(i === 0 ? 0xff3838 : 0xff5a5a, 0.20);
      g.fillCircle(Math.cos(a) * off, Math.sin(a) * off,
                   R * (0.80 + 0.10 * Math.sin(ph * 2.3 + i * 1.7)));
    }

    // ── INTERNAL ARCS ───────────────────────────────────────────────────
    // Two, counter-rotating, at different radii and different rates, each
    // squashed along a slowly turning axis so the sphere reads as volumetric
    // rather than as a flat disc with a spinning ring on it.
    g.lineStyle(3, 0xffd0d0, 0.55);
    g.beginPath(); g.arc(0, 0, R * 0.64, ph * 1.7, ph * 1.7 + 2.3); g.strokePath();
    g.lineStyle(2, 0xffffff, 0.45);
    g.beginPath(); g.arc(0, 0, R * 0.40, -ph * 2.6, -ph * 2.6 + 1.7); g.strokePath();

    // ── TONGUES ─────────────────────────────────────────────────────────
    // Uneven, and biased along the heading: longer at the back where the
    // envelope is being dragged, clipped at the front where it is being
    // compressed. This is the part that says which way it is going even with
    // the wake hidden.
    g.lineStyle(3, 0xff4040, 0.55);
    for (let i = 0; i < 7; i++) {
      const a = ph * 0.8 + (i / 7) * Math.PI * 2;
      const backness = 0.5 - 0.5 * Math.cos(a - ang);   // 0 ahead, 1 behind
      const len = R * (0.98 + 0.18 * Math.abs(Math.sin(ph * 1.7 + i * 2.1))
                            + (0.24 + 0.30 * imp) * backness);
      g.lineBetween(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86,
                    Math.cos(a) * len,      Math.sin(a) * len);
    }

    // ── THE REAR ────────────────────────────────────────────────────────
    // A modest backward stretch of the envelope — three decaying blobs, not a
    // cone and not a tail. Their reach grows with the launch impulse and
    // settles back; their brightness does not, because the orb at cruise is
    // exactly as dangerous as the orb at launch.
    for (let i = 1; i <= 3; i++) {
      const d = R * (0.52 + 0.16 * imp) * i;
      g.fillStyle(0xff3030, 0.24 - i * 0.05);
      g.fillCircle(-ux * d, -uy * d, R * (0.54 - i * 0.12));
    }
    // Fragments shearing off the shoulders, angled outward as well as back —
    // energy being stripped away, rather than an exhaust plume.
    g.lineStyle(2, 0xffb060, 0.5);
    for (let i = -1; i <= 1; i++) {
      const spread = 0.42 + 0.10 * Math.sin(ph * 3.1 + i);
      const a = ang + Math.PI + i * spread;
      const l = R * (0.55 + 0.30 * Math.abs(Math.sin(ph * 2.7 + i * 1.3)));
      const bx = -ux * R * 0.5 + px * i * R * 0.34;
      const by = -uy * R * 0.5 + py * i * R * 0.34;
      g.lineBetween(bx, by, bx + Math.cos(a) * l, by + Math.sin(a) * l);
    }

    // ── THE HEAD ────────────────────────────────────────────────────────
    // Handset finding on the first attempt: two clean concentric crescents in
    // front of the body read as a bright `)` stuck onto a circle — generic,
    // and geometric in a way nothing else about this object is. Deleted. A
    // circular arc IS a parenthesis, however it is coloured, so the leading
    // edge is now made of the same material as the rest of the orb: a hot core
    // shoved forward, uneven tongues torn off it, and shell that folds back
    // over the shoulders. Everything is keyed off `ang` — the ACTUAL velocity
    // — and everything wobbles on its own rate, so no two consecutive frames
    // photograph the same shape and none of it can be mistaken for a fixed
    // nose, a reticle or a claim on the floor ahead.
    //
    // Reach is bounded at ~1.35R, the same as the old shock, so the drawing
    // still never implies more danger than the 44px body carries.

    // The core, riding forward into the leading hemisphere and drifting across
    // it — the mass is being shovelled against the direction of travel.
    const lead = 0.30 + 0.05 * Math.sin(ph * 1.9);
    const yaw  = Math.sin(ph * 1.3) * 0.22;               // it does not aim
    const cx   = Math.cos(ang + yaw) * R * lead;
    const cy   = Math.sin(ang + yaw) * R * lead;
    g.fillStyle(0xffdcdc, 0.30);
    g.fillCircle(cx * 0.7, cy * 0.7, R * (0.60 + 0.05 * Math.sin(ph * 2.2)));
    g.fillStyle(0xffffff, 0.46);
    g.fillCircle(cx, cy, R * (0.34 + 0.05 * Math.sin(ph * 3.1)));

    // Leading tongues: ONE dominant, two short and unequal, all three sliding
    // about the front and swapping length. Filled triangles rather than lines,
    // so they read as material being torn rather than as drawn rays.
    for (let i = 0; i < 3; i++) {
      const wob = Math.sin(ph * (2.1 + i * 0.7) + i * 1.9);
      const off = (i === 0 ? 0.10 * wob : (i === 1 ? -0.62 : 0.55) + 0.14 * wob);
      const len = R * (i === 0 ? 1.16 + 0.16 * wob + 0.10 * imp
                               : 0.86 + 0.12 * wob + 0.06 * imp);
      const a = ang + off;
      const w = (i === 0 ? 0.30 : 0.20) + 0.05 * Math.sin(ph * 2.6 + i);
      g.fillStyle(i === 0 ? 0xffffff : 0xff7a5a, i === 0 ? 0.55 : 0.38);
      g.fillTriangle(
        Math.cos(a - w) * R * 0.42, Math.sin(a - w) * R * 0.42,
        Math.cos(a + w) * R * 0.42, Math.sin(a + w) * R * 0.42,
        Math.cos(a + 0.06 * wob) * len, Math.sin(a + 0.06 * wob) * len,
      );
    }

    // Shell folding BACK from the front: two ragged polylines that start near
    // the leading edge and peel over the shoulders. Segment radii jitter per
    // vertex, which is what keeps them from closing into an arc.
    for (const side of [-1, 1]) {
      g.lineStyle(3, 0xffb4b4, 0.45);
      g.beginPath();
      for (let k = 0; k <= 5; k++) {
        const t = k / 5;
        const a = ang + side * (0.25 + t * 1.5);
        const rr = R * (0.98 - 0.22 * t + 0.09 * Math.sin(ph * 2.4 + k * 1.6 + side));
        const X = Math.cos(a) * rr, Y = Math.sin(a) * rr;
        if (k === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
      }
      g.strokePath();
    }

    // Shoulder fragments peeling off the leading edge and falling behind —
    // material actually being stripped, which is the other half of "this side
    // is cutting". Short, and they die well inside the wake.
    g.fillStyle(0xffc890, 0.42);
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1;
      const t = ((ph * 0.6 + i * 0.25) % 1);              // 0 at the front, 1 behind
      const a = ang + side * (0.45 + t * 1.1);
      const rr = R * (0.95 + 0.30 * t);
      g.fillCircle(Math.cos(a) * rr - ux * R * 0.30 * t,
                   Math.sin(a) * rr - uy * R * 0.30 * t,
                   R * 0.13 * (1 - t * 0.7));
    }

  }

  /**
   * Park the flight effect.
   *
   * Hidden rather than destroyed, because the objects are reused and there is
   * at most one orb at a time — but the trail history MUST be cleared, or the
   * next orb's first frames would draw ghosts at the previous one's positions,
   * on the other side of the room.
   */
  _hideSuperOrbFx() {
    const fx = this._superOrbFx;
    if (!fx) return;
    fx.corona.setVisible(false);
    fx.ghosts.forEach((gh) => gh.setVisible(false));
  }

  handleBulletWallHits(group, isSuper = false) {
    const bullets = group.getChildren();
    if (!bullets.length) return;
    const walls = this.walls.getChildren();
    for (const b of bullets) {
      if (!b.active) continue;
      if (b.body && b.body.enable === false) continue;   // still in the air
      for (const w of walls) {
        if (!w.active) continue;
        // Test the obstacle's BODY, not a hardcoded +/-56 box around its
        // origin. The literal assumed every obstacle was a ~112px tile, which
        // (a) let bullets fly through anything larger, such as a room prop,
        // and (b) already stopped them 21px shy of a cover console on every
        // side, since cover is a 70x70 body under a 112x112 sprite.
        const wb = w.body;
        const hw = (wb ? wb.width  : w.displayWidth)  / 2;
        const hh = (wb ? wb.height : w.displayHeight) / 2;
        const wx = wb ? wb.x + wb.width  / 2 : w.x;
        const wy = wb ? wb.y + wb.height / 2 : w.y;
        if (Math.abs(b.x - wx) < hw && Math.abs(b.y - wy) < hh) {
          // Directional ricochet sparks: bullet hit a wall, sparks deflect
          // along the reverse flight direction (i.e. bounce back at us).
          const flightAng = Math.atan2(b.body.velocity.y, b.body.velocity.x);
          const ricochetAng = flightAng + Math.PI;
          this.fx.burstDir(b.x, b.y, 'yellow', isSuper ? 14 : 6, ricochetAng, 70);
          
          this.fx.impactRing(b.x, b.y, 0xb0b0b0); // grey shockwave for walls
          
          // Micro-flash — bright white pop at the moment of impact, decays
          // over 80ms. Sells the hit before the persistent scorch settles.
          this._impactMicroFlash(b.x, b.y, isSuper ? 14 : 8);
          // Persistent scorch (super → big crater, regular → small mark)
          if (isSuper) this.spawnCrater(b.x, b.y);
          else         this.spawnScorch(b.x, b.y);
          if (isSuper) { this.fx.explosion(b.x, b.y, 1.2); this.fx.shake(0.005, 60); }
          
          // Propagate sound if it is player's bullet hitting the wall
          if (group === this.playerBullets || group === this.playerRifleBullets
              || group === this.playerFragBullets) {
            this.propagateSound(b.x, b.y, 250);
          }
          
          b.kill();
          break;
        }
      }
    }
  }

  updateHealthOrbs(delta) {
    const p = this.player;
    const pickupR = HEALTH_ORB.radius + PLAYER.radius;
    let i = this.healthOrbs.length;
    while (i--) {
      const orb = this.healthOrbs[i];
      orb.life -= delta;
      if (orb.life <= 0) {
        this.tweens.killTweensOf(orb.gfx); orb.gfx.destroy();
        this.healthOrbs.splice(i, 1); continue;
      }
      if (orb.life < 1500) orb.gfx.setAlpha(orb.life / 1500);
      const dx = p.x - orb.x, dy = p.y - orb.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 80 && p.alive) {
        const move = Math.min(dist, 320 * delta / 1000);
        orb.x += (dx / dist) * move; orb.y += (dy / dist) * move;
        orb.gfx.setPosition(orb.x, orb.y);
      }
      if (dist < pickupR && p.alive && p.hp < p.hpMax) {
        const healed = Math.min(HEALTH_ORB.healAmount, p.hpMax - p.hp);
        p.hp = Math.min(p.hpMax, p.hp + HEALTH_ORB.healAmount);
        p.scene.events.emit('player-hp-changed');
        this.fx.damageNumber(orb.x, orb.y - 20, `+${Math.round(healed)} HP`, '#40b8ff', false);
        // Healing juice: sparkle + soft cyan camera flash
        this.fx.pickupSparkle(orb.x, orb.y, 14);
        this.cameras.main.flash(110, 60, 200, 255, true);
        this.tweens.killTweensOf(orb.gfx); orb.gfx.destroy();
        this.healthOrbs.splice(i, 1); SFX.heal();
      }
    }
  }

  circleOverlap(a, b) {
    const ra   = (a.body?.width || 14) / 2;
    const rb   = b.cfg?.radius ?? (b === this.player ? PLAYER.radius : 22);
    return Math.hypot(a.x - b.x, a.y - b.y) < ra + rb - 2;
  }

  // ── Aim cone ─────────────────────────────────────────────────────────────

  // Render a soft vision cone on each patrolling enemy. Yellow when they
  // can't see the player, red when the player is inside the cone.
  _drawPatrolVision() {
    const g = this.visionGraphics;
    g.clear();
    if (!this.debugAI) return;
    const p = this.player;
    if (!p?.alive) return;

    const steps    = 14;
    const range    = VISION_RANGE;
    const halfAng  = VISION_HALF_ANGLE;

    for (const e of this.enemies.getChildren()) {
      if (!e.active || !e.alive) continue;
      if (e.state !== ST.PATROL && e.state !== ST.SUSPICIOUS) continue;
      const facing = e._aim;
      // Is the player inside the cone (and visible)?
      let seen = false;
      if (!p.hiddenInBush) {
        const dx = p.x - e.x, dy = p.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist < range) {
          const angTo = Math.atan2(dy, dx);
          const diff  = Phaser.Math.Angle.Wrap(angTo - facing);
          if (Math.abs(diff) < halfAng) {
            seen = e._hasLOS(e.x, e.y, p.x, p.y);
          }
        }
      }
      const color = seen ? 0xff4040 : 0xffdd40;
      const alpha = seen ? 0.20    : 0.10;
      g.fillStyle(color, alpha);
      g.beginPath();
      g.moveTo(e.x, e.y);
      for (let i = 0; i <= steps; i++) {
        const a = facing - halfAng + (halfAng * 2 * i) / steps;
        g.lineTo(e.x + Math.cos(a) * range, e.y + Math.sin(a) * range);
      }
      g.closePath();
      g.fillPath();
      // Subtle outline
      g.lineStyle(1, color, alpha * 2);
      g.strokePath();
    }
  }

  // ── AI debug overlay ─────────────────────────────────────────────────────
  // Press D in-game to toggle. Draws a state-coloured dot above each enemy
  // and a line to its current movement target so stuck states are obvious.

  _drawAIDebug() {
    if (!this.debugAI) {
      this.debugGraphics?.clear();
      this.debugTexts.forEach(t => t.setVisible(false));
      return;
    }
    const g = this.debugGraphics;
    g.clear();

    const STATE_COL = {
      [ST.PATROL]:     0x00ff00, // green
      [ST.SUSPICIOUS]: 0xffaa00, // amber
      [ST.ALERT]:      0xffff00, // yellow
      [ST.CHASE]:      0xff2020, // red
      [ST.COVER_MOVE]: 0xff8800, // orange
      [ST.SUPPRESS]:   0x2080ff, // blue
      [ST.REPOSITION]: 0xff00ff, // pink
      [ST.FLANK]:      0x00ffff, // cyan
      [ST.ADVANCE]:    0xffffff, // white
      [ST.SEARCH]:     0x8800ff, // purple
    };

    // Draw active sound events
    const now = this.time.now;
    this._soundEvents = (this._soundEvents || []).filter(se => now - se.t < se.duration);
    for (const se of this._soundEvents) {
      const elapsed = now - se.t;
      const alpha = 0.45 * (1 - elapsed / se.duration);
      g.lineStyle(2, 0xffaa00, alpha);
      g.strokeCircle(se.x, se.y, se.r);
      g.fillStyle(0xffaa00, alpha * 0.12);
      g.fillCircle(se.x, se.y, se.r);
    }

    let idx = 0;
    const player = this.player;

    for (const e of this.enemies.getChildren()) {
      if (!e.active || !e.alive) continue;
      const col = STATE_COL[e.state] ?? 0xffffff;

      // State indicator — coloured dot above enemy
      g.fillStyle(col, 0.95);
      g.fillCircle(e.x, e.y - e.cfg.radius - 30, 8);

      // Facing direction vector line
      const aimLen = 42;
      const ax = e.x + Math.cos(e._aim) * aimLen;
      const ay = e.y + Math.sin(e._aim) * aimLen;
      g.lineStyle(2, 0x00ffff, 0.85);
      g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(ax, ay); g.strokePath();
      g.fillStyle(0x00ffff, 0.85); g.fillCircle(ax, ay, 3);

      // FOV cone and ranges
      const curRange = (e.state === ST.PATROL || e.state === ST.SUSPICIOUS) ? VISION_RANGE : 720; // ALERT_VISION_RANGE
      g.lineStyle(1, curRange === VISION_RANGE ? 0xffdd40 : 0xff4040, 0.2);
      g.strokeCircle(e.x, e.y, curRange);

      if (e.state === ST.PATROL || e.state === ST.SUSPICIOUS) {
        g.fillStyle(0xffdd40, 0.04);
        g.beginPath();
        g.moveTo(e.x, e.y);
        const steps = 14;
        for (let i = 0; i <= steps; i++) {
          const a = e._aim - VISION_HALF_ANGLE + (VISION_HALF_ANGLE * 2 * i) / steps;
          g.lineTo(e.x + Math.cos(a) * VISION_RANGE, e.y + Math.sin(a) * VISION_RANGE);
        }
        g.closePath();
        g.fillPath();
      } else {
        g.fillStyle(0xff4040, 0.025);
        g.fillCircle(e.x, e.y, 720);
      }

      // Line of Sight Ray (from enemy to player)
      if (player?.alive) {
        const hasLOS = e._hasLOS(e.x, e.y, player.x, player.y);
        const dist = Math.hypot(player.x - e.x, player.y - e.y);
        
        let inCone = true;
        if (e.state === ST.PATROL || e.state === ST.SUSPICIOUS) {
          const angleTo = Math.atan2(player.y - e.y, player.x - e.x);
          const diff = Phaser.Math.Angle.Wrap(angleTo - e._aim);
          inCone = Math.abs(diff) < VISION_HALF_ANGLE;
        }

        let rayCol = 0xff3333; // red
        let rayAlpha = 0.45;
        if (player.hiddenInBush && dist >= 38 && !(player.revealTimer > 0)) {
          rayCol = 0x888888; // grey (player hidden in bush)
          rayAlpha = 0.35;
        } else if (inCone && dist < curRange && hasLOS) {
          rayCol = 0x33ff33; // green
          rayAlpha = 0.75;
        }

        g.lineStyle(1.5, rayCol, rayAlpha);
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(player.x, player.y); g.strokePath();
      }

      // Last known player position crosshair
      if (e.state !== ST.PATROL && e.lastKnownX != null) {
        g.lineStyle(1.5, 0xff2828, 0.8);
        g.beginPath();
        g.moveTo(e.lastKnownX - 10, e.lastKnownY);
        g.lineTo(e.lastKnownX + 10, e.lastKnownY);
        g.moveTo(e.lastKnownX, e.lastKnownY - 10);
        g.lineTo(e.lastKnownX, e.lastKnownY + 10);
        g.strokePath();
        g.lineStyle(1, 0xff2828, 0.35);
        g.strokeCircle(e.lastKnownX, e.lastKnownY, 8);
      }

      // Target path line
      let tx = null, ty = null;
      switch (e.state) {
        case ST.SUSPICIOUS:
          tx = e.suspiciousTargetX; ty = e.suspiciousTargetY; break;
        case ST.CHASE:
        case ST.ADVANCE:
        case ST.SEARCH:
          tx = e.lastKnownX; ty = e.lastKnownY; break;
        case ST.COVER_MOVE:
        case ST.SUPPRESS:
        case ST.REPOSITION:
          tx = e.standPos?.x ?? e.coverSpot?.x;
          ty = e.standPos?.y ?? e.coverSpot?.y; break;
        case ST.FLANK:
          if (e.flankTarget) { tx = e.flankTarget.x; ty = e.flankTarget.y; } break;
        default: break;
      }
      if (tx != null) {
        g.lineStyle(2, col, 0.75);
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(tx, ty); g.strokePath();
        g.fillStyle(col, 0.45); g.fillCircle(tx, ty, 8);
      }

      // Debug Text Label
      let debugText = this.debugTexts[idx];
      if (!debugText) {
        debugText = this.add.text(0, 0, '', {
          fontFamily: 'Outfit, Arial, sans-serif',
          fontSize: '11px',
          fontWeight: 'bold',
          color: '#ffffff',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: { x: 5, y: 3 },
        }).setOrigin(0.5, 1).setDepth(130);
        this.debugTexts.push(debugText);
      }

      // Map internally tracked states to human-readable state categories
      let mappedState = e.state;
      if (e.state === ST.PATROL) {
        mappedState = (e.patrolWait > 0 || !e.patrolPath.length) ? 'idle' : 'patrol';
      } else if (e.state === ST.SUSPICIOUS) {
        mappedState = 'suspicious';
      } else if (e.state === ST.ALERT) {
        mappedState = (e.alertMark?.text === '?') ? 'suspicious' : 'alerted';
      } else if (e.state === ST.CHASE || e.state === ST.SUPPRESS || e.state === ST.COVER_MOVE || e.state === ST.FLANK || e.state === ST.ADVANCE) {
        mappedState = 'attacking';
      } else if (e.state === ST.SEARCH) {
        mappedState = 'searching';
      }

      // Reason for detection/non-detection
      let reason = 'Spotted';
      if (player?.alive) {
        const dist = Math.hypot(player.x - e.x, player.y - e.y);
        const hasLOS = e._hasLOS(e.x, e.y, player.x, player.y);
        
        if (player.hiddenInBush) {
          if (dist < 38) {
            reason = 'Touch in Bush';
          } else if (player.revealTimer > 0) {
            reason = 'Revealed (Firing in Bush)';
          } else {
            reason = 'Hidden in Bush';
          }
        } else if (dist > curRange) {
          reason = `Outside Range (${Math.round(dist)}px / ${curRange}px)`;
        } else if (e.state === ST.PATROL) {
          const angleTo = Math.atan2(player.y - e.y, player.x - e.x);
          const diff = Phaser.Math.Angle.Wrap(angleTo - e._aim);
          if (Math.abs(diff) >= VISION_HALF_ANGLE) {
            reason = 'Behind/Outside Cone';
          } else if (!hasLOS) {
            reason = 'LOS Blocked (Wall)';
          }
        } else if (!hasLOS) {
          reason = 'LOS Blocked (Wall)';
        }
      } else {
        reason = 'Player Dead';
      }

      debugText.setText(`State: ${mappedState.toUpperCase()}\nReason: ${reason}`);
      debugText.setPosition(e.x, e.y - e.cfg.radius - 50);
      debugText.setVisible(true);
      idx++;
    }

    // Hide unused debug labels
    for (let i = idx; i < this.debugTexts.length; i++) {
      this.debugTexts[i].setVisible(false);
    }
  }

  drawAimCone() {
    const g = this.aimGraphics;
    g.clear();
    const p = this.player;
    if (!p?.alive) { this.fx?.hideSuperChargeOrb?.(); this._hideMeleeGhost(); return; }
    const gap = PLAYER.radius + 6;
    let activeAim = null, activeRange = 0, activeSpread = 0;
    if (p.superAiming && p.superCharge >= PLAYER.superHitsToCharge) {
      // Hotter cone while the super is aimed and ready — it should read as
      // charged, not the same weight as the primary cone.
      this.drawCone(g, p.x, p.y, p.superAim,
        Phaser.Math.DegToRad(PLAYER.superSpreadDeg), PLAYER.superRange, gap,
        0xff4020, 0xffc0a0, 0.42);
      // Charge tell: pulsing white-hot orb at the muzzle during the aim hold.
      // Free — this window already exists, so it costs the shot no delay.
      const mx = p.x + Math.cos(p.superAim) * (PLAYER.radius + 14);
      const my = p.y + Math.sin(p.superAim) * (PLAYER.radius + 14);
      this.fx?.superChargeOrb?.(mx, my, this.time.now);
      activeAim = p.superAim;
      activeRange = PLAYER.superRange;
    } else {
      // Not holding a charged super — make sure the charge orb is cleared.
      this.fx?.hideSuperChargeOrb?.();
      if (p.aiming) {
        this.drawCone(g, p.x, p.y, p.aim,
          Phaser.Math.DegToRad(PLAYER.pelletSpreadDeg), PLAYER.pelletRange, gap,
          0xff2828, 0xff9090, 0.18);
        activeAim = p.aim;
        activeRange = PLAYER.pelletRange;
      }
    }
    // Aim laser — thin red line + dot to first wall hit. Only when actively
    // aiming (right stick held). Sits on top of the cone for clarity.
    if (activeAim != null) this._drawAimLaser(g, p.x, p.y, activeAim, activeRange, gap);

    // Melee telegraph, drawn last so it sits over the gun's cone if both are up.
    // Deliberately cyan — the super's cone is hot red and the two must never be
    // confusable at a glance.
    if (p.meleeAiming) this._drawMeleeTelegraph(g, p, gap);
    else this._hideMeleeGhost();
  }

  // What the next cast will actually do. Casts 1-2 preview the swing cone;
  // cast 3 previews the RADIAL slam as a full circle, because that is the shape
  // it hits — a cone there would be a lie.
  _drawMeleeTelegraph(g, p, gap) {
    const CY = 0x3aa8e8, GLOW = 0x90d8ff;
    const PREVIEW_MS = 1000;   // one dry run of the cast per second, looping
    const dir = p.meleeAim;
    const finisher = p._comboStage >= 2;

    // Where the gap-close lunge will actually put the player. Derived from the
    // same solver the lunge uses, so the preview cannot disagree with it.
    const spd = finisher ? PLAYER.meleeFinisherLungeSpeed : PLAYER.meleeLungeSpeed;
    const travel = (p._gapCloseMs(dir, spd, finisher) / 1000) * spd;
    const lx = p.x + Math.cos(dir) * travel;
    const ly = p.y + Math.sin(dir) * travel;

    // The telegraph is a faint DRY RUN of the cast, looping while held: a ghost
    // of the player standing where the lunge will actually drop them, playing
    // the pose the cast will play, with the blade sweep it will sweep. An
    // abstract wedge told you the numbers; this tells you the move.
    const loop = (this.time.now % PREVIEW_MS) / PREVIEW_MS;
    const ease = Phaser.Math.Easing.Cubic.Out(loop);
    const fade = 1 - Math.pow(loop, 2.2);   // holds, then drops — as bladeArc does

    // Footprint of what actually gets hit, dimmed right back: it is reference,
    // not the subject.
    if (finisher) {
      g.fillStyle(CY, 0.10);
      g.fillCircle(lx, ly, PLAYER.meleeSlamRadius);
      g.lineStyle(2, GLOW, 0.40);
      g.strokeCircle(lx, ly, PLAYER.meleeSlamRadius);
      // Preview of the shockwave: a ring running the same expansion the slam
      // will run, on the same loop as the ghost's flip.
      g.lineStyle(3, GLOW, 0.55 * fade);
      g.strokeCircle(lx, ly, PLAYER.meleeSlamRadius * ease);
    } else {
      const half = Phaser.Math.DegToRad(PLAYER.meleeArcDeg) / 2;
      g.fillStyle(CY, 0.10);
      g.beginPath();
      g.moveTo(lx, ly);
      g.arc(lx, ly, PLAYER.meleeRange, dir - half, dir + half, false);
      g.closePath();
      g.fillPath();
      g.lineStyle(2, GLOW, 0.40);
      g.beginPath();
      g.arc(lx, ly, PLAYER.meleeRange, dir - half, dir + half, false);
      g.strokePath();
    }

    // The swing itself, swept on the loop — same crescent geometry the real
    // bladeArc draws, at a fraction of its opacity.
    this._drawPreviewArc(g, lx, ly, dir,
      finisher ? PLAYER.meleeSlamRadius * 0.55 : PLAYER.meleeRange * 0.78,
      p._comboStage + 1, ease, fade);

    // Run-up. Dashes crawl along the path on the same loop so the telegraph
    // reads as travel rather than a static line.
    if (travel > gap + 4) {
      const DASH = 13, STEP = 24;
      g.lineStyle(2, GLOW, 0.45);
      for (let d = gap + loop * STEP; d < travel - 2; d += STEP) {
        const e = Math.min(d + DASH, travel - 2);
        g.beginPath();
        g.moveTo(p.x + Math.cos(dir) * d, p.y + Math.sin(dir) * d);
        g.lineTo(p.x + Math.cos(dir) * e, p.y + Math.sin(dir) * e);
        g.strokePath();
      }
    }

    this._drawMeleeGhost(p, lx, ly, dir, finisher, ease);
  }

  // Translucent stand-in for the player at the landing point, posed the way the
  // cast will pose them: casts 1-2 lean into the swing, the finisher cartwheels
  // through a full 360 (Player._meleeFlipRad). setTintFill, not setTint — the
  // sprite is already near-black, so a multiply tint would show nothing (the
  // same trap the dash afterimage documents at _spawnDashAfterimage).
  _drawMeleeGhost(p, lx, ly, dir, finisher, ease) {
    // Phaser REUSES the scene instance across a restart, so this cached handle
    // outlives the image it points at: shutdown destroys the game object and
    // clears its `scene`, but the property survives into the next run. Checking
    // `.scene` (not just truthiness) is what makes the cache safe — without it
    // the first aim after a restart crashed inside setTexture on `scene.sys`.
    let ghost = this._meleeGhost;
    if (!ghost || !ghost.scene) {
      ghost = this._meleeGhost = this.add.image(lx, ly, p.texture.key, p.frame.name)
        .setTintFill(0x7fe0ff)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
    ghost.setTexture(p.texture.key, p.frame.name)
      .setPosition(lx, ly)
      .setVisible(true)
      .setDepth(ly - 2)
      .setFlipX(Math.cos(dir) < 0);
    if (finisher) {
      // Airborne somersault: spin, plus the rise-and-fall of the leap.
      const air = Math.sin(ease * Math.PI);
      ghost.setAngle(Phaser.Math.RadToDeg(ease * Math.PI * 2));
      ghost.setScale(p.scaleX * (1 + air * 0.22));
      ghost.setAlpha(0.30 + air * 0.16);
    } else {
      const side = p._comboStage === 1 ? -1 : 1;   // casts 1 and 2 mirror
      ghost.setAngle(Math.sin(ease * Math.PI) * 26 * side);
      ghost.setScale(p.scaleX);
      ghost.setAlpha(0.34);
    }
  }

  _hideMeleeGhost() {
    if (this._meleeGhost?.scene) this._meleeGhost.setVisible(false);
  }

  // The crescent bladeArc will sweep, at preview weight. Kept in step with
  // FX.bladeArc's geometry so the dry run and the real thing agree.
  _drawPreviewArc(g, x, y, angle, radius, stage, t, fade) {
    const d = stage === 2 ? -1 : 1;
    const span = stage >= 3 ? Math.PI * 1.5 : Math.PI * 0.95;
    const maxT = stage >= 3 ? 22 : 14;
    const a0 = angle - d * span / 2;
    const N = 18;
    const band = (thick, colour, alpha) => {
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const a = a0 + d * span * t * u;
        const ht = thick * Math.sqrt(u);
        pts.push(new Phaser.Geom.Point(x + Math.cos(a) * (radius + ht),
                                       y + Math.sin(a) * (radius + ht)));
      }
      for (let i = N; i >= 0; i--) {
        const u = i / N;
        const a = a0 + d * span * t * u;
        const ht = thick * Math.sqrt(u);
        pts.push(new Phaser.Geom.Point(x + Math.cos(a) * (radius - ht),
                                       y + Math.sin(a) * (radius - ht)));
      }
      g.fillStyle(colour, alpha);
      g.fillPoints(pts, true);
    };
    band(maxT, 0x3aa8e8, 0.28 * fade);
    band(maxT * 0.45, 0x90d8ff, 0.45 * fade);
  }

  // Thin red laser line from the gun tip out to the first wall hit (or full
  // range if clear). Draws on the existing aimGraphics so it lives in the
  // world layer behind the player but above the floor.
  _drawAimLaser(g, px, py, angle, range, startGap) {
    const sx = px + Math.cos(angle) * startGap;
    const sy = py + Math.sin(angle) * startGap;
    let ex = sx + Math.cos(angle) * range;
    let ey = sy + Math.sin(angle) * range;
    let nearest = range;
    const ray = new Phaser.Geom.Line(sx, sy, ex, ey);
    for (const w of this.walls.getChildren()) {
      const b = w.body;
      if (!b) continue;
      const rect = new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
      const pts = Phaser.Geom.Intersects.GetLineToRectangle(ray, rect);
      for (const p of pts) {
        const d = Math.hypot(p.x - sx, p.y - sy);
        if (d < nearest) { nearest = d; ex = p.x; ey = p.y; }
      }
    }
    // Low-ammo flicker: laser strobes redder/faster when down to 0-1 rounds
    // so you can feel reloads coming.
    const lowAmmo = this.player.ammo <= 1;
    const lineAlpha = lowAmmo
      ? 0.30 + 0.45 * Math.abs(Math.sin(this.time.now * 0.022))
      : 0.55;
    const dotAlpha  = lowAmmo
      ? 0.55 + 0.40 * Math.abs(Math.sin(this.time.now * 0.022))
      : 0.9;
    g.lineStyle(1.4, 0xff2828, lineAlpha);
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.strokePath();
    g.fillStyle(0xff8080, dotAlpha);
    g.fillCircle(ex, ey, 2.5);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(ex, ey, 1.2);
  }

  drawCone(g, x, y, angle, spread, range, startGap, color, tipColor, baseAlpha) {
    const half = spread / 2;
    const steps = 16;
    const bands = [
      { reach: 1.0, alpha: baseAlpha * 0.75 },
      { reach: 0.55, alpha: baseAlpha },
    ];
    for (const band of bands) {
      const r = startGap + (range - startGap) * band.reach;
      g.fillStyle(color, band.alpha);
      g.beginPath();
      g.moveTo(x + Math.cos(angle - half) * startGap * 0.6,
               y + Math.sin(angle - half) * startGap * 0.6);
      for (let i = 0; i <= steps; i++) {
        const a = angle - half + (spread * i) / steps;
        g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      g.lineTo(x + Math.cos(angle + half) * startGap * 0.6,
               y + Math.sin(angle + half) * startGap * 0.6);
      g.closePath();
      g.fillPath();
    }
    const tipX = x + Math.cos(angle) * range;
    const tipY = y + Math.sin(angle) * range;
    g.fillStyle(tipColor, 0.22); g.fillCircle(tipX, tipY, 20);
    g.fillStyle(tipColor, 0.55); g.fillCircle(tipX, tipY, 10);
  }

  // ── End states ────────────────────────────────────────────────────────────

  victory() {
    this.scene.start('GameOver', {
      win: true,
      stats: {
        clearTime: this.time.now - this.runStartTime,
        stealthKills: this.runStealthKills,
        kills: this.runKills || 0,
        damageTaken: Math.ceil(this.runDamageTaken),
        maxCombo: this.player ? this.player.runMaxCombo || 1.0 : 1.0,
        score: this.runScore || 0,
        seed: this.runSeed,
      }
    });
  }
  defeat()  {
    this.scene.start('GameOver', {
      win: false,
      mode: this.mode,
      stats: {
        clearTime: this.time.now - this.runStartTime,
        stealthKills: this.runStealthKills,
        kills: this.runKills || 0,
        damageTaken: Math.ceil(this.runDamageTaken),
        maxCombo: this.player ? this.player.runMaxCombo || 1.0 : 1.0,
        score: this.runScore || 0,
        seed: this.runSeed,
        sector: this.sector,
      }
    });
  }

  // ── Arena wave-clear logic ─────────────────────────────────────────────────
  // A room is a sequence of waves. Each wave drips its `count` spawn events
  // (capped at maxAlive), then the player must clear every enemy to advance;
  // a WAVE CLEAR reward + brief breather sits between waves.

  _tickArena(delta) {
    if (!this.arenaActive || !this.player?.alive) return;
    const cfg = this.arenaCfg;
    const wave = this._wave;
    if (!cfg || !wave) return;

    // Live "N left" feedback whenever the count changes.
    const living = this._livingEnemyCount();
    if (living !== this._lastLiving) {
      this._lastLiving = living;
      this.events.emit('wave-remaining', this._wavePhase === 'breather' ? 0 : living);
    }

    // Feed the music director. Throttled inside it, so this hands over every
    // frame's delta and lets it decide when to act; `living` is reused rather
    // than counted a second time.
    // The mini-boss dying is what ends the half-time feel; the wave itself
    // usually continues, so this cannot wait for the wave-clear cue.
    // The duel is over the moment the nemesis is, not when the last swarmling
    // it summoned is mopped up — the mop-up is the reward, not the fight.
    if (this._duelActive && !this._miniBossAlive) this._endDuel();

    if (this._musicMiniBoss && !this._miniBossAlive) {
      this._musicMiniBoss = false;
      if (this._wavePhase !== 'breather') setMusicPhase('wave');
    } else if (this._miniBossAlive) {
      this._musicMiniBoss = true;
    }

    // Feed the music director, but only on a sample — the throttle is checked
    // BEFORE the snapshot is built, so an object is not allocated and thrown
    // away on every frame just to be ignored. `living` is reused rather than
    // counted a second time.
    const musicDue = musicSampleDue(delta);
    if (musicDue) tickDirector(musicDue, {
      combo: this._comboCount || 0,
      lastKillAge: this.time.now - (this._lastKillTime ?? -99999),
      alive: living,
      maxAlive: cfg.maxAlive || 12,
      waveIdx: this._waveIdx,
      waveCount: this._roomArenaCfg?.waves?.length || 1,
      hpFrac: this.player ? this.player.hp / this.player.hpMax : 1,
    });

    if (this._wavePhase === 'spawning') {
      // Drip this wave's budget, capped at the concurrent maxAlive.
      this._waveDripMs += delta;
      if (this._waveSpawned < wave.count &&
          this._waveDripMs >= cfg.spawnRate &&
          living < cfg.maxAlive) {
        this._waveDripMs = 0;
        this.spawnAtGate(this._rollEnemyType());
        this._waveSpawned++;
      }
      if (this._waveSpawned >= wave.count) this._wavePhase = 'clearing';
    } else if (this._wavePhase === 'clearing') {
      // Budget spent — wait for the arena to be swept clean.
      if (living === 0) {
        this._onWaveCleared(wave);
        const waves = this._roomArenaCfg.waves;
        if (this._waveIdx >= waves.length - 1) {
          this._onArenaCompleted();
        } else {
          this._wavePhase = 'breather';
          this._breatherMs = 2500;
          // The bed keeps playing here — only a finished ROOM quiets it. Heat
          // decays on its own through the breather, so it settles by itself.
          setMusicPhase('breather');
        }
      }
    } else if (this._wavePhase === 'breather') {
      this._breatherMs -= delta;
      if (this._breatherMs <= 0) this._startWave(this._waveIdx + 1);
    }
  }

  // WAVE CLEAR: celebratory punctuation + a reward drop near the player.
  _onWaveCleared(wave) {
    this.events.emit('show-banner', 'WAVE CLEAR!', '#20ff60');
    this.cameras.main.flash(200, 64, 255, 128, true);
    this.fx.shake(0.005, 150);
    SFX.superReady?.();
    // Wipe the floor between waves. _startWave already clears on the way IN,
    // but a wave's worth of blood, scorch and craters otherwise stays on screen
    // through the whole clear/breather beat and reads as leftover mess.
    this.decalRT?.clear();
    this._awardWaveBonuses();
    this._spawnWaveReward(wave);
  }

  // Wave-clear scoring. Three separate payouts rather than one lump, because
  // each one asks for a different thing: finish it at all, finish it untouched,
  // finish it fast. They are announced individually so the player can tell
  // which one they earned and play for it next time.
  _awardWaveBonuses() {
    this.addScore(SCORE.waveClear);

    if ((this._waveDamage || 0) <= 0) {
      this.addScore(SCORE.waveFlawless);
      this.events.emit('score-medal', 'FLAWLESS', SCORE.waveFlawless, '#90d8ff');
    }

    // Full value at waveSpeedSecs, decaying linearly to zero at twice that, so
    // a fast clear is worth chasing without a cliff that makes one second the
    // difference between the whole bonus and none of it.
    const secs = (this.time.now - (this._waveStartedAt ?? this.time.now)) / 1000;
    const frac = Phaser.Math.Clamp(2 - secs / SCORE.waveSpeedSecs, 0, 1);
    const speed = Math.round(SCORE.waveSpeed * frac);
    if (speed > 0) {
      this.addScore(speed);
      if (frac > 0.5) this.events.emit('score-medal', 'FAST CLEAR', speed, '#ffd040');
    }
  }

  // Drop BOTH secondaries and let the player take one.
  //
  // This used to be `weapons[Phaser.Math.Between(0, 1)]` — a coin flip with no
  // player input, at the only two points in a run where the secondary weapon is
  // decided. The rifle and the cluster pod play completely differently, so the
  // single most build-defining choice in the game was being made for you.
  //
  // Deliberately NOT a modal card screen: these fire mid-wave, and freezing the
  // arena to read two cards would break the pace at exactly the wrong moment.
  // Dropping both and making you walk to one keeps the decision inside the
  // fight, which is where it is interesting.
  //
  // The pair is spaced well beyond WeaponPickup's 90px magnet so it cannot
  // grab both, and so committing to one really does mean giving up the other.
  spawnWeaponChoice(x, y, label = 'REWARD') {
    const SPREAD = 150;               // 300px apart, vs a 90px magnet radius
    const w = this.physics.world.bounds.width;
    const cx = Phaser.Math.Clamp(x, SPREAD + 60, w - SPREAD - 60);

    const offered = ['rifle', 'cluster'].map((id, i) => {
      const px = cx + (i === 0 ? -SPREAD : SPREAD);
      const wp = new WeaponPickup(this, px, y, id);
      this.weaponPickups.push(wp);
      this.fx.pickupSparkle(px, y, 12);
      return wp;
    });

    // Taking one retires the other. Polled from update() alongside the normal
    // pickup check; WeaponPickup has no collect event to subscribe to.
    this._pendingChoice = {
      offered,
      resolve: (taken) => {
        for (const other of offered) {
          if (other === taken || !other.active) continue;
          this.fx?.pickupSparkle?.(other.x, other.y, 6);
          other.destroy();
        }
        this._pendingChoice = null;
      },
    };

    this.events.emit('show-banner', `${label}: TAKE ONE`, '#ffd040');
  }

  // Reward template extracted from spawnTerminalSupportDrop: milestone/mini-boss
  // waves grant a weapon; ordinary waves grant sustain (bacta + shield).
  _spawnWaveReward(wave) {
    const rx = this.player.x, ry = this.player.y - 40;
    if (wave.reward === 'weapon') {
      this.spawnWeaponChoice(rx, ry, 'REWARD');
    } else {
      this.spawnHealthOrb(rx, ry);
      this.player.addShield(300);
      this.fx.pickupSparkle(rx, ry, 10);
    }
  }

  // Every nemesis still alive as the sector ends is written to the ledger.
  // Living through the sector IS the escape — there is no separate flee state,
  // and adding one would mean an enemy that runs away mid-fight, which reads as
  // the AI breaking rather than as a nemesis surviving.
  _recordEscapes() {
    for (const e of this.enemies.getChildren()) {
      if (!e.alive || !e._nemesis) continue;
      recordEscape(
        this.ledger, e._nemesis, this.sector || 1,
        e._drewBlood ? 'wounded-you' : 'survived',
        this.rng.nemesis,
      );
    }
  }

  /**
   * Who arrives this sector, in priority order:
   *
   *   1. Someone who got away and is due back — scarred, renamed, angrier.
   *   2. An heir to someone you killed, carrying one of their traits.
   *   3. A stranger.
   *
   * The order is the point. A fresh roll is the FALLBACK, not the default, so
   * the roster stays connected across a run: the enemies you meet are mostly
   * consequences of enemies you already met.
   *
   * Every branch draws from `this.rng.nemesis`, so the whole climb stays
   * reproducible from the run seed.
   */
  // ── Dialogue ──────────────────────────────────────────────────────────────
  //
  // The ledger has remembered everything worth saying for a while; until now
  // the entire payoff was a 26px medal that flew past in one second. These
  // raise `DialogueScene` instead — the character itself, talking about what
  // happened between you.
  //
  // A card is a FULL STOP: Game and HUD pause and it waits for a tap. That is
  // affordable only because cards are rare, and the thing that keeps them rare
  // is `_nemesisArrivalDialogue` refusing one for an enemy with no history. A
  // first-time stranger raises nothing. If this ever fires on every mini-boss
  // spawn it has regressed, and `smoke-dialogue` checks exactly that.

  /** Queue a card. `spec` is what DialogueScene.create takes, minus `game`. */
  queueDialogue(spec) {
    if (!spec || !spec.text) return;
    if (isDialogueMuted()) return;      // harnesses only — see systems/debug.js
    (this._dialogueQueue ||= []).push(spec);
    this._drainDialogue();
  }

  _drainDialogue() {
    if (!this._dialogueQueue?.length || this._dialogueOpen) return;

    // Never over another overlay. Two cards, or a card over the upgrade picker,
    // would leave whichever resumed second fighting the other over the pause
    // state — and `UpgradeScene` holds the door shut until it is answered.
    if (this.scene.isActive('Upgrade') || this.scene.isActive('Pause')
      || this.scene.isActive('Controls') || this.scene.isActive('Dialogue')) {
      // Retry rather than drop: consuming the line has already marked it spoken,
      // so discarding it here would silently burn a line the player never saw.
      // A timer created on a paused scene starts ticking when it resumes, which
      // is exactly when this wants to run again.
      this.time.delayedCall(600, () => this._drainDialogue());
      return;
    }

    const spec = this._dialogueQueue.shift();
    this._dialogueOpen = true;
    this.scene.launch('Dialogue', { ...spec, game: this });
    this.scene.pause();
    this.scene.pause('HUD');
  }

  /** Called by DialogueScene once it has resumed the scenes beneath it. */
  _dialogueClosed() {
    this._dialogueOpen = false;
    if (this._dialogueQueue?.length) this.time.delayedCall(320, () => this._drainDialogue());
  }

  /**
   * The card for a nemesis walking in — or null, which is the common case.
   *
   * Only a REMEMBERED one speaks: a returning grudge or an heir. A stranger has
   * no history to reference, so it keeps the banner and the trait line it
   * already had and does not stop the game.
   */
  _nemesisArrivalDialogue(nem) {
    if (!nem?.ledgerId) return null;                     // stranger
    const entry = this.ledger.entries.find((e) => e.id === nem.ledgerId);
    if (!entry) return null;

    const kind = entry.successorOf ? 'nemesis-heir' : 'nemesis-return';
    const ctx = nemesisContext(entry);
    const line = pickLine(kind, ctx, this.ledger.spoken, this.rng.nemesis);
    if (!line) return null;

    return {
      bust: `bust-${nem.base}`,
      name: displayName(entry),
      color: nem.tint,
      sub: grudgeLine(entry),
      text: line.text,
      traits: entry.traits,
    };
  }

  /** Vader's card. He has no ledger entry — `ledger.vader` is his record. */
  _vaderDialogue(kind) {
    const ctx = vaderContext(this.ledger.vader);
    const line = pickLine(kind, ctx, this.ledger.spoken, this.rng.boss);
    if (!line) return null;
    return {
      bust: 'bust-vader',
      name: 'DARTH VADER',
      color: '#ff2828',
      sub: ctx.encounters > 0 ? `ENCOUNTER ${ctx.encounters + 1}` : 'THE DARK LORD',
      text: line.text,
      traits: [],
    };
  }

  _nextNemesis() {
    const sector = this.sector || 1;
    const rng = this.rng.nemesis;

    const returning = dueAt(this.ledger, sector);
    if (returning) {
      applyScar(returning, sector, rng);
      returning.returnAtSector = null;   // consumed; re-armed if it escapes again
      return nemesisFromEntry(returning, sector, rng);
    }

    const vacancy = this.ledger.vacancies.shift();
    if (vacancy) {
      const heir = promoteSuccessor(this.ledger, vacancy, sector, rng);
      if (heir) return nemesisFromEntry(heir, sector, rng);
    }

    return rollNemesis(sector, { rng });
  }

  /**
   * Put a nemesis in its own body.
   *
   * A nemesis used to be the 20x20 trooper sheet at 1.8x, which is why it read
   * as "a not-scale-intended big classic enemy" — see the note above
   * paintNemesisSheet for what that art actually does at that scale. These
   * sheets are 32x32 at the same pixel scale, so the same on-screen size
   * carries 2.5x the detail; NEMESIS_RENDER_SCALE compensates for the larger
   * frame so the fight does not silently change size.
   *
   * Everything downstream builds animation keys from `_animPrefix`
   * (Enemy.preUpdate), so this is a texture swap and a prefix and nothing else.
   */
  _wearNemesisBody(e, nem) {
    const body = NEMESIS_BODIES[nem.base] || NEMESIS_BODIES.grunt;
    if (!this.textures.exists(body.tex)) return;   // never leave it invisible
    e.setTexture(body.tex);
    e._animPrefix = body.prefix;
    e.anims?.stop();
  }

  /**
   * Nemesis phase transitions at 66% and 33%.
   *
   * The pips on the duel bar are drawn at exactly these fractions, so the
   * player can see a transition coming rather than being surprised by one. A
   * phase does not hand the nemesis new moves it never showed — it speeds up
   * the cadence and announces itself, so the pressure changes without the
   * fight becoming unreadable at the moment it gets harder.
   */
  _tickNemesisPhase(e) {
    if (!e._miniBoss || !e.hpMax) return;
    const frac = e.hp / e.hpMax;
    const want = frac <= 0.33 ? 3 : (frac <= 0.66 ? 2 : 1);
    if (want <= (e._phase || 1)) return;   // never regresses on a regen tick
    e._phase = want;

    const tint = e._nemesis?.tint || '#ff8020';
    this.events.emit('show-banner', want === 3 ? 'ENRAGED' : 'PRESSING', tint);
    this.fx.burst(e.x, e.y, 'white', 18);
    this.fx.impactRing(e.x, e.y,
      Phaser.Display.Color.HexStringToColor(tint).color);
    this.fx.shake(0.018, 240);
    SFX.bossRoar?.();
    // Bring the next move forward so the transition reads as an escalation
    // rather than as a banner followed by the same pause as before.
    e._moveT = Math.min(e._moveT, 900);
    this.events.emit('nemesis-phase', e, want);
  }

  /**
   * `?duel=` — drop straight into a nemesis fight on load.
   *
   * The first nemesis a run can reach is at sector 3, so looking at one used to
   * cost two rooms of play every time, on a phone. That is why a dash that
   * covered a sixth of its lane survived a whole pass unnoticed: nobody replays
   * to sector 3 to watch the same 800ms telegraph again.
   *
   * `move` pins the nemesis to a single move on a short clock, which is the
   * difference between checking one attack and waiting out a 7-10s cycle
   * hoping the one you changed comes up.
   */
  /**
   * Wait for the run to actually be running, THEN start the debug duel.
   *
   * The first version hooked `loadRoom` and fired 900ms later. That consumed
   * the request against a scene whose player was not alive yet, so it returned
   * at the guard and the flag was gone — the link simply did nothing, silently,
   * which is the worst possible behaviour for a debug affordance. Poll for
   * readiness instead of guessing a delay.
   */
  _armDebugDuel() {
    const req = getDuelRequest();
    if (!req) return;
    setDuelRequest(null);            // consume once, whatever happens next
    let tries = 0;
    const attempt = () => {
      if (!this.scene.isActive()) return;
      if (this.player?.alive && this.roomSpec) { this._debugDuel(req); return; }
      if (++tries > 40) return;      // ~12s, then give up rather than spin
      this.time.delayedCall(300, attempt);
    };
    this.time.delayedCall(300, attempt);
  }

  _debugDuel(req) {
    if (!this.player?.alive) return;
    if (req.sector) {
      this.sector = req.sector;
      this._applySectorScaling?.(this.roomSpec);
      this.events.emit('sector-changed', this.sector);
    }

    const nem = rollNemesis(this.sector || 3, {
      rng: this.rng.nemesis,
      ...(req.base ? { base: req.base } : {}),
      ...(req.traits ? { traits: req.traits } : {}),
    });

    this._duelActive = true;
    this.enemies.getChildren()
      .filter((e) => e.alive && !e._miniBoss)
      .forEach((e) => this._destroyEnemyFully(e));
    this._waveSpawned = 999;
    this._wavePhase = 'clearing';
    setMusicPhase('miniboss');
    SFX.bossRoar?.();

    const e = this._spawnMiniBoss(nem);
    if (!e) return;

    // Put it ON SCREEN. `_spawnMiniBoss` places a nemesis at the gate FARTHEST
    // from the player so it makes an entrance, which in play is right — it
    // walks to you. For a debug link it means opening the URL and looking at an
    // empty room with a chevron at the edge, so the first thing the tool does
    // is fail at its one job. Placed below the player because the camera shows
    // more room that way in portrait.
    const b = this.physics.world.bounds;
    e.setPosition(
      Phaser.Math.Clamp(this.player.x, 120, b.width - 120),
      Phaser.Math.Clamp(this.player.y - 360, 120, b.height - 120),
    );
    e.body?.setVelocity(0, 0);
    this.events.emit('duel-start', e);

    if (req.move) {
      // Pin it. `_moveIds` is what the cast clock cycles, so a single-entry
      // list means every cast is the move under test — no registry lookup and
      // no special case in the caster.
      if (moveById(req.move)) {
        e._moveIds = [req.move];
        e._moveIdx = -1;
        e._moveEvery = 2000;
        e._moveT = 1200;
        this.events.emit('show-banner', moveById(req.move).name, nem.tint);
      } else {
        this.events.emit('show-banner', `NO MOVE "${req.move}"`, '#ff4040');
      }
    }
    return e;
  }

  /**
   * Start a nemesis DUEL.
   *
   * A nemesis used to be one more member of an ordinary wave: it spawned at the
   * far gate, counted toward the clear, and the rest of the wave kept dripping
   * in around it. Curated moves cannot read through that. A telegraph is a
   * promise about which patch of floor is about to hurt, and it is worthless
   * when four other things are also shooting.
   *
   * The lockout is expressed through the wave phase machine rather than a new
   * one: the duel wave spends its entire spawn budget up front, so the drip in
   * `_tickArena` has nothing left to release, and `clearing` then waits on the
   * nemesis (plus anything IT summoned) exactly as it would wait on a wave.
   * That means the duel cannot desync from the wave state — there is only one
   * state machine, and it already knows how to end.
   */
  _beginDuel(wave) {
    this._duelActive = true;
    this.events.emit('show-banner', 'MINI-BOSS', '#ff8020');
    setMusicPhase('miniboss');
    SFX.bossRoar?.();
    this.cameras.main.flash(300, 255, 90, 20, false);
    this.fx.shake(0.02, 300);

    // Sweep the floor. Anything already walking is dismissed rather than killed
    // — a kill would pay score and combo for enemies the player never fought,
    // and would fire the volatile/bomber death blasts across the arena at the
    // exact moment the duel is trying to establish its own read.
    this.enemies.getChildren()
      .filter((e) => e.alive && !e._miniBoss)
      .forEach((e) => {
        this.fx.burst(e.x, e.y, 'white', 8);
        this._destroyEnemyFully(e);
      });

    // Budget spent: no drip for the duration.
    this._waveSpawned = wave.count;
    this._wavePhase = 'clearing';

    const e = this._spawnMiniBoss();
    if (e) this.events.emit('duel-start', e);
    return e;
  }

  _endDuel() {
    if (!this._duelActive) return;
    this._duelActive = false;
    this.events.emit('duel-end');
  }

  // Mini-boss: a super-elite spawned at wave start. Counts toward the clear.
  /**
   * Spawn the sector's nemesis.
   *
   * @param {object} [preRolled]  a nemesis from `rollNemesis`. Omitted in play,
   *   where the sector rolls its own. Supplied when the encounter is already
   *   decided — the balance harness forcing a specific trait loadout, and (from
   *   phase 2) the ledger returning a remembered nemesis, which must come back
   *   as ITSELF rather than as a fresh roll that happens to share a name.
   */
  _spawnMiniBoss(preRolled = null) {
    const spec = this.roomSpec;
    const gates = spec?.gates;
    let gx = spec?.bounds ? spec.bounds.w / 2 : this.player.x;
    let gy = spec?.bounds ? spec.bounds.h / 2 : this.player.y;
    if (gates?.length) {
      // Farthest gate from the player so it makes an entrance.
      const g = gates.reduce((a, b) =>
        Math.hypot(a.x - this.player.x, a.y - this.player.y) >=
        Math.hypot(b.x - this.player.x, b.y - this.player.y) ? a : b);
      gx = g.x; gy = g.y;
    }
    // A NEMESIS, not a coin flip. This used to be
    // `Math.random() < 0.5 ? 'shielded' : 'shooter'` at a fixed x6 hp — two
    // encounters, identical at sector 3 and sector 30. It now rolls a base
    // archetype plus 1-3 composable traits and a generated name, so the mini-boss
    // is a different fight each time without a hundred hand-authored ones.
    const nem = preRolled || this._nextNemesis();
    const e = this.spawnEnemyAt(nem.base, gx, gy, {});
    // Swap to the purpose-drawn nemesis body BEFORE _makeElite, which derives
    // the body circle's offset from `width/2` — a texture swapped afterwards
    // leaves the hitbox centred for the old frame size.
    this._wearNemesisBody(e, nem);
    this._makeElite(e, {
      hpMult: nemesisHpMult(nem, this.sector || 1, this.enemyHpMult || 1),
      scale: NEMESIS_RENDER_SCALE * nem.scale,
      tint: Phaser.Display.Color.HexStringToColor(nem.tint).color,
      speedMult: 0.8 * nem.speedMult,
    });
    e._miniBoss = true;
    e._nemesis = nem;
    // Cleared explicitly: enemies come from a pool, and a stale flag would have
    // a nemesis remembered as having bled you in a fight it never touched you in.
    e._drewBlood = false;
    // Runtime trait state. Held on the enemy so _tickNemesis can drive it
    // without a second registry to keep in sync.
    e._regenPerSec = nem.regenPerSec;
    e._summonMs = nem.summonMs;
    e._summonT = nem.summonMs;
    e._volatile = nem.volatile;
    this._equipNemesisKit(e, nem);

    this.fx.burst(gx, gy, 'red', 24);
    this.events.emit('show-banner', nem.name, nem.tint);
    // The grudge line goes FIRST and the trait line second. A returning enemy
    // has to be recognised as the one that got you before its stats matter —
    // read the other way round it is just another elite with a longer name.
    if (nem.grudge) {
      this.time.delayedCall(900, () => {
        if (e.active) this.events.emit('score-medal', nem.grudge, 0, '#ffd040');
      });
    }
    if (nem.traits.length) {
      this.time.delayedCall(nem.grudge ? 2400 : 1500, () => {
        if (e.active) this.events.emit('score-medal', traitLine(nem.traits), 0, nem.tint);
      });
    }

    // ...and then, for a remembered one only, it says something. After the
    // banner rather than before it, so the name is already on screen when the
    // card names it again.
    const card = this._nemesisArrivalDialogue(nem);
    if (card) this.time.delayedCall(700, () => { if (e.active) this.queueDialogue(card); });

    return e;
  }

  /**
   * Cast one of a nemesis's moves: telegraph now, resolve at commit.
   *
   * The move description owns the geometry and the effect; this only wires the
   * two together and hands ownership to the caster so the zone dies with it.
   * Nothing here decides what a move DOES, which is what keeps adding a fifth
   * move a data change rather than a scene change.
   */
  _castNemesisMove(e, forcedId = null) {
    const id = forcedId || (e._moveIds.length
      ? e._moveIds[(e._moveIdx = ((e._moveIdx ?? -1) + 1) % e._moveIds.length)]
      : null);
    const move = moveById(id);
    if (!move || !this.player?.alive) return null;
    if (e._activeMove && e._activeMove.phase !== 'done') return null;  // one at a time

    // Every move runs through the four-beat script. `runMove` THROWS if a move
    // has no act phase, which is the guard against the previous version of this
    // system — telegraph plus a damage callback, with the enemy standing still.
    const handle = runMove(this, e, {
      id: move.id,
      anticipateMs: move.anticipateMs,
      actMs: move.actMs,
      recoverMs: move.recoverMs,
      anticipate: (sc, actor, h) => move.anticipate?.(sc, actor, h),
      act: (sc, actor, h) => move.act(sc, actor, h),
      impact: (sc, actor, h) => move.impact?.(sc, actor, h),
      recover: (sc, actor, h) => move.recover?.(sc, actor, h),
      // The HANDLE is forwarded, unlike before. `MoveScript.cancel` sweeps
      // anything on `h` that has a `.destroy()` — a telegraph, a Graphics — but
      // a `TimerEvent` needs `.remove()` and a vortex-style handle needs
      // `.stop()`, and neither is reachable without this argument. The boss path
      // has always passed it (`_castBossMove`); this one silently did not, so an
      // interrupted nemesis move leaked whatever it had parked.
      onCancel: (sc, actor, h) => move.onCancel?.(sc, actor, h),
    });
    handle.move = move;
    e._chargeHit = false;      // latch for once-per-charge contact damage

    this.events.emit('nemesis-move', e, move);
    return handle;
  }

  /**
   * Per-frame work the scripted moves need.
   *
   * Only the charging moves need this: contact damage while travelling has to
   * be checked every frame, and a charge that runs into the player mid-flight
   * should hit them rather than waiting for the impact beat.
   */
  _tickNemesisMoves(delta) {
    const p = this.player;
    if (!p?.alive) return;

    // VADER'S CLOCK. He is not in `this.enemies` — that is the whole reason he
    // had none of the move system for a full release. Ticked explicitly.
    const b = this.boss;
    if (b?.alive && b._moveIds?.length) {
      b._moveT -= delta;
      if (b._moveT <= 0) {
        const cast = this._castBossMove(b);
        // A cast REFUSED BY THE GUARD must not burn the whole interval. The
        // stance is 2400ms against a 4800ms move clock, so leaving this at
        // `_moveEvery` would quietly cost him up to half his scripted moves
        // every time he raised the saber — the fight getting emptier as a
        // direct side effect of the fix that made it more readable.
        //
        // Narrowed to the guard on purpose: his OTHER refusal (another attack
        // already owns him) keeps the cadence it has always had, because that
        // one is not new and is not this pass's to retune.
        b._moveT = (!cast && b.isGuarding?.()) ? 400 : b._moveEvery;
      }
    }

    for (const e of this.enemies.getChildren()) {
      if (!e.alive || !e._charging) continue;
      const move = e._activeMove?.move;
      if (!move?.onChargeTouch) continue;
      const r = (e.cfg?.radius || 20) + 26;
      if (Math.hypot(p.x - e.x, p.y - e.y) < r) {
        // Once per charge — a 900ms charge at 60fps would otherwise deal its
        // damage fifty times.
        if (!e._chargeHit) {
          e._chargeHit = true;
          move.onChargeTouch(this, e);
        }
      }
    }
  }

  /**
   * Give Vader his moves.
   *
   * This is the connection that did not exist: `_equipNemesisKit` was called
   * only from `_spawnMiniBoss`, so every move built in the last release applied
   * to the named mini-bosses and never to the boss the player was testing.
   */
  _equipBossKit(boss, encounter = 1) {
    boss._moveIds = bossMovesFor(boss.phase || 1, encounter);
    // 6000, not 8000 — MEASURED, not guessed.
    //
    // A scripted move now blocks his own state machine for its whole duration
    // (the ownership gate in Boss.preUpdate), which it never used to. Free-run
    // measurements with nothing silenced: the rejected build managed ~21
    // attacks/min with both systems firing over the top of each other; the same
    // fight with the gate in came out at 12.9/min and 54% of frames with
    // neither system doing anything. The brief was "keep the pressure", so the
    // gaps close to pay for the blocking rather than the fight getting quieter.
    //
    // Weighted toward the MOVES rather than the old state machine. The two
    // block each other now, so tuning is zero-sum: pushing his charge/fan
    // clock alone took the total to 15.2/min but squeezed the scripted moves
    // from 6 casts to 4, which trades the new content away to buy back the
    // number. The moves are the fight worth having, so they get the tighter
    // clock and his stock attacks fill the gaps.
    boss._moveEvery = 4800;
    boss._moveT = boss._moveEvery;     // never on the first frame
    boss._moveIdx = -1;
    boss._encounterN = encounter;
  }

  /** Cast one of Vader's, through the same four-beat runner. */
  _castBossMove(b, forcedId = null) {
    // His pool widens as he loses phases, so re-derive rather than freezing the
    // list at spawn — that is how the fight escalates in verbs.
    const pool = forcedId ? [forcedId] : bossMovesFor(b.phase || 1, b._encounterN || 1);
    if (!pool.length || !this.player?.alive) return null;
    if (b._activeMove && b._activeMove.phase !== 'done') return null;
    // THE GUARD OWNS HIS SABER. Every move in the pool is a saber or a Force
    // move, and DEFLECTION is drawing the blade every frame — so starting one
    // here would put two systems on the same weapon, which is the failure this
    // whole boss was rebuilt to remove. See `Boss.isGuarding`.
    if (b.isGuarding?.()) return null;
    // ONE ATTACK AT A TIME, FROM EITHER SYSTEM. His own state machine can be
    // mid-charge or mid-volley, and starting a scripted move on top of it is
    // how a charge lane and a saber lane ended up on the floor together — the
    // "two red trails" in the report. `idle` is the only state he is free in.
    if (b.state && b.state !== 'idle') return null;
    const id = forcedId || pool[(b._moveIdx = ((b._moveIdx ?? -1) + 1) % pool.length)];
    const move = bossMoveById(id);
    if (!move) return null;

    const handle = runMove(this, b, {
      id: move.id,
      anticipateMs: move.anticipateMs,
      actMs: move.actMs,
      recoverMs: move.recoverMs,
      anticipate: (sc, a, h) => move.anticipate?.(sc, a, h),
      act: (sc, a, h) => move.act(sc, a, h),
      impact: (sc, a, h) => move.impact?.(sc, a, h),
      recover: (sc, a, h) => move.recover?.(sc, a, h),
      onCancel: (sc, a, h) => move.onCancel?.(sc, a, h),
    });
    handle.move = move;
    // Suspend his own state machine while a scripted move owns him, or the
    // charge AI fights the tween for control of his position.
    b.state = 'idle';
    b.cooldown = move.anticipateMs + move.actMs + move.recoverMs;
    this.events.emit('boss-move', b, move);
    return handle;
  }

  /**
   * Dress a nemesis: its weapon and its trait marks.
   *
   * Both are attached through `_attachments`, which `die()` and
   * `_destroyEnemyFully` already sweep — the alternative is a third teardown
   * path to keep in sync, and orphaned sprites outliving their owner is a bug
   * this project has shipped before.
   */
  _equipNemesisKit(e, nem) {
    // Weapon. `pickWeapon` returns null for melee bases, which hide
    // `weaponSprite` entirely — swapping a texture onto a hidden sprite would
    // give a grunt an invisible rifle firing real bullets.
    if (nem.weapon && e.weaponSprite) {
      e._nemesisWeapon = nem.weapon;
      e.weaponSprite.setTexture(nem.weapon.tex);
    }

    // Moves. Cycled rather than rolled per cast, so a player can learn what
    // this particular nemesis does instead of being surprised at random — the
    // difference between a fight you get better at and a slot machine.
    e._moveIds = (nem.moves || []).slice();
    if (e._moveIds.length) {
      const first = moveById(e._moveIds[0]);
      e._moveEvery = first?.everyMs ?? 8000;
      // Long enough that the telegraph does not land under the spawn banner,
      // short enough that a fight is a fight. A full `everyMs` here meant the
      // first move arrived 8-11 seconds in, which on a nemesis that died in
      // twenty was most of the encounter spent watching it walk.
      e._moveT = NEMESIS_FIRST_MOVE_MS;
      e._moveIdx = -1;
      e._phase = 1;
    }

    // Trait marks. Derived from the loadout, so they cannot disagree with it.
    e.regaliaSprites = [];
    for (const key of nem.regalia || []) {
      if (!this.textures.exists(key)) continue;
      // 0.55 of the body scale. At full scale the mark is as big as the enemy
      // wearing it — the first screenshot had a nemesis reading as a dark blob
      // with a body attached, rather than as a trooper carrying gear.
      const s = this.add.image(e.x, e.y, key)
        .setDepth(e.y)
        .setScale((e._baseScale || 1) * 0.55)
        .setTint(Phaser.Display.Color.HexStringToColor(nem.tint).color);
      e.regaliaSprites.push(s);
      e._attachments.push(s);
    }
  }

  // Drive the trait behaviours that need a clock. One pass over the (small) set
  // of nemeses alive rather than a per-enemy timer each, so an arena with none
  // costs a single array check.
  /**
   * Ambient tells, so a trait announces itself BEFORE it costs you something.
   *
   * Six traits with real mechanical weight — 2.2x hp, regen that beats chip
   * damage, a death blast — and until now every one of them was invisible
   * until it had already happened. The regalia says WHICH trait; this says it
   * is doing something right now.
   *
   * Budget first: these can be on screen in numbers, on a phone. Throttled to
   * one emission per enemy per interval, skipped entirely off-camera and under
   * `isLowQuality`, and never during a scripted move — a move owns the actor's
   * visuals and a stray mote on top of a wind-up is noise on the one beat that
   * has to read clearly.
   */
  _tickTraitTells(delta) {
    if (isLowQuality()) return;
    const cam = this.cameras.main;
    const view = cam.worldView;

    for (const e of this.enemies.getChildren()) {
      const nem = e._nemesis;
      if (!e.alive || !nem?.traits?.length || e._performing) continue;
      // Off-screen enemies cost nothing. `worldView` is the camera's rect in
      // world space, padded so a tell does not pop in at the edge.
      if (e.x < view.x - 60 || e.x > view.right + 60
        || e.y < view.y - 60 || e.y > view.bottom + 60) continue;

      e._tellT = (e._tellT ?? Math.random() * 600) - delta;
      if (e._tellT > 0) continue;
      e._tellT = 420 + Math.random() * 420;

      const r = e.cfg?.radius ?? 12;
      for (const t of nem.traits) {
        if (t === 'regenerator') {
          // Knitting itself back together. Only while actually below full —
          // a tell for a thing that is not happening teaches the wrong lesson.
          if (e.hp < e.hpMax) this.fx.inhale?.(e.x, e.y, 'blue', 2, r + 26);
        } else if (t === 'volatile') {
          // An ember core, pulsing. The warning is "do not finish this one
          // standing next to it", and it has to arrive before the finisher.
          this.fx.burst?.(e.x, e.y - 4, 'red', 2);
        } else if (t === 'summoner') {
          // Brightens as the summon approaches, so the standard is a clock.
          const due = 1 - Math.max(0, Math.min(1, (e._summonT ?? 1) / (e._summonMs || 1)));
          if (due > 0.55) this.fx.burstDir?.(e.x, e.y - r, 'white', 2, -Math.PI / 2, 30);
        } else if (t === 'colossal') {
          // Dust at the feet: mass, without needing a footfall event.
          this.fx.dustPuff?.(e.x + (Math.random() - 0.5) * r, e.y + r * 0.8);
        } else if (t === 'swift') {
          // A smear behind it, and only when it is actually moving fast.
          const sp = Math.hypot(e.body?.velocity.x || 0, e.body?.velocity.y || 0);
          if (sp > 120) this.fx.trail?.(e.x, e.y + 6);
        }
        // ARMORED has no ambient tell on purpose. Its regalia is the widest
        // silhouette in the set and its tell is what happens when you shoot it
        // — adding idle sparks would say "damaged" about an undamaged enemy.
      }
    }
  }

  _tickNemesis(delta) {
    // SUNDER: Vader periodically cracks the floor around himself. Reuses the
    // phase-crack visual and the grenade blast, so it reads as his and needs no
    // new attack code.
    const b = this.boss;
    if (b?.alive && b._sunderMs > 0) {
      b._sunderT -= delta;
      if (b._sunderT <= 0) {
        b._sunderT = b._sunderMs;
        this._spawnVaderGroundCrack(b.x, b.y, b.phase || 1);
        this.detonateGrenade(b.x, b.y, 240, 260);
        this.fx.shake(0.02, 300);
      }
    }

    // Nemesis moves. One clock per enemy, ticked here with the rest of the
    // trait behaviour rather than as scene timers, so a nemesis that dies
    // mid-windup takes its pending move with it.
    for (const e of this.enemies.getChildren()) {
      if (!e.alive || !e._moveIds?.length) continue;
      this._tickNemesisPhase(e);
      e._moveT -= delta;
      if (e._moveT <= 0) {
        // Cadence tightens with the phase, so the fight escalates instead of
        // metronoming at one rate until the hp runs out.
        e._moveT = e._moveEvery * (NEMESIS_PHASE_CADENCE[e._phase || 1] ?? 1);
        this._castNemesisMove(e);
      }
    }

    this._tickTraitTells(delta);

    // Afterimages hold Vader's silhouette. The grunt AI they ride on swaps
    // texture and animation as it changes state, so this is re-asserted rather
    // than set once at spawn.
    for (const e of this.enemies.getChildren()) {
      if (!e.alive || !e._afterimage) continue;
      if (e.texture?.key !== 'boss') { e.anims?.stop(); e.setTexture('boss'); }
      // Re-fit EVERY frame, not only on the swap. Conditioning it on the
      // texture change left a race with the grunt AI's own animation — one
      // clone in three still measured a 57px offset, and which one varied run
      // to run. Three objects, once a frame, is not worth a race.
      this._fitAfterimageBody(e);
      e.weaponSprite?.setVisible(false);
    }

    for (const e of this.enemies.getChildren()) {
      if (!e.alive || !e._nemesis) continue;

      if (e._regenPerSec > 0 && e.hp < e.hpMax) {
        e.hp = Math.min(e.hpMax, e.hp + e.hpMax * e._regenPerSec * (delta / 1000));
      }

      if (e._summonMs > 0) {
        e._summonT -= delta;
        if (e._summonT <= 0) {
          e._summonT = e._summonMs;
          // Swarmlings: cheap, readable, and already speed-capped below the
          // player so a summoner can never wall you in with something unescapable.
          this._spawnSwarmlingPack(e.x, e.y);
          this.fx.burst(e.x, e.y, 'purple', 12);
        }
      }
    }
  }

  _livingEnemyCount() {
    // die() keeps corpses "active" for the fade-out; count only live ones.
    // The mini-boss check rides along in the SAME pass: the music director
    // needs to know when the capstone elite dies so it can drop the half-time
    // feel, and a second reduce every frame to answer that would be waste.
    this._miniBossAlive = false;
    return this.enemies.getChildren().reduce((n, e) => {
      if (!e.alive) return n;
      if (e._miniBoss) this._miniBossAlive = true;
      return n + 1;
    }, 0);
  }

  _rollEnemyType() {
    const c = this.arenaCfg || {};
    const r = this.rng.waves.rand();
    let acc = 0;
    if (r < (acc += c.bomberMix    ?? 0)) return 'bomber';
    if (r < (acc += c.shieldedMix  ?? 0)) return 'shielded';
    if (r < (acc += c.sniperMix    ?? 0)) return 'sniper';
    if (r < (acc += c.swarmlingMix ?? 0)) return 'swarmling';
    if (r < (acc += c.shooterMix   ?? 0.3)) return 'shooter';
    return 'grunt';
  }

  // Surge: a burst of spawns staggered over ~1.5s with a warning banner.
  // Fired when a terminal is hacked (risk/reward) — extra enemies you must
  // also clear before the wave ends. Never fires during a breather.
  triggerSurge() {
    const cfg = this.arenaCfg;
    if (!cfg || !this.arenaActive || this._wavePhase === 'breather') return;

    this.events.emit('show-banner', 'SURGE INCOMING', '#ff4040');
    SFX.enemyShoot();
    this.cameras.main.flash(150, 255, 60, 60, false);

    const count = cfg.surgeCount ?? 4;
    const step = 1500 / count;
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * step, () => {
        if (!this.arenaActive) return;
        // Surges may briefly exceed the drip cap, but never runaway.
        if (this._livingEnemyCount() >= cfg.maxAlive + 4) return;
        this.spawnAtGate(this._rollEnemyType());
      });
    }
  }

  // Spawn one enemy at a room gate: pick a random gate ≥400px from the
  // player (else the farthest), telegraph it with a pulsing red ring for
  // 600ms, then spawn with a burst. Falls back to the legacy random-edge
  // picker for rooms without gates.
  spawnAtGate(type) {
    const spec = this.roomSpec;
    if (!spec) return;
    const gates = spec.gates;
    if (!gates?.length) { this.spawnEnemyRandom(type); return; }

    const px = this.player.x, py = this.player.y;
    const farEnough = gates.filter((g) => Math.hypot(g.x - px, g.y - py) >= 400);
    const pool = farEnough.length
      ? farEnough
      : [gates.reduce((a, b) =>
          Math.hypot(a.x - px, a.y - py) >= Math.hypot(b.x - px, b.y - py) ? a : b)];
    const gate = pool[Phaser.Math.Between(0, pool.length - 1)];
    const gx = gate.x + Phaser.Math.Between(-24, 24);
    const gy = gate.y + Phaser.Math.Between(-24, 24);

    // Telegraph: pulsing red ring, then the enemy materializes.
    const tg = this.add.graphics().setDepth(6);
    tg.lineStyle(3, 0xff3030, 0.9);
    tg.strokeCircle(0, 0, 30);
    tg.fillStyle(0xff2020, 0.25);
    tg.fillCircle(0, 0, 22);
    tg.setPosition(gx, gy).setScale(0.4);
    this.tweens.add({
      targets: tg, scale: 1.25, alpha: { from: 1, to: 0.15 },
      duration: 600, ease: 'Cubic.easeOut',
      onComplete: () => {
        tg.destroy();
        if (!this.arenaActive) return;
        // A gate telegraph runs for 600ms before the enemy materialises, so one
        // already in flight when a duel begins would drop a trooper into it
        // AFTER the floor was swept. Rare enough that it only showed up under
        // suite load — and it is exactly the crowd the duel exists to remove.
        if (this._duelActive) return;
        if (type === 'swarmling') {
          this._spawnSwarmlingPack(gx, gy);
        } else {
          // Elite upgrade roll (not for fodder). eliteChance is per-room.
          const elite = this.rng.waves.chance(this.arenaCfg?.eliteChance ?? 0);
          this.spawnEnemyAt(type, gx, gy, elite ? { elite: true } : {});
        }
        this.fx.burst(gx, gy, 'red', 10);
      },
    });
  }

  // Terminal support drop — allies (turret/soldier) are cut for now: their
  // borrowed enemy/cover art read as unkillable enemies in playtests. 50/50
  // between a heavy weapon and shield+bacta.
  spawnTerminalSupportDrop(t) {
    if (this.rng.drops.chance(0.5)) {
      this.spawnWeaponChoice(t.x, t.y + 35, 'SUPPORT');
    } else {
      // Spawn health pack + temporary shield
      this.spawnHealthOrb(t.x, t.y + 30);
      this.player.addShield(400);
      this.events.emit('show-banner', 'SUPPORT: SHIELD CHARGED & BACTA VIAL', '#40ff80');
    }
  }

  _onArenaCompleted() {
    this.arenaActive = false;
    this._endDuel();   // a room cannot finish with a duel still notionally live
    this.events.emit('wave-update', null, null); // clear the wave HUD
    this.events.emit('wave-remaining', 0);

    const spec = this.roomSpec;
    if (spec.boss) {
      // Dual climax: survive the swarm first, then Vader. Up to 4 swarm
      // survivors stay in the fight so the climax doesn't reset to a sterile
      // 1v1 — the rest are culled (farthest from the player go first).
      const living = this.enemies.getChildren()
        .filter((e) => e.alive)
        .sort((a, b) =>
          Math.hypot(a.x - this.player.x, a.y - this.player.y) -
          Math.hypot(b.x - this.player.x, b.y - this.player.y));
      living.slice(4).forEach((e) => this._destroyEnemyFully(e));

      this.events.emit('set-darkness', false); // hand a dim room cleanly to the boss
      this.events.emit('show-banner', 'VADER APPROACHES!', '#ff2020');
      SFX.bossRoar();
      this.cameras.main.flash(400, 255, 0, 0, true);
      setMusicPhase('boss'); // half-time and a mallet — Vader gets his own feel
      
      // Spawn Vader
      this.time.delayedCall(800, () => {
        this.spawnBoss(spec.bossSpawn.x, spec.bossSpawn.y);
        this.events.emit('boss-start');
      });
    } else {
      // Survivors stay alive and killable — spawning already stopped
      // (arenaActive=false), so they're a finite mop-up. Full cleanup of any
      // stragglers happens in _clearRoomEntities on the next room load.
      // The door stays SEALED until an upgrade is picked (UpgradeScene calls
      // _openDoor() itself on pick) — _roomDoorOpened still latches now so
      // _maybeCompleteRoom's terminal-completion path can't race it open.
      this._roomDoorOpened = true;
      setMusicPhase('upgrade'); // room's done — calm through the upgrade picker

      // Finishing a whole room is the biggest structural beat short of the
      // boss — give it a real, legible moment: a brief slow-mo, a bright green
      // flash, a zoom kick, and a triumphant fanfare (the old flash+shake alone
      // didn't read as distinct from a kill).
      this._slowMo(0.5, 300);
      this.cameras.main.flash(320, 80, 255, 150, true);
      this.fx.shake(0.012, 220);
      this._cameraPunch(1.07, 300);
      SFX.roomClear?.();
      this.addScore(SCORE.roomClear);
      this.events.emit('score-medal', 'ARENA CLEAR', SCORE.roomClear, '#20ff60');
      const stragglers = this._livingEnemyCount();
      this.events.emit('show-banner',
        stragglers > 0 ? 'ARENA SURVIVED — FINISH THEM!' : 'ARENA SURVIVED!',
        '#20ff60');

      this.time.delayedCall(900, () => {
        this.scene.launch('Upgrade', { game: this });
        this.scene.pause('Game');
        this.scene.pause('HUD');
      });
    }
  }
}
