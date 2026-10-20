// DIAGNOSTIC — PHASE 3C-B: WHY THE MARKSMAN AND THE BULWARK STOP FIGHTING.
// Prints numbers and writes `docs/evidence/tactical-engagement-audit/`;
// asserts nothing. Every run is the REAL game in the REAL Detention Block —
// cover, props, nav grid and LOS rects exactly as the room loads them — seeded
// (`Math.random` is an LCG with a draw counter) on a 60Hz fixed step.
//
// THE INSTRUMENT IS OBSERVE-ONLY. On each ordinary Marksman (`sniper`) and
// Bulwark (`shielded`) it wraps the actor's OWN `_tickSwarm` and `_moveToward`
// and calls straight through: before the tick it reads what the AI is about to
// read (`canSee`, `_hasLOS` from the same position against the same player),
// after it the velocity the tick commanded, and after the physics step what
// actually happened (displacement, `body.blocked`). It draws no random number
// and writes no gameplay field — `canSee`, `_hasLOS`, `_standable`,
// `navGrid.findPath` and `getNearestWalkable` are pure. The trace (every
// enemy's position + the draw counter, every tick) is what the films verify
// against, and it is identical with the instrument on or off (`--check`).
//
// usage: node tests/diag-tactical-engagement.mjs [--only=geo,staged,enc] [--seeds=3] [--out=DIR] [--check]
//        node tests/diag-tactical-engagement.mjs --report [--csv=A.csv+B.csv]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { CHROME, bootPage } from './diag-stuck-audit.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const OUT = opt('out', new URL('../docs/evidence/tactical-engagement-audit/', import.meta.url).pathname);

// the handset's own flags (the human played with all three)
export const HANDSET = 'roster=v1&gait=v2&move=v22';
export const VARIANTS = {
  frozen: HANDSET,
  mkB: `${HANDSET}&marksmanStuck=early`,
  bwB: `${HANDSET}&bulwarkStuck=early`,
};
export const Q = {
  mixed: 'encdbg=mixed&room=detention&sector=12&wave=2',
  nest: 'encdbg=sniperNest&room=detention&sector=8&wave=2',
  vanguard: 'encdbg=vanguard&room=hangar&sector=8&wave=2&nochamp=1',
  vanguardCaptain: 'encdbg=vanguard&room=hangar&sector=8&wave=2',
  stagedRoom: 'encdbg=1&room=detention&sector=12&wave=1',
};

// row layout (one flat array per actor per tick)
export const R = { tick: 0, x: 1, y: 2, px: 3, py: 4, branch: 5, cmd: 6, ivx: 7, ivy: 8, dx: 9, dy: 10, blk: 11, see: 12, los: 13, blocker: 14, hidden: 15,
  fireCd: 16, charging: 17, shot: 18, stag: 19, mvx: 20, mvy: 21, mates: 22, reach: 23, alt: 24, perf: 25, warn: 26, chargeStart: 27, chargeCancel: 28, line: 29 };
export const BRANCH = ['NOTICK', 'APPROACH', 'HOLD', 'RETREAT', 'SCREEN_HOLD', 'SCREEN_MOVE'];
export const CMD = ['NOTICK', 'MOVE', 'SIDESTEP', 'STOP', 'VELOCITY'];

