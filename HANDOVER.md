# Frix — project handover

Orientation for a session starting cold. Read `CLAUDE.md` first for the rules
that must not be broken; this file is the map.

Last verified against `3dcf45f` (2026-07-29). Everything below was read out of
the code at that commit, not remembered.

---

## 0. WHERE THINGS STAND — read this first

*Updated 2026-09-02 against `HEAD`, which is `origin/FRIX`. Pages builds only
from `FRIX`, so the live build IS this commit whenever the two agree — check
`git rev-parse HEAD origin/FRIX` rather than trusting a hash written here.*

### THE REACTOR JUNCTION IS FROZEN 🔒

Handset play of `68a76c4` **approved the whole room** — topology, crossing,
enemy flow, Vader navigation, normal power, emergency lane guidance, lane count
and intensity, central darkness, the amber reactor emissive stack, the
reactor/Vader colour hierarchy, the LIGHTS OUT composition, and the reactor
silhouette as good enough. **A full reactor migration is not needed and is
deferred indefinitely.** `§10w` is the freeze record and the four truths worth
carrying out of it; `§10s`/`§10t`/`§10u`/`§10v` are how it got there.

Do not reopen any part of the junction without NEW human play evidence.

### The arena ladder, and what each rung's verdict is

| room | art | topology | dark state | state |
|---|---|---|---|---|
| Vader Chamber (`boss`) | PASS | — | PASS | **FROZEN.** `§10n`, `§10p` |
| Hangar (`hangar`) | PASS | — | PASS | **FROZEN.** `§10q` |
| Reactor Junction (`corridor`) | PASS | PASS | PASS | **FROZEN.** `§10w` |
| Detention (`detention`) | PASS | PASS | see `§10aa` | **console faces with the human** |

Vader himself is frozen — see `CLAUDE.md`. So is DEFLECTION, so is LIGHTS OUT
globally.

### The fourth arena is with the human, ON ITS SECOND ROUND

Handset play of `2462592` **approved most of Detention** — topology, open
traversal, cover layout, normal power, the cell-block and processing-gate
concepts, combat readability and Vader's gameplay in it. One thing came back
rejected: *the room becomes too black and visually empty during LIGHTS OUT.
Combat remains very readable, but the environment loses too much identity.*

`§10y` is the bounded emergency-light refinement that answered it. Handset play
of `a88ee50` then approved everything in that pass and rejected one last thing
— *the hazes are cool, but the floor still feels dead* — which `§10z` answers
with nine flat surface reflections and no extra brightness. Handset play of
`77975da` approved the floor and found the last one: *the consoles read like a
dark box with a light installed behind it*, which was true — every
`CONSOLE_KIT` source is drawn at depth 3 UNDERNEATH a sprite that sorts at
`y + 56`. `§10aa` is the powered console face that answers it. `§10x` is the
original pass. The room is with the human for the consoles.

`§10x` is the Detention pass: the last unstyled arena, and the test of whether
CRIX has an environmental LANGUAGE rather than three one-off rooms. Its
gameplay geometry — bounds, walls, spawn, exit, gates, objectives, cover count
and positions — was frozen for the whole pass on purpose: no human play
evidence says anything is wrong with it, and mixing a level-design pass into an
art pass is how the junction's ring survived three sessions.

**To see it: DEBUG -> LOAD DETENTION BLOCK.** Without that button it is the
THIRD room of an endless run (`_arenaCycle` starts at 1: hangar -> junction ->
detention), which costs two full clears to reach.

What the human is testing THIS round: the powered console face, the haze
around it, the floor reflection under it, the dark centre, and the combat
hierarchy. Only after that do we decide whether the four-arena language is
mature enough to freeze.

### Two suite failures that are NOT regressions

Both re-run against earlier builds and fail identically there:

- `smoke-readability` fails its wind-up check with the IDENTICAL measurement —
  `forcepull 0px/s drift 45px` against a 40px bar. The speed is ZERO, so he is
  in fact planted; the drift allowance is simply tight. It runs in the Vader
  Chamber, which no arena pass has touched.
- `smoke-deflect` fails a different check on almost every run, on the baseline
  too. `tests/README.md` has the write-up.

The suite wants an idle machine, and the second browser can be your own
verification run. Do not chase any of these, and above all **do not modify
Vader because of them.**

---

## 1. What this is

**Frix** — a mobile-first, portrait, top-down twin-stick **wave-survival**
shooter. Brawl Stars-style controls, Star Wars / Death Star skin. Phaser 3.90 +
Vite, vanilla JS ES modules, no TypeScript, no framework.

- **Repo:** `Xletof/crix` — GitHub MCP tools are restricted to it
- **Live:** https://xletof.github.io/crix/
- **Dev branch:** `claude/death-star-visual-pilot-olbbqx` — this name changes
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

## 10q. THE SECOND ARENA — the Hangar, and whether any of this generalizes

The Vader chamber passed handset review. That answered "is this room good?" and
left the only question that actually matters unanswered: **is there an art
direction here, or one good room?** This section is the second proof point.

**The test was deliberately set up to be failable in two directions.** Build the
hangar out of the chamber's composition and it passes by copying — same floor
architecture, same freestanding hero machine, same wall rhythm, same cyan/amber
placement — and proves nothing. Build it far enough away and it stops belonging
to CRIX. What had to be reused is the RULES; what had to change is the SENTENCE.

### The two rooms, in one line each

| | VADER CHAMBER | HANGAR |
|---|---|---|
| what it is | enclosed technical containment | operational deployment deck |
| its axis | a NAVE running north to a dais | a LANE running west to an exit |
| its landmark | a freestanding 12-facet hero machine | a BLAST DOOR that is part of the wall |
| its deck | nave, aisles, trenches, 380x400 plates | apron, lane, staging bay, recessed TRACKS, 460x430 plates |
| its wall | pilaster / recess / machinery cabinet, 320px | truss column with a bracket foot / panelling, 400px |
| its palette | blue-shifted graphite, dark | neutral gunmetal, two steps lighter |
| its cover | four consoles | three consoles and five cargo modules |
| its dark state | containment machinery + technical consoles | door status, thresholds, one service bay, racking |
| its floor tiling | 120x105 | 160x140 |

`docs/evidence/arena-pilot/hangar-after/compare-arenas.png` is that table as one
photograph, and `compare-arenas-dark.png` is the same pair under LIGHTS OUT.

### What the baseline was

The old hangar was the last unstyled room in its worst light. Four **full-width
amber strip lights** every 260px — a ceiling fixture painted flat on the floor,
and the loudest thing in every frame. An olive-brown deck (`hangBase`) that
photographed as mud, with nothing in it a plate seam could be drawn against. Two
**150px painted circles** on the combat floor, which is the shape and placement
of a circle telegraph. Eight identical `bush` consoles. A `ribbed` perimeter that
is 26px of the same comb stamped 4 x 60 times — the "procedurally repeated"
verdict the chamber already took once. And in LIGHTS OUT: nothing at all, because
every light in the room was baked into a texture the darkness tints toward black.

### THE HERO LANDMARK IS PART OF THE WALL, AND THAT IS THE POINT

The single strongest piece of evidence that the language generalizes is that the
hangar's landmark is **not another hero machine**. It is a segmented blast door
set into the north wall: heavy jambs that out-mass the truss columns, eight
leaves with their own stiffener ribs, an interlocking meeting line, a header, a
hatched sill, and a control station bolted to the west jamb.

It is declared by the ROOM, not hardcoded in the painter —
`perimeter.features: [{ side, at, width, kind: 'blastdoor' }]` — and painted by
`drawWallFeature` in the band's own local space, inside the same clip the
doorway cuts use. A gate cut through the same stretch of wall still opens
through it.

**ITS MASS STAYS DARK.** Three short cool-white fixtures in housings painted for
them, two amber jamb status strips that are dead at normal power, and the door's
amber power head in the control station. Nothing outlines the structure: a lit
perimeter on an object that size is objective-marker language, and this room
already has a real objective marker in it.

The door is on the north wall, west of the north gate, directly in front of the
parked shuttle and at the head of the spur track. That is a sentence: things
come off the door, cross the apron, and get moved down the lane to the exit.

### THE WALL CONTROL PANEL IS VALIDATED IN CONTEXT

Archetype B existed, was photographed on a deck, and had never been mounted on
anything. Two are placed here — one in the blast door's control station, one on
the departure wall beside the exit — and three things had to be built for that
to be honest rather than a sprite parked near a wall:

- **`panelmount`**, the smallest wall feature there is: a bolted plate the room
  declares at the same `at` the panel stands on, so hardware and mounting cannot
  end up in different places.
- **`prop.depth`.** A wall-mounted object is not standing on the deck, so
  sorting it by its y lets it occlude a player hundreds of pixels away at the
  other edge of the room. These carry `depth: 6` — above the floor decals,
  below every actor.
- **`reach` 44 -> 58 on `ch-con-wall`.** The wash has to clear the 112px SPRITE
  or it is drawn entirely underneath the panel and the object reads as bright
  rather than as lighting the wall it is bolted to. The same arithmetic sizes
  every other screen in the kit; this was the one entry never tested against it.

They are **not solid**: no body, no nav cell, no LOS rect. That is the entire
licence for putting art in playable space, and `smoke-hangar` asserts it.

### THE COVER KIT GREW ONE FAMILY, AND IT IS NOT A CONSOLE

Eight terminals in a hangar is a control room with a shuttle in it. So the kit
gained **`paintCoverCrate`** — cargo modules, two variants (one tall, one
stacked and pushed off-centre) — built to the same contract as the consoles:

- **Identical 28x28 canvas.** Bodies are frozen at 70x70; a visually wider crate
  would be art promising cover the room does not have.
- **The same three-plane read** the console chassis uses, so a crate and a
  console side by side are lit by the same sun.
- **NO LIGHT AT ALL.** Crates are not in `CONSOLE_KIT`, so they contribute no
  emissive source. Five of the hangar's eight cover objects simply go out when
  the power does, and that is what keeps the dark state dark.

The one thing they do not share is the palette: hardware is gunmetal, freight is
PAINTED, and paint is how a hangar gets a warm note without spending any of the
emissive budget on one.

The console kit also gained **one bounded FACE variation**, `ch-con-ped-c`, the
deck / manifest terminal: same chassis, same footprint, a wide short display with
five list rows and a scan slot instead of a key block. You read this console; you
do not operate it.

**`ch-` is now the KIT's namespace, not the chamber's.** It is historical — the
kit was born there. Renaming it would touch a frozen room spec for no pixels, so
it stays, and this line is the note that says why.

### A CRATE IS NOT A TERMINAL — and the tint is derived, not listed

All cover used to be tagged `_loClass = 'console'`, the lightest LIGHTS OUT
material. On that tint the crates survived a blackout as pale boxes, brighter
than the machinery around them. The fix asks the KIT rather than a name list:

```js
con._loClass = (cp.tex && !CONSOLE_KIT[cp.tex]) ? 'prop' : 'console';
```

A cover texture that declares no light is unpowered mass. `bush` has no texture
key at all and stays a console, which is what keeps Corridor and Detention
exactly where they were.

Found in the same sweep: **the objective terminal was joining `roomLayer` with
no `_loClass` at all**, which silently drops an object into the generic
darkness strength. It is a powered, screen-lit thing and now takes the console
material. The chamber has no terminals, which is why the pilot never saw it.

### New shared vocabulary — and it is small on purpose

Four additions to shared painters, and every one of them is a PRIMITIVE another
room can use rather than a piece of this room:

- **`track`** (medium). The hangar's answer to the chamber's trench, and
  deliberately not the same object: a trench is a HOLE with a grate over it, a
  track is a pair of rails set FLUSH into the deck with sleepers between them.
  Both recessed, so neither can be mistaken for cover; different claims about
  what the room does. Its LENGTH is what makes it architecture — the 1320px
  east-west run IS the deployment axis.
- **`hatch`** (small). A bolted access plate let into the deck.
- **`region` gained `edge: 'h'`.** It seamed its vertical sides because the
  chamber's regions are all tall. A hangar's are WIDE, and a wide region seamed
  on its short sides draws its boundary where nobody looks.
- **`drawWallFeature`** — `blastdoor` and `panelmount`, above.

Plus a fifth thing that is not a primitive: **`hangar`, the perimeter style.**
Four sides, four jobs, phase offsets of 0 / 150 / 260 / 88 so no two adjacent
walls resolve their rhythm at the same distance from a corner. That is the
chamber's RULE with a different vocabulary — north LAUNCH (a deep header over
plain heavy panelling), west STOWAGE (racking, the densest side, and the side
the cargo faces), south SERVICE (pipe runs and an access-panel cluster), east
DEPARTURE (cleanest; alternate bays are a shallow threshold recess).

