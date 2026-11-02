import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME } from '../../../../tests/diag-stuck-audit.mjs';
import { tacPage, runEnc, Q } from '../../../../tests/diag-tactical-engagement.mjs';
import { CONFIGS } from '../../../../tests/diag-integrated-r0.mjs';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const V = { angB: 'roster=v1&gait=v2&move=v22&marksmanStuck=early&marksmanAngle=1', C: CONFIGS.C, C_again: CONFIGS.C };
const tr = {};
for (const [k, f] of Object.entries(V)) {
  const p = await tacPage(browser, f, Q.nest, 1001);
  const res = await runEnc(p, { seed: 1001, ticks: 2400, pilot: { mode: 'handset' }, fire: 7 });
  await p.close();
  tr[k] = res.trace; console.log(k, 'draws', res.draws, 'roles', JSON.stringify(res.roles), 'spawned types', res.actors.map((a) => a.type + (a.screen ? '-screen' : '')).join(','));
}
const d = (a, b) => a.findIndex((x, i) => x[0] !== b[i][0] || x[1] !== b[i][1]);
console.log('angB vs C first divergence', d(tr.angB, tr.C), '; C vs C_again', d(tr.C, tr.C_again));
if (d(tr.angB, tr.C) >= 0) { const i = d(tr.angB, tr.C); console.log('at', i, 'angB', JSON.stringify(tr.angB.slice(i - 1, i + 2)), 'C', JSON.stringify(tr.C.slice(i - 1, i + 2))); }
await browser.close();
