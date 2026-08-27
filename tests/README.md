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

## The suite is load-sensitive. Prove a regression before chasing one.

Under sustained load this suite returns 26-28/29 with a **different** test
failing each run, and every failing test passes standalone. Observed across six
consecutive runs: smoke-boss-moves, smoke-vader, smoke-endless, smoke-moves,
smoke-pathing, smoke-progress, smoke-readability, smoke-nemesis-fx — spanning
doorway geometry, sprite drift, pathing and audio, which is not the profile of
one code regression.

Several thresholds sit close enough to their intended value that load tips them:
`smoke-readability` allows 40px of wind-up drift against a `rearBack` that
deliberately moves 30px, and it measured 43px.

**`smoke-deflect`'s throw section joined that list, measured 2026-08-20.** Its
section 4c photographs a 260ms saber gesture frame by frame in a ~20fps harness,
so every check in it that reads the gesture's size, its peak speed, or the
deferred stance's handover timing is sampling luck under load. Observed across
one ladder pass, on this box:

| run | result |
|---|---|
| standalone | 2 fails: gesture size + sweep carve-out |
| standalone | PASS |
| standalone | 1 fail: deferred-DEFLECTION handover |
| standalone | 1 fail: gesture size |

**Re-measured 2026-08-24, during the saber-emissive pass.** DEFLECTION was not
touched by that pass, and the saber glow is a pure reader that writes nothing
the section samples — but the glow is drawn on `postupdate` and the honest thing
to do was check. Three runs against the untouched `af3023d` source and two
against the new one, alternating, on the same box:

| source | result |
|---|---|
| `af3023d` (baseline) | 2 fails: blade peak speed + "no second saber was conjured" |
| `af3023d` (baseline) | 1 fail: "no second saber was conjured" |
| `af3023d` (baseline) | 1 fail: blade peak speed |
| with the saber glow | 1 fail: blade peak speed |
| with the saber glow | PASS |

The baseline failed **three times out of three**, including the check whose name
most invites blaming a new saber layer — on the build that has no saber layer.
Same failure, same rate, pre-existing. Do not retune DEFLECTION for it.
| full suite | 1 fail: gesture size |
| full suite | 1 fail: blade travelling fastest at the power frame |
| standalone | PASS |

Four *different* checks, and the **pre-ladder baseline produced the same two
failures on the same box** — which is what settles it. Every one of those checks
already says in its own failure text that it is reading whatever `u` the frame
happened to land on. Do not retune them from a red run; run the baseline.

`smoke-readability`'s "he is PLANTED through his wind-up" belongs on the list
too — it failed once in a full suite and passed standalone in the same session.

**Do not conclude either way from a failing suite run.** Run the baseline:

```
git checkout -q <last-known-good-sha>
node tests/run-all.mjs            # same box, same load
git checkout -q <your-branch>
```

If the known-good commit also fails, the instability is the machine. Measured
2026-08-13: `fed4241`, the commit live on FRIX at the time, came back 28/29
failing smoke-nemesis-fx.

This cuts BOTH ways and both mistakes were made on the same day. Four suite
failures that session were real bugs (a dead AI gate, a hitstop restore on the
clock it was slowing, two systems owning time.timeScale, a retreat that ran at
the player) — dismissing them as flakiness would have shipped every one. Then
several more were environmental, and treating those as regressions cost hours.
The baseline run is the only thing that tells them apart, and it costs one
suite.


## `?nofreeze=1` — mute hitstop, or measurements lie

Hitstop freezes `time.timeScale`, `physics.world.timeScale` and the **game-wide**
`anims.globalTimeScale` for 45–80ms on a heavy landing. Correct for a player,
poison for this harness: the headless loop runs at ~10fps, so one freeze
swallows most of a sampled frame and anything measured as "how far did this move
over N frames" reads short.

The symptom is the tell, and it cost two full suite runs to read correctly: a
**different** test failed each run — smoke-boss-moves, then smoke-vader, then
smoke-endless and smoke-moves — and **every one passed standalone**. Whichever
measurement happened to overlap a freeze was the one that lost. Three unrelated
files failing at once is shared state, not three bugs.

Every harness therefore loads `?nodlg=1&nofreeze=1`. `smoke-duel` deliberately
does NOT, because hitstop is its subject — same split as `smoke-dialogue` and
`?nodlg=1`.


## The files

**Assertions** — exit non-zero on failure, and are what "the suite passes" means.

