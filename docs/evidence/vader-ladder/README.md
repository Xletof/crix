# Vader encounter ladder — matched before/after

Produced by `node tests/diag-encounter.mjs --mode vader --repeats 2 --encounters 6 --spam 0`
(patient policy, upgrades on, 180s cap), the SAME instrument on both sides.

- `ladder-before.txt` — the shipped progression: `bossLadder` reverted to one
  mechanic per rung in registry order, `bossMechScale` all 1.0, the scripted-move
  retry narrowed to the guard, and the exotic clocks opening a full interval in.
  Everything else, including the decision tape itself, identical.
- `ladder-after.txt` — this branch.

The baseline was produced by patching those three behaviours back rather than by
checking out the old commit, because the old commit does not have the decision
tape and would have been a different instrument measuring a different thing.

## Reading these

**Fight length is noise.** The `runs:` line carries 27-102% spread here, and the
handover has it at 93% on an identical build. Nothing in these files sizes an hp
pool. What they are for is the two columns that are not noisy — **which
mechanics actually fired** and **how much of the fight was neither a question nor
a punish window**.

| enc | dead air before → after | mechanic firings before → after |
|---|---|---|
| 1 | 67% → 54% | **none at all** → sunder×2, reflect×1 |
| 2 | 46% → 43% | sunder×2 → sunder×5, blackout×2, reflect×2, super caught |
| 3 | 49% → 46% | sunder×4, reflect×2, super caught → sunder×3, afterimages, blackout, reflect |
| 4 | 62% → 38% | sunder×1 → sunder, afterimages, **disarm**, blackout |
| 5 | 57% → 46% | **none at all** → sunder, afterimages |
| 6 | 55% → 46% | sunder×1 → sunder, blackout, afterimages, **disarm** |

Encounter 1 before this change fired zero mechanics across a whole fight. That
is the measured form of "the interesting version unlocks three encounters
later".

**One instrument caveat these two files were produced under.** `--repeats 2` has
no exact median, so the per-rung detail lines came from `runs[0]` rather than
from the run the headline duration describes. It applies identically to both
sides, so the comparison stands. `diag-encounter.mjs` now picks the run NEAREST
the median instead; a re-run will line the two up.
