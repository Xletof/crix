# Champions and the Shock Captain — reference

**Status:** Shock Captain V1 is **HUMAN-APPROVED / FROZEN 🔒** — `6560c62` is the
final approved implementation and `HANDOVER.md` §0 carries the contract. He sets
the quality bar and tier philosophy for Champion work and is not an ability
template. No variants, colourways, second signature or Nemesis replacement.
The **Interdictor** (§10ad) and **Harrower** (§10ae) are **HUMAN-REJECTED ❌** as
combatants — do not tune them; their technology (`Hazard.js`, `?champdbg`, the
smokes) stays. Normal Endless spawns neither. Elite hierarchy and
Commander/Lieutenant planning are unblocked but not started.

## Doctrine for any new Champion

- A Champion is a character, not a device: bipedal, humanoid, armed, a combatant
  from the first build. Apply the deletion test — remove the actor, keep the
  effect; if the fight barely changes it is a hazard wearing a healthbar.
- Visual/fantasy gate first: no entity file, move, test or deploy until a human
  approves a concept sheet at 1x gameplay scale on a real arena floor beside the
  grunt, shooter, player and Vader.
- Movement must read as decision (approach, hesitate, commit, reposition);
  "percentage of time moving" is not evidence of presence.
- Human handset combat is the balance authority; the bot is not. Measure how a
  real player kills it, then place it in the hierarchy, then choose the
  survivability mechanism — hp last.
- A Champion may never read the player's attack input (`superAiming`,
  `superAim`, `superCharge`, `player-fire-super`, pellets in flight). Prove it by
  grep and by firing real Supers.
- No banner: the model, wind-up and effect must explain the move
  (`?nonames=1`).
- Symbol = transition, body/FX = sustained state. A glyph lingers a few hundred
  ms; a lingering glyph is a status icon.

---

## Trap ledger

Entries under the headings below were migrated from the root `CLAUDE.md` as it stood at `7d67bed` (`git show 7d67bed:CLAUDE.md`), keeping their wording. Anything since superseded carries a **Status (2026-11-02)** note rather than being silently rewritten.

### Doctrine: lessons from the two rejected candidates

- **THE INTERDICTOR IS HUMAN-REJECTED ❌ — `HANDOVER.md` §10ad.** Handset play
  called it almost stationary, dead to one Super, far too slow and too weak to
  be an interesting ordinary enemy: **a hazard carrier, not an elite
  combatant.** DO NOT TUNE IT — not hp, not speed, not damage, not cooldowns,
  not the beam, not more purple. The problem is not in the numbers, and four of
  the seven causes were checkable with arithmetic: it STOPS at `holdRange` by
  construction, PURGE's 240px trigger sits inside a 430px hold so it could
  almost never fire (zero casts in 32s, measured), and 1400hp is 0.47 of ONE
  Super's 3000 raw damage. **I also froze one of those errors into a passing
  check** — `smoke-champion` asserts the Champion is the slowest thing on the
  floor. A test that pins a mistake is worse than no test.
  The TECHNOLOGY is sound and reusable: `Hazard.js`, the `?champdbg` harness,
  `smoke-champion`'s structure and the cancelled-handle fix all stay. Its honest
  future is an EMPLACEMENT — a terminal-defence turret or a deployable — where
  `holdRange` stops being a bug. Normal Endless never spawns it — no
  encounter pool entry, no `_rollEnemyType` branch, no chance roll, and
  `PLACEABLE_CHAMPIONS` names only the Captain — and Nemesis is still
  untouched.

- **THE HARROWER IS HUMAN-REJECTED ❌ TOO — `HANDOVER.md` §10ae.** Handset
  play: *"the first was a stationary bot and now this one looks like a sliding
  skateboard bot."* DO NOT TUNE IT — not speed, not the pass planner, not the
  wake, not `bankPunish`. `?champdbg=1` still spawns it and
  `?champdbg=interdictor` the other one; **normal Endless spawns neither.** Its
  honest future is a light vehicle or an environmental moving hazard, not a
  combatant. The TECHNOLOGY is sound and stays: `Hazard.js`, the pass planner's
  window trimming, the displacement-measured watchdog, `smoke-harrower`.

- **BOTH CHAMPIONS FAILED ON CATEGORY, NOT ON NUMBERS, AND THE CAUSE IS ONE
  LINE: I DESIGNED A MECHANIC AND THEN LOOKED FOR A BODY TO PUT IT IN.**
  `HANDOVER.md` §10af is the two-candidate post-mortem and the doctrine.
  Opposite theses — one that never moves, one that never stops — rejected in
  the same word, *bot*. In both, the content was on the FLOOR and the actor was
  its emitter; the body was then drawn to make the floor effect plausible,
  which is how a Champion became an emplacement and then a craft. Apply the
  DELETION TEST at design time: remove the actor and keep the effect — if the
  fight barely changes, it is a hazard wearing a healthbar.

- **A CHAMPION IS A CHARACTER, NOT A DEVICE — bipedal, humanoid, armed, and a
  COMBATANT FROM THE FIRST BUILD.** Phase B.1 shipped four verbs and no attacks
  on the theory that movement had to stand alone; a thing that cannot shoot
  back cannot demonstrate that it is an opponent. The minimum viable Champion
  is not the minimum viable MECHANIC. **The zone-control requirement is
  DROPPED** — it was an invented constraint and it produced both failures.

- **MOVEMENT MUST READ AS DECISION, AND "PERCENTAGE OF THE FIGHT IN MOTION" IS
  NOT EVIDENCE OF PRESENCE.** `diag-harrower` measured 81% moving, 8 passes per
  44s, worst stationary interval under 435ms — every bar cleared, actor
  rejected. Constant-speed translation along a pre-validated line is what a
  vehicle does, however fast. Approach, hesitate, commit, reposition is what a
  person does.

- **THE VISUAL / FANTASY GATE COMES FIRST, AND 1x IS THE ACCEPTANCE
  AUTHORITY.** No entity file, no move, no test, no deploy for any Champion
  until a human has approved a concept sheet at GAMEPLAY SCALE on a real arena
  floor, beside the grunt, the shooter, the player and Vader. The enlarged view
  is art inspection only. Two full implementations died at a handset on a
  question that costs one picture to answer. **The IMPERIAL SHOCK CAPTAIN
  PASSED that gate** — `HANDOVER.md` §10ag — and only then got a runtime.

- **A CHAMPION IS NOT A HAZARD WITH HP.** Position, movement, BASELINE THREAT,
  signature pressure, response to the player closing or retreating, survival and
  a vulnerability window have to form ONE loop. The first candidate had two of
  those seven and shipped anyway, because every piece was individually
  defensible and nothing asked whether they added up to a fight. A hazard placed
  by a stationary actor belongs to the FLOOR, not to the enemy.

- **A CHAMPION GETS NO BANNER, AND THAT IS A QUALITY DECISION.** Vader's moves
  announce themselves by name; a Champion's must not. The claim is that the
  model, the wind-up and the effect explain the mechanic on their own — a move
  that only reads because its name is printed across the screen has
  communicated nothing, which is exactly what `?nonames=1` exists to ask.

### Shock Captain V1 — contract, durability and balance

- **SHOCK CAPTAIN V1 IS COMPLETE — HUMAN-APPROVED AND FROZEN 🔒 — THE
  REFERENCE CHAMPION. `6560c62` IS THE FINAL APPROVED IMPLEMENTATION.**
  `HANDOVER.md` §0 carries the whole frozen contract; do not restate it here.
  Everything he is — the silhouette (helmet dome + crest, narrow luminous
  visor, ONE asymmetric bone pauldron, reinforced chest, kama, separated legs,
  compact back pack, two-handed rifle), the 112x120 hierarchy, the walk and
  strafe cycles, the 300-520 band, 3400 + 1900 = 5300 with `armourTake` 0.85 /
  `armourSpill` 0.55 and NO Super resistance, the variable 3-6 corridor rifle,
  the tactical step's mechanics AND visuals, the Arc Grenade's gameplay AND
  presentation, the INTACT / BROKEN / CRITICAL damage model and the ICE
  punctuation — is closed on handset play. **Do not polish him again.** The
  notes below are how he works and how he breaks; **none of them is an
  invitation to tune him**, and nothing reopens without NEW human play
  evidence. He sets the QUALITY BAR and TIER PHILOSOPHY for Champion work —
  above ordinary enemies, a combatant not a device, humanoid and readable,
  tactically mobile, aggressive but fair, below Vader — and is NOT an ability
  template to copy. Still NO variants, NO colourways, NO second signature, NO
  Nemesis replacement. His PRODUCTION PLACEMENT is a separate layer, also
  HUMAN-APPROVED / FROZEN 🔒 as Phase B on `a3563a4` (see the next bullet); the Elite hierarchy and Commander planning are
  unblocked by his closure and NOT started. The phase names that run
  through the notes below (B.2.1, B.2.2, S1, CF.1/CF.2, §10am-§10as) are the
  HISTORY of how he got here, not open candidates.

