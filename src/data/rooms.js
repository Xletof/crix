// Hand-authored room specs for the Death Star infiltration.
//
// Enemy spec fields:
//   type    : 'grunt' | 'shooter'
//   x, y    : starting position
//   patrol  : optional array of {x,y} waypoints — enemy walks these when unalerted.
//             If omitted, enemy idles at spawn until alarm fires.
//   role    : optional 'flanker' — this shooter will attempt to flank rather than suppress.
//
// Obstacle positions are snapped onto the nav lattice — see src/data/mapUtils.js
// for why that matters. `wallsFromMap` there is unused for now and waits for a
// wall-art vocabulary that does not visibly repeat.
import { snapAll } from './mapUtils.js';
import { PAL } from '../systems/pixelArt.js';

export const ROOMS = [
  // ── 1. Hangar Bay ──────────────────────────────────────────────────────
  // Wide opening chamber. Symmetrical arena flanking the central terminal.
  {
    id: 'hangar',
    name: 'HANGAR BAY',
    bounds: { w: 1600, h: 1400 },
    spawn: { x: 200, y: 700 },
    exit: { x: 1500, y: 700, side: 'right' },
    // Big open working deck: wide hex so the floor reads as large plates,
    // amber guide lights instead of the red alert strips, and heavy scorch.
    floor: {
      base: PAL.hangBase, line: PAL.hangLine, panel: PAL.hangPanel,
      strip: PAL.hangStrip, stripGlow: PAL.hangStripGlw,
      accent: PAL.hangAcc, accentGlow: PAL.hangAccGlw,
      hexW: 96, hexH: 84, stripEvery: 260, accentEvery: 520,
      panels: 70, scorch: 70,
      markColor: PAL.hangStripGlw, markAlpha: 0.30,
      marks: [
        // Two landing pads flanking the terminal — the deck's reason to exist.
        { kind: 'pad', x: 420, y: 360, r: 150 },
        { kind: 'pad', x: 420, y: 1040, r: 150 },
        // Hazard chevrons pointing at the exit, so the room reads directional.
        { kind: 'chevrons', x: 1180, y: 640, w: 260, h: 120, step: 60, dir: 1 },
        // Caution hatching under the gate mouths.
        { kind: 'stripes', x: 1400, y: 120, w: 200, h: 160, alpha: 0.7 },
        { kind: 'stripes', x: 1400, y: 1120, w: 200, h: 160, alpha: 0.7 },
        { kind: 'bay', x: 640, y: 540, w: 320, h: 320, alpha: 0.8 },
      ],
    },
    // Heavy structural ribs — a working hangar's bulkheads. Thickest band of
    // the four, because this is the room that should feel biggest.
    perimeter: {
      style: 'ribbed', thickness: 72,
      wall: PAL.hangWall, wallLit: PAL.hangWallLit, wallDark: PAL.hangWallDark,
      trim: PAL.hangStrip, glow: PAL.hangStripGlw,
    },
    // Deliberately EMPTY. Walls were emptied out of every room in commit
    // 1b08e94, the pivot from stealth-infiltration to swarm survival, and
    // that decision was correct — I re-added geometry here in 7ac7ad7 and it
    // failed on the phone for exactly the reasons the pivot implies:
    //
    //   - There is ONE wall texture in the game (paintBlastDoor). Any wall is
    //     N stamps of the same 104px blast door, so a run of tiles reads as a
    //     repeated texture, not as architecture.
    //   - A long unbroken wall gives the whole horde one gap to path through,
    //     so they funnel and conga-line around it. The older history says the
    //     same thing: d634410 is the last of a run of "cover was still
    //     blocking the shooter path -> ADVANCE oscillation" fixes.
    //
    // Room identity comes from ART instead — floor palette, decorative props
    // with no physics body, perimeter dressing. None of it enters `this.walls`,
    // so NavGrid and losRects never see it. Geometry only comes back once
    // there is a tile vocabulary that does not visibly repeat, and then as
    // compact clusters rather than straight runs. `wallsFromMap` in
    // mapUtils.js is kept ready for that.
    walls: [],
    // Snapped onto the nav lattice. Every obstacle in the game used to be
    // off-lattice, so each blocked up to four 80px cells instead of one — see
    // the note in mapUtils.js.
    cover: snapAll([
      { x: 500, y: 350 }, { x: 500, y: 1050 },
      { x: 800, y: 350 }, { x: 800, y: 1050 },
      { x: 1100, y: 350 }, { x: 1100, y: 1050 },
      { x: 650, y: 500 }, { x: 950, y: 900 },
    ]),
    // Props — the landmarks. Placed on the landing pads and against the
    // perimeter, where the player has least reason to walk, and deliberately
    // NOT in a row: repetition of one silhouette is the exact failure this
    // whole art pass exists to correct.
    props: [
      // The shuttle IS the hangar. Parked on the north landing pad.
      { x: 420, y: 470, tex: 'prop-shuttle', solid: true, bodyW: 150, bodyH: 190 },
      // Loading gantry over the south pad, mirrored so it does not echo the
      // shuttle's symmetry.
      { x: 420, y: 1140, tex: 'prop-crane', solid: true, bodyW: 300, bodyH: 70, flip: true },
      // Drums: two colourways, scattered in a two and a one, never aligned.
      { x: 1310, y: 250, tex: 'prop-drum',   solid: true, bodyW: 60, bodyH: 50 },
      { x: 1380, y: 300, tex: 'prop-drum-b', solid: true, bodyW: 60, bodyH: 50 },
      { x: 1250, y: 1130, tex: 'prop-drum-b', solid: true, bodyW: 60, bodyH: 50, flip: true },
    ],
    enemies: [
      // The north/south pair moved off (800,300)/(800,1100): snapping the
      // cover onto the lattice put a console on top of both of them.
      { type: 'grunt', x: 760, y: 200 },
      { type: 'grunt', x: 760, y: 1240 },
      { type: 'grunt', x: 1300, y: 400 },
      { type: 'grunt', x: 1300, y: 1000 },
      { type: 'shooter', x: 1050, y: 700 },
    ],
    pickups: [
      { x: 600, y: 360, weapon: 'rifle' },
    ],
    // Central terminal objective
    terminals: [
      { x: 800, y: 700 },
    ],
    // Horde spawn gates — arena drip/surge spawns telegraph + emerge here.
    gates: [
      { x: 1500, y: 200 }, { x: 1500, y: 1200 }, { x: 800, y: 100 },
    ],
  },

  // ── 2. Reactor Junction ────────────────────────────────────────────────
  // Symmetrical square arena: a diamond ring of cover orbits the central
  // terminal so hacking mid-horde always has a vault-out escape.
  {
    id: 'corridor',
    name: 'REACTOR JUNCTION',
    bounds: { w: 1400, h: 1400 },
    spawn: { x: 200, y: 1200 }, // bottom-left spawn
    exit: { x: 1200, y: 200, side: 'top' }, // top-right exit
    // Hot and busy: rust base, close-packed orange strips.
    floor: {
      base: PAL.reacBase, line: PAL.reacLine, panel: PAL.reacPanel,
      strip: PAL.reacStrip, stripGlow: PAL.reacStripGlw,
      accent: PAL.reacAcc, accentGlow: PAL.reacAccGlw,
      hexW: 64, hexH: 56, stripEvery: 150, accentEvery: 300,
      panels: 80, scorch: 45,
      markColor: PAL.reacAccGlw, markAlpha: 0.26,
      marks: [
        // Core containment ring around the terminal.
        { kind: 'ring', x: 700, y: 700, r: 250, lw: 12 },
        { kind: 'ring', x: 700, y: 700, r: 300, lw: 4, alpha: 0.6 },
        // Coolant channels running to the three gates.
        { kind: 'stripes', x: 560, y: 60,  w: 280, h: 150, gap: 26 },
        { kind: 'stripes', x: 60,  y: 560, w: 150, h: 280, gap: 26 },
        { kind: 'stripes', x: 1190, y: 560, w: 150, h: 280, gap: 26 },
      ],
    },
    // Coolant runs with collars — the walls carry the same plumbing the floor
    // channels feed into.
    perimeter: {
      style: 'pipes', thickness: 64,
      wall: PAL.reacWall, wallLit: PAL.reacWallLit, wallDark: PAL.reacWallDark,
      trim: PAL.reacStrip, glow: PAL.reacStripGlw,
    },
    walls: [],
    // Props: the core is the landmark, the struts are supporting cast. All
    // three sit off the diagonal between spawn (200,1200) and exit (1200,200)
    // so the through-route stays clean.
    props: [
      { x: 260, y: 400, tex: 'prop-core',  solid: true, bodyW: 200, bodyH: 120 },
      { x: 1150, y: 1180, tex: 'prop-strut', solid: true, bodyW: 190, bodyH: 60 },
      { x: 1230, y: 480, tex: 'prop-strut', solid: true, bodyW: 190, bodyH: 60, flip: true },
    ],
    cover: snapAll([
      // Diamond ring around the terminal at (700,700), ~280px spacing
      { x: 700, y: 420 }, { x: 700, y: 980 },
      { x: 420, y: 700 }, { x: 980, y: 700 },
      { x: 500, y: 500 }, { x: 900, y: 500 },
      { x: 500, y: 900 }, { x: 900, y: 900 },
    ]),
    enemies: [
      { type: 'grunt', x: 450, y: 450 },
      // Nudged off (950,950): snapping the ring put a console 42px away.
      { type: 'grunt', x: 1080, y: 1080 },
      { type: 'bomber', x: 1150, y: 350 }, // introduce the kamikaze here
      { type: 'sniper', x: 700, y: 350 },  // and the long-range zoner
      { type: 'shooter', x: 350, y: 1050 },
    ],
    pickups: [
      // Nudged off (700,1050) for the same reason.
      { x: 700, y: 1160, weapon: 'rifle' },
    ],
    terminals: [
      { x: 700, y: 700 },
    ],
    gates: [
      { x: 700, y: 100 }, { x: 100, y: 700 }, { x: 1300, y: 700 },
    ],
  },

  // ── 3. Detention Block ─────────────────────────────────────────────────
  // Open prison block with double terminals, allowing clean routing.
  {
    id: 'detention',
    name: 'DETENTION BLOCK',
    bounds: { w: 1600, h: 1400 },
    spawn: { x: 150, y: 700 },
    exit: { x: 1450, y: 700, side: 'right' },
    // Cold and clinical: tight small tiling that reads as cell-block floor,
    // pale cyan lighting, almost no battle damage.
    floor: {
      base: PAL.detBase, line: PAL.detLine, panel: PAL.detPanel,
      strip: PAL.detStrip, stripGlow: PAL.detStripGlw,
      accent: PAL.detAcc, accentGlow: PAL.detAccGlw,
      hexW: 48, hexH: 42, stripEvery: 220, accentEvery: 440,
      panels: 40, scorch: 12,
      markColor: PAL.detAcc, markAlpha: 0.34,
      marks: [
        // A row of cell doorways down each long wall — the one thing that
        // makes this read as a detention block rather than a grey box.
        { kind: 'bay', x: 200, y: 70, w: 150, h: 130 },
        { kind: 'bay', x: 420, y: 70, w: 150, h: 130 },
        { kind: 'bay', x: 640, y: 70, w: 150, h: 130 },
        { kind: 'bay', x: 860, y: 70, w: 150, h: 130 },
        { kind: 'bay', x: 1080, y: 70, w: 150, h: 130 },
        { kind: 'bay', x: 1300, y: 70, w: 150, h: 130 },
        { kind: 'bay', x: 200, y: 1200, w: 150, h: 130 },
        { kind: 'bay', x: 420, y: 1200, w: 150, h: 130 },
        { kind: 'bay', x: 640, y: 1200, w: 150, h: 130 },
        { kind: 'bay', x: 860, y: 1200, w: 150, h: 130 },
        { kind: 'bay', x: 1080, y: 1200, w: 150, h: 130 },
        { kind: 'bay', x: 1300, y: 1200, w: 150, h: 130 },
      ],
    },
    // Recessed cell doors in the wall itself, standing behind the bay marks
    // painted on the floor in front of them.
    perimeter: {
      style: 'cells', thickness: 64,
      wall: PAL.detWall, wallLit: PAL.detWallLit, wallDark: PAL.detWallDark,
      trim: PAL.detStrip, glow: PAL.detStripGlw,
    },
    walls: [], // opened cells completely
    // Props: one security post as the landmark, plus bunks spilled out of the
    // cells. The bunks are the only repeated silhouette in the room, so they
    // ship in two colourways, mirrored, and are placed as a two and two ones —
    // never in a row, which is the failure this whole art pass corrects.
    props: [
      { x: 260, y: 1230, tex: 'prop-post', solid: true, bodyW: 200, bodyH: 110 },
      { x: 700, y: 480,  tex: 'prop-bunk',   solid: true, bodyW: 120, bodyH: 60 },
      { x: 780, y: 545,  tex: 'prop-bunk-b', solid: true, bodyW: 120, bodyH: 60, flip: true },
      { x: 1290, y: 880, tex: 'prop-bunk-b', solid: true, bodyW: 120, bodyH: 60 },
      { x: 420, y: 960,  tex: 'prop-bunk',   solid: true, bodyW: 120, bodyH: 60, flip: true },
    ],
    cover: snapAll([
      { x: 400, y: 300 }, { x: 800, y: 300 }, { x: 1200, y: 300 },
      { x: 400, y: 1100 }, { x: 800, y: 1100 }, { x: 1200, y: 1100 },
      { x: 600, y: 700 }, { x: 1000, y: 700 },
    ]),
    enemies: [
      { type: 'grunt', x: 600, y: 450 },
      { type: 'grunt', x: 1000, y: 950 },
      { type: 'bomber', x: 1350, y: 700 },   // bomber, shielded, and sniper all
      { type: 'shielded', x: 550, y: 300 },  // meet the player from t=0 here
      { type: 'sniper', x: 1050, y: 1100 },
    ],
    pickups: [
      { x: 800, y: 700, weapon: 'cluster' },
    ],
    terminals: [
      { x: 500, y: 450 },
      { x: 1100, y: 950 },
    ],
    gates: [
      { x: 800, y: 100 }, { x: 800, y: 1300 },
      { x: 1450, y: 300 }, { x: 1450, y: 1100 },
    ],
  },

  // ── 4. Vader's Chamber (boss) ──────────────────────────────────────────
  {
    id: 'vader',
    name: "VADER'S CHAMBER",
    bounds: { w: 1600, h: 1600 },
    spawn: { x: 800, y: 1350 },
    // Endless needs a way ONWARD from the boss room — the climb continues past
    // Vader rather than ending at him. Placed clear of the right-hand gate at
    // y=800 so perimeterOpenings cuts two distinct doorways rather than one
    // overlapping pair. In the campaign this door is simply never opened:
    // `room-cleared` returns early for boss rooms, and boss-died ends the run.
    exit: { x: 1500, y: 1200, side: 'right' },
    // ══ THE ENVIRONMENT PILOT ═══════════════════════════════════════════
    //
    // This room is the proof of the arena visual language. Everything below is
    // ART: it is painted into the backdrop canvas or into the emissive layer,
    // and neither of those can reach `this.walls`, so nav, LOS, bullet
    // collision, the arena bounds and the boss's movement space are exactly
    // what they were. `cover`, `props`, `gates`, `bossSpawn` and `spawn` are
    // untouched from the build this replaced.
    //
    // WHAT CHANGED AND WHY. The old chamber was severe by SUBTRACTION — a flat
    // hex deck, two crimson rings, four full-width red strip lights and a bare
    // wall band. Three problems, all visible in the baseline evidence:
    //   - no large forms, so the room had no shape and the eye had nowhere
    //     to go; it read as a texture that the fight happened on top of
    //   - the strip lights were CRIMSON and ran the full width of the world,
    //     which is the danger colour spent on décor and the one thing the
    //     brief says the environment may not do
    //   - the props and consoles sat on the deck with no contact, so they
    //     floated
    //
    // The floor now carries a composition instead: a raised dais at the head of
    // a lighter central nave, two recessed side aisles either side of it,
    // flanking service trenches, and two structural ribs crossing the whole
    // deck. Nothing is added to the middle of the fighting floor beyond those
    // ribs — density is pushed outward to the aisles and the wall.
    floor: {
      // The material ladder, cool graphite rather than neutral black.
      base: PAL.chRecess, line: PAL.chSeam, panel: PAL.chSink,
      // NO BAKED STRIP LIGHTS. `stripEvery: 0` turns the pass off; the room's
      // light is authored in `emissives` below, where it can have a shape, a
      // colour that is not crimson, and a second intensity for emergency power.
      strip: PAL.vadStrip, stripGlow: PAL.vadStripGlw,
      accent: PAL.vadAcc, accentGlow: PAL.vadAccGlw,
      stripEvery: 0, accentEvery: 0,
      hexW: 120, hexH: 105,
      // The tiling drops to a whisper. It is still there — it is the Death
      // Star's floor and removing it would remove the room's family — but at
      // full contrast it competed with the plate seams that are supposed to be
      // the medium forms.
      hexAlpha: 0.28,
      panels: 18, scorch: 14,
      // Contact shadows under this room's cover and props, derived in
      // `loadRoom` from the lists below. Opt-in, because this is a pilot: the
      // other three arenas paint exactly the backdrop they always did.
      grounded: true,
      // Deck paint is STEEL now, not crimson. Red in this room belongs to the
      // saber, the SABER THROW lane and the telegraphs, and to nothing else.
      markColor: PAL.chBolt, markAlpha: 0.55,
      marks: [
        // NO PAINTED RING AROUND THE DAIS. The old chamber had two, and the
        // pilot briefly kept one in steel — it photographed as a thin bright
        // circle centred on the boss, which is the exact shape and placement of
        // a circle telegraph. The raised octagon draws that boundary now, in
        // geometry the player cannot confuse with a warning.
        //
        // Caution hatching at the four gate mouths: these are the places the
        // room actually wants the player to read.
        { kind: 'stripes', x: 700, y:   82, w: 200, h: 90, alpha: 0.42, gap: 40 },
        { kind: 'stripes', x: 700, y: 1428, w: 200, h: 90, alpha: 0.42, gap: 40 },
        { kind: 'stripes', x:  82, y:  700, w:  90, h: 200, alpha: 0.42, gap: 40 },
        { kind: 'stripes', x: 1428, y: 700, w:  90, h: 200, alpha: 0.42, gap: 40 },
      ],
      // ── LARGE, then MEDIUM, then SMALL. Drawn in list order.
      architecture: [
        // LARGE — the chamber's shape.
        // The nave: a lighter deck running the room's long axis, from the south
        // door to the dais. This is the room's spine and the reason the eye
        // travels toward the boss.
        { kind: 'region', x: 560, y: 80, w: 480, h: 1440, tone: 'deck', alpha: 0.92 },
        // The dais. Octagonal, raised, lit on its north rim and casting south,
        // with two approach steps on the side the player comes from.
        { kind: 'dais', x: 800, y: 400, r: 300, tone: 'deckLit', steps: true, lip: 16 },

        // MEDIUM — the room's identity.
        // Service trenches flanking the nave. Recessed and grated: they are
        // holes in the deck, so they cannot be mistaken for cover.
        { kind: 'trench', dir: 'v', x: 512, y: 640, len: 840, t: 40, step: 34 },
        { kind: 'trench', dir: 'v', x: 1048, y: 640, len: 840, t: 40, step: 34 },
        // Two structural ribs crossing the entire deck. Two, not six — the
        // fighting floor has to stay parseable.
        { kind: 'rib', dir: 'h', x: 80, y: 900, len: 1440, t: 22 },
        { kind: 'rib', dir: 'h', x: 80, y: 1250, len: 1440, t: 18, alpha: 0.8 },
        // Big aisle plates. 380x400 each — a plate this size is architecture; a
        // grid of 60px ones would be floor noise.
        { kind: 'plate', x: 110, y: 150, w: 380, h: 400, inset: 22 },
        { kind: 'plate', x: 110, y: 600, w: 380, h: 400, inset: 22 },
        { kind: 'plate', x: 110, y: 1060, w: 380, h: 400, inset: 22 },
        { kind: 'plate', x: 1110, y: 150, w: 380, h: 400, inset: 22 },
        { kind: 'plate', x: 1110, y: 600, w: 380, h: 400, inset: 22 },
        { kind: 'plate', x: 1110, y: 1060, w: 380, h: 400, inset: 22 },
        // Recessed bays against the side walls, under the wall machinery.
        { kind: 'inset', x: 88, y: 300, w: 104, h: 300 },
        { kind: 'inset', x: 88, y: 1000, w: 104, h: 300 },
        { kind: 'inset', x: 1408, y: 300, w: 104, h: 300 },
        { kind: 'inset', x: 1408, y: 1000, w: 104, h: 300 },
        // Door surrounds, flush inboard of the wall band, so a gate is a
        // threshold rather than a gap in a painted border.
        { kind: 'doorframe', x: 690, y:   78, w: 220, h: 40 },
        { kind: 'doorframe', x: 690, y: 1482, w: 220, h: 40 },
        { kind: 'doorframe', x:  78, y:  690, w:  40, h: 220 },
        { kind: 'doorframe', x: 1482, y: 690, w:  40, h: 220 },
        { kind: 'doorframe', x: 1482, y: 1090, w: 40, h: 220 },

        // SMALL — sparse, and never on the fighting floor.
        { kind: 'vent', x: 128, y: 700, w: 34, h: 60 },
        { kind: 'vent', x: 1438, y: 700, w: 34, h: 60 },
        { kind: 'vent', x: 128, y: 1360, w: 34, h: 60 },
        { kind: 'vent', x: 1438, y: 1360, w: 34, h: 60 },
      ],
    },
    // The wall stops being a border and becomes a wall. `chamber` is a large
    // 320px rhythm of pilaster / recessed bay / machinery block — severe by
    // repetition rather than by emptiness, which is what `bare` was and what
    // photographed as unfinished at the room's corners.
    perimeter: {
      style: 'chamber', thickness: 80,
      wall: PAL.vadWall, wallLit: PAL.vadWallLit, wallDark: PAL.vadWallDark,
      trim: PAL.chRib, glow: PAL.chRibLit,
    },
    // ══ AUTHORED LIGHT ══════════════════════════════════════════════════
    //
    // Every source carries TWO intensities. `normal` is what it contributes
    // while the chamber has power; `emergency` is what it contributes once
    // LIGHTS OUT has collapsed the ambient. They are independent — the amber
    // strips below are OFF at normal power and only come up when the main bus
    // drops, which is what makes the second state read as emergency power
    // rather than as the first state with the brightness turned down.
    //
    // TWO RULES HELD THE LIST DOWN. Nothing emissive stands on the fighting
    // floor: every source is on the perimeter or on a cover console, so the
    // centre of the room stays calm and no glow can be mistaken for a zone.
    // And nothing here is crimson.
    emissives: [
      // ── Wall machinery screens. Cool cyan, seated in the bays of the
      //    `chamber` wall rhythm, at the block centres (period 320).
      { kind: 'screen', x: 480, y: 34, w: 62, h: 20, color: 0x1a5a96, hot: 0x8fd8ff, normal: 0.22, emergency: 0.62, reach: 46, drop: 0.75 },
      { kind: 'screen', x: 1120, y: 34, w: 62, h: 20, color: 0x1a5a96, hot: 0x8fd8ff, normal: 0.22, emergency: 0.62, reach: 46, drop: 0.75 },
      { kind: 'screen', x: 1120, y: 1566, w: 62, h: 20, color: 0x1a5a96, hot: 0x8fd8ff, normal: 0.20, emergency: 0.55, reach: 44, drop: -0.4 },
      { kind: 'screen', x: 34, y: 1120, w: 20, h: 62, color: 0x1a5a96, hot: 0x8fd8ff, normal: 0.20, emergency: 0.55, reach: 44, drop: 0.1 },
      { kind: 'screen', x: 1566, y: 480, w: 20, h: 62, color: 0x1a5a96, hot: 0x8fd8ff, normal: 0.20, emergency: 0.55, reach: 44, drop: 0.1 },
      // ── Machinery cores. The one place a radial pool is the truth: something
      //    hot inside a housing. Amber, so it cannot be read as a telegraph.
      { kind: 'core', x: 40, y: 450, r: 12, color: 0x8a4a10, hot: 0xffb45a, normal: 0.16, emergency: 0.40, reach: 54 },
      { kind: 'core', x: 1560, y: 1150, r: 12, color: 0x8a4a10, hot: 0xffb45a, normal: 0.16, emergency: 0.40, reach: 54 },
      // ── Status lamps. Compact by definition. Sparse: four in the room.
      { kind: 'led', x: 160, y: 40, r: 3, color: 0x1a7a3a, hot: 0x8fffb0, normal: 0.30, emergency: 0.70, reach: 10 },
      { kind: 'led', x: 1440, y: 40, r: 3, color: 0x1a7a3a, hot: 0x8fffb0, normal: 0.30, emergency: 0.70, reach: 10 },
      { kind: 'led', x: 480, y: 1560, r: 3, color: 0x8a5a10, hot: 0xffd08a, normal: 0.26, emergency: 0.62, reach: 10 },
      { kind: 'led', x: 40, y: 800, r: 3, color: 0x8a5a10, hot: 0xffd08a, normal: 0.26, emergency: 0.62, reach: 10 },
      // ── EMERGENCY STRIPS. Dead at normal power. These are the sources that
      //    make the second state an authored composition instead of a dimmer:
      //    when the chamber loses its bus, two long amber runs come up along
      //    the side walls and the room is lit by different fixtures than it was
      //    a second earlier.
      // Segmented, not one continuous run. A single 780px bar photographed as
      // a solid orange band down the edge of the screen — a graphic element
      // rather than a fixture — and it was the loudest thing in an emergency
      // frame that is supposed to belong to the saber.
      { kind: 'strip', dir: 'v', x: 76, y: 420, len: 220, t: 5, color: 0x6a3406, hot: 0xffab52, normal: 0, emergency: 0.20, reach: 22 },
      { kind: 'strip', dir: 'v', x: 76, y: 1180, len: 220, t: 5, color: 0x6a3406, hot: 0xffab52, normal: 0, emergency: 0.20, reach: 22 },
      { kind: 'strip', dir: 'v', x: 1524, y: 420, len: 220, t: 5, color: 0x6a3406, hot: 0xffab52, normal: 0, emergency: 0.20, reach: 22 },
      { kind: 'strip', dir: 'v', x: 1524, y: 1180, len: 220, t: 5, color: 0x6a3406, hot: 0xffab52, normal: 0, emergency: 0.20, reach: 22 },
      // ── Door thresholds. Cool white, present in both states — a doorway is
      //    the one thing that must stay findable when the lights go.
      { kind: 'strip', dir: 'h', x: 800, y: 76, len: 180, t: 5, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.16, emergency: 0.40, reach: 18 },
      { kind: 'strip', dir: 'h', x: 800, y: 1524, len: 180, t: 5, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.16, emergency: 0.40, reach: 18 },
      { kind: 'strip', dir: 'v', x: 76, y: 800, len: 180, t: 5, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.16, emergency: 0.40, reach: 18 },
      { kind: 'strip', dir: 'v', x: 1524, y: 800, len: 180, t: 5, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.16, emergency: 0.40, reach: 18 },
      { kind: 'strip', dir: 'v', x: 1524, y: 1200, len: 220, t: 5, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.16, emergency: 0.40, reach: 18 },
    ],
    walls: [],
    // One prop only. The chamber should feel bare and severe — the meditation
    // pod is the whole story, and a second object would dilute it. Placed
    // off-axis so neither the north gate nor the approach to Vader is touched.
    props: [
      { x: 340, y: 740, tex: 'prop-pod', solid: true, bodyW: 220, bodyH: 120 },
    ],
    cover: snapAll([
      // 4 corner cover pillars
      { x: 400, y: 400 }, { x: 1200, y: 400 },
      { x: 400, y: 1200 }, { x: 1200, y: 1200 },
    ]),
    enemies: [],
    boss: true,
    bossSpawn: { x: 800, y: 400 },
    gates: [
      { x: 800, y: 100 }, { x: 800, y: 1500 },
      { x: 100, y: 800 }, { x: 1500, y: 800 },
    ],
  },
];
