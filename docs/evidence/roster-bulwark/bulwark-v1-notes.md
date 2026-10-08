# Bulwark production integration (`shielded`) — HUMAN-APPROVED / FROZEN

**Flags:** `?roster=v1` (body, sidearm, field) and `?gait=v2` (the shuffle). Without
`?roster=v1` the Bulwark is exactly the legacy one. Nothing is a default.

**Status:** HUMAN-APPROVED / FROZEN 🔒 — PHASE 2C CLOSED on `cd4b0e9`. Final handset verdict: "Playtest pass all three" (circling facing, rapid fire against several Bulwarks, real VANGUARD with the Captain). Presentation only — every gameplay value
is the frozen one, and `src/entities/Enemy.js` is **untouched**.

**Handset round 1 (`d9e2d6d`):** broadly approved, with ONE blocker — the shield
changed strength as he turned. Corrected in the orientation pass below (`5169399`),
which round 2 approved.

**Handset round 2 (`5169399`):** three presentation issues — the sidearm drawn on the
field, a block reading as a flash rather than a wave, and a glass / windshield
material. Answered in the final visual integration pass below; waiting on the
handset for the final gate.

## Final correction (handset round 3): the broader membrane ripple + the display-facing wrap

**Round 3 on `bfb4a86`:** very close. Approved and protected:
- the body, sidearm, gait, material, geometry and orientation invariance;
- the layering, the absorption colours, rapid layering and the Super architecture;
- VANGUARD and the gameplay.

Two issues remained:
1. **The ripple read as a narrow rectangle sliding along the band.**
2. **After circling, a Bulwark sometimes kept the wrong body facing** and followed the
   player walking backwards.

### 1. The display-facing wrap (proved first, then fixed)

**Cause, confirmed.**
- `EnemyShielded._tickSwarm` turns the shield with
  `_shieldFacing += clamp(Wrap(toPlayer - _shieldFacing))` and never wraps the sum;
  `_aim = _shieldFacing`.
- Gameplay reads it only through sin / cos / Wrap, so the block test, the gun, the bolt
  and the vision cone are right at any value.
- `Enemy._facingSuffix` classifies RAW degrees: anything ≥ 135° or ≤ −135° is WEST.

**The human's case reproduces from spawn.** The shield starts north (−90°) and reaches a
south-west player the short way, through west, to **−225°**. From then on:
- south-east, east and north all draw the WEST sprite;
- gait v2, which reads the facing the sprite shows, walks the Bulwark backwards
  toward the player.

**Concrete failing angles** (`tests/diag-bulwark-facing.mjs`, the real AI turning the
shield):
- raw **−450°** (≡ −90°, NORTH) is drawn WEST;
- raw **−226°** (≡ 134°, SOUTH) is drawn WEST.

The same raw angle also set the sidearm overlay's flip (`|aim| > 90°`: an east-pointing
pistol drawn upside down) and its draw order (`deg ∈ (−135, −45)`: a north-pointing gun
drawn OVER the helmet, which also lifted the field cells on the gun over his body).

| path (frames judged against the angle they were drawn from) | `bfb4a86` wrong facing | `bfb4a86` walking backwards | NEW wrong | NEW backwards |
|---|---|---|---|---|
| the human's: SW → SE → round the east side to N (381 frames) | **309** | **142** | **0** | 18 |
| three laps counter-clockwise (1031) | 730 | 327 | 0 | 18 |
| three laps clockwise (1031) | 482 | 224 | 0 | 18 |

The 18 backwards frames left are all correct-facing: the first 0.3s after spawn, while
the shield is still turning toward a player behind it. `bfb4a86` has the same 18.

**Fix: display-only** (`src/systems/bulwarkFacing.js`, installed from the v1 Bulwark
hook).
- `_facingSuffix` resolves through the frozen implementation on the WRAPPED angle, so
  the boundary rules are its own.
- The overlay's flip and depth are re-derived from that same wrapped angle with the base
  class's own two rules, after the base has run.
- In range (|aim| ≤ 180°) both are exact no-ops: the display angle is the value itself,
  not `Wrap(value)`, because Phaser's `Wrap` is not bit-identical for an in-range input.
- **`_shieldFacing` and `_aim` are never written**: the replays compare them raw and
  match.
- Legacy (no `?roster=v1`) keeps the frozen method; the bug is still there, in frozen
  code.

### 2. The broader membrane ripple

**Cause, verified in the code.** The crest was one 3.4px Gaussian. With 4px cells that is
about one cell of colour, so each wave was a one-cell coloured stripe sliding along the
band. Behind it the wake filled the band's whole thickness from the contact up to the
crest: a flat slab. Nothing flexed: the old `bulgePx` constant was never wired into the
cell renderer.

**The new grammar: TWO SCALES on the same engine** (`waveAt`, same travel law, same
timings: 42px over 420ms, events still 720ms):

| | `bfb4a86` | NEW |
|---|---|---|
| crest | 3.4px σ (10px wide above a quarter of peak) | **4.0px σ (12px)**, saturated, cooling as it slows |
| pressure envelope | none | **asymmetric, 6px ahead / 11px behind — 25.5px wide.** Its light is the crest's colour softened 60% toward white (`envI` 0.45), and it densifies and brightens the frost (+0.30 alpha toward `0xfff6f4`) |
| membrane flex | none | **up to 4px outward** (`flexPx`, capped by `flexMax`). One cell: the rim and the navy keyline visibly kink where the envelope passes, and let go behind it. It ramps in over 70ms so the contact's own 5px dent reads first |
| wake | a full-thickness slab, contact to crest | its own channel, the same red → coral → pink → white by `tau`, **thinning toward the outer edge as it ages** (`clamp01(1.2 − f·(0.55 + tau/220))`), so it tapers behind the crest |

- **Rapid fire:** every hit is still its own event; the channels sum and the colours mix
  by intensity squared, so overlapping waves combine and stay readable.
