// SMOKE: PHASE 3C — the ordinary Marksman's stuck-recovery candidates
// (`?marksmanStuck=prog` = Candidate A, `?marksmanStuck=early` = Candidate B;
// src/systems/marksmanStuck.js). Standalone, like the roster smokes.
//
// Every candidate check is paired with the frozen baseline (no flag) so the
// suite can tell the two apart: run it with `--base=` pointed at an f752b3f
// server and the candidate checks fail there, because that build has no flag.
//
//   1  flag-off is the frozen game: same seeded SNIPER NEST + MIXED as f752b3f,
//      tick for tick and draw for draw; nothing installed without the flag
//   2  the unobstructed first check no longer moves a Marksman sideways
//   3  holding in the band leaves no actionable recovery behind
//   4  hold -> approach walks at the player, not across
//   5  retreat direction and speed are the frozen ones, tick for tick
//   6  the band thresholds (300 / 560 + 80) and their branches are unchanged
//   7  charge and lock timing are unchanged
//   8  losing LOS still cancels a charge, with the frozen 500ms re-arm
//   9  every shot leaves on its locked angle
//  10  genuine cover still triggers recovery and the Marksman gets round; B
//      keeps / arms on a pinned approach, A waits a window
//  11  Regular and Elite are both covered
//  12  the nemesis Marksman is excluded
//  13  every other archetype is untouched, all of them on the floor at once
//  14  the approved Bulwark Candidate B is unaffected
//  15  RNG: the candidates make no draw; any divergence is attributable
//  16  no listeners, timers or tweens are left behind (death, room change)
//
// usage: node tests/smoke-marksman-stuck.mjs [--base=URL] [--old=URL of an f752b3f server, default :5174]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { CHROME, bootPage, installAudit, installStaged, encounterRun, firstCheck } from './diag-stuck-audit.mjs';
import { installMkRig, rowsOf, charges, lateral, resumes, MK, MKE, SC, CHARGE, OBST } from './diag-marksman-stuck.mjs';
import { enemyJsGuard } from './enemy-frozen.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = opt('base', 'http://localhost:5173/');
const OLD = opt('old', 'http://localhost:5174/');
const ROOT = new URL('../', import.meta.url).pathname;
const FROZEN = 'f752b3f';
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
// a page carrying the Phase 3A instrument and the Marksman rig
const page = async (flags = '', base = BASE, q) => {
  const p = await bootPage(browser, { base, flags, ...(q ? { q } : {}) });
  await installAudit(p, 'A');
  await installMkRig(p);
  await p.evaluate(() => { window.__headless = true; });
  return p;
};
const mk = (p, sc) => p.evaluate((sc) => window.__mkRun(sc), sc);
// the plain staged harness, for actors other than a single Marksman
const run = (p, sc) => p.evaluate(async (sc) => {
  await window.__audSetup(sc);
  for (let i = 0; i < sc.ticks; i++) window.__audStep();
  const A = window.__aud;
  const own = A.recs.map((r) => ({ type: r.type, nem: r.nem, mk: !!r.e._marksmanStuck, blw: !!r.e._bulwarkStuck, blwLog: r.e._bulwarkStuck ? { ...r.e._bulwarkStuck.log } : null }));
  return { ...window.__audCollect(), own };
}, sc);
const firstSide = (rows) => rows.find((w) => w.br === 2)?.i;
const traceDiff = (a, b) => a.trace.findIndex((x, i) => x[0] !== b.trace[i]?.[0] || x[1] !== b.trace[i]?.[1]);
const posDiff = (a, b) => a.trace.findIndex((x, i) => x[0] !== b.trace[i]?.[0]);
const drawDiff = (a, b) => a.trace.findIndex((x, i) => x[1] !== b.trace[i]?.[1]);
const SEED = 1001;

