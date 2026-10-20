# Engagement call-path matrix — Marksman, Bulwark, and the v2.2 control

Phase 3C-B, diagnosis only. Source of truth: `7f017a4` (HEAD = FRIX at the
start of this pass). Line numbers are that tree. No gameplay file was changed
by this pass.

Every ordinary Endless enemy is spawned with `spec.behavior = 'swarm'`
(`GameScene.spawnEnemyAt`, `GameScene.js:2016`). The stealth state machine
(PATROL / SUSPICIOUS / CHASE / COVER_MOVE / FLANK …) never runs for them, and
neither does the cover code inside it: `_computeStandPos` (`Enemy.js:360`) and
every `_navigatePath` caller at `Enemy.js:552-1329` are state-machine paths.
What runs each frame is:

```
Enemy.preUpdate                       Enemy.js:882-912    stuck check (600ms window, <12px → 600ms sidestep)
└ EnemyShooter.preUpdate              Enemy.js:1002
  └ spec.behavior === 'swarm'         Enemy.js:1033
    └ this._tickSwarm(delta, player)  Enemy.js:1034  ── overridden per role:
        Marksman  EnemySniper._tickSwarm     Enemy.js:2069
        Bulwark   EnemyShielded._tickSwarm   Enemy.js:1981
        Gunner / Rifleman (control)
                  EnemyShooter._tickSwarm    Enemy.js:1356 → _tickSwarmLegs (Enemy.js:1410) under ?move=v2/v22
```

The two stuck-recovery candidates are per-instance SHADOWS of `_tickSwarm` /
`_moveToward`, installed from `spawnEnemyAt` (`GameScene.js:2051`
`installBulwarkStuck`, `:2055` `installMarksmanStuck`). They review the base
stuck check and nothing else; neither touches the role's tactical decision.

## The decision each role makes, every tick

### Marksman — `EnemySniper._tickSwarm` (`Enemy.js:2069-2111`)

```
dist < retreatRange (300)          → setVelocity(straight away from the player)       no wall test
dist > desiredRange + 80 (640)     → _moveToward(player, 0.7 × speed)                 straight line
otherwise (300..640)               → setVelocity(0, 0)                                 HOLD
hasLOS = canSee(player) && _hasLOS(this → player)
charging:      LOS lost → cancel, fireCd = 500;  else track → lock (last 260ms) → fire at 0
not charging:  fireCd -= delta (ALWAYS — it counts down blind)
               fireCd <= 0 && hasLOS → start the 800ms charge
```

The HOLD branch reads only the distance. It is entered and left on distance
alone and does nothing with `hasLOS` except gate the charge. So in the band,
with the line cut, the Marksman's cooldown expires, it is READY, and it waits
— indefinitely: the only things that end the wait are the player moving or a
stuck sidestep, and a standing body in HOLD never arms one (it commands no
movement, the base check is fed by `_moveToward`).

### Bulwark — `EnemyShielded._tickSwarm` (`Enemy.js:1981-2025`)

```
shield turns toward the player at 2.6 rad/s
SCREEN (VANGUARD, spec.vanguardScreen):
    hold when dist <= 140, resume when dist > 165, lane offset until first hold
FREE:
    dist > desiredRange + 30 (290)  → _moveToward(player)          straight line
    otherwise                       → setVelocity(0, 0)             HOLD
_aim = _shieldFacing
_maybeFireAt(delta, player)
```

`EnemyShooter._maybeFireAt` (`Enemy.js:1664-1703`) returns on its FIRST line
unless `canSee(player) && _hasLOS(...)`, BEFORE `fireCd -= delta`. So a blind
Bulwark's cooldown does not run at all: when the line reopens it still owes
the remainder (up to 1.8s, `fireCooldownMs` 1500 × 1.2) before the 300ms WARN
and the shot. A Bulwark whose line flickers fires very little even while it
is "in range".

### Control — Gunner / Rifleman under `?move=v22` (`_tickSwarmLegs`, `Enemy.js:1410-1530`)

Approach → band legs → settle. The approved v2.2 movement already does the two
things the subjects do not:

* **it chooses where to stand by asking whether a shot exists from there**:
  `_scoreSpot` (`Enemy.js:1578`) gives a spot +4 for a clear line to the
  player and +0.75 for each of the ±40px lateral lines, penalises taken and
  crowded spots, and `_pickDest` (`:1611`) picks among ~11 candidates along
  the band;
* **it does not stand blind**: "a body that cannot see the player does not
  stand there waiting" — the settle beat is cut to 120-180ms when there is no
  line (`Enemy.js:1474`), after which `_pickDest` moves it.

Both subjects INHERIT `_standable`, `_scoreSpot`, `_pickDest` and `_crowded`
from `EnemyShooter` and call none of them, because both override `_tickSwarm`.

## Matrix

