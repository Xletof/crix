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

---

## PHASE B.2.2 — pressure, deterioration, truth, and the first signature (`b22/`)

Four handset findings on the deployed B.2.1 build, plus the Arc Grenade.
`HANDOVER.md` `§10ai` is the record. **CANDIDATE — not approved.**

    npm run dev
    node tests/shot-captain-b22.mjs b22               # every frame below
    node tests/diag-damage-truth.mjs                  # the `0` bug, before and after
    node tests/diag-captain-pressure.mjs still|line|hold|reverse

| frame | what it shows |
|---|---|
| `01-healthy` | the reference: clean armour, stable visor, no smoke, no shorts |
| `02-armour-break` | the moment — and the damage number reading **2295**, where the shipped build printed 485 |
| `03-damaged-body` | the always-true mark: one asymmetric scorch on the side that lost its plate |
| `04-damaged-short` | a short circuit, held open for the shutter |
| `05-critical` | the second failure site, on the opposite flank, and near-continuous venting |
| `06-critical-short-to-rifle` | the one effect that says the WEAPON is compromised |
| `07-critical-visor-flicker` | the visor cannot hold |
| `08-critical-in-crowd` | **the restraint check** — still identifiable with six other bodies over the same square metre |
| `09-grenade-windup` | the `raise` pose, rifle dropped. The pose hooks painted in B.2, finally spent |
| `10-grenade-in-flight` | a real travelling object with altitude, its shadow on the deck, and the landing ring already drawn |
| `11-grenade-arming` | landed, not yet live: the charge ring contracting onto the casing |
| `12-arc-field-live` | the field, on a dark deck, under the DARKNESS modifier |
| `13-field-and-captain` | **the frame that carries the whole signature** — the player caught inside it and the Captain firing into the space it made |
| `14-arc-field-failing` | the last 520ms, visibly failing, so the player can spend it |
| `15-burst-three-leads` | three rounds in the air at once: ESTABLISH, LEAD, BRACKET as three different answers |
| `16`/`17`/`18-INSPECTION-x3-*` | **NOT THE REVIEW.** x3, for reading the shape of the scorch and the arcs while authoring them |

**THE x3 FRAMES ARE NAMED SO THEY CANNOT BE MISTAKEN FOR EVIDENCE.** `§10af`:
1x on a real arena floor is the acceptance authority, and an effect approved off
a zoomed frame is an effect nobody has seen. Everything numbered 01-15 is 1x.

**THE FIRST BUILD OF THE x3 STATIONS PHOTOGRAPHED EMPTY DECK.** A zoomed camera
does not transform like an unzoomed one — `scrollX` is the top-left in UNZOOMED
world units, so `(x - scrollX) * zoom` put the subject at (1080, 1878) on a
720x1280 page. After `centerOn` the subject IS the viewport centre, and the
viewport is inset by the HUD's top bar.

### `diag-captain-pressure` — and the three ways it lies

`<=48px` is "would have hit", and it is an ORDERING rather than an absolute:
closest approach is sampled at ~14fps against a 600px/s bolt, so the bolt jumps
~43px between samples and a stationary player — whom he cannot fail to hit —
measures a 44px median miss. The same noise is in every mode and in every build,
which is what keeps a before/after honest.

| player policy | before | after |
|---|---|---|
| standing still | 12/15 | 16/21 |
| holding a lateral direction (orbit) | **0/21** | **9/21** |
| holding a lateral direction (straight line) | — | **7/21** |
| reversing every 700ms | 2/12 | 5/21 |

It also cannot measure AIM through COVER — bolts died on crates a third of the
way out and rounds 2 and 3 appeared to over-lead by 180px, so it clears `walls`
— and a patrol that walks to the arena wall measures a RETREAT rather than a
strafe, because a 600px/s bolt chasing a 380px/s player never arrives however
well it was aimed.
