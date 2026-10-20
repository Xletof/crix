# Failed handset gate — what the recording showed, and what this pass can say about it

Phase 3C-B. **Diagnosis and design only — no gameplay file changed.**

## The verdict being answered

The human rejected the Phase 3C result after playing **MIXED ASSAULT, Detention
Block, sector 12, wave 2** with
`?encdbg=mixed&room=detention&sector=12&wave=2&roster=v1&gait=v2&move=v22&marksmanStuck=early`
and recording it as `Recording 2026-10-20 135214.mp4`:

> "They keep waiting instead of attacking me or going around visual obstacles.
> I don't even notice much between original and candidate B. It feels like
> snipers only have push pull tied to me, nothing else. The recording is a big
> fail."
>
> "Shielded enemies do same if you noticed."

## The recording is NOT available here

`Recording 2026-10-20 135214.mp4` is not in the repository, not in the session's
uploads and not anywhere on this machine's filesystem (searched by name and for
any `.mp4`). **Nothing in this folder is an observation of that video.** Every
number and every film below is a RECONSTRUCTION: the same URL, the same room,
the same sector and wave, the real spawner, the real AI, driven by an
autopilot player — and that is a different thing from what the human saw.
Where the reconstruction can only stand in for the recording, this file says
so.

## How the encounter was reconstructed

* **The real room and the real spawner.** `tests/diag-tactical-engagement.mjs`
  boots the game with the human's flags and `?encdbg=mixed&room=detention&sector=12&wave=2`
  and runs the wave the URL starts, seeded, on a 60Hz fixed step, in god mode
  (a death cannot cut a measurement short — so damage is COUNTED, not felt).
* **The roles are read from the runtime, not assumed.** MIXED in Detention at
  sector 12 composes from the room's own mix roll; across three seeds the
  first-wave population included 4-6 Marksmen (`sniper`), 2-3 Bulwarks
  (`shielded`), Gunners (`shooter`), Riflemen (`grunt`), Elites of each and,
  on one seed, a Swarmling pack. Every tracked actor is labelled by its
  `enemyType` in the CSV and on film. **Not every stationary body is a
  Marksman**: the Gunners and Riflemen in the same fights are tracked as a
  CONTROL and are measured separately.
* **A player who moves through and around furniture.** Seven autopilot
  behaviours, each driving the real player with real W/A/S/D, real physics and
  real collisions, routing round consoles on the room's own NavGrid, firing an
  auto-aimed shot every 7 ticks: `handset` (hide behind one checkpoint console,
  step into the open, hide behind the other, step out), `hide` (stay in the
  shadow of the nearest console), `circle` (orbit a console), `hop` (switch
  between the two checkpoint consoles every 4s), `charge` (run at the nearest
  Marksman / Bulwark), `retreat` (to the far corner) and `behind` (loop the
  room's edge). Three seeds each, three variants (frozen, `?marksmanStuck=early`,
  `?bulwarkStuck=early`), 40s per run.
* **Instrumented on the actual methods.** The instrument wraps each Marksman's
  and Bulwark's OWN `_tickSwarm` and `_moveToward` and calls straight through;
  it reads `canSee` and `_hasLOS` exactly as the tick is about to, and the
  velocity the tick commanded. It writes nothing and draws no random number:
  the same seed with the recorder on and off produces the same trace, tick for
  tick (`--check`: first divergence -1 over 2,400 ticks), and adding the
  Gunner / Rifleman controls left every Marksman and Bulwark track
  byte-identical to the run without them.

## What the reconstruction reproduces

**The human's description is reproduced, and it is not a stuck-recovery
problem.** In the reconstructed MIXED fight (21 runs per build, all seven
player behaviours pooled):

* the **Marksman** spends **42.6% of its life standing still with the line to
  the player cut** — 97% of that inside its hold band — ready to fire (its
  cooldown counts down blind and sits below zero), waiting for the player to
  walk back into the open. With `?marksmanStuck=early` (the handset URL) it is
  **41.0%**. Candidate B changes nothing here because nothing here is stuck:
  the body is exactly where its rule says to stand.
