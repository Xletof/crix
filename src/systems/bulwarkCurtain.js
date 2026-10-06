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
// ── THE SURFACE ───────────────────────────────────────────────────────────
// A curved band standing in front of the bearer, on EXACTLY the protected
// arc: facing ± `_shieldHalfArc`, tapering to a point at each end so the tips
// ARE the coverage. It is built from flat panels (hard light, not glass, not a
// bubble, not honeycomb): ten facets across the arc, each a slightly different
// milky value, with a bright ice-white OUTER rim (the face the fire arrives
// at), a soft inner rim toward the bearer, a restrained dark keyline just
// outside the bright rim so it holds against pale plate and pale floors, and
// two slow broad sheens running opposite ways across the facets (the
// interference). Its cross-section is a short, slightly raised band: the outer
// rim a little beyond the contact radius and just under the combat plane, the
// inner rim a little inside it and above — so from the front it is a
// substantial curved panel before his legs, from behind a thin softer band,
// and from the side a curved plane, never a vertical plate. (A first build put
// the bright rim on the INNER, upper edge and a taller band under it; from
// the front that read as a tub he was standing in.)
//
// DEPTH: every panel is routed by which side of the bearer it is on. Panels
// south of his centre (nearer the camera) draw ABOVE the body and the sidearm;
// panels north of it draw BELOW the body and at reduced strength — the softer
// far surface that keeps the rear view from becoming a canopy or a hood.
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
// rapid hits layer as independent LOCAL reactions — a fresh red smear next to
// a travelling front next to a pinking patch next to a whitening one — and the
// whole field never flashes. Each event stores its offset from the facing,
// so it stays on the surface while the shield turns.
//
//   BLOCK  red bolt -> compressed red-hot smear -> local dent -> red energy
//          propagating laterally -> coral -> pale pink -> white -> haze
//          relaxing to idle. RED = projectile energy still inside the field;
//          WHITE = absorbed. White is the END of the reaction.
//   TEAR   (a Super through the front) contact -> white bloom -> the field
//          splits and its edges peel outward -> the gap holds -> the edges
//          pull in while white-blue filaments re-knit across it -> the last of
//          the gap zips shut -> a compact snap -> a small recovery ripple and
//          one restrained projector pulse. PUNCTURE -> OPEN -> HEAL. No red.
//   PRICK  every other pellet of the same Super: a small bloom and a pinhole
//          that heals on its own. One readable hole per volley, not five.

import Phaser from 'phaser';
import { CURTAIN_RADIUS } from './shieldContact.js';
import { BULWARK_CORE } from './rosterPaint.js';

export const CURTAIN = {
  facets: 10, sub: 5,             // panels across the arc, samples per panel
  taperRad: 0.32,                 // the last stretch of each end narrows to the tip
  outR: 6, outH: 2,               // outer rim: radius +6, 2px below the combat plane
  inR: 6, inH: 5,                 // inner rim: radius -6, 5px above it
  split: 0.45,                    // the two milky sub-bands meet here (from the outer rim)
  frost: 0xcfe0f4, aLo: 0.30, aHi: 0.41,
  facetVar: [0, 0.05, -0.03],     // per-panel value step (broad faceting)
  rim: 0xffffff, rimA: 0.92, rimW: 2,   // the OUTER edge: bright ice-white
  lowRim: 0xe8f1ff, lowRimA: 0.38,      // the inner edge: soft
  key: 0x1b2940, keyA: 0.42,      // the restrained dark keyline just outside the rim
  seamA: 0.05,                    // panel seams
  sheenA: 0.07, sheen2A: 0.045,   // the two counter-running sheens (interference)
  farMul: 0.55,                   // the far surface: softer
  farRim: 0.45,                   // ...and its rim is not a crisp line over his head
  bushMul: 0.55,
  maxBlocks: 12, maxPricks: 3,
};

// the energy colours a blocked bolt passes through on its way to absorbed
const RED = 0xff2828, CORAL = 0xff7a5c, PINK = 0xffc4cc, WHITE = 0xffffff;
const RAMP = [[0, RED], [0.22, RED], [0.42, CORAL], [0.65, PINK], [0.88, WHITE], [1, WHITE]];
const HEAL = 0xdff0ff;            // the Super's white-blue

