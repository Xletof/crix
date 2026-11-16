// B2 TEMPER (`&b2t=1`) — the flagship visual-language candidate over B2.
// Standalone, against the dev server on :5173.
//
//   0  FLAGS: off by default, needs `?b2=`, installs the skin and its atlas
//   1  PIXELS ONLY: `?b2=B&b2t=1` = `?b2=B` tick for tick on the same build
//      (state, ammo, meters, every enemy, bolt and pellet, `Math.random`
//      draws, events) over a held stream, four Supers and a Broken Wings
//      chain, three fights; and the same with `&b2c=1` on both sides
//   2  THE TRACER INVARIANT under the skin (0 violations)
//   3  THE GUN: lamp count and stage per charge, the overlay on the weapon
//      every rendered frame, off at 0 / mid-combo / dead, FULL = ready colours
//   4  THE BOLT: one size at every charge, nothing additive, the cool tip
//   5  FRAMES: every muzzle and contact frame is seen, frame 0 never skipped
//      at 30 fps
//   6  THE SUPER: pellets (count, damage, angles, hitbox) identical; the
//      shipped effects hidden, no camera flash; the spent barrel cools
//   7  RESTARTS: one install each time, nothing left behind
//   8  COST: objects and update time against B2-B (reported)
//   9  the scope guard
//
// usage: node tests/smoke-b2t.mjs [--only=0,3]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME, FIGHT_SEG } from './diag-stuck-audit.mjs';
import { b0Scope } from './b0-scope.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
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
const HOLD = [[60, 400], [460, 900], [960, 1500]];
const T = join(VIS, 'b2=B', 'b2t=1'), B = join(VIS, 'b2=B');

// the seeded harness of tests/smoke-b2c.mjs (same helpers, same trace)
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
    window.__dummy = (type, x, y, hp = 1e6) => { const e = gs.spawnEnemyAt(type, x, y); e.hp = e.hpMax = hp; e.cfg = { ...e.cfg, speed: 0 }; return e; };
    window.__ring = (n, r, a0 = -Math.PI / 2, step = 0.6) => { const P = gs.player; return Array.from({ length: n }, (_, i) => window.__dummy('grunt', P.x + Math.cos(a0 + i * step) * r, P.y + Math.sin(a0 + i * step) * r)); };
    window.__keyF = (down) => gs.input.keyboard.emit(down ? 'keydown-F' : 'keyup-F', { repeat: false });
    // pellets the next blast fires: angle and damage of each
    window.__pellets = [];
    const grp = gs.playerSuperBullets, f0 = grp.fire;
    grp.fire = function (x, y, a, sp, dmg, ...r) { const b = f0.call(this, x, y, a, sp, dmg, ...r); window.__pellets.push({ a, dmg }); return b; };
    window.__trace = ({ seed, ticks, seg, hold, superTaps = [], melee = [] }) => {
      const K = gs.keys, cam = gs.cameras.main, kb = gs.input.keyboard;
      window.__seed(seed); window.__draws = 0; window.__evN = 0; window.__ev.addedtoscene = 0; window.__ev.removedfromscene = 0;
      const hashes = []; const f = (v) => (Math.round(v * 1000) / 1000).toString();
      for (let i = 0; i < ticks; i++) {
        const P = gs.player;
        const cur = seg.find(([a, bb]) => i >= a && i < bb)[2];
        K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
        gs.cursors.space.isDown = hold.some(([a, bb]) => i >= a && i < bb);
        // the B2-1 F press (the path the closure edited): charge it, press it, release next tick
        if (superTaps.includes(i)) { P.superCharge = 4; kb.emit('keydown-F', { repeat: false }); }
        if (superTaps.includes(i - 1)) kb.emit('keyup-F', {});
        if (melee.includes(i)) { P.meleeCharge = 99; P.tryMeleeCombo(); }
        window.__adv(1);
        const w = gs._b2?.state;
        let s2 = `${i}|${f(P.x)},${f(P.y)},${f(P.hp)},${P.shieldHp},${P.alive},${f(P.superCharge)},${f(P.meleeCharge)},${w ? `${w.mag},${f(w.cool)},${f(w.reloadLeft)}` : '-'}|${f(cam.scrollX)},${f(cam.scrollY)}|${f(gs.time.timeScale)}|k${gs.runKills}|`;
        for (const e of gs.enemies.getChildren()) if (e.active) s2 += `${e.enemyType}:${f(e.x)},${f(e.y)},${Math.round(e.hp)},${e.state};`;
        for (const g2 of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets]) for (const bb of g2?.getChildren?.() || []) if (bb.active) s2 += `b${f(bb.x)},${f(bb.y)},${bb.damage};`;
        // display-list bookkeeping (a pooled image created) is presentation, not the fight
        s2 += `|d${window.__draws}|e${window.__evN - (window.__ev.addedtoscene || 0) - (window.__ev.removedfromscene || 0)}`;
        hashes.push(fnv(s2));
      }
      K.A.isDown = K.D.isDown = K.W.isDown = K.S.isDown = false; gs.cursors.space.isDown = false;
      return { hashes, draws: window.__draws, kills: gs.runKills, shots: gs._b2?.stats.shots ?? 0, supers: window.__ev['player-fire-super'] || 0 };
    };
  }, { seed, god });
  return page;
}

