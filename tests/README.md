# Smoke tests

Headless Playwright driving the real game against the Vite dev server. There is
no unit-test layer and no test framework — each file is a standalone script that
boots the game, does something, measures it, and exits non-zero if the
measurement is wrong.

```bash
npm run dev            # in one shell — the tests need :5173 up
npm run smoke          # in another
npm run smoke -- --only cluster,flight
```

`run-all.mjs` runs them **sequentially on purpose**. Several reposition enemies,
pause physics or stop the game loop to take a measurement; in parallel they
would corrupt each other's world state.

## The files

**Assertions** — exit non-zero on failure, and are what "the suite passes" means.

| File | What it protects |
|---|---|
| `smoke-arc.mjs` | Cluster canister pops *above* the burst before descending |
| `smoke-boost.mjs` | Booster SFX sustains for the whole dive instead of blipping |
| `smoke-cluster.mjs` | Munitions lock **distinct** targets, flat scale, no ground phase, guidance lines cleaned up, generic hit beep suppressed |
| `smoke-controls.mjs` | The control-layout editor moves the real hit regions (not just sprites), persists, and resets |
| `smoke-debug.mjs` | Debug menu actions actually apply *and* the HUD re-syncs |
| `smoke-depth.mjs` | Airborne objects draw over the room; nose tracks travel (no tumble) |
| `smoke-flight.mjs` | The attack run banks, arrives under power, honours both speed caps, lights its exhaust |
| `smoke-hum.mjs` | Saber hum carries in the band a phone speaker can reproduce |
| `smoke-leak.mjs` | Primary fire is isolated from the cluster (no pool cross-talk) |
| `smoke-march.mjs` | The music plays the full 8-bar march phrase and loops at 32 beats, not the opening fragment |
| `smoke-readability.mjs` | **Can the player SEE the attack coming?** Every move draws a zone before it damages, one zone per attack, he is planted and his body winds up, the zone tracks its caster, he settles at saber range, a super cannot shove him, and a final pass with NOTHING silenced asserts the two systems never attack together |
| `smoke-boss-moves.mjs` | Vader performs his own moves, a cancelled move takes its zone with it, and his afterimages are a real threat |
| `smoke-moves.mjs` | Nemesis moves MOVE the actor, and beating one pays (stagger + bonus damage) |
| `smoke-music-tiers.mjs` | Tiers change what the bed plays (calm drops the melody but keeps its pulse), and the director's heat rises faster than it falls, ignores a stale kill streak, and never outvotes the lifecycle phase |

**Diagnostics** — print numbers, no pass/fail. Run directly, not via `run-all`.

| File | Use it when |
|---|---|
| `diag-flight.mjs` | A munition is missing: per-munition flight time, closest approach, end altitude |
| `smoke-audio.mjs` | Comparing SFX levels across the mix |
| `smoke-fragsfx.mjs` | Judging impact-sound *timbre* (low band vs crack band), not just loudness |
| `shot-run.mjs` | Capturing a frame sequence across a whole attack run → `tests/out/` |

## Environment

Two paths are hardcoded in every file because this container provides them:

```
/opt/node22/lib/node_modules/playwright/index.mjs      # import source
/opt/pw-browsers/chromium-1194/chrome-linux/chrome     # executablePath
```

The chromium directory is **version-stamped and will change**. If every test
suddenly fails to launch, that is why:

```bash
ls -d /opt/pw-browsers/chromium-*                      # find the new one
sed -i 's|chromium-1194|chromium-XXXX|g' tests/*.mjs
```

## Things this harness will lie to you about

Every one of these produced a *false pass* in this project at some point. They
are the reason the tests are written the way they are.

**Headless runs at ~20 FPS.** Phaser `TimerEvent`s resolve coarsely — a bare
`delayedCall(70)` measures 150–220ms. Use generous waits. That is a harness
artifact, not a game bug.

**`page.evaluate` polling misses fast events.** A round trip costs 200–400ms, so
polling a ~900ms flight collects 2–5 samples and can miss an entire phase. Sample
from *inside* the page with a `postupdate` hook instead — it sees every frame and
costs nothing. This is what every flight test does.

