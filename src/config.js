// All gameplay tunables live here so we can iterate on feel quickly.

export const VIEW = {
  width: 720,
  height: 1280,
};

// Self-hosted sci-fi type pair (see public/fonts/, @font-face in index.html).
// `display` = titles/headers/banners (Orbitron: wide, geometric, iconic sci-fi
// display face). `body` = HUD numbers, labels, body copy (Rajdhani: condensed,
// techy, reads well small). Both fall back to the old Courier New mono if a
// font somehow fails to load.
export const FONTS = {
  display: "'Orbitron', 'Courier New', monospace",
  body:    "'Rajdhani', 'Courier New', monospace",
};

export const WORLD = {
  width: 1600,
  height: 1600,
  bg: 0x14161c,
  bgDark: 0x0c0c12,
  bgCol: 0x2e3038,
  wallColor: 0x1e2028,
};

// Draw-order bands.
//
// This game has TWO depth conventions running at once, and mixing them up is a
// recurring bug. Ground actors Y-sort — they write their own depth from their
// own world y every frame (Player/Enemy `setDepth(this.y)`), and walls/cover
// sort by their bottom edge at `y + 56`. In a 1600px arena that band occupies
// roughly 150-1656. Everything else in the game uses small flat constants
// (bullets 26, grenade 22, particles 0), which puts it permanently UNDERNEATH
// the entire Y-sorted layer. `bladeArc` and `ambientMotes` in FX.js were both
// bitten by this and carry comments about it.
//
// AIR is for things that are genuinely flying OVER the room and must clear all
// of it. Add the object's GROUND y (where its shadow is), never its rendered y
// — a sprite drawn at `gy - z` would otherwise change draw order as it climbs,
// which is the exact bug this is fixing.
export const DEPTH = {
  AIR: 2000,
};

/**
 * VADER'S PARRY VOCABULARY.
 *
 * Eight gesture families, indexed by the 45-degree sector of the bearing from
 * Vader to the bolt he is meeting: 0 = due east (to his right), then clockwise
 * on screen, so 2 = below him, 4 = to his left, 6 = above him.
 *
 * WHY THIS IS A TABLE AND NOT A FORMULA. The first implementation rotated the
 * blade onto the incoming bearing and pushed it out 30px. That is the smallest
 * physically sufficient motion, and on a handset it is invisible — Vader's
 * saber is ALREADY pointing at the player, and the player is where the bolt
 * came from, so the "parry" was a few degrees of nothing. The flash carried the
 * whole read. What is missing from a mathematically minimal parry is the part
 * that makes a parry look like a parry: the blade does not stop the bolt, it
 * SWEEPS THROUGH it and carries on. So each family names the arc the blade
 * whips through AFTER contact, and the arcs differ from each other in sign and
 * in size, so a shot taken high left does not animate like a shot taken low
 * right.
 *
 *   arcDeg  degrees swept from the intercept bearing during the follow-through.
 *           Sign is the handedness of the cut; magnitude is how big the gesture
 *           is. Lateral swats are the widest because a bolt crossing his body
 *           has the most blade to travel; low bats are the tightest because a
 *           downward cut has nowhere to go.
 *   reach   px the blade is thrust past its resting hold at the contact frame.
 *
 * Kept as data so the smoke test can iterate the registry rather than checking
 * four hand-picked bearings and forgetting the fifth — the specific mistake
 * documented in docs/POST-MORTEM-vader-moves.md.
 */
export const PARRY_ARCS = [
  { id: 'swat-right',      arcDeg: -140, reach: 54 },  // 0  E   bolt from his right
  { id: 'bat-low-right',   arcDeg: -104, reach: 42 },  // 1  SE
  { id: 'bat-low',         arcDeg:  118, reach: 40 },  // 2  S   from below
  { id: 'bat-low-left',    arcDeg:  104, reach: 42 },  // 3  SW
  { id: 'swat-left',       arcDeg:  140, reach: 54 },  // 4  W   from his left
  { id: 'guard-high-left', arcDeg:  158, reach: 48 },  // 5  NW
  { id: 'guard-high',      arcDeg: -166, reach: 46 },  // 6  N   from above
  { id: 'guard-high-right',arcDeg: -158, reach: 48 },  // 7  NE
];

/** Which family answers a bolt on this bearing (radians, Vader -> bolt). */
export function parryArcFor(angleRad) {
  const deg = ((angleRad * 180) / Math.PI) % 360;
  return PARRY_ARCS[((Math.round(deg / 45) % 8) + 8) % 8];
}

export const PLAYER = {
  hp: 1000,
  speed: 380,
  // Movement weight curve — px/s² ramps applied to body velocity each frame
  // so input doesn't snap to top speed (kills the "dragging picture" feel).
  accelPerSec: 4200,
  decelPerSec: 5000,
  dashChargesMax: 2,
  dashRechargeMs: 2800, // recharge sooner — dash is the core loop
  dashSpeed: 950,       // faster
  dashDurationMs: 240,  // longer
  radius: 22,
  ammoMax: 3,
  ammoReloadMs: 520, // buffed by 35% (was 800ms)
  fireCooldownMs: 120,
  // Primary: single red blaster bolt
  pelletCount: 1,
  pelletSpreadDeg: 0,
  pelletDamage: 120,
  pelletSpeed: 900,
  pelletRange: 400,
  pelletRadius: 6,
  // Super: wrist-rocket barrage
  superHitsToCharge: 4, // buffed (was 8)
  superPellets: 5,
  superSpreadDeg: 30,
  superDamage: 600,
  superSpeed: 1080, // fast shotgun-burst feel
  superRange: 620,
  superRadius: 12,
  superKnockback: 500,
  // ── Melee skill: "Broken Wings" — a 3-cast chain of lunging arc slashes.
  // Its own meter, independent of the ranged super, so both can be ready at
  // once. The meter is spent on the FIRST cast only; casts 2 and 3 are free
  // inside meleeComboWindowMs, so the three swings are one ability.
  meleeHitsToCharge: 3,     // cheaper than the ranged super (4)
  meleeComboWindowMs: 2000, // time to land the next cast before it resets
  // Casts 1-2 are real dashes: ~260px of travel, not the ~80px the first pass
  // shipped. Duration is what the gap-close solves for; speed is fixed.
  meleeLungeSpeed: 1450,
  meleeLungeMs: 180,        // 1450 * 0.180 = 261px
  meleeFinisherLungeSpeed: 1500,
  meleeFinisherLungeMs: 200, // 1500 * 0.200 = 300px
  // Gap-close: the dash shortens/extends to land at contact range on the
  // nearest enemy inside the aim cone, never travelling further than this.
  meleeGapCloseMax: 280,
  meleeGapCloseConeDeg: 100,
  meleeIframes: true,       // invulnerable while a lunge is travelling
  // Hold-to-aim. A press shorter than this fires instantly with no telegraph
  // (the "tap" path); holding past it arms the aim state and shows the cone.
  // Shorter than the super's 250ms Space threshold — melee wants to stay snappy.
  meleeAimArmMs: 130,
  meleeRange: 130,
  meleeArcDeg: 110,
  meleeDamage: 320,
  meleeFinisherDamage: 700,
  meleeKnockback: 260,
  // Finisher is a RADIAL ground slam, not a wider cone: full circle around the
  // landing point, hard outward launch, plus a stun long enough to be a real
  // reset window (the top-down stand-in for Riven's knockup).
  meleeSlamRadius: 210,
  meleeSlamKnockback: 900,
  meleeSlamStunMs: 600,
  // HP regen
  regenDelayMs: 4000,
  regenPerSec: 100,
  // Bush alpha
  bushAlpha: 0.5,
  // Combat shield generated by hacking terminals
  shieldHpMax: 400,
};

