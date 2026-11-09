# CRIX / FRIX — session handover, 2026-11-09

Closes **P2-A Combat VFX — P2-A → P2-A2 → P2-A3; P2-A3 HUMAN-APPROVED** (sharp
STANDARD discharge). Next focus: **B0 — Combat Baseline: Real-Play TTK & Weapon
Economy (measurement only)**. `HANDOVER.md` §0 stays the single source of truth
for status; this file records the closure and the next session's boundaries.
Trust `git` over any hash here.

## 1. Repository state (verified 2026-11-09T10:59Z)

| ref | commit | note |
|---|---|---|
| session branch `claude/determined-noether-q13hw5` | `dc7d9ea` | this handover's commit follows it |
| canonical dev `claude/relaxed-faraday-swav9o` | `dc7d9ea` | fast-forwarded; handover commit fast-forwards it too |
| `FRIX` (Pages, live build) | `dc7d9ea` | Pages run #293 success (`deploy.yml`, `FRIX`) |

Undeployed build inputs on HEAD: none (this handover is documentation only).
Uncommitted work: none.

## 2. Completed this session (since `def85e5`)

- P2-A Blaster Fire & Impact — superseded (played, not approved; kept as the
  `fxPilot=p2a` comparison flag) — `651619b`…`514a385` — `docs/evidence/combat-vfx-p2a/`.
- P2-A2 Primary Carbine & OVERRIDE — HUMAN-ACCEPTED (direction) — NOT FROZEN on
  its own; kept as `fxPilot=p2a2` — `11bbd09`…`356b5df` — `docs/evidence/combat-vfx-p2a2/`.
- P2-A3 OVERRIDE refinement — **HUMAN-APPROVED / FROZEN 🔒** (opt-in) —
  `f09fb39`…`dc7d9ea` (sharp default `9eb4231`) — `docs/evidence/combat-vfx-p2a3/README.md`.

## 3. Latest HUMAN decisions

> "Close P2-A3 using my final HUMAN verdict as APPROVED. Freeze only explicitly
> approved visuals, preserve all R1/V2C/P1 contracts, and record the selected
> muzzle variant. Do not make gameplay changes." — 2026-11-09

