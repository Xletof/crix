// Hand-authored room specs for the Death Star infiltration.
//
// Enemy spec fields:
//   type    : 'grunt' | 'shooter'
//   x, y    : starting position
//   patrol  : optional array of {x,y} waypoints — enemy walks these when unalerted.
//             If omitted, enemy idles at spawn until alarm fires.
//   role    : optional 'flanker' — this shooter will attempt to flank rather than suppress.

export const ROOMS = [
  // ── 1. Hangar Bay ──────────────────────────────────────────────────────
  // Wide opening chamber. Symmetrical arena flanking the central terminal.
  {
    id: 'hangar',
    name: 'HANGAR BAY',
    bounds: { w: 1600, h: 1400 },
    spawn: { x: 200, y: 700 },
    exit: { x: 1500, y: 700, side: 'right' },
    walls: [], // opened up completely
    cover: [
      // Two rows ~300px apart (one dash-vault chain) + offset diagonals in
      // the middle — the center lane stays open for super volleys.
      { x: 500, y: 350 }, { x: 500, y: 1050 },
      { x: 800, y: 350 }, { x: 800, y: 1050 },
      { x: 1100, y: 350 }, { x: 1100, y: 1050 },
      { x: 650, y: 500 }, { x: 950, y: 900 },
    ],
    enemies: [
      { type: 'grunt', x: 800, y: 300 },
      { type: 'grunt', x: 800, y: 1100 },
      { type: 'grunt', x: 1300, y: 400 },
      { type: 'grunt', x: 1300, y: 1000 },
      { type: 'shooter', x: 1050, y: 700 },
    ],
    pickups: [
      { x: 600, y: 350, weapon: 'rifle' },
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
    walls: [],
    cover: [
      // Diamond ring around the terminal at (700,700), ~280px spacing
      { x: 700, y: 420 }, { x: 700, y: 980 },
      { x: 420, y: 700 }, { x: 980, y: 700 },
      { x: 500, y: 500 }, { x: 900, y: 500 },
      { x: 500, y: 900 }, { x: 900, y: 900 },
    ],
    enemies: [
      { type: 'grunt', x: 450, y: 450 },
      { type: 'grunt', x: 950, y: 950 },
      { type: 'bomber', x: 1150, y: 350 }, // introduce the kamikaze here
      { type: 'sniper', x: 700, y: 350 },  // and the long-range zoner
      { type: 'shooter', x: 350, y: 1050 },
    ],
    pickups: [
      { x: 700, y: 1050, weapon: 'rifle' },
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
    walls: [], // opened cells completely
    cover: [
      { x: 400, y: 300 }, { x: 800, y: 300 }, { x: 1200, y: 300 },
      { x: 400, y: 1100 }, { x: 800, y: 1100 }, { x: 1200, y: 1100 },
      { x: 600, y: 700 }, { x: 1000, y: 700 },
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
    exit: null,
    walls: [],
    cover: [
      // 4 corner cover pillars
      { x: 400, y: 400 }, { x: 1200, y: 400 },
      { x: 400, y: 1200 }, { x: 1200, y: 1200 },
    ],
    enemies: [],
    boss: true,
    bossSpawn: { x: 800, y: 400 },
    gates: [
      { x: 800, y: 100 }, { x: 800, y: 1500 },
      { x: 100, y: 800 }, { x: 1500, y: 800 },
    ],
  },
];
