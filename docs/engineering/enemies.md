# Ordinary enemies, roster art and tactical AI — reference

## Status (verify against `HANDOVER.md` §0 before acting)

| system | status | flag |
|---|---|---|
| Five-role roster visuals (Gunner, Rifleman, Marksman, Bulwark, Demolisher; Regular + Elite) | HUMAN-APPROVED / FROZEN | `?roster=v1` (opt-in) |
| Movement v2.2, gait v2 | HUMAN-APPROVED / FROZEN | `?move=v22`, `?gait=v2` (opt-in) |
| Bulwark stuck recovery, candidate B (`f8ea738`) | HUMAN-APPROVED / FROZEN | `?bulwarkStuck=early` (opt-in); `=prog` kept for comparison only |
| Marksman stuck recovery A / B | **NOT approved** (3C's gameplay result was rejected) | `?marksmanStuck=prog\|early` |
| Marksman T1 tactical engagement (`0b772cf`) | HUMAN-APPROVED / FROZEN | `?marksmanAngle=1` (opt-in) |
| Free-Bulwark T2 tactical engagement (`37135c9`) | HUMAN-APPROVED / FROZEN | `?bulwarkAngle=1` (opt-in) |
| Shared stuck-detection correction for other roles | audit done, correction NOT authorized | — |

None of these flags is a production default; making one default is a separate
human decision. Neither T1 nor T2 gameplay may change — not a parameter — without
new human authorization.

## Invariants

- **`src/entities/Enemy.js` is frozen.** `tests/enemy-frozen.mjs` pins every
  class outside `EnemyBomber` to `3ce5680` (the Demolisher false-stuck veto is the
  one authorized change). New behaviour is a SEAM module installed per actor from
  `GameScene.spawnEnemyAt` in this order: `installBulwarkStuck`,
  `installBulwarkAngle` (free Bulwark only: `!legacyArt && !vanguardScreen`),
  `installMarksmanStuck`, `installMarksmanAngle`. Nemesis (`legacyArt`) never gets
  a seam.
- **No flag means the frozen game, tick for tick.** Any change must prove
  flag-off identity against the previous build with the seeded replays.
- **`firingSpot.js` is shared and frozen with T1** — any change must prove the
  Marksman's reference scenarios byte-equivalent.
- **T2 never writes the shield, gun or cooldown** (`_shieldFacing`, `_aim`, turn
  rate 2.6, `fireCd`), which is what keeps a Bulwark flankable.
- **Gameplay RNG isolation.** `Math.random` feeds AI cooldowns; suppressing or
  adding an emission, overlay or filming camera shifts every later draw. Parity
  twins (`__blwParity`) and `_threatScale` exist for this.
- **Read intent from the AI's own calls and real displacement**, never from one
  frame's `body.velocity` (stop-and-go input, zeroed holds).
- Blind holding is not stuck: measure "waiting" as blind standing (still, no LOS,
  not charging), not as stuck sidesteps.

---

## Trap ledger

Entries under the headings below were migrated from the root `CLAUDE.md` as it stood at `7d67bed` (`git show 7d67bed:CLAUDE.md`), keeping their wording. Anything since superseded carries a **Status (2026-11-02)** note rather than being silently rewritten.

### Bulwark visuals and field (Phase 2C)

- **THE BULWARK IS HUMAN-APPROVED / FROZEN 🔒 — PHASE 2C CLOSED on
  `cd4b0e9` ("Playtest pass all three").** Body, sidearm, gait, field material
  and layering, absorption (envelope and rapid waves at their CURRENT strength),
  the Super tear and the display facing are all closed; the notes below are how
  it works and how it breaks, not an invitation to tune. No ripple, facing or
  performance revision without NEW handset evidence. `HANDOVER.md` §0.

- **THE BULWARK FIELD IS A RENDERER ON FROZEN SEAMS, AND `Enemy.js` IS NOT
  TOUCHED.** `systems/bulwarkCurtain.js` reads
  `_shieldFacing`, `_shieldHalfArc` and the contact `GameScene` projects onto
  the curtain AFTER the block is decided, and writes nothing back. The legacy
  arc is still drawn every frame by the frozen class and merely hidden
  (`shieldArc.setVisible(false)`). If a Bulwark change seems to need
  `Enemy.js`, stop: `smoke-roster-2b` pins every class outside `EnemyBomber`
  to `3ce5680` (`tests/enemy-frozen.mjs`; the Demolisher's veto is the one
  authorized change in the file).

- **SUPPRESSING A PARTICLE EMISSION CHANGES THE FIGHT.** The legacy block
  sparkle (`fx.healingSparkle(x, y, 6)`) draws from `Math.random`, the same
  stream the AI cooldowns use; skipping it under v1 shifted every random
  number after the first block — measured, the seeded VANGUARD replay
  diverged at checkpoint 20 and lost a shot. The v1 path emits the IDENTICAL
  emission into an invisible twin built from the live emitter's `config`
  (`__blwParity`). Any future "one author" suppression of an RNG-consuming
  effect needs the same parity, and `smoke-bulwark` counts the draws.

- **A V1 ELITE'S DEATH IS NOT THE LEGACY DEATH UNLESS IT SAYS SO.** The kill
  juice (`enemy-died`) sizes its particle burst by `_baseScale`, and a v1
  elite renders at 1.0 against legacy 1.4 — fewer particles, fewer random
  draws, a different fight after the first elite dies. The Bulwark carries
  `_threatScale` (its gameplay elite scale), which the juice reads first. The
  Gunner / Rifleman / Marksman elites still diverge (since roster Phase 1);
  frozen, flagged, not changed. A seeded replay with no elite death in its
  window cannot see this — `smoke-bulwark` makes sure one dies.

- **THE CURTAIN RADIUS IS ONE NUMBER FOR BOTH TIERS (46).** It used to be
  `cfg.radius + 22`, and the Elite's gameplay radius is its historical 33, so
  the Elite's field drew 9px bigger than the Regular's — a stronger-looking
  defence that does not exist. Every block on either tier is decided at body
  overlap (<= 41px), inside it.

- **A FIELD THAT STRADDLES ITS BEARER NEEDS TWO DEPTHS — AND A THIRD FOR HIS
  GUN.** One Graphics has one depth; cells south of his centre draw over him
  (y+2), cells north under him (y-2). A single depth either paints the shield
  over his face from behind or hides it from the front. The sidearm's depth is
  frozen in `Enemy.preUpdate` (y+1, y-1 aiming north) and it always lies on
  the apex, so side-on body > far > gun > body is a CYCLE and the gun sat ON
  the far half. The far cells the gun's own footprint crosses go to `farW` at
  `weaponSprite.depth + WEAPON_STACK.shield`; every other far cell stays under
  the body. The pip, the discharge and `farW` ride ONE stack on the overlay's
  depth (`WEAPON_STACK`), so rotation cannot reorder them. Do not answer
  WEAPON < SHIELD by lifting the whole far half over the body — that deletes
  the occlusion the handset approved.

- **AN ACCUMULATED ANGLE IS RIGHT FOR GAMEPLAY AND WRONG FOR A RANGE TEST.**
  `EnemyShielded._tickSwarm` turns the shield with `_shieldFacing +=
  clamp(Wrap(toPlayer - _shieldFacing))` and never wraps the sum, and `_aim`
  copies it. Every gameplay reader goes through sin / cos / Wrap, so the block
  and the gun are right at any value. Three PRESENTATION reads in the frozen
  `Enemy.preUpdate` are not periodic — `_facingSuffix` (raw degrees), the
  overlay flip (`|aim| > 90deg`) and the overlay depth (`deg in (-135,-45)`) —
  and a shield that reached a south-west player through west sat at -225deg,
  so every later bearing drew the WEST sprite (-450deg, north, drawn west) and
  gait v2 walked it backwards: 309 of 381 frames on the human's own path.
  `systems/bulwarkFacing.js` resolves all three from the WRAPPED angle on the v1
  Bulwark and writes neither `_shieldFacing` nor `_aim`. Two rules came with it:
  **never wrap the gameplay value** (the replays compare it raw), and **in range
  the display angle must be the value itself, not `Wrap(value)`** — Phaser's
  `Wrap` is not bit-identical for an in-range input, so wrapping always would
  move a ±45 / ±135 boundary by an ulp. Legacy (no flag) still carries the bug
  in frozen code.

- **JUDGE A FRAME BY THE ANGLE IT WAS DRAWN FROM.** `EnemyShooter.preUpdate`
  runs the base class's presentation BEFORE the AI, so each frame is drawn from
  the aim the AI left LAST tick. A rig that compares the sprite against the
  current facing reports a one-frame lag at every cardinal boundary as a wrong
  facing — `diag-bulwark-facing` tracks the drawn-from angle for that reason.

- **A SPRITE'S FLIP IS NOT IN ITS WORLD MATRIX.** Phaser applies
  `flipX`/`flipY` in the renderer, mirroring the frame WITHIN ITSELF while
  the origin stays put, so `getWorldTransformMatrix()` and anything measured
  from the origin describe the UNFLIPPED sprite. The Bulwark's sidearm is
  drawn `flipY` whenever it aims west, and flipped it reaches 20px either side
  of its bore against 16 unflipped: the first WEAPON < SHIELD strip used the
  unflipped width and left gun pixels on the under-body layer at two
  north-west facings — and the structural guard, built on the same matrix,
  passed blind. Only the magenta pixel guard saw it. Mirror the rows yourself.

- **A PIXEL GAME'S FIELD IS BUILT FROM THE GAME'S PIXEL.** The vector field
  (soft-edged panels, vertex colour) read as glass laid over a pixel game. It
  is 4px CELLS now on the SCREEN-ALIGNED grid anchored at the bearer's centre,
  which is the grid his sprite is painted on. Cells on a grid that ROTATED
  with the facing were tried first and serrate the curve into a saw-tooth at
  the diagonals. The field only redraws when its signature changes (facing,
  scan column, bush, the overlay's depth offset, gun visibility) or an event
  is live, plus ONE clean frame after the last event; anything new that
  shapes the field must join that signature or it will not appear.

- **DEPTH MAY CHANGE; ENERGY STRENGTH MAY NOT — FAR = BEHIND THE BODY, NEVER
  FAR = WEAKER.** The first field ALSO dimmed its far layers (material x0.5,
  outer rim x0.32, reactions x0.7, keyline near-only), and the handset saw
  exactly that: a full shield facing south, half a shield side-on, a ghost
  facing north, and reactions harder to read on the dimmed half. Rotating him
  does not change the projector's output. `_layer()` in `bulwarkCurtain.js` is
  the ONE place near/far is decided and it returns a layer, never a number;
  `smoke-bulwark` draws the same field at opposite facings and requires the
  style stream to be identical with only the layer swapped. The only
  legitimate visibility loss is his body actually in front of it.

- **A BAND THAT LEANS IS A BAND THAT THINS FROM BEHIND.** This floor has no
  foreshortening, so a band's screen thickness is its radial depth plus its
  lean (inner rim lifted over the outer) x sin(bearing): the lean ADDS facing
  south and SUBTRACTS facing north. The first cross-section leaned 7px and read
  19 / 12 / 5px south / side / north — a thin arc from behind at any alpha.
  The 4px cell field has no lean at all: a flat band R-11..R+6, 16px at
  every compass facing and 18 on the diagonals (it read 19 / 17 / 15 with a
  2px lean). Measure presence with
  `tests/diag-bulwark-orient.mjs` (`--nobody` separates projection from
  occlusion), not by eye on the south view.

- **A REACTION ON THE CENTRE LINE MUST NOT FLIP LAYERS ON A HAIR.** Side-on,
  a contact on the facing sits at his own depth, exactly where his sidearm
  crosses the field, so routing it by the plain sign of sin(bearing) drew a
  hit a hair north of the line under the gun and a hair south over it — the
  same Super read 0.89 of the south view facing east and 0.12 facing west. A
  reaction's LIGHT is FAR only when it is genuinely behind him (`behindSin`,
  30deg); the cells keep the plain split (their own offset below his centre),
  because their depth is what puts him inside the field.

- **THE FIRST PELLET TO CROSS IS OFTEN AN OUTER ONE.** A Super volley's
  pellets reach the body over a frame or two, and the tear first went to the
  edge of the shield. While the tear is under 50ms old a MORE CENTRAL pellet
  takes the hole and the outer one becomes a pinprick. One readable hole per
  volley; every pellet's contact is still recorded.

- **A FULL SUPER USUALLY KILLS A BULWARK, SO THE TEAR IS RARE IN PLAY.**
  Two pellets kill a sector-8 Regular, and the field goes with the body on
  death, as the legacy arc did. Evidence of the re-knit needs an Elite at a
  real higher-sector hp ramp, or a glancing Super — not an hp edit.

- **A WAVE IS TWO SCALES, AND A CREST ALONE IS A BAR.** The first cell wave
  was one 3.4px crest — about one 4px cell — and the handset read it as a
  narrow rectangle sliding along the band. Each wave now has a narrow bright
  CREST inside a broad soft PRESSURE ENVELOPE (6px ahead, 11px behind: the
  front arrives, the swell trails), whose own light is the crest's colour
  softened toward white, and the envelope FLEXES the membrane outward by up to
  4px — one cell, so the rim visibly kinks where it passes and lets go behind
  it. The WAKE is its own channel and thins toward the outer edge as it ages,
  so it tapers instead of filling the band like a slab. Making the red patch
  bigger was never the fix. `smoke-bulwark` §4e checks the two widths, the
  flex riding the front and nothing past it.

- **AN EASE-OUT WAVE CRAWLS.** The block's twin crests ran a plain ease-out
  and put 75% of their travel in the first 45% of their life, then sat still:
  a flash, then a smudge — never a wave. `waveAt` moves them
  `S(1.5u - 0.5u^2)`, fast out of the contact and still visibly travelling at
  the end, and the WAKE behind each crest takes its colour from the time since
  the crest passed (red -> coral -> pink -> white), which is what makes the
  conversion travel too. The Super's recovery crests run on the same engine,
  pale, after the snap.

### Demolisher (Phase 2D)

- **THE DEMOLISHER IS HUMAN-APPROVED / FROZEN 🔒 — PHASE 2D CLOSED on
  `23bf202` ("Decent enough to approve and freeze.").** Body, Elite
  containment, the warning (the Elite's strength was approved explicitly — do
  not reopen brightness or intensity), the detonation hand-off, the corrected
  profile run and the false-stuck veto are all closed; the notes below are how
  it works and how it breaks, not an invitation to tune. No further Demolisher
  correction and no speculative gait v1.2 without NEW handset evidence.
  **With it, FIVE-ROLE ORDINARY ROSTER PRODUCTION IS COMPLETE** — Gunner,
  Rifleman, Marksman, Bulwark, Demolisher, Regular and Elite. That is the
  production VISUALS only: `?roster=v1`, `?gait=v2` and `?move=v22` are still
  opt-in, and a default rollout, an Elite gameplay redesign and the shared
  stuck-detection audit are separate human decisions. `HANDOVER.md` §0.

- **THE DEMOLISHER'S WARNING IS ITS OWN AI'S NUMBERS ON ITS OWN HARDWARE —
  FROZEN, `HANDOVER.md` §0.** The frozen `_tickSwarm` paints the WHOLE BODY
  with `setTint` every tick; on baked v1 art that is a second author. It is
  SWALLOWED, not fought: `systems/demolisherPayload.js` shadows `setTint` for the
  length of the class's own update (recording the request on
  `_legacyWarnTint`), so nothing else about the tick changes and a rig can
  prove the AI still asked. The warning then reads the SAME `t` and
  `_bombPulse` — `smoke-demolisher` decodes the swallowed tint back to exactly
  `t·flash` on every tick. A restore-after approach would also have worked;
  overriding `setTint` for good would have eaten every future legitimate tint.
  Installed only from `wearRosterArt`, so the nemesis (always legacy art) can
  never get it.

