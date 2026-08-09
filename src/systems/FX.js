// FX: visual juice (damage numbers, particles, screen shake) + procedural audio
// via Web Audio API. No external sound assets needed for the vertical slice.

import Phaser from 'phaser';
import { DEPTH, MUSIC } from '../config.js';

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
// The drum kit, under musicGain. Same idea as the two SFX buses: one node the
// whole kit passes through, so its level can be trimmed as layers stack without
// touching the melody or the pad — those stay direct on musicGain, because a
// melody that ducks every time the drums thicken is the opposite of what a
// build-up should sound like. It is also the only way a test can measure the
// kit on its own instead of inferring it from the summed bed.
let percBus = null;
let musicVol = 0.40;   // was 0.18 — music sat ~20dB under SFX and was inaudible
let sfxVol = 0.60;
let sfxDelay = null;   // shared feedback-delay send for SFX "tails" (combo chime)
let lowQuality = false;
let musicNodes = null;
let musicStarted = false;
let musicLoopTimer = null;  // pending setTimeout for the next bar (see startMusic)
let musicBarNodes = [];     // one-shot voices of the bar currently scheduled
// The bar before it. Bars are scheduled a LOOKAHEAD ahead of their start time,
// so at the moment bar N is queued bar N-1 is still sounding — and a half note
// at the end of a bar rings into the next one. Clearing a single list on every
// bar therefore dropped the references stopMusic needs, and quitting mid-note
// left that note ringing over the title screen.
let musicPrevBarNodes = [];
let meleeHumNodes = null;   // sustained blade hum while a combo chain is live
let musicIntensity = 0;     // 0 = calm, 1 = full combat (see setMusicIntensity)
// Which tier the bed is playing. Like musicIntensity, this is READ AT BAR
// SCHEDULE TIME, never applied mid-bar — that is what keeps the melody and the
// kit locked to the same grid no matter when the game changes its mind.
let musicTier = 'combat';
// Test-only tempo lock. Null in normal play. smoke-march.mjs pins this so its
// grid assertions stay written against a constant beat — its claim is about
// the note SEQUENCE, and a moving tempo is a variable it never meant to test.
let musicTempoPin = null;
// Mirror of the live tempo. The working value lives inside startMusic's
// closure; this copy exists so __fxDebug (and therefore a test) can watch the
// ramp without reaching into it.
let musicBeatNow = MUSIC.tempo.base;
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

    // Drum kit bus. Starts at unity so this changes nothing on its own.
    percBus = audioCtx.createGain();
    percBus.gain.value = 1;
    percBus.connect(musicGain);

    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = sfxVol;
    sfxGain.connect(masterGain);

    // General SFX. duckSfx() dips THIS, not sfxGain, so a duck can never stomp
    // on the volume the player set (the bug duckMusic's comment describes).
    sfxBus = audioCtx.createGain();
    sfxBus.gain.value = 1;
    sfxBus.connect(sfxGain);

    // Melee bus. Sits ~6dB hot and is exempt from ducking, so the Riven combo
    // reads as the loudest thing on screen when it lands. The boost alone is not
    // enough — the master compressor (threshold -10, ratio 12) eats a chunk of
    // it — which is why duckSfx() clearing the other bus matters just as much.
    meleeBus = audioCtx.createGain();
    // 1.6 -> 2.0 (~+2dB). A moderate lift for phone speakers, applied to the bus
    // rather than to each voice so the balance between swing, hum and slam that
    // was tuned by ear is preserved exactly. Note the lift alone was NOT the fix
    // for the inaudible hum — see meleeHumStart; that was a spectrum problem and
    // no amount of gain here would have solved it.
    meleeBus.gain.value = 2.0;
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
    // in a live arena just measures gunfire. percBus narrows that further to
    // the drum kit alone, which is what a claim about layer density needs:
    // measuring the kit at musicGain just sums it back under the melody.
    musicGain,
    percBus,
    percBusGain: percBus ? percBus.gain.value : null,
    // Loop bookkeeping: at most two bars of voices (the queued one plus the one
    // still ringing) and at most one pending timer should exist at any moment.
    // A stop/start cycle that leaks either is what stacks bars and brings the
    // clipping back.
    musicStarted,
    musicTier,
    musicBeat: musicBeatNow,
    musicBarVoices: musicBarNodes.length + musicPrevBarNodes.length,
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
  // `kind` distinguishes the four nemesis weapons, which all used to make this
  // one sound. Built from the same two tones rather than four new synths: the
  // stock bolt is unchanged when no kind is passed.
  enemyShoot(kind = null) {
    if (kind === 'spray') {          // scattergun — broad, blunt, close
      noise({ dur: 0.09, gain: 0.15, hp: 700 });
      tone({ freq: 380, type: 'square', dur: 0.08, gain: 0.11, slide: -240, vary: 0.12 });
      return;
    }
    if (kind === 'lob') {            // flak — a heavier thump, lower and slower
      tone({ freq: 210, type: 'square', dur: 0.12, gain: 0.14, slide: -90, vary: 0.1 });
      noise({ dur: 0.07, gain: 0.09, hp: 300 });
      return;
    }
    if (kind === 'lance') {          // beam — tight, high, and it rings
      tone({ freq: 1500, type: 'sine', dur: 0.14, gain: 0.10, slide: -900, vary: 0.06 });
      tone({ freq: 760,  type: 'sine', dur: 0.09, gain: 0.06, slide: -420, vary: 0.06 });
      return;
    }
    if (kind === 'burst') {          // repeater — clipped, since it fires three
      tone({ freq: 1050, type: 'square', dur: 0.04, gain: 0.08, slide: -520, vary: 0.14 });
      return;
    }
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
    // NOTE: gains here and in fragBoost are scaled for EIGHT munitions landing
    // together (x0.79 from the five-munition tuning, i.e. sqrt(5/8), which holds
    // the summed level constant). The count went 5 -> 8; without this the volley
    // would be ~2dB hotter and, more audibly, would pump the master compressor
    // (threshold -10, ratio 12) hard enough to duck everything else under it.
    tone({ freq: 520, type: 'square', dur: 0.06, gain: 0.087, slide: -340, vary: 0.20 });
    // Body. Deliberately THIN: this was a 150Hz punch held for 200ms at gain
    // 0.20 with drive 5, which is a full-sized explosion thump — a "THONK" —
    // and five of them landing together turned into mud. Up an octave-ish,
    // roughly half the length, half the level and less saturation, so it reads
    // as a bomblet rather than a demolition charge.
    punch({ freq: 210, to: 90, dur: 0.11, gain: 0.079, drive: 3 });
    // Wash — short lowpassed burst closing downward. This is the "explosion"
    // half; without it the square alone is just another beep. Opened up and
    // shortened along with the body so the sound stays crisp rather than
    // filling in the low end the punch just vacated.
    noise({ dur: 0.16, gain: 0.134, hp: 4200, sweepTo: 900,
            type: 'lowpass', q: 0.6, drive: 2 });
  },

  // Sub-munition's booster, burning for the whole dive — lit the instant it
  // locks on, still running when it hits.
  //
  // `durMs` is the dive length, so the thrust ends when the munition does. It
  // was a fixed 200ms blip, which read as an ignition rather than a burn: the
  // sound was over long before the thing it was propelling arrived.
  //
  // Air, not tone: a pitched layer here would fight the impact that follows.
  // Five of these run concurrently for the full dive, so each call jitters its
  // own band and start time — without that they phase-align into one loud "PSH"
  // instead of five small ones. Same reason tone() has `vary`.
  //
  // Gains are BELOW the old blip's on purpose. Eight sustained sources summing
  // for 600ms is far more energy than eight overlapping 200ms transients, so
  // holding the old level would have made the boost louder than the detonation
  // it exists to lead into. Trimmed again (x0.79) when the count went 5 -> 8;
  // all eight ignite on the same frame, so they sum almost perfectly.
  fragBoost(durMs = 620) {
    const d  = Math.max(0.14, durMs / 1000);
    const lo = 700 + Math.random() * 260;
    // The burn. Sustains almost the whole way, then falls away as it lands —
    // noise() clamps the shelf to 80% of duration, so the last fifth is release.
    noise({
      dur: d, gain: 0.067, hp: lo, sweepTo: lo * 2.2,
      type: 'bandpass', q: 1.1, attack: 0.05, sustain: d * 0.8,
      delay: Math.random() * 0.05,
    });
    // A whisper of low air under it so it has a body on a phone speaker, where
    // a pure 1-3kHz hiss is all that would survive.
    noise({
      dur: d, gain: 0.040, hp: 420, sweepTo: 240,
      type: 'lowpass', q: 0.6, attack: 0.04, sustain: d * 0.8,
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
    g.gain.exponentialRampToValueAtTime(0.088, t + 0.08);
    // A gentle lowpass, NOT a narrow resonant bandpass.
    //
    // This used to be four saturated sawtooths through a Q=2.6 bandpass, which
    // is the same nasal-buzz recipe as the old swing — and unlike the swing it
    // droned underneath the entire combo window, so it was contributing to the
    // "metallic fart" on every cast. Saturation and the resonant peak are gone.
    //
    // Opened from 900Hz to 2000Hz. At 900 this filter was removing the exact
    // partials a phone can reproduce and leaving only the ones it cannot, which
    // is why the hum was inaudible on mobile no matter how loud it was set.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2000;
    lp.Q.value = 0.7;
    lp.connect(g);
    g.connect(meleeBus || sfxBus);
    // Harmonic partials of a 110Hz fundamental, lightly detuned. Smooth and
    // harmonic — a saber idle hum, not an electrical buzz.
    //
    // Extended from 3 partials to 5. A phone speaker has essentially no output
    // below ~400Hz, so a hum built only from 110/220/330Hz has nowhere to come
    // out — raising the gain just makes the rest of the mix louder around a hole
    // where the hum should be. The 4th and 5th (440/550Hz) are the first ones a
    // handset can actually move air with, so they carry the sound on mobile
    // while the low three still give it body on headphones. Weighted so the
    // series still falls away with frequency: it stays a saber hum rather than
    // becoming a thin whine.
    const oscs = [];
    [[1, 0.50, 'triangle'], [2, 0.34, 'sine'], [3, 0.22, 'sine'],
     [4, 0.20, 'sine'], [5, 0.13, 'sine']].forEach(
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
  // Levels come from MUSIC.layerGain rather than living here, so the kit's mix
  // is one config block instead of a magic number per voice.
  const LG = MUSIC.layerGain;
  const kick = (t, gain = LG.kick) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(percBus);
    o.start(t); o.stop(t + 0.26); keep(o);
  };
  const snare = (t, gain = LG.snare) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(hp); hp.connect(g); g.connect(percBus);
    src.start(t); src.stop(t + 0.16); keep(src);
  };
  const hat = (t, open = false, gain = LG.hat) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8000;
    const g = ctx.createGain();
    const dur = open ? 0.10 : 0.03;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(hp); hp.connect(g); g.connect(percBus);
    src.start(t); src.stop(t + dur + 0.02); keep(src);
  };

  // ── Escalation voices ────────────────────────────────────────────────────
  // All of these live between 400Hz and 8kHz. The instinctive way to make a
  // bed feel bigger is to add low drums, but a handset speaker cannot
  // reproduce them — the saber hum was inaudible on mobile for exactly this
  // reason. Every filter here also ramps DOWN or holds; a rising sweep reads
  // as a whistle, which the melee work learned the hard way.

  // The mid-band accent that stands in for a tom. Woody and short, sitting
  // above the phone rolloff and below the snare's 1400Hz wash.
  const rimshot = (t, gain = LG.rimshot) => {
    const o = ctx.createOscillator();
    const bp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 420;
    bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 4;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    o.connect(bp); bp.connect(g); g.connect(percBus);
    o.start(t); o.stop(t + 0.07); keep(o);
    // Noise leg for the stick crack, bounded top and bottom so it cannot
    // brighten as it decays.
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5000, t);
    lp.frequency.linearRampToValueAtTime(3000, t + 0.055);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(gain * 0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(hp); hp.connect(lp); lp.connect(ng); ng.connect(percBus);
    src.start(t); src.stop(t + 0.07); keep(src);
  };

  // Ride. Four INHARMONIC partials, so it shimmers instead of sounding a
  // pitch — a harmonic stack here reads as a bell note and fights the march.
  const ride = (t, accent = false, gain = LG.ride) => {
    const bp = ctx.createBiquadFilter();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const dur = accent ? 0.45 : 0.28;
    bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.2;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(7000, t);
    lp.frequency.linearRampToValueAtTime(4500, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    bp.connect(lp); lp.connect(g); g.connect(percBus);
    [1050, 1560, 2310, 3300].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      o.connect(bp);
      o.start(t); o.stop(t + dur + 0.02); keep(o);
    });
  };

  // Shaker. The 12ms attack is the whole point: it is what makes this a shaker
  // rather than a hi-hat, and a soft attack costs the master compressor almost
  // nothing, so sixteenths of it add motion without triggering gain reduction.
  const shaker = (t, gain = LG.shaker) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 1.0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(bp); bp.connect(g); g.connect(percBus);
    src.start(t); src.stop(t + 0.07); keep(src);
  };

  // Tambourine. The second band at 3400Hz is not colour — it is what keeps the
  // voice audible at all on a small speaker, where a pure 7000Hz jingle is
  // most of the way to inaudible.
  const tamb = (t, gain = LG.tamb) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const g = ctx.createGain();
    const hi = ctx.createBiquadFilter(); hi.type = 'bandpass'; hi.frequency.value = 7000; hi.Q.value = 0.8;
    const lo = ctx.createBiquadFilter(); lo.type = 'bandpass'; lo.frequency.value = 3400; lo.Q.value = 0.9;
    const loG = ctx.createGain(); loG.gain.value = 0.5;
    // Two-stage decay fakes the rattle: a sharp drop, then a short tail.
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(gain * 0.4, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    src.connect(hi); hi.connect(g);
    src.connect(lo); lo.connect(loG); loG.connect(g);
    g.connect(percBus);
    src.start(t); src.stop(t + 0.15); keep(src);
  };

  // Snare roll. ONE sustained source with a rippled gain curve, not a stream of
  // individual hits: 32 buffer sources a bar into a 12:1 compressor is the
  // difference between a roll and a pumping artefact. It swells in LEVEL while
  // its filter falls, so it obeys darken-and-fall while still crescendoing —
  // the rule is about spectrum, not amplitude.
  const roll = (t, dur, gain = LG.roll) => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(6000, t);
    lp.frequency.linearRampToValueAtTime(4000, t + dur);
    const g = ctx.createGain();
    // Ripple at a 32nd-note rate under an overall swell, drawn as a curve so it
    // is one automation instead of hundreds of scheduled events.
    const N = 96;
    const curve = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const p = i / (N - 1);
      const swell = 0.25 + 0.75 * p * p;           // accelerating crescendo
      const ripple = 0.55 + 0.45 * Math.abs(Math.cos(p * Math.PI * 16));
      curve[i] = gain * swell * ripple;
    }
    curve[N - 1] = 0.0001;
    g.gain.setValueCurveAtTime(curve, t, dur);
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(percBus);
    src.start(t); src.stop(t + dur + 0.02); keep(src);
  };

  // Rows that count as ESCALATION for the gain budget. kick/snare/hat are the
  // base kit and deliberately excluded — see the budget note in startBar.
  const EXTRA_VOICES = ['rimshot', 'ride', 'shaker', 'tamb', 'roll'];
  // Voices the core trim applies to. The hi-hat is core but deliberately NOT
  // trimmed: it carries the base kit's high-frequency content, and pulling it
  // down as layers arrive cancels out the brightness those layers exist to
  // add — measured as the hot tier landing at 0.99x the plain march above
  // 400Hz, which is the only part of the spectrum a handset reproduces.
  const TRIMMED_VOICES = ['kick', 'snare'];
  const ALL_VOICES = ['kick', 'snare', 'hat', ...EXTRA_VOICES];

  // Pattern reader. A row is 16 characters, one per sixteenth; this turns it
  // into the non-rest positions once, at startMusic, so the per-bar path is an
  // array walk instead of scanning strings 16 times a bar.
  const STEPS = new Map();
  const stepsOf = (row) => {
    let out = STEPS.get(row);
    if (out) return out;
    out = [];
    for (let i = 0; i < row.length; i++) if (row[i] !== '.') out.push({ i, ch: row[i] });
    STEPS.set(row, out);
    return out;
  };
  // Validate up front rather than letting a mistyped row fail silently — a row
  // of the wrong length would just drop or shift hits, which is very hard to
  // hear as a bug and impossible to spot in a diff.
  for (const [kitName, kit] of Object.entries(MUSIC.kits)) {
    kit.vars.forEach((v, vi) => {
      for (const [inst, row] of Object.entries(v)) {
        if (row.length !== 16) {
          console.warn(`[music] ${kitName}.vars[${vi}].${inst} is ${row.length} chars, expected 16`);
        }
        if (!ALL_VOICES.includes(inst)) {
          console.warn(`[music] ${kitName}.vars[${vi}] has no voice named '${inst}' — row ignored`);
        }
        stepsOf(row);
      }
    });
    if (kit.order.some((i) => i < 0 || i >= kit.vars.length)) {
      console.warn(`[music] ${kitName}.order references a variation that does not exist`);
    }
  }

  // The quarter note, in seconds. MUTABLE, and read exactly twice per bar: the
  // loop freezes it into `barBeat` before scheduling, and advances its own
  // cursor with that same frozen value. Everything inside a bar derives from
  // the frozen copy, which is what stops the melody and the kit drifting apart
  // when the tempo moves.
  let tempoBeat = MUSIC.tempo.base;

  // Every bar is 4/4. Asserting it here rather than accumulating a per-bar
  // length is deliberate: the drum grid below is written against a fixed 4-beat
  // bar, so a mistyped `len` must be a loud failure, not a bar that silently
  // drifts out of phase with the kit.
  const barBeats = 4;
  // The kit itself lives in MUSIC.kits (config.js) as sixteenth-grid patterns.
  // It sits on the beat grid independent of where the notes fall — the melody
  // is dotted and syncopated, so indexing the kit off note positions would
  // scatter the pulse that holds it together.
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
  const marchVoice = (t, freq, beats, accent, scale = 1, barBeat = tempoBeat, octaves = false) => {
    const hold = beats * barBeat * 0.82;      // articulation gap between notes
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(freq * 2, t);
    lp.frequency.linearRampToValueAtTime(freq * 9, t + 0.035);   // bite
    lp.frequency.exponentialRampToValueAtTime(freq * 2.5, t + hold);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.075 * accent * scale, t + 0.012);
    g.gain.setValueAtTime(0.075 * accent * scale, t + hold * 0.55);      // sustain, then
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
    // In octaves: a second stack an octave up, at half level, through its own
    // filter — the lowpass above tracks `freq` and would eat the upper stack's
    // fundamental entirely if it shared it.
    //
    // This is the oldest trick there is for making a theme sound bigger, and
    // here it does double duty: the doubling lands at 174-440Hz where a handset
    // speaker actually starts working, so Vader gains presence on the device
    // rather than only in headphones.
    if (octaves) {
      const olp = ctx.createBiquadFilter();
      const og = ctx.createGain();
      olp.type = 'lowpass';
      olp.Q.value = 4;
      olp.frequency.setValueAtTime(freq * 4, t);
      olp.frequency.linearRampToValueAtTime(freq * 12, t + 0.035);
      olp.frequency.exponentialRampToValueAtTime(freq * 5, t + hold);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.linearRampToValueAtTime(0.038 * accent * scale, t + 0.012);
      og.gain.setValueAtTime(0.038 * accent * scale, t + hold * 0.55);
      og.gain.exponentialRampToValueAtTime(0.0001, t + hold);
      olp.connect(og); og.connect(musicGain);
      [-6, 0, 6].forEach((cents) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq * 2 * Math.pow(2, cents / 1200);
        o.connect(olp);
        o.start(t);
        o.stop(t + hold + 0.03);
        keep(o);
      });
    }
    // Sub an octave down so the line still has weight on a small speaker, where
    // the saw stack's fundamental at 87-131Hz is barely reproduced.
    const s = ctx.createOscillator();
    const sg = ctx.createGain();
    s.type = 'triangle';
    s.frequency.value = freq;
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.linearRampToValueAtTime(0.05 * accent * scale, t + 0.015);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + hold);
    s.connect(sg); sg.connect(musicGain);
    s.start(t); s.stop(t + hold + 0.03); keep(s);
  };

  // Schedule ONE bar of the phrase. Scheduling a bar at a time rather than all
  // 32 beats at once is what keeps the bed responsive: the tier and the
  // intensity are read here, at schedule time, so a wave that starts mid-bar
  // takes hold on the next one (~1.8s) instead of up to a full phrase later.
  const startBar = (at, barIdx, barBeat) => {
    // Hand the outgoing bar to the prev slot rather than dropping it — see the
    // musicPrevBarNodes comment at the top of the file.
    musicPrevBarNodes = musicBarNodes;
    musicBarNodes = [];

    const tier = MUSIC.tiers[musicTier] || MUSIC.tiers.combat;

    // The kit, read off the pattern for this bar. `order` is indexed by bar, so
    // the phrase-end fill lands on bars 4 and 8 every time rather than turning
    // up at random — the variation is a shape the ear can learn.
    const kit = MUSIC.kits[tier.kit] || MUSIC.kits.march;
    const vars = kit.vars[kit.order[barIdx % kit.order.length]];
    // Half-time reads the SAME 16-char row at eighth-note resolution, so the
    // kit plays at half speed with the backbeat on 3 while the melody below is
    // untouched — heavier, not slower. Only the first 8 characters then fall
    // inside the bar; anything past index 7 would be silently dropped, which
    // is exactly the class of mistake the length check exists to prevent.
    const step = (barBeats / 16) * (tier.halfTime ? 2 : 1);
    const maxStepIdx = tier.halfTime ? 8 : 16;

    // Gain budget, resolved ONCE for the bar rather than per voice, and BEFORE
    // the melody, because the melody is part of the core it trims.
    //
    // L counts only the ESCALATION rows this variation carries. The base kit
    // (kick, snare, hat) is not a layer: counting it would trim the core in
    // the plain march tier too, and that tier is supposed to sound exactly as
    // it always has.
    const L = EXTRA_VOICES.reduce((n, name) => n + (vars[name] ? 1 : 0), 0);
    const B = MUSIC.budget;
    const layerScale = L > 0 ? Math.pow(L, -B.layerScaleExp) : 1;
    const coreScale = Math.max(B.coreTrimFloor, 1 - B.coreTrimPerLayer * L);

    // The melody is skipped entirely in a tier that does not carry it, but the
    // bar cursor still advances in the caller — so when combat returns the
    // phrase resumes where it got to instead of snapping back to bar 1.
    //
    // The phrase comes from the TIER, and phrases are not all the same length
    // (the mini-boss loop is 4 bars against the march's 8), which is why the
    // cursor is free-running and every consumer takes its own modulo.
    const phrase = MUSIC.phrases[tier.phrase] || MUSIC.phrases.main;
    let beat = 0;
    for (const n of phrase[barIdx % phrase.length]) {
      // The melody is NOT trimmed by the layer budget. That budget exists to
      // keep stacked PERCUSSION out of the compressor, and the melody is not
      // competing with a shaker for headroom — it is on musicGain, not percBus.
      // Trimming it as layers arrive made the tune quietest exactly when the
      // arrangement was fullest: Vader's ladder measured 0.0350 -> 0.0327 ->
      // 0.0322 across his three phases, getting quieter as he escalated.
      if (!n.rest && tier.melody) {
        marchVoice(at + beat * barBeat, n.f, n.len, n.accent, 1, barBeat, !!tier.octaves);
      }
      beat += n.len;
    }
    if (Math.abs(beat - barBeats) > 1e-6) {
      console.warn(`[music] bar ${barIdx + 1} is ${beat} beats, expected ${barBeats}`);
    }

    // Every row is optional — a kit only writes the voices it uses, and the
    // half-time kits have no hi-hat at all. Iterating the voice table rather
    // than naming rows one by one is what keeps that true; reading vars.hat
    // directly threw the moment a kit left it out.
    for (const name of ALL_VOICES) {
      const row = vars[name];
      if (!row) continue;
      const steps = stepsOf(row);
      if (tier.halfTime && steps.some((st) => st.i >= maxStepIdx)) {
        console.warn(`[music] ${tier.kit}.${name} has hits past index ${maxStepIdx - 1}; `
          + 'a half-time row is read at eighth resolution and only its first 8 steps sound');
      }
      const scale = EXTRA_VOICES.includes(name) ? layerScale
        : TRIMMED_VOICES.includes(name) ? coreScale : 1;
      const gain = LG[name] * scale;
      for (const st of steps) {
        if (st.i >= maxStepIdx) continue;
        const t = at + st.i * step * barBeat;
        switch (name) {
          case 'kick':    kick(t, gain); break;
          case 'snare':   snare(t, gain); break;
          case 'hat':     hat(t, st.ch === 'o', gain); break;
          case 'rimshot': rimshot(t, gain); break;
          case 'ride':    ride(t, st.ch === 'X', gain); break;
          case 'shaker':  shaker(t, gain); break;
          case 'tamb':    tamb(t, gain); break;
          // A roll runs from where it starts to the end of the bar, so it is
          // placed by its start index rather than struck like the others.
          case 'roll':    roll(t, Math.max(0.1, at + barBeats * barBeat - t), gain); break;
          default: break;
        }
      }
    }

    // Escalation used to be bolted on here as "if intensity > 0.35, add hats".
    // It is now a TIER change carrying its own pattern, which is both more
    // controllable and the only way half of these voices can exist at all —
    // leaving the old branches in would double up on the drive kit's own
    // sixteenths.
  };

  // Bar cursor in absolute context time. Each pass schedules the NEXT bar and
  // re-arms off the real clock, so a slow frame or a throttled background tab
  // can't let the wall-clock timer drift away from the audio timeline.
  // `barIdx` walks the phrase and wraps, which is the whole loop.
  let next = ctx.currentTime;
  let barIdx = 0;
  const LOOKAHEAD = 0.2;  // schedule this far ahead of the bar's start time
  const loop = () => {
    musicLoopTimer = null;
    if (!musicStarted) return;

    // Freeze the tempo for this bar, schedule against the frozen value, and
    // advance the cursor by THE SAME value. Ramping before `next` advances
    // would leave a gap or an overlap at every bar line, and it accumulates —
    // the tempo would appear to work while the bars slowly slid out of phase.
    const barBeat = tempoBeat;
    musicBeatNow = barBeat;
    startBar(next, barIdx, barBeat);
    // Free-running: wrapped at a fixed 8 it would land on the wrong bar of a
    // 4-bar phrase after a tier change. Modulo happens where it is read, and
    // 840 keeps the number tidy while dividing by every phrase and kit length
    // in use.
    barIdx = (barIdx + 1) % 840;
    next += barBeats * barBeat;

    // Ramp toward the tier's target for the NEXT bar. Bounded per bar, so
    // tempo glides instead of stepping.
    if (musicTempoPin !== null) {
      tempoBeat = musicTempoPin;
    } else {
      const tier = MUSIC.tiers[musicTier] || MUSIC.tiers.combat;
      const target = MUSIC.tempo[tier.tempo] ?? MUSIC.tempo.base;
      const maxStep = barBeat * MUSIC.tempo.maxStepPerBar;
      tempoBeat = barBeat + Math.max(-maxStep, Math.min(maxStep, target - barBeat));
    }

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
  // Both the queued bar and the one still ringing out under it — a half note at
  // the end of a bar outlives the bar, so stopping only the newest list left
  // the tail sounding.
  musicBarNodes.concat(musicPrevBarNodes)
    .forEach((n) => { try { n.stop(); } catch (_) { /* noop */ } });
  musicBarNodes = [];
  musicPrevBarNodes = [];
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
// One-shot transition hits. These are the ONLY music events not scheduled on
// the bar grid: they mark the seam where the kit's feel changes, and covering
// that seam is the whole point, so they fire the moment the game says so.
//
// Guarded against a teardown: Boss.enterPhase can fire while the scene is
// being torn down, and musicBarNodes/percBus may already be gone.
export function musicSting(name = 'crash') {
  if (!musicStarted || !audioCtx || !percBus) return;
  const ctx = audioCtx;
  const t = ctx.currentTime + 0.01;
  const LG = MUSIC.layerGain;
  const keep = (n) => { musicBarNodes.push(n); return n; };

  const crash = (at, gain) => {
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, ctx.sampleRate * 1.6, ctx.sampleRate);
    const d = src.buffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    // The downward sweep IS the character of a crash — the shimmer collapsing
    // into a wash. A fixed cutoff here sounds like a burst of static.
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(9000, at);
    lp.frequency.linearRampToValueAtTime(2500, at + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(percBus);
    src.start(at); src.stop(at + 1.5); keep(src);
  };

  // "Timpani" is a useful name and a lie about the register. A real one lives
  // at 60-120Hz, which a handset speaker cannot reproduce at all, so this is
  // built an octave and a half up with a 660Hz partial carrying it into the
  // band a phone can actually deliver. It reads as a war drum, not a timpani —
  // that is the price of the target device, and the right trade.
  const mallet = (at, gain) => {
    [[220, 196, 1], [660, 588, 0.35]].forEach(([f0, f1, mix]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f1, at + 0.25);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(gain * mix, at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
      o.connect(g); g.connect(percBus);
      o.start(at); o.stop(at + 0.95); keep(o);
      // Tagged so a test spying on triangle oscillators to count melody notes
      // can tell a sting apart from the tune.
      o._fxRole = 'sting';
    });
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, at);
    lp.frequency.linearRampToValueAtTime(800, at + 0.8);
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const nd = src.buffer.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(gain * 0.4, at);
    ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.025);
    src.connect(bp); bp.connect(ng); ng.connect(percBus);
    src.start(at); src.stop(at + 0.05); keep(src);
  };

  if (name === 'timpani') {
    mallet(t, LG.timpani);
    mallet(t + 0.14, LG.timpani * 0.7);   // double strike: an announcement
    crash(t, LG.crash * 0.6);
  } else {
    crash(t, LG.crash);
  }
}

