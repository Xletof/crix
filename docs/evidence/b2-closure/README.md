# B2 Closure — tracer fix, Super on F release, Super visual progression

**Status:** delivered for HUMAN handset testing (2026-11-16). B2-B stays the preferred balance; its mechanical tuning is unchanged (proved tick for tick below). The new input and visuals are a CANDIDATE behind `&b2c=1`; without it, B2-B plays exactly as delivered in B2-1 except for the tracer bug fix. Nothing here is a default; R1, V2C, P1, P2-A3 are untouched.

## Playtest links (two)

1. **Candidate — B2-B + tracer fix + F release targeting + new Super visuals:**
   https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b2c=1&b0=B2C
2. **Current B2-B — tracer fix only (F press casts, B2-1 visuals), for comparison:**
   https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b2=B&b0=B2B

Optional on either link: `&b2range=1` = the firing range; `&b2dbg=1` = the tracer diagnostic overlay.

## HUMAN testing checklist

1. **Empty-space shooting and tracer attachment** (firing range, `&b2range=1`):
   - Spawn SQUAD, kill it, then hold fire into empty space in several directions, near crates and the arena edge, and while turning.
   - Every streak should leave the barrel and stay on its own straight path. No streak should appear beside the hero, at an old kill site, or hang in place.
   - A round still flying after you let go is real and keeps going along its line, ahead of the hero. That is expected, not the bug.
   - Add `&b2dbg=1` to see the barrel (yellow), the gameplay spawn point (green), each round's path (cyan) and each finishing streak (orange) with where its round stopped (red x). The panel's BAD counter should stay 0.
2. **F tap versus hold, pivot, release** (desktop, candidate link):
   - Tap F: the Super fires on the release, at the nearest enemy in reach. **This changed:** in B2-1, F fired on the press along the hero's current aim or facing, so a Super cast while streaming with SPACE went where the stream was going. The tap now uses the touch button's shipped rule (nearest, no line-of-sight check).
   - Hold F: nothing fires. The cone appears, the nearest enemy is locked (diamond).
   - While holding, turn with the **mouse** (or WASD): enemies the cone passes over get brackets, then lock. Earlier locks stay.
   - Release: one Super. Each locked enemy takes one pellet aimed straight at it.
   - Holding SPACE at the same time keeps the gun firing.
   - Alt-tab or pause while holding: nothing fires.
   - Touch: tap the Super button = nearest; hold and drag = targeting along the drag; lift = one Super.
3. **Super indicator readability in crowded combat** (HORDE on the range, or a real wave):
   - The gun's bolts keep one colour now. As the Super charges, a cool blue thread fills each bolt from the head back, and a small ring pops at the barrel at each quarter.
   - Full charge is shown only by the approved P1-B ring.
   - Do the cone, brackets, diamonds and tethers read in a crowd at phone size? Is the release flash (ice-violet) distinct from enemy red?

## P0 — the displaced tracers: root cause and fix

**Root cause (reproduced, and the only cause found).** The presentation layer (`src/systems/b2Feel.js`) recorded where a round touched an enemy in a `WeakMap` keyed by the **bullet object**. Bullets are pooled: the same object carries round after round, and the map entry was never cleared or tied to a round.

When a recycled bullet later missed (empty space, range expiry, a wall), its streak's end point was read from the map: its **previous life's enemy contact**. The game then drew a full-brightness streak ending at that old kill site, along the new round's heading. It appeared beside the hero or across the room, detached from any live round. Hits, damage, collision and aim were never affected: it was purely the drawn end point.

It only shows **after body contacts**. That is why the human saw it on the range after killing groups and then shooting into empty space. In the footage (clip times), off-line streaks flicker beside the blue canister at 2.0–3.4 s and 4.9–6.1 s, which are inside the brief's 18–22 s and 25–32 s if those are original-recording times. Spikes sit beside the stream at the crate at 9.0 s, and streaks beside old splats at 15.3–16.5 s.

**Fix** (presentation only):
- each contact carries the round's generation (`b._gen`);
- it is consumed when its own round ends, and cleared when a new round leaves that bullet;
- a grazing hit's contact is projected onto the round's own path.

