// REPORT — R0: the tables `docs/evidence/integrated-combat-r0/r0-integration-notes.md`
// quotes, read back from the R0 CSVs. Prints markdown; asserts nothing.
//
// usage: node tests/r0-report.mjs --csv=a.csv+b.csv [--t2=docs/evidence/bulwark-angle-t2/t2-responsiveness-metrics.csv]
import { readFileSync, existsSync } from 'node:fs';
import { t1report } from './diag-tactical-engagement.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
function readCsv(file) {
  const txt = readFileSync(file, 'utf8').trim().split('\n');
  const parse = (l) => { const out = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
  const cols = parse(txt[0]);
  return txt.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [cols[i], v === '' ? '' : isNaN(+v) ? v : +v])));
}
const rows = opt('csv', '').split('+').filter(Boolean).flatMap(readCsv);
const out = [];
const P = (...a) => out.push(a.join(' '));
const grp = (arr, f) => arr.reduce((o, r) => ((o[f(r)] ||= []).push(r), o), {});
const med = (a) => { const s = a.filter((v) => v !== '' && v != null && !Number.isNaN(+v)).map(Number).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const mean = (a) => { const s = a.filter((v) => v !== '' && v != null && !Number.isNaN(+v)).map(Number); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : NaN; };
const f1 = (v) => (Number.isNaN(v) ? '-' : (+v).toFixed(1)), f2 = (v) => (Number.isNaN(v) ? '-' : (+v).toFixed(2)), pc = (v) => (Number.isNaN(v) ? '-' : `${(100 * v).toFixed(0)}%`);
const fam = (r) => String(r.scenario).split(':')[0], pil = (r) => String(r.scenario).split(':')[1];
const CFG = ['A', 'B', 'C', 'D_noBA', 'D_noMA', 'D_mkOnly'];
const byCfg = (a, f) => CFG.filter((c) => a.some((r) => r.config === c)).map((c) => [c, a.filter((r) => r.config === c)]);

const runs = rows.filter((r) => r.section === 'r0run');
const roles = rows.filter((r) => r.section === 'r0role');
const mks = rows.filter((r) => r.section === 'mkside');
const actors = rows.filter((r) => r.section === 'actor');

// ── 1. what the player faces, per encounter x pilot x config (median over seeds) ──
P('## 1. player-facing pressure and threat, per scenario x pilot (median over seeds; god mode, so damage is what WOULD have landed)');
P('| scenario | pilot | cfg | runs | dmg/min | hits/min | fastest full bar s | worst 3s dmg | recovering | longest no-hit s | no line on player | lines (mean) | 3+ lines | 2+ telegraphs | live enemies | pairs <60px |');
P('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [k, a] of Object.entries(grp(runs, (r) => `${fam(r)}|${pil(r)}`)).sort()) {
  for (const [c, b] of byCfg(a)) {
    P(`| ${k.replace('|', ' | ')} | ${c} | ${b.length} | ${Math.round(med(b.map((r) => r.dmgPerMin)))} | ${f1(med(b.map((r) => r.hitsPerMin)))} | ${f1(med(b.map((r) => r.fastestFullBarS === '' ? 999 : r.fastestFullBarS)))} | ${Math.round(med(b.map((r) => r.worst3sDmg)))} | ${pc(med(b.map((r) => r.recoveringFrac)))} | ${f1(med(b.map((r) => r.longestNoHitS)))} | ${pc(med(b.map((r) => r.los0)))} | ${f2(med(b.map((r) => r.losMean)))} | ${pc(med(b.map((r) => r.los3p)))} | ${pc(med(b.map((r) => r.overlap2Frac)))} | ${f1(med(b.map((r) => r.liveMean)))} | ${f2(med(b.map((r) => r.pairs60Mean)))} |`);
  }
}
// family roll-up: pooled over pilots and seeds
P('', '## 1b. family roll-up (pooled over pilots and seeds: median, and p90 of the per-run value)');
P('| family | cfg | runs | dmg/min med (p90) | fastest full bar s med (p10) | recovering med | no line on player med | 2+ telegraphs med | pairs <60px med | overlapping pairs med |');
P('|---|---|---|---|---|---|---|---|---|---|');
const pq = (a, q) => { const s = a.filter((v) => v !== '').map(Number).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
for (const [k, a] of Object.entries(grp(runs, fam)).sort()) for (const [c, b] of byCfg(a)) {
  const fb = b.map((r) => (r.fastestFullBarS === '' ? 999 : r.fastestFullBarS));
  P(`| ${k} | ${c} | ${b.length} | ${Math.round(med(b.map((r) => r.dmgPerMin)))} (${Math.round(pq(b.map((r) => r.dmgPerMin), 0.9))}) | ${f1(med(fb))} (${f1(pq(fb, 0.1))}) | ${pc(med(b.map((r) => r.recoveringFrac)))} | ${pc(med(b.map((r) => r.los0)))} | ${pc(med(b.map((r) => r.overlap2Frac)))} | ${f2(med(b.map((r) => r.pairs60Mean)))} | ${f2(med(b.map((r) => r.overlapPairsMean)))} |`);
}

// ── 2. movement quality per role (pooled, time-weighted) ──
P('', '## 2. movement quality per role, per family x config (pooled over runs, weighted by live time)');
P('| family | role | cfg | n | live s | moving | px/s | sharp turns/min | reversals/min | stop-go/min | stuck sidestep (share of life) | sidestep episodes/min | crowded (<60px) | overlapping |');
P('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [k, a] of Object.entries(grp(roles, (r) => `${fam(r)}|${r.role}`)).sort()) for (const [c, b] of byCfg(a)) {
  const live = b.reduce((s, r) => s + r.liveS, 0); if (live < 20) continue;
  const w = (col) => b.reduce((s, r) => s + r[col] * r.liveS, 0) / live;
  P(`| ${k.replace('|', ' | ')} | ${c} | ${b.reduce((s, r) => s + r.n, 0)} | ${Math.round(live)} | ${pc(w('movingFrac'))} | ${f1(w('pxPerS'))} | ${f1(w('turnsPerMin'))} | ${f1(w('reversalsPerMin'))} | ${f1(w('stopGoPerMin'))} | ${pc(w('sidestepTakenFrac'))} | ${f2(w('sidestepEpisodesPerMin'))} | ${pc(w('crowdedFrac'))} | ${pc(w('overlapFrac'))} |`);
}

// ── 3. Marksman stuck sidesteps, classified ──
P('', '## 3. Marksman stuck sidesteps TAKEN, by cause (per live Marksman-minute; pooled)');
P('| family | cfg | Marksman-min | episodes/min | F1 (first check) | HOLD -> resume | PINNED on approach | OTHER | mean px per episode | line opened within 1s after |');
P('|---|---|---|---|---|---|---|---|---|---|');
const mkAct = actors.filter((r) => r.type === 'sniper' && !r.control);
for (const [k, a] of Object.entries(grp(mks, fam)).sort()) {
  for (const c of CFG) {
    const b = a.filter((r) => r.config === c); const act = mkAct.filter((r) => fam(r) === k && r.config === c);
    if (!act.length) continue;
    const min = act.reduce((s, r) => s + r.liveMs, 0) / 60000;
    const n = (cl) => b.filter((r) => r.cls === cl).length;
    P(`| ${k} | ${c} | ${f1(min)} | ${f2(b.length / min)} | ${n('F1')} | ${n('HOLD')} | ${n('PINNED')} | ${n('OTHER')} | ${b.length ? Math.round(mean(b.map((r) => r.px))) : '-'} | ${b.length ? pc(mean(b.map((r) => r.losAfter1s))) : '-'} |`);
  }
}
for (const fm of [...new Set(mkAct.map(fam))]) if (!mks.some((r) => fam(r) === fm)) P(`| ${fm} | (no Marksman sidestep in any config) |`);

// ── 4. B vs C, paired: the same scenario, pilot and seed ──
P('', '## 4. B vs C, paired by scenario x pilot x seed');
const key = (r) => `${r.scenario}|${r.seed}`;
const runB = Object.fromEntries(runs.filter((r) => r.config === 'B').map((r) => [key(r), r]));
const runC = Object.fromEntries(runs.filter((r) => r.config === 'C').map((r) => [key(r), r]));
const pairs = Object.keys(runB).filter((k) => runC[k]);
const ident = pairs.filter((k) => runB[k].traceHash === runC[k].traceHash);
P(`pairs: ${pairs.length}; tick-identical (trace hash equal): ${ident.length} — ${[...new Set(ident.map((k) => k.split(':')[0]))].join(', ') || 'none'}`);
const mkMinOf = (sc, seed, cfg) => actors.filter((r) => r.type === 'sniper' && !r.control && r.scenario === sc && r.seed === seed && r.config === cfg).reduce((s, r) => s + r.liveMs, 0) / 60000;
const mkSum = (sc, seed, cfg, col) => actors.filter((r) => r.type === 'sniper' && !r.control && r.scenario === sc && r.seed === seed && r.config === cfg).reduce((s, r) => s + (+r[col] || 0), 0);
const sideN = (sc, seed, cfg) => mks.filter((r) => r.scenario === sc && r.seed === seed && r.config === cfg).length;
P('| family | metric | pairs (non-identical) | C > B | C < B | equal | median C - B | B median | C median |');
P('|---|---|---|---|---|---|---|---|---|');
const METRICS = [
  ['dmg/min (all roles)', (r) => r.dmgPerMin],
  ['Marksman dmg/min', (r) => (r.dmg_marksman || 0) / (r.ticks / 3600)],
  ['fastest full bar s', (r) => (r.fastestFullBarS === '' ? 999 : r.fastestFullBarS)],
  ['recovering share', (r) => r.recoveringFrac],
  ['2+ telegraphs share', (r) => r.overlap2Frac],
  ['Marksman sidesteps / Mk-min', (r) => { const m = mkMinOf(r.scenario, r.seed, r.config); return m ? sideN(r.scenario, r.seed, r.config) / m : NaN; }],
  ['Marksman shots / Mk-min', (r) => { const m = mkMinOf(r.scenario, r.seed, r.config); return m ? mkSum(r.scenario, r.seed, r.config, 'shots') / m : NaN; }],
  ['Marksman stood blind (s / Mk-min)', (r) => { const m = mkMinOf(r.scenario, r.seed, r.config); return m ? mkSum(r.scenario, r.seed, r.config, 'standNoLineMs') / 1000 / m : NaN; }],
  ['enemies alive at end', (r) => String(r.roles || '').split(' ').filter(Boolean).reduce((s, x) => s + (+x.split(':')[1] || 0), 0)],
];
for (const fm of [...new Set(pairs.map((k) => k.split(':')[0]))].sort()) {
  const ks = pairs.filter((k) => k.startsWith(fm + ':') && !ident.includes(k));
  if (!ks.length) { P(`| ${fm} | (all pairs tick-identical) |`); continue; }
  for (const [name, f] of METRICS) {
    const d = ks.map((k) => [f(runB[k]), f(runC[k])]).filter(([b, c]) => !Number.isNaN(+b) && !Number.isNaN(+c));
    if (!d.length) continue;
    const gt = d.filter(([b, c]) => c > b).length, lt = d.filter(([b, c]) => c < b).length;
    P(`| ${fm} | ${name} | ${d.length} | ${gt} | ${lt} | ${d.length - gt - lt} | ${f2(med(d.map(([b, c]) => c - b)))} | ${f2(med(d.map(([b]) => b)))} | ${f2(med(d.map(([, c]) => c)))} |`);
  }
}
// the noise floor: the same metric's seed-to-seed spread inside one config
P('', 'noise reference — the spread of dmg/min across SEEDS inside one config and pilot (median of per-cell max-min):');
for (const [fm, a] of Object.entries(grp(runs, fam)).sort()) {
  const cells = grp(a, (r) => `${pil(r)}|${r.config}`);
  const spreads = Object.values(cells).filter((c) => c.length > 1).map((c) => Math.max(...c.map((r) => r.dmgPerMin)) - Math.min(...c.map((r) => r.dmgPerMin)));
  P(`  ${fm}: ${Math.round(med(spreads))} dmg/min (n=${spreads.length} cells)`);
}

// ── 5. VANGUARD invariance ──
P('', '## 5. VANGUARD: invariance and the protected clocks');
const van = runs.filter((r) => fam(r).startsWith('vanguard'));
for (const [k, a] of Object.entries(grp(van, (r) => `${r.scenario}|${r.seed}`)).sort()) {
  const h = Object.fromEntries(a.map((r) => [r.config, r]));
  const eq = (x, y) => (h[x] && h[y] ? (h[x].traceHash === h[y].traceHash ? 'IDENTICAL' : 'differs') : '-');
  const so = (x, y) => (h[x] && h[y] ? (h[x].spawnOrder === h[y].spawnOrder ? 'same' : 'DIFFERENT') : '-');
  P(`  ${k.replace('|', ' seed ')}: B vs C ${eq('B', 'C')}; B vs D_noBA ${eq('B', 'D_noBA')}; A vs B ${eq('A', 'B')} (spawn order A vs B ${so('A', 'B')}, B vs C ${so('B', 'C')})`);
}
P('| scenario | cfg | runs | Captain arrives s (med) | front: 2nd shield at | hold at | held ms | released | why | screen hold share | screen flips/min | super full at s (med) | dmg/min med | spawned med |');
P('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [k, a] of Object.entries(grp(van, fam)).sort()) for (const [c, b] of byCfg(a)) {
  const sh = b.reduce((s, r) => s + r.screenHoldMs, 0), sm = b.reduce((s, r) => s + r.screenMoveMs, 0);
  P(`| ${k} | ${c} | ${b.length} | ${f1(med(b.map((r) => (r.firstChampionMs === '' ? NaN : r.firstChampionMs / 1000))))} | ${[...new Set(b.map((r) => r.frontSecondAt))].join('/')} | ${[...new Set(b.map((r) => r.frontHoldAt))].join('/')} | ${[...new Set(b.map((r) => r.frontHoldMs))].join('/')} | ${[...new Set(b.map((r) => r.frontReleased))].join('/')} | ${[...new Set(b.map((r) => r.frontWhy))].join('/')} | ${pc(sh / Math.max(1, sh + sm))} | ${f1(b.reduce((s, r) => s + r.screenFlips, 0) / (b.reduce((s, r) => s + r.ticks, 0) / 3600))} | ${f1(med(b.map((r) => (r.superFullMs === '' ? NaN : r.superFullMs / 1000))))} | ${Math.round(med(b.map((r) => r.dmgPerMin)))} | ${med(b.map((r) => r.spawned))} |`);
}

// ── 6. progression cells ──
P('', '## 6. ordinary progression (the real resolver), per cell x config');
P('| cell | encounter | cfg | runs | hp x | speed x | spawned med | live mean / max | dmg/min med | fastest full bar s | no line on player | 2+ telegraphs | pairs <60px | step ms med / p95 / max |');
P('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [k, a] of Object.entries(grp(runs.filter((r) => fam(r).startsWith('p_')), fam)).sort()) for (const [c, b] of byCfg(a)) {
  P(`| ${k} | ${[...new Set(b.map((r) => r.encounter))].join('/')} | ${c} | ${b.length} | ${f2(b[0].enemyHpMult)} | ${f2(b[0].enemySpeedMult)} | ${med(b.map((r) => r.spawned))} | ${f1(mean(b.map((r) => r.liveMean)))} / ${Math.max(...b.map((r) => r.liveMax))} | ${Math.round(med(b.map((r) => r.dmgPerMin)))} | ${f1(med(b.map((r) => (r.fastestFullBarS === '' ? 999 : r.fastestFullBarS))))} | ${pc(med(b.map((r) => r.los0)))} | ${pc(med(b.map((r) => r.overlap2Frac)))} | ${f2(med(b.map((r) => r.pairs60Mean)))} | ${f2(med(b.map((r) => r.stepMsMed)))} / ${f2(med(b.map((r) => r.stepMsP95)))} / ${f1(Math.max(...b.map((r) => r.stepMsMax)))} |`);
}

// ── 7. seam census (from the run rows) ──
P('', '## 7. seam census: which spawn received which seam (all runs, per config; ms = marksmanStuck, ma = T1, bs = bulwarkStuck, ba = T2, loco/v22 = move v2.2, roster = v1 art)');
const census = {};
for (const r of runs) for (const tok of String(r.seamCensus || '').split(' ').filter(Boolean)) {
  const m = tok.match(/^([^:]+):(\d+)\[(.*)\]$/); if (!m) continue;
  const c = (census[`${r.config}|${m[1]}`] ||= { n: 0, f: {} }); c.n += +m[2];
  for (const x of m[3].split('/').filter(Boolean)) { const mm = x.match(/^([a-z]+?\d*?)(\d+)$/); const name = x.replace(/\d+$/, ''); c.f[name] = (c.f[name] || 0) + +x.slice(name.length); void mm; }
}
for (const [k, c] of Object.entries(census).sort()) P(`  ${k.replace('|', ' ')}: ${c.n} spawned — ${Object.entries(c.f).map(([f, v]) => `${f} ${v}/${c.n}`).join(', ') || 'no seam'}`);

// ── 8. determinism across sessions: C rows vs the T2 evidence rows (t1bw = the same flags) ──
const T2 = opt('t2', new URL('../docs/evidence/bulwark-angle-t2/t2-responsiveness-metrics.csv', import.meta.url).pathname);
if (existsSync(T2)) {
  const t2 = readCsv(T2).filter((r) => r.section === 'run' && r.variant === 't1bw');
  const c = runs.filter((r) => r.config === 'C' && fam(r) === 'mixed');
  let same = 0, diff = 0, n = 0;
  for (const r of c) { const o = t2.find((x) => x.scenario === r.scenario && x.seed === r.seed); if (!o) continue; n++; if (o.traceHash === r.traceHash && o.draws === r.draws) same++; else diff++; }
  P('', `## 8. cross-session determinism: config C MIXED runs vs the T2 evidence rows for the same flags (t1bw, measured at 37135c9): ${same}/${n} identical trace hash and draw count, ${diff} different`);
}

// ── 9. the T1 report, Marksmen only, on these rows ──
if (process.argv.includes('--t1')) { P('', '## 9. the T1 instrument report (variant = config)'); P(t1report(rows.map((r) => ({ ...r, variant: r.config ?? r.variant })), { byFamily: true })); }
console.log(out.join('\n'));
