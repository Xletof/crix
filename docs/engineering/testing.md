# Testing and validation — agent reference

`tests/README.md` is the full harness reference (what each suite protects, and
every documented way the harness has lied). `docs/POST-MORTEM-vader-moves.md` is
the origin of the validation rules below. This file is the distilled version an
agent needs before writing or trusting a check.

## Running

- `npm run dev` (Vite on :5173) must be up. One suite: `node tests/<name>.mjs`.
  Full suite: `npm run smoke` (`tests/run-all.mjs`, 52 suites, sequential on
  purpose — several mutate world state). `npm run smoke -- --only a,b` runs a
  subset. `npm run build` is the build check.
- Prefix conventions: `smoke-*` assert and exit non-zero; `diag-*` measure and
  print; `shot-*` produce screenshots/films for evidence.
- Run the suites covering what you touched, plus `smoke-stuck-audit` (src-diff
  guard) and the role smokes when an enemy seam is involved. A full run is for
  closing a phase, not for every edit.
- Do not run a suite standalone while the full suite is running its own copy.
- After editing `src/` mid-session, restart the dev server — HMR can serve a
  module twice (`smoke-encdbg` 31/33 on a correct build, 33/33 after restart).

## Current suite health

Not green: `run-all` was 47/52 at T2 (camera, deflect, vanguard-front,
vanguard-screen, captain), each A/B'd against the pre-T2 build. The live list is
`HANDOVER.md` §0, UNRESOLVED-WORK REGISTER #9–#11 and #17. Report counts and
failing files exactly; never describe the suite as green when it is not, and
never weaken a check to make it pass.

- **The default changed in R1.** No flags now means the integrated production
  configuration; a check that compares against pre-R1 behaviour must name
  `baseline=legacy` (`bootPage` pins it by default; the seven flag-aware
  standalone smokes pin it at their single `goto`). The run-all suites run the
  production default.
- **Container browser path.** Rigs hard-code `chromium-1194`; an image that
  ships another build needs the symlink in `tests/README.md` (R0 section) —
  also for old-build worktrees used by identity sections.

## Rules for checks that tell the truth

1. **A failure under load is not a regression** until it fails standalone AND
   does not fail on the previous build. Intermittent failure means the
   instrument is wrong, not the threshold.
2. **A/B every new check** against the build it replaces (`git stash` or a
   worktree). A check that passes on the bug is decoration.
3. **A refused call reads exactly like a failed one.** Assert the thing under
   test actually ran (`_castBossMove` returns null, `spawnEnemyAt` with
   arguments in the wrong order spawns nothing, a dead player refuses casts).
4. **Frame rate is 6–20 fps headless.** Sample inside the page on a `postupdate`
   hook, never by `page.evaluate` polling; poll for conditions, never fixed
   sleeps; drive effects on the actor's own clock (`_clock`) or step the loop
   by hand (`game.loop.sleep()` + `game.step(t, 1000/60)`) for sub-100ms beats.
   Never let a px-per-frame or sample-count threshold stand in for a rate.
5. **Do not verify a behaviour with the system it shares an actor with switched
   off**; run one pass with nothing silenced.
6. **Assert the reading, not just the effect** (zone before damage, one zone per
   attack, telegraph tracks its actor) and iterate registries rather than
   per-move checks.
7. **Look at it.** For screenshots: `scene.pause()` (freezing tweens does not
   stop `update`), `cameras.main.resetFX()` first (a paused hurt flash is a
   permanent red wash), kill `HUD.banner` and zero `_sectorTint`, null the room
   modifier in both halves of an A/B, and load with `?nodlg=1` when a boss or
   nemesis spawns.
8. **Determinism.** Rigs seed `Math.random`; overlays, particles, `Text` labels
   and a filming camera consume randomness and change the fight. Publish a film
   only after it is verified tick for tick against the headless replay.
