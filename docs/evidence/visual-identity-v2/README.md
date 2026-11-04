# Visual Identity V2 — look-development pilot (`?visualPilot=v2`)

**Status: CANDIDATE — opt-in, presentation only, awaiting the HUMAN handset
verdict. Not a default; nothing here is approved.** Authorized 2026-11-04
(`docs/handover/CRIX-SESSION-HANDOVER-2026-11-04.md` §3–§4). With no flag the
game is the R1 production presentation exactly — proven texture for texture
and tick for tick against the previous build (`d05ac13`).

## Play it (GitHub Pages, deployed from `FRIX`)

| | link |
|---|---|
| 1. Current R1 production presentation | https://xletof.github.io/crix/ |
| 2. Visual Identity V2 in the Hangar (the first room of a run) | https://xletof.github.io/crix/?visualPilot=v2 |
| 3. Combat demo — SWARM TIDE in the Hangar, sector 3 (swarm packs + white Riflemen) | https://xletof.github.io/crix/?visualPilot=v2&encdbg=swarmTide&room=hangar&sector=3 |
| 3a. …the same encounter without the pilot, for an A/B on the handset | https://xletof.github.io/crix/?encdbg=swarmTide&room=hangar&sector=3 |
| 3b. BOMBER RUN in the Hangar (Demolishers, Riflemen, a Gunner) | https://xletof.github.io/crix/?visualPilot=v2&encdbg=bomberRun&room=hangar&sector=4 |

`encdbg` shows its small debug panel (PREV / NEXT / REPLAY), as on every
encounter bookmark. The pilot composes with `?baseline=legacy` and every
gameplay flag; it changes none of them.

## What changed — with the flag on, and only then

| | R1 production | V2 candidate |
|---|---|---|
| **Protagonist** (`player` key, every room, Title / Intro portraits) | 24x24 sheet at 4, no outline: a mid-grey beskar scatter with floating feet and a black cape at the deck's own value | 24x26 sheet at 4 on the SAME 24-frame contract and `mando-*` keys: dilated outline (the roster's), an 8-wide helmet with a true T-visor and one cyan glint, rounded pauldrons, twin chest plates, warm flight suit, tan belt and pouches, umber cape, jetpack with two cyan thruster lamps (back / profile), boots and knee plates |
| **Swarmling** (`swarmling` only, every room) | the legacy `grunt` trooper sheet x tint `0x70e838` at 0.7 — a small green stormtrooper with 2.8 px pixels (and a WHITE one after any hit, because `fx.hitFlash` clears tints) | `vp-swarm`, a skitter drone: low armoured carapace in baked acid green, a forward chevron marking, four splayed legs, two shear-blades, one yellow-white eye; 15x14 painted at 6 so that at the SAME 0.7 render scale its pixels land at ~4.2 px, the cast's grain |
| **Hangar floor** (`backdrop-hangar`) | gunmetal deck, hex tiling at 0.30, 50 random black discs (`scorch`) | the same backdrop options except: hex at 0.135, no discs (their 150 `Math.random` draws are burned, see below); then a material pass — running-bond deck plates with recessed seams (dark groove, lit S/E lip), plate-to-plate value variation, a lowered deck with four faint overhead light pools, stepped wall-foot occlusion and a lit wall coping (doorways skipped), lane polish and tyre marks, drag scuffs at the freight, oil stains, five deliberate blaster scars, chipped deck paint, and a CAST SHADOW for every cover object and solid prop (its own silhouette offset SE by its height) plus a hard contact line |
| **Hangar cover / drums** | `ch-crate-a/b`, `ch-con-ped-c`, `ch-con-heavy`, `prop-drum(-b)` | `vp-crate-a/b` repainted (three planes pushed apart, worn amber band, grime, selective outline); consoles and drums are the originals plus a material pass (selective outline: base and sides, never the lit top; a one-pixel top bevel) — every source pixel where it was, so each `CONSOLE_KIT` light still lands on its screen; all on the same canvas sizes |

