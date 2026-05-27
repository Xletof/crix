import { WAVES } from '../config.js';
import { SFX } from './FX.js';

// Plays the wave script and signals the GameScene when each wave is clear.
// The GameScene is responsible for spawning specific enemy classes (so we don't
// have to import them here).

export class WaveManager {
  constructor(scene, spawnFn) {
    this.scene = scene;
    this.spawnFn = spawnFn;
    this.current = -1;
    this.alive = 0;
    this.bossPhase = false;
    this.done = false;
    this.intermissionMs = 1000; // tighter gap between waves (was 1800ms)
    this.between = 0;
    this.queued = [];
    this.spreadMs = 0;
    this.spawnAccum = 0;
  }

  start() {
    this.next();
  }

  next() {
    this.current += 1;
    if (this.current >= WAVES.length) {
      this.startBoss();
      return;
    }
    const wave = WAVES[this.current];
    this.queued = [];
    for (const s of wave.spawns) {
      for (let i = 0; i < s.count; i++) this.queued.push(s.type);
    }
    // Shuffle a bit
    this.queued.sort(() => Math.random() - 0.5);
    this.spreadMs = wave.spreadMs;
    this.spawnAccum = 0;
    SFX.waveStart();
    this.scene.events.emit('wave-start', this.current + 1, WAVES.length);
  }

  startBoss() {
    this.bossPhase = true;
    this.scene.events.emit('boss-start');
  }

  onEnemyDied() {
    this.alive = Math.max(0, this.alive - 1);
    if (this.alive === 0 && this.queued.length === 0 && !this.bossPhase) {
      // Wave clear → intermission → next
      this.between = this.intermissionMs;
      this.scene.events.emit('wave-clear', this.current + 1);
    }
  }

  update(delta) {
    if (this.done) return;
    if (this.bossPhase) return;
    if (this.queued.length > 0) {
      const step = this.spreadMs / Math.max(1, this.queued.length + this.alive);
      this.spawnAccum += delta;
      while (this.spawnAccum >= step && this.queued.length > 0) {
        this.spawnAccum -= step;
        const t = this.queued.shift();
        this.spawnFn(t);
        this.alive += 1;
      }
    } else if (this.alive === 0 && this.between > 0) {
      this.between -= delta;
      if (this.between <= 0) this.next();
    }
  }
}