Band thickness is **116**, against the chamber's 80. It is art — the world
bounds are unchanged — and it buys the blast door a third more height. Note the
constraint it revealed: **the HUD's top bar covers the first ~20 world pixels of
a north wall as soon as the camera scrolls south**, so the door's fixture
housings sit UNDER the header rather than on it.

### The floor, and what it is allowed to say

`base` is now `hgDeck`, the DECK value, not a recess. The first build based the
floor on `hgRecess` and every authored region then read as a pale rectangle
painted onto a dark one; with the deck as the ground value the apron lifts off
it and the staging bay drops into it, which is what a region is for.

Three large forms and no more: the **launch apron** (lighter, wide, in front of
the door), the **deployment lane** (a broad band on the room's long axis — the
direction stated once at full width instead of thirty times in small markings),
and the **staging bay** (recessed, south-east). Three tracks at three lengths on
two axes. Three plates, LARGER and FEWER than the chamber's. Three hatches.

No landing-pad rings. No baked strip lights (`stripEvery: 0`). Deck paint is
AMBER here where the chamber's is steel, at 0.30 — a stain rather than a signal.

### Red discipline: two prop textures moved

The room's loudest non-combat reds were both in prop art that predates all of
this, and both are hangar-only:

- `paintCraneGantry`'s hazard banding was `PAL.stripRed` — seven crimson bars
  across the beam.
- `paintFuelDrum`'s label block was `PAL.stripRedGlow` — a 24x12 world-pixel
  panel of bright red, three times over.

Both are amber now. The exit door's `[ SEALED ]` bar is still red and stays
red: it is gameplay UI, not environment.

### LIGHTS OUT

**Nothing about the mechanic moved** — not the tint values, the vignette, the
timings, the 14s re-entry, the owner, or the state architecture. What the hangar
adds is a DIFFERENT COMPOSITION out of the same machinery, because its sources
are different systems: the two door status strips and the door's power head, the
exit threshold (much the strongest thing on the east wall once the ambient goes),
the two gate thresholds, one service screen and one machinery core on the south
wall, one segmented run on the west racking, and the two wall panels. Nominal
lamps do not get louder at all. Five of eight cover objects go dark.

### Performance — the number that actually moved

Measured back to back with `tests/diag-arena-perf.mjs` on an idle room, two runs
of the styled build against one of the baseline:

| | hangar BEFORE | hangar AFTER | AFTER run 2 | chamber (for scale) |
|---|---|---|---|---|
| room load | 45.6 ms | 47.9 | 49.0 | 54.8 |
| outage entry | 15.9 ms | 15.3 | 13.7 | 12.4 |
| EnvLight objects | 0 | 58 | 58 | 66 |
| display list | 52 | 115 | 115 | 102 |
| roomLayer | 16 | 18 | 18 | 7 |
| physics bodies | 13 | 13 | 13 | 5 |
| frame median, normal | 77.3 ms | 82.6 | 81.0 | 75.2 |
| frame p95, normal | 88.6 | 92.6 | 88.5 | 86.4 |
| frame median, dark | 88.6 | 90.2 | 91.5 | 89.6 |
| frame p95, dark | 113.0 | 105.0 | 107.8 | 107.3 |

**BE HONEST ABOUT THIS ONE.** The chamber's polish pass came out flat within
noise; this one does not quite. The normal-power median is consistently ~4-5%
higher across both runs, and the reason is not mysterious: the display list went
from 52 to 115 because an unlit room acquired 58 ADD-blended light objects and
two wall panels. That is the SAME cost the chamber already pays — 66 parts, and
it sits at 75.2ms with a far emptier `roomLayer` — so the architecture is not
degrading as it scales; the hangar simply had further to travel, because it
started with no authored light at all. The p95 figures overlap in both
directions and the dark state is unchanged.

**Steady-state per-frame environment work is still ZERO.** Nothing here ticks.
The backdrop is one baked 1600x1400 canvas (8.54MB, unchanged in size — the
whole floor composition and the entire `hangar` perimeter with its blast door
are painted into a texture that already existed), an outage is N alpha writes,
and `setPower` re-rasterises nothing. The texture cost added is three more
28x28-at-scale-4 kit sprites (`ch-con-ped-c`, `ch-crate-a`, `ch-crate-b`): the
cover kit went 196KB -> 343KB, shared by every room for the life of the process.
No new shared glow textures — still a constant 3.

### The test record, stated plainly

The full suite is **30/31**. The one failure is `smoke-deflect`'s "the blade is
travelling FASTEST as it arrives there", and it is NOT this pass: run four times
against `a639ea6` with `src/` stashed, it failed **three of the four**, at
u=0.314 / 0.333 / 1.392 against a `> 0.5` threshold. `peakStepU` is the phase of
the largest PER-FRAME angular step in a 260ms sweep, and at ~20fps that sweep is
about five frames — so which sample carries the biggest step measures the
harness's pacing, not the blade. `tests/README.md` has recorded it as a
suite-load flake since the DEFLECTION pass; this is the first time it has been
A/B'd against a stashed baseline, and the baseline loses too. `smoke-hangar`,
`smoke-arena`, `smoke-vader` (116) and `smoke-readability` (19) all pass.

### What protects it

`tests/smoke-hangar.mjs`, ten groups. Frozen geometry (bounds, the eight
post-`snapAll` cover positions, five prop bodies, spawn/exit/gates/terminals/
pickups/enemies); exactly 13 physics bodies and none of them a wall panel;
layer separation and no `face` exemption in this room; deterministic power
restore through an outage and through a room torn down mid-outage; no leak
across four room loads INCLUDING a round trip through the chamber; the footprint
contract on every kit texture; crates tagged `prop` and consoles tagged
`console`, derived from the kit; the amber-is-not-red channel test with its
self-test; `stripEvery === 0`; and a group that asserts the hangar is NOT the
chamber (different perimeter style, no hero-machine faces, no `dais` or
`trench`, and it must use `track` and `hatch`). Plus the chamber read back and
compared against frozen literals from the other side.

`smoke-arena` now knows there are TWO styled arenas. The hangar is allowed to
have authored light; Corridor and Detention must still build an EMPTY layer and
stand on `bush`.

### Other rooms — proved by pixels, not by reading the diff

Deterministic texture hash, `Math.random` pinned to an LCG, A/B against
`a639ea6` with `src/` stashed:

```
backdrop-hangar      1e7ef30c -> 896d83f6   CHANGED, intended
backdrop-corridor    fae9854a -> fae9854a   identical
backdrop-detention   d8bc6c25 -> d8bc6c25   identical
backdrop-vader       b43d73f1 -> b43d73f1   IDENTICAL
bush                 e8a7342d -> e8a7342d   identical
wall                 7fc0522d -> 7fc0522d   identical
terminal             cff28408 -> cff28408   identical
prop-pod             6fc1b4fb -> 6fc1b4fb   identical
prop-shuttle         429b7c45 -> 429b7c45   identical
prop-core            e0910f56 -> e0910f56   identical
prop-bunk            16c26154 -> 16c26154   identical
ch-con-ped-a         11428d65 -> 11428d65   identical
ch-con-ped-b         cdf55ce5 -> cdf55ce5   identical
ch-con-heavy         7cc99295 -> 7cc99295   identical
ch-con-wall          d3a22895 -> d3a22895   identical
prop-crane           edfafe1d -> 7f72be5d   CHANGED, intended (red -> amber)
prop-drum            351c7a6f -> 7039e8ef   CHANGED, intended (red -> amber)
```

The Vader chamber's backdrop coming back byte-identical is the load-bearing
line: its floor architecture and its entire `chamber` perimeter are baked into
that one texture, so an unchanged hash is proof the freeze held. The three
console archetypes it stands on are unchanged too.

**RESEED THE LCG BEFORE EVERY BACKDROP, NOT ONCE PER PAGE.** `paintBackdrop`
consumes `Math.random` for its panel and scorch scatter, and this pass changed
the hangar's `panels` and `scorch` COUNTS — so on the first attempt every
backdrop painted after the hangar drew from a different point in the stream and
all four rooms' hashes moved. It looked exactly like the pass had leaked into
three arenas it never touched.

Frozen-system diff (`git diff --stat` over `src/entities/`, `bossMoves.js`,
`config.js`, `MoveScript.js`, `Telegraph.js`, `actorMotion.js`, `EnvLight.js`)
is one file and seven lines: the `_loClass` tag on the objective terminal. Vader,
the player, the darkness owner and the light layer itself are untouched.

### Evidence

| | |
|---|---|
| `docs/evidence/arena-pilot/shuttle-before/` | 37 frames on `6b600e4` — five stations in both power states, a ten-frame pan in each, Vader beside the craft, the dark composition, plus `edge-cadence.json` |
| `docs/evidence/arena-pilot/shuttle-after/` | the same 37 on this build |
| `docs/evidence/arena-pilot/shuttle-candB/` | the rejected six-facet wing — three frames and its cadence measurement, kept as the record for the decision |
| `shuttle-normal-ab.png` | the strongest normal-power pair |
| `shuttle-dark-ab.png` | **the strongest LIGHTS OUT frame** — a shapeless dark triangle with one dim blue box, against a craft reconstructible from a canopy, four running lights and two amber docking indicators |
| `shuttle-pan-before.png` / `shuttle-pan-after.png` | **the moving-camera proof.** Three consecutive 14px steps, side by side |
| `shuttle-cand-compare.png` | old / A / B at the same station. **Compare the WING only** — B was photographed before a later nose-cone refinement, so its fuselage is a revision behind and only the facet count is the subject. |
| `shuttle-vader-ab.png` | **the combat-readability frame.** Saber, lane and telegraph over the craft |
| `shuttle-dark-composition.png` | **the Hangar-identity frame.** The same darkness with the blast door in shot and off screen |
| the texture-hash diff | `tests/out/` is gitignored; regenerate with `diag-texture-hash.mjs` per the recipe in its header. The result on this build is quoted above. |

The most concerning frame is `shuttle-after/normal-close.png`: at normal power
the canopy is two cyan bars on a dark box and reads more like a small screen
than like glass. It is restrained, which is what §11 asked for, but it is the
one fixture that has not found its shape.

### Remaining weaknesses — be candid

- **A north-wall landmark is 116px at the top of the screen.** The blast door
  reads well when the player is in the north half and is off-screen entirely
  when they are south of y≈800. That is inherent to a wall landmark in this
  camera, and it is the price of not building a second hero prop.
- **Archetype B still has only one silhouette.** Two are placed, both on
  mountings, both on different walls — but the family has three chassis and
  four faces, and the wall panel has none.
- **The crates read a little like pallets** at close range, because of the
  strapping bands over the pallet foot. At combat distance they read as freight.
- **The east wall is the emptiest thing in the room.** "Cleanest side" was the
  brief and the chamber's control wall made the same trade, but this one has a
  gate at each end and a door in the middle and not much between them.
- **`hgCrate` and the deck ladder are unreviewed numbers.** The crate palette
  was already darkened once from measurement; the rest has never been on a
  phone.
- **The environment language is NOT frozen.** This is the second proof point,
  not the last one. Corridor and Detention are untouched and stay that way.

## 10r. THE SHUTTLE — one legacy asset migrated into the language

Handset review passed the Hangar and named the one thing in it that had not
been rebuilt: the shuttle. Two complaints, and this pass is only those two.

**The craft looked wiggly, and that was measurable.** The old asset drew its
wing edges by advancing a float and rounding it — `outer = 10 + t * 1.15`,
`inner = 10 + t * 0.35`. Rounding 1.15 produces a staircase that steps one
pixel per row except at intervals where it steps two, and the intervals have no
period. Measured off the shipped texture: the doubles landed on the 4th row,
then the 7th, then the 7th, then the 6th, then the 5th. `smoke-hangar` counts
those lone deviations now — a SPIKE is one row that disagrees with both its
neighbours while they agree with each other — and the shipped craft had
**eleven** of them and changed slope **29** times per side. It read as crawl
because it was crawl, and it only started to matter once the room around it had
been rebuilt out of horizontals, verticals and 45-degree cuts.

**THE FIX IS SHAPE LANGUAGE, NOT FILTERING.** No antialiasing, no
`roundPixels`, no texture-filter change, no higher-resolution asset: the rest of
the game renders correctly, and one unusually smooth object inside a
deliberately pixelated game is a worse outcome than the crawl. Every edge on the
craft now comes from a section with a constant integer cadence:

| section | cadence | rows |
|---|---|---|
| nose cone | 1:1 | 4–10 |
| hull chamfers (×3) | 1:1 | 11–14, 25–28, 47–50 |
| hull plates (×4) | vertical | 15–24, 29–46, 51–76, 81–84 |
| stern chamfer | 1:1 | 77–80 |
| wing leading sweep | 2:1 | 25–40 |
| wing tip fillet | 1:1 | 41–42 |
| wing outboard rail | vertical | 43–58 |
| wing trailing cut | 3:1 | 59–68 |

