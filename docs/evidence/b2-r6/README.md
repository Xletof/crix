# B2-R6: Reactor Thunder (an opt-in experiment)

`&b2a=B2RT`, over B2-R4 (`&b2r=4&b2iso=1`), compatible with the HUMAN-approved R5 shield (`&b2aura=1`).
**Not approved, not frozen, not a default.** The HUMAN decides on a handset.

**The author cannot listen.** Everything here was designed from acoustic principles and checked by
measurement. The numbers say what the sound is made of, not whether it is good.

**The one deliberate change to B2's own behaviour (only under `B2RT`, only at the committed cast):**
B2's charge bed fades out under the Super's rush over 60 ms instead of swelling into the wind-up. The
swell was a tonal rising sound beside the rush, which is the R5 failure. The rifle, the charge
progression, the ready confirmation and the locks are untouched: rendered without a Super, B2RT equals
B2 within the renderer's noise. To revert, call `base.windupBed(t)` instead of `base.handBed(t, …)` in
`kitR6.windup` (`src/systems/b2Audio.js`).

## Baseline and verdicts carried in

- Baseline: `FRIX` at `d3ecad6` (Pages #313), the final B2-R5 state. Its run-all was 48/52, with
  `champion-placement`, `vanguard-front`, `captain-closeout` and `nemesis` failing, classified as not
  caused by R5.
- The R5 enchanted shield (`&b2aura=1`) is **HUMAN-PASS, approved and frozen**. R6 does not touch it:
  `src/systems/b2Reactor.js` and `b2Feel.js` are byte-identical to `d3ecad6`, and the shield renders
  identically per tick (see Verification).
- **R5 Heavy Cannon: rejected as final.** "A heavy door shutting, or a shotgun recorded inside a fully
  sound-insulated room": no air, room, bass, echo or energy release.
- **R5 Reactor Detonation: rejected as final.** "WWWUUUOOPPPA (electric) + BUUSH (shotgun)": two
  sounds, not one weapon firing.

## Playtest links

All four links share `https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=4&b2iso=1&b2c=1&`
and then add:

| # | Condition | Ending |
|---|---|---|
| 1 | Audio control: R5 Heavy Cannon + approved shield | `b2a=B2HC&b2aura=1&b0=R5AUHC` |
| 2 | **Candidate: R6 Reactor Thunder + approved shield** | `b2a=B2RT&b2aura=1&b0=R6AURT` |
| 3 | R6 Reactor Thunder without the aura (audio isolation) | `b2a=B2RT&b0=R6RT` |
| 4 | R4 B2S (legacy reference) | `b2a=B2S&b0=B2R4S` |

Every earlier flag still works, including `b2a=B2RD` and `b2a=B2S&b2aura=1`.

## Why R5 sounded dead and split (measured before designing)

I first looked for measurements that reproduce the HUMAN's two verdicts on R5's own renders. Band
energy cannot: Heavy Cannon already had 51% of its early energy at 200–900 Hz. The ones below do. Each
Super is rendered alone through its own kit (`createB2Audio`, OfflineAudioContext): a wind-up at
0.52 s, the blast 117 ms later, three pellet hits, no rifle and no charge bed. The figures are in
`audio/kit-path-metrics.txt` and `audio/kit-path-onsets-above-150Hz.txt`.

| Super alone, through its kit | R6 Reactor Thunder | R5 Heavy Cannon | R5 Reactor Detonation | R4 B2S |
|---|---|---|---|---|
| Energy after 150 ms | **29.5%** | 4.3% | 44.9% | 10.7% |
| Energy after 300 ms | **7.5%** | 0.6% | 3.2% | 1.3% |
| Energy after 600 ms | **0.51%** | 0.00% | 0.02% | 0.02% |
| Mid / high band (0.5–2 / 2–8 kHz) decay to −20 dB (Schroeder) | 548 / 412 ms | 195 / 195 ms | 359 / 388 ms | 481 / 370 ms |
| A second onset after the blast (10 ms envelope above 150 Hz, ≥ 6 dB rise) | **none** | impacts at −13.5 dB | **−1.8 dB at +245 ms** (the collapse) | impacts at −4.6 / −3.9 dB |
| Rush level 5 ms before the blast (re blast peak) | −11.8 dB | −15.6 dB | −13.8 dB | −15.1 dB |
| Longest rising pitch glide (a tonal sweep) | none | none | **0.13 s, 14 semitones** (the "WWUUU") | none |
| Band shares (<125 / 125–500 / 0.5–2k / 2–8k Hz) | 19 / 38 / 23 / 12% | 12 / 40 / 41 / 5% | 5 / 55 / 34 / 6% | 5 / 77 / 11 / 6% |
| Stereo (side / mid; L-R correlation) | −10.4 dB; 0.83 | mono | mono | mono |

The onset row uses the envelope above 150 Hz. With the full band, a 54 Hz body ripples a 10 ms envelope
by a few dB (its period is longer than the window), which once flagged a spurious R6 "onset".

- **"Dead":** Heavy Cannon keeps 0.6% of its energy after 300 ms, and its mid and high bands are down
  20 dB within about 195 ms. Nothing in it rings.
- **"Two sounds":** Reactor Detonation has a second event within 2 dB of the first, 245 ms later,
  after a tonal rising sweep.

Two causes:

1. **The voice envelopes are short.** The voice kit's envelopes reach −80 dB at their nominal length,
   so every voice is heard for about a quarter of it.
2. **R5's Super bus squeezed what was left** (`audio/r5-chain-analysis.txt`). Rendered with and without
   its compressor and clipper:
   - Chrome's compressor added +6.2 dB of makeup gain and 6 ms of latency.
   - The body came up 6–9 dB against its own peak. The time from peak to −24 dB stretched from 100 ms
     to 200 ms, and the crest factor fell 4.6 dB: a dense, flat slam.

**The real wind-up window:** the game's 70 ms committed wind-up runs under the cast's slow-motion
(`_slowMo(0.6, 200)`), so the blast lands 7 frames (117 ms) after the cast at 60 fps, and more at lower
frame rates. That is the only time the brief allows for a pre-blast sound.

## What Reactor Thunder is

One event, rendered once per sample rate from a private seeded stream (`src/systems/b2Thunder.js`;
pure, no timers, runs in Node too). A module worker renders it off the main thread
(`b2ThunderWorker.js`). `kitR6` in `b2Audio.js` plays it and keeps live only the parts that depend on
timing. The three properties share one clock and complementary bands:

- **Energy release ("WWWHHOOOSHH", about 0.4–6 kHz).**
  - Pink and white noise through two moving bands and a short "jet" comb whose notches sweep (air
    moving).
  - Amplitude-pulsed at the reactor bed's own 160 Hz, with a little jitter, so the ready hum becomes the
    rush. Arcing crackle thickens toward the blast.
  - It starts on the committed cast, rises to its peak in about 0.11 s and holds until the real blast.
  - **It does not stop at the blast.** Over 16 ms it hands over to the rush inside the event, at the
    same level (measured below), swells about 1 dB with the burst, then disperses into the room over
    about 0.4 s.
- **Detonation ("KRA-THOOOM").**
  - **KRA:** nine Friedlander pressure micro-pulses over 26 ms. That is the textbook blast-wave shape:
    an instant rise, a positive phase, a negative phase. They run through a hard drive, with a dense
    saturated rasp of about 30 ms and short barrel resonances (1.2–4.6 kHz, ≤ 40 ms).
  - **THOOOM:** a large Friedlander pressure punch (40–150 Hz), and a low body whose pitch settles
    within about 60 ms and then holds (no falling sweep; the test's glide detector finds none). A
    saturated low-mid noise body swells about 16 ms after the crack and decays over half a second.
  - Asymmetric drive puts the low end's harmonics at 100–500 Hz, where laptops and phones play. **The
    body is the loudest of the four stems** (stems table below).
- **Air and room ("mmmmmm").**
  - Eight early reflections at 17–104 ms. Each is low-passed (darker with each bounce), diffused by a
    short allpass (no digital slapback) and gently panned.
  - An 8-line modulated feedback delay network: low-mids ring longest (about 1.3 s), mids about 0.95 s,
    highs die first (about 0.55 s). Three short low room modes (a bloom, not a drone).
  - All three layers feed it, so the room answers the whole event.
- **Projectiles and impacts.** The five projectile zips are inside the event, far below the blast.
  Impacts: same-tick hits merge, the rest at least 50 ms apart, at most three, at 0.30 / 0.18 / 0.15 of
  a rendered variant. Above 150 Hz they make no onset in the Super-alone render.
- **Mix and safety.**
  - One look-ahead peak limiter on the composite takes 0.7 dB at 44.1 kHz and 1.2 dB at 48 kHz, on the
    first crack only.
  - **No compressor and no clipper on the R6 bus;** it is a gain (`R6_TRIM` 0.70).
  - Arithmetic, not a measurement: at the default sliders (SFX 0.6, master 0.5) the event's sample peak
    reaches about −15.5 dBFS at the shared master compressor, about 5 dB under its −10 dBFS threshold.
    At SFX 1.0 it is within about 1 dB of it, so overlapping game sounds will engage it. That compressor
    is unchanged; it is shared with the R1 default.
  - The music dips 60% and recovers over 0.75 s; the other game sounds dip 40% for 0.36 s.
- **Cuts.**
  - Pause fades the Super out over 50 ms, death over 80 ms; a restart stops and disconnects it.
  - Unreleased, for example when the hero dies in the wind-up and the game's delayed blast never comes,
    the rush ends by itself by 0.48 s.
  - The upgrade draft pauses the game 900 ms of game time after a room clear (about 1.1 s real, under
    its slow-motion). If a Super clears the room, the fade then removes the tail's last part, which is
    already about 40 dB under the peak.
- **Source material:** all original synthesis. **No recorded material was used.**
  - This environment's network reaches only package registries; the CC0 sound libraries were
    unreachable, and nothing of unclear provenance was taken from packages.
  - Nothing was taken from Roblox Brainchip Arena or any other game. The reference audio was never
    supplied, so no claim of matching it is made.

### The tuning history (honest)

The event went through three mixes.

1. **First cut** (`c9140fb`): the KRA's short-term level sat about 5 dB under the body's peak.
2. **A denser KRA** (`894b209`, deployed briefly as Pages #314). Punch rose 1.5 dB, but lowering the
   pre-limiter gain also cut the body, room and in-blast rush about 2.4 dB. At matched loudness that
   left **less low end than Heavy Cannon** (low mids −6 dB in the first 150 ms), and the rush **dropped
   3.5 dB** at the hand-over. A review caught both.
3. **The final mix:** a heavier body, a continuous rush and impacts rescaled. A new test checks the
   rush across the hand-over, and the second mix fails it.

### Measurements

**Matched loudness, Super alone** (each scaled to −20 LUFS max momentary; band RMS in dBFS;
`audio/matched-bands.md`):

| | 40–125 Hz (0–1 s) | 125–500 Hz (0–1 s) | 0.5–2 kHz | 2–8 kHz | 40–125 Hz (0–150 ms) | 125–500 Hz (0–150 ms) | 125–500 Hz (150–600 ms) |
|---|---|---|---|---|---|---|---|
| R6 Reactor Thunder | **−34.7** | −31.8 | −33.9 | −36.5 | −27.2 | −26.0 | **−31.9** |
| R5 Heavy Cannon | −36.0 | −30.9 | −30.7 | −39.7 | −27.8 | −22.9 | −39.4 |
| R5 Reactor Detonation | −40.2 | −29.5 | −31.6 | −39.2 | −34.6 | −24.0 | −29.2 |
| R4 B2S | −39.7 | −28.0 | −36.3 | −38.9 | −33.8 | −20.0 | −35.0 |

At equal loudness, R6 against Heavy Cannon has:
- 1.3 dB more sub-bass over the event;
- low mids within 0.9 dB over the event;
- **3.1 dB less low mid in the first 150 ms** (Heavy Cannon's slam is concentrated there);
- 7.5 dB more in the 150–600 ms tail;
- 3.2 dB more 2–8 kHz (crack, rush and air).

**In the game** (browser path, the full game audio): the offline full-game capture rig renders the
game's own AudioContext on the stepped game clock; its inherited 440 Hz start tone is silenced first.
`audio/levels.md` has the table.

| | R6 Reactor Thunder | R5 Heavy Cannon | R4 B2S |
|---|---|---|---|
| Isolated Super window, max momentary loudness (the matching metric) | −24.7 LUFS | −24.7 LUFS | −24.0 LUFS |
| Isolated, window integrated | −28.3 LUFS | −28.1 LUFS | −26.9 LUFS |
| Isolated, phone band (300 Hz–8 kHz), max M | −27.2 | −26.6 | −29.8 |
| Isolated, laptop band (150 Hz–14 kHz), max M | −25.7 | −25.6 | −26.8 |
| Isolated, mono fold, max M (change from stereo) | −28.0 (−3.3) | −27.7 (−3.0) | −27.0 (−3.0) |
| **Punch: strongest 5 ms of the onset minus max M** | **+2.9 dB** | +8.6 dB | +8.8 dB |
| In the fight (music, rifle, charge, ready cue, impacts), max M | −23.1 | −22.6 | −22.6 |
| In the fight, punch | +4.0 dB | +6.3 dB | +8.5 dB |
| True peak, in the fight | −8.6 dBTP | −8.6 | −7.8 |

- **Level:** `R6_TRIM` 0.70 matches Heavy Cannon's isolated max momentary loudness exactly. Matching
  on window-integrated loudness instead would favour a longer sound and quietly lower its onset; R6's
  integrated figure is 0.2 LU under Heavy Cannon's anyway.
- **The rush across the hand-over** (`tools/rushstep.mjs`; the energy stem alone, 10 ms levels after
  the blast against the wind-up rush just before it):
  - final mix: **+0.6 / +0.8 / +0.8 dB** over 0–30 ms, then −0.3 dB at 40–50 ms and −3.7 dB at
    90–100 ms, a continuous rush that swells and disperses;
  - the second mix: −0.8 / −3.5 / −3.7 / −4.8 dB.

  The composite's own seam check cannot see this, because the crack fills the window. It is kept as a
  gap check only.
- **Null test** (`tools/p-null.mjs`, the Web Audio path against the Node render × 0.70): the residual
  is a steady −80 dBFS, which is B2's idle beds (gain 1e-4). Nothing in it tracks the event: its peak is
  65 dB under the event's. The browser plays the rendered event exactly, with no dynamics.
- **Stems** (48 kHz, `audio/stems/`, all −1.5 dB), max momentary loudness:

  | Stem | Max M |
  |---|---|
  | composite | −14.2 LUFS (TP −2.9 dBTP) |
  | 1 energy release | −21.9 |
  | 2 dry blast | −21.4 |
  | **3 bass / pressure body** | **−17.8** |
  | 4 room / air | −20.4 |

  The null of the stems' sum against the composite is −140 dB.
- **Voices and cost:** in a dense swarm R6 peaks at 28 voices of 48 against Heavy Cannon's saturated
  48. A blast costs 0.2 ms on the main thread (see Verification).

### The eight questions, answered candidly

1. **Larger than Heavy Cannon at comparable loudness?** By measurement, in duration, space and low end,
   yes. At matched loudness it keeps 7× Heavy Cannon's energy after 150 ms and about 12× after 300 ms.
   Its mid and high bands ring about 2.5× as long. It has 1.3 dB more sub-bass and 7.5 dB more low-mid
   tail, and it is stereo where Heavy Cannon is mono. Whether that reads as bigger is the HUMAN's call.
2. **A clear electrical release?** A rush rises from the cast:
   - at 90 ms into the wind-up it is about 12 dB above Heavy Cannon's pre-blast;
   - it is pulsed at the bed's 160 Hz and crackles;
   - it continues at the same level through the hand-over.

   **The structural limit:** the game allows about 117 ms before the blast, so most of the "WHOOSH" is
   heard through and after the KRA. Lengthening it means a longer committed wind-up, a gameplay change
   outside this brief. Whether the pulsing reads as electrical, or only as air, is the least certain
   part of the design.
3. **Does the release fuse into the blast?** By construction and by measurement: the rush continues
   (+0.6 to +0.8 dB over the hand-over), there is no second onset after the blast, and no tonal sweep.
   Reactor Detonation had both of the latter. Fusion is perceptual, though, and these are proxies.
4. **Genuine space and a satisfying decay?**
   - There are early reflections, a frequency-dependent room of about 0.6–1.3 s, and a low bloom.
   - The event is −10.6 dB at 300 ms and −21.7 dB at 600 ms in the Super-alone render, against Heavy
     Cannon's −39 and −61 dB.
   - "Satisfying" and "not a reverb added afterwards" cannot be measured.
5. **Does the first hit keep its violence?** **Less prominently than Heavy Cannon's, by measurement.**
   At matched loudness, R6's strongest 5 ms is +2.9 dB over its loudness against Heavy Cannon's +8.6
   (+4.0 against +6.3 in the fight).
   - The KRA itself is dense: nine pulses and a 30 ms rasp, with the limiter at about 1 dB.
   - But the body, rush and room carry loudness that a short slam does not, so at equal loudness the
     crack stands less proud.
   - This is the clearest trade-off for the HUMAN to judge (see the recommendation).
6. **Bass without a subwoofer?**
   - The low body's driven harmonics land at 100–500 Hz.
   - At matched loudness, R6's low mids over the event are within 0.9 dB of Heavy Cannon's, but 3.1 dB
     under in the first 150 ms. Its sub-bass is 1.3 dB over.
   - Through a 300 Hz–8 kHz phone-band filter R6 is 0.6 LU under Heavy Cannon and 2.6 LU over B2S;
     through a laptop band, 0.1 LU under Heavy Cannon.
   - A filter is not a handset.
7. **A clean tail in rapid combat?** The tail is down 22 dB by 450–600 ms. The music dips for it. In
   the fight film the rifle sits over it, and in the dense swarm R6 used 28 voices against Heavy
   Cannon's saturated 48. Masking of later shots cannot be judged without listening.
8. **Different from R5, not just louder or wetter?** It is matched in level, not louder. It is built
   differently from the source up:
   - it is rendered, not made of voices;
   - it has no bus compressor or clipper;
   - the rush crosses the blast;
   - the crack is made of blast-wave pulses;
   - the room is fed by the whole event.

   Its measured shape (late energy, no second onset, no sweep, stereo, low-end balance) differs from
   both R5 kits.

## Evidence

- `audio/`:
  - `super-isolated-*` and `super-in-fight-*` (FLAC, the browser captures, 1 s before to 2 s after the
    blast), for R6, R5 Heavy Cannon and R4 B2S:
    - `native`: one gain for the three, keeping in-game relative levels; loudest true peak −1 dBTP;
    - `matched`: equal max momentary loudness, TP ≤ −1 dBTP;
    - `matched-phone-band` and `matched-mono`.
  - `super-alone-kit-path-matched-*`: the four Supers alone through their kits, matched at −20 LUFS
    max M. This is the cleanest listening comparison, and it includes Reactor Detonation.
  - `stems/` (24-bit FLAC, 48 kHz, all −1.5 dB): `stem-0-composite` (the event as the kit plays it at
    60 fps), `stem-1-energy-release`, `stem-2-dry-blast`, `stem-3-bass-pressure-body`,
    `stem-4-room-air`, `rush-unreleased`, `impact-1..3`. **Diagnostic only;** their sum nulls against
    the composite at −140 dB.
  - `levels.md`, `metrics.txt` (the captures), `kit-path-metrics.txt`,
    `kit-path-onsets-above-150Hz.txt`, `matched-bands.md`, `r5-chain-analysis.txt`.
- `img/`:
  - `isolated-RT-HC-S.png`, `in-fight-RT-HC-S.png`: waveform and log-frequency spectrogram, the blast
    in red.
  - `super-alone-kit-path.png`: all four Supers.
  - `stems-48k.png`: the composite and the four stems.
- `films/`: `fight-R6-reactor-thunder-aura.mp4`, `fight-R5-heavy-cannon-aura.mp4`, `fight-R4-B2S.mp4`.
  Each is a 15 s seeded fight at 60 fps with the full game audio (music, rifle, charge, ready cue, the
  Super, impacts). The R6 and Heavy Cannon films are frame-identical (900 of 900): only the sound
  differs.
- `tools/`: the scripts that produced these numbers.
- Suite logs: `smoke-*.txt`, `run-all.txt`, `run-all-reruns/`.

## Verification

All suites ran standalone and sequentially. The previous build is `d3ecad6`, served from its own
worktree on :5174 with its own Vite cache.

- `tests/smoke-b2r6.mjs` **55/55 on the final code** (`smoke-b2r6.txt`):
  - **flags:** the four conditions and every older audio flag;
  - **parity:** R6 with and without the aura equals B2-B tick for tick in mixed (s6), swarm and
    god-mode-off fights, with four Supers and a Broken Wings chain;
  - **in the game, with live audio:**
    - the wind-up sound starts only on the committed cast;
    - none during a 40-tick held-F aim, a cancelled hold, or a suppressed press or release, and no
      Super voice is live during the aim;
    - one event per real blast, each taking over the rush;
    - the generic hit beep routed;
  - **renders:**
    - B2RT without a Super equals B2;
    - B2, B2S, B2HC and B2RD equal `d3ecad6`'s `b2Audio.js` within each kit's own run-to-run noise;
    - the structure;
    - the composite seam at 83 / 117 / 250 ms: no dip, the blast lands 9–23 dB above the rush;
    - **the rush continues across the hand-over (+0.6 / +0.8 / +0.8 dB), and the second mix fails the
      same check (−3.5 dB);**
    - unreleased, the rush returns to the idle floor by 0.5 s;
    - pause fades in 50 ms and death in 90 ms, both to the idle floor;
    - deterministic buffers at 44.1 and 48 kHz, finite, at the ceiling, limiter under 1.5 dB;
    - no legacy layer;
    - no falling glide (the same detector flags B2S's);
  - **the approved shield:** `b2Reactor.js` and `b2Feel.js` byte-identical to `d3ecad6`. In a 600-tick
    rendered fight (the aura drawn on 329 ticks), every object on screen, including the aura's draw
    commands, is identical per tick to the Heavy Cannon link and to `d3ecad6`;
  - **restarts:**
    - one install each time;
    - over three runs with live audio, each has one wind-up, one event, and buffer sources = rush +
      event + impacts, nothing from old kits;
    - the render is reused, never redone, and the old Super bus is disconnected;
  - **the shipped links:** labels, and the same fight as B2-B;
  - **isolation:** live audio equals the silent run, with the worker and with no `Worker` (per-frame
    job);
  - **voices** (SWARM TIDE on the game clock, the rifle held 1460 ticks, five Supers): B2RT peaks at
    **28 of 48, nothing dropped**, five events for five casts. B2HC reaches 48 of 48 and drops 18; B2S
    reaches 48 and drops 1;
  - **cost:**
    - the worker renders in 150 ms off the main thread and is ready 0.30 s after the kit is built;
    - with no `Worker`, the per-frame job costs a median 1.5 ms, a p95 of 4.5 ms and a cold maximum of
      13.6 ms per frame (this desktop harness; a phone is slower);
    - a blast costs 0.2 ms on the main thread (B2HC 1.8 ms);
    - the audio update per frame is 0.011 ms for both;
  - **scope:** the B0/B1/B2 guard passes, and R6 touches only `b2Audio.js`, `b2Thunder.js`,
    `b2ThunderWorker.js` and the flag lines in `debug.js` / `b2Flagship.js`.
- Covering suites, run on `894b209` (the second mix):
  - smoke-b2r5 63/63, smoke-b2r4 97/97, smoke-b2r3 81/81, smoke-b2r2 62/62, smoke-b2r 38/38,
    smoke-b2t 37/37;
  - against `d3ecad6`: smoke-b2c 46/46, smoke-b2 88/88, smoke-b1 71/71, smoke-b0 46/46;
  - P2-A3 scope 4/4; controls pass; restart 16 checks pass.

  Since then the code changed only R6 data (`THUNDER.mix`, `R6_TRIM`, R6's impact gains) and the R6
  test. None of those suites installs B2RT, and smoke-b2r6 re-verified parity and the controls' renders
  on the final code.
- **run-all 47/52, NOT green, and no new failure** (`run-all.txt`, `run-all-reruns/README.md`), run on
  `894b209`:
  - `champion-placement` (7/60), `vanguard-front` (1/30) and `captain-closeout` (1/60) fail standalone
    on this build and on `d3ecad6` on the same checks: inherited;
  - `boss-moves` (1/18) and `pathing` (a sampler artefact by its own message) pass standalone;
  - `nemesis`, intermittent in the R5 baseline, passed;
  - **the failing set differs from R5's 48/52**, and `vanguard-front` now fails standalone on both
    builds, where R5 recorded a standalone pass;
  - none of these suites installs B2, so R6's code (later changed only in R6 data) does not run in them.
- **Production bundle** (`vite build`, `vite preview`, on `894b209`): no page errors on the four links
  or the no-flag link. On the R6 link the built worker chunk is fetched (HTTP 200), starts, delivers
  and is closed.
- **Notes for honesty:**
  - The capture rig's stepped clock reaches the first cast before the worker answers, so the captures
    use the on-the-spot render: the same buffers, by the determinism check.
  - The capture rig carries the inherited 440 Hz start tone, silenced before measuring.
  - In one early run B2HC differed from `d3ecad6` by 1.1e-6. Its own run-to-run spread on one build
    later measured 1.07e-6: render jitter, not a code difference.
  - A first version of §8 counted voices against a live AudioContext while the game was stepped far
    from real time. Both kits hit the cap there (a harness artefact); §8 now counts on the game clock.

## Recommendation (critical)

**Play link 2 (R6 + shield) against link 1 (Heavy Cannon + shield) back to back. Treat R6 as a better
candidate than either R5 sound, not as a finished one.** The author has not heard it.

**What R6 changes, by measurement:**
- Both R5 verdicts had measurable causes, and R6 removes them. There is energy after the hit, every band
  rings, there is no second event and no tonal sweep, no compressor flattens the blast, and at matched
  loudness the low end is at least Heavy Cannon's over the event.
- The rush crosses the blast at a continuous level, so the electrical part and the physical part are
  one event.
- It is matched in loudness, so any "bigger" the HUMAN hears does not come from more volume.

**What may still fail, most likely first:**
1. **The first hit.** At matched loudness, R6's crack stands about 5.7 dB less proud of its loudness
   than Heavy Cannon's in isolation (2.3 dB in the fight), and its first 150 ms has 3.1 dB less low-mid
   slam.
   - This is the price of a heavy body, room and rush.
   - If the KRA feels soft, the levers are `THUNDER.mix.crack` / `grit` (more KRA) against `body` /
     `late` (less sustain).
   - Measured: the second mix had +2 dB more punch and the thin low end described above.
2. **The rush is short before the blast.** The game gives about 117 ms between the committed cast and
   the blast, so the "WWWHHOOOSH" is mostly heard through and after the KRA.
   - If the energy release does not register, the levers are `THUNDER.mix.pre` / `post` (keep
     `post × out ≈ pre` for continuity).
   - The real fix would be a longer committed wind-up: a gameplay change, and the HUMAN's call.
3. **Synthesis may still sound synthetic.** Every layer is original DSP: Friedlander pulses, noise,
   resonators, a delay-network room. No recorded or licensed material was available here.
   - If it reads as artificial, the most promising step is a recorded or licensed physical transient
     in place of the KRA micro-pulses. The renderer can take a sample in that slot with no other change.
   - The file must be supplied, or a source host allowed.
4. **The room may read as "reverb added".** It is fed by the whole event and pre-delayed.
   - If it sounds like a wash, the levers are `THUNDER.room` (`rtMid` / `rtLow`) and `mix.late` / `er`.
   - If it is not noticed, raise `mix.late`.
5. **Small speakers.** Simulated phone and laptop bands put it level with Heavy Cannon. A filter is not
   a handset.

**Levers:** all the settings are data in `src/systems/b2Thunder.js` (`THUNDER.mix`, `THUNDER.room`).
The level is `R6_TRIM` in `b2Audio.js`. A change re-renders the event; the tests check its structure,
the hand-over and the limiter again.

**Not approved, not frozen, not a default.** The approved R5 shield is untouched.
