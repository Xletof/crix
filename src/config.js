// All gameplay tunables live here so we can iterate on feel quickly.

export const VIEW = {
  width: 720,
  height: 1280,
};

export const WORLD = {
  width: 1600,
  height: 1600,
  bg: 0x14161c,
  bgDark: 0x0c0c12,
  bushColor: 0x2e3038,
  wallColor: 0x1e2028,
};

export const PLAYER = {
  hp: 1000,
  speed: 240,
  radius: 22,
  ammoMax: 4,
  ammoReloadMs: 750,
  fireCooldownMs: 150,
  // Primary: 3 red blaster bolts (pistol)
  pelletCount: 3,
  pelletSpreadDeg: 10,
  pelletDamage: 300,
  pelletSpeed: 820,
  pelletRange: 420,
  pelletRadius: 7,
  // Super: wrist-rocket barrage
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

// Secondary weapons (picked up in rooms)
export const WEAPONS = {
  rifle: {
    id: 'rifle',
    name: 'DC-15 RIFLE',
    totalAmmo: 27,       // 9 bursts
    burstCount: 3,
    burstDelayMs: 75,    // ms between burst shots
    damage: 220,
    speed: 940,
    range: 500,
    fireCooldownMs: 300,
  },
  flamethrower: {
    id: 'flamethrower',
    name: 'FLAMETHROWER',
    fuel: 100,            // percentage
    drainPerSec: 22,      // ~4.5 s of continuous fire
    damagePerSec: 380,
    range: 190,
    halfAngleDeg: 28,
  },
  detonator: {
    id: 'detonator',
    name: 'THERMAL DET.',
    charges: 3,
    throwSpeed: 510,
    fuseMs: 1100,
    blastRadius: 130,
    damage: 750,
  },
};

export const ENEMY = {
  grunt: {
    hp: 600,
    speed: 180,
    radius: 22,
    meleeDamage: 150,
    meleeRange: 38,
    meleeCooldownMs: 700,
    color: 0xdcdce8,
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
    color: 0x181820,
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

// Bacta vial healing pickup
export const HEALTH_ORB = {
  dropChance: 0.22,
  healAmount: 140,
  radius: 14,
  color: 0x1898e8,
  lifeMs: 8000,
};

export const HUDCFG = {
  joystickRadius: 90,
  joystickKnobRadius: 42,
  joystickMargin: 36,
  joystickBottom: 36,
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
