# B2-R2 — combat presentation and the energy lifecycle

**Status:** delivered for HUMAN review (2026-11-17). Opt-in over REACTOR: `&b2r=2` for the visuals, `&b2a=A|B` for the audio candidates. Pixels and sound only: B2-B's damage, cadence, ammo, reloads, speeds, range, Super economy, targeting, AI and collision are unchanged and proven tick for tick. Nothing is approved, frozen or a default. REACTOR (`&b2r=1`) and TEMPER (`&b2t=1`) stay selectable.

## Playtest links

All three include `&b2c=1` (F-hold targeting, F-release Super), which the previous REACTOR link omitted.

1. **B2-R2 + Audio A (Heavy Energy Rifle):**
   https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=2&b2a=A&b2c=1&b0=B2R2A
2. **B2-R2 + Audio B (Plasma Reactor):**
   https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=2&b2a=B&b2c=1&b0=B2R2B
3. **B2-B, for comparison (B2-1 visuals and sound, F-release targeting on):**
   https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2c=1&b0=B2B

Add `&b2range=1` for the firing range.

## HUMAN checklist

1. **Strafe while firing.** Fire east, then west, while running north and south, dash, and turn quickly. The stream should bend from the barrel like water from a hose: no rods left on old lines, no detached pieces, no gap between the gun and the stream.
2. **Glow.** Is the ordinary stream luminous and connected enough at zero charge?
3. **Range.** Fire into open space. Each round should lose coherence at its range (the core contracts, a few sparks run on, gone), not blink out. Against a wall it should flare; on a body it should splash.
4. **The hero.** No circle and no spiked ring. The gun carries the charge; at full, small red arcs run over the armour (also when facing up). With a shield, four small corner plates show it; a hit flashes them, the last point breaks them. Is the shield still clear enough?
5. **The Super.** Hold F to lock, release to fire. Are the five red masses heavy enough, and do the hits read as burning through?
6. **Audio A against B.** Sustained fire, charging, the ready state, the Super, impacts, the cooldown. Which is closer to a powerful energy rifle? Neither may be right yet: the author cannot listen (below).

## What was wrong, and what changed

### A. The moving-shooter tracers (root cause)

Your recording (00:41–00:43 and 01:38–01:40) shows the same thing in both windows.

- **Not a coordinate bug.** Every round flies the correct straight line, and the origin checks were right.
- **The cause was the drawing.** REACTOR drew each round as a rigid rod about 100 px long, fixed behind its head on its own path, with hard rectangular ends. When the hero moves sideways or turns, the muzzle moves with him and the rods stay on the lines they were fired on. You see separate dashes on parallel lines, a gap between the gun and the nearest rod, and rods that stop abruptly.
- **The fix is a different stream:**
  - **The round:** each round is a short slug (a 20 px body and a 6 px tail that thins out, no hard rear edge) on its own path, with its glow.
  - **The stream:** a luminous band joins each round to the middle of the round fired before it, and the live barrel to the newest round. A moving shooter bends the stream like water from a hose; a stationary one gets one straight line.
  - **No dragging:** no round is moved off its path. The band only connects real positions.
  - **When it stops:** when a round ends, the band behind it runs on into the next round at the rounds' speed; when the trigger is released, the band at the barrel runs off after the last round.
  - **When it breaks:** across a gap in the cadence, a turn sharper than 45°, or a stretch longer than 2.2 round spacings (a dash). The tests count these breaks.
- **Glow:** after a 3x side-by-side with REACTOR showed the R2 stream was not yet brighter, the band became a body-coloured centre with dithered rims (soft, three rows wide), and both the band's and the slug's glow were raised.
- **What I rejected:** the first version joined each round to the rear of the one before. Under strafing that drew a hard zig-zag (long horizontal bodies, short steep links). Joining to the middle of the older body, with a soft band, gives a smooth diagonal stream.

### B. Range expiry

