// ── ENCOUNTER COMPOSITION ───────────────────────────────────────────────────
//
// THE PROBLEM THIS EXISTS FOR: the rooms look different and fight the same.
// A wave was `count / maxAlive / spawnRate` plus five CUMULATIVE PROBABILITY
// mix fields, and those mixes are near-identical across all four arenas —
// `shooterMix` is 0.24-0.28 in every one of them, `bomberMix` is 0.15 in
// three, `swarmlingMix` 0.10-0.15 in all four. So every ordinary wave in the
// game resolved to the same soup, and the only thing that changed between
// sector 2 and sector 14 was the coefficients on top of it.
//
// THIS IS A DATA TABLE, NOT A FRAMEWORK. There is no parser, no callback, no
// event language and no director. An encounter is four ideas:
//
//   lead   an ORDERED, GUARANTEED opening. This is the whole difference
//          between composition and a re-weighted mix: PHALANX puts shields
//          down FIRST and the guns behind them, and it does that every time.
//   fill   the pool the rest of the budget draws from, uniformly. Weighting is
//          expressed by REPEATING an id — deliberately, so there is no second
//          syntax for weights and no numbers to keep in sync with the list.
//   gate   the spatial relationship. One direction, two opposed, or all of
//          them. The approved arenas have real geometry; this is the field
//          that lets an encounter use it.
//   press  count / maxAlive / cadence as one relationship. SNIPER NEST is few
//          and slow on purpose; SWARM TIDE is fewer EVENTS because each one is
//          a pack of 4-6 bodies.
//
// If this ever needs a callback, a condition, a nested rule or a mini-language,
// it has failed its brief and the answer is to stop, not to grow a grammar.
//
// READABILITY IS AUTHORED HERE, NOT ASSERTED IN A TEST. This is a portrait
// phone game and the failure mode of "composition" is projectile soup, so the
// pools below encode three deliberate exclusions:
//
//   - NO sniper alongside bomber. A sniper's 800ms windup + 260ms locked beam
//     and a bomber's 155px blast are two different urgent reads; together they
//     are one unreadable screen.
//   - NO sniper in SWARM TIDE. A locked beam through a moving pack cannot be
//     seen, and the pack is already the thing you are watching.
//   - SWARM TIDE and the dense sets run LOWER maxAlive, not higher. A
//     swarmling spawn EVENT is a pack of `packMin..packMax`, and the drip's
//     `living < maxAlive` gate is checked BEFORE the pack lands, so a tide
//     authored at high maxAlive overshoots it by a whole pack.
//
// None of that is a smoke-test assertion, because none of it is objective.

/** Every enemy id an encounter may name. Nothing here invents a new archetype. */
export const ENCOUNTER_TYPES = ['grunt', 'shooter', 'bomber', 'shielded', 'sniper', 'swarmling'];

/** Legal `gate` values. Resolved by `pickGates` below. */
export const GATE_MODES = ['any', 'single', 'split', 'spread'];

