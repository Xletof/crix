// SMOKE: B1 — THE HUMAN-AUTHORIZED COMBAT EXPERIMENTS (`?b1=G|M|S`).
// Standalone; needs `npm run dev` on :5173 and, for section 1, the previous
// build `a3866f2` (the B0 build, live on FRIX before B1) at `--old=URL` with
// its own Vite cacheDir.
//
//   0  FLAGS: absent = R1 tuning and nothing installed; G / M / S (any case);
//      anything else = off
//   1  FLAG OFF = a3866f2, seeded replays tick for tick (R1, legacy,
//      V2C+P1+P2-A3, with and without the B0 instrument)
//   2  VARIANT EQUIVALENCE except the authorized changes:
//        a) Supers + melee, no STANDARD: B1-G = R1 tick for tick
//        b) slow STANDARD (never empties a 3-round magazine) + Supers + melee
//           + an OVERRIDE pickup + a cluster pod: B1-G = R1 except the ammo /
//           cooldown fields themselves
//        c) rapid STANDARD, no Supers: B1-G = B1-M = B1-S tick for tick
//   3  THE SUPER (staged): damage per pellet on ordinary enemies (Regular,
//      Elite, Bulwark) = 300 / 150 x dmgMult; push ~90 / ~180px measured;
//      slow 25% / 40% for 1.5 / 2s then the original cfg restored; ONE push
//      and ONE slow per enemy per cast; re-push immunity; chained Supers never
//      lock the AI; no punish multiplier; a lethal pellet slides the corpse as
//      R1; push distance at a 30 Hz step; Super / melee charge identical to
//      R1; nemesis, Shock Captain, Vader and afterimages take the R1 Super
//   4  STANDARD + CONTROLS: 10 / 110ms / 260ms sequential; tap = exactly one
//      shot; hold auto-fires (stick: manual aim or auto-aim; SPACE) and adds
//      no release shot; OVERRIDE and the cluster pod never auto-repeat; SPACE
//      with a full meter is still the Super; a REAL touch hold and tap (CDP
//      touch events); the Super / melee buttons are not claimed by the fire
//      stick; the 10 HUD pips fit, also after a relayout
//   5  RESTARTS: Pause-menu RESTART, quit + new run, reload — one install,
//      one set of wrappers, tuning kept, pips refitted, no cfg left slowed
//   6  TELEMETRY: variant in the export; input-mode counts = the script;
//      charge units = the meter's real increments; push distance and slowed
//      time = measured; damage truth (dmg = hp lost, dmg + overkill =
//      requested, kills = deaths) in seeded M and S fights
//   7  NO NEW RANDOM DRAWS: none inside the B1 frame hook or the B1 Super hit;
//      no Math.random in b1Combat.js
//   8  FROZEN FILES: the B0 / B1 scope guard; Enemy.js guard; entities,
//      config and data untouched since a3866f2
//
// usage: node tests/smoke-b1.mjs [--old=URL] [--ticks=N] [--only=0,3]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { CHROME, FIGHT_SEG } from './diag-stuck-audit.mjs';
import { enemyJsGuard } from './enemy-frozen.mjs';
import { b0Scope, b1Scope, B1_BASE } from './b0-scope.mjs';

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

// ── BOOT (the bootPage recipe: seeded Math.random with a draw counter, a
// 60 Hz manual step; optionally inside a touch-capable context) ───────────
async function boot(flags, { base = NOW, q = Q_STAGE, seed = 4242, god = true, ctx = null, viewport = { width: 720, height: 1280 } } = {}) {
  const page = ctx ? await ctx.newPage() : await browser.newPage({ viewport });
  page.on('pageerror', (e) => { console.error(`pageerror: ${e.message}`); });
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
    window.__dbg.setGodMode(god);
    window.__cfg = await window.__mod(/\/src\/config\.js/);
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
    window.__stage = () => { window.__adv(200); window.__clear(); window.__adv(3); window.__clear(); const P = gs.player; P.x = 600; P.y = 900; P.body.reset(600, 900); P.superCharge = 0; P.meleeCharge = 0; window.__adv(2); };
    // the replay: `fire` = STANDARD every N ticks (0 = none); `noAmmo` leaves
    // the magazine fields (count, regeneration queue, cooldown) out of the hash
    window.__trace = ({ seed, ticks, seg, fire, superAt, melee, pickAt, clusterAt, noAmmo }) => {
      const K = gs.keys, cam = gs.cameras.main;
      window.__seed(seed); window.__draws = 0; window.__evN = 0; window.__ev['player-ammo-changed'] = 0;
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
        const ammo = noAmmo ? '-' : `${P.ammo},${P.ammoTimers.length},${P.fireCooldown}`;
        let s = `${i}|${f(P.x)},${f(P.y)},${f(P.hp)},${P.shieldHp},${P.alive},${P.superCharge},${P.meleeCharge},${ammo},${P.secondary},${P.secondaryAmmo},${P._burstRemaining}|${f(cam.scrollX)},${f(cam.scrollY)}|${f(gs.time.timeScale)}|k${gs.runKills},${gs.runScore},${gs.lives},${gs._waveIdx}|`;
        for (const e of gs.enemies.getChildren()) if (e.active) s += `${e.enemyType}:${f(e.x)},${f(e.y)},${Math.round(e.hp)},${e.state};`;
        if (gs.boss?.active) s += `V${f(gs.boss.x)},${f(gs.boss.y)},${Math.round(gs.boss.hp)};`;
        for (const g2 of [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets]) for (const bb of g2?.getChildren?.() || []) if (bb.active) s += `b${f(bb.x)},${f(bb.y)},${bb.damage};`;
        // the magazine's own event fires on each regenerated round: its timing
        // is one of the magazine fields `noAmmo` leaves out
        const evN = noAmmo ? window.__evN - (window.__ev['player-ammo-changed'] || 0) : window.__evN;
        s += `|d${window.__draws}|e${evN}`;
        hashes.push(fnv(s));
      }
      K.A.isDown = K.D.isDown = K.W.isDown = K.S.isDown = false;
      return { hashes, draws: window.__draws, ev: { ...window.__ev }, kills: gs.runKills, b1: !!gs._b1 };
    };
  }, { seed, god });
  return page;
}
async function replay(flags, q, o = {}) {
  const p = await boot(flags, { base: o.base || NOW, q, god: o.god ?? true });
  const r = await p.evaluate((x) => window.__trace(x), { seed: 9071, ticks: o.ticks || TICKS, seg: FIGHT_SEG, fire: o.fire ?? 7, superAt: o.superAt ?? SUPER, melee: o.melee ?? MELEE, pickAt: o.pickAt ?? PICK, clusterAt: o.clusterAt ?? CLUSTER, noAmmo: !!o.noAmmo });
  await p.close();
  return r;
}

