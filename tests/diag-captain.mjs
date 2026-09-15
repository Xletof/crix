// DIAG — THE SHOCK CAPTAIN'S STATE LANGUAGE, MEASURED IN A REAL ENCOUNTER.
//
//   node tests/diag-captain.mjs [archetype] [room]
//
// It asks three questions a screenshot cannot: does each reaction fire when its
// authoritative state actually changes, does it fire ONCE, and how often does a
// glyph land — because the failure mode for this whole layer is punctuation
// becoming weather. Sampled from inside the page on `postupdate`; a
// `page.evaluate` poll costs 200-400ms a round trip and would miss a 620ms
// glyph entirely.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const ARCH = process.argv[2] || 'crossfire';
const ROOM = process.argv[3] || 'hangar';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e));

await page.goto(`http://localhost:5173/?nodlg=1&nofreeze=1&champdbg=1&encdbg=${ARCH}&room=${ROOM}&sector=8`);
await page.waitForTimeout(4500);
await page.mouse.click(360, 640);
await page.waitForTimeout(800);
await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 4242 }));
await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
await page.waitForTimeout(3000);

const out = await page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  gs.lives = 9999;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let c = gs.enemies.getChildren().find((e) => e.alive && e.isChampion);
  if (!c) c = gs.spawnChampion(gs.player.x + 420, gs.player.y, 'captain');

  const L = {
    frames: 0, glyphs: [], events: [], fxPeak: 0, queuePeak: 0,
    armourBreaks: 0, lowHealth: 0, reacquires: 0, staggers: 0,
    smoke: 0, sparkBursts: 0, flickerFrames: 0, alphaMin: 1,
  };
  const t0 = performance.now();
  const T = () => Math.round(performance.now() - t0);

  gs.events.on('champion-armour-broken', () => { L.armourBreaks++; L.events.push(['armour', T()]); });
  gs.events.on('champion-low-health', () => { L.lowHealth++; L.events.push(['low', T()]); });
  gs.events.on('champion-reacquire', () => { L.reacquires++; L.events.push(['acquire', T()]); });
  // Count glyphs at the point they are actually PUT ON SCREEN, not queued: the
  // queue is what sequences them and a count of intents would hide a drop.
  const realSpawn = c._spawnGlyph.bind(c);
  c._spawnGlyph = (key, o) => { L.glyphs.push([key, T()]); return realSpawn(key, o); };
  // `ventSmoke`, not `smokeTrail`. Wrapping the method the code USED to call
  // reports zero on a working effect — this instrument said "0 smoke puffs"
  // for two whole arenas after the emitter was changed underneath it.
  const realSmoke = gs.fx.ventSmoke.bind(gs.fx);
  gs.fx.ventSmoke = (...a) => { L.smoke++; return realSmoke(...a); };
  // A VISOR FLICKER IS 90ms AND THIS HARNESS RUNS AT ~9fps, so counting the
  // FRAMES it is held measures the machine's frame rate and reports zero on a
  // working effect. Count the TRIGGER instead — `_wearFlickerT` rearming is
  // the event, and it is the same event at 60fps.
  let lastFlickT = c._wearFlickerT;
  L.flickers = 0;

  let lastCap = null;
  // THE MEASURED ACTOR DOES NOT DIE, and that is an instrument choice with a
  // cost. `diag-encounter` makes the player immortal for the same reason: a
  // death cuts the measurement short, and the question here is what the
  // SUSTAINED low-health state looks like over time — which cannot be answered
  // by a Captain who reaches it and is gone two seconds later. The floor is
  // applied in the sampler, so every threshold below it is still crossed
  // honestly through the real `damage()` path.
  const FLOOR = 0.14;
  // AND IT IS MADE IMMORTAL EXPLICITLY, not by tuning the damage down until it
  // happens to survive. Clamping hp in the sampler is not enough: a 620 hit
  // lands between frames and `Enemy.damage` calls `die()` before any clamp can
  // run, so the run kept ending at ~13s with the sustained state unobserved.
  // Stubbing `die` is the same choice `diag-encounter` makes for the player and
  // it has the same caveat — this measures BEHAVIOUR OVER TIME, never fight
  // length, and every threshold below is still crossed through the real
  // `damage()` path.
  c.die = () => { c.hp = Math.max(c.hp, c.hpMax * FLOOR); };
  const hook = () => {
    if (!c.alive) return;
    if (c.hp < c.hpMax * FLOOR) c.hp = c.hpMax * FLOOR;
    L.frames++;
    L.fxPeak = Math.max(L.fxPeak, c._reactFx.length);
    L.queuePeak = Math.max(L.queuePeak, c._punctQueue.length);
    if (c._flickerHold > 0) L.flickerFrames++;
    if (c._wearFlickerT > lastFlickT) L.flickers++;
    lastFlickT = c._wearFlickerT;
    L.alphaMin = Math.min(L.alphaMin, c.alpha);
    if (c._cap === 'stagger' && lastCap !== 'stagger') L.staggers++;
    lastCap = c._cap;
  };
  gs.events.on('postupdate', hook);

  // A REAL FIGHT, NOT A RIG. The player circuits the arena so line of sight,
  // range and the crowd all change the way they do in play, and the Captain is
  // damaged through the ordinary `damage()` path throughout. The schedule is
  // deliberate only in WHEN the two big commitments land — everything else is
  // ordinary chip, which is exactly the mix the anti-stunlock rule is about.
  const b = gs.physics.world.bounds;
  const pts = [[0.25, 0.3], [0.75, 0.25], [0.8, 0.75], [0.3, 0.8], [0.5, 0.5]];
  let chip = 0;
  const BIG_AT = [5200, 13000, 17500, 22000];     // ms into the run
  const fired = new Set();
  for (let lap = 0; lap < 7 && c.alive; lap++) {
    for (const [fx, fy] of pts) {
      if (!c.alive) break;
      const tx = b.x + b.width * fx, ty = b.y + b.height * fy;
      const until = performance.now() + 1500;
      while (performance.now() < until && c.alive) {
        gs.player._moveTargetX = tx; gs.player._moveTargetY = ty;
        c.damage(34, { x: 6, y: 0 });
        if (c.alive && c.hp < c.hpMax * FLOOR) c.hp = c.hpMax * FLOOR;
        chip++;
        for (const t of BIG_AT) {
          if (T() >= t && !fired.has(t)) {
            fired.add(t);
            // Big enough to break the layer on the first one and to stagger on
            // the rest — the same commitment a Super or a landed melee is.
            c.damage(t === BIG_AT[0] ? 2900 : 620, { x: -260, y: 40 });
            if (c.alive && c.hp < c.hpMax * FLOOR) c.hp = c.hpMax * FLOOR;
          }
        }
        await wait(70);
      }
    }
  }
  gs.events.off('postupdate', hook);

  return {
    ...L, chip, durMs: T(), alive: c.alive,
    hp: Math.round(c.hp), hpMax: c.hpMax, broken: c.armourBroken,
    lowFired: c._lowHealthFired,
    fxLeft: c._reactFx.length, queueLeft: c._punctQueue.length, embers: !!c._embers,
  };
});