// ── The archetypes ──────────────────────────────────────────────────────────
//
// Six identities, all built from the six enemies that already exist. Every one
// of them had to answer "what does the PLAYER do differently here?" before it
// was allowed in — an entry whose only answer was "there are more of X" is a
// renamed probability mix and is exactly what this pass was written against.
export const ENCOUNTERS = {
  // The baseline, and deliberately the CURRENT behaviour: no lead, no pool,
  // the room's own cumulative mix and the ordinary far-gate picker. It exists
  // so an authored plan can still say "this one is the normal fight" — an
  // early wave that teaches the room before it starts asking questions — and
  // so the A/B has a control that is literally the old code path.
  mixed: {
    id: 'mixed',
    name: 'MIXED ASSAULT',
    ask: 'the general fight — the room, without a thesis',
    lead: [],
    fill: null,               // null => fall through to the room's mix roll
    gate: 'any',
    countMult: 1, maxAliveMult: 1, spawnRateMult: 1,
  },

  // A FACING. Shields lead, guns arrive behind them, all from one direction.
  // The shielded turn rate is 2.6 rad/s against a 240ms dash, so the answer is
  // to flank or to dash through — which is only a decision at all if the line
  // actually has a front, and it only has a front if it comes from one gate.
  // Slower cadence and a lower cap because a shield wall's pressure is
  // POSITIONAL: more of them at once just occludes the room.
  vanguard: {
    id: 'vanguard',
    name: 'VANGUARD',
    ask: 'break the facing, or go around it',
    lead: ['shielded', 'shielded', 'shooter', 'shielded', 'shooter'],
    fill: ['shielded', 'shooter', 'shooter', 'grunt'],
    gate: 'single',
    countMult: 0.85, maxAliveMult: 0.75, spawnRateMult: 1.20,
  },

  // OPEN GROUND COSTS SOMETHING. Two snipers guaranteed in the opening, spread
  // across every gate so there is no single bearing to hide from, and grunt
  // bodies to stop it becoming a static stand-off. Low density and a slow
  // clock on purpose: this is the one composition whose whole content is the
  // decision to cross, and volume would delete that decision.
  // No bombers — see the exclusions above.
  //
  // NO SHOOTERS EITHER, and that was the structural test's second catch. With
  // `shooter` in the pool a low-sniper roll came out as grunts-and-shooters,
  // which is CROSSFIRE — the two scored 0.17 separation, close enough to be
  // the same wave wearing two names. The shooter was also doing the sniper's
  // job badly: it holds 380px and fires fast, so it occupies the same "ranged
  // threat at distance" slot while adding none of the commitment a sniper's
  // 800ms windup asks for. Snipers and bodies only. The grunt weight is what
  // keeps roughly two snipers alive at once against the 0.60 cap rather than
  // four, which is the readability half of the same decision.
  sniperNest: {
    id: 'sniperNest',
    name: 'SNIPER NEST',
    ask: 'crossing the open floor is now a decision',
    lead: ['sniper', 'grunt', 'sniper', 'grunt'],
    fill: ['grunt', 'grunt', 'grunt', 'sniper'],
    gate: 'spread',
    countMult: 0.80, maxAliveMult: 0.60, spawnRateMult: 1.35,
  },

  // BODY PRESSURE. Swarmlings arrive as packs, so the count is small and the
  // cap is the smallest in the table — the volume is already in the pack size.
  // Grunts keep it from being one texture. The verb is spacing: keep moving,
  // spend a dash, do not let it close. Nothing ranged and nothing with a
  // telegraph, because the pack IS the read.
  swarmTide: {
    id: 'swarmTide',
    name: 'SWARM TIDE',
    ask: 'make space and keep it',
    lead: ['swarmling', 'swarmling', 'grunt'],
    fill: ['swarmling', 'grunt', 'grunt'],
    gate: 'split',
    countMult: 0.60, maxAliveMult: 0.55, spawnRateMult: 1.25,
  },

  // AREA DENIAL. Bombers from one bearing, so the floor they are taking away
  // is a direction and not a fog. The verb is displacement — the blast is
  // 155px for 240, which is a real punish for standing still and survivable
  // once, so being pushed off ground is the cost rather than the death.
  // No snipers: two urgent reads at once is soup.
  bomberRun: {
    id: 'bomberRun',
    name: 'BOMBER RUN',
    ask: 'the floor is being taken away from you',
    lead: ['bomber', 'bomber', 'grunt', 'bomber'],
    fill: ['bomber', 'grunt', 'grunt', 'shooter'],
    gate: 'single',
    countMult: 0.90, maxAliveMult: 0.70, spawnRateMult: 1.10,
  },

  // NO SAFE FACING. Ranged threats from the two most OPPOSED gates the room
  // has, alternating. This is the one archetype that is meaningless without
  // the geometry: the same enemies from one gate is just a firing line, and
  // from every gate at once is noise. Two bearings is a question — break line
  // of sight on one and you have given your back to the other, so the answer
  // is to close, or to use cover that only exists in some of these rooms.
  //
  // NO SNIPERS, and the structural test is what found that. The pool was
  // ['shooter','shooter','grunt','sniper'] and it failed the renamed-soup
  // check against SNIPER NEST at 0.17 separation — the two were resolving to
  // nearly the same wave under different names. It was also the readability
  // trap in the header arriving from the other direction: a 12-event roll put
  // FOUR snipers on detention's escort floor, which is a room with no cover at
  // all. The distinction that survives is cleaner than the one that failed:
  // CROSSFIRE is SHOOTERS from two bearings, SNIPER NEST is SNIPERS from every
  // bearing. The bearing is the content here; the sniper was borrowed identity.
  crossfire: {
    id: 'crossfire',
    name: 'CROSSFIRE',
    ask: 'there is no direction that is safe',
    lead: ['shooter', 'shooter', 'shooter', 'shooter'],
    fill: ['shooter', 'shooter', 'grunt', 'grunt'],
    gate: 'split',
    countMult: 0.85, maxAliveMult: 0.65, spawnRateMult: 1.25,
  },
};

// ── The plan: which arena asks which question, and when ─────────────────────
//
// PER-ARENA BY GEOMETRY, not by a shared distribution. The four arenas are
// frozen and genuinely different spaces, and the whole point of this pass is
// that the space should change the question:
//
//   HANGAR (1600x1400, west spawn -> east exit, open operational deck with
//   cargo cover, two of its three gates on the EAST wall you are walking
//   toward). An open deck with room to kite is where displacement and body
//   pressure read best — BOMBER RUN and SWARM TIDE. A shield line advancing
//   across open floor is legible here too.
//
//   REACTOR JUNCTION (1400x1400, the only square room, objective dead centre,
//   three feeders on three different walls, 160px lanes between cover). Its
//   west and east gates are diametrically opposed THROUGH the crossing, so
//   CROSSFIRE is the composition this room was already shaped for — you
//   cannot hold the middle against both. A VANGUARD down one feeder lane is
//   its other native question.
//
//   DETENTION (1600x1400, `walls` completely EMPTY, a long exposed escort
//   floor from a west intake to an east processing gate, north and south gates
//   directly opposed across the middle of that walk). The room has no solid
//   structure at all and its own design note calls it a floor you are meant to
//   be visible while crossing. SNIPER NEST is the literal statement of that,
//   and CROSSFIRE off the opposed N/S gates is the second.
//
// Indexed by `waveIdx % list.length`, so a room is a SEQUENCE of different
// fights rather than one fight repeated, and so the same room at the same band
// is reproducible — a handset verdict has to be about a fight the player can
// go back and meet again.
//
// THE BOSS ROOM IS ABSENT ON PURPOSE. `vader` has no entry, so `encounterFor`
// returns null there and the boss room's two escort waves run exactly the code
// they run today. Same for the detention duel wave, which is refused by the
// caller — `_beginDuel` spends the whole budget up front and a composition
// would have nothing to compose.
//
// BANDS ARE THE PROGRESSION AXIS, and they are deliberately three literals
// rather than a director. Early teaches clean single-idea fights; mid drops
// the baseline and starts combining; late keeps only the demanding sets. The
// existing sector scaling is untouched and still runs underneath all of it.
export const BANDS = [
  { id: 'early', upTo: 4 },
  { id: 'mid', upTo: 12 },
  { id: 'late', upTo: Infinity },
];

