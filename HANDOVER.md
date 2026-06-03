# Crix — Full Session Handover

## Project Identity

- **Name:** Crix (Death Star infiltration top-down twin-stick shooter)
- **Theme:** Brawl Stars-style mobile arena shooter, Star Wars / Mandalorian skin
- **Repo:** `xletof/crix` (GitHub)
- **Working branch:** `claude/mobile-run-game-design-OZLYF`
- **Deployed:** https://xletof.github.io/crix/
- **Stack:** Phaser 3.90 + Vite, vanilla JS modules, no framework

## Critical Constraints (never break these)

1. DEVELOP on branch `claude/mobile-run-game-design-OZLYF` only — never push to another branch without explicit user permission.
2. GitHub MCP tools restricted to `xletof/crix` only.
3. Do NOT create a pull request unless the user explicitly asks.
4. Always push with `git push -u origin claude/mobile-run-game-design-OZLYF`.
5. Retry push on network failure up to 4 times (2s, 4s, 8s, 16s backoff).

## Last Commit

```
7546e39  Stack: camera fire kick, enemy pre-fire ping, boss flicker, item bounce
```

## Architecture

### Two-scene layout
- `GameScene` ("Game") — world + Arcade Physics, world camera, all entities
- `HUDScene` ("HUD") — fixed UI camera, launched as a parallel scene from GameScene.create()

### Logical resolution
- Portrait 720×1280 (`VIEW` in config.js), `Phaser.Scale.FIT`
- World camera shows 1600×1600 arena; player-follow with setFollowOffset for aim-lookahead

### Key architectural decision: static body + rotating weapon overlay
- **Body sprite NEVER rotates.** No `setRotation()` on Player or Enemy bodies.
- Each entity has a separate `weaponSprite` image that orbits it, positioned + rotated to `_aim` each frame in `preUpdate`.
- `_aim` is a plain float (radians) tracking the entity's facing/aim direction.
- This is how Brawl Stars / Hotline Miami handle it. Rotating the body causes the "upside-down plane" bug.

## File Map

```
src/
  config.js                  All gameplay tunables (single source of truth)
  main.js                    Phaser.Game config, scene registry
  data/
    rooms.js                 4 hand-authored room specs (hangar, corridor, detention, vader)
  entities/
    Player.js                Movement, aim, fire, ammo, super, HP regen, weapon overlay
    Enemy.js                 Base class + EnemyGrunt + EnemyShooter AI state machine
    Boss.js                  Vader — 3-phase, charge/fan/spawn patterns, sabre afterimage
    Bullet.js                BulletGroup with pool, fire(), kill()
    Grenade.js               Thermal detonator — fuse + AoE
    Terminal.js              Hackable objective terminal
    WeaponPickup.js          Drops in rooms, magnet pull, landing bounce
  scenes/
    BootScene.js             Splash → Preload
    PreloadScene.js          Loads all assets, calls pixelArt painters
    TitleScene.js            Logo + PLAY button
    GameScene.js             Main arena loop (~1650 lines)
    GameOverScene.js         Victory / defeat + replay
  systems/
    Joystick.js              Left (move) + right (aim/fire) virtual thumbsticks
    SuperButton.js           Super-fire hold/release area (top-left of right half)
    HUD.js                   HP bar, ammo pips, super gauge, banners, hack/takedown buttons
    HackMinigame.js          3-round timing puzzle (sweep cursor, tap in zone)
    BushSystem.js            Tracks which actors overlap cover (hiddenInBush flag)
    CoverRegistry.js         Cover spots claim/release for shooter AI
    RoomManager.js           Counts enemies, fires room-cleared
    WaveManager.js           (legacy, not used in current room-based flow)
    FX.js                    Particles, SFX (Web Audio API synth), screen shake, muzzle flash
    pixelArt.js              Procedural pixel-art painters for all sprites (~1315 lines)
```

## config.js Tunables (current values)

