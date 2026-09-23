# Frix — project notes for Claude

**New session?** `HANDOVER.md` is the map — what the game is, how it is laid out,
what is dead code, and what is in flight. **Its `§0. WHERE THINGS STAND` is the
current state of play and is the first thing you read.** Do not restate §0's
contents here: this line said "the topology pass is stopped for handset review"
for exactly as long as it took the next pass to land, and a summary that can go
stale is worse than a pointer. §0 is the single place the state lives.
This file is the rules and the traps.
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

**SINGLE AGENT. Do not spawn subagents** unless the human asks for one in the
session. Every pass in this project has been one agent start to finish, and the
cost of a cold subagent re-deriving this file is higher than the work it saves.

**HUMAN HANDSET APPROVAL IS THE ONLY THING THAT CLOSES A VISUAL SYSTEM, AND IT
FREEZES IT.** A green suite does not, and neither does a good screenshot — four
of the five things the human rejected across the environment pilot had a fully
passing suite behind them. Once a system is approved on the phone it is FROZEN:
the notes about it in this file describe how it works and how it breaks, and
none of them is an invitation to tune it. Nothing frozen reopens without NEW
human play evidence.

## VADER IS FROZEN 🔒

**Handset review closed him out on `83dee24`.** The ladder, hp, damage, the move
composition, DEFLECTION, the returned super, SUPPRESSION, VANISH, LIGHTS OUT's
cadence and state ownership, the dark-arena material state, Afterimages/ECLIPSE
and the saber emissive treatment are all human-approved and **not open**. The
traps below describe how they work and how they break; none of them is an
invitation to tune. FORCE PULL + DEFLECTION is a deliberate combination — do not
add an exclusion rule. Do not re-derive his hp from bot fight duration.

The one thing knowingly unfinished is the arena's emissive second state:
`LIGHTSOUT.consoleGlowAlpha` is a placeholder and the real emergency-power
composition belongs to the map/environment overhaul (`HANDOVER.md` 10m). Do not
reopen Vader to chase it.

**455 IS THE RETURNED SUPER'S DAMAGE. 620 IS ONLY THE CEILING.** The runtime is
`min(superReturnBase 180 + superReturnPerPellet 55 × pellets, 620)` and the game
fires five pellets: 180 + 275 = **455**. The ceiling does not bind until eight.
Reading `superReturnDamageMax` and calling it the damage has already produced
one wrong report; `smoke-vader` now derives the delivered number from config and
asserts separately that the ceiling is not reached.

## Repo facts that are easy to get wrong

- **Deploys only happen from the `FRIX` branch.** `.github/workflows/deploy.yml`
  triggers on pushes to `FRIX` only. Work lands on the dev branch
  (`claude/death-star-visual-pilot-olbbqx`); GitHub Pages will serve a **stale build**
  until `FRIX` is fast-forwarded. If a session ever finds this name stale again,
  trust `git rev-parse --abbrev-ref HEAD` over this line and fix the line.
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
- **A HIT ON A BOSS FIRES TWO DAMAGE EVENTS.** `Boss.damage` (`Boss.js:97`) emits
  `boss-hit` and then calls `super.damage` — which is `Enemy.damage`, which emits
  `enemy-hit` (`Enemy.js:216`). So anything that draws, counts or scores per-hit
  feedback runs **twice** on a boss and once on everything else. This shipped: every
  hit on Vader printed its damage number twice, in two colours at two sizes, and it
  survived a whole readability pass because both halves looked plausible on their
  own. The lethal blow is the one exception — the wound intercept returns before
  `super.damage`, so only `boss-hit` fires there.
- **Combat text is pooled and hard-capped.** Never `scene.add.text` for a damage
  number; call `fx.damageNumber(x, y, amount, color, tier)`. `DMG_POOL` (26, in
  `FX.js`) is the clutter bound, and it is deliberately independent of hit rate —
  it is the only limit a faster weapon or a longer combo cannot defeat. Two
  consequences: a retired label **stays in the display list** with its old string
  set, so anything counting labels must filter on `visible`; and the last argument
  is a TIER (`'minor'` ordinary, `'major'` crits and supers), not a boolean. `true`
  is legacy for `'major'` and is exactly how ordinary boss damage sat on the crit
  tier without anyone noticing.
- **A nemesis bomber must never run the stock contact path.** `EnemyBomber._detonate()`
  sets `hp = 0` and calls `die()`; on a nemesis that throws away 6× hp, traits,
  regalia, a name and a ledger grudge on first touch. `_tickSwarm` branches to
  `_contactBurst` for `_miniBoss`. `smoke-duel` gates it.
- **A move that schedules its own links needs an `h.over` flag**, set at the impact
  beat. Timers resolve coarsely on a slow frame, so a chain link can *start* after
  RECOVER has already run — TRIPLE DASH finished combos in a wind-up pose that way.
  A generous `actMs` is a race, not a fix. Likewise, `onEnd` on a chain's last link
  fires after RECOVER: never set a pose there unconditionally.
- **A move's second zone needs `anchor: 'world'`** when it marks a place rather than
  a body, or it drifts with the caster's recoil and stops being a promise.
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
- **NOTHING MAY CALL `startFollow`, `setFollowOffset` OR `cameras.main.setBounds`
  ANY MORE.** `CameraDirector` (`src/systems/CameraDirector.js`) owns the scroll
  and drives it from `POST_UPDATE`; a follow target reinstated anywhere is a
  second author for the same two numbers, and `smoke-camera` fails on one. Every
  tuning value is `CAMERA` in `config.js`. **CAMERA BOUNDS ARE NOT COLLISION
  BOUNDS** — the director frames past the room's edge, and that framing freedom
  is the only thing keeping a player at the southern wall out from under the
  touch controls. `physics.world.setBounds` is still exactly the room and must
  stay that way.

  **THE WHOLE CAMERA IS HUMAN-APPROVED AND FROZEN 🔒 — DEVELOPMENT IS CLOSED.**
  Six passes, all closed on handset play: 1, 2A, 2B, 2C (the player-intent
  camera) and 3A.1 + 3A.2 (the two Vader terms). **`HANDOVER.md` §21 is the
  authoritative final state** — the semantic model, the complete frozen tuning
  and what may reopen it; §12-§20 are how each pass got there and are history.
  Every value in `CAMERA` is a handset verdict — the notes below describe how
  the camera works and how it breaks, and **none of them is an invitation to
  tune it.** `CAMERA.zoomBreathe` is 0: fixed zoom, through all six passes.

  **THE SEMANTIC MODEL, AND THE ONE DISTINCTION THAT MUST NOT BE MERGED:**
  movement is where my body is going; ordinary combat is where the fight is;
  an explicit ability is where I am deliberately committing next; the passive
  gaze is WHO the encounter is about when it is quiet; and the guardrail
  PRESERVES the player-Vader relationship when the composition would otherwise
  lose him. **GAZE IS PRESENCE, GUARDRAIL IS PRESERVATION** — two terms, two
  filters, two caps, two sets of gates. Merging them, in code or in prose, is
  the single change that would undo this system.

  **PHASE 3B IS NOT STARTED AND IS NOT JUSTIFIED.** The long approved Vader
  fight showed no framing failure for FORCE PULL, SABER THROW, CHARGE, SLAM,
  DEFLECTION or attack-aware zoom. Do not start attack-specific camera work
  speculatively; it reopens only from NEW human gameplay evidence of an actual
  framing failure.
- **VADER IS AN INTEREST SIGNAL, NOT THE OWNER OF THE CAMERA, AND THE
  GUARDRAIL SOLVES COMPOSITION NEED RATHER THAN THE RELATIONSHIP.** There is no
  midpoint and no distance term driving its strength — those are lock-on
  cameras with a bound on them, and Phase 2C refused that shape for ordinary
  enemies. (A direction-to-Vader lead exists in exactly ONE place, the Phase
  3A.2 passive gaze below, which is small, quiet-gated and yields to this.) `CameraDirector._solveBoss` asks ONE question: given the
  frame the approved player camera is about to compose, where does Vader land
  in it? Inside the comfort inset (`bossMarginX/Y`) he contributes EXACTLY
  ZERO, however close, however dangerous and whatever he is winding up; only
  the OVERFLOW past that inset is bought back, and only along the axis that
  overflowed. **If he is already visible, the camera is left alone** — that is
  the difference between a guardrail and a tether, and `smoke-camera` asserts
  it next to "a Vader at the edge must open the frame", because the silence
  claim alone passes on a layer that has been deleted.
- **THE BOSS NEED IS MEASURED AGAINST THE PLAYER-INTENT FOCUS, NOT THE ACHIEVED
  FRAME, AND THAT IS THE ANTI-OSCILLATION GUARANTEE.** The focus it measures
  against is a pure function of the player's own state, so the boss term is
  never an input to its own strength: pulling the frame east cannot reduce the
  need that asked for it and there is no loop to hunt. A version measuring
  Vader against the real scroll would breathe at the spring's own frequency for
  the whole fight. Do not "improve" it by reading `cam.scrollX`.
- **THE 3A.1 LAW ANSWERS THE DEFICIT, NOT A RAMP POSITION — AND THAT WAS THE
  WHOLE COMPLAINT.** 3A was `clamp(overflow / 240, ±1) × 120`: it STOPPED
  RESPONDING past 240px of overflow, so a Vader 250px out and one 1000px out
  got the identical 120px reply against a 220px movement lead. Measured on the
  real geometry, standing at a 300px separation bought **15px** of frame and
  running away left him **40px offscreen** — handset verdict, "too weak".
  `_band` now answers a bounded fraction of the ACTUAL deficit through a
  `tanh`, from TWO boundaries: a gentle one (`bossMarginX/Y`) that starts early
  so he has weight before he is nearly lost, and a guard one
  (`bossGuardMargin`) near the frame edge where he is genuinely going. **A
  BIGGER CAP ALONE WOULD NOT HAVE FIXED IT** — the old law could never reach a
  bigger cap.
- **`bossPreserve` IS WHAT KEEPS IT A GUARDRAIL RATHER THAN A LOCK, AND IT
  BOUNDS THE WHOLE LAYER.** `tanh` means the correction can never exceed
  `bossPreserve × deficit`, so at 0.5 the layer can never close more than half
  the gap however large the budget is — elastic by construction, and it can
  never pin Vader to a screen coordinate. Two consequences for rigs: an
  "absurd lead" probe must raise `bossPreserve` too, because raising the cap
  alone moves the answer by a few pixels and the probe silently fails to
  engage; and `tanh` is ODD, so one expression serves both frame edges and they
  cannot drift apart.
- **THE EXTERNAL SIGNAL MAY NOW OUT-WEIGH LOCOMOTION, BUT NEVER AN EXPLICIT
  ABILITY.** 3A pinned `bossLeadMax` below the movement lead on the theory that
  it must always be the smallest voice; the handset rejected exactly that, so
  `smoke-camera` no longer asserts it. What survives is the line that was
  always the real one: `bossLeadMax` (240) ≤ `abilityLeadX` (260), and
  `bossAbilityKeep: 0` suppresses him outright while a Super or melee is armed
  — aiming away from Vader is a decision and the camera may not overrule it.
  `bossAttackMs` (240) is still the slowest acquisition in the composition.
  **`bossLeadX` is the handset dial.**
- **THE DEADZONE ATE THE QUIET GUARDRAIL, AND THAT IS WHY 3A.1 READ AS FREE
  TRAVERSAL WHEN NOTHING WAS HAPPENING.** Standing at a 300px separation the
  guardrail asks for 42px — and `dzX` is 60, so the target does not move by a
  single pixel and the resting frame is EXACTLY centred. Measured: player screen
  x 360.0 on 3A.1. The correction was real and entirely invisible. This is the
  same family as the movement lead's `leadX - dzX - lag`: **any boss term below
  `dzX` lands on screen as nothing at all.** Phase 3A.2's passive gaze is what
  carries the quiet total past that threshold (82px at 300 separation, of which
  22 lands), and it is why the perceptible boundary sits near 270px of
  separation rather than wherever the law's own ramp starts.
- **THE PASSIVE GAZE IS A SECOND, SEPARATE BOSS TERM — presence, not
  preservation.** `_bgX/_bgY`, its own filter (520/700, the calmest in the
  file), its own cap (`bossGazeX` 70 / `bossGazeY` 45), added alongside the
  guardrail and never folded into its budget. It is **the one place a
  direction-to-Vader lead is allowed**, and only because four gates can each
  switch it off: SEPARATION (`bossGazeNear` 120 — a Vader already composed with
  the player needs none), QUIET (`bossGazeAimKeep` 0.25 under sustained fire,
  and `1 - _abW` removes it outright under an armed ability), YIELD
  (`1 - _bsW`, so as the approved guardrail engages this stands down and the
  two can never stack), and the same far-distance fade. Measured, that yield is
  what keeps 3A.1 intact: walking away from a Vader 300px east is 167px of
  guardrail and 15px of gaze. **`bossGazeX` is the handset dial for this half.**
- **MORE SCROLL REVERSALS IN A LIVE FIGHT IS NOT OSCILLATION.** 3A.1 roughly
  doubles them (5 → 9-17 measured), and that is the frame tracking a boss who
  is walking around — which the quieter 3A layer could not do. The question a
  live-fight reversal count cannot answer is whether the guardrail RINGS, so
  pin both bodies and sample after settling: measured, zero scroll reversals,
  zero lead reversals and 0.00-0.01px of spread. `diag-camera-boss` station N.
- **ONLY `scene.boss` IS VADER.** The layer reads that one reference and
  nothing else — no enemy list, no distance search, no move ids, no phase, no
  hp, not the thrown saber, the caught super or the returned orb. Afterimages
  are ordinary `Enemy` clones and minions are enemies, so "a clone must not tug
  the camera" holds by CONSTRUCTION rather than by an exclusion list that could
  drift. A Phase 3B, if the handset ever asks for one, is a weight inside
  `_solveBoss` and not a second author anywhere else.
- **A MOVE OWNS THE MOMENT ITS ACTOR'S POSITION STOPS BEING THE TRUTH, AND
  VANISH IS THREE INTERVALS, NOT ONE.** He winds up VISIBLY on his real spot
  for `departMs` (260); then the shear finishes and the sprite left behind is a
  place he is not; then ACT puts him down somewhere else. The move publishes
  the boundary as `handle.bodyAuthoritative` — false when the departure timer
  fires, true again on the frame he commits — on its OWN cancellable clock, so
  an interrupted VANISH takes the claim down with it. `_bossFramable` reads
  that; ABSENT MEANS AUTHORITATIVE, so no other move needs to know the field
  exists, and there is no VANISH millisecond anywhere in `CameraDirector`.
  `departMs` drives the fade too, so the visual and the semantic cannot drift.
  **A WHOLE-MOVE FLAG IS THE WRONG SHAPE and was the first attempt**: a
  `teleports: true` gate suppressed all 620ms, including the ~250ms in which he
  is simply a boss winding up in plain sight, which is suppressing ordinary
  awareness of an ordinary attack because of something that has not happened
  yet. That flag is GONE rather than left unread — an unread flag that the
  notes describe as the gate is worse than none.
- **SPRITE ALPHA IS NOT AN AUTHORITY ON WHETHER VADER IS THERE.**
  `Boss.preUpdate` writes `setAlpha(1)` every frame unconditionally, so once
  `vanish()`'s 260ms tween completes the sprite is restored to FULLY OPAQUE on
  the spot he has left, for the last ~300ms of the wind-up. Measured. Alpha
  says he is back when he is not. That restoration is existing approved Vader
  behaviour and is not the camera's business to fix — read the move's claim and
  step around it.
- **A CANCELLED MOVE IS NOT A CLAIM.** `MoveScript.cancel()` does NOT clear
  `actor._activeMove` (only the `done` path does), so a handle carrying
  `bodyAuthoritative: false` would otherwise survive an interrupted VANISH and
  leave the boss unframable for the rest of the room. `_bossFramable` ignores a
  handle that is `cancelled` or `done`.
- **TESTING VANISH BY PHASE ALONE COLLECTS THE NEXT MOVE'S WIND-UP** and reports
  the gate as broken — filter samples by `_activeMove.move.id`. And a SAMPLE
  COUNT is a frame-rate reading: the 620ms wind-up measured 3.8 SECONDS on a
  cold container and four frames on a warm one, so classify by `phase` and
  `bodyAuthoritative`, never by elapsed ms or by how many frames an interval
  got. Likewise a px-per-frame "no pop" threshold is really a frame-rate meter —
  bound the boss lead's per-frame change by its own filter,
  `bossLeadMax * (1 - exp(-dt / bossAttackMs))`.
- **THE SOUTH FRAMING PADDING IS DERIVED AND THE ROOM HEIGHT CANCELS OUT.**
  `padSouth = viewH - PLAYER.radius - (safeBottom - southClearance)` = 372 on
  the default layout, and `safeBottom` is read from the LIVE control layout
  (`controlLayout.js`), never from `HUDCFG` — a player who drags their buttons
  upward needs more framing freedom, and that read is the only place that can
  know it. Do not replace it with a literal, and do not make it per-room: a room
  may override padding as DATA (`spec.camera`) and none of the four does.
- **X AND Y ARE NOT THE SAME CAMERA, AND THE ASYMMETRY IS THE PHASE 2A RESULT.**
  The handset approved Phase 1's vertical feel and rejected its lateral one, so
  2A tightened `dzX` (120 -> 60, now tighter than either vertical half),
  stiffened X alone (`stiffnessX` 19.5 against `stiffnessY` 13.5) and spent the
  whole lookahead budget on X. **Never answer "lateral movement lags" by raising
  both** — that is "make the camera faster" and costs the stability that was
  approved. `smoke-camera` pins `stiffnessY` at 13.5 and requires
  `stiffnessX > stiffnessY` and `dzX < dzDown`.
- **THE MOVEMENT LEAD IS INTENT, NOT VELOCITY, AND `leadX` IS NOT WHAT LANDS ON
  SCREEN.** `Player.preUpdate` eases velocity toward `_moveTarget*` over an
  acceleration ramp, so leading off velocity adds that ramp's delay to the lag
  the lead exists to remove; `_moveTarget*` is the stick's own request and is
  current on the frame the thumb moves. And during sustained travel the lead
  pays for the DEADZONE (the target rides its trailing edge, so `dzX` is
  permanently spent in the direction of travel) and for the SPRING LAG
  (`v*(2/w + h)`, which pushes the player the other way) before one pixel of it
  is visible: the shift is `leadX - dzX - lag`. `leadX: 130` measured no better
  than standing still. It is 220 and about 115px of it lands.
- **`CAMERA.leadY` IS 0 BY CONSTRUCTION, NOT BY OVERSIGHT.** A northward lead
  pushes the player DOWN the screen, and at the southern wall the framing clamp
  is the only thing holding them clear of the touch controls — 45px of it lands
  them at screen y 931 against a control edge at 926, which is the Phase 1 win
  thrown away. Zero means the south guarantee cannot be eroded by a vertical
  MOVEMENT tuning value at all. `smoke-camera` re-runs the south acceptance case
  in all four arenas with the lead pinned hard east and hard west.
- **THE SAFE AREA IS GUARDED ON THE FINAL TARGET, NOT ONE INPUT AT A TIME.**
  `_clampSafeArea` (Phase 2B) refuses any composition that would put the PLAYER
  below the safe area, whatever asked for it — which is what makes ability
  intent's vertical lead safe where the movement lead's had to be zero. It is
  only a FLOOR on the target, never a lift: a lift would be re-centring the
  player, which the deadzone exists to avoid. `_clampTarget` (the framing rect)
  still runs after it and still wins, and at a southern wall the two agree by
  construction because `padSouth` is derived from the same number. **A CHECK FOR
  IT AT A SOUTHERN WALL IS DECORATION** — the framing clamp pins the player
  there anyway and the check passes with the guard deleted. Test it in open
  floor in the room's southern half.
