// Roster art selection — the ONE place that decides which art an ordinary
// archetype wears. Presentation only: nothing here may touch hp, radius,
// speed, AI or what spawns.
//
// Roles are registered by `PreloadScene` as their production art is painted
// (`src/systems/rosterPaint.js`). Today that is the GUNNER (`shooter`) alone.
// Under `?roster=v1` a role with no registered art falls back to legacy art,
// so the rest of the roster stays exactly as it was while one role is judged.
//
// An entry looks like:
//   shooter: {
//     regular: { tex: 'ro-gun-R', prefix: 'ro-gun-R', weapon: 'ro-w-gun-R', weaponOrigin: [ox, oy] },
//     elite:   { tex: 'ro-gun-E', prefix: 'ro-gun-E', weapon: 'ro-w-gun-E', weaponOrigin: [ox, oy] },
//   }
// Any field may be omitted; an omitted field keeps the legacy value.
//
// NOT HERE, on purpose: `swarmling` (stays on the legacy `grunt` sheet with its
// own tint and 0.7 scale) and every nemesis (its own `nem-*` sheets, and
// `GameScene._spawnMiniBoss` forces legacy elite presentation).

import { isRosterV1 } from '../systems/debug.js';
import { makeGunnerWeaponFx } from '../systems/gunnerMuzzle.js';

const ROSTER_V1_ART = {};

/** Register (or with `null`, remove) v1 art for an archetype. */
export function registerRosterArt(type, entry) {
  if (entry) ROSTER_V1_ART[type] = entry; else delete ROSTER_V1_ART[type];
}

/**
 * The v1 art for `type` at this tier, or null when the legacy art applies —
 * the flag is off, the type has no entry, or its texture is not loaded.
 */
export function rosterArtFor(scene, type, elite = false) {
  if (!isRosterV1()) return null;
  const a = ROSTER_V1_ART[type]?.[elite ? 'elite' : 'regular'];
  if (!a?.tex || !scene.textures.exists(a.tex)) return null;
  return a;
}

/**
 * Put a body on new art WITHOUT moving its physics. The texture can be a
 * different size from the one the body circle was centred on, so the circle is
 * re-centred on the new frame at the SAME radius: Arcade derives the body's
 * width from the radius it was given times |scaleX|, so passing the radius back
 * unchanged keeps the collider byte-identical.
 */
export function wearRosterArt(enemy, art, bodyRadius) {
  enemy.anims?.stop();
  enemy.setTexture(art.tex);
  if (art.prefix) {
    // The hp bar's colour is read off the PREFIX in the frozen base class
    // (`'shooter'` is the cyan bar). Remember the one it had, so the bar keeps
    // its legacy colour — see `EnemyShooter.updateHpBar`.
    enemy._barPrefix ??= enemy._animPrefix;
    enemy._animPrefix = art.prefix;
  }
  if (art.weapon && enemy.weaponSprite) {
    enemy.weaponSprite.setTexture(art.weapon);
    // Presentation only: where the drawn gun sits on the aim line the base
    // class places it on. The bolt's spawn point is not read from here.
    if (art.weaponOrigin) enemy.weaponSprite.setOrigin(art.weaponOrigin[0], art.weaponOrigin[1]);
  }
  // presentation-only muzzle discharge (systems/gunnerMuzzle.js) for art that asks for it
  enemy._muzzleFx = !!art.muzzleFx;
  // ...and the weapon's own charge / kick cycle (replaces the shared orange
  // warning tint and the whole-body shot squash for this body only)
  if (art.weaponFx && !enemy._weaponFx) enemy._weaponFx = makeGunnerWeaponFx(enemy);
  enemy.body.setCircle(bodyRadius, enemy.width / 2 - bodyRadius, enemy.height / 2 - bodyRadius);
}
