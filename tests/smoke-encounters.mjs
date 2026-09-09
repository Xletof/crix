// Encounter composition — STRUCTURAL properties only.
//
// This file asserts that the authored table is well-formed and that the layer
// is wired to the real spawn path. It asserts NOTHING about whether a wave is
// fun, fair or well-balanced: those are handset questions and a number that
// claims to answer one is decoration. The one judgement encoded here is the
// A/B discriminator — an archetype whose composition is indistinguishable from
// the room's own mix would pass every "is it valid" check in the file, so the
// last section measures that the authored waves actually resolve to DIFFERENT
// type distributions from each other. A check that passes on the bug is
// decoration; "renamed probability soup" is the bug this pass exists against.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/?nodlg=1';
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
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 9001 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const enc = await import('/src/data/encounters.js');
  const cfg = await import('/src/config.js');
  const { makeStreams } = await import('/src/systems/rng.js');
  const { ROOMS } = await import('/src/data/rooms.js');
  const gs = window.game.scene.getScene('Game');

  const {
    ENCOUNTERS, ENCOUNTER_PLAN, ENCOUNTER_TYPES, GATE_MODES,
    encounterFor, buildSpawnQueue, pickGates, bandFor,
  } = enc;

  // ── Table validity ──────────────────────────────────────────────────────
  const badType = [];
  const badGate = [];
  const badMult = [];
  const emptyFill = [];
  for (const [key, e] of Object.entries(ENCOUNTERS)) {
    if (e.id !== key) badType.push(`${key}: id mismatch (${e.id})`);
    for (const t of e.lead || []) if (!ENCOUNTER_TYPES.includes(t)) badType.push(`${key}.lead: ${t}`);
    for (const t of e.fill || []) if (!ENCOUNTER_TYPES.includes(t)) badType.push(`${key}.fill: ${t}`);
    if (!GATE_MODES.includes(e.gate)) badGate.push(`${key}: ${e.gate}`);
    for (const k of ['countMult', 'maxAliveMult', 'spawnRateMult']) {
      const v = e[k];
      if (!(typeof v === 'number' && v > 0 && v <= 2)) badMult.push(`${key}.${k}=${v}`);
    }
    if (e.fill !== null && !(Array.isArray(e.fill) && e.fill.length)) emptyFill.push(key);
  }

  // Every enemy id the table names must be one the spawner can actually build.
  const spawnable = ENCOUNTER_TYPES.filter((t) => cfg.ENEMY[t]);

  // ── Plan validity ───────────────────────────────────────────────────────
  const roomIds = ROOMS.map((r) => r.id);
  const bossRoomIds = ROOMS.filter((r) => r.boss).map((r) => r.id);
  const badPlanRoom = Object.keys(ENCOUNTER_PLAN).filter((id) => !roomIds.includes(id));
  const bossInPlan = Object.keys(ENCOUNTER_PLAN).filter((id) => bossRoomIds.includes(id));
  const badPlanRef = [];
  const bands = ['early', 'mid', 'late'];
  for (const [room, byBand] of Object.entries(ENCOUNTER_PLAN)) {
    for (const b of bands) {
      const list = byBand[b];
      if (!list?.length) { badPlanRef.push(`${room}.${b}: missing`); continue; }
      for (const id of list) if (!ENCOUNTERS[id]) badPlanRef.push(`${room}.${b}: ${id}`);
    }
  }

  // ── Selector ────────────────────────────────────────────────────────────
  const bandsSeen = [bandFor(1), bandFor(4), bandFor(5), bandFor(12), bandFor(13), bandFor(60)];
  // A selector may only return an archetype its own arena/band list allows.
  const outOfBand = [];
  for (const [room, byBand] of Object.entries(ENCOUNTER_PLAN)) {
    for (const [sector, b] of [[1, 'early'], [8, 'mid'], [20, 'late']]) {
      for (let w = 0; w < 6; w++) {
        const e = encounterFor(room, w, sector);
        if (!e) { outOfBand.push(`${room} s${sector} w${w}: null`); continue; }
        if (!byBand[b].includes(e.id)) outOfBand.push(`${room} s${sector} w${w}: ${e.id} not in ${b}`);
      }
    }
  }
  const bossRoomNull = bossRoomIds.every((id) => encounterFor(id, 0, 5) === null
    && encounterFor(id, 1, 25) === null);

  // ── Queues ──────────────────────────────────────────────────────────────
  const rng = makeStreams(7, ['waves']).waves;
  const queueReport = {};
  const leadHonoured = [];
  const queueLen = [];
  const unknownInQueue = [];
  for (const [key, e] of Object.entries(ENCOUNTERS)) {
    const q = buildSpawnQueue(e, 12, rng);
    queueReport[key] = q.slice();
    if (e.fill === null) { if (q.length) leadHonoured.push(`${key}: mixed produced a queue`); continue; }
    if (q.length !== 12) queueLen.push(`${key}: ${q.length}`);
    // The lead is GUARANTEED and ORDERED — that is the whole claim.
    for (let i = 0; i < e.lead.length; i++) {
      if (q[i] !== e.lead[i]) leadHonoured.push(`${key}[${i}]: ${q[i]} != ${e.lead[i]}`);
    }
    for (const t of q) if (!ENCOUNTER_TYPES.includes(t)) unknownInQueue.push(`${key}: ${t}`);
  }
  // A short budget must truncate rather than overspend.
  const shortQ = buildSpawnQueue(ENCOUNTERS.vanguard, 3, rng);

  // ── Gates ───────────────────────────────────────────────────────────────
  const gateReport = {};
  const badGateRef = [];
  for (const room of ROOMS) {
    const gates = room.gates || [];
    const per = {};
    for (const mode of GATE_MODES) {
      const picked = pickGates(mode, gates, rng);
      per[mode] = picked.length;
      for (const g of picked) {
        if (!gates.some((q) => q.x === g.x && q.y === g.y)) badGateRef.push(`${room.id}/${mode}`);
      }
    }
    gateReport[room.id] = { gates: gates.length, ...per };
  }
  // `split` must genuinely be the widest-separated pair, or it is not two bearings.
  const splitIsWidest = ROOMS.every((room) => {
    const gates = room.gates || [];
    if (gates.length < 2) return true;
    const [a, b] = pickGates('split', gates, rng);
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    let max = 0;
    for (let i = 0; i < gates.length; i++)
      for (let j = i + 1; j < gates.length; j++)
        max = Math.max(max, Math.hypot(gates[i].x - gates[j].x, gates[i].y - gates[j].y));
    return Math.abs(d - max) < 0.001;
  });

  // ── Live wiring ─────────────────────────────────────────────────────────
  // The scene must actually be running one of these, with a valid budget.
  const live = {
    room: gs.roomSpec?.id,
    sector: gs.sector,
    waveIdx: gs._waveIdx,
    encounter: gs._encounter?.id ?? null,
    waveCount: gs._waveCount,
    maxAlive: gs.arenaCfg?.maxAlive,
    spawnRate: gs.arenaCfg?.spawnRate,
    queueIsArray: Array.isArray(gs._spawnQueue),
    hasNextType: typeof gs._nextEncounterType === 'function',
  };
  // Sector scaling must still run underneath: hp/speed multipliers are the
  // fields _applySectorScaling owns and nothing here may have eaten them.
  const scaling = { hp: gs.enemyHpMult, speed: gs.enemySpeedMult };

  // Every type the live queue can hand out must be spawnable.
  const liveTypes = new Set([...(gs._spawnQueue || []), ...(gs._encounter?.fill || [])]);
  const liveUnspawnable = [...liveTypes].filter((t) => !cfg.ENEMY[t]);

  // ── The A/B discriminator ───────────────────────────────────────────────
  // Resolve a representative wave per arena, both bands, and report the
  // composition as a type histogram. Then measure how different those
  // histograms are from each other. A table of renamed probability mixes
  // scores near zero here; authored composition does not.
  const dist = (q) => {
    const h = {};
    for (const t of q) h[t] = (h[t] || 0) + 1;
    const n = q.length || 1;
    for (const k of Object.keys(h)) h[k] /= n;
    return h;
  };
  const l1 = (a, b) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let s = 0;
    for (const k of keys) s += Math.abs((a[k] || 0) - (b[k] || 0));
    return s / 2;   // 0 = identical, 1 = disjoint
  };
  const samples = [];
  for (const room of ['hangar', 'corridor', 'detention']) {
    for (const sector of [1, 20]) {
      for (let w = 0; w < 3; w++) {
        const e = encounterFor(room, w, sector);
        if (!e) continue;
        const q = e.fill === null ? null : buildSpawnQueue(e, 12, rng);
        samples.push({ room, sector, wave: w + 1, id: e.id, name: e.name, gate: e.gate,
          q, d: q ? dist(q) : null });
      }
    }
  }
  const composed = samples.filter((s) => s.d);
  let minSep = 1, pairs = 0, sepSum = 0;
  const identical = [];
  for (let i = 0; i < composed.length; i++) {
    for (let j = i + 1; j < composed.length; j++) {
      if (composed[i].id === composed[j].id) continue;   // same archetype twice
      const s = l1(composed[i].d, composed[j].d);
      pairs++; sepSum += s; minSep = Math.min(minSep, s);
      if (s < 0.25) identical.push(`${composed[i].id} vs ${composed[j].id} = ${s.toFixed(2)}`);
    }
  }

  return {
    badType, badGate, badMult, emptyFill, spawnable,
    badPlanRoom, bossInPlan, badPlanRef, bandsSeen, outOfBand, bossRoomNull,
    queueReport, leadHonoured, queueLen, unknownInQueue, shortQ,
    gateReport, badGateRef, splitIsWidest,
    live, scaling, liveUnspawnable,
    samples: samples.map((s) => ({ ...s, q: s.q ? s.q.join(' ') : '(room mix)' })),
    minSep, meanSep: pairs ? sepSum / pairs : 0, identical, pairs,
  };
});

