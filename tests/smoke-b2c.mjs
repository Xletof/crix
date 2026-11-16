// SMOKE: B2 CLOSURE — the tracer fix, the Super on F release with hold-to-lock
// targeting, and the candidate charge / Super visuals (`?b2=B&b2c=1`).
// Standalone; needs the dev server on :5173 and, for section 1, the B2-1
// build `2ee948c` at `--old=URL` with its own Vite cacheDir.
//
//   0  FLAGS: b2c needs a B2 variant; without b2c the F press still casts
//   1  B2-B UNCHANGED: seeded `?b2=B` fights at HEAD = 2ee948c tick for tick
//      (state, draws, events); B2_DEFAULTS identical; the candidate flag with
//      no Super input = B2-B tick for tick
//   2  TRACERS: the per-frame tracer invariant holds (0 violations) over blank
//      space after kills, cover and edges, dense combat, rotation
//   3  F TAP = the shipped cast: one cast on the release, at the nearest
//      enemy, the shipped 5-pellet fan, 600 per pellet; press alone = no cast
//   4  F HOLD: locks accumulate as the heading pivots, earlier locks stay,
//      at most one per pellet, one directed pellet per lock, one cast
//   5  EDGE CASES: key repeat, focus loss, pause, death, suppression, meter
//      emptied, a lock dying, no target, not charged
//   6  POINTER AND TOUCH: the mouse pivots a held F; a REAL touch tap and a
//      REAL touch hold-drag-release on the Super button
//   7  POWER: damage and kills of a tap cast vs a hold cast on one staged crowd
//   8  CANDIDATE VISUALS: one bolt identity, the charge thread, quarter steps,
//      no primed rim, no impact pools; targeting draws nothing red
//   9  SCOPE: the B0 / B1 / B2 scope guard (b2Super.js is B2's)
//
// usage: node tests/smoke-b2c.mjs [--old=URL] [--only=0,3]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME, FIGHT_SEG } from './diag-stuck-audit.mjs';
import { b0Scope } from './b0-scope.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const OLD = opt('old', null);
const NOW = 'http://localhost:5173/';
const ONLY = opt('only', '') ? new Set(opt('only', '').split(',').map(Number)) : null;
const on = (n) => !ONLY || ONLY.has(n);
const VIS = 'visualPilot=v2c&polish=p1&fxPilot=p2a3';
const Q_MIXED = 'encdbg=mixed&room=hangar&sector=6';
const Q_SWARM = 'encdbg=swarmTide&room=hangar&sector=3';
const Q_STAGE = 'encdbg=mixed&room=hangar&sector=1';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const firstDiff = (a, b) => { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i; return -1; };
const join = (...a) => a.filter(Boolean).join('&');
const near = (a, b, t) => Math.abs(a - b) <= t;

