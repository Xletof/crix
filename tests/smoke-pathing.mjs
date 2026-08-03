// Path QUALITY, not arrival.
//
// This test exists because of a specific mistake. A previous change added wall
// geometry to the Hangar Bay, and the check written for it measured how much
// distance each enemy closed on the player. Every enemy arrived, so it passed —
// and the layout was bad. A long wall gives the whole horde one gap to path
// through, so they queue up and conga-line around it. "They arrived" and "they
// moved intelligently" are different claims, and only the second one matters.
//
// So this measures the shape of the route, not the endpoint:
//
//   efficiency  — straight-line distance / distance actually travelled, over
//                 the APPROACH ONLY. 1.0 is a perfect beeline. Detouring around
//                 an obstacle costs a little; walking the length of a wall to
//                 find its gap costs a lot.
//
//                 Approach-only matters. The first version of this test
//                 accumulated for the full run and the OPEN FLOOR build scored
//                 0.51 against its own threshold — because once an enemy
//                 arrives it orbits and strafes, piling up travelled distance
//                 with no net displacement, and shooters hold at range and
//                 never "arrive" at all. That is combat behaviour, not pathing.
//                 Each enemy's track now closes the moment it first gets within
//                 ARRIVED_PX, so only the route is measured.
//   reversals   — how often an enemy's heading flips by more than 90 degrees.
//                 This is the ADVANCE-oscillation signature from the git
//                 history: a body wedged on a corner shuffling back and forth.
//   funnelling  — the largest share of the horde crossing the same 160px gate
//                 of space. A high value is a conga line by definition.
//
// Run against the open-floor build it produces a BASELINE. Any future room
// geometry has to be compared against these numbers before it is believed.
// Per tests/README.md, the sampling happens INSIDE the page — a page.evaluate
// poll costs 200-400ms a round trip and would miss most of the movement.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// Thresholds are MEASURED, not guessed, and they are set where the two builds
// actually separate. Repeated runs of the open-floor build against the walled
// build from 7ac7ad7 (the one that failed on the phone):
//
//                    open floor (n=4)   walled (n=3)
//   mean efficiency    0.80 - 0.83       0.69 - 0.73
//   worst efficiency   0.68 - 0.72       0.49 - 0.57
//
// The first cut of this test used invented thresholds (mean 0.55) and PASSED
// the walled build — it would not have caught the very thing it was written
// for. Only MEAN efficiency separates the two builds reliably. Worst-case
// looked like the stronger signal at first (gap 0.11 vs 0.07) but is much
// noisier across runs — one later walled run scored 0.65 against an open run's
// 0.67 — so it is REPORTED but not gated on.
//
// Reversals and funnelling did not separate the builds either (max 3 vs 1,
// 46-50% vs 29%); both are kept as loose guards against gross wedging only.
//
// ── How much to trust one run ─────────────────────────────────────────────
// The gate sits at the midpoint of the observed distributions, ~0.03 from
// each. That is deliberately not a knife edge, but it is not much margin
// either: only ~5 of the ~8 spawned enemies arrive inside the window, so the
// mean moves with which ones happen to spawn. A SINGLE run is weak evidence.
// When judging new geometry, run it three times and compare the spread
// against the numbers above — do not read one number and conclude.
const ARRIVED_PX       = 260;  // inside this, movement is combat not approach
const MIN_EFFICIENCY   = 0.76; // open >= 0.79, walled <= 0.73
const MAX_REVERSALS    = 6;
const MAX_FUNNEL_SHARE = 0.75;

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => fail(`page error: ${e}`));

await page.goto(URL);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => {
  const t = window.game?.scene?.getScene('Title');
  if (t?.sys?.isActive()) t.scene.start('Game');
});
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(2000);

const debugUrl = await page.evaluate(() =>
  performance.getEntriesByType('resource').map((r) => r.name).find((n) => /systems\/debug\.js/.test(n)));
await page.evaluate(async (u) => { (await import(u)).setGodMode(true); }, debugUrl);

