// B2-R5 (`&b2a=B2HC|B2RD` new Super discharge sounds, `&b2aura=1` the enchanted full-shield aura;
// over B2-R4 `&b2r=4&b2iso=1`). Controls: `&b2a=B2S` (the R4 Super sound), the R4 shield (no b2aura).
// Standalone, against the dev server on :5173.
//
//   0  FLAGS: the six matrix conditions and the legacy modes; b2aura only with b2r=4
//   1  GAMEPLAY PARITY: every condition = B2-B tick for tick (silent harness): state, ammo, meters,
//      enemies, bolts and pellets, Math.random draws, events; also crowd and god mode off
//   2  THE SUPER SOUND IN THE GAME: once per committed blast (B2-1 press, held-F release); none on a
//      held F before release, a cancelled hold, a suppressed press or a suppressed release; the shipped
//      Super shot replaced, the generic hit beep routed; HC and RD and the B2S control
//   3  OFFLINE RENDERS: HC and RD keep B2's approved cues (no Super: = B2 within the renderer's noise);
//      B2 and B2S identical to the B2-R4 build (7e73dae's b2Audio.js); the Super's structure (pre-blast
//      cut by the blast, one blast, five zips, at most three merged impacts, no clipping, nothing
//      dropped, voices under the cap); pause and death cuts; no legacy layer in the R5 code
//   4  THE AURA: absent without the flag; only at full (settled values 400/300/200/100/0); a hit knocks
//      it out, a break shows none; all four facings; behind the hero and in sync at every render of a
//      whole fight; never on a sprite cell; motes from a fixed pool; every other object on screen
//      identical to the R4 control per tick; cost
//   5  RESTARTS (aura graphics destroyed, nothing grows, SFX restored)
//   6  THE SHIPPED LINKS (labels, telemetry)
//   7  AUDIO-RNG ISOLATION with the new kits: live audio = the silent run tick for tick
//   9  SCOPE
//
// usage: node tests/smoke-b2r5.mjs [--only=0,4]
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
// the B2-R5 matrix: Super sound x shield (the R4 shield, or the R5 aura)
const M = {
  CTRL: { flags: join(R4, 'b2a=B2S'), label: 'B2R4S', kind: 'B2S', aura: false },
  A: { flags: join(R4, 'b2a=B2HC'), label: 'R5HC', kind: 'B2HC', aura: false },
  B: { flags: join(R4, 'b2a=B2RD'), label: 'R5RD', kind: 'B2RD', aura: false },
  C: { flags: join(R4, 'b2a=B2S', 'b2aura=1'), label: 'R5AUS', kind: 'B2S', aura: true },
  D: { flags: join(R4, 'b2a=B2HC', 'b2aura=1'), label: 'R5AUHC', kind: 'B2HC', aura: true },
  E: { flags: join(R4, 'b2a=B2RD', 'b2aura=1'), label: 'R5AURD', kind: 'B2RD', aura: true },
};

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

// ── 0. FLAGS ──────────────────────────────────────────────────────────────
if (on(0)) {
  console.log('\n== 0. flags');
  const cases = [
    ...Object.entries(M).map(([k, c]) => [`${k}: ${c.flags}`, c.flags, { b2: true, kind: c.kind, aura: c.aura, iso: true }]),
    ['legacy: B2-R3 + B2', join(VIS, 'b2=B', 'b2r=3', 'b2a=B2'), { b2: true, kind: 'B2', aura: false, iso: false }],
    ['b2aura without b2r=4 is ignored', join(VIS, 'b2=B', 'b2r=3', 'b2a=B2S', 'b2aura=1'), { b2: true, kind: 'B2S', aura: false, iso: false }],
    ['b2aura without b2= does nothing', 'b2r=4&b2a=B2HC&b2aura=1', { b2: false, kind: null, aura: false, iso: false }],
    ['an unknown b2a value falls back to the B2-1 kit', join(VIS, 'b2=B', 'b2r=4', 'b2a=B2X'), { b2: true, kind: 'b2-1', aura: false, iso: false }],
  ];
  for (const [label, fl, w] of cases) {
    const p = await boot(fl);
    const r = await p.evaluate(() => { const gs = window.__gs; return { b2: !!gs._b2, kind: gs._b2?.voice?.kind ?? (gs._b2 ? 'b2-1' : null), aura: !!gs._b2?.stats.feel?.skin?.r5, auraFlag: window.__dbg.isB2Aura(), iso: (gs._b2?.stats?.audioIso ?? 0) > 0, auraObj: gs.children.list.some((o) => o.name === 'b2r5-aura') }; });
    await p.close();
    check(`${label}: ${w.b2 ? `B2 on, Super sound ${w.kind}, aura ${w.aura ? 'on' : 'off'}, isolation ${w.iso ? 'on' : 'off'}` : 'nothing installed'}`, r.b2 === w.b2 && r.kind === w.kind && r.aura === w.aura && r.auraObj === w.aura && r.iso === w.iso, JSON.stringify(r));
  }
}

