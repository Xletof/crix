// Music director — turns "what is happening in the room" into "how the bed
// should sound". It sits between GameScene, which knows the game, and FX.js,
// which knows synthesis, and is the only place that knows both.
//
// It imports config and FX but NEVER a scene: GameScene pushes it a plain
// snapshot object each tick. That is what lets a test drive it with synthetic
// situations instead of having to spawn a room and get itself surrounded.
//
// ── The one structural decision ────────────────────────────────────────────
//
// There are two kinds of input and they are NOT combined into one number.
//
//   PHASE is discrete and authoritative — the wave lifecycle. It says which
//   band of tiers is legal: a breather is calm, a boss is heavy, full stop.
//   HEAT is continuous — kills, crowding, how deep into the room, how close to
//   death. It only chooses WITHIN the combat band.
//
// Folding them together (a floor, or max(cue, heat)) was tried on paper and
// fails both ways round. A lifecycle floor of 1 at wave start saturates every
// other term, so nothing the player does can move the music. And a heat that
// can outvote the cue means the upgrade picker never actually goes quiet,
// because heat is still high from the wave that just ended.
import { MUSIC } from '../config.js';
import { setMusicState } from './FX.js';

const CFG = MUSIC.heat;

let heat = 0;
let phase = 'idle';     // 'idle' | 'wave' | 'breather' | 'upgrade'
let tier = 'combat';
let acc = 0;            // ms accumulator for the sample throttle

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Which tier the current phase and heat call for. Phase first — it can veto.
function tierFor() {
  if (phase !== 'wave') return 'calm';
  // Hysteresis: the threshold to climb into `hot` is higher than the one to
  // fall out of it. A single boundary would have heat hovering on it flip the
  // kit every couple of bars, which is far more noticeable than either tier.
  return tier === 'hot'
    ? (heat > CFG.hotExit ? 'hot' : 'combat')
    : (heat > CFG.hotEnter ? 'hot' : 'combat');
}

/**
 * The lifecycle cue. Called from the four points in GameScene that used to
 * call setMusicIntensity directly.
 */
export function setMusicPhase(p) {
  if (p === phase) return;
  phase = p;
  push();
}

/**
 * Feed the director the current situation. Throttled internally to
 * MUSIC.heat.sampleMs, so the caller can hand it every frame's delta without
 * thinking about it.
 *
 * snap: { combo, lastKillAge, alive, maxAlive, waveIdx, waveCount, hpFrac }
 */
export function tickDirector(delta, snap) {
  acc += delta;
  if (acc < CFG.sampleMs) return;
  const dt = acc / 1000;
  acc = 0;

  // Kill streak. _comboCount is never reset until the NEXT kill lands, so the
  // count alone says nothing about whether the streak is still live — the age
  // of the last kill is what carries that, and the director has to check it
  // itself because there is no combo-ended event to listen for.
  let stale = 0;
  if (snap.lastKillAge < CFG.comboStaleMs) stale = 1;
  else if (snap.lastKillAge < CFG.comboStaleMs + CFG.comboFadeMs) {
    stale = 1 - (snap.lastKillAge - CFG.comboStaleMs) / CFG.comboFadeMs;
  }
  const combo = clamp01((snap.combo || 0) / CFG.comboCap) * stale;

  // How full the room is, against the cap this wave was configured with —
  // maxAlive runs 8 to 14 across the campaign, so the ratio normalises itself.
  const pressure = clamp01((snap.alive || 0) / Math.max(1, snap.maxAlive || 1));

  // How deep into the room. The last wave of every room reads as 1, which is
  // what makes a room's closing wave feel like one without hardcoding "wave 3".
  const lateWave = snap.waveCount > 1
    ? clamp01(snap.waveIdx / (snap.waveCount - 1))
    : 1;

  // Ramps in before the HUD's low-HP vignette does and saturates with it.
  const danger = clamp01(
    (CFG.dangerFrom - (snap.hpFrac ?? 1)) / (CFG.dangerFrom - CFG.dangerTo),
  );

  const w = CFG.weights;
  const raw = clamp01(
    w.combo * combo + w.pressure * pressure + w.lateWave * lateWave + w.danger * danger,
  );

  const rate = raw > heat ? CFG.attackPerSec : CFG.releasePerSec;
  const step = rate * dt;
  heat += Math.max(-step, Math.min(step, raw - heat));
  heat = clamp01(heat);

  push();
}

function push() {
  const want = tierFor();
  // Heat is pushed every sample even when the tier is unchanged: it drives the
  // pad's cutoff and the intensity extras continuously, not just at a boundary.
  tier = want;
  setMusicState({ tier, heat });
}

/**
 * Back to a cold start. Must be called when the Game scene shuts down — heat
 * and phase live at module scope (so they survive a scene restart the way the
 * god-mode flag does), which means without this a restarted run would inherit
 * the tension of the one that just ended.
 */
export function resetDirector() {
  heat = 0;
  phase = 'idle';
  tier = 'combat';
  acc = 0;
}

export function __directorDebug() {
  return { heat, phase, tier };
}
