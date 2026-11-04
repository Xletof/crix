// VISUAL IDENTITY V2 — the look-development pilot's PAINTERS (`?visualPilot=v2`).
//
// OPT-IN AND PRESENTATION ONLY. Nothing here runs unless the flag is on
// (`systems/debug.js`, VISUAL IDENTITY V2), and nothing here may touch hp,
// radius, speed, AI, timing or what spawns. Every painter is deterministic:
// NO `Math.random` — the gameplay stream is shared with AI cooldowns, so a
// painter that drew from it would change the fight it is decorating.
//
// NOT IN `pixelArt.js` (pinned byte-identical by `smoke-champion-placement`)
// and NOT IN `rosterPaint.js` (the approved roster V1, frozen). The approved
// V1 cast is the style authority these follow, not code they share:
//
//   - THE SAME PIXEL GRID. Every actor is drawn at 4 world px per logical px.
//     The legacy swarmling was a 20x20 trooper sheet at 4 rendered at 0.7 —
//     2.8px pixels, a miniature of another sprite. The V2 swarm sheet is
//     painted at 6 px per logical px so that, at the SAME 0.7 render scale it
//     has always had, its pixels land at ~4.2 px: the cast's grain.
//   - THE SAME OUTLINE. Dilated from the finished silhouette (every empty
//     pixel touching the figure), one logical pixel, `#06070a` — the roster's
//     own value, so a hero and a trooper are cut out of the deck the same way.
//   - THE SAME SUN. Lit from the north-west: lit top rows and left columns,
//     dark right columns and bottom rows.
//
// THE CONTRACTS ARE THE EXISTING ONES:
//   player   24 frames  0-7 front, 8-15 back, 16-23 side (east)
//                       0 idle, 1-6 walk, 7 fire. PreloadScene builds the
//                       `mando-*` keys off this layout for either sheet.
//                       24x26 logical at 4 (96x104 px) — the roster frame.
//                       Player's constructor centres its circle on the frame
//                       (`width/2 - r`, `height/2 - r`), so a taller canvas
//                       leaves the collider exactly where it was.
//   vp-swarm 33 frames  the stock enemy contract (0-23 as above, 24-32 the
//                       raise / thrust / recoil poses per facing).
//   crates   28x28 logical at 4 (112 px) — the cover kit's frozen canvas, so
//                       the 70x70 body under it still tells the truth.

import { SpriteSheet, PixelCanvas } from './pixelArt.js';

const OUTLINE = '#06070a';

// A frame painted into a logical grid, outlined, then blitted.
function grid(w, h) {
  const c = new Array(w * h).fill(null);
  const g = { w, h, c };
  g.px = (x, y, col) => { if (col && x >= 0 && y >= 0 && x < w && y < h) c[y * w + x] = col; };
  g.get = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? c[y * w + x] : null);
  g.rect = (x, y, rw, rh, col) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) g.px(x + i, y + j, col); };
  g.hl = (y, x0, x1, col) => { for (let x = x0; x <= x1; x++) g.px(x, y, col); };
  g.vl = (x, y0, y1, col) => { for (let y = y0; y <= y1; y++) g.px(x, y, col); };
  g.outline = (col = OUTLINE) => {
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (c[y * w + x]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < w && Y < h && c[Y * w + X] && c[Y * w + X] !== col) { add.push(y * w + x); break; }
      }
    }
    for (const i of add) c[i] = col;
  };
  g.blit = (dst) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const col = c[y * w + x]; if (col) dst.px(x, y, col); } };
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE PROTAGONIST
// ═══════════════════════════════════════════════════════════════════════════
//
// WHAT WAS WRONG. The shipped Mando is a 16-wide scatter of mid-grey beskar on
// a 24x24 canvas with no outline: legs that float as four separate dots, a
// black cape that is the same value as the deck, and a body whose brightest
// pixel is darker than a Rifleman's shadow side. In play it disappears into the
// gunmetal floor and the only thing that says "you" is the ring under it —
// which turns RED when the Super charges, the enemy's colour.
//
// WHAT IDENTIFIES HIM NOW, WITHOUT THE RING, in order of distance:
//   1. THE SILHOUETTE. The widest shoulder line in the cast (rounded pauldrons,
//      16 px against the Rifleman's 14), and TWIN JETPACK CANISTERS flanking
//      the helmet in the front view — the one outline nothing else in the game
//      has. In the back view the pack is the whole read; in profile it hangs
//      behind him with the cape trailing under it.
//   2. THE MATERIAL. Polished, slightly blue beskar with real speculars — the
//      only cool-metal-with-highlights body in the roster — over a WARM dark
//      flight suit, an umber cape and tan leather. A Rifleman is flat white
//      plate; a Gunner is matt graphite; the Bulwark is grey mass. None is warm.
//   3. THE TELL. A T-visor with a single cyan glint, and two cyan thruster
//      lamps on the pack — the player's own colour, spent in pixels, not rings.
//
// Proportions follow the roster (big helmet, compact torso, short legs, 4 px
// grain) so he belongs to the same game; mass and contrast make him the lead.
const HS = { hi: '#f2f8fb', lit: '#b8c7d2', mid: '#7f8f9e', dk: '#525d6b', sh: '#323a45' };   // beskar
const HU = { lit: '#51473a', mid: '#362f27', dk: '#231f1a' };                                 // flight suit
const HC = { lit: '#6c563e', mid: '#4b3c2c', dk: '#2e241b' };                                 // cape
const HL = { lit: '#a57e4a', mid: '#71552f' };                                                // leather
const HB = '#17161a';                                                                         // boots / gloves
const HV = '#07090c';                                                                         // visor
const CYAN = '#7fe8ff';                                                                       // the player's colour