Result: **0 spikes, 13 slope changes** per side, and every one of the 13 is a
facet boundary rather than a rounding artefact. The silhouette is preserved —
same 100x90 canvas at scale 4, same orientation, wingspan within a few logical
pixels, and the collision body (150x190 on the hull) untouched, so you still
walk under the wing.

**TWO CANDIDATES, AND THE MORE FACETED ONE LOST.** A six-facet wing was built
and photographed at matched stations (`docs/evidence/arena-pilot/shuttle-candB/`,
and `shuttle-cand-compare.png`). Breaking the leading sweep into 2:1 / 1:1 / 2:1
puts a kink halfway along the longest edge on the craft, and at handset scale
those planes are short enough that the eye re-reads them as one bowed line. It
also measured worse: 96 texture-row breaks against 88. This is the sixteen-facet
hero housing's lesson on a different shape — **more planes is not more
crispness**.

**THE VALUE LADDER WAS THE OTHER HALF OF THE PROBLEM.** The first rebuild
inherited the `imp*` family the old asset used, which tops out at `#7a7c80`, and
a 400x360 object painted from it photographed as a pale grey moth — lighter than
the deck it is parked on, which is the hero machine's trap exactly. The shuttle
has its own compressed ladder now, placed RELATIVE TO THE DECK (`hgDeck`
`#212328`): fuselage one step above it (`shHull` `#272a31`), wings one step
below it (`shWing` `#1c1e24`), and one trim value (`shTrim` `#454a54`) rationed
to a few pixels of fixture housing. A body carrying two dark planes, not one
pale mass.

Related, and it cost a round: **a one-pixel-per-row outline on a 2:1 edge is a
DOTTED line**, because the outer x jumps two pixels a row. The outline is
dilated from the silhouette itself now — every empty pixel touching the craft is
edge, and no facet has to know which one it is on.

**THE SECOND STATE.** During LIGHTS OUT the craft used to be a flat black hole
where the hangar's identity had been, and the hangar's other landmark — the
blast door — is bolted to one wall and off screen from half the room. It carries
two ADD faces now, the same contract as the hero machine's and for the opposite
reason (the machine got one because it IS the chamber's landmark; the shuttle
got one because losing it erases the room):

- `prop-shuttle-glow` — 0.42 normal, 0.92 emergency. The canopy at the nose, and
  **four running lights and that is the whole set**: two wingtips and two stern
  shoulders. Those are the four corners of the craft, which is both where a
  running light belongs and the minimum set that reconstructs a silhouette from
  nothing.
- `prop-shuttle-emer` — **0 at normal power**, 0.85 under emergency. The docking
  collar and the port service hatch, in amber. That texture is the whole
  difference between "the shuttle is still there, dimmer" and "the umbilical bus
  came up".

**NO OUTLINE, AND THE FACE IS CLIPPED TO THE HULL TO GUARANTEE IT.** A glowing
wing perimeter would flatten the craft into a gameplay marker and delete the
darkness it is standing in. Each fixture is a tight core plus a much wider, much
fainter wash — the plate catching the light — and the whole face is then punched
through the craft's own silhouette, so contamination reads as light ON the hull
and stops at its edge instead of throwing a halo onto the deck. That clip cost a
round on its own: **`destination-in` composites the WHOLE canvas against the
source of that single operation**, so a mask drawn as one `fillRect` per row
erases everything except the last row, and the first build of the face came back
with no lights on it at all. One `beginPath`, N `rect`s, one `fill`.

**Red is gone from the craft.** The old wingtips carried a `ledRed` pixel each —
32 saturated-red texture pixels in a room where red is the saber, the SABER
THROW lane and the telegraphs. `smoke-hangar` scans the texture now.

### What this proves, and what it does not

The generalizable rule is **not** "spacecraft get running lights". It is two
things, both stated in `CLAUDE.md`:

- a long shallow diagonal on a large pixel-art silhouette needs an intentional
  repeated slope cadence, because camera movement exposes an arbitrary one;
- a large identity prop should participate in the room's two-state composition
  when its disappearance would erase the arena's identity.

### The numbers

| | before | after |
|---|---|---|
| silhouette spikes / side | 11 | **0** |
| slope changes / side | 29 | **13** |
| saturated-red pixels | 32 | **0** |
| physics bodies in the room | 13 | 13 |
| emissive parts | 58 | 60 |
| display list | 113 | 116 |
| textures | 1 (400x360) | 3 (400x360) |
| texture memory | 0.55 MB | 1.65 MB |
| room load | 92.7 ms | 62.6 / 61.9 ms |
| frame median, normal | 98.4 | 99.3 / 98.5 |
| frame median, dark | 108.8 | 115.9 / 115.6 |

The frame numbers are two samples on a shared headless machine whose spread
across identical builds has been measured at 20ms on this same room, so the
honest reading is **no measurable cost**; the load figure moving the wrong way
by 30ms is that same noise. What is real is +2 emissive parts, +3 display-list
objects, +1.10MB of texture, and **zero** new physics bodies.

### Frozen, and proved by pixels

`tests/diag-texture-hash.mjs` hashes all 85 generated textures plus one
deterministically-seeded backdrop per room. Between `6b600e4` and this build the
diff is three lines: `prop-shuttle` changed, `prop-shuttle-glow` and
`prop-shuttle-emer` are new. **Every** other texture — every console, every
prop, the crates, the crane, the drums, and all four room backdrops including
`vader` — is byte-identical. The Vader chamber, Corridor and Detention are
untouched, and so is every Vader system: the diff does not reach `Boss.js`,
`config.js` or any darkness owner.

### Remaining weaknesses

- **The lights are unreviewed numbers.** 0.42/0.92 and 0/0.85 were chosen
  against screenshots on a desktop monitor. The one thing screenshots cannot
  settle is whether the cyan wingtips compete with a saber at handset
  brightness.
- **The canopy is the least resolved fixture.** Two cyan bars on a dark box
  reads as a small screen rather than as glass, and at this size the difference
  may not be recoverable.
- **The craft is still symmetrical apart from two hatches.** That was the
  deliberate bound; whether it needs more is a handset question.
- **Nothing else in the hangar was touched**, and the crane and the drums are
  the next-oldest assets in it.

## 10s. THE THIRD ARENA — the Reactor Junction, and a room with no long axis

Handset review passed the Hangar, the shuttle and the Vader Chamber and froze
all three. Two open arenas proved the language COMPOSES. The third room asks
whether it ADAPTS.

### THE ROOM IS NOT A CORRIDOR. Read this first.

The brief for this pass was written for a narrow, directional room. The room
whose id is `corridor` is not one. Its name has always been REACTOR JUNCTION and
that is the true one:

| | chamber | hangar | junction |
|---|---|---|---|
| bounds | 1600x1600 | 1600x1400 | **1400x1400** |
| shape | axial, S→N | axial, W→E | **square, no axis** |
| objective | a dais at one end | a terminal off the lane | **dead centre** |
| entrances | one | three gates + exit | **three gates + exit, on three walls** |
| travel | along the nave | along the deck | **corner to opposite corner** |

It is not narrower than either approved arena. It is the SMALLEST and the only
SQUARE one. Since `bounds`, `spawn`, `exit`, `gates`, the eight cover positions
and the three prop bodies are frozen — and since the whole discipline of this
pass is that visual width and collision width must agree — a narrow hallway
could not be authored here without lying about the space.

**So the spatial test that was actually available is a harder one than
"narrow".** Both approved rooms are axial, and in an axial room composition and
direction are the same decision: put the landmark at one end and the room reads.
A square room with a held centre offers neither. The player arrives in the
south-west, must reach the north-east, and is attacked from three bearings while
standing on the one thing they cannot leave.

The corridor grammar the brief asked for is real and it is all here — bay
rhythm, structural repetition with interruptions, per-side wall jobs, thresholds,
direction without arrows. It just lives in **the walls and the four approaches**
rather than in the room's proportions. The one-sentence definition:

> **THE REACTOR JUNCTION is the crossing where four service ways meet around a
> live containment deck: the architecture is the landmark, the corridor language
> lives in the perimeter and the approaches, and the middle is deliberately the
> calmest floor in the game.**

### What was wrong with the baseline

`docs/evidence/arena-pilot/junction-before/` is the shipped room. It was the
weakest of the four and it failed on rules the other two passes had already
established:

- **NINE FULL-WIDTH SATURATED ORANGE-RED BARS.** `stripEvery: 150` across a
  1400px room, plus four more accents at `accentEvery: 300`. They ran edge to
  edge over the props, the cover, the consoles and the fight, and they were the
  loudest thing in every single frame. Red is the saber, the SABER THROW lane
  and the telegraphs; this room was spending it on wallpaper.
- **TWO CONCENTRIC AMBER RINGS AT r=250 AND r=300, CENTRED ON THE OBJECTIVE.**
  That is the shape, the size and the placement of a circle telegraph, sitting
  on the exact square metre where the boss fight resolves. The chamber pass had
  already killed a ring painted round its dais for this reason; this one was
  bigger and had two of them.
- **EIGHT IDENTICAL CONSOLES IN A PERFECT CIRCLE.** One silhouette repeated
  eight times in the most geometric arrangement available. And because `bush`
  takes the `console` LIGHTS OUT tint, all eight survived a blackout as equally
  pale boxes — the only thing visible in the dark was a ring of identical
  furniture.
- **`perimeter: 'pipes'`** — three horizontal bars and a collar every 96px,
  identical on all four sides with no phase offset. The same "procedurally
  repeated" verdict `bare` and `ribbed` had already taken, and it mattered more
  here, because this room has no hero prop and the wall is most of what it has.
- Rust-brown base at full hex contrast, no architecture, no grounding, no
  emissive layer, no authored dark state at all.

### Spatial hierarchy

**LARGE — the crossing, and the four ways that meet on it.** The one raised
region in the room is a 600x600 plate in the middle, and it is the calmest floor
in the game: no marking, no seam (`edge: false`), no hardware inside it. Every
cover object stands on it and the objective is at its centre. The four
approaches are RECESSED. **Approaches drop, the junction lifts** — that is the
whole directional claim, and it is architecture rather than paint.

The four ways are at four DIFFERENT widths — 304 west, 208 north, 160 east, 160
for the departure spur. A square room composed of four identical arms is a
compass rose; the widths are what make it a place with a busy side and a quiet
one. Three of them are dark service recesses; the fourth, under the exit, is the
only LIGHTER one, because it is not a service run.

**MEDIUM — the plumbing.** A new baked primitive, `conduit`, and it is
deliberately a THIRD object rather than either room's:

| | what it is | whose |
|---|---|---|
| `trench` | a hole with a grate over it | chamber |
| `track` | rails set flush in the deck with sleepers | hangar |
| `conduit` | a large-bore pipe lying in a bed, with flanged collars | junction |

All three are recessed, so none of them can be mistaken for cover — but they say
different things about what the room does, and a passage is the place pipes run
ALONG. **Its cross-section is four hard bands, not a gradient**: a cylinder seen
from above is a smooth ramp of value, and a smooth ramp is the one thing this
game's surface vocabulary does not contain. Four discrete bands read as round at
handset scale and stay in the hard-surface language — the same verdict the hero
housing's facets and the shuttle's wing planes reached from the other direction.

Plus four threshold cross-members, one at the mouth of each way; three deck
plates in the quiet quarters; four doorframes; two recessed maintenance bays.

**SMALL** — three hatches, three vents, sparse and never on the crossing.

### The wall — `junction`, and the corridor grammar

Same RULE as both approved walls, none of their composition:

| | signature | period |
|---|---|---|
| chamber | pilaster / recess / machinery cabinet | 320 |
| hangar | truss column / panelling / bracket foot | 400 |
| **junction** | **PIER AND LINTEL / conduit bank** | **260** |

**THE PERIOD IS THE SPATIAL ARGUMENT.** A passage's structure repeats at a
shorter interval than a hall's, so the bays are tighter here than in either open
arena. That rhythm is what a corridor feels like from the inside, and it is
available in a square room because the band is where the corridor language lives.

**THE SIGNATURE IS THE LINTEL.** Every bay is spanned by a capping beam between
two narrow piers — a structural frame implied overhead, which is the one thing a
top-down passage can say about being enclosed without drawing a ceiling. The
chamber's signature is a pilaster and the hangar's is a bracket foot; both are
things that land on the deck. This one crosses above it.

