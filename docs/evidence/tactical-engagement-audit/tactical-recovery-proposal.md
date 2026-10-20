# Tactical recovery — proposal, NOT implemented

Phase 3C-B. **Design only.** Nothing in this file exists in the game. Every
freeze recorded in `CLAUDE.md` / `HANDOVER.md` stands; nothing here revokes
one. The evidence it rests on is `tactical-engagement-root-causes.md`.

## The goal, in one sentence

An enemy recognises that its tactical decision is not producing engagement
— it is standing where its rule told it to and it cannot shoot — and makes ONE
purposeful attempt to fix that, with machinery the game already has.

Not a smarter enemy. Not a new combat state. Not a pathfinder. The failure is a
missing QUESTION in two hold branches ("can I shoot from here?"); the answer
already exists in the codebase, in the approved v2.2 movement of the Gunner
and the Rifleman, and neither subject calls it.

## The constraint that shapes everything: `Enemy.js` is frozen

`tests/enemy-frozen.mjs` (run by `smoke-roster-2b`) pins every class in
`Enemy.js` outside `EnemyBomber` byte for byte. `EnemySniper` and
`EnemyShielded` are among them. So, exactly like the Phase 3B / 3C stuck
corrections, any correction is a **per-instance seam**: a module in
`src/systems/` that shadows the bearer's own `_tickSwarm`, calls the frozen
tick FIRST and unchanged, and only then — in a narrowly defined state —
overrides the velocity the frozen tick wrote. Installed from
`GameScene.spawnEnemyAt`, behind an opt-in URL flag, ordinary actors only
(never a nemesis). Flag absent: nothing is constructed, and the run is the
frozen game tick for tick.

## Shared low-level service vs role policy

**Shared (pure, deterministic, built only from existing functions):**
`findFiringSpot(actor, player, opts)` — one small helper, e.g.
`src/systems/firingSpot.js`. Candidates on an ARC AROUND THE PLAYER at about
the actor's current range (its band clamped, ±80px), lateral steps of 40px up
to 480px each way, nearest first. A candidate survives only if:

* `actor._standable(x, y)` — the v2.2 standability test (world margin 36,
  every LOS rect +26), inherited by both subjects, unused by both today;
* `actor._hasLOS(spot → player)` — the same LOS the fire gate uses, plus the
  ±40px lateral lines that `_scoreSpot` already uses, so a one-step player
  shuffle does not immediately cancel the angle;
* the straight body path — `_scoreSpot`'s three-ray test (centre ± 0.8 × body
  radius), so the actor can WALK there without meeting a body;
* not within 60px of another enemy or another enemy's `_dest` claim (the
  v2.2 `DEST_TAKEN_PX` rule — two bodies on one good spot is stacking);
* not within 60px of the spot the actor just left (v2.2's "not straight back").

No `Math.random`, no jitter: with the flag on, the only change to the random
stream is the downstream consequence of an actor standing somewhere else.

The instrument's own version of exactly this search (`T.lineSpot` in
`tests/diag-tactical-engagement.mjs`) is what the root-cause numbers call "a
STRAIGHT-LINE band spot". It is measured, not imagined.

**NavGrid is NOT part of T1/T2.** The room is open (apart from one closed
45px gap and the two bunks that touch, every body pair is ≥85px apart; the
player was NavGrid-reachable in all 33,160 samples), the long blind
holds sit a median ~115px of path from a firing spot, and blocked movement is
a few percent of standing time. `findPath`'s fallback-to-target would also
need a reachability guard before it could be trusted for a destination. If a
T1/T2 handset run shows recovery attempts failing on ROUTES, that is T3 —
below — and not before.

**Role policy (per module, never shared):** when to ask, which band, what wins
priority, what to do on arrival, which actors are excluded.

## T1 — Marksman firing-angle recovery (`?marksmanAngle=1`, proposed name)

**When.** All of:

* the frozen tick took its HOLD branch (300 ≤ dist ≤ 640) — RETREAT and
  APPROACH are never touched, so the 300px retreat keeps priority and the 640
  approach threshold is unchanged;
