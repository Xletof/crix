// B2 REACTOR OVERLOAD (`&b2r=1`) — the second visual-language candidate over B2 (systems/b2Reactor.js).
// Standalone, against the dev server on :5173.
//
//   0  FLAGS: off by default, needs `?b2=`, installs the skin and its atlas
//   1  PIXELS ONLY: `?b2=B&b2r=1` = `?b2=B` tick for tick on the same build
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
//  10  THE SHIPPED LINKS: both playtest queries with their `&b0=` label
//
// usage: node tests/smoke-b2t.mjs [--only=0,3]
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
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const firstDiff = (a, b) => { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i; return -1; };
const join = (...a) => a.filter(Boolean).join('&');
const HOLD = [[60, 400], [460, 900], [960, 1500]];
const T = join(VIS, 'b2=B', 'b2r=1'), B = join(VIS, 'b2=B');

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
  for (const [fl, want] of [['b2r=1', false], [B, false], [T, true], [join(VIS, 'b2=A', 'b2r=1'), true], [join(VIS, 'b2=B', 'b2r=0'), false]]) {
    const p = await boot(fl);
    const r = await p.evaluate(() => { const gs = window.__gs; return { flag: window.__dbg.isB2Reactor(), b2: !!gs._b2, skin: !!gs._b2?.stats.feel?.skin, atlas: Object.keys(window.game.textures.list).some((k) => /^b2r-/.test(k)) }; });
    await p.close();
    check(`"${fl}": REACTOR ${want ? 'ON' : 'off'}`, !!r.flag === want && r.skin === want && r.atlas === want, JSON.stringify(r));
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
    check(`${label}: 1500 ticks, held stream + FOUR Supers + a Broken Wings chain — REACTOR = B2-B tick for tick (state, ammo, meters, every enemy, bolt and pellet, Math.random draws, events)`, d < 0 && b.shots > 100 && b.supers === 4 && b.t.supers >= 3 && b.t.cloak.objects > 0,
      d < 0 ? `${b.shots} rounds, ${b.supers} Supers, ${b.kills} kills, ${b.draws} draws; hidden: ${b.t.cloak.objects} objects, ${b.t.cloak.particles} particles in ${b.t.cloak.calls} calls` : `first divergent tick ${d} (draws ${a.draws} vs ${b.draws})`);
  }
  const a = await run(join(B, 'b2c=1'), Q_MIXED, { supers: [300, 700, 1100], melee: [500, 525, 550] }), b = await run(join(T, 'b2c=1'), Q_MIXED, { supers: [300, 700, 1100], melee: [500, 525, 550] });
  const d = firstDiff(a.hashes, b.hashes);
  check('with the closure candidate on both sides (&b2c=1, F-release Supers): REACTOR = no REACTOR tick for tick (KNOWN INTERMITTENT, inherited: the &b2c=1 fight alone is not repeatable about 1 run in 11, a wave banner lands a tick late at tick 741; see docs/evidence/b2-reactor/README.md)', d < 0 && b.supers === 3, d < 0 ? `${b.shots} rounds, ${b.supers} Supers; localStorage keys written by a run: ${b.ls.join(', ') || 'none'}` : `first divergent tick ${d}`);
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
  check('every gun frame keeps the approved rifle\'s silhouette and outline, and the spent-barrel pixels stay inside it', r.silhouette && r.heatInside && r.gunFrames >= 30, JSON.stringify({ frames: r.gunFrames, silhouette: r.silhouette, heatInside: r.heatInside }));
  check('the palette: a violet lens and core at 0 (#b98cff), scarlet channels at three quarters (#ff4030), and at FULL a hot highlight on the core (#ffd9a0) over dark ruby (#7a0a14)', r.fullLamp === '#ffd9a0' && r.fullDeep === '#7a0a14' && r.q1Lamp === '#b98cff' && r.q3Lamp === '#ff4030', JSON.stringify([r.q1Lamp, r.q3Lamp, r.fullLamp, r.fullDeep]));
  check('the overlay is on the weapon in every rendered frame of a turn and a stream (position, rotation, flip, origin, alpha)', r.sync.checks >= 70 && r.sync.bad === 0 && /^p1-rifle/.test(r.viewKey), JSON.stringify(r.sync));
  check('a new lamp ignites (one white frame set), then settles', r.ignites >= 1 && r.igniteFrame === 'gun-6i' && /^gun-6t?$/.test(r.settled), JSON.stringify([r.ignites, r.igniteFrame, r.settled]));
  check('mid-combo (the blade) and dead: no gun overlay', r.combo.key === 'p1-blade' && !r.combo.shown && r.combo.mine === 0 && !r.dead.alive && !r.dead.shown && r.dead.mine === 0, JSON.stringify([r.combo, r.dead]));
}

