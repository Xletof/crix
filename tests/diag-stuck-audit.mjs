// DIAGNOSTIC — THE SHARED STUCK-DETECTION AUDIT (Phase 3A). Prints numbers and
// writes a CSV / JSON; asserts nothing (`tests/smoke-stuck-audit.mjs` asserts
// that this instrument is observing the real game).
//
// THE BLOCK UNDER AUDIT, `Enemy.preUpdate` (frozen, byte-identical to 3ce5680):
//
//   if (_inMoveState) {                        // spec.behavior === 'swarm' => ALWAYS true
//     _stuckSidestepMs -= delta; _stuckTimer += delta;
//     if (_stuckTimer >= 600) {
//       moved = hypot(x - (_stuckRefX ?? x), y - (_stuckRefY ?? y));
//       if (moved < 12) { _stuckSidestepMs = 600; _stuckSideDir = random() < .5 ? 1 : -1; }
//       _stuckTimer = 0; _stuckRefX = x; _stuckRefY = y;
//     }
//   }
//
// and its ONE consumer, `Enemy._moveToward`, which drives the body
// perpendicular to its target at 1.1x speed while `_stuckSidestepMs > 0`.
//
// NOTHING IN `src/` IS MODIFIED. Every counterfactual is a page-side patch in
// this rig's own browser page, installed on the prototypes after boot:
//
//   A     the frozen game, observed only (the wrappers write nothing);
//   init  the SHARED INITIALIZATION correction: `_stuckRefX/Y` seeded with
//         the spawn point, so the first check measures the real window. It
//         makes no random draw when the body moved — the RNG stream shifts;
//   veto  the DEMOLISHER correction generalised to every role: the first
//         check is re-measured from the spawn point and the sidestep stood
//         down when the body moved >= 12px. The draw is kept;
//   prog  veto PLUS a progress-aware check: an armed sidestep is also stood
//         down when the AI itself held the body still for the window
//         (commanded speed < 25% of its own speed on most ticks). Draw kept.
//   off   CONTROL ONLY, never a candidate: every armed sidestep stood down —
//         what a body does against cover with no stuck recovery at all.
//
// Every armed check is classified from the window it measured:
//   F1     first check, the body really moved >= 12px    (FALSE — ref undefined)
//   H1/HOLD  the AI commanded no movement for the window  (FALSE — deliberate hold)
//   B1/BLOCK commanded movement with wall / bounds contact (TRUE obstruction)
//   O1/OTHER commanded movement, no contact, net < 12px    (reversal / orbit)
// and its consumption measured: the ticks `_moveToward` actually took the
// sidestep branch, and the px travelled there.
//
// usage: node tests/diag-stuck-audit.mjs [--only=lane,obstacle,player,away,move,encounter,vanguard,nemesis]
//                                          [--seeds=8] [--base=URL] [--out=DIR]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

export const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
export const BASE = opt('base', 'http://localhost:5173/');

// ── PAGE BOOT: seeded Math.random with a draw counter, a 60Hz fixed step ──
export async function bootPage(browser, { base = BASE, q = 'encdbg=1&room=hangar&sector=1', flags = '', seed = 4242, viewport = { width: 720, height: 1280 } } = {}) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => { console.error(`pageerror: ${e.message}`); process.exit(1); });
  await page.goto(`${base}?nodlg=1&nofreeze=1${flags ? `&${flags}` : ''}&${q}`);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
  await page.evaluate(async (seed) => {
    const g = window.game; g.loop.sleep();
    let s = 12345; window.__draws = 0;
    window.__seed = (n) => { s = (n >>> 0) || 1; };
    Math.random = () => { window.__draws++; s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    window.__t = 1e5; Date.now = () => window.__t;
    // metrics runs skip the renderer (Game.headlessStep: the same scene update,
    // no draw); evidence runs render. smoke-stuck-audit proves the two agree.
    window.__headless = false;
    window.__adv = (n = 1) => {
      for (let i = 0; i < n; i++) {
        window.__t += 1000 / 60;
        if (window.__headless) g.headlessStep(window.__t, 1000 / 60); else g.step(window.__t, 1000 / 60);
        if (window.__aud) window.__aud.tick++;
      }
    };
    window.__mod = async (re) => { const u = performance.getEntriesByType('resource').map((r) => r.name).find((n) => re.test(n)); return u ? import(u) : null; };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed }); window.__adv(2);
    (await window.__mod(/systems\/debug\.js/)).setGodMode(true);
    const gs = window.__gs = g.scene.getScene('Game');
    for (let i = 0; i < 400 && !gs.roomSpec; i++) window.__adv(1);
    window.__adv(20);
  }, seed);
  return page;
}

