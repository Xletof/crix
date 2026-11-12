# B2-1 — The Flagship Experiment (`?b2=A|B`)

**Status:** delivered for HUMAN playtesting (2026-11-12). It is an experiment only: not approved, not frozen, not a default. R1 stays the production game; V2C / P1 / P2-A3 stay as approved; the B0 and B1 links keep working unchanged. The final verdict needs handset play.

HUMAN authorization (2026-11-12), condensed:

> Build one exceptionally satisfying automatic rifle with a reusable foundation … the gun is the meter … damage-based charging, zero normal Super-pellet self-recharge, no initial multi-kill refund … under the B2 flag, you may depart from frozen P2-A3/P1/V2C presentation … Do not promote B2 to the production default.

## Playtest links

All run over the approved V2C + P1 + P2-A3 visuals with the B0 recorder on.

- **B2-A — the new weapon, OLD economy** (per hit, Super pellets self-charge): https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=A&b0=B2A
- **B2-B — the new weapon, NEW economy** (damage-based, no self-charge): https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b0=B2B
- **Firing range** (B economy; no waves, targets on demand): https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2range=1
- **B1-G reference** (unchanged): https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b1=G&b0=G

**How to play it**

- **Touch:** press the fire stick and the stream starts; lift to stop. Drag the stick to aim by hand; leave it centred and the rifle picks its own targets. A quick tap is one round. The Super and Broken Wings buttons are unchanged.
- **Desktop:** hold **SPACE** to fire (it never becomes the Super). **F** or **ENTER** casts the Super. SHIFT dashes, R is Broken Wings.
- **End a run** by pausing, then B0 DATA → Share JSON (or QUIT TO TITLE).
- **Range panel** (top left, collapsible): SWARM, SQUAD, GUNNERS, MARKSMEN, DEMOS, BULWARK, ELITE, HORDE, CLEAR, SAFE on/off (the hero starts invulnerable there), FILL / EMPTY SUPER.

**Tuning knobs.** Add `&b2x.<knob>=<number>` to any B2 link to try a value without a new build, for example `&b2x.dmg=55&b2x.meter=1300`. The knobs and their defaults: `dmg` 65, `cadence` 100, `mag` 40, `reload` 900, `idleReload` 1100, `speed` 1000, `range` 450, `sweep` 900, `snap` 20, `lead` 1, `lethal` 1, `flinch` 600, `stop` 250, `meter` 1000, `melee` 1600, `meleeToSuper` 0.5, `nemesis` 0.34, `hot` 1.4, `hotRounds` 80.

## What was built

### The weapon (both variants)

| | R1 STANDARD | B1 | **B2 rifle** |
|---|---|---|---|
| Fire | one bolt per press | hold after a 160ms arm | **press = stream, from the first frame** |
| Cadence | 120ms, 3 rounds, then 520ms/round | 110ms for ~1.9s, then 260ms/round | **100ms, constant** |
| Damage | 120 | 120 | **65** (650/s while firing) |
| Magazine | 3, trickle | 10, trickle | **40; automatic 0.9s reload; top-up after 1.1s off the trigger; a Super cast reloads instantly** |
| Body recoil | 75px/s per shot | 75px/s per shot | **none** |
| Aim (stick centred / SPACE) | nearest enemy within 600px | same | **nearest in reach with a clear line; skips targets its rounds in flight will kill; passes over a Bulwark's field; leads moving targets; sweeps at 900°/s** |
| Knockback stagger | every hit | every hit | **once per target per 600ms** |

- **The magazine lives in the weapon's own state.** `PLAYER.ammoMax` and the pistol's pool are untouched.
- **Rounds are ordinary `playerBullets`:** the same pool, hitbox rule, walls, Bulwark fields and Vader handling as R1.
- **OVERRIDE becomes OVERCHARGE.** The rifle pickup would replace this weapon with a weaker one, so under B2 it grants 80 hot rounds at ×1.4 damage instead. The cluster pod is unchanged (with it equipped, a press throws).

### The economy (variant B only)