// Secondary weapons (picked up in rooms)
export const WEAPONS = {
  rifle: {
    id: 'rifle',
    name: 'DC-15 RIFLE',
    totalAmmo: 27,       // 9 bursts
    burstCount: 3,
    burstDelayMs: 75,    // ms between burst shots
    damage: 90,
    speed: 940,
    range: 500,
    fireCooldownMs: 300,
    // Pickup identity: distinct hue + outline shape so it reads at a glance.
    tex: 'pickup-rifle',
    color: 0xffb020,     // amber — clearly apart from the detonator's red
    outline: 'hex',
  },
  // Cluster canister — thrown like the old thermal detonator, but instead of a
  // flat blast it splits into homing micro-missiles. Replaces the detonator:
  // a deployed weapon that just dealt radius damage where it landed was the
  // most passive thing in the kit, and this turns it into active crowd control.
  cluster: {
    id: 'cluster',
    name: 'CLUSTER POD',
    charges: 3,
    throwSpeed: 380,     // slower: the canister is climbing, not skimming
    // Airburst. The canister CLIMBS for riseMs and bursts at the top — it never
    // comes back down. The old 64px fake arc split at ground level, which read
    // as the missiles being on the same plane as everything else instead of
    // raining in from above.
    riseMs: 1000,
    burstHeight: 300,    // px of fake altitude at the apex
    // ── Sub-munition flight ────────────────────────────────────────────────
    // Three phases, all with the physics body DISABLED until touchdown, so
    // something in the air can never hit a ground enemy.
    //
    // The missiles used to drop almost straight down from the burst and only
    // pick a target once they landed, which read as them deploying at ground
    // level. They now POP upward out of the canister first, fan out, and only
    // then nose over and cascade onto the pack.
    popMs: 320,          // phase A: climbing away from the burst
    popHeight: 260,      // extra altitude gained ABOVE the burst point
    fanRadius: 240,      // how far they fling outward during the pop
    // ── Phase B: the powered attack run ────────────────────────────────────
    // This used to be a tween: altitude fell on Quad.easeIn while the ground
    // position was LERPED from the apex to the target. That is a falling object
    // being slid along rails, and it read exactly like one — thrown knives, not
    // missiles. There is no such thing as a flight model in a position lerp.
    //
    // It is now integrated: each munition carries a 3D velocity, steers its
    // heading toward the target at a limited turn rate, and accelerates along
    // that heading under thrust. Momentum is what sells it — because the pop
    // flings it OUTWARD and the motor cannot turn it instantly, it has to swing
    // wide and curve back onto the target, which is the swooping attack run.
    //
    // There is deliberately no flight-duration tunable any more. The old
    // descentMs set the dive length directly, which is only meaningful for a
    // tween; the run now takes however long the physics takes (~1.0-1.8s from
    // this fan), and the booster SFX length is estimated from the range left to
    // cover rather than read from config.
    pitchOverMs: 150,    // motor-off beat at apex — the nose visibly swings over
    // The arc lives entirely in the relationship between these two. Exit speed
    // is the momentum the motor has to fight; turn rate is how fast it can. At
    // 150 / 6.5 the munition snapped onto the target heading inside two frames
    // and flew a straight line — a guided rocket, not a swoop. Turn radius is
    // v / turnRate, so 520 / 3.4 gives a ~150px arc against a 240px fan: it
    // visibly banks around before committing.
    fragExitSpeed: 400,  // outward speed carried out of the pop
    fragThrust: 2400,    // px/s^2 along the nose once the motor lights
    fragMaxSpeed: 980,  // terminal speed of the run
    fragTurnRate: 4.5,   // rad/s. Lower = wider, lazier arc; too low and it
                         // orbits its target instead of hitting it.
    fragGravity: 420,    // px/s^2, during the motor-off beat only
    fragMinSink: 40,     // px/s floor on the descent, so a munition that is
                         // still a long way out is always losing altitude
    fragMaxSink: 2200,   // px/s ceiling on the descent, so a fast final approach
                         // cannot yank the munition straight down
    fragMaxFlightMs: 1600, // hard stop, so a munition can never circle forever
    // Small. These are bomblets, not rockets. Held FLAT for the whole flight —
    // the old altitude scaling (1 + h * 0.5) made them balloon to 1.5x at apex
    // and taper on the way down, which read as the wrong size and the wrong
    // motion. Altitude is already legible from the shadow's size and alpha.
    fragScale: 0.55,
    // How close the munition has to land to its locked target to hurt it. The
    // dive tracks a moving enemy, so a miss means the target outran the fall or
    // died mid-air — the lock is strong, not guaranteed.
    impactRadius: 74,
    // Fragmentation. Each bomblet is meant to nearly kill a grunt on its own:
    // 290 against 320hp leaves a ~9% sliver, so one munition is a real threat
    // and any second source finishes the job. Elites (2.5x hp) and later
    // sectors still need two.
    //
    // Total is 8 x 290 = 2320, up from 5 x 130 = 650. That is a large increase,
    // and it is deliberate — a pod with 3 charges is now a genuine crowd-clear
    // rather than chip damage. Keep an eye on it against a full arena.
    fragments: 8,
    fragDamage: 290,
    // Lock acquisition radius, measured from the burst point. Targets are
    // assigned round-robin across DISTINCT enemies in this radius, so five
    // munitions over three enemies go 3 + 2 rather than all five onto whichever
    // one happens to be nearest.
    fragSearchRadius: 560,
    tex: 'pickup-cluster',
    color: 0xff2828,     // red — keeps the explosive-slot identity
    outline: 'diamond',
  },
};

export const ENEMY = {
  grunt: {
    hp: 320,
    speed: 230,
    radius: 22,
    desiredRange: 350,
    fireCooldownMs: 1200,
    // 620, not 360. At 360 a grunt bolt is SLOWER than the player walks
    // (PLAYER.speed 380) — it literally cannot catch you, which is why enemy
    // fire read as "an Atari game, dodging coming shapes". The old comment
    // said "slowed for dodging" and that was the whole problem: a projectile
    // you outwalk is scenery. ~1.6x walk speed threatens without being a
    // reaction test.
    bulletSpeed: 620,
    bulletDamage: 80,     // density compensation — many more grunts on screen now
    bulletRange: 480,
    color: 0xdcdce8,
    eyeColor: 0x20ee20,
  },
  shooter: {
    hp: 450,
    speed: 190,
    radius: 22,
    desiredRange: 380,
    fireCooldownMs: 800,
    bulletSpeed: 700,     // was 420 — see the grunt note above
    bulletDamage: 130,    // lowered (was 180) for swarms
    bulletRange: 560,
    color: 0x181820,
    eyeColor: 0x20d020,
  },
  // Bomber — sprints straight at the player and detonates on contact OR death.
  // Low HP (kill it early from range) but a heavy dodgeable blast. Pure dash
  // check: dashing i-frames negate the blast, so it feeds the core loop.
  bomber: {
    hp: 200,              // ~2 primary bolts — reward shooting it before it arrives
    speed: 300,           // faster than a grunt (230) so it actually pressures
    radius: 20,
    contactRange: 48,     // detonate when this close to the player
    blastRadius: 155,
    blastDamage: 240,     // ~24% of player HP; dash-dodgeable
    deathBlastScale: 0.8, // blast is slightly weaker when shot down vs contact
    color: 0xff5020,
    eyeColor: 0xffd020,
  },
  // Shielded trooper — a slow-turning frontal shield blocks non-piercing shots
  // from the front arc. Flank it (dash around) or break it with the super
  // (piercing). Tanky head-on, so it reshapes how you approach a pocket.
  shielded: {
    hp: 560,
    speed: 140,           // slow advance
    radius: 24,
    desiredRange: 260,    // holds closer than a shooter so the shield matters
    fireCooldownMs: 1500,
    bulletSpeed: 700,
    bulletDamage: 120,
    bulletRange: 520,
    shieldHalfArc: 1.35,  // rad — ~77° each side (~154° frontal cover)
    shieldTurnRate: 2.6,  // rad/s — slow enough that a dash beats the turn
    color: 0x8fa4c8,
    eyeColor: 0x40c0ff,
  },
  // Sniper — holds at long range and telegraphs a laser line before a fast,
  // heavy shot. The angle locks for the final moment, so a dash across the
  // beam dodges it. Punishes standing still; keeps you moving between packs.
  sniper: {
    hp: 260,              // glass cannon — flank and delete it
    speed: 150,
    radius: 22,
    desiredRange: 560,    // holds far
    retreatRange: 300,    // backs off when the player closes in
    windupMs: 800,        // telegraph time before the shot
    lockMs: 260,          // final window where the beam angle is frozen (dodge)
    fireCooldownMs: 1900,
    bulletSpeed: 1000,    // fast sniper round
    bulletDamage: 220,    // heavy — do not stand in the beam
    bulletRange: 900,
    color: 0xc060ff,      // violet
    eyeColor: 0xff40ff,
  },
  // Swarmling — tiny, very fast, near-zero HP. Spawns in packs and swipes in
  // melee. Pure super-fodder: a well-placed super or dash-through deletes a
  // whole cluster, which is exactly what makes those feel great.
  swarmling: {
    hp: 60,               // one primary bolt (120) kills
    speed: 310,           // fast, but the player (380) can make space with a dash
    radius: 13,           // small
    meleeRange: 40,
    meleeDamage: 42,
    meleeCooldownMs: 700,
    packMin: 4,
    packMax: 6,
    color: 0x70e838,      // acid green
    eyeColor: 0xd0ff40,
  },
};