export const BLOCK_MS = 720, TEAR_MS = 920, PRICK_MS = 260;
// The tear's beats (ms from contact). Long enough on purpose: a real Super
// arrives with the frozen generic hit language on top of it (the body's white
// hit flash, the pellet impact rings, CRIT numbers), which owns roughly the
// first 250ms. The OPEN gap has to still be there when that clears, or the
// player never sees the field heal — measured on the first build, whose gap
// was already closing by the time the frame was readable.
export const TEAR = { open: 80, hold: 420, zip: 540, close: 600, snapEnd: 690, ripEnd: 900, gapPx: 13, gapPerPellet: 3, gapMaxPx: 18 };

const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
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

/** Per-bearer: three Graphics on the bearer's own attachment list. */
export function makeBulwarkCurtain(e) {
  const scene = e.scene;
  // the surface is NORMAL-blended (frosted material: it can hide what is
  // behind it); everything that is LIGHT — the bloom, the filaments, the snap,
  // the projector core — is ADD, so it reads as light and not as grey paint
  const far = scene.add.graphics(), near = scene.add.graphics();
  const glowFar = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const glowNear = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const core = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  e._attachments.push(far, near, glowFar, glowNear, core);   // die() and room clear destroy them with the body
  // ONE AUTHOR: the frozen class still draws its stroked arc every frame; it is
  // simply never shown while this field speaks for the shield.
  e.shieldArc?.setVisible(false);
  const f = new CurtainField(e, far, near, glowFar, glowNear, core);
  scene.__blwFields?.add(f);
  return f;
}

class CurtainField {
  constructor(e, far, near, glowFar, glowNear, core) {
    this.e = e; this.far = far; this.near = near; this.glowFar = glowFar; this.glowNear = glowNear; this.coreG = core;
    this.clock = 0;
    this.events = [];
    this.coreKick = 0; this.corePulse = 0;
    this.stats = { blocks: 0, pierces: 0, tears: 0, merged: 0, pricks: 0 };
    const N = CURTAIN.facets * CURTAIN.sub + 1;
    this._ox = new Float32Array(N); this._oy = new Float32Array(N);
    this._ix = new Float32Array(N); this._iy = new Float32Array(N);
    this._rel = new Float32Array(N);
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
    if (!e.alive) { for (const g of [this.near, this.far, this.glowNear, this.glowFar, this.coreG]) g.clear(); return false; }
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

  draw() {
    const e = this.e, C = CURTAIN, R = CURTAIN_RADIUS;
    const cx = e.x, cy = e.y, fac = e._shieldFacing, half = e._shieldHalfArc;
    const mul = e.hiddenInBush ? C.bushMul : 1;
    const near = this.near, far = this.far;
    near.clear(); far.clear(); this.glowNear.clear(); this.glowFar.clear();
    near.setDepth(e.y + 2); far.setDepth(e.y - 2);
    this.glowNear.setDepth(e.y + 3); this.glowFar.setDepth(e.y - 1.5);
    const F = C.facets, SUB = C.sub, N = F * SUB;
    const ox = this._ox, oy = this._oy, ix = this._ix, iy = this._iy, rel = this._rel;

    // the flat panels: rims at the panel boundaries, interpolated inside
    const tw = (r) => Math.pow(clamp01((half - Math.abs(r)) / C.taperRad), 0.75);
    for (let k = 0; k < F; k++) {
      const r0 = -half + (k / F) * 2 * half, r1 = -half + ((k + 1) / F) * 2 * half;
      const w0 = tw(r0), w1 = tw(r1);
      const p = (r, w, dr, dh) => { const a = fac + r, rr = R + dr * w; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a) + dh * w]; };
      const O0 = p(r0, w0, C.outR, C.outH), O1 = p(r1, w1, C.outR, C.outH);
      const I0 = p(r0, w0, -C.inR, -C.inH), I1 = p(r1, w1, -C.inR, -C.inH);
      for (let s = 0; s <= SUB; s++) {
        const j = k * SUB + s, u = s / SUB;
        rel[j] = r0 + (r1 - r0) * u;
        ox[j] = O0[0] + (O1[0] - O0[0]) * u; oy[j] = O0[1] + (O1[1] - O0[1]) * u;
        ix[j] = I0[0] + (I1[0] - I0[0]) * u; iy[j] = I0[1] + (I1[1] - I0[1]) * u;
      }
    }

