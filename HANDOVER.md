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
thing you had just done to him.

**He takes no knockback at all** (`Boss.damage` nulls the vector). Any
displacement drags him off a telegraph he is the origin of.

**Cadence numbers are measured, not guessed** — see the table in the
`attackCooldownMs` comment in `config.js`. The two systems block each other, so
tuning is zero-sum: the highest attacks-per-minute came from starving the
scripted moves.

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

## 11. State as of this handover

Everything is committed, pushed and deployed; `FRIX` is level with the dev
branch `claude/project-handover-ack-9ai0av`. `origin/main` is unrelated and
unused — Pages builds from `FRIX` only.

**Recently completed** (most recent first):

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
- **Fight length itself is noisy.** Encounter 1 measured 11.3 / 23.4 / 13.0s on
  an identical build — 93% spread with nothing varying but the fight. Read that
  ladder as a shape, never as six numbers.
- **`api.github.com` is blocked by the agent proxy (403).** Check deploy status
  through the GitHub MCP tools.
- **Suite runtime** — ~15 minutes, long enough to be a problem in itself.
- **Close-range spacing in the Vader fight** — standoff distance, the combo's
  step-in clamp and the slam knockback all interact, and it is the part most
  likely to need tuning by feel rather than by measurement.
- The cluster's total damage output (§5) against a full arena, and the music tier
  thresholds in `MUSIC.heat` — measured-correct, not yet tuned by ear.
