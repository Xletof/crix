# Visual Identity V2B — material depth and contrast (`?visualPilot=v2b`)

**Status: CANDIDATE — opt-in, presentation only, awaiting the HUMAN handset
verdict. Not a default; not approved; nothing frozen.** V2B is V2's protagonist
and swarmling, unchanged, standing in a refined Hangar. V2 (`?visualPilot=v2`)
is still reachable exactly as delivered, and R1 (no flags) is untouched — both
proven texture for texture and tick for tick (below).

## Play it (GitHub Pages, deployed from `FRIX`)

| | link |
|---|---|
| R1 — production | https://xletof.github.io/crix/ |
| V2 — the original pilot | https://xletof.github.io/crix/?visualPilot=v2 |
| **V2B — this candidate** (the Hangar is the first room of a run) | https://xletof.github.io/crix/?visualPilot=v2b |
| **V2B combat demo** — SWARM TIDE in the Hangar, sector 3 | https://xletof.github.io/crix/?visualPilot=v2b&encdbg=swarmTide&room=hangar&sector=3 |
| …the same encounter under V2, for the side-by-side | https://xletof.github.io/crix/?visualPilot=v2&encdbg=swarmTide&room=hangar&sector=3 |
| V2B, BOMBER RUN (Demolishers, Riflemen, a Gunner) | https://xletof.github.io/crix/?visualPilot=v2b&encdbg=bomberRun&room=hangar&sector=4 |

## 1. What was visually wrong with V2 (measured, not guessed)

Luminance 0–255, from the V2 textures and the evidence frames:

- **Machinery sat at or below the deck.** Shuttle median 30, gantry 32,
  consoles 19–26, against a deck of ~35. Dark on dark, held apart only by a 1px
  outline that disappears at the phone's 0.54x — so in the V2 phone frames the
  shuttle, the gantry and the consoles read as darker patches of floor.
- **The V2 crate had no top.** Lid 75 against face 61 (1.2x), and the
  brightest pixels on the object (the amber bands, ~120) were on the FACE: the
  eye read horizontal stripes, not a top plane over a vertical side.
- **Shadows were height-blind and faint.** One offset silhouette per object at
  alpha 0.34 (a ~12-level drop on the deck), the same 16x12 px for a crate and a
  console, 28x16 for the shuttle and the gantry.
- **The large forms did not separate.** The staging bay (declared recessed in
  the room spec) and the three deck plates were the deck's own value; the walls
  darkened the deck uniformly on all four sides, so nothing said where the light
  came from.
- **What already worked and is kept:** the quiet deck (no blotches, faint
  plates, lane wear), the light pools, LIGHTS OUT, the track, and the V2 cast.

## 2. What V2B changes (Hangar only; everything else is V2)

| object | V2 | V2B |
|---|---|---|
| **Crates** (5 cover) | lid 75 / face 61, two bands across the face | re-planed: an 8-row lid at **106**, a bright **lip at 147** where it turns down, a ribbed face at **41** (a 2.6x step), one darker amber band on the face only; selective outline kept |
| **Consoles** (3 cover) | original + 1px top bevel and outline | **a lit top plane (49 → 82) over the unchanged dark face (20)**, a deeper base, a cool rim on edges facing the north-west sun, lit lips under recessed joints, darkened edges facing away |
| **Shuttle** (landmark) | unchanged art | a restrained rim on its OUTER north-west edges only (no seam lips: that read as a blueprint outline, the failure the arena doctrine warns about) |
| **Gantry** | unchanged art | rim, shade and the cover outline; lit for its flipped placement |
| **Drums, wall panel** | outline / unchanged | relief (drums symmetric: one texture is placed both ways) |
| **Cast shadows** | one offset silhouette | **projected by height**: each column of a sprite throws its face as a slanted run and its top plane lifted by its real height, so a crate throws a short block, a console a wedge, the gantry long leg and beam bars; a tight dark **contact** row under every foot; the **shuttle displaced whole** (it stands on its gear) |
| **Walls** | uniform 72px darkening on all sides, faint coping | **directional**: the north and west walls cast an 80px stepped shadow onto the deck; the south and east keep a 20px contact line; a crisper lit coping |
| **Deck forms** | the deck's value | the **staging bay** reads recessed (the deck lip throws a stepped shadow into it along its north / west edges, its far edges catch light); the **three deck plates** become a second metal — tread plate, a shade cooler and darker, with a raised lit / dark bevel |

All on the same canvases and the same bodies; the shuttle's two ADD faces, every
console's kit light and every static body register exactly as before.

