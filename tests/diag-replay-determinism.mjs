// DIAG: IS A SEEDED REPLAY DETERMINISTIC ON ONE BUILD? — the investigation of
// the P2-A3 section-11 failure ("SWARM TIDE, R1: 1500 ticks identical to the
// previous build", first divergent tick 1280, 2026-11-09; did not reproduce).
//
// It runs the SAME replay smoke-fx-p2a3 section 11 runs (R1, no flags, SWARM
// TIDE s3, seed 9071, FIGHT_SEG movement, fire every 7 ticks, Supers at 700 /
// 1400, melee chains, a rifle pickup at 480, a cluster pod at 1150) N times
// against each URL given, keeps the full per-tick state STRING (not only its
// hash), and reports how many distinct runs each build produced and, for any
// divergence, the first tick and which fields differ.
//
// `--load=K` runs K extra replays concurrently (the full-suite condition); the
// harness is load-sensitive, so a divergence that appears only under load is
// a harness property, not a build difference.
//
// usage: node tests/diag-replay-determinism.mjs [--urls=a,b] [--n=12] [--load=0] [--ticks=1500] [--out=FILE]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { CHROME, bootPage, FIGHT_SEG } from './diag-stuck-audit.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const URLS = opt('urls', 'http://localhost:5173/').split(',');
const N = +opt('n', '12');
const LOAD = +opt('load', '0');
const TICKS = +opt('ticks', '1500');
const OUT = opt('out', null);
const Q = 'encdbg=swarmTide&room=hangar&sector=3';
const SUPER = [700, 1400], MELEE = [320, 345, 370, 1000, 1030], PICK = 480, CLUSTER = 1150;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

async function replay(base) {
  const p = await bootPage(browser, { base, flags: '', baseline: null, q: Q, seed: 4242 });
  await p.evaluate(async () => { window.__WP = (await window.__mod(/entities\/WeaponPickup\.js/))?.WeaponPickup; });
  const r = await p.evaluate(({ seed, ticks, seg, melee, pickAt, clusterAt, superAt }) => {
    const gs = window.__gs, K = gs.keys, cam = gs.cameras.main;
    window.__headless = true;
    let evN = 0; const em = gs.events.emit.bind(gs.events); gs.events.emit = (n, ...a) => { evN++; return em(n, ...a); };
    window.__seed(seed); window.__draws = 0;
    const f = (v) => (Math.round(v * 1000) / 1000).toString();
    const rows = [];
    const t0 = performance.now();
    for (let i = 0; i < ticks; i++) {
      const P = gs.player;
      const cur = seg.find(([a, bb]) => i >= a && i < bb)[2];
      K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
      if (i >= 60 && i % 7 === 0) P.keyboardFire();
      if (superAt.includes(i)) { P.superCharge = 999; P.tryFireSuper(P._autoAimAngle()); }
      if (superAt.map((s) => s - 120).includes(i)) P.superCharge = 999;
      if (melee.includes(i)) { P.meleeCharge = 99; P.tryMeleeCombo(); }
      if (i === pickAt) gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'rifle'));
      if (i === clusterAt) gs.weaponPickups.push(new window.__WP(gs, P.x, P.y, 'cluster'));
      const d0 = window.__draws;
      window.__adv(1);
      const fields = {
        player: `${f(P.x)},${f(P.y)},${P.hp},${P.superCharge},${P.meleeCharge},${P.ammo},${P.secondary},${P.secondaryAmmo},${P.fireCooldown},${P._burstRemaining}`,
        cam: `${f(cam.scrollX)},${f(cam.scrollY)},${f(cam.zoom)}`,
        time: `${f(gs.time.timeScale)},${f(gs.time.now)}`,
        enemies: gs.enemies.getChildren().filter((e) => e.active).map((e) => `${e.enemyType}:${f(e.x)},${f(e.y)},${Math.round(e.hp)},${e.state}`).join(';'),
        bullets: [...gs.hostileBullets, gs.playerBullets, gs.playerRifleBullets, gs.playerSuperBullets].map((g) => (g?.getChildren?.() || []).filter((bb) => bb.active).length).join('/'),
        draws: `${window.__draws}(+${window.__draws - d0})`,
        events: String(evN),
      };
      rows.push(fields);
    }
    K.A.isDown = K.D.isDown = K.W.isDown = K.S.isDown = false;
    return { rows, ms: performance.now() - t0 };
  }, { seed: 9071, ticks: TICKS, seg: FIGHT_SEG, melee: MELEE, pickAt: PICK, clusterAt: CLUSTER, superAt: SUPER });
  await p.close();
  return r;
}
const key = (row) => Object.values(row).join('|');
function firstDiff(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (!a[i] || !b[i] || key(a[i]) !== key(b[i])) {
      const fields = a[i] && b[i] ? Object.keys(a[i]).filter((k) => a[i][k] !== b[i][k]) : ['length'];
      return { tick: i, fields, a: a[i], b: b[i], prev: a[i - 1] };
    }
  }
  return null;
}

const report = {};
for (const url of URLS) {
  const runs = [];
  for (let k = 0; k < N; k++) {
    const jobs = [replay(url)];
    for (let j = 0; j < LOAD; j++) jobs.push(replay(url));
    const res = await Promise.all(jobs);
    runs.push(...res);
    process.stdout.write(`.${res.length > 1 ? `(${res.length})` : ''}`);
  }
  const ref = runs[0].rows;
  const classes = new Map();
  const diffs = [];
  runs.forEach((r, i) => {
    const sig = key(r.rows.at(-1)) + r.rows.length;
    classes.set(sig, (classes.get(sig) || 0) + 1);
    const d = firstDiff(ref, r.rows);
    if (d) diffs.push({ run: i, ...d });
  });
  report[url] = { runs: runs.length, distinctFinal: classes.size, classSizes: [...classes.values()], meanMs: runs.reduce((s, r) => s + r.ms, 0) / runs.length, diffs };
  console.log(`\n${url}: ${runs.length} replays (load ${LOAD}), ${classes.size} distinct outcome(s) ${JSON.stringify([...classes.values()])}, mean ${(report[url].meanMs / 1000).toFixed(1)}s`);
  for (const d of diffs.slice(0, 5)) console.log(`  run ${d.run}: first divergent tick ${d.tick}, fields ${d.fields.join(',')}\n    ref ${JSON.stringify(d.a).slice(0, 400)}\n    got ${JSON.stringify(d.b).slice(0, 400)}`);
}
if (URLS.length === 2) {
  const [a, b] = URLS;
  console.log(`\ncross-build: ${report[a].distinctFinal === 1 && report[b].distinctFinal === 1 ? 'each build is self-consistent' : 'at least one build is NOT self-consistent'}`);
}
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 1));
await browser.close();
