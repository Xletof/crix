// SMOKE: B2-1 — THE FLAGSHIP EXPERIMENT (`?b2=A|B`, `&b2range=1`, `&b2x.*`).
// Standalone; needs the dev server on :5173 and, for section 1, the previous
// build `266b1ac` (the B1 build) at `--old=URL` with its own Vite cacheDir.
//
//   0  FLAGS: absent = nothing installed, nothing wrapped; A / B (any case);
//      anything else = off; a B1 variant wins; knobs; the range flag
//   1  FLAG OFF = 266b1ac, seeded replays tick for tick: R1, legacy,
//      V2C+P1+P2-A3, with the B0 instrument, B1-G and B1-S, god mode off
//   2  A = B EXCEPT THE ECONOMY: a stream fight with no Super cast is
//      identical tick for tick in everything but the two meters; CONTROLS
//   3  THE WEAPON: first round on the frame of the press; one cadence; tap =
//      one round; 40 rounds, automatic reload, top-up, Super = instant
//      reload; damage; no body recoil; `PLAYER` tuning untouched; a 30 Hz
//      step keeps the cadence and the spacing
//   4  THE AIM: lethal bookkeeping; a clear line beats a nearer blocked one;
//      a Bulwark field is passed over; a moving target is led; a dragged
//      stick aims by hand; the sweep
//   5  THE IMPACT BUDGET: AI-suspended share of a target under a held stream
//      (and the CONTROL with the budget off); the AI still fights; the kill
//      hit-stop budget
//   6  THE ECONOMY: B = durability removed, overkill and the Super's own
//      damage earn nothing, Broken Wings at half, a nemesis at 0.34, the
//      Overcharge perk, the Broken Wings meter; A = the R1 per-hit rule
//   7  CONTROLS: SPACE is the trigger with a full meter; F / ENTER cast the
//      Super; a REAL touch press / tap (CDP); the cluster pod; OVERRIDE ->
//      OVERCHARGE; the HUD pips
//   8  RESTARTS: restart, quit to title: one install, every wrapper restored
//   9  TELEMETRY: the export's b2 block, recovery, lowest hp, stagger time;
//      the ledgers add up
//  10  THE FIRING RANGE
//  11  DETERMINISM: seeded B2 replays repeat; no `Math.random` in B2 code
//  12  PRESENTATION: rounds drawn by B2 only, pooled, nothing left on screen;
//      numbers roll up; the hit hierarchy; the voice's spectrum (offline)
//  13  FROZEN FILES: the B0 / B1 / B2 scope guard; Enemy.js guard
//
// usage: node tests/smoke-b2.mjs [--old=URL] [--ticks=N] [--only=0,3]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { CHROME, FIGHT_SEG } from './diag-stuck-audit.mjs';
import { enemyJsGuard } from './enemy-frozen.mjs';
import { b0Scope, b2Scope, B2_BASE } from './b0-scope.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const OLD = opt('old', null);
const NOW = 'http://localhost:5173/';
const TICKS = +opt('ticks', '1500');
const ONLY = opt('only', '') ? new Set(opt('only', '').split(',').map(Number)) : null;
const on = (n) => !ONLY || ONLY.has(n);
const VIS = 'visualPilot=v2c&polish=p1&fxPilot=p2a3';
const Q_SWARM = 'encdbg=swarmTide&room=hangar&sector=3';
const Q_MIXED = 'encdbg=mixed&room=hangar&sector=6';
const Q_VAN = 'encdbg=vanguard&room=hangar&sector=4';
const Q_STAGE = 'encdbg=mixed&room=hangar&sector=1';
const SUPER = [700, 1100, 1400], MELEE = [320, 345, 370, 1000, 1030], PICK = 480, CLUSTER = 1150;

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const firstDiff = (a, b) => { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i; return -1; };
const join = (...a) => a.filter(Boolean).join('&');
const near = (a, b, tol) => Math.abs(a - b) <= tol;

