// Does the narrative system behave like a character, and does it stay out of
// the way?
//
// ── The two things worth protecting ──────────────────────────────────────
//
// 1. NO LINE REPEATS while an unused one fits. That is the whole difference
//    between a character and a status readout, and it is the one property of
//    this system a check can actually pin down. `grudgeLine` returns the same
//    four strings forever and is right to; speech is not.
//
// 2. A STRANGER NEVER RAISES A CARD. The card is a full stop — Game and HUD
//    pause and it waits for a tap — and that is only affordable because it is
//    rare. "Pause on every mini-boss spawn" is the regression this system is
//    one careless condition away from, and it would be a pacing disaster that
//    no other check in the suite would notice.
//
// Everything else here is the plumbing that would strand the game frozen: the
// pause actually happening, both scenes resuming, and the card refusing to open
// over another overlay.
//
// Per docs/POST-MORTEM-vader-moves.md, each of these was A/B'd against the
// build it replaces — the no-repeat check fails with the spoken set removed,
// and the stranger check fails if the arrival gate is dropped.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const PAGE_URL = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail = '') => { checks.push({ ok, label, detail }); };

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(PAGE_URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title')
  .scene.start('Game', { mode: 'endless', seed: 8181 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

// ── 1. The pool ───────────────────────────────────────────────────────────
//
// Pure module, so this needs no scene at all — drive it directly and count.
const pool = await page.evaluate(async () => {
  const { pickLine, nemesisContext, KINDS, LINES } = await import('/src/data/nemesisDialogue.js');
  const { makeRng } = await import('/src/systems/rng.js');

  const entry = {
    first: 'THRAX', epithet: 'THE QUIET', base: 'grunt', traits: ['armored'],
    scars: [{ kind: 'trait', id: 'armored', sector: 4 }],
    firstSeenSector: 4, lastSeenSector: 7, encounters: 3, lastOutcome: 'wounded-you',
  };

  // Thirty draws of one beat against one unchanging state. Every line the gate
  // admits must be used before any is used twice.
  const rng = makeRng(99);
  const spoken = [];
  const seq = [];
  for (let i = 0; i < 30; i++) {
    seq.push(pickLine('nemesis-return', nemesisContext(entry), spoken, rng).id);
  }
  const eligible = LINES.filter((l) => l.kind === 'nemesis-return'
    && (!l.when || l.when(nemesisContext(entry)))).map((l) => l.id);

  // The longest prefix before any id repeats.
  let firstRepeat = seq.length;
  const seen = new Set();
  for (let i = 0; i < seq.length; i++) {
    if (seen.has(seq[i])) { firstRepeat = i; break; }
    seen.add(seq[i]);
  }

  // Priority: a line that knows something specific must win while unspoken.
  const freshSpoken = [];
  const firstPick = pickLine('nemesis-return', nemesisContext(entry), freshSpoken, makeRng(7));

  // Every beat must be able to answer, for a state that carries nothing.
  const bare = { encounters: 0, scars: 0, lastOutcome: null, successorOf: null,
    firstSeenSector: 1, lastSeenSector: 1, encounter: 1, killedYou: 0 };
  const silent = KINDS.filter((k) => !pickLine(k, bare, [], makeRng(3)));

  return {
    eligible: eligible.length,
    firstRepeat,
    distinct: new Set(seq).size,
    firstPriority: LINES.find((l) => l.id === firstPick.id)?.priority || 0,
    maxPriority: Math.max(...LINES.filter((l) => l.kind === 'nemesis-return'
      && (!l.when || l.when(nemesisContext(entry)))).map((l) => l.priority || 0)),
    silent,
    textIsString: typeof firstPick.text === 'string' && firstPick.text.length > 0,
  };
});

check(pool.firstRepeat >= pool.eligible,
  'no line repeats until its pool is exhausted',
  `first repeat at draw ${pool.firstRepeat} of ${pool.eligible} eligible lines — a repeat before that means the spoken set is not being consulted`);
check(pool.distinct === pool.eligible,
  'and every eligible line does get used',
  `${pool.distinct} distinct of ${pool.eligible} across 30 draws — a line the gate admits but the picker never reaches is dead content`);
check(pool.firstPriority === pool.maxPriority,
  'the specific line beats the generic one while it is unspoken',
  `first draw had priority ${pool.firstPriority}, highest eligible is ${pool.maxPriority}`);
check(pool.silent.length === 0,
  'every beat can answer for a state that carries no history',
  `silent beats: ${pool.silent.join(', ') || 'none'} — a beat with no reachable line means a hook fires and nothing happens`);
check(pool.textIsString, 'and returns rendered text, not a thunk');

// ── 2. The card, and the pause ────────────────────────────────────────────
const card = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  gs._dialogueQueue = [];
  gs._dialogueOpen = false;

  gs.queueDialogue({
    bust: 'bust-grunt', name: 'TEST', color: '#ffd040',
    sub: 'SUB', text: 'A line.', traits: ['armored'],
  });
  await new Promise((r) => setTimeout(r, 500));

  const dlg = window.game.scene.getScene('Dialogue');
  return {
    open: gs.scene.isActive('Dialogue'),
    gamePaused: gs.scene.isPaused('Game'),
    hudPaused: gs.scene.isPaused('HUD'),
    // The bust must actually be on the card. A missing texture key would
    // silently draw nothing and the card would still "work".
    hasBust: !!dlg?.children?.list?.some((o) => o.texture?.key === 'bust-grunt'),
    hasRegalia: !!dlg?.children?.list?.some((o) => o.texture?.key === 'reg-armored'),
  };
});

check(card.open, 'a queued card opens the Dialogue scene');
check(card.gamePaused && card.hudPaused,
  'and pauses BOTH Game and HUD',
  `game ${card.gamePaused}, hud ${card.hudPaused} — pausing only one leaves the HUD animating over a frozen arena`);
check(card.hasBust, 'the portrait is on the card', 'no bust-grunt image found among its children');
check(card.hasRegalia, 'and so are the trait badges');

// A real tap, through the input system, not a direct method call — the thing
// being checked is that a player can get out of this.
await page.mouse.click(360, 640);
await page.waitForTimeout(400);
await page.mouse.click(360, 640);
await page.waitForTimeout(900);

const after = await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  return {
    open: gs.scene.isActive('Dialogue'),
    gamePaused: gs.scene.isPaused('Game'),
    hudPaused: gs.scene.isPaused('HUD'),
    flagCleared: !gs._dialogueOpen,
  };
});

