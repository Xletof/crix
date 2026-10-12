# SHARED STUCK-DETECTION AUDIT — Phase 3A (diagnosis and evidence only)

**SHARED STUCK AUDIT COMPLETE — CORRECTION NOT AUTHORIZED.**

Baseline `04cd882` (Phase 2D closure; dev branch = `FRIX` = HEAD at the
start, clean tree). **Nothing under `src/` was changed** — every counterfactual
below is a page-side patch inside a test rig's own browser page, and
`tests/smoke-stuck-audit.mjs` §0 checks `git diff 04cd882 -- src/` is empty.
The default game, the five frozen roles, movement v2.2, gait v2, Gunner fire
v5, the Bulwark shield system, VANGUARD and the Demolisher correction are
exactly as approved.

| file | what it is |
|---|---|
| `stuck-callpath-matrix.md` | the block, its ten-point lifecycle, role-by-role execution |
| `stuck-first-check-proof.png` | eight roles at their first check: position, reference, what the base measured, what really happened |
| `stuck-clear-lane-ab.webm` | five roles, empty lane, frozen vs counterfactual, 1x (+3x slow repeat of 0.4-1.5s) |
| `stuck-obstacle-ab.webm` | a real wall: frozen / counterfactual / recovery switched off, 1x |
| `stuck-movement-v22-ab.webm` | Gunner + Rifleman, default / `move=v2` / `move=v22` × frozen / counterfactual, 1x |
| `stuck-vanguard-live.webm` | the real VANGUARD + Captain encounter, instrumented, frozen vs counterfactual, 1x |
| `stuck-role-metrics.csv` | 3400 rows: every scenario × role × variant × seed |
| `tests/diag-stuck-audit.mjs` | the instrument, every counterfactual, the matrix (`--merge` builds the CSV) |
| `tests/smoke-stuck-audit.mjs` | proves the instrument observes the real game (38 checks, standalone) |
| `tests/shot-stuck-audit.mjs` | the evidence rig |

---

## 1. The architecture in four lines

`Enemy.preUpdate` (`Enemy.js:882-913`, frozen) runs a 600ms test: `moved =
hypot(x − (ref ?? x))`, arm a 600ms perpendicular sidestep at 1.1× speed if
`moved < 12`, re-anchor. **The reference is never initialised**, so the first
test always reads 0px. **The move-state gate is always true** (`spawnEnemyAt`
stamps `behavior: 'swarm'` on every enemy), so the test also arms whenever a
body stands still on purpose. The only consumer is `_moveToward`; a tick that
writes velocity itself never sees the arm. Full trace:
`stuck-callpath-matrix.md`.

## 2. How it was measured

**The instrument** (`diag-stuck-audit.mjs`) wraps three prototype methods in
the page — the base `preUpdate` (to observe the block), `_moveToward` (which
branch it took) and each class's outer `preUpdate` (commanded velocity, wall
contact, real displacement) — and writes nothing in variant A.

**Every armed check is classified** from the 600ms window it measured:

- **F1** — the first check, and the body had really moved ≥12px. False.
- **HOLD** (H1 on a first check) — the AI commanded speed under 25% of its own
  speed on most ticks: a deliberate stop. False.
- **BLOCK** (B1) — commanded movement with wall or arena-bounds contact. True
  obstruction.
- **OTHER** (O1) — commanded movement, no contact, net under 12px: a reversal
  or a tight orbit.

It is TAKEN when `_moveToward` actually drove the body sideways.

**Variants**, all page-side, never production:

| variant | what it is | random draw |
|---|---|---|
| **A** | the frozen game | — |
| **init** | the shared initialisation correction: the reference seeded with the spawn point | **not made** when the body moved |
| **veto** | the Demolisher correction generalised to every role, nemesis included | kept |
| **prog** | veto plus a progress-aware check: stand down any arm whose window shows the AI holding still | kept |
| **off** | CONTROL, never a candidate: stuck recovery switched off entirely | — |

**Determinism.** A seeded `Math.random` and a 60Hz fixed step. Metrics runs use
`Game.headlessStep` (the same update, no render); the smoke proves it is
tick-for-tick identical to the rendered game. Every staged run starts from a
cleared room. The encounter matrix was run twice and its 432-row CSV
reproduced byte for byte.

