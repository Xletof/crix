// Cluster aerial pop & cascade.
//
// Two things to prove:
//   1. The munitions actually go UP after the burst — peak render altitude must
//      exceed the burst height, not just fall from it.
//   2. They then converge on the enemy pack and land.
//
// Altitude is not stored on the bullet (it is a tween on a private state
// object), so it is measured the way the player perceives it: the gap between
// the sprite and its own shadow. That is literally what "in the air" looks like
// on screen, and it needs no hooks into the implementation.
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

// Sample from INSIDE the page, once per rendered frame. Polling with
// page.evaluate costs 200-400ms per round trip at this framerate, which
// collected 2-5 samples across a ~940ms flight and missed the pop entirely on
// some runs. An in-page hook sees every frame and costs nothing.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  window.__track = [];
  gs.events.on('postupdate', () => {
    const frags = (gs.playerFragBullets ?? gs.playerBullets).getChildren().filter((b) => b.active);
    if (!frags.length) return;
    const shadows = gs.children.list.filter((o) => o.texture?.key === 'shadow' && o.visible);
    const alts = frags.map((b) => {
      let best = null;
      for (const sh of shadows) {
        if (Math.abs(sh.x - b.x) < 6 && (best === null || sh.y - b.y > best)) best = sh.y - b.y;
      }
      return best;
    }).filter((v) => v !== null);
    const pack = window.__pack ?? [];
    // Ground distance. b.y is the RENDERED position, which folds in up to 560px
    // of altitude, so measuring against it reports a munition directly above an
    // enemy as being 560px away and only reads true in the last frames before
    // impact. That made this assertion depend on exactly which frames got
    // sampled — it passed standalone and failed in the suite on the same build.
    const dists = frags.map((b) => {
      const gy = b.groundY ?? b.y;
      return Math.min(...pack.map((e) => Math.hypot(e.x - b.x, e.y - gy)));
    });
    window.__track.push({
      n: frags.length,
      maxAlt: alts.length ? Math.round(Math.max(...alts)) : null,
      airborne: frags.filter((b) => b.body && b.body.enable === false).length,
      minDistToPack: dists.length ? Math.round(Math.min(...dists)) : null,
      scale: +(frags[0].scaleX ?? 1).toFixed(2),
    });
  });
});

// Park a stationary pack in front of the player so there is something to
// converge on, then throw.
await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const p = gs.player;
  p.hp = p.hpMax;
  const live = gs.enemies.getChildren().filter((e) => e.alive);
  live.slice(0, 4).forEach((e, i) => {
    e.x = p.x + 260 + (i % 2) * 70;
    e.y = p.y - 60 + i * 45;
    e.body?.reset(e.x, e.y);
    e.hp = 99999;                       // survive the barrage so the pack holds still
  });
  live.slice(4).forEach((e) => { e.x = p.x - 1200; e.y = p.y - 1200; e.body?.reset(e.x, e.y); });
  window.__pack = live.slice(0, 4).map((e) => ({ x: e.x, y: e.y }));
  p.equipSecondary('cluster');
  p.fireCooldown = 0;
  p.tryFire(0);
  p._equipNothing();
});

// Wait for the burst. The 1s fuse dilates to ~2s at the harness framerate, so
// a fixed sleep either misses the flight entirely or lands past it.
await page.waitForFunction(() => {
  const gs = window.game.scene.getScene('Game');
  return (gs.playerFragBullets ?? gs.playerBullets).getChildren().some((b) => b.active);
}, null, { timeout: 15000 });

// Grab the pop while it is still in the air, then let the flight finish.
await page.screenshot({ path: `${OUT}/arc-1-pop.png` });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/arc-2-cascade.png` });
await page.waitForTimeout(1600);
await page.screenshot({ path: `${OUT}/arc-3-land.png` });

const samples = await page.evaluate(() => window.__track ?? []);

const burstHeight = await page.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map((r) => r.name)
    .find((n) => /\/config\.js/.test(n));
  const m = await import(url);
  return m.WEAPONS.cluster.burstHeight;
});

const alts = samples.map((s) => s.maxAlt).filter((v) => v !== null);
const peakAlt = alts.length ? Math.max(...alts) : null;
const firstAlt = alts.length ? alts[0] : null;
const dists = samples.map((s) => s.minDistToPack).filter((v) => v !== null);

console.log(JSON.stringify({
  burstHeight,
  samples: samples.length,
  firstAlt: firstAlt === null ? null : Math.round(firstAlt),
  peakAlt: peakAlt === null ? null : Math.round(peakAlt),
  altTrack: alts.slice(0, 24).map((v) => Math.round(v)),
  distTrack: dists.slice(0, 24),
  minDistReached: dists.length ? Math.min(...dists) : null,
  maxAirborne: Math.max(...samples.map((s) => s.airborne)),
  maxScale: Math.max(...samples.map((s) => s.scale)),
}, null, 2));
console.log('page errors:', errors.length ? errors : 'none');

const fails = [];
if (!samples.length) fails.push('no fragments observed at all');
if (peakAlt === null) fails.push('could not measure altitude (no shadow pairing)');
else {
  if (peakAlt <= burstHeight) fails.push(`munitions never rose above the burst: peak ${Math.round(peakAlt)} <= burstHeight ${burstHeight}`);
  if (peakAlt <= firstAlt) fails.push(`altitude never increased after the burst: first ${Math.round(firstAlt)}, peak ${Math.round(peakAlt)}`);
}
if (dists.length && Math.min(...dists) > 200) fails.push(`munitions never converged on the pack (closest ${Math.min(...dists)}px)`);
if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`);

console.log(fails.length ? `\nFAIL:\n - ${fails.join('\n - ')}` : '\nPASS: pop above the burst, then cascade onto the pack');
await browser.close();
process.exit(fails.length ? 1 : 0);
