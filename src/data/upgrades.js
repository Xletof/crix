// Between-room upgrade picks. Each `apply` mutates only Player *instance*
// fields (never the shared PLAYER config), so effects are per-run and reset
// for free whenever a new Player is created (run restart).
//
// The first eight cards are flat stat bumps — +25% damage, +200 HP. Three of
// eight are drawn per room across four rooms, so a run used to see most of the
// pool and every run ended up in roughly the same place. Nothing below
// replaces them; the point is that they are no longer the whole menu.
//
// Cards further down are TRADE-OFFS and SYNERGIES: they cost something, or
// they scale with what you have already taken (via `p._upgrades`, which
// UpgradeScene has always recorded but nothing ever read). Both kinds make the
// pick a decision instead of an increment, and neither needs new combat code —
// they move the same instance fields the originals do. The exception is
// `killHeal`, which adds one field with a single consumption point in
// GameScene's enemy-death handler.

// ── Diminishing returns on a repeated card ────────────────────────────────
//
// `pickThree` falls back to the FULL pool once fewer than three cards are
// untaken, so past ~sector 13 every offer can repeat a card already held — and
// `apply` had no idea it was running a second time. The multipliers simply
// stacked.
//
// Measured, with the harness driving the real pick path: a run reaching Vader
// #6 has cleared 29 rooms and taken GLASS CANNON five times, MOMENTUM three
// times and LAST RESORT twice, for a dmgMult of **1240x**. The ladder read
// 1.7 / 2.6 / 14 / 51 / 729 / 1240 across the six encounters. No boss hp pool
// survives that, and it is why Vader's fight length could not be tuned: the
// number being tuned against was not the boss.
//
// The fix is a SCALE passed into `apply`. Every effect below is written as a
// magnitude — `1 + 0.25 * s` rather than `*= 1.25` — so the nth take of a card
// applies a decayed share of it. `s` falls 1 -> 0.3 -> 0.09 -> ... and then
// rests on a floor, which is the part that matters for an endless run: a
// pure geometric decay CONVERGES, so upgrades would stop meaning anything
// after ~sector 20, and trading an explosion for a cliff is not a fix. With
// the floor, growth continues forever and slowly.
//
// Measured result of these three constants: 1.7 / 2.6 / 4.7 / 9.3 / 13.4 /
// 14.5 across encounters 1-6, reaching 22.5 by sector 44 and 25.0 by sector
// 59. Roughly 8x growth over the six Vader fights, which is a power curve a
// boss hp ladder can actually be matched to.
export const STACK_DECAY = 0.3;
export const STACK_FLOOR = 0.12;

// MOMENTUM reads the size of the whole build, so it explodes on its own even
// taken once: at 20 cards held it was x3.05. Capped at the count where it is
// still a strong synergy card rather than a runaway one.
export const MOMENTUM_CAP = 4;

/**
 * How much of a card's effect this take is worth.
 *
 * @param taken  the run's picked ids, in order (player._upgrades)
 * @param id     the card about to be applied
 */
export function stackScale(taken = [], id) {
  const held = taken.reduce((n, x) => n + (x === id ? 1 : 0), 0);
  return Math.max(STACK_FLOOR, Math.pow(STACK_DECAY, held));
}