// ── 1. flag-off is the frozen game ──────────────────────────────────────
{
  let oldUp = true;
  try { const r = await fetch(OLD); oldUp = r.ok; } catch { oldUp = false; }
  if (!oldUp) check(`1a flag-off == ${FROZEN} (needs an ${FROZEN} server at --old)`, false, `no server at ${OLD}`);
  else for (const [name, q] of [['SNIPER NEST', 'encdbg=sniperNest&room=detention&sector=8&wave=2'], ['MIXED', 'encdbg=mixed&room=detention&sector=12&wave=2']]) {
    const res = [];
    for (const base of [OLD, BASE]) {
      const p = await bootPage(browser, { base, q });
      await installAudit(p, 'A');
      await p.evaluate(() => { window.__headless = true; });
      res.push(await encounterRun(p, { seed: SEED, ticks: 1200, trace: true }));
      await p.close();
    }
    const d = res[0].trace.findIndex((h, i) => h !== res[1].trace[i]);
    const sn = res[1].recs.filter((r) => r.type === 'sniper' && !r.nem).length;
    check(`1a flag-off ${name}: identical to ${FROZEN}, every tick and every draw (1200 ticks, ${sn} ordinary Marksmen)`, d === -1 && res[0].draws === res[1].draws && sn > 0, `first divergence ${d}, draws ${res[0].draws}/${res[1].draws}`);
  }
  const p0 = await bootPage(browser, {});
  await installAudit(p0, 'A'); await installStaged(p0);
  await p0.evaluate(() => { window.__headless = true; });
  const r = await p0.evaluate(async () => {
    await window.__audSetup({ seed: 1001, ticks: 0, actors: [], player: { path: 'stand', x: 800, y: 1150 } });
    const gs = window.__gs;
    const es = [gs.spawnEnemyAt('sniper', 600, 250), gs.spawnEnemyAt('sniper', 1000, 250, { elite: true })];
    const out = es.map((e) => ({ st: !!e._marksmanStuck, ownTick: Object.prototype.hasOwnProperty.call(e, '_tickSwarm'), ownMove: Object.prototype.hasOwnProperty.call(e, '_moveToward') }));
    for (const e of es) gs._destroyEnemyFully(e);
    return out;
  });
  check('1b without the flag nothing is installed on a Marksman (no wrapper, no state)', r.every((o) => !o.st && !o.ownTick && !o.ownMove), JSON.stringify(r));
  await p0.close();
}

const P0 = await page(''), PA = await page('marksmanStuck=prog'), PB = await page('marksmanStuck=early');
const all = [['baseline', P0], ['A', PA], ['B', PB]];
const cand = [['A', PA], ['B', PB]];
const both = async (sc) => { const r = {}; for (const [k, p] of all) r[k] = await mk(p, sc); return r; };

// ── 2 + 11. the unobstructed first check, Regular and Elite ─────────────
for (const [role, a] of [['Regular', MK], ['Elite', MKE]]) {
  const r = await both({ ...SC.clear(a, SEED), trace: true });
  const f0 = firstCheck(r.baseline.rec);
  check(`2a ${role} baseline: the first check reads 0px after open travel and the Marksman takes a 600ms sidestep`, f0.baseMoved === 0 && f0.cons >= 34 && f0.trueMoved >= 12, `moved ${f0.trueMoved?.toFixed?.(0)}px, ${f0.cons} ticks taken`);
  for (const [k] of cand) {
    const f = firstCheck(r[k].rec), rows = rowsOf(r[k]);
    check(`2b ${role} ${k}: the base still arms its first check, it is stood down before it is taken, and no tick of the approach is a sidestep`,
      f.armed && f.cons === 0 && rows.every((w) => w.br !== 2) && r[k].log?.stoodF1 === 1, `armed ${f.armed} taken ${f.cons} log ${JSON.stringify(r[k].log)}`);
    const lat = lateral(rows), lat0 = lateral(rowsOf(r.baseline));
    check(`11 ${role} ${k}: installed, and the approach has no sideways skate (lateral ${lat0.sideLat + lat0.otherLat}px -> ${lat.sideLat + lat.otherLat}px)`,
      r[k].meta?.installed && r[k].meta?.elite === (role === 'Elite') && lat.sideLat + lat.otherLat < 2 && lat0.sideLat > 50, '');
  }
}