- **A WARNING MUST BE MEASURED FROM EVERY FACING.** The first hardware warning
  beat legacy from the front and the side and was NOTHING from behind until
  165px — the indicator is on the chest. `tests/diag-demolisher-warning.mjs`
  measures screen change per facing against legacy; the canister lights carry
  it from behind now. Same family as the Bulwark's "measure presence by
  orientation, not on the south view".

- **A FAST BODY NEEDS ITS OWN STRIDE, NOT A FASTER CLOCK.** The gait tick caps
  cadence at 24fps; at 300px/s a 48px cycle would need 37fps and skate. The
  Demolisher runs an 80px cycle under its own 32fps ceiling (`GAIT_MAX_FPS`);
  every approved role keeps 24.

- **TWO SEPARATED VERTICAL LEGS ARE NOT TWO LEGS.** The first Demolisher
  profile run (785999f) passed every sheet check and was rejected on handset:
  the hip socket sat at x 11, BEHIND his centre, so the trailing thigh left
  the body 2-3 columns back under the rear canister; a +5/-5 split on
  five-row legs; a trailing boot with no toe that read as reversed. The
  correction (`HANDOVER.md` §0) is the hip under the torso (x 12), a compact
  +4 / 0 / -3 stride with a low swing passing under the pelvis, and a toe-cap
  at the east end of BOTH boots. `smoke-demolisher` §2b measures it from the
  painted pixels (pelvis band vs the first leg row, toe-caps per boot,
  heel-to-toe span) and pins every pixel above the pelvis and every
  front/back frame to 785999f by hash — the correction was legs only. Approved
  on handset; the remaining fast, short shuffle is an ACCEPTED limitation.

