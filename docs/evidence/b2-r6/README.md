# B2-R6: Reactor Thunder (an opt-in experiment)

`&b2a=B2RT`, over B2-R4 (`&b2r=4&b2iso=1`), compatible with the HUMAN-approved R5 shield (`&b2aura=1`).
**Not approved, not frozen, not a default.** The HUMAN decides on a handset.

**The author cannot listen.** Everything here was designed from acoustic principles and checked by
measurement. The numbers say what the sound is made of. They do not say whether it is good.

## Baseline and verdicts carried in

- Baseline: `FRIX` at `d3ecad6` (Pages run #313), the final B2-R5 state. Its run-all was 48/52, with
  `champion-placement`, `vanguard-front`, `captain-closeout` and `nemesis` failing and classified as not
  caused by R5. That classification is R6's regression baseline.
- The R5 enchanted shield (`&b2aura=1`) is **HUMAN-PASS, approved and frozen**. R6 does not touch it:
  `src/systems/b2Reactor.js` and `b2Feel.js` are byte-identical to `d3ecad6`, and the shield renders
  identically per tick (see Verification).
- **R5 Heavy Cannon: rejected as final.** "A heavy door shutting, or a shotgun recorded inside a fully
  sound-insulated room."
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
energy cannot: Heavy Cannon already had 51% of its early energy at 200–900 Hz. These measurements do:

| Super alone, through its kit (same scene, same timing) | R6 Reactor Thunder | R5 Heavy Cannon | R5 Reactor Detonation | R4 B2S |
|---|---|---|---|---|
| Energy after 150 ms | **19.8%** | 4.3% | 44.9% | 10.7% |
| Energy after 300 ms | **4.5%** | 0.6% | 3.2% | 1.3% |
| Energy after 600 ms | **0.29%** | 0.00% | 0.02% | 0.02% |
| Mid / high band (0.5–2 / 2–8 kHz) decay to −20 dB (Schroeder) | 523 / 376 ms | 195 / 195 ms | 359 / 388 ms | 481 / 370 ms |
| A second onset after the blast (10 ms envelope, ≥ 6 dB rise) | **none** | impacts at −5.8 dB | **0.0 dB at +242 ms** (the collapse) | impacts at −4.4 dB |
| Rush level 5 ms before the blast (re blast peak) | −9.2 dB | −15.6 dB | −13.8 dB | −15.1 dB |
| Longest rising pitch glide (tonal sweep) | none | none | **0.13 s, 14 semitones** (the "WWUUU") | none |
| Stereo (side / mid; L-R correlation) | −10.1 dB; 0.82 | mono | mono | mono |

Source: `audio/kit-path-metrics.txt`. Each Super is rendered through `createB2Audio` with a wind-up at
0.52 s, the blast 117 ms later and three pellet hits, with no rifle and no charge bed.

- **"Dead":** Heavy Cannon keeps 0.6% of its energy after 300 ms, and its mid and high bands are down
  20 dB within about 195 ms. Nothing in it rings.
- **"Two sounds":** Reactor Detonation has a second event as loud as the first, 242 ms later, after a
  tonal rising sweep.

Two causes:

1. **The voice envelopes are short.** The voice kit's envelopes reach −80 dB at their nominal length,
   so every voice is heard for about a quarter of it.
2. **The R5 Super bus squeezed what was left** (`audio/r5-chain-analysis.txt`). Rendered with and
   without its compressor and clipper:
   - Chrome's compressor added +6.2 dB of makeup gain and 6 ms of latency.
   - The body came up 6–9 dB against its own peak. Heavy Cannon's peak-to-−24 dB time stretched from
     100 ms to 200 ms, and its crest factor fell 4.6 dB.
   - The result was a dense, flat, short block: a slam rather than a blast.

**The real wind-up window:** the game's 70 ms committed wind-up runs under the cast's slow-motion
(`_slowMo(0.6, 200)`), so the blast lands 7 frames (117 ms) after the cast at 60 fps, and more at lower
frame rates. That is the only time the brief allows for a pre-blast sound.

## What Reactor Thunder is

One event, rendered once per sample rate from a private seeded stream (`src/systems/b2Thunder.js`;
pure, no timers, runs in Node too). A module worker renders it off the main thread
(`b2ThunderWorker.js`). `kitR6` in `b2Audio.js` plays it, keeping live only the parts that depend on
timing. The three properties share one clock and occupy complementary bands:

- **Energy release ("WWWHHOOOSHH", about 0.4–6 kHz).** Pink and white noise through two moving bands
  and a short "jet" comb whose notches sweep (air moving). It is amplitude-pulsed at the reactor bed's
  own 160 Hz with a little jitter, so the ready hum becomes the rush, and arcing crackle thickens toward
  the blast. It starts on the committed cast, rises to its peak in about 0.11 s and holds until the
  blast. **It does not stop at the blast:** it hands over (equal power, 16 ms) to the rush inside the
  event, which bursts brighter with the crack and then disperses into the room over about 0.4 s.
- **Detonation ("KRA-THOOOM").**
  - **KRA:** a cluster of nine Friedlander pressure micro-pulses over 26 ms. A Friedlander pulse is the
    textbook blast-wave shape: an instant rise, a positive phase, a negative phase. They run through a
    hard drive, with a dense saturated rasp of about 30 ms and short barrel resonances (1.2–4.6 kHz, ≤ 40 ms).
  - **THOOOM:** one large Friedlander pulse (the pressure punch, 40–150 Hz) and a low body. The body's
    pitch settles within about 60 ms and then holds; there is no falling sweep, and the test's glide
    detector finds none. It also has a saturated low-mid noise body that swells about 16 ms after the
    crack, so the KRA comes first, and decays over half a second.
  - Asymmetric drive puts the low end's harmonics at 100–500 Hz, where laptops and phones play.
- **Air and room ("mmmmmm").**
  - Eight early reflections at 17–104 ms. Each is low-passed (darker with every bounce), diffused by a
    short allpass so it is not a digital slapback, and gently panned.
  - Then an 8-line modulated feedback delay network: low-mids ring longest (about 1.3 s), mids about
    0.95 s, highs die first (about 0.55 s).
  - Three short low room modes (47 / 71 / 103 Hz, a bloom rather than a drone).
  - All three layers feed it, so the room answers the whole event rather than being bolted onto a dry hit.
- **The five projectile zips** are inside the event, far below the blast. **Impacts:** same-tick hits
  merge, the rest are at least 50 ms apart, at most three, at 0.5 / 0.3 / 0.24 of a rendered variant. In
  the Super-alone renders they produce no onset of their own.
- **Mix and safety.**
  - One look-ahead peak limiter on the composite takes under 1 dB, and only on the first crack.
  - **No compressor and no clipper on the R6 bus;** it is a gain.
  - The event's sample peak (0.8 × `R6_TRIM` 0.74) keeps the game's shared master compressor below its
    threshold when the Super plays alone. That compressor sits on everything in the game and is
    unchanged.
  - The music dips 60% and recovers over 0.75 s; the other game sounds dip 40% for 0.36 s.
- **B2's charge bed hands over** (fades out under the rush over 60 ms) instead of swelling. Its swell
  was a tonal rising sound beside the rush, which is the R5 failure. This is the one change to B2's
  behaviour, and it happens only under `B2RT` at the committed cast. The rifle, the charge progression,
  the ready confirmation and the locks are untouched: rendered without a Super, B2RT equals B2 within
  the renderer's noise.
- **Cuts:** pause fades the Super out over 50 ms and death over 80 ms; a restart stops and disconnects
  it. Unreleased, for example when the hero dies in the wind-up and the game's delayed blast never
  comes, the rush ends by itself by 0.48 s.
- **Source material:** all original synthesis. **No recorded material was used.** This environment's
  network reaches only package registries; the CC0 sound libraries were unreachable, and nothing of
  unclear provenance was taken from packages. Nothing was taken from Roblox Brainchip Arena or any other
  game. The reference audio was never supplied, so no claim of matching it is made.

### Measurements in the game (browser path, full game audio)

Captured with the offline full-game rig (the game's own AudioContext rendered on the stepped game
clock; its inherited 440 Hz start tone is silenced first). `audio/levels.md` has the table.

| | R6 Reactor Thunder | R5 Heavy Cannon | R4 B2S |
|---|---|---|---|
| Isolated Super window, max momentary loudness (the matching metric) | −24.9 LUFS | −24.7 LUFS | −24.0 LUFS |
| Isolated, window integrated | −28.5 LUFS | −28.1 LUFS | −26.9 LUFS |
| Isolated, phone band (300 Hz–8 kHz), max M | −27.2 | −26.6 | −29.8 |
| Isolated, laptop band (150 Hz–14 kHz), max M | −25.9 | −25.6 | −26.8 |
| Isolated, mono fold, max M (change from stereo) | −28.2 (−3.3) | −27.7 (−3.0) | −27.0 (−3.0) |
| **Punch: strongest 5 ms of the onset minus max M** | **+4.9 dB** | +8.6 dB | +8.8 dB |
| In the fight (music, rifle, charge, ready cue, impacts), max M | −23.2 | −22.6 | −22.6 |
| In the fight, punch | +4.7 dB | +6.3 dB | +8.5 dB |
| True peak, in the fight | −8.1 dBTP | −8.6 | −7.8 |

- **Level:** `R6_TRIM` (0.74) puts R6's isolated max momentary loudness within 0.2 LU of Heavy
  Cannon's. Matching on window-integrated loudness instead would favour a longer sound (its tail
  inflates the integral) and quietly lower its onset. R6's window-integrated figure is 0.4 LU under
  Heavy Cannon's anyway.
