// DIAGNOSTIC — PHASE 3B: THE ORDINARY BULWARK'S STUCK-RECOVERY CANDIDATES.
// Prints numbers and writes `docs/evidence/bulwark-stuck-v3b/`; asserts nothing
// (`tests/smoke-bulwark-stuck.mjs` asserts). Every mode is the REAL URL flag on
// a real page — never a page-side patch:
//
//   baseline  no flag (the frozen game, == 690ed9b — smoke-bulwark-stuck §1)
//   A         ?bulwarkStuck=prog   (false first check + intentional hold stood down)
//   B         ?bulwarkStuck=early  (A, plus pinned arms kept / pinned checks armed)
//
// The Phase 3A instrument (`diag-stuck-audit.mjs`, variant 'A' = observe only)
// is installed on every page: it records each base check, which branch
// `_moveToward` took every tick, contact and engagement. It writes nothing.
//
// SECTIONS (`--only=staged,front,live,iso,perf`, each its own CSV, then
// `--merge` writes `bulwark-stuck-candidate-metrics.csv`):
//   staged  clear lane (5 Bulwark modes), hold -> resume, obstacles (console,
//           90x90, 240px wall — before and after the first check — angled,
//           hold -> resume into an obstruction, opener crossing furniture)
//   front   the VANGUARD opening: 6 player conditions x Captain on/off x seeds
//   live    a real VANGUARD at 1x, a scripted player who approaches, holds,
//           flanks, retreats and crosses behind, with Supers
//   iso     encounters with no Bulwark: candidates must equal baseline exactly
//   perf    12 Bulwarks, ms per tick per mode
//
// usage: node tests/diag-bulwark-stuck.mjs [--only=...] [--seeds=8] [--fseeds=6] [--out=DIR]
//        node tests/diag-bulwark-stuck.mjs --merge
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { CHROME, bootPage, installAudit, installStaged } from './diag-stuck-audit.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const OUT = opt('out', new URL('../docs/evidence/bulwark-stuck-v3b/', import.meta.url).pathname);
export const MODES = [['baseline', ''], ['A', 'bulwarkStuck=prog'], ['B', 'bulwarkStuck=early']];
export const SCREEN = { vanguardScreen: { holdPx: 140, resumePx: 165 } };
export const ROLES = {
  'free-R': { type: 'shielded' },
  'free-E': { type: 'shielded', elite: true },
  'screen-R': { type: 'shielded', spec: SCREEN },
  'screen-E': { type: 'shielded', elite: true, spec: SCREEN },
  opener: { type: 'shielded', spec: { ...SCREEN, vanguardLane: { sign: 1, px: 60 } } },
};
// staged obstacles: [x, y, w, h]. NEAR is met before the first 600ms check,
// FAR after it. Real cover bodies are 70x70.
export const OBSTACLES = {
  'console70-near': { wall: [800, 390, 70, 70] },
  'console70-far': { wall: [800, 700, 70, 70] },
  'cover90-near': { wall: [800, 390, 90, 90] },
  'cover90-far': { wall: [800, 700, 90, 90] },
  'wall240-near': { wall: [800, 390, 240, 40] },
  'wall240-far': { wall: [800, 700, 240, 40] },
  angled: { wall: [650, 620, 90, 90], ax: 500 },                    // a corner met off-axis
  'holdresume-obstruct': { wall: [800, 620, 240, 40], away: true },  // the resume walks into it
  'opener-furniture': { wall: [775, 600, 70, 70], roles: ['opener'] },
};
export const VANGUARD_Q = (champ) => `encdbg=vanguard&room=hangar&sector=8&wave=2${champ ? '' : '&nochamp=1'}`;
// the VANGUARD opening's player conditions (null = the room spawn, 200,700)
export const FRONT_POS = {
  spawn: { pos: null },
  centre: { pos: [800, 700] },
  north: { pos: [1000, 450] },
  east: { pos: [1150, 700] },
  across: { pos: [1150, 700], path: 'across' },   // walking N-S across the formation's front
  flank: { pos: [1150, 700], path: 'flank' },     // working round the first shield's side
};
// the live run: approach east, hold, flank north, cross behind, retreat
export const LIVE_SEG = [[0, 120, ''], [120, 250, 'D'], [250, 400, ''], [400, 500, 'W'], [500, 620, 'D'], [620, 760, 'S'], [760, 880, 'A'],
  [880, 1000, ''], [1000, 1120, 'D'], [1120, 1240, 'SD'], [1240, 1380, 'A'], [1380, 1500, 'W'], [1500, 1640, ''], [1640, 1760, 'D'],
  [1760, 1900, 'A'], [1900, 2040, 'S'], [2040, 2160, 'D'], [2160, 99999, '']];

