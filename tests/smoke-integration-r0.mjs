// SMOKE: THE INTEGRATED CONFIGURATION AND ITS PRODUCTION ROLLOUT (R0 + R1).
// Standalone; needs `npm run dev` on :5173 and, for section 7, a PRE-ROLLOUT
// server (`2ab24af`, or any build before R1) on :5174 (`--old=URL`).
//
// R0 measured the integrated configuration "C"; R1 made it the no-flags
// default. This pins both facts, so a later change to any seam, flag, default
// or install order that breaks them is caught without the R0 matrix. It asserts
// nothing about how good the fight is (the handset's job), only that:
//   0  THE DEFAULT: a page with NO query flags runs exactly C, and says so
//      (`getGameplayBaseline() === 'production'`); `?baseline=legacy` runs the
//      pre-R1 game; the old handset C URL and `?marksmanStuck=off` (B) parse
//      as they should; every one of the seven switches can be turned on alone
//      from the legacy baseline and off alone from the production one
//   1  the R0 labels parse exactly (A = legacy, B, C — `bootPage` pins legacy)
//   2  every seam lands on exactly the actors its approval names — in A, B, C
//      and the no-flags default: T1 on every ordinary Marksman; Marksman
//      stuck-B with C / the default; Bulwark stuck-B on every Bulwark; T2 on
//      every free Bulwark and on NO screen; v2.2 on every Gunner and Rifleman;
//      nothing on the Captain, a swarmling or a nemesis; nothing at all in A
//   3  VANGUARD + Captain: B, C and B-without-T2 are the same fight tick for
//      tick; the front and Captain clocks are A's
//   4  Bulwark flags inert with no Bulwark (T1's own handset URL == C)
//   5  the R0 observer is inert
//   6  THE DEFAULT IS C TICK FOR TICK: the no-flags page, legacy-baseline C
//      and the old C URL are the same fight (trace + draws + spawn order) in
//      MIXED, SNIPER NEST, VANGUARD + Captain and an ordinary progression cell;
//      `?marksmanStuck=off` on the default is legacy-baseline B
//   7  AGAINST THE PRE-ROLLOUT BUILD: `?baseline=legacy` here is that build's
//      no-flags game, and the no-flags default here is that build's C URL —
//      tick for tick, draw for draw
//   8  RESTART, QUIT-TO-TITLE AND RELOAD keep the effective configuration
// `--selftest` swaps B and C (checks 1, 2 and 4 must FAIL) and runs only 1–5.
//
// usage: node tests/smoke-integration-r0.mjs [--old=URL] [--selftest]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME, bootPage } from './diag-stuck-audit.mjs';
import { installTac } from './diag-tactical-engagement.mjs';
import { CONFIGS as CFG0, Q, installR0, bootOpts as bootOpts0 } from './diag-integrated-r0.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const SELF = process.argv.includes('--selftest');
const OLD = opt('old', 'http://localhost:5174/');
const CONFIGS = SELF ? { ...CFG0, B: CFG0.C, C: CFG0.B } : CFG0;
const bootOpts = (cfg) => ({ ...bootOpts0(cfg), flags: CONFIGS[cfg] });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

async function page(cfg, q, seed, { r0 = true, base } = {}) {
  const p = await bootPage(browser, { ...bootOpts(cfg), q, seed, ...(base ? { base } : {}) });
  await installTac(p);
  if (r0) await installR0(p);
  await p.evaluate(() => { window.__headless = true; });
  return p;
}
const run = (p, o) => p.evaluate((o) => {
  const T = window.__tac, O = window.__r0;
  if (O) O.on = o.observe !== false;
  T.begin(o); O?.reset();
  for (let i = 0; i < o.ticks; i++) T.step();
  const gs = window.__gs, F = gs._vanguardFront;
  return { trace: T.trace.slice(), draws: window.__draws,
    recs: O ? O.recs.map((r) => ({ key: r.key, seams: r.seams })) : [],
    spawn: O ? O.spawnLog.map((s) => s.join(':')).join(' ') : '',
    firstChampion: O?.firstChampion ?? null,
    front: F ? { secondAt: F.secondAt, holdAt: F.holdAt, holdMs: Math.round(F.holdMs || 0), released: !!F.released, why: F.why } : null };
}, o);
const flagsOf = (p) => p.evaluate(async () => {
  const d = await window.__mod(/systems\/debug\.js/);
  return { baseline: d.getGameplayBaseline?.() ?? '(none)', roster: d.getRosterVersion(), moveV22: d.isMoveV22(), gaitV2: d.isGaitV2(), bulwarkStuck: d.getBulwarkStuck(), marksmanStuck: d.getMarksmanStuck(), marksmanAngle: d.isMarksmanAngle(), bulwarkAngle: d.isBulwarkAngle() };
});
const hash = (tr) => tr.reduce((h, t) => (h * 31 + t[0] + t[1]) % 1e9, 7);
const firstDiff = (a, b) => (a.length !== b.length ? Math.min(a.length, b.length) : a.findIndex((x, i) => x[0] !== b[i]?.[0] || x[1] !== b[i]?.[1]));
const eff = (f) => JSON.stringify({ ...f, baseline: undefined });

