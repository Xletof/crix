# Frix

A mobile-first, portrait, top-down twin-stick **wave-survival** shooter built
with Phaser 3 + Vite. Four arenas of escalating waves, an upgrade choice between
each, and Vader at the end. Designed to be played on a phone (or in a desktop
browser with mobile device emulation).

**Play:** https://xletof.github.io/crix/

Every sprite and every sound is generated procedurally at runtime — there are no
image or audio assets, so the build has zero external asset dependencies.

## Controls

- **Left thumb:** move
- **Right thumb:** drag to aim, release to fire (auto-fires while held past the deadzone)
- **Dash button:** two charges, i-frames while travelling, vaults cover
- **Super button:** rocket barrage — charges as you land hits
- **Melee button:** "Broken Wings", a three-cast lunging combo ending in a ground slam
- **Desktop:** WASD / arrows to move, drag the right half to aim, **Space** super, **Q** melee

## Run locally

```bash
npm install
npm run dev        # → http://localhost:5173
```

```bash
npm run build      # → dist/, ready for any static host
npm run preview
npm run smoke      # headless test suite (needs `npm run dev` running)
```

## Where things are

| Path | What |
|---|---|
| `src/config.js` | Every gameplay tunable — start here |
| `src/main.js` | Phaser config and scene registry |
| `src/scenes/GameScene.js` | The arena loop |
| `src/systems/HUD.js` | `HUDScene` — runs in parallel with the game scene |
| `src/systems/FX.js` | Particles, screen shake, and all audio synthesis |
| `src/systems/pixelArt.js` | Every sprite, painted procedurally at load |
| `src/data/` | Room layouts, upgrade cards, narrative text |
| `tests/` | Headless Playwright smoke suite |

## Working on this

- `HANDOVER.md` — full orientation: architecture, current game shape, dead code,
  open issues
- `CLAUDE.md` — project rules and the traps that have caused real bugs
- `tests/README.md` — the test harness, and the ways it will lie to you