```js
PLAYER: hp=1000, speed=240, radius=22, ammoMax=4, ammoReloadMs=750,
        fireCooldownMs=150, pelletCount=3, pelletSpreadDeg=10, pelletDamage=300,
        pelletSpeed=820, pelletRange=420, superHitsToCharge=10, superPellets=7,
        superSpreadDeg=30, superDamage=520, superSpeed=700, superRange=560,
        superKnockback=440, regenDelayMs=2500, regenPerSec=220, bushAlpha=0.5

WEAPONS.rifle:        totalAmmo=27 (9×3-burst), burstDelayMs=75, damage=220, speed=940, range=500
WEAPONS.flamethrower: fuel=100, drainPerSec=22, damagePerSec=380, range=190, halfAngleDeg=28
WEAPONS.detonator:    charges=3, throwSpeed=510, fuseMs=1100, blastRadius=130, damage=750

ENEMY.grunt:    hp=600, speed=180, radius=22, meleeDamage=150, meleeRange=38, meleeCooldownMs=700
ENEMY.shooter:  hp=400, speed=140, radius=22, fireCooldownMs=1800, bulletSpeed=480, bulletDamage=110

BOSS: hp=9000, radius=56, speed=110, contactDamage=220,
      phase2=0.66, phase3=0.33,
      chargeWindupMs=700, chargeSpeed=560, chargeDurationMs=900,
      fanPellets=11, fanSpreadDeg=70, fanBulletSpeed=380, fanBulletDamage=130,
      spawnCount=3, attackCooldownMs=2200

HEALTH_ORB: dropChance=0.22, healAmount=140, radius=14, lifeMs=8000
```

## rooms.js — 4 Rooms

| # | id | name | enemies | terminals | pickup | reinforce |
|---|---|---|---|---|---|---|
| 1 | hangar | HANGAR BAY | 2 grunts (patrol) + 1 shooter (flanker) | 1 | rifle | 2 grunts @ 22s |
| 2 | corridor | SERVICE CORRIDOR | 2 grunts (alerted) + 1 shooter (alerted) | 2 | flamethrower | 1 shooter @ 18s |
| 3 | detention | DETENTION BLOCK | 2 grunts (patrol) + 2 shooters (1 flanker) | 2 | detonator | 3 grunts @ 20s |
| 4 | vader | VADER'S CHAMBER | boss only | 0 | — | — |

**Room completion gate:** Exit door stays sealed until `_enemiesCleared && _terminalsHacked >= _terminalsTotal`. Boss room ends via boss-died event.

## Player.js — Key Details

### Methods called by HUD
- `setMoveInput({x, y, force})` — bails during `_hurtStaggerMs > 0`
- `setAimInput({x, y, force})` — sets `this.aim`, enables `flameActive` for flamethrower
- `releaseAim(vec)` — fires `tryFire()` on release
- `setSuperAimInput / releaseSuperAim` — super drag-aim
- `tryFire(angleOverride)` — routes to pistol / rifle burst / detonator
- `tryFireSuper(angle)` — fires wrist-rocket barrage when `superCharge >= superHitsToCharge`

### Weapon overlay (preUpdate)
```js
const ang = superAiming ? superAim : aiming ? aim : facing;
// Pick wpn-pistol vs wpn-rifle texture
const kickBack = _wKickT > 0 ? (_wKickT / 80) * 7 : 0;
const offset = PLAYER.radius - 4 - kickBack;
weaponSprite.x = x + cos(ang) * offset;
weaponSprite.y = y + sin(ang) * offset;
weaponSprite.rotation = ang;
```

### Idle breathing
`scaleY = 1.15 + sin(time * 0.003) * 0.015` when not moving, not firing, not staggered.

### HP regen
Starts after `regenDelayMs=2500ms` with no damage, at `regenPerSec=220 hp/s`.

## Enemy.js — Key Details

### State machines

**EnemyGrunt:** PATROL → ALERT → CHASE  
**EnemyShooter:** PATROL → ALERT → COVER_MOVE → SUPPRESS → (REPOSITION | FLANK | ADVANCE)

### `_aim` data field
All enemies store aim angle in `this._aim` (not `this.rotation`). Weapon overlay positioned in `preUpdate` exactly like the player. Grunts have no weapon sprite.

### Stealth system
- `isBackstabbable(player)` — PATROL state + rear arc > `TAKEDOWN_REAR_ARC=1.95 rad` + distance < `TAKEDOWN_RANGE=56px`
- `stealthKill()` — silent, never triggers alarm
- `_tickPatrol` — rear approaches don't trigger `canSee()`

### Stagger system
- `_staggerMs = 90` set on each knockback hit
- AI `preUpdate` bails early while `_staggerMs > 0`, so the knockback slide reads on screen
- Enemy wobbles X/Y inversely during stagger (`sin(phase) * 0.10`)

### Pre-fire warning (NEW in last batch)
In `_maybeFireAt()`: when `fireCd <= 300ms`, sets `_warningFired = true` and tints `weaponSprite` orange (`0xff6010`). Clears 360ms later. Resets `_warningFired = false` when new fire cycle begins.

