// THE DEMOLISHER'S PAYLOAD (roster v1, `bomber`). PRESENTATION ONLY.
//
// The frozen `EnemyBomber._tickSwarm` is the proximity telegraph's one and only
// clock. Every AI tick it computes
//     t = clamp(1 - dist / 300, 0, 1)
//     _bombPulse += delta * (0.006 + 0.03 t)
// and paints the WHOLE BODY with `setTint(255, 106 + flash·t·130, 51 + flash·t·110)`
// where flash = 0.5 + 0.5 sin(_bombPulse). Under legacy that tint IS the
// warning. On the v1 body it would be a second author: a multiply tint over
// baked orange armour, a canister and a containment plate, which is exactly
// the "orange because it is dangerous" read the production art replaces.
//
// So on the v1 Demolisher (installed from `wearRosterArt`, never on a nemesis,
// which always wears legacy art):
//
//   ONE AUTHOR   the class's own tint write is swallowed for the length of its
//                own update (it is recorded, so a rig can prove the AI still
//                asked for it), and NOTHING ELSE about the tick changes — the
//                pulse, the contact test, the detonation, the RNG stream;
//   THE SAME     the warning reads that very `t` and `_bombPulse`, sampled
//   NUMBERS      right after the AI ran, so its timing is the legacy timing by
//                construction: no new clock, no new threshold, no longer
//                window (contact at 48px means t never passes 0.84 in play);
//   HARDWARE     the warning comes from the payload, in three layers that
//                join as the danger rises — the off-centre ARMING INDICATOR
//                (lit steady at range: armed; blinking at the pulse as he
//                closes), the canister STATUS LIGHTS (amber, reddening), and
//                the PAYLOAD HEAT: every canister and charge pixel, plus the
//                payload's own silhouette rim, ADD-lit hot on the pulse. The
//                heat and the lamp anchors are derived from the painted frame
//                (`rosterPaint.demoDerive`), so the light lands on the hardware
//                it belongs to in every frame, facing and stride;
//   DEATH        both detonation paths (contact and shot down) still run the
//                frozen blast. The payload is gone with it: the overlays are
//                attachments (destroyed by `die()` and by the room sweep), and
//                the body and its shadow are not left sliding through the
//                explosion for the 440ms corpse fade — the blast is the event.
//
// It never writes hp, velocity, the AI, timers or `Math.random`.

import Phaser from 'phaser';

/** The frozen telegraph's range (`_tickSwarm`'s 300). Mirrored, never fed back. */
export const WARN_RANGE_PX = 300;

// smoothstep, for the layers joining
const ramp = (a, b, x) => { const u = Phaser.Math.Clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const lerpCol = (a, b, u) => {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  return (Math.round(ar + (((b >> 16) & 255) - ar) * u) << 16) | (Math.round(ag + (((b >> 8) & 255) - ag) * u) << 8) | Math.round(ab + ((b & 255) - ab) * u);
};

/**
 * THE WARNING LAW: the frozen proximity `t` and the frozen pulse `flash`
 * (0..1) in, four intensities out. Pure, so the strip, the live tick and the
 * tests read one implementation.
 *   lamp    the arming indicator — steady at range (armed), blinking fully
 *           on the pulse from t ≈ 0.15 (about 255px)
 *   status  the canister lights, joining from t 0.12 to 0.4
 *   heat    the payload itself, from t 0.3 to 0.75 (225px to 75px)
 *   hot     how far the colours have gone from amber toward white / red
 */
export function payloadWarning(t, flash) {
  const blink = ramp(0, 0.15, t);
  return {
    lamp: 0.55 * (1 - blink) + blink * flash,
    status: ramp(0.12, 0.4, t) * (0.25 + 0.75 * flash),
    heat: ramp(0.3, 0.75, t) * (0.4 + 0.6 * flash),
    hot: ramp(0.35, 0.8, t),
  };
}

const LAMP = { armed: 0xffb43a, hot: 0xfff0b8 };
const STATUS = { warm: 0xffa030, hot: 0xff3a1c };

/** Scene-level: one tick for every payload, after the gait has chosen the frame. */
export function attachDemolisherPayloads(scene) {
  const set = (scene.__demPayloads = new Set());
  const tick = () => {
    for (const P of set) {
      if (!P.e.active || !P.heat.active) { set.delete(P); continue; }
      drawPayload(P);
    }
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick);
    set.clear();
    scene.__demPayloads = null;
  });
}

