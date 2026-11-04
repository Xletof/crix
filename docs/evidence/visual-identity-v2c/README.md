# Visual Identity V2C — ground material and surface cohesion (`?visualPilot=v2c`)

**Status: CANDIDATE — opt-in, presentation only, awaiting the HUMAN handset
verdict. Not a default; not approved; nothing frozen.** V2C is V2B in every
respect — the V2 protagonist and swarmlings, the accepted V2B crates, consoles,
machinery relief and height-projected shadows, byte-identical textures and
bodies — standing on a new Hangar **ground**. R1 (no flags), V2 and V2B are
unchanged and proven so against the V2B build (`7a75e1e`).

## Play it (GitHub Pages, deployed from `FRIX`)

| | link |
|---|---|
| R1 — production | https://xletof.github.io/crix/ |
| V2 | https://xletof.github.io/crix/?visualPilot=v2 |
| V2B — objects accepted | https://xletof.github.io/crix/?visualPilot=v2b |
| **V2C — this candidate** (the Hangar is the first room of a run) | https://xletof.github.io/crix/?visualPilot=v2c |
| **V2C combat demo** — SWARM TIDE in the Hangar, sector 3 | https://xletof.github.io/crix/?visualPilot=v2c&encdbg=swarmTide&room=hangar&sector=3 |
| …the same encounter under V2B, for the side-by-side | https://xletof.github.io/crix/?visualPilot=v2b&encdbg=swarmTide&room=hangar&sector=3 |

## 1. Why the V2B ground read as an empty backdrop

At the phone's size and at 1x (`detail/centre-floor-2x.png`, left half):

- **One sheet, one finish.** Lane, apron and general deck were the same flat
  blue-grey. Each field spanned only 8–15 luminance levels (lane 44, general
  38, apron 38 median), and nearly all of that spread was the seam lines
  themselves. Nothing said worn, newer, heavier or busier.
- **Two grids that disagreed.** The leftover hex tiling cut diagonally across
  the rectangular plates, so the eye read neither as construction.
- **Seams without thickness.** A 2px joint with a 1px lip draws lines on a
  sheet rather than separating heavy slabs; at 0.54x it vanished, so the middle
  of the fight read as empty.
- **Wear not attached to anything.** Seventy thin polish streaks read as scan
  lines at 1x and as nothing at phone size; there was no traffic path.
- **The floor did not answer its objects.** Shadows were the only link: no grime
  at a machine's foot, no worn patch where an operator stands, nothing changed
  under the shuttle.
- **What worked and is kept:** the dark, calm value (actors and bolts pop), the
  V2B tread plates and recessed bay, wall shadows, the light pools, LIGHTS OUT.

## 2. Design: a ground built from the room's own forms

Nothing is invented. The fields are the room spec's own regions, the slabs sit on
its module, and the wear goes where its objects work.

| layer | what it is | why it reads |
|---|---|---|
| **Fields** | the deployment **lane** (long plates on its axis, polished traffic metal), the launch **apron** (heavy 3x3 blast plates, heat-darkened), the **staging bay** (darker freight floor round its tread plate), the **general deck** (standard plates) | four surfaces with four jobs; at phone size the lane (median 50–53) separates clearly from the general deck (35) |
| **Slabs** | every plate: dark joint, a lit north-west catch, a dark south-east chamfer, corner fasteners, its own tone (most within a few levels, some replaced — newer, cooler — and some older and grimier) | the chamfer and the tone carry the slab at phone size; the catch and fasteners reward a close look |
| **Expansion joints** | a heavy recessed channel round each field, its far wall lit | the hierarchy: field, then plate, then fastener |
| **Kick strip** | a darker, grimier 28px band where the deck meets the walls, with its own joint | frames the floor; with V2B's wall shadow the deck reads as sitting inside walls, not cut off by them |
| **Wheel paths** | two polished bands down the lane, abraded at their edges, with rubber where the wheels cross each joint | the room's direction, stated by use rather than paint |
| **Soot fan** | a stepped darkening aft of the shuttle's engines on the apron | the machine has worked here |
| **Operator stands** | a scuffed, polished patch in front of every console | people stand here |
| **Grime** | stepped dark bands round the foot of every cover object and machine (not the shuttle: it stands on its gear) | the floor answers its objects |
| **Scars** | four blaster scars on the ground fights cross | the room has been fought in |
| **No hex** | the backdrop is painted with `hexAlpha: 0` | one construction system, not two |