### `die()` — corpse slide
Body stays alive for ~380ms with `body.drag=900`, `checkCollision.none=true`, depth lowered. Tweens to `alpha=0` then destroys.

### Shooter ADVANCE navigation
When no cover with LOS is available: straight-line toward player. Progress-tracks every 350ms; if moved < 8px, commits to perpendicular wall-follow for 1400ms. Direction flips on each stuck episode. Blend: 65% perp + 35% forward.

## Boss.js — Key Details

### Phases
- Phase 2 at 66% HP, Phase 3 at 33% HP
- `enterPhase(p)` reduces `attackCooldownMs` by 400ms per phase (min 900ms)
- Phase ≥ 2: `_enraged = true` → sabre glow pulses faster/larger

### Per-volley damage cap
```js
damage(amount, knockbackVec) {
  const CAP = 2200, WIN = 120;   // max 2200 dmg per 120ms window
  if (_dmgWindowMs <= 0) _dmgWindow = 0;
  const effective = Math.min(amount, Math.max(0, CAP - _dmgWindow));
  if (effective <= 0) return;
  _dmgWindow += effective; _dmgWindowMs = WIN;
  super.damage(effective, knockbackVec);
}
```
Prevents 7-pellet super (7×520=3640) from one-shotting boss.

### Boss has TWO `damage()` definitions — BUG NOTE
`Boss.js` defines `damage()` twice (lines ~62 and ~228). The second one (line 228) does NOT apply the per-volley cap and does NOT call super. The first definition (with the cap) is what the JS engine uses (the second silently overrides it). **This is a latent bug: the cap is effectively not applied.** Should be fixed by removing the second definition.

### Sabre afterimage (CHARGING state)
Every 50ms: spawn ghost image of `weaponSprite` at same position/rotation, tinted red `0xff4040`, fades out 320ms.

### Boss ambient flicker (NEW)
`_startBossFlicker()` called on `boss-start`. Fires 2–4 rapid camera flashes (`flash(45, 15, 8, 25, true)`) every 1.8–4.5s while `boss.alive`.

## GameScene.js — Key Methods

### Room lifecycle
```
loadRoom(spec) → _clearRoomEntities() → spawn walls/cover/enemies/terminals/pickups
               → drawDoor(sealed) → player spawn → events
```
On `_enemiesCleared && _terminalsHacked >= total` → `_maybeCompleteRoom()` → animate door open → advance

### Core juice helpers

| Method | What it does |
|---|---|
| `_slowMo(floor, durMs)` | Tweens `physics.world.timeScale` + `time.timeScale` from `floor` back to 1.0 |
| `_cameraPunch(to, durMs)` | Zoom snap to `to` over `durMs*0.35`, yoyo back (tracks `_cameraPunchTween`) |
| `_startBossFlicker()` | Repeating dim flash pattern while boss alive |
| `spawnBloodSplatter(x,y)` | 6–8 dot splotches added to `roomLayer` (persist until room change) |
| `spawnScorch(x,y)` | Small dark mark in `roomLayer` |
| `spawnCrater(x,y)` | Larger charred ring + ejecta in `roomLayer` |
| `_impactMicroFlash(x,y,r)` | Bright white circle tween, 90ms, scene-level (not roomLayer) |
| `_spawnDeathGlow(x,y,r)` | Orange ring expands 3.4× over 280ms |
| `_drawAimLaser(g,px,py,angle,range,startGap)` | Raycast to first wall, low-ammo flicker strobes alpha |
| `_tickKillCombo()` | Chain kills within 2s, emits `show-combo` |
| `performTakedown()` | `_slowMo(0.3, 380)` + `_cameraPunch(1.08, 420)` + `stealthKill()` |
| `_playDoorOpenAnim(spec)` | Two green panels slide apart over 380ms |

### Camera aim-lookahead
```js
// In update():
const aim = aiming ? player.aim : facing;
_camOX = _camOX * 0.92 + cos(aim) * 70 * 0.08;
_camOY = _camOY * 0.92 + sin(aim) * 70 * 0.08;
cameras.main.setFollowOffset(-_camOX, -_camOY);
```

### Player-fire events (all add camera kick)
- `player-fire` → `firePlayerPrimary` + `_cameraPunch(1.008, 90)`
- `player-fire-rifle` → `firePlayerRifle` + `_cameraPunch(1.012, 100)`
- `player-fire-super` → `firePlayerSuper` + `_cameraPunch(1.025, 180)`