- **A RIG EQUALIZER MAY NEVER COVER THE THING UNDER TEST.** The BOMBER RUN
  replay equalizes the frozen roles' known v1 Elite-death leak; the first
  version equalized EVERY Elite and the replay passed with the Demolisher's own
  `_threatScale` deleted. A/B the check against the fix removed.

### Stuck detection and tactical AI (Phases 3A–T2)

- **THE FIRST STUCK CHECK ALWAYS FIRES — AND ONLY THE DEMOLISHER IS EXCUSED.**
  `Enemy.preUpdate` measures `hypot(x - (_stuckRefX ?? x))` and the reference
  starts undefined, so every fresh swarm mover's FIRST check reads 0px moved
  and arms a 600ms perpendicular sidestep — measured on a Demolisher in an
  empty lane at exactly 600ms, 175px from spawn, ~91deg off its target for
  600ms, in legacy and v1 alike. The base class is FROZEN and still does it
  for every other archetype (Rifleman rush, Gunner approach, Bulwark,
  Marksman, Swarmling, the nemesis bomber); the handset rejected it on the
  Demolisher only, so `EnemyBomber._vetoFalseStuck` re-measures that ONE check
  from where the window began and stands the sidestep down when the body was
  moving. The random draw is kept (the base made it before the veto runs),
  every later check is untouched, so a genuinely blocked Demolisher still
  recovers on the base's next check (600ms later than before when it spawns
  within 600ms of a wall — an ACCEPTED limitation), and the nemesis is
  excluded. Approved on handset. **Do not generalise it into the base without
  the human**: it changes five frozen roles' movement. The shared audit is
  COMPLETE and its correction is NOT AUTHORIZED
  (`docs/evidence/shared-stuck-audit/`). It found a SECOND false class this
  veto does not touch: HOLD → RESUME. Every enemy is `behavior: 'swarm'`, so
  a body that stands still on purpose for 600ms (Bulwark hold, VANGUARD
  screen, Marksman band, v2 settle) sidesteps on its first tick back on the
  move.
  `tests/enemy-frozen.mjs` is the narrowed guard (identical outside
  EnemyBomber; inside, only the pinned veto), and `smoke-demolisher` proves
  the replay with the veto switched off IS the pre-correction game.

