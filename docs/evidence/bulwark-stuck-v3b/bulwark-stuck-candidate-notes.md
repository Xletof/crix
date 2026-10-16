# Phase 3B — Bulwark-only stuck-recovery candidates

**Status: PHASE 3B — BULWARK STUCK-RECOVERY CORRECTION: HUMAN-APPROVED /
FROZEN 🔒.** Handset verdict on Candidate B (`?bulwarkStuck=early`):
*"Yes it does, approved."* — movement (deliberate approach, hold and resume;
the unexplained sideways movement gone), navigation (still recovers on real
walls, crates and furniture) and VANGUARD (the corrected opening is fair,
challenging and enjoyable, Captain included). Final implementation
`4f09af6` + `f8ea738`; evidence closed on `79f243a`.

**B stays OPT-IN.** Approval does not authorize making it the default — that
is a separate rollout decision. With no flag nothing is installed and the
build is `690ed9b` tick for tick and draw for draw (`smoke-bulwark-stuck` §1,
the VANGUARD + Captain and MIXED encounters over 1200 ticks). Candidate A is
rejected for production and kept as the comparison path.

The sections below are the record that led to the verdict (B was the
recommendation put to the handset). Section 9's limitations are ACCEPTED and
are not reasons to reopen.

| URL flag | what it is |
|---|---|
| *(none)* | the frozen game |
| `?bulwarkStuck=prog` | **Candidate A** — progress-aware: false arms stood down. REJECTED for production |
| `?bulwarkStuck=early` | **Candidate B** — A, plus pinned arms kept and pinned checks armed. **HUMAN-APPROVED / FROZEN** |

Neither is coupled to `?move=v22`, `?roster=v1` or `?gait=v2`.

## 1. Scope and seam

- **Who gets it:** `GameScene.spawnEnemyAt`, `type === 'shielded' &&
  !spec.legacyArt` — the ordinary Bulwark in every form: free, VANGUARD
  screen, VANGUARD opening pair, Regular and Elite.
- **Who does not:** the nemesis shielded (`legacyArt`), every other archetype,
  every other nemesis, the Shock Captain and Vader.
- **The seam:** `src/systems/bulwarkStuck.js` shadows two of the bearer's own
  methods, `_tickSwarm` and `_moveToward`, on the instance at spawn. That is
  the same shape as `bulwarkFacing.js`. The prototype is untouched.
- **What is untouched:**
  - `src/entities/` is byte-identical to `690ed9b`, `Enemy.js` included.
  - So are `config.js`, `encounters.js` and the three shield seams.
  - The narrowed `enemy-frozen` guard still holds.
