// ROSTER v1 — THE BULWARK'S SIDEARM: firing presentation.
//
// Restrained on purpose. The shield is already the richest thing on this
// actor, and the weapon is SECONDARY to it, so the gun says as little as it
// can while still being honest about a shot:
//
//   WARNING  the same 300ms tick as legacy (`_maybeFireAt`, frozen), shown as
//            one cold pip at the muzzle warming pale blue -> white. It replaces
//            the legacy whole-gun orange tint for this body only — the dodge
//            cue in the gun's own language, never a tint.
//   SHOT     a tiny cold-white / pale-blue discharge for ONE drawn frame and
//            ~30ms of decay, and a 1px / 50ms kick of the overlay. No bloom,
//            no ring, no body bob.
//
// The whole-body shot squash (`recoilT`, base class) is undone for RENDER only,
// after the physics step, exactly as the Rifleman's cycle does it: Arcade sizes
// the body from the sprite's scale, so the squash itself is a 100ms physics
// change and must stay.
//
// Not the Gunner's rotor (`gunnerMuzzle.js`, keyed on `_muzzleFx`) and not the
// Rifleman / Marksman cycle (`rosterWeaponFx.js`, keyed on `_rosterFx` in its
// own CFG, which has no `sidearm` entry and so returns before touching it).
// Presentation only: no timers, no tweens, no randomness, nothing written back
// to gameplay.

import Phaser from 'phaser';
import { SIDEARM } from './rosterPaint.js';
import { WEAPON_STACK } from './bulwarkCurtain.js';

const S = 4;
const KEY = 'fx-blw-muzzle';
const CFG = { w: 4, decay: 30, kickPx: 1, kickMs: 50, squashMs: 120, chargeMs: 300 };

/** Two east-facing frames; the muzzle point is (0, mid-row). */
export function paintSidearmMuzzle(scene) {
  if (scene.textures.exists(KEY)) return;
  const W = CFG.w, H = 3;
  const t = scene.textures.createCanvas(KEY, W * S * 2, H * S);
  const ctx = t.getContext();
  const WH = '#ffffff', C = '#dff1ff', B = '#9fd0f5';
  const frames = [
    [[0, 1, WH], [1, 1, WH], [2, 1, C], [3, 1, B], [1, 0, C], [1, 2, C]],   // a small cold star
    [[0, 1, C], [1, 1, B]],                                                  // and a stub
  ];
  frames.forEach((cells, f) => { for (const [x, y, c] of cells) { ctx.fillStyle = c; ctx.fillRect((f * W + x) * S, y * S, S, S); } });
  t.refresh();
  t.add(0, 0, 0, 0, W * S, H * S); t.add(1, 0, W * S, 0, W * S, H * S);
}

/** Scene-level: the discharge pool and the per-gun tick. */
export function attachBulwarkSidearms(scene) {
  const live = [], pool = [];
  const guns = (scene.__blwGuns = new Set());
  const onFire = (s) => {
    if (s?._rosterFx !== 'sidearm' || !s.alive) return;
    const ws = s.weaponSprite;
    if (!ws?.active) return;
    s._weaponFx?.shot?.();
    const m = new Phaser.Math.Vector2();
    ws.getWorldTransformMatrix().transformPoint((1 - ws.originX) * ws.width, 0, m);
    const img = pool.pop() || scene.add.image(0, 0, KEY, 0).setOrigin(0.5 / CFG.w, 0.5);
    img.setTexture(KEY, 0).setPosition(m.x, m.y).setRotation(ws.rotation)
      .setAlpha(1).setVisible(true).setActive(true).setDepth(ws.depth + WEAPON_STACK.discharge);   // above the gun, under the field (WEAPON < SHIELD)
    live.push({ img, t: 0, peak: true });
  };
  const tick = (time, delta) => {
    for (const w of guns) if (w.tick(delta)) guns.delete(w);
    for (let i = live.length - 1; i >= 0; i--) {
      const f = live[i];
      if (f.peak) { f.peak = false; continue; }      // the spawn frame renders the peak at any frame rate
      f.t += delta;
      if (f.t >= CFG.decay) { f.img.setVisible(false).setActive(false); pool.push(f.img); live.splice(i, 1); }
      else f.img.setFrame(1).setAlpha(1 - (f.t / CFG.decay) * 0.6);
    }
  };
  scene.events.on('shooter-fire', onFire);
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off('shooter-fire', onFire);
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick);
    for (const f of live) f.img.destroy();
    for (const p of pool) p.destroy();
    live.length = 0; pool.length = 0; guns.clear();
  });
}

/**
 * The per-gun cycle; also the body's `_weaponFx`, so `_maybeFireAt` (frozen)
 * hands it the warning and the shot on their legacy ticks.
 */
export function makeSidearmFx(e) {
  const scene = e.scene;
  const g = scene.add.graphics().setVisible(false);
  e._attachments.push(g);
  const fx = {
    chargeT: -1, chargeMs: CFG.chargeMs, kickT: -1, squashT: -1,
    charge(ms) { this.chargeMs = ms; this.chargeT = 0; },
    shot() { this.chargeT = -1; this.kickT = 0; this.squashT = 0; },
    tick(delta) {
      const ws = e.weaponSprite;
      if (!e.active || !e.alive || !ws?.active) { if (g.active) g.setVisible(false); return !e.active; }
      if (this.squashT >= 0) {                       // render-only undo of the physics squash
        this.squashT += delta;
        if (this.squashT > CFG.squashMs) this.squashT = -1;
        else if (!(e._staggerMs > 0)) e.setScale(e._baseScale);
      }
      if (this.kickT >= 0) {
        this.kickT += delta;
        const k = this.kickT < CFG.kickMs ? CFG.kickPx * (1 - this.kickT / CFG.kickMs) : 0;
        if (this.kickT >= CFG.kickMs) this.kickT = -1;
        ws.x -= Math.cos(ws.rotation) * k; ws.y -= Math.sin(ws.rotation) * k;
      }
      g.clear();
      let u = -1;
      if (this.chargeT >= 0) {
        this.chargeT += delta;
        u = Math.min(1, this.chargeT / this.chargeMs);
        if (this.chargeT > this.chargeMs + 60) { this.chargeT = -1; u = -1; }
      }
      if (u < 0) { g.setVisible(false); return false; }
      // READY: one pip at the lip, warming pale blue -> white. Drawn in the
      // gun's own rotated (and possibly flipped) space, on the bore row.
      const ox = ws.originX * ws.width, oy = ws.originY * ws.height, H = ws.height;
      const cx = ws.width - S * 2 - ox;                                   // last content column
      const row = SIDEARM.barrelRow + 1;                                   // +1: the painter's pad
      const cy = ws.flipY ? H - oy - (row + 1) * S : row * S - oy;
      const col = u > 0.66 ? 0xffffff : u > 0.33 ? 0xd8ecff : 0x9fc6e8;
      const grow = u > 0.66 ? 1 : 0;
      g.fillStyle(col, 0.55 + 0.45 * u).fillRect(cx - grow, cy - grow, S + grow * 2, S + grow * 2);
      g.setVisible(true).setPosition(ws.x, ws.y).setRotation(ws.rotation).setScale(ws.scaleX, ws.scaleY)
        .setDepth(ws.depth + WEAPON_STACK.pip).setAlpha(ws.alpha);
      return false;
    },
  };
  scene.__blwGuns?.add(fx);
  return fx;
}
