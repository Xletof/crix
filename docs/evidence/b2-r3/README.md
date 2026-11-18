# B2-R3 — REACTOR final refinement (opt-in candidate)

**Status: a HUMAN-review candidate. NOT approved, NOT frozen, NOT a default.**
Opt-in flags over `?b2=A|B`: `&b2r=3` (visuals) and `&b2a=B2` (refined audio).
B2-R2 stays under `&b2r=2`, the original Audio B under `&b2a=B`. Without the
flags nothing here runs.

**The author cannot listen to audio or watch playback.** Sound was designed from
synthesis principles and checked by measurement only (events, loudness, band
energy, peaks, voices). Motion was judged from consecutive frames and stills.
Neither is an artistic judgement; the HUMAN decides.

## Playtest links

| # | What | Link |
|---|---|---|
| 1 | **B2-R3 + refined Audio B2** (the candidate) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=3&b2a=B2&b2c=1&b0=B2R3B2 |
| 2 | B2-R3 + original Audio B (audio control) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=3&b2a=B&b2c=1&b0=B2R3B |
| 3 | B2-R2 + Audio B (the previous candidate) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=2&b2a=B&b2c=1&b0=B2R2B |
| 4 | B2-B (balance and the original Super) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2c=1&b0=B2B |

All four use the closure candidate's targeting (`&b2c=1`): hold F (or the Super
button) to lock targets, release to fire. Add `&b2range=1` for the firing range.

## What changed — five commits, each one item, each reversible

1. **The ribbon is gone (`4a3202d`).** A single-variable change: at level 3 rounds
   are not queued for links and the link pass does not run. Everything else of R2's
   round is untouched: the short tapered slug (20 px body, 6 px tail), its core and
   colours per stage, its own glow, the muzzle flashes, the hit and wall effects,
   the range-end dissipation, and the reactor gun. Proof: same seed, 420 ticks of
   moving manual fire with abrupt flicks, dashes, walls, expiries and a Super —
   every slug, glow, muzzle, contact and dissipation sprite is identical in R2 and
   R3 on every tick (frame, active crop, position, rotation, alpha, depth); R3
   draws 0 ribbon sprites, R2 thousands. **Honest result: a stream now reads as a
   line of separate bolts with gaps between them** (see `after/stream-*.jpg`). No
   effect was added to compensate.
2. **B2-B's own Super is back (`e002d73`).** At level 3 none of the reactor's
   Super code is installed: no hiding of the shipped effects, no hidden pellets, no
   R2 masses, wake, burst, compression band, screen dim or burn-through, no
   camera-flash suppression. The shipped cast — wind-up, flash (the closure
   candidate's ice-violet one with `&b2c=1`), muzzle fireball, pops, casings,
   sparks, the five red-and-white pellets, smoke trails, impact rings — runs
   exactly as in B2-B. Proof: B2-B vs B2-R3, same seed, a five-target cast: every
   object the cast creates, every emitter particle, the pellets and both camera
   flashes identical on 90/90 ticks, enemy hp identical, nothing hidden; B2-R2
   fails the same comparison from tick 4. The persistent spiked ready ring stays
   hidden (it is not part of the attack).
   **Two known differences from B2-B's release**, both deliberate:
   - the reactor gun keeps its own wind-up frames (energy pulled into the brake)
     and its four cooling frames after the blast — they belong to the gun the
     HUMAN kept, not to the attack;
   - the P1 ring's "spend" animation (the spiked ring scaling out as the Super
     fires) stays hidden, because it is the rejected ring itself.
3. **The choked reactor (`a58b59c`).** Full charge but suppressed (Vader): every
   channel stays lit in ruby (the charge is kept), with no hot highlight, no
   pressure pulse, no orbiting threads and no armour arcs; the lens goes cold grey
   and a steel clamp closes across the channel; once every 900 ms the core strains
   to crimson for 90 ms. It is checked before the shot flash, so firing never
   flashes "ready". When the suppression ends the ready pulse restarts from its
   first step. Charge and suppression are untouched.
