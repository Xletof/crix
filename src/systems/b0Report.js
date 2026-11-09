// ── B0 — RUN STORE, END-OF-RUN SUMMARY AND MOBILE EXPORT ────────────────────
//
// The DOM half of the B0 instrument (`?b0=…`). Everything here lives OUTSIDE
// the Phaser canvas — plain HTML elements over the page — so it draws nothing
// in the game, consumes no `Math.random` and cannot change the fight.
//
// DURING PLAY there is exactly one element on screen: a small, untappable run
// tag at the bottom centre ("B0·A #3  02:41") whose clock is the run's WALL time.
// It is there so a screen recording carries the run identity and a clock that
// matches the exported timeline (`timeline[i][0]` is the same wall ms).
//
// OUTSIDE PLAY (title, game over, pause menu) a "B0 DATA" button opens the
// report: the summary, and Share / Download / Copy for the machine-readable
// JSON. It opens by itself when a run ends in defeat. Runs are kept in
// localStorage (newest 6), and the run in progress is autosaved every 15s and
// when the page is hidden, so a closed tab or a crash keeps its data.
import { getB0Label } from './debug.js';
import { histPct } from './b0Telemetry.js';

const KEY_RUNS = 'crix.b0.runs.v1';
const KEY_LIVE = 'crix.b0.live.v1';
const KEY_N = 'crix.b0.n.v1';
const KEEP = 6;

// ── MEASUREMENT DEFINITIONS (exported with every run) ─────────────────────
export const B0_DEFINITIONS = {
  clocks: 'gameMs = Phaser scene clock since run start (stops while paused, slows in slow-mo). wallMs = real time since run start (keeps running while paused); the on-screen tag shows wallMs, and timeline rows are [wallMs, gameMs, code, ...].',
  sources: 'standard = ordinary primary fire (the pistol mechanics; drawn as the carbine under P2-A2/P2-A3). override = the rifle pickup\'s 3-round burst (27 rounds). cluster = the cluster pod and its fragments. super = Super pellets. melee = the Broken Wings chain. volatile = a nemesis corpse blast. other = anything not caused by the player (e.g. Vader\'s sunder).',
  damage: 'dmg = durability actually removed (hp, plus armour for the Shock Captain). overkill = requested minus removed on the killing blow; never added to dmg. A shield block removes nothing and is counted under blocked, not dmg.',
  hits: 'hits = damage events that removed durability, one per projectile per enemy (Super pellets pierce, so one pellet can hit several enemies). fired.standard counts shots that left the gun; fired.super counts pellets.',
  ttk: 'spawnToDeath = death - first frame the enemy existed. seenToDeath = death - first frame it was inside the camera view. firstDmgToDeath = death - first durability removed. Survivors (alive at run end or removed by a room change) are never in a TTK figure.',
  attacks: 'attacks.shots = shots the enemy fired (shooter-fire / Captain rounds). contactCalls / bulletCalls = times its melee/contact or its bolt reached player.damage (including hits negated by dash, melee i-frames or god mode). moves = scripted boss/nemesis moves started.',
  incoming: 'requested = damage asked of the player; shieldAbsorbed and hpRemoved are what the shield and hp pools actually lost; negated = calls that removed nothing (dash i-frames, melee i-frames, god mode). Sources ending in "?" are inferred (no carried attribution).',
  ammo: 'emptyMs = alive time with 0 STANDARD ammo; fullMs = alive time with a full magazine (reload capacity unused). tryRefusedEmpty = fire presses refused for no ammo (dry fire). ammoGained = rounds restored by the reload (and by refills).',
  abilities: 'chargeMs = time from the previous spend (or run start) to the meter filling. readyToCast = time the meter sat full before it was spent. A melee chain = its first cast (the one that spends the meter).',
  perf: 'frameMs = raw rAF frame time histogram (1ms bins). overheadUs = time spent inside B0 code per frame (microseconds). saveMs = autosave cost.',
};

let C = null;
export function b0Store() {
  if (!C) C = makeController();
  return C;
}

