# Crix: Session Handoff

## 1. Project Identity
*   **Game Name**: Crix (Death Star infiltration top-down twin-stick shooter)
*   **Tech Stack**: Phaser 3.90 + Vite, vanilla JS modules, Arcade Physics
*   **Current Branch**: `claude/mobile-run-game-design-OZLYF` (also fast-forwarded to FRIX)

---

## 2. What Was Requested in This Session
*   **Ranged Enemy Classification**: Classify Stormtrooper Grunts (white) and Death Troopers (black) and make both ranged (no melee enemies). Done.
*   **Game Weakness Audit**: Review the codebase to identify visual, mechanical, UI, and architectural weaknesses and propose recommended phases. Done (see [game_audit_report.md](file:///C:/Users/CG817PA/.gemini/antigravity/brain/58cb18b2-b2c7-4ed6-8ef0-ffafa2a92563/game_audit_report.md)).
*   **Grill-Me & Priority Planning**: Grill the user on what to prioritize next. Done; the user selected **Stealth & AI Suspicion Overhaul** as the first priority and approved the plan (see [implementation_plan.md](file:///C:/Users/CG817PA/.gemini/antigravity/brain/58cb18b2-b2c7-4ed6-8ef0-ffafa2a92563/implementation_plan.md)).
*   **What should NOT be done yet**: Do not implement the suspicion/investigation state machine yet.

---

## 3. What You Changed
*   **[config.js](file:///C:/Users/CG817PA/Documents/antigravity/beautiful-rutherford/src/config.js)**: Replaced melee stats for `grunt` with standard ranged stats (slower fire rate, lower damage). Buffed `shooter` to be an elite ranged trooper (rapid suppressive fire, high damage).
*   **[Enemy.js](file:///C:/Users/CG817PA/Documents/antigravity/beautiful-rutherford/src/entities/Enemy.js)**: 
    *   Made `EnemyGrunt` inherit from `EnemyShooter` instead of `Enemy`.
    *   Deleted custom melee chase/strike ticks from `EnemyGrunt`.
    *   Enabled weapon sprites for grunts (`wpn-enemy-rifle`) and initialized fire cooldowns.
    *   Made shooter's post-fire cooldown interval dynamic (based on `this.cfg.fireCooldownMs` rather than hardcoded combat phase constants).
*   **[GameScene.js](file:///C:/Users/CG817PA/Documents/antigravity/beautiful-rutherford/src/scenes/GameScene.js)**: Refactored `fireShooter()` to read speed, damage, and range values directly from the firing enemy's config rather than the hardcoded `ENEMY.shooter` object.

---

## 4. What You Verified
*   **CI Tests**: Executed `node phase1_qa.cjs` and confirmed all 19/19 vertical slice tests pass.
*   **Production Build**: Ran `npm run build` and confirmed the bundle compiles successfully with zero errors.
*   **Git Sync**: Pushed all changes to origin.

---

## 5. Current Known Issues
*   The AI suspicion and sound investigation mechanics are in the design/planning stage and not yet implemented.

---

## 6. Next Recommended Task: Stealth & AI Suspicion Overhaul
*   **First Files to Inspect**: 
    *   [Enemy.js](file:///C:/Users/CG817PA/Documents/antigravity/beautiful-rutherford/src/entities/Enemy.js)
    *   [GameScene.js](file:///C:/Users/CG817PA/Documents/antigravity/beautiful-rutherford/src/scenes/GameScene.js)
*   **Implementation Steps**:
    1.  Add `ST.SUSPICIOUS` state to `Enemy.js`.
    2.  Implement `onHearSound(x, y)` in `Enemy.js` (transitions unalerted enemies to `ST.SUSPICIOUS`, shows a yellow `?` bubble, and updates target coordinates).
    3.  Implement `_tickSuspicious(delta)` in `Enemy.js` (enemies pathfind to noise, scan the area for 4 seconds, then return to patrol).
    4.  Implement `propagateSound(x, y, radius)` in `GameScene.js`, hooking it to gunshots and bullet-wall impact hits.
*   **Stop Condition**: Firing a blaster or hitting walls draws nearby guards to investigate with a yellow `?` before returning to their paths, and tests continue to compile cleanly.

---

## 7. Critical Instructions for the Next Agent
*   **Do not repeat completed work**: Grunts are fully ranged shooters now. Do not revert them to melee.
*   **Confirm current code before editing**: Always verify the state of `Enemy.js` before writing the suspicion logic.
*   **Keep changes minimal**: Only add elements required for the suspicion state. Do not do a broad AI refactor.
*   **Do not proceed to later phases**: (Volume sliders, screen edge hit arcs, Vader cracks) unless explicitly requested.
