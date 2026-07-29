// Diagnostic, not an assertion. Per munition: how long it flew, how it ended,
// and how far it was from its locked target when it detonated. Guessing at the
// flight model from pass/fail was not converging.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173/');
await page.waitForTimeout(4000);
await page.mouse.click(360, 640);
await page.waitForTimeout(600);
await page.evaluate(() => {
  const t = window.game?.scene?.getScene('Title');
  if (t?.sys?.isActive()) t.scene.start('Game');
});
await page.waitForFunction(() => {
  const gs = window.game?.scene?.getScene('Game');
  return !!(gs?.player && gs?.enemies);
}, null, { timeout: 20000 });
await page.waitForTimeout(1500);

await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const p = gs.player;
  p.hp = p.hpMax;
  const live = gs.enemies.getChildren().filter((e) => e.alive);
  const spots = [[-260, -300], [-60, -380], [160, -320], [330, -180]];
  live.slice(0, 4).forEach((e, i) => {
    e.x = p.x + spots[i][0]; e.y = p.y + spots[i][1];
    e.body?.reset(e.x, e.y); e.hp = 999999; e.hpMax = 999999; e.speed = 0;
  });
  live.slice(4).forEach((e) => { e.x = p.x - 1400; e.y = p.y - 1400; e.body?.reset(e.x, e.y); });
  const pack = live.slice(0, 4);

  // Wrap the fragment spawn so each munition's target is known, then watch its
  // ground position (b.groundY) until it dies.
  window.__rows = [];
  const orig = gs._clusterFragment.bind(gs);
  gs._clusterFragment = (bx, by, bz, angle, reach, target) => {
    const b = orig(bx, by, bz, angle, reach, target);
    if (!b) return b;
    const row = {
      idx: pack.indexOf(target), t0: gs.time.now,
      minDist: Infinity, minZ: Infinity, maxZ: 0, samples: 0,
    };
    window.__rows.push(row);
    const watch = () => {
      if (!b.active) { gs.events.off('postupdate', watch); return; }
      row.samples++;
      const gy = b.groundY ?? b.y;
      const z = gy - b.y;
      row.z = +z.toFixed(0);
      row.maxZ = Math.max(row.maxZ, z);
      row.minZ = Math.min(row.minZ, z);
      if (target) {
        const d = Math.hypot(target.x - b.x, target.y - gy);
        row.dist = +d.toFixed(0);
        row.minDist = Math.min(row.minDist, d);
      }
      row.flightMs = Math.round(gs.time.now - row.t0);
    };
    gs.events.on('postupdate', watch);
    return b;
  };

  p.equipSecondary('cluster');
  p.fireCooldown = 0;
  p.tryFire(-Math.PI / 2);
  p._equipNothing();
});

await page.waitForTimeout(5000);

const r = await page.evaluate(() => window.__rows.map((x) => ({
  lock: x.idx,
  flightMs: x.flightMs,
  endDist: x.dist,
  closestApproach: Math.round(x.minDist),
  endZ: x.z,
  peakZ: Math.round(x.maxZ),
  hitRadius74: x.minDist <= 74,
})));
console.log(JSON.stringify(r, null, 2));
console.log('landed within 74px:', r.filter((x) => x.hitRadius74).length, '/', r.length);
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