| Rule | R1 / B2-A | **B2-B** |
|---|---|---|
| What charges the Super | every projectile hit, × hit streak (1–2) | **durability the weapons actually removed** (overkill earns nothing) |
| Meter size | 4 hits | **1,000 durability** (about three Riflemen) |
| The Super's own pellets | charge it | **charge nothing** |
| Broken Wings damage | +1 unit per landed cast | **counts at half** |
| Nemesis | 0.34 per hit | **0.34 of damage** |
| Broken Wings meter | every projectile hit, pellets included (3 hits) | **weapon damage only, 1,600**; neither the Super nor Broken Wings itself feeds it |
| Multi-kill refund | — | **none in this test** |
| Hit streak | multiplies charge | **shown, not counted** |

The Overcharge perk (+30% Super gain) still applies. The Super itself is unchanged: five piercing pellets at 600.

### The presentation ("the gun is the meter")

One value, the Super charge, drives the whole weapon:

- **Tracers.** Each round is a streak about 80–100px long on a 100px spacing, so the stream reads as a line; every fourth round is a brighter tracer; a streak that ends on a body runs into the contact.
- **Colour.** Cold is the hero's bolt red; it climbs through orange and amber to white-gold. I chose the heat ramp after looking at frames: it reads as "hotter" at a glance, stays apart from enemy green, and is strongest exactly when the player should notice it. PRIMED adds a cyan rim at the muzzle (the hero's own colour), so "full" looks different from "hot".
- **Light.** The muzzle and flinch impacts throw an additive spill on the floor; a primed rifle breathes a faint glow under the hero.
- **Barrel ember.** A glow at the muzzle shows the charge even when not firing.
- **Hits.** The first round on a target gets the shipped white flash; rounds within the next 320ms tint it warm instead, so an enemy under the stream stays readable. Damage numbers roll up per target (one figure per ~260ms and one at the kill). The single-shot pistol's ring, spark burst and beep are not drawn per round.
- **Magazine bar.** A small bar under the hero appears when the magazine is not full: white, blinking red in the last 20%, an amber sweep while reloading, four cuts of ten rounds.
- **Sound.** A shot is three parts in three bands: a crack around 3.3kHz, a falling saw at 0.3–1kHz, and a low body. A fourth partial at 2.3–3kHz rises in level and pitch with the charge, replacing the per-hit meter blip. Each round is scheduled on its exact time, not on the frame. The reload has a click, a feed motor that rises for its whole length, and a two-click close; the music ducks slightly under a running stream.
- **HUD.** The three pistol pips are hidden. The Super and Broken Wings meters are unchanged.

### The measurement side (applies to every `?b0=` run)

- **Recovery:** hp restored by regen / Blood Pact / pickups / respawn, shield gained by wave clear / terminal / Blood Pact, and the lowest hp and hp + shield overall and per wave.
- **Stagger:** time each enemy spent with its AI suspended.
- **A `b2` block:** rounds, presses, in-hold cadence, reloads and time held through them, how each round was aimed, hits with and without the stagger, hit-stops taken and skipped, and the damage-economy ledger by source.

## Architecture

| File | Role |
|---|---|
| `src/systems/b2Flagship.js` | The weapon record (`B2_DEFAULTS`), fire loop, magazine, aim, impact budget, economy, controls |
| `src/systems/b2Feel.js` | The presentation layer: pooled streaks, muzzle, spill, contacts, hit hierarchy, number roll-up, magazine bar |
| `src/systems/b2Voice.js` | The voice kit: schedules at absolute times, so it renders live and offline |
| `src/systems/b2Range.js` | The firing range |
| `debug.js`, `BootScene.js` | The flag (`setB2`), one line |
| `GameScene.js` | The install, and ONE branch at the ordinary projectile hit |
| `b0Telemetry.js`, `b0Report.js` | Telemetry additions and the report section |

- **Seam:** instance wrappers only, each restored on shutdown if it is still ours. `Enemy.js`, `Bullet.js`, the HUD, `FX.js`, the P2-A / P1 modules, the camera, config and data are byte-identical to `266b1ac`.
- **Reuse:** a second weapon is a new record of the same knobs plus a streak style and a voice; the fire loop, impact budget, economy and presentation controller are shared.
- **Determinism:** no `Math.random` in any B2 module; spread and variation are fixed rotations; the voice's noise comes from a private stream.

