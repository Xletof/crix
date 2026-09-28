// VANGUARD + CAPTAIN — one guaranteed later shield, and a surge that cannot
// steal the authored queue. STRUCTURE ONLY.
//
// Proves: the mid Captain-VANGUARD row converts exactly one later FILL event
// into a guaranteed shield without moving the budget, the opening, the Captain
// or any other slot's random draw; that shield is a VANGUARD screen but never
// an opening-pair member; and a terminal surge draws from the encounter's fill
// without shifting `_spawnQueue`, so it can never take the Captain's token or
// release the front. Whether the fight now feels like VANGUARD after the
// opening breaks is a handset question and is not asserted here.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const A = '?nodlg=1&encdbg=1&room=hangar&sector=8&wave=2';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok: !!ok, label, detail }); };

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function run(query, fn, seed = 4242) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`page error (${query}): ${e}`));
  await page.goto(BASE + query);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  await page.evaluate((s) => {
    const gs = window.game.scene.getScene('Game');
    const log = { gate: [] };
    window.__log = log;
    const sag = gs.spawnAtGate.bind(gs);
    gs.spawnAtGate = (type, g, slot) => { log.gate.push({ type, slot: slot ?? null, wave: gs._waveIdx }); return sag(type, g, slot); };
    window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: s });
  }, seed);
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?._wave, null, { timeout: 20000 });
  await page.evaluate(async () => {
    const { setGodMode } = await import('/src/systems/debug.js');
    setGodMode(true);
    window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__poll = async (fn, ms = 20000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { if (fn()) return true; await window.__wait(60); }
      return false;
    };
  });
  const out = await fn(page);
  await page.close();
  return out;
}

// ── 1. THE QUEUE, pure, across many seeds ─────────────────────────────────
const pure = await run('?nodlg=1', async (page) => page.evaluate(async () => {
  const E = await import('/src/data/encounters.js');
  const { makeStreams } = await import('/src/systems/rng.js');
  const row = E.CHAMPION_PLACEMENTS.find((p) => p.encounter === 'vanguard');
  const bare = { ...row }; delete bare.shieldSlot;
  const enc = E.ENCOUNTERS.vanguard;
  const n = Math.max(2, Math.round(10 * enc.countMult));   // hangar wave 2 count 10
  const samples = [];
  for (let seed = 1; seed <= 200; seed++) {
    const q = E.buildSpawnQueue(enc, n, makeStreams(seed, ['waves']).waves);
    samples.push({ before: E.applyChampionPlacement(q, bare), after: E.applyChampionPlacement(q, row) });
  }
  return {
    row: { ...row }, n, samples,
    front: { ...E.VANGUARD_FRONT }, screen: { ...E.VANGUARD_SCREEN },
    crossRow: E.CHAMPION_PLACEMENTS.find((p) => p.encounter === 'crossfire'),
    vanguard: JSON.stringify(enc), crossfire: JSON.stringify(E.ENCOUNTERS.crossfire),
  };
}));
const S = pure.samples;
const shieldsAt = (q) => q.map((t, i) => (t === 'shielded' ? i : -1)).filter((i) => i >= 0);
check(pure.row.slot === 2 && pure.row.cost === 2 && pure.row.shieldSlot === 5,
  'the Captain-VANGUARD row: Captain at slot 2, cost 2, one later guaranteed shield at slot 5', JSON.stringify(pure.row));
check(S.every((s) => s.after.length === s.before.length && s.after.length === pure.n - 1),
  'THE BUDGET IS UNCHANGED — same event count with and without the reinforcement', `${S[0].after.length} events`);
check(S.every((s) => s.after[0] === 'shielded' && s.after[1] === 'shielded'), 'the opening pair is unchanged', '');
check(S.every((s) => s.after[2] === 'captain' && s.after.filter((t) => t === 'captain').length === 1),
  'the Captain keeps his slot, exactly once', '');
check(S.every((s) => s.after[3] === 'shielded'), 'the existing later guaranteed shield (slot 3) remains', '');
check(S.every((s) => s.after[5] === 'shielded'), 'slot 5 is now a shield on EVERY seed', '');
check(S.every((s) => s.after.every((t, i) => i === 5 || t === s.before[i])),
  'every other slot is the SAME token it drew before — only slot 5 moved', '');