| File | What it protects |
|---|---|
| `smoke-arc.mjs` | Cluster canister pops *above* the burst before descending |
| `smoke-boost.mjs` | Booster SFX sustains for the whole dive instead of blipping |
| `smoke-boss.mjs` | Boss phases fire once each at the configured thresholds and never reverse |
| `smoke-cluster.mjs` | Munitions lock **distinct** targets, flat scale, no ground phase, guidance lines cleaned up, generic hit beep suppressed |
| `smoke-controls.mjs` | The control-layout editor moves the real hit regions (not just sprites), persists, and resets |
| `smoke-debug.mjs` | Debug menu actions actually apply *and* the HUD re-syncs |
| `smoke-deflect.mjs` | DEFLECTION is a readable STANCE: eight directional parry families, the live blade matches `parryPose` frame by frame, the guard is not his aim pose, no other saber system may start while it is up, melee still lands — and a super is CAUGHT and returned as one bounded, non-homing orb that travels at a CONSTANT `PLAYER.superSpeed` (1080px/s) from release to termination with no ramp, settle or falloff, thrown by a dedicated saber power sweep that owns the blade and launches it on its power frame, whose 44px body did not grow with any of it, wearing a bounded three-remnant wake that lies along its real velocity rather than at the player, and which lives until it hits something or leaves the world |
| `smoke-depth.mjs` | Airborne objects draw over the room; nose tracks travel (no tumble) |
| `smoke-dialogue.mjs` | **The nemeses speak, and a stranger stays quiet.** No line repeats until its pool is exhausted; a first-time nemesis raises no card at all (the pacing contract); both scenes pause AND resume; a card refuses to open over the upgrade picker and is held rather than dropped |
| `smoke-duel.mjs` | **A nemesis encounter is a duel**: the arena locks to it, its phases turn at 66%/33%, and the bomber survives its own contact burst instead of dying to it. Also the one file that deliberately loads WITHOUT `?nofreeze=1`, because hitstop is its subject |
| `smoke-endless.mjs` | The climb reaches Vader, scales him, and carries on past. The arena rotation is the trap — derived from the current room index it sends every post-boss run back to the hangar, and Vader was unreachable in the mode people actually play |
| `smoke-flight.mjs` | The attack run banks, arrives under power, honours both speed caps, lights its exhaust |
| `smoke-hum.mjs` | Saber hum carries in the band a phone speaker can reproduce |
| `smoke-leak.mjs` | Primary fire is isolated from the cluster (no pool cross-talk) |
| `smoke-march.mjs` | The music plays the full 8-bar march phrase and loops at 32 beats, not the opening fragment |
| `smoke-nemesis.mjs` | **Variety, measured as an output space** — not that one roll looks plausible, since a generator returning the same thing 90% of the time passes every single-roll assertion you can write. VOLATILE and REGENERATOR are checked for their EFFECT in a live arena, because both are load-bearing on balance |
| `smoke-nemesis-fx.mjs` | The nemeses perform their moves, in their own colours — asserted by **iterating `NEMESIS_MOVES`**, so a move cannot be added without satisfying it. Same rule as `smoke-readability`, for the same reason |
| `smoke-nemesis-kit.mjs` | A nemesis looks and fights like its own enemy rather than a recoloured trooper: its marks, its weapon and its shot pattern — plus the pool-contamination check, since a tinted bolt handed back would leave ordinary troopers shooting in the nemesis's colour |
| `smoke-nemesis-memory.mjs` | **Continuity**, where `smoke-nemesis` covers variety: an escape returns scarred five sectors later, a nemesis dies once, and an heir succeeds it. The ledger is pure by design, so most of this runs as a direct import |
| `smoke-pathing.mjs` | Path QUALITY, not arrival — the shape of the route a horde takes, because "they arrived" and "they moved intelligently" are different claims and a long wall makes a conga line out of the second. Reports its figures without gating on them; it fails only when the run itself is broken |
| `smoke-progress.mjs` | Upgrades apply and stack, rooms tear down, stats persist — driven through the real `UPGRADES[].apply`, `GameScene.loadRoom` and the actual `loadStats`/`saveStats` pair |
| `smoke-readability.mjs` | **Can the player SEE the attack coming?** Every move draws a zone before it damages, one zone per attack, he is planted and his body winds up, the zone tracks its caster, he settles at saber range, a super cannot shove him, and a final pass with NOTHING silenced asserts the two systems never attack together |
| `smoke-restart.mjs` | Restarts leave no duplicate handlers and no stale arena |
| `smoke-rng.mjs` | Runs are reproducible from a seed, and the named streams do not couple |
| `smoke-score.mjs` | Kills, chain multiplier and wave bonuses all score |
| `smoke-title.mjs` | Endless leads, and its record is the first thing you read |
| `smoke-vader.mjs` | **The ladder is mechanics, not multipliers** — each Vader encounter adds a trick rather than a bigger number. Also: a DEFLECTION returns *the shot* (player texture, its own speed and reach, in `deflectedBullets`) and Vader's blade leaves its guard to meet it |
| `smoke-boss-moves.mjs` | Vader performs his own moves, a cancelled move takes its zone with it, and his afterimages are a real threat |
| `smoke-moves.mjs` | Nemesis moves MOVE the actor, and beating one pays (stagger + bonus damage) |
| `smoke-music-tiers.mjs` | Tiers change what the bed plays (calm drops the melody but keeps its pulse), and the director's heat rises faster than it falls, ignores a stale kill streak, and never outvotes the lifecycle phase |

**Diagnostics** — print numbers, no pass/fail. Run directly, not via `run-all`.

| File | Use it when |
|---|---|
| `diag-flight.mjs` | A munition is missing: per-munition flight time, closest approach, end altitude |
| `diag-combat-text.mjs` | **What is the combat text covering?** Concurrent labels, how many overlap an actor's body, how many sit on a live danger telegraph, and the allocation rate — across six real fights. `--shots` also captures frozen frames of the Broken Wings casts and a Vader exchange. Run it with `--label baseline` on the old build and `--label after` on the new one; it prints an A/B you can read side by side. `--only-frozen` re-shoots just the stills (40s instead of 6min) |
| `diag-encounter.mjs` | Fight length and dps across the endless ladder. **Its bot never dies** (`lives = 9999`, revived in-frame), so its dps is an uninterrupted CEILING and `hp / dps` is not fight length — read it for RELATIVE comparison only. Sizing Vader's pool off it once shipped a 300,000-hp boss |
| `diag-arena-perf.mjs` | **What does an authored arena cost?** `node tests/diag-arena-perf.mjs <roomId> [label]`. Room-load time, EnvLight object count, display list, an outage entry, and frame medians/p95 in both power states. READ THE OBJECT COUNTS, NOT THE FRAME TIMES — this container's spread across two runs of an identical build is wider than anything an environment pass produces. A/B it by stashing `src/` only (`git stash push -u -- src/`), and copy the rig OUT of the tree first or the stash takes it with it |
| `diag-vader-perf.mjs` | **Did an effects pass cost anything?** Frame delta, display-list size and live tween count across a 30s boss stress fight. Run `--label before` on the baseline (`git checkout <sha> -- src/`) and `--label after` on the branch. Read the DISPLAY LIST, not the frame delta: two runs of an identical build measured 131.9ms and 140.6ms, a 6.5% spread that swallows any effect this instrument could detect. It also fails outright if fewer than 5 casts landed, because a benchmark of an idle arena is the "a refused call reads like a failed one" trap wearing a stopwatch |
| `smoke-audio.mjs` | Comparing SFX levels across the mix |
| `smoke-fragsfx.mjs` | Judging impact-sound *timbre* (low band vs crack band), not just loudness |

**Screenshots** — `shot-*` capture frames and assert nothing, on purpose.
Post-mortem rule 6: screenshots caught three bugs no assertion did. Freeze with
`scene.pause()`, not `tweens.timeScale = 0` — that does not stop `scene.update`,
so telegraphs tick on and destroy themselves before the shutter.

| File | What it photographs |
|---|---|
| `shot-run.mjs` | A frame sequence across a whole attack run → `tests/out/` |
| `shot-boss-moves.mjs` | Vader's moves, one frame per BEAT |
| `shot-nemesis-moves.mjs` | Each nemesis move, at wind-up and at impact |
| `shot-dialogue.mjs` | The dialogue card in every shape it takes — a returning grudge, an heir (the LONG name, where the nameplate overruns), a kill, and Vader |
| `shot-busts.mjs` | The portrait busts |
| `shot-poses.mjs` | The attack pose frames |
| `shot-vader-language.mjs` | **Can the move be identified with its NAME hidden?** All seven live attacks — the four `shot-boss-moves` covers plus SABER COMBO and the two that live in his state machine, CHARGE and OVERHEAD SLAM, which had never been photographed at all. Four marks each (early wind-up, late wind-up, release, recovery) plus a continuous 8-frame sequence, because the claim under review is about MOTION and motion cannot be assembled out of four unrelated casts. Run it twice: plain for the labelled key, `--nonames` for the review sheet |

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

