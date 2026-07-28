// FX: visual juice (damage numbers, particles, screen shake) + procedural audio
// via Web Audio API. No external sound assets needed for the vertical slice.

import Phaser from 'phaser';
import { DEPTH } from '../config.js';

let audioCtx = null;
let masterGain = null;
let compressor = null;
let musicGain = null;
let sfxGain = null;
// Two buses under sfxGain. Everything used to share one node, which meant the
// melee competed head-on with kill feedback and lost — the slam's energy is
// deliberately low (where a phone speaker is weakest) while the kill chime sits
// at 523-1600Hz (where it is strongest). Splitting them lets the melee be
// boosted and everything else be ducked out from under it independently, while
// the user's SFX slider still lives on sfxGain above both.
let sfxBus = null;      // default route for every SFX; duckable
let meleeBus = null;    // Riven melee only; boosted, never ducked
let musicVol = 0.40;   // was 0.18 — music sat ~20dB under SFX and was inaudible
let sfxVol = 0.60;
let sfxDelay = null;   // shared feedback-delay send for SFX "tails" (combo chime)
let lowQuality = false;
let musicNodes = null;
let musicStarted = false;
let musicLoopTimer = null;  // pending setTimeout for the next bar (see startMusic)
let musicBarNodes = [];     // one-shot voices of the bar currently scheduled
let meleeHumNodes = null;   // sustained blade hum while a combo chain is live
let musicIntensity = 0;     // 0 = calm, 1 = full combat (see setMusicIntensity)
let intensityTargets = [];  // pad filters that open as intensity rises
let muted = false;
const MASTER_VOL = 0.5;
// Global camera-shake multiplier — every shake routes through fx.shake(), so
// this one knob dials the whole game's shake up/down. Trimmed to calm the
// "too much shake" feel while leaning harder on particles/flash for juice.
const SHAKE_SCALE = 0.6;

// Global mute toggle (driven by the pause menu). The `muted` flag lives at
// module scope so it survives scene restarts; initAudio honours it on create.
export function setMuted(m) {
  muted = !!m;
  if (masterGain) masterGain.gain.value = muted ? 0 : MASTER_VOL;
}
export function isMuted() { return muted; }

export function initAudio() {
  // Lazy-create on first user gesture (browsers require it).
  const create = () => {
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : MASTER_VOL;

    // Master compressor/limiter — glues the mix and clip-protects it once a
    // horde of overlapping SFX stacks up (was raw gain -> destination before).
    compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value      = 20;
    compressor.ratio.value     = 12;
    compressor.attack.value    = 0.003;
    compressor.release.value   = 0.25;
    masterGain.connect(compressor);
    compressor.connect(audioCtx.destination);

    musicGain = audioCtx.createGain();
    musicGain.gain.value = musicVol;
    musicGain.connect(masterGain);
    
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = sfxVol;
    sfxGain.connect(masterGain);

    // General SFX. duckSfx() dips THIS, not sfxGain, so a duck can never stomp
    // on the volume the player set (the bug duckMusic's comment describes).
    sfxBus = audioCtx.createGain();
    sfxBus.gain.value = 1;
    sfxBus.connect(sfxGain);

    // Melee bus. Sits ~4dB hot and is exempt from ducking, so the Riven combo
    // reads as the loudest thing on screen when it lands. The boost alone is not
    // enough — the master compressor (threshold -10, ratio 12) eats a chunk of
    // it — which is why duckSfx() clearing the other bus matters just as much.
    meleeBus = audioCtx.createGain();
    meleeBus.gain.value = 1.6;
    meleeBus.connect(sfxGain);

    // Feedback-delay send: SFX can opt in (tone({echo})) to get a short
    // repeating tail — used by the combo chime so a kill-streak note rings out
    // instead of blipping dry. Wet path only; dry still goes straight to sfxBus.
    // Deliberately NOT reachable from meleeBus: the melee has no echo send and
    // must not acquire one, since a ringing tail is the exact defect that was
    // just designed out of it.
    sfxDelay = audioCtx.createDelay(0.6);
    sfxDelay.delayTime.value = 0.16;
    const fb = audioCtx.createGain();
    fb.gain.value = 0.32;
    sfxDelay.connect(fb);
    fb.connect(sfxDelay);
    sfxDelay.connect(sfxBus);
  };
  ['pointerdown', 'touchstart', 'keydown'].forEach((evt) =>
    window.addEventListener(evt, create, { once: true })
  );
}

function ensureCtx() {
  if (!audioCtx) return null;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// `bus` picks the destination sub-bus; omitted means the general (duckable) one,
// so no existing call site changes behaviour. The melee voices pass meleeBus.
function tone({ freq = 440, type = 'sine', dur = 0.12, gain = 0.4, slide = 0, delay = 0, vary = 0, echo = 0, bus = null }) {
  const ctx = ensureCtx();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  // Per-call pitch variation (±vary fraction) so repeated calls (rapid-fire
  // shoot/hit) don't sound like a perfectly looping machine-gun sample.
  const f = vary ? freq * (1 + (Math.random() * 2 - 1) * vary) : freq;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(bus || sfxBus || masterGain);
  // Optional wet send into the shared feedback delay for a ringing tail.
  if (echo && sfxDelay) {
    const s = ctx.createGain();
    s.gain.value = echo;
    g.connect(s);
    s.connect(sfxDelay);
  }
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// Filtered noise burst.
//
// `type`/`q`/`sweepTo` were added for the melee: a static highpass is the only
// shape this had, which is why every noise layer in the game came out as the
// same flat "psst". A bandpass swept upward is what turns a hiss into a blade
// cutting air; a lowpass swept downward is what turns it into rubble settling.
// `attack` lets a layer swell in instead of clicking on, and `echo` gives noise
// the same delay send tone() already had.
function noise({
  dur = 0.15, gain = 0.3, hp = 600, delay = 0,
  type = 'highpass', q = 0, qTo = 0, sweepTo = 0, attack = 0, echo = 0,
  drive = 0, sustain = 0, bus = null,
}) {
  const ctx = ensureCtx();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(Math.max(20, hp), t);
  if (sweepTo) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
  }
  if (q) filter.Q.value = q;
  // Resonance envelope. Sweeping cutoff alone still reads as a static texture
  // being panned; Q moving alongside it is what makes noise sound like a
  // physical event — a resonance that rings up and damps away.
  if (qTo) {
    filter.Q.setValueAtTime(q || 0.0001, t);
    filter.Q.linearRampToValueAtTime(qTo, t + dur);
  }
  const g = ctx.createGain();
  if (attack > 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
  } else {
    g.gain.setValueAtTime(gain, t);
  }
  // Optional sustain shelf before the release, so a noise layer can hold as a
  // body instead of decaying straight from its transient.
  if (sustain > 0) g.gain.setValueAtTime(gain, t + Math.min(sustain, dur * 0.8));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  const ws = drive ? shaper(drive) : null;
  const dest = bus || sfxBus || masterGain;
  if (ws) { g.connect(ws); ws.connect(dest); }
  else g.connect(dest);
  if (echo && sfxDelay) {
    const s = ctx.createGain();
    s.gain.value = echo;
    g.connect(s);
    s.connect(sfxDelay);
  }
  src.start(t);
}

// Sub-bass drop. Modelled on the music kick() below, but routed to sfxGain —
// the music one is on musicGain and cannot be borrowed for an SFX. This is what
// makes an impact land in the chest rather than in the ears; tone() bottoms out
// at 40Hz on its slide and has a 5ms linear attack that clicks at these depths.
function sub({ freq = 90, to = 32, dur = 0.5, gain = 0.3, delay = 0, bus = null }) {
  const ctx = ensureCtx();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(18, to), t + dur * 0.7);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(bus || sfxBus || masterGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// ── Synthesis engine ────────────────────────────────────────────────────────
// Everything above is one or two bare oscillators through a gain envelope,
// which is why the whole game sounded thin and "procedurally generated". These
// three helpers are the shared foundation for sounds that read as events.

// Cached waveshaper curves. Saturation adds harmonics, which is what turns a
// clean oscillator into something with grit — and, crucially for a phone
// speaker, moves energy UP into a band the speaker can actually reproduce.
// Curves are cached by drive: building a 2048-sample Float32Array on every hit
// would churn hard during a fight.
const shaperCurves = new Map();
function shaper(drive = 3) {
  const ctx = ensureCtx();
  if (!ctx) return null;
  const key = Math.round(drive * 10);
  if (!shaperCurves.has(key)) {
    const n = 2048;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * drive) / Math.tanh(drive);  // normalised soft clip
    }
    shaperCurves.set(key, curve);
  }
  const ws = ctx.createWaveShaper();
  ws.curve = shaperCurves.get(key);
  ws.oversample = '2x';
  return ws;
}

// Impact voice. Replaces sub() at every hit site.
//
// sub() put its entire weight at 30-95Hz, which a phone speaker physically
// cannot move — so on the target device the game's heaviest sounds had no
// bottom at all. This drops the same pitch but runs it through a waveshaper,
// generating harmonics at 2x/3x/4x the fundamental. Those land in the
// 150-500Hz band a small speaker does reproduce, and the ear reconstructs the
// missing fundamental from them. On headphones the real sub is still there.
function punch({ freq = 150, to = 45, dur = 0.5, gain = 0.3, drive = 4, delay = 0, bus = null }) {
  const ctx = ensureCtx();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(18, to), t + dur * 0.65);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const ws = shaper(drive);
  const dest = bus || sfxBus || masterGain;
  osc.connect(g);
  if (ws) {
    g.connect(ws);
    ws.connect(dest);
  } else {
    g.connect(dest);
  }
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// N detuned oscillators as a single voice. Thickness is the cheapest cure for
// a sound that reads as "one bare oscillator", and detuning beats adding more
// gain because it widens the sound without making it louder.
//
// Note the detunes here are a handful of CENTS. The music intensity bug was a
// reminder of the other end of that scale: two tones a semitone (100 cents)
// apart beat audibly and unpleasantly. A few cents reads as richness.
function stack({
  freq = 300, count = 3, detune = 8, type = 'sawtooth',
  dur = 0.2, gain = 0.12, slide = 0, delay = 0, drive = 0,
  filter = 0, filterTo = 0, q = 1, attack = 0.008, sustain = 0, bus = null,
}) {
  const ctx = ensureCtx();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  // Multi-stage envelope: an optional sustain shelf before the release, so a
  // sound can hold instead of blipping. A pure attack-decay is what made every
  // impact in this game sound like a short "bip".
  if (sustain > 0) g.gain.setValueAtTime(gain, t + Math.min(sustain, dur * 0.8));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  let head = g;
  if (filter) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = q;
    lp.frequency.setValueAtTime(filter, t);
    if (filterTo) lp.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), t + dur);
    g.connect(lp);
    head = lp;
  }
  const ws = drive ? shaper(drive) : null;
  if (ws) { head.connect(ws); head = ws; }
  head.connect(bus || sfxBus || masterGain);

  for (let i = 0; i < count; i++) {
    // Spread symmetrically around the centre frequency.
    const cents = count === 1 ? 0 : (i / (count - 1) - 0.5) * 2 * detune;
    const o = ctx.createOscillator();
    o.type = type;
    const f = freq * Math.pow(2, cents / 1200);
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
}

