// DIAGNOSTIC — R0: INTEGRATED COMBAT PRODUCTION-READINESS BASELINE.
// Prints numbers and writes `docs/evidence/integrated-combat-r0/`; asserts
// nothing about behaviour. It changes no gameplay: every run is the REAL game
// with REAL URL flags, seeded (`Math.random` is an LCG with a draw counter) on
// a 60Hz fixed step, exactly as the T1/T2 rigs run.
//
// THE CONFIGURATIONS ARE URL FLAGS, NOTHING ELSE:
//   A  production default — no gameplay flag at all
//   B  the approved integration: roster v1, move v2.2, gait v2, Bulwark
//      stuck-B, Marksman T1, free-Bulwark T2 — WITHOUT Marksman stuck-B
//   C  exactly B plus `marksmanStuck=early` (the unapproved candidate that was
//      ON while T1 and T2 were reviewed on the handset)
//   D* isolations, used only to attribute a difference (see CONFIGS)
// The harness flags `nodlg=1&nofreeze=1` and god mode are identical in every
// half (bootPage), so they cancel.
//
// TWO INSTRUMENTS, BOTH OBSERVE-ONLY:
//   - the Phase 3C-B / T1 / T2 instrument (`installTac`, imported unchanged):
//     Marksman / Bulwark per-tick rows and the Gunner / Rifleman controls.
//   - THE R0 WHOLE-ROSTER OBSERVER (here): every live enemy of every role —
//     Demolisher, swarmling, Captain, nemesis included — its motion, sharp
//     turns, stop-go, stuck sidesteps actually TAKEN, crowding; what the player
//     faces each tick (lines of fire, telegraphs, incoming bolts); the seam
//     census of every spawn; the VANGUARD front / screen / Captain clocks; the
//     super meter; and the wall time of each simulation step. It reads
//     positions, flags and the pure `_hasLOS`; it draws no random number and
//     writes no gameplay field. `--only=check` proves it: same seed, observer
//     on vs off, identical per-tick trace and draw count.
//
// usage:
//   node tests/diag-integrated-r0.mjs --only=check            observer inertness + determinism
//   node tests/diag-integrated-r0.mjs --only=census           flags + seam census per config
//   node tests/diag-integrated-r0.mjs --only=mixed,nest,vanguard,prog [--shard=0/2] [--tag=name]
//   node tests/diag-integrated-r0.mjs --only=perf             rendered vs headless step cost, A/B/C
//   node tests/diag-integrated-r0.mjs --report --csv=a.csv+b.csv
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { CHROME, bootPage } from './diag-stuck-audit.mjs';
import { installTac, analyse, Q as TQ, R, ASTATE, readCsv } from './diag-tactical-engagement.mjs';
import { mkPage, OBST, SC, MK, MKE, stagedRow, obstacleExtra } from './diag-marksman-stuck.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const has = (k) => process.argv.includes(`--${k}`);
const OUT = opt('out', new URL('../docs/evidence/integrated-combat-r0/', import.meta.url).pathname);
const RAW = opt('raw', `${OUT}raw/`);

// ── the configurations (exact URL strings; the human's handset URLs) ──────
const B_FLAGS = 'roster=v1&move=v22&gait=v2&bulwarkStuck=early&marksmanAngle=1&bulwarkAngle=1';
export const CONFIGS = {
  A: '',
  B: B_FLAGS,
  C: `${B_FLAGS}&marksmanStuck=early`,
  // isolations — each answers one attribution question, never run by default
  D_noBA: 'roster=v1&move=v22&gait=v2&bulwarkStuck=early&marksmanAngle=1',          // B without T2: VANGUARD contamination
  D_noMA: 'roster=v1&move=v22&gait=v2&bulwarkStuck=early&bulwarkAngle=1',           // B without T1: what T1 adds in the mix
  D_mkOnly: 'roster=v1&move=v22&gait=v2&bulwarkStuck=early&bulwarkAngle=1&marksmanStuck=early', // stuck-B without T1
  // R1 — C BECAME THE DEFAULT. Every config above is relative to the LEGACY
  // baseline (`bootPage` pins `baseline=legacy`), so A/B/C/D mean exactly what
  // they meant in R0. These three load with NO baseline parameter (`RAW_CFG`):
  P: '',                                          // the literal no-flags page: the production default
  C_url: `${B_FLAGS}&marksmanStuck=early`,        // C's handset URL as the human opened it (no baseline named)
  B_off: 'marksmanStuck=off',                     // B as one override on the production default
};
export const RAW_CFG = new Set(['P', 'C_url', 'B_off']);
/** bootPage options for a config: its flags, and no pinned baseline for the RAW ones */
export const bootOpts = (cfg) => ({ flags: CONFIGS[cfg], ...(RAW_CFG.has(cfg) ? { baseline: null } : {}) });
export const Q = {
  mixed: TQ.mixed,                        // Detention, sector 12, wave 2 — MIXED forced
  nest: TQ.nest,                          // Detention, sector 8, wave 2 — SNIPER NEST forced
  vanguard: TQ.vanguard,                  // Hangar, sector 8, wave 2, no Champion
  vanguardCaptain: TQ.vanguardCaptain,    // Hangar, sector 8, wave 2 — the authored Captain placement
  // ORDINARY PROGRESSION: `encdbg=1` is AUTO — the real resolver (`encounterFor`)
  // picks the archetype from arena, band and wave, exactly as endless does; the
  // harness only chooses where the run starts. Early / mid / late, three rooms.
  p_hangar_s2w1: 'encdbg=1&room=hangar&sector=2&wave=1',          // early: mixed
  p_corridor_s3w1: 'encdbg=1&room=corridor&sector=3&wave=1',      // early: crossfire
  p_detention_s6w2: 'encdbg=1&room=detention&sector=6&wave=2',    // mid: crossfire
  p_hangar_s10w1: 'encdbg=1&room=hangar&sector=10&wave=1',        // mid: bomberRun
  p_corridor_s14w3: 'encdbg=1&room=corridor&sector=14&wave=3',    // late: sniperNest
  p_detention_s16w3: 'encdbg=1&room=detention&sector=16&wave=3',  // late: bomberRun
};
const PROG = Object.keys(Q).filter((k) => k.startsWith('p_'));

