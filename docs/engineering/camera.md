# Camera — reference

**Status: HUMAN-APPROVED / FROZEN 🔒** after six handset-closed passes (1, 2A,
2B, 2C, 3A.1, 3A.2). `HANDOVER.md` §21 is the authoritative final state; §12–§20
are how it got there. Every value in `CAMERA` (`src/config.js`) is a handset
verdict. Attack-specific camera work ("Phase 3B") is not started and reopens only
on new human evidence of a framing failure.

## Invariants

- `CameraDirector` (`src/systems/CameraDirector.js`) is the only author of
  scroll; nothing calls `startFollow`, `setFollowOffset` or
  `cameras.main.setBounds`. Camera bounds are not collision bounds —
  `physics.world.setBounds` stays exactly the room.
- Semantic model: movement = where my body is going; ordinary fire = where the
  fight is (never the nearest enemy); an explicit ability = where I am committing
  (crossfade, outranks movement, reads the telegraph's own vector); passive
  **gaze** = who the quiet encounter is about; **guardrail** = preserve the
  player–Vader relationship when the frame would lose him. Gaze and guardrail
  are two terms with two filters, caps and gate sets — never merge them.
- The boss need is measured against the player-intent focus, never the achieved
  scroll (that is the anti-oscillation guarantee).
- Only `scene.boss` is Vader for camera purposes; `_bossFramable` reads the
  move's `bodyAuthoritative` claim and ignores cancelled/done handles.
- X and Y are deliberately asymmetric; `leadY` is 0 by construction (south
  safe-area guarantee). The south padding is derived from the live control
  layout, never a literal.
- Runtime tuning from a rig goes through `director.cfg`; a dynamic
  `import('/src/config.js')` in `page.evaluate` is a second module instance.

---

## Trap ledger

Entries under the headings below were migrated from the root `CLAUDE.md` as it stood at `7d67bed` (`git show 7d67bed:CLAUDE.md`), keeping their wording. Anything since superseded carries a **Status (2026-11-02)** note rather than being silently rewritten.

### How it works and how it breaks

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
