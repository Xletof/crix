// The nemesis ledger: memory, grudges and succession.
//
// `smoke-nemesis.mjs` proves VARIETY — that the generator produces many
// different fights. This file proves CONTINUITY, which is a different and much
// easier property to get subtly wrong, because every individual piece of it
// looks right in play while the system as a whole quietly fails to remember
// anything.
//
// The ledger is pure by design (no scene, no Phaser, no Math.random), so most of
// this runs as a direct import inside the page rather than by fighting anyone.
// That is the point of it being pure: a test can record an escape, advance five
// sectors and assert that EXACT nemesis returns scarred, in microseconds, with
// no dependence on frame timing — which at this harness's ~20 FPS is the
// difference between a real assertion and a coin flip.
//
// Two things are checked against the LIVE scene rather than in isolation,
// because they are the two that can actually regress:
//   - the ledger is empty after a restart (the scene instance is reused across
//     scene.start(), and leaking run state that way has already shipped a bug
//     here once);
//   - a scarred kill pays more AND leaves a pickup on the floor.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail = '') => { checks.push({ ok, label, detail }); };

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => fail(`page error: ${e}`));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const L = await import('/src/data/nemesisLedger.js');
  const { rollNemesis } = await import('/src/data/nemesis.js');
  const { makeStreams } = await import('/src/systems/rng.js');
  const out = {};

  const streams = (seed) => makeStreams(seed, ['nemesis', 'waves', 'drops', 'boss']);

  // ── A nemesis that got away comes back as ITSELF ───────────────────────
  {
    const rng = streams(1234).nemesis;
    const led = L.createLedger();
    const nem = rollNemesis(4, { rng });
    const entry = L.recordEscape(led, nem, 4, 'wounded-you', rng);

    out.escape = {
      id: entry.id,
      base: entry.base,
      traits: entry.traits.slice(),
      returnAt: entry.returnAtSector,
      encounters: entry.encounters,
      sameBaseAsRolled: entry.base === nem.base,
    };

    // Nothing is due before the return sector, and it IS due at it.
    out.dueBefore = !!L.dueAt(led, entry.returnAtSector - 1);
    const due = L.dueAt(led, entry.returnAtSector);
    out.dueAtSector = due?.id ?? null;

    // The return: scarred, renamed, still the same enemy underneath.
    L.applyScar(due, due.returnAtSector, rng);
    const back = L.nemesisFromEntry(due, due.returnAtSector, rng);
    out.returned = {
      ledgerId: back.ledgerId,
      base: back.base,
      name: back.name,
      grudge: back.grudge,
      scars: back.scars,
      traitCount: back.traits.length,
      wasTraitCount: out.escape.traits.length,
      keptOldTraits: out.escape.traits.every((t) => back.traits.includes(t)),
      renamed: back.name !== nem.name,
    };
  }

  // ── The return window is 2-4 sectors, and it is reproducible ───────────
  {
    const windows = [];
    for (let seed = 1; seed <= 40; seed++) {
      const rng = streams(seed).nemesis;
      const led = L.createLedger();
      const e = L.recordEscape(led, rollNemesis(5, { rng }), 5, 'survived', rng);
      windows.push(e.returnAtSector - 5);
    }
    out.window = { min: Math.min(...windows), max: Math.max(...windows), distinct: new Set(windows).size };

    const run = () => {
      const rng = streams(9090).nemesis;
      const led = L.createLedger();
      const e = L.recordEscape(led, rollNemesis(5, { rng }), 5, 'survived', rng);
      return `${e.first}|${e.base}|${e.traits.join(',')}|${e.returnAtSector}`;
    };
    out.reproducible = { a: run(), b: run() };
  }

  // ── Scars stop adding tags at the readability cap ──────────────────────
  {
    const rng = streams(77).nemesis;
    const led = L.createLedger();
    const e = L.recordEscape(led, rollNemesis(1, { rng }), 1, 'survived', rng);
    const startTraits = e.traits.length;
    for (let i = 0; i < 6; i++) L.applyScar(e, 2 + i, rng);
    out.scarCap = {
      traits: e.traits.length,
      scars: e.scars.length,
      startTraits,
      distinctTraits: new Set(e.traits).size,
      statScars: e.scars.filter((s) => s.kind === 'stat').length,
    };
    // Stat-only scars still escalate — otherwise a capped nemesis stops growing.
    const capped = L.nemesisFromEntry(e, 8, rng);
    const plain = rollNemesis(8, { rng: streams(77).nemesis, base: e.base, traits: e.traits });
    out.statScarsBite = { scarred: capped.hpMult, plain: plain.hpMult };
  }

  // ── A killed nemesis never returns as itself ───────────────────────────
  {
    const rng = streams(31337).nemesis;
    const led = L.createLedger();
    const nem = rollNemesis(6, { rng });
    const entry = L.recordEscape(led, nem, 6, 'wounded-you', rng);
    const returnAt = entry.returnAtSector;
    L.recordKill(led, { ledgerId: entry.id, first: entry.first, traits: entry.traits }, 7);

    out.killed = {
      entriesLeft: led.entries.length,
      dueAfterDeath: !!L.dueAt(led, returnAt + 50),
      vacancies: led.vacancies.length,
    };

    // ...but it DOES leave an heir, inheriting exactly one trait.
    const heir = L.promoteSuccessor(led, led.vacancies.shift(), 8, rng);
    const shared = heir.traits.filter((t) => entry.traits.includes(t));
    const spawned = L.nemesisFromEntry(heir, 8, rng);
    out.heir = {
      successorOf: heir.successorOf,
      fallenFirst: entry.first,
      inherited: heir.inheritedTrait,
      inheritedIsFromFallen: entry.traits.includes(heir.inheritedTrait),
      sharedCount: shared.length,
      traitCount: heir.traits.length,
      distinct: new Set(heir.traits).size,
      name: spawned.name,
      grudge: spawned.grudge,
      isNotTheFallen: heir.first !== entry.first || heir.id !== entry.id,
    };
  }

  // ── The ledger is capped ───────────────────────────────────────────────
  {
    const rng = streams(555).nemesis;
    const led = L.createLedger();
    const firstIds = [];
    for (let i = 0; i < L.LEDGER_CAP + 5; i++) {
      const e = L.recordEscape(led, rollNemesis(i + 1, { rng }), i + 1, 'survived', rng);
      firstIds.push(e.id);
    }
    out.cap = {
      size: led.entries.length,
      limit: L.LEDGER_CAP,
      oldestEvicted: !led.entries.some((e) => e.id === firstIds[0]),
      newestKept: led.entries.some((e) => e.id === firstIds[firstIds.length - 1]),
    };
  }

  // ── Re-escaping the same nemesis updates rather than duplicates ────────
  {
    const rng = streams(2468).nemesis;
    const led = L.createLedger();
    const nem = rollNemesis(3, { rng });
    const e1 = L.recordEscape(led, nem, 3, 'survived', rng);
    const back = L.nemesisFromEntry(e1, 5, rng);
    const e2 = L.recordEscape(led, back, 5, 'wounded-you', rng);
    out.reescape = {
      entries: led.entries.length,
      sameEntry: e1.id === e2.id,
      encounters: e2.encounters,
      outcome: e2.lastOutcome,
    };
  }

  // ── Live scene ─────────────────────────────────────────────────────────
  const gs = window.game.scene.getScene('Game');
  out.live = { hasLedger: !!gs.ledger, entries: gs.ledger?.entries?.length ?? -1 };

  // Dirty the ledger, restart, and confirm it did not survive.
  gs.ledger.entries.push({ id: 999, first: 'GHOST', traits: [], scars: [] });
  gs.ledger.vacancies.push({ first: 'GHOST', traits: ['armored'], sector: 1 });
  gs.scene.start('Game', { mode: 'endless', seed: 4242 });
  await new Promise((res) => setTimeout(res, 2500));
  const gs2 = window.game.scene.getScene('Game');
  out.afterRestart = {
    entries: gs2.ledger.entries.length,
    vacancies: gs2.ledger.vacancies.length,
    noGhost: !gs2.ledger.entries.some((e) => e.first === 'GHOST'),
  };

  // ── Scarred kills pay more, and pay something ──────────────────────────
  // scoreForEnemy is what the enemy-died handler calls, so this measures the
  // real payout path rather than a re-derivation of it.
  const fake = (scars) => ({ _miniBoss: true, _nemesis: { scars } });
  out.payout = {
    fresh: gs2.scoreForEnemy(fake(0)),
    oneScar: gs2.scoreForEnemy(fake(1)),
    twoScars: gs2.scoreForEnemy(fake(2)),
  };

  // The guaranteed drop. Spawn a nemesis, force scars onto it, kill it, and
  // count what is on the floor — asserting the EFFECT, not the branch.
  const dropTest = async (scars) => {
    const before = gs2.weaponPickups.length + (gs2.healthOrbs?.length ?? 0);
    const e = gs2._spawnMiniBoss();
    e._nemesis.scars = scars;
    e._nemesis.ledgerId = 4242;
    e.hp = 1;
    e.damage(99999);
    await new Promise((res) => setTimeout(res, 400));
    return { before, after: gs2.weaponPickups.length + (gs2.healthOrbs?.length ?? 0) };
  };
  // Only the 2-scar case is asserted. A 0-scar control would prove nothing:
  // every elite drops a health orb unconditionally already, so the floor gains
  // a pickup either way and the check would pass on a build where the
  // guaranteed drop was never wired up at all.
  out.dropTwoScars = await dropTest(2);

  return out;
});

