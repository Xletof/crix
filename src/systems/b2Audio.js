// B2-R2 — THE WEAPON AUDIO CANDIDATES (`?b2=A|B&b2a=A|B`, opt-in; HUMAN-directed
// 2026-11-17; NOT approved, NOT a default). They replace the B2-1 voice kit
// (systems/b2Voice.js), which the HUMAN rejected ("a tiny, repetitive
// slime-spitter"). Without `&b2a` the B2-1 kit plays exactly as before.
//
// THE AUTHOR CANNOT LISTEN. These were designed from synthesis principles and
// checked only for structure (events fire, voices stay bounded, no clipping in
// an offline render). Nothing here is an artistic claim; the HUMAN decides.
//
//  A  HEAVY ENERGY RIFLE. Every round is a short, dense event built in the band
//     a phone speaker carries (300 Hz - 4 kHz): a hard electrical crack, a
//     distorted falling body (two detuned saws through a resonant low-pass), a
//     mechanical cycling knock, and a short tail. Charge raises the body and
//     opens the filter; a thin whine rises underneath.
//  B  PLASMA REACTOR. A powered reactor bed runs under the stream (detuned saws
//     through a band-pass, amplitude-pulsed at the cadence), so each round
//     reads as a pulse of one continuous discharge. Charge raises the bed,
//     opens it and makes it waver; at three quarters it starts to crackle.
//
// Both: initial shot, sustained fire, charge progression, Super-ready ambience,
// Super wind-up, Super release, projectile impact, reactor cooldown.
//
// DETERMINISM. No `Math.random`: variation is a fixed rotation, noise comes from
// buffers filled once from a private mulberry32 stream, and the B crackle is
// scheduled from a second private stream. The shipped `SFX` functions draw
// `Math.random` when audio is live; the ones this replaces are not called.
// POLYPHONY. One-shot voices are counted and capped (VOICE_CAP); the beds are
// single persistent nodes.
import { __fxDebug, duckMusic, duckSfx } from './FX.js';
import { mulberry32 } from './rng.js';

const VOICE_CAP = 48;               // live one-shot source nodes per kit
const LOOK = 0.02;
const ROT = [1, 1.028, 0.976, 1.012, 0.991];

function noiseBuffer(ctx, seed, secs = 0.6) {
  const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = mulberry32(seed);
  for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
  return b;
}
function driveCurve(k) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
  return c;
}

/** The synth primitives one kit schedules with, on `ctx`, into `dest`. */
function voices(ctx, dest, stats, now = () => ctx.currentTime, shared = null) {
  const nb = noiseBuffer(ctx, 0xb2a0b2a0);
  const drv = { soft: driveCurve(2.5), hard: driveCurve(9) };
  // live voices are counted by their scheduled end times (onended does not fire while an
  // OfflineAudioContext is being scheduled), so the cap holds live and offline
  const ends = shared || [];          // B2's confirmation path shares the kit's count (one cap)
  const prune = () => { const t = now(); for (let i = ends.length - 1; i >= 0; i--) if (ends[i] <= t) ends.splice(i, 1); };
  const track = (src, end, off = 0) => { ends.push(end); stats.peakVoices = Math.max(stats.peakVoices, ends.length); if (off) src.start(src._t0, off); else src.start(src._t0); src.stop(end); };
  const room = () => { prune(); return ends.length < VOICE_CAP; };
  const live = 0;
  const env = (g, t, peak, a, d, curve = 'exp') => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), t + a);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    else g.gain.linearRampToValueAtTime(0.0001, t + a + d);
  };
  const shape = (node, kind) => { const w = ctx.createWaveShaper(); w.curve = drv[kind]; w.oversample = '2x'; node.connect(w); return w; };
  return {
    room, ends, get live() { prune(); return ends.length + live; },
    noise(t, { f, f2 = 0, q = 0.8, type = 'bandpass', dur, gain, a = 0.001, off = 0, drive = null }) {
      if (!room()) { stats.dropped++; return; }
      const s = ctx.createBufferSource(); s.buffer = nb; s._t0 = t;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
      if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + dur);
      const g = ctx.createGain(); env(g, t, gain, a, dur);
      s.loop = true; s.loopStart = 0; s.loopEnd = 0.6;
      s.connect(fl); const out = drive ? shape(fl, drive) : fl; out.connect(g); g.connect(dest);
      track(s, t + a + dur + 0.02, off % 0.55);
    },
    osc(t, { type, f, f2 = 0, dur, gain, a = 0.002, lp = 0, lp2 = 0, q = 0.7, drive = null, detune = 0 }) {
      if (!room()) { stats.dropped++; return; }
      const o = ctx.createOscillator(); o.type = type; o._t0 = t; o.detune.value = detune;
      o.frequency.setValueAtTime(f, t);
      if (f2 && f2 !== f) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + a + dur);
      let node = o;
      if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = q; fl.frequency.setValueAtTime(lp, t); if (lp2) fl.frequency.exponentialRampToValueAtTime(lp2, t + a + dur); node.connect(fl); node = fl; }
      if (drive) node = shape(node, drive);
      const g = ctx.createGain(); env(g, t, gain, a, dur); node.connect(g); g.connect(dest);
      track(o, t + a + dur + 0.02);
    },
    drives: drv, shape,
  };
}

// ── A: HEAVY ENERGY RIFLE ──────────────────────────────────────────────────
function kitA(ctx, dest, stats, now) {
  const v = voices(ctx, dest, stats, now);
  const amb = (() => {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 220;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 3;
    const trem = ctx.createGain(); trem.gain.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 7;
    const lg = ctx.createGain(); lg.gain.value = 0.4; lfo.connect(lg); lg.connect(trem.gain);
    const out = ctx.createGain(); out.gain.value = 0.0001;
    o.connect(bp); bp.connect(trem); trem.connect(out); out.connect(dest);
    o.start(); lfo.start();
    return { o, lfo, out, level: 0, next: 0, holdUntil: 0, rng: mulberry32(0xb2a0a11e) };
  })();
  return {
    shot(t, { heat = 0, n = 0, hot = false, sustained = false }) {
      const r = ROT[n % ROT.length] * (hot ? 1.06 : 1), up = 1 + 0.16 * heat;
      // crack: a hard electrical transient, mid-high, 14ms
      v.noise(t, { f: 2600 * r, q: 1.1, dur: sustained ? 0.012 : 0.016, gain: sustained ? 0.32 : 0.42, drive: 'hard' });
      v.osc(t, { type: 'square', f: 1900 * r, f2: 520, dur: 0.009, gain: 0.12 });
      // body: two detuned saws, falling, resonant low-pass sweeping down, driven
      v.osc(t, { type: 'sawtooth', f: 236 * r * up, f2: 118 * r * up, dur: 0.085, gain: 0.2, lp: 2600 + 1400 * heat, lp2: 640, q: 5, drive: 'soft', detune: -9 });
      v.osc(t, { type: 'sawtooth', f: 236 * r * up, f2: 118 * r * up, dur: 0.085, gain: 0.16, lp: 2600 + 1400 * heat, lp2: 640, q: 5, drive: 'soft', detune: 11 });
      // mechanical cycling knock: a short square thump in the low mids
      v.osc(t + 0.004, { type: 'square', f: 150 * r, f2: 92, dur: 0.04, gain: 0.1, lp: 900 });
      // electrical grit: a narrow buzz that falls with the body
      v.noise(t + 0.006, { f: 1300 * r * up, f2: 700, q: 3.5, dur: 0.05, gain: 0.07 });
      // charge whine, rising and only from a quarter
      if (heat > 0.25) v.osc(t, { type: 'triangle', f: 880 * (1 + 0.6 * heat), f2: 820 * (1 + 0.6 * heat), dur: 0.06, gain: 0.025 + 0.05 * heat, a: 0.004 });
    },
    tail(t, heat) {
      v.noise(t, { f: 1800 + 600 * heat, f2: 500, q: 1.4, dur: 0.16, gain: 0.08, a: 0.004 });
      v.osc(t, { type: 'sawtooth', f: 160, f2: 70, dur: 0.12, gain: 0.06, lp: 700 });
    },
    impact(t, heat) { v.noise(t, { f: 3000, q: 1.6, dur: 0.012, gain: 0.08 + 0.04 * heat }); v.osc(t, { type: 'square', f: 260, f2: 140, dur: 0.022, gain: 0.05, lp: 1200 }); },
    kill(t) { v.noise(t, { f: 1600, f2: 600, q: 1.2, dur: 0.06, gain: 0.1, drive: 'soft' }); v.osc(t, { type: 'triangle', f: 700, f2: 1100, dur: 0.05, gain: 0.05 }); },
    stage(t, k) { v.osc(t, { type: 'square', f: 520 + 140 * k, f2: 760 + 140 * k, dur: 0.05, gain: 0.05, lp: 3000 }); v.noise(t, { f: 3600, q: 2, dur: 0.01, gain: 0.04 }); },
    // the Super silences the ready hum and holds it off while it plays
    holdBed(t, until) { amb.holdUntil = until; amb.out.gain.cancelScheduledValues(t); amb.out.gain.setValueAtTime(Math.max(0.0001, amb.level), t); amb.out.gain.linearRampToValueAtTime(0.0001, t + 0.02); amb.level = 0; },
    silence(t) { amb.out.gain.cancelScheduledValues(t); amb.out.gain.setValueAtTime(0.0001, t); amb.level = 0; },
    windup(t) {
      v.osc(t, { type: 'sawtooth', f: 260, f2: 1300, dur: 0.07, gain: 0.12, lp: 1200, lp2: 5000, q: 6, a: 0.01 });
      v.noise(t, { f: 900, f2: 5200, q: 2.5, dur: 0.07, gain: 0.12, a: 0.03 });
    },
    release(t) {
      v.noise(t, { f: 5500, f2: 380, type: 'lowpass', q: 1.2, dur: 0.32, gain: 0.48, drive: 'hard' });
      v.osc(t, { type: 'sawtooth', f: 170, f2: 52, dur: 0.42, gain: 0.32, lp: 2400, lp2: 300, q: 4, drive: 'hard', detune: -14 });
      v.osc(t, { type: 'sawtooth', f: 170, f2: 52, dur: 0.42, gain: 0.26, lp: 2400, lp2: 300, q: 4, drive: 'hard', detune: 16 });
      v.noise(t, { f: 1100, q: 1.4, dur: 0.05, gain: 0.3 });
      v.osc(t, { type: 'sine', f: 150, f2: 58, dur: 0.24, gain: 0.3 });
    },
    superHit(t) { v.noise(t, { f: 1500, f2: 400, type: 'lowpass', dur: 0.09, gain: 0.22, drive: 'soft' }); v.osc(t, { type: 'square', f: 320, f2: 120, dur: 0.06, gain: 0.12, lp: 1400 }); },
    cooldown(t) {
      v.osc(t, { type: 'sawtooth', f: 900, f2: 260, dur: 0.6, gain: 0.05, lp: 1800, lp2: 500, a: 0.02 });
      v.noise(t + 0.05, { f: 4200, f2: 1500, q: 1.5, dur: 0.5, gain: 0.03, a: 0.03 });
    },
    primed(t) { v.osc(t, { type: 'sawtooth', f: 330, f2: 660, dur: 0.18, gain: 0.07, lp: 1400, lp2: 3600, q: 4, a: 0.02 }); v.noise(t + 0.06, { f: 2400, q: 3, dur: 0.12, gain: 0.05 }); },
    lock(t, k) { v.osc(t, { type: 'square', f: 1100 + 120 * k, f2: 1400 + 120 * k, dur: 0.04, gain: 0.05, lp: 3200 }); },
    reloadStart(t, dur) { v.noise(t, { f: 2200, q: 1, dur: 0.02, gain: 0.12 }); v.osc(t, { type: 'square', f: 300, f2: 180, dur: 0.05, gain: 0.07, lp: 1500 }); v.osc(t + 0.04, { type: 'sawtooth', f: 140, f2: 380, dur: Math.max(0.05, dur - 0.08), gain: 0.03, lp: 1100, a: 0.04 }); },
    reloadEnd(t) { v.noise(t, { f: 2600, q: 1, dur: 0.015, gain: 0.12 }); v.noise(t + 0.05, { f: 1800, q: 1, dur: 0.02, gain: 0.14 }); v.osc(t + 0.05, { type: 'square', f: 420, f2: 640, dur: 0.05, gain: 0.07, lp: 2200 }); },
    // the ready ambience: a quiet, tremolo'd electrical hum with sparse sharp crackles
    bed(t, { heat, ready, suppressed }) {
      const lvl = ready && !suppressed ? 0.03 : 0;
      if (t < amb.holdUntil) return;
      if (Math.abs(lvl - amb.level) > 0.002) { amb.out.gain.cancelScheduledValues(t); amb.out.gain.setValueAtTime(Math.max(0.0001, amb.level), t); amb.out.gain.linearRampToValueAtTime(Math.max(0.0001, lvl), t + (lvl > amb.level ? 0.25 : 0.06)); amb.level = lvl; }
      if (ready && !suppressed && t >= amb.next) {
        v.noise(t, { f: 3200 + 1600 * amb.rng(), q: 5, dur: 0.01, gain: 0.05, drive: 'hard' });
        amb.next = t + 0.12 + amb.rng() * 0.35;
      }
      void heat;
    },
    destroy() { for (const o of [amb.o, amb.lfo]) { try { o.stop(); } catch (_) { /* */ } } try { amb.out.disconnect(); } catch (_) { /* */ } },
  };
}

