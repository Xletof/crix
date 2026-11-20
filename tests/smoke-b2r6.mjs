// B2-R6 REACTOR THUNDER (`&b2a=B2RT`: the Super discharge rendered once as one event, systems/b2Thunder.js;
// played by kitR6 in systems/b2Audio.js). Over B2-R4 `&b2r=4&b2iso=1`; the HUMAN-approved R5 aura
// (`&b2aura=1`) unchanged. Controls: `&b2a=B2HC` (R5 Heavy Cannon), `&b2a=B2S` (R4). Standalone,
// against the dev server on :5173; section 4 also needs the d3ecad6 build: --old=http://localhost:5174/
//
//   0  FLAGS: the four conditions, every older audio flag, b2aura with B2RT
//   1  GAMEPLAY PARITY: B2RT (with and without the aura) = B2-B tick for tick (silent harness)
//   2  IN THE GAME (live audio): the rush only on the committed cast, never on the held-F aim; one
//      event per real blast; none on a cancelled hold or a suppressed press / release; the shipped
//      Super shot replaced and the generic hit beep routed
//   3  RENDERS (offline, through createB2Audio): B2's approved cues kept; B2 / B2S / B2HC / B2RD
//      identical to d3ecad6's b2Audio.js; the event's structure; the seam at several wind-up gaps;
//      the rush ends by itself unreleased; pause and death fades; the buffers (deterministic, both
//      sample rates, peaks, edges); no legacy layer; no falling glide (A/B: the detector flags B2S)
//   4  THE APPROVED SHIELD: b2Reactor.js identical to d3ecad6; every object on screen (the aura's
//      drawing included) identical per tick to the R5 Heavy Cannon link, and to d3ecad6
//   5  RESTARTS: one install each time, no duplicated Super after restarts, the render reused, the
//      Super bus disconnected, SFX restored
//   6  THE SHIPPED LINKS (labels, telemetry, the same fight)
//   7  AUDIO-RNG ISOLATION: live audio = the silent run, with the worker and with the per-frame job
//   8  DENSE FIGHTS: voices and drops with the Super in a crowd (B2RT and B2HC)
//   9  COST: the render (worker / job / on-the-spot), the audio update per frame
//  10  SCOPE
//
// usage: node tests/smoke-b2r6.mjs [--only=0,4] [--old=http://localhost:5174/]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME, FIGHT_SEG } from './diag-stuck-audit.mjs';
import { b0Scope } from './b0-scope.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const NOW = process.env.CRIX_URL || 'http://localhost:5173/';
const ONLY = opt('only', '') ? new Set(opt('only', '').split(',').map(Number)) : null;
const on = (n) => !ONLY || ONLY.has(n);
const VIS = 'visualPilot=v2c&polish=p1&fxPilot=p2a3';
const Q_MIXED = 'encdbg=mixed&room=hangar&sector=6';
const Q_SWARM = 'encdbg=swarmTide&room=hangar&sector=3';
const Q_STAGE = 'encdbg=mixed&room=hangar&sector=1';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const firstDiff = (a, b) => { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i; return -1; };
const join = (...a) => a.filter(Boolean).join('&');
const HOLD = [[60, 400], [460, 900], [960, 1500]];
const B = join(VIS, 'b2=B');
const R4 = join(VIS, 'b2=B', 'b2r=4', 'b2iso=1');
// the B2-R6 comparison set (the brief's four conditions)
const M = {
  HC: { flags: join(R4, 'b2a=B2HC', 'b2aura=1'), label: 'R5AUHC', kind: 'B2HC', aura: true },   // 1 audio control: R5 Heavy Cannon + the approved shield
  RT: { flags: join(R4, 'b2a=B2RT', 'b2aura=1'), label: 'R6AURT', kind: 'B2RT', aura: true },   // 2 the candidate: Reactor Thunder + the approved shield
  RTN: { flags: join(R4, 'b2a=B2RT'), label: 'R6RT', kind: 'B2RT', aura: false },               // 3 Reactor Thunder without the aura (audio isolation)
  S: { flags: join(R4, 'b2a=B2S'), label: 'B2R4S', kind: 'B2S', aura: false },                  // 4 the R4 B2S legacy reference
};
const OLD = opt('old', process.env.CRIX_OLD_URL || '');   // the d3ecad6 build (R5 final), for the shield's per-tick identity

// the seeded harness of tests/smoke-b2c.mjs (same helpers, same trace)
async function boot(flags, { base = NOW, q = Q_STAGE, seed = 4242, god = true, ctx = null, audio = false } = {}) {
  const page = ctx ? await ctx.newPage() : await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => { console.error(`pageerror: ${e.message}`); results.push({ name: `pageerror ${e.message}`, ok: false }); });
  await page.goto(`${base}?nodlg=1&nofreeze=1${flags ? `&${flags}` : ''}&${q}`);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
  if (audio) await page.keyboard.press('Shift');   // the game creates its AudioContext on the first gesture
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
    window.__trace = ({ seed, ticks, seg, hold, superTaps = [], melee = [], kill = [] }) => {
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
        if (kill.includes(i)) P.damage(99999);
        window.__adv(1);
        const w = gs._b2?.state;
        let s2 = `${i}|${f(P.x)},${f(P.y)},${f(P.hp)},${P.shieldHp},${P.alive},${f(P.superCharge)},${f(P.meleeCharge)},${w ? `${w.mag},${f(w.cool)},${f(w.reloadLeft)}` : '-'}|${f(cam.scrollX)},${f(cam.scrollY)}|${f(gs.time.timeScale)}|k${gs.runKills}|`;
        for (const e of gs.enemies.getChildren()) if (e.active) s2 += `${e.enemyType}:${f(e.x)},${f(e.y)},${Math.round(e.hp)},${e.state};`;
        for (const g2 of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets]) for (const bb of g2?.getChildren?.() || []) if (bb.active) s2 += `b${f(bb.x)},${f(bb.y)},${bb.damage};`;
        // display-list bookkeeping (a pooled image created) is presentation, not the fight
        s2 += `|d${window.__draws}|e${window.__evN - (window.__ev.addedtoscene || 0) - (window.__ev.removedfromscene || 0)}`;
        hashes.push(fnv(s2)); if (window.__raw) { window.__raw.push(s2); (window.__evlog = window.__evlog || []).push({ ...window.__ev }); }
      }
      K.A.isDown = K.D.isDown = K.W.isDown = K.S.isDown = false; gs.cursors.space.isDown = false;
      return { hashes, draws: window.__draws, kills: gs.runKills, shots: gs._b2?.stats.shots ?? 0, supers: window.__ev['player-fire-super'] || 0 };
    };
  }, { seed, god });
  return page;
}