* not charging (`_charging` false) — **it never moves during a charge**, so the
  800ms windup, the 260ms lock, the tracking laser, the locked shot angle and
  the cancel-on-LOS-loss semantics are all the frozen code's, untouched;
* not staggered, not performing a scripted move, no stuck sidestep live;
* `canSee(player) && _hasLOS(this → player)` has been FALSE continuously for
  `blindMs` (proposed 700ms — under one charge windup, above a doorway).

**What.** `findFiringSpot` on the band [340, 600]. If it returns a spot, COMMIT
to it: walk at `cfg.speed` (150px/s — deliberate, well under the player's
380), facing the player (the frozen tick already sets `_aim = toPlayer`).
The commitment ends — and the frozen hold's `setVelocity(0, 0)` stands again —
on the FIRST of:

* the line opens (`canSee && _hasLOS`) — stop where it opened; the frozen
  tick then starts the charge on its own schedule (its cooldown already
  counted down blind, so this is usually immediate);
* arrival (< 12px);
* the frozen tick leaves HOLD (the player closed inside 300 or broke past 640);
* a deadline (straight distance / speed + 500ms), or 150ms pressing a wall
  toward the spot — the spot is marked failed for that encounter.

If no spot exists, it waits, as it does today, and asks again after
`retryMs`.

**Anti-oscillation.** At most one commitment per `gapMs` (proposed 1200ms);
never back within 60px of the spot it left; a Marksman that just arrived waits
the full `blindMs` again before choosing anew. No circling, no dodging, no
flanking: candidates are on its OWN arc around the player, at its current
range, nearest first — it slides along the band until the line opens, which
is what a marksman changing angle looks like.

**Protected, by construction:** 300 retreat, 560 range, 640 approach, 800
windup, 260 lock, laser, shot angle, damage (220), cadence (`fireCooldownMs`),
LOS cancel, Regular / Elite numbers, the stuck block and both stuck candidates
(the angle walk is `setVelocity`, never `_moveToward`, so it never consumes or
arms a sidestep through the approach path).

**Expected, from the data:** blind standing in MIXED falls from 42.6% of a
Marksman's life toward what the Gunner and Rifleman show in the same fights
(2-5%), plus the time spent walking to the angle; the
longest blind hold falls from tens of seconds to about `blindMs` + walk time;
Marksman attempts per minute rise. **Marksman hits on the player will rise
too** — a Marksman that can shoot does. No damage or cadence number changes,
but the encounter gets harder, and that is a handset judgement.

## T2 — free Bulwark pressure-angle recovery (`?bulwarkAngle=1`, proposed name)

**Who.** Ordinary `shielded`, Regular and Elite, **without** `vanguardScreen`
(the module is not installed on a screen at all). Never the nemesis.

**When.** The frozen tick took the free HOLD (dist ≤ 290), not staggered, no
live sidestep, and the line has been blind for `blindMs` (proposed 600ms).

**What.** `findFiringSpot` on the band [140, 280], **at the current range or
closer first** — the Bulwark is frontal pressure, so it should resolve a cut
line by pressing round the obstacle, not by backing off. Two extra rules:

* **keep the front toward the player** — reject a spot more than 60° round the
  player from its current bearing. Along its own arc the bearing to the player
  changes slowly (51px at 290px is 10°), and the frozen shield turn (2.6 rad/s,
  untouched) tracks that with room to spare, so the shield stays on the player
  and its back is never offered;
* commit / stop / anti-oscillation exactly as T1.

**Protected:** hp, speed (140), arc, turn rate, block and Super interactions,
the frozen fire pipeline and cadence, and Bulwark 3B Candidate B (installed
alongside it, untouched).

**Known residue, not addressed by T2 (cause E):** the Bulwark's cooldown does
not run while it is blind, so a reacquired line still owes up to 1.8s before
the 300ms WARN. If a T2 handset run reads as "it moves, finds a line, and still
does not shoot", the smallest further step is in the fire pipeline — and that
is a cadence change, so it is the human's call, not a T2 side effect.

