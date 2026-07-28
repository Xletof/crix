# Frix — project notes for Claude

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
- **The game camera is inset below the HUD top bar** by `HUDCFG.topBarHeight` (84px)
  via `setViewport`. Any screen-space overlay maths must account for that offset —
  see `HUD._drawThreatChevrons`.
- **Recoil/kick timers carry their own duration.** `recoilT`/`recoilDur`/`recoilMag`
  and `_wKickT`/`_wKickDur`/`_wKickMag`. Never reintroduce a hardcoded divisor; that
  bug made the super shrink the player instead of popping it.

## Testing

Headless Playwright against the Vite dev server on `:5173`, Chromium at
`/opt/pw-browsers/chromium`, importing Playwright by absolute path.

- **Headless runs at ~20 FPS**, so Phaser `TimerEvent`s resolve coarsely — a bare
  `delayedCall(70)` measures 150–220ms. Use generous waits; that is a harness
  artifact, not a game bug.
- **Short-lived FX (<150ms) can't be screenshotted reliably** at that frame rate.
  Freeze the clock first: `scene.tweens.timeScale = 0` (and `physics.world.pause()`),
  then capture.
- This project is heavily visual: **verify with screenshots**, not just assertion
  counts. Several past "passing" tests were wrong assertions, not working code.

## Conventions

- Vanilla JS ES modules, Phaser 3.90 + Vite. No TypeScript.
- Pixel art is generated programmatically in `src/systems/pixelArt.js` via
  `PixelCanvas` / `SpriteSheet`; palette lives in `PAL`. No image assets for sprites.
- Config-driven design: prefer adding data to registries (`WEAPONS`, `UPGRADES`,
  `MODIFIERS`, `ENEMY`) over branching in scene code.
- Staged commits: one logical change per commit, built and smoke-tested before commit.
