// A/B: the player bottleneck, measured.
//
// The claim Phase A is testing is that the three ordinary arenas used to fight
// the same way. That is checkable rather than arguable: the BASELINE type
// distribution is whatever `_rollEnemyType` produces from a room's cumulative
// mix fields, and this drives the REAL method on the REAL scene — arenaCfg is
// pointed at each room/wave's merged config in turn and restored afterwards —
// so there is no second implementation to drift from the game.
//
// Print-only. It reports numbers for comparison and asserts nothing; the
// structural gate is `smoke-encounters`.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/?nodlg=1';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => { console.error('page error:', e); process.exit(1); });

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 31337 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const { ARENA } = await import('/src/config.js');
  const { encounterFor, buildSpawnQueue } = await import('/src/data/encounters.js');
  const { makeStreams } = await import('/src/systems/rng.js');
  const gs = window.game.scene.getScene('Game');
  const ROOMS3 = ['hangar', 'corridor', 'detention'];
  const N = 600;

  const dist = (list) => {
    const h = {};
    for (const t of list) h[t] = (h[t] || 0) + 1;
    const o = {};
    for (const k of Object.keys(h)) o[k] = h[k] / list.length;
    return o;
  };
  const sep = (a, b) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let s = 0;
    for (const k of keys) s += Math.abs((a[k] || 0) - (b[k] || 0));
    return s / 2;
  };

  // ── BASELINE: the real _rollEnemyType, per room/wave ────────────────────
  const saved = gs.arenaCfg;
  const base = [];
  for (const id of ROOMS3) {
    const room = ARENA[id];
    room.waves.forEach((w, i) => {
      if (w.miniBoss) return;                       // duel wave, no drip
      gs.arenaCfg = { ...room, ...w };
      const out = [];
      for (let n = 0; n < N; n++) out.push(gs._rollEnemyType());
      base.push({ room: id, wave: i + 1, label: 'room mix', d: dist(out) });
    });
  }
  gs.arenaCfg = saved;

  // ── PHASE A: the authored queues for the same waves ─────────────────────
  const rng = makeStreams(31337, ['waves']).waves;
  const mk = (id, sector) => {
    const room = ARENA[id];
    const out = [];
    room.waves.forEach((w, i) => {
      if (w.miniBoss) return;
      const e = encounterFor(id, i, sector);
      // `mixed` has no pool: it IS the baseline path, reported as such.
      if (!e || !e.fill) { out.push({ room: id, wave: i + 1, label: 'MIXED (room mix)', d: base.find((b) => b.room === id && b.wave === i + 1).d }); return; }
      const acc = [];
      for (let k = 0; k < 40; k++) acc.push(...buildSpawnQueue(e, Math.max(2, Math.round(w.count * e.countMult)), rng));
      out.push({ room: id, wave: i + 1, label: e.name, gate: e.gate, d: dist(acc) });
    });
    return out;
  };
  const early = ROOMS3.flatMap((id) => mk(id, 1));
  const late = ROOMS3.flatMap((id) => mk(id, 20));

  const spreadOf = (rows) => {
    let min = 1, max = 0, sum = 0, n = 0;
    for (let i = 0; i < rows.length; i++)
      for (let j = i + 1; j < rows.length; j++) {
        const s = sep(rows[i].d, rows[j].d);
        min = Math.min(min, s); max = Math.max(max, s); sum += s; n++;
      }
    return { min, max, mean: n ? sum / n : 0, n };
  };

  // Cross-arena only: "do the three rooms fight the same?" is a question about
  // rooms, so this compares wave i of one arena against wave i of another.
  const crossArena = (rows) => {
    let sum = 0, n = 0, min = 1;
    for (let i = 0; i < rows.length; i++)
      for (let j = i + 1; j < rows.length; j++) {
        if (rows[i].room === rows[j].room) continue;
        const s = sep(rows[i].d, rows[j].d);
        sum += s; n++; min = Math.min(min, s);
      }
    return { mean: n ? sum / n : 0, min, n };
  };

  return {
    base, early, late,
    baseSpread: spreadOf(base), earlySpread: spreadOf(early), lateSpread: spreadOf(late),
    baseCross: crossArena(base), earlyCross: crossArena(early), lateCross: crossArena(late),
  };
});

await browser.close();

const ORDER = ['grunt', 'shooter', 'shielded', 'sniper', 'bomber', 'swarmling'];
const row = (r) => ORDER.map((t) => `${t.slice(0, 5).padEnd(5)} ${((r.d[t] || 0) * 100).toFixed(0).padStart(3)}%`).join('  ');
const show = (title, rows) => {
  console.log(`\n  ${title}`);
  for (const x of rows) {
    console.log(`  ${x.room.padEnd(10)} w${x.wave}  ${(x.label || '').padEnd(16)} ${row(x)}`);
  }
};

console.log('\n══ A/B — DOES COMPOSITION CHANGE THE FIGHT? ═══════════════════════════');
show('CURRENT BUILD — the room\'s own cumulative mix, sampled 600x through _rollEnemyType', r.base);
show('PHASE A — sector 1 (early band)', r.early);
show('PHASE A — sector 20 (late band)', r.late);

const line = (l, s) => console.log(`  ${l.padEnd(34)} mean ${s.mean.toFixed(2)}   min ${s.min.toFixed(2)}   max ${(s.max ?? 0).toFixed(2)}   over ${s.n} pairs`);
console.log('\n  ── pairwise separation, ALL waves (0 = identical fight, 1 = disjoint) ──');
line('current build', r.baseSpread);
line('Phase A, sector 1', r.earlySpread);
line('Phase A, sector 20', r.lateSpread);

const line2 = (l, s) => console.log(`  ${l.padEnd(34)} mean ${s.mean.toFixed(2)}   min ${s.min.toFixed(2)}   over ${s.n} pairs`);
console.log('\n  ── CROSS-ARENA only: do the three rooms fight differently? ──');
line2('current build', r.baseCross);
line2('Phase A, sector 1', r.earlyCross);
line2('Phase A, sector 20', r.lateCross);
console.log('');
