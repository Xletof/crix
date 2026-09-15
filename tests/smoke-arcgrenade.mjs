// THE ARC GRENADE — PHASE B.2.2, STRUCTURAL ONLY.
//
// IT ASSERTS NOTHING ABOUT TASTE. Whether the field reads as Shock Captain
// technology, whether the throw is satisfying, whether it changes the player's
// route — those are handset questions, and this project has already frozen one
// opinion into a passing check and protected a rejected actor with it.
//
// What it protects is what this class can lose invisibly:
//   - the grenade is a REAL TRAVELLING OBJECT, not a field that appears on the
//     floor: it has a flight, it has altitude, and it hurts nobody until it is
//     live
//   - the visual bound and the hit test agree — nothing outside the drawn
//     radius is ever inside `contains`
//   - it cleans up on expiry, on the Captain's death, and on a room change,
//     and all three are idempotent
//   - the movement penalty cannot leak into the run
//   - one at a time, on a cooldown, and never in a normal Endless room
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:5173/';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const checks = [];
const check = (ok, label, detail) => { checks.push({ ok, label, detail }); };

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function run(query, fn) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => fail(`page error (${query}): ${e}`));
  await page.goto(BASE + query);
  await page.waitForTimeout(4500);
  await page.mouse.click(360, 640);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 5150 }));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForTimeout(2200);
  const out = await fn(page);
  await page.close();
  return out;
}

// ── 1. THE CHAIN, SAMPLED FROM INSIDE THE PAGE ─────────────────────────────
// A `page.evaluate` poll costs 200-400ms a round trip and the whole flight is
// 620ms, so a polled instrument would miss the phase it is asking about.
const chain = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  gs.lives = 9999;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.enemies.getChildren().filter((e) => e.alive && !e.isChampion)
    .forEach((e) => e.destroy());
  gs.arenaActive = false;

  let c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
  if (!c) c = gs.spawnChampion(gs.player.x + 400, gs.player.y, 'captain');
  c.die = () => { c.hp = Math.max(c.hp, c.hpMax * 0.5); };

  const L = {
    phases: [], states: [], thrown: 0, live: 0,
    // Is `contains` ever true before the field is live? That is the whole
    // "a thrown object is not a hazard" claim.
    earlyContains: 0, containsOutsideRadius: 0, maxContainRadius: 0,
    altitudes: [], flightPositions: [], hadWindup: false, hadThrow: false,
    dragSeen: 0, dragValues: [],
  };
  let nade = null;
  gs.events.on('champion-arc-grenade', (cap, g) => { L.thrown++; nade = g; });
  gs.events.on('arc-field-live', () => { L.live++; });

  const hook = () => {
    if (c._cap === 'windup') L.hadWindup = true;
    if (c._cap === 'throw') L.hadThrow = true;
    if (L.states[L.states.length - 1] !== c._cap) L.states.push(c._cap);
    const g = nade;
    if (!g || g.dead) return;
    const ph = g.phase;
    if (L.phases[L.phases.length - 1] !== ph) L.phases.push(ph);
    if (ph !== 'field') {
      // A point at the dead centre of the landing site: if THAT is not inside
      // during flight or arming, nothing is.
      if (g.contains(g.x, g.y)) L.earlyContains++;
    } else {
      // THE SHAPE IS THE HIT TEST. Walk a ring just outside the drawn radius
      // at eight bearings: none of it may be claimed.
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        const r = g.radius + 2;
        if (g.contains(g.x + Math.cos(a) * r, g.y + Math.sin(a) * r)) L.containsOutsideRadius++;
      }
      L.maxContainRadius = g.radius;
    }
    const p = gs.player;
    if (p._envDrag !== undefined && p._envDrag < 1) { L.dragSeen++; L.dragValues.push(p._envDrag); }
  };
  gs.events.on('postupdate', hook);

  // Arm it and let the REAL AI decide to use it — the debug path clears a
  // cooldown and nothing else, so the throw that is measured is a throw a
  // player could have caused.
  c._nadeCd = 0;
  await wait(9000);
  gs.events.off('postupdate', hook);

  const g = nade;
  return {
    ...L,
    threw: L.thrown,
    cooldownAfter: Math.round(c._nadeCd),
    cfgCooldown: c.def.grenade.cooldownMs,
    landedAway: g ? Math.round(Math.hypot(g.x - g.x0, g.y - g.y0)) : 0,
    radius: g?.radius ?? 0,
    stillLive: !!(g && !g.dead),
  };
}));

check(chain.threw >= 1, 'the real AI chooses to throw once the cooldown is clear',
  `${chain.threw} throws`);
