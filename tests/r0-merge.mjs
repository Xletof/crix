// R0: merge the raw R0 CSVs into docs/evidence/integrated-combat-r0/r0-integration-metrics.csv
// — every row tagged with source, family (encounter / cell), pilot, config and seed.
// Sections kept: r0run (one per run), r0role (per role per run), mkside (each
// Marksman stuck sidestep taken), actor (the T1/T2 instrument's per-actor
// engagement rows), staged-obstacle / staged-transition (3C rig, T1 on), diverge.
// The T1/T2 instrument's per-episode `resp` and `anglog` rows stay in raw/.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const DIR = new URL('../docs/evidence/integrated-combat-r0/', import.meta.url).pathname;
const parse = (l) => { const out = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
const read = (f) => { const t = readFileSync(DIR + 'raw/' + f, 'utf8').trim().split('\n'); const cols = parse(t[0]); return t.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [cols[i], v]))); };
const KEEP = new Set(['r0run', 'r0role', 'mkside', 'actor', 'staged-obstacle', 'staged-transition']);
const out = [];
for (const f of readdirSync(DIR + 'raw').filter((f) => f.endsWith('.csv')).sort()) {
  const source = f.replace(/^r0-/, '').replace(/-\d\.csv$|\.csv$/, '');
  if (source === 'census') continue;
  for (const r of read(f)) {
    const sec = source === 'diverge' ? 'diverge' : r.section;
    if (!KEEP.has(sec) && sec !== 'diverge') continue;
    const [family, pilot] = String(r.scenario || '').split(':');
    out.push({ source, section: sec, family, pilot: pilot ?? r.role ?? '', config: r.config ?? r.variant ?? '', seed: r.seed, ...r, section_: undefined });
  }
}
const cols = [];
for (const r of out) for (const k of Object.keys(r)) if (k !== 'section_' && k !== 'variant' && k !== 'plan' && !cols.includes(k)) cols.push(k);
const esc = (v) => (v === undefined || v === null ? '' : /[,"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
writeFileSync(DIR + 'r0-integration-metrics.csv', [cols.join(','), ...out.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n');
console.log(`wrote ${out.length} rows, ${cols.length} columns`);