// ── Blade voice ─────────────────────────────────────────────────────────────
// A `ringMod` and a `formant` helper lived here. They were built to decompose
// an onomatopoeic brief ("ZZZUUUBB") into ring modulation for the buzz and
// formant filtering for the vowel — and the result was described, accurately,
// as "a weird metallic fart". Ring modulation is the standard way to make
// metallic inharmonic tones, and a narrow resonant formant band over a low
// buzzy waveform is a nasal honk. Both are deleted rather than left available
// to be reached for again: a lightsaber is a smooth HARMONIC hum, and the
// swing, the hit and the sustained combo hum are all built that way now.

// Doppler pitch arc: rise INTO the pass, fall out of it.
//
// This replaces the monotonic `slide` that every melee layer used. A Ben Burtt
// lightsaber swing is a hum Doppler-shifted by the blade approaching and then
// receding — an arc. A straight descent is a blaster bolt. That distinction is
// the single biggest difference between the two sounds.
function pitchArc(osc, base, peakMult, t, dur) {
  osc.frequency.setValueAtTime(base, t);
  osc.frequency.linearRampToValueAtTime(base * peakMult, t + dur * 0.38);
  osc.frequency.linearRampToValueAtTime(base * 0.82, t + dur);
}

// Sub-channel volume adjustments (bindable to sliders in the UI)
export function setSFXVolume(vol) {
  sfxVol = Math.max(0, Math.min(1, vol));
  if (sfxGain && audioCtx) {
    sfxGain.gain.setValueAtTime(sfxVol, audioCtx.currentTime);
  }
}
export function setMusicVolume(vol) {
  musicVol = Math.max(0, Math.min(1, vol));
  if (musicGain && audioCtx) {
    musicGain.gain.setValueAtTime(musicVol, audioCtx.currentTime);
  }
}
export function getSFXVolume() { return sfxVol; }
export function getMusicVolume() { return musicVol; }

export function setLowQuality(l) { lowQuality = !!l; }
export function isLowQuality() { return lowQuality; }

// Dev-only introspection hook for smoke tests — audio internals aren't
// otherwise observable from outside the module (closures, not a class).
export function __fxDebug() {
  return {
    hasAudioCtx: !!audioCtx,
    hasCompressor: !!compressor,
    compressorRatio: compressor ? compressor.ratio.value : null,
    musicVol,
    sfxVol,
    musicGainValue: musicGain ? musicGain.gain.value : null,
    musicIntensity,
    intensityTargetCount: intensityTargets.length,
    padCutoff: intensityTargets[0] ? intensityTargets[0].filter.frequency.value : null,
    hasSfxDelay: !!sfxDelay,
    // Live node handles, so a test can hang an AnalyserNode off the SFX bus and
    // measure what the synthesis actually produces. Asserting on the parameters
    // passed to tone()/noise() would only prove the call was typed as intended;
    // the melee slam has to be verified as real sub-bass in the output.
    ctx: audioCtx,
    sfxGain,
    masterGain,
    // The two sub-buses, so a test can measure the melee and everything else
    // separately — tapping sfxGain alone just sums them back together.
    sfxBus,
    meleeBus,
    sfxBusGain: sfxBus ? sfxBus.gain.value : null,
    meleeBusGain: meleeBus ? meleeBus.gain.value : null,
    // musicGain lets a test measure the bed in isolation — tapping masterGain
    // in a live arena just measures gunfire.
    musicGain,
    // Loop bookkeeping: exactly one bar of voices and at most one pending timer
    // should exist at any moment. A stop/start cycle that leaks either is what
    // stacks bars and brings the clipping back.
    musicStarted,
    musicBarVoices: musicBarNodes.length,
    hasMusicLoopTimer: musicLoopTimer !== null,
    meleeHumming: meleeHumNodes !== null,
  };
}