// ── 3. holding in the band ──────────────────────────────────────────────
for (const [role, a] of [['Regular', MK], ['Elite', MKE]]) {
  const r = await both(SC.hold(a, SEED));
  const rows0 = rowsOf(r.baseline);
  const armed0 = rows0.filter((w) => w.check && w.check !== '.').length;
  check(`3a ${role} baseline: a Marksman holding in the band arms the check every 600ms and carries a live sidestep`, armed0 >= 8 && rows0.some((w) => w.side > 0), `${armed0} armed checks`);
  for (const [k] of cand) {
    const rows = rowsOf(r[k]);
    // (`_stuckSidestepMs` keeps counting below zero between arms: "live" is > 0)
    check(`3b ${role} ${k}: every hold arm is stood down on its own check tick — no live sidestep is ever left on a holding Marksman`,
      rows.every((w) => !(w.side > 0)) && rows.filter((w) => w.check && w.check !== '.').every((w) => w.side === 0) && (r[k].log?.stoodHold ?? 0) + (r[k].log?.stoodF1 ?? 0) >= 8 && r[k].log?.kept === 0, `log ${JSON.stringify(r[k].log)}`);
  }
}

// ── 4. hold -> approach ─────────────────────────────────────────────────
for (const [role, a] of [['Regular', MK], ['Elite', MKE]]) {
  const r = await both(SC.holdApproach(a, SEED));
  const rs0 = resumes(rowsOf(r.baseline));
  check(`4a ${role} baseline: the resume takes the armed hold sidestep and leaves across the bearing`, rs0.some((x) => x.sideTaken && x.errMax > 60), JSON.stringify(rs0));
  for (const [k] of cand) {
    const rs = resumes(rowsOf(r[k]));
    check(`4b ${role} ${k}: the resume walks at the player (no sidestep taken, heading within 10 degrees)`, rs.length >= 1 && rs.every((x) => !x.sideTaken && x.errMax != null && x.errMax <= 10), JSON.stringify(rs));
  }
}

// ── 5. retreat direction and speed ──────────────────────────────────────
for (const [role, a] of [['Regular', MK], ['Elite', MKE]]) for (const scn of ['holdRetreat', 'retreatHold', 'osc300']) {
  const r = await both({ ...SC[scn](a, SEED), trace: true });
  const rows0 = rowsOf(r.baseline);
  // a retreat step: the tick that just ran chose RETREAT (its own branch), and
  // its velocity — the actor's own speed (150 Regular, 135 Elite: `_makeElite`
  // x0.9), straight away from where the player stood THIS
  // tick, measured from where the Marksman stood before it — moved the body
  const ret = rows0.filter((w, k) => k > 0 && w.branch === 'R' && !w.hit && !rows0[k - 1].hit);
  const bad = ret.filter((w) => {
    const p = rows0[rows0.indexOf(w) - 1];
    const dx = w.x - p.x, dy = w.y - p.y, away = Math.atan2(p.y - w.py, p.x - w.px);
    const err = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - away), Math.cos(Math.atan2(dy, dx) - away)));
    return Math.abs(Math.hypot(dx, dy) - r.baseline.meta.speed / 60) > 0.05 || err > 0.02;
  });
  const sameA = traceDiff(r.A, r.baseline) === -1, sameB = traceDiff(r.B, r.baseline) === -1;
  const same = ['A', 'B'].every((k) => JSON.stringify(rowsOf(r[k]).map((w) => [w.x, w.y, w.branch])) === JSON.stringify(rows0.map((w) => [w.x, w.y, w.branch])));
  check(`5 ${role} ${scn}: ${ret.length} retreat steps at the frozen ${r.baseline.meta.speed}px/s straight away from the player, and A and B move identically to baseline every tick`,
    (scn === 'osc300' || ret.length > 10) && bad.length === 0 && same && sameA && sameB, `bad ${bad.length}, trace A ${sameA} B ${sameB}`);
}