// The pad's cutoff is the product of heat and the TIER's padSpan, so a heavy
// tier can sit dark while a hot one opens right up. Applied on any change to
// either, which is why it is factored out of setMusicIntensity.
function applyPadFilter() {
  if (!audioCtx) return;
  const span = (MUSIC.tiers[musicTier] || MUSIC.tiers.combat).padSpan ?? 1;
  const t = audioCtx.currentTime;
  intensityTargets.forEach(({ filter, base, span: full }) => {
    filter.frequency.cancelScheduledValues(t);
    filter.frequency.setValueAtTime(filter.frequency.value, t);
    filter.frequency.linearRampToValueAtTime(base + full * span * musicIntensity, t + 0.4);
  });
}

export function setMusicIntensity(x) {
  musicIntensity = Math.max(0, Math.min(1, x));
  applyPadFilter();
}

export function getMusicIntensity() { return musicIntensity; }

// The bed's full state in one call. Richer than a single scalar because no one
// number can say "melody off" AND "this kit" AND "pad this dark" — and because
// the alternative, a setter per property, invites half-applied states.
//
// Nothing here touches the running bar. Both fields are read by startBar when
// it schedules the NEXT one, which is what keeps every change on a bar line.
export function setMusicState({ tier, heat } = {}) {
  if (tier && MUSIC.tiers[tier]) musicTier = tier;
  if (typeof heat === 'number') musicIntensity = Math.max(0, Math.min(1, heat));
  applyPadFilter();
}