async function boot(flags, { base = NOW, q = Q_STAGE, seed = 4242, god = true, ctx = null } = {}) {
  const page = ctx ? await ctx.newPage() : await browser.newPage({ viewport: { width: 720, height: 1280 } });
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
    window.__adv = (n = 1, dt = 1000 / 60) => { for (let i = 0; i < n; i++) { window.__t += dt; if (window.__headless) g.headlessStep(window.__t, dt); else g.step(window.__t, dt); } };
    window.__mod = async (re) => { const u = performance.getEntriesByType('resource').map((r) => r.name).find((n) => re.test(n)); return u ? import(u) : null; };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed }); window.__adv(2);
    window.__dbg = await window.__mod(/systems\/debug\.js/);
    if (god !== null) window.__dbg.setGodMode(god);
    window.__cfg = await window.__mod(/\/src\/config\.js/);
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
    window.__stage = (x = 800, y = 900) => { window.__adv(200); window.__clear(); window.__adv(3); window.__clear(); const P = gs.player; P.x = x; P.y = y; P.body.reset(x, y); P.superCharge = 0; P.meleeCharge = 0; window.__adv(60); window.__clear(); P.superCharge = 0; P.meleeCharge = 0; };
    window.__dummy = (type, x, y, hp = 1e6) => { const e = gs.spawnEnemyAt(type, x, y); e.hp = e.hpMax = hp; e.cfg = { ...e.cfg, speed: 0 }; return e; };
    window.__ring = (n, r, a0 = -Math.PI / 2, step = 0.6) => { const P = gs.player; return Array.from({ length: n }, (_, i) => window.__dummy('grunt', P.x + Math.cos(a0 + i * step) * r, P.y + Math.sin(a0 + i * step) * r)); };
    window.__keyF = (down) => gs.input.keyboard.emit(down ? 'keydown-F' : 'keyup-F', { repeat: false });
    // pellets the next blast fires: angle and damage of each
    window.__pellets = [];
    const grp = gs.playerSuperBullets, f0 = grp.fire;
    grp.fire = function (x, y, a, sp, dmg, ...r) { const b = f0.call(this, x, y, a, sp, dmg, ...r); window.__pellets.push({ a, dmg }); return b; };
    window.__trace = ({ seed, ticks, seg, hold, superTaps = [], b2c = false }) => {
      const K = gs.keys, cam = gs.cameras.main, kb = gs.input.keyboard;
      window.__seed(seed); window.__draws = 0; window.__evN = 0;
      const hashes = []; const f = (v) => (Math.round(v * 1000) / 1000).toString();
      for (let i = 0; i < ticks; i++) {
        const P = gs.player;
        const cur = seg.find(([a, bb]) => i >= a && i < bb)[2];
        K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
        gs.cursors.space.isDown = hold.some(([a, bb]) => i >= a && i < bb);
        window.__adv(1);
        const w = gs._b2?.state;
        let s2 = `${i}|${f(P.x)},${f(P.y)},${f(P.hp)},${P.shieldHp},${P.alive},${f(P.superCharge)},${f(P.meleeCharge)},${w ? `${w.mag},${f(w.cool)},${f(w.reloadLeft)}` : '-'}|${f(cam.scrollX)},${f(cam.scrollY)}|${f(gs.time.timeScale)}|k${gs.runKills}|`;
        for (const e of gs.enemies.getChildren()) if (e.active) s2 += `${e.enemyType}:${f(e.x)},${f(e.y)},${Math.round(e.hp)},${e.state};`;
        for (const g2 of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets]) for (const bb of g2?.getChildren?.() || []) if (bb.active) s2 += `b${f(bb.x)},${f(bb.y)},${bb.damage};`;
        s2 += `|d${window.__draws}|e${window.__evN}`;
        hashes.push(fnv(s2));
      }
      K.A.isDown = K.D.isDown = K.W.isDown = K.S.isDown = false; gs.cursors.space.isDown = false;
      return { hashes, draws: window.__draws, kills: gs.runKills, shots: gs._b2?.stats.shots ?? 0 };
    };
  }, { seed, god });
  return page;
}
const HOLD = [[60, 400], [460, 900], [960, 1500]];

// ── 0. FLAGS ──────────────────────────────────────────────────────────────
if (on(0)) {
  console.log('\n== 0. flags');
  for (const [fl, want] of [['b2c=1', false], [join(VIS, 'b2=B'), false], [join(VIS, 'b2=B', 'b2c=1'), true], [join(VIS, 'b2=A', 'b2c=1'), true], [join(VIS, 'b2=B', 'b2c=0'), false]]) {
    const p = await boot(fl);
    const r = await p.evaluate(() => { const gs = window.__gs; return { cand: window.__dbg.isB2Candidate(), b2: !!gs._b2, sup: !!gs._b2?.superInput }; });
    let press = null;
    if (r.b2) press = await p.evaluate(() => { const gs = window.__gs; window.__stage(); window.__ring(1, 300); gs.player.superCharge = 4; let n = 0; gs.events.on('player-fire-super', () => { n++; }); window.__keyF(true); window.__adv(3); const a = n; window.__keyF(false); window.__adv(3); return [a, n]; });
    await p.close();
    check(`"${fl}": candidate ${want ? 'ON' : 'off'}${press ? `; F press casts ${press[0]}, after the release ${press[1]}` : ''}`,
      r.cand === want && r.sup === want && (!press || (want ? press[0] === 0 && press[1] === 1 : press[0] === 1 && press[1] === 1)), JSON.stringify({ ...r, press }));
  }
}