const HBOB = [0, 0, 1, 0, 0, 1, 0, 0];
const HFB = { liftL: [0, 1, 2, 1, 0, 0, 0, 0], liftR: [0, 0, 0, 0, 1, 2, 1, 0], lx: [8, 8, 8, 8, 8, 8, 8, 7], rx: [13, 13, 13, 13, 13, 13, 13, 14] };
// side legs: 3+ columns apart or a true passing frame (the roster's negative-space rule)
const HSIDE = { near: [13, 11, 14, 13, 10, 7, 8, 14], far: [8, 10, 7, 8, 11, 14, 13, 7], nearLift: [0, 1, 0, 0, 0, 0, 1, 0], farLift: [0, 0, 0, 1, 1, 0, 0, 0] };
const HSWAY = [0, 0, 1, 1, 0, -1, -1, 0];      // cape hem, follows the stride

function heroLegFB(g, x, lift, hipY, outer) {
  const bootY = 23 - lift;
  g.rect(x, hipY, 3, bootY - hipY, HU.mid);
  g.vl(outer, hipY, bootY - 1, HU.lit);                          // lit outer thigh
  const knee = hipY + 2;
  if (knee < bootY - 1) { g.hl(knee, x, x + 2, HS.mid); g.px(x, knee, HS.lit); }      // knee plate
  if (knee + 1 < bootY) g.hl(bootY - 1, x, x + 2, HS.dk);       // shin guard lip
  g.rect(x, bootY, 3, 2, HB); g.px(outer, bootY, HU.lit);        // boot, toe cap
}

// A rounded 3-wide pauldron: lit crown, mid, dark rim. `out` is its outer column.
function pauldron(g, x0, y, out) {
  g.hl(y, x0, x0 + 2, HS.lit); g.px(out, y, HS.mid);
  g.hl(y + 1, x0, x0 + 2, HS.mid); g.px(x0 + 1, y, HS.hi);
  g.hl(y + 2, x0, x0 + 2, HS.dk);
}

function heroArmFB(g, x, y) {
  g.rect(x, y, 2, 2, HU.mid);                                    // upper arm
  g.rect(x, y + 2, 2, 2, HS.mid); g.px(x, y + 2, HS.lit);        // vambrace
  g.rect(x, y + 4, 2, 1, HB);                                    // glove
}

// The helmet: an 8-wide dome with a dark jaw rim. Front adds the T-visor.
function heroHelmet(g, b, front) {
  g.hl(3 + b, 10, 13, HS.lit); g.px(11, 3 + b, HS.hi);
  g.hl(4 + b, 9, 14, HS.lit); g.px(10, 4 + b, HS.hi);
  g.rect(8, 5 + b, 8, 5, HS.mid); g.vl(8, 5 + b, 9 + b, HS.lit); g.vl(15, 5 + b, 9 + b, HS.dk);
  g.hl(10 + b, 9, 14, HS.dk);
  if (front) {
    g.hl(6 + b, 9, 14, HV); g.vl(11, 7 + b, 9 + b, HV); g.vl(12, 7 + b, 9 + b, HV);
    g.px(9, 6 + b, CYAN);                                        // the glint
    g.hl(5 + b, 9, 14, HS.lit);                                  // brow over the slit
    g.vl(16, 5 + b, 6 + b, HS.dk); g.px(16, 4 + b, HS.lit);      // rangefinder, char-left
  } else {
    g.hl(8 + b, 9, 14, HS.dk);                                   // rear seam
    g.vl(7, 5 + b, 6 + b, HS.dk); g.px(7, 4 + b, HS.lit);        // rangefinder (char-left = screen left)
  }
}

function heroFront(g, o) {
  const b = o.bob;
  // BEHIND: the cape on char-left (screen right), past the arm
  g.rect(20, 13 + b, 1, 8 - b, HC.mid); g.rect(19, 19 + b, 2, 2 - b, HC.mid);
  g.px(20 - Math.min(0, o.sway), 21, HC.dk);
  // LEGS
  if (!o.noLegs) {
    heroLegFB(g, o.lx, o.liftL, 18 + b, o.lx);
    heroLegFB(g, o.rx, o.liftR, 18 + b, o.rx + 2);
    g.rect(7, 18 + b, 1, 2, HB);                                  // holster, char-right thigh
  }
  // TORSO — the suit, two separate chest plates, an ab plate
  g.rect(7, 12 + b, 10, 5, HU.mid);
  g.vl(7, 12 + b, 16 + b, HU.lit);
  for (const x of [8, 13]) {
    g.rect(x, 12 + b, 3, 3, HS.mid); g.hl(12 + b, x, x + 2, HS.lit); g.hl(14 + b, x, x + 2, HS.dk);
  }
  g.px(8, 12 + b, HS.hi); g.px(13, 12 + b, HS.hi);
  g.rect(11, 12 + b, 2, 3, HU.dk);                                // the gap between the plates
  g.hl(15 + b, 10, 13, HS.dk); g.px(10, 15 + b, HS.mid);          // ab plate
  // BELT
  g.hl(17 + b, 7, 16, HL.mid); g.px(11, 17 + b, HL.lit); g.px(12, 17 + b, HL.lit);
  g.px(8, 18 + b, HL.mid); g.px(15, 18 + b, HL.mid);              // pouches
  // ARMS + PAULDRONS (the firing arm lifts a row on the fire frame)
  const fy = o.fire ? -1 : 0;
  heroArmFB(g, 4, 14 + b + fy);
  heroArmFB(g, 18, 14 + b);
  pauldron(g, 4, 11 + b + fy, 4);
  pauldron(g, 17, 11 + b, 19);
  g.hl(11 + b, 10, 13, HU.dk);                                    // neck
  heroHelmet(g, b, true);
}