const LEG = { roster: 'legacy', moveV22: false, gaitV2: false, bulwarkStuck: null, marksmanStuck: null, marksmanAngle: false, bulwarkAngle: false };
const CC = { roster: 'v1', moveV22: true, gaitV2: true, bulwarkStuck: 'early', marksmanStuck: 'early', marksmanAngle: true, bulwarkAngle: true };
const WANT = { A: LEG, B: { ...CC, marksmanStuck: null }, C: CC, P: CC, C_url: CC, B_off: { ...CC, marksmanStuck: null } };

// ── 0. THE DEFAULT, the fallback, and every switch on its own ──
if (!SELF) {
  for (const cfg of ['P', 'C_url', 'B_off']) {
    const p = await bootPage(browser, { ...bootOpts(cfg), q: Q.mixed, seed: 1001 });
    const got = await flagsOf(p);
    const url = await p.evaluate(() => location.search);
    await p.close();
    check(`0 ${cfg} (${url.replace(/&encdbg.*/, '')}): runs ${cfg === 'B_off' ? 'B' : 'C'} on the production baseline`, got.baseline === 'production' && eff(got) === JSON.stringify(WANT[cfg]), JSON.stringify(got));
  }
  // the grammar, through the real module the page booted with (BootScene's own call)
  const p = await bootPage(browser, { flags: '', baseline: null, q: Q.mixed, seed: 1001 });
  const g = await p.evaluate(async (LEG) => {
    const d = await window.__mod(/systems\/debug\.js/);
    const read = () => ({ roster: d.getRosterVersion(), moveV22: d.isMoveV22(), gaitV2: d.isGaitV2(), bulwarkStuck: d.getBulwarkStuck(), marksmanStuck: d.getMarksmanStuck(), marksmanAngle: d.isMarksmanAngle(), bulwarkAngle: d.isBulwarkAngle() });
    const at = (q) => { d.applyGameplayFlags(new URLSearchParams(q)); return read(); };
    const ON = { roster: ['roster=v1', 'v1'], moveV22: ['move=v22', true], gaitV2: ['gait=v2', true], bulwarkStuck: ['bulwarkStuck=early', 'early'], marksmanStuck: ['marksmanStuck=early', 'early'], marksmanAngle: ['marksmanAngle=1', true], bulwarkAngle: ['bulwarkAngle=1', true] };
    const OFFQ = { roster: 'roster=legacy', moveV22: 'move=off', gaitV2: 'gait=off', bulwarkStuck: 'bulwarkStuck=off', marksmanStuck: 'marksmanStuck=off', marksmanAngle: 'marksmanAngle=0', bulwarkAngle: 'bulwarkAngle=0' };
    const out = { on: {}, off: {}, legacy: at('baseline=legacy'), prod: at(''), prodNamed: at('baseline=production'), duelMove: at('duel=grunt&move=slidesmash') };
    for (const [k, [q, v]] of Object.entries(ON)) { const r = at(`baseline=legacy&${q}`); out.on[k] = Object.entries(r).every(([kk, vv]) => (kk === k ? vv === v : vv === LEG[kk])); }
    const prod = at('');
    for (const [k, q] of Object.entries(OFFQ)) { const r = at(q); out.off[k] = Object.entries(r).every(([kk, vv]) => (kk === k ? vv === LEG[kk] : vv === prod[kk])); }
    d.applyGameplayFlags(new URLSearchParams(''));   // leave the page as it booted
    return out;
  }, LEG);
  await p.close();
  check('0 `?baseline=legacy` is the pre-R1 game: all seven switches off', JSON.stringify(g.legacy) === JSON.stringify(LEG), JSON.stringify(g.legacy));
  check('0 no flags and `?baseline=production` are both C', JSON.stringify(g.prod) === JSON.stringify(CC) && JSON.stringify(g.prodNamed) === JSON.stringify(CC));
  check('0 each switch turns ON alone from the legacy baseline (and nothing else moves)', Object.values(g.on).every(Boolean), JSON.stringify(g.on));
  check('0 each switch turns OFF alone from the production baseline (and nothing else moves)', Object.values(g.off).every(Boolean), JSON.stringify(g.off));
  check('0 a duel move name in `?move=` keeps the baseline locomotion', JSON.stringify(g.duelMove) === JSON.stringify(CC), JSON.stringify(g.duelMove));
}

