# Encounters, placement and the encounter harness — reference

**Status: HUMAN-APPROVED / FROZEN 🔒** — Roster Phase A (composition, §10ac) and
Phase B (Champion placement, VANGUARD screen / front / surge, final gameplay
baseline `a3563a4`). Compositions, gate rules, sector bands, pressure
multipliers, placements and the VANGUARD numbers do not move without new
handset evidence.

## Invariants

- `src/data/encounters.js` is a data table, not a framework: no callbacks,
  conditions or parsers. `GameScene._resolveEncounter` is the whole engine side,
  and every null exit leaves the pre-Phase-A path intact.
- **Exclusion by absence**: the boss room has no plan entry and the duel wave is
  refused on `wave.miniBoss`. Never replace that with `if (roomSpec.boss)`.
- A preferred gate never beats the 400px spawn safety.
- `CHAMPION_PLACEMENTS` is the only production door for a Champion (no chance
  roll, no clock); the band is the progression gate; the Captain consumes the
  encounter's budget; `_maybeInjectChampion` stands down when `_placement` is set.
- Any mid-wave spawn source draws from the fill roll, never `_spawnQueue`.
- `?encdbg` and its sub-flags (`&room=`, `&sector=`, `&wave=`, `&nochamp=1`,
  `&noscreen=1`, `&nofront=1`) are inert without `encdbg`; the force substitutes
  and never manufactures.
