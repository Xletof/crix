// P1-C — THE PROTAGONIST'S WEAPONS (`?visualPilot=v2c&polish=p1`), painted.
//
// OPT-IN AND PRESENTATION ONLY: `paintPolishP1` is a no-op without the flag,
// paints only NEW `p1-*` keys, and draws no `Math.random`. The shipped
// `wpn-pistol` / `wpn-rifle` / `wpn-blade` painters in `pixelArt.js` are not
// touched (and keep painting their keys for every other mode).
//
// WHAT WAS WRONG. The shipped overlays are the previous generation's: flat
// imperial-grey strips with no outline (so on the gunmetal deck they read as a
// grey line, not an object), no hand (so the gun hovers beside the V2 hero
// rather than being held), and a rifle that is the pistol's strip made longer.
// The blade's hilt was a dark stub behind the glow.
//
// THE DESIGN, in the V2 hero's own language (`vpPaint.js`, THE PROTAGONIST):
//   - THE SAME GRAIN AND CUT. 4 world px per logical px, and the hero's dilated
//     one-pixel `#06070a` outline, so a weapon is cut out of the deck the way
//     he is.
//   - THE SAME SUN AND MATERIALS. Lit from the north-west (lit top rows), dark
//     GUNMETAL bodies a step below his beskar so the weapon separates from the
//     armour it crosses, beskar highlights, his tan LEATHER on the grips.
//   - THE HAND COMES WITH THE WEAPON. Every gun is painted with the hero's black
//     glove closed round its grip and a beskar vambrace cuff behind it, so the
//     overlay always carries the hand that holds it — whichever of his four
//     painted directions the body is showing.
//   - HIS COLOUR, SPENT IN PIXELS. One cyan power cell on the pistol, a cyan
//     scope lens on the rifle — the T-visor glint's colour. `-hot` variants
//     (worn while the Super is ready) turn the cell white-hot and light the top
//     edge: the weapon joins the Super-ready read (P1-B) instead of a ring alone.
//   - THE BORE AXIS IS THE TEXTURE'S CENTRE ROW. Phaser flips a texture about
//     its frame centre, so the barrel sits exactly on the vertical middle and a
//     west-facing (flipY) gun keeps its bore on the aim ray, its grip hanging
//     down, and its origin in the glove.
//
// Contract (all drawn barrel-right, grip-down, like the shipped overlays):
//   p1-pistol(-hot)  13x10 logical at 4 = 52x40   origin (P1_WEAPONS.pistol)
//   p1-rifle(-hot)   18x10 logical at 4 = 72x40   origin (P1_WEAPONS.rifle)
//   p1-blade         24x10 logical at 4 = 96x40   the shipped blade's canvas and
//                    origin (0.14, 0.5), so the swing geometry is unchanged

import { PixelCanvas } from './pixelArt.js';
import { isPolishP1 } from './debug.js';

const OUTLINE = '#06070a';
// the V2 hero's materials (vpPaint.js HS / HL / HB / CYAN)
const HS = { hi: '#f2f8fb', lit: '#b8c7d2', mid: '#7f8f9e', dk: '#525d6b', sh: '#323a45' };
const HL = { lit: '#a57e4a', mid: '#71552f' };
const HB = '#17161a';
const KN = '#3b3a42';           // glove knuckle catch
const CYAN = '#7fe8ff';
// gunmetal: a step darker and bluer than his beskar
const GM = { hi: '#a9b6c2', lit: '#6c7884', mid: '#454d57', dk: '#2b3038', sh: '#1a1d22', bore: '#090b0e' };
const HOT = { core: '#ffffff', cell: '#e8fbff', edge: '#cfefff' };
// the blade: the shipped energy family, re-cut
const EN = { edge: '#2aa8ff', body: '#5fd2ff', glow: '#b4f2ff', core: '#ffffff' };

/** Pivots and placements the weapon layer (p1Player.js) uses. */
export const P1_WEAPONS = {
  // origin = the glove's centre on the bore axis; reach = px from the body
  // centre to that origin along the aim (the projectile still leaves at
  // PLAYER.radius + 12 = 34px, gameplay's own number, untouched).
  pistol: { key: 'p1-pistol', hot: 'p1-pistol-hot', origin: [18 / 52, 0.5], reach: 12 },
  rifle:  { key: 'p1-rifle',  hot: 'p1-rifle-hot',  origin: [26 / 72, 0.5], reach: 6 },
  blade:  { key: 'p1-blade', origin: [0.14, 0.5] },    // the shipped blade's pivot and reach
};

