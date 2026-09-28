// THE VANGUARD FRONT — the opening shields establish before the backline.
// STRUCTURE ONLY.
//
// What this proves: a VANGUARD's drip holds after its two opening shield
// EVENTS until the two shield ACTORS establish a front (or are breached, or
// time out), the pair is explicitly identified and laned, the release happens
// once, and nothing about the queue, the screen, the Captain or CROSSFIRE
// moved. What it does NOT prove: that the front reads, that the pause feels
// natural, or that it stops Super farming. Those are handset questions.

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

// Boot, and instrument the spawner BEFORE the wave can drip: every gate call
// and every materialisation is stamped on the scene's own clock.
async function run(query, fn, seed = 4242) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`page error (${query}): ${e}`));
  await page.goto(BASE + query);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  await page.evaluate((s) => {
    const gs = window.game.scene.getScene('Game');
    const log = { gate: [], made: [] };
    window.__log = log;
    const sag = gs.spawnAtGate.bind(gs);
    gs.spawnAtGate = (type, g, slot) => { log.gate.push({ t: gs.time.now, type, slot: slot ?? null, wave: gs._waveIdx }); return sag(type, g, slot); };
    const sea = gs.spawnEnemyAt.bind(gs);
    gs.spawnEnemyAt = (type, x, y, spec) => { const e = sea(type, x, y, spec); log.made.push({ t: gs.time.now, type, e }); return e; };
    const sc = gs.spawnChampion.bind(gs);
    gs.spawnChampion = (x, y, w) => { const e = sc(x, y, w); log.made.push({ t: gs.time.now, type: 'captain', e }); return e; };
    window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: s });
  }, seed);
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?._wave, null, { timeout: 20000 });
  await page.evaluate(async () => {
    const { setGodMode } = await import('/src/systems/debug.js');
    setGodMode(true);
  });
  const out = await fn(page);
  await page.close();
  return out;
}

// Shared page helpers, installed per page.
const helpers = () => {
  const gs = window.game.scene.getScene('Game');
  window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__poll = async (fn, ms = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (fn()) return true; await window.__wait(60); }
    return false;
  };
  // Lateral separation of the pair ACROSS the line from their midpoint to the player.
  window.__lateral = (a, b) => {
    const p = gs.player;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const ax = p.x - mx, ay = p.y - my, d = Math.hypot(ax, ay) || 1;
    const nx = -ay / d, ny = ax / d;
    return Math.abs((a.x - b.x) * nx + (a.y - b.y) * ny);
  };
};

