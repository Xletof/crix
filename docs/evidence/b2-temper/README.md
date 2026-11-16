# B2 TEMPER — flagship combat feel and visual identity pass

**Status:** delivered for HUMAN handset testing (2026-11-16). TEMPER is an opt-in candidate over B2 (`&b2t=1`). It changes pixels only: B2-B's mechanics, R1, V2C, P1, P2-A3 and every frozen system are untouched, and nothing here is approved, frozen or a default. Section 1 is the assessment, written and committed before any code (`0f51c59`); sections 2–7 are what was built and measured.

## Playtest links (two)

1. **TEMPER — B2-B with the new visual language:**
   https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2t=1&b0=B2T
2. **Current B2-B, for comparison:**
   https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b0=B2B

Optional on either link: `&b2range=1` = the firing range; `&b2c=1` = the closure candidate's F-release targeting (independent of TEMPER; with both on, TEMPER draws the gun, bolts and Super, and the targeting marks stay).

## HUMAN test checklist

1. **The gun as the meter.** Fire at a group and watch the rifle, not the ring: lamps should climb from the breech to the muzzle (cyan, then blue, then periwinkle) and the whole gun should turn ice-white when the Super is ready. Can you tell ordinary, charging and full apart at a glance?
2. **The stream.** Bolts keep one size. A blue tip grows on each red bolt as the charge builds; at full the rounds are periwinkle. Does that read as power building, without glow? Is it clearly different from enemy green fire and red aim lasers?
3. **Sustained fire.** Hold the trigger through a magazine. Do the muzzle flash and the hit sparks feel crisp at speed, or too small?
4. **The Super.** Cast it in a crowd. No brown screen flash, no fireball: a white crown at the barrel, a brief dim, five ice lances, then the barrel glows and cools. Does it feel powerful, or too quiet?
5. **Facing away.** Aim up the screen: the hero's body hides the gun (as the approved hold does). Is the ring gauge enough there?

## 1. Assessment (judged from phone-size frames of B2-B, `before/`)

### What looks amateurish, and why

1. **The gun never changes.** The charge is an additive blob parked on the muzzle: a brown smudge that grows into a white ball (`before/b2b-gun-idle-0-35-70-100.png`). The one object the brief wants to carry the buildup is the one thing that stays the same.
2. **The charge colour is the stock heat ramp** (red, orange, amber, white). It is the default answer to "more", and it collides with the game's own colour rules: at 70% the bolts are the amber of the crates and hazard stripes, and at 100% they are white beads with no identity (`before/b2b-stream-0-35-70-100.png`).
3. **Power is shown as bloom.** Every bolt carries a round glow ball, so a stream reads as beads on a string, and the glow grows with charge. In a crowd the glows overlap into noise.
4. **Nothing is animated; everything is tweened.** Muzzle flashes and hit sparks are single stamps that are scaled and alpha-faded. Scaling makes pixel sizes drift off the art's grid, and alpha fades are soft where the rest of the art is hard-edged. Frame-by-frame shapes that erode through a palette ramp are what make pixel effects look authored.
5. **Soft light on hard pixels.** Radial glow sprites sit on 4px-grid art drawn with a one-pixel outline. The two languages do not belong to the same picture.
6. **The Super is spectacle without composition** (`before/b2b-super-cast-frames.png`): a yellow fireball at the barrel, translucent salmon wedges (the "spikes"), candy-striped pellets, and a full-screen flash that turns the whole deck brown for several frames. The moment is loud everywhere at once, so nothing in it leads the eye.
7. **Five colour families for one weapon system:** red bolts, amber and white charge, the hero's cyan accents, the ice-white and violet ready ring, and a yellow and salmon Super.

### What is strong and should be protected

- The stream itself: constant cadence, rounds advanced by frame lateness, sweep onto the next target, lethal bookkeeping. It is the best-feeling thing in the game.
- The hit hierarchy (one full flash, then a tint while the stream stays on a target) and rolled-up damage numbers.
- The three-band voice kit, built for a phone speaker.
- The P1 weapon sprites: outlined, lit from one side, held in a glove. They are the quality bar the effects should meet.
- The P1-B ready ring. Its ice-white and violet are the one deliberate, player-owned colour decision in the weapon system.
- The corrected tracer lifecycle (origin at the barrel, a streak that retracts into where its round stopped).

