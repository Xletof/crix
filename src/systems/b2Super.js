// B2 CLOSURE CANDIDATE — SUPER TARGETING ON RELEASE (`?b2=A|B&b2c=1`, opt-in,
// HUMAN-authorized 2026-11-16; NOT approved, NOT a default).
//
// THE INTERACTION
//   Tap F (or ENTER, or the Super button): released inside TAP_MS, the Super
//     fires at the nearest eligible enemy — exactly the shipped fan.
//   Hold: keydown enters TARGETING without firing. The nearest eligible enemy
//     is locked at once. The hero keeps moving and the gun keeps working.
//     The TARGETING HEADING pivots with, in order of authority: a dragged
//     Super button (touch), the mouse pointer once it has moved, else the
//     movement direction. Any eligible enemy that stays inside the cone around
//     the heading for DWELL_MS is locked and STAYS locked (up to one per
//     pellet). keyup commits: the Super fires exactly once.
//   Cancelled, with no cast and nothing left armed: focus loss, pause, death,
//     a suppression, the meter emptied (respawn), scene shutdown.
//
// WHAT A LOCK DOES (and does not)
//   The Super is still the shipped 5-pellet, 30-degree fan at the shipped
//   damage, speed, range, pierce and knockback, fired through the frozen
//   `firePlayerSuper` -> `_superBlast` path; charge, cooldown and eligibility
//   rules are untouched. The fan is centred on the heading at release (on a
//   tap, the nearest enemy). Each lock beyond the first takes over the fan
//   pellet nearest to it in angle, re-aimed straight at that target when the
//   blast leaves — ONE directed pellet per locked target, never more, so a
//   lock cannot stack pellets on one enemy. With one lock (any tap) the fan is
//   bit-for-bit the shipped one.
//
// DRAWN (one pooled Graphics, player-owned ice-white / violet; never red):
//   1 preparation  the cone: two thin ice-white rays to the Super's reach and
//                  an arc, faint, after the tap window
//   2 acquisition  violet corner brackets close in on an enemy in the cone as
//                  its dwell fills
//   3 lock         the brackets become an ice-white diamond with a violet
//                  core; a faint violet tether to the hero; one pip per lock
//   4 release      every lock pops, the tethers flash and retract
//   5 impact       a locked target hit by its pellet throws one violet ring;
//                  the mark is gone
// No camera movement and no slow-motion are added; `superAiming` (the red
// cone and the camera's ability lead) is never set by this path.
import Phaser from 'phaser';
import { PLAYER } from '../config.js';

export const B2C_SUPER = {
  tapMs: 160,       // released before this: a tap
  showMs: 90,       // the cone appears after this (a tap never flashes it)
  coneDeg: 22,      // half-angle of the acquisition cone
  dwellMs: 110,     // time inside the cone that makes a lock
  mouseMovePx: 4,   // the mouse takes the heading once it has moved this far
};
const ICE = 0xeef8ff, VIOLET = 0x8c9cff, KEY = 0x10142c;   // KEY: the dark keyline that keeps a mark legible on white armour
const TAU = Math.PI * 2;
const wrapAng = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

