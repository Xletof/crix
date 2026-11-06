# P2-A2 — Primary Carbine & OVERRIDE (`?visualPilot=v2c&polish=p1&fxPilot=p2a2`)

**Status: CANDIDATE — opt-in, presentation only, awaiting the HUMAN handset
verdict. Not a default; not approved; nothing frozen.**
Classification: **@@CLASS@@**

Built on P2-A (`fxPilot=p2a`, played by the HUMAN, not approved — its output is
kept unchanged for comparison). R1 (no flags) remains production; V2, V2B, V2C
and P1 keep their outputs.

## The HUMAN direction this answers (playtest of P2-A, 2026-11-06)

> The new projectiles are considerably easier to see. The pistol muzzle flash is
> too subtle, and with the shield or the Super-ready ring visible it is hard to
> see and looks obstructed. The rifle's model, projectile, firing presentation
> and feel are preferred. Make the current rifle presentation the STANDARD
> weapon; keep the pistol's firing behaviour as the STANDARD mechanics; the rifle
> pickup becomes OVERRIDE, activating its existing three-shot burst. Preserve the
> pistol for future use.

**One rifle, two ways to fire it.**

## Play it (GitHub Pages, deployed from `FRIX`)

| | link |
|---|---|
| **P2-A2 — this candidate** | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a2 |
| P2-A — the parent, for the side-by-side | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a |
| P2-A2 in SWARM TIDE (Hangar, sector 3) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a2&encdbg=swarmTide&room=hangar&sector=3 |
| P2-A2 in CROSSFIRE (Hangar, sector 6) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a2&encdbg=crossfire&room=hangar&sector=6 |
| P2-A2 against Bulwarks (VANGUARD, Junction, sector 5) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a2&encdbg=vanguard&room=corridor&sector=5 |