**Seeds.** 8 per staged cell (1001 + 7919k) and 4 per encounter cell. Raw
counts and denominators are in the CSV.

**The cases:**

- **A — clear lane:** spawn 900px north of a standing player in an emptied
  hangar, with cover bodies, LOS rects and the nav grid all cleared.
- **B — genuine obstruction:** a 90×90 block or a 240 / 420 × 40 wall dead on
  the lane, either 140px ahead (touched inside the first window by the fast
  roles) or 450px ahead (touched after it).
- **C — moving player:** lateral sweeps, circling, crossing behind.
- **C2 — hold → resume:** the player stands 4s, then backs off 350px twice.
- **D — six real encounters** (CROSSFIRE, VANGUARD, VANGUARD + Captain, SNIPER
  NEST, SWARM TIDE, MIXED, plus CROSSFIRE under `move=v22`): the real spawner,
  a scripted god-mode player moving and firing for 30s.
- **VANGUARD front:** the player standing at four places, 4 seeds, with and
  without the Captain.

## 3. Findings

### 3.1 Does an unobstructed moving enemy falsely enter stuck recovery at its first check? **YES — every ordinary role.**

Clear lane, frozen game, 8 seeds each (`stuck-first-check-proof.png`,
`stuck-clear-lane-ab.webm`):

| role | first check armed | taken | lateral travel | engagement, frozen → counterfactual | shots in first 5.5s, frozen / cf (8 runs) |
|---|---|---|---|---|---|
| Rifleman | 8/8 | 8/8 | 184px | 3333 → 2733ms (**+600ms**) | 24 / 30 |
| Rifleman Elite | 8/8 | 8/8 | 166px | 3633 → 3033 (+600) | 24 / 30 |
| Gunner | 8/8 | 8/8 | 126px | 3550 → 2950 (+600) | 34 / 40 |
| Gunner Elite | 8/8 | 8/8 | 112px | 3883 → 3283 (+600) | 33 / 40 |
| Bulwark | 8/8 | 8/8 | 94px | 4967 → 4367 (+600) | 16 / 20 |
| Bulwark VANGUARD screen | 8/8 | 8/8 | 94px | hold not reached in 5.5s → 5433 | 16 / 20 |
| Marksman | 8/8 | 8/8 | 68px | 3083 → 2483 (+600) | 8 / 16 |
| Swarmling | 8/8 | 8/8 | 205px | 3383 → 2783 (+600) | — |
| Demolisher (corrected) | 8/8 armed | **0/8** | 0 | 2850 = 2850 | — |

**The mechanism, as the proof sheet shows it.** At t = 0.60s the reference is
`undefined`, so the base measures exactly 0px against 61-181px of real travel,
arms, and the body slides 600ms at right angles to its target. The arm is
taken in 8/8 seeds for every role and adds exactly 600ms to every approach.
Shots fall only because the body engages later; line of sight in the empty
lane is 100% in both variants.

**In real encounters**, frozen game, default movement, 4 seeds × 30s, ordinary
roles: **387 bodies spawned, 381 first checks armed as F1, 371 taken.** Most
of the 10 not taken were Gunners already strafing in their pocket. (Spawn
gates sit ≥400px from the player, so nearly everything is still approaching at
0.6s.)

### 3.2 Genuine obstruction — legitimate recovery remains necessary

`stuck-obstacle-ab.webm`; obstacle rows in the CSV. Successes are counted out
of 8; the time is mean ms to engagement.

