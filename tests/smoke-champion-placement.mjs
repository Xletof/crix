// THE ROSTER, PHASE B — Champion production placement. STRUCTURE ONLY.
//
// The Shock Captain is frozen (V1, `6560c62`). What this file protects is the
// placement layer around him: WHERE he is allowed to appear in a real Endless
// run, what he costs the encounter he appears in, and that he goes through the
// real wave lifecycle. It asserts nothing about whether the result is fun,
// fair, readable or "reads as an officer" — those are handset questions, and a
// check that pretended to answer them would be decoration.
//
// Every live check reads the REAL resolver (`_resolveEncounter`) and the real
// spawner (`spawnAtGate` -> `_spawnPlacedChampion` -> `spawnChampion`). The
// placement-free baseline is the same seed, the same URL and `&nochamp=1`, so
// the only difference between the pair is the placement itself.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';

const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASELINE = '6560c62';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok: !!ok, label, detail }); };

// ── 0. THE CAPTAIN IS BYTE-IDENTICAL TO THE APPROVED BASELINE ─────────────
//
// Read from git rather than from a copy of the numbers, so the check cannot
// drift with the thing it guards. `config.js` changed in this pass (SCORE), so
// its CHAMPION block is compared on its own.
{
  const sh = (cmd) => execSync(cmd, { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' });
  let ok = true, detail = '';
  try {
    sh(`git cat-file -e ${BASELINE}^{commit}`);
    const frozenFiles = [
      'src/entities/ShockCaptain.js', 'src/entities/Enemy.js', 'src/systems/Hazard.js',
      'src/data/champions.js', 'src/systems/pixelArt.js',
    ];
    const diff = sh(`git diff --stat ${BASELINE} -- ${frozenFiles.join(' ')}`).trim();
    ok = diff === '';
    detail = diff || frozenFiles.join(', ');
    check(ok, 'THE CAPTAIN\'S ACTOR, BASE CLASS, GRENADE, MOVES AND ART ARE UNCHANGED since the approved baseline', detail);
    const block = (src) => {
      const a = src.indexOf('export const CHAMPION = {');
      const b = src.indexOf('\nexport const ', a + 10);
      return a < 0 ? null : src.slice(a, b);
    };
    const before = block(sh(`git show ${BASELINE}:src/config.js`));
    const now = block(sh('cat src/config.js'));
    check(before && before === now, 'the CHAMPION config block is byte-identical to the approved baseline',
      before ? `${before.length} vs ${now?.length}` : 'block not found');
  } catch (e) {
    check(false, `the approved baseline ${BASELINE} must be reachable in git to prove the freeze`, String(e).slice(0, 120));
  }
}

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

/** Boot an endless run at `query` with `seed`, and hand the page to `fn`. */
async function run(query, fn, seed = 4242) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`page error (${query}): ${e}`));
  await page.goto(BASE + query);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  await page.evaluate((s) => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: s }), seed);
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForFunction(() => !!window.game.scene.getScene('Game')._wave, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  const out = await fn(page);
  await page.close();
  return out;
}

/** What the resolver decided for the wave that is running. Pure read. */
const snap = () => {
  const gs = window.game.scene.getScene('Game');
  return {
    room: gs.roomSpec?.id, sector: gs.sector, waveIdx: gs._waveIdx,
    enc: gs._encounter?.id ?? null,
    placement: gs._placement ? { ...gs._placement } : null,
    queue: (gs._spawnQueue || []).slice(),
    waveCount: gs._waveCount,
    maxAlive: gs.arenaCfg?.maxAlive, spawnRate: gs.arenaCfg?.spawnRate,
    champs: gs.enemies.getChildren().filter((e) => e.alive && e.isChampion).length,
  };
};

