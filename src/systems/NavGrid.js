export class NavGrid {
  constructor(scene, gridSize = 80) {
    this.scene = scene;
    this.gridSize = gridSize;
    this.grid = []; // 2D array: true = walkable, false = solid
    this.cols = 0;
    this.rows = 0;
  }

  // Mark cells solid from each obstacle's BODY RECTANGLE.
  //
  // This used to be a radial test — `hypot(cellCentre, obs.x/obs.y) < 75` —
  // against the obstacle's ORIGIN, ignoring its body entirely. That works only
  // while every obstacle is roughly a 104px tile centred on its origin, which
  // was true until room props arrived. A 400x300 shuttle under the old test
  // blocked a ~150px circle at its middle and left its nose and wings marked
  // WALKABLE while still solid in physics, so enemies pathed into the hull and
  // wedged. `findPath` returns a one-node path at the target when it fails
  // (see below), so that reads as broken AI rather than as broken data.
  //
  // INFLATE is picked for parity with the old numbers rather than invented: a
  // 104px wall has a 52px half-extent, and the old radius was 75 = 52 + 23.
  // So 23px is the agent clearance that behaviour already assumed. Cover comes
  // out strictly better — its body is 70x70, so it now blocks 35 + 23 rather
  // than a flat 75, which is less over-blocking than before.
  build(w, h, obstacles) {
    this.cols = Math.ceil(w / this.gridSize);
    this.rows = Math.ceil(h / this.gridSize);
    this.grid = Array(this.cols).fill(null).map(() => Array(this.rows).fill(true));

    const INFLATE = 23;
    const half = this.gridSize / 2;

    for (const obs of obstacles) {
      if (!obs.active) continue;
      const b = obs.body;
      // Body rect if there is one (its x/y are top-left), else the sprite.
      const cx = b ? b.x + b.width / 2  : obs.x;
      const cy = b ? b.y + b.height / 2 : obs.y;
      const hw = (b ? b.width  : obs.displayWidth)  / 2 + INFLATE;
      const hh = (b ? b.height : obs.displayHeight) / 2 + INFLATE;

      // Walk only the cells the rect can touch instead of the whole grid.
      const c0 = Math.max(0, Math.floor((cx - hw - half) / this.gridSize));
      const c1 = Math.min(this.cols - 1, Math.ceil((cx + hw - half) / this.gridSize));
      const r0 = Math.max(0, Math.floor((cy - hh - half) / this.gridSize));
      const r1 = Math.min(this.rows - 1, Math.ceil((cy + hh - half) / this.gridSize));

      for (let c = c0; c <= c1; c++) {
        for (let r = r0; r <= r1; r++) {
          const cellX = c * this.gridSize + half;
          const cellY = r * this.gridSize + half;
          if (Math.abs(cellX - cx) <= hw && Math.abs(cellY - cy) <= hh) {
            this.grid[c][r] = false;
          }
        }
      }
    }
  }

  getNearestWalkable(gx, gy) {
    if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
      if (this.grid[gx][gy]) return { x: gx, y: gy };
    }

    const queue = [[gx, gy]];
    const visited = new Set([`${gx},${gy}`]);

    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      if (cx >= 0 && cx < this.cols && cy >= 0 && cy < this.rows) {
        if (this.grid[cx][cy]) {
          return { x: cx, y: cy };
        }
      }

      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        const key = `${nx},${ny}`;
        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
          if (!visited.has(key)) {
            visited.add(key);
            queue.push([nx, ny]);
          }
        }
      }
    }
    return { x: Math.max(0, Math.min(this.cols - 1, gx)), y: Math.max(0, Math.min(this.rows - 1, gy)) };
  }

  findPath(sx, sy, tx, ty) {
    const startX = Math.max(0, Math.min(this.cols - 1, Math.floor(sx / this.gridSize)));
    const startY = Math.max(0, Math.min(this.rows - 1, Math.floor(sy / this.gridSize)));
    const targetX = Math.max(0, Math.min(this.cols - 1, Math.floor(tx / this.gridSize)));
    const targetY = Math.max(0, Math.min(this.rows - 1, Math.floor(ty / this.gridSize)));

    const start = this.getNearestWalkable(startX, startY);
    const target = this.getNearestWalkable(targetX, targetY);

    if (start.x === target.x && start.y === target.y) {
      return [{ x: tx, y: ty }];
    }

    const queue = [[start.x, start.y]];
    const visited = new Set([`${start.x},${start.y}`]);
    const parent = {};

    let found = false;
    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      if (cx === target.x && cy === target.y) {
        found = true;
        break;
      }

      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        const key = `${nx},${ny}`;
        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
          if (this.grid[nx][ny] && !visited.has(key)) {
            visited.add(key);
            parent[key] = [cx, cy];
            queue.push([nx, ny]);
          }
        }
      }
    }

    if (!found) {
      return [{ x: tx, y: ty }]; // fallback
    }

    const path = [];
    let currKey = `${target.x},${target.y}`;
    const startKey = `${start.x},${start.y}`;
    while (currKey !== startKey) {
      const [px, py] = parent[currKey];
      path.push({
        x: px * this.gridSize + this.gridSize / 2,
        y: py * this.gridSize + this.gridSize / 2
      });
      currKey = `${px},${py}`;
    }
    path.reverse();
    path.push({ x: tx, y: ty });
    return path;
  }
}
