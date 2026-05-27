// Per-room cover registry. GameScene creates one from the room's cover list
// and injects a reference into each enemy via enemy.coverRegistry.
//
// Enemies call claim(enemy) to reserve the nearest free spot, and
// release(enemy) when they die or reposition.

export class CoverRegistry {
  constructor(coverList) {
    // Each spot: { x, y, owner: null|enemy }
    this.spots = coverList.map((c) => ({ x: c.x, y: c.y, owner: null }));
  }

  // Claim the nearest unclaimed spot (or the least-contested spot if all taken).
  // Returns the spot object, or null if the list is empty.
  claim(enemy) {
    if (!this.spots.length) return null;
    const free = this.spots.filter((s) => s.owner === null);
    const pool = free.length ? free : this.spots; // fallback: share a spot
    let best = null, bestDist = Infinity;
    for (const s of pool) {
      const d = Math.hypot(s.x - enemy.x, s.y - enemy.y);
      if (d < bestDist) { bestDist = d; best = s; }
    }
    if (best) best.owner = enemy;
    return best;
  }

  // Claim the spot FURTHEST from a given position (useful for flanking).
  claimFarthestFrom(enemy, fx, fy) {
    if (!this.spots.length) return null;
    const free = this.spots.filter((s) => s.owner === null);
    const pool = free.length ? free : this.spots;
    let best = null, bestDist = -1;
    for (const s of pool) {
      const d = Math.hypot(s.x - fx, s.y - fy);
      if (d > bestDist) { bestDist = d; best = s; }
    }
    if (best) best.owner = enemy;
    return best;
  }

  release(enemy) {
    for (const s of this.spots) {
      if (s.owner === enemy) { s.owner = null; }
    }
  }

  reset() {
    for (const s of this.spots) s.owner = null;
  }
}