// ── 0. FLAGS ──────────────────────────────────────────────────────────────
if (on(0)) {
  console.log('\n== 0. flags');
  const probe = () => ({ v: window.__dbg.getB1Variant(), b1: !!window.__gs._b1, t: [window.__cfg.PLAYER.ammoMax, window.__cfg.PLAYER.fireCooldownMs, window.__cfg.PLAYER.ammoReloadMs, window.__cfg.PLAYER.pelletDamage, window.__cfg.PLAYER.superDamage],
    own: Object.prototype.hasOwnProperty.call(window.__gs.player, 'releaseAim'), ammo: window.__gs.player.ammo });
  const cases = [['', null], [VIS, null], ['b1=G', 'G'], ['b1=m', 'M'], [join(VIS, 'b1=S'), 'S'], ['b1=X', null], ['b1=', null], ['b1=1', null]];
  for (const [fl, want] of cases) {
    const p = await boot(fl); await p.evaluate(() => window.__adv(5)); const r = await p.evaluate(probe); await p.close();
    const tune = want ? '10,110,260,120,600' : '3,120,520,120,600';
    check(`"${fl || '(none)'}": variant ${want ?? 'off'}, tuning ${tune}, ${want ? 'installed' : 'nothing installed'}`, r.v === want && r.b1 === !!want && r.t.join() === tune && r.own === !!want && r.ammo === (want ? 10 : 3), JSON.stringify(r));
  }
}

// ── 1. FLAG OFF = a3866f2 ────────────────────────────────────────────────
if (on(1) && OLD) {
  console.log(`\n== 1. flag off = ${B1_BASE} (${OLD})`);
  for (const [label, q, fl] of [['SWARM TIDE, R1', Q_SWARM, ''], ['MIXED s6, R1', Q_MIXED, ''], ['VANGUARD, R1', Q_VAN, ''], ['SWARM TIDE, legacy', Q_SWARM, 'baseline=legacy'],
    ['MIXED s6, V2C+P1+P2-A3', Q_MIXED, VIS], ['MIXED s6, V2C+P1+P2-A3 + B0 instrument', Q_MIXED, join(VIS, 'b0=A')], ['SWARM TIDE, R1 + B0 instrument', Q_SWARM, 'b0=1']]) {
    const a = await replay(fl, q, { base: OLD }), b = await replay(fl, q);
    const d = firstDiff(a.hashes, b.hashes);
    const evs = Object.keys({ ...a.ev, ...b.ev }).filter((k) => a.ev[k] !== b.ev[k]);
    check(`${label}: ${TICKS} ticks identical to ${B1_BASE} (state, ammo, draws, per-tick events)`, d < 0 && evs.length === 0, d < 0 ? `${a.draws} draws, ${a.kills} kills` : `first divergent tick ${d}; ${evs.join(',')}`);
  }
  const a = await replay(VIS, Q_MIXED, { base: OLD, god: false }), b = await replay(VIS, Q_MIXED, { god: false });
  const d = firstDiff(a.hashes, b.hashes);
  check(`MIXED s6, V2C+P1+P2-A3, god mode off: identical to ${B1_BASE}`, d < 0, d < 0 ? '' : `first divergent tick ${d}`);
} else if (on(1)) console.log('\n== 1. skipped (no --old=URL)');

// ── 2. VARIANT EQUIVALENCE ───────────────────────────────────────────────
if (on(2)) {
  console.log('\n== 2. variant equivalence (except the authorized changes)');
  for (const [label, q] of [['SWARM TIDE', Q_SWARM], ['MIXED s6', Q_MIXED], ['VANGUARD', Q_VAN]]) {
    const a = await replay(VIS, q, { fire: 0, pickAt: -1, clusterAt: -1, noAmmo: true }), b = await replay(join(VIS, 'b1=G'), q, { fire: 0, pickAt: -1, clusterAt: -1, noAmmo: true });
    const d = firstDiff(a.hashes, b.hashes);
    check(`${label}: Supers + melee, no STANDARD — B1-G = R1 tick for tick (Super, charge, knockback, draws, events)`, d < 0 && b.b1, d < 0 ? `${a.draws} draws, ${a.kills} kills` : `first divergent tick ${d}`);
  }
  for (const [label, q] of [['SWARM TIDE', Q_SWARM], ['MIXED s6', Q_MIXED]]) {
    const a = await replay(VIS, q, { fire: 40, noAmmo: true }), b = await replay(join(VIS, 'b1=G'), q, { fire: 40, noAmmo: true });
    const d = firstDiff(a.hashes, b.hashes);
    check(`${label}: STANDARD every 40 ticks (a 3-round magazine never empties) + Supers + melee + OVERRIDE + cluster — B1-G = R1 except the magazine fields`, d < 0, d < 0 ? `${a.draws} draws, ${a.kills} kills` : `first divergent tick ${d}`);
  }
  for (const [label, q] of [['SWARM TIDE', Q_SWARM], ['MIXED s6', Q_MIXED]]) {
    const g = await replay(join(VIS, 'b1=G'), q, { superAt: [] }), m = await replay(join(VIS, 'b1=M'), q, { superAt: [] }), s = await replay(join(VIS, 'b1=S'), q, { superAt: [] });
    const d1 = firstDiff(g.hashes, m.hashes), d2 = firstDiff(g.hashes, s.hashes);
    check(`${label}: rapid STANDARD + melee + pickups, no Super — B1-G = B1-M = B1-S tick for tick (incl. ammo)`, d1 < 0 && d2 < 0, `${g.draws} draws, ${g.kills} kills; M ${d1}, S ${d2}`);
  }
  // CONTROLS: the same comparisons can see a change
  {
    const a = await replay(VIS, Q_MIXED, { fire: 0, pickAt: -1, clusterAt: -1, noAmmo: true }), m = await replay(join(VIS, 'b1=M'), Q_MIXED, { fire: 0, pickAt: -1, clusterAt: -1, noAmmo: true });
    const d = firstDiff(a.hashes, m.hashes);
    check(`CONTROL: the Supers-only comparison FAILS for B1-M against R1 (first divergent tick ${d}) — it sees the Super change`, d >= 0);
    const r = await replay(VIS, Q_MIXED, { superAt: [] }), g = await replay(join(VIS, 'b1=G'), Q_MIXED, { superAt: [] });
    const d2 = firstDiff(r.hashes, g.hashes);
    check(`CONTROL: the rapid-STANDARD comparison FAILS for B1-G against R1 (first divergent tick ${d2}) — it sees the STANDARD change`, d2 >= 0);
  }
}