function heroBack(g, o) {
  const b = o.bob, sw = o.sway;
  if (!o.noLegs) {
    heroLegFB(g, o.rx - 5, o.liftR, 18 + b, o.rx - 5);
    heroLegFB(g, o.lx + 5, o.liftL, 18 + b, o.lx + 7);
  }
  // CAPE: shoulder to the back of the knees, wide, so it frames the pack
  g.rect(6, 12 + b, 12, 7, HC.mid);
  g.rect(6 + sw, 19 + b, 12, 3 - b, HC.mid);
  g.vl(6, 12 + b, 18 + b, HC.lit); g.px(6 + sw, 20, HC.lit);
  for (const x of [7, 12, 16]) g.vl(x + (x > 7 ? sw : 0), 17 + b, 21, HC.dk);
  g.hl(21, 7 + sw, 17 + sw, HC.dk);
  // ARMS + PAULDRONS
  heroArmFB(g, 4, 14 + b);
  heroArmFB(g, 18, 14 + b + (o.fire ? -1 : 0));
  pauldron(g, 4, 11 + b, 4);
  pauldron(g, 17, 11 + b + (o.fire ? -1 : 0), 19);
  // THE JETPACK — two canisters and a dark core, sitting on the cape
  for (const x of [8, 14]) {
    g.px(x, 11 + b, HS.lit); g.px(x + 1, 11 + b, HS.mid);
    g.rect(x, 12 + b, 2, 6, HS.mid); g.vl(x, 12 + b, 17 + b, HS.lit); g.vl(x + 1, 13 + b, 17 + b, HS.dk);
    g.hl(18 + b, x, x + 1, HS.sh);                               // nozzle
    g.px(x + (x < 12 ? 0 : 1), 19 + b, CYAN);                    // thruster lamp
  }
  g.rect(10, 13 + b, 4, 5, HS.sh); g.hl(13 + b, 10, 13, HS.dk);
  g.px(11, 15 + b, HS.mid); g.px(12, 15 + b, HS.dk);               // the core's vent
  g.hl(11 + b, 10, 13, HU.dk);                                    // neck
  heroHelmet(g, b, false);
}

function heroSide(g, o) {
  const b = o.bob, sw = o.sway, L = o.lean;
  // CAPE trailing behind, under the pack
  g.rect(4 + L, 12 + b, 4, 7, HC.mid); g.vl(4 + L, 12 + b, 18 + b, HC.dk);
  g.rect(4 + L - Math.max(0, sw), 19 + b, 4, 3 - b, HC.mid); g.hl(21, 4 + L - Math.max(0, sw), 7 + L, HC.dk);
  // LEGS (far first)
  if (!o.noLegs) {
    const hipY = 18 + b;
    const fb = 23 - o.farLift;
    g.rect(o.far, hipY, 2, fb - hipY, HU.dk); g.rect(o.far - 1, fb, 3, 2, HB);
    const nb = 23 - o.nearLift;
    g.rect(o.near, hipY, 2, nb - hipY, HU.mid); g.vl(o.near + 1, hipY + 1, nb - 1, HU.lit);
    if (hipY + 2 < nb - 1) g.hl(hipY + 2, o.near, o.near + 1, HS.mid);
    g.rect(o.near, nb, 3, 2, HB); g.px(o.near + 2, nb, HU.lit);
  }
  // THE JETPACK on the back: one canister seen, its lamp
  g.px(6 + L, 10 + b, HS.lit); g.px(7 + L, 10 + b, HS.mid);
  g.rect(6 + L, 11 + b, 2, 7, HS.mid); g.vl(6 + L, 11 + b, 17 + b, HS.lit); g.vl(7 + L, 12 + b, 17 + b, HS.dk);
  g.hl(18 + b, 6 + L, 7 + L, HS.sh); g.px(6 + L, 19 + b, CYAN);
  // TORSO
  g.rect(8 + L, 12 + b, 6, 6, HU.mid);
  g.rect(10 + L, 12 + b, 4, 3, HS.mid); g.hl(12 + b, 10 + L, 13 + L, HS.lit); g.px(12 + L, 12 + b, HS.hi);
  g.hl(14 + b, 10 + L, 13 + L, HS.dk);
  g.hl(17 + b, 8 + L, 13 + L, HL.mid); g.px(12 + L, 17 + b, HL.lit);
  g.rect(11 + L, 18 + b, 2, 2, HB); g.px(11 + L, 18 + b, HS.dk);       // holster on the near hip
  // PAULDRON (near) and the arm forward to the weapon
  const fx = o.fire ? -1 : 0;
  g.hl(11 + b, 9 + L + fx, 12 + L + fx, HS.lit); g.px(10 + L + fx, 11 + b, HS.hi);
  g.hl(12 + b, 9 + L + fx, 12 + L + fx, HS.mid); g.hl(13 + b, 9 + L + fx, 12 + L + fx, HS.dk);
  g.rect(12 + L + fx, 14 + b, 2, 1, HU.mid);
  g.rect(13 + L + fx + o.hand, 15 + b, 3, 1, HS.mid); g.px(13 + L + fx + o.hand, 15 + b, HS.lit);
  g.px(16 + L + fx + o.hand, 15 + b, HB);
  // HELMET (profile) — dome, the visor at the front, the jaw rim
  g.hl(3 + b, 10 + L, 13 + L, HS.lit); g.px(11 + L, 3 + b, HS.hi);
  g.hl(4 + b, 9 + L, 14 + L, HS.lit);
  g.rect(9 + L, 5 + b, 7, 5, HS.mid); g.vl(9 + L, 5 + b, 9 + b, HS.dk); g.hl(5 + b, 10 + L, 15 + L, HS.lit);
  g.hl(10 + b, 10 + L, 15 + L, HS.dk);
  g.hl(6 + b, 13 + L, 15 + L, HV); g.vl(15 + L, 7 + b, 9 + b, HV);
  g.px(15 + L, 6 + b, CYAN);
  g.hl(11 + b, 11 + L, 12 + L, HU.dk);
}

