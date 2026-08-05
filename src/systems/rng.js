// Seeded randomness.
//
// The nemesis system, the wave composition and the boss ladder all roll dice,
// and until this existed every one of them called `Math.random()`. That made a
// whole class of things impossible:
//
//   - No encounter could be reproduced, so there was no deterministic test of a
//     SINGLE nemesis behaving correctly — only aggregate checks over hundreds of
//     rolls, which pass happily on a generator that is subtly wrong.
//   - No balance change could be A/B'd, because the "before" and "after" runs
//     were never the same fight.
//   - A player could not report a bad encounter in a way anyone could look at.
//
// It also buys shareable and daily seeds for free later.
//
// ── Independent streams are the whole design ──────────────────────────────
//
// A single generator shared by every system would make the sequences couple:
// adding one extra roll to the nemesis code would shift every wave composition
// and every drop after it, so an unrelated change would break every seeded test
// in the suite and no baseline would survive a week.
//
// `makeStreams` therefore derives a SEPARATE generator per concern from the run
// seed and the stream's name. Draws from `nemesis` cannot perturb `waves`. New
// streams can be added without disturbing the existing ones, because each is
// seeded from its own name rather than from a position in a shared sequence.
//
// ── What belongs here and what does not ───────────────────────────────────
//
// Route GAMEPLAY-AFFECTING rolls: what spawns, what traits it has, what it is
// called, what it drops. Leave COSMETIC randomness on `Math.random()` — particle
// jitter, FX scatter, the audio `vary` term. Those do not need to be
// reproducible, and routing them would flood the streams with draws that make
// the gameplay sequence depend on how many sparks happened to be on screen.

// mulberry32 — 32-bit, one multiply-xorshift round. Fast, tiny, and good enough
// for game rolls (it is not, and does not need to be, cryptographic).
export function mulberry32(a) {
  let s = a >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a. Turns a stream name into a seed offset so `nemesis` and `waves` start
// from unrelated points in the sequence rather than adjacent ones.
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A single seeded generator, with the helpers the call sites actually use.
 *
 * Deliberately mirrors the shape of what it replaces (`Math.random()`,
 * `Phaser.Math.Between`, `< chance`) so converting a call site is a rename
 * rather than a rewrite — a conversion that changes the arithmetic is a
 * conversion that changes the game.
 */
export function makeRng(seed) {
  const next = mulberry32(seed);

  return {
    seed: seed >>> 0,

    /** [0, 1) — the drop-in for Math.random(). */
    rand: next,

    /** Integer in [a, b] INCLUSIVE, matching Phaser.Math.Between. */
    between(a, b) {
      return a + Math.floor(next() * (b - a + 1));
    },

    /** Float in [a, b). */
    float(a, b) {
      return a + next() * (b - a);
    },

    /** A random element, or undefined for an empty array. */
    pick(arr) {
      return arr.length ? arr[Math.floor(next() * arr.length)] : undefined;
    },

    /** True with probability p. `chance(0)` is never, `chance(1)` is always. */
    chance(p) {
      return next() < p;
    },

    /** Fisher-Yates on a COPY — callers pass shared config arrays. */
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },

    /** `n` distinct elements. Used for trait loadouts, which must not repeat. */
    sample(arr, n) {
      return this.shuffle(arr).slice(0, Math.max(0, Math.min(n, arr.length)));
    },
  };
}

/**
 * One independent generator per named concern, all derived from one run seed.
 *
 * @param {number} runSeed
 * @param {string[]} names  e.g. ['nemesis', 'waves', 'drops', 'boss']
 * @returns {{seed:number} & Record<string, ReturnType<typeof makeRng>>}
 */
export function makeStreams(runSeed, names) {
  const seed = runSeed >>> 0;
  const out = { seed };
  for (const name of names) {
    out[name] = makeRng(hashString(`${seed}:${name}`));
  }
  return out;
}

/**
 * A fresh run seed.
 *
 * Kept short enough to read off a screen and type back in — a seed a player
 * cannot relay is a seed that cannot be used to report a bad encounter.
 */
export function newSeed() {
  return Math.floor(Math.random() * 0xffffff) >>> 0;
}

/** Render a seed as the 6-char uppercase code shown in the UI. */
export const seedToCode = (seed) =>
  (seed >>> 0).toString(36).toUpperCase().padStart(5, '0');

/** Parse a code back to a seed. Returns null when it is not a valid code. */
export function codeToSeed(code) {
  if (typeof code !== 'string') return null;
  const cleaned = code.trim().toUpperCase();
  if (!/^[0-9A-Z]{1,8}$/.test(cleaned)) return null;
  const n = parseInt(cleaned, 36);
  return Number.isFinite(n) ? n >>> 0 : null;
}
