// Between-room upgrade picks. Each `apply` mutates only Player *instance*
// fields (never the shared PLAYER config), so effects are per-run and reset
// for free whenever a new Player is created (run restart).

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
];

// Returns 3 distinct random upgrades (Fisher-Yates partial shuffle).
export function pickThree() {
  const pool = UPGRADES.slice();
  const out = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
