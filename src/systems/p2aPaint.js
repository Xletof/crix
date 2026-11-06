// P2-A — BLASTER FIRE & IMPACT: THE TEXTURES (`?visualPilot=v2c&polish=p1&fxPilot=p2a`).
//
// New, namespaced `p2a-*` keys only. No shipped texture is repainted — above
// all not `bullet`, whose WIDTH is the player bolt's hitbox (Bullet.fire sizes
// the body from it). Under P2-A the bolt keeps that texture and its body; it
// is simply not drawn, and the tracer below is drawn in its place by
// systems/p2aFx.js. No `Math.random`: every pixel is placed by hand.
//
// Orientation: everything points EAST (+x). A tracer's head is its right end;
// a muzzle flare's origin is its left end (the barrel face); an impact's +x is
// the direction stated by its painter (flight, or the surface normal).
//
// The colour family is the player's own bolt (PAL.boltRed / Glow / Core), hot
// to white. No green (enemy fire), no blue-white electric (the Shock Captain's
// round), no amber-orange body colour (a nemesis tint): a P2-A shot is red
// light with a white-hot core, so friend and foe stay apart by hue AND by shape
// (a tapering tracer behind a hot head, where enemy bolts are rigid bars).

import { PixelCanvas } from './pixelArt.js';
import { isFxP2A, isFxP2A2, isFxP2A3 } from './debug.js';

const W = '#ffffff';
const HOT = '#fff1ec';     // white with a breath of red
const PINK = '#ff9a8c';
const RED = '#ff3a2c';
const DEEP = '#d0141c';
const DARK = '#7a0a14';
const GOLD = '#ffe9a8';    // hot metal / armour catch light
const AMBER = '#ffb34a';
const ICE = '#e6f6ff';     // a shield's absorbed white (the Bulwark field's own end colour)
const PALE = '#9fd4ff';

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
};
const lerpHex = (a, b, t) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((A >> s) & 255) + ((((B >> s) & 255) - ((A >> s) & 255)) * t));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
};

/** Sizes the runtime relies on (texture pixels). */
export const P2A_TEX = {
  tailP: { key: 'p2a-tail-p', w: 72, h: 15 },
  tailR: { key: 'p2a-tail-r', w: 72, h: 21 },
  headP: { key: 'p2a-head-p', w: 27, h: 15, ox: 19.5 / 27 },
  headR: { key: 'p2a-head-r', w: 33, h: 21, ox: 22.5 / 33 },
  glow: { key: 'p2a-glow', w: 32, h: 32 },
  mzP: { key: 'p2a-mz-p', w: 51, h: 39, ox: 1.5 / 17 },
  mzR: { keys: ['p2a-mz-r0', 'p2a-mz-r1'], w: 60, h: 45, ox: 1.5 / 20 },
  hitBody: { key: 'p2a-hit-b', w: 39, h: 39, ox: 6.5 / 13 },
  hitArmour: { key: 'p2a-hit-a', w: 39, h: 39, ox: 6.5 / 13 },
  hitWall: { key: 'p2a-hit-w', w: 36, h: 45, ox: 1.5 / 12 },
  hitShield: { key: 'p2a-hit-s', w: 27, h: 51, ox: 2.5 / 9 },
};

const KEY = '#1a0306';      // the contact flashes' keyline: legible on a white hit-flash and on the deck

/** Paint every P2-A texture. No-op without the flag. */
export function paintFxP2A(scene) {
  if (!isFxP2A()) return;
  paintTail(scene, P2A_TEX.tailP.key, 24, 5);
  paintTail(scene, P2A_TEX.tailR.key, 24, 7);
  paintHeadP(scene);
  paintHeadR(scene);
  paintGlow(scene);
  paintMuzzleP(scene);
  paintMuzzleR(scene, 'p2a-mz-r0', 0);
  paintMuzzleR(scene, 'p2a-mz-r1', 1);
  paintHitBody(scene, 'p2a-hit-b', false);
  paintHitBody(scene, 'p2a-hit-a', true);
  paintHitWall(scene);
  paintHitShield(scene);
  if (isFxP2A2()) paintFxP2A2(scene);
  if (isFxP2A3()) paintFxP2A3(scene);
}

