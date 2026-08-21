# LIGHTS OUT and DISARM — what the game actually does

Diagnostic pass only. No production code was changed to produce any of this.

Reproduce: `npm run dev`, then
`node tests/diag-lights-ab.mjs` and `node tests/diag-mech-truth.mjs`.

## LIGHTS OUT

`ab-1-lights-on.png` and `ab-2-lights-out.png` are ONE frozen frame
(`scene.pause()` on Game, encounter 6, every free-running boss clock pinned),
photographed with the darkness overlay at alpha 0 and then at alpha **1.0** —
the maximum the mechanic ever reaches. The only difference between the two
images is the mechanic.

| region | lit | LIGHTS OUT | darkened by |
|---|---|---|---|
| centre 200px — where the fight is | 58.9 | 58.9 | **0%** |
| ring at 300px radius | 57.7 | 55.0 | 4.8% |
| left/right screen edge | 59.1 | 51.0 | 13.7% |
| top / bottom of viewport | 58.9 / 65.9 | 40.1 / 45.7 | 31.8% / 30.7% |
| corners | 66.6 / 51.6 | 40.7 / 30.1 | 38.9% / 41.6% |
| whole game viewport | 59.0 | 46.3 | 21.6% |

Mean luminance, 0–255, sRGB coefficients, every pixel in the rect.

That profile is not an accident of the screenshot. It is read straight off the
texture that draws it (`darknessVignette`), sampled from screen centre outward:

```
radius     0    40    80   120   160   200   240   280   320   360   ...   600
alpha    0.00  0.00  0.00  0.00  0.004 0.047 0.090 0.133 0.176 0.220  ...  0.482
```

The gradient's first stop is at `min(w,h) * 0.22` = **158px of completely
transparent hole**, and it does not reach its 0.45 stop until radius 572 —
which on a 720x1280 portrait screen exists only past the top and bottom edges.
The corner (radius 734) computes to 0.63, and the two bottom corners are
covered by the touch joysticks, which are HUD chrome at depth >= 0 and draw
**above** the overlay at depth -1.

## DISARM

`raw.json` -> `disarm`. Every verb probed on the real production path, before
and after `boss-disarm`:

| | armed (cluster) | DISARMED | armed (rifle) | DISARMED |
|---|---|---|---|---|
| primary fire | true | **true** | true | **true** |
| bolts spawned | 0 (cluster throw) | **1 (pistol)** | 0 (burst) | **1 (pistol)** |
| super | true | **true** | true | **true** |
| dash | unaffected | unaffected | unaffected | unaffected |
| held weapon texture | `wpn-pistol` | `wpn-pistol` | `wpn-rifle` | `wpn-pistol` |
| player disarm flag | — | **none exists** | — | **none exists** |

`Object.keys(player).filter(/disarm/)` returns `[]`. There is no duration, no
restriction and no restoration event: DISARM is a one-shot item transfer.

Empty-handed case: `pickupsAdded: 0`, `banners: []` — `_disarmPlayer` returns
at line 1 when `player.secondary` is null, so on a player with no secondary the
mechanic is a **silent no-op with no banner at all**.
