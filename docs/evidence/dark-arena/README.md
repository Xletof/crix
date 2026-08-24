# LIGHTS OUT — the arena loses power

Evidence for the art-direction and global-state pass. Rigs:

- `tests/shot-dark-arena.mjs` — the production sequence at encounter 6, plus a
  matched A/B on **one frozen frame** (`scene.pause()`), plus the vignette's own
  alpha profile read off its texture.
- `tests/diag-lights-cadence.mjs` — a real 75-second Vader 6 fight on the
  production scheduler with nothing silenced, hooking `set-darkness` so the
  same rig measures the build this replaces.

## The transformation, measured

One frozen frame, sector 30, overlay at full. `ab-1-lights-on.png` /
`ab-2-lights-out.png`.

| region | lit | dark | darker |
|---|---|---|---|
| centre (player) | 63.2 | 13.1 | **79.3%** |
| ring 200px | 61.0 | 7.7 | 87.4% |
| ring 300px | 58.2 | 7.5 | 87.1% |
| edge mid-left | 57.5 | 7.5 | 86.9% |
| edge mid-right | 63.5 | 16.4 | 74.1% |
| top strip | 64.1 | 14.4 | 77.5% |
| bottom strip | 64.6 | 18.1 | 71.9% |
| corner top-left | 59.2 | 6.9 | 88.3% |
| corner bottom-right | 48.1 | 13.2 | 72.5% |
| **whole game viewport** | **59.4** | **11.5** | **80.6%** |

**Near-uniform is the point.** A player-centred bubble shows a large
centre-to-corner spread; the version this replaces measured 0% at the centre
and 65% across the viewport, and its identity *was* that spread. Here the
centre is darkened 79% and the corners 72–88% — the room lost power.

## The vignette, measured

Read off `darkness-blackout`, sampled along the diagonal (the overlay is
exactly VIEW-sized, so a horizontal walk runs out of canvas at 360px and every
radius past it silently reads 0 — that cost a round).

| r | 0 | 100 | 200 | 300 | 360 | 450 | 550 | 640 | 730 |
|---|---|---|---|---|---|---|---|---|---|
| now | 0 | 0 | 0 | 0 | 0.027 | 0.067 | 0.122 | 0.224 | 0.333 |
| rejected build | 0 | 0.035 | 0.380 | 0.659 | 0.79 | 0.878 | 0.878 | 0.878 | 0.878 |

Flat nothing across the entire area the fight happens in. Not tracked, not
padded, screen-locked.

## Campaign, where there is no sector wash to remove

The endless numbers above get a large free win from killing `_sectorTint`.
Campaign has none, and the Vader chamber is near-black to begin with — so this
is the honest floor of the effect, measured the same way:

| region | lit | dark | darker |
|---|---|---|---|
| centre (player + Vader) | 19.2 | 10.6 | 44.5% |
| top strip | 10.0 | 1.3 | 87.4% |
| **whole game viewport** | **14.1** | **4.9** | **65.2%** |

The centre darkens least because the two actors standing in it are exempt —
which is the mode working, not failing. Compare the whole-viewport lit
luminance: 14.1 here against 59.4 at endless sector 30.

## Cadence — the spam, quantified

Real 75s Vader 6 fights, production scheduler, nothing silenced.

| | `577761e` | now |
|---|---|---|
| activations in 75s | **13** | 5 |
| per minute | 10.3 | 4.0 |
| shortest gap between events | **297ms** | 13,950ms |
| gaps under 5s | **5** | 0 |
| lights re-raised while already on | **3** | 0 |
| event duration | ~2.7s | ~2.7s (unchanged) |

Old gaps: `-1391, 8064, 1021, 4264, 3663, 1743, 5943, -2096, 10045, -421, 7881,
297` — the negatives are a *later* event's turn-off arriving while an *earlier*
one was still counting, which is what an unowned state does with two producers.

New gaps: `14016, 13950, 13962, 13971`. The 14,000ms floor, working.

Every accepted activation at encounter 6 was **ECLIPSE** (12 eclipse requests,
6 blackout requests, 5 starts, all eclipse). Standalone LIGHTS OUT never won a
slot at that rung — see HANDOVER §10j for why that is deliberate and what it
costs.

## Shots

| file | what it answers |
|---|---|
| `seq-01-normal-arena` | the room before |
| `seq-02-power-failure` | mid-transition — see the caveat below |
| `seq-03-dark-arena` | the state itself, with a SABER COMBO arc through it |
| `seq-04-saber-throw-in-the-dark` | the crimson lane against a dead room |
| `seq-05-projectiles-in-the-dark` | bolts as bright moving points |
| `seq-06-consoles-still-powered` | the islands: blue screens, LEDs, the pod's key light |
| `seq-06b/c/d` | arena corners and the top edge — camera fully clamped |
| `seq-07/08-eclipse` | three silhouettes; the real one keeps a threat ring and a saber |
| `seq-09-lights-returning` / `seq-10` | restoration |

**`seq-02` is not evidence of onset speed.** This harness renders one frame
every ~190ms under load, longer than the whole 140ms transition, so a
screenshot lands wherever it lands. Onset is asserted numerically in
`smoke-vader` from a `postupdate` frame tape instead.

`seq-06b/c/d` exist for one question: does a screen-space overlay show seams
when the game camera clamps at the arena bounds and the player walks on? It
does not — the darkening is uniform, no strip is uncovered, and the player is
never inside a dark part of their own light. That was the failure mode of the
tracked pocket this replaces.


## What the shots answer

| question (brief §28) | answer |
|---|---|
| Does the entire room look like it lost ambient power? | Yes — 81% of the viewport, near-uniform, and the sector-30 olive wash is gone |
| Do existing emissive elements now dominate naturally? | Yes — the console screens and LEDs, the pod's key light and the crimson dais are the brightest static things left, without one new FX |
| Is Vader's saber visually striking? | Yes — it is the only saturated red in the frame, which is why the floor tint had to stay dark |
| Are dangerous telegraphs still readable? | Yes — `seq-04` and `seq-06c`: the lanes and cones gain contrast because everything around them lost it |
| Can the player still navigate? | Structure survives as the consoles, the pod, the perimeter panel lines and the dais ring. The hex grid does not — it was only ever visible through the additive wash |
| Do I see "dark arena" before "vignette"? | Yes — the vignette is flat zero out to 300px |
| Does the state look aesthetically intentional? | This is the human's call. It is the one thing an automated rig cannot answer |
