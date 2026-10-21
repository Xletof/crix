// SMOKE: PHASE 3C-T1 — the ordinary Marksman's firing-angle candidate
// (`?marksmanAngle=1`; src/systems/marksmanAngle.js + src/systems/firingSpot.js).
// Standalone, like the roster smokes. Every staged case is the REAL Detention
// room through `diag-tactical-engagement.mjs`'s own observe-only instrument,
// each on a FRESH page (a staged case otherwise inherits per-object clocks).
//
// Every candidate check is paired with the frozen hold, so the suite can tell
// the two apart (pointed at a build without the flag, the candidate checks fail).
//
//   1  flag-off is the game the human last played: seeded MIXED and SNIPER NEST
//      tick for tick and draw for draw against a 95adb1f server; nothing installed
//   2  installed on every ordinary Marksman with the flag, and only there
//   3  where the frozen hold is right it is left exactly alone: a clear line, a
//      blocked retreat with the line open, a player crossing behind cover, and a
//      geometry with no spot at all are tick-identical with the flag on
//   4  THE ACCEPTANCE CASE: blind behind the console at 520px, Regular and Elite —
//      evaluated on the first blind tick, moving within 300ms, a shot inside 4s;
//      the frozen hold makes zero attempts in 20s
//   5  the weapon is the frozen weapon: still while charging, the same windup,
//      the lock holds its angle, every shot leaves on it, a cancel only on a cut line
//   6  retreat always wins: frozen direction and speed on every retreat tick
//   7  no thrash: cover-hopping and circling stay bounded, and a dancer who keeps
//      the console between them triggers OVERWATCH instead of an endless chase
//   8  several Marksmen never share a destination, and all of them shoot
//   9  a blind approach heads for a spot with a line instead of into the cover
//  10  RNG: the modules contain no random draw
//  11  the nemesis Marksman and every other archetype are excluded
//  12  independent of `?marksmanStuck=early`: both install, both work, and the
//      stuck candidate's own counters on a clear line are unchanged
//  13  speed: the frozen speeds only (cfg.speed in the band, 0.7x on approach)
//  14  no listeners, timers or tweens are added; Enemy.js is untouched
//  15  cost: ms per 1000 ticks in a real MIXED, flag on vs off (reported)
//
// usage: node tests/smoke-marksman-angle.mjs [--base=URL] [--old=URL of a 95adb1f server, default :5174]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { CHROME } from './diag-stuck-audit.mjs';
import { tacPage, runStaged, runEnc, T1_STAGED, VARIANTS, Q, R, ASTATE, analyse } from './diag-tactical-engagement.mjs';
import { enemyJsGuard } from './enemy-frozen.mjs';
import { MARKSMAN_ANGLE } from '../src/systems/marksmanAngle.js';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = opt('base', 'http://localhost:5173/');
const OLD = opt('old', 'http://localhost:5174/');
const ROOT = new URL('../', import.meta.url).pathname;
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

