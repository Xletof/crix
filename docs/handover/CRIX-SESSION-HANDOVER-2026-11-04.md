# CRIX / FRIX — session handover, 2026-11-04

Concise closure of the R0/R1 session and the boundaries of the next phase.
`HANDOVER.md` §0 stays the single source of truth for status; this file records
the latest HUMAN decisions and what the next session may and may not touch.
Trust `git` over any hash written here.

## 1. Repository state at closure (verified)

| ref | commit |
|---|---|
| canonical dev `claude/relaxed-faraday-swav9o` | `b7812d1` (this handover's commit follows it) |
| `FRIX` (GitHub Pages) | `b7812d1` — Pages run #283 succeeded |
| last session branch `claude/zealous-hopper-7rirv8` | `b7812d1` |

Live build: https://xletof.github.io/crix/ — legacy comparison:
https://xletof.github.io/crix/?baseline=legacy

## 2. Last completed milestone — R1, integrated combat production rollout

* **Configuration C is HUMAN-approved and the production default** (no flags):
  roster v1, move v22, gait v2, `bulwarkStuck=early`, `marksmanStuck=early`,
  `marksmanAngle=1`, `bulwarkAngle=1`. Rollout commit `7bd6e6f` (a configuration
  change only: `systems/debug.js` "THE GAMEPLAY BASELINE" + one `BootScene` call);
  records `b7812d1`.
* **Marksman stuck-B (`early`) is HUMAN-approved / FROZEN.** T1, T2, Bulwark
  stuck-B, roster v1, gait v2 and movement v2.2 keep their approvals, unchanged.
* **`?baseline=legacy`** is the pre-R1 game, tick for tick; each flag overrides one
  switch (`?marksmanStuck=off` = R0's B).
* **Known defect, deferred — G1:** the v2.2 Gunner/Rifleman planted-shot deadlock
  (register #6) ships in the default by the human's decision. Not resolved, not
  approved behaviour, not authorized.
* Full suite **46/52, not green** (no failure caused by R1; register #9).
* Evidence: `docs/evidence/integrated-combat-r0/` (R0 notes with the HUMAN verdict
  and the R1 validation; `r1/` logs). Gate: `tests/smoke-integration-r0.mjs`.
* No further gameplay change is authorized.

## 3. New HUMAN decision — Visual Identity V2 look-development pilot

On 2026-11-04 the human reviewed an 80.8 s recording of the live R1 game, agreed
with the visual review, and **authorized starting an OPT-IN Visual Identity V2
look-development pilot.** Agreed direction:

* Stronger **protagonist** identity: silhouette, armor, animation presentation.
* **Redesign the small green swarm enemies** (currently legacy Grunt artwork).
* **Do NOT redesign the white Riflemen / Stormtroopers** — their V1 art is approved.
* Grittier, more industrial pixel-art materials.
* Bolder, more readable character outlines; stronger lighting separation.
* More perceived environmental depth, contact shadows, material contrast.
* Clearer distinction between floors, cover, machinery and combat actors.
* Keep the strong combat feedback while improving its visual hierarchy.
* Later (not first): oversized banners and mobile presentation issues.

### Naming — verified in the code

| what the human means | code type | current art |
|---|---|---|
| small green swarm enemies (REDESIGN) | **`swarmling`** (`ENEMY.swarmling`, acid green `0x70e838`, radius 13, speed 310, packs of 4–6) | the legacy `grunt` sheet with its own tint and 0.7 scale; deliberately excluded from roster v1 (`data/rosterArt.js`, `spawnEnemyAt`: `type !== 'swarmling'`) |
| white Riflemen / Stormtroopers (PROTECTED) | **`grunt`** | roster v1 `ro-rif-*` (approved) |
| protagonist | `Player` | `paintPlayer` in `systems/pixelArt.js` |

`grunt` in code is the white Rifleman — never treat a "Grunt redesign" request as
touching it.

## 4. Next phase boundaries — a single controlled visual pilot

* **One opt-in visual candidate** (its own URL flag, presentation only), with the
  current production presentation as the untouched baseline. No visual default
  changes until the human judges the pilot on the handset.
* **Demonstrate the language in one real gameplay scene**: the protagonist, a
  swarmling pack, the existing white Riflemen, other approved enemies, cover,
  industrial machinery and combat effects. Not a wholesale art replacement.
* **Protected — do not change:** the white Riflemen and every approved enemy
  design, the arena layouts, the camera, gameplay, AI, collision and hitboxes
  (art must not resize bodies; projectile canvas sizes stay fixed), damage, RNG
  (no added or removed `Math.random` draws — particles and overlays count),
  encounters, the frozen systems listed in `CLAUDE.md`.
* Prove flag-off identity (pixels and seeded replay) against `b7812d1`; with the
  flag on, prove the same fight tick for tick (presentation only). Environment art
  rules apply: no red in environment art, no small green points in the dark.
* Not in scope: G1, Gunner AI, SNIPER NEST balance, banners/mobile layout (later),
  any new enemy or content phase.

## 5. Where to look

`HANDOVER.md` §0 (CURRENT STATUS, UNRESOLVED-WORK REGISTER) ·
`docs/engineering/environment.md` and `enemies.md` (art and roster traps) ·
`tests/README.md` (harness; R0/R1 sections for the baseline pin) ·
`docs/handover/CRIX-SESSION-HANDOVER-2026-11-02.md` (older ledger and histories).
