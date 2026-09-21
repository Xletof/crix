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

---

## THE COMBAT-ECONOMY AUDIT — an instrument, not a balance pass (`captel/`)

`HANDOVER.md` `§10aj`. **Nothing was balanced.** B.2.3 polish is paused until
the human brings back handset runs.

    npm run dev
    node tests/smoke-captel.mjs     # 22 structural checks, no balance assertions
    node tests/shot-captel.mjs      # the two panel states, at 1x

Play it at **`?champdbg=1&captel=1`**.

| frame | what it shows |
|---|---|
| `01-live-ticker` | the fight, with the one-liner — and `2 CAPTAINS — tracking 1`, which the encounter overlay's own `CHAMP SHOCK CAPTAIN x2` confirms |
| `02-summary-card` | the card after he dies: clear of the harness buttons above it and the touch controls below |

**THE CARD'S TOP IS DERIVED, NOT PICKED.** The first build sat at camera y 116 —
screen 200 — and printed straight through the encounter harness's PREV / NEXT /
REPLAY buttons, because the Game camera is inset by the HUD's top bar and a
screen coordinate is therefore not a camera one.

---

## S1 — survivability, footwork, armour identity (`s1/`)

`HANDOVER.md` `§10ak`. **CANDIDATE — not approved.** Nothing here was decided by
a bot: four human handset runs produced the diagnosis, and the harness had
called him comfortable while a human erased him in 4.7 seconds.

    npm run dev
    node tests/smoke-captain-step.mjs    # 24 structural checks, no TTK assertions
    node tests/shot-captain-s1.mjs       # the frames below

Play it at **`?champdbg=1&captel=1`**.

| frame | what it shows |
|---|---|
| `01-step-plant` | **the beat that makes it footwork** — planted in the brace body, weight set |
| `02-step-travel` | the strafe cycle and the blue impulse he pushed off from |
| `03-step-settle` | back into a combat posture, firing resumes |
| `04-absorb-light` | a pistol round: the small localized response |
| `05-absorb-heavy` | a Super pellet from the side — on the plate that met it, not at his centre |
| `06-absorb-volley` | five pellets in one frame, on five plates, capped at four |
| `07-armour-overload` | **the absorption language FAILING** — this is the break |
| `08-after-break` | and the grammar has changed, because the layer is gone |
| `09-INSPECTION-x3-absorb` | **NOT THE REVIEW.** x3, for reading the shape while authoring it |

**THE STEP IS PHOTOGRAPHED AS A SEQUENCE ON PURPOSE.** A single frame of a body
in motion is indistinguishable from a body sliding; plant, travel and settle
next to each other is the only way to see that it is footwork rather than a
Harrower skateboard.

**THE THRUST WAS INVISIBLE IN THE FIRST BUILD OF THIS RIG.** `_stepThrust`
builds a Graphics whose `_tick` closure does the drawing, and `_tick` does not
run until the next `preUpdate` — so pausing on the frame the impulse is created
photographs an empty object. Same trap that cost B.2.1 a whole reaction sheet.

## CORE FEEL — the step as a chain, the body as a base, the burst as one decision (`cf/`)

    npm run dev
    node tests/shot-captain-cf.mjs       # the video and the frames below

Play it at **`?champdbg=1&captel=1`**. `HANDOVER.md` `§10al`.

**`captain-core-feel-1x.webm` IS THE EVIDENCE AND THE STILLS ARE ITS INDEX.**
§33/§34 of the brief are explicit: a step and a weight transfer are MOTION, the
review is at gameplay speed, and it must not be run against a vertical-pixel
threshold. Twenty-two seconds of real combat at 1x with nothing forced — the
player is driven on a simple lateral-then-close policy and every step, burst
length and spray shape in the footage was chosen by the real solvers.

| frame | what it shows |
|---|---|
| `01-plant-preload` | weight set in the brace body, and the suit already answering — the preload RISES into the launch rather than fading |
| `02-pushoff` | five thrust strands at the ORIGIN he is leaving, plus the flat deck scuff at the launch foot |
| `03-travel` | the strafe cycle, and at most two short echoes — never a trail |
| `04-catch` | **the frame that did not exist before this pass** — widest stance on the sheet, torso down into the legs, a low flat ring on the deck |
| `05-settle` | back into a combat posture |
| `06-base-brace-crop` | the firing base is SET |
| `07-base-fire-crop` | and it does not move — the shot is in the rifle and the shoulders |
| `08-base-recoil-crop` | nor here |
| `09-base-settle-crop` | the between-rounds correction, which is what keeps a six-round burst from being one pose looped |