// ── 1. B2-B UNCHANGED ────────────────────────────────────────────────────
if (on(1)) {
  console.log('\n== 1. B2-B unchanged');
  const run = async (flags, base, q, o = {}) => { const p = await boot(flags, { base, q, god: o.god ?? true }); const r = await p.evaluate((x) => window.__trace(x), { seed: 9071, ticks: 1500, seg: FIGHT_SEG, hold: HOLD }); const k = await p.evaluate(async () => (await window.__mod(/systems\/b2Flagship\.js/)).B2_DEFAULTS); await p.close(); return { ...r, k }; };
  if (OLD) {
    for (const [label, q, god] of [['MIXED s6', Q_MIXED, true], ['SWARM TIDE', Q_SWARM, true], ['MIXED s6, god mode off', Q_MIXED, false]]) {
      const a = await run(join(VIS, 'b2=B'), OLD, q, { god }), b = await run(join(VIS, 'b2=B'), NOW, q, { god });
      const d = firstDiff(a.hashes, b.hashes);
      check(`${label}: ?b2=B held-stream fight, 1500 ticks — HEAD = 2ee948c tick for tick (state, ammo, meters, every enemy and bolt, draws, events)`, d < 0 && a.shots > 100, d < 0 ? `${b.shots} rounds, ${b.kills} kills, ${b.draws} draws` : `first divergent tick ${d}`);
      if (label === 'MIXED s6') check('B2_DEFAULTS (every weapon, economy and impact value) identical to 2ee948c', JSON.stringify(a.k) === JSON.stringify(b.k), JSON.stringify(b.k));
    }
  } else console.log('   (2ee948c comparison skipped: no --old=URL)');
  const a = await run(join(VIS, 'b2=B'), NOW, Q_MIXED), b = await run(join(VIS, 'b2=B', 'b2c=1'), NOW, Q_MIXED);
  const d = firstDiff(a.hashes, b.hashes);
  check('the candidate flag with no Super input = B2-B tick for tick (the stream, meters, enemies, draws, events)', d < 0, d < 0 ? `${b.shots} rounds, ${b.kills} kills` : `first divergent tick ${d}`);
}

// ── 2. TRACERS ───────────────────────────────────────────────────────────
if (on(2)) {
  console.log('\n== 2. the tracer invariant');
  for (const fl of [join(VIS, 'b2=B'), join(VIS, 'b2=B', 'b2c=1')]) {
    const p = await boot(join(fl, 'b2range=1'), { q: 'room=hangar' });
    const r = await p.evaluate(() => {
      const gs = window.__gs, R = gs._b2.range, inv = gs._b2.stats.feel.inv, fs = window.game.scene.getScene('HUD').fireStick;
      const stick = (a) => { if (a == null) { fs.active = false; fs.vec = { x: 0, y: 0, force: 0, angle: 0 }; } else { fs.active = true; fs.vec = { x: Math.cos(a), y: Math.sin(a), force: 1, angle: a }; } };
      const place = (x, y) => { const P = gs.player; P.x = x; P.y = y; P.body.reset(x, y); };
      window.__adv(120);
      place(800, 800); R.spawn('SQUAD'); window.__adv(40); gs.cursors.space.isDown = true;
      for (let i = 0; i < 400 && gs.enemies.getChildren().some((e) => e.alive); i++) window.__adv(1);
      gs.cursors.space.isDown = false;
      for (let k = 0; k < 8; k++) { stick(k * Math.PI / 4 + 0.3); window.__adv(30); stick(null); window.__adv(10); }
      for (let i = 0; i < 240; i++) { stick(i * Math.PI / 30); window.__adv(1); } stick(null);
      const rc = (gs.losRects || []).find((q) => q.width < 300) || gs.losRects[0];
      place(rc.x - 160, rc.centerY); window.__adv(5); stick(0); window.__adv(60); stick(null);
      place(140, 800); window.__adv(5); stick(Math.PI); window.__adv(60); stick(null);
      place(800, 900); R.spawn('HORDE'); R.spawn('HORDE'); window.__adv(30); gs.cursors.space.isDown = true;
      for (let i = 0; i < 500 && gs.enemies.getChildren().some((e) => e.alive); i++) window.__adv(1);
      gs.cursors.space.isDown = false; window.__adv(60);
      return { checks: inv.checks, bad: inv.bad, maxOff: inv.maxOff, maxEndErr: inv.maxEndErr, sample: inv.samples[0] || null, rounds: gs._b2.stats.feel.rounds };
    });
    await p.close();
    check(`${/b2c/.test(fl) ? 'candidate' : 'B2-B'}: ${r.rounds} rounds — after kills, rotating, into cover and the edge, in a double HORDE: every visible streak on its own path and ending where its round stopped (0 violations in ${r.checks} checks)`, r.bad === 0 && r.checks > 2000, JSON.stringify(r));
  }
}