// ── 4. THE BOLT ──────────────────────────────────────────────────────────
if (on(4)) {
  console.log('\n== 4. the bolt');
  const p = await boot(T); await prep(p);
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, out = { by: {} }; window.__stage();
    const tex = window.game.textures.get(window.__gs._b2.stats.feel.skin.key);
    out.sizes = [...new Set(Object.keys(tex.frames).filter((f) => /^bolt-/.test(f)).map((f) => `${tex.frames[f].width}x${tex.frames[f].height}`))];
    out.boltFrames = Object.keys(tex.frames).filter((f) => /^bolt-/.test(f)).length;
    let bad = 0, seen = 0, old = 0, glows = 0;
    const scan = () => { for (const o of window.__mine()) { seen++; if (/^glow-/.test(o.frame.name)) glows++; if (o.blendMode !== 0 || o.scaleX !== 1 || o.scaleY !== 1 || o.alpha !== 1) bad++; } old += gs.children.list.filter((o) => o.visible && /^b2-(trail|halo|body|core|head|mz|spark|ring|spill)/.test(o.texture?.key || '')).length; };
    for (const c of [0, 0.5, 1]) {
      const names = new Set();
      P.facing = 0; P.aim = 0; gs.cursors.space.isDown = true;
      for (let i = 0; i < 30; i++) { P.superCharge = c * 4; window.__adv(1); scan(); for (const o of window.__mine()) if (/^bolt-/.test(o.frame.name)) names.add(o.frame.name); }
      gs.cursors.space.isDown = false; window.__adv(40);
      out.by[c] = [...names];
    }
    // OVERCHARGE rounds: the gold slug, the same tip rule
    gs._b2.state.hot = 20; const names = new Set(); gs.cursors.space.isDown = true; for (let i = 0; i < 20; i++) { P.superCharge = 2; window.__adv(1); scan(); for (const o of window.__mine()) if (/^bolt-/.test(o.frame.name)) names.add(o.frame.name); } gs.cursors.space.isDown = false; window.__adv(30);
    out.hot = [...names]; out.glows = glows; out.bad = bad; out.seen = seen; out.old = old;
    return out;
  });
  await p.close();
  const pc = await boot(B);
  const ctl = await pc.evaluate(() => { const gs = window.__gs; window.__stage(); gs.player.superCharge = 2; gs.cursors.space.isDown = true; let add = 0; for (let i = 0; i < 20; i++) { window.__adv(1); add += gs.children.list.filter((o) => o.visible && o.blendMode === 1 && /^b2-/.test(o.texture?.key || '')).length; } gs.cursors.space.isDown = false; return add; });
  await pc.close();
  check('one bolt size at every stage and for OVERCHARGE rounds (6 frames), and long enough to reach the round behind it (speed x cadence = 100px)', r.sizes.length === 1 && +r.sizes[0].split('x')[0] >= 100 && r.sizes[0].split('x')[1] === '15' && r.boltFrames === 6, JSON.stringify(r.sizes));
  check('every REACTOR object in a stream at 0 / 50 / 100%: NORMAL blend, scale 1, opaque (the floor light aside); none of the B2-1 glow sprites is drawn', r.seen > 150 && r.bad === 0 && r.old === 0, JSON.stringify({ seen: r.seen, bad: r.bad, old: r.old }));
  check('CONTROL: B2-B draws additive glow sprites in the same stream (the check above can see them)', ctl > 20, `${ctl} additive sprite-frames`);
  check('the round by stage: violet at 0, crimson at 50%, critical red at FULL; OVERCHARGE rounds are gold; every round has its glow under it', r.by[0].join() === 'bolt-0' && r.by[0.5].join() === 'bolt-2' && r.by[1].join() === 'bolt-4' && r.hot.join() === 'bolt-g' && r.glows > 100, JSON.stringify([r.by, r.hot]));
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