export const SFX = {
  // Mandalorian blaster — snappy high-pitched zap (Star Wars blaster feel)
  shoot() {
    tone({ freq: 1400, type: 'square', dur: 0.05, gain: 0.16, slide: -900, vary: 0.12 });
    tone({ freq: 700,  type: 'sine',   dur: 0.06, gain: 0.08, slide: -400, vary: 0.12 });
  },
  // Wrist-rocket barrage — deep whoosh + explosion rumble
  shootSuper() {
    tone({ freq: 180, type: 'sawtooth', dur: 0.28, gain: 0.24, slide: -80 });
    tone({ freq: 360, type: 'square',   dur: 0.18, gain: 0.18, slide: -200, delay: 0.02 });
    noise({ dur: 0.30, gain: 0.20, hp: 80 });
    // Second rumble for explosion feel
    tone({ freq: 90, type: 'sine', dur: 0.22, gain: 0.18, slide: -40, delay: 0.14 });
  },
  // Death Trooper green bolt — lower pitch, slightly different timbre
  enemyShoot() {
    tone({ freq: 900, type: 'square', dur: 0.06, gain: 0.11, slide: -600, vary: 0.12 });
    tone({ freq: 450, type: 'sine',   dur: 0.05, gain: 0.06, slide: -300, vary: 0.12 });
  },
  // Hit flash — crisp impact
  hit() {
    noise({ dur: 0.06, gain: 0.14, hp: 1400 });
    tone({ freq: 300, type: 'square', dur: 0.04, gain: 0.10, vary: 0.12 });
  },
  // Player hurt — lower, painful
  hurt() {
    tone({ freq: 220, type: 'sawtooth', dur: 0.22, gain: 0.24, slide: -100 });
    noise({ dur: 0.15, gain: 0.18, hp: 150 });
  },
  // Enemy die — trooper helmet clatter
  enemyDie() {
    tone({ freq: 500, type: 'square', dur: 0.12, gain: 0.14, slide: -350, vary: 0.12 });
    noise({ dur: 0.10, gain: 0.10, hp: 400 });
  },
  // Vader hit — heavy metallic thud
  bossHit() {
    noise({ dur: 0.22, gain: 0.30, hp: 120 });
    tone({ freq: 80, type: 'sine', dur: 0.22, gain: 0.24, slide: -30, vary: 0.12 });
    tone({ freq: 160, type: 'sawtooth', dur: 0.16, gain: 0.15, slide: -50, vary: 0.12 });
  },
  // Vader death — dramatic orchestral descent
  bossDie() {
    [220, 196, 165, 131].forEach((f, i) =>
      tone({ freq: f, type: 'sawtooth', dur: 0.5, gain: 0.26 - i * 0.04, delay: i * 0.18 })
    );
    noise({ dur: 0.8, gain: 0.24, hp: 50 });
    tone({ freq: 55, type: 'sine', dur: 1.2, gain: 0.22, slide: -20, delay: 0.4 });
  },
  // Vader breathing / roar — low rumble
  bossRoar() {
    tone({ freq: 80,  type: 'sawtooth', dur: 0.55, gain: 0.26, slide: -20 });
    tone({ freq: 120, type: 'sine',     dur: 0.45, gain: 0.15, slide: -30, delay: 0.1 });
    noise({ dur: 0.50, gain: 0.16, hp: 60 });
  },
  // Vader ground slam / charge impact
  bossSlam() {
    tone({ freq: 110, type: 'sawtooth', dur: 0.35, gain: 0.26, slide: -60 });
    noise({ dur: 0.40, gain: 0.22, hp: 50 });
  },
  // Lightsaber charge ready — ascending hum
  superReady() {
    tone({ freq: 400,  type: 'sine', dur: 0.15, gain: 0.16, slide: 200 });
    tone({ freq: 600,  type: 'sine', dur: 0.15, gain: 0.14, slide: 200, delay: 0.12 });
    tone({ freq: 900,  type: 'sine', dur: 0.20, gain: 0.14, slide: 300, delay: 0.22 });
    tone({ freq: 1200, type: 'sine', dur: 0.18, gain: 0.12, slide: 200, delay: 0.34 });
  },
  // Super charge tick — a short blip whose pitch rises as the meter fills,
  // so spamming normal shots audibly "charges" toward the super.
  superTick(ratio = 0) {
    const r = Math.max(0, Math.min(1, ratio));
    tone({ freq: 460 + r * 760, type: 'square', dur: 0.045, gain: 0.07 });
  },
  // Halfway milestone — two quick rising triangle notes.
  superHalf() {
    tone({ freq: 700,  type: 'triangle', dur: 0.09, gain: 0.13 });
    tone({ freq: 1040, type: 'triangle', dur: 0.11, gain: 0.12, delay: 0.07 });
  },
  // Super pellet slamming the boss — heavier, brighter than a normal boss hit.
  superBossHit() {
    noise({ dur: 0.18, gain: 0.28, hp: 200 });
    tone({ freq: 140, type: 'sawtooth', dur: 0.22, gain: 0.24, slide: -60 });
    tone({ freq: 520, type: 'square',   dur: 0.12, gain: 0.16, slide: -200 });
  },
  // Bacta pickup — soft chime
  heal() {
    tone({ freq: 880,  type: 'triangle', dur: 0.10, gain: 0.14 });
    tone({ freq: 1100, type: 'triangle', dur: 0.14, gain: 0.12, delay: 0.07 });
    tone({ freq: 1320, type: 'triangle', dur: 0.12, gain: 0.11, delay: 0.14 });
  },
  // Imperial UI click
  uiClick() {
    tone({ freq: 800, type: 'square', dur: 0.04, gain: 0.12 });
  },
  // Victory fanfare — 4-note ascending
  victory() {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone({ freq: f, type: 'triangle', dur: 0.20, gain: 0.24, delay: i * 0.13 })
    );
  },
  // Defeat — descending
  defeat() {
    [392, 330, 262, 196].forEach((f, i) =>
      tone({ freq: f, type: 'sawtooth', dur: 0.24, gain: 0.24, delay: i * 0.15 })
    );
  },
  waveStart() {
    tone({ freq: 440, type: 'square', dur: 0.08, gain: 0.18 });
    tone({ freq: 660, type: 'square', dur: 0.12, gain: 0.18, delay: 0.1 });
  },
  // Room cleared — a short triumphant rising triad over a low boom, so
  // finishing a whole room lands as its own beat (not just a bigger kill pop).
  roomClear() {
    [523, 784, 1046].forEach((f, i) =>
      tone({ freq: f, type: 'triangle', dur: 0.16, gain: 0.20, delay: i * 0.08, echo: 0.22 })
    );
    tone({ freq: 130, type: 'sine', dur: 0.32, gain: 0.18, slide: -30 });
  },
  // Stealth takedown — a quick blade shink + muffled thud (no alarm)
  takedown() {
    noise({ dur: 0.05, gain: 0.16, hp: 2600 });        // blade shink
    tone({ freq: 1800, type: 'sine', dur: 0.04, gain: 0.08, slide: -1200 });
    tone({ freq: 120, type: 'sine', dur: 0.14, gain: 0.12, slide: -50, delay: 0.04 }); // muffled drop
  },
  // Terminal hack — each completed tick gives a soft data blip
  hackTick() {
    tone({ freq: 660, type: 'square', dur: 0.04, gain: 0.08 });
    tone({ freq: 990, type: 'square', dur: 0.03, gain: 0.05, delay: 0.02 });
  },
  // Terminal fully sliced — affirmative two-note chirp
  hackComplete() {
    tone({ freq: 784, type: 'triangle', dur: 0.10, gain: 0.16 });
    tone({ freq: 1175, type: 'triangle', dur: 0.14, gain: 0.14, delay: 0.08 });
  },
  // Alarm klaxon — the room just went loud
  alarm() {
    tone({ freq: 660, type: 'sawtooth', dur: 0.18, gain: 0.14, slide: -180 });
    tone({ freq: 660, type: 'sawtooth', dur: 0.18, gain: 0.14, slide: -180, delay: 0.22 });
  },
  // Cluster bomblet detonating. Small and pixelated, deliberately NOT the
  // generic hit beep — a cluster strike used to sound exactly like gunfire
  // because the only thing it played was SFX.hit() via the damage event.
  //
  // The retro character is a falling SQUARE with per-call `vary`, which is this
  // game's own idiom for a pixel impact (see hit() and enemyDie()) and pairs
  // with fx.explosion's actual 3-frame pixel sprite. No bit-crusher: shaper()
  // is a soft tanh clip, and adding a quantiser for one sound is not worth it.
  //
  // Shape follows the rules meleeSlam's comments encode — everything DARKENS
  // and FALLS. No rising resonance (whistles) and no highpass tail (has no
  // ceiling, so it stays bright forever and drags the sound upward).
  //
  // Kept short and modest: five of these land inside a few hundred ms, and the
  // master compressor will pump hard if each one is a full-sized explosion.
  fragImpact() {
    // Crack — the pixel identity, falling and slightly detuned per call so a
    // volley doesn't sound like one sample looping.
    tone({ freq: 520, type: 'square', dur: 0.06, gain: 0.11, slide: -340, vary: 0.20 });
    // Body. Deliberately THIN: this was a 150Hz punch held for 200ms at gain
    // 0.20 with drive 5, which is a full-sized explosion thump — a "THONK" —
    // and five of them landing together turned into mud. Up an octave-ish,
    // roughly half the length, half the level and less saturation, so it reads
    // as a bomblet rather than a demolition charge.
    punch({ freq: 210, to: 90, dur: 0.11, gain: 0.10, drive: 3 });
    // Wash — short lowpassed burst closing downward. This is the "explosion"
    // half; without it the square alone is just another beep. Opened up and
    // shortened along with the body so the sound stays crisp rather than
    // filling in the low end the punch just vacated.
    noise({ dur: 0.16, gain: 0.17, hp: 4200, sweepTo: 900,
            type: 'lowpass', q: 0.6, drive: 2 });
  },

  // Sub-munition lighting its booster the instant it locks on — the "fff" as it
  // leaves the apex and commits to the dive.
  //
  // Air, not tone: a pitched layer here would fight the impact that follows a
  // beat later. Five of these fire within a frame of each other, so each call
  // jitters its own band and start time — without that they phase-align into one
  // loud "PSH" instead of five small ones. Same reason tone() has `vary`.
  fragBoost() {
    const lo = 700 + Math.random() * 260;
    noise({
      dur: 0.20, gain: 0.13, hp: lo, sweepTo: lo * 3.1,
      type: 'bandpass', q: 1.1, attack: 0.04,
      delay: Math.random() * 0.05,
    });
    // A whisper of low air under it so it has a body on a phone speaker, where
    // a pure 1-3kHz hiss is all that would survive.
    noise({
      dur: 0.16, gain: 0.08, hp: 420, sweepTo: 200,
      type: 'lowpass', q: 0.6, attack: 0.03,
      delay: Math.random() * 0.05,
    });
  },

  // Kill-chain combo — a bright rising arpeggio (root-3rd-5th) with a noise
  // transient and an echo tail, climbing a semitone per streak step so a long
  // chain literally sings upward. Far punchier than the old two-note blip.
  // `muffled` is for kills caused by the melee finisher. The echo send is the
  // real offender there: at 160ms with 0.32 feedback it rings for ~800ms, which
  // is longer than the slam itself, so a multi-kill slam was being covered by
  // its own kill reward. Dry and halved, arriving after the impact, it reads as
  // a tally instead of a ring.
  comboChime(n = 2, muffled = false) {
    const step = Math.min(n, 12);
    const base = 523.25 * Math.pow(2, step / 12); // C5 and up
    const v = muffled ? 0.5 : 1;
    const e = muffled ? 0 : 1;
    noise({ dur: 0.025, gain: 0.10 * v, hp: 3200 });   // crisp attack tick
    tone({ freq: base,        type: 'triangle', dur: 0.10, gain: 0.17 * v, echo: 0.28 * e });
    tone({ freq: base * 1.26, type: 'triangle', dur: 0.10, gain: 0.15 * v, delay: 0.045, echo: 0.28 * e });
    tone({ freq: base * 1.5,  type: 'square',   dur: 0.14, gain: 0.14 * v, delay: 0.09,  echo: 0.34 * e });
  },
  // Dash whoosh — dedicated sound (was borrowing the stealth-takedown blade
  // shink before). Fast filtered-noise sweep + a falling tone for air-push.
  dash() {
    noise({ dur: 0.14, gain: 0.16, hp: 900 });
    tone({ freq: 900, type: 'sine', dur: 0.16, gain: 0.10, slide: -700 });
  },

  // ── Melee "Broken Wings" ──────────────────────────────────────────────────
  // All three casts used to play SFX.dash() — one borrowed whoosh, no blade in
  // it, identical every time. These follow comboChime's shape (noise transient
  // -> pitched layers on short staggers -> echo tail), which is this file's own
  // reference for a sound that reads as an event rather than a beep.

  // A lightsaber sweep. Nothing more elaborate than that.
  //
  // The previous version decomposed the brief's onomatopoeia ("ZZZUUUBB") into
  // ring modulation for the buzz and formant filters for the vowel. That was
  // clever and it sounded terrible — "a weird metallic fart". Ring modulation
  // is the textbook way to make metallic inharmonic tones, and feeding it a
  // 150Hz sawtooth, squeezing that through Q=7 bandpasses at 300-1000Hz and
  // saturating the result is a recipe for a nasal buzz. A real saber has none
  // of it: it is a smooth HARMONIC hum, Doppler-shifted by the swing.
  //
  // It also rose in pitch at the end, because three of its four moving parts
  // swept upward (both formants, both noise layers) and only the carrier fell.
  //
  // THE RULE FOR THIS SOUND: everything that moves must end lower and darker
  // than it started. A swing that brightens as it dies is the defect.
  meleeSwing(stage = 1) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Cast 3 is the finisher's wind-up, not a full sweep. It has to be SHORT
    // and out of the way, because meleeSlam fires when the lunge lands and the
    // old 400ms swing smeared straight over it — which is why the smash could
    // not be heard at all.
    const windup = stage >= 3;
    const hard = stage === 2;
    const dur  = windup ? 0.15 : (hard ? 0.30 : 0.34);
    const peak = windup ? 1.20 : (hard ? 1.45 : 1.35);
    const base = windup ? 88 : 110;      // the wind-up sits lower and heavier

    // ── Blade core: a harmonic hum, Doppler-bent, behind a closing lowpass ──
    const outGain = ctx.createGain();
    const coreGain = windup ? 0.30 : 0.26;
    outGain.gain.setValueAtTime(0.0001, t);
    outGain.gain.linearRampToValueAtTime(coreGain, t + 0.03);
    // Hold the low hum most of the way, THEN release. An immediate exponential
    // decay left the tonal layers gone by the tail, so the last third was
    // nothing but mid-band air noise — measurably brighter than the start,
    // which is exactly the "goes up at the end" complaint. The blade has to
    // outlast the air it displaces.
    outGain.gain.setValueAtTime(coreGain, t + dur * 0.55);
    // Smooth release, no cliff. The old hard cut at dur*0.8 chopped a buzzy
    // waveform off mid-cycle, which clicks.
    outGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    // The lowpass CLOSES. This is the fix for "goes up at the end": the sound
    // must get darker as it dies, not brighter.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(2400, t);
    lp.frequency.linearRampToValueAtTime(3000, t + dur * 0.3);   // opens briefly
    lp.frequency.exponentialRampToValueAtTime(420, t + dur);     // then shuts
    lp.connect(outGain);
    outGain.connect(meleeBus || sfxBus || masterGain);

    // Harmonic partials (1x, 2x, 3x), lightly detuned. Harmonic and smooth is
    // the whole point — this is the opposite of ring-modulated sidebands.
    [[1, 0.55, 'triangle'], [2, 0.22, 'sine'], [3, 0.12, 'sine']].forEach(
      ([mult, amp, type]) => {
        [-5, 5].forEach((cents) => {
          const o = ctx.createOscillator();
          o.type = type;
          const f = base * mult * Math.pow(2, cents / 1200);
          // Rise into the pass, fall out of it — and land clearly BELOW the
          // start, so the gesture resolves downward.
          o.frequency.setValueAtTime(f, t);
          o.frequency.linearRampToValueAtTime(f * peak, t + dur * 0.34);
          o.frequency.exponentialRampToValueAtTime(f * 0.68, t + dur);
          const g = ctx.createGain();
          g.gain.value = amp * 0.5;
          o.connect(g); g.connect(lp);
          o.start(t); o.stop(t + dur + 0.04);
        });
      },
    );

    // ── Air. Sweeps UP on the approach only, and is over well before the tail
    // so nothing is still climbing at the end.
    noise({ dur: dur * 0.42, gain: 0.16, hp: 500, sweepTo: 2600,
            type: 'bandpass', q: 2.5, attack: 0.012, bus: meleeBus });
    // Second pass sweeps DOWN and lands LOW, carrying the blade away from you.
    // Its endpoint used to be 400Hz at gain 0.10, which left it as the loudest
    // thing still sounding at the tail — mid-band noise outliving the low hum
    // is what made the sound brighten as it died.
    noise({ dur: dur * 0.6, gain: 0.07, hp: 1800, sweepTo: 220,
            type: 'bandpass', q: 1.4, delay: dur * 0.25, bus: meleeBus });

    // ── Deep body: flat pitch, no sweep. This is what kept the swing audible
    // on a phone speaker (it recovered 10dB in the 150-500Hz band), so it
    // stays — and now runs the FULL duration so there is still low energy
    // present at the end to weigh the tail down.
    stack({
      freq: 150, count: 3, detune: 10, type: 'triangle',
      dur, gain: 0.15, attack: 0.02, sustain: dur * 0.55, bus: meleeBus,
    });
  },

  // Casts 1-2 connecting. The land was completely silent before, so a swing
  // that hit sounded exactly like one that missed.
  meleeHit() {
    const ctx = ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Saturated crack in the presence band — this is what a phone speaker
    // reproduces best, so the impact's identity lives here.
    noise({ dur: 0.07, gain: 0.22, hp: 2800, sweepTo: 900,
            type: 'bandpass', q: 1.2, qTo: 4, drive: 3, bus: meleeBus });

    // Contact: a short harmonic burst behind a closing lowpass. The ring mod
    // and formant filter that used to be here are gone for the same reason
    // they left the swing — that pairing is what read as metallic, and this
    // fires on every single connect, so it was smearing the character across
    // the whole combo.
    const dur = 0.13;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1;
    lp.frequency.setValueAtTime(2800, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + dur);   // darkens
    lp.connect(g);
    g.connect(meleeBus || sfxBus || masterGain);
    [[1, 0.5, 'triangle'], [2, 0.25, 'sine']].forEach(([mult, amp, type]) => {
      [-6, 6].forEach((cents) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = 220 * mult * Math.pow(2, cents / 1200);  // flat
        const vg = ctx.createGain();
        vg.gain.value = amp * 0.5;
        o.connect(vg); vg.connect(lp);
        o.start(t); o.stop(t + dur + 0.04);
      });
    });

    // Weight. punch() instead of sub(): the old 70Hz drop was inaudible on a
    // small speaker, so a connect and a whiff weighed the same on the device
    // this is actually played on.
    punch({ freq: 190, to: 60, dur: 0.26, gain: 0.24, drive: 4, bus: meleeBus });
  },

  // Cast 3's ground slam — the thomp. This made no sound at all before.
  // Built bottom-up: sub drop for the chest hit, saw body for the crack, a
  // long lowpassed tail for rubble, and a late highpassed scatter for debris
  // skittering off. Music ducks under it (see the caller) because the master
  // compressor is a hard limiter and would otherwise eat the sub.
  meleeSlam() {
    // The whole point of this sound was its bottom end, and the whole bottom
    // end was at 30-95Hz — below what a phone speaker can move. It measured as
    // a big sub drop and was heard as nothing. Rebuilt an octave up and
    // saturated, so the harmonics land where a small speaker lives and the ear
    // fills in the fundamental it can't hear.
    punch({ freq: 160, to: 48, dur: 0.60, gain: 0.34, drive: 6, bus: meleeBus });
    punch({ freq: 240, to: 80, dur: 0.34, gain: 0.20, drive: 5, delay: 0.012, bus: meleeBus });
    // Kept underneath for anyone on headphones, where it IS audible. It is a
    // bonus layer now, not the load-bearing one.
    sub({ freq: 90, to: 30, dur: 0.7, gain: 0.18, bus: meleeBus });
    // ── The "OO": a low, dark, SHORT body.
    //
    // This was a saturated 300Hz sawtooth held for 400ms behind a Q=2 resonant
    // filter — a pitched, sustained, bright tone, which is exactly the ringing
    // "DIIIIN" the smash was landing on. A smash has no note in it. Dropped an
    // octave and a half, halved in length, no saturation and no resonance, so
    // it reads as weight rather than as a pitch.
    stack({
      freq: 120, count: 2, detune: 8, type: 'triangle',
      dur: 0.18, gain: 0.17,
      filter: 800, filterTo: 260, q: 0.7, bus: meleeBus,
    });
    // Impact transient — the hard front edge, the "D".
    noise({ dur: 0.09, gain: 0.26, hp: 3600, sweepTo: 700,
            type: 'lowpass', q: 1, qTo: 5, drive: 3, bus: meleeBus });

    // ── The "SH": a broadband wash that DARKENS. ────────────────────────────
    // Every layer here used to sweep upward — a Q=2.2 bandpass rising to
    // 5200Hz and a lowpass opening 200 -> 1400Hz. A resonant filter travelling
    // up is heard as a whistle, and that was the other half of the "DIIIIN".
    //
    // Noise wants to fall away, not climb. All three layers now open wide at
    // the impact and close down, with the resonance taken out so there is no
    // pitch anywhere in the tail.
    noise({ dur: 0.30, gain: 0.26, hp: 4500, sweepTo: 800,
            type: 'lowpass', q: 0.5, attack: 0.015, delay: 0.02, bus: meleeBus });
    // Long tail — the "HH". A HIGHPASS was wrong for this: it has no ceiling,
    // so it passes everything up to Nyquist and stays bright forever. Being the
    // longest layer, it was the last thing still sounding and dragged the whole
    // tail upward even with the ring removed. A lowpass closing from 5kHz to
    // 700Hz keeps the broadband "sh" at the front and lets it darken away.
    noise({ dur: 0.70, gain: 0.16, hp: 3600, sweepTo: 450,
            type: 'lowpass', q: 0.6, attack: 0.04, sustain: 0.28, delay: 0.10, bus: meleeBus });
    // Low half of the wash — rumble settling, sweeping DOWN.
    noise({ dur: 0.65, gain: 0.15, hp: 1200, sweepTo: 220,
            type: 'lowpass', q: 0.8, attack: 0.04, sustain: 0.14, delay: 0.04, bus: meleeBus });
  },

  // The "ZZZZZ" phase — an energy-blade hum that holds for as long as the combo
  // window is live, so the chain reads as one continuous ability instead of
  // three unrelated swings with silence between them.
  //
  // Sustained, so unlike everything else in SFX these are long-lived nodes that
  // must be torn down explicitly. Held at module scope (see meleeHumNodes) so a
  // scene restart mid-combo can't strand an oscillator running forever.
  meleeHumStart() {
    const ctx = ensureCtx();
    if (!ctx || meleeHumNodes) return;   // already humming; don't stack a second
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.08);
    // A gentle lowpass, NOT a narrow resonant bandpass.
    //
    // This used to be four saturated sawtooths through a Q=2.6 bandpass, which
    // is the same nasal-buzz recipe as the old swing — and unlike the swing it
    // droned underneath the entire combo window, so it was contributing to the
    // "metallic fart" on every cast. Saturation and the resonant peak are gone.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.7;
    lp.connect(g);
    g.connect(meleeBus || sfxBus);
    // Harmonic partials of a 110Hz fundamental, lightly detuned. Smooth and
    // harmonic — a saber idle hum, not an electrical buzz. The 2nd and 3rd
    // partials (220/330Hz) are what carry it on a phone speaker.
    const oscs = [];
    [[1, 0.5, 'triangle'], [2, 0.3, 'sine'], [3, 0.16, 'sine']].forEach(
      ([mult, amp, type]) => {
        [-4, 4].forEach((cents) => {
          const o = ctx.createOscillator();
          o.type = type;
          o.frequency.value = 110 * mult * Math.pow(2, cents / 1200);
          const vg = ctx.createGain();
          vg.gain.value = amp * 0.5;
          o.connect(vg); vg.connect(lp);
          o.start(t);
          oscs.push(o);
        });
      },
    );
    meleeHumNodes = { oscs, gain: g };
  },

  meleeHumStop() {
    if (!meleeHumNodes || !audioCtx) return;
    const { oscs, gain } = meleeHumNodes;
    meleeHumNodes = null;                // clear first: stop is idempotent
    const t = audioCtx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    oscs.forEach((o) => { try { o.stop(t + 0.15); } catch (_) { /* noop */ } });
  },
};

