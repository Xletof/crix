// ROSTER v1 — PRODUCTION PAINTERS for the redesigned regular / elite roster.
//
// NOT in `pixelArt.js`, on purpose. That file is pinned byte-identical to the
// Shock Captain's approved baseline by `smoke-champion-placement`, and the
// legacy `grunt` / `shooter` sheets inside it keep painting exactly as before:
// swarmlings, dialogue busts and every `?roster=legacy` session still wear them.
// Nothing here replaces a legacy texture. Every key is new (`ro-*`), and the
// art is only worn under `?roster=v1` (see `src/data/rosterArt.js`).
//
// THE CONTRACT IS THE STOCK ONE. 33 frames per sheet, so `Enemy.preUpdate`'s
// default selector and `PreloadScene`'s animation loops need no new framework:
//
//   0-7   front   0 idle, 1-6 walk, 7 fire
//   8-15  back    same
//   16-23 side    same (east; west is this block mirrored by `flipX`)
//   24-32 poses   raise / thrust / recoil x front / back / side
//
// 24x26 logical at scale 4 (96x104 px). The body circle stays `cfg.radius`,
// re-centred on the bigger frame by `wearRosterArt`, so a bigger canvas moves
// only the hp bar (it rides `_headroom()`, the drawn top) — which it should.
//
// The palettes are BAKED. The legacy roster told archetypes apart with
// multiply tints, and `fx.hitFlash` clears every tint on the first hit; baked
// art has nothing for it to erase.

import { SpriteSheet, PixelCanvas } from './pixelArt.js';
import { isGaitV2 } from './debug.js';
import { ENEMY } from '../config.js';

const S = 4;                   // world px per logical px — the trooper scale
export const ROSTER_FRAME = { w: 24, h: 26 };
const OUTLINE = '#06070a';

// ── A frame is painted into a logical grid, outlined, then blitted ─────────
//
// The outline is DILATED from the finished silhouette (every empty pixel
// touching the figure), never drawn per shape. Drawn per shape it doubles up
// where pieces meet and goes missing where a limb moves — which in a walk
// cycle is every frame.
function grid(w, h) {
  const c = new Array(w * h).fill(null);
  const g = { w, h, c };
  g.px = (x, y, col) => { if (col && x >= 0 && y >= 0 && x < w && y < h) c[y * w + x] = col; };
  g.rect = (x, y, rw, rh, col) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) g.px(x + i, y + j, col); };
  g.hl = (y, x0, x1, col) => { for (let x = x0; x <= x1; x++) g.px(x, y, col); };
  g.vl = (x, y0, y1, col) => { for (let y = y0; y <= y1; y++) g.px(x, y, col); };
  // centred horizontal run of width `wd` on the 24-wide body canvas
  g.sym = (y, wd, col) => g.hl(y, 12 - wd / 2, 12 + wd / 2 - 1, col);
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

// ── GUNNER ────────────────────────────────────────────────────────────────
//
// The approved concept (roster concept round 3) is the authority: dark
// armour, a tall faceted helm, the FIRING SIDE heavier (character-right: a 4x4
// pauldron against a 3x3 one), a comms / power pack on the character-left with
// one whip antenna, green functional electronics. The elite is the same man
// better issued — second antenna, a bigger pack collar with a lit seam, a
// chest power module, steel under-plates and knee plates — never a larger
// body, never a tint, and nothing from the Captain's blue hardware language.
//
// ASYMMETRY: role gear is on the character's LEFT, firing mass on his RIGHT.
// Front view: char-left = screen RIGHT. Back view: screen LEFT. The side block
// faces east; west is that block mirrored, so in the west facing the pack and
// antenna change screen side with the body — the accepted mirror behaviour.
const GP = { lit: '#535768', mid: '#2e303a', dk: '#1b1c23', sh: '#111217', un: '#0b0b0f', vis: '#050506', glow: '#3dff6a' };
const GUN = { lit: '#6c707c', mid: '#3c3f49', dk: '#202228', bk: '#0d0e12' };
const GR = { lit: '#626876', mid: '#363942', dk: '#1d1f25' };          // graphite (pack, modules)
const ST = { lit: '#cfd4dc', mid: '#8d949f', dk: '#4f5560' };          // steel (elite under-plates)
// The pack cell on the fire frame: the shot draws on it. Green family, never
// a new colour, so it reads as the same electronics working harder.
const FLARE = '#b4ffc6';

// Per-frame channels for frames 0-7 of a facing block (0 idle, 1-6 walk, 7 fire).
//
// bob    the whole upper body (pack, antenna and helm WITH it, so nothing on
//        the back floats or lags — the antenna is rigid, it does not whip).
//        Low on the two wide-stride frames, as the legacy cycle was.
// legs   front/back: which foot is off the deck, by how many rows. The planted
//        foot never moves and NO foot ever steps below the ground row: the
//        canvas ends one row under the boot outline, and a foot pushed past it
//        is silently clipped (the Captain's first walk lost a boot that way).
//        side: near / far leg x (left edge) and lift — the legs genuinely
//        cross, the swing leg is the lifted one.
// fire   frame 7 is a BRACE, not a flash: stance widened one pixel each way
//        and held, the firing pauldron kicked up a row, the pack cell flaring.
//        No vertical body offset at all — `Enemy.preUpdate` already shrinks
//        the whole sprite for the shot (recoilT 100 -> up to 15%), and a pose
//        that also moved the body would fight that squash instead of riding it.
const BOB = [0, 0, 1, 0, 0, 1, 0, 0];
const FB = {
  liftL: [0, 1, 2, 1, 0, 0, 0, 0], liftR: [0, 0, 0, 0, 1, 2, 1, 0],
  lx:    [9, 9, 9, 9, 9, 9, 9, 8],  rx:    [13, 13, 13, 13, 13, 13, 13, 14],
};
// Side legs are 2px wide and near-black, so separation is NEGATIVE SPACE: the
// outline fills any 1-2px gap with outline black and the legs merge into one
// dark post. Every frame is therefore either 3+ columns apart (deck shows
// between them) or a true PASSING frame (the swing leg in front of the planted
// one, lifted). Contacts on 2 and 5 carry the bob.
const SIDE = {
  near: [13, 11, 14, 13, 10, 7, 8, 14], far: [8, 10, 7, 8, 11, 14, 13, 7],
  nearLift: [0, 1, 0, 0, 0, 0, 1, 0],   farLift: [0, 0, 0, 1, 1, 0, 0, 0],
};

// Attack poses (frames 24-32). Ordinary troopers rarely play them, but the
// contract has them and a scripted move must never fall back to a walk.
// arm: pauldron offset (dy rows, dx outward); lean: side-view upper body.
const POSES = {
  raise:  { bob: 0, armDy: -2, armDx: 0, lean: 0,  hand: -2 },
  thrust: { bob: 1, armDy: 0,  armDx: 1, lean: 1,  hand: 2 },
  recoil: { bob: 1, armDy: 1,  armDx: 0, lean: -1, hand: -1 },
};

function gunnerLegsFB(g, lx, rx, liftL, liftR, hipY, plate) {
  for (const [x, lift] of [[lx, liftL], [rx, liftR]]) {
    const bootY = 23 - lift, len = bootY - hipY;
    g.rect(x, hipY, 2, len, GP.un);
    if (len > 2) g.rect(x, hipY + 1, 2, len - 2, GP.dk);
    g.rect(x, bootY, 2, 2, GUN.bk);
    // a lit toe cap on the outer edge: the only light on a near-black leg, so
    // it is what tells a lifted foot from a planted one at 1x
    g.px(x < 12 ? x : x + 1, bootY, GUN.mid);
    if (plate) g.hl(hipY + 1, x, x + 1, plate.lit);
  }
}

// PROFILE LEGS: a real stride with negative space between the legs, a darker
// FAR leg and a lit NEAR knee. The hips join both legs to the body.
function gunnerLegsSide(g, nearX, farX, nearLift, farLift, hipY, plate) {
  const leg = (x, lift, col) => {
    const bootY = 23 - lift, len = bootY - hipY;
    g.rect(x, hipY, 2, len, GP.un);
    if (len > 2) g.rect(x, hipY + 1, 2, len - 2, col);
    return bootY;
  };
  const fb = leg(farX, farLift, GP.sh);
  g.rect(farX - 1, fb, 3, 2, GUN.bk);
  const nb = leg(nearX, nearLift, GP.dk);
  g.px(nearX + 1, hipY + 1, GP.mid);
  g.rect(nearX, nb, 3, 2, GUN.bk);
  g.px(nearX + 2, nb, GUN.mid);                     // near toe cap
  g.rect(9, hipY - 1, 5, 2, GP.un);
  if (plate) g.hl(hipY + 2, nearX, nearX + 1, plate.lit);
}

function gunnerFrontBack(g, dir, e, o) {
  const front = dir === 'front';
  const b = o.bob;
  const cell = o.fire ? FLARE : GP.glow;
  // PACK + ANTENNA, behind the body: shows over the char-left shoulder.
  const pxL = front ? 13 : 7;
  const ant = front ? 17 : 7;
  g.rect(pxL, 8 + b, 5, 6, GR.mid); g.hl(8 + b, pxL, pxL + 4, GR.lit); g.vl(ant, 1 + b, 7 + b, GUN.lit);
  if (e) {
    const a2 = front ? 15 : 9;
    g.vl(a2, 3 + b, 7 + b, GUN.lit); g.px(a2, 2 + b, GP.glow);
    g.rect(pxL - 1, 7 + b, 7, 2, GR.mid); g.hl(7 + b, pxL, pxL + 4, GR.lit); g.hl(9 + b, pxL, pxL + 4, cell);
  }
  if (!o.noLegs) gunnerLegsFB(g, o.lx, o.rx, o.liftL, o.liftR, 18 + b, e ? ST : null);
  // TORSO
  g.rect(6, 13 + b, 12, 5, GP.mid); g.sym(13 + b, 12, GP.lit); g.sym(17 + b, 12, GUN.dk);
  g.vl(11, 14 + b, 16 + b, GP.dk); g.vl(12, 14 + b, 16 + b, GP.dk);
  // FIRING PAULDRON (char-right): the heavy one. Off-side pauldron smaller.
  const fx = (front ? 3 : 17) + (front ? -o.armDx : o.armDx);
  const fy = 11 + b + o.armDy - (o.fire ? 1 : 0);
  g.rect(fx, fy, 4, 4, GP.mid); g.hl(fy, fx, fx + 3, GP.lit); g.hl(fy + 3, fx, fx + 3, GP.sh);
  const ox = (front ? 18 : 3) + (front ? o.armDx : -o.armDx);
  const oy = 12 + b + o.armDy;
  g.rect(ox, oy, 3, 3, GP.mid); g.hl(oy, ox, ox + 2, GP.lit);
  // HELM: tall and faceted
  g.sym(4 + b, 4, GP.lit); g.rect(9, 5 + b, 6, 6, GP.mid); g.vl(9, 6 + b, 9 + b, GP.lit);
  g.sym(5 + b, 6, GP.lit); g.sym(11 + b, 4, GP.dk);
  if (front) {
    g.rect(10, 8 + b, 4, 2, GP.vis); g.px(10, 8 + b, GP.glow); g.px(13, 8 + b, GP.glow);
  } else {
    // pack power cell on the back plate; the elite's is a lit 4-cell bar
    g.rect(9, 14 + b, 6, 3, GR.mid);
    if (e) { g.hl(15 + b, 10, 13, cell); g.px(11, 16 + b, GR.dk); g.px(12, 16 + b, GR.dk); }
    else { g.px(11, 15 + b, cell); g.px(12, 15 + b, cell); }
  }
  if (e) {
    g.rect(fx, fy + 4, 4, 1, ST.mid);                                   // steel under-plate, firing side
    if (front) { g.rect(15, 14 + b, 2, 3, GR.mid); g.px(15, 15 + b, cell); g.px(16, 15 + b, cell); }   // chest power module
    else g.rect(9, 13 + b, 6, 1, ST.mid);                               // yoke across the back plate
  }
}

