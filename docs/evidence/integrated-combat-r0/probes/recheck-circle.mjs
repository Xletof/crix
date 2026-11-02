// idle re-check: T2's own measurement path (tacPage + runEnc, t1bw flags) for the
// one MIXED row that did not reproduce, twice, plus the same through C's URL
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME } from '../../../../tests/diag-stuck-audit.mjs';
import { tacPage, runEnc, VARIANTS, Q } from '../../../../tests/diag-tactical-engagement.mjs';
import { CONFIGS } from '../../../../tests/diag-integrated-r0.mjs';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const out = [];
for (const [k, f] of [['t1bw#1', VARIANTS.t1bw], ['t1bw#2', VARIANTS.t1bw], ['C', CONFIGS.C]]) {
  const p = await tacPage(browser, f, Q.mixed, 16839);
  const res = await runEnc(p, { seed: 16839, ticks: 2400, pilot: { mode: 'circle' }, fire: 7 });
  await p.close();
  const h = res.trace.reduce((h, t) => (h * 31 + t[0] + t[1]) % 1e9, 7);
  out.push([k, res.draws, h, res.trace]);
  console.log(k, 'draws', res.draws, 'traceHash', h);
}
const d = (a, b) => a.findIndex((x, i) => x[0] !== b[i][0] || x[1] !== b[i][1]);
console.log('t1bw#1 vs t1bw#2 first divergence', d(out[0][3], out[1][3]), '; t1bw vs C', d(out[0][3], out[2][3]));
console.log('T2 evidence row: draws 16160 traceHash 304936969; R0 matrix row: draws 16160 traceHash 198801015');
await browser.close();
