# Arenas, environment light and pixel shape language — reference

**Status: all four arenas are HUMAN-APPROVED / FROZEN 🔒** — Vader Chamber (the
pilot, §10n), Hangar (§10q), Reactor Junction (id `corridor`, closed on
`68a76c4`, §10t/§10w) and Detention Block (closed on `e43cc60`, §10x–§10aa);
`HANDOVER.md` §10ab is the closeout. Topology, cover, art, normal power and the
LIGHTS OUT composition of each are closed. A fifth room inherits the RULES
below and none of the four compositions.

To see a room: DEBUG → LOAD VADER CHAMBER / REACTOR JUNCTION / DETENTION BLOCK
(then DEBUG → SPAWN VADER keeps the current room).

## Invariants

- **Light lives outside `roomLayer`.** `EnvLight` sources are ADD-blended at
  `ENV_LIGHT_DEPTH` (3), under the whole actor band — that depth is the
  readability gate. The `face` kind (ADD texture on the prop's own canvas at its
  depth + 1, clipped to its silhouette) is the one exemption, admitted only when
  losing the prop erases the room or when the art claims to emit.
- **Every source has two independent intensities** (`normal`, `emergency`); a
  dark state is authored, not dimmed.
- **No red in environment art** (red = saber, telegraphs, danger) and no small
  green points in dark rooms (green = enemy bullets). Amber is not red.
- **Baked floor art never draws tall solid mass on the open deck** — the backdrop
  cannot reach collision, nav or LOS.
- **Cover footprints are frozen** (70×70 bodies under 112px sprites); console
  archetypes vary art, never footprint. The console kit is opt-in by name, and a
  console's light is declared in `CONSOLE_KIT` in the sprite's own pixels.
- **Ask where a light LANDS, in pixels**, not whether a source exists.
- **Pixel shape language**: crisp horizontals, verticals, 45° cuts and constant
  integer cadences; large round objects get faceted angular housings. The fix
  for a crawling or soft edge is shape language, never filtering or antialiasing.
- **NavGrid clearance (fixed 23px) can disagree with physical clearance** —
  measure the largest body (Vader Ø112) when designing tight space.

---

## Trap ledger

Entries under the headings below were migrated from the root `CLAUDE.md` as it stood at `7d67bed` (`git show 7d67bed:CLAUDE.md`), keeping their wording. Anything since superseded carries a **Status (2026-11-02)** note rather than being silently rewritten.

### Status and doctrine

- **THE FOUR-ARENA ENVIRONMENT PILOT IS COMPLETE AND ALL FOUR ROOMS ARE
  FROZEN 🔒.** Vader Chamber, Hangar, Reactor Junction and Detention Block each
  closed on human handset play; `HANDOVER.md` §10ab is the closeout and carries
  the doctrine that travels. The chamber was the pilot (§10n): three pieces —
  `drawArchitecture` (baked floor forms in `pixelArt.js`), the `'chamber'`
  perimeter style, and `src/systems/EnvLight.js`. **To see it: DEBUG → LOAD
  VADER CHAMBER → DEBUG → SPAWN VADER.** `SPAWN VADER` alone deliberately does
  not change rooms, and a fresh endless run does not reach the chamber until
  sector 5, so pressing it on its own shows Vader in the hangar. A FIFTH room
  inherits the RULES and none of the four compositions — that constraint is
  what made these four different rooms instead of one room four times.

- **THERE ARE TWO STYLED ARENAS NOW, AND THE HANGAR IS THE PROOF THE FIRST ONE
  GENERALIZES.** `HANDOVER.md` §10q is the record. It reuses the RULES (large
  before medium before small, a calm centre, per-side perimeter jobs, emitter
  plus a spill shaped like its source, two independent intensities, contact
  shadows, no red) and reuses NONE of the composition. Corridor and Detention
  are still untouched and both smoke tests assert it. Do not propagate.

  > **Status (2026-11-02): SUPERSEDED.** All four arenas have since been
  > styled and frozen (§10ab). What survives is the rule: a new room reuses
  > the rules and none of another room's composition.

### Light: EnvLight, emissives and the dark state

- **ENVIRONMENT LIGHT LIVES OUTSIDE `roomLayer`, OR IT IS NOT LIGHT.** LIGHTS
  OUT multiplicatively tints that group; anything inside it gets multiplied
  toward black. That is why a screen baked into a console texture cannot stay
  lit through a blackout and why the old `_drawConsoleGlow` placeholder only
  existed in the dark. `EnvLight` is a separate set of ADD-blended Images at
  `ENV_LIGHT_DEPTH` (3) — above the floor decals, below the whole actor band, so
  it can never draw over a bullet, a telegraph or the saber. The readability
  gate is that depth constant, not taste.

- **AN EMISSIVE SOURCE HAS TWO INDEPENDENT INTENSITIES.** `normal` and
  `emergency`, lerped by the same scalar `_applyDarkMix` rides. A source that is
  `normal: 0` is DEAD while the room has power and only comes up when the bus
  drops — that is the whole difference between an authored second state and a
  dimmer, and `smoke-arena` fails if no source has the property.