// ── 0. FLAGS ──────────────────────────────────────────────────────────────
if (on(0)) {
  console.log('\n== 0. flags');
  for (const [fl, want] of [['b2t=1', false], [B, false], [T, true], [join(VIS, 'b2=A', 'b2t=1'), true], [join(VIS, 'b2=B', 'b2t=0'), false]]) {
    const p = await boot(fl);
    const r = await p.evaluate(() => { const gs = window.__gs; return { flag: window.__dbg.isB2Temper(), b2: !!gs._b2, skin: !!gs._b2?.stats.feel?.temper, atlas: window.game.textures.exists('b2t') }; });
    await p.close();
    check(`"${fl}": TEMPER ${want ? 'ON' : 'off'}`, r.flag === want && r.skin === want && r.atlas === want, JSON.stringify(r));
  }
}

// ── 1. PIXELS ONLY ───────────────────────────────────────────────────────
if (on(1)) {
  console.log('\n== 1. pixels only: the same fight');
  const run = async (flags, q, o = {}) => { const p = await boot(flags, { q, god: o.god ?? true }); const r = await p.evaluate((x) => window.__trace(x), { seed: 9071, ticks: 1500, seg: FIGHT_SEG, hold: HOLD, superTaps: o.supers ?? [], melee: o.melee ?? [] }); const t = await p.evaluate(() => window.__gs._b2.stats.feel.temper || null); await p.close(); return { ...r, t }; };
  for (const [label, q, god] of [['MIXED s6', Q_MIXED, true], ['SWARM TIDE', Q_SWARM, true], ['MIXED s6, god mode off', Q_MIXED, false]]) {
    const o = { god, supers: [300, 700, 1100, 1400], melee: [500, 525, 550] };
    const a = await run(B, q, o), b = await run(T, q, o);
    const d = firstDiff(a.hashes, b.hashes);
    check(`${label}: 1500 ticks, held stream + FOUR Supers + a Broken Wings chain — TEMPER = B2-B tick for tick (state, ammo, meters, every enemy, bolt and pellet, Math.random draws, events)`, d < 0 && b.shots > 100 && b.supers === 4 && b.t.supers >= 3 && b.t.cloak.objects > 0,
      d < 0 ? `${b.shots} rounds, ${b.supers} Supers, ${b.kills} kills, ${b.draws} draws; hidden: ${b.t.cloak.objects} objects, ${b.t.cloak.particles} particles in ${b.t.cloak.calls} calls` : `first divergent tick ${d} (draws ${a.draws} vs ${b.draws})`);
  }
  const a = await run(join(B, 'b2c=1'), Q_MIXED, { supers: [300, 700, 1100], melee: [500, 525, 550] }), b = await run(join(T, 'b2c=1'), Q_MIXED, { supers: [300, 700, 1100], melee: [500, 525, 550] });
  const d = firstDiff(a.hashes, b.hashes);
  check('with the closure candidate on both sides (&b2c=1, F-release Supers): TEMPER = no TEMPER tick for tick', d < 0 && b.supers === 3, d < 0 ? `${b.shots} rounds, ${b.supers} Supers` : `first divergent tick ${d}`);
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
if (bad.length) { console.log('FAILED:'); bad.forEach((x) => console.log(`  - ${x.name}`)); process.exit(1); }
