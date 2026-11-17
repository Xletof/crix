# B2 REACTOR OVERLOAD — the gun as an unstable reactor

**Status:** delivered for HUMAN handset testing (2026-11-17). Opt-in candidate over B2 (`&b2r=1`), pixels only. B2-B's mechanics, R1, V2C, P1, P2-A3 and every frozen system are untouched. Nothing is approved, frozen or a default. It follows the HUMAN's REACTOR OVERLOAD direction and supersedes TEMPER's look; TEMPER (`&b2t=1`) stays selectable for comparison. With both flags set, REACTOR draws.

## Playtest links (two)

1. **REACTOR OVERLOAD:**
   https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=1&b0=B2R
2. **Current B2-B, for comparison:**
   https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b0=B2B

Optional: `&b2range=1` (the firing range), `&b2c=1` (the F-release targeting candidate, independent; see the open issue below).

## HUMAN checklist

1. **Zero charge.** Hold fire right after a Super. Is the violet stream as connected and satisfying as B2-B's?
2. **The reactor.** Fire at a group and watch the rifle: a violet core, magenta then crimson spreading from the core down the barrel, a throbbing core and one orbiting thread from three quarters, then a red gun with two threads at full. Does full make you want to release it?
3. **The stream's colour.** Violet, magenta, crimson, red as it charges. Is it always clearly yours against Marksman red aim lines, the Captain's violet, green enemy fire and gold OVERCHARGE rounds?
4. **The Super.** Two frames of compression at the barrel, a blocky burst, five dense red masses with blocky wakes, a blocky hit on each target, then the barrel cools and the core relights violet. Powerful enough? Too much red on screen?
5. **Facing up the screen.** The body hides most of the gun. Do the threads above the head still say "ready"?

## What was built (`src/systems/b2Reactor.js`)