// ── 3. F TAP ─────────────────────────────────────────────────────────────
if (on(3)) {
  console.log('\n== 3. F tap = the shipped cast');
  const p = await boot(join(VIS, 'b2=B', 'b2c=1'));
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, out = {};
    window.__stage();
    const es = window.__ring(3, 300, -Math.PI / 2, 0.9);
    const near0 = es[0]; near0.x = P.x + 200; near0.y = P.y; near0.body.reset(near0.x, near0.y);
    P.superCharge = 4; let casts = 0; gs.events.on('player-fire-super', () => { casts++; });
    window.__keyF(true); window.__adv(1); out.onPress = casts;
    window.__adv(4); out.beforeRelease = casts; out.phase = gs._b2.superInput.state.phase;
    window.__pellets.length = 0;
    window.__keyF(false); window.__adv(12);
    out.casts = casts; out.pellets = window.__pellets.slice(); out.target = Math.atan2(near0.y - P.y, near0.x - P.x);
    out.step = window.__cfg.PLAYER.superSpreadDeg * Math.PI / 180 / 4; out.dmg = window.__cfg.PLAYER.superDamage * P.dmgMult;
    out.stats = { ...gs._b2.superInput.stats };
    // press alone, never released: no cast
    P.superCharge = 4; window.__keyF(true); window.__adv(120); out.held = { casts, phase: gs._b2.superInput.state.phase };
    window.__keyF(false); window.__adv(5); out.afterLong = casts;
    return out;
  });
  check('F press: no cast; targeting armed', r.onPress === 0 && r.beforeRelease === 0 && r.phase === 'targeting', JSON.stringify({ onPress: r.onPress, phase: r.phase }));
  const fan = r.pellets.length === 5 && r.pellets.every((q, i) => near(q.a, r.target + (i - 2) * r.step, 1e-6)) && r.pellets.every((q) => q.dmg === r.dmg);
  check('F release inside 160ms: exactly one cast, the shipped 5-pellet 30-degree fan centred on the nearest enemy, 600 per pellet, no directed pellet', r.casts === 1 && fan && r.stats.taps === 1 && r.stats.directed === 0, JSON.stringify({ casts: r.casts, pellets: r.pellets.map((q) => +(q.a - r.target).toFixed(4)), dmg: r.pellets.map((q) => q.dmg) }));
  check('a 2s hold never casts until the release; the release casts exactly once', r.held.casts === 1 && r.held.phase === 'targeting' && r.afterLong === 2, JSON.stringify(r.held));
  await p.close();
}

// ── 4. F HOLD ────────────────────────────────────────────────────────────
if (on(4)) {
  console.log('\n== 4. F hold: pivot, lock, release');
  const p = await boot(join(VIS, 'b2=B', 'b2c=1'));
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, S = gs._b2.superInput, out = {};
    window.__stage();
    // seven targets on an arc above the hero, 300px out, 28 degrees apart; the nearest is to the right
    const es = window.__ring(7, 320, -Math.PI * 0.95, 0.14 * Math.PI);
    const n0 = window.__dummy('grunt', P.x + 230, P.y);
    P.superCharge = 4; let casts = 0; gs.events.on('player-fire-super', () => { casts++; });
    window.__keyF(true); window.__adv(2);
    out.initial = S.state.locks.slice();
    out.initialIsNearest = out.initial.length === 1 && out.initial[0] === n0;
    // pivot by the movement direction across the arc, right to left, over ~1.4s
    const trail = [];
    for (let i = 0; i <= 84; i++) {
      const a = -Math.PI * 0.05 - (i / 84) * Math.PI * 0.95;
      P.setMoveInput({ x: Math.cos(a), y: Math.sin(a), force: 0.01 });   // a crawl (3.8px/s) sets the heading and keeps the hero nearly in place
      window.__adv(1);
      trail.push(S.state.locks.length);
    }
    out.trail = trail.filter((v, i, a) => i === 0 || v !== a[i - 1]);
    out.locks = S.state.locks.length; out.keepsFirst = S.state.locks[0] === n0;
    out.unique = new Set(S.state.locks).size === S.state.locks.length;
    out.lockAngles = S.state.locks.map((e) => Math.atan2(e.y - P.y, e.x - P.x));
    out.heading = S.state.heading;
    window.__pellets.length = 0;
    P.setMoveInput({ x: 0, y: 0, force: 0 });
    window.__keyF(false); window.__adv(12);
    out.casts = casts; out.pellets = window.__pellets.slice(); out.dmg = window.__cfg.PLAYER.superDamage * P.dmgMult;
    out.stats = { ...S.stats };
    return out;
  });
  check('keydown locks the nearest eligible enemy at once', r.initialIsNearest, JSON.stringify({ n: r.initial.length }));
  check('pivoting across seven targets: locks accumulate one at a time, earlier ones stay, capped at five (one per pellet), never the same target twice', r.locks === 5 && r.keepsFirst && r.unique && r.trail.join() === '1,2,3,4,5', JSON.stringify({ trail: r.trail, locks: r.locks }));
  const directed = r.lockAngles.slice(1).every((a) => r.pellets.some((q) => Math.abs(Math.atan2(Math.sin(q.a - a), Math.cos(q.a - a))) < 1e-6));
  check('release: exactly one cast of five pellets at 600 each; every extra lock got its own pellet straight at it', r.casts === 1 && r.pellets.length === 5 && r.pellets.every((q) => q.dmg === r.dmg) && directed && r.stats.directed === 5 && r.stats.holds === 1, JSON.stringify({ casts: r.casts, directed: r.stats.directed, pellets: r.pellets.map((q) => +q.a.toFixed(3)), locks: r.lockAngles.map((a) => +a.toFixed(3)) }));
  await p.close();
}