## 3. Why this reads as physical depth

- **One sun, everywhere.** North-west, as every sprite in the roster is lit:
  lit tops and north / west edges, dark east / south edges, shadows to the
  south-east — on the crates, the consoles, the machinery, the walls and the
  floor forms alike. Depth reads when everything agrees where the light is.
- **Planes by value, not by line.** A top plane is lighter than the face under
  it by a factor the eye cannot miss at 0.54x (crate 2.6x, console 4x), and the
  break between them is the brightest line on the object (the lip).
- **Dark machinery gets light on its edges, not lightened.** The housings stay
  dark and heavy; a cool rim on the edges that face the sun, and a darker edge
  on the ones that do not, is what separates them from a dark deck.
- **Shadows carry height.** Contact (touching here), cast (how tall, which
  way), offset (off the deck) are three different marks. A crate and the gantry
  no longer throw the same shadow, so mass is legible from the floor alone.
- **The floor stays quiet.** The deck itself is V2's; V2B adds only large,
  low-contrast forms the room spec already declares (a recess, three plates).

## 4. Is it visible at phone size? Specific comparisons

See `compare/*-phone.png` (0.54x, a 390pt handset):

- `env-bay-phone`: every V2B crate shows a distinct light lid over a dark face
  and a dark shadow block to its south-east; in V2 the same crates are olive
  patches with stripes. The staging bay's north / west edges are visibly lower.
- `env-lane-phone`: both V2B consoles show a light top over a dark face and a
  cast wedge to the right; in V2 they read as flat terminals.
- `env-apron-phone`: the V2B gantry has solid legs and throws long slanted
  shadows across the tread plate; the shuttle's leading edges are lit and its
  shadow sits clear of the hull; the west wall's shadow lies along the deck.
- `fight-lane-400-phone`, `fight-apron-480-phone`: the same frames in combat —
  the characters, bolts and telegraphs are as legible as in V2 (the floor around
  them is the same deck), while the cover and machinery around them stand up.

The improvement is clearly visible on cover, consoles and the gantry at phone
size. It is **moderate on the shuttle** (a rim and a shadow on a dark plan-view
hull) and **deliberately absent from the open deck** in the middle of the fight.

## 5. Remaining visual weaknesses

- The open deck in the middle of the fight is still a uniform dark field — by
  design (it is where bolts must read), but it is the largest area in the frame.
- The **shuttle** is still the darkest large object; making it read harder would
  mean lightening the hull or adding emissive detail (a frozen-landmark decision).
- **Actor shadows** are the shared `shadow` texture, unchanged; the actors now
  stand among objects with stronger shadows than their own.
- The **wall band** art (blast door, racking, pillars) is untouched apart from
  its coping and the shadow it casts.
- **Long gantry shadows** cross the south-west tread plate; they are translucent
  and never touch a lane's collision, but the human should judge them in motion.
- The tread-plate lattice is 2px detail — a tone at phone size, a texture at 1x.
- Everything is baked; LIGHTS OUT multiplies it with the floor (as the room
  always did), so the dark state is unchanged rather than re-authored.
- Judged on headless renders at canvas and phone size, not on a handset screen.

## 6. Technical safeguards and results

- `tests/smoke-visual-pilot.mjs --old=<bcd22e3 server>` on the final code:
  **74/74 PASS** (`smoke-visual-pilot.txt`), every check run for V2 AND V2B:
  the flag grammar (`v2`, `v2b`, junk values off; neither moves a gameplay
  switch); textures (only `player` changes; V2B adds exactly its `vp-swarm` +
  `vp2b-*` set; the white Riflemen and the whole roster byte-identical; V2B's
  protagonist and swarmling byte-identical to V2's); bodies (player, swarmling,
  every static body in the Hangar); the backdrop's `Math.random` draws and next
  value; LIGHTS OUT (every roomLayer material class and dark tint, every
  emissive part, as R1); the other three arenas byte-identical; seeded replays
  identical to R1 tick for tick (SWARM TIDE and BOMBER RUN, both baselines,
  headless and rendered); frozen files untouched; **R1 and V2 identical to the
  `bcd22e3` build** (textures, Hangar backdrop, replays); a scene restart and a
  page reload keep the mode.
- `--selftest`: every body check and every replay FAILS when an extra draw and
  larger bodies are injected — 46/60, "SELFTEST OK". The new LIGHTS OUT check
  was A/B'd separately: it fails when one crate's material class is altered.