| Piece | What it is |
|---|---|
| The gun at 0% | Always lit under the flag: a violet core in the receiver and a violet lens. The approved sprite's silhouette and outline in every frame. |
| Charging | Channels light from the core outward and down the barrel (core, then both sides, then the barrel's four). The core is always the hottest part: crimson at the core while the muzzle end is still violet. A new channel ignites white for 90 ms; each shot flares the head channel. |
| Containment pressure (from 75%) | The core throbs every 320 ms; one thread orbits the barrel slowly. |
| Critical (100%) | Four reds (dark ruby, crimson, scarlet, a hot highlight on the core and the brake), a pressure pulse to the muzzle every 0.9 s, two threads orbiting the barrel (hidden where they pass behind it). |
| Stream | TEMPER's 20-px slug at the head, with a trail long enough to reach the round behind it (from speed x cadence, so it follows the `b2x` knobs), over an elongated glow (no ball on the head). Core, body, rim, trail and glow change together, the trail one stage behind. Violet, magenta, crimson, scarlet, critical red; gold for OVERCHARGE. |
| Muzzle and contacts | Authored frames as TEMPER (fixed pixel size, frame-keyed), in the round's colours, with a small glow under the flash. |
| Super wind-up | The reactor collapses into the brake and a band closes on the muzzle (the shipped 70 ms). With `&b2c=1` this plays on the release, with the cast, never on keydown or a cancelled hold (tested). |
| Super blast | A three-frame blocky burst at the barrel over a 72 ms dim (no screen flash). |
| Super pellets | The shipped pellet object is not touched (texture, 1x1.9 scale, body, motion) and is not drawn. A dense red mass (ruby shell, crimson, scarlet, a small hot core, two frames) is drawn on it, with a blocky shrinking wake. |
| Super impacts | A three-frame blocky hit on every target a pellet damages. The shipped Super hit effects still draw too (they were frozen effects and are warm, which fits). |
| After the Super | The barrel cools through four steps in one second and the core relights violet. |

**How it stays pixels only.** The shipped Super presentation still runs, so `Math.random` is drawn exactly as in B2-B, and what it creates is hidden. Proven tick for tick below.

**Decisions taken at the phone-scale spike:**
- The first trail was a one-pixel line with gaps: at phone size the stream read as separate beads. The trail is now three rows and unbroken to its end, and meets the round behind it.
- The containment threads were three pixels long and read as noise. They are now five-pixel arcs with a bright head.
- The five Super wakes merged into one red shape near the barrel; they were shortened.

## Evidence

All films are real time at 60 fps, phone size (390x844 CSS px at 2x), the same seeded fight on all three builds tick for tick: **B2-B left, TEMPER middle, REACTOR right.**

| The brief's scenario | Where |
|---|---|
| 1. Sustained fire at zero charge | `films/range-…` 0.5–1.5 s; `films/swarm-…` after the Super (from 3.5 s) |
| 2. All charging stages at real speed | `films/range-…` 0.5–6 s; stills `after/charge-stages-b2b-temper-reactor.jpg`, `after/stream-stages-0-30-55-80-100-phone.png` |
| 3. Fast turning while firing | `films/turn-…` (240°/s, charge stepping up every 1.5 s); strip `after/turning-8-frames-…` |
| 4. Firing at empty space (tracer artefacts) | `films/turn-…` and `films/range-…`; 0 tracer violations in all nine films |
| 5. Close range and crowds | `films/swarm-…` (Sector 3 SWARM TIDE with movement); still `after/swarm-b2b-temper-reactor.jpg` |
| 6. Super-ready gun at native phone scale | `films/range-…` 5.8–7 s |
| 7. Super discharge and impacts, frame by frame | `after/super-12-frames-b2b-temper-reactor.jpg`; `films/range-…` 7 s |
| 8. Facing up, gun partly hidden | `films/turn-…` (every rotation passes north); `after/gun-stages-east-and-north-first-spike.png` |

- **How motion was judged:** I cannot watch a film. I read consecutive 60 fps frames and matched pairs.
- **Crowds are still the thinnest evidence.** The swarm film has movement and a Super, but the densest moments are short.

## Verification

| Suite | Result |
|---|---|
| `smoke-b2r` (new) | **38 / 38** |
| `smoke-b2t` | 37 / 37 |
| `smoke-b2c --old=2ee948c` | 46 / 46 |
| `smoke-b2 --old=2ee948c` | 88 / 88 |
| `smoke-b1 --old=2ee948c` | 71 / 71 |
| `smoke-b0 --old=2ee948c` | 46 / 46 |
| `smoke-fx-p2a3 --only=10` (scope guard) | 4 / 4 |
| `smoke-controls`, `smoke-restart` | pass (16 restart checks) |
| `npm run build`, production bundle in its real loop | OK, no console or page errors on REACTOR, B2-B, REACTOR + `&b2c=1`, no flags |
| `run-all`, `smoke-captel` | not re-run |

What `smoke-b2r` proves:
- **Pixels only.** `?b2=B&b2r=1` is the same fight as `?b2=B` tick for tick in three seeded fights with a held stream, four Supers and a Broken Wings chain: positions, hp, ammo, meters, every enemy, bolt and pellet, `Math.random` draws and events. The same on the two links exactly as shipped (`&b0=` telemetry on).
- **The tracer fix holds:** every visible bolt and its glow, every frame, on its round's line, never behind the barrel, ending where its round stopped; the sprites' own crop and position are read back and match.
- **The gun:** channel count and stage at seven charges; the approved silhouette and outline in every frame; the overlay, the heat and the threads on the weapon in every rendered frame of a turn and a stream; off mid-combo and dead.
- **The stream:** one round size at every stage, long enough to reach the round behind it; every object NORMAL blend at scale 1; violet / crimson / critical red at 0 / 50 / 100%, gold for OVERCHARGE; a glow under every round.
- **Frames** at 60 and 30 fps: every flash and contact shows all its frames; frame 0 never skipped.
- **The Super:** the five pellets have the shipped angles and damage, and the same body and sprite as B2-B (width, height, half sizes, radius, circle, scale 1x1.9, display size); they are only not drawn. No screen flash and none of the shipped additive blast shapes is visible (B2-B control shows both). Compression, burst, impacts on targets and the four cooling steps all seen.
- **With `&b2c=1`:** a held F plays no collapse or compression; a cancelled hold plays none; both play on the release, with the cast.
- **Restarts and quit:** one install each time; nothing left behind; every hidden shipped object is gone two seconds later.
- **Cost:** 32 pooled objects at peak against B2-B's 40 in the same fight, none additive; update time 0.04 ms per frame on either side.

In all nine films the tracer invariant reported 0 violations, and the three builds fired the same number of rounds and cast the Super on the same tick.

## The `&b2c=1` intermittent (investigated, unresolved, inherited)

- **What it is.** One seeded `&b2c=1` fight is occasionally not repeatable. At tick 741 a wave banner (`show-banner`, four objects leaving the scene, 48 `Math.random` draws) lands one tick later than in the other runs. Every position, hp and meter at that tick is identical; the fight differs afterwards because AI draws from the same stream.
- **It is not caused by TEMPER or REACTOR.** It was caught with the closure candidate alone (`?b2=B&b2c=1`, no skin): 1 run in 11 in one hunt, then 0 in 30 in an instrumented hunt. Every B2-B and skin-only fight has been repeatable in every run.
- **What was ruled out:** page order and history, browser storage, the skin's hidden effects, the audio context (suspended in every run), the skins' real-time reads (none).
- **The likely area:** a banner timed against the scene clock near the closure candidate's F-release cast. Hitstop restores on a real `setTimeout` (`systems/juice.js`), which is the one real-time clock in the gameplay path. That is a hypothesis, not a finding.
- **Rigs:** `smoke-b2t --diag=hunt` (`--alone` for the closure candidate without a skin).
- **Consequence:** do not use `&b2c=1` for seeded comparisons until it is found. Neither playtest link uses it.

## Files and flags

- **New:** `src/systems/b2Reactor.js`, `tests/smoke-b2r.mjs`.
- **Changed:** `src/systems/b2Feel.js` (chooses the skin), `src/systems/b2Flagship.js`, `src/systems/debug.js` (`b2r`), `tests/b0-scope.mjs`.
- **Flag:** `&b2r=1`, only with `?b2=A|B`. Drop it to roll back.

## Limitations

- **Untested on a handset.**
- **Facing up the screen** the body hides most of the gun; the threads above the head carry the ready state there.
- **Red is the enemy's danger colour in this game** (threat rings, telegraphs, Marksman aim lines). The critical red is a deliberate HUMAN direction. The stream separates from enemy red by mass (a 5-row slug with a 3-row trail and glow, against the Marksman's 1-px line) and by motion; whether that is enough in a crowd is the main thing to judge.
- **Enemy reactions, hit-stop, camera, cadence and sound** are unchanged.
- **The films slow the charge meter** so the stages last long enough to see; the links use B2-B's real value.