- **BULWARK STUCK RECOVERY: CANDIDATE B IS HUMAN-APPROVED / FROZEN 🔒 — AND
  STILL OPT-IN. Phase 3B, `HANDOVER.md` §0.** `?bulwarkStuck=early` is the
  approved correction (final `f8ea738`); no flag is the frozen default and
  `690ed9b` tick for tick; `?bulwarkStuck=prog` (A) is rejected for production
  and kept only as the comparison path — do not delete either as cleanup.
  **Default activation is NOT authorized** — a separate rollout decision.
  The notes below are how it works and breaks, not an invitation to tune it.
  - **Seam:** installed per ordinary Bulwark (free, screen, opener, Regular,
    Elite) from `spawnEnemyAt`, never on the nemesis shielded; the module
    shadows the bearer's own `_tickSwarm` / `_moveToward`. `Enemy.js` is not
    touched. It REVIEWS each base check before the AI can take it, never
    arms on its own clock and never draws a random number.
  - **Intent comes from the AI's own `_moveToward` calls, never from
    velocity** — a body pinned on a wall has zero velocity and is very much
    trying to move.
  - **B's two bars are deliberately asymmetric.** KEEPING an arm accepts
    "pressing into the face it is blocked on" right now: a wrong keep is the
    frozen game, and a Regular meets a 70×70 console ONE TICK before the
    first check, with its arrival step still showing 72% progress. ARMING a
    declined check needs a 50ms pinned run, and it reuses the base's last
    drawn direction — accepted, retained.
  - **It fixes the Bulwark ONLY.** Every other archetype except the Marksman
    (next bullet) still has both false classes. B is a reference, not a
    template.