- **THE STATE LANGUAGE'S ONE RULE SURVIVED HANDSET REVIEW AND ITS SUSTAINED
  HALF DID NOT — `HANDOVER.md` §10ah, §10ai.** **SYMBOL = TRANSITION, BODY / FX
  = SUSTAINED STATE.** A glyph lives a few hundred ms to say something CHANGED
  and is then gone; everything that must stay true is carried by the actor. **A
  glyph that lingers is a status icon, and a status icon is UI standing in the
  world.** Four glyphs, no more: armour break, low health, major hit, target
  reacquire. **IT IS NOT A PHASE SYSTEM** — nothing in it touches fire rate,
  speed, damage or the state machine, and `smoke-captain-state` measures a fresh
  and a badly damaged Captain and pins identical speed, damage and median burst
  gap. (Phase B.2.2, §10ai, is history now — see the V1 freeze.)

- **DO NOT BALANCE THE CAPTAIN AGAINST THE WORD "SUPER" — `HANDOVER.md` §10aj.**
  "He survives two or three Supers" only means something if a Super is scarce,
  and in real play it can be used about once a second, which makes it closer to
  high-power secondary fire than to an ultimate. B.2.3 polish was PAUSED until
  the human brought back A/B/C runs from `?champdbg=1&captel=1` (they did; S1
  and §10am followed). The ORDER is the lesson and it travels: measure how
  fast and by what means a real player kills him, then decide where Champion
  sits in the hierarchy, then choose a survivability mechanism. **HP COMES
  LAST.**

- **HUMAN HANDSET COMBAT IS THE BALANCE AUTHORITY, AND THE BOT IS NOT.** The
  harness called the Shock Captain comfortable while a human erased him in
  **4.7 seconds** — it plays materially slower and uses the Super far less
  aggressively than a person. Never write "the bot says TTK is 11.3s, therefore
  approved". Automated probes may verify step geometry, cooldowns, layer
  arithmetic and cleanup; they may NOT hold an opinion about how long a fight
  should last, and no smoke test in `§10ak` asserts a TTK.

- **THE CAPTAIN IS NOT GENERALLY UNDER-DURABLE — HE IS SPECIFICALLY TOO EASY TO
  ERASE UNDER CONCENTRATED SUPER PRESSURE, `HANDOVER.md` §10ak.** The same
  actor completed 9 of 10 bursts and threw 3 grenades over ~25s against a player
  who refused the Super, and 1 burst and zero grenades against one who did not.
  **S1 is durability 4400 → 5300 (almost all BODY), a tactical step, and an
  armour identity — and deliberately NO Super resistance**, so the handset can
  say whether those two were enough. Do not add a Super multiplier, pellet
  reduction, burst resistance, per-hit cap, damage gate, armour recharge or
  immunity window; S2 reopens that only on evidence that S1 was not enough.

- **PUT DURABILITY IN THE BODY, NOT IN THE LAYER.** The armour break is the
  player's reward and has to stay reachable inside ONE committed Super — a
  pellet removes 510 armour at `armourTake`, so 1900 falls to four connecting
  pellets. Inflating the layer produces "I used several Supers and only finally
  got through his shield", which is worse than the problem it solves.

- **A CHAMPION MAY NEVER READ THE PLAYER'S ATTACK INPUT.** The tactical step is
  triggered by combat RELATIONSHIPS that were true before the player decided
  anything — crowded, blocked, post-burst, exploiting its own field — and never
  by `superAiming`, `superAim`, `superCharge`, `player-fire-super` or a pellet
  in flight. A body that sidestepped the button press is an unloseable coin flip
  wearing the costume of skill. Prove it TWICE: grep the actor for every
  identifier that could express the state (it cannot branch on what it cannot
  name), and fire real Supers at it while asserting no step follows a cast.

- **THE PLANT IS WHAT MAKES A STEP FOOTWORK.** Without it the body simply
  acquires velocity, which is the sliding read both rejected Champions died of.
  90ms planted (70 before CF.1) in the brace body, then the travel on the STRAFE cycle — the
  existing lateral gait, and the only one whose feet agree with sideways
  movement. And move it with VELOCITY, never a tween or a teleport, so the wall
  collider stays underneath and a wrong destination costs a stop rather than a
  body inside a console. Validate the destination with `_hasLOS` — the same
  arithmetic his firing already trusts — rather than building a second planner.

- **A CAP ON AN EFFECT WILL BE FULL AT THE MOMENT THAT EFFECT MATTERS MOST.**
  The absorption cap exists so a five-pellet Super is not five blooms; the
  armour BREAK is caused by a heavy volley almost by definition, so the cap was
  full on the exact frame the overload wanted to draw and it rendered NOTHING.
  The one response that must never be suppressed is exempt, and it clears the
  in-flight ones first.

- **ONE AUTHOR PER HIT.** The `enemy-hit` handler fires a generic amber impact
  ring at the body CENTRE for any high-hp enemy. On an actor that answers a hit
  AT THE CONTACT POINT that is two authors for one event, and the generic one
  pulls the eye off the localized response carrying the meaning. It is
  suppressed when the actor speaks for itself — identified by the B.2.2 feedback
  claim, so every ordinary elite is untouched.

### Damage presentation, state and punctuation

- **DAMAGE BELONGS TO THE BODY, AND `_site()` IS THE SHAPE OF GETTING IT
  WRONG.** It returned a point from `flipX` ALONE — so a Captain facing you, a
  Captain walking away and a Captain in profile all wore their scorch, their
  smoke vent and their electrical short at the SAME SCREEN OFFSET. The damage
  did not turn when he turned, which is what a handset means by "sticker". The
  persistent marks are painted into THREE AUTHORED SHEETS now (intact / broken /
  critical, 57 frames each, per facing) and the dynamic FX run from
  `CAPTAIN_DAMAGE_ANCHORS` — declared in the SHEET'S OWN PIXELS beside the
  painter that draws the hole, converted through the sprite's LIVE
  `displayWidth`. Same rule as `CONSOLE_KIT`: a hand-written world offset is one
  edit away from venting smoke out of a shoulder that has moved.

- **ONE DAMAGE HISTORY TOLD FOUR TIMES, NOT FOUR SKINS.** The command pauldron
  took the hit, so `dmgX` is that side as a sign and every piece of damage reads
  it — screen-left in front view, screen-right in back view (the same shoulder;
  he has turned round), nearest in profile. CRITICAL is the SAME wound wider,
  never a second theme.

- **`SpriteSheet.cut` EXISTS BECAUSE A DARK FILL IS NOT A HOLE.** Filling a
  region dark changes what is INSIDE the outline; a missing piece of armour has
  to change the OUTLINE. MEASURED ON THE ACCEPTANCE MATRIX: the first cut of
  CRITICAL added only one- and two-pixel features inside the silhouette and came
  back as two indistinguishable dark Captains at 1x. `clearRect`, so the deck
  shows through. And critical drops the whole plate ladder ONE STEP OF VALUE on
  top of that geometry — scorched unpowered hardware really is darker, and a
  step of value is the only cue that survives a glance at 112px.

- **A STATE-CHANGE TEXTURE SWAP MUST KEEP THE POSE.** `_setBodyState` changes
  only the animation PREFIX and re-seats the same frame index, so a Captain
  whose armour breaks mid-stride keeps his cycle. Snapping back to frame 0 of an
  idle on the frame the armour goes would throw away the approved animation work
  to a texture swap.

- **A CONTACT SHEET IS THE ONLY HONEST ACCEPTANCE FRAME FOR A STATE LADDER.**
  "Can I tell intact from broken from critical at 1x" is a COMPARISON and a
  human cannot make it by flipping between twelve files. `shot-captain-dmg`
  draws three states x four facings onto one canvas IN THE PAGE, which needs no
  image library on the box — and that frame is what caught CRITICAL being
  indistinguishable from BROKEN.

- **IF REAL DURABILITY DECREASED, THE FEEDBACK MAY NOT SAY ZERO.** `Enemy.damage`
  emits `enemy-hit` with the number it was asked to take off the BODY, and on an
  actor with a layer in FRONT of the body that number is zero — so a Shock
  Captain whose armour bar was visibly draining printed `0 0 0` over his own
  head, and a human caught it on a handset. It was never a rendering nit: the
  game was telling the player their shots did nothing at the moment it was
  taking their damage. The same defect printed `485` for a Super that removed
  2285 and `4000` for a killing blow that removed 210 — **the figure was always
  BODY damage.** `_damageFeedback(bodyRemoved)` is the hook, it returns ONE
  number (armour removed + body removed) and a colour, and it is **opt-in by
  absence**: null means the handler falls back to `amount`, so every ordinary
  enemy is untouched. Never print two overlapping labels for one hit — the
  break FX is what says a layer transition happened.

- **`amount` IS A REQUEST; `hpBefore - hp` IS A REMOVAL.** A killing blow asks
  for more than the pool holds and a punish window multiplies on the way in, so
  any label built from the argument is wrong at both ends. Measure across the
  subtraction.