// ── page side ──────────────────────────────────────────────────────────────
export async function installTac(page) {
  await page.evaluate(() => {
    const gs = window.__gs, P = gs.player;
    const T = window.__tac = { tick: 0, list: [], trace: [], hits: [], on: true, pilot: null, fire: 0, firedP: 0 };

    // ── pure geometry helpers (no RNG, no state) ──
    const segHits = (x1, y1, x2, y2, r) => {
      let t0 = 0, t1 = 1;
      const dx = x2 - x1, dy = y2 - y1;
      const p = [-dx, dx, -dy, dy], q = [x1 - r.x, r.right - x1, y1 - r.y, r.bottom - y1];
      for (let k = 0; k < 4; k++) {
        if (p[k] === 0) { if (q[k] < 0) return false; continue; }
        const t = q[k] / p[k];
        if (p[k] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
      }
      return true;
    };
    // the nearest rect cutting the line, with `_hasLOS`'s own endpoint exclusion
    T.blocker = (x1, y1, x2, y2) => {
      const RS = gs.losRects || [];
      let best = -1, bd = Infinity;
      for (let i = 0; i < RS.length; i++) {
        const r = RS[i];
        if (x1 >= r.x && x1 <= r.right && y1 >= r.y && y1 <= r.bottom) continue;
        if (x2 >= r.x && x2 <= r.right && y2 >= r.y && y2 <= r.bottom) continue;
        if (segHits(x1, y1, x2, y2, r)) { const d = Math.hypot(r.centerX - x1, r.centerY - y1); if (d < bd) { bd = d; best = i; } }
      }
      return best;
    };
    T.geo = () => {
      const ws = gs.walls.getChildren().filter((o) => o.active && o.body);
      return (gs.losRects || []).map((r, i) => {
        const w = ws[i];
        const vb = w?.getBounds?.();
        return { i, key: w?.texture?.key ?? '?', cx: Math.round(r.centerX), cy: Math.round(r.centerY), bw: r.width, bh: r.height,
          vx: vb ? Math.round(vb.x) : null, vy: vb ? Math.round(vb.y) : null, vw: vb ? Math.round(vb.width) : null, vh: vb ? Math.round(vb.height) : null };
      });
    };
    const NG = () => gs.navGrid;
    const cellOf = (x, y) => { const g = NG(); return g.getNearestWalkable(Math.max(0, Math.min(g.cols - 1, Math.floor(x / g.gridSize))), Math.max(0, Math.min(g.rows - 1, Math.floor(y / g.gridSize)))); };
    T.reach = (x1, y1, x2, y2) => {
      const a = cellOf(x1, y1), b = cellOf(x2, y2);
      if (a.x === b.x && a.y === b.y) return Math.hypot(x2 - x1, y2 - y1);
      const p = NG().findPath(x1, y1, x2, y2);
      if (p.length <= 1) return -1;
      let L = 0, px = x1, py = y1;
      for (const n of p) { L += Math.hypot(n.x - px, n.y - py); px = n.x; py = n.y; }
      return L;
    };
    // the nearest reachable spot in the role's own band with a clear line to the player
    T.altSpot = (e) => {
      const sn = e.enemyType === 'sniper';
      const radii = sn ? [340, 420, 500, 580] : [130, 180, 230, 280];
      let best = null;
      for (const r of radii) for (let k = 0; k < 24; k++) {
        const b = k * Math.PI / 12, cx = P.x + Math.cos(b) * r, cy = P.y + Math.sin(b) * r;
        if (!e._standable(cx, cy) || !e._hasLOS(cx, cy, P.x, P.y)) continue;
        const L = T.reach(e.x, e.y, cx, cy);
        if (L < 0) continue;
        if (!best || L < best.L) best = { x: cx, y: cy, L };
      }
      return best;
    };

    // THE QUESTION A FIX WOULD ASK, with machinery that already exists: is
    // there a spot ON THE ROLE'S OWN BAND, at about its current range, that
    // `_standable` accepts, that has a line to the player, and that this body
    // can walk to in a STRAIGHT line (`_scoreSpot`'s three-ray body test)?
    // Lateral steps of 40px along the arc up to 480px each way, at the current
    // range and +-80. Deterministic — no jitter, no RNG.
    T.lineSpot = (e) => {
      const sn = e.enemyType === 'sniper';
      const [lo, hi] = sn ? [e.cfg.retreatRange + 40, e.cfg.desiredRange + 40] : [130, e.cfg.desiredRange + 20];
      const d0 = Math.hypot(e.x - P.x, e.y - P.y), phi = Math.atan2(e.y - P.y, e.x - P.x);
      const off = (e.cfg.radius || 22) * 0.8;
      let best = null;
      for (const dr of [0, -80, 80]) {
        const r = Math.max(lo, Math.min(hi, d0 + dr));
        for (let k = 1; k <= 12; k++) for (const sg of [1, -1]) {
          const b = phi + sg * k * 40 / r, cx = P.x + Math.cos(b) * r, cy = P.y + Math.sin(b) * r;
          const d = Math.hypot(cx - e.x, cy - e.y);
          if (best && d >= best.d) continue;
          if (!e._standable(cx, cy) || !e._hasLOS(cx, cy, P.x, P.y)) continue;
          const tl = d || 1, ox = -(cy - e.y) / tl * off, oy = (cx - e.x) / tl * off;
          if (!(e._hasLOS(e.x, e.y, cx, cy) && e._hasLOS(e.x + ox, e.y + oy, cx + ox, cy + oy) && e._hasLOS(e.x - ox, e.y - oy, cx - ox, cy - oy))) continue;
          best = { x: cx, y: cy, d };
        }
      }
      return best;
    };

    // ── the observe-only wrapper ──
    // the subjects, and — as a CONTROL in the same fights — the two roles
    // whose approved v2.2 movement already refuses to stand blind
    const subject = (e) => (e.enemyType === 'sniper' || e.enemyType === 'shielded') && !e._miniBoss && !e.isChampion;
    const control = (e) => (e.enemyType === 'shooter' || e.enemyType === 'grunt') && !e._miniBoss && !e.isChampion;
    const tracked = (e) => subject(e) || control(e);
    T.wrap = (e) => {
      if (e.__tac) return;
      const r = { id: T.list.length, e, type: e.enemyType, ref: control(e), elite: !!e._elite, screen: !!e._screen, born: T.tick, rows: [], cur: null,
        shotsN: 0, warnPrev: false, chgPrev: false, dead: null, alt: null };
      e.__tac = r; T.list.push(r);
      const tick0 = e._tickSwarm, mv0 = e._moveToward;
      e._tickSwarm = function (delta, player) {
        if (!T.on) return tick0.call(this, delta, player);
        r.cur = { see: this.canSee(player), los: this._hasLOS(this.x, this.y, player.x, player.y), x0: this.x, y0: this.y, mv: null, side: (this._stuckSidestepMs || 0) > 0 };
        const out = tick0.call(this, delta, player);
        r.cur.ivx = this.body.velocity.x; r.cur.ivy = this.body.velocity.y;
        return out;
      };
      e._moveToward = function (tx, ty, speed) {
        if (r.cur && !r.cur.mv) r.cur.mv = { tx, ty, side: (this._stuckSidestepMs || 0) > 0 };
        return mv0.call(this, tx, ty, speed);
      };
    };
    gs.events.on('shooter-fire', (e) => { if (e?.__tac) e.__tac.shotsN++; });
    const pd = P.damage;
    P.damage = function (amt, ...rest) { T.hits.push([T.tick, amt]); return pd.call(this, amt, ...rest); };

    T.hash = () => {
      let h = Math.round(P.x * 10) * 7 + Math.round(P.y * 10);
      for (const e of gs.enemies.getChildren()) if (e.active) h = (h * 31 + Math.round(e.x * 10) * 7 + Math.round(e.y * 10)) % 1e9;
      return h;
    };

    // ── one tick: drive the player, step the game, record ──
    T.step = () => {
      const i = T.tick;
      if (T.pilot) T.pilot(i);
      if (T.fire && i >= 60 && i % T.fire === 0) { P.keyboardFire(); T.firedP++; }
      for (const r of T.list) r.cur = null;
      const before = new Map(T.list.map((r) => [r, [r.e.x, r.e.y, r.shotsN]]));
      window.__adv(1);
      T.tick++;
      for (const e of gs.enemies.getChildren()) if (e.active && e.alive && tracked(e) && !e.__tac) T.wrap(e);
      if (T.on) for (const r of T.list) {
        const e = r.e;
        if (!(e.active && e.alive)) { if (r.dead == null) r.dead = T.tick; continue; }
        const b = before.get(r);
        if (!b) continue;          // wrapped this tick: no AI tick observed yet
        const c = r.cur, sn = r.type === 'sniper';
        const x0 = c ? c.x0 : b[0], y0 = c ? c.y0 : b[1];
        const dist = Math.hypot(P.x - x0, P.y - y0);
        let branch = 0;
        if (c && !r.ref) {
          if (sn) branch = dist < e.cfg.retreatRange ? 3 : dist > e.cfg.desiredRange + 80 ? 1 : 2;
          else if (r.screen) branch = e._screenHolding ? 4 : 5;
          else branch = dist > e.cfg.desiredRange + 30 ? 1 : 2;
        }
        const cmd = !c ? 0 : c.mv ? (c.mv.side ? 2 : 1) : (Math.hypot(c.ivx, c.ivy) > 1 ? 4 : 3);
        const bl = e.body.blocked;
        const blk = (bl.up ? 1 : 0) | (bl.down ? 2 : 0) | (bl.left ? 4 : 0) | (bl.right ? 8 : 0);
        let mates = 0;
        for (const o of gs.enemies.getChildren()) if (o !== e && o.active && o.alive && Math.hypot(o.x - e.x, o.y - e.y) < 60) mates++;
        const valid = c && c.see && c.los;
        let reach = -1, alt = -1, line = -1;
        if (!r.ref && (T.tick - r.born) % 30 === 0) {
          reach = T.reach(e.x, e.y, P.x, P.y) >= 0 ? 1 : 0;
          if (!valid) {
            const a = T.altSpot(e); r.alt = a; alt = a ? Math.round(a.L) : 0;
            const l = T.lineSpot(e); r.line = l; line = l ? Math.round(l.d) : 0;
          }
        }
        const warn = !!e._warnFlashed, chg = !!e._charging;
        const shot = r.shotsN - b[2];
        r.rows.push([T.tick, +e.x.toFixed(1), +e.y.toFixed(1), Math.round(P.x), Math.round(P.y), branch, cmd,
          c ? Math.round(c.ivx) : 0, c ? Math.round(c.ivy) : 0, +(e.x - b[0]).toFixed(2), +(e.y - b[1]).toFixed(2), blk,
          c ? +c.see : -1, c ? +c.los : -1, c && !c.los ? T.blocker(x0, y0, P.x, P.y) : -1, +!!P.hiddenInBush,
          Math.round(e.fireCd ?? 0), +chg, shot, +((e._staggerMs || 0) > 0), c?.mv ? Math.round(c.mv.tx) : -1, c?.mv ? Math.round(c.mv.ty) : -1,
          mates, reach, alt, +!!e._performing, +(warn && !r.warnPrev), +(chg && !r.chgPrev), +(!chg && r.chgPrev && shot === 0), line]);
        r.warnPrev = warn; r.chgPrev = chg;
      }
      T.trace.push([T.hash(), window.__draws]);
    };

    // ── the player autopilot: real keys, real physics, real collisions ──
    const press = (tx, ty, dead) => {
      const K = gs.keys, dx = tx - P.x, dy = ty - P.y;
      K.D.isDown = dx > dead; K.A.isDown = dx < -dead; K.S.isDown = dy > dead; K.W.isDown = dy < -dead;
    };
    // a person walks AROUND a console: route on the room's own NavGrid (a
    // pure BFS read) and press toward the next node; straight at the target
    // once it is in the same cell or the grid has no route
    const route = { tx: null, ty: null, path: null, k: 0, age: 0 };
    const keys = (tx, ty, dead = 10) => {
      if (route.tx == null || Math.hypot(tx - route.tx, ty - route.ty) > 40 || ++route.age > 45) {
        route.tx = tx; route.ty = ty; route.age = 0; route.k = 0;
        const pth = gs.navGrid.findPath(P.x, P.y, tx, ty);
        route.path = pth.length > 1 ? pth : null;
      }
      if (route.path) {
        while (route.k < route.path.length - 1 && Math.hypot(route.path[route.k].x - P.x, route.path[route.k].y - P.y) < 30) route.k++;
        const n = route.path[route.k];
        if (route.k < route.path.length - 1 || Math.hypot(n.x - tx, n.y - ty) > 60) return press(n.x, n.y, 6);
      }
      press(tx, ty, dead);
    };
    const stop = () => { const K = gs.keys; K.A.isDown = K.D.isDown = K.W.isDown = K.S.isDown = false; };
    const threats = () => {
      const a = gs.enemies.getChildren().filter((e) => e.active && e.alive && subject(e));
      return a.length ? a : gs.enemies.getChildren().filter((e) => e.active && e.alive);
    };
    const centroid = () => { const a = threats(); if (!a.length) return null; let x = 0, y = 0; for (const e of a) { x += e.x; y += e.y; } return { x: x / a.length, y: y / a.length }; };
    const covers = () => (gs.roomSpec.cover || []).map((c) => ({ x: c.x, y: c.y }));
    const hideAt = (c, from) => {
      if (!from) return { x: c.x, y: c.y + 70 };
      const dx = c.x - from.x, dy = c.y - from.y, d = Math.hypot(dx, dy) || 1;
      return { x: c.x + dx / d * 70, y: c.y + dy / d * 70 };
    };
    T.pilots = {
      stand: (o) => (i) => { if (i === 0) { P.setPosition(o.x, o.y); P.body.reset(o.x, o.y); } stop(); },
      // keyframes [tick, x, y]: the player is PLACED (staged cases only)
      keys: (o) => (i) => {
        const kf = o.kf; let a = kf[0], b = kf[kf.length - 1];
        for (let k = 0; k < kf.length - 1; k++) if (i >= kf[k][0] && i <= kf[k + 1][0]) { a = kf[k]; b = kf[k + 1]; break; }
        const u = i >= b[0] ? 1 : b[0] === a[0] ? 1 : (i - a[0]) / (b[0] - a[0]);
        const x = a[1] + (b[1] - a[1]) * u, y = a[2] + (b[2] - a[2]) * u;
        P.setPosition(x, y); P.body.reset(x, y); stop();
      },
      // a human-ish loop: hide behind a checkpoint console, step into the open and shoot, hide behind the other
      handset: () => {
        const st = { k: 0, t: 0, all: 0 };
        // the two cover objects nearest the room's centre — in Detention the
        // checkpoint consoles (600,680) and (1000,680), the human's own pair
        const B = gs.roomSpec.bounds, cps = covers().sort((a, b) => Math.hypot(a.x - B.w / 2, a.y - B.h / 2) - Math.hypot(b.x - B.w / 2, b.y - B.h / 2)).slice(0, 2);
        const mid = { x: (cps[0].x + cps[1].x) / 2, y: (cps[0].y + cps[1].y) / 2 };
        const plan = [['hide', 0, 150], ['go', { x: mid.x, y: mid.y + 150 }, 90], ['hide', 1, 150], ['go', { x: mid.x, y: mid.y - 100 }, 90]];
        return (i) => {
          const [kind, arg, dur] = plan[st.k];
          const tgt = kind === 'go' ? arg : hideAt(cps[arg], centroid());
          keys(tgt.x, tgt.y);
          if (Math.hypot(tgt.x - P.x, tgt.y - P.y) < 24) st.t++;
          if (++st.all > dur + 300) st.t = dur;              // could not get there: move on, as a person would
          if (st.t >= dur) { st.t = 0; st.all = 0; st.k = (st.k + 1) % plan.length; }
        };
      },
      // stay behind whichever console is nearest, on the far side from the threat
      hide: () => { let tgt = null; return (i) => { if (i % 60 === 0 || !tgt) { const c = centroid(); const cs = covers(); cs.sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y)); tgt = hideAt(cs[0], c); } keys(tgt.x, tgt.y); }; },
      // orbit one console
      circle: (o = {}) => { let c = null; return (i) => {
        if (!c) { const cs = covers().sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y)); c = { x: o.cx ?? cs[0].x, y: o.cy ?? cs[0].y }; }
        const a = i * 0.02; keys(c.x + Math.cos(a) * 112, c.y + Math.sin(a) * 112, 6);
      }; },
      // alternate between two consoles' shadows every 4s
      hop: () => { const B = gs.roomSpec.bounds, cps = covers().sort((a, b) => Math.hypot(a.x - B.w / 2, a.y - B.h / 2) - Math.hypot(b.x - B.w / 2, b.y - B.h / 2)).slice(0, 2);
        return (i) => { const t = hideAt(cps[Math.floor(i / 240) % 2], centroid()); keys(t.x, t.y); }; },
      // run at the nearest Marksman / Bulwark, sit on it a second, pick the next
      charge: () => { let hold = 0, tgt = null; return () => {
        if (!tgt || !(tgt.active && tgt.alive) || hold > 60) { const a = threats(); a.sort((p, q) => Math.hypot(p.x - P.x, p.y - P.y) - Math.hypot(q.x - P.x, q.y - P.y)); tgt = a[0] || null; hold = 0; }
        if (!tgt) return stop();
        if (Math.hypot(tgt.x - P.x, tgt.y - P.y) < 90) { hold++; stop(); } else keys(tgt.x, tgt.y);
      }; },
      // go to the corner farthest from the threat and stay
      retreat: () => { let tgt = null; return (i) => { if (i % 120 === 0 || !tgt) { const c = centroid() || { x: 800, y: 700 }; const cs = [[90, 90], [1510, 90], [90, 1310], [1510, 1310]].map(([x, y]) => ({ x, y })); cs.sort((a, b) => Math.hypot(b.x - c.x, b.y - c.y) - Math.hypot(a.x - c.x, a.y - c.y)); tgt = cs[0]; } keys(tgt.x, tgt.y); }; },
      // loop the room's edge, behind everybody
      behind: () => { const wp = [{ x: 120, y: 120 }, { x: 1480, y: 120 }, { x: 1480, y: 1280 }, { x: 120, y: 1280 }]; let k = 0; return () => { const t = wp[k]; keys(t.x, t.y, 20); if (Math.hypot(t.x - P.x, t.y - P.y) < 40) k = (k + 1) % wp.length; }; },
    };

    // ── a staged case INSIDE the loaded room: the spawner off, the room intact ──
    T.stage = (sc) => {
      gs.arenaActive = false;
      for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
      for (const g of gs.hostileBullets || []) for (const b of g.getChildren()) if (b.active) { b.setActive(false).setVisible(false); b.body && (b.body.enable = false); }
      gs._moteTimer = 0; gs.cameras.main.resetFX(); gs.tweens.killAll(); gs.time.removeAllEvents();
      window.__seed(sc.seed); window.__draws = 0;
      T.tick = 0; T.list.length = 0; T.trace.length = 0; T.hits.length = 0; T.firedP = 0;
      T.fire = sc.fire || 0;
      const pl = sc.player;
      T.pilot = T.pilots[pl.mode](pl);
      if (pl.x != null) { P.setPosition(pl.x, pl.y); P.body.reset(pl.x, pl.y); }
      P.hp = P.hpMax;
      for (const a of sc.actors) { const e = gs.spawnEnemyAt(a.type, a.x, a.y, { ...(a.elite ? { elite: true } : {}), ...(a.spec || {}) }); T.wrap(e); }
    };
    // a real encounter: the wave the URL started, from tick 0 of the seed
    T.begin = ({ seed, pilot, fire = 7 }) => {
      window.__seed(seed); window.__draws = 0;
      T.tick = 0; T.list.length = 0; T.trace.length = 0; T.hits.length = 0; T.firedP = 0;
      T.fire = fire;
      T.pilot = T.pilots[pilot.mode](pilot);
      for (const e of gs.enemies.getChildren()) if (e.active && e.alive && tracked(e)) T.wrap(e);
    };
    T.collect = () => {
      const roles = {};
      for (const e of gs.enemies.getChildren()) { if (!(e.active && e.alive)) continue; const k = (e.enemyType ?? (e.isChampion ? 'champion' : '?')) + (e._elite ? '-E' : '') + (e._miniBoss ? '-nem' : ''); roles[k] = (roles[k] || 0) + 1; }
      return { actors: T.list.map((r) => ({ id: r.id, type: r.type, ref: r.ref, elite: r.elite, screen: r.screen, born: r.born, dead: r.dead, rows: r.rows })),
        hits: T.hits.slice(), draws: window.__draws, trace: T.trace.slice(), firedP: T.firedP, roles, geo: T.geo() };
    };
  });
}