**`smoke-deflect`'s "blade travelling FASTEST" check is a frame-rate
measurement wearing a physics claim.** `peakStepU` is the phase of the largest
PER-FRAME angular step across a 260ms sweep. At ~20fps that sweep is about five
frames, so which sample carries the biggest step depends on where the frames
happen to land — and the threshold is `> 0.5`. A/B'd properly for the first time
during the hangar pass: run four times against an untouched `a639ea6` with
`src/` stashed, it failed **three of the four** (u=0.314 / 0.333 / 1.392). It is
not a regression detector for anything; treat a failure here as noise unless the
same run also breaks a check that is not frame-sampled, and fix the instrument
before believing it.

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

### Three more ways this harness will lie to you

**The bot never dies, so its dps is a ceiling and not a fight.** `diag-encounter`
sets `lives = 9999` and revives the player in-frame inside `step()`, deliberately,
so a death cannot end a measurement early. That makes `hp / dps` answer "how long
to chew through this pool while taking no consequences" — which is not how long a
fight takes. Sizing Vader's hp pool off it produced 300,000, shipped, and came
straight back from the phone as unkillable. Use the harness for RELATIVE
comparison; every absolute stays a playtest. (This file and the top of
`diag-encounter.mjs` both already said so.)

**`git stash push src/` stashes NOTHING when the change is already committed.**
The "before" half of an A/B then runs the fixed code, and the comparison shows
the fix on both sides while looking perfectly well-formed. Check the pre-change
file out explicitly — `git checkout <sha> -- <path>` — and restore it after. And
prove the revert actually landed by looking at the ARTEFACT, not by grepping for
a token: the grep used here (`ffd166`) matched the new explanatory comment as
well as the old code, so it returned 1 in both states and confirmed nothing. The
before-screenshot showing the bug is the only proof that the before-run ran the
buggy build.

**A freeze timed past the shorter-lived thing flatters the change.** The Vader
capture froze 260ms after the last hit. An ordinary label lives 420ms and the
duplicate being removed lived 780ms, so the "after" frame caught only a fading
CRIT and no numbers at all — it looked like a triumph and was an artefact of
when the shutter opened. Both sides of an A/B must be sampled where the
SHORTER-lived subject is still alive; this one moved to 90ms.

**A test that samples too early cannot tell LATE from NEVER.** `smoke-endless`
waited a flat 2500ms after Vader's wound and then read `!!gs.doorZone`. The exit
opens on a 1500ms `delayedCall`, which resolves at 3484ms in this harness — so
the check was reading the container's frame rate, and it reported a soft-locked
endless run when the door was merely still opening. Worse, the walk that follows
was wrapped in `if (gs.doorZone)` using that same early sample, so a late door
SKIPPED THE WALK ENTIRELY and produced a second, invented failure ("walking out
does not advance the sector") when nothing had walked anywhere. Poll for the
condition, bound the poll generously, and **report the measured delay** — a
failure that says "opened 3484ms after the wound" and one that says "never
opened inside 10s" are different bugs and must not print the same line.

**Hand-staging past a production hand-off leaves it untested.** The same file
called `gs.spawnBoss(...)` directly the moment the boss room loaded, skipping
`_onArenaCompleted`'s boss branch — the survive-the-swarm round, the cull, the
800ms spawn — and fighting Vader with `arenaActive` still true and waves still
spawning, which no real run ever does. Proved by injecting a soft-lock into that
branch: the file stayed green. It now clears the arena and lets the game spawn
him. **If you cannot break a code path and see the test fail, the test does not
cover it** — inject the bug and check, rather than assuming the staging is
equivalent.

**A wrong argument to a staging call reads as the feature not existing.** A
throwaway rig for the parry called `gs.spawnBoss({ encounter: 3 })`, but the
signature is `spawnBoss(bx, by, opts)` — so `boss.x` became an *object*, every
velocity step appended `NaN` to it as a string, and the boss had no numeric
position at all. Every angle derived from it came out `NaN`, the probe bullet
never moved, nothing was ever deflected, and the rig reported "never caught a
parry frame", which is exactly what a missing parry would report. The tell was
in the diagnostic dump, not the failure line: `bx` serialised as
`"[object Object]NaNNaNNaN…"`. **Failure messages on a staged rig should print
the staged state, and staging should assert it** — `Number.isFinite(boss.x)` is
one line and would have failed in the right place.

**A postupdate probe cannot compare a pose to the fields that produced it on a
collision frame.** Phaser's order is PRE_UPDATE (`Boss.preUpdate` ticks the parry
timer and *draws* the blade) → UPDATE (scene collisions run; a bolt meets Vader
and `parry()` writes a **new** angle, arc and timer) → `postupdate` (your probe).
So on the frame a parry is requested, the sprite still shows the previous pose
while the fields already describe the next one. `smoke-deflect`'s
blade-agrees-with-`parryPose` check read a 135° disagreement on correct code —
which is the arc, not an error. The fix is to watch for the call rather than
guess at timing: wrap `parry()`, set a dirty flag, and skip exactly the frames
where it fired. This is the instrument-side view of the "a collision-time pose
lands one frame after its effect" trap in `CLAUDE.md`.

**Slow the clock, do not sample the shape.** A parry is 300ms — six frames here
at best, and a screenshot takes far longer than a frame — so photographing it as
it happens gives you one arbitrary point of the curve. `tests/evidence-deflect.mjs`
raises `parryMs` to 6s and pins `_parryT` to the fraction it wants, then shoots
through the **real** production draw path. A slow-motion camera, not a
reconstruction. The same applies to `superAbsorbGraceMs`/`superReleaseMs`. The
alternative — reimplementing the pose in the rig — produces pictures that agree
with the rig forever, whatever ships.

**Sample a physics curve against the OBJECT's own clock, not the wall's.**
HISTORICAL in its specifics — the orb's speed is a constant now — but the
technique is the general answer for any timed curve. The returned super's speed
followed a 350ms launch-to-cruise curve, and this harness's first sample of it
lands 50-90ms in — so "assert 600px/s at release" cannot pass
on a correct build. `smoke-deflect` records each sample paired with the orb's own
`_settleT` and compares it against the curve evaluated at that same `_settleT`.
That proves the launch value, the shape and the floor at once, and it is immune
to the frame rate. Related: a guard that reads a slowed timer ONCE and only
complains when it is in the wrong RANGE says nothing when the event has already
finished — check the largest value a per-frame sampler ever saw instead.