// ── the R0 observer (page side) ────────────────────────────────────────────
export async function installR0(page) {
  await page.evaluate(() => {
    const gs = window.__gs, P = gs.player, T = window.__tac;
    const O = window.__r0 = { on: true, tick: 0, recs: [], byE: new Map(), perf: [], frames: [], spawnLog: [], firstChampion: null, superFullAt: null,
      hist: { tele: [0, 0, 0, 0, 0], los: [0, 0, 0, 0, 0], inc: [0, 0, 0, 0, 0] }, pairs60: 0, pairsOverlap: 0, pairsMax: 0, live: 0, liveMax: 0, ticks: 0,
      screen: { hold: 0, move: 0, flips: 0 }, waveLog: [], waveKey: null };
    const ranged = (e) => e.enemyType === 'shooter' || e.enemyType === 'grunt' || e.enemyType === 'sniper' || e.enemyType === 'shielded' || e.isChampion;
    const keyOf = (e) => (e.isChampion ? 'captain' : e.enemyType) + (e._miniBoss ? '-nem' : '') + (e._screen ? '-screen' : '') + (e._elite ? '-E' : '');
    O.track = (e) => {
      const r = { e, key: keyOf(e), born: O.tick, live: 0, moving: 0, path: 0, turns: 0, rev: 0, stopGo: 0, stopRun: 0, movedOnce: false,
        side: 0, sideEp: 0, inSide: false, crowd: 0, overlap: 0, px: e.x, py: e.y, hist: [], dead: null,
        seams: { ms: !!e._marksmanStuck, ma: !!e._marksmanAngle, bs: !!e._bulwarkStuck, ba: !!e._bulwarkAngle, loco: !!e._loco, v22: !!e._v22,
          roster: String(e.texture?.key || '').startsWith('ro-'), nem: !!e._miniBoss, screen: !!e._screen, lane: e._lane ?? null, champ: !!e.isChampion } };
      // stuck sidestep TAKEN (the consumer is `_moveToward`): wrap the bearer's
      // own method — whatever the seams left there — and call straight through
      if (typeof e._moveToward === 'function') {
        const mv = e._moveToward;
        e._moveToward = function (tx, ty, sp) { if (this._stuckSidestepMs > 0 && Math.hypot(tx - this.x, ty - this.y) >= 2) r.sideNow = true; return mv.call(this, tx, ty, sp); };
      }
      O.recs.push(r); O.byE.set(e, r);
      O.spawnLog.push([O.tick, r.key, Math.round(e.x), Math.round(e.y)]);
      if (e.isChampion && O.firstChampion == null) O.firstChampion = O.tick;
      return r;
    };
    O.reset = () => {
      O.tick = 0; O.recs.length = 0; O.byE.clear(); O.perf.length = 0; O.frames.length = 0; O.spawnLog.length = 0; O.firstChampion = null; O.superFullAt = null;
      O.hist = { tele: [0, 0, 0, 0, 0], los: [0, 0, 0, 0, 0], inc: [0, 0, 0, 0, 0] }; O.pairs60 = 0; O.pairsOverlap = 0; O.pairsMax = 0; O.live = 0; O.liveMax = 0; O.ticks = 0;
      O.screen = { hold: 0, move: 0, flips: 0 }; O.waveLog = []; O.waveKey = null;
      for (const e of gs.enemies.getChildren()) if (e.active && e.alive && !O.byE.has(e)) O.track(e);
    };
    // the step's wall time (simulation only when headless; render too when not)
    const adv0 = window.__adv;
    window.__adv = (n = 1) => { const t0 = performance.now(); adv0(n); if (O.on) O.perf.push(performance.now() - t0); };
    const SUPER = 4;   // PLAYER.superHitsToCharge
    O.observe = () => {
      if (!O.on) return;
      O.tick++; O.ticks++;
      // the wave clock as the scene holds it: every change of room / wave / encounter
      const wk = `${gs.roomSpec?.id}|${gs._waveIdx}|${gs._encounter?.id ?? ''}|${gs._wavePhase ?? ''}`;
      if (wk !== O.waveKey) { O.waveKey = wk; O.waveLog.push([O.tick, gs.roomSpec?.id, gs._waveIdx, gs._encounter?.id ?? null, gs._wavePhase ?? null]); }
      const live = [];
      for (const e of gs.enemies.getChildren()) if (e.active && e.alive) { if (!O.byE.has(e)) O.track(e); live.push(e); }
      O.live += live.length; O.liveMax = Math.max(O.liveMax, live.length);
      let tele = 0, los = 0, mkChg = 0, mkStart = 0;
      const mks = [];
      for (const e of live) {
        const r = O.byE.get(e);
        r.live++;
        const dx = e.x - r.px, dy = e.y - r.py, d = Math.hypot(dx, dy);
        r.path += d;
        const mv = d >= 0.5;
        if (mv) { r.moving++; if (r.movedOnce && r.stopRun > 0 && r.stopRun <= 18) r.stopGo++; r.stopRun = 0; r.movedOnce = true; } else if (r.movedOnce) r.stopRun++;
        // heading over 100ms windows: a sharp turn (>60deg) and a reversal (>120deg)
        r.hist.push([e.x, e.y]); if (r.hist.length > 13) r.hist.shift();
        if (r.hist.length === 13) {
          const [a, b, c] = [r.hist[0], r.hist[6], r.hist[12]];
          const v1x = b[0] - a[0], v1y = b[1] - a[1], v2x = c[0] - b[0], v2y = c[1] - b[1];
          const s1 = Math.hypot(v1x, v1y), s2 = Math.hypot(v2x, v2y), need = 0.3 * (e.cfg?.speed || 100) * 0.1;
          let sharp = false, rev = false;
          if (s1 > need && s2 > need) { const cs = (v1x * v2x + v1y * v2y) / (s1 * s2); sharp = cs < 0.5; rev = cs < -0.5; }
          if (sharp && !r.inTurn) { r.turns++; if (rev) r.rev++; }
          r.inTurn = sharp;
        }
        if (r.sideNow) { r.side++; if (!r.inSide) r.sideEp++; r.inSide = true; } else r.inSide = false;
        r.sideNow = false;
        r.px = e.x; r.py = e.y;
        // what the player faces
        if (e.enemyType === 'sniper' ? e._charging : e._warnFlashed) tele++;
        if (e.enemyType === 'sniper' && !e._miniBoss) { mks.push(e); if (e._charging) { mkChg++; if (!r.chg) mkStart++; } r.chg = !!e._charging; }
        else if (e.enemyType === 'bomber' && Math.hypot(P.x - e.x, P.y - e.y) < 160) tele++;
        if (ranged(e) && Math.hypot(P.x - e.x, P.y - e.y) < 900 && e._hasLOS(e.x, e.y, P.x, P.y)) los++;
        if (e._screen) { const h = !!e._screenHolding; if (r.sh !== undefined && r.sh !== h) O.screen.flips++; r.sh = h; if (h) O.screen.hold++; else O.screen.move++; }
      }
      // crowding: pairs within 60px, and bodies overlapping (enemies do not collide with each other)
      let p60 = 0, pov = 0;
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 60) { p60++; O.byE.get(a).crowd++; O.byE.get(b).crowd++; }
        if (d < (a.cfg?.radius || 16) + (b.cfg?.radius || 16)) { pov++; O.byE.get(a).overlap++; O.byE.get(b).overlap++; }
      }
      O.pairs60 += p60; O.pairsOverlap += pov; O.pairsMax = Math.max(O.pairsMax, p60);
      let inc = 0;
      for (const g of gs.hostileBullets || []) for (const b of g.getChildren()) if (b.active && Math.hypot(b.x - P.x, b.y - P.y) < 250) inc++;
      O.hist.tele[Math.min(4, tele)]++; O.hist.los[Math.min(4, los)]++; O.hist.inc[Math.min(4, inc)]++;
      let mkMin = -1;
      for (let i = 0; i < mks.length; i++) for (let j = i + 1; j < mks.length; j++) { const d = Math.hypot(mks[i].x - mks[j].x, mks[i].y - mks[j].y); if (mkMin < 0 || d < mkMin) mkMin = d; }
      O.frames.push([tele, los, inc, live.length, mkChg, mks.length, Math.round(mkMin), mkStart]);
      for (const r of O.recs) if (r.dead == null && !(r.e.active && r.e.alive)) r.dead = O.tick;
      if (O.superFullAt == null && (P.superCharge || 0) >= SUPER) O.superFullAt = O.tick;
    };
    // run after the tac instrument's own step (which calls __adv once)
    const s0 = T.step;
    T.step = () => { s0(); O.observe(); };
    O.collect = () => {
      const F = gs._vanguardFront;
      return {
        recs: O.recs.map((r) => ({ key: r.key, born: r.born, dead: r.dead, live: r.live, moving: r.moving, path: Math.round(r.path), turns: r.turns, rev: r.rev, stopGo: r.stopGo,
          side: r.side, sideEp: r.sideEp, crowd: r.crowd, overlap: r.overlap, seams: r.seams,
          // the stuck candidates' own decision counts (null where the seam is absent)
          msLog: r.e._marksmanStuck ? { ...r.e._marksmanStuck.log } : null, bsLog: r.e._bulwarkStuck ? { ...r.e._bulwarkStuck.log } : null })),
        waveLog: O.waveLog.slice(),
        perf: O.perf.slice(), frames: O.frames.slice(), spawnLog: O.spawnLog.slice(), firstChampion: O.firstChampion, superFullAt: O.superFullAt, superEnd: P.superCharge || 0,
        hist: O.hist, pairs60: O.pairs60, pairsOverlap: O.pairsOverlap, pairsMax: O.pairsMax, live: O.live, liveMax: O.liveMax, ticks: O.ticks, screen: O.screen,
        front: F ? { secondAt: F.secondAt, holdAt: F.holdAt, holdMs: Math.round(F.holdMs || 0), released: !!F.released, releasedAt: F.releasedAt, why: F.why, pair: (F.pair || []).length } : null,
        encounter: gs._encounter?.id ?? null, waveIdx: gs._waveIdx ?? null, room: gs.roomSpec?.id ?? null, sector: gs.sector ?? gs._sector ?? null,
        enemyHpMult: gs.enemyHpMult, enemySpeedMult: gs.enemySpeedMult, modifier: gs._roomModifier?.id ?? gs._roomModifier?.name ?? null,
      };
    };
    // a FLANK pilot: route (on the room's NavGrid, via the instrument's own
    // `patrol` pilot) to the side of the nearest free Bulwark its shield is NOT
    // facing, 170px out; with no free Bulwark, to the side of the nearest enemy
    T.pilots.flank = () => {
      const o = { wp: [[P.x, P.y, 1]] }, walk = T.pilots.patrol(o);
      const B = gs.roomSpec.bounds;
      return (i) => {
        if (i % 15 === 0) {
          const live = gs.enemies.getChildren().filter((e) => e.active && e.alive);
          const bw = live.filter((e) => e.enemyType === 'shielded' && !e._screen);
          const pool = bw.length ? bw : live;
          pool.sort((p, q) => Math.hypot(p.x - P.x, p.y - P.y) - Math.hypot(q.x - P.x, q.y - P.y));
          const t = pool[0];
          if (t) {
            const f = t._shieldFacing ?? Math.atan2(P.y - t.y, P.x - t.x);
            const cands = [f + 2.1, f - 2.1].map((a) => ({ x: t.x + Math.cos(a) * 170, y: t.y + Math.sin(a) * 170 }))
              .map((c) => ({ x: Math.max(60, Math.min(B.w - 60, c.x)), y: Math.max(60, Math.min(B.h - 60, c.y)) }));
            cands.sort((p, q) => Math.hypot(p.x - P.x, p.y - P.y) - Math.hypot(q.x - P.x, q.y - P.y));
            o.wp[0] = [cands[0].x, cands[0].y, 1];
          }
        }
        walk(i);
      };
    };
  });
}

