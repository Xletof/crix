// SMOKE: PHASE T2 — the ordinary FREE Bulwark's tactical-engagement candidate
// (`?bulwarkAngle=1`; src/systems/bulwarkAngle.js). Standalone, like the
// roster smokes. Every staged case is the REAL Detention room through
// `diag-tactical-engagement.mjs`'s own observe-only instrument, each on a FRESH
// page (a staged case otherwise inherits per-object clocks).
//
// Every candidate check is paired with the frozen hold, so the suite can tell
// the two apart (pointed at a build without the flag, the candidate checks fail).
//
//   1  flag-off is the game the human last played: seeded MIXED and both
//      VANGUARDs tick for tick and draw for draw against a pre-T2 server
//   2  installed on every ordinary FREE Bulwark, Regular and Elite, and nowhere
//      else: not a VANGUARD screen or opener, not the nemesis, no other role
//   3  VANGUARD, with and without the Captain, is the same fight with the flag
//      on — positions, RNG, and nothing installed — with the stuck flag off and on
//   4  where the frozen hold is right it is left exactly alone: a clear line
//      under fire, a flank loop, a screen in the acceptance geometry, and a
//      pocket with no spot at all (a stable, bounded fallback) are tick-identical
//   5  THE ACCEPTANCE CASES: blind behind a console in its hold, Regular and
//      Elite — evaluated on the first blind tick, moving within 300ms, a shot
//      inside 4s; the walk-in, the narrow passage and the long wall; the frozen
//      hold never shoots in any of them
//   6  THE SHIELD IS THE FROZEN SHIELD: every AI tick, in every case, the facing
//      is exactly the frozen turn law (2.6 rad/s) and the gun aim is the shield;
//      the module names none of the shield's or the gun's state
//   7  THE COOLDOWN IS THE FROZEN COOLDOWN: it counts down only on an open line
//      and re-rolls only on a shot, every tick of every case (the
//      reacquire-to-warn delay this leaves is reported, not changed)
//   8  blocking and the Super: frontal fire is still blocked, a Super still
//      punches through, identical with the flag
//   9  independent of `?bulwarkStuck=early`: all four combinations, both install,
//      the stuck candidate's own work on a clear line is unchanged
//  10  no thrash: a circling player and a cover hopper get bounded commitments,
//      no turn-around before a commitment had its chance
//  11  several Bulwarks never share a destination, and all of them shoot
//  12  Regular and Elite: both covered, neither walks faster than its own speed
//  13  the approved T1 Marksman is unchanged: its staged acceptance case is the
//      pre-T2 server tick for tick, and its module is byte-identical
//  14  RNG: the module draws no random number
//  15  no listeners, timers or tweens; nothing left on the scene; Enemy.js untouched
//  16  cost: the Bulwark's own AI tick, timed from outside, in a real MIXED (whole-sim time reported)
//
// usage: node tests/smoke-bulwark-angle.mjs [--base=URL] [--old=URL of any pre-T2 server (b1ab701), default :5174]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { CHROME } from './diag-stuck-audit.mjs';
import { tacPage, runStaged, runEnc, T1_STAGED, T2_STAGED, VARIANTS, Q, analyse } from './diag-tactical-engagement.mjs';
import { enemyJsGuard } from './enemy-frozen.mjs';
import { BULWARK_ANGLE } from '../src/systems/bulwarkAngle.js';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = opt('base', 'http://localhost:5173/');
const OLD = opt('old', 'http://localhost:5174/');
const ROOT = new URL('../', import.meta.url).pathname;
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

