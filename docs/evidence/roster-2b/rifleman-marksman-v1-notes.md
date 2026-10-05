# Roster Phase 2B — Rifleman + Marksman production art (candidate)

Behind `?roster=v1`; legacy art stays the default. Baseline before work: dev = FRIX = `3ce5680`.

## Commits

- `e610738` — HANDOVER §0: human freeze of Gunner art and fire v5, and of movement v2.2 (Gunner + Rifleman); opens Phase 2B.
- `acfdd25` — production art, role firing effects, tests, stills.
- The final commit — videos and these notes.

## Files

| File | Change |
|---|---|
| `src/systems/rosterPaint.js` | Appended the Rifleman and Marksman painters, the carbine and the precision rifle, and `muzzlePastPivot`. The Gunner code is untouched. |
| `src/systems/rosterWeaponFx.js` | New. Role firing effects plus the two discharge textures. |
| `src/data/rosterArt.js` | `art.fx` hook: sets `_rosterFx` / `_rosterFxObj`; for the Rifleman it also sets `_weaponFx`. |
| `src/scenes/PreloadScene.js` | Registers `grunt` and `sniper`, and builds 18 animation keys per new sheet. |
| `src/scenes/GameScene.js` | `attachRosterWeaponFx`. |
| `tests/smoke-roster-2b.mjs` | New, 72 checks. |
| `tests/shot-roster-2b.mjs` | New evidence rig. |
| `tests/smoke-roster-seams.mjs`, `tests/smoke-roster-gunner.mjs` | Now expect `grunt` and `sniper` art under v1. |
| `tests/diag-move-feel.mjs` | New `ENC` and `TYPES` options. |

## Keys

| Role | Body sheet (texture = animation prefix) | Weapon | Firing effect | Discharge texture |
|---|---|---|---|---|
| Rifleman (`grunt`) | `ro-rif-R` / `ro-rif-E` | `ro-w-rif-R` / `ro-w-rif-E` | `rifle` | `fx-rif-muzzle` |
| Marksman (`sniper`) | `ro-mrk-R` / `ro-mrk-E` | `ro-w-mrk-R` / `ro-w-mrk-E` | `marksman` | `fx-mrk-muzzle` |

Each sheet has 33 frames of 24×26 logical pixels at 4× (96×104) and all 18 animation keys. Frames are in the same order as the Gunner's: front 0–7, back 8–15, side 16–23, poses 24–32.

## Gameplay — unchanged, and proven

Every value below is identical to legacy and to the `88e9b89` fixture:

| | Regular | Elite |
|---|---|---|
| Rifleman | hp 320, radius 22, body 44 px | hp 800, radius 30, body **84 px** |
| Marksman | hp 260, radius 22, body 44 px | hp 650, radius 30, body **84 px** |

- **Speed:** unchanged, including the elite and room multipliers.
- **Rifleman:** cadence 1200 ms; bolt 620 px/s, 80 damage, 480 px range.
- **Marksman:** cadence 1900 ms; bolt 1000 px/s, 220 damage, 900 px range; desired range 560, retreat 300; windup 800 ms, lock 260 ms.
- **Spawn:** `cfg.radius + 4`, not moved.

The proof goes beyond the field list: a seeded SNIPER NEST, 900 ticks, is the **same fight** under legacy and v1. Positions, hp, AI state, sniper charge, every shot (13 Marksman, 55 Rifleman) and every random draw match. Every sniper laser draws identical commands on 2538 of 2538 sniper-ticks. The A/B videos sampled identical state at 18 of 18 checkpoints.

## Marksman muzzle / spawn — maps honestly, no human gate needed

The drawn muzzle is placed where the bolt's leading edge is on its first drawn frame:

`8 + speed/60 + 30·clamp(speed/620, 1, 2.2)` past the pivot.

| Role | Bolt speed | Muzzle past pivot |
|---|---|---|
| Rifleman | 620 | 48 |
| Gunner | 700 | 54 |
| Marksman | 1000 | 73 |

So the gameplay speeds themselves produce the requested ordering of weapon lengths.

