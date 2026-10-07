// THE BULWARK FIELD — a FROSTED HARD-LIGHT CURTAIN (roster v1). PRESENTATION ONLY.
//
// The gameplay shield is three frozen numbers on `EnemyShielded` and nothing
// else: `_shieldFacing`, `_shieldHalfArc` (1.35 rad) and the 2.6 rad/s turn
// that drives the facing. The block itself is decided in
// `GameScene.handleBulletEnemyHits` when a bolt overlaps the BODY circle, and
// handed to the bearer as a contact projected onto the curtain
// (`systems/shieldContact.js`) AFTER the result is final. This module reads
// those and draws; it writes nothing back, owns no timer, no tween and no
// randomness, and cannot delay, move or decide a block.
//
// ── THE SURFACE, IN CRIX'S LANGUAGE ──────────────────────────────────────
// A curved band standing in front of the bearer, on EXACTLY the protected
// arc: facing ± `_shieldHalfArc`, tapering to a point at each end so the tips
// ARE the coverage. Hard light, not glass, not a bubble, not honeycomb — and
// drawn the way the roster is drawn rather than the way a shader would draw
// it (the second handset round's verdict on the first build: polished glass,
// many small panes, a vector-clean rim, soft optical gradients):
//
//   - THE GAME'S OWN PIXEL. The field is drawn in 4px cells on the bearer's
//     own pixel grid (see _candidates), never as vector panes.
//   - FEW VALUE MASSES. The eye is given three: a pale off-white FACE across
//     the middle, ice-blue SHOULDERS, and denser TIPS. No per-panel
//     alternation, no seams, no sheen gradients.
//   - FLAT HARD CELLS. Every cell is ONE colour at ONE alpha; a reaction steps
//     across the surface a cell at a time.
//   - TWO HARD BANDS across the thickness: a denser outer band by the rim (the
//     energy edge) and a thinner inner band toward him.
//   - AN AUTHORED EDGE. One cell of bright rim on the outer edge, one cell of
//     dark navy outside it, as the roster's sprites carry an outline, and a
//     navy cap beyond each tip. The taper never thins below 6px and its last
//     thin stretch is all rim, so every tip ENDS on bright cells at any
//     facing. The inner edge is a soft row, so the field never becomes a
//     black cage.
//   - RESTRAINED INTERFERENCE. One stepped current pulse crosses the field tip
//     to tip every few seconds, a column of cells per step. The ripple carries
//     the motion.
//
// Its cross-section is FLAT: from 11px inside the contact radius to 6px
// outside it, the same at every facing. (The vector field leaned its band —
// inner rim lifted over the outer — and this floor has no foreshortening, so a
// lean ADDS thickness facing south and SUBTRACTS it facing north: 7px of lean
// read 19 / 12 / 5px south / side / north, 2px read 19 / 17 / 15. A cell field
// on the floor plane has no lean to give it.)
//
// ── DEPTH: THE BODY, AND THE WEAPON ──────────────────────────────────────
// Every cell is routed by which side of the bearer it is on. South of his
// centre (nearer the camera) is the NEAR layer, drawn OVER the body and the
// sidearm; north of it is the FAR layer, drawn UNDER the body, so his own
// armour hides whatever of the field is physically behind him. That routing
// decides WHICH Graphics and WHICH depth — never alpha, colour, rim, keyline,
// tip or reaction strength: FAR = BEHIND THE BODY, never FAR = WEAKER.
// (`smoke-bulwark` draws the same field at opposite facings and requires the
// style stream to be identical with only the layer swapped.)
//
// The WEAPON has its own invariant: WEAPON < SHIELD wherever they cross. Side
// on, the sidearm is drawn over his body, the far half of the field under it,
// and the gun crosses the field at the apex — so body > far > gun > body is a
// cycle no single depth can satisfy, and the gun used to sit ON the far half.
// The far cells the gun's own footprint crosses therefore go to a third layer
// (`farW`) just above the weapon; every other far cell stays under the body.
// Facing north the weapon is under his body, so `farW` is too, and his helmet
// still hides what is behind it. The pip, the discharge and that layer share
// ONE stack above the weapon's own depth (`WEAPON_STACK`), so rotation cannot
// swap them.
//
// The field follows the BODY CENTRE and the SHIELD FACING — never the walk
// cycle, the bob or the gauntlet. The projector is the source, and says so
// with a small ice-white core painted on the gauntlet and a quiet glow here
// that answers absorption and the end of a re-knit. No beam joins them.
//
// ── TIER ──────────────────────────────────────────────────────────────────
// Nothing in this file reads `_elite`. The field is identical between Regular
// and Elite — geometry, colour, opacity, coverage, every reaction — because a
// stronger-looking field would imply a stronger defence that does not exist.
// (`CURTAIN_RADIUS` is tier-independent for the same reason; see
// shieldContact.js.) The only tier read here is WHERE the core is painted.
//
// ── REACTIONS ─────────────────────────────────────────────────────────────
// Events are presentation state, held per field in a short bounded list, so
// rapid hits layer as independent LOCAL reactions and the whole field never
// flashes. Each event stores its offset from the facing, so it stays on the
// surface while the shield turns.
//
//   BLOCK  CONTACT -> TRAVELLING WAVE -> CONVERSION -> SETTLE. The bolt
//          flattens into a red-hot smear and dents the surface; then TWO
//          waves leave the contact in opposite directions along the curve.
//          Each has TWO SCALES: a narrow saturated-red CREST (direction and
//          speed) inside a broad soft PRESSURE ENVELOPE — the same energy,
//          softened toward white, denser frost — that FLEXES the membrane
//          outward by up to 4px (a cell) as it passes and lets it go behind.
//          A crest alone read as a narrow bar sliding along the band; the
//          envelope and the flex are what make it a wave travelling THROUGH a
//          surface. Behind it the WAKE takes its colour from the time since the
//          crest went by — red -> coral -> pink -> white — and thins toward the
//          outer edge as it ages, so it tapers instead of filling the band like
//          a slab. The crest cools as it slows and dies about two thirds of the
//          way to the tips. RED = energy still in the field; WHITE = absorbed.
//   TEAR   (a Super through the front) contact -> white bloom -> the field
//          splits and its edges peel outward -> the gap holds -> the edges
//          pull in while white-blue filaments re-knit across it -> the last of
//          the gap zips shut -> a compact snap -> two PALE recovery crests run
//          out from the healed seam on the block's own wave engine and in its
//          grammar (pale crest, soft envelope, a smaller flex), and one
//          restrained projector pulse. PUNCTURE -> OPEN -> HEAL. No red.
//   PRICK  every other pellet of the same Super: a small bloom and a pinhole
//          that heals on its own. One readable hole per volley, not five.