// ── 1. the R0 labels ──
for (const cfg of ['A', 'B', 'C']) {
  const p = await bootPage(browser, { ...bootOpts(cfg), q: Q.mixed, seed: 1001 });
  const got = await flagsOf(p);
  await p.close();
  check(`1 ${cfg}: the flag parser reads ${cfg} exactly`, eff(got) === JSON.stringify(SELF ? WANT[cfg] : WANT[cfg]) && (SELF || got.baseline === 'legacy'), JSON.stringify(got));
}

// ── 2. the seam census ──
const rule = (cfg, r) => {
  const s = r.seams, k = r.key, none = !s.ms && !s.ma && !s.bs && !s.ba && !s.loco && !s.v22;
  if (cfg === 'A' || s.nem || k.startsWith('captain') || k.startsWith('swarmling')) return none;
  const msOn = cfg === 'C' || cfg === 'P';
  if (k.startsWith('sniper')) return s.ma && s.ms === msOn && !s.bs && !s.ba && !s.loco;
  if (k.startsWith('shielded-screen')) return s.bs && !s.ba && !s.ma && !s.ms;
  if (k.startsWith('shielded')) return s.bs && s.ba && !s.ma && !s.ms;
  if (k.startsWith('shooter') || k.startsWith('grunt')) return s.loco && s.v22 && !s.bs && !s.ba && !s.ma && !s.ms;
  return none;
};
for (const scn of ['mixed', 'nest', 'vanguardCaptain']) for (const cfg of SELF ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'P']) {
  const p = await page(cfg, Q[scn], 1001);
  const res = await run(p, { seed: 1001, ticks: 1500, pilot: { mode: 'hide' }, fire: 7 });
  await p.close();
  const bad = res.recs.filter((r) => !rule(cfg, r));
  const roles = [...new Set(res.recs.map((r) => r.key))].join(' ');
  check(`2 ${scn} ${cfg}: every spawn carries exactly its approved seams (${res.recs.length} spawns: ${roles})`, res.recs.length > 0 && bad.length === 0,
    bad.length ? `wrong: ${bad.slice(0, 4).map((r) => `${r.key}${JSON.stringify(r.seams)}`).join('; ')}` : '');
}

// ── 3. VANGUARD + Captain ──
{
  const got = {};
  for (const cfg of ['A', 'B', 'C', 'D_noBA']) { const p = await page(cfg, Q.vanguardCaptain, 1001); got[cfg] = await run(p, { seed: 1001, ticks: 1500, pilot: { mode: 'handset' }, fire: 7 }); await p.close(); }
  check('3a VANGUARD+Captain: B and C are the same fight tick for tick', firstDiff(got.B.trace, got.C.trace) === -1, `first divergence ${firstDiff(got.B.trace, got.C.trace)}`);
  check('3b VANGUARD+Captain: B and B-without-T2 are the same fight (T2 never reaches the formation)', firstDiff(got.B.trace, got.D_noBA.trace) === -1, `first divergence ${firstDiff(got.B.trace, got.D_noBA.trace)}`);
  check('3c VANGUARD+Captain: the front clocks are A\'s', JSON.stringify(got.A.front) === JSON.stringify(got.B.front) && !!got.A.front, `${JSON.stringify(got.A.front)} vs ${JSON.stringify(got.B.front)}`);
  check('3d VANGUARD+Captain: the Captain arrives on A\'s tick', got.A.firstChampion != null && got.A.firstChampion === got.B.firstChampion, `${got.A.firstChampion} vs ${got.B.firstChampion}`);
}

