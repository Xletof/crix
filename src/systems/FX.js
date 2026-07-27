// FX: visual juice (damage numbers, particles, screen shake) + procedural audio
// via Web Audio API. No external sound assets needed for the vertical slice.

import Phaser from 'phaser';

let audioCtx = null;
let masterGain = null;
let compressor = null;
let musicGain = null;
let sfxGain = null;
let musicVol = 0.40;   // was 0.18 — music sat ~20dB under SFX and was inaudible
let sfxVol = 0.60;
let sfxDelay = null;   // shared feedback-delay send for SFX "tails" (combo chime)
let lowQuality = false;
let musicNodes = null;
let musicStarted = false;
let intensityGain = null;
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

    // Feedback-delay send: SFX can opt in (tone({echo})) to get a short
    // repeating tail — used by the combo chime so a kill-streak note rings out
    // instead of blipping dry. Wet path only; dry still goes straight to sfxGain.
    sfxDelay = audioCtx.createDelay(0.6);
    sfxDelay.delayTime.value = 0.16;
    const fb = audioCtx.createGain();
    fb.gain.value = 0.32;
    sfxDelay.connect(fb);
    fb.connect(sfxDelay);
    sfxDelay.connect(sfxGain);
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

function tone({ freq = 440, type = 'sine', dur = 0.12, gain = 0.4, slide = 0, delay = 0, vary = 0, echo = 0 }) {
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
  g.connect(sfxGain || masterGain);
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
  type = 'highpass', q = 0, sweepTo = 0, attack = 0, echo = 0,
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
  const g = ctx.createGain();
  if (attack > 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
  } else {
    g.gain.setValueAtTime(gain, t);
  }
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(sfxGain || masterGain);
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
function sub({ freq = 90, to = 32, dur = 0.5, gain = 0.3, delay = 0 }) {
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
  g.connect(sfxGain || masterGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
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
    hasIntensityGain: !!intensityGain,
    intensityGainValue: intensityGain ? intensityGain.gain.value : null,
    hasSfxDelay: !!sfxDelay,
    // Live node handles, so a test can hang an AnalyserNode off the SFX bus and
    // measure what the synthesis actually produces. Asserting on the parameters
    // passed to tone()/noise() would only prove the call was typed as intended;
    // the melee slam has to be verified as real sub-bass in the output.
    ctx: audioCtx,
    sfxGain,
    masterGain,
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
  // Kill-chain combo — a bright rising arpeggio (root-3rd-5th) with a noise
  // transient and an echo tail, climbing a semitone per streak step so a long
  // chain literally sings upward. Far punchier than the old two-note blip.
  comboChime(n = 2) {
    const step = Math.min(n, 12);
    const base = 523.25 * Math.pow(2, step / 12); // C5 and up
    noise({ dur: 0.025, gain: 0.10, hp: 3200 });   // crisp attack tick
    tone({ freq: base,        type: 'triangle', dur: 0.10, gain: 0.17, echo: 0.28 });
    tone({ freq: base * 1.26, type: 'triangle', dur: 0.10, gain: 0.15, delay: 0.045, echo: 0.28 });
    tone({ freq: base * 1.5,  type: 'square',   dur: 0.14, gain: 0.14, delay: 0.09,  echo: 0.34 });
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

  // Casts 1 and 2: an energy blade cutting air. The character is in the swept
  // bandpass — a static-filtered burst is a hiss, one racing 700 -> 5000Hz in
  // 90ms is a blade passing you. Cast 2 sits a fourth up so the pair reads as a
  // combo rather than the same sound twice.
  meleeSwing(stage = 1) {
    const up = stage === 2 ? 1.335 : 1;      // perfect fourth on the second cast
    // The cut: narrow band racing upward, plus a second slower pass under it.
    noise({ dur: 0.09, gain: 0.26, hp: 700 * up, sweepTo: 5000 * up,
            type: 'bandpass', q: 5.5, attack: 0.012 });
    noise({ dur: 0.16, gain: 0.10, hp: 400, sweepTo: 2200, type: 'bandpass', q: 2 });
    // The blade itself ringing — two partials, not a single pure tone.
    tone({ freq: 2400 * up, type: 'triangle', dur: 0.075, gain: 0.15,
           slide: -900, echo: 0.16 });
    tone({ freq: 3600 * up, type: 'sine', dur: 0.05, gain: 0.075,
           slide: -1400, delay: 0.012 });
    // Body, kept deliberately short and quiet: it is there to give the edge
    // something to cut against. Measured louder than the ring at first, which
    // made the swing thump rather than cut — the brief was "crisp".
    tone({ freq: 150, type: 'sawtooth', dur: 0.09, gain: 0.075, slide: -70 });
  },

  // Casts 1-2 connecting. The land was completely silent before, so a swing
  // that hit sounded exactly like one that missed.
  meleeHit() {
    noise({ dur: 0.045, gain: 0.17, hp: 2000, sweepTo: 700, type: 'bandpass', q: 1.5 });
    tone({ freq: 520, type: 'square', dur: 0.06, gain: 0.13, slide: -280, vary: 0.06 });
    tone({ freq: 110, type: 'sine', dur: 0.14, gain: 0.14, slide: -45, delay: 0.01 });
  },

  // Cast 3's ground slam — the thomp. This made no sound at all before.
  // Built bottom-up: sub drop for the chest hit, saw body for the crack, a
  // long lowpassed tail for rubble, and a late highpassed scatter for debris
  // skittering off. Music ducks under it (see the caller) because the master
  // compressor is a hard limiter and would otherwise eat the sub.
  meleeSlam() {
    sub({ freq: 95, to: 30, dur: 0.55, gain: 0.34 });
    sub({ freq: 58, to: 24, dur: 0.75, gain: 0.20, delay: 0.02 });
    tone({ freq: 140, type: 'sawtooth', dur: 0.30, gain: 0.22, slide: -95 });
    tone({ freq: 320, type: 'square', dur: 0.07, gain: 0.13, slide: -240 });
    // Impact crack: broadband transient right on the hit.
    noise({ dur: 0.07, gain: 0.24, hp: 3000, sweepTo: 600, type: 'lowpass', q: 1 });
    // Rubble: long, dark, settling.
    noise({ dur: 0.55, gain: 0.20, hp: 1400, sweepTo: 160, type: 'lowpass', q: 0.7 });
    // Debris skittering, thrown late and bright so the tail has detail.
    noise({ dur: 0.26, gain: 0.075, hp: 2600, type: 'highpass', delay: 0.11, echo: 0.2 });
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
  [55, 65.41, 82.41].forEach((f, idx) => {
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';
    o1.frequency.value = f;
    o2.frequency.value = f * 1.004;  // slight detune for thickness
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    lp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.value = 0.05 - idx * 0.008;
    o1.connect(lp); o2.connect(lp);
    lp.connect(g); g.connect(musicGain);
    o1.start(); o2.start();
    nodes.push(o1, o2);
  });

  // Shared white-noise buffer reused by the percussion hits below.
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  // --- Percussion synth (routed to musicGain so the music slider owns it) ---
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
    o.start(t); o.stop(t + 0.26);
  };
  const snare = (t) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(hp); hp.connect(g); g.connect(musicGain);
    src.start(t); src.stop(t + 0.16);
  };
  const hat = (t, open = false) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8000;
    const g = ctx.createGain();
    const dur = open ? 0.10 : 0.03;
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(hp); hp.connect(g); g.connect(musicGain);
    src.start(t); src.stop(t + dur + 0.02);
  };

  // Imperial-march bass pulse ("dun dun dun DUN da DUN") + a driving drum kit.
  const marchNotes = [110, 110, 110, 87, 131, 110, 87, 131];
  const kickSteps  = [0, 2, 4, 6];   // steady four-on-the-pulse
  const snareSteps = [2, 6];         // backbeat
  const marchDur = 0.38;
  const startMarch = (offset) => {
    marchNotes.forEach((freq, i) => {
      const t = ctx.currentTime + offset + i * marchDur;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.085, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + marchDur * 0.85);
      o.connect(g);
      g.connect(musicGain);
      o.start(t);
      o.stop(t + marchDur);
      // Drums locked to the same grid
      if (kickSteps.includes(i))  kick(t);
      if (snareSteps.includes(i)) snare(t);
      hat(t, false);                       // hat on every step
      hat(t + marchDur / 2, i % 2 === 1);  // and an off-beat hat (open on odds)
    });
  };

  let offset = 0;
  startMarch(offset);
  const loop = () => {
    if (!musicStarted) return;
    offset += marchNotes.length * marchDur;
    startMarch(offset - ctx.currentTime);
    setTimeout(loop, marchNotes.length * marchDur * 1000);
  };
  setTimeout(loop, marchNotes.length * marchDur * 1000);

  // Tension layer — a sustained detuned minor-2nd cluster (A3/A#3), silent by
  // default, that GameScene swells via setMusicIntensity() during combat and
  // calms during breathers. Now in an audible mid band (was ~3.7kHz, inaudible
  // through its lowpass). Pure gain control; stays in sync with the march loop.
  intensityGain = ctx.createGain();
  intensityGain.gain.value = 0;
  intensityGain.connect(musicGain);
  [220, 233.08].forEach((f) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    o.connect(lp);
    lp.connect(intensityGain);
    o.start();
    nodes.push(o);
  });

  musicNodes = nodes;
}