## Validation

Logs are in this folder (`suites.txt` lists them).

**`smoke-b2 --old=266b1ac`: 88 / 88.**

- **Flag off = `266b1ac`, tick for tick:** R1, legacy, V2C+P1+P2-A3, with the B0 instrument, B1-G / M / S, god mode off.
- **A = B in everything but the two meters** over 1,500-tick stream fights (positions, hp, every enemy and bolt, draws, events).
- **Weapon:** first round on the press frame; every in-hold interval exactly 100ms; a tap is one round; 40 rounds, a 0.9s reload, the top-up, the Super's instant reload; 65 damage; no body velocity added; at a 30Hz step 10 rounds a second, evenly spaced.
- **Aim:** lethal bookkeeping killed three distant one-round targets with 6 rounds in 34 ticks against 12 rounds in 68 ticks with it off; the open target is taken over a nearer hidden one; a facing Bulwark is passed over; a crossing target is hit 10 of 12 with the lead and 2 of 12 without.
- **Impact budget:** a Gunner under a held stream had its AI suspended **14%** of the time. With every hit staggering (the R1 rule, as a control) it was **100%**, and it fired 1 shot in 4s instead of 4.
- **Economy:** every rule in the table above, to the unit; A keeps the R1 rule.
- **Controls:** real key events (SPACE with a full meter fires; F / ENTER cast), a real touch press and tap through the browser's touch pipeline, the cluster pod, OVERCHARGE.
- **Restarts** leave one install; quitting to the title restores every wrapper.
- **Telemetry:** the ledgers add up; recovery balances; lowest hp matches.
- **Presentation:** rounds drawn by B2 only; peak 42 pooled objects in a 12s fight; nothing left on screen a second after the stream stops; the voice's spectrum.
- **Scope:** every line under `src/` since the P2-A3 build is pinned; the Enemy.js guard passes.

**Covering suites:**
- `smoke-b1 --old=266b1ac`: 71 / 71 (the B1 links are unchanged);
- `smoke-b0 --old=266b1ac`: 46 / 46 (the instrument after its additions);
- the frozen-file sections of `smoke-fx-p2a3` / `-p2a` / `-p2a2`: 4 / 4, 4 / 4, 3 / 3;
- `smoke-controls`, `smoke-restart`, `smoke-cluster`: pass;
- `smoke-captel`: 22 checks pass standalone. In the sequential run 2 of 22 failed (its two real-time Super casts registered as 0). Standalone against `266b1ac` the same two failed, so it is an intermittent timing step that predates B2;
- `npm run build`: OK.

`run-all` (52 suites) was **not** re-run. Flag-off identity against `266b1ac` is proven tick for tick in twelve configurations.

## Performance (relative only)

`diag-b2-perf.txt`: one seeded MIXED fight, rendered at 390×844 @2x through **software GL** with a 4× CPU throttle. Absolute times mean nothing on this rig; the comparison does.

| Build | Frame mean | p50 | p95 | Display objects | Live particles |
|---|---|---|---|---|---|
| V2C+P1+P2-A3 (approved, R1 gun) | 62.9ms | 24.6 | 525 | 220 | 64 |
| B1-G (held trigger) | 64.8ms | 29.1 | 474 | 225 | 57 |
| B2-A | 63.1ms | 22.5 | 313 | 240 | 62 |
| B2-B | 61.4ms | 22.6 | 314 | 238 | 62 |

- **B2 costs no more per frame than the approved presentation** on this rig (mean ×0.98, p95 ×0.60), with about 18 more display objects and no more particles: it replaces per-shot particle bursts with pooled sprites.
- **B2's own post-update:** about 0.27ms mean under the 4× throttle (83µs unthrottled in `smoke-b2`), peaking at 42 pooled objects and 7 live streaks. Its worst single frame was 13–18ms under the throttle (10ms unthrottled); I did not find the cause and it needs a handset check.
- **A handset has not been measured.** The B0 recorder logs real frame times in every run; the first handset export will be the real answer.

