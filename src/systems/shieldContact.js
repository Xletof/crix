// Bulwark contact projection — PRESENTATION ONLY.
//
// The game decides a block (and a Super's pierce) when a bolt overlaps the
// shielded trooper's BODY circle. The approved hard-light curtain is drawn
// further out, at `curtainRadius()`. So a visual that sat at the overlap point
// would land inside the curtain. This projects the contact back along the
// bolt's own flight line onto the curtain: where the round crossed the surface
// the player can see.
//
// It is called AFTER the gameplay result is already decided, it reads only
// numbers it is handed, and it returns a point — it cannot change whether a
// block happens, when, or what it costs. No predictive bolt hiding lives here
// (deliberately deferred until handset evidence asks for it).

/** Curtain radius for a shielded actor: the field's visual stand-off from its centre. */
export function curtainRadius(enemy) {
  return (enemy.cfg?.radius ?? 24) + 22;
}

const wrap = (a) => {
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
};

/**
 * @param {number} cx,cy      shield-bearer centre
 * @param {number} bx,by      bolt position at the moment the result was decided
 * @param {number} flightAng  bolt heading (radians)
 * @param {number} facing     the shield's CURRENT facing (the gameplay `_shieldFacing`)
 * @param {number} halfArc    protected half-arc (the gameplay `_shieldHalfArc`)
 * @param {number} R          curtain radius
 * @returns {{x:number, y:number, off:number}} contact on the curtain, and its
 *          angular offset from `facing`, clamped to ±halfArc
 */
export function projectCurtainContact(cx, cy, bx, by, flightAng, facing, halfArc, R) {
  // Walk BACKWARD along the flight line from the bolt until it crosses radius R.
  const dx = -Math.cos(flightAng), dy = -Math.sin(flightAng);
  const px = bx - cx, py = by - cy;
  // |p + t d| = R  ->  t^2 + 2 (p.d) t + (|p|^2 - R^2) = 0
  const b = px * dx + py * dy;
  const c = px * px + py * py - R * R;
  const disc = b * b - c;
  let x, y;
  if (disc >= 0) {
    const t = -b + Math.sqrt(disc);           // the crossing behind the bolt
    x = px + dx * Math.max(0, t); y = py + dy * Math.max(0, t);
  } else {
    // Line never reaches R (a grazing bolt): use the radial point instead.
    const a = Math.atan2(py, px); x = Math.cos(a) * R; y = Math.sin(a) * R;
  }
  let off = wrap(Math.atan2(y, x) - facing);
  if (off > halfArc) off = halfArc; else if (off < -halfArc) off = -halfArc;
  // Re-seat on the curtain at the clamped bearing so the point is always ON it.
  const a = facing + off;
  return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, off };
}