// ── B: PLASMA REACTOR ──────────────────────────────────────────────────────
function kitB(ctx, dest, stats, now) {
  const v = voices(ctx, dest, stats, now);
  // the reactor bed: persistent detuned saws -> band-pass -> drive -> amplitude pulse -> gain
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
  o1.type = 'sawtooth'; o2.type = 'sawtooth'; o3.type = 'square';
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.2; bp.frequency.value = 700;
  const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 10;            // the cadence
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.0;
  const pulse = ctx.createGain(); pulse.gain.value = 1;
  const wob = ctx.createOscillator(); wob.type = 'sine'; wob.frequency.value = 5.3;
  const wobG = ctx.createGain(); wobG.gain.value = 0;
  const out = ctx.createGain(); out.gain.value = 0.0001;
  const mixG = ctx.createGain(); mixG.gain.value = 0.5;
  o1.connect(mixG); o2.connect(mixG); const o3g = ctx.createGain(); o3g.gain.value = 0.25; o3.connect(o3g); o3g.connect(mixG);
  mixG.connect(bp); const sh = v.shape(bp, 'soft'); sh.connect(pulse); pulse.connect(out); out.connect(dest);
  lfo.connect(lfoG); lfoG.connect(pulse.gain);
  wob.connect(wobG); wobG.connect(o1.detune); wobG.connect(o2.detune);
  // the bed's pitch, at the kit's own time: `AudioParam.value =` lands at an OfflineAudioContext's
  // render time 0 (its currentTime before rendering), which froze the pitch in offline renders;
  // live, setValueAtTime(f, currentTime) is exactly what the setter does
  const base = (f, t) => { o1.frequency.setValueAtTime(f, t); o2.frequency.setValueAtTime(f * 1.5, t); o3.frequency.setValueAtTime(f / 2, t); };
  o2.detune.value = 7; base(110, ctx.currentTime);
  const t0 = ctx.currentTime;
  for (const o of [o1, o2, o3, lfo, wob]) o.start(t0);
  const crackle = mulberry32(0xb2a0c0de);
  let nextCrack = 0, lastLevel = 0, holdUntil = 0, bpHz = 700;
  return {
    shot(t, { heat = 0, n = 0, hot = false, sustained = false }) {
      const r = ROT[n % ROT.length] * (hot ? 1.05 : 1), up = 1 + 0.2 * heat;
      // a pulse of the discharge, rounder than A's crack
      v.osc(t, { type: 'sine', f: 560 * r * up, f2: 250 * r, dur: 0.045, gain: sustained ? 0.17 : 0.24 });
      v.noise(t, { f: 1700 * r * up, q: 1.3, dur: 0.022, gain: sustained ? 0.13 : 0.2 });
      v.osc(t, { type: 'sawtooth', f: 330 * r * up, f2: 165 * r, dur: 0.07, gain: 0.12, lp: 2200 + 1800 * heat, lp2: 500, q: 7, drive: 'soft' });
      if (!sustained) v.osc(t, { type: 'square', f: 140, f2: 90, dur: 0.05, gain: 0.08, lp: 800 });
    },
    tail(t, heat) { v.noise(t, { f: 1200 + 500 * heat, f2: 300, q: 2, dur: 0.22, gain: 0.07, a: 0.006 }); },
    impact(t, heat) { v.noise(t, { f: 900, q: 2.4, dur: 0.05, gain: 0.07 + 0.04 * heat }); v.osc(t, { type: 'sine', f: 420, f2: 200, dur: 0.04, gain: 0.05 }); },
    kill(t) { v.noise(t, { f: 1100, f2: 400, q: 2, dur: 0.09, gain: 0.1 }); v.osc(t, { type: 'sine', f: 600, f2: 900, dur: 0.06, gain: 0.05 }); },
    stage(t, k) { v.osc(t, { type: 'sine', f: 380 + 90 * k, f2: 620 + 90 * k, dur: 0.09, gain: 0.05, a: 0.01 }); },
    windup(t) {
      holdUntil = t + 0.7;                                   // the bed is the Super's until the cooldown
      bp.frequency.cancelScheduledValues(t); bp.frequency.setValueAtTime(bpHz, t); bp.frequency.exponentialRampToValueAtTime(4200, t + 0.07); bpHz = 4200;
      out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(Math.max(0.0001, lastLevel), t); out.gain.linearRampToValueAtTime(0.16, t + 0.065); lastLevel = 0.16;
      v.noise(t, { f: 700, f2: 4800, q: 3, dur: 0.07, gain: 0.1, a: 0.04 });
    },
    release(t) {
      // the bed is cut by the discharge, then relights quietly (cooldown)
      holdUntil = Math.max(holdUntil, t + 0.6);
      out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(Math.max(0.0001, lastLevel), t); out.gain.linearRampToValueAtTime(0.0001, t + 0.004);
      bp.frequency.cancelScheduledValues(t); bp.frequency.setValueAtTime(500, t + 0.01); bpHz = 500;
      for (const d of [-18, 0, 15]) v.osc(t, { type: 'sawtooth', f: 225, f2: 55, dur: 0.46, gain: 0.2, lp: 5200, lp2: 280, q: 3, drive: 'hard', detune: d });
      v.noise(t, { f: 6000, f2: 300, type: 'lowpass', q: 0.9, dur: 0.36, gain: 0.42, drive: 'soft' });
      v.osc(t, { type: 'sine', f: 140, f2: 55, dur: 0.26, gain: 0.3 });
      lastLevel = 0;
    },
    superHit(t) { v.noise(t, { f: 800, f2: 300, q: 1.5, dur: 0.1, gain: 0.2, drive: 'soft' }); v.osc(t, { type: 'sine', f: 300, f2: 110, dur: 0.08, gain: 0.14 }); },
    cooldown(t) { v.osc(t, { type: 'sawtooth', f: 700, f2: 180, dur: 0.7, gain: 0.04, lp: 1400, lp2: 400, a: 0.03 }); },
    primed(t) { v.osc(t, { type: 'sawtooth', f: 220, f2: 440, dur: 0.25, gain: 0.06, lp: 900, lp2: 3000, q: 5, a: 0.03 }); },
    lock(t, k) { v.osc(t, { type: 'sine', f: 900 + 100 * k, f2: 1200 + 100 * k, dur: 0.05, gain: 0.05 }); },
    reloadStart(t, dur) { v.noise(t, { f: 1600, q: 1, dur: 0.02, gain: 0.1 }); v.osc(t + 0.03, { type: 'sine', f: 160, f2: 420, dur: Math.max(0.05, dur - 0.06), gain: 0.035, a: 0.04 }); },
    reloadEnd(t) { v.noise(t, { f: 2000, q: 1, dur: 0.02, gain: 0.12 }); v.osc(t + 0.04, { type: 'sine', f: 500, f2: 800, dur: 0.07, gain: 0.07 }); },
    /** Per frame: the bed follows firing, charge and readiness. */
    bed(t, { heat, firing, ready, suppressed }) {
      if (t < holdUntil) return;
      const lvl = suppressed ? 0 : firing ? 0.06 + 0.05 * heat : ready ? 0.035 : heat > 0.5 ? 0.012 : 0;
      if (Math.abs(lvl - lastLevel) > 0.002) { out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(Math.max(0.0001, lastLevel), t); out.gain.linearRampToValueAtTime(Math.max(0.0001, lvl), t + (lvl > lastLevel ? 0.03 : 0.12)); lastLevel = lvl; }
      base(110 + 50 * heat, t);
      bpHz = 600 + 1500 * heat + (ready ? 400 : 0); bp.frequency.setTargetAtTime(bpHz, t, 0.05);
      lfoG.gain.setTargetAtTime(firing ? 0.55 : ready ? 0.25 : 0, t, 0.03);
      lfo.frequency.setTargetAtTime(firing ? 10 : 4.4, t, 0.05);
      wobG.gain.setTargetAtTime(heat > 0.5 ? 6 + 30 * (heat - 0.5) + (ready ? 20 : 0) : 0, t, 0.1);
      // instability: crackles from three quarters, denser at full (a private stream)
      if (!suppressed && heat >= 0.75 && t >= nextCrack) {
        v.noise(t, { f: 2500 + 2000 * crackle(), q: 4, dur: 0.012, gain: ready ? 0.05 : 0.03 });
        nextCrack = t + (ready ? 0.08 : 0.22) + crackle() * (ready ? 0.18 : 0.4);
      }
    },
    silence(t) { out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(0.0001, t); lastLevel = 0; },
    holdBed() {},
    destroy() { for (const o of [o1, o2, o3, lfo, wob]) { try { o.stop(); } catch (_) { /* */ } } try { out.disconnect(); } catch (_) { /* */ } },
  };
}