function gunnerSide(g, e, o) {
  const b = o.bob, L = o.lean;
  const cell = o.fire ? FLARE : GP.glow;
  if (!o.noLegs) gunnerLegsSide(g, o.near, o.far, o.nearLift, o.farLift, 18 + b, e ? ST : null);
  // PACK + ANTENNA behind (west)
  g.rect(4 + L, 9 + b, 4, 7, GR.mid); g.hl(9 + b, 4 + L, 7 + L, GR.lit); g.vl(5 + L, 1 + b, 8 + b, GUN.lit); g.px(5 + L, 13 + b, cell);
  if (e) { g.vl(7 + L, 3 + b, 8 + b, GUN.lit); g.px(7 + L, 2 + b, GP.glow); g.hl(11 + b, 4 + L, 7 + L, cell); g.rect(4 + L, 8 + b, 4, 1, GR.mid); }
  // TORSO
  g.rect(9 + L, 12 + b, 7, 6, GP.mid); g.hl(12 + b, 9 + L, 15 + L, GP.lit); g.hl(17 + b, 9 + L, 15 + L, GUN.dk);
  // HEAVY FIRING SHOULDER (the near side). On the fire frame it rides back a
  // pixel and the hand comes in with it: the shot is absorbed by the shoulder.
  const sx = 10 + L - (o.fire ? 1 : 0), sy = 11 + b + o.armDy;
  g.rect(sx, sy, 5, 4, GP.lit); g.rect(sx, sy + 1, 5, 3, GP.mid); g.hl(sy + 3, sx, sx + 4, GP.sh);
  g.rect(14 + L + o.hand - (o.fire ? 1 : 0), 15 + b + Math.min(0, o.armDy), 3, 1, GP.mid);
  // HELM
  g.rect(10 + L, 4 + b, 5, 7, GP.mid); g.hl(4 + b, 11 + L, 13 + L, GP.lit); g.vl(10 + L, 5 + b, 9 + b, GP.lit);
  g.rect(14 + L, 7 + b, 2, 2, GP.vis); g.px(15 + L, 7 + b, GP.glow);
  if (e) g.rect(sx, sy + 4, 5, 1, ST.mid);
}

function gunnerFrame(dir, e, k, pose) {
  const g = grid(ROSTER_FRAME.w, ROSTER_FRAME.h);
  const P = pose ? POSES[pose] : null;
  const fire = !pose && k === 7;
  const o = {
    bob: P ? P.bob : BOB[k], fire,
    armDy: P ? P.armDy : 0, armDx: P ? P.armDx : 0, lean: P ? P.lean : 0, hand: P ? P.hand : 0,
    // poses plant a wide stance, the same base the fire brace uses
    lx: P ? 8 : FB.lx[k], rx: P ? 14 : FB.rx[k], liftL: P ? 0 : FB.liftL[k], liftR: P ? 0 : FB.liftR[k],
    near: P ? 14 : SIDE.near[k], far: P ? 7 : SIDE.far[k],
    nearLift: P ? 0 : SIDE.nearLift[k], farLift: P ? 0 : SIDE.farLift[k],
  };
  if (dir === 'side') gunnerSide(g, e, o); else gunnerFrontBack(g, dir, e, o);
  g.outline();
  return g;
}

function paintGunnerSheet(scene, key, elite) {
  const ss = new SpriteSheet(scene, key, ROSTER_FRAME.w, ROSTER_FRAME.h, 33, S);
  ['front', 'back', 'side'].forEach((dir, di) => {
    for (let k = 0; k < 8; k++) gunnerFrame(dir, elite, k, null).blit(ss.frame(di * 8 + k));
    ['raise', 'thrust', 'recoil'].forEach((pose, pi) => gunnerFrame(dir, elite, 0, pose).blit(ss.frame(24 + di * 3 + pi)));
  });
  ss.finish();
}

// ── GUNNER WEAPON — the heavy sustained-fire blaster ──────────────────────
//
// East-facing like every overlay. A substantial receiver with a lit top
// plane, a power drum hung under it, a collar and a stub barrel, and the green
// power indicator. The elite carries the same gun better issued: a top rail,
// a lit drum seam, a steel coupling and a longer compensated barrel.
//
// THE MUZZLE IS PLACED BY THE GAMEPLAY SPAWN POINT, NOT THE OTHER WAY ROUND.
// `Enemy.preUpdate` (frozen) puts the overlay's origin at `cfg.radius - 4`
// along the aim, and `fireShooter` (gameplay, frozen) spawns the bolt at
// `cfg.radius + 4` — eight pixels further out, whatever the radius. The bolt
// is a 60px streak stretched by `bulletSpeed / 620` (700 -> 1.129, so 67.7px)
// centred on that point, and it is drawn at the flat bullet depth 26, UNDER
// the whole Y-sorted actor band — so the gun and the body hide whatever part
// of it lies over them. The physics step runs before the first render, so the
// first frame a bolt is ever DRAWN on a 60fps phone puts its centre 700/60 =
// 11.7px past the spawn point and its leading edge at
// `8 + 11.7 + 33.9 = 53.6px` past the origin. The drawn muzzle (the outer edge
// of the gun's silhouette) is put THERE, at 54: the first pixel of bolt anyone
// can see is at the muzzle, the spawn point itself is inside the barrel on its
// axis (origin y is the barrel row, which a west-facing `flipY` mirrors
// about), and the round visibly leaves the gun on the next frame.
//
// It is also what keeps the face clear. Aimed at the camera the overlay runs
// down the body's centreline, and a gun reaching further back than 12px behind
// the origin would sit on the visor — the one feature that identifies a
// trooper at a glance.
//
// That 54 does not depend on the radius, which is what makes the ELITE work:
// its gameplay radius is 30 against 22, so its origin sits 8px further out.
// Its gun is 8px longer — the compensated barrel — and its origin moves by
// exactly that, so the receiver and drum sit on the same place on the body as
// the regular's while the muzzle keeps the same relationship to the bolt.
export const GUNNER_MUZZLE_PAST_PIVOT = 54;
// The art is drawn inside a one-pixel margin so the dilated outline is never
// clipped by the canvas: the butt plate, the rail and the muzzle all keep their
// rim. The DRAWN MUZZLE is the outer edge of that rim, the canvas's right edge.
const W_H = 8, W_BARREL_ROW = 3, W_PAD = 1;

function gunnerWeaponGrid(elite) {
  const len = elite ? 21 : 19;
  const g = grid(len + W_PAD * 2, W_H + W_PAD * 2);
  const w = {                                    // the same calls, one pixel in
    rect: (x, y, rw, rh, c) => g.rect(x + W_PAD, y + W_PAD, rw, rh, c),
    hl: (y, x0, x1, c) => g.hl(y + W_PAD, x0 + W_PAD, x1 + W_PAD, c),
    vl: (x, y0, y1, c) => g.vl(x + W_PAD, y0 + W_PAD, y1 + W_PAD, c),
    px: (x, y, c) => g.px(x + W_PAD, y + W_PAD, c),
  };
  w.rect(0, 2, 2, 3, GUN.dk);                    // butt plate
  w.rect(2, 2, 13, 3, GUN.mid);                  // receiver
  w.hl(2, 2, 14, GUN.lit);                       // lit top plane
  w.rect(4, 5, 5, 3, GUN.dk);                    // power drum under the receiver
  w.hl(5, 4, 8, GUN.mid);
  w.rect(15, 2, 2, 3, GUN.dk);                   // collar
  w.px(10, 3, GP.glow); w.px(11, 3, GP.glow);    // power indicator
  if (!elite) {
    w.rect(17, 3, 2, 1, GUN.dk);                 // stub barrel
    w.px(18, 3, GUN.lit);                        // muzzle lip
  } else {
    w.rect(8, 0, 6, 2, GUN.mid); w.hl(0, 8, 13, GUN.lit);   // top rail
    w.rect(5, 5, 3, 1, GP.glow);                 // lit drum seam
    w.rect(15, 1, 2, 5, GR.mid); w.vl(15, 1, 5, ST.mid);    // steel coupling, taller than the collar it replaces
    w.rect(17, 3, 2, 1, GUN.dk);                 // barrel
    w.rect(19, 2, 2, 3, GUN.mid); w.hl(2, 19, 20, GUN.lit); // compensator
    w.px(20, 3, GUN.lit);                        // muzzle lip
  }
  g.outline();
  return g;
}

function paintGunnerWeapon(scene, key, elite) {
  const w = gunnerWeaponGrid(elite);
  const c = new PixelCanvas(scene, key, w.w, w.h, S);
  w.blit(c);
  c.finish();
  // origin: the drawn tip (the canvas's right edge) sits
  // GUNNER_MUZZLE_PAST_PIVOT past the pivot; the barrel row is the pivot line
  return [1 - GUNNER_MUZZLE_PAST_PIVOT / (w.w * S), (W_BARREL_ROW + W_PAD + 0.5) / w.h];
}

/**
 * Paint the Gunner's production sheets and weapons. Returns the roster-art
 * entry `rosterArt.js` registers for the `shooter` archetype.
 */
export function paintRosterGunner(scene) {
  if (isGaitV2()) { paintGaitV2Sheet(scene, 'ro-gun-R', false, 'gunner'); paintGaitV2Sheet(scene, 'ro-gun-E', true, 'gunner'); }
  else { paintGunnerSheet(scene, 'ro-gun-R', false); paintGunnerSheet(scene, 'ro-gun-E', true); }
  const oR = paintGunnerWeapon(scene, 'ro-w-gun-R', false);
  const oE = paintGunnerWeapon(scene, 'ro-w-gun-E', true);
  return {
    regular: { tex: 'ro-gun-R', prefix: 'ro-gun-R', weapon: 'ro-w-gun-R', weaponOrigin: oR, muzzleFx: true, weaponFx: true },
    elite:   { tex: 'ro-gun-E', prefix: 'ro-gun-E', weapon: 'ro-w-gun-E', weaponOrigin: oE, muzzleFx: true, weaponFx: true },
  };
}

// ════════════════════════════════════════════════════════════════════════
// PHASE 2B — RIFLEMAN (`grunt`) and MARKSMAN (`sniper`)
// ════════════════════════════════════════════════════════════════════════
//
// Same contract, same channel tables (BOB / FB / SIDE / POSES) as the Gunner,
// so the three roles walk on one rhythm. Each role owns its body and weapon
// painters; nothing above is touched.

