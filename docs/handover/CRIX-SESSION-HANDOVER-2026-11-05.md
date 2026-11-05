# CRIX / FRIX — session handover, 2026-11-05

Closes the Visual Identity V2 → V2B → V2C look-development sequence (V2C
HUMAN-approved) and adds the `/crix-handoff` skill. Next focus:
**P1 — Combat Visual Polish**. `HANDOVER.md` §0 stays the single source of
truth for status; this file records the closure and the next session's
boundaries. Trust `git` over any hash here.

## 1. Repository state (verified 2026-11-05T09:39Z)

| ref | commit | note |
|---|---|---|
| session branch `claude/pensive-cori-uhmg2d` | `d57e4ae` | this handover's commit follows it |
| canonical dev `claude/relaxed-faraday-swav9o` | `d4e9b85` | fast-forwarded to this handover's commit |
| `FRIX` (Pages, live build) | `56b10d7` | Pages run #287 success for `56b10d7` |

Undeployed build inputs on HEAD: none — `FRIX` lacks only documentation and
the skill (`d4e9b85`, `d57e4ae`, this commit); the live game is unchanged.
Working tree: clean. No background processes left running.

## 2. Completed this session

- **Visual Identity V2** (`?visualPilot=v2`) — evidence `bcd22e3`,
  `docs/evidence/visual-identity-v2/`.
- **V2B** (`?visualPilot=v2b`) — evidence `7a75e1e`,
  `docs/evidence/visual-identity-v2b/`.
- **V2C** (`?visualPilot=v2c`) — `62e8f53`…`56b10d7`,
  `docs/evidence/visual-identity-v2c/README.md` —
  **HUMAN-APPROVED / FROZEN 🔒** (§3).
- **`/crix-handoff` skill** — `d4e9b85`, `.claude/skills/crix-handoff/` —
  IMPLEMENTED (this file is its first use).
- **§0 record of the verdict and P1** — `d57e4ae`.

## 3. Latest HUMAN decisions (2026-11-05)

> "V2C is a pass." — approves the cumulative V2C package (V2 Mandalorian
> protagonist, V2 small green crawling swarmlings, V2B crates / consoles /
> machinery / relief / shadows, V2C Hangar ground) as the protected visual
> baseline.

> "Production default remains unchanged." — R1 stays the no-flags default;
> `?visualPilot=v2c` is the approved visual baseline, opt-in.

> "P1 is our next authorized milestone." — P1-A mobile banner readability and
> clipping; P1-B player Super-ready indicator; P1-C player weapon presentation;
> "opt-in, layered over V2C. The full implementation brief will be supplied in
> the new session."

Older verdicts: §0 and `docs/handover/CRIX-SESSION-HANDOVER-2026-11-04.md`.

## 4. Boundaries