- **ABILITY INTENT OUTRANKS MOVEMENT, AND IT READS THE TELEGRAPH'S OWN VECTOR.**
  `CameraDirector._solveAbility` consults `superAim`/`superAiming` and
  `meleeAim`/`meleeAiming` — exactly what `_drawAimCone` and
  `_drawMeleeTelegraph` consult — so the camera cannot disagree with the preview
  the player is looking at. It is a CROSSFADE, not an average: moving west while
  aiming east must frame EAST, and blending the two produces a neutral frame
  that says nothing about either. **BOTH RELEASE PATHS CLEAR THEIR OWN PREVIEW
  FLAG BEFORE THE CAST** (`releaseSuperAim` before `tryFireSuper`,
  `releaseMeleeAim` before `tryMeleeCombo`), so the committed direction is
  snapshotted from the `player-fire-super` / `player-melee-cast` events —
  without that the camera forgets the direction on the exact frame the body
  starts travelling along it.
- **ORDINARY FIRE TELLS THE CAMERA WHERE THE FIGHT IS — NEVER WHERE THE NEAREST
  ENEMY IS.** Ordinary shots AUTO-AIM, so the resolved bearing can jump east ->
  northwest -> southeast between consecutive taps; chasing it is a lock-on camera
  the player never asked for and cannot see coming. `CameraDirector._solveAim`
  consults NO enemy, position, distance or target id — only the direction of
  COMMITTED shots (`player-fire`, `player-fire-rifle`, which mobile and Spacebar
  both reach through `tryFire`, so the input device no longer exists). It keeps a
  recency-weighted vector sum plus its weight total: length/total is CONSISTENCY
  (opposing shots cancel), the total is ACTIVITY. **The contribution is that
  vector, never a normalised direction** — under alternating fire the sum passes
  through zero and a bearing there is arbitrary and spins, which is the exact
  ping-pong the design forbids. The CLUSTER is deliberately excluded: one lobbed
  munition is not sustained ranged fire.
- **AN ACCUMULATOR SETTLES; IT DOES NOT CLIMB — READ THE DIVISOR AGAINST THE REAL
  EVENT RATE.** At the pistol's real cadence (120ms cooldown, 3 rounds, 520ms
  reload — a shot every ~180ms) the weight total settles near 3.4, so
  `aimShotsForFull: 4` capped live confidence at 0.68, and at that operating
  point the movement residue cancelled the combat lead outright: a player
  retreating west while firing east measured a net lead of **-13px**, a
  perfectly neutral frame. It is 3. Never pick such a divisor from the count you
  imagine.
- **ORDINARY FIRE BLENDS WITH MOVEMENT; AN ABILITY REPLACES IT.** `aimMoveKeep`
  is 0.25 where `abilityMoveKeep` is 0, and that difference is deliberate: the
  player is usually dodging while they shoot, and a westward dodge with no camera
  weight has lost its physicality. `leadCombinedMax` (260, matching
  `abilityLeadX`) then holds the line that IMPLICIT signals never out-frame an
  EXPLICIT one.
- **A CANCELLATION CHECK PASSES ON A CAMERA THAT NEVER MOVES.** "Alternating fire
  must not swing the frame" is satisfied by a feature that does nothing at all;
  it is only meaningful asserted alongside "six consistent shots must open the
  view". `smoke-camera` carries both.
- **A HOLD THAT RE-ARMS FROM SOMEONE ELSE'S CLOCK NEEDS A CEILING.** The melee
  ability lead tops itself up while `player._meleeAnimT > 0` so a three-cast
  chain reads as one commitment — but that clock is decremented in
  `Player.preUpdate`, and anything that stops it running leaves it frozen above
  zero and the lead holds the frame for ever. `CAMERA.abilityMeleeMaxMs` bounds
  one cast; each new cast resets it.
- **`CameraDirector.cfg` IS THE LIVE TUNING OBJECT AND EXISTS FOR THE RIGS.** A
  dynamic `import('/src/config.js')` inside `page.evaluate` hands back a second
  module instance the running camera never reads (see the trap below); anything
  that MUTATES tuning at runtime goes through `director.cfg`.
- **A DEADZONE MEANS THE PLAYER DOES NOT RETURN TO CENTRE.** When the lead
  closes, the ideal scroll moves back by the full lead but the target only has
  to be within `dzX` of it, so the player rests up to `dzX` off centre and the
  camera does not spend a pull to fix it. A test asserting a return to centre is
  asserting a camera that re-centres on its own, which is the opposite of what
  was approved.
- **THE DEADZONE'S VERTICAL SIGN INVERTS.** Screen y of the focus is
  `(focus - scroll) * zoom`, so a HIGHER scroll draws the focus HIGHER. The focus
  drifting DOWN — toward the controls — is the target falling BELOW ideal, so
  `dzDown` is the allowance on the LOW side. It is written out in `_solveTarget`
  because it reads like a typo either way round.
- **A DYNAMIC `import('/src/config.js')` INSIDE `page.evaluate` IS NOT THE MODULE
  THE GAME IS HOLDING.** Writing `CAMERA.debug = true` there mutates a second
  copy and the overlay never appears, with no error anywhere. Anything that
  MUTATES config from a rig goes through the game's own entry point (`?camdbg=1`,
  or DEBUG -> CAM DBG). Reading is safe: both copies carry the same authored
  values.
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
- **ONE SYSTEM DRIVES AN ACTOR AT A TIME.** `Boss.preUpdate` and
  `Enemy.preUpdate` write velocity and reselect the animation every frame.
  `MoveScript` sets `actor._performing` for the length of a move and both AIs
  yield on it; `_castBossMove` also refuses while the actor's own state machine
  is mid-attack. Without that gate the two fight over the same body and the
  move's wind-up is overwritten before it can draw. The gate deliberately writes
  NOTHING — a travelling move sets its own velocity and expects it to persist.
- **VANISH leaves a tween writing the weapon sprite after it ends.** `spin()`
  in `actorMotion.js` tweens `weaponSprite.rotation` for `actMs` and keeps
  writing it once the move is over, which is a second author for a number the
  weapon block in `Boss.preUpdate` owns. It cannot currently collide with
  anything — `isGuarding()` stops VANISH starting during a stance or a throw —
  so it is a NOTED LANDMINE and was deliberately left alone. It has already
  cost one debugging round in the harness; `tests/README.md` has the write-up
  and the `killTweensOf` rig fix.
- **Relative scale mutations drift.** `raiseWeapon`/`dropWeapon` used to multiply
  and divide by 1.35, so any unmatched pair compounded — the boss's saber reached
  a ~1100px slab. Always set an ABSOLUTE multiple of a remembered rest scale.
  Same family as the touch-widget `setScale(1)` trap above.
- **A commit flash centred on the caster will delete the caster.** `Telegraph._flash`
  used to paint one flat 0.7-alpha white fill over the whole zone, and most of
  Vader's kit originates at his own feet — so on the frame SABER COMBO landed he
  was a white blob, at exactly the moment the player needs to read the blade. The
  fill now ramps from nearly clear at the origin to full at the rim: same claim
  about the same area, caster still legible. Any new full-zone fill has the same
  trap in it.
- **A circle telegraph's kinetic ring carries DIRECTION, not time.** The fill
  sweeping outward is the clock; the ring says which way the move points
  (`kinetic: 'in' | 'out'`). It defaulted to inward for everyone because the
  first circle move that needed one was a slam, and FORCE PUSH inherited it — so
  a 420px shove *away* from him was announced by a ring travelling *toward* him.
  Purely cosmetic: `contains()` consults none of it. Pass the right one.
- **`kineticMs` should be the move's real travel time, not left at the default.**
  SABER THROW and CHARGE are both crimson lanes out of the same man with the same
  blade; at the stock 620ms scroll the only difference was 20px of width. They are
  now told apart by chevrons running at the blade's flight time and at his run
  time respectively. A new lane move that omits it re-enters that collision.
- **Floor marks are the one FX here that accumulate**, because they outlive the
  effect that spawned them. `fx._keepScar` caps them at 48 (a 900ms CHARGE lays
  one segment per frame at 60fps) and kills the fade tween before evicting.
  Anything drawn into the floor must go through it.
- **A telegraph's shape IS its hit test** (`Telegraph.contains`). Never draw one
  shape and resolve another: FORCE PULL drew a 90-degree cone while dragging the
  player in from every bearing. Zones follow their caster while winding up
  unless passed `anchor: 'world'` — a LANDING marker must be anchored, or it
  trails the actor off the spot he is about to teleport to.
- **A wake sampled from POSITION HISTORY has a frame-rate-dependent length.**
  The returned super's remnants were drawn at every other stored position, which
  is tight at 60fps on a phone and 250px apart in the ~20fps harness — the same
  code reading as one object with momentum on one machine and three separate
  objects on the other. They sit at fixed DISTANCES behind it now (26/52/78px)
  along its real velocity. Anything trailing a fast body wants distance, not
  frames.
- **DEFLECTION IS FROZEN.** The stance, the parries, the caught super, the throw
  and the saber-ownership contract all passed human handset review on `6b98bbc`
  and are closed — `HANDOVER.md` records the locked contract. The traps below
  are how it works and how it breaks, not an invitation to tune it. Nothing in
  it moves without a new handset verdict.
- **The returned super has ONE speed, and it is not its own.**
  `superReturnSpeed` reads `PLAYER.superSpeed` (1080) directly — the claim is
  that this IS the player's captured super handed back at the speed it was
  fired, and a literal would let the two drift apart silently. Constant from
  release to termination. `_tickSuperOrbs` rewrites the velocity every frame
  from a heading stamped once at release (`orb._hx/_hy`) — never re-derived
  from the live velocity and never from the player, because "no homing" has to
  mean no visual homing either. Its lifetime is player hit / wall hit /
  out-of-bounds, with range and an age cap as backstops only.
  **FOUR speed models have been rejected here on a handset, so do not reopen
  it.** A flat 300 and a flat 405 both let the player walk alongside the orb and
  escort it across the room (base walk is 380). The fix for that was an
  overspeed launch shedding to a cruise — first 600 -> 470 over 350ms as
  `(1-u)^3`, which shed two thirds of the excess inside 120ms and read as
  constant speed; then 650 -> 500 over 550ms on a smoothstep, which was
  perceptible and was still rejected, as a CONCEPT rather than a tuning. All of
  the fairness is spent BEFORE launch (the DEFLECTION warning, the visible
  stored energy, 620ms of anticipation, the silhouette, the snapshot aim, no
  homing), so a post-launch falloff only softens a punish the player already had
  every chance to avoid. The human rule, from a full natural fight: **too fast
  to race, fair enough to evade** — one returned super landed and read as the
  player's own mistake, a later one at the same danger was dodged off the tell.
  Solving it after launch is not supposed to be possible. `orb._impulse` and
  `_settleT` are gone; the head's amplitude now rides on `_ageMs` as a purely
  VISUAL launch-freshness driver, and it must stay one.
- **HE THROWS IT, and one clock says so.** This is REQUIRED CAUSAL
  PRESENTATION, not polish: before the sweep existed the orb detached from a
  motionless Vader and acquired velocity, and the handset verdict is that the
  blade authoring the launch is what makes the attack read. The last
  `superSweepMs` (260) of the
  unchanged 620ms anticipation is a dedicated saber power sweep; the orb leaves
  on its power frame; `superFollowMs` (200) of follow-through after that is the
  last of his saber ownership. `superSwingPose(dir, u)` in `Boss.js` is the pure
  curve — `u = 1` is the launch — and `superSwing()` derives the phase from
  `_releaseT` / `_followT`, which cannot disagree because the launch is the
  boundary between them. Two consequences that cost a round each: the release
  clock is ticked by `_tickSuperRelease` **before** the weapon block rather than
  inside `_tickMechanics` after it, or the blade is drawn from a one-frame-stale
  phase (measured 90 degrees at 20fps, and the orb leaving before the blade
  arrives); and the sweep branch sits FIRST in the weapon block, so an ordinary
  parry during the throw defers its gesture while still deflecting for real —
  never two saber gestures, never a second blade.
- **A projectile's speed can silently resize its hitbox.** `Bullet.fire` sizes
  the body from the texture and then stretches a tracer by
  `clamp(speed / 620, 1, 2.2)`, and `Body.updateBounds` recomputes width from
  `|scaleX|`. Under 620px/s the clamp is exactly 1 and nothing moves; above it,
  raising a speed widens the body. The caught super's 1080 is 1.74x OVER that
  line, so the `boss-super-return` handler cancels the stretch with an explicit
  `setScale(1, 1)` — assert `scaleX === 1` and `radius * 2 === texW` when
  touching it, and sample it IN FLIGHT: a wrapper around `fire()` photographs
  the stretch before the next line undoes it, which is a value no physics step
  ever sees.
- **Incoming fire lives in THREE pools now.** `enemyBullets` (green),
  `deflectedBullets` (the player's own red bolt, turned by Vader's DEFLECTION)
  and `bossSuperOrbs` (the caught super, handed back as one slow mass).
  Iterate `GameScene.hostileBullets`, never `enemyBullets` alone — six places
  sweep incoming fire and half of them are not collision code (HUD threat
  chevrons, bullet trails, room clear, the debug purge). The split exists
  because `BulletGroup.fire` re-asserts its group's texture on every recycle, so
  a red bolt in the green pool is either re-textured after the fact — which
  silently resizes its hitbox — or leaks red into the next trooper's shot.
- **ONE SABER, ONE EXCLUSIVE CLAIMANT AT A TIME — HUMAN-APPROVED AND FROZEN 🔒.**
  `_saberOwner` is the truth of it, and `_saberAway`
  is only where the SPRITE is. `_saberAway` answers *where is the blade*;
  `_saberOwner` answers *which system holds its exclusive claim*. They are two
  different instants and that gap WAS the bug: SABER THROW commits in its ANTICIPATE beat and does not set
  `_saberAway` until ACT, 700ms later, so for that whole beat an
  "is it in his hand right now" test said yes about a blade that was already
  spoken for. DEFLECTION's tell is 500ms and fits inside it — the guard opened,
  ACT threw the saber out of it, and he parried for the rest of a 2400ms window
  with a weapon 648px away. Measured; `HANDOVER.md` §22. Ownership now transfers
  on COMMIT (`claimSaber`) and returns on PHYSICAL ARRIVAL (`releaseSaber`, which
  restores possession with it, and is idempotent on every exit the flight has).
  `hasSaber()` reads ownership; a move that needs the blade declares
  `needsSaber: true` and `_castBossMove` refuses it — rolling the rotation back,
  so a deferral costs no cadence. FORCE PULL and FORCE PUSH declare nothing,
  which is what keeps FORCE PULL + DEFLECTION legal WITHOUT an exclusion rule.
  **Do not add a `if (activeMove === 'saberthrow')` anywhere, and never reduce
  this to pairwise exclusions**: a future move that takes the blade has one thing
  to do, claim it. **DO NOT "SIMPLIFY" THE TRANSFER BACK TO ACT** — that is the
  approved bug. The approved consumers are SABER THROW, SABER COMBO, VANISH SLASH
  and DEFLECTION, and nothing here moves without NEW human play evidence.
  SABER THROW detaches `weaponSprite` and flies it across the room; while
  `_saberAway` is set Vader is physically unarmed. DEFLECTION shipped ignoring
  even that: the reflect clock fired, the guard opened, and he parried bolts with
  a blade that was 500px away and still spinning. The scheduler separates DUE
  from ACTIVE — `_reflectPending` is owed, `_reflectClaimed` is announced and
  reserved, and `Boss.canOpenGuard()` (`hasSaber() && !isGuarding()`) is the one
  gate. The clock still resets at the due moment, so a deferral costs no cadence,
  and the tell goes up on the frame the blade is caught. `claimSaber` /
  `releaseSaber` are idempotent and a non-owner release is a no-op, so a
  cancelled claimant cannot take the blade back off its successor.
- **DEFLECTION is a STANCE that owns Vader's saber.** While `Boss.isGuarding()`
  is true — the reflect window, or a caught super still in his hands — no
  scripted move and no state-machine attack may START (`_castBossMove`,
  `pickAttack` and `shouldVanish` all refuse). Anything already running finishes.
  It suppresses STARTS only, and the cooldown keeps counting down underneath, so
  offense resumes on the frame the stance drops with no dead recovery. Melee is
  deliberately unaffected: the stance is projectile defence, and closing to melee
  is the intended answer to it.
- **A super pellet is CAUGHT, never batted back.** A super pellet carries
  `superDamage * player.dmgMult`, and `dmgMult` reaches four figures late in a
  run, so returning five of them was five simultaneous unavoidable deletions.
  `Boss.absorbSuper()` consumes them; ONE bounded orb comes back from
  `boss-super-return`, sized by a flat pellet schedule that never touches
  `dmgMult`. Anything new that reflects player fire must ask `isSuper` first.
- **Only ONE system may write the saber, and it is the weapon block in
  `Boss.preUpdate`.** Rest pose, guard pose, parry gesture and the held-energy
  orb are all decided there, from scratch, every frame. `parry()` and
  `absorbSuper()` only set flags. A scene-side tween on the weapon sprite's
  position, rotation, flip or depth is not an addition — it is a second author
  for the same four numbers.
- **The parry gesture is a follow-THROUGH, not an alignment.** `PARRY_ARCS` in
  `config.js` is eight bearing families; `parryPose(arc, u)` in `Boss.js` is the
  pure curve, called by `preUpdate` and imported by the test so there is exactly
  one implementation. `u = 0` is CONTACT — blade on the intercept bearing at
  full reach — because the bolt is killed and the reply fired on that same
  frame. Rotating the blade *onto* the incoming bearing (the first
  implementation) is invisible on a phone: his saber already points at the
  player, and the player is where the bolt came from.
- **A collision-time pose lands one frame after its effect.** Collisions resolve
  in scene `update`; `preUpdate` has already drawn the actor for that frame. So
  `Boss.parry()` flags a pose the weapon-sprite block picks up on the NEXT
  frame, while the FX draws immediately. 16ms in the hand and invisible — but a
  full frame in the ~20fps harness, so a screenshot of the first qualifying
  frame photographs the effect with the pose missing and looks like the pose is
  not implemented.
- **A subclass that intercepts `damage()` must test the number the PARENT will
  subtract.** `Enemy.damage` multiplies by `_punishMult` inside a punish window,
  and `Boss.damage`'s wound-instead-of-die intercept tested the raw amount — so a
  hit that was not lethal raw became lethal applied, and Vader DIED in endless,
  which ends the ladder. Latent for as long as both systems have existed; it
  surfaced only when the hp pool moved and changed where hits land relative to
  punish windows.
- **The measuring bot never dies.** `tests/diag-encounter.mjs` sets `lives = 9999`
  and revives the player in-frame so a death cannot cut a measurement short. Its
  dps is an uninterrupted CEILING, so `hp / dps` is not fight length. It is a good
  instrument for RELATIVE comparison and a bad one for any absolute — sizing
  Vader's pool off it shipped a 300,000-hp boss that came back from the phone as
  "cannot even dent it". Absolutes are a playtest.
- **`vanishHpFrac` and anything else written as a FRACTION of `hpMax` moves when
  the pool moves.** Raising Vader's hp 6.5x pushed VANISH's trigger from 4,600
  damage in 2s to 30,000, which nothing produces — the mechanic would have retired
  itself with no test failing. Re-check the fractions on any hp change.
- **THE ENCOUNTER LADDER IS ONE TABLE, AND `bossMovesFor` IS NOT PART OF IT.**
  What each Vader arrives with is `ENDLESS.bossLadder`, resolved by
  `bossMechanicsFor(n)` — one producer, called by `spawnBoss` and by the tests.
  The *move* rotation is identical at every encounter and always was:
  `bossMovesFor` used to filter `minPhase <= phase || encounter >= 3`, and every
  move is `minPhase: 1`, so the encounter clause could never change a result. It
  cost nothing only because nobody looked. Encounter 1 has always had the full
  kit; the ladder is mechanics, hp, and mechanic cadence — nothing else. A
  mechanic listed in `_mechanics` whose interval was never written **never
  fires**, and a count-based test passes on exactly that bug.
