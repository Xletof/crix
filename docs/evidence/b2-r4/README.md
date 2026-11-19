# B2-R4: final reactor polish (an opt-in candidate)

**Status: a candidate for HUMAN review. It is NOT approved, NOT frozen and NOT a default.**

The candidate is a set of opt-in flags over `?b2=A|B`:

| Flag | What it does |
|---|---|
| `&b2r=4` | the visuals: B2-R3 plus three changes |
| `&b2a=B2S` | Audio B2 with a new Super sound |
| `&b2iso=1` | keeps every shipped sound effect off the gameplay random stream |

The controls stay where they were. B2-R3 is `&b2r=3`, the approved Audio B2 (with the previous Super sound) is `&b2a=B2`, and B2-B is plain `&b2=B`. Without the new flags, nothing in this document runs.

**The author can neither listen to audio nor watch playback.**
- The new Super sound was designed from synthesis principles and checked only by measurement: events, loudness, true peak, voices and offline renders.
- Motion was judged from consecutive frames and stills.
- Neither of these is an artistic judgement. The HUMAN decides.

## Playtest links

| # | What | Link |
|---|---|---|
| 1 | **B2-R4 + Audio B2S** (the candidate) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=4&b2a=B2S&b2iso=1&b2c=1&b0=B2R4S |
| 2 | B2-R4 + Audio B2 (the previous Super sound; the audio control) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=4&b2a=B2&b2iso=1&b2c=1&b0=B2R4B2 |
| 3 | B2-R3 + Audio B2 (the previous candidate, unchanged) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=3&b2a=B2&b2c=1&b0=B2R3B2 |
| 4 | B2-B (the balance and the original Super) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2c=1&b0=B2B |

All four links use the closure targeting (`&b2c=1`): hold F (or the Super button) to lock targets, and release to fire. Add `&b2range=1` for the firing range.

Links 1 and 2 differ only in the Super's sound. Links 2 and 3 differ only in the visuals, plus `&b2iso=1`, which changes which fight a seed produces but not the balance (see "The `&b2a` randomness issue" below).

## What changed: seven commits, each reversible on its own

1. **`eaa4444`: audio cannot consume gameplay randomness (`&b2iso=1`, technical, opt-in).** See "The `&b2a` randomness issue" below.

2. **`9c3711c`: the reactor holds its compressed wind-up until the Super really leaves (`&b2r=4`).**
   - In B2-R3, the gun's wind-up frames (`gun-w0`, `gun-w1`) lasted a fixed 70 ms from `player-fire-super`. The shipped wind-up then still had about two frames to run, so the reactor showed **empty** (`gun-0`) before the blast. That was the gap the HUMAN saw.
   - R4 keys the hold to the two real events, `player-fire-super` and then `player-super-blast`. Between them it shows only the compressed reactor.
   - From the blast tick it draws two frames of a new **discharge** frame (`gun-dis`): the core already dark, the channels pale coral, the barrel and muzzle white-hot, inside the rifle's silhouette.
   - After that it returns to the existing reactor. The existing cooling (the barrel heat overlay: 150, 400, 700 and 1000 ms) runs unchanged from the blast.
   - The hold ends early only if the hero dies first (a death cancels the blast). It also ends after 1.5 s as a last-resort exit, which no shipped Super path reaches.
   - **Suppression:**
     - A suppressed press is refused before `player-fire-super` (`Player.js:438`), so it starts no hold and keeps the charge.
     - Suppression that lands during the wind-up does not stop the blast (the shipped delayed call checks only `alive`). The Super leaves on R3's tick, the hold ends with it, and nothing is held afterwards.
     - The rig checks both, for the B2-1 press and the `&b2c=1` tap.
   - **`18649d1` (fix, found in review):**
     - Melee is not blocked during the 70 ms wind-up, so the blade can hide the rifle when the blast lands.
     - The two discharge frames counted only *drawn* rifle frames, so they played late, when the rifle came back (tick 16 for a blast at tick 9; the new check fails on the earlier code).
     - They now play only within 70 ms of the blast (`R4.disMaxMs`).
   - Nothing about *when* the Super happens changed. The shipped wind-up still decides the blast tick: it is the same tick in R3 and R4 on every path tested.
   - Targeting, damage, ammo and the Super economy are untouched (the parity checks below).
   - No new delay or animation was added. Only which gun frame is shown changed.