- **Null test** (`p-null`, Web Audio path against the Node render × 0.74): the residual is a steady
  −80 dBFS, which is B2's idle beds (gain 1e-4). Nothing in it tracks the event: its peak is 66 dB
  under the event's. The browser plays the rendered event exactly, with no dynamics.
- **The seam** (offline through the kit, blast 83 / 117 / 250 ms after the cast): from 20 ms before the
  blast to 30 ms after it, the 10 ms level never dips more than 0.8 dB, and the blast lands 5–19 dB
  above the rush.
- **Voices** (SWARM TIDE, rifle held 1460 ticks, five Supers, voices counted on the game clock): R6
  peaks at 28 of 48 with nothing dropped and five events for five casts. Heavy Cannon reaches 48 of 48
  and drops 18; B2S reaches 48 and drops 1. R6's event is one to three buffer sources, counted but
  never refused. Heavy Cannon used about 29 voices per Super.
- **Cost:**
  - The worker renders in 130–190 ms off the main thread (154 ms in the final run) and is ready
    about 0.3 s after the kit is built.
  - Without a `Worker`, the per-frame job costs a median 1.4 ms and a p95 of 4.9 ms per frame, with one
    14.5 ms frame before the JIT warms (final run, this software-rendered harness; earlier runs 2.1 /
    5.9 / 19.5 ms).
  - An on-the-spot render (a Super before the worker answers) cost 140–250 ms here. That happens in the
    capture rig's stepped clock, not in normal play, where a full meter takes far longer than 0.3 s.
  - A blast costs 0.3–0.5 ms on the main thread (Heavy Cannon 1.2–1.9 ms). The audio update per frame
    is 0.011 ms against Heavy Cannon's 0.015 ms (final run).