// ── 1. THE TABLE, SWEPT — pure, against the real plan ─────────────────────
const table = await run('?nodlg=1', async (page) => page.evaluate(async () => {
  const E = await import('/src/data/encounters.js');
  const { ENDLESS } = await import('/src/config.js');
  const { ROOMS } = await import('/src/data/rooms.js');
  const ids = Object.keys(E.ENCOUNTERS);
  const arenas = [...ROOMS.map((r) => r.id)];
  const hits = [];
  const preVader = [];
  for (const a of arenas) {
    for (let s = 1; s <= 40; s++) {
      for (let w = 0; w < 4; w++) {
        const nat = E.encounterFor(a, w, s);
        // Every archetype, not only the natural one: a debug force must not be
        // able to reach a placement the table does not name either.
        for (const id of ids) {
          const p = E.championPlacementFor(a, w, s, id);
          if (!p) continue;
          if (s < ENDLESS.bossEvery) preVader.push(`${a} s${s} w${w} ${id}`);
          hits.push({ a, s, w, id, natural: nat?.id ?? null });
        }
      }
    }
  }
  const pools = Object.values(E.ENCOUNTERS).flatMap((e) => [...(e.lead || []), ...(e.fill || [])]);
  // The applied queue on a synthetic list, so the budget arithmetic is pinned
  // independently of any rng.
  const q = ['shielded', 'shielded', 'shooter', 'shielded', 'shooter', 'a', 'b', 'c', 'd'];
  const applied = E.CHAMPION_PLACEMENTS.map((p) => E.applyChampionPlacement(q, p));
  return {
    bossEvery: ENDLESS.bossEvery,
    hits, preVader,
    rows: E.CHAMPION_PLACEMENTS.map((p) => ({
      ...p,
      planCell: E.ENCOUNTER_PLAN[p.arena]?.[p.band]?.[p.wave] ?? null,
    })),
    placeable: E.PLACEABLE_CHAMPIONS.slice(),
    poolNamesChampion: pools.filter((t) => E.PLACEABLE_CHAMPIONS.includes(t)).length,
    applied, q,
    vaderPlanned: !!E.ENCOUNTER_PLAN.vader,
  };
}));

check(table.preVader.length === 0,
  `NO PLACEMENT RESOLVES BEFORE THE FIRST VADER (sectors 1-${table.bossEvery - 1}), for any arena, wave or archetype`,
  table.preVader.join('; '));
check(table.rows.length >= 1 && table.rows.length <= 4,
  'the placement table is a handful of authored rows, not a distribution', `${table.rows.length}`);
check(table.rows.every((r) => r.planCell === r.encounter),
  'every row names the archetype its own plan cell already resolves to',
  table.rows.map((r) => `${r.arena}/${r.band}/${r.wave}: ${r.encounter} vs ${r.planCell}`).join('; '));
check(table.rows.every((r) => r.band !== 'early'), 'no row lives in the early (teaching) band', '');
check(table.placeable.length === 1 && table.placeable[0] === 'captain'
  && table.rows.every((r) => r.champion === 'captain'),
  'the only placeable Champion is the approved Shock Captain', table.placeable.join(','));
check(table.poolNamesChampion === 0, 'no encounter POOL can name a Champion — placement is the only door', '');
check(table.rows.every((r) => ['vanguard', 'crossfire'].includes(r.encounter)),
  'placements are VANGUARD and CROSSFIRE only', table.rows.map((r) => r.encounter).join(','));
for (const forbidden of ['swarmTide', 'sniperNest', 'bomberRun', 'mixed']) {
  check(!table.hits.some((h) => h.id === forbidden),
    `${forbidden.toUpperCase()} can never carry a placement, natural or forced`, '');
}
check(!table.vaderPlanned && !table.rows.some((r) => r.arena === 'vader') && !table.hits.some((h) => h.a === 'vader'),
  'THE BOSS ROOM carries no placement, at any sector', '');
check(!table.rows.some((r) => r.arena === 'detention' && r.wave >= 3),
  'no row names the detention duel wave', '');
// Every naturally-reached hit is exactly one authored row; nothing else fires.
const natural = table.hits.filter((h) => h.id === h.natural);
const expectKeys = new Set(table.rows.map((r) => `${r.arena}/${r.band}/${r.wave}`));
const band = (s) => (s <= 4 ? 'early' : s <= 12 ? 'mid' : 'late');
check(natural.every((h) => expectKeys.has(`${h.a}/${band(h.s)}/${h.w}`)),
  'every placement the natural plan reaches is one of the authored rows', '');
check(table.applied.every((a) => a.filter((t) => t === 'captain').length === 1),
  'applying a placement yields EXACTLY ONE Champion token', '');
check(table.applied.every((a, i) => a.length === table.q.length - (table.rows[i].cost - 1)),
  'and the queue shrinks by cost - 1 events (he consumes budget, he is not added)',
  table.applied.map((a) => a.length).join(','));