// ── 1. THE NATURAL OPENING, player planted at the handset start ───────────
const nat = await run(A, async (page) => page.evaluate(async (fn) => {
  eval(`(${fn})()`);
  const gs = window.game.scene.getScene('Game');
  const E = await import('/src/data/encounters.js');
  const L = window.__log;
  const P = { x: gs.player.x, y: gs.player.y };
  const t0 = gs._waveStartedAt;
  const f = gs._vanguardFront;
  const queue = (gs._spawnQueue || []).slice();
  let latAtRelease = null, latMax = 0;
  const plant = setInterval(() => { gs.player.setPosition(P.x, P.y); gs.player.setVelocity(0, 0); }, 30);
  // Sample the pair's lateral separation through the approach.
  const sampler = setInterval(() => {
    const [a, b] = f?.pair || [];
    if (a?.alive && b?.alive) {
      const l = window.__lateral(a, b);
      latMax = Math.max(latMax, l);
      if (f.released && latAtRelease == null) latAtRelease = l;
    }
  }, 50);
  // Lane signs are read the moment both shields exist — they are dropped at
  // the close hold by design.
  await window.__poll(() => !!f?.pair[0] && !!f?.pair[1], 20000);
  const laneSigns = f.pair.map((e) => e?._lane?.sign ?? null);
  const released = await window.__poll(() => f?.released, 25000);
  const capMade = await window.__poll(() => L.made.some((m) => m.type === 'captain'), 15000);
  // Let the pair reach its close hold, then read the settled front.
  await window.__poll(() => f.pair.every((e) => e?._screenHolding), 12000);
  const [a, b] = f.pair;
  const hold = a && b ? {
    da: Math.round(Math.hypot(a.x - gs.player.x, a.y - gs.player.y)),
    db: Math.round(Math.hypot(b.x - gs.player.x, b.y - gs.player.y)),
    lateral: Math.round(window.__lateral(a, b)),
    apart: Math.round(Math.hypot(a.x - b.x, a.y - b.y)),
    lanes: [a._lane, b._lane],
  } : null;
  clearInterval(sampler);
  const gatesThisWave = L.gate.filter((g) => g.wave === 1);
  const shieldMade = L.made.filter((m) => m.type === 'shielded');
  const out = {
    armed: !!f, cfg: { ...E.VANGUARD_FRONT }, queue, enc: gs._encounter?.id,
    released, capMade, why: f?.why, gameSinceSecond: Math.round(f?.sinceSecondMs ?? -1),
    t: {
      s1: f?.pair[0] ? Math.round(shieldMade.find((m) => m.e === f.pair[0]).t - t0) : null,
      s2: f?.pair[1] ? Math.round(shieldMade.find((m) => m.e === f.pair[1]).t - t0) : null,
      second: f ? Math.round(f.secondAt - t0) : null,
      release: f ? Math.round(f.releasedAt - t0) : null,
      gate3: gatesThisWave[2] ? Math.round(gatesThisWave[2].t - t0) : null,
      captain: capMade ? Math.round(L.made.find((m) => m.type === 'captain').t - t0) : null,
    },
    slots: gatesThisWave.slice(0, 3).map((g) => g.slot),
    pairIds: f ? f.pair.map((e) => !!e?._screen) : [],
    laneSigns: null,
    latAtRelease: latAtRelease == null ? null : Math.round(latAtRelease),
    latMax: Math.round(latMax),
    hold,
    dist2AtRelease: null,
  };
  out.laneSigns = laneSigns;
  // AFTER RELEASE: drain the rest and make sure nothing re-arms and later
  // shields are not pair members.
  gs.arenaCfg.spawnRate = 60;
  await window.__poll(() => gs._wavePhase !== 'spawning', 20000);
  await window.__wait(1000);
  const later = gs.enemies.getChildren().filter((e) => e.alive && e._archetype === 'shielded' && !f.pair.includes(e));
  out.after = {
    stillReleased: f.released && gs._vanguardFront === f,
    laterShields: later.length,
    laterLaned: later.filter((e) => !!e._lane).length,
    laterScreened: later.filter((e) => !!e._screen).length,
  };
  // WAVE CLEAR still works.
  clearInterval(plant);
  gs.enemies.getChildren().filter((e) => e.alive).forEach((e) => (e.isChampion ? (() => { for (let i = 0; i < 60 && e.alive; i++) e.damage(2000); })() : e.die()));
  out.cleared = await window.__poll(() => gs._wavePhase === 'breather' || gs._waveIdx > 1, 8000);
  return out;
}, helpers.toString()));

check(nat.armed && nat.enc === 'vanguard', 'a VANGUARD wave arms the front', `${nat.enc}`);
check(nat.queue[0] === 'shielded' && nat.queue[1] === 'shielded', 'the opening is exactly two shield events', nat.queue.join(','));
check(nat.slots[0] === 0 && nat.slots[1] === 1 && nat.slots[2] === null,
  'the two opening events carry slots 0 and 1, and the third carries none', JSON.stringify(nat.slots));
check(nat.pairIds.length === 2 && nat.pairIds.every(Boolean),
  'both opening shields MATERIALISED and keep the VANGUARD close-screen role', JSON.stringify(nat.pairIds));
check(nat.laneSigns[0] === -1 && nat.laneSigns[1] === 1,
  'opening shield 0 takes the LEFT lane and shield 1 the RIGHT', JSON.stringify(nat.laneSigns));
check(nat.t.second === nat.t.s2 && nat.t.s2 >= nat.t.s1,
  'the front\'s clock starts when the SECOND SHIELD EXISTS, not at wave start or its telegraph', JSON.stringify(nat.t));
check(nat.released && nat.t.gate3 != null && nat.t.gate3 >= nat.t.release,
  'THE THIRD EVENT IS NOT SCHEDULED UNTIL THE FRONT RESOLVES', JSON.stringify(nat.t));
check(nat.capMade && nat.t.captain > nat.t.release, 'the Captain materialises after the release', JSON.stringify(nat.t));
check(nat.hold && nat.hold.da >= 110 && nat.hold.da <= 155 && nat.hold.db >= 110 && nat.hold.db <= 155,
  'the pair still settles at the close hold', JSON.stringify(nat.hold));
check(nat.hold && nat.hold.lanes.every((l) => l === null), 'and the lane is DROPPED at the hold — an ordinary screen from there', '');
check(nat.after.stillReleased, 'once released it never re-arms in that wave', '');
check(nat.after.laterShields >= 1 && nat.after.laterLaned === 0 && nat.after.laterScreened === nat.after.laterShields,
  'later VANGUARD shields are screens but never pair members', JSON.stringify(nat.after));
check(nat.cleared, 'the wave still clears normally', '');