// THE MUZZLE OF EVERY ROLE IS WHERE ITS BOLT FIRST APPEARS. Gameplay spawns
// every stock bolt `cfg.radius + 4` along the aim (8px past the overlay's
// pivot, any radius), as a 60px streak stretched by clamp(speed/620, 1, 2.2)
// and centred on its position; the first frame anyone SEES it has already
// moved speed/60. So the bolt's leading edge on its first drawn frame is
//   8 + speed/60 + 30 * clamp(speed/620, 1, 2.2)   past the pivot,
// and the drawn muzzle goes there. The gameplay speeds then ORDER THE GUNS
// with no art decision at all: Rifleman 620 -> 48, Gunner 700 -> 54,
// Marksman 1000 -> 73. The shortest weapon belongs to the baseline role and
// the longest to the precision role because the bolts say so.
export const muzzlePastPivot = (speed) => 8 + speed / 60 + 30 * Math.min(2.2, Math.max(1, speed / 620));
export const RIFLE_MUZZLE_PAST_PIVOT = Math.round(muzzlePastPivot(620));      // 48
export const MARKSMAN_MUZZLE_PAST_PIVOT = Math.round(muzzlePastPivot(1000));  // 73

const RB = '#0b0c10';                                                    // boots, visor black

// A padded weapon grid: the art is drawn one pixel in so the outline is
// never clipped; the drawn muzzle is the canvas's right edge.
function weaponGrid(len, h) {
  const g = grid(len + 2, h + 2);
  return {
    g,
    rect: (x, y, rw, rh, c) => g.rect(x + 1, y + 1, rw, rh, c),
    hl: (y, x0, x1, c) => g.hl(y + 1, x0 + 1, x1 + 1, c),
    vl: (x, y0, y1, c) => g.vl(x + 1, y0 + 1, y1 + 1, c),
    px: (x, y, c) => g.px(x + 1, y + 1, c),
  };
}
function paintWeaponGrid(scene, key, w, muzzle, barrelRow) {
  w.g.outline();
  const c = new PixelCanvas(scene, key, w.g.w, w.g.h, S);
  w.g.blit(c);
  c.finish();
  return [1 - muzzle / (w.g.w * S), (barrelRow + 1 + 0.5) / w.g.h];
}

function rosterFrameOpts(k, pose) {
  const P = pose ? POSES[pose] : null;
  return {
    bob: P ? P.bob : BOB[k], fire: !pose && k === 7,
    armDy: P ? P.armDy : 0, armDx: P ? P.armDx : 0, lean: P ? P.lean : 0, hand: P ? P.hand : 0,
    lx: P ? 8 : FB.lx[k], rx: P ? 14 : FB.rx[k], liftL: P ? 0 : FB.liftL[k], liftR: P ? 0 : FB.liftR[k],
    near: P ? 14 : SIDE.near[k], far: P ? 7 : SIDE.far[k],
    nearLift: P ? 0 : SIDE.nearLift[k], farLift: P ? 0 : SIDE.farLift[k],
  };
}
function paintRoleSheet(scene, key, elite, frameFn) {
  const ss = new SpriteSheet(scene, key, ROSTER_FRAME.w, ROSTER_FRAME.h, 33, S);
  ['front', 'back', 'side'].forEach((dir, di) => {
    for (let k = 0; k < 8; k++) frameFn(dir, elite, rosterFrameOpts(k, null)).blit(ss.frame(di * 8 + k));
    ['raise', 'thrust', 'recoil'].forEach((pose, pi) => frameFn(dir, elite, rosterFrameOpts(0, pose)).blit(ss.frame(24 + di * 3 + pi)));
  });
  ss.finish();
}

// ── RIFLEMAN ──────────────────────────────────────────────────────────────
//
// The baseline infantryman: COMPACT (10-wide torso against the Gunner's 12),
// white standard-issue plate over a dark undersuit, modest equal shoulders, a
// rounded restrained helmet with a T visor and no glow. He is the plainest
// thing in the roster on purpose — every other role reads by difference from
// him. White legs are separated by the outline itself: the 2px gap between
// them fills with outline black, which on WHITE legs is negative space.
//
// The ELITE is the same man better equipped, in GRAPHITE: chest webbing
// (two straps and a pouch row), a compact radio on the char-left shoulder
// with an amber tell-tale, forearm guards and a helmet-side sensor. Same
// body, same width, no tint, nothing from the Captain's blue.
const RW = { lit: '#f2f3f7', mid: '#cdd0d9', dk: '#9196a3', sh: '#646977' };
const RU = { lit: '#3a3d47', mid: '#24262d', dk: '#16171c' };
const RK = { lit: '#626774', mid: '#3a3d47', dk: '#23252c', led: '#ffb347' };

function riflemanLegsFB(g, o, hipY) {
  for (const [x, lift] of [[o.lx, o.liftL], [o.rx, o.liftR]]) {
    const bootY = 23 - lift, len = bootY - hipY;
    g.rect(x, hipY, 2, len, RW.dk);
    if (len > 2) g.vl(x < 12 ? x : x + 1, hipY + 1, bootY - 1, RW.mid);   // lit outer shin
    g.px(x < 12 ? x + 1 : x, hipY + 2, RU.mid);                           // knee joint
    g.rect(x, bootY, 2, 2, RB);
    g.px(x < 12 ? x : x + 1, bootY, RU.lit);                              // toe cap
  }
}
function riflemanLegsSide(g, o, hipY) {
  const leg = (x, lift, col) => {
    const bootY = 23 - lift;
    g.rect(x, hipY, 2, bootY - hipY, col);
    return bootY;
  };
  const fb = leg(o.far, o.farLift, RW.sh);
  g.rect(o.far - 1, fb, 3, 2, RB);
  const nb = leg(o.near, o.nearLift, RW.dk);
  g.vl(o.near + 1, hipY + 1, nb - 1, RW.mid);
  g.px(o.near, hipY + 2, RU.mid);
  g.rect(o.near, nb, 3, 2, RB); g.px(o.near + 2, nb, RU.lit);
  g.rect(9, hipY - 1, 5, 2, RU.mid);
}

function riflemanFrontBack(g, dir, e, o) {
  const front = dir === 'front', b = o.bob;
  // char-left (radio side) is screen RIGHT in front view, screen LEFT in back
  if (e && !front) {                                              // radio pack on the back, antenna up the char-left
    g.vl(8, 6 + b, 11 + b, RK.lit); g.px(8, 5 + b, RK.led);
  }
  if (!o.noLegs) riflemanLegsFB(g, o, 18 + b);
  // TORSO — compact
  g.rect(7, 13 + b, 10, 5, RW.mid); g.sym(13 + b, 10, RW.lit); g.sym(17 + b, 10, RW.sh);
  if (front) { g.hl(16 + b, 9, 14, RU.mid); g.px(11, 17 + b, RU.lit); g.px(12, 17 + b, RU.lit); g.hl(14 + b, 10, 13, RW.lit); }
  else { g.vl(11, 14 + b, 16 + b, RW.dk); g.vl(12, 14 + b, 16 + b, RW.dk); }
  // SHOULDERS — modest and equal; the arm hangs under each
  const ad = o.armDx, fy = 12 + b + o.armDy - (o.fire ? 1 : 0);
  const fx = front ? 5 - ad : 17 + ad, ox = front ? 17 + ad : 5 - ad;
  for (const [x, y] of [[fx, fy], [ox, 12 + b + o.armDy]]) {
    g.rect(x, y, 2, 3, RW.mid); g.px(x, y, RW.lit); g.px(x + 1, y, RW.lit);
    g.rect(x, y + 3, 2, 2, e ? RK.mid : RU.mid);                         // forearm (elite: guard)
    g.rect(x, y + 5, 2, 1, RB);                                          // glove
  }
  // HELMET — rounded, restrained
  g.sym(4 + b, 4, RW.lit); g.rect(9, 5 + b, 6, 6, RW.mid); g.sym(5 + b, 6, RW.lit);
  g.vl(9, 6 + b, 10 + b, RW.dk); g.vl(14, 6 + b, 10 + b, RW.dk);
  g.sym(11 + b, 4, RU.mid);                                             // neck seal
  if (front) {
    g.hl(8 + b, 10, 13, RB); g.hl(9 + b, 11, 12, RB);                    // T visor
    g.hl(10 + b, 11, 12, RW.dk);                                         // breath grille
  } else {
    g.hl(9 + b, 10, 13, RW.dk);                                          // rear rim
  }
  if (e) {
    if (front) {
      g.vl(9, 13 + b, 16 + b, RK.mid); g.vl(14, 13 + b, 16 + b, RK.mid);   // webbing straps
      g.hl(15 + b, 9, 14, RK.mid); g.px(10, 15 + b, RK.lit); g.px(12, 15 + b, RK.lit);   // pouch row
      g.rect(17 + ad, 10 + b + o.armDy, 2, 2, RK.mid); g.px(18 + ad, 10 + b + o.armDy, RK.led);   // radio
      g.px(15, 7 + b, RK.lit); g.px(15, 8 + b, RK.mid);                   // helmet-side sensor
    } else {
      g.rect(9, 13 + b, 6, 3, RK.mid); g.hl(13 + b, 9, 14, RK.lit); g.px(10, 14 + b, RK.led);   // radio pack
      g.px(8, 7 + b, RK.lit); g.px(8, 8 + b, RK.mid);                     // sensor (other side, turned)
    }
  }
}

function riflemanSide(g, e, o) {
  const b = o.bob, L = o.lean;
  if (e) { g.vl(8 + L, 6 + b, 11 + b, RK.lit); g.px(8 + L, 5 + b, RK.led); }
  if (!o.noLegs) riflemanLegsSide(g, o, 18 + b);
  // small belt pouch behind (regular) / radio (elite)
  if (e) { g.rect(7 + L, 11 + b, 2, 4, RK.mid); g.px(7 + L, 11 + b, RK.lit); }
  else g.rect(8 + L, 15 + b, 1, 2, RU.mid);
  // TORSO
  g.rect(9 + L, 12 + b, 6, 6, RW.mid); g.hl(12 + b, 9 + L, 14 + L, RW.lit); g.hl(17 + b, 9 + L, 14 + L, RW.sh);
  g.hl(16 + b, 10 + L, 13 + L, RU.mid);
  if (e) { g.rect(13 + L, 13 + b, 2, 3, RK.mid); g.px(13 + L, 14 + b, RK.lit); }   // chest rig front
  // SHOULDER + ARM, forward to the carbine
  const sx = 9 + L - (o.fire ? 1 : 0), sy = 11 + b + o.armDy;
  g.rect(sx, sy, 5, 3, RW.mid); g.hl(sy, sx, sx + 4, RW.lit); g.hl(sy + 2, sx, sx + 4, RW.sh);
  g.rect(13 + L + o.hand - (o.fire ? 1 : 0), 15 + b + Math.min(0, o.armDy), 3, 1, e ? RK.mid : RU.mid);
  // HELMET — the visor block and brow are what make the profile a face
  g.rect(10 + L, 4 + b, 5, 7, RW.mid); g.hl(4 + b, 11 + L, 13 + L, RW.lit); g.vl(10 + L, 5 + b, 9 + b, RW.dk);
  g.hl(6 + b, 12 + L, 15 + L, RW.lit);                                  // brow, standing proud
  g.rect(13 + L, 7 + b, 2, 2, RB); g.px(15 + L, 7 + b, RB);              // visor block
  g.px(14 + L, 9 + b, RW.dk); g.px(14 + L, 10 + b, RW.dk);               // jaw / grille
  g.hl(11 + b, 11 + L, 13 + L, RU.dk);
  if (e) { g.px(11 + L, 7 + b, RK.lit); g.px(11 + L, 8 + b, RK.mid); }
}