// a fresh page per case, with a per-tick capture of each Marksman's weapon state
async function staged(vk, name, seed = 1001, base = BASE) {
  const p = await tacPage(browser, VARIANTS[vk], Q.stagedRoom, seed, base);
  await capture(p);
  const res = await runStaged(p, { ...T1_STAGED[name], seed });
  const cap = await p.evaluate(() => window.__cap);
  const own = await p.evaluate(() => window.__tac.list.map((r) => ({ type: r.type, ang: !!r.e._marksmanAngle, stuck: !!r.e._marksmanStuck, stuckLog: r.e._marksmanStuck ? { ...r.e._marksmanStuck.log } : null })));
  await p.close();
  return { res, cap, own, a: analyse(res, { scenario: name, variant: vk, seed }, res.geo) };
}
async function capture(p) {
  await p.evaluate(() => {
    const T = window.__tac, gs = window.__gs;
    window.__cap = { t: [], fire: [] };
    gs.events.on('shooter-fire', (e, ang) => { if (e.__tac && e.enemyType === 'sniper') window.__cap.fire.push([T.tick, e.__tac.id, ang, e._lockAngle]); });
    const step0 = T.step;
    T.step = () => {
      step0();
      const P = gs.player;
      for (const r of T.list) {
        const e = r.e;
        if (r.type !== 'sniper' || !(e.active && e.alive)) continue;
        const M = e._marksmanAngle, b = e.body.blocked;
        window.__cap.t.push([T.tick, r.id, +!!e._charging, Math.round(e._chargeMs || 0), e._lockAngle, e.body.velocity.x, e.body.velocity.y,
          M ? M.state : '', M ? M.branch : '', e.cfg.speed, Math.hypot(P.x - e.x, P.y - e.y), +!b.none, Math.atan2(e.y - P.y, e.x - P.x),
          M?.commit ? M.commit.x : null, M?.commit ? M.commit.y : null, M?.commit ? M.commit.side : null, M?.commit ? M.commit.at : null]);
      }
    };
  });
}
const sameTrace = (a, b) => { const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return i; return a.length === b.length ? -1 : n; };
const resp = (o) => o.a.respRows.filter((r) => r.section === 'resp');
const sn = (o) => o.res.actors.filter((a) => a.type === 'sniper' && !a.ref);
const attempts = (o) => o.a.actorRows.filter((r) => r.type === 'sniper').reduce((s, r) => s + r.attempts, 0);
const shots = (o) => o.a.actorRows.filter((r) => r.type === 'sniper').reduce((s, r) => s + r.shots, 0);

// ── 1. flag-off identity against the build the human last played ──
{
  for (const [enc, pilot] of [['mixed', 'handset'], ['nest', 'hide']]) {
    const tr = [];
    for (const base of [BASE, OLD]) {
      const p = await tacPage(browser, VARIANTS.frozen, Q[enc], 1001, base);
      const res = await runEnc(p, { seed: 1001, ticks: 2400, pilot: { mode: pilot }, fire: 7 });
      tr.push({ trace: res.trace, ang: await p.evaluate(() => window.__gs.enemies.getChildren().some((e) => e._marksmanAngle)) });
      await p.close();
    }
    const d = sameTrace(tr[0].trace, tr[1].trace);
    check(`1 flag off: ${enc.toUpperCase()} (${pilot}) is 95adb1f tick for tick and draw for draw`, d === -1 && tr[0].trace.length === 2400, `first divergence ${d}`);
    check(`1 flag off: nothing installed in ${enc.toUpperCase()}`, !tr[0].ang);
  }
}

// ── 2. installed on every ordinary Marksman with the flag ──
{
  const p = await tacPage(browser, VARIANTS.ang, Q.mixed, 1001);
  const res = await runEnc(p, { seed: 1001, ticks: 1200, pilot: { mode: 'handset' }, fire: 7 });
  const by = await p.evaluate(() => window.__tac.list.map((r) => ({ type: r.type, ang: !!r.e._marksmanAngle })));
  await p.close();
  const mk = by.filter((x) => x.type === 'sniper'), other = by.filter((x) => x.type !== 'sniper');
  check('2 every ordinary Marksman in MIXED carries the candidate', mk.length > 0 && mk.every((x) => x.ang), `${mk.filter((x) => x.ang).length}/${mk.length}`);
  check('2 no Gunner or Rifleman in MIXED carries it', other.length > 0 && other.every((x) => !x.ang), `${other.length} checked`);
  void res;
}

