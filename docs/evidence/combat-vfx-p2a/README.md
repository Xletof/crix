# P2-A — Blaster Fire & Impact (`?visualPilot=v2c&polish=p1&fxPilot=p2a`)

**Status: CANDIDATE — opt-in, presentation only, awaiting the HUMAN handset
verdict. Not a default; not approved; nothing frozen.**
Classification: **@@CLASS@@**

P2-A is the first part of **P2 — Combat VFX & Weapon Impact** (HUMAN
direction 2026-11-05; the earlier P2 — Arena Visual Identity Expansion — is
postponed, not cancelled). It covers the player's **ordinary pistol and DC-15
rifle fire only**: muzzle ignition → projectile travel → contact → a
short-lived response on bodies, armour, metal / cover and shields. Supers,
melee (Broken Wings), the cluster pod, every enemy weapon and Vader are out of
scope and unchanged.

It layers over the approved P1 presentation (`?visualPilot=v2c&polish=p1`),
which is unchanged; R1 (no flags) remains production; V2, V2B, V2C and P1 keep
their outputs (`smoke-fx-p2a.txt`, sections 1, 5, 11).

## Play it (GitHub Pages, deployed from `FRIX`)

| | link |
|---|---|
| **P2-A — this candidate** | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a |
| P1 — the approved baseline, for the side-by-side | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1 |
| P2-A in SWARM TIDE (Hangar, sector 3) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a&encdbg=swarmTide&room=hangar&sector=3 |
| …the same under P1 | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&encdbg=swarmTide&room=hangar&sector=3 |
| P2-A in CROSSFIRE (Hangar, sector 6) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a&encdbg=crossfire&room=hangar&sector=6 |
| …the same under P1 | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&encdbg=crossfire&room=hangar&sector=6 |
| P2-A against Bulwarks (VANGUARD, Junction, sector 5) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a&encdbg=vanguard&room=corridor&sector=5 |

The rifle is the DC-15 pickup (amber hexagon) in the Hangar. `fxPilot=p2a` is
honoured ONLY with `visualPilot=v2c&polish=p1`: on its own or with any other
mode it is ignored and the game is exactly that mode.

---

## 1. Baseline diagnosis (P1, measured before anything was changed)

Recorded on the approved P1 build at the real 60 Hz step, frame by frame
(`baseline/`): every claim below is visible in those frames.

| element | what the shipped game does | what that looks like |
|---|---|---|
| **Muzzle** | one `muzzle` image for both weapons, spawned at the bolt's spawn point (`PLAYER.radius + 12` = 34px) at flat depth 34 | the P1 barrel faces are at **42px** (pistol) and **48px** (rifle): the flash sits *inside* the gun, and depth 34 is under the whole y-sorted actor band, so the hero and his own weapon draw over it. **Not visible in any rendered frame** (`baseline/pistol-frames.png`, frames 0–2). |
| **Bolt** | one 60×15 `bullet` texture for both weapons, stretched ×1.45 (pistol) / ×1.52 (rifle) into a rigid ~88px bar; depth 26 | a stick that slides: the same length from frame 0 (lying back across the gun and the glove) to the end; no taper, so no read of direction or speed beyond displacement; pistol and rifle **indistinguishable**; the **same shape as the enemies' green bolts** (friend / foe by hue only); under every actor and every crate, so its head slides under the target before it lands. |
| **Trail** | a 0.28-scale white speck every other frame, 140ms | invisible at phone size. |
| **Body hit** | an 8px red ring (2px line, 150ms), 7 red sparks, 4 more omnidirectional from the body **centre**; the enemy's own white flash; the damage number | the white flash carries the whole read; the ring is the colour of every enemy threat ring and is ~9 CSS px on a phone. The bolt's hitbox is **30px in radius**, so the ring often sits in the air in front of the body. |
| **Metal / cover hit** | gold sparks straight back along the bolt, a grey ring, a white pop, the scorch decal — all at depth ≤ 27 | cover sorts at `y + 56` and its art overhangs its 70px collider by 21px a side: **the whole contact is drawn under the crate / console art. A shot into cover shows nothing** (`baseline/wall-frames.png`). |
| **Shield** | roster-v1 Bulwark: the frozen hard-light field answers the block itself. Any bearer **without** the field (a nemesis Bulwark, legacy art): a blue ring and `healingSparkle` — blue bubbles rising | the field is good and is left alone. The other path says "healing" for a block. |
| **Miss at range** | the bolt vanishes | fine — and P2-A keeps it a non-event. |

What works and was kept: the casing (gold, gravity), the scorch decals, the
enemy's hit flash and hurt frame, the damage numbers, the camera punch and
hitstop, every sound — none of it is touched.

## 2. Design decisions

One rule over everything: **the shot is one object from the barrel to the
contact** — ignition at the gun the player can see, a tracer whose length is
the distance it covered, and a contact at the surface the eye sees it reach.
Visibility comes from shape, contrast and timing, not size or particle count.

