// SMOKE: THE R0 INTEGRATED CONFIGURATIONS (standalone, needs `npm run dev` on :5173).
//
// What R0 established about the configurations themselves, as assertions — so
// a later change to any seam, flag or install order that breaks the
// integration is caught without re-running the R0 matrix. It asserts nothing
// about how good the fight is (that is the handset's), only that:
//   1  the real flag parser reads A, B and C exactly (debug.js getters)
//   2  every seam lands on exactly the actors its approval names, in MIXED,
//      SNIPER NEST and VANGUARD + Captain: T1 on every ordinary Marksman in B
//      and C; Marksman stuck-B only in C; Bulwark stuck-B on every Bulwark,
//      T2 on every free Bulwark and on NO screen; v2.2 on every Gunner and
//      Rifleman; nothing on the Captain, a swarmling or a nemesis; nothing at
//      all in A
//   3  VANGUARD + Captain: B, C and B-without-T2 are the same fight, tick for
//      tick (trace hash + random draws), and the front / Captain clocks match A
//   4  Bulwark flags are inert in a Bulwark-free SNIPER NEST (T1's own handset
//      URL == C, tick for tick)
//   5  the R0 observer is inert (on vs off, identical trace)
// `--selftest` swaps the B and C flag strings: checks 1, 2 and 4 must then FAIL
// (the A/B — a check that passes on the wrong configuration proves nothing).
//
// usage: node tests/smoke-integration-r0.mjs [--selftest]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME, bootPage } from './diag-stuck-audit.mjs';
import { installTac } from './diag-tactical-engagement.mjs';
import { CONFIGS as CFG0, Q, installR0 } from './diag-integrated-r0.mjs';

const SELF = process.argv.includes('--selftest');
const CONFIGS = SELF ? { ...CFG0, B: CFG0.C, C: CFG0.B } : CFG0;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

async function page(flags, q, seed, r0 = true) {
  const p = await bootPage(browser, { flags, q, seed });
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
    firstChampion: O?.firstChampion ?? null,
    front: F ? { secondAt: F.secondAt, holdAt: F.holdAt, holdMs: Math.round(F.holdMs || 0), released: !!F.released, why: F.why } : null };
}, o);
const hash = (tr) => tr.reduce((h, t) => (h * 31 + t[0] + t[1]) % 1e9, 7);
const firstDiff = (a, b) => a.findIndex((x, i) => x[0] !== b[i]?.[0] || x[1] !== b[i]?.[1]);

// ── 1. the parser ──
const WANT = {
  A: { roster: 'legacy', moveV22: false, gaitV2: false, bulwarkStuck: null, marksmanStuck: null, marksmanAngle: false, bulwarkAngle: false },
  B: { roster: 'v1', moveV22: true, gaitV2: true, bulwarkStuck: 'early', marksmanStuck: null, marksmanAngle: true, bulwarkAngle: true },
  C: { roster: 'v1', moveV22: true, gaitV2: true, bulwarkStuck: 'early', marksmanStuck: 'early', marksmanAngle: true, bulwarkAngle: true },
};
for (const cfg of ['A', 'B', 'C']) {
  const p = await bootPage(browser, { flags: CONFIGS[cfg], q: Q.mixed, seed: 1001 });
  const got = await p.evaluate(async () => {
    const d = await window.__mod(/systems\/debug\.js/);
    return { roster: d.getRosterVersion(), moveV22: d.isMoveV22(), gaitV2: d.isGaitV2(), bulwarkStuck: d.getBulwarkStuck(), marksmanStuck: d.getMarksmanStuck(), marksmanAngle: d.isMarksmanAngle(), bulwarkAngle: d.isBulwarkAngle() };
  });
  await p.close();
  check(`1 ${cfg}: the flag parser reads ${cfg} exactly`, JSON.stringify(got) === JSON.stringify(WANT[cfg]), JSON.stringify(got));
}