| obstacle | role | frozen | init | veto | **off (control)** |
|---|---|---|---|---|---|
| 90×90 block, 140px ahead | Rifleman | 8/8, 3650 | 8/8, 4250 | 8/8, 4250 | **0/8** |
|  | Gunner | 8/8, 3767 | 8/8, 4367 | 8/8, 4367 | **0/8** |
|  | Bulwark | 8/8, 5050 | 8/8, 5650 | 8/8, 5650 | **0/8** |
|  | Swarmling | 8/8, 3700 | 8/8, 4300 | 8/8, 4300 | **0/8** |
| 90×90 block, 450px ahead | Rifleman | 8/8, 3333 | 8/8, 4333 | 8/8, 4333 | **0/8** |
|  | Gunner | 8/8, 3550 | 8/8, 4533 | 8/8, 4533 | **0/8** |
|  | Bulwark | 8/8, 6433 | 8/8, 5850 | 8/8, 5850 | **0/8** |
|  | Swarmling | 8/8, 3383 | 8/8, 4500 | 8/8, 4500 | **0/8** |
| 240×40 wall, 140px ahead | Gunner | 6/8 | 3/8 | 7/8 | **0/8** |
|  | Bulwark | 8/8 | 4/8 | 5/8 | **0/8** |
|  | Bulwark screen | 8/8 | 2/8 | 3/8 | **0/8** |
| 240×40 wall, 450px ahead | Bulwark | 5/8 | 3/8 | 4/8 | **0/8** |

- **Recovery is necessary.** With it switched off, no role gets round a single
  console in 10s; every body stays pinned. Every legitimate arm landed on real
  contact (BLOCK, with contact in the window).
- **What a shared fix costs on early contact.** When cover is met INSIDE the
  first window (the fast roles reach the near block in 0.27-0.52s), the false
  first arm lands while the body is already pinned (8/8) and happens to be the
  right call. Without it, recovery waits for the second check: **+600ms, every
  role.** This is the Demolisher's accepted limitation B, generalised.
- **Dead-centre obstacles cut both ways.** When cover sits dead on the lane
  further out, the false sidestep has often already moved the body 90-200px
  off the line, so it misses the block: the counterfactual is ~1s slower for
  the Rifleman, Gunner and Swarmling and ~0.6s faster for the Bulwark. This is
  geometry luck in a staged lane, not a property of either build.
- **The recovery itself is weak against wide faces.** It is a random-direction
  600ms jink, re-rolled at every check, with no memory. Against a wall wider
  than one jink (Bulwark 92px, Gunner 125px), it is a random walk: a 420px
  wall defeats most roles in every variant, and with the false jink removed the
  slow Bulwark loses its accidental head start (240px wall: 8/8 → 4-5/8). That
  is a pre-existing limit of the legitimate recovery, and a reason any fix must
  be judged on real arenas, not on a lane.
- **Pinning is rarer than it looks.** A body only pins when it meets a face
  nearly head-on: Arcade separates on one axis, so a diagonal approach slides
  off a box corner by itself. The first obstacle video showed exactly that.
- **Real encounters.** Real-contact sidesteps taken by ordinary roles rise
  from 83 (frozen, 387 spawns) to 116 under the veto (421 spawns): +30% per
  spawn. The Swarmling dominates that rise, 4 → 40 (§3.6).

### 3.3 Moving player

Same lane, 8 seeds. The first check is taken in **8/8** for every role on
every path. Engagement delays exceed 600ms when the player moves, because the
sidestep is perpendicular to a bearing that is itself changing:

- **lateral sweep:** Rifleman 4075 vs 2867ms (+1.2s); VANGUARD screen 7692 vs
  6267 (+1.4s);
- **crossing behind:** Swarmling 3125 vs 1833 (+1.3s); screen 3742 vs 2317
  (+1.4s).

Hold → resume also shows up here: a circling player pulls a holding Bulwark
back into motion, giving 1238ms of sidestep per run frozen, 133 with the veto
and 0 with prog.

### 3.4 Movement v2 / v2.2 (Gunner + Rifleman) — reachable, not masked

`stuck-movement-v22-ab.webm`. v2's approach mode calls `_moveToward` and eases
toward the velocity it wrote, so the first-check sidestep is **taken 8/8 under
both `move=v2` and `move=v22`**:

| movement | role | lateral | engagement, frozen → cf |
|---|---|---|---|
| v2.2 | Gunner | 115px | 3683 → 3083ms |
| v2.2 | Rifleman | 166px | 3442 → 2825ms |

v2's pocket legs and retreat write velocity directly, so they **bypass** the
sidestep. But its **settles (320-600ms) and shot plants stand the body
still**, so it arms HOLD, and the next approach takes it. In C2 (8 seeds,
sidestep ms per run, frozen / veto / prog):