// ── 6. THE SUPER ─────────────────────────────────────────────────────────
if (on(6)) {
  console.log('\n== 6. the Super');
  const cast = async (flags) => {
    const p = await boot(flags); await prep(p);
    const r = await p.evaluate(() => {
      const gs = window.__gs, P = gs.player, out = {}; window.__stage();
      // burn the room's one-time alarm (a camera flash of its own) before measuring the Super's
      P.facing = 0; window.__super(); window.__adv(300); window.__clear(); window.__headless = false;
      const sp = window.__spots(260, 3, 0.2) || []; sp.forEach((q) => window.__dummy('grunt', q.x, q.y));
      P.facing = sp.length ? sp[1].a : 0; P.aim = P.facing; window.__pellets.length = 0; window.__super();
      let flash = false, addGfx = 0, heat = [], wind = [];
      for (let i = 0; i < 12; i++) { window.__adv(1); wind.push(gs._b2.stats.feel.skin?.gun.frame ?? null); if (gs.playerSuperBullets.getChildren().some((b) => b.active)) break; }
      const live = gs.playerSuperBullets.getChildren().filter((b) => b.active);
      out.pellets = window.__pellets.map((q) => [+q.a.toFixed(6), q.dmg]);
      out.body = live.map((b) => [b.body.width, b.body.height, b.body.halfWidth, b.body.halfHeight, b.body.radius, b.body.isCircle, b.scaleX, b.scaleY, b.displayWidth, b.displayHeight]);
      window.__adv(1); out.vis = live.map((b) => b.visible);
      out.tex = [...new Set(live.map((b) => `${b.texture.key}/${b.frame.name}/${b.scaleX}x${+b.scaleY.toFixed(2)}`))];
      for (let i = 0; i < 80; i++) {
        flash = flash || gs.cameras.main.flashEffect.isRunning;
        addGfx += gs.children.list.filter((o) => o.visible && o.blendMode === 1 && o.depth >= 34 && o.depth <= 36).length;
        heat.push(gs._b2.stats.feel.skin?.gun.heat ?? null);
        window.__adv(1);
      }
      out.flash = flash; out.addGfx = addGfx; out.heat = [...new Set(heat)]; out.wind = [...new Set(wind)];
      out.t = gs._b2.stats.feel.skin ? JSON.parse(JSON.stringify(gs._b2.stats.feel.skin)) : null;
      // a second cast: pooled pellets
      window.__super(); window.__adv(12);
      out.second = [...new Set(gs.playerSuperBullets.getChildren().filter((b) => b.active).map((b) => `${b.texture.key}/${b.frame.name}`))];
      out.lances2 = gs._b2.stats.feel.skin?.lances ?? null;
      return out;
    });
    await p.close();
    return r;
  };
  const b = await cast(B), t = await cast(T);
  check('the pellets are the shipped ones: the same five angles and damage, the same body and sprite (width, height, half sizes, radius, circle, scale, display size)', JSON.stringify(b.pellets) === JSON.stringify(t.pellets) && t.pellets.length === 5 && JSON.stringify(b.body) === JSON.stringify(t.body) && !t.t.hitboxChanged, JSON.stringify({ pellets: t.pellets.length, body: t.body[0] }));
  check('the pellet is the shipped object, untouched: the same texture and 1x1.9 scale as B2-B, only not drawn; a mass is drawn on each (5 per cast)', t.tex.join() === b.tex.join() && /^bullet-super\/__BASE\/1x1\.9$/.test(t.tex.join()) && t.vis.every((v) => v === false) && b.vis.every((v) => v === true) && t.t.lances === 10 && t.lances2 === 15, JSON.stringify([b.tex, t.tex, t.vis, t.lances2]));
  check('no screen flash and none of the shipped additive blast shapes (wind-up ring, fireball, cone, disc, ring) is visible — and B2-B shows them (control)', !t.flash && t.addGfx === 0 && b.flash && b.addGfx > 5 && t.t.cloak.objects >= 12, JSON.stringify({ temper: { flash: t.flash, addGfx: t.addGfx, hidden: t.t.cloak }, b2b: { flash: b.flash, addGfx: b.addGfx } }));
  check('the release is drawn in frames: the reactor collapses and a band closes on the muzzle in the wind-up, all three burst frames are seen, each target hit gets its three impact frames, the barrel cools through four steps', t.wind.includes('gun-w0') && t.t.frameSeen.crown.every((n) => n > 0) && t.t.frameSeen.ring.every((n) => n > 0) && t.t.impacts > 0 && t.t.frameSeen.imp.every((n) => n > 0) && [0, 1, 2, 3, -1].every((h) => t.heat.includes(h)), JSON.stringify({ wind: t.wind, crown: t.t.frameSeen.crown, ring: t.t.frameSeen.ring, heat: t.heat, impacts: t.t.impacts, imp: t.t.frameSeen.imp }));
}

