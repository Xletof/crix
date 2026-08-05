// Seeded randomness: reproducible runs, and streams that do not couple.
//
// Until this existed every gameplay roll called Math.random(), which made a
// whole class of things impossible: no encounter could be reproduced, so there
// was no deterministic test of a SINGLE nemesis behaving correctly — only
// aggregate checks over hundreds of rolls, which pass happily on a generator
// that is subtly wrong. No balance change could be A/B'd, because "before" and
// "after" were never the same fight.
//
// The subtle half is STREAM ISOLATION. A single shared generator would couple
// the systems: adding one extra roll to the nemesis code would shift every wave
// composition and every drop after it, so an unrelated change would break every
// seeded test in the suite. That property is invisible in play and impossible to
// notice by reading, so it is asserted directly here.
//
// Two things this file deliberately does NOT do:
//   - assert specific names or trait ids for a given seed. Those are correct
//     today and would be correct tomorrow, but pinning them turns any tuning of
//     the name pools into a test failure. What matters is that the SAME seed
//     gives the SAME answer, whatever that answer is.
//   - check cosmetic randomness. FX jitter and audio `vary` stay on
//     Math.random() on purpose; routing them would flood the streams with draws
//     and make the gameplay sequence depend on how many sparks were on screen.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok, label, detail }); };

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
  const { makeRng, makeStreams, newSeed, seedToCode, codeToSeed } = await import('/src/systems/rng.js');
  const { rollNemesis } = await import('/src/data/nemesis.js');
  const out = {};

  // A nemesis reduced to a comparable string. Covers everything the generator
  // decides — a change in any of it must show up as a different sequence.
  const sig = (n) => `${n.name}|${n.base}|${n.traits.slice().sort().join(',')}|${n.hpMult.toFixed(4)}`;
  const walk = (seed, sectors = 20) => {
    const rng = makeStreams(seed, ['nemesis', 'waves', 'drops', 'boss']);
    const seq = [];
    for (let s = 1; s <= sectors; s++) seq.push(sig(rollNemesis(s, { rng: rng.nemesis })));
    return seq.join(' // ');
  };

  // ── Reproducibility ────────────────────────────────────────────────────
  out.sameSeed = { a: walk(1234), b: walk(1234) };
  out.diffSeed = { a: walk(1234), b: walk(1235) };

  // ── Purity: no scene, no globals, same answer every time ───────────────
  const p1 = rollNemesis(7, { rng: makeRng(99) });
  const p2 = rollNemesis(7, { rng: makeRng(99) });
  out.pure = { a: sig(p1), b: sig(p2) };

  // ── Stream isolation ───────────────────────────────────────────────────
  // Draw heavily from `nemesis`, then check `waves` is untouched. This is the
  // property that lets one system change without invalidating every baseline.
  const readWaves = (seed, extraNemesisDraws) => {
    const rng = makeStreams(seed, ['nemesis', 'waves', 'drops', 'boss']);
    for (let i = 0; i < extraNemesisDraws; i++) rng.nemesis.rand();
    return Array.from({ length: 30 }, () => rng.waves.rand().toFixed(8)).join(',');
  };
  out.isolation = { none: readWaves(777, 0), many: readWaves(777, 500) };

  // Different streams off one seed must not be the same sequence either — a
  // naive implementation seeding them all identically would pass isolation
  // while making every system roll in lockstep.
  const st = makeStreams(555, ['nemesis', 'waves', 'drops', 'boss']);
  out.streamsDiffer = {
    nemesis: Array.from({ length: 8 }, () => st.nemesis.rand().toFixed(6)).join(','),
    waves: Array.from({ length: 8 }, () => st.waves.rand().toFixed(6)).join(','),
  };

  // ── Helper correctness ─────────────────────────────────────────────────
  const h = makeRng(31337);
  const betweens = Array.from({ length: 400 }, () => h.between(3, 7));
  out.between = {
    min: Math.min(...betweens),
    max: Math.max(...betweens),
    distinct: new Set(betweens).size,
  };
  out.chanceEdges = {
    never: Array.from({ length: 200 }, () => h.chance(0)).some(Boolean),
    always: Array.from({ length: 200 }, () => h.chance(1)).every(Boolean),
  };
  const src = [1, 2, 3, 4, 5];
  const shuffled = h.shuffle(src);
  out.shuffle = {
    mutatedSource: src.join(',') !== '1,2,3,4,5',
    sameMembers: shuffled.slice().sort().join(',') === '1,2,3,4,5',
  };
  out.sample = {
    distinct: new Set(h.sample(src, 3)).size,
    overRequest: h.sample(src, 99).length,
  };

  // ── Seed codes round-trip ──────────────────────────────────────────────
  const seeds = [0, 1, 4242, 65535, newSeed()];
  out.codes = seeds.map((s) => ({ s, back: codeToSeed(seedToCode(s)) }));
  out.badCode = codeToSeed('not a seed!!');

  // ── The live scene ─────────────────────────────────────────────────────
  const gs = window.game.scene.getScene('Game');
  out.live = {
    seed: gs.runSeed,
    hasStreams: !!(gs.rng?.nemesis && gs.rng?.waves && gs.rng?.drops && gs.rng?.boss),
    seedWasHonoured: gs.runSeed === 4242,
  };

  // A restart must RE-SEED, not replay. The scene instance is reused across
  // scene.start(), so a seed left over would silently make every "new run" the
  // previous one.
  gs.scene.start('Game', { mode: 'endless' });
  await new Promise((res) => setTimeout(res, 2500));
  const gs2 = window.game.scene.getScene('Game');
  out.afterRestart = { seed: gs2.runSeed, differs: gs2.runSeed !== 4242 };

  // And an explicit seed on restart is honoured, which is what makes a run
  // replayable from the code on the game-over screen.
  gs2.scene.start('Game', { mode: 'endless', seed: 4242 });
  await new Promise((res) => setTimeout(res, 2500));
  out.replay = { seed: window.game.scene.getScene('Game').runSeed };

  return out;
});