- **Super recovery:** the same grammar, pale. A white crest inside a white-blue envelope
  (0.8 of the block's), a 2.4px flex, and a white → white-blue wake. No red.
  PUNCTURE → OPEN → HEAL is unchanged.

**Guards** (`smoke-bulwark` §4e, structure only; `bfb4a86` fails the envelope and the
flex):
- the envelope is at least 1.8× the crest width;
- both are bounded 4.5σ ahead of the front;
- a single block changes nothing beyond its own front plus 4σ (60ms: front 8.6px,
  changed to 29px; 300ms: front 34px, changed to 54px);
- band cells stand outside the idle edge ONLY around the moving front, at most one cell
  out;
- three rapid hits on one half each carry their own energy, the other half is untouched,
  and the reaction is 79 colours rather than one flash.

## Final visual integration (handset round 2)

**Round 2 on `5169399`:** the orientation fix was approved and is kept. Three things
were left:
1. The sidearm was drawn ON the field where the two crossed.
2. A block read as a flash, not as a wave travelling through the surface.
3. The material read as glass or a windshield laid over a pixel game.

This pass answers all three. It changes presentation only; every gameplay number
is the frozen one.

### 1. WEAPON < SHIELD

**Diagnosis.** The weapon overlay's depth is frozen in `Enemy.preUpdate`: y+1, or
y−1 when the aim points north. The field had two layers, near at y+2 over the body
and far at y−2 under it. `_aim` is `_shieldFacing` for this enemy, so the gun always
lies on the field's apex.
- Side-on, the apex sits on his centre line. The far half of the field is under the
  body (correct), the gun is over the body (frozen), and the gun therefore sat ON the
  far half where the two crossed.
- The cold pip (`ws.depth + 0.5`) and the discharge (`s.y + 2`, the same depth as the
  near layer, with display order as the tie-break) sat over the far half as well.
- body > far > gun > body is a CYCLE. No single depth for the far half satisfies it.

**Solution: a third layer, not a new body rule.**
- `farW` (and `glowFarW` for light) sits at `weaponSprite.depth + WEAPON_STACK.shield`.
  It receives ONLY the far cells that intersect the gun's own footprint.
- The footprint is the overlay's axis, from its origin to its tip plus 2px, and its
  half-width across that axis. The half-width is read once per texture from the
  painted canvas's opaque rows, so it is conservative by construction.
- Every other far cell stays under the body. Body occlusion is unchanged.
- Facing north, the overlay is at y−1, under his body, so `farW` is at y−0.7: under
  the body too. His helmet still hides what is behind it.
- The pip, the discharge and `farW` share ONE stack above the overlay's own depth:
  `WEAPON_STACK = { pip: 0.1, discharge: 0.2, shield: 0.3, light: 0.4 }`. Rotation
  cannot reorder them, because every entry rides the same base.
- The near layer (y+2) is above the whole stack, since the overlay is never deeper
  than y+1.
- Result: wherever gun, pip or discharge cross the field, the field is drawn over
  them, at every facing, for both tiers.

### 2. CRIX material — the field is built from the game's own pixel

The vector renderer (ten flat panels with soft edges) was replaced by a CELL renderer:
- **4px cells** on the SCREEN-ALIGNED grid anchored at the bearer's centre. That is
  the grid his sprite is painted on (sprite pixels are 4px steps from his centre), so
  the field's pixels and his always line up, however he moves.
- **Rejected:** cells on a grid that rotated with the facing. At the diagonals the
  rotated squares serrate the curved edge into a saw-toothed fringe.
- **Three value masses, not ten panels:**
  - a pale off-white FACE across the middle (|θ| < 0.25 of the half-arc);
  - ice-blue SHOULDERS;
  - denser TIPS.
- **Two hard bands across the thickness:** a denser outer band toward the energy edge
  and a thinner inner one toward him. Every cell is one colour at one alpha. There are
  no gradients, no seams and no sheens.
- **An authored edge:**
  - one cell of bright ice-white rim on the outer edge (`0xf2f9ff` at 0.86);
  - one cell of dark NAVY keyline outside it (`0x13223a` at 0.66), with navy CAPS
    beyond each tip so the coverage ends on an outline, as every sprite does;
  - a soft inner edge row, so the field never becomes a black cage.
- **Restrained interference:** one stepped current pulse crosses tip to tip every 3.4s,
  a column of cells per step.
- **Cross-section:** a flat band from R−11 to R+6 (17px of radial depth). The 2px lean
  is gone, because a cell field on the floor plane has no lean to give it.
  - Measured cell edge to cell edge, it is 16px on the axes (south, side and north
    alike) and 18px on the diagonals. The approved vector band read 19 / 17 / 15.
  - So this is a geometry change: the south apex is ~3px thinner and the north one
    ~1px thicker. It is reported, not hidden; the human judges it at 1x.
- **Unchanged:** the arc (±1.35), the curtain radius (46), the outer extent (R+6), the
  taper and the near/far rule. FAR = BEHIND THE BODY, never FAR = WEAKER.

### 3. The ripple — CONTACT → TRAVELLING WAVE → CONVERSION → SETTLE

ONE wave engine, `waveAt(d, t, S, T, crestPx, wakeMs)`, drives both the block and the
Super's recovery.
- **Contact:** the bolt flattens into a short red-hot smear, white-hot at its heart for
  the first ~85ms, and the surface dents 5px inward.
- **Twin wavefronts:** two narrow CRESTS leave the contact in opposite directions along
  the curve.
  - They travel s(t) = 42·(1.5u − 0.5u²), u = t / 420ms: fast out of the contact and
    still visibly moving through their whole life. A plain ease-out put 75% of the
    travel in the first 45% and then crawled.
  - The crest profile is a 3.4px Gaussian. It starts saturated red and cools along the
    ramp as it slows.
- **Conversion:** behind each crest is a WAKE whose colour is the time since the crest
  passed: RED → CORAL → PINK → WHITE.
  - RED = energy still in the field; WHITE = absorbed.
  - The wake fades on a 170ms time constant, so it settles behind the crest instead of
    lighting the band.
- **Settle:** the crests die about two thirds of the way to the tips. The event drops
  at 720ms, as before.
- **Local and bounded:** an event can colour nothing beyond 42 + 5 × 3.4px of arc from
  its contact.
- **Rapid fire:**
  - Every event is independent, holding its own offset and its own age (max 12 blocks).
  - Their intensities add, and colours mix weighted by intensity squared. A fresh red
    crest crossing a whitening wake passes through coral and pink rather than
    switching on a cell edge.
  - It is never a whole-field flash, and there are no particles.
- **North:** a dead-centre contact facing north is behind his helmet (legitimate
  occlusion). The crests carry the reaction out to the shoulders he does not cover.
  Reactions are still never drawn over the body.

### 4. Super — PUNCTURE → OPEN → HEAL → RE-STABILISE

The approved beats up to the snap are untouched: open 80, hold to 420, filaments
(stitches) 420-600, zipper 540-600, snap at 600. In cells:
- the gap is EMPTY cells;
- the stitches step every 45ms (electronics, not a breathing glow);
- the zipper fills from the outer edge inward;
- the snap is a white seam.

**New:** after the snap, two PALE crests run out from the healed seam on the block's
own engine: white crest, white→white-blue wake, 34px over 340ms. That is the field
re-stabilising, not a second explosion. There is no red in it. The projector pulse is
the same single restrained one.

The presentation tail is longer: `TEAR_MS` is 920 → 1110ms. The Super's gameplay
(penetration, damage, timing) is untouched; nothing reads these events back.

### Measured, `5169399` vs NEW

**WEAPON < SHIELD** (`tests/diag-bulwark-layering.mjs`). This instrument does not care
which renderer it measures. At each of 16 facings × 2 tiers:
- the gun is tint-filled magenta;
- the FIELD MASK is every pixel the field's six Graphics change (gun hidden, field on
  vs off);
- a LEAK is a mask pixel still pure magenta, i.e. the gun drawn on top of the field.

| | idle | shot frame (gun + discharge) |
|---|---|---|
| `5169399` | **5415 px over 20 / 32 frames** (every facing from W through N to E and SSE) | 5408 px over 20 / 32 |
| NEW | **0 px over 0 / 32** | 0 over 0 / 32 |

The first version of this instrument toggled the projector core with the field. The
core is painted on the gauntlet, under the gun by design, so it reported identical
"leaks" on both builds at 23° / 45° / 135°. It is excluded now: that was the
instrument, not the field.

**Idle presence per facing** (`tests/diag-bulwark-orient.mjs`, a Regular; sum =
visible pixels × mean luminance change, as a share of SOUTH):

| | E | N | W | NE / NW |
|---|---|---|---|---|
| `5169399`, bearer drawn | 0.88 | 0.63 | 0.81 | 0.66 |
| NEW, bearer drawn | **1.03** | **0.91** | **1.02** | 0.94 |
| `5169399`, bearer hidden | 0.94 | 0.85 | 0.93 | 0.90 |
| NEW, bearer hidden | 1.01 | **1.00** | 1.01 | 0.98 |