// ── 4. Bulwark flags inert without Bulwarks ──
{
  const angB = 'roster=v1&gait=v2&move=v22&marksmanStuck=early&marksmanAngle=1';
  const t = {};
  for (const [k, f] of [['angB', angB], ['C', CONFIGS.C]]) {
    const p = await bootPage(browser, { flags: f, q: Q.nest, seed: 1001 }); await installTac(p); await installR0(p); await p.evaluate(() => { window.__headless = true; });
    t[k] = await run(p, { seed: 1001, ticks: 1500, pilot: { mode: 'handset' }, fire: 7 }); await p.close();
  }
  check('4 SNIPER NEST: C is T1\'s own handset URL tick for tick (Bulwark flags inert with no Bulwark)', firstDiff(t.angB.trace, t.C.trace) === -1, `first divergence ${firstDiff(t.angB.trace, t.C.trace)}; hashes ${hash(t.angB.trace)} / ${hash(t.C.trace)}`);
}

// ── 5. the observer is inert ──
{
  const t = [];
  for (const observe of [true, false]) { const p = await page('B', Q.mixed, 1001); t.push(await run(p, { seed: 1001, ticks: 1200, pilot: { mode: 'handset' }, fire: 7, observe })); await p.close(); }
  check('5 the R0 observer changes nothing (MIXED B, on vs off)', firstDiff(t[0].trace, t[1].trace) === -1, `first divergence ${firstDiff(t[0].trace, t[1].trace)}`);
}