// --- Background music: Imperial march-inspired dark ambient + pulse ---
export function startMusic() {
  if (musicStarted) return;
  const ctx = ensureCtx();
  if (!ctx) return;
  musicStarted = true;
  const nodes = [];

  // Low drone pad — a dark A-minor triad in the SUB register (A1/C2/E2). The
  // old version mis-computed 55*2^(semi/12) with semitone values 55/58/62,
  // landing at ~1.3-2kHz then lowpassing it to silence. These are the real low
  // frequencies, so the pad is actually audible under the beat.
  intensityTargets = [];
  [55, 65.41, 82.41].forEach((f, idx) => {
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';
    o1.frequency.value = f;
    o2.frequency.value = f * 1.004;  // slight detune for thickness
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    // Q was 2 — a resonant peak parked right on the march's fundamental, which
    // rang every time the bass line hit that note. The pad is meant to sit
    // under the music, not whistle along with it.
    lp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = 0.05 - idx * 0.008;
    o1.connect(lp); o2.connect(lp);
    lp.connect(g); g.connect(musicGain);
    o1.start(); o2.start();
    nodes.push(o1, o2);
    // Combat intensity opens these up, so the bed brightens under pressure.
    intensityTargets.push({ filter: lp, base: 420, span: 900 });
  });

  // Shared white-noise buffer reused by the percussion hits below.
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  // --- Percussion synth (routed to musicGain so the music slider owns it) ---
  // Every one-shot voice is registered so stopMusic can silence the bar that is
  // already queued. Without this, quitting to the title left up to a full bar
  // still scheduled and the march kept playing over the menu.
  const keep = (n) => { musicBarNodes.push(n); return n; };
  const kick = (t) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.30, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.26); keep(o);
  };
  const snare = (t) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(hp); hp.connect(g); g.connect(musicGain);
    src.start(t); src.stop(t + 0.16); keep(src);
  };
  const hat = (t, open = false) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8000;
    const g = ctx.createGain();
    const dur = open ? 0.10 : 0.03;
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(hp); hp.connect(g); g.connect(musicGain);
    src.start(t); src.stop(t + dur + 0.02); keep(src);
  };

  // Imperial-march bass pulse ("dun dun dun DUN da DUN") + a driving drum kit.
  //
  // The pitches were always right — A A A F C A F C is the motif in A minor.
  // What made it read as flat elevator beats was that every note got the SAME
  // 0.38s length, so the famous dotted rhythm was flattened into eight
  // identical quarter notes. The motif lives in its rhythm: three long notes,
  // then dotted-long/short, dotted-long/short.
  //
  // BEAT is the quarter-note unit; `len` is in beats. Notes are also
  // articulated (`hold` < len) so they detach instead of running together.
  const BEAT = 0.46;
  const marchNotes = [
    { f: 110,  len: 1,    accent: 1    },  // A  — statement
    { f: 110,  len: 1,    accent: 0.9  },  // A
    { f: 110,  len: 1,    accent: 0.9  },  // A
    { f: 87.31, len: 0.75, accent: 1   },  // F  — dotted, the hook
    { f: 130.81, len: 0.25, accent: 0.7 }, // C  — the short pickup
    { f: 110,  len: 1,    accent: 1    },  // A
    { f: 87.31, len: 0.75, accent: 0.95 }, // F  — dotted again
    { f: 130.81, len: 0.25, accent: 0.7 }, // C
  ];
  // Onset beat of each note, accumulated from the durations above.
  const marchOnsets = [];
  let acc = 0;
  marchNotes.forEach((n) => { marchOnsets.push(acc); acc += n.len; });
  const barBeats = acc;                      // 6 beats
  // Drums are placed on BEATS now, not on note indices — the notes are no
  // longer evenly spaced, so indexing them would scatter the pulse.
  const kickBeats  = [0, 2, 3, 5];
  const snareBeats = [2, 5];
  // `at` is an ABSOLUTE AudioContext time, not an offset. It used to be an
  // offset that this function added ctx.currentTime to — and the loop below
  // then passed `offset - ctx.currentTime`, so the two cancelled and every bar
  // after the first was scheduled at absolute time `offset`, permanently ~T0 in
  // the past (music starts after the title screen, so T0 is 10s+). Web Audio
  // fires past-dated events immediately, so each loop dumped all 8 notes, 4
  // kicks, 2 snares and 16 hats into the same instant. That was the "clipping
  // on sustained notes" — the march had never actually played as written.
  // One march note: a detuned saw stack through a lowpass with its own filter
  // envelope. A single static square (what this was) has no attack transient,
  // which is the other half of why the line sounded lifeless — brass gets its
  // character from the filter opening fast and closing again, not from pitch.
  const marchVoice = (t, freq, beats, accent) => {
    const hold = beats * BEAT * 0.82;      // articulation gap between notes
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(freq * 2, t);
    lp.frequency.linearRampToValueAtTime(freq * 9, t + 0.035);   // bite
    lp.frequency.exponentialRampToValueAtTime(freq * 2.5, t + hold);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.075 * accent, t + 0.012);
    g.gain.setValueAtTime(0.075 * accent, t + hold * 0.55);      // sustain, then
    g.gain.exponentialRampToValueAtTime(0.0001, t + hold);       // release
    lp.connect(g);
    g.connect(musicGain);
    // Three saws, ±6 cents. Detuning is the cheapest way to turn one thin
    // oscillator into something with body.
    [-6, 0, 6].forEach((cents) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq * Math.pow(2, cents / 1200);
      o.connect(lp);
      o.start(t);
      o.stop(t + hold + 0.03);
      keep(o);
    });
    // Sub an octave down so the line still has weight on a small speaker, where
    // the saw stack's fundamental at 87-131Hz is barely reproduced.
    const s = ctx.createOscillator();
    const sg = ctx.createGain();
    s.type = 'triangle';
    s.frequency.value = freq;
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.linearRampToValueAtTime(0.05 * accent, t + 0.015);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + hold);
    s.connect(sg); sg.connect(musicGain);
    s.start(t); s.stop(t + hold + 0.03); keep(s);
  };

  const startMarch = (at) => {
    // Only ever one bar in flight, so the previous bar's (already finished)
    // voices drop out of the list instead of accumulating for the whole run.
    musicBarNodes = [];
    marchNotes.forEach((n, i) => {
      marchVoice(at + marchOnsets[i] * BEAT, n.f, n.len, n.accent);
    });
    // Drums on the beat grid, independent of where the notes fall.
    kickBeats.forEach((b) => kick(at + b * BEAT));
    snareBeats.forEach((b) => snare(at + b * BEAT));
    for (let b = 0; b < barBeats; b += 0.5) {
      hat(at + b * BEAT, b % 1 !== 0);     // closed on beats, open off them
    }
    // Combat intensity adds percussion rather than a drone: sixteenth-note hats
    // and extra snare pushes fill in as pressure rises. Read at SCHEDULE time,
    // so a wave starting mid-bar takes effect on the next one.
    if (musicIntensity > 0.35) {
      for (let b = 0.25; b < barBeats; b += 0.5) hat(at + b * BEAT, false);
    }
    if (musicIntensity > 0.7) {
      snare(at + 3.5 * BEAT);
      snare(at + (barBeats - 0.5) * BEAT);
    }
  };

  // Bar cursor in absolute context time. Each pass schedules the NEXT bar and
  // re-arms off the real clock, so a slow frame or a throttled background tab
  // can't let the wall-clock timer drift away from the audio timeline.
  // Bar length comes from the accumulated note durations now, NOT from a note
  // count times a fixed step — the notes are no longer evenly spaced.
  const barDur = barBeats * BEAT;
  let next = ctx.currentTime;
  const LOOKAHEAD = 0.2;  // schedule this far ahead of the bar's start time
  const loop = () => {
    musicLoopTimer = null;
    if (!musicStarted) return;
    startMarch(next);
    next += barDur;
    const waitMs = Math.max(0, (next - ctx.currentTime - LOOKAHEAD) * 1000);
    musicLoopTimer = setTimeout(loop, waitMs);
  };
  loop();

  musicNodes = nodes;
}