- **MARKSMAN STUCK RECOVERY: PHASE 3C CANDIDATES — OPT-IN, HANDSET REJECTED
  THE GAMEPLAY RESULT (next bullet), NOT FROZEN.** `?marksmanStuck=prog` (A) / `?marksmanStuck=early` (B),
  `src/systems/marksmanStuck.js`, ordinary `sniper` only (never the nemesis).
  No flag is the frozen game, `f752b3f` tick for tick. Nothing here is
  approved; the human decides. `HANDOVER.md` §0 and
  `docs/evidence/marksman-stuck-v3c/marksman-stuck-candidate-notes.md`.
  - **A RETREAT IS NOT APPROACH EVIDENCE.** The Marksman retreats with
    `setVelocity`, never `_moveToward`, and the base's ONE consumer is the
    approach, which runs the other way. So a pinned retreat neither keeps nor
    arms anything under B — it is stood down and logged as `retreatBlocked`.
    A blocked retreat is a separate, tracked defect, not this milestone.
  - **REMOVING THE FALSE SKATE EXPOSES HEAD-ON COVER.** The frozen F1 skate
    pre-offsets every approach by ~65px, which accidentally clears cover
    placed dead on the line. Without it A met that cover square and reached
    its band later on every head-on case (Elite past a 320px wall: 1/6 vs 4/6).
    That — not a wish to match the Bulwark — is why B exists; its two parts
    are each pinned to a failed test.
  - **A SIDESTEP STEP IS NOT AN APPROACH STEP.** B's pinned run counts only
    `_moveToward` calls made with no sidestep live; a recovery blocked by a
    second obstacle breaks the run instead of re-arming the same direction
    into it.
  - **THE STAGED HANGAR STILL HAS ITS OWN BUSH ON THE x=800 AXIS near
    y≈1100.** A keyframed player crossing it is `hiddenInBush`, so a charge
    cancelled there is concealment, not the candidate — and a Marksman that
    no longer skates off-axis meets it on different ticks.

