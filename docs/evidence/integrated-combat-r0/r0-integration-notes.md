# R0 — Integrated combat production-readiness baseline

**INVESTIGATION ONLY. Nothing here is approved, frozen or a default.** R0 changes
no gameplay code: `src/` is byte-identical to the approved T2 baseline `37135c9`
(and to the start of this session, `2af949a`). Every system it exercises keeps
its own approval status; the integrated configuration has **no** approval of
any kind until the human plays it on the handset.

Classification at the end of this file: **R0 NEEDS A SPECIFIC CORRECTION BEFORE
HUMAN REVIEW** (the v2.2 planted-shot deadlock, register #6, surfaces in ordinary
progression under the integrated configuration). The Marksman stuck-B question
can be judged on the handset in parallel, because the defect is identical with
and without that flag.

## 1. What R0 asked, and the short answer

Do the individually approved systems — roster v1, gait v2, movement v2.2,
Bulwark stuck-B, Marksman T1, free-Bulwark T2 — work together as one coherent,
fair and technically reliable combat game, and what does the unapproved
Marksman stuck-B (`?marksmanStuck=early`) add to it?

* **They compose cleanly as software.** Every flag parses; every seam lands on
  exactly the actors its approval names and on nothing else; VANGUARD, the
  Captain and the nemesis exclusions hold; the observer is inert; runs
  reproduce themselves and earlier phases' evidence (45/45, 14/15, 23/24) —
  with one rare, unexplained exception in plain headless replays, now
  reproduced and narrowed (§12); the simulation cost of the whole integration
  is ~0.2–0.6ms median per step.
* **They compose as a fight that is much more active and much more dangerous
  than production.** With B, Marksmen and free Bulwarks stop standing blind
  (Marksman blind standing 47–63% → 7–12% of life; longest blind hold 35–58s →
  ~3s, one 21.9s exception in B), Gunners and Riflemen lose their constant
  thrash (sharp turns /min 50–76 → 7–14). Damage reaching a non-dodging pilot
  rises (pooled) +15% in MIXED, +26% in VANGUARD, +47% in SNIPER NEST, and
  roughly doubles against a player who only hides (median `hide` runs: MIXED
  1.8x, SNIPER NEST 1.9x, Junction s14 2.0x) — driven by T1 in Marksman fights
  and v2.2 Gunners elsewhere (§5–8).
  Whether that is fair is a handset question, not a metric (§13).