// ── node side: what each tick MEANS ───────────────────────────────────────
const MOVING_PX = 0.5;   // px per tick = 30 px/s: below this the body is standing
export function reasonOf(w, type) {
  const sn = type === 'sniper';
  const sp = Math.hypot(w[R.dx], w[R.dy]);
  const iv = Math.hypot(w[R.ivx], w[R.ivy]);
  const br = w[R.branch], valid = w[R.see] === 1 && w[R.los] === 1;
  if (w[R.perf]) return 'SCRIPTED_MOVE';
  if (w[R.cmd] === 0) return w[R.stag] ? 'STAGGERED' : 'NO_AI_TICK';
  if (w[R.cmd] === 2) return sp < MOVING_PX ? 'STUCK_RECOVERY_BLOCKED' : 'STUCK_RECOVERY';
  if (sp >= MOVING_PX) {
    // moving: is it getting anywhere it was told to go?
    if (iv > 1) { const prog = (w[R.dx] * w[R.ivx] + w[R.dy] * w[R.ivy]) / iv; if (prog < 0.3 * iv / 60) return 'MOVING_NO_PROGRESS'; }
    return br === 3 ? 'RETREATING' : br === 2 || br === 4 ? 'HOLD_DRIFT' : 'MOVING';
  }
  if (iv > 1) return br === 3 ? 'RETREAT_BLOCKED' : 'APPROACH_BLOCKED';
  if (sn && w[R.charging]) return 'CHARGING';
  const hold = br === 2 ? 'HOLD' : br === 4 ? 'FORMATION_HOLD' : 'STOPPED';
  if (valid) return `${hold}_VALID_LINE`;          // waiting on its own cooldown, line open
  if (w[R.hidden]) return `${hold}_PLAYER_CONCEALED`;
  if (w[R.los] === 0) return `${hold}_LOS_BLOCKED`;
  return `${hold}_OUT_OF_SIGHT_RANGE`;
}