// ── 6. band thresholds ──────────────────────────────────────────────────
{
  const probe = (p) => p.evaluate(async () => {
    await window.__audSetup({ seed: 3, ticks: 0, actors: [], player: { path: 'stand', x: 800, y: 1300 } });
    const gs = window.__gs, P = gs.player;
    const cfg = { ...gs.spawnEnemyAt('sniper', 800, 200).cfg };
    gs.enemies.getChildren().slice().forEach((e) => gs._destroyEnemyFully(e));
    const out = [];
    for (const d of [298, 302, 560, 638, 642, 900]) for (const elite of [false, true]) {
      const e = gs.spawnEnemyAt('sniper', 800, 300, elite ? { elite: true } : {});
      P.setPosition(800, 300 + d); P.body.reset(800, 300 + d);
      e._stuckRefX = e.x; e._stuckRefY = e.y; e._stuckTimer = 0;   // keep the base block out of a one-tick probe
      e._tickSwarm(16.67, P);
      out.push({ d, elite, sp: e.cfg.speed, vx: +e.body.velocity.x.toFixed(3), vy: +e.body.velocity.y.toFixed(3) });
      gs._destroyEnemyFully(e);
    }
    return { cfg: { speed: cfg.speed, desiredRange: cfg.desiredRange, retreatRange: cfg.retreatRange, windupMs: cfg.windupMs, lockMs: cfg.lockMs, fireCooldownMs: cfg.fireCooldownMs, bulletRange: cfg.bulletRange, radius: cfg.radius, hp: cfg.hp }, out };
  });
  const b = await probe(P0);
  const cls = (o) => (o.vy < -1 ? 'R' : o.vy > 1 ? 'A' : 'H');
  check('6a baseline: 298px retreats at full speed (150 Regular, 135 Elite), 302 / 560 / 638 hold, 642 / 900 approach at 0.7x',
    b.out.map(cls).join('') === 'RRHHHHHHAAAA' && b.out.filter((o) => cls(o) === 'R').every((o) => Math.abs(o.vy + o.sp) < 0.01) && b.out.filter((o) => cls(o) === 'A').every((o) => Math.abs(o.vy - 0.7 * o.sp) < 0.01) && b.out.every((o) => o.sp === (o.elite ? 135 : 150)),
    `${b.out.map(cls).join('')} cfg ${JSON.stringify(b.cfg)}`);
  check('6b config is the frozen Marksman: speed 150, desiredRange 560, retreatRange 300, windup 800, lock 260, cooldown 1900',
    b.cfg.speed === 150 && b.cfg.desiredRange === 560 && b.cfg.retreatRange === 300 && b.cfg.windupMs === 800 && b.cfg.lockMs === 260 && b.cfg.fireCooldownMs === 1900, JSON.stringify(b.cfg));
  for (const [k, p] of cand) {
    const x = await probe(p);
    check(`6c ${k}: every threshold probe and the config are identical to baseline`, JSON.stringify(x) === JSON.stringify(b), JSON.stringify(x.out.map(cls).join('')));
  }
}

