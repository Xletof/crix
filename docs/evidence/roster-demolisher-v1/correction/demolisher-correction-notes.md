# Demolisher Phase 2D — correction: side-run anatomy + the false first stuck check

**Status:** CANDIDATE. **Phase 2D is NOT frozen** — it closes only when the
human accepts both corrections on a handset.

**Refs.** Rejected build `785999f`. Side-gait correction `a7d18d2`. False-stuck
correction `fca7fa5`. This evidence and the docs: the commit after it.
Flags unchanged: `?roster=v1` (body, warning, detonation hand-off) and
`?gait=v2` (the run). The false-stuck correction is NOT behind a flag — it is
gameplay, and it holds in legacy and v1 alike. No roster default changed.

Handset verdicts on `785999f` — PASSED: Regular body / helmet / payload, Elite
containment, Elite proximity warning, warning progression and hardware heat,
contact and death explosions, Nemesis compatibility. REJECTED: the side-view
running gait, and the initial sideways veer. Only those two moved.

---

## A. The side-view run

### Diagnosis (785999f)

Measured from the painted pixels (`smoke-demolisher` §2b) and the gait table
the painter draws from:

| | 785999f | corrected |
|---|---|---|
| profile hip socket | x 11 — BEHIND the torso's centre (12.5-13.5) | x 12, under the torso |
| where the trailing thigh leaves the pelvis band | 2-3 columns behind it, under the rear canister (frames 17, 20: x 9-10 against a pelvis at 12-14) | within one column (a toe-off hip extends one; the swing knee drives forward) |
| planted-foot positions | +5 / +2 / -2 / -5 (an inverted V on five-row legs) | +4 / 0 / -3 |
| swing | high (`S`, two rows clear) swinging +2 to +5 | LOW (`L`, one row clear): kicks up behind (-2), passes UNDER the pelvis knee-forward (+1), reaches (+3) |
| heel-to-toe across both boots | 13 logical px in frames 17 and 20 | at most 9 |
| knee | bends BACKWARD in frames 17 and 20 (behind the hip-ankle line); jumps 4px between frames 4 and 5 | never behind its line; no knee or foot moves more than 3-4px a frame, the 6 -> 1 wrap included |
| boot facing | the near boot had a lit toe pixel; the FAR boot had none, and a heel-up boot had none either — the trailing foot read as reversed | a toe-cap at the EAST end of BOTH boots in every state (near `DU.lit`, far `DU.mid`) |
| planted per leg | four frames planted, two swinging | three planted, three swinging, in antiphase — the six-phase doctrine (contact, load, toe-off / reach on one leg while the other swings low) |

### What changed (`src/systems/rosterPaint.js` only)

`DEMO_GAIT.side.walk` (six frames), the side `fire` brace's far foot (-2 -> -3,
which keeps it on the same deck pixel now that the socket moved one column),
a new `L` foot state (low swing, boot top row 21), `DEMO_HIP_X = 12` for the
profile legs and the pelvis block under them, and the toe-cap pixel on both
boots. The profile pose hooks (raise / thrust / recoil) and the profile strafe
hang from the same corrected socket (they move one column; their tables are
unchanged).

### What did not change

- every FRONT and BACK frame, body and heat layer — pixel-identical to
  `785999f` (FNV hash over every logical pixel, pinned in `smoke-demolisher`);
- every profile frame ABOVE THE PELVIS (rows 0-16: helmet, torso, canisters,
  harness, rack, containment plate, Elite cage, heat layer) — pixel-identical;