const ms = (t) => Math.round(t * 1000 / 60);
export function analyse(res, meta, geo) {
  const label = (i) => (i < 0 || !geo[i] ? '' : `${geo[i].key}@${geo[i].cx},${geo[i].cy}`);
  const actorRows = [], intervals = [];
  for (const a of res.actors) {
    const rows = a.rows;
    if (rows.length < 10) continue;
    const reasons = {};
    let validT = 0, attempts = 0, shots = 0, cancels = 0, blockedT = 0, noProgT = 0, sideT = 0, standNoFireT = 0;
    let reachN = 0, unreachN = 0, altN = 0, altNone = 0, altSum = 0, mates = 0, matesMax = 0, lineN = 0, lineNone = 0, lineSum = 0;
    let lastAtt = rows[0][R.tick], longestNoAttempt = 0, longestPassive = 0, curPassive = 0, longestValidNoAtt = 0, validNoAttCur = 0;
    let losLossEp = 0, losLossReact = 0, losLossNever = 0;
    let lossStart = null, reacted = false;
    // REACQUISITION: a line that comes back after >= 0.5s blind — how long
    // until the first attack (Marksman: charge start, others: WARN)? An
    // episode that loses the line again first is CENSORED, counted apart
    let blindRun = 0, reacq = null, reacqN = 0, reacqSum = 0, reacqMax = 0, reacqCens = 0;
    for (let k = 0; k < rows.length; k++) {
      const w = rows[k], rs = reasonOf(w, a.type);
      reasons[rs] = (reasons[rs] || 0) + 1;
      const valid = w[R.see] === 1 && w[R.los] === 1;
      if (valid) validT++;
      const att = a.type === 'sniper' ? w[R.chargeStart] : w[R.warn];
      if (att) { attempts++; longestNoAttempt = Math.max(longestNoAttempt, w[R.tick] - lastAtt); lastAtt = w[R.tick]; }
      shots += w[R.shot]; cancels += w[R.chargeCancel];
      if (w[R.blk] && Math.hypot(w[R.ivx], w[R.ivy]) > 1) blockedT++;
      if (rs === 'MOVING_NO_PROGRESS') noProgT++;
      if (rs.startsWith('STUCK_RECOVERY')) sideT++;
      const standing = Math.hypot(w[R.dx], w[R.dy]) < MOVING_PX;
      const passive = standing && !valid && !w[R.charging];
      if (passive) { standNoFireT++; curPassive++; longestPassive = Math.max(longestPassive, curPassive); } else curPassive = 0;
      if (valid && !w[R.charging] && !att) { validNoAttCur++; longestValidNoAtt = Math.max(longestValidNoAtt, validNoAttCur); } else validNoAttCur = 0;
      if (valid) {
        if (blindRun >= 30 && reacq == null) reacq = w[R.tick];
        blindRun = 0;
        if (reacq != null && (att || w[R.charging])) { const d = w[R.tick] - reacq; reacqN++; reacqSum += d; reacqMax = Math.max(reacqMax, d); reacq = null; }
      } else {
        if (reacq != null) { reacqCens++; reacq = null; }
        blindRun++;
      }
      if (w[R.reach] === 1) reachN++; else if (w[R.reach] === 0) unreachN++;
      if (w[R.alt] > 0) { altN++; altSum += w[R.alt]; } else if (w[R.alt] === 0) altNone++;
      if (w[R.line] > 0) { lineN++; lineSum += w[R.line]; } else if (w[R.line] === 0) lineNone++;
      mates += w[R.mates]; matesMax = Math.max(matesMax, w[R.mates]);
      // reaction to persistent LOS loss in a hold: did it move within 3s?
      const holdBr = w[R.branch] === 2 || w[R.branch] === 4 || a.ref;   // a control role has no hold branch: any blind tick counts
      if (!valid && holdBr && w[R.cmd] !== 0) {
        if (lossStart == null) { lossStart = w[R.tick]; reacted = false; }
        if (!standing) reacted = true;
      } else if (lossStart != null) {
        const dur = w[R.tick] - lossStart;
        if (dur >= 60) { losLossEp++; if (reacted) losLossReact++; else losLossNever++; }
        lossStart = null;
      }
    }
    if (lossStart != null && rows.at(-1)[R.tick] - lossStart >= 60) { losLossEp++; if (reacted) losLossReact++; else losLossNever++; }
    longestNoAttempt = Math.max(longestNoAttempt, rows.at(-1)[R.tick] - lastAtt);
    const n = rows.length, min = n / 3600;
    // contiguous intervals of one reason, >= 0.5s
    let s = 0;
    for (let k = 1; k <= rows.length; k++) {
      const ra = reasonOf(rows[s], a.type), rb = k < rows.length ? reasonOf(rows[k], a.type) : null;
      if (rb !== ra) {
        const dur = k - s;
        if (dur >= 30) {
          const w = rows[s];
          const blk = rows.slice(s, k).map((q) => q[R.blocker]).filter((b) => b >= 0);
          const top = blk.length ? Object.entries(blk.reduce((o, b) => ((o[b] = (o[b] || 0) + 1), o), {})).sort((p, q) => q[1] - p[1])[0][0] : -1;
          const alts = rows.slice(s, k).map((q) => q[R.alt]).filter((v) => v >= 0);
          const lns = rows.slice(s, k).map((q) => q[R.line]).filter((v) => v >= 0);
          intervals.push({ section: 'interval', ...meta, actor: a.id, type: a.type, elite: +a.elite, screen: +a.screen, reason: ra,
            startMs: ms(w[R.tick]), durMs: ms(dur), x: Math.round(w[R.x]), y: Math.round(w[R.y]),
            distToPlayer: Math.round(Math.hypot(w[R.px] - w[R.x], w[R.py] - w[R.y])), blocker: label(+top),
            altSpotSamples: alts.length, altSpotFound: alts.filter((v) => v > 0).length,
            altSpotPathPx: alts.filter((v) => v > 0).length ? Math.round(Math.min(...alts.filter((v) => v > 0))) : '',
            lineSpotSamples: lns.length, lineSpotFound: lns.filter((v) => v > 0).length,
            lineSpotPx: lns.filter((v) => v > 0).length ? Math.round(Math.min(...lns.filter((v) => v > 0))) : '' });
        }
        s = k;
      }
    }
    actorRows.push({ section: 'actor', ...meta, actor: a.id, type: a.type, control: +!!a.ref, elite: +a.elite, screen: +a.screen, liveMs: ms(n),
      attemptsPerMin: +(attempts / min).toFixed(2), shotsPerMin: +(shots / min).toFixed(2), attempts, shots, cancels,
      validLineFrac: +(validT / n).toFixed(3), noLineMs: ms(n - validT),
      standNoLineMs: ms(standNoFireT), standNoLineFrac: +(standNoFireT / n).toFixed(3),
      longestPassiveMs: ms(longestPassive), longestNoAttemptMs: ms(longestNoAttempt), longestValidLineNoAttemptMs: ms(longestValidNoAtt),
      blockedMs: ms(blockedT), noProgressMs: ms(noProgT), stuckRecoveryMs: ms(sideT),
      reachSamples: reachN + unreachN, unreachableSamples: unreachN,
      altSamples: altN + altNone, altFound: altN, altNone, altMeanPathPx: altN ? Math.round(altSum / altN) : '',
      lineSamples: lineN + lineNone, lineFound: lineN, lineMeanPx: lineN ? Math.round(lineSum / lineN) : '',
      losLossEpisodes: losLossEp, losLossReacted: losLossReact, losLossNeverMoved: losLossNever,
      reacqEpisodes: reacqN, reacqToAttackMeanMs: reacqN ? ms(reacqSum / reacqN) : '', reacqToAttackMaxMs: reacqN ? ms(reacqMax) : '', reacqLostAgainFirst: reacqCens,
      matesMean: +(mates / n).toFixed(2), matesMax,
      ...Object.fromEntries(Object.entries(reasons).map(([k, v]) => [`r_${k}`, ms(v)])) });
  }
  // the player's side: what the enemies actually did to them
  const by = (amt) => res.hits.filter((h) => h[1] === amt).length;
  const run = { section: 'run', ...meta, ticks: res.trace.length, draws: res.draws, roles: Object.entries(res.roles).map(([k, v]) => `${k}:${v}`).join(' '),
    hitsAll: res.hits.length, hitsMarksman: by(220), hitsBulwark: by(120), hitsGunner: by(130), hitsRifleman: by(80), playerShots: res.firedP,
    subjects: res.actors.filter((a) => !a.ref).length, controls: res.actors.filter((a) => a.ref).length };
  return { actorRows, intervals, run };
}

