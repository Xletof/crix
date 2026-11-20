// The diagnostic stems of the shipped renderer (48 kHz, as most handsets run), laid out as the kit plays them:
// 0.25 s lead, the wind-up rush from 0.25 s, the blast 117 ms later (the game at 60 fps), equal-power hand-over.
// Stems (each stereo, the composite's limiter gain applied): 1 energy release (the wind-up rush + the rush in the
// blast), 2 dry blast (KRA + the five zips), 3 bass/pressure body, 4 room/air. Prints the null of their sum.
import { renderThunder, THUNDER } from '/home/user/crix/src/systems/b2Thunder.js';
import fs from 'fs';
const out = process.argv[2], sr = +(process.argv[3] || 48000), gap = 0.117, lead = 0.25;
const res = renderThunder(sr, { stems: true });
const W = Math.round(lead * sr), Rl = Math.round((lead + gap) * sr), xf = Math.round(THUNDER.xfadeS * sr), N = Rl + res.L.length;
const preRush = new Float32Array(N);
for (let i = 0; i < res.pre.length && W + i < N; i++) { const j = W + i; preRush[j] = res.pre[i] * (j < Rl ? 1 : j - Rl < xf ? Math.cos((Math.PI / 2) * ((j - Rl) / xf)) : 0); }
const lay = (a) => { const z = new Float32Array(N); z.set(a, Rl); return z; };
const st = res.stems;
const S = {
  '1-energy-release': [lay(st.energy[0]).map((v, i) => v + preRush[i]), lay(st.energy[1]).map((v, i) => v + preRush[i])],
  '2-dry-blast': [lay(st.dry[0]), lay(st.dry[1])],
  '3-bass-pressure-body': [lay(st.body[0]), lay(st.body[1])],
  '4-room-air': [lay(st.room[0]), lay(st.room[1])],
};
const comp = [lay(res.L).map((v, i) => v + preRush[i]), lay(res.R).map((v, i) => v + preRush[i])];
// the sum of the stems against the composite (the composite also has a DC blocker and a 60 ms end fade)
let mx = 0, pk = 0; for (let c = 0; c < 2; c++) for (let i = 0; i < Rl + res.L.length - Math.round(0.06 * sr); i++) { const s = Object.values(S).reduce((a, x) => a + x[c][i], 0); mx = Math.max(mx, Math.abs(s - comp[c][i])); pk = Math.max(pk, Math.abs(comp[c][i])); }
const wav = (chs, file) => { const n = chs[0].length, c = chs.length, pcm = Buffer.alloc(n * c * 4); for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) pcm.writeFloatLE(chs[k][i], (i * c + k) * 4); const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(c, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4 * c, 28); h.writeUInt16LE(4 * c, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); fs.writeFileSync(file, Buffer.concat([h, pcm])); };
fs.mkdirSync(out, { recursive: true });
for (const [k, v] of Object.entries(S)) wav(v, `${out}/stem-${k}.wav`);
wav(comp, `${out}/stem-0-composite.wav`);
wav([res.pre], `${out}/rush-unreleased.wav`);
res.impacts.forEach((b, k) => wav([b], `${out}/impact-${k + 1}.wav`));
console.log(JSON.stringify({ sr, gap, lead, blastAt: (lead + gap), nullOfStemSum: mx, nullDb: 20 * Math.log10(mx / pk), compositePeak: pk, info: res.info }));
