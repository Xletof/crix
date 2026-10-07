// THE BULWARK'S DISPLAYED FACING (roster v1). PRESENTATION ONLY.
//
// `EnemyShielded._tickSwarm` turns the shield with
// `_shieldFacing += clamp(Wrap(toPlayer - _shieldFacing))` and never wraps
// the sum, and `_aim = _shieldFacing`. That is correct GAMEPLAY: every reader
// of the angle that decides anything — the block test, the gun's position and
// rotation, the vision cone — goes through sin / cos / Wrap, so a shield
// facing -450deg points exactly where one facing -90deg does.
//
// The painted-facing choice does not. `Enemy._facingSuffix` classifies RAW
// degrees, so a shield that reached a player the short way through west
// (-90deg -> -225deg) shows the WEST sprite for every bearing until it comes
// back the other way: -450deg (north) is drawn facing west. Gait v2 reads the
// facing the sprite shows, so a Bulwark walking toward the player in that
// state is drawn walking BACKWARDS. The same raw angle sets the sidearm
// overlay's flip (|aim| > 90deg: an east-pointing pistol drawn upside down)
// and its draw order (a north-pointing gun drawn over the helmet instead of
// behind it — which also lifts the field cells on the gun over his body).
//
// The fix is display-only, and touches neither `_shieldFacing` nor `_aim`:
//   - `_facingSuffix` resolves the facing from the WRAPPED angle, through the
//     frozen implementation itself (the boundaries are its own, exactly);
//   - the overlay's flip and depth are re-derived from that same wrapped angle
//     with the base class's own two rules, after the base has run.
// In range (|aim| <= 180deg) both are exact no-ops, so everything that was
// right stays bit-identical; only a frame drawn from an out-of-range angle
// changes, and only in what it shows.

import Phaser from 'phaser';

/** The angle presentation reads: unchanged in range, wrapped outside it. */
export function displayAim(a) {
  return a > Math.PI || a < -Math.PI ? Phaser.Math.Angle.Wrap(a) : a;
}

/** Per bearer, once (from `wearRosterArt`). */
export function installBulwarkFacing(e) {
  if (e._displayFacing) return;
  e._displayFacing = true;
  const facing = Object.getPrototypeOf(e)._facingSuffix;   // the one implementation of the boundaries
  e._facingSuffix = function () {
    const raw = this._aim, shown = displayAim(raw);
    if (shown === raw) return facing.call(this);
    this._aim = shown;                                     // for the length of this call only
    try { return facing.call(this); } finally { this._aim = raw; }
  };
  const pre = e.preUpdate;                                 // the class chain: base presentation, then the AI
  e.preUpdate = function (time, delta) {
    const raw = this._aim;                                 // what the base presentation block draws from
    pre.call(this, time, delta);
    const shown = displayAim(raw), ws = this.weaponSprite;
    if (shown === raw || !ws || !this.alive) return;
    // Enemy.preUpdate's own two overlay rules, on the wrapped angle
    ws.setFlipY(Math.abs(shown) > Math.PI / 2);
    const deg = Phaser.Math.RadToDeg(shown);
    ws.setDepth(deg < -45 && deg > -135 ? this.y - 1 : this.y + 1);
  };
}
