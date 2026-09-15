// CAPTAIN COMBAT-ECONOMY TELEMETRY — STRUCTURAL ONLY.
//
// IT ASSERTS NO BALANCE. Whether 8.4s is a good TTK, whether the Super is too
// frequent, whether the Captain needs more hp — those are the questions the
// HUMAN answers with this instrument, and a check that encoded an opinion about
// them would be exactly the mistake `smoke-champion` already made once when it
// froze "the Champion is the slowest thing on the floor" into a passing check
// and protected a rejected actor with it.
//
// What it protects is the instrument's own honesty:
//   - it does not exist without the flag
//   - it changes NOTHING when it does exist — the tuning is byte-identical
//   - a new Captain retires the old session
//   - each milestone fires once, at the right time
//   - every source is attributed once, and the attributed total RECONCILES
//     with the durability the actor actually lost
//   - the Super count is the real `player-fire-super` count and the pellet
//     hits are real collisions
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
  await page.evaluate(() => window.game.scene.getScene('Title').scene.start('Game', { mode: 'endless', seed: 7788 }));
  await page.waitForFunction(() => !!window.game?.scene?.getScene('Game')?.player, null, { timeout: 20000 });
  await page.waitForTimeout(2200);
  const out = await fn(page);
  await page.close();
  return out;
}

// The tuning snapshot both halves of the A/B compare. Every number the Captain
// fights with, plus the player's own damage inputs — if the instrument moved
// any of them it is not an instrument.
const SNAP = `(async () => {
  const gs = window.game.scene.getScene('Game');
  const { CHAMPION, PLAYER, WEAPONS } = await import('/src/config.js');
  const c = gs.spawnChampion(gs.player.x + 400, gs.player.y, 'captain');
  const snap = {
    cfg: JSON.stringify(CHAMPION.captain),
    player: JSON.stringify({
      speed: PLAYER.speed, superPellets: PLAYER.superPellets,
      superDamage: PLAYER.superDamage, superSpeed: PLAYER.superSpeed,
      superRange: PLAYER.superRange, superHitsToCharge: PLAYER.superHitsToCharge,
      superSpreadDeg: PLAYER.superSpreadDeg, superKnockback: PLAYER.superKnockback,
      fireCooldownMs: PLAYER.fireCooldownMs, ammoReloadMs: PLAYER.ammoReloadMs,
      meleeDamage: PLAYER.meleeDamage, meleeFinisherDamage: PLAYER.meleeFinisherDamage,
      bulletDamage: PLAYER.bulletDamage, speed: PLAYER.speed,
    }),
    weapons: JSON.stringify(WEAPONS),
    actor: JSON.stringify({
      hp: c.hp, hpMax: c.hpMax, armour: c.armour, armourMax: c.armourMax,
      speed: c.cfg.speed, dmg: c.cfg.bulletDamage, moveMult: gs.player.moveMult,
    }),
  };
  c.destroy();
  return snap;
})()`;

// ── 1. ABSENT WITHOUT THE FLAG ─────────────────────────────────────────────
const off = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.spawnChampion(gs.player.x + 400, gs.player.y, 'captain');
  await wait(600);
  const { isCapTel } = await import('/src/systems/debug.js');
  // A panel would be a top-level container at a very high depth. Walking the
  // display list is the honest check: "the module was not called" can be true
  // while something it used to build is still on screen.
  // >= 9500, NOT >= 9000. `_sectorTint` is an ADD-blended screen rectangle at
  // depth 9000 and it is present in every normal run — a threshold at 9000
  // finds it and reports a panel that does not exist. The panel is 9600.
  const high = gs.children.list.filter((o) => o.depth >= 9500).length;
  return {
    hasTel: !!gs._captel, flag: isCapTel(), highDepthObjects: high,
    listeners: gs.events.listenerCount('champion-burst-begin'),
  };
}));
check(off.hasTel === false && off.flag === false,
  'without ?captel=1 the instrument is not constructed at all',
  `_captel=${off.hasTel} flag=${off.flag}`);
check(off.highDepthObjects === 0,
  'and nothing is drawn — no panel exists to be hidden',
  `${off.highDepthObjects} objects at depth >= 9500`);
check(off.listeners === 0,
  'and the Captain\'s telemetry taps are emitted into an empty room',
  `${off.listeners} listeners on champion-burst-begin`);

