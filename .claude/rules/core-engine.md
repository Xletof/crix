---
paths:
  - "src/entities/Bullet.js"
  - "src/systems/MoveScript.js"
  - "src/systems/Telegraph.js"
  - "src/systems/actorMotion.js"
  - "src/systems/FX.js"
  - "src/systems/juice.js"
---
# Shared combat machinery

Reference: `docs/engineering/core.md`.

- `Bullet.fire` sizes the hitbox from texture width and stretches tracers above
  620px/s — keep projectile canvases fixed, assert `body.radius`.
- A telegraph's drawn shape is its hit test (`Telegraph.contains`); a landing
  marker needs `anchor: 'world'`; pass the real `kinetic` direction and
  `kineticMs`.
- A move that schedules its own links sets an `h.over` flag at impact; never set
  a pose unconditionally in a chain's last `onEnd`.
- `MoveScript.cancel()` leaves `actor._activeMove` set: gate on
  `!h.cancelled && h.phase !== 'done'`.
- Damage numbers go through pooled `fx.damageNumber(x, y, n, color, tier)`.
- Floor marks go through `fx._keepScar`.
