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
- **Dev branch:** `claude/vader-progression-hardness-uqn9o9` — this name changes
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

## 10a. VADER IS HUMAN-APPROVED AND FROZEN 🔒

**Handset review closed him out on `83dee24`.** Everything in sections 10b–10m
below is the record of how he was built; this section is the verdict on it.
He is not the experiment any more — he is the benchmark. Do not reopen him
because another polish opportunity exists.

| system | state |
|---|---|
| encounter ladder, hp, damage, composition | **frozen** — Vader 1 now reads as a complete Vader, later rungs escalate through composition and decision density, Vader 6 is the strongest, as intended |
| DEFLECTION, the parries, the stance, saber ownership | **frozen** |
| the returned super | **frozen** — 1080px/s, constant, no homing, 44px body, 620ms anticipation, **455 damage** |
| SUPPRESSION | **frozen** — 4000ms, blocks both Super paths and nothing else |
| FORCE PULL + DEFLECTION | **approved combination** — see 10k, do not separate them |
| VANISH | **approved** — the surprise and the reposition both work |
| LIGHTS OUT gameplay, cadence, state ownership | **frozen** — one owner, 2600ms active, 14,000ms post-darkness re-entry, BLACKOUT/ECLIPSE arbitration |
| the dark-arena material state and the secondary vignette | **frozen** |
| Afterimages / ECLIPSE | **frozen** |
| the saber emissive treatment | **approved** — reads as a local light source (10l) |
| the console/environment glow | **PLACEHOLDER** — see 10m |

**Do NOT tune his hp or his progression from bot fight duration.** The measuring
bot never dies and its dps is an uninterrupted ceiling; sizing his pool off it
once shipped a 300,000-hp boss that came back from the phone as "cannot even
dent it". Absolutes are a playtest, and this playtest is done. New numbers need
new human evidence.

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
  **300px/s** (405 after pass 3, below), no homing, aimed by a snapshot taken at
  release.
- **The orb's damage is bounded and has nothing to do with the player's
  scaling**: `superReturnBase 180 + 55 × pellets`, ceiling `620`. Five pellets =
  **455** against 1000 player hp. **455 IS THE DAMAGE; 620 IS ONLY THE CEILING**
  and it does not bind until eight pellets, which the game cannot produce.
  Reading `superReturnDamageMax` and reporting it as the delivered number is a
  mistake that has already been made once, off a frozen-values check whose label
  invited it; `smoke-vader` now derives 455 from the real config and asserts the
  ceiling is NOT reached, in two separately-named checks. It is a stated ceiling on damage, not a hidden
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

### The caught super has flight character now (pass 3)

Handset review of pass 2: DEFLECTION passes, do not redesign it. One weakness —
the held orb reads beautifully, and the moment it leaves his hand it becomes a
bright circle translating from A to B. So pass 3 touches the projectile's
CHARACTER and nothing else. Frozen and unchanged: the stance, its duration and
frequency, the parry vocabulary, ordinary reflection, the absorption rules, one
returned projectile, **455** damage for a five-pellet catch, the **44px** body,
snapshot aim, no homing, and the 620ms of anticipation.

- **405px/s, up from 300** (+35%, the reviewed trial value). Verified not to move
  the hitbox: `Bullet.fire` stretches a tracer by `clamp(speed / 620, 1, 2.2)`
  and 405/620 still clamps to exactly 1, so `scaleX` stays 1 and the body stays
  44px. Damage did NOT move to compensate. A 400px gap now closes in ~1.0s
  against a 380px/s walk and a 950px/s dash.
- **A launch beat**, `superLaunchMs` **110** — carved OUT of the 620ms window,
  not added to it. Over the final 110ms the held shell compresses 30% while its
  white core swells: an opposed pair, because a shell that shrinks on its own
  reads as fizzling out. A directional bias appears on the release bearing, and
  a white `burstDir` fires along it at launch.
- **The wake is three pooled ghosts wearing the orb's own texture**, at FIXED
  DISTANCES behind it (26/52/78px) along its REAL velocity, with falling scale
  and alpha. Distance, not sampled history: a history-based wake's length is a
  function of frame rate — tight at 60fps, strung out over 250px in the ~20fps
  harness, where it stops reading as a wake and reads as three separate objects.
  78px behind a 44px body is the whole claim; nothing here implies a lane.
- **An animated corona**: one `Graphics` redrawn per frame around a local origin
  — rotating jagged tongues, a counter-rotating inner arc, a packed nose on the
  leading edge, decaying trailing blobs and backward-sheared sparks. Four
  objects total for the whole effect (3 images + 1 graphics), created lazily and
  reused forever; nothing is allocated per frame and nothing accumulates.
- **`GameScene._tickSuperOrbs` is the single owner** of everything above, the
  same rule the saber follows. The generic hostile-bullet dot trail now skips
  `bossSuperOrbs` — it was a second, weaker statement about the same motion.
- **Held-state ownership verified in the running game, not reasoned about.** The
  rig shoves Vader 140px mid-hold and measures the orb against the anchor the
  draw code aims for: error stays ~15px through the shove and while he walks
  500px, i.e. one frame of intra-frame lag, not separation. Nothing changed.
- **Offense after the launch is deliberately NOT suppressed.** Measured at
  ~133ms with the orb still in the air — he asks the next question immediately,
  which is the anti-dead-air behaviour the handset review liked.
- **Arena floor grounding was investigated and deliberately omitted.** A moving
  light pool under a projectile is the same vocabulary this game uses for
  telegraphs and floor scars; the brief says omit on any ambiguity.
- `tests/smoke-deflect.mjs` is 40 checks now. `tests/evidence-superorb.mjs` is
  the new picture rig: it slows only the release beats, and its shutter lives
  INSIDE the game (a `postupdate` hook that pauses the scene on the qualifying
  frame) because a `page.evaluate` round trip is wider than the beat being
  photographed.

### The caught super is thrown, not floated (pass 4 — final orb pass)

Handset review of pass 3: DEFLECTION is approved and frozen; the wake, the held
orb, 455 damage, snapshot aim and the no-homing rule are all keepers. Two things
remained. At a flat 405px/s the player could **walk alongside the orb and escort
it** — base walk speed is 380 — and the orb's BODY still read as a bright circle
whose coordinates changed, with only the wake saying anything about motion.

- **Launch → settle → cruise.** *(SUPERSEDED — this model and its pass-5
  successor were both rejected on a handset; the orb travels at one constant
  1080 now. See "DEFLECTION IS FROZEN" below. Kept as the record of what was
  tried.)* `superReturnSpeed` is now the LAUNCH impulse (600), `superReturnCruise` (470) is what it keeps, and the excess bleeds over
  `superReturnSettleMs` (350) as `cruise + excess * (1 - u)^3`. Measured in
  flight: 600 → ~525 at 90ms → ~486 at 175ms → 470 by 350ms → 470 forever. It
  is an impulse being shed, **not** a deceleration: after the window nothing
  slows it, and nothing about it dims or shrinks while it settles. 470 is 1.24x
  the player's walk, so escorting it is out and getting off its line is in.
- **The lifetime contract changed.** It used to die at `superReturnRange` 1500,
  an inherited bullet number that ended flights mid-arena. It now flies until it
  hits the player, hits a wall (`handleBulletWallHits`), or leaves the world —
  an out-of-bounds sweep in `_tickSuperOrbs` at `world.bounds` + 120px. Range is
  a 6000px backstop (the arena diagonal is ~2263) and `superReturnMaxLifeMs`
  5000 is a defensive age cap nothing should reach.
- **The body has a front and a back now.** One `Graphics`, one owner: a compact
  bow shock on the ACTUAL velocity at ~1.06-1.3R that breathes rather than
  sitting there like a nose cone; three shell lobes on non-harmonic rates so
  consecutive frames genuinely differ; two counter-rotating internal arcs;
  seven tongues biased longer at the back and clipped at the front; three
  decaying rear blobs and shoulder sparks shearing outward.
  **`imp` (1 at launch → 0 at cruise) drives the DEFORMATION only** — never
  brightness or size, because the orb at cruise is exactly as dangerous as the
  orb at launch.
- **The sprite's scale is still never touched.** Its rotation is: it precesses
  by `sin(phase)*0.3` about the heading, which a circular body does not care
  about. Scale would have animated the hitbox with the envelope.
- **The held orb keeps its shape and gains restrained motion** — two drifting
  lobes, two orbiting arcs, five tongues collapsing and reforming — and during
  the launch beat it now grows the same bow shock it will wear in flight while
  its shell drags backward, so the launch is a transformation of that object
  rather than a substitution.
- **The wake is unchanged**: three pooled ghosts at 26/52/78px. It was checked
  at the new speeds and needed no adjustment.
- Still no floor treatment, for the pass-3 reason.
- `smoke-deflect` is 50 checks. The curve is asserted against the orb's own
  `_settleT` rather than wall time, so a ~20fps harness cannot make it lie.

### Pass 5 — the velocity sentence, the head, and one saber (final DEFLECTION pass)

Handset review of the whole fight approved the system and returned exactly three
findings. This pass is those three and nothing else; DEFLECTION is frozen after
it.

- **The speed transition was not perceptible.** *(SUPERSEDED — the replacement
  curve below was itself rejected as a concept in pass 6. Kept as the record.)*
  600 → 470 over 350ms as
  `(1-u)^3` measured 537 at 70ms and 478 at 210ms — two thirds of the excess
  gone before the eye had registered a launch, so it read as constant speed. It
  is now **650 → 500 over 550ms** with the excess shed as `1 - smoothstep(u)`,
  which is flat at both ends: it holds near launch for ~100ms, sheds visibly
  across the middle, and eases into cruise. Measured in flight:
  `137ms:627 · 250:585 · 368:538 · 502:503 · 550:500` and 500 thereafter,
  forever. Still an impulse being shed, not a deceleration; nothing dims or
  shrinks while it happens. 500 is 1.32x the player's 380 walk.
  **650 crosses `Bullet.fire`'s 620px/s tracer-stretch threshold for the first
  time**, so the release handler now cancels the stretch explicitly — without
  that the approved 44px hitbox would have grown 5%.