// the F-release candidate stays independent: nothing of the release plays on keydown or after a cancelled hold
if (on(6)) {
  const p = await boot(join(T, 'b2c=1')); await prep(p);
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, kb = gs.input.keyboard, out = {}; window.__stage(); window.__ring(2, 300, -0.3, 0.6);
    const ts = () => gs._b2.stats.feel.skin; const seen = (n) => { const f = []; for (let i = 0; i < n; i++) { window.__adv(1); f.push(ts().gun.frame); } return f; };
    const rings = () => ts().frameSeen.ring.reduce((a, b) => a + b, 0);
    P.superCharge = 4; window.__adv(5);
    kb.emit('keydown-F', { repeat: false }); const held = seen(40); out.held = { wind: held.some((f) => /^gun-w/.test(f || '')), rings: rings(), supers: ts().supers, phase: gs._b2.superInput.state.phase };
    window.dispatchEvent(new Event('blur')); const after = seen(20); kb.emit('keyup-F', {}); const after2 = seen(12);
    out.cancel = { wind: [...after, ...after2].some((f) => /^gun-w/.test(f || '')), rings: rings(), supers: ts().supers };
    P.superCharge = 4; window.__adv(3); kb.emit('keydown-F', { repeat: false }); seen(30); const pre = rings(); kb.emit('keyup-F', {}); const rel = seen(10);
    out.release = { wind: rel.some((f) => /^gun-w/.test(f || '')), ringsBefore: pre, rings: rings(), supers: ts().supers };
    return out;
  });
  await p.close();
  check('with &b2c=1: a held F plays no collapse and no compression band; a cancelled hold plays none; they play on the release, with the cast', !r.held.wind && r.held.rings === 0 && r.held.supers === 0 && r.held.phase === 'targeting' && !r.cancel.wind && r.cancel.rings === 0 && r.cancel.supers === 0 && r.release.wind && r.release.ringsBefore === 0 && r.release.rings > 0 && r.release.supers === 1, JSON.stringify(r));
}