function riflemanFrame(dir, e, o) {
  const g = grid(ROSTER_FRAME.w, ROSTER_FRAME.h);
  if (dir === 'side') riflemanSide(g, e, o); else riflemanFrontBack(g, dir, e, o);
  g.outline();
  return g;
}

// THE CARBINE — the shortest, plainest firearm in the roster. Dark gunmetal
// against the white body (so it never merges into the torso), a short
// receiver, a magazine, a handguard and a stub barrel, and a restrained optic.
// No power housing and no glow. The elite adds a rail, a better optic, an
// underbarrel module and a flash hider — still compact. Elite canvas is two
// gun pixels longer at the FRONT: its pivot sits 8px further out (radius 30
// against 22), so the stock lands on the same place on the body.
const CB = { lit: '#6a6e7a', mid: '#3a3d47', dk: '#1d1f25', lens: '#8ab4c8' };
export const CARBINE = { h: 6, barrelRow: 2, lens: [6, 0] };     // content coords (before the pad)
function paintCarbine(scene, key, elite) {
  const w = weaponGrid(elite ? 17 : 15, CARBINE.h);
  w.rect(0, 2, 2, 2, CB.dk);                     // stock
  w.rect(2, 1, 7, 3, CB.mid); w.hl(1, 2, 8, CB.lit);   // receiver
  w.rect(5, 4, 2, 2, CB.dk);                     // magazine
  w.px(3, 4, CB.dk);                             // grip
  w.rect(9, 2, 3, 2, CB.mid); w.hl(2, 9, 11, CB.lit);  // handguard
  if (!elite) {
    w.rect(4, 0, 3, 1, CB.dk); w.px(6, 0, CB.lens);      // restrained optic
    w.rect(12, 2, 3, 1, CB.dk); w.px(14, 2, CB.lit);     // barrel + lip
  } else {
    w.hl(0, 2, 10, CB.dk);                               // rail
    w.rect(4, 0, 4, 1, CB.mid); w.px(7, 0, CB.lens); w.px(4, 0, CB.lit);   // better optic
    w.rect(9, 4, 3, 1, CB.dk);                           // underbarrel module
    w.rect(12, 2, 3, 1, CB.dk);
    w.rect(15, 1, 2, 3, CB.mid); w.px(16, 2, CB.lit);    // flash hider
  }
  return paintWeaponGrid(scene, key, w, RIFLE_MUZZLE_PAST_PIVOT, CARBINE.barrelRow);
}

// ── MARKSMAN ──────────────────────────────────────────────────────────────
//
// The LEANEST body in the roster: an 8-wide chest, one-pixel tucked shoulders,
// a visible neck, a narrow head and LONG legs (hips at row 16, two rows higher
// than the Gunner's or the Rifleman's). Violet/plum plate baked in, a split
// coat-tail behind the legs in profile, and the role's tell: an
// OFF-CENTRE magenta optic on the char-right of the visor with its housing
// standing proud of the head. The elite is a more advanced precision
// specialist, not a heavier one: a rangefinder MAST on the helmet with its own
// lens, a second sensor, and steel on the optic housing. No width is added
// anywhere.
const MK = { lit: '#9a7cbc', mid: '#664a86', dk: '#42305c', sh: '#2a1f3c' };
const MU = { lit: '#3a3446', mid: '#221e2b', dk: '#141218' };
const MO = { lens: '#ff4fd8', hot: '#ffc4f2', steel: '#b8bdc8', gr: '#4a4d58' };
const MHIP = 16;

function marksmanLegsFB(g, o, hipY) {
  for (const [x, lift] of [[o.lx, o.liftL], [o.rx, o.liftR]]) {
    const bootY = 23 - lift, len = bootY - hipY;
    g.rect(x, hipY, 2, len, MK.dk);
    g.px(x < 12 ? x : x + 1, hipY + 3, MK.mid);                           // knee
    g.rect(x, bootY, 2, 2, RB); g.px(x < 12 ? x : x + 1, bootY, MU.lit);
  }
}
function marksmanLegsSide(g, o, hipY) {
  const leg = (x, lift, col) => { const bootY = 23 - lift; g.rect(x, hipY, 2, bootY - hipY, col); return bootY; };
  const fb = leg(o.far, o.farLift, MK.sh);
  g.rect(o.far - 1, fb, 3, 2, RB);
  const nb = leg(o.near, o.nearLift, MK.dk);
  g.px(o.near + 1, hipY + 3, MK.mid);
  g.rect(o.near, nb, 3, 2, RB); g.px(o.near + 2, nb, MU.lit);
  g.rect(10, hipY - 1, 4, 2, MU.mid);
}

function marksmanFrontBack(g, dir, e, o) {
  const front = dir === 'front', b = o.bob;
  // (no coat-tail in front/back: one pixel beside each leg merged with the
  // legs into a wide lower body — the width this role must never gain. It
  // lives in the profile only, behind the legs.)
  if (!o.noLegs) marksmanLegsFB(g, o, MHIP + b);
  // TORSO — a 6-wide chest tapering to a 4-wide waist: lean, never a slab
  g.rect(9, 12 + b, 6, 3, MK.mid); g.sym(12 + b, 6, MK.lit);
  g.sym(15 + b, 4, MU.mid);
  if (front) { g.vl(11, 13 + b, 14 + b, MK.dk); }
  else g.vl(12, 13 + b, 14 + b, MK.dk);
  // arms TUCKED against the chest, one pixel each, ending in a dark glove
  const ad = o.armDx;
  for (const [x, y] of [[(front ? 8 - ad : 15 + ad), 12 + b + o.armDy - (o.fire ? 1 : 0)], [(front ? 15 + ad : 8 - ad), 12 + b + o.armDy]]) {
    g.px(x, y, MK.lit); g.vl(x, y + 1, y + 2, MK.dk); g.px(x, y + 3, RB);
  }
  // NECK, visible
  g.hl(11 + b, 11, 12, MU.mid);
  // HEAD — narrow
  g.hl(4 + b, 11, 12, MK.lit); g.rect(10, 5 + b, 4, 6, MK.mid); g.hl(5 + b, 10, 13, MK.lit);
  g.vl(10, 6 + b, 9 + b, MK.dk);
  if (front) {
    g.hl(7 + b, 10, 13, RB); g.hl(8 + b, 11, 12, RB);
    // OFF-CENTRE OPTIC: char-right = screen LEFT, housing proud of the head
    g.vl(9, 6 + b, 8 + b, e ? MO.steel : MO.gr); g.px(10, 7 + b, MO.lens);
    if (e) { g.px(13, 7 + b, MK.lit); }                                   // second sensor
  } else {
    g.hl(9 + b, 10, 13, MK.dk);
    g.vl(14, 6 + b, 8 + b, e ? MO.steel : MO.gr);                         // optic housing seen from behind
  }
  if (e) {                                                               // rangefinder mast, char-left
    const mx = front ? 13 : 10;
    g.vl(mx, 2 + b, 3 + b, MO.gr); g.px(mx, 1 + b, MO.lens);          // row 0 stays free for the outline
  }
}

function marksmanSide(g, e, o) {
  const b = o.bob, L = o.lean;
  // coat-tail behind; under gait v2 it stops at the hip so it can never read
  // as a third leg beside the articulated pair
  g.vl(9 + L, MHIP + b, MHIP + (o.noLegs ? 1 : 3) + b, MK.sh);
  if (!o.noLegs) marksmanLegsSide(g, o, MHIP + b);
  // TORSO — narrow
  g.rect(10 + L, 12 + b, 5, 4, MK.mid); g.hl(12 + b, 10 + L, 14 + L, MK.lit); g.hl(15 + b, 10 + L, 14 + L, MU.mid);
  // tucked shoulder, thin forearm out to the rifle
  const sx = 11 + L - (o.fire ? 1 : 0), sy = 12 + b + o.armDy;
  g.rect(sx, sy, 3, 2, MK.lit); g.hl(sy + 1, sx, sx + 2, MK.dk);
  g.rect(13 + L + o.hand, 14 + b + Math.min(0, o.armDy), 3, 1, MU.mid);
  g.hl(11 + b, 11 + L, 12 + L, MU.mid);                                   // neck
  // HEAD
  g.rect(10 + L, 5 + b, 4, 6, MK.mid); g.hl(4 + b, 11 + L, 12 + L, MK.lit); g.vl(10 + L, 6 + b, 9 + b, MK.dk);
  g.px(13 + L, 7 + b, RB); g.px(13 + L, 8 + b, RB);
  // the optic: forward of the face, lens at the front
  g.rect(14 + L, 6 + b, 1, 3, e ? MO.steel : MO.gr); g.px(15 + L, 7 + b, MO.lens);
  if (e) { g.vl(11 + L, 2 + b, 3 + b, MO.gr); g.px(11 + L, 1 + b, MO.lens); g.px(12 + L, 6 + b, MK.lit); }
}

function marksmanFrame(dir, e, o) {
  const g = grid(ROSTER_FRAME.w, ROSTER_FRAME.h);
  if (dir === 'side') marksmanSide(g, e, o); else marksmanFrontBack(g, dir, e, o);
  g.outline();
  return g;
}

// THE PRECISION RIFLE — the longest weapon in the ordinary roster, and thin:
// a stock with a lit cheek rest, a slim receiver, a long scope with a magenta
// lens, and ONE ROW of barrel running to a muzzle 73px past the pivot (the
// bolt's own first-frame leading edge, see `muzzlePastPivot`). Lighter
// graphite than the plum body so the two never merge. The elite adds a
// rangefinder pod on the scope, a folded bipod and a muzzle brake.
const MW = { lit: '#7a7f8c', mid: '#4a4d58', dk: '#24262d', acc: '#8a5cc0' };
export const PRECISION = { h: 5, barrelRow: 2, lens: [10, 0] };
function paintPrecisionRifle(scene, key, elite) {
  const w = weaponGrid(elite ? 25 : 23, PRECISION.h);
  w.rect(0, 1, 3, 3, MW.mid); w.hl(1, 0, 2, MW.lit); w.px(0, 3, MW.dk);   // stock + cheek rest
  w.rect(3, 2, 2, 2, MW.dk);                                            // wrist
  w.rect(5, 1, 6, 3, MW.mid); w.hl(1, 5, 10, MW.lit); w.px(5, 2, MW.acc); // receiver + role accent
  w.px(8, 4, MW.dk);                                                    // magazine
  w.rect(5, 0, 6, 1, MW.dk); w.px(10, 0, MO.lens); w.px(5, 0, MW.lit);  // scope
  w.hl(2, 11, 21, MW.dk); w.hl(1, 11, 13, MW.mid);                      // long barrel, shroud at the root
  w.px(22, 2, MW.lit);                                                  // muzzle
  if (elite) {
    w.rect(8, 0, 2, 1, MW.lit); w.px(9, 0, MO.hot);                     // rangefinder pod
    w.hl(3, 13, 17, MW.dk);                                             // folded bipod
    w.rect(23, 1, 2, 3, MW.mid); w.px(24, 2, MW.lit);                   // muzzle brake
  }
  return paintWeaponGrid(scene, key, w, MARKSMAN_MUZZLE_PAST_PIVOT, PRECISION.barrelRow);
}