// A logical grid, flushed to a PixelCanvas; `outline` dilates a one-cell
// keyline round everything painted (the P1 weapons' own construction).
function grid(w, h) {
  const c = new Array(w * h).fill(null);
  const g = { w, h };
  g.px = (x, y, col) => { if (col && x >= 0 && y >= 0 && x < w && y < h) c[y * w + x] = col; };
  g.rect = (x, y, rw, rh, col) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) g.px(x + i, y + j, col); };
  g.outline = (col, a = 0.85) => {
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (c[y * w + x]) continue;
      let n = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && c[yy * w + xx] && !c[yy * w + xx].startsWith('rgba')) n = true;
      }
      if (n) add.push([x, y]);
    }
    for (const [x, y] of add) c[y * w + x] = rgba(col, a);
  };
  g.flush = (scene, key, scale) => {
    const pc = new PixelCanvas(scene, key, w, h, scale);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (c[y * w + x]) pc.px(x, y, c[y * w + x]);
    pc.finish();
  };
  return g;
}

// ── THE TRACER TAIL ─────────────────────────────────────────────────────────
// A tapering strip of light, head at the right edge, painted at scale 3 (the
// shipped bolt's own pixel) and stretched along x by the runtime to the tail's
// length that frame (a DISTANCE behind the head, never a count of frames). The
// outer rows begin further back the further they are from the core, so the
// tail ends in a point, not a bar; it is brightest where it meets the head.
function paintTail(scene, key, len, rows) {
  const c = new PixelCanvas(scene, key, len, rows, 3);
  const mid = (rows - 1) / 2;
  for (let x = 0; x < len; x++) {
    const t = (x + 1) / len;              // 0 at the far end, 1 at the head
    for (let y = 0; y < rows; y++) {
      const d = Math.abs(y - mid) / mid;  // 0 core .. 1 rim
      const start = 0.04 + 0.50 * d;      // the rim starts later: a taper
      if (t < start) continue;
      const u = (t - start) / (1 - start);
      let col, a;
      if (d === 0) { col = u > 0.55 ? lerpHex(PINK, W, (u - 0.55) / 0.45) : lerpHex(RED, PINK, u / 0.55); a = 0.6 + 0.4 * u; }
      else if (d < 0.6) { col = lerpHex(DEEP, RED, u); a = 0.5 + 0.5 * u; }
      else if (d < 1) { col = lerpHex(DARK, DEEP, u); a = 0.3 + 0.55 * u; }
      else { col = RED; a = 0.10 + 0.35 * u; }
      c.px(x, y, rgba(col, Math.min(1, a)));
    }
  }
  c.finish();
}

// ── THE HEAD ────────────────────────────────────────────────────────────────
// The hottest point of the shot, at the bolt's position (scale 3). Pistol: a
// white needle with a red rim, pointed both ways. Rifle: a heavier slug — a
// doubled white core, a thicker rim and a blunt nose.
function paintHeadP(scene) {
  const g = grid(9, 5);
  g.rect(1, 2, 7, 1, W); g.px(8, 2, HOT);
  g.rect(2, 1, 5, 1, HOT); g.rect(2, 3, 5, 1, HOT);
  g.px(1, 1, PINK); g.px(1, 3, PINK); g.px(7, 1, PINK); g.px(7, 3, PINK);
  g.rect(3, 0, 3, 1, rgba(RED, 0.9)); g.rect(3, 4, 3, 1, rgba(RED, 0.9));
  g.px(0, 2, PINK);
  g.flush(scene, P2A_TEX.headP.key, 3);
}
function paintHeadR(scene) {
  const g = grid(11, 7);
  g.rect(1, 2, 8, 3, W); g.rect(9, 2, 1, 3, HOT); g.px(10, 3, HOT);
  g.rect(2, 1, 7, 1, PINK); g.rect(2, 5, 7, 1, PINK); g.px(9, 1, RED); g.px(9, 5, RED);
  g.rect(3, 0, 5, 1, RED); g.rect(3, 6, 5, 1, RED);
  g.px(1, 1, rgba(DEEP, 0.9)); g.px(1, 5, rgba(DEEP, 0.9));
  g.px(0, 3, PINK); g.px(0, 2, rgba(RED, 0.8)); g.px(0, 4, rgba(RED, 0.8));
  g.flush(scene, P2A_TEX.headR.key, 3);
}

