# Why the Marksman and the Bulwark stop fighting — root causes, quantified

Phase 3C-B. Diagnosis only; nothing here changes gameplay. Source `7f017a4`.
Every number is from `tactical-engagement-metrics.csv`, produced by
`node tests/diag-tactical-engagement.mjs` (`--report` prints the tables below
from it). It is a RECONSTRUCTION of the handset encounter — the recording is
not available (`failed-handset-analysis.md`).

## The sample

* **123 encounter runs**, 40s each, seeded, real spawner, real rooms: MIXED
  ASSAULT (Detention, sector 12, wave 2) × 7 player behaviours × 3 seeds × 3
  variants (63 runs); SNIPER NEST (Detention, sector 8, wave 2) × 4 × 3 × 2
  (24); VANGUARD without and with the Captain (Hangar, sector 8, wave 2) ×
  3 × 3 × 2 each (36). Variants: **frozen** (the handset flags
  `roster=v1&gait=v2&move=v22`, no stuck flag), **mkB** (+ `marksmanStuck=early`
  — the handset URL), **bwB** (+ `bulwarkStuck=early`).
* **539 subject actors** (ordinary Marksmen and Bulwarks), 16,712s of live
  time, plus 629 CONTROL actors (the Gunners and Riflemen in the same fights).
* **72 staged runs** in the real Detention room (M1-M7, B1-B5, B7), 2 seeds
  each — identical across seeds, because a standing player and a lone actor
  draw the same numbers.
* Seeds are few. **No significance is claimed** for any between-variant
  difference below a few percentage points; the staged cases are deterministic
  and are the clean evidence.

"**Blind standing**" below = the body moved under 30px/s this tick, the line
was not open (`canSee && _hasLOS` false, exactly the fire gate), and it was not
charging. It is the measured form of "waiting instead of attacking".

## Headline

| family | variant | role | actors | blind standing | of which in its HOLD / screen hold | longest blind |
|---|---|---|---|---|---|---|
| MIXED | frozen | **Marksman** | 63 | **42.6%** | 97% | 34.3s |
| MIXED | mkB (the handset URL) | **Marksman** | 63 | **41.0%** | 98% | 35.3s |
| MIXED | bwB | Marksman | 63 | 40.9% | 98% | 37.9s |
| MIXED | frozen | **Bulwark** | 35 | **20.1%** | 89% | 31.4s |
| MIXED | mkB | Bulwark | 35 | 22.2% | 91% | 32.9s |
| MIXED | bwB | Bulwark | 35 | 19.0% | 92% | 34.6s |
| MIXED | frozen | Gunner — control | 42 | **4.7%** | — | 2.9s |
| MIXED | frozen | Rifleman — control | 49 | **2.1%** | — | 2.3s |
| SNIPER NEST | frozen | **Marksman** | 51 | **46.6%** | 99% | 34.6s |
| SNIPER NEST | mkB | Marksman | 56 | 52.0% | 100% | 36.1s |
| SNIPER NEST | frozen | Rifleman — control | 97 | 1.8% | — | 1.5s |
| VANGUARD | frozen | Bulwark (screen) | 30 | 21.1% | 89% | 25.5s |
| VANGUARD + Captain | frozen | Bulwark (screen) | 39 | 13.5% | 85% | 24.7s |

By player behaviour (MIXED, frozen), the Marksman's blind standing is 10%
running the room's edge (`behind`), 18% retreating, 31% charging it, 43% for
the `handset` loop, 62% cover-hopping, 65% circling a console and **74%
hiding** — where the median Marksman's longest blind hold is 31.4s of a 40s
run. The Bulwark: 7% / 11% / 1% / 32% / 39% / 17% / 34%.

**In the same fights, against the same player, the two roles with a LOS-aware
movement rule stand blind 2-5% of the time; the two without one, 20-47%.**
That contrast is the finding.

## A — Tactical decision failure: the HOLD never asks "can I shoot from here?"

**Dominant cause, both roles.**

Both holds are pure distance rules (`engagement-callpath-matrix.md`): the
Marksman stands anywhere in 300..640, the free Bulwark anywhere inside 290.
Neither branch reads the line. 97-100% of the Marksman's blind standing and
85-92% of the Bulwark's is spent in exactly that branch.

Neither reacts when the line goes. Of the episodes in which a subject sat in
its hold with the line cut for a second or more:

* Marksman, MIXED frozen: **110 of 148 never moved at all** before the line
  came back on its own (the player walked into it) or the run ended; SNIPER
  NEST: 62 of 88.
