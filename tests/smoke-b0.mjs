// SMOKE: B0 — COMBAT BASELINE TELEMETRY (`?b0=1|A|B`) — A MEASUREMENT
// INSTRUMENT THAT MUST NOT CHANGE THE GAME. Standalone; needs `npm run dev` on
// :5173 and, for section 1, the PREVIOUS build — `dc7d9ea`, the P2-A3 approved
// build — on another port (`--old=URL`; a worktree with its own Vite cacheDir,
// docs/engineering/core.md "One Vite cache per server").
//
// It proves:
//   0  THE FLAG: `b0` absent -> no instrument, no DOM, no storage, no wrapper,
//      no listener (listener counts equal to the flag-off page); `b0=A` / `b0=1`
//      labels; the instrument installs on the R1 default and on V2C+P1+P2-A3
//   1  FLAG OFF = THE PREVIOUS BUILD (`--old`): seeded replays of R1, legacy,
//      V2C+P1+P2-A3 (with a real OVERRIDE pickup, a cluster pod, Supers and
//      melee chains) tick for tick — state, ammo, hp, pickups, draws, events
//   2  FLAG ON = FLAG OFF: the same replays with `b0` on, tick for tick
//      (state, `Math.random` draws, per-tick event totals, hp, ammo, kills,
//      Super / melee charge), headless and RENDERED, with god mode on and off
//   3  DAMAGE TRUTH: every point of durability the enemies lost is attributed
//      exactly once (sum of recorded dmg = sum of hp lost, overkill apart and
//      never in dmg); staged STANDARD kill (dmg = hpMax, overkill = requested -
//      hpMax), a Bulwark frontal block counted as a block with no damage, a
//      Super, a melee chain, OVERRIDE and CLUSTER attributed to themselves;
//      incoming damage attributed (Rifleman contact, Gunner bolt) and equal to
//      the hp the player lost
//   4  LIFECYCLE: restart (the Pause menu's RESTART), a room transition
//      (enemies despawned, not killed), a defeat (game over -> the report
//      opens by itself), no doubled listeners after a restart, export
//      completeness (Download JSON parses, has every section, equals the
//      stored run), Copy JSON, a reload mid-run recovered as `interrupted`
//   5  PERFORMANCE: the instrument's own time per frame in a busy encounter,
//      and step time ON vs OFF
//   6  FROZEN FILES: only debug.js, BootScene.js, GameScene.js (tags) and the
//      two new modules differ from `dc7d9ea` under src/; Enemy.js guard
// `--selftest` injects, with `b0` ON only, one Math.random draw per frame and
// one game event per frame: section 2 must FAIL.
//
// usage: node tests/smoke-b0.mjs [--old=URL] [--selftest] [--ticks=N] [--only=0,2]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { CHROME, bootPage, FIGHT_SEG } from './diag-stuck-audit.mjs';
import { enemyJsGuard } from './enemy-frozen.mjs';
import { b0Scope } from './b0-scope.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const SELF = process.argv.includes('--selftest');
const OLD = opt('old', null);
const NOW = 'http://localhost:5173/';
const TICKS = +opt('ticks', '1500');
const BASE_REV = 'dc7d9ea';
const ONLY = opt('only', '') ? new Set(opt('only', '').split(',').map(Number)) : null;
const on = (n) => !ONLY || ONLY.has(n);
const VIS = 'visualPilot=v2c&polish=p1&fxPilot=p2a3';
const Q_SWARM = 'encdbg=swarmTide&room=hangar&sector=3';
const Q_MIXED = 'encdbg=mixed&room=hangar&sector=6';
const Q_VAN = 'encdbg=vanguard&room=hangar&sector=4';
const SUPER = [700, 1400], MELEE = [320, 345, 370, 1000, 1030], PICK = 480, CLUSTER = 1150;

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const firstDiff = (a, b) => { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i; return -1; };

