// B2-R4 (`&b2r=4`, audio `&b2a=B2S`, `&b2iso=1`) — the final polish over B2-R3 (systems/b2Reactor.js
// level 4, systems/b2Audio.js kit B2S, the audio-RNG isolation in systems/b2Flagship.js). R3 stays
// under `&b2r=3`, Audio B2 under `&b2a=B2`. Standalone, against the dev server on :5173.
//
//   0  FLAGS: levels 1..4, audio A/B/B2/B2S, `b2iso`; nothing without `?b2=`
//   1  PIXELS ONLY: B2-R4 + B2S + b2iso = B2-B tick for tick (silent harness), three fights and
//      with &b2c=1; the only objects hidden are the shipped shield-absorb rings
//   2  THE TRACER INVARIANT     3  THE GUN (+ the discharge frame keeps the rifle's silhouette)
//   4  THE ROUND (no ribbon)    5  FRAMES at 60 / 30 fps
//   6  THE SUPER: = B2-B per tick except the named recolour (muzzle / explosion textures; the
//      disc, cone and ring colours): objects, frames, particles, pellets, camera flashes, damage;
//      both pops recoloured, no yellow or orange left, a non-Super explosion untouched;
//      THE WIND-UP by events: only wind-up frames between player-fire-super and
//      player-super-blast, the discharge from the blast tick (tap, held-F release, B2-1 press;
//      R3 as the failing control); a death in the wind-up ends the hold
//   7  RESTARTS (+ every SFX function back to the original after a quit)
//   8  COST     9  SCOPE    10  THE SHIPPED LINKS
//  11  R3 vs R4: every round sprite identical (R4 changes no round)
//  12  RANGE EXPIRY            13  HOW A ROUND ENDS
//  14  THE SHIELD: every quarter at least as bright as R3 (drawn rects and alpha), the keyline
//      glow at full and three quarters only, nothing outside the silhouette, four facings,
//      sync through a whole rendered fight, hit, break, bush, values = B2-B
//  15  AUDIO: B2S keeps B2's approved cues (offline renders within the renderer's own noise);
//      the Super's phases (compression cut by the discharge, five zips, merged / spaced / capped
//      impacts within 150 ms, the decay); a pause or death cuts; the Super hit beep routed
//  16  THE CHOKED REACTOR      17  REAL INPUT
//  18  AUDIO-RNG ISOLATION: with live audio, isolated = the silent run tick for tick (Supers,
//      melee, a death); without it, it diverges (control)
//
// usage: node tests/smoke-b2r4.mjs [--only=0,6]
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
const T = join(VIS, 'b2=B', 'b2r=4', 'b2a=B2S', 'b2iso=1'), B = join(VIS, 'b2=B'), R3 = join(VIS, 'b2=B', 'b2r=3', 'b2a=B2'), R2 = join(VIS, 'b2=B', 'b2r=2', 'b2a=B');

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

// ── 0. FLAGS ──────────────────────────────────────────────────────────────
if (on(0)) {
  console.log('\n== 0. flags');
  for (const [fl, want, aud, iso] of [['b2r=4&b2a=B2S&b2iso=1', 0, null, false], [B, 0, null, false], [join(VIS, 'b2=B', 'b2r=3', 'b2a=B2'), 3, 'B2', false], [join(VIS, 'b2=B', 'b2r=4'), 4, null, false], [T, 4, 'B2S', true], [join(VIS, 'b2=B', 'b2r=4', 'b2a=B2', 'b2iso=1'), 4, 'B2', true], [join(VIS, 'b2=B', 'b2a=B2S'), 0, 'B2S', false], [join(VIS, 'b2=B', 'b2iso=1'), 0, null, true], [join(VIS, 'b2=A', 'b2r=4'), 4, null, false]]) {
    const p = await boot(fl);
    const r = await p.evaluate(() => { const gs = window.__gs; return { lvl: window.__dbg.isB2Reactor(), aud: window.__dbg.getB2Audio(), iso: window.__dbg.isB2AudioIso(), b2: !!gs._b2, skin: gs._b2?.stats.feel?.skin?.name ?? null, r4: !!gs._b2?.stats.feel?.skin?.r4, voice: gs._b2?.voice?.kind ?? (gs._b2 ? 'b2-1' : null), wrapped: gs._b2?.stats?.audioIso ?? 0 }; });
    await p.close();
    const wantSkin = { 4: 'reactor4', 3: 'reactor3', 2: 'reactor2', 1: 'reactor' }[want] || null;
    const b2 = /b2=/.test(fl);
    check(`"${fl}": skin ${wantSkin || 'none'}, audio ${aud || (b2 ? 'B2-1 kit' : 'none')}, isolation ${b2 && iso ? 'on' : 'off'}`, (r.skin ?? null) === (b2 ? wantSkin : null) && r.r4 === (b2 && want === 4) && (b2 ? r.voice === (aud || 'b2-1') : r.voice === null) && (r.wrapped > 0) === (b2 && iso), JSON.stringify(r));
  }
}

// ── 1. PIXELS ONLY ───────────────────────────────────────────────────────
if (on(1)) {
  console.log('\n== 1. pixels only: the same fight');
  // each run in its own browser context: the game persists progress in localStorage, and a
  // run that follows another page's saved state is not the same run
  const run = async (flags, q, o = {}) => { const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 } }); const p = await boot(flags, { q, god: o.god ?? true, ctx }); const r = await p.evaluate((x) => window.__trace(x), { seed: 9071, ticks: 1500, seg: FIGHT_SEG, hold: HOLD, superTaps: o.supers ?? [], melee: o.melee ?? [] }); const t = await p.evaluate(() => window.__gs._b2.stats.feel.skin || null); const ls = await p.evaluate(() => Object.keys(localStorage)); await ctx.close(); return { ...r, t, ls }; };
  for (const [label, q, god] of [['MIXED s6', Q_MIXED, true], ['SWARM TIDE', Q_SWARM, true], ['MIXED s6, god mode off', Q_MIXED, false]]) {
    const o = { god, supers: [300, 700, 1100, 1400], melee: [500, 525, 550] };
    const a = await run(B, q, o), b = await run(T, q, o);
    const d = firstDiff(a.hashes, b.hashes);
    check(`${label}: 1500 ticks, held stream + FOUR Supers + a Broken Wings chain — B2-R4 + audio B2S + isolation = B2-B tick for tick (state, ammo, meters, every enemy, bolt and pellet, Math.random draws, events)`, d < 0 && b.shots > 100 && b.supers === 4 && b.t.supers >= 3 && b.t.cloak.calls === (b.t.r3?.shield?.ringsHidden ?? -1),
      d < 0 ? `${b.shots} rounds, ${b.supers} Supers, ${b.kills} kills, ${b.draws} draws; hidden: only the shipped cyan shield-absorb rings (${b.t.cloak.calls} cloak calls = ${b.t.r3?.shield?.ringsHidden} rings), nothing of the Super` : `first divergent tick ${d} (draws ${a.draws} vs ${b.draws})`);
  }
  const a = await run(join(B, 'b2c=1'), Q_MIXED, { supers: [300, 700, 1100], melee: [500, 525, 550] }), b = await run(join(T, 'b2c=1'), Q_MIXED, { supers: [300, 700, 1100], melee: [500, 525, 550] });
  const d = firstDiff(a.hashes, b.hashes);
  check('with the closure candidate on both sides (&b2c=1, F-release Supers): B2-R4 = B2-B tick for tick (KNOWN INTERMITTENT, inherited: the &b2c=1 fight alone is not repeatable about 1 run in 11, a wave banner lands a tick late at tick 741; see docs/evidence/b2-reactor/README.md)', d < 0 && b.supers === 3, d < 0 ? `${b.shots} rounds, ${b.supers} Supers; localStorage keys written by a run: ${b.ls.join(', ') || 'none'}` : `first divergent tick ${d}`);
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

// ── 2. THE TRACER INVARIANT ──────────────────────────────────────────────
if (on(2)) {
  console.log('\n== 2. the tracer invariant under the skin');
  const p = await boot(T); await prep(p);
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player; window.__stage();
    const sp = window.__spots(240, 3) || [];
    sp.forEach((q) => window.__dummy('grunt', q.x, q.y, 130));
    window.__fire(110, 0.6);                               // kills, then the stream runs on into empty space and walls
    for (const a of [0, 1.57, 3.14, -1.57, 0.8, -2.3]) { P.facing = a; P.aim = a; window.__fire(26, 1); window.__adv(14); }
    window.__super(); window.__adv(40);
    const inv = gs._b2.stats.feel.inv;
    return { checks: inv.checks, bad: inv.bad, samples: inv.samples.slice(0, 2), stale: gs._b2.stats.feel.staleContacts, kills: gs.runKills, rounds: window.__ts().rounds, drawn: window.__ts().drawn };
  });
  await p.close();
  check('every visible REACTOR bolt, every frame: on its round\'s line, never behind the barrel, its head at the collider, a finished bolt ending where its round stopped (kills, blank space in six directions, walls, a Super)', r.checks > 800 && r.bad === 0 && r.rounds > 35, JSON.stringify(r));
  check('...and the sprite itself, read back from its own crop and position, shows exactly that segment', r.drawn.checks > 800 && r.drawn.bad === 0, JSON.stringify(r.drawn));
}