**THREE BAYS AND ONE INTERRUPTION** (§13's "2–3 are enough"):

- **A STRUCTURAL** — armour plate, deep recess, two vertical stiffeners.
- **B SERVICE** — a conduit bank crossing the bay, with collars.
- **C CONTROL** — a shallow panel recess with information rows.
- **JUNCTION BOX** — on the third bay of the two busy sides only. Heavier,
  squarer, and it breaks the bay's horizontal proportion; that change of aspect
  is what the eye reads as "something different happens here". `bay → bay →
  junction → bay` is what makes repetition read as a system rather than a tile.
  An interruption on a wall with nothing to interrupt is just a fourth bay type,
  so the quiet walls do not get one.

**FOUR SIDES, FOUR JOBS**, with phase offsets 0 / 97 / 171 / 44 so no two
adjacent walls resolve their rhythm at the same distance from a corner:

- **north TRANSIT** — the wall the exit and the north gate are cut through.
  Structural and quiet: two real openings are already the most interesting thing
  on it.
- **west SUPPLY** — the densest. A conduit bank on every bay.
- **east CONTROL** — alternating control recesses and structural bays.
- **south SEALED** — no opening at all. Heaviest armour, fewest events.

### The landmark, and why it is on the WEST wall

`drawWallFeature` grew a second kind: **`interchange`**, where every pipe in the
room converges — entering banks, a heavy manifold with rectilinear valve bodies,
recessed fixture housings, buttresses that out-mass the piers. It is a piece of
the wall, like the hangar's blast door, and deliberately NOT a door: a door is a
promise about leaving, and this is not the wall the player leaves by.

**IT WAS BUILT ON THE SOUTH WALL FIRST AND MOVED, AND THE REASON IS THE
VIEWPORT.** The game camera is inset by `HUDCFG.topBarHeight` and the touch
controls cover the bottom ~200px of the screen. In a 1400-tall room the camera's
centre is pinned inside y [598, 802], so the unobstructed band is roughly
`camTop .. camTop + 896` — which means **world y beyond about 1100 is behind the
joysticks from every position the player can reach.** The south band is never
clear. The first build put the room's landmark and 1040px of its best medium
form down there; both were invisible in play and only showed up in evidence
frames because the rig can put the player at the clamp.

The side walls have no such obstruction, because the controls sit LOW rather
than WIDE. The interchange is now on the west supply wall at `at: 400`, which
puts its southern buttress exactly on the west gate's doorway cut at y 610 so
the opening never eats it — and its core housing lands at world y 400, which is
exactly where the reactor core prop stands. The room's two poles are now north
(where you are going) and west (the machinery), and neither of them is the
middle.

> **A LANDMARK'S PLACEMENT IS A VIEWPORT PROBLEM BEFORE IT IS A COMPOSITION
> PROBLEM.** Solve for what the camera clamp and the touch controls actually
> leave visible, then compose inside that.

### Cover — the third kind, and why five of eight go out

`paintServiceCabinet` (`rj-cab-a` / `rj-cab-b`): louvred doors, a latch, a rack
bay on the B variant, a plinth. 28x28 logical at scale 4, exactly `bush`'s
footprint over the frozen 70x70 body.

**IT IS UNPOWERED, AND THAT IS ITS JOB.** It declares nothing in `CONSOLE_KIT`,
so `loadRoom` tags it `prop` rather than `console` and it simply goes out with
the machinery. Positions, count and bodies are untouched; what changed is which
texture stands on each frozen spot, assigned by FUNCTION:

- the three spots at the mouths of the three feeder ways — **powered hardware**,
  which is where a service junction would put its terminals
- the five that are not — **service cabinets**

Five of eight, the same ratio as the hangar's crates and for the same reason:
most of this room's cover has to leave when the lights do. A room that cannot
use cargo (hangar vocabulary) and must not use eight terminals needed a third
answer, and this is it.

### Authored light — you orient by the DOORS

| room | what its dark state says |
|---|---|
| chamber | containment machinery and technical consoles |
| hangar | a shuttle and the deployment systems around it |
| **junction** | **four lit thresholds and one manifold** |

That is the honest answer for a square room with no long axis and no hero
object: in the dark the player cannot navigate by shape, so the room tells them
where its openings are and which one is the way out. The exit's threshold is the
brightest fixture in the room in both states.

The interchange's two flank fixtures are DEAD at normal power and come up at
0.30 on the emergency bus — hardware that was not lit a second ago, which is the
whole difference between an authored second state and a dimmer. Nominal lamps do
not get louder in the dark at all.

**NO FACES.** The junction authors none, and that is deliberate. The shuttle got
a pair because losing it erased the hangar's identity; §10r says explicitly that
this is a rule about authored STATE, not a template every large prop inherits.
This room's identity in the dark is its architecture, so the reactor core gets
ONE `core` source and nothing more. `smoke-junction` fails if a face appears.

### Direction, without arrows

Five architectural statements about the way out and zero arrows:

1. the departure spur is the only LIGHTER way in a room whose other three are
   recessed
2. it has its own threshold cross-member
3. it is the only place on the floor carrying a painted marking — corner
   brackets, not chevrons
4. its threshold light is the brightest fixture in the room, in both states
5. it is cut through the quietest wall, so nothing on that band competes

A repeated arrow down a passage turns the environment into UI. One marked
threshold says the same thing once.

### Frozen elsewhere, and proved by pixels

`tests/diag-texture-hash.mjs` over 87 generated textures plus a
deterministically-seeded backdrop per room:

```
> tex rj-cab-a 112x112 ...        (new)
> tex rj-cab-b 112x112 ...        (new)
backdrop corridor                  changed
```

Nothing else. `backdrop-hangar`, `backdrop-vader`, `backdrop-detention`, the
shuttle, the hero machine, every console and every prop are byte-identical.
`smoke-junction` re-reads the other three rooms' specs and freezes them as
literals; `smoke-arena` and `smoke-hangar` both still pass unchanged.

### Performance

Measured with `diag-arena-perf.mjs`, before/after on the same container.

| | before | after |
|---|---|---|
| room load | 51.6 ms | 51.9 / 52.0 ms |
| emissive parts | 0 | 52 |
| display list | 52 | 108 / 107 |
| roomLayer objects | 14 | 16 |
| wall bodies | 11 | 11 |
| backdrop | 1400x1400, 7.48 MB | 1400x1400, 7.48 MB |
| new texture memory | — | +98 KB (two 112x112) |
| `setPower` | 14.8 ms | 14.1 ms |
| frame median, normal | 88.4 ms | 94.0 / 95.1 ms |
| frame median, dark | 99.7 ms | 104.7 / 106.3 ms |

The architecture is baked, so it costs canvas operations at load and zero
objects afterwards; the room-load figure is unmoved. The display-list growth is
the emissive layer and the two wall panels. The frame figures rise ~6%, which is
inside this container's documented run-to-run spread (`diag-vader-perf` measured
131.9 and 140.6 ms for identical code) but is reported rather than explained
away — 52 additive images is real work, and the hangar carries 60 at the same
cost.

### Candid limitations

- **The dark state is very dark from the middle of the room.** At the centre the
  camera shows neither the north nor the south band and neither side wall, so
  the only lit things in frame are the three powered consoles. That is
  defensible — §28 asks for exactly that, and the lit consoles do mark the three
  feeder ways — but "orient by the doors" only pays off once the player moves
  toward one.
- **The 260px bay period is unverified in motion on a handset.** The pan
  evidence is 10 frames at ~20fps in a headless browser. Nothing in the wall is
  a shallow diagonal, so the shuttle's failure class is structurally absent, but
  a tighter period is more edges per screen than either approved room has.
- **The reactor core prop and the two struts are legacy assets.** They were not
  in scope and they are now the oldest things in the room, exactly as the crane
  and the drums are in the hangar.
- **The interchange is symmetrical apart from its collar phasing.** Whether that
  is enough asymmetry for a 420px wall feature is a handset question.
- **The emissive numbers are unreviewed.** Every intensity was chosen against
  screenshots on a desktop monitor.

## 10t. THE JUNCTION'S COVER TOPOLOGY — the ring, and why it had to go

`§10s` is the junction's art pass. Handset play **approved that pass** — the
visual identity, the junction reinterpretation, the wall and perimeter language,
the conduit vocabulary, the central restraint, the palette, the cabinet and
console language, the LIGHTS OUT presentation, the colour hierarchy — and
**rejected the room's level design**, which the art pass had deliberately left
alone as gameplay geometry it was not allowed to touch.

That cover freeze is REVOKED. This section is the correction and the record.

### What the room actually was

Eight cover objects in a near-perfect circle around an objective the player
cannot leave. The art pass repainted them — three powered terminals at the
feeder mouths, five unpowered service cabinets — but a repaint cannot fix a
topology. On a handset it read as a furniture carousel: movement dictated by
small gaps, enemies queueing round obstacles, and a boss fighting the desks.

### What was measured

Three diagnostics were built for this. `GameScene.loadRoom` takes a **spec
object**, so a candidate topology is a cloned spec with a different `cover`
array — no source edit, no rebuild, and every candidate is measured by the same
code on the same machine within seconds of the others.

- `tests/diag-junction-topology.mjs` — geometry and nav: clear radius, pairwise
  gaps, how much of the room admits a Ø112 body, gate route ratios.
- `tests/diag-junction-flow.mjs` — real waves at all three gates against a
  pinned player, per-enemy detour, stall and contact over the APPROACH ONLY.
- `tests/diag-junction-vader.mjs` — the frozen boss driven from eight stations
  by his own AI with the move scheduler silenced. §12's benchmark.

Three findings, and the third is the room's verdict:

1. **ALL EIGHT PIECES SAT INSIDE THE CROSSING.** The floor art already declares
   a 600x600 raised region as the junction — the room's whole spatial idea and
   the calmest floor in the game — and every cover body was parked in it. The
   nearest solid face was **205px** from the objective.
2. **THE GAPS WERE VADER-PROOF.** Tightest neighbour gap **90px**, against a
   Ø112 boss (`BOSS.radius` 56, doubled). `NavGrid.build` tests a cell CENTRE
   against a body rect inflated by 23px, so it routed ordinary actors — Ø40-48 —
   straight through slots the largest actor cannot physically enter. **Pathing
   said yes and physics said no.** Only **47%** of the crossing admitted Vader.
3. **SO THE BOSS JAMMED.** Vader closed on the player on **2 of 8** legs. On all
   three feeder approaches he spent **43-46% of frames in bodily contact with
   geometry** and never arrived. North to south he travelled **62px in six
   seconds**. Under a second, heavier-loaded pass he closed **0 of 8**.

Note what this says about instrumentation: the ordinary-enemy flow probe barely
discriminated, because ordinary enemies FIT. A layout can be broken for exactly
one actor size and look fine in every other measurement.

### The rule that replaced the ring

Two relational truths, both asserted by `smoke-junction`, neither of them a
coordinate:

- **THE CROSSING IS THE CLEAR COMBAT ENVELOPE.** No solid body may intersect
  `x[400,1000] y[400,1000]`. Cover lives in the peripheral bands, where the
  room's functions already are. The room's own architecture chose this envelope;
  the topology just stopped contradicting it.
- **EVERY GAP IS A LANE.** 160px minimum between any two solid bodies: Ø112 plus
  the nav grid's own 23px agent clearance on each side, rounded to two nav cells
  so a qualifying gap always contains a fully walkable cell. This is derived
  from the actors and from `NavGrid`, not chosen by eye.

Plus a NOT-A-RING check on bearing and radius spread, because deleting four of
eight and leaving a tidy square would pass both rules above and fail the room.
The bearing half is the one that discriminates: the ring's widest gap between
two cover bearings is **55 degrees** against the shipped layout's **146**. The
radius half needed its bar raised to 0.25 after the ring PASSED a 0.2 threshold
at 0.201 — its pieces sit 254-311px out, which clears a lazy check.

Reinstating the ring through the spec makes `smoke-junction` report **18
findings**, all four relational truths among them.

### The selected layout — four pieces, and only one is lit

| where | texture | powered | why it is there |
|---|---|---|---|
| (920, 360) | `rj-cab-b` | no | north control, offset EAST of the feeder way so the way keeps its full width; pulled in to the crossing's corner so the four radii are uneven |
| (1080, 920) | `ch-con-heavy` | **yes** | the east control station, south of the east way. The room's single powered cover object |
| (280, 920) | `rj-cab-a` | no | west service band, south of the west way. North of it belongs to the reactor core prop, whose 200x120 body owns that pocket |
| (440, 1160) | `rj-cab-b` | no | south-west staging, on the player's route out of spawn. The one piece that exists for the player rather than for the room |

The north-west quadrant carries no cover at all, deliberately: the reactor core
prop is already the mass on that side.

### After