// ── helpers ────────────────────────────────────────────────────────────────
const med = (a) => { if (!a || !a.length) return null; const s = [...a].sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
const mean = (a) => (a && a.length ? a.reduce((p, c) => p + c, 0) / a.length : null);
const sum = (o) => Object.values(o || {}).reduce((p, c) => p + (c || 0), 0);
const s1 = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`);
const pct = (a, b) => (b > 0 ? `${Math.round((100 * a) / b)}%` : '—');
const n0 = (v) => (v == null ? '—' : String(Math.round(v)));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clock = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

const ROLE = {
  grunt: 'Rifleman', shooter: 'Gunner', bomber: 'Demolisher', shielded: 'Bulwark',
  sniper: 'Marksman', swarmling: 'Swarmling', vader: 'Vader', champion: 'Champion',
};
function groupKey(e) {
  if (e.kind === 'vader') return 'Vader';
  if (e.nemesis) return `Nemesis (${ROLE[e.type] || e.type})`;
  if (e.champion) return 'Shock Captain';
  return `${ROLE[e.type] || e.type}${e.elite ? ' Elite' : ''}`;
}

/** The numbers the report shows, computed from an exported run (pure). */
export function summarize(run) {
  const P = run.player, I = run.incoming;
  const groups = {};
  for (const e of run.enemies) {
    const k = groupKey(e);
    const g = groups[k] || (groups[k] = { n: 0, killed: 0, takedown: 0, wounded: 0, survived: 0, despawned: 0,
      spawnToDeath: [], seenToDeath: [], firstDmgToDeath: [], hitsToKill: [], stdHitsToKill: [], attacks: [],
      blocks: 0, dmgToPlayer: 0, hpMax: [], overkill: 0, killSrc: {} });
    g.n++;
    if (e.fate === 'killed' || e.fate === 'wounded' || e.fate === 'takedown') {
      g[e.fate === 'killed' ? 'killed' : e.fate]++;
      g.spawnToDeath.push(e.deathT - e.spawnT);
      if (e.seenT != null) g.seenToDeath.push(e.deathT - e.seenT);
      if (e.firstDmgT != null) g.firstDmgToDeath.push(e.deathT - e.firstDmgT);
      g.hitsToKill.push(sum(e.hits));
      const others = sum(e.dmg) - (e.dmg.standard || 0);
      if (others <= 0 && e.hits.standard > 0) g.stdHitsToKill.push(e.hits.standard);
      g.attacks.push((e.attacks.shots || 0) + (e.attacks.contactCalls || 0) + (e.attacks.moves || 0));
      g.killSrc[e.killSrc] = (g.killSrc[e.killSrc] || 0) + 1;
    } else if (e.fate === 'despawned') g.despawned++;
    else g.survived++;
    g.blocks += sum(e.blocks); g.dmgToPlayer += e.dmgToPlayer || 0; g.hpMax.push(e.hpMax); g.overkill += sum(e.overkill);
  }
  const ttk = Object.entries(groups).map(([k, g]) => ({
    group: k, n: g.n, killed: g.killed + g.takedown + g.wounded, takedowns: g.takedown, survived: g.survived + g.despawned,
    hpMaxMed: med(g.hpMax), spawnToDeathMed: med(g.spawnToDeath), seenToDeathMed: med(g.seenToDeath),
    firstDmgToDeathMed: med(g.firstDmgToDeath), firstDmgToDeathMax: g.firstDmgToDeath.length ? Math.max(...g.firstDmgToDeath) : null,
    hitsToKillMean: mean(g.hitsToKill), stdOnlyKills: g.stdHitsToKill.length, stdHitsToKillMed: med(g.stdHitsToKill),
    attacksBeforeDeathMean: mean(g.attacks), blocks: g.blocks, dmgToPlayer: g.dmgToPlayer, killSrc: g.killSrc,
  })).sort((a, b) => b.n - a.n);

  const S = P.standard;
  const ivMed = histPct(S.intervals, 0.5);
  const totalDmg = sum(P.dmg);
  const sources = ['standard', 'override', 'cluster', 'super', 'melee', 'volatile', 'other'].map((k) => ({
    src: k, fired: P.fired[k] || 0, hits: P.hits[k] || 0, blocked: P.blocked[k] || 0, deflected: P.deflected[k] || 0,
    dmg: P.dmg[k] || 0, share: totalDmg > 0 ? (P.dmg[k] || 0) / totalDmg : 0, overkill: P.overkill[k] || 0, kills: P.kills[k] || 0,
  }));
  const std = {
    fired: P.fired.standard, hits: P.hits.standard, blocked: P.blocked.standard, deflected: P.deflected.standard,
    missed: Math.max(0, P.fired.standard - P.hits.standard - P.blocked.standard - P.deflected.standard),
    accuracy: P.fired.standard > 0 ? P.hits.standard / P.fired.standard : null,
    intervalMed: ivMed, intervalP10: histPct(S.intervals, 0.1), intervalP90: histPct(S.intervals, 0.9),
    shotsPerMinCombat: S.combatMs > 0 ? (S.combatShots / S.combatMs) * 60000 : null,
    dpsCombat: S.combatMs > 0 ? (S.combatDmg / S.combatMs) * 1000 : null,
    emptyFrac: S.ammoSampleMs > 0 ? S.emptyMs / S.ammoSampleMs : null,
    fullFrac: S.ammoSampleMs > 0 ? S.fullMs / S.ammoSampleMs : null,
    meanAmmo: S.ammoSampleMs > 0 ? S.ammoIntegral / S.ammoSampleMs : null,
    dryFire: S.tryRefusedEmpty, cooldownRefused: S.tryRefusedCooldown, ammoGained: S.reloads, combatMs: S.combatMs,
    theoreticalMaxShotsPerMin: 60000 / run.run.tuning.ammoReloadMs,
  };
  const iv = (a) => { const o = []; for (let i = 1; i < a.length; i++) o.push(a[i] - a[i - 1]); return o; };
  const sup = P.super, mel = P.melee;
  const abilities = {
    super: { readies: sup.readies, casts: sup.casts, pellets: sup.pellets, denied: sup.denied,
      hits: P.hits.super, dmg: P.dmg.super, kills: P.kills.super, share: totalDmg ? P.dmg.super / totalDmg : 0,
      intervalMed: med(iv(sup.castAt)), chargeMed: med(sup.chargeMs), readyToCastMed: med(sup.readyToCast),
      perCastMed: med(sup.perCast), perCastMax: sup.perCast.length ? Math.max(...sup.perCast) : null,
      pelletHitRate: sup.pellets ? P.hits.super / sup.pellets : null,
      perMin: run.clock.gameMs > 0 ? sup.casts / (run.clock.gameMs / 60000) : null },
    melee: { readies: mel.readies, chains: mel.chains, casts: mel.casts, finishers: mel.finishers,
      hits: P.hits.melee, dmg: P.dmg.melee, kills: P.kills.melee, share: totalDmg ? P.dmg.melee / totalDmg : 0,
      intervalMed: med(iv(mel.castAt)), chargeMed: med(mel.chargeMs), readyToCastMed: med(mel.readyToCast),
      perMin: run.clock.gameMs > 0 ? mel.chains / (run.clock.gameMs / 60000) : null },
    override: { ...P.override, hits: P.hits.override, dmg: P.dmg.override, kills: P.kills.override },
    cluster: { ...P.cluster, hits: P.hits.cluster, dmg: P.dmg.cluster, kills: P.kills.cluster },
  };
  const waves = run.waves.map((w) => ({ i: w.i, sector: w.sector, room: w.room, enc: w.encounterName || w.encounter, wave: `${w.waveIdx}/${w.waveTotal}`,
    durMs: w.durMs, spawned: w.spawned, killed: w.killed, maxAlive: w.maxAlive, meanAlive: w.meanAlive, dmgTaken: w.dmgTaken, shieldTaken: w.shieldTaken, deaths: w.deaths, endWhy: w.endWhy }));
  const fm = run.perf.frameMs;
  const perf = {
    frames: run.perf.frames, frameMed: histPct(fm, 0.5), frameP95: histPct(fm, 0.95), frameP99: histPct(fm, 0.99), frameMax: fm.max,
    fpsMed: histPct(fm, 0.5) ? 1000 / Math.max(1, histPct(fm, 0.5)) : null, longFrames: run.perf.longFrames.length,
    overheadMeanUs: run.perf.overheadUs.n ? run.perf.overheadUs.sum / run.perf.overheadUs.n : null,
    overheadP99Us: histPct(run.perf.overheadUs, 0.99),
    overheadShare: fm.sum > 0 ? run.perf.overheadTotalMs / fm.sum : null,
    saveMed: histPct(run.perf.saveMs, 0.5), saveMax: run.perf.saveMs.max, errors: run.errors || 0,
  };
  return { ttk, std, sources, totalDmg, abilities, incoming: I, waves, perf };
}

function renderHTML(run) {
  const m = summarize(run);
  const r = run.run;
  const row = (cells, th = false) => `<tr>${cells.map((c) => (th ? `<th scope="col">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('')}</tr>`;
  const table = (head, rows) => `<div class="b0-tw"><table>${row(head, true)}${rows.map((x) => row(x)).join('')}</table></div>`;
  const inc = m.incoming;
  const incRows = Object.entries(inc.bySource).sort((a, b) => (b[1].hp + b[1].shield) - (a[1].hp + a[1].shield))
    .map(([k, v]) => [k, v.calls, v.negated, n0(v.shield), n0(v.hp)]);
  return `
  <h1 id="b0-title">B0 run ${esc(r.label ? `${r.label} ` : '')}#${r.n}</h1>
  <p class="b0-meta">id <b>${esc(r.id)}</b> · build <b>${esc(r.build)}</b> · ${esc(r.endReason)}<br>
  started ${esc(r.startedAt)} · wall ${clock(run.clock.wallMs)} (paused ${clock(run.clock.pausedWallMs)}) · game ${clock(run.clock.gameMs)}<br>
  rooms ${run.rooms.length} · waves ${run.waves.length} · sector ${esc(run.rooms.at(-1)?.sector ?? '—')} · seed ${esc(r.seed)}<br>
  <span class="b0-q">${esc(r.query || '(no flags)')}</span></p>

  <h2>Enemy TTK (killed only; survivors counted apart)</h2>
  ${table(['group', 'n', 'killed', 'surv.', 'hp', 'spawn→death', 'seen→death', '1st dmg→death', 'hits/kill', 'std-only kills · hits', 'attacks before death', 'blocks', 'dmg to you'],
    m.ttk.map((g) => [g.group, g.n, g.killed, g.survived, n0(g.hpMaxMed), s1(g.spawnToDeathMed), s1(g.seenToDeathMed), s1(g.firstDmgToDeathMed),
      g.hitsToKillMean == null ? '—' : g.hitsToKillMean.toFixed(1), `${g.stdOnlyKills} · ${g.stdHitsToKillMed ?? '—'}`,
      g.attacksBeforeDeathMean == null ? '—' : g.attacksBeforeDeathMean.toFixed(1), g.blocks, n0(g.dmgToPlayer)]))}

  <h2>STANDARD gun</h2>
  ${table(['fired', 'hit', 'blocked', 'deflected', 'missed', 'accuracy', 'interval p10/med/p90', 'shots/min in combat', 'max shots/min (reload)', 'dps in combat', 'empty', 'full', 'mean ammo', 'dry presses'],
    [[m.std.fired, m.std.hits, m.std.blocked, m.std.deflected, m.std.missed, m.std.accuracy == null ? '—' : pct(m.std.hits, m.std.fired),
      `${m.std.intervalP10 ?? '—'}/${m.std.intervalMed ?? '—'}/${m.std.intervalP90 ?? '—'} ms`, n0(m.std.shotsPerMinCombat), n0(m.std.theoreticalMaxShotsPerMin),
      n0(m.std.dpsCombat), m.std.emptyFrac == null ? '—' : pct(m.std.emptyFrac, 1), m.std.fullFrac == null ? '—' : pct(m.std.fullFrac, 1),
      m.std.meanAmmo == null ? '—' : m.std.meanAmmo.toFixed(2), m.std.dryFire]])}

  <h2>Damage by source (durability actually removed)</h2>
  ${table(['source', 'fired', 'hits', 'blocked', 'dmg', 'share', 'overkill (not in dmg)', 'kills'],
    m.sources.filter((s) => s.fired || s.hits || s.dmg || s.kills || s.blocked).map((s) => [s.src, s.fired, s.hits, s.blocked, n0(s.dmg), pct(s.share, 1), n0(s.overkill), s.kills]))}
  <p class="b0-meta">total removed ${n0(m.totalDmg)} · takedowns ${run.player.takedowns}</p>

  <h2>Abilities</h2>
  ${table(['ability', 'ready', 'spent', 'charge (med)', 'held ready (med)', 'interval (med)', 'per min', 'hits', 'dmg', 'share', 'kills'],
    [['Super', m.abilities.super.readies, m.abilities.super.casts, s1(m.abilities.super.chargeMed), s1(m.abilities.super.readyToCastMed), s1(m.abilities.super.intervalMed),
      m.abilities.super.perMin == null ? '—' : m.abilities.super.perMin.toFixed(1), m.abilities.super.hits, n0(m.abilities.super.dmg), pct(m.abilities.super.share, 1), m.abilities.super.kills],
    ['Melee chain', m.abilities.melee.readies, m.abilities.melee.chains, s1(m.abilities.melee.chargeMed), s1(m.abilities.melee.readyToCastMed), s1(m.abilities.melee.intervalMed),
      m.abilities.melee.perMin == null ? '—' : m.abilities.melee.perMin.toFixed(1), m.abilities.melee.hits, n0(m.abilities.melee.dmg), pct(m.abilities.melee.share, 1), m.abilities.melee.kills]])}
  <p class="b0-meta">Super: ${m.abilities.super.pellets} pellets, pellet hit rate ${m.abilities.super.pelletHitRate == null ? '—' : pct(m.abilities.super.pelletHitRate, 1)}, dmg per cast med ${n0(m.abilities.super.perCastMed)} / best ${n0(m.abilities.super.perCastMax)} (approx.), denied ${m.abilities.super.denied}.
  OVERRIDE: ${m.abilities.override.pickups} pickups, ${m.abilities.override.bursts} bursts, ${m.abilities.override.rounds} rounds, ${m.abilities.override.hits} hits, ${n0(m.abilities.override.dmg)} dmg, ${m.abilities.override.kills} kills, held ${s1(m.abilities.override.heldMs)}.
  CLUSTER: ${m.abilities.cluster.pickups} pickups, ${m.abilities.cluster.throws} throws, ${m.abilities.cluster.hits} hits, ${n0(m.abilities.cluster.dmg)} dmg, ${m.abilities.cluster.kills} kills.</p>

  <h2>Incoming damage</h2>
  <p class="b0-meta">deaths ${inc.deaths} · requested ${n0(inc.requested)} · shield ${n0(inc.shieldAbsorbed)} · hp ${n0(inc.hpRemoved)} · negated ${inc.negated}/${inc.calls}</p>
  ${table(['source', 'calls', 'negated', 'shield', 'hp'], incRows)}

  <h2>Waves</h2>
  ${table(['#', 'sector', 'room', 'encounter', 'wave', 'duration', 'spawned', 'killed', 'max alive', 'mean alive', 'hp taken', 'deaths', 'end'],
    m.waves.map((w) => [w.i, w.sector, w.room, w.enc, w.wave, s1(w.durMs), w.spawned, w.killed, w.maxAlive, w.meanAlive, n0(w.dmgTaken), w.deaths, w.endWhy]))}

  <h2>Performance</h2>
  <p class="b0-meta">${m.perf.frames} frames · frame med ${m.perf.frameMed ?? '—'}ms (≈${m.perf.fpsMed ? m.perf.fpsMed.toFixed(0) : '—'} fps) · p95 ${m.perf.frameP95 ?? '—'} · p99 ${m.perf.frameP99 ?? '—'} · max ${Math.round(m.perf.frameMax)}ms · frames &gt;100ms ${m.perf.longFrames}<br>
  B0 overhead: mean ${m.perf.overheadMeanUs == null ? '—' : m.perf.overheadMeanUs.toFixed(0)}µs/frame · p99 ${m.perf.overheadP99Us ?? '—'}µs · ${m.perf.overheadShare == null ? '—' : (m.perf.overheadShare * 100).toFixed(2)}% of frame time · autosave med ${m.perf.saveMed ?? '—'}ms max ${Math.round(m.perf.saveMax)}ms · instrument errors ${m.perf.errors}</p>`;
}

function renderText(run) {
  const div = document.createElement('div');
  div.innerHTML = renderHTML(run).replace(/<\/(td|th)>/g, ' | </$1>').replace(/<\/(tr|p|h1|h2)>/g, '\n</$1>').replace(/<br>/g, '\n');
  return div.textContent.replace(/\n\s*\n+/g, '\n\n').trim();
}

// ── THE CONTROLLER ─────────────────────────────────────────────────────────
function makeController() {
  const label = getB0Label();
  let current = null;            // { api, R } of the running run
  let paused = false;
  const memRuns = [];            // this page's finished runs (also stored)
  let lastSaveAt = performance.now();

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (_) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (_) { /* */ } },
  };
  const readRuns = () => { try { return JSON.parse(ls.get(KEY_RUNS) || '[]'); } catch (_) { return []; } };
  function writeRuns(arr) {
    let a = arr.slice(-KEEP);
    while (a.length) {
      if (ls.set(KEY_RUNS, JSON.stringify(a))) return true;
      a = a.slice(1);              // quota: drop the oldest and retry
    }
    return false;
  }
  function storeRun(rec) {
    const arr = readRuns().filter((x) => x?.run?.id !== rec.run.id);
    arr.push(rec);
    writeRuns(arr);
    return rec;
  }
  // A run that was in progress when the page went away.
  const orphan = ls.get(KEY_LIVE);
  if (orphan) {
    try { const rec = JSON.parse(orphan); rec.run.endReason = 'interrupted (page closed or reloaded mid-run)'; rec.definitions = B0_DEFINITIONS; storeRun(rec); } catch (_) { /* */ }
    ls.del(KEY_LIVE);
  }

  // ── DOM ─────────────────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
  #b0-tag{position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 2px);left:50%;transform:translateX(-50%);z-index:40;
    font:600 11px/1.3 ui-monospace,Menlo,Consolas,monospace;color:rgba(235,240,245,.85);background:rgba(0,0,0,.45);
    padding:1px 6px;border-radius:4px;pointer-events:none;white-space:nowrap;display:none;letter-spacing:.02em}
  #b0-btn{position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);left:8px;z-index:41;display:none;
    font:700 14px/1 system-ui,sans-serif;color:#0b0d12;background:#9fe0ff;border:0;border-radius:8px;padding:12px 14px;min-height:44px}
  #b0-panel{position:fixed;inset:0;z-index:42;display:none;background:#0b0d12f2;color:#e8edf2;overflow:auto;-webkit-overflow-scrolling:touch;
    touch-action:pan-x pan-y;user-select:text;-webkit-user-select:text;font:14px/1.45 system-ui,sans-serif;
    padding:calc(env(safe-area-inset-top,0px) + 12px) 12px calc(env(safe-area-inset-bottom,0px) + 24px)}
  #b0-panel h1{font-size:20px;margin:6px 0}#b0-panel h2{font-size:16px;margin:18px 0 6px;color:#9fe0ff}
  #b0-panel .b0-meta{margin:4px 0;color:#c9d2db;font-size:13px}#b0-panel .b0-q{word-break:break-all;color:#8fa0b0}
  #b0-panel .b0-tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
  #b0-panel table{border-collapse:collapse;font-size:12.5px;min-width:100%}
  #b0-panel th,#b0-panel td{border:1px solid #2a3440;padding:4px 6px;text-align:left;white-space:nowrap}
  #b0-panel th{background:#16202a;color:#cfe8f6;font-weight:600}
  #b0-bar{position:sticky;top:0;background:#0b0d12;padding:6px 0 8px;display:flex;flex-wrap:wrap;gap:8px;border-bottom:1px solid #2a3440;z-index:1}
  #b0-bar button,#b0-bar select{font:600 14px system-ui,sans-serif;min-height:44px;padding:8px 12px;border-radius:8px;border:1px solid #3a4856;background:#16202a;color:#e8edf2}
  #b0-bar button.b0-primary{background:#9fe0ff;color:#0b0d12;border-color:#9fe0ff}
  #b0-status{font-size:13px;color:#9fe0ff;min-height:18px;margin-top:6px}`;
  document.head.appendChild(css);
  const tag = document.createElement('div'); tag.id = 'b0-tag'; tag.setAttribute('aria-hidden', 'true');
  const btn = document.createElement('button'); btn.id = 'b0-btn'; btn.type = 'button'; btn.textContent = 'B0 DATA';
  const panel = document.createElement('div'); panel.id = 'b0-panel';
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'b0-title');
  document.body.append(tag, btn, panel);
  // The panel and button must not leak touches to the game underneath.
  for (const el of [btn, panel]) for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });

  let shown = null;              // the run record on the panel
  function allRuns() {
    const seen = new Set(); const out = [];
    for (const r of [...readRuns(), ...memRuns]) { if (!r?.run?.id || seen.has(r.run.id)) continue; seen.add(r.run.id); out.push(r); }
    if (current) { const live = current.api.snapshot(); live.definitions = B0_DEFINITIONS; out.push(live); }
    return out.sort((a, b) => (a.run.startedAt < b.run.startedAt ? -1 : 1));
  }
  const fileName = (rec) => `crix-b0-${rec.run.label || 'run'}-${rec.run.n}-${rec.run.id}.json`;
  const status = (t) => { const el = panel.querySelector('#b0-status'); if (el) el.textContent = t; };

  async function share(rec) {
    const json = JSON.stringify(rec);
    try {
      const file = new File([json], fileName(rec), { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `CRIX B0 ${rec.run.label || ''} #${rec.run.n}` });
        status('Shared.'); return;
      }
    } catch (err) { if (err && err.name === 'AbortError') { status('Share cancelled.'); return; } }
    download(rec); status('This browser cannot share files — downloaded instead.');
  }
  function download(rec) {
    const blob = new Blob([JSON.stringify(rec)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = fileName(rec);
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    status(`Downloaded ${fileName(rec)}`);
  }
  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); status(`${what} copied (${Math.round(text.length / 1024)} KB).`); return; } catch (_) { /* fallback */ }
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
    panel.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* */ }
    ta.remove(); status(ok ? `${what} copied.` : `Copy failed — use Share or Download.`);
  }

  function open(rec) {
    const runs = allRuns();
    shown = rec || runs.at(-1) || null;
    const opts = runs.map((r) => `<option value="${esc(r.run.id)}"${shown && r.run.id === shown.run.id ? ' selected' : ''}>${esc(`${r.run.label || '-'} #${r.run.n} · ${r.run.startedAt.slice(5, 16).replace('T', ' ')} · ${r.run.endReason}`)}</option>`).join('');
    panel.innerHTML = `<div id="b0-bar">
      <button type="button" class="b0-primary" data-a="share">Share JSON</button>
      <button type="button" data-a="dl">Download JSON</button>
      <button type="button" data-a="copy">Copy JSON</button>
      <button type="button" data-a="text">Copy summary</button>
      <button type="button" data-a="close">Close</button>
      <select aria-label="Run" data-a="pick">${opts}</select>
      <button type="button" data-a="clear">Delete stored runs</button>
      <div id="b0-status" role="status" aria-live="polite" style="flex-basis:100%"></div></div>
      ${shown ? renderHTML(shown) : '<p>No B0 run recorded yet. Start a run; the report opens here when it ends.</p>'}`;
    panel.style.display = 'block';
    panel.scrollTop = 0;
    panel.querySelector('[data-a="close"]').focus?.();
  }
  function close() { panel.style.display = 'none'; panel.innerHTML = ''; shown = null; }
  panel.addEventListener('click', (e) => {
    const a = e.target?.closest?.('[data-a]')?.dataset?.a;
    if (!a) return;
    if (a === 'close') close();
    else if (a === 'share' && shown) share(shown);
    else if (a === 'dl' && shown) download(shown);
    else if (a === 'copy' && shown) copy(JSON.stringify(shown), 'JSON');
    else if (a === 'text' && shown) copy(renderText(shown), 'Summary');
    else if (a === 'clear') {
      if (confirm('Delete all stored B0 runs on this device? Export anything you need first.')) { ls.del(KEY_RUNS); memRuns.length = 0; open(); status('Stored runs deleted.'); }
    }
  });
  panel.addEventListener('change', (e) => {
    if (e.target?.dataset?.a !== 'pick') return;
    const r = allRuns().find((x) => x.run.id === e.target.value);
    if (r) open(r);
  });
  btn.addEventListener('click', () => open());

  // ── VISIBILITY + RUN CLOCK (DOM timers only) ────────────────────────────
  const sceneActive = (k) => { try { return !!window.game?.scene?.isActive(k); } catch (_) { return false; } };
  function refresh() {
    const playing = !!current && !paused;
    tag.style.display = current ? 'block' : 'none';
    if (current) tag.textContent = `B0${label ? `·${label}` : ''} #${current.R.run.n}  ${clock(performance.now() - current.wall0)}`;
    const pauseMenu = paused && sceneActive('Pause');
    btn.style.display = (!playing && (!current || pauseMenu) && panel.style.display !== 'block') ? 'block' : 'none';
    if (current && performance.now() - lastSaveAt > 15000) saveLive();
  }
  setInterval(refresh, 250);
  function saveLive() {
    if (!current) return;
    lastSaveAt = performance.now();
    const s = performance.now();
    try { ls.set(KEY_LIVE, JSON.stringify(current.api.snapshot())); } catch (_) { /* */ }
    const ms = performance.now() - s;
    try { const h = current.R.perf.saveMs; h.n++; h.sum += ms; if (ms > h.max) h.max = ms; const i = Math.floor(ms); if (i > h.maxMs) h.over++; else h.bins[i]++; } catch (_) { /* */ }
  }
  const onHide = () => { if (document.visibilityState === 'hidden') saveLive(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', saveLive);

  return {
    label,
    nextRunNumber() { const n = (parseInt(ls.get(KEY_N) || '0', 10) || 0) + 1; ls.set(KEY_N, String(n)); return n; },
    startRun(api, R) {
      current = { api, R, wall0: performance.now() - (R.clock.wallMs || 0) };
      paused = false; lastSaveAt = performance.now();
      if (panel.style.display === 'block') close();
      refresh();
    },
    finishRun(rec) {
      rec.definitions = B0_DEFINITIONS;
      current = null; paused = false;
      ls.del(KEY_LIVE);
      memRuns.push(rec);
      storeRun(rec);
      refresh();
      // Restart vs quit vs game over is only known once the next scene is up.
      setTimeout(() => {
        if (rec.run.endReason === 'ended') {
          rec.run.endReason = sceneActive('Game') ? 'restart' : sceneActive('Title') ? 'quit' : sceneActive('GameOver') ? 'game-over' : 'ended';
          storeRun(rec);
        }
        if (rec.run.endReason === 'defeat' || rec.run.endReason === 'game-over') open(rec);
      }, 400);
    },
    onPause() { paused = true; setTimeout(refresh, 80); },
    onResume() { paused = false; if (panel.style.display === 'block') close(); refresh(); },
    // test / diagnostics surface
    _open: open, _close: close, _runs: allRuns, _summarize: summarize, _text: renderText, _saveLive: saveLive,
  };
}