North-west light throughout (catch, chamfer, the lit far walls of joints).
Values only — black, cool white, one warm soot — at low alpha: no red, no small
green points, no circles, nothing that rises.

## 3. Matched comparisons

Same seeded fight, tick and camera in every pair (the rig checks player,
enemies, bullets and RNG draws at each shutter and film frame).

- **Phone size, stations** (`compare/env-{bay,apron,lane,east,dark}-phone.png`,
  R1 | V2B | V2C): in V2C the deck reads as plated steel. The lane is a lighter
  traffic surface with long plates and a wheel path, the apron a darker
  heavy-plate field with soot behind the shuttle, and the general deck a
  patchwork of slabs. V2B's floor is a single grey with the objects on it.
- **Centre floor** (`detail/centre-floor-2x.png`): hex diagonals and streaks
  replaced by long lane plates, chamfers, fasteners and the polished path.
- **Floor to cover** (`detail/floor-to-cover-2x.png`): the crate stands on a
  slab, inside its own grime and V2B's shadow.
- **Machinery to ground** (`detail/machinery-to-ground-1x.png`,
  `gantry-to-ground-1x.png`): the shuttle on heavy apron plates with the soot
  fan aft of its engines; the gantry's tread plate meeting the general deck.
- **Wall to ground** (`detail/wall-to-ground-2x.png`): west wall, its cast
  shadow, the kick strip and its joint, then the lane plates.
- **Console** (`detail/console-stand-2x.png`), **general deck**
  (`detail/plates-general-2x.png`).
- **Combat** (`compare/fight-{lane,apron}-*-phone.png`, V2B | V2C; 1x crops
  `compare/fight-*-detail-1x.png`): bolts, the Marksman's laser, damage numbers
  and every actor read as in V2B — the floor gained structure without gaining
  brightness where the fight is.
- **Film** (`film/v2b-v2c-lane-phone-size.mp4`, `v2b-v2c-lane-detail-1x.mp4`):
  6 s of the staged lane fight, V2B | V2C, 181 frames each, every frame
  state-checked against R1 (`film/states-film-lane.json`).

## 4. Honest review

**Improved, visibly at phone size:** the floor now has a material and a
construction; the lane reads as a road; the apron as heavy plating under a
machine that runs; walls frame the deck. The V2B objects sit on something.

**Improved, only up close:** fasteners, the catch on each slab, rubber at the
joints, the operator stands, the grime bands. They reward a pause and do not
compete in motion.

**Still insufficiently grounded:**
- The **general deck** is still a regular grid of same-size slabs; it is calm,
  but it is the least individual surface in the room.
- **Grime at the feet** of the crates is mostly hidden under V2B's own cast and
  contact shadows; the floor answers its objects more by the operator stands
  and the soot fan than by grime.
- **The open centre stays dark by design.** It now has plates and a path, but
  it is still the quietest part of the frame — the human should judge whether
  that is calm or still empty.
- The **light pools** remain V2B's: broad and faint. The floor's material is
  revealed mostly by edges (catch, chamfer, joints), not by light.
- Judged on headless renders at canvas and phone size, not on a handset.

## 5. Tests and safeguards

