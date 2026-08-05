// The nemesis ledger — who got away, what it cost them, and who took their place.
//
// The generator in `nemesis.js` gives VARIETY: 41 trait loadouts crossed with
// 432 names, so no two sectors bring the same fight. What it cannot give is
// CONTINUITY. Every roll is independent, so the enemy that nearly killed you in
// sector 4 has no more claim on sector 7 than a name drawn at random, and the
// player has no reason to care about any individual one. Variety without memory
// is noise: more different things, none of them yours.
//
// That is the half of Shadow of Mordor that actually does the work. Not the
// procedural orcs — the fact that one of them REMEMBERS. This file is that half.
//
// ── Why it is pure ────────────────────────────────────────────────────────
//
// Nothing here touches the scene, Phaser, or `Math.random()`. Every function
// takes the ledger plus an injected rng and returns a value. Two reasons:
//
//   - It is directly testable. A test can record an escape, advance five
//     sectors and assert that EXACT nemesis returns with the expected scar,
//     without spawning anything or fighting anyone. That is not possible for
//     logic that lives in a 4000-line scene.
//   - Seeded runs stay seeded. A single `Math.random()` in the return schedule
//     would make the climb unreproducible again, which is precisely what phase 0
//     was for.
//
// ── Why scars go back through rollNemesis ────────────────────────────────
//
// `nemesisFromEntry` rebuilds a returning nemesis by calling `rollNemesis` with
// its remembered base and traits, rather than storing the computed multipliers
// on the entry. Storing them would fork the stat pipeline: tuning ARMORED in
// `TRAITS` would move fresh rolls and leave every remembered nemesis on the old
// numbers, and the divergence would be invisible until someone measured it.
// One path in, one set of numbers out.

import { rollNemesis, TRAITS, traitById } from './nemesis.js';

// A 60-sector run must not grow this without bound, and a grudge you cannot
// remember is not a grudge. Eight is already more than a player will hold in
// their head; past that the oldest is evicted, which is also the one they are
// least likely to recognise.
export const LEDGER_CAP = 8;

// Per stat-only scar, for a nemesis already at the 3-trait readability cap.
// Deliberately small: the escalation a player should FEEL is the new trait, not
// a hp bar that quietly got longer. Phase 4 tunes this against the harness.
export const SCAR_HP_MULT = 1.15;

// How long a wounded nemesis takes to come back. Long enough that the return is
// a surprise rather than a rematch queue, short enough that it lands inside the
// run that earned it.
const RETURN_MIN = 2;
const RETURN_MAX = 4;

export function createLedger() {
  return { entries: [], vacancies: [], nextId: 1 };
}

/**
 * A nemesis left the sector alive.
 *
 * @param outcome 'wounded-you' when it drew blood, 'survived' when it merely
 *   outlasted you. The distinction is what the grudge line reads from.
 */
export function recordEscape(ledger, nem, sector, outcome, rng) {
  let entry = nem.ledgerId != null
    ? ledger.entries.find((e) => e.id === nem.ledgerId)
    : null;

  if (!entry) {
    entry = {
      id: ledger.nextId++,
      first: nem.first,
      epithet: nem.epithet,
      base: nem.base,
      traits: nem.traits.slice(),
      scars: [],
      firstSeenSector: sector,
      encounters: 0,
      successorOf: nem.successorOf || null,
    };
    ledger.entries.push(entry);
  }

  entry.encounters++;
  entry.lastSeenSector = sector;
  entry.lastOutcome = outcome;
  entry.returnAtSector = sector + rng.between(RETURN_MIN, RETURN_MAX);

  // Oldest first — `entries` is append-ordered, so shift() is the eviction.
  while (ledger.entries.length > LEDGER_CAP) ledger.entries.shift();

  return entry;
}

/**
 * A nemesis died.
 *
 * It leaves the ledger — a dead nemesis must never return as itself, which is
 * the one promise this system makes that a player will actually check — but it
 * leaves a VACANCY behind. Someone inherits the grudge, so killing the thing
 * that has been hunting you has a consequence beyond the loot.
 */
export function recordKill(ledger, nem, sector) {
  const i = ledger.entries.findIndex((e) => e.id === nem.ledgerId);
  const entry = i >= 0 ? ledger.entries[i] : null;
  if (i >= 0) ledger.entries.splice(i, 1);

  ledger.vacancies.push({
    first: entry?.first || nem.first,
    traits: (entry?.traits || nem.traits || []).slice(),
    sector,
  });
  return entry;
}

/** The nemesis due back at this sector, oldest grudge first, or null. */
export function dueAt(ledger, sector) {
  return ledger.entries.find((e) => e.returnAtSector != null && e.returnAtSector <= sector) || null;
}