- **A STACK OF HARD-EDGED SHAPES HAS EDGES, AND AT ENVIRONMENT SCALE THEY SHOW.**
  The saber's halo is six capsules with a ramped alpha and it works because the
  blade is small. The same construction at 150px is five visible rectangular
  bands, and a wall screen built that way photographed as a television in a box.
  `EnvLight`'s falloff is baked into two 128px textures instead; the box one is
  SEPARABLE (`alpha = f(x)·f(y)`) so it can stretch 8:1 without the corners going
  wrong. Consequence: `setPower` is N alpha writes and re-rasterises nothing.

- **`LIGHTSOUT.floor`/`.wall`/`.prop`/`.console` ARE STILL THE HANDSET'S NUMBERS.**
  The pilot raised them so its architecture stayed legible in the dark, broke six
  `smoke-vader` checks doing it, and PUT THEM BACK. The maroon trap that
  originally pinned them is gone (the pilot deck has no red in it), so they are
  movable on a new verdict — but making architecture readable in the dark is
  precisely how emergency power becomes "the normal room, dimmer".
  `docs/evidence/arena-pilot/ambient-ab/` is the matched pair.

- **A LIGHT AT `ENV_LIGHT_DEPTH` IS INVISIBLE UNDER A LARGE OPAQUE PROP.** Depth
  3 is below the whole actor band, which is the readability gate — and it means a
  source on a 352x328 prop's face is drawn entirely underneath it. The `face`
  kind is the ONE exemption: an ADD texture painted in the prop's own space, at
  the prop's depth + 1, whose rectangle IS the prop's rectangle, so anything it
  could hide the prop hid first. `smoke-arena` measures that containment against
  the live sprite's bounds. Do not widen the exemption to a source that is not
  bolted to an opaque object.

- **`emitter: false` IS A SPILL WITH NO SOURCE, and it has exactly one honest
  use:** the source is somewhere this layer cannot draw — painted into a prop's
  face — and what belongs on the deck is only the light it throws. Left on, the
  strip's crisp `TEX_FLAT` bar photographs as a second bright OBJECT lying on the
  floor beside the machine rather than as its light.

- **A HERO PROP'S DARK STATE IS TWO TEXTURES, NOT ONE DIMMER.** `prop-pod-glow`
  runs at 0.55 normal / 1.0 emergency; `prop-pod-emer` is **0 at normal power**
  and 0.95 under emergency. That second texture is the whole difference between
  "the machine is still there, dimmer" and "fixtures that were not lit a second
  ago have come up". `smoke-arena` fails if no face is reserved for emergency.

- **A CONSOLE'S LIGHT IS DERIVED FROM ITS ART, IN THE SPRITE'S OWN PIXELS.**
  `CONSOLE_KIT` in `src/data/consoleKit.js` declares each luminous region using
  the same numbers the painter used, and `loadRoom` converts them against the
  real placement. A hand-written screen coordinate is one edit away from glowing
  where a console used to be. Fault lamps are PAINTED PIXELS and never declared
  as light — a red LIGHT in the environment is a different claim from a red
  pixel of hardware.

- **NOT EVERY LAMP COMES ON IN A BLACKOUT.** Exactly one region in the console
  kit is dead at normal power and lit under emergency; nominal lamps do not get
  louder in the dark at all. A console must stay spatially identifiable without
  becoming bright scenery, and `smoke-arena` fails an `led` whose emergency
  figure exceeds its normal one.

- **A COVER OBJECT THAT DECLARES NO LIGHT IS NOT A CONSOLE.** Cover used to be
  tagged `_loClass = 'console'` unconditionally — the lightest LIGHTS OUT
  material — and the hangar's cargo crates survived a blackout as pale boxes
  brighter than the machinery. The tint is derived from `CONSOLE_KIT` now, not
  from a name list. `bush` carries no `tex` and stays a console, which is what
  keeps the unstyled arenas where they are. The objective terminal was in
  `roomLayer` with NO `_loClass` at all for its whole life; a null class falls
  into the generic strength silently.

- **A LARGE IDENTITY PROP NEEDS A SECOND STATE WHEN LOSING IT ERASES THE ROOM.**
  The shuttle was a flat black hole during LIGHTS OUT and the hangar's other
  landmark, the blast door, is off screen from half the room. It carries two ADD
  faces now on the hero machine's contract — but for the opposite reason, and
  this is a rule about AUTHORED STATE, not a template: not every prop, and
  certainly not every spacecraft, gets running lights. **Do NOT outline the
  craft.** Four running lights at the corners plus a canopy is the whole set; a
  lit wing perimeter flattens it into a gameplay marker and deletes the dark.

- **A PROP'S EMISSIVE FACE MUST BE CLIPPED TO THE PROP'S SILHOUETTE.** The face
  rectangle is the prop rectangle, which is what `smoke-arena` measures — but
  the honest claim is tighter: hull contamination has to stop at the hull, or it
  is a halo on the deck. `destination-in` composites the WHOLE canvas against
  the source of a SINGLE operation, so a mask drawn as one `fillRect` per row
  erases everything except the last row. One `beginPath`, N `rect`s, one `fill`.

