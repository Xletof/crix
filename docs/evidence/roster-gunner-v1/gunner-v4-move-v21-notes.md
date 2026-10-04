# Gunner fire v4 + enemy movement v2.1 (candidate)

## Fire v4 (presentation only, v1 Gunner)

The charge now lives in the gun, over the same 300 ms warning window:
- **Wind:** the receiver's core line lights up, and a white packet runs forward in it.
- **Spin:** internal highlights step around the barrel axis inside the receiver, accelerating from about 6 to 30 steps a second.
- **Compress:** the lit span shortens toward the muzzle, from gun pixels 3–16 down to 12–16, and turns from green to near-white.

No sparks orbit outside the gun except two pixels at the mouth in the last 10 %.

The release:
- For one tick, a 7 px white-hot core at the muzzle plus the compressed span in white: the muzzle wins.
- Then the existing discharge fires and the gun kicks 2 px.
- The chamber is visibly empty: dim green, gone in 70 ms, and the bolt carries the read.

Timing, spawn, damage, speed, range and cadence are identical to legacy (the seeded lockstep in `smoke-roster-gunner` passes, 67/67).

## Movement v2.1 (`?move=v21`; `?move=v2` is still available; default off)

Everything in v2 is kept. On top of it, each Gunner and Rifleman gets a **personal lane**:
- Lanes are −1, 0 or +1, dealt round-robin at spawn.
- A lane is a bearing around the player: the body's own approach bearing ± 0.45 rad.
- It persists, and is re-anchored only after two blocked legs in a row.
- The body closes on its own lane point, not on the player, so a squad arriving through one gate fans out.
- In the band, it walks to its lane and then takes short alternating steps inside ± 0.22 rad of it.
- The 110 px squadmate spacing remains as the emergency spacer.

## Metrics

Seeded CROSSFIRE, sector 14, 230 actor-seconds (`tests/diag-move-feel.mjs`).

| | shipped | v2 | v2.1 |
|---|---|---|---|
| snaps /s | 3.75 | 0.07 | 0.07 |
| reversals /s | 0.54 | 0.06 | 0.04 |
| median heading hold | 33 ms | 333 ms | 333 ms |
| standing | 8 % | 32 % | 35 % |
| shots on the move | 100 % | 32 % | 35 % |
| shots | 209 | 202 | 187 |
| LOS | 85 % | 82 % | 77 % |
| mean distance | 307 | 327 | 325 |
| nearest squadmate, median | 71 px | 52 px | 68 px |
| % of time with a mate within 90 px | 57 % | 66 % | 59 % |

**Trade-off:** v2.1 undoes most of v2's bunching, but costs about 7 % of shots versus v2 (−11 % versus shipped). Some lanes sit behind cover. A blind-lane fallback was tried and made it worse (172 shots), so it was reverted.

## Tests

| suite | result |
|---|---|
| `smoke-roster-gunner` | 67/67 |
| `smoke-move-v2` | 3/3 |
| `smoke-roster-seams` | 70/70 |
| `smoke-champion-placement` | 60/60 |
| `smoke-encounters` | 25/25 |

The production build succeeds.
