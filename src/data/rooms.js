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
    // ══ THE HANGAR, SECOND ARENA ═══════════════════════════════════════════
    //
    // THIS IS THE GENERALIZATION TEST, and the thing it is testing is whether
    // the chamber left behind an ART DIRECTION or one good room. So the RULES
    // are reused verbatim — large before medium before small, a calm centre,
    // per-side perimeter jobs, emitter plus a spill shaped like its source, two
    // independent lighting intensities, contact shadows, no red — and the
    // COMPOSITION is not reused at all.
    //
    //   VADER CHAMBER   enclosed technical containment. A nave to a dais, a
    //                   freestanding hero machine, cool graphite, severe.
    //   HANGAR          an operational deployment deck. A launch axis to a
    //                   blast door, a hero landmark that is PART OF THE WALL,
    //                   neutral gunmetal, working and scuffed.
    //
    // Everything below is painted art or emissive layer. `bounds`, `spawn`,
    // `exit`, `gates`, `walls`, `terminals`, `enemies`, `pickups`, the eight
    // cover positions and the five prop bodies are exactly what they were.
    floor: {
      // NEUTRAL GUNMETAL, and the base value IS the deck rather than a recess.
      // The first build based the floor on `hgRecess` and every authored region
      // then read as a pale rectangle painted onto a dark one; with the deck as
      // the ground value the apron lifts off it and the staging bay drops into
      // it, which is what a region is supposed to do. The old deck was
      // olive-brown (`hangBase`) and came back from the baseline evidence as
      // mud — warm, low contrast, and with nothing in it a plate seam could be
      // drawn against.
      base: PAL.hgDeck, line: PAL.hgSeam, panel: PAL.hgRecess,
      strip: PAL.hangStrip, stripGlow: PAL.hangStripGlw,
      accent: PAL.hangAcc, accentGlow: PAL.hangAccGlw,
      // NO BAKED STRIP LIGHTS, exactly as in the chamber and for exactly the
      // same reason: four full-width amber bars every 260px were the loudest
      // thing in every baseline frame, and a ceiling fixture drawn flat on the
      // floor is not light. The room's light is authored in `emissives`.
      stripEvery: 0, accentEvery: 0,
      // BIGGER TILING THAN THE CHAMBER. 160x140 against its 120x105: a hangar's
      // deck plates are larger, and the tile size is the cheapest place to say
      // so. Kept to a whisper for the same reason the chamber does.
      hexW: 160, hexH: 140, hexAlpha: 0.30,
      panels: 40, scorch: 50,
      grounded: true,
      // Deck paint is AMBER here, where the chamber's is steel. It is the one
      // warm graphic in the room and it is the honest colour for hangar floor
      // markings; at 0.30 it is a stain rather than a signal.
      markColor: PAL.hangStrip, markAlpha: 0.30,
      marks: [
        // NO LANDING-PAD RINGS. The old deck had two 150px painted circles on
        // it, which is the shape and placement of a circle telegraph. The
        // shuttle's ground is marked by CORNER BRACKETS instead — the same
        // claim about the same area, in a shape no attack uses.
        { kind: 'bay', x: 250, y: 300, w: 340, h: 300, alpha: 0.75 },
        { kind: 'bay', x: 790, y: 1010, w: 400, h: 280, alpha: 0.7 },
        // Hazard chevrons pointing at the exit — the room reads directional,
        // and this was already the best thing on the old deck.
        { kind: 'chevrons', x: 1180, y: 640, w: 260, h: 120, step: 60, dir: 1 },
        // Caution hatching at the three gate mouths.
        { kind: 'stripes', x: 1296, y: 120, w: 180, h: 160, alpha: 0.7 },
        { kind: 'stripes', x: 1296, y: 1120, w: 180, h: 160, alpha: 0.7 },
        { kind: 'stripes', x: 700, y: 124, w: 200, h: 90, alpha: 0.55, gap: 40 },
      ],
      // The gunmetal ladder. Supplied per room so the chamber's graphite and
      // this deck can diverge through one painter rather than two.
      archPal: {
        sink: PAL.hgSink, recess: PAL.hgRecess, deck: PAL.hgDeck,
        deckLit: PAL.hgDeckLit, rib: PAL.hgRib, ribLit: PAL.hgRibLit,
        seam: PAL.hgSeam, bolt: PAL.hgBolt,
      },
      // ── LARGE, then MEDIUM, then SMALL. Drawn in list order.
      architecture: [
        // LARGE — three operational zones, and they are the whole room.
        // THE LAUNCH APRON. The lighter deck in front of the blast door, where
        // the shuttle is parked. Wide rather than tall: this is the opposite
        // axis to the chamber's nave, which is the point.
        { kind: 'region', x: 150, y: 116, w: 540, h: 442, tone: 'deckLit', alpha: 0.40, edge: 'h' },
        // THE DEPLOYMENT LANE. A broad band running the room's long axis from
        // the spawn wall to the exit — the room's direction, stated once at
        // full width instead of thirty times in small markings.
        { kind: 'region', x: 116, y: 570, w: 1368, h: 240, tone: 'deckLit', alpha: 0.22, edge: 'h' },
        // THE STAGING BAY. Recessed rather than raised: the south-east corner
        // is where freight sits, and it should read as lower than the lane.
        { kind: 'region', x: 700, y: 950, w: 750, h: 380, tone: 'recess', alpha: 0.75, edge: 'h' },

        // MEDIUM — a loading system, in three lengths on two axes.
        // The long east-west track IS the deployment axis. One 1320px recessed
        // rail pair does more for the room's identity than any number of
        // markings, and it is flat, so it cannot promise cover.
        { kind: 'track', dir: 'h', x: 140, y: 596, len: 1320, t: 46, step: 58 },
        // The door-to-apron spur: shorter, perpendicular, and the shuttle is
        // parked across it.
        { kind: 'track', dir: 'v', x: 396, y: 128, len: 356, t: 46, step: 54 },
        // The gantry rail. The crane's feet land on it, which is the cheapest
        // possible way to stop a 300px prop looking parked on nothing.
        { kind: 'track', dir: 'h', x: 190, y: 1104, len: 460, t: 40, step: 48 },
        // Deck plates. LARGER AND FEWER than the chamber's 380x400 — a hangar
        // is built out of bigger pieces, and three plates is the whole budget.
        { kind: 'plate', x: 1000, y: 130, w: 460, h: 400, inset: 26 },
        { kind: 'plate', x: 130, y: 880, w: 440, h: 420, inset: 26 },
        { kind: 'plate', x: 760, y: 985, w: 460, h: 320, inset: 26 },
        // Recessed maintenance bays against the side walls, under the racking.
        { kind: 'inset', x: 124, y: 300, w: 110, h: 260 },
        { kind: 'inset', x: 124, y: 960, w: 110, h: 260 },
        { kind: 'inset', x: 1366, y: 900, w: 110, h: 260 },
        // Thresholds, flush inboard of the wall band.
        { kind: 'doorframe', x: 700, y: 114, w: 200, h: 40 },
        { kind: 'doorframe', x: 1446, y: 110, w: 40, h: 200 },
        { kind: 'doorframe', x: 1446, y: 1110, w: 40, h: 200 },
        { kind: 'doorframe', x: 1446, y: 600, w: 40, h: 220 },

        // SMALL — sparse, and off the fighting centre.
        { kind: 'hatch', x: 250, y: 640, w: 56, h: 44 },
        { kind: 'hatch', x: 1300, y: 500, w: 52, h: 44 },
        { kind: 'hatch', x: 640, y: 1240, w: 56, h: 44 },
        { kind: 'vent', x: 136, y: 660, w: 34, h: 60 },
        { kind: 'vent', x: 1428, y: 700, w: 34, h: 60 },
        { kind: 'vent', x: 900, y: 1238, w: 60, h: 34 },
      ],
    },
    // THE HANGAR WALL. `ribbed` was 26px of the same comb repeated 4 x 60
    // times, which is the "procedurally repeated" verdict the chamber already
    // took once. `hangar` is the chamber's RULE — one bay vocabulary, four
    // densities, a phase offset per side — applied to a different vocabulary:
    // truss columns with bracket feet at a 400px period, panelling between
    // them instead of machinery cabinets.
    //
    // THE HERO LANDMARK IS DECLARED HERE. A blast door on the north wall, west
    // of the north gate and directly in front of the shuttle: the room's
    // biggest object is a piece of its architecture rather than a second
    // freestanding machine, which is the strongest evidence available that the
    // language generalizes rather than repeats.
    perimeter: {
      style: 'hangar', thickness: 116,
      wall: PAL.hgMach, wallLit: PAL.hgMachLit, wallDark: PAL.hgMachDark,
      trim: PAL.hgRib, glow: PAL.hgRibLit,
      features: [
        { side: 'top', at: 420, width: 460, kind: 'blastdoor', segments: 8, stationSide: 'left' },
        { side: 'right', at: 900, width: 96, kind: 'panelmount' },
      ],
    },
    // ══ AUTHORED LIGHT ══════════════════════════════════════════════════
    //
    // Same architecture as the chamber's, same two independent intensities,
    // and a deliberately DIFFERENT composition — because the sources are
    // different systems. The chamber's dark state is containment machinery and
    // technical consoles; the hangar's is DEPLOYMENT AND ACCESS: door status,
    // thresholds, one service bay, the racking lamps.
    //
    // The same two rules held the list down. Nothing emissive stands on the
    // fighting floor — every source is on the perimeter or on a cover console —
    // and nothing here is crimson.
    emissives: [
      // ── THE BLAST DOOR. Its MASS STAYS DARK. Three short header fixtures in
      //    the housings painted for them, and nothing outlining the structure:
      //    a lit perimeter on a door that size is an objective marker.
      { kind: 'strip', dir: 'h', x: 273, y: 29, len: 66, t: 6, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.20, emergency: 0.34, reach: 20 },
      { kind: 'strip', dir: 'h', x: 420, y: 29, len: 66, t: 6, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.20, emergency: 0.34, reach: 20 },
      { kind: 'strip', dir: 'h', x: 567, y: 29, len: 66, t: 6, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.20, emergency: 0.34, reach: 20 },
      // DOOR STATUS, on the jambs. Dead at normal power: these are the fixtures
      // that say the door is on the emergency bus and is not going to open.
      { kind: 'strip', dir: 'v', x: 209, y: 60, len: 52, t: 4, color: 0x6a3406, hot: 0xffab52, normal: 0, emergency: 0.34, reach: 16 },
      { kind: 'strip', dir: 'v', x: 631, y: 60, len: 52, t: 4, color: 0x6a3406, hot: 0xffab52, normal: 0, emergency: 0.34, reach: 16 },
      // THE DOOR'S POWER HEAD, in the control station beside the west jamb.
      // The room's northern LIGHTS OUT landmark: ordinary at normal power,
      // and much the strongest thing on this wall once the ambient has gone.
      { kind: 'core', x: 148, y: 88, r: 10, color: 0x8a4a10, hot: 0xffb45a, normal: 0.14, emergency: 0.74, reach: 72 },

      // ── WEST, STOWAGE. Rack lamps: nominal, and they do not get louder in
      //    the dark. Two, because a working wall has a couple of lamps on it
      //    and not a row.
      { kind: 'led', x: 74, y: 420, r: 3, color: 0x1a7a3a, hot: 0x8fffb0, normal: 0.28, emergency: 0.28, reach: 10 },
      { kind: 'led', x: 74, y: 980, r: 3, color: 0x1a7a3a, hot: 0x8fffb0, normal: 0.28, emergency: 0.28, reach: 10 },
      // One segmented emergency run on the racking. Segmented and short: an
      // unbroken bar down the edge of the screen is a graphic, not a fixture.
      { kind: 'strip', dir: 'v', x: 98, y: 640, len: 200, t: 5, color: 0x6a3406, hot: 0xffab52, normal: 0, emergency: 0.20, reach: 22 },

      // ── SOUTH, SERVICE. The technical wall, and the only place in the room
      //    with a machinery core in it.
      { kind: 'screen', x: 520, y: 1356, w: 56, h: 18, color: 0x1a5a96, hot: 0x8fd8ff, normal: 0.22, emergency: 0.58, reach: 48, drop: -0.55 },
      { kind: 'core', x: 900, y: 1360, r: 12, color: 0x8a4a10, hot: 0xffb45a, normal: 0.16, emergency: 0.44, reach: 58 },
      { kind: 'strip', dir: 'h', x: 1180, y: 1330, len: 200, t: 5, color: 0x6a3406, hot: 0xffab52, normal: 0, emergency: 0.22, reach: 22 },
      { kind: 'led', x: 300, y: 1360, r: 3, color: 0x8a5a10, hot: 0xffd08a, normal: 0.26, emergency: 0.26, reach: 10 },

      // ── EAST, DEPARTURE. THE EXIT IS THE ROOM'S SECOND LANDMARK. A doorway
      //    is the one thing that must stay findable when the lights go, and in
      //    a room whose whole subject is deployment it is also the answer to
      //    the question the player is asking.
      { kind: 'strip', dir: 'v', x: 1526, y: 700, len: 210, t: 5, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.20, emergency: 0.62, reach: 22 },
      { kind: 'strip', dir: 'v', x: 1526, y: 200, len: 150, t: 5, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.16, emergency: 0.40, reach: 18 },
      { kind: 'strip', dir: 'v', x: 1526, y: 1200, len: 150, t: 5, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.16, emergency: 0.40, reach: 18 },
      { kind: 'led', x: 1560, y: 500, r: 3, color: 0x8a5a10, hot: 0xffd08a, normal: 0.24, emergency: 0.24, reach: 10 },
      // ── The north gate's threshold.
      { kind: 'strip', dir: 'h', x: 800, y: 104, len: 160, t: 5, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.16, emergency: 0.40, reach: 18 },
    ],
    walls: [],
    // Snapped onto the nav lattice. Every obstacle in the game used to be
    // off-lattice, so each blocked up to four 80px cells instead of one — see
    // the note in mapUtils.js.
    //
    // THE COVER KIT, INSTANCED. Positions, count, bodies and cover semantics
    // are untouched; what changed is which texture stands on each spot, and it
    // is assigned by FUNCTION rather than scattered:
    //
    //   the launch apron  cargo, because that is what comes off a shuttle
    //   the lane          the two terminals the player fights around
    //   the gantry        the heavy console — the room's technical authority,
    //                     on the service side, beside the crane
    //   the staging bay   cargo again, in the recessed south-east corner
    //
    // Five of the eight are CRATES, which carry no light at all. That is what
    // keeps the dark state dark: most of this room's cover simply goes out.
    cover: snapAll([
      { x: 500, y: 350, tex: 'ch-crate-a' },
      { x: 800, y: 350, tex: 'ch-con-ped-c' },
      { x: 1100, y: 350, tex: 'ch-crate-b' },
      { x: 500, y: 1050, tex: 'ch-con-heavy' },
      { x: 800, y: 1050, tex: 'ch-crate-a' },
      { x: 1100, y: 1050, tex: 'ch-crate-b' },
      { x: 650, y: 500, tex: 'ch-con-ped-c' },
      { x: 950, y: 900, tex: 'ch-crate-b' },
    ]),
    // Props — the landmarks. Placed on the apron and against the perimeter,
    // where the player has least reason to walk, and deliberately NOT in a row:
    // repetition of one silhouette is the exact failure this whole art pass
    // exists to correct.
    props: [
      // The shuttle IS the hangar. Parked on the launch apron, in front of the
      // blast door, across the spur track. Position and body frozen.
      // A LARGE IDENTITY PROP SHOULD SURVIVE THE EMERGENCY BUS. The craft used
      // to be a flat black hole during LIGHTS OUT, and the hangar's other
      // landmark — the blast door — is bolted to one wall and off screen from
      // half the room. Two faces, and the second is DEAD at normal power: a
      // parked shuttle running four navigation lights is not supposed to be a
      // centrepiece, and the docking bus coming up is the moment it changes.
      { x: 420, y: 470, tex: 'prop-shuttle', solid: true, bodyW: 150, bodyH: 190,
        faces: [
          { tex: 'prop-shuttle-glow', normal: 0.42, emergency: 0.92 },
          { tex: 'prop-shuttle-emer', normal: 0,    emergency: 0.85 },
        ] },
      // Loading gantry, mirrored so it does not echo the shuttle's symmetry.
      // Its feet land on the gantry rail.
      { x: 420, y: 1140, tex: 'prop-crane', solid: true, bodyW: 300, bodyH: 70, flip: true },
      // Drums: two colourways, scattered in a two and a one, never aligned.
      { x: 1310, y: 250, tex: 'prop-drum',   solid: true, bodyW: 60, bodyH: 50 },
      { x: 1380, y: 300, tex: 'prop-drum-b', solid: true, bodyW: 60, bodyH: 50 },
      { x: 1250, y: 1130, tex: 'prop-drum-b', solid: true, bodyW: 60, bodyH: 50, flip: true },
      // ── THE WALL CONTROL PANEL, VALIDATED IN CONTEXT. The archetype existed
      // and had never been mounted on anything. Two of them here, each bolted
      // to a mounting the perimeter painter put there for it: one in the blast
      // door's control station, one on the departure wall by the exit.
      //
      // NOT SOLID — no body, no nav cell, no LOS rect; it is wall-integrated
      // art, which is the one place this pass is allowed to add visual mass in
      // playable space. And it carries an explicit DEPTH rather than sorting by
      // its y, because it is part of the wall rather than something standing on
      // the deck: 6 is above the floor decals and below every actor, so it can
      // never occlude a fight. Its light comes from `kit`, the same declaration
      // a cover console uses.
      { x: 148, y: 106, tex: 'ch-con-wall', kit: 'ch-con-wall', depth: 6 },
      { x: 1556, y: 956, tex: 'ch-con-wall', kit: 'ch-con-wall', depth: 6 },
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

        // ── MEDIUM, SECOND PASS. Handset review asked for a little more
        // construction at medium scale and none at all in the centre, so
        // every item below is in a side aisle, outboard of the service
        // trenches at x=512 and x=1048, and none of it is on the nave.
        //
        // They are also not scattered evenly: the WEST group is a service
        // apron built around the hero machine, and the EAST group is a
        // sparser control bay. That is the floor half of the same
        // different-sides-different-jobs argument the perimeter makes.
        //
        // WEST — the machine's apron. The prop stands at (340, 740) with its
        // plinth ending at y=732, so this sits directly south of it and reads
        // as the deck it is serviced from.
        { kind: 'plate', x: 140, y: 790, w: 250, h: 190, inset: 18 },
        { kind: 'inset', x: 170, y: 828, w: 52, h: 112 },
        { kind: 'inset', x: 240, y: 828, w: 52, h: 112 },
        { kind: 'rib', dir: 'v', x: 306, y: 250, len: 190, t: 14, alpha: 0.7 },
        // EAST — the control bay. One plate, one narrow cabinet, and nothing
        // else; the point of this side is that it is emptier.
        { kind: 'plate', x: 1210, y: 790, w: 250, h: 190, inset: 18 },
        { kind: 'inset', x: 1372, y: 828, w: 44, h: 112 },

        // SMALL — sparse, and never on the fighting floor.
        { kind: 'vent', x: 310, y: 856, w: 30, h: 54 },
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
      // NORTH-WEST DOOR CONTROL. One of the two features promoted to a
      // LIGHTS OUT landmark: wider than the other screens and much stronger
      // under emergency power, so the north end of the west aisle stays
      // findable when the ambient has gone. Not brighter at normal power —
      // a landmark is something the dark reveals, not something that shouts.
      { kind: 'screen', x: 480, y: 34, w: 78, h: 22, color: 0x1a5a96, hot: 0x8fd8ff, normal: 0.24, emergency: 0.88, reach: 62, drop: 0.80 },
      { kind: 'led', x: 536, y: 44, r: 3, color: 0x8a5a10, hot: 0xffd08a, normal: 0.24, emergency: 0.70, reach: 11 },
      { kind: 'screen', x: 1120, y: 34, w: 62, h: 20, color: 0x1a5a96, hot: 0x8fd8ff, normal: 0.22, emergency: 0.62, reach: 46, drop: 0.75 },
      { kind: 'screen', x: 1120, y: 1566, w: 62, h: 20, color: 0x1a5a96, hot: 0x8fd8ff, normal: 0.20, emergency: 0.55, reach: 44, drop: -0.4 },
      { kind: 'screen', x: 34, y: 1120, w: 20, h: 62, color: 0x1a5a96, hot: 0x8fd8ff, normal: 0.20, emergency: 0.55, reach: 44, drop: 0.1 },
      { kind: 'screen', x: 1566, y: 480, w: 20, h: 62, color: 0x1a5a96, hot: 0x8fd8ff, normal: 0.20, emergency: 0.55, reach: 44, drop: 0.1 },
      // ── Machinery cores. The one place a radial pool is the truth: something
      //    hot inside a housing. Amber, so it cannot be read as a telegraph.
      { kind: 'core', x: 40, y: 450, r: 12, color: 0x8a4a10, hot: 0xffb45a, normal: 0.16, emergency: 0.40, reach: 54 },
      // SOUTH-EAST TERMINAL CLUSTER. The second promoted landmark, and the
      // only one on the control side of the room. Same fixture, longer reach
      // and a much higher emergency figure — the east wall keeps one warm
      // anchor so the dark room still has two ends.
      { kind: 'core', x: 1560, y: 1150, r: 12, color: 0x8a4a10, hot: 0xffb45a, normal: 0.16, emergency: 0.72, reach: 78 },
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
      // ── THE HERO MACHINE'S DECK SPILL. The arcs themselves are painted into
      //    the prop's own ADD faces, because a source at this layer's depth
      //    would be drawn under a 352x328 opaque sprite. What belongs HERE is
      //    the part of their light that lands on the floor beside it: two
      //    angled halos, sitting just outside the housing rim at the bearings
      //    of the two arcs, where the prop texture is transparent.
      //
      //    Housing centre is world (340, 572) with an outer radius of 144.
      //    These sit at ~160-180 out, on the two opposite bearings, and their
      //    rotation is each arc's tangent — light off a curved fixture lies
      //    ALONG the fixture. The amber one is dead at normal power, exactly
      //    like the arc that casts it.
      //    SPILL ONLY. `emitter: false` — the bright part of these two sources
      //    is painted on the machine, and leaving the strip's own emitter on
      //    put a crisp bar of light on the deck that read as a second object.
      { kind: 'strip', dir: 'h', x: 215, y: 470, len: 96, t: 5, angle: -0.82, emitter: false, color: 0x1a5a96, normal: 0.10, emergency: 0.30, reach: 40, spill: 0.9 },
      { kind: 'strip', dir: 'h', x: 468, y: 678, len: 78, t: 5, angle: 2.27, emitter: false, color: 0x6a3406, normal: 0, emergency: 0.34, reach: 34, spill: 0.9 },
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
      // THE HERO MACHINE. Position, footprint and body are frozen — this is
      // the object the room is landmarked on and the only prop in it. `faces`
      // are its two ADD emissive layers; `loadRoom` derives their position and
      // their depth from the live sprite rather than from repeated literals,
      // so the light cannot end up registered where the machine used to be.
      //
      // The pair is the machine's two power states. `glow` is the plant
      // running: cyan status display, its lamps, the cyan arc channel. `emer`
      // is DEAD until the bus drops and then carries the amber arc, the
      // segmented readout and the single fault lamp — which is what lets the
      // player find the machine in the dark by light that was not there a
      // second earlier.
      {
        x: 340, y: 740, tex: 'prop-pod', solid: true, bodyW: 220, bodyH: 120,
        faces: [
          { tex: 'prop-pod-glow', normal: 0.55, emergency: 1.00 },
          { tex: 'prop-pod-emer', normal: 0,    emergency: 0.95 },
        ],
      },
    ],
    // THE CONSOLE KIT, INSTANCED. Positions, count and collision are frozen —
    // these are the same four cover pillars they have always been, at the same
    // snapped coordinates, with the same 70x70 bodies under the same 112px
    // sprites. What changed is which texture each one wears.
    //
    // The assignment is not decoration. The HEAVY archetype goes to the
    // SOUTH-WEST pillar: the west aisle is the room's technical side, so that
    // is where the console with authority belongs — and unlike the north-west
    // pillar, which the hero machine's sprite half covers at this camera, it is
    // somewhere the player can actually see it. The other three are pedestals,
    // with the two variants arranged so no two ADJACENT consoles are identical
    // while the room still reads as having one KIND of terminal in it rather
    // than four unique objects.
    cover: snapAll([
      { x: 400, y: 400, tex: 'ch-con-ped-a' }, { x: 1200, y: 400, tex: 'ch-con-ped-b' },
      { x: 400, y: 1200, tex: 'ch-con-heavy' }, { x: 1200, y: 1200, tex: 'ch-con-ped-a' },
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