- **The bow shock was a parenthesis.** Two clean concentric crescents in front
  of the body read as a bright `)` stuck on a circle. Deleted — a circular arc
  IS a parenthesis however it is coloured. The leading edge is now made of the
  same material as the rest of the orb: a forward-biased hot core that drifts
  across the leading hemisphere, three unequal filled tongues (one dominant, two
  short, all sliding and swapping length), two ragged polylines of shell folding
  back over the shoulders, and small fragments peeling off the front into the
  wake. Reach is still bounded at ~1.35R, everything is keyed off the ACTUAL
  velocity, and no two consecutive frames photograph the same shape. The held
  orb's launch beat lost its matching arc for the same reason and grew the same
  tongues.
- **Vader could deflect with a saber he did not have.** Real bug, ~26-29s of the
  footage: SABER THROW sends `weaponSprite` across the room (`_saberAway`), the
  reflect clock came due mid-flight, and the guard opened anyway. The scheduler
  now separates DUE from ACTIVE — `_reflectPending` (owed) and `_reflectClaimed`
  (announced, blade reserved) — gated by one contract, `Boss.canOpenGuard()` =
  `hasSaber() && !isGuarding()`. The clock still resets at the due moment, so a
  deferral costs no cadence, and the tell goes up on the frame the blade is
  caught. The claim starts at the TELL rather than at the open, because nothing
  otherwise forbade a throw starting inside the 500ms warning. The inverse was
  already true and is now tested: `_castBossMove` refuses everything while
  guarding, so a throw cannot take the blade off an open stance.
  The audit behind `hasSaber()`: of the five scripted moves only SABER THROW
  dispossesses him. SABER COMBO, VANISH, CHARGE and OVERHEAD SLAM own the
  blade's ANIMATION, which `isGuarding` and `_performing` already arbitrate, and
  a parry is deliberately allowed inside them — it is a reflex, not an attack.
- `smoke-deflect` is **65 checks**. The curve is asserted in three bands across
  the settle plus a half-shed point past u=0.4, because start and end values
  passed on the rejected build. The ownership block fails 6 checks on `98da03f`
  (20 frames of guarding with the blade away, and a bolt genuinely parried by a
  weapon 500px from his hand). Evidence rigs:
  `tests/evidence-superorb.mjs` (case 5 = the settle frame by frame, then three
  consecutive cruise frames of the head) and
  `tests/evidence-saber-ownership.mjs`.

### Pass 6 — one speed, and he throws it (DEFLECTION frozen here)

Handset review approved everything from pass 5 and returned two last changes.

- **The whole launch → settle → cruise concept is gone.** Not retuned — the
  finding was that the falloff has no work to do. All of the fairness is spent
  before the orb exists: the DEFLECTION warning, the visible stored energy, the
  620ms of release anticipation, the silhouette, the snapshot aim and no homing.
  A projectile that slows down afterwards is softening a punish the player
  already had every chance to avoid. It now travels at **`PLAYER.superSpeed`
  (1080)**, referenced from the constant rather than copied, constant from
  release until it hits something or leaves the world. Measured in flight:
  1080 on every sampled frame of every case. The selection rule was the
  semantics — an ordinary deflection preserves the incoming bolt's real speed,
  so `PLAYER.pelletSpeed` (900) is the floor, and the energy actually being
  handed back is a super, so its own speed is the right one. `_settleT` and
  `_impulse` are deleted; the head's amplitude rides on `_ageMs` now, which is
  a VISUAL launch-freshness driver and nothing else. 1080 is 1.74x over
  `Bullet.fire`'s 620 tracer-stretch threshold, so cancelling that stretch (the
  pass-5 fix that saved 5% of the hitbox) is now saving 74% of it.
- **He physically throws it.** The old sequence was absorb → hold → the orb
  acquires velocity while he stands there; handset footage caught an accidental
  frame where an ordinary parry sweep coincided with a release and reported it
  read far better. So the last **260ms** of the unchanged 620ms anticipation is
  now a dedicated power sweep: the blade settles up and off the throw line,
  drives back down through it on an accelerating curve, and the orb leaves on
  the power frame. **200ms** of follow-through after that is the last of his
  saber ownership — offense is eligible the frame it ends, with the orb still
  crossing the room. `superSwingPose(dir, u)` is the pure curve (`u = 1` is the
  launch), `superSwing()` derives the phase from `_releaseT`/`_followT`, and
  `fx.saberSweep` — his own existing crescent, no new pool — fires on the same
  handler as the launch.
  Two mirrored sweeps, not a second eight-family registry: whichever way he
  throws, the blade winds up above the line and chops down through it.
  **The release clock had to move.** It was ticked in `_tickMechanics`, which
  runs after the weapon block, so the blade was drawn from a one-frame-stale
  phase — 90 degrees of error at 20fps, and on the launch frame the orb left
  while the blade was still short of the line. It is `_tickSuperRelease` now,
  called immediately before the block that draws the saber.
  The sweep branch sits FIRST in the weapon block: an ordinary bolt arriving
  mid-throw is still deflected for real, but its gesture defers. A blade already
  sweeping through the throw line is an honest contact motion for a bolt coming
  from the player, who is on that line.
- `smoke-deflect` is **73 checks**. The curve bands are replaced by constant-speed
  checks (every frame within 3px/s of `PLAYER.superSpeed`, and first third vs
  last third within 2px/s, so a curve sampled inside one band cannot pass), plus
  a new section 4c that runs the whole throw on two opposite bearings and
  asserts the sweep ran, the launch sat on the power frame, the blade was
  travelling fastest there, the two bearings mirror, the live blade equals
  `superSwingPose`, one saber only, nothing can seize it mid-gesture, and
  offense returns within a frame of the follow-through.
  Evidence: `tests/evidence-superorb.mjs` case 5 (beats 1-8, gesture in 4x slow
  motion, flight at full speed), case 6 (the same throw at the real clock across
  consecutive frames) and case 7 (beat 9 — off the guard with the orb still
  flying, which needs the real clock because a slowed 800ms follow-through
  outlives the flight).

### DEFLECTION IS FROZEN — human handset verdict on `6b98bbc`

**Read this before touching anything in the three passes above.** A human played
a full natural Vader fight — not a staged diagnostic — and approved the whole
mechanic. It is closed. `6b98bbc` is the approved gameplay checkpoint for it,
and unless the repository has legitimately advanced past that commit, it is the
build any future DEFLECTION question should be asked against.

**The locked contract.**

*Ordinary fire:* the temporary stance; visible directional parries; the returned
shot keeps the player's own red identity and its true incoming speed; aimed back
at the player at parry time; no homing; existing returned-bolt damage; melee
still a valid answer through the guard.

*The super:* pellets are absorbed rather than reflected individually; ONE
accumulated projectile comes back; Vader visibly contains the energy first; a
dedicated saber power sweep physically authors the launch; the orb leaves on the
sweep's power frame; **speed is `PLAYER.superSpeed` = 1080px/s, constant** — no
launch/cruise split, no acceleration, no deceleration, no falloff; snapshot aim;
no homing; 455 damage for a full five-pellet absorption; 44px radius; the
current 620ms anticipation; the current body, corona and rear deformation; the
current three pooled wake ghosts; the lifetime contract of collision / wall /
world exit with defensive cleanup; and Vader resumes offense after the
follow-through rather than waiting for the orb to land.

*Saber ownership:* one saber, one owner. SABER THROW can make DEFLECTION
**pending**, but DEFLECTION may not begin until the blade physically returns.
DEFLECTION claims the saber from its tell through the active guard, and SABER
THROW cannot steal it during that ownership. The super-return sweep owns the
saber only through its launch and follow-through; after that the projectile is
independent and boss offense resumes.

**The fairness rule, established by natural play rather than by argument.** In
one fight a returned super left the player at critical hp and read clearly as
the player's own mistake; a later one at similarly dangerous hp was avoided by
reacting to the tell and leaving the trajectory. That is the intended contract:
**too fast to race, fair enough to evade.** The player solves the attack before
or at launch, never by outrunning the orb afterwards. Any future proposal to
slow the orb down is a proposal to break this, and it has now been rejected
twice on a handset — see the speed trap in `CLAUDE.md` for the four models that
lost (a flat 300, a flat 405, 600->470 over 350ms, and 650->500 over 550ms).

**Do not tune further.** Not the 1080 speed, the 455 damage, the 44px radius,
the 620ms anticipation, the 2400ms stance, the 9s cadence at its current
progression level, the parry families, the power sweep, the orb visuals, the
wake, super absorption, ordinary reflections, or the ownership behaviour. Do
not chase small theoretical seams either — the known one is that the orb detaches
from Vader's hand rather than from the blade itself, 40-80px apart at the power
frame, and the natural handset result beats theoretical perfection. Fix it only
if real play ever shows it.

**One thing that is NOT frozen.** DEFLECTION used to be `bossMechanics[2]`, so it
appeared from Vader #3 onward. That was the CURRENT PROGRESSION STATE, not a
design decision about the mechanic. **The progression pass below moved it to
encounter 1** and changed nothing else about it.

## 10g. The encounter ladder — Vader-3 brain, Vader-1 numbers

The gate after DEFLECTION. Human verdict from repeated handset play: later Vader
is substantially more fun — more behavioural richness, higher decision density,
less psychological dead air — and the first one reads like a tutorial version of
a boss the player only meets properly three encounters later. The target is
*Vader → angrier Vader → increasingly insane Vader*, never *incomplete Vader →
eventually the real boss*.

**Nothing in the fight itself changed.** No attack was added or removed, no FX,
no telegraph geometry, no hitbox, no animation, no DEFLECTION internals, no
player mechanic. This pass is availability, scheduling, cadence and the ladder
table.

### What the audit actually found, and it was not what anyone expected

