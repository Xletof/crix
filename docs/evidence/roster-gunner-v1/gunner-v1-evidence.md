# Gunner v1: Regular + Elite production vertical slice (roster Phase 2A)

**Commits** on `claude/bold-hypatia-iniqck`, on top of Phase 1 (`dacf72c`):
- `2ec21b1`: the source, unchanged since.
- `40a9b08`: test-harness fixes.
- The commit that adds this file: the evidence. Its SHA is the branch head given in the hand-off report.

**Scope:** the GUNNER (internal `shooter`) only, behind `?roster=v1`. Legacy is still the default. These are unchanged:
- every other role (Rifleman, Bulwark, Marksman, Demolisher)
- swarmlings and nemeses
- the Captain and Vader
- elite behaviour, hp and frequency
- encounters and rewards

## Files

| file | change |
|---|---|
| `src/systems/rosterPaint.js` | **new.** The production painter: Gunner body sheets (regular, elite) and weapons (regular, elite). It is a new file because `pixelArt.js` is pinned by the Captain guard. |
| `src/scenes/PreloadScene.js` | Paints the sheets and registers them for `shooter` via `registerRosterArt`. Adds the two prefixes to the existing animation loops. |
| `src/data/rosterArt.js` | `wearRosterArt` also sets the weapon origin, and remembers the old prefix for the hp-bar colour (see below). |
| `src/entities/Enemy.js` | `EnemyShooter.updateHpBar`, subclass only, explained below. The base class is byte-identical (test 16). |
| `tests/smoke-roster-gunner.mjs` | **new.** 58 objective checks, including a seeded, hand-stepped legacy-vs-v1 CROSSFIRE run. |
| `tests/shot-roster-gunner.mjs` | **new.** The evidence rig that produced every file in this folder. |
| `tests/smoke-roster-seams.mjs` | Phase 1 asserted "no v1 art exists yet". Gunner rows now assert the production art; every other role still falls back. The stand-in elite path moved to `grunt`, so it no longer overwrites the real Gunner registration. |