- Known, deliberately carried: `_applySectorScaling` computes a `count` nothing
  reads (a balance decision, register #15); `DebugScene._skipWave` leaves
  `arenaActive` false (#16).

---

## Trap ledger

Entries under the headings below were migrated from the root `CLAUDE.md` as it stood at `7d67bed` (`git show 7d67bed:CLAUDE.md`), keeping their wording. Anything since superseded carries a **Status (2026-11-02)** note rather than being silently rewritten.

### Composition (Phase A)

- **WAVES ARE COMPOSED NOW, AND `src/data/encounters.js` IS THE TABLE.** It is a
  DATA LAYER, not a framework — six archetypes, each an ordered guaranteed
  `lead`, a `fill` pool (weighted by REPEATING an id, never by a number), a
  `gate` mode and three pressure multipliers. **If it ever needs a callback, a
  condition or a parser it has failed its brief; the answer is to stop, not to
  grow a grammar.** `GameScene._resolveEncounter` is the whole engine side and
  **every exit leaves the old path intact**: null encounter → `_rollEnemyType`
  and the ordinary far-gate picker, which is exactly the pre-Phase-A code.
  **PHASE A IS HUMAN-APPROVED AND FROZEN 🔒** — handset play confirmed the
  archetypes are identifiable from composition alone WITH THE DEBUG LABELS OFF,
  which was the whole thesis. `HANDOVER.md` §10ac. The compositions, the gate
  rules, the sector bands and the pressure multipliers do not move without NEW
  handset evidence.

- **THE BOSS ROOM IS EXCLUDED BY ABSENCE, NOT BY A BRANCH.** `vader` has no
  entry in `ENCOUNTER_PLAN`, so `encounterFor` returns null and its escort waves
  run untouched; the duel wave is refused by the caller on `wave.miniBoss`.
  `smoke-encounters` pins the boss room's absence in both directions. Do not
  "tidy" this into an `if (roomSpec.boss)` — absence is what makes the layer
  removable.

- **A COMPOSITION'S PREFERRED GATE NEVER BEATS THE 400px SAFETY.** `spawnAtGate`
  takes an optional gate, and uses it only if it is ≥400px from the player;
  otherwise that one spawn falls back to the ordinary picker. A player who walks
  over to camp a single-gate encounter's door must not get a trooper on top of
  them.

- **`_applySectorScaling` COMPUTES A `count` THAT NOTHING READS, AND THAT IS A
  LIVE BUG WE ARE CARRYING DELIBERATELY.** It scales `out.count` on `arenaCfg`,
  but the drip has always tested the raw authored `wave.count` — so **enemy
  COUNT per wave has never scaled with the sector.** Only `maxAlive`,
  `spawnRate`, `eliteChance`, hp and speed ever did. Phase A did NOT fix it:
  pointing the drip at the scaled value is a 2.56x spike at sector 14, which
  inside a handset test asking "does composition create tactics?" is a
  confounded A/B. `_waveCount` carries the budget now, so the fix is one line
  and is a separate, deliberate balance decision.

- **A SWARMLING SPAWN EVENT IS A PACK OF 4-6 BODIES, AND THE CAP IS CHECKED
  BEFORE IT LANDS.** `living < cfg.maxAlive` gates the drip, then
  `_spawnSwarmlingPack` drops `packMin..packMax` at once — measured live at 9
  alive against a cap of 6. Any swarmling-heavy composition must run a LOWER
  cap, not a higher one; the volume is already in the pack.

### Encounter harness and debug paths

- **`?encdbg=1` IS THE PHASE A ENCOUNTER TEST HARNESS, AND ITS FIRST PROPERTY IS
  THAT IT DOES NOT EXIST WITHOUT THE FLAG.** No overlay is constructed, no
  pointer area is taken off the fire stick, and a force left set from an earlier
  run is IGNORED — `_resolveEncounter` only consults it under `isEncDebug()`.
  `smoke-encdbg` checks every one of those as a PAIR (absent without the flag,
  present with it), because "the overlay appears" passes just as happily on a
  build that shows it to every player.
  Grammar: `?encdbg=1` overlay only, `?encdbg=crossfire` pre-selects an
  archetype, `&room=detention` and `&sector=8` start the run there so one
  bookmark is one test case. An unknown archetype id falls back to AUTO.

- **THE FORCE SUBSTITUTES; IT NEVER MANUFACTURES.** `_resolveEncounter` asks the
  real `encounterFor` first and returns on null, and only then swaps in the
  forced archetype. So the boss room and the duel wave stay outside the harness
  by the SAME ABSENCE that protects them in production, not by a second guard
  that could drift out of step with the first. `smoke-encdbg` forces an
  archetype hard and asserts the boss room and the duel wave still resolve to
  nothing. Do not "improve" this into an explicit `if (roomSpec.boss)`.

- **A DEBUG BUTTON MUST LIVE IN THE RIGHT HALF OF THE SCREEN.** The move stick
  claims the whole LEFT half with no `shouldClaim` hook at all; the fire stick
  claims the right half and takes one, which is how the pause button already
  lives there. A left-half button would be unblockable without teaching the move
  stick about exclusions — a change to a control the player actually uses.
  `_overEncBtn` joins `_overPauseBtn` in that list, and `smoke-encdbg` asserts no
  exclusion point falls in the left half.

- **`DebugScene._skipWave` LEAVES `arenaActive` FALSE.** `_clearWave` sets it
  false and only `loadRoom` ever sets it true, so SKIP WAVE starts a wave the
  spawner is switched off for. Pre-existing; noted, not fixed. Any new debug
  path that restarts a wave must assert `arenaActive = true` itself —
  `_debugReplayWave` does.

- **A DEBUG WAVE SWEEP USES `_destroyEnemyFully`, NOT `damage()`.** Killing
  through the damage path pays score for enemies nobody fought and fires every
  volatile/bomber death blast across the arena at the moment the replay is
  trying to establish its read — the same reason `_beginDuel` DISMISSES trash
  instead of killing it. The known cost is that `RoomManager.aliveEnemies` is
  not decremented and drifts UPWARD, which is the safe direction: its only job
  is to emit `room-cleared` at zero, and the wave machine reads
  `_livingEnemyCount()` rather than that counter. Never drive that counter to
  zero in a sweep — that fires `room-cleared` and completes the room.

### Champion placement and VANGUARD (Phase B)

- **CHAMPION PLACEMENT IS AUTHORED, AND IT IS HUMAN-APPROVED / FROZEN 🔒 —
  `HANDOVER.md` §10at. PHASE B IS COMPLETE; FINAL GAMEPLAY BASELINE `a3563a4`
  (Captain V1 baseline `6560c62`). Nothing moves without NEW handset evidence.** `CHAMPION_PLACEMENTS` in `encounters.js` is the
  only production door: a row names an arena, a band, a wave index and the
  archetype that cell already runs, and nothing else ever puts a Champion on
  the floor — no `championChance`, no roll, no promotion, no clock. **Do not
  add one.** Four traps: (1) **THE BAND IS THE PROGRESSION GATE.** `mid`
  starts at sector 5 and sector 5 is always Vader, so no mid/late row can fire
  before the first Vader — change `bossEvery` or the band edges and
  `smoke-champion-placement` fails rather than a pre-Vader Captain shipping.
  (2) **HE CONSUMES THE ENCOUNTER.** The queue is built exactly as before, then
  he REPLACES a lead slot and `cost - 1` events come off the tail, so
  `_waveCount` shrinks; a full wave plus a 5300-durability actor is the hidden
  pressure increase this layer exists to refuse. It runs AFTER the queue and
  gates are built so every non-placement wave draws the same random numbers
  it always drew. (3) **THE TOKEN ROUTES AROUND `spawnEnemyAt`.** `spawnAtGate`
  sends a `PLACEABLE_CHAMPIONS` id to `_spawnPlacedChampion` → `spawnChampion`,
  never through the elite roll or the sector hp/speed ramp, which would both
  change frozen values. (4) **ONE AUTHOR PER WAVE.** `_maybeInjectChampion`
  (`?champdbg`) stands down whenever `_placement` is set, or the two paths
  stack. A row applies only while its archetype is the one RUNNING, so a debug
  force onto SWARM TIDE takes him away rather than inventing a pairing.
  `?encdbg=1&room=&sector=&wave=` reaches any cell and `&nochamp=1` is the
  matched no-Captain baseline; both are inert without `encdbg`.

- **THE VANGUARD SCREEN IS AN ENCOUNTER ROLE, NOT A NEW SHIELDED — `HANDOVER.md`
  §10au. HUMAN-APPROVED / FROZEN 🔒 (`a3563a4`).** `spawnAtGate` stamps `vanguardScreen: VANGUARD_SCREEN`
  into the spawn spec when the token is a `shielded` drawn while VANGUARD is
  the running encounter — decided at DRAW time, not when the 600ms telegraph
  lands. `EnemyShielded` then closes to `holdPx` (140) and holds until the
  player opens past `resumePx` (165); `_screen` null is the stock trooper byte
  for byte. **`ENEMY.shielded` IS NOT TOUCHED, AND THE ANSWER WAS NEVER
  ECONOMY**: a blocked frontal shot still gives zero damage, zero Super and
  zero melee charge, and the turn rate is still 2.6. The problem was the
  radius — at the stock ~290px hold (the branch advances only past
  `desiredRange + 30`), 380px/s of footwork is ~1.3 rad/s of bearing against a
  2.6 rad/s shield; at 140 it is ~2.7. Do not "fix" a shield tail by paying for
  blocked shots or slowing the turn. `?encdbg&noscreen=1` restores the old hold
  for an A/B and is inert without `encdbg`.

- **QUEUE ORDER IS NOT BATTLEFIELD ORDER — the VANGUARD FRONT, `HANDOVER.md`
  §10av. HUMAN-APPROVED / FROZEN 🔒 (`a3563a4`).** A 600ms gate telegraph plus a ~616ms drip put the third
  event ~0.6s behind the second shield, and the shield is the slowest body in
  the formation. `_vanguardFront` holds the drip after the two opening shield
  EVENTS until the two shield ACTORS establish (both within `establishPx`
  200), are breached (either dead) or time out (3000ms after the second
  MATERIALISES); both clocks run on the drip's own `delta`. Resolved from
  actors registered by `_frontRegister`, never from `_waveSpawned` — two red
  gate rings are not a front. It never re-arms, and surges are never pair
  members. The opening pair's `vanguardLane` (±60px across their own line of
  approach) is dropped at the first close hold. `&nofront=1` switches it off
  with the screen still on; it is NOT `noscreen`. **CROSSFIRE + Captain is
  HUMAN-APPROVED / FROZEN** and never arms it. **And `?encdbg&wave=N` omits the
  room's authored opening enemies** — a real wave 2 never has them, and keeping
  them handed every VANGUARD review five exposed bodies from second zero.

- **A SURGE NEVER TOUCHES THE AUTHORED QUEUE — `HANDOVER.md` §10aw.
  HUMAN-APPROVED / FROZEN 🔒 (`a3563a4`).** The drip
  is the only consumer of `_spawnQueue`; `triggerSurge` draws from
  `_rollEncounterFillType()` (the running encounter's fill, else the room
  roll). It used `_nextEncounterType()`, which SHIFTS the queue, and during a
  VANGUARD front hold that spawned the Captain himself past the staging. Any
  new mid-wave spawn source goes through the fill roll, never the queue. The
  mid Captain-VANGUARD row's `shieldSlot: 5` converts one FILL event into a
  guaranteed shield after placement — same budget, same draws elsewhere.