3. **`96b4bd5`: the Super's muzzle fireball in the reactor's reds (`&b2r=4`).**
   - The shipped Super fireball draws from three sources, each recoloured as follows:

     | Source | Colour mapping |
     |---|---|
     | the `explosion` sheet (both pops) | white `#ffffff` → pale pink-white `#fff0f2`; yellow `#ffee20` → scarlet `#ff4a36`; orange `#ff8810` → crimson `#d81e30`; red `#cc3010` → dark ruby `#7e0c16`; smoke `#504848` → a wine-dark `#3c1a1e` |
     | the `muzzle` image (the bloom) | white → pink-white; yellow → scarlet |
     | the disc, cone and ring Graphics | `0xffffff` → `0xfff0f2`; `0xffe0c0` → `0xffb8c0`; `0xff6040` → `0xff2a36`; `0xffd0b0` → `0xff8a96` |

   - **The colours are swapped, not repainted.** The sheets are pixel-for-pixel copies with only those colours changed (`explosion-r4`, `muzzle-r4`). The animation (`explode-r4`) copies the shipped frame count and frame rate, so the layered shape, shading and timing are the shipped ones.
   - Only the Super's own fireball uses the red copies. That covers the objects created inside `fx.superMuzzleFlash` and the two pops it places at the muzzle. A later, ordinary explosion keeps the shipped sheet (tested).
   - **Not modified:** the five pellets, their trails, impacts and trajectories, and the screen flash.
     - Proof: every object the cast creates, every frame index, emitter particle and pellet equals B2-B on 90 of 90 ticks once the two texture names are mapped back.
     - The camera flashes are identical, and so is the damage.
     - B2-R3 still equals B2-B with no mapping at all.
     - Not one yellow or orange pixel is left in the fireball.

4. **`f23631d`: the armour shield, a little more luminous (`&b2r=4`).** It is the same overlay as R3: the hero's own outer steel edge, read from the frame the sprite shows. It still has no bubble, ring, bracket, outline around the sprite, aura, or sprite redraw. The changes:

   | Element | R3 | R4 |
   |---|---|---|
   | Lit-edge alpha, by quarter (100 / 200 / 300 / 400) | 0.8 at every value | 0.80 / 0.85 / 0.95 / 1.0 |
   | Keyline glow | none | 0.35 at three quarters, 0.75 at full: the sprite's own dark outline cells that touch a lit edge cell, tinted cyan `rgb(60,190,220)`. These are cells of the sprite itself, but see the one-pixel sliver below. |
   | Shimmer | one row, every 1.6 s | two rows, every 1.3 s; highlights lifted 0.15 toward white |
   | Absorbed-hit flare (on the side it came from) | 50 ms white, then cyan until 110 ms | 50 ms white, then cyan until 140 ms; the keyline on that side flares too |
   | Break | the edge flashes (45 / 95 / 145 / 195 ms), eight shards at 4 / 10 / 16 px | the same timing, the keyline flashes too, twelve shards at 6 / 14 / 22 px fading 1 / 0.7 / 0.35 |

   - An earlier spike put the keyline glow *outside* the silhouette. At phone size it read as a halo, which is the rejected look, so it went inside (`after/shield-halo-spike-r3-keyline-outside.png`).
   - At every value R4 lights as many edge cells as R3 (14 at 100, 26 at 200), with a mean alpha at or above R3's. Nothing is drawn outside the sprite's frame.
   - **A one-pixel sliver outside the silhouette, found in the phone-size stills.**
     - At 400 and 300 only (the only values with a keyline), some of the outermost keyline cells show a sliver about one game pixel wide on their *right* side, where R3 at the same tick shows bare floor.
     - It measures 52 device pixels in a 180 × 180 phone crop at 400, and 29 at 300 (`after/shield-r4-minus-r3-diffmap-400-300-red-is-floor.png`, red).
     - The overlay's geometry is the sprite's own (`x * g − displayOriginX`, as in R3), and the game renders with `roundPixels: false`. The exact cause (a rasterisation offset, or a cell sampled at one texel being partly transparent) is not established.
     - R3's overlay probably has the same offset, but its outermost lit cells sit one step inward, so its sliver falls on the dark outline, not the floor.
     - It is a faint, half-transparent cyan hairline, nowhere near a halo or outline. If the HUMAN sees it, the smallest fix is to inset the keyline rects by one texel on their outside-facing sides (level 4 only). That is not done here.
   - The overlay was read back in sync with the sprite at all 576 renders of a whole fight.
   - Shield values, HP, i-frames and recharge are untouched: the shield and health take exactly what B2-B takes.