// ── 2. The same run with `&nofront=1`: the queue is identical, the lanes are
// gone, and the drip does not wait. This is also the A/B for the lane: the
// pair's lateral separation with and without it.
const off = await run(A + '&nofront=1', async (page) => page.evaluate(async (fn) => {
  eval(`(${fn})()`);
  const gs = window.game.scene.getScene('Game');
  const L = window.__log;
  const P = { x: gs.player.x, y: gs.player.y };
  const plant = setInterval(() => { gs.player.setPosition(P.x, P.y); gs.player.setVelocity(0, 0); }, 30);
  const queue = (gs._spawnQueue || []).slice();
  await window.__poll(() => L.gate.filter((g) => g.wave === 1).length >= 3, 15000);
  const g = L.gate.filter((x) => x.wave === 1);
  // First two shields of the wave, identified by order of materialisation.
  await window.__poll(() => L.made.filter((m) => m.type === 'shielded').length >= 2, 10000);
  const [a, b] = L.made.filter((m) => m.type === 'shielded').map((m) => m.e);
  await window.__poll(() => a._screenHolding && b._screenHolding, 15000);
  const apartHold = Math.round(Math.hypot(a.x - b.x, a.y - b.y));
  clearInterval(plant);
  return {
    front: gs._vanguardFront, queue,
    gap23: Math.round(g[2].t - g[1].t), spawnRate: gs.arenaCfg.spawnRate,
    slots: g.slice(0, 3).map((x) => x.slot),
    lanes: [a._lane, b._lane], screens: [!!a._screen, !!b._screen],
    apartHold,
  };
}, helpers.toString()));
check(off.front === null && off.slots.every((s) => s === null) && off.lanes.every((l) => !l),
  '&nofront=1: no staging, no slots, no lanes', JSON.stringify(off.slots));
check(off.screens.every(Boolean), '&nofront=1 leaves the 140px close screen ON', '');
check(off.gap23 <= off.spawnRate * 3, '&nofront=1: the third event follows on the ordinary cadence',
  `${off.gap23}ms vs spawnRate ${off.spawnRate}`);
check(JSON.stringify(off.queue) === JSON.stringify(nat.queue),
  'THE VANGUARD QUEUE IS IDENTICAL with and without the staging — content and order', `${off.queue.join(',')}`);
check(nat.hold && nat.hold.apart >= 70 && nat.hold.apart > off.apartHold + 25,
  'the opening lanes SEPARATE the pair at the close hold (vs the same pair unlaned)',
  `laned ${nat.hold?.apart}px apart vs unlaned ${off.apartHold}px`);

// ── 3. Each release path, driven deterministically ────────────────────────
const drive = async (mode) => run(A, async (page) => page.evaluate(async ([fn, mode]) => {
  eval(`(${fn})()`);
  const gs = window.game.scene.getScene('Game');
  const L = window.__log;
  const f = gs._vanguardFront;
  const t0 = gs._waveStartedAt;
  const out = { mode };
  if (mode === 'breachEarly') {
    // Kill slot 0 the moment it exists, before the second is even there.
    await window.__poll(() => !!f.pair[0], 15000);
    f.pair[0].die();
    out.killedAt = Math.round(gs.time.now - t0);
  } else {
    await window.__poll(() => !!f.pair[0] && !!f.pair[1], 15000);
    out.second = Math.round(f.secondAt - t0);
    if (mode === 'breach') f.pair[1].die();
    if (mode === 'bothDead') { f.pair[0].die(); f.pair[1].die(); }
    if (mode === 'establish') {
      // Walk the player up to the front: 180px in front of the pair's midpoint.
      const [a, b] = f.pair;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const p = gs.player, dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy) || 1;
      p.setPosition(mx + dx / d * 150, my + dy / d * 150);
    }
    if (mode === 'surge') {
      out.holdAt0 = f.holdAt;
      gs.triggerSurge();
      await window.__wait(2600);
      out.stillHolding = !f.released;
      out.holdAtSame = f.holdAt === out.holdAt0;
      out.surgeShields = gs.enemies.getChildren().filter((e) => e.alive && e._archetype === 'shielded' && !f.pair.includes(e))
        .map((e) => ({ lane: !!e._lane, screen: !!e._screen }));
      out.pairSame = f.pair.length === 2;
    }
    if (mode === 'kite') {
      // Keep the player 600px behind wherever the front is — a backward kite.
      const stop = setInterval(() => {
        const [a, b] = f.pair;
        if (!a?.alive || !b?.alive) return;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const p = gs.player, dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy) || 1;
        if (d < 600) p.setPosition(mx + dx / d * 600, my + dy / d * 600);
      }, 30);
      window.__stopKite = stop;
    }
  }
  const ok = await window.__poll(() => f.released, 15000);
  if (window.__stopKite) clearInterval(window.__stopKite);
  out.released = ok; out.why = f.why;
  out.release = Math.round(f.releasedAt - t0);
  out.sinceSecond = f.secondAt != null ? Math.round(f.releasedAt - f.secondAt) : null;
  out.sinceSecondMs = Math.round(f.sinceSecondMs);
  out.timeoutMs = f.cfg.timeoutMs;
  // After release the drip resumes: a third event is scheduled.
  out.resumed = await window.__poll(() => L.gate.filter((g) => g.wave === 1).length >= 3, 8000);
  return out;
}, [helpers.toString(), mode]));