// ── 7 + 9. charge / lock timing and the locked shot ─────────────────────
{
  const allCh = { baseline: [], A: [], B: [] };
  for (const [role, a] of [['Regular', MK], ['Elite', MKE]]) for (const scn of ['still', 'lateral', 'dashLock', 'crossBehind', 'closeIn', 'outRange']) {
    const r = await both(CHARGE[scn](a, SEED));
    for (const [k] of all) for (const c of charges(rowsOf(r[k]))) allCh[k].push({ ...c, scn, role });
    if (['still', 'lateral', 'dashLock', 'closeIn'].includes(scn)) {
      const sig = (k) => JSON.stringify(charges(rowsOf(r[k])).map((c) => [c.start, c.end, c.fired, c.shotAng, c.cdAfter]));
      check(`7a ${role} ${scn}: the charge sequence (start, end, shot angle, next cooldown) is identical to baseline under A and B`, sig('A') === sig('baseline') && sig('B') === sig('baseline') && charges(rowsOf(r.baseline)).length >= 2, sig('baseline').slice(0, 120));
    }
  }
  for (const [k] of all) {
    const fired = allCh[k].filter((c) => c.fired);
    const len = new Set(fired.map((c) => c.ticks)), lock = new Set(fired.map((c) => c.lockTicks));
    const cd = fired.map((c) => c.cdAfter).filter((x) => x != null);
    check(`7b ${k}: every fired charge is the frozen 800ms windup (49 sampled rows, start to shot) with a 260ms lock (16 rows), and the next cooldown is drawn in 1615..2185 (less one tick)`,
      fired.length >= 20 && [...len].join() === '49' && [...lock].join() === '16' && cd.every((x) => x >= 1615 - 17 && x <= 2185), `${fired.length} shots, lengths ${[...len]}, locks ${[...lock]}, cd ${Math.min(...cd)}..${Math.max(...cd)}`);
    check(`9 ${k}: every shot leaves on the angle the beam locked on, and the lock never moves (${fired.length} shots across six player behaviours)`,
      fired.every((c) => c.lockSteady && c.shotAng === c.lockFirst), '');
  }
}

// ── 8. LOS cancellation ─────────────────────────────────────────────────
for (const [role, a] of [['Regular', MK], ['Elite', MKE]]) {
  const r = await both(CHARGE.losBreak(a, SEED));
  const cancels = (k) => { const rows = rowsOf(r[k]); return rows.filter((w, j) => j > 0 && rows[j - 1].charging && !w.charging && w.shot === '').map((w) => [w.i, w.fireCd, w.los]); };
  const c0 = cancels('baseline');
  check(`8 ${role}: breaking LOS cancels the charge with the frozen 500ms re-arm, and A and B cancel on the same ticks`,
    c0.length >= 1 && c0.every(([, cd, los]) => cd === 500 && los === 0) && JSON.stringify(cancels('A')) === JSON.stringify(c0) && JSON.stringify(cancels('B')) === JSON.stringify(c0), JSON.stringify(c0));
}

