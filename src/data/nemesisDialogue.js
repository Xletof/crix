// What the nemeses and Vader actually SAY.
//
// ── Why this exists ───────────────────────────────────────────────────────
//
// `nemesisLedger.js` already remembers everything worth speaking about: who got
// away, whether it drew blood, how many times you have met, who inherited a
// dead one's grudge. That half — the Shadow of Mordor half — has been built and
// working for a while. The payoff was a 26px medal that flew past in one second
// on the way to the next wave, and a player could not tell a nemesis that
// nearly killed them in sector 4 from a name drawn at random.
//
// The other half is Hades': the memory has to be DELIVERED BY A CHARACTER. Not
// a status line describing the ledger, but the thing itself talking to you
// about what happened. That is this file plus `DialogueScene`.
//
// ── Why a gated pool and not a switch ─────────────────────────────────────
//
// A `switch (state)` returning one string per state is what `grudgeLine` does,
// and it is right for a banner — four states, four labels, always the same. It
// is wrong for speech: the second time you hear a line word for word, the
// character stops being a character. Hades' rule is that a line is CONSUMED,
// and you do not hear it again while anything else still fits.
//
// So a line is `{ id, kind, priority, when, text }`, and `pickLine` filters by
// beat, then by `when(ctx)` against the ledger, then drops anything already
// spoken this run. `priority` lets a line that knows something specific ("you
// left me on sector four") beat the generic one. Only when a beat's whole pool
// is used up does it reset — never silence, never a repeat while an unused line
// fits.
//
// ── Purity ────────────────────────────────────────────────────────────────
//
// Same contract as `nemesisLedger.js`: no Phaser, no `Math.random()`, rng
// injected. The spoken set lives on the ledger, so it is run-scoped and seeded,
// and a test can drive thirty draws and assert the no-repeat rule without
// spawning anything.

/**
 * The line pools.
 *
 * `kind` is the beat. `when(ctx)` gates on ledger state — a line that names a
 * sector must only fire when that sector is known. `priority` defaults to 0;
 * higher wins outright, so the specific line is chosen over the generic one
 * whenever it fits, and the generic one is what remains when nothing does.
 *
 * `text` may be a string or `(ctx) => string`. Keep them SHORT: this renders on
 * a phone in portrait, and three lines is the ceiling before the card has to
 * shrink its type.
 */
