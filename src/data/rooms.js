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
    bounds: { w: 1600, h: 1100 },
    spawn: { x: 160, y: 550 },
    exit: { x: 1540, y: 550, side: 'right' },
    walls: [
      { x: 400, y: 220 }, { x: 400, y: 880 },
      { x: 1200, y: 220 }, { x: 1200, y: 880 },
    ],
    cover: [
      { x: 700, y: 380 }, { x: 800, y: 580 }, { x: 900, y: 380 },
      { x: 1080, y: 460 }, { x: 1080, y: 720 },
    ],
    enemies: [
      {
        type: 'grunt', x: 700, y: 270,
        patrol: [{ x: 700, y: 270 }, { x: 1100, y: 270 }, { x: 1100, y: 500 }, { x: 700, y: 270 }],
      },
      {
        type: 'grunt', x: 700, y: 830,
        patrol: [{ x: 700, y: 830 }, { x: 1100, y: 830 }, { x: 1100, y: 600 }, { x: 700, y: 830 }],
      },
      { type: 'shooter', x: 1320, y: 550, role: 'flanker' },
    ],
    // Rifle drops in the middle of the hangar — first room reward
    pickups: [
      { x: 500, y: 550, weapon: 'rifle' },
    ],
    // Reinforcements through the upper-right side door after 22s of combat
    reinforce: {
      afterMs: 22000,
      count: 2,
      type: 'grunt',
      door: { x: 1400, y: 80 },
    },
  },

  // ── 2. Service Corridor ────────────────────────────────────────────────
  // Tall narrow chamber — forces close-quarters. Enemies start alerted
  // (they heard the hangar fight). One grunt on a cross-patrol.
  {
    id: 'corridor',
    name: 'SERVICE CORRIDOR',
    bounds: { w: 900, h: 1500 },
    spawn: { x: 450, y: 120 },
    exit: { x: 450, y: 1440, side: 'bottom' },
    walls: [
      { x: 220, y: 500 }, { x: 680, y: 500 },
      { x: 220, y: 1000 }, { x: 680, y: 1000 },
    ],
    cover: [
      { x: 450, y: 380 }, { x: 450, y: 800 }, { x: 450, y: 1200 },
    ],
    enemies: [
      {
        type: 'grunt', x: 450, y: 650,
        patrol: [{ x: 250, y: 650 }, { x: 650, y: 650 }],
      },
      { type: 'grunt',   x: 320, y: 1100 },
      { type: 'shooter', x: 450, y: 1280 },
    ],
    // Flamethrower reward for clearing the tight corridor
    pickups: [
      { x: 450, y: 1360, weapon: 'flamethrower' },
    ],
    // Single shooter reinforcement from the top — tight corridor punishes camping
    reinforce: {
      afterMs: 18000,
      count: 1,
      type: 'shooter',
      door: { x: 450, y: 80 },
    },
  },

  // ── 3. Detention Block ─────────────────────────────────────────────────
  // Two rows of cell walls — heavier garrison. Two shooters suppress from
  // opposite flanks; two grunts patrol the cell rows.
  {
    id: 'detention',
    name: 'DETENTION BLOCK',
    bounds: { w: 1400, h: 1200 },
    spawn: { x: 110, y: 600 },
    exit: { x: 1340, y: 600, side: 'right' },
    walls: [
      { x: 300, y: 180 }, { x: 500, y: 180 }, { x: 700, y: 180 },
      { x: 900, y: 180 }, { x: 1100, y: 180 },
      { x: 300, y: 1020 }, { x: 500, y: 1020 }, { x: 700, y: 1020 },
      { x: 900, y: 1020 }, { x: 1100, y: 1020 },
    ],
    cover: [
      { x: 400, y: 420 }, { x: 700, y: 600 }, { x: 1000, y: 420 },
      { x: 400, y: 800 }, { x: 1000, y: 800 },
    ],
    enemies: [
      {
        type: 'grunt', x: 700, y: 380,
        patrol: [{ x: 400, y: 380 }, { x: 1000, y: 380 }],
      },
      {
        type: 'grunt', x: 700, y: 820,
        patrol: [{ x: 400, y: 820 }, { x: 1000, y: 820 }],
      },
      { type: 'shooter', x: 1200, y: 400 },
      { type: 'shooter', x: 1200, y: 800, role: 'flanker' },
    ],
    // Thermal detonators — great for the tight Vader room ahead
    pickups: [
      { x: 700, y: 600, weapon: 'detonator' },
    ],
    // Three reinforcements from the top — the heaviest of the run
    reinforce: {
      afterMs: 20000,
      count: 3,
      type: 'grunt',
      door: { x: 700, y: 80 },
    },
  },

  // ── 4. Vader's Chamber (boss) ──────────────────────────────────────────
  {
    id: 'vader',
    name: "VADER'S CHAMBER",
    bounds: { w: 1600, h: 1400 },
    spawn: { x: 800, y: 1280 },
    exit: null,
    walls: [
      { x: 300, y: 250 }, { x: 1300, y: 250 },
      { x: 300, y: 1150 }, { x: 1300, y: 1150 },
    ],
    cover: [
      { x: 500, y: 700 }, { x: 1100, y: 700 },
    ],
    enemies: [],
    boss: true,
    bossSpawn: { x: 800, y: 320 },
  },
];