const per10s = (n) => (n / (out.durMs / 10000)).toFixed(1);
console.log(`\n  ${ARCH} / ${ROOM} — ${out.durMs}ms, ${out.frames} frames, ${out.chip} chip hits`);
console.log(`  transitions   armour ${out.armourBreaks} · low ${out.lowHealth} · reacquire ${out.reacquires} · staggers ${out.staggers}`);
console.log(`  glyphs        ${out.glyphs.length} total = ${per10s(out.glyphs.length)} / 10s`);
for (const [k, t] of out.glyphs) console.log(`                ${String(t).padStart(6)}ms  ${k}`);
console.log(`  sustained     smoke puffs ${out.smoke} (${per10s(out.smoke)}/10s) · visor flickers ${out.flickers} (${per10s(out.flickers)}/10s)`);
// One owned object is expected to remain while he is alive and damaged: the
// ember Graphics is the PERSISTENT half of the state language and is redrawn
// every frame. Anything above that is a leak.
console.log(`  owned FX      peak ${out.fxPeak} live, queue peak ${out.queuePeak}, left at end ${out.fxLeft} (embers=${out.embers}) / queue ${out.queueLeft}`);
console.log(`  final         hp ${out.hp}/${out.hpMax} · broken ${out.broken} · lowFired ${out.lowFired} · alive ${out.alive}\n`);
await browser.close();