export const LINES = [
  // ── A nemesis you have met before walks back in ────────────────────────
  {
    id: 'ret-bled-many',
    kind: 'nemesis-return',
    priority: 2,
    when: (c) => c.lastOutcome === 'wounded-you' && c.encounters > 2,
    text: () => 'Three times now. You bleed the same\nevery time. I have stopped counting\nand started collecting.',
  },
  {
    id: 'ret-bled',
    kind: 'nemesis-return',
    priority: 2,
    when: (c) => c.lastOutcome === 'wounded-you',
    text: (c) => `I still have your blood on the deck\nof sector ${c.lastSeenSector}. I came back for\nthe rest of it.`,
  },
  {
    id: 'ret-scarred',
    kind: 'nemesis-return',
    priority: 2,
    when: (c) => c.scars >= 2,
    text: () => 'You took something off me the last\ntwo times. Look what they put back on.\nYou did this. Thank you.',
  },
  {
    id: 'ret-escaped-many',
    kind: 'nemesis-return',
    priority: 1,
    when: (c) => c.encounters > 2,
    text: () => 'You have had three chances at me.\nI only need the one.',
  },
  {
    id: 'ret-escaped',
    kind: 'nemesis-return',
    priority: 1,
    when: (c) => c.lastOutcome === 'survived',
    text: (c) => `You let me walk off sector ${c.lastSeenSector}.\nThat was the mistake. Not the fight —\nthe letting go.`,
  },
  {
    id: 'ret-generic-a',
    kind: 'nemesis-return',
    text: () => 'You remember me. Good.\nThat saves us both the introduction.',
  },
  {
    id: 'ret-generic-b',
    kind: 'nemesis-return',
    text: (c) => `Sector ${c.firstSeenSector}. That is where\nyou should have finished it.`,
  },

  // ── Someone has inherited a dead one's grudge ──────────────────────────
  {
    id: 'heir-captain',
    kind: 'nemesis-heir',
    priority: 1,
    when: (c) => !!c.successorOf,
    text: (c) => `${c.successorOf} held this deck for nine years.\nYou took it in a minute and a half.\nI was standing right there.`,
  },
  {
    id: 'heir-armour',
    kind: 'nemesis-heir',
    priority: 1,
    when: (c) => !!c.successorOf,
    text: (c) => `They gave me ${c.successorOf}'s post.\nThey gave me the armour too.\nIt does not fit yet.`,
  },
  {
    id: 'heir-name',
    kind: 'nemesis-heir',
    when: (c) => !!c.successorOf,
    text: (c) => `You will not remember ${c.successorOf}.\nYou killed too many for that.\nI remember.`,
  },
  {
    id: 'heir-generic',
    kind: 'nemesis-heir',
    text: () => 'The last one who wore this is dead.\nSomeone always takes the post.\nThat is how the Empire works.',
  },

  // ── It dies ────────────────────────────────────────────────────────────
  {
    id: 'kill-bled',
    kind: 'nemesis-kill',
    priority: 2,
    when: (c) => c.lastOutcome === 'wounded-you',
    text: () => 'I had you. Twice.\nSomeone will finish it.',
  },
  {
    id: 'kill-long',
    kind: 'nemesis-kill',
    priority: 2,
    when: (c) => c.encounters > 2,
    text: (c) => `Since sector ${c.firstSeenSector}...\nI wanted it to be longer.`,
  },
  {
    id: 'kill-heir',
    kind: 'nemesis-kill',
    priority: 1,
    when: (c) => !!c.successorOf,
    text: (c) => `Tell ${c.successorOf}... no.\nHe is already dead too.`,
  },
  {
    id: 'kill-generic-a',
    kind: 'nemesis-kill',
    text: () => 'Someone is behind me.\nThere is always someone behind me.',
  },
  {
    id: 'kill-generic-b',
    kind: 'nemesis-kill',
    text: () => 'You are not leaving this station.\nNone of us do.',
  },

  // ── It killed you ──────────────────────────────────────────────────────
  {
    id: 'dead-bled',
    kind: 'nemesis-killed-you',
    priority: 2,
    when: (c) => c.encounters >= 1,
    text: () => 'I told you I was collecting.\nGet up. I am not finished.',
  },
  {
    id: 'dead-generic-a',
    kind: 'nemesis-killed-you',
    text: () => 'Under the helmet. Just meat.\nI thought so.',
  },
  {
    id: 'dead-generic-b',
    kind: 'nemesis-killed-you',
    text: () => 'They will put my name on this deck.\nYou gave me that.',
  },
  {
    id: 'dead-generic-c',
    kind: 'nemesis-killed-you',
    text: () => 'Stay down.\nIt is easier for both of us.',
  },

  // ── Vader arrives ──────────────────────────────────────────────────────
  //
  // He has no ledger entry — `ledger.vader` is the running record instead. The
  // first meeting is fixed on purpose: it is the only one the player is
  // guaranteed to see, and it should always be the same first impression.
  {
    id: 'vader-first',
    kind: 'vader-arrive',
    priority: 5,
    when: (c) => c.encounters === 0,
    text: () => 'A bounty hunter.\nThe Empire has been generous with\nyour kind. That ends here.',
  },
  {
    id: 'vader-killed-you',
    kind: 'vader-arrive',
    priority: 3,
    when: (c) => c.killedYou > 0,
    text: () => 'You died here once already.\nI felt it. I feel very little.',
  },
  {
    id: 'vader-wounded-him',
    kind: 'vader-arrive',
    priority: 3,
    when: (c) => c.lastOutcome === 'wounded',
    text: () => 'You made me withdraw.\nNo one has done that in a long time.\nI have thought about it since.',
  },
  {
    id: 'vader-late',
    kind: 'vader-arrive',
    priority: 2,
    when: (c) => c.encounters >= 3,
    text: (c) => `The ${c.encounters + 1}th time.\nYou are not improving.\nYou are only surviving.`,
  },
  {
    id: 'vader-generic-a',
    kind: 'vader-arrive',
    text: () => 'You are running out of station.\nAnd of reasons.',
  },
  {
    id: 'vader-generic-b',
    kind: 'vader-arrive',
    text: () => 'Your armour is beskar.\nIt will not matter.',
  },

  // ── Vader withdraws, wounded ───────────────────────────────────────────
  {
    id: 'vader-hurt-first',
    kind: 'vader-wounded',
    priority: 2,
    when: (c) => c.encounters <= 1,
    text: () => 'Enough.\nYou will not find this so easy\nwhen I am not curious.',
  },
  {
    id: 'vader-hurt-late',
    kind: 'vader-wounded',
    priority: 2,
    when: (c) => c.encounters >= 4,
    text: () => 'You are learning me.\nThat is unfortunate — for you.\nI am also learning.',
  },
  {
    id: 'vader-hurt-generic-a',
    kind: 'vader-wounded',
    text: () => 'The station is large.\nWe will continue.',
  },
  {
    id: 'vader-hurt-generic-b',
    kind: 'vader-wounded',
    text: () => 'Impressive.\nMost impressive. And not enough.',
  },

  // ── Vader falls ────────────────────────────────────────────────────────
  {
    id: 'vader-end-long',
    kind: 'vader-slain',
    priority: 2,
    when: (c) => c.encounters >= 4,
    text: () => 'Five times you walked away.\nOnly one of us had to.',
  },
  {
    id: 'vader-end-generic-a',
    kind: 'vader-slain',
    text: () => 'You have your asset, hunter.\nYou will not have the door.',
  },
  {
    id: 'vader-end-generic-b',
    kind: 'vader-slain',
    text: () => 'The Empire does not\nnotice one death. Not even mine.',
  },
];

