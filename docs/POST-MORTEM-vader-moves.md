# Post-mortem: the Vader fight, four rounds

**What happened:** a boss redesign that should have been one release took four,
across roughly a week. The first was rejected on sight with 17 passing checks
behind it. The fourth landed. This file is what the four rounds cost and what
they taught, written so the next feature does not pay the same tuition.

It is long because the specific mistakes are the useful part. The three rules at
the bottom are the short version, and they are also in `CLAUDE.md`.

---

## The four rounds

### Round 1 — rejected on sight

Shipped as `149ad6c`, reverted in `9fde4ef`. The verdict: *"Moves are buggy,
there can be two red trails and Vader does pull suddenly, very buggy overall,
also all moves are very bad quality effects, too simple blue circle or red
rectangle."*

Measured afterwards, with nothing silenced:

- **Two systems drove the same actor.** `Boss.preUpdate` wrote velocity and
  reselected the animation every frame and had never heard of `_activeMove`. He
  walked at the player at **165px/s through the ANTICIPATE beat of all four
  moves** — so there was no anticipation on screen at all, just Vader advancing
  and then damage. That is the whole of "does pull suddenly".
- **Two of the four moves drew nothing on the floor.** Zero zones, measured.
- **One SABER THROW put three red rectangles down in three seconds**, from two
  systems, one of them beginning 657px from him in empty floor.
- **The "effects" were the telegraph primitive** — one 3px stroke and a
  28%-alpha fill — while `FX.js` already contained `slamShockwave` and
  `bladeArc`, which are what the quality bar in this repo actually looks like.

### Round 2 — readability fixed, the fight still wrong

The ownership gate, the sweep-with-leading-edge telegraph and real attack frames
landed and were accepted: *"the saber throw is good, the telegraph and visual is
good"*. Everything else was still wrong, and two items were **regressions I had
introduced in round 1's fix**:

- Making every zone follow its caster broke VANISH's landing marker, which must
  be anchored to the world. The plan said so; I never applied it. Result: the
  marker trailed him, he teleported to the spot captured at cast time, and the
  live zone then snapped onto his new position — the "second circle".
- `raiseWeapon` multiplied scale by 1.35 and `dropWeapon` divided it back.
  Relative, so an unmatched pair **compounded**: by the fifth SABER THROW his
  saber rendered as a ~1100px slab lying diagonally across the room.

### Round 3 — the fight, not the presentation

- **No arrival condition.** The chase drove at the player every frame with no
  stop distance, so on arrival he tried to occupy their pixel and arcade physics
  jittered him across their body. Reported as the pathfinding breaking. It was
  never pathfinding.
- **Knockback displaced him off his own telegraph.** Five super hits mid-move
  imparted **4500px/s**. Only visible mid-move: idle, his own AI overwrote the
  shove before it rendered.
- **A tween to a stale point.** The saber's return targeted the coordinates he
  occupied when it was *scheduled*, and `impact` snapped it home when the beat
  ended.
- **A telegraph that lied.** FORCE PULL drew a 90° cone while dragging the
  player in from any bearing.
- **Variety gated behind phases.** VANISH and FORCE PUSH were both `minPhase: 2`,
  so a phase-1 Vader had literally two attacks.

### Round 4 — reach, identity, theme

- **The saber turned round at 248px of a 620px reach** — 40% — because the
  outbound leg had both a distance trigger and a speed floor, and the speed
  floor always won. Arithmetic, checkable on paper, shipped twice.
- Two frame-rate bugs in the same flight: a hardcoded 16ms timestep (a third
  speed on a slow machine) and a tick budget assuming one tick per frame while
  Phaser's clock fires several on catch-up — so the budget ran out mid-flight
  and the blade hung 553px away.
- **The boss was using the player's effects.** `slamShockwave` is the Riven
  melee finisher and `bladeArc` her combo sweep, so his heaviest attacks looked
  like the thing you had just done to him.

---

## Why the tests did not catch any of it

This is the expensive part, and it is almost entirely about **instruments, not
code**.

### The harness silenced the system under test

Every boss test opened with `b.cooldown = 1e9`, which is exactly what stops
Vader's state machine. The harness was therefore structurally incapable of
seeing two systems fight over his body. Seventeen checks passed on a build where
two moves drew nothing.

> A measurement may be stabilised by silencing a clock. A **verdict** may not.
> `smoke-readability` now silences his clock for per-move measurements and runs
> one final pass with nothing silenced at all.

