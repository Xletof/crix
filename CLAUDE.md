# Frix — project notes for Claude

**New session?** `HANDOVER.md` is the map — what the game is, how it is laid out,
what is dead code, and what is in flight. This file is the rules and the traps.
`tests/README.md` covers the test harness and the ways it will lie to you.

## Interaction rules (read first)

**Never re-ask a question that has already been asked and left unanswered.**
If an `AskUserQuestion` call is interrupted, cancelled, or goes unanswered, do
**not** re-issue it. Do not re-run the exploration that led to it either. Stop,
state in one line that you're waiting on an answer, and end the turn. The user may
be away; repeated retries burn their usage limit for zero progress.

**Treat a bare "Continue from where you left off" as a no-op when the only pending
work is a question.** It is often an automated resume, not a human answer. If the
next step needs a user decision, say so briefly and stop. Never interpret it as
approval, and never let it trigger a retry loop.

**Batch questions.** Put every open question into a single `AskUserQuestion` call
(up to 4). Never trickle them out one at a time across turns.

**Don't repeat work already done in the session.** Before exploring, check whether
the finding is already established earlier in the conversation.

## Repo facts that are easy to get wrong

- **Deploys only happen from the `FRIX` branch.** `.github/workflows/deploy.yml`
  triggers on pushes to `FRIX` only. Work lands on the dev branch
  (`claude/mobile-run-game-design-OZLYF`); GitHub Pages will serve a **stale build**
  until `FRIX` is fast-forwarded.
- **Always deploy — don't ask.** The user tests on a phone against GitHub Pages,
  so a dev-branch push they can't play is not a finished task. Fast-forward `FRIX`
  in the same turn as the commit, then confirm the workflow went green. This
  reverses an earlier "always ask first" rule that made every batch end in a wait.
  The one exception: if the push is **not** a fast-forward
  (`git merge-base --is-ancestor origin/FRIX HEAD` fails), stop and ask. Never
  force-push `FRIX`.
- **Bullet hitboxes come from texture width.** `Bullet.fire()` calls
  `setCircle(this.width / 2)`, so changing a projectile texture's dimensions silently
  changes its collision size. Keep canvas dimensions fixed when redrawing projectiles,
  and assert `body.radius` parity in tests.
- **Super pellets are `piercing`**, so anything gated behind `if (!b.piercing)` never
  runs for them (this hid the super's impact explosion for a long time).
- **The super is hardcoded.** `superPellets` / `superDamage` are flat `PLAYER` config
  constants feeding a single `tryFireSuper → player-fire-super → firePlayerSuper` path.
  There is no super-*type* concept; adding alternative supers requires a registry.
- **Touch-control geometry comes from `controlLayout.js`, not `HUDCFG`.** The
  `HUDCFG.joystick*` constants are only the defaults the store seeds from; the
  player can move and resize every control at Pause → CONTROLS. A widget's
  `scale` multiplies its hit radius and drag throw as well as its sprite, so any
  code that writes a bare `image.setScale(1)` or tweens `scale: 1` on a touch
  widget quietly resets a customised button to 100%.
- **The game camera is inset below the HUD top bar** by `HUDCFG.topBarHeight` (84px)
  via `setViewport`. Any screen-space overlay maths must account for that offset —
  see `HUD._drawThreatChevrons`.
- **Two depth conventions run at once.** Actors Y-sort (`setDepth(this.y)`), walls
  and cover sort at `y + 56` — a band spanning ~150-1656 in a 1600px arena.
  Everything else uses flat constants (bullets 26, grenade 22, particles 0), which
  puts it permanently *under* that whole band. `DEPTH.AIR` (2000) is for things
  flying over the room, and anything in it must add its **ground y** (where the
  shadow is), never its rendered y — otherwise draw order drifts as it climbs.
  Ordinary bullets and shared emitters are still on the flat constants; that is a
  known open issue, not something to fix in passing.
- **A flying object's `y` is not where it is.** Anything airborne renders at
  `groundY - altitude`. Distance, curvature and collision maths against `.y`
  silently fold in the altitude — a munition directly above an enemy measures as
  560px away. Cluster fragments publish `b.groundY` every frame for this reason.
  This has caused a real bug and two bad tests.
- **`meleeBus` is reserved for the Riven melee.** It is ~+6dB, exempt from
  ducking, and has no echo send. Do not route new sounds to it; use `sfxBus`.
- **On a phone, spectrum beats gain.** Handset speakers have almost no output
  below ~400Hz, so a sound whose energy sits there cannot be fixed by turning it
  up — the saber hum was inaudible on mobile for exactly this reason. Measure the
  bands (`tests/smoke-hum.mjs`) before reaching for the volume.
- **Recoil/kick timers carry their own duration.** `recoilT`/`recoilDur`/`recoilMag`
  and `_wKickT`/`_wKickDur`/`_wKickMag`. Never reintroduce a hardcoded divisor; that
  bug made the super shrink the player instead of popping it.

## Testing

**Read `docs/POST-MORTEM-vader-moves.md` before adding a boss or enemy attack.** A release
shipped with 17 passing checks and was rejected on sight. Three rules came out of it:

- **Never verify a new behaviour with the system it shares an actor with switched off.**
  Every boss test opened with `b.cooldown = 1e9`, which is exactly what stops Vader's old
  state machine — so the harness could not see the two systems fighting over his velocity
  every frame. Silence a clock to stabilise a measurement if you must, then run one pass
  with nothing silenced and assert the fight is still coherent.
- **Effects are not readability.** "The player was dragged 60px" cannot fail when the move is
  unannounced. Assert the reading: a zone exists before damage, one zone per attack, the body
  visibly winds up, and a telegraph's origin tracks the actor that will hit you (they freeze
  at spawn — Vader walked 163px out of his own lane).
- **A placeholder is not a deliverable.** `Telegraph.js` draws a circle and a rectangle; that
  is the whole visual vocabulary. Shipping it while calling the moves finished is what
  "very bad quality effects, too simple blue circle or red rectangle" means.

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

## Conventions

- Vanilla JS ES modules, Phaser 3.90 + Vite. No TypeScript.
- Pixel art is generated programmatically in `src/systems/pixelArt.js` via
  `PixelCanvas` / `SpriteSheet`; palette lives in `PAL`. No image assets for sprites.
- Config-driven design: prefer adding data to registries (`WEAPONS`, `UPGRADES`,
  `MODIFIERS`, `ENEMY`) over branching in scene code.
- Staged commits: one logical change per commit, built and smoke-tested before commit.
