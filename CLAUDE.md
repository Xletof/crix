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
  (`claude/project-handover-ack-9ai0av`); GitHub Pages will serve a **stale build**
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
- **ONE SABER, ONE OWNER — and `_saberAway` is the truth of it.** SABER THROW
  detaches `weaponSprite` and flies it across the room; while that flag is set
  Vader is physically unarmed. DEFLECTION shipped ignoring it: the reflect clock
  fired, the guard opened, and he parried bolts with a blade that was 500px
  away and still spinning. The scheduler now separates DUE from ACTIVE —
  `_reflectPending` is owed, `_reflectClaimed` is announced and reserved, and
  `Boss.canOpenGuard()` (`hasSaber() && !isGuarding()`) is the one gate. The
  clock still resets at the due moment, so a deferral costs no cadence, and the
  tell goes up on the frame the blade is caught. Do not write
  `if (saberThrow) return` anywhere: the flag is the general contract, and a
  future move that takes the blade only has to set it.
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

## Conventions

- Vanilla JS ES modules, Phaser 3.90 + Vite. No TypeScript.
- Pixel art is generated programmatically in `src/systems/pixelArt.js` via
  `PixelCanvas` / `SpriteSheet`; palette lives in `PAL`. No image assets for sprites.
- Config-driven design: prefer adding data to registries (`WEAPONS`, `UPGRADES`,
  `MODIFIERS`, `ENEMY`) over branching in scene code.
- Staged commits: one logical change per commit, built and smoke-tested before commit.
