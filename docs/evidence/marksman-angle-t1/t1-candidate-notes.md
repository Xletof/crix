# Phase 3C-T1 — the responsive Marksman (`?marksmanAngle=1`)

**A CANDIDATE. Opt-in, not approved, not a default, not frozen.** Nothing in
this folder is a handset verdict; the handset is the only thing that can give
one. Every number here comes from the real Detention room, the real AI and
an autopilot player, and the bot is not the balance authority.

## What the human asked for

The Phase 3C-B diagnosis found the Marksman's hold is a pure distance rule:
in 300..640px it stands still whether or not it can shoot, so a player behind
a console neutralises it for as long as they like (42.6% of its life in a
reconstructed MIXED). The proposal in `tactical-recovery-proposal.md` waited
`blindMs` = 700ms before searching. The human rejected that wait before it
was built:

> "I think 1–2 seconds to wait idle and freeze before moving is still too
> laggy and robotic. I would prefer it more natural like how real soldiers or
> most games would do it."

So the brief was `LOS lost → evaluate immediately → confirm briefly → commit
→ move`, never `LOS lost → stand still 700ms → search → move`.

## Architecture

Two files, one flag, one install line. **`src/entities/Enemy.js` is not
touched** (`tests/enemy-frozen.mjs` still passes — EnemySniper is byte for
byte the frozen class).