| n | hp | mechanics carried | scripted rotation | cadence | damage |
|---|---|---|---|---|---|
| 1 | 60,000 | `guard` | throw / pull / push (+combo, +vanish) | 4800 / 1100·950·820 | flat |
| 2 | 69,000 | +`sunder` | identical | identical | flat |
| 3 | 78,000 | +`reflect` | identical | identical | flat |
| 4 | 87,000 | +`blackout` | identical | identical | flat |
| 5 | 96,000 | +`afterimages` | identical | identical | flat |
| 6 | 105,000 | +`disarm` | identical | identical | flat |

Three findings, all measured against the code rather than inferred from banners:

- **The rotation never widened, and never had.** `bossMovesFor` filtered on
  `m.minPhase <= phase || encounter >= 3`, and *every* move in `bossMoves.js` is
  `minPhase: 1` while `phase` is never below 1 — so the left side was
  unconditionally true and the encounter clause could not change a single
  result. It was dead the day it was written, and its docstring
  ("a later Vader opens with things the first one never had") was false.
  **Encounter 1 has always had the whole kit.** Looking for the gap here would
  have cost a round; the note is now in the function.
- **Vader's damage does not scale with the encounter at all** — not contact, not
  slam, not any move. That is *correct* and is now an asserted contract: a later
  Vader is harder because he asks more and harder questions, never because the
  same question costs more.
- **So the entire behavioural difference between Vader #1 and Vader #6 was the
  mechanic list** — and encounter 1's single mechanic, ELITE GUARD, fires
  **exactly once**, three grunts at t=900ms. Measured over a full fight with the
  encounter bot, encounter 1 produced **zero** mechanic firings; encounter 3
  produced seven. That is the "attack A → reset → attack B → reset" report,
  quantified.

### The new ladder

`ENDLESS.bossLadder` — an explicit table of what each rung ADDS, cumulative,
resolved by `bossMechanicsFor(n)` in `config.js` (one producer, called by
`spawnBoss` and by the tests, so a check cannot agree with a stale copy).

| n | adds | the question it introduces |
|---|---|---|
| 1 | `guard`, `sunder`, `reflect` | **complete Vader**: an escort, the floor, and shoot-or-close |
| 2 | `blackout` | the room stops being reliable |
| 3 | `afterimages` | the target stops being reliable |
| 4 | `disarm` | your loadout stops being reliable |
| 5 | `legion` | every phase break costs you the room |
| 6 | `eclipse` | and now they arrive together |

- **Why those three at rung 1.** SUNDERING SLAM is the densest clock in the fight
  (5.2s) and the single biggest filler of dead air; DEFLECTION is the *only*
  mechanic in the whole ladder that changes the player's **verb** rather than
  their positioning. Those two are "Vader-3 brain". They are pulled onto Vader-1
  hp and Vader-1 damage, both untouched.
- **`eclipse` is a composition rule, not an attack.** AFTERIMAGES now brings the
  blackout with it, so "which one is he" and "you cannot see" become one
  question instead of two that coincided by clock luck. Three lines, no new
  pool, no new draw.
- **`bossMechScale`** seasons the mechanic intervals ~18% by rung 6. Deliberately
  small: a late Vader already runs five or six independent clocks, and past a
  point tightening them overlaps telegraphs instead of adding decisions.
  **`reflect` is exempt** — at 0.82 a 2.4s stance every 7.4s is a third of the
  fight with ranged damage punished, which switches ranged play off rather than
  taxing it, and its 9s cadence is part of the frozen contract.

### Two scheduler bugs the dead-air audit turned up

- **A refused scripted-move cast burned the whole 4800ms interval.**
  `_castBossMove` returns null while his state machine is mid-charge, mid-slam or
  mid-spawn; only the *guard* refusal retried early. So a move clock falling
  inside a charge windup threw the cast away and waited a full interval — a
  scripted move silently skipped, at random, several times a fight. Every
  refusal now retries at 400ms. It cannot make him spammier: the cast still only
  lands when he is free, and `_moveT` resets to the full interval from the cast.
- **The exotic clocks opened a full interval in.** DISARM is a 15s clock, so the
  mechanic that *is* encounter 4 could not appear before the fight's fifteenth
  second — a rung a player can finish without ever meeting what defines it.
  `blackout` / `afterimages` / `disarm` now open at 55% of their interval,
  floored at 3s so nothing lands inside the arrival banner or the guard spawn.
  Cadence unchanged; only the first fire moves. SUNDER (already early) and
  DEFLECTION (frozen) keep full intervals.

### Measured, matched, before vs after

`tests/diag-encounter.mjs --mode vader` now records a **decision tape**: every
scripted move, every state-machine commitment and every mechanic firing, all off
events the game already emits. Dead air is the tape's own gaps minus a 1200ms
grace that *is* the punish window — a proxy, and honest about it: it cannot tell
a deliberate recovery from the scheduler losing a turn, only compare two builds
of the same fight. SUNDER gained a `boss-sunder` event for this; it was the one
mechanic that announced nothing, so it was the one nothing could count.

Patient policy, upgrades on, 2 runs per rung, same instrument both sides:

| | before | after |
|---|---|---|
| **enc 1** mechanics carried | `guard` | `guard, sunder, reflect` |
| **enc 1** mechanic firings in a fight | **0** | sunder×4, reflect×2, super caught ×1 |
| **enc 1** actions / min | 13.9 | 34.1 |
| **enc 1** distinct behaviours seen | 5 | 10 |
| **enc 1** dead air | **67%** | 44% |

Encounter 1's profile after the change is encounter 3's profile before it, on
encounter 1's hp and damage. That is the gate, stated as a measurement.

### Hardness: deliberately NOT changed, and why

`BOSS.hp` 60,000 and `ENDLESS.bossHpStep` 0.15 are untouched:
`hp(n) = 60000 × (1 + 0.15 × (n−1))` → 60,000 · 69,000 · 78,000 · 87,000 ·
96,000 · 105,000. Damage: flat at every rung, and now asserted.

**The open hardness question, and it is a phone question.** The matched runs
show late fights measuring *shorter* than early ones — encounter 6 at 12.2s
against encounter 3 at 36.3s — because the player's `dmgMult` climbs 1.7 → 14.5
across the ladder (8.5x) while hp climbs 1.75x. If that holds in the hand it
starves the late rungs of the time their own 10-16s clocks need to appear, which
would flatten exactly the escalation this pass built.

It was left alone on purpose. The bot is a dps CEILING that never dies (see the
long note above `BOSS.hp`), fight length here is documented at 93% spread on an
identical build, and the one time an hp number was set from this harness it
shipped a 300,000-hp Vader that came back from the phone as "cannot even dent
it". **`ENDLESS.bossHpStep` is the lever if the handset agrees.** Nothing else
should move first.

### Traps this pass leaves behind

- **`bossLadder` and `bossMechScale` must stay the same length.** A rung past
  the end of the scale falls back to 1.0 silently; `smoke-vader` asserts the
  lengths match.
- **A mechanic in `_mechanics` with a zero interval never fires.** The flag list
  and the clocks are two different things and the old count-based test passed on
  a build where they disagreed. Assert the clock.
- **Every rung must name an id that exists in the registry**, or the medal
  prints `undefined` and the rung gains nothing. Asserted.
- **`enterBossRoom` in `smoke-vader` pins the free-running clocks after reading
  them.** Encounter 3 used to stop at DEFLECTION and now reaches AFTERIMAGES, so
  a clock coming due inside a staged 500ms window adds clones to a count on some
  runs and not others.
- **The rung-1 banner names no mechanic on purpose.** A medal reading
  "SUNDERING SLAM" on the introduction frames the baseline kit as an upgrade
  over a more basic Vader the player never met.
- **A rig staged at encounter 3 now gets a busier Vader than it asked for.**
  `smoke-deflect` and `smoke-vader` both stage there, and encounter 3 used to
  stop at DEFLECTION — it now also carries AFTERIMAGES and LIGHTS OUT. Three
  extra bodies and the lights going out inside a frame-by-frame measurement is
  noise those rigs never had to survive, so both now pin the clocks they are not
  testing. **`smoke-deflect`'s section 4c is separately load-sensitive and always
  was**: its two gesture-size / handover-timing checks failed identically on the
  pre-ladder baseline on the same box. See `tests/README.md`.

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

## 10h. LIGHTS OUT and SUPPRESSION — two mechanics that were not telling the truth

> **SUPPRESSION below is current and frozen. The LIGHTS OUT half is superseded
> by §10i on AESTHETICS ONLY** — its diagnosis of the original bug and its
> measurements are still the record of why the mechanic was invisible; its
> player-tracking pocket was rejected on handset and replaced.


The ladder in §10g passed handset review: Vader 1 reads as a complete fight,
2 is a clean escalation, 4 adds real state complexity, 6 is the climax, and
late fights survive long enough in a human's hands for their mechanics to
appear. **Do not re-open the ladder, the hp, the damage or the cadence.** Two
mechanics on it were separately found to be lying to the player.

### LIGHTS OUT darkened everything except the fight

The mechanic always worked: the clock fired, the banner went up, the overlay's
alpha genuinely reached 1, and `smoke-vader` genuinely asserted it. What it did
not do was make the room darker anywhere the player was looking.

`boss-blackout` reused the vignette authored for the **persistent DARKNESS room
modifier**. Measured on one frozen frame at full strength, that gradient:

| distance from screen centre | darkening |
|---|---|
| centre 200px — where the fight is | **0%** |
| 300px ring | 4.8% |
| left/right screen edge | 13.7% |
| top / bottom of viewport | ~31% |
| corners | ~40% |

Its clear core is 158px and its ramp does not reach 0.45 until radius 572,
which on a 720x1280 portrait screen exists only off-screen. That is *correct*
for what it was written for — an ambient state you have a whole room to notice.
As a 2.6s event it cannot announce itself. The two bottom corners, its darkest
region, are covered by the touch joysticks, which are HUD chrome above the
overlay.

**`DARKNESS.ambient` is frozen as it is** — the room modifier keeps its look.
The boss event now has its own gradient, `DARKNESS.blackout`, and its own
overlay object. Measured on the same frozen frame, by distance **from the
player**:

| r | 0 | 100 | 150 | 200 | 250 | 300 | 400 | whole viewport |
|---|---|---|---|---|---|---|---|---|
| darkening | 0% | 4.6% | 17.4% | 32.6% | 51.4% | 64.8% | 82.1% | **65%** |

