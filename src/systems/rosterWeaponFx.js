// ROSTER v1 — FIRING PRESENTATION for the RIFLEMAN and the MARKSMAN.
//
// Not the Gunner's. His v5 rotor (gunnerMuzzle.js) is approved and frozen, and
// it is the language of a sustained-power heavy weapon; these two roles each
// get their own, smaller one. The Gunner's listener keys on `_muzzleFx`, these
// key on `_rosterFx` ('rifle' | 'marksman'), so neither can fire for the other.
//
//   RIFLE     standard issue. The 300ms warning (same tick as legacy) is a
//             small READY pip at the muzzle that warms pale amber -> white —
//             the dodge cue in the gun's own language instead of the whole-gun
//             orange tint. The shot: a small 5x5 discharge for ONE drawn frame
//             and two frames of decay, a 1.5px / 60ms kick.
//   MARKSMAN  precise. Nothing is added to the warning: the sniper's laser and
//             lock (Enemy.js, frozen) stay the only telegraph. The optic READS
//             that state — its lens glows violet while tracking and goes
//             white-hot on the lock frame — so the man and the beam agree. The
//             shot: a long thin white/magenta spike for ONE drawn frame, a
//             short decay, a restrained 1px / 70ms kick.
//
// Both undo the whole-body shot squash for RENDER only, in POST_UPDATE after
// the physics step: `recoilT` stays a physics change (Arcade sizes the body
// from the sprite's scale), exactly as for the Gunner. Presentation only: no
// timers, no tweens, no randomness, and nothing written back to gameplay.

import Phaser from 'phaser';
import { CARBINE, PRECISION } from './rosterPaint.js';

const S = 4;
const KEY_R = 'fx-rif-muzzle', KEY_M = 'fx-mrk-muzzle';

/** Two east-facing frames each; the muzzle point is (0, mid-row). */
export function paintRosterMuzzles(scene) {
  const paint = (key, W, H, frames) => {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, W * S * 2, H * S);
    const ctx = t.getContext();
    frames.forEach((cells, f) => { for (const [x, y, c] of cells) { ctx.fillStyle = c; ctx.fillRect((f * W + x) * S, y * S, S, S); } });
    t.refresh();
    t.add(0, 0, 0, 0, W * S, H * S); t.add(1, 0, W * S, 0, W * S, H * S);
  };
  const W = '#ffffff', P = '#f2ffe0', L = '#b6ffb0', G = '#3dff6a';
  // rifle: a small crisp star, then a stub
  paint(KEY_R, 5, 5, [
    [[0, 2, W], [1, 2, W], [2, 2, P], [3, 2, L], [1, 1, P], [1, 3, P], [0, 1, L], [0, 3, L], [4, 2, G]],
    [[0, 2, P], [1, 2, L], [0, 1, G], [0, 3, G]],
  ]);
  const M = '#ff4fd8', H = '#ffc4f2';
  // marksman: a long thin needle with a magenta edge, then a fading line
  paint(KEY_M, 11, 3, [
    [[0, 1, W], [1, 1, W], [2, 1, W], [3, 1, W], [4, 1, H], [5, 1, H], [6, 1, M], [7, 1, M], [8, 1, G], [1, 0, M], [1, 2, M], [0, 0, H], [0, 2, H]],
    [[0, 1, H], [1, 1, H], [2, 1, M], [3, 1, M]],
  ]);
}

const CFG = {
  rifle: { key: KEY_R, w: 5, decay: 34, kickPx: 1.5, kickMs: 60, squashMs: 120 },
  marksman: { key: KEY_M, w: 11, decay: 50, kickPx: 1, kickMs: 70, squashMs: 140 },
};

export function attachRosterWeaponFx(scene) {
  const live = [], pool = { rifle: [], marksman: [] };
  const onFire = (s) => {
    const c = CFG[s?._rosterFx];
    if (!c || !s.alive) return;
    const ws = s.weaponSprite;
    if (!ws?.active) return;
    s._rosterFxObj?.shot?.();
    const m = new Phaser.Math.Vector2();
    ws.getWorldTransformMatrix().transformPoint((1 - ws.originX) * ws.width, 0, m);
    const img = pool[s._rosterFx].pop() || scene.add.image(0, 0, c.key, 0).setOrigin(0.5 / c.w, 0.5);
    img.setTexture(c.key, 0).setPosition(m.x, m.y).setRotation(ws.rotation)
      .setAlpha(1).setVisible(true).setActive(true).setDepth(s.y + 2);
    live.push({ img, kind: s._rosterFx, t: 0, peak: true });
  };
  const tick = (time, delta) => {
    for (const w of scene.__rosterFx || []) if (w.tick(delta)) scene.__rosterFx.delete(w);
    for (let i = live.length - 1; i >= 0; i--) {
      const f = live[i], c = CFG[f.kind];
      if (f.peak) { f.peak = false; continue; }          // the spawn frame renders the peak at any frame rate
      f.t += delta;
      if (f.t >= c.decay) { f.img.setVisible(false).setActive(false); pool[f.kind].push(f.img); live.splice(i, 1); }
      else f.img.setFrame(1).setAlpha(1 - f.t / c.decay * 0.6);
    }
  };
  scene.events.on('shooter-fire', onFire);
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off('shooter-fire', onFire);
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick);
    for (const f of live) f.img.destroy();
    for (const k of Object.keys(pool)) { for (const p of pool[k]) p.destroy(); pool[k].length = 0; }
    live.length = 0;
    scene.__rosterFx?.clear();
  });
}