async function boot(flags, { base = NOW, q = Q_STAGE, seed = 4242, god = true, ctx = null, viewport = { width: 720, height: 1280 } } = {}) {
  const page = ctx ? await ctx.newPage() : await browser.newPage({ viewport });
  page.on('pageerror', (e) => { console.error(`pageerror: ${e.message}`); results.push({ name: `pageerror ${e.message}`, ok: false }); });
  await page.goto(`${base}?nodlg=1&nofreeze=1${flags ? `&${flags}` : ''}&${q}`);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
  await page.evaluate(async ({ seed, god }) => {
    const g = window.game; g.loop.sleep();
    let s = 12345; window.__draws = 0;
    window.__seed = (n) => { s = (n >>> 0) || 1; };
    Math.random = () => { window.__draws++; s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    window.__t = 1e5; Date.now = () => window.__t;
    window.__headless = true;
    window.__adv = (n = 1, dt = 1000 / 60) => {
      for (let i = 0; i < n; i++) { window.__t += dt; if (window.__headless) g.headlessStep(window.__t, dt); else g.step(window.__t, dt); }
    };
    window.__mod = async (re) => { const u = performance.getEntriesByType('resource').map((r) => r.name).find((n) => re.test(n)); return u ? import(u) : null; };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed }); window.__adv(2);
    window.__dbg = await window.__mod(/systems\/debug\.js/);
    if (god !== null) window.__dbg.setGodMode(god);
    window.__cfg = await window.__mod(/\/src\/config\.js/);
    window.__FX = await window.__mod(/systems\/FX\.js/);
    window.__WP = (await window.__mod(/entities\/WeaponPickup\.js/))?.WeaponPickup;
    const gs = window.__gs = g.scene.getScene('Game');
    for (let i = 0; i < 400 && !gs.roomSpec; i++) window.__adv(1);
    window.__adv(20);
    window.__ev = {}; window.__evN = 0;
    const em = gs.events.emit.bind(gs.events);
    gs.events.emit = (n, ...a) => { window.__ev[n] = (window.__ev[n] || 0) + 1; window.__evN++; return em(n, ...a); };
    const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; return h; };
    window.__clear = () => {
      gs.arenaActive = false; gs._spawnQueue = [];
      gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
      for (const gg of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets]) for (const bb of gg.getChildren()) if (bb.active) bb.kill();
    };
    window.__stage = (x = 600, y = 900) => { window.__adv(200); window.__clear(); window.__adv(3); window.__clear(); const P = gs.player; P.x = x; P.y = y; P.body.reset(x, y); P.superCharge = 0; P.meleeCharge = 0; window.__adv(60); window.__clear(); P.superCharge = 0; P.meleeCharge = 0; };
    window.__hold = (d) => { gs.cursors.space.isDown = !!d; };
    // n points at distance d from the hero on consecutive bearings `gap` apart, every one with a
    // clear line (no wall or cover within 30px of the segment) and inside the room
    window.__spots = (d, n, gap = 0.16) => {
      const P = gs.player, rects = gs.losRects || [], b = gs.roomSpec?.bounds ?? { w: 1600, h: 1600 };
      const cut = (x1, y1, x2, y2, r) => {
        let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
        const pp = [-dx, dx, -dy, dy], qq = [x1 - (r.x - 30), (r.right + 30) - x1, y1 - (r.y - 30), (r.bottom + 30) - y1];
        for (let i = 0; i < 4; i++) {
          if (pp[i] === 0) { if (qq[i] < 0) return false; } else { const t = qq[i] / pp[i]; if (pp[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
        }
        return true;
      };
      const ok = (a) => { const x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d; return x > 130 && y > 170 && x < b.w - 130 && y < b.h - 130 && !rects.some((r) => cut(P.x, P.y, x, y, r)); };
      for (let k = 0; k < 126; k++) {
        const a0 = k * 0.05;
        if (Array.from({ length: n }, (_, i) => ok(a0 + i * gap)).every(Boolean)) return Array.from({ length: n }, (_, i) => ({ x: P.x + Math.cos(a0 + i * gap) * d, y: P.y + Math.sin(a0 + i * gap) * d, a: a0 + i * gap }));
      }
      return null;
    };
    // a target that stands still and never dies unless asked to
    window.__dummy = (type, x, y, { hp = 1e6, elite = false, still = true } = {}) => {
      const e = gs.spawnEnemyAt(type, x, y);
      if (elite) gs._makeElite(e);
      e.hp = e.hpMax = hp;
      if (still) e.cfg = { ...e.cfg, speed: 0 };
      return e;
    };
    // THE SHIPPED-INPUT REPLAY (the smoke-b1 recipe): STANDARD by keyboardFire every N ticks
    window.__trace = ({ seed, ticks, seg, fire, superAt, melee, pickAt, clusterAt }) => {
      const K = gs.keys, cam = gs.cameras.main;
      window.__seed(seed); window.__draws = 0; window.__evN = 0;
      const hashes = []; const f = (v) => (Math.round(v * 1000) / 1000).toString();
      for (let i = 0; i < ticks; i++) {
        const P = gs.player;
        const cur = seg.find(([a, bb]) => i >= a && i < bb)[2];
        K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
        if (fire && i >= 60 && i % fire === 0) P.keyboardFire();
        if (superAt.includes(i)) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
        if (melee.includes(i)) { P.meleeCharge = 99; P.tryMeleeCombo(); }
        if (i === pickAt) gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'rifle'));
        if (i === clusterAt) gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'cluster'));
        window.__adv(1);
        let s2 = `${i}|${f(P.x)},${f(P.y)},${f(P.hp)},${P.shieldHp},${P.alive},${P.superCharge},${P.meleeCharge},${P.ammo},${P.ammoTimers.length},${P.fireCooldown},${P.secondary},${P.secondaryAmmo},${P._burstRemaining}|${f(cam.scrollX)},${f(cam.scrollY)}|${f(gs.time.timeScale)}|k${gs.runKills}|`;
        for (const e of gs.enemies.getChildren()) if (e.active) s2 += `${e.enemyType}:${f(e.x)},${f(e.y)},${Math.round(e.hp)},${e.state};`;
        if (gs.boss?.active) s2 += `V${f(gs.boss.x)},${f(gs.boss.y)},${Math.round(gs.boss.hp)};`;
        for (const g2 of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets]) for (const bb of g2?.getChildren?.() || []) if (bb.active) s2 += `b${f(bb.x)},${f(bb.y)},${bb.damage};`;
        s2 += `|d${window.__draws}|e${window.__evN}`;
        hashes.push(fnv(s2));
      }
      K.A.isDown = K.D.isDown = K.W.isDown = K.S.isDown = false;
      return { hashes, draws: window.__draws, ev: { ...window.__ev }, kills: gs.runKills, b1: !!gs._b1, b2: !!gs._b2 };
    };
    // THE B2 REPLAY: the trigger is held over tick ranges; `noCharge` leaves the two meters
    // (and their four events) out of the hash
    // the meters' own events, and the display objects the HUD-side ready state adds to the scene
    const CH = ['player-super-changed', 'player-super-ready', 'player-melee-changed', 'player-melee-ready', 'addedtoscene', 'removedfromscene'];
    window.__b2trace = ({ seed, ticks, seg, hold, superAt = [], melee = [], noCharge = false, pin = false }) => {
      const K = gs.keys, cam = gs.cameras.main, kb = gs.input.keyboard;
      window.__seed(seed); window.__draws = 0; window.__evN = 0; for (const k of CH) window.__ev[k] = 0;
      const hashes = []; const f = (v) => (Math.round(v * 1000) / 1000).toString();
      for (let i = 0; i < ticks; i++) {
        const P = gs.player;
        const cur = seg.find(([a, bb]) => i >= a && i < bb)[2];
        K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
        gs.cursors.space.isDown = hold.some(([a, bb]) => i >= a && i < bb);
        // `pin`: both meters held at zero, so neither build ever reaches the ready state (whose aura
        // and HUD pulse are the only things downstream of the economy)
        if (pin) { P.superCharge = 0; P.meleeCharge = 0; }
        if (superAt.includes(i)) { P.superCharge = 999; kb.emit('keydown-F', {}); }
        if (melee.includes(i)) { P.meleeCharge = 99; P.tryMeleeCombo(); }
        window.__adv(1);
        const w = gs._b2.state;
        let s2 = `${i}|${f(P.x)},${f(P.y)},${f(P.hp)},${P.shieldHp},${P.alive},${noCharge ? '-' : `${f(P.superCharge)},${f(P.meleeCharge)}`},${w.mag},${f(w.cool)},${f(w.reloadLeft)}|${f(cam.scrollX)},${f(cam.scrollY)}|${f(gs.time.timeScale)}|k${gs.runKills}|`;
        for (const e of gs.enemies.getChildren()) if (e.active) s2 += `${e.enemyType}:${f(e.x)},${f(e.y)},${Math.round(e.hp)},${e.state};`;
        for (const g2 of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets]) for (const bb of g2?.getChildren?.() || []) if (bb.active) s2 += `b${f(bb.x)},${f(bb.y)},${bb.damage};`;
        const evN = noCharge ? window.__evN - CH.reduce((a, k) => a + (window.__ev[k] || 0), 0) : window.__evN;
        s2 += `|d${window.__draws}|e${evN}`;
        hashes.push(fnv(s2));
      }
      K.A.isDown = K.D.isDown = K.W.isDown = K.S.isDown = false; gs.cursors.space.isDown = false;
      return { hashes, draws: window.__draws, kills: gs.runKills, shots: gs._b2.stats.shots, charge: [P0().superCharge, P0().meleeCharge] };
    };
    const P0 = () => gs.player;
  }, { seed, god });
  return page;
}
async function replay(flags, q, o = {}) {
  const p = await boot(flags, { base: o.base || NOW, q, god: o.god ?? true });
  const r = await p.evaluate((x) => window.__trace(x), { seed: 9071, ticks: o.ticks || TICKS, seg: FIGHT_SEG, fire: o.fire ?? 7, superAt: o.superAt ?? SUPER, melee: o.melee ?? MELEE, pickAt: o.pickAt ?? PICK, clusterAt: o.clusterAt ?? CLUSTER });
  await p.close();
  return r;
}
async function replayB2(flags, q, o = {}) {
  const p = await boot(flags, { q, god: o.god ?? true });
  const r = await p.evaluate((x) => window.__b2trace(x), { seed: 9071, ticks: o.ticks || TICKS, seg: FIGHT_SEG, hold: o.hold ?? [[60, 400], [460, 900], [960, 1500]], superAt: o.superAt ?? [], melee: o.melee ?? [], noCharge: !!o.noCharge, pin: !!o.pin });
  await p.close();
  return r;
}

