// ── THE IMPERIAL SHOCK CAPTAIN ──────────────────────────────────────────────
//
// PHASE B.2 — the third Champion candidate, and the first whose VISUAL/FANTASY
// gate a human has approved (`HANDOVER.md` §10ag). The two before it were
// rejected on CATEGORY rather than on numbers: both began from a mechanic and
// found a body for it afterwards, so both produced a delivery device whose
// content was on the floor and whose actor was merely its emitter.
//
// THIS GATE ASKS ONE QUESTION: is the Shock Captain already a good combatant
// with just MOVEMENT, a RIFLE and a DEFENSIVE LAYER? There is no signature
// ability here on purpose. If the ordinary combatant is not worth fighting, a
// signature move would only hide it — which is precisely what Phase B.1 proved
// from the other direction, by shipping four verbs and no attacks at all.
//
// ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
//   - not an elite. `_makeElite` is hp x2.5, scale x1.4 and a gold tint: the
//     same enemy, larger. This has its own sheet, its own states and its own
//     durability model, and takes none of that path.
//   - not a Nemesis. No generated name, no traits, no regalia, no grudge, no
//     ledger, no duel bar, no dialogue and none of the fourteen Nemesis moves.
//   - not a mini-boss. No room lockout, no phases, no banner.
//   - not a hazard with hp. Nothing it does lives on the floor.
//
// ── THE THREE RULES THE PREVIOUS TWO BROKE ──────────────────────────────────
//   1. MOVEMENT MUST READ AS DECISION. Every state below corresponds to an
//      understandable combat reason — too far, too close, wrong angle, firing,
//      recovering — and the body ANIMATES through all of them. A sprite
//      translating through world space at constant speed is a vehicle, however
//      fast it goes.
//   2. IT IS A COMBATANT FROM THE FIRST BUILD. The rifle is here in the first
//      version, not deferred behind a signature kit.
//   3. NO MOVEMENT-PERCENTAGE KPI. "81% of the fight in motion" cleared every
//      bar the Harrower was given and the actor was rejected anyway. Nothing
//      here optimises for that number and no test asserts it.
//
// ── PHASE B.2.1 — COMBAT PERSONALITY ────────────────────────────────────────
// The combatant foundation above is HUMAN-APPROVED AND FROZEN. What this file
// gained afterwards is a STATE LANGUAGE, on one rule:
//
//   SYMBOL = TRANSITION.  BODY / FX = SUSTAINED STATE.
//
// A glyph lives for a few hundred milliseconds to announce that something
// CHANGED and is then gone; everything that has to stay true about him is
// carried by the actor — a sheared pauldron, a dead visor, smoke, sparks. A
// glyph that lingers is a status icon, and a status icon is UI standing in the
// world. It is NOT a phase system: nothing below touches fire rate, speed,
// damage or the state machine, and a low-health Captain fights exactly the
// same as a fresh one.
//
// EVERY REACTION READS AUTHORITATIVE GAMEPLAY STATE. The armour event comes
// from the armour actually crossing zero, the low-health event from the body
// pool crossing its fraction, the major-hit event from the SAME threshold the
// stagger already uses, and the reacquire from real line of sight. There is no
// parallel state kept only for effects.
import Phaser from 'phaser';
import { Enemy, ST } from './Enemy.js';
import { CHAMPION } from '../config.js';
import { CAPTAIN_MUZZLE_PX } from '../systems/pixelArt.js';
import { SFX } from '../systems/FX.js';

// The combat loop, as five named reasons. Every one of them is something a
// player could say out loud about what the Captain is doing.
export const CAP = {
  ADVANCE: 'advance',       // too far to shoot, closing
  GIVE_GROUND: 'giveground',// crowded, backing off without turning away
  STRAFE: 'strafe',         // in the band, changing the firing angle
  BRACE: 'brace',           // planted, weapon up, about to fire
  BURST: 'burst',           // firing
  RECOVER: 'recover',       // settling after the burst
  STAGGER: 'stagger',       // a real blow landed
  WINDUP: 'windup',         // reaching for the Arc Grenade
  THROW: 'throw',           // releasing it
  STEP: 'step',             // S1: a short assisted reposition — footwork
};

export class ShockCaptain extends Enemy {
  constructor(scene, x, y, spec = {}, def = CHAMPION.captain) {
    super(scene, x, y, def.tex, {
      hp: def.hp,
      speed: def.speed,
      radius: def.radius,
      desiredRange: (def.holdMin + def.holdMax) / 2,
      // Nothing reads this: the Captain's cadence is its own state machine and
      // it never calls `_maybeFireAt`. It is here so a stray inherited path
      // could not fire on the stock clock.
      fireCooldownMs: 1e9,
      bulletSpeed: def.bulletSpeed,
      bulletDamage: def.bulletDamage,
      bulletRange: def.bulletRange,
    }, { ...spec, behavior: 'swarm', alerted: true });

    this.def = def;
    this.isChampion = true;
    this._championId = def.id;
    this._animPrefix = def.anim;
    // IT OWNS ITS OWN ANIMATION. Its sheet is 51 frames, not the stock 33: a
    // two-frame breathing idle, a lateral strafe cycle and a brace/fire/recoil
    // arc that the states below drive directly. See `Enemy.preUpdate`.
    this._ownsAnim = true;
    this.state = ST.ALERT;

    // ── DURABILITY: TWO LAYERS ─────────────────────────────────────────────
    // The reactive armour is not a second health bar. It exists so the player's
    // biggest commitment BREAKS something visibly instead of deleting the
    // encounter before its behaviour can be read — the Interdictor's whole
    // problem — while chip fire against it still feels productive.
    this.armour = def.armour;
    this.armourMax = def.armour;
    this.armourBroken = false;
    this._armourBar = scene.add.graphics().setDepth(this.depth + 1);
    this._armourBar.visible = false;

    // Combat state. `_stateMs` counts DOWN; a state ends when it hits zero or
    // when its own condition says so, never on a frame count.
    this._cap = CAP.ADVANCE;
    this._stateMs = 0;
    this._fireCd = Phaser.Math.Between(500, 1100);   // not all at once on spawn
    this._round = 0;
    this._roundGap = 0;
    this._shotFlashMs = 0;
    this._side = Math.random() < 0.5 ? 1 : -1;
    this._target = null;
    this._staggerCd = 0;
    this._wKick = 0;               // weapon recoil, in px along -aim
    this._wSet = 0;                // weapon carry offset: pulled IN on a brace

    // ── REACTION STATE ────────────────────────────────────────────────────
    // Owned here, cleaned up here. No global status-effect framework, no timers
    // that can outlive the actor: the punctuation queue is data ticked in
    // `preUpdate`, so there is nothing to cancel on death.
    this._reactFx = [];            // display objects this actor owns
    this._punctQueue = [];         // { key, at } — sequenced, never simultaneous
    this._punctFreeAt = 0;
    this._lowHealthFired = false;
    this._impactGlyphCd = 0;
    this._clock = 0;               // local ms, so nothing reads wall time
    this._wearSmokeT = 0;
    this._wearSparkT = 0;
    this._wearFlickerT = 0;
    this._flickerHold = 0;
    // ── B.2.2: THE DETERIORATION LAYER ─────────────────────────────────────
    // `_wound` is the dark, always-true half (scorch, hot remnant) and
    // `_arcGfx` the electrical half, which is entirely event-driven. Both are
    // redrawn every frame from the live body position, so neither can be
    // stranded where he used to be, and both are in `_reactFx` so both die with
    // him. See `_drawDamage` for why the persistent mark is a stain and not a
    // light.
    this._wound = null;
    this._arcGfx = null;
    this._arcT = 0;                // next short-circuit event
    this._arcHold = 0;             // how long the current one is still drawn
    this._arcToRifle = false;
    // ── B.2.2: THE ARC GRENADE ────────────────────────────────────────────
    // ONE live grenade at a time and one cooldown, opened late so the signature
    // is never the first thing he does.
    this._nade = null;
    this._nadeCd = def.grenade.firstDelayMs;
    // ── CORE FEEL PASS: A BODY THAT ABSORBS RATHER THAN BOUNCES ───────────
    // `Enemy.preUpdate` squashes the whole sprite on a sine while `_staggerMs`
    // runs and shrinks it while `recoilT` does — and `Enemy.damage` sets
    // `_staggerMs` on EVERY hit. On a Ø44 trooper taking three rounds that is a
    // shove; on a 5300-durability Champion under sustained fire it is a body
    // visibly jiggling for the entire fight, which is §16's complaint exactly.
    // The reaction is not removed, it is DAMPED and moved: what a hit does to
    // this actor is the localized armour absorption, the stagger state and the
    // hit frame, none of which are a rubber sprite.
    this._staggerScale = 0.025;
    this._recoilScale = 0.035;

    // ── CORE FEEL PASS: ONE BURST IS ONE TACTICAL DECISION ────────────────
    // The plan is snapshotted ONCE, at the commitment moment, and every round
    // of the burst is drawn from it. There is no per-round solver any more.
    this._plan = null;
    this._planShot = 0;

    // ── S1: THE TACTICAL STEP ─────────────────────────────────────────────
    this._stepCd = def.step.firstDelayMs;
    this._stepPlantMs = 0;       // the plant beat, before the impulse
    this._stepCatchMs = 0;       // the catch beat, after it
    this._stepVx = 0; this._stepVy = 0;
    this._stepReason = null;
    this._stepFrom = null;        // for the telemetry's displacement figure
    this._stepEchoT = 0;
    // Closing RATE, not just distance. A player who is still coming is a
    // collapse in progress; waiting until they have arrived is waiting until
    // the firing solution they are building is already finished.
    this._lastDist = null;
    this._closing = 0;
    this._blockedMs = 0;          // ready to fire, in range, and no line
    // Reacquire: LOS is sampled every frame, and a loss shorter than
    // `acquireLostMs` is a doorway rather than a break.
    this._hadLos = true;
    this._losLostMs = 0;
    this._acquireCd = def.acquireCooldownMs;

    // THE HEAVY REPEATER, on the standard overlay contract: painted east-facing
    // at origin (0.15, 0.5) so `Enemy.preUpdate`'s orbit maths applies
    // unchanged, and a separate object so the body sheet never has to draw it.
    this.weaponSprite = scene.add.image(x, y, 'wpn-captain')
      .setDepth(this.depth + 1).setOrigin(0.15, 0.5).setScale(1.0);

    // An electric-blue ground ring instead of the stock red threat halo. The
    // identity colour is on the model, the weapon core, the bolt and here, so
    // all four say the same thing; red would have made it one more of the crowd
    // it is standing in.
    this.threatRing?.clear();
    this.threatRing?.fillStyle(def.color, 0.13);
    this.threatRing?.fillCircle(0, 0, def.radius + 20);
    this.threatRing?.lineStyle(2.5, def.color, 0.5);
    this.threatRing?.strokeCircle(0, 0, def.radius + 12);
  }