- **The rest of `src/`:**
  - `debug.js` and `BootScene.js` gain the flag.
  - `GameScene.js` gains an import and a two-line, flag-gated install.
  - `smoke-stuck-audit` §0 was narrowed in the open to allow exactly those
    four files and exactly those GameScene lines. It fails on an extra file, a
    stray GameScene edit or any `Enemy.js` byte (A/B'd).

## 2. The rule

> **Commanded to move + genuinely unable to progress → recover.**
> Not "standing still → recover", and not "moving normally during the first
> 600ms → recover".

**The candidates arm nothing and draw nothing.** The frozen base block still
runs every 600ms, still decides, and still makes its random draw. The module
REVIEWS each check at the top of the bearer's next AI tick, before
`_moveToward` can take the arm.

**Intent is read from the AI's own `_moveToward` calls, never from velocity.**
A Bulwark pinned on a wall has zero velocity and is very much trying to move.

**Candidate A** stands an arm down when it is one of the two false classes
the Phase 3A audit found:

- **F1:** the first check, when the body really moved ≥ 12px from its spawn
  point. This is the Demolisher's approved re-measurement.
- **HOLD:** a window in which the AI commanded movement on less than half its
  decision time. That covers the 290px free hold, the 140/165 VANGUARD hold
  and the stop between two moves.

Every other arm — commanded movement that made no progress — is kept. The
recovery itself (direction, 600ms, 1.1× speed) is the base's own.

**Candidate B** is A plus physics evidence, read only at a check:

- **Keep an arm** that A would stand down if the body is PINNED: a commanded
  + in-contact run of 50ms or more with under 30% of its commanded progress.
- **Or PRESSING:** the step that just ran was commanded into a face the body
  is blocked on, head-on enough that it keeps under 30% of its progress
  (1 − bx² − by²).
- **Arm a check the base declined** (the body walked in, then hit cover inside
  the same window, so it "moved" ≥ 12px) when the 50ms run holds. B does this
  at the base's own instant, for the base's own 600ms, in the direction the
  base last drew. No new draw is made.

**The bars are deliberately asymmetric.** A wrong KEEP is exactly the frozen
game's behaviour, so keeping accepts the instantaneous "pressing" test.
A wrong ARM adds a sidestep the frozen game never takes, so arming needs the
50ms run.

**The pressing test was added after measurement, not before:**

- A Regular Bulwark meets a real 70×70 console one tick before the first
  check.
- That arrival step still shows 72% of its commanded travel, because it moved
  up to the face inside the step.
- So the run test could not see it. The first build of B stood that arm down
  like A, and the first sidestep landed at tick 71 instead of 35.
- `smoke-bulwark-stuck` 6e pins it: old B 71, new B 35.

## 3. Staged results (8 seeds per cell)

`bulwark-stuck-candidate-metrics.csv`, `section = staged` / `staged-summary`.
The setup is an empty lane, a 900px approach and a standing player.

### Clear lane: all five modes, 8/8 engage in every mode

| mode (R = Regular, E = Elite) | baseline engage | A / B engage | baseline sidestep | A / B sidestep |
|---|---|---|---|---|
| free R | 4967ms | 4367ms | 600ms (F1, 8/8) | 0 |
| free E | 5450 | 4850 | 600 (8/8) | 0 |
| screen R | 6033 | 5433 | 600 (8/8) | 0 |
| screen E | 6633 | 6033 | 600 (8/8) | 0 |
| opener | 6117 | 5517 | 600 (8/8) | 0 |

The false first sidestep is gone in every form, and the approach arrives
exactly one window (600ms) sooner.

### Hold → resume (the player stands 4s, then backs off twice)

| mode | baseline hold sidesteps taken | baseline resumes > 45° off the player | A / B |
|---|---|---|---|
| free R | 16 / 8 runs | 16 of 16 (max 91°) | 0 taken, 0 of 16 |
| free E | 16 | 16 of 16 | 0, 0 of 16 |
| screen R | 16 | 16 of 16 | 0, 0 of 16 |
| screen E | 16 | 8 of 16 | 0, 0 of 16 |
| opener | 20 | 16 of 16 | 0, 0 of 16 |

In baseline, every resume from a hold is a right-angle sidestep. Under both
candidates every resume walks at the player (0°).

### Obstacles: success / runs, mean engage, mean escape

Escape is the time from first contact to last contact.

| obstacle (Regular free) | baseline | A | B |
|---|---|---|---|
| console 70×70, near (met 0.57s) | 8/8 · 4983 · 233 | 8/8 · 5583 · 833 | 8/8 · **4983 · 233** |
| console 70×70, far | 8/8 · 4983 · 600 | 8/8 · 5767 · 1017 | 8/8 · 5167 · 417 |
| cover 90×90, near | 8/8 · 5050 · 367 | 8/8 · 5650 · 967 | 8/8 · 5050 · 367 |
| cover 90×90, far | 8/8 · 6433 · 833 | 8/8 · 5850 · 1150 | 8/8 · 5250 · 550 |
| wall 240, near | 8/8 · 6733 · 1450 | **5/8** · 8293 · 5273 | 8/8 · 6133 · 1283 |
| wall 240, far | 6/8 · 7711 · 3715 | 6/8 · 8997 · 5819 | **8/8** · 5767 · 883 |
| angled corner | 8/8 · 5925 · 1250 | 8/8 · 6033 · 700 | 8/8 · 5642 · 692 |
| hold → resume into a wall | 8/8 · 1750 · 4246 | 8/8 · 1150 · 5471 | 8/8 · 1150 · **1233** |
| VANGUARD opener crossing a console (its 60px lane) | 8/8 · 6117 · 50 | 8/8 · 7083 · 900 | 8/8 · 6425 · 409 |

(The opener's baseline escape of 50ms is the frozen first sidestep having
already carried it most of the way past the console before it touched it.
A, with no sidestep, meets the console square and waits a window. B arms the
walk-in check.)

**Every staged obstacle cell** (200 runs per mode: 3 roles × 8 obstacles × 8
seeds, plus the opener crossing furniture):

| | baseline | A | B |
|---|---|---|---|
| reached the player | 188/200 | 183/200 | **195/200** |
| pinned at the end | 5 | 8 | **2** |

What the obstacle runs show:

- **A's known cost is real.**
  - Cover met inside the first window waits a whole extra window. Near
    obstacles cost A +600ms of activation delay and engagement in every role.
  - On the 240px walls A is the least reliable: 5/8 near, against baseline's
    8/8.
  - Without the baseline's false pre-contact sidestep, the body hits a wide
    wall dead-centre. It then depends on the base's random left/right draws,
    and a 600ms sidestep covers about 90px.
- **B fixes A's cost.**
  - Near cover is the baseline's timing exactly. B is byte-identical to
    baseline in 48 runs.
  - Every far obstacle activates 400-800ms sooner than A, because the
    walk-in check is armed.
  - Hold → resume into a wall escapes in 1.2s against 4.2-5.5s.
- **One B cell is weaker than baseline: the ELITE (r 33) against the near
  240 wall.**
  - Baseline 7/8, A 4/8, B 4/8.
  - The Elite reaches the wall one tick AFTER the first check. At the check it
    is genuinely not in contact yet, so B correctly behaves like A.
  - Baseline gets round because its false first sidestep happened to shift the
    body ~70px before it ever touched the wall. That is luck, not recovery.
- **B's escapes get some help from not drawing again.** B arms reuse the
  base's LAST drawn direction, so two consecutive B arms push the same way. A
  fresh draw can reverse. That persistence is a consequence of "no new random
  draws", not a direction rule — but it is part of why B gets round wide
  walls, and the human should know it.

## 4. The VANGUARD opening (priority deliverable)

**Setup:**
- Real VANGUARD: hangar, sector 8, wave 2.
- Six player conditions × Captain on/off × 6 seeds × 3 modes = 216 fresh
  pages.
- The player fires on a cadence; no Super.

**Measured:**
- why and when the front released;
- both openers' positions, spacing and spread at release;
- cover contact;
- how long ONE opener is alone inside the 200px establish radius;
- backline and Captain entry;
- shots, blocks and incoming hits.

The Captain enters AFTER the front, so the front rows are identical with and
without him. Only the backline and Captain timing differ.

| player | baseline: established / timeout | A | B | opener alone in 200px (base → A / B) | release (ms) |
|---|---|---|---|---|---|
| room spawn (200,700) | 0 / 6 | 0 / 6 | 0 / 6 | 0 → 53 / 53 | 4900 → 4900 |
| centre (800,700) | 0 / 6 | 1 / 5 | 1 / 5 | 203 → 97 / 6 | 4900 → 4853 / 4755 |
| north (1000,450) | 1 / 5 | 1 / 5 | 1 / 5 | 208 → 108 / 108 | 4639 → 4564 |
| east gates (1150,700) | 1 / 5 | **4 / 2** | **4 / 2** | **425 → 931 / 931** | 4897 → 4570 |
| walking across the front | 3 / 3 | 4 / 2 | 4 / 2 | **233 → 622 / 622** | 4686 → 4320 |
| flanking the first shield | 6 / 0 | 6 / 0 | 6 / 0 | **81 → 378 / 378** | 2361 → 2389 |
| **total (36 runs)** | **11** established | **16** | **16** | | |

What the front matrix shows:

- **Why the front establishes more often.** At the east gates, the frozen
  game's second opener is 205-252px out when the 3000ms timeout fires. Its
  false first sidestep cost it about 600ms. Without that sidestep it is
  195-212px out, inside the radius in 4 of 6 runs.
- **That is not approval, and it has a price the human should feel.** Where
  the front actually forms near the player (east, across, flank), the FIRST
  shield arrives sooner and stands alone with the player 0.3-0.5s longer
  before its partner closes.
  - That is a longer one-on-one with a shield and a sidearm before the
    formation exists.
  - It is not a new pressure mechanic: the same actor, with the same hold,
    speed, shots and shield.
- **Formation geometry at release is unchanged:**
  - gap at the east gates 106 → 105px;
  - spread 24 → 28°;
  - flank gap 118 → 111px, spread 35 → 22°.
- **Cover is better near the gates and worse on the long walk.**
  - Openers spend less time on cover near the gates: east 1147 → 381ms,
    across 1083 → 483 (A) / 333 (B).
  - They spend MORE on the long walk from the room spawn: 1050 → 2300 (A) /
    2019 (B). The frozen sidestep had been nudging them off the cover lines.
  - At the north spot it is 656 → 1395 (A) / 1161 (B).
  - At release, baseline has 5 openers in contact with cover; A has 1, B has 3.
- **Pressure:** backline and Captain entry move with the release (east 330ms
  earlier). Pair shots before release, blocks and incoming hits are within
  ±4 per 12s run in every condition (east hits 35 → 39).
- **A and B are identical at the east gates and on the flank.** They differ
  only where an opener meets cover on the way in: spawn, centre, north,
  across.

## 5. Live VANGUARD (1x, AI live, Supers)

**Setup:**
- Real VANGUARD with and without the Captain, 6 seeds each, 40s.
- The scripted player starts at the room spawn, then approaches, holds,
  flanks north, crosses behind (east), retreats, approaches again, flanks
  south-east, retreats and crosses south.
- Auto-aimed fire every 7 ticks, and Supers at 15s and 28s.
- In every run the front releases on TIMEOUT: the player is far from the
  gates when it forms.

The table sums every Bulwark in the 6 runs.

| | baseline | A | B |
|---|---|---|---|
| sidestep time, no Captain | 33.1s | **7.2s** | 15.6s |
| — of which false first-check / hold → resume | 32 + 24 taken | 0 + 0 | 0 + 0 |
| — recoveries against contact | 6 base arms | 11 base arms | 3 base + **23 B-armed** |
| time in contact with cover / bounds | 31.7s | **42.2s** | **29.8s** |
| abrupt turns during a sidestep | 100 | 23 | 48 |
| sidestep time, with the Captain | 30.6s | 5.4s | 17.4s |
| contact time, with the Captain | 36.8s | 33.7s | 34.3s |
| incoming hits / run (no Captain / Captain) | 56.5 / 58.7 | 56.0 / 56.3 | 52.3 / 53.0 |
| shield blocks / run | 30.5 / 37.2 | 32.8 / 31.8 | 32.8 / 34.8 |
| kills, no Captain (killed / spawned) | 50 / 76 | 52 / 82 | 50 / 77 |
| waves cleared within 40s, no Captain | 4 / 6 | 4 / 6 | 3 / 6 |

**The live trade-off:**

- **A removes the most sideways movement, and grinds on cover a third
  longer** (42.2s against 31.7s). The frozen false sidesteps were
  incidentally peeling Bulwarks off cover.
  - Without them, a body that meets cover after walking part of a window
    "moved" ≥ 12px, so the base does not arm.
  - It grinds until the next window.
- **B keeps contact time at or below baseline and still cuts sidestepping by
  half.**
  - 15 of its added arms were probed individually, across four live runs
    (seeds 1001 with and without the Captain, 8920, 24758 with the
    Captain).
  - Every probed arm: the body was 0-5px from cover, with a 100-217ms commanded contact run and
    0-11px of progress where it expected 18-44px.
  - Several were being pushed back along the face by another body — the exact
    case the base reads as "moving".
  - Each arm freed its body: 79-130px of travel in the next 600ms.
  - Two of them were both openers pinned on the small crates beside the east
    gate.
- **These are mechanical figures.** Whether a Bulwark stepping off a crate
  reads better than a Bulwark leaning on one is a handset question.

The Captain's presence does not change the Bulwark picture. Combat pressure
(hits, blocks, kills) moves within run-to-run noise in every mode.

## 6. Isolation and RNG

**Encounters with no Bulwark:** crossfire, sniperNest, swarmTide and
bomberRun, 3 seeds each, 1800 ticks, real spawner, scripted fire and Supers.

- **24 of 24 candidate runs are identical to baseline**, every tick's
  positions and every draw (`section = iso`).
- **Nothing is installed without a Bulwark**, and every other archetype on
  the floor at once — the nemesis shielded and the Captain included — matches
  baseline exactly (`smoke-bulwark-stuck` §8, §9).

**Staged RNG**, 280 runs per candidate (`posDivergeMs` / `drawDivergeMs`):

- Neither candidate ever parts from baseline before its own first
  intervention.
- The draw stream never parts before positions do.
- B is byte-identical to baseline in 48 runs, the cover-met-before-the-check
  cases.
- Total draws differ only downstream of the removed sidestep. For example, in
  the clear lane baseline draws 380 and A / B draw 344: the body engages
  sooner and fires on a different clock.
- **No draw is added or removed by either module** (`smoke-bulwark-stuck`
  §10, and the module has no `Math.random`).

## 7. Expected vs unauthorized differences

**Authorized and observed:**
- the false lateral movement is gone;
- arrival is earlier;
- every downstream position, shot and draw difference follows from those;
- the VANGUARD front releases earlier and establishes more often, as a
  consequence of the openers arriving on time.

**Unauthorized, checked and NOT present:**
- `_shieldFacing`, the 2.6 rad/s turn, frontal coverage, blocking and Super
  penetration are untouched (`smoke-bulwark-stuck` §12).
- Hold 140, resume 165, establish 200, timeout 3000, stall 7000 and lane 60
  are untouched.
- The spawn queue, Captain order and composition are untouched.
- Shielded hp, speed, collider and damage are untouched.
- The Super economy is untouched.
- Every other archetype (§9, all on the floor at once) and the nemesis
  shielded (§8) are untouched.
- Legacy visuals are untouched.
- The module reads no shield, VANGUARD, hp or damage field (grep).

## 8. Performance

12 Bulwarks (6 screen, 6 free) on a lateral-moving player, 600 ticks, the
median of 5 runs, idle box, headless step:

| | mean ms / tick | p50 | p95 |
|---|---|---|---|
| baseline | 0.679 | 0.6 | 1.4 |
| A | 0.581 | 0.5 | 1.3 |
| B | 0.615 | 0.5 | 1.2 |

All three are within run-to-run noise. The candidate's work per Bulwark per
tick is one sample push and a trim of a ~200ms history, plus a scan of that
history at a check (every 600ms). It owns no timer, tween or listener.

## 9. Known limits

- **Wide walls are still random-direction recovery.** A and B do not change
  the base's recovery, so a body on the centre of a wide wall can still
  alternate left and right. B's persistence (above) helps; it does not
  guarantee.
- **The Elite against a wall met just after the first check:** B is as slow
  as A, and the frozen game is luckier.
- **NavGrid clearance vs physics is unchanged engine debt.** The candidates
  recover from contact; they do not route around it.
- **The bot plays nothing like a person.** The metrics here are mechanical —
  arrival, contact, release — and hold no opinion about whether the fight
  feels better. That is the handset's call.

## 10. Evidence

| file | what |
|---|---|
| `bulwark-stuck-clear-ab.webm` | baseline / A / B, empty lane, free R, Elite, screen — 1x |
| `bulwark-stuck-hold-resume.webm` | free Bulwark + screen, player backs off twice — 1x |
| `bulwark-stuck-obstacle-ab.webm` | 240 wall met early (top) and later (bottom), elapsed time and engage — 1x |
| `bulwark-stuck-vanguard-front.webm` | real VANGUARD + Captain, player at the east gates: establish radius, hold radius, lanes, release reason, timing and positions, alone-time — 1x |
| `bulwark-stuck-vanguard-live.webm` | real VANGUARD + Captain, baseline vs B, approach / hold / flank / cross behind / retreat, Supers, AI live — 1x |
| `bulwark-stuck-candidate-metrics.csv` | every run and every summary, raw numerators and denominators |

Rigs: `tests/diag-bulwark-stuck.mjs` (metrics), `tests/shot-bulwark-stuck.mjs`
(videos) and `tests/smoke-bulwark-stuck.mjs` (42 checks). The smoke's
candidate checks fail on `690ed9b`.

## 11. Regressions

**Targeted suites, standalone, all green:**

| suite | result |
|---|---|
| `smoke-bulwark-stuck` | 42/42, §1 run against a live `690ed9b` server |
| `smoke-stuck-audit` | 40/40 |
| `smoke-bulwark` | 92/92 |
| `smoke-demolisher` | 91/91 (the approved veto still runs) |
| `smoke-roster-2b` | 74/74 |
| `smoke-roster-gunner` | 72/72 |
| `smoke-roster-seams` | 70/70 |
| `smoke-move-v2` | 9/9 |
| `smoke-gait-v2` | 16/16 |
| production build | OK |

**`run-all`: 38/52, and it is the container, not this change.**

- This container renders headless pages at about **6 fps while idle**: 98% CPU
  idle, load under 2. The real-time suites were written against roughly
  20 fps.
- Measured on matched pages of the same VANGUARD cell: the new build at
  5.92 / 5.82 fps, `690ed9b` at 5.98 / 5.83 fps. **The two builds run at the
  same speed.**
- The 14 red suites are all wall-clock real-time:
  - Vader, DEFLECTION, the camera, the Captain, moves, nemesis, readability,
    champion, VANGUARD screen and front.
  - In a matched new-vs-`690ed9b` A/B, run one suite at a time, **the frozen
    baseline fails the same suites**, on a DIFFERENT check each run:
    - vanguard-screen: new 1/22 (close band) vs old 1/22 (positive control);
    - vanguard-front: new crashed vs old 1/30 (surge);
    - captain: new 7/38 vs old 2/38.
- **The vanguard-front "crash" is the instrument.** Its `&nofront=1` section
  polls 15 wall-clock seconds for three gate events, the poll returns silently
  on timeout, and the next line reads `g[2].t` from a 2-element array. At
  6 fps a timeout is a coin flip.
- With the flag absent this build is `690ed9b` tick for tick and draw for
  draw. That is a deterministic stepped replay, not a real-time sample
  (`smoke-bulwark-stuck` §1), and it is the authoritative statement that the
  default game is unchanged.
- **A `run-all` on a normal-speed container is still owed** before anyone
  reads the suite's own totals as green.

## 12. Closure

- **Phase 3B is HUMAN-APPROVED / FROZEN for the ordinary Bulwark only** —
  Candidate B, opt-in.
- **Not fixed:** the shared stuck defect on every other archetype.
- **Next proposed:** PHASE 3C — MARKSMAN STUCK-RECOVERY CORRECTION.
  PROPOSED / NOT STARTED / HUMAN IMPLEMENTATION PROMPT REQUIRED.
  - Phase 3A: about 82% of its lateral movement and 125 of its 126 sharp
    turns are stuck sidesteps, from both false classes.
  - Its range, retreat, charge, laser telegraph, cadence and aim/lock must
    survive.
  - B is a reference, not a template.