// ── 2. the seam census ──
const rule = (cfg, r) => {
  const s = r.seams, k = r.key, none = !s.ms && !s.ma && !s.bs && !s.ba && !s.loco && !s.v22;
  if (cfg === 'A' || s.nem || k.startsWith('captain') || k.startsWith('swarmling')) return none;
  if (k.startsWith('sniper')) return s.ma && s.ms === (cfg === 'C') && !s.bs && !s.ba && !s.loco;
  if (k.startsWith('shielded-screen')) return s.bs && !s.ba && !s.ma && !s.ms;
  if (k.startsWith('shielded')) return s.bs && s.ba && !s.ma && !s.ms;
  if (k.startsWith('shooter') || k.startsWith('grunt')) return s.loco && s.v22 && !s.bs && !s.ba && !s.ma && !s.ms;
  if (k.startsWith('bomber')) return none;
  return none;
};
for (const scn of ['mixed', 'nest', 'vanguardCaptain']) for (const cfg of ['A', 'B', 'C']) {
  const p = await page(CONFIGS[cfg], Q[scn], 1001);
  const res = await run(p, { seed: 1001, ticks: 1500, pilot: { mode: 'hide' }, fire: 7 });
  await p.close();
  const bad = res.recs.filter((r) => !rule(cfg, r));
  const roles = [...new Set(res.recs.map((r) => r.key))].join(' ');
  check(`2 ${scn} ${cfg}: every spawn carries exactly its approved seams (${res.recs.length} spawns: ${roles})`, res.recs.length > 0 && bad.length === 0,
    bad.length ? `wrong: ${bad.slice(0, 4).map((r) => `${r.key}${JSON.stringify(r.seams)}`).join('; ')}` : '');
}

// ── 3. VANGUARD + Captain: B == C == B-without-T2; the front and Captain clocks match A ──
{
  const got = {};
  for (const cfg of ['A', 'B', 'C', 'D_noBA']) {
    const p = await page(CONFIGS[cfg], Q.vanguardCaptain, 1001);
    got[cfg] = await run(p, { seed: 1001, ticks: 1500, pilot: { mode: 'handset' }, fire: 7 });
    await p.close();
  }
  check('3a VANGUARD+Captain: B and C are the same fight tick for tick', firstDiff(got.B.trace, got.C.trace) === -1, `first divergence ${firstDiff(got.B.trace, got.C.trace)}`);
  check('3b VANGUARD+Captain: B and B-without-T2 are the same fight (T2 never reaches the formation)', firstDiff(got.B.trace, got.D_noBA.trace) === -1, `first divergence ${firstDiff(got.B.trace, got.D_noBA.trace)}`);
  check('3c VANGUARD+Captain: the front clocks are A\'s', JSON.stringify(got.A.front) === JSON.stringify(got.B.front) && !!got.A.front, `${JSON.stringify(got.A.front)} vs ${JSON.stringify(got.B.front)}`);
  check('3d VANGUARD+Captain: the Captain arrives on A\'s tick', got.A.firstChampion != null && got.A.firstChampion === got.B.firstChampion, `${got.A.firstChampion} vs ${got.B.firstChampion}`);
}

// ── 4. Bulwark flags inert without Bulwarks: T1's handset URL (angB) == C in SNIPER NEST ──
{
  const angB = 'roster=v1&gait=v2&move=v22&marksmanStuck=early&marksmanAngle=1';
  const t = {};
  for (const [k, f] of [['angB', angB], ['C', CONFIGS.C]]) { const p = await page(f, Q.nest, 1001); t[k] = await run(p, { seed: 1001, ticks: 1500, pilot: { mode: 'handset' }, fire: 7 }); await p.close(); }
  check('4 SNIPER NEST: C is T1\'s own handset URL tick for tick (Bulwark flags inert with no Bulwark)', firstDiff(t.angB.trace, t.C.trace) === -1, `first divergence ${firstDiff(t.angB.trace, t.C.trace)}; hashes ${hash(t.angB.trace)} / ${hash(t.C.trace)}`);
}

// ── 5. the observer is inert ──
{
  const t = [];
  for (const observe of [true, false]) { const p = await page(CONFIGS.B, Q.mixed, 1001); t.push(await run(p, { seed: 1001, ticks: 1200, pilot: { mode: 'handset' }, fire: 7, observe })); await p.close(); }
  check('5 the R0 observer changes nothing (MIXED B, on vs off)', firstDiff(t[0].trace, t[1].trace) === -1, `first divergence ${firstDiff(t[0].trace, t[1].trace)}`);
}

await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} passed${SELF ? ' (SELFTEST: B and C swapped — checks 1, 2 and 4 are expected to fail)' : ''}`);
process.exit(fails.length ? 1 : 0);
