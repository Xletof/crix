# Crix

A mobile-first, Brawl Stars-style top-down twin-stick arena shooter built with
Phaser 3 + Vite. Plays end-to-end: 3 escalating waves → boss fight → win/lose
screen. Designed to be opened on a phone (or in a desktop browser with mobile
device emulation).

## Controls

- **Left thumb (joystick):** move
- **Right thumb (joystick):** drag to aim, release to fire (auto-fires while held past the deadzone)
- **Star button (right):** super attack — wide piercing shotgun with knockback (charges as you damage enemies)
- **Desktop fallback:** WASD / arrow keys to move, click-drag right side to aim, **Space** for super

## Run locally

```bash
npm install
npm run dev
# → open http://localhost:5173 (mobile-emulated viewport)
```

Build a static bundle:

```bash
npm run build
# → dist/ ready for any static host
npm run preview
```

## What you'll find

- `src/main.js` — Phaser game config and scene list
- `src/config.js` — every gameplay tunable (HP, speeds, damage, wave sizes)
- `src/scenes/` — Boot, Preload, Title, Game, GameOver
- `src/systems/` — Joystick, HUD, WaveManager, BushSystem, FX (audio + juice)
- `src/entities/` — Player, Bullet, Enemy (Grunt/Shooter), Boss

Sprite textures and SFX are generated procedurally at runtime, so the build has
zero external asset dependencies.
