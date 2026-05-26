// FX: visual juice (damage numbers, particles, screen shake) + procedural audio
// via Web Audio API. No external sound assets needed for the vertical slice.

let audioCtx = null;
let masterGain = null;
let musicGain = null;
let musicNodes = null;
let musicStarted = false;

export function initAudio() {
  // Lazy-create on first user gesture (browsers require it).
  const create = () => {
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(audioCtx.destination);
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.18;
    musicGain.connect(masterGain);
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

function tone({ freq = 440, type = 'sine', dur = 0.12, gain = 0.4, slide = 0, delay = 0 }) {
  const ctx = ensureCtx();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(masterGain);
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
  g.connect(masterGain);
  src.start(t);
}

export const SFX = {
  shoot() {
    tone({ freq: 880, type: 'square', dur: 0.08, gain: 0.18, slide: -300 });
    noise({ dur: 0.06, gain: 0.12, hp: 1200 });
  },
  shootSuper() {
    tone({ freq: 320, type: 'sawtooth', dur: 0.22, gain: 0.3, slide: -120 });
    tone({ freq: 640, type: 'square', dur: 0.18, gain: 0.18, slide: -260, delay: 0.02 });
    noise({ dur: 0.2, gain: 0.2, hp: 400 });
  },
  enemyShoot() {
    tone({ freq: 520, type: 'triangle', dur: 0.1, gain: 0.14, slide: -200 });
  },
  hit() {
    noise({ dur: 0.08, gain: 0.2, hp: 800 });
    tone({ freq: 220, type: 'square', dur: 0.05, gain: 0.18 });
  },
  hurt() {
    tone({ freq: 200, type: 'sawtooth', dur: 0.18, gain: 0.25, slide: -120 });
    noise({ dur: 0.12, gain: 0.18, hp: 200 });
  },
  enemyDie() {
    tone({ freq: 440, type: 'square', dur: 0.18, gain: 0.2, slide: -300 });
    noise({ dur: 0.12, gain: 0.15, hp: 200 });
  },
  bossHit() {
    noise({ dur: 0.18, gain: 0.3, hp: 200 });
    tone({ freq: 110, type: 'square', dur: 0.18, gain: 0.3, slide: -40 });
  },
  bossDie() {
    tone({ freq: 220, type: 'square', dur: 0.6, gain: 0.35, slide: -180 });
    noise({ dur: 0.6, gain: 0.3, hp: 60 });
    tone({ freq: 110, type: 'sawtooth', dur: 0.9, gain: 0.3, slide: -50, delay: 0.2 });
  },
  bossRoar() {
    tone({ freq: 160, type: 'sawtooth', dur: 0.45, gain: 0.32, slide: -70 });
    noise({ dur: 0.45, gain: 0.22, hp: 80 });
  },
  superReady() {
    tone({ freq: 740, type: 'triangle', dur: 0.12, gain: 0.25 });
    tone({ freq: 990, type: 'triangle', dur: 0.12, gain: 0.22, delay: 0.1 });
    tone({ freq: 1320, type: 'triangle', dur: 0.18, gain: 0.22, delay: 0.2 });
  },
  uiClick() {
    tone({ freq: 660, type: 'square', dur: 0.05, gain: 0.18 });
  },
  victory() {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone({ freq: f, type: 'triangle', dur: 0.18, gain: 0.28, delay: i * 0.12 })
    );
  },
  defeat() {
    [392, 330, 262, 196].forEach((f, i) =>
      tone({ freq: f, type: 'sawtooth', dur: 0.22, gain: 0.28, delay: i * 0.14 })
    );
  },
  waveStart() {
    tone({ freq: 440, type: 'square', dur: 0.08, gain: 0.22 });
    tone({ freq: 660, type: 'square', dur: 0.12, gain: 0.22, delay: 0.1 });
  },
};

// --- background music: a simple looping pad+arp ---
export function startMusic() {
  if (musicStarted) return;
  const ctx = ensureCtx();
  if (!ctx) return;
  musicStarted = true;
  const baseNotes = [55, 62, 65, 67]; // A minor-ish
  const arp = [220, 261, 329, 392, 329, 261];
  const nodes = [];
  // Pad: two detuned saws low-passed
  baseNotes.forEach((midiOffset, idx) => {
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';
    const f = 110 * Math.pow(2, idx * 0.05);
    o1.frequency.value = f;
    o2.frequency.value = f * 1.005;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.value = 0.04;
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    g.connect(musicGain);
    o1.start();
    o2.start();
    nodes.push(o1, o2);
  });
  // Arp
  const tempo = 0.25;
  const startArp = (offset) => {
    arp.forEach((freq, i) => {
      const t = ctx.currentTime + offset + i * tempo;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + tempo * 0.9);
      o.connect(g);
      g.connect(musicGain);
      o.start(t);
      o.stop(t + tempo);
    });
  };
  let offset = 0;
  startArp(offset);
  const loop = () => {
    if (!musicStarted) return;
    offset += arp.length * tempo;
    startArp(offset - ctx.currentTime);
    setTimeout(loop, arp.length * tempo * 1000);
  };
  setTimeout(loop, arp.length * tempo * 1000);
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
}

export function duckMusic(amount = 0.5, restoreInMs = 600) {
  if (!musicGain || !audioCtx) return;
  const t = audioCtx.currentTime;
  musicGain.gain.cancelScheduledValues(t);
  musicGain.gain.setValueAtTime(musicGain.gain.value, t);
  musicGain.gain.linearRampToValueAtTime(0.18 * (1 - amount), t + 0.05);
  musicGain.gain.linearRampToValueAtTime(0.18, t + 0.05 + restoreInMs / 1000);
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

    burst(x, y, color = 'yellow', count = 12) {
      const e =
        color === 'red'
          ? this.sparksRed
          : color === 'yellow'
            ? this.sparksYellow
            : this.sparks;
      e.emitParticleAt(x, y, count);
    },

    muzzleFlash(x, y, angle) {
      const m = scene.add.image(x, y, 'muzzle').setDepth(10);
      m.setRotation(angle);
      m.setScale(0.6);
      scene.tweens.add({
        targets: m,
        scale: 0,
        alpha: 0,
        duration: 90,
        onComplete: () => m.destroy(),
      });
    },

    damageNumber(x, y, amount, color = '#ffffff', big = false) {
      const t = scene.add
        .text(x, y, String(amount), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: big ? '28px' : '20px',
          fontStyle: 'bold',
          color,
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(30);
      scene.tweens.add({
        targets: t,
        y: y - 40,
        alpha: 0,
        duration: 650,
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
  };
  return fx;
}