**Evidence.** The instrument was committed first (`6e096af`), so before and after use the same tool. The matrix is `tests/diag-b2-tracers.mjs`.

| Scenario | Before (BAD / checks) | After |
|---|---|---|
| Stationary, 8 directions, empty space | 0 / 1428 | 0 / 1428 |
| Rotating 360°/s while firing | 0 / 913 | 0 / 913 |
| Kill a squad, then blank-space bursts | **194** / 1420 (max 346px off) | 0 / 1510 |
| Into cover and the arena edge | **64** / 171 (max 743px off) | 0 / 133 |
| Dense combat (2× HORDE), auto-aim | **146** / 504 | 0 / 517 |
| Kills, then walk + fire into empty space | **237** / 1409 | 0 / 1494 |

- **Invariant checked on every visible streak, every frame:** it lies on its round's origin→collider line, never reaches behind the barrel, its live head is the collider, and a finished streak ends where its round stopped (or at the body it hit).
- **Images:** `tracer-before/stale-*.png` (a detached streak at an old kill site, overlay on); `tracer-after/after-kills-*.png`; side by side in `tracer-before-after.png`.
- **Physically correct, not changed:**
  - parallel tracks from a moving shooter (rounds keep the heading they left with);
  - a wall hit's spark thrown back toward the shooter;
  - a blind stream from the keyboard holding its heading (`_facingLockMs` re-locks on every shot; the fire stick or the F-targeting mouse pivot steer it).

## P1 — the Super on F release (candidate, `src/systems/b2Super.js`)

- **Tap** (released within 160ms): one Super on the release, the shipped 5-pellet 30° fan at the nearest eligible enemy, 600 per pellet. The pellet angles were checked to 1e-6 rad against the shipped fan. The aim rule is the touch button's shipped release: nearest, no line-of-sight check. B2-1's keyboard F instead fired on the press along the current aim or facing.
- **Hold:**
  - keydown arms targeting, and the nearest eligible enemy is locked at once;
  - the cone (±22°) pivots by the mouse once it has moved 24px, by a touch drag, else by the movement direction;
  - an enemy that stays 110ms inside the cone is locked and stays locked, up to 5 (one per pellet);
  - keyup casts exactly once.
- **The fan's centre at release.** It follows the heading only after an EXPLICIT aim (the mouse moved on purpose, or a touch drag). Otherwise a held move key or a pushed move stick only steered the cone, and the fan aims like a tap: at the first lock, else the nearest enemy. So a hold never throws the Super away from the fight.
- **Locks and pellets:** every lock of a hold, a lone one included, takes the nearest free pellet, re-aimed straight at it as the blast leaves. That is one directed pellet per locked target: never two on one target, never more than five.
- **Unchanged:** the cast still runs through the frozen `firePlayerSuper` → `_superBlast` path. Damage, speed, range, pierce, knockback, charge, cooldown and eligibility are untouched.
- **Cancelled with no cast and nothing left armed:** key repeat (ignored), focus loss, pause, death, a suppression, the meter emptying, a lock dying (dropped, the cast still happens), nothing in reach (the tap still casts), not charged (nothing happens).
- **Touch:** the Super button's tap / hold / drag / release feeds the same state machine.
- **Camera:**
  - a keyboard hold sets no `superAiming`, so no camera movement and no red cone are added;
  - a touch hold sets `superAiming` as the shipped touch hold did, so the frozen camera's lead is unchanged. The red aim cone it would bring is hidden (GameScene's `drawAimCone` runs with the flag lowered).
  - In a sideways touch drag at phone size the locks stay on screen (`candidate/touch-sideways-held.png`).
- **Never added:** forced aim, slow-motion.
- **Not changed:** the release still commits the shipped camera behaviour that every cast has.

**Power (measured, `smoke-b2c` §7).** The staged crowd was five Riflemen spread over 120° plus a Gunner, each at its real HP.

| Cast | Damage | Kills |
|---|---|---|
| Tap | 832 | 2 / 6 |
| Hold with 5 locks | 1,870 | 5 / 6 |

