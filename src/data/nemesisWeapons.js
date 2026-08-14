// Nemesis weapons — what a named elite is holding, and what it does with it.
//
// Every nemesis used to hold `wpn-enemy-rifle` and fire the stock bolt. Six
// traits' worth of mechanical variety was real, but the FIGHT was identical
// every time: the same projectile at the same speed from the same silhouette.
// Trait variety changed how long an encounter took; it never changed what the
// player had to do about it.
//
// ── Where these plug in ───────────────────────────────────────────────────
//
// Every enemy shot in the game already funnels through one place —
// `shooter-fire` -> `GameScene.fireShooter`. A nemesis carrying `_nemesisWeapon`
// dispatches to `fire()` below instead of the stock bolt. That is the whole
// integration: no new AI, no new state machine, and an archetype that never
// shoots simply never reaches it.
//
// ── Why assignment is weighted by base ────────────────────────────────────
//
// A weapon has to suit the AI carrying it. The sniper archetype already holds
// position at 560px and telegraphs before firing, so the BEAM LANCE reads as
// what that AI was always doing; bolted onto a charging grunt it would be a
// wall of unavoidable damage. Likewise the SCATTERGUN belongs on something that
// closes. `pickWeapon` therefore filters by base rather than rolling free.
//
// MELEE BASES GET NOTHING. `grunt` and `swarmling` hide `weaponSprite` entirely
// (Enemy.js) because they ARE the weapon — handing one a rifle would fire
// invisible bolts from an empty hand.

// ── Why the bolts are TINTED and not re-textured ──────────────────────────
//
// `Bullet.fire` sizes its body with `setCircle(this.width / 2)`, so a projectile
// texture's dimensions ARE its hitbox. Giving each weapon its own bullet art
// would therefore have silently changed collision sizes per weapon — a balance
// change disguised as an art change, and one nobody would think to look for.
//
// Tint is free: it recolours the same sprite without touching its width. Each
// weapon reads as its own at a glance and every bolt keeps an identical body.
// `smoke-nemesis-kit` asserts that radius parity directly.
const RANGED_BASES = ['shooter', 'bomber', 'shielded', 'sniper'];

// Applied after fire(); returns the bullet so callers can chain.
const tinted = (b, color) => {
  if (b && color != null) b.setTint(color);
  return b;
};

// The instant of firing, which had no visual at all.
//
// Every weapon below funnelled through `GameScene.fireShooter` with a single
// generic `SFX.enemyShoot()` and no flash, while the player got `muzzleFlash`
// — so four deliberately different weapons were identical at the one moment
// that most defines them. The colour comes from the `tint` each already
// carried for its bullets and nothing else rendered.
//
// `dx`/`dy` offset the flash off the firing axis, for the twin-barrelled one.
const muzzle = (scene, e, angle, w, dx = 0, dy = 0) => {
  const r = (e.cfg?.radius ?? 12) + 6;
  scene.fx?.weaponMuzzle?.(
    e.x + Math.cos(angle) * r + dx,
    e.y + Math.sin(angle) * r + dy,
    angle, w.tint, w.muzzleKind,
  );
};

