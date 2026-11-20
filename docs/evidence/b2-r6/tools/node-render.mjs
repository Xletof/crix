// Node render of Reactor Thunder: composite (pre-roll rush + blast at a given gap), stems, impacts -> float WAVs
import { renderThunder, THUNDER } from '/home/user/crix/src/systems/b2Thunder.js';
import fs from 'fs';
const out = process.argv[2] || 'N', sr = +(process.argv[3] || 44100), gap = +(process.argv[4] || 0.117);
fs.mkdirSync(out, { recursive: true });
const t0 = performance.now(); const res = renderThunder(sr, { stems: true }); const ms = performance.now() - t0;
const t1 = performance.now(); renderThunder(sr); const ms2 = performance.now() - t1;
const wav = (chs, file) => { const n = chs[0].length, c = chs.length, pcm = Buffer.alloc(n * c * 4); for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) pcm.writeFloatLE(chs[k][i], (i * c + k) * 4); const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(c, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4 * c, 28); h.writeUInt16LE(4 * c, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); fs.writeFileSync(file, Buffer.concat([h, pcm])); };
// the event as the kit plays it: 0.3 s silence, the rush from 0.3 s, the blast at 0.3 + gap (equal-power hand-over)
const lead = 0.3, W = Math.round(lead * sr), Rl = Math.round((lead + gap) * sr), xf = Math.round(THUNDER.xfadeS * sr), N = Rl + res.L.length;
const L = new Float32Array(N), R = new Float32Array(N);
for (let i = 0; i < res.pre.length && W + i < N; i++) { const j = W + i; let g = 1; if (j >= Rl) g = j - Rl < xf ? Math.cos((Math.PI / 2) * ((j - Rl) / xf)) : 0; L[j] += res.pre[i] * g; R[j] += res.pre[i] * g; }
for (let i = 0; i < res.L.length; i++) { L[Rl + i] += res.L[i]; R[Rl + i] += res.R[i]; }
wav([L, R], `${out}/composite.wav`);
for (const [k, [a, b]] of Object.entries(res.stems)) { const l = new Float32Array(N), r = new Float32Array(N); l.set(a, Rl); r.set(b, Rl); wav([l, r], `${out}/stem-${k}.wav`); }
const pre = new Float32Array(N); for (let i = 0; i < res.pre.length && W + i < N; i++) { const j = W + i; pre[j] = res.pre[i] * (j >= Rl ? (j - Rl < xf ? Math.cos((Math.PI / 2) * ((j - Rl) / xf)) : 0) : 1); }
wav([pre, pre], `${out}/stem-prerush.wav`);
wav([res.pre], `${out}/pre-unreleased.wav`);
res.impacts.forEach((b, k) => wav([b], `${out}/impact-${k}.wav`));
console.log(JSON.stringify({ sr, gap, renderMs: +ms.toFixed(1), renderMsNoStems: +ms2.toFixed(1), info: res.info, releaseAt: lead + gap }));