// ── 1. GAMEPLAY PARITY ───────────────────────────────────────────────────
if (on(1)) {
  console.log('\n== 1. gameplay parity: every condition = B2-B');
  const o = { supers: [300, 700, 1100, 1400], melee: [500, 525, 550] };
  const base = await runFight(B, Q_MIXED, o);
  for (const k of ['CTRL', 'A', 'B', 'C', 'D', 'E']) {
    const r = await runFight(M[k].flags, Q_MIXED, o); const d = firstDiff(base.hashes, r.hashes);
    check(`${k} (${M[k].kind}${M[k].aura ? ' + aura' : ''}), MIXED s6, 1500 ticks, four Supers and a Broken Wings chain: = B2-B tick for tick`, d < 0 && r.supers === 4 && r.shots > 100, d < 0 ? `${r.shots} rounds, ${r.supers} Supers, ${r.kills} kills, ${r.draws} draws` : `first divergent tick ${d} (draws ${base.draws} vs ${r.draws})`);
  }
  for (const [label, q, god] of [['SWARM TIDE', Q_SWARM, true], ['MIXED s6, god mode off (shield hits, breaks, a death possible)', Q_MIXED, false]]) {
    const oo = { ...o, god }; const a = await runFight(B, q, oo);
    for (const k of ['D', 'E']) { const r = await runFight(M[k].flags, q, oo); const d = firstDiff(a.hashes, r.hashes); check(`${k}, ${label}: = B2-B tick for tick`, d < 0 && r.supers === 4, d < 0 ? `${r.shots} rounds, ${r.kills} kills, ${r.draws} draws` : `first divergent tick ${d}`); }
  }
}