/** Rifleman production art. Registered for `grunt` by PreloadScene. */
export function paintRosterRifleman(scene) {
  if (isGaitV2()) { paintGaitV2Sheet(scene, 'ro-rif-R', false, 'rifleman'); paintGaitV2Sheet(scene, 'ro-rif-E', true, 'rifleman'); }
  else { paintRoleSheet(scene, 'ro-rif-R', false, riflemanFrame); paintRoleSheet(scene, 'ro-rif-E', true, riflemanFrame); }
  const oR = paintCarbine(scene, 'ro-w-rif-R', false);
  const oE = paintCarbine(scene, 'ro-w-rif-E', true);
  return {
    regular: { tex: 'ro-rif-R', prefix: 'ro-rif-R', weapon: 'ro-w-rif-R', weaponOrigin: oR, fx: 'rifle' },
    elite:   { tex: 'ro-rif-E', prefix: 'ro-rif-E', weapon: 'ro-w-rif-E', weaponOrigin: oE, fx: 'rifle' },
  };
}

/** Marksman production art. Registered for `sniper` by PreloadScene. */
export function paintRosterMarksman(scene) {
  if (isGaitV2()) { paintGaitV2Sheet(scene, 'ro-mrk-R', false, 'marksman'); paintGaitV2Sheet(scene, 'ro-mrk-E', true, 'marksman'); }
  else { paintRoleSheet(scene, 'ro-mrk-R', false, marksmanFrame); paintRoleSheet(scene, 'ro-mrk-E', true, marksmanFrame); }
  const oR = paintPrecisionRifle(scene, 'ro-w-mrk-R', false);
  const oE = paintPrecisionRifle(scene, 'ro-w-mrk-E', true);
  return {
    regular: { tex: 'ro-mrk-R', prefix: 'ro-mrk-R', weapon: 'ro-w-mrk-R', weaponOrigin: oR, fx: 'marksman' },
    elite:   { tex: 'ro-mrk-E', prefix: 'ro-mrk-E', weapon: 'ro-w-mrk-E', weaponOrigin: oE, fx: 'marksman' },
  };
}

// ════════════════════════════════════════════════════════════════════════
// GAIT v2 (`?gait=v2`) — THE PELVIS OWNS BOTH LEGS
// ════════════════════════════════════════════════════════════════════════
//
// The shipped cycle separated the legs by moving WHOLE LEG COLUMNS: in profile
// the near and far hip roots sat up to 7 logical px apart (near 14 / far 7),
// so the rear leg was a second post planted behind the pelvis — "a tail".
// Both profile boots were 3px wide, but the far one extended WEST and the near
// one EAST, so the feet pointed opposite ways; front/back toe caps sat on each
// boot's OUTER edge, which is duck feet. And the torso bobbed over legs that
// telescoped rather than bent.
//
// v2 builds every leg from ONE pelvis: a fixed hip socket, a knee, an ankle,
// a boot. Separation is articulation and occlusion, not relocation. In
// profile both boots point EAST (the west facing is this mirrored, so both
// point west); the far leg is darker and is allowed to disappear behind the
// near one. Front/back toes face the viewer's axis on BOTH boots. The upper
// body carries a 1px weight shift toward the planted leg and a 1px settle on
// the load frames, nothing more.
//
// Frames: the stock 33 keep their indices (idle / walk 1-6 / fire per facing,
// poses 24-32), and 18 STRAFE frames follow (33-38 front, 39-44 back, 45-50
// side). The walk/strafe frame on screen is chosen by `systems/rosterGait.js`
// from REAL displacement, after the base class has picked its animation.
export const GAIT_STRAFE_BASE = 33;
export const GAIT_FRAMES = 51;
// exported for the structural guards in smoke-gait-v2 (read-only)

// role legs: hip row, palette, and the boot
const GAIT_ROLE = {
  gunner:   { hip: 18, near: GP.mid, far: GP.dk, root: GP.un, knee: GP.lit, boot: GUN.bk, toe: GUN.mid },
  rifleman: { hip: 18, near: RW.dk, far: RW.sh, root: RU.mid, knee: RW.mid, boot: RB, toe: RU.lit },
  marksman: { hip: 16, near: MK.dk, far: MK.sh, root: MU.mid, knee: MK.mid, boot: RB, toe: MU.lit },
};

// FRONT / BACK. Hip sockets never move: screen-left leg at x 9, right at 13.
// Each leg: { fx: foot x offset, st: 'F' flat | 'H' heel-up / trailing | 'S'
// swinging (lifted, knee bent toward the midline) }. `dx` shifts the upper
// body (weight over the planted leg), `bob` settles it one row on a load.
//   1 contact A   2 load A   3 pass B   4 contact B   5 load B   6 pass A
export const FB2 = {
  idle: { L: { fx: 0, st: 'F' }, R: { fx: 0, st: 'F' }, dx: 0, bob: 0 },
  walk: [
    { L: { fx: 0, st: 'F' }, R: { fx: 0, st: 'H' }, dx: 0, bob: 0 },
    { L: { fx: 0, st: 'F' }, R: { fx: 0, st: 'S' }, dx: -1, bob: 1 },
    { L: { fx: 0, st: 'F' }, R: { fx: 0, st: 'H' }, dx: -1, bob: 0 },
    { L: { fx: 0, st: 'H' }, R: { fx: 0, st: 'F' }, dx: 0, bob: 0 },
    { L: { fx: 0, st: 'S' }, R: { fx: 0, st: 'F' }, dx: 1, bob: 1 },
    { L: { fx: 0, st: 'H' }, R: { fx: 0, st: 'F' }, dx: 1, bob: 0 },
  ],
  fire: { L: { fx: -1, st: 'F' }, R: { fx: 1, st: 'F' }, dx: 0, bob: 0 },
  // side-step, painted moving SCREEN-RIGHT (played backwards to go left):
  // neutral, right foot reaches, wide, settle, left foot closes, neutral
  strafe: [
    { L: { fx: 0, st: 'F' }, R: { fx: 0, st: 'F' }, dx: 0, bob: 0 },
    { L: { fx: 0, st: 'F' }, R: { fx: 1, st: 'S' }, dx: 0, bob: 0 },
    { L: { fx: -1, st: 'F' }, R: { fx: 1, st: 'F' }, dx: 0, bob: 0 },
    { L: { fx: -1, st: 'F' }, R: { fx: 1, st: 'F' }, dx: 1, bob: 1 },
    { L: { fx: 0, st: 'S' }, R: { fx: 0, st: 'F' }, dx: 1, bob: 0 },
    { L: { fx: 0, st: 'F' }, R: { fx: 0, st: 'F' }, dx: 0, bob: 1 },
  ],
};
// PROFILE (east). One hip socket at x 11 for BOTH legs. Each leg: knee x and
// foot x relative to the hip, and the foot state. The planted foot slides
// BACK relative to the body (+3 -> +2 -> 0) because the body is passing over
// it; the trailing foot leaves heel-first; the swing leg passes UNDER the
// pelvis with its knee forward. The stride is compact: feet never more than
// 3px either side of the hip.
export const SIDE2 = {
  idle: { N: { k: 0, f: 1, st: 'F' }, F: { k: 0, f: -1, st: 'F' }, bob: 0 },
  walk: [
    { N: { k: 1, f: 3, st: 'F' }, F: { k: -1, f: -3, st: 'H' }, bob: 0 },
    { N: { k: 1, f: 2, st: 'F' }, F: { k: 1, f: -1, st: 'S' }, bob: 1 },
    { N: { k: 0, f: 0, st: 'F' }, F: { k: 2, f: 1, st: 'S' }, bob: 0 },
    { N: { k: -1, f: -3, st: 'H' }, F: { k: 1, f: 3, st: 'F' }, bob: 0 },
    { N: { k: 1, f: -1, st: 'S' }, F: { k: 1, f: 2, st: 'F' }, bob: 1 },
    { N: { k: 2, f: 1, st: 'S' }, F: { k: 0, f: 0, st: 'F' }, bob: 0 },
  ],
  fire: { N: { k: 1, f: 2, st: 'F' }, F: { k: -1, f: -2, st: 'F' }, bob: 0 },
  // moving toward / away from the camera while in profile: marking time, the
  // knees lifting in turn under the pelvis
  strafe: [
    { N: { k: 0, f: 1, st: 'F' }, F: { k: 0, f: -1, st: 'F' }, bob: 0 },
    { N: { k: 2, f: 1, st: 'S' }, F: { k: 0, f: -1, st: 'F' }, bob: 0 },
    { N: { k: 1, f: 1, st: 'F' }, F: { k: 0, f: -1, st: 'F' }, bob: 1 },
    { N: { k: 0, f: 1, st: 'F' }, F: { k: 0, f: -1, st: 'F' }, bob: 0 },
    { N: { k: 0, f: 1, st: 'F' }, F: { k: 2, f: -1, st: 'S' }, bob: 0 },
    { N: { k: 0, f: 1, st: 'F' }, F: { k: 1, f: -1, st: 'F' }, bob: 1 },
  ],
};

// the boot row for a foot state: flat on the deck, heel lifted (toe still on
// the deck), or swinging clear of it
const footTop = (st) => (st === 'S' ? 21 : st === 'H' ? 22 : 23);

function legFB(g, R, x, leg, hipY, back, elitePlate) {
  const top = footTop(leg.st), fx = x + leg.fx;
  const kneeY = hipY + Math.max(1, Math.floor((top - hipY) / 2));
  const inward = leg.st === 'S' ? (x < 12 ? 1 : -1) : 0;      // a swinging knee comes in under the pelvis
  g.rect(x, hipY, 2, kneeY - hipY, R.near);                     // thigh
  g.rect(x + inward, kneeY, 2, 1, R.near); g.px(x + inward + (x < 12 ? 1 : 0), kneeY, R.knee);   // knee
  for (let y = kneeY + 1; y < top; y++) g.rect(fx + (y === kneeY + 1 ? inward : 0), y, 2, 1, R.near);   // shin
  if (elitePlate) g.hl(kneeY, x + inward, x + inward + 1, elitePlate);
  // BOTH boots point the same way: front view the toe cap faces the camera
  // (its bottom row), back view it faces away (no cap, a darker heel)
  if (leg.st === 'H') { g.rect(fx, top, 2, 1, R.boot); g.rect(fx, top + 1, 2, 1, back ? R.boot : R.toe); }
  else {
    g.rect(fx, top, 2, 2, R.boot);
    if (!back) g.hl(top + 1, fx, fx + 1, R.toe);
  }
}

function legSide(g, R, leg, hipY, col, elitePlate) {
  const HX = 11, top = footTop(leg.st);
  const kneeY = hipY + Math.max(1, Math.floor((top - hipY) / 2)) - (leg.st === 'S' ? 1 : 0);
  const kx = HX + leg.k, ax = HX + leg.f;
  // hip -> knee -> ankle as a 2px-wide limb, one row at a time
  for (let y = hipY; y < top; y++) {
    const x = y <= kneeY
      ? Math.round(HX + (kx - HX) * ((y - hipY) / Math.max(1, kneeY - hipY)))
      : Math.round(kx + (ax - kx) * ((y - kneeY) / Math.max(1, top - kneeY)));
    g.rect(x, y, 2, 1, col);
  }
  if (col === R.near) g.px(kx + 1, kneeY, R.knee);              // the near knee catches the light
  if (elitePlate && col === R.near) g.px(kx + 1, kneeY, elitePlate);
  // the BOOT POINTS EAST on both legs: heel at the ankle, toe forward
  if (leg.st === 'H') {                                          // heel up, toe still on the deck
    g.rect(ax, top, 2, 1, R.boot); g.rect(ax + 1, top + 1, 2, 1, R.boot);
  } else {
    g.rect(ax, top, 3, 2, R.boot);
    if (col === R.near) g.px(ax + 2, top, R.toe);
  }
}

