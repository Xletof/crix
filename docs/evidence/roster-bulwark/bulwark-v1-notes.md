# Bulwark production integration (`shielded`) — candidate for handset review

**Flags:** `?roster=v1` (body, sidearm, field) and `?gait=v2` (the shuffle). Without
`?roster=v1` the Bulwark is exactly the legacy one. Nothing is a default.

**Status:** CANDIDATE. Not human-approved. Presentation only — every gameplay value
is the frozen one, and `src/entities/Enemy.js` is **untouched**.

## Architecture

| piece | where | what it is |
|---|---|---|
| body + sidearm art | `src/systems/rosterPaint.js` (appended section) | `ro-blw-R`, `ro-blw-E` (33 frames stock, 51 under `?gait=v2`), `ro-w-blw-R`, `ro-w-blw-E`; `BULWARK_GAIT`; `BULWARK_CORE`; `GAIT_CYCLE_PX['ro-blw'] = 40` |
| registration | `src/scenes/PreloadScene.js` | `registerRosterArt('shielded', …)`, the 18 animation keys per tier, the sidearm discharge texture |
| hook | `src/data/rosterArt.js` → `wearRosterArt` | `art.bulwark`: sets `_rosterFx = 'sidearm'`, `_weaponFx = makeSidearmFx(e)`, `_curtain = makeBulwarkCurtain(e)` |
| sidearm firing | `src/systems/bulwarkSidearm.js` (new) | cold READY pip on the frozen 300ms warning, a 1-frame cold-white discharge, a 1px / 50ms kick, render-only undo of the shot squash |
| the field | `src/systems/bulwarkCurtain.js` (new) | scene-side renderer on `POST_UPDATE`; per bearer: 2 material Graphics (near/far) + 2 ADD light Graphics + 1 ADD core, all on the bearer's `_attachments` |
| block / pierce routing | `src/scenes/GameScene.js` (the block branch only) | `e._curtain.block(contact, x, y)` instead of the legacy clang + sparkle; `e._curtain?.pierce(contact)` after `onPierce` |
| contact radius | `src/systems/shieldContact.js` | `CURTAIN_RADIUS = ENEMY.shielded.radius + 22` = **46 for both tiers** (it was 55 for the Elite) |

The frozen seams do all the gameplay talking: `_shieldFacing`, `_shieldHalfArc`, the
2.6 rad/s turn, `isFrontalHit`, and the contact `GameScene` projects onto the curtain
**after** the block is decided. The renderer reads them and writes nothing back. It
owns no timer, no tween, no randomness.

## Is `Enemy.js` untouched?

**Yes.** `git diff 3ce5680 -- src/entities/Enemy.js` is empty, and the base class is
byte-identical to `6560c62`; `smoke-roster-2b`, `smoke-roster-gunner` and
`smoke-bulwark` all check that. Nothing needed it.

- The legacy arc is hidden with `shieldArc.setVisible(false)`. The frozen class still
  draws it every frame; it is just never shown.
- The sidearm warning reuses the existing `_weaponFx` hook.

## Body

- **Regular:**
  - the broadest body in the roster: a 12-wide chest under two chamfered 4x4 pauldrons;
  - pale steel-blue plate (`#c3d1e7 / #92a6c7 / #64799a / #455672`) over a dark undersuit;
  - an angular wedge helmet: a flat crown, full-width cheeks, two face planes converging
    to a pointed chin either side of a vertical ridge;
  - ONE uninterrupted, unlit, cold visor slit (`#22364f`). No eyes, no face lights, no
    crest, no dome;
  - the projector gauntlet on the LEFT forearm with an ice-white emitter core;
  - the sidearm hand on the RIGHT;
  - a graphite generator on the back with a cold slot.
- **Elite:** the same body, helmet and face, plus:
  - a 6x5 gauntlet with a ringed 2x2 core;
  - a steel brace up the projector arm;
  - a conduit from the yoke to the projector;
  - a finned, larger generator housing;
  - a steel reinforced yoke.

  Its front silhouette is within 1 logical px of the Regular's (the brace). It has no
  tint and renders at scale 1. It keeps its **historical collider: 92.4px wide, radius
  33**; the Regular is 48px, radius 24.
- **The projector arm does not bob.** The gauntlet is painted against the base
  coordinates, so the torso settles over it while it holds still under the still
  field. `smoke-bulwark` checks that the core pixel sits at `BULWARK_CORE` on every
  front and side frame.
- **Mirroring:** the facings follow the existing mirror architecture. The west facing
  is the east one mirrored, so the projector stays on the far side and the sidearm on
  the near side.