// a fresh page per case, with a per-tick capture of each Bulwark and the two
// frozen laws checked from OUTSIDE everything (installed after the spawn, so it
// sees the frozen tick and the candidate's review together)
async function staged(vk, name, seed = 1001, base = BASE, table = T2_STAGED) {
  const p = await tacPage(browser, VARIANTS[vk], Q.stagedRoom, seed, base);
  await capture(p);
  const res = await runStaged(p, { ...table[name], seed });
  const cap = await p.evaluate(() => window.__cap);
  const own = await p.evaluate(() => window.__tac.list.map((r) => ({ type: r.type, ang: !!r.e._bulwarkAngle, stuck: !!r.e._bulwarkStuck,
    stuckLog: r.e._bulwarkStuck ? JSON.stringify(r.e._bulwarkStuck.log ?? null) : null })));
  await p.close();
  return { res, cap, own, a: analyse(res, { scenario: name, variant: vk, seed }, res.geo) };
}
async function capture(p) {
  await p.evaluate(() => {
    const T = window.__tac, gs = window.__gs;
    // Phaser's own Angle.Wrap and Clamp, written out so the law is reproduced bit for bit
    const wrap = (a) => -Math.PI + ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const C = window.__cap = { t: [], fire: [], blocks: 0, law: { n: 0, turnBad: 0, aimBad: 0, blindN: 0, lineN: 0, cdBad: 0, rerolls: 0 } };
    gs.events.on('shooter-fire', (e, ang) => { if (e.__tac && e.enemyType === 'shielded') C.fire.push([T.tick, e.__tac.id, ang]); });
    const wrap0 = T.wrap;
    T.wrap = (e) => {
      wrap0(e);
      if (e.enemyType !== 'shielded') return;
      const ob = e.onBlock;
      e.onBlock = function (...a) { C.blocks++; return ob ? ob.apply(this, a) : undefined; };
      const tick = e._tickSwarm;
      e._tickSwarm = function (delta, player) {
        const f0 = this._shieldFacing, cd0 = this.fireCd;
        const to = Math.atan2(player.y - this.y, player.x - this.x);
        const out = tick.call(this, delta, player);
        const L = C.law; L.n++;
        const mt = this._shieldTurnRate * (delta / 1000);
        if (this._shieldFacing !== f0 + clamp(wrap(to - f0), -mt, mt)) L.turnBad++;
        if (this._aim !== this._shieldFacing) L.aimBad++;
        // the fire gate, read after the tick from the same positions it used
        const open = this.canSee(player) && this._hasLOS(this.x, this.y, player.x, player.y);
        const cd = this.cfg.fireCooldownMs;
        if (!open) { L.blindN++; if (this.fireCd !== cd0) L.cdBad++; }
        else {
          L.lineN++;
          const d = cd0 - delta;
          if (this.fireCd === d) { /* counting down */ }
          else if (d <= 0 && this.fireCd >= cd * 0.8 && this.fireCd <= cd * 1.2) L.rerolls++;
          else L.cdBad++;
        }
        return out;
      };
    };
    const step0 = T.step;
    T.step = () => {
      step0();
      const P = gs.player;
      for (const r of T.list) {
        const e = r.e;
        if (r.type !== 'shielded' || !(e.active && e.alive)) continue;
        const M = e._bulwarkAngle, b = e.body.blocked;
        C.t.push([T.tick, r.id, M ? M.state : '', M ? M.branch : '', e.body.velocity.x, e.body.velocity.y, e.cfg.speed,
          Math.hypot(P.x - e.x, P.y - e.y), +!b.none, M?.commit ? M.commit.x : null, M?.commit ? M.commit.y : null,
          M?.commit ? M.commit.side : null, M?.commit ? M.commit.at : null, e.x, e.y]);
      }
    };
  });
}
const sameTrace = (a, b) => { const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return i; return a.length === b.length ? -1 : n; };
const resp = (o) => o.a.respRows.filter((r) => r.section === 'resp');
const bw = (o) => o.a.actorRows.filter((r) => r.type === 'shielded');
const shots = (o) => bw(o).reduce((s, r) => s + r.shots, 0);
const logOf = (o) => o.res.angLogs.find(Boolean);
const LAW = { n: 0, turnBad: 0, aimBad: 0, blindN: 0, lineN: 0, cdBad: 0, rerolls: 0 };
const law = (o) => { for (const k of Object.keys(LAW)) LAW[k] += o.cap.law[k]; return o; };
const runs = {};
const get = async (vk, name) => (runs[`${vk}:${name}`] ||= law(await staged(vk, name)));