// ── 3. THE GUN ───────────────────────────────────────────────────────────
if (on(3)) {
  console.log('\n== 3. the gun');
  const p = await boot(T); await prep(p);
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, out = { stages: [] }; window.__stage(); window.__headless = false;
    const tex = window.game.textures.get(window.__gs._b2.stats.feel.skin.key), cv = tex.getSourceImage(), c2 = cv.getContext('2d');
    const hexAt = (f, ax, ay, g = 4) => { const fr = tex.frames[f]; const d = c2.getImageData(fr.cutX + ax * g + 1, fr.cutY + ay * g + 1, 1, 1).data; return d[3] ? '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('') : null; };
    const base = window.game.textures.get('p1-rifle').getSourceImage(); const cb = document.createElement('canvas'); cb.width = 72; cb.height = 40; const c3 = cb.getContext('2d'); c3.drawImage(base, 0, 0);
    const baseAt = (ax, ay) => { const d = c3.getImageData(ax * 4 + 1, ay * 4 + 1, 1, 1).data; return d[3] ? '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('') : null; };
    for (const c of [0, 0.12, 0.35, 0.55, 0.7, 0.95, 1]) { window.__charge(c); window.__adv(12); const g = window.__ts().gun; out.stages.push([c, g.n, g.stage, g.frame, g.shown]); }
    // the silhouette and the outline of every gun frame are the approved sprite's
    out.silhouette = Object.keys(tex.frames).filter((f) => /^gun-/.test(f)).every((f) => { for (let y = 0; y < 10; y++) for (let x = 0; x < 18; x++) { const a = baseAt(x, y), b = hexAt(f, x, y); if ((a == null) !== (b == null)) return false; if (a === '#06070a' && b !== a) return false; } return true; });
    out.heatInside = [0, 1, 2, 3].every((i) => { for (let y = 0; y < 10; y++) for (let x = 0; x < 18; x++) { const b = hexAt(`heat-${i}`, x, y); if (b && (baseAt(x, y) == null || baseAt(x, y) === '#06070a')) return false; } return true; });
    out.gunFrames = Object.keys(tex.frames).filter((f) => /^gun-/.test(f)).length;
    { const t3 = window.game.textures.get('b2r3'), c3x = t3.getSourceImage().getContext('2d'); const at3 = (f, ax, ay) => { const fr = t3.frames[f]; const d = c3x.getImageData(fr.cutX + ax * 4 + 1, fr.cutY + ay * 4 + 1, 1, 1).data; return d[3] ? '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('') : null; };
      out.choked = ['gun-8s', 'gun-8sf', 'gun-dis'].every((f) => { if (!t3.frames[f]) return false; for (let y = 0; y < 10; y++) for (let x = 0; x < 18; x++) { const a = baseAt(x, y), b = at3(f, x, y); if ((a == null) !== (b == null)) return false; if (a === '#06070a' && b !== a) return false; } return true; }); }
    out.fullLamp = hexAt('gun-8', 7, 4); out.fullDeep = hexAt('gun-8', 13, 5); out.q1Lamp = hexAt('gun-0', 10, 1); out.q3Lamp = hexAt('gun-6', 9, 4);
    out.swirl = []; for (const c of [0.5, 0.8, 1]) { window.__charge(c); window.__adv(6); out.swirl.push(window.__ts().gun.swirl ? window.__ts().gun.swirl.slice(0, 2) : null); }
    // the overlay sits on the weapon in every rendered frame: a turn, then a stream (the kick)
    window.__charge(0.7); const s0 = { ...window.__ts().sync };
    for (let i = 0; i < 40; i++) { P.facing += 0.17; P.superCharge = 2.8; window.__adv(1); }
    window.__fire(40, 0.7);
    const s1 = window.__ts().sync; out.sync = { checks: s1.checks - s0.checks, bad: s1.bad - s0.bad };
    const v = gs._p2a.loadout.view; out.viewKey = v.texture.key;
    // ignite: a new lamp
    const ig0 = window.__ts().ignites; window.__charge(0.72); window.__adv(1); window.__charge(0.81); window.__adv(2); out.igniteFrame = window.__ts().gun.frame; out.ignites = window.__ts().ignites - ig0; window.__adv(10); out.settled = window.__ts().gun.frame;
    // mid-combo the weapon is the blade: no gun overlay
    window.__charge(0.7); P.meleeCharge = 99; P.tryMeleeCombo(); window.__adv(5); out.combo = { key: v.texture.key, shown: window.__ts().gun.shown, mine: window.__mine().filter((o) => /^gun|^heat|^sw|^sh/.test(o.frame.name)).length };
    for (let i = 0; i < 200 && P._meleeAnimT > 0; i++) window.__adv(1);
    window.__adv(20);
    // dead: nothing
    window.__dbg.setGodMode(false); P.damage(99999); window.__adv(6); out.dead = { alive: P.alive, shown: window.__ts().gun.shown, mine: window.__mine().filter((o) => /^gun|^heat|^sw|^sh/.test(o.frame.name)).length };
    return out;
  });
  await p.close();
  const want = [[0, 2, 0], [0.12, 2, 0], [0.35, 4, 1], [0.55, 6, 2], [0.7, 7, 2], [0.95, 9, 3], [1, 10, 4]];
  check('the reactor per charge: a violet core at 0 (2 channels lit), then 4 / 6 / 7 / 9 channels through magenta, crimson and scarlet, FULL = all 10 in red; the threads orbit from three quarters (one, slow) and at FULL (two)', r.stages.every((q, i) => q[1] === want[i][1] && q[2] === want[i][2]) && r.stages[0][3] === 'gun-0' && r.stages[0][4] === true && /^gun-8/.test(r.stages[6][3]) && r.stages[3][3] === 'gun-4' && r.swirl.join() === ',sh,sw', JSON.stringify([r.stages, r.swirl]));
  check('every gun frame keeps the approved rifle\'s silhouette and outline, the spent-barrel pixels stay inside it, and so do the two choked frames and the R4 discharge frame', r.silhouette && r.heatInside && r.gunFrames >= 30 && r.choked, JSON.stringify({ frames: r.gunFrames, silhouette: r.silhouette, heatInside: r.heatInside, choked: r.choked }));
  check('the palette: a violet lens and core at 0 (#b98cff), scarlet channels at three quarters (#ff4030), and at FULL a hot highlight on the core (#ffd9a0) over dark ruby (#7a0a14)', r.fullLamp === '#ffd9a0' && r.fullDeep === '#7a0a14' && r.q1Lamp === '#b98cff' && r.q3Lamp === '#ff4030', JSON.stringify([r.q1Lamp, r.q3Lamp, r.fullLamp, r.fullDeep]));
  check('the overlay is on the weapon in every rendered frame of a turn and a stream (position, rotation, flip, origin, alpha)', r.sync.checks >= 70 && r.sync.bad === 0 && /^p1-rifle/.test(r.viewKey), JSON.stringify(r.sync));
  check('a new lamp ignites (one white frame set), then settles', r.ignites >= 1 && r.igniteFrame === 'gun-6i' && /^gun-6t?$/.test(r.settled), JSON.stringify([r.ignites, r.igniteFrame, r.settled]));
  check('mid-combo (the blade) and dead: no gun overlay', r.combo.key === 'p1-blade' && !r.combo.shown && r.combo.mine === 0 && !r.dead.alive && !r.dead.shown && r.dead.mine === 0, JSON.stringify([r.combo, r.dead]));
}

// ── 4. THE R2 ROUND ──────────────────────────────────────────────────────
if (on(4)) {
  console.log('\n== 4. the R2 round');
  const p = await boot(T); await prep(p);
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, out = { by: {} }; window.__stage();
    const sk = gs._b2.stats.feel.skin, tex = window.game.textures.get('b2r2');
    out.sizes = [...new Set(Object.keys(tex.frames).filter((f) => /^slug-/.test(f)).map((f) => `${tex.frames[f].width}x${tex.frames[f].height}`))];
    let bad = 0, seen = 0;
    const scan = () => { for (const o of gs.children.list.filter((q) => q.visible && /^b2r/.test(q.texture?.key || ''))) { seen++; if (o.blendMode !== 0 || o.scaleX !== 1 || o.scaleY !== 1 || o.alpha !== 1) bad++; } };
    for (const c of [0, 0.5, 1]) {
      const names = new Set(); P.facing = 0; P.aim = 0; gs.cursors.space.isDown = true;
      for (let i = 0; i < 30; i++) { P.superCharge = c * 4; window.__adv(1); scan(); for (const o of gs.children.list) if (o.visible && o.texture?.key === 'b2r2' && /^slug-/.test(o.frame.name)) names.add(o.frame.name); }
      gs.cursors.space.isDown = false; window.__adv(40); out.by[c] = [...names];
    }
    out.bad = bad; out.seen = seen; out.links = sk.r2.links.drawn;
    out.ribs = gs.children.list.filter((o) => o.texture?.key === 'b2r2' && /^(rib|rglow)-/.test(o.frame?.name || '')).length;
    return out;
  });
  await p.close();
  check('one slug size (78x15: a 20 px body and a 6 px tapering tail, no hard rear edge) at every stage', r.sizes.length === 1 && r.sizes[0] === '78x15', JSON.stringify(r.sizes));
  check('every R4 object in a stream: NORMAL blend, scale 1, opaque (the stream is cropped, never scaled)', r.seen > 200 && r.bad === 0, JSON.stringify({ seen: r.seen, bad: r.bad }));
  check('the round by stage: violet at 0, crimson at 50%, critical red at FULL (R2\'s slug); and NO ribbon: no link drawn, no ribbon sprite ever created', r.by[0].join() === 'slug-0' && r.by[0.5].join() === 'slug-2' && r.by[1].join() === 'slug-4' && r.links === 0 && r.ribs === 0, JSON.stringify([r.by, r.links, r.ribs]));
}