const guaranteedBefore = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => S.every((s) => s.before[i] === 'shielded'));
const guaranteedAfter = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => S.every((s) => s.after[i] === 'shielded'));
check(guaranteedBefore.join() === '0,1,3' && guaranteedAfter.join() === '0,1,3,5',
  'guaranteed shields go from 3 to 4 — exactly one added, and it is not an opening slot',
  `before ${guaranteedBefore} after ${guaranteedAfter}`);
check(S.some((s) => s.after[6] !== 'shielded') && S.some((s) => s.after[7] !== 'shielded'),
  'the remaining fill is still fill — not a shield wall', '');
check(JSON.stringify(pure.front) === JSON.stringify({ openers: 2, establishPx: 200, timeoutMs: 3000, stallMs: 7000, lanePx: 60 }),
  'VANGUARD front values unchanged: 2 / 200 / 3000 / 7000 / 60', JSON.stringify(pure.front));
check(pure.screen.holdPx === 140 && pure.screen.resumePx === 165, 'VANGUARD screen unchanged: 140 / 165', '');
check(JSON.stringify(pure.crossRow) === JSON.stringify({ arena: 'hangar', band: 'late', wave: 2, encounter: 'crossfire', champion: 'captain', slot: 2, cost: 2 }),
  'the CROSSFIRE + Captain row is unchanged and carries no reinforcement', JSON.stringify(pure.crossRow));
check(/"lead":\["shielded","shielded","shooter","shielded","shooter"\]/.test(pure.vanguard)
  && /"lead":\["shooter","shooter","shooter","shooter"\]/.test(pure.crossfire),
  'the VANGUARD and CROSSFIRE archetypes themselves are unchanged', '');

// ── 2. LIVE: the surge during a front hold, then the rest of the wave ─────
const live = await run(A, async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const L = window.__log;
  const f = gs._vanguardFront;
  const P = { x: gs.player.x, y: gs.player.y };
  const plant = setInterval(() => { gs.player.setPosition(P.x, P.y); gs.player.setVelocity(0, 0); }, 30);
  // The whole authored queue = the tokens already drawn this wave + what remains.
  const full = () => [...L.gate.filter((g) => g.wave === 1).map((g) => g.type), ...(gs._spawnQueue || [])];
  const out = { queue0: full(), waveCount: gs._waveCount };
  // Wait for the hold: both opening events spent, front not yet released.
  // `holdAt` is stamped on the first frame the hold is evaluated, so wait for
  // it — a snapshot taken a frame earlier reads null and reports a "reset".
  await window.__poll(() => gs._waveSpawned >= 2 && f.holdAt != null, 15000);
  out.holding = !f.released;
  const snap = gs._spawnQueue.slice();
  const holdAt = f.holdAt;
  const pair = f.pair.slice();
  const champsBefore = gs.enemies.getChildren().filter((e) => e.alive && e.isChampion).length;
  const gatesBefore = L.gate.filter((g) => g.wave === 1).length;
  gs.triggerSurge();
  await window.__wait(2600);   // every surge telegraph has landed
  out.surge = {
    queueSame: JSON.stringify(gs._spawnQueue) === JSON.stringify(snap),
    snapHead: snap[0],
    stillHolding: !f.released,
    holdAtSame: f.holdAt === holdAt,
    pairSame: f.pair.every((e, i) => !pair[i] || e === pair[i]),
    champs: gs.enemies.getChildren().filter((e) => e.alive && e.isChampion).length - champsBefore,
    surgeTypes: L.gate.filter((g) => g.wave === 1).slice(gatesBefore).map((g) => g.type),
    surgeShields: gs.enemies.getChildren().filter((e) => e.alive && e._archetype === 'shielded' && !f.pair.includes(e))
      .map((e) => ({ screen: !!e._screen, lane: !!e._lane })),
    spawnedSame: gs._waveSpawned,
  };
  // RELEASE and drain; the next authored drip must be the token the queue owed.
  const dripStart = L.gate.filter((g) => g.wave === 1).length;
  await window.__poll(() => f.released, 15000);
  gs.arenaCfg.spawnRate = 60;
  await window.__poll(() => gs._wavePhase !== 'spawning', 20000);
  await window.__wait(1200);
  const drips = L.gate.filter((g) => g.wave === 1).slice(dripStart).map((g) => g.type);
  out.firstDripAfter = drips[0];
  out.dripsAfter = drips;
  // The reinforcement shield: every VANGUARD shield that is not the pair.
  const later = gs.enemies.getChildren().filter((e) => e.alive && e._archetype === 'shielded' && !f.pair.includes(e));
  out.later = later.map((e) => ({ screen: !!e._screen, lane: !!e._lane }));
  clearInterval(plant);
  gs.enemies.getChildren().filter((e) => e.alive).forEach((e) => {
    if (e.isChampion) { for (let i = 0; i < 60 && e.alive; i++) e.damage(2000); } else e.die();
  });
  out.cleared = await window.__poll(() => gs._wavePhase === 'breather' || gs._waveIdx > 1, 8000);
  return out;
}));
check(live.queue0.length === live.waveCount && live.queue0[5] === 'shielded',
  'LIVE: the running Captain-VANGUARD queue carries the slot-5 shield within its own budget', live.queue0.join(','));