| item | flag / where | status | authority |
|---|---|---|---|
| V2C package (hero, swarmlings, V2B objects, Hangar ground) | `?visualPilot=v2c`; `src/systems/visualPilot.js`, `vpPaint.js`, `vpHangar.js` | HUMAN-APPROVED / FROZEN 🔒 | "V2C is a pass", 2026-11-05 |
| V2 and V2B outputs | `?visualPilot=v2`, `?visualPilot=v2b` | historical comparison flags — must keep their existing outputs | HUMAN, 2026-11-05 |
| R1 production default (no flags) | `src/systems/debug.js` | HUMAN-APPROVED / FROZEN 🔒 — unchanged | §0 CURRENT STATUS |
| Promoting V2C (or P1) to the default | — | NOT AUTHORIZED | HUMAN, 2026-11-05 |
| P1-A banners (register #23) | `src/systems/HUD.js` `showBanner` | AUTHORIZED NEXT — scope from the brief | HUMAN, 2026-11-05 |
| P1-B Super-ready indicator (register #22) | `src/entities/Player.js` `superAura` | AUTHORIZED NEXT — scope from the brief | HUMAN, 2026-11-05 |
| P1-C player weapon presentation | — (brief) | AUTHORIZED NEXT — scope from the brief | HUMAN, 2026-11-05 |
| V2C to other arenas; hero detail; actor shadows | — | NOT AUTHORIZED | §0 |
| G1 planted-shot deadlock (register #6) | — | DEFERRED — live in R1, NOT AUTHORIZED | §0 |

Everything frozen in `CLAUDE.md` "Human gates" and §0 stays frozen.

## 5. Play it

- R1 (production, no flags): https://xletof.github.io/crix/
- V2C (approved visual baseline): https://xletof.github.io/crix/?visualPilot=v2c
- V2C combat demo: https://xletof.github.io/crix/?visualPilot=v2c&encdbg=swarmTide&room=hangar&sector=3

## 6. Defects and blockers

- Register #22 / #23 — now P1-B / P1-A (above).
- Register #6 (G1) — shipped in R1, deferred, not authorized.
- Register #9 — full suite 46/52 under R1, not green; not re-run this session.

## 7. Next session — P1 Combat Visual Polish

- **Authorized scope:** "P1 must be opt-in, layered over V2C. The full
  implementation brief will be supplied in the new session." Do not infer
  scope, flag names or design from this file — wait for the brief.
- **Open HUMAN questions for the brief:** the P1 flag name and how it combines
  with `?visualPilot=v2c`; whether P1-C may alter the frozen V2 hero texture or
  only add a separate weapon layer.
- **Read first, in order:** this file; `HANDOVER.md` §0 CURRENT STATUS
  (Visual Identity bullet) and register #21–#23;
  `docs/evidence/visual-identity-v2/README.md` "Known limitations" (the aura
  and banner observations); `docs/engineering/core.md` (HUD, controls, depth,
  combat text) and `environment.md` (the visual-pilot notes).
- **Guarding tests:** `tests/smoke-visual-pilot.mjs` — 108/108, recorded at
  `56b10d7` (`docs/evidence/visual-identity-v2c/smoke-visual-pilot.txt`); its
  `--old=<server>` mode proves earlier outputs unchanged. Also
  `smoke-readability`, `smoke-controls`, `smoke-title` (`tests/README.md`).
- **Suggested skills:** `/crix-handoff` to close the session.
- **NOT authorized:** changing any approved V2C design or the V2 / V2B
  outputs; promoting V2C or P1 to the default; gameplay, AI, collision, RNG,
  camera or encounter changes; G1; other arenas; editing `Enemy.js`,
  `pixelArt.js` or `rosterPaint.js` without the brief saying so.
- **Unfinished / uncommitted work:** none.

## Bootstrap — paste into a new Claude Code session

```text
You are continuing CRIX / FRIX (repo Xletof/crix; canonical dev branch
claude/relaxed-faraday-swav9o; Pages deploys only from FRIX →
https://xletof.github.io/crix/).

1. git fetch origin claude/relaxed-faraday-swav9o FRIX. Your branch must
   contain docs/handover/CRIX-SESSION-HANDOVER-2026-11-05.md from
   origin/claude/relaxed-faraday-swav9o: if `git merge-base --is-ancestor
   origin/claude/relaxed-faraday-swav9o HEAD` fails, run
   `git merge --ff-only origin/claude/relaxed-faraday-swav9o`; if that fails,
   stop and ask me.
2. Read docs/handover/CRIX-SESSION-HANDOVER-2026-11-05.md, then the CURRENT
   STATUS block and the UNRESOLVED-WORK REGISTER of HANDOVER.md §0 (grep the
   headings; do not read the whole file). CLAUDE.md loads automatically.
3. Next focus: P1 — Combat Visual Polish (P1-A banners, P1-B Super-ready
   indicator, P1-C player weapon presentation), opt-in, layered over V2C.
   Authorized scope: none beyond that yet — wait for my implementation brief.
4. Hold: V2C ("V2C is a pass") is HUMAN-APPROVED / FROZEN as the visual
   baseline; ?visualPilot=v2 and v2b keep their outputs; R1 stays the no-flags
   default; no gameplay, RNG, collision or camera change.

If this message carries no task brief, summarize the refs, the frozen
boundaries, the open candidates and the next focus, then STOP.
```