// ── 5. FRAMES ────────────────────────────────────────────────────────────
if (on(5)) {
  console.log('\n== 5. frames');
  for (const [fps, dt] of [[60, 1000 / 60], [30, 1000 / 30]]) {
    const p = await boot(T); await prep(p);
    const r = await p.evaluate((dt) => {
      const gs = window.__gs; window.__stage();
      const sp = window.__spots(220, 2) || []; sp.forEach((q) => window.__dummy('grunt', q.x, q.y));
      window.__fire(Math.round(3000 / dt), 0.4, dt); for (let i = 0; i < 20; i++) window.__adv(1, dt);
      const t = window.__ts();
      return { flashes: t.flashes, hits: t.hits, mz: t.frameSeen.mz, hit: t.frameSeen.hit, shots: gs._b2.stats.shots };
    }, dt);
    await p.close();
    const per = fps === 60 ? 2 : 1;
    check(`${fps} fps: every round gets a muzzle flash and every flash shows all three frames (${per} tick${per > 1 ? 's' : ''} each), frame 0 never skipped`, r.flashes === r.shots && r.shots > 20 && r.mz.every((n) => n === r.flashes * per), JSON.stringify(r));
    check(`${fps} fps: every contact shows its first frame, and the later frames follow`, r.hits > 15 && r.hit[0] >= r.hits && r.hit[1] >= r.hits && r.hit[3] >= r.hits * 0.9, JSON.stringify({ hits: r.hits, hit: r.hit }));
  }
}

// ── 6. THE SUPER: B2-B's, with the muzzle discharge in the reactor's reds ─
if (on(6)) {
  console.log("\n== 6. the Super");
  const castLog = async (flags) => {
    const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 } });
    const p = await boot(flags, { ctx });
    const r = await p.evaluate(() => {
      const gs = window.__gs, P = gs.player; window.__stage(); window.__headless = false;
      window.__ring(5, 230, -1.2, 0.25);
      const cam = gs.cameras.main, flashes = [];
      const f0 = cam.flash; cam.flash = function (...a) { flashes.push(`${window.__ti}:${a.slice(0, 4).join(',')}`); return f0.apply(this, a); };
      const dl = gs.sys.displayList, made = [];
      const add0 = dl.add; dl.add = function (c, ...r) { made.push(c); return add0.call(this, c, ...r); };
      const emitters = gs.children.list.filter((o) => typeof o.emitParticleAt === 'function');
      const mine = (o) => /^b2|^p1-|^p2a/.test(o.texture?.key || '');
      // THE ALLOW-LIST: R4 swaps these two textures for its red copies (same frames); everything else must match
      const key = (o) => ({ 'muzzle-r4': 'muzzle', 'explosion-r4': 'explosion' })[o.texture?.key] ?? (o.texture?.key ?? '');
      const sig = (o) => `${o.type}:${key(o)}/${o.frame?.name ?? ''}@${Math.round(o.x)},${Math.round(o.y)} a${(o.alpha ?? 1).toFixed(2)} s${(o.scaleX ?? 1).toFixed(2)} v${o.visible ? 1 : 0}`;
      const out = [], wind = [], heat = []; let red = 0, orig = 0;
      P.superCharge = 4; gs.events.emit('player-super-changed'); window.__adv(5);
      for (let i = 0; i < 90; i++) {
        window.__ti = i;
        if (i === 2) gs.input.keyboard.emit('keydown-F', { repeat: false });
        if (i === 4) gs.input.keyboard.emit('keyup-F', { repeat: false });
        window.__adv(1);
        const sk = gs._b2.stats.feel.skin; wind.push(sk?.gun.frame ?? null); heat.push(sk?.gun.heat ?? null);
        for (const o of made) if (o.active !== false && o.scene && o.visible) { if (o.texture?.key === 'explosion-r4' || o.texture?.key === 'muzzle-r4') red++; if (o.texture?.key === 'explosion' || o.texture?.key === 'muzzle') orig++; }
        out.push({
          objs: made.filter((o) => o.active !== false && o.scene && !mine(o)).map(sig).sort().join(';'),
          parts: emitters.map((e) => e.alive.filter((q) => q.x < 1e5).map((q) => `${Math.round(q.x)},${Math.round(q.y)},${q.alpha.toFixed(2)}`).join(' ')).join('|'),
          pel: gs.playerSuperBullets.getChildren().filter((b) => b.active).map((b) => `${Math.round(b.x)},${Math.round(b.y)},v${b.visible ? 1 : 0},${b.texture.key}`).join(' '),
          vis: made.filter((o) => o.visible && o.scene && !mine(o)).length,
        });
      }
      // a non-Super explosion afterwards keeps the shipped sheet
      const before = made.length; gs.fx.explosion(P.x + 140, P.y + 90, 1.2); const other = made.slice(before).find((o) => o.type === 'Sprite');
      const sk = gs._b2.stats.feel.skin;
      return { out, flashes, cloak: sk ? sk.cloak : null, wind: [...new Set(wind)], heat: [...new Set(heat)], hp: gs.enemies.getChildren().filter((e) => e.active).map((e) => Math.round(e.hp)).join(','), red, orig, other: other?.texture?.key ?? null, r4: sk?.r4 ? JSON.parse(JSON.stringify(sk.r4)) : null };
    });
    await ctx.close();
    return r;
  };
  for (const c of ['', 'b2c=1']) {
    const b = await castLog(join(B, c)), t = await castLog(join(T, c)), r3 = await castLog(join(R3, c));
    const same = (x) => x.out.filter((q, i) => q.objs === b.out[i].objs && q.parts === b.out[i].parts && q.pel === b.out[i].pel).length;
    const visB = b.out.reduce((n, q) => n + q.vis, 0), visT = t.out.reduce((n, q) => n + q.vis, 0);
    check(`${c || 'B2-1 F press'}: every object the cast creates (texture names mapped back for the two recoloured sheets), every frame index, emitter particle and pellet = B2-B on all 90 ticks; the same camera flashes and damage`, same(t) === 90 && JSON.stringify(t.flashes) === JSON.stringify(b.flashes) && t.hp === b.hp && visT === visB && visB > 100,
      `same ticks ${same(t)}/90; visible shipped objects ${visT} (B2-B ${visB}); flashes ${JSON.stringify(t.flashes)}`);
    check(`${c || 'B2-1 F press'}: B2-R3 still equals B2-B with no mapping at all (R3 unchanged)`, same(r3) === 90 && JSON.stringify(r3.flashes) === JSON.stringify(b.flashes) && r3.red === 0, `R3 same ticks ${same(r3)}/90, red-sheet objects ${r3.red}`);
    check(`${c || 'B2-1 F press'}: R4 draws the Super's discharge only from the red sheets (both pops, the bloom), with no yellow or orange pixel left in the fireball; the disc, cone and ring drawn in mapped colours; a later non-Super explosion keeps the shipped sheet`, t.red > 0 && t.orig === 0 && t.r4.fireball.pops === 2 && t.r4.fireball.swapped === 2 && t.r4.fireball.images === 1 && t.r4.fireball.graphics === 3 && Object.keys(t.r4.fire.keptExplosion).length === 0 && t.other === 'explosion' && b.other === 'explosion', JSON.stringify({ red: t.red, orig: t.orig, fireball: t.r4.fireball, kept: t.r4.fire.keptExplosion, other: t.other }));
  }
  // THE WIND-UP, by events (tap, held-F release, the B2-1 press); R3 as the failing control
  const wind = async (flags, mode, die = false) => {
    const p = await boot(join(VIS, 'b2=B', flags), { god: die ? false : true });
    const r = await p.evaluate(({ mode, die }) => {
      const gs = window.__gs, P = gs.player, kb = gs.input.keyboard; window.__stage(); window.__headless = false; window.__ring(4, 230, -1, 0.3);
      let ti = 0, castT = -1, blastT = -1; gs.events.on('player-fire-super', () => { castT = ti; }); gs.events.on('player-super-blast', () => { blastT = ti; });
      P.superCharge = 4; gs.events.emit('player-super-changed'); window.__adv(5);
      const frames = [];
      for (let i = 0; i < 160; i++) {
        ti = i;
        if (mode === 'tap') { if (i === 3) kb.emit('keydown-F', { repeat: false }); if (i === 5) kb.emit('keyup-F', {}); }
        if (mode === 'hold') { if (i === 1) kb.emit('keydown-F', { repeat: false }); if (i === 14) kb.emit('keyup-F', {}); }
        if (mode === 'press') { if (i === 3) kb.emit('keydown-F', { repeat: false }); if (i === 4) kb.emit('keyup-F', {}); }
        if (die && castT >= 0 && i === castT + 2) P.damage(99999);
        window.__adv(1);
        frames.push(gs._b2.stats.feel.skin.gun.frame);
      }
      return { castT, blastT, frames, alive: P.alive };
    }, { mode, die });
    await p.close();
    return { ...r, between: r.castT >= 0 && r.blastT > r.castT ? r.frames.slice(r.castT, r.blastT) : [], after: r.blastT >= 0 ? r.frames.slice(r.blastT, r.blastT + 4) : [] };
  };
  for (const [fl, mode] of [['b2c=1', 'tap'], ['b2c=1', 'hold'], ['', 'press']]) {
    const t4 = await wind(join('b2r=4', fl), mode), t3 = await wind(join('b2r=3', fl), mode);
    check(`wind-up (${mode}): R4 shows only the compressed reactor between player-fire-super and player-super-blast, the discharge from the blast tick, then the cooling; the blast tick is R3's`, t4.between.length >= 4 && t4.between.every((f) => /^gun-w[01]$/.test(f)) && t4.after[0] === 'gun-dis' && t4.after[1] === 'gun-dis' && /^gun-[0-7]/.test(t4.after[2] || '') && t4.blastT === t3.blastT && t4.castT === t3.castT,
      JSON.stringify({ r4: { cast: t4.castT, blast: t4.blastT, between: t4.between, after: t4.after } }));
    check(`wind-up (${mode}): control — R3 shows the empty reactor before the blast`, t3.between.some((f) => /^gun-0/.test(f)), JSON.stringify({ r3: t3.between }));
  }
  const d4 = await wind(join('b2r=4', 'b2c=1'), 'tap', true);
  check('a death between the cast and the blast ends the wind-up hold (no held frame afterwards, alive or not)', !d4.frames.slice(d4.castT + 3).some((f) => /^gun-w/.test(f || '')), JSON.stringify({ cast: d4.castT, blast: d4.blastT, after: [...new Set(d4.frames.slice(d4.castT + 3))] }));
}

