# VANGUARD reinforcement — `d3766eb` vs one guaranteed later shield (CANDIDATE)

`node tests/shot-vanguard-reinforce.mjs [oldBase]` — OLD served from a `d3766eb`
git worktree on :5174 (there is no debug switch for this change), NEW on :5173.
Seed 1, chosen because the OLD build's slot 5 rolled a grunt there. Hangar
sector 8 wave 2, VANGUARD + Captain, modifier nulled, player invulnerable and
planted; the rig kills the opening pair by hand once the Captain arrives, in
place of the player breaking the front.

| | OLD queue | NEW queue |
|---|---|---|
| | s s CAPTAIN s shooter **grunt** s shooter | s s CAPTAIN s shooter **SHIELD** s shooter |

Rig log, living shields after the opening pair is dead:

| frame | OLD | NEW |
|---|---|---|
| 4 slot-5 event arrives | 1 shield, 2 exposed | 2 shields, 1 exposed |
| 5 opening gone, mid-fight | 2 shields, 2 exposed | 3 shields, 1 exposed |
| 6 late fight | 2 shields, 3 exposed | 3 shields, 2 exposed |

`surge-*`: a terminal surge fired while the front HOLDS. At the frame its bodies
have landed: surge drew `shielded, shooter, shooter` from fill, the authored
queue is identical, the front is still holding, and no Captain is on the floor.

**Framing caveat:** the planted player stands 620px from the gate and the
fight mostly happens at the east edge of frame, so the counts above carry the
comparison better than the pictures. Diagnostic only — handset play decides.
