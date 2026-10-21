// FIRING-SPOT SEARCH — a pure helper for the Phase 3C-T1 Marksman angle
// candidate (`systems/marksmanAngle.js`). It answers one question: given where
// this body stands and where the player is, which nearby spot ON THE BODY'S
// OWN BAND would give it a shot, and how does it walk there?
//
// Built only from what the game already trusts:
//   `_standable`  the v2.2 standability test (world margin, every LOS rect +26)
//   `_hasLOS`     the fire gate's own line test, so "a line from there" means
//                 exactly what the weapon will see
//   the body ray  `_scoreSpot`'s three-ray path test (centre, and both edges of
//                 the body — at its full radius + 2px here, not v2.2's 0.8x),
//                 so "walkable" means the whole BODY fits, not a ray
//   `navGrid`     read-only, and only when no straight walk exists — and never
//                 its fallback-to-target: one node in another cell is NO ROUTE
//
// Pure: it reads the actor, the player, the room and the other bodies, and
// writes nothing. No `Math.random` — ties break on a fixed order, so two runs
// of the same seed choose the same spot.

// Candidates sit on arcs AROUND THE PLAYER, so the actor keeps its range
// (a marksman changes ANGLE, not distance), stepping along the arc by a fixed
// LENGTH so the spacing is the same at 340px and at 600px.
export function findFiringSpot(e, player, o) {
  const scene = e.scene;
  const px = player.x, py = player.y;
  const d0 = Math.hypot(e.x - px, e.y - py) || 1;
  const phi = Math.atan2(e.y - py, e.x - px);
  const bodyR = Math.max(e.body?.width || 0, e.body?.height || 0) / 2 || e.cfg.radius;
  const off = bodyR + 2;        // the WHOLE body clears (at 0.9x a console corner grazed its edge)
  const radii = [];
  for (const dr of o.radialSteps) {
    const r = Math.max(o.band[0], Math.min(o.band[1], (o.anchorR ?? d0) + dr));
    if (!radii.some((q) => Math.abs(q - r) < 20)) radii.push(r);
  }
  // and the role's own preferred range, so a body can work back toward it
  if (o.prefR != null) {
    const r = Math.max(o.band[0], Math.min(o.band[1], o.prefR));
    if (!radii.some((q) => Math.abs(q - r) < 20)) radii.push(r);
  }
  const straight = [], other = [];
  for (const r of radii) {
    const kMax = Math.floor(o.maxLateralPx / o.stepPx);
    for (let k = 0; k <= kMax; k++) {
      for (const sg of k === 0 ? [0] : [1, -1]) {
        if (k === 0 && Math.abs(r - d0) < 20) continue;          // where it already stands
        const b = phi + sg * k * o.stepPx / r;
        const cx = px + Math.cos(b) * r, cy = py + Math.sin(b) * r;
        if (!e._standable(cx, cy)) continue;
        if (o.avoid.some((a) => Math.hypot(a.x - cx, a.y - cy) < a.r)) continue;
        if (!e._hasLOS(cx, cy, px, py)) continue;
        // a line that survives the player taking one step either way
        const ux = px - cx, uy = py - cy, ul = Math.hypot(ux, uy) || 1;
        const lx = -uy / ul * 40, ly = ux / ul * 40;
        const robust = (e._hasLOS(cx, cy, px + lx, py + ly) ? 1 : 0) + (e._hasLOS(cx, cy, px - lx, py - ly) ? 1 : 0);
        const side = sg;
        const travel = Math.hypot(cx - e.x, cy - e.y);
        // a moving target: will there still be a line when the body gets there?
        // (where the player is going, from the velocity they have NOW, bounded
        // in time — a change of direction beats it)
        let lead = 0;
        if (o.lead) {
          const t = Math.min(o.lead.maxMs, travel / o.lead.speed * 1000) / 1000;
          if (!e._hasLOS(cx, cy, px + o.lead.vx * t, py + o.lead.vy * t)) lead = o.lead.pen;
        }
        const pen = (2 - robust) * o.robustPx + Math.abs(r - (o.prefR ?? d0)) * o.radialCost
          + (o.prefSide && side && side !== o.prefSide ? o.reversePx : 0) + crowd(o.crowd, cx, cy) + lead;
        const c = { x: cx, y: cy, r, side, robust, travel, pen };
        if (bodyPath(e, e.x, e.y, cx, cy, off) && clearOf(px, py, e.x, e.y, cx, cy, o.floorPx)) {
          c.cost = travel + pen; c.path = [{ x: cx, y: cy }];
          straight.push(c);
        } else other.push(c);
      }
    }
  }
  let best = null;
  for (const c of straight) if (!best || c.cost < best.cost) best = c;
  if (best || !o.navFallback || !scene.navGrid) return best;
  // NO STRAIGHT WALK: the nearest few by straight distance, routed on the grid
  other.sort((a, b) => a.travel - b.travel);
  for (const c of other.slice(0, o.navTop)) {
    const path = route(e, c, off);
    if (!path) continue;
    let L = 0, x = e.x, y = e.y;
    for (const n of path) { L += Math.hypot(n.x - x, n.y - y); x = n.x; y = n.y; }
    // every leg of the route must stay clear of the player's retreat ring
    let ok = true; x = e.x; y = e.y;
    for (const n of path) { if (!clearOf(px, py, x, y, n.x, n.y, o.floorPx)) { ok = false; break; } x = n.x; y = n.y; }
    if (!ok) continue;
    c.cost = L + c.pen; c.path = path; c.travel = L; c.routed = true;
    if (!best || c.cost < best.cost) best = c;
  }
  return best;
}