// the F-release candidate stays independent: no reactor wind-up on keydown or after a cancelled hold
if (on(6)) {
  const p = await boot(join(T, 'b2c=1')); await prep(p);
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, kb = gs.input.keyboard, out = {}; window.__stage(); window.__ring(2, 300, -0.3, 0.6);
    const ts = () => gs._b2.stats.feel.skin; const seen = (n) => { const f = []; for (let i = 0; i < n; i++) { window.__adv(1); f.push(ts().gun.frame); } return f; };
    P.superCharge = 4; window.__adv(5);
    kb.emit('keydown-F', { repeat: false }); const held = seen(40); out.held = { wind: held.some((f) => /^gun-w/.test(f || '')), supers: ts().supers, phase: gs._b2.superInput.state.phase };
    window.dispatchEvent(new Event('blur')); const after = seen(20); kb.emit('keyup-F', {}); const after2 = seen(12);
    out.cancel = { wind: [...after, ...after2].some((f) => /^gun-w/.test(f || '')), supers: ts().supers };
    P.superCharge = 4; window.__adv(3); kb.emit('keydown-F', { repeat: false }); seen(30); kb.emit('keyup-F', {}); const rel = seen(10);
    out.release = { wind: rel.some((f) => /^gun-w/.test(f || '')), supers: ts().supers };
    return out;
  });
  await p.close();
  check('with &b2c=1: a held F plays no wind-up; a cancelled hold plays none; it plays on the release, with the cast', !r.held.wind && r.held.supers === 0 && r.held.phase === 'targeting' && !r.cancel.wind && r.cancel.supers === 0 && r.release.wind && r.release.supers === 1, JSON.stringify(r));
}

// ── 7. RESTARTS ──────────────────────────────────────────────────────────
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
if (on(7)) {
  console.log('\n== 7. restarts');
  await restartCheck(T, '');
}

// ── 8. COST ──────────────────────────────────────────────────────────────
if (on(8)) {
  console.log('\n== 8. cost');
  const run = async (flags) => { const p = await boot(flags, { q: Q_SWARM }); const r = await p.evaluate((x) => { const tr = window.__trace(x); const f = window.__gs._b2.stats.feel; return { shots: tr.shots, updMs: f.updMs / Math.max(1, f.updN), updMax: f.updMax, peakB2: f.peakObjects, peakT: f.skin?.peak ?? 0, madeT: f.skin?.made ?? 0, peakRounds: f.peakRounds, list: window.__gs.children.list.length }; }, { seed: 9071, ticks: 1200, seg: FIGHT_SEG, hold: [[30, 1200]], superTaps: [400, 800], melee: [] }); await p.close(); return r; };
  const b = await run(B), t = await run(T), r2 = await run(R2);
  check('B2-R3 stays bounded: fewer pooled objects at peak than B2-R2 in a SWARM TIDE fight (no ribbon links, no Super masses), and the same rounds fired', t.peakT > 0 && t.peakT < r2.peakT && t.shots === b.shots && r2.shots === b.shots, `peak pooled objects: B2-B ${b.peakB2}, B2-R2 ${r2.peakT}, B2-R3 ${t.peakT} (${t.madeT} ever created); update B2-B ${b.updMs.toFixed(3)}ms, B2-R2 ${r2.updMs.toFixed(3)}ms, B2-R3 ${t.updMs.toFixed(3)}ms per frame (max ${b.updMax.toFixed(2)} / ${r2.updMax.toFixed(2)} / ${t.updMax.toFixed(2)}); peak live rounds ${t.peakRounds}`);
}

// ── 10. THE SHIPPED LINKS (with the B0 telemetry label) ──────────────────
if (on(10)) {
  console.log('\n== 10. the playtest links, as shipped (&b0=...)');
  const TL = join(T, 'b0=B2R3B2'), BL = join(B, 'b0=B2B');
  const run = async (flags) => { const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 } }); const p = await boot(flags, { q: Q_MIXED, ctx }); const r = await p.evaluate((x) => window.__trace(x), { seed: 9071, ticks: 1500, seg: FIGHT_SEG, hold: HOLD, superTaps: [300, 700, 1100, 1400], melee: [500, 525, 550] }); const m = await p.evaluate(() => ({ b0: !!window.__gs._b0, label: window.__dbg.getB0Label(), skin: !!window.__gs._b2.stats.feel.skin })); await ctx.close(); return { ...r, m }; };
  const a = await run(BL), b = await run(TL);
  const d = firstDiff(a.hashes, b.hashes);
  check('the two links as shipped (B0 telemetry on, labels B2B / B2R3B2): the same fight tick for tick, telemetry attached on both, the skin only on the candidate', d < 0 && a.m.b0 && b.m.b0 && a.m.label === 'B2B' && b.m.label === 'B2R3B2' && !a.m.skin && b.m.skin && b.supers === 4, d < 0 ? `${b.shots} rounds, ${b.supers} Supers, ${b.kills} kills, ${b.draws} draws` : `first divergent tick ${d}`);
  const r = await restartCheck(TL, 'the candidate link: ');
  for (const [lvl, k] of [[3, 'B2'], [3, 'B'], [2, 'B']]) await restartCheck(join(VIS, 'b2=B', `b2r=${lvl}`, `b2a=${k}`, 'b2c=1', `b0=B2R${lvl}${k}`), `the playtest link (R${lvl}, audio ${k}, b2c): `);
  check('the candidate link keeps its telemetry through the restarts', r.first.b0 && r.second.b0 && r.third.b0 && r.label === 'B2R3B2', JSON.stringify({ label: r.label }));
}

// R2 helpers (in page): a clear lane, the fire stick, per-frame continuity
const r2prep = (p) => p.evaluate(() => {
  const gs = window.__gs, P = gs.player;
  window.__stick = (a, on = true) => { const fs = window.game.scene.getScene('HUD').fireStick; fs.active = on; fs.vec = { x: Math.cos(a), y: Math.sin(a), force: on ? 1 : 0, angle: a }; };
  window.__lane = (len = 540, want = null, only = null) => {
    const los = gs.losRects || [], bd = gs.roomSpec?.bounds ?? { w: 1600, h: 1600 };
    // the bodies bullets actually stop on (GameScene.handleBulletWallHits)
    const walls = (gs.walls?.getChildren?.() || []).map((w) => { const b = w.body; return b ? { x: b.x, y: b.y, right: b.x + b.width, bottom: b.y + b.height } : null; }).filter(Boolean);
    const rects = want === 'wall' ? walls : [...los, ...walls];
    const hitAt = (x1, y1, a, L) => { for (let k = 0; k <= 60; k++) { const x = x1 + Math.cos(a) * L * k / 60, y = y1 + Math.sin(a) * L * k / 60; if (want !== 'wall' && (x < 90 || y < 130 || x > bd.w - 90 || y > bd.h - 90)) return k / 60; const m = want === 'wall' ? -6 : 26; if (rects.some((r) => x > r.x - m && x < r.right + m && y > r.y - m && y < r.bottom + m)) return k / 60; } return 2; };
    for (const a of (only != null ? [only] : [-Math.PI / 4, -3 * Math.PI / 4, Math.PI / 4, 3 * Math.PI / 4, 0, Math.PI])) for (let y = 300; y <= bd.h - 200; y += 40) for (let x = 200; x <= bd.w - 200; x += 40) {
      if ([...los, ...walls].some((r) => x > r.x - 40 && x < r.right + 40 && y > r.y - 40 && y < r.bottom + 40)) continue;
      const h = hitAt(x, y, a, len);
      if (want === 'clear' && h === 2) return { x, y, a };
      if (want === 'wall' && h > 0.25 && h < 0.6) return { x, y, a };
    }
    return null;
  };
  window.__put = (q) => { P.x = q.x; P.y = q.y; P.body.reset(q.x, q.y); };
});