| movement | role | sidestep ms per run |
|---|---|---|
| default | Gunner | 165 / 165 / 165 |
| default | Rifleman | 600 / 62 / 62 |
| v2 | Gunner | 954 / 77 / 0 |
| v2 | Rifleman | 733 / 312 / 0 |
| v2.2 | Gunner | 429 / 202 / 0 |
| v2.2 | Rifleman | 844 / 208 / 0 |

**v2.2 makes the stuck sidestep MORE visible, not less.** v2.2 removed the
legacy pocket's per-frame re-aim and random flips, so the stuck sidesteps that
remain are a much larger share of what still looks abrupt. In CROSSFIRE (4
seeds), stuck sidesteps account for this share of sharp direction changes
(>60° in 100ms):

| role | default movement | `move=v22` |
|---|---|---|
| Rifleman | 12% | **43%** |
| Gunner | 9% | **35%** |

Planted firing is not disturbed: the plant writes velocity directly. Chosen
destinations are not changed either: `_pickDest` runs in settle, and the
sidestep only rides the approach. Movement v2.2 itself was not tuned.

### 3.5 Bulwark / VANGUARD — CONFIRMED / MEANINGFUL, and it touches an approved formation

**The opening front.** The real VANGUARD (hangar, sector 8, wave 2), player
standing and not firing, 4 seeds each:

| player position | frozen | veto / prog |
|---|---|---|
| room spawn (gates ~1300px away) | TIMEOUT 4/4 | TIMEOUT 4/4 |
| centre | TIMEOUT 4/4 | TIMEOUT 3 · ESTABLISHED 1 |
| north (1000, 450) | TIMEOUT 3 · ESTABLISHED 1, at 3133ms | same split, ESTABLISHED at 2667ms |
| **east, near the gates** | **TIMEOUT 4/4** — openers at release 138-157px / **222-575px**, 42-50° apart | **ESTABLISHED 4/4** — 138/194-197px, ~30° apart |

Both openers take the false first-check sidestep (1/1 in every frozen run).
The front's establish test needs both within 200px, and the 3000ms timeout
starts when the second opener materialises. `stuck-vanguard-live.webm` shows
it in the real encounter: front TIMEOUT at 4.5s frozen, ESTABLISHED at 3.8s in
the counterfactual. In that run, **one opener's false sidestep carried it into
a cargo crate**, where it then needed the real-contact recovery. A false
positive can manufacture a genuine obstruction. In the one geometry where the
front can form in time, the 600ms of lateral travel turns ESTABLISHED into
TIMEOUT every time. **The backline is then released against a half-formed
front, one shield close and one still far. That is exactly the failure §10av
was built to prevent.** The Captain's presence changes nothing here: he is
queued behind the front.

**The hold → resume class is the VANGUARD screen's main stuck movement.** The
screen holds at 140 and resumes past 165, so every resume after a ≥600ms hold
opens with a sidestep. Across the real VANGUARD encounters (frozen, 4 seeds),
screen Bulwarks took 30 first-check sidesteps and **42 hold → resume
sidesteps**.

For both Bulwark types, the share of all lateral motion and of all sharp turns
that comes from stuck sidesteps:

| Bulwark | lateral motion (frozen / veto / prog) | sharp turns, frozen |
|---|---|---|
| VANGUARD screen | 60% / 56% / 32% | 103 of 103 |
| free (MIXED, SNIPER NEST) | 86% / 79% / 24% | 82 of 88 |

The veto removes almost none of it; only the progress-aware variant does.

**Not changed:** the 140 / 165 values, the queue, the release conditions and
the shield economy are untouched and were only observed.

**Effect.** This is a real disruption of the tactical screen — a different
opening sentence in some geometries — not just a cosmetic jink. But **the human
approved VANGUARD on handset with this bug present** ("hard but fair"). Fixing
it changes an approved fight and would need a new handset verdict.

### 3.6 Marksman and Swarmling (measured separately)

**Marksman — CONFIRMED / MEANINGFUL for movement, MINOR for combat.**