- **Vader's DAMAGE does not scale with the encounter, and that is a contract.**
  Not contact, not slam, not any move — a later Vader is harder because he asks
  more and harder questions, never because the same question costs more.
  `smoke-vader` asserts the damage fields are identical at rungs 1 and 6, so
  anything that adds a per-encounter multiplier has to argue with a check.
- **`disarm` IS SUPPRESSION, and it does not touch a weapon.** The internal id,
  the `boss-disarm` event and `_disarmEvery` are historical: the mechanic used to
  strip `player.secondary` and drop it, which on handset read as nothing
  happening — the pistol is infinite and untouched, so primary fire, super, melee
  and dash all still worked, and with no secondary equipped it returned on its
  first line without even raising its banner. It now blocks BOTH Super activation
  paths for `PLAYER.suppressMs` and nothing else. Never re-derive the old
  behaviour from the id.
- **Both Super gates have a required POSITION, not just a condition.**
  `tryFireSuper`'s sits ABOVE the charge check, or a blocked press deletes the
  meter it is supposed to preserve. `tryMeleeCombo`'s sits ABOVE the `inCombo`
  branch, because casts 2 and 3 of a Broken Wings chain skip the `meleeReady`
  test — gate on readiness and a started chain swings free through the lockout.
- **THERE IS NO BASELINE MELEE.** Broken Wings is itself a Super. Any mechanic
  that takes the player's primary fire leaves them with nothing to do but run,
  which is why SUPPRESSION deliberately never touches it.
- **LIGHTS OUT IS AN ARENA TINT, NOT A VIGNETTE — and the vignette is
  seasoning.** The transformation is multiplicative tints on
  `GameScene.roomLayer`, which holds the backdrop, the decal RenderTexture, the
  walls, the cover consoles and the props and NOTHING ELSE. Combat is outside
  that group, so the saber, both bullet pools, telegraphs, Force effects, the
  returned orb and both silhouettes are exempt BY CONSTRUCTION rather than by a
  list that could drift — `smoke-vader` asserts none of them is inside it.
  Strength comes from `_loClass`, tagged at creation in `loadRoom`, resolved
  against `LIGHTSOUT` in `config.js`. A new prop must be tagged or it silently
  takes the generic strength. The previous 90px player-tracking pocket was
  mechanically successful and REJECTED ON HANDSET as a flashlight radius; do
  not put it back.
- **A LIGHTER FLOOR TINT TURNS THE VADER CHAMBER RED.** Its floor base is
  already `#0a0a0d` and the only coloured thing baked into it is the crimson
  strip lights and the dais ring, so any tint gentle enough to spare them
  leaves a maroon room — and crimson is the DANGER colour. The saber, the SABER
  THROW lane and every telegraph are red and must be the only red in frame.
  Measured and rejected at `floor: 0x191e2b`.
- **`_sectorTint` IS AMBIENT LIGHT AND IT IS ADDITIVE.** The endless per-sector
  wash is an ADD-blended screen-locked rectangle at depth 9000, up to 0.20
  alpha. Additive light above every room object cannot be tinted away from
  below, so a dark arena that leaves it running is a dark arena with the lights
  on — at sector 30 that was a solid olive wash over a room meant to be black.
  It drops with the room and is restored exactly.
- **A `TweenChain`'s config has no `onUpdate` to hand down to its links.** Set
  it on the chain and the scalar animates while nothing ever reads it. It
  photographed as a fully lit room half a second into an ACCEPTED LIGHTS OUT.
  Put the callback on every link.
- **DARKNESS HAS ONE OWNER AND TWO PRODUCERS.** The standalone `blackout` clock
  and ECLIPSE both used to emit `boss-blackout` and both were obeyed
  unconditionally: measured on a real 75s Vader 6 fight that was 13 activations,
  a 297ms shortest gap and three lights-re-raised-while-already-on. Everything
  now goes through `GameScene.requestLightsOut(source)`; cooldown is measured
  from the END of darkness (`lightsReentryMs`, NOT scaled by `bossMechScale`),
  one pending request maximum, ECLIPSE outranks a standalone BLACKOUT and a
  BLACKOUT can never displace a pending ECLIPSE. Nothing extends an active
  darkness. Never toggle the visual state directly.
- **ECLIPSE's clones go with the darkness, not with the clock.**
  `boss-afterimages` on an `_eclipse` Vader asks the owner and spawns nothing
  itself; `_beginLightsOut('eclipse')` spawns them. Firing the clones while the
  darkness is refused is AFTERIMAGES wearing ECLIPSE's banner. Known price: at
  rung 6 every activation is ECLIPSE and clone cadence drops ~10.7s -> ~16.7s.
- **FORCE PULL + DEFLECTION IS AN APPROVED COMBINATION.** Handset-verified on
  Vader 6: pull compromises repositioning, deflection punishes mindless ranged
  aggression, lateral dash is the answer, and the death inside it was judged
  fair. Do NOT add an exclusion rule, scheduler separation, or a softening of
  either because they overlap.
- **THE SABER'S LIGHTS-OUT GLOW IS A READER, AND IT RUNS ON `postupdate`.**
  Two ADD Graphics owned by `Boss` (`_saberHalo` above his body, `_saberBloom`
  just under the blade), drawn by `_drawSaberGlow` from `weaponSprite`'s
  finished x/y/rotation. It computes NO aim, NO parry state and owns NO tween —
  that is why it survives the parries, the DEFLECTION stance, the power sweep,
  VANISH and CHARGE without knowing they exist. It is NOT called from
  `preUpdate`: `preUpdate` runs before the tween manager steps, so a TWEENED
  pose (SABER THROW's flight and spin, VANISH's `spin()`) is still last frame's
  value there — at 8π over the act beat that is ~25 degrees between a blade and
  its own light. The listener is removed in `Boss.destroy`; a `postupdate`
  handler closed over a dead boss outlives every room after it.
- **THE GLOW IS ANCHORED TO THE SPRITE, WHICH IS WHAT MAKES THE THROW TRUE.**
  `weaponSprite` IS the saber — SABER THROW detaches it and flies the real
  object — so the light leaves with the blade and nothing is left glowing in
  his hand. Anchoring to his hand would manufacture exactly the phantom the
  one-saber contract forbids. Every dimension is a multiple of the blade's
  measured half-thickness read from `displayWidth/displayHeight`, never a pixel
  literal, so a re-drawn or re-scaled saber cannot leave its glow behind.
- **AN EVEN ALPHA ACROSS A STACK OF GLOW SHAPES PUTS AN EDGE ON SCREEN.** The
  broad spill is six capsules widest-to-tightest, and the widest is the
  FAINTEST (`0.16 + 0.84·t^1.6`). At uniform alpha the outermost rim lands at
  full step strength and photographs as a legible crimson ellipse around the
  blade — a shape around a weapon rather than light off it. Measured and fixed.
  The same reason the console pools are three rings, not one disc.
- **THE ARENA'S EMISSIVE SECOND STATE IS NOT DONE.** `LIGHTSOUT.consoleGlowAlpha`
  is a bounded prototype: one Graphics, a soft BLUE pool behind each console,
  redrawn only on a state change. Blue because crimson is the danger colour and
  belongs to the saber and the telegraphs. Set it to 0 and it is gone. Authoring
  arenas with a real emergency-power composition is the map overhaul's job — do
  not treat the saber pass as having finished it.
- **TWO DARKNESS GRADIENTS, AND THE MODE ARGUMENT PICKS ONE.**
  `set-darkness true` with no mode is the persistent DARKNESS room modifier,
  whose vignette darkens the centre 200px of the screen — where the fight is —
  by EXACTLY 0%. Vader's LIGHTS OUT must pass `'blackout'`. Dropping the mode is
  silent and puts the banner back over an unchanged playfield, which is what
  shipped. The blackout pocket also TRACKS THE PLAYER, because the game camera
  clamps at the arena bounds and a screen-locked pocket strands them up to ~270px
  horizontally and ~508px vertically outside their own sight radius.
- **WAVES ARE COMPOSED NOW, AND `src/data/encounters.js` IS THE TABLE.** It is a
  DATA LAYER, not a framework — six archetypes, each an ordered guaranteed
  `lead`, a `fill` pool (weighted by REPEATING an id, never by a number), a
  `gate` mode and three pressure multipliers. **If it ever needs a callback, a
  condition or a parser it has failed its brief; the answer is to stop, not to
  grow a grammar.** `GameScene._resolveEncounter` is the whole engine side and
  **every exit leaves the old path intact**: null encounter → `_rollEnemyType`
  and the ordinary far-gate picker, which is exactly the pre-Phase-A code.
  **PHASE A IS HUMAN-APPROVED AND FROZEN 🔒** — handset play confirmed the
  archetypes are identifiable from composition alone WITH THE DEBUG LABELS OFF,
  which was the whole thesis. `HANDOVER.md` §10ac. The compositions, the gate
  rules, the sector bands and the pressure multipliers do not move without NEW
  handset evidence.
- **THE BOSS ROOM IS EXCLUDED BY ABSENCE, NOT BY A BRANCH.** `vader` has no
  entry in `ENCOUNTER_PLAN`, so `encounterFor` returns null and its escort waves
  run untouched; the duel wave is refused by the caller on `wave.miniBoss`.
  `smoke-encounters` pins the boss room's absence in both directions. Do not
  "tidy" this into an `if (roomSpec.boss)` — absence is what makes the layer
  removable.
- **A COMPOSITION'S PREFERRED GATE NEVER BEATS THE 400px SAFETY.** `spawnAtGate`
  takes an optional gate, and uses it only if it is ≥400px from the player;
  otherwise that one spawn falls back to the ordinary picker. A player who walks
  over to camp a single-gate encounter's door must not get a trooper on top of
  them.
- **`_applySectorScaling` COMPUTES A `count` THAT NOTHING READS, AND THAT IS A
  LIVE BUG WE ARE CARRYING DELIBERATELY.** It scales `out.count` on `arenaCfg`,
  but the drip has always tested the raw authored `wave.count` — so **enemy
  COUNT per wave has never scaled with the sector.** Only `maxAlive`,
  `spawnRate`, `eliteChance`, hp and speed ever did. Phase A did NOT fix it:
  pointing the drip at the scaled value is a 2.56x spike at sector 14, which
  inside a handset test asking "does composition create tactics?" is a
  confounded A/B. `_waveCount` carries the budget now, so the fix is one line
  and is a separate, deliberate balance decision.
- **A SWARMLING SPAWN EVENT IS A PACK OF 4-6 BODIES, AND THE CAP IS CHECKED
  BEFORE IT LANDS.** `living < cfg.maxAlive` gates the drip, then
  `_spawnSwarmlingPack` drops `packMin..packMax` at once — measured live at 9
  alive against a cap of 6. Any swarmling-heavy composition must run a LOWER
  cap, not a higher one; the volume is already in the pack.
- **`?encdbg=1` IS THE PHASE A ENCOUNTER TEST HARNESS, AND ITS FIRST PROPERTY IS
  THAT IT DOES NOT EXIST WITHOUT THE FLAG.** No overlay is constructed, no
  pointer area is taken off the fire stick, and a force left set from an earlier
  run is IGNORED — `_resolveEncounter` only consults it under `isEncDebug()`.
  `smoke-encdbg` checks every one of those as a PAIR (absent without the flag,
  present with it), because "the overlay appears" passes just as happily on a
  build that shows it to every player.
  Grammar: `?encdbg=1` overlay only, `?encdbg=crossfire` pre-selects an
  archetype, `&room=detention` and `&sector=8` start the run there so one
  bookmark is one test case. An unknown archetype id falls back to AUTO.
- **THE FORCE SUBSTITUTES; IT NEVER MANUFACTURES.** `_resolveEncounter` asks the
  real `encounterFor` first and returns on null, and only then swaps in the
  forced archetype. So the boss room and the duel wave stay outside the harness
  by the SAME ABSENCE that protects them in production, not by a second guard
  that could drift out of step with the first. `smoke-encdbg` forces an
  archetype hard and asserts the boss room and the duel wave still resolve to
  nothing. Do not "improve" this into an explicit `if (roomSpec.boss)`.
- **A DEBUG BUTTON MUST LIVE IN THE RIGHT HALF OF THE SCREEN.** The move stick
  claims the whole LEFT half with no `shouldClaim` hook at all; the fire stick
  claims the right half and takes one, which is how the pause button already
  lives there. A left-half button would be unblockable without teaching the move
  stick about exclusions — a change to a control the player actually uses.
  `_overEncBtn` joins `_overPauseBtn` in that list, and `smoke-encdbg` asserts no
  exclusion point falls in the left half.
- **`DebugScene._skipWave` LEAVES `arenaActive` FALSE.** `_clearWave` sets it
  false and only `loadRoom` ever sets it true, so SKIP WAVE starts a wave the
  spawner is switched off for. Pre-existing; noted, not fixed. Any new debug
  path that restarts a wave must assert `arenaActive = true` itself —
  `_debugReplayWave` does.
- **A DEBUG WAVE SWEEP USES `_destroyEnemyFully`, NOT `damage()`.** Killing
  through the damage path pays score for enemies nobody fought and fires every
  volatile/bomber death blast across the arena at the moment the replay is
  trying to establish its read — the same reason `_beginDuel` DISMISSES trash
  instead of killing it. The known cost is that `RoomManager.aliveEnemies` is
  not decremented and drifts UPWARD, which is the safe direction: its only job
  is to emit `room-cleared` at zero, and the wave machine reads
  `_livingEnemyCount()` rather than that counter. Never drive that counter to
  zero in a sweep — that fires `room-cleared` and completes the room.
- **THE INTERDICTOR IS HUMAN-REJECTED ❌ — `HANDOVER.md` §10ad.** Handset play
  called it almost stationary, dead to one Super, far too slow and too weak to
  be an interesting ordinary enemy: **a hazard carrier, not an elite
  combatant.** DO NOT TUNE IT — not hp, not speed, not damage, not cooldowns,
  not the beam, not more purple. The problem is not in the numbers, and four of
  the seven causes were checkable with arithmetic: it STOPS at `holdRange` by
  construction, PURGE's 240px trigger sits inside a 430px hold so it could
  almost never fire (zero casts in 32s, measured), and 1400hp is 0.47 of ONE
  Super's 3000 raw damage. **I also froze one of those errors into a passing
  check** — `smoke-champion` asserts the Champion is the slowest thing on the
  floor. A test that pins a mistake is worse than no test.
  The TECHNOLOGY is sound and reusable: `Hazard.js`, the `?champdbg` harness,
  `smoke-champion`'s structure and the cancelled-handle fix all stay. Its honest
  future is an EMPLACEMENT — a terminal-defence turret or a deployable — where
  `holdRange` stops being a bug. Normal Endless still spawns no Champion — no
  encounter pool entry, no `_rollEnemyType` branch, no chance roll — and Nemesis
  is still untouched.
- **THE HARROWER IS HUMAN-REJECTED ❌ TOO — `HANDOVER.md` §10ae.** Handset
  play: *"the first was a stationary bot and now this one looks like a sliding
  skateboard bot."* DO NOT TUNE IT — not speed, not the pass planner, not the
  wake, not `bankPunish`. `?champdbg=1` still spawns it and
  `?champdbg=interdictor` the other one; **normal Endless spawns neither.** Its
  honest future is a light vehicle or an environmental moving hazard, not a
  combatant. The TECHNOLOGY is sound and stays: `Hazard.js`, the pass planner's
  window trimming, the displacement-measured watchdog, `smoke-harrower`.
- **BOTH CHAMPIONS FAILED ON CATEGORY, NOT ON NUMBERS, AND THE CAUSE IS ONE
  LINE: I DESIGNED A MECHANIC AND THEN LOOKED FOR A BODY TO PUT IT IN.**
  `HANDOVER.md` §10af is the two-candidate post-mortem and the doctrine.
  Opposite theses — one that never moves, one that never stops — rejected in
  the same word, *bot*. In both, the content was on the FLOOR and the actor was
  its emitter; the body was then drawn to make the floor effect plausible,
  which is how a Champion became an emplacement and then a craft. Apply the
  DELETION TEST at design time: remove the actor and keep the effect — if the
  fight barely changes, it is a hazard wearing a healthbar.
- **A CHAMPION IS A CHARACTER, NOT A DEVICE — bipedal, humanoid, armed, and a
  COMBATANT FROM THE FIRST BUILD.** Phase B.1 shipped four verbs and no attacks
  on the theory that movement had to stand alone; a thing that cannot shoot
  back cannot demonstrate that it is an opponent. The minimum viable Champion
  is not the minimum viable MECHANIC. **The zone-control requirement is
  DROPPED** — it was an invented constraint and it produced both failures.
- **MOVEMENT MUST READ AS DECISION, AND "PERCENTAGE OF THE FIGHT IN MOTION" IS
  NOT EVIDENCE OF PRESENCE.** `diag-harrower` measured 81% moving, 8 passes per
  44s, worst stationary interval under 435ms — every bar cleared, actor
  rejected. Constant-speed translation along a pre-validated line is what a
  vehicle does, however fast. Approach, hesitate, commit, reposition is what a
  person does.
- **THE VISUAL / FANTASY GATE COMES FIRST, AND 1x IS THE ACCEPTANCE
  AUTHORITY.** No entity file, no move, no test, no deploy for any Champion
  until a human has approved a concept sheet at GAMEPLAY SCALE on a real arena
  floor, beside the grunt, the shooter, the player and Vader. The enlarged view
  is art inspection only. Two full implementations died at a handset on a
  question that costs one picture to answer. **The IMPERIAL SHOCK CAPTAIN
  PASSED that gate** — `HANDOVER.md` §10ag — and only then got a runtime.
- **THE SHOCK CAPTAIN'S COMBATANT FOUNDATION IS HUMAN-APPROVED AND FROZEN 🔒 —
  `HANDOVER.md` §10ag, §10ah.** Frozen: the silhouette (helmet dome + crest,
  narrow luminous visor, ONE asymmetric bone pauldron, reinforced chest, kama,
  separated legs, compact back pack, two-handed rifle), the 112x120 hierarchy,
  the walk and strafe cycles, the brace → fire → recoil structure, the 300-520
  engagement band, advance / give ground / strafe, the three-round burst, the
  two-layer reactive armour and `armourSpill`, and the anti-stunlock behaviour.
  The notes below are how it works and how it breaks; **none of them is an
  invitation to tune it.** Still NO variants, NO colourways, NO Nemesis
  replacement — and **normal Endless spawns no Champion of any kind.**
  **THE CAPTAIN'S CORE COMBAT FEEL IS HUMAN-APPROVED 🔒.** Handset play closed
  out the agility, the tactical step, the variable suppression rifle and the
  recoil. **THE MECHANICS ARE FINISHED — do not redesign the enemy.** No hp,
  armour, Super-resistance, step, rifle, movement, range or Arc Grenade GAMEPLAY
  change without new handset evidence. `§10am` is the VISUAL FINISH pass and is
  the current candidate; it changed no gameplay value at all.
  **THE TACTICAL STEP, THE 5300 DURABILITY AND THE ARC GRENADE ARE NOW
  HUMAN-APPROVED.** Handset play called the Captain much more agile, singled out
  the step for producing genuine dodges (a whole Super dodged through real
  movement), and reported a Wave 3 rush in which the Captain killed the PLAYER.
  **Survivability is no longer the primary problem** — so no more HP tuning, no
  Super resistance, no new survivability system, and the step's distance,
  timings, cooldown, triggers and FX are CLOSED. The CORE FEEL CLOSEOUT (CF.2)
  is the current candidate and touches only the spray shape and the firing
  recoil.
  **THE CORE FEEL PASS (§10al) IS THE CURRENT CANDIDATE AND IS NOT APPROVED.**
  It changed the tactical step (150 -> 200px, five beats, a new priority list),
  the body's weight language (the whole-body squash, `bob`, `lean`, the firing
  base, and two new frames — `settle` and `land`, 51 -> 57) and the rifle (a
  fixed three rounds -> a variable 3-6, and the per-round solver replaced by one
  committed corridor). **IT CHANGED NO DURABILITY AND ADDED NO SUPER
  RESISTANCE** — 1900 armour + 3400 body = 5300 is frozen, `armourTake` and
  `armourSpill` are untouched, and S2 is neither started nor justified.
  **B.2.3 IS STILL PAUSED**: directional damaged skins, model-level
  deterioration and the engineered Arc Grenade / field art are all still
  required and are NOT to be mixed into a movement or rifle pass.
  **B.2.2 CHANGED HIS TIMINGS AND HIS SPEED, ON A HANDSET FINDING, AND DID NOT
  TOUCH THE BAND.** `speed` 205 → 250, `recoverMs` 520 → 240, and the
  give-ground multiplier 0.86 → 1 (he was at his SLOWEST the one moment the
  player rushed him). `holdMin`/`holdMax` are in the frozen list and stayed
  there. **THERE IS ONE SIGNATURE NOW — THE ARC GRENADE — AND THERE IS NO
  SECOND ONE.**