5. **`8e23ff0`, `9f48805`: Audio B2S, which is B2 with a new four-phase Super (`&b2a=B2S`).**

   **B2S keeps B2's approved cues.** It is B2's own kit object with only the Super replaced: the normal fire, the electrical charge, the Super-ready confirmation and the target-lock cues are B2's methods, called the same way.
   - A render without a Super differs from B2 by 1.2e-7.
   - That is below the renderer's own run-to-run noise: B2 against itself differs by 1.9e-7.

   **The four phases:**
   - **A. Compression.** Two driven saws (98 / 147 Hz) through a band-pass rising 300 → 1600 Hz. Over that, an inward noise band and a 220 → 440 Hz tension sine. It is held for at most 0.2 s and cut by the discharge.
   - **B. Discharge.**
     - A hard noise transient, a 3 kHz snap and a click.
     - A square punch 220 → 70 Hz, three detuned saws 165 → 62 Hz and a 110 Hz square.
     - A rush (noise 3500 → 600 Hz over 0.3 s) and a crackle band at 1200 Hz.
     - B2's E6 pip, falling an octave.
   - **C. Passage.** Five short separated noise zips, one voice each, 11 ms apart. There is no long laser.
   - **D. Impacts and decay.** Each impact is a square thump, a crack, a spit and a 640 Hz triangle.
     - Hits on the same tick merge into one impact. The others queue at least 40 ms apart, never more than 150 ms behind their hit, with at most six per Super.
     - An unstable decay (a falling, wavering tail) starts 90 ms after the last impact.

   **Routing and limits.**
   - The Super has its own bus (gain 0.9 × 1.45) and its own compressor. It shares B2's voice cap (48).
   - A pause cuts the compression. A death cuts the compression and the decay. A restart or quitting to the title tears everything down.
   - The game's generic hit beep is not played for Super pellet hits under B2S; the kit's impacts replace it. B2 keeps the beep.
   - Measured:
     - in a crowd of twelve, the hits merge, so impacts never form a run of beeps;
     - kit-only offline peak 0.93, no clipping;
     - peak voices, against the cap of 48: 37 in the full-mix fight (legacy B2: 25) and 36 in the five-target hold-F cast (legacy: 21). None was dropped.

## The `&b2a` randomness issue: the exact call path

Gameplay randomness is one shared stream, `Math.random`; for example, every AI cooldown draws from it. The shipped sound effects in `src/systems/FX.js` draw from the same stream every time they play:

- `tone()` (`FX.js:158`) draws one value per call when `vary` is set.
- `noise()` (`FX.js:198`) fills a fresh buffer of `sampleRate × dur` samples, **one `Math.random()` per sample**. One 0.2 s noise is about 9,600 draws at 48 kHz.
  - So the number of draws depends on whether an `AudioContext` exists (it is created on the first gesture) and on the device's sample rate.

`&b2a=…` changes **which** shipped effects are called:

