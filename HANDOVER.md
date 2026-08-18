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
- **Dev branch:** `claude/project-handover-ack-9ai0av` — this name changes
  between sessions; if it looks wrong, believe `git rev-parse --abbrev-ref HEAD`
  and correct this line
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
    rooms.js       4 arena layouts (cover, props, floor + perimeter art,
                   gates, terminals). `walls: []` in every room on purpose —
                   see the comment at the top of the hangar spec.
    mapUtils.js    Nav-lattice snapping, ASCII map expansion (unused),
                   perimeterOpenings() — where the wall band needs doorways
    upgrades.js    15 between-wave upgrade cards
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
    musicDirector.js  Game state -> music tier/heat; imports no scene
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
| `bomber` | 200 | 300 | Suicide charger, 155px blast for 240. **As a nemesis it does not suicide** — see §10d |
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

**Combat text is the asymmetric case.** Damage numbers draw at 30 — *above*
every telegraph (12–14) and *below* the whole Y-sorted actor band. So draw order
alone hides text behind bodies while doing nothing to keep it off a lethal zone,
which is why `damageNumber` tests candidate positions against live telegraphs
itself rather than trusting depth (§10e).

`DEPTH.AIR` (2000, in config.js) is the band for things genuinely flying **over**
the room. Anything in it must add its **ground y** — where its shadow is — never
its rendered y, or draw order drifts as it changes altitude.

> **Closed — do not reopen without new evidence.** This section used to carry an
> open issue: ordinary bullets and the shared particle emitters are still on the
> flat constants, so in principle primary bolts pass *behind* consoles and sparks
> render *under* actors. It was measured against the code on 2026-07-31 and the
> remaining exposure is not observable in play. The cases that WERE visible had
> already been fixed — airborne munitions and the airburst moved to `DEPTH.AIR`,
> `FX.airSparks` got its own emitter, `bladeArc` sorts at `y + 40`.
>
> A projectile can only be drawn on the wrong side of something inside the
> margin where that thing's art overhangs its collider, because a collision ends
> the bullet. Measured:
>
> | | sprite | body | wrong-draw window |
> |---|---|---|---|
> | Walls | 26×26 @4 = 104px | full 104px | **none** — overlap is impossible |
> | Cover / consoles | 28×28 @4 = 112px | 70×70 | 21px |
> | Player | 24×24 @4 = 96px | r22 → 44px | ~26px |
> | Grunt | 20×20 @4 = 80px | r22 → 44px | ~18px |
>
> At bolt speed those windows are **under 20ms — roughly one frame** — and for
> actors the impact FX (depths 32-36) covers the same instant. Walls, the largest
> occluder in the arena, have no window at all. The one lasting case is the
> shared ground emitters at Phaser's default depth 0, which sit under the decal
> RenderTexture (2) and under actors; ground sparks reading as behind the actor
> they came off is correct enough, and FX.js's own comment already judged it
> survivable.
>
> The verdict is that a game-wide re-depth would be risk without a symptom. If a
> future session suspects this again, reproduce it on screen first — it is not
> reproducible by reasoning alone, which is how it stayed open this long.
>
> Loose end left in place: `Bullet.ySort` (`Bullet.js:36,57,68`) is an opt-in
> nothing ever passes. The cluster munition it was added for ended up solved in
> `GameScene` with `DEPTH.AIR + groundY` instead.

---

## 7. Audio

All synthesis, no files. `FX.js` exposes helpers — `tone()`, `noise()`, `sub()`,
`punch()`, `stack()`, `shaper()` — feeding two buses under the user's volume:

- **`sfxBus`** — default for everything, duckable via `duckSfx()`.
- **`meleeBus`** — Riven melee **only**, ~+6dB and exempt from ducking.
  Deliberately reserved; **do not route new sounds to it**. It also has no echo
  send, because a ringing tail was designed out of the melee.

### The music bed

`startMusic()` runs a sub-register pad (A-minor triad at 55/65.41/82.41Hz behind
a lowpass) under **the full 8-bar Imperial March**, in A minor, 4/4 — a 32-beat
phrase, ~14.7s, in `marchBars`. Bars 1-4 are the theme, bars 5-8 the answering
phrase that climbs an octave and lands on the dominant so the loop turns over
instead of stopping.

- **It is scheduled a bar at a time**, not a phrase at a time. Tier and heat are
  read at schedule time, so a wave starting mid-bar takes hold on the next one
  (~1.8s) rather than up to 15s later.
- **Every bar must be exactly 4 beats.** The drum grid is written against a fixed
  bar; a mistyped `len` would drift the kit out of phase with the melody, so
  `startBar` warns on any bar that does not sum to 4.
- **The dotted 0.75/0.25 pairs are the tune.** Flatten them to equal quarters and
  it turns back into elevator music — that has happened here before.
- Voices of the last **two** bars are retained (`musicBarNodes` +
  `musicPrevBarNodes`) so `stopMusic` can cancel a half note ringing across a
  bar line. Verified by `tests/smoke-march.mjs`.

### Dynamic music: tiers, heat and the director

The bed tracks how bad the fight is. Three pieces: `MUSIC` in `config.js` (all
data), `src/systems/musicDirector.js` (game state → musical meaning, imports no
scene), and the synthesis in `FX.js`.

**Phase and heat are deliberately not one number.** GameScene publishes a
discrete **phase** (`wave` / `breather` / `upgrade` / `miniboss` / `boss`) which
is authoritative and picks the band of legal tiers; the director computes a
continuous **heat** which only chooses *within* the combat band. Combining them
fails both ways: a lifecycle floor of 1 at wave start saturates every other
term, and a heat that can outvote the cue means the upgrade picker never goes
quiet. Heat keeps decaying during calm rather than freezing, so the next wave
starts from where the situation actually is.

