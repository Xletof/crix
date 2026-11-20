# B2-R5: Reactor Cannon and Enchanted Armour (an opt-in experiment)

**Status: a HUMAN-authorized experiment. NOT approved, NOT frozen, NOT a default.**

It sits on top of B2-R4 (`&b2r=4&b2iso=1`) and adds two independent opt-in switches:

| Switch | Values |
|---|---|
| Super discharge sound, `&b2a=` | `B2S` = the R4 control (unchanged); `B2HC` = A, Heavy Cannon; `B2RD` = B, Reactor Detonation |
| Full-shield aura | `&b2aura=1`. Without it: the R4 shield, unchanged. It works with `&b2r=4` only; elsewhere it is ignored. |

All historical modes keep their meaning: `b2a=A|B|B2|B2S`, `b2r=1..4`, `b2iso`, `b2c`. With no R5 flag, production is unchanged.

**The author can neither listen to audio nor watch playback.** Both sounds were designed from synthesis principles and judged by measurement only: loudness, true peak, transient, band balance, tonality and spectrograms. The aura was judged from stills and frames. The HUMAN decides.

## Verified baseline and what the repository showed

The baseline is `7e73dae`, which was HEAD and `origin/FRIX` with a clean working tree when R5 started.

Where things live:

| What | Where |
|---|---|
| Super discharge audio | `src/systems/b2Audio.js`: the kits, and `createB2Audio`, which triggers on `player-fire-super` (wind-up) and `player-super-blast` (release) via `b2Flagship.js` |
| Shield visuals | `src/systems/b2Reactor.js`: `updateShield`, `drawShieldR4` |
| Feature gates | `src/systems/debug.js`: `setB2` |

Discrepancies worth knowing:

- **B2S was never a new Super sound.** Its discharge still played B2's E6 pip falling an octave and three detuned saws falling 165→62 Hz (`7e73dae:src/systems/b2Audio.js:522,527`). `createB2Audio` then scheduled B2's own cooldown after it, two more falling saws (`:397`, called at `:622`). The HUMAN's verdict, "the old Super sound with slightly more thickness", is literally what the code did. R5's kits play none of those layers, and the rig checks the source for it.
- **The R4 one-pixel shield sliver was not corrected.** It is a screen-space offset of uncertain cause (see `docs/evidence/b2-r4/README.md`), and fixing it is out of scope. The aura sits outside the silhouette by design, so it is not affected.
- **The film rig's 440 Hz start tone** (inherited, documented in R4) is silenced in every capture before measuring, as in R4.

## Playtest links (all six conditions)

| | Super sound | Shield | Link |
|---|---|---|---|
| Control | R4 B2S | R4 | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=4&b2iso=1&b2c=1&b2a=B2S&b0=B2R4S |
| A | Heavy Cannon | R4 | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=4&b2iso=1&b2c=1&b2a=B2HC&b0=R5HC |
| B | Reactor Detonation | R4 | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=4&b2iso=1&b2c=1&b2a=B2RD&b0=R5RD |
| C | R4 B2S | R5 aura | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=4&b2iso=1&b2c=1&b2a=B2S&b2aura=1&b0=R5AUS |
| D | Heavy Cannon | R5 aura | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=4&b2iso=1&b2c=1&b2a=B2HC&b2aura=1&b0=R5AUHC |
| E | Reactor Detonation | R5 aura | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2r=4&b2iso=1&b2c=1&b2a=B2RD&b2aura=1&b0=R5AURD |

All six use hold-F targeting with release to fire (`&b2c=1`). Add `&b2range=1` for the firing range.

## R5-AUDIO: what the two new Super sounds are

Both are new synthesized voices, built on B2's own kit object. So the rifle, the charge progression, the ready confirmation and the lock cues are B2's code, called the same way. The new code plays none of the legacy layers: no pip, no saws, no falling glides, no B2 cooldown.

