// Cluster munitions: distinct locks, flat small scale, no ground phase,
// guidance lines that clean up after themselves.
//
// Samples from INSIDE the page via a postupdate hook. page.evaluate polling
// costs 200-400ms a round trip at this framerate and misses most of the flight
// — that already produced one false pass earlier in this session.
//
// The distinct-target assertion MUST fail on the pre-change build (where every
// munition re-resolves findNearestEnemy and they all pile onto the closest
// enemy). Run under `git stash` to confirm before trusting a pass.
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

await page.evaluate(() => {
  const gs = window.game.scene.getScene('Game');
  const p = gs.player;
  p.hp = p.hpMax;

  // Four well-separated, unkillable enemies in a fan ahead of the player, so
  // "did they spread across targets" is actually answerable.
  const live = gs.enemies.getChildren().filter((e) => e.alive);
  const spots = [[-260, -300], [-60, -380], [160, -320], [330, -180]];
  live.slice(0, 4).forEach((e, i) => {
    e.x = p.x + spots[i][0];
    e.y = p.y + spots[i][1];
    e.body?.reset(e.x, e.y);
    e.hp = 999999; e.hpMax = 999999;
  });
  live.slice(4).forEach((e) => { e.x = p.x - 1400; e.y = p.y - 1400; e.body?.reset(e.x, e.y); });
  const pack = live.slice(0, 4);
  // Behavioural measure that works on BOTH builds: which enemies actually take
  // damage. The lock instrumentation below reads a parameter that only exists
  // after this change, so on the old build it would fail for the wrong reason.
  // Counting distinct damaged enemies measures the thing we actually care about
  // — do the munitions spread, or do they all pile onto the nearest one.
  window.__damaged = [];
  window.__dmgAmounts = [];
  window.__gruntHp = 320;
  pack.forEach((e, i) => {
    const od = e.damage.bind(e);
    e.damage = (...a) => {
      window.__damaged.push(i);
      window.__dmgAmounts.push(Math.round(a[0]));
      return od(...a);
    };
  });

  window.__track = [];
  window.__hitSfx = 0;
  window.__fragSfx = 0;

  gs.events.on('postupdate', () => {
    const frags = gs.playerFragBullets.getChildren().filter((b) => b.active);
    // Count line graphics: our guidance lines are the only bare Graphics in the
    // AIR depth band.
    const lines = gs.children.list.filter(
      (o) => o.type === 'Graphics' && o.depth > 1500 && o.visible,
    ).length;
    if (!frags.length) {
      window.__track.push({ n: 0, lines, scales: [], enabled: 0, targets: [] });
      return;
    }
    window.__track.push({
      n: frags.length,
      lines,
      scales: frags.map((b) => +b.scaleX.toFixed(3)),
      enabled: frags.filter((b) => b.body && b.body.enable !== false).length,
      targets: [],
    });
  });

  // Instrument the lock assignment directly — the target lives on a closure
  // state object, not on the bullet, so it cannot be read from the outside.
  const origFrag = gs._clusterFragment.bind(gs);
  window.__locks = [];
  gs._clusterFragment = (bx, by, bz, angle, reach, target) => {
    window.__locks.push(target ? pack.indexOf(target) : -1);
    return origFrag(bx, by, bz, angle, reach, target);
  };

  p.equipSecondary('cluster');
  p.fireCooldown = 0;
  p.tryFire(-Math.PI / 2);
  p._equipNothing();
});

// Spy on the two sounds — the point of the new one is that it REPLACES the beep.
await page.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map((r) => r.name)
    .find((n) => /systems\/FX\.js/.test(n));
  const FX = await import(url);
  const oh = FX.SFX.hit.bind(FX.SFX);
  const of = FX.SFX.fragImpact ? FX.SFX.fragImpact.bind(FX.SFX) : null;
  FX.SFX.hit = (...a) => { window.__hitSfx++; return oh(...a); };
  if (of) FX.SFX.fragImpact = (...a) => { window.__fragSfx++; return of(...a); };
});

await page.waitForFunction(() => {
  const gs = window.game.scene.getScene('Game');
  return gs.playerFragBullets.getChildren().some((b) => b.active);
}, null, { timeout: 15000 });