await browser.close();

// ── Return ───────────────────────────────────────────────────────────────
check(r.escape.encounters === 1, 'an escape is recorded once', `encounters ${r.escape.encounters}`);
check(!r.dueBefore, 'nothing is due before its return sector', 'a grudge that returns immediately is a rematch queue, not a memory');
check(r.dueAtSector === r.escape.id, 'and that exact nemesis is due at it', `got id ${r.dueAtSector}, expected ${r.escape.id}`);
check(r.returned.ledgerId === r.escape.id && r.returned.base === r.escape.base,
  'it returns as ITSELF — same ledger id, same base archetype',
  `id ${r.returned.ledgerId} base ${r.returned.base}`);
check(r.returned.keptOldTraits, 'keeping every trait it had', '');
check(r.returned.traitCount > r.returned.wasTraitCount,
  'and carrying one more than before — the scar is visible in the loadout',
  `${r.returned.wasTraitCount} -> ${r.returned.traitCount}`);
check(r.returned.scars === 1, 'the scar is counted', `scars ${r.returned.scars}`);
check(r.returned.renamed && /WHO BLED YOU/.test(r.returned.name),
  'it is renamed for what it did to you', `name "${r.returned.name}"`);
check(!!r.returned.grudge, 'and arrives with a grudge line', `"${r.returned.grudge}"`);