// ── A SOFT ROUND GLOW (tinted, additive, at low alpha) ─────────────────────
function paintGlow(scene) {
  const { key, w } = P2A_TEX.glow;
  const tex = scene.textures.createCanvas(key, w, w);
  const ctx = tex.getContext();
  const gr = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, w, w);
  tex.refresh();
}

// ── PISTOL MUZZLE: A SHARP STAR ─────────────────────────────────────────────
// 17x13 at 3. Origin at x=1.5 (the barrel face). A white-hot core, one long
// forward spike (the shot's own line), two cross spikes and four flecks on the
// diagonals: a precise, instantaneous ignition that POINTS.
function paintMuzzleP(scene) {
  const g = grid(17, 13);
  // forward spike
  g.rect(3, 6, 8, 1, W); g.rect(11, 6, 3, 1, PINK); g.rect(14, 6, 2, 1, RED); g.px(16, 6, rgba(RED, 0.7));
  g.rect(3, 5, 5, 1, HOT); g.rect(3, 7, 5, 1, HOT); g.rect(8, 5, 3, 1, PINK); g.rect(8, 7, 3, 1, PINK);
  g.px(11, 5, RED); g.px(11, 7, RED);
  // cross spikes
  g.rect(1, 1, 1, 4, PINK); g.px(1, 0, RED); g.rect(1, 8, 1, 4, PINK); g.px(1, 12, RED);
  g.px(1, 3, HOT); g.px(1, 4, HOT); g.px(1, 8, HOT); g.px(1, 9, HOT);
  // core
  g.rect(0, 5, 3, 3, W); g.px(0, 4, HOT); g.px(0, 8, HOT); g.px(2, 4, HOT); g.px(2, 8, HOT);
  // diagonal flecks
  g.px(4, 3, RED); g.px(5, 2, rgba(RED, 0.8)); g.px(4, 9, RED); g.px(5, 10, rgba(RED, 0.8));
  g.px(6, 4, PINK); g.px(6, 8, PINK);
  g.flush(scene, P2A_TEX.mzP.key, 3);
}

// ── RIFLE MUZZLE: A MUZZLE-BRAKE BLAST (two variants, alternated per shot) ──
// 20x15 at 3. A bigger core, a BLUNT forward cone (a slug, not a needle) and
// side vents — the brake throwing gas sideways, which no pistol does. Variant
// 0 vents square to the bore; variant 1 vents raked forward with a longer
// tongue. Alternating them is the burst's rhythm: no two shots in a row are
// the same shape.
function paintMuzzleR(scene, key, v) {
  const g = grid(20, 15);
  muzzleRShape(g, v);
  g.flush(scene, key, 3);
}
function muzzleRShape(G, v, dx = 0, dy = 0) {
  const g = { px: (x, y, c) => G.px(x + dx, y + dy, c), rect: (x, y, w, h, c) => G.rect(x + dx, y + dy, w, h, c) };
  // blunt cone
  g.rect(4, 4, 7, 7, PINK); g.rect(4, 5, 8, 5, HOT); g.rect(4, 6, 9, 3, W);
  g.rect(11, 4, 2, 1, RED); g.rect(11, 10, 2, 1, RED); g.rect(12, 5, 2, 5, PINK); g.rect(13, 6, 1, 3, HOT);
  g.rect(14, 6, 2, 3, RED); g.px(15, 7, PINK);
  if (v === 1) { g.rect(16, 7, 2, 1, RED); g.px(18, 7, rgba(RED, 0.7)); g.rect(16, 6, 1, 3, rgba(DEEP, 0.85)); }
  else { g.px(16, 7, rgba(RED, 0.8)); }
  // core
  g.rect(0, 5, 4, 5, HOT); g.rect(1, 6, 3, 3, W);
  // vents
  if (v === 0) {
    g.rect(2, 1, 2, 3, PINK); g.rect(2, 0, 2, 1, RED); g.px(2, 3, HOT); g.px(3, 3, HOT); g.px(2, 4, W); g.px(3, 4, W);
    g.rect(2, 11, 2, 3, PINK); g.rect(2, 14, 2, 1, RED); g.px(2, 11, HOT); g.px(3, 11, HOT); g.px(2, 10, W); g.px(3, 10, W);
    g.px(1, 1, rgba(RED, 0.7)); g.px(1, 13, rgba(RED, 0.7));
  } else {
    g.rect(4, 2, 2, 2, PINK); g.rect(5, 1, 2, 1, RED); g.px(7, 0, rgba(RED, 0.8)); g.px(4, 3, HOT);
    g.rect(4, 11, 2, 2, PINK); g.rect(5, 13, 2, 1, RED); g.px(7, 14, rgba(RED, 0.8)); g.px(4, 11, HOT);
  }
  // outer flecks
  g.px(8, 3, RED); g.px(8, 11, RED); g.px(10, 2, rgba(RED, 0.7)); g.px(10, 12, rgba(RED, 0.7));
}

