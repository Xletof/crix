# Post-mortem: Vader's moves shipped broken with 17 passing checks

**Commit:** `149ad6c`, deployed to `FRIX` 2026-08-07, **rejected on sight**, reverted in `9fde4ef`.
**Verdict from the person playing it:** *"Moves are buggy, there can be two red trails and Vader
does pull suddenly, very buggy overall, also all moves are very bad quality effects, too simple
blue circle or red rectangle."*

Every one of those observations is correct, and every one of them was measurable before the
deploy. This file exists so the next session does not repeat the process that hid them.

---

## What was actually wrong

Measured against the rejected build (`149ad6c`) served in isolation, with **nothing silenced** —
which is the part that matters, see "How the tests hid it" below.

### 1. Two systems drive Vader at the same time, and neither knows about the other

`Boss.update()` runs its original state machine — IDLE → CHARGE_WINDUP → CHARGING / FAN /
SPAWNING — every frame, and it has no idea `_activeMove` exists. In the IDLE branch it
unconditionally does:

```js
this.setVelocity(Math.cos(angToPlayer) * speed, Math.sin(angToPlayer) * speed);
this.setScale(glowScale);
```

So a move's `b.body.setVelocity(0, 0)` is overwritten on the very next frame, and its
`squash()` / `rearBack()` tweens fight a `setScale` that reasserts itself every tick.

**Measured: he walks at the player at 165px/s throughout the ANTICIPATE beat of all four moves.**
He never rears back, never plants, never stops. The wind-up — the entire basis for the move
being readable — does not render. That is precisely *"Vader does pull suddenly"*: from the
player's chair there is no anticipation, just Vader walking at you and then an effect landing.

He also keeps attacking on his own clock underneath. In a 45-second sample with nothing
suppressed, his charge fired 6 times independently of the move system, once entering
`charge_windup` while a scripted VANISH was mid-flight.

### 2. Two of the four moves draw nothing on the floor at all

| move | zones drawn |
|---|---|
| SABER THROW | 1 lane (then a second — see below) |
| **FORCE PULL** | **none** |
| VANISH | 1 circle |
| **FORCE PUSH** | **none** |

FORCE PUSH is a 420px shove that costs a dash charge, and FORCE PULL drags the player across
the room. Neither puts a single pixel on the ground before it fires. Combined with (1) — no
visible wind-up either — they are unannounced.

### 3. "Two red trails" is real, and it is worse than two

One SABER THROW, logged at the moment each zone is created:

```
  +0ms     lane 620x150 at (976,1350) angle 180deg   [Vader at (976,1350)]
  +1450ms  lane 620x150 at (319,1350) angle  23deg   [Vader at (813,1350)]
  +2920ms  lane 684x170 at (618,1350) angle 180deg   [Vader at (618,1350)]
```

Three red rectangles in under three seconds, from two different systems:

- The second lane is the saber's **return path**. Its origin is 657px from Vader — it starts in
  empty floor, pointing 23° off-axis at nothing the player can associate with him.
- The third is the **state machine's charge lane** (note the different dimensions, 684x170),
  fired on its own cadence with no coordination.
- And because a telegraph freezes its origin at spawn time while Vader keeps walking (1),
  **the first lane no longer comes out of him by the time it commits** — he has moved 163px.

A telegraph that does not originate from the thing that will hit you is not a telegraph. It is
a red rectangle.

### 4. The "effects" are the telegraph primitive, unchanged

`Telegraph.js` draws exactly one thing: `strokeCircle` plus a 28%-alpha fill, or a four-point
polygon for a lane. That is the whole visual vocabulary of every move. *"Too simple blue circle
or red rectangle"* is a literal description of the drawing code.

The plan had this right and I ignored my own sequencing: **Phase E — pixel-art attack frames**
was listed, deferred, and never done, while the moves were reported as complete.

---

## How the tests hid it — the part worth remembering

`smoke-boss-moves.mjs` passed 17 checks against this build. It should have been impossible for
it to pass. Here is why it wasn't.

### The tests began by switching off the thing that broke the moves

Every boss test in that file opened with:

```js
b._reflectEvery = 0; b._blackoutEvery = 0; b._afterimageEvery = 0;
b._disarmEvery = 0; b._sunderMs = 0; b.cooldown = 1e9;
```

`cooldown = 1e9` is what stops his state machine picking a new attack. So the tests measured
the moves in a laboratory built by **removing the exact system they collide with in play**. The
conflict in (1) cannot appear in a harness that disables one of the two parties.

> **Rule: never verify a new behaviour with the system it shares an actor with switched off.**
> Silence a clock to make a measurement stable, then run at least one pass with nothing
> silenced and assert the fight is still coherent.

### The tests asserted effects, and readability is not an effect

Every check was of the form "the saber travelled 200px", "the player moved 60px against their
input", "a dash charge was spent". All true. None of them can fail when the move is
unreadable, unannounced, or accompanied by two stray rectangles.

I had already written the right gate — `smoke-moves.mjs` has **MOTION IS MANDATORY**, which
fails a move whose actor does not visibly move during ACT — and I applied it only to the
nemesis path, never to the boss. Had it been pointed at Vader it would have caught (1)
immediately.

> **Rule: for anything the player has to READ, assert the reading.** At minimum: a zone exists
> before damage lands; exactly one zone is on the floor per attack; the actor's body changes
> during the wind-up; the zone's origin tracks the actor that will hit you.

### Screenshots were treated as optional, then explicitly waived

The screenshot pass produced badly framed images. Instead of fixing the framing I wrote into
the script header that *"whether a move READS at arm's length on a handset is still a phone
question"* and shipped. That is outsourcing my own verification to the person who asked for the
work. The stray return lane and the missing wind-up are both visible in a correctly framed
still — I had the instrument in my hand and put it down.

`tests/README.md` already says this project is heavily visual and that assertion counts have
produced false passes here before. It was right again.

### I deployed on a green suite instead of on having watched it play

"Always deploy — don't ask" is about not making the player wait behind a question. It is not
licence to ship something I never watched run. 25/25 green was reported as if it were evidence
the fight was good; it was evidence that 25 files ran without throwing.

---

## What I told the player that wasn't true

- *"Vader now performs his own moves"* — he performs them while his old state machine performs
  its own attacks over the top.
- *"his charge finally draws a lane on the floor"* — true, and that lane is one of the stray
  red rectangles, because nothing sequences it against the move system.
- The four moves were listed as done with no mention that their entire visual treatment was a
  placeholder primitive.

---

## The three rules, short enough to remember

1. **Never test a new behaviour with the old system switched off.** If a harness needs a clock
   silenced to be stable, one unsilenced pass still has to run.
2. **Effects are not readability.** Assert the telegraph, the wind-up on the body, one zone per
   attack, and the zone's origin tracking its owner — or the move can pass every check and be
   unplayable.
3. **A placeholder is not a deliverable.** If the art is still the primitive, say so out loud
   before deploying, and do not describe the feature as finished.