| Tier | Phrase | Kit | Melody | Tempo | Reached by |
|---|---|---|---|---|---|
| `calm` | — | heartbeat kick | **off** | 0.48s (~125 BPM) | **room clear / upgrade picker / idle only** |
| `combat` | `main` | march, 5 variations | unison | 0.46 (~130) | in a wave *or a breather*, heat below 0.62 |
| `hot` | `main` | drive — shaker 16ths, ride, rimshot | unison | 0.42 (~143) | heat above 0.62 (exits at 0.50) |
| `miniboss` | `climb` | half-time | unison | 0.46 | a mini-boss is alive |
| `boss1` | `main` | half-time | unison | 0.46 | Vader phase 1 |
| `boss2` | `main` | half-time + tamb | **octaves** | 0.46 | Vader phase 2 |
| `boss3` | `main` | half-time + tamb + roll | **octaves** | 0.42 | Vader phase 3 |

**Calm is for a finished ROOM, not a finished wave.** It used to catch every
non-wave phase, so the march dropped out three times a room. The breather needs
no handling of its own: the arena is empty, so heat decays from 1.0 at 0.45/s
and the bed settles `hot → combat` across the 2.5s by itself.

**Phrases** live in `MUSIC.phrases` and a tier names one, the way it names its
kit. `main` is the full 8-bar march; `climb` is its B section as a standalone
4-bar loop — the mini-boss theme, which works alone because it ends on the
dominant, and which is the tensest music in the piece. The bar cursor is
free-running with every consumer taking its own modulo, because an 8-bar and a
4-bar phrase have to be able to swap mid-run.

- **Patterns are 16-character strings**, one char per sixteenth (`.` rest, `x`
  hit, `X` accent, `o` open hat). A kit is numbered variations plus an `order`
  indexed **by bar**, so the phrase-end fill always lands on bars 4 and 8. No
  RNG anywhere — the ear learns the shape and the tests stay deterministic.
- **Half-time reads the same rows at eighth resolution**, so the kit halves
  while the melody is untouched: heavier, not slower. Only the first 8
  characters then fall inside the bar, and `startBar` warns about content past
  index 7 rather than truncating it silently.
- **Tempo is mutable but only changes between bars.** Each bar freezes it, and
  the loop advances its cursor with *the same frozen value* — ramping before the
  cursor advances leaves a gap at every bar line that accumulates. Max 2%/bar.
- **Everything above the base kit lives in 400Hz-8kHz.** This is not taste. Twice
  during this work the obvious louder-and-bigger choice measured *worse on a
  phone*: a driving four-to-the-floor `drive` kit came out darker than the plain
  march, and trimming the hi-hat as part of the "core" cancelled exactly the
  brightness the new layers added, leaving the hot tier at 0.99x the march above
  400Hz. Both were invisible until measured. The hot tier now moves the phone
  band **1.30x** while total level holds.
- **The gain budget** (`MUSIC.budget`) is what stops the busy tier being the
  quiet one under the -10dB/12:1 master compressor: extra layers scale by
  `L^-0.5`, and kick and snare — *not* the hat, and *not* the melody — trim 6%
  per layer. Both exclusions were bugs first. Trimming the hat cancelled the
  brightness the new layers added; trimming the melody made Vader QUIETER as he
  escalated (0.0350 at phase 1 down to 0.0322 at phase 3). The rule that came
  out of it: only trim what is actually competing for the same headroom.
- Heat inputs and weights are in `MUSIC.heat`: kill streak 0.30, enemy pressure
  0.30, player danger 0.25, late-wave 0.15. The streak's staleness is derived
  from `lastKillAge` because `_comboCount` is not reset until the next kill and
  there is no combo-ended event. Smoothing is **slew-limited, not exponential**
  — an exponential never arrives, so the tier threshold would depend on how long
  you had been in a state rather than on the state.
- `resetDirector()` on scene shutdown, because heat and phase live at module
  scope (same reason as the god-mode flag). GameScene gates on
  `musicSampleDue(delta)` before building a snapshot, so the object is only
  allocated on an actual sample rather than every frame.

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
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"   # the dev branch, whatever it is called
git fetch origin FRIX
git merge-base --is-ancestor origin/FRIX HEAD   # MUST pass
git push origin HEAD:FRIX
```

If the ancestor check fails, **stop and ask**. Never force-push `FRIX`.

Then confirm the build went green — `curl` the REST API, not the MCP tool:

```bash
curl -s https://api.github.com/repos/Xletof/crix/commits/<sha>/check-runs \
  | python3 -c "import json,sys;[print(c['name'],c['status'],c['conclusion']) for c in json.load(sys.stdin)['check_runs']]"