Three things about it that are not obvious:

- **The pocket tracks the player, not the middle of the display.** The overlay
  is `scrollFactor(0)` in the HUD scene, and the game camera **clamps at the
  arena bounds** — push into a corner of a 1600px arena and the camera stops
  while the player keeps walking, up to ~270px horizontally and ~508px
  vertically off screen centre. Harmless under a 158px core and a gentle ramp;
  fatal under a 90px core that is at 0.66 by 300px. Measured on the pre-change
  build the player sat **410px off screen centre** in an ordinary probe.
- **`pad` is one number doing two jobs, deliberately.** It is both the overlay
  texture's margin per axis and the cap on how far the pocket may drift, so the
  two cannot disagree — move a screen-sized image and you expose an undarkened
  strip down one side. It is the pass's one new persistent allocation: a
  1080x1920 canvas texture, created once.
- **The onset is a flicker, not a fade.** A 420ms ease is how a room dims; a
  room that loses power stutters and goes. Three tween links on the one image.

### DISARM took something the player was not using

Probed on the real event path, before and after `boss-disarm`: primary fire
returned true and spawned a bolt, the super returned true, melee and dash were
untouched, and in the cluster case the held weapon sprite **did not change at
all**. It removed `player.secondary` — an optional, ammo-limited pickup — while
the pistol the player actually fights with is infinite and was never touched.
With no secondary equipped it returned on its first line: no pickup, and **not
even its own banner**. Secondaries auto-unequip at zero ammo, so that was not a
rare state. The handset reaction was "did it even disarm me?", which was the
correct reading.

### SUPPRESSION is what replaced it

**The internal id is still `disarm`** — the event, the `bossLadder` entry and
`_disarmEvery` all keep their names so the ladder's references stay valid. Do
not re-derive the old behaviour from the id. The player-facing mechanic is
`SUPPRESSED`: both Super activation paths refuse for `PLAYER.suppressMs`
(4000) and **nothing else changes**.

| | during SUPPRESSED |
|---|---|
| primary fire | **usable** |
| movement, dash, aiming | **usable** |
| ranged Super | blocked |
| Broken Wings | blocked |
| super / melee charge | **kept** — a blocked attempt spends nothing |
| secondary weapon | not required, not taken, not dropped |

Four things that are load-bearing:

- **Primary fire is untouched on purpose.** There is no baseline melee in this
  game — Broken Wings is itself a Super — so taking the gun would leave the
  player nothing to do but run in circles until it came back.
- **The gate sits above the charge check** in `tryFireSuper`. Refusing after
  `superCharge = 0` would delete the meter every time a suppressed button was
  pressed, which is the one thing the mechanic must not do.
- **The gate sits above the `inCombo` branch** in `tryMeleeCombo`. Casts 2 and
  3 of a Broken Wings chain skip the meter check, so a gate placed with the
  `meleeReady` test leaves a mid-chain loophole: get one cast off, stay
  suppressed, keep swinging free.
- **It is a delta-ticked countdown on the Player, not a `delayedCall`.** The
  Player object is REUSED across lives — the revive path in `GameScene` puts
  the same one back on its feet — so a callback would be holding a reference to
  a life that has already ended. A field cannot outlive a scene, cannot fire
  into a restarted run, and cannot stack: a repeat activation just rewrites the
  number, which is also the "refresh, never stack" rule.

The HUD **reflects** the rule and does not create it: both buttons take their
not-ready texture plus a locked tint and alpha, and a blocked press pulses
them red. Tint and alpha only — **never scale** — because a touch widget's
scale is the player's own setting from Pause → CONTROLS.

### Why the tests did not catch either one

Both were covered, and both tests asserted the system instead of the
experience. `smoke-vader` checked that `overlay.alpha` rose — true on a
vignette that darkens the playfield by 0% and on one that blacks out the room.
The DISARM checks tested that the secondary was gone, that the pickup landed
outside the 90px magnet, and that collecting it restored the ammo: every one a
fact about **the item**, not one about the player's verbs. And one of them,
"disarming an unarmed player drops nothing", **certified the silent no-op as
correct behaviour** — the test that should have caught the hole signed it off.

They now assert the gradient the fight happens in, and every player verb.
Seventeen of the new checks fail against `3025efd`.

### Traps this pass leaves behind

- **A tween CHAIN is not a tween, and `killTweensOf` does not reliably reach
  into one.** The blackout's flicker holds its handle and stops it explicitly.
- **This harness renders a frame every ~190ms under load** — longer than the
  whole onset — so no wall-clock threshold can tell a hard cut from a soft
  ease. Measured, an in-page `await setTimeout(16)` loop returned ONE sample
  for a 260ms window. The onset is sampled from a `postupdate` hook and
  asserted in FRAMES: the first frame showing any darkening is already near
  full for a cut and still climbing for an ease, which discriminates at any
  frame rate.
- **A photograph of a boss room needs his attack clocks silenced.** Half a
  dozen shots of LIGHTS OUT came back as a full-screen red hurt-flash because
  Vader was mid-charge. And the camera LERPS at 0.22, so a rig that teleports
  the player must `centerOn` too — otherwise the shot catches the player
  outside their own sight radius while the camera catches up.
- **`refreshSuper` still writes `img.setScale(1.18)` and tweens `scale: 1`** on
  the super button — the touch-widget scale trap from `CLAUDE.md`, pre-existing
  and deliberately left alone by this pass. It silently resets a resized button
  to 100%. Not reintroduced anywhere new; worth fixing under a HUD pass.

## 10i. LIGHTS OUT, again — the room loses power

**§10h's version is superseded on aesthetics only.** It was mechanically
correct — 65% of the viewport genuinely darkened, measured — and the handset
review confirmed the original invisibility bug was solved. It was rejected for
what it *looked like*:

> obvious circular visibility mask / flashlight radius / videogame vignette

rather than "the room lost power". A 90px clear core with a 0.88 rim following
the player is a flashlight, and no amount of tuning that gradient changes what
it is. The identity had to move off the player and onto the arena.

### The state, and where it lives

`LIGHTS OUT` is now a **temporary alternate art direction for the room**. The
transformation is multiplicative tints on `GameScene.roomLayer` — the group
that holds the backdrop image, the floor-decal RenderTexture, the walls, the
cover consoles and the props, and holds nothing else.

**That choice is the whole design.** Combat lives outside `roomLayer`, so the
saber, both bullet pools, the telegraphs, the Force effects, the returned super
orb and both silhouettes are exempt *by construction* rather than by an
exemption list. An exemption list drifts when someone adds a sixth effect; a
layer cannot. `smoke-vader` asserts exactly this — that none of those five
objects is inside the tinted group.

Strength comes from `_loClass`, tagged on each object at creation in
`loadRoom`, and resolved against `LIGHTSOUT` in `config.js`:

| class | what | why that strength |
|---|---|---|
| `floor` | backdrop + decal RT | ambient light dies hardest; the baked strip lights ARE the ceiling lighting |
| `wall` | wall tiles | near-black silhouette, still navigable |
| `prop` | shuttle, pod, gantry | machinery keeps a little of itself and its own glows |
| `console` | cover terminals | **the islands of remaining power** — blue screen, LEDs, lit keyboard |

The console is deliberately five times lighter than the floor. A uniform
darkening would score them the same and the emissive hierarchy the whole mode
depends on would be gone with nothing failing.

### Three traps this cost a round each to find

- **A LIGHTER FLOOR TINT TURNS THE ROOM RED.** The Vader chamber's base is
  already `#0a0a0d`; the only *coloured* thing baked into its floor is the
  crimson strip lights and the dais ring. Anything gentle enough to spare them
  leaves a maroon room — and crimson is the danger colour. The saber, the SABER
  THROW lane and every telegraph are red, and they have to be the only red in
  the frame. Measured and rejected at `floor: 0x191e2b`.
- **`_sectorTint` IS AMBIENT LIGHT, and it is additive.** The endless
  per-sector colour wash is an ADD-blended screen-locked rectangle at depth
  9000, up to 0.20 alpha. Additive light above every room object cannot be
  tinted away from below, so a dark arena that leaves it running is a dark
  arena with the lights still on — at sector 30 it was a solid olive wash over
  a room that was supposed to be black. It drops to 0.03 with the room and is
  restored exactly.
- **A `TweenChain`'s config has no `onUpdate` to hand down to its links.** Set
  it on the chain and the scalar animates while nothing ever reads it. It
  photographed as a fully lit room half a second into an *accepted* LIGHTS OUT.
  It goes on every link.

### The vignette is seasoning now

`DARKNESS.blackout` was rewritten from a 90px pocket to broad soft edge
darkening: clear to 300px, 0.027 at 360, 0.33 at the corner. Because it is
broad it **no longer tracks the player** — the pad, the clamp and the per-frame
recentre in `HUD._trackBlackout` are gone. The tight pocket needed tracking
because the game camera clamps at the arena bounds; a vignette that is 0.03 at
the screen's mid-edges cannot strand anybody.

Measured A/B on one frozen frame, sector 30, overlay at full:

| | centre | 200px | 300px | mid-edge | corners | **viewport** |
|---|---|---|---|---|---|---|
| darker | 79% | 87% | 87% | 74–87% | 72–88% | **81%** |

Near-uniform, which is the point: a bubble would show a large centre-to-corner
spread. Compare §10h's version, whose whole identity was that spread.

## 10j. LIGHTS OUT is ONE global arena state

**There were two producers and no owner.** The standalone `blackout` mechanic
runs a clock on `Boss` (`_blackoutEvery`); ECLIPSE rode `boss-afterimages` on a
second, independent one. Both emitted `boss-blackout`, and that handler
unconditionally raised the overlay and armed its own turn-off.

At encounter 6, after `bossMechScale` 0.82, those clocks are 13.1s and 10.7s —
a request roughly every 5.9 seconds against a 2.6s event. Measured on a real
75-second Vader 6 fight on `577761e`:

| | old | now |
|---|---|---|
| activations in 75s | **13** | 5 |
| per minute | 10.3 | 4.0 |
| shortest gap between events | **297ms** | 13,950ms |
| lights re-raised while already on | **3** | 0 |

The handset word for that was "spammed", and it was right.

`GameScene.requestLightsOut(source)` is now the only way in:

```
off ──accepted──► active ──(blackoutMs)──► cooldown ──(lightsReentryMs)──► off
                    ▲                                       │
                    └───────────── pending request ─────────┘
```

- **Cooldown is measured from the END of darkness** (`lightsReentryMs`, 14000).
  The guarantee is about the normal-fight gap, not a period the event eats.
- **One pending request maximum.** ECLIPSE displaces a pending standalone
  BLACKOUT; a standalone BLACKOUT can never displace a pending ECLIPSE, so it
  cannot starve it.
- **Nothing extends an active darkness.** One event, one bounded lifetime.
- `lightsReentryMs` is deliberately NOT scaled by `bossMechScale` — it is the
  floor that keeps the transformation dramatic, so tightening it at rung 6
  would undo the thing it was added for. Same reasoning as `reflectEveryMs`.

**ECLIPSE's clones go with the darkness, not with the clock.** Spawning them
and then being refused the darkness fires the composition's body without its
identity — three clones in a lit room, which is AFTERIMAGES wearing the wrong
banner. `boss-afterimages` on an `_eclipse` Vader now asks the owner and spawns
nothing itself; `_beginLightsOut('eclipse')` spawns them.

**The consequence, stated plainly:** at encounter 6 *every* accepted activation
in the measured run was ECLIPSE, and standalone LIGHTS OUT never won a slot.
Clone cadence there drops from ~10.7s to ~16.7s. That is a real softening of
AFTERIMAGES at rung 6 and it was the deliberate price of ECLIPSE always being
truthful. Rungs 2–5 have no eclipse flag and are completely unchanged.

## 10k. FORCE PULL + DEFLECTION is an APPROVED combination

Recorded from a Vader 6 handset fight so no future pass "fixes" it:

> DEFLECTION makes careless shooting dangerous because shots return; FORCE PULL
> compromises normal repositioning; the player must actively dash laterally and
> fight the pull geometry rather than hold movement or keep firing.

The player's death inside this composition was judged **fair and readable**.
**Do not add an exclusion rule between them**, do not add scheduler logic that
keeps them apart, and do not soften either because they overlap. The combined
question is intentionally difficult and it is now part of the high-tier combat
language.

## 10l. The saber is a light source — LIGHTS OUT only

**Handset verdict on 10i/10j: the structure was approved and the art direction
was not finished.** The room genuinely loses power; nothing in it starts
*behaving* like a light. Vader reads as a black body holding a bright red line.
The arena cannot carry the rest of that yet — it has four consoles and one prop
— and that is the map overhaul's problem. The saber is independent of it.

**Architecture.** Two ADD-blended `Graphics` owned by `Boss`, the same technique
the held-super orb already uses. No shader, no post-processing, no light engine.

| layer | object | depth | what it is |
|---|---|---|---|
| 1 core | `weaponSprite` | `y ± 1` | the approved blade. **Unchanged.** |
| 2 tight bloom | `_saberBloom` | `blade − 0.01` | two capsules barely wider than the blade; makes it incandescent rather than outlined |
| 3 broad spill | `_saberHalo` | `boss.y + 0.5` | six capsules, widest faintest; reaches 2.9 half-thicknesses BACK past the emitter |
| 4 consoles | `_consoleGlow` | 3 | bounded prototype, blue, one Graphics for the room |

Layer 3 sits **above his body on purpose**: light leaves an emitter in every
direction, so it washes over his hand and near shoulder and his silhouette comes
back from the weapon's own light. That is the whole answer to "black body
holding a red line", and it is deliberately *not* a rim light drawn on him —
the brief forbade one and a rim light would survive the blade being thrown away.

**Driver.** `GameScene._darkMix.v`, the arena's own power-failure scalar. It
enters on the 140ms onset stutter and leaves on the 420ms restoration swell and
cannot drift out of phase with the event it belongs to. In normal light it is 0
and neither layer is drawn — the approved saber is untouched.

**Measured, one frozen frame at endless sector 30** (`docs/evidence/saber-glow/`,
matched A/B by hiding the two layers):

| region | Δ luminance | Δ red excess |
|---|---|---|
| the blade | +9.4 | +20.7 |
| darkness immediately around it | +4.0 | +8.8 |
| the wide neighbourhood | +1.3 | +2.9 |
| Vader's own body | +0.3 | +0.8 |
| far corner of the room | **0.00** | **0.00** |
| whole viewport | +0.28 | +0.6 |

The far corner reading exactly zero is the load-bearing one: it is a **local**
light, not a global exposure change, and it does not blow the frame out.

**Two things that cost a round each, both in `CLAUDE.md` as traps.** It runs on
`postupdate`, not `preUpdate`, because a TWEENED pose is a frame stale before
the tween manager steps and SABER THROW spins the blade ~25°/frame. And the
spill's capsules are alpha-ramped rather than even, because an even stack puts
the outermost rim on screen at full step strength and it photographs as a
legible ellipse around the blade.

**Afterimages are unchanged and were not touched.** Clones already carry
`weaponSprite.setVisible(false)` — they have no saber, so they get no glow, by
the contract that was already there. This does not create a new identification
rule; it strengthens an existing one, and the approved signals (threat ring, hp
bar, surviving a hit) are all still what they were.

## 10m. Future arenas are authored in TWO states

**Design doctrine for the environment/map overhaul. IMPLEMENTED for exactly one
arena — see §10n. Everything below is the doctrine; §10n is the proof.**

A polished arena should be authored as two compositions, not one composition
plus a filter:

1. **normal ambient power** — what the room looks like with the lights on;
2. **emergency power** — what is still lit when ambient light dies.

Arena art identifies which elements stay alive in state 2: console screens,
LEDs, machinery indicators, emergency strips, powered signage, door controls,
reactor elements, alarm lamps. LIGHTS OUT should *reveal that second
composition* rather than merely darken the first.

---

## 10n. THE ARENA PILOT — the Vader chamber, in two lighting states

**Status: SHIPPED AND AWAITING HANDSET REVIEW. Not frozen.** One arena only.
Nothing here has been propagated to the other three rooms and nothing should be
until the human has played it.

### Which arena

`ROOMS[3]`, `id: 'vader'`, VADER'S CHAMBER — 1600×1600, `src/data/rooms.js`.
Chosen because it is the room that already had to carry two lighting states,
and because the frozen Vader is the readability benchmark the new art has to
sit underneath.

### What was wrong with it — from the baseline evidence, not from memory

`docs/evidence/arena-pilot/before/`:

- **No large forms.** A flat hex deck edge to edge. The eye had nowhere to go
  and the room read as a texture the fight happened on top of, not as a place.
- **The strip lights were CRIMSON and full-width.** Four 1600px red lines
  across the world at `stripEvery: 520`. That is the danger colour spent on
  décor, in a room where the saber, the SABER THROW lane and every telegraph
  are red and are supposed to be the only red in frame.
- **Nothing was grounded.** The pod and the four consoles sat on the deck with
  no contact shadow and floated.
- **The perimeter was `bare`** — severe by emptiness, which photographs as
  unfinished. At the corners the band was a dark strip with one red line on it.
- **Emergency power had nothing to reveal.** The room went black and the saber
  carried the entire read.

### The three pieces

**1. Baked architecture — `drawArchitecture` in `pixelArt.js`.**
A vocabulary of floor forms painted into the backdrop canvas, driven by
`spec.floor.architecture`:

| tier | primitives |
|---|---|
| LARGE | `region`, `dais` |
| MEDIUM | `trench`, `rib`, `plate`, `inset`, `doorframe` |
| SMALL | `vent`, and `ground` (contact shadows) |

Drawn in list order, so small never lands under large. **Everything in the
vocabulary is FLAT or RECESSED and that is a hard constraint, not a style**: the
backdrop is one image, it can never enter `this.walls`, so nav, LOS and bullet
collision cannot see it — which means a primitive that drew a tall solid mass on
the open floor would be promising cover the room does not have. Machinery lives
in the perimeter band, where the world bounds already are.

Costs one canvas pass at room load and **zero objects and zero draw calls
afterwards**.

**2. Perimeter style `'chamber'`.**
A 320px rhythm of pilaster / recessed bay / machinery block, three values deep.
`bare` was severe by being empty; this is severe by repetition. Relief is kept
SHALLOW on purpose — the world bounds sit at the *outside* of this band, so the
player can stand on it (pre-existing, unchanged), and a wall that read as a tall
solid mass here would be lying about a collision.

**3. `src/systems/EnvLight.js` — the authored emissive layer.**
The real new system, and the answer to "emitters must feel like they emit".

- **Outside `roomLayer`, by design.** That group is the LIGHTS OUT tint's
  subject. A light inside it gets multiplied toward black, which is precisely
  what makes a baked-in screen stop being a light when the power fails.
- **Every source is EMITTER + SPILL, and the spill is shaped like the emitter.**
  `screen` → soft box biased downward; `strip` → long thin halo on the short
  axis only; `led` → compact dot and nothing more; `core` → the one kind where a
  radial pool is the truth.
- **Two independent intensities per source**, `normal` and `emergency`. The
  amber wall strips are `normal: 0` — dead while the chamber has power, alive
  only once the bus drops. **That is what makes state 2 a composition rather than
  a dimmer**, and `smoke-arena` fails if no source has that property.
- **Driven by one scalar**, `GameScene._applyDarkMix`'s `v`. The ambient
  collapses and the authored sources come up on the same clock.

**WHY TEXTURES, NOT GRAPHICS.** The first build drew each spill as a stack of
expanding filled rects with a ramped alpha — the saber halo's own construction,
which works at blade scale. At environment scale it failed: five concentric
rectangles over a 150px wash are five visible bands, and a wall screen
photographed as a television in a box. More steps would not have fixed it; a
stack of hard-edged shapes has edges. The falloff is baked into two 128×128
per-pixel textures instead. The box texture is **separable** (alpha = f(x)·f(y)),
which is what lets one square stretch to a 40×300 strip without the corners
going wrong. Consequence: `setPower` is N alpha writes and **nothing is
re-rasterised**.