check(chain.hadWindup && chain.hadThrow,
  'the body performs it — a wind-up state and a release state, not a spawn',
  `windup=${chain.hadWindup} throw=${chain.hadThrow}`);
check(chain.phases[0] === 'flight',
  'it begins in FLIGHT: a real travelling object before it is ever a field',
  `phases ${chain.phases.join(' -> ')}`);
check(chain.phases.includes('arm') && chain.phases.includes('field'),
  'it lands, arms with a tell, and only then goes live',
  `phases ${chain.phases.join(' -> ')}`);
check(chain.earlyContains === 0,
  'nothing is dangerous before the field is live — not the flight, not the arming',
  `${chain.earlyContains} frames claimed ground early`);
check(chain.containsOutsideRadius === 0,
  'the hit test never claims ground outside the drawn radius',
  `${chain.containsOutsideRadius} claims outside r=${chain.radius}`);
check(chain.landedAway > 60,
  'it travels — the landing point is not the hand it left',
  `${chain.landedAway}px`);
check(chain.live >= 1, 'the field announces itself when it opens', `${chain.live} activations`);
check(chain.dragSeen === 0 || chain.dragValues.every((v) => v >= 0.5),
  'the movement penalty is restrained — a slow, never a root',
  `min ${Math.min(1, ...chain.dragValues)}`);

// ── 2. IT DIES WITH ITS OWNER, AND IT DIES WITH THE ROOM ───────────────────
const sweep = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  gs.lives = 9999;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const spawn = async () => {
    const c = gs.spawnChampion(gs.player.x + 380, gs.player.y, 'captain');
    c._nadeCd = 0;
    for (let i = 0; i < 90 && !c._nade; i++) await wait(120);
    return c;
  };

  // (a) the owner dies mid-flight.
  const c1 = await spawn();
  const hadFlight = !!c1._nade;
  const before = gs._hazards.length;
  c1.hp = 1; c1.damage(99999, null);
  await wait(200);
  const afterDeath = gs._hazards.filter((h) => !h.dead).length;
  // Killing twice must not throw: every teardown route is idempotent.
  let doubleOk = true;
  try { c1._dropGrenade(); c1._dropGrenade(); } catch (e) { doubleOk = false; }

  // (b) the room changes while a field is live.
  const c2 = await spawn();
  const hadSecond = !!c2._nade;
  const nade2 = c2._nade;
  gs.clearHazards();
  await wait(120);
  const afterClear = gs._hazards.filter((h) => !h.dead).length;
  let clearTwiceOk = true;
  try { gs.clearHazards(); nade2?.destroy(); } catch (e) { clearTwiceOk = false; }

  // (c) THE DRAG CANNOT LEAK. `Player.preUpdate` resets it every frame, so a
  // field removed mid-slow leaves the player at full speed within one frame.
  gs.player._envDrag = 0.4;
  await wait(200);
  const dragAfter = gs.player._envDrag;
  const moveMult = gs.player.moveMult;

  return { hadFlight, before, afterDeath, doubleOk, hadSecond, afterClear,
    clearTwiceOk, dragAfter, moveMult };
}));
check(sweep.hadFlight && sweep.afterDeath === 0,
  "the Captain's death takes his own field with it",
  `${sweep.afterDeath} live hazards after he died`);
check(sweep.doubleOk, 'tearing it down twice is a no-op, not an error');
check(sweep.hadSecond && sweep.afterClear === 0,
  'a room change sweeps it — it is on the hazard list, not a private object',
  `${sweep.afterClear} live hazards after clearHazards`);
check(sweep.clearTwiceOk, 'the room sweep and the object sweep can both run, in any order');
check(sweep.dragAfter === 1,
  'the movement penalty cannot leak — it is reset every frame by the consumer',
  `_envDrag ${sweep.dragAfter}`);
check(sweep.moveMult === 1,
  'and it never touches the permanent upgrade multiplier',
  `moveMult ${sweep.moveMult}`);

// ── 3. NOT IN A NORMAL RUN ─────────────────────────────────────────────────
const off = await run('?nodlg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs._startWave(0);
  await wait(3000);
  return {
    champions: gs.enemies.getChildren().filter((e) => e.alive && e.isChampion).length,
    arcFields: gs._hazards.filter((h) => !h.dead && h.radius !== undefined
      && typeof h.phase === 'string').length,
  };
}));
check(off.champions === 0 && off.arcFields === 0,
  'normal Endless still has no Champion, and so no Arc Grenade',
  `${off.champions} champions, ${off.arcFields} fields`);

await browser.close();
for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — thrown, travelled, landed, armed, bounded, and swept`);
