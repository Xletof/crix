---
paths:
  - "src/systems/EnvLight.js"
  - "src/systems/pixelArt.js"
  - "src/data/rooms.js"
  - "src/data/consoleKit.js"
  - "src/data/mapUtils.js"
  - "tests/*arena*.mjs"
  - "tests/*hangar*.mjs"
  - "tests/*junction*.mjs"
  - "tests/*detention*.mjs"
  - "tests/*console*.mjs"
  - "tests/*hero*.mjs"
  - "tests/*shuttle*.mjs"
---
# Arenas, light and pixel art

All four arenas are HUMAN-APPROVED and FROZEN (topology, cover, art, lighting,
dark state). Reference: `docs/engineering/environment.md`.

- Environment light lives outside `roomLayer` at `ENV_LIGHT_DEPTH`; only a prop
  `face` may sit above its prop. Every source has `normal` and `emergency`.
- No red in environment art (danger colour); no small green points in dark rooms
  (enemy bullets).
- Baked floor art never draws tall solid mass; cover footprints (70x70) are
  frozen.
- Pixel art: crisp horizontals, verticals, 45-degree cuts, constant cadences.
  Fix soft or crawling edges with shape language, never filtering.
- `paintBackdrop` consumes `Math.random` — reseed before each paint when hashing.