**A rejected design leaves its checks behind, and they will pass on the
replacement's absence.** The launch-to-cruise curve below was later deleted
outright — handset review rejected the concept, not the tuning — and every band
check that had been written to protect its shape then had to go with it, because
a constant speed satisfies "never dips below cruise" perfectly. What replaced
them asserts the new claim positively (every sampled frame within 3px/s of
`PLAYER.superSpeed`) AND comparatively (the first third of the flight against
the last third, within 2px/s), because a spread check alone passes on a curve
that happened to be sampled inside one band. Do not keep an obsolete test for
the safety of its check count.

**Assert against the SOURCE a value is derived from, not a copy of it.** The
orb's speed is `PLAYER.superSpeed`, so `smoke-deflect` compares the two
constants rather than either against a literal 1080. A literal in the test is
the same defect as a literal in the config: it agrees with itself while the two
things it is supposed to hold together drift apart.

**Start and end values do not protect a curve — its SHAPE is the thing being
reviewed.** HISTORICAL: the curve this lesson comes from was deleted, and the
returned super now travels at one constant speed. Kept because the lesson
generalises. The first launch-to-cruise curve passed "launches at 600, cruises
at 470, never dips below cruise" and was rejected on a handset anyway:
`(1-u)^3` sheds two thirds of the excess in the first fifth of the window, so
the launch frame and the cruise frame are the same frame. The checks were true
and the feature did not exist. The fix at the time was to bin the samples by `u`
and assert a floor in each band; those band checks went out with the curve, and
what replaced them is described in the lesson above.

**A pose ticked after the block that draws it is one frame stale, and at 20fps
that is most of the gesture.** The super throw's phase was advanced in
`_tickMechanics`, which runs after `preUpdate`'s weapon block; the test compared
the live blade against `superSwingPose` at the phase it read at `postupdate` and
saw 90 degrees of disagreement. The instrument was right and the game was wrong
— on the launch frame the orb left while the blade was still short of the throw
line. Moving the tick ahead of the draw fixed both. When a pure-curve check
disagrees with a live sprite, suspect the ORDER before the curve.

**Kill the tweens between staged runs.** VANISH ends with `spin(scene, b)`,
which tweens the WEAPON SPRITE's rotation and keeps writing it after the move is
over. A VANISH the AI ran in the gap between two staged throws was still turning
the blade during the second one, and the pose check read 150 degrees of a tween
nobody had cancelled. `gs.tweens.killTweensOf(b.weaponSprite)` at the top of
each run. This is also a standing hazard in the game, not only in the harness.

**Photograph the thing the beat is about.** The throw evidence was first staged
on the 900px lane the flight cases use. The camera follows the PLAYER and shows
~1196px of world, so all nine beats of "did Vader visibly throw it?" came back
with Vader cropped off the top edge. A staging that is right for one claim is
routinely wrong for the next one.

**Give a projectile measurement a RUNWAY, not just a lane.** The same flight was
measured across a 520px gap — 19 frames on a healthy harness and ONE on a
stalled container, where a single 500ms step covers a third of the lane. Two runs
in four then failed with "1 frames of it", which is indistinguishable from a
projectile that never launched. The volley still happens at 520 (any further and
`PLAYER.superRange` cannot reach him); both actors are moved onto a 900px
north-south lane while he is still holding it. Pick the geometry from what the
measurement needs to survive, including a bad machine.

**Put the shutter INSIDE the game when the thing photographed is shorter than a
round trip.** `tests/evidence-superorb.mjs` had to catch a ~1.3s flight and a
110ms compression beat. "Wait from Node, then pause, then screenshot" costs
200-400ms per `page.evaluate`, during which a 405px/s orb covers up to 160px — a
mid-flight capture came back showing the orb already landed and Vader mid-slam,
and the picture is of the slam. The rig now installs a `postupdate` hook that
tests the condition and calls `scene.pause()` on that very frame; Node only has
to notice it is paused. Two corollaries learned the hard way: arm the NEXT
shutter while the scene is still paused, or the gap between resume and arming
swallows the state; and resuming a paused scene hands the next update an
oversized delta, so a trigger window narrower than that jump gets stepped over.

**A trigger radius cannot photograph a dodge, because the margin IS the
measurement.** A fixed "pause when the orb is within 130px" missed a walk that
cleared by 233px and produced no picture at all. The dodge shutters fire on the
first frame where the gap starts GROWING again — the closest approach, whatever
it turns out to be.

**"hp went down afterwards" is not evidence that the thing under test hit.** The
same rig reported two failed dodges that were clean misses: the player had been
hit by Vader's own attacks while the orb sailed past. The returned super deals a
flat 455, so the hurt log is attributable — every check now asks whether a 455
landed, not whether hp moved. Related: a `player-hurt` listener registered per
case and never removed made one hit read as four, all with identical
timestamps.

