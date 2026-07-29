// Cluster pod: draw order vs the room, and no tumbling.
//
// Samples from INSIDE the page via a postupdate hook. page.evaluate polling
// costs 200-400ms a round trip at this framerate and misses most of a ~940ms
// flight — that already produced one false pass earlier this session.
//
// Both assertions must FAIL on the pre-change build. Run under `git stash` to
// confirm that before trusting a pass.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const OUT = new URL('./out/', import.meta.url).pathname;

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

// Install the sampler, then throw the pod so it bursts directly over cover.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const p = gs.player;
  p.hp = p.hpMax;

  // Highest-depth occluder in the room — walls and cover sort at y + 56.
  const occluders = gs.walls.getChildren().filter((w) => w.active);
  const maxOccluder = Math.max(...occluders.map((w) => w.depth));
  // Put the player just below a piece of cover so the pod flies right over it.
  const target = occluders.reduce((a, w) => (w.depth > a.depth ? w : a), occluders[0]);
  p.x = target.x; p.y = target.y + 300;
  p.body.reset(p.x, p.y);

  window.__track = [];
  window.__maxOccluder = maxOccluder;
  window.__canisterMin = Infinity;

  gs.events.on('postupdate', () => {
    const frags = gs.playerFragBullets.getChildren().filter((b) => b.active);
    for (const g of gs.grenades.getChildren()) {
      if (g.active && g.visual) window.__canisterMin = Math.min(window.__canisterMin, g.visual.depth);
    }
    if (!frags.length) return;
    window.__track.push({
      minDepth: Math.min(...frags.map((b) => b.depth)),
      airborne: frags.filter((b) => b.body && b.body.enable === false).length,
      landed: frags.filter((b) => b.body && b.body.enable !== false).length,
      rot: frags.map((b) => b.rotation),
    });
    // Nose-vs-travel, tracked PER MUNITION. The old measure diffed rot[0]
    // frame to frame, but index 0 is "whichever fragment happens to be first in
    // the group", so every detonation reshuffled it and the diff jumped between
    // different missiles. That was harmless while the munitions held a constant
    // rotation and is completely unsound now that the nose follows the flight
    // path. What actually distinguishes tumble from guided flight is not HOW
    // MUCH a munition rotates — a banking missile rotates a lot, correctly —
    // but whether its rotation matches the direction it is travelling.
    window.__aim = window.__aim || [];
    window.__prev = window.__prev || new Map();
    for (const b of frags) {
      const gy = b.groundY ?? b.y;
      const p0 = window.__prev.get(b);
      if (p0) {
        const dx = b.x - p0.x, dy = gy - p0.y;
        if (Math.hypot(dx, dy) > 3) {
          let e = Math.atan2(dy, dx) - b.rotation;
          while (e > Math.PI) e -= Math.PI * 2;
          while (e < -Math.PI) e += Math.PI * 2;
          window.__aim.push(Math.abs(e));
        }
      }
      window.__prev.set(b, { x: b.x, y: gy });
    }
  });

  p.equipSecondary('cluster');
  p.fireCooldown = 0;
  p.tryFire(-Math.PI / 2);   // straight "up" the screen, over the cover
  p._equipNothing();
});

await page.waitForFunction(() => {
  const gs = window.game.scene.getScene('Game');
  return gs.playerFragBullets.getChildren().some((b) => b.active);
}, null, { timeout: 15000 });

await page.screenshot({ path: `${OUT}/depth-1-pop.png` });
await page.waitForTimeout(450);
await page.screenshot({ path: `${OUT}/depth-2-cascade.png` });
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/depth-3-land.png` });

const r = await page.evaluate(() => {
  const track = window.__track ?? [];
  // Rotation travelled while AIRBORNE only. The ground-homing phase re-aims
  // every frame via Bullet._steer, which is correct behaviour and would swamp
  // the measurement; the tumble being tested happens during the pop and dive.
  const aim = window.__aim ?? [];
  const aimDeg = aim.map((r) => (r * 180) / Math.PI);
  aimDeg.sort((a, b) => a - b);
  const air = track.filter((s) => s.airborne > 0);
  const ground = track.filter((s) => s.landed > 0 && s.airborne === 0);
  return {
    maxOccluderDepth: Math.round(window.__maxOccluder),
    canisterMinDepth: window.__canisterMin === Infinity ? null : Math.round(window.__canisterMin),
    samples: track.length,
    airborneSamples: air.length,
    minAirborneDepth: air.length ? Math.round(Math.min(...air.map((s) => s.minDepth))) : null,
    landedDepthSample: ground.length ? Math.round(ground[ground.length - 1].minDepth) : null,
    aimSamples: aimDeg.length,
    medianAimErrDeg: aimDeg.length ? +aimDeg[Math.floor(aimDeg.length / 2)].toFixed(1) : null,
    p90AimErrDeg: aimDeg.length ? +aimDeg[Math.floor(aimDeg.length * 0.9)].toFixed(1) : null,
  };
});

console.log(JSON.stringify(r, null, 2));
console.log('page errors:', errors.length ? errors : 'none');

const fails = [];
if (!r.airborneSamples) fails.push('never observed an airborne munition — run proves nothing');
else {
  if (r.minAirborneDepth <= r.maxOccluderDepth) {
    fails.push(`airborne munitions draw BEHIND level objects: min depth ${r.minAirborneDepth} <= max occluder ${r.maxOccluderDepth}`);
  }
  if (r.canisterMinDepth !== null && r.canisterMinDepth <= r.maxOccluderDepth) {
    fails.push(`canister draws BEHIND level objects: ${r.canisterMinDepth} <= ${r.maxOccluderDepth}`);
  }
  if (r.landedDepthSample !== null && r.landedDepthSample > r.maxOccluderDepth + 1000) {
    fails.push(`landed munition never dropped out of the air band: ${r.landedDepthSample}`);
  }
  if (r.medianAimErrDeg === null) fails.push('never sampled a moving munition — tumble check proves nothing');
  else if (r.medianAimErrDeg > 20) {
    fails.push(`munitions tumble: nose is a median ${r.medianAimErrDeg} deg off the direction of travel`);
  }
}
if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`);

console.log(fails.length ? `\nFAIL:\n - ${fails.join('\n - ')}` : '\nPASS: draws over the room, no tumble');
await browser.close();
process.exit(fails.length ? 1 : 0);
