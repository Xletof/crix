import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME } from '../../../../tests/diag-stuck-audit.mjs';
import { tacPage, Q } from '../../../../tests/diag-tactical-engagement.mjs';
import { CONFIGS } from '../../../../tests/diag-integrated-r0.mjs';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const seen = {};
for (let k = 0; k < 8; k++) {
  const p = await tacPage(browser, CONFIGS.C, Q.mixed, 16839);
  const r = await p.evaluate(() => {
    const T = window.__tac;
    T.begin({ seed: 16839, pilot: { mode: 'circle' }, fire: 7 });
    for (let i = 0; i < 955; i++) T.step();
    const R0 = Math.random, calls = [];
    Math.random = function () { const st = new Error().stack.split('\n').slice(2, 7).map((l) => l.trim().replace(/\(http:\/\/localhost:5173\//, '(').replace(/\?t=\d+/, '')).join(' < '); calls.push(st); return R0(); };
    const d0 = window.__draws;
    T.step(); T.step();
    Math.random = R0;
    const by = {}; for (const c of calls) by[c] = (by[c] || 0) + 1;
    return { draws: window.__draws - d0, by, fontsStatus: document.fonts.status, fontsLoaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).join(',') };
  });
  await p.close();
  console.log(`run ${k}: draws in ticks 956-957 = ${r.draws}; fonts ${r.fontsStatus} [${r.fontsLoaded}]`);
  const key = String(r.draws);
  if (!seen[key]) { seen[key] = r.by; for (const [c, n] of Object.entries(r.by).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`   ${n}x ${c.slice(0, 300)}`); }
  if (Object.keys(seen).length >= 2) break;
}
await browser.close();
