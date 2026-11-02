---
paths:
  - "src/entities/ShockCaptain.js"
  - "src/entities/Champion.js"
  - "src/entities/Harrower.js"
  - "src/systems/Hazard.js"
  - "src/systems/CaptainTelemetry.js"
  - "src/data/champions.js"
  - "tests/*captain*.mjs"
  - "tests/*captel*.mjs"
  - "tests/*champion*.mjs"
  - "tests/*harrower*.mjs"
  - "tests/*arcgrenade*.mjs"
  - "tests/*arcfield*.mjs"
---
# Champions

The Shock Captain V1 (`6560c62`) is HUMAN-APPROVED and FROZEN — do not polish or
tune him. Interdictor and Harrower are human-rejected as combatants; do not tune
them, and normal Endless must never spawn them. Reference:
`docs/engineering/champion.md` (doctrine first, then the Captain's traps).

- A new Champion needs human approval of a 1x concept sheet before any entity
  file, move, test or deploy.
- A Champion never reads the player's attack input (`superAiming`, `superAim`,
  `superCharge`, `player-fire-super`, pellets in flight).
- Production placement only through `CHAMPION_PLACEMENTS` (`encounters.js`).
- Effects run on the actor's own `_clock`; test them by advancing it, not by
  sleeping. Hazards are retired by next cast, death and room clear.
