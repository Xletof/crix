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
    // Bumped h:1100 → 1500 so the room is taller than the viewport (1280)
    // and the camera can actually keep the player centered.
    bounds: { w: 1700, h: 1500 },
    spawn: { x: 200, y: 750 },
    exit: { x: 1640, y: 750, side: 'right' },
    walls: [
      { x: 450, y: 320 }, { x: 450, y: 1180 },
      { x: 1250, y: 320 }, { x: 1250, y: 1180 },
    ],
    cover: [
      { x: 750, y: 480 }, { x: 850, y: 750 }, { x: 950, y: 480 },
      { x: 1120, y: 600 }, { x: 1120, y: 900 },
    ],
    enemies: [
      {
        type: 'grunt', x: 750, y: 370,
        patrol: [{ x: 750, y: 370 }, { x: 1150, y: 370 }, { x: 1150, y: 650 }, { x: 750, y: 370 }],
      },
      {
        type: 'grunt', x: 750, y: 1080,
        patrol: [{ x: 750, y: 1080 }, { x: 1150, y: 1080 }, { x: 1150, y: 850 }, { x: 750, y: 1080 }],
      },
      { type: 'shooter', x: 1400, y: 750, role: 'flanker' },
    ],
    pickups: [
      { x: 600, y: 750, weapon: 'rifle' },
    ],
    // Single intro terminal in the open far side — teaches the hack objective.
    terminals: [
      { x: 1000, y: 1050 },
    ],
    reinforce: {
      afterMs: 22000,
      count: 2,
      type: 'grunt',
      door: { x: 1500, y: 100 },
    },
  },

  // ── 2. Service Corridor ────────────────────────────────────────────────
  // Tall narrow chamber — forces close-quarters. Enemies start alerted
  // (they heard the hangar fight). Cover staggered left/right so enemies
  // can navigate around them (centered cover caused permanent stuck-loops).
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
      { x: 280, y: 420 }, { x: 660, y: 800 }, { x: 280, y: 1220 },
    ],
    enemies: [
      // These enemies heard the hangar fight — they boot in ALERT state
      {
        type: 'grunt', x: 450, y: 650, alerted: true,
        patrol: [{ x: 250, y: 650 }, { x: 650, y: 650 }],
      },
      { type: 'grunt',   x: 300, y: 1100, alerted: true },
      { type: 'shooter', x: 620, y: 1280, alerted: true },
    ],
    // Flamethrower reward for clearing the tight corridor
    pickups: [
      { x: 450, y: 1360, weapon: 'flamethrower' },
    ],
    // Two terminals on opposite flanks force movement through the crossfire.
    terminals: [
      { x: 650, y: 650 },
      { x: 300, y: 950 },
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
    // Bumped h:1200 → 1400 so the camera can keep the player centered.
    bounds: { w: 1500, h: 1400 },
    spawn: { x: 150, y: 700 },
    exit: { x: 1440, y: 700, side: 'right' },
    walls: [
      { x: 340, y: 240 }, { x: 540, y: 240 }, { x: 740, y: 240 },
      { x: 940, y: 240 }, { x: 1140, y: 240 },
      { x: 340, y: 1160 }, { x: 540, y: 1160 }, { x: 740, y: 1160 },
      { x: 940, y: 1160 }, { x: 1140, y: 1160 },
    ],
    cover: [
      { x: 440, y: 500 }, { x: 740, y: 700 }, { x: 1040, y: 500 },
      { x: 440, y: 900 }, { x: 1040, y: 900 },
    ],
    enemies: [
      {
        type: 'grunt', x: 740, y: 440,
        patrol: [{ x: 440, y: 440 }, { x: 1040, y: 440 }],
      },
      {
        type: 'grunt', x: 740, y: 960,
        patrol: [{ x: 440, y: 960 }, { x: 1040, y: 960 }],
      },
      { type: 'shooter', x: 1280, y: 480 },
      { type: 'shooter', x: 1280, y: 920, role: 'flanker' },
    ],
    pickups: [
      { x: 740, y: 700, weapon: 'detonator' },
    ],
    // Two terminals deep in the cell block — held by two shooters + patrols.
    terminals: [
      { x: 600, y: 950 },
      { x: 900, y: 450 },
    ],
    reinforce: {
      afterMs: 20000,
      count: 3,
      type: 'grunt',
      door: { x: 750, y: 100 },
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
