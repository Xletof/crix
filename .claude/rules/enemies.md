---
paths:
  - "src/entities/Enemy.js"
  - "src/systems/bulwark*.js"
  - "src/systems/marksman*.js"
  - "src/systems/firingSpot.js"
  - "src/systems/NavGrid.js"
  - "src/systems/demolisherPayload.js"
  - "src/systems/shieldContact.js"
  - "src/systems/roster*.js"
  - "src/systems/gunnerMuzzle.js"
  - "src/data/rosterArt.js"
  - "tests/*bulwark*.mjs"
  - "tests/*marksman*.mjs"
  - "tests/*stuck*.mjs"
  - "tests/*roster*.mjs"
  - "tests/*demolisher*.mjs"
  - "tests/*tactical*.mjs"
  - "tests/enemy-frozen.mjs"
---
# Ordinary enemies and tactical AI

Reference: `docs/engineering/enemies.md` (status table, seam order, traps).
Approvals are in `HANDOVER.md` §0.

- `Enemy.js` is frozen (`tests/enemy-frozen.mjs`). New behaviour is a seam
  module installed from `GameScene.spawnEnemyAt`; nemesis (`legacyArt`) never
  gets one, VANGUARD screens never get the T2 seam.
- Frozen and opt-in: roster art/gait/move (`roster=v1`, `gait=v2`, `move=v22`),
  Bulwark stuck-B (`bulwarkStuck=early`), Marksman T1 (`marksmanAngle=1`),
  Bulwark T2 (`bulwarkAngle=1`). Not approved: `marksmanStuck=*`. Do not change
  T1/T2 parameters or make any flag default without a human instruction.
- `firingSpot.js` is shared with T1: prove T1 byte-equivalent after any change.
- Prove flag-off identity against the previous build with the seeded replays.
- Anything that adds or removes a `Math.random` draw (particles, overlays)
  changes the fight — keep emission parity.
- Read movement intent from the AI's own calls and real displacement, never one
  frame's `body.velocity`.
