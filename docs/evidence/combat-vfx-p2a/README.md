# P2-A — Blaster Fire & Impact (`?visualPilot=v2c&polish=p1&fxPilot=p2a`)

**Status: CANDIDATE — opt-in, presentation only, awaiting the HUMAN handset
verdict. Not a default; not approved; nothing frozen.**
Classification: **P2-A READY FOR HUMAN VISUAL REVIEW**

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
| P2-A against roster-v1 Bulwarks (VANGUARD, Junction, sector 5: the field answers, the tracer ends on it) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a&encdbg=vanguard&room=corridor&sector=5 |
| P2-A against a nemesis Bulwark (a shield WITHOUT the field: the P2-A shield contact) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a&duel=shielded&nodlg=1 |
| …the same under P1 | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&duel=shielded&nodlg=1 |

The rifle is the DC-15 pickup (amber hexagon) in the Hangar. `fxPilot=p2a` is
honoured ONLY with `visualPilot=v2c&polish=p1`: on its own or with any other
mode it is ignored and the game is exactly that mode.

---

## 1. Baseline diagnosis (P1, measured before anything was changed)

Recorded on the approved P1 build at the real 60 Hz step, frame by frame —
the **A** half of every pair below is that baseline (`*/sheet-A.png`, every
tick): every claim in this table is visible in those frames.

| element | what the shipped game does | what that looks like |
|---|---|---|
| **Muzzle** | one `muzzle` image for both weapons, spawned at the bolt's spawn point (`PLAYER.radius + 12` = 34px) at flat depth 34 | the P1 barrel faces are at **42px** (pistol) and **48px** (rifle): the flash sits *inside* the gun, and depth 34 is under the whole y-sorted actor band, so the hero and his own weapon draw over it. **Not visible in any rendered frame** (`pistol/sheet-A.png`, ticks 0–2). |
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
  A soft warm glow under it (a tinted sprite at 0.6 alpha, normal blend — see
  Performance for why not additive). Drawn just above the weapon (and so
  behind the hero when the gun is, facing north).
- **Tracer:** a white needle head with a red rim at the bolt, and a tapering
  red tail **72px** long — a *distance* behind the head (≈80ms of flight at
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
  against the pistol's 15 — with a **66px** tail. A burst's three bolts fly
  70px apart, so the heads chain head-to-tail without merging into a beam.
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

Every pair is one **seeded** moment run twice — A (P1) and B (P1 + P2-A) — on
the same seed with the same inputs, rendered at the real 60 Hz step; the rig
(`tests/shot-p2a.mjs`) hashes the gameplay state (player, every enemy, every
live bolt, `Math.random` draws) at every tick and refuses to publish a pair
that differs. **All nine pairs are identical at every tick**
(`shot-p2a.txt`). A is on the left / top, B on the right / bottom.

| moment | folder | what to look at |
|---|---|---|
| **Pistol firing** | `pistol/` | tick 0–1: B's star at the barrel face (A: nothing visible); 1–8: B's tracer grows from the barrel and keeps its taper, A's 88px bar slides; 9–11: B's contact on the body's rim through his white hit-flash, A's ring in the air in front of him |
| **Rifle burst** | `rifle/` | the muzzle-brake blast (larger on the first shot), alternating vent shapes on shots 2–3, the barrel heat between shots, three heavy slugs chained 70px apart |
| **Projectiles in flight** | `pistol/`, `rifle/`, `multi/` | head + tapering tail vs a rigid bar; the enemy's green bolts in the same frames (`shield/`) are still rigid bars |
| **Metal impact** | `wall/` | a crate-console's face, straight on (tick ~13) and on a diagonal (tick ~27): B's flat white bar on the face, gold streaks reflected off it and falling, the ember; A's contact is entirely under the console art |
| **Enemy impact** | `enemy/`, `pistol/`, `rifle/` | a Gunner (roster v1) and a swarmling: the keylined contact on the rim, splash back toward the shooter |
| **Shield contact** | `shield/` (roster-v1 field), `shieldbare/` (a bearer without the field) | `shield/`: the frozen field answers, B's tracer ends on its surface; `shieldbare/`: B's bow on the arc with glancing pale streaks and no splash into the body, where A drew a blue ring and rising "healing" bubbles |
| **Multiple simultaneous shots** | `multi/` | four targets, a shot every 8 ticks across them |
| **High-intensity combat** | `fight-swarm/`, `fight-crossfire/` | SWARM TIDE (sector 3) and CROSSFIRE (sector 6) in the Hangar, 420 ticks each: pistol, then the rifle from tick 200, while moving |

In each close-up folder: `ab-phone2x.png` (A | B at **twice phone scale**,
the contact window tick by tick — the canvas shows at ~0.54x on a 390px-wide
phone, so x1.08 keeps the comparison honest and still inspectable),
`sheet-A.png` / `sheet-B.png` (every tick, 1:1), `ab-60fps.mp4` (A | B at 2x,
real time) and `ab-quarter-speed.mp4`. In each fight folder:
`ab-phone-size.mp4` (A | B, each **390px wide = phone size**, 30 fps),
`b-540.mp4` (B alone) and `ab-phone-NNN.png` key frames at phone size.

**What phone size shows.** At 0.54x the change is real but not loud. The
pistol's ignition is ~25 CSS px for ~4 frames where A showed nothing; the
tracer's hot head reads as the leading point of a streak, its tail as
direction, where A's bar read as a stick; contacts land on the body or the
crate face and read through the white hit-flash, where A's ring was ~9 CSS px
in the air. The rifle reads heavier and rhythmic without the HUD. P2-A's
pistol bolt is not *larger* than A's bar (A's 88px bar is long); it is
brighter at its head and shaped. Whether that is the right trade at handset
size is the first HUMAN question below.

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

