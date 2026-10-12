# Shared stuck check — call-path matrix (Phase 3A audit)

Read out of the code at `04cd882` (the Phase 2D closure). Nothing under `src/`
was changed by this audit; `tests/smoke-stuck-audit.mjs` §0 checks
`git diff 04cd882 -- src/` is empty and that the narrowed `Enemy.js` guard
still holds.

## 1. The block

`src/entities/Enemy.js:882-913`, inside `Enemy.preUpdate` — byte-identical to
`3ce5680` (`tests/enemy-frozen.mjs`):

```js
const _inMoveState = (
  this.spec?.behavior === 'swarm' ||
  this.state === ST.CHASE || ... || this.state === ST.SEARCH
);
if (_inMoveState) {
  this._stuckSidestepMs = (this._stuckSidestepMs || 0) - delta;
  this._stuckTimer      = (this._stuckTimer || 0) + delta;
  if (this._stuckTimer >= 600) {
    const moved = Math.hypot(this.x - (this._stuckRefX ?? this.x),
                             this.y - (this._stuckRefY ?? this.y));
    if (moved < 12) {
      this._stuckSidestepMs = 600;
      this._stuckSideDir   = Math.random() < 0.5 ? 1 : -1;
    }
    this._stuckTimer = 0; this._stuckRefX = this.x; this._stuckRefY = this.y;
  }
} else { /* reset all four */ }
```

Its only consumer is `Enemy._moveToward` (`Enemy.js:435-448`):

```js
if (this._stuckSidestepMs > 0) {
  const perp = Math.atan2(dy, dx) + (this._stuckSideDir || 1) * Math.PI / 2;
  this.setVelocity(Math.cos(perp) * speed * 1.1, Math.sin(perp) * speed * 1.1);
  return dist;                       // _aim is NOT updated on this branch
}
```

`_navigatePath` (`Enemy.js:450`) also reads it, forcing a repath every 300ms
while it is armed, and then calls `_moveToward`.

## 2. The lifecycle, point by point