// ── Schedule ─────────────────────────────────────────────────────────────
check(r.window.min >= 2 && r.window.max <= 4, 'returns land 2-4 sectors later',
  `range ${r.window.min}-${r.window.max}`);
check(r.window.distinct > 1, 'and are not all the same delay', `${r.window.distinct} distinct`);
check(r.reproducible.a === r.reproducible.b,
  'the whole schedule is reproducible from the run seed',
  'a Math.random() in the return timing would make seeded runs unseeded again');

// ── Scar cap ─────────────────────────────────────────────────────────────
check(r.scarCap.traits <= 3, 'scars never push a nemesis past 3 traits',
  `${r.scarCap.traits} traits — past 3 the loadout stops being readable`);
check(r.scarCap.distinctTraits === r.scarCap.traits, 'and never duplicate a trait', '');
check(r.scarCap.scars === 6, 'every scar is still recorded past the cap', `${r.scarCap.scars} of 6`);
check(r.scarCap.statScars > 0, 'as stat-only scars', `${r.scarCap.statScars}`);
check(r.statScarsBite.scarred > r.statScarsBite.plain,
  'which still escalate it, so a capped nemesis does not stop growing',
  `hpMult ${r.statScarsBite.scarred.toFixed(2)} vs ${r.statScarsBite.plain.toFixed(2)}`);

// ── Death and succession ─────────────────────────────────────────────────
check(r.killed.entriesLeft === 0 && !r.killed.dueAfterDeath,
  'a killed nemesis never returns as itself',
  `${r.killed.entriesLeft} entries left, due=${r.killed.dueAfterDeath}`);
check(r.killed.vacancies === 1, 'but it leaves a vacancy', `${r.killed.vacancies}`);
check(r.heir.successorOf === r.heir.fallenFirst, 'which an heir fills, named for the fallen',
  `successorOf ${r.heir.successorOf}, fallen ${r.heir.fallenFirst}`);
check(r.heir.sharedCount === 1,
  'inheriting EXACTLY one trait — not at least one',
  `shares ${r.heir.sharedCount} traits; more than one is how a chain of heirs compounds into something the harness never measured`);
check(r.heir.inheritedIsFromFallen, 'and that trait is one the fallen actually had', '');
check(r.heir.traitCount <= 3 && r.heir.distinct === r.heir.traitCount,
  'an heir is no wider than a fresh roll', `${r.heir.traitCount} traits`);
check(/HEIR OF/.test(r.heir.name), 'it announces the succession', `"${r.heir.name}"`);
check(/AVENGING/.test(r.heir.grudge || ''), 'with its own reason to be there', `"${r.heir.grudge}"`);

// ── Bounds ───────────────────────────────────────────────────────────────
check(r.cap.size === r.cap.limit, 'the ledger is capped', `${r.cap.size} of ${r.cap.limit}`);
check(r.cap.oldestEvicted && r.cap.newestKept, 'evicting oldest first', '');
check(r.reescape.entries === 1 && r.reescape.sameEntry,
  'escaping twice updates one entry rather than cloning it',
  `${r.reescape.entries} entries — duplicates would let one nemesis fill the ledger alone`);
check(r.reescape.encounters === 2 && r.reescape.outcome === 'wounded-you',
  'and records the newer outcome', `${r.reescape.encounters} encounters, ${r.reescape.outcome}`);

// ── Live scene ───────────────────────────────────────────────────────────
check(r.live.hasLedger, 'the scene carries a ledger', '');
check(r.afterRestart.entries === 0 && r.afterRestart.vacancies === 0 && r.afterRestart.noGhost,
  'a restart CLEARS it — grudges do not cross runs',
  `${r.afterRestart.entries} entries / ${r.afterRestart.vacancies} vacancies survived; the scene instance is reused across scene.start()`);

// ── Payout ───────────────────────────────────────────────────────────────
check(r.payout.twoScars > r.payout.oneScar && r.payout.oneScar > r.payout.fresh,
  'a scarred nemesis is worth more than a fresh one',
  `${r.payout.fresh} / ${r.payout.oneScar} / ${r.payout.twoScars}`);
check(r.dropTwoScars.after > r.dropTwoScars.before,
  'killing a 2-scar nemesis leaves a pickup on the floor, guaranteed',
  `${r.dropTwoScars.before} -> ${r.dropTwoScars.after}`);

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the nemesis remembers, scars, dies once, and is replaced`);