- **A BLIND HOLD IS NOT STUCK — PHASE 3C-B, DIAGNOSED, NOT FIXED.** The
  handset rejected 3C ("they keep waiting instead of attacking me", "shielded
  enemies do same"), and no stuck correction could have answered it: the
  Marksman (300..640) and the free Bulwark (inside 290) HOLD on distance alone
  and never ask whether they can shoot from there, so they stand behind a
  console with the line cut for as long as the player stays — 42.6% / 20.1%
  of their life in a reconstructed MIXED, against 4.7% / 2.1% for the v2.2
  Gunner / Rifleman in the same fights. The body is exactly where its rule put
  it. Measure "is it waiting" as BLIND STANDING (still, `canSee && _hasLOS`
  false, not charging), never as stuck sidesteps. The proposal (T1 Marksman
  angle, T2 free Bulwark, both seams — `Enemy.js` is frozen — VANGUARD screens
  excluded by construction) is NOT IMPLEMENTED and waits on the human:
  `docs/evidence/tactical-engagement-audit/`. Two side findings, both
  reported, neither fixed: cover's bush registration can never hide a
  colliding player (56.5px reachable against a 48.4px radius), and v2.2's
  plant-for-the-shot holds a Gunner still for good once its line drops inside
  the last 160ms of its warning (`fireCd` does not count down blind).

- **THE RESPONSIVE MARKSMAN IS HUMAN-APPROVED / FROZEN 🔒 — PHASE 3C-T1,
  `?marksmanAngle=1`, `0b772cf`, STILL OPT-IN.** Handset: *"it reacts promptly,
  its repositioning looks intentional, it doesn't fall back into conspicuous
  robotic pauses, and SNIPER NEST remains challenging but fair."* The
  turn-arounds, the overwatch holds and the higher Marksman pressure are
  ACCEPTED inside that verdict — not open for polish. Reviewed with
  `?marksmanStuck=early` on; neither flag is a default. `HANDOVER.md` §0 and
  `docs/evidence/marksman-angle-t1/t1-candidate-notes.md`. Ordinary `sniper`
  only, a seam over the frozen `_tickSwarm`; `Enemy.js` untouched; no flag is
  the frozen game, `95adb1f` tick for tick. **`firingSpot.js` is shared and
  frozen with it: any change must prove the Marksman's deterministic reference
  scenarios byte-equivalent.** How it works and breaks — not an invitation to
  tune it:
  - **NO IDLE WAIT BEFORE THE SEARCH — the human rejected one by name.** It
    evaluates on the first blind tick and confirms for 140–260ms by the walk's
    length. A commitment guard that becomes a cooldown is the rejected design
    coming back; anti-thrash is the 450ms minimum before a TARGET-caused
    re-plan, failed-spot memory, side memory, hold-and-watch and overwatch.
  - **READ THE PLAYER'S MOTION FROM DISPLACEMENT, NEVER ONE FRAME'S
    VELOCITY.** A keyboard walker toward a moving target is stop-and-go: one
    frame says 0, the next 380. Reading `body.velocity` made the transient
    hold and the lead noise, and on a circling player the Marksman committed
    toward the side being LEFT at the start of 4 of 5 episodes, walked half a
    second and turned round. 250ms of real displacement on scene time: 0.
  - **A SIDE FLIP IS NOT A TURN-AROUND.** `log.reversals` compares sides of
    the player, which flip on their own when the player runs round the room.
    What a handset sees is the world heading turning >120° at a re-plan —
    `tests/diag-marksman-angle-turns.mjs` measures that.
  - **THE WALK TEST IS THE WHOLE BODY.** v2.2's `_scoreSpot` offsets its edge
    rays 0.8x the radius; at 0.9x one walk grazed a console corner. The spot
    search uses radius + 2px.

- **THE FREE BULWARK'S TACTICAL ENGAGEMENT IS HUMAN-APPROVED / FROZEN 🔒 —
  PHASE T2, `?bulwarkAngle=1`, `37135c9`, STILL OPT-IN.** Handset: *"all five
  criteria passed ... APPROVE and FREEZE Phase T2 Free Bulwark tactical
  engagement in the tested opt-in configuration"* (with `bulwarkStuck=early`,
  and T1 on in MIXED). The KEEP, the BRACE, the circling-console pressure loss
  and the untouched blind cooldown are ACCEPTED inside that verdict. **Neither
  T1 nor T2 gameplay may be modified — not a parameter, not a threshold —
  without a NEW human authorization**, and neither flag becomes a default
  without one. `HANDOVER.md` §0 and
  `docs/evidence/bulwark-angle-t2/t2-candidate-notes.md`. Ordinary FREE
  `shielded` only — `!legacyArt && !vanguardScreen` at the spawn site, and
  every VANGUARD opener carries `vanguardScreen` too — a seam over the frozen
  `_tickSwarm`, called first; `Enemy.js` untouched; no flag is the frozen game
  tick for tick. How it works and breaks — not an invitation to tune it:
  - **IT NEVER WRITES THE SHIELD, AND THAT IS WHAT KEEPS IT A BULWARK.**
    `_shieldFacing`, `_aim`, the turn rate and the cooldown stay the frozen
    class's, so a body walking round cover turns its shield exactly as slowly
    as it ever did — a flank is still a flank. `smoke-bulwark-angle` §6/§7
    reproduce the turn law and the cooldown law bit for bit on every AI tick,
    from OUTSIDE every wrapper. It reads `fireCd` to notice a shot; a source
    grep for "gun state" has to tell a read from a write.
  - **CURRENT RANGE OR CLOSER FIRST, NEVER THE MARKSMAN'S ORBIT.** Its own
    search (T1's is frozen and shared only through two exported helpers):
    arcs round the player on [140, 280] — inside the frozen 290 hold so
    arriving never flips the frozen branch — within 60° of its bearing,
    priced per radian swung and per pixel given up. "Never farther" was
    wrong: close behind a console the shadow swallows the whole sweep and a
    Bulwark stood 23s blind 172px out while its comrades held both shadow
    edges. Farther out (still ≤ 280) is searched only when nothing closer
    works.
  - **A WORKING SPOT IS NOT GIVEN UP FOR A MOVING TARGET'S CORNER.** Chasing
    a player circling one console traded a spot that held the line 78% of the
    time for a walk round it (54%); a spot it has fought from (line ≥ 600ms,
    ≤ 40px) is kept up to 600ms while the target moves, and decided the
    moment they stop. Responsiveness to a STILL target is untouched.
  - **A REPOSITIONING ACTOR STUTTERS IN FOUR PLACES, AND EACH NEEDS ITS OWN
    RULE.** A sliver of a line opening mid-walk stopped it and the next
    tick's cut started a fresh confirmation (finish the walk unless the line
    survives a ±40px shuffle; resume within 400ms with no new confirmation);
    a walk taken mid-approach eased in from ZERO and dipped to 0.48px/tick
    (ease from the velocity the body had BEFORE the frozen tick wrote its
    command — by review time the frozen hold has already zeroed
    `body.velocity` — and only its component along the new walk, or a turn
    keeps pushing into the face it is leaving); and braced just outside the
    frozen 290 hold, the frozen tick stepped one tick and stood ten as the
    target shifted (braced or keeping, it holds its ground) — and a fourth: a
    body that has just stopped walking decides on its first blind tick
    instead of confirming from a standstill. Count stops of ≤ 300ms
    between walks (`bulwarkQuality.stopGo`) — a shot count never sees them.
  - **THE COOLDOWN DOES NOT RUN BLIND, SO A REACQUIRED LINE WAITS FOR ITS
    WARNING.** `_maybeFireAt` gates the countdown on the line; a Bulwark that
    walks to a line shows its WARN ~0.8s later on average. Frozen pipeline,
    measured, accepted inside the T2 verdict, not changed.
  - **IT PUBLISHES `_angDest`**, the same claim field T1 publishes, so with
    both flags T1 Marksmen avoid a Bulwark's destination — by design, through
    T1's existing generic read; T1's own code is byte-identical.

