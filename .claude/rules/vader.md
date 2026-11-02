---
paths:
  - "src/entities/Boss.js"
  - "src/data/bossMoves.js"
  - "tests/*vader*.mjs"
  - "tests/*boss*.mjs"
  - "tests/*deflect*.mjs"
  - "tests/*saber*.mjs"
  - "tests/*superorb*.mjs"
  - "tests/*lights*.mjs"
  - "tests/*suppression*.mjs"
---
# Vader (frozen)

Vader is HUMAN-APPROVED and FROZEN: ladder, hp, damage, moves, DEFLECTION,
returned super, SUPPRESSION, VANISH, LIGHTS OUT, saber and its glow. Change
behaviour only on an explicit human instruction backed by new play evidence.
Reference: `docs/engineering/vader.md` — read its invariants before editing.

- One saber, one claimant: ownership moves on COMMIT (`claimSaber`) and returns
  on ARRIVAL (`releaseSaber`); moves needing it declare `needsSaber: true`. No
  pairwise move exclusions; FORCE PULL + DEFLECTION is approved as is.
- The weapon block in `Boss.preUpdate` is the only writer of the saber sprite.
- All darkness goes through `GameScene.requestLightsOut(source)`.
- Returned super: 455 damage (5 pellets), 620 is only the ceiling.
- `_castBossMove` ids are lowercase and refusals are silent — assert each cast.
- Spawning a boss in a test needs `?nodlg=1`.