// ── 3. THE SUPER ─────────────────────────────────────────────────────────
const superStage = async (flags) => {
  const p = await boot(`${flags}&b0=1`);
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, out = {};
    const mult = P.dmgMult;
    const cast = (a = 0) => { P.superCharge = 999; P.tryFireSuper(a); };
    const st = () => gs._b1?.stats || { pushes: 0, pushImmune: 0, slowRefreshed: 0, slowApplied: 0, dedupSkipped: 0, pushDist: [] };
    const amts = []; gs.events.on('enemy-hit', (e, a) => { if (gs._superHitCtx) amts.push([e._miniBoss ? 'nemesis' : e.isChampion ? 'captain' : e._afterimage ? 'afterimage' : `${e.enemyType}${e._elite ? '*' : ''}`, Math.round(a * 1000) / 1000]); });
    const take = () => { const x = amts.slice(); amts.length = 0; return x; };
    // each Super recoils the player: put them back before every sub-stage
    const place = () => { P.x = 600; P.y = 900; P.body.reset(600, 900); };
    // (e) FIRST, on a clean state: a lethal pellet on a target frozen in place
    window.__stage();
    const k = gs.spawnEnemyAt('grunt', 680, 900); k.hp = k.hpMax = 50; window.__adv(1);
    k.body.setVelocity(0, 0); k._staggerMs = 2000; k._shoveMs = 0;
    cast(0);
    let corpseV = null; for (let i = 0; i < 20 && corpseV === null; i++) { window.__adv(1); if (!k.alive) corpseV = [Math.round(k.body.velocity.x), Math.round(k.body.velocity.y)]; }
    out.e = { corpseV }; take();
    // (a) a Regular grunt at 160px, made durable so it survives
    window.__stage();
    const g = gs.spawnEnemyAt('grunt', 760, 900); g.hp = g.hpMax = 8000; window.__adv(2);
    const base = g.cfg, spd0 = g.cfg.speed, x0 = g.x, y0 = g.y, punish0 = [g._punishMs || 0, g._punishMult || 1];
    const s0 = { ...st(), pushDist: st().pushDist.length };
    cast(0);
    let px0 = null, py0 = null, stagFrames = 0, seenStag = false, endX = null, endY = null, slowSpeed = null, slowStart = null, slowEnd = null;
    let aiSkipped = 0;
    for (let i = 0; i < 200; i++) {
      if ((g._staggerMs || 0) > 1000 / 60) aiSkipped++;
      window.__adv(1);
      if (g._staggerMs > 0) { if (!seenStag) { px0 = g.x; py0 = g.y; } stagFrames++; seenStag = true; }
      if (seenStag && endX === null && g._staggerMs <= 0) { endX = g.x; endY = g.y; }
      if (g.cfg !== base && slowStart === null) { slowStart = i; slowSpeed = g.cfg.speed; }
      if (slowStart !== null && slowEnd === null && g.cfg === base) slowEnd = i;
    }
    const S1 = st();
    const a = take();
    out.a = { hits: a.length, amts: [...new Set(a.map((x) => x[1]))], mult, push: endX === null ? 0 : Math.round(Math.hypot(endX - px0, endY - py0)), telemetryPush: S1.pushDist[s0.pushDist] ?? null,
      stagFrames, aiSkipped, slowSpeed, base: spd0, slowMs: slowEnd !== null ? Math.round((slowEnd - slowStart) * 1000 / 60) : null, cfgIsBase: g.cfg === base,
      pushes: S1.pushes - s0.pushes, dedup: S1.dedupSkipped - s0.dedupSkipped, slows: S1.slowApplied - s0.slowApplied, punish: [g._punishMs || 0, g._punishMult || 1], punish0 };
    // (b) immunity: a second cast right after the push ends, then a third later
    window.__clear(); place(); window.__adv(2);
    const g2 = gs.spawnEnemyAt('grunt', 760, 900); g2.hp = g2.hpMax = 8000; window.__adv(2);
    const b0 = { ...st() };
    cast(Math.atan2(g2.y - P.y, g2.x - P.x)); window.__adv(25);
    place(); cast(Math.atan2(g2.y - P.y, g2.x - P.x)); window.__adv(20);     // inside the 600ms immunity
    const mid = { p: st().pushes - b0.pushes, i: st().pushImmune - b0.pushImmune, r: st().slowRefreshed - b0.slowRefreshed };
    window.__adv(40); place(); cast(Math.atan2(g2.y - P.y, g2.x - P.x)); window.__adv(25);
    out.b = { pushesAfter2: mid.p, immune: mid.i, refreshed: mid.r, pushesAfter3: st().pushes - b0.pushes };
    take();
    // (c) chained Supers every 15 ticks (250ms) for 5s: the AI is never locked
    window.__clear(); place(); window.__adv(2);
    const g3 = gs.spawnEnemyAt('grunt', 760, 900); g3.hp = g3.hpMax = 1e7; window.__adv(2);
    let stag = 0, n = 0;
    // a frame's AI is skipped iff the stagger is still above one frame's delta
    // when that frame begins (Enemy.preUpdate decrements, then gates)
    for (let i = 0; i < 300; i++) { if (i % 15 === 0) { place(); cast(Math.atan2(g3.y - P.y, g3.x - P.x)); } const before = g3._staggerMs || 0; window.__adv(1); n++; if (before > 1000 / 60) stag++; }
    out.c = { stagShare: stag / n }; take();
    // (d) Elite and Bulwark: damage per pellet, one push each
    window.__clear(); place(); window.__adv(2);
    const el = gs.spawnEnemyAt('grunt', 760, 885, { elite: true }); el.hp = el.hpMax = 9000;
    const bw = gs.spawnEnemyAt('shielded', 760, 935); bw.hp = bw.hpMax = 9000;
    window.__adv(2);
    const pB = st().pushes;
    cast(Math.atan2(910 - P.y, 760 - P.x)); window.__adv(30);
    out.d = { amts: take(), pushes: st().pushes - pB };
    // (f) self-recharge: every Super pellet hit on an ordinary enemy still
    // charges the Super (B0 charge accounting vs B0 hit count)
    const rec = gs._b0.record();
    out.f = { events: rec.charge.super.super?.events || 0, hits: rec.player.hits.super, melee: rec.charge.melee.super?.events || 0 };
    // (g) R1 targets: nemesis, Shock Captain, afterimage — per-pellet damage, no push / slow
    window.__clear(); place(); window.__adv(2);
    const pG = st().pushes, slG = st().slowApplied;
    const mb = gs._spawnMiniBoss(); window.__adv(5);
    let nemSpeed = null;
    if (mb) { mb.x = 760; mb.y = 900; mb.body.reset(760, 900); mb.hp = mb.hpMax = 1e6; window.__adv(1); const s = mb.cfg.speed; cast(Math.atan2(mb.y - P.y, mb.x - P.x)); window.__adv(25); nemSpeed = mb.cfg.speed === s; }
    window.__clear(); place(); window.__adv(2);
    const cap = gs.spawnChampion(760, 900, 'captain'); window.__adv(3);
    if (cap) { cap.hp = cap.hpMax = 1e6; window.__adv(1); cast(Math.atan2(cap.y - P.y, cap.x - P.x)); window.__adv(25); }
    window.__clear(); place(); window.__adv(2);
    const ai = gs.spawnEnemyAt('grunt', 760, 900, {}); ai._afterimage = true; ai.hp = ai.hpMax = 9000; window.__adv(1);
    const aiS = ai.cfg.speed; cast(Math.atan2(ai.y - P.y, ai.x - P.x)); window.__adv(25);
    const gA = take();
    const by = (t) => [...new Set(gA.filter((x) => x[0] === t).map((x) => x[1]))];
    out.g = { nemesis: by('nemesis'), captain: by('captain'), afterimage: by('afterimage'), nemSpeed, aiSpeed: ai.cfg.speed === aiS, pushes: st().pushes - pG, slows: st().slowApplied - slG };
    return out;
  });
  await p.close();
  return r;
};
if (on(3)) {
  console.log('\n== 3. the Super');
  const R1 = await superStage('b1=G');
  const want = { M: { dmg: 300, push: 90, ms: 150, slow: 0.25, slowMs: 1500 }, S: { dmg: 150, push: 180, ms: 200, slow: 0.40, slowMs: 2000 } };
  check(`B1-G (control): the Super is R1 — 600 per pellet (${JSON.stringify(R1.a.amts)}), no B1 push / slow`, R1.a.amts.length === 1 && R1.a.amts[0] === 600 * R1.a.mult && R1.a.pushes === 0 && R1.a.slows === 0 && R1.a.slowSpeed === null);
  for (const v of ['M', 'S']) {
    const r = await superStage(`b1=${v}`), w = want[v];
    check(`B1-${v}: ${w.dmg} per pellet on a Regular (×dmgMult ${r.a.mult}); ${r.a.hits} pellets of one cast hit it`, r.a.amts.length === 1 && r.a.amts[0] === w.dmg * r.a.mult && r.a.hits >= 2, JSON.stringify(r.a.amts));
    check(`B1-${v}: ONE push and ONE slow for ${r.a.hits} pellets (${r.a.dedup} duplicates skipped); push ${r.a.push}px measured / ${r.a.telemetryPush}px recorded (target ~${w.push}, ±25%)`,
      r.a.pushes === 1 && r.a.slows === 1 && r.a.dedup === r.a.hits - 1 && Math.abs(r.a.push - w.push) <= w.push * 0.25 && Math.abs(r.a.telemetryPush - r.a.push) <= 8, JSON.stringify(r.a));
    check(`B1-${v}: movement ${Math.round(r.a.slowSpeed)} = ${Math.round((1 - w.slow) * 100)}% of ${Math.round(r.a.base)} for ${r.a.slowMs}ms (target ${w.slowMs}, ±2 frames), then the ORIGINAL cfg object restored`,
      Math.abs(r.a.slowSpeed - r.a.base * (1 - w.slow)) < 0.01 && Math.abs(r.a.slowMs - w.slowMs) <= 34 && r.a.cfgIsBase);
    check(`B1-${v}: no damage-vulnerability window (punish ${JSON.stringify(r.a.punish)} = ${JSON.stringify(r.a.punish0)}); AI skipped only for the push (${r.a.aiSkipped} frames ≤ ${Math.ceil(w.ms / (1000 / 60)) + 1})`,
      JSON.stringify(r.a.punish) === JSON.stringify(r.a.punish0) && r.a.aiSkipped >= 1 && r.a.aiSkipped <= Math.ceil(w.ms / (1000 / 60)) + 1);
    check(`B1-${v}: re-push immunity — a second cast inside 600ms refreshes the slow but does not push; a later cast pushes again (${JSON.stringify(r.b)})`, r.b.pushesAfter2 === 1 && r.b.immune >= 1 && r.b.refreshed >= 1 && r.b.pushesAfter3 === 2);
    check(`B1-${v}: Supers chained every 250ms for 5s: AI suspended ${(r.c.stagShare * 100).toFixed(0)}% of frames (no lock; bound 25%)`, r.c.stagShare <= 0.25);
    const dTypes = new Set(r.d.amts.map((x) => x[0]));
    check(`B1-${v}: an Elite and a Bulwark take ${w.dmg}/pellet and are pushed once each (${JSON.stringify([...new Set(r.d.amts.map((x) => x.join(':')))])}, ${r.d.pushes} pushes)`,
      dTypes.has('grunt*') && dTypes.has('shielded') && r.d.amts.every((x) => x[1] === w.dmg * r.a.mult) && r.d.pushes === 2);
    check(`B1-${v}: a lethal pellet slides the corpse exactly as R1 (${JSON.stringify(r.e.corpseV)} = ${JSON.stringify(R1.e.corpseV)})`, !!r.e.corpseV && JSON.stringify(r.e.corpseV) === JSON.stringify(R1.e.corpseV));
    check(`B1-${v}: self-recharge unchanged — every Super pellet hit charged the Super and Broken Wings (${r.f.events} / ${r.f.melee} events = ${r.f.hits} hits; R1 ${R1.f.events} = ${R1.f.hits})`,
      r.f.events === r.f.hits && r.f.melee === r.f.hits && R1.f.events === R1.f.hits && r.f.hits > 0);
    check(`B1-${v}: nemesis, Shock Captain and afterimage take the R1 Super per pellet (${JSON.stringify({ n: r.g.nemesis, c: r.g.captain, a: r.g.afterimage })} = R1 ${JSON.stringify({ n: R1.g.nemesis, c: R1.g.captain, a: R1.g.afterimage })}), never pushed or slowed`,
      JSON.stringify([r.g.nemesis, r.g.captain, r.g.afterimage]) === JSON.stringify([R1.g.nemesis, R1.g.captain, R1.g.afterimage]) && r.g.nemesis.length > 0 && r.g.captain.length > 0 && r.g.afterimage.length > 0 && r.g.pushes === 0 && r.g.slows === 0 && r.g.nemSpeed && r.g.aiSpeed);
  }
  // push distance with a 30 Hz step (a slow phone)
  const p = await boot('b1=S');
  const fr = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player; window.__stage();
    const g = gs.spawnEnemyAt('grunt', 760, 900); g.hp = g.hpMax = 9000; window.__adv(2);
    P.superCharge = 999; P.tryFireSuper(0);
    for (let i = 0; i < 30; i++) window.__adv(1, 1000 / 30);
    return { rec: gs._b1.stats.pushDist[0] };
  });
  await p.close();
  check(`B1-S at a 30 Hz step: push ${fr.rec}px recorded (target ~180, ±15%)`, Math.abs(fr.rec - 180) <= 27);
  // Vader: the boss path is untouched; same damage per pellet as R1
  const vader = async (fl) => {
    const pg = await boot(fl, { q: 'room=hangar' });
    const r = await pg.evaluate(() => {
      const gs = window.__gs, P = gs.player; window.__stage();
      gs.spawnBoss(760, 900); window.__adv(5);
      if (!gs.boss) return null;
      gs.boss.x = 760; gs.boss.y = 900; gs.boss.body.reset(760, 900); gs.boss.hp = gs.boss.hpMax = 1e7;
      gs.boss.isReflecting = () => false; window.__adv(1);
      const amts = []; gs.events.on('boss-hit', (bb, a) => amts.push(Math.round(a)));
      P.superCharge = 999; P.tryFireSuper(Math.atan2(gs.boss.y - P.y, gs.boss.x - P.x)); window.__adv(30);
      return { amts: [...new Set(amts)], pushes: gs._b1?.stats?.pushes ?? 0 };
    });
    await pg.close();
    return r;
  };
  const vG = await vader('b1=G'), vS = await vader('b1=S');
  check(`Vader takes the R1 Super under B1-S (per pellet ${JSON.stringify(vS?.amts)} = B1-G ${JSON.stringify(vG?.amts)}; ${vS?.pushes} pushes)`, vG && vS && vG.amts.length > 0 && JSON.stringify(vG.amts) === JSON.stringify(vS.amts) && vS.pushes === 0);
}

