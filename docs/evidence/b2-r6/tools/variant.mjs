// prototype mix variants without touching src: mutate THUNDER.mix, render the composite as the kit plays it (blast at 0.367 s)
import { renderThunder, THUNDER } from '/home/user/crix/src/systems/b2Thunder.js';
import fs from 'fs';
const [out, json] = process.argv.slice(2); Object.assign(THUNDER.mix, JSON.parse(json || '{}'));
const sr = 44100, res = renderThunder(sr), lead = 0.25, gap = 0.117, W = Math.round(lead * sr), Rl = Math.round((lead + gap) * sr), xf = Math.round(THUNDER.xfadeS * sr), N = Rl + res.L.length;
const L = new Float32Array(N), R = new Float32Array(N);
for (let i = 0; i < res.pre.length && W + i < N; i++) { const j = W + i, g = j < Rl ? 1 : j - Rl < xf ? Math.cos((Math.PI / 2) * ((j - Rl) / xf)) : 0; L[j] += res.pre[i] * g; R[j] += res.pre[i] * g; }
for (let i = 0; i < res.L.length; i++) { L[Rl + i] += res.L[i]; R[Rl + i] += res.R[i]; }
const pcm = Buffer.alloc(N * 8); for (let i = 0; i < N; i++) { pcm.writeFloatLE(L[i], i * 8); pcm.writeFloatLE(R[i], i * 8 + 4); }
const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(out, Buffer.concat([h, pcm])); console.log(out, 'GR', res.info.limiterMaxGrDb.toFixed(2));