### The eight questions, answered candidly

1. **Larger than Heavy Cannon at comparable loudness?** By measurement, yes, in duration and space: at
   matched max momentary loudness it keeps 4.6× Heavy Cannon's energy after 150 ms and about 7× after
   300 ms, its mid and high bands ring about twice as long, and it is stereo where Heavy Cannon is mono. Whether that
   reads as bigger rather than just longer is the HUMAN's call.
2. **A clear electrical release?** There is a rush that is about 15 dB louder than Heavy Cannon's
   pre-blast at 90 ms into the wind-up, pulsed at the bed's 160 Hz and crackling. **The structural limit:** the
   game allows only about 117 ms before the blast. Most of the "WHOOSH" has to be heard through and
   after the KRA (the rush inside the event, about 0.4 s). Delaying the blast to lengthen it was out of
   scope. Whether the pulsing reads as electrical, or only as air, is the most uncertain part of the
   design.
3. **Does the release fuse into the blast?** By construction and by measurement: no gap at the seam,
   no second onset after the blast, no tonal sweep (Reactor Detonation had both). Fusion is perceptual,
   though, and these are proxies.
4. **Genuine space and a satisfying decay?**
   - There are early reflections, a frequency-dependent room of about 0.6–1.3 s, and a low bloom.
   - The tail is −15 dB at 300 ms and −27 dB at 600 ms in a render, against Heavy Cannon's −39 and −61 dB.
   - "Satisfying" and "not a reverb added afterwards" cannot be measured.