### Bullet-enemy collision
Universal knockback: normal `kbScale=0.18`, super `kbScale=0.32`. Directional `burstDir` sparks on every hit. Super pellets = piercing + `fx.explosion`. Boss ignores knockback but still gets `burstDir` sparks with `yellow` color.

### Hack flow
```
Player near terminal → GameScene emits hack-prompt → HUD shows HACK button
Player taps HACK → GameScene.requestHack() → emits hack-start(terminal) → HackMinigame.start()
  During hack: fire stick disabled (shouldClaim guard), left stick still live (can walk away)
  Success → hack-success(terminal) → terminal.complete() → terminal-hacked event
  Fail → hack-fail → room-alarm → enemies alerted
```

### Stealth takedown flow
```
Player behind patrolling enemy → _updateTakedownTarget() → emits takedown-available(true)
HUD shows TAKEDOWN button → tap/Q → gameScene.performTakedown()
  → _slowMo + _cameraPunch + enemy.stealthKill() + SFX.takedown()
  → emits stealth-kill → "SILENT" damage number
```

### Reinforcement system
First alarm arms `reinforceTimer`. Countdown shown in HUD. On expiry, 1–3 enemies spawn at `spec.reinforce.door` already alerted.

### Lives system
`this.lives = 3`. On death: `lives -= 1`, respawn at room spawn if `lives > 0`, else `defeat()`.

## HUD.js — Key Details

### Buttons
- **HACK button** (amber, E key) — fades in via `setHackVisible(true)` when player near terminal. Pulses gently.
- **TAKEDOWN button** (green, Q key) — fades in via `setTakedownVisible(true)`. Both use `Back.easeOut` pop-in.
- **Super button** — drag-to-aim area top-right, fires `setSuperAimInput`/`releaseSuperAim`

### HackMinigame (owned by HUD)
- `hackMinigame.state` is checked in fire-stick's `shouldClaim` — blocks firing during active hack
- Only the right-half pointer events go to the hack tap handler
- `update(delta)` ticked from `HUDScene.update()`

### Ammo pips
- `_ammoPipPrevLoaded[]` detects reload completion → `_pulseAmmoPip()` (scale 1.55 → Back.easeOut)

### Overlays
- `vignette` graphics — low-HP pulsing red edge glow (below 30% HP, pulses faster near 0)
- `bossTint` graphics — soft red full-screen tint in phase ≥2 (5%), phase ≥3 (10%)
- `comboText` — reused text object for combo splashes (x2!, x3!, etc.)

## FX.js — Emitters & Methods

### Particle emitters
| Name | Color | Purpose |
|---|---|---|
| `sparks` | white | generic burst |
| `sparksRed` | red | enemy hit / blood |
| `sparksYellow` | yellow | boss hit / wall ricochet |
| `bulletTrail` | white dim | player bullet tail (called per frame) |
| `footDust` | grey | footstep puffs when running |
| `missileSmoke` | dark | super bullet exhaust |
| `pickupGlitter` | yellow | weapon pickup grab |

### Key FX methods
- `burst(x, y, color, count)` — omnidirectional spray (resets angle ops each call)
- `burstDir(x, y, color, count, flightAngleRad, spreadDeg)` — directional cone spray
- `muzzleFlash(x, y, angle)` — `wpn-muzzle` image, fades 110ms, origin (0.15, 0.5)
- `hitFlash(sprite)` — white tintFill 80ms
- `explosion(x, y, scale)` — plays `explode` animation
- `damageNumber(x, y, amount, color, big)` — floats up 40px, fades 650ms
- `dustPuff(x, y)` — called every 140ms while player moving fast
- `pickupSparkle(x, y, count)` — called on weapon pickup grab

### SFX (Web Audio synth — no files)
All sounds generated programmatically: `shoot`, `shootSuper`, `enemyShoot`, `hit`, `hurt`, `enemyDie`, `bossHit`, `bossDie`, `bossRoar`, `superReady`, `heal`, `uiClick`, `victory`, `defeat`, `waveStart`, `takedown`, `hackTick`, `hackComplete`, `alarm`

### BGM
Imperial March-inspired synth loop. `startMusic()` (once on first gesture), `stopMusic()` (on scene shutdown), `duckMusic(amount, restoreInMs)` (called on super/explosion).

## pixelArt.js — Sprite Painters

All sprites are procedurally painted into Phaser textures at `PreloadScene` time. All weapon overlays are EAST-facing (barrel points +X so `setRotation(angle)` orients naturally).