// ── BODY IMPACT ─────────────────────────────────────────────────────────────
// 13x13 at 3; +x = the bolt's flight (into the body); origin at x=6.5, the
// contact on the body's rim. A white core in a hot crescent (the struck
// surface lit), energy SPLASHING BACK toward the shooter in three rays, and
// a short bite on into the target — most of the shape sits on the shooter's
// side of the contact, so it confirms the hit without covering the body.
// A dark keyline round it: the enemy's own hit flash turns him white for the
// same frames, and a white-on-white contact would vanish. `armour`: a
// gold-white crescent and rays raked sideways — skidding off a hard shell.
function paintHitBody(scene, key, armour) {
  const g = grid(13, 13);
  const rim = armour ? GOLD : HOT, rimOut = armour ? AMBER : PINK, ray = armour ? AMBER : RED;
  // crescent, concave toward the body (x = 5..6)
  g.rect(6, 3, 1, 7, rim); g.rect(5, 4, 1, 5, rim); g.px(6, 2, rimOut); g.px(6, 10, rimOut); g.px(7, 1, ray); g.px(7, 11, ray);
  g.px(5, 3, rimOut); g.px(5, 9, rimOut);
  // core
  g.rect(6, 5, 3, 3, W); g.px(9, 6, HOT);
  if (!armour) {
    // splash back toward the shooter: three rays
    g.rect(1, 6, 4, 1, PINK); g.px(0, 6, RED); g.px(4, 6, HOT);
    g.px(4, 4, PINK); g.px(3, 3, RED); g.px(2, 2, rgba(RED, 0.85));
    g.px(4, 8, PINK); g.px(3, 9, RED); g.px(2, 10, rgba(RED, 0.85));
    // a short bite on into the target
    g.px(10, 6, PINK); g.px(9, 4, RED); g.px(9, 8, RED);
  } else {
    // raked sideways off the shell
    g.rect(7, 0, 1, 2, GOLD); g.px(8, 0, AMBER); g.rect(7, 11, 1, 2, GOLD); g.px(8, 12, AMBER);
    g.px(3, 4, AMBER); g.px(2, 3, rgba(RED, 0.8)); g.px(3, 8, AMBER); g.px(2, 9, rgba(RED, 0.8));
    g.rect(2, 6, 3, 1, GOLD); g.px(1, 6, AMBER);
  }
  g.outline(KEY, 0.8);
  g.flush(scene, key, 3);
}

