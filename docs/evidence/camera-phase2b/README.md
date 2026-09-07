# Camera Phase 2B — evidence

Five frames with the tuning overlay up (`?camdbg=1`). **Green** line = the
Phase 2A movement lead. **Amber** line = ability intent (darker amber once it is
a committed hold rather than a live preview). Green rectangle = the gameplay-safe
area, whose bottom edge is the topmost touch control.

| file | player screen | what it shows |
|---|---|---|
| `2b-neutral.png` | (360, 610) | Nothing armed, standing still. Ability weight 0 — Phase 2A's approved neutral, untouched. |
| `2b-super-east.png` | (160, 610) | Super preview aimed east. The player moves left in the frame and the eastern world opens. |
| `2b-conflict-moveW-aimE.png` | (160, 610) | **THE PRIORITY RULE.** Travelling WEST while aiming the Super EAST: the green movement lead points left, the amber ability lead points right, and the ability wins outright — the player sits at the same screen x as if they were standing still and aiming east. Blending the two would have produced a neutral frame that said nothing about either. |
| `2b-melee-commit.png` | (160, 610) | Eight frames AFTER the melee cast, with `meleeAiming` already false and 292ms of committed hold left. The telegraph is gone; the framing is not. |
| `2b-south-aim-north.png` | (360, 886) | **THE §13 REGRESSION CASE.** At the southern wall with an ability aiming NORTH — the one bearing that pushes the player down the screen. Screen y 886 against a control edge at 926: identical to Phase 2A. |

**Read the numbers from `tests/diag-camera-ability.mjs`, not from these frames.**
A paused shutter samples one frame; the rig measures settled composition and the
whole preview → cast → release sequence. `HANDOVER.md` §14 carries the tables.
