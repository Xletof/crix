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
  gunnerLegsFB(g, o.lx, o.rx, o.liftL, o.liftR, 18 + b, e ? ST : null);
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
  gunnerLegsSide(g, o.near, o.far, o.nearLift, o.farLift, 18 + b, e ? ST : null);
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
  paintGunnerSheet(scene, 'ro-gun-R', false);
  paintGunnerSheet(scene, 'ro-gun-E', true);
  const oR = paintGunnerWeapon(scene, 'ro-w-gun-R', false);
  const oE = paintGunnerWeapon(scene, 'ro-w-gun-E', true);
  return {
    regular: { tex: 'ro-gun-R', prefix: 'ro-gun-R', weapon: 'ro-w-gun-R', weaponOrigin: oR, muzzleFx: true, weaponFx: true },
    elite:   { tex: 'ro-gun-E', prefix: 'ro-gun-E', weapon: 'ro-w-gun-E', weaponOrigin: oE, muzzleFx: true, weaponFx: true },
  };
}
