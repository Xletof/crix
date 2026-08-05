// The nemesis system — named, varied elite enemies, generated rather than authored.
//
// The requirement was Shadow of Mordor: you should meet different enemies as you
// climb, not the same one wearing a different tint. The requirement was ALSO
// that this must not mean hand-writing a hundred encounters for a hundred
// sectors. Those two only reconcile one way: a small set of ORTHOGONAL traits
// that compose, plus a name, plus escalation in how many traits stack.
//
// Six traits taken 1, 2 or 3 at a time is 6 + 15 + 20 = 41 distinct loadouts
// before names or base archetype, and each one is a different fight rather than
// a different number. Adding a seventh trait later adds 28 more combinations for
// the cost of one object.
//
// Every trait is chosen to change HOW YOU FIGHT, and several exist specifically
// to punish the two things a player can otherwise spam:
//
//   VOLATILE   detonates on death, so standing on it to melee is a mistake
//   REGENERATOR heals steadily, so chip damage loses and burst wins
//   SUMMONER   makes ignoring it worse the longer you do
//   SWIFT      cannot be kited, so it has to be answered
//
// Traits carry `apply` for spawn-time stats and optional runtime fields the
// scene ticks (`regenPerSec`, `summonMs`) or reads on death (`volatile`). None
// of them need new AI: they ride the archetypes that already exist.

// ── Names ─────────────────────────────────────────────────────────────────
// Two pools crossed, so 24 x 18 = 432 names before the trait loadout. Enough
// that a player will rarely see the same one twice in a run, which is the whole
// point — a named enemy is remembered, an "ELITE SHOOTER" is not.
const FIRST = [
  'GRAKK', 'VOSS', 'MAULER', 'KRELL', 'THRAX', 'DURGE', 'VEX', 'RAZAK',
  'MORTH', 'SKARN', 'BRUL', 'ZAHN', 'OKKAR', 'DREK', 'HAVOK', 'NULL',
  'CARRION', 'IRONJAW', 'ASHER', 'VULK', 'GORR', 'SEVN', 'TALON', 'RUIN',
];

const EPITHET = [
  'THE UNBROKEN', 'THE PATIENT', 'BLADE-EATER', 'OF THE ASH', 'THE HOLLOW',
  'WHO WAITS', 'THE THRICE-BURNED', 'IRONCLAD', 'THE QUIET', 'OATHBREAKER',
  'THE RELENTLESS', 'OF NO NAME', 'THE FIRST', 'SCOURGE OF THE DECK',
  'THE UNLIT', 'WHO RETURNS', 'THE STARVED', 'GATEKEEPER',
];

// ── Traits ────────────────────────────────────────────────────────────────
export const TRAITS = [
  {
    id: 'armored',
    name: 'ARMORED',
    color: '#90a8c0',
    desc: 'thick plate, slow',
    apply(n) { n.hpMult *= 2.2; n.speedMult *= 0.85; },
  },
  {
    id: 'swift',
    name: 'SWIFT',
    color: '#40ff90',
    desc: 'cannot be kited',
    // Deliberately fragile. A fast, tanky enemy has no answer; a fast, fragile
    // one has to be dealt with NOW, which is a decision rather than a wall.
    apply(n) { n.speedMult *= 1.45; n.hpMult *= 0.7; },
  },
  {
    id: 'colossal',
    name: 'COLOSSAL',
    color: '#ffb020',
    desc: 'huge and heavy',
    apply(n) { n.scale *= 1.45; n.hpMult *= 1.8; n.speedMult *= 0.8; },
  },
  {
    id: 'regenerator',
    name: 'REGENERATOR',
    color: '#40ffd0',
    desc: 'heals unless burst down',
    // Beats chip damage, loses to a committed burst. Turns "plink at it while
    // backing off" — the safest possible play — into the losing one.
    apply(n) { n.hpMult *= 1.3; n.regenPerSec = 0.022; },
  },
  {
    id: 'summoner',
    name: 'SUMMONER',
    color: '#c080ff',
    desc: 'calls reinforcements',
    // Makes ignoring it strictly worse the longer you do, which is what gives a
    // named enemy priority in a crowded arena.
    apply(n) { n.hpMult *= 1.2; n.summonMs = 7000; n.summonCount = 2; },
  },
  {
    id: 'volatile',
    name: 'VOLATILE',
    color: '#ff5030',
    desc: 'detonates on death',
    // The direct answer to melee-spam: the finisher that kills it is delivered
    // from inside the blast. You can still melee it — you just have to move.
    apply(n) { n.hpMult *= 0.9; n.volatile = { radius: 190, damage: 260 }; },
  },
];

const TRAIT_BY_ID = Object.fromEntries(TRAITS.map((t) => [t.id, t]));
export const traitById = (id) => TRAIT_BY_ID[id] || null;

// Base archetypes a nemesis can be built on. All six already exist with full
// AI; the nemesis layer never writes new behaviour, it only stacks modifiers.
const BASES = ['grunt', 'shooter', 'bomber', 'shielded', 'sniper'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * How many traits a nemesis carries at a given sector.
 *
 * Capped at 3 on purpose. Beyond that the loadout stops being readable — the
 * player cannot tell which trait is doing what — and a nemesis you cannot read
 * is just an unfair one. Depth past that point comes from raw scaling and from
 * combinations the player has not seen, not from piling on more tags.
 */
export function traitCountFor(sector) {
  return Math.min(3, 1 + Math.floor(Math.max(0, sector - 1) / 6));
}

/**
 * Roll a nemesis for this sector.
 *
 * Returns a plain description — no scene, no side effects — so it can be
 * generated, inspected and tested without spawning anything.
 *
 * @param {number} sector
 * @param {object} opts  `base` and `traits` (ids) force the roll, for tests
 * @returns {{name, base, traits, hpMult, speedMult, scale, tint, regenPerSec, summonMs, summonCount, volatile}}
 */
export function rollNemesis(sector = 1, opts = {}) {
  const n = {
    name: `${pick(FIRST)} ${pick(EPITHET)}`,
    base: opts.base || pick(BASES),
    traits: [],
    hpMult: 1,
    speedMult: 1,
    scale: 1,
    regenPerSec: 0,
    summonMs: 0,
    summonCount: 0,
    volatile: null,
  };

  // Distinct traits — rolling the same one twice would double its numbers while
  // showing one tag, which reads as the generator being broken.
  const wanted = opts.traits
    ? opts.traits.map(traitById).filter(Boolean)
    : (() => {
        const pool = TRAITS.slice();
        const out = [];
        for (let i = 0; i < traitCountFor(sector) && pool.length; i++) {
          out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        }
        return out;
      })();

  for (const t of wanted) {
    n.traits.push(t.id);
    t.apply(n);
  }

  // The first trait colours the enemy, so its silhouette is readable at a
  // glance before you have read the name.
  n.tint = wanted[0]?.color || '#ff4020';

  // Sector scaling on top of the loadout. The mini-boss has to stay a step
  // above the wave it arrives in, and the wave itself is already scaling.
  n.hpMult *= 1 + Math.max(0, sector - 1) * 0.12;

  return n;
}

/** A short, readable line for the banner: "SWIFT · VOLATILE". */
export function traitLine(traits) {
  return traits.map((id) => traitById(id)?.name).filter(Boolean).join(' · ');
}