if (!SELF) {
  // ── 6. the default IS C, tick for tick ──
  for (const [scn, ticks, pilot] of [['mixed', 1800, 'handset'], ['nest', 1800, 'hop2'], ['vanguardCaptain', 1800, 'handset'], ['p_hangar_s10w1', 2400, 'hide']]) {
    const got = {};
    for (const cfg of ['P', 'C', 'C_url']) { const p = await page(cfg, Q[scn], 1001); got[cfg] = await run(p, { seed: 1001, ticks, pilot: { mode: pilot }, fire: 7 }); await p.close(); }
    const d1 = firstDiff(got.P.trace, got.C.trace), d2 = firstDiff(got.P.trace, got.C_url.trace);
    check(`6 ${scn}: the no-flags default, legacy-baseline C and the old C URL are one fight (${ticks} ticks)`, d1 === -1 && d2 === -1 && got.P.draws === got.C.draws && got.P.draws === got.C_url.draws,
      `first divergence P/C ${d1}, P/C_url ${d2}; draws ${got.P.draws}/${got.C.draws}/${got.C_url.draws}; hash ${hash(got.P.trace)}`);
    check(`6 ${scn}: the same spawns in the same order, at the same ticks and places`, got.P.spawn === got.C.spawn && got.P.spawn === got.C_url.spawn && got.P.spawn.length > 0, `${got.P.spawn.split(' ').length} spawns`);
  }
  {
    const got = {};
    for (const cfg of ['B', 'B_off']) { const p = await page(cfg, Q.mixed, 1001); got[cfg] = await run(p, { seed: 1001, ticks: 1800, pilot: { mode: 'handset' }, fire: 7 }); await p.close(); }
    check('6 MIXED: `?marksmanStuck=off` on the default is legacy-baseline B, tick for tick', firstDiff(got.B.trace, got.B_off.trace) === -1, `first divergence ${firstDiff(got.B.trace, got.B_off.trace)}`);
  }

  // ── 7. against the pre-rollout build ──
  const oldUp = await fetch(OLD).then((r) => r.ok).catch(() => false);
  if (!oldUp) check(`7 the pre-rollout build (needs a 2ab24af server at --old=${OLD})`, false, 'no server');
  else {
    for (const [scn, pilot] of [['mixed', 'handset'], ['vanguardCaptain', 'handset'], ['p_hangar_s2w1', 'hide']]) {
      const a = await page('A', Q[scn], 1001), ra = await run(a, { seed: 1001, ticks: 1800, pilot: { mode: pilot }, fire: 7 }); await a.close();
      // the old build, NO flags at all: what every player got before R1
      const o = await bootPage(browser, { base: OLD, flags: '', baseline: null, q: Q[scn], seed: 1001 }); await installTac(o); await installR0(o); await o.evaluate(() => { window.__headless = true; });
      const ro = await run(o, { seed: 1001, ticks: 1800, pilot: { mode: pilot }, fire: 7 }); await o.close();
      check(`7 ${scn}: \`?baseline=legacy\` is the pre-rollout no-flags game, tick for tick and draw for draw`, firstDiff(ra.trace, ro.trace) === -1 && ra.draws === ro.draws, `first divergence ${firstDiff(ra.trace, ro.trace)}; draws ${ra.draws}/${ro.draws}`);
    }
    for (const [scn, pilot] of [['mixed', 'handset'], ['nest', 'hop2']]) {
      const pp = await page('P', Q[scn], 1001), rp = await run(pp, { seed: 1001, ticks: 1800, pilot: { mode: pilot }, fire: 7 }); await pp.close();
      // the old build with the C URL the human played on the handset
      const o = await bootPage(browser, { base: OLD, flags: CFG0.C_url, baseline: null, q: Q[scn], seed: 1001 }); await installTac(o); await installR0(o); await o.evaluate(() => { window.__headless = true; });
      const ro = await run(o, { seed: 1001, ticks: 1800, pilot: { mode: pilot }, fire: 7 }); await o.close();
      check(`7 ${scn}: the no-flags default is the pre-rollout C URL, tick for tick and draw for draw`, firstDiff(rp.trace, ro.trace) === -1 && rp.draws === ro.draws, `first divergence ${firstDiff(rp.trace, ro.trace)}; draws ${rp.draws}/${ro.draws}`);
    }
  }

  // ── 8. restart, quit-to-title, reload ──
  for (const cfg of ['P', 'A']) {
    const p = await bootPage(browser, { ...bootOpts(cfg), q: Q.mixed, seed: 1001 });
    const before = await flagsOf(p);
    const out = await p.evaluate(async () => {
      const g = window.game, adv = (n) => window.__adv(n);
      const census = () => {
        const gs = g.scene.getScene('Game');
        const es = ['sniper', 'shielded', 'shooter', 'grunt'].map((t, i) => gs.spawnEnemyAt(t, 500 + i * 120, 300));
        const r = es.map((e) => `${e.enemyType}:${+!!e._marksmanStuck}${+!!e._marksmanAngle}${+!!e._bulwarkStuck}${+!!e._bulwarkAngle}${+!!e._v22}${+String(e.texture?.key || '').startsWith('ro-')}`).join(' ');
        for (const e of es) gs._destroyEnemyFully(e);
        return r;
      };
      const first = census();
      // RESTART MISSION, exactly as the pause menu does it
      const pz = g.scene.getScene('Pause'); pz._closing = false; pz._restart();
      for (let i = 0; i < 400 && !(g.scene.getScene('Game').sys.isActive() && g.scene.getScene('Game').roomSpec); i++) adv(1);
      adv(20);
      const restarted = census();
      // QUIT TO TITLE, then a new run from the title
      pz._closing = false; pz._quit();
      for (let i = 0; i < 200 && !g.scene.getScene('Title').sys.isActive(); i++) adv(1);
      g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 7 });
      for (let i = 0; i < 400 && !(g.scene.getScene('Game').sys.isActive() && g.scene.getScene('Game').roomSpec); i++) adv(1);
      adv(20);
      const requit = census();
      return { first, restarted, requit };
    });
    const after = await flagsOf(p);
    await p.reload();
    await p.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
    // a reload drops bootPage's page-side helpers: the module finder again (a pure read)
    await p.evaluate(() => { window.__mod = async (re) => { const u = performance.getEntriesByType('resource').map((r) => r.name).find((n) => re.test(n)); return u ? import(u) : null; }; });
    const reloaded = await flagsOf(p);
    await p.close();
    check(`8 ${cfg}: RESTART and QUIT-TO-TITLE keep the configuration (flags and the seams a fresh spawn receives)`, out.first === out.restarted && out.first === out.requit && JSON.stringify(before) === JSON.stringify(after),
      `${out.first} | ${out.restarted} | ${out.requit}`);
    check(`8 ${cfg}: a RELOAD of the same URL is the same configuration`, JSON.stringify(before) === JSON.stringify(reloaded) && eff(before) === JSON.stringify(WANT[cfg]), JSON.stringify(reloaded));
  }
}

await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} passed${SELF ? ' (SELFTEST: B and C swapped — checks 1, 2 and 4 are expected to fail)' : ''}`);
process.exit(fails.length ? 1 : 0);