    // deformation: dents (inward) and peeling torn edges (outward)
    const ev = this.events;
    const gaps = [];
    for (const v of ev) if (v.kind !== 'block') gaps.push({ v, g: this._gap(v), pe: this._peelEnv(v) });
    for (let j = 0; j <= N; j++) {
      let d = 0;
      for (const v of ev) {
        if (v.kind !== 'block') continue;
        const t = v.t, env = t < 35 ? t / 35 : Math.exp(-(t - 35) / 65);
        d -= 5 * env * gauss(rel[j] - v.off, 0.09);
      }
      for (const { v, g, pe } of gaps) {
        const dd = Math.abs(rel[j] - v.off) - g, W = 0.16;
        if (dd > 0 && dd < W && pe > 0) d += (v.kind === 'prick' ? 2 : 7) * pe * (1 - dd / W);
      }
      if (d !== 0) {
        const a = fac + rel[j], c = Math.cos(a), s = Math.sin(a);
        ox[j] += c * d; oy[j] += s * d; ix[j] += c * d; iy[j] += s * d;
      }
    }

    // the two counter-running sheens — broad, slow, deterministic
    const sp1 = -half - 0.4 + ((this.clock % 3200) / 3200) * (2 * half + 0.8);
    const sp2 = half + 0.4 - ((this.clock % 4700) / 4700) * (2 * half + 0.8);

    // energy per segment: the strongest event owns the colour, intensity sums
    const segCol = new Array(N), segI = new Float32Array(N), segGap = new Uint8Array(N);
    for (let j = 0; j < N; j++) {
      const rm = (rel[j] + rel[j + 1]) / 2;
      let best = 0, col = WHITE, sum = 0;
      for (const v of ev) {
        const dm = rm - v.off, t = v.t;
        let I = 0, c = WHITE;
        if (v.kind === 'block') {
          // the contact cools first; the energy it shed travels outward along
          // the surface as two fronts, widening, and cools behind itself
          const core = Math.exp(-t / 110) * gauss(dm, 0.08);
          const pos = 0.40 * (1 - Math.exp(-t / 150)), A = Math.exp(-t / 260), sg = 0.07 + 0.11 * Math.min(1, t / 300);
          const front = A * (gauss(dm - pos, sg) + gauss(dm + pos, sg));
          const haze = 0.55 * smooth(240, 380, t) * Math.exp(-Math.max(0, t - 380) / 200) * gauss(dm, 0.24);
          I = Math.min(1, Math.max(core, front, haze));
          c = rampColor((core > front ? t * 1.25 : t) / 380);
        } else {
          const g = this._gap(v);
          if (Math.abs(dm) < g) { segGap[j] = 1; continue; }
          const edge = Math.abs(dm) - g;
          if (v.kind === 'tear') {
            if (t < TEAR.close) I = 0.9 * gauss(edge, 0.05) * (0.8 + 0.2 * ((Math.floor(t / 45) % 2)));
            else I = 0.45 * Math.exp(-(t - TEAR.close) / 170) * gauss(Math.abs(dm) - 0.0022 * (t - TEAR.close), 0.05);
            if (t < 140) I = Math.max(I, (1 - t / 140) * gauss(dm, 0.12));
          } else {
            I = (t < 200 ? 0.7 : 0) * gauss(edge, 0.04);
          }
          c = HEAL;
        }
        sum += I;
        if (I > best) { best = I; col = c; }
      }
      segI[j] = Math.min(1, sum);
      segCol[j] = col;
    }

