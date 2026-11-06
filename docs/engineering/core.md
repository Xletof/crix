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

### P1 combat visual polish (`?visualPilot=v2c&polish=p1`, a candidate — not approved)

Seams, not edits: `HUD.create` calls `installBannerPolish(this)` (instance
methods `showBanner` / `_renderMedal` / `showCombo` / `showSectorSign`, removed
again when the flag is off) and `GameScene.create` calls
`installPlayerPolish(this)` (a POST_UPDATE reader of the player; `Player.js` is
untouched). Proof: `tests/smoke-polish-p1.mjs`. Traps found building it:

- **The shipped banner never kills its own tweens.** Two banners inside ~1.5s
  and the first one's delayed exit tween fades the second early (filmed: an
  earlier banner's exit swallows `⚠ DETECTED`). P1 kills them; A keeps the
  shipped behaviour.
- **"Is a banner live?" cannot be read from its alpha.** A multikill emits its
  banner and its streak splash in the SAME frame, when the banner is still at
  alpha 0, so an alpha test lets the splash print through it. P1 keeps the
  banner's scheduled end time and lanes off that.
- **The banner's widest box is its EXIT tween's end** (scale 1.16, while it
  fades), and Text `width` already includes `strokeThickness`. Fit against that
  box, not the resting text. The pause button (`HUD._pauseBtn`, depth 46) draws
  over the banner's top-right — it is an obstacle, not just the canvas edge.
- **The sector sign is driven per frame** by `_drawExitWaypoint`, which hides
  it whenever no exit door is open: a rig that calls `showSectorSign` directly
  sees nothing. Open a real door (`gs._openDoor()`).
- **Room banners are scheduled on delays** (WAVE now, the modifier at 1.55s, the
  terminal hint at 1.75s / 3.1s): a rig that stages a banner within ~3.2s of a
  room start gets overwritten. Advance ~260 ticks first.
- **Phaser flips a texture about its frame CENTRE, not its origin.** A weapon
  with an off-centre bore axis jumps off the aim ray when `flipY` engages; the
  P1 weapons put the bore on the canvas's middle row.
- **Hide a Player-owned overlay by `visible`, not alpha.** Player.preUpdate
  rewrites the weapon overlay's alpha and the aura's visibility every frame;
  the weapon's `visible` it never touches. The aura has to be re-hidden each
  POST_UPDATE, before render.

### P2-A blaster fire and impact (`?visualPilot=v2c&polish=p1&fxPilot=p2a`, a candidate — not approved)

Seam, not edits: `GameScene.create` calls `installFxP2A(this)` after the P1
layer (`systems/p2aFx.js`), `PreloadScene` calls `paintFxP2A(this)`
(`systems/p2aPaint.js`, new `p2a-*` keys). It wraps, on the instance, the
pistol / rifle groups' `fire`, `firePlayerPrimary` / `firePlayerRifle`,
`handleBulletEnemyHits` / `handleBulletWallHits`, `_impactMicroFlash`, and six
fx methods; the wrappers only raise a context flag around the shipped code, and
the fx ones match their exact arguments. Proof: `tests/smoke-fx-p2a.mjs`.
Traps found building it:

- **The player bolt's hitbox is 30px in radius** (`bullet` is 60px wide). A
  body hit registers while the bolt's centre can still be ~30px in front of the
  body, so the shipped impact ring often sat in the air. Draw a contact on the
  body's rim along the flight line (`circleEntry`), never at the bolt.
- **Cover sorts at `y + 56` and its art overhangs its 70px body by 21px a
  side**, so every flat-depth effect (≤ 27) at a cover contact is drawn UNDER
  the cover art — the shipped wall hit was invisible against crates and
  consoles. A contact on cover takes the cover's depth + 1, at the point where
  the flight line entered the BODY's AABB (`aabbEntry`).