export function getMusicState() {
  return { tier: musicTier, heat: musicIntensity };
}

/**
 * Test-only: lock the tempo, or pass null to release it. Exists so a test whose
 * claim is about the note SEQUENCE can hold the one variable it never meant to
 * measure still — recovering the beat from the recorded data instead would turn
 * a falsifiable assertion into a curve fit.
 */
export function __fxPinTempo(b) {
  musicTempoPin = (typeof b === 'number' && b > 0) ? b : null;
}

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

    // ── INHALE: the opposite of a burst ──────────────────────────────────
    //
    // Motes spawned on a ring and drawn INWARD to a point. Every other emitter
    // here throws things outward, which is the vocabulary of something that has
    // already happened; a wind-up needs the opposite — energy gathering, an
    // event being assembled. This is what a force power looks like before it
    // fires, and it is the missing half of the anticipation beat.
    //
    // Built from short-lived sprites rather than an emitter because Phaser's
    // `moveToX/moveToY` is per-emitter state, and these are fired from several
    // callers at different radii in the same frame.
    inhale(x, y, color = 'blue', count = 4, radius = 200) {
      if (lowQuality) return;
      const key = color === 'red' ? 'spark-red'
        : color === 'yellow' ? 'spark-yellow'
          : color === 'blue' ? 'spark-blue' : 'spark';
      if (!scene.textures.exists(key)) return;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = radius * (0.75 + Math.random() * 0.35);
        const s = scene.add.image(x + Math.cos(a) * r, y + Math.sin(a) * r, key)
          .setDepth(y + 4)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setScale(0.7 + Math.random() * 0.6);
        scene.tweens.add({
          targets: s,
          x, y,
          scale: 0.15,
          alpha: { from: 0.95, to: 0.25 },
          duration: 260 + Math.random() * 180,
          ease: 'Quad.easeIn',            // accelerates as it arrives — it is being PULLED
          onComplete: () => s.destroy(),
        });
      }
    },

    // ── FORCE VORTEX ─────────────────────────────────────────────────────
    //
    // The wind-up for FORCE PULL, and the one effect in this file written to a
    // brief rather than assembled from spare parts. The move was carrying a
    // 90-degree cone outline and four motes on straight lines, against a
    // verdict of "it should have a circle effect still purple but with some
    // particles and good effect, do not be lazy and reuse everything".
    //
    // Four layers, following the same construction as `slamShockwave` above —
    // which is the quality bar in this file and the reason that slam reads:
    //
    //   1. SPIRALS. Motes spawned on the rim and integrated inward with an
    //      angular term, so they arc rather than fall straight in. This is the
    //      part that says "vortex" instead of "things moving toward a point".
    //   2. A counter-rotating inner ring, drawn dashed, spinning against the
    //      spirals. Opposed motion is what makes a rotation legible at a
    //      glance; two things turning the same way read as one thing.
    //   3. A pulsing core that brightens as the pull tightens.
    //   4. Floor scatter — dust lifted off the ground and dragged in, so the
    //      effect belongs to the room rather than floating over it.
    //
    // Follows the caster: he can be shoved mid-cast and it stays on him.
    // Returns a handle with `stop()` — the move owns it and must end it.
    forceVortex(owner, radius = 300, durationMs = 1600, color = 0xa070ff) {
      const g = scene.add.graphics().setDepth(13)
        .setBlendMode(Phaser.BlendModes.ADD);
      const motes = [];
      let t = 0;
      let stopped = false;

      const spawnMote = () => {
        if (lowQuality) return;
        const a = Math.random() * Math.PI * 2;
        const r = radius * (0.72 + Math.random() * 0.3);
        motes.push({ a, r, spin: 2.6 + Math.random() * 1.8, pull: 150 + Math.random() * 170 });
      };

      const ev = scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          if (stopped || !g.active) return;
          const dt = 0.016;
          t += dt;
          const cx = owner?.x ?? 0;
          const cy = owner?.y ?? 0;
          // Tightening: the closer to the strike, the faster everything turns.
          const tighten = Math.min(1, t / (durationMs / 1000));

          if (motes.length < 34) { spawnMote(); spawnMote(); }
          g.clear();

          // 1. the spiral arms
          for (let i = motes.length - 1; i >= 0; i--) {
            const m = motes[i];
            m.a += m.spin * dt * (1 + tighten * 1.6);
            m.r -= m.pull * dt * (1 + tighten);
            if (m.r <= 12) { motes.splice(i, 1); continue; }
            const px = cx + Math.cos(m.a) * m.r;
            const py = cy + Math.sin(m.a) * m.r;
            // A short streak along its own path, so each mote reads as moving.
            const tx = cx + Math.cos(m.a - 0.16) * (m.r + 16);
            const ty = cy + Math.sin(m.a - 0.16) * (m.r + 16);
            const fade = 1 - m.r / radius;
            g.lineStyle(2 + 2 * fade, color, 0.25 + 0.7 * fade);
            g.beginPath();
            g.moveTo(tx, ty);
            g.lineTo(px, py);
            g.strokePath();
          }

          // 2. counter-rotating dashed ring
          const rr = radius * (0.5 - 0.16 * tighten);
          const spin = -t * (2.2 + tighten * 3);
          g.lineStyle(3, 0xd8b0ff, 0.5 + 0.3 * tighten);
          for (let k = 0; k < 10; k++) {
            const a0 = spin + (k / 10) * Math.PI * 2;
            const a1 = a0 + 0.28;
            g.beginPath();
            g.moveTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr);
            for (let q = 1; q <= 4; q++) {
              const aa = a0 + ((a1 - a0) * q) / 4;
              g.lineTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr);
            }
            g.strokePath();
          }

          // 3. the core, breathing
          const core = 12 + 7 * Math.abs(Math.sin(t * 9));
          g.fillStyle(0xe0c8ff, 0.30 + 0.4 * tighten);
          g.fillCircle(cx, cy, core * (0.7 + tighten * 0.6));
          g.lineStyle(2, 0xffffff, 0.5 + 0.4 * tighten);
          g.strokeCircle(cx, cy, core * 1.7);

          // 4. floor scatter dragged off the ground
          if (Math.random() < 0.35) {
            const a = Math.random() * Math.PI * 2;
            this.dustPuff(cx + Math.cos(a) * radius * 0.8, cy + Math.sin(a) * radius * 0.8);
          }
        },
      });

      return {
        stop() {
          if (stopped) return;
          stopped = true;
          ev.remove(false);
          // Collapse: everything left snaps to the middle and flashes out.
          const cx = owner?.x ?? 0;
          const cy = owner?.y ?? 0;
          scene.tweens.add({
            targets: g, alpha: 0, duration: 180, ease: 'Quad.easeIn',
            onComplete: () => g.destroy(),
          });
          scene.fx?.impactRing?.(cx, cy, 0xc0a0ff, 14);
        },
      };
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
    // ── VADER'S OWN HITS ─────────────────────────────────────────────────
    //
    // Everything below this comment belongs to the boss and to nothing else.
    //
    // He was borrowing the PLAYER's kit: `slamShockwave` is the Riven melee
    // finisher (cyan, three-layer, bright) and `bladeArc` is her combo sweep.
    // Reusing them made his heaviest attacks look like the thing you had just
    // done to him — "for other supers you are using the same effect of my Riven
    // Q super. Do not use the same effect we had."
    //
    // Two families, so the KIND of attack reads before it lands:
    //
    //   saberSlam / saberSweep   crimson, molten, scorching. Anything with the
    //                            blade in it.
    //   forceWave                dark, desaturated, violet. Anything he does
    //                            with a raised hand — and deliberately the
    //                            inverse of the player's bright cyan slam:
    //                            debris is pulled IN before it is thrown out.

    /** The overhead smash. Crimson, and it burns the deck where it lands. */
    saberSlam(x, y, radius = 210) {
      const HOT = 0xfff0e0, BLADE = 0xff2a18, DEEP = 0x8c0e06;
      // Molten ring, thick and short-lived — a blade strike, not a shockwave.
      const ring = scene.add.graphics().setDepth(24)
        .setBlendMode(Phaser.BlendModes.ADD);
      const s = { t: 0 };
      scene.tweens.add({
        targets: s, t: 1, duration: 300, ease: 'Cubic.easeOut',
        onUpdate: () => {
          const t = s.t, a = 1 - t, r = radius * t;
          ring.clear();
          ring.lineStyle(18 * (1 - t * 0.8), DEEP, 0.34 * a);
          ring.strokeCircle(x, y, r);
          ring.lineStyle(7 * (1 - t * 0.5), BLADE, 0.9 * a);
          ring.strokeCircle(x, y, r);
          ring.lineStyle(2, HOT, a);
          ring.strokeCircle(x, y, r * 0.94);
        },
        onComplete: () => ring.destroy(),
      });

      // The scorch: a dark burn that STAYS a moment, with embers cooling on it.
      const scorch = scene.add.graphics().setDepth(11);
      scorch.fillStyle(0x14060a, 0.6);
      scorch.fillCircle(x, y, radius * 0.62);
      scorch.lineStyle(3, DEEP, 0.5);
      scorch.strokeCircle(x, y, radius * 0.62);
      scene.tweens.add({
        targets: scorch, alpha: 0, duration: 900, delay: 260,
        onComplete: () => scorch.destroy(),
      });

      // Radial fracture lines struck OUT from the point of impact, thin and
      // hot — the floor splitting along the blade rather than a dust ring.
      const cracks = scene.add.graphics().setDepth(12)
        .setBlendMode(Phaser.BlendModes.ADD);
      const arms = 9;
      for (let i = 0; i < arms; i++) {
        const a = (i / arms) * Math.PI * 2 + Math.random() * 0.3;
        const len = radius * (0.55 + Math.random() * 0.5);
        cracks.lineStyle(2.5, BLADE, 0.85);
        cracks.beginPath();
        cracks.moveTo(x, y);
        let px = x, py = y, aa = a;
        for (let seg = 0; seg < 4; seg++) {
          aa += (Math.random() - 0.5) * 0.4;
          px += Math.cos(aa) * (len / 4);
          py += Math.sin(aa) * (len / 4);
          cracks.lineTo(px, py);
        }
        cracks.strokePath();
      }
      scene.tweens.add({
        targets: cracks, alpha: 0, duration: 620, ease: 'Quad.easeIn',
        onComplete: () => cracks.destroy(),
      });

      // Slag thrown out along the ring, and a hot core flash.
      this.burst(x, y, 'red', 18);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + Math.random() * 0.3;
        this.burstDir(x + Math.cos(a) * 24, y + Math.sin(a) * 24, 'red', 3, a, 26);
      }
      for (let i = 0; i < 4; i++) {
        this.dustPuff(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 22);
      }
    },

    /**
     * His saber sweep. A crimson crescent that leads with its tip.
     *
     * Deliberately not `bladeArc`: that one is the player's, it is built around
     * her stage-1/2/3 combo escalation and it blooms white-green. This is one
     * heavy blade travelling through an arc, red-hot at the edge.
     */
    saberSweep(x, y, angle, radius = 92, dir = 1) {
      const g = scene.add.graphics().setDepth(y + 40)
        .setBlendMode(Phaser.BlendModes.ADD);
      const span = Math.PI * 1.05;
      const a0 = angle - dir * span / 2;
      const st = { t: 0 };
      scene.tweens.add({
        targets: st, t: 1, duration: 190, ease: 'Quad.easeOut',
        onUpdate: () => {
          const t = st.t;
          g.clear();
          const N = 18;
          // Two passes: a wide dark-red wash, then a thin white-hot leading line
          // that stops SHORT of the tail, so the eye tracks the tip.
          for (const [thick, colour, alpha, tailCut] of [
            [15, 0x8c0e06, 0.5 * (1 - t * 0.4), 0.0],
            [7,  0xff2a18, 0.85 * (1 - t * 0.3), 0.25],
            [2,  0xfff0e0, 0.95 * (1 - t * 0.2), 0.6],
          ]) {
            g.lineStyle(thick, colour, alpha);
            g.beginPath();
            for (let i = 0; i <= N; i++) {
              const u = tailCut + (1 - tailCut) * (i / N);
              const a = a0 + dir * span * t * u;
              const px = x + Math.cos(a) * radius;
              const py = y + Math.sin(a) * radius;
              if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
            }
            g.strokePath();
          }
        },
        onComplete: () => {
          scene.tweens.add({
            targets: g, alpha: 0, duration: 110,
            onComplete: () => g.destroy(),
          });
        },
      });
      // A spark riding the leading edge.
      const tipA = a0 + dir * span;
      this.burstDir(x + Math.cos(tipA) * radius, y + Math.sin(tipA) * radius,
        'red', 4, tipA + dir * Math.PI / 2, 40);
    },

    /**
     * A Force blow. Dark where the player's slam is bright.
     *
     * Debris is dragged INWARD first and only then thrown out, which is the
     * read that separates "he crushed the air" from "something exploded".
     */
    forceWave(x, y, radius = 260) {
      const VIOLET = 0x9a6cff, PALE = 0xd8c8ff;

      // The inhale: a collapsing ring, before anything expands.
      const pre = scene.add.graphics().setDepth(13);
      const p = { t: 0 };
      scene.tweens.add({
        targets: p, t: 1, duration: 130, ease: 'Quad.easeIn',
        onUpdate: () => {
          pre.clear();
          pre.lineStyle(4, PALE, 0.8 * (1 - p.t));
          pre.strokeCircle(x, y, radius * (1 - p.t * 0.85));
        },
        onComplete: () => pre.destroy(),
      });

      // Then the wave — dark body, pale rim, and NO additive bloom on the body
      // so it reads as an absence rather than a light.
      const wave = scene.add.graphics().setDepth(24);
      const s = { t: 0 };
      scene.tweens.add({
        targets: s, t: 1, duration: 420, delay: 120, ease: 'Cubic.easeOut',
        onUpdate: () => {
          const t = s.t, a = 1 - t, r = radius * t;
          wave.clear();
          wave.fillStyle(0x120a1e, 0.34 * a);
          wave.fillCircle(x, y, r);
          wave.lineStyle(10 * (1 - t * 0.6), VIOLET, 0.55 * a);
          wave.strokeCircle(x, y, r);
          wave.lineStyle(2.5, PALE, 0.9 * a);
          wave.strokeCircle(x, y, r * 0.97);
        },
        onComplete: () => wave.destroy(),
      });

      scene.time.delayedCall(120, () => {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + Math.random() * 0.25;
          this.burstDir(x + Math.cos(a) * 30, y + Math.sin(a) * 30, 'white', 2, a, 20);
        }
      });
    },

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
    /**
     * Cracked floor, left as a permanent scar.
     *
     * `palette` is optional and defaults to the cyan this has always been. That
     * default is not neutral — it is the PLAYER's colour, from the melee
     * finisher this was written for — and yet it is the only ground effect the
     * nemeses use, in two of their five moves. So an enemy attack has been
     * leaving the player's own energy in the floor. Passing a palette lets a
     * nemesis crack the ground in its own trait colour without forking the
     * geometry, which is 120 lines of shard maths worth keeping in one place.
     */
    groundFractures(x, y, radius = 210, palette = null) {
      const SHADOW = 0x05050a;
      const BODY = palette?.body ?? 0x2f7fb8;
      const HOT  = palette?.hot  ?? 0x90d8ff;
      const CORE = palette?.core ?? 0xeafbff;
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

    // ── THE NEMESES' OWN HITS ────────────────────────────────────────────
    //
    // Same rule as Vader's block above, applied to the other half of the cast.
    // Their five moves shared five generic calls between them — `burst`,
    // `shake`, `explosion`, `groundFractures` (which is the PLAYER's cyan) and
    // `slashSwipe`, which is the stealth TAKEDOWN effect and is documented a
    // few lines down as too thin to read as a sword swing.
    //
    // One family per MOVE, because the move is what the player has to learn.
    // Every one takes a `color` so the nemesis's leading trait tints it: the
    // attack stays recognisable while ARMORED and VOLATILE doing it look like
    // different creatures. That is the split the boss pass did not need — he is
    // one character, they are forty-one loadouts.
    //
    //   chargeWake / crossCut / crushRing / whirlArms / summonRune
    //
    // Deliberately NOT reusing Vader's: his are crimson and molten because he
    // has a lightsaber. A trooper with a scattergun who cracks the floor in
    // molten crimson is borrowing again, one level down.

    /**
     * The moment a nemesis weapon fires.
     *
     * Four weapons funnelled through one call site with NO muzzle flash and one
     * generic sound, while the player got `muzzleFlash` — so a scattergun, a
     * flak launcher, a beam lance and twin repeaters were identical at the
     * instant that most defines them. Each is drawn from its own `tint`, which
     * the weapons already carried and nothing rendered.
     *
     * `kind` picks the shape; the colour comes from the weapon.
     */
    weaponMuzzle(x, y, angle, color = 0xffdd80, kind = 'spray') {
      if (lowQuality) return;
      const g = scene.add.graphics().setDepth(27).setBlendMode(Phaser.BlendModes.ADD);
      const fan = (len, wide, alpha) => {
        g.fillStyle(color, alpha);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(angle - wide) * len, Math.sin(angle - wide) * len);
        g.lineTo(Math.cos(angle) * len * 1.15, Math.sin(angle) * len * 1.15);
        g.lineTo(Math.cos(angle + wide) * len, Math.sin(angle + wide) * len);
        g.closePath();
        g.fillPath();
      };

      if (kind === 'spray') {
        // Wide and short: the whole point of the weapon is the cone.
        fan(30, 0.5, 0.75);
        fan(18, 0.28, 0.9);
        this.burstDir(x, y, 'yellow', 7, angle, 46);
      } else if (kind === 'lob') {
        // Fat and round — a shell leaving, not a bolt. Smoke rather than sparks.
        g.fillStyle(color, 0.7);
        g.fillCircle(Math.cos(angle) * 16, Math.sin(angle) * 16, 12);
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(Math.cos(angle) * 12, Math.sin(angle) * 12, 5);
        this.smokeTrail?.(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20);
      } else if (kind === 'lance') {
        // Thin, long, cold: a lens flare down the firing line, plus a crossbar
        // so it reads as focused rather than sprayed.
        fan(74, 0.055, 0.85);
        g.lineStyle(2, 0xffffff, 0.8);
        g.beginPath();
        const perp = angle + Math.PI / 2;
        g.moveTo(Math.cos(perp) * 11, Math.sin(perp) * 11);
        g.lineTo(-Math.cos(perp) * 11, -Math.sin(perp) * 11);
        g.strokePath();
      } else {
        // Repeater: small and tight. It fires three times, so anything big
        // would stack into a wall of light.
        fan(20, 0.2, 0.85);
        this.burstDir(x, y, 'white', 2, angle, 20);
      }

      g.setPosition(x, y);
      scene.tweens.add({
        targets: g, alpha: 0,
        duration: kind === 'lance' ? 150 : 95,
        ease: 'Quad.easeIn',
        onComplete: () => g.destroy(),
      });
    },

    /**
     * CHARGE — the scrape of something heavy that has committed to a direction.
     *
     * Called per frame while the run is live, so it is deliberately cheap: two
     * short streaks behind the runner and an occasional floor scuff. The mass
     * reads from the LENGTH of the streak, not from its brightness.
     */
    chargeWake(x, y, angle, color = 0xff6030) {
      if (lowQuality) return;
      const g = scene.add.graphics().setDepth(11);
      const back = angle + Math.PI;
      for (let i = 0; i < 2; i++) {
        const off = (i === 0 ? 1 : -1) * (7 + Math.random() * 5);
        const px = x + Math.cos(angle + Math.PI / 2) * off;
        const py = y + Math.sin(angle + Math.PI / 2) * off;
        const len = 22 + Math.random() * 18;
        g.lineStyle(4 - i, color, 0.8);
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + Math.cos(back) * len, py + Math.sin(back) * len);
        g.strokePath();
      }
      scene.tweens.add({
        targets: g, alpha: 0, duration: 260, ease: 'Quad.easeIn',
        onComplete: () => g.destroy(),
      });
    },

    /**
     * BLINK — the departure and the arrival.
     *
     * Deliberately the same shape both ends: a ring and a spike burst. A player
     * who learns the shape learns "it just left / it just landed" without
     * having to work out which, and the position is the information that
     * matters. Cheap enough to fire twice in one move.
     */
    blinkOut(x, y, color = 0x40ffd0) {
      const g = scene.add.graphics().setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
      g.lineStyle(3, color, 0.9);
      g.strokeCircle(0, 0, 40);
      g.setPosition(x, y).setScale(1);
      scene.tweens.add({
        targets: g, scale: 0.15, alpha: 0,
        duration: 200, ease: 'Quart.easeIn',
        onComplete: () => g.destroy(),
      });
      // Four spikes on the diagonal, so it reads as displacement rather than as
      // an explosion — nothing is thrown outward, the space closes up.
      const sp = scene.add.graphics().setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
      sp.lineStyle(2, 0xffffff, 0.7);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        sp.beginPath();
        sp.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
        sp.lineTo(Math.cos(a) * 46, Math.sin(a) * 46);
        sp.strokePath();
      }
      sp.setPosition(x, y);
      scene.tweens.add({
        targets: sp, alpha: 0, scale: 0.4,
        duration: 220, ease: 'Quad.easeIn',
        onComplete: () => sp.destroy(),
      });
    },

    /**
     * BLINK — the cut at the end of the reappearance.
     *
     * Replaces `slashSwipe` here. Two crossing passes rather than one arc: a
     * single 5px stroke reads as a rendering artifact, which is exactly what
     * the note under `bladeArc` says about it. The second pass is offset in
     * time as well as angle so the eye sees a sequence, not an X.
     */
    crossCut(x, y, angle, color = 0x40ffd0, radius = 62) {
      const pass = (a, delay, width) => {
        scene.time.delayedCall(delay, () => {
          if (!scene.scene?.isActive?.()) return;
          const g = scene.add.graphics().setDepth(32).setBlendMode(Phaser.BlendModes.ADD);
          g.lineStyle(width, color, 0.95);
          g.beginPath();
          g.arc(x, y, radius, a - 0.55, a + 0.55);
          g.strokePath();
          // A brighter core inside the same sweep gives it an edge.
          g.lineStyle(Math.max(1, width - 3), 0xffffff, 0.8);
          g.beginPath();
          g.arc(x, y, radius, a - 0.34, a + 0.34);
          g.strokePath();
          scene.tweens.add({
            targets: g, alpha: 0, duration: 150, ease: 'Quad.easeIn',
            onComplete: () => g.destroy(),
          });
        });
      };
      pass(angle - 0.5, 0, 7);
      pass(angle + 0.5, 70, 5);
      this.burstDir(x, y, 'white', 8, angle, 40);
    },

    /**
     * BAIT SLAM — weight landing. Compression, not detonation.
     *
     * Not additive and not bright: this is a body arriving, so it reads as the
     * floor being pushed DOWN. Vader's `saberSlam` is molten because a blade
     * did it; the player's `slamShockwave` is bright cyan. This is the third
     * thing and has to look like neither.
     */
    crushRing(x, y, radius = 155, color = 0xffb020) {
      const g = scene.add.graphics().setDepth(20);
      const dark = scene.add.graphics().setDepth(19);
      // A dark disc that snaps out first: the shadow of the impact.
      dark.fillStyle(0x0a0a10, 0.5);
      dark.fillCircle(0, 0, radius * 0.9);
      dark.setPosition(x, y).setScale(0.2);
      scene.tweens.add({
        targets: dark, scale: 1, alpha: 0,
        duration: 380, ease: 'Cubic.easeOut',
        onComplete: () => dark.destroy(),
      });
      // Then a thick compression ring, widest at the start and thinning out.
      g.lineStyle(9, color, 0.9);
      g.strokeCircle(0, 0, radius * 0.55);
      g.lineStyle(3, 0xffffff, 0.5);
      g.strokeCircle(0, 0, radius * 0.55);
      g.setPosition(x, y).setScale(0.35);
      scene.tweens.add({
        targets: g, scale: 1.05, alpha: 0,
        duration: 300, ease: 'Quart.easeOut',
        onComplete: () => g.destroy(),
      });
      this.burstDir(x, y, 'yellow', 10, -Math.PI / 2, 160);
    },

    /**
     * SPIRAL — the spin-up, and the arms as they leave.
     *
     * This move had NO effects at all: it span and bullets appeared. The rings
     * counter-rotate so the wind-up reads as something being loaded rather than
     * something already happening.
     */
    whirlArms(owner, radius = 120, durationMs = 900, color = 0xc080ff) {
      const g = scene.add.graphics().setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
      const start = scene.time.now;
      let rot = 0;
      const ev = scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          const t = (scene.time.now - start) / durationMs;
          if (t >= 1 || !owner?.active) { ev.remove(); g.destroy(); return; }
          rot += 0.11;
          g.clear();
          const grow = 0.35 + t * 0.65;
          for (let arm = 0; arm < 3; arm++) {
            const a0 = rot + (arm * Math.PI * 2) / 3;
            g.lineStyle(4, color, 0.85 * (1 - t * 0.35));
            g.beginPath();
            g.arc(owner.x, owner.y, radius * grow, a0, a0 + 1.1);
            g.strokePath();
          }
          // Counter-rotating inner ring — the thing being wound up.
          g.lineStyle(3, 0xffffff, 0.6);
          g.beginPath();
          g.arc(owner.x, owner.y, radius * 0.42 * grow, -rot * 1.6, -rot * 1.6 + 2.4);
          g.strokePath();
        },
      });
      return { stop() { ev.remove(); g.destroy(); } };
    },

    /**
     * RITE — the channel, and its interruption.
     *
     * The rune used to be built with `scene.add.graphics()` INSIDE the move
     * data file, which is the only place in the codebase where a data module
     * drew anything. It follows the caster and returns a handle, matching
     * `forceVortex`, so the move parks it on `h` and stops it in impact and in
     * onCancel.
     */
    summonRune(owner, radius = 160, durationMs = 1800, color = 0xc080ff) {
      const g = scene.add.graphics().setDepth(12);
      const start = scene.time.now;
      const ev = scene.time.addEvent({
        delay: 32,
        loop: true,
        callback: () => {
          const t = Math.min(1, (scene.time.now - start) / durationMs);
          if (!owner?.active) { ev.remove(); g.destroy(); return; }
          g.clear();
          const r = 40 + (radius - 40) * t;
          g.lineStyle(2, color, 0.35 + 0.4 * t);
          g.strokeCircle(owner.x, owner.y, r);
          g.strokeCircle(owner.x, owner.y, r * 0.62);
          // Six orbiting nodes closing on the caster as the channel completes:
          // the READING is "this finishes soon", which is what makes shooting
          // it the right answer rather than a guess.
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + t * 3.2;
            const nr = r * (1 - t * 0.35);
            g.fillStyle(color, 0.5 + 0.5 * t);
            g.fillCircle(owner.x + Math.cos(a) * nr, owner.y + Math.sin(a) * nr, 3 + 2 * t);
          }
        },
      });
      return { stop() { ev.remove(); g.destroy(); } };
    },

    /** The rite broken. Deliberately loud — interrupting one is an achievement. */
    riteShatter(x, y, color = 0xc080ff) {
      const g = scene.add.graphics().setDepth(24).setBlendMode(Phaser.BlendModes.ADD);
      g.lineStyle(4, color, 0.9);
      g.strokeCircle(0, 0, 70);
      g.setPosition(x, y);
      scene.tweens.add({
        targets: g, scale: 1.9, alpha: 0,
        duration: 380, ease: 'Expo.easeOut',
        onComplete: () => g.destroy(),
      });
      // Shards flying outward on the diagonal, so it reads as glass, not a ring.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.4;
        this.burstDir(x + Math.cos(a) * 34, y + Math.sin(a) * 34, 'white', 3, a, 24);
      }
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