- the payload is still RIGID on the torso (100% of payload pixels in every run
  frame are the idle ones moved by the body's own offset);
- the profile idle table, the front/back gait tables, every other role's gait
  table and painter (byte-identical to `cd4b0e9` outside the Demolisher);
- the cadence: `GAIT_CYCLE_PX['ro-dem']` 80 and `GAIT_MAX_FPS['ro-dem']` 32.
  The planted foot now travels 4 / 3 / 4 / 3 logical px per frame against
  3.33 for the cycle (mean within 5%) — no demonstrated cadence problem, so
  the cycle and ceiling were kept, as the brief asked.

WEST is the same frames mirrored by the renderer (`flipX`), so both boots
point WEST; `smoke-demolisher` checks it live (a v1 Demolisher running west
plays the profile run frames under `flipX`, running east the same frames
unflipped, and turns back into the run on the gait clock).

---

## B. The initial sideways veer

### Deterministic reproduction

`tests/diag-demolisher-veer.mjs` (seeded `Math.random`, frozen `Date.now`,
`game.step` at a fixed 1000/60): hangar, sector 1, base speed, room bodies
off, player standing at (820, 1000), one Demolisher spawned at (820, 420) —
an EMPTY lane, nothing within 500px of the run.

On `785999f`, legacy and `?roster=v1` identically, every tick:

| tick | ms | position | velocity | from spawn | contact | `_stuckRefX/Y` | `_stuckTimer` | sidestep |
|---|---|---|---|---|---|---|---|---|
| 34 | 583 | 820, 595 | 0, 300 | 175px | none | undefined | 583 | — |
| **35** | **600** | 814.5, 595 | **-330, 0** | 175px | none | 820, 595 | 0 | **ARMED 600ms** |
| 36-70 | | drifting west | -330 -> -305, 4 -> 126 | | none | 820, 595 | | armed |
| 72 | 1217 | 634, 650 | 141, 265 | 296px | | | | — |

Sidestep for 36 ticks, ~91deg off the bearing to the player, ~190px sideways,
contact at tick 143 instead of 107. The Elite: armed at the same tick, 157.6px
from spawn. `demolisher-false-stuck-proof.png` is this table, OLD vs NEW.

### Root cause

`Enemy.preUpdate` (the frozen base, ~lines 885-912), for every enemy in swarm
behaviour:

```js
this._stuckTimer += delta;
if (this._stuckTimer >= 600) {
  const moved = Math.hypot(this.x - (this._stuckRefX ?? this.x), this.y - (this._stuckRefY ?? this.y));
  if (moved < 12) { this._stuckSidestepMs = 600; this._stuckSideDir = Math.random() < 0.5 ? 1 : -1; }
  this._stuckTimer = 0; this._stuckRefX = this.x; this._stuckRefY = this.y;
}
```

The reference is UNDEFINED until the first check sets it, so the first check
compares the body with itself: `moved` is exactly 0 however far it ran, and a
600ms perpendicular sidestep is armed (`_moveToward` takes the perpendicular
branch at 1.1x speed while `_stuckSidestepMs > 0`). It is an initialization
bug in the stuck test, not a reaction to anything — no obstruction, no
contact, the same in legacy and v1 (the art flags never touch it).

### Who shares it (inventory — reported, not changed)

Every swarm-behaviour mover that steers with `_moveToward` runs the same first
check: the Gunner (`shooter`) and Rifleman (`grunt`) swarm ticks — including
the `?move=v22` path, which still feeds `_moveToward` its target — the Bulwark
(`shielded`), the Marksman (`sniper`), the Swarmling, the Demolisher, and every
nemesis built on those classes. **Only the Demolisher was reviewed as
defective.** A base-class fix would change the movement of five frozen,
human-approved roles, so it was NOT made; it is the human's decision whether
the others should get the same treatment.

### The correction (Demolisher only)

`EnemyBomber` records where its first window begins (`_stuckOriginX/Y`, set in
its constructor — every production spawn constructs at its final position),
and `_vetoFalseStuck()` runs at the top of its `_tickSwarm`, after the base's
block and before `_moveToward` reads the sidestep (the order
`EnemyShooter.preUpdate` already keeps):

```js
_vetoFalseStuck() {
  if (this._stuckFirstSeen || this._miniBoss) return;
  if (this._stuckRefX === undefined) return;          // the first check has not run yet
  this._stuckFirstSeen = true;
  const moved = Math.hypot(this._stuckRefX - this._stuckOriginX, this._stuckRefY - this._stuckOriginY);
  if (moved >= 12 && this._stuckSidestepMs > 0) this._stuckSidestepMs = 0;
}
```

It re-measures that ONE check the way the base meant to measure it — from
where the window began, with the base's own 12px threshold — and stands the
sidestep down only if the body was in fact moving.

- **The base class is byte-identical**, and so is every class outside
  `EnemyBomber`. **`Enemy.js` changed** only inside `EnemyBomber`: two origin
  fields, one call, one method.
- **Every later check is untouched**, so a genuinely blocked Demolisher still
  recovers, on the base's own 600ms cadence.
- **The random draw is kept**: the base has already drawn `_stuckSideDir`
  before the veto runs, so the RNG stream is the stream it always was.
- **The nemesis is excluded** (`_miniBoss` returns before anything is
  touched; its contact bursts own its movement).
- Not behind `?roster=v1` / `?gait=v2`: legacy and v1 run the identical rush.
- Speed, contact distance, threshold, blast radius / damage, Elite scaling,
  the warning formula, encounter definitions: unchanged (pinned).

**The one cost, stated plainly:** a Demolisher that hits a REAL obstruction
inside its first 600ms (here: a wall 140px from the spawn, reached at 333ms) is
now recovered by the base's SECOND check, at 1200ms, instead of by the false
first one at 600ms — the first window really did show 100px of movement, so by
the base's own definition it was not yet stuck. In the staged wall case that is
contact at tick 208 instead of 172.

### Legitimate stuck recovery still works

`smoke-demolisher` §6c, `demolisher-obstacle-recovery.webm`, and the proof
table's third section: a 360x40 static wall across the lane 140px out. First
check at 600ms: the body is already pinned on the wall but moved 100px in its
window — stood down. It stays pinned (vx 0, vy 0, in contact). Second check at
1200ms: moved < 12px — the base arms the sidestep (36 ticks), the body slides
off the end of the wall and reaches the player. In legacy and v1.

### Replay differences (the permitted divergence)

The seeded BOMBER RUN replay (hangar sector 14, wave 1, 1080 ticks, the player
strafing and firing, 72 checkpoints):

- **with the veto switched off** (a rig counterfactual), this tree is the
  `785999f` game EXACTLY — all 72 checkpoints (positions, velocities, hp, aim,
  pulse, detonation state, collider, animation, player hp + meter, the queue,
  every random draw), every detonation, every hit on the player — legacy and
  v1. That is what proves the veto is the only gameplay change;
- **with the veto**, the fight is identical up to the first vetoed first check
  (tick 81) and first differs at checkpoint 5 (tick 89). Four Demolishers'
  first checks were stood down in the window (they had moved 38, 140, 77 and
  126px). Outcome: 4 Demolisher deaths in both; the player takes 36 hits
  against 37 — the downstream consequence of four bodies no longer veering.
- legacy vs v1 and gait off vs v2 remain the same fight at all 72 checkpoints.

---

## Tests

- `tests/smoke-demolisher.mjs` — 95 checks (77 at the side-gait commit):
  - §2b side run: one pelvis, both boots east (per boot), compact stride, near
    knee drawn, no backward knee, no trailing extension, continuous loop,
    six phases in antiphase with the planted foot only moving backward, the
    cadence contract, front/back + upper-body pixel hashes against
    `785999f`, the approved front/back and idle tables, WEST mirrored live;
  - §6 the counterfactual replay; §6b (with `DEM_OLD`) `785999f` vs this tree
    with the veto off (identical) and on (identical until the first veto);
  - §6c fresh spawn in a clear lane (legacy / v1 x Regular / Elite), legacy ==
    v1 tick for tick, a real obstruction (legacy / v1), six fresh
    Demolishers at once (legacy / v1);
  - §5 the nemesis never runs the veto; §7 the narrowed `Enemy.js` guard.
  - **A/B:** against `785999f`, 12 of the 20 §2b checks fail (the 8 that hold are the invariance hashes, the unchanged tables, the cadence contract and the live mirror, which must hold on both) and all 8 of the
    false-stuck checks that can fail do (the legacy == v1 property holds on
    both builds, as it should).
- `tests/enemy-frozen.mjs` — the narrowed guard, imported by
  `smoke-bulwark`, `smoke-roster-2b` and `smoke-demolisher`: identical to
  `3ce5680` outside `EnemyBomber`; inside it, deleting the veto gives back the
  `3ce5680` class byte for byte; the veto's code is pinned. Negative-tested by
  injecting an edit into the base, into the veto and elsewhere in
  `EnemyBomber` — each one fails it.
- `tests/diag-demolisher-veer.mjs` — the per-tick instrument.

Regression, on the corrected tree: `smoke-bulwark` 92/92, `smoke-roster-2b`
74/74, `smoke-roster-gunner` 72/72, `smoke-roster-seams` 70/70,
`smoke-gait-v2` 16/16, `smoke-move-v2` 9/9, `smoke-champion-placement` 60,
`smoke-vanguard-screen` 22, `smoke-vanguard-front` 30,
`smoke-vanguard-reinforce` 26, `smoke-encounters` 25, `smoke-encdbg` 33 — all
green; production build green. `smoke-demolisher` 77/77 at `a7d18d2` and 95/95
at `fca7fa5`, both with `DEM_OLD` on `785999f`.

In the real-encounter clips the corrected build stood down 10 false first
checks in the BOMBER RUN and 4 in MIXED, and the base still armed 4 real
sidesteps in each (bodies meeting cover) — stuck recovery working in play.

## Evidence (`tests/shot-demolisher-correction.mjs`, live runtime, seeded, stepped)

OLD = a server on `785999f`, NEW = this tree, the same script in lockstep.

| file | what |
|---|---|
| `demolisher-side-gait-ab.png` | OLD vs corrected, Regular and Elite: idle, the six run frames, the brace — at 1x and 3x |
| `demolisher-side-anatomy.png` | hip / knee / ankle / toe overlay, corrected EAST and WEST, OLD EAST for reference; planted solid, swinging dashed |
| `demolisher-side-gait-live.webm` | 1x horizontal chase, OLD over NEW, Regular + Elite, an east pass then a west pass, 3x inset |
| `demolisher-side-gait-turn.webm` | 1x, a Regular lap then an Elite lap of a wide flat ellipse: lateral runs and the facing transitions at each end |
| `demolisher-false-stuck-proof.png` | per-tick table: time / position / velocity / progress / obstacle / stuck reference / timer / sidestep / branch / draws — OLD vs NEW clear lane, NEW obstruction |
| `demolisher-veer-ab.webm` | **the veer**: same seed, room and staging, LEFT `785999f`, RIGHT corrected, 1x, then the 0.4-1.4s window at 1/4 speed. Dashed: the straight line to the player; solid: the path run; red ring: sidestep armed |
| `demolisher-obstacle-recovery.webm` | a real wall: OLD arms at 600ms (falsely, but on the wall), NEW at 1200ms (legitimately); both get round |
| `demolisher-correction-bomber-run.webm` | real BOMBER RUN (hangar, sector 8, wave 2), corrected build, 1x, with a live count of first checks stood down and real sidesteps |
| `demolisher-correction-mixed.webm` | real MIXED (detention, sector 12), corrected build, 1x |

The gait clips SEED the stuck reference at spawn in both halves so a gait
comparison is not interrupted by the old build's veer (the veer clip is the
veer); the turn clip puts a runner that catches the player back across the
loop (both halves) — a staging device, labelled.