import Phaser from 'phaser';
import { CURTAIN_RADIUS } from './shieldContact.js';
import { BULWARK_CORE } from './rosterPaint.js';

export const CURTAIN = {
  cell: 4,                        // the field's pixel: the roster's own (sprites are painted at 4x)
  taperRad: 0.32,                 // the last stretch of each end narrows to the tip
  outR: 6, inR: 11,               // the band: from 11px inside the curtain radius to 6px outside it, flat
  minPx: 6, thinPx: 8,            // the taper never thins below 6px, and under 8px it is all rim: every tip ENDS on bright cells
  split: 0.5,                     // the two hard bands meet here (from the outer edge)
  // the three value MASSES: [outer-band colour, outer alpha, inner-band colour, inner alpha]
  face:     [0xe9f5ff, 0.52, 0xd3e9ff, 0.36],
  shoulder: [0xc4e2ff, 0.50, 0xadd5fb, 0.34],
  tip:      [0xa3ccf6, 0.54, 0x92c0ea, 0.38],
  rim: 0xf2f9ff, rimA: 0.86,              // the OUTER edge: one cell of bright ice-white
  lowRim: 0xe2f0ff, lowRimA: 0.40,        // the inner edge: a soft row
  key: 0x13223a, keyA: 0.66,              // the dark-navy keyline outside the rim (the roster's outline)
  scanA: 0.09, scanMs: 3400, scanStepMs: 32, // the stepped current pulse
  bushMul: 0.55,
  behindSin: 0.5,                 // a REACTION is behind him only past 30deg north of his centre line (see _layer)
  maxBlocks: 12, maxPricks: 3,
  // the absorption wave (arc px / ms). TWO SCALES: a narrow bright CREST
  // inside a broader soft PRESSURE ENVELOPE (steeper ahead of the crest,
  // longer behind it), which densifies and brightens the frost and FLEXES the
  // membrane outward as it passes, returning behind it.
  wavePx: 42, waveMs: 420, crestPx: 4.0, wakeMs: 170,
  envAheadPx: 6, envBehindPx: 11,
  envI: 0.45, envWhite: 0.6,      // the envelope's own light: the crest's colour, softened toward white
  pressA: 0.30, pressCol: 0xfff6f4, pressMix: 0.6,
  flexPx: 4, flexMax: 4,
  // the Super's recovery wave after the snap: the same grammar, pale
  healPx: 34, healMs: 340, healFlexPx: 2.4,
};

// the energy colours a blocked bolt passes through on its way to absorbed
const RED = 0xff2828, CORAL = 0xff7a5c, PINK = 0xffc4cc, WHITE = 0xffffff;
const RAMP = [[0, RED], [0.22, RED], [0.42, CORAL], [0.65, PINK], [0.88, WHITE], [1, WHITE]];
const HEAL = 0xdff0ff;            // the Super's white-blue

export const BLOCK_MS = 720, PRICK_MS = 260;
// The tear's beats (ms from contact). Long enough on purpose: a real Super
// arrives with the frozen generic hit language on top of it (the body's white
// hit flash, the pellet impact rings, CRIT numbers), which owns roughly the
// first 250ms. The OPEN gap has to still be there when that clears, or the
// player never sees the field heal. The beats up to the snap are the approved
// ones; only the recovery tail after it is longer, for the recovery crests.
export const TEAR = { open: 80, hold: 420, zip: 540, close: 600, snapEnd: 690, gapPx: 13, gapPerPellet: 3, gapMaxPx: 18 };
TEAR.ripEnd = TEAR.close + CURTAIN.healMs + 150;
export const TEAR_MS = TEAR.ripEnd + 20;

// WEAPON < SHIELD: everything the sidearm draws sits a fixed step above the
// weapon overlay's own depth, and the field cells it crosses sit above all of
// it. The near layer (y + 2) is above the whole stack, since the overlay is
// never deeper than y + 1.
export const WEAPON_STACK = { pip: 0.1, discharge: 0.2, shield: 0.3, light: 0.4 };

const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
function lerpCol(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((ar + (br - ar) * t) << 16) | ((ag + (bg - ag) * t) << 8) | (ab + (bb - ab) * t);
}
export function rampColor(u) {
  if (u >= 1) return WHITE;
  for (let i = 1; i < RAMP.length; i++) {
    if (u <= RAMP[i][0]) { const [u0, c0] = RAMP[i - 1], [u1, c1] = RAMP[i]; return lerpCol(c0, c1, (u - u0) / (u1 - u0 || 1)) & 0xffffff; }
  }
  return WHITE;
}

