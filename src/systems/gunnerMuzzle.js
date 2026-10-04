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
// v4 — the charge lives INSIDE the gun, readable at 1x, and it moves:
//   WIND     the receiver's core line lights and a packet runs forward in it
//   SPIN     internal highlights step around the barrel axis, faster and faster
//   COMPRESS the lit span shortens toward the muzzle, green -> near-white
//   RELEASE  one tick of 7px white-hot core at the mouth (the muzzle wins),
//            the discharge fires, the gun kicks 2px
//   EMPTY    the chamber drops to a dim green and is gone in 70ms; the bolt
//            carries the read from the next frame
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
      const atY = (lx, ly) => { mtx.transformPoint(lx * S - ws.originX * ws.width, ly, p); return { x: p.x, y: p.y }; };
      void cx; void cy;
      if (u >= 0) {
        // v4 — THE ENERGY LIVES IN THE GUN. The lit span of the receiver's core
        // line SHORTENS toward the muzzle as the charge fills (wound up, then
        // compressed), its colour runs green -> near-white, a packet travels
        // forward inside it, and three internal highlights step around the
        // barrel axis (above / on / below it, 3px inside the receiver's 12px
        // body) at a rate that climbs from ~6 to ~30 steps a second: a small
        // contained mechanism spinning up. Nothing orbits outside the gun until
        // the last 10%, and then only two pixels hugging the muzzle.
        const ease = u * u * (3 - 2 * u);
        const back = 3 + 9 * ease, front = 16;                 // lit span, gun px: 3..16 -> 12..16
        const col = lerpCol(GREEN, HOT, ease);
        for (let lx = back; lx <= front; lx += 0.75) { const q = at(lx); sq(q.x, q.y, 3, col, 0.45 + 0.5 * u); }
        // packet: forward inside the span, faster each pass
        const passes = 3 * Math.pow(u, 1.3);
        const ph = passes - Math.floor(passes);
        const q0 = at(back + ph * (front - back)); sq(q0.x, q0.y, 3, WHITE, 1);
        // internal spin: three highlights stepping around the axis
        this.spin += (delta / 1000) * (6 + 24 * u);
        const step = Math.floor(this.spin) % 3;
        const off = [-3, 0, 3][step];
        const sx = back + (front - back) * 0.6;
        const qa = atY(sx, off); sq(qa.x, qa.y, 3, u > 0.6 ? WHITE : LIME, 0.9);
        const qb = atY(sx + 1.5, -off); sq(qb.x, qb.y, 3, u > 0.6 ? HOT : LIME, 0.7);
        // the core at the barrel's mouth, inside the silhouette, near-white at the end
        const c0 = at(tipLx - 0.5);
        sq(c0.x, c0.y, u > 0.75 ? 5 : 3, u > 0.75 ? WHITE : lerpCol(LIME, HOT, u), 0.6 + 0.4 * u);
        if (u > 0.9) {
          const a = this.spin * 2.2;
          for (const sgn of [1, -1]) sq(c0.x + Math.cos(a) * 4 * sgn, c0.y + Math.sin(a) * 3 * sgn, 2, WHITE, 0.9);
        }
      }
      if (rel >= 0) {
        // RELEASE: the compressed charge dumps forward. Tick 1 the muzzle WINS —
        // a 7px white-hot core; then the chamber is visibly EMPTY: dim, short,
        // gone in 70ms, while the bolt carries the read.
        const ms = this.kickT;
        if (ms < 17) {
          const c = at(tipLx); sq(c.x, c.y, 7, WHITE, 1);
          for (let lx = 12; lx <= 16; lx += 0.75) { const q = at(lx); sq(q.x, q.y, 3, WHITE, 1); }
        } else {
          const k = 1 - rel;
          for (let lx = 3; lx <= 16; lx += 1.5) { const q = at(lx); sq(q.x, q.y, 3, GREEN, 0.35 * k); }
        }
      }
      return false;
    },
  };
  (scene.__gunnerFx ||= new Set()).add(fx);
  return fx;
}