// ── 10. genuine cover ───────────────────────────────────────────────────
{
  for (const [role, a] of [['Regular', MK], ['Elite', MKE]]) for (const scn of ['cover90', 'wall320']) {
    const r = await both(OBST[scn](a, SEED));
    const stat = (k) => {
      const rows = rowsOf(r[k]);
      const hit = rows.find((w) => w.hit)?.i;
      return { hit, after: rows.filter((w) => w.i >= hit && w.br === 2).length, reached: rows.some((w, j) => j > 0 && w.branch === 'H' && rows[j - 1].branch === 'A') };
    };
    const b0 = stat('baseline');
    for (const [k] of cand) {
      const x = stat(k);
      check(`10a ${role} ${scn} ${k}: contact on the approach still triggers the recovery (sidesteps after contact)${scn === 'wall320' ? '' : ' and the Marksman gets round to its band'}`,
        x.hit != null && x.after >= 30 && (x.reached || scn === 'wall320'), `contact tick ${x.hit}, ${x.after} sidestep ticks after it, reached ${x.reached} · baseline: contact ${b0.hit}, ${b0.after} after, reached ${b0.reached}`);
    }
  }
  // cover INSIDE the first window: contact at ~0.3s
  for (const [role, a] of [['Regular', MK], ['Elite', MKE]]) {
    const r = await both(OBST['console70-early'](a, SEED));
    const f = { baseline: firstSide(rowsOf(r.baseline)), A: firstSide(rowsOf(r.A)), B: firstSide(rowsOf(r.B)) };
    check(`10b ${role}: a console met inside the first window — baseline recovers at the first check, A waits a whole window (the known cost), B keeps the arm because it is PINNED`,
      f.A - f.baseline === 36 && f.B === f.baseline && r.B.log?.keptPinned === 1 && r.A.log?.stoodF1 === 1, `first sidestep tick ${JSON.stringify(f)} B log ${JSON.stringify(r.B.log)}`);
  }
  // cover met head-on after a moving window: the base check is fooled by the walk-in
  for (const [role, a] of [['Regular', MK], ['Elite', MKE]]) {
    const r = await both(OBST.cover90(a, SEED));
    const hit = rowsOf(r.B).find((w) => w.hit)?.i;
    const fA = rowsOf(r.A).find((w) => w.i >= hit && w.br === 2)?.i, fB = rowsOf(r.B).find((w) => w.i >= hit && w.br === 2)?.i;
    check(`10c ${role}: cover met head-on mid-window — B arms the very next check (pinned, the base's last drawn direction), A waits for the base`,
      fB < fA && fB - hit <= 36 && r.B.log?.armedPinned >= 1 && r.A.log?.armedPinned === 0, `contact ${hit}, first recovery A ${fA} B ${fB}, log ${JSON.stringify(r.B.log)}`);
  }
  // a blocked RETREAT is never evidence: B stands it down exactly as A does
  const r = await both(SC.retreatApproach(MKE, SEED));
  const sig = (k) => JSON.stringify(rowsOf(r[k]).map((w) => [w.x, w.y]));
  check('10d Elite retreat pinned on the north wall, then an approach: A and B stand the retreat arms down and move identically (a retreat is not approach evidence)',
    r.A.log?.stoodRetreat >= 3 && r.B.log?.stoodRetreat === r.A.log?.stoodRetreat && r.B.log?.keptPinned === 0 && r.B.log?.armedPinned === 0 && sig('A') === sig('B'), `A ${JSON.stringify(r.A.log)} B ${JSON.stringify(r.B.log)}`);
}

// ── 12. the nemesis Marksman is excluded ────────────────────────────────
// (fresh pages: `rollNemesis` advances the game's own seeded nemesis stream,
// which a staged reset does not rewind)
{
  const sc = { seed: SEED, ticks: 200, trace: true, actors: [{ type: 'sniper', nem: true, x: 800, y: 150, at: 0 }], player: { path: 'stand', x: 800, y: 1250 } };
  const r = {};
  for (const [k, flags] of [['baseline', ''], ['A', 'marksmanStuck=prog'], ['B', 'marksmanStuck=early']]) { const p = await page(flags); r[k] = await run(p, sc); await p.close(); }
  for (const k of ['A', 'B']) {
    const f = firstCheck(r[k].recs[0]);
    check(`12 ${k}: the nemesis Marksman gets no candidate, still takes the frozen first sidestep, and moves exactly as baseline`,
      r[k].own[0].nem && !r[k].own[0].mk && f.cls === 'F1' && f.cons > 0 && traceDiff(r[k], r.baseline) === -1, `installed ${r[k].own[0].mk}, ${f.cls} ${f.cons} ticks, first divergence ${traceDiff(r[k], r.baseline)}`);
  }
}

