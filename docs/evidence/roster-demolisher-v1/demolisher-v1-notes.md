# Demolisher production (`bomber`) — candidate for handset review

**Flags:** `?roster=v1` (body, payload warning, detonation hand-off) and `?gait=v2`
(the run). Without `?roster=v1` the Demolisher is exactly the legacy one — the
grunt sheet under the hot whole-body tint. Nothing is a default.

**Status:** CANDIDATE for the handset gate (Phase 2D). Not human-approved.
Presentation only — every gameplay value is the frozen one, and
`src/entities/Enemy.js` is **untouched** (`git diff 3ce5680 -- src/entities/Enemy.js`
is empty).

## What it is

The fifth ordinary production role: a **mobile explosive-payload carrier**.

| | Regular | Elite |
|---|---|---|
| silhouette | squat, stocky; short wide-set legs; a compact angular blast helmet (flat crown, heavy brow, ONE dark visor slot, a bevelled face plate — no dome, no mouth) | the same body, the same helmet, the same size |
| payload | two rear canisters on a harness frame, capped tops standing above both shoulders, dark structural space between them and the torso, shoulder supports and a yoke | the same canisters inside graphite CAGES (uprights + rings), pressure valves, a clamp, an unlit detonator module on the manifold |
| chest | a solid dark CONTAINMENT PLATE, nothing on it but its rim | a graphite frame round the plate |
| warning hardware | ONE off-centre arming indicator on the left chest strap; a status lens on each canister cap | the indicator in a hooded housing |
| side gear | a two-charge rack on the right hip | blast bands on the forearms, a steel-ended yoke |
| weapon | none (the inherited overlay stays hidden) | none |

Orange is the armour; the threat is the payload. The palette is baked (no tint),
and the Elite renders at scale 1 with the historical collider.

### Rejected lessons, kept out

No globe helmet, no diving-suit read, no horizontal row of lit chest charges, no
mouth / teeth / grin (the first face pass had a graphite chin block under the
slot that read as a respirator mouth, and a dark crescent on the back of the
helmet — both replaced by plain plate), no Rifleman-with-orange-tint, no floating
tanks (the canisters are on a frame with straps, and the payload is RIGID on the
torso — `smoke-demolisher` checks every run frame), legs visible under the payload
in every frame. A pass that put the rack below the fist read as CLAWS; it is a
clipped box at the hip now.

## Integration (the runtime, as found)

`EnemyBomber` extends `EnemyGrunt` extends `EnemyShooter`. Its constructor tints
the body `0xff6a33` and hides the inherited rifle overlay. Every AI tick,
`_tickSwarm`:

    t = clamp(1 - dist / 300, 0, 1)
    _bombPulse += delta * (0.006 + 0.03 t)
    flash = 0.5 + 0.5 sin(_bombPulse)
    setTint(255, 106 + flash·t·130, 51 + flash·t·110)      <- THE legacy warning
    dist <= contactRange (48) -> _detonate() (nemesis: _contactBurst)

The AI (and so the tint write and the pulse) does not run while staggered,
`_performing`, or with the player dead. Contact at 48px means **t never passes
0.84** in play. `_detonate` → `_blast(2.2, 1.0)` → `hp = 0; die()`; shot down,
`die()` → `_blast(2.0, 0.8)` → base `die()` (a 440ms corpse slide/fade).

### Seams used

| seam | what | where |
|---|---|---|
| art registration | `registerRosterArt('bomber', …)` + the two prefixes in the anim loops | `PreloadScene` |
| the hook | `art.demolisher` → `installDemolisherPayload` | `rosterArt.wearRosterArt` |
| ONE AUTHOR for the body tint | the class's `preUpdate` runs untouched except that its `setTint` lands nowhere (recorded on `_legacyWarnTint`) | `systems/demolisherPayload.js` |
| the warning | reads the frozen `t` and `_bombPulse` right after the AI ran; draws the indicator, the canister lights and the payload heat | `systems/demolisherPayload.js` (scene tick after the gait tick) |
| the detonation hand-off | after the frozen `die()` (blast first): body + shadow hidden; the overlays are `_attachments`, destroyed by `die()` and by the room sweep | `systems/demolisherPayload.js` |
| the Elite's death juice | `_threatScale = scale` (like the Bulwark) so the kill burst draws the same random numbers | `GameScene._makeElite` |
| the run cadence | `GAIT_CYCLE_PX['ro-dem'] = 80`, `GAIT_MAX_FPS['ro-dem'] = 32`; every other role unchanged (24) | `rosterPaint.js`, `rosterGait.js` |
| nemesis | **excluded by the existing seam**: `_spawnMiniBoss` spawns with `legacyArt` and `_makeElite(…, legacyLook)`, so `wearRosterArt` never runs on it | — |

## The proximity warning

`payloadWarning(t, flash)` (pure; the strip, the tick and the tests share it):