## What did not change (proven, `tests/smoke-visual-pilot.mjs`)

- **Every texture the flag-off game paints, except `player`** — byte-identical
  under the flag: the white Rifleman (`ro-rif-*`) and every roster V1 sheet,
  weapons, projectiles, FX, Vader, the Captain, the nemesis sheets, the shuttle,
  the crane, the wall panel, every other room's kit.
- **Bodies.** The player circle (at rest and under the breathing / recoil
  scales), the swarmling circle and its 0.7 render scale, every static body in
  the Hangar — identical.
- **RNG.** Loading the Hangar under the pilot takes the same `Math.random`
  draws and leaves the same next value; every replay's per-tick draw count is
  identical. The pass uses its own seeded generator.
- **The fight.** Seeded replays — player, camera scroll, every enemy's
  position / hp / body, every bullet, the draw count, every tick — identical
  flag on vs off (SWARM TIDE and BOMBER RUN, production and legacy baselines,
  headless and rendered), and the no-flags game identical to `d05ac13`.
- **The other three arenas**: backdrops byte-identical, original cover keys.
- **Frozen files**: no diff against `d05ac13` in `src/entities/`, `config.js`,
  `src/data/`, `pixelArt.js`, `rosterPaint.js`, `CameraDirector.js`,
  `EnvLight.js`, the AI seams, `NavGrid.js`; the Enemy.js guard holds.
- Camera framing, AI, encounter composition, LIGHTS OUT mechanics, room
  geometry, collision, cover legality, the HUD.

## Art direction — the reasoning

**The hierarchy the brief asked for, as a value plan.** (1) The ground is the
darkest, lowest-contrast layer and textured only at a scale you see when the
frame is paused. (2) Cover and machinery are mid values with their planes
pushed apart and a shadow that says how tall they are. (3) Characters carry the
full dark outline and the highest local contrast. (4) Active threats —
bolts, telegraphs, saber, explosions — keep the saturated emissive range
entirely to themselves. The pilot paints nothing in (4).

**One outline policy across the frame.** Actors: the roster's dilated 1px
`#06070a`, full silhouette. Cover: SELECTIVE — base and sides only, the lit top
edge left open, so it reads heavy and grounded but never as a character. Floor:
none. A black border on everything would have flattened the hierarchy into
stickers; this keeps "who is a combatant" answerable at a glance.

**One sun.** North-west, as every sprite in the roster is lit: lit tops and west
edges, dark east edges, cast shadows to the south-east, lit lips on the
south/east walls of a recessed seam.

**The protagonist.** In play the shipped Mando disappears into the gunmetal
deck: no outline, nothing brighter than a Rifleman's shadow side, and a black
cape at the floor's value. The only thing that said "you" was the ring — and
the ring turns red-orange when the Super charges (below). V2 identifies him in
order of distance: the SILHOUETTE (the widest shoulder line in the cast, a big
helmet, the jetpack that is his whole back view), the MATERIAL (the only
polished, specular, slightly blue metal over a warm suit — a Rifleman is flat
white plate, a Gunner matt graphite, the Bulwark grey mass), and the TELL (a
T-visor with one cyan glint and two cyan thruster lamps — the player's colour,
spent as pixels rather than rings). Proportions follow the roster (big helmet,
compact torso, short legs, 4 px grain) so he belongs to the same game; mass and
contrast make him the lead.

**The swarmling.** Its role is fast, fragile, comes in a pack and closes to
melee, and an upright soldier says none of that. A low, wide crawler is the only
horizontal silhouette among the ordinary enemies, so a pack reads as a pack — a
scatter of low shapes under a crowd of upright ones — before any detail does.
The green stays (it is what the human calls them), baked rather than tinted, so
a hit flash can no longer turn it into a white trooper. The eye and the blades
point where it is going.