// ── 5. EDGE CASES ────────────────────────────────────────────────────────
if (on(5)) {
  console.log('\n== 5. edge cases');
  const p = await boot(join(VIS, 'b2=B', 'b2c=1'));
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, S = gs._b2.superInput, kb = gs.input.keyboard, out = {};
    let casts = 0; gs.events.on('player-fire-super', () => { casts++; });
    const reset = () => { window.__stage(); window.__ring(3, 300, -Math.PI / 2, 0.5); P.superCharge = 4; casts = 0; };
    const res = () => ({ casts, phase: S.state.phase, charge: P.superCharge });
    // key repeat: a held key's repeats do not re-enter or cast
    reset(); window.__keyF(true); for (let i = 0; i < 5; i++) { kb.emit('keydown-F', { repeat: true }); window.__adv(5); } out.repeat = { ...res(), ignored: S.stats.ignoredRepeat }; window.__keyF(false); window.__adv(3); out.repeatRelease = res();
    // focus loss mid-hold: cancelled, the later keyup casts nothing
    reset(); window.__keyF(true); window.__adv(20); window.dispatchEvent(new Event('blur')); window.__adv(2); window.__keyF(false); window.__adv(5); out.blur = res();
    // pause mid-hold
    reset(); window.__keyF(true); window.__adv(20); gs.events.emit('pause'); window.__adv(2); window.__keyF(false); window.__adv(5); out.pause = res();
    // suppressed mid-hold
    reset(); window.__keyF(true); window.__adv(20); P.suppress(4000); window.__adv(2); window.__keyF(false); window.__adv(5); out.suppressed = res(); P.clearSuppression();
    // meter emptied mid-hold (what a respawn does)
    reset(); window.__keyF(true); window.__adv(20); P.superCharge = 0; window.__adv(2); window.__keyF(false); window.__adv(5); out.meter = res();
    // death mid-hold
    reset(); window.__dbg.setGodMode(false); window.__keyF(true); window.__adv(20); P.damage(99999); window.__adv(2); window.__keyF(false); window.__adv(5); out.dead = res(); window.__dbg.setGodMode(true);
    for (let i = 0; i < 200 && !P.alive; i++) window.__adv(5);
    // a locked target dies before the release: it is dropped, the cast still happens once
    reset(); const es = gs.enemies.getChildren().filter((e) => e.alive); window.__keyF(true); window.__adv(3); const locked = S.state.locks[0]; locked.damage(1e7, null); window.__adv(2); out.lockDied = { locks: S.state.locks.length, dropped: !S.state.locks.includes(locked) }; window.__adv(20); window.__keyF(false); window.__adv(10); out.lockDiedCast = res();
    // nothing in reach: a tap still casts once, along the facing
    window.__stage(); P.superCharge = 4; casts = 0; window.__pellets.length = 0; window.__keyF(true); window.__adv(2); window.__keyF(false); window.__adv(10); out.empty = { ...res(), pellets: window.__pellets.length, facing: P.facing };
    // not charged: F does nothing at all
    window.__stage(); window.__ring(1, 300); P.superCharge = 2; casts = 0; window.__keyF(true); window.__adv(20); out.notReady = res(); window.__keyF(false); window.__adv(5); out.notReadyRelease = res();
    out.cancels = { ...S.stats.cancels };
    return out;
  });
  check('key repeat: ignored while held; the release casts once', r.repeat.casts === 0 && r.repeat.phase === 'targeting' && r.repeat.ignored === 5 && r.repeatRelease.casts === 1, JSON.stringify([r.repeat, r.repeatRelease]));
  for (const k of ['blur', 'pause', 'suppressed', 'meter', 'dead']) check(`${k} mid-hold: cancelled, the later keyup casts nothing, nothing stays armed`, r[k].casts === 0 && r[k].phase === 'idle', JSON.stringify(r[k]));
  check('cancel reasons are recorded (focus, pause, suppressed, meter, dead)', ['focus', 'pause', 'suppressed', 'meter', 'dead'].every((k) => r.cancels[k] >= 1), JSON.stringify(r.cancels));
  check('a locked target that dies is dropped; the release still casts exactly once', r.lockDied.dropped && r.lockDiedCast.casts === 1, JSON.stringify([r.lockDied, r.lockDiedCast]));
  check('nothing in reach: a tap casts once, five pellets', r.empty.casts === 1 && r.empty.pellets === 5, JSON.stringify(r.empty));
  check('not charged: press and release do nothing', r.notReady.casts === 0 && r.notReady.phase === 'idle' && r.notReadyRelease.casts === 0 && r.notReadyRelease.charge === 2, JSON.stringify([r.notReady, r.notReadyRelease]));
  await p.close();
}