- **THE FACE EXEMPTION IS NOT A TEMPLATE, AND IT HAS TWO ADMITTING RULES.** The
  shuttle carries two ADD faces because losing it erased the hangar's identity.
  That was read for a while as the ONLY rule, and `smoke-junction` asserted the
  junction carried zero faces on the strength of it — this room's dark identity
  is its architecture, so no prop qualified. Handset play found the hole. The
  second rule is **IF IT LOOKS LIKE AN EMITTER, IT MUST EMIT**: `prop-core`
  paints a stack of amber slats behind a grille, which is a claim that the
  machine is running, and LIGHTS OUT multiplies that claim toward black with the
  rest of `roomLayer`. The junction now carries EXACTLY ONE face, on that one
  prop, and `smoke-junction` pins the count at one in both directions — zero is
  the lie coming back, two is the hero machine's composition being copied.
  Neither rule licenses a face on a prop whose art claims nothing.

- **A LIGHT ON A LARGE PROP IS A LIGHT UNDER IT — AND CHECK WHERE IT ACTUALLY
  IS.** The depth trap is already above; the junction's reactor added a second
  half to it. Its only source was a radial `core` at (260, 352) while the lit
  slot it was supposed to be is at world y **168..272** — 130px away, down at
  the base skirt, under a 304x344 sprite, at a depth below it. Emitter invisible,
  falloff invisible except for a 25px tail that is the near-zero end of the
  gradient. It had been that way since the room was authored and no test could
  see it, because every check asked whether a source EXISTED. Ask where its
  light lands, in pixels: `tests/diag-junction-reactor-light.mjs`.

- **THE FLOOR IS NOT GLOWING, THE FLOOR IS CATCHING — and `emitter: false` is
  what makes that structural.** Detention's first dark state forbade every
  emitter and every pixel of spill on the escort floor, and the handset verdict
  was *too black and visually empty*: at the room's middle the camera shows
  y [102, 1298], which puts the north bank above the frame and the south bank
  behind the joysticks, so the rule kept every fixture out of the picture the
  fight happens in. What answers that is RECEIVED light — fourteen sources
  carrying `emitter: false`, each one an existing fixture's spill landing on a
  surface (SOURCE -> SURFACE -> FALLOFF), drawing a soft box and no `TEX_FLAT`
  bar. No hard edge means nothing can read as a painted mark; a lit bar lying
  on the deck is the full-width cyan strips this room was built to remove. The
  centre of the walk still receives nothing, and the width of that centre is
  DERIVED: x [720, 880] is the junction's 160px lane. `HANDOVER.md` §10y, and
  `smoke-detention` measures the emergency light budget inside the centre
  station's own view — 0.003 on the rejected build, 0.084 now.

- **A CONSOLE'S LIGHT WAS DRAWN UNDERNEATH THE CONSOLE, AND THAT IS THE
  GENERAL SHAPE OF THE BUG.** `EnvLight` draws every source at
  `ENV_LIGHT_DEPTH` (3) because that is the readability gate; a cover console
  sorts at `y + 56` under a 112px OPAQUE sprite. So a `screen`'s crisp emitter
  bar and the inner half of its wash are drawn under the object they belong to
  and only the ring of spill that clears the sprite's edge is ever on screen —
  which photographs as *a dark box with an LED strip installed behind it*, the
  handset's own words for a construction that was exactly that. **IF A THING
  VISUALLY CLAIMS TO CONTAIN A POWERED DISPLAY, THE DISPLAY ITSELF MUST EMIT
  BEFORE ITS HAZE OR ITS FLOOR SPILL CAN BE BELIEVABLE — the source has to be
  brighter than the evidence of the source.** The fix is the `face` kind, on
  the junction reactor's admitting rule (IF IT LOOKS LIKE AN EMITTER, IT MUST
  EMIT): an ADD texture painted on the object's OWN canvas so registration is
  structural, at its depth + 1, containing only the pixels the art already
  paints as powered — the chassis, bezel, keys and base are painted by neither
  pass and stay dark, which is what keeps a display embedded instead of pasted
  on. Declared per PLACEMENT (`cover[].faces`), never per archetype: two of
  detention's three are shared consoles standing in three approved arenas. And
  no test caught it for the kit's whole life, because every check asked whether
  a source EXISTED — **ask where its light LANDS, in pixels.** `HANDOVER.md`
  §10aa.

- **A HAZE AND A REFLECTION ARE DIFFERENT SHAPES, AND `EnvLight`'s KINDS COULD
  ONLY MAKE ONE OF THEM.** A `strip`'s spill is `len + reach` by
  `t + reach * 2.6` — its softness inflates BOTH axes, so a wide soft catch is
  necessarily a tall one. Detention's fourteen catches therefore landed as
  light in the AIR over the deck and came back from the handset as *the hazes
  are cool, but the floor still feels dead*. No intensity would have fixed it.
  A surface reflection is FLAT: long on one axis, shallow on the other, low in
  opacity, lying on the plane — the ASPECT RATIO IS THE MATERIAL CLAIM. The
  `floor` kind is the only one that states its own footprint (`w`/`h`/`angle`)
  instead of deriving it, and it never carries an emitter because the case has
  no `TEX_FLAT` branch. `HANDOVER.md` §10z.

- **HEIGHT IS WHAT MAKES A SOFT SHAPE VOLUMETRIC — a narrow tall one is a
  SHAFT OF FOG.** The first floor reflections were thrown 46x196 away from the
  wall that cast them, which is the intuitive direction and photographed as
  fog standing in the room: the haze failure in a narrower costume. 7:1 and
  shallow lies down. And CANT them a few degrees off the wall — level with it,
  two short bands parallel to a room's long axis are a lane in embryo.
  `smoke-detention` holds it generally: at least 3.2:1, no two sharing a
  footprint, none over 420px.