**The Hangar.** Quiet but textured ground: the random black discs read as holes
and landed in the calm centre as often as not; the hex tiling is a sci-fi
cliché at hangar scale. A deck that is BUILT (plates, seams, fasteners) and worn
where work happens (the lane, the freight, under the machines) replaces both.
Convincing mass: the cheapest proof that something stands up is the shadow it
throws, so the shuttle's wings, the gantry beam, every crate and console cast
their own silhouettes onto the deck. Light: the deck between four overhead pools
drops a step, so the pools read by contrast rather than by lifting the room's
average value — the middle of the fight is where the frame is brightest.
Rules kept: no red (wear is brown-black; paint is the room's own amber), no
small green points, no tall solid mass, shapes on horizontals, verticals and
45-degree cuts.

## Evidence

All A/B pairs are the SAME seeded fight (the rig compares player, enemies,
bullets and the draw count at every shutter and refuses otherwise), the same
tick and the same camera. `phone` = scaled to 0.54, the size a 390pt-wide
handset shows the 720x1280 canvas.

- `compare/fight-{180,300,400,560}-phone.png` — the staged fight: hero, two
  then three swarm packs, white Riflemen, a Gunner, Marksman, Bulwark and
  Demolisher, real bolts, telegraphs, damage numbers, kill streak text.
- `compare/fight-{180,400,560}-detail-1x.png` — 1x canvas crops of the same.
- `compare/cast-lineup-1x.png` — the whole cast standing on the deck, rendered
  by the game at 1x: the V1 roster identical, hero and swarmling V2.
- `compare/env-{apron,lane,bay,east}-phone.png`, `env-{apron,lane,bay}-detail-1x.png`
  — the empty Hangar at four stations (HUD hidden).
- `compare/env-dark-phone.png` — LIGHTS OUT forced to full dark: the
  composition is unchanged; the pass goes out with the backdrop.
- `sprites/hero-sheets-2x.png`, `swarm-sheets-2x.png`, `cover-kit-2x.png` —
  every frame, before and after.
- `film/ab-fight-phone-size.mp4` (6 s, A | B at phone size, real presentation:
  banners, flashes and shake left in) and `film/ab-fight-detail-1x.mp4`
  (1x crop). 181 frames per half, every frame state-checked as the same fight
  (`film/states-film.json`).
- `frames/` — the full-resolution frames behind the sheets, with the shutter
  states.
- `smoke-visual-pilot.txt`, `perf.txt`, `suites.txt` — the logs quoted below.

## Validation

- `tests/smoke-visual-pilot.mjs --old=<d05ac13 server>` — **36/36 PASS**
  (sections 0–6 above). `--selftest` (an extra draw and a 1px larger body per
  swarmling, a 1px larger player circle, under the flag only) — every body
  check and every replay FAILS, as it must: the checks can see what they guard.
- Covering suites, standalone: see `suites.txt` (`smoke-hangar`, `-arena`,
  `-roster-seams`, `-title`, `-debug`, `-rng`, `-depth`, `-leak`, `-restart`,
  `-junction`, `-detention`, `-gait-v2`, `-integration-r0`).
- The full 52-suite run was not repeated: flag-off identity with the previous
  build is proven directly (textures and seeded replays), and the full run is
  load-sensitive and not green on the previous build either (46/52, register #9).

## Measurements and performance (`tests/diag-visual-pilot-perf.mjs`)

Headless Chromium, software rasteriser — these compare A with B on the same
box; they say nothing about a phone's absolute frame time.

| | R1 | V2 |
|---|---|---|
| Hangar backdrop paint (one-time, at room load; median of 5) | 43 ms | 94 ms |
| resident texture memory (all textures, incl. the backdrop) | 63.3 MB (158) | 64.5 MB (165) |
| rendered step, staged fight (median / p95) | 7.0 / 585 ms | 6.8 / 563 ms |
| display-list size | 176 | 176 |

The pilot adds **no runtime display object**: the floor pass is paint on the
existing backdrop canvas, cover and drums are the same sprites on other keys,
the hero and swarmling are the same sprites on other sheets. Per-frame cost is
therefore unchanged by construction (the step-time row is the control). The
real costs are one-time: ~50 ms more to paint the Hangar on a desktop software
rasteriser (two scratch 1600x1400 canvases, released) — expect a multiple of
that on a phone, at a room transition — and +1.3 MB of textures (the swarm
sheet is ~1 MB at scale 6). **Phone performance was not measured.**

## Known limitations

- **The ring problem is not solved, only routed around.** The player's
  Super-charge aura is red-orange (`0xff4020`) — the enemy threat rings' family
  — and at full charge it reads as "enemy" around the hero. V2 makes the hero
  recognisable without the ring, but the aura itself is effects / HUD
  hierarchy and out of this pilot's scope (register, visual-polish candidate).
- **Banner clipping** — `SLICE TERMINALS FOR SUPPORT` overflows the 720px
  canvas (visible in the film). Recorded, not touched.
- The hero's **weapon overlays** (pistol, rifle, saber…) and the shared actor
  **shadow** texture are the shipped ones. An outlined weapon and a firmer
  contact shadow under every actor would help, but the shadow is shared with the
  approved roster (a separate decision).
- The **hero and swarmling are global under the flag** (every room); only the
  environment treatment is Hangar-only. Title and Intro portraits show the V2
  hero.
- The swarmling's hp bar rides `_headroom()` off the taller frame: 1.4 px
  higher (it rarely shows — one bolt kills).
- **The shuttle, gantry, blast door, wall band and wall panel art are
  untouched** — they gain only cast shadows, the wall coping and occlusion.
  The central objective terminal is untouched.
- Environment judgments were made on headless renders at canvas and phone size,
  not on a handset screen; contrast on an OLED phone in daylight may differ.

## Refinements that need HUMAN judgment

1. **Is the swarmling a creature?** V2 makes it a skitter drone (a low
   armoured crawler). The alternative directions are a small hunched infantry
   unit (closer to the old read, but competing with the Riflemen's silhouette)
   or an organic swarm beast. This is a design question, not an art one.
2. **The hero's palette balance** — warm suit / cape vs. more beskar, and
   whether the cyan tells (visor glint, thruster lamps) should be stronger.
3. **The Super aura colour** (effects hierarchy): moving it off the enemy-ring
   red would finish what the sprite starts.
4. **Floor intensity** — the deck plates, wear and light pools are deliberately
   quiet; the handset may want them quieter or louder. The crate band's amber
   saturation likewise.
5. **Propagation.** Only after a verdict: the same rules applied to the other
   three arenas (their compositions are frozen), roster contact shadows, an
   outlined weapon set.

## Reproduce

```bash
node tests/smoke-visual-pilot.mjs --old=http://localhost:5174/     # a d05ac13 server on :5174
node tests/shot-visual-pilot.mjs --out=DIR                          # fight shutters, A/B
node tests/shot-visual-pilot.mjs --mode=env --out=DIR               # empty Hangar stations + LIGHTS OUT
node tests/shot-visual-pilot.mjs --mode=lineup --out=DIR            # the cast at 1x
node tests/shot-visual-pilot.mjs --mode=film --out=DIR              # frame sequence, then:
ffmpeg -framerate 30 -i DIR/film/A-%04d.png -framerate 30 -i DIR/film/B-%04d.png \
  -filter_complex "[0:v]scale=360:640[a];[1:v]scale=360:640[b];[a][b]hstack=inputs=2,format=yuv420p" ab.mp4
node tests/diag-visual-pilot-perf.mjs
```

Code: `src/systems/visualPilot.js` (seams), `vpPaint.js` (hero, swarm, crates,
material pass), `vpHangar.js` (the floor pass); flag in `systems/debug.js`
(VISUAL IDENTITY V2); one line each in `BootScene`, `PreloadScene` and
`GameScene` (`loadRoom` backdrop / cover / props, `spawnEnemyAt`).