## Media (in `media/`)

| File | What it shows |
|---|---|
| `charge-ramp.png` | The stream at cold, mid, hot and primed charge (720px-wide view, cropped) |
| `fight-stream.png` | The stream in a real Sector 2 wave |
| `range-phone-cold.png`, `-primed.png`, `-reload.png` | The firing range at phone size (390×844 @2x): panel, primed stream, magazine bar |
| `range-film-with-voice.mp4` | 6.8s on the range: cold to hot, a full magazine, the reload, a Super, a swarm. **Its sound is the weapon voice rendered offline from the film's own shot times; no music or other effects.** |
| `range-film-frames.png` | Six frames of that film |
| `voice-stream.m4a`, `voice-stream-spectrogram.png` | 40 rounds from cold to primed, a reload, six more rounds and the tail; the 2.3–3kHz partial visibly rises with the charge |

## Deploy

- **Build `fdf5af6`** was fast-forwarded to `FRIX` (from `266b1ac`); Pages run #296 succeeded.
- **The production bundle** (`npm run build`, served locally) was driven in its real loop with real clicks and keys for each delivery link and for no flags: no console or page errors; the range panel appears on the range link; the recorder tag shows `B0·B2B` / `B0·B2A`; SPACE streams (`media/production-bundle-real-loop.png`). The live Pages site itself cannot be opened from the build container.
- **Seen in that check:** a hero who stands still holding the trigger in Sector 1 (FRENZY) was at 210 / 1000 hp after five seconds in B2-B and 450 / 1000 in B2-A. Standing still is punished in R1 too, and I did not run the R1 comparison, but treat it as a warning about difficulty.

## Deviations from the proposal, and why

| Proposal | What was built | Reason |
|---|---|---|
| A new collider / visual split | Reused the split P2-A already has | P2-A hides the bolt and draws a tracer; I had missed that. B2 uses the same seam and draws its own style. |
| Magazine via `PLAYER.ammoMax` | The weapon's own state | No config mutation, nothing else reads it, cleaner rollback |
| "Trigger held on an empty gun < 2%" | Not a meaningful target | A held trigger reloads for 0.9s in every 4.9s by design (18%). The export records time held through reloads instead. |
| The stream never wastes a round | It keeps firing when every target in reach is already dead in flight | A trigger that silently stops reads as a hitch. Bookkeeping still halves the rounds spent. |
| OVERRIDE not addressed | OVERCHARGE (80 hot rounds) | Otherwise the pickup downgrades the weapon |
| Wrap the cluster blast for attribution | Read the game's own `_suppressHitSfx` flag | The B0 instrument wraps the same methods and installs later; a second wrapper is left behind on teardown |
| Light spill at every impact | Only on flinch hits and the muzzle | Keeps the object count down on a phone |
| No bloom pass | Kept | Unmeasured frame-time risk on a handset |

## Known limitations

- **Nothing here has run on a handset.** The harness renders through software GL. Frame-time figures below are relative only.
- **Audio was verified by spectrum, not by ear.** I cannot listen. The film's sound is the weapon voice only.
- **Balance is a starting hypothesis.** The rifle is strong (650 damage a second while firing). In B2-A the old per-hit economy plus ten hits a second fills the Super almost continuously; that link exists to show the contrast.
- **Survivability is untouched.** HP, regen, shields and enemies are R1's. With enemies no longer stagger-locked and Supers rarer, B2-B is likely harder than B1-G. The recorder now shows lowest hp per wave.
- **Frozen fights are out of scope.** Vader deflects every bolt back at half damage, so a stream is punished; the Shock Captain is untested with this weapon. Judge B2 in Sectors 1–3.
- **Damage to Vader charges by damage too** under B2-B (R1 charged one unit per hit there).
- **Desktop Super aim:** F / ENTER fire along the stream when the trigger is held, else at the nearest enemy; there is no hold-to-aim cone on the keyboard under B2.
- **Broken Wings** is charged by weapon damage only under B2-B and was not played in the B1 runs; its balance is unobserved.