1. `b2Flagship.js:577` replaces `SFX.shootSuper` (called from `Player.js:422/467` and `GameScene.js:3703`) with a counter. The shipped Super sound's `tone()` and `noise()` draws therefore disappear.
2. `b2Flagship.js:535` skips `SFX.superReady` on the meter-full edge (B2 plays its own confirmation instead).
3. Under B2S only, `b2Flagship.js:580` also skips `SFX.hit` for Super damage (`GameScene.js:3254`).
4. B2's own kit (`b2Audio.js`) draws no `Math.random`. It uses private mulberry32 streams, and the rig checks the source.

As a result, the next AI cooldown draws a different value, and the same seed plays a different fight. B2-R3 measured exactly this: B2-B plus audio B without a skin equals B2-R3 plus B2 on 780 of 780 ticks, so the audio flag diverges the fight, not the visuals.

**The isolation (`eaa4444`, `&b2iso=1`, opt-in, reversible).**
- When B2 installs, every function on `SFX` (48 of them) is wrapped. During the call, `Math.random` is a private mulberry32 stream, restored in `finally`.
- Teardown restores every original. The rig checks this at the title after restarts: 48 wrapped in play, 0 left.
- **Result:** with isolation and live audio (B2S, then B2), the fight equals the silent one tick for tick: four Supers, a Broken Wings chain and a death.
- **Control:** without isolation, live audio consumes 402,120 draws against the silent run's 19,460, and the fight diverges at tick 51.
- The flag changes no frozen module and no default.

**Not covered, and NOT resolved: the music.**
- The music loop draws `Math.random` for its noise buffers:
  - `FX.js:1166`, the shared percussion buffer, filled when the music starts;
  - `FX.js:1681`, a fresh 1.6 s crash buffer per crash (about 70,000 draws);
  - `FX.js:1723`, a 0.05 s buffer per percussion hit.
- These run from the music's own `setTimeout` bar loop (`FX.js:1611`), not through `SFX`, so `&b2iso=1` cannot reach them, and they interleave with gameplay on wall-clock timing.
- **So on a phone with music playing, the same seed still does not replay the same fight, even with `&b2iso=1`.** The rig proves the isolation only with the music not running.

**Proposed minimal fix (for HUMAN approval; NOT done).**
- The change: in `src/systems/FX.js`, fill those three music noise buffers from a private PRNG instead of `Math.random`. That is a module-level `mulberry32` from `src/systems/rng.js`, about five lines.
- Affected file: `src/systems/FX.js` only.
- Why it needs approval:
  - It changes shipped behaviour on **every** link, the R1 default included: the default's fights would stop depending on the music, and every seeded replay recorded before it would no longer match.
  - That counts as a default change.
- Isolating the shipped `SFX` calls for everyone (making `&b2iso=1` the default) is the same kind of decision.

## Evidence

**Films** (`films/`, 60 fps, real game frames from seeded fights; R3 and R4 run the same seed):