* `src/systems/firingSpot.js` — pure, deterministic spot search. Candidates on
  arcs AROUND THE PLAYER (a marksman changes angle, not range), 36px steps up
  to 504px either way, at its current range ±60 and at `desiredRange` (560),
  clamped to the band [340, 610] — inside the frozen thresholds, so arriving
  never flips the frozen branch. A candidate survives only if it is
  `_standable` (v2.2's test), has `_hasLOS` to the player (the fire gate's own
  test) and is not within 60px of another body, another body's claim
  (`_angDest` / v2.2's `_dest`), a spot that failed in the last 3s, the spot it
  just left, or itself. Cost = walk length + penalties: a line that does not
  survive the player stepping 40px either way (+45 per side), distance from
  560 (×0.25), turning round on the side it just walked (+70 within 2s),
  crowding (≤60 within 140px of a body or claim), and — against a MOVING
  player — no line to where their motion puts them by arrival (+110). The walk
  must be straight for the WHOLE body (three rays at the full radius + 2px) and
  stay outside the retreat ring; failing that, the six nearest are routed on the
  NavGrid with a reachability guard (a single-node result in another cell is NO
  route) and string-pulled with the same body rays.
* `src/systems/marksmanAngle.js` — the per-bearer seam. It shadows the bearer's
  own `_tickSwarm` (or `?marksmanStuck=`'s shadow of it), calls it FIRST and
  unchanged, then reviews: retreat → stand aside; charging → stand aside; line
  open → stand aside (or finish a step ≤90px to a better spot that still has
  the line); line cut → the decision below. It only ever writes
  `setVelocity`, at `cfg.speed` in the hold band and `0.7 × cfg.speed` in the
  approach band — the frozen speeds, read live so sector scaling, FRENZY and
  the Elite's 0.9× all apply. No `Math.random`, no listeners, no timers, no
  tweens; state lives on the actor.
* Installed from `GameScene.spawnEnemyAt` for `type === 'sniper' &&
  !spec.legacyArt` — ordinary Regular and Elite Marksmen only, never the
  nemesis, never any other archetype — AFTER the stuck candidate, so the stuck
  module reads the frozen tick's velocity before anything here runs.

## The decision, tick by tick

1. **Immediate evaluation.** On the FIRST tick the line is cut, it searches.
   There is no idle wait before the search. Two states defer it by design: an
   OVERWATCH hold already running (step 4), and the approach band's live stuck
   sidestep (which owns that step). Measured over every candidate episode in
   the staged and encounter runs (1,109): evaluation at 0ms in 1,046; later
   in 50 (up to 1,350ms — the ones traced began inside an overwatch hold and
   were evaluated the tick it expired); never reached in 13 (the line came
   back, or the branch changed, first).
2. **Situation-dependent confirmation, 140–260ms.** `140 + 0.25ms per px of
   planned walk`, capped at 260: a one-step fix commits almost at once, a long
   walk is worth a beat more certainty. During it the body holds, as a person
   does for the fraction of a second it takes to register a target has gone.
   **Transient hold:** if the player's own motion puts them back in the line
   from right here within 350ms, it keeps holding (at most 520ms) — someone
   crossing behind a console reappears; someone hiding behind it does not.
3. **Commit and move.** A fresh search at the moment of commitment, then one
   destination, eased in over ~60ms and arriving with a slow-in, facing the
   player the whole way (the frozen tick sets the aim). It is NOT re-chosen
   every frame. It is abandoned only for a reason:
   * **line opens** — stop where it opened (or finish a ≤90px step whose
     destination still has the line); the frozen weapon takes over;
   * **retreat** — the player inside 300px: the frozen retreat runs untouched;
   * **hold ↔ approach** — the frozen branch flipping only changes the speed;
     a destination that still has its line is kept (re-planned otherwise);
   * **stale** — rechecked every 120ms, and after a 450ms minimum commitment a
     destination that lost its line (or was taken) is replaced in the same
     tick — **unless the target is mid-crossing** (the transient test above), in
     which case it stops and watches rather than turning round after them;
   * **failed walk** — less than 35% of the expected progress over 180ms, or
     past `travel / speed + 600ms`: the spot is remembered as failed for 3s and
     the next one is searched in the same tick;
   * **arrival, still blind** — the next spot, same side if it works, at once.
4. **Overwatch, not a chase.** Three target-caused re-plans inside 3s means
   chasing is not working: it holds the angle it has for 1.4s (then 2.2s, then
   3.0s if the dance continues with no charge in between — the first charge
   resets it), and the weapon still fires the instant a line opens. Then it
   evaluates again immediately.
5. **No spot at all** — the frozen hold stands, one search per 250ms, no
   velocity written (T8 is tick-identical to the frozen game).

## Where the timings came from, and what changed during the pass

* **Player motion is read from 250ms of real displacement, not one frame's
  velocity.** The first build read `player.body.velocity`; the harness's
  circling pilot walks stop-and-go (keys pressed and released toward a moving
  target), so one frame says 0 and the next says 380. Both the transient hold
  and the lead were reading noise. Measured on T4 (circling): the Marksman
  committed toward the side the player was LEAVING at the start of 4 of 5
  blind episodes, walked ~0.5s, and turned round. With the displacement
  estimate: 0 reversals.
* **Hold-and-watch at a stale destination** was added for the same case: the
  walk had gone stale because the target was crossing, and 130ms later the line
  came back where the body already stood. Turning round was the wrong answer.
* **Hold ↔ approach no longer re-plans** — a player hovering at the 720px
  boundary re-aimed the walk three times in half a second (T5).
* **Full-body walk test** — at v2.2's 0.9× radius one T7 walk grazed a console
  corner for a tick.
* **The proposal's 1,200ms gap between commitments is not here.** Anti-thrash
  is the 450ms minimum before a target-caused re-plan, the failed-spot memory,
  the side memory, the watch and overwatch — none of which is an idle cooldown.

## Staged results (real Detention, 2 seeds per case, fresh page per case)

`tactical-t1-staged.csv` rows → `t1-responsiveness-metrics.csv`. Every build
carries the handset's presentation flags `roster=v1 gait=v2 move=v22`;
"frozen" adds neither candidate, `mkB` adds `marksmanStuck=early` (the rejected
handset URL), and `ang` / `angB` add `marksmanAngle=1` to each. In every staged case `ang` = `angB`
except the two cover-hop pilots.

| case | frozen (and mkB) | candidate (ang / angB) |
|---|---|---|
| T1 clear line | 20 shots/min, 0% blind | **tick-identical** |
| T2 blind behind the heavy console, 520px | 0 shots in 20s, blind 100% | eval 0ms, moving 233ms, 21 shots/min, blind standing 1.2% |
| T2e same, Elite | 0 shots, blind 100% | eval 0ms, moving 233ms, 21 shots/min, blind standing 1.2% |
| T3 player crossing behind cover | blind 10.8% | **tick-identical** (transient hold, 0 commitments) |
| T4 circling a console | blind standing 14.1%, 19.2 shots/min | 7.4%, 21.6 shots/min, 0 reversals |
| T5 cover hop (every 4s) | 0 shots in 25s, blind 100% | 7.2 shots/min, blind standing 21–22%, longest 2.9s |
| T5b adversarial dancer (re-hides every tick) | 0 shots, blind 100% | 2.4–4.8 shots/min, blind standing 40–49%, overwatch 6–7× |
| T6 rush | retreat | retreat (identical direction and speed on every unobstructed tick) |
| T7 far, then behind the south bench | blind 90%, 0 shots | 21.6 shots/min, blind 1.5% |
| T8 no spot exists | holds | **tick-identical** |
| T9 four Marksmen | 2 of 4 blind for 20s | all 4 fire, 0 shared destinations |
| T10 Regular + Elite | both blind 100% | both fire, blind 1.3% |
| T11 line flickering | blind standing 51% | 2.7% |
| T12 retreat into cover | — | **tick-identical** |

Responsiveness per persistent blind episode in the hold band (≥250ms), the
candidate: evaluation 0ms in every episode; **first movement 133–267ms**
(median per case; T5 p90 2.2–2.9s is an episode spent in NO SPOT while the
player was out of reach, then a walk); line back a median 0.6–1.5s after the
first step; charge on the line's first tick when the cooldown had counted down
blind; shot 817ms after the charge starts (the frozen 800ms windup, to the
tick). The full table is in this file's companion CSV and in the report below.

## Real encounters (Detention, the real spawner, AI live, god mode)

MIXED (sector 12, wave 2 — the encounter the human rejected) × 7 player
pilots, SNIPER NEST (sector 8, wave 2) × 4 pilots, × 3 seeds × 4 builds, 40s
each: 132 runs. The pairs that answer the brief differ ONLY in the angle flag
— `frozen` vs `ang`, and `mkB` (the rejected handset URL,
`roster=v1 gait=v2 move=v22 marksmanStuck=early`) vs `angB` (the same + the
flag). Pooled over pilots and seeds, ordinary Marksmen only (n = Marksman
lives):

| encounter | build | n | live s | shots / min | line open | blind standing | longest blind | Marksman hits on player / min |
|---|---|---|---|---|---|---|---|---|
| MIXED | frozen | 62 | 1914 | 9.7 | 40.2% | 38.4% | 36.5s | 12.1 |
| MIXED | ang | 58 | 1769 | 12.6 | 55.9% | 7.4% | 3.3s | 18.9 |
| MIXED | mkB (rejected URL) | 62 | 1903 | 10.5 | 46.5% | 36.5% | 35.7s | 13.9 |
| MIXED | angB (URL + flag) | 61 | 1952 | 14.0 | 60.0% | 7.0% | 3.3s | 20.9 |
| NEST | frozen | 47 | 949 | 8.7 | 37.9% | 49.6% | 34.6s | 12.5 |
| NEST | ang | 58 | 946 | 15.0 | 67.5% | 6.3% | 2.8s | 25.9 |
| NEST | mkB | 56 | 1066 | 8.0 | 37.0% | 51.9% | 36.1s | 12.1 |
| NEST | angB | 60 | 978 | 15.1 | 67.4% | 6.9% | 2.5s | 25.8 |

"Blind standing" is the share of a Marksman's life spent still with the
geometric line cut and no charge running — the human's "they keep waiting".
The remaining 7% is mostly confirmation (140–260ms per episode), the
hold-and-watch, overwatch and no-spot holds. **Hits on the player rise** —
~1.5× in MIXED, ~2× in NEST, with no weapon number changed. That is the
encounter getting harder because a Marksman that can shoot does, and it is a
handset judgement, not a measurement this rig can settle.

### Response timing, per persistent blind episode in the hold band (≥ 250ms)

| encounter | build | episodes | moved | first movement ms (median / p90 / max) | commitment ms (median) | evaluation ms (median) | line back after first step ms (median / p90) | stand-blind ms per episode (median / p90 / max) | stop-starts |
|---|---|---|---|---|---|---|---|---|---|
| MIXED | frozen | 308 | 63* | — | — | — | 583 / 2400 | 717 / 3983 / 36550 | 63 |
| MIXED | ang | 323 | 274 | 150 / 250 / 2250 | 167 | 0 | 517 / 1950 | 183 / 517 / 16583 | 172 |
| MIXED | mkB | 332 | 33* | — | — | — | 650 / 1933 | 750 / 3067 / 35683 | 33 |
| MIXED | angB | 347 | 291 | 150 / 233 / 1200 | 150 | 0 | 583 / 2167 | 183 / 517 / 10733 | 191 |
| NEST | frozen | 145 | 44* | — | — | — | 567 / 2400 | 1383 / 5400 / 34633 | 44 |
| NEST | ang | 136 | 126 | 150 / 267 / 2750 | 150 | 0 | 583 / 2650 | 167 / 1367 / 2750 | 70 |
| NEST | mkB | 151 | 26* | — | — | — | 1350 / 2800 | 1267 / 3867 / 36067 | 26 |
| NEST | angB | 146 | 137 | 150 / 267 / 2550 | 150 | 0 | 617 / 3083 | 167 / 1550 / 3250 | 82 |

\* on the frozen builds "moved" is a frozen branch (retreat / approach /
stuck sidestep) moving the body during the episode, at 0ms — never a decision
to find a line. Line→charge was 0ms (median) in every build (the cooldown
counts down blind, so a reacquired line is charged on its first tick) and
charge→shot 817ms in every build: the frozen windup to the tick. Every row,
per Marksman and per episode, is in `t1-responsiveness-metrics.csv`.

### Where the long tails come from

* **MIXED `hide`, one Marksman, 20–32s blind (ang seed 8920 actor 4: a 32s
  episode with 22 commitments, 19 stale re-plans, 6 overwatches; angB 10.7s
  standing inside a 20.9s episode).** The `hide` pilot re-hides every second
  on the far side of a console from the CENTROID of all threats, with perfect
  information. One Marksman chases (walk, spot goes stale, re-plan), falls
  back to overwatch (up to 3.0s), and never gets a line; the other Marksmen
  shoot the hidden player at 41–43 hits a minute against 12–14 on the frozen
  build. Fixing that one needs coordination between Marksmen (crossfire),
  which is not T1.
* **First movement p90/max in the seconds** — an episode that began in NO
  SPOT (the player outside the band, or every spot taken) and moved once one
  appeared. Evaluation was still at 0ms.

### Turning round (what a handset sees of re-planning)

`tests/diag-marksman-angle-turns.mjs` — at every commitment replaced by
another in the same tick, the turn between the old walk's heading and the
new one. MIXED × 7 pilots and SNIPER NEST × 4, 2 seeds, 22 runs a
build (~15 minutes of fight, 4–6 Marksmen each):

| build | commitments | replaced in the same tick | turned round (>120°) | of those inside 450ms | walk before turning, median / p10 | px walked, median / p10 |
|---|---|---|---|---|---|---|
| angB (URL + flag) | 681 | 266 | 41 | 9 | 533 / 317ms | 89 / 35px |
| ang | 615 | 208 | 36 | 7 | 533 / 300ms | 86 / 46px |

That is **about 1.3 visible turn-arounds per Marksman-minute** (41 in 31.7
live Marksman-minutes under angB, 36 in 28.7 under ang — the same runs as the
t1enc matrix's seeds 1001 and 8920). Most come after the
full half-second walk the 450ms rule guarantees; the short ones follow an
arrival or a failed walk. The adversarial `hop` pilot (re-hides opposite the
Marksmen EVERY TICK) carries 14 of the 41 under angB. `log.reversals` (a
side-of-the-player flip) over-counts this: a player running round the room
flips the side without the body ever turning.

## The films (all 1x, real AI, verified tick for tick against the headless replay)

* `t1-blind-console-ab.webm` — T2 / T2e: the rejected URL vs the same + flag,
  Regular and Elite. Baseline stands blind with the label counting; the
  candidate is moving at 233ms and shooting by ~2.6s.
* `t1-cover-hop.webm` — T5 (the player hops between the checkpoint consoles
  every 4s) and T4 (circling a console), baseline vs candidate.
* `t1-charge-integrity.webm` — the weapon untouched: a clear-line charge
  (identical to baseline), a flickering line (baseline cancels and re-arms;
  the candidate takes a cancelled charge, then walks to a line that holds),
  and a rush (retreat wins).
* `t1-sniper-nest.webm`, `t1-mixed.webm` — the full encounters, rejected URL
  vs the same + flag, the `handset` pilot (hide behind one checkpoint console,
  step out, hide behind the other).

The overlay: a GREEN line is a Marksman that can see and shoot this tick; RED
is a cut line with the blocking body outlined; BLUE is a line that is
geometrically open while the AI does not SEE the player (the frozen patrol
vision cone early in a wave, or concealment) — the frozen awareness, which
this candidate deliberately does not touch; amber is the committed route and
destination. Each panel is replayed headless afterwards on a plain page and
must match tick for tick, or the film is not written. No interpolation: every frame is
the game's own render of the tick it shows (2 game ticks per 30fps frame).

## What it does NOT do

* It does not touch the weapon. 800ms windup, 260ms lock, laser, locked
  angle, LOS cancel and its 500ms re-arm, cooldown, projectile, damage,
  recoil, hp, collider — all frozen code, and `smoke-marksman-angle` §5
  measures the windup tick count, lock drift (0) and every shot's angle
  against the frozen build.
* It does not touch concealment or range — those are not geometry, and moving
  does not solve them.
* It does not touch the nemesis Marksman, the Gunner, Rifleman, Bulwark,
  Demolisher or Swarmling, VANGUARD, the Captain, NavGrid, or any shared
  movement code.
* It does not change `?marksmanStuck=` — both install, both work, and on a
  clear line the stuck candidate's own counters are identical with and without
  it.

## Known defects and open questions

1. **Turning round is reduced, not gone** — see "Turning round" above. Most
   turn-arounds come after a full half-second walk and are a re-plan behind a
   player who moved; a few follow a short walk (arrival or a failed walk, not
   the 450ms-gated stale re-plan). Removing them all means replacing them
   with pauses, which the brief also forbids. A handset question.
2. **An adversarial re-hider can still keep ONE Marksman blind for 20–30s**
   (MIXED `hide`, above) while the others shoot them. Solving it needs the
   Marksmen to coordinate (crossfire), which is not T1.
3. **Overwatch holds up to 3.0s.** It only follows three target-caused
   re-plans inside 3s with no charge between, and the weapon fires the moment
   a line opens — but it is standing blind, and the human's objection was to
   standing. 1.4 / 2.2 / 3.0s are numbers chosen on the adversarial pilots,
   not on a handset.
4. **Stop-starts.** Within one blind episode a Marksman moves, stops and moves
   again about 0.5 times per episode in MIXED (watch, overwatch, a short
   no-spot gap between walks). Never more than once per episode in the staged
   hop and circling cases; the encounter number is the honest one.
5. **The encounter is harder.** Marksman hits on a god-mode player rise
   ~1.5× in MIXED and ~2× in SNIPER NEST. No weapon, cadence or hp number
   moved; the Marksmen are simply shooting instead of waiting.
6. **The walk is the existing presentation.** A repositioning Marksman faces
   the player and uses the approved gait v2 cycles (the strafe cycle when it
   walks sideways). No animation work was done; whether it reads as a soldier
   changing position is a handset question.
7. **Not addressed, by scope:** the free Bulwark still holds blind inside
   290px (the human's "shielded enemies do same" — T2, not started); a
   blocked RETREAT (a separate tracked Marksman defect); concealment near
   cover (a colliding player can never enter the bush radius); the Gunner
   plant-for-the-shot deadlock; the nemesis Marksman.
8. **Harness, not game:** twice the circling-candidate film panel left its
   headless replay at tick 479 while another heavy browser job ran alongside;
   it never reproduced alone. Every published film is verified; the
   mechanism is unknown (`tests/README.md`).
