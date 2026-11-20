// Null test: the Super through the browser's Web Audio path (createB2Audio -> kitR6 -> the R6 bus) against the
// Node render of systems/b2Thunder.js laid out the same way and scaled by R6_TRIM. Writes both and the residual.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME } from '/home/user/crix/tests/diag-stuck-audit.mjs';
import { renderThunder, THUNDER } from '/home/user/crix/src/systems/b2Thunder.js';
import fs from 'fs';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('http://localhost:5173/?nodlg=1');
await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
const r = await page.evaluate(async () => {
  const names = performance.getEntriesByType('resource').map((x) => x.name);
  const mod = await import(names.find((n) => /systems\/b2Audio\.js/.test(n)));
  const SR = 44100, ctx = new OfflineAudioContext(2, SR * 3, SR), dest = ctx.createGain(); dest.connect(ctx.destination);
  let T = 0; const a = mod.createB2Audio('B2RT', { ctx, dest, now: () => T });
  for (let tick = 0; tick < 170; tick++) { T = tick / 60; if (tick === 30) a.windup(); if (tick === 37) a.release(); a.update(1000 / 60, { heat: 0, firing: false, suppressed: false, dead: false, sup: false }); }
  const b = await ctx.startRendering();
  return { L: Array.from(b.getChannelData(0)), R: Array.from(b.getChannelData(1)), trim: mod.R6_TRIM, render: a.stats.super.render };
});
await browser.close();
const res = renderThunder(44100), SR = 44100, n = r.L.length, eL = new Float64Array(n), eR = new Float64Array(n);
const tw = Math.round((30 / 60 + 0.02) * SR), tr = Math.round((37 / 60 + 0.02) * SR), xf = THUNDER.xfadeS;
// the hand-over as the kit schedules it: setValueCurveAtTime over xfadeS (33 points, linear between them)
const curve = Array.from({ length: 33 }, (_, i) => Math.max(0.0001, Math.cos((Math.PI / 2) * (i / 32))));
const cg = (u) => { if (u <= 0) return 1; if (u >= xf) return 0; const p = (u / xf) * 32, i = Math.floor(p); return curve[i] + (curve[Math.min(32, i + 1)] - curve[i]) * (p - i); };
for (let i = 0; i < res.pre.length && tw + i < n; i++) { const j = tw + i, g = j < tr ? 1 : cg((j - tr) / SR); eL[j] += res.pre[i] * g; eR[j] += res.pre[i] * g; }
for (let i = 0; i < res.L.length && tr + i < n; i++) { eL[tr + i] += res.L[i]; eR[tr + i] += res.R[i]; }
let pk = 0, mx = 0, se = 0, sr2 = 0; const resid = [new Float32Array(n), new Float32Array(n)];
for (let i = 0; i < n; i++) for (const [c, x, e] of [[0, r.L, eL], [1, r.R, eR]]) { const d = x[i] - e[i] * r.trim; resid[c][i] = d; pk = Math.max(pk, Math.abs(x[i])); mx = Math.max(mx, Math.abs(d)); se += x[i] * x[i]; sr2 += d * d; }
const wav = (chs, file) => { const m = chs[0].length, c = chs.length, pcm = Buffer.alloc(m * c * 4); for (let i = 0; i < m; i++) for (let k = 0; k < c; k++) pcm.writeFloatLE(chs[k][i], (i * c + k) * 4); const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(c, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4 * c, 28); h.writeUInt16LE(4 * c, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); fs.writeFileSync(file, Buffer.concat([h, pcm])); };
fs.mkdirSync('NULL', { recursive: true });
wav([Float32Array.from(r.L), Float32Array.from(r.R)], 'NULL/browser.wav'); wav(resid, 'NULL/residual.wav');
console.log(JSON.stringify({ trim: r.trim, browserPeak: pk, residualPeak: mx, residualPeakDbRePeak: 20 * Math.log10(mx / pk), residualEnergyDb: 10 * Math.log10(sr2 / se), render: r.render }));
