// Per-room cover registry. Stand-position computation lives in Enemy.js
// (it needs LOS testing against walls). This file just tracks
// "which enemy owns which cover spot".

export class CoverRegistry {
  constructor(coverList) {
    this.spots = coverList.map((c) => ({ x: c.x, y: c.y, owner: null }));
  }

  // Nearest free spot to the enemy.
  claim(enemy) {
    if (!this.spots.length) return null;
    const free = this.spots.filter((s) => s.owner === null);
    const pool = free.length ? free : this.spots;
    let best = null, bestDist = Infinity;
    for (const s of pool) {
      const d = Math.hypot(s.x - enemy.x, s.y - enemy.y);
      if (d < bestDist) { bestDist = d; best = s; }
    }
    if (best) best.owner = enemy;
    return best;
  }

  // Spot farthest from a threat (used when repositioning away from player).
  claimFarthestFrom(enemy, threatX, threatY) {
    if (!this.spots.length) return null;
    const free = this.spots.filter((s) => s.owner === null);
    const pool = free.length ? free : this.spots;
    let best = null, bestDist = -1;
    for (const s of pool) {
      const d = Math.hypot(s.x - threatX, s.y - threatY);
      if (d > bestDist) { bestDist = d; best = s; }
    }
    if (best) best.owner = enemy;
    return best;
  }

  // Try every spot, in order of nearest-to-enemy, and call `validator(spot)` on
  // each. Claims the first spot the validator returns truthy for. Used by
  // shooters to claim a cover that actually has LOS to the player.
  claimFirstValid(enemy, validator) {
    if (!this.spots.length) return null;
    const free = this.spots.filter((s) => s.owner === null || s.owner === enemy);
    const ranked = free
      .map((s) => ({ s, d: Math.hypot(s.x - enemy.x, s.y - enemy.y) }))
      .sort((a, b) => a.d - b.d);
    for (const { s } of ranked) {
      if (validator(s)) { s.owner = enemy; return s; }
    }
    return null;
  }

  release(enemy) {
    for (const s of this.spots) {
      if (s.owner === enemy) s.owner = null;
    }
  }

  reset() { for (const s of this.spots) s.owner = null; }
}