## Remaining defects at 1x

- The profile stride is short by design; at 300px/s and 32fps the six frames
  turn over fast and the low swing reads mostly as a shuffle of the boots
  under the pelvis rather than as a lifted knee — the knee is one or two
  logical pixels at 1x.
- The profile STRAFE (moving vertically while facing sideways — rare for a
  rusher) keeps its approved table; in one of its six frames the far toe-cap
  is hidden behind the near shin (occlusion).
- A Demolisher that meets a real obstruction inside its first 600ms recovers
  600ms later than on `785999f` (above).
- The other five archetypes (and the nemesis) still take the false first
  sidestep at 0.6s — not reviewed as defective, deliberately not changed.

## What the human should judge

1. The profile run at 1x on a phone: does he read as running on two legs from
   one pelvis, with both feet pointing the way he runs, east AND west — no
   split, no hop, no reversed trailing boot? (`demolisher-side-gait-live`,
   `-turn`, and the handset URLs below.)
2. A fresh Demolisher's first second: does he commit straight at you now, with
   no unexplained sideways dodge at ~0.6s? (`demolisher-veer-ab`.)
3. When a Demolisher genuinely hits cover, does he still get round it?
   (`demolisher-obstacle-recovery`, and any room with cover.)
4. Whether the same first-check sidestep should also be removed from the other
   roles — that is a shared change to five frozen roles and needs your call.

## Handset

- BOMBER RUN: `https://xletof.github.io/crix/?roster=v1&gait=v2&move=v22&encdbg=bomberRun&room=hangar&sector=8&wave=2`
- MIXED: `https://xletof.github.io/crix/?roster=v1&gait=v2&move=v22&encdbg=mixed&room=detention&sector=12&wave=1`
- legacy A/B (the veer fix holds here too): `https://xletof.github.io/crix/?move=v22&encdbg=bomberRun&room=hangar&sector=8&wave=2`