**A rig's own conveniences destroy the measurements they were added to protect.**
The staging pin in that file healed the player every frame (so every dodge was
vacuously clean), held the guard stance open for 60s (so "does he resume offense
after the launch?" was answered by the rig, not the game — a guarding Vader is
forbidden to start anything), and pinned his position (so "he moves during the
stored-energy beat" could never happen). They are three separate switches now,
and the release turns off the two that are only correct before it.

**Read a mutated config back through the OBJECT, not through your own import.**
The slow-motion guard in `evidence-deflect.mjs` reads `_parryT` off the boss
after calling `parry()`. Reading `ENDLESS.bossMech.parryMs` back from the rig's
own `import()` proves only that the rig agrees with itself: under a Vite HMR
`?t=` URL the app holds a different module instance and the mutation never
reaches it.

**A measurement whose subject depends on an uncontrolled variable is
intermittent, and widening the threshold hides it.** `smoke-deflect`'s
super-return flight checks passed three runs in four. The orb is released ~1s
after the volley lands, and Vader spends that second walking to his standoff
range — so it spawned into a gap that was sometimes 500px and sometimes 90, and
at 90px it reached the player and died inside two frames with nothing to measure.
The block now pins him still on a clear 520px lane. Whether that gap is 90 or 500
is his pathing's business and `smoke-boss`'s problem; what the orb DOES once
released is this file's.

**Pellet spread is geometry, not the feature.** The same file first fired a real
30° super spread from ~380px and absorbed 5 pellets on one run and 3 on the next,
because the outer pellets miss a boss who is also moving. Whether a wide pellet
connects is `circleOverlap`'s business. The volley is now fanned in ORIGIN and
aimed at him, so all five reach the guard and the count under test is the number
that come *back*.

**Reading live `hp` when you meant `hpMax` measures what the boss already did to
you.** "The returned super cannot delete a full-health player" compared 455
damage against `p.hp`, sampled after a one-second absorb-and-release wait during
which Vader had taken the test player from 1000 to 150. The check failed, and it
was right about nothing.

**A census counts what EXISTS, and what matters is what is DRAWN.** The combat-text
diagnostic's first version filtered the display list on `type === 'Text'`. That was
fine against a build that destroyed each label — and wrong the instant labels were
pooled, because a retired one stays in the list forever with its old string set. It
reported the change that *cut* peak concurrent labels from 79 to 28 as having raised
them from 12 to 21. The fix is one clause (`o.visible && o.alpha > 0.02`); the lesson
is that changing a lifecycle can invalidate an instrument that never mentioned it.

**Photograph the subject on purpose; do not hope it walks into frame.** Four
consecutive attempts at a "Vader mid-move, being hit" still came back with no Vader
in them — first because `spawnBoss()` was called without the coordinates it takes
(so no boss existed, the move was refused, and an empty deck photographed as a clean
pass), then because the camera follows the player and the player was elsewhere. Place
the actors, assert the cast returned non-null, and only then open the shutter.

**A check can be protected by a guard you did not mean to test.** The "a stranger
raises no card" check passed happily against a build with its gate removed,
because a *second* guard downstream returned null anyway. Deleting one line is
not an A/B — the A/B has to be the regression that would actually happen. Here
that was a generic fallback entry, the thing someone adds when they want
strangers to speak too, and against that the check failed immediately.

**Repeats must vary exactly one thing.** `--mode vader` got `--repeats` to measure
wall-clock noise, and its first version seeded the bot's upgrade build off the run
index too. Three runs of one rung came back 4.6s, 21.1s, 4.6s — a "348% spread"
that was mostly three different players. The second attempt seeded per encounter,
which made rung-to-rung comparison mix hp scaling with build luck. It now seeds
once for the whole ladder, so rung n's build is a true prefix of rung n+1's, and
asserts across the repeats that the build did not vary.

**Anything that spawns a boss or a nemesis must load `?nodlg=1`.** The dialogue
card pauses Game and HUD and waits for a tap. Without the flag the bot sits behind
it for the entire cap — the first run after the narrative landed reported
encounter 1 as 180.2s with 45,826 of 46,000 hp left. Eleven files carry the flag;
`smoke-dialogue` deliberately does not.

**Sampling a beat on the frame it BEGINS can photograph the one frame two moves
share.** The first Vader visual-language sheet came back with SABER THROW and
CHARGE producing near-identical "release" stills, which read as the two moves
still being confusable. They were not: both marks had landed on the telegraph's
own commit bloom, which is generic across every lane zone in the game and fires
exactly as `act` begins. The moves diverge on the next frame — one has thrown
its blade, the other is travelling. `shot-vader-language` now holds three frames
past the beat. A frame index is part of a measurement's definition, and "the
first frame of the phase" is a specific and often unrepresentative choice.

**A threshold expressed as a fraction of a SHORT window is a threshold on the
frame rate.** The same harness asked to freeze at 95% of a wind-up. At ~50ms a
frame a 420ms wind-up yields exactly one frame above 0.9, and whether it exists
at all depends on the machine: a probe caught 0.75 then 0.95, a full run caught
0.75 then 1.17 and reported "never reached the mark" on a build that was fine.
The fix was not a smaller number — it was accepting `tel.committed` as
satisfying a late mark, which removes the race in both directions. Third
instrument in this file to learn the same thing.

**A measurement window that runs past the moment of truth proves nothing.**
`smoke-readability`'s "the saber comes back to his hand even after he moves"
kept flickering under suite load, so it was rebuilt to measure the closest
approach rather than one instant. It then passed on the fixed build — and
passed just as happily with the homing frozen to the coordinates he had left,
which is the exact bug it exists to catch. A stale blade ALSO ends up in his
hand: it flies to the old point, is caught there, and the sprite snaps back to
him. Every frame after that catch says "it came back" for both builds. Bounding
the samples to `_saberAway` — the flag that is true only while the blade is out
— is what made it discriminate.

**Some claims have no honest pixel threshold; compare two distances instead.**
The same check then read 76px on the fixed build, because the catch fires inside
26px and the last in-flight sample sits one frame of travel back — 76px on a
quiet machine, more on a busy one. Any bound on that number is a bound on the
frame rate. What does not move with the clock is WHICH of two candidate
destinations the blade ended up nearer: him, or the spot he left. Homing reads
26 vs 220; stale reads 92 vs 31. Ratios survive a slow machine, thresholds do
not — and this is the third instrument in this file to have learned it.

**Displacing, spawning or interrupting on a wall-clock delay is a race you lose
in both directions.** That check displaced Vader 1750ms after the cast. Under
load the blade was still outbound and the sample landed mid-flight; run
standalone, the blade had already been caught by then and the displacement moved
a saber that was back in his hand, so the check was vacuous in exactly the runs
where it was green. The trigger now fires from the flight's own state — turned
around and closing — sampled on the game's `postupdate`.

## LIGHTS OUT / SUPPRESSION rigs (added with the experiential-truth pass)

Three files, none of which assert "it looks good":

- **`tests/diag-lights-ab.mjs`** — the only trustworthy way to measure a
  darkness effect here. Pauses the Game scene, photographs ONE frame with the
  blackout overlay at alpha 0 and then at 1.0, and reports mean luminance in
  rings **around the player**, plus the gradient's own alpha read off the
  texture. Two traps it exists because of:
  - **Chromium screenshots are PNG colour type 2 (RGB, 3 bytes/px), not RGBA.**
    A decoder assuming 4 shears every row and reports the darkened frame as
    *brighter* than the lit one. That happened, and the numbers looked plausible.
  - **Before/after shots of a LIVE fight photograph different rooms.** The camera
    moves, so a 6x luminance swing between them means nothing. Freeze first.
- **`tests/shot-lights-out.mjs`** — the sequence on the real event path.
  Silences the boss's ATTACK clocks for the photographs (a boss mid-charge
  answers "what does the room look like" with a full-screen red hurt flash),
  snaps the camera after any teleport (it lerps at 0.22, and the pocket tracks
  the PLAYER, so a mid-lerp shot catches them outside their own sight radius),
  and **prints the live afterimage count before photographing ECLIPSE** — a
  shot of "eclipse" with zero clones in it is the classic vacuous pass.
