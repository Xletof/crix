# Gunner v1 weapon fire, v2 (correction pass)

**Commit:** see the hand-off report. The base is `dbf16c6`.

**Where the old read came from.** Both sources are shared by every shooter subclass (Gunner, shielded, sniper, grunt, bomber, swarmling), in `EnemyShooter._maybeFireAt` in `src/entities/Enemy.js`:
- **The orange gun.** `weaponSprite.setTint(0xff6010)` 300 ms before the shot, cleared by a `delayedCall` 360 ms later, so it outlives the shot by 60 ms. It is the only pre-shot dodge cue, so it carries gameplay information.
- **The "shoved backward" bob.** `recoilT = 100`, which `Enemy.preUpdate` turns into a whole-body shrink of up to 15 % around the centre. The gun overlay does not scale, so the figure collapses under a fixed gun and springs back. The gun itself never moved.
- **That shrink is also physics.** Arcade sizes the body from the sprite's scale, so the squash is a 100 ms change to the physics footprint. Removing it made the seeded legacy-vs-v1 fight diverge (caught by the lockstep test).

**What changed** (v1 Gunner only, via the art entry `weaponFx`):
- `EnemyShooter._maybeFireAt` gains two hooks, `_weaponFx.charge(WARN)` and `_weaponFx.shot()`. Without `_weaponFx` it behaves exactly as before.
- The warning keeps its tick and its 300 ms window. For the v1 Gunner it is drawn as the gun's own charge instead of the orange tint:
  - the power indicator brightens green, then yellow-white;
  - a pip at the muzzle grows from green to white.
- On the shot:
  - `recoilT = 100` still runs, so the physics footprint is unchanged;
  - the shrink is undone after the physics step and before the render, so the picture stays at rest scale;
  - the gun alone kicks back 2 px along its axis and is home in 80 ms;
  - the indicator flashes and then drops back;
  - the existing white/lime discharge fires.
- Code: `src/systems/gunnerMuzzle.js` (the controller and charge textures), `rosterArt.js`, `rosterPaint.js`, `PreloadScene.js`, `Enemy.js` (the `EnemyShooter` subclass only; the base class is byte-identical). Tests: `smoke-roster-gunner.mjs`, `shot-roster-gunner.mjs`.

**Gameplay identical.**
- `smoke-roster-gunner` 67/67. The seeded legacy-vs-v1 CROSSFIRE is identical over 900 ticks: the same 117 shots on the same ticks, the same spawn points, and the same random draws. The warning starts on the same tick as legacy.
- `smoke-roster-seams` 70/70.
- `smoke-champion-placement` 60/60.

**Evidence**
- `gunner-weaponfire-v2-ab.webm`: old vs new, regular and elite, 1×.
- `gunner-weaponfire-v2-strip.png`
- `gunner-weaponfire-v2-live.webm`: CROSSFIRE.
- `gunner-weaponfire-v2-zoom.webm`: 3× diagnostic.
