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
  {
    id: 'corridor',
    name: 'REACTOR JUNCTION',
    bounds: { w: 1400, h: 1400 },
    spawn: { x: 200, y: 1200 }, // bottom-left spawn
    exit: { x: 1200, y: 200, side: 'top' }, // top-right exit
    // ══ THE REACTOR JUNCTION, THIRD ARENA ══════════════════════════════════
    //
    // THE ROOM IS NOT A CORRIDOR. Its id is `corridor` and its name has always
    // been REACTOR JUNCTION, and the second of those is the true one: 1400x1400,
    // perfectly square, the only square room in the game, with the objective
    // dead centre and three feeder gates on three different walls. It is not
    // narrower than either approved arena — it is the SMALLEST, and it is the
    // only one with no long axis at all.
    //
    // That is the spatial test, and it is a harder one than "narrow". Both
    // approved rooms are AXIAL: the chamber is a nave to a dais running south
    // to north, the hangar is a deployment deck running west to east, and in
    // both of them composition and direction are the same decision. A square
    // room with a held centre offers neither. The player arrives in the
    // south-west, must reach the north-east, and is attacked from three
    // bearings while standing on the one thing they cannot leave.
    //
    //   VADER CHAMBER   enclosed technical containment. A nave to a dais, a
    //                   freestanding hero machine, cool graphite, severe.
    //   HANGAR          an operational deployment deck. A launch axis to a
    //                   blast door, a landmark that is PART OF THE WALL,
    //                   neutral gunmetal, working and scuffed.
    //   REACTOR JUNCTION  THE CROSSING WHERE FOUR SERVICE WAYS MEET AROUND A
    //                   LIVE CONTAINMENT DECK. No hero object at all: the
    //                   architecture is the landmark, the corridor grammar
    //                   lives in the walls and the approaches, and the middle
    //                   is deliberately the calmest floor in the game.
    //
    // HOW A SQUARE ROOM GETS DIRECTION WITHOUT ARROWS. Four broad ways run in
    // from the wall band and stop at a threshold cross-member; the crossing
    // they meet on is the one RAISED region in the room and the ways are all
    // RECESSED. Approaches drop, the junction lifts. Three of the four ways
    // are dark service recesses with the room's plumbing lying in them; the
    // fourth — the departure spur under the exit — is the only LIGHTER one,
    // and it is the only place on the floor carrying a painted marking. That
    // is four architectural statements about the way out and zero arrows,
    // which is what §19 is protecting against.
    //
    // Everything below is painted art or emissive layer, EXCEPT the cover
    // list — see the topology block above it. `bounds`, `spawn`, `exit`,
    // `gates`, `walls`, `terminals`, `enemies`, `pickups` and the three prop
    // bodies are exactly what they were.
    floor: {
      // COOL STEEL, AND THE LADDER IS INVERTED. In both approved rooms the
      // perimeter machinery sits a step LIGHTER than the deck; here the walls
      // are the darkest thing in the room and the floor is the brightest. See
      // the `rj*` block in pixelArt.js — that inversion is the material claim
      // of a service passage and it is what stops this reading as the hangar
      // in a smaller box.
      base: PAL.rjDeck, line: PAL.rjSeam, panel: PAL.rjRecess,
      strip: PAL.rjRib, stripGlow: PAL.rjRibLit,
      accent: PAL.rjRib, accentGlow: PAL.rjRibLit,
      // NO BAKED STRIP LIGHTS. The baseline carried NINE full-width saturated
      // orange-red bars across a 1400px room at `stripEvery: 150`, plus four
      // more accents — the loudest thing in every single frame, running edge to
      // edge over the props, the cover and the fight. Red is the saber, the
      // SABER THROW lane and the telegraphs; this room was spending it on
      // wallpaper. The room's light is authored in `emissives`.
      stripEvery: 0, accentEvery: 0,
      // 132x116 against the chamber's 120x105 and the hangar's 160x140 — the
      // deck plates of a service level, between a control room's and a shed's.
      // Kept to a whisper for the same reason both of them do.
      hexW: 132, hexH: 116, hexAlpha: 0.24,
      panels: 34, scorch: 30,
      grounded: true,
      // WORN SAFETY WHITE, and there is almost none of it. The baseline painted
      // TWO CONCENTRIC AMBER RINGS at r=250 and r=300 centred exactly on the
      // objective — which is the shape, the size and the placement of a circle
      // telegraph, sitting on the one square metre of floor where the boss
      // fight resolves. The chamber pass already killed a ring painted round
      // its dais for precisely this reason. Both are gone.
      markColor: PAL.rjPaint, markAlpha: 0.22,
      marks: [
        // Caution hatching at the three gate mouths, and nothing at the
        // fourth: the exit is marked as a PLACE rather than as a hazard.
        { kind: 'stripes', x: 606, y: 100, w: 188, h: 74, alpha: 0.55, gap: 38 },
        { kind: 'stripes', x: 100, y: 606, w: 74, h: 188, alpha: 0.55, gap: 38 },
        { kind: 'stripes', x: 1226, y: 606, w: 74, h: 188, alpha: 0.55, gap: 38 },
        // THE DEPARTURE SPUR, bracketed. Corner brackets rather than chevrons:
        // a repeated arrow down a corridor turns the environment into UI, and
        // one marked-out threshold says the same thing once.
        { kind: 'bay', x: 1112, y: 116, w: 176, h: 200, alpha: 0.8, lw: 5 },
      ],
      // The steel ladder, plus the three pipe tones the conduit needs.
      archPal: {
        sink: PAL.rjSink, recess: PAL.rjRecess, deck: PAL.rjDeck,
        deckLit: PAL.rjDeckLit, rib: PAL.rjRib, ribLit: PAL.rjRibLit,
        seam: PAL.rjSeam, bolt: PAL.rjBolt,
        pipe: PAL.rjPipe, pipeLit: PAL.rjPipeLit, pipeDark: PAL.rjPipeDark,
      },
      // ── LARGE, then MEDIUM, then SMALL. Drawn in list order.
      architecture: [
        // ══ LARGE — the crossing and the four ways that meet on it.
        //
        // THE CROSSING. The one raised region in the room, and the calmest
        // floor in the game: no marking, no seam, no hardware inside it. The
        // objective stands in the middle of it and every cover object in the
        // room stands on it. §18 asks a narrow room's central lane to be
        // quieter than an open arena's, and in a square room the whole centre
        // IS the lane.
        // `edge: false` — a region's seam pair drawn round the objective is two
        // hard lines flanking the one place the boss fight resolves, which is
        // the same mistake as the amber rings it replaced. The value change on
        // its own is what a raised floor looks like from above.
        { kind: 'region', x: 400, y: 400, w: 600, h: 600, tone: 'deckLit', alpha: 0.34, edge: false },
        // THE FOUR WAYS. Recessed, so the crossing lifts out of them, and all
        // four at DIFFERENT WIDTHS — 260 / 208 / 160 / 160. A square room
        // composed of four identical arms is a compass rose; the widths are
        // what make it a place with a busy side and a quiet one.
        //
        //
        // AT 0.8 THEY PHOTOGRAPHED AS HOLES. `recess` laid that thickly over
        // this deck lands near '#151b22', and a near-black rectangle in a
        // top-down game does not read as a floor one step down — it reads as a
        // pit, which is precisely the lie §17 forbids in the room with the
        // least space to spare. 0.62 is a step, not a void.
        //
        // WEST — the main artery, and the widest. It runs into the supply wall.
        { kind: 'region', x: 96, y: 570, w: 304, h: 260, tone: 'recess', alpha: 0.62, edge: 'h' },
        // NORTH — the service way, under the north gate.
        { kind: 'region', x: 596, y: 96, w: 208, h: 304, tone: 'recess', alpha: 0.62, edge: 'v' },
        // EAST — the narrowest, off the control wall.
        { kind: 'region', x: 1000, y: 620, w: 304, h: 160, tone: 'recess', alpha: 0.62, edge: 'h' },
        // THE DEPARTURE SPUR. The ONE way that is lighter rather than deeper,
        // because it is not a service run — it is the way out, and it should
        // read as the destination from anywhere in the room.
        { kind: 'region', x: 1120, y: 96, w: 160, h: 334, tone: 'deckLit', alpha: 0.5, edge: 'v' },
        // THE MUSTER FLOOR. Where the player actually arrives. Barely a value
        // at all — the south-west quarter is the quiet corner of the room and
        // its job is to not be interesting.
        { kind: 'region', x: 110, y: 940, w: 420, h: 364, tone: 'deckLit', alpha: 0.16, edge: 'h' },

        // ══ MEDIUM — the plumbing. This is the room's signature object and
        // the reason it is called a junction.
        //
        // THE SPINE. 1070px of twin conduit running the room's full height down
        // the west side and into the interchange — the longest single form in
        // the arena, and the reason the north-west is the room's technical
        // corner.
        //
        // WHY IT IS NOT ALONG THE SOUTH WALL, WHERE IT WAS FIRST DRAWN. The
        // camera's centre is pinned inside y [598, 802] and the touch controls
        // cover the bottom ~200px of the viewport, so world y beyond about 1100
        // is behind the joysticks from EVERY camera position this room allows.
        // A form that long belongs where the player can see it; the side walls
        // have no such obstruction, because the controls sit low rather than
        // wide.
        { kind: 'conduit', dir: 'v', x: 148, y: 170, len: 1070, t: 80, runs: 2, bore: 28, step: 210, phase: 64 },
        // The north way's run, HELD AGAINST THE WESTERN EDGE of the way rather
        // than laid up its middle. Centred, it was a bright vertical mast
        // pointing straight down at the objective from the top of the frame —
        // an axis where §18 asks for calm. Along one edge it is what plumbing
        // in a passage actually looks like, and the way itself stays open.
        { kind: 'conduit', dir: 'v', x: 600, y: 100, len: 300, t: 62, runs: 2, bore: 20, step: 170, phase: 52 },
        // The east stub: ONE run, not two. The narrow way gets the small pipe,
        // which is the cheapest way to say the two sides do different work.
        { kind: 'conduit', dir: 'h', x: 1004, y: 672, len: 296, t: 56, runs: 1, bore: 22, step: 150, phase: 34 },

        // THRESHOLD CROSS-MEMBERS. One structural rib across the mouth of each
        // way, where it meets the crossing. These are the room's direction:
        // four gates you can see the frame of, from the middle of the floor.
        // Drawn in the DECK'S OWN lit tone rather than the rib tone. At full
        // rib value these photographed as four bright bars standing across the
        // approaches — posts, in a room whose whole discipline is that visual
        // and collision width must agree. A threshold is a raised lip.
        // `alpha` fades the rib's near-black surround along with its face. A
        // rib at full strength is an OBJECT — outlined, and therefore something
        // standing on the deck; at half it is a change in the floor, which is
        // all a threshold is entitled to be.
        { kind: 'rib', dir: 'v', x: 392, y: 556, len: 288, t: 14, tone: 'deckLit', alpha: 0.5 },
        { kind: 'rib', dir: 'h', x: 580, y: 392, len: 240, t: 14, tone: 'deckLit', alpha: 0.5 },
        { kind: 'rib', dir: 'v', x: 992, y: 606, len: 188, t: 14, tone: 'deckLit', alpha: 0.5 },
        { kind: 'rib', dir: 'h', x: 1108, y: 426, len: 184, t: 14, tone: 'deckLit', alpha: 0.5 },

        // Deck plates, in the three quiet quarters and never on the crossing.
        { kind: 'plate', x: 276, y: 180, w: 254, h: 300, inset: 24 },
        { kind: 'plate', x: 150, y: 950, w: 340, h: 300, inset: 24 },
        { kind: 'plate', x: 1010, y: 930, w: 290, h: 320, inset: 24 },
        // Thresholds, flush inboard of the wall band.
        { kind: 'doorframe', x: 600, y: 90, w: 200, h: 38 },
        { kind: 'doorframe', x: 1112, y: 90, w: 176, h: 38 },
        { kind: 'doorframe', x: 90, y: 600, w: 38, h: 200 },
        { kind: 'doorframe', x: 1272, y: 600, w: 38, h: 200 },
        // Recessed maintenance bays against the side walls.
        { kind: 'inset', x: 1192, y: 210, w: 96, h: 170 },
        { kind: 'inset', x: 1192, y: 900, w: 96, h: 180 },

        // ══ SMALL — sparse, and never on the crossing.
        { kind: 'hatch', x: 250, y: 862, w: 54, h: 42 },
        { kind: 'hatch', x: 1078, y: 320, w: 50, h: 42 },
        { kind: 'hatch', x: 616, y: 1244, w: 54, h: 42 },
        { kind: 'vent', x: 1264, y: 300, w: 30, h: 56 },
        { kind: 'vent', x: 1244, y: 906, w: 30, h: 56 },
        { kind: 'vent', x: 856, y: 1276, w: 56, h: 30 },
      ],
    },
    // THE JUNCTION WALL. `pipes` was three horizontal bars and a collar every
    // 96px, identical on all four sides with no phase offset — the same
    // "procedurally repeated" verdict the chamber's `bare` and the hangar's
    // `ribbed` both took, and here it mattered more, because this room has no
    // hero prop and the wall is most of what it has.
    //
    // `junction` is the RULE both approved walls share — one bay vocabulary, a
    // job per side, a phase offset per side — at a SHORTER 260px period with a
    // pier-and-lintel frame and a conduit bank. See drawPerimeter.
    //
    // THE LANDMARK IS DECLARED HERE, and it is deliberately not a door: the
    // conduit interchange on the west supply wall is where every pipe in the
    // room converges. North is where you are going — the exit and the north
    // gate are cut through that band — and west is the machinery. Those are the
    // room's two poles, and neither of them is the middle.
    perimeter: {
      style: 'junction', thickness: 96,
      wall: PAL.rjWall, wallLit: PAL.rjWallLit, wallDark: PAL.rjWallDark,
      trim: PAL.rjRib, glow: PAL.rjRibLit,
      features: [
        // ON THE WEST WALL, NOT THE SOUTH, and the reason is the viewport
        // rather than taste. The game camera is inset below the HUD top bar and
        // the touch controls cover the bottom of the screen, so in a 1400-tall
        // room with the camera pinned inside y [598, 802] the south band is
        // behind the joysticks from every position the player can reach. A
        // landmark nobody can look at is not a landmark. The side walls have no
        // such obstruction, and the supply wall is where a manifold belongs
        // anyway: it is the plumbing side, the spine runs into it, and the
        // reactor core prop stands directly in front of its centre.
        //
        // `at: 400, width: 420` puts its southern buttress exactly on the west
        // gate's doorway cut at y 610, so the opening never eats the feature.
        { side: 'left', at: 400, width: 420, kind: 'interchange', manifold: 176 },
        // Two mountings for the wall control panel, in two different functional
        // contexts — a control bay on the east wall and a service station on
        // the supply wall. The archetype was validated once in the hangar;
        // validating it twice, on two walls with different jobs, is what turns
        // "it worked" into "it generalizes".
        { side: 'right', at: 420, width: 96, kind: 'panelmount' },
        { side: 'left', at: 900, width: 96, kind: 'panelmount' },
      ],
    },
    // ══ AUTHORED LIGHT ══════════════════════════════════════════════════
    //
    // Same architecture as both approved rooms, same two independent
    // intensities, and a third composition — because a third room's dark state
    // has to be a different SENTENCE, not the same one in a different place.
    //
    //   chamber   containment machinery and technical consoles
    //   hangar    a shuttle and the deployment systems around it
    //   junction  FOUR LIT THRESHOLDS AND ONE MANIFOLD. You orient by the
    //             DOORS. That is the honest answer for a square room with no
    //             long axis and no hero object: in the dark the player cannot
    //             navigate by shape, so the room tells them where its openings
    //             are and which one is the way out.
    //
    // The same two rules held the list down. Nothing emissive stands on the
    // crossing — every source is on the perimeter, on the reactor core, or on
    // one of the three powered cover consoles — and nothing here is crimson.
    emissives: [
      // ── THE FOUR THRESHOLDS. The room's whole directional argument, and the
      //    only part of it that survives a blackout.
      { kind: 'strip', dir: 'h', x: 700, y: 104, len: 170, t: 5, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.16, emergency: 0.44, reach: 20 },
      { kind: 'strip', dir: 'v', x: 104, y: 700, len: 170, t: 5, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.16, emergency: 0.44, reach: 20 },
      { kind: 'strip', dir: 'v', x: 1296, y: 700, len: 170, t: 5, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.16, emergency: 0.44, reach: 20 },
      // THE EXIT. The brightest fixture in the room in both states, because in
      // a room you orient by doorways it is the answer to the actual question.
      { kind: 'strip', dir: 'h', x: 1200, y: 104, len: 152, t: 6, color: 0x2a4a6a, hot: 0xd6e8ff, normal: 0.22, emergency: 0.70, reach: 24 },

      // ── THE INTERCHANGE, west wall. The room's dark-state landmark, seated
      //    in the housings the wall painter cut for it. The two flank fixtures
      //    are DEAD at normal power: the moment the bus drops, hardware that
      //    was not lit a second ago comes up, which is the whole difference
      //    between an authored second state and a dimmer.
      { kind: 'core', x: 71, y: 400, r: 12, color: 0x8a4a10, hot: 0xffb45a, normal: 0.15, emergency: 0.78, reach: 78 },
      { kind: 'strip', dir: 'v', x: 71, y: 257, len: 56, t: 6, color: 0x6a3406, hot: 0xffab52, normal: 0, emergency: 0.30, reach: 20 },
      { kind: 'strip', dir: 'v', x: 71, y: 543, len: 56, t: 6, color: 0x6a3406, hot: 0xffab52, normal: 0, emergency: 0.30, reach: 20 },

      // ── WEST, SUPPLY. The densest wall, and its lamps are NOMINAL: they do
      //    not get louder in the dark. A working wall has a couple of lamps on
      //    it and not a row.
      { kind: 'led', x: 74, y: 148, r: 3, color: 0x1a7a3a, hot: 0x8fffb0, normal: 0.26, emergency: 0.26, reach: 10 },
      { kind: 'led', x: 74, y: 1010, r: 3, color: 0x1a7a3a, hot: 0x8fffb0, normal: 0.26, emergency: 0.26, reach: 10 },
      // One segmented emergency run on the supply bank. Short, because an
      // unbroken bar down the edge of the screen is a graphic, not a fixture.
      { kind: 'strip', dir: 'v', x: 98, y: 1200, len: 150, t: 5, color: 0x6a3406, hot: 0xffab52, normal: 0, emergency: 0.20, reach: 22 },

      // ── EAST, CONTROL. Cleaner than the supply side, and its light says so.
      { kind: 'strip', dir: 'v', x: 1302, y: 980, len: 150, t: 5, color: 0x2a4a6a, hot: 0xbfd8ff, normal: 0.14, emergency: 0.38, reach: 20 },
      { kind: 'led', x: 1340, y: 1140, r: 3, color: 0x8a5a10, hot: 0xffd08a, normal: 0.22, emergency: 0.22, reach: 10 },

      // ── NORTH, TRANSIT. One lamp. Its job is to stay quiet so that the two
      //    thresholds cut through it are the only events on that wall.
      { kind: 'led', x: 960, y: 104, r: 3, color: 0x8a5a10, hot: 0xffd08a, normal: 0.20, emergency: 0.20, reach: 10 },

      // ── THE REACTOR CORE'S DECK SPILL, and it is ONLY the spill.
      //
      //    WHAT WAS HERE, AND WHY IT WAS NOT LIGHT. A radial `core` at
      //    (260, 352) — 130px BELOW the machine's lit slot, which is at world
      //    y 168..272, and underneath a 304x344 opaque sprite at a depth above
      //    it. Environment light draws at depth 3 and the prop sorts at its own
      //    y of 400, so the entire emitter and all but the outermost ~25px of
      //    the falloff were behind the object they belonged to. The room's
      //    reactor was lit by a source nobody could see, which is why its amber
      //    slats went out with the walls while the interchange beside them came
      //    up. `prop-core-glow` is the fix; this is what that face throws.
      //
      //    A STRIP, NOT A CORE. §7's forbidden shape is precisely the radial
      //    pool this replaces: the machine is a VERTICAL slotted emitter and
      //    its light on the deck should say so. `emitter: false` because the
      //    bright part is painted on the machine — the same contract the hero
      //    machine's two deck spills use, and for the same reason: left on, the
      //    crisp bar reads as a second object lying on the floor.
      //
      //    DEAD AT NORMAL POWER. The approved normal composition is frozen and
      //    a warm pool on the deck is the one part of this pass that could
      //    reach outside the prop's own rectangle. It comes up only when the
      //    bus drops, so the normal-power delta stays inside the machine.
      { kind: 'strip', tag: 'reactor', dir: 'v', x: 262, y: 452, len: 96, t: 6, emitter: false, color: 0x8a4a10, normal: 0, emergency: 0.26, reach: 20, spill: 0.9 },

      // ══ EMERGENCY LANE GUIDANCE ════════════════════════════════════════
      //
      // THE PROBLEM THIS SOLVES IS THE TOPOLOGY PASS'S OWN SUCCESS. Breaking
      // the eight-cover ring opened the crossing, which is what handset play
      // asked for and approved — but the ring was also, accidentally, the only
      // thing standing in the middle of the room with a shape. With it gone,
      // LIGHTS OUT from the objective is a black void: the north and south
      // bands are both outside the viewport from a camera pinned inside
      // y [598, 802], neither side wall is in frame, and the only lit object
      // left is one powered terminal off to the east. Combat stayed perfectly
      // fair — the complaint was never "I cannot see Vader" — but the room
      // stopped being a FOUR-WAY JUNCTION and became a dark rectangle.
      //
      // WHAT IT IS: recessed emergency wayfinding set into the four service
      // approaches, DEAD at normal power and modest under emergency. It is
      // deliberately not a lighting change. `normal: 0` means `setPower(0)`
      // sets every one of these parts invisible, so the approved normal-power
      // composition is not dimmed, warmed or touched — its delta is zero
      // pixels, which is the only honest way to add to a frozen room.
      //
      // FOUR RULES HELD THE LIST DOWN, and each of them is a way this could
      // have gone wrong:
      //
      //   NOTHING ON THE CROSSING. Not one emitter and not one pixel of spill
      //   enters x[400,1000] y[400,1000]. The empty middle is a proven
      //   gameplay AND visual asset — the composition is lit approach
      //   fragments around a DARK OPEN CROSSING that combat owns, and a guide
      //   run through the objective would be the cover ring's mistake in
      //   light. `smoke-junction` asserts the containment on the spill box,
      //   not on the emitter, because the spill is what actually reaches.
      //
      //   SEGMENTS, NEVER A LANE. Two fixtures per approach with a gap
      //   between them wider than either one is long, and both of them stop
      //   short of the crossing. THIS IS A SABER THROW PROBLEM before it is a
      //   taste problem: the throw is a long saturated crimson corridor out of
      //   the boss, and it is the room's strongest line language by
      //   entitlement. An environmental run of light down an approach competes
      //   with it directly, so these are short, broken, cool and dim, and the
      //   test asserts that no approach's fixtures span more than half its run.
      //
      //   HELD TO ONE EDGE OF EACH WAY, never up its middle. Centred, a lit
      //   run down an approach is an axis aimed at the objective — the same
      //   verdict the north conduit already took when it was drawn up the
      //   centre of its way. Against an edge it is what recessed wayfinding
      //   in a service passage actually looks like, and the way stays open.
      //   Each one sits on the edge its approach's own hardware is not on.
      //
      //   THEY REVEAL ARCHITECTURE THAT EXISTS. Every fixture is inside one of
      //   the four authored floor regions, so what comes up in the dark is the
      //   room's real plan and not a graphic painted over it.
      //
      // NO BAKED SOCKET. §11 offers one, and it is declined: a slot cut into
      // the backdrop would be visible at NORMAL power, in a normal composition
      // the human just approved, to buy believability for something only ever
      // seen against a near-black floor. The recessed read is carried by the
      // construction instead — a small crisp emitter with a tight spill
      // stretched along its own axis, which is a light in the deck rather than
      // a shape on it.
      //
      // FOUR JOBS, FOUR VOICES, and the difference is meant to be sensed
      // rather than decoded — no colour coding, no green-means-exit.
      //
      // WEST / REACTOR — cyan-biased and technical, because this is the
      // service artery and every pipe in the room runs into the interchange at
      // the end of it. Its inboard fixture is the strong one: §14's stronger
      // terminal, seated under the interchange's southern buttress so the
      // approach binds to the landmark it feeds. Held to the way's NORTH edge,
      // which is the interchange side; the spine conduit owns x 108..188.
      { kind: 'strip', guide: true, dir: 'h', x: 222, y: 596, len: 60, t: 4, color: 0x1c4653, hot: 0xa6e0ec, normal: 0, emergency: 0.30, reach: 18 },
      { kind: 'strip', guide: true, dir: 'h', x: 352, y: 596, len: 32, t: 4, color: 0x1c4653, hot: 0xa6e0ec, normal: 0, emergency: 0.22, reach: 16 },

      // NORTH / SERVICE — cool service white. Held to the way's EAST edge,
      // because the north conduit is already against its west one.
      { kind: 'strip', guide: true, dir: 'v', x: 778, y: 180, len: 52, t: 4, color: 0x24405c, hot: 0xbcd2ea, normal: 0, emergency: 0.26, reach: 18 },
      { kind: 'strip', guide: true, dir: 'v', x: 778, y: 318, len: 32, t: 4, color: 0x24405c, hot: 0xbcd2ea, normal: 0, emergency: 0.20, reach: 16 },

      // EAST / CONTROL — the same cool family, one step whiter. The control
      // side is the cleaner wall and its light has said so since the art pass.
      // Held to the way's SOUTH edge, under the east stub conduit.
      { kind: 'strip', guide: true, dir: 'h', x: 1228, y: 754, len: 52, t: 4, color: 0x24405c, hot: 0xc6dcf2, normal: 0, emergency: 0.26, reach: 18 },
      { kind: 'strip', guide: true, dir: 'h', x: 1058, y: 754, len: 32, t: 4, color: 0x24405c, hot: 0xc6dcf2, normal: 0, emergency: 0.20, reach: 16 },

      // THE DEPARTURE SPUR — a warm NEUTRAL white, one notch brighter, and its
      // outboard fixture is the longest single guide in the room. That is the
      // whole of §15: the way out stays the easiest structure to rediscover in
      // the dark, said with a longer segment and a warmer neutral rather than
      // with a colour that means "exit". It is warm-neutral and not amber —
      // green sits at 96% of red here, where the danger red the saber and the
      // telegraphs own drops it under a third.
      { kind: 'strip', guide: true, dir: 'v', x: 1148, y: 206, len: 72, t: 4, color: 0x4a4436, hot: 0xf0e6cc, normal: 0, emergency: 0.32, reach: 18 },
      { kind: 'strip', guide: true, dir: 'v', x: 1148, y: 348, len: 36, t: 4, color: 0x4a4436, hot: 0xf0e6cc, normal: 0, emergency: 0.24, reach: 16 },
    ],
    walls: [],
    // ══ THE COVER, AFTER HANDSET PLAY ══════════════════════════════════════
    //
    // THE RING IS GONE, AND ITS POSITIONS ARE NO LONGER FROZEN. This room
    // inherited EIGHT cover objects arranged in a near-perfect circle around
    // the objective, and the art pass preserved that arrangement on purpose —
    // it was gameplay geometry and the pass was allowed to repaint it, not to
    // move it. Handset play then rejected the topology outright: a furniture
    // carousel around the one thing the player cannot leave, with the boss
    // fighting the desks. The freeze was revoked; this is the correction.
    //
    // WHAT ACTUALLY FAILED, MEASURED (`tests/diag-junction-*.mjs`):
    //
    //   ALL EIGHT SAT INSIDE THE CROSSING. The floor art already declares a
    //   600x600 raised region as the junction — the calmest floor in the game
    //   and the room's whole spatial idea — and every single cover body was
    //   parked in it. The nearest solid face was 205px from the objective.
    //
    //   THE GAPS WERE VADER-PROOF. The ring's tightest neighbour gaps measured
    //   90px. Vader is Ø112 (BOSS.radius 56, doubled) and cannot enter one.
    //   The nav grid, which tests a cell CENTRE against a body rect inflated by
    //   23px, routed ordinary actors straight through them — so the pathing
    //   said yes and the physics said no. Only 47% of the crossing admitted a
    //   Ø112 body at all.
    //
    //   SO THE BOSS JAMMED. Driven from eight stations by his own AI with the
    //   move scheduler silenced, Vader closed on the player on 2 of 8 legs. On
    //   all three feeder approaches he spent 43-46% of frames in bodily contact
    //   with geometry and never arrived; north-to-south he travelled 62px in
    //   six seconds. That is the handset verdict, in numbers.
    //
    // THE RULE THAT REPLACES THE RING, and the one the tests assert:
    //
    //   THE CROSSING IS THE CLEAR COMBAT ENVELOPE. No solid body may intersect
    //   x[400,1000] y[400,1000]. Cover lives in the peripheral bands, where the
    //   room's functions already are. Clear radius at the objective goes 205 ->
    //   357px, and 96.5% of the crossing opens to Vader.
    //
    //   EVERY GAP IS A LANE. 160px minimum between any two solid bodies:
    //   Ø112 plus the nav grid's own 23px agent clearance on each side, which
    //   is two nav cells, so a qualifying gap always contains a fully walkable
    //   cell. Measured minimum is 165px, and there are zero sub-lane gaps.
    //
    //   FOUR PIECES, NOT A TIDIER RING. Deleting four and leaving a tidy
    //   square would pass both rules above and fail the room, so the layout is
    //   deliberately uneven in BOTH radius and bearing. The pieces stand 405,
    //   439, 474 and 528px out — a 0.27 spread against the ring's 0.201 — the
    //   widest gap between two cover bearings is 146 degrees against the ring's
    //   55, and the north-west quadrant carries no cover at all, because the
    //   reactor core prop is already the mass on that side. A five-piece
    //   candidate was built and measured against this one; it opened the centre
    //   just as well but left ordinary enemies in contact with geometry nearly
    //   twice as often across two runs at two densities, so it lost.
    //
    // ASSIGNED BY FUNCTION, AND ONLY ONE OF THEM IS LIT. The east control
    // station is the room's single powered cover object; the other three are
    // service cabinets that declare nothing in the console kit, take the `prop`
    // tint and go out. Three of four rather than the old five of eight — and
    // in the dark that is one lit terminal off to the east instead of a ring of
    // pale boxes orbiting the objective.
    cover: snapAll([
      // NORTH — offset EAST of the feeder way (x 596-804), so the way itself
      // stays the full width the architecture promises, and pulled IN to the
      // crossing's north-east corner rather than parked on the wall: the four
      // pieces have to sit at four different distances from the objective or
      // they are a ring however their bearings fall.
      { x: 920, y: 360, tex: 'rj-cab-b' },
      // EAST — the control side, and the one powered terminal. South of the
      // east way rather than in it.
      { x: 1080, y: 920, tex: 'ch-con-heavy' },
      // WEST — service band, south of the west way. North of it belongs to the
      // reactor core prop, whose 200x120 body owns that whole pocket.
      { x: 280, y: 920, tex: 'rj-cab-a' },
      // SOUTH-WEST — the staging region, on the player's route out of spawn.
      // The one piece that exists for the player rather than for the room.
      { x: 440, y: 1160, tex: 'rj-cab-b' },
    ]),
    // Props: the core is the landmark, the struts are supporting cast. All
    // three sit off the diagonal between spawn (200,1200) and exit (1200,200)
    // so the through-route stays clean. Positions and bodies are frozen.
    props: [
      // THE REACTOR CORE, AND ITS ONE FACE. Position, footprint and body are
      // frozen; the face is registered on the LIVE sprite by `loadRoom`, so
      // the light cannot end up where the machine used to be. `normal` is a
      // restrained presence rather than zero — the slot is painted as running
      // hardware and a lit room should still see a little of it — and
      // `emergency` is where the pass actually lives.
      {
        x: 260, y: 400, tex: 'prop-core',  solid: true, bodyW: 200, bodyH: 120,
        faces: [{ tex: 'prop-core-glow', normal: 0.12, emergency: 0.88 }],
      },
      { x: 1150, y: 1180, tex: 'prop-strut', solid: true, bodyW: 190, bodyH: 60 },
      { x: 1230, y: 480, tex: 'prop-strut', solid: true, bodyW: 190, bodyH: 60, flip: true },
      // THE WALL CONTROL PANEL, SECOND USE-CASE. Each bolted to a mounting the
      // perimeter painter put there for it. NOT SOLID — no body, no nav cell,
      // no LOS rect — and each carries an explicit DEPTH rather than sorting by
      // its y, because a panel fixed to a wall has no ground contact and would
      // otherwise occlude actors hundreds of pixels away.
      { x: 1360, y: 476, tex: 'ch-con-wall', kit: 'ch-con-wall', depth: 6 },
      { x: 40, y: 956, tex: 'ch-con-wall', kit: 'ch-con-wall', depth: 6 },
    ],
    enemies: [
      { type: 'grunt', x: 450, y: 450 },
      // Was nudged off (950,950) because snapping the ring put a console 42px
      // away. The ring is gone; the position stays, because moving a spawn to
      // celebrate that would be changing gameplay geometry for no reason.
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
  //
  // ══ THE FOURTH ARENA ══════════════════════════════════════════════════
  //
  // THE ONE SENTENCE. *A prisoner-transfer block: a long, deliberately
  // exposed escort floor running the full width of the level between two
  // banks of holding cells, from the intake end to a sealed processing gate.*
  //
  // WHY THAT SENTENCE AND NOT A CELL BLOCK. The geometry was audited before a
  // word of art direction was written, and it does not describe the room the
  // name suggests. 1600x1400 is the WIDEST arena in the game and the only one
  // whose long axis runs EAST-WEST. `walls` is EMPTY: there is not one solid
  // structure on the deck. Spawn is on the west edge at (150, 700) and the
  // exit is on the east at (1450, 700) — dead level with it, so the room's
  // plan is a straight walk across its own width, with the two objectives
  // pulled off that line to opposite corners. Two of the four gates are on the
  // EAST wall, which means reinforcements arrive from behind the way out.
  //
  // A room whose middle is empty by design and whose plan is a traverse is not
  // a warren of cells. It is a WALK, watched from both sides. So the open
  // centre — which is frozen gameplay geometry and was never in question —
  // becomes the fiction rather than a thing the art has to apologise for: you
  // are meant to be visible while you cross.
  //
  // ══ WHAT THE BASELINE ACTUALLY WAS ════════════════════════════════════
  //
  //   - SIX full-width saturated CYAN strip lights at `stripEvery: 220` plus
  //     three pale accents, edge to edge over the props, the cover and the
  //     fight. The loudest thing in every frame. Same failure the chamber and
  //     the junction both shipped with, in a different colour.
  //   - NO large forms and no medium forms at all: a flat hex deck at full
  //     contrast, twelve faint corner brackets, and nothing else.
  //   - EIGHT IDENTICAL `bush` consoles on a 3/3/2 grid, every one of them
  //     lit, every one of them carrying a painted RED led bar. In LIGHTS OUT
  //     they were eight equally pale boxes and the brightest objects in a room
  //     that was supposed to be dark.
  //   - The one landmark, a security post, at (260, 1230) — behind the touch
  //     controls from every camera position the player can reach.
  //
  // ══ THE VIEWPORT DECIDED THE COMPOSITION ══════════════════════════════
  //
  // 720x1196 of viewport in a 1600x1400 room pins the camera centre inside
  // x [360, 1240] and y [598, 802]. So the full WIDTH is reachable — the only
  // arena where that is true — and world y beyond about 1100 is behind the
  // joysticks from everywhere. The junction lost a whole build to a landmark
  // on its south wall. Everything that matters here is composed on the
  // east-west axis, which is the axis this room can actually show.
  //
  // ══ LARGE, MEDIUM, SMALL ══════════════════════════════════════════════
  //
  //   LARGE   the escort floor · the two holding aprons · the processing gate
  //   MEDIUM  the two secured thresholds · the processing plates at each
  //           objective · the gate mouths · the service channels
  //   SMALL   hatches, vents, bolts — and there are very few of them
  //
  // ══ FROZEN ════════════════════════════════════════════════════════════
  //
  // `bounds`, `walls` (empty), `spawn`, `exit`, `gates`, `terminals`,
  // `enemies`, `pickups` and every cover POSITION and the cover COUNT are
  // exactly what they were. No human play evidence says the topology is wrong,
  // and mixing a level-design pass into an art pass is how the junction's
  // cover ring survived three sessions. What moved is which TEXTURE stands on
  // which frozen spot — the junction's own rule.
  {
    id: 'detention',
    name: 'DETENTION BLOCK',
    bounds: { w: 1600, h: 1400 },
    spawn: { x: 150, y: 700 },
    exit: { x: 1450, y: 700, side: 'right' },
    floor: {
      // COLDER AND HARDER THAN THE JUNCTION, and one notch lighter. A
      // containment level is a maintained institutional space, not a machine
      // deck, and the value has to be there or the cell architecture in the
      // band cannot read at all. Nothing in the ladder is warm and nothing in
      // it is red.
      base: PAL.dtDeck, line: PAL.dtSeam, panel: PAL.dtRecess,
      strip: PAL.dtRib, stripGlow: PAL.dtRibLit,
      accent: PAL.dtRib, accentGlow: PAL.dtRibLit,
      // NO BAKED STRIP LIGHTS. See the baseline note above — six full-width
      // cyan bars is a ceiling fixture drawn on the floor. The room's light is
      // authored in `emissives`.
      stripEvery: 0, accentEvery: 0,
      // 96x84 — the TIGHTEST tiling in the game, against the chamber's 120x105,
      // the junction's 132x116 and the hangar's 160x140. A cell block is laid
      // out to a smaller module than a hangar deck, and the floor is the
      // cheapest place to say so. Kept to a whisper, like all three.
      hexW: 96, hexH: 84, hexAlpha: 0.20,
      panels: 30, scorch: 14,
      grounded: true,
      // WORN SAFETY WHITE, AND ALMOST NONE OF IT. §14's forbidden list is
      // exactly what a detention block invites — prisoner numbers, glowing
      // grids, red lines, yellow stripes the length of the room, repeated
      // arrows — and none of it is here. Four marks in total, all of them at
      // thresholds, none of them on the walk.
      markColor: PAL.dtPaint, markAlpha: 0.20,
      marks: [
        // Caution hatching at the two side gates, where the room is entered
        // from outside. Not at the two east gates: those open behind the
        // processing gate, which is already the most marked place in the room.
        { kind: 'stripes', x: 706, y: 100, w: 188, h: 70, alpha: 0.5, gap: 36 },
        { kind: 'stripes', x: 706, y: 1230, w: 188, h: 70, alpha: 0.5, gap: 36 },
        // The two processing points, bracketed. Corner brackets rather than a
        // painted circle: an objective is a PLACE, and a ring drawn round the
        // square metre a boss fight resolves on is a circle telegraph whatever
        // colour it is. The chamber and the junction each killed one.
        { kind: 'bay', x: 400, y: 350, w: 200, h: 200, alpha: 0.7, lw: 5 },
        { kind: 'bay', x: 1000, y: 850, w: 200, h: 200, alpha: 0.7, lw: 5 },
      ],
      archPal: {
        sink: PAL.dtSink, recess: PAL.dtRecess, deck: PAL.dtDeck,
        deckLit: PAL.dtDeckLit, rib: PAL.dtRib, ribLit: PAL.dtRibLit,
        seam: PAL.dtSeam, bolt: PAL.dtBolt,
      },
      // ── LARGE, then MEDIUM, then SMALL. Drawn in list order.
      architecture: [
        // ══ LARGE ═════════════════════════════════════════════════════════
        //
        // THE ESCORT FLOOR. The room's spine, and the only large form in the
        // game that runs a level's full width: 1408px of raised deck from the
        // intake wall to the processing gate, level with the spawn and the
        // exit, 280 tall. Nothing is drawn inside it.
        //
        // A VALUE CHANGE, NOT A GRAPHIC. §14 forbids solving detention with
        // floor art, and it explicitly permits a transfer-zone plate change —
        // the difference is that this says the floor here is a different
        // SURFACE, where a painted lane would say the floor here means
        // something. Held at 0.24: the junction's crossing sits at 0.34 over
        // 600x600, and a form this long at that strength is a bright band
        // across the middle of every frame.
        { kind: 'region', x: 96, y: 560, w: 1408, h: 280, tone: 'deckLit', alpha: 0.24, edge: 'h' },

        // THE TWO HOLDING APRONS. Recessed strips in front of the cell banks,
        // so the escort floor lifts out of them and the room reads as a raised
        // walk between two lowered edges.
        //
        // BOTH ARE INTERRUPTED AT THE GATE, and that is where their rhythm
        // comes from rather than from a decoration: the north and south gates
        // land at x 800, so each apron is TWO runs with a 150px service gap
        // between them, and the gap is exactly where the room's own plan puts
        // a doorway. The two runs are unequal on purpose — 620 and 634 — so
        // the room is not a mirror of itself about its own middle.
        //
        // 0.55, NOT 0.8. `recess` laid on thickly over this deck lands near
        // black, and a near-black rectangle in a top-down game reads as a pit
        // rather than as a step down. The junction measured that at 0.62 on a
        // darker deck; this one is lighter, so it can take a little more.
        { kind: 'region', x: 96, y: 96, w: 620, h: 300, tone: 'recess', alpha: 0.55, edge: 'h' },
        { kind: 'region', x: 866, y: 96, w: 638, h: 300, tone: 'recess', alpha: 0.55, edge: 'h' },
        { kind: 'region', x: 96, y: 1004, w: 620, h: 300, tone: 'recess', alpha: 0.55, edge: 'h' },
        { kind: 'region', x: 866, y: 1004, w: 638, h: 300, tone: 'recess', alpha: 0.55, edge: 'h' },

        // ══ MEDIUM ════════════════════════════════════════════════════════
        //
        // THE TWO SECURED THRESHOLDS. Where the escort floor begins and ends —
        // a heavy transverse lip at each end of the walk, so the walk has a
        // start and a finish rather than fading out at the wall.
        //
        // 0.34 ALPHA, BECAUSE A RIB AT FULL STRENGTH IS AN OBJECT. It draws a
        // near-black surround under its face, and at full value four of them
        // photographed as bright posts standing on the junction's deck. This
        // pass measured the same thing at 0.55 and it was worse here than
        // there: a 20x280 lit bar standing across the walk, at the exact
        // proportion of a barrier, in the one place the room must not suggest
        // there is anything to walk round. Thinner and fainter, they are lips.
        { kind: 'rib', dir: 'v', x: 300, y: 560, len: 280, t: 14, alpha: 0.34 },
        { kind: 'rib', dir: 'v', x: 1280, y: 560, len: 280, t: 14, alpha: 0.34 },

        // THE PROCESSING PLATES. One large bolted deck plate under each
        // objective, so the two terminals stand on authored ground rather than
        // floating on open floor. Big — 300x260 — because a small plate is
        // floor noise and a large one is architecture.
        { kind: 'plate', x: 350, y: 320, w: 300, h: 260 },
        { kind: 'plate', x: 950, y: 820, w: 300, h: 260 },

        // THE GATE MOUTHS. A heavy frame on the deck side of each of the four
        // doorways, so a gate is a threshold rather than a hole in a band.
        // Thick jambs are the room's vocabulary and this is where the deck
        // gets to say it.
        { kind: 'doorframe', x: 700, y: 96, w: 200, h: 34 },
        { kind: 'doorframe', x: 700, y: 1270, w: 200, h: 34 },
        { kind: 'doorframe', x: 1470, y: 210, w: 34, h: 180 },
        { kind: 'doorframe', x: 1470, y: 1010, w: 34, h: 180 },

        // THE SERVICE CHANNELS. Short recessed drainage runs at the foot of
        // the cell banks. Two, not a run down the whole wall: the point is
        // that the block is maintained, not that it is plumbed.
        //
        // THEY WERE FIRST DRAWN IN THE APRON GAPS, FULL DEPTH, AT `sink`, AND
        // THEY WERE HOLES. 150x300 of near-black at the mouth of the north and
        // south gates — a pit painted across the one square metre the player
        // walks through to enter the room, which is the single lie a room may
        // not tell about where it can be walked. The gate approaches are plain
        // deck now, at the ground value, and the channels are shallow runs
        // along the bank foot where nobody crosses.
        { kind: 'inset', x: 240, y: 372, w: 300, h: 26, tone: 'recess' },
        { kind: 'inset', x: 1010, y: 1278, w: 300, h: 26, tone: 'recess' },

        // ══ SMALL ═════════════════════════════════════════════════════════
        // Sparse, and all of it out at the edges. The walk carries nothing.
        { kind: 'hatch', x: 210, y: 470, w: 64, h: 44 },
        { kind: 'hatch', x: 1310, y: 940, w: 64, h: 44 },
        { kind: 'hatch', x: 1290, y: 460, w: 44, h: 64 },
        { kind: 'vent', x: 118, y: 900, w: 40, h: 76 },
        { kind: 'vent', x: 1444, y: 470, w: 40, h: 76 },
      ],
    },
    // ── THE CONTAINMENT BANKS. The room's identity, and it is in the WALL.
    //
    // 96 thick, against the baseline's 64: the cells have to be deep enough to
    // be cells. `block` is the fourth perimeter style — cell front, jamb,
    // barred mouth, at a period of 176, the tightest in the game, because
    // containment repeats at the width of one person. See `drawPerimeter`.
    //
    // A COVER OBJECT'S POWER IS A COMPOSITION DECISION, and so is a wall's:
    // north is the fuller run and south is the emptier one, so the two long
    // walls are not each other's mirror.
    perimeter: {
      style: 'block', thickness: 96,
      wall: PAL.dtWall2, wallLit: PAL.dtWallLit2, wallDark: PAL.dtWallDark2,
      trim: PAL.dtRib, glow: PAL.dtRibLit,
      // THE LANDMARK, AND THE FOURTH LANDMARK CLASS. Not a freestanding
      // machine (the chamber), not a door you go through (the hangar), not
      // infrastructure converging on a sealed wall (the junction) — a
      // CHECKPOINT: a gatehouse with its shutter down and the exit cut through
      // its middle. On the east wall because that is where the walk ends, and
      // because the east wall is one of the two the camera clamps let this
      // room actually show.
      features: [{ side: 'right', at: 700, width: 560, opening: 200, kind: 'transfergate' }],
    },
    walls: [], // frozen: this deck has no solid structure on it
    // Props: the observation post and four bunks spilled out of the cells.
    // POSITIONS AND BODIES ARE FROZEN — every one of these is a solid body in
    // the nav grid. Both textures were re-toned into the block's ladder (the
    // bunks were painted from the Imperial family's top end and were the
    // brightest objects in the room; the post was glazed in a bright cyan it
    // had no light to justify).
    props: [
      { x: 260, y: 1230, tex: 'prop-post', solid: true, bodyW: 200, bodyH: 110 },
      { x: 700, y: 480,  tex: 'prop-bunk',   solid: true, bodyW: 120, bodyH: 60 },
      { x: 780, y: 545,  tex: 'prop-bunk-b', solid: true, bodyW: 120, bodyH: 60, flip: true },
      { x: 1290, y: 880, tex: 'prop-bunk-b', solid: true, bodyW: 120, bodyH: 60 },
      { x: 420, y: 960,  tex: 'prop-bunk',   solid: true, bodyW: 120, bodyH: 60, flip: true },
    ],
    // ── THE EIGHT FROZEN COVER SPOTS, AND WHAT NOW STANDS ON THEM.
    //
    // The positions are exactly the baseline's — a 3/3/2 grid, which is a
    // VISUAL problem and not a gameplay one (the tightest neighbour gap is
    // 400px against a Ø112 boss, so the junction's clearance failure does not
    // exist here). Moving them would be a level-design pass wearing an art
    // pass's clothes. What changes is which object stands where, which is the
    // junction's own rule, and it breaks the grid read two ways:
    //
    //   OCCUPANCY. Three powered, five not — the same ratio the hangar and the
    //   junction both landed on, and for the same reason: cover that declares
    //   no light in `CONSOLE_KIT` takes the `prop` tint and GOES OUT. Five of
    //   eight going dark is what keeps this room's blackout black.
    //
    //   PLACEMENT. The three powered pieces are NOT symmetric: the two on the
    //   walk itself and one in the north-east. The checkpoint being the lit
    //   part of the room is the composition; a lit ring would be the grid
    //   again in light.
    //
    // Two bench variants alternate so no two neighbours are the same sprite.
    cover: snapAll([
      { x: 400,  y: 300,  tex: 'dt-bench' },
      { x: 800,  y: 300,  tex: 'dt-bench-b' },
      { x: 1200, y: 300,  tex: 'ch-con-ped-a' },   // the north bank's terminal
      { x: 400,  y: 1100, tex: 'dt-bench-b' },
      { x: 800,  y: 1100, tex: 'dt-bench' },
      { x: 1200, y: 1100, tex: 'dt-bench-b' },
      { x: 600,  y: 700,  tex: 'dt-con-lock' },    // the checkpoint, west side
      { x: 1000, y: 700,  tex: 'ch-con-heavy' },   // the checkpoint, east side
    ]),
    // ══ THE ROOM'S AUTHORED LIGHT ═══════════════════════════════════════
    //
    // THE DARK-STATE SENTENCE: *the room disappears, but the containment
    // system stays armed.*
    //
    // That is the fourth emergency identity, and it is a different KIND of
    // answer from the other three. The chamber's is powered hero machinery,
    // the hangar's is deployment systems, the junction's is sparse wayfinding
    // plus an amber reactor. None of those is available here and none of them
    // should be borrowed: this room has no machine, and it does not need to
    // tell anyone where the doors are, because it has one way out and the
    // whole room points at it. What a detention block has on its emergency bus
    // is LOCKS.
    //
    // FOUR RULES HELD THE LIST DOWN:
    //
    //   NOTHING ON THE ESCORT FLOOR. Not one emitter and not one pixel of
    //   spill enters y [560, 840] between the two thresholds. The walk is
    //   where the fight resolves, and lighting it would be the cover ring's
    //   mistake in light. It is also the whole composition: two scattered
    //   lines of small hard points along the banks, and BLACK between them.
    //
    //   OCCUPANCY, NOT A ROW. The lock lamps are on SOME cells and not
    //   others, at irregular intervals, keyed to the same occupancy the wall
    //   painter draws. A lamp on every cell would be an outline of the
    //   playable space, which §22 forbids and which would be true — two
    //   parallel dotted lines down the long walls is a corridor drawn in
    //   light. Scattered, they are a handful of doors that still have someone
    //   behind them.
    //
    //   NOMINAL LAMPS DO NOT SHOUT. A lock says "holding" whether anyone is
    //   watching or not, so `normal === emergency` on every one of them. They
    //   become the brightest thing in the room by SUBTRACTION when everything
    //   else goes out, which is the honest way for a battery-backed system to
    //   win.
    //
    //   NO RED, AND NO GREEN EITHER. Red is the saber, the telegraphs and the
    //   SABER THROW lane — that rule is three arenas old. Green is newer and
    //   is specific to this room's dark state: enemy bullets are green, and a
    //   scatter of small green points along both walls during a blackout is
    //   incoming fire that is not there. The locks are COLD WHITE-BLUE and the
    //   two emergency systems are amber.
    emissives: [
      // ── THE CELL LOCKS, NORTH BANK. `block` runs its bays at period 176
      //    from a phase of 0, so bay i spans x [176i, 176i + 176] and its
      //    mouth is centred at 176i + 88. Occupied bays on this wall are 0, 1,
      //    4, 6 and 8; bay 5 is the secure leaf and bays 3 and 7 are service.
      //    Five lamps out of nine bays, at gaps of 1, 3, 2, 2 — no interval
      //    repeats twice running, which is what stops the scatter becoming a
      //    rhythm.
      { kind: 'led', x: 88,   y: 78, r: 5, color: 0x25506e, hot: 0xdfeaf6, normal: 0.55, emergency: 0.55, reach: 34 },
      { kind: 'led', x: 264,  y: 78, r: 5, color: 0x25506e, hot: 0xdfeaf6, normal: 0.55, emergency: 0.55, reach: 34 },
      { kind: 'led', x: 792,  y: 78, r: 5, color: 0x25506e, hot: 0xdfeaf6, normal: 0.55, emergency: 0.55, reach: 34 },
      { kind: 'led', x: 1144, y: 78, r: 5, color: 0x25506e, hot: 0xdfeaf6, normal: 0.55, emergency: 0.55, reach: 34 },
      { kind: 'led', x: 1496, y: 78, r: 5, color: 0x25506e, hot: 0xdfeaf6, normal: 0.55, emergency: 0.55, reach: 34 },

      // ── THE CELL LOCKS, SOUTH BANK. EMPTIER, on purpose — three lamps
      //    against the north's five. The block is half full and its two long
      //    walls are not each other's mirror; that asymmetry is the difference
      //    between a composition and a tiling. The south wall's local x runs
      //    backwards, so these are placed in world coordinates directly.
      { kind: 'led', x: 424,  y: 1322, r: 5, color: 0x25506e, hot: 0xdfeaf6, normal: 0.46, emergency: 0.46, reach: 34 },
      { kind: 'led', x: 1072, y: 1322, r: 5, color: 0x25506e, hot: 0xdfeaf6, normal: 0.46, emergency: 0.46, reach: 34 },
      { kind: 'led', x: 1248, y: 1322, r: 5, color: 0x25506e, hot: 0xdfeaf6, normal: 0.46, emergency: 0.46, reach: 34 },

      // ── THE TWO SECURE LEAVES. The one cell on each long wall that is
      //    bolted rather than barred, and the ONLY sources in the room that
      //    are DEAD at normal power. When the bus drops, the interlock on the
      //    door that is not being opened comes up — hardware that was not lit
      //    a second ago, which is the whole difference between an authored
      //    second state and a dimmer. Amber, and it is the only amber here.
      //    Horizontal, matching the bolt the wall painter draws across it: a
      //    strip's spill takes the shape of its source, and this source lies
      //    across the door.
      { kind: 'strip', dir: 'h', x: 968, y: 82, len: 120, t: 5, color: 0x6a3406, hot: 0xffab52, normal: 0, emergency: 0.36, reach: 22 },
      { kind: 'strip', dir: 'h', x: 720, y: 1318, len: 120, t: 5, color: 0x6a3406, hot: 0xffab52, normal: 0, emergency: 0.36, reach: 22 },

      // ── THE PROCESSING GATE. The landmark's own light, and the brightest
      //    fixture in the room in BOTH states — because the room asks one
      //    question from the moment it loads and this is the answer to it.
      //
      //    THREE SOURCES, ALL VERTICAL, ALL ON THE WALL. The two jamb
      //    interlocks flank the doorway at x 1504+ (the band's inner edge is
      //    1504) and the control face sits on the northern bastion. Nothing
      //    radial: a round pool at a rectangular gate is the shape mistake the
      //    junction spent a pass removing.
      //
      //    SHORT AND THICK, NOT LONG AND THIN. At 92x6 and 0.66 they
      //    photographed as two crisp white LINES either side of the doorway —
      //    at that proportion an interlock stops being a fixture and starts
      //    reading as UI drawn over the gate, which is §18's failure. 56x8 at
      //    0.52 is a lamp housing on a jamb.
      { kind: 'strip', dir: 'v', x: 1522, y: 626, len: 56, t: 8, color: 0x2a4a6a, hot: 0xd6e8ff, normal: 0.22, emergency: 0.52, reach: 34 },
      { kind: 'strip', dir: 'v', x: 1522, y: 774, len: 56, t: 8, color: 0x2a4a6a, hot: 0xd6e8ff, normal: 0.22, emergency: 0.52, reach: 34 },
      // The gatehouse control face — a real screen, on the bastion the wall
      // painter builds one into. `drop` biases its wash down onto the deck in
      // front of it, which is what a monitor does and a lamp does not.
      { kind: 'screen', x: 1548, y: 522, w: 56, h: 40, color: 0x1a5a96, hot: 0x9fe0ff, normal: 0.22, emergency: 0.58, reach: 66, drop: 0.26 },

      // ── THE INTAKE WALL. ONE lamp, and it is the room's quietest fixture.
      //    The player arrives under it. A working wall has a couple of lamps
      //    on it and not a row, and this side's job is to be the end you leave
      //    rather than the end you are heading for.
      { kind: 'led', x: 78, y: 610, r: 3, color: 0x8a5a10, hot: 0xffd08a, normal: 0.20, emergency: 0.20, reach: 10 },
    ],
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
