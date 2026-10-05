// GAIT v2 PRESENTATION TICK (`?gait=v2`, roster-v1 bodies only).
//
// The frozen base class (`Enemy.preUpdate`) picks idle / walk / fire off
// `speedSq > 200` and plays the walk at a fixed 14fps whatever the body's real
// speed, and its facing comes from the AIM — so a body easing to a stop
// cycles its feet at full rate (skating), and one strafing or backing away
// plays a forward walk while it slides. This tick runs on POST_UPDATE, after
// the base has chosen its animation and the physics has moved the body, and
// only CHOOSES WHICH FRAME IS SHOWN:
//
//   CADENCE  a gait phase advanced by REAL displacement (world px travelled
//            / the role's cycle length), so a planted foot roughly holds the
//            deck at any speed; clamped to 24 frames/s.
//   STATE    walking on above 30px/s, off below 12px/s (measured, smoothed):
//            no walk/idle thrash while v2.2 eases in and out of a settle.
//   MODE     movement against the FACING THE SPRITE SHOWS: within 60° of it,
//            the walk (backwards when retreating); otherwise the strafe cycle,
//            played by screen direction. A change must hold 120ms.
//
// It never calls `play()` (so nothing restarts), never writes velocity, AI,
// timers or RNG, and leaves fire / scripted-move poses to the base class.

import Phaser from 'phaser';
import { GAIT_STRAFE_BASE, GAIT_CYCLE_PX } from './rosterPaint.js';

const ON = 30, OFF = 12, MAX_FPS = 24, HOLD_MS = 120;

export function attachRosterGait(scene) {
  const tick = (time, delta) => {
    if (!delta) return;
    for (const e of scene.enemies?.getChildren() || []) {
      const pre = e._animPrefix;
      if (!e.active || !e.alive || !pre || !pre.startsWith('ro-')) continue;
      const cyc = GAIT_CYCLE_PX[pre.slice(0, 6)];
      if (!cyc) continue;
      const G = e._gait || (e._gait = { x: e.x, y: e.y, vx: 0, vy: 0, phase: 0, walking: false, mode: 'walk', want: 'walk', wantT: 0 });
      // real displacement this tick, smoothed (~60ms) for the state decisions
      const mx = e.x - G.x, my = e.y - G.y; G.x = e.x; G.y = e.y;
      const k = 1 - Math.exp(-delta / 60);
      G.vx += (mx / delta * 1000 - G.vx) * k; G.vy += (my / delta * 1000 - G.vy) * k;
      const sp = Math.hypot(G.vx, G.vy);
      G.walking = G.walking ? sp > OFF : sp > ON;
      const key = e.anims?.currentAnim?.key || '';
      const dir = key.endsWith('-front') ? 'front' : key.endsWith('-back') ? 'back' : 'side';
      const di = dir === 'front' ? 0 : dir === 'back' ? 1 : 2;
      // fire and scripted-move poses belong to the base class
      if (!/-(walk|idle)-/.test(key)) continue;
      // the base flips walk/idle every frame around its 14px/s line while v2.2
      // eases; below OUR hysteresis the body simply stands
      if (!G.walking) { e.setFrame(di * 8, false, false); continue; }
      // the facing the sprite shows, and the movement against it
      const fx = dir === 'side' ? (e.flipX ? -1 : 1) : 0, fy = dir === 'front' ? 1 : dir === 'back' ? -1 : 0;
      const along = (G.vx * fx + G.vy * fy) / (sp || 1);
      const want = Math.abs(along) >= 0.5 ? 'walk' : 'strafe';
      if (want !== G.mode) { if (G.want !== want) { G.want = want; G.wantT = 0; } G.wantT += delta; if (G.wantT >= HOLD_MS) G.mode = want; }
      else G.want = G.mode;
      // signed travel for the cycle: along the facing for the walk (negative =
      // backing away, the walk runs backwards); for the front/back strafe the
      // screen x (frames are painted stepping right); a profile strafe is
      // marking time, so its magnitude
      const d = Math.hypot(mx, my);
      let signed;
      if (G.mode === 'walk') signed = (mx * fx + my * fy) || 0;
      else signed = dir === 'side' ? d : mx;
      const step = Phaser.Math.Clamp(signed / cyc * 6, -MAX_FPS * delta / 1000, MAX_FPS * delta / 1000);
      G.phase = ((G.phase + step) % 6 + 6) % 6;
      const f = Math.floor(G.phase);
      const frame = G.mode === 'walk' ? di * 8 + 1 + f : GAIT_STRAFE_BASE + di * 6 + f;
      e.setFrame(frame, false, false);
    }
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick));
}
