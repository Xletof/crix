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
  });
}