/**
 * ONE WAVE ENGINE for the block's crests and the Super's recovery crests.
 * At arc distance `d` (px) from the source, `t` ms after it: the crest has
 * travelled s(t) = S * (1.5u - 0.5u^2), u = t / T — out of the contact at
 * speed and easing off, but still visibly moving through its whole life (a
 * plain ease-out put 75% of the travel in the first 45% and then crawled).
 *
 * A wave has TWO SCALES. The CREST is narrow and bright: it carries the
 * direction and the speed. Around it the ENVELOPE is broad and soft — the
 * pressure the crest is the peak of — steeper ahead (`envA`) than behind
 * (`envB`), so the front arrives and the swell trails off. A crest alone read
 * as a coloured stripe sliding along the band; the envelope is what makes it
 * a wave travelling THROUGH the surface. Behind it the WAKE fades with the
 * time since the crest passed (`tau`), which is also what its colour is read
 * from.
 * Writes { crest, env, wake, tau, u } into `out` (u = the crest's own progress
 * 0..1) and returns it — no allocation, it runs per bin per event per frame.
 */
const _WAVE = { crest: 0, env: 0, wake: 0, tau: 0, u: 0 };
export function waveAt(d, t, S, T, crestPx, wakeMs, out = _WAVE, envA = CURTAIN.envAheadPx, envB = CURTAIN.envBehindPx) {
  const u = Math.min(1, t / T), s = S * (1.5 * u - 0.5 * u * u);
  const A = t < T ? 1 - 0.45 * u : Math.max(0, 0.55 * (1 - (t - T) / 140));
  const x = d - s;
  out.crest = x > 4 * crestPx ? 0 : A * gauss(x, crestPx);
  out.env = x > 4 * envA ? 0 : A * gauss(x, x > 0 ? envA : envB);
  out.wake = 0; out.tau = 0; out.u = u;
  if (d < s) {
    const up = 1.5 - Math.sqrt(Math.max(0, 2.25 - 2 * d / S));     // the inverse of s(t)
    out.tau = Math.max(0, t - up * T);
    out.wake = 0.72 * Math.exp(-out.tau / wakeMs);
  }
  return out;
}

// the energy accumulators: intensities sum, colours mix by intensity squared
// (one for the crest / contact / tear energy, one for the wake)
const _ACC = { sum: 0, r: 0, g: 0, b: 0, w: 0 };
const _ACW = { sum: 0, r: 0, g: 0, b: 0, w: 0 };
const mixed = (A) => (A.w > 1e-6 ? (Math.round(A.r / A.w) << 16) | (Math.round(A.g / A.w) << 8) | Math.round(A.b / A.w) : WHITE);
function mixInto(A, I, c) {
  if (I <= 0.002) return;
  const w = I * I;
  A.r += ((c >> 16) & 255) * w; A.g += ((c >> 8) & 255) * w; A.b += (c & 255) * w; A.w += w; A.sum += I;
}

// The legacy block drew `fx.healingSparkle(x, y, 6)`, a particle emission that
// draws from `Math.random` — the same stream the AI's cooldowns draw from. If
// the v1 field simply skipped it, every Bulwark block would shift every random
// number after it and v1 would no longer be the same fight as legacy. So the
// v1 path performs the IDENTICAL emission into an invisible twin of that
// emitter (built from the live emitter's own config, so the two cannot drift),
// and nothing is drawn. `smoke-bulwark` holds the draw count equal.
export const LEGACY_BLOCK_SPARKS = 6;

/** Scene-level: the per-field tick, and the RNG-parity twin. */
export function attachBulwarkCurtains(scene) {
  const fields = (scene.__blwFields = new Set());
  let twin = null;
  scene.__blwParity = (x, y, n) => {
    if (!twin) {
      const src = scene.fx?.sparksBlue;
      if (!src) return;
      twin = scene.add.particles(0, 0, src.texture.key, src.config).setVisible(false);
    }
    twin.emitParticleAt(x, y, n);
  };
  const tick = (time, delta) => { for (const f of fields) if (f.tick(delta)) fields.delete(f); };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick);
    fields.clear();
    twin?.destroy(); twin = null;
    scene.__blwParity = null;
  });
}

/** Per-bearer: seven Graphics on the bearer's own attachment list. */
export function makeBulwarkCurtain(e) {
  const scene = e.scene;
  // the surface is NORMAL-blended (frosted material: it can hide what is
  // behind it); everything that is LIGHT — the bloom, the filaments, the snap,
  // the projector core — is ADD, so it reads as light and not as grey paint
  const add = (mode) => { const g = scene.add.graphics(); if (mode) g.setBlendMode(mode); return g; };
  const L = {
    far: add(), farW: add(), near: add(),
    glowFar: add(Phaser.BlendModes.ADD), glowFarW: add(Phaser.BlendModes.ADD), glowNear: add(Phaser.BlendModes.ADD),
  };
  const core = add(Phaser.BlendModes.ADD);
  e._attachments.push(...Object.values(L), core);   // die() and room clear destroy them with the body
  // ONE AUTHOR: the frozen class still draws its stroked arc every frame; it is
  // simply never shown while this field speaks for the shield.
  e.shieldArc?.setVisible(false);
  const f = new CurtainField(e, L, core);
  scene.__blwFields?.add(f);
  return f;
}

// The sidearm overlay's opaque footprint across its own axis, read once per
// texture from the painted canvas: the widest the gun is either side of the
// bore row, flipped or not, in texture pixels. Conservative by construction
// (the whole gun, forearm included), so no gun pixel can escape the strip.
const _gunHalf = new Map();
function gunHalfWidth(ws) {
  const key = ws.texture.key;
  if (!_gunHalf.has(key)) {
    let hw = ws.height / 2;
    try {
      const src = ws.texture.getSourceImage();
      const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      const x = c.getContext('2d'); x.drawImage(src, 0, 0);
      const px = x.getImageData(0, 0, c.width, c.height).data;
      let lo = Infinity, hi = -Infinity;
      for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (px[(y * c.width + xx) * 4 + 3] > 0) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
      // either way up: `flipY` mirrors the rows within the frame while the
      // origin stays put, so the flipped gun can be wider on one side
      if (hi >= lo) { const oy = ws.originY * ws.height, H = c.height; hw = Math.max(oy - lo, hi + 1 - oy, oy - (H - 1 - hi), H - lo - oy); }
    } catch { /* keep the whole canvas height: conservative */ }
    _gunHalf.set(key, hw);
  }
  return _gunHalf.get(key) * Math.abs(ws.scaleY) + 1;
}