function heroFrame(dir, k) {
  const g = grid(24, 26);
  const o = {
    bob: HBOB[k], fire: k === 7, sway: HSWAY[k], lean: k === 7 ? -1 : 0, hand: k === 7 ? -1 : 0,
    lx: HFB.lx[k], rx: HFB.rx[k], liftL: HFB.liftL[k], liftR: HFB.liftR[k],
    near: HSIDE.near[k], far: HSIDE.far[k], nearLift: HSIDE.nearLift[k], farLift: HSIDE.farLift[k],
  };
  if (dir === 'front') heroFront(g, o); else if (dir === 'back') heroBack(g, o); else heroSide(g, o);
  g.outline();
  return g;
}

/** The V2 protagonist, painted into `key` on the shipped 24-frame contract. */
export function paintPilotHero(scene, key = 'player') {
  const ss = new SpriteSheet(scene, key, 24, 26, 24, 4);
  ['front', 'back', 'side'].forEach((dir, di) => {
    for (let k = 0; k < 8; k++) heroFrame(dir, k).blit(ss.frame(di * 8 + k));
  });
  ss.finish();
}

// ═══════════════════════════════════════════════════════════════════════════
// THE SWARMLING — a skitter drone
// ═══════════════════════════════════════════════════════════════════════════
//
// WHAT WAS WRONG. The swarmling has worn the legacy Rifleman sheet at 0.7 with
// a multiply tint: a small green stormtrooper, upright, with 2.8 px pixels —
// and `fx.hitFlash` clears every tint, so one that survives a hit turns into a
// miniature WHITE trooper. Its role is "fast, fragile, comes in a pack and
// closes to melee", and an upright soldier says none of that.
//
// THE DESIGN. A low, wide, armoured crawler: a beetle carapace in baked acid
// green (the colour the human already knows it by), four splayed gunmetal
// legs, two forward shear-blades, and ONE yellow-white sensor eye. It is the
// only horizontal silhouette among the ordinary enemies, so a pack reads as a
// pack — a scatter of low shapes under a crowd of upright ones — before any
// detail does. The eye and the blades point where it is going.
//
// Same 0.7 render scale and the same body circle as before (`wearPilotSwarm`
// re-centres the circle on this frame at the same radius). 15x14 logical at 6
// px = 90x84 px, rendered 63x59 — the legacy frame was 56x56.
const SW = { w: 15, h: 14, s: 6 };
const SC = { hi: '#ccff76', lit: '#8fda38', mid: '#58a024', dk: '#356619', sh: '#1f3d0e' };   // carapace
const SF = { mid: '#232820', dk: '#121510' };                                                 // under-chassis, face
const SL = { lit: '#727b6c', mid: '#434a3f', dk: '#2a2f27' };                                 // legs
const SB = { lit: '#eef2e8', mid: '#a3ab9d' };                                                // shear-blades
const SE = { ring: '#d6ff3c', hot: '#fffff0' };                                               // the eye

// leg tips step in a tripod: [front-left, rear-left, front-right, rear-right] lift per frame
const SWALK = [[0, 0, 0, 0], [1, 0, 0, 1], [1, 0, 0, 1], [0, 0, 0, 0], [0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]];

function swarmLeg(g, pts) {
  pts.forEach(([x, y], i) => g.px(x, y, i === pts.length - 2 ? SL.lit : (i === pts.length - 1 ? SL.dk : SL.mid)));
}

// The shell from above: two wing plates split down the middle, a chevron of
// dark markings pointing the way it is going, and a dark brow over the face.
function swarmShell(g, b, chev) {
  g.hl(2 + b, 5, 9, SC.lit); g.px(6, 2 + b, SC.hi);
  g.hl(3 + b, 4, 10, SC.lit); g.px(5, 3 + b, SC.hi);
  g.rect(3, 4 + b, 9, 3, SC.mid); g.vl(3, 4 + b, 6 + b, SC.lit); g.vl(11, 4 + b, 6 + b, SC.dk);
  g.vl(7, 3 + b, 6 + b, SC.sh);
  if (chev) {                                                     // markings: a chevron aimed at the viewer
    g.px(5, 4 + b, SC.dk); g.px(6, 5 + b, SC.dk); g.px(9, 4 + b, SC.dk); g.px(8, 5 + b, SC.dk);
  } else {                                                        // from behind: segment bands
    g.hl(5 + b, 4, 6, SC.dk); g.hl(5 + b, 8, 10, SC.dk);
  }
}

function swarmFront(g, o) {
  const b = o.bob, [fl, rl, fr, rr] = o.lift, sp = o.spread;
  // legs first (under the shell)
  swarmLeg(g, [[3, 5 + b], [2, 4 + b], [1, 4 + b - rl], [0, 5 + b - rl]]);
  swarmLeg(g, [[11, 5 + b], [12, 4 + b], [13, 4 + b - rr], [14, 5 + b - rr]]);
  swarmLeg(g, [[3, 8 + b], [2, 9 + b], [1, 10 + b - fl], [1, 11 + b - fl]]);
  swarmLeg(g, [[11, 8 + b], [12, 9 + b], [13, 10 + b - fr], [13, 11 + b - fr]]);
  // the face under the brow, and the shear-blades hooking in from its corners
  g.rect(4, 7 + b, 7, 3, SF.mid); g.hl(9 + b, 5, 9, SF.dk);
  g.px(3 - sp, 9 + b, SB.mid); g.px(3 - sp, 10 + b, SB.lit); g.px(4 - sp, 11 + b, SB.lit); g.px(5, 11 + b, SB.mid);
  g.px(11 + sp, 9 + b, SB.mid); g.px(11 + sp, 10 + b, SB.lit); g.px(10 + sp, 11 + b, SB.lit); g.px(9, 11 + b, SB.mid);
  swarmShell(g, b, true);
  g.hl(7 + b, 4, 10, SC.sh);                                      // the brow
  // ONE EYE, wide and hot
  g.px(6, 8 + b, SE.ring); g.px(7, 8 + b, SE.hot); g.px(8, 8 + b, SE.ring);
  if (o.hot) { g.px(5, 8 + b, SE.ring); g.px(9, 8 + b, SE.ring); g.px(7, 9 + b, SE.ring); }
}