// ── THE INSTRUMENT ───────────────────────────────────────────────────────
// `variant` is one of A / init / veto / prog (above). `observe: false`
// installs NOTHING (used by the smoke to prove the wrappers perturb nothing).
export async function installAudit(page, variant = 'A') {
  await page.evaluate(async (variant) => {
    const gs = window.__gs;
    const { Enemy, EnemyShooter } = await window.__mod(/entities\/Enemy\.js/);
    const SC = (await window.__mod(/entities\/ShockCaptain\.js/))?.ShockCaptain;
    const A = window.__aud = { variant, tick: 0, recs: [], live: new Map(), gone: new WeakSet() };
    const engageR = (e) => {
      const c = e.cfg, t = e.enemyType;
      if (e.isChampion) return 520;
      if (t === 'grunt') return 150;                      // SWARM_RUSH_RANGE
      if (t === 'shooter') return 340;                    // SWARM_HOLD_RANGE
      if (t === 'shielded') return e._screen ? e._screen.holdPx : c.desiredRange + 30;
      if (t === 'sniper') return c.desiredRange + 80;
      if (t === 'swarmling') return c.meleeRange;
      if (t === 'bomber') return c.contactRange;
      return 150;
    };
    A.track = (e) => {
      const r = {
        id: A.recs.length, e, type: e.isChampion ? 'captain' : e.enemyType, elite: !!e._elite, nem: !!e._miniBoss,
        mode: e._loco ? (e._v22 ? 'v22' : 'v2') : 'legacy', screen: !!e._screen, lane: !!e._lane,
        born: A.tick, sx: e.x, sy: e.y, speed: e.cfg.speed, engageR: engageR(e),
        checks: [], ring: [], open: null,
        path: 0, totLat: 0, sideTicks: 0, sideLat: 0, sidePath: 0, otherLat: 0,
        turns: 0, turnsSide: 0, hd: [], engage: null, shots: 0, losN: 0, losY: 0,
        firstSideTick: null, died: null, dmg: 0, contactTicks: 0, firstContact: null, lastContact: null,
      };
      A.recs.push(r); A.live.set(e, r); return r;
    };

    // (1) the base block, observed — and amended for a counterfactual
    const base = Enemy.prototype.preUpdate;
    Enemy.prototype.preUpdate = function (time, delta) {
      let r = A.live.get(this);
      if (!r) { if (!this.alive || A.gone.has(this)) return base.call(this, time, delta); r = A.track(this); }
      const pre = { t: this._stuckTimer || 0, rx: this._stuckRefX, alive: this.alive, perf: !!this._performing };
      if (A.variant === 'init' && pre.alive && this._stuckRefX === undefined) { this._stuckRefX = r.sx; this._stuckRefY = r.sy; }
      const ux = this._stuckRefX, uy = this._stuckRefY;
      base.call(this, time, delta);
      if (!pre.alive || pre.perf) return;
      if (!(pre.t + delta >= 600 && this._stuckTimer === 0)) return;
      // THE CHECK RAN THIS TICK (the base reset its timer and re-anchored)
      const first = pre.rx === undefined;
      const baseMoved = Math.hypot(this.x - (ux ?? this.x), this.y - (uy ?? this.y));
      const trueMoved = first ? Math.hypot(this.x - r.sx, this.y - r.sy) : baseMoved;
      const armed = this._stuckSidestepMs === 600;
      const w = r.ring, n = w.length || 1;
      const cmdFrac = w.filter((q) => q.cmd).length / n, contact = w.filter((q) => q.hit).length;
      const contactNow = w.slice(-3).some((q) => q.hit);   // pinned at the moment of the check
      let cls = null;
      if (armed) {
        if (first && trueMoved >= 12) cls = 'F1';
        else if (cmdFrac < 0.5) cls = first ? 'H1' : 'HOLD';
        else if (contact) cls = first ? 'B1' : 'BLOCK';
        else cls = first ? 'O1' : 'OTHER';
      }
      const ev = { tick: A.tick, age: A.tick - r.born, first, baseMoved: +baseMoved.toFixed(1), trueMoved: +trueMoved.toFixed(1), armed, dir: armed ? this._stuckSideDir : 0, cls, cmdFrac: +cmdFrac.toFixed(2), contact, contactNow, cons: 0, consPx: 0, stood: false, x: +this.x.toFixed(1), y: +this.y.toFixed(1), refX: first ? null : +ux.toFixed(1), refY: first ? null : +uy.toFixed(1) };
      if (armed && A.variant === 'off') { this._stuckSidestepMs = 0; ev.stood = true; }   // CONTROL: no stuck recovery at all
      if (armed && (A.variant === 'veto' || A.variant === 'prog')) {
        if (first && trueMoved >= 12) { this._stuckSidestepMs = 0; ev.stood = true; }
        else if (A.variant === 'prog' && cmdFrac < 0.5) { this._stuckSidestepMs = 0; ev.stood = true; }
      }
      r.checks.push(ev);
      if (armed && !ev.stood) r.open = ev;
    };

    // (2) the consumer: which branch `_moveToward` took, and toward what
    const mt = Enemy.prototype._moveToward;
    Enemy.prototype._moveToward = function (tx, ty, sp) {
      this.__br = Math.hypot(tx - this.x, ty - this.y) < 2 ? 1 : (this._stuckSidestepMs > 0 ? 2 : 1);
      return mt.call(this, tx, ty, sp);
    };

    // (3) after the whole AI tick: the commanded velocity, contact, motion
    const after = (e) => {
      const r = A.live.get(e); if (!r) return;
      const P = gs.player;
      if (r.px != null) {
        // the physics step since last tick moved the body; charge it to the branch that tick took
        const dx = e.x - r.px, dy = e.y - r.py, d = Math.hypot(dx, dy);
        const lat = Math.abs(dx * r.pperp[0] + dy * r.pperp[1]);
        r.path += d; r.totLat += lat;
        if (r.pbr === 2) { r.sideTicks++; r.sideLat += lat; r.sidePath += d; if (r.popen) { r.popen.cons++; r.popen.consPx = +(r.popen.consPx + d).toFixed(1); } }
        else r.otherLat += lat;
      }
      if (!e.alive || !e.active) {
        if (r.died == null) r.died = A.tick - r.born;
        // a Demolisher engages by detonating: it dies on the tick it reaches the player
        if (r.engage == null && Math.hypot(P.x - e.x, P.y - e.y) <= r.engageR + 40) r.engage = A.tick - r.born;
        A.live.delete(e); A.gone.add(e); return;
      }
      const v = e.body.velocity, cmd = Math.hypot(v.x, v.y);
      const hit = !e.body.blocked.none;
      r.ring.push({ cmd: cmd > 0.25 * e.cfg.speed, hit });
      if (hit) { r.contactTicks++; if (r.firstContact == null) r.firstContact = A.tick - r.born; r.lastContact = A.tick - r.born; }
      if (r.ring.length > 36) r.ring.shift();
      const bx = P.x - e.x, by = P.y - e.y, bd = Math.hypot(bx, by) || 1;
      // ABRUPT DIRECTION CHANGE: heading now vs 6 ticks (100ms) ago, both moving
      r.hd.push(cmd > 0.3 * e.cfg.speed ? Math.atan2(v.y, v.x) : null);
      if (r.hd.length > 7) r.hd.shift();
      r.sideHist = (r.sideHist || []); r.sideHist.push(e.__br === 2); if (r.sideHist.length > 7) r.sideHist.shift();
      const h0 = r.hd[0], h1 = r.hd[r.hd.length - 1];
      const sharp = h0 != null && h1 != null && Math.abs(Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0))) > Math.PI / 3;
      if (sharp && !r.inTurn) { r.turns++; if (r.sideHist.some(Boolean) || r.sideEdge) r.turnsSide++; }
      r.inTurn = sharp;
      r.sideEdge = (e.__br === 2) !== (r.pbr === 2);
      if (e.__br === 2 && r.firstSideTick == null) r.firstSideTick = A.tick - r.born;
      if (r.engage == null && bd <= r.engageR) r.engage = A.tick - r.born;
      if (e.enemyType !== 'bomber' && e.enemyType !== 'swarmling') { r.losN++; if (e._hasLOS(e.x, e.y, P.x, P.y)) r.losY++; }
      r.px = e.x; r.py = e.y; r.pbr = e.__br || 0; r.pperp = [-by / bd, bx / bd];
      r.popen = r.open;
      if (r.open && !(e._stuckSidestepMs > 0)) r.open = null;
      e.__br = 0;
    };
    const wrapOuter = (P) => { const o = P.preUpdate; P.preUpdate = function (time, delta) { this.__br = 0; o.call(this, time, delta); after(this); }; };
    wrapOuter(EnemyShooter.prototype);
    if (SC) wrapOuter(SC.prototype);
    gs.events.on('shooter-fire', (e) => { const r = A.live.get(e); if (r) r.shots++; });
    // positions of every live enemy, hashed per tick — where two variants first part ways
    A.trace = [];
    A.hash = () => { let h = 0; for (const r of A.recs) if (r.e.active) h = (h * 31 + Math.round(r.e.x * 10) * 7 + Math.round(r.e.y * 10)) % 1e9; return h; };
  }, variant);
}