check(!after.open, 'tapping dismisses it');
check(!after.gamePaused && !after.hudPaused,
  'and BOTH scenes resume',
  `game paused ${after.gamePaused}, hud paused ${after.hudPaused} — this is the failure that strands the game frozen behind a card that has already gone`);
check(after.flagCleared, 'and the latch clears so the next card can open');

// ── 3. Who speaks, and who does not ───────────────────────────────────────
//
// The pacing contract. Driven through `_nemesisArrivalDialogue`, which is the
// gate itself, against three real ledger states.
const gate = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { rollNemesis } = await import('/src/data/nemesis.js');
  const { createLedger, recordEscape, nemesisFromEntry, recordKill, promoteSuccessor }
    = await import('/src/data/nemesisLedger.js');
  const { makeRng } = await import('/src/systems/rng.js');

  const rng = makeRng(555);
  const out = {};

  // A stranger: freshly rolled, never seen, no ledger entry.
  gs.ledger = createLedger();
  out.stranger = !!gs._nemesisArrivalDialogue(rollNemesis(6, { rng }));

  // A returning grudge: escaped once having drawn blood, now back.
  gs.ledger = createLedger();
  const nem = rollNemesis(6, { rng });
  const entry = recordEscape(gs.ledger, nem, 6, 'wounded-you', rng);
  const back = nemesisFromEntry(entry, 9, rng);
  const retCard = gs._nemesisArrivalDialogue(back);
  out.returning = !!retCard;
  out.returningBust = retCard?.bust;
  out.returningName = retCard?.name;

  // An heir: someone was killed, someone took the post.
  gs.ledger = createLedger();
  const dead = rollNemesis(6, { rng });
  dead.ledgerId = recordEscape(gs.ledger, dead, 6, 'survived', rng).id;
  recordKill(gs.ledger, dead, 7);
  const heir = promoteSuccessor(gs.ledger, gs.ledger.vacancies.shift(), 8, rng);
  const heirCard = gs._nemesisArrivalDialogue(nemesisFromEntry(heir, 8, rng));
  out.heir = !!heirCard;
  out.heirMentions = heirCard ? heirCard.text.includes(heir.successorOf) : false;

  return out;
});