check(table.applied.every((a, i) => a.slice(0, table.rows[i].slot).join() === table.q.slice(0, table.rows[i].slot).join()),
  'the lead AHEAD of his slot is untouched — the archetype still opens as authored', '');

// ── 2. THE FIRST CASE, LIVE — VANGUARD + CAPTAIN vs the matched baseline ──
const A = '?nodlg=1&encdbg=1&room=hangar&sector=8&wave=2';
const withCap = await run(A, async (page) => page.evaluate(snap));
const withoutCap = await run(A + '&nochamp=1', async (page) => page.evaluate(snap));

check(withCap.room === 'hangar' && withCap.sector === 8 && withCap.waveIdx === 1,
  '&wave=2 lands the harness on the placement cell', `${withCap.room} s${withCap.sector} w${withCap.waveIdx}`);
check(withCap.enc === 'vanguard' && withoutCap.enc === 'vanguard',
  'both halves of the pair run the real VANGUARD', `${withCap.enc}/${withoutCap.enc}`);
check(!!withCap.placement && withCap.placement.champion === 'captain', 'the authored placement resolves', '');
check(withoutCap.placement === null && !withoutCap.queue.includes('captain'),
  '&nochamp=1 suppresses it — the matched baseline has no Captain', withoutCap.queue.join(','));
check(withCap.queue.filter((t) => t === 'captain').length === 1 && withCap.queue[withCap.placement?.slot] === 'captain',
  'EXACTLY ONE Captain token, in his authored lead slot', withCap.queue.join(','));
check(withCap.waveCount === withoutCap.waveCount - (withCap.placement?.cost - 1),
  'HE CONSUMES BUDGET: the wave has cost - 1 fewer spawn events than the matched baseline',
  `${withCap.waveCount} vs ${withoutCap.waveCount}`);
check(withCap.queue.filter((t) => t !== 'captain').length === withoutCap.queue.length - withCap.placement?.cost,
  'and cost fewer ORDINARY bodies', `${withCap.queue.length - 1} vs ${withoutCap.queue.length}`);
check(withCap.queue.every((t, i) => i === withCap.placement?.slot || t === withoutCap.queue[i]),
  'every other event is the SAME event, in the same order — no hidden reroll', '');
check(withCap.maxAlive === withoutCap.maxAlive && withCap.spawnRate === withoutCap.spawnRate,
  'cap and cadence are untouched — no hidden pressure increase', `${withCap.maxAlive}/${withCap.spawnRate}`);
check(withCap.queue.slice(0, 2).every((t) => t === 'shielded'),
  'the shields still lead — VANGUARD opens as VANGUARD', withCap.queue.slice(0, 3).join(','));

// ── 3. THE LIFECYCLE — spawn, one only, clear waits, death clears, teardown ─
const life = await run(A + '&champdbg=1', async (page) => page.evaluate(async () => {
  const { setGodMode } = await import('/src/systems/debug.js');
  const { CHAMPION, SCORE } = await import('/src/config.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const poll = async (fn, ms = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (fn()) return true; await wait(100); }
    return false;
  };
  // Drip fast — this is a lifecycle test, not a cadence test.
  gs.arenaCfg.spawnRate = 60;
  const alive = () => gs.enemies.getChildren().filter((e) => e.alive);
  const champs = () => alive().filter((e) => e.isChampion);
  const drained = await poll(() => gs._wavePhase === 'clearing');
  await wait(1200);   // the last gate telegraph is 600ms
  const c = champs()[0];
  const out = {
    drained,
    injectedAlongside: gs._maybeInjectChampion(gs._wave),
    champCount: champs().length,
    isCaptain: c?.constructor?.name === 'ShockCaptain' && c?._championId === 'captain',
    frozen: c ? {
      hp: c.hp, armour: c.armour, elite: !!c._elite, miniBoss: !!c._miniBoss, nemesis: !!c._nemesis,
      speed: c.cfg?.speed, scale: c.scaleX, radius: c.cfg?.radius,
    } : null,
    def: { hp: CHAMPION.captain.hp, armour: CHAMPION.captain.armour, speed: CHAMPION.captain.speed, radius: CHAMPION.captain.radius },
    boss: !!gs.boss,
    scoreFor: c ? gs.scoreForEnemy(c) : null,
    scoreChampion: SCORE.champion,
  };
  // CLEAR WAITS FOR HIM: every ordinary enemy dead, the Captain alive.
  for (const e of alive()) if (!e.isChampion) e.die();
  await wait(1500);
  out.phaseWithCaptainAlive = gs._wavePhase;
  // HIS DEATH CANNOT LEAVE THE WAVE STUCK: kill him through the real damage
  // path, armour first, and watch the wave machine move on.
  const scores = [];
  gs.events.on('score-changed', (_t, n) => scores.push(n));
  // Count the room's death CALLS rather than read `aliveEnemies`: that total
  // drifts on its own (a room's authored `spec.enemies` register before
  // `setRoom` zeroes it, so it clamps at 0 early) and the wave machine never
  // reads it — `_livingEnemyCount()` is the authority.
  const rm = gs.roomManager;
  const orig = rm.onEnemyDied;
  let deaths = 0;
  rm.onEnemyDied = function (...a) { deaths++; return orig.apply(this, a); };
  for (let i = 0; i < 60 && c.alive; i++) c.damage(2000);
  rm.onEnemyDied = orig;
  out.captainDead = !c.alive;
  out.rmDelta = deaths;
  out.advanced = await poll(() => gs._wavePhase === 'breather' || gs._waveIdx > 1, 6000);
  out.killScore = scores[0] ?? null;
  return out;
}));
check(life.drained, 'the wave drains through the real spawner', '');
check(life.champCount === 1 && life.isCaptain, 'the placement puts EXACTLY ONE Shock Captain on the floor',
  `${life.champCount}`);