// ── B2: PLASMA REACTOR, REFINED (B2-R3; `&b2a=B2`, B stays as the control) ──
// The HUMAN chose B and asked for a deeper, richer charge, a convincing climb to critical
// overload, and an unmistakable Super-ready confirmation. B is kept whole (its shot, wheezing
// band-passed bed, pulse at the cadence, crackle); B2 adds:
//  DEPTH  a second bed layer: two detuned saws low in the register (55 Hz rising to 82 Hz
//         with the charge) through a resonant low-pass that opens with the charge, driven,
//         then high-passed at 200 Hz: the fundamental a phone cannot play is removed and its
//         harmonics (200-1000 Hz, where a phone speaker still carries them) carry the pitch.
//         Silent at zero charge (ordinary fire sounds like B), it grows with every quarter;
//         at full it beats (the saws drift apart) under a slow throb.
//  BODY   each shot, stage cue, release and Super hit gains a low-mid layer that scales with
//         the charge.
//  READY  a confirmation on the genuine transition into "the Super can be released" (full,
//         not suppressed, alive): a restrained rising intake, two precisely tuned pips (B5,
//         then E6 held), a metallic-electric ring and a low resonant thunk. Once per
//         transition; it plays again only if availability is lost and regained (a Vader
//         suppression ending while full). A wind-up, pause, death or suppression cuts it.
//  LOCK   a target acquired during held-F targeting is one short pip from the same family
//         (B5 rising a whole tone per lock), with no intake and no ring.
//  RELEASE B's discharge with a low-mid body, opened by the E6 tone falling an octave.
// Level: the bus is trimmed (B2_TRIM, before the kit's compressor) so B2 and B sit level on a
// recorded 15 s fight's timeline: B2 +0.6 LU full-band, -0.6 LU through a phone-speaker filter
// (EBU R128 integrated; docs/evidence/b2-r3/README.md). The author cannot listen; levels were
// matched by measurement only.
export const B2_TRIM = 0.72;
export const B2_TONES = { pip1: 987.77, pip2: 1318.51, ring: 2637.02, thunk: 164.81 };
function kitB2(ctx, dest, stats, now) {
  const v = voices(ctx, dest, stats, now);
  // B's bed, unchanged
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
  o1.type = 'sawtooth'; o2.type = 'sawtooth'; o3.type = 'square';
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.2; bp.frequency.value = 700;
  const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 10;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.0;
  const pulse = ctx.createGain(); pulse.gain.value = 1;
  const wob = ctx.createOscillator(); wob.type = 'sine'; wob.frequency.value = 5.3;
  const wobG = ctx.createGain(); wobG.gain.value = 0;
  const out = ctx.createGain(); out.gain.value = 0.0001;
  const mixG = ctx.createGain(); mixG.gain.value = 0.5;
  o1.connect(mixG); o2.connect(mixG); const o3g = ctx.createGain(); o3g.gain.value = 0.25; o3.connect(o3g); o3g.connect(mixG);
  mixG.connect(bp); const sh = v.shape(bp, 'soft'); sh.connect(pulse); pulse.connect(out); out.connect(dest);
  lfo.connect(lfoG); lfoG.connect(pulse.gain);
  wob.connect(wobG); wobG.connect(o1.detune); wobG.connect(o2.detune);
  // the bed's pitch, at the kit's own time: `AudioParam.value =` lands at an OfflineAudioContext's
  // render time 0 (its currentTime before rendering), which froze the pitch in offline renders;
  // live, setValueAtTime(f, currentTime) is exactly what the setter does
  const base = (f, t) => { o1.frequency.setValueAtTime(f, t); o2.frequency.setValueAtTime(f * 1.5, t); o3.frequency.setValueAtTime(f / 2, t); };
  o2.detune.value = 7; base(110, ctx.currentTime);
  // DEPTH: two low saws -> resonant low-pass -> drive -> tame -> its own pulse -> gain
  const d1 = ctx.createOscillator(), d2 = ctx.createOscillator();
  d1.type = 'sawtooth'; d2.type = 'sawtooth'; d1.frequency.value = 55; d2.frequency.value = 55;
  const dMix = ctx.createGain(); dMix.gain.value = 0.5;
  const dLp = ctx.createBiquadFilter(); dLp.type = 'lowpass'; dLp.Q.value = 7; dLp.frequency.value = 260;
  d1.connect(dMix); d2.connect(dMix); dMix.connect(dLp);
  const dSh = v.shape(dLp, 'hard');
  const dTame = ctx.createBiquadFilter(); dTame.type = 'lowpass'; dTame.Q.value = 0.7; dTame.frequency.value = 1800;
  dSh.connect(dTame);
  // the fundamental itself is taken out (a phone cannot play it): what is left is its driven
  // harmonics, which the ear still hears as that low pitch
  const dHp1 = ctx.createBiquadFilter(), dHp2 = ctx.createBiquadFilter();
  for (const f of [dHp1, dHp2]) { f.type = 'highpass'; f.Q.value = 0.7; f.frequency.value = 200; }
  dTame.connect(dHp1); dHp1.connect(dHp2);
  const dPulse = ctx.createGain(); dPulse.gain.value = 1;
  const dLfo = ctx.createOscillator(); dLfo.type = 'sine'; dLfo.frequency.value = 2.2;
  const dLfoG = ctx.createGain(); dLfoG.gain.value = 0;
  dLfo.connect(dLfoG); dLfoG.connect(dPulse.gain); lfoG.connect(dPulse.gain);
  const dOut = ctx.createGain(); dOut.gain.value = 0.0001;
  dHp2.connect(dPulse); dPulse.connect(dOut); dOut.connect(dest);
  // the confirmation's own path, so a wind-up, pause, death or suppression can cut it
  const cBus = ctx.createGain(); cBus.gain.value = 1; cBus.connect(dest);
  const cv = voices(ctx, cBus, stats, now, v.ends);
  const t0 = ctx.currentTime;
  for (const o of [o1, o2, o3, lfo, wob, d1, d2, dLfo]) o.start(t0);
  const crackle = mulberry32(0xb2a0c0de);
  let nextCrack = 0, lastLevel = 0, holdUntil = 0, bpHz = 700, dLevel = 0, dHz = 260, cLevel = 1;
  const ramp = (g, from, to, t, dur) => { g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, from), t); g.linearRampToValueAtTime(Math.max(0.0001, to), t + dur); };
  return {
    shot(t, { heat = 0, n = 0, hot = false, sustained = false }) {
      const r = ROT[n % ROT.length] * (hot ? 1.05 : 1), up = 1 + 0.2 * heat;
      v.osc(t, { type: 'sine', f: 560 * r * up, f2: 250 * r, dur: 0.045, gain: sustained ? 0.17 : 0.24 });
      v.noise(t, { f: 1700 * r * up, q: 1.3, dur: 0.022, gain: sustained ? 0.13 : 0.2 });
      v.osc(t, { type: 'sawtooth', f: 330 * r * up, f2: 165 * r, dur: 0.07, gain: 0.12, lp: 2200 + 1800 * heat, lp2: 500, q: 7, drive: 'soft' });
      if (!sustained) v.osc(t, { type: 'square', f: 140, f2: 90, dur: 0.05, gain: 0.08, lp: 800 });
      // BODY: a driven low saw and a low-mid chuff, both growing with the charge
      v.osc(t, { type: 'sawtooth', f: 196 * r * (1 + 0.2 * heat), f2: 131, dur: 0.075, gain: 0.02 + 0.05 * heat, lp: 900 + 600 * heat, lp2: 420, q: 4, drive: 'soft' });
      v.noise(t, { f: 420 * r, q: 1.6, dur: 0.04, gain: 0.04 + 0.07 * heat });
    },
    tail(t, heat) { v.noise(t, { f: 1200 + 500 * heat, f2: 300, q: 2, dur: 0.22, gain: 0.07, a: 0.006 }); v.osc(t, { type: 'sawtooth', f: 147, f2: 92, dur: 0.2, gain: 0.02 + 0.04 * heat, lp: 650, drive: 'soft' }); },
    impact(t, heat) { v.noise(t, { f: 900, q: 2.4, dur: 0.05, gain: 0.07 + 0.04 * heat }); v.osc(t, { type: 'sine', f: 420, f2: 200, dur: 0.04, gain: 0.05 }); },
    kill(t) { v.noise(t, { f: 1100, f2: 400, q: 2, dur: 0.09, gain: 0.1 }); v.osc(t, { type: 'sine', f: 600, f2: 900, dur: 0.06, gain: 0.05 }); },
    stage(t, k) {
      // a deeper resonant swell under B's chirp
      v.osc(t, { type: 'sawtooth', f: 123 * (1 + k * 0.12), f2: 165 * (1 + k * 0.12), dur: 0.17, gain: 0.07, lp: 400, lp2: 1600, q: 9, a: 0.03, drive: 'soft' });
      v.osc(t, { type: 'sine', f: 380 + 90 * k, f2: 620 + 90 * k, dur: 0.09, gain: 0.035, a: 0.01 });
    },
    confirm(t) {
      ramp(cBus.gain, cLevel, 1, t, 0.004); cLevel = 1;
      // intake: a band of noise and a low saw rising together, restrained
      cv.noise(t, { f: 300, f2: 2600, q: 2.2, dur: 0.05, a: 0.1, gain: 0.06 });
      cv.osc(t, { type: 'sawtooth', f: 110, f2: 220, dur: 0.05, a: 0.1, gain: 0.05, lp: 400, lp2: 1800, q: 6 });
      // the two pips: B5, then E6 held; each with a square an octave down for a phone's body
      const p1 = t + 0.15, p2 = t + 0.22, T = B2_TONES;
      cv.osc(p1, { type: 'sine', f: T.pip1, dur: 0.045, gain: 0.1, a: 0.003 });
      cv.osc(p1, { type: 'square', f: T.pip1 / 2, dur: 0.045, gain: 0.025, a: 0.003, lp: 2400 });
      cv.osc(p2, { type: 'sine', f: T.pip2, dur: 0.13, gain: 0.11, a: 0.003 });
      cv.osc(p2, { type: 'square', f: T.pip2 / 2, dur: 0.13, gain: 0.03, a: 0.003, lp: 2600 });
      cv.noise(p2, { f: 3000, q: 1.5, dur: 0.006, gain: 0.03 });
      // the ring: a narrow metallic band, an inharmonic partial, and a low resonant thunk
      cv.noise(p2, { f: T.ring, q: 14, dur: 0.32, gain: 0.05, a: 0.004 });
      cv.osc(p2, { type: 'sine', f: T.pip2 * 2.76, dur: 0.25, gain: 0.012, a: 0.004 });
      cv.osc(p2, { type: 'sine', f: T.thunk, dur: 0.18, gain: 0.06, a: 0.004 });
      cv.osc(p2, { type: 'sawtooth', f: T.thunk, f2: T.thunk * 0.9, dur: 0.16, gain: 0.03, lp: 600, a: 0.004 });
    },
    cutConfirm(t) { if (cLevel > 0.01) { ramp(cBus.gain, cLevel, 0.0001, t, 0.015); cLevel = 0; } },
    // the Super's bed control (the reactor swells into the wind-up, is cut by the discharge and
    // held off until the cooldown) is split from its sound layers so B2S can keep the bed and
    // replace the layers; B2 calls both, in the same order as before
    windupBed(t) {
      holdUntil = t + 0.7;
      bp.frequency.cancelScheduledValues(t); bp.frequency.setValueAtTime(bpHz, t); bp.frequency.exponentialRampToValueAtTime(4200, t + 0.07); bpHz = 4200;
      ramp(out.gain, lastLevel, 0.16, t, 0.065); lastLevel = 0.16;
      ramp(dOut.gain, dLevel, 0.12, t, 0.065); dLevel = 0.12;
      dLp.frequency.cancelScheduledValues(t); dLp.frequency.setValueAtTime(dHz, t); dLp.frequency.exponentialRampToValueAtTime(1400, t + 0.07); dHz = 1400;
    },
    windup(t) {
      this.windupBed(t);
      v.noise(t, { f: 700, f2: 4800, q: 3, dur: 0.07, gain: 0.1, a: 0.04 });
    },
    releaseBed(t) {
      holdUntil = Math.max(holdUntil, t + 0.6);
      ramp(out.gain, lastLevel, 0.0001, t, 0.004); lastLevel = 0;
      ramp(dOut.gain, dLevel, 0.0001, t, 0.004); dLevel = 0;
      bp.frequency.cancelScheduledValues(t); bp.frequency.setValueAtTime(500, t + 0.01); bpHz = 500;
      dLp.frequency.cancelScheduledValues(t); dLp.frequency.setValueAtTime(260, t + 0.01); dHz = 260;
    },
    release(t) {
      this.releaseBed(t);
      v.osc(t, { type: 'sine', f: B2_TONES.pip2, f2: B2_TONES.pip2 / 2, dur: 0.05, gain: 0.05 });
      for (const d of [-18, 0, 15]) v.osc(t, { type: 'sawtooth', f: 225, f2: 55, dur: 0.46, gain: 0.2, lp: 5200, lp2: 280, q: 3, drive: 'hard', detune: d });
      v.noise(t, { f: 6000, f2: 300, type: 'lowpass', q: 0.9, dur: 0.36, gain: 0.42, drive: 'soft' });
      v.osc(t, { type: 'sine', f: 140, f2: 55, dur: 0.26, gain: 0.3 });
      // BODY: a driven low saw falling an octave, and a low-mid burst a phone carries
      v.osc(t, { type: 'sawtooth', f: 165, f2: 82, dur: 0.5, gain: 0.14, lp: 1200, lp2: 320, q: 3, drive: 'hard' });
      v.noise(t, { f: 420, q: 1.2, dur: 0.18, gain: 0.18 });
    },
    superHit(t) { v.noise(t, { f: 800, f2: 300, q: 1.5, dur: 0.1, gain: 0.2, drive: 'soft' }); v.osc(t, { type: 'sine', f: 300, f2: 110, dur: 0.08, gain: 0.14 }); v.noise(t, { f: 300, q: 1.2, dur: 0.07, gain: 0.08 }); },
    cooldown(t) { v.osc(t, { type: 'sawtooth', f: 700, f2: 180, dur: 0.7, gain: 0.04, lp: 1400, lp2: 400, a: 0.03 }); v.osc(t, { type: 'sawtooth', f: 196, f2: 98, dur: 0.6, gain: 0.03, lp: 700, a: 0.03, drive: 'soft' }); },
    primed() { /* the confirmation is driven by the availability edge (update), not the meter event */ },
    lock(t, k) {
      const f = B2_TONES.pip1 * Math.pow(2, (2 * Math.max(0, k - 1)) / 12);
      v.osc(t, { type: 'sine', f, dur: 0.04, gain: 0.06, a: 0.003 });
      v.osc(t, { type: 'square', f: f / 2, dur: 0.04, gain: 0.018, a: 0.003, lp: 2200 });
      v.noise(t, { f: 3000, q: 1.5, dur: 0.005, gain: 0.02 });
    },
    reloadStart(t, dur) { v.noise(t, { f: 1600, q: 1, dur: 0.02, gain: 0.1 }); v.osc(t + 0.03, { type: 'sine', f: 160, f2: 420, dur: Math.max(0.05, dur - 0.06), gain: 0.035, a: 0.04 }); },
    reloadEnd(t) { v.noise(t, { f: 2000, q: 1, dur: 0.02, gain: 0.12 }); v.osc(t + 0.04, { type: 'sine', f: 500, f2: 800, dur: 0.07, gain: 0.07 }); },
    /** Per frame. `dead` silences both beds; `sup` (a suppression) withholds only the ready hum. */
    bed(t, { heat, firing, ready, dead, sup }) {
      if (t < holdUntil) return;
      const avail = ready && !sup;
      const lvl = dead ? 0 : firing ? 0.06 + 0.05 * heat : avail ? 0.035 : heat > 0.5 ? 0.012 : 0;
      if (Math.abs(lvl - lastLevel) > 0.002) { ramp(out.gain, lastLevel, lvl, t, lvl > lastLevel ? 0.03 : 0.12); lastLevel = lvl; }
      base(110 + 50 * heat, t);
      bpHz = 600 + 1500 * heat + (avail ? 400 : 0); bp.frequency.setTargetAtTime(bpHz, t, 0.05);
      lfoG.gain.setTargetAtTime(firing ? 0.55 : avail ? 0.25 : 0, t, 0.03);
      lfo.frequency.setTargetAtTime(firing ? 10 : 4.4, t, 0.05);
      wobG.gain.setTargetAtTime(heat > 0.5 ? 6 + 30 * (heat - 0.5) + (avail ? 20 : 0) : 0, t, 0.1);
      // DEPTH: nothing at zero charge; with the charge it deepens, opens and, at full, beats
      const dl = dead ? 0 : firing ? 0.02 + 0.07 * heat : avail ? 0.05 : heat > 0.25 ? 0.008 + 0.02 * heat : 0;
      if (Math.abs(dl - dLevel) > 0.002) { ramp(dOut.gain, dLevel, dl, t, dl > dLevel ? 0.05 : 0.15); dLevel = dl; }
      const f0 = 55 * (1 + 0.5 * heat);
      d1.frequency.setTargetAtTime(f0, t, 0.08); d2.frequency.setTargetAtTime(f0, t, 0.08);
      const spread = heat >= 1 ? 14 : 4 + 6 * heat;
      d1.detune.setTargetAtTime(-spread, t, 0.2); d2.detune.setTargetAtTime(spread, t, 0.2);
      dHz = 340 + 700 * heat; dLp.frequency.setTargetAtTime(dHz, t, 0.06);
      dLfoG.gain.setTargetAtTime(avail && !firing ? 0.35 : 0, t, 0.1);
      if (!dead && !sup && heat >= 0.75 && t >= nextCrack) {
        v.noise(t, { f: 2500 + 2000 * crackle(), q: 4, dur: 0.012, gain: avail ? 0.05 : 0.03 });
        nextCrack = t + (avail ? 0.08 : 0.22) + crackle() * (avail ? 0.18 : 0.4);
      }
    },
    silence(t) { ramp(out.gain, 0.0001, 0.0001, t, 0.001); ramp(dOut.gain, 0.0001, 0.0001, t, 0.001); lastLevel = 0; dLevel = 0; },
    holdBed() {},
    _v: v,
    destroy() { for (const o of [o1, o2, o3, lfo, wob, d1, d2, dLfo]) { try { o.stop(); } catch (_) { /* */ } } for (const g of [out, dOut, cBus]) { try { g.disconnect(); } catch (_) { /* */ } } },
  };
}