export function stopMusic() {
  if (!musicStarted) return;
  musicStarted = false;
  // Kill the pending bar timer as well as the oscillators. Leaving it armed let
  // a stop/start cycle run two loops against one context, which stacks bars and
  // reproduces the original clipping by a different route.
  if (musicLoopTimer !== null) {
    clearTimeout(musicLoopTimer);
    musicLoopTimer = null;
  }
  // Voices already scheduled for the queued bar. Calling stop() with no
  // argument on a node whose start time is still in the future cancels it
  // outright, so this covers both "playing now" and "about to play".
  musicBarNodes.forEach((n) => { try { n.stop(); } catch (_) { /* noop */ } });
  musicBarNodes = [];
  if (musicNodes) {
    musicNodes.forEach((n) => {
      try {
        n.stop();
      } catch (_) {
        /* noop */
      }
    });
    musicNodes = null;
  }
  intensityTargets = [];
}

// Combat-intensity dial for the music bed: 0 = calm (breather/menu), 1 = full
// tension (an active wave or the boss fight).
//
// This used to swell a SUSTAINED detuned cluster at 220Hz + 233.08Hz — a minor
// second. Two tones that close beat against each other ~13 times a second, and
// so does every harmonic pair above them, through a lowpass wide enough to keep
// the lot. It was a dissonant throb by construction, ramped to full every time
// a wave started, which is exactly "the noise gets so much when enemies come".
//
// There is no sustained tone here any more, so nothing can beat. Intensity now
// drives percussion density and how far open the pad's filter sits — the bed
// gets busier and brighter under pressure instead of buzzing. Ramped rather
// than stepped so wave transitions still swell.
export function setMusicIntensity(x) {
  musicIntensity = Math.max(0, Math.min(1, x));
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  intensityTargets.forEach(({ filter, base, span }) => {
    filter.frequency.cancelScheduledValues(t);
    filter.frequency.setValueAtTime(filter.frequency.value, t);
    filter.frequency.linearRampToValueAtTime(base + span * musicIntensity, t + 0.4);
  });
}

export function getMusicIntensity() { return musicIntensity; }