* **One material interaction defect.** The v2.2 Gunner / Rifleman planted-shot
  deadlock (register #6, frozen code, deferred) appears in ordinary progression
  whenever the player hides: 5 of 12 integrated `hide` progression runs, up to
  46s standing still, weapon glowing, never released while the line stays cut.
  The production default never does this (its Gunners never stand blind > 2s).
  With T1 and T2 making the other ranged roles active, a frozen Gunner is now
  the one thing on the floor that reads as broken AI (§8).
* **Marksman stuck-B is not needed for T1 to work** (engagement, pressure and
  responsiveness are the same with and without it, within seed noise), **but it
  does change how T1 Marksmen move**: without it, each Marksman takes ~3.5–6
  false 50px sideways skates per minute (the first-check and hold→resume false
  classes), which are about half of all its sharp turns; with it they are gone,
  and a long wall met head-on is cleared in 7.7s instead of 11.9s. The handset
  experience the human approved for T1 (and T2's MIXED) had it ON. Recommendation:
  **Option B — submit Marksman stuck-B for its own handset gate** (§9).

## 2. Repository state

| ref | at start | note |
|---|---|---|
| session branch `claude/zealous-hopper-7rirv8` | `2af949a` | created from canonical |
| canonical `claude/relaxed-faraday-swav9o` | `2af949a` | |
| `FRIX` (Pages) | `2af949a` | deploy run #281 succeeded |
| `src/` vs `37135c9` | identical | `git diff --quiet 37135c9 HEAD -- src/` |

Byte-identity of the approved modules at HEAD: `marksmanAngle.js` = `0b772cf`;
`bulwarkAngle.js`, `bulwarkStuck.js`, `marksmanStuck.js`, `Enemy.js` = `37135c9`.
`firingSpot.js` differs from `0b772cf` only by two `export` keywords and their
comments (T2, `cebd6c5`) — behaviour-neutral; `smoke-bulwark-angle` carries the
T1 byte-equivalence proof (§11). The `Enemy.js` freeze guard
(`enemyJsGuard` from `tests/enemy-frozen.mjs`, called directly — the file itself
is a library) passes: everything outside `EnemyBomber` is byte-identical to
`3ce5680` and the Demolisher veto is the only change. The checkout was shallow
(52 commits) and was unshallowed first; see §11a.

## 3. The configurations (exact URL strings)

| id | flags | what it is |
|---|---|---|
| **A** | *(none)* | production default — what a player gets at `https://xletof.github.io/crix/` |
| **B** | `roster=v1&move=v22&gait=v2&bulwarkStuck=early&marksmanAngle=1&bulwarkAngle=1` | the individually approved systems together, WITHOUT the unapproved Marksman stuck-B |
| **C** | B `&marksmanStuck=early` | B plus the candidate that was ON while T1 (and T2's MIXED) were reviewed |
| D_noBA | B without `bulwarkAngle=1` | isolation: proves T2 never touches VANGUARD |

`D_noMA` (B without T1) and `D_mkOnly` (stuck-B without T1) are defined in the
rig and were not needed. Harness flags `nodlg=1&nofreeze=1` and god mode are
identical in every half. No `productionCandidate` flag was added — the existing
flags were sufficient for every question.

### Flag parsing, verified from the REAL parser on a live page (`raw/r0-census.csv`)

`BootScene.create` parses `?roster=v1`, `?move=v22` (sets `moveV2 = 'v22'`, so
`isMoveV2()` and `isMoveV22()` are both true), `?gait=v2`,
`?bulwarkStuck=prog|early`, `?marksmanStuck=prog|early`, `?marksmanAngle=1`,
`?bulwarkAngle=1`; anything else is the frozen default. The census read the
getters back from `systems/debug.js` on each config: A all default (`legacy`,
false, null); B exactly the six; C the six plus `marksmanStuck: "early"`;
D_noBA without `bulwarkAngle`. The same flags are present in the production
bundle (`npm run build`, grep of `dist/assets/*.js`); only `window.game` is
DEV-gated. (The live Pages site itself cannot be fetched from this container —
the proxy refuses github.io — so "live" rests on run #281 deploying `2af949a`,
whose `src/` is the one measured.)

### Seam installation, verified per spawn (`GameScene.spawnEnemyAt`, census)

Install order in `spawnEnemyAt`: roster art (non-Elite, non-nemesis, not
swarmling) → `_makeElite` → move v2/v2.2 (`shooter`/`grunt`, not nemesis) →
Bulwark stuck (`shielded`, not nemesis; free, screens and openers) → T2
(`shielded`, not nemesis, **not** `spec.vanguardScreen`) → Marksman stuck
(`sniper`, not nemesis) → T1 (`sniper`, not nemesis). T2 wraps the stuck seam
and T1 wraps the Marksman stuck seam (each calls the inner `_tickSwarm` first).

| role | A | B | C |
|---|---|---|---|
| Marksman (Regular, Elite) | nothing | T1 | stuck-B + T1 |
| free Bulwark | nothing | stuck-B + T2 | stuck-B + T2 |
| VANGUARD screen / opener | nothing | stuck-B only (never T2) | stuck-B only |
| Gunner, Rifleman | nothing | v2.2 locomotion | v2.2 |
| Demolisher, swarmling, Captain | nothing | (roster art only on the Demolisher) | same |
| nemesis (`legacyArt`) | nothing | nothing — observed: an Elite nemesis Rifleman and an Elite nemesis Marksman spawned in Detention s16 | nothing — the nemesis Marksman carries neither T1 nor stuck-B |

Observed in 318 integrated runs: `ms` only on ordinary Marksmen and only in C;
`ba` on every free Bulwark and on no screen; no seam on the Captain or any
swarmling or nemesis (the `!spec.legacyArt` guard on every seam, observed live
on the two nemeses the progression cells produced).

**Interactions found by reading the composition.** T1 defers to a stuck
sidestep only in its APPROACH branch (`_stuckSidestepMs > 0`); in HOLD it
overrides the velocity whatever the stuck state. Marksman stuck-B reviews the
base check at the TOP of the next AI tick, before `_moveToward` can consume an
arm — so in B a base arm made while holding is taken by the next approach (the
hold→resume skate), and in C it is stood down. Marksman stuck-B draws no random
number; neither does T1 or T2. Bulwark flags are inert in a Bulwark-free fight:
T1's own handset URL (`angB`) and C are tick-identical in SNIPER NEST
(measured, §5).

## 4. Method

### Instruments (both observe-only)

* `tests/diag-tactical-engagement.mjs` — the 3C-B / T1 / T2 instrument, imported
  unchanged: per-tick Marksman / Bulwark rows (what the tick read, commanded,
  what physics did), Gunner / Rifleman controls, the T1/T2 module logs.
* `tests/diag-integrated-r0.mjs` — the R0 whole-roster observer on top of it:
  every live enemy of every role (motion, 100ms-window sharp turns > 60° and
  reversals > 120°, stop-go, stuck sidesteps actually TAKEN via the bearer's own
  `_moveToward`, crowding and overlapping bodies — enemies do not collide with
  each other), what the player faces per tick (ranged lines of fire within
  900px, telegraphs: Marksman charging / Gunner-Rifleman-Bulwark warn / a
  Demolisher within 160px, hostile bolts within 250px), Marksman concurrency
  (2+/3+ charging, charge starts within 300ms of another, pair spacing, Marksman
  hits within 500ms of each other), the seam census, a wave/encounter log, the
  VANGUARD front and screen clocks, the super meter, the stuck candidates' own
  logs, and the wall time of each simulation step.

**Inertness** (`--only=check`, `raw/r0-check.log`): four cases spanning A/B/C
and four families, 1800 ticks each — observer on vs off, and on vs on in a
fresh page: **identical per-tick trace (position hash + draw count) in all
four**. Re-proved after each observer revision; every reported row comes from
the final revision except where noted.

### Determinism

* Fresh page, same everything → identical (the check above).
* The SNIPER NEST runs were measured twice, by two processes under different
  load: **45/45 identical trace hashes**.
* Across sessions, against earlier phases' evidence: config C equals T2's
  `t1bw` flags. **14/15 MIXED runs match T2's rows (measured at `37135c9`) in
  trace hash and draw count.** The 15th, `mixed:circle` seed 16839, does not —
  and on an idle machine it does not reproduce itself either (§12). Against T1's CSV
  (`ang` = B and `angB` = C in a Bulwark-free SNIPER NEST): 23/24 identical draw
  counts; one row differs by 2 draws, while today `angB` and C are
  tick-identical and C reproduces itself — the historical row is the odd one.

### Coverage

| family | cells | pilots | seeds | configs | ticks | runs |
|---|---|---|---|---|---|---|
| R0-1 MIXED (Detention s12 w2) | 1 | handset, hide, hop2, circle, charge, retreat, flank | 3 | A B C | 2400 | 63 |
| R0-2 SNIPER NEST (Detention s8 w2) | 1 | handset, hide, hop2, hop, charge | 3 | A B C | 2400 | 45 (+45 replay) |
| R0-2b late SNIPER NEST (Junction s14 w3) | 1 | handset, hide, hop2, hop, charge | 3 | A B C | 2400 | 45 |
| R0-3 VANGUARD, ± Captain (Hangar s8 w2) | 2 | handset, hide, circle | 2 | A B C D_noBA | 2400 | 48 |
| R0-4 ordinary progression (real resolver) | 6 | handset, hide | 2 | A B C | 3600 | 72 |
| Marksman staged (3C rig, T1 on) | 17 cases × Regular/Elite | scripted | 3 | A B C | 360–900 | 306 |
| B↔C divergence | 6 | 3 per family | 3 | B C | 2400 | 36 |

Seeds 1001 / 8920 / 16839 are T1's and T2's, so C can be checked against their
CSVs. The progression cells were chosen to span the three bands and the three
ordinary rooms, each starting where the real resolver picks a different
archetype, and they run on into the next wave when the pilot clears one:
Hangar s2 (MIXED → SWARM TIDE → BOMBER RUN), Junction s3 (CROSSFIRE → MIXED),
Detention s6 (CROSSFIRE → VANGUARD), Hangar s10 (BOMBER RUN → VANGUARD +
Captain), Junction s14 (SNIPER NEST), Detention s16 (BOMBER RUN → next).

**Pilots** — real keys, real physics, routed on the room's own NavGrid
(`diag-tactical-engagement`'s, unchanged, plus a new `flank`):
`handset` (hide behind a checkpoint console, step out, hide behind the other —
the human-ish loop), `hide` (stay behind the nearest cover from the threat
centroid), `hop2` (move to the other console every 4s), `circle` (orbit a
console), `charge` (run at the nearest Marksman/Bulwark), `retreat` (farthest
corner), `flank` (new: the side of the nearest free Bulwark its shield does not
face, 170px out), `hop` (adversarial: re-hide opposite the threat every tick).
All fire every 7 ticks along the game's own auto-aim; none dash or dodge.

**What the pressure numbers are.** God mode, so a "hit" is a bolt or blow
that WOULD have landed on a player who never dodges, never dashes, never
dies and stays in the fight for the whole run. They are comparable between
configs for the same cell, pilot and seed, and they are not a difficulty
number: a real player dashes, retreats, dies and restarts. "Fastest full bar"
is the shortest window that delivers 1000 damage (`PLAYER.hp`).

**Limits.** Seeds and pilots are bounded (above); pilots are scripted and the
mechanical ones (`hop`, `charge`) are adversarial on purpose; progression is
six cells of the endless run, not a whole run; dedicated nemesis fights (two
nemeses did spawn in progression), the room modifiers' full rotation, Vader
and the boss room are outside R0. B and C fights part ways
1.6–4.6s in (§9), so per-run differences between them are a different fight
after that tick — compared as paired runs against the seed-to-seed spread, never
as raw totals.

## 5. R0-1 — MIXED ASSAULT (Detention, sector 12, wave 2)

Pooled over 7 pilots × 3 seeds (21 runs per config):

| | A | B | C |
|---|---|---|---|
| damage reaching the player, per minute (pooled) | 18.4k | 21.2k | 20.9k |
| … from Marksmen / Bulwarks / Gunners / Riflemen | 2.7k / 3.2k / 7.4k / 2.7k | 4.8k / 3.8k / 7.7k / 2.7k | 4.8k / 3.8k / 7.2k / 2.7k |
| time with 2+ telegraphs live (median run) | 31% | 44% | 42% |
| player with no line of fire on them (median) | 10% | 8% | 8% |
| Marksman: line open / stood blind / longest blind | 39.5% / 47.5% / 36.6s | 64.7% / 8.0% / 3.3s | 63.7% / 8.7% / 3.3s |
| free Bulwark: line open / stood blind / longest blind | 64.4% / 19.6% / 32.7s | 75.1% / 2.9% / 1.3s | 73.5% / 2.9% / 1.4s |
| Gunner sharp turns / reversals per min | 49.7 / 14.6 | 6.6 / 1.6 | 6.8 / 1.4 |
| Rifleman sharp turns / reversals per min | 76.4 / 14.0 | 13.3 / 4.1 | 11.7 / 4.1 |
| Marksman sharp turns per min | 6.6 | 8.7 | 4.7 |
| free Bulwark mean neighbours within 60px | 0.43 | 0.25 | 0.21 |

* **Distinct pressures, not one blob.** Each role's own instrument reads its own
  intent: Marksmen take angles (T1 reposition 20–22% of life), free Bulwarks
  press round cover with the shield up (T2: against `hide`, blind standing
  34.0% → 0.6%, longest 32.6s → 0.2s), Gunners/Riflemen strafe in committed
  legs. Crowding is lower than production for every ranged role (Gunner
  neighbours 0.32 → 0.11).
* **They complement rather than compete** at the level the instruments can see:
  no role's engagement drops when the others are integrated (shots per minute
  of life: Bulwark 24.9 → 29.6, Marksman 9.2 → 14.6, Gunner 47.2 → 53.4,
  Rifleman 35.2 → 39.3), and nobody is pinned on a
  team-mate (they cannot collide; overlap counts are lower than A).
* **Escape and recovery.** Against the human-ish `handset` pilot, B is no harder
  than A by the median run (13.0k vs 14.8k dmg/min); the pressure rises against
  STATIC answers — `hide` 17.6k → 31.8k, `flank` 21.2k → 24.8k — which is what
  T1/T2 were approved to do (a hidden player no longer waits out a frozen hold).
  Sustained retreat is still the safest answer in every config (`retreat`:
  ~5k dmg/min, 47–51% of the time recovering).
* **Marksman stuck-B does not change this fight materially** (§9): beyond the
  sidesteps themselves, C's paired differences from B split evenly and sit
  inside the seed-to-seed spread.

Pilot-level medians are in `r0-integration-metrics.csv` (section `r0run`) and
the report (`node tests/r0-report.mjs --csv=…`).

## 6. R0-2 — SNIPER NEST (Detention s8 w2; and the late Junction s14 w3)

| Detention SNIPER NEST | A | B | C |
|---|---|---|---|
| Marksman line open / stood blind / longest blind | 34.0% / 53.5% / 34.6s | 63.9% / 6.7% / 3.0s | 65.4% / 6.7% / 2.6s |
| Marksman shots per Marksman-minute | 7.5 | 14.1 | 14.5 |
| damage per minute (pooled) — Marksman part | 7.2k — 2.8k | 10.6k — 5.0k | 11.2k — 5.2k |
| 2+ Marksmen charging at once (share of Marksman time) | 3.0% | 8.4% | 10.4% |
| 3+ Marksmen charging at once | 0.64% | 1.63% | 1.78% |
| charge starts within 300ms of another Marksman's | 28% | 32% | 35% |
| Marksman hits ≤ 500ms apart (per 10 fight-minutes) | 6 | 54 | 59 |
| median spacing between two live Marksmen | 381px | 620px | 622px |

| Junction SNIPER NEST, sector 14 (5 Marksmen in the lead/fill) | A | B | C |
|---|---|---|---|
| Marksman damage per minute (pooled, 5 pilots × 3 seeds, 40s) | 2.5k | 6.6k | 5.9k |
| … against the static `hide` pilot only (median run) | 0 | 14.9k | 15.2k |
| 2+ / 3+ Marksmen charging at once | 13.7% / 3.9% | 20.0% / 5.6% | 18.2% / 5.1% |
| Marksman hits ≤ 500ms apart (per 10 fight-minutes) | 14 | 97 | 76 |
| pairs of Marksmen within 60px (median run) | 27.9% | 18.5% | 24.9% |

* **Choosing positions; mutual interference.** T1's own crowd penalty works:
  Detention Marksmen spread out (median pair spacing 381 → 620px) and stand
  together less. In the Junction they still bunch (a fifth of paired time
  within 60px in every config) — the Junction's reactor geometry funnels the
  band; T1 lowers it, it does not remove it.
* **Cover-hopping.** When a cover hop cuts a T1 Marksman's line it starts
  moving in a median 150ms and has a line again a median 400–620ms after it
  moved (all pilots; T1 instrument). It does not chase the adversarial `hop`
  dancer (its overwatch rule): `hop` damage stays low in every config
  (2.1k / 3.5k / 3.3k dmg/min). Against `hop2` (console to console every 4s):
  3.9k / 5.1k / 5.9k.
* **Simultaneous laser warnings rise 2–3x** and, more to the point for
  fairness, Marksman hits landing within half a second of each other rise ~9x
  (6 → 54 per 10 minutes in Detention, 14 → 97 in the Junction). Two Marksman
  hits are 440 damage — 44% of the bar — with no reaction gap between them. On
  a static `hide` pilot T1 Marksmen land ~70 hits per minute (15.5k dmg/min, A:
  4.3k): hiding behind one console against two or three Marksmen on different
  bearings does not work any more, by design. **Whether the late Junction
  SNIPER NEST stays fair is the single largest open fairness question** — it
  has never been played with T1 (T1 was reviewed in Detention at sectors 8 and
  12), and it carries T1's biggest multiplier (Marksman damage ×2.6 pooled,
  ×5 or more against a player who hides).
* **Cover usefulness.** The share of time with no line on the player ranges by
  pilot from 3% (`hide`) to 50–65% (`hop`) in every config of the Detention
  nest — cover still breaks lines; against T1 it no longer breaks them for
  long (blind Marksman episodes resolve in seconds, §5).

## 7. R0-3 — VANGUARD with and without the Captain (Hangar, sector 8, wave 2)

* **No contamination: B, C and D_noBA (B without T2) are tick-identical in all
  12 cells** (2 encounters × 3 pilots × 2 seeds): T2 is never installed on a
  screen, no ordinary Marksman spawns, so neither T1 nor Marksman stuck-B can
  reach the formation.
* **The protected clocks are identical in A, B and C**: front 2nd shield and
  hold at the same game time, held 3017ms, released by `timeout`; Captain
  arrives at 5.6s (median) in every config; spawn order identical A vs B
  (`spawnOrder`, every cell).
* **What B does change, all from systems approved for VANGUARD**: screens carry
  the approved stuck-B (screen stuck sidesteps 7% → 4% of life, sharp turns
  12.2 → 7.9/min; screen hold share unchanged 61% / 62%), and Gunners carry
  v2.2 — Gunner damage 12.4k → 17.7k/min (pooled), the main reason VANGUARD
  pressure rises 21.4k → 26.9k (+26%) and VANGUARD+Captain 19.8k → 23.2k (+17%).
  The Captain's own damage is unchanged within noise (2.6k → 2.3k).
* **Super economy**: the super meter fills at a similar time (VANGUARD median
  13.9s A / 16.0s B; with Captain 19.5 / 18.9s).
* VANGUARD-with-B is the configuration the T2 review already played
  (`t2-vanguard-invariance.webm`, `bwB`), so nothing here is new to the handset.
* Screens hold blind for up to ~31s in every config, A included (formation
  hold, frozen VANGUARD behaviour) — not an integration effect.

## 8. R0-4 — ordinary progression (real resolver, six cells)

| cell (encounters reached) | A dmg/min (median) | B | C | notes |
|---|---|---|---|---|
| Hangar s2 (MIXED → SWARM TIDE → BOMBER RUN) | 7.9k | 7.9k | = B | B clears waves faster (37 vs 27 kills, `hide` 8920) |
| Junction s3 (CROSSFIRE → MIXED) | 17.3k | 14.2k | 18.7k | |
| Detention s6 (CROSSFIRE → VANGUARD) | 21.4k | 24.9k | = B | Gunner deadlock (below) |
| Hangar s10 (BOMBER RUN → VANGUARD + Captain) | 12.2k | 18.3k | = B | B reaches the VANGUARD wave sooner |
| Junction s14 (SNIPER NEST) | 16.3k | 26.0k | 27.0k | T1 Marksman damage ×2.6 pooled (§6) |
| Detention s16 (BOMBER RUN → next) | 12.6k | 15.1k | = B | Gunner deadlock |

"= B": tick-identical to B (no Marksman in that cell — B and C can only differ
where a Marksman lives). Enemy scaling is the game's own (`enemyHpMult`,
`enemySpeedMult` per sector, identical in every config). Elites appear from the
fill at every band (Elite Rifleman / Gunner / Bulwark / Demolisher / Marksman
all spawned in the sample; so did two Elite nemeses). The NavGrid limits
(register #8) were not separately instrumented in R0.

**Accumulating pressure.** Enemies with B seek lines and so also step into
the player's — the player kills faster in several cells (Hangar s2 `hide`
8920: 37 kills vs 27, reaching the third wave; Hangar s10 `hide`: the VANGUARD
wave at 15.8s vs 53.8s). The fight is more two-sided, not only harder.

### The material defect: v2.2 planted-shot deadlock in ordinary waves (register #6)

* **Where**: the integrated `hide` pilot in ordinary progression — Detention s6
  (seeds 1001, 8920; one Elite), Detention s16 (8920, two Gunners), Hangar s2
  (1001), and one v2.2 Rifleman in Junction s14 (8920): **5 of 12 B `hide`
  progression runs; 0 of 12 `handset` runs; 0 in MIXED, SNIPER NEST or
  VANGUARD** (longest v2.2 blind hold there 3.3s).
* **What**: a Gunner (or Rifleman) whose warning has fired and whose line is cut
  with < 160ms left on its cooldown stands still until the line comes back:
  `fireCd` only counts down with a line (`_maybeFireAt`), `_warnFlashed` stays
  true, and the v2.2 plant (`_warnFlashed && fireCd < 160` → velocity 0) holds
  it. A probe (`raw/`, `probe-gunner`) read the state on every tick of each
  hold: **100% of the held ticks are that plant**, the holds lasted 25–46s and
  none released before the run ended.
* **Impact**: the Gunner stops being a threat (it never shoots), stalls the
  wave (Hangar s2 `hide` 1001 ends with the deadlocked Gunner as the wave's
  last enemy), and reads as broken: a body standing still, weapon glowing,
  facing a wall, next to Marksmen and Bulwarks that visibly hunt for lines.
  Production (A) never does this — legacy Gunners keep moving (longest blind
  stand 2.0s in the same cells). It is identical in B and C.
* **Status**: confirmed defect in frozen v2.2 code, register #6, DEFERRED. R0's
  new information is its prevalence once v2.2 meets an ordinary hiding player,
  and that T1/T2 make it conspicuous by contrast.
* **Smallest next gate (proposal, not authorized)**: *G1 — v2.2 planted-shot
  release*, an opt-in seam installed from `spawnEnemyAt` on `_v22` Gunners and
  Riflemen only: while planted with the line cut for more than a short window
  (e.g. the warning's own 300ms), release the plant (clear the warn so the
  frozen leg logic resumes) — no new random draw, flag-off tick-identical to
  `37135c9`, measured on these exact progression cells and the MIXED / VANGUARD
  sets, then a handset A/B. It reopens frozen movement v2.2, so it needs the
  human's explicit instruction naming it.

Also seen, single runs, not generalized: one B Marksman in Junction s3 `hide`
8920 spent 21.9s in T1's no-spot hold (C's longest in the same cell: 3.2s;
A's: 57s).

## 9. The Marksman stuck dependency — B vs C

**What changes when `marksmanStuck=early` is on, measured:**

1. **False sidesteps.** In real fights, C's own log over 165 Marksman lives:
   4,080 base arms reviewed → 145 first-check (F1) and 3,904 hold stood down,
   31 blocked retreats stood down (logged; register #2 — the base has no
   recovery for a retreat either), **0 base arms kept, 5 early re-arms on an
   approach-pinned body**. The sidesteps actually TAKEN, classified from the
   T1 rows (`mkside`):

   | family | config | Marksman-min | sidestep episodes / Mk-min | F1 | HOLD→resume | PINNED | other |
   |---|---|---|---|---|---|---|---|
   | MIXED | A | 31.0 | 7.67 | 43 | 190 | 2 | 3 |
   | MIXED | B | 30.0 | 4.37 | 41 | 84 | 1 | 5 |
   | MIXED | C | 29.8 | 0.10 | 0 | 0 | 3 | 0 |
   | SNIPER NEST | B | 18.7 | 5.12 | 48 | 47 | 0 | 1 |
   | SNIPER NEST | C | 19.9 | 0.05 | 0 | 0 | 1 | 0 |
   | Junction s14 | B | 15.6 | 3.52 | 10 | 45 | 0 | 0 |
   | Junction s14 | C | 15.8 | 0.06 | 0 | 0 | 1 | 0 |

   Each is a ~53px sideways skate at 1.1x approach speed. T1 reduces them in
   Detention (MIXED 7.7 → 4.4, SNIPER NEST 7.1 → 5.1 per Marksman-minute) but
   not in the Junction (2.4 → 3.5); stuck-B removes them everywhere.
2. **Movement oscillation.** Marksman sharp turns per Marksman-minute (median
   of the per-run values): MIXED B 10.0 → C 5.0 (C lower in **21/21** paired
   runs), SNIPER NEST 13.3 → 6.1 (**15/15**), Junction 5.6 → 2.3 (4/4). About half of a B Marksman's sharp
   turns are false skates.
3. **Genuine obstruction (staged, the 3C rig with T1 on in B and C, 2 roles × 3
   seeds per case, `raw/r0-staged-marksman.csv`)**: a 320px wall met head-on on
   the approach — C reaches the firing band at 7.7s vs B 11.9s (A 11.9s), 17
   shots vs 7; an angled block 5.1s vs 7.2s, 18 shots vs 14. Consoles, 90px
   cover and the hold/retreat-into-cover cases: B ≈ C. In the movement
   transitions B is tick-identical to A (T1 is inert with a clear line) and C
   removes every F1/HOLD skate with the same shots (±2 of 12–22).
4. **Firing-angle commitment, LOS reacquisition, cadence.** T1's own decision
   counts are of the same order in B and C (MIXED commits 920 vs 989,
   reversals 157 vs 191, overwatch 31 vs 40); blind-episode first move median
   167ms vs 150ms, reacquire-after-move 533 vs 583ms, charge-to-shot 817ms in
   both. Paired runs (21 MIXED, 15 SNIPER NEST, 4+4 progression):

   | metric | MIXED: C > B / C < B | SNIPER NEST: C > B / C < B |
   |---|---|---|
   | Marksman shots per Mk-min | 11 / 7 | 8 / 5 |
   | Marksman damage per minute | 9 / 10 | 6 / 5 |
   | all damage per minute | 9 / 12 | 8 / 7 |
   | 2+ telegraphs share | 10 / 11 | 9 / 6 |
   | Marksman blind standing | 13 / 8 | 9 / 6 |
   | Marksman sidesteps / sharp turns | **0 / 21** | **0 / 15** |

   Everything but the sidesteps splits evenly; medians sit well inside the
   seed spread (MIXED: 10.5k dmg/min between seeds of one cell).
5. **Retreat failures.** Unchanged: 31 blocked retreats in C, the base's own
   (register #2); B has the same geometry with no log.
6. **Where the fights part.** B and C are the same fight until the first
   Marksman's first 600ms stuck check: C stands down the F1 arm and B takes it
   on the same tick (1.6–4.6s in, 17/18 cells; one at 29.1s;
   `raw/r0-diverge.csv`). Everything after that tick is a different fight —
   hence paired comparisons, not totals.

**Against the five possible outcomes:**
1. *Practically unnecessary with T1?* For engagement and pressure, yes — T1
   works without it (line open 64%, blind standing 7–12%, longest blind ~3s in
   both). For movement quality, no.
2. *Meaningful additional obstruction recovery?* Limited: real fights produced
   5 early re-arms in 165 lives; the staged long wall is the clear case
   (7.7s vs 11.9s).
3. *Unwanted movement behaviour?* None measured: no new class, no extra
   blind standing outside noise, no cadence change.
4. *Limited benefits, identifiable costs?* Benefits identifiable (no false
   skates, half the sharp turns, better long-wall clearance); no cost found.
5. *Needed for the approved handset experience to stay equivalent?* For the
   way Marksmen MOVE, yes: the human reviewed T1 (and T2's MIXED) with it ON;
   B shows the same Marksman fighting but with ~4–6 false skates a minute each
   that the human has never seen in a T1 review. For pressure and engagement,
   no.

**Recommendation: Option B — submit Marksman stuck-B (`?marksmanStuck=early`)
for its own HUMAN handset gate**, compared directly as B vs C (URLs in §14).
Not Option A: omitting it reintroduces a movement artefact the approved
handset experience did not have. Not Option C: it carries no interaction
defect. Nothing here approves it.

## 10. Performance

Headless (simulation only, the same step the game runs; `raw/r0-perf.log`;
nothing else running; 2400 ticks, handset pilot, seed 1001):

| cell | A median / p95 / p99 ms per step | B | C |
|---|---|---|---|
| MIXED | 0.4 / 1.7 / 4.5 | 0.8 / 2.9 / 5.9 | 0.9 / 3.1 / 6.5 |
| Hangar s10 progression | 0.4 / 1.2 / 3.1 | 0.6 / 2.0 / 4.9 | 0.6 / 2.2 / 4.6 |
| VANGUARD + Captain | 0.5 / 1.5 / 3.7 | 0.8 / 2.2 / 3.9 | 1.1 / 2.8 / 6.6 |

The integration roughly doubles simulation cost per step (T1/T2 searches,
v2.2 legs) — +0.2–0.6ms median, +1–2ms p95 — against a 16.7ms frame. The
matrix's per-run wall times agree in direction but were measured under three
concurrent processes and are not quoted. **Render cost is not measured in a
way that predicts the phone**: the container renders with a software rasteriser
(median 12–16ms, p95 0.8–1.3s per rendered step in MIXED — the known 6–20fps
harness); the rendered pass was stopped after MIXED. Frame rate on the handset
is part of the human review.

## 11. Focused tests and the full suite

### 11a. Targeted suites — run one at a time, nothing else running, at HEAD (`src/` = `37135c9`)

Environment fixes first (no repository change): this container's Chromium is
`chromium-1243` while every rig names `chromium-1194` (a symlink at the old
path), `node_modules` was absent (`npm ci`), and the checkout was **shallow**
(52 commits), so suites that diff an approved baseline could not find it
(`git fetch --unshallow`). Old-build servers for the identity sections ran on
:5174 from detached worktrees, one at a time, stopped by PID.

| suite | result | what it proves for R0 |
|---|---|---|
| `smoke-integration-r0` (new) | **18/18** | parser, seam census, VANGUARD B = C = B-without-T2, Bulwark flags inert without Bulwarks, observer inert |
| `smoke-integration-r0 --selftest` (B and C swapped) | 11/18 — the 7 expected failures (1 B, 1 C, 2 MIXED B/C, 2 NEST B/C, 4) | the checks discriminate |
| `smoke-roster-seams` | 70/70 | roster v1 presentation-only seams |
| `smoke-roster-gunner` | 72/72 (first attempt died on the shallow clone: `bad revision 6560c62`) | Gunner roster |
| `smoke-roster-2b` | 74/74 | Rifleman / Marksman roster |
| `smoke-move-v2` | 9/9 | movement v2.x |
| `smoke-gait-v2` | 16/16 | gait v2 |
| `smoke-bulwark` | 92/92 | Bulwark production visuals / field |
| `smoke-demolisher` | 91/91 | Demolisher production + false-stuck veto |
| `smoke-stuck-audit` | 40/40 | the shared stuck audit instrument |
| `smoke-bulwark-stuck` (vs `690ed9b` on :5174) | 42/42 | Bulwark stuck-B, flag-off identity |
| `smoke-marksman-stuck` (vs `f752b3f`) | 81/81 | Marksman stuck A/B, flag-off identity in SNIPER NEST and MIXED |
| `smoke-marksman-angle` (vs `95adb1f`) | 50/50 | T1, flag-off identity, Enemy.js guard |
| `smoke-bulwark-angle` (vs `b1ab701`) | 75/75 | T2, flag-off identity in MIXED and both VANGUARDs, T1 byte-equivalence |
| `enemyJsGuard` (direct) | pass | `Enemy.js` frozen outside the Demolisher veto |
| `smoke-encounters` | 25/25 | encounter composition |
| `smoke-encdbg` | 33/33 | the `?encdbg` harness R0's URLs use |
| `smoke-vanguard-screen` | 22/22 | VANGUARD screen (a T2 full-run failure; passes standalone) |
| `smoke-vanguard-front` | 30/30 | VANGUARD front (a T2 full-run failure; passes standalone) |
| `smoke-vanguard-reinforce` | 26/26 | VANGUARD reinforcement |
| `smoke-captain` | 38/38 | Shock Captain (a T2 full-run failure; passes standalone) |
| `smoke-camera` | OK | camera (a T2 full-run failure; passes standalone) |
| `smoke-deflect` | 72/73, then **73/73** on a standalone re-run | Vader DEFLECTION; the failing check is the documented frame-rate-sensitive "blade travelling FASTEST" |
| `smoke-champion-placement` | **55/60, twice** — and 55/60 on the pre-T2 build `b1ab701` | see below |
| `smoke-rng` | 17/17 | seeded streams |
| `smoke-pathing` | pass (diagnostic) | NavGrid path quality |
| `smoke-detention`, `smoke-hangar`, `smoke-junction` | 49/49, pass, OK | the rooms R0 fought in |
| `npm run build` | pass | production bundle (flags present) |

**`smoke-champion-placement`, 5 of 60, not an integration effect.** The five
checks that fail all read the wave's spawn queue (`shielded,captain,shielded,…`
where the authored slot expects the Captain third). The smoke boots the real-time
game, waits for `_wave` and 600ms more, then reads `_spawnQueue`; a probe of
the same boot (`probes/probe-placement.*`) shows `_waveSpawned` is already 1
when `_wave` first exists — the first shield has been dequeued, so every index
in the queue is one short. The in-game order is the authored one (every R0
VANGUARD + Captain run, A and B: shield, shield, Captain), the pre-T2 build
fails the same five checks with the same strings, and `src/` is unchanged. It
is a snapshot-timing artefact of this container (7fps under rendering) in a
frozen system's test; the test was not changed. Register #9.

**The full suite was not run.** `src/` is byte-identical to `37135c9`, where the
last full `run-all` was 47/52; the four of those five failures that R0 re-ran
standalone pass (camera, VANGUARD front, VANGUARD screen, Captain) and the fifth
(deflect) passes on a standalone re-run. A full run would re-measure the
harness, not the integration, at ~1.5–2 hours. The suite remains **not green**
on record.

## 12. Determinism and test reliability findings

* Observer inert, fresh-page repeats identical, SNIPER NEST 45/45 identical
  across two processes, T1/T2 historical rows reproduced 23/24 and 14/15.
* **A live, rare non-determinism in plain headless replays (register #10).**
  `mixed:circle` seed 16839 under C (or T2's identical `t1bw` URL), replayed on
  an otherwise idle machine through T2's own measurement path: **2 of 16
  replays leave the others at tick 956**, where the run consumes 48 extra random draws
  in one tick with every body identical on the tick before (8042 → 8090); the
  others are identical to each other and to the R0 matrix row (3 + 5 full
  replays, and 8 more run to tick 957 with a stack recorder on ticks 955–957,
  all of which took the common path — 3 particle draws — so the extra caller
  was not caught). T2's historical row is a third variant. What is ruled out: real clocks (nothing in `src/` reads
  `performance.now`; `Date.now` only in the debug overlay), a load effect (idle
  machine), rendering (headless), the R0 observer (not installed in that path),
  asynchrony inside the measured loop (it runs synchronously in one
  `evaluate`). What remains plausible: state settled asynchronously BEFORE the
  loop (font loading is raced against a 1500ms timeout in `main.js`; hitstop and
  music use `setTimeout`) changing which path a later event takes.
  `probes/probe-nondet.*`, `probes/probe-stack.*`, `probes/recheck-circle.*`.
  T1's `angB nest:handset 1001` row (2 draws off) may be the same family of
  event; today that cell reproduces (C ×2 and `angB` identical).
* **What it means for R0.** Every comparison here is paired and read against
  the seed-to-seed spread, and a rare alternative fight in one cell moves no
  conclusion. Every film is verified tick for tick against its own replay, so
  the films are the runs they claim to be. It does mean "seeded replays match
  tick for tick" is not unconditionally true in this harness, and an identity
  check that fails ONCE in a cell like this is not by itself a regression —
  re-run it before believing it.

## 13. Readiness assessment

**Ready as software, not ready as a production baseline, and not because of
the Marksman question.**

* Integration integrity: **pass** — flags, seams, exclusions, VANGUARD
  invariance, determinism (one rare harness exception, §12), cost.
* Combat cohesion: the roles read as distinct and active together; the one
  role that breaks the picture is the v2.2 Gunner/Rifleman when the player
  hides (§8).
* Fairness: pressure is substantially higher than production in Marksman and
  Gunner fights; Marksman double hits ×7–9; the late Junction SNIPER NEST is
  unreviewed with T1 and is the largest fairness unknown. Only the handset can
  judge it.
* Marksman stuck-B: not a blocker either way; it is a separate approval
  question with a clear recommendation (§9).

## 14. Handset review package

Live build: `https://xletof.github.io/crix/` (Pages from `FRIX`). All URLs use
the real flag parser and the real `?encdbg` debug entry (the encounter overlay
shows on screen).

**The two integrated configurations (normal progression from the start):**

* A (production reference): https://xletof.github.io/crix/
* B: https://xletof.github.io/crix/?roster=v1&move=v22&gait=v2&bulwarkStuck=early&marksmanAngle=1&bulwarkAngle=1
* C: https://xletof.github.io/crix/?roster=v1&move=v22&gait=v2&bulwarkStuck=early&marksmanAngle=1&bulwarkAngle=1&marksmanStuck=early

**MIXED (Detention, sector 12, wave 2):**

* A: https://xletof.github.io/crix/?encdbg=mixed&room=detention&sector=12&wave=2
* B: https://xletof.github.io/crix/?roster=v1&move=v22&gait=v2&bulwarkStuck=early&marksmanAngle=1&bulwarkAngle=1&encdbg=mixed&room=detention&sector=12&wave=2
* C: https://xletof.github.io/crix/?roster=v1&move=v22&gait=v2&bulwarkStuck=early&marksmanAngle=1&bulwarkAngle=1&marksmanStuck=early&encdbg=mixed&room=detention&sector=12&wave=2

**SNIPER NEST (Detention, sector 8, wave 2):**

* A: https://xletof.github.io/crix/?encdbg=sniperNest&room=detention&sector=8&wave=2
* B: https://xletof.github.io/crix/?roster=v1&move=v22&gait=v2&bulwarkStuck=early&marksmanAngle=1&bulwarkAngle=1&encdbg=sniperNest&room=detention&sector=8&wave=2
* C: https://xletof.github.io/crix/?roster=v1&move=v22&gait=v2&bulwarkStuck=early&marksmanAngle=1&bulwarkAngle=1&marksmanStuck=early&encdbg=sniperNest&room=detention&sector=8&wave=2

**Late SNIPER NEST (Reactor Junction, sector 14, wave 3 — the unreviewed fairness case):**

* A: https://xletof.github.io/crix/?encdbg=1&room=corridor&sector=14&wave=3
* B: https://xletof.github.io/crix/?roster=v1&move=v22&gait=v2&bulwarkStuck=early&marksmanAngle=1&bulwarkAngle=1&encdbg=1&room=corridor&sector=14&wave=3
* C: https://xletof.github.io/crix/?roster=v1&move=v22&gait=v2&bulwarkStuck=early&marksmanAngle=1&bulwarkAngle=1&marksmanStuck=early&encdbg=1&room=corridor&sector=14&wave=3

**VANGUARD with the Shock Captain (Hangar, sector 8, wave 2; B and C are identical here):**

* A: https://xletof.github.io/crix/?encdbg=vanguard&room=hangar&sector=8&wave=2
* B: https://xletof.github.io/crix/?roster=v1&move=v22&gait=v2&bulwarkStuck=early&marksmanAngle=1&bulwarkAngle=1&encdbg=vanguard&room=hangar&sector=8&wave=2
* without the Captain (B): https://xletof.github.io/crix/?roster=v1&move=v22&gait=v2&bulwarkStuck=early&marksmanAngle=1&bulwarkAngle=1&encdbg=vanguard&room=hangar&sector=8&wave=2&nochamp=1

**The Gunner deadlock, to see it (Hangar, sector 2 — hide behind cover and wait):**

* B: https://xletof.github.io/crix/?roster=v1&move=v22&gait=v2&bulwarkStuck=early&marksmanAngle=1&bulwarkAngle=1&encdbg=1&room=hangar&sector=2&wave=1

### HUMAN acceptance questions (not answered here)

1. **Combat cohesion** — do the enemy types feel like one intentional combat system?
2. **Tactical readability** — does each enemy's behaviour communicate a recognizable purpose?
3. **Movement naturalness** — active without robotic repositioning, hesitation or thrashing? (Watch the Gunners when you hide.)
4. **Fairness** — does the higher pressure keep real counterplay? (Late Junction SNIPER NEST especially.)
5. **Marksman dependency** — does `marksmanStuck=early` (C) improve or worsen the experience against B?
6. **Production quality** — would this be a satisfying baseline for normal progression?

## 15. HUMAN decisions required

1. Marksman stuck-B: run its own handset gate (B vs C) — recommended — or omit it.
2. Whether to authorize *G1 — v2.2 planted-shot release* (reopens frozen v2.2; §8).
3. The fairness of T1-level Marksman pressure outside Detention (late Junction SNIPER NEST).
4. Default rollout of any flag — not asked by R0, not recommended until 1–3 are settled.

## 16. Files

| file | what |
|---|---|
| `r0-integration-notes.md` | this file |
| `r0-report.md` | the report tables over the matrix (`tests/r0-report.mjs --t1`): pressure per scenario × pilot, movement per role, Marksman sidesteps by cause, B↔C paired tests, VANGUARD clocks, progression cells, seam census, cross-session determinism, the T1 instrument tables |
| `r0-integration-metrics.csv` | 6,739 rows: one per run (`r0run`), per role per run (`r0role`), per Marksman stuck sidestep taken (`mkside`), the T1/T2 instrument's per-actor rows (`actor`), the staged 3C cases (`staged-*`) and the B↔C divergence rows; every row carries `source`, `family`, `pilot`, `config`, `seed` |
| `raw/r0-matrix-{0,1,2}.csv` | the 228-run matrix, all sections (incl. the T1/T2 `resp` / `anglog` rows the instrument reports read) |
| `raw/r0-sniper-{0,1}.csv` | the 90-run Marksman-concurrency pass (SNIPER NEST identical to the matrix, 45/45) |
| `raw/r0-staged-marksman.csv` | 306 staged 3C runs (obstacles + transitions), A/B/C |
| `raw/r0-diverge.csv`, `raw/r0-diverge.log` | first B↔C tick per cell and the Marksmen's state there |
| `raw/r0-census.csv` | the parser read-back and seam census per config |
| `raw/r0-check.log` | observer inertness + fresh-page determinism (final instrument) |
| `raw/r0-perf.log` | headless step cost (A/B/C × 3 cells) and the stopped rendered pass |
| `probes/` | the Gunner-plant probe, the `angB` = C probe, and the non-determinism re-check / probes, each with its output |

**Films — new, each panel verified tick for tick against a plain headless
replay (`tests/shot-integrated-r0.mjs`), 2 game ticks per frame (1x), 30s:**

| film | panels | what to watch |
|---|---|---|
| `r0-mixed-abc.webm` | A / B / C, MIXED, handset, seed 1001 | A's Marksmen and Bulwark standing "LOS CUT"; B's and C's taking angles (amber routes); B's Marksmen skating sideways (magenta, 4.7s over the 30s) where C's do not (0s) |
| `r0-sniper-nest-bc.webm` | B / C × `hop2` / `hide`, SNIPER NEST, seed 1001 | the Marksman dependency: same Marksmen, B's false skates vs C's none; the hide pilot under 2–3 Marksmen from different bearings |
| `r0-vanguard-invariance.webm` | A / B, VANGUARD + Captain, handset, seed 1001 | formation, screens, Captain arrival; B (= C = B without T2, tick for tick, per the matrix) |
| `r0-progression-gunner-plant.webm` | A / B, Hangar s2 w1 (MIXED by the real resolver), `hide`, seed 1001 | the v2.2 Gunner boxed in amber, "PLANTED FOR THE SHOT · LINE CUT", standing for the rest of the film; A's Gunners keep moving |

Film seed rule: seed 1001 (the first seed) for every film, chosen before
filming; the progression cell is the one where the matrix measured the deadlock.
Overlay quirk: a charging Marksman's label can read "CHARGING · CHARGING" (state
name plus the charge suffix) — presentation of the overlay only.

**Existing evidence reused, and how far it can be trusted for R0:**

* `../bulwark-angle-t2/t2-mixed.webm` — its CANDIDATE panel is config C in
  MIXED, handset, seed 1001; R0's C run of that cell matches T2's row in trace
  hash and draws, so it is the same fight.
* `../bulwark-angle-t2/t2-vanguard-invariance.webm` — VANGUARD with `bwB` vs
  `bwAB`; with no Marksman in VANGUARD, `bwB` is B's VANGUARD fight by the same
  exclusion R0 measured (not separately hashed).
* `../marksman-angle-t1/t1-sniper-nest.webm` — its `angB` panel is C's SNIPER
  NEST flags; that cell's historical T1 row is 2 draws off today's (§12), so
  it illustrates C but is not offered as R0's measured run.

**Rigs** (in `tests/`, see `tests/README.md`, R0 section): `diag-integrated-r0.mjs`,
`shot-integrated-r0.mjs`, `r0-report.mjs`, `r0-merge.mjs`,
`smoke-integration-r0.mjs`.