await browser.close();

// ── Reproducibility ──────────────────────────────────────────────────────
check(r.sameSeed.a === r.sameSeed.b, 'the same seed produces the same 20-sector climb',
  r.sameSeed.a === r.sameSeed.b ? '' : 'sequences diverged');
check(r.diffSeed.a !== r.diffSeed.b, 'a different seed produces a different climb', '');
check(r.pure.a === r.pure.b, 'rollNemesis is pure — no scene, no hidden global', '');

// ── Isolation ────────────────────────────────────────────────────────────
check(r.isolation.none === r.isolation.many,
  '500 extra draws from the nemesis stream leave the wave stream byte-identical',
  'the streams are coupled — one system changing would shift every other seeded baseline');
check(r.streamsDiffer.nemesis !== r.streamsDiffer.waves,
  'and the streams are not merely copies of each other',
  'every system would roll in lockstep off one seed');

// ── Helpers ──────────────────────────────────────────────────────────────
check(r.between.min === 3 && r.between.max === 7 && r.between.distinct === 5,
  'between(a,b) is inclusive at both ends',
  `min ${r.between.min}, max ${r.between.max}, ${r.between.distinct} distinct values`);
check(r.chanceEdges.never === false && r.chanceEdges.always === true,
  'chance(0) never fires and chance(1) always does',
  `never=${r.chanceEdges.never} always=${r.chanceEdges.always}`);
check(!r.shuffle.mutatedSource, 'shuffle copies rather than mutating the caller\'s array',
  'trait pools are shared config — mutating one would corrupt every later roll');
check(r.shuffle.sameMembers, 'and keeps every member', '');
check(r.sample.distinct === 3, 'sample returns distinct elements', `${r.sample.distinct} distinct of 3`);
check(r.sample.overRequest === 5, 'and asking for more than exists returns everything, not undefined padding',
  `${r.sample.overRequest} of a 5-element pool`);

// ── Seed codes ───────────────────────────────────────────────────────────
const badRoundTrip = r.codes.find((c) => c.s !== c.back);
check(!badRoundTrip, 'seed codes round-trip, so a player can type one back in',
  badRoundTrip ? `${badRoundTrip.s} -> ${badRoundTrip.back}` : '');
check(r.badCode === null, 'garbage input is rejected rather than becoming NaN', `got ${r.badCode}`);

// ── Live scene ───────────────────────────────────────────────────────────
check(r.live.hasStreams, 'the scene carries all four streams', '');
check(r.live.seedWasHonoured, 'a seed passed into the scene is used', `got ${r.live.seed}`);
check(r.afterRestart.differs, 'a restart RE-SEEDS rather than replaying the last run',
  `still ${r.afterRestart.seed} — the scene instance is reused, so a stale seed makes every new run the previous one`);
check(r.replay.seed === 4242, 'and an explicit seed on restart replays that run',
  `got ${r.replay.seed}`);

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — runs are reproducible and the streams do not couple`);