// ── ONE STAGED RUN (single actors in an emptied room) ────────────────────
// sc = { seed, ticks, actors: [{ type, elite, nem, spec, x, y, at }], player: { path, x, y }, wall: [x,y,w,h] | [[...],...] }
//
// The page-side halves (`__audSetup` / `__audStep` / `__audCollect`) are
// installed by `installStaged` and shared with the evidence rig
// (`shot-stuck-audit.mjs`), so a video steps exactly the run the CSV measured.
export async function installStaged(page) {
  await page.evaluate(() => {
    const gs = window.__gs, P = gs.player, A = window.__aud;
    window.__audSetup = async (sc) => {
      const nemMod = sc.actors.some((a) => a.nem) ? await window.__mod(/data\/nemesis\.js/) : null;
      // an empty room: no spawner, no modifier, no cover, no walls, no enemies, no bullets
      gs.arenaActive = false; gs._roomModifier = null;
      if (gs.arenaCfg) gs.arenaCfg = { ...gs.arenaCfg, speedMult: undefined };
      gs.enemyHpMult = 1; gs.enemySpeedMult = 1;
      for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
      for (const g of gs.hostileBullets) for (const x of g.getChildren()) if (x.active) x.kill();
      for (const x of gs.playerBullets?.getChildren?.() || []) if (x.active) x.kill?.();
      gs.clearHazards?.(); gs.clearTelegraphs?.();
      for (const o of gs.roomLayer.getChildren()) if (o.body && (o.displayWidth || 0) < 1000) o.body.enable = false;
      for (const w of gs.walls?.getChildren?.() || []) if (w.body && !w.__audWall) w.body.enable = false;
      for (const w of (gs.__audWalls || [])) { gs.walls.remove(w, true, true); }
      gs.__audWalls = [];
      const walls = sc.wall ? (Array.isArray(sc.wall[0]) ? sc.wall : [sc.wall]) : [];
      for (const [x, y, w, h] of walls) {
        const o = gs.add.rectangle(x, y, w, h, 0x8a5a3a, 1).setDepth(5).setStrokeStyle(2, 0xd0a070);
        gs.physics.add.existing(o, true); o.__audWall = true; gs.walls.add(o); gs.__audWalls.push(o);
      }
      // LINE OF SIGHT AND THE NAV GRID ARE CACHED AT ROOM LOAD (losRects,
      // navGrid.build), so disabling a cover BODY leaves it blocking every
      // raycast and every path. Rebuild both from what the staged room holds.
      gs.losRects = gs.__audWalls.map((o) => { const R = o.getBounds(); R.setTo(o.body.x, o.body.y, o.body.width, o.body.height); return R; });
      gs.navGrid.build(gs.roomSpec.bounds.w, gs.roomSpec.bounds.h, gs.__audWalls);
      // ANYTHING THAT DRAWS RANDOM NUMBERS CARRIES ACROSS RUNS: the ambient mote
      // clock, a camera shake still running (Phaser's Shake draws every frame), a
      // tween, a delayed call the last actor scheduled. Clear them all so every
      // staged run is independent (smoke-stuck-audit replays a run to prove it).
      gs._moteTimer = 0;
      gs.cameras.main.resetFX();
      gs.tweens.killAll();
      gs.time.removeAllEvents();
      window.__seed(sc.seed);
      window.__draws = 0;
      A.tick = 0; A.recs.length = 0; A.live.clear(); A.trace.length = 0;
      const pl = sc.player || { path: 'stand', x: 800, y: 1150 };
      P.setPosition(pl.x, pl.y); P.body.reset(pl.x, pl.y); P.hp = P.hpMax;
      A.run = { sc, pl, nemMod, born: [], i: 0 };
    };
    const spawn = (a) => {
      const R = A.run;
      let e;
      if (a.type === 'captain') e = gs.spawnChampion(a.x, a.y, 'captain');
      else if (a.nem) {
        const nem = R.nemMod.rollNemesis(gs.sector || 1, { rng: gs.rng.nemesis, base: a.type, traits: [] });
        e = gs._spawnMiniBoss(nem);
        e.setPosition(a.x, a.y); e.body.reset(a.x, a.y);
      } else e = gs.spawnEnemyAt(a.type, a.x, a.y, { ...(a.elite ? { elite: true } : {}), ...(a.spec || {}) });
      e.__audLabel = a.label || null;
      R.born.push(e);
    };
    const path = (i) => {
      const pl = A.run.pl, k = pl.path;
      if (k === 'stand') return null;
      if (k === 'lat') { const T = 415, A0 = 330; return [pl.x + A0 * Math.sin(2 * Math.PI * i / T), pl.y]; }
      if (k === 'circle') { const R = 260, w = 300 / R / 60; return [800 + R * Math.cos(Math.PI / 2 + i * w), 760 + R * Math.sin(Math.PI / 2 + i * w)]; }
      if (k === 'behind') { if (i < 50) return null; const t = Math.min(1, (i - 50) * 5.5 / Math.hypot(1060 - pl.x, 150 - pl.y)); return [pl.x + (1060 - pl.x) * t, pl.y + (150 - pl.y) * t]; }
      if (k === 'away') {   // stand 4s, back off 350px, stand, back off 350px again — the hold -> resume trigger
        const ramp = (a) => Math.min(1, Math.max(0, (i - a) / 70));
        return [pl.x, Math.min(1350, pl.y + 350 * ramp(240) + 350 * ramp(480))];
      }
      return null;
    };
    window.__audStep = () => {
      const R = A.run, i = R.i++;
      for (const a of R.sc.actors) if ((a.at || 0) === i) spawn(a);
      const p = path(i);
      if (p) { P.setPosition(p[0], p[1]); P.body.reset(p[0], p[1]); }
      window.__adv(1);
      if (R.sc.trace) A.trace.push([A.hash(), window.__draws]);
    };
    window.__audCollect = () => {
      const out = A.recs.map((r) => {
        const { e, ring, hd, sideHist, open, popen, ...rest } = r;
        return { ...rest, endX: +e.x.toFixed(1), endY: +e.y.toFixed(1), alive: e.alive && e.active,
          losFrac: r.losN ? +(r.losY / r.losN).toFixed(3) : null,
          path: +r.path.toFixed(1), totLat: +r.totLat.toFixed(1), sideLat: +r.sideLat.toFixed(1), sidePath: +r.sidePath.toFixed(1), otherLat: +r.otherLat.toFixed(1) };
      });
      for (const e of A.run.born) if (e.active) gs._destroyEnemyFully(e);
      return { recs: out, draws: window.__draws, trace: A.run.sc.trace ? A.trace.slice() : null };
    };
  });
}

