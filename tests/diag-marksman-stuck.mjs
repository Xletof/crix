// DIAGNOSTIC — PHASE 3C: THE ORDINARY MARKSMAN'S STUCK RECOVERY.
// Prints numbers and writes `docs/evidence/marksman-stuck-v3c/`; asserts nothing
// (`tests/smoke-marksman-stuck.mjs` asserts). Every mode is the REAL URL flag:
//
//   baseline  no flag (the frozen game)
//   A         ?marksmanStuck=prog
//
// The Phase 3A instrument (`diag-stuck-audit.mjs`, observe-only 'A') records
// each base check and which branch `_moveToward` took. On top of it this rig
// records, per tick, the branch the SNIPER'S OWN TICK chose (approach beyond
// desiredRange + 80, retreat inside retreatRange, hold between — the same
// formula `EnemySniper._tickSwarm` uses, read before it runs) and the whole
// charge state (`_charging`, `_chargeMs`, `_lockAngle`, `fireCd`, LOS, shots).
//
// usage: node tests/diag-marksman-stuck.mjs [--only=diag,staged,charge,obstacle,enc,iso,perf]
//        [--seeds=6] [--out=DIR]      node tests/diag-marksman-stuck.mjs --merge
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { CHROME, bootPage, installAudit, installStaged } from './diag-stuck-audit.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const OUT = opt('out', new URL('../docs/evidence/marksman-stuck-v3c/', import.meta.url).pathname);
export const MODES = [['baseline', ''], ['A', 'marksmanStuck=prog']];
export const MK = { type: 'sniper' };
export const MKE = { type: 'sniper', elite: true };

