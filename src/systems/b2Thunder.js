// B2-R6 — REACTOR THUNDER: the Super discharge rendered once, offline, as one composed event
// (`&b2a=B2RT`, HUMAN-authorized experiment 2026-11-20; NOT approved, NOT a default).
//
// THE AUTHOR CANNOT LISTEN. Designed from acoustic principles and checked by measurement only;
// the HUMAN decides on a handset.
//
// Why rendered, not voiced: R5's voices were short exponential envelopes (each is heard for about
// a quarter of its nominal length) squeezed by a bus compressor and a clipper. That made a dense,
// short, dry thud ("a heavy door shutting... inside a fully sound-insulated room"). A room, a
// pressure wave that expands and decays, a rush that blows through the blast, and decays that
// breathe need sample-level DSP (fractional delays, a feedback delay network, resonators, chosen
// saturation) that the Web Audio voice kit cannot schedule per event. So the whole event is
// rendered here, once per sample rate, from a private seeded stream (no `Math.random`, no timers,
// no browser API: the module runs in Node too). The kit (b2Audio.js `kitR6`) plays it with only
// the timing-dependent parts live: the rush held until the real blast, the hand-over, the cuts,
// the impacts and the ducks.
//
// ONE EVENT, three properties sharing one clock and complementary bands:
//  A  ENERGY RELEASE  (the "WWWHHOOOSHH", 0.4-6 kHz). Pink and white noise through two moving
//     bands and a "jet" comb whose notches sweep (air moving), amplitude-pulsed at the reactor
//     bed's own 160 Hz (the ready hum becomes the rush), with arcing crackle that thickens toward
//     the blast. It starts in the game's committed wind-up (the `pre` buffer, held until the
//     blast), does NOT stop at the blast: it bursts brighter with it and disperses into the room.
//  B  DETONATION  (the "KRA-THOOOM"). KRA: a cluster of Friedlander pressure micro-pulses (the
//     shape of a real blast wave: an instant rise, a positive phase, a negative phase) through a
//     hard drive, a gritty noise burst and short barrel modes. THOOOM: one big Friedlander pulse
//     (the pressure punch, 40-150 Hz), a low body whose pitch settles in ~60 ms and then holds
//     (no falling sweep), and a saturated low-mid noise body that swells for ~10 ms after the
//     crack and decays over half a second; its driven harmonics carry the low end onto small
//     speakers.
//  C  AIR AND ROOM  (the "mmmmmm"). Diffused early reflections 17-105 ms (a large hall, gently
//     panned, darker with each bounce), a modulated 8-line feedback delay network whose low mids
//     ring longest (~1.1 s) and whose highs die first (~0.45 s), three low room modes, and the
//     crackle thinning out inside it.
// The five projectile zips are in the composite, far below the blast. One peak limiter is applied
// to the composite and, as the same gain curve, to the diagnostic stems (they sum to it).

export const THUNDER = {
  version: 1,
  preS: 0.48, prePeakS: 0.11, prePlateauS: 0.32,   // the rush: peak at ~the blast, held, gone by 0.48 s unreleased
  xfadeS: 0.016,                                   // the rush hands over to the blast's own rush (equal power)
  blastS: 1.9,
  ceiling: 0.8,                                    // the composite's sample peak (the bus gain sets the level)
  block: 2048,                                     // samples per job step (the kit runs one step per frame)
  zips: 5, zipGapS: 0.009,
  impacts: 3, impactS: 0.32,
  mix: {
    pre: 0.3,           // the rush, at its plateau (after its drive)
    post: 0.42,         // the rush inside the blast
    crack: 0.8, grit: 0.9, modes: 0.08,   // a dense KRA: its first 5 ms carry the hit (punch +1.5 dB over the first cut)
    punch: 0.9, low: 0.55, rumble: 0.35, lowmid: 0.9, body: 0.66,
    zips: 0.05,
    er: 0.6, late: 1.35, bloom: 0.08,
    out: 0.44,          // before the limiter (it should only touch the very first crack: under 1 dB)
    send: { dry: 0.75, body: 0.5, rush: 0.55, zips: 0.3 },
  },
  room: {
    er: [ // [ms, gain, pan -1..1, lowpass Hz, diffusion allpass ms]
      [17, 0.62, -0.45, 7200, 1.3], [26, 0.55, 0.5, 6200, 1.9], [37, 0.48, -0.3, 5400, 2.3], [46, 0.43, 0.38, 4700, 2.9],
      [59, 0.35, -0.55, 4000, 3.1], [73, 0.3, 0.42, 3500, 3.7], [88, 0.25, -0.2, 3000, 4.1], [104, 0.2, 0.3, 2600, 4.7],
    ],
    preDelayMs: 22,
    lines: [46.3, 53.9, 58.3, 63.5, 68.8, 73.9, 79.1, 85.7],     // ms
    rtLow: 1.3, rtMid: 0.95, rtHigh: 0.55, splitLow: 320, splitHigh: 3800,
    mod: [[0.31, 0.35], [0.47, 0.28]],                          // [Hz, ms] on two lines
    modes: [[47, 0.17, 1], [71, 0.14, 0.7], [103, 0.11, 0.5]],  // [Hz, decay tau s, gain]: a bloom, not a drone
  },
};