const result = await page.evaluate(async (ARRIVED_PX) => {
  const gs = window.game.scene.getScene('Game');
  const PX = 200, PY = 700;          // park the player; enemies must come to us
  const tracks = new Map();

  // Sample from a postupdate hook rather than from Node — see the note above.
  const onUpdate = () => {
    gs.player.setPosition(PX, PY);
    for (const e of gs.enemies.getChildren()) {
      if (!e.alive) continue;
      let t = tracks.get(e);
      if (!t) {
        t = { x0: e.x, y0: e.y, x: e.x, y: e.y, travelled: 0, reversals: 0,
              hx: 0, hy: 0, ys: [], done: false };
        tracks.set(e, t);
      }
      // Close the track on arrival: everything after this is strafing.
      if (!t.done && Math.hypot(e.x - PX, e.y - PY) <= ARRIVED_PX) {
        t.done = true; t.xEnd = e.x; t.yEnd = e.y;
      }
      if (t.done) { t.x = e.x; t.y = e.y; continue; }
      const dx = e.x - t.x, dy = e.y - t.y;
      const step = Math.hypot(dx, dy);
      if (step > 0.5) {
        t.travelled += step;
        const nx = dx / step, ny = dy / step;
        // dot < 0 means the heading flipped by more than 90 degrees
        if (t.hx || t.hy) { if (nx * t.hx + ny * t.hy < 0) t.reversals++; }
        t.hx = nx; t.hy = ny;
        // record crossings of the vertical band just east of the player, which
        // is where a funnel would show up
        if (t.x > 700 && e.x <= 700) t.ys.push(e.y);
      }
      t.x = e.x; t.y = e.y;
    }
  };
  gs.events.on('postupdate', onUpdate);
  await new Promise((r) => setTimeout(r, 12000));
  gs.events.off('postupdate', onUpdate);

  const per = [];
  const crossings = [];
  let neverArrived = 0;
  for (const [, t] of tracks) {
    if (t.travelled < 120) continue;   // never really moved; nothing to judge
    if (!t.done) { neverArrived++; continue; } // still en route at cutoff
    const straight = Math.hypot(t.xEnd - t.x0, t.yEnd - t.y0);
    per.push({
      efficiency: straight / t.travelled,
      reversals: t.reversals,
      travelled: Math.round(t.travelled),
    });
    crossings.push(...t.ys);
  }

  // Funnelling: bucket the crossing points into 160px bands and take the
  // biggest share. One gap taking almost everything is a conga line.
  let funnel = 0;
  if (crossings.length >= 3) {
    const buckets = new Map();
    for (const y of crossings) {
      const b = Math.floor(y / 160);
      buckets.set(b, (buckets.get(b) || 0) + 1);
    }
    funnel = Math.max(...buckets.values()) / crossings.length;
  }
  return { per, funnel, crossings: crossings.length,
           neverArrived, room: gs.roomSpec?.id };
}, ARRIVED_PX);

await browser.close();

const { per, funnel, crossings, room, neverArrived } = result;
if (per.length < 3) fail(`only ${per.length} enemies moved enough to measure`);

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const meanEff = avg(per.map((p) => p.efficiency));
const worstEff = Math.min(...per.map((p) => p.efficiency));
const maxRev = Math.max(...per.map((p) => p.reversals));

console.log(`room=${room}  measured=${per.length}  never-arrived=${neverArrived}`);
console.log(`  efficiency  mean ${meanEff.toFixed(2)} (min ${MIN_EFFICIENCY})  worst ${worstEff.toFixed(2)} (reported, too noisy to gate)`);
console.log(`  reversals   max  ${maxRev}                     (max ${MAX_REVERSALS})`);
console.log(`  funnelling  ${(funnel * 100).toFixed(0)}% of ${crossings} crossings through one 160px band  (max ${MAX_FUNNEL_SHARE * 100}%)`);

if (meanEff < MIN_EFFICIENCY) fail(`enemies are taking the long way round (mean efficiency ${meanEff.toFixed(2)}, open floor measures 0.80+)`);
if (maxRev > MAX_REVERSALS) fail(`an enemy reversed heading ${maxRev} times — oscillation, probably wedged on geometry`);
if (funnel > MAX_FUNNEL_SHARE) fail(`${(funnel * 100).toFixed(0)}% of the horde used one gap — conga line`);

console.log('PASS: enemies take direct routes, no oscillation, no single-gap funnel');
