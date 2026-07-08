# Vertical Slice Design Spec — Death Star Infiltration

## Core Feel Target

A compact, fast, responsive mobile-first top-down infiltration shooter. One polished room that demonstrates stealth → combat → objective → extraction. Every interaction should feel snappy and readable at mobile portrait scale.

**Reference**: Brawl Stars control-feel and combat juice only (NOT content, UI, art, or multiplayer). Use as reference for: snappy movement, readable aiming, shoot-on-release, ammo/reload rhythm, satisfying hit feedback, super charge reward loop, compact characters, fast tactical encounters.

---

## Phase 0 Diagnosis — What Needs Fixing

### What feels bad
- Player sprite scale accumulates from lean/bob animation (1.15x instead of 1.0x idle)
- Movement animation is a procedural wiggle rather than clean sprite cycling
- Shooting via keyboard doesn't use release-to-fire naturally
- Aim feel on desktop is disconnected from joystick feel
- Room 1 (Hangar) feels like a debug corridor — walls are placed mechanically
- Damage numbers can stack and become noisy
- Camera looseness (0.18 lerp) makes small movements feel floaty

### What is broken
- Boss.js has duplicate `damage()` method (second overrides first, skips damage cap)
- `_hurtStaggerMs` and `_wKickT` are never initialized in Player constructor (works by JS accident)
- Slow-mo overlap can cut newer slow-mo short (older tween's onComplete hard-resets timeScale)
- Super charge doesn't have an accuracy multiplier — hitting or missing doesn't affect charge rate
- Space key doesn't properly trigger primary fire (it calls `tryFireSuper`, not primary)
- Console has leftover debug log in Player.js constructor (line 15)

### What is unclear
- When takedown is valid (no visual indicator for invalid/valid distinction in normal play)
- Why enemies aren't detecting (vision cones are debug-only but alert icons need more prominence)
- Ammo/reload state has no HUD indicator that clearly communicates reload progress

### What is visually noisy
- Concurrent particle effects can overwhelm small screens
- Multiple damage popups during rapid fire
- Screen shake + slow-mo + camera punch can triple-stack on kills

### What should be preserved
- Detection system (FOV cone + LOS + sound propagation) — working and verified 11/11
- Dash charges/recharge mechanic — properly guarded against NaN/freeze
- Pixel art style and palette — clean Death Star theme with beskar/trooper colors
- Room transition system — works correctly
- Event-driven architecture — clean separation of concerns
- Auto-aim on tap — good foundation for mobile shoot-on-release

---

## Movement

| Parameter | Current | Target | Rationale |
|---|---|---|---|
| `speed` | 360 | 380 | Slightly faster to feel responsive |
| `accelPerSec` | 3400 | 4200 | Near-instant response |
| `decelPerSec` | 4400 | 5000 | Crisp stop |
| `dashSpeed` | 780 | 800 | Clear speed differential |
| `dashDurationMs` | 220 | 180 | Snappier dash |
| `dashChargesMax` | 3 | 2 | More tactical use |
| `dashRechargeMs` | 3500 | 4000 | Dash is valuable, not spam |
| Camera lerp | 0.18 | 0.22 | Tighter follow |
| Camera aim-lookahead | 70px | 50px | Less disorienting |

**Rules:**
- Player accelerates quickly, stops quickly
- No floaty sliding
- No fake puppet wobble — animation drives the visual, not scale/rotation hacks
- Dash must always exit cleanly
- Dash has clear start, travel, recovery, cooldown
- Dash dodges bullets (invulnerable during dash) but has meaningful cooldown

---

## Combat

### Primary Weapon (Blaster)
| Parameter | Current | Target | Rationale |
|---|---|---|---|
| `ammoMax` | 4 | 3 | Tighter rhythm like Brawl Stars |
| `ammoReloadMs` | 750 | 800 | Per-ammo reload timing |
| `fireCooldownMs` | 150 | 120 | Faster burst feel |
| `pelletCount` | 3 | 1 | Single bolt, not shotgun |
| `pelletDamage` | 300 | 350 | Compensate for single bolt |
| `pelletSpeed` | 820 | 900 | Faster/punchier |
| `pelletRange` | 420 | 400 | Moderate range |
| `pelletRadius` | 7 | 6 | Tighter hitbox |

**Mechanics:**
- Shoot on right-stick release (already implemented)
- Quick tap auto-shoots nearest valid target (already implemented)
- 3 ammo, each reloads individually at 800ms intervals
- Missing shots matters — affects super charge rate

### Super Attack
| Parameter | Current | Target | Rationale |
|---|---|---|---|
| `superHitsToCharge` | 10 | 8 | Faster reward loop |
| `superPellets` | 7 | 5 | Focused burst |
| `superDamage` | 520 | 600 | Powerful reward |
| `superKnockback` | 440 | 500 | Impactful |

**Accuracy Multiplier System (NEW):**
- Each hit grants `1 × multiplier` toward super charge
- Consecutive hits increase multiplier: 1.0 → 1.2 → 1.5 → 2.0
- Missing a shot resets multiplier to 1.0
- This creates the "hit hit hit → super → hit hit hit → super" rhythm
- Super should feel like a reward for accurate aggressive play

### Hit Feedback
- Muzzle flash (existing, keep)
- Impact spark (existing, keep)
- Enemy white flash on hit (existing, keep)
- Enemy micro-knockback (existing, keep)
- Small hit-pause on kill only (45ms existing, keep)
- Screen shake on super/heavy hits only (reduce from current)
- Damage popup: keep but limit to 1 visible at a time per target

---

## Stealth

- Vision cones: debug only (already implemented ✅)
- Normal gameplay: facing direction + alert icons (! and ?)
- Silent takedown: instant kill on normal enemies when unaware
- Takedown valid only from behind + within range + unblocked LOS
- Show subtle green reticle when takedown is valid (existing)
- Shooting reveals player from bush
- Enemies search last known position (already implemented ✅)
- Stealth takedown creates small 80px sound radius (already implemented ✅)

---

## Room Design (Vertical Slice)

Replace current Hangar Bay layout with a polished single room:

**Theme:** Death Star hangar control area
**Size:** 1600×1400

**Layout:**
```
┌─────────────────────────────────┐
│                                 │
│   ┌──┐     PATROL 1     ┌──┐   │
│   │  │  ───────→         │  │   │
│   └──┘     ←───────      └──┘   │
│                                 │
│  ┌──┐                    ┌──┐   │
│  │  │                    │  │   │  ← COVER OBJECTS
│  └──┘                    └──┘   │
│                                 │
│        ┌──────────┐             │
│        │ TERMINAL │             │
│        └──────────┘             │
│                                 │
│  ┌──┐    PATROL 2/3      ┌──┐  │
│  │  │     (flanker)      │  │  │
│  └──┘                    └──┘  │
│                                 │
│         [SPAWN]           [EXIT]│
└─────────────────────────────────┘
```

**Enemies:**
1. Scout (Grunt) — patrols upper area, weaker, alerts others
2. Trooper (Grunt) — patrols lower area, standard combat
3. Heavy (Shooter) — static guard near terminal, flanker role

**Flow:**
1. Player spawns bottom-left
2. Can stealth-takedown scout from behind if careful
3. Terminal objective in center
4. Combat likely triggers when approaching terminal
5. Clear enemies + hack terminal → door opens
6. Exit bottom-right

---

## Art Direction

### Characters (keep scale 4, 24×24 player, 20×20 enemies)
- Clean pixel silhouettes, readable at mobile scale
- Weapon attached and proportional
- 8-frame walk cycles (already implemented)
- Remove procedural scale/rotation wobble — use only sprite frame animation
- Idle: breathing subtle Y-scale only (1.0 to 1.02, not 1.15)
- Moving: sprite animation drives the look, no additive transforms
- Dashing: roll rotation is fine (already clean)

### Environment
- Death Star floor panels with hex grid (existing)
- Isometric cover objects (existing consoles)
- Blast door walls (existing)
- Clean, not noisy
- No random scorch marks overlapping important gameplay space

---

## HUD (Mobile Portrait)

### Layout
```
┌────────────────────┐
│ HP ██████░░  ⏸    │ ← top bar
│ AMMO ●●●  SUPER   │
│                    │
│                    │
│   GAME WORLD       │
│                    │
│                    │
│  🕹️         🎯    │ ← left joystick, right joystick
│           DASH  ⚡  │ ← dash button, super button
└────────────────────┘
```

- HP: readable bar, top-left
- Ammo: pip indicators near weapon area
- Super: charge gauge or glow indicator
- Debug toggle: hidden unless pressed (U key)

---

## Debug Tools

Press **U** to toggle debug overlay:
- Vision cones (yellow patrol, red alert)
- LOS rays (green = sees player, red = blocked)
- State labels per enemy
- Detection reason text
- Sound event rings
- Last known position crosshairs
- Player state indicator

All hidden in normal gameplay.