// ── 4. STANDARD + CONTROLS ───────────────────────────────────────────────
if (on(4)) {
  console.log('\n== 4. STANDARD and controls');
  const p = await boot('b1=G&b0=G');
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, hud = window.game.scene.getScene('HUD'), fs = hud.fireStick, out = {};
    window.__stage();
    const shots = []; const onF = (dir) => shots.push([window.__t, P.ammo, Math.round(dir * 1000) / 1000]);
    gs.events.on('player-fire', onF);
    // tap: press + release within 3 frames -> one shot
    window.__adv(30); fs.handleDown({ id: 3, x: 600, y: 1000 }); window.__adv(3); fs.handleUp({ id: 3, x: 600, y: 1000 }); window.__adv(5);
    out.tap = shots.length;
    // hold with a manual aim straight up (angle -PI/2) for 2.5s
    shots.length = 0; window.__adv(120); P.ammo = 10; P.ammoTimers = [];
    fs.handleDown({ id: 4, x: 600, y: 1000 }); fs.handleMove({ id: 4, x: 600, y: 900 });
    for (let i = 0; i < 210; i++) window.__adv(1);
    const beforeUp = shots.length;
    fs.handleUp({ id: 4, x: 600, y: 900 }); window.__adv(5);
    const iv = shots.slice(1).map((s, i) => Math.round(s[0] - shots[i][0]));
    out.hold = { n: beforeUp, afterUp: shots.length - beforeUp, iv: iv.slice(0, beforeUp - 1), dirs: [...new Set(shots.map((s) => s[2]))] };
    // hold without dragging: auto-aim at the nearest enemy
    shots.length = 0; window.__adv(200); P.ammo = 10; P.ammoTimers = [];
    const t = gs.spawnEnemyAt('grunt', 900, 900); t.hp = t.hpMax = 1e5; t.body.moves = false; window.__adv(2);
    fs.handleDown({ id: 5, x: 600, y: 1000 }); for (let i = 0; i < 40; i++) window.__adv(1); fs.handleUp({ id: 5, x: 600, y: 1000 }); window.__adv(3);
    out.autoAim = { n: shots.length, dirs: [...new Set(shots.map((s) => s[2]))], want: Math.round(Math.atan2(t.y - P.y, t.x - P.x) * 1000) / 1000 };
    window.__clear(); window.__adv(2);
    // OVERRIDE: a hold never auto-repeats it; the release fires one burst (R1)
    let rounds = 0; const onR = () => rounds++; gs.events.on('player-fire-rifle', onR);
    P.equipSecondary('rifle'); window.__adv(2);
    fs.handleDown({ id: 6, x: 600, y: 1000 }); for (let i = 0; i < 60; i++) window.__adv(1);
    const roundsHeld = rounds;
    fs.handleUp({ id: 6, x: 600, y: 1000 }); window.__adv(20);
    out.override = { held: roundsHeld, afterRelease: rounds, secAmmo: P.secondaryAmmo };
    gs.events.off('player-fire-rifle', onR);
    // the cluster pod: no auto throw while held
    let throws = 0; const onC = () => throws++; gs.events.on('player-fire-cluster', onC);
    P.equipSecondary('cluster'); window.__adv(2);
    fs.handleDown({ id: 7, x: 600, y: 1000 }); for (let i = 0; i < 90; i++) window.__adv(1);
    const throwsHeld = throws; fs.handleUp({ id: 7, x: 600, y: 1000 }); window.__adv(5);
    out.cluster = { held: throwsHeld, afterRelease: throws };
    gs.events.off('player-fire-cluster', onC);
    P._equipNothing?.(); gs.events.emit('secondary-equipped', null); window.__adv(2);
    // the fire stick does not claim a press on the Super / melee buttons
    const sb = hud.superButton, mbn = hud.meleeButton;
    const sxy = sb ? [sb.x ?? sb.base?.x, sb.y ?? sb.base?.y] : null, mxy = mbn ? [mbn.x ?? mbn.base?.x, mbn.y ?? mbn.base?.y] : null;
    if (sxy) { fs.handleDown({ id: 8, x: sxy[0], y: sxy[1] }); out.claimSuper = fs.active; if (fs.active) fs.handleUp({ id: 8, x: sxy[0], y: sxy[1] }); }
    if (mxy) { fs.handleDown({ id: 9, x: mxy[0], y: mxy[1] }); out.claimMelee = fs.active; if (fs.active) fs.handleUp({ id: 9, x: mxy[0], y: mxy[1] }); }
    // HUD pips: ten, inside the canvas, 15px apart; and again after a relayout
    const xs = () => hud.ammoPips.map((q) => Math.round(q.x));
    out.pips = { n: hud.ammoPips.length, xs: xs() }; hud._layoutChrome(); out.pips.after = xs();
    out.tune = [P.ammo, window.__cfg.PLAYER.ammoMax];
    gs.events.off('player-fire', onF);
    return out;
  });
  check(`a quick tap fires exactly one shot (${r.tap})`, r.tap === 1);
  const ivs = r.hold.iv, isFast = (d) => d >= 100 && d <= 134, isSlow = (d) => d >= 250 && d <= 284;
  const switchAt = ivs.findIndex((d) => !isFast(d));
  const pattern = switchAt > 9 && ivs.slice(0, switchAt).every(isFast) && ivs.slice(switchAt).every(isSlow) && ivs.length - switchAt >= 3;
  check(`hold (3.5s, aimed up): ${switchAt} shots at the 110ms cooldown (${ivs.slice(0, 4).join('/')}… ms, the 10-round magazine refilling as it fires), then the 260ms sequential regeneration (${ivs.slice(switchAt, switchAt + 4).join('/')}…); ${r.hold.n} shots`, pattern, JSON.stringify(ivs));
  check(`hold: every shot along the stick (${JSON.stringify(r.hold.dirs)}), and the release adds no shot (${r.hold.afterUp})`, r.hold.dirs.length === 1 && Math.abs(r.hold.dirs[0] + Math.PI / 2) < 0.01 && r.hold.afterUp === 0);
  check(`hold without dragging: auto-fire at the nearest enemy (${JSON.stringify(r.autoAim)})`, r.autoAim.n >= 2 && r.autoAim.dirs.length === 1 && Math.abs(r.autoAim.dirs[0] - r.autoAim.want) < 0.01);
  check(`OVERRIDE unchanged: a 1s hold never auto-repeats it (${r.override.held} rounds while held), the release fires one 3-round burst as R1 (${r.override.afterRelease})`, r.override.held === 0 && r.override.afterRelease === 3);
  check(`the cluster pod never auto-throws while held (${r.cluster.held}); the release throws one (${r.cluster.afterRelease})`, r.cluster.held === 0 && r.cluster.afterRelease === 1);
  check(`the fire stick does not claim presses on the Super / melee buttons (${r.claimSuper} / ${r.claimMelee})`, r.claimSuper === false && r.claimMelee === false);
  const fits = (a) => a.length === 10 && a.every((x) => x >= 0 && x <= 720) && a.slice(1).every((x, i) => x - a[i] === 15);
  check(`ten HUD ammo pips inside the 720px canvas, 15px apart, also after a relayout (${r.pips.xs[0]}–${r.pips.xs[9]})`, fits(r.pips.xs) && fits(r.pips.after));
  await p.close();
  // SPACE: tap = one shot, hold = auto-fire, a full meter makes SPACE the Super
  const pk = await boot('b1=G&b0=G');
  await pk.evaluate(() => { window.__stage(); window.__shots = 0; window.__gs.events.on('player-fire', () => window.__shots++); window.__supers = 0; window.__gs.events.on('player-fire-super', () => window.__supers++); });
  await pk.keyboard.down('Space'); await pk.evaluate(() => window.__adv(3)); await pk.keyboard.up('Space'); await pk.evaluate(() => window.__adv(30));
  const kTap = await pk.evaluate(() => window.__shots);
  await pk.keyboard.down('Space'); await pk.evaluate(() => window.__adv(60)); await pk.keyboard.up('Space'); await pk.evaluate(() => window.__adv(5));
  const kHold = await pk.evaluate(() => window.__shots) - kTap;
  await pk.evaluate(() => { window.__gs.player.superCharge = 999; window.__adv(2); });
  const s0 = await pk.evaluate(() => [window.__shots, window.__supers]);
  await pk.keyboard.down('Space'); await pk.evaluate(() => window.__adv(30)); await pk.keyboard.up('Space'); await pk.evaluate(() => window.__adv(30));
  const s1 = await pk.evaluate(() => [window.__shots, window.__supers]);
  await pk.close();
  check(`SPACE: a tap fires one shot (${kTap}); a 1s hold auto-fires (${kHold} shots); with a full meter SPACE is still the Super and no STANDARD auto-fire runs during its aim hold (${s1[1] - s0[1]} Super, ${s1[0] - s0[0]} shots)`, kTap === 1 && kHold >= 6 && s1[1] - s0[1] === 1 && s1[0] - s0[0] === 0);
  // a REAL touch hold and tap on a touch device (CDP touch events)
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const pt = await boot('b1=G&b0=G', { ctx });
  const cdp = await ctx.newCDPSession(pt);
  const xy = await pt.evaluate(() => { const c = window.game.canvas.getBoundingClientRect(); const s = c.width / 720; return [c.left + 600 * s, c.top + 1000 * s]; });
  await pt.evaluate(() => { window.__stage(); window.__shots = 0; window.__gs.events.on('player-fire', () => window.__shots++); });
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await touch('touchStart', [{ x: xy[0], y: xy[1] }]); await pt.evaluate(() => window.__adv(3)); await touch('touchEnd', []); await pt.evaluate(() => window.__adv(20));
  const tTap = await pt.evaluate(() => window.__shots);
  await touch('touchStart', [{ x: xy[0], y: xy[1] }]); await pt.evaluate(() => window.__adv(2));
  await touch('touchMove', [{ x: xy[0] + 40, y: xy[1] }]); await pt.evaluate(() => window.__adv(80)); await touch('touchEnd', []); await pt.evaluate(() => window.__adv(5));
  const tHold = await pt.evaluate(() => window.__shots) - tTap;
  const tStats = await pt.evaluate(() => ({ hold: window.__gs._b1.stats.hold, input: window.__gs._b0.record().input }));
  await ctx.close();
  check(`REAL touch: a tap fires one shot (${tTap}); a 1.3s hold auto-fires (${tHold}) with no release shot; recorded as touch (${tStats.hold.stickTouchPresses} touch presses; ${tStats.input.stickShotsTouch} touch stick shots)`,
    tTap === 1 && tHold >= 8 && tStats.hold.stickTouchPresses === 2 && tStats.input.stickShotsTouch === tTap + tHold && tStats.hold.releaseShotsSuppressed >= 1, JSON.stringify(tStats));
}