  // ── DAMAGE: THE ARMOUR EATS FIRST, AND OVERKILL CARRIES THROUGH ──────────
  //
  // `armourSpill` is what stops the layer being a damage wall. A Super that
  // over-commits past the armour still lands meaningful body damage in the same
  // instant it breaks it, which is the qualitative result the brief asks for:
  // the player hits it hard and SEES progress, twice.
  //
  // The punish multiplier is applied by `Enemy.damage`, so this intercept has
  // to reason about the RAW number and hand the parent whatever should reach
  // the body — the same trap `Boss.damage` fell into when it tested a raw
  // amount the parent was about to multiply.
  damage(amount, knockbackVec = null) {
    if (!this.alive) return;
    let toBody = amount;
    // WHAT THE LAYER ACTUALLY ATE, kept so the number the player reads can be
    // built from real removals rather than from the request. See
    // `_damageFeedback`.
    let armourRemoved = 0;
    if (!this.armourBroken && this.armour > 0) {
      const taken = amount * this.def.armourTake;
      if (taken < this.armour) {
        armourRemoved = taken;
        this.armour -= taken;
        toBody = 0;
        // THE SUIT ATE IT. Not three particles at his centre — an absorption
        // at the REAL contact point. See `_absorbHit`.
        this._absorbHit(amount, knockbackVec);
      } else {
        armourRemoved = this.armour;
        const over = (taken - this.armour) / this.def.armourTake;
        this.armour = 0;
        toBody = over * this.def.armourSpill;
        this._breakArmour();
      }
    }
    this._fbArmour = armourRemoved;
    // A REAL BLOW STAGGERS; CHIP FIRE DOES NOT. `Enemy.damage` sets
    // `_staggerMs = 90` on every hit, and an actor that yields on that field is
    // stun-locked by ordinary fire — 4305ms motionless, measured on the
    // Harrower. This is the same fact reached deliberately: one visible stagger
    // per cooldown, above a threshold, and the loop resumes when it ends.
    //
    // THE MAJOR-HIT REACTION RIDES THIS EXACT THRESHOLD. There is no second
    // definition of "a big hit" anywhere — one semantic, two consequences.
    if (amount >= this.def.staggerMinDamage && this._staggerCd <= 0 && this.alive) {
      this._enter(CAP.STAGGER, this.def.staggerMs);
      this._staggerCd = this.def.staggerCooldownMs;
      this._majorHit(amount, knockbackVec);
    }
    // `toBody` can be 0 while the armour holds. The parent still runs alarms,
    // the hit event and the recoil, which is what keeps the hit FEELING landed.
    const hpBefore = this.hp;
    super.damage(toBody, knockbackVec);
    // ── LOW HEALTH — a DOWNWARD crossing of the body pool, once ────────────
    // Tested against the real pool either side of the parent's subtraction, so
    // it cannot retrigger by hovering at the line and cannot fire on a heal, on
    // a spawn, or after death. Independent of the armour by construction: this
    // reads `hp`, that reads `armour`.
    const line = this.hpMax * this.def.lowHealthFrac;
    if (!this._lowHealthFired && this.alive && hpBefore > line && this.hp <= line) {
      this._lowHealthFired = true;
      this._punctuate('glyph-rage');
      this.scene.fx?.burstDir?.(this.x, this.y - 12, 'white', 5, -Math.PI / 2, 90);
      this.scene.events.emit('champion-low-health', this);
    }
  }

  /**
   * ONE TRUTHFUL NUMBER PER HIT.
   *
   * THE BUG THIS EXISTS AGAINST: `Enemy.damage` emits the hit event with the
   * number it was asked to take off the BODY, and while the reactive layer
   * holds, that number is zero — so a Captain whose armour bar was visibly
   * draining printed `0 0 0` over his own head. A human called it out on a
   * handset and they were right: it is not a rendering nit, it is the game
   * telling the player their shots did nothing while it took their damage.
   * Measured on the shipped build, a 120-damage round removed 102 points of
   * durability and rendered `0`, and a Super that removed 2285 rendered 485.
   *
   * THE LAW IS: IF REAL DURABILITY DECREASED, FEEDBACK MAY NOT SAY ZERO.
   * One number, not two — armour removed plus body removed. A spill hit is
   * still ONE event to the player, and two overlapping labels on the frame the
   * armour breaks is exactly the soup the punctuation queue exists to avoid;
   * the break FX is what says a layer transition happened, and it says it far
   * better than a second integer could.
   *
   * THE COLOUR IS THE SEMANTIC. Blue while the layer is doing the work — his
   * own defensive colour, the same one the armour bar and the threat ring are
   * painted in — and the ordinary hit colour the moment any of it reaches the
   * body. So "this is being absorbed" and "this is hurting him" are told apart
   * at a glance without a second label, and the frame the armour breaks is the
   * frame the number changes colour.
   *
   * `bodyRemoved` is what the pool ACTUALLY moved by, punish multiplier and
   * lethal clamp included, because it is measured across the subtraction.
   * `_fbArmour` is raw: the layer is deliberately outside the punish window,
   * which is existing behaviour and not this pass's to change.
   */
  _damageFeedback(bodyRemoved) {
    const armour = this._fbArmour || 0;
    this._fbArmour = 0;
    return {
      shown: armour + bodyRemoved,
      color: (bodyRemoved <= 0 && armour > 0) ? '#7fd4ff' : null,
    };
  }

  /**
   * ── REACTIVE ARMOUR, AS SOMETHING THAT HAPPENS TO A SUIT ────────────────
   *
   * WHAT THIS REPLACES. While the layer held, a hit produced three white
   * particles at the actor's CENTRE — the "blue particle sticker over the
   * Captain" failure exactly. It told the player nothing about where they hit
   * him and nothing about why their damage was not landing, so the armour read
   * as a hidden second health bar rather than as equipment.
   *
   * THE CHAIN, AND THE ORDER IS THE MEANING:
   *   1. a hot, hostile impact mark at the real contact point — the incoming
   *      energy, in the colour of a threat
   *   2. converting to a white-blue ABSORPTION bloom — the suit taking it
   *   3. dispersing along conduction paths that run ACROSS the plate, not
   *      outward, fading into his own electric blue
   *
   * The transformation is the claim: threat energy enters, the armour
   * neutralises it. Painted in CRIX's own vocabulary — hard strokes, no
   * gradients, no bubble.
   *
   * WHERE THE HIT IS. `knockbackVec` carries the projectile's flight
   * direction, so the contact point is on the NEAR side of the body, back
   * along that bearing. That is a real coordinate rather than a decoration:
   * three pellets of one Super arrive on three different plates and produce
   * three separate responses, which is the "several short conduction paths"
   * a strong hit is supposed to look like.
   *
   * IT IS PRESENTATION AND NOTHING ELSE. No damage reduction, no resistance,
   * no cap. S1 exists to measure durability and movement on their own, and
   * hiding a mitigation inside an FX pass would make that measurement a lie.
   */
  _absorbHit(amount, knockbackVec, force = false) {
    if (!this.scene?.add || !this.alive) return;
    const A = this.def.absorb;
    // A SUPER IS FIVE PELLETS IN ONE FRAME and five full blooms is soup. Past
    // the cap the newest simply does not draw — the four that do are already
    // saying "this was a heavy volley", and the armour bar says the rest.
    //
    // THE OVERLOAD IS EXEMPT, AND IT HAS TO BE. The break is caused by a heavy
    // volley almost by definition, so the cap was full at the exact moment the
    // most important absorption in the fight wanted to draw — measured, the
    // overload rendered NOTHING on the break frame. `force` clears the
    // in-flight responses first, so the failure is the only thing on the body
    // rather than the fifth thing competing with four fading ones.
    const liveFx = this._reactFx.filter((o) => o._absorb);
    if (force) {
      liveFx.forEach((o) => { this._dropFx(o); o.destroy(); });
    } else if (liveFx.length >= A.maxLive) return;
    const ang = knockbackVec
      ? Math.atan2(knockbackVec.y, knockbackVec.x) : this._aim + Math.PI;
    // Back along the flight path: the plate that met the shot.
    const r = this.def.radius * 0.62;
    const hx = this.x - Math.cos(ang) * r;
    const hy = this.y - Math.sin(ang) * r - 4;
    const big = amount >= A.bigHit;
    const paths = big ? 4 : 2;
    // The conduction runs PERPENDICULAR to the impact — across the armour,
    // the way current spreads through a plate, not out into the air.
    const across = ang + Math.PI / 2;
    const seeds = [];
    for (let i = 0; i < paths; i++) {
      const th = across + (i % 2 ? Math.PI : 0) + (Math.random() - 0.5) * 0.9;
      seeds.push({ th, len: (big ? 1 : 0.7) * A.reach * (0.7 + Math.random() * 0.6) });
    }

    const g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    g._absorb = true;
    g.setDepth(this.y + 7);
    this._reactFx.push(g);
    const started = this._clock;
    const ms = A.ms * (big ? 1.25 : 1);
    // The offset is held relative to the BODY, so the response travels with
    // him — an absorption stranded on the spot he was standing is a spark in
    // the air, and he is moving during most of them.
    const ox = hx - this.x, oy = hy - this.y;
    g._tick = () => {
      const u = (this._clock - started) / ms;
      if (u >= 1 || !this.alive) { this._dropFx(g); g.destroy(); return; }
      g.clear();
      g.setDepth(this.y + 7);
      const x = this.x + ox, y = this.y + oy;
      // ── 1. IMPACT: hot and hostile, and over almost at once ─────────────
      if (u < 0.22) {
        const k = 1 - u / 0.22;
        g.fillStyle(0xffd9a0, 0.85 * k);
        g.fillCircle(x, y, (big ? 7 : 4.5) * (0.6 + 0.4 * k));
        g.fillStyle(0xff8a3a, 0.5 * k);
        g.fillCircle(x, y, (big ? 10 : 6.5) * (0.6 + 0.4 * k));
      }
      // ── 2. ABSORPTION: white-blue, rising as the heat dies ──────────────
      const ab = Math.min(1, u / 0.3) * (1 - u);
      g.fillStyle(0xffffff, 0.9 * ab);
      g.fillCircle(x, y, (big ? 5.5 : 3.4) * (0.8 + 0.4 * ab));
      g.fillStyle(this.def.color, 0.55 * ab);
      g.fillCircle(x, y, (big ? 15 : 8.5) * (0.5 + 0.7 * u));
      // ── 3. DISPERSAL: across the plate, and gone ────────────────────────
      const spread = Math.min(1, u / 0.75);
      for (const sd of seeds) {
        const len = sd.len * spread;
        if (len < 2) continue;
        this._bolt(g, x, y,
          x + Math.cos(sd.th) * len, y + Math.sin(sd.th) * len,
          5, big ? 2 : 1.5,
          u < 0.45 ? 0xffffff : this.def.color, (1 - u) * (big ? 0.95 : 0.75));
      }
    };
    // A STRONG HIT MOVES THE PLATE. The body's own recoil, not a new system,
    // and deliberately smaller than the `_majorHit` flinch so the two read as
    // different sizes of event.
    if (big) this.recoilT = Math.max(this.recoilT, 70);
  }

  /**
   * A BLOW BIG ENOUGH TO MOVE HIM.
   *
   * The stagger pose is already the read; this is what makes it LAND — sparks
   * thrown back along the bearing the hit came from, a short body squash, and a
   * dull thump. The GLYPH has its own longer floor (`impactGlyphMs`): the
   * stagger may fire every 1.6s under sustained heavy fire and a mark that
   * often stops being punctuation and becomes weather.
   */
  _majorHit(amount, knockbackVec) {
    const fx = this.scene.fx;
    const ang = knockbackVec
      ? Math.atan2(knockbackVec.y, knockbackVec.x) : this._aim + Math.PI;
    fx?.burstDir?.(this.x, this.y, 'white', 7, ang, 80);
    fx?.impactRing?.(this.x, this.y, 0xffffff, this.y + 3);
    SFX.captainHeavyHit?.();
    this.recoilT = 120;
    if (this._impactGlyphCd <= 0) {
      this._impactGlyphCd = this.def.impactGlyphMs;
      this._punctuate('glyph-impact', { scale: 0.85, rise: 0.75 });
    }
  }

