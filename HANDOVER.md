# Frix — project handover

Orientation for a session starting cold. Read `CLAUDE.md` first for the rules
that must not be broken; this file is the map.

Last verified against `3dcf45f` (2026-07-29). Everything below was read out of
the code at that commit, not remembered.

---

## 1. What this is

**Frix** — a mobile-first, portrait, top-down twin-stick **wave-survival**
shooter. Brawl Stars-style controls, Star Wars / Death Star skin. Phaser 3.90 +
Vite, vanilla JS ES modules, no TypeScript, no framework.

- **Repo:** `Xletof/crix` — GitHub MCP tools are restricted to it
- **Live:** https://xletof.github.io/crix/
- **Dev branch:** `claude/mobile-run-game-design-OZLYF`
- **Deploy branch:** `FRIX` — Pages builds **only** from this (see §8)
- **Logical resolution:** 720×1280 portrait, `Phaser.Scale.FIT`
- **Arena:** 1600×1600 world, camera follows the player with aim-lookahead

Every sprite and every sound is generated **procedurally at runtime**. There are
no image or audio assets — pixel art is painted into textures in
`src/systems/pixelArt.js`, audio is synthesised through Web Audio in
`src/systems/FX.js`. The only binary assets in the repo are three webfonts.

> **The game has changed shape twice.** It began as a stealth-infiltration game
> (patrol routes, vision cones, backstab takedowns), became a horde-survival
> game, and is now **wave-clear arena**. Old code from earlier shapes is still
> in the tree and dormant — see §9. If something in the code looks like it
> belongs to a different game, it probably does.

---

## 2. Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/
npm run smoke      # headless test suite (needs `npm run dev` running)
```

`npm run build` must pass clean before every commit.

---

## 3. Layout

```
src/
  main.js          Phaser config + scene registry
  config.js        EVERY gameplay tunable (single source of truth)
  data/
    rooms.js       4 arena layouts (walls, cover, gates, terminals)
    upgrades.js    8 between-wave upgrade cards
    narrative.js   Intro / interstitial text
  entities/
    Player.js      Movement, aim, fire, dash, super, melee combo, HP/shield
    Enemy.js       Base + 6 archetypes, swarm AI, dormant stealth FSM
    Boss.js        Vader — 3 phases, charge / fan / spawn
    Bullet.js      Pooled BulletGroup: fire() / kill(), _gen identity token
    Grenade.js     Cluster canister — climbs, airbursts
    Terminal.js    Hackable objective
    WeaponPickup.js
    Ally.js        DEAD CODE — imported nowhere (see §9)
  scenes/
    BootScene / PreloadScene / TitleScene / IntroScene
    GameScene.js   The arena loop. 3.6k lines — by far the biggest file
    GameOverScene / PauseScene / UpgradeScene / DebugScene / ControlsScene
  systems/
    HUD.js         Exports HUDScene — a PARALLEL scene, not a scene-file
    FX.js          Particles, screen shake, and ALL audio synthesis
    pixelArt.js    Every sprite texture, painted procedurally
    Joystick / DashButton / MeleeButton / SuperButton   touch controls
    NavGrid / CoverRegistry / BushSystem / RoomManager
    HackMinigame.js
    controlLayout.js  Touch-control positions/scales + localStorage
    debug.js       Module-scope debug flags (god mode)