    // ── panels ──
    for (let j = 0; j < N; j++) {
      if (segGap[j]) continue;
      const rm = (rel[j] + rel[j + 1]) / 2;
      const isNear = Math.sin(fac + rm) >= 0;
      const g = isNear ? near : far;
      const m = mul * (isNear ? 1 : C.farMul);
      const k = Math.floor(j / SUB);
      const base = C.facetVar[k % 3] + C.sheenA * gauss(rm - sp1, 0.22) + C.sheen2A * gauss(rm - sp2, 0.3);
      const I = segI[j];
      const col = I > 0.01 ? lerpCol(C.frost, segCol[j], Math.min(1, I * 1.25)) : C.frost;
      const add = I * 0.55;
      const sx = (a, b, u) => a + (b - a) * u;
      // outer sub-band (milkier, by the bright rim) then inner (thinner, toward him)
      const mx0 = sx(ox[j], ix[j], C.split), my0 = sx(oy[j], iy[j], C.split);
      const mx1 = sx(ox[j + 1], ix[j + 1], C.split), my1 = sx(oy[j + 1], iy[j + 1], C.split);
      g.fillStyle(col, Math.min(0.92, (C.aHi + base + add) * m));
      g.fillPoints([{ x: ox[j], y: oy[j] }, { x: ox[j + 1], y: oy[j + 1] }, { x: mx1, y: my1 }, { x: mx0, y: my0 }], true);
      g.fillStyle(col, Math.min(0.92, (C.aLo + base + add) * m));
      g.fillPoints([{ x: mx0, y: my0 }, { x: mx1, y: my1 }, { x: ix[j + 1], y: iy[j + 1] }, { x: ix[j], y: iy[j] }], true);
    }
    // ── panel seams ──
    for (let k = 1; k < F; k++) {
      const j = k * SUB;
      if ((j > 0 && segGap[j - 1]) || segGap[j]) continue;
      const isNear = Math.sin(fac + rel[j]) >= 0;
      const g = isNear ? near : far;
      g.lineStyle(1, 0xffffff, C.seamA * mul * (isNear ? 1 : C.farMul));
      g.lineBetween(ox[j], oy[j], ix[j], iy[j]);
    }
    // ── rims and keyline ──
    // The BRIGHT rim is the OUTER edge — the face the fire arrives at. The inner
    // edge (toward the bearer) is a soft line, so the surface reads as a plane
    // standing in front of him rather than a tub he is standing in.
    for (let j = 0; j < N; j++) {
      if (segGap[j]) continue;
      const rm = (rel[j] + rel[j + 1]) / 2;
      const isNear = Math.sin(fac + rm) >= 0;
      const g = isNear ? near : far;
      const m = mul * (isNear ? 1 : C.farMul);
      const I = segI[j];
      if (isNear) {
        const a = fac + rm, kx = Math.cos(a) * 1.6, ky = Math.sin(a) * 1.6;
        g.lineStyle(1, C.key, C.keyA * m); g.lineBetween(ox[j] + kx, oy[j] + ky, ox[j + 1] + kx, oy[j + 1] + ky);
      }
      g.lineStyle(1, I > 0.01 ? lerpCol(C.lowRim, segCol[j], Math.min(1, I)) : C.lowRim, Math.min(1, (C.lowRimA + I * 0.4) * m));
      g.lineBetween(ix[j], iy[j], ix[j + 1], iy[j + 1]);
      g.lineStyle(I > 0.3 ? C.rimW + 0.5 : C.rimW, I > 0.01 ? lerpCol(C.rim, segCol[j], Math.min(1, I)) : C.rim, C.rimA * (isNear ? 1 : C.farRim) * mul);
      g.lineBetween(ox[j], oy[j], ox[j + 1], oy[j + 1]);
    }
    // ── tips: the coverage ends are stated, not implied ──
    for (const j of [0, N]) {
      const isNear = Math.sin(fac + rel[j]) >= 0;
      const g = isNear ? near : far;
      g.fillStyle(0xffffff, 0.85 * mul * (isNear ? 1 : C.farMul));
      g.fillRect(ix[j] - 1, iy[j] - 1, 2, 2);
    }