function swarmBack(g, o) {
  const b = o.bob, [fl, rl, fr, rr] = o.lift;
  swarmLeg(g, [[3, 4 + b], [2, 3 + b], [1, 3 + b - fl], [0, 4 + b - fl]]);
  swarmLeg(g, [[11, 4 + b], [12, 3 + b], [13, 3 + b - fr], [14, 4 + b - fr]]);
  swarmLeg(g, [[3, 8 + b], [2, 9 + b], [1, 10 + b - rl], [1, 11 + b - rl]]);
  swarmLeg(g, [[11, 8 + b], [12, 9 + b], [13, 10 + b - rr], [13, 11 + b - rr]]);
  // the abdomen, banded, and its sting, trailing south (towards the viewer)
  g.rect(5, 7 + b, 5, 3, SC.dk); g.hl(7 + b, 5, 9, SC.mid); g.hl(9 + b, 6, 8, SC.sh);
  g.px(7, 10 + b, SC.dk); g.px(7, 11 + b, SB.mid);
  swarmShell(g, b, false);
}

function swarmSide(g, o) {
  const b = o.bob, [fl, rl, fr, rr] = o.lift, lg = o.lunge;
  // far legs (darker), then the near ones
  for (const [x0, lift] of [[4, rr], [8, fr]]) { g.px(x0 + 1, 9 + b, SL.dk); g.px(x0 + 1, 10 + b - lift, SL.dk); g.px(x0 + 2, 11 + b - lift, SL.dk); }
  swarmLeg(g, [[4, 8 + b], [3, 9 + b], [2, 10 + b - rl], [2, 11 + b - rl]]);
  swarmLeg(g, [[7, 8 + b], [7, 9 + b], [6, 10 + b - fl], [6, 11 + b - fl]]);
  swarmLeg(g, [[10 + lg, 8 + b], [11 + lg, 9 + b], [12 + lg, 10 + b - fl], [12 + lg, 11 + b - fl]]);
  g.rect(4, 8 + b, 7, 1, SF.mid);                                  // under-chassis
  // head forward, the eye, the blade out in front
  g.rect(10 + lg, 5 + b, 3, 3, SF.mid); g.hl(5 + b, 10 + lg, 12 + lg, SC.sh);
  g.px(12 + lg, 6 + b, SE.hot); g.px(11 + lg, 6 + b, SE.ring); if (o.hot) g.px(12 + lg, 7 + b, SE.ring);
  g.px(13 + lg, 7 + b, SB.mid); g.px(14 + lg, 8 + b, SB.lit); g.px(13 + lg, 8 + b, SB.mid);
  // carapace — an arched shell, lit along its crest, a dark marking
  g.hl(2 + b, 5, 9, SC.lit); g.px(6, 2 + b, SC.hi);
  g.hl(3 + b, 4, 10, SC.lit); g.px(5, 3 + b, SC.hi);
  g.rect(3, 4 + b, 8, 2, SC.mid); g.px(3, 4 + b, SC.lit);
  g.px(7, 4 + b, SC.dk); g.px(8, 5 + b, SC.dk);
  g.hl(6 + b, 3, 10, SC.dk); g.hl(7 + b, 4, 9, SC.sh);
  g.px(2, 6 + b, SC.dk);                                          // the shell's trailing point
}

function swarmFrame(dir, k, pose = null) {
  const g = grid(SW.w, SW.h);
  const fire = !pose && k === 7;
  const o = {
    bob: pose === 'raise' ? -1 : pose ? 1 : (k === 2 || k === 5 ? 1 : 0),
    lift: pose ? [0, 0, 0, 0] : SWALK[k],
    hot: fire || pose === 'thrust',
    spread: fire || pose === 'raise' ? 1 : 0,
    lunge: fire || pose === 'thrust' ? 1 : (pose === 'recoil' ? -1 : 0),
  };
  if (dir === 'front') swarmFront(g, o); else if (dir === 'back') swarmBack(g, o); else swarmSide(g, o);
  g.outline();
  return g;
}

/** The V2 swarmling sheet (stock 33-frame contract). */
export function paintPilotSwarm(scene, key = 'vp-swarm') {
  const ss = new SpriteSheet(scene, key, SW.w, SW.h, 33, SW.s);
  ['front', 'back', 'side'].forEach((dir, di) => {
    for (let k = 0; k < 8; k++) swarmFrame(dir, k).blit(ss.frame(di * 8 + k));
    ['raise', 'thrust', 'recoil'].forEach((pose, pi) => swarmFrame(dir, 0, pose).blit(ss.frame(24 + di * 3 + pi)));
  });
  ss.finish();
}