class CurtainField {
  constructor(e, L, core) {
    this.e = e; this.L = L; this.coreG = core;
    // the named layers, for tests and rigs
    this.near = L.near; this.far = L.far; this.farW = L.farW;
    this.glowNear = L.glowNear; this.glowFar = L.glowFar; this.glowFarW = L.glowFarW;
    this.clock = 0;
    this.events = [];
    this.coreKick = 0; this.corePulse = 0;
    this.stats = { blocks: 0, pierces: 0, tears: 0, merged: 0, pricks: 0 };
    this._gun = null;
    this._cand = null;        // the candidate cells, computed once (see _candidates)
    this._record = false;     // tests and rigs: keep a list of the cells drawn this frame (this._cells)
    this._sig = null; this._dirty = false;
    this._qb = new Float32Array(8);
  }

  // ── the seam ─────────────────────────────────────────────────────────────
  /** A blocked bolt. `contact` is the projected crossing; x/y is the bolt. */
  block(contact, x, y) {
    this.e.scene.__blwParity?.(x, y, LEGACY_BLOCK_SPARKS);
    this.stats.blocks++;
    const blocks = this.events.filter((v) => v.kind === 'block');
    if (blocks.length >= CURTAIN.maxBlocks) this.events.splice(this.events.indexOf(blocks[0]), 1);
    this.events.push({ kind: 'block', off: contact?.off ?? 0, t: 0 });
    this.coreKick = Math.max(this.coreKick, 0.6);
  }

  /**
   * A Super pellet through the front. The first of a volley opens THE tear;
   * a pellet arriving while it is still opening and close to it widens that
   * one hole (bounded); any other pellet while a tear is live is a pinprick.
   */
  pierce(contact) {
    const off = contact?.off ?? 0;
    this.stats.pierces++;
    const tear = this.events.find((v) => v.kind === 'tear' && v.t < TEAR.close);
    if (tear && tear.t < 120 && Math.abs(tear.off - off) < 0.3) { tear.n = Math.min(3, tear.n + 1); this.stats.merged++; return; }
    // a volley's pellets cross the body over a frame or two, and the FIRST to
    // arrive is often an outer one: while the tear is still opening, a more
    // CENTRAL pellet takes the hole and the outer one becomes its pinprick —
    // the one readable penetration sits where the volley actually went through
    if (tear && tear.t < 50 && Math.abs(off) < Math.abs(tear.off)) {
      if (this.events.filter((v) => v.kind === 'prick').length < CURTAIN.maxPricks) { this.events.push({ kind: 'prick', off: tear.off, t: tear.t }); this.stats.pricks++; }
      tear.off = off;
      return;
    }
    if (tear) {
      if (this.events.filter((v) => v.kind === 'prick').length < CURTAIN.maxPricks) { this.events.push({ kind: 'prick', off, t: 0 }); this.stats.pricks++; }
      return;
    }
    this.events.push({ kind: 'tear', off, t: 0, n: 1, snapped: false });
    this.stats.tears++;
  }

  /** Active presentation events, for tests and the evidence rigs (read-only). */
  snapshot() { return this.events.map((v) => ({ ...v })); }

  // ── per frame ────────────────────────────────────────────────────────────
  tick(delta) {
    const e = this.e;
    if (!this.near.active || !e.active) return true;
    if (!e.alive) { for (const g of [...Object.values(this.L), this.coreG]) g.clear(); this._sig = null; return false; }
    this.clock += delta;
    for (let i = this.events.length - 1; i >= 0; i--) {
      const v = this.events[i];
      v.t += delta;
      if (v.kind === 'tear' && !v.snapped && v.t >= TEAR.close) { v.snapped = true; this.corePulse = 1; }
      const life = v.kind === 'block' ? BLOCK_MS : v.kind === 'tear' ? TEAR_MS : PRICK_MS;
      if (v.t >= life) this.events.splice(i, 1);
    }
    this.coreKick *= Math.exp(-delta / 110);
    this.corePulse = Math.max(0, this.corePulse - delta / 200);
    this.draw();
    return false;
  }

  // gap half-width (rad) and peel envelope of a tear / prick at age t
  _gap(v) {
    const t = v.t, R = CURTAIN_RADIUS;
    if (v.kind === 'prick') {
      const G = 4 / R;
      if (t < 40) return G * (t / 40);
      if (t < 120) return G;
      if (t < 200) return G * (1 - (t - 120) / 80);
      return 0;
    }
    const G = Math.min(TEAR.gapMaxPx, TEAR.gapPx + TEAR.gapPerPellet * (v.n - 1)) / R;
    if (t < TEAR.open) { const u = t / TEAR.open; return G * (1 - (1 - u) ** 3); }
    if (t < TEAR.hold) return G;
    if (t < TEAR.close) { const u = (t - TEAR.hold) / (TEAR.close - TEAR.hold); return G * (1 - (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2)); }
    return 0;
  }
  _peelEnv(v) {
    const t = v.t;
    if (v.kind === 'prick') return t < 40 ? t / 40 : t < 200 ? 1 - (t - 40) / 160 : 0;
    if (t < TEAR.open) return t / TEAR.open;
    if (t < TEAR.hold) return 1 - 0.4 * ((t - TEAR.open) / (TEAR.hold - TEAR.open));
    if (t < TEAR.close) return 0.6 * (1 - (t - TEAR.hold) / (TEAR.close - TEAR.hold));
    return 0;
  }

