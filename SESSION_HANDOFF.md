# Frix — Session Handoff

## 1. Project Identity
*   **Game**: Frix — Death Star **Swarm Survival** twin-stick shooter (horde waves, not stealth)
*   **Tech**: Phaser 3.90 + Vite, vanilla JS modules, Arcade Physics
*   **Branch**: `FRIX` (repo default; GitHub Pages auto-deploys from it via Actions)
*   **Live**: https://xletof.github.io/crix/

## 2. Current Game Design (post horde overhaul, commits 549e281 → 3990ad5)

The core loop the game is built around: **dash (i-frames + cover vault) + shoot +
super + shoot**. Accuracy streaks multiply super-charge gain up to 2×.

*   **Swarm AI**: every enemy spawns with `spec.behavior='swarm'` (forced in
    `spawnEnemyAt`). A branch at the top of `EnemyShooter.preUpdate` bypasses the
    old stealth FSM: grunts rush to 150px then orbit-strafe while firing; shooters
    hold 340px, back off under 160px. No vision-cone gating; firing stays LOS-gated.
    Tunables: `SWARM_*` constants in `Enemy.js`.
*   **Spawner**: `ARENA` config in `config.js` — `{ time, spawnRate, rampTo,
    maxAlive, surgeEvery, surgeCount, shooterMix }` per room. Continuous drip
    (interval lerps spawnRate→rampTo, pauses at maxAlive) + telegraphed SURGE
    bursts every `surgeEvery`s and on terminal hacks. Spawns emerge at `gates[]`
    (rooms.js) ≥400px from the player after a 600ms red-ring telegraph.
*   **Rooms**: 4 open arenas (hangar, REACTOR JUNCTION, detention, vader). Cover
    blocks ~300px apart (one dash-vault chain). Round ends when the timer expires
    (`_onArenaCompleted`). Vader room: survival round first, then Vader spawns with
    up to 4 swarm survivors kept alive (dual climax).
*   **Terminals**: optional risk/reward — hacking grants a support drop
    (50% weapon / 50% shield+bacta) AND triggers an immediate surge.
*   **Allies are CUT** (were the "unkillable floating weapon" bug — turret reused
    cover art, soldier reused grunt art). `Ally.js` stays in-tree, unimported.
*   **Stealth FSM is DORMANT**, not deleted — bypassed by the swarm branch.
    A stealth mode can return later.
*   **HUD**: KILLS counter | SURVIVE timer | SURGE ticker across the top.
    Records (`crix.stats`): runs, wins, bestTime, bestKills, totalKills,
    bestMaxCombo, lastDamageTaken.

## 3. What the last session fixed (playtest: "nothing is ready")
1.  Frozen "floating weapon" enemies → stealth-FSM stand-and-scan; fixed by swarm AI.
2.  "Undamageable enemies" → the allies; fixed by cutting them.
3.  Too few enemies → dead `spawnRate` config + hardcoded 20s waves; fixed by
    drip/surge spawner (first spawn ~2s in).
4.  Legacy per-room reinforcement system + WaveManager.js deleted.
5.  Perf: no patrol-route redraw, 300ms repath throttle, per-room LOS rect cache,
    alternate-frame bullet trails. Grunt bullet 100→80, orb drop 0.18→0.22.

## 4. Verification workflow
*   `npm run build` must pass clean before every commit; push to `FRIX` only.
*   Headless smoke (Playwright at `/opt/pw-browsers/chromium`, dev server :5173):
    Title ENGAGE is at y≈0.82·1280≈1050 (RECORDS below it). `window.game` is
    exposed in dev — probe `scene.getScene('Game')` for enemies/kills/timer.

## 5. Suggested next steps (not started)
1.  **Real-device playtest + balance pass** — tune ARENA maxAlive/spawnRate and
    player HP against actual thumb play; the horde is deliberately spicy now.
2.  **Wave/round structure feedback** — consider wave-count display, between-round
    breathers, or escalating room modifiers.
3.  **Boss fight integration** — Vader + 4 swarm survivors is new; check the cap
    interaction and phase pacing.
4.  **Ally comeback (optional)** — needs dedicated turret/droid art first.
5.  **Audio mix pass** — SFX levels untuned.