// ── 6. POINTER AND TOUCH ─────────────────────────────────────────────────
if (on(6)) {
  console.log('\n== 6. pointer and touch');
  const p = await boot(join(VIS, 'b2=B', 'b2c=1'));
  // the mouse pivots a held F (real key and mouse events)
  const geo = await p.evaluate(() => { const gs = window.__gs, P = gs.player; window.__stage(); window.__dummy('grunt', P.x + 230, P.y); window.__dummy('grunt', P.x, P.y - 320); P.superCharge = 4; window.__adv(5);
    const c = gs.cameras.main, r = window.game.canvas.getBoundingClientRect(), k = r.width / 720;
    const w2s = (x, y) => ({ x: r.left + (x - c.scrollX) * k, y: r.top + (y - c.scrollY + c.y) * k });
    return { start: w2s(P.x + 100, P.y + 100), up: w2s(P.x, P.y - 320) }; });
  await p.mouse.move(geo.start.x, geo.start.y);
  await p.keyboard.down('f'); await p.evaluate(() => window.__adv(3));
  const h0 = await p.evaluate(() => ({ h: window.__gs._b2.superInput.state.heading, n: window.__gs._b2.superInput.state.locks.length }));
  await p.mouse.move(geo.up.x, geo.up.y, { steps: 5 }); await p.evaluate(() => window.__adv(20));
  const h1 = await p.evaluate(() => ({ h: window.__gs._b2.superInput.state.heading, n: window.__gs._b2.superInput.state.locks.length, on: window.__gs._b2.superInput.state.mouseOn }));
  await p.keyboard.up('f'); await p.evaluate(() => window.__adv(10));
  const c1 = await p.evaluate(() => window.__gs._b2.superInput.stats.casts);
  check('a held F follows the mouse once it moves: the heading turns from the nearest (right) to the pointer (up) and the second enemy is locked; the real keyup casts once', near(h0.h, 0, 0.05) && near(h1.h, -Math.PI / 2, 0.08) && h1.on && h0.n === 1 && h1.n === 2 && c1 === 1, JSON.stringify({ h0, h1, casts: c1 }));
  await p.close();
  const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const pt = await boot(join(VIS, 'b2=B', 'b2c=1'), { ctx });
  const g2 = await pt.evaluate(() => { const gs = window.__gs, P = gs.player; window.__stage(); window.__dummy('grunt', P.x + 230, P.y); window.__dummy('grunt', P.x - 300, P.y); P.superCharge = 4; window.__adv(5);
    const hud = window.game.scene.getScene('HUD'), r = window.game.canvas.getBoundingClientRect(), k = r.width / 720;
    window.__casts = 0; window.__castA = []; gs.events.on('player-fire-super', (a) => { window.__casts++; window.__castA.push(a); });
    return { x: r.left + hud.superButton.x * k, y: r.top + hud.superButton.y * k }; });
  const cdp = await ctx.newCDPSession(pt);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', g2.x, g2.y); await pt.evaluate(() => window.__adv(2)); await touch('touchEnd'); await pt.evaluate(() => window.__adv(12));
  const t1 = await pt.evaluate(() => ({ casts: window.__casts, a: window.__castA[0], phase: window.__gs._b2.superInput.state.phase }));
  check('a REAL touch tap on the Super button: one cast, at the nearest enemy (right)', t1.casts === 1 && near(t1.a, 0, 0.05) && t1.phase === 'idle', JSON.stringify(t1));
  await pt.evaluate(() => { window.__gs.player.superCharge = 4; window.__adv(3); });
  await touch('touchStart', g2.x, g2.y); await pt.evaluate(() => window.__adv(4));
  for (let i = 1; i <= 6; i++) { await touch('touchMove', g2.x - i * 12, g2.y); await pt.evaluate(() => window.__adv(4)); }
  const mid = await pt.evaluate(() => ({ casts: window.__casts, phase: window.__gs._b2.superInput.state.phase, h: window.__gs._b2.superInput.state.heading, locks: window.__gs._b2.superInput.state.locks.length, aiming: window.__gs.player.superAiming }));
  await touch('touchEnd'); await pt.evaluate(() => window.__adv(12));
  const t2 = await pt.evaluate(() => ({ casts: window.__casts, a: window.__castA[1] }));
  check('a REAL touch hold-drag on the Super button: targeting while held (heading follows the drag left, the left enemy locked, no red cone, no cast), one cast on the release along the drag', mid.casts === 1 && mid.phase === 'targeting' && near(Math.abs(mid.h), Math.PI, 0.1) && mid.locks === 2 && !mid.aiming && t2.casts === 2 && near(Math.abs(t2.a), Math.PI, 0.1), JSON.stringify({ mid, t2 }));
  await pt.close(); await ctx.close();
}