**Why the `EnemyShooter.updateHpBar` override.** The frozen base class picks the hp-bar colour with `_animPrefix === 'shooter'` (the Gunner's cyan bar). That reads an art name. A v1 Gunner has prefix `ro-gun-*` and would have silently switched to the green/red bar. The override draws the bar while answering with the remembered legacy prefix. It does nothing when no v1 art is worn.

## Production keys

| | body texture = animation prefix | weapon | weapon origin |
|---|---|---|---|
| Regular | `ro-gun-R` | `ro-w-gun-R` (21×10 logical, 84×40 px) | (0.3571, 0.45) |
| Elite | `ro-gun-E` | `ro-w-gun-E` (23×10 logical, 92×40 px) | (0.4130, 0.45) |

**Sheets.** 24×26 logical at scale 4 (96×104 px per frame), 33 frames:

| frames | content |
|---|---|
| 0–7 | front: 0 idle, 1–6 walk, 7 fire |
| 8–15 | back, same layout |
| 16–23 | side (east), same layout |
| 24–32 | raise / thrust / recoil × front / back / side |

**Animation keys.** Each tier has 18:
- `idle`, `walk` and `fire` × `front`, `back`, `side` (the existing loops)
- `raise`, `thrust` and `recoil` × `front`, `back`, `side` (the existing pose loop)

There is no new animation framework. West is the side block mirrored by `flipX`. That is correct for the backpack, which trails behind him either way. The character-left gear changes screen side, which is the accepted mirror behaviour.

## How v1 presents the Elite

Under v1 the Elite gets:
- its own sheet `ro-gun-E` and gun `ro-w-gun-E`
- render scale **1.0** (`_baseScale` 1)
- **no tint**; the palette is baked into the art

It keeps the historical gameplay exactly:
- hp ×2.5, speed ×0.9
- `cfg.radius` 30 (bullet hits, gun origin, spawn point)
- physics body **84 px** wide: legacy is r30 × render scale 1.4, v1 is r42 × 1.0, the same width at every squash

Legacy (no flag) is unchanged: scale 1.4, gold tint `0xffd040`, legacy sheet and gun.

## Gameplay values verified unchanged (legacy = v1 = the `88e9b89` fixture)

| | Regular | Elite |
|---|---|---|
| hp | 450 | 1125 |
| speed | 190 base | ×0.9 |
| cfg.radius | 22 | 30 |
| physics body | 44 px, centred | 84 px, centred |
| weapon origin | radius − 4 = 18 | 26 |
| bolt spawn | radius + 4 = 26 | 34 |
| fire cooldown | 800 ms (±20 %) | 800 ms (±20 %) |
| bolt | 700 px/s, 130 dmg, 560 px | same |
| `_isRusher` | false | false |

Room-modifier and sector scaling apply identically under both flags.

**The same fight, tick for tick.** The strongest proof is a seeded, hand-stepped CROSSFIRE at sector 14:
- **900 ticks**, with the player moving and then firing
- legacy and v1 are identical at **60 checkpoints**: every enemy position, velocity, hp, AI state, aim and cooldown, every bolt, and the Math.random draw count
- the **same 117 Gunner shots** (63 regular, 54 elite) land on the same ticks, from the same bodies, at the same angles
- every bolt has the same speed, damage and range, and spawns at `radius + 4`

`gunner-v1-ab.webm` is this same harness: its two halves matched at 20 of 20 sampled checkpoints.

## Muzzle: is the visual alignment honest? Yes.

The gameplay spawn point is frozen at `cfg.radius + 4`, 8 px past the gun's origin. The bolt is a 67.7 px streak centred on that point, drawn at the flat bullet depth 26, **under** the gun and body. The physics step runs before the first render, so on a 60 fps phone the first frame a bolt is ever drawn puts its leading edge at origin + 53.6 px.

**The drawn muzzle** (the outer edge of the gun silhouette) is placed **there, at origin + 54**, for both tiers. Measured in the live runtime at 8 bearings × 2 tiers, west's `flipY` included:
- muzzle and spawn point lie **on the bolt axis**, 0.00 px off
- the drawn muzzle sits within **0.5 px** of the bolt's first drawn leading edge (72.0 vs 71.5 regular, 80.0 vs 79.5 elite)
- the spawn point is **inside** the drawn gun

Legacy, for comparison: its muzzle is 7.7 px beyond that edge. The bolt's 15 px glow pokes out above and below its 8 px barrel all the way along the gun.

**The elite.** Its gameplay radius puts its gun origin 8 px further out. Its gun is 8 px longer (the compensated barrel) with the origin shifted to match, so receiver and drum sit on the same place on the body as the regular's.

**Aimed at the camera.** The gun runs down the body's centreline and reaches 12 px behind the body centre, so the visor and eyes stay clear.

`gunner-v1-weapon.png` shows all of this, with a numeric table in `gunner-v1-weapon-numbers.json`.

## Colliders (`gunner-v1-colliders.png`, `-2x.png`)

- **Regular.** Physics body = bullet radius = r22, centred on the chest. The v1 regular is drawn larger than legacy (79×103 px vs 55×63 front bounds), so only about 1/3 of its drawn pixels are inside r22, against about 3/5 for legacy. In practice that is not a pass-through risk: a player primary bolt registers within `bolt half-length 45.5 + 22 − 2 = 65.5 px` of the centre, and **100 %** of the drawn v1 body (both tiers, both facings) lies inside that.
- **Elite.** The 84 px physics circle encloses torso, shoulders and pack collar, about 85–89 % of the drawn figure (legacy 90 %). The bullet radius 30 covers about 57 % (legacy 55–62 %). Because v1 draws the elite at regular size, **the elite is a bigger target than a regular of the same drawn size** (r30 against r22). That is the retained historical gameplay, left for the human to judge. It is not rebalanced here.

## Tests

| suite | result | guards |
|---|---|---|
| `smoke-roster-gunner` (new) | **58/58** | the 20 required checks plus muzzle, warn tint, hp bar, nemesis, shared-sheet roles |
| `smoke-roster-seams` (Phase 1, updated) | **70/70** | legacy = `88e9b89` fixture for every role; v1 gameplay = legacy |
| `smoke-champion-placement` | **60/60** | Captain files and Enemy base class byte-identical to `6560c62` |
| `smoke-encounters` | 25/25 | |
| `smoke-encdbg` | 33/33 | |
| `smoke-duel` | 20/20 | |
| `smoke-nemesis` | 20/20 | |
| `smoke-nemesis-kit` | 25/25 | |
| `smoke-vanguard-screen` | 22/22 | |
| `smoke-vanguard-reinforce` | 26/26 | |
| `smoke-captain` | **38/38 standalone** | |
| `smoke-vanguard-front` | **30/30 standalone** | |

**The two suites marked standalone each failed one check in the 12-suite sequential batch, then passed in full when rerun on their own.** Both failures were checks that measure a fixed window of real time:
- Captain: "bursts are separated by the authored recovery". Only one burst fell inside the window, so there was no gap to measure.
- VANGUARD-front: "a SURGE during the hold…". The hold timed out at 3058 ms against a 3000 ms timeout.

Neither suite runs any Gunner code path. VANGUARD-front's surge check also failed on the untouched `88e9b89` during the Phase 1 A/B.

## Handset URLs (GitHub Pages, after the FRIX fast-forward)

- Default (legacy, unchanged): `https://xletof.github.io/crix/`
- v1 roster, normal run: `https://xletof.github.io/crix/?roster=v1`
- **CROSSFIRE, both tiers** (sector 14, elite roll 0.40):
  - v1: `https://xletof.github.io/crix/?roster=v1&encdbg=crossfire&room=corridor&sector=14&wave=1`
  - matched legacy: `https://xletof.github.io/crix/?encdbg=crossfire&room=corridor&sector=14&wave=1`
- Regular-heavy (sector 7, elite roll 0.225): `https://xletof.github.io/crix/?roster=v1&encdbg=crossfire&room=corridor&sector=7&wave=1`
- Colliders: append `&colliders=1` to any of the above.

## Evidence files

| file | what |
|---|---|
| `gunner-v1-sheet-regular.png`, `gunner-v1-sheet-elite.png` | the production textures, all 33 frames, 1× |
| `gunner-v1-facings.png` | live runtime, 1×: Regular / Elite / unchanged Captain, aims S / N / E / W, weapons placed by `Enemy.preUpdate`. Room furniture hidden; the floor is real. |
| `gunner-v1-weapon.png` (+ `-numbers.json`) | origin, spawn, drawn muzzle, a real bolt on its first drawn frame; 8 aims × Regular / Elite / legacy reference; 2× camera zoom |
| `gunner-v1-colliders.png`, `gunner-v1-colliders-2x.png` | `?colliders=1`, legacy and v1, both tiers, aims S and E |
| `gunner-v1-live-1x.webm` | **v1 CROSSFIRE**, real speed, 30 fps, 20 s: regulars and elites walking in from the gates, strafing, facing changes, the orange pre-fire warning, firing, recoil; the player shoots in the last third (hit flashes, kills, cleanup) |
| `gunner-v1-ab.webm` | **legacy \| v1 side by side**, the same seeded fight and the same player input, frame-locked |
| `gunner-v1-controlled-1x.webm` | extra: legacy and v1, regular and elite, walking a square (E / S / W / N) and firing two rounds at each corner — the walk cycle, fire frame, recoil squash and warn tint in isolation, 1× |

**Why the videos are hand-stepped.** Headless Chromium runs the game at about 12 fps, slower than the 14 fps walk cycle, so recording the live loop would alias the animation. Instead the loop is stepped at exactly 1000/60, and every second tick is encoded at 30 fps: real speed, with every animation frame on screen for its real duration. `Date.now` is stepped too, because Phaser's tween manager reads the wall clock.

## Known discrepancies

1. **The gun is an overlay that rotates to the aim** (the shipped convention). Aimed at the camera it lies down the body's centreline over the chest; aimed away it is behind the body and its barrel shows above the helmet.
2. **The pre-existing aim/fire mismatch.** While a Gunner advances, `_moveToward` points the gun along the nav heading, but the shot goes straight at the player. A shot fired mid-advance therefore leaves at an angle to the drawn gun. This is identical in legacy.
3. **The muzzle relationship assumes 60 fps.** At 30 fps a bolt's first drawn position is 11.7 px further out, about 12 px past the muzzle.
4. **The shadow sits higher than the feet.** `Enemy.preUpdate` (frozen) puts it at y + 18, which is the hips on a 26-row figure (legacy sat lower on its 20-row one).
5. **West mirrors** the antenna and pack to the other screen side (accepted).
6. **Front and back legs are separated only by outline.** They are near-black, so at 1× the step reads mainly through the lit toe caps and the lifted foot.

## What the human should judge on the handset

- Is the Gunner's role readable in CROSSFIRE?
- Does the walk read as walking in all four facings, and does the brace / recoil feel like this Gunner firing?
- Does the weapon sit on the body convincingly at every aim, and does the bolt read as leaving the muzzle?
- Does the elite read as a better-equipped Gunner (not mini-Captain, not big, not gold)?
- Is the Captain still clearly above both?
- Is the retained elite collider (84 px body, r30 bullet radius on regular-size art) acceptable?
- Does the v1 Gunner sit with the legacy roster it currently shares the floor with?
