# Phase B — Champion integration pilot (CANDIDATE, not human-approved)

`node tests/shot-champion-placement.mjs [A|B|C]` — 1x, 720x1280, the live game
reached through the same `?encdbg` URLs the handset uses (`HANDOVER.md` §10at).

- `A-vanguard-captain-*` — sector 8, hangar, wave 2, the authored placement
- `B-vanguard-baseline-*` — the same cell with `&nochamp=1`
- `C-crossfire-captain-*` — sector 16, hangar, wave 3

Frames: 1 entry, 2 dense, 3 Captain firing (burst) / B: front, 4 tactical
step, 5 Arc Grenade live, 6 late (half the rank and file removed).

**READ THESE AS DIAGNOSTIC ONLY.** The player is invulnerable and never
shoots, so every wave collapses onto them and the frames show a surrounded
player, not a front being broken or flanked. They show WHAT the encounter puts
on screen — bodies, bolts, the field — and nothing about how it plays. The
room modifier is nulled in all three so they differ only in the encounter.
Full-speed handset play is the authority.
