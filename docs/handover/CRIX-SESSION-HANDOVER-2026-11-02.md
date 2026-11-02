# CRIX / FRIX — session handover, 2026-11-02

Written at the close of the tactical-AI sequence (Phase 3A shared stuck audit →
3B Bulwark stuck recovery → 3C Marksman stuck recovery → 3C-B tactical audit →
T1 responsive Marksman → T2 responsive free Bulwark). Its job is to let a fresh
Claude Code or ChatGPT session continue **without the chat history**.

**Authority order if anything here disagrees:** the repository itself (verify
with `git`), then `HANDOVER.md` §0 (the canonical current state), then
`CLAUDE.md` (rules and traps), then this file (a dated snapshot). This file does
not override any of them; it indexes them.

---

## 1. Project identity

* **What it is.** FRIX (the repo and docs also say CRIX) is a mobile-first,
  twin-stick top-down arena shooter in a Star Wars-flavoured Imperial setting:
  endless sectors of composed enemy waves across four authored arenas (Hangar,
  Reactor Junction — id `corridor` —, Detention Block, Vader Chamber), a Darth
  Vader boss on a ladder, a Shock Captain Champion, nemesis mini-bosses, an
  upgrade draft, touch controls with a Super and a melee ("Broken Wings").
  `HANDOVER.md` §1–§4 describe the game as built.
* **Repository:** `github.com/Xletof/crix`.
* **Development branch:** `claude/relaxed-faraday-swav9o` (trust
  `git rev-parse --abbrev-ref HEAD` over this line).
