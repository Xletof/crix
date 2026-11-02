---
paths:
  - "src/scenes/GameScene.js"
  - "src/config.js"
---
# GameScene and config: who owns what

Both files hold code and tuning for frozen systems. Before changing a block,
find its owner below; frozen ones change only on an explicit human instruction.
References are in `docs/engineering/`.

| area | owner / status | reference |
|---|---|---|
| `CAMERA`, the `CameraDirector` wiring | camera — frozen | `camera.md` |
| `BOSS`, `PARRY_ARCS`, `LIGHTSOUT`, `ENDLESS.bossLadder`; `spawnBoss`, `_castBossMove`, `requestLightsOut`, `firePlayerSuper` (returned-super path) | Vader — frozen | `vader.md` |
| `_resolveEncounter`, `spawnAtGate`, `triggerSurge`, `_vanguardFront`, `_spawnPlacedChampion`, `_maybeInjectChampion` | encounters / placement / VANGUARD — frozen | `encounters.md` |
| `CHAMPION`, `HARROWER`; `_castChampionMove` | Shock Captain frozen; Harrower rejected | `champion.md` |
| `ENEMY`; `spawnEnemyAt` (seam install order) | roster frozen; `Enemy.js` frozen | `enemies.md` |
| `ARENA`, `DARKNESS`; `loadRoom`, `_clearRoomEntities` | arenas frozen | `environment.md` |
| `PLAYER`, `WEAPONS`, `HUDCFG`, `DEPTH`, `MODIFIERS`, `SCORE`, `MUSIC` | shared — not frozen as a whole; check what reads a value | `core.md` |

- Values belonging to a frozen system are handset verdicts, not defaults.
- `_castNemesisMove` treats a cancelled handle as live: a known latent bug,
  deferred (register #14), not something to fix in passing.
- A rig that mutates config must go through the running game, not a dynamic
  `import('/src/config.js')`.