export const ENCOUNTER_PLAN = {
  hangar: {
    early: ['mixed', 'swarmTide', 'bomberRun'],
    mid: ['bomberRun', 'vanguard', 'swarmTide'],
    late: ['vanguard', 'bomberRun', 'crossfire'],
  },
  // id `corridor` is the REACTOR JUNCTION — the name is historical.
  corridor: {
    early: ['crossfire', 'mixed', 'vanguard'],
    mid: ['crossfire', 'vanguard', 'swarmTide'],
    late: ['vanguard', 'crossfire', 'sniperNest'],
  },
  detention: {
    early: ['sniperNest', 'mixed', 'crossfire'],
    mid: ['sniperNest', 'crossfire', 'vanguard'],
    late: ['crossfire', 'sniperNest', 'bomberRun'],
  },
};

/** The band id for a sector. Campaign always sits at sector 1, so `early`. */
export function bandFor(sector = 1) {
  const s = Math.max(1, sector | 0);
  return (BANDS.find((b) => s <= b.upTo) || BANDS[BANDS.length - 1]).id;
}

/**
 * The encounter for one wave, or null to leave the wave exactly as it was.
 *
 * Null is the honest answer for the boss room, for an unplanned arena and for
 * anything else this table has no opinion about — the caller then runs the
 * original path untouched, which is what keeps this layer removable.
 */
export function encounterFor(arenaId, waveIdx = 0, sector = 1) {
  const plan = ENCOUNTER_PLAN[arenaId];
  if (!plan) return null;
  const list = plan[bandFor(sector)];
  if (!list?.length) return null;
  return ENCOUNTERS[list[waveIdx % list.length]] || null;
}

/**
 * The full ordered spawn list for one wave: the guaranteed lead, then the
 * budget filled from the pool.
 *
 * Built ONCE at wave start rather than rolled per spawn, because "guaranteed"
 * and "ordered" are the two properties that make this composition instead of a
 * mix, and neither survives a per-spawn roll. Returns an empty array when the
 * encounter has no pool (`mixed`), which the caller reads as "use the room's
 * own roll" — the old behaviour, reached by the old code.
 */
export function buildSpawnQueue(enc, count, rng) {
  if (!enc || !enc.fill) return [];
  const n = Math.max(1, count | 0);
  const out = enc.lead.slice(0, n);
  while (out.length < n) {
    out.push(rng ? rng.pick(enc.fill) : enc.fill[out.length % enc.fill.length]);
  }
  return out;
}

/**
 * Which gates this encounter spawns from, in the order they should be used.
 *
 * A pure function of the mode and the room's own gate list so it can be tested
 * without a scene. The caller cycles the returned array and still applies the
 * existing "at least 400px from the player" safety per spawn — a single-gate
 * encounter must not be able to drop a trooper onto a player who walked over
 * to camp the door.
 *
 *   any     [] — the caller keeps its ordinary far-gate picker.
 *   single  one gate, for a directional fight that has a front.
 *   split   the two most OPPOSED gates, by the largest separation the room
 *           offers. Distance is the honest measure here: these rooms put their
 *           gates on wall centres, so the widest-separated pair is the pair
 *           that actually reads as two bearings.
 *   spread  every gate, shuffled once, cycled — no bearing to hide from.
 */
export function pickGates(mode, gates, rng) {
  if (!gates?.length || mode === 'any' || !mode) return [];
  if (mode === 'single') return [rng ? rng.pick(gates) : gates[0]];
  if (mode === 'spread') return rng ? rng.shuffle(gates) : gates.slice();
  if (mode === 'split') {
    if (gates.length < 2) return gates.slice();
    let best = [gates[0], gates[1]], bestD = -1;
    for (let i = 0; i < gates.length; i++) {
      for (let j = i + 1; j < gates.length; j++) {
        const d = Math.hypot(gates[i].x - gates[j].x, gates[i].y - gates[j].y);
        if (d > bestD) { bestD = d; best = [gates[i], gates[j]]; }
      }
    }
    return best;
  }
  return [];
}
