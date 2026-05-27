// Hand-authored room specs for the Death Star infiltration. Each room is a
// self-contained chamber: world + camera bounds clamp to room.bounds, the
// player spawns at room.spawn, and the exit door stays sealed until every
// enemy is dead. Crossing an open door triggers the next-room transition.
//
// All positions are in world coords inside the room (origin at top-left).
// `walls` and `cover` accept a list of {x, y} placements — sprites are the
// 'wall' (blast door tile) and 'bush' (Imperial console) textures.

export const ROOMS = [
  // ── 1. Hangar Bay ──────────────────────────────────────────────────────
  // Wide opening chamber. Two patrolling stormtroopers + a death trooper
  // guarding the exit. Crate cover in the middle to encourage flanking.
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
      { type: 'grunt',   x: 900,  y: 270 },
      { type: 'grunt',   x: 900,  y: 830 },
      { type: 'shooter', x: 1320, y: 550 },
    ],
  },

  // ── 2. Service Corridor ────────────────────────────────────────────────
  // Tall narrow chamber, vertical layout — forces close-quarters combat.
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
      { type: 'grunt',   x: 450, y: 600 },
      { type: 'grunt',   x: 320, y: 1100 },
      { type: 'shooter', x: 450, y: 1280 },
    ],
  },

  // ── 3. Detention Block ─────────────────────────────────────────────────
  // Two rows of cell walls running across the chamber. Heavier garrison.
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
      { type: 'grunt',   x: 700,  y: 400 },
      { type: 'grunt',   x: 700,  y: 800 },
      { type: 'shooter', x: 1200, y: 400 },
      { type: 'shooter', x: 1200, y: 800 },
    ],
  },

  // ── 4. Vader's Chamber (boss) ──────────────────────────────────────────
  // No exit. Beat Vader to win the run.
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