- **AN `led` MAY NEVER BE LOUDER UNDER EMERGENCY THAN AT NORMAL POWER, AND A
  FIXTURE THAT NEEDS TO BE IS NOT AN `led`.** A nominal lamp says the same
  thing whether anyone is watching or not. An interlock that ENGAGES when the
  bus drops is a `strip` at `normal: 0` — shaped like the bolt it belongs to,
  which is also what tells it apart from a lamp on sight.

### Colour rules

- **NO RED IN THE ENVIRONMENT.** The Vader chamber's floor used to carry four
  full-width CRIMSON strip lights at `stripEvery: 520`. Red belongs to the saber,
  the SABER THROW lane and the telegraphs, and the pilot deck spends none of it:
  screens cyan, cores and emergency strips amber, thresholds cool white, deck
  paint steel. The same rule killed a steel ring painted around the dais — a thin
  bright circle centred on the boss is the shape and placement of a circle
  telegraph whatever colour it is. `smoke-arena` channel-tests every authored
  source colour, and **AMBER IS NOT RED**: the first version of that check failed
  the emergency strips. The separator is how far green falls — amber holds it
  near two thirds of red, danger red drops it under a third.

- **`prop-crane` AND `prop-drum` USED TO SPEND SATURATED RED ON DECORATION** —
  seven crimson hazard bars across the gantry beam and a 24x12 red label panel
  on each of three drums. Both are amber now. Both textures are hangar-only.
  The exit's `[ SEALED ]` bar stays red because it is gameplay UI.

- **`stripEvery` AND A `ring` FLOOR MARK ARE BOTH LOADED GUNS.** The junction
  shipped with NINE full-width saturated orange-red bars at `stripEvery: 150`
  and TWO concentric amber rings at r=250/300 centred exactly on the objective
  — a circle telegraph's shape, size and placement, on the square metre where
  the boss fight resolves. `smoke-junction` fails on either coming back.

- **GREEN IS BULLET COLOUR, AND IN A DARK ROOM THAT MATTERS.** The no-red rule
  is three arenas old; this one is newer and narrower. Enemy bullets are green,
  so a scatter of small green environment points along both walls during LIGHTS
  OUT is incoming fire that is not there. Detention's containment lamps are
  cold white-blue and its two emergency systems are amber. `smoke-detention`
  channel-tests both ends of every source colour.

- **A LAMP ON EVERY REPEATED MODULE IS AN OUTLINE OF THE PLAYABLE SPACE.** Two
  parallel dotted lines of lock lamps down detention's long walls is a corridor
  drawn in light, which is the giant-emergency-outline failure wearing a new
  costume. Five lamps north and three south, at irregular gaps, keyed to the
  same occupancy the wall painter draws: a handful of doors that still have
  someone behind them, not a run of them.

### Floor and architecture

- **BAKED FLOOR ART MAY NEVER DRAW A TALL SOLID MASS ON THE OPEN DECK.** The
  backdrop is one image and can never reach `this.walls`, so nav, LOS and bullet
  collision cannot see it — which is exactly why `drawArchitecture`'s vocabulary
  is all flat or recessed. A painted machinery block on the fighting floor would
  promise cover the room does not have. Machinery goes in the perimeter band,
  where the world bounds already are.

- **A TRENCH AND A TRACK ARE DIFFERENT CLAIMS.** A trench is a hole with a grate
  over it; a track is two rails set flush into the deck with sleepers between.
  Both recessed, so neither lies about collision — but reusing the chamber's
  trench in the hangar would have been reusing its composition, which is the
  one thing the second arena was not allowed to do. Same for `region`: it seams
  its VERTICAL sides by default because the chamber's regions are all tall, and
  a wide region needs `edge: 'h'` or its boundary is drawn where nobody looks.

- **BASE THE FLOOR ON THE DECK VALUE, NOT ON A RECESS.** The hangar's first
  build used `hgRecess` as the base and every authored region read as a pale
  rectangle painted onto a dark one. With the deck as the ground value the
  apron lifts off it and the staging bay drops into it, which is what a region
  is supposed to do.

- **APPROACHES DROP, THE JUNCTION LIFTS — but a recess laid on too thickly is a
  HOLE.** `recess` at alpha 0.8 over the junction deck lands near `#151b22`,
  and a near-black rectangle in a top-down game does not read as a floor one
  step down. It reads as a pit, which is the one lie a room may not tell about
  where the player can walk. 0.62 is a step; 0.8 was a void.

- **A PIPE LYING IN A RECESS MAY NOT BE LIGHTER THAN THE DECK ABOVE IT.** The
  `conduit`'s first crown was `#454f5a` against a `#242b31` deck and every run
  photographed as a raised girder lying ON the floor. Body under the deck
  value, only the narrow crown just above it — and the collars go one step over
  the PIPE, not over the deck, or every joint reads as a bracket bolted on top.
  Same family as the shuttle borrowing the `imp*` top end.