| | ring | shipped |
|---|---|---|
| cover objects | 8 | 4 |
| bodies inside the crossing | 8 | 0 |
| clear radius at the objective | 205px | 357px |
| minimum obstacle gap | 90px | 165px |
| sub-160px gaps | 5 | 0 |
| crossing admitting a Ø112 body | 47.3% | 96.5% |
| feeder gate -> objective, nav ratio | 1.22 / 1.28 / 1.35 | 1.02 / 1.02 / 1.09 |
| Vader legs closed | 2 of 8 | **8 of 8** |
| Vader frames in contact with geometry | 30.6% | 4.6% |
| ordinary enemies stalling | 2.2% | 0.0% |
| ordinary enemy contact, dense wave | 6.6% / 7.4% | 3.0% / 4.4% |
| physics bodies / LOS rects | 11 | 7 |
| emissive parts | 52 | 42 |
| display list / roomLayer | 104 / 16 | 90 / 12 |
| frame median, normal / dark | 126.7 / 149.7 ms | 126.7 / 142.4 ms |
| room load | 39.1 ms | 43.4 ms |
| backdrop / kit textures | 7.48 MB / 343 KB | unchanged |

Frame time is a wash — an identical normal median in a same-session A/B, a ~5%
better dark median, and a load figure whose 4ms difference sits inside the
39-52ms spread the same build gives across runs. The saved objects were not
spent on anything.

### The candidate that lost

A five-piece variant (candidate A plus a cabinet at (780, 1080)) opened the
centre just as well — 346px clear, 165px minimum gap, 98.3% of the crossing —
and closed one more Vader leg. It lost on ordinary-enemy flow: **5.6% and 7.1%**
obstacle contact at the discriminating density against the four-piece layout's
**3.0% and 4.4%**, reproduced across two runs. Its fifth object also had the
least reason to exist — open south field, nothing to relate to. §19: if moving
an object 100px changes nothing tactically, question whether it is needed.

### What this did NOT change

`src/data/rooms.js` is the only source file in the diff. Bounds, walls, gates,
spawn, exit, objective, props, enemies, pickups, floor art, architecture,
perimeter, palette, the emissive layout, EnvLight, LIGHTS OUT and Vader are all
untouched. The other three arenas are untouched and `smoke-junction` reads them
from the same place as everything else.

### Open

- **The dark state lost seven console lights** with the three powered pieces.
  That was the intent — one lit terminal instead of a ring — but whether the
  centre now reads as too empty in a blackout is a handset question, and §22
  explicitly forbids answering it by adding light in this pass.
- **The reactor core prop and the two struts are still legacy assets** and are
  now, with three fewer cover objects around them, more prominent than before.
  Their migration is `§10s`'s open item and stays deferred.
- **The south-west piece is the weakest-justified of the four.** It exists for
  the player's route out of spawn rather than for the room's function, and it is
  the one to question first if the layout is revisited.

## 10v. THE REACTOR EMITS — the junction's last visible lie, and the end of it

`§10u` is the emergency lane guidance. Handset play **approved it**, and
approved the room: the junction stays genuinely dark, the approach fragments
improve orientation, they read as infrastructure rather than a glowing UI lane,
the centre stays black, SABER THROW / PULL / PUSH dominate immediately,
Afterimages stay threatening, and the saber keeps visual priority. Topology,
crossing, feeder connectivity, navigation, normal-power composition, lane count,
lane intensity, central darkness and the global LIGHTS OUT numbers are all
**frozen**.

One thing was still wrong, and it was a truth problem rather than a taste one.

### What the art claimed and what the room did

`paintReactorCore` paints a vertical stack of amber slats behind a grille. That
is a claim: *this machine is running*. In LIGHTS OUT the claim collapsed — the
slats are painted into the prop texture, the prop is in `roomLayer`, and the
blackout multiplies that whole group toward black. The biggest machine in the
room went out harder than the walls, while the interchange fixture 190px away on
the same screen came UP on emergency power. One frame carried both.

**And the reactor's only source could never have been seen.** It was a radial
`core` at (260, 352):

  - the machine's lit slot is at world **x 236..288, y 168..272**. The source sat
    **130px below it**, down at the base skirt;
  - `prop-core` is 304x344 at (260, 400) with origin (0.5, 1), so it occupies
    **x 108..412, y 56..400**, and it sorts at its own y of 400;
  - environment light draws at `ENV_LIGHT_DEPTH` **3**.

So the emitter and all but the outermost ~25px of its falloff were behind the
object they belonged to, and that remainder is the tail of the gradient, which
is nothing. The room's reactor was lit by a light nobody could see. This is the
prop-occlusion trap the hero machine's faces already exist to solve — it was
simply never checked on this prop.

### The fix, and the rule that admits it

`prop-core-glow`: ONE ADD-blended face, painted on the machine's own 76x86
canvas at the same scale 4, so registration is structural rather than a
hand-computed offset. `loadRoom` registers it from the LIVE sprite at the prop's
depth **+ 1**.

**One texture, not two.** The hero machine gets `prop-pod-glow` plus a
dead-at-normal `prop-pod-emer` because fixtures that were not lit come up when
its bus drops. A reactor core has no second composition — the same stack is
simply the only light left in the room — so a second texture would have been the
pod's composition borrowed rather than its doctrine reused. `smoke-junction`
pins the count at exactly one in both directions.

**Four values deep, and the fourth is nothing:**

| layer | what it is | why |
|---|---|---|
| core | the six slats over the painter's own hot band | the emitter |
| recess | a tight vertical wash + a warm rim down both cavity walls | a hole with lit walls is not a rectangle of paint |
| near metal | a wide faint wash on the cylinder, and the two containment-band stubs the slot interrupts | light INSIDE the machine rather than stuck on its front |
| housing | **nothing at all** | the shell stays as dark as the room |

The grille bars are painted by *neither* pass, so they stay dark and the stack
reads as light coming through something. The whole face is clipped to the
housing silhouette with one `destination-in` path, so contamination stops at the
metal.

**THE RADIAL POOL IS GONE AND WHAT REPLACED IT IS ONLY THE SPILL.** A vertical
slotted emitter does not throw a circle. The deck source is an
`emitter: false` vertical strip below the machine — the same contract the hero
machine's two deck spills use, and for the same reason: left on, the crisp
`TEX_FLAT` bar reads as a second object lying on the floor. It is **dead at
normal power**, because it is the one part of this pass that reaches outside
the prop's own rectangle.

### The face exemption's admitting rule just got wider, on purpose

`smoke-junction` §3 used to assert the junction carried **zero** faces, and the
reasoning was sound as far as it went: the exemption was granted to a prop whose
disappearance would erase a room's identity — the shuttle's argument, not this
room's, whose dark identity is its architecture.

Handset play found the hole. The admitting rule is not only *losing it erases
the room*; it is also **IF IT LOOKS LIKE AN EMITTER, IT MUST EMIT.** That is
narrower than a template and it licenses exactly one face here, on the one prop
in this room whose ART makes the claim. It is still not something a large prop
inherits: the junction's cabinets, struts and consoles declare nothing.

### Measured, because "it looks brighter" is not a locality claim

`tests/diag-junction-reactor-light.mjs` — one page load, both scenes paused, the
camera hand-scrolled, a shoot-until-two-frames-are-identical shutter, and the
reactor's own two parts switched off between shots:

| region | emergency mean gain | peak |
|---|---|---|
| the slot | **54.0** | 104 |
| the recess rim | 45.7 | 134 |
| the housing | 7.2 | 134 |
| the deck below it | 1.9 | 32 |
| the crossing | **0.00** | **0** |

Strictly decreasing, ending at literally zero on unrelated room pixels: a local
machine light, not exposure compensation.

**Normal power: 0 pixels changed outside the prop's own rectangle**, and a peak
of 19/255 inside it. The approved composition is untouched; the A/B crop is
indistinguishable at a glance.

### Cost

Display list is UNCHANGED — the `core` it replaces built two Images (radial
spill + radial hot), and the face plus the spill-only strip build two. One new
texture, 304x344 RGBA, ~408KB. `setPower` across the whole 58-part layer
measures 0.01ms and re-rasterises nothing; there is no update hook and no tween,
so per-frame work is zero by construction. Room load is 42-68ms across repeated
loads with the part count flat at 58 — no duplication.

### Two instruments were lying, and both were found the same way

**`_castBossMove` matches the registry id EXACTLY, and the ids are lowercase.**
`cast('saberThrow')` was refused every single time — in this rig and in
`shot-junction-lanes.mjs` before it — so the frame filed as SABER THROW was
whatever the boss's own state machine did next. `§10u`'s combat-hierarchy
evidence was photographed through that bug.

**Staging Vader beside the player KILLS the player,** and `_castBossMove`
refuses outright once `player.alive` is false. Restoring hp is not reviving.
Three frames came back under moves that never ran while every guard the rig knew
about — active move, guard stance, state machine — reported clear, and the
refusal reason printed as `unknown` until `player.alive` was added to it.

Both are the post-mortem's rule in a new costume: **a refused call reads exactly
like a failed one.** Every cast in both rigs is asserted now and prints why it
was refused.

### What is open

Nothing. The handset verdict closed it — see `§10w`.

*Superseded, kept because it is the shape of the question:* until the verdict,
the open item was the reactor's light, The deferred candidate
remains a full **reactor / interchange landmark migration** — and after this
pass the honest answer is that it looks much less necessary than it did, because
the perceived weakness was the machine not behaving like a machine rather than
the machine's shape. See `§0`.

Evidence: `docs/evidence/arena-pilot/junction-reactor-before/` and
`junction-reactor-after/`, matched stations, plus the A/B sheets.

---

---

## 10w. THE REACTOR JUNCTION IS HUMAN-APPROVED AND FROZEN 🔒

Handset play of the final build (`68a76c4`) passed. The room is **closed**. Do
not reopen any of it without NEW human play evidence — not a screenshot, not a
measurement, not a better idea.

### What the verdict covers

Everything. Explicitly frozen, so that a later session cannot argue a piece of
it was merely un-mentioned:

| frozen | where it lives |
|---|---|
| bounds 1400x1400, spawn, exit, gates, objective | `rooms.js` `corridor` |
| the 4-cover topology, its count and its positions | `rooms.js` `cover` |
| the open central crossing, and the 160px lane rule | `§10t`, `smoke-junction` |
| feeder connectivity and enemy flow | `§10t` |
| Vader's navigation inside this room | `§10t` |
| the `junction` perimeter style, its pier-and-lintel rhythm | `pixelArt.js` |
| the conduit floor language, regions, thresholds | `pixelArt.js`, `rooms.js` |
| normal-power palette and composition | `§10s` |
| emergency lane guidance: 8 fixtures, 2 per approach | `§10u` |
| lane intensities, the cool/neutral treatment, the no-crossing rule | `§10u` |
| the reactor's amber emissive face, its normal/emergency values | `§10v` |
| the reactor's local deck spill | `§10v` |
| global LIGHTS OUT values, timing and ownership (already frozen) | `§10j` |

The human's own words on the amber treatment, in motion: bright enough to
behave like powered machinery, local enough not to become an environmental AoE,
amber stays distinct from Vader's hostile red, the deck contamination is subtle,
the normal state stays restrained. And the composition it produces:

> cool guidance = orientation · amber reactor = room identity ·
> crimson Vader = combat threat

Three layers, three jobs, three colours. That is the thing the junction proves,
and it is the standard the fourth arena is measured against.

### The reactor migration is deferred INDEFINITELY

A full reactor / interchange landmark migration was nominally on the table for
three passes. It is now **off** it. The human approved the silhouette as good
enough and said explicitly that no migration is needed. Do not schedule it, do
not call it next, and do not treat "we once considered it" as authorization. It
comes back only if play evidence exposes a real problem.

### The four truths worth more than the room

**TOPOLOGY.** The eight-cover ring failed for three reasons, and all three
generalize: radial symmetry OCCUPIED the crossing, permanent geometry COMPETED
with combat geometry, and the gaps disagreed with large-actor clearance. The
replacement is stated relationally rather than as coordinates — open crossing,
peripheral functional cover, meaningful lane clearance, no furniture orbiting
the objective — because freezing coordinates is exactly what protected the bad
layout for as long as it survived.

**NAVIGATION — recorded engine debt, NOT to be fixed here.** `NavGrid.build`
tests a cell centre against a body rect inflated by a fixed 23px agent
clearance, which is right for the Ø40-48 rank and file and wrong for a Ø112
boss. Pathing said yes where physics said no, and a layout was broken for
exactly one actor size. **The junction was corrected through level topology,
and NavGrid was not touched.** Do not touch it now either. Remember it when
designing a tight space: measure the LARGEST body.

**LIGHTING.** *Declared emitter is not visible emitter.* A source at the wrong
depth under an opaque prop is functionally nonexistent, and it survived every
test in the suite because every test asked whether a source was DECLARED.
Environment validation must prove visual CONTRIBUTION, in pixels — see
`tests/diag-junction-reactor-light.mjs` for the shape of that measurement.

