// GUNNER MUZZLE DISCHARGE — v1 roster presentation only.
//
// The stock enemy bolt has never had a muzzle event: `fireShooter` spawns the
// bolt and plays a sound, and that is all. For the v1 Gunner that read as a
// round appearing out of nothing, so this adds ONE compact powered discharge
// at the drawn muzzle: a white-hot core, a short forward wedge, a faint lime
// flare either side — two painted frames, peak then decay, ~85ms in all.
//
// It is opt-in by the ART, not by the archetype: only a body wearing roster
// art that declares `muzzleFx` (the v1 Gunner, both tiers) carries the
// `_muzzleFx` flag, so legacy troopers, shielded/sniper on the legacy sheet,
// nemeses and the Captain are untouched by construction.
//
// PRESENTATION ONLY. It listens to `shooter-fire` beside the scene's own
// handler (which fires the bolt), reads the gun sprite's transform — already
// placed this frame by `Enemy.preUpdate` — and draws. It writes nothing back, draws no random numbers and owns no tween —
// it is ticked on the scene's own POST_UPDATE delta, so a paused scene freezes
// it and a hand-stepped harness sees the identical fight with or without it.

import Phaser from 'phaser';

const S = 4;
const KEY = 'fx-gun-muzzle';
const PEAK_MS = 35, DECAY_MS = 50;      // ~2 frames bright, ~3 frames dying, then gone

/** Two east-facing frames on a 7x7 canvas; the muzzle point is (0, 3). */
export function paintGunnerMuzzle(scene) {
  if (scene.textures.exists(KEY)) return;
  const W = 7, H = 7;
  const t = scene.textures.createCanvas(KEY, W * S * 2, H * S);
  const ctx = t.getContext();
  const px = (f, x, y, c) => { ctx.fillStyle = c; ctx.fillRect((f * W + x) * S, y * S, S, S); };
  const WHITE = '#ffffff', HOT = '#eaffee', LIME = '#9dffb2', EDGE = '#3dff6a';
  // PEAK: core at the mouth, a short forward wedge, a lime flare off each side
  for (const [x, y] of [[0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3]]) px(0, x, y, WHITE);
  for (const [x, y] of [[3, 3], [4, 3], [2, 2], [2, 4]]) px(0, x, y, HOT);
  for (const [x, y] of [[5, 3], [3, 2], [3, 4], [1, 1], [1, 5]]) px(0, x, y, LIME);
  for (const [x, y] of [[6, 3], [0, 1], [0, 5]]) px(0, x, y, EDGE);
  // DECAY: the core shrunk to the mouth, the wedge gone to a stub
  for (const [x, y] of [[0, 3], [1, 3]]) px(1, x, y, HOT);
  for (const [x, y] of [[0, 2], [0, 4], [2, 3]]) px(1, x, y, LIME);
  t.refresh();
  t.add(0, 0, 0, 0, W * S, H * S);
  t.add(1, 0, W * S, 0, W * S, H * S);
}

export function attachGunnerMuzzle(scene) {
  const live = [], pool = [];
  const onFire = (s) => {
    if (!s?._muzzleFx || !s.alive) return;
    const ws = s.weaponSprite;
    if (!ws?.active) return;
    // the drawn tip, on the barrel row, through the gun's finished transform
    const m = new Phaser.Math.Vector2();
    ws.getWorldTransformMatrix().transformPoint((1 - ws.originX) * ws.width, 0, m);
    const img = pool.pop() || scene.add.image(0, 0, KEY, 0).setOrigin(0.5 / 7, 0.5);
    img.setTexture(KEY, 0).setPosition(m.x, m.y).setRotation(ws.rotation)
      .setAlpha(1).setVisible(true).setActive(true)
      .setDepth(s.y + 2);                 // above the firer, not the flat 27 (see CLAUDE.md)
    live.push({ img, t: 0 });
  };
  const tick = (time, delta) => {
    for (const w of scene.__gunnerFx || []) if (w.tick(delta)) scene.__gunnerFx.delete(w);
    for (let i = live.length - 1; i >= 0; i--) {
      const f = live[i];
      f.t += delta;
      if (f.t >= PEAK_MS + DECAY_MS) { f.img.setVisible(false).setActive(false); pool.push(f.img); live.splice(i, 1); }
      else if (f.t >= PEAK_MS) f.img.setFrame(1).setAlpha(1 - (f.t - PEAK_MS) / DECAY_MS * 0.6);
    }
  };
  scene.events.on('shooter-fire', onFire);
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off('shooter-fire', onFire);
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick);
    for (const f of live) f.img.destroy();
    for (const p of pool) p.destroy();
    live.length = 0; pool.length = 0;
    scene.__gunnerFx?.clear();
  });
}

// ── THE WEAPON'S OWN FIRING CYCLE (v1 Gunner) ──────────────────────────────
//
// The shipped shot read for every shooter was two shared things, and neither
// belonged to an energy weapon:
//   - the 300ms pre-fire warning turned the WHOLE GUN orange (a multiply tint
//     that also outlived the shot by 60ms), and
//   - the shot set `recoilT`, which SHRINKS THE BODY by up to 15% around its
//     centre while the gun overlay does not scale — so the figure collapsed
//     under a fixed gun and sprang back: the "shoved backward" bob.
// `EnemyShooter._maybeFireAt` hands both moments to `_weaponFx` when the art
// asks for it. The squash itself still runs — Arcade sizes the body from the
// sprite's scale, so it is a physics change too — and is undone only for the
// render, after the physics step. The TIMING is the shipped one (the warning still starts 300ms
// before the shot, the shot on the same tick); only the drawing changes:
//
//   CHARGE   the power indicator brightens green -> yellow-white and a pip
//            grows at the muzzle over the same 300ms (the dodge cue, now in
//            the weapon's own language — no tint on the gun)
//   SHOT     pip and indicator flash, the discharge above fires, and the GUN
//            alone kicks back 2px along its own axis
//   RECOVER  the kick bleeds out linearly in 80ms, the indicator drops back
//
// Rendered in POST_UPDATE, after `Enemy.preUpdate` has placed the gun for the
// frame, so the kick is an offset on a fresh position and can never
// accumulate. No timers, no tweens, no randomness; the overlays are the
// actor's `_attachments`, so death and room clears sweep them.

