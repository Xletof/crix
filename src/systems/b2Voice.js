// B2-1 — THE WEAPON VOICE KIT (opt-in with `?b2=`; see systems/b2Flagship.js).
//
// WHY A KIT. The shipped `SFX.shoot` is one 50ms falling chirp (1.4kHz ->
// 0.5kHz) that sits on the music's upper partials; measured on a recorded
// run, 88% of the mix was below 1kHz and ~3% above 2kHz. A handset speaker has
// almost nothing below ~400Hz. So a shot here is THREE parts in three bands:
//
//   CRACK  noise in a band round 3.3kHz, 30ms  — the transient a phone carries
//   BITE   a falling saw around 0.3-1kHz, 60ms — the weapon's pitch
//   BODY   a sine dropping 180 -> 80Hz         — weight, for anything with bass
//
// and one more that makes the gun the meter:
//
//   ZING   a short triangle partial at 2.3-3kHz whose level and pitch RISE
//          with the Super charge. The stream gets brighter and higher as it
//          earns the Super; nothing else needs to beep.
//
// DETERMINISM. Nothing here calls `Math.random` (the shipped `tone` / `noise`
// do, whenever audio is live): variation is a fixed four-step rotation and a
// noise buffer filled once from a private mulberry32 stream.
//
// `b2VoiceKit(ctx, dest)` only SCHEDULES at absolute times, so the same code
// renders offline (tests/smoke-b2.mjs measures its spectrum) and live.
import { __fxDebug, duckMusic } from './FX.js';
import { mulberry32 } from './rng.js';

const PITCH = [1, 1.035, 0.972, 1.018];
const noiseOf = new WeakMap();
function noiseBuffer(ctx) {
  let b = noiseOf.get(ctx);
  if (b) return b;
  const n = Math.floor(ctx.sampleRate * 0.3);
  b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0), r = mulberry32(0xb2b20001);
  for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
  noiseOf.set(ctx, b);
  return b;
}

export function b2VoiceKit(ctx, dest) {
  const buf = noiseBuffer(ctx);
  const env = (g, t, peak, attack, dur) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  };
  const noise = (t, { hp, dur, gain, type = 'highpass', q = 0.7, to = 0, off = 0 }) => {
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(hp, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain(); env(g, t, gain, 0.001, dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, off % 0.2, dur + 0.01);
    return src;
  };
  const tone = (t, { type, f0, f1, dur, gain, attack = 0.002, lp = 0 }) => {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); env(g, t, gain, attack, dur);
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); f.connect(g); } else o.connect(g);
    g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
    return o;
  };
  return {
    /** One round. `heat` 0..1 is the Super charge. */
    shot(t, { heat = 0, accent = false, hot = false, n = 0 } = {}) {
      const pv = PITCH[n & 3] * (hot ? 1.07 : 1) * (accent ? 1.05 : 1);
      noise(t, { type: 'bandpass', q: 0.9, hp: 3300 + 700 * heat, dur: 0.03, gain: accent ? 0.50 : 0.40, off: n * 0.037 });
      tone(t, { type: 'sawtooth', f0: 820 * pv * (1 + 0.32 * heat), f1: 340 * pv * (1 + 0.2 * heat), dur: 0.064, gain: 0.21, lp: 3600 });
      tone(t, { type: 'triangle', f0: 2300 * pv * (1 + 0.3 * heat), f1: 1850 * pv * (1 + 0.3 * heat), dur: 0.036, gain: 0.03 + 0.1 * heat + (hot ? 0.03 : 0), attack: 0.001 });
      tone(t, { type: 'sine', f0: 180, f1: 82, dur: 0.07, gain: 0.105 });
    },
    /** The trigger let go after a stream: the weapon settles. */
    tail(t, heat = 0) {
      noise(t, { type: 'bandpass', hp: 2600 + 600 * heat, to: 700, dur: 0.17, gain: 0.07, q: 1.2 });
      tone(t, { type: 'sine', f0: 240, f1: 105, dur: 0.1, gain: 0.07 });
    },
    /** Magazine out. Returns a handle so a cancelled top-up can be silenced. */
    reloadStart(t, dur, quiet = false) {
      const k = quiet ? 0.55 : 1;
      noise(t, { hp: 2000, dur: 0.02, gain: 0.13 * k });
      tone(t, { type: 'square', f0: 480, f1: 250, dur: 0.045, gain: 0.06 * k, lp: 2400 });
      // the feed motor: rises for the whole reload, so its pitch says how long is left
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(150, t + 0.03);
      o.frequency.linearRampToValueAtTime(390, t + dur);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + 0.03);
      g.gain.linearRampToValueAtTime(0.03 * k, t + 0.12);
      g.gain.setValueAtTime(0.03 * k, Math.max(t + 0.13, t + dur - 0.03));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(dest);
      o.start(t + 0.03); o.stop(t + dur + 0.02);
      return { stop: (at) => { try { g.gain.cancelScheduledValues(at); g.gain.setValueAtTime(0.0001, at); o.stop(at + 0.01); } catch (_) { /* */ } } };
    },
    /** Magazine in: two clicks and a RISING note (in this game a rise means loaded). */
    reloadEnd(t, instant = false) {
      if (instant) {
        noise(t, { hp: 3000, dur: 0.022, gain: 0.17 });
        tone(t, { type: 'triangle', f0: 1100, f1: 1900, dur: 0.07, gain: 0.09 });
        return;
      }
      noise(t, { hp: 2600, dur: 0.015, gain: 0.14 });
      noise(t + 0.055, { hp: 1800, dur: 0.022, gain: 0.16 });
      tone(t + 0.055, { type: 'triangle', f0: 880, f1: 1320, dur: 0.055, gain: 0.08 });
    },
    /** A round landing on a body: a tick above everything else in the mix. */
    hitTick(t, heat = 0) { noise(t, { hp: 3800, dur: 0.011, gain: 0.05 + 0.02 * heat }); },
    /** A kill by the rifle. */
    killTick(t) {
      tone(t, { type: 'triangle', f0: 1250, f1: 1750, dur: 0.05, gain: 0.065 });
      noise(t, { hp: 3000, dur: 0.009, gain: 0.04 });
    },
    /** The weapon is primed: a high shimmer over the shipped ready chime. */
    primed(t) {
      tone(t, { type: 'sine', f0: 2640, f1: 2640, dur: 0.28, gain: 0.035, attack: 0.02 });
      tone(t + 0.04, { type: 'sine', f0: 3300, f1: 3300, dur: 0.26, gain: 0.028, attack: 0.02 });
    },
  };
}