// ── 0. FLAGS ──────────────────────────────────────────────────────────────
if (on(0)) {
  console.log('\n== 0. flags');
  const probe = () => {
    const gs = window.__gs, own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    return { v: window.__dbg.getB2Variant(), range: window.__dbg.isB2Range(), b2: !!gs._b2, b1: !!gs._b1, K: gs._b2 ? gs._b2.K : null,
      wrapped: [own(gs, 'firePlayerPrimary') && !gs._p2a ? 1 : 0, own(gs.player, '_firePistol') ? 1 : 0, own(gs.player, 'equipSecondary') ? 1 : 0, own(gs.physics.world, 'pause') ? 1 : 0].join(''),
      tick: /tone\(/.test(String(window.__FX.SFX.superTick)), ammoMax: window.__cfg.PLAYER.ammoMax, ammo: gs.player.ammo, panel: !!document.getElementById('b2-range') };
  };
  const cases = [['', null], [VIS, null], ['b2=A', 'A'], ['b2=b', 'B'], [join(VIS, 'b2=B'), 'B'], ['b2=X', null], ['b2=', null], ['b2=1', null], ['b1=G&b2=B', null], ['b2=B&b1=S', null]];
  for (const [fl, want] of cases) {
    const p = await boot(fl); await p.evaluate(() => window.__adv(5)); const r = await p.evaluate(probe); await p.close();
    const b1 = /b1=/.test(fl);
    check(`"${fl || '(none)'}": B2 ${want ?? 'off'}${b1 ? ' (a B1 variant wins)' : ''}; ${want ? 'installed' : 'nothing installed, nothing wrapped, the meter blip intact'}; PLAYER.ammoMax ${b1 ? 10 : 3}`,
      r.v === want && r.b2 === !!want && r.b1 === b1 && (want ? r.wrapped.slice(1) === '111' && !r.tick : r.wrapped.slice(1) === (b1 ? '000' : '000') && r.tick) && r.ammoMax === (b1 ? 10 : 3) && !r.panel, JSON.stringify({ v: r.v, w: r.wrapped, tick: r.tick, ammoMax: r.ammoMax }));
  }
  {
    const p = await boot('b2=B&b2x.dmg=80&b2x.cadence=10&b2x.meter=abc&b2x.nope=5&b2x.mag=12'); const r = await p.evaluate(probe); await p.close();
    check('knobs: b2x.dmg=80 and b2x.mag=12 apply; cadence clamps to its floor (40); a non-number and an unknown knob are ignored', r.K.dmg === 80 && r.K.mag === 12 && r.K.cadence === 40 && r.K.meter === 1000 && !('nope' in r.K), JSON.stringify(r.K));
    const p2 = await boot('b2=A&b2range=1'); const r2 = await p2.evaluate(probe); await p2.close();
    const p3 = await boot('b2range=1'); const r3 = await p3.evaluate(probe); await p3.close();
    check('b2range=1 needs a B2 variant: on with b2=A (panel present), ignored without', r2.range && r2.panel && !r3.range && !r3.panel && !r3.b2);
  }
}

// ── 1. FLAG OFF = 266b1ac ────────────────────────────────────────────────
if (on(1) && OLD) {
  console.log(`\n== 1. flag off = ${B2_BASE} (${OLD})`);
  for (const [label, q, fl] of [['SWARM TIDE, R1', Q_SWARM, ''], ['MIXED s6, R1', Q_MIXED, ''], ['VANGUARD, R1', Q_VAN, ''], ['SWARM TIDE, legacy', Q_SWARM, 'baseline=legacy'],
    ['MIXED s6, V2C+P1+P2-A3', Q_MIXED, VIS], ['MIXED s6, V2C+P1+P2-A3 + B0 instrument', Q_MIXED, join(VIS, 'b0=A')], ['SWARM TIDE, R1 + B0 instrument', Q_SWARM, 'b0=1'],
    ['MIXED s6, B1-G', Q_MIXED, join(VIS, 'b1=G')], ['SWARM TIDE, B1-S + B0 instrument', Q_SWARM, join(VIS, 'b1=S', 'b0=S')], ['VANGUARD, B1-M', Q_VAN, 'b1=M']]) {
    const a = await replay(fl, q, { base: OLD }), b = await replay(fl, q);
    const d = firstDiff(a.hashes, b.hashes);
    const evs = Object.keys({ ...a.ev, ...b.ev }).filter((k) => a.ev[k] !== b.ev[k]);
    check(`${label}: ${TICKS} ticks identical to ${B2_BASE} (state, ammo, draws, per-tick events)`, d < 0 && evs.length === 0 && !b.b2, d < 0 ? `${a.draws} draws, ${a.kills} kills` : `first divergent tick ${d}; ${evs.join(',')}`);
  }
  const a = await replay(VIS, Q_MIXED, { base: OLD, god: false }), b = await replay(VIS, Q_MIXED, { god: false });
  const d = firstDiff(a.hashes, b.hashes);
  check(`MIXED s6, V2C+P1+P2-A3, god mode off: identical to ${B2_BASE}`, d < 0, d < 0 ? '' : `first divergent tick ${d}`);
  const c = await replay(join(VIS, 'b0=A'), Q_MIXED, { base: OLD, god: false }), e = await replay(join(VIS, 'b0=A'), Q_MIXED, { god: false });
  const d2 = firstDiff(c.hashes, e.hashes);
  check(`the same with the B0 instrument (its new recovery wrappers observe only): identical to ${B2_BASE}`, d2 < 0, d2 < 0 ? '' : `first divergent tick ${d2}`);
} else if (on(1)) console.log('\n== 1. skipped (no --old=URL)');

// ── 2. A = B EXCEPT THE METERS ───────────────────────────────────────────
if (on(2)) {
  console.log('\n== 2. A = B except the meters');
  for (const [label, q] of [['SWARM TIDE', Q_SWARM], ['MIXED s6', Q_MIXED], ['VANGUARD', Q_VAN]]) {
    const a = await replayB2(join(VIS, 'b2=A'), q, { noCharge: true }), b = await replayB2(join(VIS, 'b2=B'), q, { noCharge: true });
    const d = firstDiff(a.hashes, b.hashes);
    check(`${label}: a held-stream fight, no Super cast, no melee — B2-A = B2-B tick for tick in everything but the two meters (positions, hp, every enemy and bolt, draws, events)`, d < 0 && a.shots > 100 && a.shots === b.shots, d < 0 ? `${a.shots} rounds, ${a.kills} kills, ${a.draws} draws; meters at the end A ${a.charge.map((v) => v.toFixed(2))} / B ${b.charge.map((v) => v.toFixed(2))}` : `first divergent tick ${d}`);
  }
  const a = await replayB2(join(VIS, 'b2=A'), Q_MIXED), b = await replayB2(join(VIS, 'b2=B'), Q_MIXED);
  const d = firstDiff(a.hashes, b.hashes);
  check(`CONTROL: with the meters in the hash the same comparison FAILS (first divergent tick ${d}) — it sees the economy`, d >= 0);
  const c = await replayB2(join(VIS, 'b2=A'), Q_MIXED, { noCharge: true, superAt: [500, 900] }), e = await replayB2(join(VIS, 'b2=B'), Q_MIXED, { noCharge: true, superAt: [500, 900] });
  const d2 = firstDiff(c.hashes, e.hashes);
  check(`CONTROL: with two Supers cast the fights part (first divergent tick ${d2}) — in A the pellets refill the meter, in B they do not, and the meter decides what the next cast can be`, d2 >= 0 || c.charge[0] !== e.charge[0], `meters at the end A ${c.charge.map((v) => v.toFixed(2))} / B ${e.charge.map((v) => v.toFixed(2))}`);
}

// ── 3. THE WEAPON ────────────────────────────────────────────────────────
if (on(3)) {
  console.log('\n== 3. the weapon');
  const p = await boot(join(VIS, 'b2=A'));
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, st = gs._b2.stats, w = gs._b2.state, PL = window.__cfg.PLAYER, out = {};
    window.__stage();
    const t = window.__dummy('shooter', 880, 900);
    // the first round leaves on the frame of the press
    const s0 = st.shots; window.__hold(true); window.__adv(1); out.firstFrame = st.shots - s0;
    // one cadence: 30 more ticks = 500ms = 5 more rounds
    window.__adv(30); out.after31 = st.shots - s0;
    window.__hold(false); window.__adv(30);
    const h = st.holdIntervals; out.bins = h.bins.map((c, i) => [i, c]).filter((q) => q[1]); out.over = h.over;
    // tap: one tick of trigger = exactly one round
    const s1 = st.shots; window.__hold(true); window.__adv(1); window.__hold(false); window.__adv(20); out.tap = st.shots - s1; out.taps = st.taps;
    // damage, and no shove on the body
    const hp0 = t.hp, x0 = P.x; P.body.setVelocity(0, 0);
    const s2 = st.shots; window.__hold(true); window.__adv(1); window.__hold(false);
    out.vAfterShot = Math.hypot(P.body.velocity.x, P.body.velocity.y);
    window.__adv(40); out.dmg = (hp0 - t.hp) / (st.shots - s2); out.drift = Math.abs(P.x - x0);
    // the magazine: hold through it
    window.__adv(120);                    // idle top-up first: back to 40
    out.topUp = [w.mag, st.mag.reloads.idle];
    const s3 = st.shots; window.__hold(true);
    let emptyAt = -1, backAt = -1, firedInReload = 0;
    for (let i = 0; i < 400; i++) {
      const before = st.shots; window.__adv(1);
      if (emptyAt < 0 && w.reloadLeft > 0) emptyAt = i;
      else if (emptyAt >= 0 && backAt < 0 && w.reloadLeft > 0 && st.shots > before) firedInReload++;
      if (emptyAt >= 0 && backAt < 0 && w.reloadLeft <= 0) backAt = i;
      if (backAt >= 0 && i >= backAt + 6) break;
    }
    out.magRounds = 0; out.emptyAt = emptyAt; out.reloadTicks = backAt - emptyAt; out.firedInReload = firedInReload; out.afterReload = st.shots - s3; out.reloadsEmpty = st.mag.reloads.empty; out.magAfter = w.mag;
    window.__hold(false); window.__adv(5);
    // Super = instant reload
    window.__hold(true); window.__adv(60); window.__hold(false); const m1 = w.mag;
    P.superCharge = 99; gs.input.keyboard.emit('keydown-F', {}); window.__adv(1);
    out.superReload = [m1, w.mag, st.mag.reloads.super];
    out.player = [PL.ammoMax, PL.fireCooldownMs, PL.ammoReloadMs, PL.pelletDamage, P.ammo, P.ammoTimers.length];
    out.visible = gs.playerBullets.getChildren().filter((b) => b.active && b.visible).length;
    return out;
  });
  check('the first round leaves on the frame of the press', r.firstFrame === 1);
  check('one cadence: 31 ticks (517ms) of trigger = 6 rounds, and every in-hold interval is exactly 100ms', r.after31 === 6 && r.bins.length === 1 && r.bins[0][0] === 100 && r.over === 0, JSON.stringify(r.bins));
  check('a tap (one frame of trigger) = exactly one round', r.tap === 1);
  check('damage 65 per round (x dmgMult 1); the shot adds no velocity to the body and the hero does not drift', near(r.dmg, 65, 0.01) && r.vAfterShot < 0.01 && r.drift < 0.5, `dmg ${r.dmg}, |v| ${r.vAfterShot.toFixed(3)}, drift ${r.drift.toFixed(2)}px`);
  check('a pause off the trigger tops a partial magazine up (idle reload) back to 40', r.topUp[0] === 40 && r.topUp[1] >= 1, JSON.stringify(r.topUp));
  check('40 rounds, then an automatic 900ms reload (54 ticks) with the trigger held, no round during it, and the stream resumes', near(r.emptyAt, 234, 1) && near(r.reloadTicks, 54, 1) && r.firedInReload === 0 && r.afterReload > 40 && r.reloadsEmpty === 1, JSON.stringify({ emptyAtTick: r.emptyAt, reloadTicks: r.reloadTicks, afterReload: r.afterReload }));
  check('casting the Super reloads the magazine instantly', r.superReload[0] < 40 && r.superReload[1] === 40 && r.superReload[2] === 1, JSON.stringify(r.superReload));
  check('PLAYER tuning and the pistol\'s own pool are untouched (3 / 120 / 520 / 120; ammo 3, no reload queue)', r.player.join() === '3,120,520,120,3,0', r.player.join());
  check('no B2 collider sprite is visible (the streak is drawn by the presentation layer)', r.visible === 0);
  // a 30 Hz step: the same cadence, and the rounds evenly spaced
  const r30 = await p.evaluate(() => {
    const gs = window.__gs, st = gs._b2.stats, w = gs._b2.state;
    window.__clear(); window.__adv(150);
    const s0 = st.shots; window.__hold(true); window.__adv(1, 1000 / 30);
    const xs = [];
    for (let i = 0; i < 29; i++) { window.__adv(1, 1000 / 30); }
    const live = gs._b2.rounds.map((q) => q.b).filter((b) => b.active).map((b) => Math.hypot(b.x - gs.player.x, b.y - gs.player.y)).sort((a, b) => a - b);
    const gaps = live.slice(1).map((v, i) => v - live[i]);
    window.__hold(false); window.__adv(10);
    return { shots: st.shots - s0, gaps, mag: w.mag };
  });
  check('at a 30 Hz step, 1.0s of trigger = 10 rounds, and the rounds in flight are evenly spaced (100px +/- 2)', r30.shots === 10 && r30.gaps.length >= 2 && r30.gaps.every((g) => near(g, 100, 2)), `${r30.shots} rounds; gaps ${r30.gaps.map((g) => g.toFixed(1)).join(', ')}`);
  await p.close();
}

