# B1 — Combat Experiments (`?b1=G|M|S`)

**Status:** three opt-in variants delivered for HUMAN playtesting (2026-11-10). They are experiments only: not approved, not frozen, not a default. R1 stays the production game, and V2C / P1 / P2-A3 stay as approved. The B0 build `a3866f2` and its recordings remain the comparison baseline.

HUMAN authorization (2026-11-10), condensed:

> Implement three opt-in, isolated B1 combat variants for HUMAN playtesting … HUMAN approval applies to these experiments only, NOT permanent gameplay changes or promotion to the production default.

## Playtest links

All three run R1 gameplay plus the variant, over the approved V2C + P1 + P2-A3 visuals, with the B0 recorder on. The recorder label equals the variant.

- **B1-G — Gun-only control:** https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b1=G&b0=G
- **B1-M — Moderate Super:** https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b1=M&b0=M
- **B1-S — Full crowd-control Super:** https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&b1=S&b0=S

**Handset instructions.** These are the same as B0, with one change: end a run by pausing, then **B0 DATA → Share JSON** (or QUIT TO TITLE). Don't end it by dying, so no censored sector enters the data.

- The bottom tag reads `B0·G #n mm:ss` (or `·M` / `·S`).
- **Hold-to-fire:** hold the aim stick (or SPACE) for more than 0.16 s and STANDARD repeats. A quick tap still fires one shot.

## What each variant changes

| | STANDARD | Super on ordinary enemies | Super on nemesis / Shock Captain / Vader |
|---|---|---|---|
| R1 (no flag) | 3 rounds, 120 ms, 520 ms/round, tap only | 600 / pellet, R1 knockback | R1 |
| **B1-G** | **10 rounds, 110 ms cooldown, 260 ms sequential regeneration, hold-to-fire**; damage 120 | R1 | R1 |
| **B1-M** | as B1-G | **300 / pellet; push ~90 px; −25% movement for 1.5 s** | R1 |
| **B1-S** | as B1-G | **150 / pellet; push ~180 px; −40% movement for 2.0 s** | R1 |

"Ordinary enemies" means Regulars, Elites and Bulwarks. A nemesis, the Shock Captain, Vader and Vader's afterimages keep the R1 Super exactly.

**The same in every variant:**
- the single 5-pellet discharge, piercing, chaining and self-recharge (every pellet hit still charges the Super and Broken Wings);
- the charge economy;
- OVERRIDE (it never auto-repeats);
- Cluster and Broken Wings;
- enemy hp, AI and encounters;
- camera, arenas and visuals.

No damage-vulnerability multiplier is added.

## Mechanics (`src/systems/b1Combat.js`)

- **STANDARD tuning.** `BootScene` writes `PLAYER.ammoMax / fireCooldownMs / ammoReloadMs` once, only under the flag. Every reader (Player, the HUD pips and reload bar, the respawn refill) then agrees. A reload restores R1.
- **Hold-to-fire.**
  - After a 160 ms arm, STANDARD repeats at its cooldown. It follows the stick angle when dragged, or auto-aims the nearest enemy when held still; on desktop, SPACE held does the same.
  - A hold that fired adds no shot on release. A tap releases exactly as R1.
  - Never with OVERRIDE or the cluster pod equipped.
  - SPACE with a full meter is still the Super.
- **Super damage.** On an ordinary enemy, a pellet deals `pellet × dmgMult` (300 or 150), so damage perks still scale it.
- **Push.**
  - The first pellet of a cast to reach an enemy pushes it along the pellet's path, at `pushPx / pushMs`, until it has travelled about `pushPx`. This is distance-controlled: 90 / 180 px at 60 Hz, 179 px at a 30 Hz step. A time cap stops a body blocked by a wall.
  - The AI is suspended only while the push runs, through the existing `_staggerMs` / `_shoveMs` fields. `stagger()` is not used, because it would open a punish window.
  - When the push ends, the body is stopped and the AI resumes the next frame.
  - A pellet that kills slides the corpse exactly as R1.