**EVIDENCE.** Two rig bugs, both of which produced photographs filed under moves
that never ran. `_castBossMove` matches the registry id EXACTLY and the ids are
lowercase. And restoring hp is not reviving: staging Vader beside the player
kills the player, and the cast then refuses outright. **A forced-move rig must
assert that the move it names actually began.**

## 10u. THE JUNCTION'S EMERGENCY LANE GUIDANCE — the dark state gets its plan back

`§10s` is the junction's art pass and `§10t` is its cover topology. Handset play
**approved the topology outright** — the centre feels open, enemies spill in
naturally, the furniture-ring problem is solved, Vader has room for his movement
vocabulary, FORCE PULL / PUSH / SABER THROW breathe, the south-west cover stays,
and the normal-power composition is good. All of it is frozen.

One thing came back: **LIGHTS OUT loses too much of the room's junction
identity.** Not a readability complaint — combat was explicitly fine, and the
verdict was not "I cannot see Vader". It was that the room becomes such a black
void that its four-way infrastructure stops reading.

### The problem is the topology pass's own success

The ring was bad level design and it had to go. It was also, accidentally, the
only thing standing in the middle of the room with a shape. Remove it and a
blackout at the objective leaves: the north and south wall bands both outside a
viewport whose camera centre is pinned inside y [598, 802], neither side wall in
frame, and exactly one lit object — the east control terminal, off at the edge.
`docs/evidence/arena-pilot/junction-lanes-before/dark-centre.png` is that frame.
Three of the four powered cover objects went with the ring, which was the intent;
what nobody could see until it was played is that the room's PLAN went with them.

### What was added

Eight `strip` sources on the junction's `emissives` list, tagged `guide: true`.
No new code path, no new texture, no new kind, no baked art. Two fixtures in each
of the four authored floor approaches, **dead at normal power** and modest under
emergency.

| approach | fixtures | colour | emergency | why that voice |
|---|---|---|---|---|
| west / reactor | 60px + 32px | cyan-biased `#a6e0ec` | 0.30 / 0.22 | the service artery; every pipe in the room runs into the interchange at its end |
| north / service | 52px + 32px | cool white `#bcd2ea` | 0.26 / 0.20 | the feeder way under the north gate |
| east / control | 52px + 32px | cool white, one step cleaner `#c6dcf2` | 0.26 / 0.20 | the control side has been the cleaner wall since the art pass |
| departure spur | **72px** + 36px | warm neutral `#f0e6cc` | **0.32** / 0.24 | the way out stays the easiest structure to rediscover |

The exit distinction is a longer segment and a warmer neutral, not a colour that
means "exit" — no green, no arrow. Warm-neutral is not amber: green sits at 96%
of red here, where the danger red the saber and the telegraphs own drops it under
a third, and `smoke-junction`'s existing channel test covers these automatically.

### Four rules held the list down

- **NOTHING ON THE CROSSING.** Not one emitter and not one pixel of spill enters
  `x[400,1000] y[400,1000]`. The composition is lit approach fragments around a
  DARK OPEN CROSSING that combat owns. The check is on the SPILL box, because the
  spill is what reaches the floor — a containment test on the emitter alone
  passes a fixture whose glow lies on the objective.
- **SEGMENTS, NEVER A LANE.** Two fixtures per approach, unequal in length, with
  a gap wider than the shorter one, covering 28-32% of each run and spanning at
  most 70% of it. **This is a SABER THROW problem before it is a taste problem:**
  the throw is a long saturated crimson corridor and it owns line language in
  this game by entitlement.
- **HELD TO ONE EDGE**, never up the middle — the same verdict the north conduit
  already took when it was drawn up the centre of its way. Each set sits on the
  edge its approach's own plumbing is not on.
- **NO BAKED SOCKET.** A recessed housing cut into the backdrop would be visible
  at NORMAL power, in a composition the human just approved, to buy believability
  for something only ever seen against a near-black floor. The recessed read is
  carried by the construction instead.

### The candidate that lost

**A (shipped)** — two fixtures per approach, one long one short.
**B** — three shorter, dimmer fixtures per approach, same edges, same colours,
same containment. B was built as a spec clone in `tests/shot-junction-lanes.mjs`
(`loadRoom` takes a spec object, so a lighting candidate needs no source edit —
the same trick the topology pass used for cover) and photographed at the same
stations minutes apart. **B's three even ticks read as a dash pattern**, which is
the runway language the brief forbids, and each fixture was individually too weak
to read as installed hardware. A's long/short pair reads as two different
fixtures. `docs/evidence/arena-pilot/junction-lanes-cand-*.png` is the sheet.

### Normal power is pixel-identical, and that is measured

Every guide is `normal: 0`, so `setPower(0)` sets all 16 parts `visible = false`
and the renderer draws nothing. `tests/diag-junction-normal-delta.mjs` proves it
in pixels: **0 changed pixels at all five stations**, against a control — the
identical measurement under emergency power — that reports ~5,800.

> **TWO HARNESS LIES COST A ROUND EACH HERE, AND BOTH ARE WRITTEN INTO THAT
> FILE.** A naive before-run/after-run screenshot diff reported 62,000-94,000
> changed pixels on a change that is invisible by construction: `paintBackdrop`
> consumes `Math.random` and nothing seeds it in a live run, so two page loads of
> the SAME build return different floor grime. And inside one page load, a fixed
> `waitForTimeout` after a camera scroll photographs the PREVIOUS station — which
> showed up as two stations reporting hundreds of thousands of changed pixels
> while the three between them reported exactly zero. Shoot until two consecutive
> frames are byte-identical instead. Pausing the Game scene is also not enough:
> the HUD is a separate scene with its own tweens.

`tests/diag-texture-hash.mjs` is byte-identical across all 87 generated textures
and all four backdrops. No baked art changed at all.

### Performance

Same-session A/B with `src/` stashed, on a container measurably slower than the
one `§10t` was measured on — so read the deltas, not the absolutes.

| | before | after |
|---|---|---|
| emissive parts | 42 | 58 |
| display list | 90 | 106 |
| roomLayer objects | 12 | 12 |
| wall bodies / LOS rects | 7 | 7 |
| new textures | — | **none** (the shared box and flat glows are reused) |
| backdrop | 7.48 MB | 7.48 MB |
| kit textures | 343 KB | 343 KB |
| room load | 82.3 ms | 71.4 ms |
| `setPower` | 30.3 ms | 24.4 ms |
| frame median, normal | 158.4 ms | 163.4 ms |
| frame median, dark | 184.6 ms | 180.5 ms |

Sixteen more ADD images, zero new memory, zero per-frame work — `setPower` is
still N alpha writes. The frame figures move by ±3% in both directions, which is
inside this container's spread.

### What `smoke-junction` now asserts, and all of it A/B's

Ten new checks, every one of them run against a deliberately broken build first:
a guide through the objective, a continuous lane down an approach, a fixture lit
at normal power, a guide brighter than the exit threshold, a dashed-line gap
rhythm, and guidance propagated into the frozen hangar. Each produced its own
finding. Intensities are **deliberately not frozen** — they are the handset's to
judge, and freezing an unreviewed number is exactly the mistake the cover ring
was.

### Open, and honest

- **The exact centre is a partial answer, and the limit is the viewport.** The
  crossing is 600px wide inside a 720px viewport, so a fixture that obeys the
  no-crossing rule can be at most ~60px into frame from the objective. From dead
  centre the north way's guidance reads and the west way's inboard fragment
  clips the edge; the east way and the spur are off screen. The four-way read
  arrives as soon as the player moves, and it cannot be improved without either
  lighting the crossing or widening the camera.
- **The intensities were chosen against a desktop monitor**, as `§10s`'s were.
- **The exit is in the NORTH-east.** The brief called the departure spur the
  "south/exit route"; in this room the exit is at (1200, 200) on the top wall and
  the guidance was placed against the room, not against the brief.
- **The reactor core and struts are still legacy assets** and still deferred.

---

## 10x. THE FOURTH ARENA — the Detention Block, and whether this is a language

`§10n` is the chamber pilot, `§10q` the hangar, `§10s`-`§10w` the junction. This
is the last unstyled room, and the question it exists to answer is not "does
this room look better". It is **does CRIX have an environmental LANGUAGE, or
three one-off rooms.** The test was set as: reuse the SYSTEMS, reuse none of the
COMPOSITION — same world, different room.

### The room, audited before a word of art direction

The name is a trap and the geometry says so. Every number below was read out of
`rooms.js` and the live scene, not remembered:

| fact | value |
|---|---|
| bounds | **1600x1400** — the WIDEST arena, and the only one whose long axis runs east-west |
| spawn | (150, 700), the west edge |
| exit | (1450, 700) `side: 'right'` — **dead level with the spawn** |
| gates | (800,100) N, (800,1300) S, (1450,300) and (1450,1100) — **two on the east wall**, behind the way out |
| objectives | (500, 450) and (1100, 950) — diagonally opposed, pulled off the walk |
| `walls` | **EMPTY.** Not one solid structure on the deck |
| cover | 8, on a 3/3/2 grid: y=300 x{400,800,1200}, y=1100 x{400,800,1200}, y=700 x{600,1000} |
| props | `prop-post` (260,1230) body 200x110; four bunks, bodies 120x60 |
| perimeter | `cells`, thickness 64 |
| authored floor / light | **none** — no `architecture`, no `emissives`, no `grounded` |

**The plan is a WALK.** Enter one side, leave the other, straight through the
middle, with the two objectives pulling you off the line and reinforcements
coming from behind the exit. That is not a warren of cells, and building the
obvious detention-corridor fantasy here would have been writing a fiction over
a geometry that says something else.

### The viewport decided the composition, again

720x1196 of viewport pins the camera centre inside **x [360, 1240]** and
**y [598, 802]**. Two consequences, and both are structural:

- **The full WIDTH is reachable** — the only arena where that is true. The long
  axis and the visible axis are the same axis here.
- **World y beyond about 1100 is behind the touch controls** from every
  position the player can stand in, and the SOUTH band (y 1304..1400) is
  effectively never in frame at all. The junction lost a whole build to a
  landmark on its south wall; this room's only landmark, `prop-post` at
  (260, 1230), was already under the joysticks and had been its whole life.

So everything that carries is composed east-west, on the north band and the
east wall.

### What the baseline actually was

`docs/evidence/arena-pilot/detention-before/` — 40 frames.

- **SIX full-width saturated CYAN strip lights** at `stripEvery: 220` plus
  three pale accents, edge to edge over the props, the cover and the fight. The
  loudest thing in every frame. The same failure the chamber shipped in crimson
  and the junction in orange-red.
- **No large forms and no medium forms.** A flat hex deck at full contrast,
  twelve faint corner brackets, nothing else.
- **Eight identical `bush` consoles on a grid**, every one lit, every one
  carrying a painted red LED bar. In LIGHTS OUT they were eight equally pale
  boxes and the brightest objects in a room that was supposed to be dark.
- The bunks were painted from the Imperial family's top end and the observation
  post was glazed in a saturated cyan it had no light to justify — both
  brighter than the deck they stood on.

### The one sentence

> **A prisoner-transfer block: a long, deliberately exposed escort floor
> running the full width of the level between two banks of holding cells, from
> the intake end to a sealed processing gate.**

The room's frozen open middle stops being something the art has to work around
and becomes the fiction: **you are meant to be visible while you cross.**

### LARGE, MEDIUM, SMALL

**LARGE — three ideas.** The ESCORT FLOOR: 1408px of raised deck at `deckLit`
0.24, wall to wall on the traverse line, 280 tall, with nothing drawn inside
it. The two HOLDING APRONS: recessed strips in front of the cell banks, each
split into two unequal runs (620 and 634) by a 150px gap that lands exactly
where the room's own north and south gates are — the rhythm comes from the plan
rather than from a decoration. The PROCESSING GATE: the landmark, in the east
wall, described below.

**MEDIUM.** Two secured thresholds where the walk begins and ends; two large
bolted deck plates under the objectives, so the terminals stand on authored
ground; heavy `doorframe` mouths on all four gates; two short recessed service
channels at the bank foot.

**SMALL.** Three hatches and two vents, all of them out at the edges. The walk
carries nothing.

### The perimeter is the identity

`block`, thickness 96 (from 64 — a cell has to be deep enough to be a cell).
Same RULE as all three approved walls, none of their composition:

| wall | signature | period |
|---|---|---|
| chamber | pilaster / recess / machinery cabinet | 320 |
| hangar | truss column / panelling / bracket foot | 400 |
| junction | pier and lintel / conduit bank | 260 |
| **detention** | **cell front / jamb / barred mouth** | **176** |

**The period is the spatial argument, and this is the tightest in the game
because a cell is sized for one person.** **The signature is the bar** — nothing
else in CRIX draws slats across an opening; a chamber bay lands on the deck, a
junction bay crosses above it, this one CLOSES one.

