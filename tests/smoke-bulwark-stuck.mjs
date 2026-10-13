// SMOKE: PHASE 3B — the ordinary Bulwark's stuck-recovery candidates
// (`?bulwarkStuck=prog` = Candidate A, `?bulwarkStuck=early` = Candidate B;
// src/systems/bulwarkStuck.js). Standalone, like the roster smokes.
//
// Every candidate check is paired with the frozen baseline (no flag) so the
// suite can tell the two apart: run it with `--base=` pointed at a 690ed9b
// server and the candidate checks fail there, because that build has no flag.
//
//   1  flag-off is the frozen game: same seeded VANGUARD + mixed encounter as
//      690ed9b, tick for tick and draw for draw; nothing installed without it
//   2  the unobstructed first check no longer moves a Bulwark sideways
//   3  an intentional hold leaves no actionable recovery behind
//   4  hold -> resume walks toward the player, not across
//   5  real contact still triggers recovery, and the Bulwark gets round
//   6  early obstacles: B keeps the pinned / pressing first arm, A waits a window
//   7  every Bulwark mode is covered (free / screen / opener, Regular / Elite)
//   8  the nemesis shielded is excluded
//   9  every other archetype is untouched, with all of them on the floor at once
//  10  RNG: the candidates make no draw; any divergence is attributable
//  11  no listeners, timers or tweens are left behind (death, room change)
//  12  shield and VANGUARD mechanics are unchanged
//
// usage: node tests/smoke-bulwark-stuck.mjs [--base=URL] [--old=URL of a 690ed9b server, default :5174]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { CHROME, bootPage, installAudit, installStaged, encounterRun, firstCheck } from './diag-stuck-audit.mjs';
import { enemyJsGuard } from './enemy-frozen.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = opt('base', 'http://localhost:5173/');
const OLD = opt('old', 'http://localhost:5174/');
const ROOT = new URL('../', import.meta.url).pathname;
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = async (flags = '', base = BASE, q) => {
  const p = await bootPage(browser, { base, flags, ...(q ? { q } : {}) });
  await installAudit(p, 'A');
  await installStaged(p);
  await p.evaluate(() => { window.__headless = true; });
  return p;
};
// one staged run, plus the candidate's own log and a per-tick trace of the first actor
const run = (p, sc) => p.evaluate(async (sc) => {
  await window.__audSetup(sc);
  const A = window.__aud, rows = [];
  for (let i = 0; i < sc.ticks; i++) {
    window.__audStep();
    const r = A.recs[0], e = r?.e;
    if (e?.active && sc.rows) {
      const P = window.__gs.player, v = e.body.velocity;
      rows.push({ i, x: e.x, y: e.y, vx: v.x, vy: v.y, br: r.pbr, side: e._stuckSidestepMs, bx: P.x - e.x, by: P.y - e.y, hold: !!e._screenHolding });
    }
  }
  const logs = A.recs.map((r) => (r.e._bulwarkStuck ? { ...r.e._bulwarkStuck.log, mode: r.e._bulwarkStuck.mode } : null));
  const own = A.recs.map((r) => ({ type: r.type, nem: r.nem, installed: !!r.e._bulwarkStuck, ownTick: Object.prototype.hasOwnProperty.call(r.e, '_tickSwarm') }));
  return { ...window.__audCollect(), logs, own, rows };
}, sc);
const lane = (actor, extra = {}) => ({ seed: 1001, ticks: 330, actors: [{ x: 800, y: 250, at: 0, ...actor }], player: { path: 'stand', x: 800, y: 1150 }, ...extra });
const away = (actor, extra = {}) => ({ seed: 1001, ticks: 720, actors: [{ x: 800, y: 200, at: 0, ...actor }], player: { path: 'away', x: 800, y: 650 }, ...extra });
const SH = { type: 'shielded' };
const SCREEN = { vanguardScreen: { holdPx: 140, resumePx: 165 } };

