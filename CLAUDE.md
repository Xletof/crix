# CRIX / FRIX

Mobile-first twin-stick top-down arena shooter in an Imperial setting: endless
sectors of composed enemy waves across four authored arenas, a Vader boss ladder,
a Shock Captain Champion, nemesis mini-bosses, an upgrade draft and touch
controls. Vanilla JS ES modules, Phaser 3.90, Vite 5. No TypeScript, no unit-test
framework, no sprite image assets.

## Map

- `src/scenes/GameScene.js` — game loop, spawning, collisions, room loading. Very
  large: grep for the method, don't read it whole.
- `src/entities/` — `Player`, `Enemy` (every ordinary archetype), `Boss` (Vader),
  `ShockCaptain`, `Bullet`.
- `src/systems/` — `CameraDirector`, `MoveScript` + `Telegraph` (scripted moves),
  `FX`, `HUD`, `EnvLight`, `NavGrid`, `pixelArt` (all sprites are painted in code
  via `PixelCanvas` / `SpriteSheet`, palette `PAL`), opt-in AI seams
  (`bulwark*`, `marksman*`, `firingSpot`), `debug.js` (URL flags).
- `src/data/` — registries: `rooms`, `encounters`, `bossMoves`, `upgrades`,
  `consoleKit`, `nemesis*`. `src/config.js` holds every tuning value.
- `tests/` — standalone Playwright scripts against the dev server.
- `docs/engineering/` — per-subsystem invariants and hard-won traps
  (index: `docs/engineering/README.md`). Path-scoped rules in `.claude/rules/`
  load a short summary automatically when you open matching files.
- `HANDOVER.md` — project state and full history (~600 KB: grep for sections).
  `docs/evidence/` — per-phase measurements, films and candidate notes.

## Commands

- `npm run dev` — Vite on :5173; every test needs it running.
- `node tests/<suite>.mjs` — one suite. `npm run smoke [-- --only a,b]` — the
  sequential full suite (52 suites, slow).
- `npm run build` — production build check.

## Current state

`HANDOVER.md` §0 is the single source of truth for status: read its CURRENT
STATUS block and UNRESOLVED-WORK REGISTER before gameplay work or when asked
where things stand. Don't copy status into other files. Trust `git` over any
branch name or hash written in a document.

With no concrete task, orient from those two parts of §0, summarize, and stop.
With an explicit human task, read only what that task touches and do it; the
gates below still apply.

## Human gates

- The human plays the GitHub Pages build on a phone. A human handset verdict is
  the only thing that approves a gameplay or visual system, and approval freezes
  it. Passing tests, metrics and screenshots never approve anything.
- Frozen as of 2026-11-02 (§0 wins if this list drifts): Vader, the camera,
  all four arenas, encounter composition, Champion placement and VANGUARD
  rules, the Shock Captain, roster visuals, movement v2.2 and gait v2, Bulwark
  field and Demolisher, Bulwark stuck-B, Marksman T1, free-Bulwark T2. Reopen a
  frozen system's behaviour or tuning only on an explicit human instruction
  naming it. Notes about a frozen system explain it; they don't invite changes
  to it.
- Opt-in is not default. `?roster=v1`, `?gait=v2`, `?move=v22`,
  `?bulwarkStuck=early`, `?marksmanAngle=1` and `?bulwarkAngle=1` are approved
  but opt-in; `?marksmanStuck=*` is not approved. Making any flag the default
  is its own human decision.
- `src/entities/Enemy.js` is frozen (guarded by `tests/enemy-frozen.mjs`). New
  enemy behaviour goes in a seam module installed from `GameScene.spawnEnemyAt`,
  with flag-off behaviour proven identical to the previous build.
- A task the human gives you authorizes its own scope: complete it end to end
  without asking permission for routine decisions. Stop and ask only when the
  next step would change a frozen system, flip a default, or settle a design
  question that belongs to the human.

## Working with the human

- Put all open questions in one `AskUserQuestion`. If it goes unanswered, don't
  re-ask or redo the investigation; say what you're waiting on and end the turn.
  A bare "continue" is not an answer to a pending question.
- Work as a single agent; spawn subagents only when asked.
- Report results exactly: give pass counts and failing suites, and never call
  the suite green when it isn't.

## Git and deploy

- Work on the session's branch, one logical change per commit, and push at every
  checkpoint — containers get rolled back and only pushed work survives.
- Pages deploys only from `FRIX` (`.github/workflows/deploy.yml`). Once a
  finished change is pushed, fast-forward `FRIX` to it in the same turn and
  confirm the workflow succeeded: the human can't test anything else. If
  `git merge-base --is-ancestor origin/FRIX HEAD` fails, stop and ask. Never
  force-push `FRIX`.

## Validation

- Run the suites that cover what you changed (`tests/README.md` maps suites to
  systems); run the full suite when closing a phase. Visual work also needs
  screenshots you have actually looked at.
- The headless harness runs at 6–20 fps and is load-sensitive. A failure under a
  full run is not a regression until it fails standalone and not on the previous
  build. A/B new checks against the previous build: a check that passes on the
  bug proves nothing. `docs/engineering/testing.md` has the rest.
- Restart the dev server after changing `src/` mid-session (HMR can serve a
  module twice), and don't edit `src/` while browser runs are live.
- Gameplay randomness is shared: AI cooldowns draw from `Math.random`, so any
  added or removed particle, overlay or draw changes the fight. Seeded replays
  must match tick for tick.

## Background processes

- Own each job by PID (`cmd > log 2>&1 & PID=$!`; check with `kill -0 $PID`).
  Never find your own job with `pgrep -f` / `pkill -f`: they match the shell
  that asks.
- A tool timeout means the observer stopped, not the job. Check the PID and log
  before relaunching anything. One job, at most one waiter.
- Clean up what you started when it finishes or is abandoned. The Vite dev server
  is the normal survivor; say so when you leave it running.

## Invariants that apply everywhere

- One author per value. `CameraDirector` owns camera scroll (never `startFollow`,
  `setFollowOffset`, `cameras.main.setBounds`); a running `MoveScript` owns its
  actor (`_performing`); Vader's weapon block owns the saber.
- Projectile hitboxes come from texture width (`Bullet.fire`), and speeds above
  620px/s stretch them: keep projectile canvas sizes fixed.
- Incoming fire spans four pools; iterate `GameScene.hostileBullets`.
- A hit on a boss emits `boss-hit` and then `enemy-hit`. Damage text goes through
  pooled `fx.damageNumber(...)`, never `scene.add.text`.
- Upgrade `apply` can run more than once: write effects as magnitudes of `s`,
  never compounding multipliers. Set absolute scales, never relative ones.
- Touch control geometry comes from `controlLayout.js` (player-customisable),
  not `HUDCFG`; the game camera sits 84px below the HUD top bar.
- Snapshot a Phaser group with `.slice()` before destroying its children in a
  loop.
- `spawnEnemyAt(type, x, y)` takes the type first. `_castBossMove` ids are
  lowercase and refusals are silent. Tests that spawn a boss or nemesis need
  `?nodlg=1`.

## Conventions

- Prefer data in registries (`WEAPONS`, `UPGRADES`, `MODIFIERS`, `ENEMY`, rooms,
  encounters) over branching in scene code.
- Environment art spends no red (red means danger) and no small green points in
  the dark (green is enemy fire).
- Record new knowledge where it belongs: state in `HANDOVER.md` §0, subsystem
  traps in `docs/engineering/`, harness behaviour in `tests/README.md`. Keep this
  file short; add a rule here only if it applies to almost every session.