- **`tests/diag-suppression.mjs`** — every player verb before/during/after, on
  the real `boss-disarm` event. Reads the HUD state FIRST inside each probe:
  every verb below it SPENDS something and emits a refresh, so a reading taken
  afterwards photographs an emptied meter rather than the state under test.

### A frame-rate lesson worth its own entry

Measured during this pass, **this harness renders a frame every ~190ms under
load** — not the ~50ms the rest of this file assumes. Consequences:

- No wall-clock threshold can distinguish a 110ms hard cut from a 420ms ease,
  because both complete inside one frame gap. The onset check in `smoke-vader`
  is asserted in FRAMES instead: the first frame showing any darkening is
  already near full for a cut and still climbing for an ease, which
  discriminates at 60fps and at 5fps alike.
- An in-page `await setTimeout(16)` loop is NOT a substitute for a `postupdate`
  hook. Measured, it returned **one sample for a 260ms window**, because a sleep
  resolves on the next rendered frame.
- Phaser tween CHAINS advance one link per frame here, so a three-link 190ms
  flicker takes ~600ms of harness time. That is an artifact, not a game bug.
- A chain is not a tween: `killTweensOf` does not reliably reach into one, so
  `HUD.setDarkness` holds the handle and stops it explicitly.

### Baseline comparisons for the three suites that failed the full run

Recorded during the experiential-truth pass, so the next session does not
re-investigate them. All three are pre-existing and none is a regression.

| suite | full suite | standalone | verdict |
|---|---|---|---|
| `smoke-boss-moves` | FAIL 1/18 — "costs them a dash charge" | **PASS 18/18**, twice | load-sensitive; the diff under test touches no dash, push or boss-move code |
| `smoke-deflect` | FAIL 13/73 | 73/73, then FAIL 1/73 on a **different** check | section 4c, see above — a **fifth** distinct check across this session's four runs |
| `smoke-readability` | FAIL 2/19 | FAIL 1/19 — "he is PLANTED through his wind-up" | **reproduces on the pre-change build**, which failed the same check plus one more |

Two of these are worth understanding rather than re-running:

- **`smoke-deflect`'s 13-failure run is ONE failure, not thirteen.** The first
  check in that block is its own occurrence guard, `sweepFrames > 3` — a FRAME
  COUNT. Under full-suite load this harness renders one frame every ~190ms, so
  a 260ms sweep yields one or two frames and the guard cannot pass. Every check
  after it consumes samples that were never taken. DEFLECTION is frozen: do not
  retune it because its photographic gesture test cannot be photographed on a
  loaded box.
- **`smoke-readability`'s "PLANTED" check reports `0px/s drift 93px`** — speed
  zero, displacement 93px. Planted, but moved discontinuously between two
  samples 190ms apart. The threshold is `drift > 40`. On the pre-change build
  the same check reported `drift 50px` and also failed. The instrument mixes a
  per-frame speed with a whole-window displacement, and at this frame rate the
  second one measures the machine.


## A dev server that has had `src/` swapped under it will lie to you

**Measured 2026-08-24, six confident false failures in one run.** The baseline
A/B procedure (`git checkout <old> -- src/`, run, `git checkout HEAD -- src/`)
happens while `npm run dev` is live, and Vite's module graph does not always come
back cleanly: a later run reported six arena-darkening and parry checks failing
on source that passes 116/116 the moment the server is restarted. The failures
were plausible, clustered, and entirely fictional.

So: **after any baseline checkout, kill and restart the dev server before
trusting the next measurement.** And if a run fails checks in a system you did
not touch, restart the server and re-run *before* investigating the code. Note
that a second `npm run dev` does not replace the first — it takes the next free
port and the old server keeps serving 5173.

## The returned super: 455 is the damage, 620 is the ceiling

`smoke-vader`'s frozen-values block used to assert `superReturnDamageMax === 620`
under a label that said it protected "the returned super's damage". Both halves
were individually defensible and together they were misleading enough to produce
a wrong report. The runtime is
`min(superReturnBase 180 + superReturnPerPellet 55 × pellets, 620)` over
`PLAYER.superPellets` = 5, so the delivered number is **455** and the ceiling
does not bind until eight pellets.

