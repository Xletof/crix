// All gameplay tunables live here so we can iterate on feel quickly.

export const VIEW = {
  width: 720,
  height: 1280,
};

export const WORLD = {
  width: 1600,
  height: 1600,
  bg: 0xf2c878,        // sand
  bgDark: 0xd9a85a,    // sand stripes
  bushColor: 0x2f8a4e,
  bushColorDark: 0x215f37,
  wallColor: 0x7a5230,
};

export const PLAYER = {
  hp: 1000,
  speed: 220,
  radius: 22,
  ammoMax: 3,
  ammoReloadMs: 1500,
  fireCooldownMs: 220,
  // Primary attack: 3-pellet spread
  pelletCount: 3,
  pelletSpreadDeg: 14,
  pelletDamage: 320,
  pelletSpeed: 720,
  pelletRange: 380,
  pelletRadius: 7,
  // Super
  superHitsToCharge: 10,
  superPellets: 7,
  superSpreadDeg: 28,
  superDamage: 520,
  superSpeed: 900,
  superRange: 520,
  superRadius: 11,
  superKnockback: 380,
  // HP regen
  regenDelayMs: 3000,
  regenPerSec: 200,
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
  // wave 1
  { spawns: [{ type: 'grunt', count: 4 }], spreadMs: 3000 },
  // wave 2
  { spawns: [{ type: 'grunt', count: 3 }, { type: 'shooter', count: 2 }], spreadMs: 3500 },
  // wave 3
  { spawns: [{ type: 'shooter', count: 2 }, { type: 'grunt', count: 4 }], spreadMs: 2500 },
];

export const HUDCFG = {
  joystickRadius: 90,
  joystickKnobRadius: 42,
  joystickMargin: 36,
  joystickBottom: 36,
};

export const COLORS = {
  player: 0x3a8bff,
  playerOutline: 0x0b3e8c,
  bullet: 0xffe066,
  bulletSuper: 0xff9f1c,
  enemyBullet: 0xff4d6d,
  hpBack: 0x222933,
  hpFront: 0x4cd964,
  hpLow: 0xff3b30,
  ammoOn: 0xffe066,
  ammoOff: 0x444a55,
  superGauge: 0xffae00,
  superReady: 0xffe066,
  textShadow: 0x000000,
};
