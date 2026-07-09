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
  // Wide opening chamber. Two stormtroopers on patrol + a death trooper
  // guarding the far end. Cover crates in the middle.
  {
    id: 'hangar',
    name: 'HANGAR BAY',
    bounds: { w: 1600, h: 1400 },
    spawn: { x: 200, y: 700 },
    exit: { x: 1500, y: 700, side: 'right' },
    walls: [
      { x: 500, y: 350 }, { x: 500, y: 1050 },
    ],
    cover: [
      { x: 450, y: 700 },
      { x: 800, y: 350 }, { x: 950, y: 350 },
      { x: 700, y: 620 }, { x: 700, y: 780 }, { x: 900, y: 700 },
      { x: 800, y: 1050 }, { x: 950, y: 1050 },
    ],
    enemies: [
      {
        type: 'grunt', x: 800, y: 250,
        patrol: [{ x: 800, y: 250 }, { x: 500, y: 250 }, { x: 800, y: 250 }, { x: 1100, y: 250 }],
      },
      {
        type: 'grunt', x: 800, y: 1150,
        patrol: [{ x: 800, y: 1150 }, { x: 1100, y: 1150 }, { x: 800, y: 1150 }, { x: 500, y: 1150 }],
      },
      { type: 'shooter', x: 1050, y: 700, role: 'suppress' },
    ],
    pickups: [
      { x: 600, y: 500, weapon: 'rifle' },
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
  // S-shaped zig-zag maze to showcase pathfinding around blocking walls.
  {
    id: 'corridor',
    name: 'SERVICE CORRIDOR',
    bounds: { w: 1000, h: 1600 },
    spawn: { x: 500, y: 120 },
    exit: { x: 500, y: 1480, side: 'bottom' },
    walls: [
      // Left-extending partition wall
      { x: 250, y: 500 }, { x: 400, y: 500 },
      // Right-extending partition wall
      { x: 750, y: 1000 }, { x: 600, y: 1000 },
    ],
    cover: [
      { x: 700, y: 350 }, { x: 300, y: 750 }, { x: 700, y: 1250 },
    ],
    enemies: [
      {
        type: 'grunt', x: 700, y: 450, alerted: true,
        patrol: [{ x: 700, y: 450 }, { x: 850, y: 450 }],
      },
      {
        type: 'grunt', x: 300, y: 950, alerted: true,
        patrol: [{ x: 300, y: 950 }, { x: 150, y: 950 }],
      },
      { type: 'shooter', x: 500, y: 1250, alerted: true },
    ],
    pickups: [
      { x: 500, y: 1380, weapon: 'flamethrower' },
    ],
    terminals: [],
    reinforce: {
      afterMs: 18000,
      count: 1,
      type: 'shooter',
      door: { x: 500, y: 80 },
    },
  },

  // ── 3. Detention Block ─────────────────────────────────────────────────
  // Cell blocks layout with dual terminals requiring hacking.
  {
    id: 'detention',
    name: 'DETENTION BLOCK',
    bounds: { w: 1600, h: 1400 },
    spawn: { x: 150, y: 700 },
    exit: { x: 1450, y: 700, side: 'right' },
    walls: [
      // Upper prison block cell walls
      { x: 400, y: 300 }, { x: 800, y: 300 }, { x: 1200, y: 300 },
      // Lower prison block cell walls
      { x: 400, y: 1100 }, { x: 800, y: 1100 }, { x: 1200, y: 1100 },
    ],
    cover: [
      { x: 600, y: 500 }, { x: 1000, y: 500 },
      { x: 600, y: 900 }, { x: 1000, y: 900 },
    ],
    enemies: [
      {
        type: 'grunt', x: 800, y: 700,
        patrol: [{ x: 500, y: 700 }, { x: 1100, y: 700 }],
      },
      {
        type: 'grunt', x: 800, y: 650,
        patrol: [{ x: 1100, y: 650 }, { x: 500, y: 650 }],
      },
      { type: 'shooter', x: 550, y: 400 },
      { type: 'shooter', x: 1050, y: 1000, role: 'flanker' },
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