- **SYMMETRICAL, ROUND, COLOURED AND PULSING IS THE VOCABULARY OF A STATUS
  LIGHT, WHATEVER YOU MEANT BY IT.** B.2.1's two orange embers were the right
  INSTINCT — something must be true in every frame or a still and a glance both
  catch nothing — and the wrong FORM, and the handset decoded them as equipment
  indicators rather than as damage. The replacement keeps the instinct: ONE
  ASYMMETRIC failure site on the side that actually lost its plate, a second on
  the opposite flank only at critical, an always-true dark SCORCH (three
  overlapping discs at unequal offsets, NORMAL-blended so it takes light away,
  and it **does not pulse** — a burn does not breathe), and blue-white shorts
  that are **entirely event-driven**, 130ms at a re-rolled interval so they
  never find a rhythm. A continuous arc is the opposite of unstable.

- **EVERY REACTION READS AUTHORITATIVE STATE, AND THE MAJOR HIT REUSES THE
  STAGGER THRESHOLD.** Armour from `armour` crossing zero, low health from the
  body pool crossing `lowHealthFrac` DOWNWARD, the major hit from
  `staggerMinDamage` — there is no second definition of "a big hit" and no
  parallel state kept only for effects. A killing blow announces NOTHING: a
  corpse does not say it is hurt, and the glyph queued by the same hit goes
  with it. Discovered because a probe killed its own subject.

- **EVERY EVENT-BASED EFFECT IS INVISIBLE MOST OF THE TIME, WHICH IS WHY THE
  CAPTAIN CARRIES EMBERS.** The first low-health build was a puff every ~1.2s, a
  spark every ~2s and a 90ms visor flicker, and it photographed as an
  UNDAMAGED Captain — a still frame, and a player glancing at him, catch none of
  them. `_drawEmbers` is the one mark that is ALWAYS TRUE: two small pulsing
  embers, breathing rather than blinking. **If the glyph is the only thing that
  ever said "damaged", the damage was UI.**

- **`smokeTrail` IS THE MISSILE TRAIL AND IS THE WRONG EMITTER FOR A DAMAGED
  BODY.** `missileSmoke` is `#3a3a44` at 0.45 alpha for 420ms — DARKER than the
  `#212328` deck — and it works only because a missile lays dozens along a path.
  One on a body is a dark speck. `fx.ventSmoke` / the `damageSmoke` emitter is
  lighter than the deck, lives 1100ms and drifts upward. Its tint and alpha were
  set by MEASURING against the deck value, not picked: at 0.5 over `#76767f` the
  emitter was provably running and the effect was provably invisible.

- **A PARTICLE EMITTER DEFAULTS TO DEPTH 0, UNDER THE WHOLE ACTOR BAND.** So
  smoke emitted at a body's shoulder is drawn BEHIND that body and is invisible
  exactly where it matters. `damageSmoke` sits at 1900 — above the band, below
  `DEPTH.AIR` — which is the same flat-constant debt the draw-order note
  already records, not a new convention.

- **PUNCTUATION IS SEQUENCED, NEVER SIMULTANEOUS.** A Super over-committed into
  a full-armour Captain breaks the layer AND crosses the health line in the same
  call; two glyphs in one frame is soup and neither reads. `punctSpacingMs` is
  the floor and the second simply waits. The queue is **DATA ticked on the
  actor's own `_clock` in `preUpdate`, never `time.delayedCall`** — so there is
  nothing to cancel on death, nothing that can fire into a destroyed scene, and
  a paused scene cannot advance it.

- **A GLYPH GOES OFF THE CENTRELINE AND CLEAR OF THE VISOR.** `fx.damageNumber`
  spawns at `(x, y - 40)` and rises straight up, and the frame that causes a
  reaction is exactly the frame that prints a number — so a mark over the helmet
  shares a column with every hit label. And the visor is the fastest
  identification on the body: nothing may crowd it, which is why the third
  low-health ember was removed.

- **A GLYPH'S STROKES ARE SPACED FOR ITS OWN OUTLINE.** It must read on a hangar
  deck, a dark cell wall and a muzzle flash, so it carries a black surround —
  and with 2px gaps that surround MERGES and the glyph photographs as a dark
  slab with bone shapes cut out of it. Two-pixel bars, three-pixel gaps,
  single-pixel crossbars. **They are ICE now — not bone, not violet** — see
  the punctuation register below.

- **TARGET REACQUIRE WAS MEASURED BEFORE IT WAS BUILT.** In a real CROSSFIRE and
  VANGUARD the Captain holds line of sight ~85% of frames and loses it about
  twice per 22s for 0.5-3.4s, and in 21-34 of those frames he was READY TO FIRE
  AND COULD NOT — a real engagement relationship, not an aim angle wobbling. A
  break shorter than `acquireLostMs` is a doorway; `acquireCooldownMs` bounds
  the rate. **Do not add a cosmetic flourish to AI state that does not exist —
  probe it first.**

- **THE DEBUG STATE TRIGGERS DRIVE THE REAL `damage()` PATH.** DEBUG → CHAMP:
  BIG HIT / BREAK / LOW HEALTH size their numbers from the actor's own config
  and invoke no reaction directly, so what you are looking at is what a player
  would cause. They are no-ops with no Champion on the floor, which is the same
  absence that keeps the actor out of production.

- **INTENT IS A SECOND REGISTER, AND IT IS NOT A FIFTH REACTION.** The four
  grawlix glyphs say what HAPPENED TO HIM; `glyph-throw` says what he is ABOUT
  TO DO, and "FOUR, AND NO MORE" still governs the reaction half. Three things
  follow and none is cosmetic: it **does NOT go through `_punctuate`** (the
  queue works by making the second glyph WAIT, and `punctSpacingMs` behind an
  armour break would put the sign up after the grenade had already left); it is
  **held, then CUT** on the frame `_throwGrenade` makes the device real, never
  faded, because a fade describes a promise after it has been kept; and it
  **owns its own condition** — the `_tick` asks *am I still the commitment I was
  raised for?* rather than trusting a clear-on-every-exit-path list, so a
  stagger, a wall resolve or any future caller of `_enter` takes it down by
  construction. Same shape as `CameraDirector._bossFramable` refusing a
  cancelled handle. **IT IS NOT THE SPATIAL TELEGRAPH** — the thrown device, its
  shadow, the landing mark and the field own where; this owns only that.

- **ICE ABOVE THE HEAD = CHARACTER PUNCTUATION — `PUNCT_PALETTE`, third
  palette, APPROVED for the Captain as part of V1.** BONE (his rank plate) was lost among the
  numbers that land in the same column — `#ffffff`, `#ff8020`, `#ffe040` CRIT!
  and `#7fd4ff` armour hits. VIOLET fixed that and was judged softer and less
  crisp on a handset. ICE is the handset's own choice: `edge #18264a / body
  #8faeff / lit #e8f4ff`. The body's hue (~224deg) sits well off the armour
  number's cyan (~197deg), and the deep NAVY OUTLINE is the thing no combat
  text wears — it is what separates the family, and the pale body is what makes
  it crisp. **COLOUR IS THE REGISTER, SHAPE IS THE MEANING**: all five glyphs
  share the three values and keep their forms. **Because his hardware is blue
  too, containment is checked by EXACT VALUE, not by hue family** — a blue
  detector would be blind on a blue actor. None of the three values appears on
  his sheets, his rifle or the grenade device, and his FX sources never name
  them. **Do NOT generalise it yet**: the Captain is the first proven use.

### Body, animation and weight

- **THE BOUNCE WAS NOT IN THE SPRITE SHEET, AND THAT IS THE LESSON.**
  `Enemy.preUpdate` owns a SCALE channel — a sine wobble at ±10% while
  `_staggerMs` runs and a 12% shrink while `recoilT` does — and `Enemy.damage`
  sets `_staggerMs` on EVERY HIT while `ShockCaptain._fireRound` was setting
  `recoilT` on EVERY ROUND. Correct on a Ø44 trooper taking three shots;
  measured on a 5300-durability Champion under sustained chip fire it is a
  rubber sprite for the whole fight, and the man visibly shrank each time his
  own rifle went off. **No amount of frame work could have fixed it**, and a
  pass that only looked at the sheet would have concluded the art was wrong.
  Both depths are TUNABLE FIELDS now (`_staggerScale`, `_recoilScale`) whose
  defaults are the shipped numbers, so every other actor is byte-identical. Ask
  which SYSTEM owns a motion before redrawing the thing that appears to make it.

- **WEIGHT IS ABOUT WHERE THE MOTION LIVES, NOT HOW MUCH THERE IS.** "Solid"
  does NOT mean magnetized feet, a locked pelvis or "heavy means slow" — the
  brief says so explicitly and a minimum-vertical-pixels metric is the wrong
  instrument. `bob` is a WHOLE-BODY vertical offset and it carried the Captain's
  firing arc (brace 1, fire 1, recoil 2), so the entire 112px figure travelled
  up and down four times a second; `lean` moved the HELMET ALONE by up to five
  pixels, which is a bobble head on a static torso. `bob` is zero for every
  firing pose now and the recoil went UP the chain — rifle first (a separate
  overlay), then shoulders (`sh`, deliberately DEEPENED), then a halved `lean`
  that the chest and shoulders take half of (`tl`) and the boots take none of.
  **PLANT, TRANSFER, COMMIT, CATCH, SETTLE.**

