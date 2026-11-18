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
import { __fxDebug, duckMusic } from './FX.js';
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
function voices(ctx, dest, stats, now = () => ctx.currentTime) {
  const nb = noiseBuffer(ctx, 0xb2a0b2a0);
  const drv = { soft: driveCurve(2.5), hard: driveCurve(9) };
  // live voices are counted by their scheduled end times (onended does not fire while an
  // OfflineAudioContext is being scheduled), so the cap holds live and offline
  const ends = [];
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
    room, get live() { prune(); return ends.length + live; },
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
  const base = (f) => { o1.frequency.value = f; o2.frequency.value = f * 1.5; o3.frequency.value = f / 2; o2.detune.value = 7; };
  base(110);
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
      base(110 + 50 * heat);
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

/** Same interface as `createB2Voice`, plus the R2 events. `kind`: 'A' | 'B'.
 *  `opts` { ctx, dest, now }: render into another context (an OfflineAudioContext replaying a
 *  recorded event timeline, for the A/B demonstrations); `now()` is that timeline's clock. */
export function createB2Audio(kind, opts = {}) {
  let ctx = null, kit = null, bus = null, motorUntil = 0, lastTick = -1, lastDuck = -1, ambT = 0;
  const stats = { kind, shots: 0, ticks: 0, ducks: 0, live: false, events: {}, peakVoices: 0, dropped: 0 };
  const ev = (k) => { stats.events[k] = (stats.events[k] || 0) + 1; };
  const ready = () => {
    if (!kit) {
      const d = opts.ctx ? { ctx: opts.ctx, sfxGain: opts.dest } : __fxDebug();
      if (!d.ctx || !d.sfxGain) return false;
      ctx = d.ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.12;
      bus = ctx.createGain(); bus.gain.value = 0.9;
      bus.connect(comp); comp.connect(d.sfxGain);
      kit = kind === 'A' ? kitA(ctx, bus, stats, now) : kitB(ctx, bus, stats, now);
    }
    stats.live = opts.now ? true : ctx.state === 'running';
    return stats.live;
  };
  const now = () => (opts.now ? opts.now() : ctx.currentTime);
  const at = (late = 0) => Math.max(now(), now() + LOOK - late / 1000);
  let press = 0, lastShotT = -1, lastStage = 0, firing = false;
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
    windup() { ev('windup'); if (!ready()) return; const t = at(); kit.holdBed?.(t, t + 0.7); kit.windup(t); },
    release() { ev('release'); if (!ready()) return; const t = at(); kit.release(t); kit.cooldown(t + 0.32); if (!opts.ctx) duckMusic(0.45, 500); },
    superHit() { ev('superHit'); if (!ready() || now() - lastTick < 0.03) return; lastTick = now(); kit.superHit(at()); },
    /** The scene paused (or the hero died): the beds go silent until the next update. */
    silence() { ev('silence'); if (ready()) kit.silence?.(now()); },
    /** Per frame from the flagship: charge 0..1, the trigger, the meter full, suppressed. */
    update(dt, s) {
      ambT += dt;
      firing = !!s.firing;
      const k = s.heat >= 1 ? 4 : Math.floor(s.heat * 4);
      if (k > lastStage && k < 4) ev('stage');
      if (!ready()) { lastStage = k; return; }
      if (k > lastStage && k < 4) kit.stage(at(), k);
      lastStage = k;
      kit.bed?.(now(), { heat: s.heat, firing, ready: s.heat >= 1, suppressed: s.suppressed });
    },
    destroy() { try { kit?.destroy?.(); } catch (_) { /* */ } try { bus?.disconnect(); } catch (_) { /* */ } kit = null; void motorUntil; },
  };
}