// ── staged cases, in the real Detention Block ─────────────────────────────
// The room as it LOADS (`detention-geometry.json`), not as `rooms.js` reads —
// cover is snapped to nav-cell centres: 70x70 console bodies at
// (440|840|1240, 280|1080) and (600|1000, 680); bunk bodies 120x60 centred
// (700,450) (780,515) (1290,850) (420,930); the post 200x110 centred
// (260,1175). Ticks are 60Hz.
const SN = { type: 'sniper' }, SNE = { type: 'sniper', elite: true }, SH = { type: 'shielded' }, SHE = { type: 'shielded', elite: true };
const SCREEN = { vanguardScreen: { holdPx: 140, resumePx: 165 } };   // VANGUARD_SCREEN, encounters.js
export const STAGED = {
  M1_clear_hold: { ticks: 900, actors: [{ ...SN, x: 1450, y: 1000 }], player: { mode: 'stand', x: 950, y: 1000 } },
  M2_blocked_hold: { ticks: 1200, actors: [{ ...SN, x: 1000, y: 250 }], player: { mode: 'stand', x: 1000, y: 770 } },
  M2e_blocked_hold_elite: { ticks: 1200, actors: [{ ...SNE, x: 1000, y: 250 }], player: { mode: 'stand', x: 1000, y: 770 } },
  M3_far_side_moving: { ticks: 1200, actors: [{ ...SN, x: 1000, y: 250 }], player: { mode: 'keys', kf: [[0, 975, 770], [180, 1025, 770], [360, 975, 770], [540, 1025, 770], [720, 975, 770], [900, 1025, 770], [1080, 975, 770], [1200, 1000, 770]] } },
  M4a_post: { ticks: 1500, actors: [{ ...SN, x: 260, y: 1310 }], player: { mode: 'stand', x: 300, y: 380 } },
  M4b_bunks: { ticks: 1500, actors: [{ ...SN, x: 760, y: 360 }], player: { mode: 'stand', x: 760, y: 1250 } },
  M5_retreat_into_cover: { ticks: 900, actors: [{ ...SN, x: 1000, y: 600 }], player: { mode: 'keys', kf: [[0, 1000, 250], [60, 1000, 250], [120, 1000, 400], [900, 1000, 400]] } },
  M5e_retreat_into_cover_elite: { ticks: 900, actors: [{ ...SNE, x: 1000, y: 600 }], player: { mode: 'keys', kf: [[0, 1000, 250], [60, 1000, 250], [120, 1000, 400], [900, 1000, 400]] } },
  M6_los_flicker: { ticks: 1200, actors: [{ ...SN, x: 1000, y: 250 }], player: { mode: 'keys', kf: Array.from({ length: 22 }, (_, k) => [[k * 54, k % 2 ? 1085 : 1000, 770], [k * 54 + 6, k % 2 ? 1000 : 1085, 770]]).flat() } },
  M7_three_marksmen: { ticks: 1200, actors: [{ ...SN, x: 600, y: 250 }, { ...SN, x: 1000, y: 250 }, { ...SNE, x: 1400, y: 300 }], player: { mode: 'stand', x: 1000, y: 770 } },
  B1_clear_hold: { ticks: 900, actors: [{ ...SH, x: 1300, y: 1000 }], player: { mode: 'stand', x: 1050, y: 1000 } },
  B2_blocked_hold: { ticks: 1200, actors: [{ ...SH, x: 1000, y: 250 }], player: { mode: 'stand', x: 1000, y: 790 } },
  B2e_blocked_hold_elite: { ticks: 1200, actors: [{ ...SHE, x: 1000, y: 250 }], player: { mode: 'stand', x: 1000, y: 790 } },
  B3_player_circles_console: { ticks: 1500, actors: [{ ...SH, x: 1000, y: 250 }], player: { mode: 'circle', x: 1112, y: 680 } },
  B4_narrow_approach: { ticks: 1500, actors: [{ ...SH, x: 250, y: 1320 }], player: { mode: 'stand', x: 420, y: 820 } },
  B5_three_bulwarks: { ticks: 1200, actors: [{ ...SH, x: 900, y: 250 }, { ...SH, x: 1000, y: 230 }, { ...SHE, x: 1100, y: 250 }], player: { mode: 'stand', x: 1000, y: 790 } },
  B7_screen_blocked: { ticks: 1200, actors: [{ ...SH, x: 1000, y: 250, spec: SCREEN }], player: { mode: 'stand', x: 1000, y: 790 } },
  B7b_screen_clear: { ticks: 900, actors: [{ ...SH, x: 1300, y: 1000, spec: SCREEN }], player: { mode: 'stand', x: 1000, y: 1000 } },
};