// ── 11. R3 vs R4: no round changes ───────────────────────────────────────
if (on(11)) {
  console.log('\n== 11. R3 vs R4: every round sprite identical');
  const run = async (flags) => {
    const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 } });
    const p = await boot(flags, { ctx }); await r2prep(p);
    const r = await p.evaluate(() => {
      const gs = window.__gs, P = gs.player; window.__stage(); window.__headless = false;
      const sp = window.__spots(260, 3) || []; sp.forEach((q) => window.__dummy('grunt', q.x, q.y, 1e6));
      const RE = /^(slug|sglow|dis|wall)-|^mz|^hit-/, RIB = /^(rib|rglow)-/;
      const out = []; let rib = 0, rounds = 0;
      for (let i = 0; i < 420; i++) {
        const a = Math.floor(i / 23) * 1.9 + (i % 23 < 4 ? 0 : 0.02 * (i % 23));       // abrupt flicks every 23 ticks
        window.__stick(a, (i % 70) < 60);
        gs.keys.W.isDown = (Math.floor(i / 40) & 1) === 0; gs.keys.S.isDown = !gs.keys.W.isDown;
        if (i % 90 === 45) P.tryDash?.();
        P.superCharge = i < 140 ? 0 : i < 280 ? 2.1 : 4;
        if (i === 300) { gs.input.keyboard.emit('keydown-F', { repeat: false }); gs.input.keyboard.emit('keyup-F', { repeat: false }); }
        window.__adv(1);
        const vis = gs.children.list.filter((o) => o.visible && o.texture && /^b2r/.test(o.texture.key));
        rib += vis.filter((o) => RIB.test(o.frame.name)).length;
        const L = vis.filter((o) => RE.test(o.frame.name)).map((o) => `${o.frame.name}|${o.isCropped ? `${o._crop.x.toFixed(2)},${o._crop.width.toFixed(2)}` : '-'}|${o.x.toFixed(2)},${o.y.toFixed(2)}|${o.rotation.toFixed(4)}|${o.alpha.toFixed(2)}|${o.depth.toFixed(2)}`).sort();
        rounds += L.filter((q) => q.startsWith('slug-')).length;
        out.push(L.join(';'));
      }
      window.__stick(0, false); gs.keys.W.isDown = gs.keys.S.isDown = false;
      const sk = gs._b2.stats.feel.skin;
      return { out, rib, rounds, links: sk.r2.links.drawn, dis: sk.r2.dis, ends: sk.r2.ends, inv: gs._b2.stats.feel.inv, drawn: sk.drawn };
    });
    await ctx.close();
    return r;
  };
  const a = await run(R3), b = await run(T);
  let same = 0, first = -1; for (let i = 0; i < a.out.length; i++) { if (a.out[i] === b.out[i]) same++; else if (first < 0) first = i; }
  check('R3 vs R4, same seed, 420 ticks of moving manual fire with abrupt flicks, dashes, walls, expiries and a Super: every slug, glow, muzzle, contact and dissipation sprite identical per tick (frame, active crop, position, rotation, alpha, depth)', same === a.out.length && b.rounds > 600, `identical ${same}/${a.out.length}, first diff ${first}; slug sprites drawn ${b.rounds}; dissipation frames ${JSON.stringify(b.dis)} (R3 ${JSON.stringify(a.dis)})`);
  check('...and neither draws a ribbon', b.rib === 0 && b.links === 0 && a.rib === 0 && a.links === 0, `ribbon sprites R3 ${a.rib} / R4 ${b.rib}`);
  check('every round keeps its own straight path under flicks, strafing and dashes (the tracer invariant 0 violations; slug and glow sprites read back exactly)', b.inv.checks > 600 && b.inv.bad === 0 && b.drawn.bad === 0, JSON.stringify({ inv: { checks: b.inv.checks, bad: b.inv.bad }, drawn: b.drawn }));
}

// ── 12. RANGE EXPIRY ─────────────────────────────────────────────────────
if (on(12)) {
  console.log('\n== 12. range expiry');
  for (const [fps, dt] of [[60, 1000 / 60], [30, 1000 / 30]]) {
    const p = await boot(T); await prep(p); await r2prep(p);
    const r = await p.evaluate((dt) => {
      const gs = window.__gs, P = gs.player, K = gs.keys, sk = gs._b2.stats.feel.skin, f = gs._b2.stats.feel;
      window.__stage(); window.__headless = false;
      const lane = window.__lane(540, 'clear'); window.__put(lane);
      // record every player bullet's death: where and how far it had travelled
      const deaths = []; const g = gs.playerBullets; const proto = g.classType.prototype, k0 = proto.kill;
      proto.kill = function (...a) { if (this.active && g.contains(this)) deaths.push({ trav: this.traveled, range: this.range }); return k0.apply(this, a); };
      const e0 = { ...f.ends }, d0 = [...sk.r2.dis];
      // steady fire, then a strafe, then stop and let the last rounds expire
      for (let i = 0; i < Math.round(2400 / dt); i++) { window.__stick(lane.a, true); K.D.isDown = i > Math.round(1200 / dt); window.__adv(1, dt); }
      K.D.isDown = false; window.__stick(lane.a, false);
      for (let i = 0; i < Math.round(900 / dt); i++) window.__adv(1, dt);
      const exp = (f.ends.expire || 0) - (e0.expire || 0);
      const dis = sk.r2.dis.map((n, i) => n - d0[i]);
      const expired = deaths.filter((d) => d.trav >= d.range);
      proto.kill = k0;
      return { exp, dis, deaths: deaths.length, expiredDeaths: expired.length, overshoot: Math.max(0, ...expired.map((d) => d.trav - d.range)), lane, live: g.getChildren().filter((b) => b.active).length };
    }, dt);
    await p.close();
    const per = fps === 60 ? 1 : 1;
    check(`${fps} fps: every range expiry (B2 classifies it from Bullet.traveled >= range at the kill) plays the dissipation, every frame of it, frame 0 included`, r.exp >= 12 && r.exp === r.expiredDeaths && r.dis.every((n) => n >= r.exp * per), JSON.stringify(r));
    check(`${fps} fps: the dissipation is visual only: the round itself dies where Bullet.preUpdate kills it (no extra travel), and no bullet stays active after`, r.deaths >= r.exp && r.live === 0 && r.overshoot < 40, JSON.stringify({ deaths: r.deaths, overshoot: r.overshoot, live: r.live }));
  }
}

if (on(12)) {
  const p = await boot(T); await prep(p); await r2prep(p);
  const r = await p.evaluate(() => {
    const gs = window.__gs, sk = gs._b2.stats.feel.skin, f = gs._b2.stats.feel, out = [];
    for (const deg of [-90, -45, 0, 45, 90, 135, 180, -135]) {
      const a = (deg * Math.PI) / 180;
      window.__stage(); window.__headless = false;
      const lane = window.__lane(540, 'clear', a);
      if (!lane) { out.push({ deg, lane: false }); continue; }
      window.__put(lane);
      const e0 = f.ends.expire || 0, d0 = sk.r2.dis[3];
      for (let i = 0; i < 40; i++) { window.__stick(a, true); window.__adv(1); } window.__stick(a, false); window.__adv(50);
      out.push({ deg, exp: (f.ends.expire || 0) - e0, dis: sk.r2.dis[3] - d0 });
    }
    return out;
  });
  await p.close();
  const tested = r.filter((q) => q.lane !== false);
  check('range expiry in every direction with a clear lane in the room (N, NE, E, SE, S, SW, W, NW): each expiry plays the dissipation to its last frame', tested.length >= 6 && tested.every((q) => q.exp >= 3 && q.dis >= q.exp), JSON.stringify(r));
}

