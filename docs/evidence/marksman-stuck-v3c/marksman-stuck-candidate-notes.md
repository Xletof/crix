# Phase 3C — Marksman-only stuck-recovery candidates

**Status: two opt-in candidates, awaiting human handset review. Nothing here
is approved, nothing is frozen, and no candidate is the default.**

| flag | what it is |
|---|---|
| *(none)* | the frozen game — `f752b3f` tick for tick, draw for draw (smoke §1) |
| `?marksmanStuck=prog` | **Candidate A** — the window rule |
| `?marksmanStuck=early` | **Candidate B** — A plus approach-pinned evidence, added on two failed tests |

Branch `claude/relaxed-faraday-swav9o`; A `971e747`, B `f0455a8`. Everything
below is measured on the real URL flag in a real page, seeded, 60Hz fixed
step, with the Phase 3A instrument observe-only. Raw rows:
`marksman-stuck-metrics.csv` (and the per-section `marksman-metrics-*.csv`).

## 1. Scope and seam

- **Module** `src/systems/marksmanStuck.js`. Installed per bearer from
  `GameScene.spawnEnemyAt` when `type === 'sniper' && !spec.legacyArt` —
  ordinary Marksman, Regular and Elite. Never the nemesis Marksman
  (`_spawnMiniBoss` passes `legacyArt: true`), never any other role.
- **It shadows two of the bearer's own methods** (`_tickSwarm`,
  `_moveToward`), calling the class's originals unchanged. `Enemy.js` —
  `Enemy.preUpdate`, `_moveToward`, `EnemySniper._tickSwarm`, the laser — is
  byte-identical to `f752b3f` (smoke §16d, `enemyJsGuard` §16e). No protected
  file needed touching, so the brief's STOP condition never arose.
- **Flag plumbing**: `debug.js` (`setMarksmanStuck` accepts `prog` / `early`
  only), `BootScene` reads `?marksmanStuck=`. Independent of `?roster=`,
  `?gait=`, `?move=` and `?bulwarkStuck=`. `smoke-stuck-audit` §0 allows
  exactly the five opt-in files and the exact seven GameScene code lines.
- **The weapon is never read or written** — not `_charging`, `_chargeMs`,
  `_lockAngle`, `fireCd`, `laser`, `_hasLOS`, `canSee`, `_aim`, `cfg`, hp or
  damage; no `setVelocity` (smoke §16c greps the stripped source).
- **No random number, timer, tween, listener or scene event** (§15b, §16b).

## 2. Part A — the failure, diagnosed on the frozen build

The frozen block (`Enemy.preUpdate`): every 600ms, `moved =
hypot(x - (_stuckRefX ?? x))`; under 12px it arms a 600ms perpendicular
sidestep (one draw). Its ONE consumer is `_moveToward`, and the Marksman's
tick has three branches — APPROACH beyond 640 (`_moveToward` at 0.7x, the only
branch that can TAKE a sidestep), HOLD 300-640 (`setVelocity(0,0)` on purpose),
RETREAT inside 300 (`setVelocity` straight away). `marksman-metrics-diag.csv`,
3 seeds x Regular/Elite, seed 1001 shown:

| sequence | frozen behaviour |
|---|---|
| clear approach | the first check reads 0px after ~60px of open approach: **F1 armed AND TAKEN** at 583ms — 600ms, 69px (R) / 62px (E) sideways |
| hold | every check in the band arms (`H1`, then `HOLD`) — never taken while holding |
| hold → approach | the HOLD arm (made while charging) is **TAKEN** on the first approach tick: 300ms, 35px / 31px |
| approach → hold | F1 taken on the way in (as clear) |
| hold → retreat, retreat → hold, osc. near 300 | arms every check, **never taken** — the retreat never calls `_moveToward` |
| osc. near 640 | 1500ms, 173px / 156px sideways: every crossing outward takes the last HOLD arm |
| crossing behind | 1250ms, 144px / 132px sideways (F1 + HOLD taken on re-approach) |
| retreat → approach (Elite) | a retreat pinned on the north wall arms `BLOCK` for 3.6s; the approach that follows — the OPPOSITE direction — **takes** it: 61px |