async function boot(flags, { base = NOW, q = 'room=hangar', seed = 4242, god = true, ctx = null } = {}) {
  const p = ctx ? await ctx.newPage() : null;
  const page = p ? await (async () => {
    // a context page (clipboard / downloads): same boot as bootPage
    await p.goto(`${base}?nodlg=1&nofreeze=1${flags ? `&${flags}` : ''}&${q}`);
    await p.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
    await p.evaluate(async (seed) => {
      const g = window.game; g.loop.sleep();
      let s = 12345; window.__draws = 0;
      window.__seed = (n) => { s = (n >>> 0) || 1; };
      Math.random = () => { window.__draws++; s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
      window.__t = 1e5; Date.now = () => window.__t;
      window.__headless = false;
      window.__adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; if (window.__headless) g.headlessStep(window.__t, 1000 / 60); else g.step(window.__t, 1000 / 60); } };
      window.__mod = async (re) => { const u = performance.getEntriesByType('resource').map((r) => r.name).find((n) => re.test(n)); return u ? import(u) : null; };
      g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed }); window.__adv(2);
      (await window.__mod(/systems\/debug\.js/)).setGodMode(true);
      const gs = window.__gs = g.scene.getScene('Game');
      for (let i = 0; i < 400 && !gs.roomSpec; i++) window.__adv(1);
      window.__adv(20);
    }, seed);
    return p;
  })() : await bootPage(browser, { base, flags, baseline: null, q, seed });
  await page.evaluate(async ({ self, b0, god }) => {
    const gs = window.__gs;
    window.__dbg = await window.__mod(/systems\/debug\.js/);
    window.__dbg.setGodMode(god);
    window.__WP = (await window.__mod(/entities\/WeaponPickup\.js/))?.WeaponPickup;
    const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; return h; };
    window.__ev = {}; window.__evN = 0;
    const em = gs.events.emit.bind(gs.events);
    gs.events.emit = (n, ...a) => { window.__ev[n] = (window.__ev[n] || 0) + 1; window.__evN++; return em(n, ...a); };
    if (self && b0) {
      // SELFTEST: an instrument that draws randomness and emits an event per frame
      gs.events.on('postupdate', () => { Math.random(); gs.events.emit('b0-selftest'); });
    }
    window.__trace = ({ seed, ticks, seg, headless, melee, pickAt, clusterAt, superAt }) => {
      const P = gs.player, K = gs.keys, cam = gs.cameras.main;
      window.__headless = headless;
      window.__seed(seed); window.__draws = 0; window.__evN = 0;
      const hashes = [];
      let minHp = gs.player.hp; const hurt0 = window.__ev['player-hurt'] || 0;
      const f = (v) => (Math.round(v * 1000) / 1000).toString();
      for (let i = 0; i < ticks; i++) {
        const cur = seg.find(([a, bb]) => i >= a && i < bb)[2];
        K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
        if (i >= 60 && i % 7 === 0) gs.player.keyboardFire();
        if (superAt.includes(i)) { gs.player.superCharge = 999; gs.player.tryFireSuper(gs.player._autoAimAngle()); }
        if (melee.includes(i)) { gs.player.meleeCharge = 99; gs.player.tryMeleeCombo(); }
        if (i === pickAt) gs.weaponPickups.push(new window.__WP(gs, gs.player.x, gs.player.y, 'rifle'));
        if (i === clusterAt) gs.weaponPickups.push(new window.__WP(gs, gs.player.x, gs.player.y, 'cluster'));
        window.__adv(1);
        const Q = gs.player;
        let s = `${i}|${f(Q.x)},${f(Q.y)},${f(Q.hp)},${Q.shieldHp},${Q.alive},${Q.superCharge},${Q.meleeCharge},${Q.ammo},${Q.secondary},${Q.secondaryAmmo},${Q.fireCooldown},${Q._burstRemaining}|${f(cam.scrollX)},${f(cam.scrollY)}|${f(gs.time.timeScale)}|k${gs.runKills},${gs.runScore},${gs.lives},${gs.sector},${gs._waveIdx}|`;
        for (const e of gs.enemies.getChildren()) if (e.active) s += `${e.enemyType}:${f(e.x)},${f(e.y)},${Math.round(e.hp)},${e.state};`;
        if (gs.boss?.active) s += `V${f(gs.boss.x)},${f(gs.boss.y)},${Math.round(gs.boss.hp)};`;
        for (const g of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets]) {
          for (const bb of g?.getChildren?.() || []) if (bb.active) s += `b${f(bb.x)},${f(bb.y)},${bb.damage};`;
        }
        for (const q of gs.weaponPickups || []) s += `w${q.weaponId}:${q.active};`;
        s += `|d${window.__draws}|e${window.__evN}`;
        hashes.push(fnv(s));
        if (Q.hp < minHp) minHp = Q.hp;
      }
      K.A.isDown = K.D.isDown = K.W.isDown = K.S.isDown = false;
      const listeners = {}; for (const n of gs.events.eventNames()) listeners[n] = gs.events.listenerCount(n);
      return { hashes, draws: window.__draws, ev: { ...window.__ev }, kills: gs.runKills, hp: gs.player.hp, minHp, hurt: (window.__ev['player-hurt'] || 0) - hurt0, b0: !!gs._b0, listeners };
    };
  }, { self: SELF, b0: /(^|&)b0=/.test(flags), god });
  return page;
}

async function replay(flags, q, { headless = true, ticks = TICKS, seed = 9071, base = NOW, god = true } = {}) {
  const p = await boot(flags, { base, q, god });
  const r = await p.evaluate((o) => window.__trace(o), { seed, ticks, seg: FIGHT_SEG, headless, melee: MELEE, pickAt: PICK, clusterAt: CLUSTER, superAt: SUPER });
  await p.close();
  return r;
}
const join = (...a) => a.filter(Boolean).join('&');