// ── 1. flag-off is the frozen game ──────────────────────────────────────
{
  let oldUp = true;
  try { const r = await fetch(OLD); oldUp = r.ok; } catch { oldUp = false; }
  if (!oldUp) check('1a flag-off == 690ed9b (needs a 690ed9b server at --old)', false, `no server at ${OLD}`);
  else for (const [name, q] of [['VANGUARD + Captain', 'encdbg=vanguard&room=hangar&sector=8&wave=2'], ['MIXED (detention)', 'encdbg=mixed&room=detention&sector=12&wave=1']]) {
    const res = [];
    for (const base of [OLD, BASE]) {
      const p = await bootPage(browser, { base, q });
      await installAudit(p, 'A');
      await p.evaluate(() => { window.__headless = true; });
      res.push(await encounterRun(p, { seed: 1001, ticks: 1200, trace: true }));
      await p.close();
    }
    const d = res[0].trace.findIndex((h, i) => h !== res[1].trace[i]);
    check(`1a flag-off ${name}: identical to 690ed9b, every tick and every draw (1200 ticks)`, d === -1 && res[0].draws === res[1].draws, `first divergence ${d}, draws ${res[0].draws}/${res[1].draws}`);
  }
  const p0 = await page('');
  const r = await run(p0, lane({ ...SH, spec: SCREEN }));
  check('1b without the flag nothing is installed on a Bulwark (no wrapper, no state)', r.own.every((o) => !o.installed && !o.ownTick), JSON.stringify(r.own));
  await p0.close();
}

const P0 = await page(''), PA = await page('bulwarkStuck=prog'), PB = await page('bulwarkStuck=early');
const all = [['baseline', P0], ['A', PA], ['B', PB]];

// ── 2. the unobstructed first check ─────────────────────────────────────
{
  const r = {};
  for (const [k, p] of all) r[k] = await run(p, lane(SH));
  const f0 = firstCheck(r.baseline.recs[0]);
  check('2a baseline: the first check reads 0px and the Bulwark takes a 600ms sidestep', f0.baseMoved === 0 && f0.cons >= 34, `${f0.cons} ticks, ${f0.consPx}px`);
  for (const k of ['A', 'B']) {
    const f = firstCheck(r[k].recs[0]);
    check(`2b ${k}: the base still arms its first check, and it is stood down before it is taken`, f.armed && f.cons === 0 && r[k].recs[0].sideTicks === 0 && r[k].logs[0]?.stoodF1 === 1, `armed ${f.armed} taken ${f.cons} log ${JSON.stringify(r[k].logs[0])}`);
    check(`2c ${k}: the approach arrives exactly one window (600ms) sooner`, r.baseline.recs[0].engage - r[k].recs[0].engage === 36, `${r.baseline.recs[0].engage} -> ${r[k].recs[0].engage} ticks`);
  }
}

// ── 3 + 4. hold, then resume ────────────────────────────────────────────
{
  const r = {};
  for (const [k, p] of all) r[k] = await run(p, { ...away(SH), rows: true });
  const takenHold = (x) => x.recs[0].checks.filter((c) => c.cls === 'HOLD' && c.cons > 0).length;
  check('3a baseline: holds arm the check, and a resume takes the armed sidestep', takenHold(r.baseline) >= 1, `${takenHold(r.baseline)} hold sidesteps taken`);
  for (const k of ['A', 'B']) {
    const held = r[k].rows.filter((w) => w.i > 120 && w.i < 240);
    check(`3b ${k}: during the hold every armed check is stood down — no live sidestep in the hold`, r[k].logs[0]?.stoodHold >= 2 && held.every((w) => !(w.side > 0) || w.side > 590), `stoodHold ${r[k].logs[0]?.stoodHold}`);
    check(`3c ${k}: no hold sidestep is ever taken`, takenHold(r[k]) === 0 && r[k].recs[0].sideTicks === 0, `${takenHold(r[k])} taken, ${r[k].recs[0].sideTicks} sidestep ticks`);
  }
  // the first 10 ticks after the player crosses the resume line: heading vs bearing
  const resumeOff = (x) => {
    const i0 = x.rows.findIndex((w) => w.i >= 240 && w.br >= 1);
    const seg = x.rows.slice(i0, i0 + 10).filter((w) => Math.hypot(w.vx, w.vy) > 20);
    return Math.max(...seg.map((w) => Math.abs(Math.atan2(Math.sin(Math.atan2(w.vy, w.vx) - Math.atan2(w.by, w.bx)), Math.cos(Math.atan2(w.vy, w.vx) - Math.atan2(w.by, w.bx)))) * 180 / Math.PI));
  };
  const o0 = resumeOff(r.baseline), oA = resumeOff(r.A), oB = resumeOff(r.B);
  check('4a baseline: the first resume leaves at right angles to the player', o0 > 70, `${o0.toFixed(0)}deg off the bearing`);
  check('4b A and B: the first resume walks at the player', oA < 15 && oB < 15, `A ${oA.toFixed(0)}deg, B ${oB.toFixed(0)}deg`);
}

