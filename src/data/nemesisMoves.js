// Nemesis moves — the part that makes an encounter play differently.
//
// The weapons in `nemesisWeapons.js` gave nemeses different SILHOUETTES and
// different shot patterns, and the honest verdict was that it still amounted to
// "multiple shots": a cone, a spread and a burst are all answered by strafing,
// so no weapon ever changed what the player had to DO.
//
// A move does. Each one below is a telegraph the player reads, a commit they
// have to be somewhere else for, and a recovery they can punish. The four here
// are deliberately chosen so that no two share an answer:
//
//   LEAP SLAM       lands where you ARE      -> move, any direction
//   SWEEP BEAM      sweeps where you're GOING -> dash behind it, not away
//   SHOCKWAVE RING  fills everywhere but a gap -> find the gap
//   MINE DROP       denies ground for a while -> leave before you need to
//
// "Move away" beats one of them and fails against the others. That is the whole
// design goal — if a single habit answered all four we would be back to
// multiple shots with extra steps.
//
// ── Fairness is arithmetic, not taste ─────────────────────────────────────
//
// Every zone is sized against the player's dash: 950px/s x 240ms = 228px. A
// zone whose worst-case escape exceeds that is a trap, not a challenge, and
// `smoke-moves.mjs` asserts the property directly for every move. The radii
// below are chosen with that margin in mind, not by feel.
//
// ── Why they are gated by trait ───────────────────────────────────────────
//
// A move has to suit the body performing it. LEAP SLAM on a SWIFT nemesis that
// is already on top of you is unreadable; SWEEP BEAM on a COLOSSAL one that
// cannot follow through is theatre. Gating by trait also means the marks the
// player already learned to read (pauldrons, canisters, banner) now predict
// BEHAVIOUR, which is what makes the silhouette worth reading at all.

import { DASH_REACH } from '../systems/Telegraph.js';

// Windup floor. ~250ms is human reaction; the rest is thumb travel and the fact
// that the player is usually mid-decision about something else.
const WINDUP = 800;

