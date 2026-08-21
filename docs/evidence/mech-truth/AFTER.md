# LIGHTS OUT and SUPPRESSION — measured after the correction

Reproduce with `npm run dev`, then:

- `node tests/diag-lights-ab.mjs` — the numbers, on one frozen frame
- `node tests/shot-lights-out.mjs` — the sequence, on the real event path
- `node tests/diag-suppression.mjs` — every player verb, cases A–F

## LIGHTS OUT

`ab-1-lights-on.png` / `ab-2-lights-out.png` are ONE frozen frame
(`scene.pause()`, encounter 6, every free-running boss clock pinned),
photographed with the blackout overlay at alpha 0 and then at **1.0**. The only
difference between the two images is the mechanic.

Because the pocket now tracks the player, the regions are sampled as rings
around the **player**, not around the middle of the display.

| distance from the player | lit | LIGHTS OUT | darkened by |
|---|---|---|---|
| at the player | 83.8 | 83.8 | 0% |
| 100px | 60.8 | 58.1 | 4.6% |
| 150px | 58.6 | 48.4 | **17.4%** |
| 200px | 57.8 | 39.0 | **32.6%** |
| 250px | 57.6 | 28.0 | 51.4% |
| 300px | 60.2 | 21.2 | **64.8%** |
| 400px | 57.2 | 10.3 | 82.1% |
| whole game viewport | 59.1 | 20.7 | **65%** |

Mean luminance, 0–255, sRGB coefficients. Before the change the same table read
0% at the centre, 4.8% at 300px, and 21.6% for the viewport.

The gradient itself, read off the texture that draws it:

```
radius     0    50   100   150   200   250   300   350   400   450+
alpha    0.00 0.00 0.035 0.204 0.380 0.537 0.659 0.765 0.843 0.878
```

Isotropic to the corner — the texture is padded, so `+x`, `+y` and the diagonal
all report the same curve.

`DARKNESS.ambient` is untouched: inner 158, outer 910, stops
`[[0,0],[0.55,0.45],[1,0.82]]`, 420ms fade. `smoke-vader` pins all four.

### Sequence

| file | |
|---|---|
| `lo-1-normal.png` | the room before |
| `lo-2-transition-60ms.png` / `lo-3-transition-130ms.png` | the power-failure flicker |
| `lo-4-settled-250ms.png` | settled |
| `lo-5-vader-in-the-dark.png` | **a SABER THROW telegraph read through the dark** — the crimson lane is the brightest thing on screen |
| `lo-6-eclipse-afterimages.png` | ECLIPSE: 3 clones confirmed alive in frame, the real Vader identifiable at ~400px by his threat ring and saber |
| `lo-7-restored.png` | lights back |

His attack clocks are silenced **for the photographs only** — a boss mid-charge
answers "what does the room look like" with a full-screen red hurt flash. The
mechanics themselves run on their real events.

## SUPPRESSION

`suppression.json`. Every verb, on the real `boss-disarm` event path:

| | before | **DURING** | after |
|---|---|---|---|
| primary fire | true, 1 bolt | **true, 1 bolt** | true, 1 bolt |
| ranged Super | true | **false** | true |
| Broken Wings | true | **false** | true |
| Broken Wings mid-chain link 2 | true | **false** | true |
| super charge kept on attempt | — | **yes** | — |
| melee charge kept on attempt | — | **yes** | — |
| dash charges spent | 1 | **1** | 1 |
| super button texture | `super-btn` | **`super-btn-off`** | `super-btn` |
| melee button texture | `melee-btn` | **`melee-btn-off`** | `melee-btn` |
| buttons tinted / alpha | false / 1.0 | **true / 0.5** | false / 1.0 |

Cases:

- **C — mode switch is not a bypass.** After `beginMeleeAim()`, both paths still
  return false and the super charge is still intact.
- **D — no secondary equipped.** Banners raised: `["SUPPRESSED"]`. Suppressed:
  true. Pickups on the floor: 0. The old mechanic did nothing at all here.
- **E — rifle equipped.** Still held, still 27 ammo, 0 pickups added, suppressed
  true. Identical behaviour.
- **Repeat activation.** 3208ms remaining → 4000ms. Refreshes; never stacks.
- **F — death / revive.** suppressed true (3707ms) → cleared, 0ms. Every verb
  normal afterwards.
- **Duration.** 3845ms read one frame after activation, from `suppressMs: 4000`.

## Discrimination

17 of the new `smoke-vader` checks fail against the pre-change behaviour
(`3025efd`), patched back behaviour-only so the harness stays identical:
every Super-block check, every charge-preservation check, the no-secondary
banner, the HUD state, the duration, the refresh rule, the "not taken" check,
and all six darkness checks. Notably the baseline probe reported the player
**410px off screen centre**, which is the screen-locked-pocket defect showing up
in an ordinary run.