- `tests/smoke-visual-pilot.mjs --old=<7a75e1e server>`: **108/108 PASS**
  (`smoke-visual-pilot.txt`). Every check runs for V2, V2B and V2C:
  - **flags** — `v2c` on; junk values off; no mode moves a gameplay switch;
  - **textures** — only `player` changes, the roster (the white Riflemen
    included) is byte-identical, and **every V2C texture is byte-identical to
    V2B's**;
  - **bodies** — the player, the swarmling and every Hangar static body, on
    the same keys as V2B;
  - **RNG** — the backdrop's `Math.random` draws and next value;
  - **backdrop** — V2C's differs from V2B's (the ground);
  - **LIGHTS OUT** — every roomLayer material class and dark tint, and every
    emissive part, as R1;
  - **other arenas** — byte-identical;
  - **replays** — seeded, identical to R1 tick for tick (SWARM TIDE and BOMBER
    RUN, both baselines, headless and rendered);
  - **frozen files** — untouched;
  - **R1, V2 and V2B identical to the `7a75e1e` build** (textures, Hangar
    backdrop, replays);
  - **restart and reload** keep each mode.
- `--selftest` (`selftest.txt`): every body check and every replay fails when
  an extra draw and larger bodies are injected, as it must.
- Covering suites, standalone, on the final code: **13/13 pass** (`suites.txt`:
  `smoke-hangar`, `-arena`, `-roster-seams` 70/70, `-title`, `-debug`, `-rng`,
  `-depth`, `-leak`, `-restart`, `-junction`, `-detention` 49/49, `-gait-v2`
  16/16, `-integration-r0` 47/47 with its `2ab24af` server).
- `npm run build` succeeds. The full 52-suite run was not repeated; it is not
  green on the previous builds either (46/52, register #9).

## 6. Performance (`tests/diag-visual-pilot-perf.mjs`, `perf.txt`)

Headless Chromium on a software rasteriser; this compares the modes on one box
and is not a phone measurement.

| | R1 | V2 | V2B | **V2C** |
|---|---|---|---|---|
| Hangar backdrop paint (one-time, median of 5) | 39 ms | 90 ms | 123 ms | **100 ms** |
| resident texture memory | 63.3 MB | 64.5 MB | 65.4 MB | **65.4 MB** |
| rendered step, staged fight (median) | 6.9 ms | 6.6 ms | 6.8 ms | **7.1 ms** |
| display-list size | 176 | 176 | 176 | **176** |

V2C is **cheaper to paint than V2B**: it replaces V2's two scratch-layer passes
(plates, wear) with one. It adds no texture and no runtime object, so per-frame
cost is unchanged by construction (the step row is the control). Phone
performance was not measured.

## 7. For the HUMAN

1. On the handset, does the Hangar floor now feel like a **walking surface** —
   steel plates, a lane, an apron — rather than a dark backdrop?
2. Is the **general deck** grid calm enough, or should its slabs vary more in
   size?
3. Is the **lane's wheel path** right in brightness, or does it pull the eye
   while fighting?
4. Should the open centre stay this quiet?
5. If the direction holds, the field / slab / wear system is spec-driven and
   could carry to other arenas — a separate decision, not started.

Deferred and not in V2C: the Super aura's red ring, banner clipping, the
player's weapons, actor shadows, protagonist detail, other arenas, G1.

## Reproduce

```bash
node tests/smoke-visual-pilot.mjs --old=http://localhost:5174/      # a 7a75e1e server on :5174
node tests/shot-visual-pilot.mjs --mode=env --configs=A,C,D --out=DIR
node tests/shot-visual-pilot.mjs --configs=A,C,D --out=DIR/lane
node tests/shot-visual-pilot.mjs --configs=A,C,D --stage=apron --ticks=120,240,360,480 --out=DIR/apron
node tests/shot-visual-pilot.mjs --mode=film --configs=A,C,D --out=DIR    # then ffmpeg hstack C | D
node tests/diag-visual-pilot-perf.mjs
```

Code: `groundC` and the `C` branches of `materialPass` in
`src/systems/vpHangar.js`; the flag in `systems/debug.js`
(`isVisualPilotV2C`); V2C's textures are V2B's (`hangarPilotTex`).