const ms = (t) => (t == null ? '' : Math.round(t * 1000 / 60));
const mean = (a) => { const b = a.filter((x) => x != null && x !== ''); return b.length ? Math.round(b.reduce((s, x) => s + +x, 0) / b.length) : ''; };
const median = (a) => { const b = a.filter((x) => x != null && x !== '').map(Number).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : ''; };

// ── page-side: a staged run with a per-tick row for the first actor ──────
export async function installRig(page) {
  await installStaged(page);
  await page.evaluate(() => {
    const gs = window.__gs, A = window.__aud;
    // intervention = the candidate stood an arm down or armed a pinned check
    window.__interv = () => A.recs.some((q) => { const l = q.e._bulwarkStuck?.log; return l && (l.stoodF1 + l.stoodHold + l.armedPinned) > 0; });
    window.__bsStaged = async (sc) => {
      await window.__audSetup(sc);
      const P = gs.player, rows = [];
      let interv = null;
      for (let i = 0; i < sc.ticks; i++) {
        window.__audStep();
        const r = A.recs[0], e = r?.e;
        rows.push(e?.active ? [+e.x.toFixed(1), +e.y.toFixed(1), r.pbr | 0, e.body.blocked.none ? 0 : 1, Math.round(Math.hypot(P.x - e.x, P.y - e.y)), +e.body.velocity.x.toFixed(1), +e.body.velocity.y.toFixed(1), Math.round(P.x), Math.round(P.y)] : null);
        if (interv == null && window.__interv()) interv = i;
      }
      const logs = A.recs.map((q) => (q.e._bulwarkStuck ? { ...q.e._bulwarkStuck.log } : null));
      const meta = A.recs.map((q) => ({ speed: q.e.cfg.speed, radius: q.e.body.halfWidth, installed: !!q.e._bulwarkStuck }));
      return { ...window.__audCollect(), logs, meta, rows, interv };
    };
  });
}