9. **Config from a rig:** reading via dynamic `import('/src/config.js')` is safe;
   mutating it is not (second module instance). Mutate through the game's own
   entry points (`director.cfg`, `?camdbg=1`, DEBUG scene).
10. **Never measure the command you just wrote** (velocity set this frame), and
    never zero a cooldown and then measure the spacing it controls.

---

## Migrated record

Migrated from the root `CLAUDE.md` at `7d67bed` with original wording. **Status
(2026-11-02):** two entries in the last subsection describe placing the camera
with `stopFollow()` + `setScroll()`; those predate `CameraDirector`, which now
re-solves and writes scroll on every `update`. `stopFollow` has nothing to stop,
and a rig-written scroll survives only if the scene is paused before the next
update. Pin the camera by pausing immediately after placing it, or by stubbing
`gs.cameraDirector.update` for the shot.

### The post-mortem rules and harness notes


**Read `docs/POST-MORTEM-vader-moves.md` before adding a boss or enemy attack, or
before writing a test for anything visual.** A boss redesign took four releases
instead of one; the first shipped with 17 passing checks and was rejected on
sight. Almost all of the lost time went into instruments that were wrong about a
game that was right. Seven rules came out of it:

- **Never verify a new behaviour with the system it shares an actor with switched
  off.** Every boss test opened with `b.cooldown = 1e9`, which is exactly what
  stops Vader's old state machine — so the harness could not see the two systems
  fighting over his velocity every frame. Silence a clock to stabilise a
  measurement if you must, then run one pass with nothing silenced and assert the
  fight is still coherent.
- **Effects are not readability.** "The player was dragged 60px" cannot fail when
  the move is unannounced. Assert the reading: a zone exists before damage, one
  zone per attack, the body visibly winds up, and a telegraph's origin tracks the
  actor that will hit you. Do it by iterating the move REGISTRY — a per-move
  check gets forgotten when a fifth move is added, which is exactly what happened
  to two of the four.
- **Intermittent failure means the instrument is wrong, not the threshold.** It
  was true every single time here: async polling in a ~50ms/frame harness, a
  refused cast reading as zero on every probe, a previous move's tween still
  running, a move legitimately displacing the thing being measured, and a pixel
  threshold that was really measuring the machine's frame rate.
- **A refused call reads exactly like a failed one.** `_castBossMove` returns
  null while another attack owns the actor; every probe then reads zero and half
  the checks pass vacuously. Assert the thing under test actually ran.
- **A/B every new check against the build it replaces.** Three of one round's
  four checks passed on the broken code and had to be rewritten until they
  discriminated. A check that passes on the bug is decoration.
- **Look at it.** Screenshots caught three bugs no assertion did — a saber whose
  scale compounded 35% per throw until it lay across the room, a stray telegraph,
  and a safe zone drawn in the danger colour. Note that freezing `tweens.timeScale`
  and pausing physics does NOT stop `scene.update`: telegraphs keep ticking and
  destroy themselves before the shutter. Use `scene.pause()` for a photograph.
- **Probe a theory before designing around it.** I was confident the boss's AI
  was snapping his thrown saber back to his hand; a one-frame probe measured it
  503px away and the premise was false.

**`_castBossMove` MATCHES THE REGISTRY ID EXACTLY, AND THE IDS ARE LOWERCASE**
— `saberthrow`, `forcepull`, `forcepush`, `sabercombo`, `vanishslash`. A
camelCase argument is refused, the boss's own state machine supplies the next
frame, and the screenshot is filed under a move that never ran. Two evidence
rigs shipped with that bug. **It also refuses outright once `player.alive` is
false, and staging Vader next to the player kills the player** — restoring hp is
not reviving, so a rig that repositions him has to revive as well
(`p.alive = true; p.setActive(true).setVisible(true).setAlpha(1)`). Assert every
cast and print the refusal reason; "a refused call reads exactly like a failed
one" is the post-mortem rule and it keeps arriving in new costumes.