// ── 13. every other archetype, all on the floor at once ─────────────────
{
  const crowd = { seed: SEED, ticks: 600, player: { path: 'lat', x: 800, y: 1150 }, trace: true, actors: [
    { type: 'grunt', x: 300, y: 200, at: 0 }, { type: 'shooter', x: 550, y: 200, at: 0 }, { type: 'shielded', x: 1050, y: 200, at: 0 },
    { type: 'swarmling', x: 1300, y: 200, at: 0 }, { type: 'bomber', x: 800, y: 180, at: 30 }, { type: 'grunt', x: 400, y: 260, at: 10, elite: true },
    { type: 'shielded', x: 1200, y: 300, at: 0, elite: true }, { type: 'sniper', x: 650, y: 300, at: 0, nem: true }, { type: 'captain', x: 700, y: 220, at: 20 }] };
  const r = {};
  for (const [k, flags] of [['baseline', ''], ['A', 'marksmanStuck=prog'], ['B', 'marksmanStuck=early']]) { const p = await page(flags); r[k] = await run(p, crowd); await p.close(); }
  for (const k of ['A', 'B']) {
    check(`13 ${k}: Rifleman, Elite Rifleman, Gunner, Bulwark R/E, Swarmling, Demolisher, nemesis Marksman and Captain together — identical to baseline, every tick and every draw`,
      traceDiff(r[k], r.baseline) === -1 && r[k].draws === r.baseline.draws && r[k].own.every((o) => !o.mk), `first divergence ${traceDiff(r[k], r.baseline)}, draws ${r[k].draws}/${r.baseline.draws}`);
  }
}

// ── 14. the approved Bulwark Candidate B is unaffected ──────────────────
{
  const lane = (wall) => ({ seed: SEED, ticks: 600, trace: true, actors: [{ type: 'shielded', x: 800, y: 250, at: 0 }, { type: 'shielded', x: 500, y: 250, at: 0, elite: true }], player: { path: 'stand', x: 800, y: 1150 }, wall });
  const r = {};
  for (const [k, flags] of [['bwB', 'bulwarkStuck=early'], ['bwB+mkA', 'bulwarkStuck=early&marksmanStuck=prog'], ['bwB+mkB', 'bulwarkStuck=early&marksmanStuck=early']]) {
    const p = await page(flags);
    r[k] = [await run(p, lane(undefined)), await run(p, lane([800, 390, 90, 90])), await run(p, lane([800, 700, 240, 40]))];
    await p.close();
  }
  for (const k of ['bwB+mkA', 'bwB+mkB']) {
    const ok = r[k].every((x, j) => traceDiff(x, r.bwB[j]) === -1 && JSON.stringify(x.own) === JSON.stringify(r.bwB[j].own));
    check(`14 ${k}: Bulwarks under the approved Candidate B (open lane, early cover, mid-window cover) move and log identically with the Marksman flag on; neither module installs on the other role`,
      ok && r[k].every((x) => x.own.every((o) => o.blw && !o.mk)) && r.bwB[1].own[0].blwLog.keptPinned === 1, JSON.stringify(r[k].map((x) => x.own.map((o) => o.blwLog))));
  }
}

// ── 15. RNG ─────────────────────────────────────────────────────────────
{
  for (const [role, a] of [['Regular', MK], ['Elite', MKE]]) {
    const r = await both({ ...SC.clear(a, SEED), trace: true });
    const f = firstCheck(r.baseline.rec);
    for (const [k] of cand) {
      const pos = posDiff(r[k], r.baseline), drw = drawDiff(r[k], r.baseline);
      check(`15 ${role} ${k}: no draw is added or removed — positions part on the stood-down first check itself, draws only later or never`,
        pos === f.tick && (drw === -1 || drw > pos), `first check tick ${f.tick}, positions part ${pos}, draws part ${drw}`);
    }
  }
  const src = readFileSync(ROOT + 'src/systems/marksmanStuck.js', 'utf8').replace(/\/\/.*$/gm, '');
  check('15b the candidate module names no random source', !/(Math\.random|Between|RND|rng|FloatBetween|Phaser\.Math)/.test(src), 'grep');
}