// ── 5. RESTARTS ──────────────────────────────────────────────────────────
if (on(5)) {
  console.log('\n== 5. restarts');
  const p = await boot('b1=S&b0=S');
  const shotsN = (k) => p.evaluate((k) => {
    const gs = window.__gs = window.game.scene.getScene('Game'); const hud = window.game.scene.getScene('HUD');
    for (let i = 0; i < 400 && !gs.roomSpec; i++) window.__adv(1);
    window.__adv(30); window.__clear(); window.__adv(2);
    const P = gs.player; let n = 0; const f = () => n++; gs.events.on('player-fire', f);
    for (let i = 0; i < k; i++) { hud.fireStick.handleDown({ id: 20 + i, x: 600, y: 1000 }); window.__adv(2); hud.fireStick.handleUp({ id: 20 + i, x: 600, y: 1000 }); window.__adv(10); }
    gs.events.off('player-fire', f);
    let chain = 0; let fn = P.releaseAim; const own = Object.prototype.hasOwnProperty.call(P, 'releaseAim');
    const b0n = gs._b0?.record()?.player?.fired?.standard;
    return { n, own, b1: !!gs._b1, variant: gs._b1?.variant, tune: [window.__cfg.PLAYER.ammoMax, window.__cfg.PLAYER.fireCooldownMs, window.__cfg.PLAYER.ammoReloadMs], ammo: P.ammo,
      pips: hud.ammoPips.map((q) => Math.round(q.x)), b0: b0n, postupdate: gs.events.listenerCount('postupdate') };
  }, k);
  const r0 = await shotsN(5);
  await p.evaluate(() => { const gs = window.__gs; gs.scene.pause(); gs.scene.launch('Pause'); window.__adv(2); window.game.scene.getScene('Pause')._restart(); window.__adv(30); });
  const r1 = await shotsN(5);
  await p.evaluate(() => { const gs = window.__gs; gs.scene.pause(); gs.scene.launch('Pause'); window.__adv(2); window.game.scene.getScene('Pause')._quit(); window.__adv(20); window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 7 }); window.__adv(10); });
  const r2 = await shotsN(5);
  check(`Pause-menu RESTART and QUIT + new run: B1-S installed once each run, 5 taps = 5 shots (B0 counts ${r1.b0} / ${r2.b0}), tuning kept, pips refitted, postupdate listeners steady (${r0.postupdate}/${r1.postupdate}/${r2.postupdate})`,
    [r0, r1, r2].every((r) => r.n === 5 && r.b1 && r.variant === 'S' && r.tune.join() === '10,110,260' && r.pips.length === 10 && r.pips[9] - r.pips[0] === 135) && r1.b0 === 5 && r2.b0 === 5 && r0.postupdate === r1.postupdate && r1.postupdate === r2.postupdate,
    JSON.stringify([r0, r1, r2].map((r) => ({ n: r.n, b0: r.b0, pu: r.postupdate, p0: r.pips[0] }))));
  await p.reload(); await p.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
  const rl = await p.evaluate(async () => { const d = await (async () => { const u = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n)); return import(u); })(); const c = await import(performance.getEntriesByType('resource').map((r) => r.name).find((n) => /\/src\/config\.js/.test(n))); return { v: d.getB1Variant(), t: [c.PLAYER.ammoMax, c.PLAYER.fireCooldownMs, c.PLAYER.ammoReloadMs] }; });
  check(`a reload keeps the variant and its tuning (${JSON.stringify(rl)})`, rl.v === 'S' && rl.t.join() === '10,110,260');
  // a slowed enemy alive at a restart: its cfg is restored, nothing leaks
  await p.close();
}