// ── page-side: the VANGUARD opening, one fresh page per run ─────────────
export async function frontRun(page, { seed, pos, path, ticks = 720, fire = 10 }) {
  return page.evaluate(async ({ seed, pos, path, ticks, fire }) => {
    window.__headless = true;
    const gs = window.__gs, P = gs.player, A = window.__aud;
    const { EnemyShielded } = await window.__mod(/entities\/Enemy\.js/);
    let released = null, blocks = 0, blocksPre = 0, hits = 0, hitsPre = 0;
    // counting wrappers: they call straight through
    const ob = EnemyShielded.prototype.onBlock;
    EnemyShielded.prototype.onBlock = function (c) { blocks++; if (released == null) blocksPre++; return ob.call(this, c); };
    const pd = P.damage;
    P.damage = function (...a) { hits++; if (released == null) hitsPre++; return pd.apply(this, a); };
    window.__seed(seed); window.__draws = 0; A.tick = 0;
    const covers = gs.losRects.map((R) => [R.x, R.y, R.width, R.height]);
    const nearCover = (e) => covers.some(([x, y, w, h]) => Math.hypot(Math.max(x - e.x, 0, e.x - x - w), Math.max(y - e.y, 0, e.y - y - h)) < (e.body.halfWidth || 24) + 6);
    const place = (x, y) => { P.setPosition(x, y); P.body.reset(x, y); };
    const B = gs.roomSpec.bounds;
    if (pos) place(pos[0], pos[1]);
    const op = [0, 1].map(() => ({ born: null, est: null, hold: null, died: null, coverT: 0, hitT: 0, iso: 0, minD: 1e9 }));
    const out = { release: null, why: null, at: [null, null] };
    const recOf = (e) => A.recs.find((r) => r.e === e);
    for (let i = 0; i < ticks; i++) {
      const f = gs._vanguardFront;
      if (path === 'across') place(pos[0], pos[1] + 200 * Math.sin(2 * Math.PI * i / 240));
      else if (path === 'flank') {
        const s = f?.pair[0];
        if (s?.alive && s.active) {
          const fa = s._shieldFacing;
          const c = [1, -1].map((k) => [s.x + Math.cos(fa + k * Math.PI / 2) * 220, s.y + Math.sin(fa + k * Math.PI / 2) * 220]);
          let [tx, ty] = Math.hypot(c[0][0] - P.x, c[0][1] - P.y) <= Math.hypot(c[1][0] - P.x, c[1][1] - P.y) ? c[0] : c[1];
          tx = Math.min(B.w - 80, Math.max(80, tx)); ty = Math.min(B.h - 80, Math.max(80, ty));
          const d = Math.hypot(tx - P.x, ty - P.y), st = Math.min(5, d);   // 300px/s
          place(P.x + (d ? (tx - P.x) / d * st : 0), P.y + (d ? (ty - P.y) / d * st : 0));
        } else place(P.x, P.y);
      } else if (pos) place(pos[0], pos[1]);
      if (fire && i >= 30 && i % fire === 0) P.keyboardFire();
      window.__adv(1);
      if (!f) continue;
      f.pair.forEach((e, k) => {
        if (!e) return;
        const o = op[k];
        if (o.born == null) o.born = i;
        if (!e.alive || !e.active) { if (o.died == null) o.died = i; return; }
        const d = Math.hypot(e.x - P.x, e.y - P.y);
        o.minD = Math.min(o.minD, d);
        if (o.est == null && d <= 200) o.est = i;
        if (o.hold == null && d <= 140) o.hold = i;
        if (!f.released) { const hit = !e.body.blocked.none; if (hit) o.hitT++; if (hit && nearCover(e)) o.coverT++; }
      });
      if (!f.released) {
        const near = f.pair.map((e) => !!(e?.alive && e.active && Math.hypot(e.x - P.x, e.y - P.y) <= 200));
        if (near[0] && !near[1]) op[0].iso++;
        if (near[1] && !near[0]) op[1].iso++;
      }
      if (f.released && out.release == null) {
        out.release = i; out.why = f.why; released = i;
        out.sinceSecond = Math.round(f.sinceSecondMs); out.holdMs = Math.round(f.holdMs);
        out.at = f.pair.map((e) => {
          if (!e) return null;
          const r = recOf(e);
          return { x: Math.round(e.x), y: Math.round(e.y), d: Math.round(Math.hypot(e.x - P.x, e.y - P.y)), alive: !!(e.alive && e.active),
            pinned: !e.body.blocked.none && nearCover(e), los: e.alive ? e._hasLOS(e.x, e.y, P.x, P.y) : null,
            side: r?.sideTicks ?? 0, shots: r?.shots ?? 0,
            F1: r ? r.checks.filter((c) => c.cls === 'F1' && c.cons > 0).length : 0, HOLD: r ? r.checks.filter((c) => c.cls === 'HOLD' && c.cons > 0).length : 0 };
        });
        const [a, b] = f.pair;
        if (a?.alive && b?.alive) {
          const ang = Math.atan2(a.y - P.y, a.x - P.x) - Math.atan2(b.y - P.y, b.x - P.x);
          out.spread = Math.round(Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) * 180 / Math.PI);
          out.gap = Math.round(Math.hypot(a.x - b.x, a.y - b.y));
        }
        out.playerAt = [Math.round(P.x), Math.round(P.y)];
      }
    }
    const pair = gs._vanguardFront?.pair || [];
    const others = A.recs.filter((r) => !pair.includes(r.e));
    out.backlineAt = others.filter((r) => r.type !== 'captain').map((r) => r.born).sort((x, y) => x - y)[0] ?? null;
    out.captainAt = A.recs.find((r) => r.type === 'captain')?.born ?? null;
    out.op = op.map((o, k) => {
      const e = pair[k], r = e && recOf(e);
      return { ...o, minD: Math.round(o.minD), sideTotal: r?.sideTicks ?? 0, log: e?._bulwarkStuck ? { ...e._bulwarkStuck.log } : null };
    });
    out.bulwarkShots = A.recs.filter((r) => r.type === 'shielded').reduce((s, r) => s + r.shots, 0);
    out.blocks = blocks; out.blocksPre = blocksPre; out.hits = hits; out.hitsPre = hitsPre;
    out.spawned = A.recs.length; out.killed = A.recs.filter((r) => !(r.e.alive && r.e.active)).length;
    out.draws = window.__draws;
    out.queued = gs._waveSpawned;
    return out;
  }, { seed, pos, path, ticks, fire });
}