// ── 5 + 6. real obstacles ───────────────────────────────────────────────
{
  const far = { wall: [800, 700, 90, 90], ticks: 600 }, near = { wall: [800, 390, 90, 90], ticks: 600 };
  for (const [k, p] of all) {
    const r = await run(p, lane(SH, far));
    check(`5a ${k}: a console dead on the lane, met after the first check — recovery fires on contact and the Bulwark gets round`, r.recs[0].engage != null && r.recs[0].sideTicks > 0, `engage ${r.recs[0].engage}, ${r.recs[0].sideTicks} sidestep ticks`);
  }
  const first = (r) => r.rows.find((w) => w.br === 2)?.i;
  const rn = {};
  for (const [k, p] of all) rn[k] = await run(p, { ...lane(SH, near), rows: true });
  check('6a baseline: cover met inside the first window — the (false) first arm happens to free it at 0.6s', first(rn.baseline) === 35, `first sidestep tick ${first(rn.baseline)}`);
  check('6b A: the same cover waits a whole window for the second check (the known cost)', first(rn.A) === 71, `first sidestep tick ${first(rn.A)}`);
  check('6c B: keeps the first arm because the Bulwark is PINNED — recovery at 0.6s, like baseline', first(rn.B) === 35 && rn.B.logs[0]?.keptPinned === 1, `first sidestep tick ${first(rn.B)} log ${JSON.stringify(rn.B.logs[0])}`);
  // a REAL cover body (70x70) met ONE TICK before the first check: the arrival
  // step still shows 72% of the commanded travel, so only "pressing into the
  // face it is blocked on" can see it (a 50ms-run-only B stood it down: 71)
  const rc = {};
  for (const [k, p] of all) rc[k] = await run(p, { ...lane(SH, { wall: [800, 390, 70, 70], ticks: 600 }), rows: true });
  check('6e B: a 70x70 console met one tick before the check — B keeps the arm (pressing), A waits a window', first(rc.baseline) === 35 && first(rc.A) === 71 && first(rc.B) === 35 && rc.B.logs[0]?.keptPinned === 1,
    `first sidestep tick baseline ${first(rc.baseline)} A ${first(rc.A)} B ${first(rc.B)} log ${JSON.stringify(rc.B.logs[0])}`);
  const rw = {};
  for (const [k, p] of all) rw[k] = await run(p, { ...lane(SH, { wall: [800, 700, 240, 40], ticks: 600 }), rows: true });
  check('6d B: cover met mid-window (the base check is fooled by the walk-in) — B arms the very next check', first(rw.B) < first(rw.A) && rw.B.logs[0]?.armedPinned >= 1, `first sidestep tick A ${first(rw.A)} B ${first(rw.B)}`);
}

// ── 7. every Bulwark mode ───────────────────────────────────────────────
{
  const modes = [['free Regular', {}], ['free Elite', { elite: true }], ['screen Regular', { spec: SCREEN }], ['screen Elite', { elite: true, spec: SCREEN }], ['opener', { spec: { ...SCREEN, vanguardLane: { sign: 1, px: 60 } } }]];
  for (const [name, a] of modes) {
    const b = await run(P0, lane({ ...SH, ...a })), x = await run(PA, lane({ ...SH, ...a })), y = await run(PB, lane({ ...SH, ...a }));
    const ok = b.recs[0].sideTicks >= 34 && x.own[0].installed && y.own[0].installed && x.recs[0].sideTicks === 0 && y.recs[0].sideTicks === 0;
    check(`7 ${name}: installed under A and B, and its false first sidestep is gone`, ok, `baseline ${b.recs[0].sideTicks} ticks · A ${x.recs[0].sideTicks} · B ${y.recs[0].sideTicks}`);
  }
}

