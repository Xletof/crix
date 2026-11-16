# B2 TEMPER — flagship combat feel and visual identity pass

**Status:** assessment written 2026-11-16, before implementation. The candidate (`&b2t=1`, opt-in over B2-B) is described below as intent; the "Delivered" sections are filled in when it is built. Nothing here is approved, frozen or a default.

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