// ── 13. HOW A ROUND ENDS ─────────────────────────────────────────────────
if (on(13)) {
  console.log('\n== 13. how a round ends: distinct outcomes');
  const p = await boot(T); await prep(p); await r2prep(p);
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, sk = gs._b2.stats.feel.skin, f = gs._b2.stats.feel, out = {};
    window.__stage(); window.__headless = false;
    const snap = () => ({ ends: { ...f.ends }, dis: sk.r2.dis[0], wall: sk.r2.wall[0], hit: sk.frameSeen.hit[0] });
    const diff = (a, b) => ({ hit: (b.ends.hit || 0) - (a.ends.hit || 0), wall: (b.ends.wall || 0) - (a.ends.wall || 0), expire: (b.ends.expire || 0) - (a.ends.expire || 0), cancel: (b.ends.cancel || 0) - (a.ends.cancel || 0), disF: b.dis - a.dis, wallF: b.wall - a.wall, hitF: b.hit - a.hit });
    // a wall
    let lane = window.__lane(540, 'wall'); out.lane = lane; window.__put(lane); let s0 = snap();
    for (let i = 0; i < 60; i++) { window.__stick(lane.a); window.__adv(1); } window.__stick(0, false); window.__adv(40); out.wall = diff(s0, snap());
    // a body
    window.__stage(); lane = window.__lane(540, 'clear'); window.__put(lane);
    window.__dummy('grunt', lane.x + Math.cos(lane.a) * 200, lane.y + Math.sin(lane.a) * 200); s0 = snap();
    for (let i = 0; i < 60; i++) { window.__stick(lane.a); window.__adv(1); } window.__stick(0, false); window.__adv(40); out.hit = diff(s0, snap());
    // cancelled mid-flight (a room clear)
    window.__stage(); window.__put(lane); s0 = snap();
    for (let i = 0; i < 20; i++) { window.__stick(lane.a); window.__adv(1); } window.__stick(0, false); window.__clear(); window.__adv(40); out.cancel = diff(s0, snap());
    out.walls = (gs.walls?.getChildren?.() || []).slice(0, 4).map((w) => w.body ? [w.body.x, w.body.y, w.body.width, w.body.height, w.body.enable] : null);
    return out;
  });
  await p.close();
  check('a wall: the rounds end as wall contacts and draw the wall flare, not the dissipation and not the body splash', r.wall.wall >= 8 && r.wall.wallF >= r.wall.wall && r.wall.disF === 0 && r.wall.expire === 0, JSON.stringify({ ...r.wall, lane: r.lane, walls: r.walls }));
  check('a body: the rounds end as hits and draw the contact splash, not the dissipation', r.hit.hit >= 8 && r.hit.hitF >= r.hit.hit && r.hit.disF === 0, JSON.stringify(r.hit));
  check('cancelled in flight: the rounds end as cancels with neither a dissipation nor a splash', r.cancel.cancel > 0 && r.cancel.disF === 0 && r.cancel.expire === 0, JSON.stringify(r.cancel));
}