// ── 7. POWER ─────────────────────────────────────────────────────────────
if (on(7)) {
  console.log('\n== 7. power: tap vs hold on one staged crowd');
  const cast = async (hold) => {
    const p = await boot(join(VIS, 'b2=B', 'b2c=1'));
    const r = await p.evaluate((hold) => {
      const gs = window.__gs, P = gs.player, S = gs._b2.superInput;
      window.__stage();
      // five Riflemen (real hp) spread over 120 degrees, 300px out; one Gunner nearer, ahead
      const es = window.__ring(5, 300, -Math.PI * 0.83, Math.PI / 6).map((e) => { e.hp = e.hpMax = 346; return e; });
      const lead = window.__dummy('shooter', P.x, P.y - 200, 486);
      const all = [...es, lead]; const hp0 = all.reduce((a, e) => a + e.hp, 0);
      P.superCharge = 4; window.__keyF(true); window.__adv(2);
      if (hold) for (let i = 0; i <= 60; i++) { const a = -Math.PI * 0.83 + (i / 60) * (Math.PI * 4 / 6); P.setMoveInput({ x: Math.cos(a), y: Math.sin(a), force: 0.01 }); window.__adv(1); }
      P.setMoveInput({ x: 0, y: 0, force: 0 });
      const locks = S.state.locks.length;
      window.__keyF(false); window.__adv(60);
      const hp1 = all.reduce((a, e) => a + Math.max(0, e.alive ? e.hp : 0), 0);
      return { locks, dmg: hp0 - hp1, kills: all.filter((e) => !e.alive).length, hits: S.stats.impacts };
    }, hold);
    await p.close(); return r;
  };
  const t = await cast(false), h = await cast(true);
  console.log(`   tap : locks ${t.locks}, damage ${t.dmg}, kills ${t.kills}/6`);
  console.log(`   hold: locks ${h.locks}, damage ${h.dmg}, kills ${h.kills}/6, locked targets hit by their pellet ${h.hits}`);
  check('measured and reported: per-pellet damage is unchanged (5 x 600 available in both); a hold redistributes the same five pellets over its locks', h.locks >= 3 && t.locks === 1, `tap ${t.dmg} dmg / ${t.kills} kills, hold ${h.dmg} dmg / ${h.kills} kills`);
}