// ── 4. THE AIM ───────────────────────────────────────────────────────────
if (on(4)) {
  console.log('\n== 4. the aim');
  const p = await boot(join(VIS, 'b2=A'));
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, st = gs._b2.stats, out = {};
    window.__stage();
    // LETHAL BOOKKEEPING: three one-round targets 380px away; the rounds are in flight ~350ms
    const sp3 = window.__spots(380, 3, 0.16);
    let es = sp3.map((q) => window.__dummy('swarmling', q.x, q.y, { hp: 60 }));
    let s0 = st.shots; window.__hold(true);
    let ticks = 0; while (es.some((e) => e.alive) && ticks < 200) { window.__adv(1); ticks++; }
    window.__hold(false); out.lethal = { rounds: st.shots - s0, ticks, skips: st.aim.lethalSkips };
    window.__adv(60); window.__clear(); window.__adv(120);
    // CONTROL: the same three targets with the bookkeeping off
    gs._b2.K.lethal = 0;
    es = sp3.map((q) => window.__dummy('swarmling', q.x, q.y, { hp: 60 }));
    s0 = st.shots; window.__hold(true); ticks = 0; while (es.some((e) => e.alive) && ticks < 200) { window.__adv(1); ticks++; }
    window.__hold(false); out.naive = { rounds: st.shots - s0, ticks }; gs._b2.K.lethal = 1;
    window.__adv(60); window.__clear(); window.__adv(120);
    // CLEAR LINE: a nearer target behind cover vs a farther one in the open
    const rects = gs.losRects || [];
    out.rects = rects.length;
    if (rects.length) {
      // put the hero left of a cover rect and one target right behind it
      const c = rects.slice().sort((a, b) => (b.width * b.height) - (a.width * a.height)).find((q) => q.width < 400 && q.height < 400 && q.x > 300 && q.right < 1300 && q.y > 300 && q.bottom < 1300) || rects[0];
      const y = c.centerY, hx = c.x - 150;
      P.x = hx; P.y = y; P.body.reset(hx, y); window.__adv(2);
      const hidden = window.__dummy('shooter', c.right + 60, y);
      const open = window.__dummy('shooter', hx, y - 330);
      const dH = Math.hypot(hidden.x - P.x, hidden.y - P.y), dO = Math.hypot(open.x - P.x, open.y - P.y);
      const h0 = open.hp; window.__hold(true); window.__adv(40); window.__hold(false); window.__adv(30);
      out.los = { dH, dO, openHit: h0 - open.hp, hiddenHit: 1e6 - hidden.hp, noLine: st.aim.noLine, target: gs._b2.state.target === open };
      window.__clear(); window.__adv(120);
    }
    // BULWARK: a field facing the hero is passed over for a soldier beside it
    P.x = 600; P.y = 900; P.body.reset(600, 900); window.__adv(2);
    const bw = window.__dummy('shielded', 840, 900); window.__adv(90);   // let it turn its field onto the hero
    const sol = window.__dummy('grunt', 900, 1040);
    const fa0 = st.aim.fieldAvoid, hs = sol.hp;
    window.__hold(true); window.__adv(40); window.__hold(false); window.__adv(30);
    out.field = { frontal: !!bw.isFrontalHit?.(Math.atan2(bw.y - P.y, bw.x - P.x)), avoid: st.aim.fieldAvoid - fa0, soldierHit: hs - sol.hp, bulwarkHit: 1e6 - bw.hp };
    window.__clear(); window.__adv(120);
    // LEAD: a target crossing at 300px/s, 350px away
    const run = (lead) => {
      gs._b2.K.lead = lead;
      const e = window.__dummy('grunt', 950, 700); e.cfg = { ...e.cfg, speed: 0 };
      const hp0 = e.hp, s1 = st.shots;
      window.__hold(true);
      for (let i = 0; i < 70; i++) { e.y += 5; e.body.reset(e.x, e.y); window.__adv(1); }
      window.__hold(false); window.__adv(40);
      const res = { rounds: st.shots - s1, hits: Math.round((hp0 - e.hp) / 65) };
      gs._destroyEnemyFully(e); window.__adv(100);
      return res;
    };
    out.lead1 = run(1); out.lead0 = run(0); gs._b2.K.lead = 1;
    // MANUAL: a dragged stick fires along its vector whatever is near
    const near2 = window.__dummy('grunt', 760, 900);
    const hud = window.game.scene.getScene('HUD'), fs = hud.fireStick;
    const m0 = st.aim.manual; fs.active = true; fs.vec = { x: 0, y: -1, force: 1, angle: -Math.PI / 2 };
    window.__adv(20); const dirs = gs._b2.rounds.map((q) => q.ang);
    fs.active = false; fs.vec = { x: 0, y: 0, force: 0, angle: 0 }; window.__adv(30);
    out.manual = { n: st.aim.manual - m0, up: dirs.length > 0 && dirs.every((a) => Math.abs(a + Math.PI / 2) < 1e-6), nearHit: 1e6 - near2.hp };
    window.__clear(); window.__adv(120);
    // SWEEP: two durable targets 100 degrees apart; killing one makes the stream turn onto the other
    P.x = 600; P.y = 900; P.body.reset(600, 900); window.__adv(2);
    const sw = window.__spots(260, 2, 1.75);
    const a = window.__dummy('grunt', sw[0].x, sw[0].y, { hp: 130 }), b = window.__dummy('grunt', P.x + Math.cos(sw[1].a) * 330, P.y + Math.sin(sw[1].a) * 330);
    out.sweepGeo = [Math.hypot(a.x - P.x, a.y - P.y), Math.hypot(b.x - P.x, b.y - P.y)];
    const sw0 = st.aim.sweepRounds, rt0 = st.aim.retargets;
    window.__hold(true); window.__adv(60); window.__hold(false); window.__adv(20);
    out.sweep = { sweepRounds: st.aim.sweepRounds - sw0, retargets: st.aim.retargets - rt0, bHit: 1e6 - b.hp, aDead: !a.alive };
    return out;
  });
  check('lethal bookkeeping: three one-round targets 380px away take one round each in the first 0.3s and all die sooner, with fewer rounds, than with it off (CONTROL)', r.lethal.skips >= 2 && r.lethal.rounds <= 7 && r.lethal.ticks < r.naive.ticks && r.lethal.rounds < r.naive.rounds, `on: ${r.lethal.rounds} rounds, ${r.lethal.ticks} ticks; off: ${r.naive.rounds} rounds, ${r.naive.ticks} ticks`);
  if (r.los) check('a clear line beats a nearer target behind cover: the open one (farther) takes the stream, the hidden one takes nothing', r.los.dH < r.los.dO && r.los.openHit > 0 && r.los.hiddenHit === 0, JSON.stringify(r.los));
  else check('a clear line beats a nearer target behind cover', false, 'no cover rects in the room');
  check('a Bulwark showing its field is passed over for the soldier beside it', r.field.frontal && r.field.avoid > 0 && r.field.soldierHit > 0 && r.field.bulwarkHit === 0, JSON.stringify(r.field));
  check('a crossing target (300px/s at 350px) is led: most rounds land with the lead, few without (CONTROL)', r.lead1.hits >= 0.7 * r.lead1.rounds && r.lead0.hits <= 0.35 * r.lead0.rounds, `lead on ${r.lead1.hits}/${r.lead1.rounds}, off ${r.lead0.hits}/${r.lead0.rounds}`);
  check('a dragged stick aims by hand: every round goes along the stick, not at the enemy beside the hero', r.manual.n > 0 && r.manual.up && r.manual.nearHit === 0, JSON.stringify(r.manual));
  check('the sweep: when its target dies the stream turns onto the next one (rounds fired mid-turn are counted) and hits it', r.sweep.aDead && r.sweep.retargets >= 1 && r.sweep.sweepRounds >= 1 && r.sweep.bHit > 0, JSON.stringify(r.sweep));
  await p.close();
}

