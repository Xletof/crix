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
      { x: 500, y: 350 }, { x: 500, y: 1050 }, // moved walls to act as cover blocks
      { x: 800, y: 350 }, { x: 800, y: 1050 },
      { x: 1100, y: 350 }, { x: 1100, y: 1050 },
      { x: 650, y: 700 }, { x: 950, y: 700 }
    ],
    enemies: [
      { type: 'grunt', x: 800, y: 300 },
      { type: 'grunt', x: 800, y: 1100 },
      { type: 'shooter', x: 1050, y: 700, role: 'suppress' },
    ],
    pickups: [
      { x: 600, y: 350, weapon: 'rifle' },
    ],
    // Central terminal objective
    terminals: [
      { x: 800, y: 700 },
    ],
    reinforce: {
      afterMs: 22000,
      count: 2,
      type: 'grunt',
      door: { x: 1300, y: 100 },
    },
  },

  // ── 2. Service Corridor ────────────────────────────────────────────────
  // Symmetrical square arena with central terminal and peripheral cover clusters.
  {
    id: 'corridor',
    name: 'SERVICE CORRIDOR',
    bounds: { w: 1400, h: 1400 },
    spawn: { x: 200, y: 1200 }, // bottom-left spawn
    exit: { x: 1200, y: 200, side: 'top' }, // top-right exit
    walls: [], // removed zig-zag blockades
    cover: [
      { x: 450, y: 950 }, { x: 950, y: 450 },
      { x: 450, y: 450 }, { x: 950, y: 950 },
      { x: 700, y: 350 }, { x: 700, y: 1050 },
      { x: 350, y: 700 }, { x: 1050, y: 700 }
    ],
    enemies: [
      { type: 'grunt', x: 450, y: 450 },
      { type: 'grunt', x: 950, y: 950 },
      { type: 'shooter', x: 700, y: 350 },
    ],
    pickups: [
      { x: 700, y: 1050, weapon: 'flamethrower' },
    ],
    terminals: [
      { x: 700, y: 700 },
    ],
    reinforce: {
      afterMs: 18000,
      count: 1,
      type: 'shooter',
      door: { x: 700, y: 80 },
    },
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
      { type: 'shooter', x: 550, y: 300 },
      { type: 'shooter', x: 1050, y: 1100, role: 'flanker' },
    ],
    pickups: [
      { x: 800, y: 700, weapon: 'detonator' },
    ],
    terminals: [
      { x: 500, y: 450 },
      { x: 1100, y: 950 },
    ],
    reinforce: {
      afterMs: 20000,
      count: 3,
      type: 'grunt',
      door: { x: 800, y: 100 },
    },
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
  },
];