// ── 6. TELEMETRY ─────────────────────────────────────────────────────────
if (on(6)) {
  console.log('\n== 6. telemetry');
  const p = await boot('b1=M&b0=M');
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, hud = window.game.scene.getScene('HUD'), fs = hud.fireStick;
    window.__stage();
    const t = gs.spawnEnemyAt('grunt', 760, 900); t.hp = t.hpMax = 1e5; t.body.moves = false; window.__adv(2);
    // observe the real meter increments
    let supGain = 0, melGain = 0, ls = P.superCharge, lm = P.meleeCharge;
    const watch = () => { if (P.superCharge > ls) supGain += P.superCharge - ls; if (P.meleeCharge > lm) melGain += P.meleeCharge - lm; ls = P.superCharge; lm = P.meleeCharge; };
    gs.events.on('postupdate', watch);
    const R0 = JSON.parse(JSON.stringify(gs._b0.record().input.standard));
    for (let i = 0; i < 3; i++) { fs.handleDown({ id: 30 + i, x: 600, y: 1000 }); window.__adv(2); fs.handleUp({ id: 30 + i, x: 600, y: 1000 }); window.__adv(40); }
    fs.handleDown({ id: 40, x: 600, y: 1000 }); for (let i = 0; i < 60; i++) window.__adv(1); fs.handleUp({ id: 40, x: 600, y: 1000 }); window.__adv(40);
    gs.events.off('postupdate', watch); watch();
    const rec = gs._b0.record();
    const inp = rec.input.standard;
    const holdShots = gs._b1.stats.hold.stickHoldShots;
    const ch = rec.charge;
    const sumAdded = (m) => Object.values(ch[m]).reduce((s, c) => s + c.added, 0);
    const supAdded = sumAdded('super'), melAdded = sumAdded('melee');   // before the Super below adds its own
    // push + slow vs measured, then export
    window.__clear(); window.__adv(2);
    const g = gs.spawnEnemyAt('grunt', 760, 900); g.hp = g.hpMax = 1e5; window.__adv(2);
    const slow0 = gs._b1.stats.slowedMs; P.superCharge = 999; P.tryFireSuper(0);
    let x0 = null, y0 = null, endX = null, endY = null, seen = false;
    for (let i = 0; i < 160; i++) { window.__adv(1); if (g._staggerMs > 0 && !seen) { seen = true; x0 = g.x; y0 = g.y; } if (seen && endX === null && g._staggerMs <= 0) { endX = g.x; endY = g.y; } }
    const snap = gs._b0.snapshot();
    return { taps: inp['tap-stick'] - (R0['tap-stick'] || 0), holds: inp['hold-stick'] - (R0['hold-stick'] || 0), holdShots,
      stdEvents: ch.super.standard?.events || 0, stdHits: rec.player.hits.standard, supAdded, supGain, melAdded, melGain,
      pushRec: snap.b1.pushDist.at(-1), pushMeasured: Math.round(Math.hypot(endX - x0, endY - y0)), slowed: snap.b1.slowedMs - slow0, variant: snap.run.config.b1, b1v: snap.b1.variant, keys: Object.keys(snap) };
  });
  await p.close();
  check(`export: run.config.b1 = "${r.variant}", b1 block present (${r.b1v}), input / charge sections present`, r.variant === 'M' && r.b1v === 'M' && ['input', 'charge', 'b1'].every((k) => r.keys.includes(k)));
  check(`input mode: 3 taps recorded as tap-stick (${r.taps}), the hold's ${r.holdShots} shots as hold-stick (${r.holds})`, r.taps === 3 && r.holds === r.holdShots && r.holdShots > 3);
  check(`charge sources: STANDARD charge events = STANDARD hits (${r.stdEvents} = ${r.stdHits}); units added = the meters' real increments (Super ${r.supAdded.toFixed(2)} = ${r.supGain.toFixed(2)}, melee ${r.melAdded.toFixed(2)} = ${r.melGain.toFixed(2)})`,
    r.stdEvents === r.stdHits && r.stdHits > 0 && Math.abs(r.supAdded - r.supGain) < 1e-6 && Math.abs(r.melAdded - r.melGain) < 1e-6);
  check(`push distance recorded = measured (${r.pushRec} = ${r.pushMeasured}px ±8); slowed time recorded ${Math.round(r.slowed)}ms for one 1500ms slow (±2 frames)`, Math.abs(r.pushRec - r.pushMeasured) <= 8 && Math.abs(r.slowed - 1500) <= 34);
  // damage truth in seeded M and S fights
  for (const v of ['M', 'S']) {
    const pg = await boot(`b1=${v}&b0=${v}`, { q: Q_MIXED });
    const t = await pg.evaluate((o) => {
      const gs = window.__gs; let requested = 0;
      gs.events.on('enemy-hit', (e, a) => { requested += a; });
      window.__trace(o);
      const rec = gs._b0.record();
      let lost = 0, dmg = 0, over = 0;
      for (const e of rec.enemies) {
        dmg += Object.values(e.dmg).reduce((x, y) => x + y, 0); over += Object.values(e.overkill).reduce((x, y) => x + y, 0);
        if (e.fate === 'killed' || e.fate === 'takedown') lost += e.hpMax; else if (e.fate === 'alive' && e._actor) lost += e.hpMax - e._actor.hp;
      }
      const kills = Object.values(rec.player.kills).reduce((x, y) => x + y, 0), killed = rec.enemies.filter((e) => e.fate === 'killed').length;
      return { lost, dmg, over, requested, kills, killed, sup: rec.player.dmg.super, pushes: gs._b1.stats.pushes, errors: rec.errors || 0 };
    }, { seed: 9071, ticks: TICKS, seg: FIGHT_SEG, fire: 7, superAt: [200, 350, 500, 650, 800, 950, 1100, 1250, 1400], melee: MELEE, pickAt: PICK, clusterAt: CLUSTER, noAmmo: false });
    await pg.close();
    const near = (a, b) => Math.abs(a - b) < 0.01 * Math.max(1, b);
    check(`B1-${v} seeded fight (MIXED s6): recorded dmg = durability lost (${Math.round(t.dmg)} = ${Math.round(t.lost)}), dmg + overkill = requested (${Math.round(t.requested)}), kills = deaths (${t.kills} = ${t.killed}); ${t.pushes} pushes`,
      near(t.dmg, t.lost) && near(t.dmg + t.over, t.requested) && t.kills === t.killed && t.errors === 0 && t.pushes > 0);
  }
}