// ── 3. where the frozen hold is right, nothing changes ──
const keep = {};
for (const name of ['T1_clear_los', 'T12_retreat_into_cover', 'T3_brief_cross', 'T8_no_spot']) {
  const f = await staged('frozen', name), c = await staged('ang', name);
  keep[name] = { f, c };
  const d = sameTrace(f.res.trace, c.res.trace);
  check(`3 ${name}: flag on is tick-identical to the frozen hold`, d === -1, `first divergence ${d}`);
}
{
  const L = keep.T3_brief_cross.c.res.angLogs.find(Boolean);
  check('3 a player crossing behind the console is held as transient, never walked after', L && L.commits === 0 && L.transientHeld > 0, JSON.stringify({ commits: L?.commits, transientHeld: L?.transientHeld }));
  const N = keep.T8_no_spot.c.res.angLogs.find(Boolean);
  const evalBound = Math.ceil(1200 * 1000 / 60 / 250) + 4;
  check('3 no spot at all: a stable hold, a bounded search (one look per 250ms), no velocity written', N && N.commits === 0 && N.evals <= evalBound && keep.T8_no_spot.c.cap.t.every((w) => w[7] === 'noSpot' || w[7] === 'line' || w[7] === 'charge'), `evals ${N?.evals} <= ${evalBound}`);
}

// ── 4. THE ACCEPTANCE CASE ──
for (const name of ['T2_blind_console', 'T2e_blind_console_elite']) {
  const f = await staged('frozen', name), c = await staged('ang', name);
  check(`4 ${name}: frozen hold makes zero attempts in 20s (the defect)`, attempts(f) === 0);
  const e = resp(c)[0];
  check(`4 ${name}: evaluated on the first blind tick`, e && e.evalMs === 0, `eval ${e?.evalMs}ms`);
  check(`4 ${name}: committed and moving within 300ms`, e && e.selectMs <= 300 && e.firstMoveMs <= 300, `committed ${e?.selectMs}ms, first move ${e?.firstMoveMs}ms`);
  const firstShot = c.cap.fire[0];
  check(`4 ${name}: a normal charged shot inside 4s`, firstShot && firstShot[0] * 1000 / 60 <= 4000, `first shot at ${firstShot ? Math.round(firstShot[0] * 1000 / 60) : '-'}ms; shots in 20s ${shots(c)}`);
  keep[name] = { f, c };
}

// ── 5. the weapon is the frozen weapon ──
{
  const cases = ['T2_blind_console', 'T4_circle_console', 'T5_cover_hop', 'T11_los_flicker', 'T9_four_marksmen'];
  const runs = [];
  for (const n of cases) runs.push(keep[n]?.c || await staged('ang', n));
  const f1 = keep.T1_clear_los.f;
  // windup length in rows, frozen clear line
  const windup = (o) => { const out = []; const byA = {}; for (const w of o.cap.t) (byA[w[1]] ||= []).push(w);
    for (const rows of Object.values(byA)) { let s = null; for (let i = 0; i < rows.length; i++) { if (rows[i][2] && (i === 0 || !rows[i - 1][2])) s = rows[i][0]; if (s != null && !rows[i][2] && i > 0 && rows[i - 1][2]) { if (o.cap.fire.some((f) => f[1] === rows[i][1] && Math.abs(f[0] + 1 - rows[i][0]) <= 1)) out.push(rows[i][0] - s); s = null; } } }
    return out; };
  const ref = windup(f1);
  const all = runs.flatMap(windup);
  check('5 every completed charge has the frozen windup length', ref.length > 0 && all.length > 0 && all.every((n) => n === ref[0]), `frozen ${ref[0]} ticks; candidate ${[...new Set(all)].join(',')} over ${all.length} shots`);
  let moving = 0, notCharge = 0, lockDrift = 0, badShot = 0, n = 0;
  for (const o of runs) {
    for (const w of o.cap.t) if (w[2] && w[8] === 'hold') { n++; if (Math.hypot(w[5], w[6]) > 1e-6) moving++; if (w[7] !== 'charge') notCharge++; }
    const byA = {}; for (const w of o.cap.t) (byA[w[1]] ||= []).push(w);
    for (const rows of Object.values(byA)) for (let i = 1; i < rows.length; i++) if (rows[i][2] && rows[i - 1][2] && rows[i - 1][3] <= 260 && rows[i][4] !== rows[i - 1][4]) lockDrift++;
    for (const f of o.cap.fire) if (f[2] !== f[3]) badShot++;
  }
  check('5 while charging in the band the body stands, and the candidate stands aside', n > 0 && moving === 0 && notCharge === 0, `${n} charging ticks, moving ${moving}, other state ${notCharge}`);
  check('5 inside the 260ms lock the beam angle never moves, and every shot leaves on it', lockDrift === 0 && badShot === 0, `drift ${lockDrift}, off-lock shots ${badShot}`);
  const fl = runs[cases.indexOf('T11_los_flicker')];
  const rowsA = fl.res.actors.find((a) => a.type === 'sniper').rows;
  const cancels = rowsA.filter((w) => w[R.chargeCancel]);
  check('5 a charge is only ever cancelled on a cut line (the frozen 500ms re-arm follows)', cancels.every((w) => w[R.los] === 0 || w[R.see] === 0) && cancels.every((w) => w[R.fireCd] === 500 || w[R.fireCd] < 500), `${cancels.length} cancels`);
}