### Pistol — fast and precise
- **Ignition:** a sharp star at the **live P1 barrel face** (it rides the
  recoil and the hero's step): white-hot core, one long forward spike on the
  shot's line, two cross spikes, four diagonal flecks; full for ~20ms, then
  pulled back into the barrel (x shrinks faster than y) and gone by **66ms**.
  A soft warm glow under it at 0.6 alpha. Drawn just above the weapon (and so
  behind the hero when the gun is, facing north).
- **Tracer:** a white needle head with a red rim at the bolt, and a tapering
  red tail **54px** long — a *distance* behind the head (≈60ms of flight at
  900px/s), never a count of frames, and never reaching behind the barrel face
  it left from. Its rim rows start later than its core, so it ends in a point:
  direction is legible in a still frame.
- **Persistence:** when the bolt dies, the tail's back end keeps travelling at
  the bolt's speed into the end point — the light already in flight arrives.

### Rifle — substantial, a burst
- **Ignition:** a muzzle-brake blast: bigger core, a *blunt* forward cone and
  side vents (gas thrown sideways, which no pistol does). Two variants
  alternate shot to shot (vents square / raked forward), the first shot of a
  burst 15% larger: the burst has a **rhythm**. Barrel **heat** builds with each
  shot of a burst (a small ember at the muzzle, half-life 90ms) — sustained fire
  you can see between shots.
- **Tracer:** a heavier slug — a doubled white core, thicker rim, 21px tall
  against the pistol's 15 — with a **64px** tail. Three rifle bolts 70px apart
  read as three bolts in a chain, not a beam.
- **Contacts** are ~12–15% larger than the pistol's and throw one or two more
  streaks. Rate, burst count, recoil, damage, ammo and velocity are untouched.

### Contacts — by material
| surface | shape | where | depth |
|---|---|---|---|
| **Body** | a white core in a hot crescent facing the shooter (the struck surface lit), three rays splashing *back* toward the shooter and a short bite in; 4–5 red-orange streaks; **dark keyline** | on the body's **rim** where the flight line meets it (the 30px hitbox registers early) | over the struck body |
| **Armour** (Elite, ≥ 500 hp) | the same core with a **gold-white** crescent and rays raked *sideways* — energy skidding off a shell; replaces the generic amber ring at the body centre | rim | over the body |
| **Metal / cover** | the bolt flattens into a hard white bar **along the surface**, gold at its ends, a short spike back out; 6–8 gold streaks **reflected off the face** (two along it) with a little gravity, and a cooling ember (260ms) | on the collider face the flight entered, with that face's normal | **over the cover art** |
| **Shield** (a bearer without the field) | a short bow lying **on** the surface — red-hot at the strike cooling to the field-white the Bulwark's own curtain uses for "absorbed" — one pale glint back out, 4 pale streaks **glancing along the surface**; no splash into the body, no red; replaces the "healing" bubbles | on the shield arc | over the bearer |
| **Bulwark field** (roster v1) | nothing of P2-A's: the frozen field draws the block; the tracer only **ends on the field's surface** (46px), where the game says it crossed | — | — |
| **Shock Captain** | a small contact pip only — the actor answers for itself | rim | — |
| **Miss** | no contact: the tail drains at the end of its range | — | — |

The keyline matters: on the frames a body is hit, the enemy's own (frozen)
hit flash turns it white, and a white contact would vanish into it.

Every contact is gone in 110–130ms (the ember 260ms, the last streak ≤ 190ms);
at most **14** are live at once (the oldest is recycled), a clutter bound that
does not depend on fire rate — the same doctrine as the damage-number pool.

### Readability guards
- **Friend / foe:** player bolts are now a hot head with a tapering tail; enemy
  bolts are rigid bars. Hue *and* shape differ. No P2-A colour is green, the
  Shock Captain's blue-white, or a nemesis's orange body colour.
- **Not a Super:** no bloom disc, no shockwave ring, no camera flash; the
  Super (red-white slug, white bloom, ring, flash) is untouched.
- **Telegraphs** (depth 12, on the floor) and **damage numbers** are not
  covered for longer than a contact lives; contacts sit on the rim on the
  shooter's side and the numbers drift away from the shooter.
- **No floor field of particles:** streaks are line segments whose length is
  their speed, a fixed handful per contact, gone in < 0.2s.

---

## 3. Before / after

@@AB@@

## 4. Technical implementation

| file | what |
|---|---|
| `src/systems/debug.js` | `setFxPilot` / `isFxP2A()` — `fxPilot=p2a` AND P1 live |
| `src/systems/p2aPaint.js` | the twelve `p2a-*` textures (no `Math.random`) |
| `src/systems/p2aFx.js` | the seam: wrappers, parity twins, pooled tracers / flashes / contacts, one POST_UPDATE |
| `src/scenes/PreloadScene.js` | one call: `paintFxP2A(this)` |
| `src/scenes/GameScene.js` | one call: `installFxP2A(this)` after the P1 layer |

Not touched (section 10): `entities/` (`Bullet.js`, `Player.js`, `Enemy.js`),
`config.js`, `data/`, `FX.js`, `juice.js`, `HUD.js`, `pixelArt.js`,
`rosterPaint.js`, the V2/V2B/V2C painters and seams, P1 (`p1*.js`), the
Bulwark field and contact projector, roster weapon FX, the camera, light, AI
seams, nav, `rng.js`.

**How it stays presentation-only.**
1. The bolt keeps its texture, body, scale (the shipped tracer stretch) and
   every gameplay field; it is hidden by `visible` after `fire`.
2. The shipped fire and collision code runs **unchanged**; P2-A's wrappers only
   raise a context flag around it, and the fx calls it replaces are matched on
   their exact arguments inside that context.
3. Every replaced particle emission is performed into an **invisible twin**
   built from the live emitter's own config and killed at once, so every
   `Math.random` draw the shipped effect made is still made, in order (the
   Bulwark field's precedent). Draw-free calls (`impactRing`, `muzzleFlash`,
   the micro-flash) are simply not made. P2-A's own scatter uses a private
   mulberry32 stream.
4. Ages advance by `delta × time.timeScale`: a hitstop or slow-mo freezes the
   effects with the world. Every shape is keyed to time and distance, never to
   a frame count.

@@VALIDATION@@
