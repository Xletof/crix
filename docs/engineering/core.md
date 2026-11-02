# Core engine and combat — reference

Cross-cutting mechanics every gameplay change can hit: projectiles, damage
events, scripted moves and telegraphs, controls, depth, audio, progression.
Load on demand; the root `CLAUDE.md` carries only the one-line versions.

## Invariants

- **One author per value.** A scripted move owns its actor while
  `actor._performing` is set; `Boss.preUpdate` / `Enemy.preUpdate` yield. A tween
  and a per-frame write on the same property are two authors.
- **Hitbox = texture width.** `Bullet.fire` sizes the circle from the texture and
  stretches tracers above 620px/s; keep projectile canvases fixed and assert
  `body.radius`.
- **Incoming fire is four pools** (`enemyBullets`, `deflectedBullets`,
  `bossSuperOrbs`, `captainBullets`) — iterate `GameScene.hostileBullets`.
- **A boss hit emits `boss-hit` then `enemy-hit`** (except the lethal wound).
  Per-hit feedback runs twice on a boss.
- **Damage text is pooled** (`fx.damageNumber`, `DMG_POOL` 26, last arg is a
  tier: `'minor'` / `'major'`).
- **A telegraph's shape is its hit test** (`Telegraph.contains`).
- **A cancelled move handle is not a claim** — `MoveScript.cancel()` leaves
  `actor._activeMove` set; gate on `!h.cancelled && h.phase !== 'done'`.
- **Upgrade effects are magnitudes of `s`**, because `apply` can repeat.
- **Relative scale mutations compound** — set absolute multiples of a remembered
  rest scale (weapons and touch widgets both).

---

## Trap ledger

Entries under the headings below were migrated from the root `CLAUDE.md` as it stood at `7d67bed` (`git show 7d67bed:CLAUDE.md`), keeping their wording. Anything since superseded carries a **Status (2026-11-02)** note rather than being silently rewritten.

### Projectiles, damage and combat feedback

- **Bullet hitboxes come from texture width.** `Bullet.fire()` calls
  `setCircle(this.width / 2)`, so changing a projectile texture's dimensions silently
  changes its collision size. Keep canvas dimensions fixed when redrawing projectiles,
  and assert `body.radius` parity in tests.

- **A HIT ON A BOSS FIRES TWO DAMAGE EVENTS.** `Boss.damage` emits
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