export function stopMusic() {
  if (!musicStarted) return;
  musicStarted = false;
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
  intensityGain = null;
}

// Combat-intensity dial for the music bed: 0 = calm (breather/menu), 1 = full
// tension (an active wave or the boss fight). Ramped, not stepped, so wave
// transitions swell/settle instead of snapping.
const INTENSITY_MAX = 0.12;
export function setMusicIntensity(x) {
  if (!intensityGain || !audioCtx) return;
  const t = audioCtx.currentTime;
  const target = Math.max(0, Math.min(1, x)) * INTENSITY_MAX;
  intensityGain.gain.cancelScheduledValues(t);
  intensityGain.gain.setValueAtTime(intensityGain.gain.value, t);
  intensityGain.gain.linearRampToValueAtTime(target, t + 0.4);
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

    // A fading shockwave ring visual at the impact point of a bullet
    impactRing(x, y, color = 0xffffff) {
      const g = scene.add.graphics().setDepth(25);
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

      // The glow burns off; the scar stays. Baked into the room's decal texture
      // at high alpha so the slam leaves a mark you can still read a minute
      // later, rather than vanishing with the tween.
      scene.tweens.add({
        targets: glow, alpha: 0, duration: 700, ease: 'Quad.easeIn',
        onComplete: () => glow.destroy(),
      });
      scene.tweens.add({
        targets: scar, alpha: 0.92, duration: 900, ease: 'Quad.easeIn',
        onComplete: () => {
          if (scene._bakeDecal) scene._bakeDecal(scar);   // destroys it
          else scar.destroy();
        },
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

      const dx = Phaser.Math.Between(-55, 55);
      const dy = Phaser.Math.Between(-85, -60);

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