// `_scoreSpot`'s body test: the centre ray and the two edge rays, offset by
// the caller's clearance
export function bodyPath(e, x1, y1, x2, y2, off) {
  const tl = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ox = -(y2 - y1) / tl * off, oy = (x2 - x1) / tl * off;
  return e._hasLOS(x1, y1, x2, y2) && e._hasLOS(x1 + ox, y1 + oy, x2 + ox, y2 + oy) && e._hasLOS(x1 - ox, y1 - oy, x2 - ox, y2 - oy);
}

// the segment keeps at least `floor` from the player (so walking a chord of the
// arc never carries the body inside its own retreat ring)
function clearOf(px, py, x1, y1, x2, y2, floor) {
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L2));
  return Math.hypot(x1 + dx * t - px, y1 + dy * t - py) >= floor;
}

function crowd(list, x, y) {
  let p = 0;
  for (const c of list) { const d = Math.hypot(c.x - x, c.y - y); if (d < c.r) p += c.pen * (1 - d / c.r); }
  return p;
}

// NavGrid route to `c`, then string-pulled with the body ray so a 4-connected
// cell path becomes a few straight legs. Null when the grid has no route (its
// single-node fallback in another cell is treated as exactly that).
function route(e, c, off) {
  const g = e.scene.navGrid;
  const cell = (x, y) => g.getNearestWalkable(Math.max(0, Math.min(g.cols - 1, Math.floor(x / g.gridSize))), Math.max(0, Math.min(g.rows - 1, Math.floor(y / g.gridSize))));
  const a = cell(e.x, e.y), b = cell(c.x, c.y);
  const raw = g.findPath(e.x, e.y, c.x, c.y);
  if (raw.length <= 1 && (a.x !== b.x || a.y !== b.y)) return null;
  const pts = raw.slice(0, -1).concat([{ x: c.x, y: c.y }]);
  const out = [];
  let fx = e.x, fy = e.y, i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !bodyPath(e, fx, fy, pts[j].x, pts[j].y, off)) j--;
    out.push({ x: pts[j].x, y: pts[j].y });          // the grid's own next cell when nothing further is clear
    fx = pts[j].x; fy = pts[j].y; i = j + 1;
  }
  return out;
}