### Where spectacle is being confused with quality

Brightness, size and screen coverage are standing in for timing and contrast. The Super is the clearest case: its power is carried by a screen tint and a fireball, when it should be carried by a beat of anticipation, a clean release, and a visible consequence on the gun and on the targets.

### What is missing from the shooting fantasy

- **A weapon that is an object.** It has no states: no charge on its body, no heat after a discharge.
- **Authored frames** at the two points the eye lands every 100 ms: the barrel and the contact.
- **One colour story.** Nothing tells the player that the gun, the meter and the Super are the same energy.

### On the three weapon identities

Only the automatic exists (B2-1). The shotgun and the semi-automatic are proposals from the B2 design review; this pass does not build them. As design:

- **Automatic (built):** its personality is the sustained stream. It should feel like a tool that warms up and stays controlled, which is what this pass works on.
- **Shotgun (slot 1):** its problem is the Super, which is already a five-pellet shotgun blast. A shotgun primary needs the Super to become something else for that weapon, or the starter and the ultimate are the same verb.
- **Semi-automatic:** "deliberate" collides with auto-aim. Its precision has to come from geometry (piercing a line) and timing (a held shot), not from aiming skill the controls do not ask for.
- **Recommendation:** finish the visual and feel language on the automatic first. A language that works there (charge on the gun, authored muzzle and contact frames, one colour story) transfers to the other two as data; three weapons built on the current effects would triple the problem.

### Why fire and Super have beaten melee

From the B0 handset runs: the ordinary shot dealt 13–18% of damage, because the Super and Broken Wings killed targets first, and the Broken Wings meter was effectively always full. Under R1 the Super's own pellets refilled the Super, so shooting from range was a closed loop that never needed melee. Melee asks the player to cross the gap that the tactical enemies exist to defend, and nothing the gun does sets it up or is improved by it. B2-B removed the self-feeding, but it gave melee no role in the gun's rhythm. That is a mechanics question (see the recommendations); a pixels-only pass cannot answer it.

### One creative direction

**TEMPER: stored energy is cool and lives on the gun; spent energy is warm and leaves it.** One language for the gun, the bolt, the contact and the Super:

- **The gun is the meter.** Charge climbs the rifle's own pixels from the power cell to the muzzle as lit lamps: the hero's cyan first, then violet, ending in the approved ready-ring colours. At 0% the gun is the approved sprite, pixel for pixel.
- **Hue, not brightness.** Bolts keep one size and one brightness. Only their hue moves, from the hero's red toward violet, so a full weapon looks charged without being whiter or bigger.
- **Frames, not tweens.** Muzzle and contact are short frame-by-frame pixel animations at a fixed pixel size, eroding through a palette ramp. No additive blending anywhere.
- **The Super is a release, and the gun shows it.** A crisp crown at the barrel and ice and violet lances replace the fireball, the wedges and the screen tint; the lamps empty, and the brake glows dull red and cools.

### Where I disagree with the brief

- **"Moving highlights" on the gun** are weaker than they sound at this size. The rifle is 18 art pixels long, about 39 CSS px on a phone. A travelling glint is one pixel moving a few steps. Lit lamps that accumulate are legible at that size; a glint is decoration. I use motion only where it carries information: a lamp igniting, and the charge collapsing to the muzzle before a Super.
- **Three weapons now** would spread the work the brief asks not to spread (above).

### What a pixels-only candidate cannot change

Enemy reactions, hit-stop, camera, cadence, damage and the economy are frozen or belong to B2-B's balance. This candidate changes none of them, and seeded fights must stay identical to B2-B tick for tick. So it cannot fix the melee rhythm or make enemies react more physically. Those are in the recommendations.

## 2. What was built (`src/systems/b2Temper.js`)