5. **Does the first hit keep its violence?** **Less than Heavy Cannon's, by measurement.** At matched
   loudness, R6's strongest 5 ms is +4.9 dB over its loudness against Heavy Cannon's +8.6 (+4.7 against
   +6.3 in the fight). A big event's body, rush and room carry loudness that a short slam does not, so
   at equal loudness its crack sits lower. A later tuning pass added 1.5 dB of punch, at the cost of a
   little late energy (24.6% → 20%). This is the clearest trade-off for the HUMAN to judge.
6. **Bass without a subwoofer?**
   - The low body's driven harmonics land at 100–500 Hz.
   - Through a 300 Hz–8 kHz phone-band filter, R6 is 0.6 LU under Heavy Cannon and 2.6 LU over B2S;
     through a laptop band, 0.3 LU under Heavy Cannon.
   - A filter is not a handset. Real phones may differ.
7. **A clean tail in rapid combat?** The tail is low by 450–600 ms (about −24 dB re its peak), the music
   dips for it, and in the fight film the rifle sits over it. In the dense swarm R6 used 28 voices
   against Heavy Cannon's saturated 48. Masking of later shots cannot be judged without listening.
8. **Different from R5, not just louder or wetter?** It is matched in level, not louder. It is built
   differently from the source up:
   - it is rendered, not made of voices;
   - it has no bus compressor and no clipper;
   - there is a rush that crosses the blast;
   - the crack is a set of blast-wave pulses;
   - the room is fed by the whole event.

   Its measured shape (late energy, no second onset, no sweep, stereo) differs from both R5 kits.

## Evidence

- `audio/`
  - `super-isolated-*` and `super-in-fight-*` (FLAC, from the browser captures, 1 s before to 2 s
    after the blast):
    - `native`: one gain for all three, keeping in-game relative levels; loudest true peak −1 dBTP;
    - `matched`: equal max momentary loudness, TP ≤ −1 dBTP;
    - `matched-phone-band` and `matched-mono`;
    - for R6, R5 Heavy Cannon and R4 B2S.
  - `super-alone-kit-path-matched-*`: the four Supers alone through their kits (no rifle, no master
    chain), matched at −20 LUFS max M. This is the cleanest comparison, and it includes the rejected
    Reactor Detonation.
  - `stems/` (24-bit FLAC, 48 kHz, all −1.5 dB together, so the composite is at −1.4 dBTP):
    - `stem-0-composite`, the event as the kit plays it at 60 fps;
    - `stem-1-energy-release` (the wind-up rush and the rush inside the blast);
    - `stem-2-dry-blast` (KRA and the zips);
    - `stem-3-bass-pressure-body`;
    - `stem-4-room-air`;
    - `rush-unreleased`;
    - `impact-1..3`.

    **The stems are diagnostic only.** They sum to the composite: the null of their sum is −140 dB.
  - `levels.md`, `metrics.txt` (the captures), `kit-path-metrics.txt` (the Super alone),
    `r5-chain-analysis.txt`.
- `img/`:
  - `isolated-RT-HC-S.png`, `in-fight-RT-HC-S.png`: waveform and log-frequency spectrogram, blast in red.
  - `super-alone-kit-path.png`: all four Supers.
  - `stems-48k.png`: the composite and the four stems.
