// End-of-run rank, D through S.
//
// Score alone tells you a number; a rank tells you whether that number was any
// good. That is the whole job here — giving the player a target ("I want an S")
// rather than a readout they have to invent their own standard for.
//
// Thresholds are PER MODE, and that is not cosmetic. A campaign run is a fixed
// length — four rooms, twelve waves, one Vader — so score there really is a
// measure of how well you played it. Endless has no end, so its score is part
// skill and part how long you lasted, and it climbs far past anything the
// campaign can reach. One shared table would hand out S ranks in endless for a
// mediocre run while making S in the campaign impossible.
//
// The campaign numbers are anchored on what a complete run actually pays out:
// roughly 150 enemies, twelve sets of wave bonuses, four arena clears, the
// terminals, and 25,000 for Vader — which lands a solid run near 90k. B is set
// just below that, so "finished it competently" reads as B and A and S require
// chaining kills and clearing fast rather than merely surviving.

export const RANKS = [
  { id: 'S', name: 'S', color: '#ffd040', blurb: 'FLAWLESS EXECUTION' },
  { id: 'A', name: 'A', color: '#40ff90', blurb: 'EXPERT' },
  { id: 'B', name: 'B', color: '#40c0ff', blurb: 'SOLID' },
  { id: 'C', name: 'C', color: '#c8d8e0', blurb: 'SERVICEABLE' },
  { id: 'D', name: 'D', color: '#ff8040', blurb: 'ROUGH' },
];

export const RANK_THRESHOLDS = {
  campaign: { S: 130000, A: 95000, B: 70000, C: 40000, D: 0 },
  endless:  { S: 350000, A: 220000, B: 120000, C: 60000, D: 0 },
};

/**
 * The rank a score earns in a given mode.
 *
 * Always returns a rank — there is no "no rank". A player who died in the first
 * room still gets a D, because a blank where the grade should be reads as the
 * screen being broken rather than as a judgement.
 *
 * @param {number} score
 * @param {string} mode  'campaign' | 'endless'
 * @returns {{id:string,name:string,color:string,blurb:string,next:?{id:string,at:number}}}
 */
export function rankFor(score, mode = 'campaign') {
  const table = RANK_THRESHOLDS[mode] || RANK_THRESHOLDS.campaign;
  const s = Math.max(0, score || 0);
  const earned = RANKS.find((r) => s >= (table[r.id] ?? Infinity)) || RANKS[RANKS.length - 1];
  // What the next rank up costs, so the summary can say how close you were.
  // Undefined at S, which is the top — there is nothing to chase past it.
  const idx = RANKS.indexOf(earned);
  const nextRank = idx > 0 ? RANKS[idx - 1] : null;
  return {
    ...earned,
    next: nextRank ? { id: nextRank.id, at: table[nextRank.id] } : null,
  };
}