So the Marksman's false movement has THREE sources: F1, HOLD and RETREAT
arms, each of which only becomes motion on the next APPROACH tick.

## 3. The rule

**Commanded to APPROACH + genuinely unable to progress → recover.** Both
candidates review each base check at the top of the bearer's next AI tick —
after the base block has armed it, before `_moveToward` can take it — and
never arm on their own clock or draw a number.

**Candidate A** stands an arm down when:
- **F1** — it is the first check and the body really moved ≥ 12px from its
  spawn point (the Demolisher's approved re-measurement);
- **HOLD / RETREAT** — under half of the window's AI decision time was
  approach-commanded. Intent is read from what the tick COMMANDED: a
  `_moveToward` call is an approach; otherwise the velocity the tick just
  wrote (before physics) is a retreat if non-zero and a hold if zero. Never
  from measured motion. **A retreat is not called stationary** — it is a
  commanded move the recovery cannot serve (its consumer runs the other way);
  it is logged separately as `retreatBlocked`, and the blocked retreat itself
  is left to the frozen game (§9).

Every other arm — an approach that made no progress — is kept; the recovery
itself (direction, 600ms, 1.1x the approach speed) is the base's own.

**Candidate B** — added on two FAILED TESTS against real cover (§5), not to
match the Bulwark:
- **KEEP** an arm A would stand down while the body is approach-PRESSING
  (the last step was an approach into a face it is blocked on, head-on enough
  to keep < 30% of its progress) or approach-PINNED (an unbroken ≥ 50ms run
  of approach steps in contact making < 30% of their commanded progress).
- **ARM** a check the base declined when approach-pinned — at the base's
  instant, for the base's 600ms, in the direction the base LAST drew
  (`_stuckSideDir`). No new random draw.
- **Marksman-specific limits:** a RETREAT step is never evidence (it is not a
  `_moveToward` call), so a pinned retreat neither keeps nor arms anything —
  smoke §10d shows A and B identical there. And a step that CONSUMED a
  sidestep is the recovery, not an approach: it breaks the run instead of
  re-arming the same direction into whatever stopped it.

## 4. Staged transitions (6 seeds x Regular/Elite per cell)

`marksman-metrics-staged.csv`. Sidesteps TAKEN (sum over 6 seeds) and mean
sideways ms per run:

| sequence | baseline R / E | A R / E | B R / E |
|---|---|---|---|
| clear | 6 F1 / 6 F1 — 600 / 600ms | **0 / 0** | **0 / 0** |
| hold | 0 / 0 | 0 / 0 (60 / 60 stood) | identical to A |
| hold → approach | 6 HOLD / 6 HOLD — 300 / 300ms | **0 / 0** | **0 / 0** |
| approach → hold | 6 F1 / 6 F1 — 600 / 600ms | **0 / 0** | **0 / 0** |
| hold → retreat | 0 / 0 | 0 / 0 | 0 / 0 |
| retreat → hold | 0 / 0 | 0 / 0 | 0 / 0 |
| retreat → approach | 6 HOLD / 6 BLOCK — 600 / 583ms | **0 / 0** (E: 36 retreat arms stood) | identical to A |
| osc. near 300 | 0 / 0 | 0 / 0 | 0 / 0 |
| osc. near 640 | 30 HOLD / 30 HOLD — 1500 / 1500ms | **0 / 0** | **0 / 0** |
| crossing behind | 6 F1 + 9 HOLD each — 992 / 1009ms | **0 / 0** | **0 / 0** |

- **Hold-only sequences are byte-identical to baseline** in both candidates:
  every position, every tick (smoke §5, `holdRetreat` / `retreatHold` /
  `osc300` traces). Standing an arm down while holding changes nothing that
  moves, because the base never takes it there.
- **Resumes walk at the player**: 72 / 78 hold → approach resumes in the 640
  oscillation, none takes a sidestep (baseline: all 42 do), heading error
  ≤ 10 degrees (smoke §4).
- **The lock no longer skates.** In the 640 oscillation the frozen game takes
  20 (R) / 28 (E) sidestep ticks INSIDE locked 260ms windows — the beam's
  origin sliding sideways under a locked angle. A and B: 0.

## 5. Obstacles — why B exists (6 seeds x Regular/Elite = 12 runs per cell)

`marksman-metrics-obstacle.csv`, R+E pooled. *reached* = runs that reached
the hold band; *pinned* = runs ending in contact on an approach; *act* = mean
ms from first contact to the first recovery; *band* = mean ms to the band.

| obstacle | mode | reached | pinned | act ms | band ms | false side |
|---|---|---|---|---|---|---|
| **console 70x70, 90px ahead** (contact ~0.3s, INSIDE the first window) | baseline | 12/12 | 0 | 366 | 5667 | 0 |
| | A | 12/12 | 0 | **966** | **6267** | 0 |
| | **B** | 12/12 | 0 | **366** | **5667** | 0 |
| console 70x70, 270px ahead | baseline | 12/12 | 0 | 917 | 6016 | 600 |
| | A | 12/12 | 0 | 958 | 6258 | 0 |
| | **B** | 12/12 | 0 | **358** | **5658** | 0 |
| cover 90x90 head-on | baseline | 12/12 | 0 | 1067 | 6092 | 600 |
| | A | **10/12** | 1 | 1058 | 6963 | 0 |
| | **B** | **12/12** | 0 | **458** | 6292 | 0 |
| angled cover (offset 70px) | baseline | 12/12 | 0 | 942 | 6196 | 600 |
| | A | 12/12 | 0 | 1025 | 6542 | 0 |
| | **B** | 12/12 | 0 | **425** | 6284 | 0 |
| long wall 320x40 | baseline | 9/12 | 3 | 816 | 11448 | 600 |
| | A | **6/12** | 5 | 800 | 12066 | 0 |
| | **B** | **9/12** | 3 | **200** | 11035 | 0 |
| hold → approach into a 240 wall | baseline | 7/12 | 4 | 933 | 11138 | 300 |
| | A | 5/12 | 6 | 633 | 11257 | 0 |
| | **B** | 7/12 | 5 | **333** | 11736 | 0 |
| hold beside a wall | all | — | 0 | — | — | 0 (identical; no sidestep in any mode) |
| retreat into cover | all | — | 0 | — | — | 0 (identical motion; A/B log 12 `retreatBlocked`) |

**The two failed tests that justify B:**
1. **A stands down a correct first arm.** Cover met INSIDE the first window
   (contact ~0.3s): the F1 arm is false by the open-travel test but the body
   is pinned on the console when it is reviewed, and A delays real recovery
   by exactly one window (activation 283 → 883ms Regular, 450 → 1050ms
   Elite; band +600ms). B keeps it (exactly one `keptPinned` in each of
   the 12 runs) and matches baseline on every number in the table.
2. **A meets head-on cover worse than the frozen game.** The frozen F1 skate
   pre-offsets every approach by ~65px, which accidentally clears cover on
   the line. Without it A hits that cover square, and the base check that
   follows contact reads the walk-in (≥ 12px) and declines, so recovery
   waits a second window: cover90 10/12 and the 320 wall 6/12 (R+E),
   against the frozen 12/12 and 9/12. B arms that check when approach-pinned (exactly
   one `armedPinned` per run, at the first check after contact), activation
   200-460ms, and reaches the band exactly as often
   as the frozen game on every row (cover90 12/12, the wall 9/12). Its mean
   time-to-band ranges from 0.4s faster (the wall, the 270px console) to
   0.6s slower (hold → approach into the 240 wall) than baseline's.

**Residual:** the 320px wall and a hold-then-approach into a 240px wall
still fail in some seeds in EVERY mode. That is the base's own recovery — a
random perpendicular direction per arm, i.e. a random walk along the wall —
and B does not replace NavGrid. The one cell where B is not ≥ baseline is
hold→approach-into-wall *pinned* (5 vs 4 of 12); *reached* is equal (7/12).
On 12 random walks that is one run.

## 6. Sniper combat — invariance (Part C)

`marksman-metrics-charge.csv`: seven player behaviours x Regular/Elite x 6
seeds, every charge listed (`charge-each`).

- **Every fired charge in every mode** is the same 800ms windup (49 sampled
  rows from start to shot), the same 260ms lock (16 rows), a lock that never
  moves, and a shot that leaves on exactly the locked angle (`lockSteady` and
  `shotEqLock` 1 on all 277 / 280 / 280 shots). The next cooldown lands in
  1599..2165 (the frozen 0.85-1.15 x 1900 draw less one tick) in every mode.
- **Charge sequences are identical to baseline** — same start tick, end tick,
  shot angle and next cooldown, charge for charge — when the player is still,
  strafing laterally, dashing across the locked laser, or closing inside
  retreat range, Regular and Elite (smoke §7a).
- **Crossing behind / moving beyond approach range:** shot counts differ by
  0-2 per six runs because the Marksman's POSITION differs (no skate), which
  is an authorized downstream engagement difference. The charge rule is the
  same rule in every case (above).
- **LOS:** a player strafing across a pillar's shadow cuts every charge —
  30 cancels per role in every mode, on the same ticks, each with the frozen
  500ms re-arm, and the next charge starts once LOS returns (smoke §8).
- **Retreat**: every retreat step is the actor's own speed (150px/s Regular,
  135 Elite — `_makeElite` x0.9) straight away from the player, and the
  retreat sequences are byte-identical across modes (smoke §5).
