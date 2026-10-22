# Phase T2 — the free Bulwark's tactical engagement (`?bulwarkAngle=1`)

**A CANDIDATE. OPT-IN. NOT APPROVED, NOT FROZEN, NOT A DEFAULT.** Nothing here
is installed without the flag, and with it nothing is installed on anything
but an ordinary FREE Bulwark (Regular or Elite). The frozen game is the
default, the pre-T2 build tick for tick and draw for draw.

The defect it answers is the free-Bulwark half of Phase 3C-B
(`docs/evidence/tactical-engagement-audit/`): the free Bulwark walks straight
at the player until 290px (`desiredRange` 260 + 30) and then STANDS, whether or
not it can shoot from there — 20.1% of its life standing blind in a
reconstructed MIXED, holds of 30s and more, with a straight-line firing spot
typically ~50px along its own arc. Its shield and gun were never the problem.
The Marksman half was answered by T1 (`?marksmanAngle=1`, HUMAN-APPROVED /
FROZEN on `0b772cf`); T1 does not move with this.

**In one paragraph.** In the reconstructed MIXED (Detention s12 w2, real
spawner, 7 player pilots × 3 seeds, the handset's presentation flags and the
approved `bulwarkStuck=early` in BOTH halves), free-Bulwark blind standing
went **21.4% → 2.9%** of its life, the longest blind hold **34.6s → 1.4s**,
Bulwark shots **22.1 → 27.6 a minute** and Bulwark hits on a god-mode player
**22.9 → 27.0 a minute**. With the approved T1 Marksman also on in both halves
the same comparison is 20.4% → 2.7%, 34.6s → 1.4s, 22.8 → 26.1 shots/min. It
evaluates on the first blind tick in every episode; first movement median
0ms (it is usually already moving) / p90 183–600ms / max 617ms. Turn-arounds
(>120° between consecutive walks) 0.29–0.37 per Bulwark-minute; stops of
≤ 300ms between walks at the frozen game's own rate. The shield, the gun and
the cooldown are reproduced bit for bit by the frozen laws on every AI tick
(`smoke-bulwark-angle` §6/§7, 75/75). VANGUARD with and without the Captain
is the same fight tick for tick and draw for draw (18/18 seeded runs).
**What it costs:** a player CIRCLING one console gets a Bulwark that follows
round rather than one that happens to stand where the shadow is narrowest —
fewer shots and hits than the frozen hold there (below); a working spot is
kept up to 600ms for a moving target, which a handset may read as a pause;
and the frozen cooldown still makes a reacquired line wait ~0.5–0.9s for its
warning. **The bot is not the balance authority.** These are instrument
readings for the human to judge on a handset.

## What it is

One new file and one install line; `src/entities/Enemy.js` is not touched.

* `src/systems/bulwarkAngle.js` shadows the bearer's own `_tickSwarm`, calls it
  FIRST and unchanged (the class's method, or `?bulwarkStuck=`'s shadow of it —
  installed after the stuck candidate so it wraps it), and only then, in one
  narrowly defined state, overrides the velocity the frozen tick wrote.
* Installed from `GameScene.spawnEnemyAt` when
  `isBulwarkAngle() && type === 'shielded' && !spec.legacyArt && !spec.vanguardScreen`.
  The exclusion is BY ABSENCE at the spawn site: a VANGUARD screen carries
  `vanguardScreen` (and so does every opener, which also carries
  `vanguardLane`), the nemesis carries `legacyArt`, and nothing else is a
  `shielded`.
