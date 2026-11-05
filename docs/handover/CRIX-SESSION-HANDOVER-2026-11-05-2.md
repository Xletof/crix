# CRIX / FRIX — session handover, 2026-11-05 (2)

Closes **P1 — Combat Visual Polish** (all three components HUMAN-approved).
Next focus: **P2 — Arena Visual Identity Expansion** (named, not authorized).
`HANDOVER.md` §0 stays the single source of truth for status; this file records
the closure and the next session's boundaries. Trust `git` over any hash here.

## 1. Repository state (verified 2026-11-05T14:59Z)

| ref | commit | note |
|---|---|---|
| session branch `claude/relaxed-faraday-swav9o` | `71bcd49` | this handover's commit follows it (the session worked directly on the canonical branch) |
| canonical dev `claude/relaxed-faraday-swav9o` | `71bcd49` | same branch; fast-forwarded with this commit |
| `FRIX` (Pages, live build) | `71bcd49` | Pages run #289 success for `71bcd49` (build + deploy) |

Undeployed build inputs on HEAD: none — `FRIX` lacks only this handover
(documentation). Uncommitted work: none. Vite dev server left running on :5173.

## 2. Completed this session

- **P1 — Combat Visual Polish** (`?visualPilot=v2c&polish=p1`) — **HUMAN-APPROVED / FROZEN 🔒** — commits `4b5415e`…`b73eb40` (approved build), verdict recorded `71bcd49` — evidence `docs/evidence/combat-visual-polish-p1/README.md`.
  - P1-A mobile banners (`src/systems/p1Banner.js`), P1-B Super-ready indicator and P1-C player weapons (`src/systems/p1Player.js`, `p1Paint.js`); seams from HUD / GameScene / PreloadScene; `Player.js` untouched.
  - Guard: `tests/smoke-polish-p1.mjs` 82/82 at `5ef3094` (selftest OK); `smoke-visual-pilot` 108/108 at `010d67a`; results in the evidence folder.

## 3. Latest HUMAN decisions

> "P1-A Mobile banners: PASS / P1-B Super-ready indicator: PASS / P1-C Player weapons: PASS" — 2026-11-05 — all three HUMAN-APPROVED / FROZEN.

> "Preserve the exact approved designs and behaviors. Do not reopen them based on earlier agent reservations." — 2026-11-05

> "Approval does NOT authorize changing the no-flags production default. R1 remains the default; V2C and P1 stay available through their existing flags." — 2026-11-05

> "Next proposed milestone: P2 — Arena Visual Identity Expansion, beginning with Reactor Junction. This is a planning direction, not authorization to implement. The full brief will come in a fresh session." — 2026-11-05

Older verdicts: §0 and `docs/handover/CRIX-SESSION-HANDOVER-2026-11-05.md`.

## 4. Boundaries

| item | flag / where | status | authority |
|---|---|---|---|
| P1 (A, B, C) | `?visualPilot=v2c&polish=p1`; `src/systems/p1*.js` | HUMAN-APPROVED / FROZEN 🔒 | HUMAN verdict above; §0 P1 bullet |
| V2C package (hero, swarmlings, V2B objects, Hangar ground) | `?visualPilot=v2c`; `visualPilot.js`, `vpPaint.js`, `vpHangar.js` | HUMAN-APPROVED / FROZEN 🔒 | §0 Visual Identity bullet |
| V2 / V2B outputs | `?visualPilot=v2`, `v2b` | must keep their outputs (comparison flags) | §0 |
| R1 production default (no flags) | `src/systems/debug.js` | HUMAN-APPROVED / FROZEN 🔒 — unchanged | §0; "R1 remains the default" |
| Promoting V2C or P1 to the default | — | NOT AUTHORIZED | "Approval does NOT authorize changing the no-flags production default" |
| P2 — Arena Visual Identity Expansion (Reactor Junction first) | — | NOT AUTHORIZED (planning direction only) | "not authorization to implement" |
| Reactor Junction arena (id `corridor`) | `src/data/rooms.js`, `HANDOVER.md` §10s | HUMAN-APPROVED / FROZEN 🔒 (four arenas) | `CLAUDE.md` Human gates; §0 |
| Duel bar under the pause button | register #25 | DEFERRED | §0 register |
| G1 planted-shot deadlock | register #6 | DEFERRED — not authorized | §0 |