function swallowTint(c) { this._legacyWarnTint = c; return this; }

/** Per bearer, once (from `wearRosterArt`). */
export function installDemolisherPayload(e, art) {
  if (e._payload) return e._payload;
  const scene = e.scene;
  const heat = scene.add.sprite(e.x, e.y, art.heat, 0).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
  const lamps = scene.add.graphics();
  const bloom = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  e._attachments.push(heat, lamps, bloom);          // die() and the room sweep destroy them with the body
  const P = (e._payload = { e, heat, lamps, bloom, table: art.lamps, t: 0, flash: 0.5, w: payloadWarning(0, 0.5) });

  // ONE AUTHOR for the body's colour: the class's update runs untouched except
  // that its tint write lands nowhere (recorded on `_legacyWarnTint`)
  const pre = e.preUpdate;
  e.preUpdate = function (time, delta) {
    this.setTint = swallowTint;
    try { pre.call(this, time, delta); } finally { delete this.setTint; }
    if (this.alive) samplePayload(P);
  };
  // the frozen die (blast first, then the base death); then the payload is gone
  const die = e.die;
  e.die = function () {
    const was = this.alive;
    die.call(this);
    if (was) {
      this.setVisible(false);
      this.shadow?.setVisible(false);
      P.dead = true;
    }
  };
  scene.__demPayloads?.add(P);
  samplePayload(P);
  return P;
}

/** The frozen telegraph's own two numbers, read where the AI left them. */
export function samplePayload(P) {
  const e = P.e, pl = e.scene.player;
  const d = pl ? Math.hypot(pl.x - e.x, pl.y - e.y) : Infinity;
  P.t = Phaser.Math.Clamp(1 - d / WARN_RANGE_PX, 0, 1);
  P.flash = 0.5 + 0.5 * Math.sin(e._bombPulse || 0);
  P.w = payloadWarning(P.t, P.flash);
}

// a logical sheet pixel -> world, on the body's live frame, flip and scale
function lampRect(e, lx, ly) {
  const fw = e.frame.width, fh = e.frame.height, px = fw / 24;
  const tx = e.flipX ? fw - (lx + 1) * px : lx * px;
  return [e.x + (tx - fw * e.originX) * e.scaleX, e.y + (ly * px - fh * e.originY) * e.scaleY, px * e.scaleX, px * e.scaleY];
}

/** Draw one payload for this frame. */
export function drawPayload(P) {
  const { e, heat, lamps, bloom } = P;
  lamps.clear(); bloom.clear();
  const show = e.alive && e.visible && !P.dead;
  if (!show) { heat.setVisible(false); return; }
  const w = P.w, a = e.alpha;
  const fi = Number(e.frame.name);
  // PAYLOAD HEAT — the same frame of the same-layout sheet, ADD, over the body
  heat.setVisible(w.heat > 0.01).setFrame(fi).setPosition(e.x, e.y).setFlipX(e.flipX)
    .setScale(e.scaleX, e.scaleY).setDepth(e.depth + 0.01).setAlpha(w.heat * a);
  // LAMPS — exactly over the unlit lens pixels, crisp; a one-pixel ADD spill
  lamps.setDepth(e.depth + 0.02); bloom.setDepth(e.depth + 0.03);
  const L = P.table?.[fi];
  if (!L) return;
  const lampCol = lerpCol(LAMP.armed, LAMP.hot, w.hot), stCol = lerpCol(STATUS.warm, STATUS.hot, w.hot);
  for (const [list, I, col] of [[L.ind, w.lamp, lampCol], [L.st, w.status, stCol]]) {
    if (I <= 0.02) continue;
    for (const [lx, ly] of list) {
      const [x, y, sw, sh] = lampRect(e, lx, ly);
      lamps.fillStyle(col, I * a).fillRect(x, y, sw, sh);
      bloom.fillStyle(col, 0.35 * I * a).fillRect(x - sw, y - sh, sw * 3, sh * 3);
    }
  }
}