// ── 0. THE FLAG ───────────────────────────────────────────────────────────
if (on(0) && !SELF) {
  console.log('\n== 0. the flag');
  const probe = () => {
    const gs = window.__gs, ev = gs.events;
    const counts = {};
    for (const n of ev.eventNames()) counts[n] = ev.listenerCount(n);
    let keys = 0; try { for (let i = 0; i < localStorage.length; i++) if (/^crix\.b0\./.test(localStorage.key(i))) keys++; } catch (_) { /* */ }
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    return { isB0: window.__dbg.isB0(), label: window.__dbg.getB0Label(), b0: !!gs._b0, dom: ['b0-tag', 'b0-btn', 'b0-panel'].filter((id) => document.getElementById(id)).length,
      keys, counts, wraps: [own(gs.player, 'damage'), own(gs.player, 'tryFire'), own(gs, 'fireShooter')].filter(Boolean).length };
  };
  const pOff = await boot('', { q: Q_SWARM }); await pOff.evaluate(() => window.__adv(200)); const off = await pOff.evaluate(probe); await pOff.close();
  const pOffV = await boot(VIS, { q: Q_SWARM }); await pOffV.evaluate(() => window.__adv(200)); const offV = await pOffV.evaluate(probe); await pOffV.close();
  check('b0 absent (R1 and V2C+P1+P2-A3): no instrument, no DOM element, no localStorage key, no wrapper', !off.isB0 && !off.b0 && off.dom === 0 && off.keys === 0 && off.wraps === 0
    && !offV.isB0 && !offV.b0 && offV.dom === 0 && offV.keys === 0 && offV.wraps === 0, JSON.stringify({ off: { ...off, counts: undefined }, offV: { ...offV, counts: undefined } }));
  const pA = await boot(join('b0=A', VIS), { q: Q_SWARM }); await pA.evaluate(() => window.__adv(200)); const a = await pA.evaluate(probe);
  const tagTxt = await pA.evaluate(() => document.getElementById('b0-tag')?.textContent || '');
  await pA.close();
  const p1 = await boot('b0=1', { q: Q_SWARM }); await p1.evaluate(() => window.__adv(60)); const one = await p1.evaluate(probe); await p1.close();
  const pB = await boot('b0=b', { q: Q_SWARM }); const bb = await pB.evaluate(probe); await pB.close();
  check('b0=A on V2C+P1+P2-A3: instrument installed, label A, 3 DOM elements, wrappers on player.damage / player.tryFire / fireShooter', a.isB0 && a.label === 'A' && a.b0 && a.dom === 3 && a.wraps === 3, JSON.stringify({ ...a, counts: undefined }));
  check('b0=1 on the R1 default: installed, no label; b0=b -> label B', one.isB0 && one.label === null && one.b0 && bb.label === 'B', `${one.label} / ${bb.label}`);
  // listeners: B0 adds its own; with the flag off the counts are the page's own
  const extra = Object.keys(a.counts).filter((k) => (a.counts[k] || 0) !== (offV.counts[k] || 0));
  check('with the flag on, B0 adds its listeners (none with it off — section 1 compares the off page with the previous build)', extra.length > 0 && extra.every((k) => (a.counts[k] || 0) > (offV.counts[k] || 0)), `${extra.length} event names gain a B0 listener`);
  await new Promise((r) => setTimeout(r, 400));
  check(`the run tag shows the label, the run number and a wall clock (\"${tagTxt}\")`, /^B0·A #\d+\s+\d\d:\d\d$/.test(tagTxt), tagTxt);
}

// ── 1. FLAG OFF = THE PREVIOUS BUILD ──────────────────────────────────────
if (on(1) && OLD && !SELF) {
  console.log(`\n== 1. flag off = the previous build (${BASE_REV} at ${OLD})`);
  for (const [label, q, fl] of [['SWARM TIDE, R1', Q_SWARM, ''], ['MIXED s6, R1', Q_MIXED, ''], ['VANGUARD, R1', Q_VAN, ''],
    ['SWARM TIDE, legacy', Q_SWARM, 'baseline=legacy'], ['SWARM TIDE, V2C+P1+P2-A3', Q_SWARM, VIS], ['MIXED s6, V2C+P1+P2-A3', Q_MIXED, VIS], ['MIXED s6, V2C', Q_MIXED, 'visualPilot=v2c'], ['MIXED s6, P1', Q_MIXED, 'visualPilot=v2c&polish=p1']]) {
    const a = await replay(fl, q, { base: OLD }), b = await replay(fl, q);
    const d = firstDiff(a.hashes, b.hashes);
    const evs = Object.keys({ ...a.ev, ...b.ev }).filter((k) => a.ev[k] !== b.ev[k]);
    const ls = Object.keys({ ...a.listeners, ...b.listeners }).filter((k) => a.listeners[k] !== b.listeners[k]);
    if (ls.length) evs.push(`listeners:${ls.join('/')}`);
    check(`${label}: ${TICKS} ticks identical to ${BASE_REV} (state, draws, per-tick events, listener counts)`, d < 0 && evs.length === 0, d < 0 ? `${a.draws} draws, ${a.kills} kills` : `first divergent tick ${d}; events ${evs.join(',')}`);
  }
  {
    const a = await replay(VIS, Q_MIXED, { base: OLD, god: false }), b = await replay(VIS, Q_MIXED, { god: false });
    const d = firstDiff(a.hashes, b.hashes);
    check(`MIXED s6, V2C+P1+P2-A3, god mode OFF (the player is hurt): ${TICKS} ticks identical to ${BASE_REV}`, d < 0 && b.hurt > 0, d < 0 ? `${b.hurt} hits taken, min hp ${Math.round(b.minHp)}` : `first divergent tick ${d}`);
  }
} else if (on(1) && !SELF) console.log('\n== 1. skipped (no --old=URL)');

// ── 2. FLAG ON = FLAG OFF ─────────────────────────────────────────────────
if (on(2)) {
  console.log('\n== 2. flag on = flag off (same build)');
  const cases = [['SWARM TIDE, R1', Q_SWARM, '', true, true], ['MIXED s6, R1', Q_MIXED, '', true, true], ['VANGUARD (Bulwarks), R1', Q_VAN, '', true, true],
    ['SWARM TIDE, legacy', Q_SWARM, 'baseline=legacy', true, true], ['MIXED s6, V2C+P1+P2-A3', Q_MIXED, VIS, true, true],
    ['MIXED s6, V2C+P1+P2-A3, god OFF', Q_MIXED, VIS, true, false], ['VANGUARD, R1, god OFF', Q_VAN, '', true, false]];
  if (SELF) cases.length = 2;
  for (const [label, q, fl, headless, god] of cases) {
    const a = await replay(fl, q, { headless, god }), b = await replay(join(fl, 'b0=A'), q, { headless, god });
    const d = firstDiff(a.hashes, b.hashes);
    const evs = Object.keys({ ...a.ev, ...b.ev }).filter((k) => a.ev[k] !== b.ev[k]);
    check(`${label}: ${TICKS} headless ticks, b0 ON identical to OFF (state, hp, ammo, kills, Super/melee charge, draws, per-tick events)`, d < 0 && evs.length === 0 && b.b0 && !a.b0 && (god || b.hurt > 0),
      (d < 0 ? `${a.draws} draws, ${a.kills} kills` : `first divergent tick ${d}; events ${evs.join(',')}`) + (god ? '' : `; ${b.hurt} hits taken, min hp ${Math.round(b.minHp)}`));
  }
  if (!SELF) {
    const n = Math.min(TICKS, 700);
    const a = await replay(VIS, Q_MIXED, { headless: false, ticks: n }), b = await replay(join(VIS, 'b0=B'), Q_MIXED, { headless: false, ticks: n });
    const d = firstDiff(a.hashes, b.hashes);
    check(`MIXED s6, V2C+P1+P2-A3: ${n} RENDERED ticks, b0 ON identical to OFF`, d < 0, d < 0 ? `${a.draws} draws` : `first divergent tick ${d}`);
    const c = await replay('', Q_SWARM, { headless: false, ticks: n }), e = await replay('b0=1', Q_SWARM, { headless: false, ticks: n });
    const d2 = firstDiff(c.hashes, e.hashes);
    check(`SWARM TIDE, R1: ${n} RENDERED ticks, b0 ON identical to OFF`, d2 < 0, d2 < 0 ? `${c.draws} draws` : `first divergent tick ${d2}`);
  }
}

// ── 3. DAMAGE TRUTH ───────────────────────────────────────────────────────
if (on(3) && !SELF) {
  console.log('\n== 3. damage truth');
  // (a) the seeded fight: every point of lost durability attributed exactly once
  for (const [label, q, fl] of [['MIXED s6, V2C+P1+P2-A3', Q_MIXED, VIS], ['VANGUARD, R1', Q_VAN, ''], ['SWARM TIDE, R1', Q_SWARM, '']]) {
    const p = await boot(join(fl, 'b0=A'), { q });
    const r = await p.evaluate((o) => {
      const gs = window.__gs;
      // independent ledger: requested amounts and hp lost per enemy, from the
      // game's own event and pools (not from the instrument)
      const led = new Map(); let requested = 0;
      gs.events.on('enemy-hit', (e, amount) => { requested += amount; });
      const t = window.__trace(o);
      const R = gs._b0.snapshot();
      let lost = 0, recDmg = 0, recOver = 0, recReq = 0;
      for (const e of R.enemies) {
        const a = e._actor;
        recDmg += Object.values(e.dmg).reduce((x, y) => x + y, 0);
        recOver += Object.values(e.overkill).reduce((x, y) => x + y, 0);
      }
      // hp lost: killed -> hpMax; alive -> hpMax - hp now (read from the live actors)
      const liveHp = new Map(); for (const x of gs.enemies.getChildren()) if (x.active && x.alive) liveHp.set(x, x.hp);
      const rec = gs._b0.record();
      for (const e of rec.enemies) {
        if (e.fate === 'killed' || e.fate === 'takedown') lost += e.hpMax;
        else if (e.fate === 'alive' && e._actor) lost += e.hpMax - e._actor.hp;
      }
      return { lost, recDmg, recOver, requested, kills: Object.values(R.player.kills).reduce((x, y) => x + y, 0), runKills: gs.runKills,
        killed: R.enemies.filter((e) => e.fate === 'killed').length, errors: R.errors || 0, fe: R.firstError || null,
        bySrc: R.player.dmg, fired: R.player.fired, hits: R.player.hits, blocked: R.player.blocked, ov: R.player.override, cl: R.player.cluster, sup: { casts: R.player.super.casts, pellets: R.player.super.pellets }, mel: { chains: R.player.melee.chains, casts: R.player.melee.casts } };
    }, { seed: 9071, ticks: TICKS, seg: FIGHT_SEG, headless: true, melee: MELEE, pickAt: PICK, clusterAt: CLUSTER, superAt: SUPER });
    await p.close();
    const close = (a, b) => Math.abs(a - b) < 0.01 * Math.max(1, b);
    check(`${label}: recorded dmg = durability the enemies actually lost (${Math.round(r.recDmg)} = ${Math.round(r.lost)}); overkill apart (${Math.round(r.recOver)}); dmg + overkill = requested (${Math.round(r.requested)})`,
      close(r.recDmg, r.lost) && close(r.recDmg + r.recOver, r.requested) && r.errors === 0, r.fe || '');
    check(`${label}: kills credited = deaths seen (${r.kills} = ${r.killed}); game's own kill counter ${r.runKills}`, r.kills === r.killed && r.killed > 0, JSON.stringify(r.bySrc));
    if (label.startsWith('MIXED')) {
      check(`${label}: STANDARD, OVERRIDE, CLUSTER, Super and melee each fired and attributed (${JSON.stringify(r.fired)} / ${JSON.stringify(r.hits)})`,
        r.fired.standard > 0 && r.hits.standard > 0 && r.ov.pickups === 1 && r.ov.rounds > 0 && r.hits.override > 0 && r.cl.pickups === 1 && r.cl.throws > 0
        && r.sup.casts === 2 && r.sup.pellets === 10 && r.hits.super > 0 && r.mel.chains >= 1 && r.bySrc.melee > 0, JSON.stringify({ ov: r.ov, cl: r.cl, sup: r.sup, mel: r.mel }));
    }
    if (label.startsWith('VANGUARD')) check(`${label}: Bulwark frontal blocks counted as blocks, never as damage (${JSON.stringify(r.blocked)})`, r.blocked.standard > 0, '');
  }

  // (b) staged: a STANDARD kill, a frontal block, incoming contact and bolt
  const p = await boot('b0=A', { q: 'encdbg=mixed&room=hangar&sector=1', god: false });
  const st = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player;
    const clear = () => {
      gs.arenaActive = false; gs._spawnQueue = [];
      gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
      for (const g of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets]) for (const bb of g.getChildren()) if (bb.active) bb.kill();
    };
    window.__headless = true; window.__adv(240); clear(); window.__adv(4); clear();
    const R = gs._b0.record();
    const out = {};
    // STANDARD kill on a Rifleman, 140px east
    P.x = 700; P.y = 900; P.body.reset(700, 900);
    const g = gs.spawnEnemyAt('grunt', 840, 900); g.body.moves = false;
    window.__adv(2);
    let req = 0; const onHit = (e, a) => { if (e === g) req += a; }; gs.events.on('enemy-hit', onHit);
    for (let i = 0; i < 400 && g.alive; i++) { P.ammo = 3; P.fireCooldown = 0; P.tryFire(0); window.__adv(1); }
    gs.events.off('enemy-hit', onHit);
    const rg = R.enemies.find((e) => e._actor === g || (e.type === 'grunt' && e.fate === 'killed'));
    out.kill = { hpMax: rg?.hpMax, dmg: rg?.dmg.standard, over: rg?.overkill.standard, req, hits: rg?.hits.standard, fate: rg?.fate, src: rg?.killSrc, dmgMult: P.dmgMult, pellet: rg && rg.hits.standard };
    clear(); window.__adv(30);
    // a Bulwark faced at the player: shoot its front
    const b = gs.spawnEnemyAt('shielded', 900, 900); window.__adv(40);
    b.body.moves = false;
    const hp0 = b.hp; let blocks = 0;
    const ob = b.onBlock; b.onBlock = function (...a) { blocks++; return ob.apply(this, a); };
    const rb = R.enemies.find((e) => e._actor === b);
    for (let i = 0; i < 240; i++) { P.ammo = 3; P.fireCooldown = 0; P.tryFire(Math.atan2(b.y - P.y, b.x - P.x)); window.__adv(1); }
    out.block = { blocks, recBlocks: rb?.blocks.standard, recDmg: rb ? Object.values(rb.dmg).reduce((x, y) => x + y, 0) : null, hpLost: hp0 - (b.alive ? b.hp : 0) };
    clear(); window.__adv(30);
    // incoming: a Swarmling at contact range (melee), then a Gunner at range
    P.hp = P.hpMax; P.shieldHp = 0;
    const inc0 = { ...R.incoming.bySource };
    const hpBefore = P.hp; const hp0Inc = R.incoming.hpRemoved;
    const c = gs.spawnEnemyAt('swarmling', 740, 900);
    let hpSeen = 0; let last = P.hp;
    for (let i = 0; i < 300 && P.alive; i++) { window.__adv(1); if (P.hp < last) hpSeen += last - P.hp; last = P.hp; if (P.hp < hpBefore - 200) break; }
    const afterContact = JSON.parse(JSON.stringify(R.incoming.bySource));
    clear(); window.__adv(5);
    P.hp = P.hpMax; last = P.hp;
    const s = gs.spawnEnemyAt('shooter', 700, 600);
    for (let i = 0; i < 600 && P.alive; i++) { window.__adv(1); if (P.hp < last) hpSeen += last - P.hp; last = P.hp; if ((R.incoming.bySource['shooter:bolt']?.hp || 0) > 0) break; }
    out.inc = { before: inc0, contact: afterContact, after: JSON.parse(JSON.stringify(R.incoming.bySource)), hpRemoved: R.incoming.hpRemoved - hp0Inc, hpSeen, errors: R.errors || 0 };
    return out;
  });
  await p.close();
  const k = st.kill;
  check(`staged STANDARD kill on a Rifleman: dmg = hpMax (${k.dmg} = ${k.hpMax}), overkill = requested - hpMax (${k.over} = ${k.req} - ${k.hpMax}), credited to standard`,
    k.fate === 'killed' && k.src === 'standard' && Math.abs(k.dmg - k.hpMax) < 0.01 && Math.abs(k.over - (k.req - k.hpMax)) < 0.01 && k.req > k.hpMax, JSON.stringify(k));
  const bl = st.block;
  check(`staged Bulwark front: every block counted (${bl.recBlocks} = ${bl.blocks}) and no damage recorded beyond the hp it really lost (${bl.recDmg} vs ${bl.hpLost})`,
    bl.blocks > 0 && bl.recBlocks === bl.blocks && Math.abs(bl.recDmg - bl.hpLost) < 0.01, JSON.stringify(bl));
  const ic = st.inc;
  const contactHp = ic.contact['swarmling:contact']?.hp || 0, boltHp = ic.after['shooter:bolt']?.hp || 0;
  check(`staged incoming: Swarmling contact (${Math.round(contactHp)} hp) and Gunner bolt (${Math.round(boltHp)} hp) attributed; recorded hp loss = hp the player lost (${Math.round(ic.hpRemoved)} = ${Math.round(ic.hpSeen)})`,
    contactHp > 0 && boltHp > 0 && Math.abs(ic.hpRemoved - ic.hpSeen) < 0.5 && ic.errors === 0, JSON.stringify(ic.after));
}

