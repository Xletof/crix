# Evidence — Vader's saber as a light source (LIGHTS OUT only)

Produced by `tests/shot-saber-glow.mjs` against a live endless sector-30 fight
(Vader 6). Raw numbers in `saber-glow.json`.

## What the brief asked, and what these files answer

The dark arena was approved **structurally** and rejected **artistically**: the
room loses power, but nothing in it starts *behaving* like a light, so Vader
reads as a black body holding a bright red line. This pass is bounded to the
saber. The arena's own emissive vocabulary — four cover consoles and one prop —
belongs to the map overhaul.

## The matched A/B

`ab-1-dark-no-glow.png` and `ab-2-dark-with-glow.png` are **one frozen frame**
(`scene.pause()`), one change. "Before" is produced by hiding the two layers
this pass added, which is exactly what the approved build is — not by zeroing a
config the page may have imported as a different module instance.

| region | Δ luminance | Δ red excess |
|---|---|---|
| the blade | **+10.15** | **+22.18** |
| the darkness immediately around it | +3.69 | +8.03 |
| the wide neighbourhood | +1.22 | +2.65 |
| Vader's own body (behind the emitter) | +0.40 | +1.09 |
| far corner of the room | **0.00** | **0.00** |
| whole viewport | +0.26 | +0.55 |

The far corner reading exactly zero is the load-bearing number: this is a
**local** light, not a global exposure change. The viewport moving +0.26 says it
does not blow the frame out. Vader's body is *behind* the emitter, so any change
there is spill and cannot be the blade itself.

Both A/B frames contain the same live SUNDER telegraph. It is identical in both,
so it cancels out of every delta; it is simply the frame the pause landed on.

## One pose, three layers

`poses` in the JSON: eight combat states — aim, parry, DEFLECTION stance, super
power-sweep, SABER COMBO, throw-after-catch, VANISH's spin, silhouette. In all
eight the halo and the bloom carry the blade's **exact** x, y and rotation,
sampled from inside one frame on `postupdate`. Two `page.evaluate` round trips
compare poses 200–400ms apart and on a walking boss can never agree — that reads
as a glow that does not follow, and it is a measurement bug, not a game bug.

VANISH is in the list deliberately: it *tweens* `weaponSprite.rotation`, which is
the case a reader running in `preUpdate` would be a frame stale on.

## One saber, one owner

`seq-06-saber-throw-away.png` is the strongest single frame in this directory.
Vader is at the top, **completely dark and unarmed**. The blade is 246.6px away
and is the only lit thing in the room. Measured: `saberAway true`,
`hasSaber false`, halo distance from his hand identical to the blade's
(246.6px), two glow layers total, both on the flying sprite. There is no
phantom glowing saber left in his hand, by construction — the light is anchored
to the sprite, and the sprite *is* the saber.

## The silhouette (§18)

`seq-08-silhouette-blade-across-body.png`. Blade depth 716.5 < Vader 717.5 <
spill 718: the blade draws *behind* him (the facing-north depth rule) and the
spill lands across the front of him. His body stays fundamentally dark; his
shoulder and helmet edges come back out of the saber's own light. No rim light
was added to him — the brief forbade one, and a rim light would survive the
blade being thrown across the room, which is exactly the lie to avoid.

## Sequence

| file | what it shows |
|---|---|
| `seq-01-aim-stationary` | the stationary read: what the player looks at most |
| `seq-02-parry` | the follow-through gesture, mid-arc |
| `seq-03-deflection-stance` | the guard, held off his aim line |
| `seq-04-super-power-sweep` | the throw's dedicated saber sweep |
| `seq-05-saber-combo` | the blade swung across his own body |
| `seq-06-saber-throw-away` | **the blade away, and the light with it** |
| `seq-07-vanish-spin` | the tweened-rotation case |
| `seq-08-silhouette-blade-across-body` | **§18: the silhouette recovered from the weapon** |
| `seq-09-eclipse` | three clones with no saber, one man with one |
| `seq-10-lights-returning` | the 420ms restoration swell |
| `seq-11-normal-arena-again` | back to the approved presentation |
| `ab-3-normal-light` | normal lighting, both layers absent |

CHARGE and OVERHEAD SLAM are not photographed separately: they are his own state
machine and their blade is written by the same one writer as `aim`, so the pose
invariant already covers them. VANISH is the strictly harder case and is here.

## Afterimages

`eclipse`: 3 clones, **0 with a visible weapon, 0 with a glow layer**. Clones
already carried `weaponSprite.setVisible(false)` before this pass — they have no
saber, so they get no light, by the contract that was already there. This does
not create a new "the real one has the glowing saber" rule; it strengthens an
existing signal. The approved identification cues (threat ring, hp bar,
surviving a hit) are untouched.

## The console prototype

`consoleGlow` visible at depth 3 over 4 consoles. One Graphics for the whole
room, three additive rings each, blue — crimson is the danger colour and belongs
to the saber and the telegraphs. Redrawn only on a state change, so a held dark
room costs nothing. `LIGHTSOUT.consoleGlowAlpha: 0` removes it entirely.

## Ways this rig lied first

- **A dropped `page.evaluate` argument.** `forceDark` never received `on`, took
  its early return, and every shot photographed a lit room while every probe
  reported the glow missing. Two full runs went into a bug that was never in
  the game.
- **Display names instead of registry ids.** `_castBossMove(b, 'SABER THROW')`
  returns null — the id is `saberthrow`. A refused cast is indistinguishable
  from a move that ran and did nothing.
- **A `matches` check comparing `p.w.rotation`, a key that does not exist**, so
  every pose reported a mismatch on numbers that were in fact identical.
- **`hush()` sweeping the enemies** — which includes ECLIPSE's own clones, so
  the composition measured zero clones after spawning three.
- **The rig's own forced darkness being cancelled** by a real activation's 2.6s
  turn-off landing underneath it.
- **A full-screen hurt flash photographed as a flat red rectangle**, and on a
  paused scene it never fades.