- **THE FIRING BASE IS THE ONE THING IN A BURST THAT DOES NOT MOVE.** The stance
  widens to shoot (two pixels each way, not one) and holds that width through
  brace, fire, recoil AND settle, so everything above it reads as absorbed
  rather than bounced. A six-round burst over a narrow stance is a man shooting
  off his back foot.

- **AN ACTOR MAY DECLINE THE DEFAULT ANIMATION SELECTOR, AND THE CAPTAIN DOES.**
  `Enemy.preUpdate` picks idle/walk/fire/move-pose off the stock 33-frame
  contract; `_ownsAnim` (default false) turns that half off for an actor whose
  sheet is a different shape. **If both selectors run they overwrite each
  other's key every frame and `play()` restarts the animation on every tick** —
  a body permanently on frame 0 of something. `_facingSuffix()` is extracted so
  both paths resolve a facing from one implementation.

- **THE CAPTAIN'S SHEET IS 57 FRAMES AND EVERY DIFFERENCE FROM THE STOCK 33 IS
  A REQUIREMENT.** IDLE IS TWO FRAMES (every other actor idles on one, which is
  a frozen body — an elite that stands perfectly still between bursts reads as a
  prop). STRAFE IS ITS OWN CYCLE (playing the forward walk while travelling
  sideways swings the feet AGAINST the direction of travel, which is the
  sliding read both rejected candidates died of). BRACE / FIRE / RECOIL are
  three separate bodies — an earlier build separated brace from fire by one
  pixel of arm and they photographed as the same frame, which makes a burst a
  muzzle flash over a static pose. SETTLE and LAND are the core feel pass: a
  burst that returns to the full brace after every shot is ONE POSE LOOPED N
  TIMES and at six rounds that reads as a machine cycling, and a 200px step that
  ends by switching the velocity off has no catch. Frames 48-56 are pose HOOKS —
  `raise` and `thrust` are the Arc Grenade's; `recover` is still unused.

- **THE FEET DO NOT BOB, AND THE LEADING FOOT IS LIGHTER.** Deriving the leg
  ground line from the torso made the whole stance rise and fall with the walk
  bob — a body hovering rather than a body whose weight shifts — and it pushed
  the leading boot off the bottom of the canvas, where `SpriteSheet.rect`
  silently CLIPPED it: **the cycle's biggest step was the one with a foot
  missing.** Two identically-toned boots swapping places also read as one shape
  wobbling; the near foot catching more light is what makes the swap a STEP.
  The Captain is 28x30 rather than 28x28 for exactly this, and the two extra
  rows are empty footing, not more figure.

- **A MUZZLE FLASH AT THE FLAT DEPTH 27 IS DRAWN UNDER THE ACTOR BAND.** Actors
  Y-sort, so a body at world y 700 draws at depth 700. It has been survivable
  for nemesis weapons because their muzzle sits ~26px from a Ø44 body; it stops
  being survivable on a Ø56 body with a 75px barrel firing SOUTH, where the
  muzzle is 15px past the sprite's own bottom edge and nearly the whole flash is
  behind the man firing it. `weaponMuzzle` takes an optional `depth`; anything
  that knows its firer passes `firer.y + 2`. Same shape as the console whose
  light was drawn beneath the console — **ask where the light LANDS, in pixels.**

- **THE CAPTAIN'S DURABILITY IS TWO LAYERS AND `armourSpill` IS WHAT STOPS THE
  SECOND BEING A WALL.** The Interdictor's 1400hp was 0.47 of ONE Super, so the
  first casual Super deleted the concept before its behaviour could be seen — and
  a bigger pool is the WRONG answer to that, because it buys observation time by
  making every bullet feel weaker (the "spongey" failure). Overkill past the
  armour carries through to the body at `armourSpill`, so a Super breaks the
  layer AND hurts in the same instant. The break is TWO TEXTURES, not a tint
  (`champ-captain-broken` shears the pauldron and dims the visor), on the hero
  prop's contract: a recolour says "the same thing, dimmer" and what must read
  is that a piece of him is GONE. One layer, no regeneration, no second phase.

- **THE CAPTAIN DOES NOT YIELD ON `_staggerMs`, AND THAT IS THE POINT.**
  `Enemy.damage` sets it to 90 on EVERY hit, so `if (this._staggerMs > 0)
  return;` is a stun-lock by chip fire — 4305ms motionless, measured on the
  Harrower. It reacts to a REAL blow instead: above `staggerMinDamage`, once per
  `staggerCooldownMs`, for a bounded `staggerMs`, and the loop resumes on the
  frame it ends.

- **A NEW ACTOR SITS BETWEEN THE TWO THINGS IT MUST NOT BE CONFUSED WITH, AND
  ITS LADDER IS PLACED AGAINST THE DECK.** Troopers are cool white (`#dcdce8`),
  Vader near-black (`#12121a`), the deck `#212328`. The Shock Captain concept's
  first build was `#2e3038` and photographed as a second dark blob standing
  next to Vader — technically between the two, visually one of them. Armour
  three steps above the deck, top planes four. Same rule the arenas already
  carry for props.

- **AN ACTOR IS A HIGH-ANGLE TOP-DOWN FIGURE: DOME, SHOULDERS, CHEST, THREE
  ROWS OF BOOT.** Vader is 40x40 with a 16px helmet dome; the grunt is 20x20
  with an 11px one; the dome is built as a real circle graded north-to-south,
  and the boots are three rows at the SOUTH edge. The first Shock Captain
  concept ignored that and stacked horizontal colour bands, which photographed
  as a machine rather than a man. **AND NO WEAPON IS EVER PAINTED INTO A BODY
  SHEET** — every armed actor carries a separate `weaponSprite` overlay painted
  EAST-facing at origin `(0.15, 0.5)`. A rifle baked into the body is a second
  author for the same object, and it photographed as a pale slab across the
  chest with the weapon out-reading the man.

- **AN ENEMY PAINTED FROM A PALETTE FAMILY'S BOTTOM END IS INVISIBLE ON THIS
  DECK.** The Champion's first build used `impDark`/`impMid`/`impGrey` (#14161c
  to #2e3038) and photographed as an unidentifiable dark blob on the #212328
  hangar deck — the whole silhouette present and none of it readable. Place an
  actor's value ladder against the DECK, not inside a family: top plates two
  steps above it, body one, underside black. Troopers are white and Vader is
  black; anything new sits between the two things it must not be confused with.
  Same family as the shuttle borrowing `imp*`'s TOP end, in the other direction.

### Rifle and burst

- **ONE BURST = ONE CORRIDOR + ONE MONOTONIC SWEEP, AND TWO OF THE FOUR SHAPES
  WERE NEVER MONOTONIC.** `outward` walked 0.5 -> 0.75 -> 0.25 -> 1 -> 0 and
  `sweepback` went out and came back; together they were 44% of bursts, and on a
  handset that is a rifle aiming one way, swinging back through ground it has
  already covered, and correcting again. **Measured at -159px of backward travel
  along a burst's own corridor.** The fix was FEWER DEGREES OF FREEDOM, not more
  patterns: one free choice (which side the sweep starts on), one traversal, one
  direction. The ease is a smoothstep blended with the linear walk, so
  monotonicity is a PROPERTY OF THE CONSTRUCTION — a non-negative blend of two
  monotonic curves — rather than a threshold that could drift. And the noise is
  bounded so it cannot compete: the bias is CONSTANT for the burst (it used to
  open 16% per round, a second motion running across the first), the jitter is
  PERPENDICULAR ONLY so it can never move a round backward, and the whole
  perpendicular excursion is capped at 45% of the along-axis step between rounds.

- **`lean` IS SCREEN-VERTICAL, BECAUSE THE CAPTAIN FACES THE PLAYER.** `bob` was
  already zero for every firing pose and the handset still saw pumping. `lean` is
  "along the facing axis" — and he aims at the player, so the front and back
  views are the common ones and that axis IS screen y. At +1 / -2 / -1 across
  fire / recoil / settle it moved the helmet crown FOUR SCREEN PIXELS, FOUR TIMES
  A SECOND. It is one value held for the whole firing commitment now.

- **A RATCHET, NOT A CYCLE — a long burst is ONE commitment, not six repeated
  animations.** Shoulders used to run -2 -> 2 -> 4 -> 1 per round, a six-pixel
  vertical swing repeated once per shot; the big step happens ONCE at commitment
  now and they stay LOADED (1 / 2 / 1) until the settle. The rifle does the same:
  `_wKick` keeps 55% of what is standing and adds to it, so the barrel never gets
  all the way home between rounds, and it bleeds at 0.09/ms inside a burst
  against 0.17/ms outside one so it IS home when the stance releases. **The
  per-round motion moved into the ARM (`ao`, 4 to -3, lateral within the sprite)
  and the rifle overlay** — §13's chain, rifle first, then arms and shoulders,
  then a very small head, then a base that does not move at all.