export const NEMESIS_MOVES = [
  {
    id: 'slam',
    name: 'LEAP SLAM',
    // Heavy bodies only.
    traits: ['armored', 'colossal', 'volatile'],
    everyMs: 7000,
    windupMs: WINDUP,
    radius: 150,          // worst-case escape 150 < 228, so one dash always clears
    damage: 180,
    /**
     * Lands where the player IS when it starts, not where they end up — the
     * whole move is "stop standing there", and a slam that tracked would be
     * undodgeable rather than hard.
     */
    telegraph(scene, e) {
      const p = scene.player;
      const tx = p.x, ty = p.y;
      return {
        shape: { kind: 'circle', x: tx, y: ty, r: this.radius },
        windupMs: this.windupMs,
      };
    },
    resolve(scene, e, tel) {
      const s = tel.shape;
      scene.fx?.groundFractures?.(s.x, s.y, s.r);
      scene.fx?.explosion?.(s.x, s.y, 1.6);
      scene.fx?.shake?.(0.02, 260);
      if (tel.contains(scene.player.x, scene.player.y)) {
        scene.player.damage(this.damage, Math.atan2(scene.player.y - s.y, scene.player.x - s.x));
      }
    },
  },

  {
    id: 'sweep',
    name: 'SWEEP BEAM',
    traits: ['swift', 'regenerator', 'summoner'],
    everyMs: 8000,
    windupMs: WINDUP,
    // 70deg x 420px FAILED the dodge contract on the first try: the worst case
    // is `sin(spread/2) * len` out the side, which came to 241px against a
    // 228px dash — undodgeable at the tip, and invisible without the check.
    // 60 x 400 gives 200px, with margin.
    spreadDeg: 60,
    len: 400,
    damage: 140,
    /**
     * Aimed where the player is HEADING, so backing straight off walks into it
     * and cutting behind the arc beats it. The lead is capped so it never
     * becomes a guess the player cannot read off the drawn cone.
     */
    telegraph(scene, e) {
      const p = scene.player;
      const vx = p.body?.velocity.x || 0, vy = p.body?.velocity.y || 0;
      const lead = 0.35;
      const aimX = p.x + vx * lead, aimY = p.y + vy * lead;
      return {
        shape: {
          kind: 'cone', x: e.x, y: e.y,
          angle: Math.atan2(aimY - e.y, aimX - e.x),
          spreadDeg: this.spreadDeg, len: this.len,
        },
        windupMs: this.windupMs,
      };
    },
    resolve(scene, e, tel) {
      const s = tel.shape;
      scene.fx?.burstDir?.(s.x, s.y, 'red', 18, s.angle, this.spreadDeg);
      scene.fx?.shake?.(0.014, 200);
      if (tel.contains(scene.player.x, scene.player.y)) {
        scene.player.damage(this.damage, s.angle);
      }
    },
  },

  {
    id: 'ring',
    name: 'SHOCKWAVE RING',
    traits: ['armored', 'colossal', 'regenerator'],
    everyMs: 9000,
    windupMs: WINDUP + 100,
    radius: 300,
    gapDeg: 90,           // generous: the gap has to be findable at a glance
    damage: 150,
    /**
     * Everything around it except one wedge. The answer is neither "move" nor
     * "dash away" — it is FIND THE GAP, which is a different verb from the
     * other three.
     *
     * Drawn as the cone you are safe in rather than the ring you are not: the
     * player is looking for somewhere to stand, so the telegraph shows the
     * somewhere. The hit test inverts it at commit.
     */
    telegraph(scene, e) {
      const p = scene.player;
      // Gap placed away from the player, so it is always a move, never free.
      const away = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI;
      return {
        shape: {
          kind: 'cone', x: e.x, y: e.y,
          angle: away, spreadDeg: this.gapDeg, len: this.radius,
        },
        windupMs: this.windupMs,
        safeZone: true,             // read by resolve, and by the fairness test
      };
    },
    resolve(scene, e, tel) {
      const s = tel.shape;
      scene.fx?.impactRing?.(e.x, e.y, 0xff4020);
      scene.fx?.shake?.(0.018, 240);
      const p = scene.player;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      // Inside the ring AND outside the safe wedge.
      if (d <= this.radius && !tel.contains(p.x, p.y)) {
        p.damage(this.damage, Math.atan2(p.y - e.y, p.x - e.x));
      }
    },
  },

  {
    id: 'mines',
    name: 'MINE DROP',
    traits: ['volatile', 'summoner', 'swift'],
    everyMs: 10000,
    windupMs: WINDUP + 400,   // longest: it is area denial, not a strike
    count: 3,
    radius: 110,
    spread: 210,
    damage: 120,
    /**
     * Three small zones around the player rather than one on them. Nothing here
     * is dodged in the moment — the answer is to not be cornered ten seconds
     * from now, which is the only move of the four that is about planning.
     *
     * The primary telegraph is the first mine; the rest are spawned by
     * `extraZones` so they share one clock and die together.
     */
    telegraph(scene, e) {
      const p = scene.player;
      return {
        shape: { kind: 'circle', x: p.x, y: p.y, r: this.radius },
        windupMs: this.windupMs,
      };
    },
    extraZones(scene, e) {
      const p = scene.player;
      const out = [];
      for (let i = 1; i < this.count; i++) {
        const a = (i / this.count) * Math.PI * 2;
        out.push({
          kind: 'circle',
          x: p.x + Math.cos(a) * this.spread,
          y: p.y + Math.sin(a) * this.spread,
          r: this.radius,
        });
      }
      return out;
    },
    resolve(scene, e, tel) {
      const s = tel.shape;
      scene.fx?.explosion?.(s.x, s.y, 1.1);
      if (tel.contains(scene.player.x, scene.player.y)) {
        scene.player.damage(this.damage, Math.atan2(scene.player.y - s.y, scene.player.x - s.x));
      }
    },
  },
];

const BY_ID = Object.fromEntries(NEMESIS_MOVES.map((m) => [m.id, m]));
export const moveById = (id) => BY_ID[id] || null;

/**
 * Two moves for a nemesis, gated by its traits.
 *
 * `rng` is injected like every other encounter decision, so a seed reproduces
 * the moveset along with the traits and the weapon.
 *
 * A nemesis with no matching trait still gets moves — an untraited one would
 * otherwise be the ONLY enemy in the game with nothing to dodge, which reads as
 * a bug rather than as a breather.
 */
export function pickMoves(traits = [], rng, count = 2) {
  let usable = NEMESIS_MOVES.filter((m) => m.traits.some((t) => traits.includes(t)));
  if (usable.length < count) {
    // Top up from the full pool rather than shipping a nemesis with one move.
    const rest = NEMESIS_MOVES.filter((m) => !usable.includes(m));
    usable = usable.concat(rng ? rng.shuffle(rest) : rest);
  }
  const picked = rng ? rng.sample(usable, count) : usable.slice(0, count);
  return picked.map((m) => m.id);
}

/** The fairness bound, exported so the test and the design share one number. */
export const FAIRNESS_REACH = DASH_REACH;