| # | question | answer, from the code |
|---|---|---|
| 1 | **Initialization** | `_stuckRefX/Y`, `_stuckTimer`, `_stuckSidestepMs`, `_stuckSideDir` are set in **no constructor**: `Enemy`, `EnemyShooter`, `EnemyGrunt`, `EnemyShielded`, `EnemySniper`, `EnemySwarmling`, `ShockCaptain`. All start `undefined`. Only `EnemyBomber` keeps a spawn point (`_stuckOriginX/Y`, the Phase 2D veto). |
| 2 | **First check timing** | `_stuckTimer` accumulates from the first `preUpdate` in which the body is alive and not `_performing`. At a 60Hz step the check runs on the **36th tick (600.0ms)**; it is clock-driven, so a slower frame rate runs it on fewer, longer ticks at the same game time. |
| 3 | **Displacement** | `hypot(x − (ref ?? x))`. With the reference undefined, `??` substitutes the **current** position, so the first check measures **0px every time, whatever the body did**. Every later check measures the true 600ms window from the previous check. Positions are read in `preUpdate`, i.e. after the previous physics step. |
| 4 | **Trigger** | `moved < 12` arms. The movement-state gate never filters anything: `GameScene.spawnEnemyAt` stamps `spec.behavior = 'swarm'` on **every** enemy (`GameScene.js:2014`), and `spawnChampion` does the same (`:6208`). So the test runs every frame for every body, and it **cannot tell "blocked" from "deliberately standing still"**. A body that holds for 600ms is re-armed on every check for as long as it holds — armed ~100% of the hold. |
| 5 | **Direction** | One `Math.random()` draw from the shared gameplay stream per arm (`±1`). The perpendicular is recomputed every tick from the **current** bearing to whatever `_moveToward` was asked to reach. Far from the target that is a straight lateral line; close to the player it bends round them. |
| 6 | **Duration** | 600ms, decremented every frame in the block, consumed or not. Speed is 1.1× the speed `_moveToward` was called with. One taken sidestep is 36 ticks: 68px (Marksman, 0.7×) to 205px (Swarmling). |
| 7 | **Cancellation** | None. The arm ends by decrement, or is re-armed by a later failing check. Nothing clears it on reaching range, on an AI mode change, on stagger, or on a scripted move. The single exception is the approved `EnemyBomber._vetoFalseStuck`: ordinary Demolisher only, first check only, nemesis excluded. |
| 8 | **Velocity / steering / navigation** | Only a tick that calls `_moveToward` (directly, via `_navigatePath`, or inside v2's approach) takes the sidestep. A tick that writes velocity itself — pocket strafe, retreat, hold, v2 legs — **bypasses** it, and an arm that expires unread costs only its random draw. While it is taken, `_aim` is not refreshed by `_moveToward`. |
| 9 | **Movement v2 / v2.2** | `_tickSwarmLegs` approach mode calls `_moveToward` (`Enemy.js:1456`) and uses the velocity it wrote as the eased TARGET, so the sidestep is **fully reachable** on approach. Pocket and retreat write velocity directly (bypass). v2's settles (320-600ms) and shot plants stand the body still, so the check arms (HOLD); it is taken if the next mode is approach. |
| 10 | **Spawn / stagger / death / rooms / moves** | **Spawn:** no reference, so the first check is false by construction. **Stagger:** the block keeps running (`EnemyShooter.preUpdate:1006` suspends only the AI), and the knockback slide usually clears 12px. **Death:** `preUpdate` returns before the block. **Room change:** enemies are destroyed and new ones start undefined. **Scripted moves (nemesis, Champion):** `_performing` returns before the block, so the timer **freezes, it does not reset** — after the move the old reference and partial timer resume. |

## 3. Role by role — code sharing vs execution

"Reachable" means the code path executes; "taken" means `_moveToward` actually
drove the body sideways. The measured columns come from the clear-lane case
(8 seeds, each body spawned 900px from a standing player, frozen game); see
`stuck-role-metrics.csv`, `scenario=lane`.

| role (class) | its tick | calls `_moveToward` when | first check | measured (lane, 8 seeds) | hold → resume | verdict |
|---|---|---|---|---|---|---|
| **Rifleman** (`grunt`, `EnemyGrunt` → `EnemyShooter._tickSwarm`, rusher) | legacy `_tickSwarm`; `?move=v2/v22` `_tickSwarmLegs` | dist > 150 (legacy) / approach mode (v2) | REACHABLE, taken whenever still approaching at 0.6s (spawned beyond ~320px) | armed 8/8 · taken 8/8 · 184px · engage +600ms | legacy: no (orbit strafe never holds) · v2/v22: yes (settles, plants) | **CONFIRMED** |
| **Gunner** (`shooter`) | same | dist > 340 / approach | REACHABLE, taken when spawned beyond ~455px | 8/8 · 8/8 · 126px · +600ms | legacy: rare · v2/v22: yes | **CONFIRMED** |
| **Bulwark** (`shielded`, free) | own `_tickSwarm` | dist > 290; else `setVelocity(0,0)` (hold) | REACHABLE | 8/8 · 8/8 · 94px · +600ms | **YES — every resume after a ≥600ms hold starts with a sidestep** | **CONFIRMED** |
| **Bulwark — VANGUARD screen / opener** (`spec.vanguardScreen`, `vanguardLane`) | same, screen branch | not holding (hold ≤140, resume >165); opener aims at a lane point | REACHABLE | 8/8 · 8/8 · 94px · front: see notes | **YES** (140 → 165 resume) | **CONFIRMED** |
| **Marksman** (`sniper`) | own `_tickSwarm` | dist > 640 (at 0.7× speed); hold 300-640; retreat < 300 (direct) | REACHABLE when spawned beyond ~700px; inside its band it arms with no movement and is not taken (H1) | 8/8 · 8/8 · 68px · +600ms | **YES** | **CONFIRMED** |
| **Swarmling** (`EnemySwarmling`) | own `_tickSwarm` | dist > 40 (always, until melee) | REACHABLE, always taken (spawned in packs of 4-6 on one tick) | 8/8 · 8/8 · 205px · +600ms | no (melee jitter moves) | **CONFIRMED** |
| **Demolisher** (`bomber`) — reference | own `_tickSwarm`, `_vetoFalseStuck` first | always until contact | armed by the base, **stood down** before `_moveToward` reads it | armed 8/8 · taken 0/8 | no | **NOT AFFECTED** (corrected, Phase 2D) |
| **Nemesis** (5 bases, `legacyArt`, never `_loco`) | its base class's tick + `_tickNemesisMoves` (`_performing`) | as its base | REACHABLE for all five; the **nemesis Demolisher too** (the veto excludes `_miniBoss`) | each base armed 8/8 · taken 8/8 (54-158px) | shielded and sniper bases: yes | **CONFIRMED** |
| **Shock Captain** (frozen Champion, outside this brief) | own `preUpdate` → `super.preUpdate` (Enemy), MOVING states → `_navigatePath` | moving states (ADVANCE / GIVE GROUND / STRAFE) | REACHABLE | armed 8/8 · taken 8/8 · 166px | yes (brace / fire / recover stand still) | reachable, measured for completeness only |
| **Vader** (`Boss`) | `Boss.preUpdate` calls `Arcade.Sprite.prototype.preUpdate` directly (`Boss.js:444`) | — | **never runs** | — | — | **NOT AFFECTED** |
| Interdictor / Harrower (rejected, `?champdbg` only) | `super.preUpdate` (Enemy) + `_navigatePath` | — | reachable | not measured (not in production) | — | out of scope |

## 4. The two false-positive classes

1. **F1 — the first check.** The reference is undefined, so the first check
   always reads 0px. It arms for every body; it MOVES every body that is still
   inside `_moveToward` 0.6s after spawning. In six real encounters (frozen
   game, default movement, 4 seeds × 30s each) the ordinary roles spawned 387
   bodies: 381 first checks armed as F1 and **371 were taken**. Most of the 10
   not taken were Gunners already strafing in their pocket.
2. **HOLD → RESUME — the check cannot see intent.** `_inMoveState` is always
   true, so a body that stands still on purpose (Bulwark hold, VANGUARD 140px
   hold, Marksman band, v2 settle / plant, Captain brace) is armed on every
   check; the moment the AI walks again, the first tick of `_moveToward` is a
   sidestep (on average about half the 600ms window remains). The Demolisher
   veto does NOT cover this class — it only re-measures the first check.

Everything else that arms is either genuine contact (**BLOCK**: wall or arena
bounds in the window — the recovery doing its job) or **OTHER** (commanded
movement, no contact, net < 12px: a strafe reversal or a tight orbit), which is
rare.

**Of every stuck sidestep actually TAKEN by an ordinary role in those six
encounters — 623 — 540 (87%) were false (371 F1, 166 hold → resume, 3 other)
and 83 (13%) followed real contact.**