Per-pellet damage is unchanged, but **locking makes a Super much stronger against spread-out enemies.** That is inherent in lock-on, and it is a balance consequence for the human to judge. B2-B's economy does not let Super damage charge the Super, so this adds no feedback loop.

## P2 — the Super visual progression (candidate)

**Interpretation.** I read "thin red strips that become bright white fireworks" as B2-1's charge ramp on the gun's own bolts: they whitened and bloomed as the Super charged. The striped Super pellets are not part of it and were not changed.

Player-owned colours: ice-white `#eef8ff`, violet `#8c9cff` (P1-B's ring and pawl family), a dark keyline. No red anywhere in the targeting graphics (tested).

| Stage | What is drawn |
|---|---|
| Building charge (the gun) | The bolt keeps **one** colour (the hero's warm red). A cool blue thread in P1-B's charging-gauge colour fills each bolt from the head back, as long as the charge when it was fired. A ring pops at the barrel at each quarter of the meter. The white-gold ramp, the streak halos, the orange impact pools and the primed rim are gone. |
| Ready | The approved P1-B ring only (untouched) |
| 1 Preparation | After the tap window, a faint cone: two ice-white rays to the Super's reach, a violet arc, and ticks along the heading so the pivot reads |
| 2 Acquisition | Violet corner brackets close in on an enemy as its 110ms dwell fills |
| 3 Lock | An ice-white diamond with a dark keyline and a violet core; one pip per lock order; a violet tether to the hero |
| 4 Release | Every lock pops; its tether flashes and retracts along the shot. The cast's warm screen flash becomes an ice-violet one (candidate only). Pellets, sparks, shake and punch are unchanged. |
| 5 Impact | A locked target hit by its pellet throws one violet ring and one ice ring; the mark is gone |

Frames are in `candidate/` (phone size, 390×844 @2x): `cand-1-stream-charging`, `-2-targeting`, `-3-locked`, `-4-release`, `-5-impact`, `charge-thread-0-1-2-3`.

## B2-B unchanged (P3)

- **Seeded fights:** `?b2=B` fights (MIXED s6, SWARM TIDE, MIXED s6 with god mode off; 1,500 ticks each; a held stream plus four F-press Supers and a Broken Wings chain) are **identical tick for tick to `2ee948c`**: positions, hp, ammo, meters, every enemy, bolt and pellet, `Math.random` draws and events.
- **Tuning:** `B2_DEFAULTS` (weapon, economy, impact) is identical to `2ee948c`.
- **The candidate with no Super input:** identical to B2-B tick for tick. Display-list bookkeeping is excluded, because the candidate creates different pooled images.

## Validation

Logs are in this folder (`suites.txt`).

- `smoke-b2c --old=2ee948c`: **46 / 46**. It covers the 0–9 sections above, including unaimed holds with real keys (D, D+SPACE), a two-finger touch hold, a red-cone control, restart twice / quit to title under `b2c`, and a touch hold dropped by the HUD's resume reset. The last check was A/B'd: with the guard disabled it fails, because the hold stays armed with the camera lead on.
- `smoke-b2 --old=2ee948c`: 88 / 88 (flag-off identity, the B2-1 weapon, economy, controls, telemetry, presentation).
- `smoke-b1 --old=2ee948c`: 71 / 71.
- `smoke-b0 --old=2ee948c`: 46 / 46.
- P2-A frozen-file sections: `smoke-fx-p2a3` 4 / 4, `-p2a` 4 / 4, `-p2a2` 3 / 3.
- `smoke-controls`, `smoke-restart`, `smoke-cluster`: pass.
- `smoke-captel`: 20 / 22. The same two real-time Super-cast checks fail at HEAD and on `2ee948c`, so they are inherited and intermittent. Captel runs without any B2 flag.
- `run-all` (52 suites): not re-run.

## Deploy

- `FRIX` was fast-forwarded `2ee948c..d84a9b5`; Pages run #298 succeeded.
- **Production bundle check.** The bundle (`npm run build`, served locally) was driven in its real loop with real clicks and keys: no console or page errors on either link or with no flags. On the candidate, SPACE + F hold showed the cone and a lock, and the F release cast. On B2-B, F press cast at once (`production-bundle-real-loop.png`).
- The live Pages site cannot be opened from the build container.

## Files

| File | Change |
|---|---|
| `src/systems/b2Feel.js` | P0 fix; the tracer invariant; the `b2dbg` overlay; candidate charge visuals |
| `src/systems/b2Super.js` | **New:** F-release targeting, lock fan, targeting visuals |
| `src/systems/b2Flagship.js` | Installs `b2Super` under `b2c`; F press only without it |
| `src/systems/b2Voice.js` | `lockTick` |
| `src/systems/debug.js` | `b2dbg`, `b2c` parsed inside `setB2` (BootScene unchanged) |
| `tests/smoke-b2c.mjs` | **New** |
| `tests/diag-b2-tracers.mjs` | **New** |
| `tests/b0-scope.mjs` | `b2Super.js` added to B2's modules |

GameScene, BootScene, `Enemy.js`, entities, config, data, HUD, P1 / P2-A modules: unchanged.

## Limitations

- **Untested on a handset.** All verification ran in the harness and a phone-sized viewport.
- **App-switching on a phone:** the hold cancels on window `blur` and the scene `pause` (tested with a synthetic `blur`). Phaser's `hidden` (visibilitychange) and a `touchcancel` are not hooked or tested. A touch hold the HUD resets on resume is cancelled (tested).
- **Locking strength:** it raises the Super's effect on spread crowds (above).
- **Coarse keyboard pivot:** WASD pivots the cone in 45° steps; the mouse gives a fine pivot and also aims the fan. Mouse pivot needs the pointer to move 24px after F goes down.
- **Footage inspected.** `Firing Range.mp4` is 55.4 s long. Its filename says it was trimmed from 0:19.3–1:12.1 of the original recording, so the brief's windows most likely refer to the original.
  - **Original 18–22 s ≈ clip 0–3 s.** Blank-space fire into the railing. At clip 2.0–3.4 s, short streaks at the stream's angle keep flickering beside the blue canister by the crate, every 2–4 frames, entirely off the stream's line (`tracer-before/footage-clip-1.95s-offline-streaks.png`, 60 fps).
  - **Original 25–32 s ≈ clip 6–13 s.** The same off-line streaks at the canister at clip 4.9–6.1 s, the last of them after the stream has stopped. Then the 9.0–9.27 s crate case: short spikes beside the stream, pointing along the heading, forward of the muzzle, lasting 4–8 frames.
  - Both are what a stale contact draws: a streak along the new round's heading, ending at the bullet's previous life's contact point. They recur at one spot because pooled bullets carry contacts from kills there.
  - **If the windows were clip times instead** (clip 18–22 s and 25–32 s: a spawned squad under targeted fire, then fights after multi-kills), the streaks there are on their lines.
  - **Caveat:** two things stay by design, because they are real rounds: a round still flying ahead of the hero after the trigger is released (e.g. clip 25.0 s), and parallel tracks from a moving shooter. If the remaining complaint is about those, a `&b2dbg=1` screenshot would settle it.
- **Frame rate read:** clip 0–15.5 s at 15 fps, the cases above at 60 fps, the rest at 2–6 fps.
- **The 9.0 s situation, re-staged on the fixed build** (kills at a crate, then a stream straight into it): 16 frames show no side spikes, and the invariant holds (206 checks, 0 bad). See `tracer-after/crate-repro-sheet.png`.
- **Thin cues:** the charge thread and quarter rings are subtle by design. At phone size the thread reads; the ring is small.
- **One-time red flash:** the first loud event in a room still flashes red ("DETECTED"). That is the room alarm, not the Super.
- **Super pellet art:** the striped red-white pellets are the shipped art and were not redesigned.
- **Inherited, not fixed:** every scene restart leaves one more `pause` listener on the Game scene, on plain R1 too (smoke-b2c counts only the candidate's own listener, which stays at one).
