export class NavGrid {
  constructor(scene, gridSize = 80) {
    this.scene = scene;
    this.gridSize = gridSize;
    this.grid = []; // 2D array: true = walkable, false = solid
    this.cols = 0;
    this.rows = 0;
  }

  build(w, h, obstacles) {
    this.cols = Math.ceil(w / this.gridSize);
    this.rows = Math.ceil(h / this.gridSize);
    this.grid = Array(this.cols).fill(null).map(() => Array(this.rows).fill(true));

    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const cellX = c * this.gridSize + this.gridSize / 2;
        const cellY = r * this.gridSize + this.gridSize / 2;

        for (const obs of obstacles) {
          if (!obs.active) continue;
          const dist = Math.hypot(cellX - obs.x, cellY - obs.y);
          // If cell overlaps wall/cover center (wall is ~104x104, cover is ~112x112, so 75px is safe buffer)
          if (dist < 75) {
            this.grid[c][r] = false;
            break;
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