export async function stagedRun(page, sc) {
  if (!(await page.evaluate(() => !!window.__audSetup))) await installStaged(page);
  return page.evaluate(async (sc) => {
    await window.__audSetup(sc);
    for (let i = 0; i < sc.ticks; i++) window.__audStep();
    return window.__audCollect();
  }, sc);
}

// ── A REAL ENCOUNTER (the real spawner, a scripted player) ───────────────
// The player moves on keyboard segments and fires on a fixed cadence, god mode.
export const FIGHT_SEG = [[0, 160, ''], [160, 260, 'A'], [260, 380, 'W'], [380, 480, 'D'], [480, 600, 'S'], [600, 700, ''], [700, 820, 'A'], [820, 940, 'D'], [940, 1040, 'S'], [1040, 1200, ''], [1200, 1320, 'W'], [1320, 1440, 'A'], [1440, 1560, 'D'], [1560, 99999, '']];
export async function encounterRun(page, { seed, ticks = 1800, seg = FIGHT_SEG, fire = 7, superAt = [700, 1400], trace = false, onFrame = null }) {
  return page.evaluate(async ({ seed, ticks, seg, fire, superAt, trace }) => {
    const gs = window.__gs, P = gs.player, A = window.__aud;
    window.__seed(seed); window.__draws = 0;
    A.tick = 0; A.trace.length = 0;
    const front = [];
    for (let i = 0; i < ticks; i++) {
      const cur = seg.find(([a, b]) => i >= a && i < b)[2], K = gs.keys;
      K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
      if (fire && i >= 60 && i % fire === 0) P.keyboardFire();
      if (superAt.includes(i)) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
      window.__adv(1);
      if (trace) A.trace.push(A.hash());
      const f = gs._vanguardFront;
      if (f && !front.length && f.released) front.push({ tick: i, why: f.why, secondAt: f.secondAt, releasedAt: f.releasedAt });
    }
    const K = gs.keys; K.A.isDown = K.D.isDown = K.W.isDown = K.S.isDown = false;
    const out = A.recs.map((r) => {
      const { e, ring, hd, sideHist, open, popen, ...rest } = r;
      return { ...rest, alive: e.alive && e.active, losFrac: r.losN ? +(r.losY / r.losN).toFixed(3) : null,
        path: +r.path.toFixed(1), totLat: +r.totLat.toFixed(1), sideLat: +r.sideLat.toFixed(1), sidePath: +r.sidePath.toFixed(1), otherLat: +r.otherLat.toFixed(1) };
    });
    return { recs: out, draws: window.__draws, front: front[0] || (gs._vanguardFront ? { why: gs._vanguardFront.released ? gs._vanguardFront.why : 'holding' } : null), trace: trace ? A.trace : null };
  }, { seed, ticks, seg, fire, superAt, trace });
}