// ── page side ──────────────────────────────────────────────────────────────
export async function installMkRig(page) {
  await installStaged(page);
  await page.evaluate(() => {
    const gs = window.__gs, A = window.__aud, P = gs.player;
    const shots = [];
    gs.events.on('shooter-fire', (e, ang) => { if (e.enemyType === 'sniper') shots.push({ e, ang, tick: A.tick }); });
    // observe the branch the sniper's own tick chose: the class's formula, read
    // before the tick runs (instrument only — calls straight through)
    const watch = (e) => {
      if (e.__mkWatched) return; e.__mkWatched = true;
      const t = e._tickSwarm;
      e._tickSwarm = function (delta, player) {
        const d = Math.hypot(player.x - this.x, player.y - this.y);
        this.__mkBranch = d < this.cfg.retreatRange ? 'R' : d > this.cfg.desiredRange + 80 ? 'A' : 'H';
        this.__mkTicked = true;
        return t.call(this, delta, player);
      };
    };
    const interp = (kf, i) => {
      let a = kf[0], b = kf[kf.length - 1];
      for (let k = 0; k < kf.length - 1; k++) if (i >= kf[k][0] && i <= kf[k + 1][0]) { a = kf[k]; b = kf[k + 1]; break; }
      if (i >= kf[kf.length - 1][0]) return [b[1], b[2]];
      const u = b[0] === a[0] ? 1 : (i - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    };
    window.__mkSetup = async (sc) => {
      const kf = sc.player;
      await window.__audSetup({ seed: sc.seed, ticks: sc.ticks, actors: sc.actors, wall: sc.wall, trace: sc.trace, player: { path: 'stand', x: kf[0][1], y: kf[0][2] } });
      shots.length = 0;
      window.__mkI = 0; window.__mkKf = kf; window.__mkRows = []; window.__mkSc = sc;
    };
    window.__mkStep = () => {
      const i = window.__mkI++;
      const [px, py] = interp(window.__mkKf, i);
      P.setPosition(px, py); P.body.reset(px, py);
      for (const r of A.recs) if (r.e.enemyType === 'sniper') { watch(r.e); r.e.__mkTicked = false; }
      window.__audStep();
      for (const r of A.recs) if (r.e.enemyType === 'sniper' && !r.e.__mkWatched) watch(r.e);   // spawned this tick
      const r = A.recs.find((q) => q.e.enemyType === 'sniper'), e = r?.e;
      if (e?.active && e.alive) {
        // A.tick has already advanced past this step: the step's own events carry A.tick - 1
        const ck = r.checks.length && r.checks[r.checks.length - 1].tick === A.tick - 1 ? r.checks[r.checks.length - 1] : null;
        const shot = shots.find((s) => s.e === e && s.tick === A.tick - 1);
        window.__mkRows.push([i, +e.x.toFixed(2), +e.y.toFixed(2), e.__mkTicked ? e.__mkBranch : '-', r.pbr | 0,
          Math.round(e._stuckSidestepMs || 0), ck ? (ck.armed ? ck.cls : '.') : '', e._charging ? 1 : 0, Math.round(e._chargeMs),
          +(+e._lockAngle).toFixed(5), Math.round(e.fireCd), shot ? +shot.ang.toFixed(5) : '', e.body.blocked.none ? 0 : 1,
          Math.round(px), Math.round(py), (e.canSee(P) && e._hasLOS(e.x, e.y, P.x, P.y)) ? 1 : 0]);
      } else window.__mkRows.push(null);
      if (window.__mkSc.trace) window.__mkTrace = A.trace;
    };
    window.__mkCollect = () => {
      const r = A.recs.find((q) => q.e.enemyType === 'sniper');
      const log = r?.e._marksmanStuck ? { ...r.e._marksmanStuck.log } : null;
      const meta = r ? { installed: !!r.e._marksmanStuck, speed: r.e.cfg.speed, radius: r.e.body.halfWidth, elite: !!r.e._elite } : null;
      const out = window.__audCollect();
      return { ...out, rows: window.__mkRows, log, meta, rec: out.recs.find((q) => q.type === 'sniper') || null };
    };
    window.__mkRun = async (sc) => { await window.__mkSetup(sc); for (let i = 0; i < sc.ticks; i++) window.__mkStep(); return window.__mkCollect(); };
  });
}

// rows → named objects
export const ROW = ['i', 'x', 'y', 'branch', 'br', 'side', 'check', 'charging', 'chargeMs', 'lock', 'fireCd', 'shot', 'hit', 'px', 'py', 'los'];
export const rowsOf = (res) => res.rows.map((w) => (w ? Object.fromEntries(ROW.map((k, j) => [k, w[j]])) : null)).filter(Boolean);

// every charge: start, end (fire / cancel), its length, the lock window, the shot angle vs the lock
export function charges(rows) {
  const out = [];
  let cur = null;
  for (let k = 0; k < rows.length; k++) {
    const w = rows[k];
    if (w.charging && !cur) cur = { start: w.i, startLock: w.lock, rows: [] };
    if (cur) cur.rows.push(w);
    if (cur && (!w.charging || w.shot !== '')) {
      const fired = w.shot !== '';
      // the lock window: from the first row at or under lockMs to the shot
      const lockRows = cur.rows.filter((q) => q.charging && q.chargeMs <= 260);
      out.push({ start: cur.start, end: w.i, fired, cancelled: !fired, ticks: w.i - cur.start,
        shotAng: fired ? w.shot : null, lockFirst: lockRows[0]?.lock ?? null,
        lockSteady: lockRows.every((q) => q.lock === lockRows[0]?.lock), lockTicks: lockRows.length,
        sideDuring: cur.rows.filter((q) => q.br === 2).length, sideDuringLock: lockRows.filter((q) => q.br === 2).length,
        cdAfter: fired ? (rows[k + 1]?.fireCd ?? null) : null });
      cur = null;
    }
  }
  return out;
}
// lateral motion (relative to the bearing to the player) split by whether a sidestep was taken
export function lateral(rows) {
  let side = 0, other = 0, sideTicks = 0, path = 0;
  for (let k = 1; k < rows.length; k++) {
    const a = rows[k - 1], b = rows[k];
    const dx = b.x - a.x, dy = b.y - a.y, bx = a.px - a.x, by = a.py - a.y, bd = Math.hypot(bx, by) || 1;
    const lat = Math.abs(dx * (-by / bd) + dy * (bx / bd));
    path += Math.hypot(dx, dy);
    if (b.br === 2) { side += lat; sideTicks++; } else other += lat;
  }
  return { sideLat: Math.round(side), otherLat: Math.round(other), sideTicks, path: Math.round(path) };
}
// heading error over the first moving ticks of each approach that follows a hold
export function resumes(rows) {
  const out = [];
  for (let k = 1; k < rows.length; k++) {
    if (rows[k].branch === 'A' && rows[k - 1].branch === 'H') {
      const seg = rows.slice(k, k + 12);
      const errs = seg.slice(1).map((w, j) => {
        const p = seg[j]; const dx = w.x - p.x, dy = w.y - p.y; if (Math.hypot(dx, dy) < 0.5) return null;
        const a = Math.atan2(dy, dx) - Math.atan2(p.py - p.y, p.px - p.x);
        return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) * 180 / Math.PI;
      }).filter((v) => v != null);
      out.push({ at: rows[k].i, errMax: errs.length ? Math.round(Math.max(...errs)) : null, sideTaken: seg.some((w) => w.br === 2), charging: rows[k].charging });
    }
  }
  return out;
}

const ms = (t) => (t == null || t === '' ? '' : Math.round(t * 1000 / 60));