### The placeholder

`LIGHTSOUT.consoleGlowAlpha` / `consoleGlowColor` / `consoleGlowRadius` and
`GameScene._drawConsoleGlow` are **GONE**, not retained beside their
replacement. Three structural problems:

- it existed *only in the dark*, so it was a blackout effect rather than a
  property of a powered object — a console is powered when the lights are on too;
- a radial pool is the wrong shape for a monitor, and every source got the same
  circle regardless of what it was;
- it could only ever find the four cover consoles.

`smoke-arena` fails if any of the three config keys or the method come back.

### What the pilot did NOT change, and one number it deliberately put back

`LIGHTSOUT.floor` / `.wall` / `.prop` / `.console` are **unchanged**. They were
raised during the pass (floor `0x12151f` → `0x2e3648`) and it does make the
dais, the nave and the wall bays readable as silhouettes in the dark — the
maroon trap that originally pinned them is genuinely gone, because the pilot
deck has no red in it at all.

They were **put back** because they came out of a handset verdict, `smoke-vader`
freezes them, and making architecture legible in the dark is exactly how
emergency power quietly becomes "the normal room, dimmer". If the handset review
says the chamber goes too black, **this is the number to move**, and
`docs/evidence/arena-pilot/ambient-ab/` is the matched pair at both settings.

### The readability rules the pilot holds itself to

- **Environment light draws at depth 3** (`ENV_LIGHT_DEPTH`), above the floor
  decals and below the actor band. It therefore *cannot* draw over a bullet, a
  telegraph, the saber or an actor. The gate is a depth constant, not taste.
  The polish pass added ONE exemption with its own proof — see §10o.
- **Nothing emissive stands on the fighting floor.** Every source is on the
  perimeter, on a cover console, or on the hero machine in the west aisle.
- **No red in the environment.** Screens are cyan, machinery cores and emergency
  strips are amber, thresholds are cool white, deck paint is steel.
- **No filled circle or ring on the deck.** The pilot briefly had a steel ring
  painted around the dais; it photographed as a thin bright circle centred on
  the boss, which is the shape and placement of a circle telegraph. The raised
  octagon draws that boundary in geometry instead.
- **The central floor stays calm.** Density is pushed to the aisles, the wall
  and the perimeter. Two structural ribs cross the deck and that is all.

### Performance