- **Band thresholds**: 298px retreats at full speed, 302 / 560 / 638 hold,
  642 / 900 approach at 0.7x — identical in all modes (smoke §6).
- **Config untouched**: speed 150, desiredRange 560, retreatRange 300,
  windup 800, lock 260, cooldown 1900, hp, radius, bullet range — byte
  identical (`config.js` diff empty against `f752b3f`).
- One observed downstream case, explained: in the staged *approach → hold*
  run, A/B's on-axis Marksman starts a charge as the player walks into the
  hangar's bush at (800, ~1100); `canSee` drops (`hiddenInBush`) and the
  FROZEN rule cancels it. The frozen game's skated-off-axis Marksman starts
  its charge later. Same rule, different position.

## 7. Encounters — SNIPER NEST (primary gate) and MIXED (Part E)

`marksman-metrics-enc.csv`: the real spawner (`?encdbg=`, detention), 2400
ticks (40s), 6 seeds, a scripted player that strafes, retreats, flanks,
crosses behind and fires (Supers at 15s and 28.3s) — the same script in
every mode. Once one Marksman moves differently the spawns, kills and wave
clock differ, so the summary (`enc-summary`) pools every ordinary Marksman
(Regular + Elite) and reports **rates per live Marksman-minute**.

| SNIPER NEST, sector 8 | baseline | A | B |
|---|---|---|---|
| sidesteps taken — false F1 / HOLD / contact | 15 / 54 / 7 | **0 / 0** / 11 | **0** / 2* / 2 (+13 B-armed) |
| sidestep time, s per Marksman-min | 3.23 | **0.67** | **0.99** |
| sideways direction changes per min | 9.81 | 2.24 | 3.28 |
| lateral px per min — sidestep / other | 415 / 68 | 87 / 83 | 117 / 77 |
| cover contact, s per min (pinned time) | 1.50 | **2.20** | 1.59 |
| charges started / fired / cancelled per min | 17.3 / 10.9 / 6.4 | 17.1 / 10.6 / 6.5 | 17.3 / 10.7 / 6.6 |
| locks that skated (sidestep inside a 260ms lock) | 10 | **0** | **0** |
| LOS share / mean range / band A·H·R | 0.52 / 581 / .31·.62·.07 | 0.50 / 578 / .29·.65·.06 | 0.52 / 585 / .30·.64·.06 |
| moving while in the hold band | 1.9% | 1.5% | 1.2% |
| Marksman hits on the player per run (220 each) | 4.83 | 4.83 | 5.67 |