**Two engine facts that cost a round each.** Sprite `preUpdate` runs on
PRE_UPDATE, *before* the tween manager steps on UPDATE — so anything a move
TWEENS survives the AI and anything it SETS DIRECTLY (velocity above all) is
overwritten next frame. And a `time.addEvent` tick budget must not assume one
tick per frame: Phaser's clock catches up by firing several in one frame, so a
`repeat` count sized in ticks burns several times faster than the thing it is
driving.

**A placeholder is not a deliverable.** `Telegraph.js` used to draw a circle and
a rectangle; that was the whole visual vocabulary. Shipping it while calling the
moves finished is what "very bad quality effects, too simple blue circle or red
rectangle" means. Two related traps: reusing the PLAYER's effects on an enemy
makes its attacks look like the thing you just did to it (the boss was using the
Riven melee's slam and blade arc), and plain geometry reads as debug art — zones
are scorched into the floor now, with the shape unchanged so the drawing and the
hit test still cannot drift apart.

**Commit and push at every checkpoint.** The container was rolled back to an
older commit at least four times during that work. Only pushed work survived.

The suite lives in `tests/` — `npm run dev` in one shell, `npm run smoke` in
another. **`tests/README.md` is the real reference**: it lists what each test
protects and documents six specific ways this harness produces false passes.
The short version:

- **Headless runs at ~20 FPS**, so Phaser `TimerEvent`s resolve coarsely — a bare
  `delayedCall(70)` measures 150–220ms. Use generous waits; that is a harness
  artifact, not a game bug.
- **Sample from inside the page** via a `postupdate` hook. `page.evaluate`
  polling costs 200–400ms a round trip and will miss most of a fast animation —
  that has already produced a false pass here.
- **Short-lived FX (<150ms) can't be screenshotted reliably** at that frame rate.
  Freeze the clock first: `scene.tweens.timeScale = 0` (and `physics.world.pause()`),
  then capture.
- This project is heavily visual: **verify with screenshots**, not just assertion
  counts. Several past "passing" tests were wrong assertions, not working code.
- **A/B every measurement against the pre-change build** (`git stash`) before
  trusting it. If the test doesn't fail on the old code, it isn't testing the
  change.
- **Intermittent failure means the measurement is wrong, not the threshold.**
  Both flaky tests found here turned out to be measurement bugs.

### Background processes (full record)


**ONE REAL JOB, ONE LIFECYCLE OWNER.** Ten immortal waiter shells accumulated
here while a single suite ran, long after that suite had finished. The whole
class of failure is prevented by four habits, and every one of them costs less
than the cleanup did.

- **NEVER LET A WAITER DISCOVER ITSELF.** The bug was
  `until ! pgrep -f "run-all.mjs"; do sleep N; done`. `pgrep -f` matches full
  COMMAND LINES, and the waiter's own `bash -c` line contains the string
  `run-all.mjs` — so it detected itself, could never exit, and once a second one
  existed each kept the other alive too. This is not a subtle failure mode you
  have to go looking for: `pgrep -a -f chrom` on an idle box with no browser
  running returns exactly one hit, the shell asking the question. Verified here.
- **PID BEATS PATTERN.** For anything this session starts, capture `$!` at
  launch and own it: `node tests/run-all.mjs > "$LOG" 2>&1 & SUITE_PID=$!`, then
  test liveness with `kill -0 "$SUITE_PID" 2>/dev/null` or wait on that PID
  directly. Never rediscover by text a process whose PID you already had.
  `pgrep -f` is FALLBACK ONLY — for a process nobody here launched — and then it
  must be scoped so it cannot match the asking shell, and the candidate PID
  inspected before anything is done to it.
- **A TOOL TIMEOUT IS NOT PROCESS DEATH.** It means the tool stopped waiting and
  NOTHING about the job. After one: inspect the PID, inspect the existing
  waiter, read the log — then reuse or clean. Launching a second copy "because
  there was no output" is how one waiter became ten.
- **WAITING IS ORCHESTRATION, NOT WORK.** At most one real process plus one
  lifecycle owner. Never wait for a waiter, never create a waiter to watch a
  waiter, and prefer NO dedicated waiter at all — the next turn can just look at
  the PID and the log.

**FOUR STATES, AND CONFLATING TWO OF THEM IS THE INCIDENT.** *Running*: the PID
is alive. *Finished*: the PID has exited and a log exists. *Waiter timed out*:
only the observer stopped; the job's state is UNKNOWN until checked. *Stale
waiter*: the observer is still alive after the job is known to be over — always
a bug, never a wait.

**CLEANUP IS PART OF THE JOB.** When a suite, build or deploy completes, fails,
is superseded or is killed, its waiter goes with it. Before saying *stopped for
human review*, audit for stale waiters, live test runners, orphaned Chromium and
temporary servers, and name any intentional survivor (the `npm run dev` Vite
server is the normal one) explicitly rather than leaving it in the list unlabelled.

**NO PATTERN KILL WITHOUT INSPECTION.** `pkill -f <string>` has the same
self-matching hazard as `pgrep -f`, with teeth. List the candidates, read their
command lines, then kill the intended PIDs. Nothing here needs a process manager,
a daemon or a dependency — this is shell lifecycle discipline, and that is all.

### Rig traps that were filed under other subsystems

- **The dialogue card PAUSES Game and HUD.** Any test that spawns a boss or a
  nemesis must load with `?nodlg=1` or it will sit behind the card for its whole
  cap. `smoke-dialogue` is the only one that must not.

- **A CAMERA STATION IS A PLAYER POSITION AND NOTHING ELSE.** The game camera
  follows the player, so a `centerOn` in an evidence rig is overwritten by the
  follow on the very next update — a whole run can be spent photographing a
  camera that never moved. Solve for the player instead, and remember the camera
  CLAMPS at the arena bounds: anything at y=1240 in a 1600px arena lands at
  screen y 920, under the touch controls, whatever you ask for.

- **A PAUSED SCENE FREEZES A CAMERA FLASH FOREVER.** `player-hurt` fires
  `cameras.main.flash(120, 255, 80, 80)`, and `scene.pause()` — which is how
  every screenshot in this project is taken — stops the effect updating. A
  shutter that lands inside one photographs a flat full-screen red wash that
  never decays. It lives on the camera, so walking the display list for it finds
  NOTHING; twelve evidence frames were lost to this twice before it was found.
  Call `cameras.main.resetFX()` before pausing. `_sectorTint` needs the same
  treatment for a different reason: it is re-raised after the room banner, so
  zeroing it once after `loadRoom` does not hold.

- **ENDLESS ROLLS A NEW ROOM MODIFIER ON EVERY ROOM LOAD.** `rng.waves.pick`,
  in `loadRoom`. So two consecutive loads of the SAME room for an A/B come back
  with different modifiers — one pair here was DARKNESS against FRENZY, which is
  a different enemy speed and a different ambient wash in a comparison meant to
  differ only in cover. Null it in both halves of any matched pair.

- **A MATCHED EVIDENCE PAIR NEEDS A CAMERA THAT IS PLACED, NOT FOLLOWED.** The
  game camera lerps at 0.22 and the harness runs at ~20fps: the same rig, run
  twice at the same station, settled 50px north of the player once and 50px
  south the next time — 100px of disagreement between two halves of a pair
  meant to differ only in lighting, and invisible until the scroll value was
  printed. `stopFollow()` then `setScroll` by hand; the world bounds still
  clamp. `shot-detention-lo.mjs` does this and prints the scroll at every
  station. `shot-detention.mjs` does not and has the same weakness. A ROOM
  BANNER IS THE OTHER ONE: `loadRoom` schedules the objective hint on a delay,
  so it can arrive minutes into a run and photograph as a headline across the
  arena. Kill `HUD.banner` at the shutter, with the camera flash and the
  sector tint.