// ── 6. retreat always wins ──
{
  const c = await staged('ang', 'T6_rush');
  let n = 0, bad = 0;
  for (const w of c.cap.t) {
    if (w[8] !== 'retreat' || w[11]) continue;
    n++;
    const sp = Math.hypot(w[5], w[6]), dir = Math.atan2(w[6], w[5]);
    if (Math.abs(sp - w[9]) > 0.5 || Math.cos(dir - w[12]) < 0.98 || w[7] !== 'retreat') bad++;
  }
  check('6 every unobstructed retreat tick is the frozen retreat (cfg.speed, straight away), the candidate standing aside', n > 0 && bad === 0, `${n} retreat ticks, ${bad} off`);
}

// ── 7. no thrash ──
{
  const hop = await staged('ang', 'T5_cover_hop'), hopF = await staged('frozen', 'T5_cover_hop');
  const circ = keep.T4 = await staged('ang', 'T4_circle_console');
  const dancer = await staged('ang', 'T5b_cover_dancer');
  // a REVERSAL is a commitment replaced, in the same tick, by one on the other
  // side of the player: walking one way and turning round. It may only follow a
  // commitment that had its full chance (>= minCommitMs), never a frame's whim
  const reversals = (o) => { const out = []; let prev = null, start = null;
    for (const w of o.cap.t) {
      if (w[16] != null && (!prev || w[16] !== prev[16])) {
        if (prev && prev[16] != null && prev[15] && w[15] && w[15] !== prev[15]) out.push(Math.round((w[0] - start) * 1000 / 60));
        start = w[0];
      }
      prev = w;
    }
    return out; };
  for (const [nm, o, bounded] of [['T5 cover hop', hop, true], ['T4 circling', circ, true], ['T5b dancer', dancer, false]]) {
    const L = o.res.angLogs.find(Boolean);
    const perMin = L.commits / (o.res.trace.length / 3600);
    const rv = reversals(o);
    if (bounded) check(`7 ${nm}: commitments stay bounded (<= 45 a minute)`, perMin <= 45, `${perMin.toFixed(1)}/min (${L.commits})`);
    else console.log(`INFO  7 ${nm}: ${perMin.toFixed(1)} commitments a minute (${L.commits}) — a pilot that re-hides opposite the Marksman every tick; judged on the checks below, not the rate`);
    check(`7 ${nm}: at most two reversals, and none before the commitment had ${MARKSMAN_ANGLE.minCommitMs}ms`, rv.length <= 2 && rv.every((ms) => ms >= MARKSMAN_ANGLE.minCommitMs - 17), `${rv.length} reversals${rv.length ? ` after ${rv.join(', ')}ms` : ''} of ${L.commits} commitments`);
  }
  check('7 cover-hopping: the frozen hold never shoots; the candidate does', shots(hopF) === 0 && shots(hop) > 0, `frozen ${shots(hopF)}, candidate ${shots(hop)}`);
  const DL = dancer.res.angLogs.find(Boolean);
  check('7 a dancer who keeps the console between them gets OVERWATCH, not an endless chase', DL.overwatch > 0, `overwatch ${DL.overwatch}`);
  const ep = [hop, circ].flatMap(resp);
  check('7 no stop-go: within one blind episode a Marksman stops and restarts at most once', ep.every((r) => r.stopStarts <= 1), `max ${Math.max(...ep.map((r) => r.stopStarts))} over ${ep.length} episodes`);
}