await page.screenshot({ path: `${OUT}/cluster-1-pop.png` });
await page.waitForTimeout(420);
await page.screenshot({ path: `${OUT}/cluster-2-dive.png` });
await page.waitForTimeout(2200);
await page.screenshot({ path: `${OUT}/cluster-3-after.png` });

const r = await page.evaluate(() => {
  const track = window.__track ?? [];
  const flying = track.filter((s) => s.n > 0);
  const allScales = [...new Set(flying.flatMap((s) => s.scales))];
  const locks = window.__locks ?? [];
  const damaged = window.__damaged ?? [];
  const amounts = window.__dmgAmounts ?? [];
  return {
    damaged,
    distinctDamaged: new Set(damaged).size,
    dmgPerHit: [...new Set(amounts)],
    gruntHp: window.__gruntHp,
    // "Almost kills a grunt by itself" — what fraction of a grunt's health one
    // munition removes.
    fracOfGrunt: amounts.length ? +(amounts[0] / window.__gruntHp).toFixed(3) : null,
    locks,
    distinctLocks: new Set(locks.filter((v) => v >= 0)).size,
    fragmentsSpawned: locks.length,
    flyingSamples: flying.length,
    distinctScales: allScales,
    everEnabledBody: flying.reduce((a, s) => a + s.enabled, 0),
    maxLinesWhileFlying: flying.length ? Math.max(...flying.map((s) => s.lines)) : 0,
    linesAfterAllGone: track.length ? track[track.length - 1].lines : null,
    finalFragCount: track.length ? track[track.length - 1].n : null,
    hitSfx: window.__hitSfx,
    fragSfx: window.__fragSfx,
    cfgScale: 0.55,
  };
});

console.log(JSON.stringify(r, null, 2));
console.log('page errors:', errors.length ? errors : 'none');

const fails = [];
if (!r.flyingSamples) fails.push('never observed a munition in flight — run proves nothing');
else {
  // The load-bearing one, and the only spread check that is meaningful on both
  // builds. 5 munitions over 4 enemies should touch at least 3 of them.
  if (r.distinctDamaged < 3) {
    fails.push(`munitions did not spread across targets: only ${r.distinctDamaged} distinct enemies damaged (hits: ${JSON.stringify(r.damaged)})`);
  }
  if (r.distinctLocks < 3) {
    fails.push(`lock assignment did not spread: ${r.distinctLocks} distinct locks from ${r.fragmentsSpawned} munitions (${JSON.stringify(r.locks)})`);
  }
  if (r.distinctScales.length !== 1 || Math.abs(r.distinctScales[0] - r.cfgScale) > 0.01) {
    fails.push(`scale is not flat at ${r.cfgScale}: observed ${JSON.stringify(r.distinctScales)}`);
  }
  if (r.everEnabledBody > 0) {
    fails.push(`${r.everEnabledBody} samples had an ENABLED body — the ground phase is back`);
  }
  if (r.maxLinesWhileFlying < 1) fails.push('no guidance line was ever drawn');
  if (r.linesAfterAllGone > 0) fails.push(`${r.linesAfterAllGone} guidance lines leaked after the last detonation`);
  if (r.fragmentsSpawned !== 8) fails.push(`expected 8 munitions, got ${r.fragmentsSpawned}`);
  // One munition should nearly kill a grunt: high enough to matter on its own,
  // but short of a clean one-shot.
  if (r.fracOfGrunt === null) fails.push('nothing took damage — cannot check per-hit damage');
  else if (r.fracOfGrunt < 0.8) fails.push(`one munition only removes ${(r.fracOfGrunt * 100).toFixed(0)}% of a grunt — too weak`);
  else if (r.fracOfGrunt >= 1) fails.push(`one munition one-shots a grunt (${(r.fracOfGrunt * 100).toFixed(0)}%) — meant to ALMOST kill`);
  if (r.fragSfx < 1) fails.push('fragImpact sound never played');
  if (r.hitSfx > 0) fails.push(`the generic hit beep fired ${r.hitSfx}x during cluster impacts — suppression failed`);
}
if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`);

console.log(fails.length ? `\nFAIL:\n - ${fails.join('\n - ')}` : '\nPASS: distinct locks, flat scale, no ground phase, lines clean up');
await browser.close();
process.exit(fails.length ? 1 : 0);