// ── METAL / COVER CONTACT ───────────────────────────────────────────────────
// 12x15 at 3; +x = the surface's outward normal; origin x=1.5 on the face. The
// bolt flattens into a hard bar ALONG the surface (white, then hot gold at its
// ends), with a short spike thrown back off it: a hard, flat contact, not a
// ball of light.
function paintHitWall(scene) {
  const g = grid(12, 15);
  g.rect(1, 5, 2, 5, W); g.rect(1, 3, 1, 2, GOLD); g.rect(1, 10, 1, 2, GOLD);
  g.px(1, 2, AMBER); g.px(1, 12, AMBER); g.px(1, 1, rgba(AMBER, 0.7)); g.px(1, 13, rgba(AMBER, 0.7));
  g.px(2, 4, HOT); g.px(2, 10, HOT);
  g.rect(3, 6, 2, 3, HOT); g.px(3, 7, W);
  g.rect(5, 7, 3, 1, GOLD); g.px(8, 7, AMBER); g.px(9, 7, rgba(AMBER, 0.7));
  g.px(4, 5, GOLD); g.px(5, 4, rgba(AMBER, 0.85)); g.px(4, 9, GOLD); g.px(5, 10, rgba(AMBER, 0.85));
  g.outline(KEY, 0.7);
  g.flush(scene, P2A_TEX.hitWall.key, 3);
}

// ── SHIELD CONTACT (a shield-bearer WITHOUT the frozen Bulwark field) ───────
// 9x17 at 3; +x = the shield's outward normal at the contact. The bolt does
// NOT go in: it flattens into a bow lying on the surface — red-hot where it
// struck, cooling to the field-white the Bulwark's own curtain uses for
// "absorbed" toward its ends — with one pale glint thrown back out.
function paintHitShield(scene) {
  const g = grid(9, 17);
  // the bow: x=2..3 at the middle, x=1..2 toward the ends (the surface curves away)
  g.rect(2, 7, 2, 3, W); g.px(2, 8, RED); g.px(3, 8, PINK);
  g.rect(2, 5, 2, 2, ICE); g.rect(2, 10, 2, 2, ICE);
  g.rect(1, 2, 2, 3, ICE); g.rect(1, 12, 2, 3, ICE);
  g.px(1, 1, PALE); g.px(1, 15, PALE);
  g.px(1, 7, PINK); g.px(1, 9, PINK);
  // the glint back out
  g.rect(4, 8, 3, 1, ICE); g.px(7, 8, PALE); g.px(4, 7, ICE); g.px(4, 9, ICE);
  g.outline(KEY, 0.7);
  g.flush(scene, P2A_TEX.hitShield.key, 3);
}

// ═══════════════════════════════════════════════════════════════════════════
// P2-A2 — PRIMARY CARBINE & OVERRIDE (`fxPilot=p2a2` only)
// ═══════════════════════════════════════════════════════════════════════════
//
// New `p2a2-*` keys; every P2-A texture above is painted exactly as before.
//
//   p2a2-mz-s           STANDARD: the rifle's muzzle-brake discharge, single
//                       shot (square vents), with a dark KEYLINE — the shield's
//                       cyan rim and the P1 ready ring are bright and sit at
//                       the barrel's radius; a keyline is what separates a
//                       white-hot core from a white ring
//   p2a2-mz-o0 / -o1    OVERRIDE: the two alternating brake shapes, keylined
//   p2a2-pickup-override  the OVERRIDE firing-mode module (the rifle pickup's
//                       canvas size: 24x24 at 4)
//   p2a2-hud-override   the HUD panel's module + "3-SHOT / BURST" in pixel type
//                       (painted text: a Phaser Text object would draw
//                       Math.random for its texture key)

export const P2A2_TEX = {
  mzS: { key: 'p2a2-mz-s', w: 66, h: 51, ox: 2.5 / 22 },
  mzO: { keys: ['p2a2-mz-o0', 'p2a2-mz-o1'], w: 66, h: 51, ox: 2.5 / 22 },
  pickup: { key: 'p2a2-pickup-override', w: 96, h: 96 },
  hud: { key: 'p2a2-hud-override', w: 96, h: 66 },
};

const GUN = { hi: '#a9b6c2', lit: '#6c7884', mid: '#454d57', dk: '#2b3038', sh: '#1a1d22' };
const AMB = '#ffb34a', INK = '#06070a';

