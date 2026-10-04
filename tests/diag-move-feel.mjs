// MOVEMENT FEEL — numbers behind "floaty / random / DVD-logo".
//
// A seeded, hand-stepped CROSSFIRE (sector 14, the Gunner wave), the same
// scripted player in every run, sampled every 60Hz tick for every Gunner and
// Rifleman on the floor. Reports, per actor-second:
//   snaps      frames whose velocity turned > 60deg in ONE tick at speed
//   reversals  heading flips > 120deg within 100ms
//   turns      heading changes > 45deg (any cause)
//   leg ms     median time a heading holds within 30deg while moving
//   still %    share of time under 25px/s
//   shots moving %  shots fired at > 40px/s
// usage: node tests/diag-move-feel.mjs ["extra query"]   (prints a table for off / v2)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const Q = '?nodlg=1&nofreeze=1&roster=v1&encdbg=crossfire&room=corridor&sector=14&wave=1';
async function run(extra) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => { console.error(e.message); process.exit(1); });
  await page.goto(BASE + Q + extra);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  const r = await page.evaluate(async () => {
    const g = window.game; g.loop.sleep();
    let s = 12345; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    let t = 1e5; Date.now = () => t; const adv = () => { t += 1000 / 60; g.step(t, 1000 / 60); };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); adv(); adv();
    const gs = g.scene.getScene('Game');
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n));
    (await import(url)).setGodMode(true);
    const st = new Map();
    let shots = 0, movingShots = 0;
    gs.events.on('shooter-fire', (e) => {
      if (e.enemyType !== 'shooter' && e.enemyType !== 'grunt') return;
      shots++; if (Math.hypot(e.body.velocity.x, e.body.velocity.y) > 40) movingShots++;
    });
    const k = gs.keys;
    for (let i = 0; i < 1500; i++) {
      // a player who moves a bit, stops, moves the other way: the CROSSFIRE handset pattern
      const ph = Math.floor(i / 75) % 6;
      k.A.isDown = ph === 1; k.D.isDown = ph === 4; k.W.isDown = ph === 2; k.S.isDown = false;
      adv();
      for (const e of gs.enemies.getChildren()) {
        if (!e.active || !e.alive || (e.enemyType !== 'shooter' && e.enemyType !== 'grunt') || e._staggerMs > 0) continue;
        const v = e.body.velocity, sp = Math.hypot(v.x, v.y), h = Math.atan2(v.y, v.x);
        const a = st.get(e) || { nn: [], los: 0, dist: 0, modes: {}, n: 0, snaps: 0, rev: 0, turns: 0, still: 0, legs: [], legT: 0, legH: null, hist: [] };
        { let m = 1e9; for (const o of gs.enemies.getChildren()) { if (o === e || !o.active || !o.alive || (o.enemyType !== 'shooter' && o.enemyType !== 'grunt')) continue; m = Math.min(m, Math.hypot(o.x - e.x, o.y - e.y)); } if (m < 1e9) a.nn.push(m); }
        a.n++; if (e._hasLOS(e.x, e.y, gs.player.x, gs.player.y)) a.los++; a.dist += Math.hypot(gs.player.x - e.x, gs.player.y - e.y); const md = e._leg?.mode || '-'; a.modes[md] = (a.modes[md] || 0) + 1;
        if (sp < 25) { a.still++; if (a.legH !== null && a.legT > 0) { a.legs.push(a.legT); } a.legH = null; a.legT = 0; }
        else {
          const prev = a.hist[a.hist.length - 1];
          if (prev && prev.sp > 25) {
            const d = Math.abs(Phaser.Math.Angle.Wrap(h - prev.h));
            if (d > Math.PI / 3) a.snaps++;
            if (d > Math.PI / 4) a.turns++;
          }
          const back = a.hist[a.hist.length - 6];
          if (back && back.sp > 25 && Math.abs(Phaser.Math.Angle.Wrap(h - back.h)) > 2 * Math.PI / 3) { a.rev++; a.hist.length = 0; }
          if (a.legH === null || Math.abs(Phaser.Math.Angle.Wrap(h - a.legH)) > Math.PI / 6) { if (a.legT > 0) a.legs.push(a.legT); a.legH = h; a.legT = 0; }
          a.legT += 1000 / 60;
        }
        a.hist.push({ h, sp }); if (a.hist.length > 8) a.hist.shift();
        st.set(e, a);
      }
    }
    const nn = []; let los = 0, dist = 0; const modes = {}; let n = 0, snaps = 0, rev = 0, turns = 0, still = 0; const legs = [];
    for (const a of st.values()) { nn.push(...a.nn); los += a.los; dist += a.dist; for (const [m, c] of Object.entries(a.modes)) modes[m] = (modes[m] || 0) + c; n += a.n; snaps += a.snaps; rev += a.rev; turns += a.turns; still += a.still; legs.push(...a.legs); }
    legs.sort((x, y) => x - y);
    const secs = n / 60;
    return { actorSec: +secs.toFixed(1), snapsPerSec: +(snaps / secs).toFixed(2), reversalsPerSec: +(rev / secs).toFixed(2), turnsPerSec: +(turns / secs).toFixed(2),
      medianLegMs: Math.round(legs[Math.floor(legs.length / 2)] || 0), stillPct: Math.round(100 * still / n), shots, shotsMovingPct: Math.round(100 * movingShots / Math.max(1, shots)), losPct: Math.round(100 * los / n), nnMedian: Math.round(nn.sort((x, y) => x - y)[Math.floor(nn.length / 2)]), nnUnder90Pct: Math.round(100 * nn.filter((d) => d < 90).length / nn.length), meanDist: Math.round(dist / n) };
  });
  await page.close();
  return r;
}
const extra = process.argv[2] || '';
console.table({ shipped: await run(extra), 'move=v2': await run(extra + '&move=v2'), 'move=v21': await run(extra + '&move=v21') });
await browser.close();
