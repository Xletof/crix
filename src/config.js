// All gameplay tunables live here so we can iterate on feel quickly.

export const VIEW = {
  width: 720,
  height: 1280,
};

export const WORLD = {
  width: 1600,
  height: 1600,
  bg: 0xd4a96a,        // dirt light (matches PAL.dirtLight)
  bgDark: 0x8a5828,    // wood mid
  bushColor: 0x6a3a20, // tumbleweed brown
  bushColorDark: 0x2a1810,
  wallColor: 0x5a3018, // wood crate
};

export const PLAYER = {
  hp: 1000,
  speed: 240,           // slightly faster — feels more nimble
  radius: 22,
  ammoMax: 4,           // one extra shot (was 3)
  ammoReloadMs: 750,    // 2× faster reload (was 1500ms) — MUCH more responsive
  fireCooldownMs: 150,  // snappier trigger (was 220ms)
  // Primary attack: 3-pellet spread (tighter for more precision feel)
  pelletCount: 3,
  pelletSpreadDeg: 10,  // tighter (was 14°) — feels more accurate & powerful
  pelletDamage: 300,    // slight nerf to compensate for faster reload (was 320)
  pelletSpeed: 780,     // faster bullets (was 720) — more satisfying impact
  pelletRange: 400,     // slightly longer range (was 380)
  pelletRadius: 7,
  // Super
  superHitsToCharge: 10,
  superPellets: 7,
  superSpreadDeg: 28,
  superDamage: 520,
  superSpeed: 960,      // snappier super (was 900)
  superRange: 540,
  superRadius: 11,
  superKnockback: 420,  // more knockback punch (was 380)
  // HP regen
  regenDelayMs: 2500,   // regen kicks in sooner (was 3000ms)
  regenPerSec: 220,     // slightly faster regen (was 200)
  // Hidden in bush
  bushAlpha: 0.6,
};

export const ENEMY = {
  grunt: {
    hp: 600,
    speed: 180,
    radius: 22,
    meleeDamage: 150,
    meleeRange: 38,
    meleeCooldownMs: 700,
    color: 0xd94f4f,
    eyeColor: 0xffe66d,
  },
  shooter: {
    hp: 400,
    speed: 140,
    radius: 22,
    desiredRange: 360,
    fireCooldownMs: 1800,
    bulletSpeed: 480,
    bulletDamage: 110,
    bulletRange: 520,
    color: 0xb04ad9,
    eyeColor: 0x9cf1ff,
  },
};

export const BOSS = {
  hp: 6000,
  radius: 56,
  speed: 110,
  contactDamage: 220,
  // Phase thresholds (% of hp)
  phase2: 0.66,
  phase3: 0.33,
  // Attack patterns
  chargeWindupMs: 700,
  chargeSpeed: 540,
  chargeDurationMs: 900,
  fanPellets: 11,
  fanSpreadDeg: 70,
  fanBulletSpeed: 360,
  fanBulletDamage: 130,
  fanBulletRange: 700,
  spawnCount: 3,
  attackCooldownMs: 2200,
  color: 0x9b2c2c,
  eyeColor: 0xffd166,
};

export const WAVES = [
  // wave 1 — easy intro
  { spawns: [{ type: 'grunt', count: 4 }], spreadMs: 2500 },
  // wave 2 — adds shooters
  { spawns: [{ type: 'grunt', count: 3 }, { type: 'shooter', count: 2 }], spreadMs: 3000 },
  // wave 3 — more pressure
  { spawns: [{ type: 'shooter', count: 3 }, { type: 'grunt', count: 5 }], spreadMs: 2500 },
];

// Health orb drop (small healing pickup on enemy death)
export const HEALTH_ORB = {
  dropChance: 0.22,     // 22% chance per enemy death
  healAmount: 140,      // heal 140 HP
  radius: 14,
  color: 0xe8a040,      // warm amber (western healing tonic)
  lifeMs: 8000,         // orb disappears after 8s
};

export const HUDCFG = {
  joystickRadius: 90,
  joystickKnobRadius: 42,
  joystickMargin: 36,
  joystickBottom: 36,
};

// All numeric hex colors used by Phaser Graphics calls. Mirrors PAL in pixelArt.js
// but as integers (Phaser.Graphics needs 0x-prefixed numbers).
export const COLORS = {
  // Player / friendly accents
  player: 0xd4a96a,
  playerOutline: 0x3a1a08,
  // Bullets (warm tracers)
  bullet: 0xffd040,
  bulletSuper: 0xfff8d0,
  enemyBullet: 0xcc2020,
  // HP bar
  hpBack: 0x2a1810,
  hpFront: 0xd83838,
  hpLow: 0x8a1010,
  // Ammo pips (bullet shells)
  ammoOn: 0xffd040,
  ammoOff: 0x4a2818,
  // Super gauge (gold)
  superGauge: 0xb07820,
  superReady: 0xffd040,
  // Misc
  textShadow: 0x1a0a04,
};
