---
paths:
  - "src/data/encounters.js"
  - "tests/*encounter*.mjs"
  - "tests/*encdbg*.mjs"
  - "tests/*vanguard*.mjs"
---
# Encounters and placement (frozen)

Encounter composition (Phase A) and Champion placement + VANGUARD rules (Phase
B, `a3563a4`) are HUMAN-APPROVED and FROZEN. Reference:
`docs/engineering/encounters.md`.

- `encounters.js` stays a data table — no callbacks, conditions or parsers.
- The boss room and duel wave are excluded by absence; never add an
  `if (roomSpec.boss)` branch.
- Mid-wave spawns draw from the fill roll, never from `_spawnQueue`.
- `?encdbg` sub-flags must stay inert without `encdbg`; the force substitutes and
  never manufactures.