// ── 7. NO NEW RANDOM DRAWS ───────────────────────────────────────────────
if (on(7)) {
  console.log('\n== 7. no new random draws');
  const src = readFileSync('src/systems/b1Combat.js', 'utf8').replace(/\/\/.*$/gm, '');
  check('b1Combat.js contains no Math.random', !/Math\.random/.test(src));
  const p = await boot('b1=S&b0=S', { q: Q_MIXED });
  const r = await p.evaluate(() => {
    const gs = window.__gs, P = gs.player, hud = window.game.scene.getScene('HUD');
    // wrap the B1 frame hook (found by its body) and the B1 Super hit; count
    // draws made by B1 itself (not by the Enemy.damage call it makes)
    const fns = gs.events.listeners('postupdate'); const hook = fns.find((f) => /tickHold/.test(String(f)));
    let own = 0, inHook = false, inDamage = 0;
    const rnd = Math.random; Math.random = () => { if ((inHook || inSuper) && !inDamage) own++; return rnd(); };
    let inSuper = false;
    gs.events.off('postupdate', hook); gs.events.on('postupdate', function (...a) { inHook = true; try { return hook.apply(this, a); } finally { inHook = false; } });
    // a held shot goes through the game's own fire path (muzzle FX draw exactly
    // as a tapped shot does): those draws are the game's, not B1's
    const tf = P.tryFire; P.tryFire = function (...a) { inDamage++; try { return tf.apply(this, a); } finally { inDamage--; } };
    const sh = gs._b1.superHit; gs._b1.superHit = (e, b, kb) => { inSuper = true; const d0 = e.damage; e.damage = function (...a) { inDamage++; try { return d0.apply(this, a); } finally { inDamage--; } }; try { return sh(e, b, kb); } finally { delete e.damage; inSuper = false; } };
    let hits0 = gs._b1.stats.superHits, pushes0 = gs._b1.stats.pushes;
    for (let i = 0; i < 900; i++) {
      if (i % 90 === 10) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
      if (i === 200) hud.fireStick.handleDown({ id: 50, x: 600, y: 1000 });
      if (i === 400) hud.fireStick.handleUp({ id: 50, x: 600, y: 1000 });
      window.__adv(1);
    }
    return { own, hits: gs._b1.stats.superHits - hits0, pushes: gs._b1.stats.pushes - pushes0, holdShots: gs._b1.stats.hold.stickHoldShots, slowedMs: gs._b1.stats.slowedMs };
  });
  await p.close();
  check(`900 ticks of MIXED s6 under B1-S with Supers, pushes, slows and a held stick: zero Math.random draws made by B1's own code — outside the game's shot and damage paths it calls (${r.own})`, r.own === 0 && r.hits > 0 && r.pushes > 0 && r.holdShots > 0, JSON.stringify(r));
}

// ── 8. FROZEN FILES ──────────────────────────────────────────────────────
if (on(8)) {
  console.log('\n== 8. frozen files');
  const s1 = b1Scope();
  check(`after ${B1_BASE}: only B1's files and lines (${s1.files.join(', ')})`, s1.ok, s1.ok ? `GameScene +${s1.gsAdded}` : JSON.stringify(s1.bad));
  const s0 = b0Scope();
  check('the B0 range (dc7d9ea..a3866f2) is still B0\'s alone', s0.ok, s0.detail);
  let fz = 'x'; try { fz = execSync(`git diff --name-only ${B1_BASE} -- src/entities src/config.js src/data`, { encoding: 'utf8' }).trim(); } catch (_) { /* */ }
  const g = enemyJsGuard(process.cwd() + '/');
  check(`entities, config.js and data untouched since ${B1_BASE}; Enemy.js guard`, fz === '' && g.outside && g.bomberOnlyVeto && g.vetoCode, fz || g.detail);
}

await browser.close();
const fail = results.filter((r) => !r.ok);
console.log(`\n${results.length - fail.length}/${results.length} passed`);
process.exit(fail.length ? 1 : 0);