**`b.y` is not where the object is.** Anything airborne renders at
`groundY - altitude`, so measuring distance or curvature against `b.y` silently
folds in up to 560px of altitude. It reports a munition directly above an enemy
as 560px away. Use `b.groundY` (set every frame in the fragment's `draw()`), and
recover altitude as `groundY - y` when you need it. This bug has now been fixed
twice, in `smoke-flight` and `smoke-arc` — in the second case it made the test
pass standalone and fail in the suite on an identical build.

**Fractional sampling of short sounds reports silence as "quiet".** Sampling an
envelope at a fraction of its expected length lands past the end of a sound that
stopped early, and the analyser dutifully returns a low number that looks like a
pass. Sample at **fixed millisecond offsets** from the call — see
`smoke-boost.mjs`.

**A pooled object's identity is not its liveness.** `active` cannot distinguish
"still my bullet" from "recycled and re-fired as something else". Guard deferred
callbacks with the `_gen` token, which `Bullet.fire()` bumps.

**Loudness is not timbre.** "It got quieter" and "it changed shape" are different
claims. To support a claim about character, measure *band ratios* — see
`smoke-fragsfx.mjs` (low body vs crack band) and `smoke-hum.mjs` (sub vs
phone-audible band).

**Index 0 of a live group is not a stable object.** `group.getChildren()[0]`
changes identity as members die, so frame-to-frame diffing of `arr[0]` compares
different objects. Key per-object state off the object itself.

**A long measurement runs in a live arena, and the arena fights back.** Anything
that records for more than a few seconds is recording while an idle player is
being shot at. When they die, `GameOverScene` calls `stopMusic()` and the whole
scene shuts down — the recording ends early against something that never
finished, and every check downstream measures the truncated version and passes.
`smoke-march.mjs` pauses the `Game` and `HUD` scenes for the length of its
recording (the music loop is a `setTimeout` on the audio clock, so it keeps
running while the scene is frozen) and asserts the bed is still started at the
end. God mode alone is not enough: a live arena also fires SFX on the same
AudioContext, and those oscillators land in an audio recording as if they were
part of what you are measuring.

**`iterations × interval` is not elapsed time.** A sampling loop of
`await sleep(300)` plus the sampling work itself costs meaningfully more than
300ms a pass, so a 108-pass loop labelled "32.4s" really ran for ~44s. Anything
compared against the *nominal* window — "how many notes should have played by
now" — is then wrong by that ratio, and an exactly-correct build looked like it
was scheduling 35% too many notes. Measure with `performance.now()` around the
loop and derive expectations from what actually elapsed.

**Polling an analyser on a timer is not measuring the audio.**
`getFloatTimeDomainData` hands you the most recent ~46ms whenever your timer
happens to fire, so on impulsive material — a drum kit — you double-count some
hits and miss others outright. The same unchanged kit measured 0.0255 RMS and
then 0.0326 on consecutive runs, a 28% swing on a build where nothing had
changed, which is more than the effect being tested. Use a `ScriptProcessor`
tapping the bus, which sees every sample exactly once; `smoke-music-tiers.mjs`
does this and asserts its own repeatability (measuring one tier twice and
failing if the two readings differ by more than 8%) *before* it compares
anything. An unstable instrument makes every threshold above it meaningless.

The same applies to `getFloatFrequencyData` for band content, and there it did
real damage: a polled 2-8kHz/0-400Hz ratio reported the hot tier as
comfortably brighter than the plain march, that number went into a commit
message as evidence, and re-measuring it sample-exactly showed the tier was
not brighter **at all**. A plausible-looking number from a noisy instrument is
worse than no number, because it ends the investigation. Split the signal with
biquad filters into separate ScriptProcessor taps and compare RMS per band.

**A module you `import()` from the test is not always the module the game is
running.** Under the Vite dev server, a file edited since the page loaded is
re-served with a cache-busting query, so a test doing
`await import('/src/data/rooms.js')` can get a *second instance* of a module the
app already holds. Every object identity across that boundary then fails:
`ROOMS.indexOf(spec)` returns -1 for a spec that is plainly in the array, and
`gs.roomSpec === ROOMS[2]` is false for the room you just loaded. The tell is a
check that passes on the first run after `npm run dev` starts and fails on every
run after you touch the module — which reads exactly like a real regression you
just introduced.

Compare by a stable field (`spec.id`), never by `===` or by an index derived
from `indexOf`, and prefer reading the value through the *app's* own accessor so
the comparison never crosses the boundary at all. This one had a real fix on the
other side too: `RoomManager.setRoom` used `indexOf` and so depended on getting
back the identical object, which would also have broken in production the first
time anything handed it a modified copy of a spec.

**One read of a fluctuating counter can be zero.** A single end-of-run sample of
a value that rises and falls (voices held, particles alive) lands wherever it
lands — the same build measured 0 and then 60 on consecutive runs, and the 0
would have passed a "no leak" assertion for entirely the wrong reason. Sample
throughout and assert on max, or on early-vs-late means if the claim is about
growth.

## Rules that keep these honest

1. **A/B any measurement against the pre-change build** (`git stash`) before
   trusting it. If the test does not *fail* on the old code, it is not testing
   your change. The `smoke-hum` numbers in `HANDOVER.md` were obtained this way.
2. **Screenshot it.** This project is heavily visual and several past "passing"
   tests were wrong assertions rather than working code. For FX under ~150ms,
   freeze first: `scene.tweens.timeScale = 0` and `physics.world.pause()`, then
   capture.
3. **If a test fails intermittently, fix the measurement, not the threshold.**
   This has been true of every intermittent failure this harness has produced —
   see the table in `docs/POST-MORTEM-vader-moves.md` for six of them in a row.
4. **Never silence the system you are testing against.** Every boss test used to
   open with `b.cooldown = 1e9`, which is exactly what stops the AI the new moves
   were colliding with — so the harness could not observe the bug that got the
   release rejected. Silence a clock to stabilise a MEASUREMENT if you must, then
   run one pass with nothing silenced and assert the result is still coherent.
   `smoke-readability` is built that way.
5. **A refused call reads exactly like a failed one.** `_castBossMove` returns
   null while another attack owns the actor; every probe then reads zero, so
   "the move did nothing" and "the move never ran" are indistinguishable and half
   the checks pass vacuously. Assert the thing under test actually ran.
6. **Assert at the registry, not per feature.** Checks written per-move get
   forgotten when a fifth move is added — which is how two of four boss moves
   shipped drawing nothing at all. Iterating `BOSS_MOVES` has since caught two
   new moves with no body tell on their first run.
7. **Freezing tweens and physics is NOT freezing the game.** `scene.update` keeps
   running, so telegraphs tick on and destroy themselves before a screenshot
   lands. Use `scene.pause()` — it stops update and keeps rendering. Four rounds
   were spent blaming drawing code for a zone that was no longer in the frame.
8. **The camera lerps.** Teleport an actor and freeze immediately and you catch
   the camera still travelling, which is how a screenshot pass came back with the
   fight jammed against the bottom edge. Settle it before casting anything.