// ── B2S: AUDIO B2 WITH THE B2-R4 SUPER (`&b2a=B2S`; B2 stays as the control) ──
// The HUMAN approved B2's shot, charge, ready confirmation and lock; only the Super attack
// still sounded disconnected (in play, every Super pellet hit also fired the game's generic
// hit beep — the flagship routes those to this kit under B2S). B2S is kit B2 itself — every
// approved method is B2's own object, unchanged — with the Super's sound layers replaced:
//  A COMPRESSION  from the cast to the discharge: two driven saws (98 / 147 Hz) through a
//     resonant band-pass sweeping up as it squeezes, a noise band sucked inward, a rising
//     tension tone, all swelling; held until the discharge cuts them (its own bus).
//  B DISCHARGE  a hard transient (driven noise and a click), a low-mid punch (a driven square
//     falling 220 -> 70 Hz, harmonics a phone carries), a dense electrical body (three detuned
//     driven saws 165 -> 62 Hz under a closing low-pass), a crackling band, a low-mid weight,
//     and B2's E6 tone falling an octave (the confirmation's pitch, now spent).
//  C PASSAGE  five short falling noise zips 11ms apart: the five masses leaving fast (no beam).
//  D IMPACTS  each a chunky thump, crack and electrical spit, round-robin in pitch; hits on the
//     same tick merge, the rest queue at least 40ms apart, at most six per release, never more
//     than 150ms behind their hit; after the last, an unstable electrical decay (sparse
//     crackles thinning out, a falling hiss) on its own cuttable bus. B2's cooldown follows.
// Its own bus and compressor (the approved shots are not pumped by it), its own private random
// stream; the compression and decay buses are cut by the discharge, a pause, death or restart.
/** The Super bus level (B2S), before its own compressor; see docs/evidence/b2-r4/README.md. */
export const B2S_TRIM = 1.45;
export const B2S_SUPER = { compMaxS: 0.2, zips: 5, zipGapS: 0.011, impactGapS: 0.04, impactMax: 6, impactLagS: 0.15, windowS: 1.2, pitch: [1, 0.92, 1.08, 0.96, 1.04, 0.9] };
function kitB2S(ctx, dest, stats, now, superDest) {
  const base = kitB2(ctx, dest, stats, now);
  const sv = voices(ctx, superDest, stats, now, base._v.ends);
  const ends = base._v.ends;
  const compBus = ctx.createGain(); compBus.gain.value = 1; compBus.connect(superDest);
  const cv = voices(ctx, compBus, stats, now, ends);
  const tailBus = ctx.createGain(); tailBus.gain.value = 1; tailBus.connect(superDest);
  const tv = voices(ctx, tailBus, stats, now, ends);
  const rnd = mulberry32(0xb25e0f17);
  const S = B2S_SUPER;
  const st = (stats.super = { windups: 0, releases: 0, zips: 0, impacts: 0, merged: 0, late: 0, capped: 0, decays: 0, cuts: 0, deathCuts: 0, minGap: Infinity, maxLag: 0 });
  let compOn = false, relT = -1, impN = 0, lastImpT = -1, lastHitCall = -1, decayAt = -1;
  const cut = (bus, t) => { bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value > 0.001 ? 1 : 0.0001, t); bus.gain.linearRampToValueAtTime(0.0001, t + 0.006); };
  const open = (bus, t) => { bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(1, t); };
  // the compression: driven saws through a rising band-pass, a noise band sucked inward, a tension tone
  const compression = (t) => {
    const D = S.compMaxS, nodes = [];
    const mk = (type, f, f2) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f2, t + 0.11); nodes.push(o); return o; };
    const a = mk('sawtooth', 98, 104), b = mk('sawtooth', 147, 156);
    const mx = ctx.createGain(); mx.gain.value = 0.5; a.connect(mx); b.connect(mx);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(1600, t + 0.11);
    mx.connect(bp); const sh = sv.shape(bp, 'soft');
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.1); g.gain.setValueAtTime(0.16, t + D - 0.03); g.gain.linearRampToValueAtTime(0.0001, t + D);
    sh.connect(g); g.connect(compBus);
    for (const o of nodes) { o.start(t); o.stop(t + D + 0.02); ends.push(t + D + 0.02); }
    stats.peakVoices = Math.max(stats.peakVoices, ends.length);
    cv.noise(t, { f: 2400, f2: 600, q: 2.5, a: 0.1, dur: D - 0.1, gain: 0.09 });
    cv.osc(t, { type: 'sine', f: 220, f2: 440, a: 0.1, dur: D - 0.1, gain: 0.04 });
  };
  const impact = (t, k, w) => {
    const r = S.pitch[k % S.pitch.length];
    sv.osc(t, { type: 'square', f: 190 * r, f2: 70 * r, dur: 0.07, gain: 0.22 * w, lp: 1000, lp2: 300, drive: 'soft' });
    sv.noise(t, { f: 1500 * r, q: 1.3, dur: 0.03, gain: 0.32 * w, drive: 'soft' });
    sv.osc(t, { type: 'triangle', f: 640 * r, f2: 420 * r, dur: 0.05, gain: 0.08 * w });
    sv.noise(t, { f: 3400, q: 4, dur: 0.02, gain: 0.06 * w });
  };
  const decay = (t) => {
    st.decays++;
    open(tailBus, t);
    let u = t + 0.03;
    for (let i = 0; i < 8 && u < t + 0.6; i++) { tv.noise(u, { f: 2200 + 2600 * rnd(), q: 4, dur: 0.012, gain: 0.09 * (1 - i / 9), drive: 'hard' }); u += 0.04 + rnd() * 0.07 * (1 + i * 0.4); }
    tv.noise(t, { f: 2800, f2: 500, q: 1.6, a: 0.02, dur: 0.6, gain: 0.035 });
  };
  return {
    ...base,
    windup(t) {
      st.windups++;
      base.windupBed(t);
      open(compBus, t); compOn = true;
      compression(t);
    },
    release(t) {
      st.releases++;
      base.releaseBed(t);
      if (compOn) { cut(compBus, t); compOn = false; st.cuts++; }
      relT = t; impN = 0; lastImpT = -1; lastHitCall = -1; decayAt = -1;
      // B: the discharge
      sv.noise(t, { f: 1800, q: 0.9, dur: 0.01, gain: 0.4, drive: 'hard' });
      sv.noise(t, { f: 3000, q: 1.2, dur: 0.025, gain: 0.22, drive: 'soft' });     // the snap a phone carries
      sv.osc(t, { type: 'square', f: 3000, f2: 1200, dur: 0.004, gain: 0.08 });
      sv.osc(t, { type: 'square', f: 220, f2: 70, dur: 0.06, gain: 0.35, lp: 1400, lp2: 500, drive: 'hard' });
      for (const d of [-14, 0, 12]) sv.osc(t, { type: 'sawtooth', f: 165, f2: 62, dur: 0.42, gain: 0.16, lp: 3200, lp2: 380, q: 3, drive: 'hard', detune: d });
      sv.noise(t, { f: 3500, f2: 600, q: 0.8, dur: 0.3, gain: 0.3, drive: 'soft' });   // the rush: mid-range, where a phone plays it
      sv.noise(t, { f: 1200, q: 1.5, dur: 0.22, gain: 0.26, drive: 'soft' });
      sv.noise(t + 0.01, { f: 2600, q: 4, dur: 0.12, gain: 0.08 });
      sv.osc(t, { type: 'square', f: 110, f2: 82, dur: 0.28, gain: 0.12, lp: 500 });
      sv.osc(t, { type: 'sine', f: B2_TONES.pip2, f2: B2_TONES.pip2 / 2, dur: 0.05, gain: 0.05 });
      // C: the five masses leaving
      for (let i = 0; i < S.zips; i++) {
        const z = t + 0.012 + i * S.zipGapS;
        sv.noise(z, { f: 2600 - i * 90, f2: 700, q: 2.2, dur: 0.08, gain: 0.07 });
        st.zips++;
      }
    },
    /** One Super pellet hit an enemy (the game's tick time `t`, as given by the caller). */
    superHit(t) {
      if (relT < 0 || t - relT > S.windowS) { relT = relT < 0 ? t : relT; }
      if (lastHitCall >= 0 && Math.abs(t - lastHitCall) < 0.008) { st.merged++; return; }   // same tick: one impact
      lastHitCall = t;
      if (impN >= S.impactMax) { st.capped++; return; }
      const at = Math.max(t, lastImpT < 0 ? t : lastImpT + S.impactGapS);
      if (at - t > S.impactLagS) { st.late++; return; }
      impact(at, impN, 1 - impN * 0.07);
      if (lastImpT >= 0) st.minGap = Math.min(st.minGap, +(at - lastImpT).toFixed(4));
      st.maxLag = Math.max(st.maxLag, +(at - t).toFixed(4));
      lastImpT = at; impN++; st.impacts++;
      // the decay follows the last impact (re-armed by each one)
      decayAt = at + 0.09;
    },
    /** Per frame (the kit's bed and the decay's timing). */
    bed(t, o) {
      base.bed(t, o);
      if (decayAt >= 0 && t >= decayAt) { decay(decayAt); decayAt = -1; }
    },
    silence(t) {
      base.silence(t);
      if (compOn) { cut(compBus, t); compOn = false; st.cuts++; }
      cut(tailBus, t); decayAt = -1;
    },
    /** The hero died: the compression and the decay stop with it (the beds follow `dead`). */
    cutSuper(t) { if (compOn) { cut(compBus, t); compOn = false; } cut(tailBus, t); decayAt = -1; st.deathCuts++; },
    destroy() { base.destroy(); for (const g of [compBus, tailBus]) { try { g.disconnect(); } catch (_) { /* */ } } },
  };
}