- **A `rib` AT FULL STRENGTH IS AN OBJECT.** It draws a near-black surround
  under its face, and that outline is what makes it read as something standing
  on the deck rather than as a change in the floor. Four threshold ribs at full
  value photographed as four bright posts across the approaches. `alpha` fades
  the surround along with the face; 0.5 turned them back into lips.

- **A CONDUIT UP THE MIDDLE OF AN APPROACH IS A MAST POINTING AT THE FIGHT.**
  Centred in the north way it was a bright vertical axis aimed straight down at
  the objective from the top of the frame. Held against one edge of the way it
  is what plumbing in a passage actually looks like and the way stays open.

- **THREE RECESSED FLOOR PRIMITIVES, AND THEY ARE DIFFERENT CLAIMS.** A
  `trench` is a hole with a grate (chamber), a `track` is rails with sleepers
  (hangar), a `conduit` is a large-bore pipe in a bed with flanged collars
  (junction). Reusing one is reusing a room's composition, which is the single
  thing each arena pass is not allowed to do. A conduit's cross-section is FOUR
  HARD BANDS, never a gradient — a smooth ramp of value is the one thing this
  game's surface vocabulary does not contain.

### Props, cover and consoles

- **A BIG ROUND PROP DEFAULTS TO A DIAL, AND A DIAL IS A UI WIDGET.** Concentric
  rings plus radial spokes is what a large circle becomes if you let it. The hero
  machine's circle is only the HOUSING; what sits in its well is a RECTILINEAR
  plant block. Its seams are five at irregular bearings, not six at 60° — an
  unbroken plate is what makes the broken ones read as joins. The same instinct
  produced the thing that was replaced: one big illustrative crescent across the
  lid, and a red bar over a red bar in the middle that read as a lowercase "i".

- **AN ARC ON A LARGE ROUND PROP MUST BE SEGMENTED.** One continuous lit arc
  fails twice: on the upper-left of a circle it IS the illustrative crescent, and
  a long unbroken arc on a big round object starts reading as a capture zone or a
  boss AoE. The hero machine is five short tubes over <40% of its circumference,
  at two colours, on opposite rims. Broken segments read as fixtures.

- **A HOUSING LIT OVER HALF ITS AREA IS LIGHTER THAN THE DECK IT STANDS ON.** The
  first hero build filled the whole northern half with `chMachLit` and
  photographed as a pale grey donut — the opposite of a heavy object. The lit
  band is a CAP: twelve rows out of seventy. Related: a recess catches light on
  its SOUTH inner wall, because light comes from the north here; inverted, a hole
  reads as a dome.

- **THE HERO MACHINE'S FACES ARE PAINTED ON THE PROP'S OWN CANVAS** (88x82 at
  scale 4, same as `prop-pod`), so registration with it is structural rather than
  arithmetic. That costs ~924KB of mostly-transparent texture and it is the
  deliberate trade. Cropping them puts a hand-computed origin offset between a
  light and the object it belongs to.

- **A CONSOLE ARCHETYPE MAY NOT CHANGE ITS FOOTPRINT.** Cover bodies are frozen
  at 70x70 under a 112x112 sprite and feed the nav grid, the LOS rects and
  bullet collision. The HEAVY console reads heavier through mass, value and
  density inside the same 28x28 canvas; a physically wider one would be art
  promising cover the room does not have. `smoke-arena` measures every kit
  texture against `bush`.

- **THE CONSOLE KIT IS OPT-IN BY NAME.** A cover entry may carry `tex` and a
  spec may carry `coverTex`; anything that says neither gets `bush`. The kit's
  textures are painted for every room — textures are global and cheap — and only
  a room that ASKS receives one. Same shape as the `emissives` opt-in, and the
  same reason: a shared painter that defaults to on is how one arena's language
  becomes four.

- **A LARGE PROP OCCLUDES A COVER CONSOLE STANDING BEHIND IT.** Props sort at
  plain `y`, cover sorts at `y + 56`, so the hero machine at (340, 740) draws
  over the console at (440, 440). The heaviest console was moved to the
  south-west pillar for that reason. Positions are frozen — the thing that moves
  is WHICH TEXTURE stands on which frozen spot.

- **A WALL-MOUNTED PROP MUST NOT SORT BY ITS Y.** Props Y-sort at plain `y`
  because y is their ground contact, and a control panel bolted to a wall has
  none — sorted that way it occludes actors hundreds of pixels away at the far
  edge of the room. `prop.depth` exists for exactly this; the wall panels use 6,
  above the floor decals and below every actor. And `emitter`/`reach` on a
  mounted panel has to clear the 112px SPRITE, or the light is drawn underneath
  the object and the panel reads as bright rather than as lighting anything.

- **CARGO IS NOT ALLOWED TO OUT-SHOUT HARDWARE.** The first crate palette was
  '#39352b' / '#4a4436' and photographed as the brightest object in the room —
  warm enough to read as timber, louder than the lit terminals beside it.
  Freight sits ONE step above the deck. It also carries no emissive source at
  all, and that is deliberate: five of the hangar's eight cover objects going
  out is what keeps its dark state dark.

- **AN ASSET BORROWING A PALETTE FAMILY BORROWS ITS TOP END.** The shuttle used
  `imp*`, which reaches `#7a7c80`; a 400x360 object painted from it is lighter
  than the `#212328` deck it stands on. Its ladder is placed relative to the
  deck now — fuselage one step above, wings one step below, trim rationed to a
  few pixels. Same family as the hero housing's pale-donut round.