| question | Marksman | Bulwark (free) | Bulwark (VANGUARD screen) | Gunner / Rifleman v2.2 (control) |
|---|---|---|---|---|
| where to stand is decided from | distance (300 / 640) | distance (290) | distance (140 / 165) | distance band + spot score |
| reads LOS when choosing a position | **no** | **no** | **no** | yes (`_scoreSpot`) |
| reacts to a persistent LOS loss | **no** | **no** | **no** | yes (120-180ms settle, then a new leg) |
| calls `_navigatePath` / NavGrid | **no** | **no** | **no** | no |
| approach | `_moveToward(player)`, straight | `_moveToward(player)`, straight | `_moveToward(player or lane point)` | `_moveToward(lane point / chosen spot)` |
| retreat | `setVelocity` straight away, no wall test | none | none | `setVelocity` straight away (< 160) |
| fire gate | `canSee && _hasLOS` to START a charge | `canSee && _hasLOS` | same | same |
| cooldown while blind | **counts down** (ready and waiting) | **frozen** (owes it on reacquire) | frozen | frozen |
| LOS lost mid-attack | charge cancelled, `fireCd = 500` | n/a (the shot is instant) | n/a | n/a |
| stuck recovery | base 600ms sidestep; `?marksmanStuck=early` reviews it | base; `?bulwarkStuck=early` reviews it | same | base |
| vision cap | 720 (ALERT, 360°) — inside the 640-720 approach band it can still charge | 720 | 720 | 720 |

## How the obstacles are represented (`detention-obstacle-map.png`)

Read from the LIVE room (`tests/diag-tactical-engagement.mjs --only=geo`
writes `detention-geometry.json`; `tests/shot-tactical-map.mjs` draws the map),
not from `rooms.js` — cover is snapped to nav-cell centres at load, so the
authored `(400, 300)` is the body at `(440, 280)`.

| # | object | body (physics = LOS = bullets) | rendered sprite | visual-only margin | NavGrid cells | concealment |
|---|---|---|---|---|---|---|
| 0-5 | six benches / pedestal consoles, rows y 280 and 1080 at x 440 / 840 / 1240 | 70×70 | 112×112 | 21px every side | 1 each | bush r 55, **unreachable** |
| 6 | `dt-con-lock` (600, 680) | 70×70 | 112×112 | 21px | 1 | bush r 55, **unreachable** |
| 7 | `ch-con-heavy` (1000, 680) | 70×70 | 112×112 | 21px | 1 | bush r 55, **unreachable** |
| 8 | `prop-post` (260, 1175) | 200×110 | 256×280 | **170px top**, 28px sides | 6 | — |
| 9, 10 | `prop-bunk` (700, 450) + `prop-bunk-b` (780, 515) | 120×60 each, **5px apart** — one obstacle | 136×104 | 44px top, 8px sides | 2 + 2 | — |
| 11 | `prop-bunk-b` (1290, 850) | 120×60 | 136×104 | 44px top | 2 | — |
| 12 | `prop-bunk` (420, 930) | 120×60 | 136×104 | 44px top | 2 | — |

What agrees, what does not:

* **Physics, LOS and bullets are ONE representation.** `scene.losRects` is
  built from the `walls` bodies at load (`GameScene.js:780`), `_hasLOS` tests
  a line against those rects, and `handleBulletWallHits` (`GameScene.js:4947`)
  tests a bullet's centre against the same body. An enemy that "can see" can
  hit, and vice versa. No disagreement here.
* **The sprite is not the body.** Consoles draw 21px of visual-only frame on
  every side; the bunks' upper 44px and the post's upper **170px** of
  machinery are walk-through and see-through. A player who reads the picture
  as cover is visible in those margins, and an enemy standing "behind" the
  post's visible machinery has a line.
* **Concealment is dead.** Every cover console is registered as a bush of
  radius 55 (`GameScene.js:657` `bushSystem.add(con, 55)`), which hides an actor
  whose centre is within `55 − 22·0.3 = 48.4px`. A colliding player's centre
  cannot get closer than 56.5px (`shot-tactical-map.mjs` concealment probe:
  every console, 16 bearings, `hiddenInBush` never set). So `canSee`'s bush
  branch never fires near cover in real play; **only LOS blinds an enemy**.
  (An evidence rig that TELEPORTS the player into a console can trigger it —
  none of the measured cases do.)
* **NavGrid is a cell-quantised superset** (cell centre inside the body
  inflated by 23px, `NavGrid.build`): 1 cell per console, 2 per bunk, 6 for the
  post, 22 of 360 in all. It agrees with physics on the only sub-body gap in
  the room — bench 3 ↔ post is 45px, closed to every role (Ø44 Marksman, Ø48
  Bulwark), and the grid has no route through it. The two bunks at
  (700, 450) / (780, 515) stand 5px apart and are one obstacle to everything.
  **Every other pair of bodies is ≥ 85px apart; the room is open and every
  point is reachable.**
* **Nothing the subjects do reads NavGrid at all.** Its representation is
  irrelevant to the failure: they walk straight lines.

## Bad destination vs. unreachable route

These are separate failure modes and the data separates them:

* **Unreachable route**: in 33,160 NavGrid reachability samples from the
  subjects to the player across every encounter run (one per actor every
  0.5s), the player was unreachable **zero** times
  (`tactical-engagement-root-causes.md` §D). Physically blocked movement is a
  small share of life — pressing a wall 4-7%, moving without progress 1-3% —
  and the Gunner / Rifleman controls press walls as often (6-8%).
* **Bad destination**: the HOLD itself. The body arrives exactly where its rule
  says to stand — and the rule never asks whether it can shoot from there.