The top-10% rim luminance is 223 on NEW (243 before). The rim is `0xf2f9ff` at 0.86, a
pixel colour rather than a pure-white vector line.

**Reaction presence per facing** (bearer drawn; event frame vs the same facing idle):

| reaction | `5169399` E / N / W | NEW E / N / W |
|---|---|---|
| block 17ms (contact) | 0.58 / **0.07** / 0.52 | 1.00 / **0.77** / 0.99 |
| block 100ms | 0.61 / 0.19 / 0.52 | 0.90 / 0.68 / 0.97 |
| block 250ms (crests out) | 0.87 / 0.40 / 0.68 | 1.09 / 0.81 / 1.08 |
| block 420ms (wake) | 0.71 / 0.24 / 0.64 | 1.03 / 0.91 / 1.02 |
| block 100ms, 0.5 rad off-centre | 0.91 / 0.64 / 0.60 | 1.06 / 0.91 / 1.11 |
| tear 90ms (bloom) | 1.05 / 0.45 / 1.18 | 1.04 / 0.80 / 1.03 |
| tear 300ms (open) | 0.75 / 0.34 / 0.62 | 1.05 / 0.78 / 1.04 |
| tear 560ms (zipper) | 0.86 / **0.04** / 0.56 | 1.00 / 0.43 / 1.00 |
| tear 640ms (snap + recovery) | 0.89 / **0.03** / 0.95 | 1.00 / 0.41 / 0.99 |

- Side-on, the reaction now matches south (it was half).
- Facing north, a dead-centre contact is still behind his helmet. That occlusion is
  real and is kept. The crests now carry it out to the shoulders, which is why the
  block reads 0.68-0.91 where it read 0.07-0.40.
- The remaining north deficit is the seam at the dead centre (zipper and snap, ~0.4).

**Cross-section at the apex** (`smoke-bulwark`, cell edge to cell edge): 16px on the
axes and 18.2px on the diagonals. That is the same band; a 4px lattice crossed
diagonally spans a little more.

## Orientation invariance (the handset round-1 correction)

**The rule:** DEPTH MAY CHANGE; ENERGY STRENGTH MAY NOT. FAR = BEHIND THE BODY,
never FAR = WEAKER.

**Cause.** The renderer used its near/far split for two jobs, depth and strength:

| far-layer attenuation (removed) | value on `d9e2d6d` |
|---|---|
| panel material alpha | x0.5 (`farMul`) |
| panel seams | x0.5 |
| inner (soft) rim | x0.5 |
| OUTER (bright) rim | x0.32 (`farRim`) |
| dark keyline | not drawn at all on the far half |
| tapered tips | x0.5 |
| every event overlay (smear, bloom, filaments, zipper, snap, prick) and its light | x0.7 |

Facing south the field is all near layer, facing north all far, side-on half and
half. So it was a full shield south, half a shield east or west, a ghost north.

**Correction, three parts:**

1. **Strength.** Every style value is computed without knowing the layer.
   `_layer()` is the ONE place near/far is decided and it returns a Graphics, never
   a number. `farMul` / `farRim` are deleted. The keyline is drawn on both halves.
2. **The band's cross-section (geometry).** Measuring the alpha-fixed field showed a
   second orientation dependence. This floor has no foreshortening, so a band's
   screen thickness is its radial depth plus its LEAN times sin(bearing). The first
   cross-section leaned 7px (inner rim R−6, lifted 5px; outer R+6, 2px down), so it
   read **19 / 12 / 5 px** thick south / side / north — a thin arc from behind at
   any alpha. The inner rim is now R−11 on the plane (lean 2px): **19 / 17 / 15 px**.
   - The south view is unchanged at its centre (outer and inner rim at the apex are
     the same pixels).
   - The arc (±1.35), the curtain radius (46) and the outer rim (R+6, the field's
     visible size) are unchanged.
   - With the bearer hidden, the idle field facing north is now 0.85 of the south
     view's presence (was 0.55 with the old cross-section).
3. **Reaction routing.** Measuring each reaction showed that a contact on the centre
   line flipped layers on a hair. Side-on, a hit on the facing sits at his own depth,
   where the sidearm crosses the field. So a tear 0.1 rad north of the line went under
   the gun and one 0.1 rad south went over it: the same late tear measured 0.89 of
   the south view facing east and **0.12** facing west. A reaction is now FAR only
   when it is genuinely behind him, more than 30° north of his centre line
   (`behindSin`). West is now 0.95. The panels keep the plain split, because their
   depth is what puts him inside the field.

**Measured** (`tests/diag-bulwark-orient.mjs`; a Regular alone, field photographed on
and off):

| idle field | OLD | NEW |
|---|---|---|
| per-pixel strength facing N, vs S | 0.60 | 1.13 (the thin band is mostly rim) |
| rim brightness (top 10% luminance) S / E / N | 243 / 242 / **133** | 243 / 243 / 243 |
| visible presence facing N, vs S | 0.21 | 0.63 (bearer hidden: 0.85) |
| visible presence facing E, vs S | 0.62 | 0.88 (bearer hidden: 0.94) |

| reaction (bearer HIDDEN: the energy alone) | S | E | N | W |
|---|---|---|---|---|
| block, 17ms | 1.00 | 0.95 | 0.90 | 0.94 |
| block, 250ms | 1.00 | 0.90 | 0.84 | 0.89 |
| tear, 90ms (bloom) | 1.00 | 0.99 | 1.02 | 1.01 |
| tear, 640ms (snap) | 1.00 | 0.92 | 0.85 | 0.88 |

The residual 10-15% is the band itself (15px from behind against 19 in front).

**What is still orientation-dependent — body occlusion, and only that.** With the
bearer drawn, a DEAD-CENTRE reaction facing NORTH lands directly behind his helmet
and the north-pointing sidearm:

| reaction (bearer drawn) | S | E | N | W |
|---|---|---|---|---|
| block 17ms (smear) | 1.00 | 0.58 | **0.07** | 0.52 |
| block 250ms (pink) | 1.00 | 0.87 | 0.40 | 0.68 |
| block 100ms, 0.5 rad off-centre | 1.00 | 0.91 | 0.64 | 0.60 |
| tear 90ms (bloom) | 1.00 | 1.05 | 0.45 | 1.18 |
| tear 640ms (snap) | 1.00 | 0.89 | **0.03** | 0.95 |

That is the depth the human asked to keep: his body in front of what is behind it.
Making a north-facing contact readable through his head would need the event's LIGHT
drawn over the body, which this pass was told not to do. It is the human's call.

**Guards:** `smoke-bulwark` §4b, 11 checks. It draws the same field at S vs N and
E vs W across 22 states (idle and every block / tear / prick beat) and requires an
identical style stream with only the layer swapped. It also pins:
- the north rim at 0.92, the far keyline, and the far tips at 0.85;
- paired same-age hits on opposite halves;
- beside-him routing;
- no `far*` constants;
- the 19 / 17 / 15 thickness;
- depth routing and draw order.

8 of the 11 fail on `d9e2d6d` (`BLW_BASE` A/B). The depth checks pass on both, as they
should, since depth was never the bug.

## Architecture

