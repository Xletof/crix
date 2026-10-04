# Gunner fire v3 + enemy movement v2 (candidate)

**Base:** `0918faf`. The commit is in the hand-off report.

## Gunner fire v3 (presentation only, v1 Gunner only)

The charge is now drawn in and around the gun across the existing 300 ms warning window:
- **Chamber.** The receiver core line lights up, and a white packet runs from the butt to the muzzle three times, accelerating.
- **Swirl.** Four sparks orbit the muzzle, spinning up and pulling in from 12 px to 4 px. Green turns to yellow-white, then collapses into a white core.

The release, in about 70 ms:
- a chamber flash;
- a 2 px ring snapping out to 13 px;
- the existing discharge;
- a 2 px kick of the gun alone.

Unchanged from v2:
- no tint;
- the body squash still runs for physics and is undone for the render;
- timings are identical to legacy (the seeded lockstep in `smoke-roster-gunner` passes).

## Enemy movement v2 (GAMEPLAY change, behind `?move=v2`, default off)

**Scope:** the shared shooter swarm tick, for Gunner and Rifleman only. Not Bulwark, Marksman, Demolisher, swarmling, nemesis or Captain (`smoke-move-v2`).

**Diagnosis.** `_tickSwarm` writes velocity outright every frame, so every change of intent is a one-frame snap. Its pocket strafe:
- re-aims perpendicular to the player each frame, so it curves;
- re-rolls direction 50/50 every 0.84–1.56 s;
- shares hard 340/160 px band edges, so bodies flip modes frame to frame;
- never stops, and every shot is fired on the move.

**The change:**
- committed world-space strafe legs of 0.62–1.1 s;
- settles of 0.32–0.6 s between legs;
- a reversal only after two legs, when blocked, or to step away from a squadmate within 110 px;
- 40 px hysteresis on the band edges;
- eased velocity (90 ms in, 70 ms out);
- a plant for the shot inside the band: slow through the warning, stand for the fire frame.

Fire timing logic is untouched.

**Measured** with `tests/diag-move-feel.mjs` (seeded CROSSFIRE, 230 actor-seconds):

| | shipped | move=v2 |
|---|---|---|
| one-tick snaps > 60° /s | 3.75 | 0.07 |
| reversals /s | 0.54 | 0.06 |
| turns > 45° /s | 3.92 | 0.12 |
| median heading hold | 33 ms | 333 ms |
| time standing | 8 % | 32 % |
| shots fired on the move | 100 % | 32 % |
| Gunner/Rifleman shots | 209 | 202 (−3 %) |
| line of sight | 85 % | 82 % |
| mean distance | 307 px | 327 px |

## Tests

| suite | result |
|---|---|
| `smoke-roster-gunner` | 67/67 |
| `smoke-move-v2` | 3/3 |
| `smoke-roster-seams` | 70/70 |
| `smoke-champion-placement` | 60/60 |
| `smoke-encounters` | 25/25 |

The production build succeeds.