4. **The shield is on the armour (`46d5de4`).** No bubble, no plates. The hero's
   own outer steel edge — steel pixels on the silhouette, read from the frame the
   sprite shows, on every facing and flip — is lit cyan over the sprite at its
   frame, flip, scale and alpha (bush included), so the silhouette and base sprite
   never change. How far down the edge stays lit is the shield left (four steps,
   receding from the feet to the helmet; a gain spreads back down in 220 ms). A
   brighter row runs down the edge every 1.6 s. An absorbed hit flares white two
   pixels deep on the side it came from, then bright cyan. The last point flashes
   the whole edge and throws up to eight small shards 4 / 10 / 16 px (one per
   direction that has an edge pixel). The shipped cyan
   absorb ring (an 8→18 px circle at the hero's centre) is hidden; it still runs.
   Shield values, damage, absorption and i-frames are untouched (a hit and a break
   leave exactly B2-B's shield and health).
5. **Audio B2 (`2db78a8`, guard in `bced317`).** B's identity is kept whole — its
   shot, wheezing band-passed bed, pulse at the cadence, crackle. Added:
   - **depth**: a second bed layer, two detuned saws low in the register (55 Hz
     rising to 82 Hz with the charge) through a resonant low-pass that opens with the
     charge, driven, then high-passed at 200 Hz so that the harmonics a phone can
     play carry the low pitch. Silent at zero charge (ordinary fire sounds like B),
     growing with each quarter, beating at full;
   - **body**: a low-mid layer on shots, stage cues, tail, release, Super hits and
     cooldown, growing with the charge;
   - **Super-ready confirmation** on the transition into "the Super can be
     released" (full, not suppressed, alive): a restrained rising intake, two tuned
     pips (B5, then E6 held), a narrow metallic ring with an inharmonic partial, and
     a low resonant thunk (~0.55 s). Once per transition; again only if availability
     is lost and regained (a suppression ending while full); never while full; a
     second rise within 0.5 s is ignored. It has its own gain, so a wind-up, pause,
     death or suppression cuts it;
   - **target lock** (held-F targeting): one short pip from the same family — B5,
     rising a whole tone per lock — with no intake and no ring;
   - **release**: B's discharge with a low-mid body, opened by the E6 tone falling
     an octave (ties it to the confirmation).
   Under a suppression only the ready hum and the confirmation are withheld (firing
   keeps its bed). One voice cap (48) covers the kit and the confirmation.

   **A first draft put 43% of B2's energy below 150 Hz** (+20 dB over B there) —
   exactly the sub-bass the brief warned disappears on small speakers. It was moved
   up into the phone range before anything else was measured (see the audio
   section).

   **Offline-render fix in B and B2.** The bed pitch was set with
   `AudioParam.value =`, which in an `OfflineAudioContext` lands at render time 0;
   offline renders (R2's demo WAVs included) played the last pitch set for the whole
   clip. It is now set with `setValueAtTime` at the kit's own time — identical live.

## Evidence

### Films (`films/`, 60 fps, real gameplay speed, real input)

Every film is a deterministic seeded capture of every game tick, driven through
**real input**: CDP touch on the floating aim and move sticks and the dash button
(mobile), or Playwright keyboard and mouse (desktop). Paired films have identical
gameplay on every tick (hero position, charge, shield checked per tick), except
where noted.

| # | Brief item | Film |
|---|---|---|
| 1 | R2 vs R3 normal fire at 0%, 50%, full | `stages-0-50-full-r2-vs-r3-60fps.mp4` (touch) |
| 2 | Manual fire into empty space, rapid direction changes | `flick-touch-r2-vs-r3-60fps.mp4` (touch flicks, still then moving), `flick-desktop-r2-vs-r3-60fps.mp4` (SPACE + WASD flicks, then the mouse on the aim stick) |
| 3, 4 | East / west while strafing N / S; rotation; dashes | `strafe-dash-rotate-r2-vs-r3-60fps.mp4` (touch sticks, dash button taps) |
| 5 | Range-end dissipation | `range-expiry-r2-vs-r3-60fps.mp4` |
| 6 | Original B2-B Super vs restored | `super-b2b-vs-r3-vs-r2-60fps.mp4` (B2-B, R3, R2's rejected mass) |
| 7 | Super in a crowd, impacts | `super-crowd-b2b-vs-r3-60fps.mp4` (identical through the cast; see note) |
| 8 | Shield full, partial, hit, break | `shield-r2-plates-vs-r3-armour-60fps.mp4` |
| 9 | Ready vs suppressed-but-charged | `ready-vs-suppressed-r2-vs-r3-60fps.mp4` (incl. firing and a denied cast while suppressed) |
| 10 | Held-F selection, release, cancellation | `target-hold-release-cancel-r3-60fps.mp4` (keyboard F held, cone steered across five targets, release; a second hold cancelled by a suppression) |

Note on 7: the crowd film's two runs are identical through the filmed cast (tick
340) and diverge from tick 423. In these keyboard-driven films the browser's audio
is live, and the game's own `FX.js` sound code fills noise buffers from
`Math.random` when audio is live. Any `&b2a` kit skips two shipped sounds (the
Super shot and the Super-ready chime), so the random stream shifts after the first
Super-ready. This is inherited from B2-R2's audio flag, not caused by R3's
visuals: the kits themselves draw nothing (the B and B2 full-mix films, audio
live, are identical on all 900 ticks), and the silent seeded harness matches B2-B
tick for tick (§1). With audio live, a `b2a` fight is not tick-identical to a
no-`b2a` fight.

### Stills (`after/`)

- `stream-0-50-full-r2-left-r3-right.jpg`, `flicks-r2-left-r3-right.jpg` — the
  ribbon removed; the segmented look is visible.
- `super-r3-restored-sequence.jpg` — the restored cast at ticks 60, 64, 68, 72,
  78, 86, 96, 110 (wind-up circle, flash and fireball, the pellets, impacts).
- `composed-shield-choked-super3way.png` — frames from the composed films.
- `reactor-ready-choked-strain-west-relit.png` — ready, choked, strain beat,
  choked facing west, relit (phone scale, 2×).
- `shield-states-phone-scale.png` — none; full S / N / E / W; 300 / 200 / 100;
  hit (two beats); break (four beats — the first two are under the game's own hurt
  flash because that break let damage through); bush.
- `shield-full-hit-break-bush-zoom.png` — full; the hit's two beats (from the
  west); the break; shards; bush.

### Audio (`audio/`, FLAC; `films/*-audio-*.mp4`)

**Not a listening test.** Measured with EBU R128 (ffmpeg `ebur128`), integrated
loudness and true peak; "phone filter" = high-pass 300 Hz (4-pole) + low-pass
8 kHz, a rough small-speaker stand-in.

- **Weapon stems, level-matched** (`weapon-*-B-matched.flac` vs
  `weapon-*-B2-matched.flac`, each normalised to −20 LUFS; `-phone` versions
  filtered): rendered offline from each film's own recorded weapon-voice calls,
  so B and B2 play the identical event timeline. `fight` = a normal 15 s fight;
  `stages` = sustained fire at 0 / 50% / full with the transition to ready;
  `target` = ready confirmation, held-F locks, release, impacts, cooldown;
  `suppress` = ready, suppressed while firing, the confirmation on release.
- **The full game mix** (`fullmix-fight-B.flac`, `fullmix-fight-B2.flac`, and
  `films/fight-full-mix-r3-audio-B*.mp4`): the whole game's audio — music (combat
  tier), enemy fire, impacts, the Super, the weapon — captured on the game's own
  clock at the in-game levels (not normalised). The two differ only in the kit.
- **In-game level match.** `B2_TRIM = 0.72` on B2's bus, before its compressor,
  set on the fight's timeline so that B2 sits between the two measures:

| clip | kit | in-game I (LUFS) | TP (dBFS) | phone filter I (LUFS) |
|---|---|---|---|---|
| weapon, fight | B | −24.5 | −2.2 | −25.6 |
| weapon, fight | B2 | −23.9 | −2.8 | −26.1 |
| weapon, stages | B | −25.7 | −5.9 | −26.7 |
| weapon, stages | B2 | −25.5 | −5.3 | −27.4 |
| weapon, target | B | −29.2 | −2.4 | −33.3 |
| weapon, target | B2 | −28.5 | −3.0 | −31.9 |
| weapon, suppress | B | −27.0 | −4.9 | −27.6 |
| weapon, suppress | B2 | −26.4 | −6.4 | −27.8 |
| **full game mix, fight** | B | **−25.5** | −3.8 | **−27.6** |
| **full game mix, fight** | B2 | **−25.2** | −3.8 | **−27.8** |

  In the full mix B2 is +0.3 LU full-band and −0.2 LU through the phone filter.
  The weapon stems sit within ±0.7 LU full-band and −0.9…+1.4 LU filtered (the
  target clip is the confirmation-heavy one). No clipping: highest true peak
  −2.2 dBFS. Voices: peak 21 (B2), 14 (B), none dropped, in the fight.
- **Where B2's energy sits** (weapon stem of the fight, B2 relative to B):
  < 150 Hz +1.1 dB, 150–300 Hz +5.5 dB, 300–800 Hz +0.1 dB, 800–3 kHz +0.8 dB,
  > 3 kHz −2.3 dB. The added weight is low-mid, inside most phones' range; the
  first draft's +20 dB below 150 Hz is gone.
- **Phone speakers.** The depth layer's fundamental (55–82 Hz) is removed on
  purpose; its driven harmonics (200 Hz–1 kHz) are what a phone plays, and the ear
  infers the low pitch from them. Whether that reads as "deeper" on the HUMAN's
  phone is untested; the author cannot hear it.
- **Determinism.** `b2Audio.js` draws no `Math.random` (private mulberry32
  streams); the kits change no gameplay state (the B and B2 live-audio fights are
  identical).

## Verification

All suites standalone against the dev server; comparisons against the previous
build `40adb64` (B2-R2's deploy) where a suite takes `--old`.

(Being run at the time of this commit; the table follows in the next commit.)

## Observations (not changed)

- **The bright green wave-clear flash** in the HUMAN's Audio B recording is the
  game's own `cameras.main.flash(200, 64, 255, 128)` in
  `GameScene._onWaveCleared` (`src/scenes/GameScene.js:5756`, unchanged since
  2026-07-22). A seeded fight through a wave clear logs the same flashes at the
  same ticks with the same random draws in B2-B, B2-R2 and B2-R3. Not a B2-R3
  regression; logged here as a separate observation.
- The same wave-clear handler also plays the shipped `SFX.superReady` chime, which
  is not the B2 confirmation (B2 skips the shipped chime only on the Super meter).
  A player could confuse a wave clear with a Super-ready cue.
- The hero's cyan ground marker (`Player.glowRing`, a pulsing circle under the
  feet) is in every build and was not touched.
- Rounds fired while suppressed are still critical red: a round's colour follows
  the stored charge, and only the gun shows the suppression.

## The restored Super: weaknesses and small proposals (NOT implemented)

Each would be one reversible knob; none is in this build.

1. **The gun goes "empty" just before the blast leaves.** The charge is spent at
   the cast, the gun's wind-up frames last four ticks (~67 ms), and the shipped
   blast leaves seven ticks (~117 ms) after the cast — so for two frames (~33 ms)
   the gun shows the violet empty reactor before the Super fires (film log: wind-up
   ticks 63–66, empty 67–68, blast 69). Proposal: hold the last wind-up frame until
   the blast.
2. **The flash washes the whole screen** (with `&b2c=1`, ice-violet, 180 ms), so
   contrast drops just as the pellets appear. Proposal: a shorter or dimmer flash.
3. **The muzzle fireball is yellow-orange**, unlike the critical-red reactor it
   comes out of. Proposal: tint it toward white-red.
4. **The shipped wind-up shows a thin white circle at the hero** for a few frames
   (tick 64 in `after/super-r3-restored-sequence.jpg`). Brief, but a circle round
   the hero is what the HUMAN removed elsewhere. Proposal: keep it or drop it, as
   the HUMAN prefers.
5. **Brass casings are ejected** by an energy weapon. Proposal: replace them with
   a few hot sparks, or none.

## What remains unsatisfactory (self-review)

- **The stream looks segmented** without the ribbon, especially stationary at
  50% and full, where the gaps between bolts are regular and wide. The brief
  anticipated this; nothing was added to hide it.
- **The shield cue is small.** At phone scale the cyan edge is a one-pixel line
  on the helmet, shoulders, gauntlets and knees. The four-step drain is readable
  in stills at full vs 100, but 300 vs 400 differ only at the legs. The side
  frame has the fewest edge pixels (18, against 33 front and 32 back). A hit's flare is
  visible in stills; whether it reads in a fight is untested.
- **When damage gets through a breaking shield, the game's own hurt flash covers
  the break flash**; only the shards show.
- **The B2 confirmation is unheard.** Its tones were chosen to sit at 1–1.3 kHz
  (audible on phones, below the harshest band); whether it feels like "the reactor
  is full" is the HUMAN's call. The same holds for the depth layer, the lock pip
  and the release.
- **Level matching is by measurement**: B2 is level with B within about a dB on
  every clip measured, but loudness perception on a phone may differ from the
  meter, especially for the added low-mid.
- **With live audio, any `b2a` kit shifts the shared random stream** relative to
  B2-B (inherited from R2, explained under the films).
- **Motion was judged from frames**, not by watching playback.

## Files

- `src/systems/b2Reactor.js` — level 3: the ribbon off, the Super code not
  installed, the choked frames (`buildR3Gun`, texture `b2r3`), the armour shield
  (`R3_SHIELD`, one Graphics drawn over the hero, synced at pre-render).
- `src/systems/b2Audio.js` — kit `B2` (`kitB2`, `B2_TRIM`, `B2_TONES`), the
  confirmation edge and its 0.5 s guard, a shared voice cap, the timed bed pitch in
  B and B2.
- `src/systems/b2Feel.js` — passes the level; `src/systems/b2Flagship.js` — passes
  `dead` and `sup` to the kit; `src/systems/debug.js` — `b2r=3`, `b2a=B2`.
- `tests/smoke-b2r3.mjs` — the rig; `tests/README.md` — its notes and traps.