// ── 8. several Marksmen ──
{
  const c = await staged('ang', 'T9_four_marksmen'), f = await staged('frozen', 'T9_four_marksmen');
  const byT = {}; for (const w of c.cap.t) if (w[13] != null) (byT[w[0]] ||= []).push([w[13], w[14]]);
  let clash = 0; for (const list of Object.values(byT)) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (Math.hypot(list[i][0] - list[j][0], list[i][1] - list[j][1]) < 60) clash++;
  const firing = c.a.actorRows.filter((r) => r.type === 'sniper' && r.shots > 0).length;
  const fFiring = f.a.actorRows.filter((r) => r.type === 'sniper' && r.shots > 0).length;
  check('8 four Marksmen never share a destination (60px)', clash === 0, `${clash} clashes`);
  check('8 all four shoot with the candidate; the frozen hold leaves two blind', firing === 4 && fFiring === 2, `candidate ${firing}/4, frozen ${fFiring}/4`);
}

// ── 9. a blind approach ──
{
  const c = await staged('ang', 'T7_far_behind_cover'), f = await staged('frozen', 'T7_far_behind_cover');
  const pressed = c.cap.t.filter((w) => w[7] === 'move' && w[11]).length;
  // the frozen walk-in may start a charge on the way in (a glimpse past the bench
  // that the 800ms windup outlives) — what it never does is land one
  check('9 behind far cover: the frozen walk-in never gets a shot; the candidate does', shots(f) === 0 && shots(c) > 0, `frozen ${attempts(f)} attempts / ${shots(f)} shots, candidate ${shots(c)} shots`);
  check('9 the candidate\'s own walk never presses into cover', pressed === 0, `${pressed} pressed ticks`);
}