// ── B2-R5: A NEW SUPER DISCHARGE (`&b2a=B2HC|B2RD`, HUMAN direction 2026-11-20) ───────────
// The HUMAN rejected B2S's Super as "the old Super sound with slightly more thickness" and asked
// for an exaggerated, stylized heavy blast: a violent, instant KRA—THOOOM, weapon first. These are
// new voices, not a remaster: none of B2/B2S's discharge layers (the E6 pip falling an octave,
// the detuned saws falling over half a second, B2's falling-saw cooldown) is played. B2's approved
// cues (rifle, charge, ready confirmation, locks) are B2's own methods, unchanged; B2's charge bed
// still swells into the wind-up and stops at the blast exactly as before.
//
//  HC  HEAVY CANNON. A frighteningly fast crack (broadband, 3-18 ms), a huge saturated low-mid
//      body (a driven pitch-dropping thump plus a roaring low-passed noise burst, 150-900 Hz where
//      laptop and phone speakers still play it), a short reactor "dump" (drive + its own pumping
//      compressor), then a compact gritty tail (a rattling low noise and a few sparks, ~0.35 s)
//      and a quiet two-step breech action. Weapon first, reactor second.
//  RD  REACTOR DETONATION. An equally hard detonation, then an audible pressure collapse: a swell
//      sucked upward (rising noise band and a rising sub tone, cut dead) that lands on a second,
//      collapsing thump; a coarse electrical fracture (a sparse impulse crackle) under all of it,
//      and a longer but controlled decay (~0.8 s). A reactor discharged through a cannon.
//
// Both: triggered by the committed blast (`player-super-blast`, as B2S), a short pre-blast in the
// game's own 70 ms wind-up (cut by the blast), five projectile zips kept far below the blast, at
// most three impacts (same-tick hits merge, 50 ms apart) that thump rather than beep, a brief
// music dip and a brief dip of the other game sounds (the B2 kit and the Super are not on that
// bus), their own bus and compressor, B2's voice cap, the cuts on pause, death and restart.
// THE AUTHOR CANNOT LISTEN: designed from principles, checked by measurement; the HUMAN decides.
/** In-game Super bus levels, set so each candidate's Super window matches B2S's loudness. */
export const R5_TRIM = { B2HC: 1.25, B2RD: 0.4 };
export const R5_SUPER = { zips: 5, zipGapS: 0.009, impactGapS: 0.05, impactMax: 3, impactLagS: 0.15, windowS: 1.2 };
function crackleBuffer(ctx, seed, secs = 0.8) {
  // a sparse impulse train, densest at the start: each impulse a 1-3 sample spike of random sign
  const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = mulberry32(seed);
  let i = 0;
  while (i < n) {
    const u = i / n, amp = (0.35 + 0.65 * r()) * (1 - 0.7 * u), w = 1 + Math.floor(r() * 3), sg = r() < 0.5 ? -1 : 1;
    for (let k = 0; k < w && i + k < n; k++) d[i + k] = sg * amp * (1 - k / (w + 1));
    i += Math.floor(ctx.sampleRate * (0.0012 + 0.016 * u * u + 0.004 * r()));
  }
  return b;
}
function roomIR(ctx, seed, secs, tau) {
  // a dark synthetic room: four early slapbacks, then diffuse noise decaying with time constant tau
  const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = mulberry32(seed);
  for (let i = 0; i < n; i++) { const t = i / ctx.sampleRate; d[i] = (r() * 2 - 1) * Math.exp(-t / tau) * (1 - Math.exp(-t / 0.004)) * 0.5; }
  for (const [ts, a] of [[0.007, 0.6], [0.013, 0.45], [0.021, 0.35], [0.034, 0.25]]) d[Math.floor(ts * ctx.sampleRate)] += a;
  return b;
}
function kitR5(ctx, dest, stats, now, superDest, design) {
  const base = kitB2(ctx, dest, stats, now);
  const ends = base._v.ends;
  const HC = design === 'HC';
  const tailBus = ctx.createGain(); tailBus.gain.value = 1; tailBus.connect(superDest);
  // the blast bus: dry to the Super bus, and a send into a short dark room on the (cuttable) tail bus
  const blastBus = ctx.createGain(); blastBus.gain.value = 1; blastBus.connect(superDest);
  const conv = ctx.createConvolver(); conv.normalize = true; conv.buffer = roomIR(ctx, HC ? 0xc4a7b00e : 0xde7b00e, HC ? 0.7 : 1.1, HC ? 0.11 : 0.19);
  const wetLp = ctx.createBiquadFilter(); wetLp.type = 'lowpass'; wetLp.frequency.value = HC ? 2600 : 3600; wetLp.Q.value = 0.6;
  const wet = ctx.createGain(); wet.gain.value = HC ? 0.42 : 0.5;
  blastBus.connect(conv); conv.connect(wetLp); wetLp.connect(wet); wet.connect(tailBus);
  const sv = voices(ctx, blastBus, stats, now, ends);
  sv.drives.brutal = driveCurve(22);
  const preBus = ctx.createGain(); preBus.gain.value = 1; preBus.connect(superDest);
  const pv = voices(ctx, preBus, stats, now, ends);
  const tv = voices(ctx, tailBus, stats, now, ends);
  tv.drives.brutal = sv.drives.brutal;
  const rnd = mulberry32(HC ? 0xb2c4a770 : 0xb2de7011);
  const crk = crackleBuffer(ctx, HC ? 0xc4ac1e01 : 0xde7c4ac1);
  const noiseBuf = noiseBuffer(ctx, HC ? 0xc4a7ab1e : 0xde70ab1e, 0.6);
  const S = R5_SUPER;
  const st = (stats.super = { design, windups: 0, releases: 0, blasts: 0, zips: 0, impacts: 0, merged: 0, late: 0, capped: 0, tails: 0, breech: 0, cuts: 0, deathCuts: 0, minGap: Infinity, maxLag: 0 });
  let preOn = false, relT = -1, impN = 0, lastImpT = -1, lastHitCall = -1;
  const cut = (bus, t) => { bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value > 0.001 ? 1 : 0.0001, t); bus.gain.linearRampToValueAtTime(0.0001, t + 0.006); };
  const open = (bus, t) => { bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(1, t); };
  const count = (end) => { ends.push(end); stats.peakVoices = Math.max(stats.peakVoices, ends.length); };
  // the crackle: the impulse buffer through a band, driven
  const crackle = (bus, t, { f, q = 0.9, dur, gain, drive = 'hard', a = 0.002 }) => {
    if (ends.length >= VOICE_CAP) { stats.dropped++; return; }
    const s = ctx.createBufferSource(); s.buffer = crk;
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
    const w = sv.shape(fl, drive); s.connect(fl);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    w.connect(g); g.connect(bus); s.start(t); s.stop(t + a + dur + 0.02); count(t + a + dur + 0.02);
  };
  // the rattle: low noise chopped by a square LFO (mechanical, gritty), falling
  const rattle = (bus, t, { f, f2, hz, dur, gain }) => {
    if (ends.length + 2 > VOICE_CAP) { stats.dropped++; return; }
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 1.2; fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const chop = ctx.createGain(); chop.gain.value = 0.55;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.setValueAtTime(hz, t); lfo.frequency.linearRampToValueAtTime(hz * 0.6, t + dur);
    const lg = ctx.createGain(); lg.gain.value = 0.45; lfo.connect(lg); lg.connect(chop.gain);
    const w = sv.shape(fl, 'hard'); n.connect(fl); w.connect(chop);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chop.connect(g); g.connect(bus);
    n.start(t); lfo.start(t); n.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02); count(t + dur + 0.02); count(t + dur + 0.02);
  };
  // ── the pre-blast, inside the game's 70 ms wind-up (cut by the blast) ──
  const preblast = (t) => {
    if (HC) {
      pv.noise(t, { f: 2600, q: 2.2, dur: 0.008, gain: 0.14, drive: 'hard' });                 // the breech locks
      pv.osc(t + 0.004, { type: 'square', f: 240, f2: 180, dur: 0.012, gain: 0.08, lp: 900 });
      pv.noise(t + 0.01, { f: 380, type: 'lowpass', q: 0.8, a: 0.055, dur: 0.01, gain: 0.07 });  // a short inhale
    } else {
      pv.noise(t, { f: 500, f2: 2400, q: 3, a: 0.062, dur: 0.01, gain: 0.1, drive: 'soft' });   // pressure building
      pv.osc(t, { type: 'sine', f: 70, f2: 118, a: 0.062, dur: 0.01, gain: 0.14, drive: 'soft' });
      crackle(preBus, t + 0.02, { f: 3600, q: 1.2, dur: 0.05, gain: 0.05 });
    }
  };
  // ── the blast ──
  const blast = (t) => {
    st.blasts++;
    if (HC) {
      // ATTACK: the crack, broadband and instant
      sv.noise(t, { f: 4200, type: 'highpass', q: 0.7, dur: 0.006, gain: 0.5, drive: 'hard' });
      sv.noise(t, { f: 1900, q: 0.8, dur: 0.018, gain: 0.48, drive: 'brutal' });
      sv.osc(t, { type: 'square', f: 1400, f2: 900, dur: 0.003, gain: 0.22 });
      sv.noise(t + 0.002, { f: 3500, q: 0.6, dur: 0.035, gain: 0.3, drive: 'hard' });          // the KRA grain
      // BODY: a driven thump (its harmonics carry 150-600 Hz) and a roaring low-mid burst
      sv.osc(t, { type: 'sine', f: 210, f2: 88, dur: 0.09, gain: 0.75, drive: 'brutal' });
      sv.osc(t, { type: 'triangle', f: 132, f2: 80, dur: 0.18, gain: 0.3, lp: 1100, drive: 'hard' });
      sv.osc(t, { type: 'sine', f: 72, f2: 56, dur: 0.12, gain: 0.16 });                      // a little real low end
      sv.noise(t, { f: 1250, f2: 200, type: 'lowpass', q: 1.1, dur: 0.42, gain: 0.66, drive: 'brutal' }); // the THOOOM roar
      sv.noise(t + 0.01, { f: 170, q: 2.5, dur: 0.4, gain: 0.3, drive: 'hard' });
      sv.noise(t, { f: 520, q: 0.9, dur: 0.14, gain: 0.42, drive: 'hard' });
      sv.noise(t, { f: 300, q: 1.2, dur: 0.18, gain: 0.3, drive: 'hard' });
      // PRESSURE: the reactor dumping (a driven band falling fast)
      sv.noise(t + 0.004, { f: 2200, f2: 420, q: 1.4, dur: 0.09, gain: 0.18, drive: 'hard' });
      // TAIL: a compact, gritty rattle and a few sparks, clear by ~0.4 s
      st.tails++; open(tailBus, t);
      rattle(tailBus, t + 0.05, { f: 760, f2: 170, hz: 38, dur: 0.34, gain: 0.24 });
      let u = t + 0.06;
      for (let i = 0; i < 5 && u < t + 0.32; i++) { tv.noise(u, { f: 2400 + 1800 * rnd(), q: 3.5, dur: 0.01, gain: 0.08 * (1 - i / 6), drive: 'hard' }); u += 0.035 + 0.05 * rnd(); }
      tv.noise(t + 0.05, { f: 1150, q: 6, dur: 0.06, gain: 0.06 });
      tv.noise(t + 0.05, { f: 1720, q: 6, dur: 0.05, gain: 0.045 });
    } else {
      // DETONATION: as hard as HC's crack, a lower, shorter thump
      sv.noise(t, { f: 2600, q: 0.7, dur: 0.012, gain: 0.55, drive: 'brutal' });
      sv.noise(t, { f: 5200, type: 'highpass', q: 0.7, dur: 0.005, gain: 0.32, drive: 'hard' });
      sv.osc(t, { type: 'square', f: 900, f2: 320, dur: 0.012, gain: 0.2 });
      sv.osc(t, { type: 'sine', f: 190, f2: 92, dur: 0.08, gain: 0.75, drive: 'brutal' });
      sv.noise(t, { f: 1200, f2: 280, type: 'lowpass', q: 1.0, dur: 0.16, gain: 0.66, drive: 'brutal' });   // the initial blast leads
      sv.noise(t, { f: 420, q: 0.9, dur: 0.1, gain: 0.4, drive: 'hard' });
      // IMPLOSION: the pressure collapses inward (a swell rising in level and pitch, cut dead)...
      sv.noise(t + 0.07, { f: 300, f2: 2600, q: 1.3, a: 0.15, dur: 0.012, gain: 0.3, drive: 'hard' });
      sv.osc(t + 0.07, { type: 'sine', f: 90, f2: 240, a: 0.15, dur: 0.01, gain: 0.26, drive: 'hard' });
      // ...and lands on a second, collapsing thump
      const c = t + 0.232;
      sv.noise(c, { f: 3200, q: 0.8, dur: 0.008, gain: 0.34, drive: 'hard' });
      sv.osc(c, { type: 'sine', f: 230, f2: 86, dur: 0.12, gain: 0.42, drive: 'brutal' });                  // the collapse follows, ~2-3 dB under
      sv.osc(c, { type: 'sine', f: 80, f2: 60, dur: 0.15, gain: 0.14 });
      sv.noise(c, { f: 1300, f2: 260, type: 'lowpass', q: 1.1, dur: 0.3, gain: 0.32, drive: 'brutal' });
      sv.noise(c, { f: 460, q: 0.9, dur: 0.16, gain: 0.2, drive: 'hard' });
      // FRACTURE: a coarse electrical crackle under all of it
      crackle(blastBus, t + 0.008, { f: 3000, q: 0.9, dur: 0.62, gain: 0.3 });
      crackle(blastBus, t + 0.008, { f: 760, q: 1.1, dur: 0.4, gain: 0.2, drive: 'brutal' });
      // DECAY: longer, controlled: a low rumble and the crackle thinning out (~0.8 s)
      st.tails++; open(tailBus, t);
      tv.noise(c + 0.03, { f: 720, f2: 200, type: 'lowpass', q: 0.9, a: 0.03, dur: 0.6, gain: 0.2, drive: 'soft' });
      crackle(tailBus, c + 0.1, { f: 2200, q: 1.4, dur: 0.5, gain: 0.12 });
      let u = c + 0.05;
      for (let i = 0; i < 6 && u < t + 0.85; i++) { tv.noise(u, { f: 1800 + 2600 * rnd(), q: 4, dur: 0.012, gain: 0.085 * (1 - i / 7), drive: 'hard' }); u += 0.05 + 0.08 * rnd() * (1 + i * 0.3); }
    }
    // the five projectiles: supporting, far below the blast
    for (let i = 0; i < S.zips; i++) {
      const z = t + 0.014 + i * S.zipGapS;
      if (HC) sv.noise(z, { f: 1500 - i * 60, f2: 520, type: 'lowpass', q: 1.2, dur: 0.05, gain: 0.032 });
      else sv.noise(z, { f: 3000 - i * 120, f2: 900, q: 3, dur: 0.05, gain: 0.03 });
      st.zips++;
    }
  };
  const impact = (t, k, w) => {
    if (HC) {
      sv.osc(t, { type: 'sine', f: 150, f2: 72, dur: 0.07, gain: 0.22 * w, drive: 'hard' });
      sv.noise(t, { f: 820, f2: 240, type: 'lowpass', q: 1.0, dur: 0.07, gain: 0.18 * w, drive: 'soft' });
    } else {
      sv.osc(t, { type: 'sine', f: 170, f2: 76, dur: 0.07, gain: 0.2 * w, drive: 'hard' });
      sv.noise(t, { f: 700, f2: 260, type: 'lowpass', q: 1.0, dur: 0.06, gain: 0.16 * w, drive: 'soft' });
      crackle(blastBus, t, { f: 2600, q: 1.6, dur: 0.05, gain: 0.1 * w });
    }
  };
  return {
    ...base,
    windup(t) { st.windups++; base.windupBed(t); open(preBus, t); preOn = true; preblast(t); },
    release(t) {
      st.releases++;
      base.releaseBed(t);
      if (preOn) { cut(preBus, t); preOn = false; st.cuts++; }
      relT = t; impN = 0; lastImpT = -1; lastHitCall = -1;
      blast(t);
    },
    /** createB2Audio schedules the kit's cooldown 0.32 s after the release: HC's breech action
     *  (two quiet mechanical steps); RD's decay is already running. B2's falling-saw cooldown is
     *  not played. */
    cooldown(t) {
      if (!HC) return;
      st.breech++;
      tv.noise(t, { f: 2800, q: 1.6, dur: 0.007, gain: 0.1, drive: 'hard' });
      tv.osc(t + 0.003, { type: 'square', f: 300, f2: 220, dur: 0.01, gain: 0.05, lp: 1200 });
      tv.noise(t + 0.11, { f: 2100, q: 1.8, dur: 0.008, gain: 0.09, drive: 'hard' });
      tv.osc(t + 0.113, { type: 'square', f: 230, f2: 170, dur: 0.012, gain: 0.05, lp: 900 });
    },
    /** One Super pellet hit an enemy: same-tick hits merge, the rest queue 50 ms apart, at most three. */
    superHit(t) {
      if (relT < 0 || t - relT > S.windowS) relT = t;
      if (lastHitCall >= 0 && Math.abs(t - lastHitCall) < 0.008) { st.merged++; return; }
      lastHitCall = t;
      if (impN >= S.impactMax) { st.capped++; return; }
      const at = Math.max(t, lastImpT < 0 ? t : lastImpT + S.impactGapS);
      if (at - t > S.impactLagS) { st.late++; return; }
      impact(at, impN, impN === 0 ? 1 : 0.5 - 0.1 * impN);   // the first lands with the blast; the rest stay well under it
      if (lastImpT >= 0) st.minGap = Math.min(st.minGap, +(at - lastImpT).toFixed(4));
      st.maxLag = Math.max(st.maxLag, +(at - t).toFixed(4));
      lastImpT = at; impN++; st.impacts++;
    },
    silence(t) {
      base.silence(t);
      if (preOn) { cut(preBus, t); preOn = false; st.cuts++; }
      cut(tailBus, t);
    },
    /** The hero died: the pre-blast and the tail stop with it. */
    cutSuper(t) { if (preOn) { cut(preBus, t); preOn = false; } cut(tailBus, t); st.deathCuts++; },
    destroy() { base.destroy(); for (const g of [preBus, tailBus, blastBus, conv, wetLp, wet]) { try { g.disconnect(); } catch (_) { /* */ } } },
  };
}

