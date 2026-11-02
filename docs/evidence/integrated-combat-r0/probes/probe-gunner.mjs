// probe: during each v2.2 Gunner/Rifleman blind standing run >= 3s, what holds it? (read-only)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { CHROME, bootPage } from '../../../../tests/diag-stuck-audit.mjs';
import { installTac } from '../../../../tests/diag-tactical-engagement.mjs';
import { CONFIGS, Q } from '../../../../tests/diag-integrated-r0.mjs';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
for (const [cell, seed] of [['p_detention_s6w2', 8920], ['p_hangar_s2w1', 1001], ['p_detention_s16w3', 8920]]) {
  const p = await bootPage(browser, { flags: CONFIGS.B, q: Q[cell], seed });
  await installTac(p); await p.evaluate(() => { window.__headless = true; });
  const out = await p.evaluate(({ seed }) => {
    const T = window.__tac, gs = window.__gs, P = gs.player;
    T.begin({ seed, pilot: { mode: 'hide' }, fire: 7 });
    const st = new Map(), res = [];
    for (let i = 0; i < 3600; i++) {
      T.step();
      for (const e of gs.enemies.getChildren()) {
        if (!(e.active && e.alive) || !(e.enemyType === 'shooter' || e.enemyType === 'grunt') || !e._v22) continue;
        let s = st.get(e); if (!s) { s = { run: 0, px: e.x, py: e.y, warnPlant: 0, other: 0, mode: {} }; st.set(e, s); }
        const moved = Math.hypot(e.x - s.px, e.y - s.py) >= 0.5; s.px = e.x; s.py = e.y;
        const los = e._hasLOS(e.x, e.y, P.x, P.y);
        if (!moved && !los) { s.run++; if (e._warnFlashed && e.fireCd < 160) s.warnPlant++; else s.other++; }
        else { if (s.run >= 180) res.push({ type: e.enemyType, elite: !!e._elite, endTick: i, runS: +(s.run / 60).toFixed(1), plantedByWarn: s.warnPlant, other: s.other, fireCd: Math.round(e.fireCd), warn: !!e._warnFlashed }); s.run = 0; s.warnPlant = 0; s.other = 0; }
      }
    }
    for (const [e, s] of st) if (s.run >= 180) res.push({ type: e.enemyType, elite: !!e._elite, endTick: 'runEnd', runS: +(s.run / 60).toFixed(1), plantedByWarn: s.warnPlant, other: s.other, fireCd: Math.round(e.fireCd), warn: !!e._warnFlashed, alive: e.alive });
    return res;
  }, { seed });
  await p.close();
  console.log(cell, seed, JSON.stringify(out));
}
await browser.close();
