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

---

## PHASE B.2 — the combatant gate (`b2/`)

The visual gate passed; `HANDOVER.md` `§10ag` is the record. These are RUNTIME
frames at 1x, not sprite strips — an animation approved off a zoomed sheet is an
animation nobody has actually seen.

    npm run dev            # in one shell
    node tests/shot-captain.mjs b2

| frame | what it shows |
|---|---|
| `01-idle-in-crowd` | the breathing idle inside an ordinary wave — findability |
| `02-walk` / `03-strafe` | locomotion: the forward cycle, and the lateral step that is NOT it |
| `04-brace` / `05-fire` / `06-recoil` | the burst as an arc the shoulder performs |
| `11-muzzle-flash` | the flash caught with the tween clock frozen, at the barrel |
| `07-heavy-hit` | a real blow staggers; chip fire does not |
| `08-armour-break` / `09-damaged-state` | the layer breaking, and the persistent damaged body |
| `10-damaged-in-crowd` | the damaged silhouette still findable in a fight |
| `12-intact-vs-broken` | the matched pair — the claim is about a DIFFERENCE |

The arena is quieted at every station and ONLY the arena: the drip and other
enemies' fire are off, because a trooper bolt crossing the frame and a damage
number over the subject are not evidence about the subject. The Captain's body,
pose, facing, weapon and FX are whatever the live code produces.

---

## PHASE B.2.1 — combat personality (`b21/`)

The combatant foundation is human-approved and frozen; `HANDOVER.md` `§10ah` is
the record. This pass adds the STATE LANGUAGE, on one rule:

> **SYMBOL = TRANSITION. BODY / FX = SUSTAINED STATE.**

    npm run dev
    node tests/shot-captain.mjs b21        # frames
    node tests/diag-captain.mjs crossfire hangar   # the loop, measured

| frame | what it shows |
|---|---|
| `07-major-hit` | a blow big enough to move him — the same threshold the stagger uses |
| `08-armour-break` | the moment: ring, shards, discharge, flinch, `#!` |
| `13-low-health-moment` | `#?!`, beside the damage number rather than under it |
| `14` / `14b-low-health-sustained` | **the claim of the whole layer** — the symbol is gone and the body still says damaged |
| `15-reaction-in-crowd` | and it survives the clutter it has to live in |
| `*-crop` | the same 1x pixels cut to the square the reaction happens in — nothing is scaled |

**THE CROPS ARE NOT ZOOMS.** The full portrait frame stays the acceptance
authority; a crop exists because judging a six-pixel ember by squinting at a
720x1280 screenshot is how a sustained state gets approved while being invisible.

`14` and `14b` are half a second apart on purpose: the sustained half is
intermittent by design, so a single shutter can land between vents and report a
working effect as absent.
