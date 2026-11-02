# Vader — reference

**Status: HUMAN-APPROVED / FROZEN 🔒** (handset close on `83dee24`; DEFLECTION and
saber ownership on `6b98bbc`). The ladder, hp, damage, move composition,
DEFLECTION, the returned super, SUPPRESSION, VANISH, LIGHTS OUT's cadence and
state ownership, the dark-arena material state, Afterimages/ECLIPSE and the
saber emissive treatment are all closed. FORCE PULL + DEFLECTION is a deliberate,
approved combination — do not add an exclusion rule. Do not re-derive his hp
from bot fight duration (the bot is a relative instrument, never an absolute).

**Status (2026-11-02):** the earlier note that the arena's emissive second state
was unfinished (`LIGHTSOUT.consoleGlowAlpha` as a placeholder) is superseded —
that key was removed from `src/config.js` and all four arenas carry authored
emissive states through `EnvLight` (see `environment.md`).

## Invariants

- **455 is the returned super's damage; 620 is only the ceiling.**
  `min(superReturnBase 180 + superReturnPerPellet 55 × pellets, 620)` with five
  pellets. `smoke-vader` derives it from config.
- **One saber, one exclusive claimant.** `_saberOwner` (claim on COMMIT via
  `claimSaber`, release on physical ARRIVAL via `releaseSaber`) is the truth;
  `_saberAway` is only where the sprite is. A move needing the blade declares
  `needsSaber: true`. No pairwise `if (activeMove === …)` exclusions.
- **The weapon block in `Boss.preUpdate` is the only writer of the saber**;
  `parry()` / `absorbSuper()` only set flags.
- **DEFLECTION is a stance**: while `isGuarding()` no move or attack may START;
  cooldowns keep running. Super pellets are CAUGHT (`absorbSuper`), never batted
  back; one bounded orb returns at `PLAYER.superSpeed`, constant, no homing.
- **Darkness has one owner**: everything goes through
  `GameScene.requestLightsOut(source)`. LIGHTS OUT tints `roomLayer` only;
  combat is outside it by construction.
- **Damage does not scale with the encounter**; the ladder is
  `ENDLESS.bossLadder` via `bossMechanicsFor(n)`, and `bossMovesFor` is not part
  of it.
- `_castBossMove` ids are lowercase and it refuses silently (another attack owns
  the actor, guard up, or `player.alive` false) — assert every cast.

---

## Trap ledger

Entries under the headings below were migrated from the root `CLAUDE.md` as it stood at `7d67bed` (`git show 7d67bed:CLAUDE.md`), keeping their wording. Anything since superseded carries a **Status (2026-11-02)** note rather than being silently rewritten.

### Moves

- **VANISH leaves a tween writing the weapon sprite after it ends.** `spin()`
  in `actorMotion.js` tweens `weaponSprite.rotation` for `actMs` and keeps
  writing it once the move is over, which is a second author for a number the
  weapon block in `Boss.preUpdate` owns. It cannot currently collide with
  anything — `isGuarding()` stops VANISH starting during a stance or a throw —
  so it is a NOTED LANDMINE and was deliberately left alone. It has already
  cost one debugging round in the harness; `tests/README.md` has the write-up
  and the `killTweensOf` rig fix.

### DEFLECTION, the caught super and the saber

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

### Ladder, hp and mechanics

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

### LIGHTS OUT and darkness

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

  > **Status (2026-11-02): SUPERSEDED.** The environment pass removed
  > `consoleGlowAlpha` / `consoleGlowColor` / `consoleGlowRadius` and
  > `GameScene._drawConsoleGlow` (`src/config.js` records why); all four arenas
  > now carry authored emergency states through `EnvLight`. Kept as history.

- **TWO DARKNESS GRADIENTS, AND THE MODE ARGUMENT PICKS ONE.**
  `set-darkness true` with no mode is the persistent DARKNESS room modifier,
  whose vignette darkens the centre 200px of the screen — where the fight is —
  by EXACTLY 0%. Vader's LIGHTS OUT must pass `'blackout'`. Dropping the mode is
  silent and puts the banner back over an unchanged playfield, which is what
  shipped. The blackout pocket also TRACKS THE PLAYER, because the game camera
  clamps at the arena bounds and a screen-locked pocket strands them up to ~270px
  horizontally and ~508px vertically outside their own sight radius.

  > **Status (2026-11-02):** the camera no longer clamps at the arena bounds —
  > `CameraDirector` frames past the room edge. The pocket still tracks the
  > player, which is correct regardless; the stated cause is historical.