> Muzzle variant: "Sharp"; "Make sharp default" — 2026-11-09 (answers to the
> agent's question) — `fxPilot=p2a3` draws the sharp discharge; `&muzzle=current`
> is a comparison flag.

> "Our next milestone is B0 — Combat Baseline: Real-Play TTK & Weapon Economy.
> It is strictly measurement-only. No weapon, ammo, damage, Super, enemy or
> combat-balance changes are authorized." — 2026-11-09

> P2-A2 "directionally accepted for continued development, but NOT yet
> HUMAN-APPROVED or frozen" — 2026-11-06 (P2-A3 brief).

Older verdicts: §0 and `docs/handover/CRIX-SESSION-HANDOVER-2026-11-05-2.md`.

## 4. Boundaries

| item | flag / where | status | authority |
|---|---|---|---|
| P2-A3 weapon presentation (STANDARD rifle, OVERRIDE readout / power cell / beats, sharp discharge) | `?visualPilot=v2c&polish=p1&fxPilot=p2a3`; `systems/p2aFx.js`, `p2a2Loadout.js`, `p2a3Override.js`, `p2aPaint.js` | HUMAN-APPROVED / FROZEN 🔒 (opt-in, not the default) | §0 "P2-A3 HUMAN VERDICT (2026-11-09)" |
| `fxPilot=p2a`, `fxPilot=p2a2`, `muzzle=current` | `systems/debug.js` | comparison flags — not separately approved | §0 |
| R1 production default, V2C, P1 | no flags / `visualPilot=v2c` / `&polish=p1` | HUMAN-APPROVED / FROZEN 🔒 | `CLAUDE.md` Human gates; §0 |
| Weapons, ammo, damage, Super, enemies, combat balance | `src/config.js` (`PLAYER`, `WEAPONS`, `ENEMY`), `entities/` | NOT AUTHORIZED (B0 measures them) | B0 quote, §3 |
| Shipped HUD rifle counter (register #28) | `HUD.js` | DEFERRED in R1/P1/P2-A/P2-A2; resolved only in P2-A3 | §0 register |

Everything frozen in `CLAUDE.md` "Human gates" and §0 stays frozen.

## 5. Play it

- R1 (production, no flags): https://xletof.github.io/crix/
- P2-A3 (approved, opt-in): https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3

## 6. Defects and blockers

- `run-all` 46/52 under R1 (register #9; §0) — unchanged.
- `smoke-readability` Vader check intermittent (passed 19/19 on 2026-11-06,
  failed 1/19 in earlier runs) — `combat-vfx-p2a3/suites.txt`.
- One non-reproducing R1 replay divergence in `smoke-fx-p2a3` section 11
  (tick 1280; standalone re-run 15/15) — `combat-vfx-p2a3/suites.txt`.
- Second dev server for an old build must use its own Vite `cacheDir`
  (`docs/engineering/core.md`, P2-A3 traps).

## 7. Next session — B0 Combat Baseline

- **Authorized scope:** "strictly measurement-only. No weapon, ammo, damage,
  Super, enemy or combat-balance changes are authorized." The detailed brief is
  the HUMAN's at session start; do not infer more from this file.
- **Open HUMAN questions:** none.
- **Read first, in order:** this file; `HANDOVER.md` §0 CURRENT STATUS and
  register; `src/config.js` (`PLAYER`, `WEAPONS`); `src/systems/CaptainTelemetry.js`
  + `tests/smoke-captel.mjs` (the existing opt-in `?captel=1` instrument);
  `tests/README.md` and `docs/engineering/testing.md` (harness, seeded replays,
  `bootPage` / `FIGHT_SEG` in `tests/diag-stuck-audit.mjs`).
- **Guarding tests:** `tests/smoke-fx-p2a3.mjs` — 98/99 + section 11 re-run
  15/15 at `d5bf239`; covering suites in `combat-vfx-p2a3/suites.txt`.
- **Suggested skills:** none.
- **NOT authorized:** any tuning or balance change, new gameplay, P2-B,
  arena art, making P2-A3 (or V2C/P1) the default; plus every frozen system,
  flipping any default, force-pushing or moving `FRIX` without a finished change.
- **Unfinished / uncommitted work:** none.

## Bootstrap — paste into a new Claude Code session

```text
You are continuing CRIX / FRIX (repo Xletof/crix; canonical dev branch
claude/relaxed-faraday-swav9o; Pages deploys only from FRIX → https://xletof.github.io/crix/).

1. git fetch origin claude/relaxed-faraday-swav9o FRIX. Your branch must contain
   origin/claude/relaxed-faraday-swav9o (the 2026-11-09 handover commit or later):
   if `git merge-base --is-ancestor origin/claude/relaxed-faraday-swav9o HEAD`
   fails, run `git merge --ff-only origin/claude/relaxed-faraday-swav9o`; if that
   fails, stop and ask me.
2. Read docs/handover/CRIX-SESSION-HANDOVER-2026-11-09.md, then the CURRENT
   STATUS block and the UNRESOLVED-WORK REGISTER of HANDOVER.md §0 (grep the
   headings; do not read the whole file). CLAUDE.md loads automatically.
3. Next focus: B0 — Combat Baseline: Real-Play TTK & Weapon Economy. Authorized
   scope: "strictly measurement-only. No weapon, ammo, damage, Super, enemy or
   combat-balance changes are authorized." Wait for my brief for the rest.
4. Hold: R1 stays the production default; V2C, P1 and P2-A3 (fxPilot=p2a3, sharp
   discharge) are HUMAN-APPROVED / FROZEN opt-in visuals; Enemy.js is frozen;
   instruments must not change the seeded fight (no new Math.random draws).

If this message carries no task brief, summarize the refs, the frozen
boundaries, the open candidates and the next focus, then STOP.
```