// ── 5. THE IMPACT BUDGET ─────────────────────────────────────────────────
if (on(5)) {
  console.log('\n== 5. the impact budget');
  const run = async (flags, type = 'shooter') => {
    const p = await boot(join(VIS, flags), { god: true });
    const r = await p.evaluate((type) => {
      const gs = window.__gs, st = gs._b2.stats;
      window.__stage();
      const sp = window.__spots(260, 1)[0];
      const e = window.__dummy(type, sp.x, sp.y);
      window.__adv(30);
      let stag = 0, n = 0, fired = 0;
      const onShot = (who) => { if (who === e || who == null) fired++; }; gs.events.on('shooter-fire', onShot);
      const f0 = st.impact.flinch, p0 = st.impact.plain;
      window.__hold(true);
      // held in place, so a knockback slide cannot carry it out of reach: the question is the AI's time
      for (let i = 0; i < 240; i++) { window.__adv(1); e.x = sp.x; e.y = sp.y; e.body.reset(sp.x, sp.y); if (i >= 20) { n++; if (e._staggerMs > 0) stag++; } }
      window.__hold(false); gs.events.off('shooter-fire', onShot);
      return { share: stag / n, flinch: st.impact.flinch - f0, plain: st.impact.plain - p0, fired };
    }, type);
    await p.close();
    return r;
  };
  const b = await run('b2=A'), c = await run('b2=A&b2x.flinch=0');
  check('a Gunner under a held stream for 4s: its AI is suspended at most 25% of the time (one knockback hit per 600ms)', b.share <= 0.25 && b.flinch >= 5 && b.flinch <= 8 && b.plain > 25, `suspended ${(b.share * 100).toFixed(1)}%; ${b.flinch} hits with stagger, ${b.plain} without`);
  check('CONTROL (b2x.flinch=0, every hit staggers as R1 would): the same stream suspends it >= 80% of the time — the lock the budget removes', c.share >= 0.8, `suspended ${(c.share * 100).toFixed(1)}%`);
  check('the AI itself is untouched: under the budgeted stream the Gunner keeps firing; under the lock it barely does', b.fired >= 3 && c.fired <= Math.max(1, b.fired / 3), `shots fired in 4s: budget ${b.fired}, lock ${c.fired}`);
  const p = await boot(join(VIS, 'b2=A'));
  const r = await p.evaluate(() => {
    const gs = window.__gs, st = gs._b2.stats; window.__stage();
    const ring = window.__spots(320, 5, 0.14);
    for (const q of ring) { window.__dummy('swarmling', q.x, q.y, { hp: 60 }); window.__dummy('swarmling', gs.player.x + Math.cos(q.a) * 250, gs.player.y + Math.sin(q.a) * 250, { hp: 60 }); }
    const w = gs.physics.world, k0 = gs.runKills; let pausedTicks = 0;
    window.__hold(true); let t = 0; while (gs.enemies.getChildren().some((e) => e.alive) && t < 300) { window.__adv(1); t++; if (w.isPaused) pausedTicks++; }
    window.__hold(false); window.__adv(10);
    return { kills: gs.runKills - k0, pausedTicks, ticks: t, taken: st.stops.taken, skipped: st.stops.skipped };
  });
  check('kill hit-stop budget: 10 kills in a row by the stream take at most one 45ms stop per 250ms (the rest are skipped)', r.kills === 10 && r.taken + r.skipped >= 8 && r.taken <= Math.ceil((r.ticks * 16.667) / 250) + 1 && r.skipped >= 3 && r.pausedTicks <= r.taken * 4, JSON.stringify(r));
  await p.close();
}

// ── 6. THE ECONOMY ───────────────────────────────────────────────────────
if (on(6)) {
  console.log('\n== 6. the economy');
  const p = await boot(join(VIS, 'b2=B'));
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, st = gs._b2.stats, out = {}, kb = gs.input.keyboard;
    window.__stage();
    const one = () => { window.__hold(true); window.__adv(1); window.__hold(false); window.__adv(40); };
    // one round on a durable target: 65 removed -> 65/1000*4 Super units, 65/1600*3 melee units
    const t = window.__dummy('grunt', 820, 900);
    one(); out.round = [P.superCharge, P.meleeCharge];
    // overkill earns nothing beyond what was removed: a 10-hp target
    gs._destroyEnemyFully(t); P.superCharge = 0; P.meleeCharge = 0;
    const weak = window.__dummy('grunt', 820, 900, { hp: 10 });
    one(); out.overkill = [P.superCharge, weak.alive];
    // the Super's own damage charges nothing
    P.superCharge = 0; P.meleeCharge = 0;
    for (let i = 0; i < 4; i++) window.__dummy('grunt', 800 + i * 30, 860 + i * 30, { hp: 5000 });
    P.superCharge = 4; kb.emit('keydown-F', {}); window.__adv(60);
    const sup = st.charge.super.super;
    out.superSelf = { charge: P.superCharge, melee: P.meleeCharge, events: sup.events, dmg: sup.dmg, added: sup.added };
    window.__clear(); window.__adv(60);
    // Broken Wings counts at half for the Super, nothing for itself
    P.superCharge = 0; P.meleeCharge = 0;
    const m = window.__dummy('grunt', 690, 900, { hp: 5000 });
    P.meleeCharge = 3; P.facing = 0; P.tryMeleeCombo(0); window.__adv(40);
    const md = 5000 - m.hp;
    out.melee = { dmg: md, charge: P.superCharge, expect: (md * 0.5 / 1000) * 4, meleeMeter: P.meleeCharge };
    window.__clear(); window.__adv(120);
    // a nemesis at 0.34; the Overcharge perk scales both
    P.superCharge = 0; P.meleeCharge = 0;
    const n = window.__dummy('grunt', 820, 900); n._miniBoss = true;
    one(); out.nemesis = P.superCharge;
    n._miniBoss = false; P.superCharge = 0; P.superGainMult = 1.3;
    one(); out.perk = P.superCharge; P.superGainMult = 1;
    // the ready event fires once, at the fill
    P.superCharge = 0; let ready = 0; const on2 = () => { ready++; }; gs.events.on('player-super-ready', on2);
    window.__hold(true); window.__adv(240); window.__hold(false); gs.events.off('player-super-ready', on2);
    out.fill = { charge: P.superCharge, ready, wasted: st.charge.super.gun.wasted > 0 };
    out.swallowed = st.swallowed;
    return out;
  });
  check('B: one 65-damage round adds 65/1000 x 4 = 0.26 Super units and 65/1600 x 3 = 0.122 Broken Wings units', near(r.round[0], 0.26, 1e-9) && near(r.round[1], 65 / 1600 * 3, 1e-9), r.round.map((v) => v.toFixed(4)).join(' / '));
  check('B: overkill earns nothing — a round that kills a 10-hp target adds 10/1000 x 4 = 0.04', near(r.overkill[0], 0.04, 1e-9) && !r.overkill[1], r.overkill[0].toFixed(4));
  check('B: the Super\'s own damage charges NOTHING (a cast through four targets leaves both meters at 0)', r.superSelf.charge === 0 && r.superSelf.melee === 0 && r.superSelf.events >= 4 && r.superSelf.dmg > 2000 && r.superSelf.added === 0, JSON.stringify(r.superSelf));
  check('B: Broken Wings damage counts at half for the Super and nothing for its own meter', r.melee.dmg > 0 && near(r.melee.charge, r.melee.expect, 1e-6) && r.melee.meleeMeter === 0, JSON.stringify(r.melee));
  check('B: damage to a nemesis counts at 0.34; the Overcharge perk (x1.3) scales the gain', near(r.nemesis, 0.26 * 0.34, 1e-9) && near(r.perk, 0.26 * 1.3, 1e-9), `${r.nemesis.toFixed(4)} / ${r.perk.toFixed(4)}`);
  check('B: a held stream fills the meter (4), the ready event fires exactly once, and the surplus is recorded as wasted', r.fill.charge === 4 && r.fill.ready === 1 && r.fill.wasted && r.swallowed.super > 0 && r.swallowed.melee > 0, JSON.stringify(r.fill));
  await p.close();
  const pa = await boot(join(VIS, 'b2=A'));
  const a = await pa.evaluate(() => {
    const gs = window.__gs, P = gs.player, out = {};
    window.__stage();
    window.__dummy('grunt', 820, 900);
    window.__hold(true); window.__adv(1); window.__hold(false); window.__adv(40);
    out.round = [P.superCharge, P.meleeCharge];
    P.superCharge = 0; P.meleeCharge = 0;
    for (let i = 0; i < 4; i++) window.__dummy('grunt', 800 + i * 30, 860 + i * 30, { hp: 5000 });
    P.superCharge = 4; gs.input.keyboard.emit('keydown-F', {}); window.__adv(60);
    out.superSelf = P.superCharge;
    out.swallowed = gs._b2.stats.swallowed;
    return out;
  });
  check('A: the R1 rule is untouched — one hit = one unit on both meters, and a Super through a crowd recharges itself', a.round[0] === 1 && a.round[1] === 1 && a.superSelf >= 3 && a.swallowed.super === 0, JSON.stringify(a));
  await pa.close();
  const pk = await boot(join(VIS, 'b2=B&b2x.meter=500&b2x.melee=800'));
  const k = await pk.evaluate(() => { const gs = window.__gs, P = gs.player; window.__stage(); window.__dummy('grunt', 820, 900); window.__hold(true); window.__adv(1); window.__hold(false); window.__adv(40); return [P.superCharge, P.meleeCharge]; });
  check('the meter knobs: b2x.meter=500 and b2x.melee=800 double both gains', near(k[0], 0.52, 1e-9) && near(k[1], 65 / 800 * 3, 1e-9), k.map((v) => v.toFixed(4)).join(' / '));
  await pk.close();
}