## VANGUARD — formation ownership comes first

Rules, all structural:

1. **A screen is owned by its formation.** Every Bulwark drawn while VANGUARD
   runs carries `vanguardScreen` (`spawnAtGate` stamps it at draw time), and
   T2 is not installed on any of them. VANGUARD contains no Marksmen. So
   VANGUARD is outside T1 and T2 by ABSENCE, the same way the boss room is
   outside the encounter layer — not by an `if` that could drift.
2. **The front's staging is untouched.** `_vanguardFront` reads the two
   opening shields; both are screens; neither module sees them.
3. **The screen's blind holds are REPORTED, not corrected.** A screen standing
   blind is 13.5-21% of screen life in the reconstruction, 85-89% of it in the
   formation hold, and the long ones (24-27s) are behind the Hangar's crates
   while the player hides. Whether a screen should
   ever re-angle is a VANGUARD design question with its own approved gates
   (§10au-§10aw) and needs its own handset verdict.
4. **The Captain is a Champion.** Neither module touches it.

## T3 — shared navigation, only if T1/T2 evidence demands it

A reachability-checked variant of `_navigatePath` — the existing follower, with
the one change that a `findPath` result of a single node in a different cell
means NO ROUTE (reject the destination) rather than "walk straight at it".
Justified only by T1/T2 runs that show committed recovery attempts failing on
routes; the present data does not show that in Detention. Not a new pathfinder,
and not a NavGrid change (its 23px agent clearance is recorded engine debt).

## Order, and why

**T1 first.** The Marksman is the larger failure by a distance (42.6% of its
life blind against the Bulwark's 20.1% in MIXED, 46.6% in SNIPER NEST), it is
the human's specific complaint
("snipers only have push pull tied to me, nothing else"), and it fails on both
of the compositions it leads (MIXED and SNIPER NEST). **T2 second**, reusing the
same helper with its own policy. **T3 only on evidence.** Reordering is not
justified by the data.

## Deterministic tests a T1 implementation would carry

1. Flag absent: nothing installed; MIXED and SNIPER NEST replay tick for tick
   (hash + draw counter) against the frozen tree.
2. M1 (clear line): flag on is tick-identical to flag off — a Marksman with a
   line never moves differently. **This is the regression that matters most.**
3. M2 / M2e / M3 / M7 (blind holds): a commitment starts no earlier than
   `blindMs`; the chosen spot is in the band, `_standable`, has a line, and is
   straight-walkable; a charge starts within `blindMs + walk + windup`; blind
   standing over 20s drops below a stated bound.
4. M5 (retreat into cover): no commitment while dist < 300.
5. M6 (LOS flicker): no movement during any charge; charge cancellations no
   higher than frozen.
6. Anti-oscillation under `hop` and `circle`: ≥ `gapMs` between commitments, no
   return to the spot just left, commitments per minute bounded.
7. RNG: the module draws nothing (counted around its own code).
8. Exclusions: nemesis Marksman, every other archetype — not installed.
9. Combined with `?marksmanStuck=early`: both work; neither changes the other's
   counters on M1.
10. The encounter matrix of this diag, re-run with the flag: blind share,
    longest blind, attempts, hits — REPORTED, never asserted (the bot is not
    the balance authority).

T2 carries the same shape, plus: screens never get a module velocity (the
VANGUARD encounters are tick-identical with the flag on and off), the player
stays inside the shield arc ± a margin throughout every commitment, and the
B7 / B7b screen cases are unchanged.

## How the human would judge it

The 3C handset question failed on "I don't even notice much between original
and candidate B". The T1 question is visible by design: **hide behind the
checkpoint console in MIXED, Detention, sector 12, wave 2 and count to two.**
On the frozen build the Marksmen stand still for as long as you stay there.
With T1 one of them should walk a short way along its arc, its laser should come
up, and you should have to move. Failure looks like: circling, sidestepping
for no reason, two Marksmen arriving on the same spot, a Marksman walking into
melee range, a laser that fires faster than before (it must not — cadence is
untouched).