export const BOSS = {
  // 60,000 — SET BY HAND, ON THE PHONE, and that is the point of this comment.
  //
  // History, because the mistakes are instructive:
  //   12,000 -> 10.6s. Phase 3 at 7s; two thirds of the fight never happened.
  //   62,000 -> 56-85s. In the 60-90s band, and too strong in the hand.
  //   46,000 -> measured at encounters 1 and 2 only and SHIPPED on that. With
  //             the old cap taper, #6 was FOUR MINUTES on the phone. Measuring
  //             two rungs of a six-rung ladder and extrapolating did that.
  //   300,000 -> the harness said every rung was 4-12s and wanted ~7x more hp.
  //             Shipped it. The verdict from the phone was immediate: "literally
  //             cannot be killed, cant even dent it". Reverted the same day.
  //
  // WHY THE HARNESS WAS WRONG, since the numbers themselves were not:
  //
  // The bot never dies. `lives = 9999`, and `step()` revives it in-frame the
  // moment it drops, precisely so a death cannot end a measurement early. It
  // also never misses, never repositions badly, never hesitates, and fires on
  // every frame the cooldown allows. Its dps is therefore an UNINTERRUPTED
  // ceiling, and dividing hp by that ceiling answers "how long to chew through
  // this pool while taking no consequences" — which is not the same question as
  // "how long is this fight". A real player spends time dead, disengaged, out of
  // ammo, and backing off. Sizing an hp pool off the ceiling multiplies the gap
  // between those two questions straight into the number.
  //
  // The harness is still right about RELATIVE things, which is all it was ever
  // claimed to be good for (see the top of tests/diag-encounter.mjs). Two of its
  // findings from this pass hold and are worth keeping:
  //
  //   - Output does NOT track dmgMult. Spam saturates at ~15,000-16,000 dmg/sec
  //     from encounter 2 on while dmgMult climbs 2.6 -> 14.5, because cadence,
  //     ammo and reload bind long before damage does. hp does not have to chase
  //     the upgrade curve.
  //   - Player dps grows ~1.9x (patient) to 2.2x (spam) across the six rungs,
  //     against an hp curve that grows 1.75x. The SHAPE is about right, so
  //     `bossHpStep` stays where it is.
  //
  // So: keep the shape, and set the base from play. 46,000 was the last number
  // anyone had actually played and it read as slightly short; +30% is the
  // adjustment that came back from the handset.
  //
  // THE RULE THIS COST: an absolute is a phone judgement. Every ABSOLUTE
  // judgement stays a phone playtest — that sentence was already at the top of
  // the harness file, and it was still overridden by a table of six numbers.
  hp: 60000,
  radius: 56,
  speed: 165,
  contactDamage: 300,
  phase2: 0.66,
  phase3: 0.33,
  chargeWindupMs: 700,
  chargeSpeed: 950,
  chargeDurationMs: 900,
  fanBulletSpeed: 380,
  fanBulletDamage: 180,
  fanBulletRange: 720,
  spawnCount: 3,

  // How close he gets before he stops walking and starts swinging.
  //
  // He had no arrival condition at all: IDLE drove him at the player every
  // frame, so on reaching them he tried to occupy their pixel and arcade
  // physics jittered him left and right across their body — reported as the
  // pathfinding breaking when you stand still. It was never pathfinding.
  // This is also the reach his SABER COMBO opens from, so arriving means
  // attacking rather than shoving.
  standoffPx: 108,
  // How often the close-range SABER COMBO comes round while he is at standoff.
  //
  // 1000, down from 3200. At 3200 the combo itself takes ~2.2s of its own beats
  // and then he stood there for a full second doing nothing — "when I stand
  // still Vader is just looking at me if it's not doing the abilities". A
  // second between combos is enough of a gap to trade hits or reposition into
  // and never enough for him to read as idle.
  comboEveryMs: 1000,

  // ── The charge's second beat ──────────────────────────────────────────
  // The rush no longer just runs past: wherever it stops — timeout, wall or
  // contact — he plants and brings the saber down. One attack that escalates,
  // rather than a charge and a separate dash-slam that would read as two very
  // similar rushes in the same pool.
  slamWindupMs: 520,
  slamRadius: 210,
  slamDamage: 300,
  slamKnockback: 700,
  slamRecoverMs: 900,
  // 1100, down from 1600. See the note on `_moveEvery` in GameScene: a scripted
  // move now locks out his state machine for its full duration, so his stock
  // attacks have to come round faster to fill the gaps between them.
  //
  // MEASURED, and the honest number is worth writing down. Four free-run
  // configurations, 75-79s each, nothing silenced:
  //
  //   moveEvery/cooldown   attacks/min   scripted moves   stock attacks
  //   8000 / 1600             12.9             6               11
  //   6000 / 1150             15.2             4               16
  //   4800 / 1350             12.7            10                6
  //   4800 / 1100             13.4            12                5   <- shipped
  //
  // The two systems block each other now, so this is zero-sum: the highest
  // total came from starving the new moves, which trades the content away to
  // buy back a number. The shipped config maximises the moves instead, and all
  // four appear evenly.
  //
  // The old build managed ~21/min, and that is NOT recoverable without undoing
  // the fix: it only reached it by letting attacks overlap, which is what made
  // them unreadable. Each move now occupies ~3.3s of anticipate/act/recover, so
  // 12 of them fill 40s of a 76s fight on their own. ~13-15/min is the ceiling
  // for attacks that arrive one at a time, and the leftover "idle" is mostly
  // the punish windows, which are the point.
  attackCooldownMs: 1100,
  color: 0x0a0a0e,
  eyeColor: 0xff2020,
};

// ── Music ──────────────────────────────────────────────────────────────────
//
// The drum kit as data. Every percussion voice used to carry its own hardcoded
// gain and its own scheduling loop inside startMusic(), which meant "what the
// kit plays" was spread across four `forEach`es and three magic numbers.
//
// A PATTERN is one string per instrument, 16 characters long — one character
// per sixteenth of a 4/4 bar:
//
//     '.' rest        'x' normal hit
//     'X' accent      'o' open (hi-hat only)
//
// A KIT is a set of numbered variations plus an `order` saying which variation
// each bar of the phrase uses. `order` is indexed by bar, NOT chosen at random:
// the ear should learn the pattern, and a random kit would make the smoke tests
// non-deterministic. An 8-entry order locks a variation to its bar of the
// 8-bar phrase; a 4-entry order cycles twice per phrase.
// A rest inside a melodic phrase. It still consumes its beats — the bar has to
// total 4 either way.
const R = (len) => ({ rest: true, len });