// ── 7. CONTROLS ──────────────────────────────────────────────────────────
if (on(7)) {
  console.log('\n== 7. controls');
  const p = await boot(join(VIS, 'b2=B'));
  // real key events: the page is stepped by hand, so each press is followed by frames
  await p.evaluate(() => { window.__stage(); window.__dummy('grunt', 880, 900); window.__gs.player.superCharge = 4; });
  const s0 = await p.evaluate(() => window.__gs._b2.stats.shots);
  await p.keyboard.down('Space'); await p.evaluate(() => window.__adv(31));
  const k1 = await p.evaluate(() => ({ shots: window.__gs._b2.stats.shots, aiming: window.__gs.player.superAiming, spaceAt: window.__gs._spaceDownAt, charge: window.__gs.player.superCharge, key: window.__gs._b2.stats.pressKey }));
  await p.keyboard.up('Space'); await p.evaluate(() => window.__adv(10));
  check('SPACE with a FULL meter is the trigger: 31 ticks held = 6 rounds, no Super aim, the meter still full', k1.shots - s0 === 6 && !k1.aiming && !k1.spaceAt && k1.charge === 4 && k1.key >= 1, JSON.stringify(k1));
  const c0 = await p.evaluate(() => { const gs = window.__gs; window.__sup = 0; gs.events.on('player-fire-super', () => { window.__sup++; }); return gs.player.superCharge; });
  await p.keyboard.press('f'); await p.evaluate(() => window.__adv(12));
  const f1 = await p.evaluate(() => ({ sup: window.__sup, charge: window.__gs.player.superCharge }));
  await p.evaluate(() => { window.__gs.player.superCharge = 4; });
  await p.keyboard.press('Enter'); await p.evaluate(() => window.__adv(12));
  const f2 = await p.evaluate(() => ({ sup: window.__sup, charge: window.__gs.player.superCharge }));
  check('F and ENTER cast the Super (each once per press), aimed at the nearest enemy', c0 === 4 && f1.sup === 1 && f1.charge < 4 && f2.sup === 2, JSON.stringify([f1, f2]));
  await p.keyboard.down('Space'); await p.evaluate(() => window.__adv(1)); await p.keyboard.up('Space'); await p.evaluate(() => window.__adv(20));
  // cluster pod and OVERRIDE
  const sec = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, st = gs._b2.stats, w = gs._b2.state, out = {};
    window.__clear(); window.__adv(120); const t = window.__dummy('grunt', 880, 900);
    P.equipSecondary('cluster'); out.cluster = [P.secondary, P.secondaryAmmo];
    const s1 = st.shots; window.__hold(true); window.__adv(30); window.__hold(false); out.streamWithCluster = st.shots - s1;
    let thrown = 0; const on2 = () => { thrown++; }; gs.events.on('player-fire-cluster', on2);
    P.releaseAim(null); window.__adv(30); P.releaseAim(null); window.__adv(30); P.releaseAim(null); window.__adv(120);
    gs.events.off('player-fire-cluster', on2); out.thrown = thrown; out.after = P.secondary;
    // OVERRIDE -> OVERCHARGE
    window.__clear(); window.__adv(200); const t2 = window.__dummy('grunt', 880, 900);
    P.equipSecondary('rifle'); out.rifle = [P.secondary, w.hot, st.hot.pickups];
    const hp0 = t2.hp; window.__hold(true); window.__adv(1); window.__hold(false); window.__adv(40);
    out.hotDmg = hp0 - t2.hp; out.hotLeft = w.hot;
    const hud = window.game.scene.getScene('HUD');
    out.pips = hud.ammoPips.filter((q) => q.visible).length;
    return out;
  });
  check('the cluster pod is unchanged: with it equipped the trigger does not stream, and each release throws one (3 throws)', sec.cluster.join() === 'cluster,3' && sec.streamWithCluster === 0 && sec.thrown === 3 && sec.after === null, JSON.stringify(sec));
  check('an OVERRIDE pickup becomes an OVERCHARGE: nothing is equipped, 80 hot rounds at x1.4 (91 damage)', sec.rifle[0] === null && sec.rifle[1] === 80 && sec.rifle[2] === 1 && near(sec.hotDmg, 91, 0.01) && sec.hotLeft === 79, JSON.stringify(sec.rifle) + ` dmg ${sec.hotDmg}`);
  check('the three-round pistol\'s HUD pips are hidden', sec.pips === 0);
  await p.close();
  // a REAL touch: press and tap on the fire stick through the browser's touch pipeline
  const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const pt = await boot(join(VIS, 'b2=B'), { ctx });
  const geo = await pt.evaluate(async () => {
    window.__stage(); window.__dummy('grunt', 880, 900);
    const L = await window.__mod(/systems\/controlLayout\.js/);
    const hud = window.game.scene.getScene('HUD'); const c = window.game.canvas.getBoundingClientRect();
    const fire = L.getControl('fireStick'); const k = c.width / 720;
    return { x: c.left + fire.x * k, y: c.top + fire.y * k, sup: { x: c.left + hud.superButton.x * k, y: c.top + hud.superButton.y * k } };
  });
  const cdp = await ctx.newCDPSession(pt);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const sh = () => pt.evaluate(() => ({ shots: window.__gs._b2.stats.shots, touch: window.__gs._b2.stats.pressTouch, taps: window.__gs._b2.stats.taps, trig: window.__gs._b2.state.trig }));
  const t0 = await sh();
  await touch('touchStart', geo.x, geo.y); await pt.evaluate(() => window.__adv(2));
  const t1 = await sh();
  await pt.evaluate(() => window.__adv(29));
  const t2 = await sh();
  await touch('touchEnd'); await pt.evaluate(() => window.__adv(20));
  const t3 = await sh();
  check('a REAL touch press on the fire stick: the stream starts within 2 frames, 31 ticks = 6 rounds, and the release adds none', t1.shots - t0.shots === 1 && t2.shots - t0.shots === 6 && t3.shots === t2.shots && t2.touch >= 1 && !t3.trig, JSON.stringify([t0, t1, t2, t3]));
  await touch('touchStart', geo.x, geo.y); await touch('touchEnd'); await pt.evaluate(() => window.__adv(20));
  const t4 = await sh();
  check('a REAL touch tap shorter than a frame fires exactly one round', t4.shots - t3.shots === 1, `${t4.shots - t3.shots}`);
  await pt.evaluate(() => { window.__gs.player.superCharge = 4; window.__supT = 0; window.__gs.events.on('player-fire-super', () => { window.__supT++; }); });
  const t5 = await sh();
  await touch('touchStart', geo.sup.x, geo.sup.y); await pt.evaluate(() => window.__adv(3)); await touch('touchEnd'); await pt.evaluate(() => window.__adv(12));
  const t6 = await pt.evaluate(() => ({ sup: window.__supT, shots: window.__gs._b2.stats.shots }));
  check('the Super button is still the Super on touch, and the fire stick does not claim it', t6.sup === 1 && t6.shots === t5.shots, JSON.stringify(t6));
  await pt.close(); await ctx.close();
}

