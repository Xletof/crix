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