  /**
   * THE ARMOUR GOES, AND THE SILHOUETTE CHANGES WITH IT.
   *
   * Two textures, not one tint — the same contract the hero prop's dark state
   * holds, and for the same reason: a recolour says "the same thing, dimmer",
   * and what has to read here is that a piece of him is GONE. The broken sheet
   * shears the command pauldron to a stub and dims the visor, so the change is
   * in the outline and survives being 112px on a phone.
   *
   * Idempotent, and there is no second layer and no regeneration in this gate.
   */
  _breakArmour() {
    if (this.armourBroken) return;
    this.armourBroken = true;
    this.armour = 0;
    this._animPrefix = this.def.animBroken;
    this.setTexture(this.def.texBroken);
    if (this._armourBar) this._armourBar.visible = false;

    // ── THE MOMENT, NOT JUST THE STATE CHANGE ─────────────────────────────
    // The mechanic was already right; what it lacked was weight. Five things,
    // stacked in the order they physically happen — and all of them ACTOR
    // SCALE. This is a plate failing, not a boss phase: no screen flash, no
    // white-out, nothing that stops the player reading the fight around him.
    const fx = this.scene.fx;
    // 0. THE OVERLOAD. S1: the break now begins as the absorption language
    //    FAILING rather than as a separate event — the suit tries to eat this
    //    one too, at full strength and from every plate at once, and cannot.
    //    That is what turns "his armour broke" into "I overloaded his armour",
    //    and it is the last frame the intact-armour vocabulary is ever used:
    //    `_absorbHit` is only reachable from the branch where `armour > 0`, so
    //    after this the grammar changes by CONSTRUCTION rather than by a flag.
    for (let i = 0; i < 3; i++) {
      const a = this._aim + Math.PI + (i - 1) * 0.8;
      this._absorbHit(this.def.absorb.bigHit,
        { x: Math.cos(a) * 100, y: Math.sin(a) * 100 }, i === 0);
    }
    // 1. the crack: a hard white ring at his own depth, tight, and his own blue
    //    a beat behind it — the plate failing, then its power letting go. TWO
    //    rings rather than one is what makes the break electrical rather than
    //    merely loud, which is the whole "I cracked him" read §4 asks for.
    fx?.impactRing?.(this.x, this.y, 0xffffff, this.y + 3);
    fx?.impactRing?.(this.x, this.y, this.def.color, this.y + 3);
    // 2. the shards, thrown FROM the shoulder that lost its plate and AWAY from
    //    it, so the debris says which piece went.
    const away = this._aim + Math.PI * (this._facingSuffix().flipX ? 0.35 : -0.35);
    fx?.burstDir?.(this.x, this.y - 8, 'white', 14, away, 70);
    fx?.burstDir?.(this.x, this.y - 8, 'yellow', 8, away, 130);
    // 3. the discharge — his own electric blue, over the break. Longer than the
    //    first build's 220ms: at ~1.4 frames on a slow machine that beat could
    //    be missed entirely, and this is the one moment the electrical identity
    //    has the stage to itself.
    this._discharge(340);
    // 3b. and a FRACTURE — four arcs thrown out along the shear, drawn once at
    //     full strength. The discharge crawls over him; this says the break has
    //     a direction.
    this._fracture(away);
    // 4. the flinch. A real body reaction: the stagger pose and its cooldown,
    //    taken deliberately rather than waiting for the damage threshold.
    this._enter(CAP.STAGGER, this.def.staggerMs);
    this._staggerCd = this.def.staggerCooldownMs;
    this.recoilT = 140;
    // 5. and the punctuation, last, on the sequencing queue so it cannot land
    //    on top of a low-health mark in the same frame.
    this._punctuate('glyph-break');
    SFX.captainArmourBreak?.();
    fx?.shake?.(0.006, 140);
    this.scene.events.emit('champion-armour-broken', this);
  }

  // ── THE REACTION LAYER ────────────────────────────────────────────────────
  //
  // Everything below is owned by this actor and dies with it. No Phaser timers:
  // the punctuation queue is DATA ticked in `preUpdate`, so there is nothing to
  // cancel on death and nothing that can fire into a destroyed scene. Tweens
  // are attached to objects held in `_reactFx`, and `_clearReactions` kills
  // both halves.

  /**
   * THE SHEAR, DRAWN ONCE.
   *
   * Four blue-white arcs thrown along the bearing the plate went, fading over
   * ~260ms. It uses `_reactFx` and the `_tick` closure contract the discharge
   * uses, so it is redrawn from his LIVE position and cannot be stranded on the
   * spot he was standing when he broke.
   */
  _fracture(ang) {
    if (!this.scene?.add) return;
    const g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    g.setDepth(this.y + 6);
    this._reactFx.push(g);
    const started = this._clock;
    const MS = 260;
    g._tick = () => {
      const u = (this._clock - started) / MS;
      if (u >= 1 || !this.alive) { this._dropFx(g); g.destroy(); return; }
      g.clear();
      g.setDepth(this.y + 6);
      const a = 1 - u;
      const st = this._site(0);
      for (let i = 0; i < 4; i++) {
        const th = ang + (i - 1.5) * 0.34;
        const len = 26 + i * 5;
        this._bolt(g, st.x, st.y,
          st.x + Math.cos(th) * len, st.y + Math.sin(th) * len,
          10, i % 2 ? 2.5 : 1.5, i % 2 ? 0xffffff : this.def.color, a * 0.9);
      }
    };
  }

  /**
   * Queue one glyph. SEQUENCED, NEVER SIMULTANEOUS.
   *
   * Two marks in the same frame is effect soup and neither reads, and the
   * armour breaking at the same instant as the health line is crossed is not a
   * hypothetical — a Super does both. `punctSpacingMs` is the floor between
   * them; the second simply waits.
   */
  _punctuate(key, opts = {}) {
    if (!this.alive || !this.scene) return;
    const at = Math.max(this._clock, this._punctFreeAt);
    this._punctFreeAt = at + this.def.punctSpacingMs;
    this._punctQueue.push({ key, at, opts });
  }

  _tickPunctuation() {
    while (this._punctQueue.length && this._punctQueue[0].at <= this._clock) {
      const { key, opts } = this._punctQueue.shift();
      this._spawnGlyph(key, opts);
    }
  }

  /**
   * ABOVE THE HELMET, NEVER OVER THE VISOR.
   *
   * The visor is the fastest identification on the body and the one thing a
   * reaction may not cover. The glyph sits clear of the head, rises a little
   * and goes; it is depth-sorted just above the actor so it cannot be hidden by
   * him and cannot draw over the enemy standing in front.
   */
  _spawnGlyph(key, opts = {}) {
    if (!this.alive || !this.scene?.add) return;
    if (!this.scene.textures.exists(key)) return;
    // OFF THE CENTRELINE, DELIBERATELY. `fx.damageNumber` spawns at
    // `(x, y - 40)` and rises straight up, so a glyph directly over the helmet
    // shares a column with every hit label — and the frame that caused a
    // reaction is exactly the frame that also printed a number. Pushed to the
    // side and held lower than the label's arc, the two read as two things.
    const g = this.scene.add.image(
      this.x + (opts.dx ?? 24), this.y - this._headroom() - 18, key,
    ).setDepth(this.y + 24).setScale((opts.scale ?? 1) * 0.7).setAlpha(0);
    this._reactFx.push(g);
    const rise = (opts.rise ?? 1) * this.def.punctRiseMs;
    this.scene.tweens.add({
      targets: g, scale: opts.scale ?? 1, alpha: 1,
      duration: 90, ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: g, y: g.y - 22, alpha: 0,
      delay: rise * 0.42, duration: rise * 0.58, ease: 'Quad.easeIn',
      onComplete: () => { this._dropFx(g); g.destroy(); },
    });
  }

