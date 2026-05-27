// All gameplay tunables live here so we can iterate on feel quickly.

export const VIEW = {
  width: 720,
  height: 1280,
};

export const WORLD = {
  width: 1600,
  height: 1600,
  bg: 0x14161c,       // Death Star floor dark (matches PAL.impMid)
  bgDark: 0x0c0c12,
  bushColor: 0x2e3038, // Imperial console
  wallColor: 0x1e2028, // Blast door
};

export const PLAYER = {
  hp: 1000,
  speed: 240,
  radius: 22,
  ammoMax: 4,
  ammoReloadMs: 750,
  fireCooldownMs: 150,
  // Primary: 3 red blaster bolts
  pelletCount: 3,
  pelletSpreadDeg: 10,
  pelletDamage: 300,
  pelletSpeed: 820,
  pelletRange: 420,
  pelletRadius: 7,
  // Super: wrist-rocket barrage (7 missiles)
  superHitsToCharge: 10,
  superPellets: 7,
  superSpreadDeg: 30,
  superDamage: 520,
  superSpeed: 700,
  superRange: 560,
  superRadius: 12,
  superKnockback: 440,
  // HP regen
  regenDelayMs: 2500,
  regenPerSec: 220,
  // Bush alpha
  bushAlpha: 0.5,
};

export const ENEMY = {
  grunt: {
    hp: 600,
    speed: 180,
    radius: 22,
    meleeDamage: 150,
    meleeRange: 38,
    meleeCooldownMs: 700,
    color: 0xdcdce8,   // stormtrooper white
    eyeColor: 0x20ee20,
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
    color: 0x181820,   // death trooper black
    eyeColor: 0x20d020,
  },
};

export const BOSS = {
  hp: 6000,
  radius: 56,
  speed: 110,
  contactDamage: 220,
  phase2: 0.66,
  phase3: 0.33,
  chargeWindupMs: 700,
  chargeSpeed: 560,
  chargeDurationMs: 900,
  // Force push fan attack
  fanPellets: 11,
  fanSpreadDeg: 70,
  fanBulletSpeed: 380,
  fanBulletDamage: 130,
  fanBulletRange: 720,
  spawnCount: 3,
  attackCooldownMs: 2200,
  color: 0x0a0a0e,
  eyeColor: 0xff2020,
};

export const WAVES = [
  // Wave 1 — stormtrooper squad
  { spawns: [{ type: 'grunt', count: 4 }], spreadMs: 2500 },
  // Wave 2 — plus death troopers
  { spawns: [{ type: 'grunt', count: 3 }, { type: 'shooter', count: 2 }], spreadMs: 3000 },
  // Wave 3 — heavy assault
  { spawns: [{ type: 'shooter', count: 3 }, { type: 'grunt', count: 5 }], spreadMs: 2500 },
];

// Bacta vial healing pickup
export const HEALTH_ORB = {
  dropChance: 0.22,
  healAmount: 140,
  radius: 14,
  color: 0x1898e8,    // bacta blue
  lifeMs: 8000,
};

export const HUDCFG = {
  joystickRadius: 90,
  joystickKnobRadius: 42,
  joystickMargin: 36,
  joystickBottom: 36,
};

// Numeric hex colors for Phaser Graphics calls
export const COLORS = {
  player:       0x6a7080, // beskar
  playerOutline: 0x0a0c14,
  bullet:       0xff2828, // red blaster bolt
  bulletSuper:  0xffffff, // missile
  enemyBullet:  0x10ee10, // green bolt
  hpBack:       0x0a0e18,
  hpFront:      0x1898e8, // bacta blue HP bar
  hpLow:        0xee1010, // red when critical
  ammoOn:       0xff2828, // red energy cell
  ammoOff:      0x1a1c22,
  superGauge:   0xee1010,
  superReady:   0xff5040,
  textShadow:   0x000000,
};