| | |
|---|---|
| new persistent objects | 48 ADD-blended Images (24 sources × emitter + spill), one room |
| new textures | 3, shared process-wide: two 128×128 RGBA falloffs + a 4×4 emitter face, ≈128KB total |
| new Graphics objects | 0 (the placeholder's one Graphics was removed) |
| per-frame work | **none** |
| at room creation | one extra canvas pass over the backdrop (architecture + grounding), and 48 image constructions |
| at LIGHTS OUT transitions | 48 alpha writes per changed scalar, guarded at 0.004; nothing is re-rasterised |

The backdrop texture itself is the same size it always was — the architecture is
painted into the canvas that already existed.

### How to actually look at it

**DEBUG → LOAD VADER CHAMBER → DEBUG → SPAWN VADER.** (Pause → DEBUG each time;
both buttons close the panel on purpose.)

`SPAWN VADER` alone **deliberately does not change rooms** — its contract is
"put Vader 340px from where I am standing", which is the right tool for looking
at his moves wherever you are. But a fresh endless run starts in the hangar and
the chamber is not reached until **sector 5**, so pressing it on its own shows
Vader in the old hangar art. That cost a live verification round.
`LOAD VADER CHAMBER` loads the room and stops; it never spawns a boss.

Naturally: sector 1 hangar → 2 corridor → 3 detention → 4 hangar → **5 VADER'S
CHAMBER**. That routing is unchanged by the debug button.

### Evidence

- `docs/evidence/arena-pilot/before/` — baseline, 23 frames
- `docs/evidence/arena-pilot/after/` — matched, same camera stations. **This is
  now also the BEFORE of the polish pass** (§10o), because it is the build the
  handset verdict was given on.
- `docs/evidence/arena-pilot/polish-after/` — the same stations after §10o
- `docs/evidence/arena-pilot/ambient-ab/` — the one open question above

The stations are `centre`, `dais-north`, `south-gate`, `corner-nw`,
`corner-se`, `edge-west`, `console-ne` in both states, plus saber / bolt /
telegraph combat frames in both states, the outage transition, ECLIPSE, and one
frame with the endless sector wash left on. Re-shoot with
`node tests/shot-arena-pilot.mjs <tag>`.

**The endless `_sectorTint` is not the arena.** It is an ADD-blended
screen-locked rectangle at depth 9000 up to 0.20 alpha, and at sector 30 it puts
a solid olive film over every pixel. The station shots turn it off so they
photograph the room; `normal-sector-wash` keeps it so the sheet is not lying.

### What protects it

`tests/smoke-arena.mjs`. Eight groups: gameplay geometry frozen as literals,
nothing painted became a physics body, the emissive layer is outside `roomLayer`
and has no bodies and is entirely ADD at one depth, the power state restores
exactly (through `_restoreArenaTints` *and* `_clearLightsOut`), nothing leaks
across three room loads, the placeholder is gone not duplicated, the darkness
clocks and owner are untouched, and the frozen saber glow constants are
untouched. **A/B'd against `1b837d0`: 13 checks fail on the old build and the
geometry / saber / clock checks pass on it, which is what makes them worth
having.**

## 10o. THE ARENA PILOT, POLISH PASS — the hero machine

**Handset review of §10n passed the pilot** and asked for one bounded polish
pass before anyone decides whether this visual language scales. What passed:
the large/medium/small hierarchy, combat readability, the calm centre, the
trench frequency, LIGHTS OUT gameplay, the saber's integration, and the fact
that the room now reads as an interior. What did not: the big round prop looked
placeholder-like, some lights read as bright objects rather than as machinery,
the room had no hero landmark, and the perimeter read as procedurally repeated.

This section is the record of that pass. **It is still a pilot. Nothing here is
frozen and none of it has been propagated to the other three arenas.**

### The hero machine

`paintMeditationPod` in `pixelArt.js` — the chamber's one prop, at (340, 740),
bottom-centre origin, 352×328, so it occupies world x 164..516, y 412..740 with
its housing centre at world (340, 572). **Position, footprint and the 220×120
body are unchanged**; every number above is derived from the sprite at load, and
the evidence rig's camera stations are derived from them too.

Three decisions carry it:

1. **The interior is rectilinear.** Concentric rings inside a circle with radial
   spokes across them is a *dial*, which is where a large round object lands by
   default and is a different flavour of the same "circular UI widget" problem.
   So the circle is only the HOUSING. What sits in its well is a rectangular
   plant block: two overlapping plates, a recessed maintenance hatch with catch
   bolts on the west one, a control bank on the east one.
2. **The seams are uneven.** Five radial seams across the housing ring at
   irregular bearings, not six at 60°, and the widest unbroken plate is
   deliberate — an unbroken face is what makes the broken ones read as joins.
   Three mounting brackets straddle the rim onto the deck at bearings that are
   also not evenly spaced.
3. **Nothing bright is painted on.** The old lid carried one large illustrative
   crescent, which could only ever be an illustration: it lived in a texture
   that LIGHTS OUT multiplies toward black. Every emissive is in the two ADD
   faces below instead.

Material hierarchy: a new `PAL.chMachDark` (`#101319`) is the housing body, with
`chMach` as a narrow twelve-row cap on its north face and one-pixel rims — a
joint, not a highlight. The well is `chSink` with a **lit south inner wall**
(light comes from the north in this game, so a recess catches it on the far
side; inverted, a hole reads as a dome). The first build filled the whole
northern half with the lit tone and the machine photographed as a pale grey
donut, *lighter than the deck it stands on*, which is the opposite of a heavy
object.

**The control bank replaces the red mark.** The old centre was a red horizontal
bar over a red vertical one — literally a lowercase "i", and it read as a HUD
icon. It is now an inset panel with four pieces of believable machine
information and nothing decorative: a dark-glass status display with three data
lines, a recessed two-by-four button cluster, a six-tick segmented readout, and
a lamp row. Two lamps are `chVeridian`; **one logical pixel is `chWarn`**, and
that fault lamp is the only red anywhere in the environment.

### Its light, and why it is allowed above depth 3

Two textures, `prop-pod-glow` and `prop-pod-emer`, painted with the prop in
`PreloadScene` so they can never drift out of registration with it. They reach
the scene through a new `EnvLight` kind, `face`: an ADD Image of an authored
texture, positioned and depth-derived from the live prop in `loadRoom` at
`img.depth + 1`.

**Why a face leaves `ENV_LIGHT_DEPTH`.** The rest of the layer sits at depth 3
so environment light can never draw over combat. A 352×328 opaque prop breaks
that arrangement in the other direction: at depth 3 a source on the prop's face
is drawn entirely *underneath* the object it is lighting, which is the same trap
that made the cover-console wash need a `reach` bigger than the console sprite.
The escape is bounded rather than open: **a face's rectangle is its prop's
rectangle, so the only pixels it can cover are pixels the prop is already
covering opaquely.** Anything a face could hide, the prop hid first.
`smoke-arena` measures that containment against the live prop's bounds rather
than trusting the comment.

The split is by **power state**, not by shape:

| | `prop-pod-glow` | `prop-pod-emer` |
|---|---|---|
| normal power | 0.55 | **0** |
| emergency | 1.00 | 0.95 |
| carries | cyan status display + its wash, two nominal lamps, three cyan tube segments | two amber tube segments, the live readout, the fault lamp |

That is the whole of §6 of the brief: at normal power the machine belongs to the
room; when the bus drops, its material body recedes with everything else and a
set of fixtures that **were not lit a second earlier** comes up.

**Emitter and spill, in two places.** The bright part and its local wash are
painted together in the face texture, in the prop's own space, because that is
the only place a spill can follow this geometry. What goes in the room's own
emissive list is the part of the light that lands on the **deck**: two `strip`
sources at the two arcs' bearings, just outside the housing rim where the prop
texture is transparent, rotated to each arc's tangent. Both carry
**`emitter: false`** — a spill with no source of its own, which is a thing
`EnvLight` did not previously allow and which has exactly one legitimate use.
Left on, the strip's crisp `TEX_FLAT` bar photographed as a second bright object
lying on the floor beside the machine.

### Why none of it reads as a telegraph

**The arcs are segmented.** Three short cyan tubes and two amber ones, cut as
grooves in the material and lit from inside, spanning about 84° of cyan and 56°
of amber on opposite rims — **under 40% of the circumference, in five pieces, at
two colours neither of which is red.** A single continuous lit arc was tried
first and is recorded here as rejected twice over: on the upper-left of a big
circle it re-created the exact illustrative crescent this pass exists to remove,
and a long unbroken arc on a large round object is where a ring starts reading
as a capture zone. Broken segments read as fixtures.

### Room asymmetry

`drawPerimeter`'s `chamber` style now gives each side a **job**, using the same
bay vocabulary at different densities plus a phase offset (0 / 124 / 208 / 62)
so no two adjacent walls resolve their rhythm at the same distance from a
corner:

| side | job | what it does |
|---|---|---|
| north | ceremonial | plain heavy header, **no ribs and no vents** — this wall is behind Vader and should be the quietest thing in that frame |
| west | service | densest: two pipe runs across each bay, a second vent stack, extra louvres |
| east | control | machinery block on **alternate** bays only; the others are shallow terminal recesses with one trim line |
| south | threshold | base rhythm plus a deep portal jamb on every second bay, so the entrance end reads as a row of doors |

The hero machine is on the **west**, not the north, because §4 of the brief
froze its position. So the room's landmark logic is: north is Vader's ground and
the dais, west is the machine and the service language, east is the control
side and is deliberately emptier, south is the way in.

### Medium-form enrichment

Seven baked items, all in the side aisles, all outboard of the service trenches
at x=512 and x=1048, **none on the nave**: a service apron south of the hero
machine (one plate, two recessed slots, a vent), one vertical brace in the
north-west, and a sparser control bay opposite (one plate, one narrow cabinet).
The asymmetry argument again — the west group is a machine being serviced, the
east group is emptier on purpose.

Two existing sources were promoted to LIGHTS OUT landmarks rather than new ones
added: the north-west door-control screen (emergency 0.62 → **0.88**, wider,
longer reach) and the south-east terminal core (0.40 → **0.72**). Their normal-
power figures barely move — **a landmark is something the dark reveals, not
something that shouts.**

### Performance

| | |
|---|---|
| new persistent objects | **+6** ADD Images (48 → 54): 2 prop faces, 2 spill-only strips, 1 new LED × 2 |
| new shared glow textures | **0** — still the same three, ≈128KB process-wide |
| new prop textures | 2 × 352×328 RGBA ≈ **924KB**, resident for the process |
| new baked primitives | 7 architecture items, plus a few `fillRect`s per perimeter bay |
| new Graphics objects | 0 |
| per-frame work | **none** |
| at LIGHTS OUT transitions | 54 alpha writes per changed scalar instead of 48; nothing re-rasterised |

The 924KB is the pass's real cost and it buys one thing: the faces are painted
on the prop's own 88×82 canvas, so their registration with it is structural
rather than arithmetic. Cropping them to their lit region would recover most of
it and would put a hand-computed origin offset between the light and the object
it belongs to. That is the trade, and it is the obvious saving if a phone ever
complains.

### Known remaining limitations — what still looks cheap

- **The cover consoles are still the old art.** Their emissive behaviour is
  fixed; the 28×28 sprite underneath is not, and next to the hero machine it now
  looks like what it is. A console redesign was explicitly out of scope.
- **The housing's lower half is uniform.** The north cap, the well wall and the
  brackets carry the volume read; below the equator the ring is one value.
- **The circle's edge is chunky** at scale 4. Consistent with the game's idiom,
  but it is the first thing you see at phone scale.
- **The endless sector wash still lifts the room** at high sectors (measured at
  sector 30: the graphite ladder compresses and the deck goes blue-grey). The
  machine stays readable and its cyan/amber survive, so it was **not** treated
  as a blocker — see §17 of the brief. It remains an open question for whoever
  owns endless colour grading, not for this pass.
- **`LIGHTSOUT.floor`/`.wall`/`.prop`/`.console` are still the handset's
  numbers** — unchanged again in this pass, for the reasons in §10n.

### Evidence

- `docs/evidence/arena-pilot/hero-before/` and `hero-after/` — 22 matched frames
  each, dedicated to the machine: `hero-close`, `hero-mid`, `room-wide`, a
  three-frame camera pan past it, and Vader / SABER THROW / bolts / telegraph
  beside it, all in both power states, plus both sector-wash frames.
  Re-shoot with `node tests/shot-hero-machine.mjs <tag>`.
- `docs/evidence/arena-pilot/polish-after/` — the §10n station sheet re-shot.
- `docs/evidence/arena-pilot/after/` is the BEFORE for the wide stations.

### What protects it

`smoke-arena.mjs` gained four groups on top of §10n's eight:

- **Face containment.** Two faces exist, each sits directly on top of a
  `prop-pod` at that prop's depth + 1, is ADD-blended, and its bounds are inside
  the prop's bounds. This is what makes the depth-3 exemption safe.
- **The other three arenas opt out.** Each non-boss room is loaded for real and
  must show zero emissive parts, zero additive environment objects, no
  `emissives`, no `floor.grounded`, no `architecture`, no prop `faces`, and not
  the `chamber` perimeter style. A shared painter that quietly defaults to on is
  exactly how one arena's language becomes four.
- **The machine has two states.** One face must be dead at normal power with a
  real emergency figure, and one must be lit at normal power.
- **No red in the environment.** Every authored source colour is channel-tested.
  **Amber is not red** — the first version of this check failed the emergency
  strips, which are the room's most deliberate colour. The separator is how far
  green falls: amber holds it near two thirds of red, danger red drops it under
  a third. The check self-tests against three known reds and three known
  non-reds in the same run, so a threshold that stops discriminating fails
  loudly instead of passing everything.

**Not a test, deliberately: the other three rooms' backdrops were proved
identical by PIXEL HASH, not by reading the diff.** `paintBackdrop`'s panel and
scorch passes call `Math.random`, so the composite cannot be hashed as-is; with
`Math.random` pinned to an LCG for the probe the hashes are stable across runs
and the A/B against `e2f56b3` is exact:

```
hangar     e178a7ff -> e178a7ff   identical
corridor   694185ac -> 694185ac   identical
detention  5f617db1 -> 5f617db1   identical
vader      a3df44ea -> 36b6b6b0   changed, intended
prop-pod   ccad2935 -> 2f2611a5   changed, intended
```

That stayed out of the suite on purpose: baking those hashes in would freeze the
other three arenas' art, and the point is that they are *unstyled*, not that
they are finished. The spec-field opt-out check above catches propagation
without holding anyone's future hangar pass hostage.

## 10p. THE ARENA PILOT, SHAPE PASS — facets, and a reusable console kit

**The pilot itself is settled.** Two handset reviews have now passed the
composition, the large/medium/small hierarchy, the room asymmetry, the calm
central floor, the trenches, the palette, the LIGHTS OUT darkness, the
emergency-power architecture, the saber emissive and combat readability. This
pass answers the last two things review named, and nothing else: the hero
machine's outer silhouette, and the console art the upgraded room exposed.

### The diagnosis, and why it is NOT a filtering problem

The hero prop read chunkier, softer and blurrier in motion than the walls, the
trenches, the consoles and Vader standing beside it. The tempting fix — a
smoother, higher-resolution, antialiased circle — is the wrong one twice over:
it would produce one unusually soft asset inside a deliberately pixelated game,
and it would not address the actual cause.

**The cause is that a large mathematical circle is the one form CRIX's
vocabulary cannot say.** Everything else in this game is hard surface: crisp
horizontals, crisp verticals, exact 45-degree cuts, layered plates. A circle's
edge lands somewhere different against the grid at every bearing, so its stair
pattern has no period, and a big one reads as a low-resolution approximation of
something else. Worse, a curved housing has to smear a light gradient around
itself, and a smeared gradient at this cadence is exactly what "blurry" meant.

The renderer was checked and left alone: `main.js` is already
`pixelArt: true, antialias: false, roundPixels: false`, which is correct — the
last of those is why camera motion glides instead of juddering. Nothing about
the prop was being softened by the engine.

### THE MACHINERY SHAPE DOCTRINE

> A large "round" industrial object should be built as a FACETED ANGULAR OUTER
> HOUSING containing SMALLER ROUNDED FORMS, whenever a big smooth pixel curve
> would clash with the rest of the game's hard-surface language.

This is not a ban on circles. Small circles and rings still render cleanly and
stay valid — the hero machine's own well is still a circle at r=25, and keeping
it is the point: angular housing → round cavity → rectangular equipment is a
better object than any one of those three alone.

### Twelve facets, not sixteen — and that was measured

`POD_SHELL` is twelve vertices, clockwise, in the 88x82 canvas. Every edge is
H, V, 1:1, 2:1 or 1:2, so every edge has an exact periodic stair cadence. No two
runs are the same length: four flats at four different widths (north 26, east
26, south 42, west 34), four unequal diagonals, one deliberately tiny two-step
bevel at the lower-left, and one long 45-degree cut up the north-west.

A SIXTEEN-FACET CANDIDATE WAS BUILT AND PHOTOGRAPHED at identical camera
stations, and is not in the tree. At handset scale its extra four planes are
about six pixels each, which is below the size at which a plane reads as a
plane: the silhouette drifted back toward a circle and took the crispness with
it, and its fixtures went back to reading as curved arcs.
`docs/evidence/arena-pilot/hero-shape/` is the matched pair.

### Three things the faceted shell cost a round each

- **A FACET NEEDS ITS OWN VALUE, NOT ITS OWN RIM.** The first build varied only
  the one-pixel edge treatment per plane and photographed as the same mushy
  ring. The read comes from filling each plane at a different tone: four
  values, north-lit, `ny > 0.85` lit / `> 0.35` mid / sides body / `< -0.35`
  dark. The mid tone (`PAL.chMachMid`) exists for this and nothing else. The
  lit tone stays rationed to the one 26px north flat, because a shell lit over
  half its area comes out lighter than the deck it stands on.
- **FILL BY NEAREST FACET, NOT BY WALKING EACH EDGE INWARD.** Walking an edge
  and stepping along its normal leaves holes on every diagonal — the plane
  bands, the fixture grooves and the brackets all came out as CHECKERBOARDS.
  `facetPoly().nearest(x, y)` answers "which plane owns this pixel" by
  perpendicular distance to each segment; it also gives clean straight mitres
  where two planes meet.
- **WALK A FACET AT 3x THE PIXEL RATE.** A 2:1 edge advances half a pixel per
  step on its minor axis, so a one-step-per-dominant-axis-pixel walk rounds two
  steps onto one pixel and skips the one between. `edge.steps` is
  `ceil(length * 3)` and every walk uses it. This is the same bug as the point
  above wearing different clothes, and it appeared three separate times.

### The fixtures follow the facets

`POD_CYAN` and `POD_AMBER` are `[edge index, t start, t end]` — facet
coordinates, read by the material painter (which cuts the groove) and by both
emissive faces (which light it), so a tube and its light cannot drift apart.
Three cyan on the upper-left planes, two amber on the lower-right ones,
different lengths, with gaps: together well under half the perimeter, on two
opposite arcs, in two colours. A continuous lit circumference on a large round
object is gameplay language — capture zone, boss radius, objective ring — and
that is the whole reason these are broken up and were broken up before.

**LOCAL CONTAMINATION IS A SECOND, WIDER, MUCH FAINTER BEAM.** Review found the
tubes read and the deck spill read, and the armour immediately around a fixture
caught almost nothing. Each fixture is now drawn twice: a tight core in the
groove at inset 3.5, and a beam four times as wide at 28% of the strength
pushed 5px INWARD along that facet's own normal, onto the plate behind it. That
second pass is what makes the light look embedded in the machine. It is
deliberately spent on the machine's own surface and NOT on a bigger floor halo,
which is the cheap way to fake the same thing and the thing that would start
competing with combat.

### The console kit

Three archetypes, one vocabulary, in `pixelArt.js`, with their emitter contract
in `src/data/consoleKit.js`:

| | archetype | for | in the pilot |
|---|---|---|---|
| A | `ch-con-ped-a` / `-b` | freestanding room console | 3 of the 4 cover pillars |
| B | `ch-con-wall` | doors, access points, wall status | **not placed** |
| C | `ch-con-heavy` | machinery rooms, boss chambers | the south-west pillar |

**VARIATION COMES FROM THE FACE, NOT THE SILHOUETTE.** Screen layout, button
arrangement, status lamps, one panel insert. Two consoles of the same archetype
must be recognisably the same product; that is the difference between a kit and
a pile. `conChassis`, `conScreen`, `conLines` and `conKeys` are shared by all
three, so the family resemblance is structural.

**EVERY ARCHETYPE IS 28x28 LOGICAL AT SCALE 4, exactly like the `bush` it
replaces, and that is a collision contract rather than a style rule.** Cover
bodies are frozen at 70x70 and feed the nav grid, the LOS rects and bullet
collision. A heavier console that was also physically wider would be art
promising cover the room does not have — the same trap as painting a solid mass
into the floor backdrop. Archetype C reads heavier through mass, value and
density inside the same footprint.

**ARCHETYPE B IS NOT PLACED.** The chamber's wall bays are painted by the
perimeter pass and its composition is frozen this round; adding wall panel
sprites would be adding environment decoration, which this pass is explicitly
not allowed to do. The archetype exists and `shot-console-kit.mjs` drops one in
FOR THE PHOTOGRAPH ONLY so the vocabulary can be judged whole.

**OPT-IN BY NAME, exactly like `emissives`.** A cover entry may carry a `tex`
and a spec may carry a `coverTex`; a spec that says neither gets `bush`. The kit
textures are painted for every room because textures are global and cheap, and
only a room that asks for an archetype receives one. That is what keeps this
one arena.

**THE CONSOLE'S LIGHT IS DERIVED FROM ITS ART.** `CONSOLE_KIT` declares each
luminous region in the sprite's own logical pixels — the same numbers the
painter used — and `loadRoom` converts them against the console's real
placement. A hand-written screen coordinate is one edit away from glowing where
a console used to be.

**NO RED SOURCES.** Each archetype paints a single-pixel fault lamp into its
texture; none is declared as light. Red is combat language, and a red LIGHT in
the environment is a different claim from a red pixel of hardware.

**RESTRAINT IN THE DARK.** Exactly one region in the kit — the heavy console's
secondary display — is dead at normal power and comes up on the emergency bus.
Nominal lamps do not get louder in the dark at all: a lamp that says "fine" has
no reason to shout, and every LED coming on is what makes a blackout read as a
light show.

### Placement, and one thing the room taught

The heavy console started on the NORTH-WEST pillar, because that is the one
standing with the hero machine. Photographed, it is half covered by the pod's
sprite: the prop sorts at depth 740 and the console at y+56 = 496. It moved to
the south-west pillar — still the room's technical side, and somewhere the
player can see it. **Positions, count and collision did not change**; only which
texture stands on each.

### Performance

| | |
|---|---|
| new persistent objects | +12 ADD Images (envParts 54 -> 66) |
| new shared glow textures | 0 |
| new console textures | 4 x 112x112 RGBA ~= 196KB |
| hero texture memory | unchanged — same 88x82 canvas, same three textures |
| new baked primitives | 0 (the shell replaced the circle in place) |
| per-frame work | none |
| LIGHTS OUT transition | 66 alpha writes per changed scalar instead of 54 |

The faceted shell costs slightly MORE work at paint time than `c.circle` — the
nearest-facet fill is O(pixels x facets) — and exactly nothing at runtime. It is
one canvas pass at preload.

Measured back-to-back on an idle container with the same probe, this build
against `09c485e` (headless, so the absolutes are the container, not a phone —
only the deltas mean anything):

| ms | before | after | after, 2nd run |
|---|---|---|---|
| frame median, normal | 65.2 | 66.9 | 67.3 |
| frame p95, normal | 90.2 | 76.5 | 80.7 |
| frame median, dark | 75.7 | 76.8 | 77.3 |
| frame p95, dark | 100.0 | 102.4 | 99.6 |
| room load | 62.3 | 57.5 | 50.8 |
| `setPower` | 0.1 | 0.1 | 0.2 |
| display list | 88 | 100 | 100 |

Flat within run-to-run noise. The normal p95 came out BETTER after, twice, which
is how you know the spread is the container and not the change.

### Known remaining limitations — what still looks cheap

- **The pedestal's top face is nearly featureless.** Two vent slots and a lit
  near edge; from directly above it is a grey lid.
- **Archetype B is unproven in situ.** It has been photographed standing on the
  deck, which is not where a wall panel goes.
- **The shell's south half is still the quiet half.** The service plate breaks
  the west side; below the well it is one plane and one plinth.
- **Only one console variant axis is used.** The kit supports screen, keys,
  lamps and a panel insert; the pilot spends two variants and stops.
- **The hero's three emissive textures are still ~924KB of mostly-transparent
  canvas.** Unchanged from 10o, and still the deliberate trade for structural
  registration.
- **`LIGHTSOUT.floor/.wall/.prop/.console` are still the handset's numbers.**
  Untouched again.

### Evidence

| | |
|---|---|
| shape candidates | `hero-shape/shape-12/` vs `hero-shape/shape-16/`, plus `compare-close.png` and `compare-lightsout.png` |
| hero machine, final | `shape-after/` (22 frames, matched station-for-station with `hero-after/`, which is now this pass's BEFORE) |
| console kit | `console-before/` vs `console-after/` (14 frames each, same stations) |
| room-wide | `shape-room-after/`, matched with `polish-after/` |

### What protects it

`smoke-arena.mjs` gained two more groups on top of 10n's eight and 10o's four:

- **The console kit.** Four archetypes exist; the chamber uses 2-3 distinct
  ones across its four frozen positions and none of them is off-kit; every
  archetype texture is the same size as `bush`; every placed console renders at
  that size, has a 70x70 body and is still tagged `console`. The derived light
  is checked too: at least eight sources, every one within 60px of a console,
  none of them danger red, at least one dead at normal power, and no `led`
  louder in the dark than at normal power.
- **The hero canvas and its faces are the same size.** 352x328 for all three.
  This is the check that catches a silhouette edit that changed the canvas and
  left the light behind.

Plus the cover FROZEN check was split: positions stay frozen literals,
textures are a separate and deliberately un-frozen question, and the other three
arenas are asserted to still be standing on `bush`.

**And again, not a test: the pixel-hash A/B against `09c485e`.** Same LCG-pinned
probe as 10o, run twice for stability first:

```
hangar     a5aace45 -> a5aace45   identical
corridor   22662abd -> 22662abd   identical
detention  2bf7fbce -> 2bf7fbce   identical
vader      223f86cc -> 223f86cc   IDENTICAL
bush       45afbba5 -> 45afbba5   identical
wall       ac1b5e85 -> ac1b5e85   identical
terminal   56a282e5 -> 56a282e5   identical
prop-pod   1f97aac5 -> 812894a5   changed, intended
```

The Vader backdrop coming back byte-identical is the strongest single piece of
evidence in this pass: the floor architecture AND the whole `chamber` perimeter
are baked into that one texture, so an unchanged hash is proof that the freeze
on the room's composition held. The only shared texture that moved is the hero
prop. `bush` is untouched, which is what the three unstyled arenas still stand
on.

## 10c. The narrative system
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
branch `claude/vader-progression-hardness-uqn9o9`. `origin/main` is unrelated and
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