export function paintFxP2A2(scene) {
  for (const [key, v] of [[P2A2_TEX.mzS.key, 0], [P2A2_TEX.mzO.keys[0], 0], [P2A2_TEX.mzO.keys[1], 1]]) {
    const g = grid(22, 17);
    muzzleRShape(g, v, 1, 1);
    g.outline(KEY, 0.9);
    g.flush(scene, key, 3);
  }
  paintOverridePickup(scene);
  paintOverrideHud(scene);
}

// The module: a gunmetal cartridge with an amber spine, a red-hot window
// holding THREE white-hot rounds (the burst, counted), and contact pins on
// its leading edge — a part that plugs into the gun, not a second gun.
function moduleShape(g, x0, y0, w, h, pins = true) {
  // casing with cut corners
  g.rect(x0 + 1, y0, w - 2, h, GUN.dk); g.rect(x0, y0 + 1, w, h - 2, GUN.dk);
  g.rect(x0 + 1, y0, w - 2, 1, GUN.lit); g.rect(x0 + 1, y0 + h - 1, w - 2, 1, GUN.sh);
  g.rect(x0, y0 + 1, 1, h - 2, GUN.mid);
  // amber spine along the top
  g.rect(x0 + 2, y0 + 1, w - 4, 1, AMB);
  // the window and its three rounds
  const wx = x0 + 2, wy = y0 + 3, ww = w - 4, wh = h - 5;
  g.rect(wx, wy, ww, wh, '#3a0a10');
  const step = Math.floor(ww / 3);
  for (let i = 0; i < 3; i++) {
    const rx = wx + i * step + Math.floor((step - 2) / 2);
    g.rect(rx, wy + 1, 2, Math.max(1, wh - 2), W);
    if (wh > 3) { g.px(rx, wy + 1, HOT); g.px(rx + 1, wy + wh - 2, PINK); }
  }
  if (pins) for (let y = y0 + 2; y < y0 + h - 1; y += 2) g.px(x0 + w, y, AMB);
}

function paintOverridePickup(scene) {
  const g = grid(24, 24);
  moduleShape(g, 3, 6, 17, 12, true);
  g.outline(INK, 1);
  g.flush(scene, P2A2_TEX.pickup.key, 4);
}

// 3x5 pixel type for the caption
const GLYPH = {
  3: ['111', '001', '011', '001', '111'], '-': ['000', '000', '111', '000', '000'],
  S: ['111', '100', '111', '001', '111'], H: ['101', '101', '111', '101', '101'],
  O: ['111', '101', '101', '101', '111'], T: ['111', '010', '010', '010', '010'],
  B: ['110', '101', '111', '101', '110'], U: ['101', '101', '101', '101', '111'],
  R: ['110', '101', '110', '101', '101'],
};
function text(g, str, x0, y0, col) {
  let x = x0;
  for (const ch of str) {
    const gl = GLYPH[ch];
    if (gl) for (let y = 0; y < 5; y++) for (let i = 0; i < 3; i++) if (gl[y][i] === '1') g.px(x + i, y0 + y, col);
    x += 4;
  }
}
function paintOverrideHud(scene) {
  const g = grid(32, 22);
  moduleShape(g, 9, 0, 13, 8, true);
  text(g, '3-SHOT', 5, 10, AMB);    // 23 wide, centred on 32
  text(g, 'BURST', 7, 16, AMB);     // 19 wide
  g.outline(INK, 1);
  g.flush(scene, P2A2_TEX.hud.key, 3);
}

// ── P2-A3 (`fxPilot=p2a3`): THE OVERRIDE REFINEMENT ─────────────────────────
//   p2a3-cell-0..3      the carried rifle's POWER CELL while OVERRIDE is
//                       engaged: the magazine lit amber and 0..3 pips along the
//                       receiver. Drawn OVER the P1 rifle on the rifle's own
//                       18x10-at-4 canvas and origin, so every pixel lands on a
//                       pixel the rifle already has (magazine 9..10 x 7..8,
//                       receiver row 4 at x 5 / 7 / 9) — the same gun, lit.
//   p2a3-cell-hot       the cell's flick as a round leaves (white-hot magazine)
//   p2a3-hud-burst      the HUD's three-round symbol: three of the game's own
//                       red energy cells (the ammo pips' look) under an amber
//                       bracket — one trigger pull, three rounds
//   p2a3-hud-override   "OVERRIDE" in 4x5 pixel capitals (painted: a Phaser
//   p2a3-hud-standard   Text would draw Math.random for its texture key), and
//                       "STANDARD" for the moment the module runs dry