// ── run one case ──────────────────────────────────────────────────────────
export async function tacPage(browser, flags, q, seed = 4242) {
  const p = await bootPage(browser, { flags, q, seed });
  await installTac(p);
  await p.evaluate(() => { window.__headless = true; });
  return p;
}
export const runStaged = (p, sc) => p.evaluate((sc) => { window.__tac.stage(sc); for (let i = 0; i < sc.ticks; i++) window.__tac.step(); return window.__tac.collect(); }, sc);
export const runEnc = (p, o) => p.evaluate((o) => { window.__tac.begin(o); for (let i = 0; i < o.ticks; i++) window.__tac.step(); return window.__tac.collect(); }, o);

// ── the report: one table per question, read back from the CSVs ─────────
export function readCsv(file) {
  const [h, ...L] = readFileSync(file, 'utf8').trim().split('\n');
  const cols = h.split(',');
  return L.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v === '' ? '' : isNaN(+v) ? v : +v])));
}
export function report(rows) {
  const out = [];
  const P = (...a) => out.push(a.join(' '));
  const pct = (x) => `${(100 * x).toFixed(0)}%`;
  const NAME = { sniper: 'Marksman', shielded: 'Bulwark', shooter: 'Gunner(control)', grunt: 'Rifleman(control)' };
  const kind = (r) => (r.screen ? 'Bulwark-screen' : NAME[r.type] || r.type) + (r.elite ? '-E' : '');
  const grp = (arr, f) => arr.reduce((o, r) => ((o[f(r)] ||= []).push(r), o), {});
  const actors = rows.filter((r) => r.section === 'actor');
  const runs = rows.filter((r) => r.section === 'run');
  const ivs = rows.filter((r) => r.section === 'interval');
  // 1. per scenario x variant x role
  P('## per scenario / variant / role (actors pooled over seeds; time-weighted fractions)');
  P('scenario | variant | role | n actors | live s | attempts/min | shots/min | line open | stood blind | longest blind s (max / median) | LOS-loss >=1s episodes: never moved | blind samples with a NavGrid-reachable firing spot | mean path px | with a STRAIGHT-LINE band spot | mean px');
  const g1 = grp(actors, (r) => `${r.scenario}|${r.variant}|${kind(r).replace('-E', '')}`);
  for (const [k, a] of Object.entries(g1).sort()) {
    const live = a.reduce((s, r) => s + r.liveMs, 0) / 1000, min = live / 60;
    const att = a.reduce((s, r) => s + r.attempts, 0), sh = a.reduce((s, r) => s + r.shots, 0);
    const vl = a.reduce((s, r) => s + r.validLineFrac * r.liveMs, 0) / (live * 1000);
    const sb = a.reduce((s, r) => s + r.standNoLineMs, 0) / (live * 1000);
    const lp = a.map((r) => r.longestPassiveMs / 1000).sort((x, y) => x - y);
    const ep = a.reduce((s, r) => s + r.losLossEpisodes, 0), nv = a.reduce((s, r) => s + r.losLossNeverMoved, 0);
    const as = a.reduce((s, r) => s + (r.altSamples || 0), 0), af = a.reduce((s, r) => s + (r.altFound || 0), 0);
    const ap = a.filter((r) => r.altMeanPathPx !== ''), apm = ap.length ? Math.round(ap.reduce((s, r) => s + r.altMeanPathPx * r.altFound, 0) / Math.max(1, ap.reduce((s, r) => s + r.altFound, 0))) : '-';
    const ls = a.reduce((s, r) => s + (r.lineSamples || 0), 0), lf = a.reduce((s, r) => s + (r.lineFound || 0), 0);
    const lpm = lf ? Math.round(a.reduce((s, r) => s + (r.lineMeanPx || 0) * (r.lineFound || 0), 0) / lf) : '-';
    const [sc, v, role] = k.split('|');
    P(sc, '|', v, '|', role, '|', a.length, '|', live.toFixed(0), '|', (att / min).toFixed(1), '|', (sh / min).toFixed(1), '|', pct(vl), '|', pct(sb), '|',
      `${lp.at(-1).toFixed(1)} / ${lp[lp.length >> 1].toFixed(1)}`, '|', `${nv}/${ep}`, '|', as ? `${af}/${as}` : '-', '|', apm, '|', ls ? `${lf}/${ls}` : '-', '|', lpm);
  }
  // 2. what standing time IS, per role, all encounters, per variant
  P('', '## where the standing time goes (share of live time), encounters only');
  const enc = actors.filter((r) => String(r.scenario).includes(':'));
  const fam = (r) => String(r.scenario).split(':')[0];
  const g2 = grp(enc, (r) => `${fam(r)}|${r.variant}|${kind(r).replace('-E', '')}`);
  for (const [k, a] of Object.entries(g2).sort()) {
    const live = a.reduce((s, r) => s + r.liveMs, 0);
    const rs = {};
    for (const r of a) for (const [c, v] of Object.entries(r)) if (c.startsWith('r_') && v !== '') rs[c.slice(2)] = (rs[c.slice(2)] || 0) + v;
    P(k.replaceAll('|', ' | '), '| n', a.length, '| live', (live / 1000).toFixed(0), 's |', Object.entries(rs).sort((x, y) => y[1] - x[1]).filter(([, v]) => v / live >= 0.005).map(([c, v]) => `${c} ${pct(v / live)}`).join(', '));
  }
  // 2b. movement execution and group interference, same grouping
  P('', '## movement execution and group interference (encounters)');
  P('family | variant | role | n | blind standing | pressing a wall (cmd >1px/tick, body.blocked) | moving without progress | stuck sidestep | NavGrid reach samples: player unreachable | mates within 60px (mean / max) | longest valid line with no attack s (max)');
  for (const [k, a] of Object.entries(g2).sort()) {
    const live = a.reduce((s, r) => s + r.liveMs, 0);
    const sum = (c) => a.reduce((s, r) => s + (+r[c] || 0), 0);
    const mm = a.reduce((s, r) => s + r.matesMean * r.liveMs, 0) / live, mx = Math.max(...a.map((r) => r.matesMax));
    P(k.replaceAll('|', ' | '), '|', a.length, '|', pct(sum('standNoLineMs') / live), '|', pct(sum('blockedMs') / live), '|', pct(sum('noProgressMs') / live), '|', pct(sum('stuckRecoveryMs') / live), '|',
      `${sum('unreachableSamples')}/${sum('reachSamples')}`, '|', `${mm.toFixed(2)} / ${mx}`, '|', (Math.max(...a.map((r) => r.longestValidLineNoAttemptMs)) / 1000).toFixed(1));
  }
  // 3. the long blind holds: >= 3s, what blocked them, was there a spot
  P('', '## blind intervals >= 3s (encounters): reason x blocker');
  const longIv = ivs.filter((r) => String(r.scenario).includes(':') && r.durMs >= 3000 && /LOS_BLOCKED|OUT_OF_SIGHT|BLOCKED|NO_PROGRESS|CONCEALED/.test(r.reason));
  const g3 = grp(longIv, (r) => `${fam(r)}|${r.variant}|${kind(r).replace('-E', '')}|${r.reason}`);
  for (const [k, a] of Object.entries(g3).sort()) {
    const tot = a.reduce((s, r) => s + r.durMs, 0) / 1000;
    const bl = grp(a, (r) => String(r.blocker || '(none)').split('@')[0]);
    const withAlt = a.filter((r) => r.altSpotFound > 0).length;
    const paths = a.filter((r) => r.altSpotPathPx !== '').map((r) => r.altSpotPathPx).sort((x, y) => x - y);
    const withLine = a.filter((r) => r.lineSpotFound > 0).length;
    const lpx = a.filter((r) => r.lineSpotPx !== '' && r.lineSpotPx !== undefined).map((r) => r.lineSpotPx).sort((x, y) => x - y);
    P(k.replaceAll('|', ' | '), '|', a.length, 'intervals,', tot.toFixed(0), 's | longest', (Math.max(...a.map((r) => r.durMs)) / 1000).toFixed(1), 's | NavGrid spot found in', `${withAlt}/${a.length}`,
      '| nearest path median', paths.length ? paths[paths.length >> 1] : '-', 'px | straight-line band spot in', `${withLine}/${a.length}`, '| nearest median', lpx.length ? lpx[lpx.length >> 1] : '-',
      'px | blockers:', Object.entries(bl).map(([b, q]) => `${b} ${q.length}`).join(', '));
  }
  // 3b. reacquisition: the line comes back after >= 0.5s blind
  P('', '## line reacquired after >= 0.5s blind: time to the first attack (encounters, pooled)');
  const g3b = grp(enc.filter((r) => r.reacqEpisodes !== undefined), (r) => `${fam(r)}|${r.variant}|${kind(r).replace('-E', '')}`);
  for (const [k, a] of Object.entries(g3b).sort()) {
    const n = a.reduce((s, r) => s + (r.reacqEpisodes || 0), 0);
    const mean = n ? a.reduce((s, r) => s + (r.reacqEpisodes || 0) * (r.reacqToAttackMeanMs || 0), 0) / n : 0;
    const mx = Math.max(0, ...a.map((r) => r.reacqToAttackMaxMs || 0));
    const cens = a.reduce((s, r) => s + (r.reacqLostAgainFirst || 0), 0);
    P(k.replaceAll('|', ' | '), '| attacked after', n, 'reacquisitions | mean', Math.round(mean), 'ms | max', mx, 'ms | line lost again before any attack', cens);
  }
  // 4. damage reaching the player
  P('', '## what reached the player (hits per minute, god mode, pooled over seeds)');
  const g4 = grp(runs.filter((r) => String(r.scenario).includes(':')), (r) => `${r.scenario}|${r.variant}`);
  for (const [k, a] of Object.entries(g4).sort()) {
    const min = a.reduce((s, r) => s + r.ticks, 0) / 3600;
    const f = (c) => (a.reduce((s, r) => s + r[c], 0) / min).toFixed(1);
    P(k.replace('|', ' | '), '| runs', a.length, '| Marksman', f('hitsMarksman'), '| Bulwark', f('hitsBulwark'), '| Gunner', f('hitsGunner'), '| Rifleman', f('hitsRifleman'), '| alive at the end', a.map((r) => r.roles).join(' / '));
  }
  return out.join('\n');
}