  /**
   * A short electrical arc over the body — the armour's own power letting go.
   *
   * ONE Graphics, redrawn each frame of its life from the actor's live
   * position, so it cannot be stranded where he used to be. His own blue,
   * because that is already what his systems are painted in.
   */
  _discharge(ms) {
    if (!this.scene?.add) return;
    const g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    g.setDepth(this.y + 4);
    this._reactFx.push(g);
    const started = this._clock;
    g._tick = () => {
      const u = (this._clock - started) / ms;
      if (u >= 1 || !this.alive) { this._dropFx(g); g.destroy(); return; }
      g.clear();
      g.setDepth(this.y + 4);
      const a = (1 - u) * 0.9;
      for (let i = 0; i < 3; i++) {
        let x = this.x + Phaser.Math.Between(-18, 18);
        let y = this.y + Phaser.Math.Between(-22, 6);
        g.lineStyle(2, i === 0 ? 0xffffff : this.def.color, a);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 3; k++) {
          x += Phaser.Math.Between(-11, 11);
          y += Phaser.Math.Between(-9, 9);
          g.lineTo(x, y);
        }
        g.strokePath();
      }
    };
  }

  /**
   * ── SUSTAINED DAMAGE: AN ELECTRICALLY DAMAGED SHOCK UNIT ─────────────────
   *
   * WHAT THIS REPLACES, AND WHY. B.2.1 carried two symmetrical orange embers, a
   * puff and a spark — and the handset verdict was that it did not communicate
   * "mechanically damaged and breaking down" at all: it read as an actor with
   * two status lights on. The embers were the right INSTINCT (something has to
   * be true in every frame, or a still and a glance both catch nothing) and the
   * wrong FORM: symmetrical, round, coloured and pulsing is the vocabulary of a
   * designed-in indicator, which is exactly what a player decodes it as.
   *
   * THE THREE PROPERTIES THE REPLACEMENT HAS AND THE EMBERS DID NOT:
   *
   *   ASYMMETRIC   one failure site, on the side that actually lost its plate,
   *                and a second on the OPPOSITE flank only once the body itself
   *                is failing. Nothing here is mirrored, because damage is not.
   *   PHYSICAL     the always-true mark is a dark SCORCH — a stain with an
   *                irregular outline that does not pulse, because a burn does
   *                not breathe. It is the half a still frame catches, and the
   *                half that cannot be mistaken for a lamp.
   *   ELECTRICAL   his own blue-white current shorting across the break, and it
   *                is ENTIRELY EVENT-DRIVEN: a 130ms snap every second or so,
   *                never a loop. Unstable is the read, and a continuous arc is
   *                the opposite of unstable.
   *
   * Orange survives only as a thin remnant of hot metal at the break, well
   * under the electrical in weight. He is a SHOCK Captain; he should fail like
   * one.
   *
   * THE LADDER IS TWO RUNGS AND IT IS NOT A PHASE SYSTEM. ARMOUR BROKEN opens
   * site one, the vent and the occasional short. CRITICAL opens site two, makes
   * the smoke near-continuous, shortens the gap between shorts, destabilises
   * the visor and lets the current jump to the rifle housing. Nothing in either
   * rung touches speed, damage, cadence or the state machine, and
   * `smoke-captain-state` pins that.
   */
  _tickWear(delta) {
    if (!this.alive) return;
    const fx = this.scene.fx;
    const d = this.def;
    const roll = (r) => Phaser.Math.Between(r[0], r[1]);
    const crit = this._lowHealthFired;
    if (this.armourBroken || crit) {
      // SMOKE FROM THE SITE, NOT FROM HIS CENTRE. A vent at the body's middle
      // is a smoke machine; one at the hole is evidence.
      this._wearSmokeT -= delta;
      if (this._wearSmokeT <= 0) {
        this._wearSmokeT = roll(crit ? d.wearSmokeCriticalMs : d.wearSmokeMs);
        const st = this._site(0);
        // `ventSmoke`, not `smokeTrail`. The missile trail's particle is darker
        // than the deck and lives 420ms, and one of them on a body photographs
        // as nothing — measured. This one is lighter than the floor, rises, and
        // is drawn above the actor band instead of behind the actor.
        fx?.ventSmoke?.(st.x + Phaser.Math.Between(-5, 5), st.y, crit ? 3 : 2);
      }
      // THE SHORT CIRCUIT. An EVENT with a held tail, not a state: the gap is
      // re-rolled every time so it never finds a rhythm, which is what keeps it
      // reading as a fault rather than as a blinker.
      this._arcT -= delta;
      if (this._arcT <= 0) {
        this._arcT = roll(crit ? d.arc.criticalMs : d.arc.brokenMs);
        this._arcHold = d.arc.holdMs;
        this._arcToRifle = crit && Math.random() < d.arc.rifleJumpChance;
        SFX.captainShort?.();
        if (crit) {
          const st = this._site(Math.random() < 0.5 ? 0 : 1);
          fx?.burstDir?.(st.x, st.y, 'white', 2, this._aim + Math.PI, 50);
        }
      }
      if (this._arcHold > 0) this._arcHold -= delta;
      // THE VISOR CANNOT HOLD, and at critical it holds a good deal less.
      this._wearFlickerT -= delta;
      if (this._wearFlickerT <= 0) {
        this._wearFlickerT = roll(crit ? d.wearFlickerCriticalMs : d.wearFlickerMs);
        this._flickerHold = d.wearFlickerHoldMs;
      }
    }
    if (this._flickerHold > 0) this._flickerHold -= delta;
    this._drawDamage();
  }

  /**
   * WHERE HE IS BROKEN, in world pixels, on the body's own facing.
   *
   * Site 0 is the shoulder that lost the command pauldron — the sheared side,
   * so the damage is where the silhouette says it is. Site 1 is the opposite
   * flank and opens only at critical, which is what makes the deterioration
   * read as spreading rather than as brightening.
   *
   * BOTH SIT BELOW THE HELMET. The visor is the fastest identification on this
   * body and nothing may crowd it — the same rule that removed the third ember.
   */
  _site(i) {
    const side = this._facingSuffix().flipX ? 1 : -1;
    return i === 0
      ? { x: this.x + side * 18, y: this.y - 11 }
      : { x: this.x - side * 11, y: this.y + 5 };
  }

  /** A jagged polyline. Shared by the crawl, the plate arcs and the rifle jump. */
  _bolt(g, ax, ay, bx, by, jitter, width, color, alpha) {
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(ax, ay);
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      g.lineTo(ax + (bx - ax) * t + (Math.random() - 0.5) * jitter,
        ay + (by - ay) * t + (Math.random() - 0.5) * jitter);
    }
    g.lineTo(bx, by);
    g.strokePath();
  }

  /**
   * THE TWO HALVES, DRAWN FROM THE LIVE BODY EVERY FRAME.
   *
   * `_wound` is NORMAL-blended and dark: it takes light away, which is what a
   * burn does and what no additive effect can do. `_arcGfx` is ADD and carries
   * only the current. Keeping them on separate objects is not tidiness — an
   * additive scorch is a bright patch, and a normal-blended arc on a dark deck
   * is a grey scribble.
   */
  _drawDamage() {
    const want = this.armourBroken || this._lowHealthFired;
    if (!want) {
      for (const k of ['_wound', '_arcGfx']) {
        if (this[k]) { this._dropFx(this[k]); this[k].destroy(); this[k] = null; }
      }
      return;
    }
    if (!this._wound) {
      if (!this.scene?.add) return;
      this._wound = this.scene.add.graphics();
      this._arcGfx = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      this._reactFx.push(this._wound, this._arcGfx);
    }
    const w = this._wound, g = this._arcGfx;
    w.clear(); g.clear();
    w.setDepth(this.y + 5);
    g.setDepth(this.y + 6);

    const crit = this._lowHealthFired;
    const sites = crit ? [this._site(0), this._site(1)] : [this._site(0)];
    const a = this.def.arc.scorchAlpha;

    // SIZED AGAINST THE SPRITE, NOT AGAINST A FEELING. He is 112px wide on
    // screen; the first build used r=6, which is a ten-pixel blot on a
    // hundred-and-twelve-pixel body — about a tenth of his width, and it
    // photographed as nothing at 1x. A damaged plate has to be a fifth of the
    // torso to read as a hole rather than as dirt.
    for (let i = 0; i < sites.length; i++) {
      const st = sites[i];
      const r = i === 0 ? 11 : 8;
      // THE SCORCH — three overlapping discs at deliberately unequal offsets.
      // One disc is a dot; three is a blot, and a blot has an outline the eye
      // reads as burnt material. It does NOT pulse.
      w.fillStyle(0x08090c, a);
      w.fillCircle(st.x, st.y, r);
      w.fillCircle(st.x - r * 0.72, st.y + r * 0.34, r * 0.64);
      w.fillCircle(st.x + r * 0.58, st.y + r * 0.48, r * 0.52);
      w.fillStyle(0x1a1d23, a * 0.8);
      w.fillCircle(st.x + r * 0.22, st.y - r * 0.42, r * 0.56);
      // THE HOT REMNANT — two small irregular points of cooling metal, dim and
      // deliberately NOT centred on the scorch. This is all that is left of the
      // orange: it is evidence of heat, not an indicator light.
      g.fillStyle(0xff7a2a, 0.40);
      g.fillCircle(st.x + r * 0.34, st.y + r * 0.26, r * 0.30);
      g.fillStyle(0xffc089, 0.30);
      g.fillCircle(st.x - r * 0.46, st.y - r * 0.12, r * 0.20);
    }

    // ── THE CURRENT. Only while an event is being held. ────────────────────
    if (this._arcHold > 0) {
      const u = this._arcHold / this.def.arc.holdMs;   // 1 -> 0 across the snap
      for (const st of sites) {
        this._bolt(g, st.x - 14, st.y - 6, st.x + 14, st.y + 6, 10, 2.5, 0xffffff, 0.9 * u);
        this._bolt(g, st.x - 10, st.y + 9, st.x + 15, st.y - 5, 11, 2,
          this.def.color, 0.85 * u);
        g.fillStyle(0xffffff, 0.95 * u);
        g.fillCircle(st.x, st.y, 3.4);
      }
      // THE JUMP TO THE RIFLE. The one effect that says the WEAPON is
      // compromised, and the reason it is rationed: a body arcing to its own
      // gun every second would be a light show, and once in three shorts at
      // critical is a fault.
      if (this._arcToRifle && this.weaponSprite) {
        this._bolt(g, sites[0].x, sites[0].y, this.weaponSprite.x, this.weaponSprite.y,
          14, 2, this.def.color, 0.7 * u);
      }
    }
  }

  /**
   * THE VISOR CANNOT HOLD.
   *
   * Applied after `super.preUpdate` for the same reason the weapon kick is:
   * `Enemy.preUpdate` writes `setAlpha` every frame, so anything that touches
   * it upstream is a second author that loses. A dip rather than a tint —
   * tinting reaches the whole body and reads as a status effect, where a
   * momentary loss of alpha reads as power failing.
   */
  _applyFlicker() {
    if (this._flickerHold > 0 && !this._performing) this.setAlpha(0.62);
  }

  _dropFx(o) {
    const i = this._reactFx.indexOf(o);
    if (i >= 0) this._reactFx.splice(i, 1);
  }

  /** Nothing this actor started may outlive it. */
  /** A committed corridor must not outlive the commitment that made it. */
  _clearPlan() {
    this._plan = null;
    this._planShot = 0;
  }

  _clearReactions() {
    this._punctQueue.length = 0;
    this._wound = null;
    this._arcGfx = null;
    this._reactFx.slice().forEach((o) => {
      this.scene?.tweens?.killTweensOf(o);
      o.destroy?.();
    });
    this._reactFx.length = 0;
  }

  _enter(state, ms = 0) {
    this._cap = state;
    this._stateMs = ms;
  }

  /** A point the Captain can actually stand on, clamped inside the arena. */
  _clampPoint(x, y) {
    const b = this.scene.physics.world.bounds;
    const r = this.def.radius + 6;
    return {
      x: Phaser.Math.Clamp(x, b.x + r, b.right - r),
      y: Phaser.Math.Clamp(y, b.y + r, b.bottom - r),
    };
  }

  /**
   * PICK THE NEXT MOVEMENT, AND ITS REASON.
   *
   * A small combat-position solver, not a planner. Three questions in order:
   * am I too far to shoot, am I crowded, and otherwise where is a better angle.
   * Deliberately NOT a pass planner, a path validator or a chord solver —
   * `HANDOVER.md` §10af records what building one of those first cost.
   */
  _solvePosition(p) {
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const toPlayer = Math.atan2(dy, dx);

    if (dist > this.def.holdMax) {
      // ADVANCE — close to the near edge of the band rather than to the player.
      const want = this.def.holdMax - 80;
      this._target = this._clampPoint(
        p.x - Math.cos(toPlayer) * want, p.y - Math.sin(toPlayer) * want);
      this._enter(CAP.ADVANCE, this.def.advanceMs);
      return;
    }
    if (dist < this.def.holdMin) {
      // GIVE GROUND — straight back down the bearing, still facing the player.
      // A Captain that turned and ran would stop being an opponent.
      const want = this.def.holdMin + 130;
      this._target = this._clampPoint(
        p.x - Math.cos(toPlayer) * want, p.y - Math.sin(toPlayer) * want);
      this._enter(CAP.GIVE_GROUND, this.def.giveGroundMs);
      return;
    }
    // STRAFE — perpendicular, at the distance he already has. Occasionally he
    // changes side, so a player cannot learn one lead and hold it for a fight.
    if (Math.random() < this.def.sideSwapChance) this._side *= -1;
    // ── HE KNOWS WHERE HIS OWN FIELD IS ───────────────────────────────────
    // §21, and deliberately the smallest version of it that is true: NOT a
    // tactical director, NOT a threat map. One fact — while the field is live,
    // take the side that puts the player BETWEEN him and it, so backing away
    // from his rifle is backing toward electrified ground. That is the whole
    // "rifle and grenade are one fighter's two tools" loop, and it is four
    // lines because anything larger would be a second AI.
    if (this._nade?.live) {
      const want = Math.atan2(this._nade.y - p.y, this._nade.x - p.x) + Math.PI;
      const cur = toPlayer + Math.PI;                 // bearing player -> captain
      // Stepping along `toPlayer + 90` rotates that bearing NEGATIVE, so the
      // side that closes a positive gap is -1. Written out because it reads
      // like a sign error either way round.
      this._side = Phaser.Math.Angle.Wrap(want - cur) > 0 ? -1 : 1;
    }
    const perp = toPlayer + Math.PI / 2 * this._side;
    const step = 190;
    this._target = this._avoidField(
      this._clampPoint(this.x + Math.cos(perp) * step, this.y + Math.sin(perp) * step));
    this._enter(CAP.STRAFE, Phaser.Math.Between(this.def.strafeMs[0], this.def.strafeMs[1]));
  }

  /**
   * DO NOT WALK INTO YOUR OWN GRENADE.
   *
   * A destination inside the live field is pushed radially out past it, plus a
   * standoff. It is applied to every reposition target rather than to the
   * navigation, because a Captain who refused to CROSS his own field would
   * freeze whenever it landed between him and where he wanted to be — and an
   * elite stepping through his own electricity for half a second on the way
   * somewhere is a man in a hurry, where standing in it is a man who does not
   * understand his own equipment.
   */
  _avoidField(t) {
    const f = this._nade;
    if (!f?.live) return t;
    const keep = f.radius + this.def.grenade.standoff;
    const dx = t.x - f.x, dy = t.y - f.y;
    const d = Math.hypot(dx, dy);
    if (d >= keep) return t;
    const a = d > 1 ? Math.atan2(dy, dx) : this._aim + Math.PI;
    return this._clampPoint(f.x + Math.cos(a) * keep, f.y + Math.sin(a) * keep);
  }

  /** May he open a burst from here, right now? */
  _canFire(p, dist) {
    return this._fireCd <= 0
      && dist <= this.def.fireRange
      && this._hasLOS(this.x, this.y, p.x, p.y);
  }

  /**
   * ── THE TACTICAL STEP: SHOULD HE, AND WHY? ──────────────────────────────
   *
   * Returns a REASON STRING or null, and the reason is the whole design. Every
   * one of them is a fact about the fight that was true before the player
   * decided anything:
   *
   *   'close'     they pushed inside the band he wants to hold
   *   'blocked'   he is ready to fire, in range, and has no line — measured in
   *               B.2.1 as a real state he occupies for 21-34 frames at a time
   *   'postburst' he has just spent a commitment and can change the angle
   *   'field'     his own Arc Field is live and there is a better side of it
   *
   * IT NEVER READS THE PLAYER'S SUPER. Not `superAiming`, not `superAim`, not
   * `superCharge`, not `player-fire-super`, not a pellet in flight. A Captain
   * that sidestepped the button press would be an unloseable coin flip wearing
   * the costume of skill, and it would make the whole S1 measurement a lie:
   * the question is whether ORDINARY good footwork lowers a 70% pellet
   * connection rate, and a build that dodged the input would answer a
   * different one. `smoke-captain-step` greps this file for each of those
   * identifiers and probes a live cast as well.
   */
  _stepReasonFor(p, dist) {
    if (this._stepCd > 0) return null;
    const d = this.def.step;
    // ── PRIORITY 1: AGGRESSIVE CLOSE PRESSURE (§7) ──────────────────────
    // The most important use by a distance, and the handset says he was not
    // taking it: the band widened from 0.82 of `holdMin` to 0.95, and a player
    // who is still CLOSING qualifies from further out. Waiting until they have
    // arrived is waiting until the firing solution they are building is
    // already finished.
    //
    // IT IS THE RELATIONSHIP, NEVER THE BUTTON. Distance and approach rate were
    // both true before the player decided anything this frame; neither can
    // express "they are about to fire".
    if (dist < this.def.holdMin * d.closeFrac) return 'close';
    if (dist < this.def.holdMin * 1.3 && this._closing >= d.closingPxPerS) return 'close';
    // ── PRIORITY 2: POST-BURST ANGLE CHANGE ────────────────────────────
    if (this._wantPostBurstStep) return 'postburst';
    // ── PRIORITY 3: EXPLOIT HIS OWN FIELD ──────────────────────────────
    if (this._nade?.live && Math.random() < d.fieldChance * 0.06) return 'field';
    // ── PRIORITY 4: BLOCKED LINE ───────────────────────────────────────
    // LAST, and it waits longer than it did. A step spent walking round a
    // console is a step not spent breaking the player's firing solution, and
    // ordinary navigation already solves a blocked line at walking pace.
    if (this._blockedMs >= d.blockedMs) return 'blocked';
    return null;
  }

  /**
   * WHERE THE STEP GOES, AND WHETHER IT IS LEGAL.
   *
   * Direction comes from the reason — away from a crowding player, sideways
   * for an angle change, toward the side of his own field that keeps the
   * player pinned against it. Then it is VALIDATED, and refused rather than
   * fudged if it cannot be: a step that ends inside a console or outside the
   * arena is worse than no step.
   *
   * `_hasLOS` is the validation, and using it is the point — it is the same
   * line-of-sight arithmetic his firing already trusts, run against the
   * destination instead of the player. No second planner, no nav query, no new
   * geometry: if he could shoot at that spot he can walk to it. The physics
   * collider is still underneath as the backstop, so a wrong answer costs a
   * short stop rather than a body in a wall.
   */
  _solveStep(p, reason) {
    const d = this.def.step;
    const toPlayer = Math.atan2(p.y - this.y, p.x - this.x);
    const side = this._side || 1;
    const candidates = [];
    if (reason === 'close') {
      // Back off and across, never straight back: straight back is a retreat
      // and he does not turn away from the fight.
      candidates.push(toPlayer + Math.PI * 0.72 * side, toPlayer + Math.PI * 0.72 * -side);
    } else if (reason === 'field') {
      // The same exploitation `_solvePosition` does at walking pace: take the
      // side that puts the PLAYER between him and his own electricity.
      const want = Math.atan2(this._nade.y - p.y, this._nade.x - p.x) + Math.PI;
      const cur = toPlayer + Math.PI;
      const s = Phaser.Math.Angle.Wrap(want - cur) > 0 ? -1 : 1;
      candidates.push(toPlayer + Math.PI / 2 * s, toPlayer + Math.PI / 2 * -s);
    } else {
      // 'blocked' and 'postburst' both want a new firing angle, so both go
      // lateral — the shortest path to a different relationship.
      candidates.push(toPlayer + Math.PI / 2 * side, toPlayer + Math.PI / 2 * -side);
    }
    for (const ang of candidates) {
      let t = this._clampPoint(this.x + Math.cos(ang) * d.distance,
        this.y + Math.sin(ang) * d.distance);
      t = this._avoidField(t);
      // A clamp can pull the destination back onto the arena edge, so the
      // reach is re-measured AFTER it — a step that clamps to 8px is not a
      // step and should be refused rather than performed as a twitch.
      const reach = Math.hypot(t.x - this.x, t.y - this.y);
      if (reach < d.distance * 0.55) continue;
      if (!this._hasLOS(this.x, this.y, t.x, t.y)) continue;
      return { x: t.x, y: t.y, reach };
    }
    return null;
  }

  /** Commit: plant first, then the impulse. No i-frames, no damage change. */
  _beginStep(p, reason, dest) {
    const d = this.def.step;
    this._enter(CAP.STEP, d.plantMs + d.travelMs + d.catchMs);
    this._stepPlantMs = d.plantMs;
    this._stepCatchMs = 0;
    this._stepReason = reason;
    this._stepFrom = { x: this.x, y: this.y };
    this._stepBearing0 = Math.atan2(p.y - this.y, p.x - this.x);
    this._stepDist0 = Math.hypot(p.x - this.x, p.y - this.y);
    this._stepCd = d.cooldownMs;
    this._wantPostBurstStep = false;
    this._blockedMs = 0;
    this._stepEchoT = 0;
    const ang = Math.atan2(dest.y - this.y, dest.x - this.x);
    const speed = dest.reach / (d.travelMs / 1000);
    this._stepVx = Math.cos(ang) * speed;
    this._stepVy = Math.sin(ang) * speed;
    this.setVelocity(0, 0);
    // THE SUIT ANSWERS BEFORE THE BODY MOVES. The preload runs inside the
    // plant, so the equipment announces the launch a frame before it happens —
    // which is what makes the push-off read as assisted rather than as a sprite
    // acquiring velocity.
    this._stepPreload(ang);
    this.scene.events.emit('champion-step', this, reason, dest.reach);
  }

  /**
   * WHERE HIS BOOTS ARE, IN WORLD PIXELS.
   *
   * DERIVED FROM THE SPRITE, NOT PICKED. The body is 28x30 at scale 4 with a
   * centred origin and the boots occupy the last few canvas rows, so the deck
   * he is standing on is most of a half-height below his centre. Every step
   * effect that claims to touch the FLOOR reads this: the first build drew them
   * at `y + 6` and `y + 10`, which is his WAIST, and they photographed as light
   * around his middle rather than as a man pushing off a deck.
   */
  _bootY() {
    return this.y + (this.displayHeight ? this.displayHeight * 0.30 : 34);
  }

  /**
   * PRELOAD — a short blue-white charge across the pack and the launching side,
   * drawn for the length of the plant.
   *
   * POWERED ARMOUR ASSISTING A SIDESTEP, not a magic dash charging. It is
   * short, it is small, and it is gone by the time he is moving: a preload the
   * player has time to admire is a wind-up, and this is footwork.
   */
  _stepPreload(ang) {
    if (!this.scene?.add) return;
    const g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this._reactFx.push(g);
    const started = this._clock;
    const MS = this.def.step.plantMs + 40;
    const back = ang + Math.PI;
    g._tick = () => {
      const u = (this._clock - started) / MS;
      if (u >= 1 || !this.alive) { this._dropFx(g); g.destroy(); return; }
      g.clear();
      g.setDepth(this.y + 2);
      // Rising, not fading: the charge builds into the push-off.
      const a = 0.25 + u * 0.55;
      const r = this.def.radius * 0.72;
      // Two short bars on the pack, and a brightening point at the launch foot.
      for (let i = -1; i <= 1; i += 2) {
        const th = back + i * 0.55;
        this._bolt(g, this.x + Math.cos(th) * r * 0.6, this.y + Math.sin(th) * r * 0.6 - 6,
          this.x + Math.cos(th) * r, this.y + Math.sin(th) * r - 6,
          3, 2, this.def.color, a);
      }
      // The launching foot brightening — at the DECK, and large enough to read
      // at 1x against a hangar floor.
      const fx0 = this.x + Math.cos(back) * r * 0.8;
      const fy0 = this._bootY() + Math.sin(back) * r * 0.35;
      g.fillStyle(this.def.color, a * 0.5);
      g.fillCircle(fx0, fy0, 4 + u * 7);
      g.fillStyle(0xffffff, a * 0.9);
      g.fillCircle(fx0, fy0, 2 + u * 3.5);
    };
  }

  /**
   * THE CATCH — deck impact where he lands, and the body compresses into it.
   *
   * A 200px displacement that ends by switching the velocity off is the floaty
   * read this whole pass exists to remove. The `land` frame does the body half;
   * this is the deck half — a low, flat ring and a few sparks at the boots, so
   * the stop has a place as well as a pose. Flat and wide on purpose: a tall
   * bloom here would be a landing effect from a different game.
   */
  _stepCatchFx() {
    const fx = this.scene.fx;
    fx?.burstDir?.(this.x, this._bootY(), 'white', 5, Math.PI / 2, 80);
    if (!this.scene?.add) return;
    const g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this._reactFx.push(g);
    const started = this._clock;
    const MS = this.def.step.catchMs + 80;
    const ox = this.x, oy = this._bootY();
    g._tick = () => {
      const u = (this._clock - started) / MS;
      if (u >= 1 || !this.alive) { this._dropFx(g); g.destroy(); return; }
      g.clear();
      g.setDepth(oy - 4);
      const a = (1 - u) * 0.8;
      // STARTS BIG AND OPENS. A ring that begins at r=10 on a 112px body is
      // eight percent of him and photographs as nothing at all — the same
      // mistake the B.2.2 damage marks made at r=6.
      const r = 26 + u * 34;
      g.lineStyle(3, this.def.color, a);
      // Flattened 5:1: it lies on the deck rather than standing in the air, and
      // it can never be mistaken for the 96px threat circle he is wearing.
      g.strokeEllipse(ox, oy, r * 2.2, r * 0.44);
      g.lineStyle(1.5, 0xffffff, a * 0.9);
      g.strokeEllipse(ox, oy, r * 1.2, r * 0.24);
      // Two short scuffs kicked sideways out of the landing — the deck
      // answering a body that arrived hard.
      for (const sgn of [-1, 1]) {
        this._bolt(g, ox + sgn * r * 0.5, oy,
          ox + sgn * (r * 1.05 + u * 14), oy - 2, 3, 2, 0xffffff, a * 0.8);
      }
    };
  }

  /**
   * A RESTRAINED SILHOUETTE ECHO — TWO, AND THEY ARE GONE IN 130ms.
   *
   * THE HARROWER IS THE NEGATIVE REFERENCE (§6). A persistent trail is what
   * made a body read as a craft gliding, so this is deliberately not one: two
   * discrete stamps of his own frame at the positions he actually occupied,
   * each dying fast, with nothing joining them. They say "he was there a moment
   * ago"; they must never say "he is sliding".
   */
  _stepEcho() {
    if (!this.scene?.add || !this.texture) return;
    const img = this.scene.add.image(this.x, this.y, this.texture.key, this.frame.name)
      .setDepth(this.y - 3)
      .setScale(this.scaleX, this.scaleY)
      .setFlipX(this.flipX)
      .setTint(0x8fd8ff)
      .setAlpha(0.42)
      .setBlendMode(Phaser.BlendModes.ADD);
    this._reactFx.push(img);
    const started = this._clock;
    img._tick = () => {
      const u = (this._clock - started) / 130;
      if (u >= 1 || !this.alive) { this._dropFx(img); img.destroy(); return; }
      img.setAlpha(0.42 * (1 - u));
    };
  }

  /**
   * THE IMPULSE, AND IT COMES OUT OF THE PACK AND THE BOOTS.
   *
   * Drawn opposite the travel, so the thrust reads as the thing that caused
   * the movement rather than as a trail following it. His own blue: this is
   * the same equipment the visor, the bolt and the grenade are painted in, and
   * an assisted step should look assisted.
   */
  _stepThrust(ang) {
    const fx = this.scene.fx;
    const back = ang + Math.PI;
    fx?.burstDir?.(this.x + Math.cos(back) * 10, this.y + Math.sin(back) * 10 + 6,
      'white', 5, back, 120);
    if (!this.scene?.add) return;
    const g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    g.setDepth(this.y - 2);
    this._reactFx.push(g);
    const started = this._clock;
    const MS = 240;
    // THE DECK HE PUSHED OFF, not the air beside his waist.
    const ox = this.x, oy = this._bootY();
    g._tick = () => {
      const u = (this._clock - started) / MS;
      if (u >= 1 || !this.alive) { this._dropFx(g); g.destroy(); return; }
      g.clear();
      g.setDepth(this.y - 2);
      const a = (1 - u) * 0.9;
      // A short cone of thrust at the ORIGIN, which stays put — the body
      // leaves it behind, which is what says he pushed off from there. FIVE
      // strands over 200px rather than three over 150: the displacement class
      // went up and an impulse that did not go with it reads as the same small
      // shove producing a longer slide, which is the Harrower again.
      // ── DIRECTIONAL, NOT RADIAL ─────────────────────────────────────
      // THE CAPTAIN ALREADY WEARS A 96px CYAN CIRCLE — the threat ring — so
      // ANYTHING blue, round and near him merges into it and reads as a bubble.
      // The first build spread five strands over ±0.26 rad and photographed as
      // exactly that. These are three LONG, TIGHT streaks straight back down
      // the travel axis: a shape the threat ring cannot be confused with, and
      // the only shape that says which way he went.
      for (let i = 0; i < 3; i++) {
        const th = back + (i - 1) * 0.11;
        const len = (78 - Math.abs(i - 1) * 22) + u * 30;
        this._bolt(g, ox + Math.cos(back) * 12, oy + Math.sin(back) * 6,
          ox + Math.cos(th) * len, oy + Math.sin(th) * len * 0.5,
          6, i === 1 ? 4 : 2, i === 1 ? 0xffffff : this.def.color, a);
      }
      // THE DECK ANSWERS. A flat scuff at the launch foot — the surface he
      // pushed against, which is the difference between a footstep and a jet.
      // 5:1 AND OFFSET DOWN THE TRAVEL AXIS: a ring centred on a body is a
      // circle telegraph whatever colour it is, and a shield bubble is the one
      // thing the reactive armour was deliberately not.
      g.lineStyle(3, this.def.color, a * 0.9);
      g.strokeEllipse(ox + Math.cos(back) * 16, oy + Math.sin(back) * 8,
        100 + u * 50, 20 + u * 10);
    };
  }

  /**
   * MAY HE THROW? ONE AT A TIME, AND NEVER AS THE OPENING BEAT.
   *
   * The rifle is the baseline and the grenade is a tool, so the gates are
   * deliberately strict: a cooldown long enough that the field is gone for most
   * of it, no second grenade while one is live, a range band in which the throw
   * is a real read rather than a panic lob, and line of sight — he has to be
   * able to see the movement he is predicting.
   */
  _canThrow(p, dist) {
    const g = this.def.grenade;
    return this._nadeCd <= 0
      && (!this._nade || this._nade.dead)
      && dist >= g.minRange && dist <= g.maxRange
      && this._hasLOS(this.x, this.y, p.x, p.y);
  }

  /**
   * THE RELEASE FRAME.
   *
   * Called at the START of `CAP.THROW` — the body has already spent
   * `windupMs` reaching for it, and this is the beat the arm comes over. The
   * lead is solved HERE and not at the wind-up, so the prediction reads the
   * movement the player is committing to at the moment of release rather than
   * the movement they had half a second ago.
   *
   * WHERE IT GOES: the player's likely CONTINUATION, on the same fairness rule
   * as the burst — current velocity, bounded horizon, bounded displacement. A
   * grenade aimed at their feet is a hit-or-miss; one aimed at where they are
   * trying to go is a question about their route, which is what §15 asks for.
   */
  _throwGrenade(p) {
    const g = this.def.grenade;
    const v = p.body?.velocity;
    const h = g.leadMs / 1000;
    let lx = (v?.x ?? 0) * h, ly = (v?.y ?? 0) * h;
    const m = Math.hypot(lx, ly);
    if (m > g.leadMaxPx) { lx = lx / m * g.leadMaxPx; ly = ly / m * g.leadMaxPx; }
    const t = this._clampPoint(p.x + lx, p.y + ly);
    // It leaves from the HAND, not from the actor's centre: the throw has to
    // start where the arm is, or the object appears out of his chest.
    const off = this._facingSuffix().flipX ? -14 : 14;
    this._nade = this.scene.spawnArcGrenade?.({
      ...g, x: this.x + off, y: this.y - 10, tx: t.x, ty: t.y, owner: this,
    }) ?? null;
    this._nadeCd = g.cooldownMs;
    SFX.captainThrow?.();
    this.scene.fx?.burstDir?.(this.x + off, this.y - 10, 'white', 3,
      Math.atan2(t.y - this.y, t.x - this.x), 60);
    this.scene.events.emit('champion-arc-grenade', this, this._nade);
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.alive) {
      if (this._armourBar) this._armourBar.visible = false;
      if (this._reactFx.length || this._punctQueue.length) this._clearReactions();
      return;
    }

    // ONE LOCAL CLOCK. Everything the reaction layer schedules is measured on
    // it, so nothing reads wall time and a paused scene cannot advance a queue.
    this._clock += delta;
    if (this._staggerCd > 0) this._staggerCd -= delta;
    if (this._impactGlyphCd > 0) this._impactGlyphCd -= delta;
    if (this._acquireCd > 0) this._acquireCd -= delta;
    if (this._nadeCd > 0) this._nadeCd -= delta;
    if (this._stepCd > 0) this._stepCd -= delta;
    if (this._nade?.dead) this._nade = null;
    if (this._shotFlashMs > 0) this._shotFlashMs -= delta;
    if (this._wKick > 0) this._wKick = Math.max(0, this._wKick - delta * 0.09);
    this._tickPunctuation();
    this._tickWear(delta);
    this._reactFx.slice().forEach((o) => o._tick?.());

    // ONE SYSTEM DRIVES AN ACTOR AT A TIME. `Enemy.preUpdate` already yields on
    // `_performing`; this must too, so a future signature move's wind-up is not
    // overwritten by the combat loop on the very next frame.
    if (this._performing) {
      this._applyFlicker();
      this._drawArmourBar();
      return;
    }

    const p = this.scene.player;
    if (!p?.alive) { this.setVelocity(0, 0); this._drawArmourBar(); return; }

    const dist = Math.hypot(p.x - this.x, p.y - this.y);
    // HE ALWAYS FACES THE FIGHT. Facing is aim here, and aim is what the
    // animation selector reads — so a lateral step keeps the body square to the
    // player instead of turning into the direction of travel. That difference
    // is exactly "moving sideways while staying combat-ready" versus skating.
    // ── FACING, AND THE ONE PLACE IT IS NOT THE PLAYER ────────────────────
    // HE ALWAYS FACES THE FIGHT — except inside a firing commitment, where the
    // rifle belongs to the PLAN. Re-facing the player every frame between
    // rounds is the tracking read the corridor exists to remove: the barrel
    // would snap back onto them and then out to the next solution, which is
    // precisely what "aimbot" looks like. Inside a brace or a burst the aim
    // eases toward the next planned point and nowhere else, so the fire
    // visibly WALKS across the corridor at a speed the eye can follow.
    const inCommit = this._plan
      && (this._cap === CAP.BRACE || this._cap === CAP.BURST);
    if (inCommit) {
      const g = this._planPoint(this._planShot);
      if (g) {
        const want = Math.atan2(g.y - this.y, g.x - this.x);
        this._aim += Phaser.Math.Angle.Wrap(want - this._aim)
          * this.def.corridor.traverse;
      }
    } else {
      this._aim = Math.atan2(p.y - this.y, p.x - this.x);
    }
    // CLOSING RATE. Measured from real displacement between frames, never from
    // a velocity this actor just wrote — the Harrower's grind watchdog read its
    // own instruction and could never fire.
    if (this._lastDist != null && delta > 0) {
      const rate = (this._lastDist - dist) / (delta / 1000);
      this._closing += (rate - this._closing) * 0.18;
    }
    this._lastDist = dist;
    if (this._fireCd > 0) this._fireCd -= delta;
    this._stateMs -= delta;
    this._tickAcquire(p, delta);
    // READY TO FIRE, IN RANGE, AND NO LINE. The 'blocked' step reason, kept as
    // a running clock rather than an instant so a doorway or a passing body is
    // not a reason to move — the same distinction `acquireLostMs` draws.
    if (this._fireCd <= 0 && dist <= this.def.fireRange
        && !this._hasLOS(this.x, this.y, p.x, p.y)) this._blockedMs += delta;
    else this._blockedMs = 0;

    switch (this._cap) {
      case CAP.STAGGER:
        // Bounded, and it does not bleed. The body is allowed to slide on the
        // knockback it already has; the loop resumes the frame it expires.
        if (this._stateMs <= 0) this._solvePosition(p);
        break;

      case CAP.STEP: {
        // ── PLANT -> PUSH-OFF -> TRAVEL -> CATCH ─────────────────────────
        // Four beats and every one of them is visible. The plant is what makes
        // it footwork instead of a body acquiring velocity; the impulse is
        // spawned on the frame the plant ends, so the thrust and the movement
        // are the same event; and the CATCH is where he receives his own mass
        // instead of the velocity simply being switched off.
        const d = this.def.step;
        if (this._stepPlantMs > 0) {
          this._stepPlantMs -= delta;
          this.setVelocity(0, 0);
          if (this._stepPlantMs <= 0) {
            this._stepThrust(Math.atan2(this._stepVy, this._stepVx));
          }
        } else if (this._stateMs > d.catchMs) {
          // Velocity, not a tween or a teleport — so the wall collider is
          // still underneath and a destination check that was wrong costs a
          // short stop rather than a body inside a console.
          this.setVelocity(this._stepVx, this._stepVy);
          // TWO ECHOES ACROSS THE WHOLE TRAVEL, never a continuous trail.
          this._stepEchoT -= delta;
          if (this._stepEchoT <= 0) {
            this._stepEchoT = d.travelMs / 2;
            this._stepEcho();
          }
        } else {
          // THE CATCH. The body is stopped and the legs absorb it — this is a
          // real beat with its own frame, not the tail of the travel.
          if (this._stepCatchMs <= 0) {
            this._stepCatchMs = d.catchMs;
            this.setVelocity(0, 0);
            this._stepCatchFx();
          }
          this._stepCatchMs -= delta;
          this.setVelocity(0, 0);
        }
        if (this._stateMs <= 0) {
          this.setVelocity(0, 0);
          this._stepCatchMs = 0;
          this.scene.events.emit('champion-step-end', this, {
            reason: this._stepReason,
            moved: this._stepFrom
              ? Math.round(Math.hypot(this.x - this._stepFrom.x, this.y - this._stepFrom.y)) : 0,
            distBefore: Math.round(this._stepDist0 ?? 0),
            distAfter: Math.round(Math.hypot(p.x - this.x, p.y - this.y)),
            bearingChange: this._stepBearing0 != null
              ? Math.round(Math.abs(Phaser.Math.Angle.Wrap(
                Math.atan2(p.y - this.y, p.x - this.x) - this._stepBearing0)) * 180 / Math.PI)
              : 0,
          });
          this._solvePosition(p);
        }
        break;
      }

      case CAP.WINDUP:
        // REACHING FOR IT. Planted, because a man throwing a grenade plants —
        // and because the plant is what makes the wind-up readable as a
        // DIFFERENT commitment from a brace, which is also planted but which
        // holds the rifle up rather than dropping it.
        this.setVelocity(0, 0);
        if (this._stateMs <= 0) {
          this._enter(CAP.THROW, this.def.grenade.throwMs);
          this._throwGrenade(p);
        }
        break;

      case CAP.THROW:
        this.setVelocity(0, 0);
        if (this._stateMs <= 0) this._enter(CAP.RECOVER, this.def.grenade.recoverMs);
        break;

      case CAP.BRACE:
        this.setVelocity(0, 0);
        // ── THE COMMITMENT MOMENT (§22) ──────────────────────────────────
        // ONE authoritative snapshot, at late brace, immediately before the
        // first round. Late rather than at the top of the brace because 300ms
        // of wind-up is 300ms in which the player is still deciding — reading
        // them at the start of it would be reading a plan they have already
        // abandoned by the time he shoots. After this instant nothing in the
        // burst consults the player again.
        if (!this._plan && this._stateMs <= this.def.braceMs * 0.42) {
          this._planBurst(p);
        }
        if (this._stateMs <= 0) {
          if (!this._plan) this._planBurst(p);
          this._enter(CAP.BURST, 0);
          this._round = this._plan.rounds;
          this._roundGap = 0;
        }
        break;

      case CAP.BURST:
        this.setVelocity(0, 0);
        this._roundGap -= delta;
        if (this._roundGap <= 0 && this._round > 0) {
          this._fireRound(p);
          this._round--;
          this._roundGap = this.def.burstGapMs;
        }
        if (this._round <= 0 && this._roundGap <= 0) {
          this.scene.events.emit('champion-burst-plan', this, {
            rounds: this._plan?.rounds ?? 0,
            pattern: this._plan?.pattern ?? null,
            fired: this._planShot,
            still: !!this._plan?.still,
            len: Math.round(this._plan?.len ?? 0),
            bearing: this._plan
              ? Math.round(Math.atan2(this._plan.dy, this._plan.dx) * 180 / Math.PI) : 0,
          });
          // THE PLAN DIES WITH THE COMMITMENT. Nothing may carry a corridor
          // into the next burst: a stale route is a prediction about a decision
          // the player made seconds ago.
          this._plan = null;
          this._planShot = 0;
          this._enter(CAP.RECOVER, this.def.recoverMs);
          this._fireCd = this.def.fireEveryMs;
          // INTENT, NOT A STEP. The commitment is over and he may want a new
          // angle — but the step still has to pass its cooldown and its
          // geometry check, so this only ever ASKS.
          this._wantPostBurstStep = Math.random() < this.def.step.postBurstChance;
          this.scene.events.emit('champion-burst-complete', this);
        }
        break;

      case CAP.RECOVER:
        this.setVelocity(0, 0);
        if (this._stateMs <= 0) this._solvePosition(p);
        break;

      default: {
        // MOVING. The reason is already chosen; this is only the execution.
        // `_navigatePath` rather than a straight line, so a Ø56 body that meets
        // cover walks round it instead of grinding on it.
        const speed = this._cap === CAP.GIVE_GROUND
          ? this.cfg.speed * this.def.giveGroundSpeedMult : this.cfg.speed;
        const t = this._target;
        const left = t ? this._navigatePath(t.x, t.y, speed, delta) : 0;
        // ── THE STEP'S INTERRUPT CONTRACT (§14) ──────────────────────────
        // It is reachable ONLY from here — the moving states, ADVANCE, GIVE
        // GROUND and STRAFE, plus the frame RECOVER hands back to them. It can
        // therefore happen BEFORE a brace and AFTER a burst, and it can never
        // cancel a grenade already committed to, a burst already firing, a
        // brace already set, or a stagger. Those are authoritative action
        // beats, and a step that ate one would be animation soup: the body
        // would leave in the middle of a gesture the player is reading.
        const stepWhy = this._stepReasonFor(p, dist);
        if (stepWhy) {
          const dest = this._solveStep(p, stepWhy);
          if (dest) { this._beginStep(p, stepWhy, dest); break; }
          // REFUSED, AND THE COOLDOWN IS NOT SPENT. Geometry said no, so he
          // simply keeps doing what he was doing and may try again — a refused
          // step must not read as a pause.
          if (stepWhy === 'postburst') this._wantPostBurstStep = false;
        }
        // THE GRENADE OUTRANKS THE RIFLE WHEN IT IS AVAILABLE, and it is
        // available about once every nine seconds. Checked first for exactly
        // that reason: a tool on a long cooldown that loses every race to a
        // 1.9s weapon is a tool that never comes out.
        if (this._canThrow(p, dist)) {
          this._enter(CAP.WINDUP, this.def.grenade.windupMs);
          this.setVelocity(0, 0);
        } else if (this._canFire(p, dist)) {
          this._enter(CAP.BRACE, this.def.braceMs);
          this.setVelocity(0, 0);
          // ── TELEMETRY TAPS ────────────────────────────────────────────────
          // Three emits, and nothing in the game listens to any of them: the
          // Captain combat-economy instrument (`?captel=1`) needs to know
          // whether he gets to PERFORM HIS KIT before an aggressive player
          // removes him, and an external observer sampling `_cap` on
          // `postupdate` can miss a state that opens and closes inside one
          // frame. BEGUN is the BRACE — the commitment a player can see — so
          // "he started to shoot and died" and "he never tried" are different
          // rows. No value, cooldown or transition below is affected by them.
          this.scene.events.emit('champion-burst-begin', this);
        } else if (this._stateMs <= 0 || !t || left < 40) {
          this._solvePosition(p);
        }
        break;
      }
    }

    this._applyAnim();
    this._applyWeaponKick();
    this._applyFlicker();
    this._drawArmourBar();
  }

  /**
   * HE HAS THE LINE AGAIN.
   *
   * MEASURED BEFORE IT WAS BUILT, because §14's own instruction is not to
   * manufacture AI state for a flourish. In a real CROSSFIRE and a real
   * VANGUARD the Captain holds line of sight ~85% of frames and loses it about
   * twice per 22 seconds, for 0.5-3.4s at a time — and in 21-34 of those frames
   * he was READY TO FIRE AND COULD NOT. That is a genuine engagement
   * relationship being lost and regained, not an aim angle wobbling, so the
   * transition is real and worth a mark.
   *
   * Two gates keep it from becoming noise: a break shorter than
   * `acquireLostMs` is a doorway rather than a loss, and `acquireCooldownMs`
   * bounds the rate whatever the geometry does.
   */
  _tickAcquire(p, delta) {
    const los = this._hasLOS(this.x, this.y, p.x, p.y);
    if (!los) {
      this._losLostMs += delta;
      this._hadLos = false;
      return;
    }
    if (!this._hadLos) {
      const lost = this._losLostMs;
      this._hadLos = true;
      this._losLostMs = 0;
      if (lost >= this.def.acquireLostMs && this._acquireCd <= 0) {
        this._acquireCd = this.def.acquireCooldownMs;
        this._punctuate('glyph-alert', { scale: 0.8, rise: 0.6, dx: 14 });
        // The visor comes up with it — the glyph says he noticed, the body says
        // he is looking at you.
        this._flickerHold = 0;
        this._shotFlashMs = Math.max(this._shotFlashMs, 0);
        this.scene.events.emit('champion-reacquire', this);
      }
      return;
    }
    this._losLostMs = 0;
  }

  /**
   * ── THE BURST PLAN: ONE SNAPSHOT, ONE CORRIDOR, ONE DECISION ─────────────
   *
   * WHAT THIS REPLACES. B.2.2 solved an intercept PER ROUND — round 1 at the
   * player's current position, rounds 2 and 3 at two coefficients along a full
   * solution. It hit, and the handset called it robotic, aimbot, Terminator.
   * It was also exploitable in a way that is obvious once it is written down:
   * three point solutions leave the ground BETWEEN them uncovered, so a small
   * step and a stop parked the player in the gap between the establish shot and
   * the lead and beat the whole burst by standing in a hole in the pattern.
   *
   * WHAT THIS IS. At the commitment moment he reads the player ONCE: where they
   * are, and the movement they are currently committed to. From those two facts
   * he builds a CORRIDOR — an origin, a bearing, a length — draws a burst
   * length and a spray shape, picks a side bias, and rolls every round's
   * imperfection up front. Then he suppresses that corridor and does not look
   * again until the burst is over.
   *
   * THE FAIRNESS IS STRUCTURAL, NOT A COEFFICIENT. Nothing after this function
   * reads the player's position, velocity or heading, so reversing, dashing,
   * cutting into cover or simply changing your mind all beat it — and they beat
   * it by more the later in the burst they happen, which is the relationship
   * §26 asks for. Continuing loses. Standing still also loses: a route of zero
   * length is a point, so a stationary player produces a tight fan ACROSS his
   * own bearing instead of a corridor, which is a soldier shooting at somebody
   * who is not moving.
   *
   * AND EVERY ROUND IS STILL AN ORDINARY PROJECTILE. Fired at a fixed point,
   * never retargeted, never homed, never hitscan.
   */
  _planBurst(p) {
    const d = this.def;
    const c = d.corridor;
    const dist = Math.hypot(p.x - this.x, p.y - this.y);
    const v = p.body?.velocity;
    const vx = v?.x ?? 0, vy = v?.y ?? 0;
    const sp = Math.hypot(vx, vy);

    const rounds = this._drawBurstLength(dist);

    let ox = p.x, oy = p.y, dx, dy, len;
    // 40px/s is a drift, not a route — well under the player's 380 walk, so a
    // genuine slow reposition still reads as a direction and a twitch does not.
    const still = sp < 40;
    if (still) {
      // ACROSS HIS OWN BEARING, centred on them: a short band of suppressed
      // ground rather than a route. Standing still must not be safe.
      const b = Math.atan2(p.y - this.y, p.x - this.x) + Math.PI / 2;
      dx = Math.cos(b); dy = Math.sin(b);
      len = c.stillFanPx;
      ox = p.x - dx * len / 2; oy = p.y - dy * len / 2;
    } else {
      dx = vx / sp; dy = vy / sp;
      // ── THE ARRIVAL WINDOW ────────────────────────────────────────────
      // FROM THE MUZZLE, NOT THE BODY CENTRE — 75px of barrel is a real
      // fraction of a short engagement, and solving from the centre is the
      // 25% over-lead B.2.2 already had to fix once.
      const flight = Math.min(
        Math.max(40, dist - CAPTAIN_MUZZLE_PX) / d.bulletSpeed,
        d.leadHorizonMs / 1000);
      // How much longer the LAST round of this commitment will be in the air
      // than the first — the burst's own span, which is why a six-round
      // commitment suppresses a longer stretch than a three-round one.
      const span = (rounds - 1) * d.burstGapMs / 1000;
      const near = sp * flight * c.nearFrac;
      const far = Math.min(sp * (flight + span) * c.farPad, c.maxLead);
      len = Phaser.Math.Clamp(far - near, c.minLen, c.maxLen);
      ox = p.x + dx * near; oy = p.y + dy * near;
    }

    const pattern = this._pickWeighted(d.sprayWeights);
    // ONE SIDE OF THE CORRIDOR, CHOSEN ONCE AND HELD. This is what lets the eye
    // see him deliberately walking fire one way rather than scattering.
    const bias = (Math.random() < 0.5 ? -1 : 1) * Math.random() * c.biasMaxPx;
    // CONTROLLED IMPERFECTION, ROLLED UP FRONT. Per round, and growing with the
    // round index — the group opens as the burst runs, which is recoil and is
    // also why a six-round burst is not simply a better three-round one. Rolled
    // HERE rather than at each shot so the rifle can traverse toward a point
    // that will not move under it.
    const jit = [];
    for (let i = 0; i < rounds; i++) {
      jit.push((Math.random() * 2 - 1) * (c.jitterPx + c.climbPx * i));
    }
    this._plan = { ox, oy, dx, dy, len, rounds, pattern, bias, jit, still };
    this._planShot = 0;
    return this._plan;
  }

  /** Weighted pick from a `[[value, weight], ...]` table. */
  _pickWeighted(table) {
    let total = 0;
    for (const [, w] of table) total += w;
    let r = Math.random() * total;
    for (const [v, w] of table) { r -= w; if (r <= 0) return v; }
    return table[table.length - 1][0];
  }

  /**
   * HOW LONG THIS COMMITMENT IS, DRAWN ONCE.
   *
   * The authored distribution does the work; the context term is deliberately
   * MILD and only ever shifts the draw by one round. §19 allows a little
   * context and §20 forbids another system that computes the perfect answer —
   * the value here is the VARIATION, not the cleverness.
   */
  _drawBurstLength(dist) {
    const d = this.def;
    let n = this._pickWeighted(d.burstRoundWeights);
    if (dist < d.fireRange * d.burstCtxNearFrac) {
      // Close, exposed, a stable relationship: lean on him.
      if (Math.random() < 0.5) n += 1;
    } else if (Math.random() < 0.4) {
      // A long, marginal window: take the shorter commitment.
      n -= 1;
    }
    return Phaser.Math.Clamp(n, d.burstRounds, d.burstRoundMax);
  }

  /**
   * WHERE ALONG THE CORRIDOR ROUND `i` GOES — the spray shape.
   *
   * `t` is 0 at the origin (where the player was, or the near end of the fan)
   * and 1 at the far end, where the route leads. Chosen once per burst and
   * executed consistently: the player should be able to SEE which way he is
   * walking the fire.
   */
  _sprayT(i, n, pattern) {
    if (n <= 1) return 0.5;
    const u = i / (n - 1);
    switch (pattern) {
      case 'down': return 1 - u;
      case 'outward': {
        // Centre first, then alternating out to both ends — the shape that
        // covers the ground either side of where they were standing.
        const steps = Math.ceil((n - 1) / 2) || 1;
        const k = Math.ceil(i / 2) / steps;
        return Phaser.Math.Clamp(0.5 + (i % 2 === 1 ? 1 : -1) * 0.5 * k, 0, 1);
      }
      case 'sweepback':
        // Up the corridor, then part of the way back over ground he has
        // already covered. The one pattern that hits the same stretch twice.
        return u <= 0.6 ? u / 0.6 : 1 - ((u - 0.6) / 0.4) * 0.55;
      case 'up':
      default: return u;
    }
  }

  /**
   * THE AIM POINT FOR ONE ROUND OF THE COMMITTED PLAN.
   *
   * A pure function of the plan and the round index — it reads nothing live, so
   * calling it every frame to traverse the rifle and calling it on the firing
   * frame give the same answer. That is what stops the barrel drifting back
   * onto the player between rounds, which would be the tracking read the
   * corridor exists to remove.
   */
  _planPoint(i) {
    const pl = this._plan;
    if (!pl) return null;
    const k = Phaser.Math.Clamp(i, 0, pl.rounds - 1);
    const t = this._sprayT(k, pl.rounds, pl.pattern);
    const ax = pl.ox + pl.dx * pl.len * t;
    const ay = pl.oy + pl.dy * pl.len * t;
    // The side bias is perpendicular to the route and opens slightly as the
    // burst runs, along with the per-round imperfection already rolled.
    const nx = -pl.dy, ny = pl.dx;
    const off = pl.bias * (1 + k * 0.16) + (pl.jit[k] ?? 0);
    // NOT CLAMPED TO THE ARENA. An aim point is a BEARING, not a destination —
    // a round is an ordinary projectile and is perfectly entitled to fly into a
    // wall. Clamping bent the committed line whenever the route ran toward an
    // edge, which measured 142px off a corridor whose authored spread is 75,
    // and a corridor that bends is no longer one decision.
    return { x: ax + nx * off, y: ay + ny * off };
  }

  /**
   * THE BODY PERFORMS THE SHOT.
   *
   * The bolt leaves the MUZZLE, and so does the flash: both read
   * `CAPTAIN_MUZZLE_PX`, which is derived from the overlay's own dimensions, so
   * the effect and the projectile cannot leave from different places.
   */
  _fireRound(p) {
    // FROM THE PLAN, NEVER FROM THE PLAYER. `p` is still taken so a burst that
    // somehow reaches this with no plan degrades to shooting at them rather
    // than throwing; it is not consulted on any ordinary path.
    const aimAt = this._planPoint(this._planShot) || { x: p.x, y: p.y };
    this._planShot++;
    const ang = Math.atan2(aimAt.y - this.y, aimAt.x - this.x);
    this._aim = ang;
    const w = this.weaponSprite;
    const mx = (w?.x ?? this.x) + Math.cos(ang) * CAPTAIN_MUZZLE_PX;
    const my = (w?.y ?? this.y) + Math.sin(ang) * CAPTAIN_MUZZLE_PX;
    this.scene.fireCaptainBolt?.(this, mx, my, ang);
    this.scene.events.emit('champion-round-fired', this);
    this._shotFlashMs = 140;
    // ── THE RECOIL IS IN THE RIFLE, NOT IN THE MAN ────────────────────────
    // `recoilT` drives `Enemy.preUpdate`'s whole-body scale shrink, and setting
    // it here is what made the entire 112px figure pulse on every round — the
    // handset's "weapon makes the character hop". The kick is bigger than it
    // was and it lives entirely on the weapon overlay; the shoulders carry the
    // rest through the brace -> fire -> recoil -> settle frames.
    this._wKick = 23;
  }
  /**
   * THE ANIMATION IS THE STATE, AND THE STATE IS A COMBAT REASON.
   *
   * Nothing here reads velocity to decide what to play, which is the difference
   * between a body that is walking and a body that is being moved: the key
   * comes from what the Captain has DECIDED to do, and the facing comes from
   * where the fight is.
   */
  _applyAnim() {
    const pre = this._animPrefix;
    const { dir } = this._facingSuffix();
    let key;
    switch (this._cap) {
      case CAP.STAGGER: key = `${pre}-stagger-${dir}`; break;
      // THE POSE HOOKS, FINALLY USED. Frames 42-50 were painted in B.2 and
      // reserved for "a future signature action"; the Arc Grenade is it, and it
      // reaches for one with `raise` and comes over the top with `thrust`.
      case CAP.WINDUP:  key = `${pre}-raise-${dir}`; break;
      case CAP.THROW:   key = `${pre}-thrust-${dir}`; break;
      // THE PLANT IS THE BRACE BODY — weight set, knees loaded — and the
      // travel is the STRAFE cycle, which is the existing lateral gait and the
      // only one whose feet agree with sideways movement. Playing the forward
      // walk here would swing the legs against the direction of travel, which
      // is precisely the sliding read both rejected Champions died of.
      // THE PLANT IS THE BRACE BODY — weight set, knees loaded — the travel is
      // the STRAFE cycle (the existing lateral gait, and the only one whose
      // feet agree with sideways movement), and the CATCH is the new `land`
      // frame: widest stance on the sheet, torso down into the legs. Playing
      // the forward walk on the travel would swing the legs against the
      // direction of travel, which is the sliding read both rejected Champions
      // died of; ending on the strafe frame would be a 200px displacement that
      // simply stops, which is the floaty read this pass exists to remove.
      case CAP.STEP:
        key = this._stepPlantMs > 0 ? `${pre}-brace-${dir}`
          : this._stateMs <= this.def.step.catchMs ? `${pre}-land-${dir}`
            : `${pre}-strafe-${dir}`;
        break;
      case CAP.BRACE:   key = `${pre}-brace-${dir}`; break;
      case CAP.BURST:
        // ── THE FIRING RHYTHM (§27) ──────────────────────────────────────
        // FIRE -> RECOIL -> CORRECT, per round, and the CORRECT beat is why a
        // six-round burst is not one pose looped six times. Returning to the
        // full brace after every shot made a long burst read as a machine
        // cycling; `settle` is shoulders most of the way back but not all of
        // it, so the body is still carrying the last round when the next one
        // leaves. The muzzle flash is not the animation; the shoulder is.
        //
        // The very first frame of the commitment is still the brace — he has
        // not fired yet and must not already be recovering from something.
        key = this._shotFlashMs > 95 ? `${pre}-fire-${dir}`
          : this._shotFlashMs > 45 ? `${pre}-recoil-${dir}`
            : this._planShot === 0 ? `${pre}-brace-${dir}`
              : `${pre}-settle-${dir}`;
        break;
      case CAP.RECOVER: {
        // DAMPED, NOT ELASTIC (§15). Three stages rather than two: the recoil
        // is absorbed into the firing base, the base relaxes, and only then
        // does he breathe. A two-stage recoil -> idle snap is the overshoot-
        // and-bounce-back read; this one settles.
        const u = this._stateMs / Math.max(1, this.def.recoverMs);
        key = u > 0.6 ? `${pre}-recoil-${dir}`
          : u > 0.25 ? `${pre}-settle-${dir}` : `${pre}-idle-${dir}`;
        break;
      }
      case CAP.STRAFE: key = `${pre}-strafe-${dir}`; break;
      default:         key = `${pre}-walk-${dir}`; break;
    }
    // A state that has stopped moving must not keep playing a walk cycle —
    // feet stepping on the spot is the inverse of a body sliding without them.
    // The STEP is deliberately absent from this list: its plant beat is
    // stationary BY DESIGN and swapping it to an idle would delete the one
    // frame that says he set his feet.
    const still = this.body && (this.body.velocity.x ** 2 + this.body.velocity.y ** 2) < 260;
    if (still && (this._cap === CAP.STRAFE || this._cap === CAP.ADVANCE || this._cap === CAP.GIVE_GROUND)) {
      key = `${pre}-idle-${dir}`;
    }
    if (this.anims.currentAnim?.key !== key && this.scene.anims.exists(key)) this.play(key);
  }

  /**
   * WEAPON RECOIL, APPLIED AFTER THE OVERLAY HAS BEEN PLACED.
   *
   * `Enemy.preUpdate` rewrites the weapon's x/y from the aim every frame, so a
   * tween on those numbers is a second author that loses. The kick is a
   * displacement applied here instead, downstream of the placement, and it
   * decays on its own clock.
   */
  _applyWeaponKick() {
    const w = this.weaponSprite;
    if (!w) return;
    // THE BRACE IS A CARRY, NOT A POSE. The weapon is pulled IN toward the body
    // while he sets himself and rides back out as the burst runs, so the
    // preparation is visible on the WEAPON as well as on the shoulder — at 1x
    // the rifle is a bigger shape than the arm holding it.
    // THE RIFLE COMES DOWN FOR THE THROW. He cannot be holding it up and
    // throwing at the same time, and at 1x the rifle is a bigger shape than the
    // arm — so if it stays braced through the wind-up, the wind-up reads as a
    // brace with an odd pose rather than as a different action.
    const want = this._cap === CAP.BRACE ? -5
      : (this._cap === CAP.WINDUP || this._cap === CAP.THROW) ? -13 : 0;
    this._wSet += (want - this._wSet) * 0.35;
    const off = this._wKick - this._wSet;
    if (Math.abs(off) < 0.01) return;
    w.x -= Math.cos(this._aim) * off;
    w.y -= Math.sin(this._aim) * off;
  }

  /**
   * The armour layer's own bar, above the hp bar and in the identity colour.
   *
   * It is drawn only while the layer is intact: once it breaks, the read is the
   * BODY — the sheared pauldron and the dead visor — and a second empty bar
   * would say the armour is still a thing that exists.
   */
  _drawArmourBar() {
    const g = this._armourBar;
    if (!g) return;
    if (!this.alive || this.armourBroken || this.armour >= this.armourMax - 0.001) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.clear();
    const w = 48, h = 4;
    const bx = this.x - w / 2, by = this.y - this._headroom() - 16;
    g.setDepth(this.y + 1);
    g.fillStyle(0x000000, 0.7);
    g.fillRect(bx - 1, by - 1, w + 2, h + 2);
    g.fillStyle(0x10202c, 1);
    g.fillRect(bx, by, w, h);
    g.fillStyle(this.def.color, 1);
    g.fillRect(bx, by, w * (this.armour / this.armourMax), h);
  }

  /**
   * HIS DEATH TAKES HIS OWN FIELD WITH IT.
   *
   * The same contract the Barrier holds and for the same reason: a damaging
   * region that outlives the machine that drew it is worse than no hazard.
   * `ArcGrenade.destroy` is idempotent and `clearHazards` sweeps the same
   * object on a room change, so all three routes can fire in any order.
   */
  _dropGrenade() {
    this._nade?.destroy?.();
    this._nade = null;
  }

  /** A step must not outlive the actor as a standing velocity or a stuck state. */
  _endStep() {
    this._stepPlantMs = 0;
    this._stepCatchMs = 0;
    this._stepVx = 0;
    this._stepVy = 0;
    this._stepReason = null;
    if (this._cap === CAP.STEP) this._cap = CAP.ADVANCE;
    if (this.body) this.setVelocity(0, 0);
  }

  die(...args) {
    this._armourBar?.destroy();
    this._armourBar = null;
    this._clearReactions();
    this._clearPlan();
    this._dropGrenade();
    this._endStep();
    return super.die(...args);
  }

  destroy(...args) {
    this._armourBar?.destroy();
    this._armourBar = null;
    this._clearReactions();
    this._clearPlan();
    this._dropGrenade();
    this._endStep();
    return super.destroy(...args);
  }
}
