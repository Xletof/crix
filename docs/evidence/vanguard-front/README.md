# VANGUARD front — `1b7c84d` opening vs staged opening (CANDIDATE)

`node tests/shot-vanguard-front.mjs [A-old|A-new|breach|kite]` — 1x, hangar
sector 8 wave 2 (VANGUARD + Captain), seed 4242, modifier nulled, player
invulnerable and planted 640px in front of the formation's gate.
`HANDOVER.md` §10av.

- `A-old-*` — `&nofront=1`: the 140px screen, `1b7c84d`'s opening timing, no lanes
- `A-new-*` — the staged front
- `breach-*` — an opening shield killed before the front establishes → release
- `kite-*` — the player held 620px behind the front → timeout release

Frames 01-07 are paused ON the frame each beat first occurs (in-page hook, next
beat armed while still paused). `A-new-08-trails` draws both opening shields'
sampled paths into the world at 1x. The rig log prints, per frame, both
opening shields' distance to the player, their separation, and how many
backline actors exist:

| frame | A-old | A-new |
|---|---|---|
| 04 shields advancing | shields 463 / 286, **2 backline** | shields 132 / 283, **0 backline** |
| 05 backline released | shields 450 / 273 | shields 132 / 174 — `established` |
| 06 Captain arrives | shields 433 / 256 | shields 132 / 127, holding, 93px apart |
| 07 front at hold | 126 / 126, **29px apart** | 132 / 127, **93px apart** |

Diagnostic only — full-speed handset play decides.
