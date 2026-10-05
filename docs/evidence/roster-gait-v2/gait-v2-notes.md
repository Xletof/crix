# Roster locomotion anatomy gate — `?gait=v2` (presentation only, default off)

## Diagnosis of the current gait (all correct as the human reported)

- **Profile — rear leg as a "tail".** The legs were separated by moving whole leg columns. In `SIDE.near` / `SIDE.far` the hip roots sit up to **7 logical px apart**.
- **Profile — feet pointing opposite ways.** The far boot was drawn `rect(far-1, …, 3)`, extending WEST; the near boot `rect(near, …, 3)`, extending EAST.
- **Front/back — duck feet.** Each toe cap sat on its boot's OUTER x edge.
- **Front/back — floating torso.** The torso bobbed over legs that telescoped by "lift" instead of bending at a knee.
- **Cadence — skating.** The walk ran at a fixed 14 fps whenever `speedSq > 200`. On screen it thrashed walk/idle around that line while v2.2 eased (179 key flips in 3 s).
- **Facing vs motion.** Facing follows the AIM. The measured share of moving time against the facing the sprite shows (`gait-relative-angle.png`):

  | Role | lateral | retreat |
  |---|---|---|
  | Gunner | 19% | 15% |
  | Rifleman | 13–14% | 3–8% |
  | Marksman | 3% | 12% |

  One forward gait therefore cannot be correct.

## v2

**Profile.** One hip socket for both legs. Each leg runs hip → knee → ankle → boot.
- Stride is at most ±3 px from the hip.
- Both boots point east; west is the mirror.
- The far leg is darker and may be hidden.
- Cycle: contact A → load A → pass B → contact B → load B → pass A. The planted foot slides back under the body; the trailing foot leaves heel-first; the swing leg passes under the pelvis with its knee forward.
- Idle is a 2 px stagger; the fire brace is a 4 px stance.

**Front/back.**
- The hip sockets never move.
- A swinging knee comes in under the pelvis; the trailing foot is heel-up.
- Both toe caps face the camera's axis.
- The upper body shifts 1 px over the planted leg and settles 1 px on the load frames. The old bob table is retired for v2.

**Strafe.**
- 18 frames (33–50): a front/back side-step, and in profile a marking-time cycle.
- Retreat plays the walk **backwards** and needs no new frames.

**Cadence (`systems/rosterGait.js`, POST_UPDATE).**
- The gait phase advances with **real displacement**: 48 world px per cycle (Marksman 44), clamped to 24 frames/s.
- Walking turns on above 30 px/s and off below 12 px/s, so there is no walk/idle thrash on screen.
- Mode (walk / strafe) is the movement against the shown facing, held 120 ms before switching.
- It only calls `setFrame`. It never calls `play()`, and never touches velocity, AI, timers or RNG.

**Design untouched.** Upper bodies are drawn by the same role painters with `noLegs`. The Marksman's profile coat-tail now stops at the hip, so it cannot read as a third leg. The Gunner's near leg is one value step lighter, so his knee geometry is visible.

## Tests

| Suite | Result |
|---|---|
| `smoke-gait-v2` | 16/16 |
| Phase 2B | 72/72 |
| Gunner | 72/72 |
| seams | 70/70 |
| move v2.2 | 9/9 |
| Captain placement | 60/60 |
| encounters | 25/25 |
| build | ok |

- **Invariance:** seeded CROSSFIRE and SNIPER NEST runs, gait off vs v2, produce the same fight. Positions, velocities, v2.2 destinations and leg state, AI, cooldowns, sniper charge, HP, collider, the base animation key, bolts and RNG match, with the same 128 / 84 shots.
- **A/B video:** identical state at 18/18 checkpoints.
- **Cadence:** about 7 / 19 / 24 frames/s at 60 / 150 / 260 px/s (shipped: 14 at any speed). 23.4 at 900 px/s, so the clamp holds. Idle at rest. Zero restarts.

## Still weak at 1×

- Strafing still slips: a planted-foot side-step cannot keep pace with 150–230 px/s at this scale. It now reads as a lateral shuffle rather than a forward walk.
- The front-view swing frames (2 and 5) are busy at 1×.
- The Gunner's legs remain dark by design.
- The Marksman's moving time is 70% advance, so his strafe set is rarely seen.

## Handset

`https://xletof.github.io/crix/?roster=v1&move=v22&gait=v2&encdbg=crossfire&room=corridor&sector=14&wave=1`
(SNIPER NEST: `encdbg=sniperNest`; current gait: drop `gait=v2`)