check(live.holding, 'the surge is fired while the front is HOLDING', '');
check(live.surge.queueSame, 'A SURGE DOES NOT CONSUME `_spawnQueue` — the authored queue is identical afterwards', '');
check(live.surge.snapHead === 'captain' && live.surge.champs === 0,
  'the Captain\'s token was next, and the surge did NOT spawn him', JSON.stringify(live.surge));
check(live.surge.surgeTypes.length >= 1 && live.surge.surgeTypes.every((t) => ['shielded', 'shooter', 'grunt'].includes(t)),
  'surge types come from VANGUARD\'s fill pool', live.surge.surgeTypes.join(','));
check(live.surge.stillHolding && live.surge.holdAtSame && live.surge.pairSame,
  'the surge neither releases, re-arms nor resets the front', JSON.stringify(live.surge));
check(live.surge.surgeShields.every((s) => s.screen && !s.lane),
  'surge shields are VANGUARD screens but never opening-pair members', JSON.stringify(live.surge.surgeShields));
check(live.firstDripAfter === 'captain', 'after the release the drip resumes with the SAME owed token — the Captain', `${live.firstDripAfter}`);
check(JSON.stringify(live.dripsAfter) === JSON.stringify(live.queue0.slice(2)),
  'the rest of the wave drips exactly the authored queue, in order', `${live.dripsAfter.join(',')} vs ${live.queue0.slice(2).join(',')}`);
check(live.later.length >= 2 && live.later.every((e) => e.screen && !e.lane),
  'the later shields (slot 3 and the new slot 5) are VANGUARD screens, never opening members', JSON.stringify(live.later));
check(live.cleared, 'the wave still clears normally', '');

// ── 3. The matched no-Captain VANGUARD and CROSSFIRE are untouched ────────
const noCap = await run(A + '&nochamp=1', async (page) => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const L = window.__log;
  return { queue: [...L.gate.filter((g) => g.wave === 1).map((g) => g.type), ...(gs._spawnQueue || [])], placement: gs._placement };
}));
const cf = await run('?nodlg=1&encdbg=1&room=hangar&sector=16&wave=3', async (page) => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const L = window.__log;
  return { enc: gs._encounter?.id, queue: [...L.gate.filter((g) => g.wave === 2).map((g) => g.type), ...(gs._spawnQueue || [])], front: gs._vanguardFront };
}));
check(noCap.placement === null && noCap.queue.length === live.queue0.length + 1,
  'the no-Captain VANGUARD is the unplaced composition — no reinforcement applies there', noCap.queue.join(','));
check(cf.enc === 'crossfire' && cf.queue[2] === 'captain' && cf.front === null && !cf.queue.slice(3).includes('captain'),
  'CROSSFIRE + Captain: same placement, no front, no reinforcement', cf.queue.join(','));

await browser.close();
for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
console.log(`\n  live Captain-VANGUARD queue: ${live.queue0.join(',')}`);
console.log(`  surge during hold spawned: ${live.surge.surgeTypes.join(',')} · next owed token: ${live.surge.snapHead}`);
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — one more guaranteed shield, same budget, and the surge cannot steal the queue`);