// ── SUMMARIES ────────────────────────────────────────────────────────────
export function armedBy(recs) {
  const c = {};
  for (const r of recs) for (const ev of r.checks) if (ev.armed) {
    const k = ev.cls + (ev.stood ? '-stood' : '');
    c[k] = c[k] || { n: 0, consumed: 0, consTicks: 0, consPx: 0 };
    c[k].n++; if (ev.cons > 0) c[k].consumed++; c[k].consTicks += ev.cons; c[k].consPx += ev.consPx;
  }
  return c;
}
export const firstCheck = (r) => r.checks.find((c) => c.first) || null;
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const r1 = (x) => (x == null ? '' : Math.round(x * 10) / 10);

// ── CLI: the audit's measurement matrix ──────────────────────────────────
const ROLES = [
  { key: 'rifleman', type: 'grunt' },
  { key: 'gunner', type: 'shooter' },
  { key: 'bulwark', type: 'shielded' },
  { key: 'bulwark-screen', type: 'shielded', spec: { vanguardScreen: { holdPx: 140, resumePx: 165 } } },
  { key: 'bulwark-opener', type: 'shielded', spec: { vanguardScreen: { holdPx: 140, resumePx: 165 }, vanguardLane: { sign: 1, px: 60 } } },
  { key: 'marksman', type: 'sniper' },
  { key: 'swarmling', type: 'swarmling' },
  { key: 'demolisher', type: 'bomber' },
];
const NEMS = ['grunt', 'shooter', 'shielded', 'sniper', 'bomber'].map((t) => ({ key: `nemesis-${t}`, type: t, nem: true }));