| Piece | B2-B | TEMPER |
|---|---|---|
| Charge on the gun | an additive blob on the muzzle | ten lamps on the approved rifle sprite, breech to muzzle: cyan (1–3), sky (4–6), periwinkle (7–9), FULL in the P1-B ready colours. Metal next to a lit lamp takes its light. A new lamp ignites white; each shot flares the head lamp; at FULL a pulse runs to the muzzle every 1.1 s |
| At 0% | the same blob, dim | no overlay: the approved P1 rifle, pixel for pixel |
| Bolt | a streak plus trail, core, head and halo (5 sprites, 3 additive), growing and whitening with charge | one 78x15 slug, one sprite, the same size at every charge. A cool tip grows from the head in eighths; at FULL the round is periwinkle with an ice core |
| Muzzle | one stamp, scaled and alpha-faded, plus a glow | three authored frames (28 ms each): a lance and the brake's two side jets, lifting off, then embers. The jets take the lamp colour |
| Contact | one stamp, scaled and alpha-faded, plus glow and a floor pool | four authored frames (136 ms): a bar across the flight, fragments thrown back, embers. Warm, or cool once the tip passes the middle |
| Super wind-up | an additive ring | the lamps collapse into the barrel, then the brake (two frames in the shipped 70 ms) |
| Super blast | fireball, translucent wedges, disc, ring, 30 sparks, 3 casings, a warm full-screen flash | a four-frame crown and a three-frame hard ring at the barrel, over a 72 ms dim. The shipped effects still run, hidden |
| Super pellets | the red and white slug, stretched 1.9x in thickness, with smoke | an ice lance on the same 54x24 canvas with square pixels, and a periwinkle wake |
| After the Super | nothing | the lamps are dark and the barrel glows and cools through four steps in one second |
| OVERCHARGE rounds | whiter, bigger | a gold slug with the same tip rule |
| Blending | additive glows | NORMAL only |

**How it stays pixels-only.** The shipped Super effects draw `Math.random`, and enemy AI draws from the same stream, so removing them would change the fight. TEMPER lets that code run unchanged and hides what it creates: display objects are made invisible and emitted particles are moved off the world.

**Decisions the phone-scale spike forced** (gate 1, before the build):
- A red-to-violet hue ramp was rejected. Purple belongs to the Marksman, the Shock Captain and Vader's Force, and the ramp passes through it.
- Thin red bolts read like the Marksman's red aim lasers at phone size, so the bolt got body and the charge became a cool tip instead of a hue shift.
- Facing up the screen, the hero's body hides the gun (the approved hold rule). The ring gauge carries the charge there. This is a limit of putting the meter on the gun.

## 3. Evidence

- **Films, real time at 60 fps, phone size, B2-B left and TEMPER right, the same seeded fight tick for tick:**
  - `films/range-b2b-vs-temper-60fps.mp4`: charge from 0 to full on three static targets, a second at full, the Super, the barrel cooling.
  - `films/fight-b2b-vs-temper-60fps.mp4`: a Sector 3 MIXED ASSAULT wave with movement, a Super and an OVERCHARGE pickup. The debug panel in the corner is the encounter selector.
- **Stills:** `after/` beside `before/` (gun at 0 / 35 / 70 / 100%, the stream at the same four charges, the Super frame by frame, a crowd at phone size).

## 4. Verification

Logs are in this folder. The comparison build for the older suites is `2ee948c` (the B2-1 delivery), served on its own port.

| Suite | Result |
|---|---|
| `smoke-b2t` (new) | **32 / 32** |
| `smoke-b2c --old=2ee948c` | 46 / 46 (B2-B = the B2-1 delivery tick for tick) |
| `smoke-b2 --old=2ee948c` | 88 / 88 |
| `smoke-b1 --old=2ee948c` | 71 / 71 |
| `smoke-b0 --old=2ee948c` | 46 / 46 |
| `smoke-fx-p2a3 --only=10` (scope guard) | 4 / 4 |
| `smoke-controls`, `smoke-restart` | pass (16 restart checks) |
| `npm run build` | OK |
| `run-all`, `smoke-captel` | not re-run |

What `smoke-b2t` proves:

