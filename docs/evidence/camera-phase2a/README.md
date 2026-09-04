# Camera Phase 2A — evidence

Four frames with the tuning overlay up (`?camdbg=1`). The green line running
from the player is the movement lead; the green rectangle is the gameplay-safe
area, whose bottom edge IS the topmost touch control.

| file | what it shows |
|---|---|
| `2a-neutral.png` | Standing still. Player at screen (360, 611) with zero lead — Phase 1's approved neutral composition, unchanged. The lead is driven by movement intent, so it costs nothing at rest. |
| `2a-east.png` | Travelling east. The player moves left in the frame and the world ahead of them opens. |
| `2a-west.png` | Travelling west. The mirror. |
| `2a-south-east.png` | **THE §15 CASE.** Travelling east along the southern wall with the lead fully open at 220px. The player sits far left with the eastern half of the room ahead of them, and still at screen y 878 against a control edge at 926 — the Phase 1 south win is intact. They sit BELOW the deadzone box because the framing clamp owns composition at a wall, which is the designed behaviour. |

**Read the numbers from `tests/diag-camera-lateral.mjs`, not from these frames.**
A paused shutter samples one frame including whatever transient it lands in; the
rig averages a settled window and excludes frames where the framing clamp is
active. `HANDOVER.md` §13 carries the measured A/B table.