await browser.close();

// ── Table ──────────────────────────────────────────────────────────────────
check(r.badType.length === 0, 'every archetype names only real enemy ids', r.badType.join('; '));
check(r.spawnable.length === 6, 'all six declared types exist in ENEMY config', `${r.spawnable.length}/6`);
check(r.badGate.length === 0, 'every archetype declares a legal gate mode', r.badGate.join('; '));
check(r.badMult.length === 0, 'pressure multipliers are positive and bounded', r.badMult.join('; '));
check(r.emptyFill.length === 0, 'a fill pool is either null or non-empty', r.emptyFill.join('; '));

// ── Plan ───────────────────────────────────────────────────────────────────
check(r.badPlanRoom.length === 0, 'the plan only references rooms that exist', r.badPlanRoom.join('; '));
check(r.bossInPlan.length === 0, 'THE BOSS ROOM IS NOT IN THE PLAN — its waves are untouched', r.bossInPlan.join('; '));
check(r.badPlanRef.length === 0, 'every band of every planned arena names real archetypes', r.badPlanRef.join('; '));
check(r.bandsSeen.join(',') === 'early,early,mid,mid,late,late',
  'sector bands split at 4/12 as authored', r.bandsSeen.join(','));
check(r.outOfBand.length === 0, 'the selector only returns archetypes its own band allows', r.outOfBand.slice(0, 4).join('; '));
check(r.bossRoomNull, 'the selector returns null for the boss room at every sector', '');

