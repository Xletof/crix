// Boss phase transitions.
//
// The boss is the climax of the campaign and had zero coverage. Every phase
// change routes through Boss.enterPhase (src/entities/Boss.js:74), which is
// also what drives the music director's phase stings and the HUD, so a silent
// regression here breaks three systems at once and only shows up by playing
// all the way to room 4.
//
// This is a LOGIC test, not a measurement: it drives hp directly and asserts on
// state and event counts. That matters — smoke-pathing had to be demoted to a
// diagnostic because a ~3-enemy sample on a 20fps headless harness is too
// noisy to gate on. Nothing here depends on frame timing, so it can gate.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

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
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { ROOMS } = await import('/src/data/rooms.js');
  const { BOSS } = await import('/src/config.js');

  const vader = ROOMS.find((s) => s.boss);
  gs.loadRoom(vader);
  await new Promise((res) => setTimeout(res, 1500));
  // In play the boss arrives only after the room's waves are survived. Call the
  // same entry point GameScene uses (spawnBoss, :1524) rather than fighting
  // three waves to get here — this is the production path, just not the
  // production trigger.
  gs.spawnBoss(vader.bossSpawn.x, vader.bossSpawn.y);
  await new Promise((res) => setTimeout(res, 800));
  if (!gs.boss) return { err: 'spawnBoss did not create a boss' };

  // Record every phase event so we can prove each fires exactly once.
  const events = [];
  gs.events.on('boss-phase', (p) => events.push(p));

  const b = gs.boss;
  const hpMax = b.hpMax;
  const seen = [];
  const setRatio = (ratio) => {
    b.hp = hpMax * ratio;
    // enterPhase is driven from the boss's own update; step it directly rather
    // than waiting on frames, so the test does not depend on the clock.
    b.preUpdate(performance.now(), 16);
    seen.push({ ratio, phase: b.phase });
  };

  const startPhase = b.phase;
  setRatio(0.90);   // above phase2 — must not advance
  setRatio(0.67);   // just above the 0.66 threshold
  setRatio(0.65);   // crosses phase2
  const afterP2 = b.phase;
  setRatio(0.50);   // still phase 2
  const midP2 = b.phase;
  setRatio(0.32);   // crosses phase3
  const afterP3 = b.phase;
  setRatio(0.10);   // stays phase 3, must not emit again
  const afterLow = b.phase;

  // Phases must never run backwards, even if hp is restored.
  b.hp = hpMax * 0.95;
  b.preUpdate(performance.now(), 16);
  const afterHeal = b.phase;

  return {
    thresholds: { p2: BOSS.phase2, p3: BOSS.phase3 },
    startPhase, afterP2, midP2, afterP3, afterLow, afterHeal,
    seen, events,
  };
});

await browser.close();

if (r.err) fail(r.err);

const count = (p) => r.events.filter((e) => e === p).length;
console.log(`thresholds  phase2 <= ${r.thresholds.p2}   phase3 <= ${r.thresholds.p3}`);
console.log(`hp ratio -> phase:  ${r.seen.map((s) => `${s.ratio}:${s.phase}`).join('  ')}`);
console.log(`boss-phase events: [${r.events.join(', ')}]`);

if (r.startPhase !== 1) fail(`boss should start in phase 1, got ${r.startPhase}`);
if (r.seen[1].phase !== 1) fail(`0.67 is above the ${r.thresholds.p2} threshold but the boss advanced to phase ${r.seen[1].phase}`);
if (r.afterP2 !== 2) fail(`crossing ${r.thresholds.p2} should enter phase 2, got ${r.afterP2}`);
if (r.midP2 !== 2) fail(`0.50 is between the thresholds and should stay phase 2, got ${r.midP2}`);
if (r.afterP3 !== 3) fail(`crossing ${r.thresholds.p3} should enter phase 3, got ${r.afterP3}`);
if (r.afterLow !== 3) fail(`phase should cap at 3, got ${r.afterLow}`);
if (r.afterHeal !== 3) fail(`healing the boss must not walk the phase back, got ${r.afterHeal}`);

// Each phase fires exactly once — the music stings and HUD react to this event,
// so a double-fire is as bad as a miss.
if (count(2) !== 1) fail(`boss-phase 2 fired ${count(2)} times, expected exactly 1`);
if (count(3) !== 1) fail(`boss-phase 3 fired ${count(3)} times, expected exactly 1`);

console.log('PASS: phases fire once each at the configured thresholds and never reverse');