// ── 14. THE SHIELD ON THE ARMOUR ─────────────────────────────────────────
if (on(14)) {
  console.log('\n== 14. the shield on the armour');
  const probe = async (flags) => {
    const p = await boot(flags, { god: false }); await prep(p);
    const r = await p.evaluate(() => {
      const gs = window.__gs, P = gs.player, sk = gs._b2.stats.feel.skin, out = {};
      window.__stage(); window.__headless = false;
      const seen = { shield: 0, ring: 0, plates: 0, cyanRing: 0, frames: 0 };
      const onPre = () => {
        seen.frames++; if (P.shieldRing.visible) seen.shield++;
        const p1 = gs._p1Player; if (p1 && [p1.ring, p1.ticks, p1.gauge].some((o) => o?.visible)) seen.ring++;
        seen.plates += gs.children.list.filter((o) => o.visible && o.texture?.key === 'b2r2' && /^plate/.test(o.frame?.name || '')).length;
      };
      window.game.events.on('prerender', onPre);
      // the shipped cyan absorb ring: count the visible ones
      const ir = gs.fx.impactRing; let rings = 0;
      const dl = gs.sys.displayList, add0 = dl.add; const made = [];
      dl.add = function (c, ...r) { made.push(c); return add0.call(this, c, ...r); };
      const face = (a) => { const K = gs.keys; const dir = Math.round((((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 2)) % 4; K.D.isDown = dir === 0; K.S.isDown = dir === 1; K.A.isDown = dir === 2; K.W.isDown = dir === 3; window.__adv(3); K.D.isDown = K.S.isDown = K.A.isDown = K.W.isDown = false; window.__adv(12); };
      P.addShield(400); P.superCharge = 4; gs.events.emit('player-super-changed'); window.__adv(20);   // full: B2-B shows its ring (control)
      const S = () => sk?.r3?.shield;
      out.facings = {};
      for (const [nm, a] of [['S', Math.PI / 2], ['N', -Math.PI / 2], ['E', 0], ['W', Math.PI]]) {
        face(a);
        out.facings[nm] = { frame: P.frame.name, flip: P.flipX, visible: !!S() && gs.children.list.some((o) => o.type === 'Graphics' && o.visible && Math.abs(o.x - P.x) < 0.01 && Math.abs(o.y - P.y) < 0.01 && o.depth > P.depth && o.depth < P.depth + 0.05) };
      }
      out.frames = S()?.frames ?? null;
      // what the overlay draws at each value: rects, mean alpha, keyline rects, bounds (the last redraw only)
      face(Math.PI / 2);
      const ov = gs.children.list.find((o) => o.type === 'Graphics' && Math.abs(o.x - P.x) < 0.01 && Math.abs(o.y - P.y) < 0.01 && o.depth > P.depth && o.depth < P.depth + 0.05);
      out.levels = {};
      if (ov) {
        let rec = [], cur = [0, 0];
        const fs0 = ov.fillStyle, fr0 = ov.fillRect, cl0 = ov.clear;
        ov.clear = function (...a) { rec = []; return cl0.apply(this, a); };
        ov.fillStyle = function (c, a) { cur = [c, a]; return fs0.call(this, c, a); };
        ov.fillRect = function (x, y, w, h) { rec.push([cur[0], cur[1], x, y, w, h]); return fr0.call(this, x, y, w, h); };
        const dox = P.displayOriginX, doy = P.displayOriginY, W2 = P.frame.width - dox, H2 = P.frame.height - doy;
        for (const hp of [400, 300, 200, 100]) {
          P.shieldHp = hp; window.__adv(2);
          const edge = rec.filter((r) => r[0] !== 0x3cbedc);
          out.levels[hp] = { n: edge.length, alpha: +(edge.reduce((s2, r) => s2 + r[1], 0) / Math.max(1, edge.length)).toFixed(3), key: rec.length - edge.length, outside: rec.filter((r) => r[2] < -dox - 0.01 || r[3] < -doy - 0.01 || r[2] + r[4] > W2 + 0.01 || r[3] + r[5] > H2 + 0.01).length };
        }
        ov.clear = cl0; ov.fillStyle = fs0; ov.fillRect = fr0;
      }
      // partial quarters, then a hit from the west (the shot travels east), then the break
      const b0 = S() ? [...S().bands] : null;
      for (const hp of [300, 200, 100]) { P.shieldHp = hp; window.__adv(4); }
      out.bands = S() ? S().bands.map((n, i) => n - b0[i]) : null;
      P.shieldHp = 400; window.__adv(4);
      const m0 = made.length, hp0 = P.hp;
      P.damage(100, 0); window.__adv(1);
      out.cyanRings = made.slice(m0).filter((o) => o.type === 'Graphics' && o.visible).length;
      window.__adv(8);
      out.afterHit = { shield: P.shieldHp, hp: P.hp - hp0, hits: S()?.hits ?? null, sided: S()?.sided ?? null };
      P.damage(500, Math.PI); window.__adv(14);
      out.afterBreak = { shield: P.shieldHp, hp: P.hp - hp0, breaks: S()?.breaks ?? null, shards: S()?.shards ?? null };
      // bush alpha
      // the bush flag is recomputed every frame: hold it for the frames measured
      P.hp = P.hpMax; P.addShield(400); window.__adv(30); for (let i = 0; i < 3; i++) { P.hiddenInBush = true; window.__adv(1); }
      out.bush = { alpha: S()?.alpha ?? null, sprite: P.alpha };
      window.__adv(2);
      // dead: nothing drawn
      P.damage(99999); window.__adv(4);
      out.dead = { alive: P.alive, overlay: gs.children.list.some((o) => o.type === 'Graphics' && o.visible && Math.abs(o.x - P.x) < 0.01 && Math.abs(o.y - P.y) < 0.01 && o.depth > P.depth && o.depth < P.depth + 0.05) };
      dl.add = add0; void ir; void rings;
      window.game.events.off('prerender', onPre);
      out.seen = seen; out.sync = S()?.sync ?? null; out.ringsHidden = S()?.ringsHidden ?? null; out.rims = S()?.rims ?? null;
      return out;
    });
    await p.close();
    return r;
  };
  const t = await probe(T), b = await probe(B), r2 = await probe(R2), r3 = await probe(R3);
  check('no shield bubble, no spiked ready ring, no gauge and no corner plates are ever on screen under B2-R4; B2-B shows the bubble and the ring, B2-R2 the plates (controls)', t.seen.ring === 0 && t.seen.shield === 0 && t.seen.plates === 0 && b.seen.ring > 0 && b.seen.shield > 0 && r2.seen.plates > 0, JSON.stringify({ r3: t.seen, b2b: b.seen, r2: r2.seen }));
  check('the shield is on the armour edge on every facing (S, N, E, W — the side frame flipped for W), read from the frame the sprite shows, drawn just over the hero', ['S', 'N', 'E', 'W'].every((k) => t.facings[k].visible) && t.facings.W.flip !== t.facings.E.flip && t.frames >= 3 && t.rims >= 12, JSON.stringify({ facings: t.facings, frames: t.frames, rims: t.rims }));
  check('the overlay is in sync with the sprite at every render (position, scale, alpha, frame, flip)', t.sync.checks > 60 && t.sync.bad === 0, JSON.stringify(t.sync));
  const L4 = t.levels, L3 = r3.levels, Q = [400, 300, 200, 100];
  check('R4 is at least as bright as R3 at every shield value (as many lit edge cells, their mean alpha >= R3\'s), the keyline glow only at full and three quarters (stronger at full), nothing drawn outside the sprite\'s frame', Q.every((q) => L4[q] && L3[q] && L4[q].n >= L3[q].n && L4[q].alpha >= L3[q].alpha - 1e-9 && L4[q].outside === 0) && L4[400].key > 0 && L4[300].key > 0 && L4[200].key === 0 && L4[100].key === 0 && L3[400].key === 0,
    JSON.stringify({ r4: L4, r3: L3 }));
  check('partial charge reads in quarters (3, 2, 1 lit) and the bush alpha is the sprite\'s', t.bands[3] > 0 && t.bands[2] > 0 && t.bands[1] > 0 && t.bush.alpha === t.bush.sprite && t.bush.sprite < 1, JSON.stringify({ bands: t.bands, bush: t.bush }));
  check('an absorbed hit shimmers on the side it came from, the shipped cyan ring is hidden (it still runs), the last point breaks with shards; dead, nothing drawn', t.afterHit.hits >= 1 && t.afterHit.sided > 0 && t.cyanRings === 0 && b.cyanRings > 0 && t.ringsHidden >= 1 && t.afterBreak.breaks === 1 && t.afterBreak.shards > 0 && !t.dead.alive && !t.dead.overlay, JSON.stringify({ hit: t.afterHit, rings: { r3: t.cyanRings, b2b: b.cyanRings, hidden: t.ringsHidden }, brk: t.afterBreak, dead: t.dead }));
  // a whole rendered fight: wave-clear shields, Broken Wings, Supers, dashes and hits
  {
    const p = await boot(T, { q: Q_MIXED, god: false });
    const f = await p.evaluate((x) => { window.__headless = false; window.__trace(x); const S = window.__gs._b2.stats.feel.skin.r3.shield; return { sync: S.sync, drawn: S.drawn, hits: S.hits, breaks: S.breaks, frames: S.frames }; }, { seed: 9071, ticks: 1500, seg: FIGHT_SEG, hold: HOLD, superTaps: [300, 700, 1100, 1400], melee: [500, 525, 550] });
    await p.close();
    check('through a whole rendered fight (MIXED s6, god mode off: wave-clear shields, Broken Wings, four Supers, hits) the armour shield is read back in sync with the sprite at every render', f.sync.checks > 200 && f.sync.bad === 0 && f.drawn > 200, JSON.stringify(f));
  }
  check('shield and health take exactly what B2-B takes (a hit and the break)', t.afterHit.shield === b.afterHit.shield && t.afterHit.hp === b.afterHit.hp && t.afterBreak.shield === b.afterBreak.shield && t.afterBreak.hp === b.afterBreak.hp, JSON.stringify({ r3: [t.afterHit, t.afterBreak], b2b: [b.afterHit, b.afterBreak] }));
}

// ── 15. AUDIO: B2 (control) AND B2S ──────────────────────────────────────
if (on(15)) {
  console.log('\n== 15. audio');
  const fsm = await import('fs');
  const src = fsm.readFileSync(new URL('../src/systems/b2Audio.js', import.meta.url), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  check('b2Audio.js draws no Math.random (private mulberry32 streams only)', !/Math\.random/.test(src), '');
  for (const k of ['B2', 'B2S']) {
    const p = await boot(join(VIS, 'b2=B', 'b2r=4', `b2a=${k}`, 'b2iso=1', 'b2c=1')); await prep(p);
    const r = await p.evaluate(() => {
      const gs = window.__gs, P = gs.player, kb = gs.input.keyboard, v = gs._b2.voice, out = {}; window.__stage();
      window.__ring(5, 230, -1.2, 0.25);
      const ev = (n) => v.stats.events[n] || 0;
      gs.cursors.space.isDown = true; for (let i = 0; i < 240; i++) { P.superCharge = Math.max(P.superCharge, Math.min(4, i / 50)); window.__adv(1); } gs.cursors.space.isDown = false;
      out.atFull = ev('confirm'); window.__adv(120); out.stillFull = ev('confirm');
      kb.emit('keydown-F', { repeat: false }); for (let i = 0; i < 50; i++) { gs.keys.D.isDown = i > 10; window.__adv(1); } gs.keys.D.isDown = false;
      out.locks = ev('lock'); kb.emit('keyup-F', {}); window.__adv(90);
      out.events = { ...v.stats.events }; out.kind = v.kind; out.beeps = gs._b2.stats.superBeeps || 0; out.shipped = gs._b2.stats.audio || 0;
      return out;
    });
    await p.close();
    const e = r.events;
    check(`audio ${k}: shot, impact, stages, the ready confirmation once, locks, wind-up, release and Super hits fire; the shipped Super shot replaced`, r.kind === k && e.shot > 20 && e.stage >= 3 && r.atFull === 1 && r.stillFull === 1 && r.locks >= 1 && e.windup === 1 && e.release === 1 && e.superHit >= 1 && r.shipped >= 1, JSON.stringify({ events: e, atFull: r.atFull }));
    if (k === 'B2S') check('audio B2S: the game\'s generic hit beep is not played for Super pellet hits (routed to the kit\'s impacts)', r.beeps > 0 && e.superHit >= r.beeps, JSON.stringify({ beepsRouted: r.beeps, superHit: e.superHit }));
    else check('audio B2 (control): Super pellet hits still play the generic beep', r.beeps === 0, JSON.stringify({ beepsRouted: r.beeps }));
  }
  // offline renders (structure and identity; NOT a listening test)
  const p = await boot(B);
  const ren = await p.evaluate(async () => {
    const mod = await window.__mod(/systems\/b2Audio\.js/);
    const render = async (kind, withSuper, opts = {}) => {
      const SR = 44100, ctx = new OfflineAudioContext(1, SR * 14, SR), dest = ctx.createGain(); dest.connect(ctx.destination);
      let T = 0; const a = mod.createB2Audio(kind, { ctx, dest, now: () => T }); let n = 0;
      for (let tick = 0; tick < 60 * 13; tick++) {
        T = tick / 60; const s = T;
        const heat = s < 6 ? s / 6 : withSuper && s >= 9.12 && s < 10.4 ? 0.1 : 1, sup = s >= 10.6 && s < 11.6;
        const firing = (s > 0.5 && s < 2) || (s > 3 && s < 5.5) || (s > 9.6 && s < 10.3) || (s > 11 && s < 11.4);
        if (firing && tick % 6 === 0) { a.shot({ heat, n: n++, hot: false, late: 0 }); if (n % 3 === 0) a.hitTick(heat); }
        if (s >= 7 && s < 8.5 && tick % 30 === 0) a.lockTick(1 + Math.floor((s - 7) * 2));
        if (withSuper && tick === 540) a.windup();
        if (opts.pauseInWindup && tick === 543) a.silence();
        if (withSuper && tick === Math.round(60 * 9.12)) a.release();
        // twelve pellet hits over three ticks (a crowd), then two stragglers
        if (withSuper) { const r0 = Math.round(60 * 9.12) + 6; if (tick >= r0 && tick < r0 + 3) for (let i = 0; i < 4; i++) a.superHit(); if (tick === r0 + 20 || tick === r0 + 21) a.superHit(); }
        if (tick === 720) a.silence();
        a.update(1000 / 60, { heat, firing, suppressed: sup, dead: !!(opts.dieAt && tick >= opts.dieAt && tick < opts.dieAt + 30), sup });
      }
      const buf = await ctx.startRendering(); const d = buf.getChannelData(0); let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
      return { d, peak, stats: JSON.parse(JSON.stringify(a.stats)) };
    };
    const diff = (x, y) => { let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i] - y[i])); return m; };
    const b2a = await render('B2', false), b2b = await render('B2', false), b2s0 = await render('B2S', false);
    const s1 = await render('B2S', true), b21 = await render('B2', true), sp = await render('B2S', true, { pauseInWindup: true }), sd = await render('B2S', true, { dieAt: 548 });
    return { floor: diff(b2a.d, b2b.d), idNoSuper: diff(b2s0.d, b2a.d), s1: { peak: s1.peak, voices: s1.stats.peakVoices, dropped: s1.stats.dropped, sup: s1.stats.super }, b21: { peak: b21.peak, voices: b21.stats.peakVoices }, pause: sp.stats.super, death: sd.stats.super };
  });
  await p.close();
  check('B2S keeps B2\'s approved cues: rendered without a Super, B2S = B2 within the renderer\'s own run-to-run noise (B2 against itself), both far below audibility', ren.idNoSuper <= Math.max(1e-6, ren.floor * 4), JSON.stringify({ b2sVsB2: ren.idNoSuper, b2VsItself: ren.floor }));
  const S1 = ren.s1.sup;
  check('B2S Super phases: the compression is cut by the discharge, five zips, the crowd\'s twelve hits merged per tick and queued at least 40 ms apart, none more than 150 ms behind its hit, at most six impacts, a decay after each group of impacts; no clipping, nothing dropped, voices under the cap', S1.windups === 1 && S1.releases === 1 && S1.cuts >= 1 && S1.zips === 5 && S1.impacts >= 3 && S1.impacts <= 6 && S1.merged >= 8 && S1.minGap >= 0.0399 && S1.maxLag <= 0.15 && S1.decays >= 1 && ren.s1.peak < 0.95 && ren.s1.dropped === 0 && ren.s1.voices < 48, JSON.stringify(ren.s1));
  check('a pause in the wind-up cuts the compression; a death cuts it and the decay', ren.pause.cuts >= 1 && ren.death.deathCuts >= 1, JSON.stringify({ pause: ren.pause, death: ren.death }));
}