// ── scenarios (single Marksman, staged empty hangar 1600x1400) ─────────────
// player keyframes: [tick, x, y]
export const SC = {
  // beyond 640: approach at 0.7x speed, first check at 0.6s
  clear: (a, seed) => ({ seed, ticks: 360, actors: [{ ...a, x: 800, y: 150, at: 0 }], player: [[0, 800, 1250]] }),
  // inside the band: hold the whole time
  hold: (a, seed) => ({ seed, ticks: 360, actors: [{ ...a, x: 800, y: 600, at: 0 }], player: [[0, 800, 1100]] }),
  // hold 4s at 450, then the player walks out to 850 (approach), then stands
  holdApproach: (a, seed) => ({ seed, ticks: 600, actors: [{ ...a, x: 800, y: 500, at: 0 }], player: [[0, 800, 950], [240, 800, 950], [300, 800, 1350]] }),
  // approach, then the player closes into the band (approach -> hold)
  approachHold: (a, seed) => ({ seed, ticks: 480, actors: [{ ...a, x: 800, y: 150, at: 0 }], player: [[0, 800, 1300], [120, 800, 1300], [200, 800, 800]] }),
  // hold, then the player closes to 220 (retreat) and stands
  holdRetreat: (a, seed) => ({ seed, ticks: 480, actors: [{ ...a, x: 800, y: 700, at: 0 }], player: [[0, 800, 1200], [180, 800, 1200], [260, 800, 920]] }),
  // retreat until in the band again, then hold (player stands at 260, sniper backs to 300+)
  retreatHold: (a, seed) => ({ seed, ticks: 420, actors: [{ ...a, x: 800, y: 700, at: 0 }], player: [[0, 800, 940]] }),
  // retreat pinned against the north wall, then the player dashes out past 640
  retreatApproach: (a, seed) => ({ seed, ticks: 540, actors: [{ ...a, x: 800, y: 120, at: 0 }], player: [[0, 800, 330], [240, 800, 330], [258, 800, 900]] }),
  // oscillate across the 300 boundary
  osc300: (a, seed) => ({ seed, ticks: 600, actors: [{ ...a, x: 800, y: 500, at: 0 }], player: [[0, 800, 790], [60, 800, 810], [120, 800, 790], [180, 800, 810], [240, 800, 790], [300, 800, 810], [360, 800, 790], [420, 800, 810], [480, 800, 790], [540, 800, 810]] }),
  // oscillate across the 640 boundary
  osc640: (a, seed) => ({ seed, ticks: 600, actors: [{ ...a, x: 800, y: 300, at: 0 }], player: [[0, 800, 920], [60, 800, 960], [120, 800, 920], [180, 800, 960], [240, 800, 920], [300, 800, 960], [360, 800, 920], [420, 800, 960], [480, 800, 920], [540, 800, 960]] }),
  // the player crosses behind the Marksman (north of it), out of and back into range
  crossBehind: (a, seed) => ({ seed, ticks: 600, actors: [{ ...a, x: 800, y: 600, at: 0 }], player: [[0, 300, 1100], [120, 300, 1100], [360, 1300, 150], [600, 1300, 150]] }),
};

const firstDiff = (a, b, k) => { const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) if (a[i][k] !== b[i][k]) return i; return a.length === b.length ? -1 : n; };
const diverge = (a, b, k) => { if (!a || !b) return ''; const d = firstDiff(a, b, k); return d < 0 ? 'none' : ms(d); };

export async function mkPage(browser, flags = '', q) {
  const p = await bootPage(browser, { flags, ...(q ? { q } : {}) });
  await installAudit(p, 'A');
  await installMkRig(p);
  await p.evaluate(() => { window.__headless = true; });
  return p;
}