**A, Heavy Cannon**, weapon first:
- a broadband crack plus a 35 ms "KRA" grain;
- a driven low-mid thump (its harmonics carry 200–800 Hz) and a roughly 0.4 s "THOOOM" roar (noise falling 1250→200 Hz, plus a resonant band at 170 Hz);
- a reactor "dump" (a driven band falling fast);
- a short dark synthetic room;
- a compact gritty rattle and a few sparks, clear by about 0.4 s;
- a quiet two-step breech action at +0.32 s.

**B, Reactor Detonation**, a reactor discharged through a cannon:
- an initial detonation with its own grain and a full low-mid body;
- then an audible pressure collapse: a swell sucked upward (a rising noise band and a rising tone), cut dead onto a second, collapsing thump, about 0.23 s after the blast and under the initial one;
- a coarse electrical fracture (a sparse impulse crackle) that keeps crackling after the collapse;
- a longer room and decay, about 0.8 s.

**Shared by both:**
- **Trigger:** only the committed blast (`player-super-blast`). A short pre-blast plays inside the game's own 70 ms wind-up and is cut by the blast.
- **Supporting layers:** five quiet projectile zips; at most three impacts, with same-tick hits merged and later ones 50 ms apart, the first landing with the blast and the rest 5–11 dB under it. The game's generic hit beep is routed away for Super hits.
- **Ducking:** a deeper, shorter music dip (0.6 for 380 ms, against B2S's 0.45 for 500 ms) and a brief dip of the *other* game sounds (`duckSfx` 0.35 for 240 ms). The B2 rifle and the Super bus feed `sfxGain` directly, so neither is ducked. The music and rifle mixes are otherwise untouched.
- **Signal chain:** their own Super bus, then a compressor with an 8 ms attack (the crack passes before the body is compressed), then a tanh soft clipper with a ceiling of 0.91 (it rounds the crack's overshoot instead of clipping).
- **Limits and cleanup:** B2's voice cap; cuts on pause (the pre-blast), death (the pre-blast and the tail) and restart; private mulberry32 noise, never `Math.random`.

### Measurements (critical; levels as measured)

**In-game captures** (`audio/in-game-levels.md`): the real browser chain, master compressor included. The Super window runs from 0.3 s before the release to 1.5 s after.

| | window max M (LUFS) | window TP (dBTP) | phone-band max M (LUFS) |
|---|---|---|---|
| B2S, isolated | −24.0 | −9.5 | −29.7 |
| Heavy Cannon, isolated | −24.7 | −10.8 | −26.6 (**+3.1**) |
| Reactor Detonation, isolated | −24.6 | −11.8 | −27.2 (**+2.5**) |
| B2S, in the same fight | −22.5 | −7.8 | −27.6 |
| Heavy Cannon, in the same fight | −22.6 | −8.6 | −25.1 (**+2.5**) |
| Reactor Detonation, in the same fight | −22.6 | −7.7 | −25.6 (**+2.0**) |

- **Loudness:** matched within 0.7 LU. The candidates are not louder; that was deliberate.
- **Phone band:** the phone filter is two 300 Hz high-passes and an 8 kHz low-pass, an approximation. Through it, both candidates carry 2.0–3.1 LU more than B2S at the same full-band loudness. Their energy sits where laptop and phone speakers play.
- **True peak:** the whole fight capture peaks at −3.8 dBTP in all three. That is the same non-Super game transient as in R4, so no candidate adds clipping to the browser mix.

**Character** (offline kit renders, `audio/offline-analysis.md`, `after/spectrogram-offline-kit-B2S-HC-RD.png`):

| | B2S | Heavy Cannon | Reactor Detonation |
|---|---|---|---|
| Share of the first 300 ms at 200–900 Hz | 17% | 51% | 37% |
| Share of the first 300 ms at 100–200 Hz | 74% | 19% | 39% |
| Below 100 Hz | 1% | 6% | 3% |
| Spectral flatness, 100 Hz–4 kHz, first 300 ms / 0.3–0.9 s (0 = pure tones, 1 = noise) | 0.05 / 0.04 | 0.10 / 0.10 | 0.14 / 0.21 |
| Longest falling pitch glide | 0.13 s, 14 semitones | none | none |
| Time from the blast to 90% of its peak envelope (after the 20 ms look-ahead all three share) | 9 ms | 13 ms | 13 ms |

- No excessive sub-bass in either candidate.
- B2S is tonal; both candidates are noise-led blasts.
- On the spectrograms, B2S shows horizontal tonal lines and its falling cooldown. Heavy Cannon is a broadband, noise-led burst over by about 0.6 s. Reactor Detonation shows its implosion arc and collapse, then crackle out to about 1.2 s.

**The critical result: the initial hit.** This is the initial 5 ms RMS peak minus the window loudness, from `audio/in-game-punch.txt` and `audio/offline-punch.txt`:

| | offline, kit only | in game, isolated | in game, in the fight |
|---|---|---|---|
| B2S | +12.0 dB | +8.8 dB | +8.5 dB |
| Heavy Cannon | +12.3 dB | +8.6 dB | +6.3 dB |
| Reactor Detonation | +10.3 dB | +6.4 dB | +3.7 dB |

At matched loudness, **neither candidate's initial crack is punchier than B2S's**.
- Rank on the *isolated* row: Heavy Cannon equals B2S (+8.6 against +8.8 dB); Reactor Detonation is 2.4 dB lower.
- **The in-fight row is confounded.** Only the R5 kits duck the other game sounds and dip the music deeper, so the fight around their blast is quieter than around B2S's. Read it as indicative only.
- **Reactor Detonation's deficit is already there offline**, so the game chain is not its cause. The chain costs all three about the same: B2S 3.2 dB, Heavy Cannon 3.7, Reactor Detonation 3.9.

What the candidates add is body ("THOOOM"), low-mid weight that survives small speakers, space, and a non-tonal blast character. They do not add a bigger first peak. Raising that peak means either a louder Super than B2S or less body.
- In-game level was matched to B2S **by my choice**, for a fair comparison.
- `R5_TRIM` in `src/systems/b2Audio.js` is the HUMAN's lever if a louder Super is wanted.

**A versus B: the two candidates converged.**
- On the final renders, Heavy Cannon and Reactor Detonation are *more alike than either is to B2S*: time-frequency similarity 0.86 and a spectral-shape distance of 2.1 dB. Against B2S they score 0.85 / 7.4 dB (Heavy Cannon) and 0.80 / 5.7 dB (Reactor Detonation).
- They differ mainly in **time structure**. Reactor Detonation has a pressure collapse about 0.23 s after the blast, measured in game at −1.5 dB under its initial hit when isolated and −1.0 dB in the fight, plus a crackling decay of about 0.8 s. Heavy Cannon decays compactly, 12–15 dB down by then, and has two quiet breech steps.
- Whether that is enough to tell them apart blind is for the HUMAN's ears; my measurements do not settle it.

**Voices:** peaks of 34 and 37 in the isolated cast, 44 and 43 in the live fight (B2S: 36 and 37), out of a cap of 48, with none dropped. The live-fight figure is close to the cap; a denser fight could drop a voice (a sound layer, never gameplay).

## R5-VISUAL: the enchanted full-shield aura

- **What it is:** one Graphics object behind the hero (depth just below the sprite), drawing only on the cells just outside the silhouette. There is a first ring, plus a sparse, irregular second ring (about half its cells).
- **Shape and motion:** strongest at the head and shoulders, fading toward the feet. A slow breathing cycle (2.4 s), a per-cell shimmer, and up to four tiny motes rising from the upper edge, from a fixed pool.
- **When it shows:** only in the top quarter (shield above 300). A hit knocks it out at once and it fades back in. It never shows at 300, 200, 100 or 0, nor on the break.
- **Implementation:** deterministic (a hash of game time, no `Math.random`), and redrawn at most every 40 ms.
- **What it does not have:** circles, bubbles, plates, runes, a background plate, or anything drawn over the hero, the saber or the muzzle effects.

The first version barely read at phone size (`after/aura-native-phone-frame-r4-left-r5-right-3x.png` shows the final version). It was strengthened once: inner ring alpha 0.58, outer 0.26, weighted to the head and shoulders. Whether it now reads as "imbued with power" without distracting is the HUMAN's call; `R5_AURA.a1` and `a2` are the two knobs.

## Evidence

| File | What |
|---|---|
| `films/super-isolated-{control-B2S, A-heavy-cannon, B-reactor-detonation}-music-muted.mp4` | the same hold-F cast and a suppressed hold, with the game's audio |
| `films/fight-full-mix-{control-B2S, A-heavy-cannon, B-reactor-detonation}.mp4` | the same seeded fight with music, rifle, charge, the ready cue and the Super |
| `films/shield-r4-vs-r5-aura-60fps.mp4` | full shield, hits, draining, the break and shards, the refill, a bush; R4 and R5 side by side |
| `films/aura-fight-sustained-r4-vs-r5-aura-60fps.mp4` | the key aura question. A SWARM TIDE fight with the shield topped to 400 every 150 ticks (full on 591 of 720 ticks), moving through every facing, firing, a held-F Super and a Broken Wings chain; R4 (B2S) against R5 aura + Heavy Cannon. At this film's half scale the aura is hard to make out; at native phone resolution it is visible (`after/aura-native-phone-frame-r4-left-r5-right-3x.png`). It is close to the edge of what reads in play. |
| `films/crowd-shield-r4-vs-r5-aura-60fps.mp4` | a SWARM TIDE crowd, R4 (B2S) against R5 aura + Heavy Cannon |
| `audio/*.flac` | loudness-matched trios, one common loudness per trio, every export ≤ −1.0 dBTP, re-measured after export (`audio/matched-trios.md`) |
| `after/waveform-spectrogram-super-{isolated,in-fight}-B2S-HC-RD.png` | waveforms and spectrograms from the in-game captures |
| `after/aura-r4-vs-r5-phone-1x-and-3x.png` | 400 / 300 / 200 / 100 / 0, the four facings, a hit, the break and a bush, at phone size; plus 3× |
| `after/aura-native-phone-frame-r4-left-r5-right-3x.png` | a real game frame at native phone resolution, 3× |

The FLAC trios:

| Trio | Common loudness |
|---|---|
| isolated | −22.5 LUFS |
| isolated, phone band | −23.0 LUFS |
| in the fight | −20.8 LUFS |
| in the fight, phone band | −20.0 LUFS |

**Determinism and performance.**
- With `&b2iso=1`, the new kits with live audio replay the silent run tick for tick.
- The music loop still draws `Math.random` (inherited, see R4); it was not touched. So a phone fight with music is not exactly reproducible.
- Aura cost in a rendered fight, in this software-rendered harness, on the final code (`smoke-b2r5.txt` §4): the skin's update is 0.140 ms (R4) against 0.170 ms (aura) per frame. That is one extra display object, about 95 rects per redraw, at most 25 redraws per second and at most 4 motes.

## Verification

Every suite ran standalone on the final code. Where a suite takes `--old`, it compared against `7e73dae`, B2-R4's deploy, served from its own worktree. The logs are in this folder.

| Suite | Result | Notes |
|---|---|---|
| `smoke-b2r5` (new) | **63/63** | one clean run on the final code (`smoke-b2r5.txt`). Covers: gameplay parity of all six conditions against B2-B (plus crowd and god mode off); the discharge once per committed blast, never on aim, lock, cancel or suppression; approved cues unchanged; the Super structure; pause and death cuts; no legacy layer; the aura's gating, facings, depth under the rifle, fade-in, sync and per-tick identity of everything else; restarts and the Super bus chain disconnect; links; live-audio isolation; scope |
| `smoke-b2r4` | 97/97 | R4 unchanged (the B2S teardown fix included) |
| `smoke-b2r3` | 81/81 | |
| `smoke-b2r2` | 62/62 | |
| `smoke-b2r` | 38/38 | |
| `smoke-b2t` | 37/37 | |
| `smoke-b2c --old=7e73dae` | 46/46 | |
| `smoke-b2 --old=7e73dae` | 88/88 | |
| `smoke-b1 --old=7e73dae` | 71/71 | |
| `smoke-b0 --old=7e73dae` | 46/46 | |
| `smoke-fx-p2a3 --only=10` | 4/4 | the frozen-file scope guard |
| `smoke-controls` | PASS | |
| `smoke-restart` | PASS (16 checks) | |
| production bundle (`npm run build`, `vite preview`) | no page errors | the six matrix links and a plain boot |
| `run-all` (52 suites) | not yet run at deploy | run straight after the deploy; this row is updated with the result |

- **B2 and B2S unchanged.** Offline renders with a Super, against `7e73dae`'s `b2Audio.js`:

  | | this build vs `7e73dae` | `7e73dae` vs itself |
  |---|---|---|
  | B2 | 2.1e-7 | 1.5e-7 |
  | B2S | 2.4–4.3e-7 | 4.3e-7 |

  Both differences are inside each render's own run-to-run noise.
- **Frozen files.** Nothing under `src/scenes`, `src/entities`, `src/data`, `FX.js`, `config.js`, the camera or the P1 / P2-A3 modules changed since `7e73dae`. Only `src/systems/b2Audio.js`, `b2Reactor.js`, `b2Flagship.js`, `b2Feel.js` and `debug.js` changed, plus `tests/smoke-b2r5.mjs` (new) and `tests/README.md`.

## Recommendation (critical)

**Audio: Heavy Cannon over Reactor Detonation, with further iteration expected. Neither is ready to adopt on measurements alone.**

Heavy Cannon is the stronger candidate:
- It moves the Super's energy into the low-mids: 51% of its first 300 ms at 200–900 Hz, against B2S's 17%.
- It carries +3.1 LU more through a phone-speaker band at the same loudness.
- It is a noise-led blast rather than tones (twice B2S's spectral flatness), with no falling glide.
- Its decay is compact, 12–15 dB down by the time a next action would follow.
- Isolated, its onset is as strong as B2S's, but not stronger.

Reactor Detonation is weaker as measured:
- Its onset is 2.4 dB lower relative to its loudness.
- Its collapse nearly equals its initial hit in game (−1.5 dB).
- Its longer crackle tail is more likely to muddy a dense fight.
- It has converged with Heavy Cannon spectrally, so its separate identity rests on time structure alone.

Against the success criterion: neither candidate is "absurd" by level, because each was matched to B2S's loudness on purpose. If, on the phone, Heavy Cannon feels heavier but not big enough, the levers in order are:
1. `R5_TRIM.B2HC` (a louder Super, a design decision);
2. more crack against less roar (more punch, less "THOOOM").

If it does not feel heavier at all, the next step is a different approach (recorded or sampled impact material), not more synthesis tuning.

**Aura: test it, then decide on strength.**
- It is gated correctly (full shield only, knocked out by a hit), never covers the hero or the rifle, and changes nothing else on screen.
- At native phone resolution it reads as a soft glow on the helmet and shoulders. In wide shots and at half scale it nearly vanishes.
- Condition C (B2S + aura) isolates the aura; D (Heavy Cannon + aura) is the combined proposal.
- If it is too faint, raise `R5_AURA.a1` / `a2`; if it clutters, lower them. No other part needs to change.
