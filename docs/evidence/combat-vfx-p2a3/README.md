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

### Measured: sustained STANDARD fire (`smoke-fx-p2a3` section 6)

A held trigger with the shipped pool (3 rounds 120ms apart, then the 520ms
refill: 5 shots in 1.1s), aim 0.35 rad, each state; every frame rendered with
and without the discharges, changed pixels counted in an 88px box round the
barrel face. Same 5 shots on the same ticks in both.

| state | lit frames per shot (alpha ≥ 0.15) | first-frame ink | frames with ink | mean ink per frame |
|---|---|---|---|---|
| nothing up | 3.6 -> **2.0** | 1,109 -> 1,109 px | 27% -> **15%** | 171 -> 100 px |
| shield up | 3.6 -> **2.0** | 1,109 -> 1,109 px | 27% -> **15%** | 172 -> 100 px |
| Super ready (P1 ring) | 3.6 -> **2.0** | 1,109 -> 1,109 px | 27% -> **15%** | 172 -> 101 px |
| shield + Super ready | 3.6 -> **2.0** | 1,106 -> 1,106 px | 27% -> **15%** | 173 -> 102 px |

- **The peak is identical** (the same pixels on the frame each shot is first
  seen, in every state): sharp does not trade visibility for brevity.
- **The persistence roughly halves**: at 60 Hz the current discharge stays on
  ~4 frames (1.0, 0.83, 0.54, 0.24 alpha), the sharp one 2 (1.0, 0.44).
  During a 3-round string (120ms = 7 frames apart) the current one covers the
  barrel for more than half of each interval, the sharp one for under a third.
- **The rings change nothing** in either: the core is over the shield bubble
  and the ring in front of the body (the approved depth rule, unchanged), so
  the measured ink is the same with and without them.
- **At a 30 Hz step** (a phone that cannot hold 60 fps) the difference is
  larger: the current discharge is first DRAWN 33ms into its life, already
  shrinking (alpha 0.83) — **0 of 5 shots ever show its peak** — and lives 2
  frames; the sharp one shows its peak on **5 of 5** and lives 1. That is a
  property of P2-A's ageing (a flash ages from the fire call), which the sharp
  variant does not share (it ages from its first drawn frame).

What this does **not** say: which one READS better in the hand. The current
one is the steadier light at the muzzle during a string; the sharp one is a
crisper per-shot snap that leaves the hero and the rings clear between shots.
That is the handset's call.

Evidence (`muzzle-ab/`, A = current | B = sharp, same shots, every pair
state-checked): `one-shot-both-60hz.png` / `one-shot-none-60hz.png` (one shot,
+0..+84ms), `one-shot-both-30hz.png` (+0..+100ms at a 30 Hz step),
`one-shot-both-60hz-phone1x.png` (at true phone scale); `held-none/`,
`held-shield/`, `held-ready/`, `held-both/` (close-ups, every tick:
`ab-60fps.mp4` real time at 2x, `ab-phone-1x-60fps.mp4` at TRUE phone size,
`ab-quarter-speed.mp4`, `ab-phone2x.png` tick strip); `held30-none/`,
`held30-both/` (the same at a 30 Hz step, `ab-30fps.mp4`); `held-full/`
(full frame at phone size, 2s in each of the four states, trigger held:
`ab-phone-size.mp4`); `fight-swarm/`, `fight-crossfire/` (the fights at phone
size, 60 fps, a real OVERRIDE module at tick 200).

---

## Evidence index (`A` = P2-A2, `B` = P2-A3, unless in `muzzle-ab/`)

Every pair is one seeded moment run twice with the same inputs at the real
60 Hz step (`tests/shot-p2a.mjs --set=p2a3` / `--set=p2a3mz`); the rig hashes
the gameplay state at every tick and refuses a pair that differs. **All 15
pairs are identical at every tick** (`shot-p2a.txt`, `muzzle-ab/shot-p2a.txt`).
**Every film is full speed (60 fps — every tick rendered), 30 fps only for the
30 Hz step.**

| moment | folder | look at |
|---|---|---|
| **HUD count + bar, a whole module** | `hud/` | the panel every round (`ab-phone2x.png`: A stuck at `OVERRIDE 27`, B 27 -> 3 with the bar cut per pull), run dry -> `STANDARD` |
| **Engage** | `engage/` | the module taken on the hero: the pips light in sequence, the ring, the magazine flare; then the first bursts with a flick per round |
| **Last bursts + run dry** | `rundry/` | the low-ammo pulse, the pips out, the cell guttering, then STANDARD on the same rifle |
| **The whole loop, full frame** | `sequence/` | `ab-phone-size.mp4` (390px each = phone size) and stills: the module pickup (12), taken (40, 70), firing (120: A `OVERRIDE 27`, B `17`), dry -> `STANDARD` (200, 236), STANDARD fire (262, 300) |
| **SWARM TIDE / CROSSFIRE** | `fight-swarm/`, `fight-crossfire/` | 420 ticks at phone size, a real OVERRIDE module at tick 200 |
| **STANDARD discharge A/B** | `muzzle-ab/` | above |

Stills are lossless RGB.
