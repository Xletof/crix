// Touch-control layout — where the on-screen controls sit and how big they are.
//
// Single source of truth for the five touch widgets. The HUD builds from it,
// the ControlsScene editor writes to it, and it persists to localStorage so a
// layout survives a reload. Defaults are the exact numbers HUD.create() used
// before the editor existed, so a player who never opens the editor gets a
// byte-identical screen.
//
// Two notes on what "position" means here:
//
//  * The sticks FLOAT. Each claims any pointer on its half of the screen and
//    re-anchors its base under the finger, so a stick's x/y is only its resting
//    spot — it does not decide where you may touch. That is also why the sticks
//    are clamped to their own half (see clampFor): letting the move stick rest
//    in the right half would show it somewhere it can never be dragged.
//  * `scale` multiplies BOTH the drawn size and the radius the widget uses for
//    hit-testing and force normalisation, so a bigger stick really does have a
//    longer throw. Widgets read it through setLayout().

import { VIEW, HUDCFG } from '../config.js';

const KEY = 'crix.controls';

export const SCALE_MIN = 0.65;
export const SCALE_MAX = 1.45;

// Default anchors, lifted from the HUD's original hardcoded maths.
const stickHomeY = VIEW.height - HUDCFG.joystickBottom - HUDCFG.joystickRadius;
const superX = VIEW.width - HUDCFG.joystickMargin - 150;
const superY = VIEW.height - HUDCFG.joystickBottom - 260;

// `half` pins a stick to the side it claims pointers on; buttons are free.
export const CONTROL_DEFS = {
  moveStick: {
    label: 'MOVE STICK', tex: 'joystick-base', radius: HUDCFG.joystickRadius,
    x: HUDCFG.joystickMargin + HUDCFG.joystickRadius, y: stickHomeY, half: 'left',
  },
  fireStick: {
    label: 'AIM STICK', tex: 'joystick-base', radius: HUDCFG.joystickRadius,
    x: VIEW.width - HUDCFG.joystickMargin - HUDCFG.joystickRadius, y: stickHomeY, half: 'right',
  },
  superBtn: { label: 'SUPER', tex: 'super-btn', radius: 58, x: superX, y: superY },
  meleeBtn: { label: 'MELEE', tex: 'melee-btn', radius: 46, x: superX - 118, y: superY },
  dashBtn:  { label: 'DASH',  tex: 'dash-btn',  radius: 56, x: superX - 118, y: superY + 118 },
};

export const CONTROL_IDS = Object.keys(CONTROL_DEFS);

// Live state: id -> { x, y, scale }. Seeded from the defaults, then overlaid
// with anything valid found in storage.
const state = {};
const seed = () => {
  for (const id of CONTROL_IDS) {
    const d = CONTROL_DEFS[id];
    state[id] = { x: d.x, y: d.y, scale: 1 };
  }
};
seed();

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Keep a control fully on screen, below the HUD top bar, and — for a stick —
// inside the half it claims pointers on.
export function clampFor(id, x, y, scale) {
  const d = CONTROL_DEFS[id];
  const r = d.radius * scale;
  let loX = r, hiX = VIEW.width - r;
  if (d.half === 'left') hiX = Math.min(hiX, VIEW.width / 2 - r);
  if (d.half === 'right') loX = Math.max(loX, VIEW.width / 2 + r);
  // A stick wider than half the screen would invert its own bounds; centre it.
  if (loX > hiX) { const mid = (loX + hiX) / 2; loX = hiX = mid; }
  return {
    x: clamp(x, loX, hiX),
    y: clamp(y, HUDCFG.topBarHeight + r, VIEW.height - r),
  };
}

function load() {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return; // corrupt entry — silently keep the defaults
  }
  if (!raw || typeof raw !== 'object') return;
  for (const id of CONTROL_IDS) {
    const v = raw[id];
    if (!v || typeof v !== 'object') continue;
    const scale = clamp(Number(v.scale) || 1, SCALE_MIN, SCALE_MAX);
    const { x, y } = clampFor(id, Number(v.x), Number(v.y), scale);
    // Number() of a missing field is NaN, which clamp passes straight through;
    // fall back to the default rather than storing NaN into a sprite position.
    state[id] = {
      x: Number.isFinite(x) ? x : CONTROL_DEFS[id].x,
      y: Number.isFinite(y) ? y : CONTROL_DEFS[id].y,
      scale,
    };
  }
}
load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private-mode / quota failures must not take the editor down with them.
  }
}

export function getControl(id) {
  const d = CONTROL_DEFS[id];
  const s = state[id];
  return { id, label: d.label, tex: d.tex, x: s.x, y: s.y, scale: s.scale, radius: d.radius * s.scale };
}

export function getControls() {
  return CONTROL_IDS.map(getControl);
}

// Partial update — pass any of x / y / scale. Clamps, persists, returns the
// resulting control.
export function setControl(id, patch) {
  const s = state[id];
  if (!s) return null;
  const scale = clamp(patch.scale ?? s.scale, SCALE_MIN, SCALE_MAX);
  const { x, y } = clampFor(id, patch.x ?? s.x, patch.y ?? s.y, scale);
  state[id] = { x, y, scale };
  save();
  return getControl(id);
}

export function resetControls() {
  seed();
  save();
}