function grid(w, h) {
  const c = new Array(w * h).fill(null);
  const g = { w, h, c };
  g.px = (x, y, col) => { if (col && x >= 0 && y >= 0 && x < w && y < h) c[y * w + x] = col; };
  g.get = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? c[y * w + x] : null);
  g.rect = (x, y, rw, rh, col) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) g.px(x + i, y + j, col); };
  g.hl = (y, x0, x1, col) => { for (let x = x0; x <= x1; x++) g.px(x, y, col); };
  g.vl = (x, y0, y1, col) => { for (let y = y0; y <= y1; y++) g.px(x, y, col); };
  // dilate a one-pixel outline round everything painted (optionally only
  // where `only(x, y)` allows — the blade outlines its hilt, not its light)
  g.outline = (only = null) => {
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (c[y * w + x] || (only && !only(x, y))) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < w && Y < h && c[Y * w + X] && c[Y * w + X] !== OUTLINE) { add.push(y * w + x); break; }
      }
    }
    for (const i of add) c[i] = OUTLINE;
  };
  g.blit = (key, scene) => {
    const pc = new PixelCanvas(scene, key, w, h, 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (c[y * w + x]) pc.px(x, y, c[y * w + x]);
    pc.finish();
  };
  return g;
}

// The hero's grip hand: black glove over rows 6-8 at x0..x0+2, a lit knuckle
// row, and a beskar vambrace cuff trailing back toward his body.
function gripHand(g, x0, cuff = true) {
  g.rect(x0, 6, 3, 3, HB);
  g.hl(6, x0, x0 + 2, KN); g.px(x0 + 2, 7, KN);
  if (cuff) {
    g.rect(x0 - 2, 6, 2, 3, HS.mid);
    g.hl(6, x0 - 2, x0 - 1, HS.lit); g.px(x0 - 2, 6, HS.hi);
    g.hl(8, x0 - 2, x0 - 1, HS.dk);
  }
}

// ── PISTOL — compact, manufactured, held ───────────────────────────────────
// A short slab-sided blaster: stepped slide with front and rear sights, a
// shrouded barrel and a ringed emitter, a raked leather grip in his glove.
function pistol(hot) {
  const g = grid(13, 10);
  // slide (rows 3-5): lit top, mid flank, dark under-edge
  g.hl(3, 4, 8, GM.lit); g.px(5, 3, GM.hi); g.px(6, 3, GM.hi);
  g.rect(4, 4, 5, 1, GM.mid); g.hl(5, 4, 8, GM.dk);
  g.px(4, 2, GM.mid); g.px(8, 2, GM.lit);                  // rear and front sights
  // the power cell on the flank — his colour
  g.px(5, 4, hot ? HOT.core : CYAN); g.px(6, 4, hot ? HOT.cell : '#3fb4d6');
  // barrel shroud and emitter ring
  g.hl(4, 9, 10, GM.lit); g.hl(5, 9, 10, GM.dk); g.px(9, 3, GM.sh);
  g.vl(11, 3, 6, GM.mid); g.px(11, 3, GM.hi); g.px(11, 6, GM.sh);
  g.px(11, 4, GM.bore); g.px(11, 5, GM.bore);
  if (hot) { g.hl(3, 4, 8, HOT.edge); g.px(5, 3, HOT.core); }
  // trigger guard and raked grip (leather front edge shows past the glove)
  g.px(7, 6, GM.sh); g.px(8, 6, GM.dk); g.px(8, 7, GM.sh);
  g.px(6, 6, HL.lit); g.px(6, 7, HL.mid);
  gripHand(g, 3);
  g.outline();
  return g;
}