// ── 10. RNG ──
{
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const files = ['src/systems/marksmanAngle.js', 'src/systems/firingSpot.js'];
  const hits = files.filter((f) => /Math\.random|Between\(|FloatBetween|\bRND\b|\.rng\b/.test(strip(readFileSync(ROOT + f, 'utf8'))));
  check('10 neither module draws a random number (code, comments stripped)', hits.length === 0, hits.join(' '));
}

// ── 11. exclusions ──
{
  const p = await tacPage(browser, VARIANTS.ang, Q.stagedRoom, 1001);
  const r = await p.evaluate(() => {
    const gs = window.__gs; gs.arenaActive = false;
    for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
    const out = {};
    out.nemesis = !!gs.spawnEnemyAt('sniper', 400, 400, { legacyArt: true })._marksmanAngle;
    for (const t of ['shooter', 'grunt', 'shielded', 'bomber', 'swarmling']) out[t] = !!gs.spawnEnemyAt(t, 800, 400, {})._marksmanAngle;
    out.elite = !!gs.spawnEnemyAt('sniper', 1200, 400, { elite: true })._marksmanAngle;
    out.regular = !!gs.spawnEnemyAt('sniper', 1200, 900, {})._marksmanAngle;
    return out;
  });
  await p.close();
  check('11 the nemesis Marksman (legacy art) is excluded', r.nemesis === false);
  check('11 Gunner, Rifleman, Bulwark, Demolisher and Swarmling are excluded', ['shooter', 'grunt', 'shielded', 'bomber', 'swarmling'].every((t) => r[t] === false), JSON.stringify(r));
  check('11 Regular and Elite Marksmen are both covered', r.regular && r.elite);
}

// ── 12. independence from `?marksmanStuck=early` ──
{
  const a = await staged('angB', 'T1_clear_los'), b = await staged('mkB', 'T1_clear_los');
  check('12 with both flags both candidates install', a.own.find((x) => x.type === 'sniper').ang && a.own.find((x) => x.type === 'sniper').stuck);
  check('12 the stuck candidate\'s own counters on a clear line are unchanged by the angle candidate', JSON.stringify(a.own[0].stuckLog) === JSON.stringify(b.own[0].stuckLog), JSON.stringify(a.own[0].stuckLog));
  check('12 and the clear line itself is tick-identical with or without the angle candidate', sameTrace(a.res.trace, b.res.trace) === -1);
  const c = await staged('angB', 'T2_blind_console');
  const e = resp(c)[0];
  check('12 with both flags the blind console is still solved (moving within 300ms, shooting)', e && e.firstMoveMs <= 300 && shots(c) > 0, `first move ${e?.firstMoveMs}ms, ${shots(c)} shots`);
}

// ── 13. speed ──
{
  let over = 0, n = 0, appr = 0;
  for (const o of [keep.T2_blind_console.c, keep.T2e_blind_console_elite.c, keep.T4]) for (const w of o.cap.t) {
    if (w[7] !== 'move' && w[7] !== 'settle') continue;
    n++;
    const lim = w[8] === 'approach' ? w[9] * 0.7 : w[9];
    if (w[8] === 'approach') appr++;
    if (Math.hypot(w[5], w[6]) > lim + 1e-6) over++;
  }
  const regSp = keep.T2_blind_console.c.cap.t[0][9], eliteSp = keep.T2e_blind_console_elite.c.cap.t[0][9];
  check('13 the candidate never walks faster than the frozen speeds (cfg.speed in the band, 0.7x approaching)', n > 0 && over === 0, `${n} walking ticks (${appr} approach), ${over} over`);
  check('13 Regular and Elite keep their own speeds (Elite 0.9x)', Math.abs(eliteSp - regSp * 0.9) < 1e-6, `${regSp} / ${eliteSp}`);
}

// ── 14. nothing left behind; Enemy.js untouched ──
{
  const count = async (vk) => {
    const p = await tacPage(browser, VARIANTS[vk], Q.stagedRoom, 1001);
    await runStaged(p, { ...T1_STAGED.T2_blind_console, seed: 1001, ticks: 300 });
    const r = await p.evaluate(() => { const gs = window.__gs; const ev = gs.events; let n = 0; for (const k of ev.eventNames()) n += ev.listenerCount(k); return { listeners: n, timers: gs.time.getAllEvents?.().length ?? gs.time._active?.length ?? 0, tweens: gs.tweens.getTweens().length }; });
    await p.close();
    return r;
  };
  const f = await count('frozen'), c = await count('ang');
  check('14 the candidate adds no scene listeners, timers or tweens', f.listeners === c.listeners && f.timers === c.timers && f.tweens === c.tweens, `frozen ${JSON.stringify(f)} / candidate ${JSON.stringify(c)}`);
  const g = enemyJsGuard(ROOT);
  check('14 the narrowed Enemy.js guard still holds (EnemySniper untouched)', g.outside && g.bomberOnlyVeto && g.vetoCode, g.detail);
}

// ── 15. cost ──
{
  const t = {};
  for (const vk of ['frozen', 'ang']) {
    const p = await tacPage(browser, VARIANTS[vk], Q.mixed, 1001);
    await p.evaluate(() => { window.__tac.on = false; });
    const t0 = Date.now();
    await runEnc(p, { seed: 1001, ticks: 2400, pilot: { mode: 'hide' }, fire: 7 });
    t[vk] = (Date.now() - t0) / 2.4;
    await p.close();
  }
  console.log(`INFO  15 ms per 1000 ticks, headless MIXED (hide), recorder off: frozen ${t.frozen.toFixed(0)}, candidate ${t.ang.toFixed(0)}`);
  check('15 the candidate costs under 25% more simulation time in a real MIXED', t.ang <= t.frozen * 1.25, `${(100 * (t.ang / t.frozen - 1)).toFixed(1)}%`);
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
