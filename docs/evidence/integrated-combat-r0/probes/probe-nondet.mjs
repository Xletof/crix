// bounded probe: the same headless run N times; per tick, every body's position;
// report which body first differs from run 0, and its state there
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME } from '../../../../tests/diag-stuck-audit.mjs';
import { tacPage, Q } from '../../../../tests/diag-tactical-engagement.mjs';
import { CONFIGS } from '../../../../tests/diag-integrated-r0.mjs';
const N = +(process.argv[2] || 5);
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const runs = [];
for (let k = 0; k < N; k++) {
  const p = await tacPage(browser, CONFIGS.C, Q.mixed, 16839);
  const r = await p.evaluate(() => {
    const T = window.__tac, gs = window.__gs, P = gs.player;
    T.begin({ seed: 16839, pilot: { mode: 'circle' }, fire: 7 });
    const ids = new Map(); let nid = 0;
    const snap = [];
    for (let i = 0; i < 1300; i++) {
      T.step();
      const row = [`P ${P.x.toFixed(3)},${P.y.toFixed(3)} v${P.body.velocity.x.toFixed(2)},${P.body.velocity.y.toFixed(2)}`];
      for (const e of gs.enemies.getChildren()) { if (!e.active) continue; if (!ids.has(e)) ids.set(e, nid++); row.push(`${ids.get(e)}:${e.enemyType}${e._elite ? 'E' : ''} ${e.x.toFixed(3)},${e.y.toFixed(3)} hp${e.hp}`); }
      let nb = 0; for (const g of gs.hostileBullets) for (const b of g.getChildren()) if (b.active) nb++;
      let pb = 0; for (const b of (gs.playerBullets?.getChildren?.() || [])) if (b.active) pb++;
      row.push(`hostile${nb} playerBolts${pb} draws${window.__draws} keys${['A','D','W','S'].map((k) => +gs.keys[k].isDown).join('')}`);
      snap.push(row);
    }
    return snap;
  });
  await p.close();
  runs.push(r);
  const d = runs[0].findIndex((row, i) => row.join('|') !== r[i].join('|'));
  console.log(`run ${k}: first difference from run 0 at tick ${d}`);
  if (d >= 0) {
    const a = runs[0][d], b = r[d];
    for (let j = 0; j < Math.max(a.length, b.length); j++) if (a[j] !== b[j]) console.log(`   run0: ${a[j]}\n   run${k}: ${b[j]}`);
    console.log(`   previous tick run0: ${runs[0][d - 1].filter((x, j) => x !== r[d - 1][j]).join(' ; ') || '(identical)'}`);
  }
}
await browser.close();
