# THE CHAMPION PROGRAM RESET — evidence

`HANDOVER.md` `§10af` is the record: both Champion candidates (INTERDICTOR,
HARROWER) are HUMAN-REJECTED, the post-mortem, the Champion doctrine that came
out of it, and the third candidate's concept.

**NOTHING IN THIS FOLDER IS WIRED INTO THE GAME.** `concept-captain.js` defines
`window.__paintCaptain` and is injected into a page by `shot-captain.mjs`. It is
not in `src/`, `pixelArt.js` does not export a `paintCaptain`, `PreloadScene`
does not know it exists and no scene can reach it. There is no `ShockCaptain.js`
and no runtime path of any kind. This is a picture, and the picture is waiting
on a human gate.

## The sheets

    npm run dev            # in one shell
    node docs/evidence/champion-reset/shot-captain.mjs <tag>

| folder | what it is |
|---|---|
| `v2-house-grammar/1x-row-labeled.png` | **the acceptance frame** — grunt / shooter / player / SHOCK CAPTAIN / Vader at 1x on the real hangar deck, one foot line, real HUD inset, real lighting |
| `v2-house-grammar/1x-row-clean.png` | the same frame with the labels off |
| `v2-house-grammar/1x-crowd.png` | the question a row cannot answer — can he be found inside an ordinary wave |
| `v2-house-grammar/poses.png` | twelve poses at 3x. **Art inspection only.** |
| `v1-rejected-bars/` | the FIRST concept, kept as the matched pair — stacked horizontal colour bands, no dome, no limbs, a floating pauldron and a rifle baked into the body sheet |

**1x IS THE ACCEPTANCE AUTHORITY.** The enlarged view exists to check pixels;
every question that decides whether this is a Champion — is it a person, is it
bigger than the rank and file, is it not Vader, can I find it in a fight — is
answered at the size it will be played at.

## What the rig hides, and what it does not

The objective terminal at (800, 700) is destroyed for the shutter and the crate
at (950, 900) is hidden. **Nothing else is.** The floor art, the baked plate
seams, the `EnvLight` emissive layer, the sector tint and the HUD's own 84px top
inset are all the live hangar. The camera is PLACED, not followed (the scene is
paused first, so the director cannot overwrite the scroll) — the matched-pair
rule from `§10y`.