**READ 06-09 AT THE FEET.** The whole claim of the animation half is that the
stance widens to shoot and then holds through brace, fire, recoil and settle —
so the one thing in a burst that does not move is the thing standing on the
deck, and everything above it reads as absorbed rather than bounced.

**AND THE BIGGEST CAUSE OF THE BOUNCE IS NOT VISIBLE IN ANY FRAME.**
`Enemy.preUpdate` squashed the whole sprite on a sine while `_staggerMs` ran —
set on EVERY hit — and shrank it 12% while `recoilT` ran, which `_fireRound` was
setting on EVERY round. A still cannot show a rubber sprite. The fix is a pair
of tunable depths whose defaults are the shipped numbers, so no other actor
moved; see `CLAUDE.md` and `§10al`.

### CF.2 — the closeout refinement

Handset play on CF.1 approved the step, the durability and the agility; two
narrow defects were left, and both are visible in this folder's video.

**THE SPRAY.** Four shapes became ONE MONOTONIC SWEEP with one free choice —
which side it starts on. `outward` and `sweepback` were **non-monotonic by
construction** (0.5 → 0.75 → 0.25 → 1 → 0, and out-and-back respectively) and
were 44% of bursts. `smoke-captain-rifle` projects every round of a burst onto
its own corridor axis and walks the projections in firing order: **−159px of
backward travel on the shipped build, ≥ −8px now.** That check was A/B'd against
`5e0ef94` and fails on it, which is what makes it a check rather than decoration.

**THE FIRING PUMP.** `bob` was already zero for every firing pose, and the
handset still saw it. The cause was `lean` — "along the facing axis", which for a
Captain who AIMS AT THE PLAYER is screen-vertical in the common front and back
views. Measured from the sheet's own silhouette, brace / fire / recoil / settle:

    helmet crown   12  8  12   ->   12  12  12  12
    boot sole     111 111 111  ->  111 111 111 111

The rig prints those rows and asserts nothing about them: §29 is explicit that
zero vertical movement is the wrong target, and a stiff Captain is a worse
failure than a bouncy one. **Read 07/08/09 for where the motion went** — the
rifle retracts, the arm travels seven pixels laterally, the shoulder moves one,
and the head and the boots do not move at all.

### `diag-captain-pressure` — five policies, and they are a contract

    node tests/diag-captain-pressure.mjs <still|line|reverse|stepstop|dash> 30

`still` and `line` should be PUNISHED, `reverse` and `dash` EFFECTIVE, and
`stepstop` — the old exploit, where a small step and a stop parked the player in
the uncovered gap between the establish shot and the lead — should no longer
reliably solve a whole burst. **READ THE ORDERING BETWEEN POLICIES, NEVER THE
ABSOLUTES**: closest approach is sampled on `postupdate` at ~10fps against a
600px/s bolt, so a stationary player measures a ~44px median miss on a build
that cannot fail to hit them.

Measured on this build, 30-second runs, staged inside the engagement band —
**rounds landing within 48px of the player**, which at this sample rate is
"would have hit":

| policy | inside 48px | verdict |
|---|---|---|
| `still` | **30 / 33 — 91%** | punished hardest, as §26 requires |
| `stepstop` | 14 / 36 — 39% | **the old exploit is gone**; it used to be the safe answer |
| `line` | 6 / 24 — 25% | pressured, and see the confound below |
| `reverse` | 1 / 33 — 3% | changing your mind after the commitment works |
| `dash` | **0 / 29 — 0%** | and dashing out of the corridor works completely |

Re-run after CF.2 — the ORDERING is what the contract requires, not the
percentages: `still` **93%**, `stepstop` **26%**, `line` **18%** (56% inside
96px), `reverse` **6%**, `dash` **0%**. `stepstop` and `line` both fell, because
a monotonic sweep puts fewer rounds near the middle of a corridor than `outward`
did. Neither was re-tuned: changing the corridor geometry in the same pass that
simplified the spray would make the next handset verdict unreadable.

