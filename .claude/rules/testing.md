---
paths:
  - "tests/**"
---
# Writing and trusting tests

Reference: `docs/engineering/testing.md`; per-suite detail in `tests/README.md`.

- The harness runs at 6–20 fps. Sample in-page on `postupdate`; poll for
  conditions, never fixed sleeps; drive sub-100ms beats by stepping the loop.
- A/B every new check against the previous build — a check that passes on the
  bug is decoration. Assert the thing under test actually ran.
- A failure under a full run is not a regression until it fails standalone and
  not on the previous build. Never weaken a check to get green.
- Screenshots: `cameras.main.resetFX()`, then `scene.pause()`; `?nodlg=1` for
  bosses/nemesis; null the room modifier in both halves of an A/B.
- Mutate config through the game (`director.cfg`, `?camdbg=1`), not a dynamic
  `import('/src/config.js')`.
- Seeded replays: anything consuming `Math.random` changes the fight; verify
  films tick for tick before publishing.