- **A COVER OBJECT'S POWER IS A COMPOSITION DECISION, NOT A NAMING ONE.** The
  junction's eight frozen cover spots used to be eight identical `bush`
  consoles in a perfect ring, all of which took the `console` tint and survived
  a blackout as eight equally pale boxes. `rj-cab-*` is a third archetype that
  declares nothing in `CONSOLE_KIT` and therefore takes the `prop` tint and
  goes out. Five of eight unpowered is what keeps the dark state dark — the
  same ratio as the hangar's crates.

### Visual Identity V2 pilot (`?visualPilot=v2`, a candidate — not approved)

- **The Hangar pass is paint on the existing backdrop, behind the flag.**
  `GameScene.loadRoom` calls `paintPilotHangarBackdrop` (`systems/vpHangar.js`)
  instead of `paintBackdrop` for the Hangar only, with the same options except
  `hexAlpha` and `scorch: 0`, then burns the scorch loop's `scorch * 3` draws:
  the stream leaves exactly as it would have. That relies on the scorch loop
  staying `paintBackdrop`'s last `Math.random` consumer
  (`smoke-visual-pilot` section 3 fails if it does not). The pass itself uses
  its own seeded generator — never `Math.random`.
- **Cover / prop swaps keep the canvas size**, because a static body is sized
  from the sprite (`refreshBody`, then `setSize` centres on `displayWidth`):
  `pilotTexFor` maps a Hangar key to a V2 key only on the same canvas. Kit
  lookups (`CONSOLE_KIT`, `_loClass`) keep the ORIGINAL key; the consoles'
  material pass moves no source pixel, so each declared light still lands.
- **Selective outline for cover** (base and sides, never the lit top) is the
  pilot's line between environment and combatant; the full outline is the
  actors'. A wall-mounted prop gets neither (it would stand up off the wall).

### Pixel shape language

- **A BIG SMOOTH PIXEL CIRCLE CANNOT BE SAID IN THIS GAME'S VOCABULARY.** CRIX
  is crisp horizontals, verticals, 45-degree cuts and layered plates; a large
  circle's edge lands somewhere different against the grid at every bearing, so
  its stair pattern has no period and it reads as a low-resolution
  approximation. The hero machine came back from handset review as "chunkier,
  softer, blurrier than the rest of the room" for exactly that reason. THE FIX
  IS SHAPE LANGUAGE, NOT FILTERING — a smoother or antialiased circle makes one
  unusually soft asset inside a deliberately pixelated game. Large round
  industrial objects get a FACETED ANGULAR HOUSING with SMALLER ROUNDED FORMS
  INSIDE. This is not a ban on circles: the hero's well is still a circle at
  r=25 and renders cleanly.

- **A FACET NEEDS ITS OWN VALUE, NOT ITS OWN RIM.** Varying only the one-pixel
  edge treatment per plane photographs as the same mushy ring it replaced. Fill
  each plane at a different tone — `PAL.chMachMid` exists for exactly this — and
  keep the LIT tone rationed to the one plane square to the light, or the
  housing comes out lighter than the deck it stands on.

- **FILL A FACETED SHAPE BY NEAREST FACET, AND WALK ANY FACET AT 3x THE PIXEL
  RATE.** Walking an edge and stepping inward along its normal leaves holes on
  every diagonal, and a one-step-per-pixel walk on a 2:1 edge rounds two steps
  onto one pixel — the plane bands, the fixture grooves and the mounting
  brackets each came out as a CHECKERBOARD, three separate times, from the same
  two mistakes. `facetPoly().nearest()` and `edge.steps` are the fix.

- **TWELVE MEANINGFUL PLANES BEAT SIXTEEN SMALL ONES.** A sixteen-facet hero
  housing was built, photographed at matched stations and rejected: at handset
  scale its extra planes are ~6px each, which is below the size at which a plane
  reads as a plane, so the silhouette drifts back toward the circle and takes
  the crispness with it. `docs/evidence/arena-pilot/hero-shape/`.

- **A LONG SHALLOW DIAGONAL NEEDS A CHOSEN CADENCE, OR IT CRAWLS.** The
  shuttle's wing edges were `outer = 10 + t * 1.15` rounded to a pixel, which
  steps one per row except at intervals that never repeat — measured off the
  shipped texture, the doubles fell on the 4th row, then the 7th, 7th, 6th,
  5th. A staircase whose rhythm changes every few pixels has no stable read and
  the edge appears to wobble as the camera pans. THE FIX IS SHAPE LANGUAGE, NOT
  FILTERING: antialiasing, `roundPixels` or a higher-resolution asset would put
  one unusually smooth object inside a deliberately pixelated game. Every edge
  is a section at a constant integer cadence (1:1, 2:1, 3:1 or vertical), and
  `smoke-hangar` counts SPIKES — a row that disagrees with both its neighbours
  while they agree with each other — which was 11 on the shipped craft and must
  be 0. This did not matter until the room around it was rebuilt out of
  horizontals, verticals and 45-degree cuts.