- **THE STATE LANGUAGE'S ONE RULE SURVIVED HANDSET REVIEW AND ITS SUSTAINED
  HALF DID NOT — `HANDOVER.md` §10ah, §10ai.** **SYMBOL = TRANSITION, BODY / FX
  = SUSTAINED STATE.** A glyph lives a few hundred ms to say something CHANGED
  and is then gone; everything that must stay true is carried by the actor. **A
  glyph that lingers is a status icon, and a status icon is UI standing in the
  world.** Four glyphs, no more: armour break, low health, major hit, target
  reacquire. **IT IS NOT A PHASE SYSTEM** — nothing in it touches fire rate,
  speed, damage or the state machine, and `smoke-captain-state` measures a fresh
  and a badly damaged Captain and pins identical speed, damage and median burst
  gap. **PHASE B.2.2 (§10ai) IS THE CURRENT CANDIDATE** and is not approved.
- **DO NOT BALANCE THE CAPTAIN AGAINST THE WORD "SUPER" — `HANDOVER.md` §10aj.**
  "He survives two or three Supers" only means something if a Super is scarce,
  and in real play it can be used about once a second, which makes it closer to
  high-power secondary fire than to an ultimate. **B.2.3 POLISH IS PAUSED** and
  no hp, armour, rifle, model or ability change is to be made until the human
  brings back A/B/C runs from `?champdbg=1&captel=1`. The order is: measure how
  fast and by what means a real player kills him, then decide where Champion
  sits in the hierarchy, then choose a survivability mechanism. **HP COMES
  LAST.**
- **HUMAN HANDSET COMBAT IS THE BALANCE AUTHORITY, AND THE BOT IS NOT.** The
  harness called the Shock Captain comfortable while a human erased him in
  **4.7 seconds** — it plays materially slower and uses the Super far less
  aggressively than a person. Never write "the bot says TTK is 11.3s, therefore
  approved". Automated probes may verify step geometry, cooldowns, layer
  arithmetic and cleanup; they may NOT hold an opinion about how long a fight
  should last, and no smoke test in `§10ak` asserts a TTK.
- **THE CAPTAIN IS NOT GENERALLY UNDER-DURABLE — HE IS SPECIFICALLY TOO EASY TO
  ERASE UNDER CONCENTRATED SUPER PRESSURE, `HANDOVER.md` §10ak.** The same
  actor completed 9 of 10 bursts and threw 3 grenades over ~25s against a player
  who refused the Super, and 1 burst and zero grenades against one who did not.
  **S1 is durability 4400 → 5300 (almost all BODY), a tactical step, and an
  armour identity — and deliberately NO Super resistance**, so the handset can
  say whether those two were enough. Do not add a Super multiplier, pellet
  reduction, burst resistance, per-hit cap, damage gate, armour recharge or
  immunity window; S2 reopens that only on evidence that S1 was not enough.
- **PUT DURABILITY IN THE BODY, NOT IN THE LAYER.** The armour break is the
  player's reward and has to stay reachable inside ONE committed Super — a
  pellet removes 510 armour at `armourTake`, so 1900 falls to four connecting
  pellets. Inflating the layer produces "I used several Supers and only finally
  got through his shield", which is worse than the problem it solves.
- **A CHAMPION MAY NEVER READ THE PLAYER'S ATTACK INPUT.** The tactical step is
  triggered by combat RELATIONSHIPS that were true before the player decided
  anything — crowded, blocked, post-burst, exploiting its own field — and never
  by `superAiming`, `superAim`, `superCharge`, `player-fire-super` or a pellet
  in flight. A body that sidestepped the button press is an unloseable coin flip
  wearing the costume of skill. Prove it TWICE: grep the actor for every
  identifier that could express the state (it cannot branch on what it cannot
  name), and fire real Supers at it while asserting no step follows a cast.
- **THE PLANT IS WHAT MAKES A STEP FOOTWORK.** Without it the body simply
  acquires velocity, which is the sliding read both rejected Champions died of.
  70ms planted in the brace body, then the travel on the STRAFE cycle — the
  existing lateral gait, and the only one whose feet agree with sideways
  movement. And move it with VELOCITY, never a tween or a teleport, so the wall
  collider stays underneath and a wrong destination costs a stop rather than a
  body inside a console. Validate the destination with `_hasLOS` — the same
  arithmetic his firing already trusts — rather than building a second planner.
- **A CAP ON AN EFFECT WILL BE FULL AT THE MOMENT THAT EFFECT MATTERS MOST.**
  The absorption cap exists so a five-pellet Super is not five blooms; the
  armour BREAK is caused by a heavy volley almost by definition, so the cap was
  full on the exact frame the overload wanted to draw and it rendered NOTHING.
  The one response that must never be suppressed is exempt, and it clears the
  in-flight ones first.
- **ONE AUTHOR PER HIT.** The `enemy-hit` handler fires a generic amber impact
  ring at the body CENTRE for any high-hp enemy. On an actor that answers a hit
  AT THE CONTACT POINT that is two authors for one event, and the generic one
  pulls the eye off the localized response carrying the meaning. It is
  suppressed when the actor speaks for itself — identified by the B.2.2 feedback
  claim, so every ordinary elite is untouched.
- **`delete` A TEST STUB, NEVER `= undefined`.** An immortality stub is an OWN
  property shadowing the prototype method; assigning undefined leaves the shadow
  and `damage()` calls it — "this.die is not a function", which reads like a
  game bug and is entirely the rig's.
- **NEVER ZERO A COOLDOWN AND THEN MEASURE THE SPACING IT CONTROLS.** A rig
  forced `_stepCd = 0` to make a step happen sooner, then read a 200ms gap
  against a 2800ms cooldown and reported a correct build as a skater. Exclude
  everything the rig forced, or do not force it.
- **A POOLED BULLET IS RECYCLED, SO COUNTING ACTIVE ONES IS NOT A LEAK TEST.**
  `smoke-captain`'s room-change sweep counted every live Captain bolt afterwards
  — including the freshly injected Captain's — and passed only while that one
  happened not to shoot inside the window. Hold the IDENTITY (`_gen`), the same
  way the check beside it already held the actor's.
- **DAMAGE BELONGS TO THE BODY, AND `_site()` IS THE SHAPE OF GETTING IT
  WRONG.** It returned a point from `flipX` ALONE — so a Captain facing you, a
  Captain walking away and a Captain in profile all wore their scorch, their
  smoke vent and their electrical short at the SAME SCREEN OFFSET. The damage
  did not turn when he turned, which is what a handset means by "sticker". The
  persistent marks are painted into THREE AUTHORED SHEETS now (intact / broken /
  critical, 57 frames each, per facing) and the dynamic FX run from
  `CAPTAIN_DAMAGE_ANCHORS` — declared in the SHEET'S OWN PIXELS beside the
  painter that draws the hole, converted through the sprite's LIVE
  `displayWidth`. Same rule as `CONSOLE_KIT`: a hand-written world offset is one
  edit away from venting smoke out of a shoulder that has moved.
- **ONE DAMAGE HISTORY TOLD FOUR TIMES, NOT FOUR SKINS.** The command pauldron
  took the hit, so `dmgX` is that side as a sign and every piece of damage reads
  it — screen-left in front view, screen-right in back view (the same shoulder;
  he has turned round), nearest in profile. CRITICAL is the SAME wound wider,
  never a second theme.
- **`SpriteSheet.cut` EXISTS BECAUSE A DARK FILL IS NOT A HOLE.** Filling a
  region dark changes what is INSIDE the outline; a missing piece of armour has
  to change the OUTLINE. MEASURED ON THE ACCEPTANCE MATRIX: the first cut of
  CRITICAL added only one- and two-pixel features inside the silhouette and came
  back as two indistinguishable dark Captains at 1x. `clearRect`, so the deck
  shows through. And critical drops the whole plate ladder ONE STEP OF VALUE on
  top of that geometry — scorched unpowered hardware really is darker, and a
  step of value is the only cue that survives a glance at 112px.
- **A STATE-CHANGE TEXTURE SWAP MUST KEEP THE POSE.** `_setBodyState` changes
  only the animation PREFIX and re-seats the same frame index, so a Captain
  whose armour breaks mid-stride keeps his cycle. Snapping back to frame 0 of an
  idle on the frame the armour goes would throw away the approved animation work
  to a texture swap.
- **A CONTACT SHEET IS THE ONLY HONEST ACCEPTANCE FRAME FOR A STATE LADDER.**
  "Can I tell intact from broken from critical at 1x" is a COMPARISON and a
  human cannot make it by flipping between twelve files. `shot-captain-dmg`
  draws three states x four facings onto one canvas IN THE PAGE, which needs no
  image library on the box — and that frame is what caught CRITICAL being
  indistinguishable from BROKEN.
- **THE DEVICE IS THE SOURCE AND THE FIELD IS ITS CONSEQUENCE.** The Arc Grenade
  was a Graphics circle with a dot in it while the FIELD carried the whole
  visual identity — the Interdictor failure in miniature, where the floor effect
  becomes the character. It is a painted two-frame object now (inert / powered,
  because "the same thing, brighter" is not a state change), it flies as the
  projectile and stays as the source, and ONE object owns the whole lifecycle.
  It is an Image rather than a Graphics, so it is the one thing a sweep that
  only remembered the four Graphics would have left behind.
- **NINE DECLARED POINTS, AND NO RANDOM ENDPOINTS.** The rejected field drew
  SIXTEEN boundary arcs between random endpoints on an invisible circle plus
  three to five interior arcs with random ends, over three stacked translucent
  discs. Nothing in it had an anchor — that is what "scribbled with a pen"
  means. Everything is now the device or one of EIGHT projector nodes at exact
  45-degree intervals: the perimeter is eight TRUE CIRCULAR ARCS drawn with
  `Graphics.arc` at `this.radius` (the hit test's own number, so painted and
  resolved cannot drift by any amount), and every bolt runs between two of the
  nine points with both endpoints exact and the jitter bowing INWARD.
- **A BIG ROUND PROP DEFAULTS TO A DIAL — AND SO DOES A BIG ROUND FIELD.** A
  perfect circle with eight radial spokes and eight tick marks on it is a RADAR.
  Four spokes, alternating, stopping at 0.52r; perimeter gaps at 0.14 rad
  because at 0.085 the eight segments closed into one drawn circle with
  graduations on it. Same rule the hero machine already carries.
- **AN ACTIVATION IS A SEQUENCE AND THE DANGEROUS REGION MUST BE LEGIBLE BEFORE
  IT IS DANGEROUS.** Core powers up, nodes establish one at a time each placed
  by a visible beam, perimeter closes at 74% of `armMs`, connections snap in —
  and `contains()` does not return true until 100%. Shutdown reads off
  `_integrity` in the order a machine fails (connections, perimeter, nodes,
  core last, and the core drops to the INERT FRAME rather than fading because
  the device is still there). The edge stays legible the whole way down: it is
  dangerous for every millisecond of `warnMs`.
- **A BOUNDARY PROBE AT EXACTLY 1.0 MEASURES FLOATING-POINT ERROR.**
  `cos(π/4) * r` lands a fraction above `r` and `contains` correctly says no, so
  a test reading that as a bug is the instrument being wrong about a build that
  is right. Probe 0.999 and 1.002 on eight bearings, and test the edge itself on
  the four AXIS-ALIGNED bearings where the arithmetic is exact.
- **THE BOUNCE WAS NOT IN THE SPRITE SHEET, AND THAT IS THE LESSON.**
  `Enemy.preUpdate` owns a SCALE channel — a sine wobble at ±10% while
  `_staggerMs` runs and a 12% shrink while `recoilT` does — and `Enemy.damage`
  sets `_staggerMs` on EVERY HIT while `ShockCaptain._fireRound` was setting
  `recoilT` on EVERY ROUND. Correct on a Ø44 trooper taking three shots;
  measured on a 5300-durability Champion under sustained chip fire it is a
  rubber sprite for the whole fight, and the man visibly shrank each time his
  own rifle went off. **No amount of frame work could have fixed it**, and a
  pass that only looked at the sheet would have concluded the art was wrong.
  Both depths are TUNABLE FIELDS now (`_staggerScale`, `_recoilScale`) whose
  defaults are the shipped numbers, so every other actor is byte-identical. Ask
  which SYSTEM owns a motion before redrawing the thing that appears to make it.
- **WEIGHT IS ABOUT WHERE THE MOTION LIVES, NOT HOW MUCH THERE IS.** "Solid"
  does NOT mean magnetized feet, a locked pelvis or "heavy means slow" — the
  brief says so explicitly and a minimum-vertical-pixels metric is the wrong
  instrument. `bob` is a WHOLE-BODY vertical offset and it carried the Captain's
  firing arc (brace 1, fire 1, recoil 2), so the entire 112px figure travelled
  up and down four times a second; `lean` moved the HELMET ALONE by up to five
  pixels, which is a bobble head on a static torso. `bob` is zero for every
  firing pose now and the recoil went UP the chain — rifle first (a separate
  overlay), then shoulders (`sh`, deliberately DEEPENED), then a halved `lean`
  that the chest and shoulders take half of (`tl`) and the boots take none of.
  **PLANT, TRANSFER, COMMIT, CATCH, SETTLE.**
- **THE FIRING BASE IS THE ONE THING IN A BURST THAT DOES NOT MOVE.** The stance
  widens to shoot (two pixels each way, not one) and holds that width through
  brace, fire, recoil AND settle, so everything above it reads as absorbed
  rather than bounced. A six-round burst over a narrow stance is a man shooting
  off his back foot.
- **A STEP WITHOUT A CATCH IS A TRANSLATION.** The Captain's step was plant →
  impulse → stop, and the handset called 150px too short and visually weak. It
  is 200px and FIVE beats: plant (90ms, brace body, with a RISING suit preload —
  it builds into the launch, it does not fade), push-off (five thrust strands at
  the ORIGIN he leaves behind plus a flat deck scuff), travel (215ms, strafe
  cycle), CATCH (120ms on a dedicated `land` frame, with a low flat deck ring)
  and settle. **The catch is the frame that did not exist**, and without it a
  200px displacement ends by switching the velocity off.
- **THE ECHO IS WHERE THE HARROWER COMES BACK.** Two discrete stamps of the
  actor's own frame at positions he really occupied, 130ms each, with NOTHING
  joining them. They say "he was there a moment ago". A persistent trail says
  "he is sliding", which is the word a handset already used to kill a Champion.
  Do not add a wake, a long glide, whole-body rotation or giant afterimages.
- **CHANGE ONE THING PER HANDSET QUESTION.** The step's `cooldownMs` stayed at
  2800 while the distance, the presentation AND the priorities all moved:
  shortening it too would have made it impossible to tell which of the four the
  next verdict is answering.
- **A CHAMPION'S STEP PRIORITY IS A LIST, NOT WHICHEVER TEST WAS WRITTEN
  FIRST.** CLOSE (aggressive pressure — the most important use by a distance,
  0.95 of `holdMin` plus a CLOSING-RATE test so he answers a collapse in
  progress) > POST-BURST > FIELD > BLOCKED. Blocked is LAST and waits 460ms: a
  step spent walking round a console is a step not spent breaking the player's
  firing solution, and ordinary navigation already solves a blocked line at
  walking pace. Closing rate is measured from REAL DISPLACEMENT between frames,
  never from a velocity the actor just wrote.
- **ONE BURST = ONE CORRIDOR + ONE MONOTONIC SWEEP, AND TWO OF THE FOUR SHAPES
  WERE NEVER MONOTONIC.** `outward` walked 0.5 -> 0.75 -> 0.25 -> 1 -> 0 and
  `sweepback` went out and came back; together they were 44% of bursts, and on a
  handset that is a rifle aiming one way, swinging back through ground it has
  already covered, and correcting again. **Measured at -159px of backward travel
  along a burst's own corridor.** The fix was FEWER DEGREES OF FREEDOM, not more
  patterns: one free choice (which side the sweep starts on), one traversal, one
  direction. The ease is a smoothstep blended with the linear walk, so
  monotonicity is a PROPERTY OF THE CONSTRUCTION — a non-negative blend of two
  monotonic curves — rather than a threshold that could drift. And the noise is
  bounded so it cannot compete: the bias is CONSTANT for the burst (it used to
  open 16% per round, a second motion running across the first), the jitter is
  PERPENDICULAR ONLY so it can never move a round backward, and the whole
  perpendicular excursion is capped at 45% of the along-axis step between rounds.
- **`lean` IS SCREEN-VERTICAL, BECAUSE THE CAPTAIN FACES THE PLAYER.** `bob` was
  already zero for every firing pose and the handset still saw pumping. `lean` is
  "along the facing axis" — and he aims at the player, so the front and back
  views are the common ones and that axis IS screen y. At +1 / -2 / -1 across
  fire / recoil / settle it moved the helmet crown FOUR SCREEN PIXELS, FOUR TIMES
  A SECOND. It is one value held for the whole firing commitment now.
- **A RATCHET, NOT A CYCLE — a long burst is ONE commitment, not six repeated
  animations.** Shoulders used to run -2 -> 2 -> 4 -> 1 per round, a six-pixel
  vertical swing repeated once per shot; the big step happens ONCE at commitment
  now and they stay LOADED (1 / 2 / 1) until the settle. The rifle does the same:
  `_wKick` keeps 55% of what is standing and adds to it, so the barrel never gets
  all the way home between rounds, and it bleeds at 0.09/ms inside a burst
  against 0.17/ms outside one so it IS home when the stance releases. **The
  per-round motion moved into the ARM (`ao`, 4 to -3, lateral within the sprite)
  and the rifle overlay** — §13's chain, rifle first, then arms and shoulders,
  then a very small head, then a base that does not move at all.
- **MEASURE A PISTON FROM THE SILHOUETTE, NOT FROM THE CHANNEL VALUES.** Reading
  `bob`/`lean`/`sh` says what you intended; the topmost and bottom-most opaque
  ROW of each pose frame says what shipped. It caught a surviving four-pixel
  helmet step after the channels had already been "fixed", and it is what proves
  the boot sole is identical across brace / fire / recoil / settle.
  `shot-captain-cf` prints those rows and **asserts nothing about them** — §29 is
  explicit that zero vertical movement is the wrong target and a stiff Captain is
  a worse failure than a bouncy one.
- **ONE BURST IS ONE TACTICAL DECISION, AND THE PER-ROUND SOLVER IS GONE.**
  B.2.2's ESTABLISH / LEAD / BRACKET solved an intercept PER PROJECTILE. It hit,
  and the handset called it robotic, aimbot, Terminator — and it was
  **exploitable in a way that is obvious once written down: three point
  solutions leave the ground BETWEEN them uncovered**, so a small step and a
  stop parked the player in the hole between the establish shot and the lead.
  `_planBurst` now takes ONE snapshot at late brace — origin, bearing, length —
  draws a burst length (3-6, authored weights, never uniform), a spray shape, a
  side bias and every round's imperfection UP FRONT, and then nothing reads the
  player's position, velocity or heading again until the burst is over. The
  fairness is structural rather than a coefficient. `_predict` is DELETED, not
  left unread — `smoke-captain-rifle` greps for it, on the same rule that
  removed the camera's `teleports: true`.