// ── 1. flag-off identity against the build the human last played ──
for (const [enc, pilot] of [['mixed', 'handset'], ['vanguard', 'handset'], ['vanguardCaptain', 'handset']]) {
  const tr = [];
  for (const base of [BASE, OLD]) {
    const p = await tacPage(browser, VARIANTS.frozen, Q[enc], 1001, base);
    const res = await runEnc(p, { seed: 1001, ticks: 2400, pilot: { mode: pilot }, fire: 7 });
    tr.push({ trace: res.trace, ang: await p.evaluate(() => window.__gs.enemies.getChildren().some((e) => e._bulwarkAngle)) });
    await p.close();
  }
  const d = sameTrace(tr[0].trace, tr[1].trace);
  check(`1 flag off: ${enc} (${pilot}) is the pre-T2 build tick for tick and draw for draw`, d === -1 && tr[0].trace.length === 2400, `first divergence ${d}`);
  check(`1 flag off: nothing installed in ${enc}`, !tr[0].ang);
}

// ── 2. installed on every ordinary FREE Bulwark, and nowhere else ──
{
  const p = await tacPage(browser, VARIANTS.bwA, Q.mixed, 1001);
  await runEnc(p, { seed: 1001, ticks: 1200, pilot: { mode: 'handset' }, fire: 7 });
  const by = await p.evaluate(() => window.__tac.list.map((r) => ({ type: r.type, screen: !!r.e._screen, ang: !!r.e._bulwarkAngle })));
  const r = await p.evaluate(() => {
    const gs = window.__gs; gs.arenaActive = false;
    for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
    const SCREEN = { holdPx: 140, resumePx: 165 };
    const out = {};
    out.nemesis = !!gs.spawnEnemyAt('shielded', 400, 400, { legacyArt: true })._bulwarkAngle;
    out.screen = !!gs.spawnEnemyAt('shielded', 600, 400, { vanguardScreen: SCREEN })._bulwarkAngle;
    out.opener = !!gs.spawnEnemyAt('shielded', 700, 400, { vanguardScreen: SCREEN, vanguardLane: { sign: 1, px: 60 } })._bulwarkAngle;
    for (const t of ['shooter', 'grunt', 'sniper', 'bomber', 'swarmling']) out[t] = !!gs.spawnEnemyAt(t, 800, 400, {})._bulwarkAngle;
    out.regular = !!gs.spawnEnemyAt('shielded', 1200, 900, {})._bulwarkAngle;
    out.elite = !!gs.spawnEnemyAt('shielded', 1200, 400, { elite: true })._bulwarkAngle;
    return out;
  });
  await p.close();
  const free = by.filter((x) => x.type === 'shielded' && !x.screen), other = by.filter((x) => x.type !== 'shielded');
  check('2 every free Bulwark in MIXED carries the candidate', free.length > 0 && free.every((x) => x.ang), `${free.filter((x) => x.ang).length}/${free.length}`);
  check('2 no other role in MIXED carries it', other.length > 0 && other.every((x) => !x.ang), `${other.length} checked`);
  check('2 a VANGUARD screen and an opener are excluded', r.screen === false && r.opener === false);
  check('2 the nemesis shielded (legacy art) is excluded', r.nemesis === false);
  check('2 Gunner, Rifleman, Marksman, Demolisher and Swarmling are excluded', ['shooter', 'grunt', 'sniper', 'bomber', 'swarmling'].every((t) => r[t] === false), JSON.stringify(r));
  check('2 Regular and Elite free Bulwarks are both covered', r.regular && r.elite);
}

// ── 3. VANGUARD, with and without the Captain ──
for (const enc of ['vanguard', 'vanguardCaptain']) for (const [off, on] of [['frozen', 'bwA'], ['bwB', 'bwAB']]) {
  const tr = [];
  for (const vk of [off, on]) {
    const p = await tacPage(browser, VARIANTS[vk], Q[enc], 1001);
    const res = await runEnc(p, { seed: 1001, ticks: 2400, pilot: { mode: 'handset' }, fire: 7 });
    const st = await p.evaluate(() => ({
      ang: window.__tac.list.some((r) => r.e._bulwarkAngle),
      shields: window.__tac.list.filter((r) => r.type === 'shielded').length,
      screens: window.__tac.list.filter((r) => r.type === 'shielded' && r.e._screen).length,
      front: JSON.stringify(window.__gs._vanguardFront ?? null, (k, v) => (v && typeof v === 'object' && v.scene ? '[actor]' : v)),
    }));
    tr.push({ trace: res.trace, st });
    await p.close();
  }
  const d = sameTrace(tr[0].trace, tr[1].trace);
  check(`3 ${enc}: ${on} is ${off} tick for tick and draw for draw (positions, RNG)`, d === -1 && tr[0].trace.length === 2400, `first divergence ${d}`);
  check(`3 ${enc}: every shield is a screen, none carries the candidate, the front ends in the same state`,
    !tr[1].st.ang && tr[1].st.shields > 0 && tr[1].st.screens === tr[1].st.shields && tr[0].st.front === tr[1].st.front,
    `${tr[1].st.screens}/${tr[1].st.shields} screens`);
}

