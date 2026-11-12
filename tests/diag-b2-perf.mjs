// DIAG: B2-1 — WHAT THE FLAGSHIP PRESENTATION COSTS (`?b2=`).
// Standalone, :5173. NOT a pass/fail suite and NOT a handset measurement: the
// harness renders through software GL, so absolute frame times mean nothing.
// It answers three RELATIVE questions on one seeded fight, rendered, at a
// phone-sized viewport:
//
//   1  what a whole rendered frame costs with the stream running under B2,
//      against the same fight on the approved V2C+P1+P2-A3 presentation
//      (STANDARD fired as fast as R1 allows) and on B1-G's held trigger
//   2  what B2's own post-update costs (its own timer, per frame)
//   3  how many display objects and live particles each build carries
//
// usage: node tests/diag-b2-perf.mjs [--ticks=900] [--cpu=4]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME, FIGHT_SEG } from './diag-stuck-audit.mjs';

const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const TICKS = +opt('ticks', '900'), CPU = +opt('cpu', '4');
const VIS = 'visualPilot=v2c&polish=p1&fxPilot=p2a3';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });

async function run(label, flags) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`http://localhost:5173/?nodlg=1&nofreeze=1&${flags}&encdbg=mixed&room=hangar&sector=4`);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const r = await page.evaluate(async ({ ticks, seg }) => {
    const g = window.game; g.loop.sleep();
    let s = 12345; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    let t = 1e5; Date.now = () => t;
    const step = () => { t += 1000 / 60; g.step(t, 1000 / 60); };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); step(); step();
    const u = performance.getEntriesByType('resource').map((q) => q.name).find((n) => /systems\/debug\.js/.test(n)); (await import(u)).setGodMode(true);
    const gs = g.scene.getScene('Game');
    for (let i = 0; i < 400 && !gs.roomSpec; i++) step();
    for (let i = 0; i < 30; i++) step();
    s = 9071;
    const K = gs.keys, P = gs.player, times = [];
    let objs = 0, parts = 0, n = 0;
    for (let i = 0; i < ticks; i++) {
      const cur = seg.find(([a, b]) => i >= a && i < b)[2];
      K.A.isDown = cur.includes('A'); K.D.isDown = cur.includes('D'); K.W.isDown = cur.includes('W'); K.S.isDown = cur.includes('S');
      const firing = i % 300 < 260;
      if (gs._b2 || gs._b1) gs.cursors.space.isDown = firing; else if (firing && i % 7 === 0) P.keyboardFire();
      if (i % 240 === 200) { P.superCharge = 99; P.tryFireSuper(P._autoAimAngle()); }
      const t0 = performance.now(); step(); times.push(performance.now() - t0);
      if (i % 10 === 0) { n++; objs += gs.children.list.length; parts += gs.children.list.reduce((a, o) => a + (o.type === 'ParticleEmitter' ? (o.getAliveParticleCount?.() || 0) : 0), 0); }
    }
    times.sort((a, b) => a - b);
    const q = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))];
    const f = gs._b2?.stats?.feel;
    return { mean: times.reduce((a, b) => a + b, 0) / times.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), objs: objs / n, parts: parts / n, kills: gs.runKills,
      shots: gs._b2 ? gs._b2.stats.shots : null, feel: f ? { usMean: (f.updMs / f.updN) * 1000, msMax: f.updMax, peakObjects: f.peakObjects, peakRounds: f.peakRounds } : null };
  }, { ticks: TICKS, seg: FIGHT_SEG });
  await ctx.close();
  console.log(`${label.padEnd(34)} frame mean ${r.mean.toFixed(2)}ms  p50 ${r.p50.toFixed(2)}  p95 ${r.p95.toFixed(2)}  p99 ${r.p99.toFixed(2)} | display objects ${r.objs.toFixed(0)}  live particles ${r.parts.toFixed(0)} | kills ${r.kills}${r.shots != null ? `  rounds ${r.shots}` : ''}${r.feel ? ` | B2 post-update ${r.feel.usMean.toFixed(0)}us mean, ${r.feel.msMax.toFixed(2)}ms max; peak ${r.feel.peakObjects} pooled objects, ${r.feel.peakRounds} streaks` : ''}`);
  return r;
}
console.log(`MIXED s4, seeded, rendered at 390x844 @2x, software GL, CPU throttle x${CPU}, ${TICKS} ticks (relative figures only)\n`);
const a = await run('V2C+P1+P2-A3 (approved, R1 gun)', VIS);
const b = await run('B1-G (held trigger)', `${VIS}&b1=G`);
const c = await run('B2-A (flagship, R1 economy)', `${VIS}&b2=A`);
const d = await run('B2-B (flagship, damage economy)', `${VIS}&b2=B`);
console.log(`\nB2-B vs approved presentation: frame mean x${(d.mean / a.mean).toFixed(2)}, p95 x${(d.p95 / a.p95).toFixed(2)}; display objects ${(d.objs - a.objs >= 0 ? '+' : '')}${(d.objs - a.objs).toFixed(0)}, live particles ${(d.parts - a.parts >= 0 ? '+' : '')}${(d.parts - a.parts).toFixed(0)}`);
console.log(`B2-B vs B1-G:                  frame mean x${(d.mean / b.mean).toFixed(2)}, p95 x${(d.p95 / b.p95).toFixed(2)}`);
await browser.close();