| Texture key | Painter | Notes |
|---|---|---|
| `player` | `paintPlayer` | 24×24, symmetric dome, 4-frame sheet (idle/walk/fire/hurt) |
| `grunt` | `paintGrunt` | 20×20, white trooper dome, 4-frame sheet |
| `shooter` | `paintShooter` | 20×20, black trooper dome, 4-frame sheet |
| `boss` | `paintBoss` | 40×40, Vader dome, 4-frame sheet |
| `wpn-pistol` | `paintPistolOverlay` | 14×8, EAST-facing |
| `wpn-rifle` | `paintRifleOverlay` | 20×8, EAST-facing |
| `wpn-enemy-rifle` | `paintEnemyRifleOverlay` | 18×8, EAST-facing |
| `wpn-saber` | `paintSaberOverlay` | 22×6, EAST-facing |
| `bullet` | `paintBolt` | 28×5, EAST-facing tracer (white core + colored glow + fading tail) |
| `bullet-super` | `paintMissile` | 18×8, EAST-facing (exhaust left, fins, bright nose right) |
| `muzzle` | `paintMuzzle` | 18×10, EAST-facing flame |
| `terminal` | `paintTerminal` | amber screen, LEDs, antenna |
| `backdrop` | `paintBackdrop` | tiled Death Star floor |
| Pickups | `paintPickup*` | `pickup-rifle`, `pickup-flamer`, `pickup-det` |
| `shadow`, `shadow-boss` | `paintShadow` | ellipse drop shadow |
| `spark`, `spark-red`, `spark-yellow` | `paintSpark` | 4×4 particle |

## Known Latent Bug

**Boss.js double `damage()` definition.** The class has two `damage(amount, knockbackVec)` methods. JS uses the last one (line ~228), which is a simpler version that skips the per-volley cap and doesn't call `super.damage()`. The cap (lines ~62–71) is effectively never reached. Fix: delete the second definition (line 228–234), keeping only the capped version.

## Recently Added Juice (last 4 commits)

### e452263 — low-ammo flicker, super flash, pickup magnet, sabre trail
- Aim laser alpha strobes via `sin(time * 0.022)` when ammo ≤ 1
- Super fire: `cameras.main.flash(150, 255, 150, 60, true)` warm orange wash
- WeaponPickup: 90px magnet range, 320px/s pull scaled by closeness
- Boss CHARGING state: red ghost sabre sprites every 50ms, fade 320ms

### 7546e39 — camera fire kick, enemy pre-fire ping, boss flicker, item bounce
- `player-fire` → `_cameraPunch(1.008, 90)`, `rifle` → `1.012/100`, `super` → `1.025/180`
- EnemyShooter: orange weapon tint 300ms before each shot, then cleared
- Boss room: ambient dim flash sequence every 2–4s while boss alive
- WeaponPickup: launches at scale 1.55 → Back.easeOut to 0.85
- Health orbs: launch at scale 1.8 → Back.easeOut to 1.0, then start pulse

## Pending / Suggested Next Steps

### High impact
- **Fix boss double `damage()` bug** — the per-volley cap is silently bypassed (second definition wins)
- **Title screen polish** — currently minimal, could use animated background, character portrait
- **In-game pause menu** — not implemented
- **Persistent stats** — `localStorage` under `crix.stats`: best chamber, clear time, stealth kills

### More juice (user's standing instruction: "keep stacking")
Next suggested batch:
1. **Door entry flash** — brief bright flash when transitioning between rooms (camera fadeOut/fadeIn already exists, but could add a white bloom)
2. **Screen edge directional hit indicator** — brief colored arc on the screen edge showing which direction damage came from (like modern shooters)
3. **Enemy "?" on hearing a shot** — when `_alertEnemiesNear` alarms an enemy via sound radius, show a "?" bubble briefly instead of the "!" (spotted) one
4. **Vader ground crack effect** — persistent radial crack graphic that appears on the floor when Vader enters phase 2 or 3

### Polish
- Audio mix pass (levels not tuned)
- Real device mobile QA (joystick feel, tap zones)
- `npm run build` → deploy to GH Pages (`dist/` → `gh-pages` branch)

## Running Locally

```bash
cd /home/user/crix
npm install
npm run dev        # Vite dev server → http://localhost:5173
npm run build      # Production build → dist/
npm run preview    # Preview production build
```

## Git State

```
Branch: claude/mobile-run-game-design-OZLYF
Last push: 7546e39 (7 Jun 2025 equivalent)
All changes committed + pushed
```
