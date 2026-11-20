// the rush alone across the hand-over (energy stem: the wind-up rush with its cosine fade + the rush inside the event)
import { renderThunder, THUNDER } from '/home/user/crix/src/systems/b2Thunder.js';
const [json] = process.argv.slice(2); Object.assign(THUNDER.mix, JSON.parse(json || '{}'));
const sr = 44100, res = renderThunder(sr, { stems: true }), lead = 0.25, gap = 0.117, W = Math.round(lead * sr), Rl = Math.round((lead + gap) * sr), xf = Math.round(THUNDER.xfadeS * sr), N = Rl + res.L.length;
const e = new Float64Array(N);
for (let i = 0; i < res.pre.length && W + i < N; i++) { const j = W + i, g = j < Rl ? 1 : j - Rl < xf ? Math.cos((Math.PI / 2) * ((j - Rl) / xf)) : 0; e[j] += res.pre[i] * g; }
for (let i = 0; i < res.L.length; i++) e[Rl + i] += res.stems.energy[0][i];
const rms = (a, b) => { const i0 = Rl + Math.round(a * sr), i1 = Rl + Math.round(b * sr); let s = 0; for (let i = i0; i < i1; i++) s += e[i] * e[i]; return 10 * Math.log10(s / (i1 - i0) + 1e-20); };
const ref = rms(-0.015, -0.005);
console.log(JSON.stringify({ mix: json, before: +ref.toFixed(1), step: ['+0..10', '+10..20', '+20..30', '+40..50', '+90..100'].map((k, j) => [k, +(rms([0, 0.01, 0.02, 0.04, 0.09][j], [0.01, 0.02, 0.03, 0.05, 0.1][j]) - ref).toFixed(1)]), gr: +res.info.limiterMaxGrDb.toFixed(2) }));