- **Classification:** a round that reaches its range (`Bullet.traveled >= range` at the kill, which is gameplay's own test) plays a four-frame dissipation, 140 ms in all: the core contracts into a hot point, three remnants run on along the flight line, dim, and go out.
- **Visual only:** the round itself stops exactly where and when gameplay stops it. No extra range, collision or lifetime.
- **Distinct outcomes:** a wall draws a flat flare across the surface with sparks thrown back; a body draws the contact splash; a round cancelled in flight (a room clear) simply ends.

### C. The hero's circles

- **What they were:**
  - The "large armour-like circle" is the **shield bubble**: `Player.shieldRing`, a filled cyan circle with a 3 px ring, drawn every frame while `shieldHp > 0` (shield pickups).
  - The spiked ring is **P1-B's Super-ready ring**, and the thin segments are its charge gauge.
  - The faint cyan "you are here" ring under the hero is a separate locator and was kept.
- **Under B2-R2:** both still run (their state is untouched) and are hidden at pre-render. The gun is the Super meter.
  - **At full charge:** small red arcs run over the shoulders, chest and weapon arm, two at a time plus an occasional third on the weapon arm. From 75%, a rare one appears on the weapon arm. They work facing north, when the gun is hidden.
  - **The shield:** four small cyan corner plates round the hero, lit by how much shield is left. A hit flashes them outward; the last point breaks them.
  - **Mechanics unchanged:** shield, invulnerability, collision and damage are untouched (tested against B2-B).
- **When the flag is off:** the P1 implementation is unchanged.
- **Bushes and suppression:** arcs and plates take the hero's bush alpha. Under Vader's suppression the arcs stop, but the gun keeps REACTOR's critical red and threads (REACTOR's approved behaviour). P1-B's dim "offline" ring has no R2 equivalent yet.

### D. The Super

- **Kept:** REACTOR's compression and burst at the barrel, and the shipped pellet object untouched (texture, 1x1.9 scale, body and motion), only not drawn.
- **The mass:** each is now a stepped, compressed block, 88x48 px.
  - White-hot only on its leading faces, crimson flanks, ruby shading on the lower side, an ink outline.
  - A soft crimson glow behind it and a short, dense wake stepping down behind its tail.
- **The hit:** each target burns through over 185 ms: a white-hot slab where the mass enters, crimson shards out of the far side, then embers.
- **Unchanged:** speed, count, damage, spread, targeting, push and collision.

### E. The audio (two candidates; I cannot listen to them)

- **A, Heavy Energy Rifle:** every round is a dense event in the band a phone speaker carries.
  - A hard electrical crack (driven band-passed noise and a 9 ms square click).
  - A distorted falling body (two detuned saws through a resonant low-pass, 236 → 118 Hz).
  - A mechanical cycling knock in the low mids, and a narrow electrical buzz.
  - Charge raises the body and opens the filter; a thin whine rises above a quarter.
  - Ready: a quiet tremolo'd hum with sparse sharp crackles.
- **B, Plasma Reactor:** a reactor bed (detuned saws through a band-pass, amplitude-pulsed at the 10 Hz cadence) runs under the stream, so each round is a pulse of one discharge.
  - Charge raises the bed, opens it and makes it waver; it crackles from three quarters.
  - The Super cuts the bed with the discharge, then it relights.
- **Both:** initial shot (sustained rounds have a lighter transient), sustained fire, charge stages, ready ambience, Super wind-up, release (a driven low-passed noise blast with detuned saws falling to ~55 Hz and a thump), Super impact, rifle impact, cooldown.
- **Safeguards:** no `Math.random` (private mulberry32 streams); a compressor on the kit's bus; one-shot voices capped at 48 and counted by scheduled end time.
- **Replaced sounds:** the shipped Super shot and ready chime are not played under `b2a`. They are noise-based and draw `Math.random` when audio is live, so on a device the random stream differs from B2-B's when audio runs. That is a pre-existing property of the shipped sound code; gameplay values are unaffected.
- **Fixes after review:**
  - The beds start every level change from the level the kit tracks, not from `AudioParam.value` (before an offline render that getter reads its initial value, and browsers differ live).
  - The beds hold off while the Super's wind-up and release play.
  - They go silent on scene pause and when the hero dies.