- **MEASURE A PISTON FROM THE SILHOUETTE, NOT FROM THE CHANNEL VALUES.** Reading
  `bob`/`lean`/`sh` says what you intended; the topmost and bottom-most opaque
  ROW of each pose frame says what shipped. It caught a surviving four-pixel
  helmet step after the channels had already been "fixed", and it is what proves
  the boot sole is identical across brace / fire / recoil / settle.
  `shot-captain-cf` prints those rows and **asserts nothing about them** — §29 is
  explicit that zero vertical movement is the wrong target and a stiff Captain is
  a worse failure than a bouncy one.

- **ONE BURST IS ONE TACTICAL DECISION, AND THE PER-ROUND SOLVER IS GONE.**
  B.2.2's ESTABLISH / LEAD / BRACKET solved an intercept PER PROJECTILE. It hit,
  and the handset called it robotic, aimbot, Terminator — and it was
  **exploitable in a way that is obvious once written down: three point
  solutions leave the ground BETWEEN them uncovered**, so a small step and a
  stop parked the player in the hole between the establish shot and the lead.
  `_planBurst` now takes ONE snapshot at late brace — origin, bearing, length —
  draws a burst length (3-6, authored weights, never uniform), a spray shape, a
  side bias and every round's imperfection UP FRONT, and then nothing reads the
  player's position, velocity or heading again until the burst is over. The
  fairness is structural rather than a coefficient. `_predict` is DELETED, not
  left unread — `smoke-captain-rifle` greps for it, on the same rule that
  removed the camera's `teleports: true`.

- **A STILL TARGET IS A ROUTE OF ZERO LENGTH, SO IT BECOMES A FAN.** Under the
  corridor law a stationary player would otherwise be suppressed along a
  direction they do not have. The plan degenerates to a 74px band ACROSS his own
  bearing, centred on them — a soldier shooting at somebody who is not moving.
  **Standing still must never become the safe answer to a new aiming law.**

- **AN AIM POINT IS A BEARING, NOT A DESTINATION — DO NOT CLAMP IT TO THE
  ARENA.** `_planPoint` clamped into bounds and that BENT the committed line
  whenever the route ran toward an edge: measured at 142px off a corridor whose
  authored spread is 75, which is the corridor law quietly not holding. A round
  is an ordinary projectile and is entitled to fly into a wall.

- **THE RIFLE MUST WALK, OR THE DIFFERENCE IS ONLY IN THE DEBUG VECTORS.**
  Facing was re-solved to the player every frame, so between rounds the barrel
  snapped back onto them and then out to the next answer — which is exactly what
  aimbot looks like. Inside a brace or a burst the aim eases toward the NEXT
  PLANNED POINT and nowhere else. If a new aiming law is invisible in gameplay
  footage it has failed, however good its geometry is.

- **A CAP THAT BINDS IN NORMAL PLAY IS NOT A BOUND, IT IS THE AIM.** The burst's
  `leadMaxPx` was 260 and rounds 2 and 3 both clamped to it, so LEAD and BRACKET
  were the same shot. Same family: solve a lead's flight time from the MUZZLE,
  not the body centre — 75px of barrel is a 25% over-lead, and it makes every
  coefficient a lie about what it means.

- **PREDICTION IS FAIR WHEN IT IS BEATEN BY CHANGING YOUR MIND.** The Captain's
  burst reads only the velocity the player HAS RIGHT NOW, bounded in time
  (`leadHorizonMs`) and space (`leadMaxPx`), and every round is an ordinary
  projectile that is never retargeted after firing. Measured: holding one
  lateral direction went from 0 of 21 bolts inside 48px to 9 of 21, standing
  still stayed ~76%, and reversing stayed ~24%. **Do not fix an evadable attack
  by raising its damage** — a dangerous miss is still a miss.

- **A CAPTAIN BOLT NEEDS ITS OWN POOL, AND ITS SPEED IS UNDER 620 ON PURPOSE.**
  `captainBullets` is the FOURTH hostile pool: `BulletGroup.fire` re-asserts its
  group's texture on every recycle, so a blue bolt in the green trooper pool is
  either re-textured after the fact (silently resizing its hitbox, because
  `Bullet.fire` sizes the body from the TEXTURE) or leaks blue into the next
  trooper's shot. It is in `hostileBullets`, which is what stops the split being
  six places to remember. `bulletSpeed: 600` sits under `Bullet.fire`'s
  `clamp(speed / 620, 1, 2.2)` tracer stretch, so the hitbox is exactly the
  texture width.

### Tactical step (v6c, approved)

- **A STEP WITHOUT A CATCH IS A TRANSLATION.** The Captain's step was plant →
  impulse → stop, and the handset called 150px too short and visually weak. It
  is 200px and FIVE beats: plant (90ms, brace body, the suit loading), push-off,
  travel (215ms, strafe cycle), CATCH (120ms on a dedicated `land` frame) and
  settle. (The FX this bullet used to describe — thrust strands, a deck scuff,
  a deck ring — are long gone; the approved presentation is the v6c bullet
  below.) **The catch is the frame that did not exist**, and without it a
  200px displacement ends by switching the velocity off.

- **THE ECHO IS WHERE THE HARROWER COMES BACK.** THREE discrete traces of the
  actor's own silhouette at positions he really occupied (§10as), with
  NOTHING joining them. They say "he was there a moment ago". A persistent trail says
  "he is sliding", which is the word a handset already used to kill a Champion.
  Do not add a wake, a long glide, whole-body rotation or giant afterimages.

- **CHANGE ONE THING PER HANDSET QUESTION.** The step's `cooldownMs` stayed at
  2800 while the distance, the presentation AND the priorities all moved:
  shortening it too would have made it impossible to tell which of the four the
  next verdict is answering.

- **A CHAMPION'S STEP PRIORITY IS A LIST, NOT WHICHEVER TEST WAS WRITTEN
  FIRST.** CLOSE (aggressive pressure — the most important use by a distance,
  0.95 of `holdMin` plus a CLOSING-RATE test so he answers a collapse in
  progress) > POST-BURST > FIELD > BLOCKED. Blocked is LAST and waits 460ms: a
  step spent walking round a console is a step not spent breaking the player's
  firing solution, and ordinary navigation already solves a blocked line at
  walking pace. Closing rate is measured from REAL DISPLACEMENT between frames,
  never from a velocity the actor just wrote.

- **EXPANDING ROUND SHAPES AT A CONTACT POINT ARE WATER, WHATEVER COLOUR THEY
  ARE PAINTED IN.** The tactical step came back from a handset as a "water
  drop", and it was one by arithmetic rather than by taste: `_stepPreload` grew
  two `fillCircle`s at the boot, `_stepThrust` opened a `strokeEllipse` 100 ->
  150, and `_stepCatchFx` opened two more 26 -> 60. Five soft round shapes
  swelling and spreading from a point on a flat plane. **No intensity, colour or
  duration change could have answered that — THE FIX IS SHAPE LANGUAGE**, the
  same rule the hero machine's circle and the shuttle's wing edges already
  carry. `smoke-captain-closeout` greps the step methods for `fillCircle`,
  `strokeEllipse` and `.arc(` — absence, never a comment. `HANDOVER.md` §10an,
  and §10ao for what replaced v2's catch.

- **THE STEP IS v6c: THE BODY OWNS THE MOVEMENT, THE SUIT EXPLAINS THE SPEED —
  `HANDOVER.md` §10ar, §10as. HUMAN-APPROVED AND FROZEN 🔒 on `6560c62`.**
  History: v4 physical but unfinished → v5 rejected → v6 body-led → v6t three
  traces → v6c royal-blue traces, approved. Do not brighten it, raise its alpha
  or change the trace count. v5 (§10aq) gave the move to
  his ground ring — compress, shear into a crescent, collapse, reform — and the
  handset REJECTED it as a regression: the shape around him deforming instead
  of him moving. **That family is dead — do not tune it, redraw the crescent
  or find a different arc.** "The ring has no gameplay semantics" was true and
  was never a reason for it to be the motion language. v6: his TRAILING
  contour loads at the plant, the charge is cut into two short boot jets back
  down the travel, THREE cobalt traces are SAMPLED from the real travel
  (0 / ⅓ / ⅔ of the motion window — §10as; flat ROYAL-blue `STEP_FX.trace`
  silhouette mass plus a faint plate hint, oldest faintest, stepped decay —
  too dark in combat is fixed with PIGMENT, never alpha), the live body is the travel, and the catch is his `land` pose with the LEADING contour flaring
  white-blue and a compact forward counter-thrust. Unity comes from
  CAUSALITY, not from one graphic owning every beat. `smoke-captain-closeout`
  fails on any step method naming `threatRing`, on any line, on polygon
  geometry outside the boot jet, on a fourth trace or a trace off the body's
  real path, on a trace surviving into the catch, and on a whole-body wash.
  **THE v6 A-vs-B (one exposure beat two) WAS CONFOUNDED BY THE RENDER** —
  multiply-tinted copies read as extra Captains at any count. Colour, not
  render; and a lifetime that "ends near" a beat is a frame-alignment coin
  flip — end it ON the beat, from the beat's own line.