- **Which class.** Spawned inside its band (300-640px), its first check arms
  with no movement and is never taken (H1). Spawned beyond it, the first check
  costs 600ms and 54-68px.
- **Hold → resume.** Its real cost is that every time the player moves out of
  its band, the approach starts with a sideways skate.
- **Share of its movement.** In real encounters stuck sidesteps are 82% of all
  its lateral motion and **125 of its 126 sharp turns** (veto 71%; prog 22%).
  The Marksman otherwise only moves in straight lines or stands, so the stuck
  check is effectively the only lateral motion it has.
- **Combat.** Aiming and shot preparation are not disturbed: `_aim` is
  rewritten to the player every tick and the charge continues while moving.
  SNIPER NEST shots are 60 frozen vs 58 veto — inside noise.

**Swarmling — CONFIRMED / MEANINGFUL.**

- **Size.** The biggest sidestep in the game: 205px at 1.1× its speed.
  +600ms to reach melee in a lane; 1.3s behind a crossing player.
- **Packs.** They spawn in packs of 4-6 on the same tick, so they hit the first
  check together. **85% of SWARM TIDE's first-check sidesteps happen in
  same-tick groups (23 groups, up to 6 bodies)**: the whole pack jinks sideways
  at 0.6s in independent random directions. MIXED: 64%.
- **Share of its movement.** Stuck sidesteps are 68% of all Swarmling lateral
  motion in the frozen encounters (veto 32%) and 46% of its sharp turns.
- **Interaction with the rush.** It interrupts the rush once per spawn. It does
  not change contact pressure: melee jitter writes velocity directly. It does
  change clustering — the false jink currently scatters packs, and **without it
  packs file straight into cover**: Swarmling real-contact sidesteps go 4 → 40
  across the encounters. A fix removes a false behaviour and exposes a weak true
  one (§3.2).

### 3.7 Nemesis

All five bases reach the shared path: grunt, shooter, shielded, sniper and
bomber. They use `legacyArt`, never `_loco`, and their base class's
`_tickSwarm`.

**First check:** armed and taken 8/8 for each, with lateral travel of 122,
101, 76, 54 and 158px respectively. **The nemesis Demolisher takes it**,
because the approved veto excludes `_miniBoss` — by design, and confirmed.

**Hold → resume:** shielded and sniper bases, 788 and 744ms per run; prog 0.

**Authored actions:** not interrupted. `_performing` returns before the block,
so the timer freezes during a move.

**Survivable contact bursts:** not interacted with. The burst is the bomber's
`_contactBurst`; the sidestep only rides the approach.

The nemesis is one actor per sector, arriving from the farthest gate. The cost
is a 600ms sideways entrance; downstream engagement can cascade (a staged
nemesis Demolisher reached the player 6s later in one scenario, because the
player had started moving away in the meantime). **CONFIRMED / MINOR.**

*Shock Captain (frozen, outside this brief, measured once for completeness):*
reachable through `_navigatePath`; first check taken 8/8 (166px); hold →
resume after brace / fire (32 of 46 armed taken in VANGUARD + Captain).

### 3.8 The "bouncing DVD logo" hypothesis — **partly confirmed, role by role**

The measure is the share of each role's lateral motion, and of its sharp
direction changes, that comes from stuck sidesteps. Real encounters, frozen
game:

| role | lateral motion from stuck sidesteps | sharp turns from stuck sidesteps |
|---|---|---|
| Bulwark (free) | 86% | 82 of 88 |
| VANGUARD screen | 60% | 103 of 103 |
| Marksman | 82% | 125 of 126 |
| Swarmling | 68% | 269 of 579 (46%) |
| Rifleman | 43% | 245 of 1305 (19%) |
| Gunner | 14% | 179 of 1994 (9%) |

- **Bulwark, Marksman, Swarmling — YES.** For the roles that otherwise move
  straight or stand still, the stuck check *is* the drifting: an unprompted
  sideways slide, always perpendicular to their goal, on every spawn and every
  resume.
- **Gunner and Rifleman on legacy movement — mostly NO.** There, the
  floating is dominated by the legacy pocket strafe: re-aimed every frame,
  flipped 50/50 every 0.84-1.56s, hard band edges. Movement v2.2 already
  replaced that, and under v2.2 the stuck sidestep becomes 35-43% of what
  still looks abrupt.