- **Slow.** A timed copy of the enemy's `cfg` with reduced `speed`. The original object is restored on expiry. It refreshes but never stacks.
- **One push and one slow per enemy per cast,** however many pellets cross it. Pellets are tagged to their cast when `player-super-blast` fires.
- **No permanent lock.** After a push ends, the enemy cannot be pushed again for 600 ms (the slow still refreshes). With Supers chained every 250 ms for 5 s, the AI was suspended in 18% (M) / 21% (S) of frames.
- **HUD.** The ten ammo pips are packed 15 px apart at 0.8 scale (x 527–662), so they fit above the aim stick. This uses an instance wrapper on the HUD's layout; `HUD.js` is unchanged.
- **No new randomness.** `b1Combat.js` has no `Math.random`, and a dynamic count found 0 draws made by B1 code in a 900-tick fight.

## Telemetry added to B0

| Field | Content |
|---|---|
| `run.config.b1` | The variant |
| `b1` | Settings, hold-to-fire counters, Super hits on ordinary enemies, pushes (count, per-push px, refusals by immunity or by another effect), same-cast duplicates skipped, slows applied / refreshed and total slowed ms, by enemy type |
| `input.standard` | Shots by trigger (tap-stick / hold-stick / tap-key / hold-key), plus touch vs mouse for stick shots |
| `input.super` | Super casts by trigger (button or stick / SPACE / F-ENTER) |
| `charge.super`, `charge.melee` | Per source (standard / override / cluster / super / melee / other): events, units requested, units added, units wasted against a full meter |
| `charge.mult` | Streak multiplier at each Super charge event |

The report shows all of this in an "Input, charge and B1" section. The B0 clock definition is also corrected: game time tracks wall time. The B0 defect list from the evidence report (nemesis-wave label, Demolisher self-detonation attribution, heal recording) is **not** part of this change.

## Validation

Logs are in this folder (`suites.txt`).

**`smoke-b1 --old=a3866f2`: 71 / 71.**
- **Flag off:** identical to `a3866f2` tick for tick. This covers R1, legacy and V2C+P1+P2-A3, with and without the B0 recorder, including god mode off.
- **Variants differ only where authorized:**
  - Supers with no STANDARD: B1-G = R1.
  - Slow STANDARD (a 3-round magazine never empties) plus Supers, OVERRIDE and cluster: B1-G = R1, except the magazine fields.
  - Rapid STANDARD with no Super: G = M = S, tick for tick.
  - Two control checks prove each comparison can see a real change.
- **Super mechanics, measured:**
  - Damage: 300 / 150 per pellet on Regulars, Elites and Bulwarks.
  - Push: 90 / 180 px (179 px at a 30 Hz step).
  - Slow: 75% / 60% speed for 1.48 / 1.98 s, then the original `cfg` restored.
  - One push and one slow per cast; re-push immunity.
  - Chained Supers suspend the AI in 18% / 21% of frames.
  - No punish window; corpse slide = R1; charge per pellet = R1.
  - Nemesis, Captain, afterimage and Vader take the R1 Super.
- **Controls:**
  - Tap = 1 shot. Hold = 117 ms cadence, then the 260 ms trickle, with no release shot.
  - Real CDP touch: tap 1 shot, hold 11 shots.
  - SPACE taps and holds work, and SPACE with a full meter is still the Super.
  - OVERRIDE and cluster never auto-repeat.
  - The Super / melee buttons are not claimed by the fire stick.
  - The 10 pips fit, also after a relayout.
- **Restarts and reload** keep the variant and tuning, with one install and no doubled listeners.
- **Telemetry accuracy:**
  - Input counts match the scripted presses.
  - Charge units equal the meters' real increments.
  - Push distance and slowed time match what the test measured.
  - Damage truth holds in seeded M and S fights.
- **No randomness from B1:** zero draws by B1's own code.
- **Scope:** only B1's own lines changed; the Enemy.js guard passes.

**Covering suites:**
- `smoke-b0 --old=dc7d9ea`: 46 / 46;
- `smoke-fx-p2a3` / `-p2a` / `-p2a2` frozen-file sections: 4 / 4, 4 / 4, 3 / 3;
- `smoke-captel`, `smoke-controls`, `smoke-restart`, `smoke-cluster`: pass;
- `npm run build`: OK.

`run-all` was not re-run for B1. Flag-off identity against `a3866f2` is proven tick for tick, and that build's `run-all` was 46/52 (§0, B0 entry).

## Known limitations

- The push direction is along the pellet's path. With a 30° spread, enemies at the edge of the cone are pushed slightly sideways.
- A pushed enemy can be pushed into a wall; it stops there (time cap).
- B1 changes are measured on the desktop and in the harness. On a handset, frame-rate effects on the push are bounded by the distance control.