// draw into `g` shifted by (dx, dy): the upper body rides the pelvis
function shifted(g, dx, dy) {
  const s = { px: (x, y, c) => g.px(x + dx, y + dy, c) };
  s.rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) s.px(x + i, y + j, c); };
  s.hl = (y, x0, x1, c) => { for (let x = x0; x <= x1; x++) s.px(x, y, c); };
  s.vl = (x, y0, y1, c) => { for (let y = y0; y <= y1; y++) s.px(x, y, c); };
  s.sym = (y, wd, c) => s.hl(y, 12 - wd / 2, 12 + wd / 2 - 1, c);
  return s;
}

const GAIT_UPPER = {
  gunner: (g, dir, e, o) => (dir === 'side' ? gunnerSide(g, e, o) : gunnerFrontBack(g, dir, e, o)),
  rifleman: (g, dir, e, o) => (dir === 'side' ? riflemanSide(g, e, o) : riflemanFrontBack(g, dir, e, o)),
  marksman: (g, dir, e, o) => (dir === 'side' ? marksmanSide(g, e, o) : marksmanFrontBack(g, dir, e, o)),
};

// spec: one entry of FB2 / SIDE2; base: the upper-body pose options
function gaitFrame(role, dir, e, spec, base) {
  const R = GAIT_ROLE[role], g = grid(ROSTER_FRAME.w, ROSTER_FRAME.h);
  const hip = R.hip + spec.bob, plate = role === 'gunner' && e ? ST.lit : null;
  if (dir === 'side') {
    legSide(g, R, spec.F, hip, R.far, null);
    legSide(g, R, spec.N, hip, R.near, plate);
    g.rect(9, hip - 1, 5, 2, R.root);                           // the pelvis both legs hang from
  } else {
    legFB(g, R, 9, spec.L, hip, dir === 'back', plate);
    legFB(g, R, 13, spec.R, hip, dir === 'back', plate);
    g.rect(9 + (spec.dx || 0), hip - 1, 6, 2, R.root);          // pelvis, carried over the planted leg
  }
  GAIT_UPPER[role](shifted(g, dir === 'side' ? 0 : (spec.dx || 0), 0), dir, e, { ...base, bob: spec.bob, noLegs: true });
  g.outline();
  return g;
}

/** Paint a role sheet with gait v2 legs: the 33 stock frames + 18 strafe frames. */
export function paintGaitV2Sheet(scene, key, elite, role) {
  const ss = new SpriteSheet(scene, key, ROSTER_FRAME.w, ROSTER_FRAME.h, GAIT_FRAMES, S);
  const pose = (P) => ({ fire: false, armDy: P ? P.armDy : 0, armDx: P ? P.armDx : 0, lean: P ? P.lean : 0, hand: P ? P.hand : 0 });
  ['front', 'back', 'side'].forEach((dir, di) => {
    const T = dir === 'side' ? SIDE2 : FB2;
    gaitFrame(role, dir, elite, T.idle, pose(null)).blit(ss.frame(di * 8));
    T.walk.forEach((sp, k) => gaitFrame(role, dir, elite, sp, pose(null)).blit(ss.frame(di * 8 + 1 + k)));
    gaitFrame(role, dir, elite, T.fire, { ...pose(null), fire: true }).blit(ss.frame(di * 8 + 7));
    ['raise', 'thrust', 'recoil'].forEach((p, pi) => gaitFrame(role, dir, elite, p === 'raise' ? T.idle : T.fire, pose(POSES[p])).blit(ss.frame(24 + di * 3 + pi)));
    T.strafe.forEach((sp, k) => gaitFrame(role, dir, elite, sp, pose(null)).blit(ss.frame(GAIT_STRAFE_BASE + di * 6 + k)));
  });
  ss.finish();
}

// what the presentation tick needs to know about each role's gait
export const GAIT_CYCLE_PX = { 'ro-gun': 48, 'ro-rif': 48, 'ro-mrk': 44, 'ro-blw': 40 };   // world px of travel per 6-frame walk cycle

// ════════════════════════════════════════════════════════════════════════
// BULWARK (`shielded`) — the defensive heavy of the ordinary roster
// ════════════════════════════════════════════════════════════════════════
//
// YOU IDENTIFY A BULWARK BY THE SHIELD. YOU IDENTIFY AN ELITE BULWARK BY THE
// MACHINERY SUPPORTING THE SHIELD. The field itself is not painted here — it
// is a runtime surface (`systems/bulwarkCurtain.js`) on the gameplay arc. This
// is the man who carries it:
//
//   - the BROADEST body in the roster: a 12-wide chest under two 4x4
//     pauldrons, 20 columns shoulder to shoulder against the Gunner's 18;
//   - pale STEEL-BLUE plate, baked (the legacy one was the Gunner's sheet
//     under a multiply tint, which `fx.hitFlash` erased on the first hit);
//   - an ANGULAR WEDGE helmet: a hexagonal face with a vertical ridge, the two
//     front planes lit differently, a chin that comes to a point. ONE
//     uninterrupted horizontal visor slit in a cold, UNLIT blue — no eyes, no
//     paired lights, no crest, no dome;
//   - the PROJECTOR on the LEFT forearm (screen-right in front view, the far
//     arm in profile) carrying a small ice-white emitter core, and the
//     SIDEARM in the RIGHT hand, which is the separate weapon overlay;
//   - a GENERATOR on the back, the back view's subject.
//
// The ELITE is the same body, the same helmet shell and the same face. Every
// difference is machinery supporting the field: a bigger gauntlet with a
// ringed core, a steel brace up the arm, a conduit from the yoke to the
// projector, a finned generator housing and a reinforced steel yoke. No
// scale, no tint, no light on the face, and the field it projects is
// identical (the field module has no notion of tier at all).
//
// THE PROJECTOR ARM DOES NOT BOB. The upper body settles one row on a load
// frame and shifts a column over the planted leg; the gauntlet is painted
// against the BASE coordinates so it holds still while the torso moves over
// it — the field is anchored to the body centre and the shield facing, and a
// projector that bobbed four screen pixels under a still field would be two
// authors arguing about one object. `BULWARK_CORE` therefore needs one point
// per facing, not one per frame.
const BW = { lit: '#c3d1e7', mid: '#92a6c7', dk: '#64799a', sh: '#455672' };   // pale steel-blue plate
const BU = { lit: '#394150', mid: '#272d38', dk: '#191d25' };                  // undersuit
const BH = { lit: '#69727f', mid: '#454c58', dk: '#2c3139', st: '#b2bdcd' };   // hardware graphite + steel
const BCORE = { hot: '#f4faff', rim: '#a9d3f5', dim: '#6f93b6' };              // emitter / generator light
const BSLIT = '#22364f';                                                       // the visor slit: cold, unlit
const BBOOT = '#0b0c10';

/**
 * Where the emitter core is painted, per facing, in LOGICAL sheet pixels
 * (centre of the 2px core). `null` = hidden (back view: the projector arm is
 * held forward, on the far side of the body). West is the side block mirrored.
 */
export const BULWARK_CORE = {
  regular: { front: [17.5, 16.5], side: [17.5, 17.5], back: null },
  elite:   { front: [18.0, 17.0], side: [18.5, 17.0], back: null },
};
export const BULWARK_CORE_COLOR = BCORE.hot;

// ── the gauntlet, painted against BASE coordinates (see above) ─────────────
function bulwarkGauntletFront(g, e, dx) {
  const X = (x) => x - dx;                                   // undo the gait's column shift
  if (!e) {
    g.rect(X(16), 15, 4, 3, BH.mid); g.hl(15, X(16), X(19), BH.lit);
    g.px(X(19), 16, BH.dk); g.px(X(16), 17, BH.dk);
    g.px(X(17), 16, BCORE.hot); g.px(X(18), 16, BCORE.rim);  // emitter, facing the field
  } else {
    g.rect(X(15), 14, 6, 5, BH.mid); g.hl(14, X(15), X(20), BH.lit);
    g.vl(X(20), 14, 18, BH.st);                              // steel side plate
    g.hl(18, X(15), X(19), BH.dk);
    g.px(X(16), 16, BCORE.rim); g.px(X(19), 16, BCORE.rim);  // ringed core
    g.px(X(16), 17, BCORE.dim); g.px(X(19), 17, BCORE.dim);
    g.rect(X(17), 16, 2, 2, BCORE.hot);
  }
}
function bulwarkGauntletSide(g, e) {
  if (!e) {
    g.rect(14, 16, 4, 3, BH.mid); g.hl(16, 14, 17, BH.lit); g.hl(18, 14, 16, BH.dk);
    g.px(17, 16, BCORE.rim); g.px(17, 17, BCORE.hot);
  } else {
    g.rect(13, 15, 6, 4, BH.mid); g.hl(15, 13, 18, BH.lit); g.hl(18, 13, 17, BH.dk);
    g.hl(14, 12, 15, BH.st);                                 // brace along the forearm
    g.px(18, 16, BCORE.hot); g.px(18, 17, BCORE.hot); g.px(17, 16, BCORE.rim); g.px(17, 17, BCORE.rim);
  }
}

// ── STOCK-CONTRACT LEGS (no `?gait=v2`): the shared channel tables ─────────
// Armoured legs are three columns wide and the stance is wider than any other
// role's — the base is what a defensive heavy is standing on.
function bulwarkLegsFBStock(g, o, hipY) {
  for (const [x, lift] of [[o.lx - 2, o.liftL], [o.rx + 1, o.liftR]]) {
    const bootY = 23 - lift;
    g.rect(x, hipY, 3, bootY - hipY, BW.mid);
    g.hl(hipY, x, x + 2, BW.dk); g.vl(x < 12 ? x : x + 2, hipY + 1, bootY - 1, BW.dk);
    g.hl(hipY + 2, x, x + 2, BW.lit);                                    // knee plate
    g.rect(x, bootY, 3, 2, BBOOT); g.hl(bootY + 1, x, x + 2, BU.lit);    // boot, toe toward the viewer
  }
  g.rect(o.lx - 2, hipY - 1, o.rx - o.lx + 6, 2, BU.mid);
}
function bulwarkLegsSideStock(g, o, hipY) {
  const leg = (x, lift, col) => { const bootY = 23 - lift; g.rect(x, hipY, 2, bootY - hipY, col); return bootY; };
  const fb = leg(o.far, o.farLift, BW.sh); g.rect(o.far - 1, fb, 4, 2, BBOOT);
  const nb = leg(o.near, o.nearLift, BW.dk); g.px(o.near + 1, hipY + 2, BW.lit);
  g.rect(o.near - 1, nb, 4, 2, BBOOT); g.px(o.near + 2, nb, BU.lit);
  g.rect(9, hipY - 1, 6, 2, BU.mid);
}