There are now four separately-named checks: the speed, the schedule, the derived
455 ("THIS is the delivered damage"), and the ceiling ("it is not reached — never
report it as the damage"). The 455 is computed from the live config rather than
written as a literal, so the assertion and the game cannot drift apart. The same
derivation already existed in `smoke-deflect` as `expectDmg`.

## Dark-arena rigs (added with the art-direction + ownership pass)

- **`tests/shot-saber-glow.mjs`** — Vader's saber across its whole combat
  vocabulary in darkness, plus a matched A/B on one frozen frame. Writes
  `docs/evidence/saber-glow/`. Five ways it lied before it told the truth, all
  of which produce a *clean-looking* result:
  - **A dropped `page.evaluate` argument.** `forceDark(on)` never passed `on`,
    so the helper took its early return and every shot photographed a lit room
    while every probe reported the glow missing. A dropped argument is
    indistinguishable from an unimplemented feature. Two runs.
  - **Banner text instead of registry ids.** `_castBossMove(b, 'SABER THROW')`
    returns null — the id is `saberthrow`. A refused cast reads exactly like a
    move that ran and did nothing. Assert the cast fired.
  - **A comparison against a key that does not exist** (`p.w.rotation`, where
    the sampled object names it `rot`) reported a mismatch on numbers that were
    identical. `undefined === undefined` is the failure mode to fear here.
  - **The rig's own forced darkness cancelled underneath it** by a real
    activation's 2.6s turn-off. Silence his mechanic clocks at SETUP, not later,
    and drop any `_lightsEndEv` the owner has already armed.
  - **A hush that sweeps the enemies also sweeps ECLIPSE's clones**, so the
    composition measured zero clones after spawning three. Count before hushing.
  - And the standing one: a full-screen hurt flash photographs as a flat red
    rectangle, and on a **paused** scene it never fades. Heal, let it run out,
    then pause — in the SAME round trip as the telegraph sweep, or 50-200ms of
    live game opens a fresh telegraph on top of the thing being measured.
- **`tests/shot-dark-arena.mjs`** — the encounter-6 sequence, plus a matched A/B
  on **one frozen frame** (`scene.pause()`), plus the vignette's own alpha
  profile read off its texture. Writes `docs/evidence/dark-arena/`.
- **`tests/diag-lights-cadence.mjs [seconds]`** — a real Vader 6 fight with
  **nothing silenced**, hooking `set-darkness` and folding the raw on/off tape
  into events, gaps and per-minute. It hooks the event rather than the new state
  owner on purpose: that is the last thing this build and `577761e` have in
  common, so the same rig measures both and the numbers are comparable instead
  of asserted.

### Five ways these lied before they told the truth

- **A `TweenChain`'s config has no `onUpdate` to hand down to its links.** The
  arena tint animated a scalar that nothing ever read, and the rig photographed
  a fully lit room half a second into an *accepted* LIGHTS OUT. The callback
  goes on every link. This is an engine fact, not a rig bug — it shipped into
  `GameScene` first.
- **A screen-sized overlay cannot be sampled horizontally past 360px.** The
  vignette texture is exactly VIEW-sized, so `getImageData(cx + r, cy)` runs off
  the canvas at r = 360 and returns 0 for every radius past it —
  indistinguishable from a gradient that was never painted. Sample along the
  diagonal.
- **A missing class must fail, not pass.** `meanLum(layer, 'floor')` returned
  `-1` when no object carried the tag, and `-1 < 0.20`, so every "the arena
  darkens" check passed on the build with no arena darkening. Caught only by
  running the A/B. Empty sets return `Infinity`. And a room can legitimately
  have none of a class — the Vader chamber has `walls: []` — so pin those from
  the registry rather than measuring an empty set.
- **A wall-clock sleep does not deliver wall-clock delta.** Phaser clamps
  `delta`, so at this harness's ~190ms frames a 4500ms sleep delivers well under
  4000ms of accumulated game time — SUPPRESSION's 4000ms lock was still up when
  the probe read it. Marginal since that block was written; it started tripping
  when the suite got longer. **Wait on the condition, not the clock.**
- **A refused cast reads exactly like a gated one, and it flakes.** A first
  draft of the FORCE PULL + DEFLECTION contract cast the move and checked it
  took. It flipped between pass and fail on consecutive runs: `_castBossMove`
  legitimately refuses while his state machine is mid-attack and while
  DEFLECTION's stance is up. Replaced with a deterministic claim — that LIGHTS
  OUT writes nothing to his scheduler.

### And one process lesson

**Do not edit a `.mjs` under test while `npm run smoke` is running.** A full
run was spent producing two bare `Node.js v22.22.2` crashes in `smoke-vader`
and `smoke-score` because the file changed under the runner. `tests/README.md`
already said not to modify source during capture; it applies to the suite too.


---

## Arena-pilot rigs (added with the environment visual pilot)

Nine files, and two of them are tests.

| file | what it is |
|---|---|
| `smoke-arena.mjs` | **assertion test.** In `run-all`. Protects structure, never taste. |
| `shot-arena-pilot.mjs` | **evidence.** `node tests/shot-arena-pilot.mjs <tag>` → `docs/evidence/arena-pilot/<tag>/`. Same camera stations every run, so before/after is the same room and not two prettiest-camera shots. |
| `shot-hero-machine.mjs` | **evidence, polish pass.** Same contract, stations derived from the hero prop's world footprint rather than from the room. |
| `shot-hero-shape.mjs` | **evidence for one open decision, shape pass.** The same thirteen frames for each candidate silhouette. `node tests/shot-hero-shape.mjs shape-12` then `shape-16`, flipping `POD_SHELL` between runs — the loser is deleted, so this rig cannot be re-run without rebuilding it. |
| `shot-console-kit.mjs` | **evidence, console kit.** Each archetype at its own frozen cover coordinate, in both power states, then the same consoles in live combat. |
| `shot-arena-ambient-ab.mjs` | **evidence for one open decision.** One frozen frame at two `LIGHTSOUT.floor` settings. |
| `smoke-hangar.mjs` | **assertion test, second arena.** In `run-all`. The hangar's own structural truths, plus a group that asserts the hangar is NOT the chamber — different perimeter style, no hero-machine emissive faces, no `dais` or `trench`, and it must use `track` and `hatch`. A second room that passed by copying the first would prove nothing. |
| `shot-hangar.mjs` | **evidence, second arena.** `node tests/shot-hangar.mjs hangar-before` then `hangar-after`. Eight quiet stations, wave combat, and then late Vader in both power states — spawned INTO the hangar rather than by loading the chamber, because "SPAWN VADER keeps the current room" is the contract the whole pass depends on. |
| `sheet.mjs` | **not a rig — a layout tool.** `node tests/sheet.mjs OUT.png LABEL:a.png LABEL:b.png` lays screenshots side by side with captions and photographs the result, so a matched pair is one file rather than two to alt-tab between. Playwright renders it because it is already a dependency. Two traps, both cost a rebuild: `setContent` with no DOCTYPE is QUIRKS MODE, where `body`'s height is the viewport's; and a flex row without `align-items: flex-start` makes every figure STRETCH and report the viewport height back as its own. Either one silently pads the sheet with half a screen of background. |

### Eight things these rigs learned the hard way

**`_sectorTint` will silently ruin every arena photograph.** The endless
per-sector wash is an ADD-blended screen-locked rectangle at depth 9000, up to
0.20 alpha. At sector 30 — which is where a rung-6 Vader lives, which is where
these rigs put you — it lays a solid olive film over every pixel, and the first
baseline sheet photographed a green-brown swamp instead of a near-black chamber.
It is a separate system from the room art. Turn it off for station shots and
keep **one** frame with it on, or the sheet is lying in the other direction.

**A `setDark(false)` before any `_enterDarkArena` throws.** `_darkMix` is
created lazily inside `_enterDarkArena`, so the tidy-up path that sets
`gs._darkMix.v = 0` explodes on the very first call. Guard it.

**Freeze with `scene.pause()`, and re-hush after every resume.** `pause` is the
only thing that stops `scene.update`, and the pause/resume round trip lets a
cycle of the boss's clocks land — every station shot in `shot-arena-pilot`
re-silences them after resuming or it photographs a stray SUNDER.

**`hush()` has to sweep the wave, not just silence the boss.** The survival
round keeps spawning underneath the boss fight, and both shot rigs originally
cleared the enemies once at the top of the run — so half the environment frames
came back with six troopers standing in them. The sweep belongs in `hush`, which
runs before every shutter.

**A STATION IS A PLAYER POSITION.** The game camera follows the player, so a
`centerOn(somethingElse)` is overwritten by the follow on the very next update.
The console rig spent a full run photographing a camera that had not moved.
Solve for the player instead — and remember the camera CLAMPS at the arena
bounds, so a console at y=1240 in a 1600px arena lands at screen y 920 whatever
you ask for, which in this game is underneath the touch controls. That station
is framed off-centre in x for exactly that reason.

**A/B a SILHOUETTE at runtime scale, never on the source canvas.** The whole
complaint that started the shape pass was about motion and about how the object
sits beside the rest of the room; a 4x view of the texture answers neither. The
sixteen-facet candidate looks better zoomed and worse in the game, which is the
only place it matters. `hero-pan-a/b/c` — three frames of a camera travelling
past the prop — is the closest a still sheet gets to the real question.

**Freeze the room's gameplay geometry as LITERALS, post-`snapAll`.** The Vader
chamber's cover is written as 400/1200 in `rooms.js` and `mapUtils.snapAll`
moves it to 440/1240 at load. `smoke-arena` first froze the pre-snap numbers and
failed against the untouched build. A check that derives its expectation from
the file it is checking cannot fail; a check that freezes the wrong end of a
transform fails on everything. The shape pass split it further: cover
POSITIONS stay frozen literals, cover TEXTURES are a separate and deliberately
un-frozen question, because which console art stands on a frozen spot is
exactly the thing that pass was allowed to change.

**THE HUD'S TOP BAR EATS THE FIRST ~20 WORLD PIXELS OF A NORTH WALL.** The
game camera is inset by `HUDCFG.topBarHeight`, so world y 0 lands at screen 84
only while the camera sits at its northern clamp. One step south and the
outermost edge of the band is under the bar — which is where the hangar's blast
door had its fixture housings on the first build, and why they photographed as a
door with no lights on it from half the stations in the rig. A north-wall
feature is legible only when the player is in the north half; that is a real
constraint on where a landmark can live, not a rig artifact.

### The A/B that made `smoke-arena` worth having

Run against `1b837d0` (the pre-pilot build) it fails 13 checks — the emissive
layer, the power-state composition, the lifecycle counts, the removed
placeholder and the two "the pilot exists at all" guards. The geometry, saber,
darkness-clock and material-class checks all **pass** on that build, which is
what makes them regression detectors rather than decoration.

### Proving the OTHER rooms are untouched — by pixels, and why it is not a test

The polish pass needed to show that a change to shared painters (`PAL`,
`paintBackdrop`, `drawPerimeter`) did not reach the hangar, the corridor or the
detention block. Reading the diff is not proof; hashing the painted backdrop is.

**`paintBackdrop` calls `Math.random` for its panel and scorch passes**, so the
composite is different on every load and cannot be hashed as it stands. Pin
`Math.random` to an LCG inside the probe, remove the cached `backdrop-<id>`
texture, reseed, and reload each room: everything else in the painter is
deterministic, so the hash IS the authored structure and it is stable across
runs. A/B against `e2f56b3`:

```
hangar     e178a7ff -> e178a7ff   identical
corridor   694185ac -> 694185ac   identical
detention  5f617db1 -> 5f617db1   identical
vader      a3df44ea -> 36b6b6b0   changed, intended
prop-pod   ccad2935 -> 2f2611a5   changed, intended
```

**It stayed out of `run-all` on purpose.** Baking those four hashes in would
freeze three arenas that are deliberately unstyled — the next person to give the
hangar a pass would have to update a hash to do legitimate work, which is how a
check becomes a tax. `smoke-arena` asserts the thing that actually matters
instead: each non-boss room is loaded for real and must have zero emissive
parts, zero additive environment objects, and none of the pilot's opt-in spec
fields. That catches propagation without holding anyone's future work hostage.

### The `smoke-vader` failures during the pilot — one real, five load

Raising `LIGHTSOUT.floor` / `.wall` / `.prop` so the pilot's architecture stayed
legible in the dark broke SIX checks in `smoke-vader`. Untangling them took two
different diagnoses, and both are worth keeping.

**One was real.** `FROZEN: the arena material values and transition timings are
untouched` is a frozen-constants check and it was doing exactly its job — those
four numbers came out of a handset verdict on how dark LIGHTS OUT should be.
The numbers went back; the pass shipped without them. The A/B is in
`docs/evidence/arena-pilot/ambient-ab/` for the human to rule on. When a frozen
check fails and it points at a constant you moved, the instrument is right.

**Five were load, and they all told the same lie.** After the revert, five
checks in the LIGHTS OUT section still failed: floor luminance, structure
silhouette, console-vs-floor ratio, the sector wash, and the "power CUTS"
first-step tape. They look like five findings. They are ONE number:

| reported | implies |
|---|---|
| floor at **0.772** of lit | `1 - 0.25 × 0.917` → `v = 0.25` |
| wash `0.2 -> 0.1575` | `0.2 + (0.03-0.2) × 0.25` → `v = 0.25` |
| tape `[[26,0,0],[27,0,0],[212,0,0.88]]` | three frames in 400ms, and `v` still 0 at 212ms |

`v = 0.25` is the low point of the onset's three-link stutter — link 2's end,
exactly 100ms into a 140ms chain — and the `during` snapshot is taken 800ms
after the request. So the chain had barely started when a sample 800ms later
caught it 100ms in: the *scene* was running at a small fraction of real time,
because a second Chrome from a concurrent evidence run was on the box.
**Standalone on an idle machine the same build returns 116/116.**

The tell that saves the time: before chasing five failures, check whether their
numbers all reduce to one scalar. If they do, you have one measurement problem,
not five regressions — and per the top of this file, check the load first.

### `smoke-readability`'s FORCE PULL wind-up check fails on `1b837d0` too

Measured 2026-08-25 during the arena pilot, standalone on an idle box, with the
dev server restarted between the two source checkouts:

| source | result |
|---|---|
| `1b837d0` (untouched) | FAIL — `forcepull 0px/s drift 88px` |
| the pilot | FAIL — `forcepull 0px/s drift 111px` |

Same check, same cause, and the pilot's diff touches **zero lines** of `Boss.js`,
`bossMoves.js`, `MoveScript.js` or `Telegraph.js`. It is the case
`docs/POST-MORTEM-vader-moves.md` already names — *a move legitimately
displacing the thing being measured* — with a 40px allowance against a pull
that drags. Pre-existing, not the pilot's, and not fixed here because Vader is
frozen and this is an instrument problem rather than a game one.