// ── page-side: a live encounter (real spawner, scripted player) ─────────
export async function liveRun(page, { seed, ticks = 2400, seg = LIVE_SEG, fire = 7, superAt = [900, 1700], trace = true }) {
  return page.evaluate(async ({ seed, ticks, seg, fire, superAt, trace }) => {
    window.__headless = true;
    const gs = window.__gs, P = gs.player, A = window.__aud;
    const { EnemyShielded } = await window.__mod(/entities\/Enemy\.js/);
    let blocks = 0, hits = 0, cleared = null;
    const ob = EnemyShielded.prototype.onBlock;
    EnemyShielded.prototype.onBlock = function (c) { blocks++; return ob.call(this, c); };
    const pd = P.damage;
    P.damage = function (...a) { hits++; return pd.apply(this, a); };
    gs.events.on('room-cleared', () => { if (cleared == null) cleared = A.tick; });
    window.__seed(seed); window.__draws = 0; A.tick = 0; A.trace.length = 0;
    const tr = [];
    let interv = null, front = null;
    for (let i = 0; i < ticks; i++) {
      const cur = seg.find(([a, b]) => i >= a && i < b)[2], K = gs.keys;
      K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
      if (fire && i >= 60 && i % fire === 0) P.keyboardFire();
      if (superAt.includes(i)) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
      window.__adv(1);
      if (trace) tr.push([A.hash(), window.__draws]);
      if (interv == null && window.__interv?.()) interv = i;
      const f = gs._vanguardFront;
      if (f && !front && f.released) front = { tick: i, why: f.why };
    }
    const K = gs.keys; K.A.isDown = K.D.isDown = K.W.isDown = K.S.isDown = false;
    const by = {};
    for (const r of A.recs) {
      const k = r.nem ? `nemesis-${r.type}` : r.type === 'captain' ? 'captain' : r.type + (r.type === 'shielded' ? (r.screen ? '-screen' : '-free') : '') + (r.elite ? '-E' : '');
      const b = (by[k] ||= { spawns: 0, F1: 0, F1taken: 0, HOLD: 0, HOLDtaken: 0, BLOCK: 0, BLOCKtaken: 0, OTHER: 0, OTHERtaken: 0, sideTicks: 0, sideLat: 0, otherLat: 0, turns: 0, turnsSide: 0, shots: 0, contact: 0, stoodF1: 0, stoodHold: 0, keptPinned: 0, armedPinned: 0, installed: 0 });
      b.spawns++;
      for (const c of r.checks) if (c.armed) { const g = { F: 'F1', H: 'HOLD', B: 'BLOCK', O: 'OTHER' }[c.cls[0]]; b[g]++; if (c.cons > 0) b[g + 'taken']++; }
      b.sideTicks += r.sideTicks; b.sideLat += r.sideLat; b.otherLat += r.otherLat; b.turns += r.turns; b.turnsSide += r.turnsSide; b.shots += r.shots; b.contact += r.contactTicks;
      const l = r.e._bulwarkStuck?.log;
      if (l) { b.installed++; b.stoodF1 += l.stoodF1; b.stoodHold += l.stoodHold; b.keptPinned += l.keptPinned; b.armedPinned += l.armedPinned; }
    }
    return { by, blocks, hits, cleared, interv, front, draws: window.__draws, spawned: A.recs.length, killed: A.recs.filter((r) => !(r.e.alive && r.e.active)).length, trace: trace ? tr : null };
  }, { seed, ticks, seg, fire, superAt, trace });
}

// ── node-side: obstacle / lane metrics from a staged run's rows ──────────
export function laneMetrics(res, engageR) {
  const r = res.recs[0], rows = res.rows, log = res.logs[0] || {};
  const live = rows.map((w, i) => (w ? { i, x: w[0], y: w[1], br: w[2], hit: w[3], d: w[4], vx: w[5], vy: w[6], px: w[7], py: w[8] } : null)).filter(Boolean);
  const fc = live.find((w) => w.hit)?.i ?? null;
  const lc = [...live].reverse().find((w) => w.hit)?.i ?? null;
  const side = live.filter((w) => w.br === 2);
  const episodes = [];
  for (let k = 0; k < live.length; k++) if (live[k].br === 2 && (k === 0 || live[k - 1].br !== 2)) episodes.push(live[k].i);
  const inContactAt = (i) => live.some((w) => w.i <= i && w.i >= i - 3 && w.hit);
  const afterC = fc == null ? [] : episodes.filter((i) => i >= fc);
  const end = live[live.length - 1];
  const engaged = r.engage != null;
  return {
    engageMs: ms(r.engage), firstContactMs: ms(fc), lastContactMs: ms(lc), contactMs: ms(live.filter((w) => w.hit).length),
    firstSideMs: ms(side[0]?.i), sideMs: ms(side.length), sideLatPx: r.sideLat,
    falseSideMs: ms(side.filter((w) => fc == null || w.i < fc).length),
    activationDelayMs: fc == null || afterC[0] == null ? '' : ms(afterC[0] - fc),
    episodes: episodes.length, episodesAfterContact: afterC.length, episodesInContact: episodes.filter(inContactAt).length,
    escapeMs: fc == null ? '' : ms(lc - fc),
    success: +engaged, pinnedEnd: +(!engaged && live.slice(-60).some((w) => w.hit)),
    F1armed: r.checks.filter((c) => c.cls === 'F1').length, F1taken: r.checks.filter((c) => c.cls === 'F1' && c.cons > 0).length,
    HOLDarmed: r.checks.filter((c) => c.cls === 'HOLD' || c.cls === 'H1').length, HOLDtaken: r.checks.filter((c) => (c.cls === 'HOLD' || c.cls === 'H1') && c.cons > 0).length,
    BLOCKarmed: r.checks.filter((c) => c.cls === 'BLOCK' || c.cls === 'B1').length, BLOCKtaken: r.checks.filter((c) => (c.cls === 'BLOCK' || c.cls === 'B1') && c.cons > 0).length,
    stoodF1: log.stoodF1 ?? '', stoodHold: log.stoodHold ?? '', keptPinned: log.keptPinned ?? '', armedPinned: log.armedPinned ?? '',
    turns: r.turns, turnsSide: r.turnsSide, path: r.path, shots: r.shots, endX: end?.x ?? '', endY: end?.y ?? '', draws: res.draws,
    engageR,
  };
}
// hold -> resume: heading error over the first 10 moving ticks after each restart
export function resumeMetrics(res) {
  const live = res.rows.map((w, i) => (w ? { i, x: w[0], y: w[1], br: w[2], vx: w[5], vy: w[6], px: w[7], py: w[8] } : null)).filter(Boolean);
  const errs = [];
  for (let k = 1; k < live.length; k++) {
    const sp = Math.hypot(live[k].vx, live[k].vy), sp0 = Math.hypot(live[k - 1].vx, live[k - 1].vy);
    if (sp > 20 && sp0 <= 20 && live[k].i > 60) {
      const seg = live.slice(k, k + 10).filter((w) => Math.hypot(w.vx, w.vy) > 20);
      const e = Math.max(...seg.map((w) => { const a = Math.atan2(w.vy, w.vx) - Math.atan2(w.py - w.y, w.px - w.x); return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) * 180 / Math.PI; }));
      errs.push(Math.round(e));
    }
  }
  return { resumes: errs.length, resumeErrMax: errs.length ? Math.max(...errs) : '', resumeErrFirst: errs[0] ?? '', resumesOver45: errs.filter((e) => e > 45).length };
}