```

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

## 10b. The Vader fight (as of the four-round rebuild)

Read `docs/POST-MORTEM-vader-moves.md` before touching any of this.

**Two systems drive him, and only one at a time.** His own state machine
(`Boss.preUpdate`: IDLE / CHARGE_WINDUP / CHARGING / SLAM_WINDUP / SLAM /
SPAWNING) and the scripted move runner (`MoveScript` + `src/data/bossMoves.js`).
`actor._performing` is the gate; both AIs yield on it, and `_castBossMove`
refuses while his state machine is mid-attack.

**His attacks, and where each lives:**

| attack | lives in | notes |
|---|---|---|
| SABER COMBO | `bossMoves.js`, `close: true` | default at standoff range; 3 swings + radial slam finisher. Cast from the IDLE branch, not the rotation |
| SABER THROW | `bossMoves.js` | the blade is integrated per frame and HOMES on his live position; the catch ends the flight, not the clock |
| FORCE PULL | `bossMoves.js` | circle zone, `fx.forceVortex` |
| FORCE PUSH | `bossMoves.js` | circle zone, `fx.forceWave` |
| VANISH | `bossMoves.js`, `reactive: true` | OFF the rotation — `Boss.shouldVanish()` fires it on a damage burst, with a lockout |
| CHARGE | state machine | the saber sweeps through the run; ends early on a wall and slams |
| OVERHEAD SLAM | state machine | standing, no dash |
| minion spawn | state machine | |

The green bullet FAN was removed entirely.

**His effects are his own.** `fx.saberSlam` / `fx.saberSweep` (crimson, molten,
scorching) for anything with the blade, `fx.forceWave` (dark, desaturated) for
the Force powers. Do NOT reuse `slamShockwave` or `bladeArc` on him — those are
the PLAYER's Riven melee, and borrowing them made his attacks look like the
thing you had just done to him. **§10f is the current state of that vocabulary**
and is where to look before touching any of it.

**He takes no knockback at all** (`Boss.damage` nulls the vector). Any
displacement drags him off a telegraph he is the origin of.

**Cadence numbers are measured, not guessed** — see the table in the
`attackCooldownMs` comment in `config.js`. The two systems block each other, so
tuning is zero-sum: the highest attacks-per-minute came from starving the
scripted moves.

## 10f. Vader's visual language

The fight was mechanically approved and fun. The problem this section records is
that it did not COMMUNICATE: with the attack-name banner hidden, four of his
seven attacks could not be told apart from their motion, their telegraph and
their effects. Nothing about the combat changed in this pass — no hp, damage,
cooldown, selection, phase threshold, geometry, timing or punish window. What
changed is what each attack says about itself.

**The test that drove it, and it is still the test:** load with `?nonames=1`,
which suppresses the six per-attack callouts and nothing else, and see whether
the move is still identifiable. `shot-vader-language.mjs` produces the sheet.

### The four families, and the one rule each

| family | moves | the rule |
|---|---|---|
| **Saber** | COMBO, THROW, CHARGE, OVERHEAD SLAM | crimson, hot, and it BURNS THE FLOOR. A saber mark has an orientation, so the deck carries the direction of the strike for a beat after the strike |
| **Force** | PULL, PUSH | desaturated violet, and told apart by MOTION rather than hue. Pull contracts, push expands |
| **Displacement** | VANISH | a shear, run one way to leave and the other to arrive. No ring, no circle |
| **The zone itself** | all of them | the telegraph is geometry and is never beautified into a different promise |

**What each move now owns, and why it did not before:**

- **FORCE PULL / FORCE PUSH were the worst pair.** A violet circle and a pale
  blue circle whose kinetic rings BOTH converged inward — because inward was the
  only behaviour a circle zone had, and the first circle move that needed one was
  a slam. So a 420px shove *away* from him was announced by a ring travelling
  *toward* him, and the only thing separating the two moves was the printed name.
  They now share one Force violet; `kinetic: 'in' | 'out'` picks the direction,
  arrowheads ride the ring so it survives a still frame, PULL's vortex gained
  explicit contracting rings, and PUSH's wave carries debris on the front with
  tails pointing back at the origin. The player's body is marked with a violet
  streak along whichever way it is being moved.
- **SABER THROW drew a static lane for a moving weapon**, and its blade drew
  nothing outbound and the PLAYER's `trail()` (bullet motion blur) on the way
  home. The lane's chevrons now scroll at the blade's own outbound flight time,
  the blade has a bespoke crimson streak on both legs, a scar marks the turn, and
  the commit bloom is a `bloom: 'spear'` on the axis rather than the full-width
  fan every lane uses.
- **CHARGE was the same crimson lane, 20px wider.** Its chevrons run at the speed
  HE crosses it, and he drags the point through the deck — a continuous furrow
  drawn between the two points he actually travelled between. The furrow is the
  thing a thrown blade can never produce.
- **OVERHEAD SLAM existed for N milliseconds; it did not LOAD.** `stress: true`
  opens staggered fractures out of the centre and brightens a core across the
  wind-up, the raised blade gathers through `fx.chargeGlow`, and the release is
  `saberSlam(..., 'overhead')` — a real crater, fissures that outrun the ring, a
  dust column after the brightest frame. One call used to serve this, the combo
  finisher and a whiffed rush into a wall.
- **VANISH used `slashSwipe`** — the stealth TAKEDOWN's arc, green by default.
  `fx.phaseRift` now shears him apart where he leaves and back together where he
  lands, with residue only at the departure point. It draws no ring: the landing
  marker stays the only thing allowed to promise a position, which is the bug
  this move already shipped once.
- **SABER COMBO drew one arc three times.** The swings escalate in reach and
  weight and each scores the deck along its own path, so the chain accumulates.

### Traps this pass left behind

- **`Telegraph._flash` will delete the caster** if it is a flat fill and the zone
  originates at his feet. It ramps from the origin now. See CLAUDE.md.
- **`kineticMs` and `kinetic` are per-move statements.** Left at their defaults a
  new move inherits "620ms, inward", which is a claim about it that is probably
  false. Both are cosmetic — `contains()` reads neither.
- **Floor marks accumulate.** `fx._keepScar` is the bound (48) and everything
  drawn into the floor must go through it.
- **The zone FILL is still dragged toward danger-red for every move**, by design
  (a pale trait tint filled a zone with grey smear once). So the Force family's
  violet lives in the outline, the motes and the motion — not in the fill — and
  the outline itself heats toward white in the last quarter. That is the weakest
  remaining part of the family read and it is a deliberate trade, not an oversight.
- **`?nonames=1` is a diagnostic, not a decision.** Whether the names ship is a
  human call that has not been made.

### DEFLECTION is a parry now (added after the pass)

The endless mechanic (`bossMechanics[2]`, so Vader #3 onward) used to answer a
player shot by **killing it and firing a green enemy bolt**: `bullet-enemy`
texture, a flat 437px/s, spawned 50px from Vader on the boss→player line, with a
red `impactRing` at the contact — the same ring the player's own landed hits
draw. So the mechanic read as *Vader shooting back*, the tell said *your shot
connected* at the instant it had not, and a player standing inside that 50px was
never hit by their own shot at all.

It is now a deflection in the literal sense. **The bolt that returns is the bolt
that was fired**: the player's own red `bullet` texture, its own speed, its own
range, leaving from the point on the blade where it was stopped and aimed back
at the player.

Four things to know before touching it:

- **Deflected fire has its own pool**, `GameScene.deflectedBullets`. A red bolt
  cannot live in the green pool — `BulletGroup.fire` re-asserts its group's
  texture on every recycle, and re-texturing after the fact silently resizes the
  hitbox (`setCircle(this.width / 2)`). Same reasoning that gave
  `playerFragBullets` its own pool. **`GameScene.hostileBullets` is the list to
  iterate**, not `enemyBullets` — six places sweep incoming fire (player
  collision, walls, trails, HUD threat chevrons, room clear, the debug purge)
  and the getter is what stops one being forgotten.
- **`Boss.parry(angle)` only asks.** `Boss.preUpdate` rewrites the weapon
  sprite's position, rotation, flip and depth every frame from the bearing to
  the player, so the parry is a flag that block reads — not a tween from the
  scene. One writer. It sets no `_performing`: a deflection is a reflex and must
  be able to happen mid-charge without interrupting the charge.
- **The blade arrives one frame after the flash.** Collisions resolve in scene
  update, which is after `preUpdate` — so on the contact frame the saber has
  already been drawn at rest. 16ms in the hand, but a full frame at the
  harness's ~20fps, and photographing the first qualifying frame gives you a
  picture of a flash with no blade in it. `shot-parry` skips one tick for this.
- **The returned bolt gets the ORIGINAL range, not what was left of it.** The
  remaining range is by definition the distance it has already travelled, and
  the trip home is that distance again — spending it down strands every
  deflection just short of the player.

**Ordinary reflected damage is unchanged and is still the open question.** It is
`round(incoming * 0.5)`, and `incoming` already carries `player.dmgMult` — so a
deflection scales with the player's upgrades, not with Vader. Base is 60 against
1000hp; at the mid-endless `dmgMult` ≈ 14.5 quoted in `config.js` it is ~870.
Deliberately left alone in the stance pass: it is a phone question, not a
harness one.

### DEFLECTION became a STANCE, and the super is caught (pass 2)

Handset review of the above: semantically correct, and *too subtle*. The parry
rotated the blade onto the incoming bearing and pushed it out 30px — which is
almost nothing, because his saber already points at the player and the player is
where the bolt came from. The read was **flash, my shot came back**, with the
flash carrying all of it. The 1400ms window also only ever bought one bolt in
flight against a ~760ms player fire cycle (3 rounds at 120ms + a 520ms reload),
so it was a hidden reflection window rather than a state you could see him enter.

What changed:

- **It is a stance.** `reflectMs` 1400 → **2400**, so a player who keeps firing
  witnesses several parries. `Boss.isGuarding()` is the new gate: while it is
  true, `_castBossMove`, `pickAttack` and `shouldVanish` all refuse, so no other
  saber system can start and fight the guard for his weapon. It suppresses
  STARTS only — anything already running finishes, and the cooldown keeps
  running down underneath, so offense resumes the frame it drops. **Melee is
  untouched on purpose**: the stance is projectile defence, and closing on him
  is the intended answer to it.
- **The blade is visible off-aim while guarding**, at `guardOffsetDeg` (42°)
  with a slow sway. The stance had no read at all with nothing in the air.
- **A parry is a follow-THROUGH.** `PARRY_ARCS` in `config.js` is eight bearing
  families (lateral swats widest, low bats tightest, mirrored left/right);
  `parryPose(arc, u)` in `Boss.js` is the pure curve — contact at `u = 0` (blade
  on the intercept bearing, thrust to full reach, because the bolt is killed and
  the reply fired on that same frame), then follow-through, hold, recovery over
  `parryMs` 190 → **300**. `preUpdate` calls that function and the smoke test
  imports it, so there is one implementation, not two that agree by accident.
- **The super is CAUGHT, not batted.** This is the locked design decision. Five
  pellets each carrying `superDamage × player.dmgMult` returned individually was
  five simultaneous deletions once `dmgMult` reached four figures. Now
  `Boss.absorbSuper()` consumes them, energy visibly gathers at his hand (ONE
  `Graphics`, cleared and redrawn by the same block that owns the saber), and
  after `superAbsorbGraceMs` 380 + `superReleaseMs` 620 he fires exactly one
  slow orb: `bossSuperOrbs` pool, `boss-force-orb` texture, 44px body radius,
  **300px/s**, no homing, aimed by a snapshot taken at release.
- **The orb's damage is bounded and has nothing to do with the player's
  scaling**: `superReturnBase 180 + 55 × pellets`, ceiling `620`. Five pellets =
  **455** against 1000 player hp. It is a stated ceiling on damage, not a hidden
  cap on intake — every pellet is absorbed, counted, and the orb carries exactly
  what it deals. **This is the number to argue about on a handset.**
- **Three hostile pools now.** `bossSuperOrbs` joins `enemyBullets` and
  `deflectedBullets` in `GameScene.hostileBullets`.
- Beats are ticked on the Boss (`_absorbT`, `_releaseT`), never scheduled: a
  `delayedCall` on a Vader who withdraws fires into the next sector.
- `tests/smoke-deflect.mjs` protects all of it (32 checks; 27 fail on the
  pre-stance build). `tests/evidence-deflect.mjs` is the picture rig — it slows
  `parryMs` to 6s and pins `_parryT` so the real production draw can be
  photographed frame by frame, which a ~20fps harness cannot otherwise do.

**Not done, deliberately:** the encounter ladder is untouched, so DEFLECTION is
still `bossMechanics[2]` (Vader #3 onward). The debug proving ground already
summons any encounter, so handset testing did not need the ladder moved.

### The endless "soft lock" that wasn't (investigated, no production defect)

A P0 was raised: after Vader withdraws, the exit does not open and walking out
leaves the run in the same Vader sector. `smoke-endless` reproduced it standalone
on the pre-Deflection build too, so it was not the visual work.

**It is not in the game.** The completion contract was instrumented end to end —
`Boss.damage` → `retreat()` → `boss-wounded` → `_enemiesCleared` →
`_maybeCompleteRoom` → `_openDoor` → `doorZone` → `_transitionToNext` — following
the real production route (arena completes, Vader spawns from
`_onArenaCompleted`). It works: wound at t=64852, door at t=68336, walking it
took sector 10 → 11 and room `vader` → `detention`.

The bug was the instrument, in two compounding ways, both now fixed and both
written up in `tests/README.md`:

- it waited a flat 2500ms for a door that takes ~3500ms in this harness, so it
  was **reading the frame rate**, and it could not distinguish a late door from
  an absent one;
- the walk that follows was gated on that same early sample, so a late door
  meant **the walk never ran**, inventing a second failure.

It also never exercised the arena→boss hand-off at all, because it hand-spawned
Vader. It now completes the arena and lets the game spawn him.

**Two soft-locks were injected to prove the rebuilt checks discriminate** —
dropping `_enemiesCleared = true` from the `boss-wounded` handler, and latching
`_roomDoorOpened` in `_onArenaCompleted`'s boss branch. Both are caught now, and
the second was NOT caught before the staging was fixed. If you touch this
contract, re-run that injection rather than trusting a green file.

## 10c. The narrative system

**The ledger has always remembered; nothing spoke.** `nemesisLedger.js` tracks
who got away, whether it drew blood, how many times you have met and who
inherited a dead one's grudge — and the entire payoff was a 26px medal in the
`score-medal` lane that flew past in one second. A nemesis that nearly killed
you in sector 4 was indistinguishable from a fresh roll. This is the other half.

**Three files, and the split matters:**

| file | what it owns |
|---|---|
| `src/data/nemesisDialogue.js` | the lines, and which one is chosen. Pure — no Phaser, no `Math.random()`, rng injected, same contract as `nemesisLedger.js` |
| `src/scenes/DialogueScene.js` | the card. Knows nothing about the ledger; takes a `{bust, name, color, sub, text, traits}` and renders it |
| `GameScene` | the five hooks, and the queue |

**A line is a gated pool entry, not a switch case.** `{ id, kind, priority,
when(ctx), text(ctx) }`. `pickLine` filters by beat, then by `when` against
ledger state, then drops anything already spoken this run; only when a beat's
whole pool is exhausted does it reset that beat's ids. `priority` lets a line
that knows something specific ("you left me on sector four") beat the generic
one while it is unspoken. `grudgeLine` is still a switch and is still right to
be — four labels on a banner should be stable. Speech should not.

**`ledger.spoken` and `ledger.vader` are on the LEDGER, not the scene.**
`GameScene` is reused across `scene.start()` (see §the note at GameScene.js:83),
so a spoken set on the scene would survive into the next run and silence lines
the player has never heard. `ledger.vader` exists because Vader has no ledger
entry — he is not rolled, carries no traits and never leaves for good — and
"you made me withdraw last time" needs somewhere to read from.

**The card is a FULL STOP.** It pauses Game and HUD and waits for a tap. That is
only affordable because it is rare, and the thing that keeps it rare is
`_nemesisArrivalDialogue` returning null for a nemesis with no ledger entry. **A
first-time stranger raises nothing** — it keeps the banner and trait line it
already had. If cards ever start appearing on every mini-boss spawn, that gate
is what broke; `smoke-dialogue` asserts it directly.

**Who speaks, and where:**

| beat | site | who |
|---|---|---|
| arrival | `_spawnMiniBoss` | a RETURN or an HEIR only |
| death | the `enemy-died` handler | any nemesis — `recordKill` returns the entry, which is the last moment the pre-death state exists |
| it killed you | `_handlePlayerDeath` | respawn path only, never `defeat()` |
| Vader arrives | `spawnBoss` | every encounter |
| Vader withdraws / falls | `boss-wounded` / `boss-died` | `ledger.vader` is written BEFORE the line is chosen |

**Vader gets no card when he kills you** — only the `killedYou` record. Being
made to sit through a speech before you can get back up is the pace cost with
none of the payoff, and he has a line about it waiting for his next entrance.

**The busts are never tinted.** `setTint` multiplies every channel, so a white
stormtrooper helmet becomes a flat wash of the nemesis colour and every
archetype looks alike again — which is the problem the busts were painted to
solve. The colour goes on a glow layer BEHIND the bust, inside the portrait
recess. The recess itself is not decoration: drawn straight onto the plate, the
32x36 art ends at a hard edge mid-shoulder and reads as clipped.

## 10d. Nemesis duels

The verdict that started this: *"I don't want the Nemeses to be same as normal
enemies but just enlarged, they can be killed in 1-2 supers... the explosive
nemesis literally explodes on impact with me."* Four measured causes, four
fixes.

**1. The bomber deleted itself.** `bomber` is a legal nemesis base and
`EnemyBomber` ran stock contact logic — `_detonate()` sets `hp = 0` and calls
`die()`. A body with 6× hp, traits, regalia, a generated name and a ledger
grudge ended its own fight by walking into you, so its entire hp pool was
unreachable. A nemesis bomber now does a **recoiling contact burst** on a
cooldown (`_contactBurst`, `Enemy.js`) instead: it still explodes, because that
is the archetype, but as pressure rather than suicide. `smoke-duel` gates this
directly — it is the cheapest thing in the file to regress by accident.

**2. There was no encounter.** The nemesis was one more wave member with the
trash drip continuing around it. A telegraph is a promise about which patch of
floor is about to hurt and it cannot keep that promise through a crowd, so every
curated move built on top was wasted.

`_beginDuel` expresses the lockout **through the existing wave phase machine**
rather than a new one: the duel wave spends its whole spawn budget up front, so
the drip has nothing to release, and `clearing` then waits on the nemesis
exactly as it would wait on a wave. One state machine, and it already knows how
to end. Trash already on the floor is *dismissed*, not killed — a kill would pay
score for enemies the player never fought and fire every volatile death blast at
the moment the duel is trying to establish its read.

**3. Nothing said it was a fight.** `HUD` now draws a **duel bar** with the
nemesis's name in its own tint and white pips at 66% and 33%, which is where its
phases fire. The bar reads hp **per frame** rather than on a damage event:
damage arrives from bullets, melee, blasts and regen, and an event-driven bar
would desync the first time a new source was added.

**4. Movesets were chosen by trait alone**, two per nemesis, cycled in fixed
order, first cast a full `everyMs` (7.5–11s) after spawn. So an armored grunt
and an armored shooter played identically, and a short fight showed one move.

Identity now comes from the **base** (`KITS` in `nemesisMoves.js`) and traits
graft one move on top (`TRAIT_MOVES`). `grunt` and `bomber` are authored; the
other three draw from the original five while their kits are built — real moves,
not stubs. First cast is 2s in, and cadence tightens per phase.

| move | base | the idea |
|---|---|---|
| SLIDE & SMASH | grunt | Combo. Telegraphs the slide, then telegraphs the smash **again** at wherever the slide actually stopped, so beating the lane earns a decision rather than a free window |
| TRIPLE DASH | grunt | Three links, each re-aimed at where you went after the last |
| MORTAR VOLLEY | bomber | Four shells; answered by moving continuously, not by one dodge |
| MINEFIELD | bomber | Changes the *shape* of the arena rather than threatening one patch |
| CHAIN DETONATION | bomber | r=220 against a 228px dash. Escapable, barely — baited, not reacted to |

### Testing a nemesis without playing to sector 3

The first nemesis a run can meet is at **sector 3** — mini-bosses come only from
the `detention` arena (`ARENA.detention` is the one wave list with
`miniBoss: true`). Checking one change therefore meant playing two rooms first,
every time, on a phone. That is why a dash covering a sixth of its lane survived
a whole pass: nobody replays to sector 3 to watch the same 800ms telegraph again.

`?duel=` drops straight into the fight on load. URL rather than a menu so it can
be bookmarked on the handset and re-opened with one tap, and so a specific fight
can be handed to someone else exactly as it was seen.

```
?duel=1                          a random nemesis, right now
?duel=bomber                     that base
?duel=grunt:armored,colossal     that base with those traits
&move=slidesmash                 it casts ONLY that move, on a 2s clock
&sector=12                       scale it as if the run were that deep
&nodlg=1                         skip the dialogue cards
```

Combine freely: `?duel=grunt:armored&move=slidesmash&sector=12&nodlg=1`

It skips the title, places the nemesis **on screen** rather than at the farthest
gate (`_spawnMiniBoss` puts it there so it can make an entrance, which is right
in play and useless for a debug link), and polls for a live player rather than
guessing a delay — the first version fired against a half-built scene, returned
at its own guard, and did nothing at all silently.

The debug panel (Pause → DEBUG) still has the trait loadouts and FORCE MOVE for
when you are already in a run.

### Traps this pass left behind

- **A chained move can outlive the move that owns it.** Timers resolve coarsely
  on a slow frame, and TRIPLE DASH's third link once *started* after the recover
  beat had already run — so the combo finished in a wind-up pose. Any move that
  schedules its own links needs an `h.over` flag set at the impact beat; a
  generous `actMs` alone is a race, not a fix.
- **`onEnd` on the last link of a chain fires after RECOVER.** Setting a pose
  there unconditionally overwrites the recovery pose.
- **A second zone in the same move must be `anchor: 'world'`** if it marks a
  place rather than a body — otherwise it drifts with the caster's recoil and
  stops being a promise.
- **A dash must not outrun the lane it drew.** The telegraph is a promise about
  which floor is dangerous; a body travelling past its own zone hits players who
  correctly stepped clear. `dashPx` on the move records the intended travel and
  `smoke-moves` asserts both that the dash covers it and that it does not exceed
  `laneLen`. For a combo, `dashPx` is the TOTAL and `dashLinks` says how many
  links to divide it by.
- **`charge()` re-asserts velocity every frame, and the thief was never drag.**
  Setting velocity once and coasting meant every dash in the game decayed almost
  immediately. This entry used to say enemy bodies carry `setDrag(900,900)` and
  that `charge()` suspends it. **That is false** — the only `setDrag` on an enemy
  is `Enemy.js:241`, inside `die()`, for the corpse slide. The real thief is the
  AI: `Enemy.preUpdate`/`Boss.preUpdate` rewrite velocity every frame, so a
  set-and-coast dash is overwritten rather than damped. `charge()` therefore
  re-asserts on a 16ms timer and holds `_movePlanted` for the duration, and the
  general rule survives the correction intact: **restore whatever you suspended
  on cancel as well as on completion**, or a cancelled charger keeps the
  suspension for life.
- **RITE's interrupt is a flat damage bar** (`RITE_BREAK_DAMAGE`), not a
  fraction of max hp. The old `> hpMax * 0.06` scaled the wrong way: the tougher
  the nemesis, the more the interrupt demanded, so the one move whose correct
  answer is offence stopped being answerable on exactly the enemies it mattered
  against.

## 10e. Combat text and the information hierarchy

The screen is loud on purpose. The problem this section records is that at peak
it was loud *undifferentiated* — a crit and a grunt chip were nearly the same
object, so nothing outranked anything, and the fight disappeared under its own
scoreboard. Measured on the build that shipped before this pass
(`tests/diag-combat-text.mjs`, evidence in `docs/evidence/combat-text/`):

| | before | after |
|---|---|---|
| peak concurrent labels | 79 | **28** |
| peak labels overlapping a body | 46 | **14** |
| crowded wave — labels on a body | 42% | **25%** |
| nemesis duel — labels on a body | 43% | **23%** |
| peak labels on a live danger zone | 5 | **1** |
| `Text` allocations at peak | 219/sec | a fixed pool of 26 |

**The intended rank, and it is a gameplay statement, not a style one:** lethal
space (telegraphs) → bodies and weapon action → CRIT → ordinary damage.

### What the system is

Everything below lives in `FX.js` (`damageNumber`, `DMG_TIER`, `DMG_POOL`),
`HUD.js` (`showCombo`, `showBanner`) and the three call sites in `GameScene`.
There is deliberately **no general UI framework** — the problem did not need one.

- **Two tiers.** `minor` 21px/420ms, `major` 34px/780ms. The RATIO is the
  mechanism: making ordinary damage smaller is what makes a CRIT read as
  special. Shrinking everything equally would have bought a quieter screen with
  the same confusion still in it.
- **A fixed pool of 26** is the clutter bound. Not primarily an allocation
  optimisation — it is the only limit that cannot be defeated by a faster
  weapon, a bigger crowd or a longer combo, because it does not depend on hit
  rate at all.
- **One CRIT per contact AREA** (96px / 380ms), re-punched rather than
  restacked. Keyed on position, not entity: per-enemy keying still stacked
  identical labels whenever two foes half a body apart both crit. Only the
  label coalesces — the damage numbers stay discrete, because separate impacts
  are the tactile feedback and merging them is a lie about how many landed.
- **No label on a lethal telegraph.** Candidate slots are scored with each
  zone's own `contains()`, so the check and the hit test cannot drift apart.
- **The combo splash escalates**: routine streaks quick and modest, x10+ the
  full slab, every tenth a white flourish.
- **Lanes arbitrate**: the banner steps clear of the duel readout, the combo
  splash steps clear of the banner.

### Traps this pass left behind

- **A hit on a boss fires TWO damage events** — `boss-hit` *and* `enemy-hit`.
  See the CLAUDE.md trap; this is the one most likely to bite next. It is why
  `boss-hit` now draws no damage number at all.
- **Score the drift destination, not just the spawn point.** The first
  telegraph-avoidance check tested only where a label appeared, and made the
  duel case *worse* than the code it replaced — the drift pushes away from the
  player, which in a duel is precisely the direction of the nemesis and the zone
  it is standing in. Labels were being launched into a telegraph from a start
  position that had been checked and cleared.
- **Tier a counter by MAGNITUDE, never by divisibility.** The first combo
  tiering used `n % 10 === 0`, which drew **x114 smaller than x20** — the
  display contradicting the achievement it was reporting.
- **Anchor to the drawn sprite, not to `cfg.radius`.** `_makeElite` grows the
  collider on a different curve than the art, so a label anchored to the physics
  constant lands inside a big nemesis's chest. Use `_headroom()`; the hp bar had
  the identical defect.
- **Depth is asymmetric** — see §6. Combat text at 30 is *above* every telegraph
  and *below* the whole Y-sorted actor band. That asymmetry is the entire reason
  the telegraph-avoidance check has to exist: draw order will not save you.

---

## 11. State as of this handover

Everything is committed, pushed and deployed; `FRIX` is level with the dev
branch `claude/project-handover-ack-9ai0av`. `origin/main` is unrelated and
unused — Pages builds from `FRIX` only.

**Recently completed** (most recent first):

- **Vader's visual language** — every attack now communicates its own identity,
  direction, anticipation and consequence. No combat value changed. §10f has the
  vocabulary, the per-move reasoning and the traps; `shot-vader-language.mjs`
  produces the labelled and `--nonames` unlabelled review sheets.

- **Ordinary boss damage was printed twice** (`2ac65df`). `Boss.damage` emits
  `boss-hit` and then calls `super.damage`, which emits `enemy-hit` — so every
  hit on Vader drew its figure twice, gold on the crit tier and orange on the
  ordinary one, plus the CRIT label. Three labels for one hit. The fix is a
  deletion: `boss-hit` no longer draws a number and the already-tiered enemy path
  is the sole producer. §10e.
- **Combat-information hierarchy** (`b312aa6`) — tiers, a bounded pool, CRIT
  coalescing, telegraph avoidance, combo tiering and HUD lane arbitration. §10e
  has the numbers and the traps.
- **Round-three nemesis pass** (`17d77f2`) — hp bars anchored to the drawn
  sprite rather than the collider; BLINK STRIKE fixed (it drew the full arena
  diagonal, teleported to the farthest corner, could no-op its own ACT beat, and
  parked an uncancellable timer); enemy bolts 360→620 against a 380 walk speed,
  with tracers; nemeses made much sturdier with the super meter charging at
  0.34x off a mini-boss; and four ranged moves — PLANT & SNIPE, SWEEPING
  BARRAGE, SEEKER ORB, SUPPRESSING WALL. §10d.
- **Vader's hp set from PLAY, not from the harness** — 60,000. See the long note
  above `BOSS.hp` in `config.js`; the short version is in the next section
  because it is the most expensive lesson in this handover.
- **Player damage no longer compounds without bound.** `pickThree` falls back to
  the FULL pool once fewer than three cards are untaken, so past ~sector 13 every
  offer can repeat a card already held — and `apply()` had no idea it was running
  a second time. Measured through the game's own pick path, a run reaching Vader
  #6 had taken GLASS CANNON five times and MOMENTUM three, for **dmgMult 1240x**.
  Effects are now magnitudes scaled by an `s` argument, decayed 0.3x per copy
  held and resting on a floor — the floor matters, because a pure geometric decay
  converges and trading an explosion for a cliff is not a fix. Result: 1.7 / 2.6
  / 4.7 / 9.3 / 13.4 / 14.5 across encounters 1-6, still climbing to 25x by
  sector 59. The card reads "(HELD x2 — REDUCED)" on a repeat.
- **The narrative pass** — the nemeses and Vader speak. See §10c.
- **Phase 3 was escalating nothing.** `Math.max(900, 1100 - 400*(p-1))` gives 900
  at phase 2 AND at phase 3 — the clamp ate the whole term, so his attack rate
  was identical in both and phase 3's only gain was move speed. Explicit
  per-phase cooldowns now (1100 / 950 / 820).
- The Vader fight, rebuilt over four rounds — see §10b and
  `docs/POST-MORTEM-vader-moves.md`
- Nemesis system: memory, grudges, scars and succession within a run
- Seeded RNG with independent named streams (`src/systems/rng.js`)
- Endless as the single run structure; Vader every 5th sector, wounded not killed
- Music round 2, dynamic tiers, full 8-bar march (§7)
- Touch-control layout editor at Pause → CONTROLS

### The hp episode, and the rule it cost

The harness was taught to model a real run's upgrades, sample each rung three
times and report spread. It then measured every Vader encounter at **4-12s**
against a 60-90s target, and the arithmetic said the pool needed to be ~7x
bigger. 300,000 shipped. The verdict from the phone came back the same day:
*"literally cannot be killed, cant even dent it."*

The numbers were not wrong. **The instrument was answering a different
question.** The bot never dies — `lives = 9999`, and `step()` revives it in-frame
so a death cannot end a measurement early — and it never misses, never
repositions badly and fires on every frame the cooldown allows. Its dps is an
UNINTERRUPTED CEILING, so `hp / dps` answers "how long to chew through this pool
while taking no consequences", which is not "how long is this fight". A real
player spends time dead, disengaged, out of ammo and backing off.

`tests/diag-encounter.mjs` says at the top, in its own words, that every ABSOLUTE
judgement stays a phone playtest. A table of six numbers overrode it anyway.

**What the harness was still right about**, because it is relative and relative is
what it is for:

- **Output does not track `dmgMult`.** Spam saturates at ~15,000-16,000 dmg/sec
  from encounter 2 on while `dmgMult` climbs 2.6 -> 14.5: cadence, ammo and
  reload bind long before damage does. So hp never had to chase the upgrade curve.
- **The hp CURVE was about right.** Player dps grows 1.9x (patient) to 2.2x
  (spam) across the six rungs against a curve growing 1.75x, so `bossHpStep`
  stays at 0.15. Only the base was ever wrong.

**`vanishHpFrac` is a fraction of `hpMax` and moves whenever the pool does.** At
300,000 its trigger became 30,000 damage in a 2s window, which no playstyle
reaches — VANISH would have retired itself and nothing would have failed. Check
it on any hp change.

### Three seeding lessons, all the same lesson

A measurement must vary ONE thing, and the ladder harness got it wrong twice
before it was right:

- seeded per REPEAT — three runs of one rung read 4.6s / 21.1s / 4.6s, a "348%
  spread" that was mostly three different players;
- seeded per ENCOUNTER — rung 3 drew 14 cards worth 3.4x damage while rung 2
  drew 9 worth 4.07x, so rung-to-rung comparison mixed hp scaling with build luck;
- seeded ONCE for the ladder — rung n's build is a true prefix of rung n+1's,
  which is what a run actually does.

It now asserts across repeats that the build did not vary, and prints
`** BUILD VARIED ACROSS RUNS **` if it ever does.

**Open, not started** — the user's call, not an oversight:

- **Trait multiplier tuning.** The sweep measured `armored+colossal` at 3.9x hp
  and 5.5x time-to-kill against the median loadout. The numbers exist; the tuning
  pass does not. Note the lesson above before sizing anything off the bot.
- **Per-move FX for the nemeses.** Scope was deliberately "Vader + shared
  foundations": they inherited the ownership fix and the new telegraphs but not
  their own effects. Now that Vader has bespoke ones, they are the generic half.
- **Campaign-mode Vader gets no scaling and no move kit at all** — the whole
  block in `spawnBoss` is inside `if (mode === 'endless' || opts.encounter)`.
  Real, and a separate decision.

**Watch:**

- **The dialogue card pauses Game and HUD**, so any harness that spawns a boss or
  a nemesis must load with `?nodlg=1` or it will hang for its whole cap. Eleven
  test files do. `smoke-dialogue` is the one that must NOT.
- **Three checks are load-sensitive**, all passing standalone and all capable of
  failing when the machine is busy: `smoke-readability`'s boomerang return (read
  207px against a 60px threshold immediately after a `npm run build`),
  `smoke-boss-moves`'s afterimage damage, and `smoke-flight`'s `avgArrivalFrac`.
  The thresholds are not the problem.
  **The signature is a DIFFERENT check failing each run.** Cleanest example yet,
  2026-08-14: `smoke-boss-moves` failed twice in one session on two unrelated
  checks — FORCE PUSH's dash-charge cost, then VANISH's relocation — and then
  passed 3/3 standalone on the branch *and* 3/3 standalone on baseline
  `17d77f2`. One code regression does not move between assertions like that. Note
  the baseline-standalone run alone proves nothing, because every one of these
  passes standalone; it is the *different check each time* that discriminates.
- **Fight length itself is noisy.** Encounter 1 measured 11.3 / 23.4 / 13.0s on
  an identical build — 93% spread with nothing varying but the fight. Read that
  ladder as a shape, never as six numbers.
- **Checking a deploy: use `curl`, not the MCP `actions_list` tool.** This entry
  used to say `api.github.com` is blocked by the proxy (403) and to use the MCP
  tools. It is the other way round now, measured 2026-08-14:
  `curl -s https://api.github.com/repos/Xletof/crix/commits/<sha>/check-runs`
  answers fine, while `mcp__github__actions_list` returns ~377,000 characters in
  one line and blows the token limit before you can read a conclusion.
- **Suite runtime** — ~15 minutes, long enough to be a problem in itself, and
  long enough that wrapping it in a shell `timeout` is tempting. **Do not
  under-size that timeout.** A 900s cap cut `run-all.mjs` off at 22 of 29 tests
  and the command still exited 0; the truncated log was briefly reported as a
  full pass. Give it 1500s+, and trust the final `N/N passed` line rather than
  the exit code.
- **Close-range spacing in the Vader fight** — standoff distance, the combo's
  step-in clamp and the slam knockback all interact, and it is the part most
  likely to need tuning by feel rather than by measurement.
- The cluster's total damage output (§5) against a full arena, and the music tier
  thresholds in `MUSIC.heat` — measured-correct, not yet tuned by ear.