// ── 4. where the frozen hold is right, nothing changes ──
for (const name of ['B1_clear_hold', 'B7_flank_loop', 'B12_screen_excluded', 'B10_no_spot']) {
  const f = await get('frozen', name), c = await get('bwA', name);
  const d = sameTrace(f.res.trace, c.res.trace);
  check(`4 ${name}: flag on is tick-identical to the frozen hold`, d === -1, `first divergence ${d}`);
}
{
  const c = runs['bwA:B1_clear_hold'];
  check('4 B1: the clear line is held under fire — the shield blocks, the gun fires, the candidate never walks', c.cap.blocks > 0 && c.cap.fire.length > 0 && logOf(c).commits === 0,
    `${c.cap.blocks} blocks, ${c.cap.fire.length} shots, ${logOf(c).commits} commitments`);
  const N = logOf(runs['bwA:B10_no_spot']), w = runs['bwA:B10_no_spot'].cap.t;
  const evalBound = Math.ceil(1200 * 1000 / 60 / BULWARK_ANGLE.retryMs) + 4;
  check('4 B10 no spot: a stable fallback — no commitment, one bounded look per 250ms, never a step', N.commits === 0 && N.evals <= evalBound && w.every((q) => q[2] === 'noSpot' && Math.hypot(q[4], q[5]) === 0),
    `evals ${N.evals} <= ${evalBound}, states ${[...new Set(w.map((q) => q[2]))].join('/')}`);
  check('4 B12: a VANGUARD screen in the acceptance geometry is not installed', !runs['bwA:B12_screen_excluded'].own.some((x) => x.ang));
}

// ── 5. THE ACCEPTANCE CASES ──
for (const name of ['B2_blind_console', 'B2e_blind_console_elite']) {
  const f = await get('frozen', name), c = await get('bwA', name);
  check(`5 ${name}: the frozen hold never shoots in 20s (the defect)`, shots(f) === 0);
  const e = resp(c)[0];
  check(`5 ${name}: evaluated on the first blind tick`, e && e.evalMs === 0, `eval ${e?.evalMs}ms`);
  check(`5 ${name}: committed and moving within 300ms`, e && e.selectMs <= 300 && e.firstMoveMs <= 300, `committed ${e?.selectMs}ms, first move ${e?.firstMoveMs}ms`);
  const first = c.cap.fire[0];
  check(`5 ${name}: a normal shot inside 4s`, first && first[0] * 1000 / 60 <= 4000, `first shot ${first ? Math.round(first[0] * 1000 / 60) : '-'}ms; ${shots(c)} shots in 20s`);
  const d = c.cap.t.map((q) => q[7]);
  check(`5 ${name}: it pressed CLOSER, inside its hold, and never backed off past it`, Math.max(...d.slice(30)) <= 290 + 1 && Math.min(...d) >= BULWARK_ANGLE.bandLo - 1,
    `distance ${Math.round(Math.min(...d))}-${Math.round(Math.max(...d.slice(30)))}`);
}
for (const name of ['B2w_walk_in', 'B4_narrow_passage', 'B5_long_wall']) {
  const f = await get('frozen', name), c = await get('bwA', name);
  check(`5 ${name}: the frozen Bulwark never shoots; the candidate does`, shots(f) === 0 && shots(c) > 0, `frozen ${shots(f)}, candidate ${shots(c)}`);
  const pressed = c.cap.t.filter((q) => (q[2] === 'move' || q[2] === 'settle') && q[8]).length;
  check(`5 ${name}: the candidate's own walk never presses into cover`, pressed === 0, `${pressed} pressed ticks`);
}

