// Tracks bush sprites and marks actors hidden when overlapping any bush.
// "Hidden" = enemies ignore you (canSee()), and you render semi-transparent.

export class BushSystem {
  constructor(scene) {
    this.scene = scene;
    this.bushes = [];
  }

  add(bush, radius) {
    this.bushes.push({ x: bush.x, y: bush.y, r: radius });
  }

  clear() {
    this.bushes = [];
  }

  isInsideBush(x, y, actorRadius = 0) {
    for (const b of this.bushes) {
      const dx = x - b.x;
      const dy = y - b.y;
      // Actor needs to be solidly inside (require more than half overlap)
      if (Math.hypot(dx, dy) < b.r - actorRadius * 0.3) return true;
    }
    return false;
  }

  update(actors) {
    for (const a of actors) {
      if (!a.active) continue;
      a.hiddenInBush = this.isInsideBush(a.x, a.y, a.cfg?.radius || 22);
    }
  }
}