- **`threatRing` IS AN IDENTITY HALO AND THE STEP LEAVES IT ALONE.** It sits at
  radius+12 / radius+20, nothing reads it, and `Enemy.preUpdate` is its one
  author. The suite steps a real step at 60fps and requires the ring's alpha
  to stay 1 and its command buffer to be unchanged throughout. It lags the
  body by one frame (placed before physics moves him) — ~15px at step speed at
  60fps; pre-existing, on the stock path, noted and deliberately not fixed.

- **A SILHOUETTE COPY IN `_reactFx` SHOWS LAST FRAME'S POSE.** FX tick at the
  top of `preUpdate`, before the animation advances, so a tint-fill copy of
  his frame is one pose behind. Harmless while a pose is held (the `land`
  frame through the catch); on the frame the next state picks a new pose it
  outlines the old one as a pale halo. Tie such a copy to a held pose and
  sweep it on the state's end frame, and re-read `scaleX/Y` every tick — the
  `land` squash leaves a halo of its own otherwise.

- **THE STEP DOES NOT SPEND `def.color`.** `0x4fc3ff` sits close enough to the
  player's dash cyan to read as the same technology in peripheral vision.
  `ShockCaptain.STEP_FX` is cobalt / blue / white-blue peak / ice.

- **A FILLED TRANSLUCENT WEDGE BESIDE A BODY IS A BUBBLE. A STROKED CHEVRON IS A
  DIRECTION.** 34x54 of blue at 0.5 alpha against his hip photographed as a mass
  he was wearing, and he already stands near round cyan fixtures. A chevron has
  no interior to be mistaken for volume and its vertex states a bearing on its
  own.

- **AN ADD-BLENDED `setTint` IS NOT A SILHOUETTE.** A multiply tint under ADD
  keeps only the pixels that were ALREADY BRIGHT, so a stamp of a dark armoured
  body comes out as a round luminous blob with no outline — measured twice on
  the step echo. `setTintFill` on the NORMAL blend paints the sprite's own alpha
  mask flat: the outline survives exactly and nothing glows. It is also what
  keeps the echo clear of the player dash, which is seventeen ADD ghosts GROWING
  1.2x into a continuous trail.

- **`_bootY()` IS 0.44 OF `displayHeight` AND IT IS DERIVED FROM THE SHEET.** The
  body is 28x30 at scale 4 with a CENTRED origin, so the bottom edge is exactly
  half the height below `y` and the boots are the last three of thirty rows —
  0.40 to 0.50 below centre. It was 0.30, which is mid-shin, and every effect
  claiming to touch the deck was drawn 12-24px clear of it. Measure the sheet;
  do not eyeball the offset. Related: **the heaviest beat must not be the
  faintest** — the catch's 40px brackets under a 112px body photographed as
  stray pixels, the same mistake the B.2.2 damage marks made at r=6. Scale
  against `def.radius`.

### Arc Grenade

- **THE DEVICE IS THE SOURCE AND THE FIELD IS ITS CONSEQUENCE.** The Arc Grenade
  was a Graphics circle with a dot in it while the FIELD carried the whole
  visual identity — the Interdictor failure in miniature, where the floor effect
  becomes the character. It is a painted two-frame object now (inert / powered,
  because "the same thing, brighter" is not a state change), it flies as the
  projectile and stays as the source, and ONE object owns the whole lifecycle.
  It is an Image rather than a Graphics, so it is the one thing a sweep that
  only remembered the four Graphics would have left behind.

- **NINE DECLARED POINTS, AND NO RANDOM ENDPOINTS.** The rejected field drew
  SIXTEEN boundary arcs between random endpoints on an invisible circle plus
  three to five interior arcs with random ends, over three stacked translucent
  discs. Nothing in it had an anchor — that is what "scribbled with a pen"
  means. Everything is now the device or one of EIGHT projector nodes at exact
  45-degree intervals: the perimeter is eight TRUE CIRCULAR ARCS drawn with
  `Graphics.arc` at `this.radius` (the hit test's own number, so painted and
  resolved cannot drift by any amount), and every bolt runs between two of the
  nine points with both endpoints exact and the jitter bowing INWARD.

- **A BIG ROUND PROP DEFAULTS TO A DIAL — AND SO DOES A BIG ROUND FIELD.** A
  perfect circle with eight radial spokes and eight tick marks on it is a RADAR.
  Four spokes, alternating, stopping at 0.52r; perimeter gaps at 0.14 rad
  because at 0.085 the eight segments closed into one drawn circle with
  graduations on it. Same rule the hero machine already carries.

- **AN ACTIVATION IS A SEQUENCE AND THE DANGEROUS REGION MUST BE LEGIBLE BEFORE
  IT IS DANGEROUS.** Core powers up, nodes establish one at a time each placed
  by a visible beam, perimeter closes at 74% of `armMs`, connections snap in —
  and `contains()` does not return true until 100%. Shutdown reads off
  `_integrity` in the order a machine fails (connections, perimeter, nodes,
  core last, and the core drops to the INERT FRAME rather than fading because
  the device is still there). The edge stays legible the whole way down: it is
  dangerous for every millisecond of `warnMs`.

- **A BOUNDARY PROBE AT EXACTLY 1.0 MEASURES FLOATING-POINT ERROR.**
  `cos(π/4) * r` lands a fraction above `r` and `contains` correctly says no, so
  a test reading that as a bug is the instrument being wrong about a build that
  is right. Probe 0.999 and 1.002 on eight bearings, and test the edge itself on
  the four AXIS-ALIGNED bearings where the arithmetic is exact.

- **THE ARC GRENADE IS ONE OBJECT WITH FOUR PHASES, AND THAT IS A LIFECYCLE
  DECISION BEFORE IT IS A DESIGN ONE.** FLIGHT → ARM → FIELD → WARN, in
  `Hazard.js`, on the same list `Barrier` and `Wake` are on. A thrown thing that
  spawns a SEPARATE field on landing is two objects with two owners and two ways
  to be orphaned. `contains` is false until the field is live — the flight hurts
  nobody and the arming casing hurts nobody — and the boundary's jagged arcs
  jitter **INWARD ONLY** from the true radius, so the painted edge can never
  claim ground the hit test does not own.

- **A FIELD MAY NEVER TOUCH `player.moveMult`.** That is the permanent upgrade
  multiplier and upgrades COMPOUND, so a slow that scaled it and failed to
  restore it — on a death, a room change, two overlapping fields — would cripple
  a run for ever. `Player.preUpdate` reads `_envDrag`, applies it and resets it
  to 1 in the same breath; the only write is per-frame, from whatever is holding
  the player. Nothing persists it, so nothing can leak it. And the painful
  outcome comes from CHOOSING to stand in it: a tick and a drag, never a stun,
  a root or repeated control loss.

- **A CHAMPION MUST UNDERSTAND ITS OWN TOOL, IN THE SMALLEST VERSION OF THAT
  WHICH IS TRUE.** Two facts, four lines, no tactical director: a reposition
  target inside his own live field is pushed radially out past it, and while it
  is live he takes the strafe side that puts the PLAYER between him and it. He
  is still allowed to CROSS it — a Captain who refused would freeze whenever it
  landed between him and where he was going, and an elite stepping through his
  own electricity for half a second is a man in a hurry where standing in it is
  a man who does not understand his equipment.

- **A BINARY FLIP INSIDE A BUILD-UP BEAT IS A MACHINE THAT DOES NOT BUILD UP.**
  The Arc Grenade device was two frames flipping at a third of `armMs` while the
  field around it energised in five staged beats. It is three now — INERT ->
  CHARGING -> ARMED, dim blue to white-blue — climbed IN STEP with the
  activation and **stepped back DOWN the same ladder at shutdown**, because a
  machine shutting down and an effect ending are different claims. Its four
  prongs are stalks with shoulders and 2x2 heads: a bare diagonal run of single
  pixels is a stair-step and reads as an artefact, not a fitting.

- **A MACHINE COMING ONLINE SPEAKS DISCRETELY: LAND, BLIP, SILENCE, BLIP,
  ARMED.** The three-frame ladder climbed once and HELD, and a handset called
  the landed device dead — a thing that did one thing and stopped. Inside the
  unchanged 520ms: land (u 0-0.08, contact sparks), BLIP 1 (0.08-0.17, the
  charging frame and a blue core cross), a PAUSE back to inert (0.17-0.30 —
  the silence is the point), BLIP 2 (0.30-0.40, the armed frame, a brighter
  white-blue cross and all four prongs firing), then armed while the nodes
  establish FROM it. **Never a smooth pulse** — a breathing glow is a beacon or
  a pickup. `contains()` reads `phase` alone, so none of it moves danger, and
  the perimeter still completes at 74%. Live, the source stays alive by
  CIRCULATION, not by a clock of its own: a prong fires as a packet crosses
  the diagonal node its sector faces, and the core ticks as one crosses due
  north (three ticks a lap). Derived from `_pktT`, so cause and effect cannot
  drift.