export const UPGRADES = [
  {
    id: 'heavyRounds',
    name: 'HEAVY ROUNDS',
    desc: '+25% weapon damage',
    color: '#ff5030',
    apply(p, s = 1) { p.dmgMult *= 1 + 0.25 * s; },
  },
  {
    id: 'rapidLoader',
    name: 'RAPID LOADER',
    desc: '-25% reload time',
    color: '#40c0ff',
    apply(p, s = 1) { p.reloadMult *= 1 - 0.25 * s; },
  },
  {
    id: 'lightFrame',
    name: 'LIGHT FRAME',
    desc: '+12% move speed',
    color: '#40ff90',
    apply(p, s = 1) { p.moveMult *= 1 + 0.12 * s; },
  },
  {
    id: 'extraThruster',
    name: 'EXTRA THRUSTER',
    desc: '+1 dash charge',
    color: '#ffd040',
    // A charge is a COUNT, so it cannot be fractional. Rounding the scale
    // means the first take grants it and repeats grant nothing, which is the
    // right answer for an effect that has no meaningful half.
    apply(p, s = 1) { p.dashChargesBonus += Math.round(s); },
  },
  {
    id: 'quickCharge',
    name: 'QUICK CHARGE',
    desc: '-25% dash recharge time',
    color: '#ffd040',
    apply(p, s = 1) { p.dashRechargeMult *= 1 - 0.25 * s; },
  },
  {
    id: 'overcharge',
    name: 'OVERCHARGE',
    desc: '+30% super meter gain',
    color: '#ff4040',
    apply(p, s = 1) { p.superGainMult *= 1 + 0.30 * s; },
  },
  {
    id: 'armorPlating',
    name: 'ARMOR PLATING',
    desc: '+200 max HP',
    color: '#90d8ff',
    apply(p, s = 1) { const g = Math.round(200 * s); p.hpMax += g; p.hp += g; },
  },
  {
    id: 'fieldMedic',
    name: 'FIELD MEDIC',
    desc: '+50% HP regen rate',
    color: '#1898e8',
    apply(p, s = 1) { p.regenMult *= 1 + 0.50 * s; },
  },

  // ── Trade-offs ─────────────────────────────────────────────────────────
  // Each gives more than a flat card and takes something real. These are what
  // make two runs diverge.
  {
    id: 'glassCannon',
    name: 'GLASS CANNON',
    desc: '+70% damage, -30% max HP',
    color: '#ff2020',
    apply(p, s = 1) {
      p.dmgMult *= 1 + 0.70 * s;
      const lost = Math.round(p.hpMax * 0.3 * s);
      p.hpMax -= lost;
      p.hp = Math.max(1, Math.min(p.hp, p.hpMax));
    },
  },
  {
    id: 'siegeStance',
    name: 'SIEGE STANCE',
    desc: '+45% damage, -20% move speed',
    color: '#ff8020',
    apply(p, s = 1) { p.dmgMult *= 1 + 0.45 * s; p.moveMult *= 1 - 0.20 * s; },
  },
  {
    id: 'lightweightRig',
    name: 'LIGHTWEIGHT RIG',
    desc: '+30% move speed, +1 dash, -15% damage',
    color: '#40ff90',
    apply(p, s = 1) {
      p.moveMult *= 1 + 0.30 * s;
      p.dashChargesBonus += Math.round(s);
      p.dmgMult *= 1 - 0.15 * s;
    },
  },
  {
    id: 'hairTrigger',
    name: 'HAIR TRIGGER',
    desc: '-45% reload, -25% max HP',
    color: '#40c0ff',
    apply(p, s = 1) {
      p.reloadMult *= 1 - 0.45 * s;
      const lost = Math.round(p.hpMax * 0.25 * s);
      p.hpMax -= lost;
      p.hp = Math.max(1, Math.min(p.hp, p.hpMax));
    },
  },

  // ── Synergies ──────────────────────────────────────────────────────────
  // Scale with the build so far. `p._upgrades` holds the ids already taken;
  // it is recorded in UpgradeScene._pick and, until these cards, was never read.
  {
    id: 'momentum',
    name: 'MOMENTUM',
    desc: '+15% damage, and +10% more per upgrade already taken',
    color: '#ffd040',
    apply(p, s = 1) {
      // The base 15% is not decoration. Without it this card is literally
      // nothing when offered in room 1, where _upgrades is still empty — a
      // trap that reads as a buff and does zero. Every card has to be worth
      // taking at the moment it is shown.
      const n = Math.min((p._upgrades || []).length, MOMENTUM_CAP);
      p.dmgMult *= 1 + (0.15 + 0.10 * n) * s;
    },
  },
  {
    id: 'lastResort',
    name: 'LAST RESORT',
    desc: 'The lower your max HP, the more damage you deal',
    color: '#e01818',
    apply(p, s = 1) {
      // Pays out for having taken the HP-shedding trade-offs and is weakest if
      // you have been stacking armour — but never zero, for the same reason as
      // MOMENTUM above: at base hpMax the old formula multiplied by exactly 1.
      const ratio = Math.max(0.3, Math.min(1.6, p.hpMax / 1000));
      p.dmgMult *= 1 + Math.max(0.10, (1.6 - ratio) * 0.5) * s;
    },
  },
  {
    id: 'killHeal',
    name: 'BLOOD PACT',
    desc: 'Kills restore HP, or shield when already full',
    color: '#ff4060',
    // The one card here that needs new consumption code: GameScene's
    // enemy-death handler reads killHeal. Kept to a single site on purpose.
    apply(p, s = 1) { p.killHeal = (p.killHeal || 0) + 45 * s; },
  },
];

// Returns 3 distinct random upgrades (Fisher-Yates partial shuffle).
//
// `taken` is the run's already-picked ids (player._upgrades). Offering a card
// twice was possible before: UpgradeScene recorded every pick and the picker
// never consulted the list, so a four-room run could be shown the same +25%
// damage card three times. Falls back to the full pool if filtering would
// leave fewer than three, so a long endless run still gets a full offer rather
// than an empty screen.
export function pickThree(taken = []) {
  const takenSet = new Set(taken);
  let pool = UPGRADES.filter((u) => !takenSet.has(u.id));
  if (pool.length < 3) pool = UPGRADES.slice();
  const out = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