- **The shipped muzzle flash spawns at the bolt's spawn (34px), inside the P1
  barrels** (pistol face 42px, rifle 48px) and at depth 34, under the hero and
  his gun. A flash that belongs to the P1 weapon is pinned to the weapon
  Image's live barrel face (`_muzzle()`), which already carries recoil, and
  drawn at the weapon's depth + 0.5 (so it goes behind him with the gun).
- **Replacing a shipped particle effect must still spend its `Math.random`
  draws.** Every replaced emission is performed into an invisible TWIN built
  from the live emitter's own config, then `killAll()`-ed (the Bulwark field's
  precedent). Dropping a draw-free call (`impactRing`, `muzzleFlash`, the
  micro-flash) needs nothing.
- **Hide the bolt by `visible`, after `fire`.** `Bullet.fire` re-shows it on
  every recycle; nothing in gameplay reads a player bolt's `visible`. Never
  re-texture or rescale it: the texture's width is the hitbox and the scale is
  the shipped tracer stretch.
- **A tracer's tail is a DISTANCE behind the head**, clamped to the barrel face
  the shot left from, and on death its back end keeps travelling at the bolt's
  speed into the end point — so its length does not depend on the frame rate.
- **Age effects by `delta × time.timeScale`**, or a hitstop freezes the world
  while the flashes keep animating.
- **An ADDITIVE sprite at a y-sorted depth breaks the sprite batch twice.**
  The renderer does not group by blend mode, so every ADD glow interleaved
  with the actors flushed the WebGL batch: +4ms median per rendered frame in
  `diag-fx-p2a-perf` for a handful of glows; NORMAL-blend tinted glows cost
  nothing measurable (`--exp=noadd`). Measure before adding a blend mode.
- **Sprites stand one physics step behind their bodies during collision
  handling** (Arcade syncs them in its POST_UPDATE). An effect placed from
  `e.x` in a collision handler lands where the actor WAS; keep it as an offset
  from the actor and re-apply it each frame.
- **Editing a `src/` file while a browser run is live reloads the page** (Vite
  HMR: P2-A's modules accept no hot update) and kills the run mid-film.

### P2-A2 carbine loadout (`?visualPilot=v2c&polish=p1&fxPilot=p2a2`, a candidate — not approved)

Built on the P2-A layer (`isFxP2A()` is true for `p2a` and `p2a2`;
`isFxP2A2()` only for `p2a2`), installed by it — no new GameScene or
PreloadScene call. `systems/p2a2Loadout.js` owns the presentation of the
loadout; `p2aFx.js` maps each bolt's POOL to a style (`playerBullets` ->
`standard`, `playerRifleBullets` -> `override`). Proof:
`tests/smoke-fx-p2a2.mjs`. Traps found building it:

- **Four identities, not one.** Mechanical weapon (`player.secondary`, the fire
  paths), displayed weapon (the carried Image), projectile style (from the
  pool) and choreography (STANDARD single discharge / OVERRIDE alternation +
  heat) must be decided separately: P1 picks its gun from `secondary`, P2-A
  its effects from the pool, and under P2-A2 those no longer agree.
- **Reuse P1's hold, do not copy it.** The carried rifle is a P2-A2 Image
  placed each frame by P1's own `_updateWeapon`, called with a context whose
  `P` is `Object.create(player, { secondary: { value: 'rifle' } })`: live reads
  through the prototype, one overridden field. Every helper it calls on the
  player (`_meleeBladeOffset`, `_meleeProgress`, `_meleeFlipRad`) only reads,
  which is what makes the trick safe — check that before calling a method
  that way. P1's own weapon Image is hidden by `visible` (P1 never writes it).
- **`new Phaser.GameObjects.Text` draws `Math.random`** (its texture key is a
  `UUID()`, ~32 draws). A presentation layer must not create Text objects in a
  seeded fight: re-word existing ones with `setText`, paint captions into a
  texture.