| piece | where | what it is |
|---|---|---|
| body + sidearm art | `src/systems/rosterPaint.js` (appended section) | `ro-blw-R`, `ro-blw-E` (33 frames stock, 51 under `?gait=v2`), `ro-w-blw-R`, `ro-w-blw-E`; `BULWARK_GAIT`; `BULWARK_CORE`; `GAIT_CYCLE_PX['ro-blw'] = 40` |
| registration | `src/scenes/PreloadScene.js` | `registerRosterArt('shielded', …)`, the 18 animation keys per tier, the sidearm discharge texture |
| hook | `src/data/rosterArt.js` → `wearRosterArt` | `art.bulwark`: sets `_rosterFx = 'sidearm'`, `_weaponFx = makeSidearmFx(e)`, `_curtain = makeBulwarkCurtain(e)` |
| sidearm firing | `src/systems/bulwarkSidearm.js` (new) | cold READY pip on the frozen 300ms warning, a 1-frame cold-white discharge, a 1px / 50ms kick, render-only undo of the shot squash; pip and discharge ride `WEAPON_STACK` on the overlay's depth, under the field |
| the field | `src/systems/bulwarkCurtain.js` (new) | scene-side renderer on `POST_UPDATE`; per bearer: 3 material Graphics (near / far / `farW` over the weapon) + 3 ADD light Graphics + 1 ADD core, all on the bearer's `_attachments`; 4px cells on the bearer's pixel grid, redrawn only when the field's signature changes or a reaction is live |
| block / pierce routing | `src/scenes/GameScene.js` (the block branch only) | `e._curtain.block(contact, x, y)` instead of the legacy clang + sparkle; `e._curtain?.pierce(contact)` after `onPierce` |
| contact radius | `src/systems/shieldContact.js` | `CURTAIN_RADIUS = ENEMY.shielded.radius + 22` = **46 for both tiers** (it was 55 for the Elite) |

The frozen seams do all the gameplay talking: `_shieldFacing`, `_shieldHalfArc`, the
2.6 rad/s turn, `isFrontalHit`, and the contact `GameScene` projects onto the curtain
**after** the block is decided. The renderer reads them and writes nothing back. It
owns no timer, no tween, no randomness.

## Is `Enemy.js` untouched?

**Yes.** `git diff 3ce5680 -- src/entities/Enemy.js` is empty, and the base class is
byte-identical to `6560c62`; `smoke-roster-2b`, `smoke-roster-gunner` and
`smoke-bulwark` all check that. Nothing needed it.

- The legacy arc is hidden with `shieldArc.setVisible(false)`. The frozen class still
  draws it every frame; it is just never shown.
- The sidearm warning reuses the existing `_weaponFx` hook.

## Body

- **Regular:**
  - the broadest body in the roster: a 12-wide chest under two chamfered 4x4 pauldrons;
  - pale steel-blue plate (`#c3d1e7 / #92a6c7 / #64799a / #455672`) over a dark undersuit;
  - an angular wedge helmet: a flat crown, full-width cheeks, two face planes converging
    to a pointed chin either side of a vertical ridge;
  - ONE uninterrupted, unlit, cold visor slit (`#22364f`). No eyes, no face lights, no
    crest, no dome;
  - the projector gauntlet on the LEFT forearm with an ice-white emitter core;
  - the sidearm hand on the RIGHT;
  - a graphite generator on the back with a cold slot.
- **Elite:** the same body, helmet and face, plus:
  - a 6x5 gauntlet with a ringed 2x2 core;
  - a steel brace up the projector arm;
  - a conduit from the yoke to the projector;
  - a finned, larger generator housing;
  - a steel reinforced yoke.

  Its front silhouette is within 1 logical px of the Regular's (the brace). It has no
  tint and renders at scale 1. It keeps its **historical collider: 92.4px wide, radius
  33**; the Regular is 48px, radius 24.
- **The projector arm does not bob.** The gauntlet is painted against the base
  coordinates, so the torso settles over it while it holds still under the still
  field. `smoke-bulwark` checks that the core pixel sits at `BULWARK_CORE` on every
  front and side frame.
- **Mirroring:** the facings follow the existing mirror architecture. The west facing
  is the east one mirrored, so the projector stays on the far side and the sidearm on
  the near side.

## Sidearm and muzzle alignment