// ── 10-12 (the staged runs the laws below are also checked over) ──
{
  const turns = (o) => { const out = []; const byA = {};
    for (const w of o.cap.t) (byA[w[1]] ||= []).push(w);
    for (const rows of Object.values(byA)) { let prev = null, from = null, start = null;
      for (const w of rows) {
        if (w[12] != null && (!prev || w[12] !== prev[12])) {
          if (prev && prev[12] != null) {
            const a0 = Math.atan2(prev[10] - from[1], prev[9] - from[0]), a1 = Math.atan2(w[10] - w[14], w[9] - w[13]);
            let d = Math.abs(a1 - a0) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d;
            out.push({ deg: d * 180 / Math.PI, ms: (w[0] - start) * 1000 / 60 });
          }
          start = w[0]; from = [w[13], w[14]];
        }
        prev = w;
      } }
    return out; };
  for (const name of ['B3_circle_console', 'B13_cover_hop']) {
    const c = await get('bwA', name), f = await get('frozen', name);
    const L = logOf(c), perMin = L.commits / (c.res.trace.length / 3600);
    const ta = turns(c).filter((t) => t.deg > 120);
    check(`10 ${name}: commitments stay bounded (<= 45 a minute)`, perMin <= 45, `${perMin.toFixed(1)}/min (${L.commits})`);
    check(`10 ${name}: at most one turn-around (>120deg), never before ${BULWARK_ANGLE.minCommitMs}ms`, ta.length <= 1 && ta.every((t) => t.ms >= BULWARK_ANGLE.minCommitMs - 17),
      `${ta.length} turn-arounds${ta.length ? ` after ${ta.map((t) => Math.round(t.ms)).join(', ')}ms` : ''}`);
    const ep = resp(c);
    check(`10 ${name}: no stop-go — within one blind episode it stops and restarts at most once`, ep.every((r) => r.stopStarts <= 1), `max ${Math.max(0, ...ep.map((r) => r.stopStarts))} over ${ep.length} episodes`);
    console.log(`INFO  10 ${name}: shots frozen ${shots(f)} / candidate ${shots(c)}; line held ${(100 * bw(f)[0].validLineFrac).toFixed(0)}% / ${(100 * bw(c)[0].validLineFrac).toFixed(0)}%; blind standing ${(100 * bw(f)[0].standNoLineFrac).toFixed(0)}% / ${(100 * bw(c)[0].standNoLineFrac).toFixed(0)}%`);
  }
  check('10 cover-hopping: the candidate gets more shots than the frozen hold', shots(runs['bwA:B13_cover_hop']) > shots(runs['frozen:B13_cover_hop']),
    `frozen ${shots(runs['frozen:B13_cover_hop'])}, candidate ${shots(runs['bwA:B13_cover_hop'])}`);
  const B3 = runs['bwA:B3_circle_console'];
  check('10 a player circling the console: it keeps a working spot for a moving target (not a chase on every corner)', logOf(B3).kept > 0, `kept ${logOf(B3).kept}`);

  const c = await get('bwA', 'B8_three_bulwarks'), f = await get('frozen', 'B8_three_bulwarks');
  const byT = {}; for (const w of c.cap.t) if (w[9] != null) (byT[w[0]] ||= []).push([w[9], w[10]]);
  let clash = 0; for (const list of Object.values(byT)) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (Math.hypot(list[i][0] - list[j][0], list[i][1] - list[j][1]) < BULWARK_ANGLE.takenPx) clash++;
  check(`11 three Bulwarks never share a destination (${BULWARK_ANGLE.takenPx}px)`, clash === 0, `${clash} clashes`);
  check('11 all three shoot with the candidate; the frozen hold leaves all three blind', bw(c).filter((r) => r.shots > 0).length === 3 && bw(f).filter((r) => r.shots > 0).length === 0,
    `candidate ${bw(c).filter((r) => r.shots > 0).length}/3, frozen ${bw(f).filter((r) => r.shots > 0).length}/3`);

  const re = await get('bwA', 'B11_regular_elite');
  check('12 a Regular and an Elite on the same console both shoot', bw(re).length === 2 && bw(re).every((r) => r.shots > 0), bw(re).map((r) => r.shots).join(' / '));
  let over = 0, n = 0;
  for (const o of Object.values(runs)) for (const w of o.cap.t) {
    if (w[2] !== 'move' && w[2] !== 'settle') continue;
    n++;
    if (Math.hypot(w[4], w[5]) > w[6] + 1e-6) over++;
  }
  const sp = re.cap.t.filter((w) => w[0] === 1).map((w) => w[6]);
  check('12 the candidate never walks faster than the bearer\'s own frozen speed', n > 0 && over === 0, `${n} walking ticks, ${over} over`);
  check('12 Regular and Elite keep their own speeds', sp.length === 2 && sp[0] > 0 && sp[1] > 0, sp.join(' / '));
}

