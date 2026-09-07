# Camera Phase 2C — evidence

Four frames with the tuning overlay up (`?camdbg=1`). The three player-intent
tiers each have their own colour: **green** = Phase 2A movement lead,
**cyan** = ordinary combat intent (its length IS confidence),
**amber** = explicit Super/melee intent.

| file | player screen x | confidence | what it shows |
|---|---|---|---|
| `2c-fire-east.png` | 220 | 0.91 | Six taps east, standing still. The cyan lead has built and the east is open — but the player sits at 220, not the 160 an explicit Super preview commands. Ordinary fire is useful, not authoritative. |
| `2c-retreat-west-fire-east.png` | 275 | 0.91 | **THE CASE THE PASS EXISTS FOR.** Dodging WEST while firing EAST: the green movement lead points west, the cyan combat lead points east, and the player sits left of neutral with the fight in view. Movement-only composition left 201px of east view; this is 445. The westward dodge still shows in the green residue — it is a blend, not a replacement. |
| `2c-alternating.png` | 355 | 0.13 | Eight shots alternating east/west — enemies on both sides. The evidence cancels: confidence collapses to 0.13 and the frame stays within a pixel of neutral. This is the target-switch ping-pong the design forbids, not happening. |
| `2c-ability-overrides.png` | 523 | 0.51 (overridden) | Ordinary east-fire memory still live at 0.51, then a Super aimed WEST. The amber lead wins outright (ability weight 0.99) and the frame goes west. When it ends the memory has decayed on its own clock, so nothing snaps back — measured, no step above 29px. |

**Read the numbers from `tests/diag-camera-aim.mjs`, not from these frames.** It
measures the signal (combat vector, confidence, release time) across all ten
cases; a paused shutter samples one frame. `HANDOVER.md` §15 carries the tables.