export function duckMusic(amount = 0.5, restoreInMs = 600) {
  if (!musicGain || !audioCtx) return;
  const t = audioCtx.currentTime;
  musicGain.gain.cancelScheduledValues(t);
  musicGain.gain.setValueAtTime(musicGain.gain.value, t);
  // Dip/restore relative to the user's current music volume, not a hard-coded
  // default — otherwise every duck silently overwrote a lowered slider back to 0.18.
  musicGain.gain.linearRampToValueAtTime(musicVol * (1 - amount), t + 0.05);
  musicGain.gain.linearRampToValueAtTime(musicVol, t + 0.05 + restoreInMs / 1000);
}

// Duck everything EXCEPT the melee. Same shape as duckMusic, on sfxBus — which
// sits under sfxGain, so the dip is relative to a fixed 1.0 and can never
// overwrite the player's volume slider. meleeBus is a sibling and is untouched,
// so the slam gets the whole mix to itself for the length of the window.
export function duckSfx(amount = 0.5, restoreInMs = 600) {
  if (!sfxBus || !audioCtx) return;
  const t = audioCtx.currentTime;
  sfxBus.gain.cancelScheduledValues(t);
  sfxBus.gain.setValueAtTime(sfxBus.gain.value, t);
  sfxBus.gain.linearRampToValueAtTime(1 - amount, t + 0.03);
  sfxBus.gain.linearRampToValueAtTime(1, t + 0.03 + restoreInMs / 1000);
}

// --- Visual FX helpers (attached to scenes via attach()) ---

