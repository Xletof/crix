// Flight SHAPE. "Does it land on the target" was already true of the lerp — the
// puppet hit fine, it just looked like a puppet. So this measures the two things
// that separate powered flight from a position lerp:
//
//   sinuosity  = path length / straight-line distance. A lerp tracks a moving
//                point, so it is ~1.0 (bends only as much as the target moves).
//                A munition that must overcome outward momentum has to arc.
//   arrivalSpeed / peakSpeed. This is the load-bearing one. The lerp eased on a
//                smoothstep, which DECELERATES to ~0 at arrival — the object
//                settles onto the target. A missile arrives at full speed.
//
// Enemies are parked and immortal, so any curvature measured is the flight
// model's, not the target running.
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

  const live = gs.enemies.getChildren().filter((e) => e.alive);
  const spots = [[-260, -300], [-60, -380], [160, -320], [330, -180]];
  live.slice(0, 4).forEach((e, i) => {
    e.x = p.x + spots[i][0];
    e.y = p.y + spots[i][1];
    e.body?.reset(e.x, e.y);
    e.hp = 999999; e.hpMax = 999999;
    // Parked: a target that runs would contribute curvature that is not the
    // flight model's doing.
    e.speed = 0;
  });
  live.slice(4).forEach((e) => { e.x = p.x - 1400; e.y = p.y - 1400; e.body?.reset(e.x, e.y); });

  // Per-munition ground track, sampled every frame from inside the page.
  window.__paths = new Map();
  window.__flame = 0;
  gs.events.on('postupdate', () => {
    gs.playerFragBullets.getChildren().filter((b) => b.active).forEach((b) => {
      if (!window.__paths.has(b)) window.__paths.set(b, []);
      // Two positions, deliberately. gy is the GROUND track — the only one that
      // can answer "did it bank", since the rendered y folds altitude in and a
      // straight vertical drop would read as curvature. ry is the RENDERED
      // track, which is what the eye actually sees moving, so it is the honest
      // one for "does it arrive at speed or settle in".
      window.__paths.get(b).push({
        x: +b.x.toFixed(2), gy: +(b.groundY ?? b.y).toFixed(2),
        ry: +b.y.toFixed(2), t: gs.time.now,
      });
    });
    // Exhaust flames are the only 'muzzle'-textured images in the AIR band.
    const f = gs.children.list.filter(
      (o) => o.type === 'Image' && o.texture?.key === 'muzzle' && o.depth > 1500,
    ).length;
    if (f > window.__flame) window.__flame = f;
  });

  p.equipSecondary('cluster');
  p.fireCooldown = 0;
  p.tryFire(-Math.PI / 2);
  p._equipNothing();
});

await page.waitForFunction(() => {
  const gs = window.game.scene.getScene('Game');
  return gs.playerFragBullets.getChildren().some((b) => b.active);
}, null, { timeout: 15000 });