- **A SOURCE THAT ONLY TICKS IS DEAD 90% OF THE TIME.** The synced ticks were
  all the live device ever drew, so for most of the field a handset saw a
  static white-cored sprite. `_coreAlive` holds a BLUE core every frame under
  a STEPWISE level re-rolled every 60-110ms (electronics flicker in steps; a
  sine is a beacon) plus one or two internal shorts core-to-prong, and the
  armed frame's own core is blue with a white pip now, not white. In the warn
  window the table darkens and gains dropouts: the source struggles exactly
  while the field is failing.

- **THE POWER-DOWN LIVES IN ITS OWN PHASE, AFTER THE DANGER.** `phase` is
  `'spent'` for `spentMs` (460) after `fieldMs`: `live` is false, so
  `contains()`, the tick and the drag are already off and the ring is not
  drawn. Blip, dark, weaker blip, the core contracting, a dark shell fading —
  then `destroy`. Putting the shutdown inside the field would animate a
  power-off over ground that still hurts. It holds `_nade.dead` false 460ms
  longer, which the 9000ms cooldown makes irrelevant to `_canThrow`.

- **THE SOURCE SHOWS THE HIT IT DELIVERS.** The damage tick's own line records
  `_hitT` and the bearing; `_hitReact` surges the core, fires the prong facing
  the player and runs one routed arc from that prong to them, on the hazard
  layer UNDER the actors so it ends beneath the body it hit. Presentation reads
  the gameplay decision and never makes one: the suite pins the tick at the
  authored 46 on the authored 420ms cadence.

- **THE SOURCE'S LIGHT GOES ABOVE THE SOURCE.** The first blips were drawn into
  `edgeGfx` (hazard depth) under the device at 2002 — a 15px core flash on a
  60px opaque sprite, completely hidden by the object emitting it. Measured on
  the strip; it photographed as a frame change and nothing else. `coreGfx` at
  2003 carries everything the SOURCE says. Same trap as a console's light
  drawn under the console, in miniature. A destroyed grenade therefore takes
  FIVE Graphics and its device, and the closeout suite counts exactly six.

- **A FIELD THAT ONLY EVER FLICKERS IS A FIELD WITH A FAULT.** Everything moving
  in the live arc field was a SNAP. Three short bright arcs now travel the
  perimeter at a constant rate, derived from ONE phase at fixed offsets so they
  are evenly spaced by construction and carry no randomness at all — the one
  controlled thing in an effect whose every other motion is stochastic. They
  ride `this.radius` itself, so the one moving element on the boundary cannot
  misreport it. **ARCS, NOT DOTS**: a dot running a circle is a loading spinner,
  which is the UI read this field has already been pulled back from once.

### Hazards, and the rejected Interdictor / Harrower technology

- **A `Wake` IS EMITTED, A `Barrier` IS PLACED.** Both live in `Hazard.js` and
  share `spawnBarrier`/`spawnWake`/`tickHazards`/`clearHazards`. A wake is ONE
  object holding a polyline, not N segments — a trail built from separately
  spawned pieces photographs as disconnected floor rectangles appearing under a
  sprite. It is sampled by DISTANCE (`wakeStepPx`), never per frame, for the
  same reason the returned super's remnants are. `_segW(age)` is used by the
  renderer AND by `contains()`, so the drawing and the hit test cannot drift.

- **GATE A LOOP ON CAPABILITY, NEVER ON CLASS.** The Champion move-tick loop
  called `dueMove` on everything `isChampion`; the Harrower schedules nothing,
  so it threw every frame — and because that loop runs inside `update()`, the
  abort **took the rest of the frame with it**, hazards included. It presented
  as the new actor being broken. `typeof e.dueMove !== 'function'` is the guard.

- **A COMMITTED CRAFT MUST NOT INHERIT THE INFANTRY STAGGER RETURN.**
  `if (this._staggerMs > 0) return;` opens nearly every actor and is correct for
  a body that should slide when hit. On the Harrower it halted the whole loop
  while ordinary fire kept refreshing the timer and `Enemy.preUpdate` damped the
  velocity underneath: **4305ms motionless inside a "pass"** — the rejected
  Interdictor's failure arriving through a different door. A pass cannot be
  chip-interrupted; the BANK is where the craft is interruptible, and it takes
  `bankPunish` extra damage there. You cannot stop the run, you punish the turn.

- **NEVER MEASURE THE COMMAND YOU JUST WROTE.** The Harrower's grind watchdog
  read `body.velocity` immediately after `_drive()` had set it, so it measured
  its own instruction and could never fire — detention ground for 2603ms with
  the guard nominally in place. Measure real displacement per frame, divided by
  dt. Same family as "a refused call reads exactly like a failed one".

- **A PASS IS VALIDATED ON THE PLANNED CHORD AND FLOWN FROM WHERE THE CRAFT
  ACTUALLY IS.** Those differ by up to `alignTol`, which is enough to clip cover
  the true lane cleared. The lane is re-laid through the real position at ACCEL,
  so the promise and the flight are the same line.

- **A PASS THE CAMERA CANNOT SHOW IS NOT A CROSSING.** Chords clipped to the
  whole arena ran 1172px against a ~720px viewport and only **35% of a pass was
  ever on screen**. `maxPassLen` plus `_trimToWindow` centre the run on the
  player's neighbourhood. Any arena-scale movement design has this problem.

- **THE HARROWER ROTATES, AND THAT IS A NARROW EXEMPTION.** Body sprites never
  rotate here because rotating a HUMANOID produces the upside-down-sprite bug; a
  top-down CRAFT rotated to its heading is correct and is how every vehicle in
  the genre works. It is painted east-facing (the weapon-overlay convention) and
  driven by `setFrame` rather than `anims`, so it registers no animation keys.
  The exemption is for a vehicle, not a precedent.

- **A PERSISTENT HAZARD HAS ONE OWNER AND THREE INDEPENDENT SWEEPS.**
  `src/systems/Hazard.js` mirrors `Telegraph`'s lifecycle: `spawnBarrier` /
  `tickHazards` / `clearHazards`. A seam is retired by the NEXT cast (one per
  Champion, always), by the Champion's `die()`/`destroy()`, and by
  `_clearRoomEntities`. All three are idempotent because none can know about the
  others. **A damaging region that outlives the machine that drew it is worse
  than no hazard** — the same reason a telegraph that outlives its attack is
  worse than none.

- **THE SEAM IS A LINE, NOT A DISC, AND THE SHAPE IS THE HIT TEST.**
  `Barrier.contains()` runs the arithmetic the renderer draws, growth included —
  during the 260ms grow the far end genuinely does not hurt yet. Never draw one
  shape and resolve another. It is a line because these arenas are lanes, a
  crossing and an escort floor: a disc is walked around, a line is a side you
  have to choose.

### Champion test and instrumentation traps

- **`delete` A TEST STUB, NEVER `= undefined`.** An immortality stub is an OWN
  property shadowing the prototype method; assigning undefined leaves the shadow
  and `damage()` calls it — "this.die is not a function", which reads like a
  game bug and is entirely the rig's.

- **NEVER ZERO A COOLDOWN AND THEN MEASURE THE SPACING IT CONTROLS.** A rig
  forced `_stepCd = 0` to make a step happen sooner, then read a 200ms gap
  against a 2800ms cooldown and reported a correct build as a skater. Exclude
  everything the rig forced, or do not force it.

- **A POOLED BULLET IS RECYCLED, SO COUNTING ACTIVE ONES IS NOT A LEAK TEST.**
  `smoke-captain`'s room-change sweep counted every live Captain bolt afterwards
  — including the freshly injected Captain's — and passed only while that one
  happened not to shoot inside the window. Hold the IDENTITY (`_gen`), the same
  way the check beside it already held the actor's.

- **A FIXED WINDOW AGAINST A CHASE IS THE FRAME-RATE TRAP IN A NEW COSTUME, AND
  IT WAS IN THREE RIGS AT ONCE.** `smoke-arcgrenade` waited a flat 9s for the
  real AI to throw while the median separation was **1231px against a
  `maxRange` of 680** — exactly ONE frame in the window ever satisfied
  `_canThrow`, three downstream checks read `phases: []`, and a working grenade
  was reported as absent depending on where the wave happened to drop him.
  `smoke-captain-rifle` measured three commitments in 26s for the same reason,
  and `diag-captain-pressure` printed a `line` run at a 1137px median. **STAGE
  THE ENGAGEMENT AND POLL FOR THE CONDITION.** A rig that has to walk somewhere
  first is measuring the walk.

- **DRAIN AN EFFECT ON THE ACTOR'S OWN CLOCK, NEVER ON A SLEEP.** The Captain's
  reaction FX are scheduled on `_clock`, which advances by Phaser's CLAMPED
  `delta` — so on a slow container a second of wall time is a third of a second
  of game time. `smoke-captain-step` waited 700ms for three 325ms overload
  responses to expire and the check therefore passed on a fast box and failed on
  a slow one, on this build and the one before it. Advance `_clock` and tick the
  effects directly; it is deterministic at any frame rate.