## 5. Validation

### The P2-A smoke (`smoke-fx-p2a.txt`, `node tests/smoke-fx-p2a.mjs --old=<def85e5>`)

**78/78 passed** on the final build (`bebe258`), with the previous build
`def85e5` served on :5180 for section 11.

| section | what it proves |
|---|---|
| 0 the flag | honoured only as `fxPilot=p2a` with P1 live; ignored alone, with V2C alone, with V2 / V2B + polish, with other values; moves none of the seven gameplay switches |
| 1 textures | B = every A texture byte-identical — **`bullet`, whose width is the bolt's hitbox, included (60×15)** — plus exactly the twelve `p2a-*`; an ignored flag adds nothing to R1, V2C or V2B |
| 2 install | one POST_UPDATE and one shutdown listener; exactly thirteen instance wrappers (the pistol and rifle groups' `fire`, five scene methods, six fx methods); the Super, frag, enemy and deflected pools untouched |
| 3 projectiles | 8 bearings × pistol and rifle: every bolt's position, bearing, velocity, scale (the shipped tracer stretch), texture, body radius (30) and offset, damage, range, knockback and owner = A's, with A's draw count; under B the bolt is never drawn, its tracer head sits on it (0.0000px) and its tail never reaches behind the barrel face; the muzzle is on the live P1 barrel face (pistol 30px, rifle 42px past the grip) and over the weapon; the shipped flash is drawn in A, never in B |
| 4 contacts | body, armour (Elite), rifle burst into a Gunner, a wall straight on and on a diagonal, a bearer without the field, the roster-v1 field, a miss: hp, Super charge, miss events, field blocks and draws are A's in every case; contacts on the body's rim (exactly the radius) on the flight line and over the body; the tracer ends AT the contact; wall contacts on the collider face, normal toward the shooter, over the cover art; a block draws a SHIELD contact and no damage or credit; the field draws its own block (blocks +1 in A and B), P2-A nothing, the tracer ends on the field (46px); a miss draws no contact |
| 5 same fight | seeded replays, every tick's player / camera / enemies / bolts / clock scale / `Math.random` draws hashed: SWARM TIDE (production and legacy baselines), CROSSFIRE and BOMBER RUN, 1,500 headless ticks each with pistol, rifle, 2 Supers and 2 melee chains; 500 rendered ticks; 500 rendered ticks of CROSSFIRE in LOW quality — **B identical to A at every tick**, with P2-A demonstrably active (tracers, body / armour / wall contacts, parity particles counted); R1 and V2C with an ignored flag identical to themselves |
| 6 reader only | no `Math.random` inside the P2-A frame (400 ticks of fighting), no write to the clock, physics scale, camera, player or any bolt field; under a hitstop (timeScale 0.06) a flash ages 1.0ms per 16.7ms frame |
| 7 cleanup | 3 restarts + quit-to-title: the old layer destroyed, exactly one fresh layer, listener counts steady, no wrapper left at the title; the pools stay bounded; a paused scene freezes P2-A |
| 8 low quality | tracers, flashes and contacts drawn; no scatter, glow or ember created |
| 9 budget | 840 ticks of sustained fire: 46 P2-A display objects after warm-up, 47 after 600 more ticks (created once, reused); 40 contacts forced into one frame: 14 live, 26 recycled |
| 10 frozen files | nothing changed against `def85e5` in `entities/` (Bullet, Player, Enemy), config, data, the painters, P1, FX / juice, HUD, the Bulwark field and contact projector, roster weapon FX, camera, light, AI seams, nav, rng; GameScene / PreloadScene gained exactly the two imports and two install calls; the Enemy.js guard holds |
| 11 previous build | against `def85e5` served on :5180: R1, V2C and P1 textures byte-identical; SWARM TIDE R1 and P1 identical; **B's SWARM TIDE and CROSSFIRE identical to the previous build's P1 fight**; R1 with an ignored flag identical |
| 12 modes | a restart and a reload keep the mode (B installed, A absent) |

`--selftest` (`selftest.txt`) injects, in B only, a `Math.random` draw in the
P2-A frame, a 1px shift of the pistol bolt and a broken parity twin:
**SELFTEST OK** — sections 3, 5 and 6 fail as they must (8 checks).
`--selftest=twin` breaks ONLY the parity twins (P2-A skipping the shipped
effects' draws): every replay in section 5 diverges at **tick 80**, the first
P2-A contact — **SELFTEST OK**. The twins are what keep the fight the same
fight.

### Covering suites (the shipped game; P2-A absent — they prove the two install calls are inert)

| suite | result | what it covers |
|---|---|---|
| `smoke-polish-p1` | **73/73** (section 8 skipped: no 56b10d7 server) | P1 unchanged: flag, textures, install, banners, Super-ready, weapons, A vs B replays, frozen files, modes |
| `smoke-visual-pilot` | **97/97** (section 6 skipped: no old server) | R1 / V2 / V2B / V2C textures, bodies, replays, LIGHTS OUT |
| `smoke-bulwark` | **92/92** | the Bulwark field, its RNG parity twin, depth and reactions (P2-A's shield work stays out of it) |
| `smoke-roster-seams` | **70/70** | roster v1 seams |
| `smoke-leak` | PASS | primary fire isolated from the cluster pool |
| `smoke-restart` | PASS 16 | restarts leave no duplicate handlers |
| `smoke-rng` | PASS 17 | seeded runs reproducible, streams uncoupled |
| `smoke-score` | PASS 41 | kills, chains, wave bonuses |
| `smoke-title` | PASS 15 | |
| `smoke-debug` | PASS | debug menu / HUD sync |
| `smoke-readability` | **FAIL 1/19 in 6 of 10 runs** — and **4 of 7 runs on the previous build `def85e5`**, same checks | the documented load-sensitive Vader checks (FORCE PULL "planted" drift 43–83px against a 40px bar, the saber "comes back to his hand"); **pre-existing, not caused by P2-A** — every run is in `suites.txt` |
| `npm run build` | passes (the usual >500 kB chunk warning) | |

The covering suites run the shipped game (R1 and pinned baselines), where
P2-A is absent: they prove the install calls change nothing there. The full
`run-all` was not re-run; it stands at **46/52 under R1** (register #9).

### Performance (`perf.txt`, `node tests/diag-fx-p2a-perf.mjs`)

HEADLESS CHROMIUM ON A SOFTWARE RASTERISER — A vs B on the same idle box; not
a phone's absolute numbers. A heavy staged fight: a dense crowd (three
swarmling packs, eight troopers, more packs as they fall), the pistol then the
rifle fired every 3 ticks — far above a thumb's rate — into bodies and cover.

| metric | A (P1) | B (P1 + P2-A) |
|---|---|---|
| rendered `game.step`, median (600 ticks) | 14.4 ms | **14.9 ms** |
| rendered `game.step`, p95 | 979 ms | 938 ms (software-rasteriser spikes, both halves) |
| time inside the P2-A frame hook | — | **0.12 ms / frame** |
| one-time paint of the twelve `p2a-*` textures | — | 4.5 ms |
| texture memory | 68,618,676 B (173) | +72,568 B (+12 textures) |
| Game display list at rest / at the fight's end / peak | 116 / 202 / 270 | 120 / 248 / 295 (pooled, created once; invisible when idle) |
| peak live tracers / muzzle flashes / contacts / spark streaks | — | 11 / 3 / 4 / 24 |
| peak live particles in the shipped emitters | 261 | 184 (B's replaced emissions go to parity twins and are killed at once) |
| live tweens at the end | 10 | 8 (P2-A uses none) |
| tracers / contacts drawn; parity particles paid | — | 213 / 66; 691 |

**The blend-mode lesson.** The first build drew the glows with the ADDITIVE
blend. Each glow sits at its own y-sorted depth among the actors, and every
switch in and out of ADD flushes the sprite batch: **+4.1 / +4.3ms median per
frame** (two runs) against a 0.13–0.19ms hook. With the additive switches
removed B's frame time matched A's (`--exp=noadd`: 15.0 / 14.7ms); the spark
Graphics were not the cost (`--exp=nosparks`). The shipped build uses
NORMAL-blend tinted glows. History in `perf.txt`.

Allocation: P2-A's display objects are pooled — 46 after warm-up, 47 after
600 more ticks of sustained fire (smoke section 9) — and contacts are capped at
14 live; nothing is created per frame once warm. No `Math.random` anywhere in
P2-A; its scatter comes from a private mulberry32 stream.

## 6. Known visual limitations

- **At phone size the pistol tracer is shorter than the shipped bar** (72px of
  tapering light behind a hot head against an 88px rigid bar). It reads as a
  fast streak with a bright point rather than a long stick; it is not the
  bigger object on screen.
- **Vader is unchanged**: a pistol / rifle hit on him keeps the shipped gold
  ring and yellow spray, and his DEFLECTION returns the shipped red bar (both
  frozen Vader presentation). The deflected bolt therefore looks like the
  pre-P2-A player bolt.
- **The Shock Captain** gets only a small contact pip from P2-A: his armour
  layers answer for themselves.
- **The bolt still slides under cover art before it lands** (it is drawn at its
  own y-sorted depth, and cover's art overhangs its collider by 21px); the
  contact is then drawn over the art at the collider face — so a shot into the
  near face of a crate appears to strike slightly inside its drawn front edge.
- **The shipped dust trail and the gold casings stay** (both cheap, both
  draw randoms); the dust is nearly invisible under the tracer.
- **The scorch decal stays where the shipped game puts it** — at the bolt's
  position inside the cover's collider, usually hidden under the art.
- **Contacts ride the struck actor** for their ~110ms; on a kill the flash
  follows the corpse's slide.
- **Upgrades** that add pellets get a tracer and a contact each (bounded by
  the 14-contact cap); homing bolts draw their tail along the current heading.
- Judged on headless 720×1280 renders scaled to phone size and on films, not
  on a handset.

## 7. HUMAN review questions

1. **Pistol at phone size:** does the shot feel fast and precise — ignition at
   the barrel, a streak, a hit on the body — or is the shipped long bar's
   *presence* missed? (Lengths and brightness are single numbers in
   `P2A` in `systems/p2aFx.js`.)
2. **Rifle:** does it read as a heavier weapon and a burst without the HUD?
   Is the muzzle-brake blast too big?
3. **Metal:** does a shot into a crate or console now read as striking metal
   (the flat bar, gold streaks, ember)?
4. **Bodies:** does the keylined contact confirm hits without hiding the
   target or the damage numbers?
5. **Shields:** against a nemesis Bulwark (duel link), does the bow on the
   shield read as blocked, not as a hit? Against roster-v1 Bulwarks, is ending
   the tracer on the frozen field enough?
6. **Busy fights:** SWARM TIDE / CROSSFIRE — any clutter, any confusion with
   enemy fire or telegraphs?
7. Accept / refine / reject P2-A.