**AND `line` CARRIES A CONFOUND THE RIG PRINTS FOR YOU.** It re-derives a
perpendicular bearing every 440px of travel to stay inside the engagement band,
which at 380px/s is a reversal roughly every 1.4s — against a ~1.3s flight time,
so more than half of its bolts have a rig-imposed reversal in the air. Under the
corridor law a reversal invalidates the whole commitment BY DESIGN, so `line`
systematically understates the danger of genuinely holding a direction.

**THIS RIG FOUND A REAL BUG IN THE FIRST CUT OF THE CORRIDOR LAW.** Sized as
"0.7 seconds of their travel, starting where they are", the corridor sat behind
a player the rounds take 1.3s to reach: `line` measured 3 of 21 rounds inside
48px, which is continuing being the SAFE answer — the exact failure B.2.2
existed to fix. The corridor is anchored to the burst's own arrival window now.

## THE VISUAL FINISH — damage in the model, a field with a source (`vf/`)

    npm run dev
    node tests/shot-captain-dmg.mjs     # the damage matrix
    node tests/shot-arcfield.mjs        # the device and its field

Play it at **`?champdbg=1&captel=1`**. `HANDOVER.md` `§10am`.

**`00-MATRIX-state-x-facing.png` IS THE DAMAGE ACCEPTANCE FRAME.** Three
authored body states across four facings on one canvas — because §16 asks a
COMPARISON ("can I tell intact from broken from critical at 1×") and a human
cannot make it by flipping between twelve files. It is drawn in the page from
the twelve crops, so it needs no image library on the box.

**AND IT IS WHAT CAUGHT THE REAL PROBLEM.** The first cut of CRITICAL added only
one- and two-pixel features inside the silhouette and the matrix came back with
BROKEN and CRITICAL as two indistinguishable dark Captains. What fixed it was
`SpriteSheet.cut` — `clearRect`, so pixels leave the OUTLINE rather than being
darkened inside it — plus one step of value off the whole plate ladder.

| frame | what it shows |
|---|---|
| `0/1/2-*-front/back/east/west` | the twelve cells of the matrix, individually |
| `3-broken-walk/strafe/fire/brace` | §7 — the damage survives the animation families the approved work lives in |
| `4-critical-firing-short` | critical, mid-burst, with the electrical failure live |
| `5-INSPECTION-x3-*` | **NOT THE REVIEW.** For reading the shapes while authoring them |

**READ THE PAULDRON SIDE ACROSS A ROW.** The bone command pauldron is
screen-LEFT in front view and screen-RIGHT in back view — it is the same
shoulder and he has turned round. That mirroring is the whole claim: the old
build derived its damage point from `flipX` alone and wore it at the same screen
offset whichever way he was looking.

### The Arc Grenade

| frame | what it shows |
|---|---|
| `10-device-in-flight` | the device IS the projectile — tumbling, inert, one charging spark |
| `11-landed-core-powers-up` | it lands, squashes, locks, and the core comes on |
| `12-nodes-establish` | the projector nodes placed one at a time, each by a visible beam |
| `13-perimeter-closes` | the boundary closing between them — complete at 74% of `armMs`, before the hazard is live |
| `14-field-active` / `-wide` | eight true circular arcs on the real radius, eight nodes, one restrained wash |
| `15-player-inside` | and the floor is still readable under it |
| `16-player-on-the-edge` | **§27** — the player's centre on the painted line, which is exactly where `contains()` turns over |
| `17-shutdown` | connections gone, perimeter opening, nodes retracting, core last |
| `18-HIERARCHY-captain-field-enemies` | **§26** — a broken Captain, his live field, two ordinary enemies and the player in one frame |

**THE ACTIVATION CANNOT BE APPROVED FROM ONE SCREENSHOT**, which is why there
are five of it. Each station throws a FRESH grenade: the first version of the
rig walked one grenade's whole life, pausing and resuming through it, and timed
out — the arming beat is 520ms and at this harness's ~12fps its first third is
barely two frames, which a resume-from-pause delta steps clean over.