- **A STILL TARGET IS A ROUTE OF ZERO LENGTH, SO IT BECOMES A FAN.** Under the
  corridor law a stationary player would otherwise be suppressed along a
  direction they do not have. The plan degenerates to a 74px band ACROSS his own
  bearing, centred on them — a soldier shooting at somebody who is not moving.
  **Standing still must never become the safe answer to a new aiming law.**
- **AN AIM POINT IS A BEARING, NOT A DESTINATION — DO NOT CLAMP IT TO THE
  ARENA.** `_planPoint` clamped into bounds and that BENT the committed line
  whenever the route ran toward an edge: measured at 142px off a corridor whose
  authored spread is 75, which is the corridor law quietly not holding. A round
  is an ordinary projectile and is entitled to fly into a wall.
- **THE RIFLE MUST WALK, OR THE DIFFERENCE IS ONLY IN THE DEBUG VECTORS.**
  Facing was re-solved to the player every frame, so between rounds the barrel
  snapped back onto them and then out to the next answer — which is exactly what
  aimbot looks like. Inside a brace or a burst the aim eases toward the NEXT
  PLANNED POINT and nowhere else. If a new aiming law is invisible in gameplay
  footage it has failed, however good its geometry is.
- **A FIXED WINDOW AGAINST A CHASE IS THE FRAME-RATE TRAP IN A NEW COSTUME, AND
  IT WAS IN THREE RIGS AT ONCE.** `smoke-arcgrenade` waited a flat 9s for the
  real AI to throw while the median separation was **1231px against a
  `maxRange` of 680** — exactly ONE frame in the window ever satisfied
  `_canThrow`, three downstream checks read `phases: []`, and a working grenade
  was reported as absent depending on where the wave happened to drop him.
  `smoke-captain-rifle` measured three commitments in 26s for the same reason,
  and `diag-captain-pressure` printed a `line` run at a 1137px median. **STAGE
  THE ENGAGEMENT AND POLL FOR THE CONDITION.** A rig that has to walk somewhere
  first is measuring the walk.
- **DRAIN AN EFFECT ON THE ACTOR'S OWN CLOCK, NEVER ON A SLEEP.** The Captain's
  reaction FX are scheduled on `_clock`, which advances by Phaser's CLAMPED
  `delta` — so on a slow container a second of wall time is a third of a second
  of game time. `smoke-captain-step` waited 700ms for three 325ms overload
  responses to expire and the check therefore passed on a fast box and failed on
  a slow one, on this build and the one before it. Advance `_clock` and tick the
  effects directly; it is deterministic at any frame rate.
- **`?champdbg=1&captel=1` IS AN INSTRUMENT AND CHANGES NOTHING.** Separate from
  `champdbg` on purpose — most Champion reviews are not about numbers. With
  `captel` absent nothing is constructed: no container, no listeners, no
  `postupdate` hook, no panel, which `smoke-captel` checks by WALKING THE
  DISPLAY LIST rather than by asking whether the module ran. It also snapshots
  `CHAMPION.captain`, every player damage input and a live actor's hp/armour/
  speed with the flag on and off and requires them byte-identical: an
  instrument that perturbs the thing it measures is worse than no instrument.
  And it takes NO POINTER AREA — a tappable panel needs an exclusion point on
  the fire stick, which alters the controls of the run being measured.
- **ATTRIBUTION IS CARRIED, NEVER INFERRED FROM A MAGNITUDE.** `GameScene` sets
  `_dmgSrc` synchronously around each player damage call — the same idiom
  `_superHitCtx` and `_suppressHitSfx` already use, and exact because
  `Enemy.damage` emits `enemy-hit` INLINE, so there is no window between the tag
  and the read. A source guessed from a number gets worse every time the numbers
  move. Reconcile the attributed total against
  `starting durability - ending durability` ACROSS THE LETHAL BLOW, which is
  where a request and a removal differ most.
- **`isChampion` IS NOT "THE CAPTAIN I AM MEASURING".** `?champdbg=1` injects
  one Champion per WAVE, so two can stand on the floor at once. A probe measured
  four grenades thrown and two attributed while fields counted all four, because
  the field event had no owner filter and the damage listener tested
  `isChampion` instead of `enemy === session.actor`. Filter on the ACTOR, and
  tell the human when there is more than one — it changes how every hit rate
  should be read.
- **AN `attach*` THAT REGISTERS SCENE LISTENERS MUST REMOVE ALL OF THEM.**
  `create()` runs again on a restart (`PauseScene._restart`) and `scene.events`
  survives it, so tidying only the obvious `postupdate` hook leaves a full
  second set of handlers behind and doubles every counter from the second run
  on. Remember each listener at registration and sweep them on `shutdown` AND
  `destroy`. Same family as the `postupdate` handler closed over a dead boss.
- **A SCREEN COORDINATE IS NOT A GAME-CAMERA COORDINATE, and an overlay that
  forgets it prints through another overlay.** The Game camera is inset by
  `HUDCFG.topBarHeight`; the encounter harness's PREV / NEXT / REPLAY buttons
  live in the HUD scene at screen y 196/250/304. The telemetry panel at camera
  y 116 photographed straight through all three. DERIVE the top from the thing
  it has to clear.
- **IF REAL DURABILITY DECREASED, THE FEEDBACK MAY NOT SAY ZERO.** `Enemy.damage`
  emits `enemy-hit` with the number it was asked to take off the BODY, and on an
  actor with a layer in FRONT of the body that number is zero — so a Shock
  Captain whose armour bar was visibly draining printed `0 0 0` over his own
  head, and a human caught it on a handset. It was never a rendering nit: the
  game was telling the player their shots did nothing at the moment it was
  taking their damage. The same defect printed `485` for a Super that removed
  2285 and `4000` for a killing blow that removed 210 — **the figure was always
  BODY damage.** `_damageFeedback(bodyRemoved)` is the hook, it returns ONE
  number (armour removed + body removed) and a colour, and it is **opt-in by
  absence**: null means the handler falls back to `amount`, so every ordinary
  enemy is untouched. Never print two overlapping labels for one hit — the
  break FX is what says a layer transition happened.
- **`amount` IS A REQUEST; `hpBefore - hp` IS A REMOVAL.** A killing blow asks
  for more than the pool holds and a punish window multiplies on the way in, so
  any label built from the argument is wrong at both ends. Measure across the
  subtraction.
- **SYMMETRICAL, ROUND, COLOURED AND PULSING IS THE VOCABULARY OF A STATUS
  LIGHT, WHATEVER YOU MEANT BY IT.** B.2.1's two orange embers were the right
  INSTINCT — something must be true in every frame or a still and a glance both
  catch nothing — and the wrong FORM, and the handset decoded them as equipment
  indicators rather than as damage. The replacement keeps the instinct: ONE
  ASYMMETRIC failure site on the side that actually lost its plate, a second on
  the opposite flank only at critical, an always-true dark SCORCH (three
  overlapping discs at unequal offsets, NORMAL-blended so it takes light away,
  and it **does not pulse** — a burn does not breathe), and blue-white shorts
  that are **entirely event-driven**, 130ms at a re-rolled interval so they
  never find a rhythm. A continuous arc is the opposite of unstable.
- **A CAP THAT BINDS IN NORMAL PLAY IS NOT A BOUND, IT IS THE AIM.** The burst's
  `leadMaxPx` was 260 and rounds 2 and 3 both clamped to it, so LEAD and BRACKET
  were the same shot. Same family: solve a lead's flight time from the MUZZLE,
  not the body centre — 75px of barrel is a 25% over-lead, and it makes every
  coefficient a lie about what it means.
- **PREDICTION IS FAIR WHEN IT IS BEATEN BY CHANGING YOUR MIND.** The Captain's
  burst reads only the velocity the player HAS RIGHT NOW, bounded in time
  (`leadHorizonMs`) and space (`leadMaxPx`), and every round is an ordinary
  projectile that is never retargeted after firing. Measured: holding one
  lateral direction went from 0 of 21 bolts inside 48px to 9 of 21, standing
  still stayed ~76%, and reversing stayed ~24%. **Do not fix an evadable attack
  by raising its damage** — a dangerous miss is still a miss.
- **THE ARC GRENADE IS ONE OBJECT WITH FOUR PHASES, AND THAT IS A LIFECYCLE
  DECISION BEFORE IT IS A DESIGN ONE.** FLIGHT → ARM → FIELD → WARN, in
  `Hazard.js`, on the same list `Barrier` and `Wake` are on. A thrown thing that
  spawns a SEPARATE field on landing is two objects with two owners and two ways
  to be orphaned. `contains` is false until the field is live — the flight hurts
  nobody and the arming casing hurts nobody — and the boundary's jagged arcs
  jitter **INWARD ONLY** from the true radius, so the painted edge can never
  claim ground the hit test does not own.
- **A FIELD MAY NEVER TOUCH `player.moveMult`.** That is the permanent upgrade
  multiplier and upgrades COMPOUND, so a slow that scaled it and failed to
  restore it — on a death, a room change, two overlapping fields — would cripple
  a run for ever. `Player.preUpdate` reads `_envDrag`, applies it and resets it
  to 1 in the same breath; the only write is per-frame, from whatever is holding
  the player. Nothing persists it, so nothing can leak it. And the painful
  outcome comes from CHOOSING to stand in it: a tick and a drag, never a stun,
  a root or repeated control loss.
- **A CHAMPION MUST UNDERSTAND ITS OWN TOOL, IN THE SMALLEST VERSION OF THAT
  WHICH IS TRUE.** Two facts, four lines, no tactical director: a reposition
  target inside his own live field is pushed radially out past it, and while it
  is live he takes the strafe side that puts the PLAYER between him and it. He
  is still allowed to CROSS it — a Captain who refused would freeze whenever it
  landed between him and where he was going, and an elite stepping through his
  own electricity for half a second is a man in a hurry where standing in it is
  a man who does not understand his equipment.
- **A CLOSEST-APPROACH SAMPLER IS A FRAME-RATE METER TOO.** `diag-captain-pressure`
  samples on `postupdate` at ~14fps against a 600px/s bolt, so the bolt jumps
  ~43px between samples and a STATIONARY player — whom he cannot fail to hit —
  measures a 44px median miss. Read its buckets as an ORDERING between policies
  and builds, never as absolutes. Two more ways that rig lied: it cannot measure
  AIM through COVER (bolts died on crates a third of the way out and rounds 2
  and 3 appeared to over-lead by 180px), and a patrol that walks to the arena
  wall measures a RETREAT rather than a strafe (a 600px/s bolt chasing a
  380px/s player never arrives, however well it was aimed).
- **AN IMMORTALITY STUB MEASURES THE WRONG THING ON A LETHAL HIT.** Stubbing
  `die` to keep one actor alive down a whole damage ladder puts hp back ABOVE
  where it started on the killing blow, so the rig reports "0 removed" and calls
  a correct build a liar. Give the lethal case a real actor and a real death.
- **A SEQUENCING CHECK MUST READ THE SCHEDULE, NOT THE OBSERVATION.** The
  punctuation queue stamps each glyph exactly `punctSpacingMs` apart and fires
  each on the first frame at or past its stamp — so at ~10fps the observed gap
  lands anywhere in a ±110ms band and measured 294ms against a 340ms floor.
  Assert on the queued `at` values.
- **EVERY REACTION READS AUTHORITATIVE STATE, AND THE MAJOR HIT REUSES THE
  STAGGER THRESHOLD.** Armour from `armour` crossing zero, low health from the
  body pool crossing `lowHealthFrac` DOWNWARD, the major hit from
  `staggerMinDamage` — there is no second definition of "a big hit" and no
  parallel state kept only for effects. A killing blow announces NOTHING: a
  corpse does not say it is hurt, and the glyph queued by the same hit goes
  with it. Discovered because a probe killed its own subject.
- **EVERY EVENT-BASED EFFECT IS INVISIBLE MOST OF THE TIME, WHICH IS WHY THE
  CAPTAIN CARRIES EMBERS.** The first low-health build was a puff every ~1.2s, a
  spark every ~2s and a 90ms visor flicker, and it photographed as an
  UNDAMAGED Captain — a still frame, and a player glancing at him, catch none of
  them. `_drawEmbers` is the one mark that is ALWAYS TRUE: two small pulsing
  embers, breathing rather than blinking. **If the glyph is the only thing that
  ever said "damaged", the damage was UI.**
- **`smokeTrail` IS THE MISSILE TRAIL AND IS THE WRONG EMITTER FOR A DAMAGED
  BODY.** `missileSmoke` is `#3a3a44` at 0.45 alpha for 420ms — DARKER than the
  `#212328` deck — and it works only because a missile lays dozens along a path.
  One on a body is a dark speck. `fx.ventSmoke` / the `damageSmoke` emitter is
  lighter than the deck, lives 1100ms and drifts upward. Its tint and alpha were
  set by MEASURING against the deck value, not picked: at 0.5 over `#76767f` the
  emitter was provably running and the effect was provably invisible.
- **A PARTICLE EMITTER DEFAULTS TO DEPTH 0, UNDER THE WHOLE ACTOR BAND.** So
  smoke emitted at a body's shoulder is drawn BEHIND that body and is invisible
  exactly where it matters. `damageSmoke` sits at 1900 — above the band, below
  `DEPTH.AIR` — which is the same flat-constant debt the draw-order note
  already records, not a new convention.
- **PUNCTUATION IS SEQUENCED, NEVER SIMULTANEOUS.** A Super over-committed into
  a full-armour Captain breaks the layer AND crosses the health line in the same
  call; two glyphs in one frame is soup and neither reads. `punctSpacingMs` is
  the floor and the second simply waits. The queue is **DATA ticked on the
  actor's own `_clock` in `preUpdate`, never `time.delayedCall`** — so there is
  nothing to cancel on death, nothing that can fire into a destroyed scene, and
  a paused scene cannot advance it.
- **A GLYPH GOES OFF THE CENTRELINE AND CLEAR OF THE VISOR.** `fx.damageNumber`
  spawns at `(x, y - 40)` and rises straight up, and the frame that causes a
  reaction is exactly the frame that prints a number — so a mark over the helmet
  shares a column with every hit label. And the visor is the fastest
  identification on the body: nothing may crowd it, which is why the third
  low-health ember was removed.
- **A GLYPH'S STROKES ARE SPACED FOR ITS OWN OUTLINE.** It must read on a hangar
  deck, a dark cell wall and a muzzle flash, so it carries a black surround —
  and with 2px gaps that surround MERGES and the glyph photographs as a dark
  slab with bone shapes cut out of it. Two-pixel bars, three-pixel gaps,
  single-pixel crossbars. **They are VIOLET now, not bone** — see the
  punctuation register below; bone was right about the world and wrong about
  the combat text standing next to it.
- **TARGET REACQUIRE WAS MEASURED BEFORE IT WAS BUILT.** In a real CROSSFIRE and
  VANGUARD the Captain holds line of sight ~85% of frames and loses it about
  twice per 22s for 0.5-3.4s, and in 21-34 of those frames he was READY TO FIRE
  AND COULD NOT — a real engagement relationship, not an aim angle wobbling. A
  break shorter than `acquireLostMs` is a doorway; `acquireCooldownMs` bounds
  the rate. **Do not add a cosmetic flourish to AI state that does not exist —
  probe it first.**
- **THE DEBUG STATE TRIGGERS DRIVE THE REAL `damage()` PATH.** DEBUG → CHAMP:
  BIG HIT / BREAK / LOW HEALTH size their numbers from the actor's own config
  and invoke no reaction directly, so what you are looking at is what a player
  would cause. They are no-ops with no Champion on the floor, which is the same
  absence that keeps the actor out of production.
- **A FIXED SLEEP AGAINST A PHASER TIMER IS A FRAME-RATE METER, AND IT WENT OFF
  IN `smoke-champion`.** Its seam checks waited `anticipateMs + 500`, which was
  generous on the machine they were written on and stopped being generous on a
  slower one: seven checks failed with `hazards: 0` while a direct probe showed
  the seam landing perfectly well a moment later, and the same too-short wait in
  the helper made `_hazards[0]` `undefined` for every lifecycle check
  downstream. **Poll for the CONDITION.** A/B against the stashed build before
  believing any suite failure — this one reproduced identically on the committed
  tree, which is what proved it was the instrument.
- **AN ACTOR MAY DECLINE THE DEFAULT ANIMATION SELECTOR, AND THE CAPTAIN DOES.**
  `Enemy.preUpdate` picks idle/walk/fire/move-pose off the stock 33-frame
  contract; `_ownsAnim` (default false) turns that half off for an actor whose
  sheet is a different shape. **If both selectors run they overwrite each
  other's key every frame and `play()` restarts the animation on every tick** —
  a body permanently on frame 0 of something. `_facingSuffix()` is extracted so
  both paths resolve a facing from one implementation.
- **THE CAPTAIN'S SHEET IS 57 FRAMES AND EVERY DIFFERENCE FROM THE STOCK 33 IS
  A REQUIREMENT.** IDLE IS TWO FRAMES (every other actor idles on one, which is
  a frozen body — an elite that stands perfectly still between bursts reads as a
  prop). STRAFE IS ITS OWN CYCLE (playing the forward walk while travelling
  sideways swings the feet AGAINST the direction of travel, which is the
  sliding read both rejected candidates died of). BRACE / FIRE / RECOIL are
  three separate bodies — an earlier build separated brace from fire by one
  pixel of arm and they photographed as the same frame, which makes a burst a
  muzzle flash over a static pose. SETTLE and LAND are the core feel pass: a
  burst that returns to the full brace after every shot is ONE POSE LOOPED N
  TIMES and at six rounds that reads as a machine cycling, and a 200px step that
  ends by switching the velocity off has no catch. Frames 48-56 are pose HOOKS —
  `raise` and `thrust` are the Arc Grenade's; `recover` is still unused.
- **THE FEET DO NOT BOB, AND THE LEADING FOOT IS LIGHTER.** Deriving the leg
  ground line from the torso made the whole stance rise and fall with the walk
  bob — a body hovering rather than a body whose weight shifts — and it pushed
  the leading boot off the bottom of the canvas, where `SpriteSheet.rect`
  silently CLIPPED it: **the cycle's biggest step was the one with a foot
  missing.** Two identically-toned boots swapping places also read as one shape
  wobbling; the near foot catching more light is what makes the swap a STEP.
  The Captain is 28x30 rather than 28x28 for exactly this, and the two extra
  rows are empty footing, not more figure.
- **A MUZZLE FLASH AT THE FLAT DEPTH 27 IS DRAWN UNDER THE ACTOR BAND.** Actors
  Y-sort, so a body at world y 700 draws at depth 700. It has been survivable
  for nemesis weapons because their muzzle sits ~26px from a Ø44 body; it stops
  being survivable on a Ø56 body with a 75px barrel firing SOUTH, where the
  muzzle is 15px past the sprite's own bottom edge and nearly the whole flash is
  behind the man firing it. `weaponMuzzle` takes an optional `depth`; anything
  that knows its firer passes `firer.y + 2`. Same shape as the console whose
  light was drawn beneath the console — **ask where the light LANDS, in pixels.**
- **THE CAPTAIN'S DURABILITY IS TWO LAYERS AND `armourSpill` IS WHAT STOPS THE
  SECOND BEING A WALL.** The Interdictor's 1400hp was 0.47 of ONE Super, so the
  first casual Super deleted the concept before its behaviour could be seen — and
  a bigger pool is the WRONG answer to that, because it buys observation time by
  making every bullet feel weaker (the "spongey" failure). Overkill past the
  armour carries through to the body at `armourSpill`, so a Super breaks the
  layer AND hurts in the same instant. The break is TWO TEXTURES, not a tint
  (`champ-captain-broken` shears the pauldron and dims the visor), on the hero
  prop's contract: a recolour says "the same thing, dimmer" and what must read
  is that a piece of him is GONE. One layer, no regeneration, no second phase.
- **THE CAPTAIN DOES NOT YIELD ON `_staggerMs`, AND THAT IS THE POINT.**
  `Enemy.damage` sets it to 90 on EVERY hit, so `if (this._staggerMs > 0)
  return;` is a stun-lock by chip fire — 4305ms motionless, measured on the
  Harrower. It reacts to a REAL blow instead: above `staggerMinDamage`, once per
  `staggerCooldownMs`, for a bounded `staggerMs`, and the loop resumes on the
  frame it ends.