// helpers shared by the sections below (in page)
const prep = (p) => p.evaluate(() => {
  const gs = window.__gs;
  window.__ts = () => gs._b2.stats.feel.skin;
  window.__mine = () => gs.children.list.filter((o) => /^b2r-/.test(o.texture?.key || '') && o.visible);
  window.__charge = (c) => { gs.player.superCharge = c * 4; gs.events.emit('player-super-changed'); };
  window.__fire = (n, c = null, dt) => { gs.cursors.space.isDown = true; for (let i = 0; i < n; i++) { if (c != null) gs.player.superCharge = c * 4; window.__adv(1, dt); } gs.cursors.space.isDown = false; };
  window.__super = () => { gs.player.superCharge = 4; gs.input.keyboard.emit('keydown-F', { repeat: false }); gs.input.keyboard.emit('keyup-F', { repeat: false }); };
});

const runFight = async (flags, q, o = {}) => { const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 } }); const p = await boot(flags, { q, god: o.god ?? true, ctx, audio: o.audio ?? false }); const r = await p.evaluate((x) => window.__trace(x), { seed: 9071, ticks: o.ticks ?? 1500, seg: FIGHT_SEG, hold: HOLD, superTaps: o.supers ?? [], melee: o.melee ?? [], kill: o.kill ?? [] }); const m = await p.evaluate(() => ({ b0: !!window.__gs._b0, label: window.__dbg.getB0Label(), kind: window.__gs._b2?.voice?.kind ?? null, aura: !!window.__gs._b2?.stats.feel?.skin?.r5 })); await ctx.close(); return { ...r, m }; };


const bootNoWorker = async (flags, o = {}) => { const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 } }); await ctx.addInitScript(() => { delete window.Worker; window.Worker = undefined; }); const p = await boot(flags, { ...o, ctx }); return { p, ctx }; };
const restartGame = `(() => { const gs = window.__gs; gs.scene.restart({ mode: 'endless', seed: 4242 }); window.__adv(3); for (let i = 0; i < 400 && !gs.roomSpec; i++) window.__adv(1); window.__adv(20); })()`;
// wait in real time (the worker runs on its own clock) for the render to be in
const waitRender = (p) => p.waitForFunction(() => { const s = window.__gs?._b2?.voice?.stats?.super?.render; return !!s && (s.readyAtMs > 0 || s.steps > 0 || /job/.test(s.mode)); }, null, { timeout: 30000 }).catch(() => null);

// ── 0. FLAGS ──────────────────────────────────────────────────────────────
if (on(0)) {
  console.log('\n== 0. flags');
  const cases = [
    ...Object.entries(M).map(([k, c]) => [`${k}: ${c.flags}`, c.flags, { b2: true, kind: c.kind, aura: c.aura, iso: true }]),
    ['lower case b2a=b2rt', join(R4, 'b2a=b2rt'), { b2: true, kind: 'B2RT', aura: false, iso: true }],
    ['R5 Reactor Detonation + aura still selectable', join(R4, 'b2a=B2RD', 'b2aura=1'), { b2: true, kind: 'B2RD', aura: true, iso: true }],
    ['R5 aura with the B2S sound still selectable', join(R4, 'b2a=B2S', 'b2aura=1'), { b2: true, kind: 'B2S', aura: true, iso: true }],
    ['legacy: B2-R3 + B2', join(VIS, 'b2=B', 'b2r=3', 'b2a=B2'), { b2: true, kind: 'B2', aura: false, iso: false }],
    ['legacy: B2-R2 + A', join(VIS, 'b2=B', 'b2r=2', 'b2a=A'), { b2: true, kind: 'A', aura: false, iso: false }],
    ['legacy: B2-R2 + B', join(VIS, 'b2=B', 'b2r=2', 'b2a=B'), { b2: true, kind: 'B', aura: false, iso: false }],
    ['b2aura without b2r=4 is ignored (with B2RT)', join(VIS, 'b2=B', 'b2r=3', 'b2a=B2RT', 'b2aura=1'), { b2: true, kind: 'B2RT', aura: false, iso: false }],
    ['B2RT without b2= does nothing', 'b2r=4&b2a=B2RT&b2aura=1', { b2: false, kind: null, aura: false, iso: false }],
    ['an unknown b2a value falls back to the B2-1 kit', join(VIS, 'b2=B', 'b2r=4', 'b2a=B2RX'), { b2: true, kind: 'b2-1', aura: false, iso: false }],
  ];
  for (const [label, fl, w] of cases) {
    const p = await boot(fl);
    const r = await p.evaluate(() => { const gs = window.__gs; return { b2: !!gs._b2, kind: gs._b2?.voice?.kind ?? (gs._b2 ? 'b2-1' : null), aura: !!gs._b2?.stats.feel?.skin?.r5, iso: (gs._b2?.stats?.audioIso ?? 0) > 0, auraObj: gs.children.list.some((o) => o.name === 'b2r5-aura') }; });
    await p.close();
    check(`${label}: ${w.b2 ? `B2 on, Super sound ${w.kind}, aura ${w.aura ? 'on' : 'off'}, isolation ${w.iso ? 'on' : 'off'}` : 'nothing installed'}`, r.b2 === w.b2 && r.kind === w.kind && r.aura === w.aura && r.auraObj === w.aura && r.iso === w.iso, JSON.stringify(r));
  }
}

// ── 1. GAMEPLAY PARITY ───────────────────────────────────────────────────
if (on(1)) {
  console.log('\n== 1. gameplay parity: B2RT = B2-B');
  const o = { supers: [300, 700, 1100, 1400], melee: [500, 525, 550] };
  const base = await runFight(B, Q_MIXED, o);
  for (const k of ['RT', 'RTN', 'HC']) {
    const r = await runFight(M[k].flags, Q_MIXED, o); const d = firstDiff(base.hashes, r.hashes);
    check(`${k} (${M[k].kind}${M[k].aura ? ' + aura' : ''}), MIXED s6, 1500 ticks, four Supers and a Broken Wings chain: = B2-B tick for tick`, d < 0 && r.supers === 4 && r.shots > 100, d < 0 ? `${r.shots} rounds, ${r.supers} Supers, ${r.kills} kills, ${r.draws} draws` : `first divergent tick ${d} (draws ${base.draws} vs ${r.draws})`);
  }
  for (const [label, q, god] of [['SWARM TIDE', Q_SWARM, true], ['MIXED s6, god mode off (shield hits, breaks, a death possible)', Q_MIXED, false]]) {
    const oo = { ...o, god }; const a = await runFight(B, q, oo);
    const r = await runFight(M.RT.flags, q, oo); const d = firstDiff(a.hashes, r.hashes);
    check(`RT, ${label}: = B2-B tick for tick`, d < 0 && r.supers === 4, d < 0 ? `${r.shots} rounds, ${r.kills} kills, ${r.draws} draws` : `first divergent tick ${d}`);
  }
}