- **MORE FACETS IS NOT MORE CRISPNESS, ON ANY SHAPE.** A six-facet shuttle wing
  was built and rejected against a four-facet one: splitting the leading sweep
  puts a kink halfway along the longest edge on the craft, and at handset scale
  the pieces re-read as one bowed line. Same verdict as the sixteen-facet hero
  housing. `docs/evidence/arena-pilot/shuttle-candB/`.

- **A ONE-PIXEL-PER-ROW OUTLINE ON A 2:1 EDGE IS A DOTTED LINE.** The outer x
  jumps two pixels a row, so a single `px(span + 1, y)` leaves gaps — and a
  dotted diagonal is the single most pixel-crawly thing that can be put on
  screen. Dilate the outline from the silhouette instead: every empty pixel
  touching the shape is edge, and no facet has to know which one it is on.

### Rooms: layout, viewport and topology

- **THE HANGAR'S LANDMARK IS PART OF THE WALL, ON PURPOSE.** A second
  freestanding hero machine would have proved the PROP generalizes, which
  nobody asked. The blast door is declared by the room
  (`perimeter.features: [{ side, at, width, kind }]`) and painted by
  `drawWallFeature` in the band's local space, inside the doorway clip. If the
  language only knows how to make one kind of landmark it is not a language.

- **THE HUD'S TOP BAR EATS THE FIRST ~20 WORLD PIXELS OF A NORTH WALL.** The
  game camera is inset by `HUDCFG.topBarHeight`, so world y 0 lands at screen 84
  only while the camera is at its northern clamp; one step south and the
  outermost edge of the band is under the bar. Anything a north-wall feature
  needs the player to SEE goes below its header, never on it.

- **THE REACTOR JUNCTION IS HUMAN-APPROVED AND FROZEN 🔒.** Handset play closed
  it on `68a76c4`: topology, crossing, feeder connectivity, enemy flow, Vader
  navigation, the `junction` perimeter, the conduit language, normal-power
  composition, the eight emergency lane fixtures with their intensities and the
  no-crossing rule, and the reactor's amber face and deck spill. `HANDOVER.md`
  `§10w` is the record. The rules below are how the room works, not an
  invitation to tune it, and **a full reactor migration is deferred
  indefinitely** — the human approved the silhouette. Nothing moves without NEW
  human play evidence.

- **NAVGRID CLEARANCE CAN DISAGREE WITH PHYSICAL CLEARANCE, AND THAT IS ENGINE
  DEBT WE ARE CARRYING ON PURPOSE.** `NavGrid.build` inflates a body rect by a
  fixed 23px agent clearance, which fits the Ø40-48 rank and file and routes a
  Ø112 boss through slots he cannot enter: pathing says yes, physics says no.
  The junction was corrected through LEVEL TOPOLOGY and NavGrid was not touched.
  Do not touch it in an art pass. Remember it when designing a tight space —
  measure the LARGEST body.

- **THE ROOM WHOSE ID IS `corridor` IS NOT A CORRIDOR.** It is REACTOR
  JUNCTION, 1400x1400, the only SQUARE arena in the game and the smallest —
  not narrower than either approved room. The objective is dead centre, three
  gates feed it from three different walls and the exit is on a fourth. Both
  approved arenas are AXIAL, where composition and direction are the same
  decision; a square room with a held centre offers neither. A brief written
  for a narrow hallway cannot be executed here without lying about the space,
  and `bounds`/`spawn`/`exit`/`gates`/cover are frozen. The corridor grammar
  goes in the WALLS and the four approaches instead. **To see it: DEBUG → LOAD
  REACTOR JUNCTION**, then DEBUG → SPAWN VADER (which deliberately keeps the
  current room). Without that button it is the SECOND room of an endless run —
  `_arenaCycle` starts at 1, so the rotation is hangar → junction → detention —
  which costs a full hangar clear to reach and three more rooms to re-enter.

- **A LANDMARK'S PLACEMENT IS A VIEWPORT PROBLEM BEFORE IT IS A COMPOSITION
  PROBLEM.** The game camera is inset by `HUDCFG.topBarHeight` and the touch
  controls cover the bottom ~200px, so the unobstructed band is roughly
  `camTop .. camTop + 896`. In the 1400-tall junction the camera's centre is
  pinned inside y [598, 802], which puts **world y beyond about 1100 behind the
  joysticks from every position the player can reach.** The interchange and a
  1040px conduit spine were both built on the south wall first and were
  invisible in play — they only photographed because an evidence rig can park
  the player at the clamp. Side walls have no such problem: the controls sit
  LOW, not WIDE.

- **THE JUNCTION'S EIGHT-COVER RING IS GONE, AND NOT BECAUSE IT LOOKED BAD.**
  Handset play approved the art pass (`HANDOVER.md` 10s) and rejected the
  topology it had preserved. All eight cover bodies sat inside the room's own
  authored 600x600 crossing; the tightest neighbour gaps were 90px against a
  Ø112 boss; only 47% of the crossing admitted him; and Vader closed on the
  player on **2 of 8** legs, spending 43-46% of frames in bodily contact with
  geometry on every feeder approach. The replacement rule is relational, not
  positional — **no solid body in the crossing, 160px minimum between any two
  solid bodies** — and `smoke-junction` asserts it that way on purpose:
  freezing coordinates is exactly what protected the bad layout. `10t` is the
  record.