/** The stock idle / walk / fire / pose keys for `prefix` on `tex` (PreloadScene's contract). */
export function registerStockAnims(scene, prefix, tex) {
  [['front', 0], ['back', 8], ['side', 16]].forEach(([d, off], di) => {
    scene.anims.create({ key: `${prefix}-idle-${d}`, frames: [{ key: tex, frame: off }], frameRate: 4, repeat: -1 });
    scene.anims.create({
      key: `${prefix}-walk-${d}`,
      frames: [1, 2, 3, 4, 5, 6].map((i) => ({ key: tex, frame: off + i })),
      frameRate: 14, repeat: -1,
    });
    scene.anims.create({ key: `${prefix}-fire-${d}`, frames: [{ key: tex, frame: off + 7 }], frameRate: 12, repeat: 0 });
    ['raise', 'thrust', 'recoil'].forEach((p, pi) => {
      scene.anims.create({ key: `${prefix}-${p}-${d}`, frames: [{ key: tex, frame: 24 + di * 3 + pi }], frameRate: 10, repeat: 0 });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HANGAR COVER — the cargo modules, and a material pass for the rest
// ═══════════════════════════════════════════════════════════════════════════
//
// WHAT WAS WRONG. The shipped crates are olive at the deck's own value: lid,
// face and foot within a few steps of each other and of the floor, so in play
// they read as dark patches rather than as things standing ON the deck.
//
// THE THREE PLANES, PUSHED APART. A lid that is clearly the lightest plane
// (lit north bevel, worn corners); a front face two steps darker with deep
// corrugation; a foot and a pallet in shadow. A worn AMBER band (hazard paint,
// never red) with chips in it, grime pooling at the base of the face, and a
// SELECTIVE outline: base and sides cut out in near-black, the lit top edge
// left open, so cover reads as heavy and grounded but never as a character
// (the full outline is the actors' — the hierarchy is the point).
const CR = { lid: '#4f4b3b', lidLit: '#64604b', lidHi: '#7b7559', face: '#34322a', faceLit: '#403d33', faceDk: '#211f19', foot: '#15140f' };
const CB = { mid: '#7a6330', lit: '#94793d', dk: '#4a3c1d' };      // worn amber band — paint, not a lamp
const CM = { bolt: '#8a8f96', dk: '#202024', seam: '#0c0c0a' };

function crateModule(g, x0, x1, ty, by, corr) {
  // LID — tapering inward with depth, lit north bevel, worn corners
  for (let y = ty; y <= ty + 3; y++) {
    const k = Math.floor((y - ty) * 0.6);
    g.hl(y, x0 + k, x1 - k, y === ty ? CR.lidLit : CR.lid);
  }
  g.hl(ty, x0 + 2, x1 - 2, CR.lidHi);
  g.px(x0, ty, CR.lidHi); g.px(x1, ty, CR.lidLit);
  g.hl(ty + 4, x0, x1, CM.seam);
  // FACE — corrugated, a lit west edge, a dark east edge, grime at the base
  g.rect(x0, ty + 5, x1 - x0 + 1, by - ty - 5, CR.face);
  if (corr) for (let x = x0 + 2; x < x1 - 1; x += 3) { g.vl(x, ty + 6, by - 2, CR.faceDk); g.vl(x - 1, ty + 6, by - 2, CR.faceLit); }
  g.vl(x0, ty + 5, by, CR.faceLit);
  g.vl(x1, ty + 5, by, CR.faceDk);
  g.hl(by - 1, x0 + 1, x1 - 1, CR.faceDk);
  g.hl(by, x0, x1, CM.seam);
  // CORNER CASTINGS
  for (const [cx0, cy0] of [[x0, ty + 5], [x1 - 2, ty + 5], [x0, by - 3], [x1 - 2, by - 3]]) {
    g.rect(cx0, cy0, 3, 3, CM.dk); g.px(cx0 + 1, cy0 + 1, CM.bolt);
  }
}

function crateBand(g, x0, x1, y, chips) {
  g.rect(x0, y, x1 - x0 + 1, 2, CB.mid);
  g.hl(y, x0, x1, CB.lit);
  g.hl(y + 2, x0, x1, CB.dk);
  for (const cx of chips) { g.px(cx, y, CR.face); g.px(cx + 1, y + 1, CR.faceDk); }
}

function selectiveOutline(g) {
  // base and sides only: an empty cell gets the outline when the figure is
  // above it, left of it or right of it — never when the figure is below it.
  const add = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.get(x, y)) continue;
    if (g.get(x, y - 1) || g.get(x - 1, y) || g.get(x + 1, y)) add.push([x, y]);
  }
  for (const [x, y] of add) g.px(x, y, OUTLINE);
}

/** V2 cargo module on the cover kit's 28x28 canvas. `variant` 'a' tall, 'b' stacked. */
export function paintPilotCrate(scene, key, variant = 'a') {
  const g = grid(28, 28);
  if (variant === 'a') {
    crateModule(g, 2, 25, 1, 22, true);
    crateBand(g, 2, 25, 9, [5, 14, 21]);
    crateBand(g, 2, 25, 16, [8, 18]);
    g.hl(13, 6, 12, CR.lidLit); g.hl(13, 15, 18, CR.lidLit);       // stencil block
  } else {
    crateModule(g, 6, 22, 1, 10, false);
    crateBand(g, 7, 21, 5, [11, 17]);
    crateModule(g, 2, 25, 11, 22, true);
    crateBand(g, 2, 25, 17, [6, 15, 22]);
    g.hl(15, 5, 13, CR.lidLit);
    g.vl(9, 2, 12, CM.dk); g.vl(19, 2, 12, CM.dk);                 // tie-down straps
    g.px(9, 1, CM.bolt); g.px(19, 1, CM.bolt);
  }
  // PALLET — the foot, in shadow, slatted
  g.rect(1, 23, 26, 3, CR.foot);
  g.hl(23, 1, 26, CR.faceDk);
  for (let x = 3; x < 26; x += 6) g.vl(x, 24, 25, CM.seam);
  selectiveOutline(g);
  const c = new PixelCanvas(scene, key, 28, 28, 4);
  g.blit(c);
  c.finish();
}

/**
 * A MATERIAL PASS over an existing prop texture, into a NEW key: the selective
 * outline (base and sides, never the lit top) plus a one-pixel top bevel.
 * Every source pixel stays where it was — a console's screen keeps the exact
 * place its `CONSOLE_KIT` light was declared against — and the canvas size is
 * unchanged, so a static body sized from it is unchanged.
 */
export function paintMaterialPass(scene, srcKey, dstKey, s = 4) {
  const src = scene.textures.get(srcKey)?.getSourceImage();
  if (!src?.width) return false;
  const w = Math.round(src.width / s), h = Math.round(src.height / s);
  const tmp = document.createElement('canvas');
  tmp.width = src.width; tmp.height = src.height;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(src, 0, 0);
  const data = tctx.getImageData(0, 0, src.width, src.height).data;
  const g = grid(w, h);
  const hex = (v) => v.toString(16).padStart(2, '0');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y * s + (s >> 1)) * src.width + (x * s + (s >> 1))) * 4;
    if (data[i + 3] > 127) g.px(x, y, `#${hex(data[i])}${hex(data[i + 1])}${hex(data[i + 2])}`);
  }
  // top bevel: a cell with nothing above it catches the north light
  const lift = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const col = g.get(x, y);
    if (!col || g.get(x, y - 1)) continue;
    const n = parseInt(col.slice(1), 16), k = 0.22;
    const ch = (v) => Math.round(v + (255 - v) * k);
    lift.push([x, y, `#${hex(ch(n >> 16))}${hex(ch((n >> 8) & 255))}${hex(ch(n & 255))}`]);
  }
  for (const [x, y, col] of lift) g.px(x, y, col);
  selectiveOutline(g);
  const c = new PixelCanvas(scene, dstKey, w, h, s);
  g.blit(c);
  c.finish();
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// V2B — MATERIAL DEPTH AND CONTRAST (`?visualPilot=v2b`, Hangar only)
// ═══════════════════════════════════════════════════════════════════════════
//
// THE DIAGNOSIS (measured on the V2 textures and frames, luminance 0-255):
//   - MACHINERY SITS AT OR BELOW THE DECK. Shuttle median 30, gantry 32,
//     consoles 19-26, against a deck of ~35: dark-on-dark, held apart by a 1px
//     outline that disappears at the phone's 0.54x.
//   - THE V2 CRATE HAS NO TOP. Lid 75 against face 50 — a 25-level step — and
//     the brightest pixels in it (the amber bands, ~120) are on the FACE, so
//     the eye reads horizontal stripes, not a top plane over a vertical side.
//
// THE V2B LADDER. Deck ~35 (unchanged, matte, quiet) · cover LID ~105 over a
// FACE ~40 (a 2.6x step, the lightest environment plane in the room) · dark
// machinery bodies ~20-35 given RELIEF — a cool lit rim on every edge that
// faces the north-west sun, a darkened edge on every one that faces away, and
// a lit lip under every recessed joint — so a dark housing reads by its edges,
// not by being lightened. Characters stay above all of it.