- **Measured:** muzzle 91.0 px from the body centre against the bolt's leading edge at 91.1 (Elite 99.0 against 99.1). This holds at 8 bearings, including the flipped west.
- **Legacy, for comparison:** the old rifle's muzzle was 79.2, so the first frame of the bolt stuck out 12 px past the gun.
- **Weapon lengths:** carbine 68 px < Gunner 84 px < precision rifle 100 px.
- **Visor:** the back of each weapon stays within 12 px of the body centre, so it never covers the visor.

## Firing language

**Rifleman:**
- Warning: the same ticks as legacy, but shown as a small ready pip at the muzzle (pale amber turning white) instead of the orange whole-gun tint.
- Shot: a 5×5 discharge for one drawn frame plus about 34 ms of decay, and a 1.5 px kick.

**Marksman:**
- No new warning. The laser and lock remain the only telegraph.
- The optic lens reads the sniper's own state: violet while tracking, white-hot on lock.
- Shot: a thin white/magenta needle for one frame plus about 50 ms of decay, and a 1 px kick.

**Both:**
- The body squash on firing is undone for the render only; the physics squash is kept.
- The Gunner's rotor and muzzle never attach to either role.

## Movement

**Rifleman — v2.2, as approved.** SNIPER NEST, seeded, Riflemen only:

| | shipped | v2 | v2.2 |
|---|---|---|---|
| snaps per second | 4.71 | 0.19 | 0.06 |
| reversals per second | 0.77 | 0.05 | **0.13** |
| heading hold | 50 ms | 150 ms | 433 ms |
| shots | 102 | 95 | 104 |
| line of sight | 94% | 89% | 97% |
| nearest mate, median | 35 px | 44 px | 51 px |
| time within 90 px of a mate | 76% | 76% | 77% |

**Marksman — unchanged.** He keeps his own sniper movement. The tests prove he does not get v2.2.

## Elite colliders (`?colliders=1`)

Both Elites keep the historical 84 px body while rendering at scale 1.0.

- **Rifleman Elite:** the drawn figure is about 16 logical pixels (64 px) wide, so the collider is visibly wider than the art, by about 10 px each side.
- **Marksman Elite:** only 10 logical pixels (40 px) wide, so the 84 px collider reaches roughly twice his drawn width.

This is the strongest case yet for a later collider rebalance. It was not changed here, as instructed.

## Known weaknesses at 1×

- **Reversals:** the Rifleman's v2.2 reversal rate (0.13/s) is above v2's, though far below shipped.
- **Close clustering:** unchanged for the Rifleman. A rusher holding a 150 px band keeps mates within 90 px.
- **Rifle on the chest:** aimed straight at the camera, the Marksman's 100 px rifle runs down his centreline over the chest. Every overlay weapon does this.
- **Marksman palette:** the plum body is dark. It reads by its outline and the magenta lens, not by its value.
- **Rifleman profile:** the side view is still a fairly plain white column; the visor and brow are small.
- **Elite Marksman mast:** a 1-pixel antenna, which may be at the limit of 1× readability.

## Tests

| Suite | Result |
|---|---|
| `smoke-roster-2b` | 72/72 |
| `smoke-roster-gunner` | 72/72 |
| `smoke-roster-seams` | 70/70 |
| `smoke-move-v2` | 9/9 |
| `smoke-champion-placement` | 60/60 (run alone) |
| `smoke-encounters` | 25/25 |
| build | ok |

In a parallel run under heavy CPU load, `smoke-champion-placement` failed 4 checks, all wave-timing checks (a known harness effect). It passed 60/60 on a solo rerun.

## Handset URLs

- **Rifleman** (CROSSFIRE, movement v2.2):
  `https://xletof.github.io/crix/?roster=v1&move=v22&encdbg=crossfire&room=corridor&sector=14&wave=1`
- **Marksman and Rifleman** (SNIPER NEST):
  `https://xletof.github.io/crix/?roster=v1&move=v22&encdbg=sniperNest&room=corridor&sector=14&wave=1`
- **Legacy comparison:** either URL without `roster=v1`.