// ── 6 + 7. the two frozen laws, over every staged run above ──
{
  check('6 THE SHIELD: every AI tick of every case turns exactly by the frozen law (2.6 rad/s), flag on and off', LAW.n > 5000 && LAW.turnBad === 0, `${LAW.turnBad} off-law of ${LAW.n} ticks`);
  check('6 the gun and body track the shield, never the target (_aim == _shieldFacing) on every tick', LAW.aimBad === 0, `${LAW.aimBad} ticks`);
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const src = strip(readFileSync(ROOT + 'src/systems/bulwarkAngle.js', 'utf8'));
  // it may READ the cooldown (that is how it notices a shot has left); it may
  // write none of the shield, the gun, the cooldown or the damage path
  const named = ['_shieldFacing', '_shieldHalfArc', '_shieldTurnRate', '_blocksFrontal', 'isFrontalHit', '_aim', '_warnFlashed', '_maybeFireAt', 'damage'].filter((k) => src.includes(k));
  const writes = src.match(/\.(fireCd|_fireAnimTimer|recoilT|cfg\.[a-zA-Z]+|speed)\s*([-+*/]?=)(?!=)/g) || [];
  check('6 the module names none of the shield, gun or damage state, and writes no cooldown or config (code, comments stripped)', named.length === 0 && writes.length === 0, [...named, ...writes].join(' '));
  check('7 THE COOLDOWN: it counts down only on an open line and re-rolls only on a shot, every tick of every case', LAW.cdBad === 0 && LAW.blindN > 0 && LAW.lineN > 0 && LAW.rerolls > 0,
    `${LAW.cdBad} off-law; ${LAW.blindN} blind ticks held, ${LAW.lineN} line ticks, ${LAW.rerolls} re-rolls`);
  const all = Object.entries(runs).filter(([k]) => k.startsWith('bwA:')).flatMap(([, o]) => o.a.actorRows.filter((r) => r.type === 'shielded' && r.reacqEpisodes));
  if (all.length) console.log(`INFO  7 reacquire -> attack onset (the frozen cooldown remainder), candidate staged cases: mean of means ${Math.round(all.reduce((s, r) => s + r.reacqToAttackMeanMs, 0) / all.length)}ms, max ${Math.max(...all.map((r) => r.reacqToAttackMaxMs))}ms over ${all.reduce((s, r) => s + r.reacqEpisodes, 0)} reacquisitions`);
}