Everything frozen in `CLAUDE.md` "Human gates" and §0 stays frozen.

## 5. Play it

- R1 (production, no flags): https://xletof.github.io/crix/
- V2C (approved baseline): https://xletof.github.io/crix/?visualPilot=v2c
- P1 (approved, opt-in): https://xletof.github.io/crix/?visualPilot=v2c&polish=p1
- Reactor Junction under P1 (today's art; the room P2 would start from): https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&encdbg=1&room=corridor

## 6. Defects and blockers

- Register #25 — nemesis duel bar runs under the pause button (found in P1-A; deferred).
- Register #6 (G1) — shipped in R1, deferred, not authorized.
- Register #9 — full `run-all` 46/52 under R1, not re-run this session.

## 7. Next session — P2 Arena Visual Identity Expansion

- **Authorized scope:** *not yet stated; the HUMAN's brief at session start
  defines it. Do not infer it from this file.* The HUMAN's direction so far:
  "beginning with Reactor Junction … not authorization to implement".
- **Open HUMAN questions:** the P2 flag and how it combines with
  `?visualPilot=v2c` / `polish=p1`; whether P2 may change the frozen arena's
  cover / prop art or only layer over it (V2B/V2C precedent: new keys, same
  canvases and bodies); which other arenas follow.
- **Read first, in order:** this file; `HANDOVER.md` §0 CURRENT STATUS and
  register; `HANDOVER.md` §10s (the Reactor Junction, grep the heading);
  `docs/engineering/environment.md` (arena invariants and the visual-pilot
  notes); `docs/evidence/visual-identity-v2c/README.md` (the Hangar method
  P2 would extend); `src/systems/visualPilot.js` (`pilotTexFor` is Hangar-only today).
- **Guarding tests:** `tests/smoke-visual-pilot.mjs` 108/108 at `010d67a`;
  `tests/smoke-polish-p1.mjs` 82/82 at `5ef3094`; `tests/smoke-junction.mjs`
  (last result: see `tests/README.md`; not run this session).
- **Suggested skills:** `/crix-handoff` to close the session.
- **NOT authorized:** starting P2 before the brief; changing Reactor Junction
  topology, cover footprints, lighting or dark state; changing any approved
  V2C or P1 design; promoting V2C / P1 to the default; G1; plus every frozen
  system, flipping any default, force-pushing or moving `FRIX` without a
  finished change.
- **Unfinished / uncommitted work:** none.

## Bootstrap — paste into a new Claude Code session

```text
You are continuing CRIX / FRIX (repo Xletof/crix; canonical dev branch
claude/relaxed-faraday-swav9o; Pages deploys only from FRIX → https://xletof.github.io/crix/).

1. git fetch origin claude/relaxed-faraday-swav9o FRIX. Your branch must contain
   origin/claude/relaxed-faraday-swav9o (the commit adding
   docs/handover/CRIX-SESSION-HANDOVER-2026-11-05-2.md, or later): if
   `git merge-base --is-ancestor origin/claude/relaxed-faraday-swav9o HEAD`
   fails, run `git merge --ff-only origin/claude/relaxed-faraday-swav9o`;
   if that fails, stop and ask me.
2. Read docs/handover/CRIX-SESSION-HANDOVER-2026-11-05-2.md, then the CURRENT
   STATUS block and the UNRESOLVED-WORK REGISTER of HANDOVER.md §0 (grep the
   headings; do not read the whole file). CLAUDE.md loads automatically.
3. Next focus: P2 — Arena Visual Identity Expansion, beginning with Reactor
   Junction. Authorized scope: none yet — wait for my brief.
4. Hold: V2C and P1 (A, B, C) are HUMAN-APPROVED / FROZEN; ?visualPilot=v2,
   v2b, v2c and polish=p1 keep their outputs; R1 stays the no-flags default;
   the four arenas (topology, cover, lighting, dark state) are frozen; no
   gameplay, RNG, collision or camera change.

If this message carries no task brief, summarize the refs, the frozen
boundaries, the open candidates and the next focus, then STOP.
```