check(life.injectedAlongside === null,
  'the debug injector STANDS DOWN on a placement wave — the two paths never stack', `${life.injectedAlongside}`);
check(life.frozen && life.frozen.hp === life.def.hp && life.frozen.armour === life.def.armour,
  'he arrives at the frozen 3400 + 1900 — no sector hp ramp, no elite roll',
  JSON.stringify(life.frozen));
check(life.frozen && !life.frozen.elite && !life.frozen.miniBoss && !life.frozen.nemesis,
  'not an elite, not a mini-boss, not a nemesis', '');
check(life.frozen && life.frozen.speed === life.def.speed && life.frozen.radius === life.def.radius,
  'speed and body are the approved values — no sector speed ramp', `${life.frozen?.speed} vs ${life.def.speed}`);
check(!life.boss, 'no boss is spawned, so no boss bar exists', '');
check(life.scoreFor === life.scoreChampion && life.scoreChampion === 1500,
  'he scores the flat Champion tier (1500), not the grunt fallback', `${life.scoreFor}`);
check(life.phaseWithCaptainAlive === 'clearing',
  'WAVE CLEAR WAITS FOR HIM — every ordinary enemy dead, Captain alive, wave still clearing', life.phaseWithCaptainAlive);
check(life.captainDead, 'the real damage path kills him', '');
check(life.rmDelta === 1, 'his death reaches the room exactly once', `${life.rmDelta}`);
check(life.advanced, 'HIS DEATH CANNOT LEAVE THE WAVE STUCK — the wave clears and moves on', '');
check(life.killScore === life.scoreChampion, 'the kill pays exactly the Champion value', `${life.killScore}`);

// ── 4. ROOM TEARDOWN takes him with the room ──────────────────────────────
const tear = await run(A, async (page) => page.evaluate(async () => {
  const { setGodMode } = await import('/src/systems/debug.js');
  const { ROOMS } = await import('/src/data/rooms.js');
  setGodMode(true);
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.arenaCfg.spawnRate = 60;
  const t0 = Date.now();
  let c = null;
  while (!c && Date.now() - t0 < 20000) {
    c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
    await wait(100);
  }
  const had = !!c;
  gs.loadRoom(ROOMS.find((r) => r.id === 'corridor'));
  await wait(800);
  return {
    had,
    destroyed: !!c && !c.scene && !c.active,
    weaponGone: !c?.weaponSprite?.scene,
    left: gs.enemies.getChildren().filter((e) => e.isChampion).length,
    hazards: gs._hazards?.length ?? 0,
  };
}));
check(tear.had, 'a Captain was live before the room change', '');
check(tear.destroyed && tear.weaponGone && tear.left === 0,
  'ROOM TEARDOWN REMOVES HIM — actor and rifle destroyed, none carried into the next room', JSON.stringify(tear));

