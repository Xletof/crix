---
paths:
  - "src/systems/CameraDirector.js"
  - "tests/*camera*.mjs"
---
# Camera (frozen)

The camera is HUMAN-APPROVED and FROZEN after six handset passes; every `CAMERA`
value in `src/config.js` is a verdict. Behaviour and tuning change only on an
explicit human instruction backed by new play evidence. Reference:
`docs/engineering/camera.md` (final state: `HANDOVER.md` §21).

- `CameraDirector` is the only scroll author. Never add `startFollow`,
  `setFollowOffset` or `cameras.main.setBounds`; keep `physics.world.setBounds`
  exactly the room. `smoke-camera` fails on a second author.
- Gaze (presence) and guardrail (preservation) are separate terms with separate
  filters, caps and gates. Never merge them.
- The boss need is measured against the player-intent focus, never against
  `cam.scrollX` — that is the anti-oscillation guarantee.
- `leadY` is 0 by construction; the south padding derives from the live
  control layout. X and Y asymmetry is the approved result.
- Rigs mutate tuning through `director.cfg`, not a dynamic config import.