export const NEMESIS_WEAPONS = [
  {
    id: 'scattergun',
    name: 'SCATTERGUN',
    tex: 'wpn-nem-scatter',
    tint: 0xff8840,        // ember orange
    // Closers only. On a holder it would plink harmlessly from max range.
    bases: ['shooter', 'shielded'],
    pellets: 5,
    spreadDeg: 34,
    speed: 620,
    damage: 34,
    range: 300,          // short on purpose — it has to be walked into
    muzzleKind: 'spray',
    fire(scene, e, angle) {
      muzzle(scene, e, angle, this);
      const spread = (this.spreadDeg * Math.PI) / 180;
      const half = (this.pellets - 1) / 2;
      for (let i = 0; i < this.pellets; i++) {
        const a = angle + (i - half) * (spread / Math.max(1, this.pellets - 1));
        tinted(scene.enemyBullets.fire(
          e.x + Math.cos(a) * (e.cfg.radius + 6),
          e.y + Math.sin(a) * (e.cfg.radius + 6),
          a, this.speed, this.damage, this.range, { owner: 'enemy' },
        ), this.tint);
      }
      return this.pellets;
    },
  },
  {
    id: 'flak',
    name: 'FLAK LAUNCHER',
    tex: 'wpn-nem-flak',
    tint: 0xffd040,        // heavy yellow
    // The bomber already throws things; this is the same idea with a shell.
    bases: ['bomber', 'shooter'],
    // 600, not 380. The old design note called this "a slow, wide triple that
    // has to be walked out of rather than dodged at the last moment — the
    // answer is position, not reflex". The intent is right and the number was
    // wrong: at 380 it matched the player's walk speed exactly, so it could not
    // be walked INTO either. It is still the slowest gun in the game, but it
    // now closes on you while you reposition, which is what makes positioning a
    // decision instead of a formality.
    speed: 600,
    damage: 46,
    range: 620,
    shells: 3,
    arcDeg: 16,
    muzzleKind: 'lob',
    fire(scene, e, angle) {
      muzzle(scene, e, angle, this);
      // A slow, wide triple that has to be walked out of rather than dodged at
      // the last moment — the answer is position, not reflex.
      const arc = (this.arcDeg * Math.PI) / 180;
      for (let i = 0; i < this.shells; i++) {
        const a = angle + (i - 1) * arc;
        tinted(scene.enemyBullets.fire(
          e.x + Math.cos(a) * (e.cfg.radius + 6),
          e.y + Math.sin(a) * (e.cfg.radius + 6),
          a, this.speed, this.damage, this.range, { owner: 'enemy' },
        ), this.tint);
      }
      return this.shells;
    },
  },
  {
    id: 'lance',
    name: 'BEAM LANCE',
    tex: 'wpn-nem-lance',
    tint: 0x60d8ff,        // cold cyan
    // Holders only — the sniper's existing windup IS the telegraph.
    bases: ['sniper', 'shielded'],
    speed: 900,
    damage: 120,
    range: 900,
    muzzleKind: 'lance',
    fire(scene, e, angle) {
      muzzle(scene, e, angle, this);
      tinted(scene.enemyBullets.fire(
        e.x + Math.cos(angle) * (e.cfg.radius + 8),
        e.y + Math.sin(angle) * (e.cfg.radius + 8),
        angle, this.speed, this.damage, this.range, { owner: 'enemy' },
      ), this.tint);
      return 1;
    },
  },
  {
    id: 'repeater',
    name: 'TWIN REPEATERS',
    tex: 'wpn-nem-repeater',
    tint: 0x80ff80,        // repeater green
    bases: ['shooter', 'sniper', 'bomber'],
    speed: 700,
    damage: 22,
    range: 640,
    rounds: 3,
    gapMs: 90,
    offset: 9,           // barrel separation, so it reads as twin-barrelled
    muzzleKind: 'burst',
    fire(scene, e, angle) {
      // Staggered on the scene clock rather than fired as one volley: the point
      // is sustained pressure you have to break line-of-sight from, not a lump
      // of damage. Each round re-checks the shooter is still alive — a burst
      // outliving its owner would fire from a corpse.
      for (let i = 0; i < this.rounds; i++) {
        scene.time.delayedCall(i * this.gapMs, () => {
          if (!e.active || !e.alive) return;
          const perp = angle + Math.PI / 2;
          const side = (i % 2 === 0 ? 1 : -1) * this.offset;
          // One flash per round, at the barrel that actually fired — the
          // alternation is the whole reason this reads as twin-barrelled.
          muzzle(scene, e, angle, this, Math.cos(perp) * side, Math.sin(perp) * side);
          tinted(scene.enemyBullets.fire(
            e.x + Math.cos(angle) * (e.cfg.radius + 6) + Math.cos(perp) * side,
            e.y + Math.sin(angle) * (e.cfg.radius + 6) + Math.sin(perp) * side,
            angle, this.speed, this.damage, this.range, { owner: 'enemy' },
          ), this.tint);
        });
      }
      return this.rounds;
    },
  },
];

const BY_ID = Object.fromEntries(NEMESIS_WEAPONS.map((w) => [w.id, w]));
export const weaponById = (id) => BY_ID[id] || null;

/** Can this base archetype hold a weapon at all? */
export const baseCanHoldWeapon = (base) => RANGED_BASES.includes(base);

/**
 * Choose a weapon for a nemesis, or null.
 *
 * `rng` is INJECTED, like everything else that decides an encounter, so a seed
 * reproduces the whole kit and not just the traits.
 *
 * Returns null for melee bases rather than falling back to something — a grunt
 * with a rifle it cannot show is worse than a grunt with a fist.
 */
export function pickWeapon(base, rng) {
  if (!baseCanHoldWeapon(base)) return null;
  const usable = NEMESIS_WEAPONS.filter((w) => w.bases.includes(base));
  if (!usable.length) return null;
  return rng ? rng.pick(usable) : usable[0];
}