// One gun bus per AudioContext, beside the SFX and melee buses and under the
// player's own SFX volume: `duckSfx` (the Broken Wings slam) does not dip it.
const busOf = new WeakMap();
const LOOKAHEAD = 0.02;   // s: each round is scheduled on its exact time, not on the frame

export function createB2Voice() {
  let ctx = null, kit = null, motor = null, lastDuck = -1, lastTick = -1;
  const stats = { shots: 0, ticks: 0, ducks: 0, live: false };
  const ready = () => {
    if (!kit) {
      const d = __fxDebug();
      if (!d.ctx || !d.sfxGain) return false;
      ctx = d.ctx;
      let bus = busOf.get(ctx);
      if (!bus) { bus = ctx.createGain(); bus.gain.value = 0.85; bus.connect(d.sfxGain); busOf.set(ctx, bus); }
      kit = b2VoiceKit(ctx, bus);
    }
    stats.live = ctx.state === 'running';
    return stats.live;
  };
  const at = (late = 0) => Math.max(ctx.currentTime, ctx.currentTime + LOOKAHEAD - late / 1000);
  return {
    stats,
    shot(o) { if (!ready()) return; stats.shots++; kit.shot(at(o.late), o); },
    tail(heat) { if (ready()) kit.tail(at(), heat); },
    reloadStart(dur, kind) { if (!ready()) return; motor?.stop(ctx.currentTime); motor = kit.reloadStart(at(), dur / 1000, kind === 'idle'); },
    reloadCancel() { if (ctx && motor) { motor.stop(ctx.currentTime); motor = null; } },
    reloadEnd(instant) { if (!ready()) return; if (instant) motor?.stop(ctx.currentTime); motor = null; kit.reloadEnd(at(), instant); },
    hitTick(heat) { if (!ready() || ctx.currentTime - lastTick < 0.055) return; lastTick = ctx.currentTime; stats.ticks++; kit.hitTick(at(), heat); },
    killTick() { if (ready()) kit.killTick(at()); },
    primed() { if (ready()) kit.primed(at()); },
    /** Hold the music a little under a running stream. */
    duck() {
      if (!ready() || ctx.currentTime - lastDuck < 0.18) return;
      lastDuck = ctx.currentTime; stats.ducks++;
      duckMusic(0.28, 340);
    },
    destroy() { try { motor?.stop(ctx?.currentTime || 0); } catch (_) { /* */ } motor = null; kit = null; },
  };
}