const est = await drive('establish');
check(est.released && est.why === 'established', 'the front releases when both opening shields are inside establishPx', JSON.stringify(est));
const br = await drive('breach');
check(br.released && br.why === 'breach' && br.resumed, 'killing an opening shield BREACHES the front and the backline releases', JSON.stringify(br));
const bre = await drive('breachEarly');
check(bre.released && bre.why === 'breach' && bre.resumed,
  'a shield killed before the second even exists still releases (no deadlock)', JSON.stringify(bre));
const both = await drive('bothDead');
check(both.released && both.why === 'breach' && both.resumed, 'both opening shields destroyed quickly: no deadlock', JSON.stringify(both));
const kite = await drive('kite');
check(kite.released && kite.why === 'timeout' && kite.resumed,
  'a player kiting away cannot freeze the wave — the timeout releases', JSON.stringify(kite));
check(kite.sinceSecondMs >= kite.timeoutMs && kite.sinceSecondMs <= kite.timeoutMs + 250 && kite.second > 0,
  'and the timeout runs from the second shield\'s MATERIALISATION, on game time',
  `${kite.sinceSecondMs}ms game / ${kite.sinceSecond}ms wall vs ${kite.timeoutMs}`);
const srg = await drive('surge');
check(srg.stillHolding && srg.holdAtSame && srg.pairSame,
  'a SURGE during the hold neither releases, re-arms nor resets the front', JSON.stringify(srg));
check(srg.surgeShields.every((s) => !s.lane && s.screen),
  'surge shields are VANGUARD screens but never opening-pair members', JSON.stringify(srg.surgeShields));

// ── 3b. `&wave=N` must not hand the reviewer the room's opening enemies ───
// In a real run those die before wave 1 can clear, so wave 2 never has them.
// Checked as a PAIR: present on an ordinary start, absent on a `&wave=2` one.
const withWave = await run(A + '&nofront=1', async (page) => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  return { room: gs.roomSpec.id, waveIdx: gs._waveIdx, alive: gs.enemies.getChildren().filter((e) => e.alive).length, spawned: gs._waveSpawned };
}));
const plain = await run('?nodlg=1&encdbg=1&room=hangar&sector=8', async (page) => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  return { room: gs.roomSpec.id, waveIdx: gs._waveIdx, alive: gs.enemies.getChildren().filter((e) => e.alive).length, spawned: gs._waveSpawned };
}));
check(plain.waveIdx === 0 && plain.alive >= 5,
  'an ordinary room start still has the room\'s authored opening enemies', JSON.stringify(plain));
check(withWave.waveIdx === 1 && withWave.alive <= withWave.spawned,
  '&wave=2 starts WITHOUT them — every living enemy came from this wave\'s own spawner', JSON.stringify(withWave));

// ── 4. Nothing outside VANGUARD arms it ───────────────────────────────────
const cf = await run('?nodlg=1&encdbg=1&room=hangar&sector=16&wave=3', async (page) => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  return { enc: gs._encounter?.id, front: gs._vanguardFront, placement: gs._placement };
}));
check(cf.enc === 'crossfire' && cf.front === null && cf.placement?.champion === 'captain',
  'CROSSFIRE + Captain: no front staging, placement intact', JSON.stringify(cf));
const sw = await run('?nodlg=1&encdbg=1&room=hangar&sector=8&wave=3', async (page) => page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  return { enc: gs._encounter?.id, front: gs._vanguardFront };
}));
check(sw.enc === 'swarmTide' && sw.front === null, 'a non-VANGUARD wave never arms it', JSON.stringify(sw));

await browser.close();

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
console.log(`\n  natural timeline (wall ms from wave start): ${JSON.stringify(nat.t)} release=${nat.why} after ${nat.gameSinceSecond}ms of GAME time from the 2nd shield`);
console.log(`  pair at hold: laned ${JSON.stringify(nat.hold)} vs unlaned ${off.apartHold}px apart · lateral at release ${nat.latAtRelease}px`);
console.log(`  nofront gap event2->event3: ${off.gap23}ms (spawnRate ${off.spawnRate})`);
console.log(`  kite: timeout after ${kite.sinceSecond}ms · establish: ${est.sinceSecond}ms after 2nd shield`);
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the VANGUARD front establishes before the backline, and nothing else moved`);