- **A LAYOUT CAN BE BROKEN FOR EXACTLY ONE ACTOR SIZE.** The junction's ordinary
  enemies are Ø40-48 and fitted the 90px gaps, so the wave-flow probe barely
  discriminated between the ring and its replacement — detour and arrival times
  moved by noise. `NavGrid.build` tests a cell CENTRE against a body rect
  inflated by 23px, so it happily routed them through slots the boss cannot
  physically enter: **pathing said yes and physics said no.** Measure the
  LARGEST body before concluding a room paths well.

- **160px IS THE JUNCTION'S LANE, AND IT IS DERIVED.** Ø112 (`BOSS.radius` 56,
  doubled) plus `NavGrid`'s own 23px agent clearance on each side, rounded to
  two nav cells so a qualifying gap always contains a fully walkable cell. On
  the 80px lattice that means any two cover objects must differ by 240px in x
  or in y. Do not invent a pixel number here; re-derive it if a body changes.

- **A RING TEST MUST TEST BEARING, NOT JUST RADIUS.** The first not-a-ring check
  asked for a 0.2 radius spread and the eight-cover ring PASSED it at 0.201 —
  its pieces sit 254-311px out, which clears a lazy threshold. The discriminator
  is the widest gap between two cover BEARINGS: 55 degrees for the ring against
  146 for what shipped. A check that passes on the bug is decoration.

- **DETENTION IS 1600x1400 AND ITS LONG AXIS IS THE ONLY ONE THE VIEWPORT CAN
  SHOW.** Spawn on the west edge, exit dead level with it on the east, two
  objectives pulled off that line, four gates with TWO of them on the east wall
  behind the way out, and `walls` completely EMPTY. The camera centre pins
  inside x [360, 1240] and y [598, 802], so the full WIDTH is reachable — the
  only arena where that is true — while world y beyond ~1100 is behind the
  joysticks and the SOUTH band is effectively never in frame. Its plan is a
  WALK, not a warren of cells, and the fiction follows the geometry: the frozen
  open middle is the escort floor you are meant to be visible while crossing.
  `HANDOVER.md` §10x. **To see it: DEBUG -> LOAD DETENTION BLOCK** — it is the
  LAST room of the rotation and costs two full clears otherwise. **DETENTION IS
  HUMAN-APPROVED AND FROZEN 🔒** — closed on `e43cc60` after four rounds of
  handset play: topology, traversal, cover, normal power, the cell/perimeter
  language, the processing gate, containment lighting, the haze, the floor
  reflections, the console emissive faces, the powered/unpowered asymmetry, the
  LIGHTS OUT composition and combat readability. `§10x`-`§10aa` are how it got
  there and `§10ab` is the freeze; the rules below are how the room works, not
  an invitation to tune it.

- **THE `block` PERIMETER'S SIGNATURE IS THE BAR, AND ITS PERIOD IS 176.**
  Nothing else in CRIX draws slats across an opening — a chamber bay lands on
  the deck, a junction bay crosses above it, a cell front CLOSES one. The
  period is the tightest in the game because containment repeats at the width
  of one person (chamber 320, hangar 400, junction 260). Three modules —
  cell / service / secure — run `cell cell cell service` with exactly one
  secure leaf per long wall, whose interlock bolt is HORIZONTAL when every
  other bar is vertical, so the bolted cell reads from the pattern before any
  light is involved. Occupancy varies by a fixed HASH of the bay index, never
  by `Math.random`: a backdrop is repainted on every room load, and an
  occupancy that reshuffled would make the block a different place each time.

- **THE `chamber` PERIMETER HAS FOUR JOBS, ONE PER SIDE.** north ceremonial (no
  ribs, no vents — that wall is behind Vader), west service (densest, the hero
  machine's side), east control (machinery block on alternate bays only), south
  threshold. Plus a phase offset per side (0/124/208/62) so no two adjacent walls
  resolve their rhythm at the same distance from a corner. It is ONE bay
  vocabulary at four densities, not four hand-built walls — four hand-built walls
  is four rooms inside one room.

### Room lifecycle

- **RESEED THE RNG BEFORE EVERY BACKDROP WHEN HASHING TEXTURES.**
  `paintBackdrop` consumes `Math.random` for its panel and scorch scatter, so
  changing ONE room's `panels`/`scorch` counts shifts the stream for every
  backdrop painted after it. Seeding the LCG once per page made all four rooms'
  hashes move and read exactly like a visual pass leaking into three arenas it
  had never touched. Reseed per paint.

- **`_clearRoomEntities` USED TO LEAK ONE OBJECT PER ROOM LOAD — FIXED in
  `b339c1f`, and the shape of the bug is worth keeping.** It sweeps with
  `roomLayer.getChildren().forEach((o) => o.destroy())`; `getChildren()` hands
  back the group's internal array and `destroy()` splices the member out of it,
  so the loop **skips every other element**. Measured at exactly +1 display-list
  object per load on every build tested, and the survivor is visible in play —
  a hangar wall console standing in the detention block at (148, 106). The
  enemy sweep two lines above already uses `.slice()`; both sweeps do now. The
  same shape is a live hazard anywhere a Phaser Group is destroyed in place —
  snapshot with `.slice()` before iterating. `tests/diag-room-leak.mjs` asserts
  a fixed point across three room rotations. `HANDOVER.md` §10y.