// ── 16. no leftovers ────────────────────────────────────────────────────
// the same life on every page, and the candidate pages must end exactly where
// the baseline page ends: whatever a death or a room load registers for
// itself is the game's, and anything more is the candidate's
{
  const life = (p) => p.evaluate(async () => {
    const gs = window.__gs;
    const count = () => ({ ev: gs.events.eventNames().reduce((n, e) => n + gs.events.listenerCount(e), 0), timers: (gs.time._active?.length || 0) + (gs.time._pendingInsertion?.length || 0), tweens: gs.tweens.getTweens().length });
    const quiet = () => { gs.tweens.killAll(); gs.time.removeAllEvents(); };
    await window.__audSetup({ seed: 7, ticks: 0, actors: [], player: { path: 'stand', x: 800, y: 1250 } });
    quiet();
    const before = count();
    const spawn = () => [0, 1, 2, 3].map((i) => gs.spawnEnemyAt('sniper', 400 + i * 250, 200, i % 2 ? { elite: true } : {}));
    const es = spawn();
    for (let i = 0; i < 90; i++) window.__adv(1);
    const installed = es.filter((e) => e._marksmanStuck).length;
    quiet();
    const mid = count();
    // death through the real damage path for two, the debug sweep for two
    es[0].damage(1e9); es[1].damage(1e9);
    gs._destroyEnemyFully(es[2]); gs._destroyEnemyFully(es[3]);
    window.__adv(2);
    quiet();
    const afterDeath = count();
    // a room change with four more on the floor
    const es2 = spawn();
    for (let i = 0; i < 40; i++) window.__adv(1);
    gs.loadRoom(gs.roomSpec);
    window.__adv(2);
    quiet();
    const afterRoom = count();
    const left = gs.enemies.getChildren().filter((e) => e._marksmanStuck || e.enemyType === 'sniper').length;
    return { installed, before, mid, afterDeath, afterRoom, left, gone: [...es, ...es2].every((e) => !e.active) };
  });
  const b = await life(P0);
  for (const [k, p] of cand) {
    const r = await life(p);
    const same = ['before', 'mid', 'afterDeath', 'afterRoom'].every((f) => r[f].ev === b[f].ev);
    check(`16 ${k}: four flagged Marksmen live and die (damage path + sweep) and four more go with a room change, with exactly the baseline's listener count at every stage; none survives the room`,
      r.installed === 4 && b.installed === 0 && same && r.mid.ev === r.before.ev && r.left === 0 && r.gone, JSON.stringify({ r, b }));
  }
}
{
  const src = readFileSync(ROOT + 'src/systems/marksmanStuck.js', 'utf8').replace(/\/\/.*$/gm, '');
  check('16b the candidate module names no timer, tween, listener or scene event', !/(time\.|delayedCall|addEvent|tweens|\.on\(|\.once\(|events\.|scene\.)/.test(src), 'grep');
  check('16c ... and reads or writes no weapon, LOS, laser, aim, speed, hp or damage field',
    !/(_charging|_chargeMs|_lockAngle|fireCd|laser|_drawLaser|_hasLOS|canSee|_aim\b|cfg\.|hpMax|\.hp\b|damage|recoil|setVelocity)/.test(src), 'grep');
  const diff = execSync(`git diff --stat ${FROZEN} -- src/entities/ src/config.js src/data/encounters.js src/systems/bulwarkStuck.js src/systems/demolisherPayload.js`, { cwd: ROOT, encoding: 'utf8' }).trim();
  check(`16d Enemy.js, every entity, config.js, encounters.js, the Bulwark and Demolisher seams are byte-identical to ${FROZEN}`, diff === '', diff || 'no diff');
  const g = enemyJsGuard(ROOT);
  check('16e the narrowed Enemy.js guard still holds (EnemySniper untouched; the Demolisher veto the only seam)', g.outside && g.bomberOnlyVeto && g.vetoCode, g.detail);
}

for (const p of [P0, PA, PB]) await p.close();
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