- **`?champdbg=1&captel=1` IS AN INSTRUMENT AND CHANGES NOTHING.** Separate from
  `champdbg` on purpose — most Champion reviews are not about numbers. With
  `captel` absent nothing is constructed: no container, no listeners, no
  `postupdate` hook, no panel, which `smoke-captel` checks by WALKING THE
  DISPLAY LIST rather than by asking whether the module ran. It also snapshots
  `CHAMPION.captain`, every player damage input and a live actor's hp/armour/
  speed with the flag on and off and requires them byte-identical: an
  instrument that perturbs the thing it measures is worse than no instrument.
  And it takes NO POINTER AREA — a tappable panel needs an exclusion point on
  the fire stick, which alters the controls of the run being measured.

- **ATTRIBUTION IS CARRIED, NEVER INFERRED FROM A MAGNITUDE.** `GameScene` sets
  `_dmgSrc` synchronously around each player damage call — the same idiom
  `_superHitCtx` and `_suppressHitSfx` already use, and exact because
  `Enemy.damage` emits `enemy-hit` INLINE, so there is no window between the tag
  and the read. A source guessed from a number gets worse every time the numbers
  move. Reconcile the attributed total against
  `starting durability - ending durability` ACROSS THE LETHAL BLOW, which is
  where a request and a removal differ most.

- **`isChampion` IS NOT "THE CAPTAIN I AM MEASURING".** `?champdbg=1` injects
  one Champion per WAVE, so two can stand on the floor at once. A probe measured
  four grenades thrown and two attributed while fields counted all four, because
  the field event had no owner filter and the damage listener tested
  `isChampion` instead of `enemy === session.actor`. Filter on the ACTOR, and
  tell the human when there is more than one — it changes how every hit rate
  should be read.

- **AN `attach*` THAT REGISTERS SCENE LISTENERS MUST REMOVE ALL OF THEM.**
  `create()` runs again on a restart (`PauseScene._restart`) and `scene.events`
  survives it, so tidying only the obvious `postupdate` hook leaves a full
  second set of handlers behind and doubles every counter from the second run
  on. Remember each listener at registration and sweep them on `shutdown` AND
  `destroy`. Same family as the `postupdate` handler closed over a dead boss.

- **A SCREEN COORDINATE IS NOT A GAME-CAMERA COORDINATE, and an overlay that
  forgets it prints through another overlay.** The Game camera is inset by
  `HUDCFG.topBarHeight`; the encounter harness's PREV / NEXT / REPLAY buttons
  live in the HUD scene at screen y 196/250/304. The telemetry panel at camera
  y 116 photographed straight through all three. DERIVE the top from the thing
  it has to clear.

- **A CLOSEST-APPROACH SAMPLER IS A FRAME-RATE METER TOO.** `diag-captain-pressure`
  samples on `postupdate` at ~14fps against a 600px/s bolt, so the bolt jumps
  ~43px between samples and a STATIONARY player — whom he cannot fail to hit —
  measures a 44px median miss. Read its buckets as an ORDERING between policies
  and builds, never as absolutes. Two more ways that rig lied: it cannot measure
  AIM through COVER (bolts died on crates a third of the way out and rounds 2
  and 3 appeared to over-lead by 180px), and a patrol that walks to the arena
  wall measures a RETREAT rather than a strafe (a 600px/s bolt chasing a
  380px/s player never arrives, however well it was aimed).

- **AN IMMORTALITY STUB MEASURES THE WRONG THING ON A LETHAL HIT.** Stubbing
  `die` to keep one actor alive down a whole damage ladder puts hp back ABOVE
  where it started on the killing blow, so the rig reports "0 removed" and calls
  a correct build a liar. Give the lethal case a real actor and a real death.

- **A SEQUENCING CHECK MUST READ THE SCHEDULE, NOT THE OBSERVATION.** The
  punctuation queue stamps each glyph exactly `punctSpacingMs` apart and fires
  each on the first frame at or past its stamp — so at ~10fps the observed gap
  lands anywhere in a ±110ms band and measured 294ms against a 340ms floor.
  Assert on the queued `at` values.

- **A FIXED SLEEP AGAINST A PHASER TIMER IS A FRAME-RATE METER, AND IT WENT OFF
  IN `smoke-champion`.** Its seam checks waited `anticipateMs + 500`, which was
  generous on the machine they were written on and stopped being generous on a
  slower one: seven checks failed with `hazards: 0` while a direct probe showed
  the seam landing perfectly well a moment later, and the same too-short wait in
  the helper made `_hazards[0]` `undefined` for every lifecycle check
  downstream. **Poll for the CONDITION.** A/B against the stashed build before
  believing any suite failure — this one reproduced identically on the committed
  tree, which is what proved it was the instrument.

- **A TEST MUST NAME THE CANDIDATE IT TESTS, AND MUST READ THE ACTOR RATHER
  THAN THE FLAG.** `smoke-harrower` rode `?champdbg=1` and silently changed
  subject the moment the active candidate did. And a dynamic
  `import('/src/systems/debug.js')` inside `page.evaluate` can hand back a
  SECOND module instance carrying the authored defaults — `getChampWhich()`
  answered 'captain' while the sprite on the floor was plainly a Harrower.
  `spawnChampion` with no explicit id resolves the real default through the real
  code path, and its texture cannot lie.

- **A SUB-100ms BEAT IS SAMPLED BY STEPPING THE LOOP, NOT BY POLLING IT.**
  `game.loop.sleep()` then `game.step(t, 1000/60)` by hand runs the real
  update and render at exactly a phone's cadence — `shot-captain-step-seq`
  and the closeout suite's step block do this. The rig it replaced started a
  425ms step in one `page.evaluate` and armed its pause hook in the next,
  200-400ms later, and photographed whatever step his AI took afterwards.

- **CHOOSE A PROBE INSTANT THAT THE OLD LAW DEFINITELY DOES NOT DRAW AT.** The
  first "alive between ticks" check set the packet phase to 0.5/8 and passed on
  the dead build too — three packets a third of a lap apart always put one
  within the old tick window. At 2/8 one sits on an even non-north node, where
  the old law draws nothing. A/B every new check; a check that passes on the
  bug is decoration.

- **A GREP-BASED LAW MUST STRIP THE PROSE BEFORE IT READS THE CODE.** This
  codebase documents the shapes it removed and the negative references it must
  not copy BY NAME, so a check reading raw source finds the very literals it is
  asserting are gone and **fails on a correct build**. It fired immediately on
  the first run of `smoke-captain-closeout`. Comments out, then grep.

- **A SHUTDOWN LADDER IS DRIVEN, NOT OBSERVED.** The arc field's `warnMs` is
  520ms and this container drops under 6fps inside a full suite run, at which
  the whole beat is two frames and a correct build reports as a fading one —
  measured, as a flake that only appeared under `run-all`. `_integrity` is a
  pure function of `age`, so the beat is addressable: put the object at the
  instant and step it once. Same family as ticking `_clock` instead of sleeping.

- **AN EFFECT SPAWNED ON THE FRAME A BEAT BEGINS IS EMPTY FOR EXACTLY ONE
  FRAME.** `_reactFx` is ticked at the TOP of `preUpdate` and the state machine
  runs below it, so a Graphics created by the state tick is not DRAWN until the
  next frame. An evidence rig that pauses on the first qualifying frame
  photographs a Captain with no impulse behind him at all — the harness being
  wrong about a build that is right, and the same family as "a collision-time
  pose lands one frame after its effect". And **frame the ORIGIN, not the
  body**: every impulse effect is drawn where he pushed off while he travels
  away from it, so a camera on the moving actor walks the subject out of shot.

- **`spawnEnemyAt(type, x, y)` — TYPE FIRST.** Two evidence rigs called it
  `(x, y, type)`, which falls through to the default branch with a number for
  a type and spawns nothing that was asked for, silently. `shot-arcfield`'s
  §26 "crowd" frame had no crowd in it for a whole pass. Look for the enemies
  in the frame you claim contains them.

- **A BLIP IS SHORTER THAN A HARNESS FRAME, SO IT IS ADDRESSED, NOT CAUGHT.**
  Each blip is ~47-52ms against a ~12fps harness. `ArcGrenade._draw` is a pure
  function of `age`, so rigs PUT the object at the instant and step it once —
  the real drawing path, only the moment chosen. Same idiom as the shutdown
  ladder and the `_clock` drain.

- **ATTRIBUTE THE THING IN THE SCREENSHOT BEFORE REDESIGNING AGAINST IT.** A
  large soft cyan disc beside the stepping Captain looked exactly like the
  bubble the step pass existed to remove, and two rounds went into chasing it.
  Hiding every one of his `_reactFx` and re-shooting the same paused frame left
  it precisely where it was: **it is the objective terminal's own marker.** The
  A/B is one page.evaluate and it is cheaper than one wrong redesign.