- **A CAPTAIN BOLT NEEDS ITS OWN POOL, AND ITS SPEED IS UNDER 620 ON PURPOSE.**
  `captainBullets` is the FOURTH hostile pool: `BulletGroup.fire` re-asserts its
  group's texture on every recycle, so a blue bolt in the green trooper pool is
  either re-textured after the fact (silently resizing its hitbox, because
  `Bullet.fire` sizes the body from the TEXTURE) or leaks blue into the next
  trooper's shot. It is in `hostileBullets`, which is what stops the split being
  six places to remember. `bulletSpeed: 600` sits under `Bullet.fire`'s
  `clamp(speed / 620, 1, 2.2)` tracer stretch, so the hitbox is exactly the
  texture width.
- **A TEST MUST NAME THE CANDIDATE IT TESTS, AND MUST READ THE ACTOR RATHER
  THAN THE FLAG.** `smoke-harrower` rode `?champdbg=1` and silently changed
  subject the moment the active candidate did. And a dynamic
  `import('/src/systems/debug.js')` inside `page.evaluate` can hand back a
  SECOND module instance carrying the authored defaults — `getChampWhich()`
  answered 'captain' while the sprite on the floor was plainly a Harrower.
  `spawnChampion` with no explicit id resolves the real default through the real
  code path, and its texture cannot lie.
- **A NEW ACTOR SITS BETWEEN THE TWO THINGS IT MUST NOT BE CONFUSED WITH, AND
  ITS LADDER IS PLACED AGAINST THE DECK.** Troopers are cool white (`#dcdce8`),
  Vader near-black (`#12121a`), the deck `#212328`. The Shock Captain concept's
  first build was `#2e3038` and photographed as a second dark blob standing
  next to Vader — technically between the two, visually one of them. Armour
  three steps above the deck, top planes four. Same rule the arenas already
  carry for props.
- **AN ACTOR IS A HIGH-ANGLE TOP-DOWN FIGURE: DOME, SHOULDERS, CHEST, THREE
  ROWS OF BOOT.** Vader is 40x40 with a 16px helmet dome; the grunt is 20x20
  with an 11px one; the dome is built as a real circle graded north-to-south,
  and the boots are three rows at the SOUTH edge. The first Shock Captain
  concept ignored that and stacked horizontal colour bands, which photographed
  as a machine rather than a man. **AND NO WEAPON IS EVER PAINTED INTO A BODY
  SHEET** — every armed actor carries a separate `weaponSprite` overlay painted
  EAST-facing at origin `(0.15, 0.5)`. A rifle baked into the body is a second
  author for the same object, and it photographed as a pale slab across the
  chest with the weapon out-reading the man.
- **A `Wake` IS EMITTED, A `Barrier` IS PLACED.** Both live in `Hazard.js` and
  share `spawnBarrier`/`spawnWake`/`tickHazards`/`clearHazards`. A wake is ONE
  object holding a polyline, not N segments — a trail built from separately
  spawned pieces photographs as disconnected floor rectangles appearing under a
  sprite. It is sampled by DISTANCE (`wakeStepPx`), never per frame, for the
  same reason the returned super's remnants are. `_segW(age)` is used by the
  renderer AND by `contains()`, so the drawing and the hit test cannot drift.
- **GATE A LOOP ON CAPABILITY, NEVER ON CLASS.** The Champion move-tick loop
  called `dueMove` on everything `isChampion`; the Harrower schedules nothing,
  so it threw every frame — and because that loop runs inside `update()`, the
  abort **took the rest of the frame with it**, hazards included. It presented
  as the new actor being broken. `typeof e.dueMove !== 'function'` is the guard.
- **A COMMITTED CRAFT MUST NOT INHERIT THE INFANTRY STAGGER RETURN.**
  `if (this._staggerMs > 0) return;` opens nearly every actor and is correct for
  a body that should slide when hit. On the Harrower it halted the whole loop
  while ordinary fire kept refreshing the timer and `Enemy.preUpdate` damped the
  velocity underneath: **4305ms motionless inside a "pass"** — the rejected
  Interdictor's failure arriving through a different door. A pass cannot be
  chip-interrupted; the BANK is where the craft is interruptible, and it takes
  `bankPunish` extra damage there. You cannot stop the run, you punish the turn.
- **NEVER MEASURE THE COMMAND YOU JUST WROTE.** The Harrower's grind watchdog
  read `body.velocity` immediately after `_drive()` had set it, so it measured
  its own instruction and could never fire — detention ground for 2603ms with
  the guard nominally in place. Measure real displacement per frame, divided by
  dt. Same family as "a refused call reads exactly like a failed one".
- **A PASS IS VALIDATED ON THE PLANNED CHORD AND FLOWN FROM WHERE THE CRAFT
  ACTUALLY IS.** Those differ by up to `alignTol`, which is enough to clip cover
  the true lane cleared. The lane is re-laid through the real position at ACCEL,
  so the promise and the flight are the same line.
- **A PASS THE CAMERA CANNOT SHOW IS NOT A CROSSING.** Chords clipped to the
  whole arena ran 1172px against a ~720px viewport and only **35% of a pass was
  ever on screen**. `maxPassLen` plus `_trimToWindow` centre the run on the
  player's neighbourhood. Any arena-scale movement design has this problem.
- **THE HARROWER ROTATES, AND THAT IS A NARROW EXEMPTION.** Body sprites never
  rotate here because rotating a HUMANOID produces the upside-down-sprite bug; a
  top-down CRAFT rotated to its heading is correct and is how every vehicle in
  the genre works. It is painted east-facing (the weapon-overlay convention) and
  driven by `setFrame` rather than `anims`, so it registers no animation keys.
  The exemption is for a vehicle, not a precedent.
- **A CHAMPION IS NOT A HAZARD WITH HP.** Position, movement, BASELINE THREAT,
  signature pressure, response to the player closing or retreating, survival and
  a vulnerability window have to form ONE loop. The first candidate had two of
  those seven and shipped anyway, because every piece was individually
  defensible and nothing asked whether they added up to a fight. A hazard placed
  by a stationary actor belongs to the FLOOR, not to the enemy.
- **A CANCELLED MOVE HANDLE IS NOT A CLAIM, AND A SCHEDULER THAT FORGETS THAT
  GOES INERT FOR THE REST OF THE ROOM.** `MoveScript.cancel()` deliberately does
  not clear `actor._activeMove` (only the `done` path does), so an interrupted
  handle sits on the actor for ever with `phase: 'anticipate'`. Any "one move at
  a time" gate must test `!handle.cancelled && phase !== 'done'`, never the
  phase alone. `_castChampionMove` does; **`_castNemesisMove` does NOT and is a
  live latent bug** in the legacy system, left alone on purpose. Same rule
  `CameraDirector._bossFramable` follows for the same field.
- **A PERSISTENT HAZARD HAS ONE OWNER AND THREE INDEPENDENT SWEEPS.**
  `src/systems/Hazard.js` mirrors `Telegraph`'s lifecycle: `spawnBarrier` /
  `tickHazards` / `clearHazards`. A seam is retired by the NEXT cast (one per
  Champion, always), by the Champion's `die()`/`destroy()`, and by
  `_clearRoomEntities`. All three are idempotent because none can know about the
  others. **A damaging region that outlives the machine that drew it is worse
  than no hazard** — the same reason a telegraph that outlives its attack is
  worse than none.
- **THE SEAM IS A LINE, NOT A DISC, AND THE SHAPE IS THE HIT TEST.**
  `Barrier.contains()` runs the arithmetic the renderer draws, growth included —
  during the 260ms grow the far end genuinely does not hurt yet. Never draw one
  shape and resolve another. It is a line because these arenas are lanes, a
  crossing and an escort floor: a disc is walked around, a line is a side you
  have to choose.
- **AN ENEMY PAINTED FROM A PALETTE FAMILY'S BOTTOM END IS INVISIBLE ON THIS
  DECK.** The Champion's first build used `impDark`/`impMid`/`impGrey` (#14161c
  to #2e3038) and photographed as an unidentifiable dark blob on the #212328
  hangar deck — the whole silhouette present and none of it readable. Place an
  actor's value ladder against the DECK, not inside a family: top plates two
  steps above it, body one, underside black. Troopers are white and Vader is
  black; anything new sits between the two things it must not be confused with.
  Same family as the shuttle borrowing `imp*`'s TOP end, in the other direction.
- **A CHAMPION GETS NO BANNER, AND THAT IS A QUALITY DECISION.** Vader's moves
  announce themselves by name; a Champion's must not. The claim is that the
  model, the wind-up and the effect explain the mechanic on their own — a move
  that only reads because its name is printed across the screen has
  communicated nothing, which is exactly what `?nonames=1` exists to ask.
- **An upgrade's `apply` can run more than once.** `pickThree` falls back to the
  FULL pool once fewer than three cards are untaken, so past ~sector 13 cards
  repeat. Effects take an `s` scale and must be written as magnitudes
  (`1 + 0.25 * s`, never `*= 1.25`); a bare multiplier compounds, and that is how
  player damage reached 1240x by Vader #6.
- **The dialogue card PAUSES Game and HUD.** Any test that spawns a boss or a
  nemesis must load with `?nodlg=1` or it will sit behind the card for its whole
  cap. `smoke-dialogue` is the only one that must not.
- **Recoil/kick timers carry their own duration.** `recoilT`/`recoilDur`/`recoilMag`
  and `_wKickT`/`_wKickDur`/`_wKickMag`. Never reintroduce a hardcoded divisor; that
  bug made the super shrink the player instead of popping it.

- **EXPANDING ROUND SHAPES AT A CONTACT POINT ARE WATER, WHATEVER COLOUR THEY
  ARE PAINTED IN.** The tactical step came back from a handset as a "water
  drop", and it was one by arithmetic rather than by taste: `_stepPreload` grew
  two `fillCircle`s at the boot, `_stepThrust` opened a `strokeEllipse` 100 ->
  150, and `_stepCatchFx` opened two more 26 -> 60. Five soft round shapes
  swelling and spreading from a point on a flat plane. **No intensity, colour or
  duration change could have answered that — THE FIX IS SHAPE LANGUAGE**, the
  same rule the hero machine's circle and the shuttle's wing edges already
  carry. `smoke-captain-closeout` greps the step methods for `fillCircle`,
  `strokeEllipse` and `.arc(` — absence, never a comment. `HANDOVER.md` §10an,
  and §10ao for what replaced v2's catch.
- **CONVERGING BRACKETS AROUND THE FEET ARE A GROUND SLAM, AND A HANDSET SAID
  SO.** v2 answered "splash" by making the catch CONVERGE: four diagonal
  brackets driving in on the boots, two stacked deck bars, two sideways scuffs
  and a `burstDir` fan straight up. Eight marks arranged symmetrically round a
  point under a body is the silhouette of Vader's crush and the Riven melee's
  floor crack — an ability going off underneath him — and it was rejected as
  reused language, not as a colour. **Recolouring it would have left the same
  shape saying the same thing.** v3's catch is ONE deck bar across the travel
  at the LEADING boot, three straight sparks thrown FORWARD (momentum carrying
  on, the one direction a slam cannot throw anything) and a small rectangular
  boot flash; the `land` frame does the rest. **If a landing effect could be
  reused by Vader or a melee slam, it is wrong.** `smoke-captain-closeout`
  bans `burstDir` and `_bolt` in every step method and caps the catch at three
  draw calls.
- **A DECK MARK KEEPS THE DECK'S FORESHORTENING, INCLUDING ITS LENGTH.** Every
  floor mark here squashes y by 0.5. The v3 catch bar normalised the squash
  away to get a unit direction and then used the unit vector for the LENGTH,
  so a sideways step laid a full-height vertical line straight down over his
  legs — photographed as a strap. Direction unit, length foreshortened.
- **THE MOVEMENT IS THE HERO, SO SOMETHING MUST BE ATTACHED TO IT.** v2 was
  launch FX at the origin, travel, and catch FX at the end: three separate
  effects in three places, which a handset reads as "several small FX around
  his feet". `_stepStreak` is two RIGID DASHED bars at shoulder and knee drawn
  every frame from the LIVE body back toward the launch point — attached to
  him, never longer than the ground covered (so it cannot become a ribbon),
  and gone ~70ms after the travel. With ONE broken echo (two cropped bands of
  his frame, waist missing, legs lagging) it is the Captain's answer to the
  dash: one hard mechanical signature, not seventeen growing ghosts.
- **THE STEP DOES NOT SPEND `def.color`.** `0x4fc3ff` sits close enough to the
  player's dash cyan to read as the same technology in peripheral vision.
  `ShockCaptain.STEP_FX` is cobalt / blue / white-blue peak / a grey deck
  spark, and the closeout suite fails a step method that names `def.color`.
- **A FILLED TRANSLUCENT WEDGE BESIDE A BODY IS A BUBBLE. A STROKED CHEVRON IS A
  DIRECTION.** 34x54 of blue at 0.5 alpha against his hip photographed as a mass
  he was wearing, and he already stands near round cyan fixtures. A chevron has
  no interior to be mistaken for volume and its vertex states a bearing on its
  own.
- **AN ADD-BLENDED `setTint` IS NOT A SILHOUETTE.** A multiply tint under ADD
  keeps only the pixels that were ALREADY BRIGHT, so a stamp of a dark armoured
  body comes out as a round luminous blob with no outline — measured twice on
  the step echo. `setTintFill` on the NORMAL blend paints the sprite's own alpha
  mask flat: the outline survives exactly and nothing glows. It is also what
  keeps the echo clear of the player dash, which is seventeen ADD ghosts GROWING
  1.2x into a continuous trail.
- **`_bootY()` IS 0.44 OF `displayHeight` AND IT IS DERIVED FROM THE SHEET.** The
  body is 28x30 at scale 4 with a CENTRED origin, so the bottom edge is exactly
  half the height below `y` and the boots are the last three of thirty rows —
  0.40 to 0.50 below centre. It was 0.30, which is mid-shin, and every effect
  claiming to touch the deck was drawn 12-24px clear of it. Measure the sheet;
  do not eyeball the offset. Related: **the heaviest beat must not be the
  faintest** — the catch's 40px brackets under a 112px body photographed as
  stray pixels, the same mistake the B.2.2 damage marks made at r=6. Scale
  against `def.radius`.
- **A BINARY FLIP INSIDE A BUILD-UP BEAT IS A MACHINE THAT DOES NOT BUILD UP.**
  The Arc Grenade device was two frames flipping at a third of `armMs` while the
  field around it energised in five staged beats. It is three now — INERT ->
  CHARGING -> ARMED, dim blue to white-blue — climbed IN STEP with the
  activation and **stepped back DOWN the same ladder at shutdown**, because a
  machine shutting down and an effect ending are different claims. Its four
  prongs are stalks with shoulders and 2x2 heads: a bare diagonal run of single
  pixels is a stair-step and reads as an artefact, not a fitting.
- **A MACHINE COMING ONLINE SPEAKS DISCRETELY: LAND, BLIP, SILENCE, BLIP,
  ARMED.** The three-frame ladder climbed once and HELD, and a handset called
  the landed device dead — a thing that did one thing and stopped. Inside the
  unchanged 520ms: land (u 0-0.08, contact sparks), BLIP 1 (0.08-0.17, the
  charging frame and a blue core cross), a PAUSE back to inert (0.17-0.30 —
  the silence is the point), BLIP 2 (0.30-0.40, the armed frame, a brighter
  white-blue cross and all four prongs firing), then armed while the nodes
  establish FROM it. **Never a smooth pulse** — a breathing glow is a beacon or
  a pickup. `contains()` reads `phase` alone, so none of it moves danger, and
  the perimeter still completes at 74%. Live, the source stays alive by
  CIRCULATION, not by a clock of its own: a prong fires as a packet crosses
  the diagonal node its sector faces, and the core ticks as one crosses due
  north (three ticks a lap). Derived from `_pktT`, so cause and effect cannot
  drift.
- **THE SOURCE'S LIGHT GOES ABOVE THE SOURCE.** The first blips were drawn into
  `edgeGfx` (hazard depth) under the device at 2002 — a 15px core flash on a
  60px opaque sprite, completely hidden by the object emitting it. Measured on
  the strip; it photographed as a frame change and nothing else. `coreGfx` at
  2003 carries everything the SOURCE says. Same trap as a console's light
  drawn under the console, in miniature. A destroyed grenade therefore takes
  FIVE Graphics and its device, and the closeout suite counts exactly six.
- **A FIELD THAT ONLY EVER FLICKERS IS A FIELD WITH A FAULT.** Everything moving
  in the live arc field was a SNAP. Three short bright arcs now travel the
  perimeter at a constant rate, derived from ONE phase at fixed offsets so they
  are evenly spaced by construction and carry no randomness at all — the one
  controlled thing in an effect whose every other motion is stochastic. They
  ride `this.radius` itself, so the one moving element on the boundary cannot
  misreport it. **ARCS, NOT DOTS**: a dot running a circle is a loading spinner,
  which is the UI read this field has already been pulled back from once.
- **INTENT IS A SECOND REGISTER, AND IT IS NOT A FIFTH REACTION.** The four
  grawlix glyphs say what HAPPENED TO HIM; `glyph-throw` says what he is ABOUT
  TO DO, and "FOUR, AND NO MORE" still governs the reaction half. Three things
  follow and none is cosmetic: it **does NOT go through `_punctuate`** (the
  queue works by making the second glyph WAIT, and `punctSpacingMs` behind an
  armour break would put the sign up after the grenade had already left); it is
  **held, then CUT** on the frame `_throwGrenade` makes the device real, never
  faded, because a fade describes a promise after it has been kept; and it
  **owns its own condition** — the `_tick` asks *am I still the commitment I was
  raised for?* rather than trusting a clear-on-every-exit-path list, so a
  stagger, a wall resolve or any future caller of `_enter` takes it down by
  construction. Same shape as `CameraDirector._bossFramable` refusing a
  cancelled handle. **IT IS NOT THE SPATIAL TELEGRAPH** — the thrown device, its
  shadow, the landing mark and the field own where; this owns only that.
- **VIOLET ABOVE THE HEAD = CHARACTER PUNCTUATION — `PUNCT_PALETTE`, a
  CANDIDATE doctrine.** The glyphs were bone because bone is the Captain's
  rank plate, which answered what they must not be confused with IN THE WORLD
  and never asked what they land NEXT TO: every frame that raises one prints
  `#ffffff` damage, `#ff8020` Super damage, `#ffe040` CRIT! and `#7fd4ff`
  armour hits in the same column. A handset lost them there. Violet is the
  one hue nothing near his head spends — red is telegraphs, green bullets,
  amber environment, blue-white his hardware, white/yellow/orange/pale blue
  numbers. **COLOUR IS THE REGISTER, SHAPE IS THE MEANING**: all five glyphs
  share `edge #230a3a / body #9a5cff / lit #dcc8ff` and keep their own forms.
  **Violet belongs above the head and NOWHERE ELSE on him** — the closeout
  suite walks his three body sheets, his rifle and the grenade device for any
  violet-family pixel, and greps his FX sources for the palette literals.
  **Do NOT generalise it yet**: no icons on ordinary enemies, none on Vader, no
  icon framework. The Captain is the first proven use; a second actor must
  earn the second. Vader's FORCE effects are violet ON THE FLOOR around him —
  position and shape separate the two, and they never share an encounter.
- **A GREP-BASED LAW MUST STRIP THE PROSE BEFORE IT READS THE CODE.** This
  codebase documents the shapes it removed and the negative references it must
  not copy BY NAME, so a check reading raw source finds the very literals it is
  asserting are gone and **fails on a correct build**. It fired immediately on
  the first run of `smoke-captain-closeout`. Comments out, then grep.
- **A SHUTDOWN LADDER IS DRIVEN, NOT OBSERVED.** The arc field's `warnMs` is
  520ms and this container drops under 6fps inside a full suite run, at which
  the whole beat is two frames and a correct build reports as a fading one —
  measured, as a flake that only appeared under `run-all`. `_integrity` is a
  pure function of `age`, so the beat is addressable: put the object at the
  instant and step it once. Same family as ticking `_clock` instead of sleeping.