// ── RIFLE — longer, heavier, two-handed ────────────────────────────────────
// Shoulder stock, a deep receiver with a magazine hanging below, a scope with a
// cyan lens, a finned barrel and a muzzle brake; the trigger hand in a glove
// and the support hand closed on the fore-grip.
function rifle(hot) {
  const g = grid(18, 10);
  // stock: skeletal, dark, a beskar butt-plate
  g.vl(1, 3, 6, HS.mid); g.px(1, 3, HS.lit); g.px(1, 6, HS.dk);
  g.hl(3, 2, 4, GM.mid); g.hl(6, 2, 4, GM.dk); g.px(2, 4, GM.sh); g.px(2, 5, GM.sh);
  g.hl(4, 3, 4, GM.dk); g.hl(5, 3, 4, GM.sh);
  // receiver (rows 3-6, deeper than the pistol's slide)
  g.hl(3, 5, 11, GM.lit); g.px(6, 3, GM.hi); g.px(7, 3, GM.hi);
  g.rect(5, 4, 7, 2, GM.mid); g.hl(6, 5, 11, GM.dk);
  g.px(10, 4, GM.sh); g.px(10, 5, GM.sh);                   // ejection port
  // scope rail and scope, lens forward
  g.hl(2, 6, 10, GM.sh); g.hl(1, 7, 10, GM.dk); g.px(7, 1, GM.mid);
  g.px(10, 1, hot ? HOT.core : CYAN); g.px(10, 2, hot ? HOT.cell : '#3fb4d6');
  // magazine
  g.rect(9, 7, 2, 2, GM.dk); g.px(9, 7, GM.mid);
  // barrel with heat-sink fins, and a brake
  g.hl(4, 12, 15, GM.lit); g.hl(5, 12, 15, GM.dk);
  for (const x of [12, 14]) g.px(x, 3, GM.mid);
  g.vl(16, 3, 6, GM.mid); g.px(16, 3, GM.hi); g.px(16, 6, GM.sh);
  g.px(16, 4, GM.bore); g.px(16, 5, GM.bore);
  if (hot) { g.hl(3, 5, 11, HOT.edge); g.px(6, 3, HOT.core); g.hl(4, 12, 15, HOT.edge); }
  // trigger hand (no cuff: the stock sits where his forearm would)
  g.px(8, 6, HL.lit);
  gripHand(g, 5, false);
  // support hand on the fore-grip
  g.rect(12, 6, 2, 2, HB); g.hl(6, 12, 13, KN);
  g.outline();
  return g;
}

// ── BLADE — the melee weapon, deliberately wielded ─────────────────────────
// The shipped blade's canvas and pivot (so the arc and reach are unchanged),
// re-cut: his glove closed round a wrapped grip, a beskar crossguard with swept
// tips and a dark emitter collar, and a crisper energy blade — leading edge
// bright, a white core line, an even taper to the point.
function blade() {
  const g = grid(24, 10);
  // pommel and wrapped grip
  g.px(0, 4, HS.lit); g.px(0, 5, HS.dk);
  g.hl(4, 1, 4, HL.mid); g.hl(5, 1, 4, HL.mid); g.px(1, 4, HL.lit);
  // the fist
  g.rect(2, 3, 3, 4, HB); g.vl(4, 3, 6, KN); g.px(2, 3, KN);
  // crossguard: swept beskar quillons
  g.vl(5, 2, 7, HS.mid); g.px(5, 2, HS.hi); g.px(5, 3, HS.lit); g.px(5, 7, HS.dk);
  g.px(4, 1, HS.lit); g.px(4, 8, HS.dk);
  // emitter collar
  g.vl(6, 3, 6, GM.dk); g.px(6, 3, GM.lit); g.px(6, 4, EN.glow); g.px(6, 5, EN.body);
  g.outline((x) => x <= 7);
  // the blade: [x, top, bottom] — 4 rows, then 3, then 2, then the point
  const COLS = [];
  for (let x = 7; x <= 14; x++) COLS.push([x, 3, 6]);
  for (let x = 15; x <= 19; x++) COLS.push([x, 3, 5]);
  for (let x = 20; x <= 22; x++) COLS.push([x, 4, 5]);
  for (const [x, top, bot] of COLS) {
    g.vl(x, top, bot, EN.body);
    g.px(x, top, EN.glow);                 // the leading (lit) edge
    g.px(x, bot, EN.edge);                 // the trailing edge
    g.px(x, 4, EN.core);                   // white-hot core line
    if (bot >= 5 && x < 20) g.px(x, 5, EN.glow);
  }
  g.px(23, 4, EN.glow);                    // the point
  return g;
}

/** Paint every P1 texture. No-op without `?visualPilot=v2c&polish=p1`. */
export function paintPolishP1(scene) {
  if (!isPolishP1()) return;
  pistol(false).blit(P1_WEAPONS.pistol.key, scene);
  pistol(true).blit(P1_WEAPONS.pistol.hot, scene);
  rifle(false).blit(P1_WEAPONS.rifle.key, scene);
  rifle(true).blit(P1_WEAPONS.rifle.hot, scene);
  blade().blit(P1_WEAPONS.blade.key, scene);
}