// ── FRONT / BACK ───────────────────────────────────────────────────────────
function bulwarkFrontBack(g, dir, e, o) {
  const front = dir === 'front', b = o.bob, dx = o.dx || 0;
  // GENERATOR — front view: only its housing shows, behind the shoulders
  if (front) {
    if (e) { g.rect(5, 8 + b, 3, 2, BH.mid); g.hl(8 + b, 5, 7, BH.lit); g.rect(16, 8 + b, 3, 2, BH.mid); g.hl(8 + b, 16, 18, BH.lit); g.px(17, 9 + b, BCORE.dim); }
    else { g.rect(15, 8 + b, 3, 2, BH.mid); g.hl(8 + b, 15, 17, BH.lit); }
  }
  if (!o.noLegs) bulwarkLegsFBStock(g, o, 18 + b);
  // TORSO — 12 wide, a chevron breast plate (the wedge again), a belt
  g.rect(6, 12 + b, 12, 6, BU.mid);                                       // undersuit under the plate
  g.rect(6, 12 + b, 12, 3, BW.mid); g.sym(12 + b, 12, BW.lit);            // breast plate
  if (front) {
    g.hl(15 + b, 8, 15, BW.mid); g.hl(16 + b, 10, 13, BW.dk);            // its lower edge comes to a point (the wedge again)
    g.px(11, 13 + b, BW.lit); g.px(12, 13 + b, BW.dk);                    // sternum ridge
    g.hl(17 + b, 6, 17, BU.dk); g.px(11, 17 + b, BH.st); g.px(12, 17 + b, BH.st);   // belt + buckle
  } else {
    g.vl(6, 13 + b, 16 + b, BW.dk); g.vl(17, 13 + b, 16 + b, BW.dk);
  }
  // PAULDRONS — two broad angular plates, chamfered at the outer top corner
  const ay = 10 + b + o.armDy;
  for (const x of [3, 17]) {
    const cx = x === 3 ? x + 1 : x;                           // chamfered at the OUTER top corner
    g.hl(ay, cx, cx + 2, BW.lit);
    g.rect(x, ay + 1, 4, 3, BW.mid); g.hl(ay + 1, x, x + 3, BW.lit); g.hl(ay + 3, x, x + 3, BW.sh);
    g.vl(x === 3 ? 6 : 17, ay + 2, ay + 3, BW.sh);                        // a seam where plate meets chest
  }
  if (front) {
    // RIGHT ARM (screen-left): elbow, then a forearm coming in across the
    // belly to the hand that holds the sidearm (the overlay starts there)
    g.rect(4, 14 + b, 2, 2, BW.dk); g.rect(5, 16 + b, 2, 1, BW.mid); g.px(5, 16 + b, BW.dk);
    g.rect(7, 17 + b, 2, 1, BW.dk); g.px(9, 17 + b, BU.lit);
    // LEFT ARM (screen-right): upper arm, then the projector held over the hip
    g.rect(18, 14 + b, 2, 1, BW.dk);
    bulwarkGauntletFront(g, e, dx);
  } else {
    // BACK: both forearms are forward, on the far side of him
    g.rect(4, 14 + b, 2, 2, BW.dk); g.rect(18, 14 + b, 2, 2, BW.dk);
    g.px(3, 16, BH.mid); g.px(4, 16, BH.dk);                 // the gauntlet's outer edge, char-left
    // THE GENERATOR — the back view's subject
    if (!e) {
      g.rect(8, 10 + b, 8, 7, BH.mid); g.hl(10 + b, 8, 15, BH.lit); g.vl(8, 11 + b, 16 + b, BH.dk); g.hl(16 + b, 8, 15, BH.dk);
      g.vl(11, 12 + b, 14 + b, BCORE.dim); g.vl(12, 12 + b, 14 + b, BCORE.dim); g.px(11, 13 + b, BCORE.rim); g.px(12, 13 + b, BCORE.rim);
    } else {
      g.rect(7, 9 + b, 10, 8, BH.mid); g.hl(9 + b, 7, 16, BH.lit); g.hl(16 + b, 7, 16, BH.dk);
      for (const fx of [6, 17]) { g.vl(fx, 11 + b, 14 + b, BH.dk); g.px(fx, 11 + b, BH.lit); }       // fins
      g.vl(11, 11 + b, 14 + b, BCORE.rim); g.vl(12, 11 + b, 14 + b, BCORE.rim); g.px(11, 12 + b, BCORE.hot); g.px(12, 12 + b, BCORE.hot);
      g.hl(15 + b, 9, 14, BH.st);
      g.px(7, 10 + b, BCORE.dim); g.px(6, 10 + b, BH.dk); g.px(5, 11 + b, BH.dk);   // conduit to the projector arm
    }
  }
  // HELMET — the armoured wedge: a flat crown, full-width cheeks, and two
  // face planes converging to a pointed chin either side of a vertical ridge
  g.sym(11 + b, 4, BU.mid);                                                // gorget, under the chin point
  const rows = [[3, 9, 14], [4, 8, 15], [5, 8, 15], [6, 8, 15], [7, 8, 15], [8, 8, 15], [9, 9, 14], [10, 10, 13], [11, 11, 12]];
  for (const [y, x0, x1] of rows) { g.hl(y + b, x0, Math.min(x1, 11), BW.mid); if (x1 >= 12) g.hl(y + b, Math.max(x0, 12), x1, BW.dk); }
  g.hl(3 + b, 9, 14, BW.lit); g.hl(4 + b, 8, 11, BW.lit);                 // the crown plane takes the light
  g.vl(8, 5 + b, 8 + b, BW.lit);
  if (front) {
    g.vl(11, 4 + b, 6 + b, BW.lit); g.vl(12, 4 + b, 6 + b, BW.mid);        // the ridge — the wedge's apex
    g.vl(11, 8 + b, 10 + b, BW.lit); g.vl(12, 8 + b, 10 + b, BW.mid);
    g.hl(7 + b, 9, 14, BSLIT);                                             // ONE slit, edge to edge, unlit
  } else {
    g.vl(11, 3 + b, 9 + b, BW.lit); g.vl(12, 3 + b, 9 + b, BW.mid);        // rear ridge
    g.hl(9 + b, 9, 14, BW.sh); g.hl(10 + b, 10, 13, BW.sh);
  }
  if (e) {
    g.hl(11 + b, 7, 16, BH.st); g.hl(12 + b, 8, 15, BH.mid);               // REINFORCED YOKE
    if (front) {
      g.vl(21, 12 + b, 15, BH.st);                                         // brace up the projector arm
      g.px(16, 12 + b, BH.dk); g.px(16, 13 + b, BCORE.dim); g.px(15, 14 + b, BH.dk);   // conduit, yoke -> projector
    }
  }
}

// ── SIDE (east). Near = char-RIGHT (the sidearm arm), far = the projector ──
function bulwarkSide(g, e, o) {
  const b = o.bob, L = o.lean;
  // far arm first: the projector, held forward at the hip, steady
  bulwarkGauntletSide(g, e);
  // GENERATOR on the back (west)
  if (!e) {
    g.rect(4 + L, 9 + b, 4, 7, BH.mid); g.hl(9 + b, 4 + L, 7 + L, BH.lit); g.vl(4 + L, 10 + b, 15 + b, BH.dk);
    g.px(5 + L, 12 + b, BCORE.dim); g.px(5 + L, 13 + b, BCORE.rim);
  } else {
    g.rect(3 + L, 8 + b, 5, 9, BH.mid); g.hl(8 + b, 3 + L, 7 + L, BH.lit); g.vl(3 + L, 9 + b, 16 + b, BH.dk);
    g.vl(2 + L, 10 + b, 13 + b, BH.dk); g.px(2 + L, 10 + b, BH.lit);                      // fin
    g.px(5 + L, 11 + b, BCORE.rim); g.px(5 + L, 12 + b, BCORE.hot); g.px(5 + L, 13 + b, BCORE.rim);
  }
  if (!o.noLegs) bulwarkLegsSideStock(g, o, 18 + b);
  // TORSO — deep chest in profile
  g.rect(8 + L, 12 + b, 8, 6, BW.mid); g.hl(12 + b, 8 + L, 15 + L, BW.lit); g.vl(15 + L, 13 + b, 16 + b, BW.lit);
  g.hl(17 + b, 8 + L, 15 + L, BU.mid); g.vl(8 + L, 13 + b, 16 + b, BW.dk);
  if (e) { g.px(13 + L, 15 + b, BCORE.dim); g.px(14 + L, 15 + b, BH.dk); }               // conduit to the projector
  // NEAR PAULDRON + the sidearm arm, forward at chest height
  const sy = 10 + b + o.armDy, sx = 9 + L - (o.fire ? 1 : 0);
  g.hl(sy, sx + 1, sx + 4, BW.lit); g.rect(sx, sy + 1, 5, 3, BW.mid); g.hl(sy + 3, sx, sx + 4, BW.sh);
  g.rect(11 + L, 14 + b, 2, 1, BW.dk);
  g.rect(13 + L + o.hand - (o.fire ? 1 : 0), 14 + b + Math.min(0, o.armDy), 3, 1, BU.mid);
  // HELMET — the wedge in profile: a long shallow upper face plane from the
  // crown, a steep lower one from the chin, meeting in ONE edge at the slit
  const prof = [[3, 10, 13], [4, 9, 14], [5, 9, 15], [6, 9, 15], [7, 9, 16], [8, 9, 15], [9, 9, 15], [10, 10, 14]];
  for (const [y, x0, x1] of prof) g.hl(y + b, x0 + L, x1 + L, BW.mid);
  g.hl(3 + b, 10 + L, 13 + L, BW.lit); g.hl(4 + b, 9 + L, 14 + L, BW.lit);
  g.px(15 + L, 5 + b, BW.lit); g.px(15 + L, 6 + b, BW.lit); g.px(14 + L, 5 + b, BW.lit);  // upper face plane, lit
  g.hl(7 + b, 13 + L, 16 + L, BSLIT);                                                    // the slit, to the front edge
  g.px(15 + L, 8 + b, BW.dk); g.px(15 + L, 9 + b, BW.dk); g.px(14 + L, 10 + b, BW.dk);  // lower face plane, in shadow
  g.hl(10 + b, 10 + L, 13 + L, BW.sh);
  g.vl(9 + L, 5 + b, 9 + b, BW.dk);
  g.rect(10 + L, 11 + b, 4, 1, BU.mid);                                                  // gorget
  if (e) g.hl(11 + b, 9 + L, 14 + L, BH.st);                                             // yoke
}

function bulwarkFrame(dir, e, o) {
  const g = grid(ROSTER_FRAME.w, ROSTER_FRAME.h);
  if (dir === 'side') bulwarkSide(g, e, o); else bulwarkFrontBack(g, dir, e, o);
  g.outline();
  return g;
}