### 3.9 RNG implications

Lane, 4 seeds × 6 roles, A against each counterfactual.

- **Positions** part at **exactly 600ms** in every variant. That is the
  sidestep itself.
- **The random STREAM** behaves differently:
  - **veto / prog** keep it identical until downstream behaviour diverges: a
    shot from a different place, a strafe flip at a different time. That is
    1633-2800ms in.
  - **init** shifts it at exactly 600ms (one draw fewer), so every later random
    number in the run moves: fire cooldowns, strafe flips, the next sidestep's
    direction, particle draws.
  - For the Demolisher, init changes the stream and nothing else (positions
    never part).
- **Encounters** part from the frozen game at the very first first-check: 267ms
  in wave-1 rooms (the authored enemies spawned during boot), ~1.5s in
  VANGUARD. **Encounter-level outcomes therefore cannot be attributed to
  movement alone.** Kills, shots and wave length differ between variants for
  chaotic reasons, which is why this audit reports movement shares and staged
  A/Bs rather than "the fix makes fights X% longer".

## 4. Classification

| role | verdict | why |
|---|---|---|
| **Rifleman** | **CONFIRMED / MEANINGFUL** | 184px false jink, taken on 100 of 104 encounter spawns (default movement; 16 of 16 under v2.2); +0.6-1.2s to engage; 43% of its lateral motion; 43% of sharp turns under v2.2 |
| **Gunner** | **CONFIRMED / MEANINGFUL** | 126px, +600ms; taken on 69 of 79 encounter spawns (the rest were already strafing in their pocket; 23 of 33 under v2.2); 35% of sharp turns under v2.2 |
| **Bulwark** (free, screen, opener) | **CONFIRMED / MEANINGFUL** | both classes; 60-86% of lateral motion and ~all sharp turns; VANGUARD front ESTABLISHED → TIMEOUT 4/4 near the gates |
| **Marksman** | **CONFIRMED / MEANINGFUL** (movement) · minor (combat) | 82% of lateral motion, 125/126 sharp turns, mostly hold → resume; shots unaffected |
| **Swarmling** | **CONFIRMED / MEANINGFUL** | 205px, synchronized pack jinks (85% in SWARM TIDE); but removing it raises cover collisions 10× |
| **Nemesis** (all five bases, incl. the nemesis Demolisher) | **CONFIRMED / MINOR** | one actor per sector; a 600ms sideways entrance; moves and bursts untouched |
| **Demolisher** | **NOT AFFECTED** | the approved veto stands the first check down 8/8 lane, 18/18 encounter spawns; no hold class (it never stops) |
| Vader | **NOT AFFECTED** | `Boss.preUpdate` never runs the block |

No role is "REACHABLE / NOT OBSERVED": every ordinary role that executes the
path showed the false recovery in every seed.

## 5. Risks of a shared fix

1. **It changes four human-approved, frozen roles' movement**, plus VANGUARD's
   opening and the Swarmling's pack behaviour. The handset approved all of them
   with this bug present. Every one would need a new verdict.
2. **A first-check-only fix (init or veto) leaves the bigger half for the
   Bulwark and Marksman**: hold → resume, which the veto does not touch
   (VANGUARD screen lateral share 60% → 56%; Marksman 82% → 71%).
3. **Obstacle recovery gets measurably worse in places.**
   - Cover met inside the first 600ms: recovery +600ms for every role.
   - Real-contact sidesteps +30% per spawn in encounters.
   - Swarmling packs file into cover (4 → 40).
   - The slow Bulwark loses its accidental head start against walls (8/8 → 4-5/8).
   The legitimate recovery (a random-direction jink with no memory) is the
   weaker partner, and removing the false jink exposes it.
4. **`init` shifts the RNG stream** at every spawn. It is a different fight
   from 0.6s, with no movement benefit over the veto (the two produce identical
   engagement times).
5. **Seeded fixtures move.** The VANGUARD, BOMBER RUN, MIXED and CROSSFIRE
   replays in `smoke-bulwark`, `smoke-demolisher`, `smoke-roster-2b` and the
   encounter suites would all need re-baselining, and `tests/enemy-frozen.mjs`
   would have to be re-narrowed for any change outside `EnemyBomber`.