    // ── per-event overlays (smear, bloom, filaments, snap) ──
    for (const v of ev) this._overlay(v, cx, cy, fac, half, mul, gaps);
    this._drawCore(mul);
  }

  // a point on the field at relative angle r: the combat plane (h = 0) at the
  // curtain radius, or a fraction `f` from the lower rim to the upper
  _pt(cx, cy, fac, r, f = null, dR = 0) {
    const a = fac + r, C = CURTAIN, R = CURTAIN_RADIUS + dR;
    if (f == null) return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
    const dr = C.outR + (-C.inR - C.outR) * f, dh = C.outH + (-C.inH - C.outH) * f;
    return [cx + (R + dr) * Math.cos(a), cy + (R + dr) * Math.sin(a) + dh];
  }

  _overlay(v, cx, cy, fac, half, mul, gaps) {
    const R = CURTAIN_RADIUS, t = v.t;
    const isNear = Math.sin(fac + v.off) >= 0;
    const g = isNear ? this.near : this.far;            // material (the red smear dies INTO the surface)
    const L = isNear ? this.glowNear : this.glowFar;    // light
    const m = mul * (isNear ? 1 : CURTAIN.farMul + 0.2);
    if (v.kind === 'block') {
      if (t >= 130) return;
      // the bolt DIES INTO the surface: a compressed red-hot smear laid along
      // it, short and thick on contact, spreading and thinning as it goes
      const env = t < 35 ? t / 35 : Math.exp(-(t - 35) / 65);
      const ell = (8 + 9 * Math.min(1, t / 70)) / R;
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const r = Math.max(-half, Math.min(half, v.off - ell + (2 * ell * i) / 6));
        const p = this._pt(cx, cy, fac, r, null, -5 * env - 1);
        pts.push({ x: p[0], y: p[1] });
      }
      g.lineStyle(4.5 - 2.5 * Math.min(1, t / 70), RED, (1 - t / 130) * m);
      g.strokePoints(pts, false);
      if (t < 85) { g.lineStyle(1.5, 0xfff1e6, (1 - t / 85) * m); g.strokePoints(pts.slice(1, 6), false); }
      return;
    }
    const [px, py] = this._pt(cx, cy, fac, v.off);
    if (v.kind === 'prick') {
      if (t < 90) { const u = t / 90; L.fillStyle(0xffffff, 0.8 * (1 - u) * m); L.fillCircle(px, py, 3 + 5 * u); }
      if (t >= 200 && t < 250) { L.fillStyle(0xffffff, (1 - (t - 200) / 50) * m); L.fillCircle(px, py, 2.5); }
      return;
    }
    // TEAR
    if (t < 140) {                                   // white bloom, largest faintest
      const u = t / 140;
      L.fillStyle(HEAL, 0.4 * (1 - u) * m); L.fillCircle(px, py, 8 + 16 * u);
      L.fillStyle(0xffffff, 0.7 * (1 - u) * m); L.fillCircle(px, py, 5 + 9 * u);
      if (t < 100) { L.fillStyle(0xffffff, (1 - t / 100) * m); L.fillCircle(px, py, 2 + 3 * u); }
    }
    const gap = gaps.find((x) => x.v === v);
    const gw = gap ? gap.g : 0;
    if (t >= TEAR.hold && t < TEAR.close && gw > 0) {
      // filaments re-knit across the gap — three stitches, bowed alternately,
      // stepping in brightness (electronics, not a breathing glow)
      const fr = [0.2, 0.5, 0.8];
      const zip = t >= TEAR.zip ? (t - TEAR.zip) / (TEAR.close - TEAR.zip) : 0;
      fr.forEach((f, i) => {
        const a = this._pt(cx, cy, fac, v.off - gw, f), b = this._pt(cx, cy, fac, v.off + gw, f);
        const bow = (i % 2 ? 1.5 : -1.5);
        const lit = (Math.floor(t / 45) + i) % 2 ? 0.95 : 0.6;
        L.lineStyle(1.5, i === 1 ? 0xffffff : HEAL, lit * m);
        L.strokePoints([{ x: a[0], y: a[1] }, { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 + bow }, { x: b[0], y: b[1] }], false);
      });
      if (zip > 0) {
        // THE ZIPPER: the last of the gap closes from the lower rim upward
        const lo0 = this._pt(cx, cy, fac, v.off - gw, 0), lo1 = this._pt(cx, cy, fac, v.off + gw, 0);
        const hi0 = this._pt(cx, cy, fac, v.off - gw, zip), hi1 = this._pt(cx, cy, fac, v.off + gw, zip);
        g.fillStyle(HEAL, 0.55 * m);
        g.fillPoints([{ x: lo0[0], y: lo0[1] }, { x: lo1[0], y: lo1[1] }, { x: hi1[0], y: hi1[1] }, { x: hi0[0], y: hi0[1] }], true);
        L.fillStyle(0xffffff, 0.9 * m);
        L.fillCircle((hi0[0] + hi1[0]) / 2, (hi0[1] + hi1[1]) / 2, 2);
      }
    }
    if (t >= TEAR.close && t < TEAR.snapEnd) {        // the SNAP: compact, bright, short
      const u = (t - TEAR.close) / (TEAR.snapEnd - TEAR.close);
      const lo = this._pt(cx, cy, fac, v.off, 0), hi = this._pt(cx, cy, fac, v.off, 1);
      L.lineStyle(2, 0xffffff, (1 - u) * m); L.lineBetween(lo[0], lo[1], hi[0], hi[1]);
      L.fillStyle(0xffffff, (1 - u) * m); L.fillCircle(px, py, 5 - 2 * u);
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
