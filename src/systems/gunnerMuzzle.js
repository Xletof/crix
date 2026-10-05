// GUNNER MUZZLE DISCHARGE — v1 roster presentation only.
//
// The stock enemy bolt has never had a muzzle event: `fireShooter` spawns the
// bolt and plays a sound, and that is all. For the v1 Gunner that read as a
// round appearing out of nothing, so this adds ONE compact powered discharge
// at the drawn muzzle: a white-hot core, a short forward wedge, a faint lime
// flare either side — two painted frames: the peak for exactly one drawn frame, then
// ~50ms of decay.
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
const DECAY_MS = 50;                   // the peak is exactly ONE drawn frame (counted, not timed), then ~3 dying

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
    live.push({ img, t: 0, peak: true });
  };
  const tick = (time, delta) => {
    for (const w of scene.__gunnerFx || []) if (w.tick(delta)) scene.__gunnerFx.delete(w);
    for (let i = live.length - 1; i >= 0; i--) {
      const f = live[i];
      if (f.peak) { f.peak = false; continue; }          // the spawn frame renders the peak at any frame rate
      f.t += delta;
      if (f.t >= DECAY_MS) { f.img.setVisible(false).setActive(false); pool.push(f.img); live.splice(i, 1); }
      else f.img.setFrame(1).setAlpha(1 - f.t / DECAY_MS * 0.6);
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
// v5 — v4 put the energy in the right place (inside the gun) but its "spin"
// was highlights sliding along the barrel, and at 1x that reads as energy
// travelling forward, not as anything turning. v5 gives the spin a mechanism:
// a 3x3 CHAMBER in the receiver, on the gun's OWN pixel grid (cells are whole
// gun pixels, drawn in the gun's rotated space, flip-correct), with a dark
// centre and a comet of 2-3 lit cells stepping round its eight rim cells.
//
//   FEED      the receiver's core line lights behind the chamber and packets
//             run forward along it INTO the chamber
//   WIND      the comet steps round the rim, slow enough at first that each
//             position holds for several frames, ~5x faster by the end
//   COMPRESS  last ~90ms: the feed line is eaten from the back forward, the
//             rim fills and whitens into a ring, the centre lights, the mouth
//             heats and one or two pixels escape it
//   SNAP      ONE frame, counted in frames not ms so a slow phone still draws
//             it: chamber and bore white from the chamber to a 7px white-hot
//             core at the mouth, the discharge fires, the gun kicks 2px
//   EMPTY     the chamber goes DARK — rotor gone, one dim green cell — and is
//             back to the painted idle in 140ms; the bolt carries the read
//
// Timing is the shipped one: `charge()` on the warning tick, `shot()` on the
// fire tick. One Graphics per gun, no timers, no tweens, no randomness.
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
  const DARK = 0x07120b, SPENT = 0x1c5a2e;
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // The chamber sits on the painted power indicator (rosterPaint.js: receiver
  // columns 3..15, rows 3..5 of the padded canvas; indicator at 11-12, row 4).
  const CH_X = 12, CH_Y = 4, LINE_Y = 4, FEED_X0 = 3;
  // the rim, clockwise in canvas space
  const RIM = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  let ws, ox, oy, H, flip;
  // one gun pixel, in the gun's own (rotated, possibly flipped) space
  const cell = (cx, cy, col, al, inset = 0) => {
    const x = cx * S - ox;
    const y = flip ? H - oy - (cy + 1) * S : cy * S - oy;
    g.fillStyle(col, al); g.fillRect(x + inset, y + inset, S - inset * 2, S - inset * 2);
  };
  const fx = {
    chargeT: -1, chargeMs: 300, kickT: -1, squashT: -1, theta: 0, relF: -1, relT: 0,
    charge(ms) { this.chargeMs = ms; this.chargeT = 0; this.theta = 0; this.relF = -1; },
    shot() { this.chargeT = -1; this.kickT = 0; this.squashT = 0; this.relF = 0; this.relT = 0; },
    tick(delta) {
      ws = e.weaponSprite;
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
      let snap = false, empty = -1;
      if (this.relF >= 0) {
        this.relF++;
        if (this.relF === 1) snap = true;
        else { this.relT += delta; empty = this.relT < 140 ? 1 - this.relT / 140 : -1; if (empty < 0) this.relF = -1; }
      }
      g.clear();
      if (u < 0 && !snap && empty < 0) { g.setVisible(false); return false; }
      ox = ws.originX * ws.width; oy = ws.originY * ws.height; H = ws.height; flip = ws.flipY;
      g.setVisible(true).setPosition(ws.x, ws.y).setRotation(ws.rotation).setScale(ws.scaleX, ws.scaleY)
        .setDepth(ws.depth + 0.5).setAlpha(ws.alpha);
      const MZ = Math.round(ws.width / S) - 2;               // the muzzle lip column (19 regular, 21 elite)
      if (u >= 0) {
        // the chamber window: dark, so the rotor has something to turn against
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) cell(CH_X + dx, CH_Y + dy, DARK, 0.92);
        // FEED: the core line behind the chamber, eaten from the back as it compresses
        const back = FEED_X0 + (CH_X - 1 - FEED_X0) * sstep(0.62, 0.95, u);
        for (let x = Math.ceil(back); x <= CH_X - 2; x++) cell(x, LINE_Y, GREEN, 0.35 + 0.35 * u, 1);
        if (u < 0.9) {
          // packets run forward into the chamber, faster each pass
          const passes = 1.2 + 4.5 * u * u, ph = (passes * u * 2.2) % 1;
          const px = Math.round(back + ph * (CH_X - 1 - back));
          if (px >= back) cell(px, LINE_Y, u > 0.5 ? WHITE : LIME, 1);
        }
        // WIND: the comet. Rate ramps ~16 -> ~80 rim steps a second.
        this.theta += (delta / 1000) * (16 + 64 * Math.pow(u, 1.6));
        const head = Math.floor(this.theta) % 8;
        const merge = sstep(0.7, 0.95, u);                    // the rim filling into a ring
        if (merge > 0) for (const [dx, dy] of RIM) cell(CH_X + dx, CH_Y + dy, lerpCol(GREEN, HOT, merge), 0.35 + 0.6 * merge);
        const tails = u < 0.25 ? 1 : 2;
        for (let i = tails; i >= 0; i--) {
          const [dx, dy] = RIM[(head - i + 8) % 8];
          const col = i === 0 ? lerpCol(LIME, WHITE, Math.min(1, u * 1.6)) : i === 1 ? lerpCol(GREEN, HOT, u) : GREEN;
          cell(CH_X + dx, CH_Y + dy, col, i === 0 ? 1 : i === 1 ? 0.85 : 0.6);
        }
        // COMPRESS: the centre lights last, and the whole chamber goes white-hot
        if (u > 0.82) cell(CH_X, CH_Y, lerpCol(HOT, WHITE, sstep(0.82, 0.97, u)), sstep(0.82, 0.92, u));
        if (u > 0.95) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) cell(CH_X + dx, CH_Y + dy, WHITE, 0.9);
        // the mouth heats, and right at the end one or two pixels escape it
        if (u > 0.55) cell(MZ, LINE_Y, lerpCol(LIME, HOT, sstep(0.55, 0.95, u)), 0.5 + 0.5 * sstep(0.55, 0.9, u), 1);
        if (u > 0.93) cell(MZ + 1, LINE_Y + (head % 2 ? -1 : 1), WHITE, 0.9, 1);
      }
      if (snap) {
        // SNAP: one frame. The compressed charge dumps forward — chamber and
        // bore white to the mouth, a 7px white-hot core at the lip.
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) cell(CH_X + dx, CH_Y + dy, WHITE, 1);
        for (let x = CH_X + 2; x <= MZ; x++) cell(x, LINE_Y, WHITE, 1);
        const cx = (MZ + 0.5) * S - ox;
        const cy = flip ? H - oy - (LINE_Y + 0.5) * S : (LINE_Y + 0.5) * S - oy;
        g.fillStyle(WHITE, 1); g.fillRect(cx - 3.5, cy - 3.5, 7, 7);
      } else if (empty >= 0) {
        // EMPTY: the chamber is dark and the rotor is gone; one dim cell is all
        // that is left, and the painted idle comes back as this fades
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) cell(CH_X + dx, CH_Y + dy, DARK, 0.92 * empty);
        cell(CH_X, CH_Y, SPENT, 0.8 * empty, 1);
      }
      return false;
    },
  };
  (scene.__gunnerFx ||= new Set()).add(fx);
  return fx;
}