### The checks asserted effects, and effects are not readability

"The saber travelled 200px." "The player was dragged 60px." "A dash charge was
spent." All true, none able to fail when the move is unreadable.

The gate that works iterates the **registry** — every move must draw a zone
before it damages, must plant during its wind-up, must move its body. Registry
level, because a per-move check gets forgotten when a fifth move is added, and
forgetting is exactly what happened to FORCE PULL and FORCE PUSH. It has since
caught two *new* moves with no body tell on their first run.

### Nearly every intermittent failure was my instrument

Not one was a flaky game. In order:

| what failed | what was actually wrong |
|---|---|
| stagger read as 128ms for a 550ms window | polling async in a ~50ms/frame harness; the peak was between samples |
| "move grants no recovery" | the cast was **refused** and returned null — every probe reads zero, which is indistinguishable from "did nothing" |
| body wind-up = 0 | previous move's tween still running; baseline captured mid-fade |
| "he stands on you" at 0px, then 34px | FORCE PULL legitimately drags the player onto him; then the frame after a move inherits where it left him |
| saber "teleports", 2 runs in 3 | thresholded pixels-per-frame, which measures the machine |
| clones deal no damage | under parallel load they could not cross 100px in 5s |

The pattern: **I measured a thing adjacent to the claim and let the number
stand in for it.** The fix each time was to measure the claim — sample on the
game's own `postupdate` frame, wait on the move's phase rather than the wall
clock, count frames rather than pixels, and assert the cast actually ran.

### A check that passes on the broken build is not a check

Three of round 3's four new checks passed against the build being replaced and
had to be rewritten until they discriminated:

- knockback had to be applied **mid-move** — idle, the AI swallowed it;
- the boomerang had to displace him **after** the old code captured its target;
- the "stands on you" check had to measure where he **settles**, not the minimum.

A/B is not a formality. Run the new check against the old code and watch it
fail, or it is decoration.

### Screenshots caught three bugs no assertion did

The compounding saber scale, the stray return lane, and the safe-zone-drawn-in-
danger-colour from an earlier release. All invisible to counts.

And the harness lied there too: freezing `tweens.timeScale` and pausing physics
does **not** stop `scene.update`, so telegraphs kept ticking and destroyed
themselves before the shutter. I spent four rounds blaming the drawing code for
a zone that was no longer in the frame. `scene.pause()` is what a photograph
needs.

### Verify the theory before designing around it

I wrote in this file's first version that `Boss.update` was snapping the thrown
saber back to his hand. A one-frame probe measured it **503px away at both ends
of the frame** — the theory was wrong. His AI is in `preUpdate`, which Phaser
runs *before* the tween manager, so tweened properties always survived and only
direct writes were clobbered. Twenty minutes of probe saved a redesign built on
a false premise.

---

## What cost the most time

1. **Instrument debugging, by a wide margin.** Perhaps half the elapsed time
   went into tests that were wrong about a game that was right.
2. **Shipping without looking.** Round 1 went out on a green suite and bad
   screenshots I had explicitly waived as "a phone question". That waiver cost
   two rounds.
3. **Container rollbacks.** The working tree was reset to an older commit at
   least four times mid-session; only pushed work survived. Commit and push at
   every natural checkpoint, not at the end.
4. **Fixing symptoms before finding the cause.** Round 1's tests were patched
   three times before I admitted the structure was wrong.

---

## The rules

1. **Never verify a new behaviour with the system it shares an actor with
   switched off.** Silence a clock to stabilise a measurement if you must, then
   run one pass with nothing silenced and assert the fight is still coherent.
2. **Effects are not readability.** Assert the reading: a zone exists before
   damage, one zone per attack, the body visibly winds up, the zone's origin
   tracks the actor that will hit you. Do it at the registry so a new move
   cannot skip it.
3. **A placeholder is not a deliverable.** If the art is still the primitive,
   say so out loud before deploying, and do not describe the feature as
   finished.
4. **Intermittent means the instrument is wrong.** Every single time, here.
   Find what it is really measuring; do not move the threshold.
5. **A/B every check against the build it replaces.** If it passes there, it is
   not testing the change.
6. **Look at it.** Screenshots caught what assertions could not, three times.
7. **Probe a theory before building on it.** One frame of measurement beats an
   afternoon of confident reasoning.