* the **Bulwark** spends **20.1%** of its life the same way (22.2% under the
  handset URL, 19.0% under `?bulwarkStuck=early`). Its rule stops it at 290px
  and does not ask whether it can shoot from there.
* **the Gunners and Riflemen in the same fights stand blind 4.7% and 2.1%** —
  their approved v2.2 movement chooses spots by whether a shot exists from
  them. That control is what isolates the cause.
* when the player stays behind a console (`hide`), the median Marksman's
  longest blind hold is **31-33 seconds** of a 40-second run — the whole fight.
* every Marksman blind hold of three seconds or longer had a firing spot the
  instrument could reach on the NavGrid (61 of 61, frozen; nearest a median
  119px of path), and 57 of 61 had one walkable in a straight line along its
  own band — at some moment in the hold, a median **40px** step away.
* "**snipers only have push pull tied to me**" is literally the source: the
  Marksman's whole movement policy is three distance bands around the player —
  closer than 300 back straight away, farther than 640 walk straight in,
  otherwise stand still (`EnemySniper._tickSwarm`, `Enemy.js:2069`). Its
  position is a function of the player's distance and nothing else.

The staged cases make the same point without the noise of a fight
(`tactical-staged.csv`, two seeds each, identical results): a Marksman 520px
from a player standing behind the heavy console (M2) attempts **zero** shots in
20 seconds, on both builds; so does the Elite (M2e); so do two of three
Marksmen in M7; a Bulwark closing on the same player (B2) stops at 289px, 98px
of path from a firing spot, and stands for 18 seconds.

## What the reconstruction cannot say

* **Which moments of the recording these are.** No video, no timestamps. The
  reconstruction shows the failure exists, how much of a fight it occupies,
  and why; it cannot point at the frame the human reacted to.
* **What the human's own movement was.** Seven scripted behaviours bracket it;
  none of them is it. `handset` was written to be "a person in Detention", and
  is still a script.
* **How it felt.** God mode counts hits; it does not feel pressure. Whether a
  Marksman that reaches a firing angle reads as *attacking* rather than as
  *teleporting the threat sideways* is a handset question.
* **Whether the visual size of the furniture mattered.** Consoles draw 112×112
  over a 70×70 body, the bunks and the post draw tall visual tops over short
  bodies (`engagement-callpath-matrix.md`). The human said "going around
  visual obstacles"; whether their mental model of where the enemies could see
  matched the 70×70 truth is not observable from here.

## Where to read on

* `engagement-callpath-matrix.md` — what each role's tick actually reads and
  decides, and how every obstacle in the room is represented.
* `detention-obstacle-map.png` — the room as each system sees it.
* `tactical-engagement-root-causes.md` — the causes, separated and quantified.
* `tactical-recovery-proposal.md` — the smallest corrections, staged, for the
  human to choose from. **Nothing proposed there is implemented.**
* three verified films (each is replayed headless afterwards and must match
  the measured run tick for tick; labels and lines are read from the
  instrument's own row for that tick):
  * `marksman-passivity.webm` — M1 (open line: charges, locks, fires) beside
    M2 frozen, M2 on the handset URL, and M7: in its band with the line cut, a
    Marksman neither moves nor fires for 15 seconds, and Candidate B is
    indistinguishable from the frozen game — which is what the human said.
  * `bulwark-passivity.webm` — B1 (open line) beside B2 frozen, B2 under the
    approved `?bulwarkStuck=early`, and B5: the Bulwark walks in, stops at
    290px behind the console and stands; three do the same.
  * `mixed-handset-repro.webm` — the reconstructed MIXED fight, frozen beside
    the handset URL, with the `handset` pilot (hides 2.5s at a time behind a
    checkpoint console, steps out, hides behind the other). Every hide drops
    the Marksmen and Bulwarks into LOS-BLOCKED holds with a reachable spot
    marked nearby, and they wait for the player to step out. The 30-second
    waits belong to the `hide` behaviour — measured, not filmed.
* `tactical-engagement-metrics.csv` — every staged and encounter row.