- **What I could check, and what I could not:**
  - **Offline:** every event fires, voices stay bounded with nothing dropped, and a render peaks under full scale.
  - **Live, in the real loop** (real clicks; the kit built on the game's own audio context): A and B both live, 20 and 19 voices at peak, none dropped, silenced on a pause.
  - That is structure, not sound. I cannot hear these. The WAV renders in `audio/` and the muxed films are for you; the decision is yours.

## Evidence

All films are real time at 60 fps, phone size (390x844 CSS px at 2x), the same seeded fight on every build tick for tick, at B2-B's real charge speed. The strafe film forces the charge in three steps, so all stages show while moving; its rounds and timings are otherwise real.

| What you asked for | Where |
|---|---|
| 1. Matched B2-B / REACTOR / B2-R2 videos | `films/strafe-…`, `films/range-…`, `films/swarm-b2b-reactor-r2-60fps.mp4` |
| 2. Firing west while strafing north and south | `films/strafe-…` 5–9 s; still `after/strafe-west-b2b-reactor-r2.jpg` |
| 3. The same eastward, plus rotation and dashing | `films/strafe-…` 0–5 s (east, a dash at 2.5 s), 9–11 s (rotation), a second dash at 7 s; stills `after/strafe-east-…`, `after/strafe-dash-…` |
| 4. Projectile bodies, glow and continuity close up | `after/closeup-3x-still-b2b-reactor-r2.png` and `after/closeup-3x-strafe-b2b-reactor-r2.png` (3x nearest neighbour, same tick); `after/strafe-*` stills |
| 5. Range dissipation frame by frame | `after/range-expiry-8-frames-zoom.png` (3x), `after/range-expiry-24-frames-phone.png` |
| 6. Gun charge and Super-ready with the circles removed | `after/full-charge-arcs-E-S-W-N-and-bush.png` (two frames per facing); `after/shield-plates-full-hit-partial-break-gone.png`; `films/range-…` (charging 0–2.5 s, full 2.5–3.6 s) |
| 7. Super release and impacts | `after/super-12-frames-b2b-reactor-r2.jpg`; `after/super-burn-through-14-frames.png` (three targets in line); `films/range-…` 3.6 s; `films/swarm-…` 2.4 s |
| 8. Audio A/B at gameplay cadence | `films/*-r2-audio-A.mp4` and `-audio-B.mp4` (the same footage with each kit), and the WAVs in `audio/` |
| The production bundle in its real loop | `after/production-bundle-stream-full-Fhold-release.png` (stream, full, F held with the targeting cone, released) |

**How the audio films were made.** The R2 films record every call to the weapon voice with its tick. Each kit then renders that exact timeline offline, and the result is muxed onto the footage. It is the sound the game would make for that fight, rendered without a sound card. The B2-B and REACTOR films have no sound.

**How motion was judged.** I cannot watch a film. I read consecutive 60 fps frames and matched pairs.

## Verification

The older suites compare against `2ee948c` (the B2-1 delivery), served on its own port. Logs are in this folder.

`smoke-b2r2` and `smoke-b2r` ran on the final code. The others ran one commit earlier. The changes since touch only what runs under `b2r=2` or `b2a`: the audio level tracking, its Super hold and pause silence, the band's weight, and the bush alpha. Those suites set neither flag.

| Suite | Result |
|---|---|
| `smoke-b2r2` (new) | **62 / 62**, one clean full run on the final code. REACTOR's inherited "fewer objects than B2-B" check is a bound here: ≤ 80, measured 53 against B2-B's 40 |
| `smoke-b2r` | **38 / 38**, one clean full run on the final code (its flag check now reads the reactor level, 1 or 2) |
| `smoke-b2t` | 37 / 37 |
| `smoke-b2c --old=2ee948c` | 46 / 46 |
| `smoke-b2 --old=2ee948c` | 88 / 88 |
| `smoke-b1 --old=2ee948c` | 71 / 71 |
| `smoke-b0 --old=2ee948c` | 46 / 46 |
| `smoke-fx-p2a3 --only=10` (scope guard) | 4 / 4 |
| `smoke-controls`, `smoke-restart` | pass (16 restart checks) |
| `npm run build`; production bundle in its real loop | OK; no console or page errors on all three links and with no flags |
| `run-all` (the full 52-suite run) | **47 / 52** (`run-all.txt`). The five failures are explained below; none is caused by B2-R2. |
| `smoke-captel` | passed inside `run-all` |

What the new checks prove:
- **Pixels and sound only:**
  - `?b2=B&b2r=2&b2a=A` is the same fight as `?b2=B` tick for tick in three seeded fights (held stream, four Supers, a Broken Wings chain): positions, hp, ammo, meters, every enemy, bolt and pellet, `Math.random` draws and events.
  - The same holds on the playtest link with its `&b0=` label.
  - Shield and health take exactly what B2-B's take.
- **The tracer fix holds under motion:** the tracer invariant, and the slug, glow and stream-link sprites read back from their own crop and position, show 0 violations under strafing, a dash, rotation and a reversal.
- **Continuity:** the threshold is ≥ 85% of successive round pairs joined and the barrel joined to the stream.
  - **Stationary and strafing north / south, firing east and west:** pairs 0.97–1.07 (values above 1 include links still collapsing behind ended rounds); barrel joined in 98–100% of frames.
  - **Under fast rotation:** pairs 0.64 and barrel 0.83, because links break past a 45° turn (reported, not required).
  - **Long links:** links over 2.2 round spacings are not drawn.
- **Range expiry:** at 60 and 30 fps every expiry (counted from `Bullet.traveled >= range` at the kill) plays every dissipation frame. The round dies where gameplay kills it; no bullet stays active.
  - In all eight directions (N, NE, E, SE, S, SW, W, NW) each expiry plays its dissipation to the last frame.
- **Distinct outcomes:**
  - Wall contacts draw the wall flare, not the dissipation or the splash.
  - Hits draw the splash.
  - Cancels draw neither.
- **The hero:** the P1-B ring and the shield bubble never reach the screen under R2, while B2-B shows both (control). Arcs show facing east and north. The plates light, flash on a hit and break.
- **The Super:**
  - The pellets have the shipped angles, damage, body and sprite (1x1.9), only not drawn.
  - There is no screen flash.
  - Burn-through plays on hits.
  - With `&b2c=1`, nothing of the release plays on a held or cancelled F.
- **Restarts and quit to title** (also on both exact playtest queries, with `b2c=1` and audio A or B): one install each time, nothing left behind.
- **Audio:** every event fires for both kits; the shipped Super shot is replaced; voices stay ≤ 48 with none dropped; the module has no `Math.random`.

### The five `run-all` failures

`run-all` ran on the commit before the final one (the changes since are flag-gated, and `run-all` sets no B2 flag). The films were recording at the same time, so its timing-sensitive suites ran under load. Each failure was re-run standalone (logs in `run-all-reruns/`, named by the build they ran against):

| Suite | Standalone on this build | On `d722707` (the previous delivery) | Reading |
|---|---|---|---|
| `smoke-vanguard-front` | PASS (30 checks) | not needed | load |
| `smoke-deflect` | PASS (73 checks) | not needed | load; on HANDOVER's inherited list |
| `smoke-boss-moves` | FAIL, 1 of 18 (a different check than in `run-all`) | FAIL, 2 of 18 | inherited, intermittent; on HANDOVER's list |
| `smoke-readability` | FAIL, 1 of 19, twice (Vader "planted through his wind-up") | FAIL in 4 of 5 runs (the same check twice, other saber checks twice), PASS once | inherited, intermittent; on HANDOVER's list |
| `smoke-champion-placement` | FAIL, 6 of 60 | not re-run (register #9: fails identically under `baseline=legacy`) | inherited |

Nothing in the R1 path changed since `d722707`. The new modules load without `?b2=` but install nothing.

## Critical self-review: what is still not right

1. **The moving stream bends correctly but can look soft.** Under strafing the band is a single bright row plus glow. At phone size it reads as one stream, but as a thinner, less muscular line than the stationary stream. A hard three-row band was worse (a zig-zag). It may need a second pass on the band's weight.
2. **Fast rotation still separates the stream.** Links break past a 45° turn between rounds. During a fast spin the stream becomes separate slugs, which is physically right but loses the "one stream" read. It's acceptable, not elegant.
3. **The five Super masses merge for the first ~100 px.** The 30° fan starts from one point, so the masses overlap into one red clump before they separate. It reads as heavy, but not yet as five distinct blocks at launch.
4. **The armour arcs are small.** At 2–3 px per stroke they are restrained as asked, but on a handset they may be too faint, especially over the hero's light armour.
5. **The shield plates are a new language.** Four corner brackets are compact and clear in stills, but they replace a full circle the player knows. Whether they read as "shielded" in a fight is the human's call.
6. **The audio is unheard by its author.** I designed it from synthesis principles and verified only that it is structurally sound. It may be wrong in ways only listening reveals (harsh, thin, repetitive, too loud against the music). Treat A and B as starting points.
7. **Range expiry is mostly off screen when firing sideways.** The range (484 px with the barrel) is about half the view, so most horizontal expiries happen at the screen edge. The dissipation is most visible firing up, down or diagonally.
8. **The `&b2c=1` intermittent is still unexplained** (above).
9. **Not run:** nothing beyond what is listed; `run-all` is reported as it finished.

## The inherited `&b2c=1` intermittent (unresolved)

- **What it is:** one seeded `&b2c=1` fight is occasionally not repeatable. A wave banner lands one tick later at tick 741; every position, hp and meter at that tick is identical, and the fight differs afterwards.
- **Where it lives:** in the closure candidate alone (caught with `?b2=B&b2c=1`, no skin). Over the last two investigations: caught in 1 of 11 runs, then 0 of 30 instrumented runs and 0 of 10 more.
- **Ruled out:** page order and history, browser storage, the skins' hidden effects, the audio context, and hitstop's real-time restore (muted by `?nofreeze=1` in every rig).
- **Not ruled out:** a browser-level event reaching the page between harness calls (focus or visibility while other pages open). I did not find the cause.
- **Consequence:** `&b2c=1` fights are not used as seeded proof; every parity claim here is made without it, and the combined candidate is verified functionally (F-hold, release, cancel).

## Files and flags

- **New:** `src/systems/b2R2Art.js` (the R2 atlas), `src/systems/b2Audio.js` (audio A and B), `tests/smoke-b2r2.mjs`.
- **Changed:**
  - `src/systems/b2Reactor.js`: R2 mode, with REACTOR unchanged under `b2r=1`.
  - `src/systems/b2Feel.js`: how a round ended (hit, wall, expiry, cancel), the wall marking, the skin options.
  - `src/systems/b2Flagship.js`: audio selection and the R2 sound events.
  - `src/systems/debug.js`: `b2r=2`, `b2a`.
  - `tests/b0-scope.mjs`.
- **Rollback:** drop `b2r=2` (REACTOR or B2-B visuals) and `b2a` (the B2-1 kit). Nothing else reads them.