- **What it is:** a 28px pistol (7 gun pixels) in a gloved hand, at the end of an
  armoured forearm. The overlay is 60px long (Elite 68: the forearm is 8px longer at
  the back because the Elite's pivot sits 9px further out). For comparison, the carbine
  is 68px and the Gunner's weapon 84px.
- **Muzzle — maps honestly:** the drawn muzzle is `muzzlePastPivot(700) = 54px` past the
  pivot.
  - Measured: **74.0px** from the body centre against the bolt's first-drawn leading
    edge at **73.5** (Elite 83.0 against 82.5).
  - This holds on the bolt axis at 8 bearings × 2 tiers, including the flipped west.
  - The gameplay spawn (`cfg.radius + 4`) sits inside the weapon, and the overlay
    starts 14px out from the centre, so it never crosses the visor.
- **Known, frozen, and inherited from legacy:**
  - The gun is drawn on `_aim`, which this class sets to the SHIELD facing. The bolt
    flies at the player.
  - When the shield is still turning, the two differ. Measured at the moment of firing in
    two seeded VANGUARD replays: median **0°** in both, p90 **9.9°** / **0.5°**, and max
    **22.1°** / **97.3°**. The max is a player circling a held shield at the 140px close
    hold, faster than its 2.6 rad/s turn.
  - That is gameplay (the gun tracks the shield) and was not touched.
- **Firing language:**
  - A cold pip warms pale blue to white over the legacy 300ms warning (replacing the
    whole-gun orange tint).
  - Then a 4x3 cold-white / pale-blue discharge for one drawn frame plus 30ms of decay,
    and a 1px kick.
  - No bloom, no rotor, no body bob.
  - The projector is not the muzzle.

## Gait v2 — the heavy tactical shuffle

- **Anatomy:**
  - one pelvis; hip sockets 6 columns apart (the other roles: 4);
  - 3-column armoured legs with a lit knee plate;
  - 4px boots, both pointing the facing direction;
  - the far leg darker and allowed to vanish.
- **Stride:**
  - Compact: profile feet within +2/−3 of the hip.
  - A LOW swing: the travelling foot clears the deck by one row ('L'), never the full
    swing.
  - A planted foot on every walk frame.
  - Weight moves one column and one row, on the two load frames only.
- **Cadence:** the cycle is 40px of real travel. The planted foot slides 5 logical px
  per step, and the shared `rosterGait.js` tick drives it from real displacement. That
  is about 21 frames/s at 140px/s, under the 24 cap.
- **Measured motion relative to the displayed facing:** see the table at the end
  (`tests/diag-bulwark-gait.mjs`). In VANGUARD it advances ~57% of moving frames,
  strafes ~22% and moves against its facing ~17% (chasing with a lagging shield,
  knockback). The existing walk / backwards-walk / strafe selection covers it with no
  new mode and no new AI.

## The field — frosted hard-light curtain

(As of the final visual integration pass; the history is in the sections above.)

- **Shape:**
  - The arc is exactly facing ± `_shieldHalfArc` (1.35 rad).
  - The band is built from 4px cells on the bearer's own pixel grid and tapers to a
    point at each end, so the tips ARE the coverage.
  - The taper never thins below 6px, and the last thin stretch is all rim, so every
    tip ends on bright cells. A navy cap sits beyond each tip.
  - Three value masses (face / shoulders / tips) and two hard bands (a denser outer
    band and a thinner inner one).
  - A one-cell bright ice-white rim on the OUTER edge, a one-cell dark-navy keyline
    outside it, and a soft inner edge row.
  - Interference is one stepped current pulse, a column of cells every 3.4s.
  - The cross-section is flat: R−11..R+6, the same at every facing.
  - A first build put the bright rim on the inner, upper edge, and from the front it
    read as a tub he was standing in.
- **Depth:**
  - Cells south of his centre draw over the body and the sidearm (y+2). Cells north
    of it draw under the body (y−2), at the SAME strength. Only his body hides them.
  - Far cells on the sidearm's footprint draw on `farW`, just above the weapon:
    WEAPON < SHIELD.
  - A reaction's LIGHT goes under him only when more than 30° behind his centre line.
  - The field follows the body centre and the shield facing — never the walk cycle.
- **Tiers:** identical. Nothing in the field module reads `_elite` except where to put
  the core glow. The Regular and Elite fields are the same cells, colours and alphas.

## Block events

- **What an event is:** each block is its own event `{ kind: 'block', off, t }` in a
  bounded per-field list (max 12). `off` is the contact's angular offset from the
  facing, so a reaction stays on the surface while the shield turns.
- **Storage:** not the single overwritten `_lastBlockContact`. `GameScene` hands
  every contact to `_curtain.block()`. Ages run on the field's own clock, advanced by
  the frame delta in `POST_UPDATE`, and an event drops at 720ms.
- **The sequence** (final pass; see § Final visual integration):
  1. Contact: a short red-hot smear, white-hot at its heart for ~85ms, and a 5px
     inward dent (35ms in, ~100ms out, no overshoot).
  2. Twin wavefronts: two narrow red crests leave the contact in opposite
     directions along the curve. They travel 42px of arc in 420ms
     (`S(1.5u − 0.5u²)`) and cool as they slow.
  3. Conversion: behind each crest, a wake coloured by the time since the crest
     passed: red → coral → pink → white.
  4. Settle: the crests die about two thirds of the way to the tips; the event drops
     at 720ms.
- **Rapid hits:**
  - Energy is sampled per angular bin: intensities add, and colours mix weighted by
    intensity squared, drawn a cell at a time.
  - So a fresh red crest crossing a whitening wake passes through coral and pink
    rather than switching on a cell edge.
  - It is never a whole-field flash, and there are no particles.
- **Gameplay isolation:** presentation only. Nothing waits on these events, and nothing
  reads them back.

## Super events, and the multi-pellet decision

- **Recording:** every pellet through the front is recorded: `GameScene` calls
  `_curtain.pierce(contact)` for each one. The frozen `_lastPierceContact` is still
  written and still overwritten, untouched.
- **Coalescing (chosen):** one readable hole per volley.
  - The first pellet opens THE tear.
  - A pellet arriving while the tear is still opening (<120ms) and within 0.3 rad of it
    **merges**: the gap widens by 3px per pellet, capped at 18px.
  - A more CENTRAL pellet arriving in the first 50ms **takes the hole**, and the outer
    one becomes a pinprick. The first pellet to cross the body is often an outer one,
    and the hole should be where the volley went through.
  - Every other pellet while a tear is live is a **pinprick**: a small bloom and a 4px
    pinhole that heals on its own in 260ms, max 3.
  - So the contact data of every pellet is used, but never as five holes.
- **The beats (ms):**
  - 0-140: white bloom, ADD, largest faintest.
  - 0-80: the field splits; the edges peel 7px outward with white-hot torn edges.
  - 80-420: the gap holds open (13px half-gap).
  - 420-600: the edges pull in; three white-blue filaments re-knit across.
  - 540-600: the zipper closes the last of the gap from the outer rim up.
  - 600: a compact snap (seam cells + glow) and one restrained projector-core pulse.
  - 600-940: RE-STABILISE — two pale crests run 34px out from the healed seam on the
    block's own wave engine (white crest, white→white-blue wake).
  - Settled by ~1100ms (`TEAR_MS` 1110; it was 920). There is no red phase.
- **Why it is long:** a real Super arrives under the frozen generic hit language (the
  body's white hit flash, the pellet rings, CRIT numbers), which owns roughly the first
  250ms. The first build's gap was already closing by the time the frame was readable.

## Legacy FX suppression, and RNG parity

- **Suppression:** under v1, a Bulwark block does NOT call `fx.impactRing(…0x50b0ff)` or
  `fx.healingSparkle(…6)`. The field is the one author.
- **Parity:**
  - The legacy sparkle is a particle emission, and particles draw from `Math.random`,
    the stream the AI cooldowns use. Skipping it would shift every random number after
    the first block.
  - So the v1 path emits the **identical** 6-particle emission into an **invisible twin**
    of that emitter, built from the live emitter's own `config`.
  - Measured: 195 draws in both modes across six blocks.
  - **A/B:** with the parity emission removed, the seeded VANGUARD replay diverges at
    checkpoint 20, and the shot count goes from 40 to 39.
- **Legacy mode:** still draws the clang and the sparkle on every block (6 / 6).

### A second leak, found by the A/B video: an ELITE's death

- **How it was found:** the first A/B render reported the same fight at only 17 of 22
  checkpoints. A call-site histogram of `Math.random` across the divergent window
  pinned it to the frozen kill juice (`enemy-died`).
- **The cause:**
  - The kill juice sizes its particle burst (and glow, explosion and shake) by
    `enemy._baseScale`.
  - A v1 Elite renders at 1.0 against legacy 1.4, so its death emitted 10 fewer
    particles and made fewer random draws: Bulwark Elite 256 → 236.
  - The fight diverged after the first Elite died.
  - The earlier replay missed it because no Elite died in its window.
- **The fix (Bulwark only):**
  - `_makeElite` gives a v1 Bulwark Elite `_threatScale = 1.4` (its GAMEPLAY elite
    scale), and the kill juice reads `_threatScale || _baseScale`.
  - Its death is now the legacy death: 256 = 256 draws, the legacy-sized burst.
  - `smoke-bulwark` now checks death draws per tier, and the VANGUARD replay uses the
    A/B script, in which an Elite Bulwark dies.
- **PRE-EXISTING and NOT changed (frozen roles):**
  - The Gunner, Rifleman and Marksman Elites carry the same divergence since roster
    Phase 1: Gunner E 235 vs 195, Rifleman E 225 vs ~200 draws.
  - In practice: under `?roster=v1`, any fight in which one of their Elites dies stops
    being draw-for-draw identical to legacy from that death on.
  - Fixing it is one line (set `_threatScale` for every v1 elite) but changes the frozen
    roles' v1 death juice, so it is the human's call.

## Cost

The field redraws every frame, so its CPU cost was measured on this container
(desktop Chromium, loaded):

- **0.07 ms per idle field.** An idle field is ten flat panels drawn as ten segments;
  the five-per-panel sampling is used only while an event is live.
- **0.26 ms per field under constant fire.** Six Bulwarks each hit every 3 frames came
  to 1.6 ms per frame together.

A phone is slower. This is the number to watch if VANGUARD frame time is ever a
complaint.

**Orientation pass, before / after** (`node tests/shot-bulwark-orient.mjs perf`;
one instrument for both builds: six fields at six facings, median of 5 × 240 frames,
the old build served from a `d9e2d6d` worktree; two runs):

| ms per field per frame | OLD `d9e2d6d` | NEW |
|---|---|---|
| idle | 0.064 / 0.061 | 0.058 / 0.065 |
| every field hit every 3 frames | 0.375 / 0.356 | 0.347 / 0.364 |

No measurable difference. The far half now draws its keyline (ten more lines), which
is in the noise; nothing is drawn twice. The absolute "under fire" figure is higher
than the 0.26 above because this instrument hits all six fields every third frame at
spread offsets, so more five-sample panels are live; compare across the two columns,
not with the older figure.

**Final visual integration, before / after** (`node tests/shot-bulwark-orient.mjs perf`,
the same instrument; `5169399` served from a worktree; a RAPID case added: every
field hit every frame, which holds the 12-event cap full on both builds):

| ms per field per frame | `5169399` | NEW (4px cells) |
|---|---|---|
| idle | 0.071 | 0.068 |
| every field hit every 3 frames | 0.311 | 0.323 |
| rapid (every frame, 12 live events) | 0.402 | 0.380 |

This is parity. The cell field needs two things to get there. First, its Graphics sit
at the bearer and are drawn in its frame, so a field that only walks is never redrawn.
Second, it redraws only when its signature changes (facing, scan column, bush, the
overlay's depth offset, gun visibility) or a reaction is live; bearing-only work is
binned at 0.03 rad, and equal neighbouring cells merge into one rect per row. The first
cell build, without these, cost 2-2.6x the old field.

**Final correction (round 3), before / after** (the same instrument; `bfb4a86` served
from a worktree; the numbers are medians, and this container's load moves single
figures by ~10%):

| ms per field per frame | `bfb4a86` | NEW (wave v2) |
|---|---|---|
| idle | 0.074 | 0.087 |
| every field hit every 3 frames | 0.350 | 0.440 |
| rapid (every frame, 12 live events) | 0.378 | 0.494 |

**This is the envelope's real price, +0.1ms per field per frame under constant fire on
desktop.** Where it comes from:
- a second energy channel (the wake) and a pressure channel, accumulated per bin;
- a per-cell wake taper;
- pressure-varied colours, which merge into fewer fill runs per row.

Two cheap savings went in, and both are pixel-equivalent: the wake alone skips the
colour blend, and the taper slope is folded into the bin. A phone is slower. A VANGUARD
under fire carries 3-4 Bulwarks, so this is the line to watch if the handset ever
reports frame time.

## Gameplay invariance (smoke-bulwark, 90 checks)

- **Units:** hp, radius, body width and centring, speed, half-arc 1.35, turn 2.6,
  cadence 1500, bolt 700 / 120 / 520, and desired range 260 are identical legacy vs v1
  for both tiers.
- **Seeded VANGUARD replays** (case A, sector 8, wave 2, 1320 ticks; the A/B video's own
  script: hold while the front forms, fire into the shields, strafe, Supers at ticks 900
  and 1240; one Elite Bulwark dies in the window). Both **legacy vs `?roster=v1`** and
  **`?roster=v1` vs `+gait=v2`** are the same fight at all 88 checkpoints, matching on:
  - positions, velocities, AI state, aim, **shield facing**, screen hold, lanes,
    cooldowns, hp, collider;
  - player hp **and Super meter**;
  - the **VANGUARD front** (released / reason / time — released on `timeout` in this
    seed), **queue length and events spawned**;
  - live enemy bolts and every random draw.

  The same shots fire on the same ticks. The v1 fields absorbed 19 blocked bolts and 14
  Super pellets across 6 Bulwarks in that run, so the comparison is not vacuous.
- **Seams:** the frozen seam still records the contact, and blocks still do no damage
  and give no meter.
- **Deaths:** a Bulwark's death makes the same random draws legacy vs v1 (Regular 205,
  Elite 256).
- **Final visual integration:**
  - The two seeded replays above still match at every checkpoint on the cell field.
    That covers positions, velocities, shield facing, blocks, Super penetration, hp,
    meter, queue, VANGUARD release, shot ticks, projectile spawns and random draws.
    So does the RNG-parity draw count (195 / 195).
  - `5169399` vs NEW under the same VANGUARD script matches at 20/20 sampled
    checkpoints (`bulwark-shield-final-ab.webm`).
  - The field module still writes no gameplay field, owns no timer or tween, and draws
    no random number (asserted).

## Tests

- `tests/smoke-bulwark.mjs` (new, standalone like the other roster smokes): **59/59**.
- Amended deliberately:
  - `smoke-roster-2b`: it asserted the Bulwark stays on legacy art; it now asserts
    neither 2B firing cycle attaches to it.
  - `smoke-roster-seams`: `V1_ROLES` gains `shielded` / `shielded+E`.
- Amended deliberately: `smoke-roster-gunner`'s two "shielded keeps legacy
  presentation under v1" checks now assert it wears `ro-blw-R/E` (never the Gunner's
  sheets), with legacy gameplay.
- Regression results, run on this branch:

| suite | result |
|---|---|
| smoke-bulwark (new) | 59/59 |
| smoke-roster-2b | 72/72 |
| smoke-roster-gunner (amended) | 72/72 (before the amendment, 70/72 on exactly the two legacy-art checks) |
| smoke-roster-seams | 70/70 |
| smoke-gait-v2 | 16/16 |
| smoke-move-v2 | 9/9 |
| smoke-champion-placement | 60/60 |
| smoke-vanguard-screen | 22/22 |
| smoke-vanguard-front | 30/30 |
| smoke-vanguard-reinforce | **22/26 — PRE-EXISTING.** The same 4 surge/queue checks fail identically on the untouched `577c487` baseline, run twice on a second dev server. They are not caused by this work and were not chased. |
| smoke-encounters | 25/25 |
| smoke-encdbg | 33/33 |
| `npm run build` | OK (the chunk-size warning is pre-existing) |

**Orientation pass** (same branch, after the correction):

| suite | result |
|---|---|
| smoke-bulwark | **70/70** (59 + 11 orientation guards) |
| smoke-roster-2b | 72/72 |
| smoke-roster-gunner | 72/72 |
| smoke-roster-seams | 70/70 |
| smoke-gait-v2 | 16/16 |
| smoke-move-v2 | 9/9 |
| smoke-champion-placement | 60/60 |
| smoke-vanguard-screen | 22/22 |
| smoke-vanguard-front | 30/30 |
| smoke-encounters | 25/25 |
| smoke-encdbg | 33/33 |
| smoke-vanguard-reinforce | **26/26, twice.** The 4 surge/queue checks that failed in the first pass (22/26, identically on the `577c487` baseline) passed both times here. Neither pass touches what they test, so they are intermittent / load-sensitive rather than fixed. Not chased. |
| `npm run build` | OK |

**Final visual integration** (same branch, after the cell field, `farW` and the wave):

| suite | result |
|---|---|
| smoke-bulwark | **78/78** — §4 / §4b rewritten for cells; §4c WEAPON < SHIELD by structure (1046 crossing cells, none on the under-body layer) and by magenta pixels (64 frames, 0 uncovered gun pixels inside the field) |
| smoke-roster-2b | 72/72 |
| smoke-roster-gunner | 72/72 |
| smoke-roster-seams | 70/70 |
| smoke-gait-v2 | 16/16 |
| smoke-move-v2 | 9/9 |
| smoke-champion-placement | 60/60 |
| smoke-vanguard-screen | 22/22 |
| smoke-vanguard-front | 30/30 |
| smoke-encounters | 25/25 |
| smoke-encdbg | 33/33 |
| smoke-vanguard-reinforce | 26/26 (intermittent in the first pass; green here) |
| `npm run build` | OK (the chunk-size warning is pre-existing) |

How the new guards were checked against the build they replace:
- §4c's cell records do not exist on `5169399`, so its renderer-agnostic twin
  `tests/diag-bulwark-layering.mjs` is the A/B: 5415 leaking px on `5169399`, 0 on NEW.
- The STRUCTURAL guard was first written against the world matrix alone and passed
  blind on a real bug: `flipY` is applied in the renderer, and the flipped gun is wider
  than the strip. The magenta guard caught it.
- Made flip-aware, the structural guard finds 7 violations at the old strip width and
  0 at the new one.
- The 78-check suite went 72 → 77 → 78 over this pass. The six first-run failures were
  four errors in the guards and two in the renderer: the bins were not mirror-symmetric
  about the facing, and the tips were grid-dependent at some facings.

**Final correction (round 3):**

| suite | result |
|---|---|
| smoke-bulwark | **90/90** (+12: §4d display facing ×5, §4e wave ×5, the replay's painted-facing pair ×2). **On `bfb4a86` 83/90 — the 7 new guards that can fail do** (the four facing checks, the envelope, the flex, the replay's facing difference). The bounded / local / rapid checks pass on both, as regression guards should. |
| smoke-roster-2b / gunner / seams | 72/72 · 72/72 · 70/70 |
| smoke-gait-v2 / move-v2 | 16/16 · 9/9 |
| smoke-champion-placement | 60/60 |
| smoke-encounters / encdbg | 25/25 · 33/33 |
| smoke-vanguard-reinforce | 26/26 |
| smoke-vanguard-screen | 22/22 on re-run. One batch run failed "resumes and re-settles in the band" (re-settled at 114px); it passed on the idle re-run. |
| smoke-vanguard-front | **INTERMITTENT, and not this pass's gameplay.** It passed 4 of 8 runs on this build (twice on a fresh server) against 5 of 5 on `bfb4a86`. The failing check varies between runs: the surge check, or "the pair settles at the close hold / the lane is dropped". The surge check sleeps 2600ms of WALL time against a 3000ms GAME-time timeout, a fixed sleep racing a Phaser timer. The suite runs legacy presentation, which this pass does not touch: a seeded, stepped legacy VANGUARD replay is **bit-identical between `bfb4a86` and this build at all 88 checkpoints, all 30 shots and 14,002 random draws**. The instrument is the fix and was not changed here. |
| `npm run build` | OK |

## Handset URLs (Pages, after the FRIX fast-forward)

1. **Isolated Bulwark (VANGUARD without the Captain):**
   `?roster=v1&gait=v2&move=v22&encdbg=vanguard&room=hangar&sector=8&wave=2&nochamp=1`
2. **VANGUARD case A (with the Captain):**
   `?roster=v1&gait=v2&move=v22&encdbg=vanguard&room=hangar&sector=8&wave=2`
3. **CROSSFIRE + Captain (regression control, frozen):**
   `?roster=v1&gait=v2&move=v22&encdbg=1&room=hangar&sector=16&wave=3`
4. **Legacy comparison:** `?move=v22&encdbg=vanguard&room=hangar&sector=8&wave=2`
5. **Without the gait (stock walk):** `?roster=v1&move=v22&encdbg=vanguard&room=hangar&sector=8&wave=2`

## Evidence files

All are in this folder, from the real runtime, the loop stepped at exactly 1000/60.
The videos run at real 1× (30fps from every second tick). The rig is
`tests/shot-bulwark.mjs`.

1. `bulwark-v1-sheet-regular.png`, `bulwark-v1-sheet-elite.png` — the 51-frame
   `?gait=v2` sheets.
2. `bulwark-v1-facings.png` — S / N / E / W × Regular / Elite / legacy / the unchanged
   Captain.
3. `bulwark-v1-sidearm.png` (+ `-numbers.json`) — pivot, spawn, drawn muzzle and the
   real bolt's first frame, 5 aims × 3 tiers.
4. `bulwark-v1-colliders.png` — `?colliders=1`.
5. `bulwark-gait-v2-frames.png` and `bulwark-gait-v2-live.webm`.
6. `bulwark-shield-idle.png` (+ `-2x.png`) — front / back / side × R / E, and a
   VANGUARD pair.
7. `bulwark-shield-block-strip.png` and `bulwark-shield-block-live.webm` — a staged
   duel: one live Bulwark, the player firing at its front.
8. `bulwark-shield-rapid.webm`.
9. `bulwark-shield-super-strip.png` — row 1 is a REAL Super; row 2 is the field alone,
   via the real pierce seam.
10. `bulwark-shield-super.webm` — three real Supers, each into a fresh Elite at the
    sector-14 hp ramp.
11. `bulwark-vanguard-live.webm` — VANGUARD case A, sector 8, wave 2: front, hold,
    blocks, two Supers.
12. `bulwark-v1-ab.webm` — legacy vs `?roster=v1&gait=v2` under the identical script:
    the same fight at **22/22** sampled checkpoints. The first render said 17/22,
    which is how the Elite-death leak was found.
13. `roster-v1-hierarchy-4roles.png`.

**Orientation pass** (rig `tests/shot-bulwark-orient.mjs`; old-build panels are served
from a `d9e2d6d` worktree):

14. `bulwark-orientation-idle.png` — the same field at S / E / N / W, Regular and
    Elite, one frame, 1x and 2x. `bulwark-orientation-idle-OLD.png` is the same
    frame on `d9e2d6d`.
15. `bulwark-orientation-rotate.webm` — a Regular and an Elite turned through 360°
    in 9s, 1x and 2x.
16. `bulwark-block-4way.png` / `.webm` — the same real bolt at S / E / N / W on the
    same tick (contact, red spread, pink, white, recovered).
17. `bulwark-rapid-side.webm` — west- and east-facing fields, every hit PAIRED on the
    near and far halves on the same tick.
18. `bulwark-super-4way.webm` — part A: the same volley through the real pierce seam
    at all four facings, twice. Part B: a REAL Super into an Elite at each facing in
    turn (sector-25 hp ramp, so it survives the volley; generic FX included).
19. `bulwark-vanguard-orientation-live.webm` — real VANGUARD, the player circling the
    pair. The bearers' facings over the run: N 17%, E 27%, W 47%, S 9%.
20. `bulwark-orientation-ab.webm` — OLD vs NEW MATERIAL ONLY (old cross-section) vs
    NEW, one Regular turning with a real bolt into its facing every 0.9s.

The videos were rendered before the last change: an idle field drawn as one segment
per flat panel instead of five. That change leaves the geometry identical and moves
only the sampling of the faint sheen. The stills were re-rendered after it.

**Final visual integration** (rig `tests/shot-bulwark-orient.mjs`, steps named in
brackets; `5169399` panels served from a worktree of that commit). In the brief's
priority order:

21. `bulwark-vanguard-final.webm` [vgfinal] — real VANGUARD case A, 1x, the player
    holding while the front forms, firing into it, walking a loop round the pair, and
    two Supers (ticks 900 and 1240). Bearer facings over the run, in bearer-ticks: N
    825, W 2512, E 1162, S 492.
22. `bulwark-shield-final-ab.webm` [finalab] — `5169399` (left) vs NEW (right), the
    same VANGUARD, the same seed, the same script. **The same fight (sampled state
    identical) at 20/20 checkpoints.**
23. `bulwark-layering-rotate.webm` [layerrot] — a Regular and an Elite turned through
    360° while the sidearm charges and fires; 1x and 2x.
24. `bulwark-ripple-live.webm` [riplive] — single blocks at real speed, front-facing
    and side-facing; 1x and 2x.
25. `bulwark-material-ab.png` [matab] — `5169399` above, NEW below, at 1x: south /
    east / north / south-east (Elite), and a VANGUARD pair facing the player.
26. `bulwark-layering-4way.png` [layer4] — S / E / N / W × idle / charging / shot frame
    at 2x, plus a PROOF row with the gun tint-filled magenta.
27. `bulwark-material-rotate.webm` [matrot] — the cell material turned through 360°.
28. `bulwark-ripple-strip.png` [ripstrip] — one real bolt into a south-facing field:
    contact 17ms → compression 33 → twin crests leave 100 → travelling 167 → coral
    wake 250 → pink / white 333 → absorbed 483 → recovered; 1x and 2x.
29. `bulwark-ripple-rapid.webm` [riprapid] — rapid fire walked across a front-facing
    and a side-facing field.
30. `bulwark-super-heal-v2.webm` [superheal] — part A: the same volley through the
    real pierce seam at S / E / N / W, twice. Part B: a REAL Super into an Elite at
    each facing (sector-25 hp; the generic FX are included).
31. `roster-v1-hierarchy-bulwark-final.png` (`tests/shot-bulwark.mjs hierfinal`).

**Final correction (round 3)** (rig `tests/shot-bulwark-orient.mjs`, steps in brackets;
`bfb4a86` served from a worktree of that commit):

32. `bulwark-wave-v2-strip.png` [wavestrip] — the same block staged at the same ages on
    `bfb4a86` and NEW (contact 15 / early crest 60 / travelling 120 / mid 190 / coral
    wake 260 / white wake 380 / recovered), front- and side-facing; 1x rows and 3x rows.
33. `bulwark-wave-v2-live.webm` [wavelive] — repeated single blocks at real speed,
    front- and side-facing, 1x and 2x.
34. `bulwark-wave-v2-rapid.webm` [waverapid] — rapid fire walked across both fields.
35. `bulwark-wave-v2-super.webm` [wavesuper] — the tear and the pale recovery waves:
    part A staged at S / E / N / W, part B REAL Supers into an Elite at each facing.
36. `bulwark-facing-wrap-proof.png` [facingproof] — the same shield direction written
    four ways per cardinal (E: 0 / 360 / 720 / −360; S: 90 / 450 / −270 / 810; W: 180 /
    −180 / 540 / −540; N: −90 / 270 / 630 / −450): **`bfb4a86` draws the wrong body on 9
    of 16, NEW on 0.**
37. `bulwark-facing-circle.webm` [facingcircle] — `bfb4a86` | NEW side by side, the same
    seed: the player circles 2.25 times at 330px and the real AI turns the shield.
    `bfb4a86`: 605 wrong-facing and 310 backwards ticks; NEW: 0 and 18 (the spawn turn).
38. `bulwark-facing-human-case.webm` [facinghuman] — the human's path, side by side:
    `bfb4a86` 350 wrong-facing / 142 backwards ticks, NEW 0 / 18.
39. `bulwark-final-live.webm` [finallive] — real VANGUARD case A at 1x with the Captain:
    the player holds, fires into the front, walks a loop round the pair, and fires two
    Supers. Bearer facings over the run, in bearer-ticks: N 825, W 2512, E 1162, S 492.

## What is still weak at 1x

- **A full Super usually KILLS a Bulwark, so the tear is rarely seen in play.**
  - At sector 8 a Regular has 918hp and a Super pellet does 600 × dmgMult; two pellets
    kill it. The field goes with the body on death, exactly as the legacy arc did.
  - The tear / re-knit therefore plays mostly on Elites, on glancing Supers (1-2
    pellets), and at higher sectors.
  - The super strip and video use an Elite at the sector-14 hp ramp (the real
    formula), from 300px, where three pellets connect and it survives.
- **The first ~250ms of a real Super belong to the frozen generic hit language.** The
  white body flash, pellet rings and CRIT numbers sit on top of the bloom and split. The
  OPEN / HEAL half is what reads.
- **Blocked bolts visibly reach past the field before they die.** Gameplay kills them at
  body overlap, ~17px inside the curtain (1-2 frames of travel). Predictive hiding was
  deliberately NOT added — for the human to judge.
- **Back view:**
  - A north-facing shield sits behind his head and shoulders (this projection puts
    the combat plane there). It is the same material as the front view, but his body
    hides its middle.
  - A dead-centre block facing north starts behind his helmet, but its crests reach
    the shoulders (0.68-0.91 of the south view). The dead-centre seam of a tear
    (zipper and snap) is still mostly hidden there (~0.4); that is body occlusion,
    kept as asked.
  - The sidearm pointing north shows above the head, as every role's weapon does. Where
    it crosses the band, the band is drawn over it.
- **The cell band is ~3px thinner at the south apex** than the approved vector band
  (16 vs 19px; 16 at every compass facing, 18 on the diagonals). Judge at 1x.
- **The material is paler and airier than `5169399`.** The fill is translucent ice
  inside a white rim and a navy outline, where the old band was a denser grey. On a
  dark deck it can read as mostly outline. The alphas are one table
  (`CURTAIN.face / shoulder / tip`) if the handset wants it denser.
- **Rapid fire is busier.** Several broad swells at once cover more of the band than the
  narrow crests did. Each is still its own local wave with white wake between, and
  there is no single flash, but under sustained fire a side-on field carries a lot of
  coral. The envelope's light is one number (`CURTAIN.envI`) if the handset wants it
  quieter.
- **The flex is one cell.** At 4px it is the most the brief allowed, and on a 4px grid it
  is a one-cell kink of the rim and the keyline that travels with the wave. Judge it at
  1x: a sub-cell flex cannot be drawn on this grid at all.
- **Legacy (no flag) still has the facing bug**, in frozen code. Only the v1 Bulwark
  carries the display fix.
- **A pixel field re-rasterises as he turns.** At the diagonals the rim steps as any
  rotated pixel shape does; the tips end on rim cells within one cell of the coverage
  bearing at every facing. This is the trade for living on the sprite's own grid.
- **Profile:** the legs are 2px in profile under a broad torso; heavy, but the side
  figure reads top-heavy.
- **Sidearm vs shield lag:** see above — usually 0°, occasionally large when the player circles a held shield; frozen gameplay.

## Measured Bulwark motion (`tests/diag-bulwark-gait.mjs`)

Real displacement per frame against the facing the sprite shows. Seeded VANGUARD
(sector 8, wave 2), 1500 ticks, the player strafing a square and firing,
`?roster=v1&gait=v2&move=v22`:

| case | still | advance | strafe | retreat | gait mode: idle / walk / strafe | close hold |
|---|---|---|---|---|---|---|
| VANGUARD A (with the Captain) | 4.3% | 56.8% | 21.7% | 17.2% | 3.6% / 75.5% / 20.9% | 3.1% |
| VANGUARD, no Captain | 4.7% | 56.4% | 20.9% | 18.0% | 3.9% / 76.1% / 19.9% | 3.3% |

How to read it:

- The Bulwark never walks AWAY from the player. The "retreat" share is relative to its
  FACING: it chases a player who has circled past its 2.6 rad/s shield, and it takes
  knockback from unblocked flank hits.
- The existing gait-v2 selection covers all of it with no new mode:
  - the walk forward for advancing;
  - the walk played backwards for retreating;
  - the strafe cycle beyond 60° off the facing.
- No AI was added or changed.