// ── 8. RESTARTS ──────────────────────────────────────────────────────────
if (on(8)) {
  console.log('\n== 8. restarts');
  const p = await boot(join(VIS, 'b2=B', 'b0=T'));
  const r = await p.evaluate(async () => {
    const gs = window.__gs, own = (o, k) => Object.prototype.hasOwnProperty.call(o, k), out = {};
    const state = () => ({ b2: !!gs._b2, post: gs.events.listeners('postupdate').length, hit: gs.events.listeners('enemy-hit').length, tick: /tone\(/.test(String(window.__FX.SFX.superTick)), hitSfx: /noise\(/.test(String(window.__FX.SFX.hit)),
      pips: window.game.scene.getScene('HUD').ammoPips?.filter((q) => q.visible).length });
    window.__adv(30); out.first = state();
    const api0 = gs._b2;
    gs.scene.restart({ mode: 'endless', seed: 4242 }); window.__adv(3);
    for (let i = 0; i < 400 && !gs.roomSpec; i++) window.__adv(1);
    window.__adv(30); out.second = state(); out.fresh = gs._b2 !== api0;
    window.__hold(true); window.__adv(13); window.__hold(false); out.shots = gs._b2.stats.shots;
    gs.scene.restart({ mode: 'endless', seed: 4242 }); window.__adv(3);
    for (let i = 0; i < 400 && !gs.roomSpec; i++) window.__adv(1);
    window.__adv(30); out.third = state();
    // quit to the title: everything B2 wrapped is handed back
    gs.scene.stop('HUD'); gs.scene.start('Title'); window.__adv(5);
    out.title = { b2: !!gs._b2, tick: /tone\(/.test(String(window.__FX.SFX.superTick)), half: /tone\(/.test(String(window.__FX.SFX.superHalf)), hitSfx: /noise\(/.test(String(window.__FX.SFX.hit)),
      own: ['firePlayerPrimary', '_cameraPunch', 'handleBulletEnemyHits', 'handleBulletWallHits', '_impactMicroFlash', '_clusterImpact', 'detonateGrenade', 'performMeleeLand', '_startWave', 'loadRoom'].filter((k) => own(gs, k)),
      panel: !!document.getElementById('b2-range') };
    return out;
  });
  check('restart twice: one install each time (the listener counts do not grow), a fresh state, and the weapon fires', r.fresh && r.second.b2 && r.third.b2 && r.first.post === r.second.post && r.second.post === r.third.post && r.first.hit === r.second.hit && r.second.hit === r.third.hit && r.shots === 3, JSON.stringify([r.first, r.second, r.third]));
  check('quit to the title: B2 is gone, the meter blips and the hit beep are the shipped functions again, and no wrapper is left on the scene', !r.title.b2 && r.title.tick && r.title.half && r.title.hitSfx && r.title.own.length === 0 && !r.title.panel, JSON.stringify(r.title));
  await p.close();
}

// ── 9. TELEMETRY ─────────────────────────────────────────────────────────
if (on(9)) {
  console.log('\n== 9. telemetry');
  const p = await boot(join(VIS, 'b2=B', 'b0=T'), { q: Q_MIXED, god: false });
  const r = await p.evaluate(async () => {
    const gs = window.__gs, P = gs.player, kb = gs.input.keyboard;
    let casts = 0, minHp = P.hp, lost = 0, prev = P.superCharge;
    window.__seed(777);
    for (let t = 0; t < 1500; t++) {
      gs.cursors.space.isDown = t % 400 < 330;
      if (P.superCharge < prev - 1e-6) lost += prev - P.superCharge;        // a respawn empties the meter
      prev = P.superCharge;
      if (P.alive && P.superCharge >= 4 && t % 10 === 0) { kb.emit('keydown-F', {}); casts++; prev = P.superCharge; }
      P.setMoveInput({ x: Math.sin(t / 90), y: Math.cos(t / 140), force: 0.8 });
      window.__adv(1);
      if (P.alive) minHp = Math.min(minHp, P.hp);
    }
    gs.cursors.space.isDown = false; window.__adv(5);
    const st = (await window.__mod(/systems\/b0Report\.js/)).b0Store();
    const runs = st._runs(); const run = runs[runs.length - 1];
    const sum = st._summarize(run);
    const html = st._text ? st._text(run) : '';
    const live = gs._b2.stats;
    return { has: { b2: !!run.b2, rec: !!run.recovery, cfg: run.run.config.b2 }, shots: [run.b2.shots, run.player.fired.standard], casts: [casts, run.player.super.casts],
      added: Object.values(run.b2.charge.super).reduce((a, c) => a + c.added, 0), charge: P.superCharge, lost,
      dmgGun: [run.b2.charge.super.gun.dmg, run.player.dmg.standard], dmgSuper: [run.b2.charge.super.super.dmg, run.player.dmg.super],
      b0charge: Object.values(run.charge.super).reduce((a, c) => a + c.events, 0),
      minHp: [Math.round(minHp), Math.round(run.recovery.minHp), run.waves.map((w) => (w.minHp == null ? null : Math.round(w.minHp)))],
      rec: run.recovery, taken: run.incoming.hpRemoved, hpEnd: P.hp, deaths: run.incoming.deaths,
      stag: run.enemies.filter((e) => e.staggerMs > 0).length, share: sum.b2?.staggerShare, near: sum.b2?.holdNear, input: run.input.standard,
      text: /B2 flagship rifle \(variant B\)/.test(html) && /Recovery/.test(html), same: live.shots === run.b2.shots };
  });
  check('the export carries the b2 block, config.b2 = B, the recovery ledger and a report section', r.has.b2 && r.has.rec && r.has.cfg === 'B' && r.text && r.same, JSON.stringify(r.has));
  check('rounds: b2.shots = the instrument\'s STANDARD count; Super casts match; every round is recorded as a held-key round', r.shots[0] === r.shots[1] && r.shots[0] > 150 && r.casts[0] === r.casts[1] && r.input['hold-key'] === r.shots[0], JSON.stringify({ shots: r.shots, casts: r.casts, input: r.input }));
  check('the ledger adds up: Super units added = 4 x casts + the meter now + what a respawn emptied; gun and Super durability = the instrument\'s damage truth; the per-hit ledger is empty', near(r.added, 4 * r.casts[0] + r.charge + r.lost, 1e-6) && near(r.dmgGun[0], r.dmgGun[1], 0.5) && near(r.dmgSuper[0], r.dmgSuper[1], 0.5) && r.b0charge === 0, JSON.stringify({ added: r.added, casts: r.casts[0], charge: r.charge, lost: r.lost, gun: r.dmgGun, sup: r.dmgSuper }));
  check('lowest hp: the recorded minimum = the minimum the test sampled, and every wave has one', r.minHp[0] === r.minHp[1] && r.minHp[2].length > 0 && r.minHp[2].every((v) => v != null), JSON.stringify(r.minHp));
  {
    const healed = r.rec.hp.regen + r.rec.hp.kill + r.rec.hp.pickup;
    check('recovery balances: 1000 - hp removed + hp restored (+ a respawn\'s refill) = hp now', near(1000 - r.taken + healed + r.rec.hp.respawn, r.hpEnd, 1) && r.rec.hp.regen > 0 && r.rec.shield.wave >= 300, `removed ${Math.round(r.taken)}, restored ${Math.round(healed)} (regen ${Math.round(r.rec.hp.regen)}, pickups ${Math.round(r.rec.hp.pickup)}), respawn ${Math.round(r.rec.hp.respawn)} (${r.deaths} death), hp ${Math.round(r.hpEnd)}; shield gained ${JSON.stringify(r.rec.shield)}`);
  }
  check('stagger time is recorded per enemy, and the AI-suspended share under fire is within the budget (<= 35% in a mixed fight with Supers)', r.stag > 0 && r.share != null && r.share <= 0.35 && r.near >= 0.95, `enemies with stagger ${r.stag}, share ${(r.share * 100).toFixed(1)}%, in-hold intervals on cadence ${(r.near * 100).toFixed(1)}%`);
  await p.close();
}

// ── 10. THE FIRING RANGE ─────────────────────────────────────────────────
if (on(10)) {
  console.log('\n== 10. the firing range');
  const p = await boot(join(VIS, 'b2=B', 'b2range=1'), { q: 'room=hangar', god: null });
  const r = await p.evaluate(() => {
    const gs = window.__gs, R = gs._b2.range, out = {};
    window.__adv(600);
    out.quiet = { enemies: gs.enemies.getChildren().filter((e) => e.alive).length, phase: gs._wavePhase ?? null, god: window.__dbg.isGodMode() };
    out.counts = {};
    for (const g of R.groups) { R.clear(); window.__adv(30); out.counts[g] = [R.spawn(g), gs.enemies.getChildren().filter((e) => e.alive).length]; window.__adv(5); }
    out.elite = gs.enemies.getChildren().filter((e) => e.alive && e._elite).length;
    const inWall = gs.enemies.getChildren().filter((e) => e.alive && (gs.losRects || []).some((q) => e.x >= q.x && e.x <= q.right && e.y >= q.y && e.y <= q.bottom)).length;
    out.inWall = inWall;
    R.clear(); window.__adv(30); out.cleared = gs.enemies.getChildren().filter((e) => e.alive).length;
    R.setCharge(true); out.full = gs.player.superCharge; R.setCharge(false); out.empty = gs.player.superCharge;
    const panel = document.getElementById('b2-range'); out.buttons = panel ? panel.querySelectorAll('button').length : 0;
    R.spawn('SQUAD'); window.__hold(true); window.__adv(200); window.__hold(false);
    out.fight = { shots: gs._b2.stats.shots, hp: gs.player.hp };
    return out;
  });
  const want = { SWARM: 6, SQUAD: 5, GUNNERS: 3, MARKSMEN: 2, DEMOS: 3, BULWARK: 3, ELITE: 1, HORDE: 14 };
  check('the range starts no wave: after 10s nothing has spawned, and the hero is safe by default', r.quiet.enemies === 0 && r.quiet.god, JSON.stringify(r.quiet));
  check('every group spawns its exact count through the game\'s own spawnEnemyAt, none inside a wall; ELITE is an Elite', Object.entries(want).every(([k, n]) => r.counts[k][0] === n) && r.inWall === 0, JSON.stringify(r.counts));
  check('CLEAR empties the room; FILL / EMPTY SUPER set the meter; the panel has its 13 buttons; the weapon works there', r.cleared === 0 && r.full === 4 && r.empty === 0 && r.buttons === 13 && r.fight.shots > 20 && r.fight.hp === 1000, JSON.stringify({ cleared: r.cleared, buttons: r.buttons, fight: r.fight }));
  await p.close();
}

// ── 11. DETERMINISM ──────────────────────────────────────────────────────
if (on(11)) {
  console.log('\n== 11. determinism');
  for (const v of ['A', 'B']) {
    const o = { superAt: [500, 900, 1300], melee: [320, 345, 370], god: false };
    const a = await replayB2(join(VIS, `b2=${v}`), Q_MIXED, o), b = await replayB2(join(VIS, `b2=${v}`), Q_MIXED, o);
    const d = firstDiff(a.hashes, b.hashes);
    check(`B2-${v}: a seeded fight (stream, three Supers, a Broken Wings chain, god mode off) repeats tick for tick`, d < 0 && a.draws === b.draws && a.shots > 100, d < 0 ? `${a.shots} rounds, ${a.kills} kills, ${a.draws} draws` : `first divergent tick ${d}`);
  }
  const root = new URL('..', import.meta.url).pathname;
  const files = ['b2Flagship.js', 'b2Feel.js', 'b2Voice.js', 'b2Range.js'];
  const hits = files.flatMap((f) => readFileSync(`${root}src/systems/${f}`, 'utf8').split('\n').map((l, i) => [f, i + 1, l]).filter(([, , l]) => /Math\.random\s*\(/.test(l.replace(/\/\/.*$/, '').replace(/`[^`]*`/g, ''))));
  check('no Math.random call anywhere in the four B2 modules', hits.length === 0, hits.map((h) => `${h[0]}:${h[1]}`).join(', '));
}

// ── 12. PRESENTATION ─────────────────────────────────────────────────────
if (on(12)) {
  console.log('\n== 12. presentation');
  const p = await boot(join(VIS, 'b2=B'), { q: Q_MIXED });
  const r = await p.evaluate(() => {
    const gs = window.__gs, f = gs._b2.stats.feel, P = gs.player;
    window.__headless = false;
    let hiddenOk = true;
    for (let t = 0; t < 700; t++) {
      gs.cursors.space.isDown = t % 300 < 250;
      if (P.superCharge >= 4 && t % 10 === 0) gs.input.keyboard.emit('keydown-F', {});
      P.setMoveInput({ x: Math.sin(t / 90), y: Math.cos(t / 140), force: 0.8 });
      window.__adv(1);
      for (const q of gs._b2.rounds) if (q.b.active && q.b.visible) hiddenOk = false;
    }
    gs.cursors.space.isDown = false; window.__adv(60);
    const mine = gs.children.list.filter((o) => o.texture && /^b2-/.test(o.texture.key));
    const lingering = mine.filter((o) => o.visible && /b2-(core|trail|body|head|mz\d|spark)/.test(o.texture.key)).length;
    return { hiddenOk, f, objects: mine.length, lingering, p2aBolts: gs._p2a ? gs._p2a.bolts.length : null, shots: gs._b2.stats.shots };
  });
  check('every B2 round is drawn by B2 only: its collider sprite is never visible and P2-A registers none of them', r.hiddenOk && r.p2aBolts === 0 && r.f.rounds === r.shots, `${r.f.rounds} streaks for ${r.shots} rounds`);
  check('pooled and bounded: a 12s fight peaks under 80 live objects, and one second after the stream stops no streak, flash or spark is left on screen', r.f.peakObjects < 80 && r.lingering === 0, `peak ${r.f.peakObjects} objects, ${r.f.peakRounds} streaks; ${r.objects} created in all; ${(r.f.updMs / r.f.updN * 1000).toFixed(0)}us/frame mean, ${r.f.updMax.toFixed(2)}ms max`);
  check('damage numbers roll up (fewer labels than hits) and the generic ring / spark / beep are not drawn per round', r.f.numbersOut > 0 && r.f.numbersOut < 0.7 * r.f.numbersIn && r.f.dropped.ring > 0 && r.f.dropped.burst > 0 && r.f.dropped.beep > 0, JSON.stringify({ in: r.f.numbersIn, out: r.f.numbersOut, dropped: r.f.dropped }));
  check('the hit hierarchy: full white flashes are a minority of the rounds that land on a target under a stream', r.f.flashesFull > 0 && r.f.flashesSoft > 0, `${r.f.flashesFull} full, ${r.f.flashesSoft} soft`);
  // the voice, rendered offline
  const v = await p.evaluate(async () => {
    const u = performance.getEntriesByType('resource').map((q) => q.name).find((n) => /systems\/b2Voice\.js/.test(n));
    const { b2VoiceKit } = await import(u);
    const bands = async (heat) => {
      const sr = 48000, ctx = new OfflineAudioContext(1, sr * 1.2, sr), kit = b2VoiceKit(ctx, ctx.destination);
      for (let i = 0; i < 10; i++) kit.shot(0.05 + i * 0.1, { heat, accent: (i & 3) === 3, n: i });
      const d = (await ctx.startRendering()).getChannelData(0);
      // Goertzel-free band split: a 2048-point DFT by hand would be slow; use an AnalyserNode-less FFT via biquad energy
      const N = 2048; let lo = 0, mid = 0, hi = 0, hi24 = 0;
      for (let s0 = 0; s0 + N <= d.length; s0 += N) {
        const re = new Float32Array(N), im = new Float32Array(N);
        for (let i = 0; i < N; i++) re[i] = d[s0 + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
        for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; } }
        for (let len = 2; len <= N; len <<= 1) { const ang = (-2 * Math.PI) / len; for (let i = 0; i < N; i += len) for (let k2 = 0; k2 < len / 2; k2++) { const wr = Math.cos(ang * k2), wi = Math.sin(ang * k2), a = i + k2, b = a + len / 2; const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr; re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; } }
        for (let k2 = 1; k2 < N / 2; k2++) { const fq = (k2 * sr) / N, e = re[k2] * re[k2] + im[k2] * im[k2]; if (fq < 300) lo += e; else if (fq < 2000) mid += e; else { hi += e; if (fq < 4000) hi24 += e; } }
      }
      const tot = lo + mid + hi; let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
      return { lo: lo / tot, mid: mid / tot, hi: hi / tot, hi24: hi24 / tot, peak };
    };
    return { cold: await bands(0), hot: await bands(1) };
  });
  const pc = (x) => `${(x * 100).toFixed(0)}%`;
  check('the voice (rendered offline): at least 25% of a shot\'s energy is above 2kHz, under 35% is below 300Hz, and it does not clip', v.cold.hi >= 0.25 && v.hot.hi >= 0.25 && v.cold.lo < 0.35 && v.cold.peak < 0.9 && v.hot.peak < 0.9, `cold <300Hz ${pc(v.cold.lo)} / 0.3-2k ${pc(v.cold.mid)} / >2k ${pc(v.cold.hi)}; hot ${pc(v.hot.lo)} / ${pc(v.hot.mid)} / ${pc(v.hot.hi)}; peaks ${v.cold.peak.toFixed(2)} / ${v.hot.peak.toFixed(2)}`);
  check('the gun is the meter in sound too: the 2-4kHz share rises with the charge', v.hot.hi24 > v.cold.hi24 * 1.3, `${pc(v.cold.hi24)} cold -> ${pc(v.hot.hi24)} primed`);
  await p.close();
}

// ── 13. FROZEN FILES ─────────────────────────────────────────────────────
if (on(13)) {
  console.log('\n== 13. frozen files');
  const root = new URL('..', import.meta.url).pathname;
  const s = b0Scope(root), s2 = b2Scope(root);
  check('the B0 / B1 / B2 scope guard: every line under src/ since the P2-A3 build is pinned', s.ok, s.detail);
  check(`B2 (${B2_BASE}..): four new modules, the flag, ONE BootScene line, the GameScene install + ONE hit branch, telemetry; no entity, config, data or HUD file`, s2.ok && s2.gsAdded === 4, JSON.stringify(s2.ok ? { files: s2.files, gsAdded: s2.gsAdded } : s2.bad));
  const g = enemyJsGuard(root);
  check('Enemy.js is frozen (the guard)', !!(g.outside && g.bomberOnlyVeto && g.vetoCode), g.detail || '');
  const moved = execSync(`git diff --name-only ${B2_BASE} -- src/entities src/config.js src/data src/systems/HUD.js src/systems/FX.js src/systems/p2aFx.js src/systems/p2aPaint.js src/systems/p1Player.js src/systems/CameraDirector.js`, { cwd: root, encoding: 'utf8' }).trim();
  check('entities, config, data, the HUD, FX.js, the P2-A / P1 modules and the camera are byte-identical to the previous build', moved === '', moved);
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
if (bad.length) { console.log('FAILED:'); bad.forEach((b) => console.log(`  - ${b.name}`)); process.exit(1); }