* `src/systems/firingSpot.js` (T1's, frozen) gained two `export` keywords —
  `clearOf` and `route`, unchanged — so the Bulwark's own search reuses the
  approved walk and reachability tests instead of copying them. T1 was proved
  byte-equivalent after the change: 34/34 staged and encounter cases (T1 with
  and without its stuck flag, MIXED and SNIPER NEST) are the pre-change build
  row for row and draw for draw, and `smoke-bulwark-angle` §13 re-proves it on
  every run.
* No `Math.random`, no scene listeners, no timers, no tweens; state lives on
  the actor (`e._bulwarkAngle`, and the claim `e._angDest` it shares with T1).

## The rule

PERCEIVE → DECIDE → MOVE → FIGHT, as one action.

* **PERCEIVE**, every AI tick: is the geometric line to the player cut
  (`_hasLOS` — the fire gate's own test)? Concealment and range are not
  geometry, and walking does not solve them; the candidate never acts on them.
* **DECIDE** on the FIRST blind tick — the search runs on that tick, no idle
  wait. Commit after a confirmation that depends on the walk (150–250ms),
  held while the player's own displacement over the last 250ms is about to
  carry them back into the line (someone crossing behind a console). ONE
  exception, and it is a decision rather than a wait: **a spot it has been
  fighting from** (the line held ≥ 600ms without it moving more than 40px)
  is not given up the instant a MOVING target slips behind something — it
  keeps the shield on them for up to 600ms and decides the moment they stop
  or that runs out (the circling case, below).
* **MOVE** to one committed destination at the bearer's own frozen speed
  (`cfg.speed` — Regular, Elite, FRENZY and the sector ramp included), eased
  in, slowed into the arrival, re-chosen only for a reason: the line opened;
  the spot lost its line after a 450ms minimum (unless the target is
  mid-crossing back into the line — then stop and watch); the walk failed
  (no progress in 180ms, or a deadline — the spot is remembered 3s); or it
  arrived still blind.
* **BRACE**: a player who keeps stepping out of every angle it walks to
  (three target-caused re-plans inside 3s) is not chased round the console:
  it holds its shield on them for 1.2s (1.8, then 2.4 if the dance goes on
  with no shot between) and then looks again. The gun still fires the moment
  a line opens.
* **FIGHT**: a line opens → it stops (or finishes a step of ≤ 60px to a spot
  that still has the line) and the frozen gun takes over. A Bulwark with a
  line is content to hold.
* **NO STOP-GO.** Five rules, each pinned to a measured stutter:
  a SLIVER of a line opening mid-walk — one a one-step (±40px) player shuffle
  would close — is not a place to stop, so it finishes the walk (firing on
  the move if it can); a line it did stop for that closes again within 400ms
  resumes the same walk with no new confirmation; and a walk eases in from
  the motion the body already has ALONG it (its previous walk, the frozen
  approach's, or rest), never from a standstill it is not in — the first
  build dipped to 0.48 px/tick on every commitment taken mid-walk. That
  motion is read BEFORE the frozen tick runs: by the time the review sees the
  body, the frozen hold has already written zero into `body.velocity`. And
  only the component along the new walk is kept — easing from the whole
  vector kept a turning Bulwark pressing into the console it was leaving (28
  pressed ticks in B4). While BRACED within 40px outside its
  hold it holds its ground instead of the frozen threshold's one-tick step,
  ten-tick stand as the target shifts — and so does KEEP. And a body that has
  only just stopped walking (≤ 400ms) decides on its first blind tick: a
  Bulwark that arrives on a line the player then leaves does not stand
  through a fresh 150–250ms confirmation before it moves again.
* **STABLE FALLBACK**: no spot → the frozen command stands (the hold's zero
  velocity, or the approach's walk) and it looks again every 250ms. Never a
  wander, never an unbounded search.

## The Bulwark is not a Marksman

A Marksman fixes a cut line by changing ANGLE at range; a Bulwark fixes it by
PRESSING ROUND THE OBSTACLE with its shield still toward the player. The
search is the Bulwark's own (T1's search, band, costs and overwatch are
frozen and are not reused):

* candidates on arcs AROUND THE PLAYER at its current range or CLOSER —
  radial steps 0 / −40 / −80px from min(its distance, 280) — on the band
  [140, 280]: inside the frozen 290 hold, so arriving never flips the frozen
  branch, and never closer than the VANGUARD screen's own 140 hold. ONLY when
  none of those has a line and a walk does it look farther out (+50 / +100px,
  still capped at 280, every pixel given up still priced): close behind a
  console the shadow can swallow its whole sweep — in a squad fight one
  Bulwark stood 23s blind 172px from a player behind the checkpoint console,
  both shadow edges held by its own comrades, because "current range or
  closer" had nowhere to go; from ~250px the same console casts a narrower
  shadow and it had a line;
* within 60° of its current bearing round the player (a Bulwark does not
  orbit), priced 80px per radian swung (the shield has to come round too);
* giving ground costs 1px per pixel (backing off is not pressure), closing
  0.15px per pixel; a line a one-step player shuffle (±40px) breaks costs 45
  per lost side; a side reversal inside 2s costs 70; other bodies' positions
  and claims are avoided (70px) and crowding is priced (150px);
* a spot the player's CURRENT motion (real displacement) will have taken out
  of the line by the time it arrives costs 110;
* reachable as the T1 search proves it: a full-body straight walk (radius +
  2px), else a reachability-checked NavGrid route for the nearest six, every
  leg keeping 110px from the player.

## The shield, the gun and the cooldown are the frozen ones

The module never writes `_shieldFacing`, `_aim`, the turn rate, the half-arc,
the cooldown, the warning, recoil, damage, HP, speed or the collider. It READS
`fireCd` once per tick to notice that a shot left (which resets the brace
ladder). Walking round cover leaves the shield exactly as slow to follow as it
ever was: **a flank is still a flank.** `smoke-bulwark-angle` §6 and §7
reproduce the frozen turn law
(`facing += clamp(Wrap(toPlayer − facing), ±2.6·dt)`) and the frozen cooldown
law (counts down only on an open line, re-rolls only on a shot) bit for bit on
every AI tick of every staged case, flag on and off.

## Staged results (real Detention, 2 seeds per case, fresh page per case and seed)

`diag-tactical-engagement.mjs --only=t2staged` → `t2-responsiveness-metrics.csv`
(`source = staged`). Every build carries `roster=v1 gait=v2 move=v22`;
`frozen` adds nothing, `bwB` adds `bulwarkStuck=early`, `bwA` / `bwAB` add
`bulwarkAngle=1` to each. Shots are per Bulwark-minute; "blind" is blind
STANDING (still, line cut), time-weighted.

| case | frozen | bwB (stuck-B alone) | candidate bwA / bwAB |
|---|---|---|---|
| B1 clear line, player firing into the shield | 38.0 shots/min, 112 blocks/min | same | **tick-identical** |
| B2 blind behind the heavy console in its hold (289px) | 0 shots, blind 100% | 0, 100% | eval 0ms, committed and moving 200ms, first shot 2.2s, **36.0/min**, blind 1.0%, closed to 241px |
| B2e the same, Elite | 0, 100% | 0, 100% | eval 0ms, moving 200–217ms, 36.0/min, blind 1.0% |
| B2w walking in from 537px | 0, blind 91% | 0, 94% | 36.0/min, blind 0% |
| B3 player circling the console | 30.0/min, line 78% | 30.0, 80% | **24.0 / 26.4/min, line 65 / 68%** — a cost (below) |
| B4 round the south-west post and bunks | 0, blind 84% | 19.2, 45% | 33.6 / 36.0/min, blind 0% |
| B5 behind the long bunk | 0, blind 100% | 0, 100% | 37.2/min, blind 0.4% |
| B6 the player rushes it | 40.0/min | 40.0 | 36.0/min (4 short re-positions as the player closes) |
| B7 the player runs round it, no cover | 39.0/min | same | **tick-identical** — the frozen shield, flankable |
| B8 three Bulwarks on one console | 0/3 shooting | 0/3 | **3/3 shooting**, 37.0/min each, never a shared destination |
| B9 the player crosses behind the console once | 34.5/min | 36.0 | 36.0/min; held as transient (0–1 walks) |
| B10 a pocket with NO spot (scanned) | 0, blind 100% | same | **tick-identical**; 79 bounded looks in 20s, never a step |
| B11 a Regular and an Elite on one console | 0/2 shooting | 0/2 | 2/2, 38.3/min |
| B12 a VANGUARD screen in the B2 geometry | 37.5/min (the screen closes to 140) | same | **tick-identical, not installed** |
| B13 cover hop (every 4s) | 12.0/min, blind 53% | 12.0, 60% | 25.2 / 22.8/min, blind 4.1 / 8.8% |
| B14 squad (3 Bulwarks + a Gunner), handset pilot | 20.5/min, blind 29%, longest 3.0s | 22.8, 34% | 24.8 / 23.4/min, blind 7.6 / 10.9%, longest 1.2s |
| B14 squad, hide pilot | 25.3/min, blind 31%, **longest 36.8s** | 20.0, 46%, 36.9s | 25.0 / 24.3/min, blind 14.3 / 13.9%, longest 1.6 / 2.0s |

The hide-pilot squad is a FEEDBACK fight — the pilot re-hides opposite the
threats' centroid every second, so any Bulwark that moves moves the player —
and single seeds of it swing widely; read the pooled rows. Its frozen total is
two Bulwarks with a permanent line and one blind for 37s; the candidate's is
three Bulwarks sharing the line.

## Encounters

`--only=t2enc` → the same CSV (`source = encounter`). MIXED is Detention
sector 12 wave 2 (the encounter the human rejected in 3C-B), real spawner, AI
live, god mode, 7 pilots (handset, hide, circle, hop, charge, retreat,
behind) × 3 seeds × 2400 ticks.

**MIXED, free Bulwarks, pooled (34–35 Bulwarks, ~1,100 Bulwark-seconds per variant):**

| | bwB → bwAB | t1base → t1bw (T1 on in both) |
|---|---|---|
| blind standing | 21.4% → **2.9%** | 20.4% → **2.7%** |
| longest blind hold (max / median of actors) | 34.6s / 1.2s → **1.4s / 0.2s** | 34.6s / 1.5s → **1.4s / 0.2s** |
| line open | 57.0% → 71.3% | 58.8% → 66.7% |
| shots / Bulwark-minute | 22.1 → 27.6 | 22.8 → 26.1 |
| Bulwark hits on the player / minute | 22.9 → 27.0 | 25.4 → 27.2 |
| shield blocks / minute | 21.0 → 22.4 | 23.5 → 22.1 |
| blind episodes ≥ 250ms (moved) | 98 (10) → 71 (67) | 106 (9) → 100 (92) |
| first move ms median / p90 / max | — → 0 / 600 / 617 | — → 0 / 183 / 617 |
| WARN after the line returns, ms median / p90 / max | 833 / 1350 / 1600 → 517 / 1050 / 1567 | 917 / 1550 / 1750 → 683 / 1283 / 1467 |
| SHOT after the line returns, ms median / p90 | 1133 / 1650 → 850 / 1350 | 1217 / 1800 → 850 / 1583 |
| destinations / Bulwark-minute | 0 → 15.4 | 0 → 18.6 |
| turn-arounds > 120° / Bulwark-minute | 0 → 0.29 | 0 → 0.37 |
| stops ≤ 300ms between walks / minute | 26.2 → 27.6 | 20.0 → 22.3 |
| walking into a wall | 0 → 0.3s | 0 → 0.3s |
| own displacement away from the player | 1.1% → 0.9% | 1.2% → 1.1% |
| rear exposed (shield > 90° off the player) | 0.8% → 1.2% | 1.1% → 1.0% |

**By pilot** (bwB → bwAB, blind standing / shots per minute / hits on the player per minute):
handset 28.8% / 25.3 / 21.5 → 2.4% / 33.2 / 23.5; hide 34.0% / 23.2 / 35.0 →
0.7% / 35.7 / 54.0; charge 21.0% / 27.9 / 41.0 → 0.3% / 36.6 / 53.5; hop
38.2% / 19.2 / 18.5 → 3.6% / 28.2 / 24.0; retreat 4.3% / 19.5 / 10.0 → 2.4% /
22.2 / 13.5; behind 4.6% / 12.6 / 1.0 → 1.3% / 13.0 / 0.5; **circle 23.2% /
25.9 / 33.5 → 12.5% / 21.9 / 20.0** — the one pilot where pressure falls, and
where rear exposure rises (1.0% → 4.6%, 0 → 8 flank events). Full tables:
`node tests/diag-tactical-engagement.mjs --t2report --csv=<csv>`.

**T1 alongside it.** With both candidates on, the approved Marksman's own
numbers in MIXED are unchanged within run-to-run noise (blind standing per
pilot 4.0 → 3.3%, 0.8 → 0.8%, 7.6 → 8.9%, 10.6 → 10.0%, 10.3 → 6.6%, 17.7 →
15.2%, 7.1 → 8.5%). T2 publishes `_angDest`, the same claim field T1 does, so
T1 Marksmen avoid a Bulwark's destination through T1's existing generic
read; T1's code is byte-identical to `0b772cf`.

**VANGUARD**, hangar sector 8 wave 2, with and without the Shock Captain,
handset / hide / circle × 3 seeds: **18/18 runs identical** frozen vs
`bulwarkAngle=1` — trace hash, RNG draws, hits. All 138 shield actors were
screens; none carried the candidate. `smoke-bulwark-angle` §3 also proves it
with stuck-B on in both halves, and that the front ends in the same state.

## The cooldown finding (measured, NOT changed — a human decision)

The frozen `_maybeFireAt` counts `fireCd` down only while it can see and has
a line, so a Bulwark that walks to a line resumes the remainder of the
cooldown it had when the line was cut. In the acceptance case (B2) the line
returns 1.03s in and the first WARN comes 0.88s later, the shot 0.30s after
that. Across MIXED the warning follows a returned line by 517–683ms median,
1050–1283ms p90, up to ~1.6s. The candidate SHORTENS the wait relative to the
frozen game (833–917ms median) only because it gets lines back sooner and
more often; it does not touch the pipeline. On a handset this may read as
"it walked to a line, then waited before firing". Options for the human:
accept it (the cooldown is the gun's rhythm, and it is frozen); or authorize a
change to the free Bulwark's cooldown while blind (a change to a frozen
pipeline, out of scope here). Not judged a blocker for the review.

## Known defects and limits (for the handset to judge)

1. **A player circling one console.** The frozen Bulwark, parked at 290px,
   happens to see past the console most of the lap; the candidate re-angles
   after the moving target and its spots are closer, so the shadow is wider.
   Staged B3: 30.0 → 24.0–26.4 shots/min, line 78% → 65–68%; MIXED circle
   pilot: hits on the player 33.5 → 20.0 / 33.0 → 24.5 a minute, rear
   exposure 1.0% → 4.6% (bwAB). KEEP (below) recovered about half of the
   original loss (54% → 65–68% line); the rest is the price of moving.
2. **KEEP is up to 600ms of holding.** A spot it has fought from is kept for
   a moving target up to 600ms before it re-angles; first-move p90 in the
   circling cases is ~600ms because of it. Deliberate (it is what makes the
   circling case tolerable), and exactly the kind of thing a handset may call
   a pause.
3. **The reacquire→warn delay** above.
4. **It moves more.** 15–19 destinations a Bulwark-minute in MIXED, against
   none; a handset decides whether that reads as purposeful or busy.
5. **The frozen 290 boundary still pumps WITH a line.** Holding at 290 and
   stepping when the player shifts (one tick moving, ten standing) is the
   frozen class's own behaviour when it can shoot; the candidate only
   suppresses it while braced or keeping. Not changed.
6. **With stuck-B, stops ≤ 300ms are a little higher** in two staged fights
   (B13 24 vs 13; B14 handset 71 vs 38) — mostly the approved stuck
   correction's own pattern (stuck-B alone: 54 in B14 handset). MIXED pooled
   is level with the frozen game.
7. **Staged B6 (the player rushes it):** 40 → 36 shots/min — four short
   re-positions as the player closes past its shield.
8. **The staged squad fights are chaotic** under a pilot that reacts to the
   threats' centroid; per-seed results are not meaningful, pooled ones are.

## Files

* `t2-responsiveness-metrics.csv` — every staged and encounter row behind the
  tables above (`source` = staged / encounter; sections `run`, `actor`
  (Bulwarks and Marksmen), `resp` (one row per blind episode), `anglog` (the
  candidate's own decision counts)). The actor rows carry the movement and
  exposure block (`distMedPx`, `shieldErrMedDeg`, `rearExposedMs`,
  `turnArounds`, `stopGo`, `shieldBlocks`, …).
* Five films (`tests/shot-bulwark-angle.mjs`), each panel the live game
  with its real URL flags at 1x, and each verified tick for tick against a
  headless replay of the same seed (26 panels, all identical). Baseline is
  the human's URL with `bulwarkStuck=early`; the candidate adds
  `bulwarkAngle=1`. The cyan arc is the live shield; amber is the committed
  route; the line to the player is green when the AI can shoot, red when it
  is cut (the blocking body outlined).
  * `t2-blind-console-ab.webm` — B2 / B2e, Regular and Elite: the baseline
    stands blind ("idle 3.5s … not moving"); the candidate evaluates, moves
    at 200ms and is shooting by ~2.2s.
  * `t2-cover-navigation.webm` — B4 (round the south-west post: the approved
    stuck correction alone already gets round here — both halves shoot) and
    B5 (behind the long bunk: the baseline never shoots, the candidate walks
    round it).
  * `t2-shield-flanking.webm` — B7, the player running round it with no
    cover: both halves identical, the frozen shield lagging the flank; B3,
    circling a console: the candidate's keep-and-re-angle against the frozen
    Bulwark's lucky spot.
  * `t2-mixed.webm` — MIXED, handset pilot, T1 on in BOTH halves; the only
    difference is `bulwarkAngle`. 40s.
  * `t2-vanguard-invariance.webm` — VANGUARD with and without the Captain:
    the two halves of each pair are the same fight tick for tick; every
    shield is labelled a screen and the candidate is installed on none.

## Handset URLs

All on `https://xletof.github.io/crix/`, with the human's presentation flags.

* **Free Bulwark, baseline vs T2** (MIXED, stuck-B on in both halves):
  * baseline `?roster=v1&gait=v2&move=v22&bulwarkStuck=early&encdbg=mixed&room=detention&sector=12&wave=2`
  * T2 `?roster=v1&gait=v2&move=v22&bulwarkStuck=early&bulwarkAngle=1&encdbg=mixed&room=detention&sector=12&wave=2`
* **MIXED with the approved T1 Marksman in both halves:**
  * baseline `?roster=v1&gait=v2&move=v22&marksmanStuck=early&marksmanAngle=1&bulwarkStuck=early&encdbg=mixed&room=detention&sector=12&wave=2`
  * T2 `?roster=v1&gait=v2&move=v22&marksmanStuck=early&marksmanAngle=1&bulwarkStuck=early&bulwarkAngle=1&encdbg=mixed&room=detention&sector=12&wave=2`
* **VANGUARD regression** (must be unchanged; with and without the Captain):
  * `?roster=v1&gait=v2&move=v22&bulwarkStuck=early&bulwarkAngle=1&encdbg=vanguard&room=hangar&sector=8&wave=2`
  * `?roster=v1&gait=v2&move=v22&bulwarkStuck=early&bulwarkAngle=1&encdbg=vanguard&room=hangar&sector=8&wave=2&nochamp=1`
* Free play with everything opt-in on: `?roster=v1&gait=v2&move=v22&marksmanStuck=early&marksmanAngle=1&bulwarkStuck=early&bulwarkAngle=1`

## Test status (final build `104fc69` + docs)

* `smoke-bulwark-angle` (new) — **75/75** (four times across the work; the
  last in the regression pass).
* T1 byte-equivalence after the `firingSpot.js` exports — 34/34 staged and
  encounter cases identical to `b1ab701` (with and without its stuck flag),
  and `smoke-bulwark-angle` §13 re-proves it.
* Targeted regressions, all against their own named frozen builds where they
  have one: `smoke-bulwark` 92/92, `smoke-bulwark-stuck` 42/42 (vs
  `690ed9b`), `smoke-marksman-angle` 50/50 (vs `95adb1f`),
  `smoke-marksman-stuck` 81/81 (vs `f752b3f`), `smoke-stuck-audit` 40/40,
  `smoke-roster-seams` 70/70, `smoke-roster-2b` 74/74, `smoke-roster-gunner`
  72/72, `smoke-move-v2` 9/9, `smoke-gait-v2` 16/16, `smoke-demolisher`
  91/91, `smoke-vanguard-reinforce` 26/26, `smoke-encounters` 25/25,
  `smoke-encdbg` 33/33 and `smoke-champion-placement` 60/60 (both on a
  FRESH dev server — on the six-hour-old one with many HMR edits behind it
  `smoke-encdbg` read 31/33, the stale-module trap CLAUDE.md already
  records), `vite build` OK.
* **Full `run-all`: 47/52 — NOT green.** Failing: `smoke-camera` (the VANISH
  "fully-opaque old-position interval" was never sampled), `smoke-deflect`
  (one presentation-timing check, a different one each run),
  `smoke-vanguard-front` (the SURGE-during-hold check), `smoke-vanguard-screen`
  (the close-band hold read 114px against ~140) and `smoke-captain` (no
  between-burst gap inside its window). **Every one was A/B'd alone against
  the pre-T2 build `b1ab701`** at the same time: camera, front and captain
  fail with the identical check on both builds, deflect fails on both (a
  different check again), and vanguard-screen passed on both. The container
  is running slower than at T1 (the VANGUARD rig's own printouts: kite
  timeout 3350ms vs 2950, establishment 750ms vs 300 after the second
  shield) and these are frame-rate measurements. Not T2's, not edited; the
  previous debt (`smoke-nemesis`, `smoke-music-tiers`,
  `smoke-champion-placement`) passed this time. The full-suite debt is
  CARRIED, now as these five.