export const MUSIC = {
  // Tempo, as the quarter-note in SECONDS — lower is faster. Tiers name one of
  // these; FX ramps toward it by at most maxStepPerBar (a fraction) each bar,
  // so 0.46 -> 0.42 takes about five bars. It creeps rather than jumping,
  // which is the difference between rising tension and a tape-speed effect.
  tempo: { calm: 0.48, base: 0.46, hot: 0.42, maxStepPerBar: 0.02 },

  // Per-voice gain. These are the levels each voice used to hardcode; keeping
  // them here means a mix change is a config edit, not a hunt through
  // synthesis code.
  // Everything above the core three lives in 400Hz-8kHz on purpose. A handset
  // speaker has almost no output below ~400Hz, so the obvious "make it more
  // intense" instruments — floor toms, taiko — would be inaudible on the
  // device this game is actually played on. The kick's 165->48Hz sweep stays
  // the only sub-register element in the bed.
  layerGain: {
    kick: 0.30,
    snare: 0.16,
    hat: 0.05,
    rimshot: 0.13,
    ride: 0.075,   // careful: the tail overlaps itself at anything above eighths
    shaker: 0.28,
    tamb: 0.045,
    roll: 0.07,
    crash: 0.14,
    timpani: 0.18,
  },

  // Keeping perceived loudness flat as layers stack. The master compressor is
  // -10dB at 12:1 and already pumps on dense material, so adding voices at
  // fixed gain makes the BUSY tier quieter and more squashed, not bigger.
  //
  //   layerScaleExp  extra layers scale by L^-exp. At 0.5 that is equal-power
  //                  summing: three layers at 1/sqrt(3) sum to about the level
  //                  of one, so density changes texture rather than volume.
  //   coreTrim*      melody, pad, kick and snare step back as layers arrive.
  //                  This is what actually buys the headroom — the busy tier
  //                  gets its energy from the midrange while the core makes
  //                  room, so the mix opens up instead of squashing.
  //   coreTrim*      applies to the KICK AND SNARE only, not the whole core.
  //                  Trimming the hi-hat too was measurably self-defeating:
  //                  the hat is the core's high-band content, so pulling it
  //                  down cancelled exactly the brightness the extra layers
  //                  were adding, and the hot tier measured 0.99x the plain
  //                  march in the band a phone can reproduce. The kick is
  //                  where the headroom actually is.
  budget: { layerScaleExp: 0.5, coreTrimPerLayer: 0.06, coreTrimFloor: 0.72 },

  // TIERS. A tier is a complete description of how the bed sounds: which kit
  // it plays, whether the melody sounds at all, and how far open the pad sits.
  //
  // `padSpan` scales the filter sweep the pad's lowpass makes as heat rises
  // (420Hz + 900 * padSpan * heat). It is what lets a heavy tier be dark but
  // present instead of merely bright — escalation in this game must not read
  // as "brighter and rising", which is the whistle the audio notes warn about.
  //
  // `melody: false` is the swell setup, not an accident: the march dropping to
  // a pad and a heartbeat between waves is what gives its return at the next
  // wave something to land against.
  tiers: {
    calm:   { kit: 'heartbeat', phrase: 'main', tempo: 'calm', melody: false, padSpan: 0.15 },
    combat: { kit: 'march',     phrase: 'main', tempo: 'base', melody: true,  padSpan: 0.55 },
    hot:    { kit: 'drive',     phrase: 'main', tempo: 'hot',  melody: true,  padSpan: 1.00 },
    // The mini-boss gets the march's B section as a 4-bar loop rather than a
    // different arrangement of the same eight bars — a capstone elite should
    // be recognisably its own music, not the wave music with heavier drums.
    miniboss: { kit: 'halftime', phrase: 'climb', tempo: 'base', melody: true,
                padSpan: 0.80, halfTime: true },
    // Boss tiers. `halfTime` makes the KIT read at eighth-note resolution
    // instead of sixteenth, so the drums play at half speed with the backbeat
    // on 3 while the melody stays exactly where it was. Same tune, same tempo,
    // twice the space — the difference between heavier and merely busier.
    // The pad sits darker than `hot` on purpose: a boss should not be the
    // brightest thing in the game.
    // Vader. The theme itself escalates with his phases, not just the kit:
    // phase 1 states it in unison, phases 2 and 3 open it into octaves. Each
    // transition then changes something you could hum, rather than only what
    // is happening behind it.
    boss1: { kit: 'halftime',     phrase: 'main', tempo: 'base', melody: true, padSpan: 0.80, halfTime: true },
    boss2: { kit: 'halftime2',    phrase: 'main', tempo: 'base', melody: true, padSpan: 0.90, halfTime: true, octaves: true },
    boss3: { kit: 'halftimeRoll', phrase: 'main', tempo: 'hot',  melody: true, padSpan: 1.00, halfTime: true, octaves: true },
  },

  // How the director turns the situation into a 0-1 heat, and heat into a tier.
  heat: {
    // Weights sum to 1. Every term is clamped 0-1 before weighting.
    weights: { combo: 0.30, pressure: 0.30, lateWave: 0.15, danger: 0.25 },
    comboCap: 6,          // kills in the window that saturate the streak term
    comboStaleMs: 2000,   // matches _tickKillCombo's own window
    comboFadeMs: 1200,    // ...then the term bleeds out over this
    // Danger ramps in from 45% HP and saturates at 30% — the threshold the HUD
    // already uses for its low-HP vignette. A hard step exactly at 0.30 would
    // chatter every time a shield absorbs a hit.
    dangerFrom: 0.45,
    dangerTo: 0.30,
    // Slew limits, in heat units per second. Rises fast, falls slowly, so a
    // lull does not immediately drop the music out from under the player.
    // Slew-limited rather than exponential: an exponential approach never
    // actually arrives, which would make the tier threshold depend on how long
    // you had been in a state rather than on the state itself.
    attackPerSec: 1.8,
    releasePerSec: 0.45,
    sampleMs: 250,
    // Hysteresis, not one threshold: heat hovering on a single boundary would
    // flip the kit back and forth every couple of bars, which is far more
    // noticeable than either tier on its own.
    hotEnter: 0.62,
    hotExit: 0.50,
  },


  // ── Melodic phrases ──────────────────────────────────────────────────────
  //
  // A phrase is an array of BARS; a bar is an array of notes, each `{ f, len,
  // accent }` in beats, or `R(len)` for a rest that still consumes its time.
  // A tier names the phrase it plays, the same way it names its kit.
  //
  // BEAT is the quarter-note unit and `len` is in beats. Notes are articulated
  // (`hold` < len) so they detach instead of running together, and the dotted
  // 0.75/0.25 pairs are the march's signature rhythm — flatten those to equal
  // quarters and the whole thing turns back into elevator music.
  //
  // Every bar must total exactly 4 beats. The drum grid is written against a
  // fixed bar, so a mistyped `len` would drift the kit out of phase with the
  // melody; startBar warns rather than letting that pass.
  phrases: {
    // The full march, in A minor. Bars 1-4 are the theme — statement, answer,
    // the same shape lifted to the fifth, then the cadence home. Bars 5-8 are
    // the answering phrase that climbs an octave, walks down chromatically and
    // lands on E, the dominant, so bar 8 leads back into bar 1 instead of just
    // stopping. That is what makes 32 beats loop instead of merely repeating.
    //
    // What was here originally was bars 1-2 ONLY, on repeat: a third of one
    // sentence, restarting before it ever resolved.
    main: [

      // ── A section ──────────────────────────────────────────────────────────
      [ // 1  A A A | F. C
        { f: 110,    len: 1,    accent: 1    },
        { f: 110,    len: 1,    accent: 0.9  },
        { f: 110,    len: 1,    accent: 0.9  },
        { f: 87.31,  len: 0.75, accent: 1    },
        { f: 130.81, len: 0.25, accent: 0.7  },
      ],
      [ // 2  A | F. C | A (half)
        { f: 110,    len: 1,    accent: 1    },
        { f: 87.31,  len: 0.75, accent: 0.95 },
        { f: 130.81, len: 0.25, accent: 0.7  },
        { f: 110,    len: 2,    accent: 1    },
      ],
      [ // 3  E E E | F. C   — the same figure a fifth up
        { f: 164.81, len: 1,    accent: 1    },
        { f: 164.81, len: 1,    accent: 0.9  },
        { f: 164.81, len: 1,    accent: 0.9  },
        { f: 174.61, len: 0.75, accent: 1    },
        { f: 130.81, len: 0.25, accent: 0.7  },
      ],
      [ // 4  G# | F. C | A (half)  — cadence home
        { f: 103.83, len: 1,    accent: 0.95 },
        { f: 174.61, len: 0.75, accent: 1    },
        { f: 130.81, len: 0.25, accent: 0.7  },
        { f: 110,    len: 2,    accent: 1    },
      ],
    // ── B section ──────────────────────────────────────────────────────────
      [ // 5  A(8va) | A. A | A(8va) | G#. G
        { f: 220,    len: 1,    accent: 1    },
        { f: 110,    len: 0.75, accent: 0.8  },
        { f: 110,    len: 0.25, accent: 0.7  },
        { f: 220,    len: 1,    accent: 1    },
        { f: 207.65, len: 0.75, accent: 0.9  },
        { f: 196.00, len: 0.25, accent: 0.8  },
      ],
      [ // 6  F# F F# — | Bb | Eb | D. C#   — the chromatic walk down
        { f: 185.00, len: 0.25, accent: 0.85 },
        { f: 174.61, len: 0.25, accent: 0.8  },
        { f: 185.00, len: 0.5,  accent: 0.9  },
        R(0.5),
        { f: 116.54, len: 0.5,  accent: 0.75 },
        { f: 155.56, len: 1,    accent: 0.95 },
        { f: 146.83, len: 0.75, accent: 0.9  },
        { f: 138.59, len: 0.25, accent: 0.8  },
      ],
      [ // 7  C B C — | F | G# | F. G#   — same shape, dropped to the low register
        { f: 130.81, len: 0.25, accent: 0.85 },
        { f: 123.47, len: 0.25, accent: 0.8  },
        { f: 130.81, len: 0.5,  accent: 0.9  },
        R(0.5),
        { f: 87.31,  len: 0.5,  accent: 0.75 },
        { f: 103.83, len: 1,    accent: 0.95 },
        { f: 87.31,  len: 0.75, accent: 0.9  },
        { f: 103.83, len: 0.25, accent: 0.8  },
      ],
      [ // 8  C | A. C | E (half)  — lands on the dominant, turns back into bar 1
        { f: 130.81, len: 1,    accent: 0.95 },
        { f: 110,    len: 0.75, accent: 0.9  },
        { f: 130.81, len: 0.25, accent: 0.8  },
        { f: 164.81, len: 2,    accent: 1    },
      ],
    ],

    // The B section on its own — bars 5-8 above, as a four-bar loop. The
    // mini-boss theme.
    //
    // It works standalone for the same reason it closes the full phrase: it
    // ends on E, the dominant, so it turns back into its own first bar. And it
    // is the tensest music in the piece — a chromatic descent over a rising
    // octave leap — which is exactly what a capstone elite wants and what the
    // theme itself, being a statement rather than a build, is not.
    climb: [
      [ // 5  A(8va) | A. A | A(8va) | G#. G
        { f: 220,    len: 1,    accent: 1    },
        { f: 110,    len: 0.75, accent: 0.8  },
        { f: 110,    len: 0.25, accent: 0.7  },
        { f: 220,    len: 1,    accent: 1    },
        { f: 207.65, len: 0.75, accent: 0.9  },
        { f: 196.00, len: 0.25, accent: 0.8  },
      ],
      [ // 6  F# F F# — | Bb | Eb | D. C#   — the chromatic walk down
        { f: 185.00, len: 0.25, accent: 0.85 },
        { f: 174.61, len: 0.25, accent: 0.8  },
        { f: 185.00, len: 0.5,  accent: 0.9  },
        R(0.5),
        { f: 116.54, len: 0.5,  accent: 0.75 },
        { f: 155.56, len: 1,    accent: 0.95 },
        { f: 146.83, len: 0.75, accent: 0.9  },
        { f: 138.59, len: 0.25, accent: 0.8  },
      ],
      [ // 7  C B C — | F | G# | F. G#   — same shape, dropped to the low register
        { f: 130.81, len: 0.25, accent: 0.85 },
        { f: 123.47, len: 0.25, accent: 0.8  },
        { f: 130.81, len: 0.5,  accent: 0.9  },
        R(0.5),
        { f: 87.31,  len: 0.5,  accent: 0.75 },
        { f: 103.83, len: 1,    accent: 0.95 },
        { f: 87.31,  len: 0.75, accent: 0.9  },
        { f: 103.83, len: 0.25, accent: 0.8  },
      ],
      [ // 8  C | A. C | E (half)  — lands on the dominant, turns back into bar 1
        { f: 130.81, len: 1,    accent: 0.95 },
        { f: 110,    len: 0.75, accent: 0.9  },
        { f: 130.81, len: 0.25, accent: 0.8  },
        { f: 164.81, len: 2,    accent: 1    },
      ],
    ],
  },

  kits: {
    // Calm. Pad plus a heartbeat kick, no melody, no backbeat. Variation 1
    // adds a single pickup so four bars of it do not sit completely still.
    heartbeat: {
      order: [0, 0, 0, 1],
      vars: [
        { kick: 'x.......x.......', snare: '................', hat: '................' },
        { kick: 'x.......x...x...', snare: '................', hat: '................' },
      ],
    },

    // The march kit. Kick on 1 and 3, backbeat on 2 and 4, eighth-note hats
    // opening on the offbeats. Variation 1 is the phrase-end fill — it lands
    // on bars 4 and 8, which is what separates the theme from its answer.
    // Ordinary combat. Five variations rather than two, because this is the
    // tier that plays for most of the game and two patterns on repeat is what
    // it sounds like. Deliberately DRUMS ONLY — the shaker and ride belong to
    // `drive`, and if they leaked in here the step up to `hot` would stop
    // reading as escalation.
    //
    // The order alternates the plain bar with a variation and keeps the fill
    // on bars 4 and 8, so the kit still marks the melody's two four-bar halves.
    march: {
      order: [0, 1, 0, 4, 0, 2, 3, 4],
      vars: [
        // 0 — the plain bar
        { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.' },
        // 1 — a late kick push into the bar line
        { kick: 'x.......x.....x.', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.' },
        // 2 — ghost snare on the & of 2
        { kick: 'x.......x.......', snare: '....x..x....x...', hat: 'x.o.x.o.x.o.x.o.' },
        // 3 — driving kick, doubled open hat
        { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.o.x.oox.o.x.o.' },
        // 4 — phrase-end fill
        { kick: 'x.......x.......', snare: '....x.......x.xx', hat: 'x.o.x.o.x.o.x.oo',
          rimshot: '............x...' },
      ],
    },

    // Under pressure. The sixteenths come from a SHAKER rather than more
    // hi-hat: a soft-attack voice adds motion without sixteen more transients
    // for the compressor to chew on, which is what a wall of sixteenth hats is.
    //
    // The escalation is deliberately almost all MIDRANGE. The obvious way to
    // write this kit is a driving four-to-the-floor kick, and the first
    // version did — but the kick's energy is at 165->48Hz, which a handset
    // speaker barely reproduces, so on the device this game is played on that
    // version measured DARKER than the plain march while being busier. Only
    // variation 1 pushes the kick at all; everything else that makes this tier
    // feel hotter lives where a phone can actually deliver it.
    // Boss. Read at EIGHTH resolution, so only the first 8 characters of each
    // row fall inside the bar — content past index 7 would be silently
    // truncated, which startBar warns about rather than swallowing.
    halftime: {
      order: [0, 0, 0, 1],
      vars: [
        { kick: 'x...............', snare: '....x...........', ride: 'x.x.x.x.........' },
        { kick: 'x.....x.........', snare: '....x..x........', ride: 'x.x.x.xx........' },
      ],
    },
    // Vader phase 2: the tambourine picks out the offbeats, so the same
    // half-time frame gains motion without gaining weight.
    halftime2: {
      order: [0, 1, 0, 2],
      vars: [
        { kick: 'x...............', snare: '....x...........', ride: 'x.x.x.x.........',
          tamb: '.x.x.x.x........' },
        { kick: 'x.....x.........', snare: '....x...........', ride: 'x.x.x.x.........',
          tamb: '.x.x.x.x........' },
        { kick: 'x...............', snare: '....x..x........', ride: 'x.x.x.xx........',
          tamb: '.x.x.x.x........', rimshot: '......x.........' },
      ],
    },
    // Vader phase 3. `R` starts a snare roll that swells to the end of the bar
    // — the classic march device, and the only rising thing in this bed. The
    // rule it does not break is about SPECTRUM: the roll's filter still falls
    // as it grows, so it darkens while it crescendos.
    halftimeRoll: {
      order: [0, 0, 1, 2],
      vars: [
        { kick: 'x...............', snare: '....x...........', ride: 'x.x.x.x.........',
          tamb: '.x.x.x.x........' },
        { kick: 'x.....x.........', snare: '....x..x........', ride: 'x.x.x.xx........',
          tamb: '.x.x.x.x........', rimshot: '......x.........' },
        { kick: 'x...............', snare: '....x...........', ride: 'x.x.x.x.........',
          tamb: '.x.x.x.x........', roll: '......R.........' },
      ],
    },

    drive: {
      order: [0, 1, 0, 2, 0, 1, 0, 3],
      vars: [
        { kick: 'x.......x.......', snare: '....x.......x...',
          hat: 'x.o.x.o.x.o.x.o.', shaker: '.x.x.x.x.x.x.x.x' },
        { kick: 'x.....x.x.......', snare: '....x.......x...',
          hat: 'x.o.x.o.x.o.x.o.', shaker: '.x.x.x.x.x.x.x.x', ride: 'x...x...x...x...',
          rimshot: '...............x' },
        { kick: 'x.......x.......', snare: '....x.......x..x',
          hat: 'x.oxx.o.x.oxx.o.', shaker: '.x.x.x.x.x.x.x.x' },
        { kick: 'x.......x.......', snare: '....x.......x.xx',
          hat: 'x.o.x.o.x.o.x.oo', shaker: '.x.x.x.x.x.x.x.x', ride: 'x...x...x...x..x',
          rimshot: '........x...x.x.' },
      ],
    },
  },
};

// Bacta vial healing pickup
export const HEALTH_ORB = {
  dropChance: 0.22, // raised for horde density — more kills, more sustain
  healAmount: 120,
  radius: 14,
  color: 0x1898e8,
  lifeMs: 8000,
};

export const HUDCFG = {
  joystickRadius: 90,
  joystickKnobRadius: 42,
  joystickMargin: 36,
  joystickBottom: 36,
  // Height of the HUD top bar. The game camera is inset by this much so the
  // world never renders behind the (opaque) bar — shared by the HUD bar fill
  // and the GameScene camera viewport so the two can't drift apart.
  topBarHeight: 84,
};

export const COLORS = {
  player:        0x6a7080,
  playerOutline: 0x0a0c14,
  bullet:        0xff2828,
  bulletSuper:   0xffffff,
  enemyBullet:   0x10ee10,
  hpBack:        0x0a0e18,
  hpFront:       0x1898e8,
  hpLow:         0xee1010,
  ammoOn:        0xff2828,
  ammoOff:       0x1a1c22,
  superGauge:    0xee1010,
  superReady:    0xff5040,
  textShadow:    0x000000,
};

// Room modifiers — a single named condition that reshapes a whole room. A
// room opts in via its ARENA entry's `modifier` key; the modifier is announced
// on entry and shown as a persistent HUD label for the duration. Effect fields:
//   speedMult     — multiply every enemy's move speed (applied at spawn)
//   spawnRateMult — multiply the drip interval (<1 = faster spawns)
//   eliteChance   — floor for the elite-upgrade roll (max with the wave's own)
//   darkness      — dim the screen to a bright sight-radius around the player
// ── SCORE ──────────────────────────────────────────────────────────────────
// The run's score. Every other reward system planned on top of this one — rank,
// medals, risk contracts, credits — pays out in these points, so this table is
// the balance surface for all of them.
//
// Points are THREAT-weighted, not HP-weighted. A sniper has less health than a
// shooter but is worth more, because closing on it and deleting it is the
// skilled play; a swarmling dies to one bolt and is worth almost nothing so
// that farming the easy spawns is never the high-scoring line.
//
// The multiplier keys off the CHAIN-KILL streak (GameScene._comboCount, kills
// within comboWindowMs of each other), NOT off Player.accuracyMult. Those are
// two different systems that were both called "combo": accuracyMult is a hit
// streak that resets on a miss and speeds up meter charge, while the chain is
// about killing fast and is what the on-screen "x3!" already celebrates.
// Scoring the chain makes aggression the scoring line and gives that 2-second
// window real stakes.
export const SCORE = {
  points: {
    grunt: 100, shooter: 180, bomber: 150,
    shielded: 260, sniper: 300, swarmling: 40,
  },
  eliteMult: 3,          // an elite is worth 3x its base
  miniBoss: 2500,
  boss: 25000,

  chainStep: 0.25,       // +25% per chain kill beyond the first
  chainMax: 5.0,         // caps at x5 — a long chain is worth chasing, not infinite

  terminal: 750,         // slicing a terminal, which also buys you a surge
  waveClear: 500,
  waveFlawless: 1000,    // no damage taken for the whole wave
  waveSpeed: 1500,       // full value at waveSpeedSecs, decaying to 0 at 2x that
  waveSpeedSecs: 45,
  roomClear: 2500,

};

// ── ENDLESS ────────────────────────────────────────────────────────────────
// Endless is the run structure now, so it needs an ARC and not just a ramp.
// Vader existed only at the end of the campaign, which meant the best encounter
// in the game was unreachable in the mode people actually play, and the
// boss1/boss2/boss3 music tiers were heard once and never again.
//
// A boss every 5 sectors gives the climb a shape: four arena sectors building
// pressure, then a fight that resolves it. That cadence is also what makes a
// run tellable — "I died on the third Vader" says more than "I died on 14".
export const ENDLESS = {
  bossEvery: 5,
  // Each Vader is tougher than the last. Compounding would make boss 4
  // impossible while boss 2 was trivial, so this is linear in the boss number.
  // Cut 0.3 -> 0.15 after encounter 6 measured FOUR MINUTES on the phone.
  //
  // The mistake behind 0.3 was measuring encounters 1 and 2, finding them in
  // band, and extrapolating. #6 was 115,000 hp; at 0.15 it is 80,500. The
  // per-encounter damage-cap taper was removed at the same time — the two were
  // compounding, and the cap was the larger half of the problem.
  //
  // The measured table for all six lives beside BOSS.hp. Do not tune this from
  // #1 and #2 again.
  // Unchanged at 0.15. The harness measured player dps growing 1.9-2.2x across
  // the six encounters against this curve's 1.75x, so the SHAPE is close; it was
  // only ever the base that was wrong. See the note above BOSS.hp.
  bossHpStep: 0.15,    // boss n has hp x (1 + 0.15*(n-1))
  bossScoreStep: 0.5,  // and is worth proportionally more

  // Vader is a RECURRING NEMESIS, not a kill. Driving him to zero wounds him
  // and he withdraws; he returns at the next boss sector with more health and
  // one more mechanic. That is the difference between "I beat the boss" and "he
  // is still out there", and it is what stops the tenth boss sector being the
  // fifth one again.
  //
  // It also fixes a real balance hole: the player's burst is far higher than the
  // fight was tuned for. Super is 5 x 600 and melee chains 320/320/700, so a
  // committed spam of both deletes 12,000 hp fast enough that phases 2 and 3
  // barely happen. His base pool and his per-encounter step are both raised, and
  // the intake cap below is what stops a single piercing super skipping a phase.
  // NO DAMAGE CAP. `bossDamageCap` is gone, not set to a big number.
  //
  // It was 1600 per 120ms, tapering to 960 by encounter 6, and it was the single
  // worst number in this file. A 5-pellet super lands inside ONE window, so a
  // 3000-damage volley registered as 960 — the player's biggest commitment,
  // silently three-quarters discarded — and encounter 6 took four minutes.
  //
  // A cap does not make a fight interesting. It makes your strongest move feel
  // like it missed while the damage number lies to you about it. Fight length is
  // hp's job. If something dies too fast, give it more hp.

  // The mechanic REGISTRY. Which encounter each one arrives at is `bossLadder`
  // below — this list is only the definitions, and its order carries no meaning
  // any more. Each is drawn from behaviour the Boss or the scene already has, so
  // "weirder every time" does not mean a new boss written from scratch every
  // five sectors.
  //
  // `hunt` (x1.18 speed) and `unbound` (x1.2 speed) used to sit in this list.
  // Both were deleted rather than retuned: a speed multiplier is not a mechanic,
  // it is the same fight with the numbers moved, and two of five entries being
  // one is what made the ladder escalate as "harder" instead of "weirder".
  //
  // Every replacement changes what the PLAYER has to do, and each is built from
  // something that already exists — darkness from the DARKNESS modifier, the
  // pickup from the weapon-choice drop, the clones from the enemy pool.
  //
  // Rule-breaking is held to BRIEF, SURPRISING and RECOVERABLE. The stance lasts
  // 2.4s and is telegraphed first; a disarm puts the weapon on the floor with
  // its ammo intact. Neither takes anything away for longer than it takes to
  // react — a lockout is not a surprise, it is a punishment.
  bossMechanics: [
    { id: 'guard',       name: 'ELITE GUARD',    desc: 'he no longer comes alone' },
    { id: 'sunder',      name: 'SUNDERING SLAM', desc: 'the floor answers him' },
    { id: 'reflect',     name: 'DEFLECTION',     desc: 'the saber sends it back' },
    { id: 'blackout',    name: 'LIGHTS OUT',     desc: 'he fights better blind' },
    { id: 'afterimages', name: 'AFTERIMAGES',    desc: 'which one is he?' },
    { id: 'disarm',      name: 'DISARM',         desc: 'he takes it from your hands' },
    { id: 'legion',      name: 'LEGION',         desc: 'the room fills as he falls' },
    // Not a new attack — a COMPOSITION RULE over two he already has. From here
    // the clones never arrive in the light: `boss-afterimages` also triggers the
    // blackout, so "which one is he" and "you cannot see" become one question
    // instead of two that occasionally coincided by clock luck.
    { id: 'eclipse',     name: 'THE DARK',       desc: 'they come with the lights' },
  ],

  // ── THE LADDER: what each Vader ARRIVES WITH ────────────────────────────
  //
  // This used to be `bossMechanics.slice(0, n)` — one mechanic per encounter,
  // in registry order. The consequence, which nobody had written down until the
  // progression audit: **encounter 1 Vader had exactly one mechanic and it fired
  // ONCE**, three grunts at t=900ms, and then for the rest of the fight nothing
  // recurred and nothing changed state. His whole first appearance was three
  // rotating scripted moves on a 4.8s clock plus charge/slam/spawn — the same
  // three questions over and over, which is precisely the "attack A -> reset ->
  // attack B -> reset" the handset review named.
  //
  // The two mechanics that made the third fight feel different were both
  // recurring and both changed what the player had to DO: SUNDERING SLAM makes
  // standing next to him cost something on a 5.2s metronome (it is the single
  // biggest filler of dead air in the fight), and DEFLECTION is the ONLY
  // mechanic in the whole ladder that changes the player's verb — shoot, or
  // close, or move. "Vader-3 brain, Vader-1 numbers" is exactly those two,
  // pulled forward onto the hp and damage of the first.
  //
  // So the first Vader is now COMPLETE Vader: the full scripted move pool (which
  // he always had — see `bossMovesFor`), the reactive VANISH (which he always
  // had), his escort, the floor, and the guard. Later Vader is not the first one
  // with more health; it is the first one plus rules that keep arriving.
  //
  // Entries are what encounter n ADDS. Encounter n carries the union of rows
  // 1..n, so this stays cumulative and a player still learns the ladder in a
  // fixed order. Past the last row he keeps everything (a run can reach sector
  // 60+); nothing new arrives, which is honest — the escalation past here is the
  // hp curve and the cadence table below.
  bossLadder: [
    ['guard', 'sunder', 'reflect'],   // 1 — COMPLETE VADER
    ['blackout'],                     // 2 — the room stops being reliable
    ['afterimages'],                  // 3 — the TARGET stops being reliable
    ['disarm'],                       // 4 — your loadout stops being reliable
    ['legion'],                       // 5 — every phase break costs you the room
    ['eclipse'],                      // 6 — and now they come together
  ],

  // How hard each rung's mechanic CLOCKS run, as a multiplier on the intervals
  // in `bossMech`. Lower is more often.
  //
  // This is the pressure axis, and it is deliberately small: ~18% by encounter 6.
  // A late Vader is running five or six independent clocks at once, and past a
  // point tightening them stops adding decisions and starts overlapping
  // telegraphs — which is how a fight becomes unreadable rather than hard. The
  // escalation that matters is the ROWS above; this is the seasoning.
  //
  // `reflect` is deliberately EXEMPT. Its 9s cadence is part of the frozen
  // DEFLECTION contract, and at 0.82 it would be a 2.4s stance every 7.4s — 32%
  // of the fight with ranged damage punished, which crosses from "a stance you
  // answer" into "ranged play is switched off". Constant 9000ms at every rung.
  bossMechScale: [1.00, 1.00, 0.94, 0.90, 0.86, 0.82],

  // Mechanic timings. Every window is short on purpose — see above.
  bossMech: {
    // SUNDERING SLAM. Was a bare 5200 literal in `spawnBoss`; lifted here so the
    // per-encounter cadence table has one place to scale it from. Its blast is
    // centred on HIM (240px / 260), so it is a proximity tax rather than a
    // ranged threat — which is exactly why it pairs with DEFLECTION instead of
    // duplicating it. One pushes you off him, the other pushes you onto him.
    sunderEveryMs: 5200,
    reflectEveryMs: 9000,
    // THE STANCE, not a window. At 1400ms this was a hidden reflection window:
    // the player's mag is 3 rounds at 120ms plus a 520ms reload, so one cycle
    // is ~760ms and a 1.4s window bought at most one bolt in flight — which is
    // why the handset read was "flash, my shot came back" rather than "he is
    // guarding". 2400ms is three full mags' worth of opportunity, so a player
    // who keeps firing WILL see several deliberate parries. It is still only
    // 2.4s in every 9s, and no attack of his is suppressed for longer than
    // that, so the fight does not stall waiting it out.
    reflectMs: 2400,
    reflectWindupMs: 500,   // telegraph, so holding fire beats it outright
    // The blade's angle off pure aim while the stance is up and nothing is
    // being parried. The stance has to be legible with NO bolt in the air —
    // otherwise the only thing announcing it is a banner that has already
    // scrolled away. A raised cross-guard is unmistakably not his aim pose.
    guardOffsetDeg: 42,
    // ── The parry ANIMATION ────────────────────────────────────────────────
    // Length of one whole parry gesture: contact, follow-through, recovery.
    // 190ms was chosen when the gesture was "rotate a few degrees onto the
    // incoming bearing", which is a nothing on a phone because the blade is
    // ALREADY pointing at the player — that is the exact subtlety this pass
    // exists to fix. A real bat-away needs room to travel; 300ms is 18 frames
    // at 60 and still short enough that four bolts inside one stance do not
    // queue up behind each other.
    //
    // It still gates NOTHING: no window, no cooldown, no second-bolt block.
    parryMs: 300,
    // Beat boundaries inside parryMs, as fractions:
    //   0        contact. Blade snaps ONTO the bolt's bearing, thrust to full
    //            reach — the bolt is killed and the return fired on this frame,
    //            so this genuinely is the moment of contact, not a wind-up.
    //   ..sweep  FOLLOW-THROUGH. The blade whips through the arc its bearing
    //            family names. This is the part that reads.
    //   ..hold   the finish pose, held just long enough to be seen.
    //   ..1      RECOVERY back to guard.
    parrySweepEnd: 0.40,
    parryHoldEnd: 0.62,
    blackoutEveryMs: 16000,
    blackoutMs: 2600,
    afterimageEveryMs: 13000,
    afterimageCount: 3,
    disarmEveryMs: 15000,

    // ── SUPER DEFLECTION ───────────────────────────────────────────────────
    // The super is NOT batted back pellet by pellet. It used to be: five
    // pellets each returned at `superDamage * player.dmgMult * 0.5`, and
    // `dmgMult` reaches four figures late in a run — so one careless super into
    // his guard came back as five simultaneous unavoidable deletions. He
    // catches it instead, holds it, and hands back ONE slow thing you can run
    // away from.
    //
    // Grace after the LAST pellet before he commits. One super's five pellets
    // arrive inside ~60ms, so this only has to outlast a spread; it exists so a
    // volley produces one orb rather than five.
    superAbsorbGraceMs: 380,
    // Anticipation between "he has it" and "it is coming". This IS the fairness
    // at point blank — the orb spawns at his hands, so the only reaction room a
    // player standing on top of him gets is this.
    superReleaseMs: 620,
    // ── THE POWER SWEEP ────────────────────────────────────────────────────
    // He THROWS it. The last `superSweepMs` of the anticipation above is a
    // saber sweep that drives through the held mass, and the orb leaves on the
    // sweep's power frame — the same instant, from one clock, so the two can
    // never drift into "the ball left and then he swung". Carved OUT of the
    // 620ms, never added to it: the approved anticipation does not move.
    // `superFollowMs` is the follow-through AFTER launch, and it is the last
    // of his saber ownership — offense is eligible the moment it ends, while
    // the orb is still crossing the room on its own.
    superSweepMs: 260,
    superFollowMs: 200,
    // Degrees the blade travels either side of the throw line: it winds up to
    // `superSweepArcDeg` off the line, drives through it at the power frame,
    // and carries on `superFollowArcDeg` past. Both are far bigger than any
    // PARRY_ARCS entry (max 140 total, from a much shorter reach) because this
    // is a heave, not fencing. `superSweepReach` likewise beats the widest
    // parry thrust (54px) so the gesture cannot be mistaken for one.
    superSweepArcDeg: 118,
    superFollowArcDeg: 96,
    superSweepReach: 78,
    // ── ONE SPEED, NO CURVE ────────────────────────────────────────────────
    // The orb travels at the player's OWN super speed, constant, from release
    // until something stops it. Not a number of its own: `PLAYER.superSpeed`
    // is read directly, because the semantic claim is that this IS the
    // player's captured super handed back at the speed it was fired, and a
    // duplicated literal here would let the two drift apart silently.
    //
    // Two rejected designs are worth keeping written down. A flat 405 let the
    // player WALK ALONGSIDE it (base walk is 380) and escort it across the
    // room. The fix for that was an overspeed launch shedding to a cruise —
    // 650 -> 500 over 550ms on a smoothstep — and handset review rejected the
    // whole concept, not the tuning: the player already gets the DEFLECTION
    // warning, the visible stored energy, 620ms of release anticipation, a
    // huge silhouette and a snapshot aim with no homing. All of the fairness
    // is spent before launch, so the flight has no work left to do and any
    // falloff is just the punish softening itself after the decision was
    // already made.
    //
    // 1080 is 2.8x the player's walk and above the 950 dash, so once it is out
    // there is no outrunning it and no escorting it — the answer is to not be
    // on the line, which is the skill the snapshot aim exists to test. Damage
    // did NOT move for any of this: still 455 for a full five-pellet catch.
    superReturnSpeed: PLAYER.superSpeed,
    superLaunchMs: 110,
    // Its lifetime contract is "until it hits something or leaves the world",
    // not "until it has flown N pixels". The arena's diagonal is ~2263px, so
    // this range can never be what ends the flight — it is a backstop behind
    // the wall collision, the player collision and the out-of-bounds sweep in
    // `GameScene._tickSuperOrbs`, which is also where the defensive age cap
    // lives. An inherited bullet range was the wrong contract: the orb was
    // vanishing mid-arena because an ordinary bolt's number said so.
    superReturnRange: 6000,
    // Defensive only. Nothing should reach it: at 500px/s cruise this is 2.2
    // arena diagonals, so an orb still alive here is one that stopped being
    // able to hit or leave anything, and it dies rather than living forever.
    superReturnMaxLifeMs: 5000,
    // ── Return damage ──────────────────────────────────────────────────────
    // Deliberately NOT derived from the pellets' own damage, which carries
    // `player.dmgMult`. Player hp is 1000, so one pellet's worth is 23% of the
    // bar and a full five-pellet super is 45% — a real punish that is survivable
    // once, lethal if you keep feeding him, and identical on encounter 1 and on
    // a Vader six wounds deep with 1000x player damage in the room.
    //
    // The ceiling is a STATED ceiling on damage, not a hidden cap on intake:
    // every pellet is absorbed and counted, the orb carries exactly the number
    // it will deal, and the number it deals is exactly what it displays.
    superReturnBase: 180,
    superReturnPerPellet: 55,
    superReturnDamageMax: 620,

    // VANISH is a REACTION, not a rotation entry. It fires when the player
    // takes this share of his max hp off him inside the window below, then
    // locks out so it cannot chain — "he should use it when I give too much
    // damage but not spam every time".
    //
    // A fraction of hpMax rather than a flat number, so it behaves the same on
    // encounter 1 and on a late Vader with several times the health.
    // A FRACTION OF hpMax, so it moves whenever the pool does — worth checking
    // on any hp change. At 60,000 this is 6,000 damage inside the 2s window,
    // near the 4,600 it was at 46,000 and comfortably inside what a burst
    // produces. (The 300,000 experiment pushed it to 30,000, which no playstyle
    // reaches: the mechanic would have quietly retired itself.)
    vanishHpFrac: 0.10,
    vanishWindowMs: 2000,
    vanishLockMs: 14000,
  },
};

/** One mechanic definition by id, or null. */
export function bossMechanicById(id) {
  return ENDLESS.bossMechanics.find((m) => m.id === id) || null;
}

/**
 * Every mechanic Vader #n arrives with — the union of `bossLadder` rows 1..n.
 *
 * ONE producer for the ladder, called by `spawnBoss` and by the tests, so a
 * regression check cannot agree with a stale copy of the table. Past the last
 * authored row he keeps everything (endless runs reach sector 60+); the order is
 * the order the rows introduce them, so `_mechanics` still reads as the sequence
 * the player was taught.
 */
export function bossMechanicsFor(n) {
  const ids = [];
  for (let i = 0; i < Math.min(n, ENDLESS.bossLadder.length); i++) {
    for (const id of ENDLESS.bossLadder[i]) if (!ids.includes(id)) ids.push(id);
  }
  return ids.map(bossMechanicById).filter(Boolean);
}

export const MODIFIERS = {
  frenzy:     { id: 'frenzy',     name: 'FRENZY',      color: '#ff5030', speedMult: 1.28, spawnRateMult: 0.8 },
  eliteGuard: { id: 'eliteGuard', name: 'ELITE GUARD', color: '#ffd040', eliteChance: 0.35 },
  darkness:   { id: 'darkness',   name: 'DARKNESS',    color: '#8a70ff', darkness: true },
};

// Wave-clear Arena Mode settings. Each room runs a sequence of `waves`; a wave
// spawns its budget of enemies, then the player must clear them all to advance
// (brief breather + reward between waves). Room-level fields are per-wave
// DEFAULTS; each wave object overrides any of them (merged at wave start).
//
// Room-level (defaults for every wave):
//   maxAlive       — concurrent living cap; the drip pauses at this count
//   surgeCount     — burst size for a terminal-hack surge (risk/reward)
//   shooterMix / bomberMix / shieldedMix / sniperMix / swarmlingMix 0-1
//                  — cumulative spawn-type probabilities (remainder = grunt)
//   eliteChance 0-1— chance a non-fodder spawn is upgraded to an elite
// Per-wave (in `waves[]`):
//   count          — number of spawn EVENTS this wave (a swarmling event = one
//                    pack); clearing requires every spawned enemy dead
//   maxAlive/spawnRate/*Mix/eliteChance — optional overrides for escalation
//   reward: 'weapon' — drop a weapon on clear (else default heal + shield)
//   miniBoss: true   — spawn a super-elite at wave start (the room capstone)
export const ARENA = {
  hangar: {
    maxAlive: 12, surgeCount: 4,
    shooterMix: 0.25, swarmlingMix: 0.15,
    waves: [
      { count: 6,  maxAlive: 8,  spawnRate: 1000 },
      { count: 10, maxAlive: 10, spawnRate: 850 },
      { count: 14, maxAlive: 12, spawnRate: 750, reward: 'weapon' },
    ],
  },
  corridor: {
    maxAlive: 14, surgeCount: 5, modifier: 'frenzy',
    shooterMix: 0.28, bomberMix: 0.15, sniperMix: 0.12, swarmlingMix: 0.12, eliteChance: 0.05,
    waves: [
      { count: 8,  maxAlive: 10, spawnRate: 900 },
      { count: 12, maxAlive: 12, spawnRate: 800, eliteChance: 0.10 },
      { count: 16, maxAlive: 14, spawnRate: 700, eliteChance: 0.12, reward: 'weapon' },
    ],
  },
  detention: {
    maxAlive: 14, surgeCount: 6, modifier: 'darkness',
    shooterMix: 0.25, bomberMix: 0.15, shieldedMix: 0.15, sniperMix: 0.12, swarmlingMix: 0.10, eliteChance: 0.08,
    waves: [
      { count: 8,  maxAlive: 10, spawnRate: 850 },
      { count: 12, maxAlive: 12, spawnRate: 750, eliteChance: 0.12 },
      { count: 14, maxAlive: 14, spawnRate: 700, eliteChance: 0.15 },
      { count: 8,  maxAlive: 12, spawnRate: 800, miniBoss: true, reward: 'weapon' },
    ],
  },
  vader: {
    maxAlive: 14, surgeCount: 6, modifier: 'eliteGuard',
    shooterMix: 0.24, bomberMix: 0.15, shieldedMix: 0.12, sniperMix: 0.12, swarmlingMix: 0.10, eliteChance: 0.10,
    waves: [
      { count: 10, maxAlive: 12, spawnRate: 800, eliteChance: 0.12 },
      { count: 14, maxAlive: 14, spawnRate: 700, eliteChance: 0.15 },
    ],
  },
};