const CHARGE_KEY = 'fx-gun-charge', CELL_KEY = 'fx-gun-cell';
const KICK_PX = 2, KICK_MS = 80, CELL_FLASH_MS = 50;

export function paintGunnerCharge(scene) {
  if (scene.textures.exists(CHARGE_KEY)) return;
  const pip = scene.textures.createCanvas(CHARGE_KEY, 3 * S * 2, 3 * S);
  const c = pip.getContext();
  const px = (f, x, y, col) => { c.fillStyle = col; c.fillRect((f * 3 + x) * S, y * S, S, S); };
  // frame 0: building (green); frame 1: about to release (white / yellow-white)
  px(0, 1, 1, '#c8ffd4'); for (const [x, y] of [[0, 1], [2, 1], [1, 0], [1, 2]]) px(0, x, y, '#3dff6a');
  px(1, 1, 1, '#ffffff'); for (const [x, y] of [[0, 1], [2, 1], [1, 0], [1, 2]]) px(1, x, y, '#fff3a0');
  pip.refresh(); pip.add(0, 0, 0, 0, 3 * S, 3 * S); pip.add(1, 0, 3 * S, 0, 3 * S, 3 * S);
  const cell = scene.textures.createCanvas(CELL_KEY, 2 * S * 2, S);
  const d = cell.getContext();
  d.fillStyle = '#9dffb2'; d.fillRect(0, 0, 2 * S, S);
  d.fillStyle = '#fffbe0'; d.fillRect(2 * S, 0, 2 * S, S);
  cell.refresh(); cell.add(0, 0, 0, 0, 2 * S, S); cell.add(1, 0, 2 * S, 0, 2 * S, S);
}

/** Give a v1 Gunner its weapon firing cycle. Called by `wearRosterArt`. */
export function makeGunnerWeaponFx(e) {
  const scene = e.scene;
  const pip = scene.add.image(0, 0, CHARGE_KEY, 0).setVisible(false);
  const cell = scene.add.image(0, 0, CELL_KEY, 0).setVisible(false);
  e._attachments.push(pip, cell);
  const fx = {
    chargeT: -1, chargeMs: 300, kickT: -1, squashT: -1,
    charge(ms) { this.chargeMs = ms; this.chargeT = 0; },
    shot() { this.chargeT = -1; this.kickT = 0; this.squashT = 0; },
    tick(delta) {
      const ws = e.weaponSprite;
      if (!e.active || !e.alive || !ws?.active) { pip.setVisible(false); cell.setVisible(false); return !e.active; }
      // THE SHOT SQUASH IS PHYSICS, NOT JUST PICTURE. `recoilT` still shrinks
      // the sprite in `Enemy.preUpdate` and the physics step has already sized
      // the body from it this frame; this runs after that step and before the
      // render, so the body keeps its shipped footprint and the picture stays
      // at rest scale. `preUpdate` re-asserts the squash absolutely next frame.
      if (this.squashT >= 0) {
        this.squashT += delta;
        if (this.squashT > 120) this.squashT = -1;
        else if (!(e._staggerMs > 0)) e.setScale(e._baseScale);
      }
      // the kick: the gun alone, back along its own axis, never accumulating
      let k = 0;
      if (this.kickT >= 0) {
        this.kickT += delta;
        k = this.kickT < KICK_MS ? KICK_PX * (1 - this.kickT / KICK_MS) : 0;
        if (this.kickT >= KICK_MS) this.kickT = -1;
        ws.x -= Math.cos(ws.rotation) * k; ws.y -= Math.sin(ws.rotation) * k;
      }
      let u = -1;
      if (this.chargeT >= 0) {
        this.chargeT += delta;
        u = Math.min(1, this.chargeT / this.chargeMs);
        // no shot came (line of sight lost): the charge bleeds away
        if (this.chargeT > this.chargeMs + 60) { this.chargeT = -1; u = -1; }
      }
      const flash = this.kickT >= 0 && this.kickT < CELL_FLASH_MS;
      const mtx = ws.getWorldTransformMatrix(), p = new Phaser.Math.Vector2();
      const a = ws.alpha, depth = ws.depth + 0.5;
      // indicator: receiver pixels 11-12 of the padded gun, on the barrel row
      mtx.transformPoint(12 * S - ws.originX * ws.width, 0, p);
      if (u >= 0 || flash) {
        cell.setPosition(p.x, p.y).setRotation(ws.rotation).setFrame(flash || u > 0.5 ? 1 : 0)
          .setAlpha(a * (flash ? 1 : 0.55 + 0.45 * u)).setDepth(depth).setVisible(true);
      } else cell.setVisible(false);
      // muzzle pip, just inside the drawn tip
      if (u >= 0) {
        mtx.transformPoint((1 - ws.originX) * ws.width - 6, 0, p);
        pip.setPosition(p.x, p.y).setFrame(u > 0.6 ? 1 : 0).setScale(0.6 + 0.5 * u)
          .setAlpha(a * (0.45 + 0.55 * u)).setDepth(depth).setVisible(true);
      } else pip.setVisible(false);
      return false;
    },
  };
  (scene.__gunnerFx ||= new Set()).add(fx);
  return fx;
}