const firstDiff = (a, b, k) => { const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) if (a[i][k] !== b[i][k]) return i; return a.length === b.length ? -1 : n; };
// '' for the baseline row itself, 'none' when the candidate never parts from it
const diverge = (a, b, k) => { const d = firstDiff(a, b, k); return d < 0 ? 'none' : ms(d); };

// ════════════════════════════════════════════════════════════════════════
if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--merge')) {
  const parse = (t) => { const [h, ...ls] = t.trim().split('\n'); const cols = h.split(','); return ls.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v]))); };
  const rows = ['staged', 'front', 'live', 'iso', 'perf'].filter((t) => existsSync(`${OUT}bulwark-stuck-metrics-${t}.csv`))
    .flatMap((t) => parse(readFileSync(`${OUT}bulwark-stuck-metrics-${t}.csv`, 'utf8')));
  const cols = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  writeFileSync(`${OUT}bulwark-stuck-candidate-metrics.csv`, [cols.join(','), ...rows.map((r) => cols.map((k) => r[k] ?? '').join(','))].join('\n') + '\n');
  console.log(`merged ${rows.length} rows, ${cols.length} columns`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ONLY = opt('only', 'staged,front,live,iso,perf').split(',');
  const SEEDS = Array.from({ length: +opt('seeds', '8') }, (_, i) => 1001 + i * 7919);
  const FSEEDS = SEEDS.slice(0, +opt('fseeds', '6'));
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const t0 = Date.now();
  const save = (tag, rows) => {
    const cols = [];
    for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
    writeFileSync(`${OUT}bulwark-stuck-metrics-${tag}.csv`, [cols.join(','), ...rows.map((r) => cols.map((k) => String(r[k] ?? '').replace(/,/g, ';')).join(','))].join('\n') + '\n');
    console.log(`  wrote ${tag}: ${rows.length} rows (${Math.round((Date.now() - t0) / 1000)}s)`);
  };
  const rigPage = async (flags, q) => {
    const p = await bootPage(browser, { flags, ...(q ? { q } : {}) });
    await installAudit(p, 'A');
    await installRig(p);
    await p.evaluate(() => { window.__headless = true; });
    return p;
  };

  // ── STAGED ─────────────────────────────────────────────────────────────
  if (ONLY.includes('staged')) {
    console.log('── STAGED (clear lane, hold -> resume, obstacles)');
    const rows = [];
    const pages = {};
    for (const [m, flags] of MODES) pages[m] = await rigPage(flags);
    const jobs = [];
    for (const [rk, role] of Object.entries(ROLES)) for (const seed of SEEDS) {
      jobs.push({ scn: 'clear', rk, seed, sc: { seed, ticks: 480, actors: [{ ...role, x: 800, y: 250, at: 0 }], player: { path: 'stand', x: 800, y: 1150 }, trace: true } });
      jobs.push({ scn: 'hold-resume', rk, seed, sc: { seed, ticks: 720, actors: [{ ...role, x: 800, y: 200, at: 0 }], player: { path: 'away', x: 800, y: 650 }, trace: true } });
    }
    for (const [ok, ob] of Object.entries(OBSTACLES)) {
      const roles = ob.roles || ['free-R', 'free-E', 'screen-R'];
      for (const rk of roles) for (const seed of SEEDS) {
        const sc = ob.away
          ? { seed, ticks: 720, actors: [{ ...ROLES[rk], x: 800, y: 200, at: 0 }], player: { path: 'away', x: 800, y: 650 }, wall: ob.wall, trace: true }
          : { seed, ticks: 720, actors: [{ ...ROLES[rk], x: ob.ax ?? 800, y: 250, at: 0 }], player: { path: 'stand', x: 800, y: 1150 }, wall: ob.wall, trace: true };
        jobs.push({ scn: `obstacle-${ok}`, rk, seed, sc });
      }
    }
    for (const j of jobs) {
      const res = {};
      for (const [m] of MODES) res[m] = await pages[m].evaluate((sc) => window.__bsStaged(sc), j.sc);
      for (const [m] of MODES) {
        const r = res[m];
        const engageR = r.recs[0]?.engageR;
        const base = res.baseline;
        rows.push({ section: 'staged', scenario: j.scn, role: j.rk, mode: m, seed: j.seed, installed: +!!r.meta[0]?.installed,
          speed: r.meta[0]?.speed, radius: r.meta[0]?.radius,
          ...laneMetrics(r, engageR), ...(j.scn.includes('hold') || j.sc.player.path === 'away' ? resumeMetrics(r) : {}),
          interveneMs: ms(r.interv), posDivergeMs: m === 'baseline' ? '' : diverge(r.trace, base.trace, 0), drawDivergeMs: m === 'baseline' ? '' : diverge(r.trace, base.trace, 1) });
      }
    }
    for (const p of Object.values(pages)) await p.close();
    // summaries: numerators and denominators per scenario x role x mode
    const groups = new Map();
    for (const r of rows) { const k = `${r.scenario}|${r.role}|${r.mode}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    for (const [k, g] of groups) {
      const [scenario, role, mode] = k.split('|');
      rows.push({ section: 'staged-summary', scenario, role, mode, seed: 'all', runs: g.length,
        success_n: g.filter((r) => r.success === 1).length, pinnedEnd_n: g.filter((r) => r.pinnedEnd === 1).length,
        F1taken_n: g.reduce((s, r) => s + r.F1taken, 0), HOLDtaken_n: g.reduce((s, r) => s + r.HOLDtaken, 0), HOLDarmed_n: g.reduce((s, r) => s + r.HOLDarmed, 0),
        engageMs: mean(g.map((r) => r.engageMs)), engageMsMedian: median(g.map((r) => r.engageMs)), sideMs: mean(g.map((r) => r.sideMs)), falseSideMs: mean(g.map((r) => r.falseSideMs)),
        firstContactMs: mean(g.map((r) => r.firstContactMs)), activationDelayMs: mean(g.map((r) => r.activationDelayMs)), escapeMs: mean(g.map((r) => r.escapeMs)),
        episodes: mean(g.map((r) => r.episodes)), episodesInContact_n: g.reduce((s, r) => s + r.episodesInContact, 0), episodes_n: g.reduce((s, r) => s + r.episodes, 0),
        resumes_n: g.reduce((s, r) => s + (r.resumes || 0), 0), resumesOver45_n: g.reduce((s, r) => s + (r.resumesOver45 || 0), 0), resumeErrMax: g.some((r) => r.resumeErrMax !== undefined && r.resumeErrMax !== '') ? Math.max(...g.map((r) => +r.resumeErrMax || 0)) : '' });
    }
    save('staged', rows);
  }

  // ── FRONT ──────────────────────────────────────────────────────────────
  if (ONLY.includes('front')) {
    console.log('── VANGUARD FRONT');
    const rows = [];
    const POSF = opt('pos', Object.keys(FRONT_POS).join(',')).split(',');
    for (const champ of [false, true]) for (const [pk, P] of Object.entries(FRONT_POS).filter(([k]) => POSF.includes(k))) {
      for (const seed of FSEEDS) {
        const res = await Promise.all(MODES.map(async ([m, flags]) => {
          const p = await bootPage(browser, { flags, q: VANGUARD_Q(champ), seed });
          await installAudit(p, 'A');
          await installRig(p);
          const r = await frontRun(p, { seed, pos: P.pos, path: P.path });
          await p.close();
          return [m, r];
        }));
        for (const [m, r] of res) {
          const [a, b] = r.at;
          rows.push({ section: 'front', scenario: `front-${pk}${champ ? '-captain' : ''}`, role: 'openers', mode: m, seed, player: pk, captain: +champ,
            why: r.why || 'holding', releaseMs: ms(r.release), sinceSecondMs: r.sinceSecond ?? '', holdMs: r.holdMs ?? '',
            open0BornMs: ms(r.op[0].born), open1BornMs: ms(r.op[1].born),
            est0Ms: ms(r.op[0].est), est1Ms: ms(r.op[1].est), hold0Ms: ms(r.op[0].hold), hold1Ms: ms(r.op[1].hold),
            rel0: a ? `${a.x}:${a.y}` : '', rel1: b ? `${b.x}:${b.y}` : '', relPlayer: r.playerAt ? r.playerAt.join(':') : '',
            rel0d: a?.d ?? '', rel1d: b?.d ?? '', gapPx: r.gap ?? '', spreadDeg: r.spread ?? '',
            rel0pinned: a ? +a.pinned : '', rel1pinned: b ? +b.pinned : '', rel0los: a?.los == null ? '' : +a.los, rel1los: b?.los == null ? '' : +b.los,
            cover0Ms: ms(r.op[0].coverT), cover1Ms: ms(r.op[1].coverT), contact0Ms: ms(r.op[0].hitT), contact1Ms: ms(r.op[1].hitT),
            iso0Ms: ms(r.op[0].iso), iso1Ms: ms(r.op[1].iso),
            side0PreMs: a ? ms(a.side) : '', side1PreMs: b ? ms(b.side) : '', side0Ms: ms(r.op[0].sideTotal), side1Ms: ms(r.op[1].sideTotal),
            F1takenPre: (a?.F1 || 0) + (b?.F1 || 0), HOLDtakenPre: (a?.HOLD || 0) + (b?.HOLD || 0),
            stoodF1: (r.op[0].log?.stoodF1 || 0) + (r.op[1].log?.stoodF1 || 0), stoodHold: (r.op[0].log?.stoodHold || 0) + (r.op[1].log?.stoodHold || 0),
            keptPinned: (r.op[0].log?.keptPinned || 0) + (r.op[1].log?.keptPinned || 0), armedPinned: (r.op[0].log?.armedPinned || 0) + (r.op[1].log?.armedPinned || 0),
            backlineMs: ms(r.backlineAt), captainMs: ms(r.captainAt), pairShotsPre: (a?.shots || 0) + (b?.shots || 0), bulwarkShots: r.bulwarkShots,
            blocksPre: r.blocksPre, blocks: r.blocks, hitsPre: r.hitsPre, hits: r.hits, spawned: r.spawned, killed: r.killed, draws: r.draws });
        }
      }
      console.log(`  front ${pk}${champ ? ' +captain' : ''} (${Math.round((Date.now() - t0) / 1000)}s)`);
    }
    const groups = new Map();
    for (const r of rows) { const k = `${r.scenario}|${r.mode}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    for (const [k, g] of groups) {
      const [scenario, mode] = k.split('|');
      rows.push({ section: 'front-summary', scenario, role: 'openers', mode, seed: 'all', runs: g.length,
        established_n: g.filter((r) => r.why === 'established').length, timeout_n: g.filter((r) => r.why === 'timeout').length,
        breach_n: g.filter((r) => r.why === 'breach').length, stall_n: g.filter((r) => r.why === 'stall').length,
        releaseMs: mean(g.map((r) => r.releaseMs)), sinceSecondMs: mean(g.map((r) => r.sinceSecondMs)),
        gapPx: mean(g.map((r) => r.gapPx)), spreadDeg: mean(g.map((r) => r.spreadDeg)),
        pinnedAtRelease_n: g.reduce((s, r) => s + (+r.rel0pinned || 0) + (+r.rel1pinned || 0), 0), noLosAtRelease_n: g.reduce((s, r) => s + (r.rel0los === 0 ? 1 : 0) + (r.rel1los === 0 ? 1 : 0), 0),
        coverMs: mean(g.map((r) => (+r.cover0Ms || 0) + (+r.cover1Ms || 0))), isoMs: mean(g.map((r) => (+r.iso0Ms || 0) + (+r.iso1Ms || 0))), iso0Ms: mean(g.map((r) => r.iso0Ms)),
        sidePreMs: mean(g.map((r) => (+r.side0PreMs || 0) + (+r.side1PreMs || 0))), F1takenPre_n: g.reduce((s, r) => s + r.F1takenPre, 0), HOLDtakenPre_n: g.reduce((s, r) => s + r.HOLDtakenPre, 0),
        backlineMs: mean(g.map((r) => r.backlineMs)), captainMs: mean(g.map((r) => r.captainMs)),
        pairShotsPre: mean(g.map((r) => r.pairShotsPre)), blocksPre: mean(g.map((r) => r.blocksPre)), hitsPre: mean(g.map((r) => r.hitsPre)), hits: mean(g.map((r) => r.hits)) });
    }
    save('front', rows);
  }

  // ── LIVE ───────────────────────────────────────────────────────────────
  if (ONLY.includes('live')) {
    console.log('── LIVE VANGUARD');
    const rows = [];
    for (const champ of [false, true]) for (const seed of FSEEDS) {
      const res = await Promise.all(MODES.map(async ([m, flags]) => {
        const p = await bootPage(browser, { flags, q: VANGUARD_Q(champ), seed });
        await installAudit(p, 'A');
        await installRig(p);
        const r = await liveRun(p, { seed });
        await p.close();
        return [m, r];
      }));
      const base = res.find(([m]) => m === 'baseline')[1];
      for (const [m, r] of res) {
        const common = { section: 'live', scenario: `live-vanguard${champ ? '-captain' : ''}`, mode: m, seed, captain: +champ,
          front: r.front ? `${r.front.why}@${ms(r.front.tick)}` : 'none', clearedMs: ms(r.cleared), spawned: r.spawned, killed: r.killed,
          blocks: r.blocks, hits: r.hits, draws: r.draws, interveneMs: ms(r.interv),
          posDivergeMs: m === 'baseline' ? '' : diverge(r.trace, base.trace, 0), drawDivergeMs: m === 'baseline' ? '' : diverge(r.trace, base.trace, 1) };
        for (const [role, b] of Object.entries(r.by)) {
          rows.push({ ...common, role, spawns: b.spawns, installed: b.installed, F1: b.F1, F1taken: b.F1taken, HOLD: b.HOLD, HOLDtaken: b.HOLDtaken, BLOCK: b.BLOCK, BLOCKtaken: b.BLOCKtaken, OTHER: b.OTHER, OTHERtaken: b.OTHERtaken,
            sideMs: ms(b.sideTicks), sideLatPx: Math.round(b.sideLat), otherLatPx: Math.round(b.otherLat), turns: b.turns, turnsSide: b.turnsSide, shots: b.shots, contactMs: ms(b.contact),
            stoodF1: b.stoodF1, stoodHold: b.stoodHold, keptPinned: b.keptPinned, armedPinned: b.armedPinned });
        }
      }
      console.log(`  live ${champ ? '+captain' : ''} seed ${seed} (${Math.round((Date.now() - t0) / 1000)}s)`);
    }
    save('live', rows);
  }

  // ── ISOLATION: encounters with no Bulwark ──────────────────────────────
  if (ONLY.includes('iso')) {
    console.log('── ISOLATION');
    const rows = [];
    const ENC = [['crossfire', 'encdbg=crossfire&room=corridor&sector=14&wave=2'], ['sniperNest', 'encdbg=sniperNest&room=detention&sector=8&wave=2'],
      ['swarmTide', 'encdbg=swarmTide&room=hangar&sector=8&wave=2'], ['bomberRun', 'encdbg=bomberRun&room=hangar&sector=8&wave=2']];
    for (const [enc, q] of ENC) for (const seed of SEEDS.slice(0, 3)) {
      const res = await Promise.all(MODES.map(async ([m, flags]) => {
        const p = await bootPage(browser, { flags, q, seed });
        await installAudit(p, 'A');
        await installRig(p);
        const r = await liveRun(p, { seed, ticks: 1800 });
        await p.close();
        return [m, r];
      }));
      const base = res.find(([m]) => m === 'baseline')[1];
      for (const [m, r] of res) {
        const shields = Object.entries(r.by).filter(([k]) => k.startsWith('shielded')).reduce((s, [, b]) => s + b.spawns, 0);
        rows.push({ section: 'iso', scenario: `iso-${enc}`, role: 'all', mode: m, seed, bulwarks: shields, spawned: r.spawned, draws: r.draws, interveneMs: ms(r.interv),
          posDivergeMs: m === 'baseline' ? '' : diverge(r.trace, base.trace, 0), drawDivergeMs: m === 'baseline' ? '' : diverge(r.trace, base.trace, 1),
          identical: m === 'baseline' ? '' : +(firstDiff(r.trace, base.trace, 0) === -1 && firstDiff(r.trace, base.trace, 1) === -1) });
      }
      console.log(`  iso ${enc} seed ${seed}`);
    }
    save('iso', rows);
  }

  // ── PERF ───────────────────────────────────────────────────────────────
  if (ONLY.includes('perf')) {
    console.log('── PERF');
    const rows = [];
    const sc = { seed: 77, ticks: 0, player: { path: 'lat', x: 800, y: 1150 }, actors: Array.from({ length: 12 }, (_, k) => ({ ...(k % 2 ? ROLES['free-R'] : ROLES['screen-R']), x: 200 + (k % 6) * 240, y: 200 + Math.floor(k / 6) * 160, at: 0 })) };
    for (const [m, flags] of MODES) {
      const p = await rigPage(flags);
      const runs = [];
      for (let rep = 0; rep < 5; rep++) {
        runs.push(await p.evaluate(async (sc) => {
          await window.__audSetup(sc);
          const t = [];
          for (let i = 0; i < 600; i++) { const a = performance.now(); window.__audStep(); t.push(performance.now() - a); }
          window.__audCollect();
          t.sort((x, y) => x - y);
          return { mean: t.reduce((s, x) => s + x, 0) / t.length, p50: t[t.length >> 1], p95: t[Math.floor(t.length * 0.95)] };
        }, sc));
      }
      await p.close();
      runs.sort((x, y) => x.mean - y.mean);
      const r = runs[2];
      rows.push({ section: 'perf', scenario: 'perf-12-bulwarks', role: 'shielded x12', mode: m, seed: 77, runs: 5, msPerTickMean: r.mean.toFixed(3), msPerTickP50: r.p50.toFixed(3), msPerTickP95: r.p95.toFixed(3) });
    }
    save('perf', rows);
  }
  await browser.close();
  console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`);
}
