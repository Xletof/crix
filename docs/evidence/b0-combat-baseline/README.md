# B0 — Combat Baseline: Real-Play TTK & Weapon Economy

**Status: Phase 1 (instrument) and Phase 2 (validation) delivered. The
instrument is opt-in and measurement-only. Phase 3 (the HUMAN handset runs A
and B) is next.** No weapon, ammo, damage, Super, enemy or balance value was
changed. R1 is still the production default, and V2C / P1 / P2-A3 stay as
approved.

HUMAN brief (2026-11-09), condensed: measure how CRIX actually plays on a
handset before deciding whether to raise STANDARD firing capacity or rate,
redesign OVERRIDE, or trade the Super's damage for knockback and slowdown.
Those are hypotheses, not authorized changes. Automated diagnostics support
the human runs; they do not replace them.

## 1. Playtest links (HUMAN, Phase 3)

The approved V2C + P1 + P2-A3 visuals over the unchanged R1 gameplay, with B0
recording:

- **Run A — Gun-forward:** https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b0=A
- **Run B — Natural combat:** https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b0=B

### Handset instructions

1. Start the screen recording **before** opening the link. Use a fresh tab
   for each run.
2. Tap **ENDLESS**. A small tag at the bottom centre reads `B0·A #n  mm:ss`:
   the run label, its number on this phone, and the run's real-time clock.
   Keep it in frame; it ties the video to the data. It does not take touches.
3. Play the run as the brief describes (A: aggressive, shooting first,
   abilities when natural; B: exactly as you normally play). Play until you
   die, or stop whenever you like (step 5).
4. **On game over the B0 report opens by itself.** Tap **Share JSON** and
   send or save the file (Files, Drive, a message to yourself). If the phone
   cannot share files, the same button downloads it. **Copy summary** copies
   the readable report as text. **Close** returns to the game-over screen;
   the **B0 DATA** button (top left) opens the report again.
5. To stop without dying: pause, tap **B0 DATA** (top left of the pause
   screen), then Share. That exports the run so far; the run itself
   continues if you resume.
6. Nothing is lost if the tab closes or reloads mid-run: the run is autosaved
   between waves (and on pause, and when the page is hidden) and appears in the report's run list as `interrupted`. The phone
   keeps the newest 6 runs; the list at the top of the report picks one.
7. Send me both JSON files and both recordings.

## 2. What is measured

Every figure is read from the running game; nothing is estimated from a
damage magnitude. The JSON (`schema: crix-b0/1`) carries these sections, with
exact definitions under `definitions` in every export:

| section | contents |
|---|---|
| `run` | id, run number and label, build (`__BUILD_ID__`: short SHA and build time), full URL and query, the resolved gameplay and visual configuration, mode, seed, start/end time, end reason, device (UA, viewport, DPR, touch), and a read-only snapshot of the tuning in force |
| `clock` | game ms (stops when paused, slows in slow-mo), wall ms, paused wall ms |
| `rooms`, `waves` | per wave: sector, room, encounter, modifier, start/end (game and wall), duration, spawned, killed, max and time-weighted mean alive, hp and shield taken, deaths, upgrades held |
| `enemies` | one record per enemy: role, elite / Champion / nemesis / Vader, VANGUARD screen, encounter, sector, wave, hpMax (+ armour), spawn / first-seen-on-camera / first-damage / death times, fate (`killed`, `takedown`, `wounded` for Vader, `despawned`, `alive-at-end`), killing source, hits / damage / overkill / blocks per source, armour removed, its attacks (shots fired, contact and bolt hits reaching the player, scripted moves) and the damage it dealt |
| `player` | per source (`standard`, `override`, `cluster`, `super`, `melee`, `volatile`, `other`): fired, hits, blocked, deflected, damage, overkill, kills; STANDARD economy (fire-interval histogram, dry presses, cooldown refusals, empty / full time, mean ammo, rounds restored, combat time, shots and damage in combat); OVERRIDE and CLUSTER pickups, bursts / throws, rounds, held time; Super and melee readies, casts, charge times, time held ready, per-cast damage |
| `incoming` | damage asked of the player, shield absorbed, hp removed, negated calls, by source (`grunt:bolt`, `swarmling:contact`, `vader:returned-super`, …), deaths |
| `upgrades` | each card taken, timestamped |
| `timeline` | `[wallMs, gameMs, code, …]` rows: waves, kills, hurts, Supers, melee casts, OVERRIDE on/off, dry presses, pauses, Vader moves (≤ 20,000 rows) |
| `perf` | raw frame-time histogram (1 ms bins), frames over 100 ms, B0's own time per frame, autosave cost |

### Definitions (short form)

- **Damage** is durability actually removed: hp, plus armour for the Shock
  Captain. **Overkill** (requested minus removed on the killing blow) is
  recorded separately and never added to damage. A **shield block** removes
  nothing: it counts under `blocked`, never as damage.
- **TTK:** `spawn→death` starts when the enemy first exists; `seen→death`
  starts when it first appears in the camera view (best read of real-play
  TTK); `1st dmg→death` starts at the first point of durability removed.
  Survivors (alive at run end, or removed by a room change) never enter a TTK
  figure; they are counted under `surv.`.
- **Hits** are damage events that removed durability: one per projectile per
  enemy. Super pellets pierce, so one pellet can hit several enemies.
  `fired.super` counts pellets, and `super.casts` counts presses.
- **STANDARD missed** = fired − hit − blocked − deflected (by Vader). A dry
  press is a fire press refused for no ammo.
- **Combat time** is alive time with at least one live enemy. Shots/min and
  dps "in combat" use it.
