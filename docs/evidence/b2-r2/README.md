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
- **What I could check, and what I could not:** that every event fires, that voices stay bounded with nothing dropped, and that an offline render peaks under full scale (A 0.77, B 0.80). That is structure, not sound. I cannot hear these. The WAV renders in `audio/` and the muxed films are for you; the decision is yours.

EVIDENCE_BLOCK

VERIFY_BLOCK

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