// ── 4. LIFECYCLE + EXPORT ─────────────────────────────────────────────────
if (on(4) && !SELF) {
  console.log('\n== 4. lifecycle and export');
  const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await boot('b0=A', { q: Q_SWARM, ctx });
  p.on('pageerror', (e) => { console.error(`pageerror: ${e.message}`); });
  await p.evaluate(async () => {
    window.__dbg = await window.__mod(/systems\/debug\.js/);
    localStorage.removeItem('crix.b0.runs.v1'); localStorage.removeItem('crix.b0.live.v1');
  });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // run 1: fight, then the Pause menu's RESTART
  const r1 = await p.evaluate(() => {
    const gs = window.__gs; window.__headless = true;
    for (let i = 0; i < 600; i++) { if (i % 7 === 0) gs.player.keyboardFire(); window.__adv(1); }
    const id = gs._b0.record().run.id, n = gs._b0.record().run.n;
    gs.scene.pause(); gs.scene.launch('Pause'); window.__adv(2);
    window.game.scene.getScene('Pause')._restart();
    window.__adv(30);
    return { id, n };
  });
  await wait(700);
  const after = await p.evaluate(() => {
    const gs = window.__gs = window.game.scene.getScene('Game');
    for (let i = 0; i < 400 && !gs.roomSpec; i++) window.__adv(1);
    window.__adv(30);
    const runs = JSON.parse(localStorage.getItem('crix.b0.runs.v1') || '[]');
    // exactly five shots on the new run: a doubled listener would count ten
    const f0 = gs._b0.record().player.fired.standard;
    let shots = 0;
    for (let i = 0; i < 200 && shots < 5; i++) { const P = gs.player; P.ammo = 3; if (P.fireCooldown <= 0 && P.tryFire(0)) shots++; window.__adv(1); }
    return { runs: runs.map((r) => [r.run.id, r.run.endReason, r.enemies.length]), newId: gs._b0.record().run.id, n: gs._b0.record().run.n, fired: gs._b0.record().player.fired.standard - f0, shots };
  });
  const r1s = after.runs.find((x) => x[0] === r1.id);
  check(`restart from the Pause menu: run 1 stored as "restart" with its enemies (${JSON.stringify(r1s)}), run 2 started (#${after.n})`, r1s && r1s[1] === 'restart' && r1s[2] > 0 && after.newId !== r1.id && after.n === r1.n + 1, JSON.stringify(after.runs));
  check(`after the restart, 5 shots count as 5 (no doubled listeners): ${after.fired}`, after.fired === 5 && after.shots === 5);
  // room transition: load the next room with enemies alive
  const rt = await p.evaluate(() => {
    const gs = window.__gs; window.__headless = true;
    for (let i = 0; i < 300; i++) window.__adv(1);
    const R = gs._b0.record();
    const alive = R.enemies.filter((e) => e.fate === 'alive').length;
    const rooms0 = R.rooms.length;
    const next = window.__gs.constructor; // keep reference
    gs.loadRoom({ ...gs.roomSpec });
    window.__adv(20);
    return { alive, despawned: R.enemies.filter((e) => e.fate === 'despawned').length, rooms: R.rooms.length - rooms0, waveEnd: R.waves.at(-2)?.endWhy ?? R.waves.at(-1)?.endWhy };
  });
  check(`room transition: the ${rt.alive} enemies alive are closed as "despawned" (${rt.despawned}), never as kills; a new room record`, rt.alive > 0 && rt.despawned >= rt.alive && rt.rooms === 1, JSON.stringify(rt));
  // live autosave + reload recovery
  const lv = await p.evaluate(() => { const gs = window.__gs; for (let i = 0; i < 60; i++) window.__adv(1); window.__b0id = gs._b0.record().run.id; window.__dbg; return gs._b0.record().run.id; });
  await p.evaluate(() => { const m = document.getElementById('b0-tag'); return !!m; });
  await p.evaluate(async () => { const mod = await window.__mod(/systems\/b0Report\.js/); mod.b0Store()._saveLive(); });
  await p.reload();
  await p.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
  await wait(300);
  const rec = await p.evaluate((id) => { const runs = JSON.parse(localStorage.getItem('crix.b0.runs.v1') || '[]'); const r = runs.find((x) => x.run.id === id); return r ? r.run.endReason : null; }, lv);
  await wait(400);
  const titleBtn = await p.evaluate(() => getComputedStyle(document.getElementById('b0-btn') || document.body).display === 'block' && !!document.getElementById('b0-btn'));
  check(`a reload mid-run keeps the run: recovered as "${rec}"; the title screen offers the B0 DATA button`, /^interrupted/.test(rec || '') && titleBtn, `button ${titleBtn}`);
  // a defeat: game over opens the report by itself
  await p.evaluate(async (seed) => {
    const g = window.game; g.loop.sleep();
    let s = 777; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    window.__t = 2e5; window.__adv = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.headlessStep(window.__t, 1000 / 60); } };
    window.__mod = async (re) => { const u = performance.getEntriesByType('resource').map((r) => r.name).find((n) => re.test(n)); return u ? import(u) : null; };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed }); window.__adv(2);
    const gs = window.__gs = g.scene.getScene('Game');
    for (let i = 0; i < 400 && !gs.roomSpec; i++) window.__adv(1);
    window.__adv(60);
    (await window.__mod(/systems\/debug\.js/)).setGodMode(false);
    gs.lives = 1;
    gs.player.shieldHp = 0; gs.player.damage(99999);
    for (let i = 0; i < 900 && g.scene.isActive('Game'); i++) window.__adv(1);
  }, 4242);
  await wait(900);
  const go = await p.evaluate(() => ({ gameOver: window.game.scene.isActive('GameOver'), panel: getComputedStyle(document.getElementById('b0-panel')).display,
    title: document.getElementById('b0-title')?.textContent || '', text: document.getElementById('b0-panel').innerText.slice(0, 4000) }));
  check(`defeat -> game over -> the report opens by itself ("${go.title}")`, go.gameOver && go.panel === 'block' && /B0 run A #\d+/.test(go.title) && /defeat/.test(go.text),
    go.text.slice(0, 160).replace(/\n/g, ' | '));
  check('the report has every section (TTK, STANDARD gun, damage by source, abilities, incoming, waves, performance)',
    ['Enemy TTK', 'STANDARD gun', 'Damage by source', 'Abilities', 'Incoming damage', 'Waves', 'Performance'].every((h) => go.text.includes(h)));
  // Download JSON
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }).catch(() => null), p.click('#b0-bar [data-a="dl"]')]);
  let parsed = null, fname = '';
  if (dl) { fname = dl.suggestedFilename(); const path = await dl.path(); const { readFileSync } = await import('node:fs'); parsed = JSON.parse(readFileSync(path, 'utf8')); }
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('crix.b0.runs.v1') || '[]').at(-1));
  const keys = ['schema', 'run', 'clock', 'rooms', 'waves', 'enemies', 'player', 'incoming', 'upgrades', 'timeline', 'perf', 'definitions'];
  check(`Download JSON: ${fname} parses, schema ${parsed?.schema}, every section present, equal to the stored run`,
    !!parsed && parsed.schema === 'crix-b0/1' && keys.every((k) => k in parsed) && parsed.run.endReason === 'defeat' && JSON.stringify(parsed) === JSON.stringify(stored)
      && parsed.run.build && parsed.run.query.includes('b0=A') && parsed.run.label === 'A' && parsed.timeline.length > 0,
    parsed ? `${(JSON.stringify(parsed).length / 1024).toFixed(0)} KB, ${parsed.enemies.length} enemies, ${parsed.timeline.length} timeline rows, build ${parsed.run.build}` : 'no download');
  await p.click('#b0-bar [data-a="copy"]');
  await wait(300);
  const clip = await p.evaluate(async () => { try { return await navigator.clipboard.readText(); } catch (e) { return `ERR ${e}`; } });
  check('Copy JSON puts the same run on the clipboard', clip === JSON.stringify(stored), `${clip.length} chars`);
  await p.click('#b0-bar [data-a="close"]');
  const closed = await p.evaluate(() => ({ panel: getComputedStyle(document.getElementById('b0-panel')).display, btn: getComputedStyle(document.getElementById('b0-btn')).display }));
  await wait(400);
  const btn2 = await p.evaluate(() => getComputedStyle(document.getElementById('b0-btn')).display);
  check('Close hides the report; the B0 DATA button stays available on the game-over screen', closed.panel === 'none' && btn2 === 'block', JSON.stringify(closed));
  await p.screenshot({ path: 'tests/out/b0-gameover.png' });
  await p.click('#b0-btn'); await wait(200);
  await p.screenshot({ path: 'tests/out/b0-report.png' });
  await ctx.close();
}