/**
 * Mark a returning nemesis with what the last encounter did to it.
 *
 * A new trait while there is room, because that is the escalation the player can
 * SEE and read off the tag line. Once it is at the 3-trait cap — the readability
 * limit `traitCountFor` already enforces — further scars are stat-only, because
 * a fourth tag would make the loadout unreadable and an unreadable enemy reads
 * as unfair rather than as hard.
 */
export function applyScar(entry, sector, rng) {
  const available = TRAITS.filter((t) => !entry.traits.includes(t.id));
  if (entry.traits.length < 3 && available.length) {
    const t = rng.pick(available);
    entry.traits.push(t.id);
    entry.scars.push({ kind: 'trait', id: t.id, sector });
    return entry.scars[entry.scars.length - 1];
  }
  entry.scars.push({ kind: 'stat', sector });
  return entry.scars[entry.scars.length - 1];
}

/** What the banner shows. Renaming is the cheapest possible "it remembers you". */
export function displayName(entry) {
  if (entry.successorOf) return `${entry.first}, HEIR OF ${entry.successorOf}`;
  if (entry.scars.length) {
    return entry.lastOutcome === 'wounded-you'
      ? `${entry.first}, WHO BLED YOU`
      : `${entry.first}, WHO SURVIVED YOU`;
  }
  return `${entry.first} ${entry.epithet}`;
}

/** The line under the name. Keyed to what actually happened, not to a mood. */
export function grudgeLine(entry) {
  if (entry.successorOf) return `AVENGING ${entry.successorOf}`;
  const n = entry.encounters;
  if (entry.lastOutcome === 'wounded-you') {
    return n > 2 ? 'IT HAS BLED YOU BEFORE' : 'IT REMEMBERS YOUR BLOOD';
  }
  return n > 2 ? 'IT KEEPS GETTING AWAY' : 'IT GOT AWAY LAST TIME';
}

/**
 * Rebuild a spawn-ready nemesis from a ledger entry.
 *
 * Goes back through `rollNemesis` with the remembered base and traits so the
 * stats come from one pipeline — see the header note.
 */
export function nemesisFromEntry(entry, sector, rng) {
  const nem = rollNemesis(sector, { rng, base: entry.base, traits: entry.traits });

  nem.first = entry.first;
  nem.epithet = entry.epithet;
  nem.name = displayName(entry);
  nem.ledgerId = entry.id;
  nem.successorOf = entry.successorOf || null;
  nem.scars = entry.scars.length;
  nem.grudge = grudgeLine(entry);

  const statScars = entry.scars.filter((s) => s.kind === 'stat').length;
  nem.hpMult *= Math.pow(SCAR_HP_MULT, statScars);

  return nem;
}

/**
 * Fill a vacancy: an ordinary enemy is promoted to replace the one you killed.
 *
 * It inherits EXACTLY ONE trait from the fallen. That number is the bound on
 * succession drift — a chain of heirs each inheriting everything would compound
 * into something the harness never measured, while inheriting one keeps the
 * loadout inside the same 41-combination space every fresh roll draws from. The
 * 3-trait cap is the second bound.
 *
 * Returns null when the vacancy carried no traits to inherit, so the caller
 * falls back to a fresh roll rather than spawning a hollow "heir".
 */
export function promoteSuccessor(ledger, vacancy, sector, rng) {
  if (!vacancy?.traits?.length) return null;

  const inherited = rng.pick(vacancy.traits);
  const fresh = rollNemesis(sector, { rng });

  // Overwrite one of its own traits rather than appending, so an heir is never
  // wider than a fresh roll of the same sector.
  const traits = fresh.traits.slice();
  if (!traits.includes(inherited)) {
    if (traits.length) traits[rng.between(0, traits.length - 1)] = inherited;
    else traits.push(inherited);
  }

  const entry = {
    id: ledger.nextId++,
    first: fresh.first,
    epithet: fresh.epithet,
    base: fresh.base,
    traits,
    scars: [],
    firstSeenSector: sector,
    encounters: 0,
    lastOutcome: null,
    returnAtSector: null,
    successorOf: vacancy.first,
    inheritedTrait: inherited,
  };
  ledger.entries.push(entry);
  while (ledger.entries.length > LEDGER_CAP) ledger.entries.shift();

  return entry;
}

/** For the tag line and tests — the traits a nemesis carries that are scars. */
export const scarTraits = (entry) =>
  entry.scars.filter((s) => s.kind === 'trait').map((s) => traitById(s.id)).filter(Boolean);