export const P2A3_TEX = {
  cell: { keys: ['p2a3-cell-0', 'p2a3-cell-1', 'p2a3-cell-2', 'p2a3-cell-3'], hot: 'p2a3-cell-hot', w: 72, h: 40,
    mag: [40, 32] },                     // the magazine's centre in canvas px (the glow's anchor)
  burst: { key: 'p2a3-hud-burst', w: 45, h: 33 },
  over: { key: 'p2a3-hud-override', w: 120, h: 21 },
  std: { key: 'p2a3-hud-standard', w: 120, h: 21 },
};

const CELL = { hot: '#fff4dc', lit: '#ffc35a', mid: '#ff9a1e', dk: '#c86410', pip: '#ffd27a' };

export function paintFxP2A3(scene) {
  const pips = [[5, 4], [7, 4], [9, 4]];
  for (let n = 0; n <= 3; n++) {
    const pc = new PixelCanvas(scene, P2A3_TEX.cell.keys[n], 18, 10, 4);
    pc.px(9, 7, CELL.hot); pc.px(10, 7, CELL.lit); pc.px(9, 8, CELL.mid); pc.px(10, 8, CELL.dk);
    for (let i = 0; i < n; i++) pc.px(pips[i][0], pips[i][1], CELL.pip);
    pc.finish();
  }
  const hot = new PixelCanvas(scene, P2A3_TEX.cell.hot, 18, 10, 4);
  hot.px(9, 7, W); hot.px(10, 7, W); hot.px(9, 8, CELL.hot); hot.px(10, 8, CELL.lit);
  for (const [x, y] of pips) hot.px(x, y, CELL.hot);
  hot.finish();
  paintBurstSymbol(scene);
  paintWord(scene, P2A3_TEX.over.key, 'OVERRIDE', AMB);
  paintWord(scene, P2A3_TEX.std.key, 'STANDARD', '#c9d3dc');
}

function paintBurstSymbol(scene) {
  const g = grid(15, 11);
  // the bracket: one pull
  g.rect(0, 0, 15, 1, AMB); g.rect(0, 1, 1, 2, AMB); g.rect(14, 1, 1, 2, AMB);
  // three energy cells (HUD.refreshAmmo's casing / red / core / cap, in pixels)
  for (const x of [1, 6, 11]) {
    g.rect(x, 3, 3, 8, '#aa0000');
    g.rect(x, 4, 3, 6, '#ff2828');
    g.rect(x + 1, 4, 1, 6, '#ff8888');
    g.rect(x, 3, 3, 1, '#ff4444');
    g.px(x + 1, 5, W);
  }
  g.outline(INK, 1);
  g.flush(scene, P2A3_TEX.burst.key, 3);
}

// 4x5 capitals (I and T are 3 wide)
const CAPS = {
  O: ['.##.', '#..#', '#..#', '#..#', '.##.'], V: ['#..#', '#..#', '#..#', '.##.', '.##.'],
  E: ['####', '#...', '###.', '#...', '####'], R: ['###.', '#..#', '###.', '#.#.', '#..#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], D: ['###.', '#..#', '#..#', '#..#', '###.'],
  S: ['.###', '#...', '.##.', '...#', '###.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  A: ['.##.', '#..#', '####', '#..#', '#..#'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
};
function paintWord(scene, key, word, col) {
  const g = grid(40, 7);
  const w = [...word].reduce((s, ch) => s + CAPS[ch][0].length, 0) + word.length - 1;
  let x = 1 + Math.floor((38 - w) / 2);
  for (const ch of word) {
    const gl = CAPS[ch];
    for (let y = 0; y < 5; y++) for (let i = 0; i < gl[y].length; i++) if (gl[y][i] === '#') g.px(x + i, 1 + y, col);
    x += gl[0].length + 1;
  }
  g.outline(INK, 1);
  g.flush(scene, key, 3);
}
