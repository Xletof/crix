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

// Thresholds are MEASURED, not guessed, and set where the builds separate.
// Against the walled build from 7ac7ad7 — the one that failed on the phone:
//
//                     current (props)   walled
//   mean efficiency   0.78 0.78 0.78    0.71 0.67 0.72
//
// ── This is a DIAGNOSTIC, not a gate ──────────────────────────────────────
//
// Those numbers are real and the separation is real, but only when both sides
// are measured back to back on an idle machine. As a standing pass/fail check
// it flaked three different ways: "0 enemies moved enough to measure" inside
// full-suite runs, mean dipping under the bound on a small sample, and the
// reversal guard reporting 10 under suite load where it reports 2 standalone
// every time. Each was a genuine measurement bug and each fix helped, but the
// sample is ~3 enemies on a ~20fps headless harness and that is simply not
// enough to gate on.
//
// So this reports the numbers and fails only on things that mean the RUN is
// broken rather than the game: nothing measurable, or an efficiency above 1.0
// (impossible by the triangle inequality, so the sampler lost movement).
//
// Use it as an A/B: run it on the current build, make the geometry change, run
// it again, and compare. That is the job it is good at, and it is how the
// walled build was caught. A single number in isolation means little.
//
// ── Three things this test got wrong before it worked ─────────────────────
//
// 1. It measured COMBAT as if it were pathing. Accumulating for the whole
//    window, the open-floor build scored 0.51 against its own 0.55 threshold,
//    because an arrived enemy orbits and strafes and a shooter never closes at
//    all. Each track now ends the moment its enemy first gets within
//    ARRIVED_PX.
//
// 2. Its thresholds were invented, so it PASSED the walled build — the exact
//    thing it existed to catch. Thresholds now come from A/B runs.
//
// 3. Its population drifted. Tracking every enemy in the scene meant the
//    sample grew as the wave spawner dripped more in, and those arrive at a
//    gate mid-fight where they are dodging and taking knockback — messy for
//    reasons that are not pathfinding. Widening the window to gather more of
//    them made variance WORSE (0.82/0.80/0.72/0.71, worst-case down to 0.19).
//    Restricting it to the cohort alive at t=0 — the room's scripted spawns —
//    dropped variance to nil: 0.78 four times running.
//
//    That is also why the loop waits for ARRIVALS rather than a fixed
//    wall-clock window. The old fixed 12s failed inside full-suite runs with
//    "0 enemies moved enough to measure" while passing standalone, because a
//    loaded machine buys fewer simulation steps per second.
//
// Reversals and funnelling never separated the builds and are kept only as
// loose guards against gross wedging. Worst-case efficiency is reported but
// not gated: it looked like the stronger signal early on and is not.
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

  // Only the enemies that exist at t=0 — the room's SCRIPTED spawns.
  //
  // Letting the sample grow as the wave spawner drips more in confounds the
  // measurement badly: enemies that appear at a gate mid-fight are dodging,
  // strafing and taking knockback, so their routes are messy for reasons that
  // have nothing to do with pathfinding. Widening the window to catch more of
  // them made variance WORSE, not better (0.82/0.80/0.72/0.71 with worst-case
  // values as low as 0.19). A fixed cohort keeps the population deterministic.
  const cohort = new Set(gs.enemies.getChildren().filter((e) => e.alive));

  // Sample from a postupdate hook rather than from Node — see the note above.
  const onUpdate = () => {
    gs.player.setPosition(PX, PY);
    for (const e of cohort) {
      let t = tracks.get(e);
      if (!t) {
        t = { x0: e.x, y0: e.y, x: e.x, y: e.y, travelled: 0, reversals: 0,
              hx: 0, hy: 0, ys: [], done: false, dark: 0 };
        tracks.set(e, t);
      }
      // Count frames where the enemy is not `alive` and DISCARD its track
      // below if there are any. A bomber spends about half its approach in a
      // non-alive dive state; skipping those frames drops real displacement
      // from `travelled` while the straight-line term still counts it, which
      // pushed efficiency above 1.0 — impossible by construction, and the
      // symptom that exposed this. An enemy that de-materialises mid-approach
      // is not measuring pathfinding either way.
      if (!e.alive) { t.dark++; continue; }
      // Close the track on arrival: everything after this is strafing.
      if (!t.done && Math.hypot(e.x - PX, e.y - PY) <= ARRIVED_PX) {
        t.done = true; t.xEnd = e.x; t.yEnd = e.y;
      }
      if (t.done) { t.x = e.x; t.y = e.y; continue; }
      const dx = e.x - t.x, dy = e.y - t.y;
      const step = Math.hypot(dx, dy);
      // Accumulate EVERY step. An earlier version only counted steps > 0.5px,
      // which silently undercounted distance travelled on slow frames while
      // the straight-line term stayed exact — so efficiency could exceed 1.0,
      // which is impossible by construction. It went unnoticed in this room
      // because its enemies move far enough per frame; a slower room exposed
      // it at 1.05.
      t.travelled += step;
      // Heading still needs a deadband: normalising a sub-pixel step gives a
      // direction that is mostly float noise and would invent reversals.
      if (step > 0.5) {
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
  // Sample until enough enemies have ARRIVED, not for a fixed wall-clock
  // window. The fixed 12s version failed inside full-suite runs with "0
  // enemies moved enough to measure" while passing standalone: the game's
  // simulation rate drops when the machine is loaded, so a wall-clock window
  // buys fewer sim steps and fewer enemies finish their approach. Waiting on
  // the thing actually being measured makes the test independent of how fast
  // the host happens to be.
  const WANT = Math.max(3, Math.ceil(cohort.size * 0.6)), CAP_MS = 30000;
  const t0 = Date.now();
  gs.events.on('postupdate', onUpdate);
  for (;;) {
    await new Promise((r) => setTimeout(r, 250));
    let arrived = 0;
    for (const [, t] of tracks) if (t.done) arrived++;
    if (arrived >= WANT || Date.now() - t0 > CAP_MS) break;
  }
  const elapsedMs = Date.now() - t0;
  gs.events.off('postupdate', onUpdate);

  const per = [];
  const crossings = [];
  let neverArrived = 0;
  let darkDropped = 0;
  for (const [, t] of tracks) {
    if (t.dark > 0) { darkDropped++; continue; }  // see the note above
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
  return { per, funnel, crossings: crossings.length, cohort: cohort.size,
           neverArrived, darkDropped, elapsedMs, room: gs.roomSpec?.id };
}, ARRIVED_PX);

await browser.close();

const { per, funnel, crossings, room, neverArrived, elapsedMs, cohort, darkDropped } = result;
if (per.length < 3) fail(`only ${per.length} enemies moved enough to measure`);
// Guard the invariant directly. straight-line / travelled is <= 1 by the
// triangle inequality, so anything above it means the sampler lost distance
// and every number in this run is untrustworthy — fail loudly rather than
// report a flattering figure.
const over = per.filter((p) => p.efficiency > 1.001);
if (over.length) fail(`efficiency ${over[0].efficiency.toFixed(2)} exceeds 1.0 — the sampler is dropping movement, not the game pathing well`);

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const meanEff = avg(per.map((p) => p.efficiency));
const worstEff = Math.min(...per.map((p) => p.efficiency));
const maxRev = Math.max(...per.map((p) => p.reversals));

console.log(`room=${room}  cohort=${cohort}  measured=${per.length}  never-arrived=${neverArrived}  dropped-non-alive=${darkDropped}  window=${(elapsedMs / 1000).toFixed(1)}s`);
console.log(`  efficiency  mean ${meanEff.toFixed(2)} (min ${MIN_EFFICIENCY})  worst ${worstEff.toFixed(2)} (reported, too noisy to gate)`);
console.log(`  reversals   max  ${maxRev}                     (max ${MAX_REVERSALS})`);
console.log(`  funnelling  ${(funnel * 100).toFixed(0)}% of ${crossings} crossings through one 160px band  (max ${MAX_FUNNEL_SHARE * 100}%)`);

// Advisory only — printed for comparison, never fatal. See the note above.
const notes = [];
if (meanEff < MIN_EFFICIENCY) notes.push(`mean ${meanEff.toFixed(2)} is below the ${MIN_EFFICIENCY} reference (walled build measured 0.67-0.72)`);
if (maxRev > MAX_REVERSALS) notes.push(`${maxRev} heading reversals — check for a wedge if this repeats standalone`);
if (funnel > MAX_FUNNEL_SHARE) notes.push(`${(funnel * 100).toFixed(0)}% of crossings used one gap — possible funnel`);
if (notes.length) {
  console.log('NOTE: ' + notes.join('; '));
  console.log('      Re-run standalone before believing it; this is a diagnostic, not a gate.');
}

console.log(`PASS (diagnostic): mean efficiency ${meanEff.toFixed(2)}, ${maxRev} max reversals, ${(funnel * 100).toFixed(0)}% funnel`);