// ── 2. IN THE GAME ───────────────────────────────────────────────────────
if (on(2)) {
  console.log('\n== 2. in the game: the rush on the committed cast only, one event per real blast');
  for (const kind of ['B2RT', 'B2HC']) {
    const p = await boot(join(R4, `b2a=${kind}`, 'b2c=1'), { audio: true }); await prep(p); await waitRender(p);
    const r = await p.evaluate(() => {
      const gs = window.__gs, P = gs.player, kb = gs.input.keyboard, v = gs._b2.voice, out = {}; window.__stage(); window.__ring(5, 230, -1.2, 0.25);
      let blasts = 0; gs.events.on('player-super-blast', () => blasts++);
      const sup = () => v.stats.super || {};
      const snap = (tag) => { out[tag] = { blasts, rel: v.stats.events.release || 0, kit: sup().blasts ?? sup().releases ?? 0, wind: v.stats.events.windup || 0, hand: sup().handovers ?? null }; };
      P.superCharge = 4; window.__adv(3); kb.emit('keydown-F', { repeat: false }); window.__adv(40); snap('held'); out.held.live = v.liveSuper();
      kb.emit('keyup-F', {}); window.__adv(60); snap('released');
      P.superCharge = 4; window.__adv(3); kb.emit('keydown-F', { repeat: false }); window.__adv(30); window.dispatchEvent(new Event('blur')); window.__adv(10); kb.emit('keyup-F', {}); window.__adv(60); snap('cancelled');
      P.superCharge = 4; P.suppress(2000); window.__adv(3); kb.emit('keydown-F', { repeat: false }); window.__adv(5); kb.emit('keyup-F', {}); window.__adv(60); snap('suppressedPress');
      P.clearSuppression(); P.superCharge = 4; window.__adv(3); kb.emit('keydown-F', { repeat: false }); window.__adv(20); P.suppress(2000); window.__adv(10); kb.emit('keyup-F', {}); window.__adv(60); snap('suppressedRelease');
      P.clearSuppression(); window.__adv(5); P.superCharge = 4; window.__adv(3); kb.emit('keydown-F', { repeat: false }); window.__adv(2); kb.emit('keyup-F', {}); window.__adv(90); snap('second');
      out.shipped = gs._b2.stats.audio || 0; out.beeps = gs._b2.stats.superBeeps || 0; out.super = v.stats.super; out.events = { ...v.stats.events };
      return out;
    });
    await p.close();
    const ok = r.held.blasts === 0 && r.held.rel === 0 && r.held.kit === 0 && r.held.wind === 0 && r.released.blasts === 1 && r.released.rel === 1 && r.released.kit === 1 && r.released.wind === 1
      && r.cancelled.blasts === 1 && r.cancelled.rel === 1 && r.cancelled.wind === 1 && r.suppressedPress.rel === 1 && r.suppressedPress.wind === 1 && r.suppressedRelease.rel === 1 && r.suppressedRelease.wind === 1
      && r.second.blasts === 2 && r.second.rel === 2 && r.second.kit === 2 && r.second.wind === 2 && r.shipped >= 2 && (kind !== 'B2RT' || (r.second.hand === 2 && Array.isArray(r.held.live) && r.held.live.length === 0));
    check(`${kind}: the wind-up sound starts only on the committed cast (none during a 40-tick held-F aim, a cancelled hold, a suppressed press or release); one discharge per real blast${kind === 'B2RT' ? '; each blast took over the rush (two hand-overs)' : ''}; the shipped Super shot replaced`, ok, JSON.stringify({ held: r.held, released: r.released, cancelled: r.cancelled, suppressedPress: r.suppressedPress, suppressedRelease: r.suppressedRelease, second: r.second, shipped: r.shipped }));
    check(`${kind}: the game's generic hit beep is not played for Super pellet hits (routed to the kit's impacts)`, r.beeps > 0 && (r.events.superHit || 0) >= r.beeps, JSON.stringify({ beeps: r.beeps, superHit: r.events.superHit }));
  }
}