* Bulwark, MIXED frozen: **53 of 66**.
* the rest "moved" only because the player crossed a band edge and the frozen
  tick itself switched to APPROACH (every moving tick inside a blind hold in
  the per-tick record is a `_moveToward` call or its sidestep, and only the
  APPROACH branch calls it) — never because of the line. The HOLD branch writes
  zero velocity and nothing else.

Staged, without the noise of a fight: a Marksman 520px from a player standing
behind the heavy console (**M2**) makes **0** attempts in 20s; so does the
Elite (M2e), so does M3 (player shuffling behind the same console), so do two
of the three Marksmen in M7. The positive control M1 (open line) charges 6
times and fires 5. A Bulwark closing on the same player (**B2**) stops at
289px — 1px inside its rule — and stands for 18.25s; B5's three Bulwarks all
stop the same way. Control B1 fires 10 times.

The Marksman is READY the whole time: its cooldown counts down blind
(`fireCd` stood at −13,929ms fifteen seconds into M2). When the line reopens it attacks
within a mean **58ms** (MIXED frozen, 232 reacquisitions). It is not slow; it
is waiting for the player to come back.

## B — Missing firing-position selection

**Contributing cause, both roles — the missing half of A.**

A spot with a line existed, nearby, essentially always:

* **Reachable on the NavGrid**: in 100% of blind samples (every role, every
  family, every variant). For the 61 Marksman blind holds of 3s or longer in
  MIXED (frozen), the nearest such spot was a median **119px** of path away;
  Bulwark holds, 254px (2 holds) to 105px (bwB, 4 holds).