- **The shield bubble sits over the muzzle.** `Player.shieldRing` (fill and a
  3px rim at radius 38) draws at `y + 3`; the pistol's kicked barrel face is at
  35-42px, the rifle's at 41-48px — on the rim. An ignition that must read is
  drawn over it (`y + 3.5`) when the weapon is in front of the body, and keeps
  the weapon's depth behind it. The P1 ready ring (radius 46, `y - 3`) is under
  the core in both cases; its competition is white-on-white, which a dark
  keyline on the discharge separates.
- **The shipped HUD never refreshes the rifle's round count per shot**
  (`secondary-ammo-changed` is emitted on equip / empty and per cluster
  throw, not per burst bolt). P2-A2 preserves that (register #28).
- **Quantising a full frame to a 256-colour palette washes out the reds** of
  small flashes (they read cream): keep evidence stills in RGB.

### P2-A3 OVERRIDE refinement (`?visualPilot=v2c&polish=p1&fxPilot=p2a3`, a candidate — not approved)

Built over P2-A2 (`isFxP2A()` and `isFxP2A2()` are true for `p2a3`;
`isFxP2A3()` only for it), installed by the P2-A layer after P2-A2's loadout —
no new GameScene, PreloadScene or HUD call, and `p2a2Loadout.js` untouched.
`systems/p2a3Override.js` owns the OVERRIDE round count, readout, power cell
and beats; `&muzzle=sharp` (`isMuzzleSharp()`, P2-A3 only) is the STANDARD
discharge's persistence A/B inside `p2aFx.js`. Proof: `tests/smoke-fx-p2a3.mjs`.
Traps found building it:

- **Fix a missing event by READING, not by emitting.** The burst bolt spends a
  round without `secondary-ammo-changed` (register #28). Emitting it from a
  presentation layer would change event behaviour (and every listener's
  timing). P2-A3 compares `player.secondaryAmmo` with the value it last drew,
  once a frame in P2-A's POST_UPDATE, and re-runs the HUD's own
  `refreshSecondary` only on a change: 26 redraws for 27 rounds (the emptying
  round goes through the shipped event). The smoke counts every game event in
  both builds and requires them equal.
- **Wrapping a wrapper.** P2-A3 instance-wraps `hud.refreshSecondary` on top of
  P2-A2's wrapper: one refresh runs the shipped body, P2-A2's restyle, then
  P2-A3's, which has the last word. Unwrap in reverse order (P2-A3 before
  P2-A2's loadout) or P2-A2's `delete` takes P2-A3's wrapper with it.
- **The HUD scene starts after the Game scene installs.** `scene.launch('HUD')`
  runs after `installFxP2A`, so `secIcon` / `secText` do not exist yet:
  P2-A3's HUD objects are built lazily on the first restyle, and the poll only
  calls `refreshSecondary` once `hud.secIcon` and `hud.gameScene` exist.
- **A re-sized shipped Text must be put back.** P2-A3 sets `secText` to 32px
  for the OVERRIDE count; leaving OVERRIDE (run dry, the cluster pod, a
  restart) restores the shipped 15px, or the cluster panel inherits it.
- **An overlay that must not change the gun's silhouette** is painted on the
  gun's own canvas size and origin and given the gun's transform each frame:
  every lit texel lands on a texel the rifle already has (the smoke checks it
  against `p1-rifle` and `p1-rifle-hot`). flipY mirrors about the texture's
  middle, which is the rifle's origin row, so a point offset is `dy -> -dy`.
- **A short flash can lose its peak to the frame it was born in.** P2-A ages a
  flash from the fire call, so its first RENDERED frame is already `delta` old
  (at a 30 Hz step the current STANDARD flash never shows its first-third
  hold). The sharp variant starts ageing after the first frame it is drawn.
- **One Vite cache per server.** A second dev server for the previous build
  (a worktree whose `node_modules` is a symlink to the main one) re-optimises
  into the SAME `node_modules/.vite` and the main server then answers its
  Phaser bundle with 504 — every new page in a running suite hangs. Start the
  old server with its own `cacheDir` (a config wrapper: `{ ...base, cacheDir }`).

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