The OVERRIDE module is wherever the DC-15 pickup was: the Hangar's room pickup
(600, 360 — north, beside the shuttle's stairs), Reactor Junction's (700, 1160)
and the REWARD: TAKE ONE pair dropped by milestone waves (it and the cluster
pod). `fxPilot=p2a2` is honoured only with `visualPilot=v2c&polish=p1`.

---

## A — STANDARD rifle / OVERRIDE loadout

### What changes, and what does not

| | mechanics (unchanged — proven equal to P2-A and P1) | presentation under P2-A2 |
|---|---|---|
| **STANDARD** (no pickup) | the ordinary fire path: `Player._firePistol`, its ammo pool and recovery, 120ms cooldown, one bolt at 900px/s, its damage, range, body, recoil, `player-fire`, sound, camera punch, the `playerBullets` pool | the hero holds the **P1 rifle**; each shot is drawn in the rifle's language: the heavier white-hot head and tapered red trail, a **single** keylined muzzle-brake discharge (no alternation, no burst heat), rifle-size contacts |
| **OVERRIDE** (the rifle pickup) | internally still `'rifle'`: 27 rounds, three bolts a burst 75ms apart, 300ms between bursts, 940px/s, `playerRifleBullets`; empties back to no secondary | the **same rifle**; the P2-A rifle choreography a size up: alternating brake shapes, a bigger first shot, barrel heat that builds through a burst — and **primes** the moment the module is taken |
| **pickup** | same place, same collision, same timing, same inventory behaviour | a compact **OVERRIDE module** (a cartridge holding three rounds, contact pins on its leading edge) labelled `OVERRIDE / 3-SHOT BURST`, not a second rifle |
| **HUD** | the shipped panel, ammo bar and counter | `OVERRIDE  27` and the module with a painted `3-SHOT / BURST` caption; the cluster pod keeps its shipped panel |
| **empty** | `secondary` returns to none, exactly as shipped | the gun never changes model; only the firing mode returns to STANDARD |

The pistol is preserved: its P1 art (`p1-pistol`, `-hot`), its P2-A effects and
its firing logic are untouched and still drawn under R1, P1 and P2-A. Nothing
was renamed: `'pistol'` / `'rifle'` remain the mechanical identifiers.

### How it is built (one author per object)

- **Four identities kept apart:** mechanical weapon (`player.secondary`, the
  fire paths — never written by P2-A2), displayed weapon (the carried Image),
  projectile style (from the pool a bolt came from: `playerBullets` →
  STANDARD, `playerRifleBullets` → OVERRIDE), choreography (single vs burst).
- **The carried rifle** is a P2-A2 Image placed every frame by **P1's own
  approved hold code** (`_updateWeapon`), run against a read-only view of the
  player whose `secondary` reads `'rifle'`: P1's reach, grip, recoil, flip,
  front/behind depth rule and melee blade, with no copy of that code. P1's own
  weapon Image is hidden by `visible`, which P1 never writes — the precedent P1
  set for the shipped overlay.
- **No new Text objects.** Phaser's Text constructor draws `Math.random` for
  its texture key, which would change the seeded fight; the pickup label and
  the HUD line are re-worded with `setText`, and the `3-SHOT BURST` caption is
  painted pixel type.

## B — Muzzle visibility

### Why the P2-A pistol flash was hard to see

| fact (measured in code) | effect |
|---|---|
| the shield bubble (`Player.shieldRing`: a cyan fill and a **3px rim at radius 38**) draws at **player y + 3**; P2-A drew the flash at the weapon's depth + 0.5 (y + 1.5) | the pistol's kicked barrel face is at **35–42px** — on the rim, under it |
| the P1 ready ring (white, radius 46, pawls out to 55) draws at y − 3 | the flash sat over it but **white on white** at the same radius |
| the pistol's barrel face is 30px past its grip (rifle: 42px) | the pistol flash lived inside the clutter around the hero |

### The fix

- The ignition fires from the **live P1 rifle barrel face** (41–48px out with
  the recoil), outside the shield rim and on/just past the ring.
- **Foreground core:** in front of the body, the short-lived core is drawn just
  above the shield bubble (y + 3.5). **Behind the body** (facing north and the
  north diagonals — P1's own rule) it keeps the weapon's depth: the hero still
  occludes it, and it shows past his silhouette and through the translucent
  bubble.
- **A dark keyline** round the discharge separates a white-hot core from the
  white ring and the cyan rim.
- **The glow stays subordinate:** smaller and fainter than P2-A's rifle glow,
  under the shield (depth + 0.45), normal blend.
- The shield, the ring and the hero are not redrawn: their approved art and
  their relative order are untouched.

### Measured: is the ignition SEEN?

`smoke-fx-p2a2` section 6 renders the firing frame twice — with and without the
discharge — and counts the pixels it changes in an 88px box round the barrel
face, for 8 aims × 5 states:

| state | P2-A pistol flash (mean of 8 aims) | P2-A2 STANDARD discharge (mean of 8 aims) |
|---|---|---|
| nothing up | 358 px | **1,260 px** |
| shield up | 340 px | **1,261 px** |
| Super ready (P1 ring) | 360 px | **1,259 px** |
| shield + Super ready | 342 px | **1,266 px** |
| Super charging (gauge) | 364 px | **1,261 px** |

- **≈3.5× the visible ignition in every state, and no state costs it
  anything.** The shield took ~5% off P2-A's pistol flash (its rim covered the
  flash's core) and takes nothing off P2-A2's (the core is over the bubble).
  The ready ring took nothing measurable from either: its problem was
  white-on-white at the same radius — CONTRAST, which a changed-pixel count
  does not capture; the keyline is the answer to that, judged by eye in
  `readyfire/` and `bothfire/`.
- **Minimum over all 40 aim × state cases: 1,065 px** — no hidden flash in any
  direction, behind-the-body aims included.
- **Depth, all 40 cases:** in front of the body the core is above the shield
  bubble, the hero and the ring; behind the body (N, NE, NW) it is under the
  hero (occluded as the gun is) and still above the ring.
- Measured on the firing frame (the discharge's first, full-size frame); it
  lives 80ms (~5 frames at 60 Hz).

---

## Evidence (`A` = P2-A, `B` = P2-A2; every pair state-checked at every tick)

Every pair is one seeded moment run twice — A and B — with the same inputs at
the real 60 Hz step; the rig (`tests/shot-p2a.mjs --set=p2a2`) hashes the
gameplay state at every tick and refuses a pair that differs. **All nine pairs
are identical at every tick** (`shot-p2a.txt`). A left / top, B right / bottom.

| moment | folder | look at |
|---|---|---|
| **P2-A pistol vs P2-A2 STANDARD** | `standard/` | two shots at a Rifleman: the rifle carried, the single keylined discharge at its barrel, the heavier tracer, rifle-size contact; same shot, same tick |
| **P2-A rifle burst vs P2-A2 OVERRIDE** | `override/` | the module dropped on the hero and taken; the burst: bigger first discharge, alternating shapes, heat between shots |
| **Shield up while STANDARD fires** | `shieldfire/` | A's pistol star on the shield rim; B's discharge outside and over it; `ab-phone-full-*.png` at phone size |
| **Super ready while STANDARD fires** | `readyfire/` | the white ring and violet pawls round the hero; B's keyline keeps the core apart from them |
| **Shield + Super ready** | `bothfire/` | both rings at once |
| **Eight aiming directions** | `aim8/` | one shot every 10 ticks, E -> clockwise; north and the north diagonals keep the gun (and the core) behind the hero |
| **OVERRIDE pickup -> burst -> depletion -> STANDARD** | `sequence/` | full frame at phone size (`ab-phone-size.mp4`, `ab-phone-full-*.png`): the module pickup and its label (8), taken — the HUD reads OVERRIDE / 3-SHOT BURST (46), bursting (70, 110), empty and back to STANDARD on the same rifle (200, 262); A swaps rifle -> pistol |
| **SWARM TIDE** | `fight-swarm/` | 420 ticks, sector 3: STANDARD from the start, a real OVERRIDE module collected at tick 200 |
| **CROSSFIRE** | `fight-crossfire/` | 420 ticks, sector 6 (DARKNESS): the same |

Close-up folders: `ab-phone2x.png` (A | B at twice phone scale, the contact
window), `sheet-A.png` / `sheet-B.png` (every tick, 1:1), `ab-60fps.mp4` (A | B
at 2x, real time), `ab-quarter-speed.mp4`. Full-frame folders:
`ab-phone-size.mp4` (A | B, each 390px wide = phone size) and
`ab-phone-full-NNN.png` / `ab-phone-NNN.png` stills at phone size. Stills are
lossless RGB (a 256-colour palette washed the flashes' reds to cream).

**What phone size shows.** The STANDARD discharge is a clear point of light at
the barrel on the firing frames in every ring state — outside the shield rim,
over it, never merged into the white ring — where P2-A's pistol star sat on
the rim. The hero reads as carrying the same rifle throughout; OVERRIDE reads
as the same gun firing harder (the bigger first discharge, the alternating
shapes, the heat), and the HUD's `3-SHOT / BURST` is legible but small (~8 CSS
px). The pickup reads as a module, not a gun.

## Technical implementation

| file | what |
|---|---|
| `src/systems/debug.js` | `fxPilot=p2a2`: `isFxP2A()` true for `p2a` and `p2a2`, `isFxP2A2()` only for `p2a2`; both need P1 live |
| `src/systems/p2a2Loadout.js` | NEW: the carried rifle (P1's hold), the OVERRIDE pickup restyle, the HUD readout wrapper, the barrel prime |
| `src/systems/p2aFx.js` | bolt / muzzle STYLE from the pool (`standard`, `override`), their configs, the carried weapon as the muzzle source, the foreground core depth — all gated on P2-A2 |
| `src/systems/p2aPaint.js` | the five `p2a2-*` textures; the rifle muzzle shape drawn at an offset so it can carry a keyline (P2-A's textures byte-identical) |

Not changed against `514a385` (section 10): every other file in `src/`,
including `GameScene.js`, `PreloadScene.js`, `Player.js`, `WeaponPickup.js`,
`HUD.js`, `config.js`, P1 (`p1*.js`), `FX.js`.

@@VALIDATION@@
