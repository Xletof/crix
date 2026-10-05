# Gunner fire v5 + enemy movement v2.2 (final candidate before freeze)

## Fire v5 — an explicit rotor inside the gun (presentation only, v1 Gunner)

v4 already put the energy inside the gun. Its "spin", though, was highlights sliding along the barrel, which reads at 1× as energy travelling forward, not as anything turning. v5 gives the spin a mechanism.

**The chamber:**
- It is a 3×3 window in the receiver, sitting on the painted power indicator.
- It is drawn on the gun's own pixel grid: whole gun pixels, in the gun's rotated space, and correct when the gun flips to face west.
- Its centre is dark.
- A comet of 2–3 lit cells steps round its eight rim cells.

**The sequence**, inside the unchanged 300 ms warning:

| Beat | When | What happens |
|---|---|---|
| FEED | throughout | The core line behind the chamber lights, and packets run forward along it into the chamber. |
| WIND | throughout | The comet steps clockwise. It starts at about 16 rim steps a second, so each position holds for about 4 frames at 60 fps, and ramps to about 80, where the steps merge. |
| COMPRESS | last ~90 ms | The feed line is eaten from the back forward. The rim fills green, then pale, then white. The centre lights last, and the whole chamber becomes a white-hot core. The mouth heats, and one pixel escapes it at the very end. |
| SNAP | one frame | Chamber and bore go white up to a 7 px white-hot core at the lip. The discharge fires on its peak frame and the gun kicks 2 px. |
| EMPTY | 140 ms | The chamber goes dark: the rotor is gone and one dim green cell is left. The painted idle returns as this fades, and the bolt carries the read. |

**The snap and the discharge peak are counted in frames, not milliseconds.** v4's release was drawn only while `kickT < 17 ms`. On a 30 fps phone the first tick after the shot is already 33 ms in, so v4's release was **never drawn there**. `smoke-roster-gunner` 23b steps a 30 fps shot and asserts that the snap is drawn. A/B: v5 draws 16 white cells on that tick, v4 draws 0.

The discharge's peak is therefore exactly one drawn frame, followed by about 50 ms of decay. Before, it was about 2 frames of peak.

**Unchanged:**
- warning start tick and shot tick
- cadence
- projectile spawn, damage, speed and range
- collider
- the 2 px / 80 ms kick
- no whole-gun tint and no external swirl

The seeded legacy-vs-v1 lockstep passes.

## Movement v2.2 — destination ownership (`?move=v22`; `v2` and `v21` still available; default off)

v2.1's permanent lanes are gone from v2.2. A lane is an angle the body keeps for the whole fight, including angles the room's cover has made bad.

v2.2 owns a **place, for one leg**.

**Choosing a spot.** When a pocket leg starts, the body looks at about 11 candidate spots inside the band:
- a leg's length either side;
- wider either side;
- a little nearer or farther either side;
- one radial-only spot when the band asks for it.

Each spot is scored on what the body already knows:
1. **Line to the player.** A clear line scores +4. A line that also survives the player stepping 40 px either way scores up to +1.5 more.
2. **Taken or crowded.** Another body, or another body's claimed spot, within 60 px costs −6, which is more than a line is worth. Within 140 px is a sliding penalty.
3. **Reachable.** A straight path for a body (three parallel rays) is required. Off the floor or inside cover is excluded.
4. **Walk.** The walk length is penalised mildly.
5. **No going back.** Returning within 60 px of the spot just left costs −1.5.

v2's rhythm is a small bias on top: two legs one way, then a turn.

**Committing.** The body commits to the best spot. Nothing re-scores it. The leg is v2's leg: one fixed world-space direction with eased velocity. It ends on arrival, on a block, on its clock, or when the player has moved 160 px since the spot was chosen. The spot is published as `_dest`, so the next body to choose sees it as taken.