## 6. Recommendation (not implemented)

Strategy by strategy:

- **No change** is defensible only on "the human approved these fights as they
  play". The evidence says the defect is real, systematic and dominant for
  three roles.
- **Shared initialization** (init) is the smallest code change and the worst
  option: it changes the RNG stream at every spawn, fixes only the first
  check, and inherits every obstacle cost.
- **Delayed first check** (skip the first test) is equivalent to init in
  movement and RNG.
- **Demolisher-style veto, generalised** fixes the first check with the random
  stream kept, but leaves hold → resume — the larger problem for the Bulwark
  and Marksman.
- **Progress-aware check** (prog: an arm stands down when the AI itself held
  still) is the only variant that removes both false classes (lateral share:
  Bulwark 86 → 24%, screen 60 → 32%, Marksman 82 → 22%), keeps the draw, and
  leaves every BLOCK arm intact. It shares the veto's obstacle costs.

**Recommended scope, if the human chooses to correct: SELECTED ROLES, staged,
each behind its own handset gate.** Not a global base-class change.

1. **Bulwark and Marksman first** — progress-aware (both classes), role-scoped
   on the Demolisher pattern so nothing else moves. These are the two where the
   false movement IS their movement, and the VANGUARD front is the strongest
   gameplay finding. It needs a VANGUARD handset re-verdict, because the
   opening will establish where it used to time out.
2. **Gunner / Rifleman only together with a movement-default decision.**
   Under v2.2 the stuck sidestep is 35-43% of what still looks abrupt; on
   legacy it is a minority of the floating. Decide it alongside "does
   `?move=v22` become the default", not alone.
3. **Swarmling last, and only with a better legitimate recovery.** Removing the
   false jink makes packs collide with cover ten times as often, so the
   Swarmling fix is really a recovery fix.
4. **Nemesis: leave.** One actor, minor.

## 7. Limitations and remaining uncertainty

- **Staged lanes are geometry.** Obstacle outcomes depend on where the cover
  sits relative to the lane; dead-centre blocks favour whichever variant
  happened to drift. Only the encounter rows speak for real arenas, and only
  four seeds × 30s each.
- **Encounters diverge at the first check**, so encounter-level kills, shots
  and wave lengths are not attributable. Shares and staged A/Bs are.
- **The scripted player is not a human.** It moves on fixed keyboard segments,
  fires on a cadence and is immortal. The VANGUARD front result depends on
  where the player stands when the openers walk in. The "east" geometry is one
  real possibility, not a measure of how often players stand there.
- **The HOLD classifier** uses the AI's commanded speed (< 25% of its own speed
  on half the window). A slow legitimate approach into contact would read as
  HOLD — none was observed (4727 HOLD arms across the staged runs, zero with
  any contact in their window), but the threshold is a choice.
- **"Sharp turn"** (>60° in 100ms, moving) and "lateral share" (displacement
  perpendicular to the bearing to the player) are this audit's instruments.
  They rank roles and variants reliably; they are not perception measures.
  Whether a player SEES "bouncing" is a handset question.
- **Not measured:** the Interdictor / Harrower (rejected, debug-only) and the
  stealth FSM states (dormant: every enemy is swarm).
- **`?gait=v2` and `?roster=v1` are presentation only** and cannot change any
  of this. All runs used the default (legacy) presentation.

## 8. Reproduce

```bash
npm run dev                                   # :5173
node tests/smoke-stuck-audit.mjs              # 38 checks — the instrument sees the real game
node tests/diag-stuck-audit.mjs --only=lane,obstacle,player,away,move,nemesis,rng --tag=staged   # ~10 min
node tests/diag-stuck-audit.mjs --only=encounter,vanguard --tag=encounter                        # ~30 min
node tests/diag-stuck-audit.mjs --only=vfront --tag=vfront                                       # ~25 min
node tests/diag-stuck-audit.mjs --merge       # -> stuck-role-metrics.csv
node tests/shot-stuck-audit.mjs proof lane obstacle v22 vanguard
```