// ── GAIT v2 — THE HEAVY TACTICAL SHUFFLE ───────────────────────────────────
//
// The corrected anatomy (one pelvis, knees, both boots one way, the far leg
// allowed to vanish) at a DEFENSIVE scale: hip sockets six columns apart
// (the other roles: four), three-column armoured legs, four-pixel boots, a
// compact stride (feet within +2/-3 of the hip in profile against +-3), and a
// LOW swing — the travelling foot clears the deck by one row ('L'), never two.
// Weight moves on the load frame only, one column, one row. The cycle is 40px
// of real travel (GAIT_CYCLE_PX), because the planted foot slides back five
// logical pixels per step.
export const BULWARK_GAIT = {
  fb: {
    idle: { L: { fx: 0, st: 'F' }, R: { fx: 0, st: 'F' }, dx: 0, bob: 0 },
    walk: [
      { L: { fx: 0, st: 'F' }, R: { fx: 0, st: 'H' }, dx: 0, bob: 0 },
      { L: { fx: 0, st: 'F' }, R: { fx: 0, st: 'L' }, dx: -1, bob: 1 },
      { L: { fx: 0, st: 'F' }, R: { fx: 0, st: 'L' }, dx: 0, bob: 0 },
      { L: { fx: 0, st: 'H' }, R: { fx: 0, st: 'F' }, dx: 0, bob: 0 },
      { L: { fx: 0, st: 'L' }, R: { fx: 0, st: 'F' }, dx: 1, bob: 1 },
      { L: { fx: 0, st: 'L' }, R: { fx: 0, st: 'F' }, dx: 0, bob: 0 },
    ],
    fire: { L: { fx: -1, st: 'F' }, R: { fx: 1, st: 'F' }, dx: 0, bob: 0 },
    // side-step painted moving SCREEN-RIGHT (played backwards to go left)
    strafe: [
      { L: { fx: 0, st: 'F' }, R: { fx: 0, st: 'F' }, dx: 0, bob: 0 },
      { L: { fx: 0, st: 'F' }, R: { fx: 1, st: 'L' }, dx: 0, bob: 0 },
      { L: { fx: 0, st: 'F' }, R: { fx: 1, st: 'F' }, dx: 1, bob: 1 },
      { L: { fx: 0, st: 'L' }, R: { fx: 1, st: 'F' }, dx: 1, bob: 0 },
      { L: { fx: 1, st: 'L' }, R: { fx: 1, st: 'F' }, dx: 0, bob: 0 },
      { L: { fx: 0, st: 'F' }, R: { fx: 0, st: 'F' }, dx: 0, bob: 1 },
    ],
  },
  side: {
    idle: { N: { k: 0, f: 1, st: 'F' }, F: { k: 0, f: -2, st: 'F' }, bob: 0 },
    walk: [
      { N: { k: 1, f: 2, st: 'F' }, F: { k: -1, f: -3, st: 'H' }, bob: 0 },
      { N: { k: 1, f: 1, st: 'F' }, F: { k: 1, f: -1, st: 'L' }, bob: 1 },
      { N: { k: 0, f: -1, st: 'F' }, F: { k: 1, f: 1, st: 'L' }, bob: 0 },
      { N: { k: -1, f: -3, st: 'H' }, F: { k: 1, f: 2, st: 'F' }, bob: 0 },
      { N: { k: 1, f: -1, st: 'L' }, F: { k: 1, f: 1, st: 'F' }, bob: 1 },
      { N: { k: 1, f: 1, st: 'L' }, F: { k: 0, f: -1, st: 'F' }, bob: 0 },
    ],
    fire: { N: { k: 1, f: 2, st: 'F' }, F: { k: -1, f: -2, st: 'F' }, bob: 0 },
    // toward / away from the camera in profile: marking time, low knees
    strafe: [
      { N: { k: 0, f: 1, st: 'F' }, F: { k: 0, f: -2, st: 'F' }, bob: 0 },
      { N: { k: 1, f: 1, st: 'L' }, F: { k: 0, f: -2, st: 'F' }, bob: 0 },
      { N: { k: 1, f: 1, st: 'F' }, F: { k: 0, f: -2, st: 'F' }, bob: 1 },
      { N: { k: 0, f: 1, st: 'F' }, F: { k: 0, f: -2, st: 'F' }, bob: 0 },
      { N: { k: 0, f: 1, st: 'F' }, F: { k: 1, f: -2, st: 'L' }, bob: 0 },
      { N: { k: 0, f: 1, st: 'F' }, F: { k: 1, f: -2, st: 'F' }, bob: 1 },
    ],
  },
};
// boot top row per foot state: flat, heel up (toe on the deck), low swing, swing
const blwFootTop = (st) => (st === 'S' ? 21 : (st === 'L' || st === 'H') ? 22 : 23);

function blwLegFB(g, x, leg, hipY, back) {
  const top = blwFootTop(leg.st), fx = x + leg.fx;
  const kneeY = hipY + Math.max(1, Math.floor((top - hipY) / 2));
  const inward = leg.st === 'L' ? (x < 12 ? 1 : -1) : 0;       // a travelling knee comes in under the pelvis
  g.rect(x, hipY, 3, kneeY - hipY, BW.dk);                       // thigh
  g.rect(x + inward, kneeY, 3, 1, BW.lit);                       // knee plate
  for (let y = kneeY + 1; y < top; y++) g.rect(fx + (y === kneeY + 1 ? inward : 0), y, 3, 1, BW.mid);   // greave
  // BOTH boots point the same way: the toe faces the viewer in front view
  if (leg.st === 'H') { g.rect(fx, top, 3, 1, BBOOT); g.rect(fx, top + 1, 3, 1, back ? BBOOT : BU.lit); }
  else { g.rect(fx, top, 3, 2, BBOOT); if (!back) g.hl(top + 1, fx, fx + 2, BU.lit); }
}

function blwLegSide(g, leg, hipY, col, near) {
  const HX = 11, top = blwFootTop(leg.st);
  const kneeY = hipY + Math.max(1, Math.floor((top - hipY) / 2)) - (leg.st === 'L' ? 1 : 0);
  const kx = HX + leg.k, ax = HX + leg.f;
  for (let y = hipY; y < top; y++) {
    const x = y <= kneeY
      ? Math.round(HX + (kx - HX) * ((y - hipY) / Math.max(1, kneeY - hipY)))
      : Math.round(kx + (ax - kx) * ((y - kneeY) / Math.max(1, top - kneeY)));
    g.rect(x, y, 2, 1, col);
  }
  if (near) g.px(kx + 1, kneeY, BW.lit);                         // the near knee plate
  // the BOOT POINTS EAST on both legs: heel at the ankle, a heavy toe forward
  if (leg.st === 'H') { g.rect(ax, top, 2, 1, BBOOT); g.rect(ax + 1, top + 1, 3, 1, BBOOT); }
  else { g.rect(ax, top, 4, 2, BBOOT); if (near) g.px(ax + 3, top, BU.lit); }
}

function bulwarkGaitFrame(dir, e, spec, base) {
  const g = grid(ROSTER_FRAME.w, ROSTER_FRAME.h), hip = 18 + spec.bob;
  const dx = dir === 'side' ? 0 : (spec.dx || 0);
  if (dir === 'side') {
    blwLegSide(g, spec.F, hip, BW.sh, false);
    blwLegSide(g, spec.N, hip, BW.dk, true);
    g.rect(9, hip - 1, 6, 2, BU.mid);                            // the pelvis both legs hang from
  } else {
    blwLegFB(g, 7, spec.L, hip, dir === 'back');
    blwLegFB(g, 14, spec.R, hip, dir === 'back');
    g.rect(7 + dx, hip - 1, 10, 2, BU.mid);                      // a wide pelvis, carried over the planted leg
  }
  const s = shifted(g, dx, 0);
  const up = { ...base, bob: spec.bob, noLegs: true, dx };
  if (dir === 'side') bulwarkSide(s, e, up); else bulwarkFrontBack(s, dir, e, up);
  g.outline();
  return g;
}

function paintBulwarkGaitSheet(scene, key, elite) {
  const ss = new SpriteSheet(scene, key, ROSTER_FRAME.w, ROSTER_FRAME.h, GAIT_FRAMES, S);
  const pose = (P) => ({ fire: false, armDy: P ? P.armDy : 0, armDx: P ? P.armDx : 0, lean: P ? P.lean : 0, hand: P ? P.hand : 0 });
  ['front', 'back', 'side'].forEach((dir, di) => {
    const T = dir === 'side' ? BULWARK_GAIT.side : BULWARK_GAIT.fb;
    bulwarkGaitFrame(dir, elite, T.idle, pose(null)).blit(ss.frame(di * 8));
    T.walk.forEach((sp, k) => bulwarkGaitFrame(dir, elite, sp, pose(null)).blit(ss.frame(di * 8 + 1 + k)));
    bulwarkGaitFrame(dir, elite, T.fire, { ...pose(null), fire: true }).blit(ss.frame(di * 8 + 7));
    ['raise', 'thrust', 'recoil'].forEach((p, pi) => bulwarkGaitFrame(dir, elite, p === 'raise' ? T.idle : T.fire, pose(POSES[p])).blit(ss.frame(24 + di * 3 + pi)));
    T.strafe.forEach((sp, k) => bulwarkGaitFrame(dir, elite, sp, pose(null)).blit(ss.frame(GAIT_STRAFE_BASE + di * 6 + k)));
  });
  ss.finish();
}

// ── THE SIDEARM — compact, one-handed, secondary ───────────────────────────
//
// Not the projector (the shield is not the gun), not the legacy rifle, not a
// carbine. A short pistol in a gloved right hand, at the end of an armoured
// forearm. The overlay carries the forearm because the base class (frozen)
// rotates the overlay to the aim about a pivot `cfg.radius - 4` out, and a
// pistol on its own out there would float off the body.
//
// THE MUZZLE IS PLACED BY THE GAMEPLAY SPAWN POINT, as for every role: the
// Bulwark's bolt is 700px/s, so its leading edge on the first drawn frame is
// `muzzlePastPivot(700)` = 54px past the pivot, and the drawn muzzle goes
// there. A pistol at full arm's reach is exactly what a one-handed aimed shot
// looks like from above. The ELITE pivots 9px further out (gameplay radius 33
// against 24): its forearm is two gun-pixels longer at the BACK so the elbow
// lands on the same place on the body; the pistol itself is identical.
export const SIDEARM = { h: 5, barrelRow: 1 };
export const BULWARK_MUZZLE_PAST_PIVOT = Math.round(muzzlePastPivot(ENEMY.shielded.bulletSpeed));   // 54
function paintSidearm(scene, key, elite) {
  const fore = elite ? 7 : 5, len = fore + 8;
  const w = weaponGrid(len, SIDEARM.h);
  w.rect(0, 1, fore, 3, BW.mid); w.hl(1, 0, fore - 1, BW.lit); w.hl(3, 0, fore - 1, BW.dk);   // armoured forearm
  w.rect(fore, 1, 1, 3, BU.mid);                                                             // cuff
  w.rect(fore + 1, 2, 2, 2, BU.dk);                                                          // glove round the grip
  w.rect(fore + 1, 0, 7, 2, BH.mid); w.hl(0, fore + 1, fore + 7, BH.lit);                    // slide, lit top plane
  w.px(fore + 7, 1, BH.dk);                                                                  // bore
  w.rect(fore + 3, 2, 2, 1, BH.dk);                                                          // frame / guard
  return paintWeaponGrid(scene, key, w, BULWARK_MUZZLE_PAST_PIVOT, SIDEARM.barrelRow);
}

/** Bulwark production art. Registered for `shielded` by PreloadScene. */
export function paintRosterBulwark(scene) {
  if (isGaitV2()) { paintBulwarkGaitSheet(scene, 'ro-blw-R', false); paintBulwarkGaitSheet(scene, 'ro-blw-E', true); }
  else { paintRoleSheet(scene, 'ro-blw-R', false, bulwarkFrame); paintRoleSheet(scene, 'ro-blw-E', true, bulwarkFrame); }
  const oR = paintSidearm(scene, 'ro-w-blw-R', false);
  const oE = paintSidearm(scene, 'ro-w-blw-E', true);
  return {
    regular: { tex: 'ro-blw-R', prefix: 'ro-blw-R', weapon: 'ro-w-blw-R', weaponOrigin: oR, bulwark: true },
    elite:   { tex: 'ro-blw-E', prefix: 'ro-blw-E', weapon: 'ro-w-blw-E', weaponOrigin: oE, bulwark: true },
  };
}