// ── small DSP kit (state in plain objects; coefficients per RBJ's cookbook) ──
// Hot state lives in typed arrays: a double held in a closure variable is re-boxed on every write,
// which made the first version ~10x slower than it needed to be.
// mulberry32 (the algorithm of systems/rng.js), state in a typed array
function mulberry32(seed) {
  const s = new Uint32Array([seed >>> 0]);
  return () => { s[0] += 0x6d2b79f5; let t = s[0]; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const TAU = Math.PI * 2;
// a biquad is a Float64Array [b0, b1, b2, a1, a2, z1, z2] (transposed direct form II)
function bq() { const f = new Float64Array(7); f[0] = 1; return f; }
function bqSet(f, type, fc, q, sr, db = 0) {
  const w = (TAU * Math.min(Math.max(fc, 10), sr * 0.45)) / sr, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else { const A = Math.pow(10, db / 40); b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
  f[0] = b0 / a0; f[1] = b1 / a0; f[2] = b2 / a0; f[3] = a1 / a0; f[4] = a2 / a0;
  return f;
}
function bqRun(f, x) { const y = f[0] * x + f[5]; f[5] = f[1] * x - f[3] * y + f[6]; f[6] = f[2] * x - f[4] * y; return y; }
const mk = (type, fc, q, sr, db) => bqSet(bq(), type, fc, q, sr, db);
// tanh, rational (exact enough for a drive; cheap)
function th(x) { if (x > 3) return 1; if (x < -3) return -1; const x2 = x * x; return (x * (27 + x2)) / (27 + 9 * x2); }
// a Friedlander blast wave: an instant rise (smoothed over `rise` s), positive phase `ts`, negative phase after
function friedlander(t, ts, b, rise = 0.00008) { if (t < 0) return 0; const u = t / ts; return (1 - u) * Math.exp(-b * u) * (1 - Math.exp(-t / rise)); }
// a damped resonator (one mode)
function reso(f, tau, sr) { const r = Math.exp(-1 / (tau * sr)), w = (TAU * f) / sr; return Float64Array.of(2 * r * Math.cos(w), -r * r, 0, 0); }   // [c1, c2, y1, y2]
function resoRun(m, x) { const y = x + m[0] * m[2] + m[1] * m[3]; m[3] = m[2]; m[2] = y; return y; }
function pinker() { const p = new Float64Array(3); return (w) => { p[0] = 0.99765 * p[0] + w * 0.099046; p[1] = 0.963 * p[1] + w * 0.2965164; p[2] = 0.57 * p[2] + w * 1.0526913; return (p[0] + p[1] + p[2] + w * 0.1848) * 0.2; }; }

// ── A: the energy release (one generator; `post` = inside the blast) ──
function rush(sr, seed, post) {
  const T = THUNDER, r = mulberry32(seed), pink = pinker();
  const fa = bq(), fb = bq(), fc = mk('bp', 3300, 1.3, sr), lo = mk('hp', 160, 0.7, sr);
  const D = new Float32Array(Math.ceil(0.006 * sr) + 4), DN = D.length, g0 = th(1.6);
  // P: 0 fA, 1 fB, 2 delay s, 3 pulse depth, 4 crackle rate, 5 brightness, 6 level, 7 pulse phase, 8 jitter
  const P = new Float64Array(9), I = new Int32Array(2);   // I: 0 comb write index, 1 sample counter
  const params = (t) => {
    if (!post) {
      const Pk = T.prePeakS, H = T.prePlateauS;
      const In = t < Pk ? Math.pow(t / Pk, 1.7) : t < H ? 1 + (0.06 * (t - Pk)) / (H - Pk) : 1.06 * Math.pow(Math.cos((Math.PI / 2) * Math.min(1, (t - H) / (T.preS - H - 0.01))), 2);
      const Ic = Math.min(1, In);
      P[0] = 300 * (1 + 5.2 * Ic); P[1] = 1200 + 3000 * Ic; P[2] = 0.006 - 0.005 * Ic;
      P[3] = 0.15 + 0.4 * Ic; P[4] = 20 + 650 * Math.pow(Ic, 2.5); P[5] = 0.25 + 0.5 * Ic; P[6] = Math.pow(In, 1.15);
    } else if (t < 0.012) {
      const b = t / 0.012;
      P[0] = 1860 + (3300 - 1860) * b; P[1] = 4200 + 1800 * b; P[2] = 0.001 - 0.0006 * b;
      P[3] = 0.56; P[4] = 650; P[5] = 0.9; P[6] = 1 + 0.45 * (1 - Math.exp(-t / 0.004));
    } else {
      const u = t - 0.012;
      P[0] = 950 + (3300 - 950) * Math.exp(-u / 0.16); P[1] = 1900 + (6000 - 1900) * Math.exp(-u / 0.14); P[2] = 0.0004 + 0.0012 * (1 - Math.exp(-u / 0.25));
      P[3] = 0.06 + 0.5 * Math.exp(-t / 0.08); P[4] = 650 * Math.exp(-t / 0.1) + 18 * Math.exp(-t / 0.7); P[5] = 0.75 * Math.exp(-t / 0.25) + 0.15;
      P[6] = (1 + 0.45 * (1 - Math.exp(-t / 0.004))) * (0.72 * Math.exp(-t / 0.085) + 0.28 * Math.exp(-t / 0.33));
    }
  };
  return (t) => {
    if ((I[1]++ & 15) === 0) { params(t); bqSet(fa, 'bp', P[0], 0.8, sr); bqSet(fb, 'bp', P[1], 1.5, sr); }
    const wn = r() * 2 - 1;
    let x = bqRun(fa, pink(wn)) * 1.6 + bqRun(fb, wn) * P[5];
    // the jet comb: a short delay sweeping, summed back (moving notches = air moving)
    const w = I[0]; D[w] = x; let rp = w - P[2] * sr; if (rp < 0) rp += DN;
    let i0 = rp | 0; const fr = rp - i0; if (i0 >= DN) i0 -= DN;   // (-1e-17 + DN rounds to DN) x += (post ? 0.35 + 0.4 * Math.min(1, P[6]) : 0.75) * (D[i0] * (1 - fr) + D[i0 + 1 === DN ? 0 : i0 + 1] * fr); I[0] = w + 1 === DN ? 0 : w + 1;
    // electrical instability: pulsed at the bed's pitch, a little unsteady
    P[7] += (160 * (1 + 0.035 * P[8])) / sr; if (P[7] >= 1) { P[7] -= 1; P[8] = r() * 2 - 1; }
    const s = Math.sin(Math.PI * P[7]), pulse = s * s * s * s, m = P[3];
    x *= 1 - m + m * 2.4 * pulse;
    // arcing: sparse impulses through a band, denser toward the blast
    const cr = r() < P[4] / sr ? (0.35 + 0.65 * r()) * (r() < 0.5 ? -1 : 1) : 0;
    x += bqRun(fc, cr) * 2.2;
    return th(1.6 * bqRun(lo, x) * P[6]) / g0;
  };
}

// ── B and C: the blast and the room, sample by sample in blocks (state in this closure) ──
function makeBlast(sr, stems) {
  const T = THUNDER, X = T.mix, RM = T.room, S = X.send;
  const n = Math.round(T.blastS * sr), L = new Float32Array(n), R = new Float32Array(n);
  const st = stems ? { energy: [new Float32Array(n), new Float32Array(n)], dry: [new Float32Array(n), new Float32Array(n)], body: [new Float32Array(n), new Float32Array(n)], room: [new Float32Array(n), new Float32Array(n)] } : null;
  const PK = new Float64Array(5);   // the stems' and the sum's peaks before the limiter
  const r = mulberry32(0xb26a7d01), wr = rush(sr, 0xb26a1001 ^ 0x5a5a, true);
  // B: crack micro-pulses (start s, positive phase s, amplitude)
  const CK = [[0, 0.75, 1], [0.0016, 0.5, 0.62], [0.0031, 0.45, -0.5], [0.0049, 0.6, 0.44], [0.0072, 0.4, -0.36], [0.0101, 0.55, 0.3], [0.0139, 0.35, -0.22], [0.019, 0.5, 0.17], [0.026, 0.4, 0.12]];
  const ckT = Float64Array.from(CK, (c) => c[0]), ckS = Float64Array.from(CK, (c) => c[1] / 1000), ckA = Float64Array.from(CK, (c) => c[2]);
  const ckHp = mk('hp', 700, 0.7, sr), ckPk = mk('pk', 2600, 0.9, sr, 4);
  const gritHp = mk('hp', 600, 0.7, sr), gritPk = mk('pk', 1900, 0.9, sr, 5);
  const MD = [[1180, 0.04, 1], [1730, 0.03, 0.8], [2410, 0.022, 0.7], [3370, 0.015, 0.55], [4620, 0.01, 0.4]];
  const modes = MD.map(([f, tau]) => reso(f, tau, sr)), modeG = Float64Array.from(MD, ([f, , g]) => g * (1 - Math.exp((-TAU * f) / sr)));
  const punchLp = mk('lp', 520, 0.7, sr);
  const rumLp = mk('lp', 140, 0.8, sr), lmLp = bq(), lmBp = mk('bp', 220, 0.7, sr), lmBp2 = mk('bp', 420, 0.9, sr);
  const bodyHp = mk('hp', 38, 0.7, sr), bodyPk1 = mk('pk', 160, 0.8, sr, 4), bodyPk2 = mk('pk', 320, 1.0, sr, 3), bodySh = mk('pk', 55, 0.9, sr, -2);
  const zipF = Array.from({ length: T.zips }, () => bq());
  const zipPL = Float64Array.from({ length: T.zips }, (_, k) => Math.sqrt((1 - (-0.3 + (0.6 * k) / (T.zips - 1))) / 2));
  const zipPR = Float64Array.from({ length: T.zips }, (_, k) => Math.sqrt((1 + (-0.3 + (0.6 * k) / (T.zips - 1))) / 2));
  // C: the room
  const sendLp = mk('lp', 1200, 0.7, sr);
  const ERN = Math.ceil(0.13 * sr), erBuf = new Float32Array(ERN);
  const NT = RM.er.length, tD = new Int32Array(NT), tGL = new Float64Array(NT), tGR = new Float64Array(NT), tLp = new Float64Array(NT), tZ = new Float64Array(NT), tAp = [], tApW = new Int32Array(NT);
  RM.er.forEach(([ms, g, pan, lp, ap], k) => { tD[k] = Math.round((ms / 1000) * sr); tGL[k] = g * Math.sqrt((1 - pan) / 2); tGR[k] = g * Math.sqrt((1 + pan) / 2); tLp[k] = Math.exp((-TAU * lp) / sr); tAp.push(new Float32Array(Math.round((ap / 1000) * sr) + 1)); });
  const pd = Math.round((RM.preDelayMs / 1000) * sr);
  const lines = RM.lines.map((ms, j) => {
    const len = Math.round((ms / 1000) * sr), maxMod = j < RM.mod.length ? Math.ceil((RM.mod[j][1] / 1000) * sr) + 2 : 0;
    const gl = (rt) => Math.pow(10, (-3 * len) / (rt * sr));
    return { buf: new Float32Array(len + maxMod + 2), len, gLow: gl(RM.rtLow), gMid: gl(RM.rtMid), gHigh: gl(RM.rtHigh), mod: j < RM.mod.length ? RM.mod[j] : null };
  });
  const lnW = new Int32Array(8), lnLp = new Float64Array(8), lnHp = new Float64Array(8), lnOff = new Float64Array(8), apW = new Int32Array(4);
  const aLow = Math.exp((-TAU * RM.splitLow) / sr), aHigh = Math.exp((-TAU * RM.splitHigh) / sr);
  const apIn = [[4.7, 0.7], [3.6, 0.7], [12.7, 0.62], [9.3, 0.62]].map(([ms, g]) => ({ buf: new Float32Array(Math.round((ms / 1000) * sr)), g }));
  const roomModes = RM.modes.map(([f, tau]) => reso(f, tau, sr)), roomG = Float64Array.from(RM.modes, ([f, , g]) => g * (1 - Math.exp((-TAU * f) / sr)));
  const lateHp = mk('hp', 70, 0.7, sr), lateHpR = mk('hp', 70, 0.7, sr), fdnHp = mk('hp', 110, 0.7, sr);
  const dcL = mk('hp', 22, 0.7, sr), dcR = mk('hp', 22, 0.7, sr), sdc = Array.from({ length: 8 }, () => mk('hp', 22, 0.7, sr));
  const xf = Math.round(T.xfadeS * sr);
  const v = new Float64Array(8), yo = new Float64Array(8);
  // envelopes as recurrences: e(t) = exp(-t / tau)
  const dk = (tau) => Math.exp(-1 / (tau * sr));
  const k14 = dk(0.014), k35g = dk(0.035), k7 = dk(0.007), k16 = dk(0.016), k9 = dk(0.009), k25 = dk(0.025), k4 = dk(0.004), k90 = dk(0.09), k220 = dk(0.22), k35 = dk(0.035), k100 = dk(0.11), k300 = dk(0.3), k120 = dk(0.25);
  const E = new Float64Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1]), EW = new Int32Array(1);   // envelopes, the low phase; the ER write index
  function run(i0, i1) {
    let e9 = E[0], e25 = E[1], e4 = E[2], e90 = E[3], e220 = E[4], e35 = E[5], e100 = E[6], e300 = E[7], e120 = E[8], lowPh = E[9], e14 = E[10], e35g = E[11], e7 = E[12], e16 = E[13], ew = EW[0];
    for (let i = i0; i < i1; i++) {
      const t = i / sr;
      // A: the rush, continuing through the blast (faded in over the hand-over)
      let ra = wr(t) * X.post; if (i < xf) ra *= Math.sin((Math.PI / 2) * (i / xf));
      // B: KRA
      let ck = 0, md = 0, grit = 0;
      if (t < 0.045) for (let c = 0; c < 9; c++) { const u = t - ckT[c]; if (u >= 0 && u < 0.012) ck += ckA[c] * friedlander(u, ckS[c], 1.6); }
      if (t < 0.06) ck = th(2.5 * bqRun(ckPk, bqRun(ckHp, ck))) * X.crack;   // (filters idle afterwards: no denormal tails)
      if (t < 0.12) {
        const ge = t < 0.0002 ? t / 0.0002 : e14 + 0.35 * e35g;   // the KRA's rasp lasts ~30 ms
        grit = th(3 * bqRun(gritPk, bqRun(gritHp, (r() * 2 - 1) * ge))) * X.grit * Math.min(1, ge * 1.3);
        for (let m = 0; m < 5; m++) md += resoRun(modes[m], ck * 0.4) * modeG[m];
        md *= X.modes;
      }
      // B: THOOOM
      const punch = t < 0.12 ? bqRun(punchLp, friedlander(t, 0.0065, 1.3, 0.0003)) * X.punch : 0;
      lowPh += (54 + 22 * e35) / sr; if (lowPh >= 1) lowPh -= 1;
      // (driven hard only while loud: the decay below the knee stays linear, so it can breathe)
      const lowEnv = (1 - e7) * (0.7 * e90 + 0.3 * e220);
      const lowRaw = (Math.sin(TAU * lowPh) * X.low + bqRun(rumLp, r() * 2 - 1) * 2.2 * X.rumble) * lowEnv;
      if ((i & 15) === 0) bqSet(lmLp, 'lp', 280 + (1800 - 280) * e120, 0.8, sr);
      const lmEnv = (1 - e16) * (0.72 * e100 + 0.28 * e300);   // swells after the crack: KRA, then THOOOM
      const nz = r() * 2 - 1, lm = (bqRun(lmLp, nz) * 1.1 + bqRun(lmBp, nz) * 1.9 + bqRun(lmBp2, nz) * 1.2) * lmEnv * X.lowmid;
      // asymmetric drive: odd and even harmonics of the low end land at 100-500 Hz, where small speakers play
      const lowIn = 1.6 * (punch + lowRaw);
      let body = (th(lowIn + 0.35 * lowEnv) - th(0.35 * lowEnv)) * 0.9 + th(1.8 * lm) * 0.75;
      body = bqRun(bodySh, bqRun(bodyPk2, bqRun(bodyPk1, bqRun(bodyHp, body)))) * X.body;
      // the five projectile zips (part of the firing, far below it)
      let zl = 0, zr = 0;
      if (t < 0.014 + T.zips * T.zipGapS + 0.05) for (let k = 0; k < T.zips; k++) {
        const u = t - (0.014 + k * T.zipGapS); if (u < 0 || u > 0.05) continue;
        if ((i & 15) === 0) bqSet(zipF[k], 'bp', 2800 * Math.pow(1100 / 2800, u / 0.04) * (1 - 0.03 * k), 2.5, sr);
        const zz = bqRun(zipF[k], r() * 2 - 1) * (1 - Math.exp(-u / 0.002)) * Math.exp(-u / 0.012) * X.zips * 3;
        zl += zz * zipPL[k]; zr += zz * zipPR[k];
      }
      const dry = ck + grit + md;
      // C: mono send -> early reflections (lowpassed, diffused, panned) -> input diffusion -> FDN
      const send = S.dry * dry + S.body * bqRun(sendLp, body) + S.rush * ra + S.zips * (zl + zr);
      erBuf[ew] = send;
      let el = 0, er = 0;
      for (let k = 0; k < NT; k++) {
        let ri = ew - tD[k]; if (ri < 0) ri += ERN;
        const z = (tZ[k] = erBuf[ri] * (1 - tLp[k]) + tZ[k] * tLp[k]);
        const a = tAp[k], aw = tApW[k], y = -0.5 * z + a[aw]; a[aw] = z + 0.5 * y; tApW[k] = aw + 1 === a.length ? 0 : aw + 1;
        el += y * tGL[k]; er += y * tGR[k];
      }
      let pi = ew - pd; if (pi < 0) pi += ERN;
      let fin = bqRun(fdnHp, (el + er) * 0.35 + erBuf[pi] * 0.3);   // no sub build-up in the network
      ew = ew + 1 === ERN ? 0 : ew + 1;
      for (let k = 0; k < 4; k++) { const a = apIn[k], w = apW[k], y = -a.g * fin + a.buf[w]; a.buf[w] = fin + a.g * y; apW[k] = w + 1 === a.buf.length ? 0 : w + 1; fin = y; }
      const upd = (i & 15) === 0;
      for (let j = 0; j < 8; j++) {
        const ln = lines[j];
        if (ln.mod && upd) lnOff[j] = (Math.sin(TAU * ln.mod[0] * t + j) * ln.mod[1] * sr) / 1000;
        const N = ln.buf.length; let rp = lnW[j] - ln.len - lnOff[j]; while (rp < 0) rp += N;
        let ii = rp | 0; const fr = rp - ii; if (ii >= N) ii -= N; const y = ln.buf[ii] * (1 - fr) + ln.buf[ii + 1 === N ? 0 : ii + 1] * fr; yo[j] = y;
        // three-band decay: lows ring longest, highs die first
        const lp = (lnLp[j] = y * (1 - aLow) + lnLp[j] * aLow), hi0 = y - lp;
        const hp = (lnHp[j] = hi0 * (1 - aHigh) + lnHp[j] * aHigh);
        v[j] = lp * ln.gLow + hp * ln.gMid + (hi0 - hp) * ln.gHigh;
      }
      // Hadamard 8 (fast), scaled to stay lossless
      for (let h = 1; h < 8; h <<= 1) for (let a = 0; a < 8; a += h << 1) for (let b = a; b < a + h; b++) { const x0 = v[b], x1 = v[b + h]; v[b] = x0 + x1; v[b + h] = x0 - x1; }
      for (let j = 0; j < 8; j++) { const ln = lines[j], w = lnW[j]; ln.buf[w] = v[j] * 0.35355339 + fin; lnW[j] = w + 1 === ln.buf.length ? 0 : w + 1; }
      const lateL = bqRun(lateHp, (yo[0] + yo[2] - yo[4] + yo[6]) * 0.5), lateR = bqRun(lateHpR, (yo[1] - yo[3] + yo[5] + yo[7]) * 0.5);
      let bl = 0; for (let m = 0; m < 3; m++) bl += resoRun(roomModes[m], punch * 0.02) * roomG[m];
      bl *= X.bloom;
      const roomL = el * X.er + lateL * X.late + bl, roomR = er * X.er + lateR * X.late + bl;
      const outL = (ra + dry + body + zl + roomL) * X.out, outR = (ra + dry + body + zr + roomR) * X.out;
      L[i] = bqRun(dcL, outL); R[i] = bqRun(dcR, outR);
      if (st) {   // (each through its own copy of the composite's DC blocker: the stems sum to the composite)
        const o = X.out;
        st.energy[0][i] = bqRun(sdc[0], ra * o); st.energy[1][i] = bqRun(sdc[1], ra * o); st.dry[0][i] = bqRun(sdc[2], (dry + zl) * o); st.dry[1][i] = bqRun(sdc[3], (dry + zr) * o);
        st.body[0][i] = bqRun(sdc[4], body * o); st.body[1][i] = bqRun(sdc[5], body * o); st.room[0][i] = bqRun(sdc[6], roomL * o); st.room[1][i] = bqRun(sdc[7], roomR * o);
      }
      const ar = Math.abs(ra), ad = Math.abs(dry), ab = Math.abs(body), am = Math.abs(roomL) > Math.abs(roomR) ? Math.abs(roomL) : Math.abs(roomR), as = Math.abs(L[i]) > Math.abs(R[i]) ? Math.abs(L[i]) : Math.abs(R[i]);
      if (ar > PK[0]) PK[0] = ar; if (ad > PK[1]) PK[1] = ad; if (ab > PK[2]) PK[2] = ab; if (am > PK[3]) PK[3] = am; if (as > PK[4]) PK[4] = as;
      e9 *= k9; e25 *= k25; e4 *= k4; e90 *= k90; e220 *= k220; e35 *= k35; e100 *= k100; e300 *= k300; e120 *= k120; e14 *= k14; e35g *= k35g; e7 *= k7; e16 *= k16;
    }
    E[0] = e9; E[1] = e25; E[2] = e4; E[3] = e90; E[4] = e220; E[5] = e35; E[6] = e100; E[7] = e300; E[8] = e120; E[9] = lowPh; E[10] = e14; E[11] = e35g; E[12] = e7; E[13] = e16; EW[0] = ew;
  }
  const peaks = () => ({ energy: PK[0], dry: PK[1], body: PK[2], room: PK[3], sum: PK[4] });
  return { n, L, R, st, peaks, run };
}

// a look-ahead peak limiter in O(n): gain = ceiling / (max |x| over the next `la` samples), spread
// back over `la` (a sliding minimum) and smoothed (a sliding mean of `la`), released over `relS`
function limiterGain(L, R, sr, ceiling, relS = 0.06) {
  const n = L.length, la = Math.max(2, Math.round(0.001 * sr)), gt = new Float32Array(n);
  const q = new Int32Array(n); let h = 0, tl = 0;   // monotonic deque (sliding max of |x| over [i, i + la))
  const mag = (j) => Math.max(Math.abs(L[j]), Math.abs(R[j]));
  let next = 0;
  for (let i = 0; i < n; i++) {
    while (next < Math.min(n, i + la)) { const m = mag(next); while (tl > h && mag(q[tl - 1]) <= m) tl--; q[tl++] = next++; }
    while (q[h] < i) h++;
    const m = mag(q[h]); gt[i] = m > ceiling ? ceiling / m : 1;
  }
  // sliding minimum over [i - la, i + la]
  const g2 = new Float32Array(n); h = 0; tl = 0; next = 0;
  for (let i = 0; i < n; i++) {
    while (next < Math.min(n, i + la + 1)) { const m = gt[next]; while (tl > h && gt[q[tl - 1]] >= m) tl--; q[tl++] = next++; }
    while (q[h] < i - la) h++;
    g2[i] = gt[q[h]];
  }
  // sliding mean over [i - la/2, i + la/2], then release
  const half = la >> 1, out = new Float32Array(n), rel = Math.exp(-1 / (relS * sr));
  let acc = 0, lo = 0, hi = -1, gs = 1, gr = 0;
  for (let i = 0; i < n; i++) {
    while (hi < Math.min(n - 1, i + half)) acc += g2[++hi];
    while (lo < i - half) acc -= g2[lo++];
    const target = acc / (hi - lo + 1);
    gs = target < gs ? target : target - (target - gs) * rel; out[i] = gs; if (gs < 1) gr = Math.max(gr, -20 * Math.log10(gs));
  }
  return { g: out, grMaxDb: gr };
}

/** The whole Super, as a job: one step renders about `THUNDER.block` samples (run it to the end
 *  for a synchronous render). Returns { sr, pre, L, R, impacts: [Float32Array], stems?, info }. */
export function* thunderJob(sr, { stems = false } = {}) {
  const T = THUNDER, X = T.mix, B = T.block;
  // ── the wind-up rush (mono) ──
  const nPre = Math.round(T.preS * sr), pre = new Float32Array(nPre), wp = rush(sr, 0xb26a1001, false);
  for (let i0 = 0; i0 < nPre; i0 += B) { const i1 = Math.min(nPre, i0 + B); for (let i = i0; i < i1; i++) pre[i] = wp(i / sr) * X.pre; yield; }
  // ── the blast (stereo) ──
  const bl = makeBlast(sr, stems), { n, L, R, st } = bl;
  for (let i0 = 0; i0 < n; i0 += B) { bl.run(i0, Math.min(n, i0 + B)); yield; }
  // ── one peak limiter on the composite; the same gain curve on the stems (they sum to it) ──
  const lim = limiterGain(L, R, sr, T.ceiling); yield;
  const g = lim.g;
  for (let i = 0; i < n; i++) { L[i] *= g[i]; R[i] *= g[i]; }
  if (st) for (const k of Object.keys(st)) for (const ch of st[k]) for (let i = 0; i < n; i++) ch[i] *= g[i];
  // the end of the buffer fades over its last 60 ms (nothing is left there; this guarantees no edge)
  const fe = Math.round(0.06 * sr); for (let i = 0; i < fe; i++) { const f = i / fe; L[n - 1 - i] *= f; R[n - 1 - i] *= f; }
  yield;
  // ── the impacts: three round-robin variants (mono), each a small pressure thump, a crunch and a spit ──
  const impacts = [];
  for (let k = 0; k < T.impacts; k++) {
    const m = Math.round(T.impactS * sr), b = new Float32Array(m), ri = mulberry32(0xb26a1300 + k), pf = [1, 0.9, 1.1][k];
    const hp = mk('hp', 90, 0.7, sr), cb = mk('bp', 1300 * pf, 1.1, sr), sp = mk('bp', 3400 * pf, 2, sr), lp = mk('lp', 900, 0.7, sr);
    for (let i = 0; i < m; i++) {
      const t = i / sr;
      const thump = bqRun(lp, t < 0.06 ? friedlander(t, 0.0035 / pf, 1.4, 0.0002) : 0) * 0.9;
      const ce = t < 0.0003 ? t / 0.0003 : Math.exp(-(t - 0.0003) / 0.012);
      const crunch = th(2.5 * bqRun(cb, (ri() * 2 - 1) * ce)) * 0.5;
      const spit = t < 0.05 && ri() < (600 * Math.exp(-t / 0.015)) / sr ? (ri() < 0.5 ? -1 : 1) : 0;
      b[i] = bqRun(hp, th(1.5 * (thump + crunch)) + bqRun(sp, spit) * 1.2) * 0.5;
    }
    const f = Math.round(0.03 * sr); for (let i = 0; i < f; i++) b[m - 1 - i] *= i / f;
    impacts.push(b);
    yield;
  }
  return { sr, pre, L, R, impacts, stems: st, info: { peaksBeforeLimiter: bl.peaks(), limiterMaxGrDb: lim.grMaxDb, nPre, n } };
}

/** Synchronous render (tests, analysis, the kit's fallback). */
export function renderThunder(sr, opts) { const j = thunderJob(sr, opts); let r = j.next(); while (!r.done) r = j.next(); return r.value; }