  // The sidearm's footprint this frame, in the bearer's frame: its axis (the
  // overlay's own rotation), the stretch of that axis it covers, and its half
  // width across it. Null when no gun is drawn.
  _gunStrip(fac) {
    const e = this.e, ws = e.weaponSprite;
    if (!ws?.active || !ws.visible || ws.alpha <= 0) return null;
    const rot = ws.rotation, dx = Math.cos(rot), dy = Math.sin(rot);
    // where Enemy.preUpdate puts the overlay: (radius - 4) out along the aim
    const off = (e.cfg?.radius ?? 24) - 4;
    const dw = ws.displayWidth;
    return { wx: dx * off, wy: dy * off, dx, dy, a0: -ws.originX * dw - 2, a1: (1 - ws.originX) * dw + 2, hw: gunHalfWidth(ws) + 1 };
  }
  // four corners into the reusable buffer (no per-cell allocation)
  _quadBuf(x0, y0, x1, y1, x2, y2, x3, y3) {
    const b = this._qb; b[0] = x0; b[1] = y0; b[2] = x1; b[3] = y1; b[4] = x2; b[5] = y2; b[6] = x3; b[7] = y3;
    return b;
  }
  // does a polygon (flat [x0, y0, x1, y1, ...]) reach into the gun's footprint?
  _onGun(pts) {
    const G = this._gun;
    if (!G) return false;
    let lmin = Infinity, lmax = -Infinity, amin = Infinity, amax = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      const px = pts[i] - G.wx, py = pts[i + 1] - G.wy;
      const along = px * G.dx + py * G.dy, lat = py * G.dx - px * G.dy;
      if (lat < lmin) lmin = lat; if (lat > lmax) lmax = lat;
      if (along < amin) amin = along; if (along > amax) amax = along;
    }
    return lmin <= G.hw && lmax >= -G.hw && amin <= G.a1 && amax >= G.a0;
  }

  // DEPTH ROUTING — the one place near / far is decided. South of his centre
  // (screen y below him) is NEAR: drawn over the body. North is FAR: drawn
  // under it — unless the piece lies on the sidearm's footprint, where it goes
  // to `farW`, above the weapon. The return value is a layer, never a strength.
  //
  // A REACTION is a point, not a band, and it goes FAR only when it is BEHIND
  // him — more than 30deg north of his centre line (`behindSin`). Side-on, a
  // contact on the facing sits at his own depth, beside him; split at the
  // centre line, a hit a hair north of it was drawn under the gun and a hair
  // south over it (measured: 0.89 against 0.12 of the south view on a tear's
  // last beats). The panels keep the plain split — their depth is what puts
  // him inside the field.
  _layer(a, light = false, event = false, pts = null, dy = null) {
    // a cell knows its own offset below his centre exactly (never zero: cell
    // centres sit on half steps); anything else is decided by its bearing
    const isNear = dy != null ? dy > 0 : Math.sin(a) >= (event ? -CURTAIN.behindSin : 0);
    const L = this.L;
    if (isNear) return light ? L.glowNear : L.near;
    const onGun = pts ? this._onGun(pts) : false;
    return light ? (onGun ? L.glowFarW : L.glowFar) : (onGun ? L.farW : L.far);
  }

  // ── THE CELLS ─────────────────────────────────────────────────────────────
  // The field is built from the game's own pixel: a 4px CELL (`CURTAIN.cell`)
  // on the SCREEN-ALIGNED grid anchored at the bearer's centre — the grid his
  // own sprite is painted on (its pixels are 4px steps from his centre), so
  // the field's pixels and his always line up, however he moves. The crescent
  // is a clean pixel-art shape at any facing and is re-rasterised as he turns,
  // as any rotating pixel object is. (Cells on a grid that TURNED with the
  // facing were tried first: at the diagonals the rotated squares serrate the
  // curved edge into a saw-toothed fringe, which reads as noise at 1x.)
  //
  // Candidates are computed once: every cell in the annulus the band, its
  // keyline or a peeled edge could ever reach, with its distance from his
  // centre and its absolute bearing; per frame a cell's place on the arc is
  // just that bearing minus the facing.
  _candidates() {
    if (this._cand) return this._cand;
    const C = CURTAIN, P = C.cell, R = CURTAIN_RADIUS;
    const rMin = R - C.inR - 8, rMax = R + C.outR + P + 10;
    const out = [];
    const n = Math.ceil(rMax / P) + 1;
    for (let b = -n; b < n; b++) {          // row by row, so a run of equal cells in a row merges into one rect
      for (let a = -n; a < n; a++) {
        const x = (a + 0.5) * P, y = (b + 0.5) * P, r = Math.hypot(x, y);
        if (r < rMin || r > rMax) continue;
        out.push({ a, b, x, y, r, phi: Math.atan2(y, x), th: 0, kind: '' });
      }
    }
    return (this._cand = out);
  }

  draw() {
    const e = this.e, C = CURTAIN, R = CURTAIN_RADIUS, L = this.L, P = C.cell;
    const cx = e.x, cy = e.y, half = e._shieldHalfArc;
    let fac = e._shieldFacing;
    fac = Math.atan2(Math.sin(fac), Math.cos(fac));
    const mul = e.hiddenInBush ? C.bushMul : 1;
    const ws = e.weaponSprite, wd = ws?.active ? ws.depth : e.y + 1;
    // Every layer is drawn in the BEARER'S frame and carried by its position:
    // a field that only walks is never redrawn.
    for (const g of Object.values(L)) g.setPosition(cx, cy);
    L.near.setDepth(e.y + 2); L.far.setDepth(e.y - 2); L.farW.setDepth(wd + WEAPON_STACK.shield);
    L.glowNear.setDepth(e.y + 3); L.glowFar.setDepth(e.y - 1.5); L.glowFarW.setDepth(wd + WEAPON_STACK.light);
    const ev = this.events;

    // the stepped current pulse: one column of cells, stepping tip to tip
    const colAng = P / R, cols = Math.ceil((2 * half) / colAng);
    const scanIdx = Math.floor((this.clock % C.scanMs) / C.scanStepMs);
    const scanCol = scanIdx < cols ? ((Math.floor(this.clock / C.scanMs) % 2) ? cols - 1 - scanIdx : scanIdx) : -1;
    const scanTh = scanCol >= 0 ? -half + (scanCol + 0.5) * colAng : null;

    // Nothing that shapes the field changed and nothing is reacting: keep last
    // frame's cells (they moved with him above).
    const gunVis = !!(ws?.active && ws.visible && ws.alpha > 0);
    const sig = `${Math.round(fac * 1e4)}|${scanCol}|${mul}|${Math.round(wd - e.y)}|${gunVis}|${this._record}`;
    if (!ev.length && !this._dirty && sig === this._sig) { this._drawCore(mul); return; }
    this._sig = sig; this._dirty = ev.length > 0;     // the frame after the last reaction must redraw clean
    for (const g of Object.values(L)) g.clear();
    this._gun = this._gunStrip(fac);
    const rec = this._record ? (this._cells = []) : null;

    // the tear's per-event shape this frame
    const holes = [];
    for (const v of ev) if (v.kind !== 'block') holes.push({ v, g: this._gap(v), pe: this._peelEnv(v) });

    // Everything that depends only on the bearing is computed once per thin
    // angular BIN (0.03 rad: 1.6px at the rim, under half a cell) rather than
    // per cell.
    // The bins are centred ON the facing and mirror about it, so two hits the
    // same distance either side of the apex sample identical bins.
    const H = half + 0.25, BIN = 0.03, K = Math.ceil(H / BIN), NB = 2 * K + 1;
    if (!this._bins || this._bins.n !== NB) this._bins = { n: NB, stamp: new Int32Array(NB).fill(-1), w: new Float32Array(NB), d: new Float32Array(NB), I: new Float32Array(NB), c: new Int32Array(NB), wI: new Float32Array(NB), wc: new Int32Array(NB), wt: new Float32Array(NB), P: new Float32Array(NB), hole: new Int8Array(NB) };
    const B = this._bins, stamp = (this._stamp = (this._stamp || 0) + 1);
    const bin = (th) => {
      const j = Math.round(Math.abs(th) / BIN), i = Math.max(0, Math.min(NB - 1, K + (th < 0 ? -j : j)));
      if (B.stamp[i] === stamp) return i;
      B.stamp[i] = stamp;
      const tb = (i - K) * BIN;
      B.w[i] = Math.pow(clamp01((half - Math.abs(tb)) / C.taperRad), 0.75);
      let d = 0, hole = -1;
      for (const v of ev) {
        if (v.kind !== 'block') continue;
        const t = v.t, env = t < 35 ? t / 35 : Math.exp(-(t - 35) / 65);
        d -= 5 * env * gauss(tb - v.off, 0.09);              // the contact's dent (inward)
      }
      for (let h = 0; h < holes.length; h++) {
        const { v, g, pe } = holes[h], dd = Math.abs(tb - v.off) - g, W = 0.16;
        if (dd < 0 && hole < 0) hole = h;
        if (dd > 0 && dd < W && pe > 0) d += (v.kind === 'prick' ? 2 : 7) * pe * (1 - dd / W);   // a peeling edge (outward)
      }
      B.hole[i] = hole;
      if (ev.length) {
        this._energy(tb, ev);
        B.I[i] = this._eI; B.c[i] = this._eC; B.wI[i] = this._wI; B.wc[i] = this._wC; B.wt[i] = this._wT; B.P[i] = this._eP;
        d += this._eF;                                   // the membrane flexing as the pressure passes
      } else { B.I[i] = 0; B.c[i] = WHITE; B.wI[i] = 0; B.P[i] = 0; }
      B.d[i] = d;
      return i;
    };

    // Runs of identical cells along a row are merged into one rect.
    let run = null;
    const flush = () => {
      if (!run) return;
      run.g.fillStyle(run.col, run.alpha);
      run.g.fillRect(run.a0 * P, run.b * P, (run.a1 - run.a0 + 1) * P, P);
      run = null;
    };
    const cell = (c, col, alpha, light = false) => {
      const x0 = c.a * P, y0 = c.b * P;
      const g = this._layer(fac + c.th, light, false, this._quadBuf(x0, y0, x0 + P, y0, x0 + P, y0 + P, x0, y0 + P), c.y);
      if (run && run.g === g && run.b === c.b && run.a1 === c.a - 1 && run.col === col && run.alpha === alpha) run.a1 = c.a;
      else { flush(); run = { g, b: c.b, a0: c.a, a1: c.a, col, alpha }; }
      if (rec) rec.push({ kind: c.kind, x: cx + x0 + P / 2, y: cy + y0 + P / 2, q: [cx + x0, cy + y0, cx + x0 + P, cy + y0, cx + x0 + P, cy + y0 + P, cx + x0, cy + y0 + P], col, a: alpha, th: c.th, layer: Object.keys(L).find((k) => L[k] === g) });
    };

    for (const c of this._candidates()) {
      let th = c.phi - fac;
      if (th > Math.PI) th -= 2 * Math.PI; else if (th <= -Math.PI) th += 2 * Math.PI;
      c.th = th;
      if (th > H || th < -H) continue;
      const i = bin(th), w = B.w[i], d = B.d[i];
      let rOut = R + C.outR * w + d, rIn = R - C.inR * w + d;
      if (rOut - rIn < C.minPx) { const mid = (rOut + rIn) / 2; rOut = mid + C.minPx / 2; rIn = mid - C.minPx / 2; }
      const inArc = Math.abs(th) <= half;
      const hole = B.hole[i] >= 0 ? holes[B.hole[i]] : null;
      const inBand = inArc && w > 0 && c.r >= rIn && c.r <= rOut;
      if (!inBand) {
        // THE KEYLINE: one cell of dark navy outside the outer edge, and a cap
        // beyond each tip — the field's outline, as every sprite has one
        const outer = inArc && c.r > rOut && c.r <= rOut + P;
        const cap = !inArc && Math.abs(th) <= half + (1.2 * P) / c.r && Math.abs(c.r - R) <= P;
        if ((outer || cap) && !hole) { c.kind = 'key'; cell(c, C.key, C.keyA * mul); }
        continue;
      }
      // which mass, which band
      const q = Math.abs(th) / half;
      const m = q < 0.25 ? C.face : q < 0.75 ? C.shoulder : C.tip;
      const f = rOut - rIn > 0 ? (rOut - c.r) / (rOut - rIn) : 0;
      const rim = c.r > rOut - P || rOut - rIn < C.thinPx, edge = !rim && c.r < rIn + P * 0.75;
      if (hole) { this._holeCell(c, hole, f, rim, cell, mul); continue; }

      // the crest / contact energy, and the WAKE behind it — which thins
      // toward the outer (energy) edge as it ages, so it tapers off behind the
      // crest instead of filling the band's whole thickness like a slab
      let I = B.I[i], ec = B.c[i];
      const wI = B.wI[i];
      if (wI > 0.002) {
        const Iw = wI * clamp01(1.2 - f * (0.55 + B.wt[i] / 220));
        if (Iw > 0.002) { const a2 = I * I, b2 = Iw * Iw; ec = lerpCol(ec, B.wc[i], b2 / (a2 + b2)); I = Math.min(1, I + Iw); }
      }
      // the PRESSURE envelope: denser, brighter frost where the wave is
      const pr = B.P[i];
      const tint = Math.min(1, I * 1.25);
      const scan = scanTh != null && Math.abs(th - scanTh) < colAng / 2 ? C.scanA : 0;
      const press = (base) => (pr > 0.01 ? lerpCol(base, C.pressCol, Math.min(1, pr * C.pressMix)) : base);
      let col, alpha;
      if (rim) {
        c.kind = 'rim';
        col = I > 0.01 ? lerpCol(C.rim, ec, Math.min(1, I * 1.1)) : C.rim;
        alpha = Math.min(1, (C.rimA + pr * 0.1) * mul);
      } else if (edge) {
        c.kind = 'edge';
        col = I > 0.01 ? lerpCol(press(C.lowRim), ec, Math.min(1, I)) : press(C.lowRim);
        alpha = Math.min(0.92, (C.lowRimA + scan + I * 0.4 + pr * C.pressA) * mul);
      } else if (f < C.split) {
        c.kind = 'outer';
        col = I > 0.01 ? lerpCol(press(m[0]), ec, tint) : press(m[0]);
        alpha = Math.min(0.92, (m[1] + scan + I * 0.55 + pr * C.pressA) * mul);
      } else {
        c.kind = 'inner';
        col = I > 0.01 ? lerpCol(press(m[2]), ec, tint) : press(m[2]);
        alpha = Math.min(0.92, (m[3] + scan * 0.7 + I * 0.5 + pr * C.pressA) * mul);
      }
      cell(c, col, alpha);
    }
    flush();

    // ── per-event LIGHT (blooms): soft, because it is light, not material ──
    for (const v of ev) this._overlay(v, 0, 0, fac, mul);
    this._drawCore(mul);
  }

  // A cell inside a tear's or prick's hole. Empty while it is open; the
  // re-knit draws stitches across it, the zipper fills it from the outer rim
  // inward, the snap flashes the seam — all in cells.
  _holeCell(c, h, f, rim, cell, mul) {
    const v = h.v, t = v.t;
    if (v.kind !== 'tear') return;
    const colIdx = Math.round((c.th - v.off) * CURTAIN_RADIUS / CURTAIN.cell);
    if (t >= TEAR.hold && t < TEAR.close) {
      const zip = t >= TEAR.zip ? (t - TEAR.zip) / (TEAR.close - TEAR.zip) : 0;
      if (zip > 0 && f <= zip) { c.kind = 'zip'; cell(c, HEAL, 0.6 * mul); return; }
      // stitches: every other cell, stepping (electronics, not a breathing glow)
      if ((colIdx + Math.round(f * 3) + Math.floor(t / 45)) % 2 === 0 && !rim) { c.kind = 'stitch'; cell(c, Math.round(f * 3) === 1 ? 0xffffff : HEAL, 0.85 * mul, true); }
    }
  }

  // Everything the live events say at bearing th, all events mixed
  // (intensities sum; colours mix by intensity squared), in four channels:
  //   _eI / _eC   the crest, the contact smear and the tear's own light
  //   _wI / _wC / _wT   the WAKE behind the crests, and its age (tau)
  //   _eP         the PRESSURE envelope (denser, brighter frost)
  //   _eF         the membrane FLEX in px, outward, riding the envelope
  // It runs once per bin per frame while anything is reacting.
  _energy(th, ev) {
    const C = CURTAIN, R = CURTAIN_RADIUS, W = _WAVE, A = _ACC, K = _ACW;
    A.sum = 0; A.r = 0; A.g = 0; A.b = 0; A.w = 0;
    K.sum = 0; K.r = 0; K.g = 0; K.b = 0; K.w = 0;
    let P = 0, F = 0, wt = 0;
    for (let k = 0; k < ev.length; k++) {
      const v = ev[k], dm = th - v.off, t = v.t, d = Math.abs(dm) * R;
      if (v.kind === 'block') {
        if (d > C.wavePx + 4 * C.envAheadPx && d > 17) continue;       // beyond anything this event can reach
        waveAt(d, t, C.wavePx, C.waveMs, C.crestPx, C.wakeMs, W);
        // the bolt dies INTO the surface: a short red-hot smear on contact,
        // white-hot at its heart for the first beats
        if (t < 130) {
          const ell = 8 + 9 * Math.min(1, t / 70);
          if (d < ell) mixInto(A, 1 - t / 130, t < 85 && d < 4 ? 0xfff1e6 : RED);
        }
        const cc = rampColor(0.1 + 0.42 * W.u);
        mixInto(A, Math.min(1, W.crest), cc);                           // the crest: saturated red, cooling as it slows
        mixInto(A, C.envI * W.env, lerpCol(cc, WHITE, C.envWhite));     // the swell around it: the same energy, softer
        mixInto(K, W.wake, rampColor(0.3 + W.tau / 300));               // the wake: red -> coral -> pink -> white
        wt += W.wake * W.tau;
        P += W.env;
        // the flex comes in after the contact's own dent, then rides the wave
        F += C.flexPx * W.env * Math.min(1, t / 70);
      } else {
        const g = this._gap(v), edge = Math.max(0, Math.abs(dm) - g);
        if (v.kind === 'tear') {
          if (t < TEAR.close) mixInto(A, 0.9 * gauss(edge, 0.05) * (0.8 + 0.2 * ((Math.floor(t / 45) % 2))), HEAL);
          if (t < 140) mixInto(A, (1 - t / 140) * gauss(dm, 0.12), HEAL);
          if (t >= TEAR.close) {
            if (t < TEAR.snapEnd && d < CURTAIN.cell) mixInto(A, 1 - (t - TEAR.close) / (TEAR.snapEnd - TEAR.close), WHITE);   // the SNAP: the seam itself
            // RECOVERY: pale waves run out from the healed seam on the block's
            // own engine and in its grammar — a pale crest inside a soft
            // envelope that flexes the membrane as it passes — the field
            // re-stabilising, not a second explosion. No red.
            if (d <= C.healPx + 4 * C.envAheadPx) {
              waveAt(d, t - TEAR.close, C.healPx, C.healMs, C.crestPx, 120, W);
              mixInto(A, 0.9 * W.crest, WHITE);
              mixInto(A, 0.8 * C.envI * W.env, HEAL);
              mixInto(K, 0.75 * W.wake, lerpCol(WHITE, HEAL, Math.min(1, W.tau / 160)));
              wt += 0.75 * W.wake * W.tau;
              P += 0.8 * W.env;
              F += C.healFlexPx * W.env;
            }
          }
        } else {
          mixInto(A, (t < 200 ? 0.7 : 0) * gauss(edge, 0.04), HEAL);
        }
      }
    }
    this._eI = Math.min(1, A.sum); this._eC = mixed(A);
    this._wI = Math.min(1, K.sum); this._wC = mixed(K); this._wT = K.sum > 1e-6 ? wt / K.sum : 0;
    this._eP = Math.min(1, P);
    this._eF = Math.min(C.flexMax, F);
  }

  // a point on the field at relative angle r, at the curtain radius (+dR)
  _pt(cx, cy, fac, r, dR = 0) {
    const a = fac + r, R = CURTAIN_RADIUS + dR;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  }

  // per-event LIGHT: the contact bloom of a tear or a prick, and the snap's
  // glow. Soft, because it is light; the material is all cells.
  _overlay(v, cx, cy, fac, mul) {
    const t = v.t;
    if (v.kind === 'block') return;
    const [px, py] = this._pt(cx, cy, fac, v.off);
    const box = this._quadBuf(px - 14, py - 14, px + 14, py - 14, px + 14, py + 14, px - 14, py + 14);
    const L = this._layer(fac + v.off, true, true, box);
    const m = mul;
    if (v.kind === 'prick') {
      if (t < 90) { const u = t / 90; L.fillStyle(0xffffff, 0.8 * (1 - u) * m); L.fillCircle(px, py, 3 + 5 * u); }
      if (t >= 200 && t < 250) { L.fillStyle(0xffffff, (1 - (t - 200) / 50) * m); L.fillCircle(px, py, 2.5); }
      return;
    }
    if (t < 140) {                                   // white bloom, largest faintest
      const u = t / 140;
      L.fillStyle(HEAL, 0.4 * (1 - u) * m); L.fillCircle(px, py, 8 + 16 * u);
      L.fillStyle(0xffffff, 0.7 * (1 - u) * m); L.fillCircle(px, py, 5 + 9 * u);
      if (t < 100) { L.fillStyle(0xffffff, (1 - t / 100) * m); L.fillCircle(px, py, 2 + 3 * u); }
    }
    if (t >= TEAR.close && t < TEAR.snapEnd) {        // the SNAP's glow: compact, bright, short
      const u = (t - TEAR.close) / (TEAR.snapEnd - TEAR.close);
      L.fillStyle(HEAL, 0.35 * (1 - u) * m); L.fillCircle(px, py, 9 - 2 * u);
    }
  }

  _drawCore(mul) {
    const e = this.e, g = this.coreG;
    g.clear();
    const key = e.anims?.currentAnim?.key || '';
    const dir = key.endsWith('-front') ? 'front' : key.endsWith('-back') ? 'back' : 'side';
    const a = BULWARK_CORE[e._elite ? 'elite' : 'regular'][dir];
    if (!a) return;
    const sx = (e.displayWidth / e.width) || 1, sy = (e.displayHeight / e.height) || 1;
    const x = e.x + (a[0] * 4 - e.width / 2) * sx * (e.flipX ? -1 : 1);
    const y = e.y + (a[1] * 4 - e.height / 2) * sy;
    g.setDepth(e.y + 0.5);
    const p = this.corePulse, k = this.coreKick;
    g.fillStyle(HEAL, (0.14 + 0.25 * k + 0.35 * p) * mul); g.fillCircle(x, y, 5 + 3 * p);
    g.fillStyle(0xffffff, (0.28 + 0.4 * k + 0.5 * p) * mul); g.fillCircle(x, y, 2.5);
  }
}
