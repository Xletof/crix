# P1 — Combat Visual Polish (`?visualPilot=v2c&polish=p1`)

> **HUMAN verdict 2026-11-05 (handset): P1-A mobile banners — PASS; P1-B
> Super-ready indicator — PASS; P1-C player weapons — PASS. All three are
> HUMAN-APPROVED / FROZEN as the accepted P1 presentation over V2C — opt-in,
> not the default (R1 stays production).** `HANDOVER.md` §0 is the record. The
> status line and the reservations below are as delivered.

**Status: CANDIDATE — opt-in, presentation only, awaiting the HUMAN handset
verdict. Not a default; not approved; nothing frozen.** Three components the
HUMAN accepts or rejects independently, delivered as one candidate layered over
the approved V2C presentation:

- **P1-A** — mobile banner readability and clipping (register #23)
- **P1-B** — the player's Super-ready indicator (register #22)
- **P1-C** — the player's weapon presentation

V2C (`?visualPilot=v2c`) is unchanged and remains the approved, frozen visual
baseline; R1 (no flags) remains production; `?visualPilot=v2` and `v2b` keep
their outputs. All of it is proven against the V2C build `56b10d7`
(`smoke-polish-p1.txt`, section 8).

## Play it (GitHub Pages, deployed from `FRIX`)

| | link |
|---|---|
| **V2C — approved baseline** | https://xletof.github.io/crix/?visualPilot=v2c |
| **P1 — this candidate** | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1 |
| P1 combat demo — SWARM TIDE in the Hangar, sector 3 (banners, pistol, Super) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&encdbg=swarmTide&room=hangar&sector=3 |
| …the same under V2C, for the side-by-side | https://xletof.github.io/crix/?visualPilot=v2c&encdbg=swarmTide&room=hangar&sector=3 |
| P1 banners under a nemesis duel (the duel block + attack callouts) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&duel=1&nodlg=1 |
| P1 boss sector (SECTOR 10 — DARK LORD, then SURVIVE THE SWARM) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&encdbg=1&room=vader&sector=10&nodlg=1 |

The Super charges from hits as always (4 hits; a hit streak charges it
faster). The rifle is the DC-15 pickup in the Hangar. The melee is the sword
button (3 hits to charge, then up to three chained casts — the third is the
finisher flip).

`polish=p1` is honoured ONLY with `visualPilot=v2c`: on its own, or with `v2` /
`v2b`, it is ignored and the game is exactly that mode (the P1 weapons are drawn
for the V2 protagonist, so they are never combined with another hero).

---

## P1-A — Banner readability

### What was wrong

`HUD.showBanner` picked its size from the **character count** — 60px up to 14
characters, otherwise 34px — and never measured what it drew. Orbitron is a
wide face, the stroke adds 8px, and the exit tween grows the text to **1.16x**
while it fades. Measured at that widest box, on the 720px canvas:

| string | shipped box (x) | |
|---|---|---|
| SUPPORT: SHIELD CHARGED & BACTA VIAL | −144 … 864 | cut at both edges, at rest too |
| ARENA SURVIVED — FINISH THEM! | −31 … 751 | cut |
| SLICE TERMINALS FOR SUPPORT | −22 … 742 | cut (the human's recording) |
| CHAMBER CLEAR (13 chars → 60px) | 0 … 720 | edge to edge |
| SURGE INCOMING | 11 … 709 | |

Also found, and fixed under P1:

- **The pause button** (top-right, r 30, drawn above the banner) sits inside
  the banner's band: any wide line lost its last letters under it
  (`banners/ab-banner-slice-rest.png`, A).
- **The sector sign's directive** "MOVE TO NEXT SECTOR" (690px) was wider than
  its own 664px plate, and its arrival slam (scaleX 1.14) stretched the plate to
  −20 … 740 — off the canvas for the first quarter-second.
- **A banner raised while the sign is up is drawn BEHIND the sign's plate**
  (both sit at y ≈ 150).
- **Same-frame overlaps.** A multikill emits its banner and its streak splash in
  the same frame; the splash's lane test read the banner's alpha, which is
  still 0 in that frame, so `x12!` printed into `MULTIKILL`
  (`smoke-polish-p1`: "MULTIKILL + x12 … A: overlaps").
- **A stale exit tween.** The shipped banner never kills its own tweens, so a
  banner arriving within ~1.5s of the previous one is faded early by the
  previous one's exit (filmed: `⚠ DETECTED` disappears early in A).

### What P1-A changes

`systems/p1Banner.js`, installed on the HUD instance (`installBannerPolish`;
the HUD prototype is untouched and nothing is installed without the flag).

- **Every line is measured** (the canvas's own advance plus the stroke) and
  fitted so that the **largest box the animation ever draws** — the exit
  tween's 1.16x, plus an ink allowance — stays **24px inside** the canvas.
- **A type scale keeps the hierarchy instead of a length switch:**
  HERO ≤ 14 characters, one line, 60px (fitted down to no less than 46);
  CALLOUT, one line up to 44px while it holds 36; STACK, anything longer,
  **two balanced lines** up to 42px (phrase breaks after `:` / `—` preferred,
  a line never starts with a dash). Short callouts stay as loud as before
  (SECTOR 3, FRENZY, WAVE 1, MULTIKILL, ⚠ DETECTED: still 60px); mid-length
  callouts get **bigger** than the old 34px; instructions are composed, not
  shrunk (SLICE TERMINALS / FOR SUPPORT at 42px, against 34px on one clipped
  line).
- **The pause button is an obstacle:** a banner whose band crosses its rows is
  fitted to a symmetric width that ends 8px short of it.
- **Lanes are placed by the box at its peak.** A two-line banner moves down by
  what it gained (its top edge never rises above the shipped one-line top); under
  a duel it clears the duel block; while the sector sign is up it sits below the
  sign; the combo splash and the medal line step below a live banner (live =
  from the call until its exit ends, not "alpha > 0").
- **The sector sign:** directive fitted inside the plate (46 → 41px), the
  after-action line fitted too, the arrival slam capped at scaleX 1.06 (the
  plate's widest is 44 … 676).
- **The medal / trait lane** (e.g. `SUPPRESSED — he takes the power, not the
  gun`) is fitted the same way, on two lines if it must be.
- **Unchanged:** every word (a line break is the only change — asserted), every
  event, delay, duration and ease (the alpha timeline of every banner is A's
  tick for tick — asserted), the colours, the stroke, the depth, hitstop,
  scoring, combo rules, wave pacing, the touch controls and the camera. The one
  deliberate timing change, P1 only: a new banner kills the previous banner's
  tweens, so it always gets its full display.

### Evidence

`banners/` — every case on the full 720px canvas framed in magenta (anything
cut by the frame is cut on the phone), A (V2C) left, B (P1) right:

| file | case |
|---|---|
| `ab-banner-<case>-rest.png` | the held pose (pop finished): sector, slice, detected, frenzy, waveclear, chamber, finish, support, darklord, vader |
| `ab-banner-<case>-peak.png` | the exit tween's end geometry (1.16x) forced to full alpha — the widest the text is ever drawn |
| `ab-banner-combo.png`, `-combo-stack.png` | banner + streak splash fired together |
| `ab-banner-duel.png`, `-duel-long.png` | a nemesis duel block + an attack callout / a long banner |
| `ab-banner-sign-slam.png`, `-sign.png` | the sector sign arriving / held (a real open exit) |
| `ab-banner-sign-banner.png`, `-sign-medal.png` | a banner, splash and medal while the sign is up |
| `ab-banner-medal.png`, `-wave-medal.png` | the medal lane, long trait line; WAVE CLEAR + FLAWLESS |
| `phone/ab-phone-*.png` | slice, support, combo, sign, a fight with FRENZY — on a 390x844 portrait viewport (the canvas at ~0.54x, as a phone shows it) |

**Is clipping genuinely resolved?** Yes, for every string the game can emit —
57 strings: every quoted string inside every `show-banner` call in the
source (ternaries and continuation lines included) plus the dynamic ones
(SECTOR n, SECTOR 100 — DARK LORD, VADER — WOUND n, `<pickup>: TAKE ONE`,
modifier names, long nemesis names) at their widest. Each is run through the
**real tweens tick by tick**, and its widest box stays ≥ 24px inside the
canvas and never crosses the pause button (game coordinates: the canvas is
FIT-scaled whole, so this holds on every handset shape). The **rendered ink**
of the seven widest strings — a pixel diff, banner on vs off, at the forced
peak — lies within x ≈ 98 … 626 at 720x1280 **and** on a 360x780 portrait
viewport. The same checks run on A **fail** (6 strings drawn past the canvas, 16 past the margin or under the pause button; 4 of 7 inked to the canvas edge) — they catch the
shipped bug rather than pass on it.

---

## P1-B — Super-ready indicator

### What was wrong

From the first hit of charge, the Super drew a **red-orange (0xff4020) filled
disc and rings** under the hero, growing with the charge and pulsing at full.
That is the colour family of every enemy threat ring and telegraph: in a crowd
the hero read as one more threat (`super/super-A.png`, panel 12: his ring and
the swarm's rings are the same red).

### What P1-B changes — read by shape and motion first, colour second

`systems/p1Player.js` (a POST_UPDATE reader; `Player.js` untouched):

| state | P1 |
|---|---|
| not charged | nothing (the cyan "you are here" ring, unchanged) |
| charging | a quiet **segmented gauge** on the ground ring — six thin steel-blue arc segments, no fill, lit clockwise from the top as the meter fills; it does not move |
| ready | the segments **lock**: thicker, ice-white, with six **violet-blue pawls** in the gaps pointing out, and the whole ring **turns slowly** (42°/s) — the only rotating thing in the game that belongs to the hero. Every 1.1s the pawls **kick outward once** (a mechanical beat, not a glow pulse). On the frame it becomes ready, one white **ping** ring expands and fades (320ms). His weapon swaps to its `-hot` variant (P1-C) |
| Super fired | the ring **snaps outward** and fades (180ms) |
| suppressed (Vader) with a full meter | the ring stays, dim (≤ 0.35) and still — the Super exists but is offline; the weapon is not `-hot` |
| in a bush | 0.3 of its alpha, like the shipped aura |
| dead | hidden |

No disc and no fill; no red or orange. It is distinct from the **cyan positional
ring** (a soft filled circle, inside it), the **shield** (a filled cyan bubble
drawn over him — the pawls stand outside it, `super/super-B.png` panel 9), enemy
rings (red, filled) and his own Super shot (a red slug).

**Is it unmistakable?** In the crowd frame (`super-B.png` panel 12;
`phone/ab-phone-fight-ready.png`) the white segmented ring and violet pawls
separate the hero from the swarm's red rings where the shipped aura merged with
them. At phone size the pawls are ~5px: the read is the ring's shape and its
turning, and that needs the handset to judge.

---

## P1-C — Player weapon presentation

### What was wrong

The V2 hero carried the previous generation's overlays: flat imperial-grey
strips with **no outline** (on the gunmetal deck the pistol read as a grey
line), **no hand** (the gun hovered beside him), a rifle that was the pistol's
strip made longer, and a blade whose dark hilt stub disappeared behind its glow.
The overlay was centred so far out that the pistol's muzzle sat 12px past the
bolt's spawn point and the rifle's 24px past it.

### What P1-C changes

New namespaced textures (`systems/p1Paint.js`; the shipped `wpn-*` painters are
untouched and keep painting for every other mode), in the V2 hero's own
language: 4px grain, his dilated one-pixel `#06070a` outline, north-west sun,
**gunmetal** bodies a step darker and bluer than his beskar (so a weapon
separates from the armour it crosses), beskar highlights, his tan leather.

| | |
|---|---|
| **pistol** (13x10) | compact slab-sided blaster: stepped slide, front and rear sights, shrouded barrel, ringed emitter, a raked leather grip **in his black glove with a beskar vambrace cuff**, one **cyan power cell** (his visor glint's colour) |
| **rifle** (18x10) | longer, deeper and heavier: skeletal stock with a beskar butt-plate, a deep receiver, a magazine hanging below, a scope with a cyan lens, a finned barrel and a muzzle brake; the trigger hand **and the support hand** on the fore-grip |
| **blade** (24x10, the shipped canvas and pivot) | his fist round a wrapped grip, swept beskar quillons, a dark emitter collar with a cyan gem, a crisper energy blade: a bright leading edge, a white core line, an even taper |
| `-hot` variants | while the Super is ready: the cell / lens white-hot and the top edge lit — the weapon joins the Super-ready read |

**The hold.** The hand comes **with** the weapon, so whichever of his four
painted directions the body shows, the gun is held. The weapon stays on the
**aim ray** exactly as the shipped overlay did — the bore on the line from his
centre along the aim (asserted < 0.01px in every pose) — so the bolt, which
gameplay spawns at `PLAYER.radius + 12` = 34px along that ray, leaves the
barrel's front: the pistol's muzzle face is at 42px (shipped 46px) and the
rifle's at 48px (shipped 58px) against the bolt's 34px — asserted nearer than
the shipped overlays. The texture's bore sits on its
middle row so a west-facing (flipped) gun keeps it. Recoil, flip, the
behind-the-body depth when facing north, the melee swing offsets and the
blade's pivot are the shipped rules, read from the same fields.

**Do they look physically connected?** In profile and on the diagonals, yes —
the glove and cuff sit where his painted forward hand is, and the stock of the
rifle sits at his shoulder (`weapons/sheet-AB.png`). Facing straight down
(south) a gun on the aim ray runs down his centre line over the belly and legs
while his painted arms hang at his sides; it reads as a two-handed low carry,
not a hand-held gun. That is the trade for keeping the barrel on the bolt's
line (moving it to a hand would put the bolt beside the gun). Facing north the
gun is behind him, as before.

---

## Integrated combat

`film/ab-fight-phone-size.mp4` (A | B at phone size, 30fps, 16s) and
`film/p1-fight-540.mp4` (B alone): one seeded SWARM TIDE fight in the Hangar,
**state-checked A vs B at every one of 480 ticks** (player, every enemy, bullet
count, RNG draws) — the same fight in both. The hero fires the pistol; his Super
becomes ready (tick 150) and stays ready through the swarm; SLICE TERMINALS FOR
SUPPORT lands (160), FRENZY (260); the Super is fired (300); he picks up the
rifle (330) and fires it to the end. Key frames: `film/ab-0040.png`, `-0176`,
`-0230`, `-0302`, `-0410`.

---

## Technical implementation

| file | what |
|---|---|
| `src/systems/debug.js` | `setPolish` / `isPolishP1()` — `polish=p1` AND `visualPilot=v2c` |
| `src/systems/p1Banner.js` | P1-A: measuring, the type scale, two-line composition, lanes, the sign |
| `src/systems/p1Paint.js` | P1-C: the five `p1-*` textures (no `Math.random`) |
| `src/systems/p1Player.js` | P1-B + P1-C: the indicator and the weapon layer (POST_UPDATE reader) |
| `src/systems/HUD.js` | one call: `installBannerPolish(this)` |
| `src/scenes/GameScene.js` | one call: `installPlayerPolish(this)` after the Player is built |
| `src/scenes/PreloadScene.js` | one call: `paintPolishP1(this)` |

Not touched: `entities/` (Player.js included), `config.js`, `data/`,
`pixelArt.js`, `rosterPaint.js`, the V2/V2B/V2C painters and seams
(`vpPaint.js`, `vpHangar.js`, `visualPilot.js`), the camera, light, AI seams,
nav, `controlLayout.js` (section 7).

One author per object: under P1 the shipped `weaponSprite` and `superAura`
keep being driven by Player exactly as before but are never drawn (the weapon
is hidden by `visible`, which Player never writes; the aura, which Player
re-shows every frame it has charge, is re-hidden each POST_UPDATE before
render). P1 draws its own: one Image and four Graphics built once.

## Validation

### Focused tests (this container, the final code)

| suite | result | what it covers |
|---|---|---|
| `smoke-polish-p1 --old=<56b10d7>` | **82/82** (`smoke-polish-p1.txt`) | the flag; textures (B = every A texture byte-identical + exactly five `p1-*`; ignored `polish=p1` adds nothing to R1 / V2 / V2B); install (four HUD methods, one POST_UPDATE + one `player-fire-super` + one shutdown listener; HUD event delivery and touch input as A); banners (above, with controls that fail on A); the Super-ready cycle, no per-frame redraw or allocation, no leak over 3 restarts + quit-to-title; weapons (texture per state, bore on the ray, muzzle face, every bolt at A's position and bearing over 8 bearings x pistol / rifle / Super); seeded replays B vs A — SWARM TIDE (production, legacy) and BOMBER RUN, 1,500 headless ticks with pistol, rifle, 2 Supers and 2 melee chains, and 500 rendered — identical state and `Math.random` draws at every tick; R1 / V2 / V2B + ignored `polish=p1` identical to their own modes; frozen files unchanged against `56b10d7` (Player.js included) and the Enemy.js guard; the previous build: R1, V2, V2B and V2C textures and fights identical to `56b10d7`, and B's fight identical to `56b10d7`'s V2C; restart and reload keep the mode |
| `smoke-polish-p1 --selftest` | **SELFTEST OK** (`selftest.txt`) | a `Math.random` draw in the P1 hook, a 1px bolt shift and the unfitted banner, injected in B: sections 3, 5 and 6 fail as they must |
| `smoke-visual-pilot --old=<56b10d7>` | **108/108** (`smoke-visual-pilot.txt`) | R1 / V2 / V2B / V2C as before: textures, bodies, backdrop draws, replays, LIGHTS OUT, the previous build |
| `smoke-restart` | PASS 16 | restarts leave no duplicate handlers (HUD and Game) |
| `smoke-controls` | PASS | the control editor moves the real hit regions |
| `smoke-title` | PASS 15 | |
| `smoke-debug` | PASS | debug menu and HUD stay in sync |
| `smoke-score` | PASS 41 | kills, chain multiplier (the streak splash) and wave bonuses (the medal lane) |
| `smoke-duel` | PASS 20 | the duel HUD |
| `smoke-readability` | PASS 19 | |
| `npm run build` | passes (the usual >500 kB chunk warning) | |

The covering suites run the shipped game (R1 and pinned baselines), where P1 is
absent: they prove the three install calls change nothing there. The full
`run-all` was not re-run; it stands at **46/52 under R1** (register #9 —
camera, champion-placement, vanguard-screen, vanguard-reinforce, deflect,
readability under a full run; readability passes standalone, above). Nothing in
P1 reaches those suites' code paths without the flag.

### Performance (`perf.txt`, `node tests/diag-polish-p1-perf.mjs`)

HEADLESS CHROMIUM ON A SOFTWARE RASTERISER — A vs B on the same box; not a
phone's absolute numbers.

| metric | A (V2C) | B (V2C + P1) |
|---|---|---|
| one-time paint of the five `p1-*` textures | — | ~2 ms |
| texture memory | 68,563,636 B (168) | +55,040 B (+5 textures) |
| Game display list at rest / in a fight | 111 / 172 | 116 / 177 (+5: the weapon and four indicator Graphics, built once) |
| rendered `game.step`, median (600 ticks, Super ready throughout, a banner every 2s) | 7.0 ms | 7.4 ms |
| time inside the P1 player hook | — | 0.016 ms / frame |
| one `showBanner` call, median / p95 | 1.9 / 12.3 ms | 4.1 / 17.5 ms |
| live tweens at the end of the fight | 5 | 5 |

- The indicator allocates nothing per frame: its Graphics are drawn once and
  then only moved, rotated, scaled and faded; the charging gauge is redrawn only
  when its 1/48 step changes (0 redraws over 60 ticks at a held charge —
  asserted). No `Math.random`.
- The banner fitter plans every trial size on a private 2D context and applies
  the result with ONE `setFontSize` (Phaser's MeasureText) as the shipped path
  does. A first version that resized the Text for each trial cost 14.1 ms per
  call; this one 4.1 ms (two-line strings render more stroke). A banner lands a
  few times a minute.
- Frame-time medians differ by less than the box's noise; the p95 is dominated
  by the software rasteriser's spikes in both halves.

## Known limitations

- **Facing south the weapon runs down his centre line** (above): honest to the
  bolt's origin, less convincing as a one-handed hold than the profile views.
- **The Super button in the HUD still glows red-orange when ready**
  (`COLORS.superReady`, the touch widget). P1-B changes the indicator on the
  hero only; the button is a touch control and was not in the brief.
- **The duel bar runs under the pause button** (x 48…672 vs the button at
  646…706, y 122…136): a shipped overlap in the duel HUD, untouched by P1-A
  (banners clear both). Recorded, not changed.
- Banner type sizes are smaller than the shipped 60px for a few 11–14 character
  callouts that cross the pause button's rows (CHAMBER CLEAR 60 → 44px, SURGE
  INCOMING → 46px, WAVE CLEAR! → 55px): containment and the button won.
- The ready ring's pawls are small at phone size (~5px); judged on headless
  renders, not a handset.
- Mid-length callouts (15–20 characters) are now larger than before (44px
  against 34px) and span more of the upper play area while they show.

## HUMAN review questions

1. **P1-A:** do the two-line compositions (SLICE TERMINALS / FOR SUPPORT) read
   as one deliberate announcement at a glance? Are 44px mid-length callouts too
   loud over the fight?
2. **P1-A:** banners now stack *below* the sector sign while it is up, rather
   than being hidden behind it — acceptable placement, or should a banner wait
   for the sign?
3. **P1-B:** at phone size, does the turning white ring with violet pawls say
   "your Super is ready" — and never "threat"? Is the charging gauge useful or
   noise?
4. **P1-B:** should the HUD Super button's red-orange ready glow follow the new
   colour language (a separate, small change)?
5. **P1-C:** do the pistol and rifle look held, and the rifle clearly heavier?
   Is the south-facing centre-line carry acceptable?
6. **P1-C:** the blade — is the new hilt / fist / quillon read worth it, or is
   the shipped blade's energy preferred?
7. Accept / reject per component: P1-A, P1-B, P1-C.
