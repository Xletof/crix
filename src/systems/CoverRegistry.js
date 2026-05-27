// Per-room cover registry. GameScene creates one from the room's cover list
// and injects a reference into each enemy via enemy.coverRegistry.
//
// Key design: claim() returns a spot whose standX/Y is the actual position
// the enemy should WALK TO — 85px from the cover centre on the player-far
// side, so the cover body ends up between the enemy and the player.
//
// Option-3 fanning: the first claimer of a spot stands strictly opposite
// the player; each subsequent claimer rotates 90° so a pair of shooters
// naturally split to opposite sides of the same object.

const STAND_DIST = 85; // px from cover centre — clears the 70×70 solid hitbox

export class CoverRegistry {
  constructor(coverList) {
    this.spots = coverList.map((c) => ({
      x: c.x, y: c.y,
      owner: null,
      claimCount: 0,
      standX: c.x, standY: c.y,
    }));
  }

  // Nearest free spot. Computes standX/Y relative to the player position.
  claim(enemy, playerX = null, playerY = null) {
    if (!this.spots.length) return null;
    const free = this.spots.filter((s) => s.owner === null);
    const pool = free.length ? free : this.spots;
    let best = null, bestDist = Infinity;
    for (const s of pool) {
      const d = Math.hypot(s.x - enemy.x, s.y - enemy.y);
      if (d < bestDist) { bestDist = d; best = s; }
    }
    if (best) {
      best.owner = enemy;
      this._setStand(best, playerX, playerY, best.claimCount);
      best.claimCount++;
    }
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
    if (best) {
      best.owner = enemy;
      this._setStand(best, threatX, threatY, 0); // always strict for repositioning
      best.claimCount++;
    }
    return best;
  }

  // Refresh stand position for an existing claim (player has moved).
  recomputeStand(spot, playerX, playerY) {
    if (!spot) return;
    this._setStand(spot, playerX, playerY, 0);
  }

  release(enemy) {
    for (const s of this.spots) {
      if (s.owner === enemy) s.owner = null;
    }
  }

  reset() {
    for (const s of this.spots) { s.owner = null; s.claimCount = 0; }
  }

  // Compute and store standX/Y.
  // claimIndex 0 → directly opposite player (cover between enemy and player).
  // claimIndex 1 → +90° (perpendicular left).
  // claimIndex 2 → −90° (perpendicular right).
  // Higher indices keep alternating sides so a squad fans out naturally.
  _setStand(spot, playerX, playerY, claimIndex) {
    if (playerX === null || playerY === null) {
      spot.standX = spot.x;
      spot.standY = spot.y;
      return;
    }
    const dx = spot.x - playerX, dy = spot.y - playerY;
    let angle = Math.atan2(dy, dx); // direction from player toward cover
    if (claimIndex > 0) {
      const side = claimIndex % 2 === 1 ? 1 : -1;
      angle += (Math.PI / 2) * side;
    }
    spot.standX = spot.x + Math.cos(angle) * STAND_DIST;
    spot.standY = spot.y + Math.sin(angle) * STAND_DIST;
  }
}