export function installB2Super(scene, api, wrap, voice) {
  const p0 = scene.player;
  if (!p0) return null;
  const C = B2C_SUPER;
  const MAX_LOCKS = PLAYER.superPellets;
  const st = {
    phase: 'idle', src: null, downAt: 0, heading: 0, locks: [], dwell: new Map(),
    touchVec: null, mouse0: null, mouseOn: false, plan: null, lastLocks: [], fx: [],
  };
  const stats = { taps: 0, holds: 0, casts: 0, locks: 0, maxLocks: 0, directed: 0, cancels: {}, denied: 0, impacts: 0, ignoredRepeat: 0 };
  let clock = 0;
  const live = (e) => e && e.active && e.alive;
  const reachOf = (e) => PLAYER.superRange + (e.cfg?.radius ?? 22);
  const candidates = () => {
    const list = scene.enemies?.getChildren?.() || [];
    return scene.boss?.alive ? [...list, scene.boss] : list;
  };
  const eligible = (p, e) => live(e) && Math.hypot(e.x - p.x, e.y - p.y) <= reachOf(e);
  const nearest = (p) => {
    let best = null, bd = Infinity;
    for (const e of candidates()) { if (!eligible(p, e)) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
    return best;
  };
  const ready = (p) => p?.alive && (p.superCharge || 0) >= PLAYER.superHitsToCharge;

  function begin(src) {
    const p = scene.player;
    if (!p?.alive || st.phase !== 'idle') return;
    if (p.suppressed) { p._denySuper?.(); stats.denied++; return; }
    if (!ready(p)) return;
    st.phase = 'targeting'; st.src = src; st.downAt = clock; st.dwell.clear();
    const n = nearest(p);
    st.locks = n ? [n] : [];
    st.heading = n ? Math.atan2(n.y - p.y, n.x - p.x) : (p.facing ?? 0);
    const ptr = scene.input?.activePointer;
    st.mouse0 = ptr ? { x: ptr.x, y: ptr.y } : null; st.mouseOn = false;
    st.touchVec = null;
    if (n) stats.locks++;
  }
  function cancel(reason) {
    if (st.phase === 'idle') return;
    st.phase = 'idle'; st.locks = []; st.dwell.clear(); st.touchVec = null;
    stats.cancels[reason] = (stats.cancels[reason] || 0) + 1;
  }
  function commit() {
    if (st.phase !== 'targeting') return false;
    const p = scene.player;
    const held = clock - st.downAt;
    // a flick of the touch button inside the tap window is AIMED, not a tap
    const flick = st.src === 'touch' && st.touchVec && st.touchVec.force > 0.05;
    const tap = held < C.tapMs;
    st.phase = 'idle';
    if (!p?.alive) { cancel('dead'); return false; }
    const locks = st.locks.filter((e) => eligible(p, e));
    let heading;
    if (tap) {
      // a tap is the shipped cast: the fan at the nearest enemy, now
      const n = nearest(p);
      heading = flick ? Math.atan2(st.touchVec.y, st.touchVec.x) : n ? Math.atan2(n.y - p.y, n.x - p.x) : (p.facing ?? 0);
      stats.taps++;
    } else { heading = st.heading; stats.holds++; }
    const plan = tap ? null : { locks: locks.slice(0, MAX_LOCKS) };
    st.plan = plan;
    const ok = p.tryFireSuper(heading);
    if (!ok) { st.plan = null; st.locks = []; return false; }
    stats.casts++;
    if (plan && plan.locks.length > stats.maxLocks) stats.maxLocks = plan.locks.length;
    st.lastLocks = plan ? plan.locks.slice() : [];
    for (const e of st.lastLocks) st.fx.push({ kind: 'release', e, x: e.x, y: e.y, t: 0, life: 160 });
    st.locks = []; st.dwell.clear();
    return true;
  }

  // ── the blast: one directed pellet per extra lock ────────────────────────
  wrap(scene, '_superBlast', (prev) => function (angle) {
    const plan = st.plan; st.plan = null;
    const p = this.player;
    const locks = plan ? plan.locks.filter((e) => live(e)) : [];
    if (!p || locks.length <= 1) return prev.call(this, angle);
    const n = PLAYER.superPellets, half = (n - 1) / 2;
    const step = Phaser.Math.DegToRad(PLAYER.superSpreadDeg) / Math.max(1, n - 1);
    const slots = Array.from({ length: n }, (_, i) => angle + (i - half) * step);
    const assigned = new Array(n).fill(null);
    // the lock nearest the fan's centre keeps the centre pellet's neighbourhood
    // by the same rule as the rest: nearest free slot in angle, one each
    const order = locks.map((e) => ({ e, a: Math.atan2(e.y - p.y, e.x - p.x) }))
      .sort((u, v) => Math.abs(wrapAng(u.a - angle)) - Math.abs(wrapAng(v.a - angle)));
    for (const { a } of order) {
      let bi = -1, bd = Infinity;
      for (let i = 0; i < n; i++) { if (assigned[i] != null) continue; const d = Math.abs(wrapAng(a - slots[i])); if (d < bd) { bd = d; bi = i; } }
      if (bi >= 0) { assigned[bi] = a; stats.directed++; }
    }
    const group = this.playerSuperBullets;
    const fire0 = group.fire;
    let i = 0;
    group.fire = function (x, y, a, ...rest) { const k = i++; return fire0.call(this, x, y, assigned[k] != null ? assigned[k] : a, ...rest); };
    try { return prev.call(this, angle); } finally { group.fire = fire0; }
  });

  // ── inputs ───────────────────────────────────────────────────────────────
  const kb = scene.input?.keyboard;
  const keyDown = (ev) => { if (ev?.repeat) { stats.ignoredRepeat++; return; } begin('key'); };
  const keyUp = () => { if (st.src === 'key') commit(); };
  if (kb) {
    kb.on('keydown-F', keyDown); kb.on('keyup-F', keyUp);
    kb.on('keydown-ENTER', keyDown); kb.on('keyup-ENTER', keyUp);
  }
  // touch: the Super button's own hold / drag / release, into the same machine
  wrap(p0, 'setSuperAimInput', () => function (vec) {
    if (st.phase === 'idle') begin('touch');
    if (st.src === 'touch') st.touchVec = vec || null;
  });
  wrap(p0, 'releaseSuperAim', () => function (vec) {
    if (st.phase === 'idle') begin('touch');
    if (st.phase !== 'targeting' || st.src !== 'touch') return;
    st.touchVec = vec || null;
    if (vec && vec.force > 0.05) st.heading = Math.atan2(vec.y, vec.x);
    commit();
  });
  const onBlur = () => cancel('focus');
  if (typeof window !== 'undefined') window.addEventListener('blur', onBlur);
  const onPause = () => cancel('pause');
  scene.events.on('pause', onPause);
  const onHit = (e) => {
    if (scene._dmgSrc !== 'super') return;
    const k = st.lastLocks.indexOf(e);
    if (k < 0) return;
    st.lastLocks.splice(k, 1);
    stats.impacts++;
    st.fx.push({ kind: 'impact', e: null, x: e.x, y: e.y, t: 0, life: 240 });
  };
  scene.events.on('enemy-hit', onHit);

  // ── the frame ────────────────────────────────────────────────────────────
  const g = scene.add.graphics().setDepth(8800);
  function headingSource(p) {
    const tv = st.touchVec;
    if (st.src === 'touch' && tv && tv.force > 0.05) return Math.atan2(tv.y, tv.x);
    const ptr = scene.input?.activePointer;
    if (st.src === 'key' && ptr && st.mouse0) {
      if (!st.mouseOn && Math.hypot(ptr.x - st.mouse0.x, ptr.y - st.mouse0.y) >= C.mouseMovePx) st.mouseOn = true;
      if (st.mouseOn) { const w = ptr.positionToCamera(scene.cameras.main); return Math.atan2(w.y - p.y, w.x - p.x); }
    }
    const mx = p._moveTargetX || 0, my = p._moveTargetY || 0;
    if (Math.hypot(mx, my) > 1) return Math.atan2(my, mx);
    return null;
  }
  function tick(dt) {
    clock += dt;
    const p = scene.player;
    if (st.phase === 'targeting') {
      if (!p?.alive) cancel('dead');
      else if (p.suppressed) cancel('suppressed');
      else if (!ready(p)) cancel('meter');
    }
    if (st.phase === 'targeting') {
      const h = headingSource(p);
      if (h != null) st.heading = h;
      st.locks = st.locks.filter((e) => live(e));
      const half = Phaser.Math.DegToRad(C.coneDeg);
      for (const e of candidates()) {
        if (!eligible(p, e) || st.locks.includes(e)) { st.dwell.delete(e); continue; }
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        if (Math.abs(wrapAng(a - st.heading)) <= half) {
          const d = (st.dwell.get(e) || 0) + dt;
          if (d >= C.dwellMs && st.locks.length < MAX_LOCKS) {
            st.locks.push(e); st.dwell.delete(e); stats.locks++;
            st.fx.push({ kind: 'lock', e, t: 0, life: 140 });
            voice?.lockTick?.(st.locks.length);
          } else st.dwell.set(e, Math.min(d, C.dwellMs));
        } else st.dwell.delete(e);
      }
    }
    draw(p, dt);
  }

  const diamondPath = (x, y, r, w, col, a) => {
    g.lineStyle(w, col, a);
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.strokePath();
  };
  const diamond = (x, y, r, col, a, w = 2) => { diamondPath(x, y, r, w + 2.5, KEY, 0.7 * a); diamondPath(x, y, r, w, col, a); };
  const brackets = (x, y, r, col, a) => {
    const k = r * 0.45;
    for (const [w, c, al] of [[5, KEY, 0.6 * a], [2.5, col, a]]) {
      g.lineStyle(w, c, al);
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        g.beginPath(); g.moveTo(x + sx * r, y + sy * (r - k)); g.lineTo(x + sx * r, y + sy * r); g.lineTo(x + sx * (r - k), y + sy * r); g.strokePath();
      }
    }
  };
  function draw(p, dt) {
    g.clear();
    const showing = st.phase === 'targeting' && clock - st.downAt >= C.showMs && p?.alive;
    if (showing) {
      // 1 preparation: the cone
      const half = Phaser.Math.DegToRad(C.coneDeg), R = PLAYER.superRange;
      const a0 = st.heading - half, a1 = st.heading + half;
      const grow = Math.min(1, (clock - st.downAt - C.showMs) / 120);
      // the zone itself, barely there, so the edges read as a shape and not two stray lines
      g.fillStyle(VIOLET, 0.07 * grow);
      g.beginPath(); g.moveTo(p.x + Math.cos(a0) * 40, p.y + Math.sin(a0) * 40); g.arc(p.x, p.y, R * grow, a0, a1, false);
      g.lineTo(p.x + Math.cos(a1) * 40, p.y + Math.sin(a1) * 40); g.closePath(); g.fillPath();
      g.lineStyle(2, ICE, 0.45 * grow);
      g.lineBetween(p.x + Math.cos(a0) * 40, p.y + Math.sin(a0) * 40, p.x + Math.cos(a0) * R * grow, p.y + Math.sin(a0) * R * grow);
      g.lineBetween(p.x + Math.cos(a1) * 40, p.y + Math.sin(a1) * 40, p.x + Math.cos(a1) * R * grow, p.y + Math.sin(a1) * R * grow);
      g.lineStyle(3, VIOLET, 0.5 * grow);
      g.beginPath(); g.arc(p.x, p.y, R * grow, a0, a1, false); g.strokePath();
      // centre ticks along the heading, so the pivot reads
      g.lineStyle(2, ICE, 0.35 * grow);
      for (let d = 90; d < R * grow; d += 110) g.lineBetween(p.x + Math.cos(st.heading) * d, p.y + Math.sin(st.heading) * d, p.x + Math.cos(st.heading) * (d + 14), p.y + Math.sin(st.heading) * (d + 14));
      // 2 acquisition
      for (const [e, d] of st.dwell) {
        if (!live(e)) continue;
        const u = d / C.dwellMs, r = (e.cfg?.radius ?? 22) * (1.7 - 0.55 * u);
        brackets(e.x, e.y, r, VIOLET, 0.45 + 0.5 * u);
      }
      // 3 locks + tethers + pips
      st.locks.forEach((e, k) => {
        if (!live(e)) return;
        const r = (e.cfg?.radius ?? 22) * 1.15;
        g.lineStyle(2, VIOLET, 0.45); g.lineBetween(p.x, p.y, e.x, e.y);
        diamond(e.x, e.y, r, ICE, 0.95, 3);
        g.fillStyle(KEY, 0.7); g.fillCircle(e.x, e.y, 5); g.fillStyle(VIOLET, 1); g.fillCircle(e.x, e.y, 3.5);
        for (let i = 0; i <= k; i++) { g.fillStyle(KEY, 0.7); g.fillRect(e.x - r + i * 7 - 1, e.y - r - 11, 6, 6); g.fillStyle(ICE, 1); g.fillRect(e.x - r + i * 7, e.y - r - 10, 4, 4); }
      });
    }
    // 4 release / 5 impact / lock pops (independent of the phase)
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const f = st.fx[i]; f.t += dt;
      const u = f.t / f.life;
      if (u >= 1) { st.fx.splice(i, 1); continue; }
      const x = f.e && live(f.e) ? f.e.x : f.x, y = f.e && live(f.e) ? f.e.y : f.y;
      const R0 = (f.e?.cfg?.radius ?? 22);
      if (f.kind === 'lock') diamond(x, y, R0 * (1.9 - 0.75 * u), ICE, 1 - u, 3);
      else if (f.kind === 'release') {
        diamond(x, y, R0 * (1.15 + 0.6 * u), ICE, 1 - u, 3);
        if (p?.alive) { g.lineStyle(2.5, VIOLET, 0.7 * (1 - u)); g.lineBetween(p.x + (x - p.x) * u, p.y + (y - p.y) * u, x, y); }
      } else if (f.kind === 'impact') {
        g.lineStyle(3, VIOLET, 0.85 * (1 - u)); g.strokeCircle(x, y, 14 + 46 * u);
        g.lineStyle(1.5, ICE, 0.7 * (1 - u)); g.strokeCircle(x, y, 8 + 30 * u);
      }
    }
  }

  const onPost = (time, delta) => tick(typeof delta === 'number' && delta > 0 ? delta : 0);
  scene.events.on('postupdate', onPost);
  return {
    state: st, stats, begin, commit, cancel, config: C,
    destroy() {
      scene.events.off('postupdate', onPost);
      scene.events.off('pause', onPause);
      scene.events.off('enemy-hit', onHit);
      if (kb) { kb.off('keydown-F', keyDown); kb.off('keyup-F', keyUp); kb.off('keydown-ENTER', keyDown); kb.off('keyup-ENTER', keyUp); }
      if (typeof window !== 'undefined') window.removeEventListener('blur', onBlur);
      try { g.destroy(); } catch (_) { /* */ }
    },
  };
}