// ── 8. blocking and the Super ──
{
  const out = {};
  for (const vk of ['frozen', 'bwA']) {
    const p = await tacPage(browser, VARIANTS[vk], Q.stagedRoom, 1001);
    await capture(p);
    out[vk] = await p.evaluate(() => {
      const T = window.__tac, gs = window.__gs, P = gs.player;
      T.stage({ ticks: 0, seed: 1001, actors: [{ type: 'shielded', x: 1300, y: 1000 }], player: { mode: 'stand', x: 1050, y: 1000 } });
      for (let i = 0; i < 90; i++) T.step();
      const e = T.list[0].e, hp0 = e.hp, blocks0 = window.__cap.blocks;
      // a frontal ordinary shot: blocked, no damage
      P.keyboardFire();
      for (let i = 0; i < 30; i++) T.step();
      const hp1 = e.hp, blocks1 = window.__cap.blocks;
      // a frontal Super: piercing, through the shield
      P.superCharge = 999; P.tryFireSuper(Math.atan2(e.y - P.y, e.x - P.x));
      for (let i = 0; i < 30; i++) T.step();
      return { hp0, hp1, hp2: e.alive ? e.hp : 0, alive: e.alive, blocked: blocks1 - blocks0, facing: e._shieldFacing };
    });
    await p.close();
  }
  const f = out.frozen, c = out.bwA;
  check('8 a frontal ordinary shot is blocked with no damage, flag on and off', f.blocked > 0 && c.blocked > 0 && f.hp1 === f.hp0 && c.hp1 === c.hp0, JSON.stringify({ frozen: f.blocked, candidate: c.blocked }));
  check('8 a frontal Super punches through, flag on and off, for the same damage', f.hp2 < f.hp1 && c.hp2 < c.hp1 && f.hp1 - f.hp2 === c.hp1 - c.hp2, `frozen ${f.hp1 - f.hp2}, candidate ${c.hp1 - c.hp2}`);
}

// ── 9. independence from `?bulwarkStuck=early` ──
{
  const a = await get('bwAB', 'B1_clear_hold'), b = await get('bwB', 'B1_clear_hold');
  const ownA = a.own.find((x) => x.type === 'shielded'), ownB = b.own.find((x) => x.type === 'shielded');
  check('9 with both flags both candidates install', ownA.ang && ownA.stuck);
  check('9 the stuck candidate\'s own work on a clear line is unchanged by the angle candidate', ownA.stuckLog === ownB.stuckLog && sameTrace(a.res.trace, b.res.trace) === -1, ownA.stuckLog);
  for (const name of ['B2_blind_console', 'B4_narrow_passage']) {
    const r = {};
    for (const vk of ['frozen', 'bwB', 'bwA', 'bwAB']) r[vk] = shots(await get(vk, name));
    // B2 is a pure angle problem (stuck-B alone never shoots); in B4 stuck-B
    // alone already walks it round the post — the angle candidate must not
    // take that away, with or without it
    check(`9 ${name}: all four combinations — the frozen hold never shoots, the angle candidate shoots with and without stuck-B, and never less than stuck-B alone`,
      r.frozen === 0 && r.bwA > 0 && r.bwAB > 0 && r.bwAB >= r.bwB && (name !== 'B2_blind_console' || r.bwB === 0), JSON.stringify(r));
  }
  const c = await get('bwAB', 'B2_blind_console'), e = resp(c)[0];
  check('9 with both flags the blind console is still solved within 300ms', e && e.firstMoveMs <= 300, `first move ${e?.firstMoveMs}ms`);
}

// ── 13. the approved T1 Marksman is unchanged ──
{
  const tr = [];
  for (const base of [BASE, OLD]) {
    const p = await tacPage(browser, VARIANTS.angB, Q.stagedRoom, 1001, base);
    tr.push(await runStaged(p, { ...T1_STAGED.T2_blind_console, seed: 1001 }));
    await p.close();
  }
  const sig = (r) => JSON.stringify([r.actors.map((a) => a.rows), r.trace, r.angLogs]);
  check('13 T1 (with stuck-B, as approved) on its acceptance case is the pre-T2 build row for row, draw for draw', sig(tr[0]) === sig(tr[1]));
  const d1 = execSync('git diff 0b772cf -- src/systems/marksmanAngle.js', { cwd: ROOT, encoding: 'utf8' });
  const d2 = execSync('git diff -U0 0b772cf -- src/systems/firingSpot.js', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l));
  const strip = (l) => l.slice(1).replace(/\/\/.*$/, '').replace(/^export /, '').trim();
  const code = d2.filter((l) => strip(l) !== '');
  const minus = code.filter((l) => l[0] === '-').map(strip), plus = code.filter((l) => l[0] === '+').map(strip);
  check('13 marksmanAngle.js is byte-identical to the approved 0b772cf', d1 === '');
  check('13 firingSpot.js differs from 0b772cf only by two `export` keywords (and their comments)', minus.length === 2 && JSON.stringify(minus) === JSON.stringify(plus), JSON.stringify(code));
}