- **AN EFFECT SPAWNED ON THE FRAME A BEAT BEGINS IS EMPTY FOR EXACTLY ONE
  FRAME.** `_reactFx` is ticked at the TOP of `preUpdate` and the state machine
  runs below it, so a Graphics created by the state tick is not DRAWN until the
  next frame. An evidence rig that pauses on the first qualifying frame
  photographs a Captain with no impulse behind him at all — the harness being
  wrong about a build that is right, and the same family as "a collision-time
  pose lands one frame after its effect". And **frame the ORIGIN, not the
  body**: every impulse effect is drawn where he pushed off while he travels
  away from it, so a camera on the moving actor walks the subject out of shot.
- **`spawnEnemyAt(type, x, y)` — TYPE FIRST.** Two evidence rigs called it
  `(x, y, type)`, which falls through to the default branch with a number for
  a type and spawns nothing that was asked for, silently. `shot-arcfield`'s
  §26 "crowd" frame had no crowd in it for a whole pass. Look for the enemies
  in the frame you claim contains them.
- **A BLIP IS SHORTER THAN A HARNESS FRAME, SO IT IS ADDRESSED, NOT CAUGHT.**
  Each blip is ~47-52ms against a ~12fps harness. `ArcGrenade._draw` is a pure
  function of `age`, so rigs PUT the object at the instant and step it once —
  the real drawing path, only the moment chosen. Same idiom as the shutdown
  ladder and the `_clock` drain.
- **ATTRIBUTE THE THING IN THE SCREENSHOT BEFORE REDESIGNING AGAINST IT.** A
  large soft cyan disc beside the stepping Captain looked exactly like the
  bubble the step pass existed to remove, and two rounds went into chasing it.
  Hiding every one of his `_reactFx` and re-shooting the same paused frame left
  it precisely where it was: **it is the objective terminal's own marker.** The
  A/B is one page.evaluate and it is cheaper than one wrong redesign.
- **THE FOUR-ARENA ENVIRONMENT PILOT IS COMPLETE AND ALL FOUR ROOMS ARE
  FROZEN 🔒.** Vader Chamber, Hangar, Reactor Junction and Detention Block each
  closed on human handset play; `HANDOVER.md` §10ab is the closeout and carries
  the doctrine that travels. The chamber was the pilot (§10n): three pieces —
  `drawArchitecture` (baked floor forms in `pixelArt.js`), the `'chamber'`
  perimeter style, and `src/systems/EnvLight.js`. **To see it: DEBUG → LOAD
  VADER CHAMBER → DEBUG → SPAWN VADER.** `SPAWN VADER` alone deliberately does
  not change rooms, and a fresh endless run does not reach the chamber until
  sector 5, so pressing it on its own shows Vader in the hangar. A FIFTH room
  inherits the RULES and none of the four compositions — that constraint is
  what made these four different rooms instead of one room four times.
- **ENVIRONMENT LIGHT LIVES OUTSIDE `roomLayer`, OR IT IS NOT LIGHT.** LIGHTS
  OUT multiplicatively tints that group; anything inside it gets multiplied
  toward black. That is why a screen baked into a console texture cannot stay
  lit through a blackout and why the old `_drawConsoleGlow` placeholder only
  existed in the dark. `EnvLight` is a separate set of ADD-blended Images at
  `ENV_LIGHT_DEPTH` (3) — above the floor decals, below the whole actor band, so
  it can never draw over a bullet, a telegraph or the saber. The readability
  gate is that depth constant, not taste.
- **AN EMISSIVE SOURCE HAS TWO INDEPENDENT INTENSITIES.** `normal` and
  `emergency`, lerped by the same scalar `_applyDarkMix` rides. A source that is
  `normal: 0` is DEAD while the room has power and only comes up when the bus
  drops — that is the whole difference between an authored second state and a
  dimmer, and `smoke-arena` fails if no source has the property.
- **A STACK OF HARD-EDGED SHAPES HAS EDGES, AND AT ENVIRONMENT SCALE THEY SHOW.**
  The saber's halo is six capsules with a ramped alpha and it works because the
  blade is small. The same construction at 150px is five visible rectangular
  bands, and a wall screen built that way photographed as a television in a box.
  `EnvLight`'s falloff is baked into two 128px textures instead; the box one is
  SEPARABLE (`alpha = f(x)·f(y)`) so it can stretch 8:1 without the corners going
  wrong. Consequence: `setPower` is N alpha writes and re-rasterises nothing.
- **BAKED FLOOR ART MAY NEVER DRAW A TALL SOLID MASS ON THE OPEN DECK.** The
  backdrop is one image and can never reach `this.walls`, so nav, LOS and bullet
  collision cannot see it — which is exactly why `drawArchitecture`'s vocabulary
  is all flat or recessed. A painted machinery block on the fighting floor would
  promise cover the room does not have. Machinery goes in the perimeter band,
  where the world bounds already are.
- **`LIGHTSOUT.floor`/`.wall`/`.prop`/`.console` ARE STILL THE HANDSET'S NUMBERS.**
  The pilot raised them so its architecture stayed legible in the dark, broke six
  `smoke-vader` checks doing it, and PUT THEM BACK. The maroon trap that
  originally pinned them is gone (the pilot deck has no red in it), so they are
  movable on a new verdict — but making architecture readable in the dark is
  precisely how emergency power becomes "the normal room, dimmer".
  `docs/evidence/arena-pilot/ambient-ab/` is the matched pair.
- **NO RED IN THE ENVIRONMENT.** The Vader chamber's floor used to carry four
  full-width CRIMSON strip lights at `stripEvery: 520`. Red belongs to the saber,
  the SABER THROW lane and the telegraphs, and the pilot deck spends none of it:
  screens cyan, cores and emergency strips amber, thresholds cool white, deck
  paint steel. The same rule killed a steel ring painted around the dais — a thin
  bright circle centred on the boss is the shape and placement of a circle
  telegraph whatever colour it is. `smoke-arena` channel-tests every authored
  source colour, and **AMBER IS NOT RED**: the first version of that check failed
  the emergency strips. The separator is how far green falls — amber holds it
  near two thirds of red, danger red drops it under a third.
- **A BIG ROUND PROP DEFAULTS TO A DIAL, AND A DIAL IS A UI WIDGET.** Concentric
  rings plus radial spokes is what a large circle becomes if you let it. The hero
  machine's circle is only the HOUSING; what sits in its well is a RECTILINEAR
  plant block. Its seams are five at irregular bearings, not six at 60° — an
  unbroken plate is what makes the broken ones read as joins. The same instinct
  produced the thing that was replaced: one big illustrative crescent across the
  lid, and a red bar over a red bar in the middle that read as a lowercase "i".
- **AN ARC ON A LARGE ROUND PROP MUST BE SEGMENTED.** One continuous lit arc
  fails twice: on the upper-left of a circle it IS the illustrative crescent, and
  a long unbroken arc on a big round object starts reading as a capture zone or a
  boss AoE. The hero machine is five short tubes over <40% of its circumference,
  at two colours, on opposite rims. Broken segments read as fixtures.
- **A LIGHT AT `ENV_LIGHT_DEPTH` IS INVISIBLE UNDER A LARGE OPAQUE PROP.** Depth
  3 is below the whole actor band, which is the readability gate — and it means a
  source on a 352x328 prop's face is drawn entirely underneath it. The `face`
  kind is the ONE exemption: an ADD texture painted in the prop's own space, at
  the prop's depth + 1, whose rectangle IS the prop's rectangle, so anything it
  could hide the prop hid first. `smoke-arena` measures that containment against
  the live sprite's bounds. Do not widen the exemption to a source that is not
  bolted to an opaque object.
- **`emitter: false` IS A SPILL WITH NO SOURCE, and it has exactly one honest
  use:** the source is somewhere this layer cannot draw — painted into a prop's
  face — and what belongs on the deck is only the light it throws. Left on, the
  strip's crisp `TEX_FLAT` bar photographs as a second bright OBJECT lying on the
  floor beside the machine rather than as its light.
- **A HERO PROP'S DARK STATE IS TWO TEXTURES, NOT ONE DIMMER.** `prop-pod-glow`
  runs at 0.55 normal / 1.0 emergency; `prop-pod-emer` is **0 at normal power**
  and 0.95 under emergency. That second texture is the whole difference between
  "the machine is still there, dimmer" and "fixtures that were not lit a second
  ago have come up". `smoke-arena` fails if no face is reserved for emergency.
- **A HOUSING LIT OVER HALF ITS AREA IS LIGHTER THAN THE DECK IT STANDS ON.** The
  first hero build filled the whole northern half with `chMachLit` and
  photographed as a pale grey donut — the opposite of a heavy object. The lit
  band is a CAP: twelve rows out of seventy. Related: a recess catches light on
  its SOUTH inner wall, because light comes from the north here; inverted, a hole
  reads as a dome.
- **THE HERO MACHINE'S FACES ARE PAINTED ON THE PROP'S OWN CANVAS** (88x82 at
  scale 4, same as `prop-pod`), so registration with it is structural rather than
  arithmetic. That costs ~924KB of mostly-transparent texture and it is the
  deliberate trade. Cropping them puts a hand-computed origin offset between a
  light and the object it belongs to.
- **A BIG SMOOTH PIXEL CIRCLE CANNOT BE SAID IN THIS GAME'S VOCABULARY.** CRIX
  is crisp horizontals, verticals, 45-degree cuts and layered plates; a large
  circle's edge lands somewhere different against the grid at every bearing, so
  its stair pattern has no period and it reads as a low-resolution
  approximation. The hero machine came back from handset review as "chunkier,
  softer, blurrier than the rest of the room" for exactly that reason. THE FIX
  IS SHAPE LANGUAGE, NOT FILTERING — a smoother or antialiased circle makes one
  unusually soft asset inside a deliberately pixelated game. Large round
  industrial objects get a FACETED ANGULAR HOUSING with SMALLER ROUNDED FORMS
  INSIDE. This is not a ban on circles: the hero's well is still a circle at
  r=25 and renders cleanly.
- **A FACET NEEDS ITS OWN VALUE, NOT ITS OWN RIM.** Varying only the one-pixel
  edge treatment per plane photographs as the same mushy ring it replaced. Fill
  each plane at a different tone — `PAL.chMachMid` exists for exactly this — and
  keep the LIT tone rationed to the one plane square to the light, or the
  housing comes out lighter than the deck it stands on.
- **FILL A FACETED SHAPE BY NEAREST FACET, AND WALK ANY FACET AT 3x THE PIXEL
  RATE.** Walking an edge and stepping inward along its normal leaves holes on
  every diagonal, and a one-step-per-pixel walk on a 2:1 edge rounds two steps
  onto one pixel — the plane bands, the fixture grooves and the mounting
  brackets each came out as a CHECKERBOARD, three separate times, from the same
  two mistakes. `facetPoly().nearest()` and `edge.steps` are the fix.
- **TWELVE MEANINGFUL PLANES BEAT SIXTEEN SMALL ONES.** A sixteen-facet hero
  housing was built, photographed at matched stations and rejected: at handset
  scale its extra planes are ~6px each, which is below the size at which a plane
  reads as a plane, so the silhouette drifts back toward the circle and takes
  the crispness with it. `docs/evidence/arena-pilot/hero-shape/`.
- **A CONSOLE ARCHETYPE MAY NOT CHANGE ITS FOOTPRINT.** Cover bodies are frozen
  at 70x70 under a 112x112 sprite and feed the nav grid, the LOS rects and
  bullet collision. The HEAVY console reads heavier through mass, value and
  density inside the same 28x28 canvas; a physically wider one would be art
  promising cover the room does not have. `smoke-arena` measures every kit
  texture against `bush`.
- **THE CONSOLE KIT IS OPT-IN BY NAME.** A cover entry may carry `tex` and a
  spec may carry `coverTex`; anything that says neither gets `bush`. The kit's
  textures are painted for every room — textures are global and cheap — and only
  a room that ASKS receives one. Same shape as the `emissives` opt-in, and the
  same reason: a shared painter that defaults to on is how one arena's language
  becomes four.
- **A CONSOLE'S LIGHT IS DERIVED FROM ITS ART, IN THE SPRITE'S OWN PIXELS.**
  `CONSOLE_KIT` in `src/data/consoleKit.js` declares each luminous region using
  the same numbers the painter used, and `loadRoom` converts them against the
  real placement. A hand-written screen coordinate is one edit away from glowing
  where a console used to be. Fault lamps are PAINTED PIXELS and never declared
  as light — a red LIGHT in the environment is a different claim from a red
  pixel of hardware.
- **NOT EVERY LAMP COMES ON IN A BLACKOUT.** Exactly one region in the console
  kit is dead at normal power and lit under emergency; nominal lamps do not get
  louder in the dark at all. A console must stay spatially identifiable without
  becoming bright scenery, and `smoke-arena` fails an `led` whose emergency
  figure exceeds its normal one.
- **A LARGE PROP OCCLUDES A COVER CONSOLE STANDING BEHIND IT.** Props sort at
  plain `y`, cover sorts at `y + 56`, so the hero machine at (340, 740) draws
  over the console at (440, 440). The heaviest console was moved to the
  south-west pillar for that reason. Positions are frozen — the thing that moves
  is WHICH TEXTURE stands on which frozen spot.
- **A CAMERA STATION IS A PLAYER POSITION AND NOTHING ELSE.** The game camera
  follows the player, so a `centerOn` in an evidence rig is overwritten by the
  follow on the very next update — a whole run can be spent photographing a
  camera that never moved. Solve for the player instead, and remember the camera
  CLAMPS at the arena bounds: anything at y=1240 in a 1600px arena lands at
  screen y 920, under the touch controls, whatever you ask for.
- **THERE ARE TWO STYLED ARENAS NOW, AND THE HANGAR IS THE PROOF THE FIRST ONE
  GENERALIZES.** `HANDOVER.md` §10q is the record. It reuses the RULES (large
  before medium before small, a calm centre, per-side perimeter jobs, emitter
  plus a spill shaped like its source, two independent intensities, contact
  shadows, no red) and reuses NONE of the composition. Corridor and Detention
  are still untouched and both smoke tests assert it. Do not propagate.
- **THE HANGAR'S LANDMARK IS PART OF THE WALL, ON PURPOSE.** A second
  freestanding hero machine would have proved the PROP generalizes, which
  nobody asked. The blast door is declared by the room
  (`perimeter.features: [{ side, at, width, kind }]`) and painted by
  `drawWallFeature` in the band's local space, inside the doorway clip. If the
  language only knows how to make one kind of landmark it is not a language.
- **THE HUD'S TOP BAR EATS THE FIRST ~20 WORLD PIXELS OF A NORTH WALL.** The
  game camera is inset by `HUDCFG.topBarHeight`, so world y 0 lands at screen 84
  only while the camera is at its northern clamp; one step south and the
  outermost edge of the band is under the bar. Anything a north-wall feature
  needs the player to SEE goes below its header, never on it.
- **A WALL-MOUNTED PROP MUST NOT SORT BY ITS Y.** Props Y-sort at plain `y`
  because y is their ground contact, and a control panel bolted to a wall has
  none — sorted that way it occludes actors hundreds of pixels away at the far
  edge of the room. `prop.depth` exists for exactly this; the wall panels use 6,
  above the floor decals and below every actor. And `emitter`/`reach` on a
  mounted panel has to clear the 112px SPRITE, or the light is drawn underneath
  the object and the panel reads as bright rather than as lighting anything.
- **A COVER OBJECT THAT DECLARES NO LIGHT IS NOT A CONSOLE.** Cover used to be
  tagged `_loClass = 'console'` unconditionally — the lightest LIGHTS OUT
  material — and the hangar's cargo crates survived a blackout as pale boxes
  brighter than the machinery. The tint is derived from `CONSOLE_KIT` now, not
  from a name list. `bush` carries no `tex` and stays a console, which is what
  keeps the unstyled arenas where they are. The objective terminal was in
  `roomLayer` with NO `_loClass` at all for its whole life; a null class falls
  into the generic strength silently.
- **A TRENCH AND A TRACK ARE DIFFERENT CLAIMS.** A trench is a hole with a grate
  over it; a track is two rails set flush into the deck with sleepers between.
  Both recessed, so neither lies about collision — but reusing the chamber's
  trench in the hangar would have been reusing its composition, which is the
  one thing the second arena was not allowed to do. Same for `region`: it seams
  its VERTICAL sides by default because the chamber's regions are all tall, and
  a wide region needs `edge: 'h'` or its boundary is drawn where nobody looks.
- **BASE THE FLOOR ON THE DECK VALUE, NOT ON A RECESS.** The hangar's first
  build used `hgRecess` as the base and every authored region read as a pale
  rectangle painted onto a dark one. With the deck as the ground value the
  apron lifts off it and the staging bay drops into it, which is what a region
  is supposed to do.
- **CARGO IS NOT ALLOWED TO OUT-SHOUT HARDWARE.** The first crate palette was
  '#39352b' / '#4a4436' and photographed as the brightest object in the room —
  warm enough to read as timber, louder than the lit terminals beside it.
  Freight sits ONE step above the deck. It also carries no emissive source at
  all, and that is deliberate: five of the hangar's eight cover objects going
  out is what keeps its dark state dark.
- **`prop-crane` AND `prop-drum` USED TO SPEND SATURATED RED ON DECORATION** —
  seven crimson hazard bars across the gantry beam and a 24x12 red label panel
  on each of three drums. Both are amber now. Both textures are hangar-only.
  The exit's `[ SEALED ]` bar stays red because it is gameplay UI.
- **RESEED THE RNG BEFORE EVERY BACKDROP WHEN HASHING TEXTURES.**
  `paintBackdrop` consumes `Math.random` for its panel and scorch scatter, so
  changing ONE room's `panels`/`scorch` counts shifts the stream for every
  backdrop painted after it. Seeding the LCG once per page made all four rooms'
  hashes move and read exactly like a visual pass leaking into three arenas it
  had never touched. Reseed per paint.
- **A LONG SHALLOW DIAGONAL NEEDS A CHOSEN CADENCE, OR IT CRAWLS.** The
  shuttle's wing edges were `outer = 10 + t * 1.15` rounded to a pixel, which
  steps one per row except at intervals that never repeat — measured off the
  shipped texture, the doubles fell on the 4th row, then the 7th, 7th, 6th,
  5th. A staircase whose rhythm changes every few pixels has no stable read and
  the edge appears to wobble as the camera pans. THE FIX IS SHAPE LANGUAGE, NOT
  FILTERING: antialiasing, `roundPixels` or a higher-resolution asset would put
  one unusually smooth object inside a deliberately pixelated game. Every edge
  is a section at a constant integer cadence (1:1, 2:1, 3:1 or vertical), and
  `smoke-hangar` counts SPIKES — a row that disagrees with both its neighbours
  while they agree with each other — which was 11 on the shipped craft and must
  be 0. This did not matter until the room around it was rebuilt out of
  horizontals, verticals and 45-degree cuts.
- **MORE FACETS IS NOT MORE CRISPNESS, ON ANY SHAPE.** A six-facet shuttle wing
  was built and rejected against a four-facet one: splitting the leading sweep
  puts a kink halfway along the longest edge on the craft, and at handset scale
  the pieces re-read as one bowed line. Same verdict as the sixteen-facet hero
  housing. `docs/evidence/arena-pilot/shuttle-candB/`.
- **A ONE-PIXEL-PER-ROW OUTLINE ON A 2:1 EDGE IS A DOTTED LINE.** The outer x
  jumps two pixels a row, so a single `px(span + 1, y)` leaves gaps — and a
  dotted diagonal is the single most pixel-crawly thing that can be put on
  screen. Dilate the outline from the silhouette instead: every empty pixel
  touching the shape is edge, and no facet has to know which one it is on.