## Sidearm and muzzle alignment

- **What it is:** a 28px pistol (7 gun pixels) in a gloved hand, at the end of an
  armoured forearm. The overlay is 60px long (Elite 68: the forearm is 8px longer at
  the back because the Elite's pivot sits 9px further out). For comparison, the carbine
  is 68px and the Gunner's weapon 84px.
- **Muzzle — maps honestly:** the drawn muzzle is `muzzlePastPivot(700) = 54px` past the
  pivot.
  - Measured: **74.0px** from the body centre against the bolt's first-drawn leading
    edge at **73.5** (Elite 83.0 against 82.5).
  - This holds on the bolt axis at 8 bearings × 2 tiers, including the flipped west.
  - The gameplay spawn (`cfg.radius + 4`) sits inside the weapon, and the overlay
    starts 14px out from the centre, so it never crosses the visor.
- **Known, frozen, and inherited from legacy:**
  - The gun is drawn on `_aim`, which this class sets to the SHIELD facing. The bolt
    flies at the player.
  - When the shield is still turning, the two differ. Measured at the moment of firing in
    two seeded VANGUARD replays: median **0°** in both, p90 **9.9°** / **0.5°**, and max
    **22.1°** / **97.3°**. The max is a player circling a held shield at the 140px close
    hold, faster than its 2.6 rad/s turn.
  - That is gameplay (the gun tracks the shield) and was not touched.
- **Firing language:**
  - A cold pip warms pale blue to white over the legacy 300ms warning (replacing the
    whole-gun orange tint).
  - Then a 4x3 cold-white / pale-blue discharge for one drawn frame plus 30ms of decay,
    and a 1px kick.
  - No bloom, no rotor, no body bob.
  - The projector is not the muzzle.

## Gait v2 — the heavy tactical shuffle

- **Anatomy:**
  - one pelvis; hip sockets 6 columns apart (the other roles: 4);
  - 3-column armoured legs with a lit knee plate;
  - 4px boots, both pointing the facing direction;
  - the far leg darker and allowed to vanish.
- **Stride:**
  - Compact: profile feet within +2/−3 of the hip.
  - A LOW swing: the travelling foot clears the deck by one row ('L'), never the full
    swing.
  - A planted foot on every walk frame.
  - Weight moves one column and one row, on the two load frames only.
- **Cadence:** the cycle is 40px of real travel. The planted foot slides 5 logical px
  per step, and the shared `rosterGait.js` tick drives it from real displacement. That
  is about 21 frames/s at 140px/s, under the 24 cap.
- **Measured motion relative to the displayed facing:** see the table at the end
  (`tests/diag-bulwark-gait.mjs`). The Bulwark mostly advances or stands. The existing
  walk / backwards-walk / strafe selection covers it with no new mode and no new AI.

## The field — frosted hard-light curtain

- **Shape:**
  - The arc is exactly facing ± `_shieldHalfArc` (1.35 rad).
  - Both rims taper to ONE point at each end, on the curtain radius, at exactly the
    coverage bearing.
  - It is built from 10 flat panels, each a slightly different milky value.
  - The bright ice-white rim is on the OUTER edge (the face the fire arrives at); the
    inner rim is soft.
  - A restrained dark keyline sits just outside the bright rim.
  - Two slow counter-running sheens are the interference.
  - The cross-section is a short raised band: outer rim R+6 / 2px down, inner R−6 /
    5px up.
  - A first build put the bright rim on the inner, upper edge, and from the front it
    read as a tub he was standing in.
- **Depth:**
  - Panels south of his centre draw over the body and the sidearm (y+2). Panels north
    of it draw under the body (y−2), at half strength with a faint rim.
  - So the back view is a soft band behind him rather than a canopy, and the side view
    is a curved plane.
  - The field follows the body centre and the shield facing — never the walk cycle.
- **Tiers:** identical. Nothing in the field module reads `_elite` except where to put
  the core glow. Regular and Elite rim vertices match exactly.

## Block events

- **What an event is:** each block is its own event `{ kind: 'block', off, t }` in a
  bounded per-field list (max 12). `off` is the contact's angular offset from the
  facing, so a reaction stays on the surface while the shield turns.
- **Storage:** not the single overwritten `_lastBlockContact`. `GameScene` hands
  every contact to `_curtain.block()`. Ages run on the field's own clock, advanced by
  the frame delta in `POST_UPDATE`, and an event drops at 720ms.
- **The sequence:**
  1. A compressed red-hot smear is laid along the surface: short and thick on contact,
     spreading and thinning over ~130ms, with a white-hot core line.
  2. A 5px inward dent: 35ms in, ~100ms out, no overshoot.
  3. Red energy floods the band at the contact from ~25ms and sheds two fronts that
     travel outward (±0.4 rad) and widen.
  4. The colour ramps by age: red → coral → pale pink → white. The contact cools first.
  5. A white haze relaxes to idle by ~700ms.
- **Rapid hits:**
  - Energy is sampled at every vertex: intensities add, and colours mix weighted by
    intensity squared. The panels are drawn as vertex-coloured triangles.
  - So a fresh red front next to a whitening patch passes through pink rather than
    switching on a pixel edge.
  - It is never a whole-field flash, and there are no particles.
- **Gameplay isolation:** presentation only. Nothing waits on these events, and nothing
  reads them back.

## Super events, and the multi-pellet decision

- **Recording:** every pellet through the front is recorded: `GameScene` calls
  `_curtain.pierce(contact)` for each one. The frozen `_lastPierceContact` is still
  written and still overwritten, untouched.
- **Coalescing (chosen):** one readable hole per volley.
  - The first pellet opens THE tear.
  - A pellet arriving while the tear is still opening (<120ms) and within 0.3 rad of it
    **merges**: the gap widens by 3px per pellet, capped at 18px.
  - A more CENTRAL pellet arriving in the first 50ms **takes the hole**, and the outer
    one becomes a pinprick. The first pellet to cross the body is often an outer one,
    and the hole should be where the volley went through.
  - Every other pellet while a tear is live is a **pinprick**: a small bloom and a 4px
    pinhole that heals on its own in 260ms, max 3.
  - So the contact data of every pellet is used, but never as five holes.
- **The beats (ms):**
  - 0-140: white bloom, ADD, largest faintest.
  - 0-80: the field splits; the edges peel 7px outward with white-hot torn edges.
  - 80-420: the gap holds open (13px half-gap).
  - 420-600: the edges pull in; three white-blue filaments re-knit across.
  - 540-600: the zipper closes the last of the gap from the outer rim up.
  - 600: a compact snap (seam line + flash) and one restrained projector-core pulse.
  - 600-900: a recovery ripple travelling outward.
  - Settled by ~920ms. There is no red phase.
- **Why it is long:** a real Super arrives under the frozen generic hit language (the
  body's white hit flash, the pellet rings, CRIT numbers), which owns roughly the first
  250ms. The first build's gap was already closing by the time the frame was readable.

## Legacy FX suppression, and RNG parity

- **Suppression:** under v1, a Bulwark block does NOT call `fx.impactRing(…0x50b0ff)` or
  `fx.healingSparkle(…6)`. The field is the one author.
- **Parity:**
  - The legacy sparkle is a particle emission, and particles draw from `Math.random`,
    the stream the AI cooldowns use. Skipping it would shift every random number after
    the first block.
  - So the v1 path emits the **identical** 6-particle emission into an **invisible twin**
    of that emitter, built from the live emitter's own `config`.
  - Measured: 195 draws in both modes across six blocks.
  - **A/B:** with the parity emission removed, the seeded VANGUARD replay diverges at
    checkpoint 20, and the shot count goes from 40 to 39.
- **Legacy mode:** still draws the clang and the sparkle on every block (6 / 6).

### A second leak, found by the A/B video: an ELITE's death

- **How it was found:** the first A/B render reported the same fight at only 17 of 22
  checkpoints. A call-site histogram of `Math.random` across the divergent window
  pinned it to the frozen kill juice (`enemy-died`).
- **The cause:**
  - The kill juice sizes its particle burst (and glow, explosion and shake) by
    `enemy._baseScale`.
  - A v1 Elite renders at 1.0 against legacy 1.4, so its death emitted 10 fewer
    particles and made fewer random draws: Bulwark Elite 256 → 236.
  - The fight diverged after the first Elite died.
  - The earlier replay missed it because no Elite died in its window.
- **The fix (Bulwark only):**
  - `_makeElite` gives a v1 Bulwark Elite `_threatScale = 1.4` (its GAMEPLAY elite
    scale), and the kill juice reads `_threatScale || _baseScale`.
  - Its death is now the legacy death: 256 = 256 draws, the legacy-sized burst.
  - `smoke-bulwark` now checks death draws per tier, and the VANGUARD replay uses the
    A/B script, in which an Elite Bulwark dies.
- **PRE-EXISTING and NOT changed (frozen roles):**
  - The Gunner, Rifleman and Marksman Elites carry the same divergence since roster
    Phase 1: Gunner E 235 vs 195, Rifleman E 225 vs ~200 draws.
  - In practice: under `?roster=v1`, any fight in which one of their Elites dies stops
    being draw-for-draw identical to legacy from that death on.
  - Fixing it is one line (set `_threatScale` for every v1 elite) but changes the frozen
    roles' v1 death juice, so it is the human's call.

## Gameplay invariance (smoke-bulwark, 59 checks)

- **Units:** hp, radius, body width and centring, speed, half-arc 1.35, turn 2.6,
  cadence 1500, bolt 700 / 120 / 520, and desired range 260 are identical legacy vs v1
  for both tiers.
- **Seeded VANGUARD replays** (case A, sector 8, wave 2, 1320 ticks; the A/B video's own
  script: hold while the front forms, fire into the shields, strafe, Supers at ticks 900
  and 1240; one Elite Bulwark dies in the window). Both **legacy vs `?roster=v1`** and
  **`?roster=v1` vs `+gait=v2`** are the same fight at all 88 checkpoints, matching on:
  - positions, velocities, AI state, aim, **shield facing**, screen hold, lanes,
    cooldowns, hp, collider;
  - player hp **and Super meter**;
  - the **VANGUARD front** (released / reason / time — released on `timeout` in this
    seed), **queue length and events spawned**;
  - live enemy bolts and every random draw.

  The same shots fire on the same ticks. The v1 fields absorbed 19 blocked bolts and 14
  Super pellets across 6 Bulwarks in that run, so the comparison is not vacuous.
- **Seams:** the frozen seam still records the contact, and blocks still do no damage
  and give no meter.
- **Deaths:** a Bulwark's death makes the same random draws legacy vs v1 (Regular 205,
  Elite 256).

## Tests

- `tests/smoke-bulwark.mjs` (new, standalone like the other roster smokes): **59/59**.
- Amended deliberately:
  - `smoke-roster-2b`: it asserted the Bulwark stays on legacy art; it now asserts
    neither 2B firing cycle attaches to it.
  - `smoke-roster-seams`: `V1_ROLES` gains `shielded` / `shielded+E`.
- Regression results: see the session summary / commit message.

## Handset URLs (Pages, after the FRIX fast-forward)

1. **Isolated Bulwark (VANGUARD without the Captain):**
   `?roster=v1&gait=v2&move=v22&encdbg=vanguard&room=hangar&sector=8&wave=2&nochamp=1`
2. **VANGUARD case A (with the Captain):**
   `?roster=v1&gait=v2&move=v22&encdbg=vanguard&room=hangar&sector=8&wave=2`
3. **CROSSFIRE + Captain (regression control, frozen):**
   `?roster=v1&gait=v2&move=v22&encdbg=1&room=hangar&sector=16&wave=3`
4. **Legacy comparison:** `?move=v22&encdbg=vanguard&room=hangar&sector=8&wave=2`
5. **Without the gait (stock walk):** `?roster=v1&move=v22&encdbg=vanguard&room=hangar&sector=8&wave=2`

## What is still weak at 1x

- **A full Super usually KILLS a Bulwark, so the tear is rarely seen in play.**
  - At sector 8 a Regular has 918hp and a Super pellet does 600 × dmgMult; two pellets
    kill it. The field goes with the body on death, exactly as the legacy arc did.
  - The tear / re-knit therefore plays mostly on Elites, on glancing Supers (1-2
    pellets), and at higher sectors.
  - The super strip and video use an Elite at the sector-14 hp ramp (the real
    formula), from 300px, where three pellets connect and it survives.
- **The first ~250ms of a real Super belong to the frozen generic hit language.** The
  white body flash, pellet rings and CRIT numbers sit on top of the bloom and split. The
  OPEN / HEAL half is what reads.
- **Blocked bolts visibly reach past the field before they die.** Gameplay kills them at
  body overlap, ~17px inside the curtain (1-2 frames of travel). Predictive hiding was
  deliberately NOT added — for the human to judge.
- **Back view:**
  - A north-facing shield is drawn above his head (this projection puts the combat
    plane there). It is softened (half strength, faint rim, under the body), but it is
    still an arc behind the helmet.
  - The sidearm pointing north also shows above the head, as every role's weapon does.
- **Profile:** the legs are 2px in profile under a broad torso; heavy, but the side
  figure reads top-heavy.
- **Sidearm vs shield lag:** see above — usually 0°, occasionally large when the player circles a held shield; frozen gameplay.

## Measured Bulwark motion (`tests/diag-bulwark-gait.mjs`)

(filled in below from the run)