// `--merge`: the evidence CSV is the union of the tagged runs, in this order
//   node tests/diag-stuck-audit.mjs --only=lane,obstacle,player,away,move,nemesis,rng --tag=staged
//   node tests/diag-stuck-audit.mjs --only=encounter,vanguard --tag=encounter
//   node tests/diag-stuck-audit.mjs --only=vfront --tag=vfront
//   node tests/diag-stuck-audit.mjs --merge
if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--merge')) {
  const { readFileSync } = await import('node:fs');
  const OUT = opt('out', new URL('../docs/evidence/shared-stuck-audit/', import.meta.url).pathname);
  const parse = (t) => { const [h, ...ls] = t.trim().split('\n'); const cols = h.split(','); return ls.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v]))); };
  const rows = ['staged', 'encounter', 'vfront'].flatMap((t) => parse(readFileSync(`${OUT}stuck-role-metrics-${t}.csv`, 'utf8')));
  const cols = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  writeFileSync(`${OUT}stuck-role-metrics.csv`, [cols.join(','), ...rows.map((r) => cols.map((k) => r[k] ?? '').join(','))].join('\n') + '\n');
  console.log(`merged ${rows.length} rows, ${cols.length} columns`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const OUT = opt('out', new URL('../docs/evidence/shared-stuck-audit/', import.meta.url).pathname);
  const ONLY = opt('only', 'lane,obstacle,player,away,move,encounter,vanguard,nemesis').split(',');
  const NSEED = +opt('seeds', '8');
  const SEEDS = Array.from({ length: NSEED }, (_, i) => 1001 + i * 7919);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const rows = [];   // the CSV
  const raw = {};    // the JSON
  const pages = new Map();
  const pageFor = async (flags, variant, q) => {
    const k = `${flags}|${variant}|${q || ''}`;
    if (!pages.has(k)) {
      const p = await bootPage(browser, { flags, ...(q ? { q } : {}) });
      await installAudit(p, variant);
      await p.evaluate(() => { window.__headless = true; });
      pages.set(k, p);
    }
    return pages.get(k);
  };
  const closeAll = async () => { for (const p of pages.values()) await p.close(); pages.clear(); };
  const VARS = ['A', 'init', 'veto', 'prog'];
  const row = (o) => rows.push(o);
  const stagedRow = (scn, flags, variant, seed, role, res) => {
    const r = res.recs[0]; if (!r) return;
    const f = firstCheck(r), ab = armedBy([r]);
    row({
      scenario: scn, move: flags.includes('move=v22') ? 'v22' : flags.includes('move=v2') ? 'v2' : 'default', variant, seed, role,
      firstCheckMs: f ? Math.round(f.age * 1000 / 60) : '', firstBaseMoved: f ? f.baseMoved : '', firstTrueMoved: f ? f.trueMoved : '',
      firstArmed: f ? +f.armed : '', firstCls: f?.cls || '', firstPinned: f ? +f.contactNow : '', firstStood: f ? +f.stood : '', firstConsTicks: f ? f.cons : '', firstConsPx: f ? f.consPx : '',
      armedTotal: r.checks.filter((c) => c.armed).length,
      F1: ab.F1?.n || 0, HOLD: (ab.HOLD?.n || 0) + (ab.H1?.n || 0), BLOCK: (ab.BLOCK?.n || 0) + (ab.B1?.n || 0), OTHER: (ab.OTHER?.n || 0) + (ab.O1?.n || 0),
      stood: r.checks.filter((c) => c.stood).length,
      sideTicks: r.sideTicks, sideMs: Math.round(r.sideTicks * 1000 / 60), sidePx: r.sidePath, sideLatPx: r.sideLat, otherLatPx: r.otherLat,
      turns: r.turns, turnsSide: r.turnsSide, engageMs: r.engage == null ? '' : Math.round(r.engage * 1000 / 60),
      losFrac: r.losFrac ?? '', shots: r.shots,
      contactMs: Math.round(r.contactTicks * 1000 / 60), firstContactMs: r.firstContact == null ? '' : Math.round(r.firstContact * 1000 / 60), lastContactMs: r.lastContact == null ? '' : Math.round(r.lastContact * 1000 / 60),
      endX: r.endX, endY: r.endY, draws: res.draws,
    });
  };

  // CASE A — clear lane, standing player, 900px straight approach
  const laneSc = (role, seed, extra = {}) => ({ seed, ticks: 330, actors: [{ ...role, x: 800, y: 250, at: 0 }], player: { path: 'stand', x: 800, y: 1150 }, ...extra });
  async function matrix(scn, flags, roles, variants, mk) {
    for (const variant of variants) {
      const page = await pageFor(flags, variant);
      for (const role of roles) for (const seed of SEEDS) {
        const res = await stagedRun(page, mk(role, seed));
        stagedRow(scn, flags, variant, seed, role.key, res);
        (raw[scn] ||= []).push({ flags, variant, seed, role: role.key, recs: res.recs, draws: res.draws });
      }
      console.log(`  ${scn} ${flags || 'default'} ${variant}: ${roles.length * SEEDS.length} runs`);
    }
  }
  const t0 = Date.now();
  if (ONLY.includes('lane')) {
    console.log('── CASE A: clear lane');
    await matrix('lane', '', [...ROLES, { key: 'rifleman-elite', type: 'grunt', elite: true }, { key: 'gunner-elite', type: 'shooter', elite: true }], VARS, (r, s) => laneSc(r, s));
  }
  if (ONLY.includes('obstacle')) {
    // a console-sized block (90x90, real cover is 70x70 bodies) and two wall
    // segments, each dead on the lane. NEAR = 140px ahead (the fast roles touch
    // it inside their first 600ms window), FAR = 450px ahead (everyone touches
    // it after the first check). 10s to get round it.
    console.log('── CASE B: genuine obstruction');
    const OB = { 'cover-near': [800, 390, 90, 90], 'cover-far': [800, 700, 90, 90], 'wall-near': [800, 390, 240, 40], 'wall-far': [800, 700, 240, 40], 'wall-wide': [800, 390, 420, 40] };
    for (const [k, wall] of Object.entries(OB)) await matrix(`obstacle-${k}`, '', ROLES, ['A', 'init', 'veto', 'off'], (r, s) => laneSc(r, s, { wall, ticks: 600 }));
  }
  if (ONLY.includes('player')) {
    console.log('── CASE C: moving player');
    for (const path of ['lat', 'circle', 'behind']) {
      await matrix(`player-${path}`, '', ROLES, ['A', 'veto', 'prog'], (r, s) => laneSc(r, s, { ticks: 600, player: { path, x: 800, y: 1150 } }));
    }
  }
  if (ONLY.includes('away')) {
    console.log('── CASE C2: hold -> resume (the player backs off twice)');
    await matrix('away', '', ROLES, ['A', 'veto', 'prog'], (r, s) => ({ seed: s, ticks: 720, actors: [{ ...r, x: 800, y: 200, at: 0 }], player: { path: 'away', x: 800, y: 650 } }));
  }
  if (ONLY.includes('move')) {
    console.log('── MOVEMENT v2 / v2.2 (Gunner + Rifleman)');
    const two = ROLES.filter((r) => r.type === 'grunt' || r.type === 'shooter');
    for (const flags of ['move=v2', 'move=v22']) {
      await matrix('lane', flags, two, ['A', 'veto', 'prog'], (r, s) => laneSc(r, s));
      await matrix('away', flags, two, ['A', 'veto', 'prog'], (r, s) => ({ seed: s, ticks: 720, actors: [{ ...r, x: 800, y: 200, at: 0 }], player: { path: 'away', x: 800, y: 650 } }));
    }
  }
  if (ONLY.includes('rng')) {
    // THE RNG STUDY: per tick, a hash of every body's position and the running
    // draw count, for the same seed under A / init / veto. Where the random
    // STREAM first parts from A, and where POSITIONS first part from A.
    console.log('── RNG: where each counterfactual first parts from the frozen game');
    const res = {};
    for (const variant of ['A', 'init', 'veto', 'prog']) {
      const page = await pageFor('', variant);
      for (const role of ROLES) for (const seed of SEEDS.slice(0, 4)) {
        res[`${variant}|${role.key}|${seed}`] = await stagedRun(page, { ...laneSc(role, seed), ticks: 600, trace: true });
      }
    }
    const out = [];
    for (const role of ROLES) for (const seed of SEEDS.slice(0, 4)) {
      const a = res[`A|${role.key}|${seed}`].trace;
      for (const v of ['init', 'veto', 'prog']) {
        const b = res[`${v}|${role.key}|${seed}`].trace;
        const pos = b.findIndex((x, i) => x[0] !== a[i][0]), drw = b.findIndex((x, i) => x[1] !== a[i][1]);
        row({ scenario: 'rng-lane', move: 'default', variant: v, seed, role: role.key, posDivergeMs: pos < 0 ? '' : Math.round((pos + 1) * 1000 / 60), drawDivergeMs: drw < 0 ? '' : Math.round((drw + 1) * 1000 / 60), drawsA: a.at(-1)[1], draws: b.at(-1)[1] });
        out.push([role.key, seed, v, pos, drw]);
      }
    }
    raw.rng = out;
    await closeAll();
  }
  if (ONLY.includes('nemesis')) {
    console.log('── NEMESIS (traitless, one per base)');
    await matrix('nemesis-lane', '', NEMS, ['A', 'veto'], (r, s) => ({ ...laneSc(r, s), ticks: 420 }));
    await matrix('nemesis-away', '', NEMS, ['A', 'veto', 'prog'], (r, s) => ({ seed: s, ticks: 720, actors: [{ ...r, x: 800, y: 200, at: 0 }], player: { path: 'away', x: 800, y: 650 } }));
    await matrix('captain-lane', '', [{ key: 'captain', type: 'captain' }], ['A', 'veto'], (r, s) => ({ ...laneSc(r, s), ticks: 420 }));
  }
  await closeAll();

  // VANGUARD FRONT — does the stuck check move the opening sentence? A real
  // VANGUARD (hangar, sector 8, wave 2), the player standing still and not
  // firing, at four places: the room spawn (gates ~1300px away — the 3s
  // timeout always wins), the centre, and two spots where the openers can
  // establish inside the timeout, so a 600ms sidestep could tip the result.
  if (ONLY.includes('vfront')) {
    console.log('── VANGUARD FRONT');
    const POS = { spawn: null, centre: [800, 700], east: [1150, 700], north: [1000, 450] };
    for (const champ of [false, true]) for (const [pk, pos] of Object.entries(POS)) for (const variant of ['A', 'veto', 'prog']) {
      for (const seed of SEEDS.slice(0, 4)) {
        const page = await bootPage(browser, { q: `encdbg=vanguard&room=hangar&sector=8&wave=2${champ ? '' : '&nochamp=1'}`, seed });
        await installAudit(page, variant);
        const r = await page.evaluate(({ seed, pos }) => {
          window.__headless = true;
          const gs = window.__gs, P = gs.player, A = window.__aud;
          window.__seed(seed); window.__draws = 0; A.tick = 0;
          if (pos) { P.setPosition(pos[0], pos[1]); P.body.reset(pos[0], pos[1]); }
          const o = { release: null, why: null, d: [], hold: [null, null], est: [null, null], spread: null, gap: null };
          for (let i = 0; i < 600; i++) {
            if (pos) { P.setPosition(pos[0], pos[1]); P.body.reset(pos[0], pos[1]); }
            window.__adv(1);
            const f = gs._vanguardFront;
            if (!f) continue;
            f.pair.forEach((e, k) => {
              if (!e?.alive) return;
              const d = Math.hypot(e.x - P.x, e.y - P.y);
              if (o.est[k] == null && d <= 200) o.est[k] = i;
              if (o.hold[k] == null && d <= 140) o.hold[k] = i;
            });
            if (f.released && o.release == null) {
              o.release = i; o.why = f.why;
              const [a, b] = f.pair;
              if (a && b) {
                o.d = [Math.round(Math.hypot(a.x - P.x, a.y - P.y)), Math.round(Math.hypot(b.x - P.x, b.y - P.y))];
                const ang = Math.atan2(a.y - P.y, a.x - P.x) - Math.atan2(b.y - P.y, b.x - P.x);
                o.spread = Math.round(Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) * 180 / Math.PI);
                o.gap = Math.round(Math.hypot(a.x - b.x, a.y - b.y));
              }
            }
          }
          const pair = gs._vanguardFront?.pair || [];
          o.openers = pair.map((e) => { const r = A.recs.find((x) => x.e === e); return r ? { F1: r.checks.filter((c) => c.cls === 'F1' && c.cons > 0).length, HOLD: r.checks.filter((c) => c.cls === 'HOLD' && c.cons > 0).length, sideTicks: r.sideTicks, sideLat: Math.round(r.sideLat) } : null; });
          o.queueDrawn = gs._waveSpawned;
          return o;
        }, { seed, pos });
        await page.close();
        const ms = (t) => (t == null ? '' : Math.round((t + 1) * 1000 / 60));
        row({ scenario: `vfront-${pk}${champ ? '-captain' : ''}`, move: 'default', variant, seed, role: 'bulwark-openers',
          frontWhy: r.why || 'holding', frontReleaseMs: ms(r.release), openerDistAtRelease: r.d.join('/'), openerSpreadDeg: r.spread ?? '', openerGapPx: r.gap ?? '',
          est0Ms: ms(r.est[0]), est1Ms: ms(r.est[1]), hold0Ms: ms(r.hold[0]), hold1Ms: ms(r.hold[1]),
          openerF1taken: (r.openers || []).map((x) => x?.F1 ?? '').join('/'), openerHOLDtaken: (r.openers || []).map((x) => x?.HOLD ?? '').join('/'),
          openerSideMs: (r.openers || []).map((x) => (x ? Math.round(x.sideTicks * 1000 / 60) : '')).join('/') });
      }
      console.log(`  vfront ${pk}${champ ? ' +captain' : ''} ${variant}`);
    }
  }

  // CASE D — real encounters, the real spawner
  const ENC = [
    ['crossfire', 'encdbg=crossfire&room=corridor&sector=14&wave=1'],
    ['vanguard', 'encdbg=vanguard&room=hangar&sector=8&wave=2&nochamp=1'],
    ['vanguard-captain', 'encdbg=vanguard&room=hangar&sector=8&wave=2'],
    ['sniperNest', 'encdbg=sniperNest&room=detention&sector=8&wave=1'],
    ['swarmTide', 'encdbg=swarmTide&room=hangar&sector=8&wave=1'],
    ['mixed', 'encdbg=mixed&room=detention&sector=12&wave=1'],
  ];
  const encSeeds = SEEDS.slice(0, Math.min(4, SEEDS.length));
  const encRow = (enc, flags, variant, seed, res) => {
    const by = {};
    for (const r of res.recs) {
      const k = r.nem ? `nemesis-${r.type}` : r.type === 'captain' ? 'captain' : r.type + (r.screen ? '-screen' : '');
      const b = (by[k] ||= { spawns: 0, F1: 0, F1cons: 0, HOLD: 0, HOLDcons: 0, BLOCK: 0, BLOCKcons: 0, OTHER: 0, OTHERcons: 0, stood: 0, sideTicks: 0, sidePx: 0, sideLat: 0, otherLat: 0, turns: 0, turnsSide: 0, shots: 0, life: 0 });
      b.spawns++;
      for (const c of r.checks) if (c.armed) {
        const g = { F: 'F1', H: 'HOLD', B: 'BLOCK', O: 'OTHER' }[c.cls[0]];
        b[g]++; if (c.cons > 0) b[g + 'cons']++;
        if (c.stood) b.stood++;
      }
      b.sideTicks += r.sideTicks; b.sidePx += r.sidePath; b.sideLat += r.sideLat; b.otherLat += r.otherLat;
      b.turns += r.turns; b.turnsSide += r.turnsSide; b.shots += r.shots;
      b.life += (r.died ?? (res.ticks - r.born));
    }
    for (const [k, b] of Object.entries(by)) {
      row({ scenario: `enc-${enc}`, move: flags.includes('v22') ? 'v22' : 'default', variant, seed, role: k, spawns: b.spawns,
        F1: b.F1, F1consumed: b.F1cons, HOLD: b.HOLD, HOLDconsumed: b.HOLDcons, BLOCK: b.BLOCK, BLOCKconsumed: b.BLOCKcons, OTHER: b.OTHER, OTHERconsumed: b.OTHERcons, stood: b.stood,
        sideTicks: b.sideTicks, sideMs: Math.round(b.sideTicks * 1000 / 60), sidePx: r1(b.sidePx), sideLatPx: r1(b.sideLat), otherLatPx: r1(b.otherLat),
        latShareSide: (b.sideLat + b.otherLat) ? +(b.sideLat / (b.sideLat + b.otherLat)).toFixed(3) : '',
        turns: b.turns, turnsSide: b.turnsSide, shots: b.shots, aliveSec: r1(b.life / 60), draws: res.draws, front: res.front ? `${res.front.why}${res.front.tick != null ? '@' + res.front.tick : ''}` : '' });
    }
  };
  const encList = [
    ...(ONLY.includes('encounter') ? ENC.filter(([k]) => !k.startsWith('vanguard')).map(([k, q]) => [k, q, '']) : []),
    ...(ONLY.includes('encounter') ? [['crossfire', ENC[0][1], 'move=v22']] : []),
    ...(ONLY.includes('vanguard') ? ENC.filter(([k]) => k.startsWith('vanguard')).map(([k, q]) => [k, q, '']) : []),
  ];
  for (const [enc, q, flags] of encList) {
    console.log(`── CASE D: ${enc} ${flags || ''}`);
    for (const variant of ['A', 'veto', 'prog', 'init']) {
      for (const seed of encSeeds) {
        const page = await bootPage(browser, { q, flags, seed });
        await installAudit(page, variant);
        await page.evaluate(() => { window.__headless = true; });
        const res = await encounterRun(page, { seed, trace: true });
        res.ticks = 1800;
        encRow(enc, flags, variant, seed, res);
        (raw[`enc-${enc}${flags ? '-' + flags : ''}`] ||= []).push({ variant, seed, recs: res.recs, draws: res.draws, front: res.front, trace: res.trace });
        await page.close();
      }
      console.log(`  ${enc} ${variant}: ${encSeeds.length} seeds`);
    }
  }
  await browser.close();

  // the CSV (union of columns, stable order)
  const cols = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  const csv = [cols.join(','), ...rows.map((r) => cols.map((k) => (r[k] ?? '')).join(','))].join('\n');
  const tag = opt('tag', 'all');
  writeFileSync(`${OUT}stuck-role-metrics${tag === 'all' ? '' : '-' + tag}.csv`, csv + '\n');
  // first-divergence ticks between variants of the same encounter seed (RNG implications)
  for (const [k, list] of Object.entries(raw)) if (k.startsWith('enc-')) {
    for (const x of list) if (x.trace) {
      const a = list.find((y) => y.variant === 'A' && y.seed === x.seed);
      if (a && x !== a) { const i = x.trace.findIndex((h, j) => h !== a.trace[j]); x.divergeTick = i; }
    }
    for (const x of list) delete x.trace;   // only after every variant has been compared with A
  }
  writeFileSync(`${OUT}stuck-audit-raw-${tag}.json`, JSON.stringify(raw));
  console.log(`wrote ${rows.length} rows in ${Math.round((Date.now() - t0) / 1000)}s`);
}
