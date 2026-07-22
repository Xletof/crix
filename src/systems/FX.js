// FX: visual juice (damage numbers, particles, screen shake) + procedural audio
// via Web Audio API. No external sound assets needed for the vertical slice.

import Phaser from 'phaser';

let audioCtx = null;
let masterGain = null;
let compressor = null;
let musicGain = null;
let sfxGain = null;
let musicVol = 0.18;
let sfxVol = 0.60;
let lowQuality = false;
let musicNodes = null;
let musicStarted = false;
let intensityGain = null;
let muted = false;
const MASTER_VOL = 0.5;

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

function tone({ freq = 440, type = 'sine', dur = 0.12, gain = 0.4, slide = 0, delay = 0, vary = 0 }) {
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
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({ dur = 0.15, gain = 0.3, hp = 600, delay = 0 }) {
  const ctx = ensureCtx();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(sfxGain || masterGain);
  src.start(t);
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
  };
}

export const SFX = {
  // Mandalorian blaster — snappy high-pitched zap (Star Wars blaster feel)
  shoot() {
    tone({ freq: 1400, type: 'square', dur: 0.05, gain: 0.16, slide: -900, vary: 0.04 });
    tone({ freq: 700,  type: 'sine',   dur: 0.06, gain: 0.08, slide: -400, vary: 0.04 });
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
    tone({ freq: 900, type: 'square', dur: 0.06, gain: 0.11, slide: -600, vary: 0.04 });
    tone({ freq: 450, type: 'sine',   dur: 0.05, gain: 0.06, slide: -300, vary: 0.04 });
  },
  // Hit flash — crisp impact
  hit() {
    noise({ dur: 0.06, gain: 0.14, hp: 1400 });
    tone({ freq: 300, type: 'square', dur: 0.04, gain: 0.10, vary: 0.04 });
  },
  // Player hurt — lower, painful
  hurt() {
    tone({ freq: 220, type: 'sawtooth', dur: 0.22, gain: 0.24, slide: -100 });
    noise({ dur: 0.15, gain: 0.18, hp: 150 });
  },
  // Enemy die — trooper helmet clatter
  enemyDie() {
    tone({ freq: 500, type: 'square', dur: 0.12, gain: 0.14, slide: -350, vary: 0.04 });
    noise({ dur: 0.10, gain: 0.10, hp: 400 });
  },
  // Vader hit — heavy metallic thud
  bossHit() {
    noise({ dur: 0.22, gain: 0.30, hp: 120 });
    tone({ freq: 80, type: 'sine', dur: 0.22, gain: 0.24, slide: -30, vary: 0.04 });
    tone({ freq: 160, type: 'sawtooth', dur: 0.16, gain: 0.15, slide: -50, vary: 0.04 });
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
  // Kill-chain combo — two-note blip whose pitch climbs a semitone per streak
  // step, so chaining kills sounds as escalating as the on-screen counter looks.
  comboChime(n = 2) {
    const step = Math.min(n, 8);
    const base = 520 * Math.pow(2, step / 12);
    tone({ freq: base,       type: 'triangle', dur: 0.07, gain: 0.14 });
    tone({ freq: base * 1.5, type: 'triangle', dur: 0.09, gain: 0.12, delay: 0.05 });
  },
  // Dash whoosh — dedicated sound (was borrowing the stealth-takedown blade
  // shink before). Fast filtered-noise sweep + a falling tone for air-push.
  dash() {
    noise({ dur: 0.14, gain: 0.16, hp: 900 });
    tone({ freq: 900, type: 'sine', dur: 0.16, gain: 0.10, slide: -700 });
  },
};

// --- Background music: Imperial march-inspired dark ambient + pulse ---
export function startMusic() {
  if (musicStarted) return;
  const ctx = ensureCtx();
  if (!ctx) return;
  musicStarted = true;
  const nodes = [];

  // Low drone pad (Vader breathing rhythm feel)
  [55, 58, 62].forEach((semi, idx) => {
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';
    const f = 55 * Math.pow(2, semi / 12);
    o1.frequency.value = f;
    o2.frequency.value = f * 1.004;  // slight detune for thickness
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    lp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.value = 0.028 - idx * 0.005;
    o1.connect(lp); o2.connect(lp);
    lp.connect(g); g.connect(musicGain);
    o1.start(); o2.start();
    nodes.push(o1, o2);
  });

  // Imperial march-inspired bass pulse (4/4 pattern: strong on 1 and 3)
  // Notes: A2, A2, A2, F2, C3 (simplified "dun dun dun DUN da DUN")
  const marchNotes = [110, 110, 110, 87, 131, 110, 87, 131];
  const marchDur = 0.38;
  const startMarch = (offset) => {
    marchNotes.forEach((freq, i) => {
      const t = ctx.currentTime + offset + i * marchDur;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + marchDur * 0.85);
      o.connect(g);
      g.connect(musicGain);
      o.start(t);
      o.stop(t + marchDur);
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

  // Tension layer — a sustained detuned pad, silent by default, that
  // GameScene swells via setMusicIntensity() during active combat and calms
  // during breathers. Pure gain control; no new note scheduling, so it can't
  // drift out of sync with the march loop above.
  intensityGain = ctx.createGain();
  intensityGain.gain.value = 0;
  intensityGain.connect(musicGain);
  [73, 74].forEach((semi) => { // tense minor-2nd cluster above the drone root
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 55 * Math.pow(2, semi / 12);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
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
const INTENSITY_MAX = 0.05;
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
      scene.cameras.main.shake(duration, intensity);
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