- `films/`: `fight-R6-reactor-thunder-aura.mp4`, `fight-R5-heavy-cannon-aura.mp4`, `fight-R4-B2S.mp4`.
  Each is a 15 s seeded fight at 60 fps with the full game audio (music, rifle, charge, ready cue, the
  Super, impacts). The R6 and Heavy Cannon films are frame-for-frame identical (900 of 900 frames): only
  the sound differs.
- Suite logs: `smoke-*.txt`, `run-all.txt`, `run-all-reruns/`.

## Verification

All runs below are on the final code (`894b209`), standalone and sequential. The previous build is
`d3ecad6`, served from its own worktree on :5174 with its own Vite cache.

- `tests/smoke-b2r6.mjs` **54/54** (`smoke-b2r6.txt`):
  - **flags:** the four conditions and every older audio flag;
  - **parity:** R6 with and without the aura equals B2-B tick for tick in mixed (s6), swarm and
    god-mode-off fights with four Supers and a Broken Wings chain;
  - **in the game, with live audio:** the wind-up sound only on the committed cast. There is none during
    a 40-tick held-F aim, a cancelled hold, or a suppressed press or release; no Super voice is live
    during the aim. One event per real blast, each taking over the rush; the generic hit beep routed;
  - **renders:**
    - B2RT without a Super equals B2;
    - B2, B2S, B2HC and B2RD equal `d3ecad6`'s `b2Audio.js` within each kit's own run-to-run noise;
    - the structure and the seam at 83 / 117 / 250 ms;
    - unreleased, the rush returns to the idle floor by 0.5 s;
    - pause fades in 50 ms and death in 90 ms, both to the idle floor;
    - deterministic buffers at 44.1 and 48 kHz, finite, at the ceiling, limiter under 1 dB;
    - no legacy layer; no falling glide (the same detector flags B2S's);
  - **the approved shield:** `b2Reactor.js` and `b2Feel.js` byte-identical to `d3ecad6`. A 600-tick
    rendered fight, the aura drawn on 329 ticks, is identical per tick to the Heavy Cannon link and to
    `d3ecad6`, every object on screen including the aura's draw commands;
  - **restarts:** one install each time. Three runs with live audio each give one wind-up, one event and
    rush + event + impacts sources, nothing from old kits. The render is reused, never redone, and the
    old Super bus is disconnected;
  - **the shipped links:** labels and the same fight as B2-B;
  - **isolation:** live audio equals the silent run with the worker, and with no `Worker` (per-frame
    job);
  - **voices** on the game clock; **cost**; **scope:** the B0/B1/B2 guard, and R6 touches only
    `b2Audio.js`, `b2Thunder.js`, `b2ThunderWorker.js` and the flag lines in `debug.js` /
    `b2Flagship.js`.
- Against `d3ecad6`, or unchanged:
  - smoke-b2r5 63/63, smoke-b2r4 97/97, smoke-b2r3 81/81, smoke-b2r2 62/62, smoke-b2r 38/38, smoke-b2t
    37/37;
  - smoke-b2c 46/46, smoke-b2 88/88, smoke-b1 71/71, smoke-b0 46/46 (these four with `--old`);
  - P2-A3 scope 4/4; controls pass; restart 16/16.
- **Production bundle** (`vite build`, `vite preview`): no page errors on the four links or the
  no-flag link. On the R6 link the built worker chunk is fetched (HTTP 200), starts, delivers and is
  closed.
- **Notes for honesty:**
  - The rig's stepped clock reaches the first cast before the worker answers, so the captures use the
    on-the-spot render: the same buffers, by the determinism check.
  - The capture rig carries the inherited 440 Hz start tone, silenced before measuring.
  - In one early run B2HC differed from `d3ecad6` by 1.1e-6. Its own run-to-run spread on one build
    later measured 1.07e-6: render jitter of its graph, not a code difference.
  - A first version of §8 counted voices against a live AudioContext while the game was stepped far
    from real time. Both kits hit the cap there, so it was a harness artefact, and §8 now counts on the
    game clock.

## Recommendation (critical)

See the section at the end, written after the final runs.