// ── 2. THE SUPER SOUND IN THE GAME ───────────────────────────────────────
if (on(2)) {
  console.log('\n== 2. the Super sound: once per committed blast');
  for (const kind of ['B2HC', 'B2RD', 'B2S']) {
    const p = await boot(join(R4, `b2a=${kind}`, 'b2c=1'), { audio: true }); await prep(p);   // live audio: the kit is built on the game's context
    const r = await p.evaluate(() => {
      const gs = window.__gs, P = gs.player, kb = gs.input.keyboard, v = gs._b2.voice, out = {}; window.__stage(); window.__ring(5, 230, -1.2, 0.25);
      let blasts = 0; gs.events.on('player-super-blast', () => blasts++);
      const sup = () => v.stats.super || {}; const snap = (tag) => { out[tag] = { blasts, rel: v.stats.events.release || 0, kit: sup().blasts ?? sup().releases ?? 0, wind: v.stats.events.windup || 0 }; };
      // 1. held F: targeting only, then the release
      P.superCharge = 4; window.__adv(3); kb.emit('keydown-F', { repeat: false }); window.__adv(40); snap('held');
      kb.emit('keyup-F', {}); window.__adv(60); snap('released');
      // 2. a cancelled hold (focus lost)
      P.superCharge = 4; window.__adv(3); kb.emit('keydown-F', { repeat: false }); window.__adv(30); window.dispatchEvent(new Event('blur')); window.__adv(10); kb.emit('keyup-F', {}); window.__adv(60); snap('cancelled');
      // 3. suppressed before the press
      P.superCharge = 4; P.suppress(2000); window.__adv(3); kb.emit('keydown-F', { repeat: false }); window.__adv(5); kb.emit('keyup-F', {}); window.__adv(60); snap('suppressedPress');
      // 4. suppressed during the hold, then released
      P.clearSuppression(); P.superCharge = 4; window.__adv(3); kb.emit('keydown-F', { repeat: false }); window.__adv(20); P.suppress(2000); window.__adv(10); kb.emit('keyup-F', {}); window.__adv(60); snap('suppressedRelease');
      // 5. a second legitimate cast
      P.clearSuppression(); window.__adv(5); P.superCharge = 4; window.__adv(3); kb.emit('keydown-F', { repeat: false }); window.__adv(2); kb.emit('keyup-F', {}); window.__adv(90); snap('second');
      out.shipped = gs._b2.stats.audio || 0; out.beeps = gs._b2.stats.superBeeps || 0; out.super = v.stats.super; out.events = { ...v.stats.events };
      return out;
    });
    await p.close();
    const ok = r.held.blasts === 0 && r.held.rel === 0 && r.held.kit === 0 && r.released.blasts === 1 && r.released.rel === 1 && r.released.kit === 1
      && r.cancelled.blasts === 1 && r.cancelled.rel === 1 && r.suppressedPress.blasts === 1 && r.suppressedPress.rel === 1 && r.suppressedRelease.blasts === 1 && r.suppressedRelease.rel === 1
      && r.second.blasts === 2 && r.second.rel === 2 && r.second.kit === 2 && r.second.wind === 2 && r.shipped >= 2;
    check(`${kind}: the discharge plays once per committed blast (a held-F release, a second cast); none on a held F before release, a cancelled hold, a suppressed press or a suppressed release; the shipped Super shot replaced`, ok, JSON.stringify({ held: r.held, released: r.released, cancelled: r.cancelled, suppressedPress: r.suppressedPress, suppressedRelease: r.suppressedRelease, second: r.second, shipped: r.shipped }));
    check(`${kind}: the game's generic hit beep is not played for Super pellet hits (routed to the kit's impacts)`, r.beeps > 0 && (r.events.superHit || 0) >= r.beeps, JSON.stringify({ beeps: r.beeps, superHit: r.events.superHit }));
  }
}