// one staged run → a CSV row
export function stagedRow(scn, role, mode, seed, res, base) {
  const rows = rowsOf(res);
  const rec = res.rec || {};
  const ch = charges(rows), lat = lateral(rows), rs = resumes(rows);
  const checks = rec.checks || [];
  const armed = (c) => checks.filter((q) => q.armed && q.cls && q.cls.startsWith(c));
  const taken = (c) => armed(c).filter((q) => q.cons > 0).length;
  const branches = rows.reduce((o, w) => { o[w.branch] = (o[w.branch] || 0) + 1; return o; }, {});
  return {
    section: 'staged', scenario: scn, role, mode, seed, installed: +!!res.meta?.installed,
    F1armed: armed('F1').length, F1taken: taken('F1'), HOLDarmed: armed('H').length, HOLDtaken: taken('H'),
    BLOCKarmed: armed('B').length, BLOCKtaken: taken('B'), OTHERarmed: armed('O').length, OTHERtaken: taken('O'),
    stoodF1: res.log?.stoodF1 ?? '', stoodHold: res.log?.stoodHold ?? '', kept: res.log?.kept ?? '',
    sideMs: ms(lat.sideTicks), sideLatPx: lat.sideLat, otherLatPx: lat.otherLat, pathPx: lat.path,
    approachMs: ms(branches.A || 0), holdMs: ms(branches.H || 0), retreatMs: ms(branches.R || 0),
    resumes: rs.length, resumeSide: rs.filter((r) => r.sideTaken).length, resumeErrMax: rs.length ? Math.max(...rs.map((r) => r.errMax ?? 0)) : '',
    charges: ch.length, fired: ch.filter((c) => c.fired).length, cancelled: ch.filter((c) => c.cancelled).length,
    chargeTicks: ch.filter((c) => c.fired).map((c) => c.ticks).join('/'),
    lockSteady: ch.filter((c) => c.fired).every((c) => c.lockSteady) ? 1 : 0,
    shotEqLock: ch.filter((c) => c.fired).every((c) => c.shotAng === c.lockFirst) ? 1 : 0,
    sideDuringCharge: ch.reduce((s, c) => s + c.sideDuring, 0), sideDuringLock: ch.reduce((s, c) => s + c.sideDuringLock, 0),
    contactMs: ms(rows.filter((w) => w.hit).length), losMs: ms(rows.filter((w) => w.los).length),
    endX: rows.at(-1)?.x ?? '', endY: rows.at(-1)?.y ?? '', draws: res.draws,
    posDivergeMs: base ? diverge(res.trace, base.trace, 0) : '', drawDivergeMs: base ? diverge(res.trace, base.trace, 1) : '',
  };
}

// ════════════════════════════════════════════════════════════════════════
if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--merge')) {
  const parse = (t) => { const [h, ...ls] = t.trim().split('\n'); const cols = h.split(','); return ls.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v]))); };
  const rows = ['diag', 'staged', 'charge', 'obstacle', 'enc', 'iso', 'perf'].filter((t) => existsSync(`${OUT}marksman-metrics-${t}.csv`))
    .flatMap((t) => parse(readFileSync(`${OUT}marksman-metrics-${t}.csv`, 'utf8')));
  const cols = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  writeFileSync(`${OUT}marksman-stuck-metrics.csv`, [cols.join(','), ...rows.map((r) => cols.map((k) => r[k] ?? '').join(','))].join('\n') + '\n');
  console.log(`merged ${rows.length} rows, ${cols.length} columns`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ONLY = opt('only', 'diag').split(',');
  const SEEDS = Array.from({ length: +opt('seeds', '6') }, (_, i) => 1001 + i * 7919);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const t0 = Date.now();
  const save = (tag, rows) => {
    const cols = [];
    for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
    writeFileSync(`${OUT}marksman-metrics-${tag}.csv`, [cols.join(','), ...rows.map((r) => cols.map((k) => String(r[k] ?? '').replace(/,/g, ';')).join(','))].join('\n') + '\n');
    console.log(`  wrote ${tag}: ${rows.length} rows (${Math.round((Date.now() - t0) / 1000)}s)`);
  };

  // PART A — the frozen game only: the failure sequences, armed vs taken
  if (ONLY.includes('diag')) {
    const p = await mkPage(browser, '');
    const rows = [];
    for (const [rk, role] of [['R', MK], ['E', MKE]]) for (const [scn, mk] of Object.entries(SC)) for (const seed of SEEDS.slice(0, 3)) {
      const res = await p.evaluate((sc) => window.__mkRun(sc), mk(role, seed));
      const r = stagedRow(scn, rk, 'baseline', seed, res, null);
      r.section = 'diag';
      // the sequence: every check (tick, class, taken?) and the branch it happened in
      const rws = rowsOf(res);
      r.sequence = (res.rec?.checks || []).filter((c) => c.armed).map((c) => {
        const w = rws.find((q) => q.i === c.tick) || rws.find((q) => q.i >= c.tick);
        return `${ms(c.tick)}ms:${c.cls}:${w?.branch || '?'}${w?.charging ? '(chg)' : ''}${c.cons > 0 ? `:TAKEN${c.cons}` : ''}`;
      }).join(' ');
      rows.push(r);
    }
    await p.close();
    save('diag', rows);
    for (const r of rows.filter((q) => q.seed === SEEDS[0])) console.log(`${r.scenario.padEnd(16)} ${r.role}  side ${String(r.sideMs).padStart(5)}ms ${String(r.sideLatPx).padStart(4)}px  shots ${r.fired}/${r.charges}  ${r.sequence}`);
  }
  await browser.close();
  console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`);
}
