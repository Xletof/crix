# VANGUARD screen — old vs new (CANDIDATE, not human-approved)

`node tests/shot-vanguard-screen.mjs [B-old|B-new|A-old|A-new]` — 1x, 720x1280,
hangar sector 8 wave 2, seed 4242, room modifier nulled. `HANDOVER.md` §10au.

- `B-*` — matched VANGUARD without the Captain (`&nochamp=1`)
- `A-*` — VANGUARD + Captain
- `*-old` — `&noscreen=1`: the stock Shielded branch, the behaviour played on `5a97fd4`
- `*-new` — the VANGUARD screen

Frames: 1 entry, 2 advancing, 3 settled, 4 close lateral strafe, 5 dash,
6 the tail — everything but two Shieldeds removed, player re-planted on open
floor, Super EMPTY (zeroed, never precharged), shields polled until stopped.

Measured shield distances from the player (rig log):

| | settled | tail |
|---|---|---|
| B-old | 274-290 | 282 / 285 |
| B-new | 131-140 | 128 / 138 |
| A-old | 274-288 | 283 / 288 |
| A-new | 128-140 | 134 / 138 |

**Diagnostic only.** The player is invulnerable and scripted and never shoots,
so frames 4 and 5 show the line re-closing after the player moved, not a fight.
Visible in `B-new-6`: the two surviving screens converge on nearly the same
spot and overlap — nothing separates them. Reported, not changed.
