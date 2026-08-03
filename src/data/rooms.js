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
    },
    walls: [],
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
    },
    walls: [], // opened cells completely
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
    exit: null,
    // Severe and empty: near-black, one deep red key, very few strips and a
    // large sparse hex. The climax should feel bare, not busy.
    floor: {
      base: PAL.vadBase, line: PAL.vadLine, panel: PAL.vadPanel,
      strip: PAL.vadStrip, stripGlow: PAL.vadStripGlw,
      accent: PAL.vadAcc, accentGlow: PAL.vadAccGlw,
      hexW: 120, hexH: 105, stripEvery: 520, accentEvery: 800,
      panels: 24, scorch: 8,
    },
    walls: [],
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