// ── 14. RNG ──
{
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const hit = /Math\.random|Between\(|FloatBetween|\bRND\b|\.rng\b/.test(strip(readFileSync(ROOT + 'src/systems/bulwarkAngle.js', 'utf8')));
  check('14 the module draws no random number (code, comments stripped)', !hit);
}

// ── 15. nothing left behind; Enemy.js untouched ──
{
  const count = async (vk) => {
    const p = await tacPage(browser, VARIANTS[vk], Q.stagedRoom, 1001);
    await runStaged(p, { ...T2_STAGED.B2_blind_console, seed: 1001, ticks: 300 });
    const r = await p.evaluate(() => {
      const gs = window.__gs; const ev = gs.events; let n = 0; for (const k of ev.eventNames()) n += ev.listenerCount(k);
      const keys = Object.keys(gs).sort().join(',');
      for (const e of gs.enemies.getChildren().slice()) gs._destroyEnemyFully(e);
      return { listeners: n, timers: gs.time.getAllEvents?.().length ?? gs.time._active?.length ?? 0, tweens: gs.tweens.getTweens().length, keys, left: gs.enemies.getChildren().length };
    });
    await p.close();
    return r;
  };
  const f = await count('frozen'), c = await count('bwA');
  check('15 the candidate adds no scene listeners, timers or tweens', f.listeners === c.listeners && f.timers === c.timers && f.tweens === c.tweens,
    `frozen ${JSON.stringify({ ...f, keys: undefined })} / candidate ${JSON.stringify({ ...c, keys: undefined })}`);
  check('15 the candidate puts nothing on the scene, and its actors sweep like any other', f.keys === c.keys && c.left === f.left);
  const g = enemyJsGuard(ROOT);
  check('15 the narrowed Enemy.js guard still holds (EnemyShielded untouched)', g.outside && g.bomberOnlyVeto && g.vetoCode, g.detail);
}

// ── 16. cost ──
// Whole-simulation wall time is reported, not asserted: it moves with the
// machine's load and with the fight itself (a candidate that shoots more puts
// more bullets in the world). What is asserted is the time spent INSIDE the
// Bulwarks' own AI ticks (the frozen tick plus the candidate's review), per
// Bulwark AI tick, timed from outside everything.
{
  const t = {};
  for (const vk of ['frozen', 'bwA']) {
    const p = await tacPage(browser, VARIANTS[vk], Q.mixed, 1001);
    t[vk] = await p.evaluate(() => {
      const T = window.__tac, gs = window.__gs;
      T.on = false;
      const st = { aiMs: 0, aiTicks: 0, simMs: 0 }, seen = new Set();
      const hook = () => { for (const e of gs.enemies.getChildren()) if (e.enemyType === 'shielded' && !seen.has(e)) {
        seen.add(e); const tk = e._tickSwarm;
        e._tickSwarm = function (...a) { const t0 = performance.now(); const o = tk.apply(this, a); st.aiMs += performance.now() - t0; st.aiTicks++; return o; };
      } };
      T.begin({ seed: 1001, pilot: { mode: 'hide' }, fire: 7 });
      const t0 = performance.now();
      for (let i = 0; i < 2400; i++) { hook(); T.step(); }
      st.simMs = performance.now() - t0;
      return st;
    });
    await p.close();
  }
  const per = (o) => o.aiMs / Math.max(1, o.aiTicks);
  console.log(`INFO  16 headless MIXED (hide), 2400 ticks, recorder off: whole sim frozen ${t.frozen.simMs.toFixed(0)}ms / candidate ${t.bwA.simMs.toFixed(0)}ms; Bulwark AI ${t.frozen.aiMs.toFixed(0)}ms / ${t.bwA.aiMs.toFixed(0)}ms over ${t.frozen.aiTicks} / ${t.bwA.aiTicks} Bulwark ticks`);
  check('16 a Bulwark AI tick with the candidate costs under 0.1ms (frozen tick + review, timed from outside)', per(t.bwA) < 0.1 && t.bwA.aiTicks > 1000,
    `${(per(t.bwA) * 1000).toFixed(1)}us per tick (frozen ${(per(t.frozen) * 1000).toFixed(1)}us)`);
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
