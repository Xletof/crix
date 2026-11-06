# P2-A3 — OVERRIDE refinement (`?visualPilot=v2c&polish=p1&fxPilot=p2a3`)

**Status: CANDIDATE — opt-in, presentation only, awaiting the HUMAN handset
verdict. Not a default; not approved; nothing frozen.**
Classification: **P2-A3 READY FOR HUMAN REVIEW**

Built over P2-A2 (`fxPilot=p2a2`, directionally accepted for continued
development, NOT approved or frozen). P2-A2's rifle model, STANDARD pistol
mechanics, OVERRIDE three-shot mechanics, projectile effects and muzzle-depth
solution are kept as they are, and **P2-A2 itself is byte-identical under its
own flag** (its rendered frames — world and HUD — are pixel-identical to the
deployed `356b5df` build). R1 (no flags) remains production; V2, V2B, V2C, P1
and P2-A keep their outputs.

## The HUMAN direction this answers (2026-11-06)

> 1. Fix the OVERRIDE HUD ammunition defect. 2. Improve OVERRIDE's phone-size
> communication. 3. Give OVERRIDE a distinctive active state (a restrained
> power-cell / weapon-light treatment, a brief pickup activation beat, a clear
> return to STANDARD). 4. Compare STANDARD muzzle persistence (the current
> flash vs a shorter, sharper one; demonstrate which reads better at phone
> size — do not choose automatically). 5. Protect the baseline.

## Play it (GitHub Pages, deployed from `FRIX`)

| | link |
|---|---|
| **P2-A3 — current STANDARD discharge** | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3 |
| **P2-A3 — sharp STANDARD discharge (the A/B)** | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&muzzle=sharp |
| P2-A2 — the parent, unchanged | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a2 |
| P2-A3 in SWARM TIDE (Hangar, sector 3) | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&encdbg=swarmTide&room=hangar&sector=3 |
| … with the sharp discharge | https://xletof.github.io/crix/?visualPilot=v2c&polish=p1&fxPilot=p2a3&muzzle=sharp&encdbg=swarmTide&room=hangar&sector=3 |

The OVERRIDE module is where P2-A2 put it: the Hangar's room pickup (north,
beside the shuttle's stairs), Reactor Junction's, and the REWARD: TAKE ONE pair.
`muzzle=sharp` is honoured only together with `fxPilot=p2a3`.

---

## 1 — The OVERRIDE round count (register #28)

**What was wrong.** The shipped burst shot (`Player._fireBurstShot`) spends a
round and emits no `secondary-ammo-changed`, so the HUD's count and bar moved
only on pickup and on running dry: OVERRIDE read `27` with a full bar for the
whole module (P2-A2 kept that, as briefed).

**The fix (presentation only).** P2-A3 READS `player.secondaryAmmo` once a frame
(in P2-A's own POST_UPDATE) and, only when it differs from the value it last
drew, re-runs the HUD's own `refreshSecondary` — the shipped panel, bar and
count, drawn from the real value. No event is emitted, nothing in the
ammunition, burst cadence or event path is written.

**Proven (`smoke-fx-p2a3` section 3):**
- on **every one of 182 OVERRIDE ticks** the count and the bar equal
  `secondaryAmmo` (27 -> 1; bar = 76px × ammo / 27);
- CONTROL: P2-A2 shows a stale count/bar on 162 of the same 182 ticks — the
  check can see the defect;
- **26 redraws for 26 value changes** (the emptying round still goes through
  the shipped event); HUD refreshes 4 -> 30;
- the shots, burst counter, ammunition, the tick it runs dry and the
  `Math.random` draw count are P2-A2's; **every game event is emitted the same
  number of times** in both builds (`secondary-ammo-changed` 2,
  `secondary-equipped` 2, `player-fire-rifle` 27).

Evidence: `hud/` (the panel, every round, A = P2-A2 | B = P2-A3), `sequence/`
(full frame at phone size).

## 2 — OVERRIDE's phone-size communication

| | P2-A2 | P2-A3 |
|---|---|---|
| ammunition | `OVERRIDE  27` in the 15px caption line under the panel (19px tall text, ~10 CSS px), never moving | **the count alone, 32px** (36px tall, ~19 CSS px), the panel's largest element, and it moves every round |
| three-shot symbol | a module picture + `3-SHOT / BURST` in 3x5 pixel type (~8 CSS px) | **three of the game's own red energy cells under one amber bracket** — the ammo pips' look, one trigger pull, three rounds; no words |
| bar | the shipped bar, never moving | the shipped bar, moving every round, **cut every three rounds** — one segment per pull (9 segments) |
| mode name | in the caption line | `OVERRIDE` in 4x5 pixel capitals under the panel (~8 CSS px tall caps) |
| engage | — | the symbol pops (1.35 -> 1 over 260ms) and the panel's rim flashes once (380ms) |
| run dry | the panel clears | the panel clears as shipped, and **`STANDARD`** is shown where it was for 1.1s (fading over its last 0.38s) |
| cluster pod | shipped panel | shipped panel, **pixel-identical to P2-A2's** (and no STANDARD tag on an OVERRIDE -> cluster swap: it is not STANDARD) |

## 3 — OVERRIDE's active state

The rifle is the same gun: **the carried rifle object (texture, position,
rotation, flip, depth, alpha) is P2-A2's on every tick** of the module
sequence. What changes is a power cell lit ON it:

- **The cell.** While OVERRIDE is engaged, the rifle's magazine glows amber
  and three pips light along its receiver — the three rounds of a pull. It is
  drawn on the rifle's own 72x40 canvas and origin and given the rifle's
  transform every frame: **every lit texel lands on a texel the P1 rifle
  already has** (checked against `p1-rifle` and the Super-ready `p1-rifle-hot`),
  so the silhouette never grows. A small amber glow sits on the magazine
  (normal blend; dropped in low quality).
- **Engage (≈300ms).** The pips light in sequence (60ms apart), the magazine
  flares, and one thin amber ring leaves it (7 -> 34px, 300ms). P2-A2's barrel
  prime (the muzzle heat) stays. The HUD rim flashes and the symbol pops.
- **Firing.** Each round leaving flicks the cell white-hot for 70ms. During the
  last two bursts (≤ 6 rounds) the cell pulses (alpha 0.55–1, 380ms period).
- **Run dry (420ms).** The pips go out right to left, the magazine gutters
  twice (0.7, then 0.35) and dies; the HUD shows `STANDARD`. The gun keeps its
  model and fires STANDARD.
- Hidden mid-combo (the blade is drawn), dead; fades with the rifle in a bush.

Evidence: `engage/` and `rundry/` (close-ups, A = P2-A2 | B = P2-A3, every tick,
60 fps, quarter speed, true phone size `ab-phone-1x-60fps.mp4`), `sequence/`.

## 4 — STANDARD muzzle persistence: current vs sharp (`&muzzle=sharp`)

**Not chosen — both are shipped for the handset.** P2-A3 without the parameter
draws **P2-A2's discharge exactly** (frame for frame, section 6). The sharp
variant keeps the **same texture, size, keyline, position, depth and
occlusion rule** (the approved depth solution); only its persistence differs:

| | current (P2-A2) | sharp |
|---|---|---|
| life | 80ms, from the fire call | 40ms, from the first frame it is SEEN |
| shape over time | full size for the first third, then pulled back into the barrel and faded | the peak, then pulled straight back (x −70%, y −35%, alpha (1−u)^1.5) |
| glow | 0.40 × (1−u)² | 0.25 × (1−u)² (= the current flash's first-frame glow) |
