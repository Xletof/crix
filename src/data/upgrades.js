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

export const UPGRADES = [
  {
    id: 'heavyRounds',
    name: 'HEAVY ROUNDS',
    desc: '+25% weapon damage',
    color: '#ff5030',
    apply(p) { p.dmgMult *= 1.25; },
  },
  {
    id: 'rapidLoader',
    name: 'RAPID LOADER',
    desc: '-25% reload time',
    color: '#40c0ff',
    apply(p) { p.reloadMult *= 0.75; },
  },
  {
    id: 'lightFrame',
    name: 'LIGHT FRAME',
    desc: '+12% move speed',
    color: '#40ff90',
    apply(p) { p.moveMult *= 1.12; },
  },
  {
    id: 'extraThruster',
    name: 'EXTRA THRUSTER',
    desc: '+1 dash charge',
    color: '#ffd040',
    apply(p) { p.dashChargesBonus += 1; },
  },
  {
    id: 'quickCharge',
    name: 'QUICK CHARGE',
    desc: '-25% dash recharge time',
    color: '#ffd040',
    apply(p) { p.dashRechargeMult *= 0.75; },
  },
  {
    id: 'overcharge',
    name: 'OVERCHARGE',
    desc: '+30% super meter gain',
    color: '#ff4040',
    apply(p) { p.superGainMult *= 1.3; },
  },
  {
    id: 'armorPlating',
    name: 'ARMOR PLATING',
    desc: '+200 max HP',
    color: '#90d8ff',
    apply(p) { p.hpMax += 200; p.hp += 200; },
  },
  {
    id: 'fieldMedic',
    name: 'FIELD MEDIC',
    desc: '+50% HP regen rate',
    color: '#1898e8',
    apply(p) { p.regenMult *= 1.5; },
  },

  // ── Trade-offs ─────────────────────────────────────────────────────────
  // Each gives more than a flat card and takes something real. These are what
  // make two runs diverge.
  {
    id: 'glassCannon',
    name: 'GLASS CANNON',
    desc: '+70% damage, -30% max HP',
    color: '#ff2020',
    apply(p) {
      p.dmgMult *= 1.7;
      const lost = Math.round(p.hpMax * 0.3);
      p.hpMax -= lost;
      p.hp = Math.max(1, Math.min(p.hp, p.hpMax));
    },
  },
  {
    id: 'siegeStance',
    name: 'SIEGE STANCE',
    desc: '+45% damage, -20% move speed',
    color: '#ff8020',
    apply(p) { p.dmgMult *= 1.45; p.moveMult *= 0.8; },
  },
  {
    id: 'lightweightRig',
    name: 'LIGHTWEIGHT RIG',
    desc: '+30% move speed, +1 dash, -15% damage',
    color: '#40ff90',
    apply(p) { p.moveMult *= 1.3; p.dashChargesBonus += 1; p.dmgMult *= 0.85; },
  },
  {
    id: 'hairTrigger',
    name: 'HAIR TRIGGER',
    desc: '-45% reload, -25% max HP',
    color: '#40c0ff',
    apply(p) {
      p.reloadMult *= 0.55;
      const lost = Math.round(p.hpMax * 0.25);
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
    apply(p) {
      // The base 15% is not decoration. Without it this card is literally
      // nothing when offered in room 1, where _upgrades is still empty — a
      // trap that reads as a buff and does zero. Every card has to be worth
      // taking at the moment it is shown.
      const n = (p._upgrades || []).length;
      p.dmgMult *= 1.15 + 0.10 * n;
    },
  },
  {
    id: 'lastResort',
    name: 'LAST RESORT',
    desc: 'The lower your max HP, the more damage you deal',
    color: '#e01818',
    apply(p) {
      // Pays out for having taken the HP-shedding trade-offs and is weakest if
      // you have been stacking armour — but never zero, for the same reason as
      // MOMENTUM above: at base hpMax the old formula multiplied by exactly 1.
      const ratio = Math.max(0.3, Math.min(1.6, p.hpMax / 1000));
      p.dmgMult *= 1 + Math.max(0.10, (1.6 - ratio) * 0.5);
    },
  },
  {
    id: 'killHeal',
    name: 'BLOOD PACT',
    desc: 'Kills restore HP, or shield when already full',
    color: '#ff4060',
    // The one card here that needs new consumption code: GameScene's
    // enemy-death handler reads killHeal. Kept to a single site on purpose.
    apply(p) { p.killHeal = (p.killHeal || 0) + 45; },
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
