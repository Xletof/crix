# Gunner v1: muzzle discharge (polish pass)

**Commit:** see the hand-off report. The base is `191747a`.

**Files changed**
- `src/systems/gunnerMuzzle.js` (new): the painted 2-frame discharge and its per-scene listener.
- `src/scenes/PreloadScene.js`: paints the discharge texture.
- `src/scenes/GameScene.js`: one line, `attachGunnerMuzzle(this)`.
- `src/systems/rosterPaint.js`: the Gunner art entry gains `muzzleFx: true`.
- `src/data/rosterArt.js`: `wearRosterArt` sets `_muzzleFx` from the art.
- `tests/smoke-roster-gunner.mjs`: +3 checks.
- `tests/shot-roster-gunner.mjs`: new `firefx` mode.

**Presentation only.** Before this pass there was no muzzle event at all on any stock enemy: `fireShooter` spawned the bolt and played a sound. Only art that declares `muzzleFx` gets the discharge, which today means the v1 Gunner (both tiers). Legacy Gunner, shielded, sniper, grunt, nemeses and the Captain are unchanged. No shared FX path was edited.

The discharge listens to `shooter-fire` and reads the gun sprite's transform. It ticks on the scene's own delta, uses no randomness, writes nothing back and owns no tween.

**Gameplay unchanged:**
- `smoke-roster-gunner` 61/61, including the seeded legacy-vs-v1 CROSSFIRE: identical positions, hp, AI, the same 117 shots on the same ticks, bolt spawn at `radius + 4`, and the same random draws.
- `smoke-roster-seams` 70/70.
- `smoke-champion-placement` 60/60.

**Evidence**
- `gunner-firefx-v1-ab.webm`: old vs new, regular and elite, same frame, 1×.
- `gunner-firefx-v1-strip.png` (1×) and `gunner-firefx-v1-strip-3x.png` (inspection).
- `gunner-firefx-v1-live.webm`: CROSSFIRE, real speed.
