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

const KICK_PX = 2, KICK_MS = 80;

/** Give a v1 Gunner its weapon firing cycle. Called by `wearRosterArt`. */
//
// v3 — the charge is drawn INSIDE AND AROUND THE GUN, big enough to read at
// 1x in a fight, and it MOVES, because a cue that only gets brighter reads as
// a light blinking:
//   CHAMBER  the receiver's core line lights green and a bright packet runs
//            butt -> muzzle, faster each pass (three passes in the window):
//            power being cycled into the barrel
//   SWIRL    four sparks orbit the muzzle, spinning up and pulling in from
//            12px to 4px as the window closes; green -> yellow-white
//   TIGHTEN  the last 60ms: the sparks collapse into a white core
//   RELEASE  the core and chamber flash white, a 2px ring snaps out from the
//            muzzle to 13px in 60ms, the discharge fires, the gun kicks 2px
// Pixel-snapped 3px squares (the bolt's own pixel), one Graphics per gun.
export function makeGunnerWeaponFx(e) {
  const scene = e.scene;
  const g = scene.add.graphics().setVisible(false);
  e._attachments.push(g);
  const lerpCol = (a, b, t) => {
    const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
    const gg = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
    const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
    return (Math.round(r) << 16) | (Math.round(gg) << 8) | Math.round(bl);
  };
  const GREEN = 0x3dff6a, LIME = 0x9dffb2, HOT = 0xfff6c0, WHITE = 0xffffff;
  const sq = (x, y, sz, col, al) => { g.fillStyle(col, al); g.fillRect(Math.round(x - sz / 2), Math.round(y - sz / 2), sz, sz); };
  const fx = {
    chargeT: -1, chargeMs: 300, kickT: -1, squashT: -1, spin: 0,
    charge(ms) { this.chargeMs = ms; this.chargeT = 0; this.spin = 0; },
    shot() { this.chargeT = -1; this.kickT = 0; this.squashT = 0; },
    tick(delta) {
      const ws = e.weaponSprite;
      if (!e.active || !e.alive || !ws?.active) { g.setVisible(false); return !e.active; }
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
      if (this.kickT >= 0) {
        this.kickT += delta;
        const k = this.kickT < KICK_MS ? KICK_PX * (1 - this.kickT / KICK_MS) : 0;
        if (this.kickT >= KICK_MS) this.kickT = -1;
        ws.x -= Math.cos(ws.rotation) * k; ws.y -= Math.sin(ws.rotation) * k;
      }
      let u = -1;
      if (this.chargeT >= 0) {
        this.chargeT += delta;
        u = Math.min(1, this.chargeT / this.chargeMs);
        if (this.chargeT > this.chargeMs + 60) { this.chargeT = -1; u = -1; }   // no shot came: it bleeds away
      }
      const rel = this.kickT >= 0 && this.kickT < 70 ? this.kickT / 70 : -1;
      g.clear();
      if (u < 0 && rel < 0) { g.setVisible(false); return false; }
      g.setVisible(true).setDepth(ws.depth + 0.5).setAlpha(ws.alpha);
      const mtx = ws.getWorldTransformMatrix(), p = new Phaser.Math.Vector2();
      const at = (lx) => { mtx.transformPoint(lx * S - ws.originX * ws.width, 0, p); return { x: p.x, y: p.y }; };
      const cx = Math.cos(ws.rotation), cy = Math.sin(ws.rotation);
      const tipLx = ws.width / S - 1.5;                       // just inside the drawn muzzle, in gun pixels
      const tip = at(tipLx);
      if (u >= 0) {
        // CHAMBER: receiver core line (gun px 3..15), brightening, with a packet
        const col = lerpCol(GREEN, HOT, u);
        for (let lx = 3; lx <= 15; lx += 0.75) { const q = at(lx); sq(q.x, q.y, 3, col, 0.35 + 0.55 * u); }
        const passes = 3 * Math.pow(u, 1.4);
        const ph = passes - Math.floor(passes);
        for (let j = 0; j < 3; j++) { const q = at(3 + ph * 12 - j * 0.8); sq(q.x, q.y, 3, j ? col : WHITE, 1 - j * 0.3); }
        // SWIRL: four sparks spinning up and pulling in around the muzzle
        this.spin += (delta / 1000) * (8 + 34 * u);
        const r = u > 0.8 ? 4 * (1 - (u - 0.8) / 0.2) + 1 : 12 - 8 * (u / 0.8);
        for (let j = 0; j < 4; j++) {
          const a = this.spin + j * Math.PI / 2;
          sq(tip.x + Math.cos(a) * r, tip.y + Math.sin(a) * r * 0.75, u > 0.5 ? 4 : 3, lerpCol(LIME, HOT, u), 0.6 + 0.4 * u);
        }
        sq(tip.x, tip.y, u > 0.6 ? 6 : 3, u > 0.6 ? WHITE : LIME, 0.5 + 0.5 * u);
      }
      if (rel >= 0) {
        // RELEASE: chamber flash, core, and a hard ring snapping outward
        if (rel < 0.5) for (let lx = 3; lx <= 15; lx += 0.75) { const q = at(lx); sq(q.x, q.y, 3, WHITE, 0.9 * (1 - rel * 2)); }
        const rr = 4 + 9 * rel;
        g.lineStyle(2, rel < 0.4 ? WHITE : LIME, 1 - rel);
        g.strokeCircle(Math.round(tip.x + cx * 3), Math.round(tip.y + cy * 3), rr);
      }
      return false;
    },
  };
  (scene.__gunnerFx ||= new Set()).add(fx);
  return fx;
}