Three modules and one rhythm: `cell cell cell service`, with exactly one SECURE
leaf per long wall — an armoured door with a HORIZONTAL interlock bolt across
it, when every other bar in the wall is vertical, so the bolted cell is legible
from the pattern before any light is involved. Occupancy varies by a fixed hash
of the bay index (never random: a backdrop is repainted on every load, and an
occupancy that reshuffled would make the block a different place each time).
North is the fuller run, south the emptier one — the two long walls are not
each other's mirror.

### The landmark, and the fourth landmark class

**THE PROCESSING GATE**, east wall, centred on the exit at y=700. The chamber's
landmark is a freestanding machine; the hangar's is a door you go through; the
junction's is infrastructure converging on a sealed wall. This one is a
**CHECKPOINT** — a gatehouse with its shutter down and the way out cut through
its middle. Two unequal bastions (the northern one carries a control face), a
lintel house spanning the opening, and slatted shutter reveals either side of a
doorway that is left completely clear.

It is on the east wall because that is where the walk ends and because the east
wall is one of the two the camera clamps let this room show. It is deliberately
NOT a machine: no pipes, no cores, no faceted housing. It is a wall thickened
around a hole.

### The dark state: *the room disappears, but the containment system stays armed*

The fourth emergency identity, and a different KIND of answer from the other
three. The chamber's is powered hero machinery, the hangar's is deployment
systems, the junction's is wayfinding plus an amber reactor. **None of those is
available here and none was borrowed:** this room has no machine, and it does
not need to say where the doors are, because it has one way out and the whole
room points at it. What a detention block has on its emergency bus is LOCKS.

Fourteen sources. Eight cell-lock lamps — five north, three south — cold
white-blue, `normal === emergency`, on SOME cells at irregular intervals and
keyed to the same occupancy the wall painter draws. Two secure-door interlocks,
amber, **dead at normal power**, which are the room's authored second state.
Three gate sources, the brightest in both states. One intake lamp.

**Four rules held the list down, and each is a way this could have gone wrong:**

- **NOTHING AUTHORED STANDS IN THE WALK.** No source and no spill is inside
  x [300, 1280] y [560, 840]. The two lit objects on the walk are the frozen
  cover positions at (600,700) and (1000,700), lit by the shared console kit
  from their own art — that is the CHECKPOINT and it is the composition, not an
  exception to it. What the rule forbids is authored floor light down the
  middle, which would be the junction's cover ring drawn in light.
- **OCCUPANCY, NOT A ROW.** A lamp on every cell is an outline of the playable
  space, and two parallel dotted lines down the long walls is a corridor drawn
  in light. Scattered, they are a handful of doors that still have someone
  behind them.
- **NOMINAL LAMPS DO NOT SHOUT.** A lock says "holding" whether anyone is
  watching. They become the brightest thing in the room by SUBTRACTION, which
  is the honest way for a battery-backed system to win.
- **NO RED, AND NO GREEN EITHER.** Red is three arenas old. Green is new and
  specific to this room: **enemy bullets are green**, and a scatter of small
  green points along both walls during a blackout is incoming fire that is not
  there. `smoke-detention` channel-tests both.

### The cover, and what a frozen grid can still be fixed by

The eight positions are exactly the baseline's. Moving them would be a
level-design pass wearing an art pass's clothes, and the junction's clearance
failure does not exist here — the tightest neighbour gap is 400px against a
Ø112 boss. What changed is WHICH OBJECT stands where:

- **Three powered, five not** — the same ratio the hangar and the junction both
  landed on, and for the same reason: cover that declares nothing in
  `CONSOLE_KIT` takes the `prop` tint and GOES OUT.
- **The three powered are not symmetric** — the two on the walk and one in the
  north-east. The checkpoint being the lit part of the room is the
  composition; a lit ring would be the grid again, in light.

Two bounded kit additions, both on the frozen 28x28 canvas and the frozen 70x70
body: `dt-con-lock`, ONE new console FACE (a lock board, not a display — you
read a lock board at a glance and a terminal by staying at it), and `dt-bench`
in two variants, the unpowered mass.

### Three things that were measured and put back

- **A `sink` inset in the gate mouths was a PIT.** 150x300 of near-black across
  the square metre the player walks through to enter the room — the one lie a
  room may not tell about where it can be walked. The gate approaches are plain
  deck now.
- **A `rib` at 0.55 across the walk was a BARRIER.** 20x14x280 of lit bar at the
  proportion of something to walk round, in the one place the room must not
  suggest there is anything to walk round. 0.34 and thinner.
- **The gate interlocks at 92x6 / 0.66 were UI.** Two crisp white lines either
  side of a doorway stop reading as fixtures. 56x8 at 0.52 is a lamp housing.

### Measured

**Darkness is a comparison, not a threshold** — this deck is a different value
from all three approved rooms, so the only honest check puts them side by side.
Mean luminance under LIGHTS OUT, both scenes paused, sampling the play window
only (the HUD bar and the touch controls excluded, because the joysticks are
the brightest thing on screen in every arena):

| room | station | mean | peak | % over 40 |
|---|---|---|---|---|
| **detention** | the walk, centre | **4.90** | 255 | 1.08% |
| **detention** | objective NW | **4.28** | 204 | 0.83% |
| **detention** | the gate | **9.09** | 208 | 3.09% |
| junction | the crossing | 5.82 | 208 | 1.74% |
| junction | west approach | 7.83 | 210 | 3.51% |
| hangar | centre | 5.65 | 204 | 1.21% |
| chamber | the nave | 3.36 | 204 | 0.45% |

Detention's dark state is **darker than both the junction and the hangar** and
its gate is the one bright place, which is the intent.

**Cost.** 44 EnvLight parts — the FEWEST of the four (chamber 66, hangar 60,
junction 58). Room load 50-85ms, the same band as the other three. `setPower`
across the whole layer **0.0105ms**, re-rasterising nothing. **Zero new
per-frame work**: no update hook, no tween, no shader. Three new 112x112
textures, **147KB** total. Part count flat at 44 across five consecutive loads
and after a tour of the other three arenas.

**Other rooms, hashed.** `tests/diag-texture-hash.mjs`, before against after:
the only differences are the three NEW detention textures, the three re-toned
detention-only props, and the detention backdrop. **The hangar, corridor and
vader backdrops are byte-identical**, and every shared texture — the console
kit, the crates, the hero machine, the shuttle, every perimeter — is unchanged.

### A PRE-EXISTING LEAK THIS PASS FOUND AND DID NOT FIX

`GameScene._clearRoomEntities` sweeps the room layer with
`this.roomLayer.getChildren().forEach((o) => o.destroy())`. `getChildren()`
returns the group's INTERNAL array and `destroy()` removes the member from it,
so the iteration **skips every other element** and one object survives each
room load. Measured: the display list grows by exactly **+1 per load**, and the
survivor here is the hangar's wall console standing in the detention block at
(148, 106). Two lines above it, the enemy sweep already uses `.slice()` for
precisely this reason.

**It is pre-existing and it was NOT fixed in this pass.** Verified on the
pre-change build at the identical +1 rate. Fixing it removes leaked objects
from every room, which means it changes what the three APPROVED arenas draw —
and a shared change that alters an approved room is exactly the case where the
brief says stop and report rather than proceed. It needs its own change with
its own evidence.

### What is open

Everything, until a human plays it. Nothing here is frozen. Specifically not
answered:

- **Whether the cell-lock lamps read at handset scale.** They were raised twice
  against a desktop monitor and are deliberately not pinned by a test.
- **Whether the south bank is worth what it costs.** It is effectively never in
  frame; it is authored as background, at 3 lamps against the north's 5, and
  the honest answer may be that it should carry less still.
- **Whether the north band is tall enough to read.** 96 of thickness is ~70px
  on screen once the HUD bar is subtracted, and the cells are small in it.
- **`prop-post` is still under the joysticks**, and it is unlit on purpose:
  declaring a face on an object almost nobody sees is light spent in the dead
  zone. Moving it is a solid body move, which this pass was not allowed to make.
- **The 3/3/2 cover grid is still a grid.** It is broken by texture and by
  power, not by position.

Evidence: `docs/evidence/arena-pilot/detention-before/` and
`detention-after/`, 40 matched frames each — stations, two motion runs (one
along the walk, one along the cell bank for shimmer), a dense wave in both
power states, and Vader with four asserted casts.

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

## 10y. DETENTION'S SECOND STATE — the handset said too black, and what changed

`2462592` went to the phone and came back with most of the room approved:
topology, open traversal, cover layout, normal-power composition, the
cell-block and processing-gate concepts, combat readability and Vader's
gameplay in it. One thing was rejected:

> The room becomes too black and visually empty during LIGHTS OUT. Combat
> remains very readable, but the environment loses too much identity. It needs
> more authored lighting and some attractive floor shine / reflected light like
> the stronger dark states in the other arenas.

### THE RULE THAT WAS WRONG, AND WHY IT LOOKED RIGHT

`§10x`'s first rule was NOTHING ON THE ESCORT FLOOR: not one emitter and not
one pixel of spill inside y [560, 840]. Every argument for it still holds — the
walk is where the fight resolves and the junction's cover ring is what happens
when a room's composition stands in its own way. It was wrong anyway, and the
frame that proves it is `dark-centre`.

**At the room's exact middle the camera shows x [440, 1160] and y [102, 1298].**
The north containment bank is at y 96 — ABOVE the top of that view. The south
bank is at y 1304 — behind the joysticks. So a rule that kept every fixture off
the walk kept every fixture out of the picture the fight happens in, and what
was left at dead centre was the player, two consoles and black. Measured as an
emergency light budget inside that rectangle (intensity x spill area landing in
view) it was **0.003 square megapixels**. It is 0.084 now — 28x.

A room can pass every negative rule it was given and still lose the argument.

### WHAT WAS ADDED: RECEIVED LIGHT, NOT MORE FIXTURES

Fifteen new sources, and **fourteen of them carry `emitter: false`** — a spill
with no source of its own, because the source is a fixture that was already
declared and what is wanted is the light it throws. That is structural, not
stylistic: an `emitter: false` strip draws its soft box and NO `TEX_FLAT` bar,
so there is not one hard edge anywhere in the set and none of it can read as a
painted mark. **THE FLOOR IS NOT GLOWING. THE FLOOR IS CATCHING.** A lit bar
lying on the deck is the full-width cyan strips this room was built to remove.

Every entry is SOURCE -> SURFACE -> FALLOFF:

| source that already existed | surface it now lands on | state |
|---|---|---|
| three of the five north lock lamps | the cell fronts they are bolted to | both, leaning emergency |
| the same three | the deck in front of those cells | both, leaning emergency |
| one south lock lamp | its cell front, and the deck below it | both, weakest in the room |
| the two secure-leaf interlocks | the deck at each bolted door | emergency only |
| the two checkpoint consoles | their own deck, on opposite sides | both, leaning emergency |
| the gate's jamb interlocks | the threshold in front of the doorway | both, strongest catch |
| the gatehouse control face | the bastion it is mounted on | both |
| a new north-bastion interlock | itself | emergency only |

### THE FOUR RULES THAT KEPT IT FROM BECOMING A RUNWAY

**SPARSE AND UNEQUAL.** Three catches under nine north bays, ONE under the
south wall's. A catch is NOT the partner of a lamp — two of the five lit north
bays get none — or the pair becomes a rhythm and the rhythm becomes a lane. No
two catches share a length, a reach or an intensity.