// ── 8. the nemesis shielded is excluded ─────────────────────────────────
// (run on the baseline page too: `rollNemesis` advances the game's own seeded
// nemesis stream, which a staged reset does not rewind, so every page must
// carry the same history into the sections after this one)
{
  const r = {};
  for (const [k, p] of all) r[k] = await run(p, { ...lane({ ...SH, nem: true }), ticks: 200, trace: true });
  for (const k of ['A', 'B']) {
    const f = firstCheck(r[k].recs[0]);
    const d = r[k].trace.findIndex((x, i) => x[0] !== r.baseline.trace[i][0] || x[1] !== r.baseline.trace[i][1]);
    check(`8 ${k}: the nemesis shielded gets no candidate, still takes the frozen first sidestep, and moves exactly as baseline`, r[k].own[0].nem && !r[k].own[0].installed && f.cls === 'F1' && f.cons > 0 && d === -1, `installed ${r[k].own[0].installed}, ${f.cls} ${f.cons} ticks, first divergence ${d}`);
  }
}

// ── 9. every other archetype, all on the floor at once ──────────────────
{
  const crowd = { seed: 1001, ticks: 600, player: { path: 'lat', x: 800, y: 1150 }, actors: [
    { type: 'grunt', x: 300, y: 200, at: 0 }, { type: 'shooter', x: 550, y: 200, at: 0 }, { type: 'sniper', x: 1050, y: 200, at: 0 },
    { type: 'swarmling', x: 1300, y: 200, at: 0 }, { type: 'bomber', x: 800, y: 180, at: 30 }, { type: 'grunt', x: 400, y: 260, at: 10, elite: true },
    { type: 'shielded', x: 1200, y: 300, at: 0, nem: true }, { type: 'captain', x: 700, y: 220, at: 20 }], trace: true };
  // fresh pages: a crowd with a nemesis in it must not inherit another
  // section's nemesis stream
  const r = {};
  for (const [k, flags] of [['baseline', ''], ['A', 'bulwarkStuck=prog'], ['B', 'bulwarkStuck=early']]) {
    const p = await page(flags);
    r[k] = await run(p, crowd);
    await p.close();
  }
  for (const k of ['A', 'B']) {
    const d = r[k].trace.findIndex((x, i) => x[0] !== r.baseline.trace[i][0] || x[1] !== r.baseline.trace[i][1]);
    check(`9 ${k}: Rifleman, Elite Rifleman, Gunner, Marksman, Swarmling, Demolisher, nemesis shielded and Captain together — identical to baseline, every tick and every draw`, d === -1 && r[k].draws === r.baseline.draws && r[k].own.every((o) => !o.installed), `first divergence ${d}, draws ${r[k].draws}/${r.baseline.draws}`);
  }
}

// ── 10. RNG ─────────────────────────────────────────────────────────────
{
  const r = {};
  for (const [k, p] of all) r[k] = await run(p, { ...lane(SH), trace: true });
  for (const k of ['A', 'B']) {
    const pos = r[k].trace.findIndex((x, i) => x[0] !== r.baseline.trace[i][0]);
    const drw = r[k].trace.findIndex((x, i) => x[1] !== r.baseline.trace[i][1]);
    check(`10 ${k}: no draw is added or removed — the stream is identical until behaviour diverges (positions part at the stood-down first check, draws only later)`, pos === 35 && drw > pos, `positions part at tick ${pos}, draws at tick ${drw}`);
  }
}