\* B's two HOLD-class sidesteps are arms B KEPT because the body was
approach-pinned at the check (`keptPinned` 2): a hold window that ended with
the player stepping out and the Marksman already against cover.

| also measured (same columns) | sidestep s/min base → A → B | contact s/min | fired/min | lock skates | Marksman hits/run |
|---|---|---|---|---|---|
| SNIPER NEST + `roster=v1&gait=v2&move=v22` in all halves | 3.21 → 0.39 → 0.75 | 2.21 → 1.34 → 1.26 | 11.4 / 11.6 / 11.3 | 10 / 0 / 0 | 5.17 / 5.00 / 5.50 |
| MIXED, sector 12 | 3.38 → 0.14 → 0.42 | 2.90 → 2.39 → 2.42 | 10.8 / 11.5 / 12.3 | 0 / 0 / 0 | 3.50 / 3.33 / 3.67 |
| MIXED + `?bulwarkStuck=early` in ALL halves | 2.58 → 0.11 → 0.22 | 2.95 → 2.09 → 2.05 | 11.6 / 12.7 / 11.9 | 5 / 0 / 0 | 3.00 / 3.67 / 3.00 |

(MIXED: 5 of 6 seeds — seed 24758 spawns no ordinary Marksman in 40s, and
is identical in every mode.)