| File | What |
|---|---|
| `super-windup-blast-cooldown-r3-vs-r4-60fps.mp4` | the cast, wind-up, blast and cooling side by side |
| `shield-r3-vs-r4-60fps.mp4` | full shield, a hit, draining, the break and shards, the refill, a bush |
| `crowd-shield-r3-vs-r4-60fps.mp4` | the shield in a SWARM TIDE crowd, god mode off |
| `rifle-flicks-r3-vs-r4-60fps.mp4` | rifle fire under abrupt aim flicks; rounds identical |
| `strafe-dash-rotate-r4-60fps.mp4` | strafing N/S while firing E/W, with a dash |
| `range-expiry-r3-vs-r4-60fps.mp4` | range-end dissipation, unchanged (30/30 rounds dissipate in both) |
| `suppressed-full-denied-cast-r3-vs-r4-60fps.mp4` | full, then suppressed while firing, a denied cast at 5 s, then released. Both show only the choked frames while suppressed; R4 shows no held or discharge frame from the denied cast (from the film's own frame log). |
| `target-hold-release-cancel-r4-audio-B2S-60fps.mp4` | hold F, release, a cancelled hold, with the game's audio (B2S) |
| `fight-full-mix-r3-audio-legacy-B2.mp4`, `fight-full-mix-r4-audio-new-B2S.mp4`, `fight-full-mix-r4-audio-legacy-B2.mp4` | the same MIXED fight with music, enemy fire and every game sound, at in-game level. The gameplay is identical: 900/900 ticks. |
| `super-isolated-r3-legacy-B2-music-muted.mp4`, `super-isolated-r4-new-B2S-music-muted.mp4` | the hold-F cast with the music muted |

**Stills** (`after/`):

| File | What |
|---|---|
| `super-windup-blast-r3-top-r4-bottom-ticks-64-75.jpg` | every tick from the cast to the cooling. R3 shows the empty reactor at ticks 67–68; R4 holds the compressed frame, discharges at the blast (tick 69, the same in both) and then cools. |
| `fireball-3x-r3-top-r4-bottom-ticks-69-73.jpg` | the fireball at 3×, R3 vs R4 on the same ticks |
| `muzzle-layers-r3-left-r4-right-frames-1-3-6.png` | each fireball layer alone |
| `shield-film-r3-top-r4-bottom-full-hit-drain-break-refill-bush.jpg` | the shield across its states |
| `shield-values-r3-vs-r4-phone-1x-and-3x.png` | top: every state at phone size, in device pixels (400 / 300 / 200 / 100 / 0, the four facings, a hit, the break, a bush); bottom: the five values at 3× |
| `shield-r4-minus-r3-diffmap-400-300-red-is-floor.png` | where R4's shield pixels differ from R3's at 400 and 300: cyan on the sprite, red on bare floor (the sliver) |
| `shield-halo-spike-r3-keyline-outside.png` | the rejected spike: the keyline outside reads as a halo |
| `production-bundle-r4-full-hold-super-and-r3-super.jpg` | the production bundle: R4 at full, holding F, after the release, and R3 after its release |

**Audio** (`audio/`, FLAC; full numbers in `levels-and-exports.md` and `matched-super-excerpts.md`):

- **Level-matched Super excerpts (the comparison to listen to).** Each pair runs from 1 s before the release to 2 s after, at one common loudness (true peak ≤ −1 dBTP):

  | Pair | Common loudness |
  |---|---|
  | isolated | −27.5 LUFS |
  | isolated, phone filter | −23.7 LUFS |
  | in the fight with music and enemy fire | −22.7 LUFS |
  | in the fight, phone filter | −20.0 LUFS |

  Every export was re-measured after export: no file is above −1.0 dBTP.

- Full clips, also level-matched in pairs: the isolated cast and the full-mix fight, each full band and phone filtered.

- **In-game levels (no export gain), over the Super window (0.3 s before the release to 1.5 s after):**

  | | full band (LUFS) | true peak (dBTP) | phone filter (LUFS) |
  |---|---|---|---|
  | legacy B2, isolated | −27.1 | −4.7 | −33.1 |
  | new B2S, isolated | −26.9 | −9.5 | −33.9 |
  | legacy B2, in the fight | −26.7 | −6.3 | −30.2 |
  | new B2S, in the fight | −26.0 | −7.8 | −30.0 |

  - B2S is as loud as the legacy Super, within 0.7 LU full band and 0.8 LU on the phone filter, and it peaks 1.5–4.8 dB lower.
  - The phone filter is two 300 Hz high-passes and an 8 kHz low-pass. It is an approximation of a phone speaker, not a measurement of one.

- **A capture-rig tone (inherited, removed from these files).** Every offline full-game capture starts with a steady 440 Hz tone through the music bus: 0.67 s in the hold-F capture, 0.17 s in the fights. It is identical in R3, R4, B2 and B2S. B2-R3's delivered full-mix fight films carry it too.
  - The most likely cause: the rig's virtual clock turns `.value` writes into `setValueAtTime`, and a music voice sounds at its defaults until those land. 440 Hz is an `OscillatorNode`'s default frequency.
  - A live `AudioContext` applies `.value` writes at once. The game was not changed.
  - It is silenced in every R4 film and export before measuring (`levels-and-exports.md` gives the windows). Nothing Super-related falls inside them.

## Verification

Every suite ran standalone against the dev server. Where a suite takes `--old`, it compared against `bfa765f`, B2-R3's deploy.

| Suite | Result | Notes |
|---|---|---|
| `smoke-b2r4` (new) | **97/97** | one clean run on the final code (`smoke-b2r4.txt`), including the five suppression and blade checks added with `18649d1`. The blade check fails on the code before that fix. The earlier 92/92 run (before the fix and the §10 link correction) is in git history. |
| `smoke-b2r3` | PENDING | R3 unchanged |
| `smoke-b2r2` | 62/62 | |
| `smoke-b2r` | 38/38 | |
| `smoke-b2t` | 37/37 | |
| `smoke-b2c --old=bfa765f` | 46/46 | |
| `smoke-b2 --old=bfa765f` | PENDING | |
| `smoke-b1 --old=bfa765f` | PENDING | |
| `smoke-b0 --old=bfa765f` | PENDING | |
| `smoke-fx-p2a3 --only=10` | PENDING | the frozen-file scope guard |
| `smoke-controls` | PENDING | |
| `smoke-restart` | PENDING | |
| production bundle (`npm run build`, `vite preview`) | no page errors | the four links and a plain boot |
| `run-all` (52 suites) | PENDING | |

**Seeded parity.** B2-R4 plus B2S plus isolation equals B2-B tick for tick: state, ammo, meters, every enemy, bolt and pellet, `Math.random` draws and events.
- It held over three 1500-tick fights with four Supers and a Broken Wings chain each (one with god mode off), and with `&b2c=1` on both sides.
- It held on the shipped links with their `&b0=` labels.
- R3 vs R4 rifle rounds are identical per tick (420/420), and both draw no ribbon.
- The only shipped objects R4 hides are the cyan shield-absorb rings, as in R3.

## Imperfections and open points

- **The sound is unheard by its author.** "Low-mid weight", "no pit-pit-pit", "not a laser" are design intentions checked by measurement only: the merged and queued impacts, the 300 Hz–8 kHz energy, the absence of a sustained tone. The HUMAN's ears decide.
- **The discharge is two drawn frames within 70 ms of the blast.** That is about 33 ms at 60 fps and 67 ms at 30 fps. Below about 15 fps the second frame is skipped. It never changes the blast tick.
- **The fireball recolour has two narrow spots:**
  - During the synchronous Super call, the Graphics colour methods are briefly remapped for exactly four colours.
  - The two pops are recognised by position (16 and 44 px from the muzzle, within 200 ms). An unrelated explosion at exactly that spot in that window would also turn red. None was seen in any fight.
- **The music path above is open.** `&b2iso=1` does not make a phone fight with music reproducible.
- **The `&b2c=1` intermittent is inherited and unresolved:** a wave banner lands a tick late at tick 741 in about 1 run in 11.
- **The shield:**
  - Whether the R4 keyline at full reads as "subtle" or starts to look like the rejected shield is the HUMAN's call. If it does, the keyline (0.75 at full) is the first value to lower.
  - At 400 and 300 the keyline shows a one-game-pixel sliver outside the silhouette on some right-hand cells (above). It is documented, not fixed.

## Changed files and commits

`bfa765f..HEAD`: `src/systems/b2Audio.js`, `b2Feel.js`, `b2Flagship.js`, `b2Reactor.js` and `debug.js`, plus `tests/smoke-b2r4.mjs` (new) and `tests/README.md`. `GameScene.js`, `Enemy.js`, `FX.js` and every frozen file are untouched (the scope guard in §9).

| Commit | Content |
|---|---|
| `eaa4444` | `&b2iso=1` |
| `9c3711c` | the wind-up hold |
| `96b4bd5` | the red fireball |
| `f23631d` | the shield |
| `8e23ff0` | B2S and the rig |
| `9f48805` | B2S level and test fix |
| `18649d1` | the discharge bounded to 70 ms after the blast, plus the suppression and blade checks |

The evidence and documentation commits follow.