// ── 7. RESTARTS ──────────────────────────────────────────────────────────
const restartCheck = async (flags, label) => {
  const p = await boot(flags); await prep(p);
  const r = await p.evaluate(() => {
    const gs = window.__gs, own = (o, k) => Object.prototype.hasOwnProperty.call(o, k), out = {};
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
    out.title = { b2: !!gs._b2, pre: window.game.events.listeners('prerender').length, own: ['firePlayerSuper', '_superBlast'].filter((k) => own(gs, k)), dl: !!gs.sys.displayList && own(gs.sys.displayList, 'add'), flash: !!gs.cameras?.main && own(gs.cameras.main, 'flash'), atlas: Object.keys(window.game.textures.list).some((k) => /^b2r-/.test(k)) };
    return out;
  });
  await p.close();
  const same = (a, b) => a.skin && b.skin && a.pre === b.pre && a.blast === b.blast;
  check(`${label}restart twice: one install each time (prerender and blast listeners do not grow), the skin draws rounds and a Super after each, and no hidden shipped blast object is left two seconds later`, same(r.first, r.second) && same(r.second, r.third) && [r.use1, r.use2, r.use3].every((u) => u.rounds >= 4 && u.supers === 1) && r.hiddenLeft === 0, JSON.stringify([r.first, r.second, r.third, r.use3, { hiddenLeft: r.hiddenLeft }]));
  check(`${label}quit to title: no B2, the prerender listener gone, no firePlayerSuper / _superBlast / display-list / camera-flash wrapper left behind`, !r.title.b2 && r.title.pre === r.first.pre - 1 && r.title.own.length === 0 && !r.title.dl && !r.title.flash, JSON.stringify(r.title));
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
  const b = await run(B), t = await run(T);
  check('REACTOR draws fewer objects than B2-B in the same fight, with no additive blending (reported: update time)', t.peakT > 0 && t.peakT < b.peakB2 && t.shots === b.shots, `peak pooled objects: B2-B ${b.peakB2}, REACTOR ${t.peakT} (${t.madeT} ever created); update ${b.updMs.toFixed(3)}ms -> ${t.updMs.toFixed(3)}ms per frame (max ${b.updMax.toFixed(2)} / ${t.updMax.toFixed(2)}); peak live rounds ${t.peakRounds}`);
}

// ── 10. THE SHIPPED LINKS (with the B0 telemetry label) ──────────────────
if (on(10)) {
  console.log('\n== 10. the playtest links, as shipped (&b0=...)');
  const TL = join(T, 'b0=B2R'), BL = join(B, 'b0=B2B');
  const run = async (flags) => { const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 } }); const p = await boot(flags, { q: Q_MIXED, ctx }); const r = await p.evaluate((x) => window.__trace(x), { seed: 9071, ticks: 1500, seg: FIGHT_SEG, hold: HOLD, superTaps: [300, 700, 1100, 1400], melee: [500, 525, 550] }); const m = await p.evaluate(() => ({ b0: !!window.__gs._b0, label: window.__dbg.getB0Label(), skin: !!window.__gs._b2.stats.feel.skin })); await ctx.close(); return { ...r, m }; };
  const a = await run(BL), b = await run(TL);
  const d = firstDiff(a.hashes, b.hashes);
  check('the two links as shipped (B0 telemetry on, labels B2B / B2T): the same fight tick for tick, telemetry attached on both, the skin only on the candidate', d < 0 && a.m.b0 && b.m.b0 && a.m.label === 'B2B' && b.m.label === 'B2R' && !a.m.skin && b.m.skin && b.supers === 4, d < 0 ? `${b.shots} rounds, ${b.supers} Supers, ${b.kills} kills, ${b.draws} draws` : `first divergent tick ${d}`);
  const r = await restartCheck(TL, 'the candidate link: ');
  check('the candidate link keeps its telemetry through the restarts', r.first.b0 && r.second.b0 && r.third.b0 && r.label === 'B2R', JSON.stringify({ label: r.label }));
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