// ── 16. THE CHOKED REACTOR (full, but suppressed) ────────────────────────
if (on(16)) {
  console.log('\n== 16. the choked reactor');
  const probe = async (flags) => {
    const p = await boot(flags); await prep(p);
    const r = await p.evaluate(() => {
      const gs = window.__gs, P = gs.player, sk = () => gs._b2.stats.feel.skin, out = {}; window.__stage(); window.__headless = false;
      const watch = (n, fire) => { const f = new Set(), sw = new Set(); let arcs0 = sk().r2.arcs; gs.cursors.space.isDown = !!fire; for (let i = 0; i < n; i++) { P.superCharge = 4; window.__adv(1); f.add(sk().gun.frame); sw.add(sk().gun.swirl ? sk().gun.swirl.slice(0, 2) : null); } gs.cursors.space.isDown = false; return { frames: [...f], swirl: [...sw], arcs: sk().r2.arcs - arcs0 }; };
      window.__charge(1); P.facing = 0; out.ready = watch(60);
      P.facing = -Math.PI / 2; out.readyN = watch(40);
      P.facing = 0; P.suppress(3000); out.choked = watch(80); out.chokedFire = watch(60, true);
      P.clearSuppression(); out.back = watch(30);
      return out;
    });
    await p.close();
    return r;
  };
  const t = await probe(T), r2 = await probe(R2);
  const readyish = (f) => /^gun-8(p\d)?$/.test(f || '');
  check('full and available: the ready reactor (pressure pulse, two threads, armour arcs facing east and north)', t.ready.frames.some(readyish) && t.ready.swirl.includes('sw') && t.ready.arcs > 10 && t.readyN.arcs > 10, JSON.stringify({ ready: t.ready, north: t.readyN.arcs }));
  check('full but suppressed: only the choked frames (ruby, cold lens, clamp; a strain beat), no threads, no arcs — firing included (a shot never flashes "ready")', t.choked.frames.every((f) => /^gun-8sf?$/.test(f)) && t.choked.frames.includes('gun-8sf') && t.chokedFire.frames.every((f) => /^gun-8sf?$/.test(f)) && t.choked.swirl.every((x) => x === null) && t.choked.arcs === 0 && t.chokedFire.arcs === 0, JSON.stringify({ choked: t.choked, fire: t.chokedFire }));
  check('released: the ready pulse and threads return at once', t.back.frames.some(readyish) && t.back.swirl.includes('sw'), JSON.stringify(t.back));
  check('control: B2-R2 shows the ready reactor under the same suppression (the issue R3 addresses)', r2.choked.frames.some(readyish) && r2.choked.swirl.includes('sw'), JSON.stringify(r2.choked));
}

// ── 17. REAL INPUT ───────────────────────────────────────────────────────
if (on(17)) {
  console.log('\n== 17. real input paths');
  for (const mode of ['touch', 'keys', 'mouse']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: mode === 'touch', isMobile: mode === 'touch' });
    const p = await boot(T, { ctx });
    await p.evaluate(() => { window.__stage(); window.__headless = false; window.__adv(5); });
    const geo = await p.evaluate(() => { const r = window.game.canvas.getBoundingClientRect(); return { x: r.left, y: r.top, k: r.width / 720 }; });
    const scr = (vx, vy) => ({ x: geo.x + vx * geo.k, y: geo.y + vy * geo.k });
    const cdp = mode === 'touch' ? await ctx.newCDPSession(p) : null;
    const FL = [0, 2.5, -1.9, 0.7, 3.0, -0.8, 1.8, -2.6, 0.2, 2.1, -1.2, 2.9];
    const step = (n = 1) => p.evaluate((n) => window.__adv(n), n);
    const H = { x: 600, y: 1150 }, R = 80;
    if (mode === 'touch') {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...scr(H.x, H.y), id: 1 }] });
      for (let i = 0; i < 240; i++) { const a = FL[Math.floor(i / 20) % FL.length]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...scr(H.x + Math.cos(a) * R, H.y + Math.sin(a) * R), id: 1 }] }); await step(); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else if (mode === 'keys') {
      const D = ['KeyD', 'KeyS', 'KeyW', 'KeyA'];
      await p.keyboard.down('Space');
      for (let i = 0; i < 240; i++) { const k = D[Math.floor(i / 20) % 4]; if (i % 20 === 0) { for (const q of D) await p.keyboard.up(q); await p.keyboard.down(k); } await step(); }
      for (const q of D) await p.keyboard.up(q); await p.keyboard.up('Space');
    } else {
      const h = scr(H.x, H.y); await p.mouse.move(h.x, h.y); await p.mouse.down();
      for (let i = 0; i < 240; i++) { const a = FL[Math.floor(i / 20) % FL.length], q = scr(H.x + Math.cos(a) * R, H.y + Math.sin(a) * R); await p.mouse.move(q.x, q.y); await step(); }
      await p.mouse.up();
    }
    await step(40);
    const r = await p.evaluate(() => { const b = window.__gs._b2.stats, sk = b.feel.skin; return { shots: b.shots, touch: b.pressTouch, mouse: b.pressMouse, key: b.pressKey, inv: b.feel.inv.bad, checks: b.feel.inv.checks, drawnBad: sk.drawn.bad, links: sk.r2.links.drawn, ribs: window.__gs.children.list.filter((o) => /^(rib|rglow)-/.test(o.frame?.name || '')).length, dis: sk.r2.ends }; });
    await ctx.close();
    const via = { touch: r.touch > 0, keys: r.key > 0, mouse: r.mouse > 0 }[mode];
    check(`${mode}: the real input path fires (${mode === 'touch' ? 'CDP touch on the floating aim stick' : mode === 'keys' ? 'keyboard SPACE + WASD flicks' : 'the mouse dragging the aim stick'}), every round on its own path, no ribbon`, via && r.shots > 20 && r.inv === 0 && r.checks > 100 && r.drawnBad === 0 && r.links === 0 && r.ribs === 0, JSON.stringify(r));
  }
}

// ── 18. AUDIO-RNG ISOLATION (`&b2iso=1`) ─────────────────────────────────
if (on(18)) {
  console.log('\n== 18. audio-RNG isolation');
  const run = async (flags, audio) => {
    const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 } });
    const p = await boot(flags, { q: Q_MIXED, god: false, audio, ctx });
    const r = await p.evaluate(async (x) => {
      const FX = await window.__mod(/systems\/FX\.js/); let deaths = 0; window.__gs.events.on('player-dead', () => deaths++);
      const t = window.__trace(x);
      return { hashes: t.hashes, draws: t.draws, supers: t.supers, live: FX.__fxDebug().ctx?.state ?? 'none', music: FX.__fxDebug().musicStarted, deaths };
    }, { seed: 9071, ticks: 1500, seg: FIGHT_SEG, hold: HOLD, superTaps: [300, 700, 1100, 1400], melee: [500, 525, 550], kill: [1200] });
    await ctx.close();
    return r;
  };
  const RI = join(VIS, 'b2=B', 'b2c=1', 'b2r=4'), RS = join(RI, 'b2a=B2S');
  const silent = await run(join(RS, 'b2iso=1'), false), live = await run(join(RS, 'b2iso=1'), true), liveB2 = await run(join(RI, 'b2a=B2', 'b2iso=1'), true), liveOff = await run(RS, true), silentOff = await run(RS, false);
  check('with isolation and live audio (B2S, then B2), the fight is the silent one tick for tick: four Supers, a Broken Wings chain and a death; music not running in this harness (its timer loop is not isolated)', firstDiff(live.hashes, silent.hashes) < 0 && firstDiff(liveB2.hashes, silent.hashes) < 0 && live.live === 'running' && live.supers === 4 && live.deaths >= 1 && live.music === false, JSON.stringify({ live: { audio: live.live, draws: live.draws, deaths: live.deaths }, silent: { draws: silent.draws } }));
  check('control: without isolation, live audio moves the fight (and silently the flag changes nothing)', firstDiff(liveOff.hashes, silentOff.hashes) >= 0 && firstDiff(silent.hashes, silentOff.hashes) < 0, JSON.stringify({ liveOffDraws: liveOff.draws, firstDiff: firstDiff(liveOff.hashes, silentOff.hashes) }));
}

// ── 9. SCOPE ─────────────────────────────────────────────────────────────
if (on(9)) {
  console.log('\n== 9. scope');
  const s = b0Scope(new URL('..', import.meta.url).pathname);
  check('the B0 / B1 / B2 scope guard (b2Temper.js is one of B2\'s modules; GameScene and every frozen file untouched)', s.ok, s.detail);
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
if (bad.length) { console.log('FAILED:'); bad.forEach((x) => console.log(`  - ${x.name}`)); process.exit(1); }