**What it says.** Every false F1 and HOLD sidestep is gone in every
encounter; the remaining sidestep time is genuine contact recovery. The
weapon is unchanged in rate — charges started, fired and cancelled per
Marksman-minute move within ±0.5 in SNIPER NEST, and the range, LOS share
and band split are the same — and the lock no longer slides. A pays for its
missing evidence in SNIPER NEST: 47% more time grinding cover than baseline;
B is at 1.06x. Player-hit totals (all sources) move with the whole fight
and are not attributed; Marksman hits are within run-to-run noise.

## 8. Isolation, RNG and attribution

- **No ordinary Marksman, no change**: CROSSFIRE, SWARM TIDE, VANGUARD +
  Captain and BOMBER RUN, 3 seeds each, 1800 ticks — positions AND draws
  identical to baseline under A and B in all 24 runs
  (`marksman-metrics-iso.csv`).
- **Staged crowds** with every other archetype and a nemesis Marksman on the
  floor are identical every tick and every draw (smoke §13); the nemesis
  Marksman alone is identical and still takes its frozen first sidestep
  (smoke §12).
- **Bulwark Candidate B** behaves and logs identically with the Marksman
  flag on or off (smoke §14), and neither module installs on the other's role.
- **No draw is added or removed.** In every staged run positions part on the
  stood-down check itself and draws only later or never (smoke §15). Of the 48 encounter A/B runs, 44 diverge, and in every one
  the first position divergence is at or after the candidate's first
  intervention (exactly on it in 40) and the first draw divergence later still; the
  other 4 (MIXED seed 24758, no ordinary Marksman) are identical.

## 9. Known limits and tracked defects

- **Long walls are still the base's random walk.** Each arm picks a random
  perpendicular direction, so a Marksman behind a 320px wall dead-centre
  needs ~3 net same-side sidesteps; 3 of 12 runs stay pinned in baseline and
  in B (A: 5). B does not replace NavGrid and was not meant to.
- **A blocked RETREAT is a separate defect, NOT fixed here.** A Marksman
  backing into cover or a wall while the player is inside 300px keeps
  pressing (`setVelocity` has no recovery at all), in every mode — measured
  12/12 `retreatBlocked` in the retreat-into-cover case, identical motion in
  all three. The brief excludes redesigning retreat obstacle avoidance; it is
  tracked, not touched.
- **B's armed recoveries reuse the base's last drawn direction** (no new
  draw). On a wall that is sometimes the side it just failed on; the next
  base arm redraws.
- **Encounter outcomes differ downstream** (spawn and kill timing, total
  player hits) — authorized by the brief; the charge and lock rules are the
  same rules in every mode (§6).

## 10. Performance

12 Marksmen (Regular/Elite alternating), 600 ticks, median of 5 repeats,
measured three times: baseline 0.34 / 0.31 / 0.46, A 0.33 / 0.33 / 0.37,
B 0.45 / 0.40 / 0.36 ms per tick; p50 0.3-0.4 in every mode. Noise.

## 11. Evidence