- **A LARGE IDENTITY PROP NEEDS A SECOND STATE WHEN LOSING IT ERASES THE ROOM.**
  The shuttle was a flat black hole during LIGHTS OUT and the hangar's other
  landmark, the blast door, is off screen from half the room. It carries two ADD
  faces now on the hero machine's contract — but for the opposite reason, and
  this is a rule about AUTHORED STATE, not a template: not every prop, and
  certainly not every spacecraft, gets running lights. **Do NOT outline the
  craft.** Four running lights at the corners plus a canopy is the whole set; a
  lit wing perimeter flattens it into a gameplay marker and deletes the dark.
- **A PROP'S EMISSIVE FACE MUST BE CLIPPED TO THE PROP'S SILHOUETTE.** The face
  rectangle is the prop rectangle, which is what `smoke-arena` measures — but
  the honest claim is tighter: hull contamination has to stop at the hull, or it
  is a halo on the deck. `destination-in` composites the WHOLE canvas against
  the source of a SINGLE operation, so a mask drawn as one `fillRect` per row
  erases everything except the last row. One `beginPath`, N `rect`s, one `fill`.
- **AN ASSET BORROWING A PALETTE FAMILY BORROWS ITS TOP END.** The shuttle used
  `imp*`, which reaches `#7a7c80`; a 400x360 object painted from it is lighter
  than the `#212328` deck it stands on. Its ladder is placed relative to the
  deck now — fuselage one step above, wings one step below, trim rationed to a
  few pixels. Same family as the hero housing's pale-donut round.
- **THE REACTOR JUNCTION IS HUMAN-APPROVED AND FROZEN 🔒.** Handset play closed
  it on `68a76c4`: topology, crossing, feeder connectivity, enemy flow, Vader
  navigation, the `junction` perimeter, the conduit language, normal-power
  composition, the eight emergency lane fixtures with their intensities and the
  no-crossing rule, and the reactor's amber face and deck spill. `HANDOVER.md`
  `§10w` is the record. The rules below are how the room works, not an
  invitation to tune it, and **a full reactor migration is deferred
  indefinitely** — the human approved the silhouette. Nothing moves without NEW
  human play evidence.
- **NAVGRID CLEARANCE CAN DISAGREE WITH PHYSICAL CLEARANCE, AND THAT IS ENGINE
  DEBT WE ARE CARRYING ON PURPOSE.** `NavGrid.build` inflates a body rect by a
  fixed 23px agent clearance, which fits the Ø40-48 rank and file and routes a
  Ø112 boss through slots he cannot enter: pathing says yes, physics says no.
  The junction was corrected through LEVEL TOPOLOGY and NavGrid was not touched.
  Do not touch it in an art pass. Remember it when designing a tight space —
  measure the LARGEST body.
- **THE ROOM WHOSE ID IS `corridor` IS NOT A CORRIDOR.** It is REACTOR
  JUNCTION, 1400x1400, the only SQUARE arena in the game and the smallest —
  not narrower than either approved room. The objective is dead centre, three
  gates feed it from three different walls and the exit is on a fourth. Both
  approved arenas are AXIAL, where composition and direction are the same
  decision; a square room with a held centre offers neither. A brief written
  for a narrow hallway cannot be executed here without lying about the space,
  and `bounds`/`spawn`/`exit`/`gates`/cover are frozen. The corridor grammar
  goes in the WALLS and the four approaches instead. **To see it: DEBUG → LOAD
  REACTOR JUNCTION**, then DEBUG → SPAWN VADER (which deliberately keeps the
  current room). Without that button it is the SECOND room of an endless run —
  `_arenaCycle` starts at 1, so the rotation is hangar → junction → detention —
  which costs a full hangar clear to reach and three more rooms to re-enter.
- **A LANDMARK'S PLACEMENT IS A VIEWPORT PROBLEM BEFORE IT IS A COMPOSITION
  PROBLEM.** The game camera is inset by `HUDCFG.topBarHeight` and the touch
  controls cover the bottom ~200px, so the unobstructed band is roughly
  `camTop .. camTop + 896`. In the 1400-tall junction the camera's centre is
  pinned inside y [598, 802], which puts **world y beyond about 1100 behind the
  joysticks from every position the player can reach.** The interchange and a
  1040px conduit spine were both built on the south wall first and were
  invisible in play — they only photographed because an evidence rig can park
  the player at the clamp. Side walls have no such problem: the controls sit
  LOW, not WIDE.
- **APPROACHES DROP, THE JUNCTION LIFTS — but a recess laid on too thickly is a
  HOLE.** `recess` at alpha 0.8 over the junction deck lands near `#151b22`,
  and a near-black rectangle in a top-down game does not read as a floor one
  step down. It reads as a pit, which is the one lie a room may not tell about
  where the player can walk. 0.62 is a step; 0.8 was a void.
- **A PIPE LYING IN A RECESS MAY NOT BE LIGHTER THAN THE DECK ABOVE IT.** The
  `conduit`'s first crown was `#454f5a` against a `#242b31` deck and every run
  photographed as a raised girder lying ON the floor. Body under the deck
  value, only the narrow crown just above it — and the collars go one step over
  the PIPE, not over the deck, or every joint reads as a bracket bolted on top.
  Same family as the shuttle borrowing the `imp*` top end.
- **A `rib` AT FULL STRENGTH IS AN OBJECT.** It draws a near-black surround
  under its face, and that outline is what makes it read as something standing
  on the deck rather than as a change in the floor. Four threshold ribs at full
  value photographed as four bright posts across the approaches. `alpha` fades
  the surround along with the face; 0.5 turned them back into lips.
- **A CONDUIT UP THE MIDDLE OF AN APPROACH IS A MAST POINTING AT THE FIGHT.**
  Centred in the north way it was a bright vertical axis aimed straight down at
  the objective from the top of the frame. Held against one edge of the way it
  is what plumbing in a passage actually looks like and the way stays open.
- **THREE RECESSED FLOOR PRIMITIVES, AND THEY ARE DIFFERENT CLAIMS.** A
  `trench` is a hole with a grate (chamber), a `track` is rails with sleepers
  (hangar), a `conduit` is a large-bore pipe in a bed with flanged collars
  (junction). Reusing one is reusing a room's composition, which is the single
  thing each arena pass is not allowed to do. A conduit's cross-section is FOUR
  HARD BANDS, never a gradient — a smooth ramp of value is the one thing this
  game's surface vocabulary does not contain.
- **A COVER OBJECT'S POWER IS A COMPOSITION DECISION, NOT A NAMING ONE.** The
  junction's eight frozen cover spots used to be eight identical `bush`
  consoles in a perfect ring, all of which took the `console` tint and survived
  a blackout as eight equally pale boxes. `rj-cab-*` is a third archetype that
  declares nothing in `CONSOLE_KIT` and therefore takes the `prop` tint and
  goes out. Five of eight unpowered is what keeps the dark state dark — the
  same ratio as the hangar's crates.
- **THE FACE EXEMPTION IS NOT A TEMPLATE, AND IT HAS TWO ADMITTING RULES.** The
  shuttle carries two ADD faces because losing it erased the hangar's identity.
  That was read for a while as the ONLY rule, and `smoke-junction` asserted the
  junction carried zero faces on the strength of it — this room's dark identity
  is its architecture, so no prop qualified. Handset play found the hole. The
  second rule is **IF IT LOOKS LIKE AN EMITTER, IT MUST EMIT**: `prop-core`
  paints a stack of amber slats behind a grille, which is a claim that the
  machine is running, and LIGHTS OUT multiplies that claim toward black with the
  rest of `roomLayer`. The junction now carries EXACTLY ONE face, on that one
  prop, and `smoke-junction` pins the count at one in both directions — zero is
  the lie coming back, two is the hero machine's composition being copied.
  Neither rule licenses a face on a prop whose art claims nothing.
- **A LIGHT ON A LARGE PROP IS A LIGHT UNDER IT — AND CHECK WHERE IT ACTUALLY
  IS.** The depth trap is already above; the junction's reactor added a second
  half to it. Its only source was a radial `core` at (260, 352) while the lit
  slot it was supposed to be is at world y **168..272** — 130px away, down at
  the base skirt, under a 304x344 sprite, at a depth below it. Emitter invisible,
  falloff invisible except for a 25px tail that is the near-zero end of the
  gradient. It had been that way since the room was authored and no test could
  see it, because every check asked whether a source EXISTED. Ask where its
  light lands, in pixels: `tests/diag-junction-reactor-light.mjs`.
- **`stripEvery` AND A `ring` FLOOR MARK ARE BOTH LOADED GUNS.** The junction
  shipped with NINE full-width saturated orange-red bars at `stripEvery: 150`
  and TWO concentric amber rings at r=250/300 centred exactly on the objective
  — a circle telegraph's shape, size and placement, on the square metre where
  the boss fight resolves. `smoke-junction` fails on either coming back.
- **THE JUNCTION'S EIGHT-COVER RING IS GONE, AND NOT BECAUSE IT LOOKED BAD.**
  Handset play approved the art pass (`HANDOVER.md` 10s) and rejected the
  topology it had preserved. All eight cover bodies sat inside the room's own
  authored 600x600 crossing; the tightest neighbour gaps were 90px against a
  Ø112 boss; only 47% of the crossing admitted him; and Vader closed on the
  player on **2 of 8** legs, spending 43-46% of frames in bodily contact with
  geometry on every feeder approach. The replacement rule is relational, not
  positional — **no solid body in the crossing, 160px minimum between any two
  solid bodies** — and `smoke-junction` asserts it that way on purpose:
  freezing coordinates is exactly what protected the bad layout. `10t` is the
  record.
- **A LAYOUT CAN BE BROKEN FOR EXACTLY ONE ACTOR SIZE.** The junction's ordinary
  enemies are Ø40-48 and fitted the 90px gaps, so the wave-flow probe barely
  discriminated between the ring and its replacement — detour and arrival times
  moved by noise. `NavGrid.build` tests a cell CENTRE against a body rect
  inflated by 23px, so it happily routed them through slots the boss cannot
  physically enter: **pathing said yes and physics said no.** Measure the
  LARGEST body before concluding a room paths well.
- **160px IS THE JUNCTION'S LANE, AND IT IS DERIVED.** Ø112 (`BOSS.radius` 56,
  doubled) plus `NavGrid`'s own 23px agent clearance on each side, rounded to
  two nav cells so a qualifying gap always contains a fully walkable cell. On
  the 80px lattice that means any two cover objects must differ by 240px in x
  or in y. Do not invent a pixel number here; re-derive it if a body changes.
- **A RING TEST MUST TEST BEARING, NOT JUST RADIUS.** The first not-a-ring check
  asked for a 0.2 radius spread and the eight-cover ring PASSED it at 0.201 —
  its pieces sit 254-311px out, which clears a lazy threshold. The discriminator
  is the widest gap between two cover BEARINGS: 55 degrees for the ring against
  146 for what shipped. A check that passes on the bug is decoration.
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
- **DETENTION IS 1600x1400 AND ITS LONG AXIS IS THE ONLY ONE THE VIEWPORT CAN
  SHOW.** Spawn on the west edge, exit dead level with it on the east, two
  objectives pulled off that line, four gates with TWO of them on the east wall
  behind the way out, and `walls` completely EMPTY. The camera centre pins
  inside x [360, 1240] and y [598, 802], so the full WIDTH is reachable — the
  only arena where that is true — while world y beyond ~1100 is behind the
  joysticks and the SOUTH band is effectively never in frame. Its plan is a
  WALK, not a warren of cells, and the fiction follows the geometry: the frozen
  open middle is the escort floor you are meant to be visible while crossing.
  `HANDOVER.md` §10x. **To see it: DEBUG -> LOAD DETENTION BLOCK** — it is the
  LAST room of the rotation and costs two full clears otherwise. **DETENTION IS
  HUMAN-APPROVED AND FROZEN 🔒** — closed on `e43cc60` after four rounds of
  handset play: topology, traversal, cover, normal power, the cell/perimeter
  language, the processing gate, containment lighting, the haze, the floor
  reflections, the console emissive faces, the powered/unpowered asymmetry, the
  LIGHTS OUT composition and combat readability. `§10x`-`§10aa` are how it got
  there and `§10ab` is the freeze; the rules below are how the room works, not
  an invitation to tune it.
- **THE `block` PERIMETER'S SIGNATURE IS THE BAR, AND ITS PERIOD IS 176.**
  Nothing else in CRIX draws slats across an opening — a chamber bay lands on
  the deck, a junction bay crosses above it, a cell front CLOSES one. The
  period is the tightest in the game because containment repeats at the width
  of one person (chamber 320, hangar 400, junction 260). Three modules —
  cell / service / secure — run `cell cell cell service` with exactly one
  secure leaf per long wall, whose interlock bolt is HORIZONTAL when every
  other bar is vertical, so the bolted cell reads from the pattern before any
  light is involved. Occupancy varies by a fixed HASH of the bay index, never
  by `Math.random`: a backdrop is repainted on every room load, and an
  occupancy that reshuffled would make the block a different place each time.
- **GREEN IS BULLET COLOUR, AND IN A DARK ROOM THAT MATTERS.** The no-red rule
  is three arenas old; this one is newer and narrower. Enemy bullets are green,
  so a scatter of small green environment points along both walls during LIGHTS
  OUT is incoming fire that is not there. Detention's containment lamps are
  cold white-blue and its two emergency systems are amber. `smoke-detention`
  channel-tests both ends of every source colour.
- **A LAMP ON EVERY REPEATED MODULE IS AN OUTLINE OF THE PLAYABLE SPACE.** Two
  parallel dotted lines of lock lamps down detention's long walls is a corridor
  drawn in light, which is the giant-emergency-outline failure wearing a new
  costume. Five lamps north and three south, at irregular gaps, keyed to the
  same occupancy the wall painter draws: a handful of doors that still have
  someone behind them, not a run of them.
- **THE FLOOR IS NOT GLOWING, THE FLOOR IS CATCHING — and `emitter: false` is
  what makes that structural.** Detention's first dark state forbade every
  emitter and every pixel of spill on the escort floor, and the handset verdict
  was *too black and visually empty*: at the room's middle the camera shows
  y [102, 1298], which puts the north bank above the frame and the south bank
  behind the joysticks, so the rule kept every fixture out of the picture the
  fight happens in. What answers that is RECEIVED light — fourteen sources
  carrying `emitter: false`, each one an existing fixture's spill landing on a
  surface (SOURCE -> SURFACE -> FALLOFF), drawing a soft box and no `TEX_FLAT`
  bar. No hard edge means nothing can read as a painted mark; a lit bar lying
  on the deck is the full-width cyan strips this room was built to remove. The
  centre of the walk still receives nothing, and the width of that centre is
  DERIVED: x [720, 880] is the junction's 160px lane. `HANDOVER.md` §10y, and
  `smoke-detention` measures the emergency light budget inside the centre
  station's own view — 0.003 on the rejected build, 0.084 now.
- **A CONSOLE'S LIGHT WAS DRAWN UNDERNEATH THE CONSOLE, AND THAT IS THE
  GENERAL SHAPE OF THE BUG.** `EnvLight` draws every source at
  `ENV_LIGHT_DEPTH` (3) because that is the readability gate; a cover console
  sorts at `y + 56` under a 112px OPAQUE sprite. So a `screen`'s crisp emitter
  bar and the inner half of its wash are drawn under the object they belong to
  and only the ring of spill that clears the sprite's edge is ever on screen —
  which photographs as *a dark box with an LED strip installed behind it*, the
  handset's own words for a construction that was exactly that. **IF A THING
  VISUALLY CLAIMS TO CONTAIN A POWERED DISPLAY, THE DISPLAY ITSELF MUST EMIT
  BEFORE ITS HAZE OR ITS FLOOR SPILL CAN BE BELIEVABLE — the source has to be
  brighter than the evidence of the source.** The fix is the `face` kind, on
  the junction reactor's admitting rule (IF IT LOOKS LIKE AN EMITTER, IT MUST
  EMIT): an ADD texture painted on the object's OWN canvas so registration is
  structural, at its depth + 1, containing only the pixels the art already
  paints as powered — the chassis, bezel, keys and base are painted by neither
  pass and stay dark, which is what keeps a display embedded instead of pasted
  on. Declared per PLACEMENT (`cover[].faces`), never per archetype: two of
  detention's three are shared consoles standing in three approved arenas. And
  no test caught it for the kit's whole life, because every check asked whether
  a source EXISTED — **ask where its light LANDS, in pixels.** `HANDOVER.md`
  §10aa.
- **A HAZE AND A REFLECTION ARE DIFFERENT SHAPES, AND `EnvLight`'s KINDS COULD
  ONLY MAKE ONE OF THEM.** A `strip`'s spill is `len + reach` by
  `t + reach * 2.6` — its softness inflates BOTH axes, so a wide soft catch is
  necessarily a tall one. Detention's fourteen catches therefore landed as
  light in the AIR over the deck and came back from the handset as *the hazes
  are cool, but the floor still feels dead*. No intensity would have fixed it.
  A surface reflection is FLAT: long on one axis, shallow on the other, low in
  opacity, lying on the plane — the ASPECT RATIO IS THE MATERIAL CLAIM. The
  `floor` kind is the only one that states its own footprint (`w`/`h`/`angle`)
  instead of deriving it, and it never carries an emitter because the case has
  no `TEX_FLAT` branch. `HANDOVER.md` §10z.
- **HEIGHT IS WHAT MAKES A SOFT SHAPE VOLUMETRIC — a narrow tall one is a
  SHAFT OF FOG.** The first floor reflections were thrown 46x196 away from the
  wall that cast them, which is the intuitive direction and photographed as
  fog standing in the room: the haze failure in a narrower costume. 7:1 and
  shallow lies down. And CANT them a few degrees off the wall — level with it,
  two short bands parallel to a room's long axis are a lane in embryo.
  `smoke-detention` holds it generally: at least 3.2:1, no two sharing a
  footprint, none over 420px.
- **AN `led` MAY NEVER BE LOUDER UNDER EMERGENCY THAN AT NORMAL POWER, AND A
  FIXTURE THAT NEEDS TO BE IS NOT AN `led`.** A nominal lamp says the same
  thing whether anyone is watching or not. An interlock that ENGAGES when the
  bus drops is a `strip` at `normal: 0` — shaped like the bolt it belongs to,
  which is also what tells it apart from a lamp on sight.
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
- **`_clearRoomEntities` USED TO LEAK ONE OBJECT PER ROOM LOAD — FIXED in
  `b339c1f`, and the shape of the bug is worth keeping.** It sweeps with
  `roomLayer.getChildren().forEach((o) => o.destroy())`; `getChildren()` hands
  back the group's internal array and `destroy()` splices the member out of it,
  so the loop **skips every other element**. Measured at exactly +1 display-list
  object per load on every build tested, and the survivor is visible in play —
  a hangar wall console standing in the detention block at (148, 106). The
  enemy sweep two lines above already uses `.slice()`; both sweeps do now. The
  same shape is a live hazard anywhere a Phaser Group is destroyed in place —
  snapshot with `.slice()` before iterating. `tests/diag-room-leak.mjs` asserts
  a fixed point across three room rotations. `HANDOVER.md` §10y.
- **THE `chamber` PERIMETER HAS FOUR JOBS, ONE PER SIDE.** north ceremonial (no
  ribs, no vents — that wall is behind Vader), west service (densest, the hero
  machine's side), east control (machinery block on alternate bays only), south
  threshold. Plus a phase offset per side (0/124/208/62) so no two adjacent walls
  resolve their rhythm at the same distance from a corner. It is ONE bay
  vocabulary at four densities, not four hand-built walls — four hand-built walls
  is four rooms inside one room.

## Testing

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

## Background processes

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

## Conventions

- Vanilla JS ES modules, Phaser 3.90 + Vite. No TypeScript.
- Pixel art is generated programmatically in `src/systems/pixelArt.js` via
  `PixelCanvas` / `SpriteSheet`; palette lives in `PAL`. No image assets for sprites.
- Config-driven design: prefer adding data to registries (`WEAPONS`, `UPGRADES`,
  `MODIFIERS`, `ENEMY`) over branching in scene code.
- Staged commits: one logical change per commit, built and smoke-tested before commit.