### Integration (R0 — investigation, `docs/evidence/integrated-combat-r0/`)

- **The seams compose as built.** Measured on live spawns with the real flag
  parser: T1 on every ordinary Marksman (Regular and Elite), Marksman stuck-B
  only with `marksmanStuck=early`, Bulwark stuck-B on every Bulwark including
  screens and openers, T2 on every free Bulwark and never a screen, v2.2 on every
  Gunner and Rifleman, nothing on the Captain, swarmlings or nemeses. VANGUARD ±
  Captain is tick-identical with T2 on or off and with Marksman stuck-B on or
  off. `tests/smoke-integration-r0.mjs` asserts all of this.
- **T1 defers to a stuck sidestep only in its APPROACH branch.** A base arm made
  while a T1 Marksman HOLDS is consumed by the next approach (the hold→resume
  skate) unless `marksmanStuck=early` stands it down at the top of that tick.
  So T1 alone still shows ~4–6 false 50px skates per Marksman-minute; the same
  fights with Marksman stuck-B show ~0.
- **The v2.2 plant (`_warnFlashed && fireCd < 160` → velocity 0) holds a body
  still for as long as its line stays cut**, because `_maybeFireAt` only counts
  `fireCd` down with a line. A hiding player triggers it in ordinary waves
  (register #6). Measure it as blind standing with `_warnFlashed` set, not as
  stuck.
- **Bulwark flags are inert in a Bulwark-free fight** (T1's handset URL and the
  full integration are tick-identical in SNIPER NEST), and **B and C diverge on
  the first Marksman's first stuck check**, ~1.6–4.6s into a fight.