- **Pixels only.** `?b2=B&b2t=1` and `?b2=B` are the same fight tick for tick on the same build, over a held stream, four Supers and a Broken Wings chain, in three fights (MIXED s6, SWARM TIDE, MIXED s6 with god mode off): positions, hp, ammo, meters, every enemy, bolt and pellet, `Math.random` draws and events. In MIXED s6 that is 197 rounds, 4 Supers, 37 kills and 18,855 draws, with 32 shipped objects and 814 particles hidden. The same holds with `&b2c=1` on both sides.
- **The tracer fix holds under the skin:** 1,083 streak checks across kills, blank space in six directions, walls and a Super; 0 off the line, behind the barrel or ending anywhere but where the round stopped.
- **The gun:** lamp count and colour stage at seven charges; every gun frame keeps the approved rifle's silhouette and outline; the overlay matched the weapon's position, rotation, flip, origin and alpha in every rendered frame of a turn and a stream; it is off at 0, mid-combo (the blade) and dead.
- **The bolt:** one size (78x15) at every charge and for OVERCHARGE rounds; every TEMPER object in a stream is NORMAL blend at scale 1; a B2-B control shows the additive sprites the check looks for.
- **Frames:** at 60 fps and at 30 fps every round gets a flash and every flash shows all three frames; frame 0 is never skipped. The same for contacts.
- **The Super:** the five pellets have the shipped angles, damage and body (width 54, radius 27, circle); no camera flash and none of the shipped additive blast shapes is visible, while B2-B shows both (control); crown, ring and the four cooling steps are all seen.
- **Restarts:** one install per restart; nothing left behind at the title.
- **Cost:** peak pooled objects in the same fight 40 (B2-B) against 17 (TEMPER), none additive. The layer's own update cost is 0.02–0.04 ms per frame on either side, inside the run-to-run noise.

**One unexplained intermittent.** The `&b2c=1` pair diverged at tick 741 in two runs where it followed six other pages in one browser. It has never diverged in isolation (`--diag=1`, four runs of the fight, twice), and the suite now gives every parity run its own browser context (two clean full runs since). The three B2-B fights have not diverged in any run. I did not find the cause, so treat the `&b2c=1` + `&b2t=1` combination as the less proven one.

## 5. Files and flags

- **New:** `src/systems/b2Temper.js`, `tests/smoke-b2t.mjs`.
- **Changed:** `src/systems/b2Feel.js` (the skin's hooks; the B2-1 and closure drawing is unchanged when the flag is off), `src/systems/b2Flagship.js` (reads the flag), `src/systems/debug.js` (`b2t`), `tests/b0-scope.mjs` (the new module in B2's list).
- **Flag:** `&b2t=1`, valid only with `?b2=A|B`. Independent of `&b2c=1`.
- **Rollback:** drop the flag. Nothing else reads it.

## 6. Limitations

- **Untested on a handset.** Everything was judged in the harness at 390x844.
- **Facing up the screen hides the gun** (above).
- **The Super's impacts on enemies are the shipped warm effects.** They are frozen hit effects outside this candidate; by the language's own rule (spent energy is warm) they fit, but they were not redrawn.
- **Sound is unchanged.** The B2-1 voice kit already rises with charge; no new sound was tuned blind.
- **Enemy reactions, hit-stop, camera and cadence are unchanged** by design, so the physical weight of a hit is exactly B2-B's.
- **The first loud event in a room still flashes red** ("DETECTED"). That is the room alarm, not the Super.
- **The dim on the Super** darkens the play view by 42% for 36 ms, then 20% for 36 ms. It is skipped in low-quality mode.
- **A point-blank scrum facing up the screen shows the least.** The gun is behind the hero and the bolts are short, so the stream there is a few sparks (`after/temper-crowd-phone.png`).
- **The films' charge meter is slowed** (`b2x.meter` 2600 on the range, 1600 in the fight, on both sides) so the stages last long enough to see. The links use B2-B's real 1000.

## 7. Three recommendations for what to improve next

1. **Give melee a place in the gun's rhythm: a kill with Broken Wings reloads the magazine.** The automatic already has a natural gap every four seconds (40 rounds, then 0.9 s of reload), and the Super already refills it. If a melee kill does too, the empty magazine becomes the moment to go in, and the player comes out firing. It is one isolated rule, measurable with the B0 telemetry (melee casts per minute, reload time spent idle), and it asks nothing of enemy AI.
2. **Make hits physical on the target.** The biggest remaining gap in the shooting fantasy is that enemies barely react to rifle rounds: the 90 ms flinch is budgeted to once per 600 ms per target. A visual-only reaction on every hit (a one-frame recoil pose, or a 2 px shove of the sprite that does not move the body) would sell weight without touching AI. It needs a seam into the frozen roster visuals, so it needs its own authorization.
3. **Build the shotgun on this language, with its own Super.** The gun-as-meter, the authored frames and the cool/warm rule transfer as data. The shotgun's open design problem is that today's Super is already a shotgun blast; give that weapon a different release (one heavy lance that pierces, for example) and the three starters stop sharing a verb.