check(gate.stranger === false,
  'a FIRST-TIME nemesis raises no card at all',
  'this is the pacing contract — a card on every mini-boss spawn is a full stop on every mini-boss spawn');
check(gate.returning === true, 'a returning grudge does speak');
check(/^bust-(grunt|shooter|bomber|shielded|sniper)$/.test(gate.returningBust || ''),
  'with the portrait for its own archetype',
  `got "${gate.returningBust}" — a bad key draws nothing and the card still looks fine`);
check(gate.heir === true, 'and so does an heir');
check(gate.heirMentions === true,
  'whose line names the one it is avenging',
  'the heir pool reads successorOf; a line that does not use it is a generic that leaked into a specific beat');

// ── 4. Vader keeps his own record ─────────────────────────────────────────
const vader = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { createLedger } = await import('/src/data/nemesisLedger.js');

  gs.ledger = createLedger();
  const first = gs._vaderDialogue('vader-arrive');

  // As if he had been driven off twice and had killed you once.
  gs.ledger.vader.encounters = 2;
  gs.ledger.vader.lastOutcome = 'wounded';
  gs.ledger.vader.killedYou = 1;
  const later = gs._vaderDialogue('vader-arrive');

  return {
    firstText: first?.text || '',
    laterText: later?.text || '',
    bust: first?.bust,
    firstSub: first?.sub,
    laterSub: later?.sub,
  };
});

check(vader.bust === 'bust-vader', 'Vader arrives with his own portrait');
check(vader.firstText && vader.laterText && vader.firstText !== vader.laterText,
  'and says something different once he has history',
  `first "${vader.firstText.split('\n')[0]}" vs later "${vader.laterText.split('\n')[0]}" — identical means ledger.vader is not reaching the gate`);
check(vader.laterSub === 'ENCOUNTER 3',
  'his nameplate counts the encounters',
  `got "${vader.laterSub}"`);

// ── 5. It must not open over another overlay ──────────────────────────────
const overlay = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  gs._dialogueQueue = [];
  gs._dialogueOpen = false;

  gs.scene.launch('Upgrade', { game: gs });
  gs.scene.pause('Game');
  gs.scene.pause('HUD');
  await new Promise((r) => setTimeout(r, 400));

  gs.queueDialogue({ bust: 'bust-grunt', name: 'X', color: '#fff', text: 'X.', traits: [] });
  await new Promise((r) => setTimeout(r, 500));

  const blocked = !gs.scene.isActive('Dialogue');
  const queued = (gs._dialogueQueue || []).length;

  gs.scene.stop('Upgrade');
  gs.scene.resume('Game');
  gs.scene.resume('HUD');
  return { blocked, queued };
});

check(overlay.blocked,
  'a card refuses to open over the upgrade picker',
  'two overlays both own the pause state, and UpgradeScene holds the room door shut until it is answered');
check(overlay.queued === 1,
  'and is HELD rather than dropped',
  `${overlay.queued} queued — the line was already marked spoken when it was chosen, so dropping it here silently burns a line the player never saw`);

// ── Report ────────────────────────────────────────────────────────────────
if (pageErrors.length) check(false, 'no page errors', pageErrors.slice(0, 3).join(' | '));

await browser.close();

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — they speak, they do not repeat, and a stranger stays quiet`);