export function attachFX(scene) {
  const fx = {
    scene,
    sparks: scene.add.particles(0, 0, 'spark', {
      lifespan: 320,
      speed: { min: 80, max: 280 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      quantity: 0,
      emitting: false,
    }),
    sparksRed: scene.add.particles(0, 0, 'spark-red', {
      lifespan: 360,
      speed: { min: 60, max: 240 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      quantity: 0,
      emitting: false,
    }),
    sparksYellow: scene.add.particles(0, 0, 'spark-yellow', {
      lifespan: 280,
      speed: { min: 60, max: 220 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      quantity: 0,
      emitting: false,
    }),
    // Airborne burst emitter. Identical to sparksYellow except for its depth.
    //
    // Every other emitter here has no setDepth at all, so they sit at Phaser's
    // default 0 — beneath the whole Y-sorted layer of actors and walls. That is
    // survivable for ground FX (they read as sparks behind an actor) but not for
    // an airburst 300px above the floor, which was being drawn behind the room
    // it was exploding over. A separate emitter rather than re-depthing the
    // shared ones: those feed every effect in the game, and moving them is a
    // game-wide visual change, not a cluster-pod fix.
    airSparks: scene.add.particles(0, 0, 'spark-yellow', {
      lifespan: 280,
      speed: { min: 60, max: 220 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      quantity: 0,
      emitting: false,
    }).setDepth(DEPTH.AIR + 500),
    // Dedicated bullet trail emitter — small near-stationary fading dust
    // dropped at each active player bullet's position once per frame.
    bulletTrail: scene.add.particles(0, 0, 'spark', {
      lifespan: 140,
      speed: { min: 0, max: 28 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.28, end: 0 },
      alpha: { start: 0.4, end: 0 },
      quantity: 0,
      emitting: false,
    }),
    // Footstep dust — short-lived greyish puffs behind a running player.
    footDust: scene.add.particles(0, 0, 'spark', {
      lifespan: 360,
      speed: { min: 8, max: 32 },
      angle: { min: 70, max: 110 },   // mostly downward in screen space
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.35, end: 0 },
      tint: 0x5a5a64,
      quantity: 0,
      emitting: false,
    }),
    // Missile smoke trail — slow expanding dark puffs behind a super shot.
    missileSmoke: scene.add.particles(0, 0, 'spark', {
      lifespan: 420,
      speed: { min: 0, max: 18 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.75, end: 0 },
      alpha: { start: 0.45, end: 0 },
      tint: 0x3a3a44,
      quantity: 0,
      emitting: false,
    }),
    // Ambient floor motes — slow-drifting airborne particulate emitted across
    // the visible viewport. Kills the "static board" flatness without needing
    // a new parallax background layer. Drift direction = global wind.
    ambientMotes: scene.add.particles(0, 0, 'spark', {
      lifespan: 4200,
      speedX: { min: 6, max: 14 },
      speedY: { min: -3, max: 3 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.22, end: 0 },
      tint: 0xb8b4a8,
      quantity: 0,
      emitting: false,
    }),
    // Pickup sparkle — bright yellow particles flung outward on grab.
    pickupGlitter: scene.add.particles(0, 0, 'spark-yellow', {
      lifespan: 480,
      speed: { min: 60, max: 180 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      quantity: 0,
      emitting: false,
    }),
    // Healing sparkles bubbling upward (cyan)
    sparksBlue: scene.add.particles(0, 0, 'spark-blue', {
      lifespan: { min: 400, max: 700 },
      speedY: { min: -50, max: -20 },
      speedX: { min: -15, max: 15 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.8, end: 0 },
      quantity: 0,
      emitting: false,
    }),
    // Spinning gravity-bound gold shell casings
    casings: scene.add.particles(0, 0, 'casing', {
      lifespan: 800,
      speed: { min: 110, max: 210 },
      scale: { start: 1, end: 1 },
      alpha: { start: 1, end: 0 },
      rotate: { start: 0, end: 1440 },
      gravityY: 650,
      quantity: 0,
      emitting: false,
    }),

    burst(x, y, color = 'yellow', count = 12) {
      const e =
        color === 'red'
          ? this.sparksRed
          : color === 'yellow'
            ? this.sparksYellow
            : this.sparks;
      // Reset to omnidirectional in case a prior burstDir narrowed the cone.
      e.ops.angle.onChange({ min: 0, max: 360 });
      e.emitParticleAt(x, y, count);
    },

    // One puff of fading dust at the bullet's current position. Called per
    // frame on every active player bullet to build a motion-blur trail.
    trail(x, y) {
      if (lowQuality) return;
      this.bulletTrail.emitParticleAt(x, y, 1);
    },

    // Footstep dust puff — a small grey poof behind/under a running actor.
    dustPuff(x, y) {
      if (lowQuality) return;
      this.footDust.emitParticleAt(x, y, 2);
    },

    // Slow expanding smoke puff for missile/super trails. Called per frame.
    smokeTrail(x, y) {
      if (lowQuality) return;
      this.missileSmoke.emitParticleAt(x, y, 1);
    },

    // Bright sparkle burst when grabbing a pickup — flings 12 yellow specks.
    pickupSparkle(x, y, count = 12) {
      this.pickupGlitter.emitParticleAt(x, y, count);
    },
    healingSparkle(x, y, count = 1) {
      this.sparksBlue.emitParticleAt(x, y, count);
    },
    // Eject gold casing perpendicular to shooting angle
    ejectCasing(x, y, angle) {
      const ejectAngle = Phaser.Math.RadToDeg(angle - Math.PI / 2); // Eject right
      this.casings.ops.angle.onChange({ min: ejectAngle - 20, max: ejectAngle + 20 });
      this.casings.emitParticleAt(x, y, 1);
    },

    // Burst for something happening in the AIR, above the room.
    airBurst(x, y, count = 12) {
      this.airSparks.ops.angle.onChange({ min: 0, max: 360 });
      this.airSparks.emitParticleAt(x, y, count);
    },

    // A fading shockwave ring visual at the impact point of a bullet.
    // `depth` is for rings drawn at altitude, which must clear the Y-sorted
    // ground layer — see the DEPTH comment in config.js.
    impactRing(x, y, color = 0xffffff, depth = 25) {
      const g = scene.add.graphics().setDepth(depth);
      g.lineStyle(2, color, 0.8);
      g.strokeCircle(0, 0, 8);
      g.setPosition(x, y);
      scene.tweens.add({
        targets: g,
        scale: 2.2,
        alpha: 0,
        duration: 150,
        ease: 'Quad.easeOut',
        onComplete: () => g.destroy(),
      });
    },

    // ── Melee combo: sweeping blade arc ──────────────────────────────────
    // The melee used to borrow slashSwipe (below), which is the stealth
    // TAKEDOWN's effect: one 5px arc stroke that appears whole and fades in
    // 180ms. A lone thin crescent flickering on and off reads as a rendering
    // glitch, not a sword swing.
    //
    // This one is built as a tapered crescent that actually SWEEPS: the arc is
    // redrawn each frame growing from the tail toward the leading edge, so the
    // eye tracks a blade travelling through an arc. Two layers (soft outer
    // glow + white-hot core) and a spark riding the leading edge.
    //
    // `stage` picks the escalation: casts 1 and 2 sweep in mirrored directions
    // so the pair reads as a combo, and the finisher is fatter and whiter.
    bladeArc(x, y, angle, radius = 92, stage = 1) {
      const dir   = stage === 2 ? -1 : 1;              // mirror the second cast
      const span  = stage >= 3 ? Math.PI * 1.5 : Math.PI * 0.95;
      const maxT  = stage >= 3 ? 26 : 17;              // crescent half-thickness
      const dur   = stage >= 3 ? 260 : 200;
      const a0    = angle - dir * span / 2;
      // Depth keyed to world Y, not a flat 33. Entities overwrite their depth
      // with their own y every frame (Player.setDepth(this.y)), and in a 1600px
      // arena that puts every one of them far above 33 — so the swing was being
      // drawn UNDER the enemies it was cutting.
      const g     = scene.add.graphics().setDepth(y + 40)
        .setBlendMode(Phaser.BlendModes.ADD);
      const state = { t: 0 };

      // One tapered band: pointed at the tail, fattest near the leading edge.
      const band = (t, thick, colour, alpha) => {
        const N = 20;
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const u  = i / N;
          const a  = a0 + dir * span * t * u;
          const ht = thick * Math.sqrt(u) * (1 - 0.3 * Math.pow(u, 6));
          pts.push(new Phaser.Geom.Point(x + Math.cos(a) * (radius + ht),
                                         y + Math.sin(a) * (radius + ht)));
        }
        for (let i = N; i >= 0; i--) {
          const u  = i / N;
          const a  = a0 + dir * span * t * u;
          const ht = thick * Math.sqrt(u) * (1 - 0.3 * Math.pow(u, 6));
          pts.push(new Phaser.Geom.Point(x + Math.cos(a) * (radius - ht),
                                         y + Math.sin(a) * (radius - ht)));
        }
        g.fillStyle(colour, alpha);
        g.fillPoints(pts, true);
      };

      scene.tweens.add({
        targets: state, t: 1, duration: dur, ease: 'Cubic.easeOut',
        onUpdate: () => {
          const t = state.t;
          const fade = 1 - Math.pow(t, 2.2);           // holds, then drops away
          g.clear();
          band(t, maxT * 1.45, stage >= 3 ? 0x8fe4ff : 0x3aa8e8, 0.34 * fade);
          band(t, maxT,        stage >= 3 ? 0xd8f4ff : 0x90d8ff, 0.72 * fade);
          band(t, maxT * 0.42, 0xffffff,                         0.95 * fade);
          // Spark riding the leading edge.
          const ha = a0 + dir * span * t;
          g.fillStyle(0xffffff, fade);
          g.fillCircle(x + Math.cos(ha) * radius, y + Math.sin(ha) * radius,
                       (stage >= 3 ? 9 : 6) * fade);
        },
        onComplete: () => g.destroy(),
      });
    },

    // Ground slam: expanding shockwave ring + dust plume + radial debris. The
    // finisher's radial AoE had no radial effect at all before this — it drew
    // the same forward crescent as the other two casts.
    slamShockwave(x, y, radius = 210) {
      // ADD blend, so the ring blooms against the dark floor the way the super's
      // muzzle flash does — without it the slam read flat next to the shotgun.
      const ring = scene.add.graphics().setDepth(24)
        .setBlendMode(Phaser.BlendModes.ADD);
      const s = { t: 0 };
      scene.tweens.add({
        targets: s, t: 1, duration: 380, ease: 'Cubic.easeOut',
        onUpdate: () => {
          const t = s.t;
          const r = radius * t;
          const a = 1 - t;
          ring.clear();
          ring.lineStyle(14 * (1 - t * 0.7), 0x3aa8e8, 0.30 * a);
          ring.strokeCircle(x, y, r);
          ring.lineStyle(6 * (1 - t * 0.6), 0xd8f4ff, 0.85 * a);
          ring.strokeCircle(x, y, r);
          ring.lineStyle(2, 0xffffff, a);
          ring.strokeCircle(x, y, r * 0.96);
        },
        onComplete: () => ring.destroy(),
      });

      // Second ring, launched late and run wider — one ring reads as a pulse,
      // two read as a shock travelling out through the floor.
      const echo = scene.add.graphics().setDepth(24)
        .setBlendMode(Phaser.BlendModes.ADD);
      const e2 = { t: 0 };
      scene.tweens.add({
        targets: e2, t: 1, duration: 520, delay: 90, ease: 'Cubic.easeOut',
        onUpdate: () => {
          const t = e2.t, a = 1 - t;
          echo.clear();
          echo.lineStyle(7 * (1 - t * 0.6), 0x3aa8e8, 0.40 * a);
          echo.strokeCircle(x, y, radius * 1.28 * t);
          echo.lineStyle(2.5, 0x90d8ff, 0.6 * a);
          echo.strokeCircle(x, y, radius * 1.28 * t);
        },
        onComplete: () => echo.destroy(),
      });

      // Dust column punched straight up out of the epicentre.
      for (let i = 0; i < 5; i++) {
        this.dustPuff(x + (Math.random() - 0.5) * 26, y + (Math.random() - 0.5) * 18);
      }

      this.groundFractures(x, y, radius);

      // Dust plume kicked up at the epicentre, plus debris thrown outward along
      // the ring so the slam reads as hitting the FLOOR, not the air.
      this.burst(x, y, 'white', 16);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
        this.burstDir(x + Math.cos(a) * 26, y + Math.sin(a) * 26, 'yellow', 3, a, 24);
      }
    },

    // The floor actually breaking. The first pass drew 11 polylines at
    // lineStyle(2.5) — thin wires with no width, no branching and nothing
    // separating them from the tile pattern. Fractures here are GEOMETRY:
    // filled polygons that start wide at the epicentre and taper to a point,
    // each throwing off angular branch shards, over a near-black drop shadow.
    //
    // The shadow is what makes them read. The floor is #161620 (paintBackdrop),
    // so a mid-dark crack is invisible — which is exactly why the obvious reuse,
    // _spawnVaderGroundCrack at 0x1a1a22, showed nothing at all here.
    groundFractures(x, y, radius = 210) {
      const SHADOW = 0x05050a, BODY = 0x2f7fb8, HOT = 0x90d8ff, CORE = 0xeafbff;
      // Scar palette. The pit alone baked down to a flat dark star that barely
      // separated from the floor, so the permanent mark is built in three
      // layers: a lit RIM on the raised broken edge, the dark PIT over it, and
      // a COOL line of spent energy still sitting in the split.
      const RIM = 0x424a5c, COOL = 0x2e6f96;
      const scar = scene.add.graphics().setDepth(18);     // ground decal layer
      const glow = scene.add.graphics().setDepth(19);

      // One shard: a triangle-ish quad from `w` wide at (ax,ay) down to a point
      // `len` away, with a slight kink so it doesn't read as a clean cone.
      const shard = (g, ax, ay, ang, len, w, colour, alpha, dx = 0, dy = 0) => {
        const nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
        const mid = 0.45 + Math.random() * 0.2;
        const kink = (Math.random() - 0.5) * 0.28;
        const mx = ax + Math.cos(ang) * len * mid;
        const my = ay + Math.sin(ang) * len * mid;
        const tx = mx + Math.cos(ang + kink) * len * (1 - mid);
        const ty = my + Math.sin(ang + kink) * len * (1 - mid);
        g.fillStyle(colour, alpha);
        g.fillPoints([
          new Phaser.Geom.Point(ax + nx * w + dx,        ay + ny * w + dy),
          new Phaser.Geom.Point(mx + nx * w * 0.45 + dx, my + ny * w * 0.45 + dy),
          new Phaser.Geom.Point(tx + dx,                 ty + dy),
          new Phaser.Geom.Point(mx - nx * w * 0.45 + dx, my - ny * w * 0.45 + dy),
          new Phaser.Geom.Point(ax - nx * w + dx,        ay - ny * w + dy),
        ], true);
        return { tx, ty, mx, my };
      };

      const SPOKES = 10;
      for (let i = 0; i < SPOKES; i++) {
        const ang = (i / SPOKES) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        // Reach out to roughly the shockwave ring. Shorter than this and the
        // broken floor visibly undersells the area the slam actually damages.
        const len = radius * (0.66 + Math.random() * 0.4);
        const w   = 7 + Math.random() * 3;
        // Scar: lit rim offset up-left, dark pit over it offset down-right, so
        // the crack has a raised edge and a depth to it rather than being a
        // silhouette. Drawn once and left behind when the glow burns off.
        shard(scar, x, y, ang, len * 1.08, w * 1.5, RIM, 0.85, -2.5, -3);
        shard(scar, x, y, ang, len * 1.04, w * 1.3, SHADOW, 1, 2, 2);
        shard(scar, x, y, ang, len * 0.92, w * 0.32, COOL, 0.9);
        shard(glow, x, y, ang, len, w, BODY, 0.92);
        // Hot centre line down the spine — the split itself, glowing.
        shard(glow, x, y, ang, len * 0.9, w * 0.34, HOT, 0.95);
        shard(glow, x, y, ang, len * 0.6, w * 0.14, CORE, 1);

        // Branch shards, thrown off at a hard angle so the pattern reads as
        // fractured rather than as clean radiating spokes.
        const branches = 1 + Math.floor(Math.random() * 2);
        for (let b = 0; b < branches; b++) {
          const at = 0.35 + Math.random() * 0.4;
          const bx = x + Math.cos(ang) * len * at;
          const by = y + Math.sin(ang) * len * at;
          const bang = ang + (Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * 0.35);
          const blen = len * (0.3 + Math.random() * 0.3);
          shard(scar, bx, by, bang, blen * 1.08, w * 0.9, RIM, 0.8, -2, -2.5);
          shard(scar, bx, by, bang, blen * 1.04, w * 0.75, SHADOW, 1, 1.5, 1.5);
          shard(scar, bx, by, bang, blen * 0.9, w * 0.2, COOL, 0.85);
          shard(glow, bx, by, bang, blen, w * 0.55, BODY, 0.9);
          shard(glow, bx, by, bang, blen * 0.85, w * 0.2, HOT, 0.9);
        }
      }

      // Floor slabs knocked loose around the epicentre, lifted and dropped.
      const slabs = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.random() * 0.6;
        const d = 26 + Math.random() * 48;
        const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d;
        const sw = 14 + Math.random() * 16, sh = 9 + Math.random() * 11;
        const s = scene.add.graphics().setDepth(20);
        s.fillStyle(0x05050a, 0.8);
        s.fillRect(-sw / 2 + 2, -sh / 2 + 3, sw, sh);
        s.fillStyle(0x282838, 1);                     // PAL.floorLight
        s.fillRect(-sw / 2, -sh / 2, sw, sh);
        s.fillStyle(HOT, 0.85);
        s.fillRect(-sw / 2, -sh / 2, sw, 2);          // lit upper edge
        s.setPosition(sx, sy).setAngle(Math.random() * 40 - 20);
        slabs.push(s);
        scene.tweens.add({
          targets: s, y: sy - (10 + Math.random() * 12),
          duration: 170, ease: 'Quad.easeOut', yoyo: true,
          onComplete: () => { s.destroy(); },
        });
      }

      // Both layers burn off and the fractures are GONE inside ~2.4s. They used
      // to bake into the room's decal texture and persist, which read well for
      // a single slam but stacked into a dark web across the playfield once the
      // combo was used repeatedly — the floor stopped reading as floor.
      scene.tweens.add({
        targets: glow, alpha: 0, duration: 650, ease: 'Quad.easeIn',
        onComplete: () => glow.destroy(),
      });
      scene.tweens.add({
        targets: scar, alpha: 0,
        duration: 1800, delay: 550, ease: 'Quad.easeIn',
        onComplete: () => scar.destroy(),
      });
    },

    // A sweeping curved arc for takedown animations
    slashSwipe(x, y, angle, radius = 45, color = 0x40ff80) {
      const g = scene.add.graphics().setDepth(32);
      g.lineStyle(5, color, 1);
      g.beginPath();
      const start = angle - Math.PI / 3;
      const end = angle + Math.PI / 3;
      g.arc(x, y, radius, start, end, false);
      g.strokePath();
      scene.tweens.add({
        targets: g,
        alpha: 0,
        scale: 1.3,
        duration: 180,
        ease: 'Cubic.easeOut',
        onComplete: () => g.destroy(),
      });
    },

    // Single airborne floor mote at (x, y) — called by GameScene every few
    // hundred ms at a random viewport position to seed ambient drift.
    ambientMote(x, y) {
      this.ambientMotes.emitParticleAt(x, y, 1);
    },

    // Directional impact spray — sparks shoot back along the bullet's path
    // (pass the bullet's flight angle in radians; we flip by 180° internally
    // so the spray emits AWAY from where the bullet came from).
    burstDir(x, y, color, count, flightAngleRad, spreadDeg = 70) {
      const e =
        color === 'red'
          ? this.sparksRed
          : color === 'yellow'
            ? this.sparksYellow
            : this.sparks;
      // Phaser angle config is in degrees. The bullet keeps flying forward,
      // so most of the impact energy reflects forward too — emit forward
      // along the flight direction with a wide cone.
      const cx = Phaser.Math.RadToDeg(flightAngleRad);
      e.ops.angle.onChange({ min: cx - spreadDeg / 2, max: cx + spreadDeg / 2 });
      e.emitParticleAt(x, y, count);
    },

    // The super's blast bloom — the "pop". Three layers, all gone inside
    // ~150ms so it punches without lingering or cluttering the screen:
    // a big white-hot bloom, a wide cone flare along the fire axis, and an
    // expanding shockwave ring. Deliberately much larger than muzzleFlash,
    // which the super used to share with the pistol.
    superMuzzleFlash(x, y, angle) {
      // 1. Oversized bloom off the muzzle texture, additive so it blows out.
      const m = scene.add.image(x, y, 'muzzle').setDepth(35);
      m.setOrigin(0.15, 0.5);
      m.setRotation(angle);
      m.setScale(3.4, 2.7);
      m.setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: m, scaleX: 0.4, scaleY: 0.2, alpha: 0,
        duration: 150, ease: 'Cubic.easeIn',
        onComplete: () => m.destroy(),
      });

      // 1b. Explosive detonation right at the barrel — this is what sells the
      // shotgun "blam" rather than a laser puff. Two staggered pops slightly
      // ahead of the muzzle so the blast has depth along the fire direction.
      this.explosion(x + Math.cos(angle) * 16, y + Math.sin(angle) * 16, 1.5);
      scene.time.delayedCall(45, () => {
        this.explosion(x + Math.cos(angle) * 44, y + Math.sin(angle) * 44, 1.1);
      });

      // 1c. Hard white frame at the muzzle — one bright disc that snaps away in
      // ~70ms, giving the blast its instantaneous violence.
      const hot = scene.add.graphics().setDepth(36);
      hot.setBlendMode(Phaser.BlendModes.ADD);
      hot.fillStyle(0xffffff, 0.85);
      hot.fillCircle(0, 0, 26);
      hot.fillStyle(0xffe0c0, 0.5);
      hot.fillCircle(0, 0, 40);
      hot.setPosition(x + Math.cos(angle) * 10, y + Math.sin(angle) * 10);
      scene.tweens.add({
        targets: hot, scale: 0.2, alpha: 0,
        duration: 70, ease: 'Quad.easeIn',
        onComplete: () => hot.destroy(),
      });

      // 2. Wide white-hot cone flare hugging the blast direction.
      const SPREAD = Phaser.Math.DegToRad(34);
      const LEN = 150;
      const cone = scene.add.graphics().setDepth(34);
      cone.setBlendMode(Phaser.BlendModes.ADD);
      cone.fillStyle(0xff6040, 0.5);
      cone.beginPath();
      cone.moveTo(0, 0);
      cone.lineTo(Math.cos(-SPREAD) * LEN, Math.sin(-SPREAD) * LEN);
      cone.lineTo(Math.cos(SPREAD) * LEN, Math.sin(SPREAD) * LEN);
      cone.closePath();
      cone.fillPath();
      cone.fillStyle(0xffffff, 0.65);
      cone.beginPath();
      cone.moveTo(0, 0);
      cone.lineTo(Math.cos(-SPREAD * 0.45) * LEN * 0.7, Math.sin(-SPREAD * 0.45) * LEN * 0.7);
      cone.lineTo(Math.cos(SPREAD * 0.45) * LEN * 0.7, Math.sin(SPREAD * 0.45) * LEN * 0.7);
      cone.closePath();
      cone.fillPath();
      cone.setPosition(x, y);
      cone.setRotation(angle);
      scene.tweens.add({
        targets: cone, scaleX: 1.35, scaleY: 0.6, alpha: 0,
        duration: 110, ease: 'Quad.easeOut',
        onComplete: () => cone.destroy(),
      });

      // 3. Shockwave ring punching outward from the barrel.
      const ring = scene.add.graphics().setDepth(34);
      ring.setBlendMode(Phaser.BlendModes.ADD);
      ring.lineStyle(5, 0xffd0b0, 0.95);
      ring.strokeCircle(0, 0, 18);
      ring.setPosition(x, y);
      scene.tweens.add({
        targets: ring, scale: 4.6, alpha: 0,
        duration: 220, ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
    },

    // Pulsing charge orb shown at the muzzle while the super is aimed and
    // ready — the "tell" that costs no shot delay because it lives in the
    // aim-hold window that already exists.
    superChargeOrb(x, y, t) {
      const g = this._superOrb || (this._superOrb = scene.add.graphics().setDepth(33));
      g.clear();
      g.setVisible(true);
      g.setBlendMode(Phaser.BlendModes.ADD);
      const pulse = 0.75 + Math.sin(t * 0.012) * 0.25;
      g.fillStyle(0xff3020, 0.30 * pulse);
      g.fillCircle(x, y, 17 * pulse);
      g.fillStyle(0xff8060, 0.55 * pulse);
      g.fillCircle(x, y, 10 * pulse);
      g.fillStyle(0xffffff, 0.95 * pulse);
      g.fillCircle(x, y, 4.5 * pulse);
    },

    hideSuperChargeOrb() {
      if (this._superOrb) { this._superOrb.clear(); this._superOrb.setVisible(false); }
    },

    muzzleFlash(x, y, angle) {
      const m = scene.add.image(x, y, 'muzzle').setDepth(34);
      // Origin near the "core" end so the flame extends forward from the
      // barrel tip in the aim direction instead of being centered.
      m.setOrigin(0.15, 0.5);
      m.setRotation(angle);
      m.setScale(0.75);
      scene.tweens.add({
        targets: m,
        scale: 0,
        alpha: 0,
        duration: 90,
        ease: 'Cubic.easeIn',
        onComplete: () => m.destroy(),
      });
    },

    damageNumber(x, y, amount, color = '#ffffff', big = false) {
      const t = scene.add
        .text(x, y, String(amount), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: big ? '32px' : '24px',
          fontStyle: 'bold',
          color,
          stroke: '#000000',
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(30)
        .setScale(0.2);

      // Fan successive numbers around a circle by the golden angle instead of
      // rolling an independent random offset each time. Random offsets cluster:
      // several hits landing on one enemy in the same frame drew their numbers
      // within a few pixels of each other, stacking into an illegible blob.
      // A golden-angle sequence guarantees consecutive labels separate.
      // Numbers used to spawn on the hit point with only a random drift, so a
      // burst of hits in one frame stacked into a single unreadable blob.
      //
      // Deal them into 8 fixed slots instead — two rings of four, the outer ring
      // rotated 45 degrees between the inner ones. Fixed slots beat both random
      // offsets and a golden-angle spiral here: with only a handful of labels on
      // screen, random clusters and a spiral squashed into a top-down ellipse
      // still puts consecutive points ~10px apart. This guarantees ~34px.
      this._dmgSeq = (this._dmgSeq || 0) + 1;
      const slot  = this._dmgSeq % 8;
      const outer = slot >= 4;
      const a     = ((slot % 4) * 90 + (outer ? 45 : 0)) * Math.PI / 180;
      const rad   = outer ? 62 : 34;
      const ox = Math.cos(a) * rad, oy = Math.sin(a) * rad * 0.75;
      t.setPosition(x + ox, y + oy);
      // Then keep drifting outward along the same bearing, so the pop reads as
      // scatter rather than as a ring that sits still.
      const dx = ox * 0.9;
      const dy = oy * 0.9 - 58;                              // biased upward

      // Bounce scale tween
      scene.tweens.add({
        targets: t,
        scale: big ? 1.45 : 1.1,
        duration: 130,
        ease: 'Back.easeOut',
        onComplete: () => {
          scene.tweens.add({
            targets: t,
            scale: 0.9,
            duration: 100,
            ease: 'Quad.easeIn',
          });
        }
      });

      // Arc/bounce movement tween
      scene.tweens.add({
        targets: t,
        x: x + dx,
        y: y + dy,
        alpha: { start: 1, end: 0 },
        duration: 750,
        ease: 'Cubic.easeOut',
        onComplete: () => t.destroy(),
      });
    },

    shake(intensity = 0.005, duration = 80) {
      scene.cameras.main.shake(duration, intensity * SHAKE_SCALE);
    },

    hitFlash(sprite) {
      sprite.setTintFill(0xffffff);
      scene.time.delayedCall(80, () => {
        if (sprite.active) sprite.clearTint();
      });
    },

    // Play 3-frame explosion sprite at position (for missile impacts)
    explosion(x, y, scale = 1.5) {
      if (!scene.textures.exists('explosion')) return;
      const spr = scene.add.sprite(x, y, 'explosion', 0).setDepth(35).setScale(scale);
      spr.play('explode');
      spr.once('animationcomplete', () => spr.destroy());
    },
  };
  // Ambient motes sit above the floor decals but below the live Y-sort
  // layer (entities are at depth = y, minimum ~60 in this 1600px arena).
  fx.ambientMotes.setDepth(3);
  return fx;
}