/** The beats a line can belong to. Exported so a test can iterate them. */
export const KINDS = [
  'nemesis-return',
  'nemesis-heir',
  'nemesis-kill',
  'nemesis-killed-you',
  'vader-arrive',
  'vader-wounded',
  'vader-slain',
];

/**
 * Build the speech context for a nemesis from its ledger entry.
 *
 * Flattened deliberately: a `when` predicate that reaches into nested ledger
 * structure would break the moment the ledger's shape changed, and the pool is
 * the part most likely to be edited by someone who has not read that file.
 */
export function nemesisContext(entry) {
  return {
    name: entry.first,
    encounters: entry.encounters || 0,
    scars: (entry.scars || []).length,
    lastOutcome: entry.lastOutcome || null,
    successorOf: entry.successorOf || null,
    firstSeenSector: entry.firstSeenSector ?? 1,
    lastSeenSector: entry.lastSeenSector ?? entry.firstSeenSector ?? 1,
    base: entry.base,
    traits: (entry.traits || []).slice(),
  };
}

/** The same, for Vader, from `ledger.vader`. */
export function vaderContext(v, encounter) {
  return {
    name: 'DARTH VADER',
    encounter: encounter ?? (v?.encounters ?? 0) + 1,
    encounters: v?.encounters ?? 0,
    lastOutcome: v?.lastOutcome ?? null,
    killedYou: v?.killedYou ?? 0,
  };
}

/**
 * Choose a line for a beat.
 *
 * @param kind   one of KINDS
 * @param ctx    from `nemesisContext` / `vaderContext`
 * @param spoken the run's already-used ids — MUTATED, this is `ledger.spoken`
 * @param rng    injected, seeded
 * @returns {{id, text}|null}  null only when the beat has no lines at all
 */
export function pickLine(kind, ctx, spoken, rng) {
  const pool = LINES.filter((l) => l.kind === kind && (!l.when || l.when(ctx)));
  if (!pool.length) return null;

  let fresh = pool.filter((l) => !spoken.includes(l.id));
  if (!fresh.length) {
    // The beat is exhausted. Forget only THIS beat's ids and start it over —
    // clearing the whole set would reset unrelated beats the player has not
    // heard yet, and going silent would be worse than a repeat.
    for (const l of pool) {
      const i = spoken.indexOf(l.id);
      if (i >= 0) spoken.splice(i, 1);
    }
    fresh = pool;
  }

  // Highest priority tier only, then rng within it. A specific line always
  // beats a generic one while it is unspoken; once used, the generic pool is
  // what is left, which is the right way round.
  const top = fresh.reduce((m, l) => Math.max(m, l.priority || 0), 0);
  const tier = fresh.filter((l) => (l.priority || 0) === top);
  const chosen = rng.pick(tier);
  if (!chosen) return null;

  spoken.push(chosen.id);
  return {
    id: chosen.id,
    text: typeof chosen.text === 'function' ? chosen.text(ctx) : chosen.text,
  };
}