/**
 * The per-gun cycle. For the rifle it is also `_weaponFx` (so `_maybeFireAt`
 * hands it the warning and the shot, on their legacy ticks). The marksman's is
 * driven by its own state and the `shooter-fire` event.
 */
export function makeRosterWeaponFx(e, kind) {
  const scene = e.scene, c = CFG[kind];
  const g = scene.add.graphics().setVisible(false);
  e._attachments.push(g);
  const geo = kind === 'rifle' ? CARBINE : PRECISION;
  let ws, ox, oy, H, flip;
  // one gun pixel at CONTENT coords (the painter's, before its 1px pad), in
  // the gun's own rotated and possibly flipped space
  const cell = (cx, cy, col, al, grow = 0) => {
    const x = (cx + 1) * S - ox, y = flip ? H - oy - (cy + 2) * S : (cy + 1) * S - oy;
    g.fillStyle(col, al); g.fillRect(x - grow, y - grow, S + grow * 2, S + grow * 2);
  };
  const fx = {
    chargeT: -1, chargeMs: 300, kickT: -1, squashT: -1,
    charge(ms) { this.chargeMs = ms; this.chargeT = 0; },
    shot() { this.chargeT = -1; this.kickT = 0; this.squashT = 0; },
    tick(delta) {
      ws = e.weaponSprite;
      if (!e.active || !e.alive || !ws?.active) { g.setVisible(false); return !e.active; }
      if (this.squashT >= 0) {                     // render-only undo of the physics squash
        this.squashT += delta;
        if (this.squashT > c.squashMs) this.squashT = -1;
        else if (!(e._staggerMs > 0)) e.setScale(e._baseScale);
      }
      if (this.kickT >= 0) {
        this.kickT += delta;
        const k = this.kickT < c.kickMs ? c.kickPx * (1 - this.kickT / c.kickMs) : 0;
        if (this.kickT >= c.kickMs) this.kickT = -1;
        ws.x -= Math.cos(ws.rotation) * k; ws.y -= Math.sin(ws.rotation) * k;
      }
      g.clear();
      ox = ws.originX * ws.width; oy = ws.originY * ws.height; H = ws.height; flip = ws.flipY;
      const muzzle = Math.round(ws.width / S) - 3;           // last content column
      let drew = false;
      if (kind === 'rifle') {
        let u = -1;
        if (this.chargeT >= 0) {
          this.chargeT += delta;
          u = Math.min(1, this.chargeT / this.chargeMs);
          if (this.chargeT > this.chargeMs + 60) { this.chargeT = -1; u = -1; }
        }
        if (u >= 0) {
          // READY: one pip at the lip, warming pale amber -> white
          const col = u > 0.66 ? 0xffffff : u > 0.33 ? 0xfff2c0 : 0xffd98a;
          cell(muzzle, geo.barrelRow, col, 0.55 + 0.45 * u, u > 0.66 ? 1 : 0);
          drew = true;
        }
      } else if (e._charging) {
        // the optic reads the sniper's own state: tracking, then LOCKED
        const locked = e._chargeMs <= e.cfg.lockMs;
        const [lx, ly] = geo.lens;
        if (locked) { cell(lx, ly, 0xffffff, 1, 1); cell(muzzle, geo.barrelRow, 0xffc4f2, 0.85); }
        else cell(lx, ly, 0xff4fd8, 0.6 + 0.4 * (1 - e._chargeMs / e.cfg.windupMs));
        drew = true;
      }
      if (!drew) { g.setVisible(false); return false; }
      g.setVisible(true).setPosition(ws.x, ws.y).setRotation(ws.rotation).setScale(ws.scaleX, ws.scaleY)
        .setDepth(ws.depth + 0.5).setAlpha(ws.alpha);
      return false;
    },
  };
  (scene.__rosterFx ||= new Set()).add(fx);
  return fx;
}