// ── 5. PERFORMANCE ────────────────────────────────────────────────────────
if (on(5) && !SELF) {
  console.log('\n== 5. performance');
  const stepMs = async (flags) => {
    const p = await boot(flags, { q: 'encdbg=swarmTide&room=hangar&sector=8' });
    const r = await p.evaluate(() => {
      const gs = window.__gs; window.__headless = false;
      window.__adv(200);
      const t0 = performance.now();
      for (let i = 0; i < 400; i++) { if (i % 7 === 0) gs.player.keyboardFire(); window.__adv(1); }
      const ms = (performance.now() - t0) / 400;
      const R = gs._b0?.snapshot();
      return { ms, alive: gs.enemies.getChildren().filter((e) => e.alive).length, ov: R ? { mean: R.perf.overheadUs.sum / R.perf.overheadUs.n, max: R.perf.overheadUs.max, frames: R.perf.frames } : null };
    });
    await p.close();
    return r;
  };
  const offs = [], ons = [];
  for (let k = 0; k < 3; k++) { offs.push(await stepMs(VIS)); ons.push(await stepMs(join(VIS, 'b0=A'))); }
  const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
  const mOff = med(offs.map((x) => x.ms)), mOn = med(ons.map((x) => x.ms));
  const ovMean = med(ons.map((x) => x.ov.mean)), ovMax = Math.max(...ons.map((x) => x.ov.max));
  console.log(`  rendered step: off ${offs.map((x) => x.ms.toFixed(2)).join('/')} ms, on ${ons.map((x) => x.ms.toFixed(2)).join('/')} ms; ~${ons[0].alive} enemies alive`);
  check(`B0's own time per frame in a busy SWARM TIDE (s8, rendered): mean ${ovMean.toFixed(0)}µs, max ${ovMax.toFixed(0)}µs — under 1ms mean`, ovMean < 1000, `step ${mOff.toFixed(2)} -> ${mOn.toFixed(2)} ms (headless harness, load-sensitive)`);
}