// ── V2B CARGO MODULE ──────────────────────────────────────────────────────
// Same 28x28 canvas and the same two layouts as V2, re-planed: the lid is now
// eight rows deep and the lightest thing on the object, with a lit north / west
// bevel and a bright LIP where it turns down into the face; the face is dark,
// deeply ribbed, west edge catching light, east edge in shadow; ONE worn amber
// band, on the face only, so the top stays a clean plane.
const CR2 = {
  lidHi: '#8c876b', lid: '#6f6b56', lidDk: '#57533f', lip: '#9a9476',
  face: '#2b2923', faceLit: '#39362d', faceDk: '#1e1c17', faceW: '#4a4637',
  foot: '#15140f', seam: '#0b0b09', bolt: '#8a8f96', cast: '#24231d',
};
const CB2 = { mid: '#6e5626', lit: '#8a6c30', dk: '#45361a' };

function crate2Module(g, x0, x1, ty, lidRows, by, corr) {
  // LID (the top plane): lit north row and west column, dark east column
  g.rect(x0, ty, x1 - x0 + 1, lidRows, CR2.lid);
  g.hl(ty, x0 + 1, x1 - 1, CR2.lidHi);
  g.vl(x0, ty, ty + lidRows - 1, CR2.lidHi);
  g.vl(x1, ty + 1, ty + lidRows - 1, CR2.lidDk);
  // corner castings on the lid, and a recessed grab slot
  for (const [cx, cy] of [[x0 + 1, ty + 1], [x1 - 2, ty + 1]]) { g.rect(cx, cy, 2, 2, CR2.cast); g.px(cx, cy, CR2.bolt); }
  if (x1 - x0 > 12) { g.hl(ty + 3, x0 + 5, x0 + 9, CR2.lidDk); g.hl(ty + 4, x0 + 5, x0 + 9, CR2.lidHi); }
  // THE LIP: the lid's near edge, where it turns down — the brightest line on the object
  const lipY = ty + lidRows - 1;
  g.hl(lipY, x0, x1, CR2.lip);
  g.hl(lipY + 1, x0, x1, CR2.seam);
  // FACE (the vertical plane): dark, ribbed
  const fy = lipY + 2;
  g.rect(x0, fy, x1 - x0 + 1, by - fy + 1, CR2.face);
  if (corr) for (let x = x0 + 2; x < x1 - 1; x += 3) { g.vl(x, fy + 1, by - 1, CR2.faceDk); g.vl(x - 1, fy + 1, by - 1, CR2.faceLit); }
  g.vl(x0, fy, by, CR2.faceW);
  g.vl(x1, fy, by, CR2.faceDk);
  g.hl(by, x0, x1, CR2.faceDk);
  for (const [cx, cy] of [[x0, by - 2], [x1 - 1, by - 2]]) { g.rect(cx, cy, 2, 2, CR2.cast); g.px(cx, cy, CR2.bolt); }
  return fy;
}

function crate2Band(g, x0, x1, y, chips) {
  g.hl(y, x0 + 1, x1 - 1, CB2.lit);
  g.hl(y + 1, x0 + 1, x1 - 1, CB2.mid);
  g.hl(y + 2, x0 + 1, x1 - 1, CB2.dk);
  for (const cx of chips) { g.px(cx, y, CR2.faceLit); g.px(cx, y + 1, CR2.face); }
}