* **Walkable in a STRAIGHT LINE, on the role's own band, at about its own
  range** (the deterministic `lineSpot` search: `_standable`, a line to the
  player, `_scoreSpot`'s three-ray body test): 57 of those 61 Marksman holds
  had one, and within each hold the nearest came to a median of **40px** — the
  first lateral step the search tries. Across ALL blind samples the mean
  distance is ~150-250px (the console's shadow is wide when the player hugs
  it: ~65° from 55px away, which is why M2 needs 310px).
* B2's Bulwark had a straight-line spot **51px** along its arc on every sample.

The machinery to find such spots is already in the class hierarchy:
`EnemyShooter._standable`, `_scoreSpot` (+4 for a line to the player, +0.75 for
each ±40px lateral line, crowding penalties) and `_pickDest` — the approved
v2.2 movement. Both subjects inherit it and call none of it, because both
override `_tickSwarm`.

## C — Movement execution

**Minor. Not what distinguishes the subjects.**

| MIXED, frozen | blind standing | pressing a wall | moving without progress | stuck sidestep |
|---|---|---|---|---|
| Marksman | 42.6% | 4% | 1% | 5% |
| Bulwark | 20.1% | 7% | 3% | 5% |
| Gunner (control) | 4.7% | 8% | 0% | 4% |
| Rifleman (control) | 2.1% | 6% | 0% | 4% |

The controls press walls as often as the subjects and barely stand blind; a
wall is not what is stopping the subjects. Straight-line approach into cover
does fail in specific geometry (staged **M4a**: a Marksman approaching head-on
into the post spends 8.4s pressing it; **B4**: a Bulwark between the post and a
bunk) and the two stuck candidates move those numbers in both directions —
see "the stuck corrections" below — but in the fights it is a few percent.

**Blocked retreat** is real and harmless here: in **M5** a Marksman retreating
into the heavy console presses it for 13.4s — and keeps firing (5 shots, line
open 100%), because the player it is backing away from is in front of it. In
the encounters `RETREAT_BLOCKED` is ≤1% of Marksman life.

## D — The geometry representations

**Not a cause of passivity. Two real disagreements, one dead system.**

* Physics, LOS and bullet blocking are ONE representation (the `walls` bodies),
  so "can see" and "can hit" never disagree.
* **NavGrid**: 0 of 33,160 reachability samples (every subject, every
  encounter run, one every 0.5s) found the player unreachable. Detention is open; the only sub-body gap (bench
  ↔ post, 45px) is closed to every role and NavGrid agrees.
* **Sprite ≠ body**: consoles draw a 21px visual-only frame on every side; the
  bunks' upper 44px and the post's upper **170px** are walk-through and
  see-through. The human's "going around visual obstacles" is judged against
  the picture; the AI's line is judged against the body. A player can believe
  they are hidden in the post's visual shadow and not be.
* **Concealment is dead**: cover consoles are registered as bushes that hide a
  centre within 48.4px; a colliding player cannot get closer than 56.5px. Not
  one tick of any staged or encounter run had the player concealed, and no
  enemy was ever blinded by anything but LOS.

## E — The firing pipeline

**Secondary for the Bulwark; not a Marksman cause.**

* **Bulwark**: `_maybeFireAt` freezes the cooldown while blind, so a reopened
  line still owes the remainder. After a line comes back (≥0.5s blind), the
  first WARN arrives a mean **742ms** later (max 1.7s, MIXED frozen, 123
  reacquisitions), and **44 more reacquisitions (26%) lost the line again
  before any attack at all**. The Gunner, on the same pipeline with a shorter
  cooldown, takes 368ms.
* **Marksman**: attacks within ~50ms of a reopened line. Charges do get
  cancelled by a flickering line (163 cancels against 292 shots, MIXED frozen;
  staged M6: 3 cancels, 5 shots in 20s) — that is the frozen, approved
  cancel-on-LOS-loss semantics working as designed, and a line it keeps would
  remove most of them.
* **Observed in the CONTROL, out of scope, frozen code**: v2.2's "plant for
  the shot" zeroes a Gunner's velocity while `_warnFlashed && fireCd < 160`,
  and `fireCd` stops counting once the line is lost — so a Gunner that loses its
  line inside the last 160ms of its warning stands still until the line comes
  back. Measured live (VANGUARD, `hide`): `velocity 0`, `_warnFlashed true`,
  `fireCd` frozen at 35ms and 133ms, for 16-28s; seven such holds, all in the
  Hangar. It does not touch the subjects and is reported, not fixed.

## F — Group interference

**Minor.** There is no enemy-enemy collider. A subject had a mean of 0.3-0.55
other enemies within 60px (screens 1.1-1.5, which is the formation). Staged
M7 / B5 show the real effect: several bodies run the SAME blind rule against
the same cover and all stop behind it — the stacking is a consequence of A, not
a separate failure.

## G — Authored, intentional holds

**VANGUARD's screen hold is a formation, and it is protected.** Every Bulwark
drawn while VANGUARD runs is a screen (closes to 140, holds until 165). Screens
stand blind 13.5-21% of their life, 85-89% of that in the formation hold, with
the long holds (24-27s) behind the Hangar's `ch-crate-a` while the player
hides. That is the frozen screen behaving as approved; whether a screen should
ever re-angle is a VANGUARD design question with its own gates. VANGUARD has no
Marksmen.

## The stuck corrections

**They neither cause nor cure this.** Blind standing under the handset URL's
`?marksmanStuck=early` is 41.0% against 42.6% frozen (MIXED) and 52.0% against
46.6% (SNIPER NEST); under `?bulwarkStuck=early` the Bulwark is 19.0% against
20.1%. Nothing in a blind hold is stuck: the body is where its rule put it.
Two staged cases show the corrections changing WHERE a body ends up, which then
decides whether the blind hold is near a line:

* **B2**: frozen, the false first stuck check sidesteps the Bulwark east and it
  stops 51px from a line; under the approved `?bulwarkStuck=early` there is no
  false sidestep, it stops dead-centre behind the console, 162px from one;
* **M4a**: frozen, the false skate offsets the approach and one seed reaches a
  line (5 shots); under `?marksmanStuck=early` neither seed does — the 3C
  finding ("removing the false skate exposes head-on cover") again.

**Real physical stuck** in this data: M5 (blocked retreat, still firing), M4a
and B4 (head-on approach into the post / the post-bunk pocket), and the few
percent of "pressing a wall" in the fights. Everything else is a decision.

## Cause ranking

| | cause | Marksman | Bulwark (free) | screen |
|---|---|---|---|---|
| A | hold never asks whether it can shoot; no reaction to a lost line | **dominant** — 97% of 42.6% blind | **dominant** — 89% of 20.1% | authored (G) |
| B | no firing-position selection (a spot ~40-120px away existed) | **dominant, with A** | **dominant, with A** | n/a |
| E | cooldown frozen while blind | none (counts down) | secondary — 742ms per reacquisition, 26% lost first | secondary |
| C | straight-line movement into cover | minor (≤5%), geometry-specific | minor (≤7%) | minor |
| F | stacking on the same blind spot | consequence of A | consequence of A | formation |
| D | sprite/body/concealment disagreement | perception only | perception only | perception only |
| — | stuck recovery | not involved | not involved | not involved |