**The approach in.** The last stretch of an approach (inside band + 300 px) heads for a chosen spot just inside the band near the body's own bearing.
- It is held as a bearing and radius *around the player*, chosen once. It therefore travels with the player the way the shipped approach does, and never flips sides.
- It is chosen again only when the room puts it out of reach.
- Before this, every body aimed at the same point (the player), so a squad from one gate funnelled into one file. That was half the bunching.

**The backstop.**
- If no spot is reachable, the v2 leg runs, including its 110 px mate rule.
- A body standing in its settle with another body within 50 px of it ends the settle and chooses again.
- A body that cannot see the player settles for about 150 ms rather than 320–600 ms.

**Measured, first attempt and fixes.** The first version scored LOS above "taken". In corners, three bodies chose the same spot, and the pocket nearest-mate median stayed at 43 px. Bodies do not collide with each other in this game, so 43 px means overlapping. Making "taken" outweigh a line fixed the spacing.

Choosing approach spots in world space then fixed the funnelling, but cost heading commitment: 0.30 reversals/s and a 150 ms median heading hold, which is the DVD-logo regression. The cause was re-picking when the player moved. Holding the approach spot relative to the player put both back to v2 levels.

## Metrics

Seeded CROSSFIRE, sector 14, Reactor Junction, the same scripted player, 1500 ticks, about 230 actor-seconds (`tests/diag-move-feel.mjs`).

METRICS_TABLE

Two more seeds (`SEED=777`, `SEED=31337`), v2 / v2.1 / v2.2:

| seed | shots | LOS % | nearest mate median px | within 90 px % | reversals/s | heading hold ms |
|---|---|---|---|---|---|---|
| 777 | 186 / 169 / **201** | 77 / 71 / **83** | 62 / 64 / **87** | 62 / 62 / **53** | 0.07 / 0.05 / 0.08 | 283 / 250 / 333 |
| 31337 | 188 / 174 / **198** | 78 / 73 / **81** | 55 / 72 / **78** | 68 / 57 / **56** | 0.05 / 0.05 / 0.07 | 300 / 300 / 317 |

What these numbers say:
- On all three seeds, v2.2 keeps v2's commitment numbers, fires more than v2, holds more LOS than v2, and has materially better spacing.
- v2.2 stands still a little less than v2 (about 27–29 % against 32–34 %).
- Reversals are 0.01–0.02/s above v2 on each seed. That is a small rise, and still an order of magnitude under shipped (0.54).

## Evidence (this folder)

| File | What it shows |
|---|---|
| `gunner-weaponfire-v5-strip.png` | idle → feed → slow rotor → faster rotor → compress → compress+ → white-hot → SHOT → empty +16 / +67 ms → recovered, at 1×. Rows: v4 regular, v5 regular, v5 elite (aim E); v5 regular, v5 elite (aim W, flipped gun). |
| `gunner-weaponfire-v5-strip-3x.png` | The same cells, nearest-neighbour 3×. |
| `gunner-weaponfire-v5-ticks-3x.png` | Every 60 Hz tick of one charge, receiver only, 3×. This is where the rotor's steps are visible as steps. |
| `gunner-weaponfire-v5-ab.webm` | v4 (left) vs v5 (right), both tiers, 1×, the same scripted shots. The v4 build is the committed `d6e22d9` module, served for that run only, with its own discharge timing. |
| `gunner-weaponfire-v5-zoom.webm` | 3× camera, every 60 Hz tick, played at half speed. Diagnostic only. |
| `enemy-move-v22-ab.webm` | `?move=v2` vs `?move=v22`, same seed and same scripted player. |
| `enemy-move-v22-density.png` | Where Gunners and Riflemen stood relative to the player, v2 vs v2.2. |
| `gunner-v5-move-v22-live.webm` | Real CROSSFIRE at 1× with both candidates on. |

## Handset

- v5 + v2.2: `?roster=v1&move=v22&encdbg=crossfire&room=corridor&sector=14&wave=1`
- v5 + v2 for comparison: the same URL with `move=v2`.