// ── 5. EXCLUSIONS, LIVE — the forced archetypes, the boss, the duel, early ─
const excl = [];
for (const [label, q] of [
  ['SWARM TIDE forced onto the placement cell', '?nodlg=1&encdbg=swarmTide&room=hangar&sector=8&wave=2'],
  ['SNIPER NEST forced onto the placement cell', '?nodlg=1&encdbg=sniperNest&room=hangar&sector=8&wave=2'],
  ['BOMBER RUN forced onto the placement cell', '?nodlg=1&encdbg=bomberRun&room=hangar&sector=8&wave=2'],
  ['VANGUARD at the same cell before the first Vader (sector 4)', '?nodlg=1&encdbg=vanguard&room=hangar&sector=4&wave=2'],
  ['the other mid-band hangar waves', '?nodlg=1&encdbg=1&room=hangar&sector=8&wave=1'],
  ['late hangar VANGUARD — not every VANGUARD carries him', '?nodlg=1&encdbg=1&room=hangar&sector=16&wave=1'],
  ['the Vader chamber at a boss sector', '?nodlg=1&encdbg=vanguard&room=vader&sector=10'],
  ['the Nemesis duel wave', '?nodlg=1&encdbg=vanguard&room=detention&sector=16&wave=4'],
  ['the Reactor Junction VANGUARD in the mid band', '?nodlg=1&encdbg=1&room=corridor&sector=9&wave=2'],
]) {
  const r = await run(q, async (page) => page.evaluate(snap));
  excl.push({ label, r });
  check(r.placement === null && !r.queue.includes('captain') && r.champs === 0,
    `no Captain: ${label}`, `${r.room} s${r.sector} w${r.waveIdx} ${r.enc} ${r.queue.join(',')}`);
}

// ── 6. THE LATE CASE, and seeded reproducibility ──────────────────────────
const C = '?nodlg=1&encdbg=1&room=hangar&sector=16&wave=3';
const c1 = await run(C, async (page) => page.evaluate(snap), 4242);
const c2 = await run(C, async (page) => page.evaluate(snap), 4242);
const c3 = await run(C, async (page) => page.evaluate(snap), 90210);
check(c1.enc === 'crossfire' && c1.placement?.champion === 'captain',
  'the late CROSSFIRE cell carries its authored placement', `${c1.enc}`);
check(c1.queue.filter((t) => t === 'captain').length === 1, 'exactly one Captain token there too', c1.queue.join(','));
check(c1.queue.slice(0, c1.placement?.slot).every((t) => t === 'shooter'),
  'the opposed shooters still open CROSSFIRE', c1.queue.slice(0, 3).join(','));
check(JSON.stringify(c1.queue) === JSON.stringify(c2.queue) && c1.waveCount === c2.waveCount,
  'THE SAME SEED REPRODUCES THE SAME WAVE, Captain included', '');
check(c3.placement?.slot === c1.placement?.slot && c3.queue[c3.placement?.slot] === 'captain' && c3.waveCount === c1.waveCount,
  'and a DIFFERENT seed still places him in the same cell, slot and budget — placement is authored, not rolled', '');

// ── 7. The existing negative half still holds at sector 1 ─────────────────
const s1 = await run('?nodlg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const seen = [];
  for (let w = 0; w < 3; w++) {
    gs._startWave(w);
    await wait(300);
    seen.push({ w, placement: gs._placement, cap: (gs._spawnQueue || []).includes('captain') });
  }
  return { sector: gs.sector, mode: gs.mode, seen };
}));
check(s1.sector === 1 && s1.seen.every((x) => !x.placement && !x.cap),
  'a fresh production run places no Captain in any sector-1 wave', JSON.stringify(s1.seen));

await browser.close();

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
console.log('\n  placement cells:');
for (const r of table.rows) console.log(`    ${r.arena} ${r.band} wave ${r.wave + 1}  ${r.encounter}  slot ${r.slot}  cost ${r.cost}`);
console.log(`  VANGUARD s8 w2: ${withCap.queue.join(',')}  (baseline ${withoutCap.queue.join(',')})`);
console.log(`  CROSSFIRE s16 w3: ${c1.queue.join(',')}`);
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the Captain is placed by authorship, consumes budget, and lives the real wave lifecycle`);