- Covering suites, standalone: **13/13 pass** on `c37a568` (`suites.txt`); the
  final commit `b4ad9c4` changes only V2B-flagged texture content, which the
  final gate re-proved inert for R1 and V2. `npm run build` succeeds.
- The full 52-suite run was not repeated; it is not green on the previous build
  either (46/52, register #9).

## 7. Performance (`tests/diag-visual-pilot-perf.mjs`, `perf.txt`)

Headless Chromium, software rasteriser: a comparison between the modes on one
box, not a phone measurement.

| | R1 | V2 | V2B |
|---|---|---|---|
| Hangar backdrop paint (one-time, room load, median of 5) | 46 ms | 96 ms | 134 ms |
| resident texture memory | 63.3 MB (158) | 64.5 MB (165) | 65.4 MB (168) |
| rendered step, staged fight (median / p95) | 7.1 / 518 ms | 6.8 / 550 ms | 6.9 / 522 ms |
| display-list size | 176 | 176 | 176 |

V2B adds **no runtime display object** — shadows and relief are baked into the
backdrop and the textures — so per-frame cost is unchanged by construction (the
step row is the control). The cost is one-time: ~40 ms more than V2 to paint the
Hangar here (expect a multiple of that on a phone, at a room transition), and
~0.9 MB more textures than V2. Phone performance was not measured.

## 8. Evidence

All pairs and triples are the SAME seeded fight, tick and camera (the rig
compares player, enemies, bullets and the draw count at every shutter and every
film frame, and refuses otherwise).

- `compare/env-{bay,apron,lane,east,dark}-phone.png` — R1 | V2 | V2B, the empty
  Hangar at four stations and LIGHTS OUT.
- `compare/fight-lane-{180,300,400,560}-phone.png`,
  `compare/fight-apron-{120,240,360,480}-phone.png` — two staged fights: the
  lane (crates, consoles, Riflemen, swarm packs) and the apron (a dark Gunner by
  the consoles, a Bulwark by the gantry, swarm packs round the shuttle), with
  real bolts, telegraphs, damage numbers and streak text.
- `compare/*-detail-1x.png` — V2 | V2B at canvas pixels; `compare/cast-lineup-1x.png`.
- `detail/crate-2x`, `console-2x`, `shuttle-1x`, `gantry-1x`, `bay-edge-1x` —
  how each material is built.
- `sprites/cover-fixtures-2x.png`, `sprites/machinery-1x.png` — the textures.
- `film/r1-v2-v2b-{lane,apron}-phone-size.mp4` — R1 | V2 | V2B, 6 s each,
  real presentation; `film/v2-v2b-{lane,apron}-detail-1x.mp4`. 181 frames per
  mode, every frame state-checked (`film/states-film-*.json`).
- `frames/` — the full-resolution frames behind the sheets.

## 9. For the HUMAN

1. Does V2B read as **built from metal** on the handset — crates and consoles
   standing up, the gantry tall, the bay lower — while the fight stays as
   readable as V2?
2. **Shadow length and direction** (a low north-west sun): right, too long on
   the gantry, or too short on the crates?
3. **Tread plate as a second metal**: keep, quieter, or drop?
4. **The shuttle**: is a rim and a displaced shadow enough for the landmark, or
   should a later pass lighten its hull (it is frozen art)?
5. If the direction holds, the relief and shadow system is texture-driven and
   would carry to the other arenas — a separate decision, not started.

Deferred and NOT in V2B (recorded): the Super aura's red ring, banner clipping,
the player's weapon presentation, protagonist detail, other arenas, G1.

## Reproduce

```bash
node tests/smoke-visual-pilot.mjs --old=http://localhost:5174/      # a bcd22e3 server on :5174
node tests/shot-visual-pilot.mjs --mode=env --out=DIR                # A,B,C by default
node tests/shot-visual-pilot.mjs --out=DIR/lane
node tests/shot-visual-pilot.mjs --stage=apron --ticks=120,240,360,480 --out=DIR/apron
node tests/shot-visual-pilot.mjs --mode=film --out=DIR               # then ffmpeg hstack
node tests/diag-visual-pilot-perf.mjs
```

Code: `src/systems/vpPaint.js` (`paintPilotCrateB`, `paintReliefPass`),
`src/systems/vpHangar.js` (`HANGAR_PILOT_TEX_V2B`, the `B` branches of
`materialPass`, `floorRelief`, `castShadowsB`), `src/systems/visualPilot.js`
(which set is painted), `systems/debug.js` (`isVisualPilotV2B`), one argument
in `GameScene.loadRoom`.