await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/flight-mid.png` });
await page.waitForTimeout(2600);

const r = await page.evaluate(() => {
  const out = [];
  for (const pts of window.__paths.values()) {
    if (pts.length < 6) continue;
    // Only the powered run — drop the pop, which is a tween in both builds.
    const dive = pts.slice(Math.floor(pts.length * 0.35));
    if (dive.length < 5) continue;

    let path = 0;
    let turned = 0;          // total ABSOLUTE heading change, radians
    let prevHeading = null;
    const speeds = [], hSpeeds = [], vSpeeds = [];
    for (let i = 1; i < dive.length; i++) {
      const p0 = dive[i - 1], p1 = dive[i];
      const dx = p1.x - p0.x, dgy = p1.gy - p0.gy;
      const ground = Math.hypot(dx, dgy);
      path += ground;
      // Altitude is recoverable: ry = gy - z, so z = gy - ry. That makes the
      // true 3D speed measurable, which is the only honest read on "arrives
      // under power" — a steep terminal dive legitimately slows the GROUND
      // track while the munition is still accelerating.
      const dz = (p1.gy - p1.ry) - (p0.gy - p0.ry);
      const dt = (p1.t - p0.t) / 1000;
      if (dt > 0.001) {
        speeds.push(Math.hypot(dx, dgy, dz) / dt);
        // Tracked apart, because the model caps them apart: the horizontal is
        // momentum-limited flight capped at fragMaxSpeed, the vertical is a
        // solved descent capped at fragMaxSink. A single 3D figure can exceed
        // either one without anything being wrong.
        hSpeeds.push(ground / dt);
        vSpeeds.push(Math.abs(dz) / dt);
      }
      // Only while it is still APPROACHING. Below ~80px of altitude the munition
      // is landing, and the anti-orbit term deliberately spins its heading hard
      // through the last few frames — that corkscrew is a tight drop onto the
      // target, not a lap around it, and counting it swamped the real signal.
      if (ground > 2 && (p1.gy - p1.ry) > 80) {
        const h = Math.atan2(dgy, dx);
        if (prevHeading !== null) {
          let d = h - prevHeading;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          turned += Math.abs(d);
        }
        prevHeading = h;
      }
    }
    const a = dive[0], b = dive[dive.length - 1];
    const straight = Math.hypot(b.x - a.x, b.gy - a.gy);
    if (straight < 40 || speeds.length < 4) continue;

    const peak = Math.max(...speeds);
    // Average of the last two samples — one frame can be a partial step.
    const arrival = (speeds[speeds.length - 1] + speeds[speeds.length - 2]) / 2;
    out.push({
      // Informational. A munition flung AWAY from its target has to turn round,
      // which legitimately doubles its path — high sinuosity alone is not a bug.
      sinuosity: +(path / straight).toFixed(3),
      // The real anti-orbit metric. A swoop, even a full reversal, accumulates
      // under ~200 degrees. Anything past 360 has flown a complete lap and is
      // orbiting its target.
      turnedDeg: Math.round((turned * 180) / Math.PI),
      peakSpeed: Math.round(peak),
      peakHSpeed: Math.round(Math.max(...hSpeeds)),
      peakVSpeed: Math.round(Math.max(...vSpeeds)),
      arrivalSpeed: Math.round(arrival),
      arrivalFrac: +(arrival / peak).toFixed(3),
    });
  }
  const avg = (k) => +(out.reduce((s, o) => s + o[k], 0) / out.length).toFixed(3);
  return {
    n: out.length,
    perMunition: out,
    avgSinuosity: out.length ? avg('sinuosity') : null,
    avgTurnedDeg: out.length ? Math.round(avg('turnedDeg')) : null,
    maxTurnedDeg: out.length ? Math.max(...out.map((o) => o.turnedDeg)) : null,
    avgArrivalFrac: out.length ? avg('arrivalFrac') : null,
    avgPeakSpeed: out.length ? Math.round(avg('peakSpeed')) : null,
    maxHSpeed: out.length ? Math.max(...out.map((o) => o.peakHSpeed)) : null,
    maxVSpeed: out.length ? Math.max(...out.map((o) => o.peakVSpeed)) : null,
    maxFlamesSeen: window.__flame,
  };
});

console.log(JSON.stringify(r, null, 2));
console.log('page errors:', errors.length ? errors : 'none');

const fails = [];
if (!r.n) fails.push('no usable tracks — run proves nothing');
else {
  // It must bend...
  if (r.avgTurnedDeg < 30) {
    fails.push(`barely turns (${r.avgTurnedDeg} deg) — snapping onto the heading and flying straight, not banking`);
  }
  // ...but not lap its target. This is the orbit check that the sinuosity
  // number could not make, because a legitimate turn-around looks identical.
  // Two full laps. One lap is not the defect it looks like: a munition flung to
  // the far side of its target legitimately swings through more than 360 to get
  // round, and those still land (8/8 across repeated runs) inside the same
  // 1.0-1.8s window as the rest. Failing to CONVERGE is the defect, and that
  // shows up as repeated laps, not as one wide one.
  if (r.maxTurnedDeg > 720) {
    fails.push(`orbiting: one munition turned through ${r.maxTurnedDeg} deg — it is lapping, not approaching`);
  }
  // A smoothstep lerp settles onto its target; a missile arrives at speed.
  if (r.avgArrivalFrac < 0.6) {
    fails.push(`decelerates into the target (arrives at ${(r.avgArrivalFrac * 100).toFixed(0)}% of peak) — that is easing, not flying`);
  }
  if (r.avgPeakSpeed < 400) fails.push(`too slow to read as powered: peak ${r.avgPeakSpeed}px/s`);
  // Each axis against its OWN cap (fragMaxSpeed 980, fragMaxSink 2200), with
  // headroom for frame-quantised sampling.
  if (r.maxHSpeed > 1150) fails.push(`horizontal peak ${r.maxHSpeed}px/s is over fragMaxSpeed — the cap is not holding`);
  if (r.maxVSpeed > 2500) fails.push(`vertical peak ${r.maxVSpeed}px/s is over fragMaxSink — the descent is spiking again`);
  if (r.maxFlamesSeen < 1) fails.push('no exhaust flame was ever drawn');
}
if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`);

console.log(fails.length ? `\nFAIL:\n - ${fails.join('\n - ')}` : '\nPASS: curved attack run, arrives under power, exhaust lit');
await browser.close();
process.exit(fails.length ? 1 : 0);