// ── 11. no leftovers ────────────────────────────────────────────────────
for (const [k, p] of [['A', PA], ['B', PB]]) {
  const r = await p.evaluate(async () => {
    const gs = window.__gs;
    const count = () => ({ ev: gs.events.eventNames().reduce((n, e) => n + gs.events.listenerCount(e), 0), timers: (gs.time._active?.length || 0) + (gs.time._pendingInsertion?.length || 0), tweens: gs.tweens.getTweens().length });
    await window.__audSetup({ seed: 7, ticks: 0, actors: [], player: { path: 'stand', x: 800, y: 1150 } });
    const before = count();
    const es = [0, 1, 2, 3].map((i) => gs.spawnEnemyAt('shielded', 400 + i * 200, 250, i % 2 ? { elite: true } : { vanguardScreen: { holdPx: 140, resumePx: 165 } }));
    for (let i = 0; i < 90; i++) window.__adv(1);
    const installed = es.every((e) => e._bulwarkStuck);
    gs.tweens.killAll(); gs.time.removeAllEvents();
    const mid = count();
    for (const e of es) gs._destroyEnemyFully(e);
    window.__adv(2);
    const after = count();
    return { installed, before, mid, after };
  });
  check(`11 ${k}: four flagged Bulwarks live and die without adding a scene listener (the candidate owns no timer or tween)`, r.installed && r.after.ev === r.before.ev && r.mid.ev === r.before.ev, JSON.stringify(r));
}
{
  const src = readFileSync(ROOT + 'src/systems/bulwarkStuck.js', 'utf8').replace(/\/\/.*$/gm, '');
  check('11b the candidate module names no timer, tween, listener, random source or scene event', !/(time\.|delayedCall|addEvent|tweens|\.on\(|\.once\(|Math\.random|Between|events\.emit|scene\.)/.test(src), 'grep');
}

// ── 12. shield and VANGUARD mechanics are unchanged ─────────────────────
{
  const diff = execSync('git diff --stat 690ed9b -- src/entities/ src/config.js src/data/encounters.js src/systems/bulwarkCurtain.js src/systems/shieldContact.js src/systems/bulwarkFacing.js', { cwd: ROOT, encoding: 'utf8' }).trim();
  check('12a Enemy.js, every entity, config.js, encounters.js and the shield seams are byte-identical to 690ed9b', diff === '', diff || 'no diff');
  const g = enemyJsGuard(ROOT);
  check('12b the narrowed Enemy.js guard still holds (EnemyShielded untouched; the Demolisher veto the only seam)', g.outside && g.bomberOnlyVeto && g.vetoCode, g.detail);
  const src = readFileSync(ROOT + 'src/systems/bulwarkStuck.js', 'utf8').replace(/\/\/.*$/gm, '');
  check('12c the candidate reads or writes no shield, VANGUARD, speed, hp, damage or target field', !/(_shieldFacing|_shieldTurnRate|_shieldHalfArc|_screen|holdPx|resumePx|_lane|_vanguard|hpMax|\.hp\b|damage|fireCd|cfg\.speed\s*=|_aim\b)/.test(src), 'grep');
  // the shield's own trajectory, tick by tick, until the first check (after
  // which the baseline sidesteps and the bearing — so the facing — differs)
  const shield = (p) => p.evaluate(async () => {
    await window.__audSetup({ seed: 5, ticks: 0, actors: [], player: { path: 'stand', x: 800, y: 900 } });
    const gs = window.__gs, P = gs.player;
    const e = gs.spawnEnemyAt('shielded', 800, 450, { vanguardScreen: { holdPx: 140, resumePx: 165 } });
    const facing = [];
    for (let i = 0; i < 240; i++) { P.setPosition(800, 900); P.body.reset(800, 900); window.__adv(1); facing.push(e._shieldFacing); }
    const ang = Math.atan2(e.y - P.y, e.x - P.x), toP = Math.atan2(P.y - e.y, P.x - e.x);
    const out = { installed: !!e._bulwarkStuck, facing, frontal: e.isFrontalHit(ang), rear: e.isFrontalHit(ang + Math.PI), turn: e._shieldTurnRate, arc: e._shieldHalfArc, hold: e._screen?.holdPx, resume: e._screen?.resumePx, settled: Math.abs(Math.atan2(Math.sin(e._shieldFacing - toP), Math.cos(e._shieldFacing - toP))) };
    gs._destroyEnemyFully(e);
    return out;
  });
  const b = await shield(P0);
  for (const [k, p] of [['A', PA], ['B', PB]]) {
    const r = await shield(p);
    const same = r.facing.slice(0, 35).every((f, i) => f === b.facing[i]);
    check(`12d ${k}: the shield turns at the frozen rate on the same trajectory as baseline until the first check, settles on the player, blocks a frontal hit and not a rear one; 2.6 rad/s, 140 / 165 untouched`,
      r.installed && same && r.frontal && !r.rear && r.settled < 0.05 && r.turn === 2.6 && r.hold === 140 && r.resume === 165, JSON.stringify({ ...r, facing: undefined, same }));
  }
}

for (const p of [P0, PA, PB]) await p.close();
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