// ── 8. CANDIDATE VISUALS ─────────────────────────────────────────────────
if (on(8)) {
  console.log('\n== 8. candidate visuals');
  const look = async (flags) => {
    const p = await boot(flags);
    const r = await p.evaluate(() => {
      const gs = window.__gs, P = gs.player, out = { tints: new Set(), threads: 0, halos: 0, spills: 0, steps: 0, rimShown: 0, red: 0 };
      window.__headless = false;
      window.__stage(); window.__dummy('shooter', P.x + 320, P.y);
      gs.cursors.space.isDown = true;
      for (let i = 0; i < 300; i++) {
        P.superCharge = Math.min(3.9, i / 75);
        window.__adv(1);
        for (const o of gs.children.list) {
          if (!o.visible || !o.texture) continue;
          const k = o.texture.key;
          if (k === 'b2-body' && o.blendMode === 0 && o.tintTopLeft === 0xa9c4ee) out.threads++;
          else if (k === 'b2-body') out.tints.add(o.tintTopLeft);
          if (k === 'b2-halo' && o.depth > 10 && o.depth < 5000 && o !== gs._b2) out.halos++;
          if (k === 'b2-spill' && o.depth === 5 && o.scaleX < 1) out.spills++;
          if (k === 'b2-ring') { if (o.tintTopLeft === 0x9fefff) out.rimShown++; else out.steps++; }
        }
      }
      gs.cursors.space.isDown = false;
      out.stepEvents = gs._b2.stats.feel.steps || 0;
      // targeting draws: every colour the Super's graphics uses
      window.__clear(); window.__ring(4, 300, -Math.PI / 2, 0.5); P.superCharge = 4; window.__keyF?.(true); window.__adv(30);
      const S = gs._b2.superInput;
      if (S) { const cmds = gs.children.list.find((o) => o.type === 'Graphics' && o.depth === 8800)?.commandBuffer || []; const cols = cmds.filter((v) => typeof v === 'number' && v > 0xffff && v <= 0xffffff); out.red = cols.filter((c) => ((c >> 16) & 255) > 180 && ((c >> 8) & 255) < 90 && (c & 255) < 90).length; out.cols = [...new Set(cols)].map((c) => c.toString(16)).slice(0, 8); }
      window.__keyF?.(false); window.__adv(5);
      out.tints = [...out.tints].map((c) => c.toString(16));
      return out;
    });
    await p.close(); return r;
  };
  const c = await look(join(VIS, 'b2=B', 'b2c=1')), b = await look(join(VIS, 'b2=B'));
  check('candidate: the bolt keeps ONE colour at every charge (B2-B ramps through several)', c.tints.length === 1 && b.tints.length >= 4, `candidate ${c.tints.join(',')}; B2-B ${b.tints.length} tints`);
  check('candidate: the charge thread is drawn in rounds fired with charge (and never in B2-B)', c.threads > 50 && b.threads === 0, `thread frames ${c.threads} / ${b.threads}`);
  check('candidate: three quarter-step rings while the meter fills to 3.9 (no primed rim; full belongs to the P1-B ring)', c.stepEvents === 3 && c.rimShown === 0, JSON.stringify({ steps: c.stepEvents, rim: c.rimShown }));
  check('candidate: no streak halos and no impact pools ("fireworks")', c.halos === 0, `halo frames candidate ${c.halos}, B2-B ${b.halos}`);
  check('targeting graphics use no red (ice-white / violet / dark keyline only)', c.red === 0 && c.cols && c.cols.length > 0, JSON.stringify(c.cols));
}

// ── 9. SCOPE ─────────────────────────────────────────────────────────────
if (on(9)) {
  console.log('\n== 9. scope');
  const s = b0Scope(new URL('..', import.meta.url).pathname);
  check('the B0 / B1 / B2 scope guard (b2Super.js is one of B2\'s modules; GameScene still +4 lines; one BootScene line)', s.ok, s.detail);
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
if (bad.length) { console.log('FAILED:'); bad.forEach((x) => console.log(`  - ${x.name}`)); process.exit(1); }