- **Super pellets are `piercing`**, so anything gated behind `if (!b.piercing)` never
  runs for them (this hid the super's impact explosion for a long time).

- **The super is hardcoded.** `superPellets` / `superDamage` are flat `PLAYER` config
  constants feeding a single `tryFireSuper → player-fire-super → firePlayerSuper` path.
  There is no super-*type* concept; adding alternative supers requires a registry.

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

  > **Status (2026-11-02):** FOUR pools, not three — `captainBullets` joined
  > (see `champion.md`, "A CAPTAIN BOLT NEEDS ITS OWN POOL"). The getter is
  > `GameScene.hostileBullets`; the rule is unchanged.

- **A subclass that intercepts `damage()` must test the number the PARENT will
  subtract.** `Enemy.damage` multiplies by `_punishMult` inside a punish window,
  and `Boss.damage`'s wound-instead-of-die intercept tested the raw amount — so a
  hit that was not lethal raw became lethal applied, and Vader DIED in endless,
  which ends the ladder. Latent for as long as both systems have existed; it
  surfaced only when the hp pool moved and changed where hits land relative to
  punish windows.

- **Recoil/kick timers carry their own duration.** `recoilT`/`recoilDur`/`recoilMag`
  and `_wKickT`/`_wKickDur`/`_wKickMag`. Never reintroduce a hardcoded divisor; that
  bug made the super shrink the player instead of popping it.

### Moves, telegraphs and actor ownership (MoveScript / Telegraph — Vader, nemesis, Champion)

- **ONE SYSTEM DRIVES AN ACTOR AT A TIME.** `Boss.preUpdate` and
  `Enemy.preUpdate` write velocity and reselect the animation every frame.
  `MoveScript` sets `actor._performing` for the length of a move and both AIs
  yield on it; `_castBossMove` also refuses while the actor's own state machine
  is mid-attack. Without that gate the two fight over the same body and the
  move's wind-up is overwritten before it can draw. The gate deliberately writes
  NOTHING — a travelling move sets its own velocity and expects it to persist.

- **A move that schedules its own links needs an `h.over` flag**, set at the impact
  beat. Timers resolve coarsely on a slow frame, so a chain link can *start* after
  RECOVER has already run — TRIPLE DASH finished combos in a wind-up pose that way.
  A generous `actMs` is a race, not a fix. Likewise, `onEnd` on a chain's last link
  fires after RECOVER: never set a pose there unconditionally.

- **A move's second zone needs `anchor: 'world'`** when it marks a place rather than
  a body, or it drifts with the caster's recoil and stops being a promise.

- **A CANCELLED MOVE HANDLE IS NOT A CLAIM, AND A SCHEDULER THAT FORGETS THAT
  GOES INERT FOR THE REST OF THE ROOM.** `MoveScript.cancel()` deliberately does
  not clear `actor._activeMove` (only the `done` path does), so an interrupted
  handle sits on the actor for ever with `phase: 'anticipate'`. Any "one move at
  a time" gate must test `!handle.cancelled && phase !== 'done'`, never the
  phase alone. `_castChampionMove` does; **`_castNemesisMove` does NOT and is a
  live latent bug** in the legacy system, left alone on purpose. Same rule
  `CameraDirector._bossFramable` follows for the same field.

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

- **Relative scale mutations drift.** `raiseWeapon`/`dropWeapon` used to multiply
  and divide by 1.35, so any unmatched pair compounded — the boss's saber reached
  a ~1100px slab. Always set an ABSOLUTE multiple of a remembered rest scale.
  Same family as the touch-widget `setScale(1)` trap above.

### Player controls, HUD and progression

- **Touch-control geometry comes from `controlLayout.js`, not `HUDCFG`.** The
  `HUDCFG.joystick*` constants are only the defaults the store seeds from; the
  player can move and resize every control at Pause → CONTROLS. A widget's
  `scale` multiplies its hit radius and drag throw as well as its sprite, so any
  code that writes a bare `image.setScale(1)` or tweens `scale: 1` on a touch
  widget quietly resets a customised button to 100%.

- **The game camera is inset below the HUD top bar** by `HUDCFG.topBarHeight` (84px)
  via `setViewport`. Any screen-space overlay maths must account for that offset —
  see `HUD._drawThreatChevrons`.

- **An upgrade's `apply` can run more than once.** `pickThree` falls back to the
  FULL pool once fewer than three cards are untaken, so past ~sector 13 cards
  repeat. Effects take an `s` scale and must be written as magnitudes
  (`1 + 0.25 * s`, never `*= 1.25`); a bare multiplier compounds, and that is how
  player damage reached 1240x by Vader #6.

### Rendering and depth

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

### Audio

- **`meleeBus` is reserved for the Riven melee.** It is ~+6dB, exempt from
  ducking, and has no echo send. Do not route new sounds to it; use `sfxBus`.

- **On a phone, spectrum beats gain.** Handset speakers have almost no output
  below ~400Hz, so a sound whose energy sits there cannot be fixed by turning it
  up — the saber hum was inaudible on mobile for exactly this reason. Measure the
  bands (`tests/smoke-hum.mjs`) before reaching for the volume.

### Nemesis

- **A nemesis bomber must never run the stock contact path.** `EnemyBomber._detonate()`
  sets `hp = 0` and calls `die()`; on a nemesis that throws away 6× hp, traits,
  regalia, a name and a ledger grudge on first touch. `_tickSwarm` branches to
  `_contactBurst` for `_miniBoss`. `smoke-duel` gates it.