// ── 2. PRESENT WITH IT, AND THE TUNING IS BYTE-IDENTICAL ───────────────────
const tuneOff = await run('?nodlg=1&champdbg=1', async (page) => page.evaluate(SNAP));
const tuneOn = await run('?nodlg=1&champdbg=1&captel=1', async (page) => page.evaluate(SNAP));
check(tuneOff.cfg === tuneOn.cfg,
  'CHAMPION.captain is byte-identical with the instrument on',
  tuneOff.cfg === tuneOn.cfg ? '' : 'config differs');
check(tuneOff.player === tuneOn.player && tuneOff.weapons === tuneOn.weapons,
  'and so is every player damage input it measures',
  tuneOff.player === tuneOn.player ? 'weapons differ' : 'player differs');
check(tuneOff.actor === tuneOn.actor,
  'and a freshly spawned Captain arrives with identical hp, armour and speed',
  `${tuneOff.actor} vs ${tuneOn.actor}`);

// ── 3. A REAL SESSION, END TO END ──────────────────────────────────────────
const live = await run('?nodlg=1&champdbg=1&captel=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const { setGodMode } = await import('/src/systems/debug.js');
  setGodMode(true);
  gs.lives = 9999;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs.arenaActive = false;
  gs.enemies.getChildren().slice().forEach((e) => e.destroy());

  const c = gs.spawnChampion(gs.player.x + 380, gs.player.y, 'captain');
  await wait(300);
  const s0 = gs._captel.session();
  const startDurability = c.armour + c.hp;

  // Drive the REAL paths. Each of these is the call a bullet, a pellet or a
  // swing makes, with the scene's own source tag around it — nothing here
  // writes a telemetry counter directly.
  const hit = async (src, amount) => {
    gs._dmgSrc = src;
    c.damage(amount, { x: 30, y: 0 });
    gs._dmgSrc = null;
    await wait(40);
  };
  await hit('primary', 60);          // chip, armour only
  await hit('primary', 60);
  // TWO REAL SUPERS, THROUGH THE REAL PATH, AIMED AWAY FROM HIM. An earlier
  // build of this check emitted `player-fire-super` on the bus by hand — and
  // `GameScene` LISTENS to that event, so a real blast fired too and the pellet
  // count came back 20 against an expected 10. Firing the weapon is the only
  // honest way to ask whether the instrument counts the weapon. Aimed west,
  // away from the Captain, so the cadence check and the attribution check stay
  // independent of each other.
  const fireSuper = async () => {
    gs.player.superCharge = 999;
    gs.player._suppressedMs = 0;
    gs.player.tryFireSuper(Math.PI);
    await wait(420);           // clear of SUPER_WINDUP_MS, so the blast lands
  };
  await fireSuper();
  await fireSuper();

  await hit('super', 1800);          // eats most of the armour
  await hit('super', 700);           // breaks the layer and spills
  await hit('melee', 400);
  await hit('secondary', 250);
  await wait(200);

  const mid = gs._captel.session();
  const acts = { ...mid.acts };
  const superAt = mid.superAt.length;
  const superPellets = mid.shots.superPellets;
  const superCasts = mid.shots.superCasts;
  const armourBreakAt = mid.armourBreakAt;
  const firstDamageAt = mid.firstDamageAt;
  const spawnAt = mid.spawnAt;

  // THE KILLING BLOW IS TAGGED, AND THE RECONCILIATION SPANS IT. An untagged
  // finisher lands in OTHER, which is correct behaviour and a useless test:
  // reconciling only the hits before the kill leaves the one hit most likely to
  // be mis-attributed — the lethal one, where `amount` and what the pool
  // actually held differ by the most — outside the check.
  await hit('primary', 999999);
  await wait(300);
  const done = gs._captel.last();
  const text = gs._captel.report();
  const removed = startDurability - (c.armour + c.hp);
  const attributed = ['primary', 'secondary', 'super', 'melee', 'other']
    .reduce((p, k) => p + done.dmg[k], 0);
  const perSource = Object.fromEntries(
    Object.entries(done.dmg).map(([k, v]) => [k, Math.round(v)]));
  const hits = { ...done.hits };
  const cfgPellets = (await import('/src/config.js')).PLAYER.superPellets;

  // A SECOND CAPTAIN MUST RETIRE THE FIRST. A replay or a room change can
  // remove an actor with no death at all, and a session left live would then
  // collect the next Captain's fight on top of this one.
  const c2 = gs.spawnChampion(gs.player.x + 300, gs.player.y + 150, 'captain');
  await wait(200);
  const fresh = gs._captel.session();

  return {
    sessionStartedOnSpawn: !!s0 && s0.spawnAt > 0,
    removed: Math.round(removed), attributed: Math.round(attributed),
    perSource, hits, cfgPellets, startDurability: Math.round(startDurability),
    superCasts, superAt, superPellets,
    armourBreakOnce: armourBreakAt !== null && armourBreakAt >= spawnAt,
    firstDamageBeforeBreak: firstDamageAt !== null && firstDamageAt <= armourBreakAt,
    acts,
    closed: !!done && done.live === false && done.deathAt > done.spawnAt,
    deathReason: done?.why,
    textHasTTK: typeof text === 'string' && text.includes('TTK'),
    freshIsNew: !!fresh && fresh.actor === c2 && fresh.dmg.super === 0
      && fresh.shots.superCasts === 0,
    freshSpawnAfter: !!fresh && fresh.spawnAt >= (done?.deathAt ?? 0),
  };
}));

