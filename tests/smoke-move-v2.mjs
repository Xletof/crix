// `?move=v2` — the candidate locomotion reaches exactly the bodies it should.
// Off by default; on, only Gunner (shooter) and Rifleman (grunt), never a
// nemesis, swarmling, Bulwark, Marksman, Demolisher or the Captain.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const checks = []; const check = (ok, l, d) => checks.push({ ok: !!ok, l, d });
async function probe(q) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => { console.error(e.message); process.exit(1); });
  await page.goto('http://localhost:5173/' + q);
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 45000 });
  const r = await page.evaluate(async () => {
    const g = window.game; g.loop.sleep(); let t = 1e5; Date.now = () => t; const adv = (n) => { for (let i = 0; i < n; i++) { t += 1000 / 60; g.step(t, 1000 / 60); } };
    g.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }); adv(40);
    const gs = g.scene.getScene('Game'); gs.arenaActive = false;
    const out = {};
    for (const [k, type, spec] of [['shooter', 'shooter', {}], ['shooterE', 'shooter', { elite: true }], ['grunt', 'grunt', {}], ['shielded', 'shielded', {}], ['sniper', 'sniper', {}], ['bomber', 'bomber', {}], ['swarmling', 'swarmling', {}]]) {
      const e = gs.spawnEnemyAt(type, 700, 700, spec); out[k] = !!e._loco; gs._destroyEnemyFully(e);
    }
    const n = gs._spawnMiniBoss(); out.nemesis = !!n._loco; gs._destroyEnemyFully(n);
    const c = gs.spawnChampion(700, 700, 'captain'); out.captain = !!c._loco; gs._destroyEnemyFully(c);
    return out;
  });
  await page.close(); return r;
}
const off = await probe('?nodlg=1&nofreeze=1');
const on = await probe('?nodlg=1&nofreeze=1&move=v2');
check(Object.values(off).every((v) => !v), 'default: no body runs the candidate locomotion', JSON.stringify(off));
check(on.shooter && on.shooterE && on.grunt, '?move=v2: Gunner (regular + elite) and Rifleman run it', JSON.stringify(on));
check(!on.shielded && !on.sniper && !on.bomber && !on.swarmling && !on.nemesis && !on.captain, '?move=v2: Bulwark, Marksman, Demolisher, swarmling, nemesis and Captain do not', JSON.stringify(on));
await browser.close();
let bad = 0; for (const c of checks) { console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.l}${c.ok ? '' : '  [' + c.d + ']'}`); if (!c.ok) bad++; }
console.log(`\n${checks.length - bad}/${checks.length} checks passed`); process.exit(bad ? 1 : 0);
