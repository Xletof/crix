// Room layout authoring.
//
// Walls are fixed 104x104 tiles (`paintBlastDoor`, 26x26 at scale 4) and the
// nav grid is 80px cells, so a layout is really a grid of on/off cells. Writing
// that as a list of `{ x: 440, y: 280 }` literals is unreviewable — you cannot
// see the room in the diff, and you cannot see the one rule that matters.
//
// ── The rule ──────────────────────────────────────────────────────────────
//
// `NavGrid.build` (src/systems/NavGrid.js:20-28) marks a cell solid when the
// cell CENTRE is within 75px of an obstacle's x/y. It is a radial test against
// the obstacle's ORIGIN and it ignores the body entirely, so a 70x70 cover
// console blocks exactly as much of the nav grid as a 104x104 wall.
//
// Cell centres sit at `80c + 40`. An obstacle ON a centre blocks exactly one
// cell — its neighbours are 80px away, and 80 > 75. An obstacle on a cell
// CORNER is 56.6px from four centres and blocks all four. So an off-lattice
// obstacle silently blocks up to 4x the floor area its sprite covers, and the
// enemies path around a hole much bigger than anything the player can see.
//
// Every obstacle in the game was off-lattice before this existed (28 of 28),
// which is the likely root of the recurring "cover was still blocking the
// shooter path / ADVANCE oscillation" fixes in the git history.
//
// A map row is one character per cell, so positions are lattice-correct by
// construction and cannot drift.

export const CELL = 80;

// Grid cell (col,row) -> world centre.
export const cellToWorld = (c, r) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });

/**
 * Expand an ASCII map into wall positions.
 *
 * @param {string[]} rows  one string per grid row, one char per cell.
 *                         '#' places a wall; any other char is open floor
 *                         ('.' by convention, letters are free for annotating
 *                         what a space is FOR without affecting the output).
 * @param {{w:number,h:number}} bounds  the room's bounds, for validation.
 * @returns {{x:number,y:number}[]}
 */
export function wallsFromMap(rows, bounds) {
  // Validate loudly. A map one column short would shift every wall in the room
  // by 80px with no error and no obvious symptom — the layout would simply be
  // subtly wrong, which is the hardest kind of bug to see in a screenshot.
  const expectCols = Math.ceil(bounds.w / CELL);
  const expectRows = Math.ceil(bounds.h / CELL);
  if (rows.length !== expectRows) {
    throw new Error(`[rooms] map has ${rows.length} rows, bounds ${bounds.h}px needs ${expectRows}`);
  }
  rows.forEach((row, r) => {
    if (row.length !== expectCols) {
      throw new Error(`[rooms] map row ${r} has ${row.length} cols, bounds ${bounds.w}px needs ${expectCols}`);
    }
  });

  const out = [];
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '#') out.push(cellToWorld(c, r));
    }
  });
  return out;
}

/**
 * Snap a hand-placed point to the nearest cell centre.
 *
 * For cover, terminals and scripted spawns, which are authored as real
 * coordinates because their exact position matters for feel — but which still
 * have to sit on the lattice so they block one cell rather than four.
 */
export const snap = (p) => ({
  ...p,
  x: Math.round((p.x - CELL / 2) / CELL) * CELL + CELL / 2,
  y: Math.round((p.y - CELL / 2) / CELL) * CELL + CELL / 2,
});

export const snapAll = (pts) => pts.map(snap);
