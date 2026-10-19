// DIAGNOSTIC — PHASE 3C: THE ORDINARY MARKSMAN'S STUCK RECOVERY.
// Prints numbers and writes `docs/evidence/marksman-stuck-v3c/`; asserts nothing
// (`tests/smoke-marksman-stuck.mjs` asserts). Every mode is the REAL URL flag:
//
//   baseline  no flag (the frozen game)
//   A         ?marksmanStuck=prog
//   B         ?marksmanStuck=early
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
export const MODES = [['baseline', ''], ['A', 'marksmanStuck=prog'], ['B', 'marksmanStuck=early']];
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

// the charge contract under player behaviours (sniper in its band unless noted)
export const CHARGE = {
  still: (a, seed) => ({ seed, ticks: 720, actors: [{ ...a, x: 800, y: 500, at: 0 }], player: [[0, 800, 1000]] }),
  lateral: (a, seed) => ({ seed, ticks: 720, actors: [{ ...a, x: 800, y: 500, at: 0 }], player: [[0, 500, 1000], [120, 1100, 1000], [240, 500, 1000], [360, 1100, 1000], [480, 500, 1000], [600, 1100, 1000], [720, 500, 1000]] }),
  crossBehind: (a, seed) => ({ ...SC.crossBehind(a, seed), ticks: 720 }),
  // a 120px lateral dash (6 ticks, ~1200px/s) every 50 ticks — lands in lock windows by phase
  dashLock: (a, seed) => ({ seed, ticks: 720, actors: [{ ...a, x: 800, y: 500, at: 0 }],
    player: Array.from({ length: 15 }, (_, k) => [[k * 50, 740 + (k % 2) * 120, 1000], [k * 50 + 44, 740 + (k % 2) * 120, 1000], [k * 50 + 50, 740 + ((k + 1) % 2) * 120, 1000]]).flat() }),
  closeIn: (a, seed) => ({ ...SC.holdRetreat(a, seed), ticks: 720 }),
  outRange: (a, seed) => ({ ...SC.holdApproach(a, seed), ticks: 720 }),
  // strafe across a pillar's shadow (period 4s): charges started in the open
  // are cut when the pillar comes between, and re-armed in the open again
  losBreak: (a, seed) => ({ seed, ticks: 720, actors: [{ ...a, x: 800, y: 450, at: 0 }], wall: [800, 700, 160, 40],
    player: [[0, 500, 1000], [120, 1100, 1000], [240, 500, 1000], [360, 1100, 1000], [480, 500, 1000], [600, 1100, 1000], [720, 500, 1000]] }),
};
// genuine obstruction (approach unless noted). The approach ends when the
// player is within 640px, so every obstacle sits between y 150 and ~600.
export const OBST = {
  'console70-early': (a, seed) => ({ seed, ticks: 720, actors: [{ ...a, x: 800, y: 150, at: 0 }], wall: [800, 240, 70, 70], player: [[0, 800, 1250]] }),
  'console70-late': (a, seed) => ({ seed, ticks: 720, actors: [{ ...a, x: 800, y: 150, at: 0 }], wall: [800, 420, 70, 70], player: [[0, 800, 1250]] }),
  cover90: (a, seed) => ({ seed, ticks: 720, actors: [{ ...a, x: 800, y: 150, at: 0 }], wall: [800, 420, 90, 90], player: [[0, 800, 1250]] }),
  angled: (a, seed) => ({ seed, ticks: 720, actors: [{ ...a, x: 600, y: 150, at: 0 }], wall: [670, 420, 90, 90], player: [[0, 800, 1250]] }),
  'wall320': (a, seed) => ({ seed, ticks: 900, actors: [{ ...a, x: 800, y: 150, at: 0 }], wall: [800, 420, 320, 40], player: [[0, 800, 1250]] }),
  holdBesideWall: (a, seed) => ({ seed, ticks: 600, actors: [{ ...a, x: 800, y: 600, at: 0 }], wall: [880, 600, 40, 240], player: [[0, 800, 1100]] }),
  retreatIntoCover: (a, seed) => ({ seed, ticks: 600, actors: [{ ...a, x: 800, y: 700, at: 0 }], wall: [800, 560, 240, 40], player: [[0, 800, 1200], [120, 800, 1200], [200, 800, 920]] }),
  holdApproachIntoCover: (a, seed) => ({ seed, ticks: 900, actors: [{ ...a, x: 800, y: 500, at: 0 }], wall: [800, 640, 240, 40], player: [[0, 800, 950], [240, 800, 950], [300, 800, 1350]] }),
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
    stoodF1: res.log?.stoodF1 ?? '', stoodHold: res.log?.stoodHold ?? '', stoodRetreat: res.log?.stoodRetreat ?? '', kept: res.log?.kept ?? '',
    keptPinned: res.log?.keptPinned ?? '', armedPinned: res.log?.armedPinned ?? '',
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

// obstacle-specific: reaching the band, contact, recovery, LOS
export function obstacleExtra(res) {
  const rows = rowsOf(res);
  const firstHit = rows.find((w) => w.hit)?.i ?? null;
  const lastHit = [...rows].reverse().find((w) => w.hit)?.i ?? null;
  const approachRows = rows.filter((w) => w.branch === 'A');
  const reached = rows.find((w, k) => k > 0 && w.branch === 'H' && rows[k - 1].branch === 'A')?.i ?? null;
  const eps = [];
  for (let k = 0; k < rows.length; k++) if (rows[k].br === 2 && (k === 0 || rows[k - 1].br !== 2)) eps.push(rows[k].i);
  const firstSideAfterHit = firstHit == null ? null : eps.find((i) => i >= firstHit) ?? null;
  const losAfterHit = firstHit == null ? null : rows.find((w) => w.i >= firstHit && w.los)?.i ?? null;
  const end = rows.slice(-60);
  return {
    firstContactMs: ms(firstHit), lastContactMs: ms(lastHit), escapeMs: firstHit == null ? '' : ms(lastHit - firstHit),
    activationDelayMs: firstHit == null || firstSideAfterHit == null ? '' : ms(firstSideAfterHit - firstHit),
    episodes: eps.length, episodesAfterContact: firstHit == null ? 0 : eps.filter((i) => i >= firstHit).length,
    falseSideMs: ms(rows.filter((w) => w.br === 2 && (firstHit == null || w.i < firstHit)).length),
    reachBandMs: ms(reached), approachMs: ms(approachRows.length),
    pinnedEnd: +(end.length > 0 && end.some((w) => w.hit) && end.at(-1).branch === 'A'),
    losAfterContactMs: firstHit == null || losAfterHit == null ? '' : ms(losAfterHit - firstHit),
    firstShotMs: ms(rows.find((w) => w.shot !== '')?.i ?? null),
  };
}

// ── a real encounter: real spawner, scripted player, every sniper sampled ──
export const ENC_SEG = [[0, 120, ''], [120, 260, 'D'], [260, 420, ''], [420, 520, 'W'], [520, 640, 'D'], [640, 780, 'S'], [780, 900, 'A'],
  [900, 1040, ''], [1040, 1160, 'D'], [1160, 1280, 'SD'], [1280, 1420, 'A'], [1420, 1540, 'W'], [1540, 1680, ''], [1680, 1800, 'D'],
  [1800, 1940, 'A'], [1940, 2080, 'S'], [2080, 2200, 'D'], [2200, 99999, '']];
export async function encRun(page, { seed, ticks = 2400, seg = ENC_SEG, fire = 7, superAt = [900, 1700] }) {
  return page.evaluate(async ({ seed, ticks, seg, fire, superAt }) => {
    window.__headless = true;
    const gs = window.__gs, P = gs.player, A = window.__aud;
    let hits = 0, snHits = 0;
    const pd = P.damage;
    P.damage = function (amt, ...rest) { hits++; if (amt === 220) snHits++; return pd.call(this, amt, ...rest); };
    const fired = new Map();
    gs.events.on('shooter-fire', (e) => { if (e.enemyType === 'sniper') fired.set(e, (fired.get(e) || 0) + 1); });
    window.__seed(seed); window.__draws = 0; A.tick = 0; A.trace.length = 0;
    const tr = [], sn = new Map();
    let interv = null;
    for (let i = 0; i < ticks; i++) {
      const cur = seg.find(([a, b]) => i >= a && i < b)[2], K = gs.keys;
      K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
      if (fire && i >= 60 && i % fire === 0) P.keyboardFire();
      if (superAt.includes(i)) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
      window.__adv(1);
      tr.push([A.hash(), window.__draws]);
      for (const r of A.recs) {
        const e = r.e;
        if (e.enemyType !== 'sniper' || r.nem) continue;
        let s = sn.get(e);
        if (!s) { s = { r, starts: 0, cancels: 0, lockSide: 0, prevC: false, lockHadSide: false, rows: 0, los: 0, dist: 0, bA: 0, bH: 0, bR: 0, holdMove: 0 }; sn.set(e, s); }
        if (!(e.alive && e.active)) continue;
        s.rows++;
        if (e._hasLOS(e.x, e.y, P.x, P.y)) s.los++;
        const dP = Math.hypot(P.x - e.x, P.y - e.y);
        s.dist += dP;
        if (dP < e.cfg.retreatRange) s.bR++; else if (dP > e.cfg.desiredRange + 80) s.bA++;
        else { s.bH++; if (Math.hypot(e.body.velocity.x, e.body.velocity.y) > 5) s.holdMove++; }
        const c = !!e._charging;
        if (c && !s.prevC) { s.starts++; s.lockHadSide = false; }
        if (c && e._chargeMs <= 260 && r.pbr === 2 && !s.lockHadSide) { s.lockHadSide = true; s.lockSide++; }
        s.prevC = c;
      }
      if (interv == null && A.recs.some((q) => { const l = q.e._marksmanStuck?.log; return l && (l.stoodF1 + l.stoodHold + l.stoodRetreat + l.armedPinned) > 0; })) interv = i;
    }
    const K = gs.keys; K.A.isDown = K.D.isDown = K.W.isDown = K.S.isDown = false;
    const by = {};
    for (const r of A.recs) {
      const k = r.nem ? `nemesis-${r.type}` : r.type === 'captain' ? 'captain' : r.type + (r.elite ? '-E' : '');
      const b = (by[k] ||= { spawns: 0, installed: 0, F1: 0, F1taken: 0, HOLD: 0, HOLDtaken: 0, BLOCK: 0, BLOCKtaken: 0, OTHER: 0, OTHERtaken: 0, sideTicks: 0, sideLat: 0, otherLat: 0, turns: 0, turnsSide: 0, contact: 0, shots: 0, starts: 0, fired: 0, cancels: 0, lockSide: 0, losTicks: 0, liveTicks: 0, distSum: 0, bandA: 0, bandH: 0, bandR: 0, holdMove: 0, stoodF1: 0, stoodHold: 0, stoodRetreat: 0, keptPinned: 0, armedPinned: 0 });
      b.spawns++;
      for (const c of r.checks) if (c.armed) { const g = { F: 'F1', H: 'HOLD', B: 'BLOCK', O: 'OTHER' }[c.cls[0]]; b[g]++; if (c.cons > 0) b[g + 'taken']++; }
      b.sideTicks += r.sideTicks; b.sideLat += r.sideLat; b.otherLat += r.otherLat; b.turns += r.turns; b.turnsSide += r.turnsSide; b.contact += r.contactTicks; b.shots += r.shots;
      const s = sn.get(r.e);
      if (s) { b.starts += s.starts; b.fired += fired.get(r.e) || 0; b.lockSide += s.lockSide; b.losTicks += s.los; b.liveTicks += s.rows; b.distSum += s.dist; b.bandA += s.bA; b.bandH += s.bH; b.bandR += s.bR; b.holdMove += s.holdMove; }
      const l = r.e._marksmanStuck?.log;
      if (l) { b.installed++; b.stoodF1 += l.stoodF1; b.stoodHold += l.stoodHold; b.stoodRetreat += l.stoodRetreat; b.keptPinned += l.keptPinned || 0; b.armedPinned += l.armedPinned || 0; }
    }
    for (const b of Object.values(by)) b.cancels = Math.max(0, b.starts - b.fired);
    return { by, hits, snHits, interv, draws: window.__draws, spawned: A.recs.length, killed: A.recs.filter((r) => !(r.e.alive && r.e.active)).length, trace: tr };
  }, { seed, ticks, seg, fire, superAt });
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
  // STAGED: every movement transition, Regular and Elite, baseline vs A
  if (ONLY.includes('staged') || ONLY.includes('charge') || ONLY.includes('obstacle')) {
    const pages = {};
    for (const [m, flags] of MODES) pages[m] = await mkPage(browser, flags);
    const sets = [];
    if (ONLY.includes('staged')) sets.push(['staged', SC]);
    if (ONLY.includes('charge')) sets.push(['charge', CHARGE]);
    if (ONLY.includes('obstacle')) sets.push(['obstacle', OBST]);
    for (const [tag, set] of sets) {
      const rows = [];
      const chargeRows = [];
      for (const [rk, role] of [['R', MK], ['E', MKE]]) for (const [scn, mk] of Object.entries(set)) for (const seed of SEEDS) {
        const sc = { ...mk(role, seed), trace: true };
        const res = {};
        for (const [m] of MODES) res[m] = await pages[m].evaluate((sc) => window.__mkRun(sc), sc);
        for (const [m] of MODES) {
          const row = stagedRow(scn, rk, m, seed, res[m], m === 'baseline' ? null : res.baseline);
          row.section = tag;
          if (tag === 'obstacle') Object.assign(row, obstacleExtra(res[m]));
          rows.push(row);
          if (tag === 'charge') for (const c of charges(rowsOf(res[m]))) chargeRows.push({ section: 'charge-each', scenario: scn, role: rk, mode: m, seed,
            start: ms(c.start), fired: +c.fired, ticks: c.ticks, lockTicks: c.lockTicks, lockSteady: +c.lockSteady, shotEqLock: c.fired ? +(c.shotAng === c.lockFirst) : '',
            cdAfter: c.cdAfter ?? '', sideDuring: c.sideDuring, sideDuringLock: c.sideDuringLock });
        }
      }
      // summaries
      const groups = new Map();
      for (const r of rows) { const k = `${r.scenario}|${r.role}|${r.mode}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
      for (const [k, g] of groups) {
        const [scenario, role, mode] = k.split('|');
        const sum = (f) => g.reduce((a, r) => a + (+r[f] || 0), 0);
        const mean = (f) => { const v = g.map((r) => r[f]).filter((x) => x !== '' && x != null); return v.length ? Math.round(v.reduce((a, x) => a + +x, 0) / v.length) : ''; };
        const out = { section: `${tag}-summary`, scenario, role, mode, seed: 'all', runs: g.length,
          F1taken_n: sum('F1taken'), HOLDtaken_n: sum('HOLDtaken'), BLOCKtaken_n: sum('BLOCKtaken'), OTHERtaken_n: sum('OTHERtaken'),
          sideMs: mean('sideMs'), sideLatPx: mean('sideLatPx'), resumes_n: sum('resumes'), resumeSide_n: sum('resumeSide'),
          charges_n: sum('charges'), fired_n: sum('fired'), cancelled_n: sum('cancelled'), sideDuringLock_n: sum('sideDuringLock'),
          lockSteady_all: g.every((r) => r.lockSteady === 1) ? 1 : 0, shotEqLock_all: g.every((r) => r.shotEqLock === 1) ? 1 : 0,
          stoodF1_n: sum('stoodF1'), stoodHold_n: sum('stoodHold'), stoodRetreat_n: sum('stoodRetreat'), keptPinned_n: sum('keptPinned'), armedPinned_n: sum('armedPinned') };
        if (tag === 'obstacle') Object.assign(out, { reached_n: g.filter((r) => r.reachBandMs !== '').length, pinnedEnd_n: sum('pinnedEnd'), reachBandMs: mean('reachBandMs'),
          firstContactMs: mean('firstContactMs'), activationDelayMs: mean('activationDelayMs'), escapeMs: mean('escapeMs'), contactMs: mean('contactMs'),
          episodes: mean('episodes'), falseSideMs: mean('falseSideMs'), firstShotMs: mean('firstShotMs'), losAfterContactMs: mean('losAfterContactMs') });
        rows.push(out);
      }
      save(tag, [...rows, ...chargeRows]);
    }
    for (const p of Object.values(pages)) await p.close();
  }

  // ENCOUNTERS: SNIPER NEST and MIXED, real spawner, fresh page per run
  if (ONLY.includes('enc')) {
    const rows = [];
    const ENC = [
      ['sniperNest', 'encdbg=sniperNest&room=detention&sector=8&wave=2', ''],
      ['sniperNest-v1', 'encdbg=sniperNest&room=detention&sector=8&wave=2', 'roster=v1&gait=v2&move=v22'],
      ['mixed', 'encdbg=mixed&room=detention&sector=12&wave=2', ''],
      ['mixed-bulwarkB', 'encdbg=mixed&room=detention&sector=12&wave=2', 'bulwarkStuck=early'],
    ];
    for (const [enc, q, shared] of ENC) for (const seed of SEEDS) {
      const res = {};
      for (const [m, flags] of MODES) {
        const p = await bootPage(browser, { q, flags: [shared, flags].filter(Boolean).join('&'), seed });
        await installAudit(p, 'A');
        await p.evaluate(() => { window.__headless = true; });
        res[m] = await encRun(p, { seed });
        await p.close();
      }
      for (const [m] of MODES) {
        const r = res[m];
        const common = { section: 'enc', scenario: enc, mode: m, seed, hits: r.hits, sniperHits: r.snHits, spawned: r.spawned, killed: r.killed, draws: r.draws,
          interveneMs: ms(r.interv), posDivergeMs: m === 'baseline' ? '' : diverge(r.trace, res.baseline.trace, 0), drawDivergeMs: m === 'baseline' ? '' : diverge(r.trace, res.baseline.trace, 1) };
        for (const [role, b] of Object.entries(r.by)) rows.push({ ...common, role, ...b, sideMs: ms(b.sideTicks), contactMs: ms(b.contact), losFrac: b.liveTicks ? +(b.losTicks / b.liveTicks).toFixed(3) : '', sideLat: Math.round(b.sideLat), otherLat: Math.round(b.otherLat), distSum: Math.round(b.distSum) });
      }
      console.log(`  enc ${enc} seed ${seed} (${Math.round((Date.now() - t0) / 1000)}s)`);
    }
    // per encounter x mode: every ordinary Marksman (Regular + Elite) pooled,
    // as rates per live Marksman-minute, because the fights diverge downstream
    // (kills, spawns) and raw totals would compare different fights
    const sums = [];
    for (const [enc] of ENC) for (const [m] of MODES) {
      const g = rows.filter((r) => r.scenario === enc && r.mode === m && (r.role === 'sniper' || r.role === 'sniper-E'));
      const sum = (f) => g.reduce((a, r) => a + (+r[f] || 0), 0);
      const live = sum('liveTicks'), min = live / 3600;
      const per = (f) => (min ? (sum(f) / min).toFixed(2) : '');
      const uniq = (f) => { const seen = new Map(); for (const r of rows.filter((r) => r.scenario === enc && r.mode === m)) seen.set(r.seed, +r[f] || 0); return [...seen.values()]; };
      const hitsV = uniq('hits'), snV = uniq('sniperHits');
      sums.push({ section: 'enc-summary', scenario: enc, mode: m, role: 'marksman (R+E)', seed: 'all', runs: new Set(g.map((r) => r.seed)).size,
        spawns: sum('spawns'), liveSec: Math.round(live / 60),
        F1taken_n: sum('F1taken'), HOLDtaken_n: sum('HOLDtaken'), BLOCKtaken_n: sum('BLOCKtaken'), OTHERtaken_n: sum('OTHERtaken'),
        stoodF1_n: sum('stoodF1'), stoodHold_n: sum('stoodHold'), stoodRetreat_n: sum('stoodRetreat'), keptPinned_n: sum('keptPinned'), armedPinned_n: sum('armedPinned'),
        sideSecPerMin: min ? (sum('sideTicks') / 60 / min).toFixed(2) : '', sideLatPerMin: per('sideLat'), otherLatPerMin: per('otherLat'),
        turnsPerMin: per('turns'), turnsSidePerMin: per('turnsSide'), contactSecPerMin: min ? (sum('contact') / 60 / min).toFixed(2) : '',
        startsPerMin: per('starts'), firedPerMin: per('fired'), cancelsPerMin: per('cancels'), lockSide_n: sum('lockSide'),
        losFrac: live ? (sum('losTicks') / live).toFixed(3) : '', meanDist: live ? Math.round(sum('distSum') / live) : '',
        bandA: live ? (sum('bandA') / live).toFixed(3) : '', bandH: live ? (sum('bandH') / live).toFixed(3) : '', bandR: live ? (sum('bandR') / live).toFixed(3) : '',
        holdMoveFrac: sum('bandH') ? (sum('holdMove') / sum('bandH')).toFixed(3) : '',
        hitsMean: (hitsV.reduce((a, x) => a + x, 0) / (hitsV.length || 1)).toFixed(1), sniperHitsMean: (snV.reduce((a, x) => a + x, 0) / (snV.length || 1)).toFixed(2) });
    }
    save('enc', [...rows, ...sums]);
  }

  // ISOLATION: encounters with no ordinary Marksman must be identical
  if (ONLY.includes('iso')) {
    const rows = [];
    const ENC = [['crossfire', 'encdbg=crossfire&room=corridor&sector=14&wave=2'], ['swarmTide', 'encdbg=swarmTide&room=hangar&sector=8&wave=2'],
      ['vanguard', 'encdbg=vanguard&room=hangar&sector=8&wave=2'], ['bomberRun', 'encdbg=bomberRun&room=hangar&sector=8&wave=2']];
    for (const [enc, q] of ENC) for (const seed of SEEDS.slice(0, 3)) {
      const res = {};
      for (const [m, flags] of MODES) {
        const p = await bootPage(browser, { q, flags, seed });
        await installAudit(p, 'A');
        await p.evaluate(() => { window.__headless = true; });
        res[m] = await encRun(p, { seed, ticks: 1800 });
        await p.close();
      }
      for (const [m] of MODES) {
        const r = res[m];
        rows.push({ section: 'iso', scenario: `iso-${enc}`, role: 'all', mode: m, seed, snipers: Object.entries(r.by).filter(([k]) => k.startsWith('sniper')).reduce((s, [, b]) => s + b.spawns, 0),
          spawned: r.spawned, draws: r.draws, posDivergeMs: m === 'baseline' ? '' : diverge(r.trace, res.baseline.trace, 0), drawDivergeMs: m === 'baseline' ? '' : diverge(r.trace, res.baseline.trace, 1) });
      }
      console.log(`  iso ${enc} seed ${seed}`);
    }
    save('iso', rows);
  }

  // PERF: 12 Marksmen, ms per tick
  if (ONLY.includes('perf')) {
    const rows = [];
    const sc = { seed: 77, ticks: 600, player: [[0, 500, 1250], [150, 1100, 1250], [300, 500, 1250], [450, 1100, 1250], [600, 500, 1250]],
      actors: Array.from({ length: 12 }, (_, k) => ({ ...(k % 2 ? MKE : MK), x: 200 + (k % 6) * 240, y: 150 + Math.floor(k / 6) * 220, at: 0 })) };
    for (const [m, flags] of MODES) {
      const p = await mkPage(browser, flags);
      const runs = [];
      for (let rep = 0; rep < 5; rep++) runs.push(await p.evaluate(async (sc) => {
        await window.__mkSetup(sc);
        const t = [];
        for (let i = 0; i < sc.ticks; i++) { const a = performance.now(); window.__mkStep(); t.push(performance.now() - a); }
        window.__mkCollect();
        t.sort((x, y) => x - y);
        return { mean: t.reduce((s, x) => s + x, 0) / t.length, p50: t[t.length >> 1], p95: t[Math.floor(t.length * 0.95)] };
      }, sc));
      await p.close();
      runs.sort((x, y) => x.mean - y.mean);
      rows.push({ section: 'perf', scenario: 'perf-12-marksmen', role: 'sniper x12', mode: m, seed: 77, runs: 5, msPerTickMean: runs[2].mean.toFixed(3), msPerTickP50: runs[2].p50.toFixed(3), msPerTickP95: runs[2].p95.toFixed(3) });
    }
    save('perf', rows);
  }

  await browser.close();
  console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`);
}