All 1x, AI live, real URL flags, the game's own laser, overlay drawn on
Marksmen only (trail, rings: RED taken / GREEN stood down / BLUE armed by B /
AMBER armed and unused; label = branch + CHARGE / LOCK). **Every film is
verified tick for tick** — audit hash and draw count — against a plain
headless replay of the same case (`encRun` for the encounters), so each is
the measured run and not a look-alike. Two films failed that check and
were thrown away: the first SNIPER NEST (render-time draws and the overlay's
Text UUIDs had consumed the seeded stream) and the first MIXED, at tick 1033
(gameplay reads the camera: `_tickTraitTells` draws only for on-screen
nemeses, so a whole-room filming camera changed the fight). The encounter
shutter now borrows the game camera and restores every field it touched
(`tests/README.md`).

| file | what |
|---|---|
| `marksman-stuck-clear-ab.webm` | Regular + Elite approaching on open floor — baseline / A / B |
| `marksman-stuck-hold-resume.webm` | hold 4s → the player backs off past 640 → approach → the player closes inside 300 → retreat |
| `marksman-stuck-obstacle-ab.webm` | top: console inside the first window (A waits a window, B = baseline); bottom: cover head-on (B arms on contact) |
| `marksman-stuck-sniper-nest.webm` | SNIPER NEST, seed 1001, the metrics' scripted player — baseline / A / B |
| `marksman-stuck-mixed.webm` | MIXED, seed 1001, `?bulwarkStuck=early` on in ALL three panels (= the `mixed-bulwarkB` rows) |
| `marksman-stuck-metrics.csv` | every raw row: Part A, staged, charge, obstacle, encounter, isolation, perf |
| `marksman-metrics-*.csv` | the same, per section |

**Reading `marksman-stuck-metrics.csv`** — one row per run (or per charge,
`charge-each`; per encounter role, `enc`), plus `*-summary` rows. `section`
and `scenario` name the case, `mode` is the variant (baseline / A / B),
`seed` the seed. The brief's fields:

| field | column(s) |
|---|---|
| false first check | `F1armed`, `F1taken`, `stoodF1` |
| hold → resume | `HOLDarmed`, `HOLDtaken`, `stoodHold`, `resumes`, `resumeSide`, `resumeErrMax` |
| real obstruction | `BLOCKarmed`, `BLOCKtaken`, `contactMs`, `firstContactMs`, `keptPinned`, `armedPinned`, `stoodRetreat` / `retreatBlocked` |
| recovery time | `activationDelayMs` (contact → first recovery), `escapeMs` (first → last contact) |
| escape success | `reachBandMs` (blank = never reached the band), `pinnedEnd`, `reached_n` / `pinnedEnd_n` |
| LOS | `losMs`, `losFrac`, `losAfterContactMs` |
| charges / locked shots / cancelled | `charges` / `fired` / `cancelled` (and `starts`, `cancels`), `lockSteady`, `shotEqLock`, `sideDuringLock`, `lockSide` |
| hits | `hits` (all player hits), `sniperHits` (220-damage Marksman shots) |
| RNG divergence | `posDivergeMs`, `drawDivergeMs` (`none` = identical), `draws`, `interveneMs` |


## 12. Tests and regressions

**`smoke-marksman-stuck` — 81 / 81** on this tree (all sixteen items, §1
against a live `f752b3f` server). **A/B against the frozen build**
(`--base=` the `f752b3f` server, where the flag does not exist): **52 pass /
29 fail, and the 29 are exactly the correction-specific checks** — the
false first sidestep gone (2b, 11), holds leave nothing live (3b), resumes
walk at the player (4b), B's keep and arm on cover (10b, 10c), the Regular
recovering from head-on cover it now meets (10a cover90), retreat arms
stood down (10d), the RNG attribution (15) and the installed candidates'
cleanup (16). What still passes there is what SHOULD pass on the frozen
game: the baseline reference checks (2a, 3a, 4a, 6a/b), every invariance
check (retreat 5, thresholds 6c, charge / lock / shot 7 and 9, LOS 8, the
nemesis 12, every other role 13, Bulwark B 14, cover recovery still present
10a) and the source greps (15b, 16b-e), which read this tree.

**Targeted suites, standalone, this tree:**