- **Charge time** runs from the previous spend (or the run start) until the
  meter fills. **Held ready** is how long a full meter waited to be spent. A
  melee **chain** is its first cast, the one that spends the meter.
- **Theoretical** figures are labelled as such. The only one in the report is
  the STANDARD reload ceiling, `60000 / ammoReloadMs` shots per minute.

## 3. How it stays out of the fight

- **Flag absent:** nothing is constructed, listened to, wrapped, stored or
  drawn (smoke-b0 §0, and §1 against `dc7d9ea`).
- **Flag present:** the instrument installs last in `GameScene.create` and
  only (a) appends listeners to the game's own events, (b) wraps
  `player.damage`, `player.tryFire`, `scene.fireShooter` and each enemy's
  `preUpdate` / `onBlock` / `onPierce` as pure wrappers (original arguments,
  original return), and (c) reads state on `postupdate`. It never calls
  `Math.random`, never emits a game event, never draws in the canvas and
  never writes a gameplay field. Its UI is plain HTML outside the canvas: the
  bottom tag (no touches), the B0 DATA button and the report (only when not
  playing). Every handler is wrapped in try/catch; errors are counted in the
  export (`errors`, `firstError`).
- **Attribution is carried, not guessed.** `GameScene` gains debug-only tags,
  each set and cleared synchronously around the call it describes, and nothing
  in gameplay reads them:
  - `_shotSrc`: which player pool is being resolved, with the rifle burst
    (OVERRIDE) and the cluster fragments told apart.
  - `_dmgSrc` around Vader's damage call (the enemy path already had it).
  - `_dmgSrc = 'volatile'` around the volatile corpse blast, which runs inside
    the killing hit. Without it, the chain damage was credited to the weapon.
    `?captel=1` now reads it as `other`.
  - `_hurtBy`: the bolt hitting the player.
- Files: `src/systems/b0Telemetry.js` (collector), `src/systems/b0Report.js`
  (report, export, storage), `src/systems/debug.js` (flag),
  `src/scenes/BootScene.js` (flag, controller), `src/scenes/GameScene.js`
  (tags and install). `Enemy.js`, `Player.js`, every entity, `config.js`,
  `data/` and every frozen system are untouched (smoke-b0 §6,
  `tests/b0-scope.mjs`).

## 4. Validation (Phase 2)

Results: `smoke-b0.txt`, `suites.txt`, `determinism.txt` in this folder.

- **§0 flag:** absence on R1 and on V2C+P1+P2-A3; labels; the run tag.
- **§1 flag off = `dc7d9ea`** (the approved P2-A3 build): seeded replays of
  R1, legacy, V2C, P1 and V2C+P1+P2-A3 across SWARM TIDE, MIXED s6 and
  VANGUARD, each with a real OVERRIDE pickup, a cluster pod, two Supers and
  melee chains. Compared tick for tick on state, `Math.random` draws,
  per-tick event totals and listener counts; also run once with god mode off.
- **§2 flag on = flag off:** the same replays with `b0` on, headless and
  rendered, god mode on and off (with the player actually hurt).
- **§3 damage truth:** in the seeded fights, recorded damage equals the
  durability the enemies lost, damage + overkill equals the damage requested,
  and kills credited equal deaths. Staged checks:
  - a STANDARD kill (damage = hpMax, overkill = requested − hpMax);
  - a Bulwark front (every block counted, no damage);
  - incoming Swarmling contact and Gunner bolt, attributed and equal to the hp
    the player lost.
  This check failed on the first build (a same-frame spawn-and-kill counted 0)
  and passed after the fix, so it discriminates.
- **§4 lifecycle:** RESTART from the Pause menu, no doubled listeners after it,
  a room transition (despawned, not killed), a reload mid-run (recovered as
  `interrupted`), and a defeat that opens the report by itself. Download JSON
  is complete and equal to the stored run; Copy JSON matches it; Close and
  B0 DATA work.
- **§5 performance:** B0's own time per frame in a busy SWARM TIDE (s8,
  rendered).
- **§6 frozen files:** the B0 scope guard and the Enemy.js guard.
- `--selftest`: an injected `Math.random` draw plus one event per frame must
  fail §2.

## 5. Known limitations (read before analysing)

- **Inferred incoming sources end in `?`.** Damage from Vader's scripted moves
  (`vader:move?`), nemesis moves (`nemesis:move?`), Captain hazards
  (`champion:hazard?`) and bolts that bypass `fireShooter` (Vader's own fan,
  nemesis-move bolts: `vader:bolt?`, `nemesis:bolt?`) is attributed by
  context, not carried. Ordinary enemies' bolts and melee/contact hits, the
  Captain's rounds, Vader's deflected shots and returned Super, and the
  volatile blast are exact.
- **Super damage per cast is approximate** (as in `?captel=1`): pellets from
  one cast can land after the next press. The totals, hit counts and intervals
  are exact.
- **Stealth takedowns** are recognised by the game's own `stealth-kill` event
  before the death. Horde mode rarely offers them.
- **`ammoGained`** counts rounds restored by the reload *and* by refills
  (respawn).
- **Spawn time** is the first frame the instrument sees the enemy, at most one
  frame after `spawnEnemyAt`.
- **Wall-clock TTK** is not recorded per enemy, only game time. The two
  differ only during slow-mo and hit-stop; the timeline carries both clocks.
- **Frame pacing on a handset** is the browser's rAF delta. B0's own cost is
  measured separately, and the harness figures are not a phone's.

## 6. What this does not do

It proposes no TTK target and no tuning. Analysis of runs A and B will
separate **measured** results (from the JSON), **theoretical** calculations
(from the tuning snapshot) and **subjective HUMAN** judgements (from the
footage and the human's words).