/** Same interface as `createB2Voice`, plus the R2 events. `kind`: 'A' | 'B'.
 *  `opts` { ctx, dest, now }: render into another context (an OfflineAudioContext replaying a
 *  recorded event timeline, for the A/B demonstrations); `now()` is that timeline's clock. */
export function createB2Audio(kind, opts = {}) {
  let ctx = null, kit = null, bus = null, superBus = null, motorUntil = 0, lastTick = -1, lastDuck = -1, ambT = 0;
  const R5 = kind === 'B2HC' || kind === 'B2RD';        // B2-R5: B2 with a new Super discharge
  const B2FAM = kind === 'B2' || kind === 'B2S' || R5;   // the approved B2 behaviour: trim, confirmation, cuts
  const stats = { kind, shots: 0, ticks: 0, ducks: 0, live: false, events: {}, peakVoices: 0, dropped: 0 };
  const ev = (k) => { stats.events[k] = (stats.events[k] || 0) + 1; };
  const ready = () => {
    if (!kit) {
      const d = opts.ctx ? { ctx: opts.ctx, sfxGain: opts.dest } : __fxDebug();
      if (!d.ctx || !d.sfxGain) return false;
      ctx = d.ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.12;
      bus = ctx.createGain(); bus.gain.value = 0.9 * (B2FAM ? B2_TRIM : 1);
      bus.connect(comp); comp.connect(d.sfxGain);
      if (kind === 'B2S') {
        // the Super's own bus and compressor, parallel to the kit's
        const comp2 = ctx.createDynamicsCompressor();
        comp2.threshold.value = -14; comp2.knee.value = 8; comp2.ratio.value = 5; comp2.attack.value = 0.002; comp2.release.value = 0.12;
        superBus = ctx.createGain(); superBus.gain.value = 0.9 * B2S_TRIM;
        superBus.connect(comp2); comp2.connect(d.sfxGain);
      } else if (R5) {
        // the R5 Super's own bus and a harder, faster compressor (its pumping is part of the blast)
        const comp3 = ctx.createDynamicsCompressor();
        comp3.threshold.value = -16; comp3.knee.value = 4; comp3.ratio.value = 8; comp3.attack.value = 0.0015; comp3.release.value = 0.09;
        superBus = ctx.createGain(); superBus.gain.value = 0.9 * R5_TRIM[kind];
        superBus.connect(comp3); comp3.connect(d.sfxGain);
      }
      kit = kind === 'A' ? kitA(ctx, bus, stats, now) : kind === 'B2' ? kitB2(ctx, bus, stats, now) : kind === 'B2S' ? kitB2S(ctx, bus, stats, now, superBus) : R5 ? kitR5(ctx, bus, stats, now, superBus, kind === 'B2HC' ? 'HC' : 'RD') : kitB(ctx, bus, stats, now);
    }
    stats.live = opts.now ? true : ctx.state === 'running';
    return stats.live;
  };
  const now = () => (opts.now ? opts.now() : ctx.currentTime);
  const at = (late = 0) => Math.max(now(), now() + LOOK - late / 1000);
  let press = 0, lastShotT = -1, lastStage = 0, firing = false;
  // B2: "the Super can be released" — full, not suppressed, alive; seeded from the first frame
  let avail = null, wasDead = false, wasSup = false, lastConfirm = -1e9;
  const CONFIRM_GAP = 500;            // ms of game time: a meter that touches full twice in a breath confirms once
  stats.confirms = 0; stats.cuts = 0;
  return {
    stats, kind,
    shot(o) {
      ev('shot');
      if (!ready()) return;
      const t = at(o.late);
      press = t - lastShotT < 0.16 ? press + 1 : 0; lastShotT = t;
      stats.shots++; kit.shot(t, { heat: o.heat, n: o.n, hot: o.hot, sustained: press >= 2 });
    },
    tail(heat) { ev('tail'); if (ready()) kit.tail(at(), heat); },
    reloadStart(dur) { ev('reload'); if (ready()) { kit.reloadStart(at(), dur / 1000); motorUntil = now() + dur / 1000; } },
    reloadCancel() { /* the motor is short and quiet; it is left to finish */ },
    reloadEnd() { ev('reloaded'); if (ready()) kit.reloadEnd(at()); },
    hitTick(heat) { ev('impact'); if (!ready() || now() - lastTick < 0.05) return; lastTick = now(); stats.ticks++; kit.impact(at(), heat); },
    killTick() { ev('kill'); if (ready()) kit.kill(at()); },
    primed() { ev('primed'); if (ready()) kit.primed(at()); },
    lockTick(k) { ev('lock'); if (ready()) kit.lock(at(), k); },
    duck() { if (!ready() || now() - lastDuck < 0.18) return; lastDuck = now(); stats.ducks++; if (!opts.ctx) duckMusic(0.32, 340); },
    // R2 events
    windup() { ev('windup'); if (!ready()) return; const t = at(); if (kit.cutConfirm) { kit.cutConfirm(t); stats.cuts++; } kit.holdBed?.(t, t + 0.7); kit.windup(t); },
    release() {
      ev('release'); if (!ready()) return; const t = at(); kit.release(t); kit.cooldown(t + 0.32);
      // R5: a deeper, shorter music dip and a brief dip of the other game sounds (the B2 kit and the
      // Super bus feed sfxGain directly, so neither is ducked); B2 / B2S keep their 0.45 / 500 ms
      if (!opts.ctx) { if (R5) { duckMusic(0.6, 380); duckSfx(0.35, 240); stats.sfxDucks = (stats.sfxDucks || 0) + 1; } else duckMusic(0.45, 500); }
    },
    superHit() {
      ev('superHit');
      if (!ready()) return;
      if (kind === 'B2S' || R5) { kit.superHit(at()); return; }   // B2S / R5 merge, space and cap their own impacts
      if (now() - lastTick < 0.03) return; lastTick = now(); kit.superHit(at());
    },
    /** The scene paused (or the hero died): the beds go silent until the next update. */
    silence() { ev('silence'); if (ready()) { kit.silence?.(now()); if (kit.cutConfirm) { kit.cutConfirm(now()); stats.cuts++; } } },
    /** Per frame from the flagship: charge 0..1, the trigger, the meter full, suppressed. */
    update(dt, s) {
      ambT += dt;
      firing = !!s.firing;
      const k = s.heat >= 1 ? 4 : Math.floor(s.heat * 4);
      if (k > lastStage && k < 4) ev('stage');
      const dead = s.dead ?? false, sup = s.sup ?? false;
      const av = s.heat >= 1 && !dead && !sup;
      const rose = avail !== null && av && !avail && ambT - lastConfirm >= CONFIRM_GAP;
      if (rose) lastConfirm = ambT;
      const wasDeadPrev = wasDead;
      const cut = B2FAM && ((dead && !wasDead) || (sup && !wasSup));
      avail = av; wasDead = dead; wasSup = sup;
      if (B2FAM && rose) ev('confirm');
      if (!ready()) { lastStage = k; return; }
      if (k > lastStage && k < 4) kit.stage(at(), k);
      lastStage = k;
      if (B2FAM) {
        if (dead && !wasDeadPrev) kit.cutSuper?.(now());
        if (cut) { kit.cutConfirm(now()); stats.cuts++; }
        if (rose) { kit.confirm(at()); stats.confirms++; }
      }
      kit.bed?.(now(), { heat: s.heat, firing, ready: s.heat >= 1, suppressed: s.suppressed, dead, sup });
    },
    destroy() { try { kit?.destroy?.(); } catch (_) { /* */ } try { bus?.disconnect(); } catch (_) { /* */ } kit = null; void motorUntil; },
  };
}