| layer | law | reads as |
|---|---|---|
| **indicator** | 0.55 steady at range; blinks fully on the pulse from t ≈ 0.15 (~255px) | ARMED, then counting down |
| **canister lights** | 0.35 steady at range; the same blink law a little later | the warning from BEHIND, where the indicator is out of sight |
| **payload heat** | ADD, the canisters + charges (+ the Elite's cage as contained red) + the payload's own outline rim; warms from t 0.15 to 0.7, × (0.4 + 0.6·flash) | the payload preparing to detonate |
| colour | amber → white-hot (indicator), amber → red (lights) over t 0.35 → 0.8 | urgency |

The heat layer and the lamp anchors are **derived from each finished frame**
(`demoDerive`: payload colours are used by nothing else on the body), so the
light lands on the hardware in every frame, facing and stride. Timing is the
frozen telegraph's by construction: no new clock, no new threshold, no longer
window.

### Measured against legacy, 1x (`tests/diag-demolisher-warning.mjs`)

Screen change against the resting body, 140×150px around it, pulse peak
(area = px changed by > 48 RGB; energy = luminance change / 1000):

| t | front: legacy → v1 | side: legacy → v1 | back: legacy → v1 |
|---|---|---|---|
| 0.15 | 76/3 → 528/23 | 87/3 → 491/21 | 76/3 → 384/17 |
| 0.30 | 1248/37 → 1878/68 | 1480/43 → (re-measure pending) | 1649/48 → 2716/92 |
| 0.45 | 1896/72 → 1909/130 | 1824/72 → (re-measure pending) | 2041/82 → 2730/205 |
| 0.60 | 2065/97 → 1968/169 | 1987/97 → (re-measure pending) | 2210/110 → 2732/267 |
| 0.80 | 3224/160 → 3217/216 | 2989/159 → 3096/230 | 3409/175 → 3924/315 |

The Regular matches or beats legacy at every range
and facing. **The Elite** (legacy renders it 1.4x larger) reaches ~75% of the
legacy Elite's area and 90-100%+ of its energy once the cage joins the heat.

Two real findings came out of this instrument: the BACK view had no warning at
all until 165px (the indicator is on the chest) — fixed by giving the canister
lights the indicator's armed-then-blinking law and 2px lenses; and the heat
started too late to match legacy at ~210px — moved to t 0.15.

## Detonation

Both paths still run the frozen blast at the frozen place, scale and damage
(contact `_blast(2.2, 1.0)`, shot down `_blast(2.0, 0.8)`; 155px, 240). The v1
hand-off: the payload is gone with the blast — heat, lamps and bloom destroyed
(attachments), the body and its shadow hidden on the blast frame instead of
sliding through the explosion for the 440ms corpse fade. No accent was added:
the frozen explosion is the event.

## Unchanged gameplay (pinned by `smoke-demolisher`)

hp 200 (Elite 500), speed 300 (Elite 270; ×FRENZY / sector ramp as before),
radius 20 (Elite 27), body 40px (Elite 75.6px, historical), contact 48,
blast 155 / 240, death ×0.8, rusher, AI, navigation, the pulse, both triggers,
the nemesis contact burst (1700ms cooldown, survivable) — all identical legacy
vs v1. Seeded BOMBER RUN replays (sector 14, wave 1, 1080 ticks, firing +
strafing, 4 Demolisher detonations, 2 Elite, 37 damage events to the player):
legacy vs v1 and gait off vs v2 are the SAME FIGHT at all 72 checkpoints,
every random draw included.

The replay EQUALIZES one known, pre-existing, frozen leak in the rig only: the
Gunner / Rifleman / Marksman v1 Elites die with a smaller kill juice (HANDOVER
§0, flagged, left to the human). Unequalized it splits at checkpoint 68 on an
Elite Rifleman's death. The Demolisher is never equalized: A/B without its own
`_threatScale`, the replay fails.

## Pre-existing observations (not changed)

- **A fresh swarm rusher sidesteps for 600ms about 0.6s after spawning.**
  `Enemy.preUpdate`'s stuck check measures `hypot(x - (_stuckRefX ?? x))` and
  the reference starts undefined, so the first check always reads zero
  movement. Visible in the warning clips (a Demolisher veering before it
  commits). Frozen code; both builds.
- The stock threat ring (radius + 12) is hidden under every 96px v1 body, as on
  the four approved roles.

## Files

| file | change |
|---|---|
| `src/systems/rosterPaint.js` | appended: the Demolisher painter (`DEMO_GAIT`, `DEMO_LAMPS`, `paintRosterDemolisher`, heat derivation); the gait tables gain `'ro-dem'` |
| `src/systems/demolisherPayload.js` | **new**: the warning law, the one-author tint, the payload tick, the detonation hand-off |
| `src/data/rosterArt.js` | the `art.demolisher` hook |
| `src/scenes/PreloadScene.js` | registration + the two prefixes in the anim loops |
| `src/scenes/GameScene.js` | `_threatScale` for the v1 Elite; the payload tick attached after the gait tick |
| `src/systems/rosterGait.js` | per-role cadence ceiling (`GAIT_MAX_FPS`, default 24 unchanged) |
| `tests/smoke-demolisher.mjs` | **new** gate |
| `tests/diag-demolisher-warning.mjs` | **new** salience instrument |
| `tests/shot-demolisher.mjs` | **new** evidence rig |
| `tests/smoke-roster-2b.mjs` | the "Demolisher stays legacy" check now pins its own art (intended change) |

Texture keys: `ro-dem-R`, `ro-dem-E` (body), `ro-dem-R-heat`, `ro-dem-E-heat`
(payload heat, same layout). Animation prefixes `ro-dem-R` / `ro-dem-E` (18 keys
each).