tests/             Headless Playwright smoke suite — see tests/README.md
```

### Scene model

`GameScene` ("Game") owns the world and Arcade Physics. `HUDScene` ("HUD") is
launched **in parallel** from it and owns the fixed UI camera and touch
controls. They communicate over `GameScene.events`. `HUDScene` lives in
`src/systems/HUD.js`, not in `src/scenes/` — easy to miss.

### The one non-obvious architectural rule

**Body sprites never rotate.** No `setRotation()` on a Player or Enemy body.
Each entity carries a separate `weaponSprite` that orbits it, positioned and
rotated to `_aim` every frame in `preUpdate`. `_aim` is a plain float in
radians. This is how Brawl Stars and Hotline Miami do it; rotating the body
produces the "upside-down sprite" bug. Every weapon overlay texture is painted
**EAST-facing** (barrel along +X) so `setRotation(angle)` orients naturally.

---

## 4. The game loop as it exists now

Four rooms, each a sequence of **waves**. A wave spawns a budget of enemies; the
player must clear them all to advance. Between waves: a breather, a reward, and
an upgrade choice. Room 4 ends with Vader.

- **Spawning** — `ARENA` in `config.js`, per room. Room-level fields are
  per-wave *defaults*; each entry in `waves[]` overrides any of them. Enemies
  emerge at `gates[]` (rooms.js) at least 400px from the player, after a 600ms
  red-ring telegraph.
- **Mix fields** (`shooterMix`, `bomberMix`, `shieldedMix`, `sniperMix`,
  `swarmlingMix`) are **cumulative probabilities**; the remainder is grunts.
- **Modifiers** — `MODIFIERS` in config: `frenzy` (corridor), `darkness`
  (detention), `eliteGuard` (vader).
- **Terminals** are optional risk/reward: hacking grants a support drop but
  triggers an immediate surge.
- **Records** persist in `localStorage` under `crix.stats`.

### Rooms

| # | id | name | modifier | waves |
|---|---|---|---|---|
| 1 | `hangar` | HANGAR BAY | — | 3 |
| 2 | `corridor` | REACTOR JUNCTION | frenzy | 3 |
| 3 | `detention` | DETENTION BLOCK | darkness | 4 (miniBoss on last) |
| 4 | `vader` | VADER'S CHAMBER | eliteGuard | 2, then Vader |

### Enemies

| Type | HP | Speed | Identity |
|---|---|---|---|
| `grunt` | 320 | 230 | Baseline. The damage yardstick — "one shot nearly kills a grunt" means ~290 |
| `shooter` | 450 | 190 | Holds 380px, fires faster |
| `bomber` | 200 | 300 | Suicide charger, 155px blast for 240 |
| `shielded` | 560 | 140 | ~154° frontal shield, turns at 2.6 rad/s — slow enough that a dash beats it |
| `sniper` | 260 | 150 | Glass cannon. 800ms windup, 260ms locked beam, 220 damage |
| `swarmling` | 60 | 310 | Melee, spawns in packs of 4–6. One primary bolt kills |
| Vader | 12000 | 165 | 3 phases at 100/66/33% |

### Player

HP 1000, speed 380, 2 dash charges (950px/s, 240ms, i-frames).
Primary: 1 bolt, 120 damage, 3 rounds then a 520ms reload.

Three independent meters:
- **Super** (`superHitsToCharge: 4`) — 5-pellet rocket barrage, 600 each.
- **Melee** (`meleeHitsToCharge: 3`) — "Broken Wings", a 3-cast lunging combo.
  The meter is spent on the **first cast only**; casts 2 and 3 are free inside
  `meleeComboWindowMs` (2000ms), so the chain is one ability. The finisher is a
  radial ground slam: 210px radius, 900 knockback, 600ms stun.
- **Dash** — 2 charges, 2800ms recharge.

Secondary weapons (`WEAPONS`, picked up in rooms): `rifle` (3-round burst) and
`cluster` (the pod, §5). There is no `flamethrower` or `detonator` any more —
older docs claim otherwise.

---

## 5. The cluster pod

Worth its own section: it is the most intricate system in the game and the most
recently reworked.

Throw → the canister **climbs** for `riseMs` and airbursts at `burstHeight`
(it never comes back down) → 8 munitions **pop** upward and fan out → each locks
a **distinct** target → they fly a **powered attack run** onto it → detonate.

- **Distinct targets** are assigned at burst time in `clusterSplit`, round-robin
  across living enemies within `fragSearchRadius`. This is the only place that
  can coordinate it — `findNearestEnemy` has no notion of "already claimed",
  which is why every munition used to pile onto the same enemy.
- **The flight is integrated per frame**, not tweened, in `_clusterDive`. The two
  axes are solved by different means and that split *is* the design:
  - **Horizontal** — momentum-limited flight. It leaves the apex carrying the
    pop's outward velocity and the motor cannot turn that instantly, so a
    munition thrown away from its target must bank round. That is the arc.
  - **Vertical** — solved from the horizontal **closing rate**, so altitude and
    range run out together whatever path the horizontal takes. While banking
    outward nothing is closing, so it holds height and spends that time turning.
- **Convergence is guaranteed, not tuned.** The turn rate is floored at the rate
  needed to circle the target at the current range, so the munition always curves
  inside its own approach instead of sling-shotting past.
- **Steering stops inside 40px.** It is committed and dropping. Because rotation
  follows velocity, the close-range turn term would otherwise whip the nose
  through ~3.6 turns per flight on impact.
- The physics body is **never enabled**. Impact is an explicit radius test in
  `_clusterImpact`, which is also what frees the sprite to be scaled freely
  (see the hitbox trap in `CLAUDE.md`).

Three flight models were tried and failed before this one; the reasons are
recorded in comments in `_clusterDive` so they are not retried. If you are about
to "simplify" that method by aiming one 3D vector at the target, read them first.

Damage: 8 × 290 = 2320 per charge, 3 charges. That is a large number —
deliberately, but worth watching against a full arena.

---

## 6. Draw order — the recurring bug

**The game has two depth conventions running at once.** Mixing them up has
caused several bugs.

1. **Y-sorted ground layer.** Actors write `setDepth(this.y)` every frame; walls
   and cover sort by their bottom edge at `y + 56`. In a 1600px arena that band
   spans roughly **150–1656**.
2. **Flat constants** used by nearly everything else: bullets 26, grenade 22,
   particles 0. These sit permanently *underneath* the entire Y-sorted layer.

`DEPTH.AIR` (2000, in config.js) is the band for things genuinely flying **over**
the room. Anything in it must add its **ground y** — where its shadow is — never
its rendered y, or draw order drifts as it changes altitude.

> **Known outstanding issue.** Ordinary bullets and the shared particle emitters
> are still on the flat constants, so primary bolts pass *behind* consoles and
> sparks render *under* actors. Same root cause as the cluster bug that was
> fixed. It is a game-wide visual change and has been left as the user's call.

---

## 7. Audio

All synthesis, no files. `FX.js` exposes helpers — `tone()`, `noise()`, `sub()`,
`punch()`, `stack()`, `shaper()` — feeding two buses under the user's volume:

- **`sfxBus`** — default for everything, duckable via `duckSfx()`.
- **`meleeBus`** — Riven melee **only**, ~+6dB and exempt from ducking.
  Deliberately reserved; **do not route new sounds to it**. It also has no echo
  send, because a ringing tail was designed out of the melee.

A master compressor (threshold −10dB, ratio 12:1) glues the mix and pumps hard
when many sources overlap — which is why the cluster's gains were trimmed when
the fragment count went 5 → 8.

**Three things this codebase has learned the hard way:**

1. **"Retro/pixel" here means a falling square wave with per-call `vary`**, not
   bit-crushing. There is no bit-crusher (`shaper()` is a soft tanh clip) and one
   was deliberately not added. `vary` exists so simultaneous copies of a sound
   do not phase-align into one loud blip — it matters when 8 land at once.
2. **Everything must darken and fall.** No rising resonant filter (reads as a
   whistle), no unbounded highpass tail (stays bright and drags the sound up).
   `meleeSlam`'s comments encode these rules; they were expensive to learn.
3. **On a phone, spectrum beats gain.** A handset speaker has almost no output
   below ~400Hz. The saber hum was built from partials of a 110Hz fundamental
   behind a 900Hz lowpass, so its energy could not physically leave the device
   and no amount of gain would have helped. Re-voicing it upward moved the
   phone-audible band (400–1600Hz) **+25.8dB** while the sub band moved only
   6.2dB. If a sound is "too quiet on mobile", measure the bands before
   reaching for the gain — see `tests/smoke-hum.mjs`.

---

## 8. Deploying

**Pages builds only from `FRIX`.** `.github/workflows/deploy.yml` triggers on
pushes to `FRIX` alone. Work lands on the dev branch, so Pages serves a **stale
build** until `FRIX` is fast-forwarded.

The user playtests on a phone against Pages, so a dev-branch push they cannot
play is not a finished task. **Deploy in the same turn as the commit — don't
ask.**

```bash
git push -u origin claude/mobile-run-game-design-OZLYF
git fetch origin FRIX
git merge-base --is-ancestor origin/FRIX HEAD   # MUST pass
git push origin HEAD:FRIX
```

If the ancestor check fails, **stop and ask**. Never force-push `FRIX`.

Then confirm the run went green (`mcp__github__actions_list` /
`actions_get`). Note that `actions_list` reliably exceeds the tool result size
limit on this repo; recover by reading the saved output file and slicing for
`id` / `head_sha` / `status` / `conclusion`.

---

## 9. Dead and dormant code

Do not assume anything in the tree is live.

| Thing | Status |
|---|---|
| `src/entities/Ally.js` | **Dead.** Imported nowhere. Allies were cut — they were the "unkillable floating weapon" bug and reused other sprites |
| Stealth FSM in `Enemy.js` | **Dormant, not deleted.** Bypassed by a swarm branch at the top of `EnemyShooter.preUpdate`. Patrol routes, vision cones and backstab logic still exist |
| `phase0_qa.cjs`, `phase1_qa.cjs`, `src/reproduce_detection.cjs`, `phase0_baseline_qa.txt` | **Stale.** One-off puppeteer QA scripts from July, superseded by `tests/`. They are the only reason `puppeteer-core` is a dependency — and it is in `dependencies`, not `devDependencies`, so it is installed on every deploy build for nothing. Safe to delete; left in place because removal was not asked for |
| `design_vertical_slice.md` | Historical design spec from the stealth era. Useful as intent, **wrong as description** |
| `WaveManager.js` | Already deleted. Older docs still reference it |

---

## 10. Debugging on a phone

`window.game` is gated behind `import.meta.env.DEV`, so on the deployed build
there is **no console and no other way in**. Hence `DebugScene`, reached from
**Pause → DEBUG**, shipped in production on purpose:

- **Survival** — god mode toggle, full heal
- **Loadout** — give rifle / pod, refill ammo / pod
- **Meters** — fill super, fill melee, refill dash
- **Encounter** — cycle enemy type + spawn ×4, clear wave, skip wave

### Touch-control layout (Pause → CONTROLS)

`ControlsScene` is a layout editor for the five touch widgets — move stick, aim
stick, super, melee, dash. Drag a proxy to move it, tap to select, then the SIZE
slider resizes it. State lives in `src/systems/controlLayout.js`, persisted to
`localStorage` under `crix.controls`.

- **`controlLayout.js` is the source of truth for control geometry, not
  `HUDCFG`.** The `HUDCFG.joystick*` constants are now only the *defaults* the
  store seeds from. Read positions with `getControl(id)`.
- **`scale` is not cosmetic.** Each widget multiplies its `radius` (hit test,
  force normalisation, drag throw, tap/drag threshold) by it, so a bigger stick
  really does have a longer throw. Every widget takes it through `setLayout()`.
- **The sticks float**, so a stick's x/y is only where it *rests* — it does not
  decide where you may touch. Each stick still claims its own half of the
  screen, which is why the store clamps a stick to that half.
- **The button pop tweens multiply `this.scale`.** Anything that writes
  `image.setScale(1)` or tweens `scale: 1` on a touch widget will silently
  resize a customised button back to 100%.
- Ammo pips and the secondary-weapon readout ride with their stick
  (`HUD._layoutChrome()`), so they follow it around.
- `HUD.applyControlLayout()` is what makes an edit take effect mid-run;
  `ControlsScene` calls it on close, along with `setTouchControlsVisible()` to
  blank the real widgets while the proxies are up.

God mode lives at **module scope** in `src/systems/debug.js`, not on the scene or
player, because `PauseScene._restart()` builds a fresh Player — a flag stored on
either would silently switch itself off exactly when you least want it to.

---

## 11. State as of this handover

Everything is committed, pushed and deployed. Working tree clean, `FRIX` level
with the dev branch, deploy run #114 green.

> **Note on branches.** The touch-control work landed on
> `claude/touch-control-customisation-0e4nvk`, not on the older
> `claude/mobile-run-game-design-OZLYF` named in §1 — that branch stops at
> `c2de5ed`. `FRIX` is level with the newer one.

**Recently completed** (most recent first):

- Touch-control layout editor at Pause → CONTROLS
- Powered attack run for cluster munitions + exhaust flame (`084904d`)
- Saber hum re-voiced for phone speakers, melee bus +2dB (`cd0f9b4`)
- 8 munitions at 290 damage each (`faf7809`)
- Sustained booster burn (`685874e`)
- Dotted trajectory lines, booster on lock, thinner impact (`9ae16c6`)
- Distinct-target locking and dive (`9981d17`)
- In-game debug menu (`9c8e1cb`)

**Open, not started** — the user's call, not an oversight:

1. **The game-wide depth bug** in §6.

**Watch:** the cluster's total damage output (§5) against a full arena.
