# Camera Phase 1 — evidence

Four frames, not an archive. Regenerate the full set with
`node tests/shot-camera.mjs` (needs `npm run dev`).

| file | what it shows |
|---|---|
| `detention-south.png` | THE ACCEPTANCE CASE. Player standing at the detention block's southern wall, resting at screen y ~888 against a topmost control edge of 926. On the build this replaces the same station put them at 1258 — under the move stick. |
| `detention-south-debug.png` | The same station with the tuning overlay (`?camdbg=1` / DEBUG → CAM DBG). Green = the gameplay-safe rectangle, whose bottom edge IS the topmost control. Amber box = the deadzone around the anchor cross. The player has been pushed out of the deadzone's low side by the framing clamp and is still comfortably inside the safe area, which is the designed behaviour at a wall. |
| `hangar-south.png` | The same case in a second room, and the clearest look at what the framing overscan costs: the south perimeter band terminates the room at screen y ~915 and everything below is the scene background, which is the control band. |
| `corridor-nw.png` | The north-west corner of the reactor junction — the overscan where it is NOT hidden by anything. A 120px black strip down the side is `CAMERA.padSide`, and it is the one padding value with a visible cost. |

`HANDOVER.md` §12 is the full record: the measured before/after at every wall
and corner of all four arenas, the derivation of the south padding, every tuning
value, and the traps.