**THE CENTRE OF THE WALK STILL RECEIVES NOTHING**, and the width of that centre
is derived rather than chosen: x [720, 880] is 160px, the junction's own lane
(Ø112 boss plus NavGrid's 23px agent clearance a side), the narrowest gap this
game ever calls open floor. Both console catches stop clear of it by more than
a body width. That is what holds a large black negative space in the middle of
every frame.

**THE GATE'S EXTRA PRESENCE WAS SPENT ON MATERIAL, NOT ON THE PANEL.** The
obvious move for "make the landmark more present" is a bigger screen, and at
that size a bigger cyan rectangle stops being a monitor and becomes UI. The
screen is untouched. What changed is the gatehouse material around it — a
threshold reflection on the deck in front of the doorway and a graze up the
bastion the control face is mounted on. Before, the panel was a cyan rectangle
floating in black; now it is the lit part of a structure.

**AN `led` MAY NEVER BE LOUDER UNDER EMERGENCY THAN AT NORMAL POWER.** The
first build of the new bastion fixture was an `led` at 0.14 -> 0.38 and
`smoke-detention` failed it, correctly: a nominal lamp says the same thing
whether anyone is watching or not. It is a `strip` now — an interlock that
engages when the bus drops, dead at normal power, shaped like the bolt it
belongs to, the same language as the two secure leaves.

### NORMAL POWER

Unchanged in kind. Every new contribution is between 0.04 and 0.11 at normal
against 0.20-0.58 under emergency, and six of the fifteen are `normal: 0`.
`normal-centre`, `normal-gate` and `normal-cells` are matched pairs at
byte-identical camera positions.

### COST

| | before | after |
|---|---|---|
| detention EnvLight parts | 44 | 60 |
| detention display list | 95 | 111 |
| hangar / junction / chamber display list | 110 / 102 / 99 | unchanged |
| textures | — | none added |
| per-frame work | none | none |

`setPower` is N alpha writes on a state change and rasterises nothing, so
sixteen more Images cost sixteen more alpha writes twice per blackout.

### THE EVIDENCE, AND ONE THING THE RIG WAS GETTING WRONG

`docs/evidence/arena-pilot/detention-lo-before/` and `detention-lo-after/`,
eighteen matched frames each, captured by `tests/shot-detention-lo.mjs`.

**A MATCHED PAIR NEEDS A CAMERA THAT IS PLACED, NOT FOLLOWED.** The first two
runs of that rig were not comparable and it took a printed scroll value to see
it: the live follow lerps at 0.22, and at the harness's ~20fps it settled 50px
NORTH of the player on one run and 50px SOUTH on the next — 100px of
disagreement between two halves of a pair meant to differ only in lighting. The
rig now stops the follow and sets `scrollX/scrollY` by hand (the world bounds
still clamp it), and prints the scroll at every station so the next session can
see the pair is matched rather than trust it. `shot-detention.mjs` still uses
the follow and has the same weakness.

### THE ROOM-TRANSITION LEAK, FIXED

`_clearRoomEntities` swept `roomLayer.getChildren().forEach((o) => o.destroy())`.
`getChildren()` returns the group's LIVE array and a destroyed member removes
itself from it, so the splice ran under the loop's index and every other element
was skipped; the `clear` on the next line then dropped the survivors from the
group while leaving them on the scene's display list forever. Measured at +6
display objects per four-room rotation, and visible in play as a hangar wall
console standing in the detention block. Both sweeps now take `.slice()` — the
grenade sweep four lines down had the identical shape. `tests/diag-room-leak.mjs`
is the probe and asserts a fixed point across three rotations.

### WHAT IS OPEN

The dark state is with the human. The weakest part of it, stated plainly: **the
western half of the walk**, roughly x [300, 600]. The intake wall carries one
deliberately quiet lamp, the west checkpoint console carries one catch, and
between them there is very little — `dark-west` is the frame to judge that on.
It is defensible (you are walking AWAY from the lit end) and it is the first
place to spend light if the handset says the room is still too empty.

---

## 10z. THE FLOOR — why the hazes were not enough, and what a reflection is

`a88ee50` went to the phone. Everything in `§10y` was approved — the cleanup
fix, the darkness level, combat readability, the gate improvement, the local
blue/amber haze, the containment concept — with one thing still rejected:

> The new hazes are cool and should stay, but the room still feels dead. This
> is not the satisfying floor lighting / shine I wanted. I still feel like I am
> walking through blackness between glowing objects.

### THE DIAGNOSIS IS GEOMETRIC AND IT IS IN `EnvLight`

A `strip`'s spill is `len + reach` wide by **`t + reach * 2.6` tall**. Its
softness inflates BOTH axes, so asking for a wide soft catch necessarily asks
for a tall one. Every one of §10y's fourteen catches is therefore a
tall-ish soft mass sitting over the deck — which is exactly what the handset
saw and named: light in the AIR over a floor, not light ON a floor. No
intensity change could have fixed it, because the problem was never the amount.

**A SURFACE REFLECTION IS FLAT.** Long on one axis, shallow on the other, low
in opacity, lying on the plane. The aspect ratio IS the material claim: it is
what says *hard polished deck* rather than *atmosphere*.

### THE `floor` KIND

`EnvLight` gained one case, and it is the only kind whose footprint is stated
outright (`w`, `h`, optional `angle`) instead of derived from an emitter's
dimensions. Same mechanism as everything else — one ADD-blended image of the
separable box texture, whose whole documented property is that it stretches to
any ratio without the corners going wrong. No shader, no per-frame work, no new
texture, and a room that does not ask for one is byte-identical.

**A `floor` SOURCE NEVER CARRIES AN EMITTER**, structurally: the case has no
`TEX_FLAT` branch at all. If the thing casting the reflection can be seen, it
is already declared somewhere above it.

### THE NINE, AND WHAT PAID FOR THEM

| reflection | shape | reads as |
|---|---|---|
| gate threshold, contact | 262x58 | the strongest catch in the room |
| gate threshold, tail | 316x30 at -2° | it reaching further west |
| two north cell fronts | 268x38 at +5°, 214x32 at -4° | light off two lit doors |
| north secure leaf | 150x24 at +3° | the only amber on the deck |
| west checkpoint console | 196x38 | a machine on a hard floor |
| east checkpoint console | 122x28 | barely there, on purpose |
| south bank | 190x28 at -3° | the emptier wall, faintest |
| intake end | 168x34 at +3° | the end you are walking away from |

**THE ROOM DID NOT GET BRIGHTER TO PAY FOR THEM.** Six of §10y's hazes were
turned down by 0.06-0.10 first — the three north deck catches, both console
catches and the gate threshold. The budget moved from volume into surface,
which is the change the verdict actually asked for.

All nine are `normal: 0`. A polished floor throwing a visible reflection is
what a room looks like having lost its ambient and kept two fixtures; under
normal power the deck is evenly lit and there is nothing to reflect. That is
also what keeps the approved normal state untouched.

### THE CORRECTION THAT MADE IT WORK, AND IT IS WORTH THE PARAGRAPH

The first build threw the two north cell reflections north-south, as 46x196
columns — the intuitive direction for light leaving a wall. They photographed
as **SHAFTS OF FOG standing in the room**, which is the same failure the hazes
had, in a narrower costume. HEIGHT IS WHAT MAKES A SOFT SHAPE VOLUMETRIC. They
are 7:1 and 6:1 and shallow now, and they lie down.

They are also CANTED a few degrees off the wall they came from. Level with it
they would have been two short bands parallel to the deck's own long axis,
which is a lane in embryo. `smoke-detention` holds the rule generally: every
reflection at least 3.2:1, no two sharing a footprint, none longer than 420px
so nothing can cross the room.

### COST

| | §10y | now |
|---|---|---|
| detention EnvLight parts | 60 | 69 |
| detention display list | 111 | 120 |
| hangar / junction / chamber | 110 / 102 / 99 | unchanged |
| textures | — | none added |
| per-frame work | none | none |

### EVIDENCE, AND ONE MORE RIG BUG

`docs/evidence/arena-pilot/detention-fl-{before,after}/`, eighteen matched
frames each. `dark-gate` is the clearest pair: before, a rounded blob against
the wall with black deck west of it; after, a long flat sheen running out
across the floor.

**A ROOM BANNER IS HUD TEXT LYING OVER THE FRAME.** `loadRoom` schedules the
objective hint on a delay, so it can arrive minutes into a rig run and
photograph as a headline across the arena — one `dark-centre` was lost to it.
The rig kills the banner at the shutter now, alongside the camera flash and the
sector tint, for the same reason.

### WHAT IS OPEN

Nothing here. Handset play of `77975da` approved the floor treatment and found
one more thing — see `§10aa`.

---

## 10aa. THE CONSOLE — the light was behind it, and why no test could see that

`77975da` went to the phone. The floor treatment was approved and told to stay,
along with everything else in `§10y` and `§10z`. One thing came back:

> The powered consoles currently read like: dark console + LED strip / blue
> light installed behind it + haze around it. The actual screen / illuminated
> controls on the console face are comparatively dark. This is backwards
> physically.

### THE DIAGNOSIS IS A DEPTH CONSTANT, AND THE ROOM WAS BUILT EXACTLY AS
### DESCRIBED

`EnvLight` draws every source at `ENV_LIGHT_DEPTH` — **3** — which is the
project's readability gate: below the whole actor band, so environment light
can never draw over a bullet, a telegraph or the saber. A cover console sorts
at **`y + 56`** under a 112x112 opaque sprite.

So for a console screen declared in `CONSOLE_KIT`:

| part | where it is | what happens to it |
|---|---|---|
| the `TEX_FLAT` emitter bar | inside the sprite's rectangle | **never drawn** |
| the inner half of its box wash | inside the sprite's rectangle | **never drawn** |
| the outer ring of wash | clears the 112px sprite | the only thing on screen |

Which is a light installed BEHIND the console and a haze around it — the
handset's words, describing the construction precisely. It had been that way
since the kit was authored. **No check could see it**, because every check
asked whether a source EXISTED, and the sources all existed. It is the
junction reactor's failure (`§10v`) in a second costume: *ask where the light
actually LANDS, in pixels.*

In a lit room it does not matter — the painted display carries the console. In
a room whose whole dark identity is three islands of remaining power, the
consequence was the only thing left.

### THE ANSWER IS THE REACTOR'S, NOT THE REACTOR'S LOOK

`face` already exists for exactly this and its admitting rule is the junction's
second one: **IF IT LOOKS LIKE AN EMITTER, IT MUST EMIT.** A console PAINTS a
lit display; that is a claim, and `roomLayer`'s tint was multiplying it toward
black with the chassis.

Five ADD textures, painted on the console's own 28x28 canvas at the same scale
so registration is structural rather than arithmetic, registered on the live
sprite at **its depth + 1**. The depth escape is bounded by the same argument
it always was: a face's rectangle IS its host's rectangle, so every pixel it
can reach is a pixel the host already covers opaquely — `smoke-detention` now
measures that containment on the live objects rather than trusting it.

**OPT-IN PER PLACEMENT, NOT PER ARCHETYPE.** Two of detention's three powered
consoles are the SHARED kit (`ch-con-ped-a`, `ch-con-heavy`) and they stand in
the three approved arenas. Nothing about the archetype changed and no shared
texture was touched: `cover[].faces` is a per-placement declaration, plumbed in
`loadRoom` exactly as `props[].faces` already was, and a room that says nothing
gets nothing. `smoke-detention` fails if any other arena is wearing a
`dt-face-`.

### WHAT IS PAINTED, AND WHAT DELIBERATELY IS NOT

Only pixels whose ART CLAIMS TO BE POWERED — the data rows inside a recessed
display, the lock board's indicator wells, a status ribbon. The bezel, the cast
shadow inside the top lip, the key block, the shoulders and the base are
painted by neither pass and stay as dark as the room. That is the reactor's
grille doctrine: the structure has to remain visible OVER the light, or the
display is a lit rectangle pasted onto a machine.

Four values deep, in the physical order: **display → recess wash → near-metal
contamination → nothing.** The haze and the floor reflection are the room's own
authored sources and were already the only thing on screen.

Two withholdings on purpose. The pedestal's and the heavy console's **veridian
nominal lamps are painted hardware and are NOT lit** — green is bullet colour,
and small green points on a dark transfer floor are incoming fire that is not
there. The single-pixel fault lamps stay painted for the reason red always
does.

**TWO TEXTURES, NOT ONE DIMMER**, on the two consoles that have a second
composition. `dt-face-lock-emer` and `dt-face-heavy-emer` are DEAD at normal
power and carry the two regions `CONSOLE_KIT` already declares as
emergency-only — the heavy console's secondary display and the lock column's
status ribbon. The hero machine's contract, reused; the same reason it exists
there.

### THE HAZE WAS TRIMMED, NOT REMOVED

The two authored checkpoint contamination catches came down `0.38 → 0.30` and
`0.28 → 0.22`. They are the CONSEQUENCE of the checkpoint's light and for one
build they were the entire visible half of it; with the face there, carrying
both at full weight is a brighter room rather than a redistributed one. Nothing
else moved. Measured: the centre station's emergency light budget is 0.081
against 0.084 before, and 0.003 on the build the handset first rejected.

### COST

| | before | after |
|---|---|---|
| detention EnvLight parts | 69 | 74 |
| detention display list | 120 | 125 |
| textures added | — | 5 (112x112, ~50KB each) |
| per-frame work | none | **none** — a face is one more alpha write in `setPower` |

The three approved arenas are byte-identical: 66 / 60 / 58 parts, unchanged
perimeter styles, unchanged face counts (2 shuttle, 1 reactor, 0 chamber cover).

### WHAT IS OPEN

The console faces are with the human. If this is approved there is no visual
reason left not to freeze Detention whole.

---

## 11. State as of this handover

Everything is committed, pushed and deployed; `FRIX` is level with the dev
branch `claude/death-star-visual-pilot-olbbqx`. `origin/main` is unrelated and
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