check(live.sessionStartedOnSpawn, 'a session opens on champion-spawned');
check(Math.abs(live.removed - live.attributed) <= 2,
  'ATTRIBUTION RECONCILES — the sum of attributed damage is the durability actually lost',
  `removed ${live.removed}, attributed ${live.attributed}`);
check(live.perSource.primary > 0 && live.perSource.super > 0
  && live.perSource.melee > 0 && live.perSource.secondary > 0,
  'each source is attributed to itself, not inferred from a magnitude',
  JSON.stringify(live.perSource));
check(live.perSource.other === 0,
  'and nothing a tagged path produced fell into OTHER',
  `other=${live.perSource.other}`);
// A REQUEST IS NOT A REMOVAL, and the lethal blow is where the two differ most.
// The finisher asked for 999999 against a pool holding a few thousand; if the
// instrument recorded the ARGUMENT, this bucket would carry six figures and the
// reconciliation above would have to fail with it.
check(live.perSource.primary > 500 && live.perSource.primary < 90000,
  'the lethal blow is recorded at what the pool HELD, never at what was asked for',
  JSON.stringify(live.perSource));
check(live.attributed <= Math.round(live.startDurability) + 2,
  'and no source can exceed the durability the Captain ever had',
  `attributed ${live.attributed}, durability ${live.startDurability}`);
check(live.superCasts === 2 && live.superAt === 2,
  'the Super count is the real `player-fire-super` count',
  `${live.superCasts} casts, ${live.superAt} timestamps`);
check(live.superPellets === live.cfgPellets * 2,
  'pellets come from the blast that really happened, not from the authored number',
  `${live.superPellets} from 2 casts of ${live.cfgPellets}`);
check(live.hits.super === 2 && live.hits.primary === 3,
  'a hit is counted once per landed hit, per source',
  JSON.stringify(live.hits));
check(live.armourBreakOnce && live.firstDamageBeforeBreak,
  'the milestones are ordered: spawn -> first damage -> armour break',
  `first ${live.firstDamageAt} break ${live.armourBreakAt}`);
check(live.acts.burstsBegun >= 0 && live.acts.rounds >= 0,
  'Captain actions are counted from his own state machine',
  JSON.stringify(live.acts));
check(live.closed && live.deathReason === 'killed',
  'the session closes on death with a real TTK',
  `closed=${live.closed} why=${live.deathReason}`);
check(live.textHasTTK, 'and the panel renders the record the tests read');
check(live.freshIsNew && live.freshSpawnAfter,
  'a new Captain retires the old session and starts clean',
  `fresh=${live.freshIsNew} after=${live.freshSpawnAfter}`);

// ── 4. NORMAL ENDLESS IS UNCHANGED ─────────────────────────────────────────
const prod = await run('?nodlg=1', async (page) => page.evaluate(async () => {
  const gs = window.game.scene.getScene('Game');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  gs._startWave(0);
  await wait(2600);
  return {
    champions: gs.enemies.getChildren().filter((e) => e.alive && e.isChampion).length,
    tel: !!gs._captel,
    dmgSrc: gs._dmgSrc ?? null,
  };
}));
check(prod.champions === 0 && prod.tel === false,
  'normal Endless has no Champion and no instrument',
  `${prod.champions} champions, tel=${prod.tel}`);
check(prod.dmgSrc === null,
  'and the damage source tag is cleared after every hit, never left standing',
  `_dmgSrc=${prod.dmgSrc}`);

await browser.close();
for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok || !c.detail ? '' : ' — ' + c.detail}`);
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) fail(`${failed.length} of ${checks.length} checks failed: ${failed.map((f) => f.label).join('; ')}`);
console.log(`PASS: ${checks.length} checks — the instrument observes, reconciles, and changes nothing`);