* **Deployment branch:** `FRIX`. `.github/workflows/deploy.yml` ("Deploy to
  GitHub Pages") runs on every push to `FRIX` (no path filter) and on manual
  dispatch. Nothing else deploys.
* **Live build:** https://xletof.github.io/crix/ — it is whatever `FRIX`
  points at.
* **Stack:** vanilla JavaScript ES modules, Phaser 3.90 (`node_modules`
  resolves 3.90.0), Vite 5. No TypeScript. All pixel art is generated in code
  (`src/systems/pixelArt.js`); there are no sprite image assets.
* **Testing:** `npm run dev` (Vite on :5173) in one shell; standalone
  Playwright smoke suites in `tests/` (`node tests/<suite>.mjs`) and the
  sequential `npm run smoke` (`tests/run-all.mjs`, 52 suites). Headless runs
  are slow (~6–20 fps); `tests/README.md` documents the ways the harness lies.
* **HUMAN gameplay verdicts are the only authority that closes a gameplay or
  visual system, and a verdict FREEZES it.** A green suite, good metrics or a
  good screenshot never close anything. The human tests on a phone against the
  Pages build. "The bot is not the balance authority" — automated metrics are
  instruments for relative comparison only.

## 2. Repository state at closure

| ref | value |
|---|---|
| T2 approved gameplay baseline | `37135c9` (code in `cebd6c5` + `104fc69`) |
| T1 approved gameplay baseline | `0b772cf` |
| Dev branch HEAD before closure | `37135c9` |
| `FRIX` before closure | `37135c9` |
| Pages run for `37135c9` | workflow "Deploy to GitHub Pages" (id 283799904), run #278 (39861264083) — **success** |
| Working tree before closure | clean |
| Closure | ONE documentation-only commit on top of `37135c9` adds this file and updates `HANDOVER.md`, `CLAUDE.md`, `tests/README.md` and the T2 notes. `src/` is byte-identical to `37135c9`. |

The closure commit's own SHA cannot be written inside the commit that creates
it. **Verify instead of trusting:**

```
git fetch origin claude/relaxed-faraday-swav9o FRIX
git rev-parse HEAD origin/claude/relaxed-faraday-swav9o origin/FRIX
git log --oneline -5                      # top = the closure commit, then 37135c9
git diff --stat 37135c9 HEAD -- src/      # must print nothing
git status --short                        # must print nothing
```

Then check the newest run of `deploy.yml` on `FRIX` (GitHub Actions, or the
GitHub MCP `actions_list` with `resource_id: deploy.yml`). A docs-only push to
`FRIX` still triggers a deploy (no path filter); it rebuilds the same game.

## 3. Approval and freeze ledger

"Approved" = a HUMAN handset verdict. "Opt-in" = only active with its URL flag.
**Nothing on this list is a production default unless the row says so.**

| phase | feature | HUMAN status | reference | flag(s) | protected | NOT approved |
|---|---|---|---|---|---|---|
| 3C-T1 | Responsive Marksman tactical engagement | **APPROVED / FROZEN 🔒** | `0b772cf` | `?marksmanAngle=1` | the whole module and its timings; `firingSpot.js` (shared; any change must prove T1 byte-equivalent) | default activation; any Marksman gameplay change |
| T2 | Responsive free-Bulwark tactical engagement | **APPROVED / FROZEN 🔒** | `37135c9` | `?bulwarkAngle=1` | the whole module as built (scoring, 150–250ms confirm, commitment, failed-spot memory, KEEP 600ms, BRACE 1.2/1.8/2.4s, shield invariants, exclusions) | default activation; the blind cooldown change; any Bulwark gameplay change |
| 3B | Bulwark stuck recovery, Candidate B | **APPROVED / FROZEN 🔒** | `4f09af6` + `f8ea738` (evidence `79f243a`) | `?bulwarkStuck=early` | the module; VANGUARD with B | default activation; `?bulwarkStuck=prog` (A, rejected, kept for comparison) |
| 3C | Marksman stuck recovery A / B | **NOT approved** — 3C's gameplay result was REJECTED on the handset; B was ON during T1's review, which grants it nothing | baseline `f752b3f` | `?marksmanStuck=early` / `=prog` | — | everything |
| 3A | Shared stuck-detection audit | diagnosis only; **correction NOT authorized** | `690ed9b` | — | `Enemy.js` (frozen) | any shared movement change |
| 2C | Bulwark production visuals | APPROVED / FROZEN | `cd4b0e9` | `?roster=v1` | body, field, absorption, tear, facing | default rollout |
| 2D | Demolisher production visuals + false-stuck veto | APPROVED / FROZEN | `23bf202` | `?roster=v1` (veto is in `Enemy.js` `EnemyBomber`) | body, warning, detonation, gait, veto | default rollout |
| 2A/2B | Roster Gunner/Rifleman/Marksman visuals, movement v2.2, gait v2 | APPROVED / FROZEN | `e2e4109` | `?roster=v1`, `?move=v22`, `?gait=v2` | as approved | default rollout |
| Roster A | Encounter composition (six archetypes) | APPROVED / FROZEN | §10ac | none (production) | compositions, gates, bands, multipliers | — |
| Roster B | Champion placement, VANGUARD screen / front / surge rules | APPROVED / FROZEN | `a3563a4` | none (production); `?encdbg` harness only for testing | screen hold 140 / resume 165, front, lanes, Captain arrival | — |
| Champion | Shock Captain V1 | APPROVED / FROZEN | `6560c62` | production via placement | everything about him | variants, a second Champion |
| — | Vader (ladder, moves, DEFLECTION, LIGHTS OUT, saber) | APPROVED / FROZEN | `83dee24`, DEFLECTION `6b98bbc` | production | all | — |
| — | Camera (six passes) | APPROVED / FROZEN | `HANDOVER.md` §21 | production | all `CAMERA` values | Phase 3B camera work |
| — | Four arenas | APPROVED / FROZEN | §10ab | production | topology, art, lighting | — |

Technical validation (green targeted suites, invariance proofs) is recorded per
phase in `HANDOVER.md` §0 and the evidence notes; it is NOT approval.
**Production-default activation of any opt-in flag is a separate human
decision in every case above.**

## 4. Marksman — how it got here

1. **Phase 3A, shared stuck audit** (`docs/evidence/shared-stuck-audit/`).
   The frozen base stuck check in `Enemy.preUpdate` (600ms windows) has two
   FALSE classes: the FIRST check reads 0px moved (its reference starts
   undefined) and fires a sidestep on almost every approaching role; and
   HOLD → RESUME — every enemy is `behavior: 'swarm'`, so a body that stood
   still on purpose sidesteps on its first tick back on the move. 87% of the
   stuck sidesteps taken by ordinary roles in six real encounters were false.
   Diagnosis only; `Enemy.js` stays frozen.
2. **Phase 3C, Marksman stuck candidates** (`marksman-stuck-v3c/`,
   `src/systems/marksmanStuck.js`). A and B review each base check and stand
   the false ones down; B also keeps/arms real recoveries. Mechanically they
   worked (false sidesteps gone, band reached as often as the frozen game).
3. **The handset rejected the gameplay result:** *"They keep waiting instead
   of attacking me or going around visual obstacles. I don't even notice much
   between original and candidate B."* — *"Shielded enemies do same."*
4. **Phase 3C-B, tactical-engagement audit** (`tactical-engagement-audit/`,
   start at `failed-handset-analysis.md`). The real problem was not stuck
   detection: the Marksman HOLDS on distance alone (anywhere in 300–640px) and
   never asks whether it can shoot from there — 42.6% of its life standing
   blind in a reconstructed MIXED, against 4.7% / 2.1% for the Gunner and
   Rifleman whose v2.2 movement chooses spots by whether a shot exists. **A
   stuck fix cannot help a body that is exactly where its rule put it.** That
   is why fixing stuck detection alone did not solve passive combat.
5. **T1, responsive Marksman** (`marksman-angle-t1/`, `marksmanAngle.js` +
   the shared pure search `firingSpot.js`). Evaluate on the first blind tick,
   confirm 140–260ms by walk length, commit to one spot on the band, re-plan
   only for a reason, OVERWATCH (1.4 / 2.2 / 3.0s) after repeated
   target-caused re-plans. The human had rejected a proposed 700ms idle wait
   before it was built: *"1–2 seconds to wait idle and freeze before moving is
   still too laggy and robotic."* MIXED blind standing 36.5% → 7.0%, SNIPER
   NEST 51.9% → 6.9%.
6. **HUMAN verdict:** *"Exactly as: it reacts promptly, its repositioning
   looks intentional, it doesn't fall back into conspicuous robotic pauses,
   and SNIPER NEST remains challenging but fair. My test result is pass."*
   Approved/frozen on `0b772cf`, reviewed with `marksmanStuck=early` on.
   Turn-arounds (~1.3 per Marksman-minute), overwatch holds and the higher
   pressure are accepted inside it.
7. **Still separate:** the 3C stuck candidate's own approval; the blocked
   retreat (register #2); the weapon, laser, charge and lock are frozen
   class behaviour and were never touched.

## 5. Bulwark — how it got here

1. **Phase 3B, stuck recovery** (`bulwark-stuck-v3b/`, `bulwarkStuck.js`).
   Candidate B removes the two false stuck classes for every ordinary Bulwark
   (free, VANGUARD screen and opener, Regular and Elite) while keeping real
   recovery. Handset: *"Yes it does, approved."* Opt-in, frozen.
2. **The passive-hold defect** (3C-B, same audit as the Marksman): the free
   Bulwark walks straight in until 290px (`desiredRange` 260 + 30) and stands
   whether or not it has a line — 20.1% of its life blind in MIXED, holds of
   30s+.
3. **T2** (`bulwark-angle-t2/`, `bulwarkAngle.js`). A Bulwark is not a
   Marksman: a Marksman fixes a cut line by changing ANGLE at range; a Bulwark
   PRESSES ROUND THE OBSTACLE with its shield toward the player. So T2 has its
   own search (arcs round the player on [140, 280], within 60° of its bearing,
   current range or closer first, farther out only when nothing closer
   works), its own commitment, a KEEP for a spot it has fought from (600ms
   while the target moves), a BRACE (1.2 / 1.8 / 2.4s) instead of a chase, and
   five no-stop-go rules. **It never writes the shield, the gun or the
   cooldown** — so a flank is still a flank (`smoke-bulwark-angle` §6/§7
   reproduce the frozen turn law and cooldown law on every AI tick). This is
   why the two roles use different policies rather than one controller: their
   identities (range-and-angle vs shield-forward pressure) need opposite
   answers to the same blocked line, and T1 was frozen first.
4. **VANGUARD exclusion by construction:** installed only when the spawn
   spec has neither `legacyArt` (nemesis) nor `vanguardScreen` (screens and
   openers both carry it). VANGUARD ± Captain is tick-identical with the flag
   on (18/18 seeded runs).
5. **Measured:** MIXED (7 pilots × 3 seeds, stuck-B on both halves)
   free-Bulwark blind standing 21.4% → 2.9%, longest blind hold 34.6s → 1.4s,
   shots 22.1 → 27.6 per Bulwark-minute; with T1 on both halves 20.4% → 2.7%.
6. **HUMAN verdict:** *"I completed T2 handset testing, and all five criteria
   passed. My HUMAN verdict is APPROVE and FREEZE Phase T2 Free Bulwark
   tactical engagement in the tested opt-in configuration."* Frozen on
   `37135c9`.
7. **Accepted limitations:** less pressure against a player circling one
   console; KEEP may hold 600ms; reacquire→warn delay from the blind cooldown
   (register #3); more movement than the frozen hold.

## 6. Source architecture (verified at `37135c9`)

| file / function | role |
|---|---|
| `src/entities/Enemy.js` | All ordinary enemy classes (`EnemyShooter`, `EnemyGrunt`, `EnemyShielded`, `EnemySniper`, `EnemyBomber`, …). **FROZEN**: `tests/enemy-frozen.mjs` pins every class outside `EnemyBomber` to `3ce5680` (the Demolisher veto is the one authorized change). `EnemyShielded._tickSwarm` turns the shield at 2.6 rad/s, holds inside 290, and calls `_maybeFireAt`, which only counts `fireCd` down with `canSee && _hasLOS`. |
| `GameScene.spawnEnemyAt(type, x, y, spec)` (`src/scenes/GameScene.js` ~2015) | Builds the enemy, then installs the opt-in seams in this ORDER: `installBulwarkStuck` (`shielded && !legacyArt`), `installBulwarkAngle` (`shielded && !legacyArt && !vanguardScreen`), `installMarksmanStuck` (`sniper && !legacyArt`), `installMarksmanAngle` (`sniper && !legacyArt`). Each later seam wraps the earlier one. |
| `src/systems/bulwarkStuck.js` | 3B. Shadows the bearer's `_tickSwarm` / `_moveToward`; reviews each base 600ms check; intent from the AI's own `_moveToward` calls. |
| `src/systems/bulwarkAngle.js` | T2. Shadows `_tickSwarm`; reads the body's velocity before calling the frozen tick, calls it, then `review()` overrides velocity only while the geometric line is cut. `findBulwarkSpot` is its pure search. Publishes `_angDest`. Reads `fireCd` only to notice a shot. |
| `src/systems/marksmanStuck.js` | 3C candidates A/B (not approved). |
| `src/systems/marksmanAngle.js` | T1. Same seam shape; uses `findFiringSpot`. |
| `src/systems/firingSpot.js` | T1's pure spot search (`findFiringSpot`) plus `bodyPath`, `clearOf`, `route` (the last two exported, unchanged, for T2). Shared and frozen. `route()` treats NavGrid's single-node fallback as "no route". |
| `src/systems/NavGrid.js` | Grid pathing with a fixed 23px clearance; `findPath` returns a one-node path at the target when it fails. |
| LOS / collision | `Enemy._hasLOS` against `GameScene.losRects`; `_standable` for spot validity; physics walls and 70×70 cover bodies under 112px cover sprites. |
| `src/systems/debug.js` | Flag getters: `getBulwarkStuck`, `getMarksmanStuck`, `isMarksmanAngle`, `isBulwarkAngle`, plus roster/move/gait. |
| `src/scenes/BootScene.js` | Parses the URL flags into `debug.js`. |
| Rigs | `tests/diag-tactical-engagement.mjs` (observe-only instrument; `--only=t1staged/t1enc/t2staged/t2enc`, `--t1report`, `--t2report`), `tests/smoke-bulwark-angle.mjs`, `tests/smoke-marksman-angle.mjs`, `tests/smoke-bulwark-stuck.mjs`, `tests/smoke-marksman-stuck.mjs`, `tests/smoke-stuck-audit.mjs` (src-diff guard), `tests/shot-*-angle.mjs` (verified films). |

## 7. Combat identities (approved intent)

* **Marksman:** long-range firing-angle control; a readable 800ms charge with
  a 260ms lock and laser; repositions purposefully along its band when the
  line is cut; retreats when rushed.
* **Free Bulwark:** frontal shield pressure (blocks frontal ordinary fire; the
  piercing Super goes through), closes to and holds at ~290px, presses round
  obstacles deliberately, legitimately flankable because the shield turns at
  only 2.6 rad/s.
* **VANGUARD screen:** an authored formation role — closes to 140, holds,
  resumes past 165, opening pair staged as a front with lanes — and protected
  from T2 by construction.
* **Gunner / Rifleman:** v2.2 movement chooses spots by line of fire.
* **Demolisher:** fast runner with an armed-payload warning and false-stuck veto.
* **Shock Captain:** the reference Champion — a humanoid combatant with a
  corridor rifle, tactical step, Arc Grenade and a two-layer durability model.

## 8. Evidence index

| record | what it supports |
|---|---|
| `docs/evidence/shared-stuck-audit/` (`stuck-shared-audit-notes.md`) | the two false stuck classes, per role; the decision gate |
| `docs/evidence/bulwark-stuck-v3b/` (notes, five films, CSVs) | 3B mechanics and its approval |
| `docs/evidence/marksman-stuck-v3c/` (notes, five films, CSVs) | 3C mechanics; the candidate the handset rejected |
| `docs/evidence/tactical-engagement-audit/` (`failed-handset-analysis.md`, `tactical-engagement-root-causes.md`, `tactical-recovery-proposal.md`, metrics, three films, obstacle map) | the reconstruction of the rejected handset run; why both roles were passive |
| `docs/evidence/marksman-angle-t1/` (`t1-candidate-notes.md`, `t1-responsiveness-metrics.csv`, `t1-blind-console-ab`, `t1-cover-hop`, `t1-charge-integrity`, `t1-mixed`, `t1-sniper-nest` films) | T1 behaviour, verified tick for tick, and its approval |
| `docs/evidence/bulwark-angle-t2/` (`t2-candidate-notes.md`, `t2-responsiveness-metrics.csv`, `t2-blind-console-ab`, `t2-cover-navigation`, `t2-shield-flanking`, `t2-mixed`, `t2-vanguard-invariance` films) | T2 behaviour, verified tick for tick (26 panels), and its approval |
| `tests/smoke-bulwark-angle.mjs` (75/75) | T2 invariants: flag-off identity, exclusions, shield and cooldown laws, VANGUARD invariance, T1 equivalence |
| `tests/smoke-marksman-angle.mjs` (50/50 at T2 regression) | T1 invariants |

**Human-reviewed URLs** (base `https://xletof.github.io/crix/`):
* T2 free Bulwark: `?roster=v1&gait=v2&move=v22&bulwarkStuck=early[&bulwarkAngle=1]&encdbg=mixed&room=detention&sector=12&wave=2`
* MIXED with T1: `?roster=v1&gait=v2&move=v22&marksmanStuck=early&marksmanAngle=1&bulwarkStuck=early[&bulwarkAngle=1]&encdbg=mixed&room=detention&sector=12&wave=2`
* T1 SNIPER NEST: `?roster=v1&gait=v2&move=v22&marksmanStuck=early&marksmanAngle=1&encdbg=sniperNest&room=detention&sector=8&wave=2`
* VANGUARD regression: `?roster=v1&gait=v2&move=v22&bulwarkStuck=early&bulwarkAngle=1&encdbg=vanguard&room=hangar&sector=8&wave=2` (`&nochamp=1` without the Captain)

`?encdbg` is a test harness overlay that is inert without the flag.

## 9. Test and infrastructure debt

* **Full `run-all` at T2: 47/52 — NOT green.** Failing: `smoke-camera`
  (VANISH opaque interval never sampled), `smoke-deflect` (one timing check,
  different each run), `smoke-vanguard-front` (surge-during-hold),
  `smoke-vanguard-screen` (hold read 114px vs ~140), `smoke-captain` (no
  between-burst gap in its window). Each was re-run ALONE against the pre-T2
  build `b1ab701` at the same time: camera, front and captain failed the
  identical check there too, deflect failed there too (another check), screen
  passed on both. Evidence against a T2 regression; not proof the debt is gone.
* **Full `run-all` at T1 (`0b772cf`): 49/52** — `smoke-nemesis`,
  `smoke-music-tiers`, `smoke-champion-placement` (the last a fixed-sleep race
  against the spawn drip; it passed 60/60 on a fresh server at T2).
* **Targeted suites green at T2:** bulwark-angle 75/75, bulwark 92/92,
  bulwark-stuck 42/42 (vs `690ed9b`), marksman-angle 50/50 (vs `95adb1f`),
  marksman-stuck 81/81 (vs `f752b3f`), stuck-audit 40/40, roster-seams 70/70,
  roster-2b 74/74, roster-gunner 72/72, move-v2 9/9, gait-v2 16/16, demolisher
  91/91, vanguard-reinforce 26/26, encounters 25/25, encdbg 33/33,
  champion-placement 60/60; `vite build` OK. T1 byte-equivalence 34/34.
* **Frame-rate sensitivity:** the container varies in speed; timing-window
  checks fail under a slow runner. Rule: a failure is not a regression until it
  reproduces standalone AND does not reproduce on the previous build.
* **Fresh-server trap:** a Vite dev server that hot-reloaded edited modules can
  serve a module twice; restart it before trusting a suite (`smoke-encdbg` went
  31/33 → 33/33).
* **Determinism:** the rigs seed `Math.random`; anything that consumes random
  numbers (particles, overlays, a filming camera) changes the fight. Films are
  published only after a tick-for-tick replay check passes.
* **Owed:** a full-suite run on a quiet, normal-speed runner.

## 10. Deferred work — a NON-AUTHORIZED backlog

The canonical register (18 items, with statuses) is `HANDOVER.md` §0
"UNRESOLVED-WORK REGISTER". Snapshot of the most gameplay-relevant, in a
suggested order by documented severity — **recommendations only; the human
selects the next milestone:**

1. **Gunner plant-for-the-shot deadlock** (v2.2, frozen): 16–28s blind holds
   measured — the same "waiting" symptom the human rejected, in another role.
   SEPARATE APPROVAL REQUIRED (touches approved v2.2 movement).
2. **Shared stuck false classes for the other roles** (Rifleman, Gunner,
   Swarmling, nemesis bases): audit done; correction needs the human gate.
3. **Marksman stuck-B approval or retirement**, and the **blocked Marksman
   retreat**.
4. **Free-Bulwark blind cooldown** (reacquire→warn delay): accepted inside T2;
   only on new handset evidence.
5. **Cover concealment radius** unreachable by a colliding player.
6. **NavGrid**: the one-node fallback and fixed clearance (engine debt).
7. **Test infrastructure**: the load-sensitive suites, the renderer divergence.
8. **Rollout decision** for the opt-in flags (`roster=v1`, `gait=v2`,
   `move=v22`, `bulwarkStuck=early`, `marksmanAngle=1`, `bulwarkAngle=1`).

Other open options from `HANDOVER.md` ("The recommended next area of work"):
Elite gameplay redesign, Commander/Lieutenant planning, more arenas, a super
registry, the flat-depth cleanup. None is started.

## 11. Next-session instructions

1. **Orient:** read `HANDOVER.md` §0 (top status block, then the phase
   sections and the register), `CLAUDE.md` in full, `tests/README.md`, then
   this file.
2. **Verify refs** with the commands in §2. If anything moved since this file,
   reconcile it; never reset, discard or force-push.
3. **Summarize your understanding to the human and wait** for an instruction.
   No phase is authorized by inheritance.
4. **Preserve frozen baselines:** `Enemy.js` stays frozen (`enemy-frozen.mjs`);
   T1/T2/3B modules are not tuned; a change to `firingSpot.js` must prove T1
   byte-equivalent; a change elsewhere must prove flag-off identity against
   the previous build.
5. **A new HUMAN gate is required** for: any gameplay/AI/navigation/combat
   change; any change to a frozen system; enabling any flag by default; any
   visual system (handset approval closes and freezes it).
6. **After a change, run** the suites touching it, the src guard
   (`smoke-stuck-audit`), the role smokes for the touched role, and
   `vite build`; A/B any failure against the previous build, standalone.
7. **Evidence:** staged cases in the real room, fresh page per case/seed,
   metrics via the diag instrument, films only when verified tick for tick.
8. **Commits and deploy:** one logical change per commit; push the dev branch;
   fast-forward `FRIX` (never force; stop and ask if not a fast-forward); confirm
   the Pages run. Commit and push at every checkpoint — the container has
   rolled back before.
9. **Process discipline:** single agent unless the human asks for subagents;
   PID-owned background jobs, one waiter at most, clean up and name survivors
   (the Vite dev server); never edit `src/` while browser runs are live (HMR).

## 12. Last HUMAN decision

> "I completed T2 handset testing, and all five criteria passed. My HUMAN
> verdict is APPROVE and FREEZE Phase T2 Free Bulwark tactical engagement in
> the tested opt-in configuration."

The last authorized task was this documentation closure and handover. **No
subsequent gameplay implementation has been approved.**

---

## NEW CLAUDE CODE SESSION — BOOTSTRAP

```
You are continuing the CRIX / FRIX project (repo Xletof/crix, dev branch
claude/relaxed-faraday-swav9o, deploy branch FRIX → https://xletof.github.io/crix/).

Before doing anything else:
1. Read HANDOVER.md §0 — start with "CURRENT STATUS — 2026-11-02" and the
   "UNRESOLVED-WORK REGISTER".
2. Read docs/handover/CRIX-SESSION-HANDOVER-2026-11-02.md (approval ledger,
   Marksman/Bulwark history, source map, evidence index, test debt).
3. Read CLAUDE.md in full and tests/README.md.
4. Verify state: git fetch origin claude/relaxed-faraday-swav9o FRIX;
   git rev-parse HEAD origin/claude/relaxed-faraday-swav9o origin/FRIX;
   git status --short; git diff --stat 37135c9 HEAD -- src/ (expect empty
   unless a later human-authorized change landed).

Facts to hold:
- Marksman T1 (?marksmanAngle=1, 0b772cf) and free-Bulwark T2
  (?bulwarkAngle=1, 37135c9) are HUMAN-APPROVED and FROZEN. Both are OPT-IN,
  not defaults. Bulwark stuck-B (?bulwarkStuck=early) is approved/frozen and
  opt-in. Marksman stuck-B (?marksmanStuck=early) is NOT independently approved.
- The full suite is NOT green: run-all 47/52 at T2 (camera, deflect,
  vanguard-front, vanguard-screen, captain — each also failing on the pre-T2
  build). Do not claim green; do not weaken tests.
- HUMAN handset verdicts are the only gameplay authority.

Then summarize your understanding back to me — current refs, what is frozen,
what is open — and STOP. Do not implement any gameplay, AI, navigation or
combat change, and do not enable any flag by default, until I give a new
instruction.
```

## NEW CHATGPT SESSION — CONTINUITY BRIEF

```
I'm continuing work on CRIX / FRIX, a mobile twin-stick top-down arena shooter
(Phaser 3.90 + Vite, vanilla JS; repo github.com/Xletof/crix; dev branch
claude/relaxed-faraday-swav9o; deploys only from branch FRIX to
https://xletof.github.io/crix/).

Roles: you are the technical and creative REVIEWER. Claude Code is the
IMPLEMENTATION agent working in the repository. I (the human) am the only
authority on gameplay: my handset verdicts approve and FREEZE systems, and
nothing frozen reopens without new play evidence from me.

Where we are (2026-11-02):
- We just closed a tactical-AI sequence. The problem: Marksmen and free
  Bulwarks HELD on distance alone and stood blind behind cover ("they keep
  waiting instead of attacking me"). Fixing stuck detection did not help; the
  fix was tactical repositioning.
- Marksman T1 (?marksmanAngle=1, commit 0b772cf): HUMAN-APPROVED / FROZEN —
  prompt reaction to a lost firing line, purposeful angle changes, no robotic
  pauses, SNIPER NEST challenging but fair.
- Free Bulwark T2 (?bulwarkAngle=1, commit 37135c9): HUMAN-APPROVED / FROZEN —
  all five criteria passed: prompt response, purposeful repositioning,
  frontal shield pressure while still flankable, no robotic pauses, MIXED
  challenging but fair. It never touches the shield, gun or cooldown;
  VANGUARD formation shields are excluded by construction.
- Bulwark stuck recovery (?bulwarkStuck=early) is approved/frozen. Marksman
  stuck recovery (?marksmanStuck=early) is NOT independently approved.
- ALL of these are OPT-IN URL flags; none is a production default. Making
  any of them default is a separate decision I have not made.
- Other frozen systems: Vader boss, the camera, the four arenas, encounter
  composition, the Shock Captain Champion, VANGUARD screen/front rules,
  roster visuals, movement v2.2 and gait v2.
- Test debt: the full automated suite is 47/52 (frame-rate-sensitive
  failures that also occur on the pre-T2 build). Not green.
- Known open issues (none authorized): a Gunner "plant-for-the-shot"
  deadlock that causes long blind holds; the shared stuck-detection false
  sidesteps for other enemy roles; a Marksman blocked-retreat case; the free
  Bulwark's cooldown not running while blind; an unreachable cover
  concealment radius; NavGrid fallback/clearance debt; and a rollout decision
  for the opt-in flags.

No new development gate has been selected. The repository documents are the
source of truth: HANDOVER.md §0, CLAUDE.md, and
docs/handover/CRIX-SESSION-HANDOVER-2026-11-02.md. Please continue from the
actual repository state, help me choose the next milestone, and do not assume
any work is approved until I say so.
```