| suite | result |
|---|---|
| `smoke-marksman-stuck` | **81/81** (frozen-build A/B above) |
| `smoke-stuck-audit` (Phase 3A) | 40/40 |
| `smoke-bulwark-stuck` (Phase 3B) | 42/42 — §1 run against the `f752b3f` server (flag-off `f752b3f` is `690ed9b`, by 3B's own proof) |
| `smoke-bulwark` | 92/92 |
| `smoke-demolisher` | 91/91 (the approved veto still runs) |
| `smoke-roster-2b` (Marksman / Rifleman roster) | 74/74 |
| `smoke-roster-gunner` | 72/72 |
| `smoke-roster-seams` | 70/70 |
| `smoke-move-v2` | 9/9 |
| `smoke-gait-v2` | 16/16 |
| `smoke-encounters` | 25/25 |
| `smoke-encdbg` | **33/33 on a fresh dev server of this tree.** 31/33 twice on the session's long-running :5173 server, which had hot-reloaded `debug.js`: the suite's dynamic `import('/src/systems/debug.js')` got a second module instance, so its `setEncForce` never reached the game (`tests/README.md`). The frozen server: 33/33. |
| `smoke-champion-placement` | 58/60 — **the frozen `f752b3f` build fails the same two checks** ("a Captain was live before the room change" and the teardown check that depends on it): wall-clock, not this change |
| `smoke-rng` | 17/17 |
| production build (`vite build`) | OK (the >500kB chunk warning is pre-existing) |

**Captain / VANGUARD.** Neither contains an ordinary Marksman, so the
appropriate proof is deterministic: VANGUARD + Captain, CROSSFIRE, SWARM
TIDE and BOMBER RUN are identical to baseline in positions and draws under
A and B (§8), and the Captain is in smoke §13's crowd. Their real-time
suites were not re-run: Phase 3B showed them red on the frozen baseline at
this container's frame rate.

**`run-all` (the normal-speed full-suite debt): STILL OPEN.** This container
renders headless pages at ~7.6-8.0 fps idle — measured at the start of the
milestone and again at its end on an idle box: this tree 7.95 / 7.85 fps,
`f752b3f` 7.86 fps, the same VANGUARD cell — against the ~20 fps the
real-time suites were written for, and most of this milestone ran under a
load of 7-9 on 4 cores. Per the brief it
was not attempted again here, no timing threshold was edited, and 52/52 is
not claimed. The obligation carries forward.

## 13. Handset review — what to compare

Base `https://xletof.github.io/crix/`. Every URL carries the same
`roster=v1&gait=v2&move=v22` (the production look the human plays) and the
same encounter cell; the ONLY difference inside a pair is `marksmanStuck`.
`?bulwarkStuck=` is in NO half (it is never on one side only).

| | URL |
|---|---|
| SNIPER NEST — frozen | `?encdbg=sniperNest&room=detention&sector=8&wave=2&roster=v1&gait=v2&move=v22` |
| SNIPER NEST — **B** (recommended) | `?encdbg=sniperNest&room=detention&sector=8&wave=2&roster=v1&gait=v2&move=v22&marksmanStuck=early` |
| SNIPER NEST — A (comparison) | `?encdbg=sniperNest&room=detention&sector=8&wave=2&roster=v1&gait=v2&move=v22&marksmanStuck=prog` |
| MIXED — frozen | `?encdbg=mixed&room=detention&sector=12&wave=2&roster=v1&gait=v2&move=v22` |
| MIXED — **B** (recommended) | `?encdbg=mixed&room=detention&sector=12&wave=2&roster=v1&gait=v2&move=v22&marksmanStuck=early` |
| MIXED — A (comparison) | `?encdbg=mixed&room=detention&sector=12&wave=2&roster=v1&gait=v2&move=v22&marksmanStuck=prog` |

The questions are the human's, and a green suite does not answer them:

- Does the Marksman hold ground with purpose?
- When I move out of range, does it approach instead of skating sideways?
- Does it retreat naturally when pressured?
- Does the charge still feel threatening?
- Is the laser's final lock still predictable and dodgeable?
- Does it recover from genuine cover obstruction?
- Is it still an engaging enemy rather than an immobile firing turret?
- Does it remain readable in a mixed fight?

The encounter debug overlay's REPLAY button (right half) re-runs the wave.