// ── 3. RENDERS ───────────────────────────────────────────────────────────
if (on(3)) {
  console.log('\n== 3. renders (structure and identity; NOT a listening test)');
  const fsm = await import('fs'); const cp = await import('child_process');
  const root = new URL('..', import.meta.url).pathname;
  const strip = (f) => fsm.readFileSync(root + f, 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const code = strip('src/systems/b2Audio.js'), th = strip('src/systems/b2Thunder.js'), wk = strip('src/systems/b2ThunderWorker.js');
  check('b2Audio.js, b2Thunder.js and the worker draw no Math.random and set no timer (private streams; the capture rig and the parity harness own the clocks)', !/Math\.random/.test(code + th + wk) && !/setTimeout|setInterval|requestAnimationFrame/.test(th + wk), '');
  const r6 = code.slice(code.indexOf('function kitR6('), code.indexOf('export function createB2Audio'));
  check('no legacy layer in R6: kitR6 and b2Thunder.js use no sawtooth and no B2_TONES (the E6 pip); kitR6 calls none of B2\'s release / cooldown / wind-up layers (only handBed / releaseBed for the charge bed) and schedules no oscillator', r6.length > 1500 && !/sawtooth|B2_TONES|createOscillator/.test(r6 + th) && !/base\.release\(|base\.cooldown\(|base\.windup\(|base\.windupBed\(|base\.superHit\(/.test(r6) && /base\.handBed\(/.test(r6) && /base\.releaseBed\(/.test(r6), `kitR6 ${r6.length} chars, b2Thunder ${th.length} chars`);
  let old = null; try { old = cp.execSync('git show d3ecad6:src/systems/b2Audio.js', { cwd: root }).toString(); } catch (_) { old = null; }
  const p = await boot(B);
  const ren = await p.evaluate(async ({ oldSrc }) => {
    const mod = await window.__mod(/systems\/b2Audio\.js/), thm = await window.__mod(/systems\/b2Thunder\.js/);
    const base = performance.getEntriesByType('resource').map((x) => x.name).find((n) => /systems\/FX\.js/.test(n)).replace(/FX\.js.*/, '');
    const oldMod = oldSrc ? await import(URL.createObjectURL(new Blob([oldSrc.replace("from './FX.js'", `from '${base}FX.js'`).replace("from './rng.js'", `from '${base}rng.js'`)], { type: 'text/javascript' }))) : null;
    const SR = 44100;
    // R5's context render (rifle, charge, confirmation, locks, a Super, a crowd's hits)
    const render = async (m, kind, withSuper, opts = {}) => {
      const ctx = new OfflineAudioContext(1, SR * 14, SR), dest = ctx.createGain(); dest.connect(ctx.destination);
      let T = 0; const a = m.createB2Audio(kind, { ctx, dest, now: () => T }); let n = 0;
      for (let tick = 0; tick < 60 * 13; tick++) {
        T = tick / 60; const s = T;
        const heat = s < 6 ? s / 6 : withSuper && s >= 9.12 && s < 10.4 ? 0.1 : 1, sup = s >= 10.6 && s < 11.6;
        const firing = (s > 0.5 && s < 2) || (s > 3 && s < 5.5) || (s > 9.6 && s < 10.3) || (s > 11 && s < 11.4);
        if (firing && tick % 6 === 0) { a.shot({ heat, n: n++, hot: false, late: 0 }); if (n % 3 === 0) a.hitTick(heat); }
        if (s >= 7 && s < 8.5 && tick % 30 === 0) a.lockTick(1 + Math.floor((s - 7) * 2));
        if (withSuper && tick === 540) a.windup();
        if (withSuper && tick === Math.round(60 * 9.12)) a.release();
        if (withSuper) { const r0 = Math.round(60 * 9.12) + 6; if (tick >= r0 && tick < r0 + 3) for (let i = 0; i < 4; i++) a.superHit(); if (tick === r0 + 20 || tick === r0 + 21) a.superHit(); }
        if (tick === 720) a.silence();
        a.update(1000 / 60, { heat, firing, suppressed: sup, dead: false, sup });
      }
      const buf = await ctx.startRendering(); const d = buf.getChannelData(0); let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
      return { d, peak, stats: JSON.parse(JSON.stringify(a.stats)) };
    };
    const diff = (x, y) => { let mm = 0; for (let i = 0; i < x.length; i++) mm = Math.max(mm, Math.abs(x[i] - y[i])); return mm; };
    const out = {};
    const b2a = await render(mod, 'B2', false), b2b = await render(mod, 'B2', false);
    out.floor = diff(b2a.d, b2b.d);
    out.noSuper = diff((await render(mod, 'B2RT', false)).d, b2a.d);
    const ws = await render(mod, 'B2RT', true); out.withSuper = { peak: ws.peak, voices: ws.stats.peakVoices, dropped: ws.stats.dropped, sup: ws.stats.super };
    // each kit against d3ecad6, and against itself on this build (its own run-to-run noise: the R5 graphs jitter more than B2's)
    const at = (x, y) => { let mm = 0, mi = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i] - y[i]); if (v > mm) { mm = v; mi = i; } } return +(mi / SR).toFixed(3); };
    if (oldMod) { out.old = {}; out.self = {}; out.oldSelf = {}; out.at = {}; for (const k of ['B2', 'B2S', 'B2HC', 'B2RD']) { const a1 = await render(mod, k, true), o1 = await render(oldMod, k, true), o2 = await render(oldMod, k, true); out.old[k] = diff(a1.d, o1.d); out.at[k] = at(a1.d, o1.d); out.self[k] = diff(a1.d, (await render(mod, k, true)).d); out.oldSelf[k] = diff(o1.d, o2.d); } }
    // the Super alone (no rifle, no charge bed): wind-up at 0.5 s, the blast `gap` ticks later (or never), optional cuts
    const lone = async (kind, gapTicks, o = {}) => {
      const ctx = new OfflineAudioContext(2, SR * 3, SR), dest = ctx.createGain(); dest.connect(ctx.destination);
      let T = 0; const a = mod.createB2Audio(kind, { ctx, dest, now: () => T });
      const W = 30, Rk = gapTicks == null ? -1 : W + gapTicks;
      for (let tick = 0; tick < 170; tick++) {
        T = tick / 60;
        if (tick === W) a.windup();
        if (tick === Rk) a.release();
        if (o.pauseAt != null && tick === o.pauseAt) a.silence();
        a.update(1000 / 60, { heat: 0, firing: false, suppressed: false, dead: o.dieAt != null && tick >= o.dieAt, sup: false });
      }
      const buf = await ctx.startRendering(), L = buf.getChannelData(0), Rr = buf.getChannelData(1), x = new Float32Array(L.length); for (let i = 0; i < L.length; i++) x[i] = (L[i] + Rr[i]) / 2;
      const rms = (t0, t1) => { const i0 = Math.round(t0 * SR), i1 = Math.round(t1 * SR); let s = 0; for (let i = i0; i < i1; i++) s += x[i] * x[i]; return 10 * Math.log10(s / Math.max(1, i1 - i0) + 1e-20); };
      return { x, rms, w: W / 60 + 0.02, r: Rk < 0 ? null : Rk / 60 + 0.02, stats: JSON.parse(JSON.stringify(a.stats.super || null)) };
    };
    // the seam: from 20 ms before the blast to 30 ms after it, 10 ms RMS never dips more than this below its level 25 ms before
    const seam = (o) => { const ref = o.rms(o.r - 0.03, o.r - 0.02); let mn = 0; for (let t = o.r - 0.02; t < o.r + 0.03; t += 0.002) mn = Math.min(mn, o.rms(t, t + 0.01) - ref); return { ref: +ref.toFixed(1), dip: +mn.toFixed(1), after: +(o.rms(o.r + 0.005, o.r + 0.05) - ref).toFixed(1) }; };
    out.seams = {};
    for (const g of [5, 7, 15]) { const o = await lone('B2RT', g); out.seams[g] = { ...seam(o), hand: o.stats.handovers }; }
    const never = await lone('B2RT', null); out.never = { early: +never.rms(never.w + 0.1, never.w + 0.15).toFixed(1), late: +never.rms(never.w + 0.5, never.w + 0.9).toFixed(1) };
    const ref = await lone('B2RT', 7);
    out.ref = { at250: +ref.rms(ref.r + 0.25, ref.r + 0.3).toFixed(1), at500: +ref.rms(ref.r + 0.5, ref.r + 0.55).toFixed(1) };
    const pw = await lone('B2RT', null, { pauseAt: 33 }); out.pauseWind = { after: +pw.rms(33 / 60 + 0.02 + 0.06, 33 / 60 + 0.4).toFixed(1), cuts: pw.stats.cuts, blasts: pw.stats.blasts };
    const idle = await lone('B2RT', null, { pauseAt: 31 }); out.idleFloor = +idle.rms(1.5, 2.5).toFixed(1);   // B2's idle beds (gain 1e-4) are the floor
    const pb = await lone('B2RT', 7, { pauseAt: 49 }); out.pauseBlast = { after: +pb.rms(49 / 60 + 0.02 + 0.06, 49 / 60 + 0.6).toFixed(1), before: +pb.rms(49 / 60 - 0.04, 49 / 60).toFixed(1), cuts: pb.stats.cuts };
    const db = await lone('B2RT', 7, { dieAt: 49 }); out.deathBlast = { after: +db.rms(49 / 60 + 0.02 + 0.09, 49 / 60 + 0.6).toFixed(1), deathCuts: db.stats.deathCuts };
    const dw = await lone('B2RT', null, { dieAt: 33 }); out.deathWind = { after: +dw.rms(33 / 60 + 0.02 + 0.09, 33 / 60 + 0.5).toFixed(1), deathCuts: dw.stats.deathCuts };
    // no falling glide: the dominant 60-1500 Hz peak per 10 ms frame (40 ms Hann window, 96 log-spaced bins) over 0.8 s
    const glide = (x, t0) => {
      const n = Math.round(0.04 * SR), hop = Math.round(0.01 * SR), fs = Array.from({ length: 96 }, (_, k) => 60 * Math.pow(25, k / 95)), pk = [], lv = [];
      for (let i = Math.round(t0 * SR); i < Math.round((t0 + 0.8) * SR) - n; i += hop) {
        let best = 0, bf = 0;
        for (const f of fs) { const w = 2 * Math.PI * f / SR; let re = 0, im = 0; for (let j = 0; j < n; j++) { const hw = 0.5 - 0.5 * Math.cos(2 * Math.PI * j / (n - 1)), v = x[i + j] * hw; re += v * Math.cos(w * j); im -= v * Math.sin(w * j); } const m = re * re + im * im; if (m > best) { best = m; bf = f; } }
        pk.push(bf); lv.push(best);
      }
      const top = Math.max(...lv); let bestRun = { dur: 0, semis: 0 };
      for (let i = 0; i < pk.length;) { if (lv[i] < top * 0.01) { i++; continue; } let j = i; while (j + 1 < pk.length && lv[j + 1] >= top * 0.01 && pk[j + 1] <= pk[j] * 1.03) j++; const dur = (j - i) * 0.01, semis = 12 * Math.log2(pk[i] / pk[j]); if (dur >= 0.1 && semis > bestRun.semis) bestRun = { dur: +dur.toFixed(2), semis: +semis.toFixed(1) }; i = j + 1; }
      return bestRun;
    };
    out.glide = { RT: glide(ref.x, ref.r), S: glide((await lone('B2S', 7)).x, ref.r) };
    // the buffers themselves
    const r1 = thm.renderThunder(44100), r2 = thm.renderThunder(44100), r3 = thm.renderThunder(48000);
    const same = ['pre', 'L', 'R'].every((k) => r1[k].length === r2[k].length && r1[k].every((v, i) => v === r2[k][i])) && r1.impacts.every((b, k) => b.every((v, i) => v === r2.impacts[k][i]));
    const fin = (r) => [r.pre, r.L, r.R, ...r.impacts].every((a) => a.every(Number.isFinite));
    const pk = (r) => Math.max(...[r.L, r.R].map((a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
    const tail = (a, ms, sr) => a.slice(a.length - Math.round(ms / 1000 * sr)).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    out.bufs = { same, fin44: fin(r1), fin48: fin(r3), peak44: pk(r1), peak48: pk(r3), gr44: r1.info.limiterMaxGrDb, gr48: r3.info.limiterMaxGrDb, preTail: Math.max(tail(r1.pre, 10, 44100), tail(r3.pre, 10, 48000)), blastLast: Math.max(Math.abs(r1.L[r1.L.length - 1]), Math.abs(r3.R[r3.R.length - 1])), ceiling: thm.THUNDER.ceiling, len44: r1.L.length / 44100, len48: r3.L.length / 48000 };
    return out;
  }, { oldSrc: old });
  await p.close();
  const tol = Math.max(1e-6, ren.floor * 4);
  check('B2RT keeps B2\'s approved cues: rendered without a Super (rifle, charge, ready confirmation, locks), = B2 within the renderer\'s own run-to-run noise', ren.noSuper <= tol, JSON.stringify({ diff: ren.noSuper, floor: ren.floor }));
  check('B2, B2S, B2HC and B2RD (the controls and the rejected R5 kits) are d3ecad6\'s exactly: with a Super, = its b2Audio.js within each kit\'s own run-to-run noise on this build', old != null && ren.old && Object.keys(ren.old).every((k) => ren.old[k] <= Math.max(1e-6, 4 * ren.self[k], 4 * ren.oldSelf[k], tol)), JSON.stringify({ old: ren.old, at: ren.at, self: ren.self, oldSelf: ren.oldSelf, floor: ren.floor }));
  const S = ren.withSuper.sup;
  check('B2RT structure in context: one wind-up, one blast that took over the rush, the crowd\'s hits merged per tick, at most three impacts 50 ms apart within 150 ms; no clipping, nothing dropped, voices under the cap', S.windups === 1 && S.releases === 1 && S.blasts === 1 && S.handovers === 1 && S.impacts >= 1 && S.impacts <= 3 && S.merged >= 8 && (S.impacts < 2 || S.minGap >= 0.0499) && S.maxLag <= 0.15 && ren.withSuper.peak < 0.95 && ren.withSuper.dropped === 0 && ren.withSuper.voices < 48, JSON.stringify(ren.withSuper));
  check('the seam: with the blast 5, 7 or 15 ticks after the wind-up (83 / 117 / 250 ms; 117 is the game at 60 fps), the 10 ms level never dips more than 3 dB from 20 ms before the blast to 30 ms after it, and the blast lands above the rush', Object.values(ren.seams).every((s) => s.dip > -3 && s.after > 3 && s.hand === 1), JSON.stringify(ren.seams));
  const Q = ren.idleFloor + 3;   // "silent": within 3 dB of the kit's idle floor (B2's beds at gain 1e-4, about -80 dBFS)
  check('unreleased (the hero died in the wind-up window and no blast came): the rush plays, then ends by itself (back to the idle floor from 0.5 s)', ren.never.early > -45 && ren.never.late < Q, JSON.stringify({ ...ren.never, idleFloor: ren.idleFloor }));
  check('a pause in the wind-up fades the rush within 60 ms; a pause 0.2 s after the blast fades the event within 60 ms (it is still loud there otherwise)', ren.pauseWind.after < Q && ren.pauseWind.cuts >= 1 && ren.pauseBlast.after < Q && ren.pauseBlast.before > -40 && ren.pauseBlast.cuts >= 1 && ren.ref.at250 > -50, JSON.stringify({ pauseWind: ren.pauseWind, pauseBlast: ren.pauseBlast, ref: ren.ref, idleFloor: ren.idleFloor }));
  check('death fades the event within 90 ms (after the blast) and the rush (in the wind-up)', ren.deathBlast.after < Q && ren.deathBlast.deathCuts >= 1 && ren.deathWind.after < Q && ren.deathWind.deathCuts >= 1, JSON.stringify({ deathBlast: ren.deathBlast, deathWind: ren.deathWind, idleFloor: ren.idleFloor }));
  const bf = ren.bufs;
  check('the rendered buffers: deterministic (two renders identical), finite at 44.1 and 48 kHz, peak at the ceiling (the limiter takes under 1.5 dB), the rush ends in silence, the event ends at zero', bf.same && bf.fin44 && bf.fin48 && bf.peak44 <= bf.ceiling + 1e-6 && bf.peak48 <= bf.ceiling + 1e-6 && bf.gr44 < 1.5 && bf.gr48 < 1.5 && bf.preTail < 1e-6 && bf.blastLast < 1e-6, JSON.stringify(bf));
  check('no falling glide in the event (the legacy signature): the dominant low peak never falls more than 3 semitones over 0.1 s or longer; the same detector flags B2S (the A/B)', ren.glide.RT.semis <= 3 && ren.glide.S.semis > 3, JSON.stringify(ren.glide));
}

// ── 4. THE APPROVED SHIELD ───────────────────────────────────────────────
if (on(4)) {
  console.log('\n== 4. the approved shield (R5 aura) unchanged');
  const cp = await import('child_process');
  let same = false; try { cp.execSync('git diff --quiet d3ecad6 -- src/systems/b2Reactor.js src/systems/b2Feel.js', { cwd: new URL('..', import.meta.url).pathname }); same = true; } catch (_) { same = false; }
  check('src/systems/b2Reactor.js (the aura) and b2Feel.js are byte-identical to d3ecad6', same, '');
  const fightHash = async (flags, base = NOW) => {
    const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 } }); const p = await boot(flags, { base, q: Q_MIXED, god: false, ctx });
    const r = await p.evaluate(() => {
      const gs = window.__gs; window.__headless = false;
      const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; return h; };
      const f = (v) => Math.round(v * 100) / 100; const hs = []; let aura = 0;
      const cmd = (o) => (o.commandBuffer ? o.commandBuffer.length + ':' + fnv(o.commandBuffer.map((v) => (typeof v === 'number' ? Math.round(v * 100) : String(v))).join(',')) : '');
      const adv0 = window.__adv;
      let tk = 0; window.__adv = (n = 1, dt) => { for (let i = 0; i < n; i++) { if (tk++ % 120 === 0) gs.player.shieldHp = 400; adv0(1, dt); let s = ''; for (const o of gs.children.list) { if (!o.visible) continue; if (o.name === 'b2r5-aura') aura++; s += `${o.name || ''}:${o.type}:${o.texture?.key ?? ''}:${o.frame?.name ?? ''}:${f(o.x)},${f(o.y)}:${f(o.alpha)}:${o.depth}:${cmd(o)};`; } hs.push(fnv(s)); } };
      window.__trace({ seed: 9071, ticks: 600, seg: [[0, 200, 'D'], [200, 400, 'W'], [400, 9999, 'A']], hold: [[20, 300], [340, 600]], superTaps: [150, 450], melee: [250, 275] });
      const sk = gs._b2.stats.feel.skin;
      return { hs, aura, r5: JSON.parse(JSON.stringify(sk.r5 || null)) };
    });
    await ctx.close(); return r;
  };
  const hc = await fightHash(M.HC.flags), rt = await fightHash(M.RT.flags);
  const d = firstDiff(hc.hs, rt.hs);
  check('a rendered fight (MIXED s6, god mode off, the shield topped to 400 every 120 ticks, two Supers, a Broken Wings chain, moving): every object on screen, the aura\'s drawing commands included, identical per tick between the R6 link and the R5 Heavy Cannon link', d < 0 && rt.hs.length === 600 && rt.aura > 50, d < 0 ? `600 ticks; aura drawn on ${rt.aura} ticks` : `first different tick ${d}`);
  if (OLD) {
    const o5 = await fightHash(M.HC.flags, OLD);
    const d2 = firstDiff(o5.hs, rt.hs);
    check('the same fight on the d3ecad6 build (R5 final, Heavy Cannon + aura) and on this build (R6 + aura): every object on screen, the aura\'s drawing included, identical per tick', d2 < 0 && o5.aura === rt.aura, d2 < 0 ? `600 ticks; aura drawn on ${rt.aura} ticks on both` : `first different tick ${d2}`);
  } else check('the d3ecad6 comparison needs --old=<url of the d3ecad6 build> (not given)', false, '');
}

// ── 5. RESTARTS ──────────────────────────────────────────────────────────
const restartCheck = async (flags, label) => {
  const p = await boot(flags); await prep(p);
  const r = await p.evaluate(async () => {
    const gs = window.__gs, own = (o, k) => Object.prototype.hasOwnProperty.call(o, k), out = {};
    const FXm = await window.__mod(/systems\/FX\.js/);
    const sfxWrapped = () => Object.keys(FXm.SFX).filter((k) => typeof FXm.SFX[k] === 'function' && /Math\.random = iso|stats\.audio|stats\.superBeeps|voice\?\.hitTick|=> \{\}/.test(FXm.SFX[k].toString())).length;
    out.sfxInGame = sfxWrapped();
    const state = () => ({ skin: !!gs._b2?.stats.feel?.skin, pre: window.game.events.listeners('prerender').length, blast: gs.events.listeners('player-super-blast').length, wind: gs.events.listeners('player-fire-super').length });
    const use = () => { window.__stage(); window.__ring(2, 280, 0, 0.5); window.__fire(30, 0.5); window.__super(); window.__adv(30); return { rounds: gs._b2.stats.feel.skin.rounds, supers: gs._b2.stats.feel.skin.supers }; };
    const restart = () => { gs.scene.restart({ mode: 'endless', seed: 4242 }); window.__adv(3); for (let i = 0; i < 400 && !gs.roomSpec; i++) window.__adv(1); window.__adv(20); };
    out.first = state(); out.use1 = use();
    restart(); out.second = state(); out.use2 = use();
    restart(); out.third = state(); out.use3 = use();
    gs.scene.stop('HUD'); gs.scene.start('Title'); window.__adv(5);
    out.title = { sfx: sfxWrapped(), b2: !!gs._b2, pre: window.game.events.listeners('prerender').length, own: ['firePlayerSuper', '_superBlast'].filter((k) => own(gs, k)) };
    return out;
  });
  await p.close();
  const same = (a, b) => a.skin && b.skin && a.pre === b.pre && a.blast === b.blast && a.wind === b.wind;
  check(`${label}restart twice: one install each time (prerender, blast and cast listeners do not grow), the skin draws rounds and a Super after each`, same(r.first, r.second) && same(r.second, r.third) && [r.use1, r.use2, r.use3].every((u) => u.rounds >= 4 && u.supers === 1), JSON.stringify([r.first, r.second, r.third, r.use3]));
  check(`${label}quit to title: no B2, the prerender listener gone, no firePlayerSuper / _superBlast wrapper left behind, every SFX function the original again (${r.sfxInGame} were wrapped in play)`, !r.title.b2 && r.title.pre === r.first.pre - 1 && r.title.own.length === 0 && r.title.sfx === 0, JSON.stringify(r.title));
};
if (on(5)) {
  console.log('\n== 5. restarts');
  await restartCheck(M.RT.flags, 'RT (B2RT + aura): ');
  // live audio: no duplicated Super after restarts; the render reused; nodes accounted for
  const p = await boot(M.RT.flags, { audio: true }); await prep(p); await waitRender(p);
  const r = await p.evaluate(() => {
    const gs = window.__gs, out = { runs: [] };
    const AC = gs.sound?.context?.constructor || window.AudioContext;
    let created = 0; const proto = window.AudioContext.prototype, cbs = proto.createBufferSource;
    proto.createBufferSource = function (...a) { created++; return cbs.apply(this, a); };
    const one = () => {
      const v = gs._b2.voice; window.__stage(); window.__ring(3, 240, -0.4, 0.4);
      const c0 = created; window.__super(); window.__adv(14);   // the blast lands ~7 ticks after the cast (the shipped 70 ms wind-up under its slow-mo)
      const during = v.liveSuper();
      window.__adv(150);
      const s = v.stats.super; return { kind: v.kind, wind: s.windups, blasts: s.blasts, hand: s.handovers, impacts: s.impacts, sources: created - c0, during, render: { ...s.render } };
    };
    const restart = () => { gs.scene.restart({ mode: 'endless', seed: 4242 }); window.__adv(3); for (let i = 0; i < 400 && !gs.roomSpec; i++) window.__adv(1); window.__adv(20); };
    const v1 = gs._b2.voice; out.runs.push(one()); restart(); const v2 = gs._b2.voice; out.runs.push(one()); restart(); out.runs.push(one());
    out.oldCut = [v1.stats.superChainCut ?? null, v2.stats.superChainCut ?? null];
    gs.scene.stop('HUD'); gs.scene.start('Title'); window.__adv(5);
    proto.createBufferSource = cbs; void AC;
    return out;
  });
  await p.close();
  const ok = r.runs.every((u) => u.kind === 'B2RT' && u.wind === 1 && u.blasts === 1 && u.hand === 1 && u.sources === 2 + u.impacts && u.during.filter((x) => x === 'blast').length === 1) && r.runs.every((u) => u.render.sync === 0 && u.render.steps === r.runs[0].render.steps && u.render.mode === r.runs[0].render.mode) && r.oldCut.every((c) => c === 1);
  check('live audio, three runs (two restarts): each Super is one wind-up and one event in the run\'s new kit (buffer sources = rush + event + impacts: nothing duplicated from the old kits); the render is reused (not redone, never on the spot); each old run\'s Super bus disconnected', ok, JSON.stringify(r));
}

// ── 6. THE SHIPPED LINKS ─────────────────────────────────────────────────
if (on(6)) {
  console.log('\n== 6. the playtest links, as shipped (&b2c=1&b0=...)');
  for (const [k, c] of Object.entries(M)) {
    const p = await boot(join(c.flags, 'b2c=1', `b0=${c.label}`));
    const r = await p.evaluate(() => ({ b0: !!window.__gs._b0, label: window.__dbg.getB0Label(), kind: window.__gs._b2?.voice?.kind, aura: !!window.__gs._b2?.stats.feel?.skin?.r5, cand: window.__dbg.isB2Candidate() }));
    await p.close();
    check(`link ${k} (${c.label}): telemetry on with its label, Super sound ${c.kind}, aura ${c.aura ? 'on' : 'off'}, F-release targeting`, r.b0 && r.label === c.label && r.kind === c.kind && r.aura === c.aura && r.cand, JSON.stringify(r));
  }
  const o = { supers: [300, 700, 1100, 1400], melee: [500, 525, 550] };
  const a = await runFight(join(B, 'b2c=1', 'b0=B2B'), Q_MIXED, o), b = await runFight(join(M.RT.flags, 'b2c=1', 'b0=R6AURT'), Q_MIXED, o);   // both with the shipped F-release targeting
  const d = firstDiff(a.hashes, b.hashes);
  check('links B2B and RT (R6AURT), both with &b2c=1 as shipped: the same fight tick for tick', d < 0 && b.m.label === 'R6AURT', d < 0 ? `${b.shots} rounds, ${b.supers} Supers` : `first divergent tick ${d}`);
}

// ── 7. AUDIO-RNG ISOLATION ───────────────────────────────────────────────
if (on(7)) {
  console.log('\n== 7. audio-RNG isolation with Reactor Thunder');
  const o = { supers: [300, 700, 1100, 1400], melee: [500, 525, 550], kill: [1200], god: false };
  const silent = await runFight(join(M.RT.flags, 'b2c=1'), Q_MIXED, o);
  for (const k of ['RT', 'RTN']) {
    const live = await runFight(join(M[k].flags, 'b2c=1'), Q_MIXED, { ...o, audio: true });
    const d = firstDiff(silent.hashes, live.hashes);
    check(`${k} with live audio (the worker render) = the silent run tick for tick (four Supers, a Broken Wings chain, a death)`, d < 0 && live.supers === 4, d < 0 ? `${live.draws} draws` : `first divergent tick ${d}`);
  }
  // no Worker: the per-frame job (and an on-the-spot finish at the first cast) also draws nothing
  const { p, ctx } = await bootNoWorker(join(M.RT.flags, 'b2c=1'), { q: Q_MIXED, god: false, audio: true });
  const lr = await p.evaluate((x) => { const r = window.__trace(x); return { ...r, render: { ...(window.__gs._b2.voice.stats.super?.render || {}) } }; }, { seed: 9071, ticks: 1500, seg: FIGHT_SEG, hold: HOLD, superTaps: o.supers, melee: o.melee, kill: o.kill });
  await ctx.close();
  const d = firstDiff(silent.hashes, lr.hashes);
  check('RT with live audio and no Worker (the render runs as a per-frame job on the main thread) = the silent run tick for tick', d < 0 && lr.supers === 4 && /job/.test(lr.render.mode), d < 0 ? `render ${JSON.stringify(lr.render)}` : `first divergent tick ${d}`);
}

// ── 8. DENSE FIGHTS ──────────────────────────────────────────────────────
// Voices are counted against the audio clock. In this harness the game is stepped far from real time
// while a live AudioContext runs in real time, so live-context voice counts measure the harness, not
// the game (both kits hit the cap there). Here the game's context is an OfflineAudioContext whose
// clock IS the stepped game clock (the capture rig's method; it is never rendered): the counts are
// what the game schedules.
const bootVirtual = async (flags, o = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 } });
  await ctx.addInitScript(() => {
    const RealOAC = window.OfflineAudioContext;
    window.AudioContext = window.webkitAudioContext = function () {
      const c = new RealOAC(2, 44100 * 60, 44100); let t0 = null;
      Object.defineProperty(c, 'currentTime', { get: () => { const t = window.__t; if (typeof t !== 'number') return 0; if (t0 == null) t0 = t; return (t - t0) / 1000; } });
      Object.defineProperty(c, 'state', { get: () => 'running' });
      c.resume = () => Promise.resolve(); c.suspend = () => Promise.resolve(); c.close = () => Promise.resolve();
      return c;
    };
  });
  const p = await boot(flags, { ...o, ctx, audio: true }); return { p, ctx };
};
if (on(8)) {
  console.log('\n== 8. dense fights: voices on the game clock');
  const res = {};
  for (const k of ['RT', 'HC', 'S']) {
    const { p, ctx } = await bootVirtual(join(M[k].flags, 'b2c=1'), { q: Q_SWARM, god: true }); await waitRender(p);
    res[k] = await p.evaluate((x) => { const r = window.__trace(x); const v = window.__gs._b2.voice.stats; return { supers: r.supers, shots: r.shots, kills: r.kills, peak: v.peakVoices, dropped: v.dropped, sup: v.super }; }, { seed: 9071, ticks: 1500, seg: FIGHT_SEG, hold: [[20, 1480]], superTaps: [200, 450, 700, 950, 1200], melee: [600, 625] });
    await ctx.close();
  }
  const R = res.RT, H = res.HC;
  check('SWARM TIDE on the game clock, the rifle held for 1460 ticks, five Supers into the crowd: B2RT drops nothing and every blast played its event (blasts = casts = 5)', R.dropped === 0 && R.sup.blasts === R.supers && R.supers === 5, `B2RT peak ${R.peak}/48, dropped ${R.dropped}, ${R.sup.blasts} events, ${R.sup.impacts} impacts (${R.sup.merged} merged, ${R.sup.capped} capped) | B2HC peak ${H.peak}/48, dropped ${H.dropped} | B2S peak ${res.S.peak}/48, dropped ${res.S.dropped}`);
  check('B2RT peaks below B2HC in the same fight (the event is 1-3 sources against Heavy Cannon\'s ~30 voices) and under the cap', R.peak < H.peak && R.peak < 48, `B2RT ${R.peak} vs B2HC ${H.peak} (B2S ${res.S.peak})`);
}

// ── 9. COST ──────────────────────────────────────────────────────────────
if (on(9)) {
  console.log('\n== 9. cost');
  const p = await boot(join(M.RT.flags, 'b2c=1'), { audio: true }); await waitRender(p);
  const w = await p.evaluate(() => ({ ...window.__gs._b2.voice.stats.super.render }));
  await p.close();
  check('with a Worker (any current browser): the render arrives off the main thread (main-thread render time 0, nothing on the spot)', w.mode === 'worker' && w.readyAtMs > 0 && w.mainMs === 0 && w.sync === 0, JSON.stringify(w));
  const { p: q, ctx } = await bootNoWorker(join(M.RT.flags, 'b2c=1'), { audio: true });
  const j = await q.evaluate(() => {
    const v = window.__gs._b2.voice, steps = []; const s = () => v.stats.super?.render;
    for (let i = 0; i < 400 && !(s() && s().steps >= 58); i++) { const m0 = s()?.mainMs ?? 0; window.__adv(1); steps.push((s()?.mainMs ?? 0) - m0); }
    const st = steps.filter((x) => x > 0).sort((a, b) => a - b);
    return { render: { ...s() }, frames: st.length, median: st[st.length >> 1], p95: st[Math.floor(st.length * 0.95)], max: st[st.length - 1] };
  });
  await ctx.close();
  check('without a Worker: the per-frame job (one block per frame) completes with no on-the-spot render; per-frame main-thread cost reported (this software-rendered harness; the first blocks run before the JIT optimizes)', /job/.test(j.render.mode) && j.render.sync === 0 && j.render.steps >= 58, JSON.stringify(j));
  // the audio update per frame, B2RT vs B2HC, in the same fight
  const upd = {};
  for (const k of ['RT', 'HC']) {
    const pp = await boot(join(M[k].flags, 'b2c=1'), { q: Q_MIXED, god: true, audio: true }); await waitRender(pp);
    upd[k] = await pp.evaluate((x) => { const v = window.__gs._b2.voice; let ms = 0, n = 0; const u = v.update.bind(v); v.update = (...a) => { const t = performance.now(); u(...a); ms += performance.now() - t; n++; }; const sh = v.release.bind(v); let rel = 0; v.release = (...a) => { const t = performance.now(); sh(...a); rel = Math.max(rel, performance.now() - t); }; window.__trace(x); return { perFrame: ms / n, frames: n, release: rel }; }, { seed: 9071, ticks: 900, seg: FIGHT_SEG, hold: HOLD, superTaps: [300, 700], melee: [] });
    await pp.close();
  }
  check('the audio update per frame with B2RT stays within B2HC\'s (+0.05 ms), and a blast costs under 2 ms on the main thread', upd.RT.perFrame <= upd.HC.perFrame + 0.05 && upd.RT.release < 2, JSON.stringify(upd));
}

// ── 10. SCOPE ────────────────────────────────────────────────────────────
if (on(10)) {
  console.log('\n== 10. scope');
  const s = b0Scope(new URL('..', import.meta.url).pathname);
  check('the B0 / B1 / B2 scope guard (GameScene and every frozen file untouched)', s.ok, s.detail);
  const cp = await import('child_process');
  const files = cp.execSync('git diff --name-only d3ecad6 -- src', { cwd: new URL('..', import.meta.url).pathname }).toString().trim().split('\n').filter(Boolean);
  const allowed = ['src/systems/b2Audio.js', 'src/systems/b2Thunder.js', 'src/systems/b2ThunderWorker.js', 'src/systems/debug.js', 'src/systems/b2Flagship.js'];
  const untracked = cp.execSync('git ls-files --others --exclude-standard -- src', { cwd: new URL('..', import.meta.url).pathname }).toString().trim().split('\n').filter(Boolean);
  check('R6 touches only the audio pilot: src changes since d3ecad6 are b2Audio.js, b2Thunder.js, b2ThunderWorker.js and the flag lines in debug.js / b2Flagship.js', [...files, ...untracked].every((f) => allowed.includes(f)), JSON.stringify([...new Set([...files, ...untracked])]));
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
if (bad.length) { console.log('FAILED:'); bad.forEach((x) => console.log(`  - ${x.name}`)); process.exit(1); }