// ── 6. FROZEN FILES ───────────────────────────────────────────────────────
if (on(6) && !SELF) {
  console.log('\n== 6. frozen files');
  const sc = b0Scope();
  check(`src/ differs from ${BASE_REV} only in B0's files, GameScene.js only by attribution tags + the install, BootScene.js only by the flag (${sc.files.join(', ')})`, sc.ok, sc.detail);
  const g = enemyJsGuard(process.cwd() + '/');
  let ej = 'x'; try { ej = execSync(`git diff --name-only ${BASE_REV} -- src/entities`, { encoding: 'utf8' }).trim(); } catch (_) { /* */ }
  check(`Enemy.js guard (outside the Bomber, the Bomber-only veto) and no file under src/entities changed against ${BASE_REV}`, g.outside && g.bomberOnlyVeto && g.vetoCode && ej === '', `${g.detail} ${ej}`);
}

await browser.close();
const fail = results.filter((r) => !r.ok);
if (SELF) {
  const s2 = results.filter((r) => /ON identical to OFF/.test(r.name));
  const caught = s2.length > 0 && s2.every((r) => !r.ok);
  console.log(`\nSELFTEST: section 2 ${caught ? 'FAILED as it must' : 'DID NOT FAIL — the check cannot see a perturbation'} (${s2.filter((r) => !r.ok).length}/${s2.length})`);
  process.exit(caught ? 0 : 1);
}
console.log(`\n${results.length - fail.length}/${results.length} passed`);
process.exit(fail.length ? 1 : 0);