// ── Queues ─────────────────────────────────────────────────────────────────
check(r.leadHonoured.length === 0, 'the lead is guaranteed AND ordered — the composition claim', r.leadHonoured.slice(0, 4).join('; '));
check(r.queueLen.length === 0, 'a composed queue is exactly the wave budget', r.queueLen.join('; '));
check(r.unknownInQueue.length === 0, 'a built queue contains only real enemy ids', r.unknownInQueue.join('; '));
check(r.shortQ.length === 3, 'a short budget truncates the lead rather than overspending', `${r.shortQ.length}`);

// ── Gates ──────────────────────────────────────────────────────────────────
check(r.badGateRef.length === 0, 'no encounter can reference a gate the room does not have', r.badGateRef.join('; '));
check(Object.values(r.gateReport).every((g) => g.any === 0 && g.single === 1 && g.split === Math.min(2, g.gates) && g.spread === g.gates),
  'gate modes resolve to the right shape in every room', JSON.stringify(r.gateReport));
check(r.splitIsWidest, 'split really is the two most opposed gates, not just two gates', '');

// ── Live wiring ────────────────────────────────────────────────────────────
check(r.live.hasNextType, 'the scene exposes the encounter spawn path', '');
check(r.live.encounter !== null, 'a live ordinary wave is running an authored encounter', `${r.live.room} w${r.live.waveIdx}`);
check(r.live.waveCount >= 2 && r.live.maxAlive >= 3 && r.live.spawnRate >= 220,
  'the live budget stays inside its floors after the pressure multipliers',
  `count ${r.live.waveCount} maxAlive ${r.live.maxAlive} rate ${r.live.spawnRate}`);
check(r.liveUnspawnable.length === 0, 'every type the live wave can hand out is spawnable', r.liveUnspawnable.join('; '));
check(r.scaling.hp >= 1 && r.scaling.speed >= 1, 'sector scaling still applies underneath',
  `hp ${r.scaling.hp} speed ${r.scaling.speed}`);

// ── The discriminator ──────────────────────────────────────────────────────
check(r.identical.length === 0,
  'NO TWO ARCHETYPES RESOLVE TO THE SAME COMPOSITION — the renamed-soup check',
  r.identical.slice(0, 4).join('; '));
check(r.minSep >= 0.25, 'the closest pair of distinct archetypes still differs materially',
  `min separation ${r.minSep.toFixed(2)} over ${r.pairs} pairs`);

console.log('\n  ── resolved waves (12-event budget) ───────────────────────────');
for (const s of r.samples) {
  console.log(`  ${s.room.padEnd(10)} s${String(s.sector).padStart(2)} w${s.wave}  ${s.name.padEnd(14)} ${s.gate.padEnd(7)} ${s.q}`);
}
console.log(`\n  mean pairwise composition separation: ${r.meanSep.toFixed(2)} (0 = identical, 1 = disjoint)\n`);

for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the encounter table is well-formed, wired, and not renamed soup`);