/** V2B cargo module on the cover kit's 28x28 canvas. `variant` 'a' tall, 'b' stacked. */
export function paintPilotCrateB(scene, key, variant = 'a') {
  const g = grid(28, 28);
  if (variant === 'a') {
    const fy = crate2Module(g, 2, 25, 1, 8, 22, true);
    crate2Band(g, 2, 25, fy + 5, [6, 15, 21]);
  } else {
    // the smaller module stacked on the larger one, pushed off-centre: its lid,
    // its face, then the larger module's lid showing as a LEDGE around it
    const fy1 = crate2Module(g, 6, 21, 1, 5, 9, false);
    crate2Band(g, 6, 21, fy1, [10, 17]);
    // the lower module: lid visible as a ledge (rows 10-11) then its face
    g.rect(2, 10, 24, 2, CR2.lid); g.hl(10, 2, 5, CR2.lidHi); g.hl(10, 22, 25, CR2.lidHi);
    g.vl(2, 10, 11, CR2.lidHi);
    g.hl(11, 6, 21, CR2.lidDk);                                    // the upper module's contact on the ledge
    g.hl(12, 2, 25, CR2.lip); g.hl(13, 2, 25, CR2.seam);
    g.rect(2, 14, 24, 9, CR2.face);
    for (let x = 4; x < 24; x += 3) { g.vl(x, 15, 21, CR2.faceDk); g.vl(x - 1, 15, 21, CR2.faceLit); }
    g.vl(2, 14, 22, CR2.faceW); g.vl(25, 14, 22, CR2.faceDk); g.hl(22, 2, 25, CR2.faceDk);
    crate2Band(g, 2, 25, 17, [7, 16, 22]);
    for (const [cx, cy] of [[2, 20], [24, 20]]) { g.rect(cx, cy, 2, 2, CR2.cast); g.px(cx, cy, CR2.bolt); }
    g.vl(9, 1, 9, CM.dk); g.vl(18, 1, 9, CM.dk);                    // tie-down straps over the upper lid
  }
  // PALLET — in shadow, slatted
  g.rect(1, 23, 26, 2, CR2.foot);
  for (let x = 3; x < 26; x += 6) g.vl(x, 23, 24, CR2.seam);
  selectiveOutline(g);
  const c = new PixelCanvas(scene, key, 28, 28, 4);
  g.blit(c);
  c.finish();
}

// ── RELIEF — the machinery pass ───────────────────────────────────────────
//
// For DARK MACHINERY the answer is not to lighten it but to give its edges
// light. On a copy of the shipped texture (every pixel where it was, the same
// canvas), each METAL cell (low saturation, above the outline's value) is
// judged by its neighbours, in WORLD orientation (`flip` mirrors west):
//   - an edge facing the north-west sun — nothing (or the outline, or a dark
//     recessed joint) to its north or west — takes a cool RIM light;
//   - an edge facing away — nothing to its east or south — is darkened.
// So a silhouette gets a lit rim on two sides and a shadowed one on two, and
// every recessed panel joint gets a lit lip on its far side: construction read
// as relief. Saturated cells (screens, LEDs, hazard paint) are never touched.
// `sym` lights only north / darkens only south (for a texture that is placed
// both flipped and not); `outline` adds the cover kit's selective outline.
function hexOf(n) { return `#${n.toString(16).padStart(6, '0')}`; }
export function paintReliefPass(scene, srcKey, dstKey, o = {}) {
  const {
    s = 4, flip = false, sym = false, rim = 0.42, shade = 0.70, outline = false,
    bodyLum = 26, metalSat = 0.30, inner = true, edgeLum = 14, planes = null,
  } = o;
  const src = scene.textures.get(srcKey)?.getSourceImage();
  if (!src?.width) return false;
  const w = Math.round(src.width / s), h = Math.round(src.height / s);
  const tmp = document.createElement('canvas');
  tmp.width = src.width; tmp.height = src.height;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(src, 0, 0);
  const data = tctx.getImageData(0, 0, src.width, src.height).data;
  const rgb = new Array(w * h).fill(null);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y * s + (s >> 1)) * src.width + (x * s + (s >> 1))) * 4;
    if (data[i + 3] > 127) rgb[y * w + x] = [data[i], data[i + 1], data[i + 2]];
  }
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const sat = (c) => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
  // What counts as "nothing there" beside a cell: empty, or the outline, or —
  // when `inner` — any dark recessed joint (then every joint gets a lit lip).
  const gap = (x, y) => {
    const c = (x >= 0 && y >= 0 && x < w && y < h) ? rgb[y * w + x] : null;
    return !c || lum(c) < (inner ? bodyLum : edgeLum);
  };
  const g = grid(w, h);
  const RIM = [201, 211, 221];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = rgb[y * w + x];
    if (!c) continue;
    let out = c;
    if (lum(c) >= bodyLum && sat(c) <= metalSat) {
      // PLANES (a fixture whose chassis rows are known — `conChassis`'s own
      // top / base numbers): a moderately lit TOP over the dark face, the
      // base a step deeper. The rim and shade below then work on that.
      if (planes?.top && y >= planes.top[0] && y <= planes.top[1]) out = out.map((v, j) => Math.round(v + ([170, 180, 192][j] - v) * planes.top[2]));
      else if (planes?.base && y >= planes.base[0] && y <= planes.base[1]) out = out.map((v) => Math.round(v * planes.base[2]));
      const c0 = out;
      const west = flip ? x + 1 : x - 1, east = flip ? x - 1 : x + 1;
      // the edge's outward normal, against the north-west sun: a staircase
      // facing south-west or north-east comes out neutral, not dotted
      const nx = sym ? 0 : (gap(west, y) ? 1 : 0) - (gap(east, y) ? 1 : 0);
      const ny = (gap(x, y - 1) ? 1 : 0) - (gap(x, y + 1) ? 1 : 0);
      const d = nx + ny;
      if (d > 0) {
        const k = Math.min(0.75, rim * (d > 1 ? 1.25 : 1));
        out = c0.map((v, j) => Math.round(v + (RIM[j] - v) * k));
      } else if (d < 0) {
        out = c0.map((v) => Math.round(v * (d < -1 ? shade * 0.9 : shade)));
      }
    }
    g.px(x, y, hexOf((out[0] << 16) | (out[1] << 8) | out[2]));
  }
  if (outline) selectiveOutline(g);
  const cv = new PixelCanvas(scene, dstKey, w, h, s);
  g.blit(cv);
  cv.finish();
  return true;
}
