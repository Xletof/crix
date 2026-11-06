// P2-A2 — PRIMARY CARBINE & OVERRIDE: THE LOADOUT PRESENTATION
// (`?visualPilot=v2c&polish=p1&fxPilot=p2a2`). Installed by the P2-A layer
// (systems/p2aFx.js) when the flag is on; nothing here exists otherwise.
//
// HUMAN direction (2026-11-06, after the P2-A playtest): ONE RIFLE, TWO WAYS
// TO FIRE IT. The hero carries the approved P1 rifle at all times.
//   STANDARD  the ordinary fire path, UNCHANGED — `Player._firePistol`, its
//             ammo pool and recovery, cooldown, bolt count / speed / damage /
//             range, recoil, events, sound, camera, the `playerBullets` pool —
//             presented as the rifle's single-shot mode.
//   OVERRIDE  the rifle pickup, UNCHANGED underneath — internal id `'rifle'`,
//             27 rounds, the three-shot burst, `playerRifleBullets` — presented
//             as a firing-mode module plugged into the same gun. When its
//             rounds run out the secondary empties exactly as before and the
//             gun simply fires STANDARD again; the model never changes.
//
// FOUR IDENTITIES, KEPT APART (the trap the brief names):
//   mechanical weapon   `player.secondary` and the fire paths — never written here
//   displayed weapon    this module's `view` (always the P1 rifle, the blade mid-combo)
//   projectile VFX      p2aFx.js maps the POOL a bolt came from to a style:
//                       playerBullets -> 'standard', playerRifleBullets -> 'override'
//   choreography        p2aFx.js: STANDARD single discharge; OVERRIDE alternating
//                       brake shapes, a bigger first shot, barrel heat
//
// ONE AUTHOR PER OBJECT. P1's weapon Image keeps being driven by P1 exactly as
// before but is never drawn under P2-A2 (hidden once by `visible`, which P1
// never writes — the precedent P1 itself set for the shipped overlay). The
// carried rifle is this module's own Image, placed every frame by P1's OWN
// approved hold code (`_updateWeapon`) run against a read-only view of the
// player whose `secondary` reads 'rifle' — the same reach, grip, recoil, flip,
// depth rule and melee blade, with no copy of that code to drift. The view
// object only READS (every helper it calls on the player is a pure read).
//
// No Text object is created here: Phaser's Text constructor draws Math.random
// for its texture key, which would shift the seeded fight. Existing texts are
// re-worded with setText; the "3-SHOT BURST" caption is painted into a texture
// (p2aPaint.js). No Math.random, no allocation per frame.

import { P1_WEAPONS } from './p1Paint.js';
import { P2A2_TEX } from './p2aPaint.js';

export const P2A2 = {
  hudName: 'OVERRIDE',
  pickupLabel: 'OVERRIDE\n3-SHOT BURST',
  hudIcon: { scale: 0.9, dy: -15 },          // inside the shipped 100x90 panel, clear of the ammo bar
  shippedHudIconScale: 0.42,                 // HUD.js builds secIcon at this scale
};

/** Build the loadout layer for this FX controller. */
export function installLoadoutP2A2(ctl) { return new LoadoutP2A2(ctl); }

class LoadoutP2A2 {
  constructor(ctl) {
    this.ctl = ctl;
    const s = (this.scene = ctl.scene);
    const P = (this.P = s.player);
    this.p1 = s._p1Player;
    // the carried weapon: P1's rifle, drawn by this module's own Image
    this.p1.weapon.setVisible(false);
    this.view = s.add.image(P.x, P.y, P1_WEAPONS.rifle.key).setOrigin(...P1_WEAPONS.rifle.origin);
    this._hold = Object.getPrototypeOf(this.p1)._updateWeapon;
    this._holdCtx = { P: Object.create(P, { secondary: { value: 'rifle', enumerable: true } }), weapon: this.view };
    this._lastSec = P.secondary;
    this._hudStyled = false;
    this.stats = { pickups: 0, primes: 0, hud: 0 };
    // the HUD's secondary readout: an instance wrapper, removed at shutdown
    const hud = (this.hud = s.scene.get('HUD'));
    if (hud && typeof hud.refreshSecondary === 'function') {
      const had = Object.prototype.hasOwnProperty.call(hud, 'refreshSecondary');
      const prev = hud.refreshSecondary;
      hud.refreshSecondary = (id) => { const r = prev.call(hud, id); this._restyleHud(id); return r; };
      this._unHud = () => { if (had) hud.refreshSecondary = prev; else delete hud.refreshSecondary; };
    }
    this.update();
  }

  /** Every frame, from the P2-A layer's POST_UPDATE (after P1's). */
  update() {
    const P = this.P;
    if (!P?.scene || !this.view) return;
    // the carried rifle, by P1's own hold rules
    const shown = P.alive && P.visible && P.active !== false;
    this._hold.call(this._holdCtx, shown, P.hiddenInBush);
    // OVERRIDE engaged: the barrel primes (the P2-A heat glow, full)
    if (P.secondary === 'rifle' && this._lastSec !== 'rifle') { this.ctl.primeHeat(); this.stats.primes++; }
    this._lastSec = P.secondary;
    // the rifle pickup reads as the OVERRIDE module (same place, same body)
    for (const p of this.scene.weaponPickups || []) {
      if (!p.active || p.weaponId !== 'rifle' || p._p2a2) continue;
      p.sprite?.setTexture(P2A2_TEX.pickup.key);
      p.label?.setText(P2A2.pickupLabel).setAlign('center');
      p._p2a2 = true;
      this.stats.pickups++;
    }
  }

  _restyleHud(weaponId) {
    const h = this.hud, p = this.P;
    if (!h?.secIcon || !h?.secText) return;
    const id = weaponId !== undefined ? weaponId : p?.secondary;
    if (id === 'rifle') {
      h.secIcon.setTexture(P2A2_TEX.hud.key).setScale(P2A2.hudIcon.scale).setPosition(h._secX, h._secY + P2A2.hudIcon.dy);
      h.secText.setText(`${P2A2.hudName}  ${p?.secondaryAmmo ?? 0}`);
      this._hudStyled = true;
      this.stats.hud++;
    } else if (this._hudStyled) {
      h.secIcon.setScale(P2A2.shippedHudIconScale);
      this._hudStyled = false;
    }
  }

  destroy() {
    this._unHud?.();
    if (this._hudStyled && this.hud?.secIcon?.active) this.hud.secIcon.setScale(P2A2.shippedHudIconScale);
    this.view?.destroy();
    this.view = null;
    this.P = null;
  }
}