// ── node side: one run's R0 summary rows ───────────────────────────────────
const ms = (t) => Math.round(t * 1000 / 60);
const qt = (arr, f) => { if (!arr.length) return ''; const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const HP = 1000;   // PLAYER.hp
const SRC = { 220: 'marksman', 120: 'bulwark', 130: 'gunner', 80: 'rifleman', 240: 'demolisher', 55: 'demolisherSwipe', 42: 'swarmling' };
function pressure(hits, ticks) {
  const dmg = new Float64Array(ticks + 1);
  for (const [t, a] of hits) if (t <= ticks) dmg[t] += a;
  // the fastest window that delivers a full health bar (lower = harsher); the
  // worst 3s; time spent "recovering" (no hit in the previous 2s); longest gap
  let best = Infinity, j = 0, sum = 0;
  for (let i = 0; i <= ticks; i++) { sum += dmg[i]; while (sum - dmg[j] >= HP && j < i) { sum -= dmg[j]; j++; } if (sum >= HP) best = Math.min(best, i - j + 1); }
  let w3 = 0, s3 = 0;
  for (let i = 0; i <= ticks; i++) { s3 += dmg[i]; if (i >= 180) s3 -= dmg[i - 180]; w3 = Math.max(w3, s3); }
  let rec = 0, last = -1e9, gap = 0, prev = 0;
  for (let i = 0; i <= ticks; i++) { if (dmg[i] > 0) { gap = Math.max(gap, i - prev); prev = i; last = i; } if (i - last > 120) rec++; }
  gap = Math.max(gap, ticks - prev);
  const total = hits.reduce((s, h) => s + h[1], 0);
  const by = {};
  for (const [, a] of hits) { const k = SRC[a] || 'other'; by[k] = (by[k] || 0) + a; }
  return { dmgPerMin: Math.round(total / (ticks / 3600)), hitsPerMin: +(hits.length / (ticks / 3600)).toFixed(1), fastestFullBarS: best === Infinity ? '' : +(best / 60).toFixed(1),
    worst3sDmg: w3, recoveringFrac: +(rec / (ticks + 1)).toFixed(3), longestNoHitS: +(gap / 60).toFixed(1),
    ...Object.fromEntries(Object.entries(by).map(([k, v]) => [`dmg_${k}`, v])) };
}
// SIMULTANEOUS LASER WARNINGS: ticks with 2+ / 3+ ordinary Marksmen charging
// (each charge is the 800ms windup + laser the player reads), charge starts
// that land within 300ms of another Marksman's, how close two Marksmen stand,
// and Marksman hits landing within 500ms of another (a double tap)
function mkConcurrency(fr, hits) {
  const withMk = fr.filter((f) => f[5] > 0), n = withMk.length || 1;
  const starts = []; fr.forEach((f, i) => { for (let k = 0; k < (f[7] || 0); k++) starts.push(i); });
  let near = 0; for (let i = 0; i < starts.length; i++) if (starts.some((t, j) => j !== i && Math.abs(t - starts[i]) <= 18)) near++;
  const pairs = fr.filter((f) => f[5] >= 2), close = pairs.filter((f) => f[6] >= 0 && f[6] < 60).length;
  const mh = hits.filter((h) => h[1] === 220).map((h) => h[0]);
  let dbl = 0; for (let i = 1; i < mh.length; i++) if (mh[i] - mh[i - 1] <= 30) dbl++;
  const dists = pairs.map((f) => f[6]).filter((d) => d >= 0);
  return { mkTicks: withMk.length, mkMeanLive: +(withMk.reduce((s, f) => s + f[5], 0) / n).toFixed(2), mkCharge1Frac: +(withMk.filter((f) => f[4] >= 1).length / n).toFixed(3),
    mkCharge2Frac: +(withMk.filter((f) => f[4] >= 2).length / n).toFixed(3), mkCharge3Frac: +(withMk.filter((f) => f[4] >= 3).length / n).toFixed(3),
    mkChargeStarts: starts.length, mkStartsWithin300: near, mkPairsUnder60Frac: pairs.length ? +(close / pairs.length).toFixed(3) : '',
    mkPairMinDistMed: dists.length ? +qt(dists, 0.5) : '', mkHits: mh.length, mkDoubleHits: dbl };
}
export function summarise(tac, r0, meta) {
  const rows = [];
  const n = r0.ticks || 1;
  const fr = r0.frames;
  const share = (h) => h.map((v) => +(v / n).toFixed(3));
  const tele = share(r0.hist.tele), los = share(r0.hist.los), inc = share(r0.hist.inc);
  const perf = r0.perf;
  // attack overlap: ticks with 2+ telegraphs live; the longest run of 2+
  let ov2 = 0, run2 = 0, maxRun2 = 0;
  for (const f of fr) { if (f[0] >= 2) { ov2++; run2++; maxRun2 = Math.max(maxRun2, run2); } else run2 = 0; }
  const seams = {};
  for (const r of r0.recs) { const k = r.key; const s = (seams[k] ||= { n: 0, ms: 0, ma: 0, bs: 0, ba: 0, loco: 0, v22: 0, roster: 0 }); s.n++; for (const f of ['ms', 'ma', 'bs', 'ba', 'loco', 'v22', 'roster']) s[f] += r.seams[f] ? 1 : 0; }
  const roles = {};
  for (const r of r0.recs) { if (r.live < 30) continue; const k = r.key.replace('-E', ''); const g = (roles[k] ||= { n: 0, live: 0, moving: 0, path: 0, turns: 0, rev: 0, stopGo: 0, side: 0, sideEp: 0, crowd: 0, overlap: 0 });
    g.n++; for (const f of ['live', 'moving', 'path', 'turns', 'rev', 'stopGo', 'side', 'sideEp', 'crowd', 'overlap']) g[f] += r[f]; }
  const run = { section: 'r0run', ...meta, ticks: n, draws: tac.draws, traceHash: tac.trace.reduce((h, t) => (h * 31 + t[0] + t[1]) % 1e9, 7),
    encounter: r0.encounter, room: r0.room, waveIdx: r0.waveIdx, enemyHpMult: r0.enemyHpMult, enemySpeedMult: r0.enemySpeedMult, modifier: r0.modifier,
    spawned: r0.recs.length, killed: r0.recs.filter((r) => r.dead != null).length,
    waves: r0.waveLog.filter((w, i, a) => i === 0 || w[2] !== a[i - 1][2] || w[1] !== a[i - 1][1]).map((w) => `${w[1]}#${w[2]}:${w[3] ?? '-'}@${ms(w[0])}`).join(' '),
    ...Object.fromEntries(['checks', 'armed', 'stoodF1', 'stoodHold', 'stoodRetreat', 'kept', 'retreatBlocked', 'keptPinned', 'armedPinned'].map((f) => [`ms_${f}`, r0.recs.reduce((s, r) => s + (r.msLog?.[f] || 0), 0)])),
    msBearers: r0.recs.filter((r) => r.msLog).length, bsBearers: r0.recs.filter((r) => r.bsLog).length,
    liveMean: +(r0.live / n).toFixed(2), liveMax: r0.liveMax,
    spawnOrder: r0.spawnLog.map((s) => s[1]).join(' '), firstChampionMs: r0.firstChampion == null ? '' : ms(r0.firstChampion),
    superFullMs: r0.superFullAt == null ? '' : ms(r0.superFullAt), superEnd: r0.superEnd,
    tele0: tele[0], tele1: tele[1], tele2: tele[2], tele3p: +(tele[3] + tele[4]).toFixed(3), overlap2Frac: +(ov2 / n).toFixed(3), overlap2LongestMs: ms(maxRun2),
    los0: los[0], los1: los[1], los2: los[2], los3p: +(los[3] + los[4]).toFixed(3), losMean: +(fr.reduce((s, f) => s + f[1], 0) / n).toFixed(2),
    inc0: inc[0], inc3p: +(inc[3] + inc[4]).toFixed(3),
    pairs60Mean: +(r0.pairs60 / n).toFixed(2), pairs60Max: r0.pairsMax, overlapPairsMean: +(r0.pairsOverlap / n).toFixed(2),
    stepMsMed: +(+qt(perf, 0.5)).toFixed(2), stepMsP95: +(+qt(perf, 0.95)).toFixed(2), stepMsP99: +(+qt(perf, 0.99)).toFixed(2), stepMsMax: +Math.max(0, ...perf).toFixed(1),
    screenHoldMs: ms(r0.screen.hold), screenMoveMs: ms(r0.screen.move), screenFlips: r0.screen.flips,
    ...(r0.front ? { frontSecondAt: r0.front.secondAt ?? '', frontHoldAt: r0.front.holdAt ?? '', frontHoldMs: r0.front.holdMs, frontReleased: +r0.front.released, frontReleasedAt: r0.front.releasedAt ?? '', frontWhy: r0.front.why ?? '', frontPair: r0.front.pair } : {}),
    ...mkConcurrency(fr, tac.hits),
    hitsAll: tac.hits.length, playerShots: tac.firedP, ...pressure(tac.hits, n),
    seamCensus: Object.entries(seams).map(([k, s]) => `${k}:${s.n}[${['ms', 'ma', 'bs', 'ba', 'loco', 'v22', 'roster'].filter((f) => s[f]).map((f) => `${f}${s[f]}`).join('/')}]`).join(' ') };
  rows.push(run);
  for (const [k, g] of Object.entries(roles)) {
    const min = g.live / 3600;
    rows.push({ section: 'r0role', ...meta, role: k, n: g.n, liveS: +(g.live / 60).toFixed(1), movingFrac: +(g.moving / g.live).toFixed(3), pxPerS: +(g.path / (g.live / 60)).toFixed(1),
      turnsPerMin: +(g.turns / min).toFixed(2), reversalsPerMin: +(g.rev / min).toFixed(2), stopGoPerMin: +(g.stopGo / min).toFixed(2),
      sidestepTakenFrac: +(g.side / g.live).toFixed(4), sidestepEpisodesPerMin: +(g.sideEp / min).toFixed(2), crowdedFrac: +(g.crowd / g.live).toFixed(3), overlapFrac: +(g.overlap / g.live).toFixed(3) });
  }
  return rows;
}

// ── Marksman stuck-sidestep episodes, classified from the T1 rows ─────────
// An episode = a contiguous run of ticks where the Marksman's own tick took a
// stuck sidestep (`cmd` SIDESTEP). Classified by what preceded it:
//   F1     inside its first 40 ticks of life (the first-check false skate)
//   PINNED the 6 ticks before it were approach commands in wall contact (the genuine case)
//   HOLD   most of the previous 600ms was the HOLD branch (the hold -> resume false skate)
//   OTHER  anything else
export function marksmanSidesteps(tac, meta) {
  const out = [];
  for (const a of tac.actors) {
    if (a.type !== 'sniper' || a.ref) continue;
    const rows = a.rows;
    for (let k = 0; k < rows.length; k++) {
      if (rows[k][R.cmd] !== 2 || (k > 0 && rows[k - 1][R.cmd] === 2)) continue;
      let j = k; while (j < rows.length && rows[j][R.cmd] === 2) j++;
      const pre = rows.slice(Math.max(0, k - 36), k);
      const holdF = pre.length ? pre.filter((w) => w[R.branch] === 2).length / pre.length : 0;
      const pin6 = rows.slice(Math.max(0, k - 6), k);
      const pinned = pin6.length >= 3 && pin6.every((w) => w[R.blk] && (w[R.cmd] === 1 || w[R.cmd] === 2));
      const age = rows[k][R.tick] - a.born;
      const cls = age <= 40 ? 'F1' : pinned ? 'PINNED' : holdF >= 0.5 ? 'HOLD' : 'OTHER';
      let px = 0; for (let i = k; i < j; i++) px += Math.hypot(rows[i][R.dx], rows[i][R.dy]);
      // did the line open within 1s of the sidestep ending? did it reach the band?
      const after = rows.slice(j, j + 60);
      out.push({ section: 'mkside', ...meta, actor: a.id, elite: +a.elite, startMs: ms(rows[k][R.tick]), durMs: ms(j - k), px: Math.round(px), cls, holdFrac: +holdF.toFixed(2),
        losBefore: rows[k][R.los], losAfter1s: after.some((w) => w[R.los] === 1) ? 1 : 0, distToPlayer: Math.round(Math.hypot(rows[k][R.px] - rows[k][R.x], rows[k][R.py] - rows[k][R.y])) });
    }
  }
  return out;
}

// ── runner ─────────────────────────────────────────────────────────────────
const SEEDS3 = [1001, 8920, 16839];   // the T1/T2 seeds, so C can be checked against their CSV
async function r0Page(browser, cfg, q, seed) {
  const p = await bootPage(browser, { ...bootOpts(cfg), q, seed });
  await installTac(p);
  await installR0(p);
  await p.evaluate(() => { window.__headless = true; });
  return p;
}
const runOne = (p, o) => p.evaluate((o) => {
  const T = window.__tac, O = window.__r0;
  O.on = o.observe !== false;
  T.begin(o); O.reset();
  for (let i = 0; i < o.ticks; i++) T.step();
  return { tac: T.collect(), r0: O.collect() };
}, o);

function toCsv(rows) {
  const cols = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  const esc = (v) => (v === undefined || v === null ? '' : /[,"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

const PLANS = {
  // R0-1: every representative pilot, A / B / C
  mixed: { q: ['mixed'], pilots: ['handset', 'hide', 'hop2', 'circle', 'charge', 'retreat', 'flank'], cfgs: ['A', 'B', 'C'], seeds: SEEDS3, ticks: 2400 },
  // R0-2: the cover pilots, the adversarial hop, the rusher
  nest: { q: ['nest'], pilots: ['handset', 'hide', 'hop2', 'hop', 'charge'], cfgs: ['A', 'B', 'C'], seeds: SEEDS3, ticks: 2400 },
  // R0-3: with and without the Captain; D_noBA isolates T2 (must be tick-identical to B)
  vanguard: { q: ['vanguard', 'vanguardCaptain'], pilots: ['handset', 'hide', 'circle'], cfgs: ['A', 'B', 'C', 'D_noBA'], seeds: SEEDS3.slice(0, 2), ticks: 2400 },
  // R0-4: ordinary progression, the real resolver, a minute per cell
  prog: { q: PROG, pilots: ['handset', 'hide'], cfgs: ['A', 'B', 'C'], seeds: SEEDS3.slice(0, 2), ticks: 3600 },
  // R0-2 follow-up: the Marksman-heavy fights again (identical runs — the trace
  // hash proves it) with the Marksman concurrency columns; the late-band
  // junction SNIPER NEST added with every seed and the cover pilots
  sniper: { q: ['nest', 'p_corridor_s14w3'], pilots: ['handset', 'hide', 'hop2', 'hop', 'charge'], cfgs: ['A', 'B', 'C'], seeds: SEEDS3, ticks: 2400 },
};

async function main() {
  const ONLY = opt('only', 'check').split(',');
  mkdirSync(OUT, { recursive: true }); mkdirSync(RAW, { recursive: true });
  const t0 = Date.now();
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const log = (...a) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s]`, ...a);

  if (ONLY.includes('check')) {
    // (1) THE OBSERVER IS INERT: same seed, observer on vs off, per-tick trace + draws
    // (2) DETERMINISM: two fresh pages, same everything, identical traces
    for (const [cfg, scn, pilot] of [['B', 'mixed', 'handset'], ['C', 'nest', 'hop2'], ['A', 'vanguardCaptain', 'circle'], ['B', 'p_corridor_s14w3', 'hide']]) {
      const tr = [];
      for (const observe of [true, false, true]) {
        const p = await r0Page(browser, cfg, Q[scn], 1001);
        const res = await runOne(p, { seed: 1001, ticks: 1800, pilot: { mode: pilot }, fire: 7, observe });
        tr.push(res.tac.trace);
        await p.close();
      }
      const div = (x, y) => x.findIndex((v, i) => v[0] !== y[i][0] || v[1] !== y[i][1]);
      log(`check ${cfg} ${scn} ${pilot}: observer on vs off first divergence ${div(tr[0], tr[1])}; on vs on (fresh page) ${div(tr[0], tr[2])}  (-1 = identical; ${tr[0].length} ticks, draws ${tr[0].at(-1)[1]})`);
    }
  }

  if (ONLY.includes('census')) {
    // the real flag parser's verdict on each config, and which seam each spawn received
    const rows = [];
    for (const cfg of ['A', 'B', 'C', 'D_noBA']) for (const scn of ['mixed', 'nest', 'vanguardCaptain', 'p_hangar_s10w1', 'p_corridor_s14w3']) {
      const p = await r0Page(browser, cfg, Q[scn], 1001);
      const flags = await p.evaluate(async () => {
        const d = await window.__mod(/systems\/debug\.js/);
        return { roster: d.getRosterVersion(), moveV2: d.isMoveV2(), moveV22: d.isMoveV22(), gaitV2: d.isGaitV2(), bulwarkStuck: d.getBulwarkStuck(),
          marksmanStuck: d.getMarksmanStuck(), marksmanAngle: d.isMarksmanAngle(), bulwarkAngle: d.isBulwarkAngle(), url: location.search };
      });
      const res = await runOne(p, { seed: 1001, ticks: 2400, pilot: { mode: 'hide' }, fire: 7 });
      await p.close();
      const s = summarise(res.tac, res.r0, { scenario: scn, config: cfg, seed: 1001, pilot: 'hide' })[0];
      rows.push({ config: cfg, scenario: scn, ...flags, encounter: s.encounter, room: s.room, spawned: s.spawned, census: s.seamCensus, spawnOrder: s.spawnOrder });
      log(`census ${cfg} ${scn}:`, JSON.stringify(flags), '\n   ', s.seamCensus);
    }
    writeFileSync(`${RAW}r0-census.csv`, toCsv(rows));
  }

  // the encounter matrices
  const shard = opt('shard', '0/1').split('/').map(Number);
  const tag = opt('tag', ONLY.join('-'));
  const rows = [];
  let k = 0;
  for (const plan of ONLY.filter((o) => PLANS[o])) {
    const P = PLANS[plan];
    // shard by CELL (scenario x pilot x seed), so every config of a cell runs
    // back to back in one process under the same load
    for (const scn of P.q) for (const pilot of P.pilots) for (const seed of P.seeds) if ((k++ % shard[1]) === shard[0]) for (const cfg of P.cfgs) {
      if (opt('cfgs', '') && !opt('cfgs', '').split(',').includes(cfg)) continue;
      const p = await r0Page(browser, cfg, Q[scn], seed);
      const tS = Date.now();
      const res = await runOne(p, { seed, ticks: P.ticks, pilot: { mode: pilot }, fire: 7 });
      const wall = Date.now() - tS;
      await p.close();
      const meta = { plan, scenario: `${scn}:${pilot}`, config: cfg, seed };
      // the T1/T2 instrument's tables, keyed `variant` = config so its report reads them
      const a = analyse(res.tac, { scenario: `${scn}:${pilot}`, variant: cfg, seed }, res.tac.geo);
      a.run.wallMsPer1000Ticks = Math.round(wall / res.tac.trace.length * 1000);
      a.run.traceHash = res.tac.trace.reduce((h, t) => (h * 31 + t[0] + t[1]) % 1e9, 7);
      rows.push(...summarise(res.tac, res.r0, meta), ...marksmanSidesteps(res.tac, meta),
        ...[a.run, ...a.actorRows, ...a.respRows].map((r) => ({ ...r, plan, config: cfg })));
      writeFileSync(`${RAW}r0-${tag}-${shard[0]}.csv`, toCsv(rows));
      log(`${plan} ${scn} ${pilot} ${cfg} ${seed}: ${res.tac.trace.length} ticks, draws ${res.tac.draws}, hits ${res.tac.hits.length}, wall ${wall}ms`);
    }
  }

  if (ONLY.includes('diverge')) {
    // WHERE B AND C PART WAYS, AND WHY: the same cell in both configs, every
    // tick's trace; at the first differing tick, what the Marksmen were doing
    // in each (the sidestep timer, the stuck module's own log, T1's state)
    const rows = [];
    const cells = [['mixed', 'handset'], ['mixed', 'hide'], ['mixed', 'hop2'], ['nest', 'hop2'], ['nest', 'hide'], ['nest', 'handset']];
    for (const [scn, pilot] of cells) for (const seed of SEEDS3) {
      const got = {};
      for (const cfg of ['B', 'C']) {
        const p = await r0Page(browser, cfg, Q[scn], seed);
        got[cfg] = await p.evaluate(({ seed, pilot }) => {
          const T = window.__tac, gs = window.__gs;
          T.begin({ seed, pilot: { mode: pilot }, fire: 7 }); window.__r0.reset();
          const snap = [];
          for (let i = 0; i < 2400; i++) {
            T.step();
            snap.push(gs.enemies.getChildren().filter((e) => e.active && e.alive && e.enemyType === 'sniper' && !e._miniBoss)
              .map((e) => `${Math.round(e.x)},${Math.round(e.y)} side${Math.round(e._stuckSidestepMs > 0 ? e._stuckSidestepMs : 0)} ang:${e._marksmanAngle?.state ?? '-'}${e._marksmanStuck ? ` ms:${JSON.stringify(e._marksmanStuck.log)}` : ''}`).join(' | '));
          }
          return { trace: T.trace.slice(), snap };
        }, { seed, pilot });
        await p.close();
      }
      const d = got.B.trace.findIndex((x, i) => x[0] !== got.C.trace[i]?.[0] || x[1] !== got.C.trace[i]?.[1]);
      const row = { scenario: `${scn}:${pilot}`, seed, divergeTick: d, divergeMs: d < 0 ? '' : ms(d),
        B_at: d < 0 ? '' : got.B.snap[Math.max(0, d - 1)], C_at: d < 0 ? '' : got.C.snap[Math.max(0, d - 1)] };
      rows.push(row);
      log(`diverge ${scn} ${pilot} ${seed}: first differing tick ${d} (${row.divergeMs}ms)\n   B: ${row.B_at}\n   C: ${row.C_at}`);
    }
    writeFileSync(`${RAW}r0-diverge.csv`, toCsv(rows));
  }

  if (ONLY.includes('obstacle')) {
    // THE MARKSMAN STUCK DEPENDENCY, STAGED: the Phase 3C genuine-obstruction
    // cases and movement transitions (an empty room with one wall, the 3C rig
    // and its observe-only audit, unchanged), run with the FULL integration
    // URLs — so T1 is on in both B and C and the only difference is the
    // unapproved `marksmanStuck=early`. A is the production reference.
    const rows = [];
    const MODES3 = ['A', 'B', 'C'];
    const pages = {};
    for (const m of MODES3) pages[m] = await mkPage(browser, CONFIGS[m]);
    const SEEDS = [1001, 8920, 16839];
    for (const [tag, set] of [['obstacle', OBST], ['transition', SC]]) {
      for (const [rk, role] of [['R', MK], ['E', MKE]]) for (const [scn, mk] of Object.entries(set)) for (const seed of SEEDS) {
        const sc = { ...mk(role, seed), trace: true };
        const res = {};
        for (const m of MODES3) res[m] = await pages[m].evaluate((sc) => window.__mkRun(sc), sc);
        for (const m of MODES3) {
          const row = stagedRow(scn, rk, m, seed, res[m], m === 'B' ? null : res.B);   // divergence measured against B
          row.section = `staged-${tag}`; row.config = m;
          if (tag === 'obstacle') Object.assign(row, obstacleExtra(res[m]));
          rows.push(row);
        }
      }
      log(`staged ${tag} done`);
    }
    for (const p of Object.values(pages)) await p.close();
    writeFileSync(`${RAW}r0-staged-marksman.csv`, toCsv(rows));
  }

  if (ONLY.includes('perf')) {
    // the cost of the integration: headless (simulation only) and rendered
    // (simulation + draw), the same fight in each config, nothing else running
    const out = [];
    for (const render of [false, true]) for (const scn of ['mixed', 'p_hangar_s10w1', 'vanguardCaptain']) for (const cfg of ['A', 'B', 'C']) {
      const p = await r0Page(browser, cfg, Q[scn], 1001);
      await p.evaluate((r) => { window.__headless = !r; }, render);
      const res = await runOne(p, { seed: 1001, ticks: render ? 900 : 2400, pilot: { mode: 'handset' }, fire: 7 });
      await p.close();
      const pf = res.r0.perf;
      const row = { render: +render, scenario: scn, config: cfg, ticks: pf.length, liveMean: +(res.r0.live / res.r0.ticks).toFixed(2), liveMax: res.r0.liveMax,
        stepMsMed: +(+qt(pf, 0.5)).toFixed(2), stepMsP95: +(+qt(pf, 0.95)).toFixed(2), stepMsP99: +(+qt(pf, 0.99)).toFixed(2), stepMsMax: +Math.max(...pf).toFixed(1),
        traceHash: res.tac.trace.reduce((h, t) => (h * 31 + t[0] + t[1]) % 1e9, 7) };
      out.push(row);
      log('perf', JSON.stringify(row));
    }
    writeFileSync(`${RAW}r0-perf.csv`, toCsv(out));
  }

  await browser.close();
  log('done');
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