// ── 3. OFFLINE RENDERS ───────────────────────────────────────────────────
if (on(3)) {
  console.log('\n== 3. offline renders (structure and identity; NOT a listening test)');
  const fsm = await import('fs'); const cp = await import('child_process');
  const cur = fsm.readFileSync(new URL('../src/systems/b2Audio.js', import.meta.url), 'utf8');
  const code = cur.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  check('b2Audio.js draws no Math.random (private mulberry32 streams only)', !/Math\.random/.test(code), '');
  const r5 = code.slice(code.indexOf('function kitR5('), code.indexOf('export function createB2Audio'));
  check('no legacy layer in the R5 kits: no sawtooth, no B2_TONES (the E6 pip), no B2 release / cooldown layers called (only the charge-bed hand-off windupBed / releaseBed)', r5.length > 1000 && !/sawtooth/.test(r5) && !/B2_TONES/.test(r5) && !/base\.release\(|base\.cooldown\(|base\.windup\(|base\.superHit\(/.test(r5) && /base\.windupBed\(/.test(r5) && /base\.releaseBed\(/.test(r5), `kitR5: ${r5.length} chars`);
  let old = null; try { old = cp.execSync('git show 7e73dae:src/systems/b2Audio.js', { cwd: new URL('..', import.meta.url).pathname }).toString(); } catch (_) { old = null; }
  const p = await boot(B);
  const ren = await p.evaluate(async ({ oldSrc }) => {
    const mod = await window.__mod(/systems\/b2Audio\.js/);
    const base = performance.getEntriesByType('resource').map((x) => x.name).find((n) => /systems\/FX\.js/.test(n)).replace(/FX\.js.*/, '');
    const oldMod = oldSrc ? await import(URL.createObjectURL(new Blob([oldSrc.replace("from './FX.js'", `from '${base}FX.js'`).replace("from './rng.js'", `from '${base}rng.js'`)], { type: 'text/javascript' }))) : null;
    const render = async (m, kind, withSuper, opts = {}) => {
      const SR = 44100, ctx = new OfflineAudioContext(1, SR * 14, SR), dest = ctx.createGain(); dest.connect(ctx.destination);
      let T = 0; const a = m.createB2Audio(kind, { ctx, dest, now: () => T }); let n = 0;
      for (let tick = 0; tick < 60 * 13; tick++) {
        T = tick / 60; const s = T;
        const heat = s < 6 ? s / 6 : withSuper && s >= 9.12 && s < 10.4 ? 0.1 : 1, sup = s >= 10.6 && s < 11.6;
        const firing = (s > 0.5 && s < 2) || (s > 3 && s < 5.5) || (s > 9.6 && s < 10.3) || (s > 11 && s < 11.4);
        if (firing && tick % 6 === 0) { a.shot({ heat, n: n++, hot: false, late: 0 }); if (n % 3 === 0) a.hitTick(heat); }
        if (s >= 7 && s < 8.5 && tick % 30 === 0) a.lockTick(1 + Math.floor((s - 7) * 2));
        if (withSuper && tick === 540) a.windup();
        if (opts.pauseInWindup && tick === 543) a.silence();
        if (withSuper && tick === Math.round(60 * 9.12)) a.release();
        if (withSuper) { const r0 = Math.round(60 * 9.12) + 6; if (tick >= r0 && tick < r0 + 3) for (let i = 0; i < 4; i++) a.superHit(); if (tick === r0 + 20 || tick === r0 + 21) a.superHit(); }
        if (tick === 720) a.silence();
        a.update(1000 / 60, { heat, firing, suppressed: sup, dead: !!(opts.dieAt && tick >= opts.dieAt && tick < opts.dieAt + 30), sup });
      }
      const buf = await ctx.startRendering(); const d = buf.getChannelData(0); let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
      return { d, peak, stats: JSON.parse(JSON.stringify(a.stats)) };
    };
    const diff = (x, y) => { let mm = 0; for (let i = 0; i < x.length; i++) mm = Math.max(mm, Math.abs(x[i] - y[i])); return mm; };
    const b2a = await render(mod, 'B2', false), b2b = await render(mod, 'B2', false);
    const out = { floor: diff(b2a.d, b2b.d), noSuper: {}, withSuper: {}, pause: {}, death: {} };
    for (const k of ['B2HC', 'B2RD']) {
      out.noSuper[k] = diff((await render(mod, k, false)).d, b2a.d);
      const s1 = await render(mod, k, true); out.withSuper[k] = { peak: s1.peak, voices: s1.stats.peakVoices, dropped: s1.stats.dropped, sup: s1.stats.super };
      out.pause[k] = (await render(mod, k, true, { pauseInWindup: true })).stats.super; out.death[k] = (await render(mod, k, true, { dieAt: 548 })).stats.super;
    }
    if (oldMod) {
      out.oldB2 = diff((await render(mod, 'B2', true)).d, (await render(oldMod, 'B2', true)).d);
      out.oldB2S = diff((await render(mod, 'B2S', true)).d, (await render(oldMod, 'B2S', true)).d);
    }
    return out;
  }, { oldSrc: old });
  await p.close();
  const tol = Math.max(1e-6, ren.floor * 4);
  for (const k of ['B2HC', 'B2RD']) {
    check(`${k} keeps B2's approved cues: rendered without a Super (rifle, charge, ready confirmation, locks), = B2 within the renderer's own run-to-run noise`, ren.noSuper[k] <= tol, JSON.stringify({ diff: ren.noSuper[k], floor: ren.floor }));
    const w = ren.withSuper[k], S = w.sup;
    check(`${k} Super structure: the pre-blast cut by the blast, one blast, five zips, the crowd's hits merged per tick, at most three impacts 50 ms apart within 150 ms; no clipping, nothing dropped, voices under the cap`, S.windups === 1 && S.releases === 1 && S.blasts === 1 && S.cuts >= 1 && S.zips === 5 && S.impacts >= 1 && S.impacts <= 3 && S.merged >= 8 && (S.impacts < 2 || S.minGap >= 0.0499) && S.maxLag <= 0.15 && w.peak < 0.95 && w.dropped === 0 && w.voices < 48, JSON.stringify(w));
    check(`${k}: a pause in the wind-up cuts the pre-blast; a death cuts the tail`, ren.pause[k].cuts >= 1 && ren.death[k].deathCuts >= 1, JSON.stringify({ pause: ren.pause[k], death: ren.death[k] }));
  }
  check('B2 and B2S (the controls) are the B2-R4 build\'s exactly: with a Super, = 7e73dae\'s b2Audio.js within the renderer\'s noise', old != null && ren.oldB2 <= tol && ren.oldB2S <= tol, JSON.stringify({ b2: ren.oldB2, b2s: ren.oldB2S, floor: ren.floor }));
}

// ── 4. THE AURA ──────────────────────────────────────────────────────────
if (on(4)) {
  console.log('\n== 4. the enchanted aura');
  const probe = async (flags) => {
    const p = await boot(flags, { god: false }); await prep(p);
    const r = await p.evaluate(() => {
      const gs = window.__gs, P = gs.player, out = {}; window.__stage(); window.__headless = false;
      const sk = () => gs._b2.stats.feel.skin, A = () => gs.children.list.find((o) => o.name === 'b2r5-aura');
      const lvl = () => sk().r5?.level ?? null;
      const settle = (hp) => { P.shieldHp = hp; window.__adv(80); return { level: lvl(), visible: !!A()?.visible }; };
      out.values = { 400: settle(400), 300: settle(300), 200: settle(200), 100: settle(100), 0: settle(0) };
      out.refull = settle(400);
      // facings (the side frame flipped for W)
      out.facings = {};
      for (const [nm, a] of [['S', Math.PI / 2], ['N', -Math.PI / 2], ['E', 0], ['W', Math.PI]]) { P.facing = a; const k = gs.keys, dir = Math.round(((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (Math.PI / 2)) % 4; k.D.isDown = dir === 0; k.S.isDown = dir === 1; k.A.isDown = dir === 2; k.W.isDown = dir === 3; window.__adv(3); k.D.isDown = k.S.isDown = k.A.isDown = k.W.isDown = false; window.__adv(6); out.facings[nm] = { ring1: sk().r5?.ring1 ?? 0, visible: !!A()?.visible, flip: P.flipX, frame: P.frame.name, aura: A()?.depth ?? null, weapon: P.weaponSprite?.depth ?? null, hero: P.depth }; }
      // fading in after a spell at 0: no jump on the first frame back
      P.shieldHp = 0; window.__adv(60); P.shieldHp = 400; window.__adv(1); out.fadeIn1 = lvl(); window.__adv(1); out.fadeIn2 = lvl();
      // a hit at full: knocked out, then back
      P.shieldHp = 400; window.__adv(40); P.damage(20, 0); window.__adv(1); out.hit = { level: lvl(), shield: P.shieldHp }; window.__adv(40); out.afterHit = { level: lvl(), shield: P.shieldHp };
      // the break: none
      P.shieldHp = 10; window.__adv(2); P.damage(10, 0); window.__adv(1); out.brk = { level: lvl(), visible: !!A()?.visible, shield: P.shieldHp }; P.hp = P.hpMax ?? P.hp;
      // motes over five seconds at full
      P.shieldHp = 400; window.__adv(300);
      out.r5 = JSON.parse(JSON.stringify(sk().r5 || null)); out.depth = { aura: A()?.depth ?? null, hero: P.depth };
      return out;
    });
    await p.close();
    return r;
  };
  const off = await probe(M.CTRL.flags), on4 = await probe(M.C.flags);
  check('without the flag (the R4 control): no aura object and no aura stats', off.r5 === null && off.values[400].visible === false, JSON.stringify({ r5: off.r5 }));
  const V = on4.values;
  check('only at full: settled at 400 the aura is up (level 1); at 300, 200, 100 and 0 it is gone (level 0, not drawn)', V[400].level === 1 && V[400].visible && [300, 200, 100, 0].every((k) => V[k].level === 0 && !V[k].visible) && on4.refull.level === 1, JSON.stringify(V));
  check('all four facings at full draw the aura (the side frame flipped for W)', ['S', 'N', 'E', 'W'].every((k) => on4.facings[k].visible && on4.facings[k].ring1 > 6) && on4.facings.W.flip !== on4.facings.E.flip, JSON.stringify(on4.facings));
  check('the aura is below the hero AND below the rifle on every facing (Player draws the rifle at depth - 1 facing north)', ['S', 'N', 'E', 'W'].every((k) => { const f = on4.facings[k]; return f.aura != null && f.aura < f.hero && (f.weapon == null || f.aura < f.weapon); }), JSON.stringify(Object.fromEntries(Object.entries(on4.facings).map(([k, f]) => [k, { aura: f.aura, weapon: f.weapon, hero: f.hero }]))));
  check('after a spell at 0 the aura fades in from nothing (no jump on the first frame back)', on4.fadeIn1 != null && on4.fadeIn1 < 0.15 && on4.fadeIn2 > on4.fadeIn1, JSON.stringify({ first: on4.fadeIn1, second: on4.fadeIn2 }));
  check('a hit at full knocks the aura out at once and it returns; the break shows none', on4.hit.level === 0 && on4.hit.shield < 400 && on4.afterHit.level > 0 && on4.brk.level === 0 && !on4.brk.visible, JSON.stringify({ hit: on4.hit, afterHit: on4.afterHit, brk: on4.brk }));
  const R = on4.r5;
  check('behind the hero (depth below the sprite), never on a sprite cell, motes from a pool of at most four, redrawn at most every 40 ms', on4.depth.aura < on4.depth.hero && R.inside === 0 && R.motes > 3 && R.motesPeak <= 4 && R.draws <= Math.ceil(R.frames * 1.01) + 1, JSON.stringify({ depth: on4.depth, inside: R.inside, motes: R.motes, motesPeak: R.motesPeak, draws: R.draws, frames: R.frames, ring1: R.ring1, ring2: R.ring2 }));
  // per-tick display identity, sampled through a hook on the trace (the render runs each tick)
  const fightHash = async (flags) => {
    const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 } }); const p = await boot(flags, { q: Q_MIXED, god: false, ctx });
    const r = await p.evaluate(() => {
      const gs = window.__gs; window.__headless = false;
      const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; return h; };
      const f = (v) => Math.round(v * 100) / 100; const hs = []; let aura = 0;
      const adv0 = window.__adv;
      let tk = 0; window.__adv = (n = 1, dt) => { for (let i = 0; i < n; i++) { if (tk++ % 120 === 0) gs.player.shieldHp = 400; adv0(1, dt); let s = ''; for (const o of gs.children.list) { if (!o.visible) continue; if (o.name === 'b2r5-aura') { aura++; continue; } s += `${o.type}:${o.texture?.key ?? ''}:${o.frame?.name ?? ''}:${f(o.x)},${f(o.y)}:${f(o.alpha)}:${o.depth};`; } hs.push(fnv(s)); } };
      const t0 = performance.now();
      window.__trace({ seed: 9071, ticks: 600, seg: [[0, 200, 'D'], [200, 400, 'W'], [400, 9999, 'A']], hold: [[20, 300], [340, 600]], superTaps: [150, 450], melee: [250, 275] });
      const sk = gs._b2.stats.feel.skin;
      return { hs, aura, ms: performance.now() - t0, r5: JSON.parse(JSON.stringify(sk.r5 || null)), sync: { ...sk.r3.shield.sync }, upd: gs._b2.stats.feel.updMs / Math.max(1, gs._b2.stats.feel.updN), objs: gs.children.list.length };
    });
    await ctx.close(); return r;
  };
  const fc = await fightHash(M.CTRL.flags), fa = await fightHash(M.C.flags);
  const d = firstDiff(fc.hs, fa.hs);
  check('a rendered fight (MIXED s6, god mode off, the shield topped to 400 every 120 ticks on both sides, two Supers, a Broken Wings chain, moving): every object on screen other than the aura identical to the R4 control at every rendered tick (the aura covers, moves and recolours nothing)', d < 0 && fa.hs.length === 600 && fa.aura > 0, d < 0 ? `600 ticks; aura shown on ${fa.aura} ticks` : `first different tick ${d}`);
  check('the aura in sync with the hero at every render (position, scale, alpha incl. a bush, depth below the sprite and the rifle)', fa.r5.sync.checks > 50 && fa.r5.sync.bad === 0 && fa.sync.bad === 0, JSON.stringify({ aura: fa.r5.sync, shield: fa.sync }));
  check('cost: the skin\'s per-frame update with the aura stays bounded (under 1.5 ms mean in this software-rendered harness) and the display list does not grow', fa.upd < 1.5 && fa.objs === fc.objs + 1, `update ${fc.upd.toFixed(3)} ms (R4) vs ${fa.upd.toFixed(3)} ms (aura) per frame; display objects ${fc.objs} vs ${fa.objs}; wall time ${fc.ms.toFixed(0)} vs ${fa.ms.toFixed(0)} ms for 600 rendered ticks; aura draws ${fa.r5.draws}`);
}

// ── 5. RESTARTS ──────────────────────────────────────────────────────────
const restartCheck = async (flags, label) => {
  const p = await boot(flags); await prep(p);
  const r = await p.evaluate(async () => {
    const gs = window.__gs, own = (o, k) => Object.prototype.hasOwnProperty.call(o, k), out = {};
    const FXm = await window.__mod(/systems\/FX\.js/);
    const sfxWrapped = () => Object.keys(FXm.SFX).filter((k) => typeof FXm.SFX[k] === 'function' && /Math\.random = iso|stats\.audio|stats\.superBeeps|voice\?\.hitTick|=> \{\}/.test(FXm.SFX[k].toString())).length;
    out.sfxInGame = sfxWrapped();
    const state = () => ({ skin: !!gs._b2?.stats.feel?.skin, pre: window.game.events.listeners('prerender').length, blast: gs.events.listeners('player-super-blast').length, b0: !!gs._b0 });
    const use = () => { window.__stage(); window.__ring(2, 280, 0, 0.5); window.__fire(30, 0.5); window.__super(); window.__adv(30); return { rounds: gs._b2.stats.feel.skin.rounds, supers: gs._b2.stats.feel.skin.supers }; };
    const restart = () => { gs.scene.restart({ mode: 'endless', seed: 4242 }); window.__adv(3); for (let i = 0; i < 400 && !gs.roomSpec; i++) window.__adv(1); window.__adv(20); };
    out.label = window.__dbg.getB0Label?.() ?? null;
    out.first = state(); out.use1 = use();
    restart(); out.second = state(); out.use2 = use();
    restart(); out.third = state(); out.use3 = use();
    // every shipped object the cloak hid is a one-shot: gone two seconds later
    window.__adv(150); out.hiddenLeft = gs.children.list.filter((o) => o.visible === false && o.depth >= 34 && o.depth <= 36 && (o.type === 'Graphics' || o.texture?.key === 'muzzle')).length;
    gs.scene.stop('HUD'); gs.scene.start('Title'); window.__adv(5);
    out.title = { sfx: sfxWrapped(), b2: !!gs._b2, pre: window.game.events.listeners('prerender').length, own: ['firePlayerSuper', '_superBlast'].filter((k) => own(gs, k)), dl: !!gs.sys.displayList && own(gs.sys.displayList, 'add'), flash: !!gs.cameras?.main && own(gs.cameras.main, 'flash'), atlas: Object.keys(window.game.textures.list).some((k) => /^b2r-/.test(k)) };
    return out;
  });
  await p.close();
  const same = (a, b) => a.skin && b.skin && a.pre === b.pre && a.blast === b.blast;
  check(`${label}restart twice: one install each time (prerender and blast listeners do not grow), the skin draws rounds and a Super after each, and no hidden shipped blast object is left two seconds later`, same(r.first, r.second) && same(r.second, r.third) && [r.use1, r.use2, r.use3].every((u) => u.rounds >= 4 && u.supers === 1) && r.hiddenLeft === 0, JSON.stringify([r.first, r.second, r.third, r.use3, { hiddenLeft: r.hiddenLeft }]));
  check(`${label}quit to title: no B2, the prerender listener gone, no firePlayerSuper / _superBlast / display-list / camera-flash wrapper left behind, every SFX function the original again (${r.sfxInGame} were wrapped in play)`, !r.title.b2 && r.title.pre === r.first.pre - 1 && r.title.own.length === 0 && !r.title.dl && !r.title.flash && r.title.sfx === 0, JSON.stringify(r.title));
  return r;
};
if (on(5)) {
  console.log('\n== 5. restarts');
  for (const k of ['D', 'E']) await restartCheck(M[k].flags, `${k} (${M[k].kind} + aura): `);
  const p = await boot(M.D.flags); await prep(p);
  const r = await p.evaluate(() => {
    const gs = window.__gs, count = () => gs.children.list.filter((o) => o.name === 'b2r5-aura').length, out = { counts: [] };
    const restart = () => { gs.scene.restart({ mode: 'endless', seed: 4242 }); window.__adv(3); for (let i = 0; i < 400 && !gs.roomSpec; i++) window.__adv(1); window.__adv(20); };
    out.counts.push(count()); restart(); out.counts.push(count()); restart(); out.counts.push(count());
    gs.scene.stop('HUD'); gs.scene.start('Title'); window.__adv(5); out.title = count();
    return out;
  });
  await p.close();
  check('one aura object per run across restarts, none after quitting to the title', r.counts.every((c) => c === 1) && r.title === 0, JSON.stringify(r));
  for (const k of ['B2S', 'B2HC', 'B2RD']) {
    const q = await boot(join(R4, `b2a=${k}`), { audio: true }); await prep(q);
    const z = await q.evaluate(() => { const gs = window.__gs, v = gs._b2.voice; window.__stage(); window.__ring(2, 260, 0, 0.5); window.__super(); window.__adv(90); const built = !!v.stats.super; gs.scene.stop('HUD'); gs.scene.start('Title'); window.__adv(5); return { built, cut: v.stats.superChainCut ?? null }; });
    await q.close();
    check(`${k}: quitting to the title disconnects the Super bus chain (live audio, the kit built)`, z.built && z.cut === (k === 'B2S' ? 2 : 4), JSON.stringify(z));
  }
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
  const a = await runFight(join(B, 'b0=B2B'), Q_MIXED, { supers: [300, 700, 1100, 1400], melee: [500, 525, 550] }), b = await runFight(join(M.D.flags, 'b0=R5AUHC'), Q_MIXED, { supers: [300, 700, 1100, 1400], melee: [500, 525, 550] });
  const d = firstDiff(a.hashes, b.hashes);
  check('links B2B and D (R5AUHC) as shipped: the same fight tick for tick', d < 0 && b.m.label === 'R5AUHC', d < 0 ? `${b.shots} rounds, ${b.supers} Supers` : `first divergent tick ${d}`);
}

// ── 7. AUDIO-RNG ISOLATION ───────────────────────────────────────────────
if (on(7)) {
  console.log('\n== 7. audio-RNG isolation with the new kits');
  const o = { supers: [300, 700, 1100, 1400], melee: [500, 525, 550], kill: [1200], god: false };
  const silent = await runFight(join(M.D.flags, 'b2c=1'), Q_MIXED, o);
  for (const k of ['D', 'E']) {
    const live = await runFight(join(M[k].flags, 'b2c=1'), Q_MIXED, { ...o, audio: true });
    const d = firstDiff(silent.hashes, live.hashes);
    check(`${k} with live audio and isolation = the silent run tick for tick (four Supers, a Broken Wings chain, a death; the music loop is not running in this harness and is not isolated)`, d < 0 && live.supers === 4, d < 0 ? `${live.draws} draws` : `first divergent tick ${d}`);
  }
}

// ── 9. SCOPE ─────────────────────────────────────────────────────────────
if (on(9)) {
  console.log('\n== 9. scope');
  const s = b0Scope(new URL('..', import.meta.url).pathname);
  check('the B0 / B1 / B2 scope guard (GameScene and every frozen file untouched)', s.ok, s.detail);
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
if (bad.length) { console.log('FAILED:'); bad.forEach((x) => console.log(`  - ${x.name}`)); process.exit(1); }
