# Engineering references

Subsystem knowledge for agents and maintainers: each file opens with the
system's status and its invariants, then a **trap ledger** — how it works, how it
has broken, and why it is the way it is. Nothing here loads automatically.
Path-scoped rules in `.claude/rules/` point an agent at the right file when it
touches matching code; otherwise open what the task needs.

| file | covers | main source |
|---|---|---|
| [`core.md`](core.md) | projectiles and hitboxes, damage events and combat text, MoveScript / Telegraph / actor ownership, controls and HUD, depth, audio, upgrades, nemesis contact | `Bullet.js`, `FX.js`, `MoveScript.js`, `Telegraph.js`, `controlLayout.js`, `HUD.js` |
| [`camera.md`](camera.md) | the frozen camera's semantic model and tuning traps | `CameraDirector.js`, `CAMERA` in `config.js` |
| [`vader.md`](vader.md) | the frozen boss: ladder, DEFLECTION, saber ownership, returned super, LIGHTS OUT | `Boss.js`, `bossMoves.js` |
| [`enemies.md`](enemies.md) | ordinary roster, Bulwark field, Demolisher, stuck detection, Marksman T1 / Bulwark T2 seams | `Enemy.js` (frozen), `bulwark*.js`, `marksman*.js`, `firingSpot.js`, `NavGrid.js` |
| [`champion.md`](champion.md) | Champion doctrine, the frozen Shock Captain, Arc Grenade, hazards, rejected candidates | `ShockCaptain.js`, `Champion.js`, `Harrower.js`, `Hazard.js` |
| [`encounters.md`](encounters.md) | wave composition, Champion placement, VANGUARD, `?encdbg` harness | `encounters.js`, `GameScene._resolveEncounter` |
| [`environment.md`](environment.md) | the four frozen arenas, EnvLight, colour rules, pixel shape language | `rooms.js`, `EnvLight.js`, `consoleKit.js`, `pixelArt.js` |
| [`testing.md`](testing.md) | running and trusting the harness, background processes | `tests/` |

## Where else knowledge lives

- **Current state, approvals, open work:** `HANDOVER.md` §0 (the CURRENT STATUS
  block and the UNRESOLVED-WORK REGISTER). Status written in these references is
  a convenience; §0 wins on conflict.
- **History of each phase:** `HANDOVER.md` §1–§21 and §10a–§10aw. It is ~600 KB —
  grep for the section, never read it whole.
- **Measurements, films, candidate notes:** `docs/evidence/<phase>/`.
- **Cross-session handover snapshots:** `docs/handover/` (dated; newest first).
- **Harness reference:** `tests/README.md` (per-suite purpose and failure modes).

## Notes

- Source and test comments written before 2026-11-02 say "see CLAUDE.md" for a
  trap. That trap is now in one of the files above; grep `docs/engineering/` for
  the phrase the comment quotes.
- Keep a reference current when you change its subsystem: fix or annotate the
  entry (`> **Status (date):** …`) instead of appending a contradicting one, and
  do not copy state that belongs in `HANDOVER.md` §0.