// ════════════════════════════════════════════════════════════════════════
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--report')) { console.log(report(opt('csv', `${OUT}tactical-metrics-all.csv`).split('+').flatMap(readCsv))); process.exit(0); }
  const ONLY = opt('only', 'geo,staged,enc').split(',');
  const SEEDS = Array.from({ length: +opt('seeds', '3') }, (_, i) => 1001 + i * 7919);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const t0 = Date.now();
  const all = [];
  const save = (tag, rows) => {
    const cols = [];
    for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
    writeFileSync(`${OUT}tactical-${tag}.csv`, [cols.join(','), ...rows.map((r) => cols.map((k) => String(r[k] ?? '').replace(/,/g, ';')).join(','))].join('\n') + '\n');
    console.log(`  wrote ${tag}: ${rows.length} rows (${Math.round((Date.now() - t0) / 1000)}s)`);
  };

  // `--check`: the instrument perturbs nothing — the same MIXED seed with the
  // recorder on and with it off produces the same trace, tick for tick
  if (process.argv.includes('--check')) {
    const tr = [];
    for (const on of [true, false]) {
      const p = await tacPage(browser, VARIANTS.frozen, Q.mixed, 1001);
      tr.push(await p.evaluate((on) => { window.__tac.on = on; window.__tac.begin({ seed: 1001, pilot: { mode: 'handset' }, fire: 7 }); for (let i = 0; i < 2400; i++) window.__tac.step(); return window.__tac.trace.slice(); }, on));
      await p.close();
    }
    const d = tr[0].findIndex((x, i) => x[0] !== tr[1][i][0] || x[1] !== tr[1][i][1]);
    console.log(`instrument on vs off, MIXED seed 1001, 2400 ticks: first divergence ${d} (-1 = identical)`);
  }

  if (ONLY.includes('geo')) {
    const p = await tacPage(browser, VARIANTS.frozen, Q.stagedRoom);
    const g = await p.evaluate(() => {
      const gs = window.__gs, NG = gs.navGrid, T = window.__tac;
      const geo = T.geo();
      const blocked = [];
      for (let c = 0; c < NG.cols; c++) for (let r = 0; r < NG.rows; r++) if (!NG.grid[c][r]) blocked.push([c, r]);
      return { geo, cols: NG.cols, rows: NG.rows, gs: NG.gridSize, blocked, bushes: gs.bushSystem.bushes.slice(), gates: (gs.roomSpec.gates || []).map((q) => ({ x: q.x, y: q.y })),
        terminals: (gs.roomSpec.terminals || []).map((q) => ({ x: q.x, y: q.y })), bounds: gs.roomSpec.bounds };
    });
    writeFileSync(`${OUT}detention-geometry.json`, JSON.stringify(g, null, 1));
    console.log('  geometry:', g.geo.length, 'LOS/physics rects,', g.blocked.length, 'nav cells blocked of', g.cols * g.rows, '- bushes', g.bushes.length);
    await p.close();
  }

  if (ONLY.includes('staged')) {
    const rows = [];
    for (const [vk, flags] of Object.entries(VARIANTS)) {
      const p = await tacPage(browser, flags, Q.stagedRoom);
      for (const [name, sc] of Object.entries(STAGED)) {
        // Marksman cases need the Marksman variant, Bulwark cases the Bulwark one
        if (vk === 'mkB' && !name.startsWith('M')) continue;
        if (vk === 'bwB' && !name.startsWith('B')) continue;
        for (const seed of SEEDS.slice(0, 2)) {
          const res = await runStaged(p, { ...sc, seed });
          const a = analyse(res, { scenario: name, variant: vk, seed }, res.geo);
          rows.push(a.run, ...a.actorRows, ...a.intervals);
        }
        console.log(`  staged ${vk} ${name} (${Math.round((Date.now() - t0) / 1000)}s)`);
      }
      await p.close();
    }
    save('staged', rows);
    all.push(...rows);
  }

  if (ONLY.includes('enc')) {
    const rows = [];
    const PLAN = [
      ['mixed', ['handset', 'hide', 'circle', 'hop', 'charge', 'retreat', 'behind'], ['frozen', 'mkB', 'bwB']],
      ['nest', ['handset', 'hide', 'hop', 'charge'], ['frozen', 'mkB']],
      ['vanguard', ['handset', 'hide', 'circle'], ['frozen', 'bwB']],
      ['vanguardCaptain', ['handset', 'hide', 'circle'], ['frozen', 'bwB']],
    ];
    const ENCS = opt('encs', ''), PILOTS = opt('pilots', ''), VARS = opt('vars', '');
    for (const [enc, pilots, vars] of PLAN) for (const pilot of pilots) for (const vk of vars) for (const seed of SEEDS) {
      if ((ENCS && !ENCS.split(',').includes(enc)) || (PILOTS && !PILOTS.split(',').includes(pilot)) || (VARS && !VARS.split(',').includes(vk))) continue;
      const p = await tacPage(browser, VARIANTS[vk], Q[enc], seed);
      const res = await runEnc(p, { seed, ticks: 2400, pilot: { mode: pilot }, fire: 7 });
      await p.close();
      const a = analyse(res, { scenario: `${enc}:${pilot}`, variant: vk, seed }, res.geo);
      rows.push(a.run, ...a.actorRows, ...a.intervals);
      if (enc === 'mixed' && pilot === 'handset' && seed === SEEDS[0] && !opt('encs', '')) {
        // the per-tick evidence for the reproduction, every tracked actor
        const tick = [];
        for (const ac of res.actors) for (const w of ac.rows) tick.push({ variant: vk, actor: ac.id, type: ac.type, elite: +ac.elite, ...Object.fromEntries(Object.entries(R).map(([k, i]) => [k, w[i]])), reason: reasonOf(w, ac.type) });
        save(`ticks-mixed-handset-${vk}`, tick);
      }
    }
    console.log(`  enc done (${Math.round((Date.now() - t0) / 1000)}s)`);
    save('enc', rows);
    all.push(...rows);
  }

  if (all.length) save('metrics-all', all);
  await browser.close();
  console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`);
}
